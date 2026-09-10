/*
  【文件职责】     暴露 Item 一族与它的样式变体。
  【架构位置】     L2
  【主要导出】     Item / ItemMedia / ItemContent / ItemTitle / ItemDescription /
                   ItemActions · itemVariants · itemMediaVariants
  【依赖关系】     被页面显式导入
  【边界与注意】   上游 `ui/item.tsx` 还有 ItemGroup / ItemSeparator / ItemHeader /
                   ItemFooter 四个，**本仓的调用点一个都没用到**，所以不移植
                   （「不承重就别写」）。真要用时照 item.tsx 逐字补。
*/

export { default as Item } from "./Item.vue";
export { default as ItemMedia } from "./ItemMedia.vue";
export { default as ItemContent } from "./ItemContent.vue";
export { default as ItemTitle } from "./ItemTitle.vue";
export { default as ItemDescription } from "./ItemDescription.vue";
export { default as ItemActions } from "./ItemActions.vue";
export { itemVariants, itemMediaVariants } from "./variants";
export type { ItemVariants, ItemMediaVariants } from "./variants";
