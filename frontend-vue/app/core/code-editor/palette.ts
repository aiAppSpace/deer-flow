/*
  【文件职责】     声明 React ArtifactEditor 实际消费的 basicLight/monokai 主题与完整语法样式。
  【架构位置】     L2
  【主要导出】     CodeEditorPalette · CODE_EDITOR_PALETTES · codeEditorHighlightStyles
  【依赖关系】     仅 CodeMirror/Lezer 类型；运行时由惰性 editor owner 传入 tags。
  【边界与注意】   对照 frontend/src/components/workspace/code-editor-extensions.ts 及
                   @uiw/codemirror-theme-{basic,monokai} 4.25.4 的实际 settings/styles。
                   保留上游样式顺序（重复 tag 的后项覆盖前项），不引入 React/UIW 适配层。
*/

import type { TagStyle } from "@codemirror/language";
import type { tags as highlightTags } from "@lezer/highlight";

export interface CodeEditorPalette {
  foreground: string;
  caret: string;
  selection: string;
  selectionMatch: string;
  gutterBackground: string;
  gutterForeground: string;
  gutterActiveForeground: string;
  lineHighlight: string;
}

export const CODE_EDITOR_PALETTES: Readonly<
  Record<"light" | "dark", CodeEditorPalette>
> = {
  light: {
    foreground: "#2e3440",
    caret: "#3b4252",
    selection: "#eceff4",
    selectionMatch: "#e5e9f0",
    gutterBackground: "#eceff4",
    gutterForeground: "#2e3440",
    gutterActiveForeground: "#2e3440",
    lineHighlight: "#02255f11",
  },
  dark: {
    foreground: "#f8f8f2",
    caret: "#f8f8f0",
    selection: "#4a4a76",
    selectionMatch: "#4a4a76",
    gutterBackground: "transparent",
    gutterForeground: "#555",
    gutterActiveForeground: "#fff",
    lineHighlight: "#3e3d3257",
  },
};

export function codeEditorHighlightStyles(
  theme: "light" | "dark",
  tags: typeof highlightTags,
): TagStyle[] {
  if (theme === "dark")
    return [
      { tag: tags.keyword, color: "#F92672" },
      {
        tag: [tags.name, tags.deleted, tags.character, tags.macroName],
        color: "#FD971F",
      },
      { tag: tags.propertyName, color: "#66D9EF" },
      {
        tag: [
          tags.processingInstruction,
          tags.string,
          tags.inserted,
          tags.special(tags.string),
        ],
        color: "#E6DB74",
      },
      {
        tag: [tags.function(tags.variableName), tags.labelName],
        color: "#66D9EF",
      },
      {
        tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
        color: "#AE81FF",
      },
      { tag: [tags.definition(tags.name), tags.separator], color: "#FD971F" },
      { tag: tags.className, color: "#A6E22E" },
      {
        tag: [
          tags.number,
          tags.changed,
          tags.annotation,
          tags.modifier,
          tags.self,
          tags.namespace,
        ],
        color: "#AE81FF",
      },
      // Upstream's type fontStyle is an invalid color value; browsers ignore it.
      { tag: tags.typeName, color: "#66D9EF" },
      { tag: [tags.operator, tags.operatorKeyword], color: "#F92672" },
      {
        tag: [tags.url, tags.escape, tags.regexp, tags.link],
        color: "#E6DB74",
      },
      { tag: [tags.meta, tags.comment], color: "#88846f" },
      { tag: tags.tagName, color: "#F92672" },
      { tag: tags.strong, fontWeight: "bold" },
      { tag: tags.emphasis, fontStyle: "italic" },
      { tag: tags.link, textDecoration: "underline" },
      { tag: tags.heading, fontWeight: "bold", color: "#A6E22E" },
      {
        tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
        color: "#FD971F",
      },
      { tag: tags.invalid, color: "#F44747" },
      { tag: tags.strikethrough, textDecoration: "line-through" },
    ];
  return [
    { tag: tags.keyword, color: "#5e81ac" },
    {
      tag: [
        tags.name,
        tags.deleted,
        tags.character,
        tags.propertyName,
        tags.macroName,
      ],
      color: "#d08770",
    },
    { tag: tags.variableName, color: "#d08770" },
    { tag: tags.function(tags.variableName), color: "#5e81ac" },
    { tag: tags.labelName, color: "#81a1c1" },
    {
      tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
      color: "#5e81ac",
    },
    { tag: [tags.definition(tags.name), tags.separator], color: "#a3be8c" },
    { tag: tags.brace, color: "#8fbcbb" },
    { tag: tags.annotation, color: "#d30102" },
    {
      tag: [
        tags.number,
        tags.changed,
        tags.annotation,
        tags.modifier,
        tags.self,
        tags.namespace,
      ],
      color: "#88c0d0",
    },
    { tag: [tags.typeName, tags.className], color: "#ebcb8b" },
    { tag: [tags.operator, tags.operatorKeyword], color: "#a3be8c" },
    { tag: tags.tagName, color: "#b48ead" },
    { tag: tags.squareBracket, color: "#bf616a" },
    { tag: tags.angleBracket, color: "#d08770" },
    { tag: tags.attributeName, color: "#ebcb8b" },
    { tag: tags.regexp, color: "#5e81ac" },
    { tag: tags.quote, color: "#3b4252" },
    { tag: tags.string, color: "#d08770" },
    {
      tag: tags.link,
      color: "#8fbcbb",
      textDecoration: "underline",
      textUnderlinePosition: "under",
    },
    {
      tag: [tags.url, tags.escape, tags.special(tags.string)],
      color: "#d08770",
    },
    { tag: tags.meta, color: "#88c0d0" },
    { tag: tags.comment, color: "#434c5e", fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "bold", color: "#5e81ac" },
    { tag: tags.emphasis, fontStyle: "italic", color: "#5e81ac" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.heading, fontWeight: "bold", color: "#5e81ac" },
    { tag: tags.special(tags.heading1), fontWeight: "bold", color: "#5e81ac" },
    { tag: tags.heading1, fontWeight: "bold", color: "#5e81ac" },
    {
      tag: [tags.heading2, tags.heading3, tags.heading4],
      fontWeight: "bold",
      color: "#5e81ac",
    },
    { tag: [tags.heading5, tags.heading6], color: "#5e81ac" },
    {
      tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
      color: "#d08770",
    },
    { tag: [tags.processingInstruction, tags.inserted], color: "#8fbcbb" },
    { tag: tags.contentSeparator, color: "#ebcb8b" },
    { tag: tags.invalid, color: "#434c5e", borderBottom: "1px dotted #d30102" },
  ];
}
