import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import TodoList from "@/components/workspace/TodoList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

function mountMessages(messages: Message[], streaming = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = mount(MessageList, {
    props: {
      messages,
      rawMessages: messages,
      streaming,
      loading: false,
      threadId: "thread-1",
      interactive: true,
      tokenUsageInlineMode: "per_turn",
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        StreamMarkdown: { template: "<div data-testid='markdown' />" },
        ReferenceAttachment: true,
        WorkspaceChangesBadge: true,
        SubtaskCard: true,
      },
    },
  });
  return { wrapper, invalidate };
}

describe("persisted message surfaces", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
  });

  it("renders modern and legacy files, image previews, source details, copy, and per-turn usage", async () => {
    const messages = [
      {
        id: "human-modern",
        type: "human",
        content: "Review files",
        additional_kwargs: {
          files: [
            {
              filename: "diagram.png",
              size: 10,
              path: "/mnt/user-data/uploads/diagram.png",
              status: "uploaded",
            },
            {
              filename: "notes.txt",
              size: 20,
              path: "/mnt/user-data/uploads/notes.txt",
            },
          ],
        },
      },
      {
        id: "human-legacy",
        type: "human",
        content:
          "<uploaded_files>\n- archive.pdf (2.0 KB)\n  Path: /mnt/user-data/uploads/archive.pdf\n</uploaded_files>",
      },
      {
        id: "ai-1",
        type: "ai",
        run_id: "run-1",
        content:
          "Answer [citation:Primary paper](https://source.example/paper) and [citation:Primary paper](https://source.example/paper).",
        usage_metadata: {
          input_tokens: 100,
          output_tokens: 25,
          total_tokens: 125,
        },
        additional_kwargs: { turn_duration: 19 },
        feedback: null,
      },
    ] as unknown as Message[];
    const { wrapper } = mountMessages(messages);
    await flushPromises();

    expect(wrapper.findAll("[data-testid='message-attachments']")).toHaveLength(
      2,
    );
    expect(wrapper.get("img[alt='diagram.png']").attributes("src")).toContain(
      "/api/threads/thread-1/artifacts/mnt/user-data/uploads/diagram.png",
    );
    expect(wrapper.get("a[href*='notes.txt']").attributes("rel")).toBe(
      "noopener noreferrer",
    );
    expect(wrapper.text()).not.toContain("<uploaded_files>");
    expect(wrapper.get("[data-testid='citation-sources']").text()).toContain(
      "source.example",
    );
    expect(wrapper.get("[data-testid='citation-sources']").text()).toContain(
      "2 cites",
    );
    expect(wrapper.get("[data-testid='message-token-usage']").text()).toContain(
      "125",
    );
    expect(wrapper.find("button[aria-label='Helpful']").exists()).toBe(false);
    expect(wrapper.find("button[aria-label='Not helpful']").exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-testid='run-duration'] svg").exists()).toBe(
      true,
    );
    const actions = wrapper.get("[data-testid='assistant-turn-actions']");
    expect(actions.classes()).toContain("gap-1");
    expect(actions.findAll("button")).toHaveLength(3);
    for (const button of actions.findAll("button")) {
      expect(button.attributes("data-variant")).toBe("ghost");
      expect(button.attributes("data-size")).toBe("icon-sm");
    }
    expect(
      wrapper.get("[data-testid='message-list-content']").classes(),
    ).toEqual(expect.arrayContaining(["px-4", "pt-8", "pb-[72px]"]));
    expect(wrapper.get("[data-testid='message-list']").classes()).toContain(
      "gap-8",
    );
    expect(
      wrapper.get("[data-testid='message-list']").attributes("style"),
    ).toBe("padding-top: 0px; padding-bottom: 0px;");
    expect(
      wrapper.get("[data-testid='message-list']").element.parentElement
        ?.parentElement?.classList,
    ).toContain("[scrollbar-gutter:stable_both-edges]");
    expect(
      wrapper.find("[data-testid='message-list-bottom-spacer']").exists(),
    ).toBe(false);
    expect(
      wrapper
        .get("[data-testid='message-list']")
        .findAll(":scope > [data-role]")
        .every((item) => item.attributes("data-role")),
    ).toBe(true);

    // 复制按钮没有可访问名（React 的 CopyButton 也没有），所以按位置取：
    // 它是这一排动作里的第一颗。
    await actions.findAll("button")[0]!.trigger("click");
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("Answer"),
    );
  });

  it("keeps virtual offsets on the list owner without adding non-message children", async () => {
    const messages = Array.from({ length: 81 }, (_, index) => ({
      id: `human-${index}`,
      type: "human",
      content: `Message ${index}`,
    })) as Message[];
    const { wrapper } = mountMessages(messages);
    await flushPromises();

    const list = wrapper.get("[data-testid='message-list']");
    expect(list.attributes("style")).toBe(
      "padding-top: 2480px; padding-bottom: 0px;",
    );
    expect(list.element.children).toHaveLength(50);
    expect(
      [...list.element.children].every(
        (item) => item.tagName === "DIV" && item.getAttribute("data-role"),
      ),
    ).toBe(true);
  });

  it("keeps active run status outside the semantic message list", async () => {
    const { wrapper } = mountMessages([], true);
    await flushPromises();

    expect(
      wrapper.get("[data-testid='message-list']").element.children,
    ).toHaveLength(0);
    expect(
      wrapper.find("[role='status'] [data-testid='run-activity']").exists(),
    ).toBe(true);
  });

  it("renders pending, in-progress, and completed todos from authoritative state", async () => {
    const empty = mount(TodoList, { props: { todos: [] } });
    expect(empty.find("[data-testid='thread-todos']").exists()).toBe(false);

    const wrapper = mount(TodoList, {
      props: {
        todos: [
          { content: "Queued", status: "pending" },
          { content: "Working", status: "in_progress" },
          { content: "Done", status: "completed" },
        ],
      },
    });
    await wrapper.get("button").trigger("click");
    expect(
      wrapper.findAll("li").map((item) => item.attributes("data-status")),
    ).toEqual(["pending", "in_progress", "completed"]);
    expect(wrapper.get("li[data-status='completed'] span").classes()).toContain(
      "line-through",
    );
  });
});
