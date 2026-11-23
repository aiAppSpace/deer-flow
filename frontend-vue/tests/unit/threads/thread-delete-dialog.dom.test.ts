import { reactive } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ThreadDeleteDialog from "@/components/workspace/ThreadDeleteDialog.vue";
import type { AgentThread } from "@/core/threads/types";
import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const api = vi.hoisted(() => ({ remove: vi.fn(), replace: vi.fn() }));
vi.mock("@/composables/useThreads", () => ({
  useThreads: () => ({ remove: api.remove }),
}));
const thread = {
  thread_id: "chat-delete",
  metadata: { title: "Report to keep" },
  values: { title: "Report to keep", messages: [] },
} as unknown as AgentThread;
let route: { path: string; params: { thread_id: string } };
const wrappers: ReturnType<typeof mount>[] = [];
beforeEach(() => {
  api.remove.mockReset();
  api.replace.mockReset().mockResolvedValue(undefined);
  route = reactive({
    params: { thread_id: thread.thread_id },
    path: `/workspace/chats/${thread.thread_id}`,
  });
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => ({ replace: api.replace }));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});
function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const toast = createWorkspaceToastStore();
  const wrapper = mount(ThreadDeleteDialog, {
    attachTo: document.body,
    props: { target: { thread } },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      provide: { [workspaceToastKey as symbol]: toast },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, client, toast };
}
function button(name: string) {
  return [...document.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === name,
  )!;
}
it("focuses cancel and dismisses without deleting", async () => {
  const { wrapper } = render();
  await flushPromises();
  expect(document.activeElement).toBe(button("Cancel"));
  button("Cancel").click();
  await flushPromises();
  expect(wrapper.emitted("close")).toHaveLength(1);
  expect(api.remove).not.toHaveBeenCalled();
});
it("retains the target through pending and failure, blocks duplicate confirmation, and retries before navigating", async () => {
  let reject!: (error: Error) => void;
  api.remove
    .mockImplementationOnce(
      () =>
        new Promise((_, no) => {
          reject = no;
        }),
    )
    .mockResolvedValueOnce(undefined);
  const { wrapper, toast } = render();
  await flushPromises();
  button("Delete").click();
  await flushPromises();
  expect(button("Cancel").disabled).toBe(true);
  expect(document.querySelector('[aria-label="Close"]')).toBeNull();
  button("Loading...")?.click();
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await flushPromises();
  expect(wrapper.emitted("close")).toBeUndefined();
  expect(api.remove).toHaveBeenCalledExactlyOnceWith(thread.thread_id);
  expect(api.replace).not.toHaveBeenCalled();
  reject(new Error("Cleanup failed"));
  await flushPromises();
  expect(document.body.textContent).toContain("Report to keep");
  expect(document.activeElement).toBe(button("Cancel"));
  expect(
    toast.toasts.value.some((item) => item.message === "Cleanup failed"),
  ).toBe(true);
  button("Delete").click();
  await flushPromises();
  expect(api.remove).toHaveBeenCalledTimes(2);
  expect(api.replace).toHaveBeenCalledExactlyOnceWith("/workspace/chats/new");
  expect(wrapper.emitted("close")).toHaveLength(1);
});
it("does not navigate, dismiss, or publish errors after its account owner retires", async () => {
  let resolve!: () => void;
  api.remove.mockImplementationOnce(
    () =>
      new Promise<void>((yes) => {
        resolve = yes;
      }),
  );
  const { wrapper, client, toast } = render();
  await flushPromises();
  button("Delete").click();
  await flushPromises();
  invalidateWorkspaceQueryOwner(client);
  resolve();
  await flushPromises();
  expect(api.replace).not.toHaveBeenCalled();
  expect(wrapper.emitted("close")).toBeUndefined();
  expect(toast.toasts.value).toEqual([]);
});

it("does not reset or navigate a different conversation entered during deletion", async () => {
  let resolve!: () => void;
  api.remove.mockImplementationOnce(
    () =>
      new Promise<void>((yes) => {
        resolve = yes;
      }),
  );
  const reset = vi.fn();
  globalThis.addEventListener("deerflow:new-chat", reset);
  try {
    const { wrapper } = render();
    await flushPromises();
    button("Delete").click();
    await flushPromises();
    route.path = "/workspace/chats/newer-thread";
    route.params.thread_id = "newer-thread";
    await flushPromises();
    resolve();
    await flushPromises();
    expect(reset).not.toHaveBeenCalled();
    expect(api.replace).not.toHaveBeenCalled();
    expect(wrapper.emitted("close")).toHaveLength(1);
  } finally {
    globalThis.removeEventListener("deerflow:new-chat", reset);
  }
});
