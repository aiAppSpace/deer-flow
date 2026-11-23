/*
  【文件职责】     给客户端 chunk 按真实模块来源命名，供构建产物预算分类。
  【架构位置】     Nuxt 构建配置
  【主要导出】     clientChunkFileName · ClientChunk
  【依赖关系】     nuxt.config.ts 的 vite:extendConfig
  【边界与注意】   桶名只代表 chunk 的依赖种子，不等同于该包独占的字节。
*/

export type ClientChunk = { moduleIds: string[]; name: string };

export function clientChunkFileName(chunk: ClientChunk) {
  const ids = chunk.moduleIds.join("\n");
  /*
    CodeMirror 必须排在 markdown 之前。`@codemirror/lang-markdown` 依赖
    `@lezer/markdown`，它的路径里带着字面量 `/markdown/`——按原来的顺序，
    整个语法高亮 chunk 会被命名成 vendor-markdown，同时污染两边的预算。
  */
  if (/(?:codemirror|@codemirror)/.test(ids)) {
    return "_nuxt/vendor-codemirror-[hash].js";
  }
  if (
    /(?:StreamMarkdown|\/markdown\/|node_modules\/.+\/(?:hast|mdast|unified|unist-util|remark-|rehype-|marked|remend|katex))/.test(
      ids,
    )
  ) {
    return "_nuxt/vendor-markdown-[hash].js";
  }
  if (/\/app\/core\/i18n\//.test(ids)) {
    return "_nuxt/vendor-i18n-[hash].js";
  }
  /*
    **只认实际 reka-ui 包边界。** 分栏控件现为本仓 Vue primitive，不再以已移除的
    splitpanes 作为依赖种子。这个函数按「chunk 里**任意一个**模块 id 命中」
    贴标签，所以桶的种子选得越常见，标签就越不像话：原来这里还写着
    `lucide-vue-next|class-variance-authority|clsx|tailwind-merge`，
    而那四个几乎每个组件都 import——于是任何一个产品 chunk 只要碰过一个图标，
    就被叫成 `vendor-ui`。

    wave 66 实测（改之前）：`vendor-ui` 24 个 chunk 共 728,591 raw，
    而**最大的两个（320 KB / 192 KB）连一个 reka / lucide / cva / clsx 标记都没有**，
    全是产品代码。于是 `make asset-budget` 长期红着，而红的原因（728 KB > 380 KB）
    和它注释里写的原因（「Reka 的 dialog/dropdown 加 Select、Tabs、Switch……」）
    根本不是一回事——**一个测错了东西的门禁，比没有门禁更糟，因为它让人以为有东西在守。**

    去掉那四个之后，它们的字节落回默认命名（按 chunk 自己的名字），
    仍然计进整包天花板，只是不再冒充 UI 基础层。
    `tests/guards/chunk-buckets.test.ts` 钉住命名桶与预算的一一对应；
    `tests/unit/tooling/client-chunk-file-name.test.ts` 验证真实包路径的归属。
  */
  if (/node_modules\/reka-ui\//.test(ids)) {
    return "_nuxt/vendor-ui-[hash].js";
  }
  // Match the installed package boundary, not Shiki grammars named vue*.mjs.
  if (
    /node_modules\/(?:@vue\/[^/]+|vue|vue-router|@tanstack\/vue-query)\//.test(
      ids,
    )
  ) {
    return "_nuxt/vendor-vue-[hash].js";
  }
  return `_nuxt/${chunk.name}-[hash].js`;
}
