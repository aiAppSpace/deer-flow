/*
  【文件职责】     守住本地 `.skill` 安装：三道拦截各说各的话，成功后切页签。
  【架构位置】     测试
  【依赖关系】     SkillSettings.vue · core/skills/api
  【边界与注意】   前两道（扩展名、大小）在前端拦，第三道（安全扫描）只有后端知道。
                   三种说的是不同的话，任何一种说错，用户都不知道自己该改什么。
                   尤其安全扫描那条：后端给的是「哪条规则、哪个文件的哪一行、怎么改」，
                   只留一句「安装失败」等于把这份诊断扔了。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const api = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@/core/skills/api", async (loadOriginal) => {
  const actual = await loadOriginal<typeof import("@/core/skills/api")>();
  return { ...actual, uploadSkillArchive: api.upload };
});

const catalog = vi.hoisted(() => ({ refetch: vi.fn() }));
vi.mock("@/composables/useSkillSettings", async () => {
  const { computed, ref: makeRef } = await import("vue");
  return {
    useSkillSettings: () => ({
      skills: makeRef([
        { name: "public-one", category: "public", enabled: true },
        { name: "custom-one", category: "custom", enabled: true },
      ]),
      canManage: computed(() => true),
      pending: makeRef(false),
      loading: makeRef(false),
      error: makeRef(null),
      toggle: vi.fn(),
      refetch: catalog.refetch,
    }),
  };
});
vi.mock("@/composables/useSettingsPermissions", async () => {
  const { computed, ref: makeRef } = await import("vue");
  const permissions = makeRef({ state: "ready", adminRequired: false });
  return {
    useSettingsPermissions: () => ({
      permissions,
      canManageSkills: computed(() => true),
      canReadSkills: makeRef(true),
      canManageMcp: makeRef(true),
      canReadMcp: makeRef(true),
    }),
  };
});
vi.mock("@/composables/useSettingsDialog", () => ({
  useSettingsDialog: () => ({ close: vi.fn() }),
}));

import SkillSettings from "@/components/workspace/settings/SkillSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  MAX_SKILL_ARCHIVE_UPLOAD_BYTES,
  SkillRequestError,
} from "@/core/skills/api";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const labels = enUS.settings.skills;
let toastStore = createWorkspaceToastStore();

beforeEach(() => {
  toastStore = createWorkspaceToastStore();
  api.upload.mockReset();
  catalog.refetch.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("navigateTo", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function mountSkills() {
  return mount(SkillSettings, {
    attachTo: document.body,
    global: { provide: { [workspaceToastKey as symbol]: toastStore } },
  });
}

/** 造一个指定名字和大小的 File；内容无所谓，组件只看这两样。 */
function archive(name: string, size = 10) {
  const file = new File(["x"], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

async function choose(
  wrapper: ReturnType<typeof mountSkills>,
  file: File | null,
) {
  const input = wrapper.find<HTMLInputElement>('input[type="file"]').element;
  Object.defineProperty(input, "files", {
    value: file ? [file] : [],
    configurable: true,
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await flushPromises();
  await wrapper.vm.$nextTick();
}

const lastToast = () => toastStore.toasts.value.at(-1);

describe("本地安装 .skill", () => {
  it("扩展名不对时在前端就拦住，不发请求", async () => {
    const wrapper = mountSkills();
    await choose(wrapper, archive("notes.txt"));
    expect(lastToast()?.message).toBe(labels.invalidArchive);
    expect(api.upload).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("超过 100 MiB 时在前端就拦住：不让人传完才被拒", async () => {
    const wrapper = mountSkills();
    await choose(
      wrapper,
      archive("big.skill", MAX_SKILL_ARCHIVE_UPLOAD_BYTES + 1),
    );
    expect(lastToast()?.message).toBe(labels.archiveTooLarge);
    expect(api.upload).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("正好等于上限时放行", async () => {
    api.upload.mockResolvedValue({
      success: true,
      skill_name: "x",
      message: "Installed x",
    });
    const wrapper = mountSkills();
    await choose(
      wrapper,
      archive("edge.skill", MAX_SKILL_ARCHIVE_UPLOAD_BYTES),
    );
    expect(api.upload).toHaveBeenCalled();
    wrapper.unmount();
  });

  it("装成功后切到「自定义」页签并刷新目录", async () => {
    api.upload.mockResolvedValue({
      success: true,
      skill_name: "mine",
      message: "Installed mine",
    });
    const wrapper = mountSkills();
    expect(wrapper.text()).toContain("public-one");
    await choose(wrapper, archive("mine.skill"));
    expect(lastToast()?.message).toBe("Installed mine");
    // 包就装在「自定义」里，留在「公共」页签上用户会以为没装上。
    expect(wrapper.text()).toContain("custom-one");
    expect(catalog.refetch).toHaveBeenCalled();
    wrapper.unmount();
  });

  it("安全扫描给了结论时，把结论摊在提示里", async () => {
    api.upload.mockRejectedValue(
      new SkillRequestError(400, "Skill rejected", null, "", [
        {
          rule_id: "SKL001",
          severity: "high",
          file: "run.sh",
          line: 12,
          message: "curl | sh",
          remediation: "Pin the installer.",
        },
        {
          rule_id: "SKL002",
          severity: "low",
          file: null,
          line: null,
          message: "No license",
          remediation: null,
        },
      ]),
    );
    const wrapper = mountSkills();
    await choose(wrapper, archive("bad.skill"));
    const toast = lastToast();
    expect(toast?.message).toBe("Skill rejected");
    // 「哪条规则、哪个文件的哪一行、怎么改」都要在。
    expect(toast?.description).toContain("high SKL001 · run.sh:12: curl | sh");
    expect(toast?.description).toContain("Pin the installer.");
    expect(toast?.description).toContain("low SKL002 · archive: No license");
    wrapper.unmount();
  });

  it.each([
    [403, labels.installAdminRequired],
    [413, labels.archiveTooLarge],
  ])("后端 %i 时说对应的那句话", async (status, message) => {
    api.upload.mockRejectedValue(
      new SkillRequestError(status, "raw backend text"),
    );
    const wrapper = mountSkills();
    await choose(wrapper, archive("x.skill"));
    expect(lastToast()?.message).toBe(message);
    wrapper.unmount();
  });

  it("装不上（不是请求出错）时照原样显示后端那句话", async () => {
    api.upload.mockResolvedValue({
      success: false,
      skill_name: "",
      message: "SKILL.md is missing",
    });
    const wrapper = mountSkills();
    await choose(wrapper, archive("x.skill"));
    expect(lastToast()?.message).toBe("SKILL.md is missing");
    wrapper.unmount();
  });

  /*
    「选完清空 input」这一条**在这里测不到**：happy-dom 的 file input `value`
    恒为空串，断言它等于 "" 是恒真的；而它真正防的是浏览器的原生语义——
    同一个文件连选两次时 value 没变、change 不触发。那一档归 e2e。
    这里能测的是另一半：上传还没回来时再选一次不会重复发。
  */
  it("上传中再选一次不会重复发", async () => {
    let release!: () => void;
    api.upload.mockReturnValue(
      new Promise((resolve) => {
        release = () =>
          resolve({ success: true, skill_name: "x", message: "ok" });
      }),
    );
    const wrapper = mountSkills();
    await choose(wrapper, archive("x.skill"));
    expect(api.upload).toHaveBeenCalledTimes(1);

    await choose(wrapper, archive("y.skill"));
    expect(api.upload).toHaveBeenCalledTimes(1);

    release();
    await flushPromises();
    // 这一次回来之后又能选了。
    await choose(wrapper, archive("z.skill"));
    expect(api.upload).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
