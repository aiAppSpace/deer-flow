# Tooltip 组合菜单的原生锚点验收（2026-10-09）

当前结论：修复已落源，真实书签和头部导出操作通过。生产源码稳定时间为 22:17:59 CST；此后未修改该生产文件。完整最终双端门禁由根任务继续执行，本报告只记录这里实际完成的检查。

## 根因与修复

`ConversationExtensionActions` 和 `ExportTrigger` 的组合均在 DropdownMenuRoot 内嵌 TooltipRoot，并将 DropdownMenuTrigger 放入 TooltipTrigger。当前 Reka 的 TooltipRoot 和菜单定位器使用同一个通用 PopperRoot injection key；MenuAnchor 因而把按钮写入最近的 Tooltip root，而外面的菜单 Content 没有 anchor。真实浏览器失败时其位置保持 `translate(0px, -200%)` 且 transform-origin 为空，菜单项无法点击。

`app/components/ui/dropdown-menu/DropdownMenuContent.vue` 读取 Reka 公开的 `injectDropdownMenuRootContext().triggerElement`，作为原生 `reference` 传给 Content，显式调用方 reference 仍优先。元素所有权保留在已有 DropdownMenuRoot；没有额外元素缓存、手工坐标、焦点补偿或组件分支。正常定位、碰撞、sticky 和优先定位语义保留。

## 实际证据

- 真实旧产品：书签 default/custom-toolbar 和坏 action 隔离共 5 个菜单点击失败，另外 12 个通过；错误均为菜单项在视口外。custom-sidebar 不含此嵌套，正常通过。
- 修复后独立生产副本：原 17 个正式用例全部 PASS，包含三种书签入口、Alice/Bob 隔离、工具调用、删除/禁用、双真实 tab 上传上下文快照及六个模型偏好用例。未减少任何原 wire 或隔离断言。
- 新正式 `tests/e2e/chat-header-export.spec.ts`：实际点击头部 Export，两个菜单项均位于视口内，分别点击并收到 Markdown/JSON 浏览器下载；两份文件包含可见问答且排除隐藏消息，PASS。
- 真实 Reka DOM：嵌套 Tooltip 菜单锚点、调用方 reference 优先和初始打开三例 PASS（含关闭后重开仍正确锚定）；连同既有定位/导出/行操作菜单为 4 文件、15 PASS。
- Scoped lint、Vue app 和 tests typecheck 全部 PASS。

可复核日志位于 [证据目录](evidence/2026-10-09-menu-anchor/formal-17.log)。浏览器仅在隔离副本及公开夹具中执行，未构建原 checkout。
