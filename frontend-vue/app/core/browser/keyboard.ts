/*
  【文件职责】     决定 browser panel keydown 是否进入远端 wire，并保留宿主快捷键与 IME。
  【架构位置】     L3
  【主要导出】     decideBrowserKeyInput · FORWARDED_BROWSER_NAMED_KEYS
  【依赖关系】     browser/protocol.ts
  【边界与注意】   返回 null 时调用方不得 preventDefault；keyup 永不重复发送 press。
*/

import type { BrowserInputEvent } from "./protocol";

export const FORWARDED_BROWSER_NAMED_KEYS = [
  "Enter",
  "Backspace",
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Escape",
  "Delete",
] as const;

export interface BrowserKeyContext {
  eventType: "keydown" | "keyup";
  live: boolean;
  editableTarget: boolean;
  composing: boolean;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function decideBrowserKeyInput(
  context: BrowserKeyContext,
): BrowserInputEvent | null {
  if (
    context.eventType !== "keydown" ||
    !context.live ||
    context.editableTarget ||
    context.composing
  )
    return null;
  if ((context.ctrlKey || context.metaKey) && context.key.length === 1)
    return {
      type: "key",
      key: `${context.metaKey ? "Meta" : "Control"}+${context.key.toUpperCase()}`,
    };
  if (context.key.length === 1 && !context.metaKey && !context.ctrlKey)
    return { type: "text", text: context.key };
  if ((FORWARDED_BROWSER_NAMED_KEYS as readonly string[]).includes(context.key))
    return { type: "key", key: context.key };
  return null;
}
