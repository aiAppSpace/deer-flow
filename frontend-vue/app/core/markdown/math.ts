/**
 * 【架构位置】 L2 reusable Markdown grammar and optional renderer loading.
 * Detect math with the same grammar used by the rendered message. Successful
 * loads are shared; a failed load is released so later content can retry.
 */
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified, type Pluggable } from "unified";
import { EXIT, visit } from "unist-util-visit";

import { katexOptions, mathOptions } from "./plugins";

const parser = unified().use(remarkParse).use(remarkMath, mathOptions);

export function containsMath(source: string): boolean {
  if (!source.includes("$")) return false;
  let found = false;
  visit(parser.parse(source), ["math", "inlineMath"], () => {
    found = true;
    return EXIT;
  });
  return found;
}

let pending: Promise<Pluggable> | null = null;

/** 加载一次就复用：同一个会话里第二条公式不该再等一次网络。 */
export function loadKatexRehypePlugin(): Promise<Pluggable> {
  pending ??= Promise.all([
    import("rehype-katex"),
    import("katex/dist/katex.min.css"),
  ])
    .then(([module]) => [module.default, katexOptions] as Pluggable)
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
