/*
  【文件职责】     构造分隔符预览 Worker。
  【架构位置】     L3
  【主要导出】     createDelimitedPreviewWorker
  【依赖关系】     ./delimited-preview.worker.ts（构建期由 Vite 静态解析）
  【边界与注意】   这个文件存在的唯一理由是 `new URL(..., import.meta.url)` 里
                   **必须写相对路径字面量**——Vite 靠静态分析这一处来把 worker
                   单独打一个 chunk，写成 `@/…` alias 或拼出来的字符串都会让它
                   分析不到，开发环境侥幸能跑、生产构建 404。
                   所以工厂和 worker 放同一个目录，路径短到不会有人想改它。
*/

export function createDelimitedPreviewWorker(): Worker {
  return new Worker(new URL("./delimited-preview.worker.ts", import.meta.url), {
    type: "module",
  });
}
