import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const wrappers: ReturnType<typeof mount>[] = [];

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
        MessageMarkdown: { template: "<div data-testid='markdown' />" },
        NuxtLink: {
          props: ["to"],
          template: "<a :href='to'><slot /></a>",
        },
        WorkspaceChangesBadge: true,
        SubtaskCard: true,
      },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, invalidate };
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

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

  it("renders display-only conversation metadata as named source links for both agent owners", async () => {
    const { wrapper } = mountMessages([
      {
        id: "referencing-human",
        type: "human",
        content: "Compare these conversations",
        additional_kwargs: {
          conversation_references: [
            { thread_id: "source-default", title: "Source conversation" },
            { thread_id: "source-agent", title: "", agent_name: "researcher" },
            { thread_id: "source-default", title: "Duplicate" },
          ],
        },
      },
    ] as Message[]);
    await flushPromises();
    const group = wrapper.get(
      "[data-testid='message-conversation-references']",
    );
    expect(group.attributes("role")).toBe("group");
    expect(group.attributes("aria-label")).toBe(
      enUS.inputBox.referencedConversations,
    );
    expect(
      group.findAll("a").map((link) => [link.attributes("href"), link.text()]),
    ).toEqual([
      ["/workspace/chats/source-default", "Source conversation"],
      ["/workspace/agents/researcher/chats/source-agent", enUS.pages.untitled],
    ]);
    for (const chip of group.findAll("a")) {
      expect(chip.classes()).toEqual(
        expect.arrayContaining(["h-6", "max-w-60", "shadow-xs"]),
      );
      expect(chip.find("button").exists()).toBe(false);
    }
  });

  it("orders quote, conversation, file, plain text, and knowledge scope inside the same human content stack", async () => {
    const { wrapper } = mountMessages([
      {
        id: "fully-referenced-human",
        type: "human",
        content: "Compare the evidence",
        additional_kwargs: {
          referenced_message_contexts: [
            {
              label: "Previous answer",
              role: "assistant",
              content: "Quoted evidence",
            },
          ],
          conversation_references: [{ thread_id: "source", title: "Source" }],
          files: [{ filename: "pending.md", size: 0, status: "uploading" }],
          knowledge_scope: { version: 1, mode: "all" },
        },
      },
    ] as Message[]);
    await flushPromises();
    const human = wrapper.get("[data-role='human']");
    expect(human.classes()).not.toContain("bg-secondary");
    const quote = human.get("[data-testid='message-reference-attachment']");
    expect(quote.classes()).toEqual(
      expect.arrayContaining(["self-end", "shadow-none"]),
    );
    expect(quote.classes()).not.toContain("shadow-sm");
    expect(quote.classes()).not.toContain("mt-2");
    const conversation = human.get(
      "[data-testid='message-conversation-references']",
    );
    const files = human.get("[data-testid='message-attachments']");
    const text = human.get(".wrap-break-word.whitespace-pre-wrap");
    const knowledge = human.get("[data-testid='message-knowledge-scope']");
    const content = quote.element.parentElement!;
    expect(content.classList).toContain("flex-col");
    expect(content.classList).toContain("gap-2");
    expect(conversation.element.parentElement).toBe(content);
    expect(files.element.parentElement).toBe(content);
    expect(text.element.parentElement?.classList).toContain(
      "group-[.is-user]:bg-secondary",
    );
    expect(knowledge.element.parentElement).toBe(content);
    for (const [before, after] of [
      [quote, conversation],
      [conversation, files],
      [files, text],
      [text, knowledge],
    ]) {
      expect(
        before!.element.compareDocumentPosition(after!.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    const uploading = files.get("[title='pending.md']").element.parentElement!
      .parentElement!;
    expect(uploading.classList).toContain("opacity-60");
    expect(uploading.querySelector("[data-slot='badge']")?.textContent).toBe(
      "Markdown",
    );
    expect(uploading.textContent).toContain(enUS.uploads.uploading);
  });

  it("renders the upload task through the collapsed primitive rather than parsing its status as Markdown", async () => {
    const { wrapper } = mountMessages([
      {
        id: "upload-status",
        type: "ai",
        content: enUS.uploads.uploadingFiles,
        additional_kwargs: { element: "task" },
      },
    ] as Message[]);
    await flushPromises();
    const status = wrapper.get("[data-slot='collapsible-trigger']");
    expect(status.text()).toBe(enUS.uploads.uploadingFiles);
    expect(status.attributes("aria-expanded")).toBe("false");
    expect(status.classes()).toContain("cursor-default");
    expect(status.get("svg").classes()).toContain("size-4");
    expect(wrapper.find("[data-testid='markdown']").exists()).toBe(false);
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
    expect(wrapper.get("a:has(img[alt='diagram.png'])").attributes("rel")).toBe(
      "noopener noreferrer",
    );
    const fileCard = wrapper.get("[title='notes.txt']").element.parentElement!
      .parentElement!;
    expect(fileCard.tagName).toBe("DIV");
    expect(fileCard.classList).toContain("min-w-30");
    expect(fileCard.classList).toContain("max-w-50");
    expect(fileCard.querySelector("[data-slot='badge']")?.textContent).toBe(
      "TXT",
    );
    expect(fileCard.textContent).toContain("0.0 KB");
    expect(wrapper.find("a[href*='notes.txt']").exists()).toBe(false);
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
    const duration = wrapper.get("[data-testid='run-duration']");
    expect(duration.text()).toBe("Took 19s");
    expect(duration.find("svg").exists()).toBe(false);
    expect(
      duration.element.compareDocumentPosition(
        wrapper.get("[data-role='ai']").element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const actions = wrapper.get("[data-testid='assistant-turn-actions']");
    expect(actions.classes()).toContain("gap-1");
    expect(actions.findAll("button")).toHaveLength(3);
    for (const button of actions.findAll("button")) {
      expect(button.attributes("data-variant")).toBe("ghost");
      expect(button.attributes("data-size")).toBe("icon-sm");
    }
    expect(
      wrapper.get("[data-testid='message-list-content']").classes(),
    ).toEqual(expect.arrayContaining(["px-4", "pt-8"]));
    expect(wrapper.get("[data-testid='message-list']").classes()).toContain(
      "gap-8",
    );
    expect(
      wrapper.get("[data-testid='message-list']").attributes("style"),
    ).toBeUndefined();
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
        .findAll(":scope > [data-message-group-index]")
        .every((item) => item.find("[data-role]").exists()),
    ).toBe(true);

    // 同时固定当前动作顺序：复制是第一颗，复制内容必须来自当前回答。
    await actions.findAll("button")[0]!.trigger("click");
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("Answer"),
    );
  });

  it("uses measured group rows once history reaches the upstream threshold", async () => {
    const messages = Array.from({ length: 81 }, (_, index) => ({
      id: `human-${index}`,
      type: "human",
      content: `Message ${index}`,
    })) as Message[];
    const { wrapper } = mountMessages(messages);
    await flushPromises();
    const list = wrapper.get("[data-testid='message-list']");
    expect(list.classes()).toContain("relative");
    expect((list.element as HTMLElement).style.height).not.toBe("");
    expect((list.element as HTMLElement).style.paddingTop).toBe("");
    expect(list.element.children.length).toBeLessThan(81);
    // Full viewport measurement and pinned streaming rows are covered in
    // virtual-message-list.dom.test.ts with a nonzero browser-sized viewport.
    for (const row of list.element.children) {
      expect(row.hasAttribute("data-message-group-index")).toBe(true);
      expect(row.querySelector("[data-role='human']")).not.toBeNull();
    }
    wrapper.unmount();
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

    /*
      三态各钉一次，**指示器与文字分开取**（`li … span` 会先命中指示器）。
      类串照抄上游 `ai-elements/queue.tsx` 的 QueueItemIndicator / QueueItemContent
      加 `todo-list.tsx:88/95` 那两句调用点补色——本仓这一屏**至今没有对照锚点**，
      所以判据只能落在这里。
      原来这一条取的是第一个 span、只查一个 `line-through`：第十三轮把完成态那颗
      lucide `Check`（写死 `text-emerald-600`，上游全仓没用过这个色）换成上游的
      CSS 圆点之后，那把尺子当场指到了圆点身上。
    */
    const dotOf = (status: string) =>
      wrapper.get(`li[data-status='${status}'] span:first-child`).classes();
    const textOf = (status: string) =>
      wrapper.get(`li[data-status='${status}'] span:last-child`).classes();

    for (const status of ["pending", "in_progress", "completed"]) {
      expect(dotOf(status), `${status} 的指示器不是那颗圆点`).toEqual(
        expect.arrayContaining(["size-2.5", "rounded-full", "border"]),
      );
      expect(
        textOf(status),
        `${status} 的文字少了 QueueItemContent 的基类`,
      ).toEqual(
        expect.arrayContaining(["line-clamp-1", "grow", "break-words"]),
      );
    }
    expect(dotOf("completed")).toEqual(
      expect.arrayContaining([
        "border-muted-foreground/20",
        "bg-muted-foreground/10",
      ]),
    );
    expect(textOf("completed")).toEqual(
      expect.arrayContaining(["text-muted-foreground/50", "line-through"]),
    );
    expect(dotOf("in_progress")).toContain("bg-primary/70");
    expect(textOf("in_progress")).toContain("text-primary/70");
    expect(dotOf("pending")).toContain("border-muted-foreground/50");
    expect(textOf("pending")).toContain("text-muted-foreground");
    // 上游那颗完成指示器不是图标——本仓这一屏也不该再有 svg。
    expect(wrapper.findAll("li svg")).toHaveLength(0);
  });
});
