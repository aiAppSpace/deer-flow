/*
  【文件职责】     把任意语言名归一到编辑器支持的 7 个模式，并按需动态加载对应语法。
  【架构位置】     L2
  【主要导出】     CodeEditorLanguage · normalizeCodeEditorLanguage · loadCodeEditorLanguage
  【边界与注意】   归一规则是纯函数，必须能脱离 CodeMirror 单独求值：它决定了
                   「这个文件用哪套语法」，而语法包只在真正需要时才进网络。
                   新增模式必须同时进 CodeEditorLanguage、归一表和加载分支，
                   三者缺一就会出现「归一到一个加载不出来的模式」。
*/

import type { Extension } from "@codemirror/state";

export type CodeEditorLanguage =
  "css" | "html" | "javascript" | "json" | "markdown" | "python" | "text";

/**
 * 归一到 6 个语法模式 + 纯文本兜底。
 *
 * 兜底是 `text` 而不是抛错：artifact 的语言来自
 * `core/artifacts/policy.ts` 的扩展名表，它认识 bash/go/rust/yaml 等
 * 这里没有语法包的语言。它们必须仍然能打开编辑器，只是没有高亮。
 */
export function normalizeCodeEditorLanguage(
  language: string | null | undefined,
): CodeEditorLanguage {
  switch (language?.toLowerCase()) {
    case "css":
    case "scss":
    case "sass":
    case "less":
      return "css";
    case "html":
    case "xml":
      return "html";
    case "javascript":
    case "typescript":
    case "jsx":
    case "tsx":
      return "javascript";
    case "json":
    case "jsonc":
    case "json5":
      return "json";
    case "markdown":
    case "mdx":
      return "markdown";
    case "python":
    case "py":
      return "python";
    default:
      return "text";
  }
}

/**
 * 语法包一律动态 import。它们是整个编辑器里最大的一块，而任何一次会话
 * 通常只打开一两种语言——静态 import 会把 6 份语法都塞进首屏包。
 */
export async function loadCodeEditorLanguage(
  language: CodeEditorLanguage,
): Promise<Extension[]> {
  switch (language) {
    case "css":
      return import("@codemirror/lang-css").then(({ css }) => [css()]);
    case "html":
      return import("@codemirror/lang-html").then(({ html }) => [html()]);
    case "javascript":
      return import("@codemirror/lang-javascript").then(({ javascript }) => [
        javascript(),
      ]);
    case "json":
      return import("@codemirror/lang-json").then(({ json }) => [json()]);
    case "markdown": {
      const { markdown, markdownLanguage } =
        await import("@codemirror/lang-markdown");
      return [markdown({ base: markdownLanguage })];
    }
    case "python":
      return import("@codemirror/lang-python").then(({ python }) => [python()]);
    case "text":
      return [];
  }
}
