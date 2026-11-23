import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MemorySettings from "@/components/workspace/settings/MemorySettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { UserMemory } from "@/core/memory/types";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const memoryFactory = vi.hoisted(() => vi.fn());
vi.mock("@/composables/useMemory", () => ({ useMemory: memoryFactory }));

// This suite owns memory transactions and dialogs. The document-rendering
// contract remains real in memory-document.dom.test.ts.
vi.mock("@/components/chat/MessageMarkdown.vue", () => ({
  default: {
    name: "MessageMarkdown",
    props: ["content"],
    template: "<div>{{ content }}</div>",
  },
}));

const memory: UserMemory = {
  version: "2.0",
  revision: 4,
  lastUpdated: "2026-08-22T00:00:00Z",
  user: {
    workContext: { summary: "Vue parity", updatedAt: "2026-08-22" },
    personalContext: { summary: "", updatedAt: "" },
    topOfMind: { summary: "Recent work", updatedAt: "2026-08-22" },
    cognitiveStyle: { summary: "", updatedAt: "" },
  },
  history: {
    recentMonths: { summary: "Settings", updatedAt: "2026-08-22" },
    earlierContext: { summary: "", updatedAt: "" },
    longTermBackground: { summary: "", updatedAt: "" },
  },
  facts: [
    {
      id: "fact-a",
      content: "Explicit zero is valid",
      category: "contract",
      confidence: 0.8,
      createdAt: "2026-08-22",
      source: "manual",
      revision: 2,
    },
  ],
};

function mutation(result: UserMemory = memory) {
  return {
    isPending: ref(false),
    error: ref<Error | null>(null),
    mutateAsync: vi.fn().mockResolvedValue(result),
  };
}

function memoryOwner() {
  return {
    memory: ref(memory),
    loading: ref(false),
    fetching: ref(false),
    error: ref<Error | null>(null),
    refetch: vi.fn(),
    clear: mutation(),
    create: mutation(),
    remove: mutation(),
    importDocument: mutation(),
    exportDocument: mutation(),
    update: mutation(),
  };
}

function selectFile(wrapper: ReturnType<typeof mount>, file: object) {
  const input = wrapper.get('[data-testid="memory-import-file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file],
  });
  return input.trigger("change");
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("navigateTo", vi.fn());
});

enableAutoUnmount((unmountAll) => {
  afterEach(() => {
    unmountAll();
    toastStore.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });
});

function portalDialog(role: "dialog" | "alertdialog" = "dialog") {
  const element = document.querySelector<HTMLElement>(`[role="${role}"]`);
  expect(element, `no [role="${role}"] in the document`).not.toBeNull();
  return element!;
}

function dialogButtons(role: "dialog" | "alertdialog" = "dialog") {
  return [
    ...portalDialog(role).querySelectorAll<HTMLButtonElement>(
      '[data-slot="dialog-footer"] button',
    ),
  ];
}

function inPortal<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  expect(element, `${selector} not found in the document`).not.toBeNull();
  return element!;
}

function setPortalValue(selector: string, value: string) {
  const field = inPortal<HTMLInputElement | HTMLTextAreaElement>(selector);
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("MemorySettings", () => {
  it("keeps the latest selected import when an earlier file finishes reading late", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    let finish!: (value: string) => void;
    await selectFile(wrapper, {
      name: "old.json",
      text: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    await selectFile(wrapper, {
      name: "new.json",
      text: async () => JSON.stringify({ ...memory, revision: 6 }),
    });
    await flushPromises();
    expect(portalDialog().textContent).toContain("new.json");
    finish(JSON.stringify(memory));
    await flushPromises();
    expect(portalDialog().textContent).toContain("new.json");
    expect(portalDialog().textContent).not.toContain("old.json");
    dialogButtons()[1]!.click();
    await flushPromises();
    expect(owner.importDocument.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 6 }),
    );
  });
  it("does not close a new fact editor when the previous fact save finishes", async () => {
    const owner = memoryOwner();
    let finish!: (value: UserMemory) => void;
    owner.update.mutateAsync.mockReturnValue(
      new Promise<UserMemory>((resolve) => {
        finish = resolve;
      }),
    );
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    await wrapper.get('button[aria-label^="Edit:"]').trigger("click");
    await flushPromises();
    dialogButtons()[1]!.click();
    await flushPromises();
    dialogButtons()[0]!.click();
    await flushPromises();
    await wrapper.get('[data-testid="memory-add-fact"]').trigger("click");
    await flushPromises();
    setPortalValue('[data-testid="memory-fact-content"]', "New draft");
    finish(memory);
    await flushPromises();
    expect(
      inPortal<HTMLTextAreaElement>('[data-testid="memory-fact-content"]')
        .value,
    ).toBe("New draft");
  });
  it("rejects malformed and structurally invalid imports without a network request", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });

    await selectFile(wrapper, {
      name: "malformed.json",
      text: vi.fn().mockResolvedValue("{oops"),
    });
    await flushPromises();
    expect(toastStore.toasts.value.at(-1)?.message).toBe(
      enUS.settings.memory.importInvalidFile,
    );
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();

    await selectFile(wrapper, {
      name: "partial.json",
      text: vi.fn().mockResolvedValue(JSON.stringify({ version: "2.0" })),
    });
    await flushPromises();
    expect(toastStore.toasts.value.at(-1)?.message).toBe(
      enUS.settings.memory.importInvalidFile,
    );
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows the current React import preview before one confirmed request", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    const imported = {
      ...memory,
      futureRoot: true,
      facts: [memory.facts[0], { ...memory.facts[0], id: "fact-b" }],
    };
    await selectFile(wrapper, {
      name: "memory.json",
      text: vi.fn().mockResolvedValue(JSON.stringify(imported)),
    });
    await flushPromises();

    const dialog = portalDialog();
    expect(dialog.textContent).toContain("memory.json");
    expect(dialog.textContent).toContain("Facts: 2");
    expect(dialog.textContent).not.toContain("2026-08-22T00:00:00Z");
    expect(
      dialog.querySelector('[data-testid="memory-import-extra-warning"]'),
    ).toBeNull();
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();
    dialogButtons()
      .find((button) => button.textContent?.trim() === "Import")!
      .click();
    await flushPromises();
    expect(owner.importDocument.mutateAsync).toHaveBeenCalledTimes(1);
    expect(owner.importDocument.mutateAsync).toHaveBeenCalledWith(imported);
  });

  it("announces every successful memory write", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    const messages = () => toastStore.toasts.value.map((item) => item.message);

    // 删一条事实
    toastStore.clear();
    // 删除键的名字是 `factActionLabel(t.common.delete, fact)`，没有 testid。
    await wrapper.findAll('button[aria-label^="Delete"]')[0]!.trigger("click");
    await flushPromises();
    dialogButtons()[1]!.click();
    await flushPromises();
    expect(messages()).toEqual([enUS.settings.memory.factDeleteSuccess]);

    // 清空整份文档
    toastStore.clear();
    await wrapper.get('[data-testid="memory-clear-open"]').trigger("click");
    await flushPromises();
    dialogButtons()[1]!.click();
    await flushPromises();
    expect(messages()).toEqual([enUS.settings.memory.clearAllSuccess]);
  });

  it("retains failed destructive dialogs and sends exact create/edit confidence zero", async () => {
    const owner = memoryOwner();
    owner.clear.mutateAsync.mockRejectedValue(new Error("Conflict detail"));
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });

    await wrapper.get('[data-testid="memory-clear-open"]').trigger("click");
    await flushPromises();
    dialogButtons()[1]!.click();
    await flushPromises();
    expect(portalDialog()).toBeTruthy();
    expect(toastStore.toasts.value.at(-1)?.message).toBe("Conflict detail");

    dialogButtons()[0]!.click();
    await flushPromises();
    await wrapper.get('[data-testid="memory-add-fact"]').trigger("click");
    await flushPromises();
    setPortalValue('[data-testid="memory-fact-content"]', "Zero");
    setPortalValue('[data-testid="memory-fact-confidence"]', "0");
    await flushPromises();
    dialogButtons()[1]!.click();
    await flushPromises();
    expect(owner.create.mutateAsync).toHaveBeenCalledWith({
      content: "Zero",
      category: "context",
      confidence: 0,
    });

    await wrapper.get('button[aria-label^="Edit:"]').trigger("click");
    await flushPromises();
    setPortalValue('[data-testid="memory-fact-confidence"]', "0");
    await flushPromises();
    dialogButtons()[1]!.click();
    await flushPromises();
    expect(owner.update.mutateAsync).toHaveBeenCalledWith({
      factId: "fact-a",
      input: {
        content: memory.facts[0]!.content,
        category: memory.facts[0]!.category,
        confidence: 0,
      },
    });
  });

  it("distinguishes a non-empty no-match search from fully empty memory", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    expect(wrapper.get('[data-testid="memory-summary"]').text()).toContain(
      "Vue parity",
    );
    await wrapper.get('[data-testid="memory-search"]').setValue("absent");
    expect(wrapper.find('[data-testid="memory-no-matches"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="memory-empty"]').exists()).toBe(false);
  });
});
