/*
  【文件职责】     在任意宿主 DOM 上创建一个 CodeMirror 6 编辑器，并暴露框架无关的操作句柄。
  【架构位置】     L2
  【主要导出】     CodeEditorHandle · CodeEditorOptions · createCodeEditor
  【依赖关系】     @codemirror/{state,view,language,commands,search,autocomplete,lint} · @lezer/highlight · ./language · ./palette
  【边界与注意】   宿主必须动态 import 本模块，view/language/autocomplete 共享此平台边界，
                   state/highlight 与 commands/search/lint 保持并行命名导入，语法包再按语言单独加载。

                   语言、主题、只读三项都走 Compartment 而不是重建 EditorView：
                   重建会丢掉光标、选区和撤销历史——用户切一次主题就等于被
                   重置一次编辑状态。
*/

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
} from "@codemirror/view";

import type { CodeEditorLanguage } from "./language";
import { loadCodeEditorLanguage } from "./language";
import { CODE_EDITOR_PALETTES, codeEditorHighlightStyles } from "./palette";

export interface CodeEditorOptions {
  parent: HTMLElement;
  doc: string;
  language: CodeEditorLanguage;
  theme: "light" | "dark";
  readOnly: boolean;
  /** contenteditable 内容元素的可访问名字。CodeMirror 只给它 role="textbox"。 */
  contentLabel?: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export interface CodeEditorHandle {
  /** 外部写入。与当前文档相同时不产生事务，也不会回调 onChange。 */
  setDocument: (value: string) => void;
  setLanguage: (language: CodeEditorLanguage) => Promise<void>;
  setTheme: (theme: "light" | "dark") => void;
  setReadOnly: (readOnly: boolean) => void;
  focus: () => void;
  destroy: () => void;
}

export async function createCodeEditor(
  options: CodeEditorOptions,
): Promise<CodeEditorHandle> {
  // The host dynamically loads this owner and the platform shared by grammars.
  // State, highlight, and action systems retain parallel lazy boundaries;
  // language factories remain on-demand rather than joining initialization.
  const [
    { Annotation, Compartment, EditorState },
    { history, defaultKeymap, historyKeymap, indentWithTab },
    { tags },
    { highlightSelectionMatches, searchKeymap },
    { lintKeymap },
  ] = await Promise.all([
    import("@codemirror/state").then(
      ({ Annotation, Compartment, EditorState }) => ({
        Annotation,
        Compartment,
        EditorState,
      }),
    ),
    import("@codemirror/commands").then(
      ({ history, defaultKeymap, historyKeymap, indentWithTab }) => ({
        history,
        defaultKeymap,
        historyKeymap,
        indentWithTab,
      }),
    ),
    import("@lezer/highlight").then(({ tags }) => ({ tags })),
    import("@codemirror/search").then(
      ({ highlightSelectionMatches, searchKeymap }) => ({
        highlightSelectionMatches,
        searchKeymap,
      }),
    ),
    import("@codemirror/lint").then(({ lintKeymap }) => ({ lintKeymap })),
  ]);
  /*
    区分「用户敲的」和「父组件写回来的」。少了这条，父层每次把
    modelValue 同步进来都会被当成一次用户编辑再 emit 出去，
    v-model 变成自激回路。
  */
  const external = Annotation.define<boolean>();
  const languageCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();

  function appearance(theme: "light" | "dark") {
    const palette = CODE_EDITOR_PALETTES[theme];
    return [
      EditorView.theme(
        {
          "&": {
            height: "100%",
            backgroundColor: "transparent",
            color: palette.foreground,
            fontSize: "var(--text-sm)",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-scroller": { fontFamily: "monospace", lineHeight: "1.4" },
          ".cm-content": { padding: "4px 0", caretColor: palette.caret },
          ".cm-line": { padding: "0 8px" },
          ".cm-cursor, .cm-dropCursor": { borderLeftColor: palette.caret },
          "&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection":
            { background: `${palette.selection} !important` },
          ".cm-selectionMatch": { backgroundColor: palette.selectionMatch },
          ".cm-gutters": {
            backgroundColor: palette.gutterBackground,
            color: palette.gutterForeground,
          },
          ".cm-activeLine": { backgroundColor: palette.lineHighlight },
          ".cm-activeLineGutter": {
            backgroundColor: palette.lineHighlight,
            color: palette.gutterActiveForeground,
          },
        },
        { dark: theme === "dark" },
      ),
      syntaxHighlighting(
        HighlightStyle.define(codeEditorHighlightStyles(theme, tags)),
      ),
    ];
  }

  function readOnlyExtension(readOnly: boolean) {
    return [
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
    ];
  }

  const editor = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        // React's actual basicSetup consumer disables line numbers/fold gutter/active
        // line markers. Its other defaults stay enabled, including native search and
        // completion. Line wrapping is deliberately absent: long lines scroll.
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        highlightSelectionMatches(),
        /*
          Mod-s 必须排在默认按键表**前面**：默认表里没有 Mod-s，但浏览器有
          （「保存网页」）。不 preventDefault 就会在编辑器里触发浏览器的保存对话框。
        */
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              options.onSave();
              return true;
            },
          },
        ]),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
        ]),
        keymap.of([indentWithTab]),
        EditorView.contentAttributes.of(
          options.contentLabel ? { "aria-label": options.contentLabel } : {},
        ),
        languageCompartment.of([]),
        themeCompartment.of(appearance(options.theme)),
        readOnlyCompartment.of(readOnlyExtension(options.readOnly)),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (update.transactions.some((tr) => tr.annotation(external))) return;
          options.onChange(update.state.doc.toString());
        }),
      ],
    }),
  });

  let disposed = false;
  let languageRequest = 0;

  async function setLanguage(next: CodeEditorLanguage) {
    if (disposed) return;
    const request = ++languageRequest;
    const extensions = await loadCodeEditorLanguage(next);
    if (disposed || request !== languageRequest) return;
    editor.dispatch({
      effects: languageCompartment.reconfigure(extensions),
    });
  }

  try {
    await setLanguage(options.language);
  } catch (error) {
    // Initialization has not handed a handle to the host yet. The factory
    // still owns this view and must release it if grammar loading fails.
    disposed = true;
    languageRequest += 1;
    editor.destroy();
    throw error;
  }

  return {
    setDocument(value: string) {
      if (disposed || value === editor.state.doc.toString()) return;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
        annotations: external.of(true),
      });
    },
    setLanguage,
    setTheme(theme: "light" | "dark") {
      if (disposed) return;
      editor.dispatch({
        effects: themeCompartment.reconfigure(appearance(theme)),
      });
    },
    setReadOnly(readOnly: boolean) {
      if (disposed) return;
      editor.dispatch({
        effects: readOnlyCompartment.reconfigure(readOnlyExtension(readOnly)),
      });
    },
    focus() {
      if (!disposed) editor.focus();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      languageRequest += 1;
      editor.destroy();
    },
  };
}
