/*
  【文件职责】     建议 chip 逐个淡入的错峰常数与延时算法。
  【架构位置】     L2
  【主要导出】     SUGGESTION_STAGGER_MS · SUGGESTION_STAGGER_OFFSET_MS ·
                   suggestionEntranceDelay
  【依赖关系】     无
  【边界与注意】   常数逐字照上游 `ai-elements/suggestion.tsx`
                   （`STAGGER_DELAY_MS = 60`、`STAGGER_DELAY_MS_OFFSET = 250`）。

                   **单独成文件而不是塞进 `Suggestions.vue`**：上游用 `Children.map`
                   在包装层里发延时，Vue 里那件事只能在调用点做（见 Suggestions.vue
                   的文件头），而调用点有两处——常数留在包装层就会被抄第二遍，
                   那正是这一轮在还的债。
*/

export const SUGGESTION_STAGGER_MS = 60;
export const SUGGESTION_STAGGER_OFFSET_MS = 250;

/** 第 `index` 颗 chip 的 `animation-delay`，从 0 开始数。 */
export function suggestionEntranceDelay(index: number): string {
  return `${SUGGESTION_STAGGER_OFFSET_MS + index * SUGGESTION_STAGGER_MS}ms`;
}
