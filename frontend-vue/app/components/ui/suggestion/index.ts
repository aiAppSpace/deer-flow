/*
  【文件职责】     暴露建议 chip 一族。
  【架构位置】     L2
  【主要导出】     Suggestions / Suggestion · SUGGESTION_CHIP_CLASS ·
                   suggestionEntranceDelay 与它的两个常数
  【依赖关系】     被 ChatComposer 的欢迎态与 AgentChat 的追问行导入
  【边界与注意】   对位上游 `components/ai-elements/suggestion.tsx`。
                   本仓把上游 `ai-elements/*` 映射进已有的分层目录
                   （`markdown/*` 就是这么来的），不另开一个平行的 `ai-elements/`。

                   `SUGGESTION_CHIP_CLASS` 单独导出，是因为并非每一颗 chip 都是
                   `Suggestion`——欢迎态那一排里有一颗 `ConfettiButton`、
                   还有一颗是下拉菜单的触发器，它们要的是**同一串类**而不是同一个组件。
*/

export { default as Suggestions } from "./Suggestions.vue";
export { default as Suggestion } from "./Suggestion.vue";
export { SUGGESTION_CHIP_CLASS } from "./chip-class";
export {
  SUGGESTION_STAGGER_MS,
  SUGGESTION_STAGGER_OFFSET_MS,
  suggestionEntranceDelay,
} from "./stagger";
