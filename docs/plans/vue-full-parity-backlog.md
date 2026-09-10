# Vue 全量对齐 React 的工单

**用户 2026-09-10 的指令**：「上游有的 vue 必须实现」「不仅仅是本次合并带来的变更，
还有历史你没对齐 react 版本的都得对齐（除非明确豁免，比如落地页啥的）」
「人工审核」「不要用脚本机械操作」「以真实代码为唯一事实」。

所以这份清单里的每一条都注明**是读哪个文件的哪一段得出的**，不引用任何脚本汇总数字。

## 豁免（不需要对齐）

以 `baseline/react-parity-scope.json` 为准，且这次没有扩大：
`/[lang]/docs/[[...mdxPath]]`、`/blog/[[...mdxPath]]`、`/blog/posts`、`/blog/tags/[tag]`
整站不做；`/` 落地页两边各留各的（内容双向豁免）。
对应地，React 的 `core/blog` 模块不需要对应物。

## 一、路由级（读 `frontend/src/app/**/page.tsx` 与 `frontend-vue/app/pages/**`）

| React 路由 | Vue | 来源 |
| --- | --- | --- |
| `/artifacts/view` | ✅ 已补（`app/pages/artifacts/view.vue`，2026-09-10） | — |
| `/workspace/projects/[id]` | ✅ 已补（`app/pages/workspace/projects/[id].vue`，2026-09-10） | — |

路由缺口已清零：`baseline/react-parity-scope.json` 的 `pendingRoutes` 现在是空数组。

其余路由两边一一对应（含 `/showcase/[thread_id]`、`/workspace/agents/*`、
`/workspace/scheduled-tasks`、`/auth/callback`、`/login`、`/setup`）。
Vue 另有 `/__m0/splitpanes`、`/__m0/visual` 两条自有的可视化验证路由，React 没有——这是本仓独有，不算差异。

## 二、主聊天页（读 `chat-page.tsx` 的 import 段 vs `AgentChat.vue` 的 import 段）

React `components/workspace/chats/chat-page.tsx` 组合的 18 项里，Vue 缺 4 项：

| React | 出处 | Vue |
| --- | --- | --- |
| `ThreadArchiveStatus` | #5236 会话归档 | ✅ 已补 |
| `ThreadBackgroundTasks` | #4833 MCP durable task | **缺** |
| `ThreadSubagentBatches` | #4998 subagent 批量执行 | **缺** |
| `useProject` / `projectIdOfThread` | #5265 projects | ✅ 已补 |

**已核实为「组织方式不同但功能在」的三项**（不要误判成缺口）：
`GoalStatus` → `frontend-vue/app/components/workspace/GoalStatus.vue`；
`ThreadScheduledTasksLink` 与 `ThreadTitle` → Vue 内联在 `AgentChat.vue`
（第 1725 / 1040 / 1051 行的注释就是在对照 React 的实现）。

## 三、侧栏（读 `workspace-sidebar.tsx` vs `ThreadSidebar.vue`）

React 侧栏组合 `WorkspaceHeader / WorkspaceNavChatList / WorkspaceChannelsList /
ProjectsSection / RecentChatList / WorkspaceNavMenu`。
Vue 的 `ThreadSidebar.vue` 有 `WorkspaceChannelsList`、`VirtualThreadList`（对应 RecentChatList），
`ProjectsSection` 与「移到项目」均已补齐（2026-09-10）。

## 四、core 模块（读两边 `core/` 的实际目录）

React 有、Vue 没有对应物的（已排除豁免的 `blog`、以及两边都有只是我脚本误判的 `clipboard.ts`）：

**仍缺**：`threads/message-order`、`api/static-response`、`dom/render-activity`、
`notification`——这四个还没逐个读过代码，不知道是真缺还是「组织方式不同但功能在」
（前面三项就有过这种误判）。**它们不在任何一张 pending 表上**，因为三张表的坐标系
分别是路由、i18n key 和取样点，而「core 模块目录名」不是其中任何一个。
下一轮的起点就是逐个读它们。

**已补齐**（2026-09-10）：`projects`、`artifacts/delimited-preview*`（含 worker 与工厂）、
`artifacts/viewer`（+ `viewer-route`、`query-keys`）、`threads/archive`、
`threads/thread-branch-tree`、`messages/artifact-archive`、`messages/conversation-outline`、
`background-tasks`、`subagent-batches`、`subagents`、`mcp/parse`。

`static-mode.ts` **不补**：`useProjects.ts` 文件头已记下这条取舍——上游用它在静态演示站
屏蔽所有 Gateway 请求（23 处贯穿式分支），本仓改由调用方用 `enabled` / `isMock` 在调用点决定。

（`threads/stream-state` 需要再读一遍：Vue 的流式状态折叠可能在别处，别照名字判缺。）

## 五、尚未人工审的区域（**别当成「没问题」**）

设置页各屏、artifacts 面板内部、scheduled-tasks 页、agents 页、showcase 页、
login/setup 页——这些都还没有逐个读代码比对。
行为级的差异另有对照台账（`baseline/parity-diff.json`）在量，但台账只覆盖场景目录里的那 95 个终态。

## 执行顺序（先做结构性的，避免同一处改两遍）

1. ~~**projects（#5265）**~~ ✅ 2026-09-10（`7510255c`）
2. ~~**thread archive（#5236）**~~ ✅ 2026-09-10（`0e39d9b4`）
3. ~~**artifacts：`/artifacts/view` 视窗（#5056）+ CSV/TSV 表格预览（#5284）+ viewer 模块
   + 归档下载（#5117）**~~ ✅ 2026-09-10（`63116c41`、`bcada492`）

   同一批顺带补的（都属于「历史没对齐」）：会话列表页的归档页签 + 三条空态 + 加载失败重试
   + 行内恢复键；产物面板视图切换那两颗键的可访问名；从项目里新建会话的项目归属
   （`?project=` 此前没有任何消费者）；上一轮遗留的 5 个死导入。
4. ~~**background tasks（#4833）/ subagents（#4887）/ subagent batches（#4998）**~~
   ✅ 2026-09-10（`0107650b`、`0f98f2a1`、`8af549ee`）
5. ~~**设置页：MCP server 管理（#5022）、本地安装技能包（#5039）**~~
   ✅ 2026-09-10（`4d312031`）
6. ~~**其余零散**~~ ✅ 2026-09-10
   会话大纲导航（#5025，`cd1e61ec`）、分支会话标记（#4983，`c96bba31`）、
   复制定时任务（#5064，`d7c3127b`）、模型加载失败提示（`26180e5e`）、
   图标尺寸（`8a5d3e68`）。
   **「产物视图 radio→tabs」这一条已经不成立**：两边现在都用 ToggleGroup，
   补可访问名那一批顺带对齐了——这份清单写下时它就已经过期。

---

## ProjectsSection 功能清单（读 `frontend/src/components/workspace/projects-section.tsx` 355 行逐条列出）

实现完**逐条回来对**，这份清单就是「不缩水」的验收标准。

### Section 外壳
1. 标题 `t.projects.title`
2. 分组/平铺切换键：图标 `FolderTree`(grouped)/`List`(flat)；title 与 aria-label 随状态变
   （`switchToFlat`/`switchToGrouped`）；`data-testid="projects-display-mode-toggle"`
3. 切换写入本地设置 `projectsDisplayMode`（`"grouped"` / `"flat"`）
4. 新建项目键：`Plus`；title 与 aria-label 都是 `t.projects.newProject`；
   `data-testid="projects-new-project-button"`
5. 静态演示模式**整节隐藏**（上游 `isStaticWebsiteOnly()`；本仓没有这个开关，需要等价决定）
6. 只有 grouped 模式才渲染分组列表
7. 侧栏收成图标条时该区域 `pointer-events-none` + `-mt-8` + `opacity-0`

### 新建对话框
8. 标题 `t.projects.newProject`
9. 输入框 placeholder `t.projects.namePlaceholder`
10. Enter 提交，且**输入法组合中不提交**（`isIMEComposing`）
11. 取消键 `t.common.cancel`
12. 创建键 `t.projects.create`；**名字为空或提交中时禁用**
13. 成功后关闭对话框并清空输入
14. 失败弹 toast：有 `error.message` 就用它，否则 `t.projects.createFailed`

### 分组列表
15. 同时取 active 与 archived 两份项目列表
16. 两份都空时**整个列表渲染为空**
17. 用**已取回的**无限会话页在客户端分组，不为此额外发请求
18. `recentThreadId` 传的是**全局最近会话**，不是分组内第一条、也不是截断后的列表
19. **路径上的活动会话即使超出显示上限也要参与分组**——否则一个正在看的已归属会话
    会在平铺列表和项目分组里**都不出现**
20. 按 `projectIdOfThread` 分组，未归属的跳过
21. archived 非空才渲染归档分组

### 项目分组（每个项目）
22. 可折叠，**默认展开**
23. 头部是指向 `/workspace/projects/{id}` 的链接，`Folder` 图标，`title` 为项目名，
    当前路径匹配时高亮
24. 折叠触发器 `aria-label` 为项目名；箭头随展开旋转 90°
25. 内容区左侧边框缩进
26. 会话经 `flattenThreadBranches` 展开分支后逐条渲染，传 `branchEntry` 与 `recentThreadId`

### 归档分组
27. 可折叠，**默认收起**
28. `Archive` 图标 + `t.projects.archived`
29. 内部复用项目分组组件

### 本仓缺的前置件（做这一节之前要先补）
- `projectIdOfThread`（`core/threads/utils`）
- 本地设置项 `projectsDisplayMode`（`core/settings/local`）
- `flattenThreadBranches`（`core/threads/thread-branch-tree`）——属于 #4983 分支会话，
  第 26 条依赖它

---

## 进度实测（2026-09-10，跑门禁得出，不是估计）

| 账 | 起点 | 现在 | 怎么量 |
| --- | --- | --- | --- |
| `pendingRoutes` | 2 | **0** | `baseline/react-parity-scope.json` |
| 对照场景 pending | 8 | **5** | `baseline/parity-scenario-coverage.json` |
| i18n pending key | 179 | **0** | `baseline/upstream-i18n-map.json` |
| 词典 unused key | 18 | **16** | `baseline/i18n-keys.json`（这一轮新增的 key 全部被引用） |
| 取样面 pending 路由 | 1 | **0** | `baseline/parity-route-sampling.json` |

**三张 pending 表全空。** i18n 那张归零意味着：上游词典里的每一条，本仓要么同名有、
要么在那 4 条手工判过的别名里——没有第三种情况。

对照场景 pending 剩 5 条：`artifact-table-performance`（性能三例，依赖 e2e 跑真 Worker）、
`background-tasks`、`mcp-settings`、`thread-ordering`、`thread-title-sync`。
**功能都已经做了**，缺的是对照目录里的场景——那是取样面的活，不是功能缺口。

## 这一轮顺带修掉的三处门禁盲区

都不是功能，但都属于「以后不会再犯」的那类：

1. **`upstream-key-coverage` 的词典解析器**把跨行模板字符串里的括号数进了段名栈
   （`settings.tools.addServerPlaceholder` 的值是一段多行 JSON 示例）。后果是那张
   基线表整个按错坐标系记了几百条账，`movedByUpstream` 里 164 条「上游拍平了路径」
   全是假象。修掉之后真实缺口只有 37 条。
2. **模板里用到却没导入的组件**：`vue-tsc` 和 `eslint` 双双放行，Vue 会把它当未知
   HTML 元素静默渲染成空。新增门禁 + 自证。
3. **script 里靠 Nuxt 自动导入的 Vue API**：生产不报错，但不经过 Nuxt 的 dom 测试
   一挂载就 `ReferenceError`——也就意味着那个组件从来没被挂载测试过。同一次扫出 3 处。

另加一道 **菜单项图标尺寸** 门禁：`icon-parity.mjs` 只报「两边完全不相交」的尺寸，
看不见「调用点覆盖了 primitive 默认值」这一类。

---

## 对照台账：2026-09-10 收工时的实测状态

数字都用 `baseline/parity-diff.json` 与实跑的 `report.json` 逐行比出来，不是散文估计。

| | 行数 |
| --- | --- |
| 签入基线 | 1070 |
| 这一轮实测（`2b41e1bd` 那次） | 502 |
| 再修一轮之后（`3bacbe49` 前的那次） | 431 |

`make e2e-parity`：**108 passed / 1 failed**，失败的就是 `diff.spec` 的台账比对。

### 审「新增行」的判据（这一轮踩出来的，下一轮直接用）

台账只能缩短，所以每一条新增行都要过一遍。但**「新增行」不等于「新坏了」**——
实测这一轮 107 条新增里，真正是新问题的只有个位数。四类分开看：

1. **序号漂移。** `order` / `tabOrder` 报的是「第 N 个节点/可 tab 元素」，
   而它们只报**第一处分岔**。别处修好了，第一处分岔就往后挪，同一条差异会以
   新的 N 重新出现。实测：`chat-thread-init-ordering` 的
   `React=button "Copy to clipboard" Vue=- paragraph:` 从「第 38 个」变成「第 41 个」，
   基线里本来就有，不是新的。
2. **数值变好。** `geometry` 的行把数值写进了行里，于是差距**变小**也是
   「删一行 + 加一行」。实测：`agents-feature-disabled#gallery` 的对话框高度
   从 Δ-135.1 变成 Δ-6.2，读起来像新增。
3. **原本被遮住、现在才看得见。** 实测：`artifact-batched-stream#preview-failed` 的
   两颗 radio 此前在本仓是**匿名**的（`- radio` / `- radio [checked]`），
   补上可访问名之后才比得出「两边选中的不是同一颗」。修好一个问题会露出下一个。
4. **真的新坏了。** 只有排除掉前三类之后剩下的才是。

**判据是「拿同一个场景键去基线里查它原来长什么样」**，不是看行文本在不在基线里。
`python3` 三行就够：读两份 JSON，按场景键并排打印非空字段。

### 还开着的账

- **`chat-thread-init-ordering` 上多出一颗 `button "Edit and rerun"`（3 行）。**
  这是 **seq 移植带来的**：本仓此前压住了第一个共有锚点之前那条受保护的人类消息，
  现在跟上游一样把它编织出来了（同一轮里 6 行旧差异因此消失，含一处 80px 的
  垂直偏移），于是「最新可编辑回合」落在了一个新的位置上，而上游那边没有这颗键。

  已经读过的：上游 `canEdit`（chat-page.tsx:474）比本仓的 `show-edit`
  多了 `!isNewThread`、`!isUploading`、`!thread.isLoading`、`!branchThread.isPending`、
  `!hasGoal`、`!hasOpenHumanInputCard` 六项，其中 `!isMock` 本仓由
  `interactive="!isDemo"` 覆盖、`!isNewThread` 等价于本仓的 `threadId != null`
  （两边都在 onStart 里换路由）。**剩下几项本仓的 MessageList 根本拿不到**，
  所以到底差在哪一项还没测出来。
  下一轮：在 `chat-thread-init-ordering` 上加一次临时 dump，把两边这几个值打出来
  ——**在看到那个读数之前不要动代码**（这一轮已经在别的条目上猜错过三次）。

- ~~「第 15 个公共可 tab 元素 React=div[scroll-area-viewport] Vue=button」~~
  **不是开着的账——它在 `docs/plans/vue-parity-open-accounts.md` 第 6 条（wave 98）
  就已经判过「不跟」了。** 上游把欢迎建议行套在 `ai-elements/suggestion` 的
  `Suggestions` 里，而那就是一个 `ScrollArea`：里面是 `flex flex-wrap`（内容本来
  就换行），外面那条横向 `ScrollBar` 写着 `className="hidden"`——**永远不会真的滚动**，
  只多出一个键盘停靠点。本仓用普通 flex 容器，什么都没少。
  翻案判据是「上游把那条 `hidden` 去掉」——2026-09-10 复核，**还在**，原判有效。
  基线里 43 个场景带这条 `tabbablesOnlyReact`，16 条 `tabOrder` 是它的下游序号效应。

  **这次我差点重查一遍。** 教训记在这里：本仓的挂账分散在三份文档里——
  `vue-parity-open-accounts.md`（逐条判过的账）、`vue-parity-handoff.md`（历轮交接）、
  以及本文件。**查一条台账之前先在这三份里搜一遍关键词。**
- **`tests/` 整棵树没有类型检查。** Nuxt 的 tsconfig 只 include `app/**` 与
  `tests/nuxt/**`，所以 `make typecheck` 看不见 `tests/`；vitest 只转译不查类型。
  实测：临时给 `tests/**` + `playwright*.config.ts` 开一份 tsconfig 跑 `vue-tsc`，
  **346 条错误**，绝大多数是测试脚手架的类型学（`global.mocks` 只给一半、
  只读夹具、vue-test-utils 的 `DOMWrapper`），不是真 bug。开这道检查是独立的一轮活。
  在它开起来之前，**别在 `tests/` 里写类型层断言**——那等于写了个不会执行的注释
  （本轮实测过：改坏字段表两次，`vue-tsc` 都是绿的）。
- ~~`core/threads/message-order`（435 行）还没逐行读过~~ **已读完并移植**（`a12ae79f`）。
  四个模块全部结账：`dom/render-activity` 已覆盖、`api/static-response` 属静态整站
  模式豁免、`core/notification` 的四处差异已修（`03c03848`）、
  `threads/message-order` 的 **seq 骨架整段缺失**，已补（新增 `core/threads/message-seq.ts`
  与 17 条用例）。**这一栏现在是空的**——下一轮要找活得换个坐标系。
- ~~`focus` 档：`React=button "Account" Vue=button "Integrations"`~~ **已修。**
  本仓接管了 `open-auto-focus`，把焦点放到**当前分区**那颗导航键上；上游没有这一手。
  那是一处**没有依据的分歧**：既没有注释说明，也没有用例钉过它。
  实测去掉这个覆盖之后 reka 的默认焦点**也是 "Account"**——两个 primitive 在这件事上
  一致，删掉即对齐。

### 这一轮结掉的两笔旧账

- **`GET /api/projects?status=*` 只有 Vue 发（98 次）——已修。** 根因不是猜的那三条，
  是 React 的 `useProjects` 住在 `GroupedProjectList` 里，而**扁平模式是默认值**，
  那个组件根本不渲染。本仓改成 `useProjects(..., { enabled: groupByProject })`
  （与上游 `recent-chat-list.tsx:492` 同一条），实测那 98 行消失。
- **对照 mock 的项目 fixture 形状是猜的**，已按
  `backend/app/gateway/routers/projects.py` 逐字段对齐。
- **`/workspace/projects/[id]` 漏了 `definePageMeta({ layout: "workspace" })`**，
  SSR 直接 500。加了门禁 `tests/guards/page-layout-declared.test.ts`。

## 2026-09-10 这一轮补的门禁（都做过变异验证）

| 门禁 | 它守的失效方式 | 实测证据 |
| --- | --- | --- |
| `as-child-is-supported` | `as-child` 传给接不住它的组件，静默失效 | `Button.vue` 没有 `asChild`，`<Button as-child><a>` 渲染成 `<button><a>`；tsc/eslint 双双放行 |
| `breadcrumb-linkable-sections` | 面包屑链到不存在的路由 | 「Projects」指向 `/workspace/projects`，而那条路由不存在 |
| `parity-ledger-fields` | 报告脚本的字段表与 `DiffEntry` 漂移 | 脚本停在 5 个字段而类型有 11 个，六档差异一行没算、总数照打 |
| e2e 独占锁（不是测试，是运行时闸门） | 两轮 e2e 并发互删产物 | 两轮撞在一起产生 3 条假失败，判断它们不是回归花了 25 分钟 |
| `make build` 的 e2e 闸门（同上） | 构建重写 `.output/`，正在跑的 e2e 的 preview 从那里取文件 | 跑一半时执行 `make verify`，那一轮当场 `500 ENOENT: .output/public/_nuxt/vendor-*.js.br`，13 分钟作废 |
