import type { BundledLanguage, ShikiTransformer } from "shiki";

const CACHE_LIMIT = 64;
const MAX_CACHED_CODE_LENGTH = 100_000;
const cache = new Map<string, Promise<string>>();
const lineNumbers: ShikiTransformer = {
  name: "line-numbers",
  line(node, line) {
    node.children.unshift({
      type: "element",
      tagName: "span",
      properties: {
        className: [
          "inline-block",
          "min-w-10",
          "mr-4",
          "text-right",
          "select-none",
          "text-muted-foreground",
        ],
      },
      children: [{ type: "text", value: String(line) }],
    });
  },
};

/** AI-elements code display; Markdown fences retain their separate Streamdown renderer. */
export async function highlightCode(
  code: string,
  language: BundledLanguage,
  showLineNumbers = false,
): Promise<string> {
  const render = async () => {
    const { codeToHtml } = await import("shiki");
    return await codeToHtml(code, {
      lang: language,
      themes: { light: "one-light", dark: "one-dark-pro" },
      defaultColor: "light",
      transformers: showLineNumbers ? [lineNumbers] : [],
    });
  };
  if (code.length > MAX_CACHED_CODE_LENGTH) return await render();
  const key = JSON.stringify([1, code, language, showLineNumbers]);
  const previous = cache.get(key);
  if (previous) {
    cache.delete(key);
    cache.set(key, previous);
    return await previous;
  }
  const pending = render();
  cache.set(key, pending);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  try {
    return await pending;
  } catch (error) {
    if (cache.get(key) === pending) cache.delete(key);
    throw error;
  }
}
