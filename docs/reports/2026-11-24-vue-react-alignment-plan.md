# Vue 对齐 React：新基线审查结论与对齐计划（2026-11-24）

本文是第 3 步的产出，取代此前所有待对齐清单、挂账文档和交接（已删除，原文在 Git 历史里；其中仍然有效的裁决已并入本文）。`frontend-vue/baseline/parity-diff.json` 等对照基线数据仍在，按 P0 处理。审查以代码为准：每条结论都来自对两端当前源码的直接比对，文件和行号写在条目里。React 是参照，只改 Vue（判据与范围见 [执行约定](2026-11-23-r03-resume-plan.md) 第 0.1、0.2 节）。

## 1. 审查范围与方法

- **基线：** 上游冻结在 `624a64a15`，`main-wc` 已合入（`fc9efc159`）。
- **React 变化范围：** `a93900d4e..624a64a15`。`a93900d4e` 是 Vue 最后一次记录“已审阅上游”的位置（`frontend-vue/baseline/upstream-marker.json`，2026-09-16），比 10-09 的同步点更早，所以这个范围把两段都覆盖到。期间有 210 个提交改动了 React 产品代码（不含内容站），全部来自上游。
- **第一层，全量静态比对：** 路由、后端接口调用、词典 key、e2e 用例，从两端源码现场提取，双向比较。
- **第二层，逐提交核对：** 先为每个提交自动计算三个缺口信号（新增的词典 key、接口、e2e 用例在 Vue 是否存在，只与 React 当前代码比较）。有信号的，归入功能缺口；信号干净的，逐个读 React 改动，再到 Vue 找对应实现。
- **第三层，运行时实测（尚未执行）：** 跨端对比测试（`e2e-parity`），兜住静态读不出的差异，见第 6 节。
- 审查过程的逐条记录在外接盘 `/Volumes/edisk/deer-flow/docs/reports/evidence/resume-2026-11-24/alignment-audit-notes.md`。

**审查覆盖：** 210 个提交全部有结论。10-09 之后 120 个：信号干净的 69 个逐个读改动核对；有缺口信号的 51 个按信号归入功能缺口，其中只缺对照场景的 13 个又逐个核对了代码（见第 3 节说明）。10-09 之前 90 个：修复类 38 个与抽样 12 个逐个核对；功能类 40 个核对了词典、接口、用例和 Vue 未引用 key，功能细节留给第三层实测。

**11-24 复核补充的范围：** 本仓自己对 React 的本地修改（第 8 节）；React `src` 以外的改动（依赖、配置、静态资源、`tests/e2e` 以外的用例）；Vue 调用的接口在后端是否仍存在；扩展宿主契约。

## 2. 第一层结论：全量静态比对

| 维度 | 结论 |
| --- | --- |
| 路由 | React 有、Vue 没有的：`/share/[share_token]`（分享页）、`/workspace/usage`（用量统计）；其余均为已豁免的内容站。Vue 独有的 `/__m0/*` 是测试夹具页 |
| 后端接口 | React 调用、Vue 未调用 27 个，全部属于第 3 节的功能缺口 |
| 词典 | React 有、Vue 没有的 key 约 440 个（`frontend-vue/baseline/upstream-i18n-map.json` 的 pending），全部属于第 3 节的功能缺口 |
| e2e 用例 | 40 份 React 用例 Vue 未覆盖（`parity-scenario-coverage.json` 的 pending），全部属于第 3 节的功能缺口 |
| 未引用 key | Vue 词典里有、界面没用的 65 个 key，交叉 React 用法后无新增缺口（真正被 React 使用的 6 个，分属豁免、已列缺口或 React 死代码） |
| `tests/e2e` 以外的 React 用例 | 审查范围内新增 3 份，Vue 覆盖率门禁不统计：`e2e-auth/workspace-login-return`（对应 B18）、`e2e-real-backend/project-trash`、`e2e-real-backend/workspace-search`（对应 F5）。需在 Vue 的 auth 与真实后端 e2e 中补对应用例 |
| React `src` 以外的改动 | 依赖：渲染相关库无升级（仅新增 popover 组件库、zod 4），无界面影响；新增 16 个插件图标 Vue 已全有；演示数据只涉及已豁免的 Showcase |
| Vue 调用的接口 | 97 个调用在冻结基线的后端里都存在（10 个初看缺失的均为导入路径误识别、WebSocket 或 URL 前缀） |

## 3. 功能缺口：Vue 整块没有（来自 51 个有缺口信号的提交）

每项后面是对应的上游提交、React e2e 用例（Vue 需新建对照场景）和主要接口。

| 编号 | 功能 | 上游提交 | 对照用例 / 接口 |
| --- | --- | --- | --- |
| F1 | 工具调用审批：高风险工具人工确认、Ask/Auto/Full 权限模式、授权撤销 | `0d04322d4` `3d826c6d9` | `tool-approval`；`/threads/{}/tool-approvals`、`.../grants`、`/runs/{}/tool-approvals/{}` |
| F2 | 运行中排队（Queue）与插话（Steer），失败重试 | `44e372dd7` `3b627af8e` | `run-input-retry`；`/threads/{}/inputs`、`/runs/{}/inputs`、`/runs/{}/inputs/{}` |
| F3 | 对话分享快照：分享对话框、撤销、只读分享页 `/share/[share_token]`、复刻 | `4f3a8b790` | `share-snapshot`；`/threads/{}/shares`、`/shares/{}` |
| F4 | 用量统计页 `/workspace/usage` | `7c3d2551b` | `usage-dashboard`；`/console/*` |
| F5 | 全局对话搜索，跳转并定位到命中消息 | `dba950443` | `workspace-search`、`workspace-search-review`；`/search`、`/threads/{}/messages/around` |
| F6 | 语音录音转写（配置了 STT 服务时）。Vue 文案已是上游的“录音转写”，行为仍是浏览器听写，须改行为 | `5eb78f653` | `voice-input`；`/voice-input/transcribe` |
| F7 | 选中产物段落：引用到输入框、改写 | `c87e238dd` | `artifact-selection` |
| F8 | 附件改进与 Office 预览（Word/Excel/PPT，经扩展的 `artifactPreviews` 浏览器契约） | `81de0761e` | `file-transfer`、`office-preview-interactions`、`office-preview-navigation`、`office-preview-resources`、`word-outline` |
| F9 | 项目记忆：可见的项目记忆、提取控制、提升 | `9699f04cd` | `project-memory`；`/projects/{}/memory*` |
| F10 | 模型管理：服务商预设、目录发现与导入、聊天里搜索模型、按范围控制模型；含改连接后的 Key 保留规则（`294de7cef`） | `e98179a9d` `2145c9ab1` `0baa99ca9` | `model-catalog`、`model-control-navigation`；`/models/resolve` |
| F11 | 用户管理与账户停用（含静态站门禁、深链回退、`disabled` 字段、登录错误文案） | `2f4f4d4b6` `47d8ff13b` `c89fed0be` `21fb08053` | `/v1/admin/users*` |
| F12 | 渠道通知：IM 通知开关、微信/QQ 投递、群通知、绑定码对话框常驻 | `cb90f5dca` `c994826d0` `5ae95e6a3` `ab8cd4e10` | `channel-notification-settings`、`scheduled-notification-groups`、`mention-caret-handoff`；`/channels/notification-preferences` |
| F13 | 聊天目标状态栏：停止原因、达成时间、循环/步数上限说明 | `0fe6e63a6` `059758f32` `c48447a4a` | `goal-status` |
| F14 | 技能 YAML 加载错误诊断、重新加载 | `782fed913` | `skill-diagnostics`；`/skills/diagnostics/custom`、`/skills/reload` |
| F15 | 智能体工具权限配置、模型目录不可用时保留推理默认值、保存失败重试 | `65fa321ec` `34316550d` `dbebd18dd` | `agent-reasoning-settings`；`/agent-tool-groups` |
| F16 | 我的 MCP 连接：按用户的浏览器 OAuth 授权 | `c4ba92114` | `/mcp/user-oauth*` |
| F17 | 扩展详情页（使用说明、要求、加载状态、窄屏布局）与知识库状态中心。目录本身已于 11-24 移植 | `6fe87b65f` `3067b5a5b` `d0ec8dcc5` | `extension-detail`、`knowledge-center`；`/extensions` |
| F18 | 消息列表与流：回到底部按钮、发送后把消息钉在顶部、流式服务端错误可操作、工具结果成败、子任务历史回填保留实时步骤、相对链接跳到产物、产物草稿跨导航保留（按账户）、隔离 HTML 预览资源鉴权、实时浏览器握手超时；产物列表可滚动待实测 | `ba4e60dec` `ec44f2ff3` `259894028` `a1b89d043` `3dd9e8841` `0530d0c7c` `c5fd453c3` `8008a6195` `0d3a562c5` `db7f91911` | `scroll-to-bottom-button`、`scroll-on-send`、`chat-stream-error`、`subtask-backfill`、`relative-artifact-link`、`artifact-draft-navigation`、`artifact-list-scroll` |
| F19 | 子智能体批次：结果查看、请求的后续工作与前置依赖 | `ce0fa4c11` `593ba4945` | `batch-followup-rejoin` |
| F20 | 定时任务：只有日期的执行时间按任务时区零点显示 | `91a88e08e` | `scheduled-task-date-only` |
| F21 | 其他：会话检查在网络失败后恢复、按界面语言回复（与第 5 节 R1 同源）、Webz 新闻搜索结果 | `5dc508b40` `4b1e06bbf` `a333ac318` | `auth-network-recovery`、`chat-language-preference`、`web-search-results` |
| F22 | 知识检索第二阶段：知识范围与只读目录拆开，按能力接口决定可选范围（11-24 复核补入） | `6bc1020d3` | `/knowledge/capabilities` |
| F23 | 扩展宿主契约（11-24 复核补入）：React 的扩展前端契约多出 `artifactPreviews`（含 `readFile`、阅读进度保存与恢复、`onError`）、`requestBackend`、`documentation`、`model_tools`、`runtime_only`。按 React 契约写的扩展（如上游 Office 预览扩展）在 Vue 宿主中无法加载。F8、F17 依赖本项 | `81de0761e` `6fe87b65f` 等 | React `core/extensions/contracts.ts` 对照 Vue `app/core/extensions/contracts.ts` |

**说明：**

- 有缺口信号的提交没有逐行读完。实现每一项时，以该项列出的上游提交完整 diff 为规格，逐条补齐；提交里顺带的修复也一并处理（如 `5ae95e6a3` 还修了提及插入后的光标位置）。
- 只缺对照场景（没缺词典和接口）的 13 个提交，复核时逐个看了 Vue 代码：`4210854a9`（Markdown 产物本地图片）Vue 已实现，只缺对照场景；`338f8819a`、`49adb0ede` 改列为行为缺陷 B31、B30；`db7f91911` 待实测；其余 9 个确认缺失。
- `docs-search-mobile`（`66f00e7b8`）属于 docs 内容站，已豁免；它带来的 5 个 `home.search*` 词条目前挂在 i18n 待办里，应改记为豁免（P0）。

## 4. 行为缺陷：Vue 有这个功能，但没跟上上游的修复

全部经代码核对。“安全”指影响所有用户的安全问题，优先修。

| 编号 | 问题 | 上游提交 | Vue 位置 |
| --- | --- | --- | --- |
| B1 | **安全：** 登录后的 `next` 回跳地址未拒绝控制字符，`/\n//evil.example` 可绕过检查跳到外部站点 | `9c00fd839` | `app/core/auth/next-path.ts` |
| B2 | **安全：** 工具步骤里模型或服务商给的链接未过协议白名单，可能是 `javascript:` | `d540be7e2` | `app/components/chat/ProcessingToolStep.vue:326/339/362`（Vue 已有 `isSafeMarkdownHref` 未用上） |
| B3 | **安全/可用性：** CSRF cookie 格式错误时解码抛错，所有接口调用失败 | `52f6ff078` | `app/core/api/fetcher.ts:34` |
| B4 | 上传返回 `success: false` 时仍发送消息、清空输入框 | `b8bb72836` `4e20cbb4d` | `app/core/uploads/api.ts`（只判 `response.ok`） |
| B5 | 记忆修改后被在途的旧读取覆盖回去 | `a1f23b294` | `app/composables/useMemory.ts:37` |
| B6 | 后台任务取消后被旧轮询覆盖回“运行中” | `097fa6dca` `d59738649` | `app/composables/useBackgroundTasks.ts:116` |
| B7 | 服务商重复使用工具调用 ID 时，工具步骤显示别的步骤的结果 | `178a9ab45` | `app/core/messages/utils.ts:877`（只按 ID 查） |
| B8 | 导出对话只导出已加载的部分 | `f71999d99` | `app/components/workspace/ExportTrigger.vue:65` |
| B9 | 交接过来的产物（`present_shared_artifact`）刷新后从历史恢复不了 | `fc7c7e012` | `app/core/artifacts/`（无此工具名） |
| B10 | 重连后只有思考内容的消息被当作已完成回答 | `36ee986d5` | `app/core/threads/local-turn-order.ts:118` |
| B11 | write-file 产物地址解析未加防护，格式不对时直接抛错 | `f0ba28036` | `app/core/artifacts/loader.ts:140`、`ArtifactPanel.vue:72/87` |
| B12 | 单次定时任务在夏令时切换时刻的换算与调度器不一致 | `96f930f5b` | `app/core/scheduled-tasks/cron.ts:562` |
| B13 | 无效的 cron 字段（如 `99 * * * *`）被当成预设显示 | `35d33bea7` | `app/core/scheduled-tasks/cron.ts:261` |
| B14 | 运行计时器不按服务端开始时间，重开对话从零计 | `728446fe0` | 无对应逻辑 |
| B15 | 分享链接写死上游演示站 `deer-flow-v2.vercel.app` | `c8d5c108f` | `app/core/threads/thread-actions.ts:12` |
| B16 | 实时浏览器转发组合键丢掉 Alt/Shift | `ff07f87cc` | `app/core/browser/keyboard.ts:48` |
| B17 | 复制的引用 Markdown 未转义方括号、带括号网址未加尖括号，链接会断 | `a9bd03ef5` | `app/core/citations/sources.ts:68` |
| B18 | 401 跳登录只带路径、丢查询参数（路由守卫已正确） | `3f71b2e13` | `app/core/api/fetcher.ts:94` |
| B19 | 已登录访问 `/login` 用普通跳转，返回键回到登录页 | `9c00fd839` | `app/pages/login.vue:182` |
| B20 | 请求封装只取 `Request.url`，丢掉 Request 自带的 method/headers/signal | `17f2bea27` | `app/core/api/fetcher.ts:62` |
| B21 | 邮箱仍做严格格式校验，后端接受的账号（如 `a&b@example.com`）在 Vue 被判为会话异常 | `1792e4e43` | `app/core/auth/types.ts:7` |
| B22 | 项目下对话的“更多”按钮溢出侧边栏 | `ded0f0b69` | `ProjectThreadGroup.vue:72`、`ArchivedProjectsGroup.vue:62`（缺 `w-auto`） |
| B23 | 知识检索引用统一（第一阶段）：缺消息内知识引用与证据展示、子任务卡片引用 | `201b9840c` | 仅有 `KnowledgeSourcesPanel.vue` |
| B24 | 子任务步骤分页：游标不前进时不停、有页数上限会截断 | `5f9a521d6` | `app/core/tasks/api.ts:37` |
| B25 | 待办没有“受阻”状态样式 | `25a744a99` | `app/components/workspace/TodoList.vue:110` |
| B26 | 表格单元格、记忆条目按 UTF-16 截断，emoji 处出乱码 | `8337a80ae` | 无 `truncateToCodePoints` |
| B27 | 运行摘要按 UTF-16 截断 | `6b2ac5855` | `app/core/scheduled-tasks/format.ts:282` |
| B28 | 网页抓取标题不认 Tab 分隔 | `ec07de961` | `app/core/utils/markdown.ts:8` |
| B29 | 文件语言识别会命中原型链上的键 | `59743568b` | `app/core/artifacts/policy.ts:207` |
| B30 | 编辑消息时不判断输入法组合态：中文输入法选字时按 Esc 或 Ctrl+Enter 会取消或提交编辑（11-24 复核补入） | `49adb0ede` | `app/composables/useMessageTurnActions.ts:113` |
| B31 | 从预设切到自定义 cron 时，只在原始表达式为空才按当前预设生成，会留下过期表达式（11-24 复核补入） | `338f8819a` | `ScheduledTaskScheduleInput.vue:204` |
| B32 | Vue 仍按本仓已撤销的分块写入工具（`begin_artifact_write` / `append_artifact_chunk` / `finalize_artifact_write`）自动打开产物、展示工具步骤；合并上游时后端与 React 已删除这组工具，改用 `write_file` 的 `append` 分段写入（Vue 已支持）。删除这条死分支及其单测和 e2e 断言（11-24 文档清理时补入） | `ceed64e7b` | `app/composables/useChatPanels.ts:276`、`ProcessingToolStep.vue:67-69` |
| B33 | 工作区变更里 `symlink_created` 状态：React 有意按“已修改”显示（`frontend/src/core/workspace-changes/summary.ts:46` 的注释、`workspace-change-panel.tsx:221` 的 `statusLabel`），Vue 显示 Vue 独有的“新增符号链接”。11-23 已裁决 Vue 跟随 React：映射到 `modified`、排序名次不变，删除 `workspaceChanges.symlinkCreated` 并同步词典、`i18n-keys.json` 与单测（11-24 复核补入） | 11-23 裁决 | `app/core/workspace-changes/presentation.ts:16` |

**实现时还需确认（代码读不出确定结论）：**

- `7fd0c0cb3` 已取消的批次不再显示条目“重试”：`SubagentBatchItems.vue` 未见批次状态判断。
- `cc013c968` 只有思考内容的 token 步骤归类：Vue 用量模型写法不同，需按用例核对。
- `c11ba8470` 手机端桌面偏好为收起时，抽屉仍显示完整导航与触发按钮状态：Vue 已有移动抽屉，React 新增 335 行断言，需跨端实测。

## 5. 请求一致性缺口（按第 0.2 节“请求逐项一致”）

| 编号 | 问题 | 位置 |
| --- | --- | --- |
| R1 | 运行请求的 `context`：React 带 `thread_id` 与 `locale`（后端据 `locale` 决定回复语言），Vue 主动去掉 `thread_id`、不带 `locale` | React `core/threads/hooks.ts:398`；Vue `app/core/threads/submit.ts:121`（`thread_id` 在 146 行被剔除） |
| R2 | 查询失败重试：React 用默认规则（失败最多重试 3 次，含 HTTP 4xx/5xx），Vue 只在网络中断时重试 | React `components/query-client-provider.tsx:35`；Vue `app/plugins/vue-query.ts:22` |
| R3 | 合并时记录的反向差异逐项复核：发送后强制滚到底（上游改为钉在顶部，即 F18）；回调页位置；Vue 仍识别已被上游去掉的分块写入工具名（即 B32）；服务端忽略 `Range` 时 Vue 只读前 1 MiB（`app/core/artifacts/loader.ts:89`），React 合并时删掉了本仓的 `response-body.ts`、改为整段读取——后端支持 `Range`（`backend/app/gateway/routers/artifacts.py:243`），两端请求与结果相同，属于用户看不见的内部差异，保留 Vue 现状；CodeMirror/Lezer 版本固定（只影响代码高亮颜色，按可见差异处理） | 见 `MERGE-DECISIONS.md`“留给第 3 步” |
| R4 | **待用户裁决。** 创建运行的 `Idempotency-Key` 请求头：Vue 普通发送默认用用户消息 ID 作幂等键（`app/composables/useThreadStream.ts:887`），重新生成用新 UUID（`:1090`），由 `app/core/agent-deerflow/run-protocol.ts:133` 写进请求头；React 两种都不发（`core/threads/hooks.ts:3441` 的注释写明）。后端按这个键去重（`backend/app/gateway/routers/thread_runs.py`）。“请求头逐项一致”要求 Vue 跟随 React 不发；执行约定第 0.2.1 节又要求保留“重复创建运行”这类缺陷修复。两者冲突，由用户决定 | Vue `useThreadStream.ts:887`、`:1090`；React `hooks.ts:3441` |
| R5 | 登录页、安装向导页的 `GET /api/v1/auth/me`：React 在服务端取（`frontend/src/app/(auth)/layout.tsx:18`），Vue 在浏览器取（`app/middleware/auth.global.ts:43`）。后端收到的是同一个接口、同一套判定。11-23 已裁决接受这一架构差异，保持 `baseline/parity-auth-diff.json` 中的登记；按新判据维持该裁决。仍要复核一件事：`/setup` 上中间件和 `app/pages/setup.vue:53` 是否各发一次，重复就去掉 `setup.vue` 那次 | Vue `auth.global.ts:43`、`setup.vue:53` |

## 6. 第三层：运行时实测（待执行）

静态核对覆盖不到的差异，必须在浏览器里把两端跑起来比：请求时机与次数、看得见的界面差异、交互结果。执行前先完成第 7 节 P0，否则比对结果会混入已不要求的维度（读屏、Tab 顺序、焦点落点、像素几何）。

- 覆盖：现有 90 个已覆盖场景，加上第 3 节新增功能的对照场景；三种布局 × 两种语言 × 两种主题。
- 只计入：请求档全部差异；其余档按第 0.2 节，只计用户看得出的差异。
- 10-09 之前 40 个功能提交的细节一致性、上面三条“需确认”，都以这一轮实测为准。

## 6.1 第三层之前要先做的核实

- **身份对应是否够用：** 执行约定第 0.2.1 节第 2 条要求保留身份对应、去掉穷举证明，并核实现有对应链路能否支撑请求档比对。本次静态审查没有做这一项，P0 必须先做：用一个含随机 ID 的场景（新建对话发送、编辑重发）跑一次请求档比对，确认两端的用户消息 ID、运行 ID 都能对应上；幂等键只有 Vue 发，按 R4 的裁决处理。
- **入口：** 跨端实测经由 nginx 入口访问两端（生产即如此），不经 Vue 独立开发时的 Nitro 代理，避免把开发代理的请求头差异混进结果。

## 7. 执行顺序

| 阶段 | 内容 | 说明 |
| --- | --- | --- |
| P0 | 按判据调整 Vue 侧规则与测试：`frontend-vue/ARCHITECTURE.md` 对齐范围；`react-parity-scope.json` 与 `parity-scenario-coverage.json` 加入 Showcase 豁免；`home.search*` 改记豁免；跨端比对去掉 aria/Tab 顺序/焦点落点/像素档的计入；逐个处理只为读屏/键盘一致而存在的守卫；React 零消费者的 `conversation-reference-picker.tsx`、`reference-conversations-button.tsx` 登记进 `react-parity-scope.json` 的 `forbiddenUpstreamModules`；完成第 6.1 节身份对应核实 | 先改计划已完成（执行约定第 0.2 节），这里改代码 |
| P1 | 安全与可用性：B1–B3 | 改动小、影响所有用户，最先做 |
| P2 | 请求一致性：R1–R5（R4 先等用户裁决） | R1 同时解决 F21 的“按界面语言回复” |
| P3 | 其余行为缺陷：B4–B33 与三条“需确认” | 每条有明确位置，可逐条修、逐条加 Vue 单测 |
| P4 | 功能缺口：F1–F23 | 工作量最大。建议顺序：F18（消息列表与流，日常使用最频繁）→ F1、F2（对话流程）→ F23（扩展宿主契约，F8、F17 的前提）→ F3、F5（分享、搜索）→ F10、F11（模型、用户管理）→ 其余。每项同时补齐第 2 节列出的 auth / 真实后端用例，以及第 9 节对应的契约消费 |
| P5 | 第三层运行时实测，修复实测出的差异，再测一轮 | 见第 6 节 |
| P6 | 简化后的验收：按执行约定第 0.2.1 节的 R04–R12 处理表 | 只验证实际要用的部署方式 |

每个阶段完成后：Vue `make verify`、React `pnpm test`、backend `make test`（改到后端契约时）全部通过才提交；推送前问用户。

## 8. 本仓 React 本地修改（11-24 复核补入）

React 参照 = 上游 + 本仓保留的 React 修改。后者与上游相比差 158 个文件、约 7500 行，审查的提交范围只含上游提交，没有覆盖到它们。按内容分类：

- 对齐期间“两边同改”时补进 React 的修复：无障碍、本地化、窄屏换行、卸载后丢弃迟到结果、对话框与菜单定位、通知组件、Mermaid 与表格渲染（`core/streamdown/mermaid-renderer.tsx`、`table-renderer.tsx`）等。Vue 是这些行为的来源，判为同源。
- 身份观测接线（`core/diagnostics/*`）：只供跨端比对用，默认关闭。
- 其中纯键盘焦点类（如 `components/ui/dialog-focus-boundary.ts`）按第 0.2 节判据 Vue 不再要求。

处理：不逐个静态核对，由第三层实测兜底；合并时被上游重写或丢弃的本地实现，按 R3 逐项复核。

## 9. 待消费的后端契约（11-24 复核补入）

`frontend-vue/scripts/gen-contract-constants.mjs` 里暂记为“不消费”的三份契约，随对应功能一起接入：`thread_goal_contract.json` → F13；`knowledge_sources.v1.json` → B23、F22；`ui_locales.v1.json` → R1。

## 10. 文案已对齐、行为待补的条目（11-24 复核补入）

合并后为满足“同名词条两边同字”，Vue 有 19 条文案改成了上游说法（执行约定第 0.1 节第 4 条）。它们描述的行为分别由以下各项补齐，实现时不得回退文案：

| 文案 | 对应项 |
| --- | --- |
| `inputBox.voiceInputStart` / `voiceInputListening` / `voiceInputUnsupported` | F6 |
| `settings.models.formDescription`、`settings.models.provider`（zh） | F10 |
| `agents.agentCreatedPendingRefresh` | F15（保存失败重试） |
| `channels.scheduledUpdates.supported` / `supportedAfterConnect` | F12 |
| `settings.appearance.languageDescription` | R1、F21 |
| `subagentBatches.description` | F19 |
