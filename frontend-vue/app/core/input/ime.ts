/*
  【文件职责】     归一化 composition、isComposing 与 Safari keyCode 229 判定。
  【架构位置】     L3 input adapter
  【主要导出】     ImeKeyboardEvent · isImeComposing
  【依赖关系】     browser KeyboardEvent shape
  【边界与注意】   M7 输入保护；当前未列入冻结 L2 公共集合。
*/

export type ImeKeyboardEvent = Pick<KeyboardEvent, "isComposing" | "keyCode">;

/** Safari can report keyCode 229 after composition state changes. */
export function isImeComposing(
  event: ImeKeyboardEvent,
  compositionActive = false,
): boolean {
  return compositionActive || event.isComposing || event.keyCode === 229;
}

export const COMPOSITION_CONFIRM_ENTER_MS = 50;

/** Safari may report the composition-confirming Enter after compositionend. */
export function isCompositionConfirmEnter(
  event: ImeKeyboardEvent & Pick<KeyboardEvent, "key" | "shiftKey">,
  compositionEndedAt: number,
  now = Date.now(),
): boolean {
  if (event.key !== "Enter" || event.shiftKey || isImeComposing(event))
    return false;
  const elapsed = now - compositionEndedAt;
  return elapsed >= 0 && elapsed < COMPOSITION_CONFIRM_ENTER_MS;
}
