# Artifact 焦点边界独立复核

本轮只读产品源码，未修改焦点量具、生产文件或运行中副本。独立辅助 harness 使用当前真实 React Sheet/ToggleGroup 与已安装 Radix，临时 loopback port0、自有浏览器均 finally 关闭；无业务 API、Next 构建或全量单测。

## 两个真实缺陷

1. 逆向不是 iframe 导致。原完整三轴记录 40 次都是 Preview，focusin 每次增加 2。辅助真实组件在普通布局正常从 Preview Shift+Tab 到 Before；放入相同 Sheet 后连续 8 次仍为 Preview。实际 `HTMLElement.focus` 栈指向 Radix `FocusScope.handleFocusOut2 → focus(lastFocusedElementRef)`。keydown 的 ancestor Scope 先将 `tabindex=0` 的 ToggleGroup root 当首边缘；Item 随后请求 back-out，将 root 变成 -1，原生 Shift+Tab 正常离开首端，却被 trap 恢复到 Preview。RovingFocusGroup 本身能够正常 back-out，不应修改其方向键或关闭 rovingFocus。
2. 正向独立发生在末尾 iframe：父 document 不收到 iframe 的 focusin；从 iframe 出来命中 body guard，Scope 仍只记住之前 Close，因此永久 Close↔iframe，无法回到前面的 Preview/Copy。这需要当前 modal owner 的原生首尾边界处理；不能用单 stop 白名单、隐藏 iframe 或增加采样掩盖。

## 公有调用边界候选

无条件给 ToggleGroup root `tabIndex=-1` 虽修逆向环，却造成首次入组回归：原始 currentTabStopId 未初始化，两个 Item 都是 -1；正常与 active-disabled 两例均跳过整个组直接到 Copy。该静态候选不能直接落地。

更小的有效候选是在现有公有 `onKeyDown` 边界，caller 未 preventDefault、普通 Shift+Tab 且事件来自当前组 Item 时，同步设置 root.tabIndex=-1。它只提前发布 Item 已请求的相同 back-out DOM 状态，使祖先 Scope 当次读取正确的首边缘；不 focus、不 prevent、不更改 value/rovingFocus/方向键。现有 onBlur 负责恢复 root 状态。候选在真实原生模态逆向得到 iframe→Close→Copy→Preview 的完整环；初次入组、disabled、plain reverse、输入选择及 Left/Right/Home/End 保持原行为。生产落地前仍需 caller/修饰键/嵌套输入/单项及异步移除回归，且由 root 批准。

## 实际证据与边界

- [native-inspect-results.json](evidence/artifact-focus-boundary-independent-stage42/native-inspect-results.json)：4 fresh contexts、真实调用栈及原始双向序列，直接 exit0 表示诊断运行成功，不把观察到的产品困环写为 PASS。
- [native-toggle-candidate-results.json](evidence/artifact-focus-boundary-independent-stage42/native-toggle-candidate-results.json)：静态 -1 的首次 entry 两项真实 FAIL，直接 exit1；原对照相同检查全 PASS。
- [native-toggle-synchronous-results.json](evidence/artifact-focus-boundary-independent-stage42/native-toggle-synchronous-results.json)：9 fresh contexts；同步候选 plain 六项检查 PASS、原生逆向环正常、无 pageerror。直接 exit1 仅来自同时保留的静态候选两项负控，不声称整命令全 PASS。

最初草拟 candidate harness 显式传了 `tabIndex=undefined`，经 Radix asChild 合并会覆盖默认值，已确认为辅助对照错误；其脚本/log/JSON 单列 `*-draft*`，未用于结论。正式对照改为完全省略该 prop，并在异步方向键读数前等待真实帧后取得上述结果。

本轮没有新增正式 Playwright case；不替代最新编译页面、完整三轴键盘或全量跨端门禁。Linux 重构建仍 HOLD。

## 授权后的最小实现与最终专项验证

React `ui/toggle-group.tsx` 已在公有 `onKeyDown` 边界实现同步 back-out：caller 先执行并可 preventDefault；只对启用 roving focus 的最近组 Item 的普通 Shift+Tab 提前发布 `root.tabIndex=-1`。没有手动 focus、preventDefault、永久 -1、value 或方向键改写；现 Radix blur 负责恢复。显式 `rovingFocus=false` 不接管调用方 root 停点。

- 真 mounted 原始 3 FAIL/9 PASS → 最终 13 PASS，直接 exit0、无 skip/todo；额外 disabled-roving 边界先 1 FAIL/12 PASS，再补正确 no-op。
- 最终实际 source + installed Radix Dialog/FocusScope 原生对照：旧源 1 FAIL/14 PASS、修复源 15 PASS，分别直接 exit1/0；旧困环连续 8 次 Preview 原样保留。涵盖 plain/modal、首次入组、普通 Tab、Left/Right/Home/End、受控 value、disabled、input 光标选择、caller prevent、asChild、single item、focused 异步移除/禁用、empty、roving disabled。无业务请求/pageerror，自有端口和浏览器 finally 关闭。
- 360/1280 组件 harness 每组 12 个 DOM 节点 rect 逐字相等；这是辅助 CSS 下组件几何，不冒称完整 Next 页面 UI 零变化。
- React tsc、Prettier 与 canonical scoped ESLint 均直接 exit0。UI 文件依原项目 ESLint 配置 ignored；强制 no-ignore 时旧/新均有同样 6 个既有 import/order/`||` 报错，精确比较无新增，不把强制检查写为 PASS。

同期 root 的 Sheet 尾部 span 进入过辅助构建，使诊断 harness 的 `>button:last-child` 不再隐藏原 primitive Close，因此旧/新 ToggleGroup 都多出真实 Close BUTTON；完整 `native-sheet-concurrent-*` 2 项 mismatch 现场保留。这是辅助隐藏选择器的结构假设失效；真实 WorkspacePanels 明确隐藏直接 primitive button，不受该问题影响，也不把 span 误称为 Tab 停点。最终单 owner 因果测试改用已安装公有 Radix Dialog，避免把外部 helper 改动混进这项负控；之前 `native-14-*` 仅该外部改动前历史 checkpoint。原 forward iframe defect 本次只保留其原 Tab 行为，由 root/composer 独立修复，不据本轮专项 PASS 外推完整焦点环。

冻结清单、SHA、命令退出及真实边界见 [toggle-production-freeze.json](evidence/artifact-focus-boundary-independent-stage42/toggle-production-freeze.json)。正式 Playwright 净新增 0；最新完整编译应用验收仍 UNRUN，需 root 统一新源构建执行。Linux 继续 HOLD。
