/*
  【文件职责】     斜杠建议浮层的显示条件、键盘语义与活动项，与上游逐条对齐。
  【架构位置】     L3 测试
  【依赖关系】     components/chat/ChatComposer.vue
  【边界与注意】   这一簇差异**对照台账原来一条都看不见**，因为它只在「打了 `/` 之后」
                   才存在，而默认取样面从不打开它（wave 21 之前）。所以这里的断言不是
                   台账的重复，而是台账够不着的那一半：焦点门禁、Escape 关闭、hover
                   改活动项、Tab 补全、以及「打全的内建命令回车直接执行」。

                   `setValue` 不会触发 focus（jsdom 与真浏览器都一样），所以每条用例
                   都必须自己先 `trigger("focus")`——这正是新的显示条件要求的东西，
                   漏掉就会误判成产品坏了（坑 97）。
*/

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const mocks = vi.hoisted(() => ({
  loadSkills: vi.fn(),
  loadModels: vi.fn(),
  getUploadLimits: vi.fn(),
  uploadFiles: vi.fn(),
  compactThreadContext: vi.fn(),
}));

vi.mock("@/core/skills/api", () => ({ loadSkills: mocks.loadSkills }));
vi.mock("@/core/models/api", () => ({ loadModels: mocks.loadModels }));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: mocks.getUploadLimits,
  uploadFiles: mocks.uploadFiles,
}));
vi.mock("@/core/threads/api", () => ({
  compactThreadContext: mocks.compactThreadContext,
}));

/*
  一条名字以内建命令开头的技能。只有两条用例需要它——chip 态里的回车语义要求
  「目录里有一条技能、同时输入行又正好拼成一条内建命令」，默认目录造不出这个局面。
  放进公共夹具会把其余用例的期望行数一起改掉，所以按用例注入。
*/
const COMPACT_HELPER = {
  name: "compact-helper",
  description: "A skill whose name starts with a builtin command.",
  enabled: true,
};

function mountComposer(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const submitMessage = vi.fn(async (_text, _files, options) => {
    options.onAccepted();
    return true;
  });
  const wrapper = mount(ChatComposer, {
    props: {
      threadKey: "thread-1",
      targetThreadId: "thread-1",
      userId: "user-1",
      agentName: null,
      streaming: false,
      uploading: false,
      promptHistory: [],
      context: { model_name: "reasoner", mode: "pro" },
      submitMessage,
      ...props,
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: { ReferenceAttachment: true, GoalStatus: true },
    },
  });
  return { wrapper, submitMessage };
}

/** 打开目录：先聚焦，再写值。两步都是显示条件的一部分。 */
async function openSuggestions(
  wrapper: ReturnType<typeof mountComposer>["wrapper"],
  value: string,
) {
  const textarea = wrapper.get("textarea[name='message']");
  await textarea.trigger("focus");
  await textarea.setValue(value);
  await flushPromises();
  return textarea;
}

const optionTexts = (wrapper: ReturnType<typeof mountComposer>["wrapper"]) =>
  wrapper.findAll("[role='option']").map((option) => option.text());

const selectedIndex = (wrapper: ReturnType<typeof mountComposer>["wrapper"]) =>
  wrapper
    .findAll("[role='option']")
    .findIndex((option) => option.attributes("aria-selected") === "true");

describe("ChatComposer slash suggestions", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
    mocks.loadSkills.mockReset().mockResolvedValue([
      {
        name: "data-analysis",
        description: "Analyze structured data and produce charts.",
        enabled: true,
      },
      {
        name: "frontend-design",
        description: "Create polished frontend interfaces.",
        enabled: true,
      },
      { name: "disabled-skill", description: "Hidden.", enabled: false },
    ]);
    mocks.loadModels.mockReset().mockResolvedValue({
      models: [
        {
          id: "reasoner",
          name: "reasoner",
          model: "provider-reasoner",
          display_name: "Reasoner",
        },
      ],
      token_usage: { enabled: false },
    });
    mocks.getUploadLimits.mockReset().mockResolvedValue(undefined);
    mocks.uploadFiles.mockReset();
    mocks.compactThreadContext
      .mockReset()
      .mockResolvedValue({ compacted: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /*
    上游每一项是「图标 + `/{name}` + 说明」（input-box.tsx:2146）。本仓原来技能项只有
    裸名字、`/goal` 拼成 "Goal — 说明"、`/compact` **连名字都没有**——三种写法，
    没有一种和上游一样，而这正是台账里那 8 行。
  */
  it("renders every row as /name plus its description, skills before builtins", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await openSuggestions(wrapper, "/");

    expect(optionTexts(wrapper)).toEqual([
      "/data-analysisAnalyze structured data and produce charts.",
      "/frontend-designCreate polished frontend interfaces.",
      "/goalSet, show, or clear an active goal",
      "/compactCompact earlier context while keeping the full chat visible",
    ]);
  });

  it("matches a builtin command by its description", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await openSuggestions(wrapper, "/earlier");

    expect(optionTexts(wrapper)).toEqual([
      "/compactCompact earlier context while keeping the full chat visible",
    ]);
  });

  it("stays closed until the editor is focused", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("/");
    await flushPromises();
    expect(wrapper.findAll("[role='listbox']")).toHaveLength(0);

    await textarea.trigger("focus");
    await flushPromises();
    expect(wrapper.findAll("[role='listbox']")).toHaveLength(1);

    await textarea.trigger("blur");
    await flushPromises();
    expect(wrapper.findAll("[role='listbox']")).toHaveLength(0);
  });

  /*
    先开着再禁用，不是一开始就禁用：VTU 的 `trigger()` 对 disabled 元素**静默不做事**，
    所以「一开始就 disabled」那种写法里焦点事件根本没发出去，目录不出现的原因是
    没聚焦而不是这条守卫——删掉守卫它照样绿（wave 21 实测的一条假绿，坑 57 第二种）。
  */
  it("closes as soon as the composer is disabled", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await openSuggestions(wrapper, "/");
    expect(wrapper.findAll("[role='listbox']")).toHaveLength(1);

    await wrapper.setProps({ disabled: true });
    await flushPromises();
    expect(wrapper.findAll("[role='listbox']")).toHaveLength(0);
  });

  /*
    Escape 记的是**当时那行文本**，不是一个裸布尔。记布尔的话再敲一个字符列表也回不来，
    而用户按 Escape 想说的是「这一行不用提示」。退回到那行文本时它必须再次消失。
  */
  it("dismisses on Escape for that exact line and comes back when the text changes", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/");
    expect(wrapper.findAll("[role='option']")).toHaveLength(4);

    await textarea.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.findAll("[role='option']")).toHaveLength(0);

    await textarea.setValue("/data");
    await flushPromises();
    expect(wrapper.findAll("[role='option']")).toHaveLength(1);

    await textarea.setValue("/");
    await flushPromises();
    expect(wrapper.findAll("[role='option']")).toHaveLength(0);
  });

  /*
    上游每个选项都有 onMouseEnter（input-box.tsx:2160）。少了它，aria-selected 说的是
    第一项、mousedown 生效的却是指针下那一项——读屏器听到的和点下去发生的是两回事。
  */
  it("moves the active row to the hovered option", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await openSuggestions(wrapper, "/");
    expect(selectedIndex(wrapper)).toBe(0);

    await wrapper.findAll("[role='option']")[2]!.trigger("mouseenter");
    await flushPromises();
    expect(selectedIndex(wrapper)).toBe(2);
  });

  it("accepts the active row on Tab as well as Enter", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/");

    await textarea.trigger("keydown", { key: "ArrowDown" });
    await textarea.trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    expect(selectedIndex(wrapper)).toBe(2);

    await textarea.trigger("keydown", { key: "Tab" });
    await flushPromises();
    expect(
      (wrapper.get("textarea[name='message']").element as HTMLTextAreaElement)
        .value,
    ).toBe("/goal ");
    expect(wrapper.findAll("[role='option']")).toHaveLength(0);
  });

  /*
    Escape 记下的那行文本必须在选中技能时清掉。不清的话：`/` → Escape → 打字 →
    回车选中技能 → chip 态里再打 `/`，input 又回到 `"/"`，与那条陈年的 dismissed
    记录撞上，目录再也打不开——而用户刚刚按 Escape 关掉的是**上一屏**的目录。
  */
  /*
    chip 输入框也要上报焦点：它是选中技能之后**唯一**的编辑区，目录正是从这里靠
    `/` 重新打开的。少了这一对监听，`textareaFocused` 会停在 textarea 留下的 true
    上（元素被 v-if 换掉时不派发 blur），于是「关不掉」在 chip 态里原样复现。
    两半都要断言（坑 57）：blur 之后必须关，focus 之后必须能开。
  */
  it("tracks focus on the skill-chip editor too", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/front");
    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();

    const chip = wrapper.get(
      "[data-slot='input-group-control'][role='textbox']",
    );
    await chip.trigger("blur");
    Object.assign(chip.element, { innerText: "/" });
    await chip.trigger("input");
    await flushPromises();
    expect(wrapper.findAll("[role='listbox']")).toHaveLength(0);

    await chip.trigger("focus");
    await flushPromises();
    expect(wrapper.findAll("[role='listbox']")).toHaveLength(1);
  });

  it("forgets an earlier Escape once a skill is picked", async () => {
    mocks.loadSkills.mockResolvedValue([
      {
        name: "data-analysis",
        description: "Analyze structured data and produce charts.",
        enabled: true,
      },
      {
        name: "frontend-design",
        description: "Create polished frontend interfaces.",
        enabled: true,
      },
      COMPACT_HELPER,
    ]);
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/");

    await textarea.trigger("keydown", { key: "Escape" });
    await textarea.setValue("/front");
    await flushPromises();
    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();

    const chip = wrapper.get(
      "[data-slot='input-group-control'][role='textbox']",
    );
    await chip.trigger("blur");
    await chip.trigger("focus");
    Object.assign(chip.element, { innerText: "/" });
    await chip.trigger("input");
    await flushPromises();

    expect(optionTexts(wrapper)).toEqual([
      "/data-analysisAnalyze structured data and produce charts.",
      "/frontend-designCreate polished frontend interfaces.",
      "/compact-helperA skill whose name starts with a builtin command.",
    ]);
  });

  /*
    「打全的内建命令直接执行」只在**没有技能 chip** 时成立。chip 态里目录只列技能，
    `/compact` 这行文本提交出去也不是命令（它会被拼成 `/skill /compact`），
    所以那里的回车该接受的就是高亮的那条技能。
  */
  it("still accepts the highlighted skill on Enter inside a skill chip", async () => {
    mocks.loadSkills.mockResolvedValue([
      {
        name: "data-analysis",
        description: "Analyze structured data and produce charts.",
        enabled: true,
      },
      COMPACT_HELPER,
    ]);
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/data");
    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();

    const chip = wrapper.get(
      "[data-slot='input-group-control'][role='textbox']",
    );
    await chip.trigger("focus");
    Object.assign(chip.element, { innerText: "/compact" });
    await chip.trigger("input");
    await flushPromises();
    expect(optionTexts(wrapper)).toEqual([
      "/compact-helperA skill whose name starts with a builtin command.",
    ]);

    await chip.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(mocks.compactThreadContext).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("/compact-helper");
  });

  /*
    翻历史翻到一条**本身就是斜杠查询**的旧草稿时，目录会跟着打开。按 Escape 关掉它
    之后，方向键要还给历史继续往上翻——判据是**显示条件**而不是「有没有匹配项」，
    因为匹配项这时还在。两条判据分家的话，用户在这里既拿不到建议也翻不动历史。

    （空输入框上直接按 ArrowUp 走不到这一步：两个应用都要求「要么输入框是空的，
    要么已经在翻历史」，见上游 input-box.tsx:1756。）
  */
  it("keeps stepping through prompt history after the catalog is dismissed", async () => {
    const { wrapper } = mountComposer({
      promptHistory: ["older draft", "/data"],
    });
    await flushPromises();

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.trigger("focus");
    await textarea.trigger("keydown", { key: "ArrowUp" });
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).toBe("/data");
    expect(wrapper.findAll("[role='option']")).toHaveLength(1);

    await textarea.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.findAll("[role='option']")).toHaveLength(0);

    await textarea.trigger("keydown", { key: "ArrowUp" });
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).toBe("older draft");
  });

  it("turns a picked skill into a chip instead of slash text", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/front");

    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(wrapper.findAll("textarea[name='message']")).toHaveLength(0);
    expect(wrapper.text()).toContain("/frontend-design");
  });

  /*
    chip 旁边那块可编辑区，逐件对着上游 input-box.tsx:2277。此前本仓是一个只带
    `role="textbox"` + `aria-label` 的 `<div>`：**没有 aria-multiline**
    （读屏器把它当单行输入播报，回车该换行还是该提交说不清），
    **空的时候一个占位字都不画**（上游用 data-empty/data-placeholder 画出来），
    锁住时也**没有退出 Tab 序列**。

    这一屏对照台账看不见：斜杠技能要先打字再选中才出现（第①类），
    而 aria-multiline / aria-placeholder / data-* 三样都不进 aria 快照（第⑤类）。
  */
  /*
    chip 与可编辑区是**同一行文字里的两个 inline 元素**（上游 input-box.tsx:2264），
    不是两列。本仓原来是 `flex items-start gap-2`，差的不只是排版：正文不再绕着 chip
    排、长草稿没有 `max-h-48` 的上限、长技能名会把可编辑区挤没、点空白不聚焦末尾。
    这一屏对照台账看不见（斜杠技能要先打字再选中才出现，第①类）。
  */
  it("keeps the chip and the editor in one scrollable inline row", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/front");
    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();

    const editor = wrapper.get('[role="textbox"][contenteditable]');
    const row = editor.element.parentElement!;
    // 容器：可滚且有高度上限，不是 flex 两列。
    expect(row.className).toContain("max-h-48");
    expect(row.className).toContain("overflow-y-auto");
    expect(row.className).toContain("whitespace-pre-wrap");
    expect(row.className).not.toContain("flex items-start");
    /*
      chip：inline + 宽度上限，不会把可编辑区挤没。
      **它是一颗按钮，不是一个 span**（第四十四轮）——上游 input-box.tsx:2356
      用的是 `SlashSkillChip` 的可移除档：`<button aria-label="Remove /<name>">`
      里包着名字和一颗 X。本仓此前是个纯 `<span class="bg-secondary …">`，
      **没有任何移除入口**：鼠标用户选中一个斜杠技能之后取消不掉它。
      台账看不见这一屏（要先打字再选中才出现），是 Tab 走一圈时发现的。
    */
    const chip = row.querySelector("button")!;
    expect(chip.getAttribute("aria-label")).toBe(
      enUS.primitives.removeSlashSkill("frontend-design"),
    );
    expect(chip.className).toContain("align-top");
    expect(chip.className).toContain("max-w-[min(11rem,45%)]");
    // 上游 CHIP_BASE_CLASS 的那几个可感知的：颜色档、边框、等宽字。
    expect(chip.className).toContain("bg-primary/10");
    expect(chip.className).toContain("border-primary/20");
    expect(chip.className).toContain("font-mono");
    // 可编辑区不再自己占一栏。
    expect(editor.classes()).not.toContain("flex-1");

    /*
      点容器空白处 → 光标落到可编辑区末尾（上游同一处的 onClick）。
      只在 `target === currentTarget` 时动手，所以点在 chip 上不该抢焦点。

      **次序是有意的：先点空白、再点 chip。** 点 chip 现在会把技能移除掉
      （上游 input-box.tsx:2359 的 `onRemove={clearSelectedSlashSkill}`），
      那一下之后这一行就不存在了，再去点它只会量到一个脱离文档的节点。
    */
    // 用 spy 而不是 document.activeElement：这个 wrapper 没有 attachTo，
    // 脱离文档的节点 focus() 不会改 activeElement，断言会恒假。
    const focusSpy = vi.spyOn(editor.element as HTMLElement, "focus");
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(focusSpy).toHaveBeenCalledTimes(1);

    chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    focusSpy.mockRestore();
  });

  /*
    **移除入口本身**（第四十四轮）。本仓此前那颗胶囊是个纯 `<span>`：
    技能一旦选中，鼠标用户没有任何办法取消它——只能把整段草稿删掉。
    上游点那颗 X 就回到普通输入框，并且**把焦点交回输入区**
    （input-box.tsx:2058 的 clearSelectedSlashSkill 里那次 focus）。
  */
  it("removes the selected skill when the chip is clicked", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/front");
    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();

    const chip = wrapper.get(
      `button[aria-label="${enUS.primitives.removeSlashSkill("frontend-design")}"]`,
    );
    expect(wrapper.find('[role="textbox"][contenteditable]').exists()).toBe(
      true,
    );

    await chip.trigger("click");
    await flushPromises();

    // 胶囊与 chip 档的可编辑区一起消失，真 textarea 回来。
    expect(
      wrapper
        .findAll("button")
        .some(
          (button) =>
            button.attributes("aria-label") ===
            enUS.primitives.removeSlashSkill("frontend-design"),
        ),
    ).toBe(false);
    expect(wrapper.find('[role="textbox"][contenteditable]').exists()).toBe(
      false,
    );
    expect(wrapper.find("textarea").exists()).toBe(true);
  });

  it("gives the chip editor the same textbox contract upstream has", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/front");
    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();

    const editor = wrapper.get('[role="textbox"][contenteditable]');
    expect(editor.element.tagName.toLowerCase()).toBe("span");
    expect(editor.attributes("aria-multiline")).toBe("true");
    expect(editor.attributes("aria-placeholder")).toBe(
      enUS.inputBox.placeholder,
    );
    expect(editor.attributes("data-placeholder")).toBe(
      enUS.inputBox.placeholder,
    );
    // 刚选中技能时草稿是空的 → 占位要画出来。
    expect(editor.attributes("data-empty")).toBe("true");
    expect(editor.attributes("tabindex")).toBe("0");

    await editor.trigger("input");
    Object.defineProperty(editor.element, "innerText", {
      value: "hello",
      configurable: true,
    });
    await editor.trigger("input");
    await flushPromises();
    expect(editor.attributes("data-empty")).toBe("false");
  });

  /*
    打全了的内建命令回车**直接执行**，不再先接受一次它自己的建议（2026-09-02 两边同改）。
    没有这一条，`/compact` 要按两下回车，第一下只是把这行改写成它自己加一个空格。
  */
  it("runs a fully typed builtin command on Enter instead of re-accepting it", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/compact");
    expect(wrapper.findAll("[role='option']")).toHaveLength(1);

    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(mocks.compactThreadContext).toHaveBeenCalledTimes(1);
    expect(
      (wrapper.get("textarea[name='message']").element as HTMLTextAreaElement)
        .value,
    ).toBe("");
  });

  it("still completes a fully typed builtin command on Tab", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = await openSuggestions(wrapper, "/compact");

    await textarea.trigger("keydown", { key: "Tab" });
    await flushPromises();

    expect(mocks.compactThreadContext).not.toHaveBeenCalled();
    expect(
      (wrapper.get("textarea[name='message']").element as HTMLTextAreaElement)
        .value,
    ).toBe("/compact ");
  });

  /*
    欢迎态的建议行与斜杠目录互斥，判据是**显示条件**而不是「有没有匹配项」
    （上游 input-box.tsx:2735 的 !showSkillSuggestions）。这两条一旦分家，
    没聚焦时会出现「建议行被一个看不见的目录顶掉」。
  */
  it("hides the welcome suggestion row only while the catalog is actually open", async () => {
    const { wrapper } = mountComposer({ isWelcome: true });
    await flushPromises();

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("/");
    await flushPromises();
    expect(wrapper.findAll("[data-testid='welcome-suggestions']")).toHaveLength(
      1,
    );

    await textarea.trigger("focus");
    await flushPromises();
    expect(wrapper.findAll("[data-testid='welcome-suggestions']")).toHaveLength(
      0,
    );
  });
});
