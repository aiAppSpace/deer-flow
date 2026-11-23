import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode, Fragment } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { MemorySettingsPage } from "@/components/workspace/settings/memory-settings-page";
import {
  PARITY_OBSERVATION_CAPABILITY as CAPABILITY,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";
import { enUS } from "@/core/i18n/locales/en-US";
import { importMemory, loadMemory } from "@/core/memory/api";
import { normalizeMemoryPayload } from "@/core/memory/import-memory";
rs.mock("@/core/i18n/hooks", () => ({ useI18n: () => ({ t: enUS }) }));
rs.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
rs.mock("@/core/static-mode", () => ({ isStaticWebsiteOnly: () => false }));
rs.mock("@/core/memory/api", () => ({
  loadMemory: rs.fn(),
  importMemory: rs.fn(),
  exportMemory: rs.fn(),
  clearMemory: rs.fn(),
  createMemoryFact: rs.fn(),
  deleteMemoryFact: rs.fn(),
  updateMemoryFact: rs.fn(),
}));
rs.mock("@/core/streamdown/components", () => ({
  SafeStreamdown: () => null,
  toStreamdownComponents: () => ({}),
}));
rs.mock("@/core/streamdown/plugins", () => ({ streamdownPlugins: {} }));
rs.mock("@/components/workspace/messages/markdown-link", () => ({
  createMarkdownLinkComponent: () => () => null,
}));
rs.mock("sonner", () => ({ toast: { success: rs.fn(), error: rs.fn() } }));
const payload = {
  version: "1.0",
  lastUpdated: "",
  user: {},
  history: {},
  facts: [],
};
const memory = normalizeMemoryPayload(payload)!;
let client: QueryClient;
beforeEach(() => {
  rs.clearAllMocks();
  rs.mocked(importMemory).mockReset();
  rs.mocked(loadMemory).mockResolvedValue(memory);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  window.removeEventListener(EVENT, receiveIdentity);
  Reflect.deleteProperty(window, CAPABILITY);
  identityPackets = [];
  rs.restoreAllMocks();
  cleanup();
  client.clear();
  await new Promise((resolve) => setTimeout(resolve, 10));
});
async function setup(strict = false) {
  const mounted = render(
    <QueryClientProvider client={client}>
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Settings scope</DialogDescription>
          <MemorySettingsPage />
        </DialogContent>
      </Dialog>
    </QueryClientProvider>,
    { wrapper: strict ? StrictMode : Fragment },
  );
  const opener = await screen.findByRole("button", {
    name: "Import memory",
  });
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  act(() => opener.focus());
  fireEvent.change(input, {
    target: {
      files: [
        new File([JSON.stringify(payload)], "memory.json", {
          type: "application/json",
        }),
      ],
    },
  });
  const child = await screen.findByRole("dialog", {
    name: "Import memory?",
  });
  return { ...mounted, opener, input, child };
}
describe("actual Memory nested import close", () => {
  for (const terminal of ["cancel", "escape"] as const)
    it(`${terminal} returns the opener without importing`, async () => {
      const f = await setup();
      if (terminal === "escape")
        fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      else
        fireEvent.click(
          within(f.child).getByRole("button", { name: "Cancel" }),
        );
      await waitFor(() => expect(f.child.isConnected).toBe(false));
      await waitFor(() => expect(document.activeElement).toBe(f.opener));
      expect(importMemory).not.toHaveBeenCalled();
      expect(f.input.isConnected).toBe(true);
    });
  it("keeps the same file input and restores an opener disabled during import", async () => {
    let resolve!: (value: typeof memory) => void;
    rs.mocked(importMemory).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const f = await setup();
    fireEvent.click(within(f.child).getByRole("button", { name: "Import" }));
    await waitFor(() =>
      expect((f.opener as HTMLButtonElement).disabled).toBe(true),
    );
    expect(importMemory).toHaveBeenCalledExactlyOnceWith(memory);
    expect(f.child.isConnected).toBe(true);
    await act(async () => resolve(memory));
    await waitFor(() => expect(f.child.isConnected).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(f.opener));
    expect(f.input).toBe(document.querySelector('input[type="file"]'));
  });
  it("preserves the confirmation after failure and retries the same normalized payload", async () => {
    rs.mocked(importMemory)
      .mockRejectedValueOnce(new Error("Import denied"))
      .mockResolvedValueOnce(memory);
    const f = await setup();
    fireEvent.click(within(f.child).getByRole("button", { name: "Import" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Import denied"),
    );
    expect(f.child.isConnected).toBe(true);
    fireEvent.click(within(f.child).getByRole("button", { name: "Import" }));
    await waitFor(() => expect(f.child.isConnected).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(f.opener));
    expect(importMemory).toHaveBeenNthCalledWith(1, memory);
    expect(importMemory).toHaveBeenNthCalledWith(2, memory);
  });
  it("does not restore focus after its account or route owner unmounts during import", async () => {
    let resolve!: (value: typeof memory) => void;
    rs.mocked(importMemory).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const f = await setup();
    fireEvent.click(within(f.child).getByRole("button", { name: "Import" }));
    await waitFor(() => expect(importMemory).toHaveBeenCalledTimes(1));
    f.unmount();
    const route = document.createElement("button");
    document.body.append(route);
    route.focus();
    await act(async () => resolve(memory));
    await new Promise((done) => setTimeout(done, 10));
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
  const read = rs.fn(() => pending);
  Object.defineProperty(file, "text", { value: read });
  return { file, read, resolve, reject };
}
async function readyForFileRead(strict = false) {
  const f = await setup(strict);
  fireEvent.click(within(f.child).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(f.child.isConnected).toBe(false));
  expect((f.opener as HTMLButtonElement).disabled).toBe(false);
  return f;
}
describe("actual Memory pending file reads", () => {
  for (const result of ["valid", "malformed", "rejected"] as const)
    it(`keeps the newest selected file when the earlier read is ${result}`, async () => {
      const f = await readyForFileRead();
      const earlier = delayedFile("earlier.json");
      const selected = { ...payload, lastUpdated: "2026-11-01T00:00:00Z" };
      fireEvent.change(f.input, { target: { files: [earlier.file] } });
      expect(earlier.read).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("dialog", { name: "Import memory?" }),
      ).toBeNull();
      expect((f.opener as HTMLButtonElement).disabled).toBe(false);
      fireEvent.change(f.input, {
        target: {
          files: [
            new File([JSON.stringify(selected)], "selected.json", {
              type: "application/json",
            }),
          ],
        },
      });
      const preview = await screen.findByRole("dialog", {
        name: "Import memory?",
      });
      expect(within(preview).getByText("selected.json")).toBeTruthy();
      await act(async () => {
        if (result === "rejected")
          earlier.reject(new Error("Earlier read failed"));
        else
          earlier.resolve(result === "valid" ? JSON.stringify(payload) : "{");
      });
      expect(within(preview).queryByText("selected.json")).not.toBeNull();
      expect(within(preview).queryByText("earlier.json")).toBeNull();
      expect(toast.error).not.toHaveBeenCalled();
      rs.mocked(importMemory).mockResolvedValueOnce(
        normalizeMemoryPayload(selected)!,
      );
      fireEvent.click(within(preview).getByRole("button", { name: "Import" }));
      await waitFor(() =>
        expect(importMemory).toHaveBeenCalledExactlyOnceWith(
          normalizeMemoryPayload(selected),
        ),
      );
      await waitFor(() => expect(preview.isConnected).toBe(false));
    });
  for (const result of ["malformed", "rejected"] as const)
    it(`does not report a ${result} file after its owner unmounts`, async () => {
      const f = await readyForFileRead();
      const file = delayedFile("departed.json");
      fireEvent.change(f.input, { target: { files: [file.file] } });
      expect(file.read).toHaveBeenCalledTimes(1);
      f.unmount();
      await act(async () => {
        if (result === "rejected")
          file.reject(new Error("Departed read failed"));
        else file.resolve("{");
      });
      expect(toast.error).not.toHaveBeenCalled();
      expect(importMemory).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Import memory?" }),
      ).toBeNull();
    });
});

it("accepts a current selection and reports its failure after Strict Mode effect replay", async () => {
  const f = await readyForFileRead(true);
  const file = delayedFile("current-invalid.json");
  fireEvent.change(f.input, { target: { files: [file.file] } });
  expect(file.read).toHaveBeenCalledTimes(1);
  await act(async () => file.resolve("{"));
  expect(toast.error).toHaveBeenCalledExactlyOnceWith(
    enUS.settings.memory.importInvalidFile,
  );
  expect(importMemory).not.toHaveBeenCalled();
  fireEvent.change(f.input, {
    target: {
      files: [
        new File([JSON.stringify(payload)], "current-valid.json", {
          type: "application/json",
        }),
      ],
    },
  });
  const preview = await screen.findByRole("dialog", { name: "Import memory?" });
  expect(within(preview).getByText("current-valid.json")).toBeTruthy();
  rs.mocked(importMemory).mockResolvedValueOnce(memory);
  fireEvent.click(within(preview).getByRole("button", { name: "Import" }));
  await waitFor(() =>
    expect(importMemory).toHaveBeenCalledExactlyOnceWith(memory),
  );
  await waitFor(() => expect(preview.isConnected).toBe(false));
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
      const f = await readyForFileRead(true);
      identityPackets = [];
      if (capability) capability.action = "select-file";
      const uuid = rs
        .spyOn(crypto, "randomUUID")
        .mockReturnValue("11111111-2222-4333-8444-555555555555");
      fireEvent.change(f.input, {
        target: {
          files: [
            new File([JSON.stringify(identityPayload)], "selected.json", {
              type: "application/json",
            }),
          ],
        },
      });
      const preview = await screen.findByRole("dialog", {
        name: "Import memory?",
      });
      expect(within(preview).getByText("selected.json")).toBeTruthy();
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
      rs.mocked(importMemory)
        .mockRejectedValueOnce(new Error("Import denied"))
        .mockResolvedValueOnce(memory);
      fireEvent.click(within(preview).getByRole("button", { name: "Import" }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Import denied"),
      );
      expect(preview.isConnected).toBe(true);
      fireEvent.click(within(preview).getByRole("button", { name: "Import" }));
      await waitFor(() => expect(preview.isConnected).toBe(false));
      const calls = rs.mocked(importMemory).mock.calls;
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
    fireEvent.change(f.input, {
      target: {
        files: [
          new File(
            [
              JSON.stringify({
                ...payload,
                facts: [{ content: "unused" }, null],
              }),
            ],
            "invalid.json",
            { type: "application/json" },
          ),
        ],
      },
    });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        enUS.settings.memory.importInvalidFile,
      ),
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
    fireEvent.change(f.input, { target: { files: [earlier.file] } });
    expect(earlier.read).toHaveBeenCalledTimes(1);
    capability.action = "selected-file";
    const selected = delayedFile("selected.json");
    fireEvent.change(f.input, { target: { files: [selected.file] } });
    expect(selected.read).toHaveBeenCalledTimes(1);
    capability.action = "after-selection";
    await act(async () => selected.resolve(JSON.stringify(identityPayload)));
    const preview = await screen.findByRole("dialog", {
      name: "Import memory?",
    });
    expect(within(preview).getByText("selected.json")).toBeTruthy();
    const facts = identityPackets.filter((p) => p.event === "memory.fact");
    expect(facts).toHaveLength(2);
    expect(facts.every((p) => p.action === "selected-file")).toBe(true);
    await act(async () => earlier.resolve(JSON.stringify(identityPayload)));
    expect(within(preview).getByText("selected.json")).toBeTruthy();
    expect(identityPackets.filter((p) => p.event === "memory.fact")).toEqual(
      facts,
    );
    fireEvent.click(within(preview).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(preview.isConnected).toBe(false));
    expect(
      identityPackets.filter((p) => p.event === "memory.retire"),
    ).toHaveLength(1);
    expect(importMemory).not.toHaveBeenCalled();
  });
});

for (const valid of [false, true])
  it(`does not publish an enabled file read after actual owner unmount (valid=${valid})`, async () => {
    observeMemory();
    const f = await readyForFileRead(true);
    identityPackets = [];
    const file = delayedFile("departed-source.json");
    fireEvent.change(f.input, { target: { files: [file.file] } });
    expect(file.read).toHaveBeenCalledTimes(1);
    f.unmount();
    await act(async () =>
      file.resolve(valid ? JSON.stringify(identityPayload) : "{"),
    );
    expect(identityPackets).toEqual([]);
    expect(toast.error).not.toHaveBeenCalled();
    expect(importMemory).not.toHaveBeenCalled();
  });

async function actualImportTransport() {
  const actual = await rs.importActual<{ importMemory: typeof importMemory }>(
    "@/core/memory/api",
  );
  rs.mocked(importMemory).mockImplementation(actual.importMemory);
  return rs
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json(memory));
}
async function actualPreview(inputPayload = identityPayload) {
  const f = await readyForFileRead();
  identityPackets = [];
  fireEvent.change(f.input, {
    target: {
      files: [
        new File([JSON.stringify(inputPayload)], "dispatch.json", {
          type: "application/json",
        }),
      ],
    },
  });
  const preview = await screen.findByRole("dialog", { name: "Import memory?" });
  return {
    ...f,
    preview,
    confirm: () =>
      fireEvent.click(within(preview).getByRole("button", { name: "Import" })),
    cancel: () =>
      fireEvent.click(within(preview).getByRole("button", { name: "Cancel" })),
    leave: () => f.unmount(),
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
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("native import denied"),
      );
      expect(f.preview.isConnected).toBe(true);
      if (capability) capability.action = "confirm-2";
      f.confirm();
      await waitFor(() => expect(f.preview.isConnected).toBe(false));
      await waitFor(() => expect(document.activeElement).toBe(f.opener));
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
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
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
    rs.spyOn(window, "dispatchEvent").mockImplementation((event) => {
      if (event.type === EVENT) throw new Error("observation unavailable");
      return original(event);
    });
    f.confirm();
    await waitFor(() => expect(f.preview.isConnected).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(f.opener));
    expect(request).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["memory"])).toEqual(memory);
  });
});

it("a late earlier file cannot own the newer preview's actual native dispatch", async () => {
  const capability = observeMemory();
  const request = await actualImportTransport();
  const f = await readyForFileRead();
  identityPackets = [];
  const earlier = delayedFile("earlier-dispatch.json");
  const selected = delayedFile("selected-dispatch.json");
  capability.action = "earlier-file";
  fireEvent.change(f.input, { target: { files: [earlier.file] } });
  capability.action = "selected-file";
  fireEvent.change(f.input, { target: { files: [selected.file] } });
  await act(async () => selected.resolve(JSON.stringify(identityPayload)));
  const preview = await screen.findByRole("dialog", { name: "Import memory?" });
  await act(async () => earlier.resolve(JSON.stringify(identityPayload)));
  expect(request).not.toHaveBeenCalled();
  const facts = identityPackets.filter((p) => p.event === "memory.fact");
  expect(facts).toHaveLength(2);
  expect(facts.every((p) => p.action === "selected-file")).toBe(true);
  capability.action = "confirm-selected";
  fireEvent.click(within(preview).getByRole("button", { name: "Import" }));
  await waitFor(() => expect(preview.isConnected).toBe(false));
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
