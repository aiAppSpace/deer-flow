/*
  【文件职责】     建议 chip 的类串——**全仓唯一出处**。
  【架构位置】     L2
  【主要导出】     SUGGESTION_CHIP_CLASS
  【依赖关系】     无
  【边界与注意】   逐字照上游 `ai-elements/suggestion.tsx` 的 `Suggestion`。
                   此前欢迎态（`WelcomeSuggestionList.vue`）与追问行（`AgentChat.vue`）
                   **各抄了一份**，上游改一个 token 就要改两处、漏一处不会红。
*/

export const SUGGESTION_CHIP_CLASS =
  "text-muted-foreground dark:bg-background h-auto max-w-full cursor-pointer rounded-full px-4 py-2 text-center text-xs font-normal whitespace-normal";
