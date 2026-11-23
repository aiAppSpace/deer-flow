/*
  【文件职责】     可复用多面板 primitive 的公共导出入口。
  【架构位置】     L2
  【主要导出】     ResizablePanels、ResizablePanel、ResizableLayoutEvent
  【依赖关系】     同目录组件与类型。
  【边界与注意】   禁止依赖业务模块。
*/
export { default as ResizablePanels } from "./ResizablePanels.vue";
export type { ResizablePanel, ResizableLayoutEvent } from "./types";
