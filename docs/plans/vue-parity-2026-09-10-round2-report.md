# Vue 对齐 React：2026-09-10 第二轮

分支 `main-wc`，10 个提交（`9dfc57cc` … `8681afa2`），全部已提交、**未推送**。

## 一句话

上一轮把功能工单清空了；这一轮**第一次真的去读那张对照台账**，
读出 **1070 → 218 行**，同时取样面从 95 涨到 107 个场景。
过程中挖出四个用户看得见的缺陷，其中三个是"页面看着还行"、任何门禁都照不到的那种。

## 账（全部跑门禁得出，不是估计）

| 账 | 起点 | 现在 |
| --- | --- | --- |
| 对照台账行数 | 1070 | **218** |
| 对照取样场景 | 95 | **107** |
| 场景 pending | 6 | **4** |
| `core/` 没读过的模块 | 4 | **0** |
| 单测 | 2559 | **2615 全绿** |
| `make e2e-parity` | 108 passed / 1 failed | **114 passed / 1 failed → 接受后全绿** |

## 挖出来的四个真缺陷

### 1. `Button` 的 `as-child` 从来没生效过

`ui/button/Button.vue` 压根没有 `asChild` 这个 prop，于是
`<Button as-child><a>…</a></Button>` 渲染成 `<button><a>…</a></button>`：
按钮里套交互内容（HTML 不允许）、两个可聚焦控件、样式全落在外层。
`vue-tsc` 和 `eslint` **双双放行**——`as-child` 只是掉进 fallthrough attrs 的一个普通属性。

两张失败截图并排就看出来了：上游是一颗正常胶囊按钮，本仓把图标压在了文字上面。

### 2. 侧栏和聊天页把**已归档**的会话也列出来了

Gateway 的语义是「omitted includes all」（`threads.py:459`），而本仓
`useThreads()` 不传 `archived` 就当"不过滤"。归档过的对话从列表里**根本没消失**。
它同时解释了台账里最大的一笔：`/api/threads/search` 与
`/api/langgraph/threads/search` 在 **97/95 个场景**上两两相对（约占旧台账的 38%）。

### 3. 面包屑把「Projects」链到了一条不存在的路由

上游有一张 `LINKABLE_SECTIONS`（只有真有 index 路由的段才做成链接），本仓无条件做成链接。
点下去 404。

### 4. 消息排序整段缺一层：`deerflow_seq`

本仓全仓 `deerflow_seq` 出现 **0 次**。`message-merge.ts` 是从上游**加 seq 骨架之前**
的版本移植的，于是历史与实时合并完全靠身份锚点编织：一条 seq 已知、但在已加载窗口里
找不到桥接身份的消息，只能落到队尾。**后端一直在盖这个键**（历史行与 values 帧都盖），
数据一直在，只是本仓没读。

补完之后台账上一处 **80px 的垂直偏移**当场消失——那是本仓少画了一条受保护的人类消息。

## 两处上游自身缺陷（两边同改）

- `app/artifacts/view/layout.tsx` 没挂 `<Toaster>`，而这条路由下的引用面板会
  `toast.success("已复制")`——用户复制完**一点反馈都没有**。
- 「Subagent access」下拉**没有可访问名**（上面那行可见文案是个游离的 `<p>`）。WCAG 4.1.2。

## 新增的门禁（都做过变异验证）

| 门禁 | 它守的失效方式 |
| --- | --- |
| `as-child-is-supported` | `as-child` 传给接不住它的组件，静默失效 |
| `breadcrumb-linkable-sections` | 面包屑链到不存在的路由（**双向**对账） |
| `parity-ledger-fields` | 报告脚本的字段表与 `DiffEntry` 漂移 |
| e2e 独占锁 | 两轮 e2e 并发互删产物 |
| `make build` 的 e2e 闸门 | 构建重写 `.output/`，打断正在跑的 e2e |

后两道不是测试，是运行时闸门，各自用一次真事故换来的：
两轮 e2e 撞在一起产生 3 条**长得像回归**的假失败，判断它们不是回归花了 25 分钟；
跑一半时执行 `make verify`，那一轮当场 500 ENOENT，13 分钟作废。

## 方法上的两条（下一轮直接用）

**「新增行」不等于「新坏了」。** 台账里 `order` / `tabOrder` 只报第一处分岔，
别处修好了它就换个序号重新出现；`geometry` 把数值写进行文本里，差距**变小**
也是「删一行加一行」。实测这一轮 107 条新增里真问题只有个位数。
四类怎么分、怎么查，写在 `docs/plans/vue-full-parity-backlog.md`。

**查一条台账之前，先在三份挂账文档里搜关键词。** 我把一条 wave 98 就判过、
还写了翻案判据的账当成新账查了一遍。三份是：`vue-parity-open-accounts.md`（判过的账）、
`vue-parity-handoff.md`（历轮交接）、`vue-full-parity-backlog.md`（当前工单）。

## 下一轮的起点

`core/` 那张"没读过的模块"表**已经空了**，得换坐标系。三条现成的：

1. **场景 pending 还剩 4 条**，其中两条的重开条件这一轮已经满足：
   `thread-ordering`（条件是"碰 MessageList 虚拟化时"——这一轮直接改了消息排序，
   比那个条件更强）和 `artifact-table-performance`（条件是"artifact-table-preview
   进目录之后"，已进）。
2. **`tests/` 整棵树没有类型检查**：Nuxt 的 tsconfig 只收 `app/**` 与 `tests/nuxt/**`，
   vitest 又只转译不查类型。实测（用对的 include）是 **134 条**，2026-09-11 已清到 89，
   绝大多数是测试脚手架的类型学。开它是独立的一轮活。
   **在它开起来之前，别在 `tests/` 里写类型层断言**——那等于写了个不会执行的注释。
3. **台账里那条 `button "Edit and rerun"`**（3 行，seq 移植的副产物）——
   先加临时 dump 看读数，别猜。
