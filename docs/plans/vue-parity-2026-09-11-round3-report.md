# Vue 对齐 React：2026-09-11 第三轮

分支 `main-wc`，`b7b97abc` … `10335b5d` 共 11 个提交，全部已提交、**未推送**。

## 一句话

这一轮把 **`tests/` 整棵树接上了类型检查**（134 条 → 0，`make typecheck-tests`
已进 `make verify`），过程中挖出的**不是「测试脚手架的类型学」，是五个真缺陷**——
其中两个（Playwright 的 `use.reducedMotion` 被安静忽略、sidecar 的 `submit()`
返回类型被推成「永远失败」）在任何门禁下都不会变红。

## 账（全部跑门禁得出）

| 账 | 起点 | 现在 |
| --- | --- | --- |
| `tests/` 类型错误 | 134（上一轮清到 89） | **0** |
| `make verify` | 不含 `tests/` 的类型检查 | **含**（`typecheck-tests`） |
| 单测 | 2615 | 2617 全绿 |
| `make e2e-mock` | 全绿 | 317 passed |
| `make e2e-backend` | 全绿 | 22 passed |
| `make e2e-parity` | 121 passed | **121 passed** |
| 对照台账 | 113 场景 / **210** 行 | 113 场景 / **204** 行（零新增） |

台账行数用 `node scripts/parity-ledger-report.mjs` 读，不要引用散文里的数字——
上一轮交接里写的「232 行」是手工数错的，跑脚本得到的是 **210**。

## 挖出来的真缺陷

### 1. `use: { reducedMotion: "reduce" }` 从来没生效过

Playwright 1.59 的 `PlaywrightTestOptions` **没有 `reducedMotion` 这个键**——
它属于 `BrowserContextOptions`。写在 `use` 顶层不报错，只是**不生效**。

探针实测（about:blank + `matchMedia("(prefers-reduced-motion: reduce)").matches`）：

```
test.use({ reducedMotion: "reduce" })                     → false
test.use({ contextOptions: { reducedMotion: "reduce" } })  → true
```

本仓两处这么写过。**对照取样那处没有造成后果**，因为 `diff.spec.ts` 是自己
`browser.newContext(PARITY_CONTEXT_OPTIONS)` 开 context 的，而 `newContext`
认识这个键——**同一份常量喂给两个形状不同的口子**，才是真正看走眼的地方。
视觉基线的 seed spec 是真的没生效。

`tests/e2e/reduced-motion.spec.ts` 更早撞见过同一现象，当时归因成
「describe 级选项没传到页面上」，没找到真正的原因。

### 2. e2e 的 agent mock 带着一个后端不存在的字段

`MOCK_AGENTS` 每条都有 `system_prompt`，而 Gateway 的 `AgentResponse`
（`backend/app/gateway/routers/agents.py:39`）根本没有这个字段。
现在 `MockAgent` 就是 `Agent` 本身，`MOCK_AGENTS` / `GALLERY_AGENTS`
与 `MockTask` / `ScheduledTask` 同理——**夹具即契约**。

### 3. `useSidecarSession().submit()` 的返回类型是「永远失败」

`accepted` 只在 `onAccepted` 回调里被写，TS 的控制流看不进闭包，于是
`return dispatched && accepted` 被推成字面量 `false`——整个函数的契约变成
`Promise<false>`。而调用方（`MessageList.vue:540`）正是靠这个返回值决定
要不要把 pending 撤回来。`submitHumanInput()` 同病。

### 4. 假 runner 少了 `refreshDurableState`

`useThreadStream` 在 `mode === "run-end"` 那条路径上调它，
而 `thread-stream.dom.test.ts` 的假 runner 没有这个方法。

### 5. 侧栏当前会话不加粗（**已修，台账 210 → 206，零新增**）

`ThreadSidebarItem.vue` 手抄了 `sidebarMenuButtonVariants` 的一部分类串，
漏了同一串里的 `data-[active=true]:font-medium`——**当前这条会话在侧栏里不加粗**，
而上游加粗。顺带漏的还有键盘焦点环、`hover:text-*`、`active:*` 与过渡。
同一个仓库里 `ProjectThreadGroup.vue` 用的就是
`<SidebarMenuButton as-child><NuxtLink>`，只有这一处是手抄的。

为它加的门禁 `primitive-marker-classes`（`ui/` 定义的 `peer/x` / `group/x` 标记类
不许在 `ui/` 之外被手写）**第一次跑就抓到第二处**：`WorkspaceChannelsList.vue`
手写了 SidebarGroup / SidebarGroupLabel / SidebarMenu / SidebarMenuItem 四层，
而上游同一处用的就是这四个 primitive；手写那版少了 `data-slot`、
`SidebarGroupLabel` 的键盘焦点环与 `[&>svg]:size-4`，还留着一条死类
`group/menu-item`（全仓没有任何 `group-hover/menu-item` 引用它）。

## 新增/加宽的门禁（都做过变异验证）

| 门禁 | 它守的失效方式 |
| --- | --- |
| `make typecheck-tests`（进 verify） | `tests/` 整棵树没有类型检查，夹具与真契约无声漂移 |
| `playwright-use-options` | 往 `use` 顶层写一个 Playwright 不认识的键——不报错，只是不生效 |
| `upstream-citations` 扩到 `.vue` | `Foo.vue:行号` 这类引用此前完全不在扫描面里 |
| `scenario-coverage` 扩到 `states[].steps` | 选择器守卫看不见声明了终态的场景的绝大多数步骤 |
| `primitive-marker-classes` | `ui/` 之外手写 primitive 的标记类——等于手抄基类，而手抄永远只抄一部分 |

`playwright-use-options` 的判据取 Playwright **自己的类型声明**而不是白名单：
升级之后哪天 `reducedMotion` 真进了 use 顶层，门禁自己就松开。

**坑 202 的第四次**：`primitive-marker-classes` 写完当天就把
`WorkspaceChannelsList.vue` 头注释里那句「还留着一条死类 `group/menu-item`」
报成了违规。**扫源文本的守卫，扫之前一律先剥注释**——这条判据已经写在
`handwritten-button` 与 `e2e-suite-contract` 的文件头里，写第三条时我还是漏了。

## 方法上的一条

**`config: { globalProperties: { $i18n } }` 这条路走不通。** VTU 那个位置的类型是
完整的 `ComponentCustomProperties`（`$route` / `$router` / `$nuxt` … 246 个成员），
只塞一个 `$i18n` 天生编译不过。用 `global: { mocks }`，桩取
`tests/support/nuxt-i18n.ts`（`t` 是真的 computed，与插件同形）。
仓里还有几十个文件用旧写法，它们走的是 `vi.stubGlobal`（收 any），没有类型在看
——**碰到哪个改哪个**，不要为了统一去批量改。

## 提交

| 提交 | 是什么 |
| --- | --- |
| `b7b97abc` | `use.reducedMotion` 从来没生效过 + 新门禁 `playwright-use-options` |
| `cba5f2bd` | 两条守卫的扫描面加宽（`.vue:行号`、`states[].steps`） |
| `655165b2` | `tests/` 接上类型检查并进 verify（134 → 0） |
| `4b6d2dc5` | 本报告 + 挂账订正 |
| `b5770d52` | 侧栏当前会话不加粗 + 新门禁 `primitive-marker-classes` |
| `3b45f5c5` | 改名之后不与服务端收敛；顺带量出「失效对手动查询是空操作」 |
| `48e9297a` | 归档会把侧栏列表清空——列表查询不该是手动查询 |
| `10335b5d` | 删掉没有拥有者的死缓存键 `["threads","search"]`（11 处空操作）|

### 6. 改名之后不与服务端收敛（**已修，台账 206 → 204**）

上游 `useRenameThread` 三步（cancel 在途 → 写本地 → 让服务端那份成为最终事实），
本仓只有第二步。**第一版照抄 `invalidateQueries` 时台账一行没动**——本仓的会话列表是
`enabled: false` 的手动查询，失效只把它标脏、没有观察者会去重取。
改成强制重取才真的又问了一次后端。**是台账把这条假绿量出来的。**

### 7. 归档一条会话会把侧栏列表清空（**已修**）

与第 6 条同一个根因，但后果更重：`archive.ts` 对列表 key 调 `resetQueries`，
而 Vue Query 5 对 `enabled: false` 的查询 **reset 会清空数据且不重取**——
探针实测侧栏从 1 条变 0 条。现有 e2e 没有在归档之后看侧栏，所以门禁一直全绿。
修法是把「谁来发第一次请求」交回给 Vue Query（列表查询自己会跑），
只读缓存的两个调用点显式传 `enabled: false`。

## 读台账数字的一条纪律（这一轮量出来的）

`parity-ledger-report.mjs` 打印的「台账 N 行」是**去重后**的数字（内部用 `Set`）。
`chat-thread-init-ordering` 上 `POST /api/threads/search` 有 3 条重复，
修掉两条之后那个数字**一点没变**（204 → 204），按多重集才看得出 226 → 224。
真正的门禁是 `diff.spec.ts` 的深比，看得见重复。**判有没有变好要比基线文件本身。**

## 下一轮的起点

1. **两个应用的会话列表都不轮询**——IM 建的会话不会自己出现在侧栏。
   这句产品性质此前只有一条测死代码的用例在「保证」（已删）。
   要不要真的加轮询是产品决定，先记着。
2. 台账上还剩两行 `requestsOnlyReact: POST /api/threads/search`
   （`chat-thread-init-ordering` 1 条、`thread-list-pin#mobile-drawer` 1 条）：
   上游仍然比本仓多问一次列表，从这里接着查。
3. `ChannelConnections.vue` 的 `ui/item` 移植——**先给 channels 设置页加取样点**，
   否则改完没有机器能验证。
