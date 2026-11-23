import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Detail from "@/components/workspace/scheduled-tasks/ScheduledTaskDetail.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import { task } from "./fixtures";

// Mount the actual detail, query observers and toast store. Only the remote
// models/history and browser clipboard boundaries are controlled here.
vi.mock("@/core/scheduled-tasks/api", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/api")>()),
  fetchScheduledTaskRuns: vi.fn(async () => []),
}));
vi.mock("@/core/models/api", () => ({
  loadModels: vi.fn(async () => ({
    models: [],
    token_usage: { enabled: false },
  })),
}));

const clipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
const toast = createWorkspaceToastStore();

beforeEach(() => {
  vi.clearAllMocks();
  toast.clear();
});
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
  toast.clear();
  if (clipboardDescriptor)
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  await flushPromises();
  document.body.innerHTML = "";
});

async function mountDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(queryClient);
  const wrapper = mount(Detail, {
    attachTo: document.body,
    props: { task: task(), toolEnabled: true, createBlocked: false },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      components: {
        // Nuxt supplies this boundary in the app; retain real link semantics.
        NuxtLink: defineComponent({
          props: { to: { type: String, required: true } },
          setup:
            (props, { slots }) =>
            () =>
              h("a", { href: props.to }, slots.default?.()),
        }),
      },
      provide: { [workspaceToastKey as symbol]: toast },
    },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

function clipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });
}

describe("scheduled task detail copy feedback", () => {
  it("reports success only after writing the actual task ID", async () => {
    let finish!: () => void;
    const writeText = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    clipboard({ writeText });
    const wrapper = await mountDetail();
    await wrapper.get("footer button").trigger("click");
    expect(writeText).toHaveBeenCalledExactlyOnceWith("task-1");
    expect(toast.toasts.value).toEqual([]);
    finish();
    await flushPromises();
    expect(toast.toasts.value).toMatchObject([
      { kind: "success", message: enUS.scheduledTasks.detail.copied },
    ]);
  });

  it("does not report a copy when the Clipboard API is unavailable", async () => {
    clipboard(undefined);
    const wrapper = await mountDetail();
    await wrapper.get("footer button").trigger("click");
    await flushPromises();
    expect(toast.toasts.value).toEqual([]);
  });

  it("does not report success when clipboard permission is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    clipboard({ writeText });
    const wrapper = await mountDetail();
    await wrapper.get("footer button").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledExactlyOnceWith("task-1");
    expect(toast.toasts.value).toEqual([]);
  });
});
