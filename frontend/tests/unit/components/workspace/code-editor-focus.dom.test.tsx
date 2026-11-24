import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { cleanup, render, waitFor } from "@testing-library/react";
import { EditorView } from "@uiw/react-codemirror";

rs.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
rs.mock("@/components/workspace/messages/context", () => ({
  useThread: () => ({ thread: { isLoading: false } }),
}));

import { CodeEditor } from "@/components/workspace/code-editor";

const focusedStates: boolean[] = [];
const nativeFocus: unknown = Object.getOwnPropertyDescriptor(
  EditorView.prototype,
  "focus",
)?.value;

beforeEach(() => {
  focusedStates.length = 0;
  rs.spyOn(EditorView.prototype, "focus").mockImplementation(function (
    this: EditorView,
  ) {
    // Observe the real CodeMirror state at the actual public focus call.
    // Happy DOM cannot establish native readonly focusability; browser parity
    // separately checks activeElement after the real artifact Edit action.
    focusedStates.push(this.state.readOnly);
    if (typeof nativeFocus !== "function") {
      throw new Error("native CodeMirror focus method missing");
    }
    Reflect.apply(nativeFocus, this, []);
  });
});

afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
});

async function mountedEditor(props: {
  readonly?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const wrapper = render(<CodeEditor value="alpha beta" {...props} />);
  await waitFor(() => {
    expect(wrapper.container.querySelector(".cm-editor")).not.toBeNull();
  });
  const element = wrapper.container.querySelector<HTMLElement>(".cm-editor");
  if (!element) throw new Error("real CodeMirror editor missing");
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error("real CodeMirror view missing");
  focusedStates.length = 0;
  return { wrapper, view };
}

describe("CodeEditor autofocus after the actual editable reconfiguration", () => {
  it("renders grammar highlighting through the same Lezer tag identities as the theme", async () => {
    const wrapper = render(
      <CodeEditor
        value={
          '/* editor contract */\n.editor { color: #123456; content: "parity"; }'
        }
        language="css"
        readonly
      />,
    );
    // The mounted view can precede CodeMirror's incremental parse work.
    // Observe the actual complete grammar/style result within the same budget.
    await waitFor(() => {
      expect(wrapper.container.querySelector(".cm-editor")).not.toBeNull();
      const spans = [
        ...wrapper.container.querySelectorAll(".cm-line span[class]"),
      ];
      expect(spans.map((element) => element.textContent)).toContain(
        "/* editor contract */",
      );
      const comment = spans.find(
        (element) => element.textContent === "/* editor contract */",
      );
      expect(comment).toBeDefined();
      expect(getComputedStyle(comment!).fontStyle).toBe("italic");
    });
  });

  it.each(["readonly", "disabled"] as const)(
    "focuses the same view only after %s is removed",
    async (reason) => {
      const { wrapper, view } = await mountedEditor({ [reason]: true });
      expect(view.state.readOnly).toBe(true);
      wrapper.rerender(<CodeEditor value="alpha beta" autoFocus />);
      await waitFor(() => expect(view.state.readOnly).toBe(false));
      expect(EditorView.findFromDOM(view.dom)).toBe(view);
      expect(focusedStates).toContain(false);
      expect(view.state.doc.toString()).toBe("alpha beta");
    },
  );

  it("does not request focus when editing is enabled without autofocus", async () => {
    const { wrapper, view } = await mountedEditor({ readonly: true });
    wrapper.rerender(<CodeEditor value="alpha beta" />);
    await waitFor(() => expect(view.state.readOnly).toBe(false));
    expect(focusedStates).toEqual([]);
  });

  it("retires an unfulfilled autofocus request when the caller withdraws it", async () => {
    const { wrapper, view } = await mountedEditor({
      readonly: true,
      autoFocus: true,
    });
    wrapper.rerender(<CodeEditor value="alpha beta" readonly />);
    expect(view.state.readOnly).toBe(true);
    wrapper.rerender(<CodeEditor value="alpha beta" />);
    await waitFor(() => expect(view.state.readOnly).toBe(false));
    expect(focusedStates).toEqual([]);
  });

  it("does not focus an editable state while a second lock remains", async () => {
    const { wrapper, view } = await mountedEditor({
      readonly: true,
      disabled: true,
    });
    wrapper.rerender(<CodeEditor value="alpha beta" disabled autoFocus />);
    expect(view.state.readOnly).toBe(true);
    expect(focusedStates).not.toContain(false);
    focusedStates.length = 0;
    wrapper.rerender(<CodeEditor value="alpha beta" autoFocus />);
    await waitFor(() => expect(view.state.readOnly).toBe(false));
    expect(focusedStates).toContain(false);
  });

  it("does not reclaim focus on later document or configuration updates", async () => {
    const { wrapper, view } = await mountedEditor({ readonly: true });
    wrapper.rerender(<CodeEditor value="alpha beta" autoFocus />);
    await waitFor(() => expect(view.state.readOnly).toBe(false));
    const outside = document.createElement("button");
    document.body.append(outside);
    try {
      outside.focus();
      focusedStates.length = 0;
      wrapper.rerender(
        <CodeEditor
          value="alpha beta gamma"
          autoFocus
          settings={{ lineNumbers: true }}
        />,
      );
      await waitFor(() =>
        expect(view.state.doc.toString()).toBe("alpha beta gamma"),
      );
      expect(focusedStates).toEqual([]);
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });

  it.each([true, false])(
    "does not reclaim focus after a save lock (initially readonly: %s)",
    async (readonly) => {
      const { wrapper, view } = await mountedEditor({ readonly });
      wrapper.rerender(<CodeEditor value="alpha beta" autoFocus />);
      await waitFor(() => expect(view.state.readOnly).toBe(false));
      wrapper.rerender(<CodeEditor value="alpha beta" disabled autoFocus />);
      await waitFor(() => expect(view.state.readOnly).toBe(true));
      const outside = document.createElement("button");
      document.body.append(outside);
      try {
        outside.focus();
        focusedStates.length = 0;
        wrapper.rerender(<CodeEditor value="alpha beta" autoFocus />);
        await waitFor(() => expect(view.state.readOnly).toBe(false));
        expect(focusedStates).toEqual([]);
        expect(document.activeElement).toBe(outside);
      } finally {
        outside.remove();
      }
    },
  );

  it("honors a new autofocus request for a later edit action", async () => {
    const { wrapper, view } = await mountedEditor({ readonly: true });
    wrapper.rerender(<CodeEditor value="alpha beta" autoFocus />);
    await waitFor(() => expect(view.state.readOnly).toBe(false));
    expect(focusedStates).toContain(false);
    wrapper.rerender(<CodeEditor value="alpha beta" readonly />);
    await waitFor(() => expect(view.state.readOnly).toBe(true));
    focusedStates.length = 0;
    wrapper.rerender(<CodeEditor value="alpha beta" autoFocus />);
    await waitFor(() => expect(view.state.readOnly).toBe(false));
    // The UIW autofocus effect still makes its original readonly attempt.
    // The owner fulfills exactly one request after the state becomes editable.
    expect(focusedStates.filter((readOnly) => !readOnly)).toEqual([false]);
  });
});
