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

**仍缺**：`subagents`、`subagent-batches`、`background-tasks`、
`threads/message-order`、`messages/conversation-outline`、`mcp/parse`、
`api/static-response`、`dom/render-activity`、`notification`。

**已补齐**（2026-09-10）：`projects`、`artifacts/delimited-preview*`（含 worker 与工厂）、
`artifacts/viewer`（+ `viewer-route`、`query-keys`）、`threads/archive`、
`threads/thread-branch-tree`、`messages/artifact-archive`。

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
4. **background tasks（#4833）/ subagents（#4887）/ subagent batches（#4998）** —— 三者共用 features 接口
5. **设置页：MCP server 管理（#5022）、本地安装技能包（#5039）**
6. **其余零散**：会话大纲导航（#5025）、分支会话标记（#4983）、复制定时任务（#5064）、
   产物视图 radio→tabs、图标尺寸

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
| 对照场景 pending | 8 | **6** | `baseline/parity-scenario-coverage.json` |
| i18n pending key | 179 | **115** | `baseline/upstream-i18n-map.json` |
| 词典 unused key | 18 | **16** | `baseline/i18n-keys.json`（新增的 24 条 key 全部被引用） |
| 取样面 pending 路由 | 1 | **1** | `baseline/parity-route-sampling.json`（`/workspace/projects/[id]`，缺 mock fixture） |

**i18n pending 剩下的 115 条集中在四块**（跑一次上面那个 json 的分组统计得出）：
`subagents` 38、`backgroundTasks` 32、`subagentBatches` 25，其余 20 条散在
`scheduledTasks`(5)、`skills`(5)、`settings`(4)、`workspace`(3)、`conversation`(2)、`chats`(1)。
前三块正是执行顺序第 4 条，所以下一批做完这 95 条会一起掉下来。
