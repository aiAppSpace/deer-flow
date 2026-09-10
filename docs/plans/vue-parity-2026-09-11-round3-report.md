# Vue 对齐 React：2026-09-11 第三轮

分支 `main-wc`，`b7b97abc` … （见文末），全部已提交、**未推送**。

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
| `make e2e-parity` | 121 passed | **121 passed**，台账 NEW=0 / GONE=0 |
| 对照台账 | 113 场景 / 210 行 | **不变**（这一轮的改动对取样零影响） |

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

### 5. 侧栏当前会话不加粗

`ThreadSidebarItem.vue` 手抄了 `sidebarMenuButtonVariants` 的一部分类串，
漏了同一串里的 `data-[active=true]:font-medium`——**当前这条会话在侧栏里不加粗**，
而上游加粗。顺带漏的还有键盘焦点环、`hover:text-*`、`active:*` 与过渡。
同一个仓库里 `ProjectThreadGroup.vue` 用的就是
`<SidebarMenuButton as-child><NuxtLink>`，只有这一处是手抄的。

## 新增/加宽的门禁（都做过变异验证）

| 门禁 | 它守的失效方式 |
| --- | --- |
| `make typecheck-tests`（进 verify） | `tests/` 整棵树没有类型检查，夹具与真契约无声漂移 |
| `playwright-use-options` | 往 `use` 顶层写一个 Playwright 不认识的键——不报错，只是不生效 |
| `upstream-citations` 扩到 `.vue` | `Foo.vue:行号` 这类引用此前完全不在扫描面里 |
| `scenario-coverage` 扩到 `states[].steps` | 选择器守卫看不见声明了终态的场景的绝大多数步骤 |

`playwright-use-options` 的判据取 Playwright **自己的类型声明**而不是白名单：
升级之后哪天 `reducedMotion` 真进了 use 顶层，门禁自己就松开。

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

## 下一轮的起点

1. **侧栏当前会话行的字重**（台账 `thread-title-sync` 的 2 行 + 2 行宽度）：
   根因已查到——`ThreadSidebarItem.vue` 手抄了 `sidebarMenuButtonVariants` 的
   一部分类串，漏了 `data-[active=true]:font-medium`；同仓的
   `ProjectThreadGroup.vue` 用的就是 `<SidebarMenuButton as-child><NuxtLink>`。
   改法是把手抄那份换成 primitive。
2. **重命名之后上游会重取、本仓不重取**（`thread-title-sync` 的 2 行
   `requestsOnlyReact`）：哪种对还没判。
3. `ChannelConnections.vue` 的 `ui/item` 移植——**先给 channels 设置页加取样点**，
   否则改完没有机器能验证。
