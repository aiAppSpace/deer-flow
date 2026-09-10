import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, provide } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ExportTrigger from "@/components/workspace/ExportTrigger.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { AgentThread } from "@/core/threads/types";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const mocks = vi.hoisted(() => ({ exportThread: vi.fn() }));
vi.mock("@/core/threads/export", () => ({ exportThread: mocks.exportThread }));

const thread: AgentThread = {
  thread_id: "thread-1",
  created_at: "2026-08-24T00:00:00Z",
  updated_at: "2026-08-24T00:00:00Z",
  metadata: {},
  status: "idle",
  values: { title: "Weather", messages: [] },
  interrupts: {},
};
const messages: Message[] = [{ id: "ai-1", type: "ai", content: "Sunny" }];

function mountTrigger(messageList: Message[] = messages) {
  const toast = createWorkspaceToastStore({ durationMs: 60_000 });
  const Host = defineComponent({
    setup() {
      provide(workspaceToastKey, toast);
      return () =>
        h(ExportTrigger, {
          threadId: thread.thread_id,
          thread,
          messages: messageList,
        });
    },
  });
  return { wrapper: mount(Host, { attachTo: document.body }), toast };
}

beforeEach(() => {
  document.body.innerHTML = "";
  mocks.exportThread.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ExportTrigger", () => {
  it("replaces the chat-header share action with React-equivalent exports", async () => {
    const { wrapper, toast } = mountTrigger();
    expect(wrapper.find('[aria-label="Export"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Share");

    await wrapper.get('[aria-label="Export"]').trigger("click");
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>(
        '[data-testid="header-export-markdown"]',
      )!
      .click();
    await flushPromises();

    expect(mocks.exportThread).toHaveBeenCalledWith(
      thread,
      messages,
      "markdown",
    );
    expect(toast.toasts.value.at(-1)).toMatchObject({
      kind: "success",
      message: enUS.common.exportSuccess,
    });
    wrapper.unmount();
    toast.clear();
  });

  /*
    上游 export-trigger.tsx 用的是不传 size 的 `<Button variant="ghost">`，外面套
    `<Tooltip>` 再套 `<DropdownMenuTrigger asChild>`。这里钉住的是「两层 as-child
    塌到同一颗 Button 上」：手搓 `<button class="h-8 px-2">` 会让这颗按钮比上游窄
    9.1px，而它右对齐在头部末尾，于是它左边的 browser-trigger 整个跟着右移——
    那就是 browser-feature 场景上唯一一条几何台账。
  */
  it("renders the shared Button primitive under both as-child triggers", () => {
    const { wrapper, toast } = mountTrigger();
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(1);
    const button = buttons[0]!;
    // 实测上游：两层 as-child 之后留在 DOM 上的 data-slot 是最外层那个
    // （React probe 到的 Export 按钮同样是 tooltip-trigger，不是 button）。
    expect(button.attributes("data-slot")).toBe("tooltip-trigger");
    expect(button.attributes("data-variant")).toBe("ghost");
    expect(button.attributes("data-size")).toBe("default");
    // Tooltip 那一层没有把 dropdown 的连线吃掉。
    expect(button.attributes("aria-haspopup")).toBe("menu");
    // 尺寸档来自 buttonVariants，不是写死的 h-8/px-2。
    const cls = button.classes();
    expect(cls).toContain("h-9");
    expect(cls).toContain("font-medium");
    expect(cls).not.toContain("h-8");
    wrapper.unmount();
    toast.clear();
  });

  it("does not render when there are no messages", () => {
    const { wrapper, toast } = mountTrigger([]);
    expect(wrapper.find("button").exists()).toBe(false);
    wrapper.unmount();
    toast.clear();
  });
});
