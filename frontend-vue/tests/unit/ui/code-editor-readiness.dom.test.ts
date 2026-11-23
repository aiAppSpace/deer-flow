import { flushPromises, mount } from "@vue/test-utils";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import CodeEditor from "@/components/ui/code-editor/CodeEditor.vue";

const initialization = vi.hoisted(() => ({
  pending: [] as { release: () => void; focus: ReturnType<typeof vi.fn> }[],
}));

// Keep the actual EditorView and DOM. Only hold the factory's return after its
// language await: this is the real interval in which the old host exposed two
// textboxes and autofocus ran before Vue removed the fallback.
vi.mock("@/core/code-editor/editor", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/core/code-editor/editor")>();
  return {
    ...original,
    async createCodeEditor(
      options: Parameters<typeof original.createCodeEditor>[0],
    ) {
      const editor = await original.createCodeEditor(options);
      const focus = vi.fn(() => editor.focus());
      await new Promise<void>((release) =>
        initialization.pending.push({ release, focus }),
      );
      return { ...editor, focus };
    },
  };
});

afterEach(() => {
  initialization.pending.splice(0).forEach(({ release }) => release());
});

async function pendingEditor() {
  await vi.waitFor(() => expect(initialization.pending).toHaveLength(1));
  return initialization.pending[0]!;
}

describe("CodeEditor semantic handoff", () => {
  it("exposes only its readonly fallback while the real editor is still initializing", async () => {
    const wrapper = mount(CodeEditor, {
      attachTo: document.body,
      props: {
        modelValue: "draft",
        contentLabel: "Artifact editor",
        autofocus: true,
      },
    });
    const pending = await pendingEditor();
    const content = wrapper.get(".cm-content").element as HTMLElement;
    const host = content.closest("[aria-hidden='true']");
    expect(
      host,
      "pending CodeMirror must be absent from the accessibility tree",
    ).not.toBeNull();
    expect(
      host?.hasAttribute("inert"),
      "pending CodeMirror must not accept focus or edits",
    ).toBe(true);
    expect(wrapper.findAll("textarea")).toHaveLength(1);
    expect(pending.focus).not.toHaveBeenCalled();
    pending.release();
    await flushPromises();
    expect(wrapper.findAll("textarea")).toHaveLength(0);
    expect(content.closest("[aria-hidden='true'],[inert]")).toBeNull();
    expect(pending.focus).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(content);
    wrapper.unmount();
  });

  it("destroys an initialization retired by unmount without focusing its detached editor", async () => {
    const wrapper = mount(CodeEditor, {
      attachTo: document.body,
      props: { modelValue: "retired", autofocus: true },
    });
    const pending = await pendingEditor();
    const host = wrapper.element as HTMLElement;
    expect(EditorView.findFromDOM(host)).not.toBeNull();
    wrapper.unmount();
    pending.release();
    await flushPromises();
    expect(pending.focus).not.toHaveBeenCalled();
    expect(EditorView.findFromDOM(host)).toBeNull();
    expect(host.querySelector(".cm-editor")).toBeNull();
  });
});
