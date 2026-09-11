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

## 进度实测（2026-09-12 现场量，每一格都写了怎么量的）

| 账 | 起点 | 现在 | 怎么量 |
| --- | --- | --- | --- |
| `pendingRoutes` | 2 | **0** | `baseline/react-parity-scope.json` 的 `pendingRoutes.routes` |
| 对照场景 pending | 8 | **1** | `baseline/parity-scenario-coverage.json` 的 `pending` |
| i18n pending key | 179 | **0** | `baseline/upstream-i18n-map.json` 的 `pending.keys` |
| 词典 key / unused | — | **1139 / 15** | `baseline/i18n-keys.json` 的 `total` / `unusedTotal` |
| 取样面 pending 路由 | 1 | **0** | `baseline/parity-route-sampling.json` 的 `pending` |
| 台账 | 330 | **154 唯一行 / 170 多重集 / 129 场景-维度** | 数 `baseline/parity-diff.json` 的 `entries`（`parity-ledger-report.mjs` 要有上一次运行产物才跑得出来，签入基线是随时可数的） |
| 产品 SFC | — | **267**（另有 2 个 `__m0` fixture 排除、0 个未扫） | `node frontend-vue/scripts/i18n-source-guard.mjs --inventory` |

**三张 pending 表全空。** i18n 那张归零意味着：上游词典里的每一条，本仓要么同名有、
要么在那几条手工判过的别名里——没有第三种情况。

**对照场景 pending 只剩 1 条**：`artifact-table-performance`。它**不是取样面的活**
——那三例量的是时延与长任务，对照工厂的坐标系（aria / 几何 / 请求）表达不了；
本仓已经带了一份镜像 spec（`tests/e2e/artifact-table-performance.spec.ts`），
所以「什么时候重新问」那个条件**已经满足**，2026-09-11 复核的结论是
**仍然留在 pending、不进 exempt**（exempt 要求那条路由已在 `exemptRoutes` 里，
而 `/artifacts/view` 是本仓做出来了的产品路由）。理由原文在那份基线的 `$pendingReasons`。

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

## 读台账数字之前先知道这一条（2026-09-11 量出来）

`node scripts/parity-ledger-report.mjs` 打印的「台账 N 行」是**去重之后**的数字：
它内部用 `Set` 收行，同一条差异出现三次只算一行。真正的门禁
（`diff.spec.ts` 的 `toEqual(baseline.entries)`）是整棵深比，**看得见重复**。

实测撞上的地方：`chat-thread-init-ordering` 上
`requestsOnlyReact: POST /api/threads/search` 有 **3 条重复**，修掉两条之后
报告里的行数**一点没变**（204 → 204），按多重集数才看得出 226 → 224。
**判「有没有变好」要比基线文件本身，不要只看这个数字。**

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

### 下一笔开着的账：**窄屏下的设置对话框，两个应用各有一颗够不着的控件**（2026-09-11 量出来）

给 `integrations` 加了一维 `mobile/light/en-US`（375×812）之后当场现形：

- ~~上游那颗技能开关 `x=395.5`、命中 off-screen~~ **已修**：根因是 Radix 的 ScrollArea
  把子节点包进 `min-width:100%; display:table`，table 盒取收缩到适合的宽度，
  于是放不下的 header 把整个面板撑宽、下面每行跟着排。两边同改成
  `flex flex-wrap justify-between gap-2`，实测那一屏 4 → 2 行。
- ~~本仓那颗「在浏览器重新注册」同样 off-screen~~ **误读，已订正**：那一行的 `x`
  两边相同，只有 `y` 差 274.9，而 `hit` 用的是探针那一刻的**视口**矩形，
  竖直滚出去也记 `off-screen`。它是位移的投影，不是够不着的控件。
  判据写在 `vue-parity-open-accounts.md` 对应那一节。
- 两边 `integrations#permission-request` 上三颗权限芯片的折行方式不同
  （`Docs` 的 x 差 107、`Drive` 差 -65.6，命中目标分别落在 span / div(dialog) / button / p 上）。

**修的时候先看这一条**（2026-09-11 实测，不是猜的）：
**上游那一侧的窄屏溢出，根因几乎总在 `display:table` 那层包装**——
Radix 的 ScrollArea viewport 把子节点包进 `min-width:100%; display:table`，
table 盒取**收缩到适合**的宽度，所以「放不下」不会变成「溢出被裁」，
而是**把整个面板撑宽**，下面每一行跟着按那个宽度排。找那一屏里
**放不下的那一行**（通常是 header 那种 `flex justify-between`），给它 `flex-wrap`。
reka 的 viewport 没有这层，所以本仓那一侧看不出来——**两边同改**才能保持这一行逐字相同。

`min-w-0` 试过了，**对这条无效**（读数一行没动）；六处还是补上了，
因为它与上游 `channels-settings-page.tsx:187` 一致，且是同一种失效的潜伏版本。

### 剩下的两簇（`change-app` 11 行 + `permission-request` 11 行）：**四条死路已经排除，别重走**

读数解出来了：**上游 Docs+Drive 在同一行，本仓 Drive 换到下一行**
（Drive 的 y 比 Docs 多 40）——本仓的芯片更宽，或者说**上游的面板更宽**
（同一簇里 `role:textbox[App ID] width React=192.2 Vue=167 Δ-25.2`）。
`y Δ79~275` 全是这处差异往下累积的位移；三行 `hit`（React 命中 span/span/button、
本仓命中 div/div(dialog)/p）**不是独立缺陷**——`hit` 用的是探针那一刻的视口矩形，
这些元素在文档 y≈1842~2001 处、面板滚动位置又不同，命中的自然是各自那一点上画着的东西。
（判据见 `vue-parity-open-accounts.md`：`hit=off-screen` 只有在同一行的 `x` 也超出
视口宽度时才读成「横向够不着」。）

**2026-09-11 逐条排除掉的四条**（每条都实测过，不要重试）：

| 假设 | 结果 |
| --- | --- |
| 芯片尺寸不同 | **不是**：两边 `Button` 的 `sm` 档逐字相同（`h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5`） |
| 芯片容器不同 | **不是**：两边都是 `flex flex-wrap gap-2`，`Input` 的容器都是 `space-y-2` |
| 长串没加换行类 | **不是**：两边 `StatusItem` 的 value 都写了 `break-words` |
| Radix 的 `display:table` 撑宽了面板 | **测了，无效**：给设置面板的 ScrollArea 加 `[&>div]:block` 覆盖掉它，`PARITY_ONLY=integrations` 读数 **86 → 86**，一行没动。那个改动已还原 |

**已知为真的**：默认态下两边面板**完全一致**（探针实测：对话框 343、viewport clientWidth
291、scrollWidth 291、超宽元素 0 个）。所以差异**只存在于「已连接 Lark」那两个状态**，
是那两个状态里的内容造成的。

**下一步该怎么做**：写一个探针**真正走到 change-app 那个状态**
（把 `**/api/integrations/lark/status` 路由到 `scenarios.ts` 里 `integrations` 那份
夹具的 JSON，然后点开「切换 App」——我那次失败是因为按钮的可访问名没匹配上，
**先去读真实文案**），再对比两边 `App ID` 输入的父链宽度，找出是哪一层开始差 25px。
探针的写法照 `vue-parity-open-accounts.md` 里记的那两个（焦点探针、宽度探针）。

**还有一条一定要记住的探针纪律**：`querySelector('[data-slot="scroll-area-viewport"]')`
会抓到**页面上第一个**——聊天页欢迎建议行那个 ScrollArea，不是对话框里的。
必须限定在 `[role=dialog]` 里面查，否则读出来的数全是错的（我第一次就这么错了一轮）。

这一维带进来的行已经接受进基线（判词是「已确认是缺陷，工单在这里」），
所以**修好之后台账会自己缩短**，不需要再开一次逃生口。


### ~~手写 `<input>` / `<textarea>` 没有任何守卫~~ **2026-09-11 当轮做掉了**

起因是 `agents-feature-disabled#gallery` 上那两行
`[role=dialog] height Δ-6.2 / y Δ3.1`（对话框居中，高度差一半就是纵向偏移）。
根因是 `AgentSettingsDialog.vue` 里温度与最大 token 两个数字输入**是手写的**
`<input class="border-input … px-3 py-2">`，而上游用的是 `ui/input`。手写那一版丢掉的是
焦点环（`focus-visible:ring-[3px]`）、无效态（`aria-invalid:`）、禁用态样式、深色主题
token 与 `h-9` 的统一高度——**同一个对话框里另外三颗 Select 走的都是 primitive 的高度**，
只有这两个不是。改成 `<Input>` 之后那两行清零。

仓里有 `handwritten-button` 守卫（双向清单 + 逐条写明「上游那处是什么」），
**却没有 input/textarea 的对应物**。上面这处缺陷因此一路活到今天，
而且改回去不会让任何门禁变红。

盘点（`app/components` + `app/pages`，注释剥掉后按开标签数）：**19 份文件**。
先分三类，再逐条去上游对：

- **照抄不动**（上游同样手写，或天生就该是裸元素）：
  两个 composer 的 `data-slot="input-group-control"` textarea
  （`ChatComposer.vue` / `AgentBootstrapComposer.vue` / `SidecarPanel.vue`，
  上游 `ai-elements/prompt-input.tsx` 也手写）、四个隐藏 file input
  （`ChatComposer` / `SidecarPanel` / `MemorySettings` / `SkillSettings`）、
  六个 checkbox（`HumanInputCard` / `ArtifactTablePreview` / `AgentSettingsDialog` ×2 /
  `login.vue` / `setup.vue`）。
- **要改**（上游走 `ui/input` / `ui/textarea`，本仓手写）：
  `AgentChat.vue` 的编辑框、`ThreadSidebar.vue` 的重命名框、
  `ArtifactTablePreview.vue` 的单元格只读框、`ChannelRuntimeConfigDialog.vue` 的凭据框、
  `MemorySettings.vue` 的三处、`chats/index.vue` 的搜索框
  （它把 Input 的 class 串整段抄进了 `class`，连 `data-slot="input"` 都手写了）。
- **要先看上游有没有对应物**：`scheduled-tasks/` 那三份（`ScheduledTaskDetail` /
  `ScheduledTaskForm` / `ScheduledTaskScheduleInput` 共 10 处，走的是本仓自己的
  `inputClass` / `textareaClass` 常量）。

做法照 `handwritten-button` 那一份：先逐条对上游、把该改的改掉，**剩下的写进双向清单
并逐条注明「上游那处是什么」**，清单里有、实际没有的条目同样报错。

**结果**：7 份文件改成 primitive（19 份 → 12 份、约 30 处 → 16 处），
守卫落在 `tests/guards/handwritten-input.test.ts`，做过变异验证。
三份把基类抄成本地常量的（`inputClass` / `textareaClass` / `editInputClass` …）
**抄的那几份都漏了 `aria-invalid:` 与 `disabled:`**——无效态与禁用态在那些字段上
一直不生效。逐条判词在 `vue-parity-open-accounts.md`。

**这一笔同时开出下一笔**：三个 composer（`ChatComposer` / `AgentBootstrapComposer` /
`SidecarPanel`）的输入框上游走 `PromptInputTextarea → InputGroupTextarea → <Textarea>`，
而**本仓没有移植 `ui/input-group`**，整块 composer 外壳是手写的。


- ~~`thread-title-sync/zh-CN` 的 `focus` 幻影差异~~ **判词只对了一半，2026-09-11 订正：
  取样点确实不稳，但它盖住的是一条两个应用都有的真缺陷**（重命名对话框关掉之后
  焦点掉回 `body`）。把最后一步换成 `visible: button:focus` 之后抖动消失、两边先后
  稳定超时，探针逐一量过。详见 `vue-parity-open-accounts.md` 对应那一节。
  下面这段是当时的原话，留着看判据是怎么被推进的：

  ~~已确认是取样点不稳，并修好。~~
  它在一轮里有、下一轮里没有，而且只在一个语言维度上出现。根因是 steps 停在
  「新标题出现」——那一刻焦点还在往回还（对话框把它交还给触发它的那颗 ⋯ 键）。
  加一条 `hidden: dialog[Rename]` 之后那一行消失，零新增。

  **这是本轮第二次踩同一个形状**（第一次是 `chat-thread-init-ordering` 的
  `Edit and rerun`）。判据已经很清楚：**语言维度不对称的差异，先怀疑取样时机，
  不要先怀疑渲染规则**——一条真的渲染差异不会只在 zh-CN 上出现。


- ~~`ui/item` 这一族 primitive 本仓没有~~ **已移植（六个）并改了三个设置页。**
  上游十个导出里，四个设置页只用到六个（Item / ItemMedia / ItemContent /
  ItemTitle / ItemDescription / ItemActions），另外四个（ItemGroup /
  ItemSeparator / ItemHeader / ItemFooter）一个调用点都没有，按「不承重就别写」不移植。

  实测效果（`mcp-settings` 取样点）：描述那一处的 5 行几何差异塌成 1 行，
  宽度差从 **Δ-592.9 变成 Δ8**，fontSize / height / x / y 全部对上。

  **还剩 `ChannelConnections.vue` 没改**：那一处不是 1:1 替换——本仓在 provider 行
  下面多一段「账号列表」，上游那一行之后只跟一个对话框。而且 channels 设置页
  **没有任何对照取样点**，改了也没有机器能验证。留作独立一笔，
  真要做就先给它加取样点。

  同理 `SubagentSettings.vue` 虽然已经改了（1:1 结构替换、typecheck 与单测都过），
  它那一页同样没有取样点——ledger 证明不了它，只有代码与上游逐行对得上这一条。

- **重命名之后上游会重取，本仓不重取**（`thread-title-sync` 量到 4 行）：
  `requestsOnlyReact: GET /api/langgraph/threads/{id}` 与 `POST /api/threads/search`。
  本仓靠乐观缓存更新，上游改完再读一遍。哪种对还没判——先记下读数。

- ~~**侧栏当前会话行的字重**（`thread-title-sync` 量到 2 行）~~ **已修（2026-09-11）。**
  根因不是「忘了写 `font-medium`」，是 **`ThreadSidebarItem.vue` 手抄了
  `sidebarMenuButtonVariants` 的一部分类串**——抄了 `data-[active=true]` 的背景色与
  前景色，漏了同一串里的 `data-[active=true]:font-medium`。一起漏的还有键盘焦点环
  （`outline-hidden ring-sidebar-ring focus-visible:ring-2`）、
  `hover:text-sidebar-accent-foreground`、`active:*` 与 `transition-*`。
  同一个仓库里 `ProjectThreadGroup.vue` 用的就是
  `<SidebarMenuButton as-child><NuxtLink>`，只有这一处是手抄的。

  **坑 202 的第四次**：这条新守卫写完当天就把 `WorkspaceChannelsList.vue` 头注释里
  那句「还留着一条死类 `group/menu-item`」报成了违规。**扫源文本的守卫，扫之前一律
  先剥注释**——这条判据已经写在 `handwritten-button` 与 `e2e-suite-contract` 的
  文件头里，而我写第三条时还是漏了。

  **新门禁 `primitive-marker-classes`**：`ui/` 定义的那些 `peer/x` / `group/x`
  标记类不许在 `ui/` 之外被手写出来——写下 `peer/menu-button` 等于宣称「我就是那颗
  SidebarMenuButton」，而手抄永远只抄一部分。它第一次跑就抓到**第二处**：
  `WorkspaceChannelsList.vue` 手写了 `SidebarGroup` / `SidebarGroupLabel` /
  `SidebarMenu` / `SidebarMenuItem` 四层（上游那一处用的是这四个 primitive），
  其中 `group/menu-item` 还是条死类——没有任何 `group-hover/menu-item` 引用它。


- **`topology.spec.ts:112 › react renders the same accessibility tree on two loads` 会偶发红。**
  实测差异是上游第二次加载多出一颗 `button "Batches"`：`subagent_batches.enabled`
  这个 feature 标志是异步到的，取样时它到没到决定了那颗按钮在不在。
  **是上游侧的竞态，与本仓无关**，单独重跑那条 spec 5 条全过。
  下次再看到它别当回归——判据是「差异只在 React 自己两次之间，本仓的台账是零差异」。


- **`chat-thread-init-ordering` 上多出一颗 `button "Edit and rerun"`（3 行）。**
  这是 seq 移植带来的：本仓此前压住了第一个共有锚点之前那条受保护的人类消息，
  现在跟上游一样把它编织出来了（同一轮 6 行旧差异因此消失，含一处 80px 的垂直偏移），
  于是「最新可编辑回合」落在了一个新的位置上。

  **2026-09-10 已实测**（临时 dump 打两边的 aria 树，跑完即撤）：

  ```
  react:  text: Hello / Copy · text: Hello / Copy · paragraph: Hello from DeerFlow! / Copy
  vue:    text: Hello / Copy · text: Hello / Copy · **Edit and rerun** · paragraph: … / Copy
  ```

  两边的消息组**逐条相同**，上游**一颗 `Edit and rerun` 都没有**，本仓在最新那条
  人类消息上有一颗。所以不是「本仓画重了」，是「上游这一屏上根本不画」。

  已经排除的：`getLatestEditableTurn` 两边同源、`isLoading` 为真时都返回 null，
  而两边都画出了 `Copy to clipboard`（上游那颗按 `!isLoading` 关），
  说明**两边都认为这一轮跑完了**；侧栏截图显示新会话已被选中，
  说明 `onStart` 跑过、上游的 `isNewThread` 已经是 false。
  上游 `canEdit` 余下的 `!isUploading` / `!branchThread.isPending` / `!hasGoal` /
  `!hasOpenHumanInputCard` 在这一屏上都不成立。

  **还剩一种可能没测**：上游的 `thread.isLoading`（SDK 的 useStream 维护）
  在 SSE 连接关闭之前一直为真，而本仓的 `streaming` 在收到终局事件时就翻假——
  也就是**两边认为「这一轮结束了」的时刻不同**。要坐实它得给上游加一次临时探针
  （把 `thread.isLoading` 打出来），那是下一轮的活。

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
- ~~**`tests/` 整棵树没有类型检查**~~ **已清零并接进 `make verify`（2026-09-11）。**

  Nuxt 的 tsconfig 只 include `app/**` 与 `tests/nuxt/**`，vitest 又只转译不查类型。
  上一轮记的「346 条」是我自己量错的：那份临时 tsconfig 覆盖了 `include`，
  把 `.nuxt/nuxt.d.ts` 挤出了程序，于是 165 条 `Cannot find name 'useNuxtApp'`
  一类的假错。用对的 include（签入的 `tsconfig.tests.json`）真实数字是 **134**，
  分两段清完：134 → 89 → **0**。门禁是 `make typecheck-tests`，已在 verify 的先决条件里
  （`tests/guards/doc-facts.test.ts` 的 `VERIFY_STEPS` 钉着这件事）。

  **「测试脚手架的类型学」这个判断本身是错的。** 这 134 条里挖出的真缺陷，
  按「不修会怎样」排序：

  1. **`use: { reducedMotion: "reduce" }` 在 Playwright 1.59 里根本不是选项**，
     写在 `use` 顶层不会报错，只是**安静地不生效**。实测（探针 spec，about:blank +
     `matchMedia("(prefers-reduced-motion: reduce)").matches`）：顶层 → `false`，
     `contextOptions.reducedMotion` → `true`。本仓两处这么写过。
     对照取样那处**没有造成后果**，因为 `diff.spec.ts` 是自己
     `browser.newContext(PARITY_CONTEXT_OPTIONS)` 开 context 的，而 `newContext`
     认识这个键——**同一份常量喂两个形状不同的口子**，才是真正看走眼的地方。
     `tests/e2e/reduced-motion.spec.ts` 更早撞见过同一现象，当时归因成
     「describe 级选项没传下去」，没找到原因。新门禁
     `tests/guards/playwright-use-options.test.ts` 从 Playwright **自己的类型声明**
     里取合法键，所以升级之后哪天它进了 use 顶层，门禁自己松开。
  2. **e2e 的 agent mock 带着 `system_prompt`**——`AgentResponse`
     （`backend/app/gateway/routers/agents.py:39`）根本没有这个字段，是 mock
     自己长出来的键。`MockAgent` 现在就是 `Agent` 本身，`MOCK_AGENTS` /
     `GALLERY_AGENTS` 同理。
  3. **`useSidecarSession().submit()` / `submitHumanInput()` 的返回类型被推成字面量
     `false`**：`accepted` 只在 `onAccepted` 回调里被写，TS 的控制流看不进闭包。
     而调用方（`MessageList.vue:540`）正是靠这个返回值决定要不要把 pending 撤回来
     ——类型在说「这个函数永远失败」。已显式标注 `Promise<boolean>`。
  4. **假 runner 少了 `refreshDurableState`**：`useThreadStream` 在
     `mode === "run-end"` 那条路径上调它，夹具里那是个不存在的方法。
  5. **`WebServerEntry` 在联合上分配后塌成 `never`**，四份 playwright config 全红；
     两处各写了一份，现在只有 `tests/support/playwright-factory.ts` 那一份对的。
  6. **`scenario-coverage` 的选择器守卫只扫 `settle` 与 `steps`**，
     而声明了终态的场景把绝大多数步骤写在 `states[].steps` 里——那一片完全透明；
     顺带它对 `press` 步骤会抛 TypeError（`"selector" in undefined`）。已补齐三种形状。
  7. **16 处 `wrapper.get(sel).exists()` 是恒真断言**——`get()` 拿不到就抛。
  8. `ParityTarget` 的 `name` 写成必填，而两处场景有意只按 role 定位。

  **`config: { globalProperties: { $i18n } }` 这条路走不通**：VTU 那个位置的类型是
  完整的 `ComponentCustomProperties`（`$route` / `$router` / `$nuxt` … 246 个成员），
  只塞一个 `$i18n` 天生编译不过。用 `global: { mocks }`，桩取
  `tests/support/nuxt-i18n.ts` 那一份（`t` 是真的 computed，与插件同形）。
  仓里还有几十个文件用旧写法，它们走的是 `vi.stubGlobal`（收 any），
  没有类型在看——**碰到哪个改哪个**，不要为了统一去批量改。

  **这条我判错过一次，记在这里免得重蹈**：2026-09-10 有一轮把它当成
  「没有依据的分歧」删了，理由是「没有注释说明，也没有用例钉过它」——
  而实际上 `tests/e2e/workspace-shell.spec.ts` 有两条 e2e 深链到
  `?settings=appearance` 并断言焦点在 "Appearance" 上。当时按 "settings" 搜文件名，
  判据在 `workspace-shell` 里，没搜到；`make e2e` 当场把它挡了回来。
  **教训与三份挂账文档那条同源：搜判据要按行为搜，不能按文件名猜。**

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

## 2026-09-11 这一轮补的门禁（都做过变异验证）

| 门禁 | 它守的失效方式 | 实测证据 |
| --- | --- | --- |
| `make typecheck-tests`（进了 verify） | `tests/` 整棵树没有类型检查，夹具与真契约无声漂移 | 首次运行 134 条；挖出的真缺陷见上面那一节 |
| `playwright-use-options` | 往 Playwright 的 `use` 顶层写一个它不认识的键——不报错，只是不生效 | 探针实测：`use.reducedMotion` → `matches === false`；`use.contextOptions.reducedMotion` → `true` |
| `upstream-citations` 扩到 `.vue` | `Foo.vue:行号` 这类引用从来没被验过，而它是本仓组件的主要文件形式 | 仓里 12 处，此前一条都没进扫描面；变异两种失效（越界 / 文件不存在）都能报 |
| `scenario-coverage` 扩到 `states[].steps` | 选择器守卫只看 `settle`/`steps`，而声明了终态的场景把步骤写在 `states[].steps` 里 | 把一条 `states[].steps` 的选择器换成 `.mutation-probe`，扩之前不响、扩之后报 |
| `primitive-marker-classes` | `ui/` 之外手写 primitive 的标记类（`peer/menu-button` 之类）——等于手抄基类，而手抄永远只抄一部分 | 第一次跑就抓到两处：侧栏会话行漏 `data-[active=true]:font-medium`、channels 列表手写了四层 sidebar primitive |
