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

## 对照台账现在是红的，红在两类没人看过的差异上（2026-09-10）

`make e2e-parity`：**108 passed / 1 failed**，失败的是 `diff.spec` —— 台账与实跑对不上。
scenarios 那 108 条全过，包括这一轮新加的三个场景。

台账**净减少 428 行**（ProjectsSection 那一大类差异消失了：`- text: Projects`、
`- button "New project"`、`- button "Group chats by project"` 各 20+ 次，
`tabbablesOnlyReact` 里 168 个 `"button"`，51 处 tabOrder 差异）。

但有两类**新出现**的行，按 `parity-accept` 的规矩「每一条变化是修好了还是新坏了，
得逐条看清楚」，**没有接受**（不 `PARITY_ACCEPT_GROW=1`）：

### 一、`GET /api/projects?status=active|archived` 进了 `requestsOnlyVue`（98 次）

说的是：这些场景里 Vue 发了这两个请求，React 没发。

已经排除的解释（都实测过）：
- 两边的 URL 拼法逐字相同（`?status=` + encodeURIComponent）；
- React 的 `ProjectsSection` 在 `workspace-sidebar.tsx:34` 是**无条件挂载**的；
- React 的 `useProjects` 只在 `isStaticWebsiteOnly()` 时才 `enabled: false`，
  而 parity 的 React preview（`react-preview.ts` 的 env 块）没设那个变量；
- **同一批差异里 `ariaOnly*` 是空的**——也就是说 React 侧确实把项目区渲染出来了。

渲染了却不发请求，说不通。**下一轮从这里入手**：起一个 React preview，
打开 `/workspace/agents/test-agent/chats/new`，直接看它的网络面板。
在看到那个读数之前不要写结论——这一轮已经在这条上猜错过两次
（先猜「React 认裸数组」，再猜「static mode 挡住了」，都被源码推翻）。

### 二、「第 15 个公共可 tab 元素 React=div[scroll-area-viewport] Vue=button」（16 次）

tab 顺序在第 15 个元素上分叉。这是 ProjectsSection 补齐之后**新暴露**的——
两边现在都有那一片按钮了，顺序才比得出来。同样没查。

### 顺带修掉的两处

- **对照 mock 的项目 fixture 形状是猜的**，与后端 `ProjectResponse` 对不上：
  列表要包一层 `{projects: []}`（写成了裸数组）、少 `instructions`/`presentation`
  两个字段、项目内会话的行形状借用了 thread search 的投影。已按
  `backend/app/gateway/routers/projects.py` 逐字段对齐。
- **`/workspace/projects/[id]` 漏了 `definePageMeta({ layout: "workspace" })`**，
  SSR 直接 500「Workspace toast owner is not available」。从建出来那天就坏着，
  `make verify` 一路全绿——因为没有任何测试访问过那条路由。
  加了门禁 `tests/guards/page-layout-declared.test.ts`。

