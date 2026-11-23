/*
  【文件职责】     钉住四处「aria 天生看不见」的图标 / tooltip 形状。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     SubtaskCard · CitationSourcesPanel · GoalStatus · ArtifactTrigger
  【边界与注意】   这四条对照台账与 `dom-parity` 的几何档都看不见：

                   · 字形不进可访问性树——`CheckCircle2`（=CircleCheck）与上游的
                     `CheckCircleIcon`（=CircleCheckBig）念出来是同一个名字，
                     画出来一个勾在圈内、一个勾冲出圆圈；
                   · 图标差 1~2px 也不进可访问性树，几何档要两边同时跑起来、
                     且那个元素当时可见才够得着；
                   · 原生 `title` 与 `<Tooltip>` 在可访问性树上都不是可访问名
                     （前者是 title 属性、后者是 aria-describedby），
                     换掉哪一个树都不动。

                   wave 68 的 `scripts/icon-parity.mjs` 是这四条的来源，
                   但它是顾问工具（要读 `../frontend`），不能当门禁。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import CitationSourcesPanel from "@/components/chat/CitationSourcesPanel.vue";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import ArtifactTrigger from "@/components/workspace/artifacts/ArtifactTrigger.vue";
import GoalStatus from "@/components/workspace/GoalStatus.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import SidecarTrigger from "@/components/workspace/sidecar/SidecarTrigger.vue";
import { useMessageTurnActions } from "@/composables/useMessageTurnActions";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";

vi.stubGlobal("useNuxtApp", () => ({
  $i18n: { t: ref(enUS), locale: ref("en-US") },
}));

describe("上游图标字形", () => {
  /*
    lucide 的 `CheckCircle2` 与 `CheckCircle` 是两个**不同的图标**的别名
    （CircleCheck / CircleCheckBig）。上游 subtask-card.tsx:113/251 用的是后者。
    这里读源码而不是挂载：两处分别在 status 为 completed 与 icon 插槽里，
    要把整张卡片喂到那两个分支上，成本远高于它守住的东西。
  */
  it("SubtaskCard 画的是上游那一颗 CircleCheckBig", async () => {
    const raw = await import("node:fs").then((fs) =>
      fs.readFileSync("app/components/chat/SubtaskCard.vue", "utf8"),
    );
    /*
      **先剥注释再问「用没用」**（线索 174）。第一版没剥，而解释这条修法的
      注释里就写着 `CheckCircle2` 四个字，于是断言撞在自己的注释上。
    */
    const source = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).toContain("  CheckCircle,\n");
    // 别名不同、字形也不同的那一颗。
    expect(source).not.toContain("CheckCircle2");
  });

  it("引用面板的实际复制键保留上游反馈和可缩放图形", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const toast = createWorkspaceToastStore();
    const wrapper = mount(CitationSourcesPanel, {
      props: {
        sources: [
          {
            id: "s1",
            title: "Reference",
            url: "https://example.com/reference",
            domain: "example.com",
            count: 1,
            occurrences: [{ index: 1, title: "Reference" }],
          },
        ],
      },
      global: { provide: { [workspaceToastKey as symbol]: toast } },
    });
    try {
      const button = wrapper.get(
        `button[aria-label="${enUS.citations.copyReference("Reference")}"]`,
      );
      for (const token of [
        "hover:bg-muted",
        "hover:text-foreground",
        "shrink-0",
        "transition-colors",
      ]) {
        expect(button.classes()).toContain(token);
      }
      expect(button.get("svg").classes()).toContain("size-3.5");
      await button.trigger("click");
      await flushPromises();
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(button.get("svg").classes()).toContain("text-green-500");
      expect(button.get("svg").classes()).toContain("size-3.5");
    } finally {
      wrapper.unmount();
      toast.clear();
      if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("引用面板的外链图标使用上游的size-3.5尺寸token", () => {
    const wrapper = mount(CitationSourcesPanel, {
      props: {
        sources: [
          {
            id: "s1",
            title: "Reference",
            url: "https://example.com/reference",
            domain: "example.com",
            count: 1,
            occurrences: [{ index: 1, title: "Reference" }],
          },
        ],
      },
      global: {
        provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
      },
    });
    expect(wrapper.get("a svg").classes()).toContain("size-3.5");
    wrapper.unmount();
  });

  it("sidecar 的回形针是上游的 12px", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(
        "app/components/workspace/sidecar/SidecarPanel.vue",
        "utf8",
      ),
    );
    /*
      上游 sidecar-panel.tsx:745 是 `size-3`（12px）。
      wave 72 把这颗键改走 `<Button>` 之后写法从 `:size="12"` 换成 `class="size-3"`
      ——与 ChatComposer 那颗同一种写法。**尺寸没变，钉法要跟着换**：
      钉源码写法而不是钉渲染出来的尺寸，本来就是这条断言的已知弱点
      （它只保证「没人手滑改成 14」）。
    */
    expect(source).toContain('<Paperclip class="size-3" aria-hidden="true" />');
    expect(source).not.toContain('<Paperclip class="size-3.5"');
  });
});

describe("原生 title 换成 Tooltip 组件", () => {
  const goal = {
    objective: "Ship the release",
    continuation_count: 2,
    max_continuations: 5,
  };

  it("GoalStatus 的续跑计数走 Tooltip，不走原生 title", () => {
    const wrapper = mount(GoalStatus, { props: { goal: goal as never } });

    const counter = wrapper
      .findAll("span")
      .find((node) => node.text().includes("2"));
    expect(counter).toBeDefined();
    // 原生 title 的延迟 / 位置 / 配色都不受控，触屏上根本不出现。
    expect(wrapper.html()).not.toContain("title=");
    expect(wrapper.find("[data-slot='tooltip-trigger']").exists()).toBe(true);
  });

  /*
    wave 72：ReferenceAttachment 原来把 `title` 挂在**整个 chip** 上，
    上游 reference-attachments.tsx:78 是把 `<Tooltip>` 包在图标 + 标签那一层
    span 上、内容是一个 `w-72` 的引用预览块。挂在容器上时**连清除键也会弹**
    原生气泡，而上游那颗按钮是不弹的。
  */
  it("ReferenceAttachment 的引用预览走 Tooltip，不走整块的原生 title", () => {
    const wrapper = mount(ReferenceAttachment, {
      props: {
        references: [
          {
            id: "r1",
            context: { content: "  selected   text  " },
          },
        ] as never,
        clearable: true,
      },
    });

    expect(wrapper.html()).not.toContain("title=");
    expect(wrapper.find("[data-slot='tooltip-trigger']").exists()).toBe(true);
    /* 空白折叠成单空格（上游 formatPreviewText）。 */
    expect(wrapper.find("[data-slot='tooltip-trigger']").exists()).toBe(true);
  });

  it("ArtifactTrigger 包在 Tooltip 里", () => {
    const wrapper = mount(ArtifactTrigger, { props: { count: 3 } });

    expect(wrapper.find("[data-slot='tooltip-trigger']").exists()).toBe(true);
    expect(
      wrapper.get("[data-testid='artifact-trigger']").attributes("aria-label"),
    ).toBe(enUS.common.showArtifacts);
  });

  it("没有 artifact 时整颗键都不渲染", () => {
    const wrapper = mount(ArtifactTrigger, { props: { count: 0 } });
    expect(wrapper.find("[data-testid='artifact-trigger']").exists()).toBe(
      false,
    );
  });
});

/*
  wave 71：**同一个池子里的另一半**——本仓手写了 98 处 `<button>`（上游同口径
  15 处），其中 94 处没有任何 `focus-visible` 类。这一节钉的不是焦点环
  （那一条实测下来是「两边都有环、但画得不一样」，见交接文档），
  而是**手写按钮顺带丢掉的那些东西**：图标字形、Tooltip、变体、禁用绑定。
*/
describe("会话头部的 sidecar 触发器", () => {
  it("画的是 lucide 图标，不是文字字符", () => {
    const wrapper = mount(SidecarTrigger, { props: { open: false } });
    /*
      此前这里是 `<button class="... size-8 ...">◫</button>`——U+25EB，
      一个跟着正文字体渲染的符号字符。上游 sidecar-trigger.tsx:59 画的是
      `<MessageSquareTextIcon />`。可访问名两边一样，所以 aria 快照、
      对照台账、dom-parity 的几何档三样全看不见。
    */
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("\u25EB");
  });

  it("走 Button primitive 的 icon 档（36px），不是手写的 32px", () => {
    const wrapper = mount(SidecarTrigger, { props: { open: false } });
    const button = wrapper.get("[data-testid='sidecar-header-trigger']");
    /*
      上游 `size="icon"` = `size-9` = 36×36；手写那版是 `size-8` = 32×32。
      判据取 `data-size` 而不是 `data-slot`：两层 as-child 之后留在 DOM 上的
      `data-slot` 是**最外层**那个（线索 62/63），这里是 TooltipTrigger——
      Radix 与 Reka 一致，上游那颗也是 `tooltip-trigger`。
    */
    expect(button.attributes("data-slot")).toBe("tooltip-trigger");
    expect(button.attributes("data-size")).toBe("icon");
    expect(button.classes()).toContain("size-9");
  });

  it("包在 Tooltip 里，并按开合切换 secondary / ghost", () => {
    const closed = mount(SidecarTrigger, { props: { open: false } });
    expect(closed.find("[data-slot='tooltip-trigger']").exists()).toBe(true);
    expect(
      closed
        .get("[data-testid='sidecar-header-trigger']")
        .attributes("data-variant"),
    ).toBe("ghost");

    const open = mount(SidecarTrigger, { props: { open: true } });
    // 上游 `variant={sidecar.open ? "secondary" : "ghost"}`——面板开着时这颗键
    // 自己带底色，是「现在开着」的唯一视觉线索。
    expect(
      open
        .get("[data-testid='sidecar-header-trigger']")
        .attributes("data-variant"),
    ).toBe("secondary");
  });

  it("重查 sidecar 线程期间置灰", () => {
    /*
      上游 `isReconciling`：打开前要带 force 重查一次（缓存里的 id 可能指向
      别处删掉的线程，#3555），这期间按钮 disabled。本仓此前 await 了那次
      重查却不锁按钮，连点两下会发两次 restore。
    */
    const wrapper = mount(SidecarTrigger, {
      props: { open: false, pending: true },
    });
    expect(
      wrapper
        .get("[data-testid='sidecar-header-trigger']")
        .attributes("disabled"),
    ).toBeDefined();
  });
});

describe("手写按钮丢掉的那些（源码档）", () => {
  const read = async (path: string) => {
    const raw = await import("node:fs").then((fs) =>
      fs.readFileSync(path, "utf8"),
    );
    // 先剥注释再问「用没用」（线索 174/202）——解释修法的注释里全是这些串。
    return raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  };

  it("composer 的提交键是描边圆钮，不是实心 primary", async () => {
    const source = await read("app/components/chat/ChatComposer.vue");
    /*
      上游 `<PromptInputSubmit className="rounded-full" variant="outline" />`
      （input-box.tsx:2729）。手写那版是 `bg-primary text-primary-foreground`，
      于是这颗键一边空心一边实心蓝。`shadow-none` 也不能少：上游走
      `InputGroupButton`，它的 base 把 outline 的 `shadow-xs` 盖掉了。
    */
    expect(source).toContain('class="rounded-full shadow-none"');
    expect(source).not.toContain("bg-primary text-primary-foreground");
  });

  it("memory 的清空键用 destructive token，且清空进行中置灰", async () => {
    const source = await read(
      "app/components/workspace/settings/MemorySettings.vue",
    );
    /*
      上游 `<Button variant="destructive" className="ml-auto"
      disabled={clearMemory.isPending}>`。手写那版写死 `bg-red-600 text-white`
      （深色主题不跟着 token 翻转），而且**没有 disabled 绑定**。
    */
    expect(source).toContain('variant="destructive"');
    expect(source).toContain(':disabled="owner.clear.isPending.value"');
    expect(source).not.toContain("bg-red-600");
  });

  it("改完重跑：草稿为空或一个字没改时不许提交", async () => {
    const submit = vi.fn(async () => true);
    let actions!: ReturnType<typeof useMessageTurnActions>;
    const wrapper = mount(
      defineComponent({
        setup() {
          actions = useMessageTurnActions({
            owner: () => ["thread-1", "user-1/agent-1"],
            submit: () => submit,
            groupIds: () => ["human-1"],
            onBeginEdit: vi.fn(),
            notifyError: vi.fn(),
            copyFailed: () => "Copy failed",
          });
          return () =>
            h("button", { disabled: actions.editSubmitDisabled.value });
        },
      }),
    );
    try {
      await actions.beginEdit(
        {
          id: "human-1",
          type: "human",
          content: "Original question",
        } as Message,
        0,
      );
      for (const draft of [
        "Original question",
        "   ",
        "  Original question  ",
      ]) {
        actions.editState.value!.text = draft;
        await wrapper.vm.$nextTick();
        expect(wrapper.get("button").attributes("disabled")).toBeDefined();
        await actions.updateAndRerun();
        expect(submit).not.toHaveBeenCalled();
      }
      actions.editState.value!.text = "  Revised question  ";
      await wrapper.vm.$nextTick();
      expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
      await actions.updateAndRerun();
      expect(submit).toHaveBeenCalledExactlyOnceWith(
        "human-1",
        "Revised question",
        ["human-1"],
      );
      expect(actions.editState.value).toBeNull();
    } finally {
      wrapper.unmount();
    }
  });
});
