import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection, EditorState, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { highlightingFor } from "@codemirror/language";
import { tags, type Tag } from "@lezer/highlight";
import {
  acceptCompletion,
  completionStatus,
  startCompletion,
} from "@codemirror/autocomplete";
import { CodeEditor } from "@/components/ui/code-editor";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

async function editor(props: Record<string, unknown> = {}) {
  document.documentElement.style.setProperty("--text-sm", "14px");
  const wrapper = mount(CodeEditor, {
    attachTo: document.body,
    props: { modelValue: "", ...props },
  });
  cleanups.push(() => wrapper.unmount());
  await expect
    .poll(() => !!EditorView.findFromDOM(wrapper.element as HTMLElement))
    .toBe(true);
  const view = EditorView.findFromDOM(wrapper.element as HTMLElement);
  if (!view) throw new Error("editor was not created");
  return { wrapper, view };
}

function press(
  view: EditorView,
  key: string,
  modifiers: KeyboardEventInit = {},
) {
  const keyCode =
    key === "Tab"
      ? 9
      : key === "Backspace"
        ? 8
        : key.toUpperCase().charCodeAt(0);
  const event = new KeyboardEvent("keydown", {
    key,
    keyCode,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  view.contentDOM.dispatchEvent(event);
  return event;
}

// Reference values are the actual React ArtifactEditor consumer's basicLight/monokai
// settings, rather than importing the Vue palette as its own oracle.
describe("actual artifact CodeMirror presentation and native editing", () => {
  it.each(["light", "dark"] as const)(
    "uses the React %s content, cursor and non-wrapping geometry",
    async (theme) => {
      const { view } = await editor({
        modelValue: "const a = 'long '.repeat(100)",
        language: "javascript",
        theme,
      });
      const root = getComputedStyle(view.dom);
      const content = getComputedStyle(view.contentDOM);
      const scroller = getComputedStyle(view.scrollDOM);
      const line = view.contentDOM.querySelector(".cm-line");
      if (!line) throw new Error("missing real document line");
      expect(root.fontSize).toBe("14px");
      expect(root.color).toBe(theme === "light" ? "#2e3440" : "#f8f8f2");
      expect(scroller.fontFamily).toBe("monospace");
      expect(scroller.lineHeight).toBe("1.4");
      expect(content.paddingTop).toBe("4px");
      expect(content.paddingBottom).toBe("4px");
      expect(content.paddingLeft).toBe("0px");
      expect(content.whiteSpace).toBe("pre");
      expect(getComputedStyle(line).paddingLeft).toBe("8px");
      expect(getComputedStyle(line).paddingRight).toBe("8px");
      // drawSelection hides the browser caret; the actual drawn cursor owns color.
      expect(content.caretColor).toBe("transparent");
      const cursor = document.createElement("div");
      cursor.className = "cm-cursor";
      view.dom.append(cursor);
      expect(getComputedStyle(cursor).borderLeftColor).toBe(
        theme === "light" ? "#3b4252" : "#f8f8f0",
      );
      cursor.remove();
      expect(view.lineWrapping).toBe(false);
      expect(view.dom.querySelector(".cm-gutters")).toBeNull();
      expect(view.dom.querySelector(".cm-activeLine")).toBeNull();
    },
  );

  it("keeps selection and undo history while reconfiguring the actual theme", async () => {
    const { wrapper, view } = await editor({
      modelValue: "value = 1",
      language: "python",
    });
    view.dispatch({
      changes: { from: 9, insert: "0" },
      selection: { anchor: 3 },
    });
    await wrapper.setProps({ theme: "dark" });
    await flushPromises();
    expect(EditorView.findFromDOM(wrapper.element as HTMLElement)).toBe(view);
    expect(view.state.selection.main.anchor).toBe(3);
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("value = 1");
  });

  it("opens native search without browser find, searches the actual document and closes on Escape", async () => {
    const { view } = await editor({ modelValue: "alpha beta alpha" });
    const mod = /Mac/.test(navigator.platform)
      ? { metaKey: true }
      : { ctrlKey: true };
    expect(press(view, "f", mod).defaultPrevented).toBe(true);
    const input = view.dom.querySelector<HTMLInputElement>(
      ".cm-search input[name=search]",
    );
    expect(input).not.toBeNull();
    if (!input) throw new Error("native search panel missing");
    input.value = "beta";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(
      view.state.sliceDoc(
        view.state.selection.main.from,
        view.state.selection.main.to,
      ),
    ).toBe("beta");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(view.dom.querySelector(".cm-search")).toBeNull();
  });

  it("indents and unindents selected lines through native Tab and preserves readonly", async () => {
    const { wrapper, view } = await editor({ modelValue: "a\nb" });
    view.dispatch({ selection: { anchor: 0, head: 3 } });
    expect(press(view, "Tab").defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe("  a\n  b");
    expect(press(view, "Tab", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe("a\nb");
    await wrapper.setProps({ readonly: true });
    press(view, "Tab");
    expect(view.state.doc.toString()).toBe("a\nb");
  });

  it("closes brackets through the installed input handler and deletes paired brackets via Backspace", async () => {
    const { view } = await editor();
    // Exercise CM's real input handlers, with only browser DOM text ingestion omitted.
    const handled = view.state
      .facet(EditorView.inputHandler)
      .some((handler) =>
        handler(view, 0, 0, "(", () =>
          view.state.update({ changes: { from: 0, insert: "(" } }),
        ),
      );
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe("()");
    expect(view.state.selection.main.anchor).toBe(1);
    expect(press(view, "Backspace").defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe("");
  });

  it("shows and accepts actual completion from language data", async () => {
    const { view } = await editor({ modelValue: "al" });
    const source = () => ({ from: 0, options: [{ label: "alpha" }] });
    view.dispatch({
      selection: { anchor: 2 },
      effects: StateEffect.appendConfig.of(
        EditorState.languageData.of(() => [{ autocomplete: source }]),
      ),
    });
    expect(startCompletion(view)).toBe(true);
    await expect.poll(() => completionStatus(view.state)).toBe("active");
    expect(view.dom.querySelector(".cm-tooltip-autocomplete")).not.toBeNull();
    // CM intentionally rejects acceptance during its interaction delay. Wait
    // for that real admission boundary rather than overriding its config.
    await expect.poll(() => acceptCompletion(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("alpha");
  });

  it("supports actual multiple selections and highlights special characters", async () => {
    const { view } = await editor({ modelValue: "a\u0000b" });
    view.dispatch({
      selection: EditorSelection.create([
        EditorSelection.cursor(0),
        EditorSelection.cursor(3),
      ]),
    });
    expect(view.state.selection.ranges).toHaveLength(2);
    expect(view.dom.querySelector(".cm-specialChar")).not.toBeNull();
  });
});

const syntaxCases: {
  name: string;
  tag: Tag;
  light?: string;
  dark?: string;
  lightStyle?: Partial<CSSStyleDeclaration>;
  darkStyle?: Partial<CSSStyleDeclaration>;
}[] = [
  { name: "keyword", tag: tags.keyword, light: "#5e81ac", dark: "#f92672" },
  {
    name: "variable",
    tag: tags.variableName,
    light: "#d08770",
    dark: "#fd971f",
  },
  ...[tags.name, tags.deleted, tags.character, tags.macroName].map(
    (tag, index) => ({
      name: `name-family-${index}`,
      tag,
      light: "#d08770",
      dark: "#fd971f",
    }),
  ),
  {
    name: "property",
    tag: tags.propertyName,
    light: "#d08770",
    dark: "#66d9ef",
  },
  {
    name: "function",
    tag: tags.function(tags.variableName),
    light: "#5e81ac",
    dark: "#66d9ef",
  },
  { name: "label", tag: tags.labelName, light: "#81a1c1", dark: "#66d9ef" },
  {
    name: "constant",
    tag: tags.constant(tags.name),
    light: "#5e81ac",
    dark: "#ae81ff",
  },
  ...[tags.color, tags.standard(tags.name)].map((tag, index) => ({
    name: `constant-family-${index}`,
    tag,
    light: "#5e81ac",
    dark: "#ae81ff",
  })),
  {
    name: "definition",
    tag: tags.definition(tags.name),
    light: "#a3be8c",
    dark: "#fd971f",
  },
  {
    name: "separator-token",
    tag: tags.separator,
    light: "#a3be8c",
    dark: "#fd971f",
  },
  { name: "brace", tag: tags.brace, light: "#8fbcbb" },
  {
    name: "annotation",
    tag: tags.annotation,
    light: "#88c0d0",
    dark: "#ae81ff",
  },
  { name: "number", tag: tags.number, light: "#88c0d0", dark: "#ae81ff" },
  ...[tags.changed, tags.modifier, tags.self, tags.namespace].map(
    (tag, index) => ({
      name: `number-family-${index}`,
      tag,
      light: "#88c0d0",
      dark: "#ae81ff",
    }),
  ),
  { name: "type", tag: tags.typeName, light: "#ebcb8b", dark: "#66d9ef" },
  { name: "class", tag: tags.className, light: "#ebcb8b", dark: "#a6e22e" },
  { name: "operator", tag: tags.operator, light: "#a3be8c", dark: "#f92672" },
  {
    name: "operator-keyword",
    tag: tags.operatorKeyword,
    light: "#a3be8c",
    dark: "#f92672",
  },
  { name: "tag", tag: tags.tagName, light: "#b48ead", dark: "#f92672" },
  { name: "square", tag: tags.squareBracket, light: "#bf616a" },
  { name: "angle", tag: tags.angleBracket, light: "#d08770" },
  { name: "attribute", tag: tags.attributeName, light: "#ebcb8b" },
  { name: "regexp", tag: tags.regexp, light: "#5e81ac", dark: "#e6db74" },
  { name: "quote", tag: tags.quote, light: "#3b4252" },
  { name: "string", tag: tags.string, light: "#d08770", dark: "#e6db74" },
  {
    name: "special-string",
    tag: tags.special(tags.string),
    light: "#d08770",
    dark: "#e6db74",
  },
  {
    name: "link",
    tag: tags.link,
    light: "#8fbcbb",
    dark: "#f8f8f2",
    lightStyle: { textDecoration: "underline", textUnderlinePosition: "under" },
    darkStyle: { textDecoration: "underline" },
  },
  { name: "url", tag: tags.url, light: "#d08770", dark: "#e6db74" },
  { name: "escape", tag: tags.escape, light: "#d08770", dark: "#e6db74" },
  { name: "meta", tag: tags.meta, light: "#88c0d0", dark: "#88846f" },
  {
    name: "comment",
    tag: tags.comment,
    light: "#434c5e",
    dark: "#88846f",
    lightStyle: { fontStyle: "italic" },
  },
  {
    name: "strong",
    tag: tags.strong,
    light: "#5e81ac",
    lightStyle: { fontWeight: "bold" },
    darkStyle: { fontWeight: "bold" },
  },
  {
    name: "emphasis",
    tag: tags.emphasis,
    light: "#5e81ac",
    lightStyle: { fontStyle: "italic" },
    darkStyle: { fontStyle: "italic" },
  },
  {
    name: "strikethrough",
    tag: tags.strikethrough,
    lightStyle: { textDecoration: "line-through" },
    darkStyle: { textDecoration: "line-through" },
  },
  {
    name: "heading",
    tag: tags.heading,
    light: "#5e81ac",
    dark: "#a6e22e",
    lightStyle: { fontWeight: "bold" },
    darkStyle: { fontWeight: "bold" },
  },
  ...[
    tags.heading1,
    tags.heading2,
    tags.heading3,
    tags.heading4,
    tags.heading5,
    tags.heading6,
    tags.special(tags.heading1),
  ].map((tag, index) => ({
    name: `heading-family-${index}`,
    tag,
    light: "#5e81ac",
    dark: "#a6e22e",
  })),
  { name: "bool", tag: tags.bool, light: "#d08770", dark: "#fd971f" },
  ...[tags.atom, tags.special(tags.variableName)].map((tag, index) => ({
    name: `atom-family-${index}`,
    tag,
    light: "#d08770",
    dark: "#fd971f",
  })),
  {
    name: "instruction",
    tag: tags.processingInstruction,
    light: "#8fbcbb",
    dark: "#e6db74",
  },
  { name: "inserted", tag: tags.inserted, light: "#8fbcbb", dark: "#e6db74" },
  { name: "separator", tag: tags.contentSeparator, light: "#ebcb8b" },
  {
    name: "invalid",
    tag: tags.invalid,
    light: "#434c5e",
    dark: "#f44747",
    lightStyle: { borderBottom: "1px dotted #d30102" },
  },
];

describe.each(["light", "dark"] as const)(
  "%s full upstream syntax contract",
  (theme) => {
    it("renders actual configured highlight classes with the reference colors and decorations", async () => {
      const { view } = await editor({ theme });
      for (const sample of syntaxCases) {
        const expectedColor = sample[theme];
        const expectedStyle =
          sample[theme === "light" ? "lightStyle" : "darkStyle"];
        if (!expectedColor && !expectedStyle) continue;
        const classes = highlightingFor(view.state, [sample.tag]);
        expect(classes, sample.name).not.toBeNull();
        const span = document.createElement("span");
        span.className = classes ?? "";
        span.textContent = sample.name;
        view.contentDOM.append(span);
        const style = getComputedStyle(span);
        if (expectedColor)
          expect(style.color.toLowerCase(), sample.name).toBe(expectedColor);
        if (expectedStyle)
          for (const [key, value] of Object.entries(expectedStyle))
            expect(
              style.getPropertyValue(
                key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
              ),
              `${sample.name}.${key}`,
            ).toBe(value);
        span.remove();
      }
    });
  },
);
