# Vue 对齐 React：新基线审查结论与对齐计划（2026-11-24）

本文是第 3 步的产出，取代此前所有待对齐清单、挂账文档和交接（已删除，原文在 Git 历史里；其中仍然有效的裁决已并入本文）。`frontend-vue/baseline/parity-diff.json` 等对照基线数据仍在，按 P0 处理。审查以代码为准：每条结论都来自对两端当前源码的直接比对，文件和行号写在条目里。React 是参照，只改 Vue（判据与范围见 [执行约定](2026-11-23-r03-resume-plan.md) 第 0.1、0.2 节，请求比对口径见第 0.2.2 节）。11-24 晚的独立审核纠正了 B2、R5，补入 B34、B35、R6，并把 P0 写到可以照做的程度，审核记录见第 11 节。

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
| 后端接口 | React 调用、Vue 未调用 27 个。除 `/threads/{}/runs/{}/feedback` 外全部属于第 3 节的功能缺口。feedback 是 React 死代码：`message-list-item.tsx` 的点赞按钮只在收到 `feedback` 时渲染，而没有任何调用方传它，所以 Vue 不移植 |
| 词典 | React 有、Vue 没有的 key 441 个：439 个在 `frontend-vue/baseline/upstream-i18n-map.json` 的 pending，2 个是 `upstream-key-coverage.test.ts` 登记的别名（`common.closeBrowser`、`conversation.loadingConversation`）。pending 里除 5 个 `home.search*`（改记豁免，第 7.1 节第 3 条）外，都能对上第 3 节的功能缺口。反方向 Vue 独有的 key 116 个，待第 7.1 节第 9 条审查 |
| e2e 用例 | 40 份 React 用例 Vue 未覆盖（`parity-scenario-coverage.json` 的 pending），全部属于第 3 节的功能缺口 |
| 未引用 key | Vue 词典里有、界面没用的 65 个 key，交叉 React 用法后无新增缺口（真正被 React 使用的 6 个，分属豁免、已列缺口或 React 死代码） |
| `tests/e2e` 以外的 React 用例 | 审查范围内新增 3 份，Vue 覆盖率门禁不统计。`e2e-auth/workspace-login-return` 对应 B18，Vue 在 `tests/e2e-auth/` 补；`e2e-real-backend/workspace-search` 对应 F5，Vue 在 `tests/e2e-real/` 补；`e2e-real-backend/project-trash` 在 Vue 已有 `tests/e2e-real/project-trash.spec.ts`，对读两份断言、补上缺的即可 |
| React `src` 以外的改动 | 依赖：渲染相关库无升级（仅新增 popover 组件库、zod 4），无界面影响；新增 16 个插件图标 Vue 已全有；演示数据只涉及 Showcase，由现有 showcase 场景的跨端比对兜住 |
| Vue 调用的接口 | 97 个调用在冻结基线的后端里都存在（10 个初看缺失的均为导入路径误识别、WebSocket 或 URL 前缀） |

## 3. 功能缺口：Vue 没有或只有雏形（来自 51 个有缺口信号的提交）

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
| F8 | 附件改进与 Office 预览（Word/Excel/PPT，经扩展的 `artifactPreviews` 浏览器契约）。同一提交改写了产物下载，请求差异单列为 R6 | `81de0761e` | `file-transfer`、`office-preview-interactions`、`office-preview-navigation`、`office-preview-resources`、`word-outline` |
| F9 | 项目记忆：可见的项目记忆、提取控制、提升 | `9699f04cd` | `project-memory`；`/projects/{}/memory*` |
| F10 | 模型管理：服务商预设、目录发现与导入、聊天里搜索模型、按范围控制模型；含改连接后的 Key 保留规则（`294de7cef`） | `e98179a9d` `2145c9ab1` `0baa99ca9` | `model-catalog`、`model-control-navigation`；`/models/resolve` |
| F11 | 用户管理与账户停用（含静态站门禁、深链回退、`disabled` 字段、登录错误文案） | `2f4f4d4b6` `47d8ff13b` `c89fed0be` `21fb08053` | `/v1/admin/users*` |
| F12 | 渠道通知：IM 通知开关、微信/QQ 投递、群通知、绑定码对话框常驻 | `cb90f5dca` `c994826d0` `5ae95e6a3` `ab8cd4e10` | `channel-notification-settings`、`scheduled-notification-groups`、`mention-caret-handoff`；`/channels/notification-preferences` |
| F13 | 聊天目标状态栏：停止原因、达成时间、循环/步数上限说明。Vue 已有基础状态栏 `app/components/workspace/GoalStatus.vue`（67 行，React `goal-status.tsx` 296 行），在它上面补齐，词条见 i18n 待办里的 `inputBox.goalBar.*` | `0fe6e63a6` `059758f32` `c48447a4a` | `goal-status` |
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
- `docs-search-mobile`（`66f00e7b8`）属于 docs 内容站，已豁免；它带来的 5 个 `home.search*` 词条目前挂在 i18n 待办里，按第 7.1 节第 3 条改记为豁免。

## 4. 行为缺陷：Vue 有这个功能，但没跟上上游的修复

全部经代码核对。“安全”指影响所有用户的安全问题，优先修。

| 编号 | 问题 | 上游提交 | Vue 位置 |
| --- | --- | --- | --- |
| B1 | **安全：** 登录后的 `next` 回跳地址未拒绝控制字符，`/\n//evil.example` 可绕过检查跳到外部站点 | `9c00fd839` | `app/core/auth/next-path.ts` |
| B2 | 工具步骤链接的放行范围与降级显示（11-24 审核改判：不是安全问题，移到 P3）。Vue 的 `safeExternalURL`（`ProcessingToolStep.vue:183-193`）只放行绝对的 http/https，其余整条不显示；React 用 Markdown 链接同一份白名单 `isSafeHref`：http/https/mailto/tel、相对路径、页内锚点都放行，不安全的显示虚线占位 `UnsafeLink`，图片搜索的缩略图保留、只去掉链接。改法：web_search、image_search、web_fetch 三处改用 `isSafeMarkdownHref`（`app/core/markdown/links.ts:11`），不安全时复用 `MarkdownLink.vue:129-141` 的占位样式；web_fetch 的 `url` 非字符串时不渲染 | `d540be7e2` | `ProcessingToolStep.vue:183-232`（过滤）、`:315-369`（渲染） |
| B3 | **安全/可用性：** CSRF cookie 格式错误时解码抛错，所有接口调用失败 | `52f6ff078` | `app/core/api/fetcher.ts:34` |
| B4 | 上传返回 `success: false` 时仍发送消息、清空输入框 | `b8bb72836` `4e20cbb4d` | `app/core/uploads/api.ts`（只判 `response.ok`） |
| B5 | 记忆修改后被在途的旧读取覆盖回去 | `a1f23b294` | `app/composables/useMemory.ts:37` |
| B6 | 后台任务取消后被旧轮询覆盖回“运行中” | `097fa6dca` `d59738649` | `app/composables/useBackgroundTasks.ts:116` |
| B7 | 服务商重复使用工具调用 ID 时，工具步骤显示别的步骤的结果 | `178a9ab45` | `app/core/messages/utils.ts:877`（只按 ID 查） |
| B8 | 导出对话只导出已加载的部分 | `f71999d99` | `app/components/workspace/ExportTrigger.vue:65` |
| B9 | 交接过来的产物（`present_shared_artifact`）刷新后从历史恢复不了 | `fc7c7e012` | `app/core/messages/utils.ts:827`、`:859`（只认 `present_files`）；规格见 React `core/artifacts/utils.ts` |
| B10 | 重连后只有思考内容的消息被当作已完成回答 | `36ee986d5` | `app/core/threads/local-turn-order.ts:118` |
| B11 | write-file 产物地址解析未加防护，格式不对时直接抛错 | `f0ba28036` | `app/core/artifacts/loader.ts:140`、`ArtifactPanel.vue:72/87` |
| B12 | 单次定时任务在夏令时切换时刻的换算与调度器不一致 | `96f930f5b` | `app/core/scheduled-tasks/cron.ts:562` |
| B13 | 无效的 cron 字段（如 `99 * * * *`）被当成预设显示 | `35d33bea7` | `app/core/scheduled-tasks/cron.ts:261` |
| B14 | 运行计时器不按服务端开始时间，重开对话从零计 | `728446fe0` | `app/components/chat/MessageList.vue:589`、`:822`（起点取客户端 `Date.now()`），由 `RunActivity.vue` 显示 |
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
| B26 | 表格单元格、记忆条目按 UTF-16 截断，emoji 处出乱码 | `8337a80ae` | `app/components/workspace/artifacts/ArtifactTablePreview.vue:281`、`app/core/memory/view-model.ts:52`；规格见 React `core/utils/text.ts` 的 `truncateToCodePoints` |
| B27 | 运行摘要按 UTF-16 截断 | `6b2ac5855` | `app/core/scheduled-tasks/format.ts:282` |
| B28 | 网页抓取标题不认 Tab 分隔 | `ec07de961` | `app/core/utils/markdown.ts:8` |
| B29 | 文件语言识别会命中原型链上的键 | `59743568b` | `app/core/artifacts/policy.ts:207` |
| B30 | 编辑消息时不判断输入法组合态：中文输入法选字时按 Esc 或 Ctrl+Enter 会取消或提交编辑（11-24 复核补入） | `49adb0ede` | `app/composables/useMessageTurnActions.ts:113` |
| B31 | 从预设切到自定义 cron 时，只在原始表达式为空才按当前预设生成，会留下过期表达式（11-24 复核补入） | `338f8819a` | `ScheduledTaskScheduleInput.vue:204` |
| B32 | Vue 仍按本仓已撤销的分块写入工具（`begin_artifact_write` / `append_artifact_chunk` / `finalize_artifact_write`）自动打开产物、展示工具步骤；合并上游时后端与 React 已删除这组工具，改用 `write_file` 的 `append` 分段写入（Vue 已支持）。删除这条死分支及其单测和 e2e 断言（11-24 文档清理时补入） | `ceed64e7b` | `app/composables/useChatPanels.ts:276`、`ProcessingToolStep.vue:67-69` |
| B33 | 工作区变更里 `symlink_created` 状态：React 有意按“已修改”显示（`frontend/src/core/workspace-changes/summary.ts:46` 的注释、`workspace-change-panel.tsx:221` 的 `statusLabel`），Vue 显示 Vue 独有的“新增符号链接”。11-23 已裁决 Vue 跟随 React：映射到 `modified`、排序名次不变，删除 `workspaceChanges.symlinkCreated` 并同步词典、`i18n-keys.json` 与单测（11-24 复核补入） | 11-23 裁决 | `app/core/workspace-changes/presentation.ts:16` |
| B34 | 项目文档区仍显示“记忆目前仍为全局：在第三阶段之前，项目中讨论的内容仍可能进入你的全局记忆”（`projects.interimMemoryNotice`）。上游已删除这句，后端也已有项目记忆，文案与事实不符。现在就删掉这条提示和词条（中英文词典、`baseline/i18n-keys.json`、相关单测），不等 F9（11-24 审核补入） | `9699f04cd` | `app/components/workspace/projects/ProjectDocumentsSection.vue:239` |
| B35 | `/compact` 没有执行时，Vue 把后端给的原因拼进提示（“未压缩上下文：{reason}”），React 一律显示 `compactSkipped`。改为跟随 React，删除 `inputBox.compactNotPerformed` 及其单测断言（11-24 审核补入，Vue 独有的可见文案） | Vue 独有 | `app/composables/useComposerSubmission.ts:328-332`；React `components/workspace/input-box.tsx:1420-1424` |

**实现时还需确认（代码读不出确定结论）：**

- `7fd0c0cb3` 已取消的批次不再显示条目“重试”：`SubagentBatchItems.vue` 未见批次状态判断。
- `cc013c968` 只有思考内容的 token 步骤归类：Vue 用量模型写法不同，需按用例核对。
- `c11ba8470` 手机端桌面偏好为收起时，抽屉仍显示完整导航与触发按钮状态：Vue 已有移动抽屉，React 新增 335 行断言，需跨端实测。

## 5. 请求一致性缺口（按第 0.2 节“请求逐项一致”）

| 编号 | 问题 | 位置 |
| --- | --- | --- |
| R1 | 运行请求的 `context`：React 带 `thread_id` 与 `locale`（后端据 `locale` 决定回复语言），Vue 主动去掉 `thread_id`、不带 `locale`。改法：普通发送与重新生成/编辑重发两条路径都按 React 带上这两个字段，取值来源与 React 相同（提交时的目标线程 ID、当前界面语言）；删掉 `submit.ts:105-120` 解释“为何不带”的注释和对应单测断言。两端随机的线程 ID 靠身份对应比对。`client_timezone`、`conversation_references` 两端已一致 | React `core/threads/hooks.ts:399`（`thread_id` 在 438 行、`locale` 在 439 行）；Vue `app/core/threads/submit.ts:121`（`thread_id` 在 146 行被剔除），调用点 `app/composables/useThreadStream.ts:898`、`:1001` |
| R2 | 查询失败重试：React 用默认规则（失败最多重试 3 次，含 HTTP 4xx/5xx），Vue 只在网络中断时重试 | React `components/query-client-provider.tsx:35`；Vue `app/plugins/vue-query.ts:22` |
| R3 | 合并时记录的反向差异逐项复核：发送后强制滚到底（上游改为钉在顶部，即 F18）；回调页位置（已核：React 只是把 `/auth/callback` 放回 `(auth)` 路由组，Vue `app/pages/auth/callback.vue` 同样校验 `next`、成功 300 毫秒后跳转、失败跳 `sso_failed` 或带 `next` 的 `gateway_unavailable`，行为一致，关闭）；Vue 仍识别已被上游去掉的分块写入工具名（即 B32）；服务端忽略 `Range` 时 Vue 只读前 1 MiB（`app/core/artifacts/loader.ts:89`），React 合并时删掉了本仓的 `response-body.ts`、改为整段读取——后端支持 `Range`（`backend/app/gateway/routers/artifacts.py:243`），两端请求与结果相同，属于用户看不见的内部差异，保留 Vue 现状；CodeMirror/Lezer 版本：React 去掉了本仓的版本锁定，现装 `@codemirror/view` 6.39.13、`state` 6.5.4、`language` 6.12.1，Vue 是 6.43.9、6.7.1、6.12.4。判据：P5 跑 `code-editor.spec.ts` 时两端代码高亮看得出差别，就把 Vue 锁到 React 的版本，否则保持 | 各子项的位置已写在本格内；来源是合并取舍记录的“留给第 3 步”，执行不依赖外接盘 |
| R4 | **已裁决（11-24 用户）：保留 Vue 现状，作为有意保留的缺陷修复，登记为已知请求差异。** 创建运行的 `Idempotency-Key` 请求头：Vue 普通发送默认用用户消息 ID 作幂等键（`app/composables/useThreadStream.ts:887`），重新生成用新 UUID（`:1090`），由 `app/core/agent-deerflow/run-protocol.ts:133` 写进请求头；React 两种都不发（`core/threads/hooks.ts:3441` 的注释写明）。后端按这个键去重（`backend/app/gateway/routers/thread_runs.py`）。“请求头逐项一致”要求 Vue 跟随 React 不发；执行约定第 0.2.1 节又要求保留“重复创建运行”这类缺陷修复。用户选择保留防重复。落地：按执行约定第 0.2.2 节，基线实测时把它产生的差异行写进对照台账并标注 R4，永久保留；不加任何按请求头放行的规则，其他请求头照常比对（第 7.1 节第 3、4、8 条）。`BEHAVIOR_CONTRACTS.md` 写明原因，`ARCHITECTURE.md` 的“要对齐的内容”指向本条 | Vue `useThreadStream.ts:887`、`:1090`；React `hooks.ts:3441` |
| R5 | 登录页、安装向导页的 `GET /api/v1/auth/me`：React 在服务端取（`frontend/src/app/(auth)/layout.tsx:18`），Vue 在浏览器取：登录页在 `app/pages/login.vue:180`，安装向导在 `app/pages/setup.vue:53`。全局中间件 `app/middleware/auth.global.ts:39` 只在 `/workspace` 和受保护的产物视窗上取，不经过这两页，所以每页只发一次、没有重复（11-24 审核已核，与 `baseline/parity-auth-diff.json` 里两页各一条 `requestsOnlyVue` 吻合）。后端收到的是同一个接口、同一套判定。11-23 已裁决接受这一架构差异，按新判据维持：这 4 条在台账棘轮里标注 R5，永久保留。无代码改动 | Vue `login.vue:180`、`setup.vue:53` |
| R6 | 产物“在新窗口打开”与“下载”的请求（11-24 审核补入）。Vue：两个动作前都先发一次 `GET` 加 `Range: bytes=0-0`、`cache: no-store` 的预检（`app/core/artifacts/actions.ts:30-36`，由 `ArtifactPanel.vue:394` 调用），通过后再 `window.open`，或用 `<a download>` 让浏览器再取一次。React：打开不发预检，直接 `window.open`（`artifact-file-detail.tsx:647`）；下载是一次不带 `Range` 的完整 `GET`，不超过 64 MiB 时读进内存组成 Blob 再触发下载，超过则交给浏览器直接下载，并显示“已开始下载/下载失败”提示（`core/artifacts/download.ts`、`artifact-download-button.tsx`，来自 `81de0761e`）。改法：删除 `probeArtifactAction` 及其调用和单测，打开按 React 直接开窗，下载按 React 实现。可与 F8 一起做，验收按请求档 | Vue `actions.ts:30`、`ArtifactPanel.vue:394`；React `download.ts:6`、`artifact-file-detail.tsx:647` |

## 6. 第三层：运行时实测（待执行）

静态核对覆盖不到的差异，必须在浏览器里把两端跑起来比：请求时机与次数、看得见的界面差异、交互结果。执行前先完成第 7 节 P0，否则比对结果会混入已不要求的维度（读屏、Tab 顺序、焦点落点、像素几何）。

- 覆盖：现有 90 个已覆盖场景（含 14 个 Showcase 场景），加上第 3 节新增功能的对照场景；三种布局 × 两种语言 × 两种主题。
- 只计入：请求档全部差异；其余档按第 0.2 节，只计用户看得出的差异。
- 10-09 之前 40 个功能提交的细节一致性、上面三条“需确认”，都以这一轮实测为准。

## 6.1 第三层之前要先做的核实

- **身份对应是否够用：** 执行约定第 0.2.1 节第 2 条要求保留身份对应、去掉穷举证明，并核实现有对应链路能否支撑请求档比对。静态审查没有做这一项，P0 必须先做，命令和判据见第 7.1 节第 6 条。
- **入口：** 11-24 审核已核，不需要改成经 nginx。两端预览都是同源代理：Vue 经 Nitro，React 经 Next 服务端（`tests/e2e-parity/support/react-preview.ts:41`、`:60`）。比对在浏览器侧采集请求，代理在浏览器之后加的头本来就看不到，所以入口不同不会混进请求档。第 7.1 节第 7 条只留一项实测确认。

## 7. 执行顺序

| 阶段 | 内容 | 说明 |
| --- | --- | --- |
| P0 | 按判据调整 Vue 侧规则与测试、核实身份对应、跑基线实测，逐项见第 7.1 节 | 先改计划已完成（执行约定第 0.2 节），这里改代码 |
| P1 | 安全与可用性：B1、B3 | 改动小、影响所有用户，最先做。B2 经 11-24 审核改判为显示差异，移到 P3 |
| P2 | 请求一致性：R1、R2、R6（R3 逐项按本格判据处理；R4、R5 已裁决保留，只做台账登记） | R1 同时解决 F21 的“按界面语言回复”。每修一项，删掉台账里对应的行 |
| P3 | 其余行为缺陷：B2、B4–B35 与三条“需确认” | 每条有明确位置，可逐条修、逐条加 Vue 单测 |
| P4 | 功能缺口：F1–F23 | 工作量最大。建议顺序：F18（消息列表与流，日常使用最频繁）→ F1、F2（对话流程）→ F23（扩展宿主契约，F8、F17 的前提）→ F3、F5（分享、搜索）→ F10、F11（模型、用户管理）→ 其余。每项同时补齐第 2 节列出的 auth / 真实后端用例，以及第 9 节对应的契约消费 |
| P5 | 第三层运行时实测，修复实测出的差异，再测一轮 | 见第 6 节 |
| P6 | 简化后的验收：按执行约定第 0.2.1 节的 R04–R12 处理表 | 只验证实际要用的部署方式 |

每个阶段完成后：Vue `make verify`、React `pnpm check` 与 `pnpm test`、backend `make test`（改到后端契约时）全部通过才提交；推送前问用户。P1 起每修一项，还要按第 7.1 节第 10 条删掉台账里对应的行，并跑一次相关场景的跨端比对。

### 7.1 P0 落地清单

1. **开工前准备（11-24 已完成）：** 跨端实测启动时会对 React 执行 `next build`，原先因本仓自加的 React 测试有类型错误而起不来。已修 `frontend/tests/unit/components/workspace/artifacts/artifact-file-list.dom.test.tsx`（mock 补参数类型）和 `frontend/tests/unit/app/auth-page-lifetime.dom.test.tsx`（去掉多余断言），只改测试；React `pnpm check` 退出码 0。冒烟实测 `tests/e2e-parity/topology.spec.ts` 5 个用例全部通过（三端服务都能起来），日志 `logs/parity-smoke-topology.log`。这两份测试是本仓自加的，没有动 React 产品代码；它们挡住了跨端实测的 `next build`，是执行约定第 0.2 节“只改 Vue”之外唯一的一次例外。

下面每条做完就跑它写的验证，通过后本地提交一次。单测命令统一为 `python3 scripts/pnpm.py --dir frontend-vue exec vitest run <路径>`，在仓库根目录执行；每条最后都跑一次 `make -C frontend-vue verify`。

2. **Showcase 不豁免，本条无需操作（11-25 用户撤销 11-24 的豁免，见执行约定第 0.2.1 节）。** `/showcase/[thread_id]` 和 14 个 showcase 场景照常留在跨端比对里：它们同时是 7 份跨端用例（`artifact-panel-capacity`、`showcase-interactions`、`composer-capability-lifetime`、`triple-panel-capacity`、`mermaid-image-export`、`mermaid-fullscreen-owner`、`tool-artifact-registry`）的测试载体。`react-parity-scope.json`、`parity-scenario-coverage.json`、`parity-route-sampling.json`、`scenarios.ts` 都不改；`parity-diff.json` 里的 70 条 `showcase-*` 条目随第 4 条一起改成只留请求字段。保留编号，是为了不打乱其他条目对“第 N 条”的引用。
3. **词典豁免与禁止移植。**
   - `baseline/upstream-i18n-map.json` 新增 `exempt` 桶，结构与 `pending` 相同（`keys` 和 `$reasons`），把 5 个 `home.search*` 从 `pending` 移入，理由写“docs 内容站（已豁免路由）专用”；文件 `$comment` 里的“三桶”改为四桶并说明 `exempt` 只收已豁免路由专用的词条。
   - `tests/unit/i18n/upstream-key-coverage.test.ts`：第 160–171 行的“恰好划分”把 `exempt` 计入；加一条断言 `exempt` 与 `pending` 不重叠。
   - `baseline/react-parity-scope.json` 的 `forbiddenUpstreamModules` 登记 `@/components/workspace/conversation-references/conversation-reference-picker` 和 `.../reference-conversations-button`（路径各自写全）。守卫按 `@/` 别名搜导入，picker 只被 button 以相对路径导入，不会报红。
   - 验证：单测 `tests/unit/i18n tests/parity/product-surface.test.ts`。
4. **比对维度与台账棘轮（执行约定第 0.2.2 节第 2 条）。**
   - `tests/e2e-parity/support/ledger.ts`：新增 `COUNTED_DIFF_FIELDS = ["requestsOnlyReact", "requestsOnlyVue", "requestBodies", "requestFacts"]`；`ledgerRows`、`addedRows` 只按这四个字段算。`DIFF_ENTRY_FIELDS` 保留 13 个，报告仍完整。
   - `tests/e2e-parity/diff.spec.ts`：第 364–368 行的最终比较、第 320–355 行 accept 时写入的内容都只取四个请求字段；其余九个字段（`ariaOnlyReact`、`ariaOnlyVue`、`order`、`depth`、`focus`、`tabbablesOnlyReact`、`tabbablesOnlyVue`、`tabOrder`、`geometry`）照常采集、写进 `REPORT` 供人看，不进台账、不判失败。第 340–348 行写入台账的 `$comment` 改成新定义：每一行都是已知差异，必须对应本计划一个 F、B 或 R 编号；只许减少；R4、R5 的行永久保留。`tests/e2e-parity-auth/diff.spec.ts` 同样处理。
   - `baseline/parity-diff.json`、`parity-auth-diff.json`：每个条目只留四个请求字段；顶层 `$comment` 同步改写。
   - 三方对账要一起改：`tests/guards/parity-ledger-fields.test.ts` 改为核对 `COUNTED_DIFF_FIELDS`、`scripts/parity-ledger-report.mjs` 自己的字段表、签入基线的实际字段三者一致；同步 `tests/unit/parity/ledger.test.ts`、`tests/unit/parity/ledger-report.test.ts`。
   - 验证：单测 `tests/unit/parity tests/guards/parity-ledger-fields.test.ts tests/guards/baseline-keys-consumed.test.ts`。
5. **请求头采集（执行约定第 0.2.2 节第 1 条）。**
   - `tests/e2e-parity/support/capture-network.ts:11-16`：`REQUEST_HEADERS` 白名单改为“全部请求头减去剔除表”。剔除表即约定里列的浏览器自动附加的头：`user-agent`、`cookie`、`host`、`connection`、`content-length`、`accept-encoding`、`accept-language`、`origin`、`referer`、`priority`、`sec-*`。第 145 行用的 `request.headers()` 拿不到部分底层头，改用 `await request.allHeaders()`，并确认剔除表覆盖它多出来的头。
   - `x-csrf-token` 只记“有/无”；`idempotency-key`、`last-event-id` 继续走 `identity-projection.ts` 的身份对应。`PublicHeaders` 固定键类型（第 18 行）改为开放的 `Record<string, string | null>`，同步第 240 行的投影类型。
   - 不加任何按请求头放行的规则：R4 的差异按第 4 条写进台账。
   - 验证：单测 `tests/unit/parity`；再跑一次冒烟 `topology.spec.ts`，并用 `PARITY_ONLY=chat-thread-init-ordering` 跑 `diff.spec.ts`，在输出的 `REQUESTS` 里确认能看到 `x-csrf-token`、`range` 这类头，且没有剔除表里的头。
6. **身份对应核实（第 6.1 节）。** 在 `frontend-vue` 目录后台运行，日志写 `../logs/parity-identity-check.log`：
   `PARITY_REQUIRE_REACT=1 node scripts/keep-e2e-failure-artifacts.mjs -- node scripts/with-loopback-no-proxy.mjs -- python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test -c playwright.parity.config.ts tests/e2e-parity/identity-producers.spec.ts tests/e2e-parity/identity-replay-producers.spec.ts`
   判据：“actual first send preserves generated human and submission target”（新建对话首次发送）和 “actual … retains prepared sources and independent key”（重新生成、编辑重发）在两端全部通过，即两端各自生成的用户消息 ID、提交目标、运行 ID 都能对应上。Vue 发幂等键而 React 为空，是 R4 的预期。有失败就按失败信息补对应链路，结果写回本条。这两份用例是请求档比对的依据，第 8 条不得删除。
7. **实测入口确认。** 第 6.1 节已核：两端都是同源代理，浏览器侧采集看不到代理加的头。基线实测里只需再确认一件事：没有只在一端出现的跨源预检（`OPTIONS`），请求 URL 投影后两端同源。满足就保持现状，并在本条记“已核”；不满足再把 `playwright.parity.config.ts` 改为两端同经一个 nginx 入口。
8. **逐个判定的候选（读内容再定保留、放宽或删除，结果写回本条）。**
   - 判定原则：只测读屏、Tab 顺序、焦点回原处、像素几何、200% 文字缩放、减少动态效果的，删除；同时测了输入框光标连续、对话框 Esc/回车、输入法、鼠标可点到的，保留那一部分。
   - 跨端实测，键盘与读屏：`artifact-frame-keyboard`、`composer-keyboard-lifecycle`、`empty-timeline-keyboard`、`keyboard-browser-boundaries`、`keyboard-finite-transitions`、`keyboard-measurement`、`keyboard-order`、`keyboard-trap`、`skill-details-keyboard`、`triple-keyboard`、`triple-overlay-keyboard`、`disabled-control-focus`、`focus-capacity-regressions`、`thread-delete-focus`、`composer-command-focus`、`route-head-announcement`（读屏播报）。
   - 跨端实测，高倍文字缩放与动效（执行约定第 0.2.1 节第 5 条）：`icon-text-scaling`、16 份 `*-reflow.spec.ts`（`artifact-preview-capacity-reflow`、`capability-controls-reflow`、`chat-content-reflow`、`chat-list-capacity-reflow`、`chat-scroll-owner-reflow`、`combined-reflow`、`command-popup-reflow`、`popup-capacity-reflow`、`project-tabs-reflow`、`projects-scheduled-reflow`、`scheduled-card-reflow`、`settings-capacity-reflow`、`settings-controls-reflow`、`settings-reflow`、`token-attribution-reflow`、`triple-reflow`；它们测的是“窄屏 200% 文字下控件可达”）、`conversation-initial-motion`。`support/reflow-survey.ts` 还被 `workspace-control-capacity`、`triple-panel-capacity`、`narrow-screen-overflow` 使用，保留；这三份也要读一遍，确认没有测 200% 文字。
   - Vue e2e：`artifacts-a11y-shape`、`chat-a11y-shape`、`scheduled-tasks-a11y-shape`、`thread-list-a11y-shape`、`ui-primitives-a11y`、`reduced-motion`；`sidebar-ime-a11y` 里的输入法部分保留。
   - 像素视觉（执行约定第 0.2.1 节第 3 条）：`tests/e2e-visual/workspace-states.spec.ts`、`tests/e2e-infra/visual-seed.spec.ts`，及 Makefile 里只为它们存在的目标。
   - 守卫：`toggle-variant-pressed`、`upstream-citations`（上游行数）、`doc-facts` 剩余计数断言、`looping-animations`（减少动态效果）、`visual-baseline-platforms`（Linux 正式视觉，R07 已去掉）。`parity-ledger-fields` 在第 4 条已改，不删。
   - 文档：`frontend-vue/ARCHITECTURE.md` 的“导航页面名播报”一节，以及 `RouteAnnouncer` 组件。播报对鼠标用户不可见，按执行约定第 0.2.1 节第 8 条可以保留，判定后在本条写明保留或删除。
   - 不得删除：`identity-producers.spec.ts`、`identity-replay-producers.spec.ts`（第 6 条要用）。
   - 删用例时，同步所有按文件名引用它们的地方：`scripts/parity-ci.mjs` 第 11 行起的分组表（如 `keyboard`、`triple-keyboard`、`triple-overlay`、`reflow` 组）、`tests/guards/parity-ci.test.ts`、`Makefile`（如 `e2e-visual`）和 CI 工作流。删前用 `rg -l <文件名>` 列全。验证：`make -C frontend-vue verify`。
9. **Vue 独有文案审查（执行约定第 0.2.1 节第 8 条）。** `vue-only-keys` 守卫只管 4 个 Vue 独有顶层块（`marketing`、`messages`、`navigation`、`primitives`），共享块里 Vue 多出来的词条从没审过。11-24 审核用 TypeScript 编译器展平两端 `locales/en-US.ts`，Vue 有、React 没有的 key 共 116 个。逐条处理：已无人引用的，并入 `make i18n-unused` 的清理；仍在界面上用到的，看 React 是否有同义渲染，有就登记为别名，没有就编为 B 项跟随 React。已知三条：B33（`workspaceChanges.symlinkCreated`）、B34（`projects.interimMemoryNotice`）、B35（`inputBox.compactNotPerformed`）。结果写回本条。
10. **基线实测与台账登记。** 第 2–9 条完成后，在 `frontend-vue` 目录后台跑 `make e2e-cross-app`，日志写 `../logs/parity-baseline-<日期>.log`。它串行跑 `e2e-parity`、`e2e-parity-auth`、`e2e-parity-session`；三套共用 Nuxt/Next 构建目录，不能并行。
    - 预期：请求档会出现已知差异，至少有 R1（`context` 缺 `thread_id`、`locale`）、R4（幂等键）、R5（登录页、安装向导页的 `/auth/me`），以及 R6 涉及场景的预检请求。
    - 登记：逐行核对差异，每行对上一个编号；对不上的是新差异，先按 F/B/R 补进本文再接受。然后用 `PARITY_ACCEPT_GROW=1 make parity-accept` 和 `PARITY_ACCEPT_GROW=1 make parity-auth-accept` 写入台账。在本条末尾附“基线差异登记”表：编号、行数、示例行。
    - 之后：P1–P4 每修一项，删掉对应的行，再跑一次相关场景确认通过。
11. **CI。** GitHub Actions 最后一次运行是 2026-09-28，11 个工作流都是 active。11-24 审核已核：之后 `origin/main-wc` 推送了 1823 个提交，其中包括 `frontend-vue/**` 的改动，仍没有触发任何运行，所以原因不是路径过滤，要到 GitHub 仓库的 Actions 设置和账户计费页查，这需要用户本人操作。不挡本地对齐，P6 之前必须查清。

## 8. 本仓 React 本地修改（11-24 复核补入）

React 参照 = 上游 + 本仓保留的 React 修改。后者与上游相比差 161 个文件，新增 7524 行、删除 1557 行（`git diff --shortstat upstream/main -- frontend/src`，11-24），审查的提交范围只含上游提交，没有覆盖到它们。按内容分类：

- 对齐期间“两边同改”时补进 React 的修复：无障碍、本地化、窄屏换行、卸载后丢弃迟到结果、对话框与菜单定位、通知组件、Mermaid 与表格渲染（`core/streamdown/mermaid-renderer.tsx`、`table-renderer.tsx`）等。Vue 是这些行为的来源，判为同源。
- 身份观测接线（`core/diagnostics/*`）：只供跨端比对用，默认关闭。
- 其中纯键盘焦点类（如 `components/ui/dialog-focus-boundary.ts`）按第 0.2 节判据 Vue 不再要求。

- 其中改变请求时机的也属两边同改，例如 `core/threads/hooks.ts` 的 `restartThreadScopedQueries`：失效缓存前先取消在途请求再重取。Vue 的对应实现在 `app/core/threads/cache-invalidation.ts`，由请求档实测核对。

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

## 11. 11-24 独立审核记录

以代码和 Git 为准复核本计划（只读，未改代码）。结论与本文的改动：

- **改判：** B2 不是安全问题，Vue 早已只放行 http/https，真实差异是放行范围和降级显示，移到 P3；R5 的请求位置是 `login.vue:180`、`setup.vue:53`，中间件不经过这两页，不存在重复。
- **补入：** R6（产物打开与下载的预检请求）、B34（过时的项目记忆提示）、B35（压缩提示多出后端原因）。
- **P0 重写：** 第 7.1 节第 2–11 条按门禁的实际断言写明改哪些文件、怎么验证。原写法有三处照做会报红或漏项：Showcase 豁免的放法不对，且 14 个场景是 7 份用例的载体（用户随后于 11-25 撤销了 Showcase 豁免，第 2 条改为无需操作）；`upstream-i18n-map.json` 没有豁免桶；候选清单漏了 16 份 reflow 用例、`reduced-motion`、像素视觉用例。
- **用户裁决：** 请求头比对口径与台账棘轮，记在执行约定第 0.2.2 节。
- **核实无误：** 基线 `624a64a15`；范围内改动 React 产品代码的提交 210 个；引用的 86 个提交号都能解析且标题吻合；B1、B3、R1、R2、R4 及抽查的 20 条 B、17 条 F 与代码一致；路由、词典（React 独有 441 个 key 等于 439 条待办加 2 条别名）、用例覆盖三项比对无遗漏。

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `python3 scripts/pnpm.py --dir frontend check` | 0 | 约 31 秒 |
| `make -C frontend-vue verify` | 0 | 571 个测试文件、5978 个用例通过 |
| 跨端冒烟 `tests/e2e-parity/topology.spec.ts`（第 7.1 节第 1 条的命令） | 0 | 5 个用例通过，49 秒 |

没做：backend 测试（会改写受跟踪文件）、全量跨端实测（P0 第 10 条）、身份对应运行核实（P0 第 6 条）。
