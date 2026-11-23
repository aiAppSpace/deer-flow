import {
  PARITY_OBSERVATION_CAPABILITY as CAPABILITY,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import MemorySettings from "@/components/workspace/settings/MemorySettings.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { enUS } from "@/core/i18n/locales/en-US";
import { importMemory, loadMemory } from "@/core/memory/api";
import { normalizeMemoryPayload } from "@/core/memory/schema";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
vi.mock("@/core/memory/api", () => ({
  loadMemory: vi.fn(),
  importMemory: vi.fn(),
  exportMemory: vi.fn(),
  clearMemory: vi.fn(),
  createMemoryFact: vi.fn(),
  deleteMemoryFact: vi.fn(),
  updateMemoryFact: vi.fn(),
}));
vi.mock("@/composables/useSettingsDialog", () => ({
  useSettingsDialog: () => ({ close: vi.fn() }),
}));
const payload = {
  version: "1.0",
  lastUpdated: "",
  user: {},
  history: {},
  facts: [],
};
const memory = normalizeMemoryPayload(payload)!;
let client: QueryClient;
let wrapper: ReturnType<typeof mount>;
let toast: ReturnType<typeof createWorkspaceToastStore>;
async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(importMemory).mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.mocked(loadMemory).mockResolvedValue(memory);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  toast = createWorkspaceToastStore();
});
afterEach(async () => {
  window.removeEventListener(EVENT, receiveIdentity);
  Reflect.deleteProperty(window, CAPABILITY);
  identityPackets = [];
  vi.restoreAllMocks();
  wrapper?.unmount();
  client.clear();
  await settle();
  vi.unstubAllGlobals();
});
function button(host: ParentNode, name: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === name,
  );
  if (!found) throw new Error(`Missing button ${name}`);
  return found;
}
async function setup() {
  wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(Dialog, { open: true }, () =>
          h(DialogContent, { closeLabel: "Close" }, () => [
            h(DialogTitle, () => "Settings"),
            h(DialogDescription, () => "Settings scope"),
            h(MemorySettings),
          ]),
        ),
    }),
    {
      attachTo: document.body,
      global: {
        plugins: [[VueQueryPlugin, { queryClient: client }]],
        provide: { [workspaceToastKey as symbol]: toast },
        stubs: {
          NuxtLink: { template: "<a><slot /></a>" },
          MessageMarkdown: { template: "<div />" },
        },
      },
    },
  );
  await settle();
  const opener = button(document, "Import memory");
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  opener.focus();
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [
      new File([JSON.stringify(payload)], "memory.json", {
        type: "application/json",
      }),
    ],
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  const child = document.querySelector<HTMLElement>(
    '[data-testid="memory-import-dialog"]',
  )!;
  expect(child).not.toBeNull();
  return { opener, input, child };
}
describe("actual Memory nested import close", () => {
  for (const terminal of ["cancel", "escape"] as const)
    it(`${terminal} returns opener without importing`, async () => {
      const f = await setup();
      if (terminal === "escape")
        document.activeElement!.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      else button(f.child, "Cancel").click();
      await settle();
      expect(f.child.isConnected).toBe(false);
      expect(document.activeElement).toBe(f.opener);
      expect(importMemory).not.toHaveBeenCalled();
      expect(f.input.isConnected).toBe(true);
    });
  it("restores an opener disabled during pending import and keeps input identity", async () => {
    let resolve!: (value: typeof memory) => void;
    vi.mocked(importMemory).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const f = await setup();
    button(f.child, "Import").click();
    await settle();
    expect(f.opener.disabled).toBe(true);
    expect(importMemory).toHaveBeenCalledWith(
      memory,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(f.child.isConnected).toBe(true);
    resolve(memory);
    await settle();
    expect(f.child.isConnected).toBe(false);
    expect(document.activeElement).toBe(f.opener);
    expect(document.querySelector('input[type="file"]')).toBe(f.input);
  });
  it("preserves failure confirmation and retries the same normalized payload", async () => {
    vi.mocked(importMemory)
      .mockRejectedValueOnce(new Error("Import denied"))
      .mockResolvedValueOnce(memory);
    const f = await setup();
    button(f.child, "Import").click();
    await settle();
    expect(f.child.isConnected).toBe(true);
    expect(JSON.stringify(toast)).toContain("Import denied");
    button(f.child, "Import").click();
    await settle();
    expect(f.child.isConnected).toBe(false);
    expect(document.activeElement).toBe(f.opener);
    expect(importMemory).toHaveBeenCalledTimes(2);
    expect(vi.mocked(importMemory).mock.calls.map((call) => call[0])).toEqual([
      memory,
      memory,
    ]);
  });
  it("does not restore focus after account or route owner unmount during import", async () => {
    let resolve!: (value: typeof memory) => void;
    vi.mocked(importMemory).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const f = await setup();
    button(f.child, "Import").click();
    await settle();
    wrapper.unmount();
    const route = document.createElement("button");
    document.body.append(route);
    route.focus();
    resolve(memory);
    await settle();
    expect(document.activeElement).toBe(route);
    route.remove();
  });
});

function delayedFile(name: string) {
  let resolve!: (text: string) => void;
  let reject!: (cause: Error) => void;
  const pending = new Promise<string>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  const file = new File([], name, { type: "application/json" });
  const read = vi.fn(() => pending);
  Object.defineProperty(file, "text", { value: read });
  return { file, read, resolve, reject };
}
function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
async function readyForFileRead() {
  const f = await setup();
  button(f.child, "Cancel").click();
  await settle();
  expect(f.child.isConnected).toBe(false);
  expect(f.opener.disabled).toBe(false);
  return f;
}
describe("actual Memory pending file reads", () => {
  for (const result of ["valid", "malformed", "rejected"] as const)
    it(`keeps the newest selected file when the earlier read is ${result}`, async () => {
      const f = await readyForFileRead();
      const error = vi.spyOn(toast, "error");
      const earlier = delayedFile("earlier.json");
      const selected = { ...payload, lastUpdated: "2026-11-01T00:00:00Z" };
      selectFile(f.input, earlier.file);
      expect(earlier.read).toHaveBeenCalledTimes(1);
      expect(
        document.querySelector('[data-testid="memory-import-dialog"]'),
      ).toBeNull();
      expect(f.opener.disabled).toBe(false);
      selectFile(
        f.input,
        new File([JSON.stringify(selected)], "selected.json", {
          type: "application/json",
        }),
      );
      await settle();
      const preview = document.querySelector<HTMLElement>(
        '[data-testid="memory-import-dialog"]',
      )!;
      expect(preview).not.toBeNull();
      expect(preview.textContent).toContain("selected.json");
      if (result === "rejected")
        earlier.reject(new Error("Earlier read failed"));
      else earlier.resolve(result === "valid" ? JSON.stringify(payload) : "{");
      await settle();
      expect(preview.textContent).toContain("selected.json");
      expect(preview.textContent).not.toContain("earlier.json");
      expect(error).not.toHaveBeenCalled();
      vi.mocked(importMemory).mockResolvedValueOnce(
        normalizeMemoryPayload(selected)!,
      );
      button(preview, "Import").click();
      await settle();
      expect(importMemory).toHaveBeenCalledExactlyOnceWith(
        normalizeMemoryPayload(selected),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(preview.isConnected).toBe(false);
    });
  for (const result of ["malformed", "rejected"] as const)
    it(`does not report a ${result} file after its owner unmounts`, async () => {
      const f = await readyForFileRead();
      const error = vi.spyOn(toast, "error");
      const file = delayedFile("departed.json");
      selectFile(f.input, file.file);
      expect(file.read).toHaveBeenCalledTimes(1);
      wrapper.unmount();
      if (result === "rejected") file.reject(new Error("Departed read failed"));
      else file.resolve("{");
      await settle();
      expect(error).not.toHaveBeenCalled();
      expect(importMemory).not.toHaveBeenCalled();
      expect(
        document.querySelector('[data-testid="memory-import-dialog"]'),
      ).toBeNull();
    });
});

it("reports the current file failure and accepts a subsequent valid selection", async () => {
  const f = await readyForFileRead();
  const error = vi.spyOn(toast, "error");
  const file = delayedFile("current-invalid.json");
  selectFile(f.input, file.file);
  expect(file.read).toHaveBeenCalledTimes(1);
  file.resolve("{");
  await settle();
  expect(error).toHaveBeenCalledExactlyOnceWith(
    enUS.settings.memory.importInvalidFile,
  );
  expect(importMemory).not.toHaveBeenCalled();
  selectFile(
    f.input,
    new File([JSON.stringify(payload)], "current-valid.json", {
      type: "application/json",
    }),
  );
  await settle();
  const preview = document.querySelector<HTMLElement>(
    '[data-testid="memory-import-dialog"]',
  )!;
  expect(preview).not.toBeNull();
  expect(preview.textContent).toContain("current-valid.json");
  vi.mocked(importMemory).mockResolvedValueOnce(memory);
  button(preview, "Import").click();
  await settle();
  expect(importMemory).toHaveBeenCalledExactlyOnceWith(
    memory,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(preview.isConnected).toBe(false);
});

let identityPackets: ObservationPacket[] = [];
const receiveIdentity = (event: Event) =>
  identityPackets.push((event as CustomEvent<ObservationPacket>).detail);
function observeMemory() {
  const capability = { version: 1, token: "memory-ui", action: "initial" };
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: capability,
  });
  window.addEventListener(EVENT, receiveIdentity);
  return capability;
}
const identityPayload = {
  ...payload,
  facts: [
    { content: "private repeated content" },
    { id: "literal-existing", content: "private repeated content" },
  ],
};

describe("actual selected Memory identity source", () => {
  for (const enabled of [false, true])
    it(`preserves normalized input, one allocation and failed-import retry (observer=${enabled})`, async () => {
      const capability = enabled ? observeMemory() : null;
      const f = await readyForFileRead();
      identityPackets = [];
      if (capability) capability.action = "select-file";
      const uuid = vi
        .spyOn(crypto, "randomUUID")
        .mockReturnValue("11111111-2222-4333-8444-555555555555");
      selectFile(
        f.input,
        new File([JSON.stringify(identityPayload)], "selected.json", {
          type: "application/json",
        }),
      );
      await settle();
      const preview = document.querySelector<HTMLElement>(
        '[data-testid="memory-import-dialog"]',
      )!;
      expect(preview).not.toBeNull();
      expect(preview.textContent).toContain("selected.json");
      expect(uuid).toHaveBeenCalledTimes(1);
      if (enabled) {
        expect(
          identityPackets
            .filter((p) => p.event === "memory.fact")
            .map((p) => p.values),
        ).toEqual([
          { index: 0, raw: "fact_11111111", generated: true },
          { index: 1, raw: "literal-existing", generated: false },
        ]);
        expect(
          identityPackets
            .filter((p) => p.event === "memory.fact")
            .every((p) => p.action === "select-file"),
        ).toBe(true);
        expect(JSON.stringify(identityPackets)).not.toContain(
          "private repeated content",
        );
      } else expect(identityPackets).toEqual([]);
      vi.mocked(importMemory)
        .mockRejectedValueOnce(new Error("Import denied"))
        .mockResolvedValueOnce(memory);
      button(preview, "Import").click();
      await settle();
      expect(JSON.stringify(toast)).toContain("Import denied");
      expect(preview.isConnected).toBe(true);
      button(preview, "Import").click();
      await settle();
      expect(preview.isConnected).toBe(false);
      const calls = vi.mocked(importMemory).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]![0]).toEqual(calls[1]![0]);
      expect(
        calls[0]![0].facts.map((fact) => ({
          id: fact.id,
          content: fact.content,
        })),
      ).toEqual([
        { id: "fact_11111111", content: "private repeated content" },
        { id: "literal-existing", content: "private repeated content" },
      ]);
      expect(uuid).toHaveBeenCalledTimes(1);
      if (enabled) {
        expect(
          identityPackets.filter((p) => p.event === "memory.fact"),
        ).toHaveLength(2);
        expect(
          identityPackets.filter((p) => p.event === "memory.retire"),
        ).toHaveLength(1);
      } else expect(identityPackets).toEqual([]);
    });
  it("does not publish partially normalized rejected import facts", async () => {
    observeMemory();
    const f = await readyForFileRead();
    identityPackets = [];
    selectFile(
      f.input,
      new File(
        [JSON.stringify({ ...payload, facts: [{ content: "unused" }, null] })],
        "invalid.json",
        { type: "application/json" },
      ),
    );
    await settle();
    expect(JSON.stringify(toast)).toContain(
      enUS.settings.memory.importInvalidFile,
    );
    expect(identityPackets).toEqual([]);
    expect(importMemory).not.toHaveBeenCalled();
  });
  it("publishes only the newest actual preview with its original selection action", async () => {
    const capability = observeMemory();
    const f = await readyForFileRead();
    identityPackets = [];
    capability.action = "earlier-file";
    const earlier = delayedFile("earlier.json");
    selectFile(f.input, earlier.file);
    expect(earlier.read).toHaveBeenCalledTimes(1);
    capability.action = "selected-file";
    const selected = delayedFile("selected.json");
    selectFile(f.input, selected.file);
    expect(selected.read).toHaveBeenCalledTimes(1);
    capability.action = "after-selection";
    selected.resolve(JSON.stringify(identityPayload));
    await settle();
    const preview = document.querySelector<HTMLElement>(
      '[data-testid="memory-import-dialog"]',
    )!;
    expect(preview).not.toBeNull();
    expect(preview.textContent).toContain("selected.json");
    const facts = identityPackets.filter((p) => p.event === "memory.fact");
    expect(facts).toHaveLength(2);
    expect(facts.every((p) => p.action === "selected-file")).toBe(true);
    earlier.resolve(JSON.stringify(identityPayload));
    await settle();
    expect(preview.textContent).toContain("selected.json");
    expect(identityPackets.filter((p) => p.event === "memory.fact")).toEqual(
      facts,
    );
    button(preview, "Cancel").click();
    await settle();
    expect(preview.isConnected).toBe(false);
    expect(
      identityPackets.filter((p) => p.event === "memory.retire"),
    ).toHaveLength(1);
    expect(importMemory).not.toHaveBeenCalled();
  });
});

for (const valid of [false, true])
  it(`does not publish an enabled file read after actual owner unmount (valid=${valid})`, async () => {
    observeMemory();
    const f = await readyForFileRead();
    const error = vi.spyOn(toast, "error");
    identityPackets = [];
    const file = delayedFile("departed-source.json");
    selectFile(f.input, file.file);
    expect(file.read).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    file.resolve(valid ? JSON.stringify(identityPayload) : "{");
    await settle();
    expect(identityPackets).toEqual([]);
    expect(error).not.toHaveBeenCalled();
    expect(importMemory).not.toHaveBeenCalled();
  });

async function actualImportTransport() {
  const actual = await vi.importActual<{ importMemory: typeof importMemory }>(
    "@/core/memory/api",
  );
  vi.mocked(importMemory).mockImplementation(actual.importMemory);
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json(memory));
}
async function actualPreview(inputPayload = identityPayload) {
  const f = await readyForFileRead();
  identityPackets = [];
  selectFile(
    f.input,
    new File([JSON.stringify(inputPayload)], "dispatch.json", {
      type: "application/json",
    }),
  );
  await settle();
  const preview = document.querySelector<HTMLElement>(
    '[data-testid="memory-import-dialog"]',
  )!;
  expect(preview).not.toBeNull();
  return {
    ...f,
    preview,
    confirm: () => button(preview, "Import").click(),
    cancel: () => button(preview, "Cancel").click(),
    leave: () => wrapper.unmount(),
  };
}

describe("actual Settings through mutation API and authenticated fetcher", () => {
  for (const enabled of [false, true])
    it(`keeps the original normalized object and bytes through failure and retry (observer=${enabled})`, async () => {
      const capability = enabled ? observeMemory() : null;
      const request = await actualImportTransport();
      request.mockRejectedValueOnce(new Error("native import denied"));
      const f = await actualPreview();
      if (capability) capability.action = "confirm-1";
      f.confirm();
      await settle();
      expect(JSON.stringify(toast)).toContain("native import denied");
      expect(f.preview.isConnected).toBe(true);
      if (capability) capability.action = "confirm-2";
      f.confirm();
      await settle();
      expect(f.preview.isConnected).toBe(false);
      expect(request).toHaveBeenCalledTimes(2);
      const bodies = request.mock.calls.map((call) => call[1]?.body);
      expect(bodies[0]).toBe(bodies[1]);
      if (typeof bodies[0] !== "string")
        throw new Error("Expected original JSON body");
      const sent = JSON.parse(bodies[0]) as {
        facts: { id: string; content: string }[];
      };
      expect(sent.facts.map((fact) => fact.content)).toEqual([
        "private repeated content",
        "private repeated content",
      ]);
      expect(sent.facts[1]?.id).toBe("literal-existing");
      expect(client.getQueryData(["memory"])).toEqual(memory);
      expect(document.activeElement).toBe(f.opener);
      if (enabled) {
        const source = identityPackets.filter((p) => p.event === "memory.fact");
        const dispatch = identityPackets.filter(
          (p) => p.event === "memory.dispatch",
        );
        expect(source).toHaveLength(2);
        expect(source.map((p) => p.values.raw)).toEqual(
          sent.facts.map((f) => f.id),
        );
        expect(dispatch.map((p) => p.values)).toEqual([
          { state: "selected", preAborted: false },
          { state: "selected", preAborted: false },
        ]);
        expect(dispatch.map((p) => p.action)).toEqual([
          "confirm-1",
          "confirm-2",
        ]);
        expect(dispatch.every((p) => p.instance === source[0]!.instance)).toBe(
          true,
        );
        expect(
          identityPackets.filter((p) => p.event === "memory.retire"),
        ).toHaveLength(1);
        expect(JSON.stringify(identityPackets)).not.toContain(
          "private repeated content",
        );
      } else expect(identityPackets).toEqual([]);
    });
  for (const terminal of ["cancel", "unmount"] as const)
    it(`preview ${terminal} creates no phantom native attempt`, async () => {
      observeMemory();
      const request = await actualImportTransport();
      const f = await actualPreview();
      if (terminal === "cancel") f.cancel();
      else f.leave();
      await settle();
      expect(request).not.toHaveBeenCalled();
      expect(importMemory).not.toHaveBeenCalled();
      expect(
        identityPackets.filter((p) => p.event === "memory.dispatch"),
      ).toEqual([]);
      expect(
        identityPackets.filter((p) => p.event === "memory.retire"),
      ).toHaveLength(1);
    });
  it("an observer dispatch exception cannot change actual import success", async () => {
    observeMemory();
    const request = await actualImportTransport();
    const f = await actualPreview();
    const original = window.dispatchEvent.bind(window);
    vi.spyOn(window, "dispatchEvent").mockImplementation((event) => {
      if (event.type === EVENT) throw new Error("observation unavailable");
      return original(event);
    });
    f.confirm();
    await settle();
    expect(f.preview.isConnected).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["memory"])).toEqual(memory);
  });
});

it("disposed Vue owner before mutationFn creates no source dispatch or native call", async () => {
  observeMemory();
  const request = await actualImportTransport();
  const f = await actualPreview();
  f.confirm();
  f.leave();
  await settle();
  expect(importMemory).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  expect(identityPackets.filter((p) => p.event === "memory.dispatch")).toEqual(
    [],
  );
});

it("a late earlier file cannot own the newer preview's actual native dispatch", async () => {
  const capability = observeMemory();
  const request = await actualImportTransport();
  const f = await readyForFileRead();
  identityPackets = [];
  const earlier = delayedFile("earlier-dispatch.json");
  const selected = delayedFile("selected-dispatch.json");
  capability.action = "earlier-file";
  selectFile(f.input, earlier.file);
  capability.action = "selected-file";
  selectFile(f.input, selected.file);
  selected.resolve(JSON.stringify(identityPayload));
  await settle();
  const preview = document.querySelector<HTMLElement>(
    '[data-testid="memory-import-dialog"]',
  )!;
  earlier.resolve(JSON.stringify(identityPayload));
  await settle();
  expect(request).not.toHaveBeenCalled();
  const facts = identityPackets.filter((p) => p.event === "memory.fact");
  expect(facts).toHaveLength(2);
  expect(facts.every((p) => p.action === "selected-file")).toBe(true);
  capability.action = "confirm-selected";
  button(preview, "Import").click();
  await settle();
  expect(preview.isConnected).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
  const calls = identityPackets.filter((p) => p.event === "memory.dispatch");
  expect(calls).toHaveLength(1);
  expect(calls[0]!.instance).toBe(facts[0]!.instance);
  expect(calls[0]!.action).toBe("confirm-selected");
  expect(calls[0]!.values).toEqual({ state: "selected", preAborted: false });
  const bytes = request.mock.calls[0]![1]?.body;
  if (typeof bytes !== "string") throw new Error("Expected original JSON body");
  const body = JSON.parse(bytes) as {
    facts: { id: string }[];
  };
  expect(body.facts.map((fact) => fact.id)).toEqual(
    facts.map((fact) => fact.values.raw),
  );
});
