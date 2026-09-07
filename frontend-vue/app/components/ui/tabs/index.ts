/*
  【文件职责】     暴露 Tabs primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     Tabs 及其子组件
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Tabs } from "./Tabs.vue";
export { default as TabsContent } from "./TabsContent.vue";
export { default as TabsList } from "./TabsList.vue";
export { default as TabsTrigger } from "./TabsTrigger.vue";
export { tabsListVariants, type TabsListVariants } from "./variants";
