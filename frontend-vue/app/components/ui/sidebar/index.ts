/*
  【文件职责】     侧栏 primitive 的公共入口。
  【架构位置】     L2
  【主要导出】     SidebarTrigger · SidebarGroup · SidebarGroupLabel · SidebarGroupContent ·
                   SidebarMenu · SidebarMenuItem · SidebarMenuButton · SidebarMenuAction ·
                   sidebarMenuButtonVariants 等 10 个
  【依赖关系】     同目录 SFC
  【边界与注意】   移植的是上游 `ui/sidebar.tsx` 里的**内容层**。
                   **外壳层（Sidebar / SidebarProvider / SidebarInset / SidebarRail）不移植**：
                   本仓的 `components/workspace/ThreadSidebarShell.vue` 已经是它们的等价物
                   （文件头写明「形状照上游的 `Sidebar`」），再引入一套会变成两个外壳体系。

                   上游那份还有 Badge / Skeleton / Sub* / Separator / Input 若干，
                   本仓暂时没有调用点，需要时按上游逐个补——**补的时候连 data-* 属性一起抄**，
                   它们被同目录其它 primitive 的选择器依赖。
*/
export { default as SidebarTrigger } from "./SidebarTrigger.vue";
export { default as SidebarGroup } from "./SidebarGroup.vue";
export { default as SidebarGroupLabel } from "./SidebarGroupLabel.vue";
export { default as SidebarGroupContent } from "./SidebarGroupContent.vue";
export { default as SidebarMenu } from "./SidebarMenu.vue";
export { default as SidebarMenuItem } from "./SidebarMenuItem.vue";
export { default as SidebarMenuButton } from "./SidebarMenuButton.vue";
export { default as SidebarMenuAction } from "./SidebarMenuAction.vue";
export {
  sidebarMenuButtonVariants,
  type SidebarMenuButtonVariants,
} from "./menu-button-variants";
