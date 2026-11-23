# Vue / React 待对齐清单（2026-11-23，以 ROOT 当前代码为准）

**性质：只读核对结果。** 本轮没有改产品代码，没有运行测试、构建或浏览器对比；整个计划仍暂停。“当前代码”指原仓 ROOT 的工作树：`main-wc`，HEAD `a78045395`，含 1420 条未提交改动。全计划范围和验收义务仍以 [11-03 全计划交接](2026-11-03-vue-whole-plan-handoff.md) 为准，本清单不缩小范围。

## 1. 结论

1. **页面、文案和后端接口三个层面已基本对齐。**
   - 路由：React 有而 Vue 没有的，全部落在已登记的豁免里；“待做路由”清单为空。
   - 文案：React 的 1690 个 key 中，除 2 个在 Vue 里换了位置外都存在；同名 key 的中英文文案完全一致。
   - 接口：两端调用的后端资源集合一致。
2. **剩下的差异集中在运行时行为**：请求的时机和组合、无障碍树结构、焦点落点、Tab 顺序、计算样式。这些只有跨端对比测试能可靠测出。最近一次全量实测（S15，10 月 27 日的源码）中，751 个场景键有 556 个存在差异，覆盖 83 个场景。之后修过一部分，但**没有在任何新源码上重测过**。
3. **ROOT 不是最新代码。** 后续修复都在候选归档里（Vue 约 41 个、React 约 26 个产品源文件，另有 3 个依赖补丁），尚未合入 ROOT。所以 ROOT 的对齐程度比候选差。
4. 本次在 ROOT 代码里**确认仍存在**的用户可见或请求层差异有 3 条（3.1–3.3），另有 3 项清理和登记工作（3.4–3.6）。第 4 节还有多类实测差异，需要在新源码上重跑确认。

## 2. 核对方法与已对齐项

| 维度 | 方法 | 结果 |
| --- | --- | --- |
| 路由 | 列出 `frontend/src/app/**/page.tsx` 与 `frontend-vue/app/pages/**`；读 `frontend-vue/baseline/react-parity-scope.json` | React 独有：docs/blog 四条（`exemptRoutes`）、`/mock/api/*`、`/github-stars`（落地页星标，属 `/` 内容豁免）、`/api/memory`（纯代理，Vue 用 `server/routes/api/[...path].ts` 统一代理覆盖）。`pendingRoutes` 为空 |
| 文案 | 用脚本加载两端 `core/i18n/locales/{en-US,zh-CN}.ts`，展平后逐 key 比较 | React 1690 key；Vue 1800 key。React 独有的 2 个只是换了位置（`common.closeBrowser` 对应 `browser.close`，`conversation.loadingConversation` 对应 `messages.loadingConversation`）。同名 key 文案 0 处不同 |
| 文案使用 | 检查 React 实际用到的 key 在 Vue 中是否被引用 | 只有 3 组未被 Vue 引用：`home.docs/blog`（落地页，豁免）；`sidebar.demoChats`（仅 `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` 静态站，豁免）；`inputBox.referenceConversations*`（React 自己已无导入方，见 3.5） |
| 接口 | 提取两端源码中的 `/api/...` 路径，逐资源比对 | suggestions、agents、subagents、memory、projects、skills、OAuth 等资源两端都调用 |
| 静态/演示模式 | 追踪 `isMock` 和 `?mock=true` | React 的 `/workspace/chats/{id}?mock=true` 对应 Vue `AgentChat.vue:204`；Showcase 两端都有；纯静态站模式按范围豁免 |
| 被删除的 Vue 文件 | ROOT 工作树 36 个 `D`，逐个查导入 | 全部无导入方，是计划中的旧代码退休，不影响构建 |

## 3. ROOT 当前代码中确认仍存在的差异

### 3.1 对话框/侧滑面板关闭按钮的读屏文案

- React：`frontend/src/components/ui/dialog.tsx:206`、`frontend/src/components/ui/sheet.tsx:150` 写死 `<span className="sr-only">Close</span>`，中文界面也读 “Close”。
- Vue：`frontend-vue/app/components/ui/dialog/DialogContent.vue:222` 用必填的 `closeLabel`，中文界面读 “关闭”。
- S15 实测影响：`capability-center`、`mcp-settings`、`plugin-icons`、`skill-export` 的中文场景都有 aria 差异，`capability-center` 的焦点比对也受影响。
- **裁决（2026-11-23，用户授权按推荐）：按 React 缺陷处理，修 React，Vue 不动。** 理由：
  - 中文界面读出英文 “Close” 是 React 自己的无障碍缺陷；Vue 照抄只会让两端一起错，计划规定“两端同错不等于对齐”。
  - 本仓已有修 React `ui/` 无障碍缺陷的先例：提交 `7630e6e35`（fix four accessibility defects that the Vue port already fixed）就改过 `ui/dialog.tsx`。
  - 做法：React 的 `DialogContent` 和 `SheetContent` 关闭按钮改用词典文案（与 Vue `primitives.close` 同义的 key），补中英文两种语言的挂载测试；然后让 `capability-center`、`mcp-settings`、`plugin-icons`、`skill-export` 的中文场景在对比测试里归零。

### 3.2 登录页、安装向导页上的 `GET /api/v1/auth/me`

- Vue 在浏览器端发出这个请求：`frontend-vue/app/middleware/auth.global.ts:43` 通过 `core/auth/session.ts:22` 发出；`frontend-vue/app/pages/setup.vue:53` 又直接发了一次。
- React 在服务端取用户：`frontend/src/app/(auth)/layout.tsx:19` 的 `getServerSideUser()`，浏览器抓不到。
- 已登记为已知差异：`frontend-vue/baseline/parity-auth-diff.json` 中 login 和 setup 的中英文共 4 个键是 `requestsOnlyVue: ["GET /api/v1/auth/me"]`。该文件规定“只能缩短”。
- **裁决（2026-11-23，用户授权按推荐）：接受这一架构差异，保持 `parity-auth-diff.json` 中的登记，不改代码。** 理由：
  - 两端调用的是同一个后端接口、同一套判定（已登录跳工作区，`needs_setup` 进改密码，否则看 setup-status）；差别只在请求发生在服务端还是浏览器，用户看不到。
  - 计划要求 Vue 用自身框架的合理实现。为了让浏览器抓不到这个请求而把 Vue 改成 SSR 转发 cookie 取会话，会多出一条服务端鉴权路径，风险大于收益。
  - 实施时只需复核一件事：在 `/setup` 上，`auth.global.ts` 中间件和 `setup.vue:53` 有没有对同一页各发一次 `auth/me`。如果重复，就去掉 `setup.vue` 自己那次，改用中间件已有的会话查询。登记文件按集合比对，看不出重复次数。

### 3.3 工作区变更中“符号链接”状态的文案

- 后端状态 `symlink_created` 两端类型里都有（React `core/workspace-changes/types.ts:5`）。
- React：`frontend/src/components/workspace/changes/workspace-change-panel.tsx:221-232` 的 `statusLabel` 只区分 created/deleted，其余全部回退为 “Modified”/“已修改”。
- Vue：`frontend-vue/app/core/workspace-changes/presentation.ts:16` 映射到 `workspaceChanges.symlinkCreated`，显示 “Symlink created”。这个 key 是 Vue 独有的，React 没有。
- 图标两端相同（都按“修改”样式显示）。
- **裁决（2026-11-23，用户授权按推荐）：Vue 跟随 React，显示“已修改”，删除 `workspaceChanges.symlinkCreated`。** 理由：React 是有意这样设计的，`frontend/src/core/workspace-changes/summary.ts:46-48` 的注释写明 `symlink_created` “otherwise renders like a modification (see StatusIcon / statusLabel)”，所以这不是 React 缺陷。做法：`presentation.ts` 把 `symlink_created` 映射到 `modified`，排序名次保持不变，同步中英文词典、`i18n-keys.json` 和单测。

### 3.4 Vue 中有 36 个 i18n key 已无任何引用

这些 key 只有 Vue 有，Vue 代码里也没有引用。动态取值的 `settings.sections[id]` 只会取到 8 个与 React 相同的分区（`core/workspace-shell/settings-query.ts` 的 `SETTINGS_SECTIONS`），`workspaceChanges[...]` 见 3.3。它们是旧版设置分区和旧调度表单退休后的残留文案，按“React 没有的 Vue 不该有”应当清理：

`agents.creationError`、`agents.retry`、`agents.verifying`、`artifacts.loadFailed`、`channels.cancel`、`channels.close`、`channels.connectionExpired`、`inputBox.send`、`inputBox.submit`、`scheduledTasks.actions.trigger`、`scheduledTasks.context.fresh`、`scheduledTasks.context.reuseNoticeDescription`、`scheduledTasks.context.reuseNoticeTitle`、`scheduledTasks.create.prompt`、`scheduledTasks.create.submit`、`scheduledTasks.create.title`、`scheduledTasks.deleteConfirm`、`scheduledTasks.detail.contextMode`、`scheduledTasks.detail.schedule`、`scheduledTasks.detail.thread`、`scheduledTasks.edit.submit`、`scheduledTasks.filters.{completed,cron,enabled,failed,once,paused}`、`settings.account.loadFailed`、`settings.sections.{integrations,skills,tools}`、`settings.skills.{title,description}`、`settings.tools.{title,description}`、`sidecar.deleting`

清理前要同步 `frontend-vue/baseline/i18n-keys.json` 和 `frontend-vue/I18N_INVENTORY.md`，并确认没有测试依赖这些 key。

### 3.5 对齐范围文件需要补登 React 死代码

`frontend/src/components/workspace/conversation-references/conversation-reference-picker.tsx` 和 `reference-conversations-button.tsx` 在 React 里已经没有导入方（会话引用改由 `@` 提及选择器完成）。`frontend/src/AGENTS.md` 第 146 行仍把 `ReferenceConversationsButton` 描述成在用的组件。

建议把这两个模块加入 `react-parity-scope.json` 的 `forbiddenUpstreamModules`（禁止移植），并请上游同步修正 React 文档。这不是 Vue 的缺失。

### 3.6 场景覆盖仍有 1 项 `pending`

`frontend-vue/baseline/parity-scenario-coverage.json` 中的 `artifact-table-performance` 测的是性能（1 MiB CSV 首表延迟、长任务、心跳），对比测试框架表达不了时延断言。Vue 已有镜像 spec `tests/e2e/artifact-table-performance.spec.ts`。

**裁决（2026-11-23，用户授权按推荐）：维持 `pending`，不豁免。** `/artifacts/view` 是 Vue 已经做出来的产品路由。按该文件的规则，`exempt` 只能指向已在 `exemptRoutes` 中的路由，为了关掉这一项去豁免产品路由属于扩大豁免。性能由两端各自的镜像 spec 守住，这一项在本清单中视为已处理，不再作为待对齐项。

## 4. 最近一次实测差异及其在 ROOT 中的现状

数据来源：S15 全量跨端对比，结果是 1114 项通过，`diff.spec.ts` 全矩阵 1 项失败；auth 和 SQL 会话两组因此未执行。完整差异取自外接盘证据 `resume-2026-10-26/s15-complete-diff-discovery/differences-by-field.json`，751 个键中 556 个非零。完整明细见[附录](2026-11-23-vue-react-parity-gaps-s15-appendix.md)。

下表“ROOT 现状”一列只写本次读代码能确认的情况；写“需重跑”的，代码层面无法判定。

| 差异类 | S15 规模 | 主要内容 | ROOT 现状 |
| --- | --- | --- | --- |
“S15 规模”一列是受影响的场景键数（一个键 = 场景#终态/断点/主题/语言），数据来自完整差异文件。

| 差异类 | S15 规模 | 主要内容 | ROOT 现状 |
| --- | --- | --- | --- |
| run 列表请求参数 | 33 个场景、188 个键 | React 带 `?limit=10&offset=0`，Vue 不带 | **已修**：`frontend-vue/app/core/api/client.ts:159` 已带同样的参数 |
| 输入框阴影 | 16 个场景、75 个键 | React 输入框 `boxShadow` 是 5 层透明阴影或焦点环，Vue 是 `none`；涉及 composer、input-group、渠道/模型/业务插件表单 | **已有针对性修改，待重测**：`ComposerSurface.vue:88-90` 已对齐 `InputGroupTextarea` 的 `shadow-none`/`ring-0`，通用 `Textarea.vue` 的 class 与 React 一致。其他表单输入框需逐个重测 |
| 输入框背景模糊 | `chat` 场景、12 个键 | Vue input-group 带 `backdropFilter: blur(8px)`，React 是 `none` | **代码里已无此类名，待重测**：ROOT 的 `ComposerSurface.vue` 已不给 input-group 加 `backdrop-blur`，只有弹出层保留，与 React `input-box.tsx:3133` 相同 |
| `/api/features`、`/api/plugins` 的发起位置 | React 独有：features 21 个场景、106 个键，plugins 34 个场景、108 个键；Vue 独有：调度页 `GET /api/agents` 4 个场景、52 个键 | 两端在不同页面预取了不同的数据 | **需重跑**：取决于查询缓存和发起时机。候选里 `useThreads`、`useChatThreadOwner`、`fetcher` 等都有改动 |
| 设置页的请求组合 | 2 个场景、13 个键（`settings-sync`、`settings-model-sync`） | React 发 `channels/providers` + `/api/threads/search`；Vue 发 `models`、`skills`、`suggestions/config` + LangGraph `threads/search` | **需重跑**：说明设置弹窗下层页面的加载内容不同 |
| 会话搜索走哪个接口 | React 独有 9 个场景、55 个键；Vue 独有 4 个场景、36 个键 | 项目、提及等场景里，两端在 Gateway `/api/threads/search` 和 LangGraph `threads/search` 之间选择不一致 | **需重跑**：ROOT 的 Vue `useThreads` 已走 SDK 的 `threads/search`（`client.ts:109`），按归档查询才走 Gateway（`core/threads/api.ts:177`）；候选又改了 `infinite.ts` 和 `api.ts` |
| 请求体 | 29 个键、14 种 | 提及/MCP 设置的线程搜索体；首次 run 的 stream body；项目文档上传；Memory 导入体 | **需重跑**：Memory 导入在候选里有修复（两端的 `memory/api.ts`、`import-memory.ts`、`schema.ts`） |
| 无障碍树 | React 独有 67 个键（23 种），Vue 独有 77 个键（32 种） | Showcase 表格操作按钮的描述；“Showing 1 of 1”是段落还是文本；多出的 separator；“No saved facts yet.”的元素类型；Loading alert；以及 3.1 的关闭按钮 | **需重跑**：多数是元素类型或结构的细差 |
| 设置页可 Tab 元素和顺序 | React 独有可 Tab 元素 13 个键，Vue 独有 4 个键；Tab 顺序 13 个键 | 设置相关场景里第一个可 Tab 元素 React 是 `button`，Vue 是 `a`；React 多出若干按钮和链接；Vue 在 `thread-history` 多一个可 Tab 的 menuitem | **需重跑** |
| 关闭对话框后的焦点 | 30 个键（6 种） | 集成、图标、技能导出、Memory 导入、删除确认关闭后，React 焦点回到触发处或容器，Vue 落到 `body` | **ROOT 仍是旧代码**：交接 Task1/4/6 的焦点修复在候选里（`DialogContent.vue`、`focus-boundary.ts`、`ThreadDeleteDialog.vue`，以及 React 的 FocusScope/Dialog 补丁），尚未合入 ROOT |
| 字体和字重 | 5 个场景、25 个键 | Memory 导入错误提示等处的 `fontFamily` 和 `fontWeight` 不同 | **需重跑** |
| 其他几何差异 | 见附录“计算样式/几何不同”，共 71 种、140 个键 | 坐标偏移、取样缺失（如 “Export as Markdown” 菜单项只在 Vue 被取到）等 | **需重跑** |

各场景的差异分布（83 个场景，按非零键数排序）见[附录第二节](2026-11-23-vue-react-parity-gaps-s15-appendix.md#二按场景汇总)。

## 5. 交接中已知、尚未关闭的行为差异

以下是摘要，来自 [11-03 交接](2026-11-03-vue-whole-plan-handoff.md) 第 6、11 节，本次没有重新验证。**全计划的完整待关闭细项**已逐条转录到[附录二](2026-11-23-vue-react-parity-gaps-plan-items.md)，包括 R03 剩余工作、T01–T18、P01–P03、F01–F14、W00–W13 及其细项、R00–R12、九项架构、共同矩阵、C01–C13 和视觉范围。

| 项 | 状态 |
| --- | --- |
| Sidecar 搜索请求的 `metadata.parent_thread_id` | 两端请求相同，但请求体和事实层不同；不能靠归一化抹平 |
| regenerate 请求：React 无 key，Vue 有 key | 真实差异，不能伪造相等 |
| run 采纳、join/cancel/stop-during-create、cursor 恢复 | 候选 v4 代码已写，静态检查未过，浏览器未跑 |
| 真实 SDK/adapter 活动 SSE 开关两态 | 只有设计，24 组合未做 |
| 项目文档上传的真实 multipart producer | 3 状态 × 3 维度未做 |
| Memory 并发、多文件、账户切换、取消 | 证据不足 |
| permissions-mobile | 一次未复现不足以关闭，需完整矩阵重验 |
| P01 MCP 容量、P02 横向滚动、P03 Darwin 阈值 0.02 | 依原要求继续 |
| 视觉：751 对 1502 张图逐键比对 + 人工审图；完整键盘焦点三轴 | 最终统一源上未做 |
| 认证/SQL 会话全链路（auth 21、SQL 8） | S15 未执行 |

## 6. 本清单没覆盖的部分

- **上游 React 的新变化**：没有 fetch 上游。10 月以后上游 React 新增的功能，可能已经形成新的、Vue 还没有的差异。下次同步 main 前需要重新做路由、文案和接口三项比对，脚本见第 8 节。
- **运行时行为**：第 4、5 节需要在新的统一源上重跑 `tests/e2e-parity` 全套，以及 auth、session、视觉门禁。本次没有运行。
- **候选与 ROOT 不一致**：第 3、4 节以 ROOT 为准。候选里已有的修复，合入 ROOT 前都不算 ROOT 已对齐。
- **对比测试本身没覆盖的行为**：对比场景以 React 自己的 e2e 用例为坐标（`parity-scenario-coverage.json`：90 个已覆盖、1 个 pending、4 个豁免）。React 没有 e2e 用例的交互行为，这套方法不会发现差异；本次静态比对只覆盖到页面、文案和接口这一层。
- **视觉逐图结果**：751 对 1502 张截图的逐键结果和人工审图结论没有在本清单中逐项列出，范围见附录二第 12 节。

## 7. 建议的处理顺序

3.1、3.2、3.3、3.6 已于 2026-11-23 按推荐裁决（见各节）。实施顺序：

1. 按 [R03 恢复方案](2026-11-23-r03-resume-plan.md) 恢复候选并完成 R03，有界合入 ROOT。
2. **代码修改放到 R03 有界合入 ROOT 之后，在新的统一源上做。** 涉及 3.1（React 关闭按钮本地化）、3.2 的重复请求复核、3.3（Vue 符号链接文案跟随 React）、3.4（清理 36 个无用 i18n）、3.5（补登 React 死代码）。现在直接改 ROOT，会和候选里的同区域改动（如 `DialogContent.vue`、`I18N_INVENTORY.md`、`baseline/`）冲突，并且要在暂停期间运行测试。每项都要配测试，并按“直接退出码”记录。
3. 在合入后的统一源上重跑全量跨端对比。用新结果替换本文第 4 节，逐条关闭或登记。

## 8. 复现本次静态比对

脚本放在 `/tmp`，没有进仓库，下次需要时可以按同样逻辑重写：

- 文案比对：用 `frontend-vue/node_modules/.pnpm/jiti@2.7.0` 加载两端 locale，展平后比较 key 和文案。
- 文案使用：在 React 中按 `parent.leaf` 精确匹配；在 Vue 中允许别名，按“引用父对象的文件里访问了叶子字段”匹配，最后对剩余项全仓搜叶子字段名。
- S15 汇总：读取外接盘 `resume-2026-10-26/s15-complete-diff-discovery/differences-by-field.json`（类别 → 差异 → 场景键），按类别、场景和归一化文本聚合。不要从 `gate.log` 解析，日志里的 diff 输出不完整，只能看到 412 个键。
