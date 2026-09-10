/*
  【文件职责】     守住产物归档下载键：什么时候出现、点了发什么、失败说什么。
  【架构位置】     测试
  【依赖关系】     MessageList.vue · ArtifactFileCards.vue · core/artifacts/api
  【边界与注意】   这颗键的出现条件全是**否定式**的（只有一个文件不出、太多不出、
                   运行没结束不出、案例页不出），所以每一条都要单独有样本——
                   只测「正常情况下出现」的话，那四条随便坏掉一条都不会被发现。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const api = vi.hoisted(() => ({
  manifest: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@/core/artifacts/api", async (loadOriginal) => {
  const actual = await loadOriginal<typeof import("@/core/artifacts/api")>();
  return {
    ...actual,
    getArtifactArchiveManifest: api.manifest,
    downloadArtifactArchive: api.download,
  };
});
vi.mock("@/core/skills/api", () => ({
  installSkill: vi.fn(),
  SkillRequestError: class extends Error {
    get isAdminRequired() {
      return false;
    }
  },
}));

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { ArtifactRequestError } from "@/core/artifacts/api";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import { installAnimationFrameStub } from "../../support/animation-frame-stub";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

let toastStore = createWorkspaceToastStore();
let animationFrames: ReturnType<typeof installAnimationFrameStub>;

beforeEach(() => {
  toastStore = createWorkspaceToastStore();
  api.manifest.mockReset();
  api.download.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  animationFrames = installAnimationFrameStub();
});
afterEach(() => {
  animationFrames.cleanup();
  vi.unstubAllGlobals();
});

function presentFilesMessage(id: string, runId: string, files: string[]) {
  return {
    id,
    type: "ai",
    content: "",
    run_id: runId,
    tool_calls: [
      { id: `call-${id}`, name: "present_files", args: { filepaths: files } },
    ],
  };
}

const TWO_FILES = [
  "/mnt/user-data/outputs/a.txt",
  "/mnt/user-data/outputs/b.txt",
];

function mountList(props: Record<string, unknown> = {}) {
  return mount(MessageList, {
    props: {
      streaming: false,
      loading: false,
      threadId: "thread-1",
      messages: [presentFilesMessage("files", "run-1", TWO_FILES)],
      ...props,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
      provide: { [workspaceToastKey as symbol]: toastStore },
    },
  });
}

const archiveButton = (wrapper: ReturnType<typeof mountList>) =>
  wrapper
    .findAll("button")
    .find((button) => button.text().startsWith("Download current versions"));

describe("产物归档下载", () => {
  it("多个文件时出现，文案说清有几个", async () => {
    api.manifest.mockResolvedValue({ fileCount: 2 });
    const wrapper = mountList();
    await flushPromises();
    expect(api.manifest).toHaveBeenCalledWith({
      threadId: "thread-1",
      runId: "run-1",
    });
    expect(archiveButton(wrapper)?.text()).toContain(
      "Download current versions (2 files)",
    );
    // 包里是当前版本，不是这条回复当时的版本——这句必须说出来。
    expect(wrapper.text()).toContain("Contents are the current versions");
  });

  it.each([
    ["只有一个文件", 1],
    ["超过 50 个", 51],
  ])("%s 时不出现", async (_label, fileCount) => {
    api.manifest.mockResolvedValue({ fileCount });
    const wrapper = mountList();
    await flushPromises();
    expect(archiveButton(wrapper)).toBeUndefined();
  });

  it("运行还没结束时不问也不出现：这时候打的包立刻过期", async () => {
    api.manifest.mockResolvedValue({ fileCount: 5 });
    const wrapper = mountList({ streaming: true });
    await flushPromises();
    expect(api.manifest).not.toHaveBeenCalled();
    expect(archiveButton(wrapper)).toBeUndefined();
  });

  it("案例页不问 Gateway", async () => {
    api.manifest.mockResolvedValue({ fileCount: 5 });
    const wrapper = mountList({ isMock: true });
    await flushPromises();
    expect(api.manifest).not.toHaveBeenCalled();
    expect(archiveButton(wrapper)).toBeUndefined();
  });

  it("点了就取包并用后端给的文件名存盘", async () => {
    api.manifest.mockResolvedValue({ fileCount: 2 });
    api.download.mockResolvedValue({
      blob: new Blob(["zip"]),
      filename: "artifacts-run-1.zip",
    });
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clicks: string[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this.download);
    };
    try {
      const wrapper = mountList();
      await flushPromises();
      await archiveButton(wrapper)!.trigger("click");
      await flushPromises();
      expect(api.download).toHaveBeenCalledWith({
        threadId: "thread-1",
        runId: "run-1",
      });
      expect(clicks).toEqual(["artifacts-run-1.zip"]);
      // 建出来的 object URL 要还回去，否则这一份 blob 一直占着内存。
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it("失败时说后端那句话，说不出来才用兜底", async () => {
    api.manifest.mockResolvedValue({ fileCount: 2 });
    api.download.mockRejectedValueOnce(
      new ArtifactRequestError(413, "archive too large"),
    );
    const wrapper = mountList();
    await flushPromises();
    await archiveButton(wrapper)!.trigger("click");
    await flushPromises();
    expect(toastStore.toasts.value.at(-1)?.message).toBe("archive too large");

    api.download.mockRejectedValueOnce(new TypeError("network down"));
    await archiveButton(wrapper)!.trigger("click");
    await flushPromises();
    expect(toastStore.toasts.value.at(-1)?.message).toBe(
      enUS.artifactArchive.downloadFailed,
    );
  });
});
