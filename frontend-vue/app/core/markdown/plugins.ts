/*
  【文件职责】     Markdown 管线的插件与预设：可搬的 rehype 插件、Streamdown 的内建插件等价物、
                   以及三套插件组合（默认 / 应用 / 带 raw HTML）。
  【架构位置】     L2 —— 通用渲染层，不认识任何 DeerFlow 业务概念
  【主要导出】     rehypeStreamingListItems · remarkHtmlToText · remarkCodeMeta ·
                   streamdownSanitizeSchema · hardenOptions · katexOptions ·
                   defaultRemarkPlugins / defaultRehypePlugins / appRemarkPlugins /
                   rawHtmlRehypePlugins · wordAnimation
  【依赖关系】     unist-util-visit · rehype-{raw,sanitize,harden,katex} · remark-{gfm,math}
  【边界与注意】   上游 `plugins.ts` 现在 269 行（合并 2026-09 上游后从 98 行涨上来），
                   其中**只有 `rehypeStreamingListItems` 是这里直接搬的**；其余
                   import 了 `@streamdown/code` / `@streamdown/mermaid` / `streamdown` 三个
                   React-only 包。它导出的 `streamdownWordAnimation` 等常量是**规格说明**
                   （Streamdown 自己的动画 API 参数），不是可搬代码——这里按规格重新给出，
                   消费方是本层自写的动画实现。

                   涨出来的那 171 行里有两个**框架无关**的 hast 插件，都已核实**不必搬**：
                   `rehypeScopedSlug` 在 sanitize 之前就给标题打上 `user-content-` 前缀，
                   于是 sanitize 会再加一次，`rehypeClobberFragments` 是用来擦掉那个双前缀的
                   ——本仓的 `rehypeHeadingSlugs`（下方）只写裸 slug，前缀交给 sanitize 统一加，
                   压根不产生双前缀，所以这两个一个有等价物、一个无对象。

                   `defaultRemarkPlugins` / `defaultRehypePlugins` 是 **Streamdown 2.5 内建
                   默认链的等价物**，从它 dist 里读出来后按同样的顺序、同样的选项重建：

                     rehype: [rehypeRaw, [rehypeSanitize, schema], [harden, {...}]]
                     remark: [[remarkGfm, {}], codeMeta]

                   ⚠️ **DeerFlow 的消息路径把这条默认链整条换掉了**（`markdown-content.tsx`
                   显式传 `remarkPlugins` / `rehypePlugins`，而 Streamdown 的语义是**替换**
                   而非追加）。也就是说线上消息渲染既没有 rehype-raw，也没有 sanitize 与
                   harden——raw HTML 走 `remarkHtmlToText` 变成转义文本，所以净化没有作用
                   对象。本文件如实反映这一点；要给消息路径加回 sanitize/harden 是
                   一次行为变更，不属于「照搬」。

                   KaTeX 排版插件**不在**本文件：它在 `math.ts` 里按内容动态加载，
                   理由和实测数字写在那边的文件头。
*/

import { harden } from "rehype-harden";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";

import type { Root as HastRoot } from "hast";
import type { Root as MdastRoot } from "mdast";
import type { PluggableList } from "unified";

/**
 * Keeps native list markers in step with the word reveal.
 *
 * A trailing `2.` or `-` is parsed as an empty list item while content is
 * streaming. Hide that transient item, then mark it for a matching marker
 * animation as soon as its first child arrives. Keep mid-list empty items in
 * the box tree so ordered-list counters never renumber later items.
 */
export function rehypeStreamingListItems() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "li") {
        return;
      }

      if (node.children.length === 0) {
        const isTrailingListItem =
          index !== undefined &&
          parent?.type === "element" &&
          (parent.tagName === "ol" || parent.tagName === "ul") &&
          !parent.children
            .slice(index + 1)
            .some(
              (sibling) =>
                sibling.type === "element" && sibling.tagName === "li",
            );
        if (isTrailingListItem) {
          node.properties.hidden = true;
        }
        return;
      }

      node.properties["data-streaming-list-item"] = "true";
    });
  };
}

/** GitHub-compatible heading ids for artifact outline links. */
export function rehypeHeadingSlugs() {
  return (tree: HastRoot) => {
    const occurrences = new Map<string, number>();
    visit(tree, "element", (node) => {
      if (!/^h[1-6]$/.test(node.tagName) || node.properties.id) return;
      const text = node.children
        .flatMap((child) => {
          if (child.type === "text") return [child.value];
          if (child.type !== "element") return [];
          const values: string[] = [];
          visit(child, "text", (textNode) => values.push(textNode.value));
          return values;
        })
        .join("");
      const base = text
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}\p{Mark}_ -]/gu, "")
        .replaceAll(" ", "-");
      const count = occurrences.get(base) ?? 0;
      occurrences.set(base, count + 1);
      node.properties.id = count === 0 ? base : `${base}-${count}`;
    });
  };
}

/**
 * 没有 rehype-raw 时，把 mdast 的 `html` 节点降级成文本。
 *
 * 不做这一步，`remark-rehype` 产出的 `raw` 节点会被渲染器直接丢弃——原始 HTML
 * 会**静默消失**而不是以转义文本出现。Streamdown 在「rehype 链里没有 rehype-raw」
 * 时自动挂这个插件，本层保持同样的条件（见 `pipeline.ts`）。
 */
export function remarkHtmlToText() {
  return (tree: MdastRoot) => {
    visit(tree, "html", (node, index, parent) => {
      if (!parent || typeof index !== "number") return;
      parent.children[index] = { type: "text", value: node.value };
    });
  };
}

/** 把围栏代码块的 meta 字符串带到 hast 的 `metastring` 属性上。 */
export function remarkCodeMeta() {
  return (tree: MdastRoot) => {
    visit(tree, "code", (node) => {
      if (!node.meta) return;
      node.data ??= {};
      node.data.hProperties = {
        ...(node.data.hProperties ?? {}),
        metastring: node.meta,
      };
    });
  };
}

/** `hast-util-sanitize` 默认 schema + `tel:` 协议 + `code[metastring]`。 */
export const streamdownSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "tel"],
  },
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "metastring"],
  },
};

/** Streamdown 内建 harden 的选项：全放行前缀，但保留 URL 归一化与阻断标记。 */
export const hardenOptions = {
  allowedImagePrefixes: ["*"],
  allowedLinkPrefixes: ["*"],
  allowedProtocols: ["*"],
  defaultOrigin: undefined,
  allowDataImages: true,
} as const;

/** KaTeX 选项（上游 `plugins.ts` 原值）。 */
export const katexOptions = {
  output: "html",
  throwOnError: false,
  strict: false,
} as const;

/** GFM / math 选项（上游 `plugins.ts` 原值）。 */
export const gfmOptions = { singleTilde: false } as const;
export const mathOptions = { singleDollarTextMath: true } as const;

/** Streamdown 内建默认 remark 链。 */
export const defaultRemarkPlugins: PluggableList = [
  [remarkGfm, {}],
  remarkCodeMeta,
];

/** Streamdown 内建默认 rehype 链。 */
export const defaultRehypePlugins: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, streamdownSanitizeSchema],
  [harden, hardenOptions],
];

/** DeerFlow 消息路径实际使用的 remark 链。 */
export const appRemarkPlugins: PluggableList = [
  [remarkGfm, gfmOptions],
  [remarkMath, mathOptions],
];

/**
 * `streamdownPlugins` 那一档：artifacts 预览路径需要 rehype-raw。
 *
 * KaTeX **不在**这里：它由 `math.ts` 在内容确实含公式时才动态加载。
 * 消息路径不需要额外 rehype 插件，所以没有对应的 `appRehypePlugins`。
 */
export const rawHtmlRehypePlugins: PluggableList = [rehypeRaw];

/**
 * 逐词动画参数。
 *
 * 上游把它写成 Streamdown 的 `animated` prop 值；本层没有那个 API，所以这里
 * 是自写动画实现的输入。`stagger: 0` 的理由原样保留：Streamdown 默认每个新词
 * 延迟 40ms，一个大 chunk 会把靠后的列表项文本推迟数秒，而它的原生标记早已可见。
 */
export const wordAnimation = {
  animation: "fadeIn",
  duration: 200,
  sep: "word",
  stagger: 0,
} as const;
