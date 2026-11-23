/*
  【文件职责】     M3 归一化 DOM 等价 gate 的语料。React 侧与 Vue 侧读同一份，避免各写各的。
  【架构位置】     测试夹具
  【主要导出】     CORPUS、PRESETS
  【依赖关系】     被 scripts/record-react-markdown.mjs（在 frontend/ 里跑 React）与
                   tests/unit/markdown/dom-equivalence.dom.test.ts 同时消费
  【边界与注意】   写成 `.mjs` 而不是 `.ts`：录制脚本要在 **frontend/** 的 node_modules 里
                   用裸 node 跑 React SSR，那里没有 TS 运行时。

                   语料只放**两侧都确定**的构造：mermaid 的 SVG、shiki 的高亮 token 都要等
                   浏览器侧异步任务，SSR 拿到的是未高亮的回退结构——回退结构本身是有效契约，
                   高亮后的 DOM 不是这个 gate 能回答的问题（写在证据文档的红项里）。
*/

/** DeerFlow 消息路径实际用的插件组合（markdown-content.tsx）。 */
export const PRESET_APP = "app";
/** `streamdownPlugins`：同上再加 rehype-raw（artifacts 预览路径用）。 */
export const PRESET_RAW = "raw";
/** Streamdown 自己的默认链：raw + sanitize + harden，remark 侧 gfm + codeMeta。 */
export const PRESET_DEFAULT = "default";

export const PRESETS = [PRESET_APP, PRESET_RAW, PRESET_DEFAULT];

/**
 * @typedef {object} CorpusEntry
 * @property {string} id
 * @property {string} preset
 * @property {string} markdown
 * @property {boolean} [streaming]   挂上 rehypeStreamingListItems（React 侧同步挂）
 * @property {boolean} [incomplete]  打开 parseIncompleteMarkdown（remend 自愈）
 */

/** @type {CorpusEntry[]} */
export const CORPUS = [
  {
    id: "headings",
    preset: PRESET_APP,
    markdown: [
      "# h1",
      "## h2",
      "### h3",
      "#### h4",
      "##### h5",
      "###### h6",
    ].join("\n\n"),
  },
  {
    id: "inline-marks",
    preset: PRESET_APP,
    markdown:
      "Plain **bold**, _em_, ~~strike~~, `inline code`, and a hard  \nbreak.",
  },
  {
    id: "lists",
    preset: PRESET_APP,
    markdown: [
      "- alpha",
      "- beta",
      "  - nested",
      "",
      "1. one",
      "2. two",
      "",
      "- [ ] todo",
      "- [x] done",
    ].join("\n"),
  },
  {
    id: "table",
    preset: PRESET_APP,
    markdown: [
      "| left | center | right |",
      "| :--- | :----: | ----: |",
      "| a    |   b    |     c |",
    ].join("\n"),
  },
  {
    id: "blockquote-hr",
    preset: PRESET_APP,
    markdown: ["> quoted", ">", "> > nested", "", "---"].join("\n"),
  },
  {
    id: "code-block",
    preset: PRESET_APP,
    markdown: ["```ts", "const x: number = 1;", "```"].join("\n"),
  },
  {
    id: "code-block-no-language",
    preset: PRESET_APP,
    markdown: ["```", "plain text", "```"].join("\n"),
  },
  {
    id: "mermaid-block",
    preset: PRESET_APP,
    markdown: ["```mermaid", "graph TD; A-->B;", "```"].join("\n"),
  },
  {
    id: "math",
    preset: PRESET_APP,
    markdown: "Inline $a^2 + b^2 = c^2$ and display:\n\n$$\\frac{1}{2}$$",
  },
  {
    id: "math-renderer-layout",
    preset: PRESET_APP,
    markdown:
      "Integral $\\int_0^1 x^2 dx$ and $\\underbrace{a+b}_{c}$.\n\n$$\\int_0^1 x^2 dx$$\n\n$$\\underbrace{a+b}_{c}$$",
  },
  {
    id: "math-renderer-matrix-and-errors",
    preset: PRESET_APP,
    markdown:
      "Matrix $\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$ and $\\color{red}{x}$; untrusted $\\href{javascript:alert(1)}{link}$; invalid $\\unknowncommand{x}$.",
  },
  {
    id: "links-and-images",
    preset: PRESET_APP,
    markdown: [
      "[external](https://example.com/page?q=1#frag)",
      "",
      "[relative](/workspace/chats/abc)",
      "",
      "![alt text](https://example.com/a.png)",
    ].join("\n"),
  },
  {
    id: "raw-html-escaped",
    preset: PRESET_APP,
    markdown: '<div class="raw">raw html</div>\n\nafter',
  },
  {
    id: "raw-html-parsed",
    preset: PRESET_RAW,
    markdown: '<div class="raw"><span>raw html</span></div>\n\nafter',
  },
  {
    id: "default-pipeline-sanitized",
    preset: PRESET_DEFAULT,
    markdown: [
      '<div class="raw" onclick="alert(1)">kept text</div>',
      "",
      "<script>alert(2)</script>",
      "",
      "[js link](javascript:alert(3))",
    ].join("\n"),
  },
  {
    id: "streaming-trailing-list-item",
    preset: PRESET_APP,
    streaming: true,
    markdown: ["1. one", "2. two", "3. "].join("\n"),
  },
  {
    id: "incomplete-emphasis",
    preset: PRESET_APP,
    incomplete: true,
    markdown: "a paragraph with **unfinished bold",
  },
  {
    id: "footnotes",
    preset: PRESET_APP,
    markdown: ["text[^1]", "", "[^1]: the note"].join("\n"),
  },
];
