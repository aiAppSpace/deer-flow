import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

vi.mock("@/components/chat/MessageMarkdown.vue", () => ({
  default: { props: ["content"], template: "<div>{{ content }}</div>" },
}));

const clipboard = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/core/clipboard", () => ({
  writeTextToClipboard: clipboard.write,
}));

const toast = createWorkspaceToastStore();
const wrappers: ReturnType<typeof mount>[] = [];
const messages = [
  {
    id: "human-1",
    type: "human",
    content: "Original question",
    additional_kwargs: {
      files: [
        { filename: "notes.md", size: 42, path: "/mnt/user-data/notes.md" },
      ],
      knowledge_scope: { version: 1, mode: "all" },
    },
  },
  { id: "ai-1", type: "ai", content: "Original answer", run_id: "run-1" },
] as Message[];

function mountList(submit = vi.fn(async () => true)) {
  const wrapper = mount(MessageList, {
    attachTo: document.body,
    props: {
      messages,
      rawMessages: messages,
      streaming: false,
      loading: false,
      interactive: true,
      threadId: "thread-1",
      editOwnerKey: "user-1/default-agent",
      editAndRegenerateMessage: submit,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
      provide: { [workspaceToastKey as symbol]: toast },
      stubs: { WorkspaceChangesBadge: true, SubtaskCard: true },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

function button(wrapper: ReturnType<typeof mountList>, label: string) {
  const found = wrapper.findAll("button").find((item) => item.text() === label);
  expect(found, `button ${label}`).toBeDefined();
  return found!;
}

async function edit(wrapper: ReturnType<typeof mountList>) {
  await wrapper
    .get(`button[aria-label="${enUS.messages.actions.editAndRerun}"]`)
    .trigger("click");
  await flushPromises();
  return wrapper.get("[data-role='human'] textarea");
}

beforeEach(() => {
  clipboard.write.mockReset().mockResolvedValue(true);
  toast.clear();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("message copy owner lifecycle", () => {
  const copyButton = (wrapper: ReturnType<typeof mountList>) =>
    wrapper.get("[data-testid='human-turn-actions'] button");

  it.each(["threadId", "editOwnerKey"] as const)(
    "ignores success and failure from the retired %s owner",
    async (ownerProp) => {
      const wrapper = mountList();
      for (const result of [true, false]) {
        let resolve!: (copied: boolean) => void;
        clipboard.write.mockImplementationOnce(
          () => new Promise<boolean>((done) => (resolve = done)),
        );
        await copyButton(wrapper).trigger("click");
        expect(clipboard.write).toHaveBeenLastCalledWith("Original question");
        await wrapper.setProps({ [ownerProp]: `new-owner-${result}` });
        resolve(result);
        await flushPromises();
        expect(copyButton(wrapper).attributes("aria-label")).toBe(
          enUS.clipboard.copyToClipboard,
        );
        expect(wrapper.find("[role='alert']").exists()).toBe(false);
      }
      await copyButton(wrapper).trigger("click");
      await flushPromises();
      expect(copyButton(wrapper).attributes("aria-label")).toBe(
        enUS.clipboard.copiedToClipboard,
      );
      clipboard.write.mockResolvedValueOnce(false);
      await copyButton(wrapper).trigger("click");
      await flushPromises();
      expect(wrapper.get("[role='alert']").text()).toBe(
        enUS.messages.copyFailed,
      );
    },
  );

  it("retires the feedback timer on owner change and unmount", async () => {
    const wrapper = mountList();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await copyButton(wrapper).trigger("click");
    await flushPromises();
    expect(copyButton(wrapper).attributes("aria-label")).toBe(
      enUS.clipboard.copiedToClipboard,
    );
    await wrapper.setProps({ threadId: "thread-2" });
    expect(copyButton(wrapper).attributes("aria-label")).toBe(
      enUS.clipboard.copyToClipboard,
    );
    await copyButton(wrapper).trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(copyButton(wrapper).attributes("aria-label")).toBe(
      enUS.clipboard.copiedToClipboard,
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(copyButton(wrapper).attributes("aria-label")).toBe(
      enUS.clipboard.copyToClipboard,
    );
    await copyButton(wrapper).trigger("click");
    await flushPromises();
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("human message inline edit and regenerate", () => {
  it("replaces only the message body inline, retaining files, knowledge and the warning order", async () => {
    const wrapper = mountList();
    const input = await edit(wrapper);
    const row = wrapper.get("[data-role='human']");
    const editor = input.element.parentElement!;
    expect(document.activeElement).toBe(input.element);
    expect(editor.classList).toContain("rounded-lg");
    expect(editor.classList).toContain("shadow-sm");
    expect(editor.classList).not.toContain("absolute");
    expect(row.find(".whitespace-pre-wrap").exists()).toBe(false);
    expect(row.find("[title='notes.md']").exists()).toBe(true);
    const knowledge = row.get("[data-testid='message-knowledge-scope']");
    expect(knowledge.element.parentElement).toBe(editor.parentElement);
    expect(
      editor.compareDocumentPosition(knowledge.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      editor.textContent!.indexOf(enUS.common.editRerunWarning),
    ).toBeLessThan(editor.textContent!.indexOf(enUS.common.cancel));
    expect(
      row
        .find(`button[aria-label="${enUS.messages.actions.editAndRerun}"]`)
        .exists(),
    ).toBe(false);
    expect((input.element as HTMLTextAreaElement).value).toBe(
      "Original question",
    );
    expect(wrapper.emitted("edit")?.[0]).toEqual([
      "human-1",
      "Original question",
      ["human-1"],
    ]);
  });

  it("blocks empty and unchanged drafts and submits trimmed text with the original turn ids", async () => {
    const submit = vi.fn(async () => true);
    const wrapper = mountList(submit);
    const input = await edit(wrapper);
    const update = button(wrapper, enUS.common.updateAndRerun);
    expect(update.attributes("disabled")).toBeDefined();
    await input.setValue("   ");
    expect(update.attributes("disabled")).toBeDefined();
    await input.setValue("  Original question  ");
    expect(update.attributes("disabled")).toBeDefined();
    await input.setValue("  Revised question  ");
    expect(update.attributes("disabled")).toBeUndefined();
    await update.trigger("click");
    await flushPromises();
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      "human-1",
      "Revised question",
      ["human-1"],
    );
    expect(wrapper.find("textarea").exists()).toBe(false);
  });

  it("keeps a failed draft editable for retry and accepts Ctrl/Meta Enter", async () => {
    const submit = vi.fn(async () => true).mockResolvedValueOnce(false);
    const wrapper = mountList(submit);
    const input = await edit(wrapper);
    await input.setValue("Keep my revised question");
    await input.trigger("keydown", { key: "Enter", ctrlKey: true });
    await flushPromises();
    expect(submit).toHaveBeenCalledTimes(1);
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Keep my revised question",
    );
    expect(
      button(wrapper, enUS.common.updateAndRerun).attributes("disabled"),
    ).toBeUndefined();
    await wrapper
      .get("textarea")
      .trigger("keydown", { key: "Enter", metaKey: true });
    await flushPromises();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(wrapper.find("textarea").exists()).toBe(false);
  });

  it("locks the pending editor without removing its textarea or allowing duplicate submit or cancel", async () => {
    let resolve!: (accepted: boolean) => void;
    const submit = vi.fn(
      () => new Promise<boolean>((done) => (resolve = done)),
    );
    const wrapper = mountList(submit);
    const input = await edit(wrapper);
    await input.setValue("Pending revision");
    await button(wrapper, enUS.common.updateAndRerun).trigger("click");
    expect(input.attributes("readonly")).toBeDefined();
    expect(input.attributes("aria-disabled")).toBe("true");
    expect(input.attributes("disabled")).toBeUndefined();
    expect(
      button(wrapper, enUS.common.cancel).attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper
        .get(`button[aria-label="${enUS.messages.actions.regenerate}"]`)
        .attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper
        .get(`button[aria-label="${enUS.messages.actions.branch}"]`)
        .attributes("disabled"),
    ).toBeDefined();
    await input.trigger("keydown", { key: "Escape" });
    await input.trigger("keydown", { key: "Enter", ctrlKey: true });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(wrapper.find("textarea").exists()).toBe(true);
    resolve(false);
    await flushPromises();
    expect(input.attributes("readonly")).toBeUndefined();
    await input.trigger("keydown", { key: "Escape" });
    expect(wrapper.find("textarea").exists()).toBe(false);
  });

  it("retains a thrown submission and reports its failure through the workspace toast", async () => {
    const wrapper = mountList(
      vi.fn(async () => {
        throw new Error("Gateway unavailable");
      }),
    );
    const input = await edit(wrapper);
    await input.setValue("Retain after exception");
    await button(wrapper, enUS.common.updateAndRerun).trigger("click");
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Retain after exception",
    );
    expect(toast.toasts.value.at(-1)?.message).toBe("Gateway unavailable");
  });

  it.each(["threadId", "editOwnerKey"] as const)(
    "retires an old %s owner and fences its late completion from a new draft",
    async (ownerProp) => {
      let resolve!: (accepted: boolean) => void;
      const submit = vi.fn(
        () => new Promise<boolean>((done) => (resolve = done)),
      );
      const wrapper = mountList(submit);
      await (await edit(wrapper)).setValue("Old owner's revision");
      await button(wrapper, enUS.common.updateAndRerun).trigger("click");
      await wrapper.setProps({ [ownerProp]: "new-owner" });
      expect(wrapper.find("textarea").exists()).toBe(false);
      await (await edit(wrapper)).setValue("New owner's revision");
      resolve(true);
      await flushPromises();
      expect(
        (wrapper.get("textarea").element as HTMLTextAreaElement).value,
      ).toBe("New owner's revision");
      expect(
        button(wrapper, enUS.common.updateAndRerun).attributes("disabled"),
      ).toBeUndefined();
    },
  );
});
