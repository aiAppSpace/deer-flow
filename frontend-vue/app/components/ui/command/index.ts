/*
  【文件职责】     暴露 Command primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     Command 及其子组件
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Command } from "./Command.vue";
export { default as CommandEmpty } from "./CommandEmpty.vue";
export { default as CommandGroup } from "./CommandGroup.vue";
export { default as CommandInput } from "./CommandInput.vue";
export { default as CommandItem } from "./CommandItem.vue";
export { default as CommandList } from "./CommandList.vue";
export { default as CommandShortcut } from "./CommandShortcut.vue";
