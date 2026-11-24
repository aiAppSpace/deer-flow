# Vue 对齐 React：新基线审查结论与对齐计划（2026-11-24）

本文是第 3 步的产出，替换 [2026-11-23 待对齐清单](2026-11-23-vue-react-parity-gaps.md) 的结论。审查以代码为准：每条结论都来自对两端当前源码的直接比对，文件和行号写在条目里。React 是参照，只改 Vue（判据与范围见 [R03 恢复方案](2026-11-23-r03-resume-plan.md) 第 0.1、0.2 节）。

## 1. 审查范围与方法

- **基线：** 上游冻结在 `624a64a15`，`main-wc` 已合入（`fc9efc159`）。
- **React 变化范围：** `a93900d4e..624a64a15`。`a93900d4e` 是 Vue 最后一次记录“已审阅上游”的位置（`frontend-vue/baseline/upstream-marker.json`，2026-09-16），比 10-09 的同步点更早，所以这个范围把两段都覆盖到。期间有 210 个提交改动了 React 产品代码（不含内容站），全部来自上游。
- **第一层，全量静态比对：** 路由、后端接口调用、词典 key、e2e 用例，从两端源码现场提取，双向比较。
- **第二层，逐提交核对：** 先为每个提交自动计算三个缺口信号（新增的词典 key、接口、e2e 用例在 Vue 是否存在，只与 React 当前代码比较）。有信号的，归入功能缺口；信号干净的，逐个读 React 改动，再到 Vue 找对应实现。
- **第三层，运行时实测（尚未执行）：** 跨端对比测试（`e2e-parity`），兜住静态读不出的差异，见第 6 节。
- 审查过程的逐条记录在外接盘 `/Volumes/edisk/deer-flow/docs/reports/evidence/resume-2026-11-24/alignment-audit-notes.md`。

**审查覆盖：** 210 个提交全部有结论。10-09 之后 120 个逐个核对；10-09 之前 90 个中，修复类 38 个 + 抽样 12 个逐个核对，功能类 40 个核对了词典、接口、用例和 Vue 未引用 key，功能细节留给第三层实测。

## 2. 第一层结论：全量静态比对

| 维度 | 结论 |
| --- | --- |
| 路由 | React 有、Vue 没有的：`/share/[share_token]`（分享页）、`/workspace/usage`（用量统计）；其余均为已豁免的内容站。Vue 独有的 `/__m0/*` 是测试夹具页 |
| 后端接口 | React 调用、Vue 未调用 27 个，全部属于第 3 节的功能缺口 |
| 词典 | React 有、Vue 没有的 key 约 440 个（`frontend-vue/baseline/upstream-i18n-map.json` 的 pending），全部属于第 3 节的功能缺口 |
| e2e 用例 | 40 份 React 用例 Vue 未覆盖（`parity-scenario-coverage.json` 的 pending），全部属于第 3 节的功能缺口 |
| 未引用 key | Vue 词典里有、界面没用的 65 个 key，交叉 React 用法后无新增缺口（真正被 React 使用的 6 个，分属豁免、已列缺口或 React 死代码） |

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
| F18 | 消息列表与流：回到底部按钮、发送后把消息钉在顶部、流式服务端错误可操作、工具结果成败、子任务历史回填、相对链接跳到产物、产物草稿跨导航保留、Markdown 产物本地图片、产物列表可滚动、隔离 HTML 预览资源鉴权、实时浏览器握手超时 | `ba4e60dec` `ec44f2ff3` `259894028` `a1b89d043` `3dd9e8841` `0530d0c7c` `c5fd453c3` `4210854a9` `db7f91911` `8008a6195` `0d3a562c5` | `scroll-to-bottom-button`、`scroll-on-send`、`chat-stream-error`、`subtask-backfill`、`relative-artifact-link`、`artifact-draft-navigation`、`artifact-markdown-images`、`artifact-list-scroll` |
| F19 | 子智能体批次：结果查看、请求的后续工作与前置依赖 | `ce0fa4c11` `593ba4945` | `batch-followup-rejoin` |
| F20 | 定时任务：只有日期的执行时间按任务时区零点显示、切换到自定义 cron 时保留原计划 | `91a88e08e` `338f8819a` | `scheduled-task-date-only`、`scheduled-task-cron-preset` |
| F21 | 其他：会话检查在网络失败后恢复、按界面语言回复（与第 5 节 R1 同源）、编辑消息时忽略输入法组合态快捷键、Webz 新闻搜索结果 | `5dc508b40` `4b1e06bbf` `49adb0ede` `a333ac318` | `auth-network-recovery`、`chat-language-preference`、`message-edit-ime`、`web-search-results` |

`docs-search-mobile`（`66f00e7b8`）属于 docs 内容站，已豁免。

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

**实现时还需确认（代码读不出确定结论）：**

- `7fd0c0cb3` 已取消的批次不再显示条目“重试”：`SubagentBatchItems.vue` 未见批次状态判断。
- `cc013c968` 只有思考内容的 token 步骤归类：Vue 用量模型写法不同，需按用例核对。
- `c11ba8470` 手机端桌面偏好为收起时，抽屉仍显示完整导航与触发按钮状态：Vue 已有移动抽屉，React 新增 335 行断言，需跨端实测。

## 5. 请求一致性缺口（按第 0.2 节“请求逐项一致”）

| 编号 | 问题 | 位置 |
| --- | --- | --- |
| R1 | 运行请求的 `context`：React 带 `thread_id` 与 `locale`（后端据 `locale` 决定回复语言），Vue 主动去掉 `thread_id`、不带 `locale` | React `core/threads/hooks.ts:398`；Vue `app/core/threads/submit.ts:121`（`thread_id` 在 146 行被剔除） |
| R2 | 查询失败重试：React 用默认规则（失败最多重试 3 次，含 HTTP 4xx/5xx），Vue 只在网络中断时重试 | React `components/query-client-provider.tsx:35`；Vue `app/plugins/vue-query.ts:22` |
| R3 | 合并时记录的反向差异需按请求一致性复核：已去掉的分块写入工具名、发送后强制滚到底（上游改为钉在顶部，即 F18）、回调页位置 | 见 `MERGE-DECISIONS.md`“留给第 3 步” |

## 6. 第三层：运行时实测（待执行）

静态核对覆盖不到的差异，必须在浏览器里把两端跑起来比：请求时机与次数、看得见的界面差异、交互结果。执行前先完成第 7 节 P0，否则比对结果会混入已不要求的维度（读屏、Tab 顺序、焦点落点、像素几何）。

- 覆盖：现有 90 个已覆盖场景，加上第 3 节新增功能的对照场景；三种布局 × 两种语言 × 两种主题。
- 只计入：请求档全部差异；其余档按第 0.2 节，只计用户看得出的差异。
- 10-09 之前 40 个功能提交的细节一致性、上面三条“需确认”，都以这一轮实测为准。

## 7. 执行顺序

| 阶段 | 内容 | 说明 |
| --- | --- | --- |
| P0 | 按判据调整 Vue 侧规则与测试：`frontend-vue/ARCHITECTURE.md` 对齐范围；`react-parity-scope.json` 与 `parity-scenario-coverage.json` 加入 Showcase 豁免；跨端比对去掉 aria/Tab 顺序/焦点落点/像素档的计入；逐个处理只为读屏/键盘一致而存在的守卫 | 先改计划已完成（R03 恢复方案第 0.2 节），这里改代码 |
| P1 | 安全与可用性：B1–B3 | 改动小、影响所有用户，最先做 |
| P2 | 请求一致性：R1–R3 | R1 同时解决 F21 的“按界面语言回复” |
| P3 | 其余行为缺陷：B4–B29 与三条“需确认” | 每条有明确位置，可逐条修、逐条加 Vue 单测 |
| P4 | 功能缺口：F1–F21 | 工作量最大。建议顺序：F18（消息列表与流，日常使用最频繁）→ F1、F2（对话流程）→ F3、F5（分享、搜索）→ F10、F11（模型、用户管理）→ 其余 |
| P5 | 第三层运行时实测，修复实测出的差异，再测一轮 | 见第 6 节 |
| P6 | 简化后的验收：按 R03 恢复方案第 0.2.1 节的 R04–R12 处理表 | 只验证实际要用的部署方式 |

每个阶段完成后：Vue `make verify`、React `pnpm test`、backend `make test`（改到后端契约时）全部通过才提交；推送前问用户。
