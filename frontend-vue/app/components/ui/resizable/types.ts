/*
  【文件职责】     可复用面板约束与用户尺寸事件的公共类型。
  【架构位置】     L2
  【主要导出】     ResizablePanel、ResizableLayoutEvent
  【依赖关系】     Vue HTMLAttributes 与浏览器事件类型。
  【边界与注意】   不携带产品身份或持久化策略。
*/
import type { HTMLAttributes } from "vue";

export interface ResizablePanel {
  id: string;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  collapsedSize?: number;
  class?: HTMLAttributes["class"];
}

export interface ResizableLayoutEvent {
  event: PointerEvent | KeyboardEvent;
  panes: { id: string; size: number }[];
}
