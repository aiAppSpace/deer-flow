/*
  【文件职责】     空状态 primitive 的公共入口。
  【架构位置】     L2
  【主要导出】     Empty · EmptyHeader · EmptyMedia · EmptyTitle · EmptyDescription ·
                   EmptyContent 等 6 个
  【依赖关系】     同目录 SFC
  【边界与注意】   与上游 `ui/empty.tsx` 一一对应，`data-slot` 全部照抄
                   （其中 EmptyMedia 的 slot 名是 `empty-icon`，不对称是上游如此）。
*/
export { default as Empty } from "./Empty.vue";
export { default as EmptyHeader } from "./EmptyHeader.vue";
export { default as EmptyMedia } from "./EmptyMedia.vue";
export { default as EmptyTitle } from "./EmptyTitle.vue";
export { default as EmptyDescription } from "./EmptyDescription.vue";
export { default as EmptyContent } from "./EmptyContent.vue";
