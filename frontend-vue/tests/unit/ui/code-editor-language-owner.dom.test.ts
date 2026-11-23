import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { language } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import type { Extension } from "@codemirror/state";
import { createCodeEditor } from "@/core/code-editor/editor";
import { loadCodeEditorLanguage } from "@/core/code-editor/language";

vi.mock("@/core/code-editor/language", async (original) => ({
  ...(await original<typeof import("@/core/code-editor/language")>()),
  loadCodeEditorLanguage: vi.fn(async () => []),
}));
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.mocked(loadCodeEditorLanguage).mockReset().mockResolvedValue([]);
});
function deferred() {
  let resolve!: (value: Extension[]) => void;
  const promise = new Promise<Extension[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function setup() {
  const parent = document.createElement("div");
  document.body.append(parent);
  const handle = await createCodeEditor({
    parent,
    doc: "a = 1",
    language: "text",
    theme: "light",
    readOnly: false,
    onChange: vi.fn(),
    onSave: vi.fn(),
  });
  const view = EditorView.findFromDOM(parent);
  if (!view) throw new Error("real EditorView did not mount");
  cleanups.push(() => {
    handle.destroy();
    parent.remove();
  });
  return { parent, handle, view };
}
describe("language request owner", () => {
  it("destroys the real view when initial grammar loading rejects before handoff", async () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const failure = new Error("initial grammar chunk unavailable");
    vi.mocked(loadCodeEditorLanguage).mockRejectedValueOnce(failure);
    cleanups.push(() => {
      EditorView.findFromDOM(parent)?.destroy();
      parent.remove();
    });
    await expect(
      createCodeEditor({
        parent,
        doc: "a = 1",
        language: "python",
        theme: "light",
        readOnly: false,
        onChange: vi.fn(),
        onSave: vi.fn(),
      }),
    ).rejects.toBe(failure);
    expect(parent.querySelector(".cm-editor")).toBeNull();
    expect(EditorView.findFromDOM(parent)).toBeNull();
  });
  it("keeps the newest language when an older loader returns last", async () => {
    const { handle, view } = await setup();
    const old = deferred();
    const latest = deferred();
    vi.mocked(loadCodeEditorLanguage).mockImplementation((mode) =>
      mode === "python" ? old.promise : latest.promise,
    );
    const slow = handle.setLanguage("python");
    const fast = handle.setLanguage("json");
    latest.resolve([json()]);
    await fast;
    expect(view.state.facet(language)?.name).toBe("json");
    old.resolve([python()]);
    await slow;
    expect(view.state.facet(language)?.name).toBe("json");
  });
  it("retires pending language work on destroy", async () => {
    const { parent, handle, view } = await setup();
    const pending = deferred();
    vi.mocked(loadCodeEditorLanguage).mockReturnValue(pending.promise);
    const change = handle.setLanguage("python");
    handle.destroy();
    pending.resolve([python()]);
    await change;
    expect(parent.querySelector(".cm-editor")).toBeNull();
    expect(view.state.facet(language)).toBeNull();
  });
});
