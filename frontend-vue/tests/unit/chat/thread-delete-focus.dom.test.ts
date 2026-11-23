import {
  agentChatAccount,
  agentChatStream,
  agentChatThreads,
  deferredChatResponse,
  mountAgentChatHarness,
} from "./helpers/agent-chat-harness";
import { flushPromises, type mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import ChatComposer from "@/components/chat/ChatComposer.vue";
import ThreadDeleteDialog from "@/components/workspace/ThreadDeleteDialog.vue";
import type { AgentThread } from "@/core/threads/types";
import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import type { NewChatFocusHandoff } from "@/core/threads/new-chat";
import { referenceToken } from "@/core/mentions/inline-references";
import {
  createMemoryHistory,
  createRouter,
  isNavigationFailure,
  NavigationFailureType,
  type Router,
} from "vue-router";

vi.mock("@/core/skills/api", () => ({ loadSkills: async () => [] }));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: async () => ({
    max_files: 10,
    max_file_size: 1000000,
    max_total_size: 1000000,
  }),
}));

const dialogs: ReturnType<typeof mount>[] = [];
const chats: ReturnType<typeof mount>[] = [];
afterEach(() => {
  dialogs.splice(0).forEach((wrapper) => wrapper.unmount());
  chats.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});
function button(name: string) {
  return [...document.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === name,
  )!;
}
async function setup(
  agentName: string | null = null,
  threadId = "thread-a",
  deletedId = threadId,
  router?: Router,
) {
  const target = ref<{ thread: AgentThread; recentThreadId: string } | null>(
    null,
  );
  const sibling = defineComponent({
    setup: () => () =>
      h(ThreadDeleteDialog, {
        target: target.value,
        onClose: () => {
          target.value = null;
        },
      }),
  });
  const subject = mountAgentChatHarness(
    { agentName },
    { threadId, realComposer: true, sibling, router },
  );
  chats.push(subject.root);
  agentChatStream.resetView.mockImplementation(() => {
    agentChatStream.messages.value = [];
  });
  await flushPromises();
  const composer = subject.wrapper.getComponent(ChatComposer);
  await composer.get("textarea").setValue("old draft");
  target.value = {
    thread: {
      thread_id: deletedId,
      metadata: {},
      values: { title: "Delete me", messages: [] },
    } as unknown as AgentThread,
    recentThreadId: deletedId,
  };
  await flushPromises();
  return {
    ...subject,
    target,
    chat: subject.wrapper,
    replace: subject.router.replace,
    composer,
  };
}
it.each([null, "writer"])(
  "hands successful current deletion to the actual new composer for %s",
  async (agentName) => {
    const subject = await setup(agentName);
    expect(document.activeElement).toBe(button("Cancel"));
    const closingCancelFocus = vi.fn();
    button("Cancel").addEventListener("focus", closingCancelFocus);
    button("Delete").click();
    await flushPromises();
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(
        document.activeElement === subject.composer.get("textarea").element,
        `active=${document.activeElement?.tagName}`,
      ).toBe(true);
    });
    expect(closingCancelFocus).not.toHaveBeenCalled();
    expect(subject.composer.get("textarea").element.value).toBe("");
    expect(subject.composer.get("textarea").element.readOnly).toBe(false);
    expect(
      subject.composer.element ===
        subject.chat.getComponent(ChatComposer).element,
    ).toBe(true);
    await subject.composer.get("textarea").setValue("new draft");
    expect(subject.composer.get("textarea").element.value).toBe("new draft");
  },
);

it("background deletion leaves the current draft, route and focus ownership alone", async () => {
  const subject = await setup(null, "thread-a", "thread-background");
  button("Delete").click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="dialog"]')).toBeNull(),
  );
  expect(subject.replace).not.toHaveBeenCalled();
  expect(agentChatStream.resetView).not.toHaveBeenCalled();
  expect(subject.composer.get("textarea").element.value).toBe("old draft");
  expect(
    document.activeElement === subject.composer.get("textarea").element,
  ).toBe(false);
});

it("cancellation preserves the conversation and draft", async () => {
  const subject = await setup();
  button("Cancel").click();
  await flushPromises();
  expect(agentChatThreads.remove).not.toHaveBeenCalled();
  expect(subject.replace).not.toHaveBeenCalled();
  expect(subject.composer.get("textarea").element.value).toBe("old draft");
});

it("failure restores Cancel; successful retry focuses the actual composer", async () => {
  const subject = await setup();
  agentChatThreads.remove.mockRejectedValueOnce(new Error("Retry me"));
  button("Delete").click();
  await flushPromises();
  expect(document.activeElement).toBe(button("Cancel"));
  expect(subject.composer.get("textarea").element.value).toBe("old draft");
  button("Delete").click();
  await vi.waitFor(() =>
    expect(
      document.activeElement === subject.composer.get("textarea").element,
    ).toBe(true),
  );
  expect(agentChatThreads.remove).toHaveBeenCalledTimes(2);
});

it.each(["navigation", "account", "navigation-return"])(
  "retires a pending deletion after %s",
  async (change) => {
    const subject = await setup();
    const pending = deferredChatResponse<undefined>();
    agentChatThreads.remove.mockReturnValueOnce(pending.promise);
    button("Delete").click();
    await flushPromises();
    if (change === "account") {
      invalidateWorkspaceQueryOwner(subject.queryClient);
      agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
    } else {
      subject.route.path = "/workspace/chats/newer";
      subject.route.params.thread_id = "newer";
      if (change === "navigation-return") {
        subject.route.path = "/workspace/chats/thread-a";
        subject.route.params.thread_id = "thread-a";
      }
    }
    pending.resolve(undefined);
    await flushPromises();
    expect(subject.replace).not.toHaveBeenCalled();
    expect(agentChatStream.resetView).not.toHaveBeenCalled();
    expect(
      document.activeElement === subject.composer.get("textarea").element,
    ).toBe(false);
  },
);

it("deletion on the same /new route mints a fresh draft owner and focuses its real composer", async () => {
  const subject = await setup(null, "new", "created-on-new");
  const oldId = subject.composer.props("targetThreadId");
  await subject.composer
    .get("textarea")
    .setValue(`old draft ${referenceToken("skill", "review", "review")}`);
  const file = new File(["draft"], "old-attachment.txt", {
    type: "text/plain",
  });
  Object.defineProperty(
    subject.composer.get('input[type="file"]').element,
    "files",
    { value: [file], configurable: true },
  );
  await subject.composer.get('input[type="file"]').trigger("change");
  expect(subject.composer.text()).toContain("old-attachment.txt");
  button("Delete").click();
  await vi.waitFor(() =>
    expect(
      document.activeElement === subject.composer.get("textarea").element,
    ).toBe(true),
  );
  expect(subject.composer.props("targetThreadId")).not.toBe(oldId);
  expect(subject.route.path).toBe("/workspace/chats/new");
  expect(subject.composer.get("textarea").element.value).toBe("");
  expect(subject.composer.text()).not.toContain("old-attachment.txt");
  expect(subject.composer.find('[contenteditable="true"]').exists()).toBe(
    false,
  );
  expect(
    subject.composer.element ===
      subject.chat.getComponent(ChatComposer).element,
  ).toBe(true);
});

it("does not steal a newer control's focus at the real dialog close boundary", async () => {
  const subject = await setup();
  const outside = document.createElement("button");
  document.body.append(outside);
  document.querySelector('[role="dialog"]')!.addEventListener(
    "focusScope.autoFocusOnUnmount",
    () => {
      const editor = subject.composer.get("textarea").element;
      editor.value = "A newer user's draft";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      const picker = subject.composer.get('input[type="file"]').element;
      Object.defineProperty(picker, "files", {
        value: [
          new File(["new"], "new-attachment.txt", { type: "text/plain" }),
        ],
        configurable: true,
      });
      picker.dispatchEvent(new Event("change", { bubbles: true }));
      outside.focus();
    },
    {
      capture: true,
      once: true,
    },
  );
  button("Delete").click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="dialog"]')).toBeNull(),
  );
  expect(document.activeElement).toBe(outside);
  expect(subject.composer.get("textarea").element.value).toBe(
    "A newer user's draft",
  );
  expect(subject.composer.text()).toContain("new-attachment.txt");
});

it("retires pending deletion when another new-chat command replaces the same /new owner", async () => {
  const subject = await setup(null, "new", "created-on-new");
  const pending = deferredChatResponse<undefined>();
  agentChatThreads.remove.mockReturnValueOnce(pending.promise);
  button("Delete").click();
  await flushPromises();
  globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
  await flushPromises();
  await subject.composer.get("textarea").setValue("New command's draft");
  pending.resolve(undefined);
  await flushPromises();
  expect(subject.replace).not.toHaveBeenCalled();
  expect(subject.composer.get("textarea").element.value).toBe(
    "New command's draft",
  );
  expect(
    document.activeElement === subject.composer.get("textarea").element,
  ).toBe(false);
});

it.each(["account", "route", "new-command", "unmount"])(
  "retires the completion operation after a newer %s owner",
  async (change) => {
    const subject = mountAgentChatHarness(
      {},
      { threadId: "new", realComposer: true },
    );
    chats.push(subject.wrapper);
    await flushPromises();
    let complete: (() => void) | undefined;
    globalThis.dispatchEvent(
      new CustomEvent<NewChatFocusHandoff>("deerflow:new-chat", {
        detail: {
          agentName: null,
          claim: (focus) => {
            complete = focus;
          },
        },
      }),
    );
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    if (change === "account")
      agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
    if (change === "route") subject.route.params.thread_id = "newer";
    if (change === "new-command")
      globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
    if (change === "unmount") {
      subject.wrapper.unmount();
      chats.pop();
    }
    await flushPromises();
    expect(complete).toBeTypeOf("function");
    complete!();
    expect(document.activeElement).toBe(outside);
  },
);

it("adopts the prepared ID without moving focus or replacing the composer, then deletes that owner", async () => {
  const subject = await setup(null, "new");
  button("Cancel").click();
  await flushPromises();
  const prepared = await subject.composer.props("ensureThread")!();
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  subject.route.params.thread_id = prepared;
  subject.route.path = `/workspace/chats/${prepared}`;
  await flushPromises();
  expect(subject.composer.props("targetThreadId")).toBe(prepared);
  expect(document.activeElement).toBe(outside);
  expect(
    subject.composer.element ===
      subject.chat.getComponent(ChatComposer).element,
  ).toBe(true);
  subject.target.value = {
    thread: {
      thread_id: prepared,
      metadata: {},
      values: { messages: [] },
    } as unknown as AgentThread,
    recentThreadId: prepared,
  };
  await flushPromises();
  button("Delete").click();
  await vi.waitFor(() =>
    expect(
      document.activeElement === subject.composer.get("textarea").element,
    ).toBe(true),
  );
  expect(subject.composer.props("targetThreadId")).not.toBe(prepared);
  expect(subject.composer.get("textarea").element.value).toBe("");
});

it.each([{ demo: true }, { bootstrap: true }, { agentName: "other-agent" }])(
  "does not claim a deletion completion from a different or read-only chat: %j",
  async (props) => {
    const subject = mountAgentChatHarness(props, { threadId: "new" });
    const claim = vi.fn();
    globalThis.dispatchEvent(
      new CustomEvent<NewChatFocusHandoff>("deerflow:new-chat", {
        detail: { agentName: null, claim },
      }),
    );
    await flushPromises();
    expect(claim).not.toHaveBeenCalled();
    expect(agentChatStream.resetView).not.toHaveBeenCalled();
    expect(subject.wrapper.exists()).toBe(true);
  },
);

async function memoryRouter(threadId = "thread-a") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/workspace/chats/:thread_id",
        component: { render: () => null },
      },
    ],
  });
  await router.push(`/workspace/chats/${threadId}`);
  return router;
}

it.each([true, false])(
  "rejects the real cancelled replacement when newer navigation finishes at /new (intermediate=%s)",
  async (intermediate) => {
    const router = await memoryRouter();
    const entered = deferredChatResponse<undefined>();
    const release = deferredChatResponse<undefined>();
    let held = false;
    router.beforeEach(async (to) => {
      if (to.path === "/workspace/chats/new" && !held) {
        held = true;
        entered.resolve(undefined);
        await release.promise;
      }
    });
    const replace = vi.spyOn(router, "replace");
    const subject = await setup(null, "thread-a", "thread-a", router);
    button("Delete").click();
    await entered.promise;
    if (intermediate) await router.push("/workspace/chats/newer");
    await router.push("/workspace/chats/new");
    await flushPromises();
    await subject.composer.get("textarea").setValue("New navigation's draft");
    const picker = subject.composer.get('input[type="file"]');
    Object.defineProperty(picker.element, "files", {
      value: [new File(["new"], "new-navigation.txt", { type: "text/plain" })],
      configurable: true,
    });
    await picker.trigger("change");
    const newerId = subject.composer.props("targetThreadId");
    release.resolve(undefined);
    const result = await replace.mock.results[0]!.value;
    expect(isNavigationFailure(result, NavigationFailureType.cancelled)).toBe(
      true,
    );
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/workspace/chats/new");
    expect(subject.composer.get("textarea").element.value).toBe(
      "New navigation's draft",
    );
    expect(subject.composer.text()).toContain("new-navigation.txt");
    expect(subject.composer.props("targetThreadId")).toBe(newerId);
    expect(agentChatStream.resetView).not.toHaveBeenCalled();
    expect(
      document.activeElement === subject.composer.get("textarea").element,
    ).toBe(false);
  },
);

it.each(["thread-a", "new"])(
  "accepts its real router outcome from %s, including a legitimate duplicate",
  async (threadId) => {
    const router = await memoryRouter(threadId);
    const replace = vi.spyOn(router, "replace");
    const subject = await setup(null, threadId, "thread-a", router);
    button("Delete").click();
    await flushPromises();
    const result = await replace.mock.results[0]!.value;
    expect(isNavigationFailure(result, NavigationFailureType.duplicated)).toBe(
      threadId === "new",
    );
    await vi.waitFor(() =>
      expect(
        document.activeElement === subject.composer.get("textarea").element,
      ).toBe(true),
    );
    expect(subject.composer.get("textarea").element.value).toBe("");
    expect(router.currentRoute.value.path).toBe("/workspace/chats/new");
    expect(agentChatStream.resetView).toHaveBeenCalledTimes(1);
  },
);

it.each(["abort", "redirect", "reject"])(
  "preserves the draft when the real router guard produces %s",
  async (outcome) => {
    const router = await memoryRouter();
    const errors: Error[] = [];
    router.onError((error) => errors.push(error));
    router.beforeEach((to) => {
      if (to.path !== "/workspace/chats/new") return;
      if (outcome === "abort") return false;
      if (outcome === "redirect") return "/workspace/chats/redirected";
      throw new Error("Navigation denied");
    });
    const replace = vi.spyOn(router, "replace");
    const subject = await setup(null, "thread-a", "thread-a", router);
    button("Delete").click();
    await flushPromises();
    if (outcome === "reject") {
      await expect(replace.mock.results[0]!.value).rejects.toThrow(
        "Navigation denied",
      );
      expect(errors.map((error) => error.message)).toEqual([
        "Navigation denied",
      ]);
      expect(document.activeElement).toBe(button("Cancel"));
    } else {
      const result = await replace.mock.results[0]!.value;
      expect(isNavigationFailure(result, NavigationFailureType.aborted)).toBe(
        outcome === "abort",
      );
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(
        document.activeElement === subject.composer.get("textarea").element,
      ).toBe(false);
    }
    expect(agentChatStream.resetView).not.toHaveBeenCalled();
    if (outcome === "redirect") {
      expect(router.currentRoute.value.redirectedFrom?.path).toBe(
        "/workspace/chats/new",
      );
      expect(router.currentRoute.value.path).toBe(
        "/workspace/chats/redirected",
      );
      await router.push("/workspace/chats/thread-a");
      await flushPromises();
      expect(subject.composer.get("textarea").element.value).toBe("old draft");
    } else {
      expect(router.currentRoute.value.path).toBe("/workspace/chats/thread-a");
      expect(subject.composer.get("textarea").element.value).toBe("old draft");
    }
  },
);

it.each(["account", "new-command"])(
  "preserves a newer %s owner while the real deletion replacement is pending",
  async (change) => {
    const router = await memoryRouter();
    const entered = deferredChatResponse<undefined>();
    const release = deferredChatResponse<undefined>();
    let held = false;
    router.beforeEach(async (to) => {
      if (to.path === "/workspace/chats/new" && !held) {
        held = true;
        entered.resolve(undefined);
        await release.promise;
      }
    });
    const replace = vi.spyOn(router, "replace");
    const subject = await setup(null, "thread-a", "thread-a", router);
    button("Delete").click();
    await entered.promise;
    await router.push("/workspace/chats/new");
    if (change === "account") {
      invalidateWorkspaceQueryOwner(subject.queryClient);
      agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
    } else {
      globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
    }
    await flushPromises();
    await subject.composer.get("textarea").setValue("New owner's draft");
    const newId = subject.composer.props("targetThreadId");
    release.resolve(undefined);
    expect(
      isNavigationFailure(
        await replace.mock.results[0]!.value,
        NavigationFailureType.cancelled,
      ),
    ).toBe(true);
    await flushPromises();
    expect(subject.composer.get("textarea").element.value).toBe(
      "New owner's draft",
    );
    expect(subject.composer.props("targetThreadId")).toBe(newId);
    expect(agentChatStream.resetView).toHaveBeenCalledTimes(
      change === "account" ? 0 : 1,
    );
    expect(
      document.activeElement === subject.composer.get("textarea").element,
    ).toBe(false);
  },
);
