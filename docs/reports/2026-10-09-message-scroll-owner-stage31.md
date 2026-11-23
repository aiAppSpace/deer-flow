# 窄屏聊天消息滚动 owner 根因修复（Stage31）

状态：最小根因修复和独立两端 canonical 生产构建完成。最新 Stage32c 完整最强 42 条正式浏览器回归 **42 PASS / 0 FAIL / 0 skip / 0 flaky，直接 exit 0**，用时 2.4m。源码与测试指纹、所有原始 RED 及真实键盘重入因果证据均保留。当前源码的最终容器及 Linux 验收另行排队，Stage30 结果只证明其历史快照。

## 已证实的因果链

React 默认聊天与自定义 Agent 聊天页面在 361px 以下，把原有消息列表及其直接子滚动容器强制改成 `height:auto !important`、`flex:none`、`overflow:visible !important`。Vue `MessageList` 也存在同类覆盖。消息列表的虚拟化、历史锚点和追尾 owner 仍观察原内层 scroller，但真实滚动已经交给外层 `main`，两者发生脱节。

真实 360×800 / 根字体 32px 下，已经打开的 Skills 菜单触发器移动到 y=1132；菜单 portal 固定定位在 y=877..1128，等待 500ms 后读数不变。两个 menuitem 没有能够把它们带进视口的滚动路径，严格 reachability survey 报两项丢失。

本地实际 Radix Popper 1.2.8 通过 Floating UI `shift({mainAxis:true,crossAxis:false})` 定位，top/bottom 菜单的 shift 只修正 X。`sticky="always"` 仅去掉 limiter，不会启用 Y 修正；`flip` 在屏外 anchor 上也无法凭空创造可见空间。Reka 2.10.1 的 `prioritizePosition` 开启双轴 shift，解释了同一状态中 Vue portal 暂时保持可见，但并不能证明 Vue 的消息滚动 owner 覆盖合理。

原浏览器因果探针只删除 React 消息列表的五个窄屏覆盖，没有添加坐标、样式替代值、滚动脚本、强制关闭或修改断言。结果两个 lostControls 归零，horizontal/clips 也为零。恢复内层原生滚动后，触发器回到可见范围，原 Radix `flip` 已能正常将菜单放入视口。这个实验是根因定位证据，正式源码验收仍须下面的独立生产构建。

## 最小变更与保留边界

- React `chat-page.tsx` 及 Agent 聊天 page 的 MessageList 保留原 `size-full`，去掉五个窄屏自然高度/取消 overflow 的覆盖。
- Vue `MessageList.vue` 的 root 保留 `min-h-0 flex-1`，其 scroller 保留 `h-full overflow-y-auto`，去掉对应五个覆盖；虚拟列表实现不改。
- 外层 `main` 的窄屏滚动后备保留，欢迎页 `relative/shrink-0/pb-4/translate-y-0` 保留，继续支持超高 composer 的可达性。
- 不增加固定或任意最小高度。React 消息区父节点已有 `min-h-0 flex-1`，Vue root 已有同样约束；增加下限会再次与低高度视口争空间。
- 菜单 primitive、阈值、可见性筛选、文本和 hover/keyboard 合同不改。

## 正式回归

既有 `chat-content-reflow.spec.ts` 的四条聊天内容/技能用例保持原 survey 与键盘断言，另增双端引用候选两条用例覆盖 `extension-mentions#coexisting-candidates`、`search-failure-isolated`、`mentions#all-reference-kinds`。父任务同时在既有内容族加入三条真实 ToolDetails 状态，以覆盖聊天头部换行修复。

新增 `chat-scroll-owner-reflow.spec.ts` 共四条用例：两端各验证默认/Agent 空欢迎页的输入与 Submit 焦点、草稿保留；两端各验证 90 轮历史在窄屏放大后仍使用原同一个 scroller、真实 CSS overflow 与滚动范围、受限虚拟 DOM 数、真实滚轮使 scrollTop 下降且不丢 composer 焦点、滚到首条后虚拟窗口更新与 Copy 焦点可达。

2026-10-10 Stage32 当时 Playwright 无服务/无浏览器 `--list` 实际为 **847 tests / 27 files**，exit 0（2026-10-10 Stage32；此前六条回归后 829，能力域新增十四条后 843，再新增四条 token attribution 正式回归后 847）。主差异门禁仍是 **737 个取样目标**，两种计数不能互换，也不能当作当前完整执行通过。冷启动文档唯一当前事实区已同步，历史记录保留。

已完成：Vue tests 类型检查、相关 ESLint/Prettier、React 相关 ESLint/Prettier、`doc-facts` 19 tests PASS。既有 DOM owner/虚拟化定向覆盖由同组任务独立复核；它们不替代真实 CSS 布局验收。

独立源码副本为 `/private/tmp/deerflow-scroll-owner-stage31-gf94n7fp`；React/Vue 的 `node_modules` 均为实体副本，生成缓存不共享原 checkout。两端已按 canonical build 顺序构建，原 checkout 未构建。首轮浏览器失败的 TokenUsage 消费布局必须修复后再次增量同步构建；此前历史快照不能替代新源码验证。

可复核日志：`docs/reports/evidence/message-scroll-owner-stage31/`。正式构建、浏览器结果与最终 source fingerprint 完成后追加到本文件，保留此前 RED 和因果探针。

## 首轮正式执行与失败归因

38 条正式回归实际结束：34 PASS / 4 FAIL，exit 1，0 skip / 0 flaky。能力控件 28/28 PASS；两端技能详情/菜单、三种引用候选状态、默认与 Agent 欢迎页 6/6 PASS。两端内容族在首个 `tool-call-details#collapsed` 中报告原生消息 scroller 非预期水平滚动；真实 DOM 已定位到 TokenUsage debug card 的不可换行状态 badge 超过内容列宽，而不是 scroller 或菜单定位。该消费根因由能力域 owner 修复，不能隐藏 overflow 或放宽 survey。

两端 90 轮历史用例的 trace 已逐条核实：90 轮/180 消息加载、同一原生 scroller、非零且少于 60 个虚拟行、真实 wheel 降低 scrollTop、composer 保持焦点、首条渲染与 owner 身份均已通过。末尾测试错误地查询 `Copy`，实际两端源码与快照均为 `Copy to clipboard`，导致 locator.focus 等待至原 180s 测试上限。只更正精确 accessible name，保留所有原断言与原 timeout，同一生产构建正式复验 4/4 PASS，exit 0，用时 14.5s；Vue 90 轮 1.9s、React 2.0s。

初轮 JSON、构建日志、全部失败 trace/截图已持久归档到 evidence 目录。

## Token attribution 后续源复核边界

首轮内容横滚修复之外，当前 Vue processing token 展示归属也由消息域 owner 通过真实 DOM 红绿修正。独立只读复核确认：完整 wire 顺序计算 debug steps 后按真实 AI message id 投影；processing 组不再混入末尾 debug 卡；subagent reasoning 交由独立 processing owner、末尾排除其重复项；共享 batch 只在首个 eligible step 显示一份 summary，独立 tool 的 token 留在 tool label，thinking 与 tool 同消息不会重复计量。这与当前 React `message-list.tsx` / `message-group.tsx` 的对应数据流一致。源码复核只证明接线因果，不能替代新独立生产构建及浏览器视觉、布局验收；最终快照须包含新 `ProcessingTokenSummary.vue`。

## Stage32 最终独立构建与回归进行中

2026-10-10 00:03:32 冻结的 Vue 五个 token attribution 文件与已冻结 React consumer 布局均已纳入实体依赖副本，两端 canonical 生产构建 exit 0。完整正式 focused 由 38 扩为 **42**：保留原 38，另加双端 × usage/no-usage 共享归属的完整文字 Range 与内部 clipping 祖先检查。同步能力域追加的 tool 三态唯一 processing token / 唯一 final 卡归属断言。当前正在真实执行，未提前声明 PASS。

`final-source-fingerprint.json` 使用明确的 canonical 生产输入选择，不与首轮宽文件选择混算：Vue 898 inputs SHA256 `f4ba7d064aff63b0389ec977954bea3e055b451b6074d5fb0d63c21ba404094e`，React 810 inputs SHA256 `69707c6ac820d5ca5535c3397571ec8cf87f6a7d66647205e5ddf7ab6fada878`；当前工作区与构建副本逐文件零 drift。实际收集 847/27 及 `doc-facts` 19 PASS 已同步唯一当前文档事实区，主差异目标仍 737，历史执行边界保留。

## Stage32 第二轮严格 42 与独立根因

完整 42 实际结束为 **40 PASS / 2 FAIL**，exit 1、0 skip / 0 flaky；仅两端 tool focus 完整 viewport 断言失败。追加的最强每 Text node 父列范围检查同产物再执行 token 四条，usage 两端通过、no-usage 两端真实失败，确认 inline label 被右侧 shrink-0 状态挤窄（Vue左列23.4px/680px高；React7.4px/760px高）。消息域 owner 已用 flex-wrap/合理 basis 和完整 token 换行根因修复四处，不改原生 scroller。

焦点失败有独立根因：窄屏头部已从 absolute 转普通 flow，但 MessageList 仍保留原浮动 header 的 `pt-10`。根字体32px 时重复预留80px，使 Vue真实 scrollport46px、React58px，而完整 Tool details 按钮约80px高。原生 wheel 与 scrollIntoView 都无法在旧范围中完整显示按钮，scrollTop可稳定改变，未见追尾强制拉回。只删除该退役预留后 scrollport 恢复126/138px，真实原生wheel完整可达的 ratio1 断言两端 **2/2 PASS**。Vue动态移除padding期间原focus可产生0.265px边缘取整，未降低ratio，也未据此修改产品focus机制；最终初始稳定布局须重新构建验证。

已落最小三文件修复：React默认/Agent聊天 MessageList 只在原header转flow的 `max-[361px]` 同断点覆盖 `pt-0`；Vue AgentChat只对原pt10分支同样处理，欢迎页及saveHint真实pt4间距保留。无固定最小高度、坐标补偿、overflow隐藏、新滚动owner或阈值豁免。正式既有tool三态追加动态scrollport高度至少能包含完整按钮的正断言，原focus/ratio1/全文/四项survey都保留。

00:15:38冻结的inline列修复与上述三处已统一同步独立副本，再次按 canonical React→Vue 构建并执行最强42。原Stage32 full verify与旧指纹保留为此前源码历史checkpoint。

## Stage32b / Stage32c 实际焦点动作归因

新的两端 canonical 产物上 Stage32b 完整最强42实际 **40 PASS / 2 FAIL**；token 四条（包括每个 Text node 的自身父列范围）全部 PASS，tool collapsed 的原生scrollport、完整全文与直接ratio1也通过，剩余失败只在先 click 展开的 ToolDetails 终态。独立事件探针确认两端 resize 前后 activeElement 都是同一按钮；再次调用 focus 的 focusin 次数均为0，坐标不恢复。

同一实际产物通过标准 Shift+Tab→Tab：焦点先离开到 Edit and rerun，再真实重入 ToolDetails，产生2个 focusin；Vue按钮262..342完整处于240..366 scrollport、React268..348处于240..378。原 focused / ratio1 / expanded=true 断言两端 **2/2 PASS**，没有产品 focus 回调、坐标、wheel 或阈值兜底。正式三态夹具现在明确做这段真实键盘转移，并保留 expanded（collapsed=false/opened=true）正断言、动态scrollport和所有全文/四项survey。

完整最强42同构建 Stage32c 复验 **42/42 PASS**，命令直接 exit 0，2.4m，JSON expected42/unexpected0/skipped0/flaky0/errors空。能力域28、聊天内容/技能菜单/引用候选6、原生滚动/欢迎页4、共享归属最强文字范围4全部通过。产品焦点行为未改；前后源码、初轮RED、原active/focusin0与真实keyboard/focusin2证据均持久归档。

本轮实际构建输入 Vue898 SHA `b6252ec2b328ef15bd3e3d83c1d15a477c65c2dc9c4f10543f33504c9ac77d1d`、React810 SHA `307599f295f43f9e9116deb948c85aff7942b65a7d4dc517cd735707c7f508f4`，构建副本所有逐文件 hash 与原记录一致。当前工作区只比构建副本多一处 AgentChat 模板注释更新（普通宽度浮层/窄屏 flow 的开发事实），可执行生产源码无变化；最终容器将连同该注释刷新，不把旧构建写成字节零差异。四个正式测试文件与本轮副本逐文件一致，键盘修正后的测试 SHA 已写入 final-source-fingerprint。

全局当前取样库存后来因 W11 公开 showcase 扩为751目标，当前完整 collection 等该域测试冻结后真实重收集；上述847/737均保持其有日期的历史边界，不代表新的完整执行结果。

## Stage33 当前完整收集（不代表浏览器执行）

W11测试与注册冻结后，真实完整`e2e-list`18套全部收集成功、直接exit0，共1501 suite-collected；`e2e-parity`877 tests /28 files，auth21、真实session8。当前主差异目标751（desktop536/tablet28/mobile187，非desktop71族），十二档全部零目标。CURRENT唯一事实区已同步实际877 collected并保留历史数字；doc-facts focused19/19 PASS，exit0。此收集不启动服务/浏览器，也不把scope目标、历史42通过或收集数量写成当前877浏览器PASS。
