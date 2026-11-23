# Vue 前端整体代码审查与精简建议

日期：2026-10-09。分支：`main-wc`。审查基点：`a7804539530846baecf548af7b5d2612deb89b68` 加当前未提交工作树。

## 结论

当前 Vue 架构的基本方向合理，保留 Nuxt、Vue composables、Vue Query、框架中立的流式内核即可，没有依据整体推倒重写。主要问题是少数巨型组件承担过多生命周期编排、异步状态归属不严谨、存在重复或未消费的旧模型，以及一些测试把实现拼写和历史说明当成了产品契约。

可以精简，但基础无障碍应保留。焦点恢复、Escape 关闭、方向键导航、真实 label、窄屏和放大后的控件可达性，直接影响现有产品操作；它们大多由现有 Reka 组件承担。更有收益的工作是修复生命周期缺陷、统一消息虚拟化、拆分聊天编排、清理已核实的孤立抽象，再简化维护历史叙事的门禁。

当前还不能认定同步范围内的 React/Vue 产品已可完全平替。工作树中有暂停前尚未接完的新功能，对照基线也容许部分差异，运行中会话恢复等仍有明确实现缺口。用户已再次确认 Vue 首页内容、docs/blog 内容站及整站无后端静态回放模式不要求同步；这些是任务边界，不列为对齐欠账。范围内判断仍以当前 React 实际可达的功能、操作流程、行为和 UI 样式为准。

## 本轮做了什么，以及没有验证什么

本轮对各模块做了文件级结构审读：入口、导入/导出、状态声明、模板、事件绑定、主要消费者；对聊天、流式状态机、创建 Agent、产物编辑/预览、虚拟化、设置、无障碍适配及验证接线做了实现深读。三个分区并行审查后，主审又交叉核对了关键发现与调用链。

**这里的整体过一遍，不等于每一行代码都完成了人工语义证明。** 类型、字典、生成物和大量测试主要做结构与消费者审查；重点状态机做了更深的调用链核验。没有把文件数量、旧报告中的完成状态或测试数量当成功能正确性的证据。

当前源码清单按 `.vue/.ts/.tsx/.js/.mjs/.cjs/.css` 等代码后缀统计，包含未跟踪的 WIP、生成类型、注释和字典，排除依赖与构建产物：

| 范围 | 文件数 | 原始行数 | 阅读方式 |
| --- | ---: | ---: | --- |
| `app/components` | 323 | 38,255 | 全量结构审读，重点聊天、UI primitive、Markdown、设置、产物链深读 |
| `app/pages`、`app/layouts`、`app/assets` | 22 | 2,997 | 路由、布局、页面结构与 CSS 实现审读 |
| `app/composables` | 47 | 6,402 | 全量结构审读，流式、历史、创建、草稿、缓存链深读 |
| `app/core` | 285 | 46,111 | 全量结构审读；两份生成物查生成源与消费者，未逐行审查 |
| `packages/agent-core/src` | 14 | 1,463 | 执行主体完整深读 |
| 根组件、lib、plugins、middleware、server、shared、config | 14 | 808 | 实际入口、代理、鉴权、运行配置审读 |
| **上述合计** | **705** | **96,036** | 不代表同等运行时体积或逐行验证量 |

工程侧另审查 `scripts` 26 文件、`baseline` 13 文件、测试配置及 CI。当前测试目录有 329 个 Vitest 测试文件、88 个 Playwright spec；全部做结构与断言扫描，关键配置、脚本及代表性用例深读，没有逐行人工读完约十万行测试。

本轮未修改业务、测试或配置源码，未删除文件、未提交或推送。新增的只有这份审计记录。暂停前已有的 31 个跟踪文件修改和新增模块均保留。

## 实际架构与模块判断

当前主链路是：Nuxt 根组件与插件 → layout/page → 业务组件 → composables → core 纯逻辑/API → `agent-core` 的 SSE/session。服务端数据通常由 Vue Query 管理，本地交互由 ref/computed/watch 管理。这个边界符合当前功能复杂度。

| 模块 | 当前实际职责与调用链 | 判断 |
| --- | --- | --- |
| 应用入口、路由与鉴权 | `app.vue` 挂布局、主题、路由播报；插件提供 i18n、QueryClient、主题和 runtime config；全局 middleware 判登录/初始化状态 | 保留现有 Nuxt 组织，不需要改成另一套框架 |
| 服务端代理 | Nitro request guard → API catch-all → `gateway-proxy`，处理路径/请求头、请求体上限、流式转发；showcase 有独立静态产物白名单 | 属于前端独立部署和联调所需基础设施，不能因“非页面业务”删除 |
| 聊天页面 | `AgentChat` 编排普通会话、Agent 会话、创建、demo、历史、项目、浏览器、产物及 Sidecar | 需要拆编排职责，保留可观察流程 |
| 输入框 | `ChatComposer` 同时承担草稿、技能、文件、语音、润色、模型/模式、弹层与提交事务 | 需要拆生命周期 owner，保持一个输入/草稿数据源 |
| 消息与 Markdown | `MessageList → MessageMarkdown → StreamMarkdown → MarkdownPre → CodeBlock/Mermaid` | 流式 Markdown、代码、图表、选区动作都是产品功能；主要精简点在虚拟化与滚动编排 |
| 流式与历史 | `useThreadStream → thread-runner → run protocol/session/SSE`；另有 checkpoint/history/optimistic/rendered bridge | 分层保留，集中取消、销毁、重置和消息状态归属 |
| 产物 | `useArtifactsPanel → useArtifactDraft → ArtifactPanel → editor/preview`，独立 viewer 复用预览 | 单一草稿 owner 合理；修保存快照、预览取消边界，合并旧模型 |
| 设置、能力、集成 | 当前 `SettingsDialog` 仍接 tools/skills/integrations；新 capability 组件处于迁移中 | 以当前 React 为目标收敛到唯一入口/owner；WIP 不能当死代码删 |
| 项目、后台任务、计划任务、channel、memory、browser、sidecar | 有真实页面/面板和 API 消费链；新增项目文档、trash 等仍有未接 UI 的部分 | 按功能对齐与完成度分别处理，不能按目录名或文件多寡删 |

入口依据：[Nuxt 配置](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/nuxt.config.ts:74)、[应用根组件](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/app.vue:9)、[鉴权 middleware](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/middleware/auth.global.ts:1)、[实际代理](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/server/utils/gateway-proxy.ts:1)。

## 优先修复的具体问题

### 1. 取消当前 run 与销毁 runner 混用，重试失去快照通知

这是原有代码问题，已用当前真实实现做内存复现。

`AgentChat` 创建保存时传入 AbortSignal；stream error 的 watch 触发 creation error/invalidate，进而 abort。`useThreadStream.sendMessage` 把 abort 桥接到 `runner.abort()`。后者除了中止 run，还永久执行 `unsubscribeSnapshot()`；同一个 runner 后续 submit/reset 没有重新订阅。

复现结果：第一轮失败后 snapshot 次数为 2；第二轮正常走 `creating → streaming → completed`，store 已包含 `retry-answer`，snapshot 次数仍为 2。界面依赖的快照更新桥已经断开。

建议把“中止本次 run”与“释放 runner 生命周期”分开。组件销毁可以释放订阅，普通取消和失败重试应保留后续通知能力。

证据：[creation signal](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/chat/AgentChat.vue:509)、[error watch](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/chat/AgentChat.vue:547)、[signal 桥接](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/composables/useThreadStream.ts:763)、[永久退订](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/agent-deerflow/thread-runner.ts:300)。

### 2. 产物保存期间继续编辑，会把未发送内容标成已保存

这是原有 Vue 实现问题，已用当前 draft 纯函数复现，并与当前 React 调用链交叉核对。

`ArtifactPanel` 保存时捕获文本 A 发请求，但 editor 没接 saving/readonly，等待期间还可输入 B。成功回调只把 path/sha 传给 draft owner；`completeArtifactSave` 从最新 draft 读取 B 建立 baseline/remote，给 B 配上服务端保存 A 得到的 SHA。随后 dirty 为 false，未发送的 B 被当作已保存。

建议先补齐 React 的保存中禁用编辑行为，再以本次提交快照确认 baseline，避免返回时读取最新草稿。保留 SHA 冲突检查和未保存离开保护。

证据：[提交快照与完成调用](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/artifacts/ArtifactPanel.vue:410)、[editor 未接 saving](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/artifacts/ArtifactPanel.vue:884)、[baseline 来源](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/artifacts/draft.ts:83)、[React 保存中 disabled](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/artifacts/artifact-file-detail.tsx:738)。

### 3. 后台任务返回时重新读取路由 thread，可能写错缓存

这是原有代码问题，已在内存中用真实 composable、替代网络/Query 执行端口复现。

取消请求发给线程 A；返回前切到 B；`onSuccess` 再读取当前 thread，结果将 A 的任务写到 B 的 detail key，并失效 B 的 list key。请求身份应在 mutation variables/context 中捕获，结束回调使用同一身份。

暂停前新增的 `useScopedMCPConfig` 也有成功回调按当前 `key.value` 写结果的同类风险；它属于 WIP，应在完成接线前修正，不计入旧代码缺陷。

证据：[请求和回调读取身份](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/composables/useBackgroundTasks.ts:109)、[真实 props 消费](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/ThreadBackgroundTasks.vue:49)、[新增 scoped MCP WIP](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/composables/useScopedMCPConfig.ts:13)。

### 4. HTML 预览取消后仍可能迟到回写

这是源码推导出的竞态风险，未做浏览器复现，也没有测量内存泄漏。

`ArtifactPreview` 切到非 HTML 时 abort 后提前返回，卸载时也只 abort/revoke；这两条路径都没有使 generation 失效。资源 fetch 的 abort 被 catch 消化后，旧 Promise.all 续体仍可能通过 generation 检查，在清理之后创建 Object URL 并回写预览状态。

建议用 watch 单次任务的 cleanup 管理 abort/revoke，并在续体检查 aborted/disposed 或使 generation 失效；保留 HTML 资源内联与滚动恢复功能。

证据：[取消与提前返回](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/artifacts/ArtifactPreview.vue:234)、[续体检查与建 URL](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/artifacts/ArtifactPreview.vue:273)、[卸载清理](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/artifacts/ArtifactPreview.vue:290)。

## 最值得做的架构整理

| 优先项 | 当前依据 | 建议边界 |
| --- | --- | --- |
| 消息虚拟化 | Vue 超过 80 组后保留 50 组，其他组固定估算 80px，按滚动比例切窗口；React 已用 TanStack 动态测量、活动组保留、按 key 恢复历史锚点 | 复用已安装的 Vue Virtual，抽消息虚拟列表和滚动 owner；保留追尾、历史 prepend、目录跳转和流式活动组 |
| `AgentChat`，2,670 行 | 普通/Agent/bootstrap/demo、项目、标题、通知、follow-up、分支/重跑及多面板编排集中 | 按会话操作、Agent 创建、面板协调等已有领域拆 composable/子组件；不增加一套通用状态框架 |
| `ChatComposer`，2,259 行 | 草稿、技能 contenteditable、文件上传、语音、润色、模型/模式和弹层定位混合 | 拆语音、润色、命令、上传提交事务，保持单一草稿 owner；统一两种 editor 的锁定状态 |
| `MessageList`，1,798 行 | 分组、虚拟化、目录、滚动、选区、消息动作、产物/任务渲染集中 | 先拆滚动/虚拟化，随后拆消息交互；纯派生留 core，DOM 生命周期留 composable/组件 |
| `useThreadStream`，1,105 行 | transient bridge/order、rendered snapshot、optimistic、checkpoint、replay 及多条 reset 路径 | 集中 session generation、reset、可见消息转换，避免多份可写镜像；保留历史保留区和 durable 恢复职责 |
| feature flags | `useWorkspaceFeatures` 多组全局 refs/in-flight promises，分别请求同一 features 接口 | 复用现有 Vue Query 管去重、freshness 和错误策略，保留各 flag 的实际默认值 |
| Lark 集成 | `IntegrationsSettings` 同时管状态、授权窗口、轮询、generation、重试与表单 | 抽授权流程 owner；能力中心迁移复用它，保留预开窗口、等待与错误反馈 |

行数只用于定位职责集中，不是“超过多少行就设计错误”的门槛，也不能据此推断体积或性能收益。

虚拟化依据：[Vue 手工窗口](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/chat/MessageList.vue:522)、[按比例换窗口](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/chat/MessageList.vue:722)、[React 动态虚拟化](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/messages/virtual-message-list.tsx:85)、[Vue 已有库消费](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/VirtualThreadList.vue:79)。这里只证明机制差别，未复现滚动跳动。

输入锁定依据：[技能 editor](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/chat/ChatComposer.vue:1736)、[普通 textarea](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/chat/ChatComposer.vue:1757)。两处当前分别依赖 disabled 与 composerLocked，应按当前 React 的两种 editor 行为统一。

feature 与集成依据：[手工 feature cache](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/composables/useWorkspaceFeatures.ts:39)、[Lark 状态与授权](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/settings/IntegrationsSettings.vue:120)。

## 无障碍代码逐项判断

| 类型 | 当前代码事实 | 处理建议 |
| --- | --- | --- |
| 基础 Reka 能力 | Dialog/Sheet/Menu/Select 等依赖现有 Reka primitive；UI 173 文件中 74 文件直接消费 Reka | 保留焦点圈定/恢复、Escape、方向键与选择行为；移除 ARIA 不能相应移除这套 UI 依赖 |
| label、关闭按钮名称、错误提示 | 实际输入和弹层消费，部分明确使用 sr-only label/关闭名称 | 保留，属于可用表单与控件语义 |
| 移动抽屉、隐藏面板 inert、面板键盘调整 | 工作区面板布局与真实交互的一部分 | 保留，不能作为“额外无障碍功能”批量删 |
| Tooltip 适配 | 当前安装的 Reka VisuallyHidden 默认写 aria-hidden；本地 TooltipContent 额外补可达 tooltip 文本节点 | 有真实库差异依据，暂时保留；库升级后重新核实再收缩 |
| 菜单 tabstop 适配 | 当前 Reka 菜单项确实 hardcode tabindex=-1；本地还含 pointerleave 等补偿 | 分段验证；不能因一个补丁必要就保留整段历史补丁，也不能整体直接删除 |
| 菜单 viewport 补偿 | 查找库内部 `data-reka-popper-content-wrapper`，focus/keydown 后改 translate | 有内部 DOM 耦合；保留低高度/放大/resize 验收，再评估公开 collision 配置能否替代 |
| 路由播报 | 根组件真实挂载自建 RouteAnnouncer，手动 shadow root 和 alert 节点；已安装 Nuxt 也提供 route announcer | 可评估收缩 Next 内部 DOM 仿真，保留播报时机/内容/语义；Nuxt 默认 polite 与当前 assertive 不同，不能盲换 |
| 多处 focusin→scrollIntoView | Dialog 和 AgentChat 等分别做聚焦滚动修正 | 核对容器和作用范围后可合并；仍需保证窄屏、低高度与放大后能操作 |
| Mermaid 自写 popup/pointer 平移 | 当前安装的 React streamdown 有同形实现，部分键盘局限为两端共享 | 属于上游组件复刻成本；不能只在 Vue 换交互而破坏平替，可作为未来两端共同改善项 |

证据：[Dialog](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/ui/dialog/DialogContent.vue:90)、[Tooltip](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/ui/tooltip/TooltipContent.vue:82)、[菜单内部 DOM 补偿](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/ui/dropdown-menu/DropdownMenuContent.vue:89)、[路由播报实际实现](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/RouteAnnouncer.vue:68)、[Mermaid 平移](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/markdown/MermaidZoomPan.vue:210)。

本轮没有 bundle 或耗时测量，不能声称删除这些语义属性或测试会明显加速网站。较长的历史注释增加阅读维护成本，不等于相同比例的运行时成本。

## 已核实的清理候选

以下是建议清单，**本轮没有删除**。判据是当前生产调用链，并交叉查看了 React 的实际可达入口；没有仅依赖自动 import 图。Nuxt 自动入口、动态 worker、类型导出和暂停前 WIP 都可能让简单依赖图误判。

| 候选 | 当前证据 | 建议 |
| --- | --- | --- |
| [thread-context.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/composables/thread-context.ts:43) | defineThreadContext 没有生产消费者，仅独立测试使用 | 可移除闲置抽象及只验证该抽象的测试，保留各领域实际 provide/inject |
| [proxy-policy.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/auth/proxy-policy.ts:16) | LANGGRAPH_COMPAT_POLICY 无生产消费者；实际代理走 gateway-proxy/config routes | 可删除未生效的旧策略对象，不动实际代理检查 |
| [buildProxyRules](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/config/routes.ts:22) | 仅测试消费；Nuxt 实际只导入 csrRoutes，代理由 Nitro catch-all 实现 | 可删旧 builder 与对应孤立测试，保留该文件其他在用配置函数 |
| [input/keyboard.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/input/keyboard.ts:10) | 仅测试消费；实际 CommandPalette 用 workspace-shell/shortcuts 的 editable 判定 | 可删孤立 helper，保留当前快捷键实现及行为测试 |
| [prompt-input-files.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/uploads/prompt-input-files.ts:16) | FileUIPart 转 File adapter 仅测试消费，当前 Vue 输入/上传直接使用 File[] | 可删闲置 adapter，并核实后收掉其独占类型；上传、重试、附件行为需保留 |
| [artifacts/editing.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/artifacts/editing.ts:9) | 旧草稿模型没有实际编辑消费者；生产编辑使用 useArtifactDraft/core artifacts draft/policy | 先修保存竞态，再移除重复模型；不能删实际编辑、冲突及未保存保护 |
| [api/feedback.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/api/feedback.ts:11) | Vue 无消费者；React 虽有按钮实现，唯一 MessageListItem 调用未传 feedback，因此当前也无可达反馈入口 | 低优先级孤立 wrapper 候选；不为对齐擅自新增反馈入口，不删历史消息 feedback 数据透传 |

反馈判断依据：[React 条件挂载](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/messages/message-list-item.tsx:269)、[React 唯一消息项调用](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/messages/message-list.tsx:1304)。这说明“函数存在且有 import”也不等于功能对用户可达。

另一个需要**整合而非直接删除**的例子是 [workspace-change-anchor.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/messages/workspace-change-anchor.ts:24)。它只有测试消费者，但生产 MessageList 内部另写了 workspaceChangesRun 算法，实际 badge/API 均已接入。建议统一到一个纯算法，再移除 inline 重复逻辑；两种算法对 AI/tool 混合 run_id 的处理并非已经证明等价，需先补边界验证。

证据：[inline 算法](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/chat/MessageList.vue:966)、[实际 badge](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/chat/MessageList.vue:1643)、[现有行为用例](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/e2e/workspace-changes.spec.ts:203)。本轮只读用例，未执行。

## 测试与工程成本应该怎么减

保留真正验证协议、竞态、缓存归属、权限、代理、键盘及响应式可用性的测试；精简锁源码拼写、历史叙事和内部形状的部分。49 个 guard 中绝大多数读取源码/文档，它们不能全算作运行行为验证。

| 当前问题 | 源码依据 | 建议 |
| --- | --- | --- |
| 文档与历史说明门禁偏重 | doc-facts、doc-references、file-header-claims、upstream-citations、upstream-zero-claims、stale-coverage-claims、invariant-ownership 共 7 份；部分锁 prose、规模下限与历史数字 | 删除过时的历史数字叙事，合并必要的断链/命令存在性检查；保持文档真实，不以删守卫掩盖产品缺陷 |
| 行号引用门禁的证明力有限 | upstream-citations 检查文件存在、行号范围、总行数，没有验证引用内容仍支撑陈述 | 不把“引用检查绿”当源码事实正确；减少整文件行数和引用行号的强绑定 |
| 测试锁实现拼写 | chat-header 断言精确模板/computed 字符串；upstream-class-echo 锁 class 形式 | 样式结果仍须一致，但尽量用组件交互、computed style、双端截图验证，给合理重构留空间 |
| E2E 列表可假绿 | Makefile 的 list 管道失败后 echo 成功，循环没有累计失败码 | 修退出状态传播，再用它当 CI 收集检查 |
| API 生成检查不能证明后端对齐 | gen-api-types-check 输入是签入的 OpenAPI snapshot，只比生成结果 | 从当前 backend 取得可复现 schema 后查漂移；保留生成类型，不能靠生成幂等宣称 API 完整对齐 |
| audit 基线只记包名 | 新 advisory 若仍属于已登记包，集合比较看不出来 | 保留可达性分析，基线至少能区分 advisory 与影响版本 |
| 构建/场景准备重复 | verify 已 build，asset-budget 再 build；多套 config 启动也 build；standalone-sim 又跑整套单测 | 只在构建参数相同的场景复用产物，standalone 放隔离副本；保留鉴权、代理开关、真实后端等不同拓扑 |
| a11y 多套 spec 重建相同终态 | keyboard-trap/reachability/reflow/triple-keyboard 各自装配双端场景 | 共享场景准备与参数化 harness，隔离改变焦点/DOM 的探针；保留各自不同的用户行为断言 |

依据：[文档规模断言](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/guards/file-header-claims.test.ts:330)、[源码字符串测试](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/unit/chat/chat-header.test.ts:55)、[e2e-list](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/Makefile:340)、[OpenAPI 生成源](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/scripts/gen-api-types.mjs:30)、[audit 包集合](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/scripts/audit-triage.mjs:43)、[E2E build/preview](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/support/playwright-factory.ts:57)。

实际接线也有界限：`make verify` 包含 lint/format/typecheck/Vitest/i18n/生成一致性/standalone/build，浏览器测试在额外 CI job。产品截图目前没有自动双端整屏视觉回归接线。测试数量、预算超时、历史注释耗时均不是本轮实测数据。

## 当前对齐缺口与 WIP 边界

1. **三类既定豁免继续有效，不计入功能缺口。** Vue 首页内容保留自己的实现；docs/blog 内容站不移植；整站无后端的静态回放部署模式不跟进。用户已在本轮明确确认。`/showcase/[thread_id]` 不在静态模式豁免内，仍需对齐。此前将首页差异、内容站和静态模式归为本期欠账的表述已纠正。
2. **服务端 active run 恢复有差异。** Vue 进入 thread 当前加载 checkpoint/history；React 有从服务端 active run joinStream 的实际链。现有断流重连不能自动覆盖刷新页面或另一客户端发起的 run，应在已有 runner 中补 adopt/join。
3. **能力中心仍未整体接入。** 旧 SettingsDialog 继续消费 tools/skills/integrations；新增 capability manager 尚无完整宿主，AgentSettings 的能力选择则已有部分接入。应以一个能力模型/配置 owner 完成替换，避免长期两套入口和缓存。
4. **新增代码不等于功能完成。** 模型 reasoning/favorites、mentions/conversation references、项目文档/trash、扩展、计划任务等有暂停前 WIP。部分已经写进组件，部分只有 API/composable/纯模块；没有完成浏览器验收。旧 Command 链因为模型选择器 WIP 而暂时零消费者，也不能直接判作历史死代码。
5. **基线容许差异。** 主 parity 基线当前 195 维为空；auth 基线 6 维中有 8 个非空字段，共 28 行差异记录。测试要求实测差异等于已登记基线，允许这些差异继续存在；这不是当前运行的测量结果，更不是完整一致证明。
6. **视觉采样有盲区。** 当前锚点对照采样几何、颜色、字体等，没有整屏像素对照，boxShadow/backdropFilter 也未采样。产品 macOS 截图是 Vue 自身回归，不能替代 React/Vue 同环境截图比对。

依据：[Vue 首页](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/pages/index.vue:38)、[React 首页](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/app/page.tsx:13)、[React active-run join](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/core/threads/hooks.ts:2329)、[仍在用的旧设置入口](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/settings/SettingsDialog.vue:309)、[同步范围定义](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/baseline/react-parity-scope.json:1)、[auth 基线比较方式](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/e2e-parity-auth/diff.spec.ts:138)、[视觉采样字段](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/e2e-parity/support/capture.ts:102)。

## 建议实施顺序（本轮未实施）

1. 先修已复现的取消/重试、保存快照、mutation 身份问题，并对相应真实行为补回归；随后核实预览取消风险。
2. 在保留三类既定豁免的前提下梳理未完成任务，以当前 React 的可达入口、流程和样式确定范围内缺口；补齐能力中心、active-run 等关键链，避免边迁移边保留第二套状态模型。
3. 统一消息虚拟化，拆 `AgentChat/ChatComposer/MessageList` 的职责；集中 session/reset 和草稿 owner，沿用现有库与分层。
4. 按已核实清单清理孤立 helper/重复模型，再收缩历史说明、源码拼写门禁与重复场景准备。
5. 对少数 UI 内部 DOM 补丁逐个做替代验证；基础键盘、焦点、label 和响应式可达性保留。最后用双端同环境功能、交互与截图验收，确认平替目标。

不以“先删无障碍”作为简化主线，也不以降低门禁或接受新的差异基线代替功能对齐。

## 本轮验证记录

| 项目 | 结果 | 含义与限制 |
| --- | --- | --- |
| 全模块结构审查、重点调用链深读 | 完成 | 覆盖口径见前文；不是每行语义证明 |
| runner 失败重试内存探针 | 缺陷已复现 | 真实 runner + creation composable + Vue watch；第二轮 completed 且有消息，快照通知仍停在 2；未模拟完整页面和创建完成验证 |
| artifact draft 内存探针 | 缺陷已复现 | 真实 draft 纯函数；提交 A 后编辑 B，再 completeSave，baseline=B 且 dirty=false |
| background mutation 内存探针 | 缺陷已复现 | 真实 composable，替代网络与 Query 执行端口；A 请求返回写 B key，不冒充完整 Vue Query 集成 |
| HTML 预览取消 | UNRUN | 源码推导风险，未做延迟资源/卸载运行复现 |
| lint、typecheck、unit suite、build | UNRUN | 本轮只读审查，没有用之前的结果代表当前 WIP |
| 双端浏览器、UI 像素、键盘、响应式、真实后端联调 | UNRUN | 本轮没有启动浏览器或服务；不能据此宣称平替完成 |
| 源码保持不变 | PASS | 审查前后 frontend-vue 内容指纹一致，1,261 个文件；没有修改暂停前 WIP |

内容指纹覆盖 `app/server/shared/config/packages/scripts/tests/baseline` 和 frontend-vue 根文件，排除依赖与构建目录：`27051e933db86184e50884b35000595a0b926d634a31208d9bc5f0717cae0405`。文件数包括数据/资产等，不等同于上面的 705 个生产代码文件。
