# W04 / W08 / W12 当前源码复核（Stage35–36，含本轮发现与修复）

审计仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。执行依据是
`docs/reports/2026-10-09-vue-period-plan.md` 的 W04、W08、W12 及第三节职责落点；
`docs/plans/vue-parity-cold-start.md` 只提供当前事实与冷启动入口。本报告依据当前生产
消费者、React 实现、backend 校验与实际测试，不以旧报告中的完成叙事作为结论。

## 结论与验证边界

本次逐项复核发现并修复三类真实遗漏：Agent 会话的展示名称、两个新宿主的移动侧栏
状态，以及 Agent 详情只有缓存写入却没有实际 Query 消费者。前两项六文件在
**2026-10-10 02:24:52.882 CST** 的冻结保留为 checkpoint，不外推后来详情 owner 的
修改。当前精确生产 SHA 与执行退出码见配套证据目录中的冻结记录。

前两类问题真实 DOM 回归分别先失败，再通过，合并定向运行 **9 文件 / 79 测试
PASS，直接退出码 0**。详情 query 的四个真实消费者测试也先全部失败，接线后再验证
账户/取消/错误等负向保护。最新合并定向 **10 文件 / 87 测试 PASS，直接 exit 0**；
最后执行范围见本报告末尾及持久日志。
本轮未运行完整 unit、构建或全量浏览器。既有实际路由测试已增强，须由新构建执行。
因此该结果只证明本次窄修和下述源码接线，不等于 W00–W13 最终验收完成。

详情缓存的假接线已经收口；未把只存在的 key 或 helper 当成完成证据。全局 Query
focus/default policy 的其他消费者由另一责任人同步审计修复，不在此处冒记为已执行。
W00 调度契约曾经 NOT_CONSUMED 的遗漏由另一责任人修复，本报告核对了最新生成
与实际消费，但不把其责任人的定向测试冒记为本报告执行结果。

## 本轮发现：Agent 展示名称没有进入两个会话消费者

React 的 Agent 会话页头与 `components/workspace/agent-welcome.tsx` 均按非空
`display_name` → 稳定 `name` → 路由名展示。Vue 画廊已经使用该规则，设置也已经保存
`display_name`，但 `AgentChat.vue` 页头与 `AgentWelcome.vue` 欢迎区仍只展示稳定 `name`。
这是真实已保存字段未被消费，属于 W05 定义契约在 W04 会话链中的遗漏。

修复在现有 `app/core/agents/presentation.ts` 增加 `displayNameOfAgent`，两个会话消费者
与原卡片模型共用同一精确规则。空字符串、null、缺省回退，不增加 trim 或其他与 React
不同的语义；API、Agent 查询、路由与模型继承仍使用稳定 name。

`tests/unit/agents/chat-agent-presentation.dom.test.ts` 编译生产 SFC 中真实页头 badge
片段，同时挂载真实 AgentWelcome 和真实 useChatAgent；覆盖非空、空、null、缺省，
及 Agent/账户切换、立即退休旧展示名、迟到响应不回写。该片段测试**不是完整 AgentChat
集成证明**。完整页面由原 `tests/e2e/agent-chat.spec.ts` 的欢迎测试及正式 parity
`agent-chat` 的两个终态补证：展示名称为 Review Assistant，header 与 welcome 按各自
实际状态断言，查询仍为 `/api/agents/test-agent`。

已扫同域消费者：卡片、页头、欢迎区的展示规则统一；设置对话框标题/placeholder、
定义包、选择器 value、查询与路由使用稳定标识属于其现行契约，未顺手改成展示名。

## 本轮发现：Agent detail 缓存只写不读，返回窗口也不刷新

`useAgents` 更新/导入和 AgentChat 创建成功都写 `agentKeys.detail(name)`，但原
`useChatAgent` 使用手工 getAgent + ref，生产没有任何该 key 的订阅。实际 mounted
AgentWelcome 与模型投影在设置 mutation 成功后仍显示旧值；两个消费者发出两次 GET；
focus 返回不重读；已验证创建结果写入缓存后也不能单靠该缓存驱动展示。四条原实现均
真实 RED，不是单纯的字符串或 key 存在检查。

现 useChatAgent 实际 useQuery 订阅同一个 detail key。设置与导入 cache 写入直接驱动
会话，AgentChat 创建成功只发布缓存，不再另写 agent/resolved。bootstrap 仍 disabled，
其创建 state machine 独占五次有限验证读取；focus 和 invalidate 也不能启用额外 GET。
普通 detail 与 React useAgent 的 stale-on-focus 行为一致，局部显式 true 固定该 hook
的独立契约，不改变其他 owner 的策略。后台刷新保留已解析内容，未知原始 error 可读；
账户切换同步 reset 当前 detail，API 返回前同时检查 Query signal、账户标识和 workspace
generation。Query 的 observer 生命周期共享/取消请求，未另建 server-state 镜像。

全调用点核对：useChatAgent 的唯一生产入口是 AgentChat；useAgents 的实际入口为 Agent
gallery 与 ScheduledTaskFormDialog，更新和导入均通过该 lifecycle owner 写入 key。
创建验证 useAgentCreationSession 仍是独立有限事务，验证成功才发布真实 Agent；
UserPreferencesBoundary 在真实账户切换时先隐藏子树、取消/移除 workspace queries 再
重挂载，新 hook 的局部同步 retirement 不替代这个账户边界。

新 `chat-agent-query.dom.test.ts` 挂载真实 AgentWelcome、useChatAgent、useAgents 与
VueQueryPlugin，证明 mutation、focus、显式失效、双 observer 去重、bootstrap 发布与零
补读、A→B→A 迟到响应、最后 observer 才取消、初始未知错误、后台失败保留。原
chat-agent ownership 六类退休断言和 presentation 异步 owner 断言全部保留。原真实
`agent-chat.spec.ts` 欢迎场景增强 detail 请求计数与浏览器 visibilitychange 后 header /
welcome 更新；新构建执行前仍记 UNRUN。

## 本轮发现：两个新宿主读取了桌面侧栏状态

`PluginPage.vue` 和 `CapabilityCenter.vue` 的 SidebarTrigger 均带 `md:hidden`，却从
useWorkspaceSidebar 读取桌面 open。默认桌面展开、移动抽屉关闭时，它们画的是收起图标；
移动抽屉切换也不会改变这份桌面状态。当前 React primitive 已按
`isMobile ? openMobile : open` 选择，Vue 另外三个组件此前也已接对。

两个宿主现在直接读取 mobileOpen；useWorkspaceSidebar 的旧注释同步修正，不再声称
React 仍有相同缺陷。沿全部调用点复核结果如下，未另造侧栏状态 owner：

| 生产消费者              | 实际语境           | 状态来源                            |
| ----------------------- | ------------------ | ----------------------------------- |
| AgentChat 页头          | 仅移动显示         | sidebarMobileOpen，即 mobileOpen    |
| WorkspaceContainer 页头 | 仅移动显示         | sidebarMobileOpen，即 mobileOpen    |
| PluginPage 页头         | 仅移动显示         | mobileOpen                          |
| CapabilityCenter 页头   | 仅移动显示         | mobileOpen                          |
| ThreadSidebar 展开头    | 桌面与移动抽屉共用 | isNarrow ? mobileOpen : sidebarOpen |
| ThreadSidebar 收起头    | 仅桌面分支         | sidebarOpen                         |

新 `tests/unit/workspace-shell/sidebar-hosts.dom.test.ts` 实际挂载两个宿主、真实
useWorkspaceSidebar 与真实 ThreadSidebarShell/Reka Sheet；四条原坏实现全部失败，
修复后全部通过。覆盖关闭/展开图标、实际点击打开和关闭 dialog、抽屉内焦点、关闭后
触发器可重新聚焦、桌面 collapsed 与 mobileOpen 隔离。测试没有把主动 focus 描述为
primitive 自动归还焦点。既有实际路由测试也增强了 native Enter 开关、图标、重新聚焦、
desktop cookie 不变，以及扩展页打开抽屉不 dispose 当前原生模块。

## W04：输入、模型、引用和提交

| 计划项                    | 当前真实生产链与边界                                                                                                                                                                                                                            | 可复核保护                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 模型能力、provider effort | `core/models/reasoning.ts` 读取 Gateway reasoning，保留开放 effort 字符串，按 values/aliases/default 解析；`capabilities.ts` 选择用户有效模型 → Agent 有效默认模型 → 目录首项，required/unsupported thinking 归一化                             | `model-capabilities.test.ts`、`model-settings.dom.test.ts`、`composer-model-selector.dom.test.ts`、真实 settings-model-sync                                |
| Agent null 继承           | `core/agents/settings.ts` 生成 null 清 override，false/0 不误作缺省；AgentReasoning 与通用 provider effort 是不同契约。AgentChat 等待 Agent/default model 解析，useThreadSettings 使用真实 thread UUID                                          | `agent-settings.test.ts`、`agent-components.dom.test.ts`、`composer-workflow.dom.test.ts`；backend lead-agent / model factory 仍是最终优先级与 kwargs 权威 |
| 不同引用通道              | `useComposerReferences → buildComposerReferences`；conversation display metadata、`conversationReferences` 本次 grant、`skill_references`、`extension_mentions`、项目文件 metadata 分开；知识范围由 AgentChat 捕获到 human kwargs               | `composer-submit.test.ts`、inline-reference / mention / knowledge 测试；backend `conversation_access.py` 与 `skill_activation_middleware.py` 实际校验      |
| 本次显式授权与 replay     | `core/threads/submit.buildRunContext` 删除 stored conversation_references；普通 send 只加本次显式 IDs，prepare replay 不传该 grant。capability 只有成功发现才启用，不能用失败缓存作为授权                                                       | submit / stream / capability 测试保留 3/4 references、16/17 skills、非法/重复项与失败状态；后端授权仍独立于显示元数据                                      |
| 草稿、语音、润色          | `ChatComposer → useComposerDraft / useComposerReferences` 是真实草稿/引用消费者；Voice 与 Polish 独立 scope、abort/dispose；润色捕获原文及身份，不能覆盖后来文本；旧 skill 草稿转为当前 inline token                                            | composer-draft-lifecycle、composer-workflow、voice-input / polish / mentions 测试；公开可选 legacy skillName 兼容见下文                                    |
| command / upload submit   | `ChatComposer → useComposerSubmission` 独占 compact/goal/upload-submit，epoch + AbortController；同步捕获 model/context、草稿、附件及 host quote/knowledge，accepted 才退休，失败保留，重试 ID 与上传 descriptor cache 稳定                     | composer-workflow / session-owner / submission-snapshot；实际 HTTP snapshot fixture                                                                        |
| new URL adoption 与锁     | submission scope 是 user + 实际 target thread UUID + agent；同 target 的 new→URL adoption 不取消已接受 run，换用户/Agent/new UUID 必须取消。UI/voice/polish 草稿 scope 仍含 threadKey；localUploading 纳入 AgentChat disabled 与 knowledge slot | A→B→A、same-target adoption、upload lock/storage sync、Stop 保持 active run 并向服务端取消回归                                                             |
| timezone                  | `useThreadStream` 普通 submit 与 replay 都合入 `clientTimezoneContext()` 返回的 IANA 时区，未只在调度页面加字段                                                                                                                                 | submit 单元与真实 run wire 场景                                                                                                                            |

没有把纯 helper 的存在当接线：以上都追到 ChatComposer/AgentChat 的实际调用和
useThreadStream 的 wire 构造。后端 conversation read 权限、Skill 整批原子激活与模型
factory 最终约束仍在；本轮未改后端来迁就 Vue。

## W08：扩展模块、宿主、动作和 mentions

| 计划项                      | 当前真实消费者                                                                                                                                                          | 身份与生命周期                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| inline-v1 / assets-v1       | `useFrontendExtensions → core/extensions/registry.ts`；Blob importer 成对 revoke，原生 assets module loader 保留相对 chunk/resource 图；单个贡献错误隔离                | 查询按 viewer user key；fetch、加载、返回前均检查 signal / account owner；未知运输不冒充成功                                                                   |
| 动态页面                    | `pages/workspace/extensions/[namespace]/[surface_id].vue → PluginPage → PluginSurfaces → PluginSurface`                                                                 | 未知 namespace/surface 显示不可用、Reload、返回能力中心；模块/资源404另有真实 API fixture                                                                      |
| 侧栏导航                    | `ThreadSidebar → PluginNavigation → pluginPages`                                                                                                                        | 仅已启用、有效导航贡献、当前 viewer；移动导航关闭当前抽屉                                                                                                      |
| 普通与 Agent 工具栏         | 两条路由共用 `AgentChat → ConversationExtensionActions`                                                                                                                 | thread/user/catalog/locale 变化退休 owner，busy 与迟到 toast 不进入新页面                                                                                      |
| 侧栏行菜单                  | `ThreadActionsMenu → useConversationExtensionOwner → ConversationExtensionActions placement=menu`                                                                       | row owner 跨菜单 dismiss 保留动作，不与短命菜单 content owner 混用；换 row/账户/语言仍取消                                                                     |
| backend action / navigation | `bindFrontendServices` 从已安装 contribution 固定 namespace、viewer header、backend_actions allowlist；`openConversation` 读真实 thread metadata 决定 custom Agent 路由 | callBackend await 前后 assert owner；导航 await 后再检查，卸载/身份更换不导航、不通知新页                                                                      |
| surface mount / dispose     | `PluginSurface → mountSurface`，每次 host scope 替换 cleanup，ShadowDOM 只隔离样式                                                                                      | AbortSignal 传入扩展，dispose/移除 root；异步 continuation 仍受现 host owner 约束                                                                              |
| @mention provider           | `MentionPicker → useExtensionMentions → searchExtensionMentions`                                                                                                        | query/thread/account/locale/catalog scope，150ms debounce、每 provider 超时与独立错误，迟到/取消结果不回写；popup 几何观察实际 composer/祖先和 visual viewport |

生产接线对应 `extensions/registry.test.ts`、`extensions/hosts.dom.test.ts`、
`extensions/services.test.ts`、mentions 测试和 `tests/e2e/extensions.spec.ts` 的两种真实
运输/相对资源/退出 dispose；正式 parity 的扩展动作、页面与引用状态继续负责双端 UI。
本轮只重跑了包含宿主的定向集合，未重新宣称全部 W08 浏览器通过。

## W12：历史负担、职责落点与门禁

| 整理项                       | 当前生产事实与必要保留                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AgentChat                    | 实际消费 useChatThreadOwner、useThreadStream/useActiveThreadRun、useAgentCreationSession、useArtifactsPanel、useSidecarSession；页面保留 route/Agent/project 与互斥面板编排，不另持可写 run 镜像。旧 absolute human 编辑浮层、sidecarReady 镜像已退役                             |
| Agent detail                 | useChatAgent 实际订阅 agentKeys.detail，创建/设置/导入写入同 key；旧手工 getAgent/ref 已退役，AgentChat 不再另写 agent/resolved。普通 focus refresh、bootstrap 零补读、账户与最后 observer 取消有实际消费者回归                                                                   |
| ChatComposer                 | submission 独立生命周期与 draft/reference/voice/polish 分离；组件仍负责 DOM focus、editor、selection。typed slash 与当前 inline skill selection 保留，没有重建不可写入的 selectedSkill owner                                                                                      |
| MessageList / virtual scroll | MessageList 只读 scroll position、发动作/分页/追尾意图；VirtualMessageList 是唯一 scrollTop/scrollTo、锚点、动态测量/resize owner。所有断点保持真实 native scroller；welcome/new 的后备布局不冒充消息滚动 owner                                                                   |
| workspace change anchor      | MessageList 实际调用 `getWorkspaceChangeAnchorGroupIndices`，原业务 inline 第二份算法已移除；混合 AI/tool、同 run、processing-only 等原行为测试保留                                                                                                                               |
| Artifact draft               | AgentChat 挂 useArtifactsPanel，后者唯一创建 useArtifactDraft，ArtifactPanel 消费传入 owner；加载、保存、冲突、dirty 与 URL 生命周期没有另建第二套草稿                                                                                                                            |
| Lark / features / cache      | `capabilities/LarkPluginSettings.vue → useLarkIntegrationFlow` 是实际授权/弹窗/poll/cancel链；服务端状态继续 Vue Query，useWorkspaceFeatures 不另维护重复可写手工缓存                                                                                                             |
| 孤立旧实现                   | 旧 thread-context、auth/proxy-policy、buildProxyRules、input/keyboard、uploads/prompt-input-files/FileUIPart、artifacts/editing、api/feedback 均无旧生产入口；现行 Nitro proxy policy、workspace shortcuts、submission-files、draft/policy 和 feedback 数据/backend contract 保留 |
| 必要兼容边界                 | useComposerDraft/useComposerSubmission 公开可选 skillName 兼容仍有明确历史草稿迁移语义；旧启用 Skill 转唯一 inline token，失效 Skill 保留可编辑字面量。历史消息 SlashSkillChip 只读展示仍有消费者，不按零新选择写入误删                                                           |
| Markdown 边界                | MessageMarkdown 为唯一产品 adapter，异步 MessageMarkdownContent 集中默认 rich map 并优先 caller override；MarkdownPre 显式 MarkdownCodeBlock 别名避免 Nuxt transform 与通用 tool CodeBlock 冲突                                                                                   |
| 菜单 primitive               | 原手写 translate 坐标补偿已移除，Dropdown native collision/trigger reference 解决真实位置问题。z-index 数值不能机械替换，仍由嵌套真实 hit-test、键盘/焦点和最终双端状态判据验收，未新增差异豁免                                                                                   |
| 历史固定规模                 | combined reflow coverage 按当前登记参与状态计算并有漏扫描负控；不固定旧61。源码库存保留实际扫描范围与必要 SFC 计数，不把减行/减文件当目标。历史轮次评论仍有部分保留，但不参与运行契约/完成判定                                                                                    |

CI 的当前可执行链也逐项检查：`frontend-vue-verify.yml` 实际执行 verify、asset-budget、
隔离 standalone-sim、精确 audit、container-smoke、全部 mock/real-backend/external、
mandatory product/auth/session cross-app aggregate，以及 Linux ARM64 产品视觉无更新基线
检查。`frontend-vue-parity.yml` 同时消费 icon-parity 与正式双端入口。正式比较设置
PARITY_REQUIRE_REACT=1，不允许缺兄弟项目算 PASS。

verify/mock/real/external/cross/visual job 均有 failure artifact 上传；独立模拟失败目录用
include-hidden-files 保留。`make consumer-check` 是计划中的独立 tarball 类型/运行门禁，
本次未把它说成 verify 或 CI 已自动执行的子步骤，最终仍需 root 实际执行并记录退出码。
两种鉴权、proxy options、degraded Gateway 不合并为一套伪拓扑。

## W00 交叉复核与仍待执行的门禁

当前 generator 的 NOT_CONSUMED 已为空，六个 JSON 契约进入实际生成；新 scheduled
goal/outcome、host run error、lifecycle event/reason、UI error 和 origin 字段常量在
`core/scheduled-tasks/{goal-outcome,run-error,events,errors,messages}.ts` 及 thread origin
的真实业务解析中消费。不是只把登记表改成 CONSUMED，也没有新增 idle constants；详细
责任人证据见 `evidence/w00-scheduled-contract-stage36/production-freeze.json`。

新源仍需统一正式验证：完整 canonical verify/asset、全部 mock/backend/external、完整
product/auth/session cross-app、Linux 8 visual/12 route payload/asset/9 PNG 回读，以及隔离
standalone basic / --with-e2e。Stage34b Linux 的精确快照 PASS 只覆盖其捕获输入，已明确是
pre-W00、pre-本次展示名/移动宿主修复 checkpoint；不能外推这些后改源。

本轮不修改三类既定排除范围，不新增 parity 豁免，不降低任何视觉/几何/时长阈值。
没有启动占用 root cache 或固定 801x 的构建与浏览器进程。

## 本轮实际执行证据

持久证据目录：`docs/reports/evidence/composer-final-audit-stage35/`。

- Agent DOM 原坏实现：5 条中 2 FAIL / 3 PASS，两个 surface 的展示名实际错误；修复后 5 PASS。
- mobile 宿主原坏实现：4 条全部 FAIL，关闭/展开图标均未反映真实 mobileOpen；修复后 4 PASS。
- Stage35 六源 checkpoint 定向合并：9 files / 79 tests PASS，直接 exit 0，无 unhandled errors。
- Stage36 当前生产接线定向合并：10 files / 87 tests PASS，直接 exit 0，无 unhandled errors。
- Agent detail 原坏实现：4 条消费者测试全部 FAIL；接线后包含原 ownership/presentation/useAgents 的 4 files / 26 tests PASS，直接 exit 0，无 unhandled errors。
- Stage35 两次 app/tests 类型、最后 browser fixture tests 类型、两类 scoped lint/格式全部 exit 0。
- Stage36 当前 app/tests 类型、scoped lint、最终格式检查均直接 exit 0；并行删除旧 MCP 文件时曾出现收集竞争，等删除稳定后以相同规范命令复跑通过，原日志保留。
- 真实整页、Linux 与完整独立模拟：新源本报告阶段 UNRUN，交统一冻结后的完整门禁。
