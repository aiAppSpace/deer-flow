# React → Vue 平替：挂账总清单（截至 2026-09-16 第三十三轮）

## 零之前、2026-09-16：**按最终目标重排——台账的目标是 0**

> 用户当天的原话：「最终目的是 vue 版本和 react 版本在**功能，体验，交互逻辑，界面**上
> 保持**完全一致**」，并追一句「这个才是最终目标」。
>
> **这改的是判据本身。** 此前计划文档写着「台账的目标不是 0，是『新出现、还没定过的
> 行只能减不能增』」——那是**过程规则**，管的是「这一轮别把账做烂」，
> 管不了「这笔账要不要还」。于是历轮判成**「保留本仓这一侧」**的那些行，
> 在这条判据下**不是结清，是欠账**。
>
> **唯一的豁免仍然只有一条**：落地页 / docs / blog / 静态整站模式（双向豁免）。
> **还账也不等于照抄 React 的缺陷**——上游是坏的那一类仍然走「两边同改」，
> 变的是**不许停在「两边不一样但都能用」**。
>
> **底层不同构时的退让**（2026-09-16 用户原话：「如果是因为底层架构有差异，
> 实在不能实现完全对齐，能最大程度对齐就行」）。**这条要读窄**，
> 否则「底层不一样」会变成万能豁免：
>
> - **允许不一致的是实现字面，不是用户看得见的结果**。渲染、行为、可访问性树
>   仍按「完全一致」要求；退让只发生在「两边底层库不同构，且字面一致反而让结果更差」。
> - **要有实测读数**：必须拿得出「按字面对齐之后尺子上反而多出几行」这样的数字。
>   第三十一轮 `CommandInput` 就是——字面对齐后对话框高度 Δ-13.1px，改之前全对。
>   **没有读数的「底层不一样」不成立。**
> - **必须写翻案判据**，并把判词与读数落在两处（组件文件头 + 守卫的 `DECLARED`／本文件），
>   这样下一个人读到的是「量过的取舍」，不是「当时没做完」。
>
> **也不要机械式对齐**（用户同日原话）：第三十一轮同一轮里两个方向相反的决定
> ——族 A 是「上游整层组件本仓没有」，正确做法是**补一层真组件**（101 个投影一次归零）；
> `CommandInput` 是「字面一致反而更差」，正确做法是**回退并写判词**。
> **判据是同一条：看渲染与行为，不看字面。**

> **⚠ 2026-09-16 第三十一轮：族 A 已还清。** 下面这张表是**还账前**的快照，
> 留着是因为它记录了归族与路径的推导。**现状读数**：
> 31 条不同的差异 / **69 个投影**，族 A 那 105 个投影**一次归零**
> （做法与教训见本文件「第三十一轮」条目）。
> 剩下的按投影排：B(43) → D(12) → 其余各 2~4。

### 归族与还账路径（**还账前**的快照，35 条差异条目，分组一律写「N 条差异条目」）

（读数：2026-09-16 第三十轮 accept 之后的签入基线，147 场景-维度 / 170 投影。
**族的划分是按根因手工归的，不是机器算的**——重算脚本见本节末。）

| 族 | 条数 / 投影 | 是什么 | 还账路径 |
| --- | --- | --- | --- |
| **A** `div[scroll-area-viewport]` 可 tab | 6 / **105** | React 的滚动视口能用 Tab 走到（Radix 在内容可滚动时给 viewport `tabindex=0`），本仓的走不到 | **改本仓**。这是**交互逻辑**上的真差异：键盘用户在 React 能 Tab 进滚动区再用方向键翻，在本仓不能。投影占全部的 62%，**一处根因还掉三分之二的账** |
| **B** 请求集合 | 9 / 43 | 一边发、另一边不发的接口：React 轮询 `lark/status` 与 `scheduled-tasks`、失败后重试 3 次；两边各有一处 `features` / `threads/search` 的多发少发 | **逐条分**：重试 3 次那族是**上游的缺陷**（走两边同改）；轮询那两条要先量「本仓靠什么替代」；`features`/`search` 两向都有，先查是不是时序 |
| **C** 请求体 | 2 / 2 | 建线程时本仓多带 `assistant_id`；`runs/stream` 的 `stream_mode` 多一个 `values`、多一个 `stream_resumable` | **改本仓向上游看齐**，但 `values` 那一条**牵连本仓的 `authoritativeTodos`/`authoritativeGoal` 读的就是 `stream.state`**，要连着改数据来源，不能只删一个字符串 |
| **D** 多账号绑定块 | 12 / 12 | 本仓的渠道设置页画「已连接账号」列表 + 「添加账号」+ 逐账号断开，上游一个 provider 只认一条 connection | **两边同改（给上游补）**：后端 `/api/channels/connections` 本来就返回列表，上游 `connectionByProvider` 把它收敛成一条是**上游丢信息**。这是**功能**层面最大的一处不一致 |
| **E** tooltip 播报节点 | 2 / 2 | React 的 aria 树里多一个 `- tooltip "…"` 节点 | **库差异**（Radix 常驻 tooltip 节点 vs Reka 的投影方式）。**要还账得先验「读屏器读出来一不一样」**——判据是体验一致，不是 DOM 一致 |
| **F** 焦点落点 | 1 / 2 | 某个操作之后焦点一边落在 Close、一边落在文件行 | **改本仓**（交互逻辑），先查是哪一步 |
| **G** 分栏把手 | 1 / 2 | 伪元素点击区 React 4px / 本仓 16px（历轮判词是「本仓更好，已接受」） | **两边同改**：4px 的拖拽热区是上游的可用性缺陷，把上游也改成 16px |
| **H** `alert` 播报 | 2 / 2 | React 是空的 `- alert`，本仓是 `- alert: New chat - DeerFlow` | **先查谁对**：本仓把文档标题播出去了，上游播了个空 alert——两边可能都不对 |

**排序按「一处根因还掉多少投影」**：A（105）→ B（43）→ D（12）→ C/E/F/G/H（各 2）。
**但 D 是唯一一处「功能层面」的不一致**（用户能不能绑第二个账号），
按最终目标那句话的措辞（功能 / 体验 / 交互逻辑 / 界面），**D 与 A 同等优先**。

```bash
# 重算这张表（族的划分在脚本里是手工规则，改了要连着改上面的表）
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow
python3 - <<'EOF'
import json, collections
d = json.load(open("frontend-vue/baseline/parity-diff.json"))["entries"]
g = collections.Counter()
for v in d.values():
    for f, rows in v.items():
        if isinstance(rows, list):
            for x in rows: g[(f, x)] += 1
print("不同的差异", len(g), "／ 投影", sum(g.values()))
for (f, x), n in sorted(g.items(), key=lambda kv: -kv[1]):
    print(f"{n:4d}  {f:20s} {x[:110]}")
EOF
```

---

## 零、2026-09-16 全面审查：**台账的唯一行是投影数，件数要按 `(档, 行文本)` 去重**

> **⚠ 账 F / G 第二十三轮结清、账 C 第二十四轮结清、账 H 第二十五轮结清**，下表的数是**审查当天（41 条）的**，
> 现状是 **143 唯一行 / 163 多重集 / 142 个场景-维度 / 33 条不同的差异**。
> 变更与三处格子的订正写在本文件的「2026-09-16 第二十三轮」条目里；
> 账 C 见「2026-09-16 第二十四轮」条目（**它一行台账都没动**，理由写在那里）。

> 这一节是**逐条从签入产物量出来的**（`baseline/parity-diff.json`），
> 不是从任何一份散文里抄的。量法：按 `(档, 行文本)` 去重。

**先说最要紧的读法订正。** 此前所有文档说的「台账还剩 159 行」，用的是
**场景-维度 × 档 × 行**的去重计数——**同一处差异投影到多少个场景-维度就数多少次**。
按 `(档, 行文本)` 去重之后，**真正不同的差异是 41 条**。
三个数字都对，但它们回答的是不同问题：

| 口径 | 数 | 回答的问题 |
| --- | --- | --- |
| 多重集 | 179 | 所有出现次数 |
| 投影去重（文档一直说的「行」） | 159 | 「有多少个 场景-维度×档×行 的坑」 |
| **不同的差异条目** | **41** | **「还有多少件事要判/要修」** |

**「还剩 159 行」会被读成「还有 159 件事」——实际是 41 件，而且高度聚集。**

### 41 条按组（全部实测）

| 组 | 不同条数 | 投影 | 状态 |
| --- | --- | --- | --- |
| `div[scroll-area-viewport]` 系（`tabbablesOnlyReact` 1 条 + `tabOrder` 3 条） | **4** | **99** | 历史账 #6，判词成立。**订正**：该行此前写「现在是 47 行」，实测是 **99 个投影 / 4 条不同** |
| 请求层（`requestsOnlyReact` 6 条 + `requestsOnlyVue` 3 条） | **9** | **40** | **订正**：此前写「20 行」，实测 40 投影 / 9 条不同 |
| **Mermaid 工具条**（见下面 F） | **8** | 16 | **此前没有任何账认领** |
| **`channels#settings-panel-connected` 那一块**（见下面 G） | **12** | 12 | **此前没有任何账认领** |
| 焦点 | **2** | 2 | 历史账 #5，部分推翻，判词见该行 |
| 零散（`div(menuitem)` ×2、`role:separator` 几何 ×2、`tabbablesOnlyVue button` ×2、两条 `alert`、两条 `tooltip "分叉"`） | **6** | 10 | 逐条有判词，见下方历史条目 |

### 本次审查新挂的两笔账

| # | 账 | 证据与下一步 |
| - | -- | ---- |
| **F** | **Mermaid 工具条那四个名字，本仓翻译了而上游写死英文** | **8 条 / 16 投影，全部落在 `thread-history-mermaid#*/desktop/light/zh-CN`——只在中文维度**，成因就是翻译。上游 `ai-elements/streamdown.tsx:81` 的注释**明确写着**：「Zoom in / Zoom out / Reset zoom and pan / the diagram's alt text are *not* in `StreamdownTranslations`; they are hardcoded inside the library and **stay English until it exposes them**」，并指名本仓这类字符串的规矩是「both apps announce the same English string（见 `primitives.*`）」。实测上游产物里确实是 `title:"Zoom in"` / `"Zoom out"` / `"Reset zoom and pan"` 与 `aria-label:"Mermaid chart"`，本仓 `markdown.zoomIn/zoomOut/resetZoomAndPan/mermaidChart` 在 zh-CN 里译成了中文。**下一步**：把这四条按 `primitives.*` 的做法改成两语言同串（英文），台账 16 个投影归零。**这是 Claude 记忆 `deerflow-untranslated-primitive-names` 那条规矩没落实的地方。** |
| **G** | **`channels#settings-panel-connected` 里有一块 Vue 独有的结构** | **12 条 / 12 投影**，全是 `ariaOnlyVue`：`button "添加账号"`、`heading "已连接账号" [level=4]`、`text: parity-account 已连接`（各有 en/zh 两份），连带 `geometry` 两条 `text:/parity-account/ y Δ-16.1`、一条 `width Δ-6.7`、`order` 第 47 个公共节点两边不同（React=修改 / Vue=断开连接）、以及 `workspace-changes#changes-panel` 上一条 `focus`。**「React 没有的 Vue 不许有」的候选**，但也可能是上游缺口——**下一步先去上游对应页确认它有没有这块**，再定是删还是两边同改。 |

### 工单队列现状：**三张 pending 表全空**

记忆 `deerflow-upstream-features-must-land-in-vue` 说「那三张表是工单队列，
条目只能因为做完了而消失」。2026-09-16 逐个量：

| 表 | 现状 |
| --- | --- |
| `baseline/react-parity-scope.json` → `pendingRoutes.routes` | **`[]` 空** |
| `baseline/upstream-i18n-map.json` → `pending.keys` | **`[]` 空** |
| `baseline/parity-route-sampling.json` → `pending` | **0**（exempt 4） |
| `baseline/parity-scenario-coverage.json` → `pending` | **1**，但那是**判过的边界**而非欠账（见下） |

**队列是清的。** 唯一那条 `artifact-table-performance` 的理由写在 `$pendingReasons`：
它量的是时延，而对照工厂的坐标系是 aria/几何/请求，**天生表达不了**；
镜像 spec 已在 `make e2e-mock` 里跑。

### 其余现场读数（2026-09-16 实测）

- 覆盖率棘轮 covered **37** / pending **1** / exempt **3**；词典 **1140** key / 15 unused。
- 守卫 **49** 道；产品 SFC **269** 个；upstream marker `a0f6bcae`。
- **视觉基线 9 张全是 `-darwin`** —— `make e2e-visual` 因此**只在本机有效**，
  CI 的 `visual-baselines` job 是 `skipped`。这条不变量由
  `tests/guards/visual-baseline-platforms.test.ts` 钉着（签了 `-linux` 基线却没接进 CI，
  或接进 CI 却没有 `-linux` 基线，两个方向都会红），**不是新账，但要知道它的边界**。
- **`origin/main-wc`（`f30ba6c3`）当前 CI 是红的**：`verify` job 失败在
  `Run every suite that needs no backend`，就是那条 375px；
  **修复在本地尚未推送的提交里**（`5f57757a` 起）。推上去之前，
  「那条红修好了」仍然只是本机结论。

### 顺带核清的两处

- **棘轮 `pending` 不是空的**，但**也不是欠账**：里面是 `artifact-table-performance`，
  理由写在 `$pendingReasons` 里——它量的是**时延**（冷 Worker 首表延迟、长任务、心跳），
  而对照工厂的坐标系是 aria/几何/请求，**天生表达不了**；镜像 spec
  `tests/e2e/artifact-table-performance.spec.ts` 已在 `make e2e-mock` 里跑。
  历史表里 `~~2~~` 说的 `chat-thread-init-ordering` 确实在 wave 175 结清了，两者不是同一条。
- **覆盖率棘轮现状**：covered **37** / pending **1** / exempt **3**。
  `covered` 与场景目录逐字相等由棘轮守卫钉着（`e2e-parity` 150 passed 里验过），
  **不需要也不该再用正则去数一遍**。

---


> ## 2026-09-16 第三十三轮：**族 D 还清——上游把一个列表塌成了一条**
>
> **投影 36 → 23，不同的差异 28 → 16。台账上唯一一处「功能」层面的不一致结清。**
>
> ### 一、谁对：后端返回的就是列表
>
> `GET /api/channels/connections` **返回列表**，而且早就暴露了
> `DELETE /channels/connections/{id}`；上游这一页却在渲染前把它
> **塌成一条**（`connectionByProvider`）。同一个 provider 绑第二个账号时，
> **用户看不见它、也解不掉它**。上游甚至已经有 `useDisconnectChannelConnection`
> 这个 hook——只是永远只喂得到那一条。
>
> 上游那处注释原本写着「多账号列表不在本页范围内：这一行永远只显示一条连接」
> ——**那是上一轮自己写下的范围，不是产品判据**，按最终目标它作废。
>
> ### 二、改的是上游（`frontend/`），本仓只动了一处间距
>
> - `connection?: ChannelConnection` → `connections: ChannelConnection[]`，页面那层改成分组；
> - 账号列表本体（标题 + 每账号一行 + 逐账号断开），形状与本仓逐字对齐；
> - **动作区里那颗单连接断开键移进列表**（它原来只能断开「赢得塌陷的那一条」）；
> - **主操作键从「只在未连接分支渲染」改成两个分支共用一个**
>   ——连上之后本来根本没有入口再加第二个账号；文案三档照本仓；
> - 补两条词条两个语言：`channels.addAccount` / `channels.accounts`。
>
> 本仓只改了 provider 列表容器 `space-y-3` → `flex w-full flex-col gap-4`
> （12px 对 16px，逐字照上游）。**两边都不是缺陷时跟上游。**
>
> ### 三、逐步读数（这一轮走错过一步，靠复量抓回来）
>
> | 步 | 改动 | 读数 |
> | - | --- | --- |
> | 1 | 列表 + 分组 | 12 → 10 行 |
> | 2 | 以为描述里的 `Connected as` 是本仓多的，删掉 | **10 → 22 行** |
> | 3 | 还原那句 + 主操作键两分支共用 | 22 → 2 行 |
> | 4 | 容器间距跟上游 | **2 → 0 行** |
>
> **第 2 步的教训**：「哪一边多了」要看**差异档的方向**
> （`ariaOnlyVue` 是本仓多、`ariaOnlyReact` 是上游多），凭印象删一句
> 会把一处对齐改成两处不对齐——而它看起来和「修对了」一样，只有复量能分开。
>
> ---
>
> ## 2026-09-16 第三十二轮：**族 B 的大头是重试策略，两边都不对**
>
> **投影 69 → 36，不同的差异 31 → 28。**
>
> ### 一、三条读数是同一个根因
>
> | 场景 | 投影 | 读数 |
> | --- | --- | --- |
> | `integrations#load-failed` | 12 | 同一次 500，上游发 4 次 `lark/status`，本仓 1 次 |
> | `scheduled-tasks#load-failed` | 12 | 同形 |
> | `artifact-batched-stream#preview-failed` | 9 | 同形 |
>
> 上游 `new QueryClient()` 吃 TanStack 默认 `retry: 3`（**不分错误码**），
> 本仓 `plugins/vue-query.ts` 写死 `retry: false`（**连断网也不重试**）。
>
> ### 二、判据：两边都不对 → 两边同改
>
> - 抄 `3` 是照搬上游缺陷（404 也重试三次，只把错误界面推迟几秒）；
> - 抄 `false` 是把上游对瞬时故障的韧性一起抹掉。
>
> **新判据「只重试传输层失败」**：`fetch` 连接层失败抛原生 `TypeError`，那一类瞬时；
> **任何 HTTP 状态码都是服务端想好了才给的答案**。
> `isRetryableTransportError` 两个应用逐字同一份，次数取 TanStack 自己的 3
> ——**改的是「哪一类值得重试」而不是「重试几次」**。
>
> **这正是本仓那段注释自己写下的翻案判据**（wave 128 判「保留 `retry: false`」时
> 就写了「哪天需要按错误码分流，那时换成 `retry: (count, error) => …`」）。
> 第三十二轮兑现了它——**挂账时写下的翻案判据，是会被真的兑现的**。
>
> ### 三、为什么不做更细的「按状态码分流」
>
> 那要求错误值带 `status`。本仓有（`GatewayResponseError`），**上游没有**
> ——它每个调用方各自 `throw new Error(message)`，给上游加一套带状态码的错误类型
> 是贯穿式重构，越过了「`frontend/` 只做小改」这条边界
> （Claude 记忆 `deerflow-react-no-big-changes`）。
> **传输层这一刀两边都够得着，而且它本来就是重试里最该保留的那一类。**
> **翻案判据**：哪天上游自己有了带状态码的错误类型，就把这条收紧成 5xx 重试、4xx 不重试。
>
> ---
>
> ## 2026-09-16 第三十一轮：**族 A 还清——根因是整层组件缺失，不是某个属性**
>
> **投影 170 → 69，不同的差异 35 → 31，`div[scroll-area-viewport]` 一族 101 → 0。**
>
> ### 一、根因不在 primitive，在「用在哪」
>
> 两边的 `ScrollArea` **都**给 viewport 加了 `tabindex`（上游那处注释还是之前某一轮
> 照着 reka 补的）。差的是上游 `ai-elements/suggestion.tsx` 的 `Suggestions`
> 把建议行包在 ScrollArea 里，而**本仓整层没有**，chip 的类串被抄成了两份本地常量。
>
> **光看差集会把人绕进死胡同**（「两边 primitive 都写了 tabindex，差异从哪来」），
> 所以这一轮把**完整的可 tab 序列**做成了 `PARITY_ONLY` 的常驻探针输出。
> 读数一眼看清：`React 35 个 / Vue 34 个`，差的那一个是 `div[scroll-area-viewport]`。
>
> ### 二、做法：补一层真组件，不是给元素硬加 tabindex
>
> 新增 L2 `app/components/ui/suggestion/`（`Suggestions` / `Suggestion` /
> `chip-class.ts` / `stagger.ts` / `index.ts`），放进已有分层目录而不是另开
> 平行的 `ai-elements/`（本仓一向把上游 `ai-elements/*` 映射进 `markdown/*` 这类目录）。
>
> 三条实现判据值得留下：
>
> - **`class` 与透传属性落在内层列表 div 上**，逐字照上游——它的 `className`
>   交给 `cn("flex w-full flex-wrap items-center gap-2", className)`，滚动壳只有固定两类。
>   落错一层，`min-h-16 justify-center px-4` 的几何当场分叉。
> - **不做 `Children.map` 的 Vue 版**：`v-for` 塌成 Fragment、插槽里还有注释节点，
>   VNode 手术坏起来是静默的。错峰常数做成单一出处，调用点各自套 `<span>`。
> - `ScrollArea` 补 `scrollbarClass` / `horizontalScrollbarClass`：上游把 `ScrollBar`
>   单独导出让调用方自己给类，本仓这一层把两根都渲染在里面，
>   那个能力要以 prop 给出来——否则调用方只能在外面用后代选择器够它，那是打补丁。
>
> 追问行那一段顺带逐条对齐（上游 `input-box.tsx:2186-2213`）：两层容器而不是一层、
> 加载态与建议行**互斥**、关闭键**在 `Suggestions` 里面**、chip 多 `py-1.5`、
> 关闭键补 `cursor-pointer`。
>
> ### 三、**字面对齐被台账当场否掉的一次**（这一条比正题更值得记）
>
> 修好 `primitive-base-classes` 的提取器之后（见下），`CommandInput` 露出四处类串差异。
> 按字面对齐之后 `parity-accept` 拒写，报出六行**新增**几何：
> `role:dialog[Model Selector] height React=135.6 Vue=122.5 Δ-13.1`、`y Δ6.5`、
> `role:option y Δ-6.5`（两个语言维各三行）——**而改之前这一屏几何是全对的**。
>
> 原因是底层不同构：本仓 Reka `ListboxFilter`、上游 cmdk `Input`，
> 外层与 input 的盒模型不一样，**同一串类渲染出不同高度**。
>
> **于是回退字面对齐，把实测读数写进判词**（`DECLARED` 条目 + 组件文件头），
> 并留翻案判据。**判据取渲染一致而不是类串一致**——最终目标是「界面完全一致」，
> 类串只是它的代理，而这一次代理和本体给出了相反的答案。
>
> ### 四、沿途修好一把坏尺子
>
> `primitive-base-classes` 的提取器是一条非贪婪正则。只要文件里**更早**有一处
> `cn(` 的实参带别的 `props.xxx`，它会从那一处起跳、跨行吞到后面真正的 `props.class`，
> 交出一段混着模板与 `</script>` 的垃圾——`literalTokens` 判它不是纯字面量、
> `continue`，于是**那个组件整个从比对集合里消失，没有任何提示**。
>
> 当轮就是这么撞上的（给 `ScrollArea` 加 `props.scrollbarClass` 之后它消失了），
> 只有「DECLARED 里不许留着已经一致了的条目」那条断言把它捞出来。
> 换成**配平括号扫描 + 要求最后一个顶层实参就是 `props.class` / `className`**。
>
> `followup-chip-guards` 那条守卫也重锚了：原来找 `data-slot="suggestions-list"`
> 再往前取 400 字符，而那个属性这一轮合法地搬进了包装组件，`indexOf` 返回 -1、
> `slice(-401, -1)` 静静切走文件末尾一段。改成按语义定位并带「恰好一处」的形状断言。
>
> ---
>
> ## 2026-09-16 第三十轮：**把队列里那条退役，然后给尺子补上第②类**
>
> ### 一、账 C 那条线退役——三次量都没货
>
> 队列第 1 条写的是「还有多少『本仓用原生 `title`、上游用 tooltip』的地方」。
> **这个前提不成立**，三次读数：
>
> | 量法 | 读数 | 结论 |
> | --- | --- | --- |
> | 两边 `title=` 用量（剥注释后） | 本仓 **80** 处 / 上游 **72** 处 | 不是系统性差异，两边都在用 |
> | 按文件名配对后「本仓有、上游那份没有」的两处 | `MessageList`(1 vs 0)、`CodeBlock`(1 vs 0) | **逐个查都对得上**：run duration 上游在独立的 `run-duration.tsx:53` 里用同一个 `title`；CodeBlock 照的是 streamdown 自己的 `data-streamdown="code-block-download-button"` 标记 |
> | icon-only 且开标签里没有 `aria-label` 的控件 | 本仓 18 处 | **不是缺陷**：按 HTML 规范 `title` 本来就是可访问名的兜底，两边都靠它，台账因此也报不出差异 |
>
> 第二十四轮账 C 修的那四颗侧栏键是**具体的一处**（上游那里用的是 Radix Tooltip），
> 不是一条可以外推的规律。**把它当成规律去扫 80 处，是在为一个没量过的前提干活。**
>
> ### 二、第三扇维度窗，第三次零新差异
>
> `subtask-card` 补 `desktop/dark`（三张卡分别停在失败 / 被停止 / 完成，
> 是「固定红 vs `--destructive` token」的高发区）——**三个档全空**。
>
> 连起来看：第二十七轮 `mcp-settings`+mobile、`preview-failed`+dark，
> 第三十轮 `subtask-card`+dark，**连续三扇零新差异**。
> 这条线仍然出货（每开一扇就多一片有机器守着的面），但**单位产出已经量出来是低的**，
> 队列里的排序要照这个读数改，而不是照「它 2026-09-11 那次很有货」的记忆改。
>
> ### 三、**正题：把「天生看不见的第②类」补上——请求体进取样面**
>
> `requests` 那一档只比 `METHOD /path?query`，**请求体一个字节都不进取样面**。
> 这不是理论问题：上游 `mcp-settings.spec.ts` 自己断言的就是
> 「PUT body 里没丢 advanced 字段、也没动到兄弟条目」，而那正是台账看不到的一半。
>
> 做法：
>
> - `ParityCapture.requestBodies`：带体的请求收 `{key, body}`，key 就是
>   `normalizeRequest` 归一后的那一串（所以两档天然对得上）；
> - 归一化**只有两条规则**——对象按 key 排序、UUID 形状且不在 `KNOWN_IDS` 里的
>   字符串抹成 `«generated»`（与路径段同一条规则、同一份名单）。
>   **时间戳、nonce 一律不抹**：硬规则 2 说归一化只能因为实测而增加，
>   真出现了它会作为一条 body 差异报出来，拿着读数再加
>   （`normalizeRequest` 里那张 `VOLATILE_QUERY_KEYS` 表就是这么被量掉的）；
> - 解析不了 JSON 的体**原样留着**——静默丢掉它与 wave 120 那三个夹具 id 同一类失效；
> - `DiffEntry.requestBodies`：**只比两边都发过的键**。一边发了另一边没发是
>   `requestsOnly*` 那一档的事，在这里再报一次只会让同一处差异多一份投影；
> - 三方字段表同步（`ledger.ts` 的 `DIFF_ENTRY_FIELDS`、
>   `scripts/parity-ledger-report.mjs` 的 `FIELDS`、签入基线）——
>   `tests/guards/parity-ledger-fields.test.ts` 当场把没同步的那一步报红，
>   **这道门是 wave 那次「报告六档一行没算」之后加的，这次真接住了**。
>
> **两条「0 要算出来」的配套**（与伪元素那一档同一条纪律）：
>
> - 形状断言 `bodySamples >= 10`：挡住「`postData()` 那段写坏→永远空数组→
>   两边一致→台账 0 行→没有任何用例会红」；
> - `PARITY_ONLY` 诊断模式现在会打印 `取样计数：伪元素 N / 请求体 M`
>   ——诊断时最容易误读的就是「某一档空着」，而它有两种：两边一样，和压根没采到。
>
> 实测：`PARITY_ONLY=thread-title-sync` → **请求体 20 条样本、0 行差异**。
> 那个 0 是**算出来的**。
>
> 纯函数那五条规则另有单测钉着
> （`tests/unit/parity/request-body-normalization.test.ts`），
> 理由是它们只在十几分钟的 e2e 里跑，而**归一化写错的代价是「两边一致」
> 这个结论本身不可信**。
>
> ### 四、这一档第一跑就报了三行，逐条判词
>
> | # | 读数 | 判词 |
> | - | --- | --- |
> | 1 | `POST /api/langgraph/threads` — Vue 体多一个 `"assistant_id":"lead_agent"`（上游只发 `{metadata, thread_id}`） | **保留本仓这一侧**。后端拿线程行上的 `assistant_id` 解析「有效 schema」（`threads.py:1228` → `build_thread_checkpoint_state_accessor`），两个应用每次 run 都带 `lead_agent`，所以实际解析结果相同；本仓把它落在线程行上只是让「不在 run 里时」也确定。**翻案判据**：上游哪天也在建线程时带上它，或后端明确要求它为空。 |
> | 2 | `runs/stream` 的 `stream_mode`：Vue 多一个 `"values"` | **早就判过的一条**——`MessageList.vue` 的注释里写着「上游 `stream_mode` 里没有 `values`，本仓多一个」，那正是本仓需要 `isSyntheticValuesMessageId` 那道防线的原因。**这一档独立地把它重新量了出来**，是这把新尺子可信的旁证。 |
> | 3 | `runs/stream` 的 `stream_resumable: false`：只有 Vue 发 | **保留本仓这一侧**。它是 LangGraph SDK 的出厂默认，后端**显式接受**它（`run_models.py:32` 那条 `Literal[False] \| None`，`gateway/AGENTS.md` 记着拒收它那次把所有 IM 渠道的 run 打成 422、#4466）。上游那边是 JS SDK 自己没带。**翻案判据**：后端改口不收它。 |
> | 4 | `runs/stream` 的 `context.thread_id`：React 是 `«generated»`、Vue 是夹具线程 id | **挂着，下一轮查**。这条场景（`chat-thread-init-ordering`）本来就是为「线程初始化顺序」立的，而上游 `chat-page.tsx:88` 那段注释点名了 issue #2746。**先查上游那个 id 从哪来的再定判词**——两边路径都是同一条线程，差的是 context 里带的那一个。 |
>
> **另外还报过一行，当场改掉了判据**：`thread-list-pin#mobile-drawer` 上
> `POST /api/threads/search` 的体**逐字相同**，只是 React 发了两次、Vue 一次
> ——而「发了几次」`requestsOnlyReact` 已经报过了。
> 多重集写法会让同一处差异在两档各占一行；**改成按「不同的体」的集合比之后
> 那一行当场消失**，而两边体真不一样时照样报。
> **这是「一处差异多份投影」那条老账在新尺子上的复现**，第一跑就撞上了。
>
> ---
>
> ## 2026-09-16 第二十九轮：**判词是查后端定的——本仓多的那颗键才是错的**
>
> ### 一、把一个 0 变成真读数
>
> 第二十八轮留的线索：上游 agent 会话页只传 `canRegenerate` 与 `canEdit`，
> 不传 `canBranch` 也不传 `onBranchTurn`，而 `message-list.tsx:890` 的渲染条件里
> 有 `onBranchTurn &&`——**agent 会话上游压根没有分支入口**。
>
> **而台账此前对它报 0**：`agent-chat` 的 `path` 是 `…/chats/new`，
> 一条消息都没有，三颗回合键两边都不画。补一支落在**已有消息的** agent 线程上的
> 终态之后，两个语言维各报三行：
>
> | 档 | 读数 |
> | --- | --- |
> | `ariaOnlyVue` | `- button "Branch conversation"` / `- button "分叉"` |
> | `tabbablesOnlyVue` | `button` |
> | `tabOrder` | 第 18 个公共可 tab 元素 React=textarea Vue=button |
>
> **重跑与编辑两颗两边都有**——只有分支这一颗是本仓独有，一处根因 6 个投影。
>
> 为了换落点，`ParityState` 加了 `path`（与 `routes`/`dimensions` 同一条理由：
> 场景 id 受棘轮约束、编不出新的）。
>
> ### 二、判词：**先查了「谁对」，而答案和第一印象相反**
>
> `git log -S canBranch` 查到分支是 #3950（2026-07-06）加的，
> 那次**只动了普通会话页**，agent 页从没被碰过，也没有任何注释解释
> ——**看起来像漏传**，也就是「上游的缺陷，两边同改」那一类。
>
> 直到查后端：分支接口
> （`backend/app/gateway/routers/threads.py:1052-1058`）建新线程时写的是
> `metadata=branch_metadata`，继承 project、继承标题序号，
> **唯独不继承 `agent_name`**——而 agent 归属就存在线程行的这个元数据里
> （`core/threads/utils.ts:47`）。
>
> **也就是说本仓这颗键点下去，会造出一条服务端不认为属于这个 agent 的线程。**
> 不是「上游缺了本仓有」，是**本仓提供了一个后端还没配套的操作**。
> 所以这一轮把本仓那颗关掉，而不是给上游补一颗。
>
> **方法学**：这条线索从「上游缺了什么」开始，从「本仓多了什么」结束。
> 判词换了方向，靠的是**去查那条操作在后端到底做了什么**，
> 而不是「上游没有所以上游漏了」或者「本仓有所以本仓更全」。
>
> ### 三、**新账 J：分支不继承 agent 归属（后端）**
>
> 逐字：`threads.py` 的 `_write_branch_row` 只传 `metadata=branch_metadata`，
> 而 `branch_metadata` 里只有 `deerflow_branch` 那四项加可选的标题序号。
> 源线程的 `agent_name` 没有被读、更没有被写进去。
>
> **这一轮没顺手改它**：后端改动有自己的 TDD 要求与取样面
> （`backend/AGENTS.md` 写着 TDD 是强制的），塞进前端那条提交会让两件事互相掩护。
>
> **修好之后要一起重判三处**：后端继承 `agent_name`、本仓这条 `canBranch`、
> 以及上游 agent 会话页那两处漏传——那时它就真的变成「上游的缺陷，两边同改」。
>
> ### 四、负向验证（三条）
>
> | # | 变异 | 守卫 |
> | - | --- | --- |
> | N8 | `show-branch` 不看 `canBranch` | 红 |
> | N9 | `canBranch` 默认值改成 `false` | 红（**3 条一起红**） |
> | N10 | 调用点不按 `agentName` 关 | 红 |
>
> **N9 那一条值得单说**：`canBranch` 必须给显式默认值 `true`，
> 因为 **Vue 的布尔 prop 不传时是 `false` 不是 `undefined`**（wave 15 那条坑）。
> 不给默认值的话，所有没传 `can-branch` 的调用点（sidecar、showcase…）
> 会一起把分支入口弄丢——而那三条一起红正是这个形状。
>
> ---
>
> ## 2026-09-16 第二十八轮：**账 I 结清——那三串条件里，本仓只兑现了一条**
>
> ### 一、逐条对完之后剩下几条
>
> 上游把可用性算在页面那一层（`chats/chat-page.tsx:466-497`）：
>
> | 上游判据 | 条件串 |
> | --- | --- |
> | `canRegenerate` | `!isNewThread && !isMock && !STATIC && !isUploading && !thread.isLoading` |
> | `canEdit` | 以上 + `!branchThread.isPending && !hasGoal && !hasOpenHumanInputCard` |
> | `canBranch` | `canRegenerate` + `!branchThread.isPending` |
>
> 本仓对应的只有一个 `interactive`，调用点是 `:interactive="!isDemo"`。
> **逐条量下来，六项里只有两项是真缺口**：
>
> | 上游那一项 | 本仓现状 | 判词 |
> | --- | --- | --- |
> | `!isMock` | `interactive = !isDemo` | 已兑现 |
> | `!thread.isLoading` | **靠结构兑现**：`latestAssistantGroupId` 与 `branchable` 在 streaming 时就空了，键根本不画 | 已兑现——**上游 `message-list.tsx:707/717` 同样是不画**，不是「画着禁用」 |
> | `!isNewThread` | 新会话没有 assistant 组，键本来就不画 | 已兑现 |
> | `!STATIC` | 本仓不实现 `STATIC_WEBSITE_ONLY` | **不补**：静态整站模式本来就在对齐范围之外 |
> | `!isUploading` | **没有** | 补：`uploading` 进三颗键 |
> | `!branchThread.isPending` | **没有，而且连 pending 位都不存在** | 补：`branchPending` **只进分支与编辑** |
>
> **那条不对称是判据本身**：上游 `canRegenerate` 里没有 `!branchThread.isPending`
> ——分支请求在飞的时候重跑仍然是合法操作。
> 测里专门有一条钉它，挡的是「顺手把三颗一起禁掉」那种看起来更整齐的写法。
>
> ### 二、`branchPending` 那一条不只是灰一下按钮
>
> 本仓 `branch()` **可重入**：没有任何 pending 位，连点两下就是两个
> `POST /threads/{id}/branch`、**两条新线程**，而用户只想要一条。
> 上游拿的是 react-query mutation 自带的 pending 位。
> 落点与上游一致：**请求一 settle 就清，不等 `router.push`**
> （上游同样有「请求已回、页面还没换」那一拍）。
>
> ### 三、顺带订正一段**撑着设计决定**的注释
>
> `AssistantTurnActions.vue` 的文件头写着「只读态（案例页 isMock、静态站、
> **上传中、加载中**）下这两颗仍然画出来，只是禁用」。逐条量下来三处都不对：
>
> - **「上传中」写下来那天就是假的**——调用点只传 `interactive = !isDemo`，
>   上传中三颗照样点得动。第二十八轮才补上，同一轮把这段话改成它真正兑现的样子。
> - **「加载中」不是这一档**：两个应用都是**不画**，不是画着禁用。
> - **「静态站」在对齐范围之外**，本仓不实现它。
>
> 这是第十六轮那条教训的又一个样本：**这类断言不是装饰，是理由**——
> 它撑着「为什么 show 和 disabled 要拆成两个 prop」这个决定，
> 而它变假的时候没有任何机器会红。
>
> ### 四、负向验证（七条，逐条打印了变异后的被改对象）
>
> | # | 变异 | 守卫 |
> | - | --- | --- |
> | N1 | 分支的 disabled 摘掉 `uploading` | 红 |
> | N2 | 重跑的 disabled 摘掉 `uploading` | 红 |
> | N3 | 分支的 disabled 摘掉 `branchPending` | 红 |
> | N4 | `show-edit` 摘掉 `!props.uploading` | 红 |
> | N5 | **把 `branchPending` 也塞进重跑**（看起来更整齐的写法） | 红 |
> | N6 | 调用点不传 `:branch-pending` | 红 |
> | N7 | `finally` 里不清 pending | 红 |
>
> **N1 第一次没生效却全绿**——`old` 串按未格式化的三行写，实际文件里是一行，
> `assert` 抛了而后面那条 `run` 照跑。**这正是「一次没生效的变异和守卫没问题
> 长得一模一样」**（第十七轮那条纪律），靠「先打印被改对象再看用例」当场发现。
>
> ---
>
> ## 2026-09-16 第二十七轮：**开了两扇零新差异的窗，和一处台账天生看不见的条件**
>
> ### 一、两扇新窗：零新差异，而这次「零」有机器证据
>
> | 窗 | 挑它的理由 | 读数 |
> | --- | --- | --- |
> | `mcp-settings` 补 `mobile/light` | URL 直达（`?settings=tools`），**不必先解决移动端抽屉那一层**；而设置对话框在窄屏上第二十一轮真红过一次，当时只修了 integrations 自己那条收缩链 | 三个档全是已判过的 `div[scroll-area-viewport]`（mobile 档序号从第 15 变第 8） |
> | `artifact-batched-stream#preview-failed` 补 `desktop/dark` | 这条场景里**唯一的错误态**，而 `DARK_DIMENSION` 文件头写着这一维先给带错误态的场景加 | 与浅色档逐字相同，只有已判过的 `retry: 3` |
>
> **「零新差异」的机器证据是台账的「不同的差异」这个数：33 → 33 纹丝不动。**
> 同时唯一行 143 → 146、多重集 163 → 168、场景-维度 142 → 144——
> **涨的全是投影**。这正是本文开头那句「唯一行是投影数不是待办数」的又一次实测：
> 如果只看唯一行，这一轮看起来像「多了 3 件事」。
>
> **一条实现上的坑**：终态自己的 `dimensions` 是**覆盖**不是追加
> （`ParityState.dimensions` 的注释写着「不写就沿用场景的」），
> 所以给 `preview-failed` 加 dark 必须把场景那两档逐字列出来，
> 否则这一支会连 `desktop/light` 与 zh-CN 一起丢掉。
>
> ### 二、当轮结清：欢迎区不给目标让位
>
> 上游**两个入口**逐字相同：
>
> - `chats/chat-page.tsx:559-561` → `extraHeader={isWelcomeMode && !hasGoal && !hasTodos && <Welcome …/>}`
> - agent 页 `[agent_name]/chats/[thread_id]/page.tsx:442-448` → 同一串条件，换成 `<AgentWelcome …/>`
>
> 本仓 `AgentChat.vue` 一个组件服务这两条路由，而那个 `#extraHeader` 的 `v-if`
> **两条都没有**。后果具体：欢迎态下敲一条 `/goal …`（两个应用都支持，本仓走
> `@goal-change`）之后目标条出现，而它与欢迎区**共用输入框上方那一块绝对定位区域**
> ——上游把欢迎区收起来腾地方，本仓两块都画。
>
> **台账为什么看不见**：上游的欢迎态等价于 `isNewThread`
> （`chat-page.tsx:92` 初值 + `:114` 那个 effect），而那条路由上
> `thread.values` 根本没取过——也就是说上游这一支**只能靠 `/goal` 命令走到**，
> 夹具喂不出「新会话 + 已有目标」这个组合。所以钉成源码守卫
> `tests/unit/chat/welcome-yields-to-goal.test.ts`，与账 C 同一个形状。
>
> **这条守卫两侧都钉**：本仓那条钉「照着做了」，上游那两条钉「照的还是那个样子」。
> 理由是这条判据的**全部依据就是「照上游」**——上游哪天自己不这么写了，
> 本仓这一条就该重新判一次，而不是继续被守着。
>
> **负向验证（四条，逐条打印了变异后的被改对象）**：
>
> | # | 变异 | 变异后实测 | 守卫 |
> | - | --- | --- | --- |
> | N1 | 摘掉本仓 `!activeGoal` | 开标签只剩 `isWelcomeMode && !authoritativeTodos.length && …` | 红 |
> | N2 | 摘掉本仓 `!authoritativeTodos.length` | 开标签只剩 `isWelcomeMode && !activeGoal && …` | 红 |
> | N3 | 摘掉上游聊天页 `!hasGoal` | `extraHeader={isWelcomeMode && !hasTodos && …}` | 红 |
> | N4 | 摘掉上游 agent 页 `!hasGoal` | 同上形状 | 红 |
>
> **翻案判据**：哪天对照取样面能走到「欢迎态 + 有目标」（例如把 `/goal` 命令流
> 接进 `steps`），就把这条守卫换成台账读数。
>
> ### 三、沿途挖出来的：**唯一在验「Vue 能不能自足」的那道门，红了二十多轮**
>
> 本轮给新守卫登记 `cross-app-by-design` 之后顺手跑了一次 `standalone-sim`
> （它把 `../frontend` 真移走、再逐条跑登记表里的文件），**红 2 条**：
>
> - `tests/guards/invented-palette-colors.test.ts` **整个文件没跑起来——
>   收集阶段就炸了**。根因是 `describe.skipIf(!upstreamPresent)` 的回调体里直接
>   `scan(upstream, …)`，而 **`skipIf` 跳过的是用例、不是收集**。
>   这条坑 `scripts/lib/cross-app-by-design.mjs` 的文件头 wave 83 就写着，
>   这次在另一份文件上复发；那份文件 2026-09-12 建档那天起就带着它。
> - 「整套 vitest」那条是同一个根因的第二次报数。
>
> **真正的根因不是那份文件写错了，是没有任何机器在跑这道门**：
> 它不在 `make verify` 的先决条件里（有意的——它动文件系统），
> **也不在 CI 里**。而这道门验的正是这整件事的目标本身
> （「移走 `frontend/` 之后 Vue 仍能自足」）。
>
> 所以两件都做了：修掉那处收集期读取（照 `primitive-base-classes.test.ts` 的
> `reactBases()`，缺席时返回空表），**并把 `standalone-sim` 加进 CI 的 verify job**。
> CI 里安全的理由写进了那一步的注释：job 是串行的，脚本退出前会把兄弟应用放回去。
>
> 复量：`SIM_EXIT=0`，**跑过 18 / 未跑 5 / 红 0**。
>
> **这与 CI 里 `asset-budget` 那一步的注释是同一句话**——那句写着「它不在
> `make verify` 里，所以没人跑它，于是它红着跨了好几个提交没人发现」。
> 同一个形状第二次出现，判据是：**一道门只要没有自动入口，它迟早会红着没人看见。**
>
> ### 四、**新账 I：上游三串交互条件，本仓的 `interactive` 只等于 `!isDemo`**
>
> 顺着上一轮那条线索往下扫，当场量出来的（`chat-page.tsx:466-497` vs
> `MessageList.vue:1350/1568-1575` + `AgentChat.vue:1956`）：
>
> | 上游判据 | 上游的条件串 | 本仓对应 |
> | --- | --- | --- |
> | `canRegenerate` | `!isNewThread && !isMock && !STATIC && !isUploading && !thread.isLoading` | `show-regenerate` 只看「是不是最新 assistant 组」，禁用只看 `interactive === false` |
> | `canEdit` | 以上 + `!branchThread.isPending && !hasGoal && !hasOpenHumanInputCard` | `!hasGoal` 与 `!hasOpenHumanInput` 第二十六轮已补，其余没有 |
> | `canBranch` | `canRegenerate` + `!branchThread.isPending` | `show-branch` 看 `branchable`，禁用只看 `interactive` |
>
> 而 `interactive` 在调用点就是 `:interactive="!isDemo"`。
> **判据是「同一个操作在两边同样可用 / 同样不可用」**：上传附件的过程中、
> 历史还在加载时、分支请求还在飞的时候，上游这三颗键点不动，本仓点得动。
>
> **这一轮没动它的理由**：三串条件要三处新状态从 `AgentChat` 传进 `MessageList`，
> 而其中 `isUploading` 本仓已经有（`stream.isUploading`）、
> `thread.isLoading` 与「分支请求在飞」两处要先确认本仓有没有对应的量。
> **留给下一轮做，它现在是清单第 1 条。**
>
> ---
>
> ## 2026-09-16 第二十六轮：**挂了八轮的不是那处差异，是那份夹具**
>
> 正题是第十八轮留下的 `GoalStatus` 位置差异。**一份夹具逼出两处真差异，第二处比原账要紧。**
>
> ### 一、先说这笔账为什么挂得住八轮
>
> 账上写的是「先补夹具」，而**夹具能力一直就有**：`tests/e2e/utils/mock-api.ts` 的
> `MockThread` 早就有 `goal` 字段，`threadChannelValues` 里也一直是
> `goal: thread?.goal ?? null`。缺的从来不是夹具能力，**是一个同时喂 `goal` 与 `todos`
> 的场景**——只喂 todos 时两边都不画目标条，只喂 goal 时又没有待办当参照物，
> 于是这处位置差异**一个档都报不出来**。
>
> 给 `thread-todos` 补一份按 `GoalState` 逐字段给全的 goal（外加一条不随语言变的
> 锚点 `PARITY-GOAL-OBJECTIVE`）之后，它两个维度**此前基线全空**，一次就报出 18 个投影。
>
> ### 二、改前读数（两个语言维形状相同）
>
> | 档 | 读数 | 归因 |
> | --- | --- | --- |
> | `geometry` | `PARITY-GOAL-OBJECTIVE` y **React=494.5 / Vue=631.5 Δ137** | 目标条上游在待办**上面**、本仓在**下面** |
> | `geometry` | `To-dos` 与三条待办各 **Δ-48** | 本仓整体高一档——上游那一档被目标条占着 |
> | `order` | 第 45 个公共节点 React=目标条文字 / Vue=`To-dos` 按钮 | 同一根因的顺序投影 |
> | `ariaOnlyVue` | `button "Edit and rerun"` / `编辑并重新运行` | **第二处真差异，见下** |
> | `tabbablesOnlyVue` / `tabOrder` | `button` vs `div[scroll-area-viewport]` | 也是那颗键——**不是** scroll-area 那笔老账 |
>
> ### 三、当轮结清的两处
>
> | # | 差异 | 改法 |
> | - | --- | ---- |
> | 1 | **`GoalStatus` 的位置** | 从 `ChatComposer.vue` 搬到 `AgentChat.vue` 的 TodoList 同层（上游 `chats/chat-page.tsx:530-531`）。**外层 `v-if` 一并放宽成 `(activeGoal \|\| todos.length)`**——上游是 `{(hasGoal \|\| hasTodos) && …}`，只按待办判的话「有目标、没待办」的线程会连目标条一起不渲染，**那是把一处位置差异换成一处缺失**。 |
> | 2 | **有活跃目标时不许「编辑并重跑」** | 上游 `chat-page.tsx:481` 的 `canEdit` 里有 **`!hasGoal`**（与 `!hasOpenHumanInputCard` 并列），本仓 `MessageList.vue` 的 `show-edit` 完全没有这一条，而且 `MessageList` 根本不知道 goal 存在。**这不是多画了个装饰**：重跑会打断目标的续跑循环，用户点得到就会打断自己的目标。给 `MessageList` 加 `hasGoal` prop，`AgentChat` 用已有的 `activeGoal` 传进去。 |
>
> **改后 `thread-todos` 两个维度十一个档全空**——包括 `tabbablesOnlyVue` 与 `tabOrder`。
> 也就是说那两行**本来就是同一颗键**投影出来的，一处根因解释了全部 18 个投影。
> 我一度打算把它们记成「已判过的 scroll-area 账」——**那会是一次错误归因**，
> 靠的是「改完再量一遍」而不是眼力。
>
> ### 四、这一轮的两条方法教训
>
> 1. **「先补夹具」这类账，要先核一遍「夹具到底缺什么」。** 这一条挂了八轮，
>    而 mock 的 `goal` 字段一直就在——缺的是**用它的场景**。
>    **「缺夹具」和「缺一个喂它的场景」是两件事，前者要写代码，后者只要写十行配置。**
> 2. **别急着把剩下的读数归进老账。** 改完第一处之后剩三行，形状与判过的
>    `div[scroll-area-viewport]` 那笔账**长得一模一样**；真追下去，
>    它们和刚修的那颗键是同一个根因。**「长得像上次那处」是这个项目栽过很多次的地方**，
>    判据仍然是：**改完复量，看它跟着不跟着一起消失。**
>
> ---
>
> ## 2026-09-16 第二十五轮：**够得着的那一侧，把话搬进词典并让机器比着**
>
> 正题是账 H。顺带把它背后的那条不变量做成了零豁免的守卫。
>
> ### 一、当轮结清
>
> | # | 账 | 结论 |
> | - | -- | ---- |
> | **H** | **`markdown.unsafeLink` / `unsafeLinkTitle`：上游写死英文** | **两边同改。** 上游 `markdown` 块加这两条词条（en/zh 都用本仓已有的那两句），`markdown-link.tsx` 与 `artifact-link.tsx` 改读词典。本仓一个字没改——它本来就是对的。 |
>
> **改前 / 改后读数**（两边都是把组件真渲染出来读属性，不是读源码）：
>
> | | zh-CN | en-US |
> | --- | --- | --- |
> | 本仓 `MarkdownLink`（改前=改后） | `aria-label="已省略不安全链接"` / `title="链接协议不安全：javascript:alert(1)"` | `"Unsafe link omitted"` / `"Unsafe link scheme in …"` |
> | 上游 `MarkdownLink`（**改前**） | **`"Unsafe link omitted"`**（写死，与语言无关） | 同左 |
> | 上游 `MarkdownLink` / `ArtifactLink`（**改后**） | `"已省略不安全链接"` / `"链接协议不安全：…"` | `"Unsafe link omitted"` / `"Unsafe link scheme in …"` |
>
> **量法本身先被证伪过一次。** 第一版探针用 `vi.stubGlobal("useNuxtApp", …)` 换语言，
> 结果 zh-CN 与 en-US **都读出英文**——看起来像「本仓也念英文」这条干净结论。
> 实际是 `tests/setup/dom.ts` 把 `$i18n` 放进 `config.global.mocks`，
> **模板里的 `$i18n` 走的是 ctx 而不是 `useNuxtApp()`**（那份 setup 的注释自己写着这件事），
> 于是 locale 根本没换过。加一条**负向对照**（同一个 mock 下 `markdown.copyCode`
> 必须变成「复制代码」）才把假读数揪出来。
>
> ### 二、为什么不是走 `primitives.*`（与账 F 的分界）
>
> 账 F 那四条是 **`streamdown` 的产物**写死的、类型上没有口子，**上游也翻不掉**，
> 所以本仓跟着念英文。这两条是**上游自己的源码**写死的——`markdown-link.tsx:86-87`
> 与 `artifact-link.tsx:29-30`——**够得着**，所以把话搬进上游的词典，两边都念中文。
> **判据：先去读那个字符串是谁画的、那个包有没有口子。**
>
> ### 三、放进上游哪一块：`markdown`
>
> 上游的 `markdown` 块是整块 spread 进 `<Streamdown translations>` 的，
> 一度看着像「它就是 `StreamdownTranslations`」。实测不是：`ai-elements/streamdown.tsx`
> 的注释写着 `close` 是**故意不放进去**的，也就是这一块本来就是
> 「本仓这一面的 markdown 文案，顺便喂给 streamdown」，而不是那个库的类型。
> 加两条 streamdown 不认识的 key 它会直接忽略；类型上也不报错（spread 不走 excess property check）。
> 类型里就近写了一行注释说明这两条不是 streamdown 的 key。
>
> ### 四、顺带做成守卫：**两边同名的词条，两种语言都念同一句话**
>
> 账 H 暴露的是一整类问题：**同一个控件在两个应用里念两句不同的话，而没有任何机器在比。**
> `i18n-check` 只管本仓 key 集合与基线，`vue-only-keys` 只管本仓独有块里有没有死条目，
> `upstream-key-coverage` 此前只管「上游的 key 本仓有没有」——**值**没人比。
>
> 先量再立：实测两边**同名**的条目 en-US **666 条**、zh-CN **709 条**，
> 两种语言各 **0 条**不一致。也就是说这条不变量今天就成立，
> 加门禁只是让它以后也成立——**零豁免**（线索 180：要豁免表多半是判据没选对）。
> 真有一条该不同时，正确做法是让它**不同名**（本仓独有的块，或进 ALIASES 并写理由）。
> 用例加在 `upstream-key-coverage.test.ts` 里（它已在 `CROSS_APP_BY_DESIGN` 登记、
> 上游缺席时整组跳过），并带形状断言（比较条数必须 > 600，否则抽取器写坏了会静默全绿）。
>
> ### 五、负向验证
>
> | # | 变异 | 变异真的生效了 | 结果 | 命中的断言 |
> | - | ---- | ---- | ---- | ---- |
> | N1 | 把上游 zh-CN 的 `markdown.unsafeLink` 改成另一句中文 | 打印出那一行确实变了，还原后复原 | **红** | 新守卫：`[zh-CN] markdown.unsafeLink: 上游="不安全链接已略过" 本仓="已省略不安全链接"` |
> | N2 | 把 `markdown-link.tsx` 的 `aria-label` 改回写死英文 | 打印出那一行确实变了，还原后复原 | **红** | 上游单测：`expected … to contain 'aria-label="已省略不安全链接"'` |
>
> ### 六、这一轮的两条方法教训
>
> 1. **换语言的探针要带一条「这条词条确实变了」的负向对照。** 否则「两种语言都念英文」
>    与「locale 根本没换」长得一模一样，而前者会被当成结论写进账里。
>    这是仓里「算出来的 0 vs 没算的 0」在**多语言**上的同一个形状。
> 2. **立一条全称判据之前先把它量一遍。** 「两边同名就得同字」听起来像需要一张豁免表，
>    实测是 0 条不一致——**先量再立**把一条「看起来要豁免表」的规矩变成了零豁免的门禁。
>
> ---
>
> ## 2026-09-16 第二十四轮：**台账看不见的那一层，只有并排放进真浏览器才量得出来**
>
> 正题是账 C（收起态的侧栏提示），**两边同改 + 把判据做成守卫**。
>
> ### 一、当轮结清
>
> | # | 账 | 结论 |
> | - | -- | ---- |
> | **C** | **收起态下 Vue 有原生 tooltip 而 React 什么都没有** | **两边同改。** React 给四颗 `SidebarMenuButton` 传 `tooltip=`（上游自己的 primitive 一直支持、workspace 侧栏一个都没传）；本仓把 `tooltip` 移植进 primitive，撤掉四处临时的 `:title`。判据做成了 `tests/e2e-parity/sidebar-collapsed-affordance.spec.ts`。 |
>
> **改前读数**（探针把两个应用并排放进真浏览器，收起态逐颗悬停 1.2s）：
>
> | | Vue | React |
> | --- | --- | --- |
> | 四颗键的原生 `title` | `New chat` / `Chats` / `Agents` / `Scheduled tasks` | **全部 `null`** |
> | 悬停后的浮层 | 无 | **无** |
>
> 也就是收起之后**本仓弹一个原生气泡、上游毫无反馈**。改后两边逐条相同：
> 没有 `title`、持续悬停后 `aria-describedby` 指向的文字等于那颗键的名字。
>
> **沿途推翻一句写下来当理由用的话**：`SidebarMenuButton.vue` 的文件头写着
> 「本仓的侧栏外壳（ThreadSidebarShell）**没有图标条形态**，传进来也没有触发条件」，
> 这就是当初不移植 `tooltip` 的理由。而 `ThreadSidebarShell.vue` 写着
> `props.collapsed ? 'w-12' : 'w-64'`——**48px 正是上游的 `SIDEBAR_WIDTH_ICON = "3rem"`**。
> 这句话从收起态做出来那天起就是假的，而没有任何门禁看得见它。原文已就地划掉保留。
>
> **两处本仓与上游的机制差，一并对齐**：
> - **可访问名的来源**：上游收起时把标签留在 DOM 里让 `overflow-hidden` 裁掉，
>   本仓写的是 `v-if="sidebarExpanded"`、**直接删掉**。名字因此只能靠那个 `title` 撑着
>   ——第二十轮量到「四颗键可访问名逐字相同」时，本仓那一侧其实来自 `title`。
>   改成始终渲染。
> - **悬停延迟**：上游 `ui/tooltip.tsx` 默认 0、`ui/sidebar.tsx` 的 `SidebarProvider`
>   又写了一遍 `delayDuration={0}`；本仓 `TooltipProvider.vue` 默认 **500**
>   （对应上游 `workspace/tooltip.tsx` 那套 500 的用法，本仓那两处已显式写 500）。
>   在侧栏这一支显式压回 0，**不动全局默认**。
>
> ### 二、负向验证（逐条先打印被改对象的前后状态，再看用例）
>
> | # | 变异 | 变异真的生效了 | 结果 | 命中的断言 |
> | - | ---- | ---- | ---- | ---- |
> | N1 | React 的 `Chats` 不传 `tooltip=` | `tooltip={t.sidebar` **3 → 2**，还原后 3 | **红** | `aria-describedby` 是空串 |
> | N2 | 本仓的 `Chats` 不传 `:tooltip` | `:tooltip="$i18n` **4 → 3**，还原后 4 | **红** | 同上 |
> | N3 | 本仓的 `Chats` 标签加回 `v-if="sidebarExpanded"` | 打印出那一行确实变成 `<span v-if=…>`，还原后 `<span>` | **红** | **「收起态下「Chats」在可访问性树上找不到」** |
>
> **N3 是这一轮最值钱的一条**：它守的正是我自己在第一版里改出来的回归。
>
> ### 三、这一轮的三条方法教训
>
> 1. **「改完复量」不是走过场——它抓到的是我自己刚做出来的回归。**
>    摘掉 `:title` 的第一版跑完探针，本仓三颗键**从可访问性树上消失了**
>    （`找到: false`），而 lint / typecheck / 单测全绿。**一次只量「我想修的那件事」
>    的复量会放过它**：我量的是「有没有 tooltip」，而坏掉的是「还有没有名字」。
>    判据：**复量要把「原来靠什么撑着」也量一遍**——那个 `title` 同时承担了两件事。
> 2. **一句写在文件头当理由用的话，会在它的前提被别人改掉之后继续当理由用。**
>    「没有图标条形态」这句话的前提（外壳没有收起态）被后来某一轮直接推翻了，
>    而写下它的人和推翻它的人不是同一轮，**没有任何机器在看这件事**。
>    这与「写下来当规则用、却没人守」的话是同一个形状，只是这一条撑的是
>    **「不做某件事」的决定**——比撑「做某件事」的更难发现，因为它没有代码。
> 3. **守卫要守「这件事」，不要守「这个现象」。** 第一版守卫数全局
>    `[role="tooltip"]` 的个数，在「移开鼠标浮层应当消失」那一步红了——
>    reka 会把内容投影到一个**常驻**的 `role="tooltip"` 节点上供读屏器读，
>    鼠标移开它不消失。改成读每颗键自己的 `aria-describedby` 之后，
>    既不需要那个拆卸断言，量到的也确实是合同本身（「这颗键被这段文字描述着」）。
>
> ---
>
> ## 2026-09-16 第二十三轮：**够不着的那一侧，规矩要由本仓自己钉住**
>
> 正题是账 F。顺带把账 G 结清，并新挂一笔同形的账 H。
>
> ### 一、当轮结清
>
> | # | 账 | 结论 |
> | - | -- | ---- |
> | **F** | **Mermaid 工具条那四个名字** | **修掉。** `zoomIn` / `zoomOut` / `resetZoomAndPan` / `mermaidChart` 从 `markdown.*` **挪进 `primitives.*`**，两个 locale 同为英文，四个消费点改读新路径。读数：改前 `thread-history-mermaid#default` 与 `#download-menu` 的 `desktop/light/zh-CN` 两档各 8 条（4 `ariaOnlyReact` + 4 `ariaOnlyVue`）、共 16 投影；改后**两档全空**。 |
> | **G** | **`channels#settings-panel-connected` 的多账号块** | **不是欠账，是本仓独有的能力，判词见下。** |
>
> **账 F 为什么必须「挪块」而不是「把 zh-CN 改成英文」**：`primitives` 块有
> `tests/unit/i18n/vue-only-keys.test.ts` 的「两个 locale 一字不差」逐字钉着，
> `markdown` 块没有。**改前的状态本身就是证据**——`markdown.zoomIn` 在 zh-CN 里
> 一直写着「放大」，而 `make verify` 在 CI 上是绿的（`f55bc3b9`，四个 job 全过）。
>
> **够不着的证据是一手量的，不是引上游的注释**：`streamdown` 把四串英文写死在
> 它的 dist 产物里（实测到的是 `title:"Zoom in"` / `"Zoom out"` /
> `"Reset zoom and pan"` / `aria-label":"Mermaid chart"`），
> 而它导出的 `StreamdownTranslations` 里**没有对应字段**——
> 上游那句 `<Streamdown translations={{ ...t.markdown }}>` 翻不到它们。
> **那个 chunk 的文件名带内容哈希、每次发版都变，所以哪里都没记它**——
> 复量法：`grep -r "Reset zoom and pan" frontend/node_modules/streamdown/dist`。
> （`upstream-citations` 门禁当场把第一版注释里那条 `dist/index.d.ts:223` 报红了：
> 指进 `node_modules` 的行号引用，正是它守的那一类「照着找什么都找不到」。）
> 这与 `primitives.*` 其余条目**成因不同**（那些是上游自己的源码写死的、够得着），
> 所以 `I18N_INVENTORY.md` 里单独交代了这一支。
>
> **账 G 的判词**：那一块（`heading "已连接账号"` + 每账号一行 + 逐账号断开）
> 是**本仓独有的多账号能力**，上游一个 provider 只认一条 connection。
> 两边的源码里都写着这个决定：本仓 `ChannelConnections.vue:415` 起的注释，
> 以及上游 `channels-settings-page.tsx:243`「The multi-account list that app renders
> stays out of scope here: this row only ever shows one connection per provider.」
> 能力本身由 `tests/e2e-channels/channels.spec.ts` 拿**真 Gateway** 钉着。
> 台账那 11 条（3 条 `ariaOnlyVue` × 两语言 + 3 条 `geometry` + 2 条 `order`）
> 全部是这一个根因的投影，**保留**。
> **翻案判据**：上游哪天也做多账号（那时要对齐的是它的形状），
> 或者本仓把多账号能力去掉。
>
> ### 二、本轮新挂的一笔账
>
> | # | 账 | 证据与下一步 |
> | - | -- | ---- |
> | **H** | **`markdown.unsafeLink` / `unsafeLinkTitle`：上游写死英文，本仓翻了中文** | **量法**：比两边 `markdown` 块的 key（上游 28、本仓 34），本仓独有 6 条——4 条是账 F，**剩下 2 条就是这一笔**。上游 `workspace/messages/markdown-link.tsx:86-87` 与 `workspace/citations/artifact-link.tsx:29-30` 把 `aria-label="Unsafe link omitted"` 与那句 `Unsafe link scheme in …` 的 `title` **写死在自己的源码里**，中文界面照样念英文；本仓 `MarkdownLink.vue:131-132` 念的是「已省略不安全链接」。**与账 F 不同的是：这一处上游够得着**（它有自己的 `markdown` 词典块，en/zh 都在），所以按 `browser` / `markdown` / `artifacts` 三块的先例走**两边同改**（上游加两条词条 + 两个消费点改读词典），**不是**走 `primitives.*`。**台账看不见它**——没有任何场景喂过一条不安全协议的链接，所以做之前要先给取样面补这一支，否则改完没有读数可验（第二十轮那条教训：拿到 0 不等于两边一样）。**顺带**：上游那个 `markdown` 块是整块 spread 进 `<Streamdown translations>` 的，加进去的两条不属于 streamdown，要想清楚放哪一块。 |
>
> ### 三、订正上面那张审查表的三处格子
>
> 逐条从签入基线重算（脚本按 `(档, 行文本)` 去重再按根因归组），总数 41 / 179 两个数
> 都对得上，但**三个格子当天抄错了**：**对得上总数不等于每格都对**。
>
> - `channels#settings-panel-connected` 是 **11 条 / 11 投影**，不是 12 / 12；
> - 焦点是 **2 条 / 3 投影**，不是 2 / 2——审查那天把第 3 个焦点投影算进了 G；
> - 零散那一格写 **6**，而它自己列出来的条目数是 **7**（`div(menuitem)` ×2、
>   `role:separator` 几何 ×2、`tabbablesOnlyVue button` ×2、两条 `alert`、
>   两条 `tooltip`），**列表是对的、格子是错的**。
>
> ### 四、这一轮的三条方法教训
>
> 1. **「上游够不着」和「上游没做」要分开处理，而判据是去读那个包的产物与类型。**
>    同样是「上游写死英文」，账 F 走 `primitives.*`（库里写死、类型上没有口子），
>    账 H 走两边同改（上游自己的源码、自己的词典）。**只看症状会把两笔账做成同一笔。**
> 2. **一条会烂的引用，门禁比我先看出来。** 我给账 F 的注释写了
>    `dist/index.d.ts:223` 当证据——`upstream-citations` 当场报红两处
>    （`I18N_INVENTORY.md` 与 `en-US.ts`），理由是「指进 `node_modules` 的行号引用
>    照着找什么都找不到」。**更糟的是同一段还写了 `dist/chunk-BO2N2NFS.js`**：
>    那个文件名带内容哈希，**streamdown 每发一次版就变**，而它不含 `:行号`、
>    没有任何门禁看得见。修法不是放宽门禁，是**换一种不会烂的写法**——
>    记类型名（`StreamdownTranslations`）与**复量命令**，不记位置。
>    这是「尺子绑在位置事实上」那条坑的同一个形状，只是这次出现在**证据**里。
> 3. **「此前没有任何账认领」这句话要按两个面查。** 账 F / G 在挂账清单里确实没有
>    itemized 条目，但**冷启动文档的散文里点过名**（「剩下 40 行是 tooltip 播报节点、
>    写死英文、焦点落点、以及本仓独有的多账号绑定块」），账 4 那一行也早就把
>    「真正跟不了的只剩 4 条」写清楚了。**散文里的判词不算「有账」，但算「有结论」**——
>    不先搜一遍就会把一条已经判过的差异当成新发现重判一次。
>
> ---
>
这份文件回答一个问题：**「还欠什么」。** 逐条给状态，不给散文。
深度背景在 `vue-parity-handoff.md`，踩坑线索在 Claude 记忆 `deerflow-parity-harness-plan`。

> ## 2026-09-16 第二十一轮：**同一个地方第二次出问题，先怀疑上一次没修到根**
>
> 追 CI 上那条「本机绿」的红（`make e2e-mock` 的 375px 窄屏断言，
> `cardOverflow: 9`），修到根因，两边同改。
>
> ### 一、当轮结清
>
> 1. **`CardHeader` 的 `1fr` 列缩不动**（两边同改）。有 `CardAction` 时是
>    `grid-cols-[1fr_auto]`，第 2 列是 `whitespace-nowrap` 的 Refresh
>    （min-content 95px），第 1 列虽写 `1fr` 但 grid/flex 子项默认
>    `min-width: auto`，卡死在 137px。**决定性读数**：容器从 257 缩到 248 时
>    `grid-template-columns` 完全没变。修法是补 `min-w-0`（两层）+ `shrink-0`（图标）。
>    开始溢出的宽度 370 → 320。marker 推到 `a0f6bcae`。
> 2. **那条断言只量一档，而那一档余量为 0** → 加一档 360px。
>    负向验证：拿掉修复 → 360px 在本机 macOS 就红、375px 仍绿。
>
> ### 二、本轮新挂的一笔账
>
> | # | 账 | 现状 |
> | - | -- | ---- |
> | D | ~~「批不超过 4 轮」这条规则没有机器在守~~ **前提被推翻，降级** | 第二十一轮挂这条时的理由是「CI 那条红躺了 6 天」。**第二十二轮逐次查 CI 的 job 步骤，发现因果是错的**：`cc0387db`（09-09，上次推送）那次 `verify` job **整个 success**——那条 375px 用例当时**还不存在**（09-12 才由 `6e1c06c2` 加，晚于那次推送）；两次推送之间本地攒了 **360 个提交**，CI 一次都没看见；`90af6bea` 那次红在 i18n，后面的步骤全部 **skipped**（**一条红挡住了另一条**）；修掉 i18n 之后才第一次跑到它。**决定性推论：本机跑 `e2e-mock` 再多遍也抓不到它——它在 macOS 上就是绿的。** 所以这条账就算做出来也抓不到这一条。本机批次限额仍有价值（抓本机能抓的回归），但不该再排第一。 |
> | E | ~~推送节奏决定 CI 反馈延迟~~ **2026-09-16 结清，而且根因是一处文档错误** | 挂这条时以为「推不推是用户的决定、现行硬规则是要推就先问用户」。**那条硬规则本身是错的**：Claude 记忆 `deerflow-no-midway-questions` 里 **2026-09-06 就记着用户原话**「以后提交和推送远端你自行决定就行，不要我拍板」，是长期授权；而三份计划文档里一直写着「要推就先问用户」，**后来的会话读文档不读记忆，照着文档做**——于是两次推送之间攒了 **360 个提交**、CI 六天看不见任何东西。用户 2026-09-16 重申「后续你自动push」，文档里那句话已全部删掉改成「每轮收工自动推」。**判据：记忆与计划文档冲突时以记忆里的用户原话为准，并当场把文档改对。** |> ### 三、这一轮的两条方法教训
>
> ### 三、这一轮的两条方法教训
>
> 1. **一条只在某个平台上成立的断言，和它守住了长得一模一样。** 判据要留余量——
>    把量的宽度往下再取一档，比把断言放宽到 `≤9` 强，后者是打补丁。
> 2. **「上次修过同一个症状」是强线索，去读那处注释。** 上游那段注释直接写着
>    这张卡片以前溢出过、当时把 `px-6` 降成 `px-4`——**那次修的是 padding 不是
>    收缩链**，所以余量一直是 0。
>
> ---
>
> ## 2026-09-15 第二十轮：**并排放进真浏览器，才看得见取样面外的那一层**
>
> 正题是把收起态的侧栏接进取样面。读数是 0 行——**而这一轮真正的产出，是证明那个 0
> 可信，以及在证明的过程中挖出的两件事**。
>
> ### 一、当轮结清
>
> 1. **场景 `sidebar-collapsed` 接进取样面**，场景-维度 140 → 142，唯一行 159 不变。
>    锚点 `{role:"button", name:"Toggle Sidebar"}` 三处核过（上游 5 个调用点里 3 个带
>    `md:hidden`，另两个与本仓 `ThreadSidebar.vue:471/491` 逐一对应；可访问名两边恒为
>    同一串，跨语言不变；收起后那颗换成悬停才显形的分支）。
> 2. **给这条场景加了终态断言**（`hidden` on `/^DeerFlow$/`）。**没有它，0 行有两种读法**
>    ——click 没生效的话两边都停在展开态，十一档照样全空，和「两边真的一样」长得一模一样。
> 3. **修掉夹具串味（根因修法）**：`scenarios.spec` 原来两个应用**共用一个 browser
>    context**，而双方把侧栏收起态存在**同名 cookie `sidebar_state`** 里（上游
>    `sidebar.tsx:28`，本仓 `useWorkspaceSidebar.restoreFromCookie`）。先跑的 Vue 一收起，
>    后跑的 React 就带着 `sidebar_state=false` 开局，再点一下反而展开——截图里
>    「一个收起一个展开」看着像产品差异，其实是串味。改成一应用一 context（对齐
>    `diff.spec`），**所有** cookie 持久化状态都不再互相污染。
>    原注释写的理由是「一个应用一个 **page**……page 级状态」，**范围比实际需要的窄**。
> 4. **订正第十九轮写错的猜测**，三处（场景注释、`dead-data-selectors` 文件头、冷启动文档）。
>
> ### 二、本轮新挂的一笔账
>
> | # | 账 | 现状 |
> | - | -- | ---- |
> | C | **收起态下 Vue 有原生 tooltip 而 React 什么都没有** | 上游的 `SidebarMenuButton` **自带 `tooltip` 属性**（`sidebar.tsx:509-548`，收起时渲染 Radix Tooltip），**而 workspace 侧栏一个都没传**；本仓 `ThreadSidebar.vue:515/554/572` 写的是 `:title="collapsed ? … : undefined"`，**是 Vue 自己加的**。于是收起之后：React 悬停毫无反馈，Vue 弹一个原生气泡。**台账为什么看不见**：`aria` 档比的是可访问名，两边相同（一边来自被截断的文本节点，一边来自 `title`）；`geometry` 档不取 `title`/`data-*`。**修法（两边同改，已授权的例外）**：上游造了机制却没在 workspace 用，那是上游的缺口——React 给那四颗传 `tooltip=`，本仓把这个 prop 移植到自己的 `SidebarMenuButton` 并改用它，撤掉临时的 `:title`。**改完这一屏仍然量不出来**，所以同一轮要把判据做成守卫，而不是靠台账。 |
>
> ### 三、这一轮的两条方法教训
>
> 1. **拿到 0 不等于两边一样。** 「没有差异」这种结论必须附带「目标状态真的到达了」的
>    证据，否则和「压根没测到」长得一模一样。对照场景就把终态断言写进 `steps` 里。
> 2. **取样面之外的那一层，只有把两个应用并排放进真浏览器才看得见。** 本轮那条
>    tooltip 差异，台账、守卫、单测**全都是绿的**——它不在任何一条尺子上。
>
> ---
>
> ## 2026-09-15 第十九轮：**写下的范围，和机器生效的范围，从来不是同一个**
>
> 零产品改动。做的是把「靠人记得」的三处换成「机器会红」。
>
> ### 一、当轮结清
>
> 1. **计划文档的台账读数第一次进门禁。** 五处活跃断言在说谎（三处场景-维度数、
>    一处断点分布连族名单、词典 key 与 e2e-parity 用例数），没有任何门禁会红。
>    新增 `frontend-vue/scripts/lib/plan-docs.mjs` + `doc-facts` 七类断言；
>    判据用**全称**（`toContain` 只证明「至少有一处对」）并**按类**防空集。
> 2. **`dead-data-selectors` 的 `collapsible` 豁免收紧**：理由写「那两条」，
>    实现按属性名在整棵 `ui/` 树生效，实测放过 6 处、跨 3 个文件。改成按
>    「文件 → 处数」钉死。`glyph-as-icon` 与 `primitive-marker-classes`
>    同形状、今天无缺口，一并按处数收紧。
> 3. **第十八轮遗留的红门禁修掉**：`primitives.todos` 没进词典审计基线，
>    `make i18n-check` 自那次提交起一直红（连带 `I18N_INVENTORY.md` 的 key 数）。
> 4. **CI 的 `real-backend` job 修掉**：它起真 Gateway 却没装浏览器依赖，
>    至少从 2026-09-09 起一直红；照同文件里绿着的 `external-gates` 逐字补齐，
>    并在 `tooling-contracts` 加门禁钉住「起真 Gateway 的 job 装配一致」。
>
> ### 二、本轮新挂的两笔账
>
> | # | 账 | 现状 |
> | - | -- | ---- |
> | A | ~~收起态的侧栏整个不在取样面~~ **第二十轮结清** | 场景 `sidebar-collapsed` 已接进取样面，**0 行，而且是可信的 0**（终态断言证明两边都真的收起了）。**同时推翻本行原来的判词**：原文写「上游靠 CSS 藏、节点还在，所以上游收起后仍朗读分组标题而本仓不会」——2026-09-15 在真实栈上量过，**不是这样**：`sidebar.tsx:415` 那两条 `opacity-0` 在这个应用里走不到，收起时两边的分组标题都从 DOM 里消失，四颗导航键的可访问名逐字相同。**那是推断，不是读数**（教训见 Claude 记忆 `measure-dont-guess`）。 |
> | B | ~~CI 那条修复只验到「照抄了绿着的兄弟 job」~~ **已观测结清** | `c0d25064` 推上去后 CI 跑出结论：**`real-backend` job = success**，`verify` job 的 `Run fast verification`（`make verify`）也通过——第十九轮修的两处都在 CI 上验证了，不再是推断。 |
>
> ### 三、这一轮的三条方法教训
>
> 1. **门禁的退出码不能隔着管道读**——`make … | tail` 给的是 `tail` 的码，永远 0。
>    这条规则**早就写在冷启动文档的操作纪律里**，仍然被违反了三次
>    （第十八轮一次、第十九轮开头两次）。写下规则挡不住，**不自己拼命令**才挡得住。
> 2. **「以签入产物为准」比「以散文为准」强，但产物本身也要有门禁守着。**
>    本轮门禁拿 i18n 基线当真值判定文档写错，结果是**产物旧、文档对**；
>    守产物的 `i18n-check` 红着没人读。上层读数必须先确认下层是绿的。
> 3. **本机绿和「门禁有效」长得一模一样。** `real-backend` 在 CI 红了至少六天，
>    每轮本地跑都是 22 passed——因为本机 venv 里装着 CI 没装的东西。
>
> ---
>
> ## 2026-09-12 第十八轮：**一屏没进过取样面，五处差异谁也说不出来**
>
> 结清第十三轮挂的那笔账：给 todos 造夹具、挂进取样面、量到读数再改 TodoList。
> 整个循环走完——**挂锚点 → 22 行 → 逐行追到根因 → 照上游补 → 22 行归零**。
>
> ### 一、夹具根本喂不出这一屏（两处保真度缺口）
>
> 1. **mock 从来不吐 `values.todos`**。真后端一直返回它（`core/threads/types.ts`
>    的 `AgentThread["values"]` 里就有），产品也读它——而
>    `tests/e2e/utils/mock-api.ts` 的 `threadChannelValues` 里没有这个键，
>    于是**任何 `backend: "mock"` 的用例都看不见待办列表那一屏**。
> 2. **`/history` 那条路由自己手抄了第三份 channel values，并且已经漂了。**
>    补 `todos` 时 `GET /threads/{id}` 与 `/state` 都跟上了，只有它没有。
>    后果不是「少一个字段」，是**同一个字段两种行为**：本仓读 `/state` 看得见，
>    上游用 SDK 的 `useStream` 从 `/history` 水合、看不见——对照场景当场卡在
>    「React 没能到达」，而在此之前没有任何机器说得出这两条路由已经不一致。
>    做成门禁 `tests/guards/mock-channel-values.test.ts`（负向 2 条）。
>    **这正是 `threadChannelValues` 自己的注释想防的那件事**
>    （「抽成一个函数，就是为了让这条后端事实在 mock 里也是结构性的」）。
>
> ### 二、锚点踩的一次：本仓有不等于两边都有
>
> 第一版 settle 用 `data-testid="thread-todos"`——**那是本仓独有的**，
> 上游 `todo-list.tsx` 一个 testid 都没有，于是 React 侧必然超时。
> 改用折叠头里那句 `To-dos`：两个应用都写死英文（不是词条），两个语言维下同一串。
> **锚点要两边都成立，不是本仓有就行**（坑 214 的同一条）。
>
> ### 三、三处真差异，逐行追得到
>
> | 台账那一行 | Δ | 根因 |
> | --- | --- | --- |
> | （步骤超时：`subtree intercepts pointer events`） | — | **待办面板一层定位包裹都没有**。上游有两层（`right-0 left-0 z-0` ＋ 欢迎态 `absolute -top-4`，内层再一层 `absolute`），本仓只给了 `mb-2`，于是欢迎态下它排进正常流、被 Welcome 块压住。「名字对、位置对、尺寸对，却点不动」正是 `hit` 那一格守的形状，这次它以**步骤超时**先现形 |
> | `text:To-dos x Δ-24 / width Δ+24` | 图标 16 + gap 8 | 上游把标题文字单独放一个 `<div>`，本仓和图标挤在同一个 `<span>`——`getByText` 把图标一起框了进去 |
> | 三条待办 `x Δ-12 / width Δ+24`、`y` 每行差 8 | `px-3` 两侧 / `py-1` 上下 | `<li>` 缺上游 `QueueItem` 的 `group hover:bg-muted flex flex-col gap-1 rounded-md px-3 py-1 text-sm`，指示器与文字还少包一层 `flex items-center gap-2` |
>
> 容器层一并照上游补齐：`rounded-t-xl border border-b-0`（只圆上两角、无下边框，
> 因为它贴着 composer 顶边坐）、`origin-bottom translate-y-4`、`backdrop-blur-sm`、
> `transition-all duration-200 ease-out`；列表体从 `v-if` 整块摘掉改成常驻
> `<main>` ＋ `h-0 ↔ h-28` 高度过渡 ＋ `ScrollArea` ＋ `max-h-40`。
>
> ### 四、本轮最值钱的一条：同一处结构问题的两个投影
>
> 把标题文字照上游单独放一层之后，**i18n 源守卫立刻报了 `To-dos`**
> ——而**旧写法它扫不到**：那时文本节点是元素的兄弟，不是唯一子节点。
>
> 也就是说，那个 24px 的几何差和「这串英文没进词典」是**同一个结构问题的两个投影**，
> 一个由对照工厂看见、一个由 i18n 守卫看见，而**在把结构改对之前，两道门都是绿的**。
> 按仓里既有约定处理（上游写死英文的名字走 `primitives.*`，两种语言同一串，
> 与 `close` / `toggleSidebar` 同一做法）。
>
> ### 五、留下的一笔
>
> **`GoalStatus` 的位置**：上游把它和 TodoList 放在同一层包裹里
> （`{activeGoal && <GoalStatus/>}`），本仓的在 `ChatComposer.vue` 里。
> 这一轮没动它——搬它要动 composer 的结构，而**目前没有任何场景同时喂 goal 与 todos**，
> 改完没有读数可以验。下一轮要动的话，起手式是先给夹具补 `goal`。
>
**一次没生效的变异，和「守卫没问题」长得一模一样**
>
> 接着第十六轮的表往下填，把 78 条负向断言按「**有没有历史标记**」再筛一次
> ——只留还在当现在时用的（29 条），逐条核。
>
> ### 一、一道门把「一句仓库已经宣布作废的话」钉住了
>
> `tests/guards/icon-parity-tool.test.ts` 有一条
> `expect(source).toContain("这是顾问工具，不进任何门禁")`，
> 而 `scripts/icon-parity.mjs` 的文件头**专门标注过那句话从 wave 111 起就是假的**。
> 它今天能过，只因为脚本把那句假话**引在了纠正段里**——谁把纠正段整理掉，
> 这道门就红，而红的原因与它想守的事（「缺上游时退出 0」）毫无关系。
> 尺子换成真正要守的三样：分支条件 `!existsSync(reactRoot) || !existsSync(REACT_DTS)`、
> 那句提示「跳过：找不到上游」、以及 `process.exit(0)` 本身。
>
> **顺带量了一下这种尺子有多少**：全仓把「源码里必须含有某句中文」当判据的只有
> 12 条 / 3 份文件，其余 11 条钉的都是**脚本真的会打印的消息**（行为锚点），合理。
>
> ### 二、第十二轮那颗按钮的第五个兄弟
>
> 把「状态条件类」回扫一遍（第十二轮挂的账）：产品面只剩三处，都在
> footer 那颗设置键与会话行的 ⋯ 上。静态对一下 footer 那颗手抄的类串与
> `sidebarMenuButtonVariants` 的 `base+lg+default`——**35 个 token 里它只有 12 个**，
> 其中**活的漏项**是：
>
> | 漏的 | 后果 |
> | --- | --- |
> | `outline-hidden` `ring-sidebar-ring` `focus-visible:ring-2` | **这颗按钮没有键盘焦点环**，上游有 |
> | `transition-[width,height,padding]` | 展开/收起不过渡 |
> | `active:*` ×2 · `data-[state=open]:hover:*` ×2 | 按下 / 打开时悬停不变色 |
>
> 其余（`[&>svg]:*`、`data-[active=true]:*`、`disabled:*`、
> `group-data-[collapsible=icon]:*`、`group-has-…/menu-item:pr-8`）在本仓这处结构下是哑的。
>
> **这是第十二轮那四颗导航键的第五个兄弟**：同一份 cva、同一个根因。
> 那一轮跳过它是因为 wave 74 的豁免——而**那条豁免说的是 `peer/menu-button`
> 与收起态尺寸，不是焦点环**。豁免的范围被读宽了。
>
> 钉法：`upstream-class-echo` 里加一条，**逐条对着 cva 比**，
> 只放过那几条在本仓哑掉的，每一条写清为什么；**双向**（cva 里没有的豁免会被报出来）。
>
> ### 三、本轮最值钱的一条：负向验证自己也会是空操作
>
> N1 第一次跑**绿了**。按规矩这不该发生，查下去是**变异根本没生效**：
> `s.replace("focus-visible:ring-2", "", 1)` 命中了文件里更早的另一处。
> 改成「先定位到那个元素、打印改动前后的类串、再断言」之后 N1 当场红并点名三个 token。
>
> **一次没生效的变异，和「守卫没问题」长得一模一样。**
> 这是本会话第三次撞到「尺子量的不是我以为的东西」，而这次撞在**负向验证自己身上**
> ——负向验证是用来证明门有效的，它自己失效时**没有任何东西会提示你**。
> 对策：变异之后**先打印被改对象的前后状态**，再看用例红不红。
>
**「这件事没人守」会随着有人给它加了门禁而变假，而没有任何机器在看这件事**
>
> 接着筛按 token 聚类剩下的几族。**`values`（流协议 4 处）、command-score 的分词
> quirk、类型契约——逐条核过，全部确有指名用例**（`gap-recovery.test.ts` 专门钉
> 「custom 必须在 values 之前」、`command-score.test.ts` 的 22 组定值里就有
> `["minimax-m3","MiniMax M3",0.9996000599960002]`）。
>
> 出货的是**核的过程本身**：`message.contract.ts` 的文件头说
> 「这个文件之所以在 `app/` 而不是 `tests/`，是因为 **`tests/` 根本不过 vue-tsc**」。
> 实测——在 `tests/` 里塞一个 `const x: number = "s"`，**当场报 TS2322**。
>
> ### 一、同一句过期断言，七处
>
> `make typecheck-tests`（`vue-tsc -p tsconfig.tests.json`）**2026-09-11 就接进了
> `make verify`**（git 可查），而这句话被当**现在时事实**用在七个地方，
> 每一处都在支撑一个设计决定：
>
> | 处 | 它撑着什么 |
> | --- | --- |
> | `app/core/types/message.contract.ts` | 这份类型断言**为什么住在 `app/`** |
> | `tests/guards/message-content-contract.test.ts` | 为什么把类型层护栏挪走 |
> | `tests/guards/parity-ledger-fields.test.ts` | 为什么不写成类型层断言 |
> | `tests/e2e-parity/support/ledger.ts` | 「证据是门禁不是类型」的全部理由 |
> | `tests/e2e-parity/support/scenarios.ts` | 「所以没有任何机器说过话」 |
> | `tests/support/playwright-factory.ts` | 同上（**这一处是守卫自己扫出来的，我的 grep 漏了**） |
>
> 七处全部改成过去时并写明**是被哪条命令推翻的**。靠它支撑的结论逐条重判：
> `message.contract.ts` 留在 `app/`（换一条理由：骑的是 typecheck 预算门禁）、
> `parity-ledger-fields` / `ledger.ts` 仍然不写类型断言（换一条理由：要对的是
> **三方**，而那个 `.mjs` 脚本读不到 TS 类型，类型断言够不着它）。
>
> ### 二、第二处同形：改在了发现它的地方，没改到另一处
>
> `scripts/icon-parity.mjs` 的文件头**专门**标注过：「『这是顾问工具，不进任何门禁』
> 那句话从 wave 111 起就是假的……留着的后果不是措辞问题：**读到它的人会以为这份
> 输出可以忽略，接 CI 的人会照它跳过**」。而 `scripts/lib/cross-app-by-design.mjs`
> 的登记里**原样留着同一句**。改措辞并写清真实条件（它不在 `verify` 的先决条件里，
> 但豁免表过期或形状断言不成立时它会红）。
>
> ### 三、做成守卫：`tests/guards/stale-coverage-claims.test.ts`
>
> **判据不是「不许写这句话」，而是「写了就得现在还成立」**——这句话在 2026-09-11
> 之前是对的，而且**有用**（它解释了一个真实的坑）。所以这道门把「还成不成立」
> **算出来**：`typecheck-tests` 在不在 `verify` 的先决条件里。
> 哪天有人把它从 `verify` 摘掉，这句话重新成立，**这道门自己让路**（负向验证 N2 证过）。
>
> **第一版判据是错的，守卫自己报了出来**：它把五处**刚刚改好的**文件全报成违规
> ——因为那些文件**引用了原句**来记录历史。改成「引用可以，但同一份文件里必须
> 点名 `typecheck-tests`（是它推翻的）」。**这个仓库就是靠「原文写的是 X，而 X
> 从某天起是假的」记住坑的，判据不能把这种写法一并禁掉。**
>
> **加一条之前先想清楚「怎么算出它还成不成立」**——算不出来的不要进表，
> 否则它自己就变成下一句没人守的散文。
>
**一条写着却永远不成立的选择器，比没写更糟**
>
> 按第十四轮定下的口径接着筛：把断言按**它点名的 token** 聚类，
> 只看**被 ≥2 份文件点名**的那些（跨文件同形 = 这两轮出货的形状）。
> 16 个里，`ui/input` / `ui/textarea` / `$attrs` / `renderComponentRoot` 已在前两轮成门；
> 剩下最有货相的是 **`data-size`**——`Item.vue` 与 `SidebarMenuButton.vue` 各自断言
> 「`data-variant` / `data-size` **必须原样输出**：兄弟 primitive 靠它定位」。
>
> ### 一、判据一路推到「死选择器」
>
> 「必须原样输出」推广开来就是：**类串里写了 `data-[X]:`，X 就得真的会出现在 DOM 上**。
> 全仓量下来 `ui/` 里被选择的 `data-*` 有 14 个，其中：
>
> | 来源 | 有哪些 |
> | --- | --- |
> | 本仓包装层自己写 | `slot` `variant` `size` `side` `active` `spacing` `sidebar` |
> | **reka 运行时打上** | `state` `disabled` `highlighted` `orientation` `placeholder` |
> | **两边都没有（死）** | **`inset`** · `collapsible` |
>
> **`inset` 是真死的**：三颗 dropdown primitive 的基类里都带着 `data-[inset]:pl-8`
> （基类逐字照上游，`primitive-base-classes` 还盯着），而本仓**没有任何出口**能把
> `data-inset` 打上去——`inset` 是 shadcn 层的 prop（`ui/dropdown-menu.tsx:74/156/212`），
> reka 没有这个概念。补上那个 prop（Label / Item / SubTrigger 三颗）之后这条才活。
> `collapsible` 是 wave 74 判过的分歧（本仓侧栏收起态走自己的 ref），进豁免表并注明出处。
>
> ### 二、这条用例刚写完就付清了成本
>
> 第一版写的是 `:data-inset="props.inset"`。**Vue 的布尔 prop 不传时会被转成 `false`**，
> 而 `data-[inset]:pl-8` 编译出来是 `[data-inset]{…}`——**按属性存在匹配**，
> `data-inset="false"` 照样命中。也就是说照直绑会让**每一项都缩进 8px**。
> 改成 `props.inset || undefined`。
> （上游 React 在 `inset={false}` 时确实会打出 `data-inset="false"` 并因此缩进，
> 那是它的 quirk；两边调用点都是**零消费者**，本仓取「不打」，理由写在文件头。）
>
> **判据落在渲染结果上，不落在源码文本上**：源码里有 `:data-inset` 不等于属性真的
> 到了 DOM——`useForwardProps` 会把未知 prop 原样转发，`inset` 不从 `delegated` 里剥掉
> 的话，reka 会额外打一个裸 `inset` 属性。那条 DOM 用例因此同时钉两件事。
>
> ### 三、做成守卫：`tests/guards/dead-data-selectors.test.ts`
>
> **两个来源缺一不可**：只查本仓包装层会把 reka 打的那五个全报成死选择器
> ——那正是第一版量法犯的错（第十四轮的教训：**正则看不见的那一半会被当成 0**）。
> 第二个来源直接去 `node_modules/reka-ui/dist` 里查，**不维护手抄名单**。
> 形状断言里那条 `rekaSource.length > 100_000` 就是为它设的：尺子读空时**先红的是它**，
> 而不是一片假红。
>
> 负向验证 3 条：撤掉 `inset` 的出口 → 报 `inset`；把 reka 那一路的路径写错 →
> 形状断言先红；`ALLOWED` 里塞一条已经有人打的 → 反向那条红。
>
**「已经有门禁在守」这句话本身也要核**
>
> 接着筛方向 C 的 131 条断言。这一轮四条排队的**逐条核过**，
> 三条确有门禁、一条的门禁**只盖了三分之一**。
>
> ### 一、`MarkdownIcon.vue`：自称的门禁只盖了 3 / 9
>
> 那份文件的头注释写着「不是 lucide，也不许换成 lucide……换成 lucide 的同名图标，
> 路径数据、stroke 画法、外框尺寸全都不一样——**DOM 等价 gate 会逐属性红**」。
> 实测：golden 夹具 `tests/fixtures/react-markdown-dom.json` 里**只对得上 3 条**
> （`CopyIcon` / `DownloadIcon` / `Maximize2Icon`）。另外 6 条——`CheckIcon`（复制后的
> 瞬时态）、`ExternalLinkIcon`（外链弹窗）、`RotateCcw` / `X` / `ZoomIn` / `ZoomOut`
> （mermaid 全屏控件）——**在夹具里一次都没出现过**，那句「会逐属性红」对它们不成立。
> 线索 229 的同一形状：判据由一个看不见新东西的数字撑着。
>
> 补的门 `tests/guards/markdown-icon-paths.test.ts`：9 条路径**逐字**比上游装的
> streamdown 产物（上游不用图标库，把它们内联在 dist 里，那是唯一出处），
> 外框与 path 的 8 个属性也两头比。实测 **9 / 9 全中**。
> **不写死 chunk 文件名**（`chunk-BO2N2NFS.js` 那串 hash 每次构建都会变），扫整个 `dist/*.js`。
>
> **写下来的边界**：这条判据**不钉「名字 ↔ 路径的对应」**——上游产物是压缩过的，
> 图标组件只剩 `jt` 这类标识符，名字拿不到。把 `CopyIcon` 与 `DownloadIcon` 的路径
> 对调，这道门不会响（夹具覆盖的 3 条会被 DOM 等价 gate 逮到，其余 6 条目前无人守）。
> 顺带挡住一半：「9 条路径互不相同」这条形状断言能逮到「表里抄重了一条」。
>
> ### 二、坑 72：一个不报错的 Vue 陷阱，规则只写在两份注释里
>
> `Textarea.vue` / `Collapsible.vue` 写着「`modelValue` / `update:open` **必须显式声明
> 并显式 emit**，靠 fallthrough 是不行的」。理由是 `renderComponentRoot` 在合并
> `$attrs` 之前跑 `filterModelListeners`：凡是 `onUpdate:<key>` 且本组件**声明了同名
> prop**，就从 fallthrough 里剔掉——**不报警告、不报错，只是永远收不到事件**。
> 也就是说「声明了 prop 却不 emit」比「什么都不声明」更糟。
>
> 全仓量：**59 处 `v-model` 调用点、落在 9 个 primitive 上、0 违规**。
> 做成 `tests/guards/v-model-emits-declared.test.ts` 把这个 0 钉住。
>
> **判据为什么从调用点出发**：「声明了 prop P 就必须 emit `update:P`」是错的——
> `class` / `language` / `readonly` 这些单向 prop 当然不该 emit，按那条要一张几十条的
> 豁免表（坑 180）。**只有被 `v-model` 绑过的那个 key 才落进陷阱。**
>
> ### 三、逐条核过、确有门禁的三条
>
> | 断言 | 守它的是谁 |
> | --- | --- |
> | `layouts/viewer.vue`「这一层不许出现 landmark」 | 对照台账——`artifact-viewer-window` 场景就在 `/artifacts/view` 上，aria 档会报出多出来的 `main:` |
> | `endpoints.ts`「endpoint 只能出现在这一层」 | `tests/architecture.test.ts` 的「没有具体 endpoint 或 /api/ 路径」，扫的是 L1 内核 |
> | `coalesce.ts`「**两层**都不许退化成尾部防抖」 | **两层各有一条用例**：L3 `tests/unit/threads/coalesce.test.ts:39`、L1 `packages/agent-core/tests/store.test.ts:287` |
> | `AgentSettingsDialog`「不要再写一次 `text-lg`」 | `primitive-class-overrides.test.ts`（它就是为这个坑建的） |
> | 「走 `ui/input` / `ui/textarea`，不要手写」一族 6 份 | `handwritten-input.test.ts`（同时扫 `<input>` 与 `<textarea>`） |
>
> ### 四、量过、判「不做门」的两条
>
> - **`BrowserPanel`「不要给它 aria-label」**：全仓有 **6 处**输入控件同时写了
>   `aria-label` 与 `placeholder`，而其中多数是正当的（名字用 label、提示用 placeholder）。
>   判据会退化成一张 6 条的豁免表（坑 180）。真正的判据是「上游同一处有没有 aria-label」，
>   **那个不可机械求解**。顺带记下：现有的 `browser-control.spec.ts` 按 placeholder
>   **属性**找元素，加了 `aria-label` 照样过——**可访问名没被钉住**。
> - **`MessageList`「多根模板必须自己接 attrs」**：全仓 19 份用 `inheritAttrs: false`，
>   **19 份都接了**（4 份走 `useAttrs()` 而不是 `v-bind="$attrs"`，第一次量漏了它们）。
>   不做门的理由：判据分不出「真的接回来了」和「`useAttrs` import 了没用」，
>   而真正的失效方式正是后者的一种。要做得先想清楚怎么量「真的接回来了」。
>
**一句写在注释里的全仓规则，可以一轮都没人守**
>
> 按第十二轮定下的起手式做方向 C：grep 注释里的「不要 / 必须 / 照抄」断言，
> 逐条问「有没有门禁真的在守它」。断言面 346 条 / 165 份文件，
> 收窄成**点名了具体 token 的**那些（只有这种可能被扫描器验证）→ 131 条 / 87 份。
>
> ### 一、第一条：**「破坏性动作一律走 `text-destructive`，固定红只留给 diff 增删与状态色」**
>
> 这句话写在 `AgentCard.vue:118` 的一句注释里，**全仓生效、零门禁**。
> 判据从「红」扩到整块调色板之后当场出货——**本仓用了三种上游从没用过的固定色**：
>
> | 处 | 本仓写的 | 上游同一处 | 深色下 |
> | --- | --- | --- | --- |
> | `AgentChat.vue` 重试状态浮块 | `bg-blue-50 text-blue-700` | `toast(e.message)`（形态是判过的分歧，颜色不是） | **没有 `dark:`**，一块浅蓝方块浮在暗背景上 |
> | `AgentChat.vue` 发送失败浮块 | `bg-amber-50 text-amber-700` | 同上 | 同上 |
> | `ToolSettings.vue` / `SkillSettings.vue`「需要管理员」 | `rounded-md bg-amber-50 p-3 text-amber-800` | `<div className="text-muted-foreground text-sm">`，**根本没有框** | 同上 |
> | `TodoList.vue` 完成勾 | lucide `Check` + `text-emerald-600` | `ai-elements/queue.tsx` 的 **CSS 圆点**，没有勾 | 同上 |
>
> **`SkillSettings.vue` 那一处是第十二轮那个形状的又一例**：紧挨着的下一行注释就写着
> 「`<div>` 不是 `<p>`：上游那一句是 `text-muted-foreground text-sm`」——
> 而它只落到了 loading 那一行，adminRequired 那一行还是琥珀框。
>
> 改法：浮块的**形态**是判过的分歧（注释写明为什么不走 toaster），只换颜色——
> 重试是中性状态走 `bg-popover text-popover-foreground`（与侧栏那颗 CSS tooltip 同一套），
> 发送失败是错误走本仓既有的 `bg-destructive/10 text-destructive`
> （同 `settings-session-unavailable`）；两处「需要管理员」照抄上游；
> TodoList 的**指示器与文字类串**照抄 `QueueItemIndicator` / `QueueItemContent`。
>
> ### 二、做成守卫：`tests/guards/invented-palette-colors.test.ts`
>
> **判据是「本仓 ⊆ 上游」，不是「不许用固定色」**：diff 增删、状态色、落地页装饰
> 上游自己就写固定值，禁掉要一张几十条的豁免表（坑 180）。而本轮实测的缺陷
> **全是「本仓自己发明的那一档」**——允许集从上游读出来，不手抄。
> **色号不能放宽到色系**：上游用 `text-red-500`，历史三处缺陷写的是 `text-red-600`
> （`AgentCard` 删除键 / `MemorySettings` 清空键 / `ChannelConnections` 清配置，
> 注释里还留着病历）；按色系比，那三处一处都报不出来。
>
> **反向那一半是算出来的、不是豁免表**（坑 268）：上游多出来的每个固定色，
> 出现点必须落在 `components/landing/**`（落地页双向豁免）或本仓
> `app/components/ui/<同名>` 不存在的 primitive 里——实测 `ui/terminal.tsx`
> 只被 landing 消费、`ai-elements/web-preview.tsx` **上游零消费者**。
>
> ### 三、第二条：**「菜单项渲染成 `<div>`，不要在调用点传 `as="button"`」**
>
> 写在 `DropdownMenuItem.vue` 的注释里，背后是 wave 145 的实测代价：
> `<button>` 的 `width:auto` 解析成 fit-content（`display:flex` 也改不了），
> 线程行 ⋯ 菜单的「删除」项 **React=182 / Vue=81.8**（中文 68），菜单本身两边都是 192。
> 全仓量：126 个 primitive 名字、**0 处违规**——规则今天成立而没人守。
> 做成 `tests/guards/primitive-as-override.test.ts` 把这个 0 钉住。
> **`as-child` 不在判据里**（它不换标签，是把属性合并到调用点已经写出的元素上），
> 而**上游根本没有 `as` 这个出口**（shadcn 只收 `asChild`）——
> 也就是说传 `as` 的调用点，上游同一处一定走的是别的路径。
>
> ### 四、本轮新开的账：**TodoList 的列表体容器层**
>
> 指示器与文字已经对齐，**容器那一层还没有**：上游是定高 `h-28` ＋ 高度过渡 ＋
> `ScrollArea` ＋ 条目 `hover:bg-muted`（`todo-list.tsx:77` + `ai-elements/queue.tsx`），
> 本仓是 `v-if` 整块摘掉 ＋ `space-y-1 p-3`。没有当轮做，理由有两条：
> 它会动到折叠动画（`h-0 → h-28` 的过渡 vs 整块不渲染），
> 而且**这一屏至今没有任何对照锚点**——改完没有跨应用读数可以验。
> **下一轮的起手式**：先给 todos 造一个夹具挂进取样面（现有 `PARITY_SCENARIOS`
> 里没有任何 `values.todos`），量到读数再改。
>
**同一个缺陷可以在取样面上「正负相消」**
>
> 这一轮按第十一轮写下的清单做「形状 + 尺寸被手抄」那一档，扫出的东西比预期重：
> 侧栏那四颗菜单键**把「当前项加粗」抄反了**，而台账**四个锚点全绿**。
>
> ### 一、缺陷本身
>
> 两个应用的侧栏菜单键（新建对话 / Chats / Agents / 定时任务）上游都是
> `<SidebarMenuButton asChild><Link className="text-muted-foreground">`，
> 激活态由 cva 的三条 `data-[active=true]:{bg,text,font-medium}` 给。
> 本仓那四颗是**摊平的裸 `<a>`**，自己写 `data-slot="sidebar-menu-button"` 加一串手抄的类。
> 逐 token 对下来漏掉的是：
>
> | 漏的 | 后果 |
> | --- | --- |
> | `data-[active=true]:font-medium` → 抄成**无条件** `font-medium`（新建对话那颗），另外三颗**干脆没有** | **「当前这一项加粗」在本仓是反的** |
> | `outline-hidden ring-sidebar-ring focus-visible:ring-2` | 四颗都**没有键盘焦点环** |
> | `[&>span:last-child]:truncate` + `overflow-hidden` | 长标题不截断 |
> | `hover:text-sidebar-accent-foreground` / `active:*` | 悬停/按下不变字色 |
> | `transition-[width,height,padding]` / `w-full` / `p-2`（写成 `px-2`） | 过渡与盒子 |
> | 定时任务那颗还少 `data-[active=true]:text-sidebar-accent-foreground` | 激活时字色不变 |
>
> 与 wave 199 的 `ThreadSidebarItem.vue`（「侧栏当前会话不加粗」）**同一个根因、同一份 cva**——
> 那次修的是会话行，这次是它上面那四颗导航键。
>
> ### 二、台账为什么一直是绿的（本轮最值钱的一条）
>
> `sidebar` 场景**已经有两个锚点**落在 `a[href='/workspace/chats']` /
> `a[href='/workspace/agents']` 上，字重档从 wave 140 就在采样，
> 而这两条在基线里是 **0 行**。原因是那个场景停在 `/workspace/chats/new`：
>
> - 新建对话那颗**正好是激活态** → 上游 `font-medium` 生效 = 500，
>   本仓无条件 `font-medium` = 500，**撞上了**；
> - 其余三颗两边都不激活 → 都是 400，**也对上**。
>
> **四个锚点全绿，四颗按钮全抄漏。**
>
> 换一条路径就当场现形：`/workspace/agents/new` 同时踩反两边——
> 新建对话不激活（上游 400 / 本仓 500）、Agents 激活（上游 500 / 本仓 400）。
> 锚点挂到 `agent-create-name-step` 上，**两种语言各 2 行、方向相反、同一个根因**：
>
> ```
> agent-create-name-step/desktop/light/{en-US,zh-CN}  geometry:
>   selector:[data-sidebar='sidebar'] a[href='/workspace/agents']    fontWeight React=500 Vue=400
>   selector:[data-sidebar='sidebar'] a[href='/workspace/chats/new'] fontWeight React=400 Vue=500
> ```
>
> **判据：「锚点全绿」不等于「这一处没问题」，还要问「这一屏是不是恰好把差异藏起来了」。**
> 一个由**状态**决定的差异，在只取样一种状态的屏上可以正负相消。
>
> ### 三、顺手扫出的第二处：修了有锚点的那一支，没锚点的那一支跟着漏
>
> `WorkspaceChannelsList.vue` 的头注释写着「外壳走 ui/sidebar 的四个 primitive，
> 不手抄它们的类串（wave 203）」——而 wave 203 **只换了「已加载」那一支**，
> **loading 那一支原样留着**：三块占位方块手抄 `ui/skeleton`，外面两层各自手抄
> `SidebarGroup` 与 `SidebarGroupLabel`（同样漏掉那 10 个 token）。
>
> 这是**第三次**同一形状（第十轮三颗芯片 → 第十一轮同一文件第四颗 → 本轮 loading 支）。
> **修一处「手抄」时，先问这个组件还有几条分支没有锚点。**
>
> ### 四、做成守卫：`tests/guards/handwritten-primitive-slots.test.ts`
>
> `primitive-marker-classes` 的孪生：那条守**标记类**（`peer/menu-button`），
> 这条守**身份属性**（`data-slot`）。两者答同一个问题——「谁在扮演那颗 primitive」，
> 而侧栏这一片两种方式都用过。
>
> **判据是「不许手写」而不是「必须抄全」**：后者把抄本正当化，然后要求改 primitive
> 的人同时去改所有抄本，而守卫只在**下一次**跑的时候才说他漏了哪份。
> 不许手写则让漂移不可能，**零豁免**，代价为零——写不了 `data-slot` 的地方
> 就是该用 primitive 的地方。
>
> **`data-sidebar` 故意不在判据里**：侧栏外壳（header / content / footer / rail）在
> `ui/sidebar` 里没有 primitive，只能手写，而手写就得带上 `data-sidebar`。
>
> 负向验证 **7 条**（表在 `vue-parity-handoff.md`）。其中一条是**做负向验证时当场
> 补上的尺子洞**：`toContain("<SidebarGroup")` 会被 `<SidebarGroupLabel` 前缀命中，
> 组容器整个删掉都不会响——**尺子自己也要被变异一次**。
>
> ### 五、本轮量过、判「无账」的
>
> | 量的 | 结果 |
> | --- | --- |
> | `ThreadSidebar.vue` 其余 13 处手写 slot 的类串 | **逐字一致**，只有 group-label 那一处漂了 10 个 token（且本仓全部是哑的：标签不可聚焦、无 svg 子节点、收起态走 `v-if`） |
> | 本仓手写、上游 `ui/` 拥有而本仓 `ui/` 没有的 slot | 11 处：侧栏外壳 5 / composer 4 / separator 1 ——各自判过（separator 那处 twMerge 后与上游等价；composer 外壳第九、十轮量过 12 维） |
> | 面包屑（本仓手写、上游走 `ui/breadcrumb`） | twMerge 之后两边等价（`inline-flex` 被调用点的 `hidden` 顶掉） |
> | `ThreadActionsMenu` / `WorkspaceChangesBadge` / `BrowserPanel` 三处形状相近 | 第一处此前判过并写明「没跟的两条为什么不跟」，后两处是通用写法的巧合 |
>

> ## 2026-09-12 第十一轮：**「手抄 primitive」是分布式缺陷——台账只看得见有锚点的那几处**
>
> 第十轮用新加的 `borderRadius` 档抓到 `ProcessingToolStep.vue` 三颗芯片手抄了
> `ui/badge`，当轮修掉。这一轮按既定清单全仓扫同一形状，**结果第一条就打脸**：
>
> ### 一、同一份文件里还有第 4 颗
>
> `ProcessingToolStep.vue` 的 web_search 结果链也是手抄的
> （`bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-xs font-normal`），
> 第十轮没修到它——**不是判据不同，是没有任何锚点落在这一颗上**。
> 上游同一处是 `<ChainOfThoughtSearchResult><a …></ChainOfThoughtSearchResult>`
> （`message-group.tsx:726`），层次与 `web_fetch` 那一支一样。
>
> **这就是「读数只覆盖取样点」那句话的一个具体样本**：
> 台账能证明「这几个点上两边一样」，但**「手抄 primitive」是分布式的**——
> 它长在哪里，哪里就得恰好有个锚点才看得见。
>
> ### 二、扫描面怎么收窄的（否则就要一张几十条的豁免表）
>
> 第一版按「变体色对 + 主题色对」扫，31 处，绝大多数是**主题 token 的正常用法**
> （横幅、toast、面板的 `bg-muted text-muted-foreground` / `bg-popover …`），
> 上游同样直接写。**要豁免表就说明判据没选对**（坑 180）。
>
> 收窄成**只取 `badgeVariants` / `buttonVariants` 里真正声明过的那几对**
> （`bg-primary text-primary-foreground` / `bg-secondary text-secondary-foreground` /
> `bg-destructive text-white`），**31 → 8**。而且那份色对清单是**从两个
> `variants.ts` 里读出来的，不是手抄的**——primitive 改了变体，扫描面自己跟着变。
>
> ### 三、8 处逐条对上游的结果
>
> | 处 | 上游那处是什么 | 判 |
> | --- | --- | --- |
> | `ProcessingToolStep.vue` web_search 链 | `ChainOfThoughtSearchResult`（Badge） | **改**（本轮） |
> | `AgentChat.vue` 「开始对话 / 返回画廊」 | `agents/new/page.tsx:427/436` 两颗 `<Button>` | **改**（本轮） |
> | `HumanInputCard.vue` 选项卡选中态 | `human-input-card.tsx:188` **逐字相同地手写** | 照抄不动 |
> | `ThreadBackgroundTasks.vue` 计数圆点 | `thread-background-tasks.tsx:69` 逐字相同 | 照抄不动 |
> | `ThreadSubagentBatches.vue` 计数圆点 | `thread-subagent-batches.tsx:75` 逐字相同 | 照抄不动 |
> | `SettingsDialog.vue` 导航选中态 | `settings-dialog.tsx:237` 逐字相同 | 照抄不动 |
> | `MarkdownLink.vue` 引用角标 | 上游那一层由 streamdown 自己渲染，没有可对的调用点 | 留，写进清单 |
> | `MarkdownLinkSafetyModal.vue` 主操作 | **上游没有这个组件**（弹窗在 streamdown 包内部） | 留，写进清单 |
> | `pages/__m0/visual.vue` | 视觉基线夹具页，**不是产品面** | 留，写进清单 |
>
> `AgentChat.vue` 那两颗**保留链接语义**（`Button as-child` 套 `NuxtLink`）：
> 点了就跳走的控件不该是按钮——2026-09-11 那一轮刚为此改过 agents 那一屏。
> 手抄那版对着 `buttonVariants` 逐条丢掉的是：`font-medium`、`hover:bg-primary/90`、
> 三条 `focus-visible:*`、`h-9`（写成 `py-2`）、`px-4`（写成 `px-3`）、
> `inline-flex items-center justify-center`、`gap-2`、`whitespace-nowrap`、
> `cursor-pointer`、`transition-all`、`disabled:*` 与 `aria-invalid:*`。
>
> ### 四、做成守卫：`tests/guards/handwritten-variant-colors.test.ts`
>
> `handwritten-button` / `handwritten-input` 的第三个同胞，判据同源、**双向**、零豁免。
> **它补的洞正好是台账补不了的那个**：这条判据不依赖取样点。
> 负向验证两条：把第 4 颗改回手写 → 「没有清单之外的文件」红；
> 把清单里一条处数改错 → 「处数对不上」红。

> ## 2026-09-12 第十轮：**给几何档加 `borderRadius`，第一次跑就抓到一处形状差异**
>
> 第九轮判 `ui/input-group` 不移植时写下了那个结论的边界：
> **几何档不量形状**。这一轮把那一档补上，并立刻用它找到了东西。
>
> ### 一、加之前先过坑 258 那一问
>
> > **有没有一种变异能让它响、而现有的档都不响？**
>
> 答得上来：把一块面板的 `rounded-2xl` 改成 `rounded-md`，
> 盒子的 x/y/宽高一个数都不动、颜色不动、字重不动、命中不动、aria 不动。
> **现有各档一条都不响。** 这一问答不上来就不该加档（`depth` 那一档就是这么被撤掉的）。
>
> 只取 `borderRadius`，**不取 `boxShadow` / `backdropFilter`**：后两者的计算值是
> 颜色 + 多段长度的组合写法，噪声比信号多。真要加，按同一条判据单独论证。
>
> **这把新尺子先量了它自己**（坑 213/186）：`tests/unit/parity/diff-entry.test.ts`
> 新增两条——只改圆角时它响**而其余各档一条都不响**（这就是上面那句判据的机器版本）、
> 圆角相同时不报（四段写法 `8px 8px 0px 0px` 逐字比，不做归一）。
>
> ### 二、第一次整套跑：**5 行，全部同一处**
>
> ```
> artifact-preview   ×3 维    text:/artifact-fixtures/report.html
> artifact-panel-resize ×2 维   borderRadius React=3.35544e+07px Vue=8px
> ```
>
> `3.35544e+07px` 是 Tailwind v4 的 `rounded-full`（`calc(infinity * 1px)`）。
> **噪声 0 行、与别的档重复 0 行**——新增的 5 行是同一处差异在 5 个场景-维度上的投影。
>
> ### 三、根因：又一处「手抄 primitive 的外观」
>
> 探针把两边那个锚点解析到的**元素身份**打出来（别拿「文本对得上」当证据，坑 264）：
>
> ```
> REACT  span[badge] .inline-flex items-center justify-center rounded-full border w-fit … r=3.35544e+07px
> VUE    span        .bg-secondary text-secondary-foreground inline-flex max-w-full rounded-md px-2 py-0.5 … r=8px
> ```
>
> 上游那一族全部走 `ChainOfThoughtSearchResult`
> （`ai-elements/chain-of-thought.tsx:183` = `<Badge variant="secondary"
> className="gap-1 px-2 py-0.5 text-xs font-normal">`）；
> **本仓 `ProcessingToolStep.vue` 手抄了它的外观**，三处。
>
> **本仓是有 `ui/badge` 的，而且它的基类与上游逐字相同**——也就是说这不是「没移植」，
> 是「移植了却没用」。手抄那一版丢掉的东西：`rounded-full`（变成 `rounded-md`）、
> `border`、`w-fit`、`whitespace-nowrap`、`shrink-0`、`gap-1`、
> `items-center justify-center`、`overflow-hidden`、`focus-visible:*` 与
> `aria-invalid:*` 两组状态、`transition-[color,box-shadow]`。
>
> 三处全部换成 `<Badge variant="secondary" class="gap-1 px-2 py-0.5 text-xs font-normal">`。
> `web_fetch` 那一支照抄上游的**层次**：Badge 里套一个 `<a class="cursor-pointer">`，
> 而不是把链接本身当 badge 用（chain-of-thought 那颗 badge 不是控件，链接才是）。
>
> **读数：`artifact-preview` 三维 5 行 → 0 行**，台账回到 159 行。
>
> ### 四、这一轮真正的结论
>
> **一条尺子加对了，会在第一次跑的时候就付清成本。** 这一档新增 5 行、
> 其中噪声 0 行、重复 0 行、真差异 1 处（5 个投影），当轮修完归零。
> 对比 wave 94 的焦点档（17 行里 10 行是描述器噪声），这已经是很干净的一次扩档。

> ## 2026-09-12 第九轮：**`ui/input-group` 判「不移植」——先把它接进取样面，再用读数说话**
>
> backlog 上挂着一笔「本仓没有移植 `ui/input-group`，整块 composer 外壳是手写的」，
> 工单自己写着「**动它之前先确认台账上它现在是 0 行**（也就是说没有可观测差异在
> 推动这次重构，它是结构卫生）」。这一轮照做了，然后**把这句话反过来用**：
> 既然没有读数在推动，那就先**造一个读数**，再决定要不要动。
>
> ### 一、先确认前提（台账上确实是 0 行）
>
> ```
> chat（跑满 12 维）               每维 1 行，全部是 div[scroll-area-viewport]
> agent-chat / sidecar-chat        1 行（scroll-area-viewport / 分栏把手，都判过）
> user-message-plain-text          0
> agent-create-name-step           0
> ```
>
> ### 二、再核实「手写」到底手写了什么
>
> 上游那块是 `ai-elements/prompt-input.tsx` → `ui/input-group.tsx`；
> **但调用点把它改了形**：`input-box.tsx:2265` 传的是
> `bg-background/85 relative z-10 rounded-2xl backdrop-blur-sm transition-all
> duration-300 ease-out *:data-[slot='input-group']:rounded-2xl`
> ——最后那一条把 InputGroup 从 `rounded-md` 顶成 `rounded-2xl`。
>
> 本仓 `ComposerSurface.vue` 逐条对得上：`role="group"`、`data-slot="input-group"`、
> `group/input-group`、`border-input/50`、`bg-white/80`、`dark:bg-background/80`、
> `rounded-2xl`、`backdrop-blur-sm`、`z-10`、`shadow-xs`，以及焦点环那三条
> `has-[[data-slot=input-group-control]:focus-visible]:*`。
> **它是量着抄的，不是另起炉灶**——文件头里还留着 wave 67 那次 15px 位移的实测记录。
>
> ### 三、把它接进取样面（这一轮真正的产出）
>
> `[data-slot="input-group"]` 是**两边共有的结构坐标**（上游 `InputGroup` 写死这个
> `data-slot`，本仓照抄），挂在**跑满 12 维矩阵**的 `chat` 上。
> 用结构坐标而不是可访问名，是第八轮那条教训的直接应用。
>
> **读数：12 个维度零新增行。** 而且这个 0 是**算出来的**——探针实测：
>
> ```
> REACT desktop/light/en-US  matches=1  x=479.5 y=244 576×116 bg=rgba(255,255,255,204)
> VUE   desktop/light/en-US  matches=1  x=479.5 y=244 576×116 bg=rgba(255,255,255,204)
> REACT desktop/dark/en-US   matches=1  bg=rgba(31,31,29,204) fontWeight=300
> VUE   desktop/dark/en-US   matches=1  bg=rgba(31,31,29,204) fontWeight=300
> REACT mobile/dark/zh-CN    matches=1  x=12 y=198 351×116
> VUE   mobile/dark/zh-CN    matches=1  x=12 y=198 351×116
> ```
>
> 每屏只匹配一份、样本非空、**两边逐位相同**。
>
> ### 四、判词：**不移植**，并把边界写清楚
>
> 移植 `ui/input-group` 是一次高流量组件的重写，而**没有任何读数在推动它**；
> 本仓那块外壳有实测依据、有文件头记录，重写只会把那些依据一起扔掉。
> 记忆里那条「不做搬运式移植」说的正是这种情况。
>
> **但这个结论有边界，写下来免得下一轮把它读成「这块已经全对了」**：
> 几何档量的是位置 / 尺寸 / 前景色 / 背景色 / 字号 / 字重 / opacity / 命中 / 伪元素，
> **不量 `border-radius`、`box-shadow`、`backdrop-filter`**。
> 形状类的漂移目前**没有任何机器看得见**。
>
> **翻案判据两条**：① 给几何档加 `borderRadius`
> （变异论证是现成的：把 `rounded-2xl` 改成 `rounded-md`，现有各档一条都不响）；
> ② 上游改了 InputGroup 的语义（那时这块外壳会静默走偏，而 12 维的锚点会先红）。

> ## 2026-09-12 第八轮：**同一条正则在一种语言下匹配两份、在另一种语言下只匹配一份**
>
> 给 `project-detail` 补窄屏这一维（第二个「整页」样本，第一个是第六轮的
> `scheduled-tasks`）。三个维度**全 0 行**——但过程里踩出一个**新形状的锚点陷阱**，
> 值得单独记。
>
> ### 先说为什么要给它加第三个锚点
>
> 这一页原来的两个锚点都是夹具里的**文字**（项目名、会话标题），
> 几何档因此只量得到两个文本节点。而窄屏下最容易出事的是**动作列**
> （`integrations` 那一轮量出来的形状就是一颗按钮把整页撑宽）。
> 于是给页头那颗「新建对话」加了一个锚点。
>
> ### 第一版锚点报出一行，而那一行是假的
>
> ```
> project-detail/desktop/light/en-US   geometry | role:link[/^(New chat|新建对话)$/]
>                                                 fontWeight React=400 Vue=500
> project-detail/desktop/light/zh-CN   0 行
> project-detail/mobile/light/en-US    0 行
> ```
>
> 连跑两次，读数完全一样——**稳定，但仍然是假的**。
> `fontWeight` 不该跟语言或断点有关，这个不对称本身就是线索。
>
> 根因：**`sidebar.newChat` 与 `projects.newChat` 在英文下是同一个串**
> （都是 `New chat`），**中文下不是**（`新对话` vs `新建对话`）。
> 于是那条跨语言正则在 en-US 桌面维度上匹配到**两份**（侧栏一份、页头一份），
> `sampleGeometry` 取 `.first()`，量的是侧栏那颗；zh-CN 只匹配页头这颗；
> mobile 下侧栏是关着的抽屉、也只匹配一份。**三个维度量的不是同一个元素。**
>
> 换成按 href 定位（`a[href*="/workspace/chats/new?project="]`——两边逐字相同的
> 结构坐标，整页只有一处）之后，**三个维度全 0**。
>
> ### 这是 wave 131 那三问的一个新形状
>
> 原来的三问是「它在每个维度上都成立吗、它在这一屏上只有一份吗、
> 不止一份时是不是同一个东西」。这一次踩到的是：
> **「只有一份」这件事本身会随维度变**——因为**跨语言正则把两个不同的词典键
> 在其中一种语言下合并成了同一个匹配**。
>
> **判据补一条**：**跨语言正则锚点，要对每一种语言分别问一次「这一屏上有几份」**。
> 两个不同的 key 在一种语言下撞车，是这个仓库里真实存在的情况
> （`sidebar.newChat` / `projects.newChat` 就是），而它只在那一种语言下现形。
> 更稳的做法是**优先用结构坐标**（href、data-slot），可访问名留给没有结构坐标的场合。

> ## 2026-09-12 第七轮：**台账上最后一条带「先怀疑」的判词结清了**——而它底下是一颗点了会失败的按钮
>
> `chat-thread-init-ordering` 的 3 行 `button "Edit and rerun"` 挂了很多轮，
> backlog 里写着「还剩一种可能没测：上游的 `thread.isLoading` 在 SSE 关掉之前一直为真」
> 以及「先加临时 dump 看读数，别猜」。这一轮照做了，**那个假设被证伪**，
> 真根因在另一个地方。
>
> ### 一、临时探针量到的（两边各往 `document.body.dataset.probe` 写一份，跑完即撤）
>
> ```
> REACT  editButtons=0  isLoading=false  canEdit=true  replayActionBusy=false
>                       latestEditableHumanMessageId=null  hasHandler=true
> VUE    editButtons=1  streaming=false  editableId=values-0
> ```
>
> **上游那四个闸门全是开的**——`isLoading` 是 `false`，不是 backlog 猜的 `true`。
> 唯独 `latestEditableHumanMessageId` 解析成了 `null`。
>
> 再把消息本身打出来，两边的组**逐条相同**，只差一个字段：
>
> | | human#1 | human#2 | assistant |
> | --- | --- | --- | --- |
> | 上游 | `id=null` | **`id=null`** | `id=msg-ai-1` |
> | 本仓 | `id=null` | **`id="values-0"`** | `id=msg-ai-1` |
>
> `getLatestEditableTurn` 两边逐字同源，它要求 human 消息**有 id**
> （`messages.find(m => m.type === "human" && m.id)`）。上游两条都没有 → `null`；
> 本仓第二条有 → 可编辑。
>
> ### 二、`values-0` 从哪来：**两边 POST 的消息都不带 id，差的是 `stream_mode`**
>
> 把两边的 run POST 体打出来，`input.messages` **逐字相同、都没有 `id`**。
> 差在这里：
>
> ```
> 上游 stream_mode: ["messages-tuple","updates","custom"]
> 本仓 stream_mode: ["values","messages-tuple","updates","custom"]
> ```
>
> mock 原样回显 POST 体，于是那条没有 id 的 human 消息出现在 `values` 帧里。
> 本仓的 `reduceValues`（`app/core/agent-deerflow/reducer.ts`）按位置给它编了一个键：
>
> ```ts
> (typeof message.id === "string" && message.id) || `values-${index}`
> ```
>
> **这个键随后就坐在 `AgentMessage.id` 上，与真 id 长得一模一样。**
> 上游没有这条分支，因为它压根不订 `values`。
>
> ### 三、判词：**本仓是坏的**——那颗按钮点下去会失败
>
> 「编辑并重新运行」要把消息 id 交给 `POST /runs/edit-regenerate/prepare`。
> `values-0` 是客户端为了在存储里对齐位置而编的，**服务端解析不了**。
> 也就是说这不是「本仓多画了一颗按钮」，是**本仓画了一颗点了会失败的按钮**。
>
> 修法（只动 `frontend-vue/`）：把前缀与判据收进 reducer 一处导出
> （`SYNTHETIC_VALUES_ID_PREFIX` / `isSyntheticValuesMessageId`），
> 调用点 `MessageList.vue` 用它把这类 id 挡在可编辑之外。
> **判据放在调用点而不是 `getLatestEditableTurn` 里**：那支工具与上游逐字同源，
> 把一条只有本仓才需要的判据塞进去，下一次基类对照就会把两边判成分叉。
> 判据收紧到「前缀 + 纯数字」——只判前缀会把真 id 误挡成不可编辑，
> 而那是一个**静默的功能缺失**（按钮消失，没有任何报错）。
>
> **读数：`chat-thread-init-ordering` 5 行 → 2 行**，剩下的 2 行是早就判过的
> Next 路由播报器那一对。**台账上再没有一条判词里带「先怀疑」。**
>
> 负向验证三条，各红在该红的地方：
>
> | 变异 | 结果 |
> | --- | --- |
> | 拿掉调用点那道闸（保持可编译） | 台账 2 → **5 行**，三行原样回来 |
> | 判据永远返回 false | 「判据认得出编出来的键」红 |
> | 判据放松成只判前缀 | 「判据不把真 id 误判成编出来的」红 |
>
> **一条留给下一轮的事实**：`message-adapt.ts` 的文件头写着
> 「13 个 checkpoint fixture 的 516 条消息**全部**带 id」——也就是说真 Gateway
> 的 `values` 里不该出现没有 id 的消息，这条位置键是给病态输入兜底的。
> 本轮这个样本来自 mock 回显自己的 POST 体。**修它仍然是对的**
> （一个点了会失败的按钮不该画出来），但别把它读成「生产上天天发生」。

> ## 2026-09-12 第六轮：**这一轮的货是一条否定结论和一次判词订正**
>
> 按第五轮立的新判据（**「台账 0 行」先问「夹具把某一支喂空了吗」**）把
> `scenarios.ts` 全量扫了一遍：剥掉注释之后 **21 处空数组 / 空对象**，逐条看过——
> **除了第五轮已修的 `channels`，没有第二处是缺口**：
> `agents-feature-disabled` 的 `agents: []` 是那一页的正题、
> `{ pattern: "**/api/agents", delayMs: 15_000, json: [] }` 与 `{ skills: [] }`
> 是「还在转」那两支、`scheduled-tasks` 的 `threads: []` 是别的场景在管的面、
> 其余是消息结构里的 `tool_calls` / `metadata` 这类字段。
> **这条判据的存量到此见底**，下一轮别再重扫（写下来就是为了这个）。
>
> ### `scheduled-tasks` 补两维：窄屏与深色都**零布局差异**
>
> 这一页是本仓表单最密的一屏（预设 / 时区 / cron / 上下文模式四组控件 + 任务列表 +
> 运行历史），而**窄屏取样此前一个「整页」样本都没有**——非 desktop 的只有 `chat`、
> `artifact-preview`、`thread-list-pin#mobile-drawer`、`ui-polish-mobile` 与
> `integrations`，后者是**对话框**里的叠放。
>
> 结果：`mobile` 与 `dark` 两维**几何与 aria 各零行**。这是一条有价值的否定结论
> ——不是「没查出东西」，是**从现在起有机器守着这一页在 375px 与深色下的排布**。
> 深色那一维盯的是 `load-failed` 那支真的画出来的错误
> （两边都是 `text-destructive`，浅色下与 `red-600` 同值、看不出谁用的是 token）。
>
> ### 但它顺手推翻了一句判词
>
> 新维度报出来的 12 行全部属于两条判过的账，其中一条的**支撑理由是错的**：
> 2026-09-11 判 `thread-list-pin#mobile-drawer` 那两行时写了一句
> 「本仓做的网络工作严格更少」——**那句话只在抽屉被打开过时成立**。
> 抽屉没打开时（手机上的常态）方向相反：上游那棵子树没挂载、一次请求都不发，
> 本仓照发三次（`channels/providers` / `features` / `threads/search`）。
> **每打开一个工作区页面，手机上多三次往返，为的是一个没打开的抽屉。**
>
> 判词就地订正为「**两种取舍**：本仓预取、上游按需」，仍然判不跟，
> 但理由换掉了那句被证伪的话。订正写在本文件里 2026-09-11 那一条的原文下面
> （按「归因可以被自己推翻，但要就地标注、不要抹掉」的规矩）。

> ## 2026-09-12 第五轮：**上游的用户解绑不了自己的 IM 账号**——两条存量挂账都结了
>
> 上一轮挂的两条（`icon-parity` 的 `Unplug`、`asset-budget` 四条预算全超）这一轮都处理完了。
> **第一条不是图标问题，顺着它挖出一处真缺陷。**
>
> ### 一、`channels` 的「已连接」那一支**从来没被取样过**
>
> `icon-parity` 报「`Unplug` 只有 Vue 用」，回源码看：本仓的渠道设置页给每一条
> connection 画一颗 Disconnect，上游那一页没有任何 per-connection 动作。
> **而台账对 `channels` 报 0 行**——因为场景喂的是 `{ connections: [] }`，
> 「已连接」那一整块两个应用都没渲染过。**「量不出差异」在这里的准确含义是「没取样」。**
>
> 给 `channels` 加一个 `settings-panel-connected` 终态（喂一条真的 connection，
> 锚点用夹具给的账号名 `parity-account`——不进词典、两种语言逐字相同）。
> **一比就是 22 行**（每语言 11 行）。
>
> ### 二、判词：**上游是坏的，两边同改**
>
> 逐条问过 wave 73 那条判据「这处不改，React 自己是不是也是坏的？」：
>
> - 后端有 `DELETE /api/channels/connections/{id}`（`channel_connections.py:554`，204）；
> - 上游**已经写好了** `useDisconnectChannelConnection`（`core/channels/hooks.ts:107`），
>   **零消费者**——`grep` 全仓只有定义处；
> - 上游那一页唯一一颗「断开」是**管理员限定、删的是整个部署的 provider 运行时配置**
>   （2026-09-11 那一轮刚改过它的名字与门控）。
>
> **也就是说：用户能把自己的 IM 账号绑上去，却没有任何办法解绑。** 这是缺陷，不是风格。
> 修法是把已有的 hook 接上一颗键（outline / sm / `UnplugIcon` / 在飞时转圈 /
> 可访问名念出账号名），与本仓那一颗同形；**多账号列表那个概念不跟过来**——
> 上游这一行本来就只认一条 connection（`connectionByProvider`），
> 引进列表属于「引入新概念」，越过了「只做小改」的边界。
> 两边词典各补 `channels.disconnect` / `channels.disconnectAccount`。
>
> **读数：22 → 17 行**（Disconnect 那一行连同它带来的 `tabbablesOnlyVue` 与
> `width Δ-133.3` 一起清掉；`width` 从 Δ-133.3 收到 Δ-6.7）。
> **`icon-parity` 因此从「1 处待核」回到 0 处待核**——是从根因清的，不是加豁免。
>
> **剩下的 17 行逐条有判词**（写在场景注释里）：本仓独有的多账号绑定块
> （「已连接账号」标题 + 账号行 + 主操作键的「添加账号」档）、以及它带来的两行几何投影。
> **那个账号名锚点在两边落在结构不同的节点上**（上游是 `Connected as …` 那句描述，
> 本仓是账号行里的名字），所以它的几何行量的不是同一个东西——留着锚点是因为
> 它是唯一能证明「已连接那一支真的渲染出来了」的夹具串。
> **翻案判据**：上游哪天自己长出 per-provider 的连接列表。
>
> **一次不算数的负向验证**（记下来免得下一轮重踩）：第一版变异把渲染条件写成
> `{false && connection && …}`，**Next 构建直接失败**，报出来是
> `Process from config.webServer was not able to start`——那不是「用例红了」，
> 是用例根本没跑（wave 69 那条「变异必须保持文件可编译」）。
> 换成把条件反过来（`status === "revoked"`）才拿到真红：
> 失败点精确停在 `expect(disconnect).toBeVisible()`。
>
> ### 三、`asset-budget`：查清楚了，是存量，按这份文件自己的先例重定
>
> 抬数字之前把该问的都问了，逐条写在 `scripts/asset-budget.mjs` 的注释里：
>
> 1. **不是重复打包**：Reka 的内部字面量 `dismissableLayer.pointerDownOutside`、
>    `focusScope.autoFocusOnMount` 各只出现在 1 个 chunk 里；
> 2. **用户下载的字节没涨**：`route-payload.spec.ts` 5 条全绿，三条路由都在预算内，
>    重量级渲染器仍不在关键路径上；
> 3. **涨的是「带这个名字的 chunk 从 10 个变成 20 个」**——这一格按 chunk 名字归属字节，
>    判据是「chunk 里任意一个模块 id 命中 `reka-ui|splitpanes`」，
>    而 2026-09-11 那一轮把手写行换成 `ui/item`、手搓模态换成 `ui/dialog`、
>    手写 `<input>` 换成 `ui/input`、搬来 Tabs variant——**每一处都让又一个产品 chunk
>    碰到 Reka**；再加上 2026-09-10 合上游带进来的新面；
> 4. **`maxRaw` 那一个根本不是 Reka 的读数**：318,499 那个 chunk 里 `artifact` 出现 72 次、
>    `sidecar` 71 次、`splitpanes` 只有 1 次——它是工作区那块产品代码，
>    只因为含着 splitpanes 才叫这个名字。
>
> **为什么红了这么久没人知道**：它不在 `verify` 里，文件头写着「CI 的独立一步」
> ——而这条分支三百多个提交**从来没推过，CI 一次都没跑过**。
> 线索 194 的又一例：一条只活在 CI 里、而 CI 永远跑不到的门禁等于不存在。

> ## 2026-09-12 收工时发现两条门禁**一直红着**，都不是这一轮造成的 —— **两条都在第五轮结清了，见上一条**
>
> 这一轮把九条门禁逐条真跑了一遍（上一轮的读数块写着两条 exit 0）。**两条是红的**，
> 而且都能证明与本轮改动无关。**记在这里是因为「一条长期红着又没人看的门禁等于不存在」。**
>
> ### 一、`icon-parity`：`ChevronLeft` 的豁免过期了（**已修**）+ `Unplug` 只有 Vue 用（**开着**）
>
> 门禁 `exit 1` 的那一半是**过期豁免**：`VERIFIED` 里 `ChevronLeft` 的理由写的是
> 「上游 `ai-elements/message.tsx` 的 `MessageBranchPrevious`，`MessageBranch*` 零消费者」
> ——那是 wave 75 的事实。现在**两边都在用**它（`artifact-table-preview.tsx` 与
> `ArtifactTablePreview.vue` 的翻页键），于是它根本不会再进「只有一边用」那张表，
> 这条豁免是死配置。按 stale 提示回去看过一遍、删掉，门禁回到 exit 0。
>
> **剩下的 1 处待核是真的**：`Unplug` **只有 Vue 用**。
> 本仓 `ChannelConnections.vue:459` 给**每一条 connection** 画了一颗「Disconnect」
> （`Unplug` 图标 + `channels.disconnect` / `disconnectAccount` 两条词条），
> 而上游那一页**没有任何 per-connection 动作**——它只在 `ItemDescription` 里写一句
> `connectedAs(...)`，动作列只有 Modify / Connect /（管理员）删 provider 配置。
> 上游词典里也**没有** `disconnect` / `disconnectAccount` 这两条（grep 过）。
>
> **它是 2026-09-11 那一轮之后才现形的**：在 `0f97c803` 之前上游也用 `UnplugIcon`
> （画在 provider 级那颗「Disconnect」上），两边的图标集合因此**恰好**相交；
> 那一轮把上游那颗键改成「删 provider 配置」并去掉图标之后，巧合结束。
> **也就是说这处 Vue 独有的产品面一直都在，只是此前被一个巧合盖住了。**
>
> **下一轮要判的是产品面的有无，不是图标**：按双向规则要么两边同加
> （per-connection 撤销是个真能力：一个账号连错了，今天上游只能删掉整个 provider 配置），
> 要么删掉本仓这一颗。**翻案判据**：上游哪天自己加了 per-connection 动作。
>
> ### 二、`asset-budget` 四条预算全超（**开着，且不是这一轮**）
>
> ```
> - vendor-ui.totalRaw:      740601 > 683000
> - vendor-ui.totalGzip:     223015 > 205000
> - vendor-ui.maxRaw:        318499 > 305000
> - all-client-js.totalGzip: 3415750 > 3400000
> ```
>
> **证过因果**：把本轮动过的三份 `app/` 文件换回 HEAD 版本重新构建再量一次，
> 四条照样超，读数只差 **16 字节**（740585 / 223012 / 318490 / 3415736）——
> 本轮那几个 Tailwind class 与注释在 JS 侧根本不计。
> **所以这是存量**，最可能来自 2026-09-10 那次上游合并（Projects 侧栏段、CSV 预览、
> 新 features 调用方都进来了）。
>
> **不要顺手抬数字**：`route-payload` 那条「抬到实测值以上」的做法有前提
> （量的是用户真下载了多少、而且要写清抬了多少）；这四条是**增量告警**，
> 抬之前先答出「哪一次改动让 vendor-ui 涨了 57 KiB」。
> 建议的查法：`git log --oneline` 挑几个点，各跑一次 `make asset-budget` 二分。
> **翻案判据**：查清增量来源之后，要么拆包、要么抬预算并在 `$measured` 里写明原因。

> ## 2026-09-12 窄屏那两簇结清：**上一轮排除掉的第四条假设是对的，它只是没生效**
>
> `integrations#change-app` 与 `#permission-request` 各 11 行 → **各 2 行**
> （剩下的 2 行是 `div[scroll-area-viewport]` 那笔老账 + 它在 `tabOrder` 上的投影）。
> `integrations` 全场景 **86 → 68**；台账 **154 → 137 唯一行**。
>
> **先记一条方法上的翻案**，因为它比结论值钱：backlog 里那张「四条死路」表的第四条写着
>
> | Radix 的 `display:table` 撑宽了面板 | **测了，无效**：给设置面板的 ScrollArea 加 `[&>div]:block` 覆盖掉它，读数 86 → 86，一行没动 |
>
> **这条假设是对的，那次实验是假阴性。** Radix 把 `min-width:100%; display:table`
> 写成**内联样式**（`@radix-ui/react-scroll-area@1.2.10` 的 `dist/index.mjs:130`），
> 而 Tailwind 的 `[&>div]:block` 生成的是一条普通 CSS 规则——**内联样式赢**。
> 那个变异从来没有生效过，于是「读数一行没动」这件事什么都没有证明。
> **这是「探针拿不到东西时先问『我这一步真的生效了吗』」的又一例**，
> 只不过这次被骗的是一条**否定**结论：否定结论同样要先证明变异生效。
>
> **父链量出来的读数**（375×812，`change-app` 终态，`App ID` 输入往上逐层）：
>
> | 层 | React | Vue |
> | --- | --- | --- |
> | `div.grid`（对话框主栅格） | w=293 client=293 **scroll=318** | w=293 client=293 scroll=293 |
> | `[data-slot=scroll-area]` | **318.2**（比格子宽 25.2） | 293 |
> | viewport 里那层 | `min-width:100%; display:table` → 316.2 | 普通 block → 291 |
> | `[data-slot=card]` | 268.2（scroll 266） | 243（**scroll 264**） |
> | `role:textbox[App ID]` | 192.2 | 167 |
>
> **两边都是坏的，只是坏法不同**：上游让 shrink-to-fit 把整个面板撑出栅格格子
> （右边那 25px 吃掉对话框的右内边距），本仓把内容裁掉。
> **台账只报得出「宽度不一样」，报不出「这一块本身对不对」**——两种坏法各自自洽。
>
> **真正的根因是内边距在窄屏下没有降档。** 逐层量 min-content（两边逐值相同）：
>
> ```
> card 268.2 · card-content 266.2 · box「Authorization scope」218.2 · box「Switch to a different Lark app」217.1
> button「Re-register in browser」191.1   ← 撑宽面板的就是它
> p「…Examples: calendar:calendar.event:read」192.2
> ```
>
> 而 375px 屏上给到的内容列只有 **167px**：对话框 343 → 面板 `p-6` → 这一页独有的
> Card `px-6` → 状态盒 `p-3`，三层内边距在一块 375px 的屏上吃掉 **208px**。
> 没有任何内边距方案能把一颗 191px 的按钮塞进 167px，**这不是一行一行修得完的表象**。
>
> **修法（两边同改）**：面板 `p-6` → `p-4 sm:p-6`，集成页 Card 的 header/content
> `px-6` → `px-4 sm:px-6`。`sm` 以上逐字不变，所以桌面维度与视觉基线一格没动。
> 修完两边内容列都是 **199px**，卡片 min-content 252.2 ≤ 259，全链零溢出。
>
> **两边各钉一条用例**（这是 wave 88 那条「接上新表面之后要另问一句『这一块本身对不对』」
> 的兑现）：375px 下断言 `panelOverflow == 0 && cardOverflow == 0`。
> 两个读数缺一不可——**上游那种坏法只让 `panelOverflow` 响，本仓那种只让 `cardOverflow` 响**。
> 负向验证 2×2 逐条做过：
>
> | 变异 | React | Vue |
> | --- | --- | --- |
> | 只还原面板内边距 | `panelOverflow 9 / cardOverflow 6` 红 | `cardOverflow 15` 红 |
> | 只还原 Card 内边距 | `panelOverflow 9` 红 | `cardOverflow 7` 红 |
>
> 两处改动各自承重，**没有一处是顺手加的**。
>
> ## 2026-09-12 给 diff 三档挂上锚点——**当场量出一处 4px，而且它一直在**
>
> 上一轮在本仓补上上游那三个 `dark:text-*-300`（diff 的增/删/hunk 三档）时，
> **台账一行都没反应**。原因不是修对了，是**那一块根本没有锚点**：
> `workspace-changes#changes-panel` 整块面板此前只有一个 heading 锚点。
>
> 这一轮给三档各挂一个锚点（文本取自夹具里的 diff：`+Ready` / `-Draft` / hunk 头），
> 并按 `DARK_DIMENSION` 的纪律给这个场景补一维 dark。**结果两件事**：
>
> 1. **颜色两边逐值相同**，深色下三档都正确翻到 `*-300`（探针打过四组读数：
>    `+Ready` 浅色 `rgba(0,122,85)` → 深色 `rgba(94,233,181)`）。
>    上一轮那处修法确认成立，**而且从现在起有机器守着**。
> 2. **当场报出 9 行 `y Δ4`**（三行 diff × 三个维度）。逐层量下去，分岔在
>    面板正文那一层：上游 `px-5 py-4`（padTop 16），本仓写的是 `p-5`（padTop 20）。
>    **这 4px 把面板里每一行都往下推**，而在挂锚点之前唯一的锚点在 header 里、量不到它。
>    本仓改成 `px-5 py-4`（上游没坏，照抄），9 行归零。
>
> **锚点自己也要有人守。** 锚点一旦指不到东西，两边都记 `null`、`diffGeometry` 直接跳过
> ——台账 0 行、没有任何用例会红（线索 131 的形状）。新增
> `tests/unit/parity/workspace-diff-anchors.test.ts`：每个文本锚点必须**恰好**命中夹具
> diff 里的一行，且 addition / deletion / hunk 三档**各被盖住一次**（归类走产品代码自己的
> `getWorkspaceChangeLineClass`，不重写一份）。**判据不是「有三个锚点」**——那只是把一个
> 数字写死在两处。两处变异都红：改掉夹具里那一行 → 2 条红；拿掉 hunk 锚点 → 1 条红。
>
> 顺带把同一份文件里最后一处 class 分叉对齐：`SheetContent` 上游是
> `sm:max-w-[900px]`、本仓写的是 `sm:max-w-none`。**今天两者渲染一模一样**
> （宽度本来就是 `min(92vw,900px)`，封顶封在同一个数上），**读数零变化**——
> 留下它的理由不是量出来的，是两个 token 语义不同，上游哪天动了那个 `w-[...]`，
> `max-w-none` 会安静地跟着走偏。这一条按「量不出效果的改动」的规矩**如实写在这里**。

> ## 2026-09-11 重命名之后焦点掉回文档顶部——**两个应用都是，而且是新加的取样步骤逼出来的**
>
> 台账上 `thread-title-sync` 的 `focus` 行**一轮有一轮没有、方向还会翻**
> （记过 `React=body Vue=button "更多"`，这次量到 `React=button "More" Vue=body`）。
> 原来的判词是「取样点不稳」，处理办法是加一条 `hidden: dialog[Rename]`。
> **那个判词只对了一半**：取样点确实不稳，但它盖住的是一条真缺陷。
>
> 把场景最后一步换成**「等到有一颗按钮拿到焦点」**（`visible: button:focus`）之后，
> 抖动消失了，两边先后**稳定超时**——先是本仓，修完本仓换成上游。
> 然后各写一个临时 e2e 探针读 `document.activeElement`，量到的是同一件事：
>
> | | 修之前 | 修之后 |
> | --- | --- | --- |
> | 本仓 | `body`（1.3 秒后仍是） | `button "More"` |
> | 上游 | `body`（1.3 秒后仍是） | `button "More"` |
>
> **根因两边同源**：重命名对话框**没有 `DialogTrigger`**（从 ⋯ 菜单里选「重命名」才开）。
> reka 的 `close-auto-focus` 默认还给 trigger——没有 trigger 就什么都不做；
> Radix 的 FocusScope 存的是「打开前谁有焦点」，而**打开那一刻焦点还在即将卸载的菜单里**
> （探针量到点开 ⋯ 之后焦点落在 `div[role=menu]` 上），于是它也还不回去。
> 键盘用户改完标题掉回文档顶部，要从头 Tab 一遍。
>
> **修法：归还给那颗 ⋯ 键，不是「打开前谁有焦点」。** 探针同时量到那颗键在重命名之后
> **仍在 DOM 里、仍连着、`tabIndex=0`**，所以它是稳的目标。本仓按线程 id 现查
> （对话框由上层持有，中继链有 5 层，穿元素引用太吵，而且引用跨不过重渲染）；
> 上游那一侧对话框就在行组件里，直接用 `ref`。
>
> **两次没修好的尝试，写在代码注释里**（都是猜的，都被实测推翻）：
> ① 在 `open-auto-focus` 那一拍存下当时的焦点——菜单关闭与对话框挂载在同一拍，
> 谁先谁后由组件更新顺序决定；② 让 ⋯ 菜单先把焦点交回触发器再报事件——
> 探针显示那句 `focus()` 随后就被对话框接管，**量不出效果，所以那一版撤掉了**。
>
> **方法上的一条**：`visible: button:focus` 这种「等到某个不变量成立」的步骤，
> 比「等某个元素消失」强——后者只能等到中间态，前者等到的是终态。
> 它的代价是**真有缺陷时会硬红而不是悄悄漂移**，这正是要的。
>
> ## 2026-09-11 那颗够不着的开关：**根因在 Radix 的 ScrollArea，不在行里**
>
> **先记两次错判**，因为它们各自省下的时间比结论本身多：
>
> 1. **误读 `hit=off-screen`。** 我把 `integrations#change-app` 上
>    `role:button[Re-register in browser] hit Vue=off-screen` 也读成「本仓那颗跑出视口」。
>    **不对**：`hit` 用的是**探针那一刻的视口矩形**（`capture.ts:392`，
>    `cx/cy` 取自 `getBoundingClientRect()`，超出 `innerWidth/innerHeight` 就记
>    `off-screen`），**竖直滚出去也算**。那一行的 `x` 两边相同、只有 `y` 差 274.9——
>    它在 y≈3250，375×812 的视口里本来就看不到。
>    **判据**：`hit=off-screen` 只有在同一行的 `x` 也超出视口宽度时才读成「横向够不着」。
> 2. **根因猜成了 `min-w-0`。** 六处 `ItemContent` 补上 `min-w-0` 之后**读数一行没动**
>    （88 → 88，开关还在 x=395.5）。那六处留着（与上游
>    `channels-settings-page.tsx:187` 一致，本身是对的），但它不是这条的根因。
>
> **真根因**：Radix 的 ScrollArea 把子节点包进
> `<div style="min-width:100%; display:table">`（`@radix-ui/react-scroll-area@1.2.10`
> 的 `dist/index.mjs:130`），而 **`display:table` 取的是「收缩到适合」的宽度**——
> 放不下的一行**不会溢出被裁掉，而是把整个面板撑得比对话框还宽**，
> 下面每一行都跟着按那个宽度排。**reka 的 viewport 没有这层包装**，
> 内容被约束在 100%，所以同样的 markup 只有上游那一侧坏。
>
> 撑宽它的是技能页的 header：`flex justify-between` 里左边 Tabs、右边两颗键
> （安装 .skill / 创建技能），375px 下并排放不下。两边同改成
> `flex flex-wrap justify-between gap-2`。
>
> **实测：`integrations#skills/mobile` 4 → 2 行**，`x Δ-135.5` 与 `hit React=off-screen`
> 双双消失；桌面维度一行没动（总数 88 → 86，正好是那两行）。
>
> **还开着的两簇**（工单在 backlog）：`integrations#change-app` 11 行与
> `permission-request` 11 行。后者三颗权限芯片两边折行点不同
> （React 的 Docs 在 x=104、Drive 在 169.6 同一行；本仓 Docs 在 211、Drive 换行到 104），
> 而且**两边的 `hit` 都不是 `self`**（React 命中 span/span/button，本仓命中
> div/div(dialog)/p）——那说明芯片中心点上盖着别的东西，**两边盖的还不是同一个**。
> 这一条需要探针，别接着猜。
>
> ## 2026-09-11 窄屏第一次进取样面：**上游有一颗够不着的控件**
>
> 122 个场景-维度里 **110 个是 desktop**；非 desktop 的只有 `chat`（跑满矩阵）、
> `thread-list-pin#mobile-drawer` 与 `ui-polish-mobile` 三个。
> 而设置对话框在上游是 `md:grid-cols-[220px_minmax(0,1fr)]`——**窄屏下导航与内容要叠起来**，
> 两个应用各写各的，**没有任何机器看过那一叠**。
>
> 给 `integrations` 加一维 `mobile/light/en-US`（375×812）。**当场量出两个真缺陷**：
>
> | 行 | 读数 | 说明 |
> | --- | --- | --- |
> | `integrations#skills` | `role:switch[review] x React=395.5 Vue=260`、**`hit React=off-screen`** | **上游的技能开关在 375px 下横向跑出了视口**：x=395.5 > 375（x 是把祖先滚动加回去的坐标，而这条链上没有横向滚动容器，所以它就是视口 x），`hit` 也确认拿不到指针。手机上点不到那颗开关。 |
>
> **一条自己立刻推翻的判断，留在这里免得下一轮照着错的查**：我最初把
> `integrations#change-app` 的 `role:button[Re-register in browser] hit Vue=off-screen`
> 也读成了「本仓那颗跑出视口」。**不对。** 那一行的 `x` 两边相同（没进 diff），
> 只有 `y` 差 274.9；而 `hit` 用的是**探针那一刻的视口矩形**
> （`capture.ts:392`：`cx/cy` 取自 `getBoundingClientRect()`，超出 `innerWidth/innerHeight`
> 就记 `off-screen`），**竖直方向滚出去也算**。那颗按钮在 y≈3250 处，
> 375×812 的视口里本来就看不到——它是「内容更高、于是被滚出去了」的结果，
> 不是一个够不着的控件。**判据**：`hit=off-screen` 只有在同一行的 `x` 也超出视口宽度时
> 才能读成「横向够不着」；只有 `y` 不同时，它是位移的投影。
>
> 另外 `integrations#permission-request` 上三颗权限芯片（Calendar / Docs / Drive）
> 的 x/y 与命中目标两边都不一样（`Docs` 的 x 差 107、`Drive` 差 -65.6，
> 命中目标分别落在 `span` / `div(dialog)` / `button` / `p` 上）——窄屏下那一排的折行方式不同。
> 其余的 `y Δ239~275` 是上面这些差异的累积位移。
>
> **这一维带进来的行全部接受进基线，判词是「已确认是缺陷，工单在下面这一条」**，
> 而不是「不跟」。理由：已知坏掉的地方**被机器看着**，比不看着强——
> 再坏一点门禁就会红。`PARITY_ACCEPT_GROW=1` 的正当用法里，
> 「新看见了」与「已确认是缺陷且开了票」都算（判据见 backlog 的「审新增行的四类」）。
>
> **工单**：窄屏下的设置对话框要逐屏对一遍——先把两颗够不着的控件修掉
> （两侧各一颗，都是 `ItemActions` 在窄屏下被挤出容器），再看权限芯片那一排的折行。
> 修的时候记得：**`Item` 是 `flex-wrap` 的，挤出去通常是因为 `ItemContent` 少了
> `min-w-0`**——同一条在 `channels` 那一轮已经踩过（上游那一行写的就是
> `<ItemContent className="min-w-0">`，而技能行与 MCP 行都没写）。
>
> ## 2026-09-11 给错误态补一个 dark 维度——**并且用它来守上一笔**
>
> 上一笔（错误红两套）暴露的不是一处缺陷，是**取样面的一个洞**：对照工厂的维度机制
> 一直支持 `dark`（`ParityTheme` 就有这一档），但**只有 `chat` 一个场景跑满 12 维矩阵**，
> 其余都只跑 `desktop/light/{en-US,zh-CN}`。红全长在设置页与错误态上，
> 那些场景一个都没开 dark——所以两个应用在深色主题下长什么样，**没有任何机器看过**。
>
> 给 `integrations` 加一维 `desktop/dark/en-US`（它有两支错误态：
> `load-failed` 与 `skills-load-failed`，是这类差异的高发区）。
> 与 `ZH_DIMENSION` 同一条纪律：**一个场景补一维就够**，主题轴与语言/断点轴正交。
>
> **实测结果：新维度 17 行，全部是两条判过的账的投影，零条新差异。**
> 14 行是 `div[scroll-area-viewport]` + 它的 `tabOrder` 投影（7 个状态各 2 行），
> 3 行是 `retry: false`。也就是说上一笔的修法在深色主题下确实成立，
> 而且**从现在起有机器守着它**。
>
> 台账因此 **118 → 135**，走的是 `PARITY_ACCEPT_GROW=1`——这是那道逃生口的正当用法：
> 新增行**不是新坏了**，是新看见了，而且逐条都能指回已有判词。
>
> ## 2026-09-11 错误的红有两套，深色主题下其中一套是坏的
>
> 本仓 36 处 `red-*`、上游 12 处，**两边都在混用固定红与 `destructive` token**。
> 这不是风格问题：`--destructive` 在浅色是 `oklch(0.577 0.245 27.325)`
> ——**与 `red-600` 同一个值**，所以浅色下看不出差别；深色主题下它变成
> `oklch(0.704 0.191 22.216)`（提亮），而 `text-red-600` 原地不动。
> 也就是说**这套差异只在深色主题下现形**。对照工厂的维度机制本来就支持 `dark`
> （`ParityTheme` 有这一档），但**只有 `chat` 一个场景跑满 12 维矩阵**，
> 其余场景都只跑 `desktop/light/{en-US,zh-CN}`——而红色全长在设置页与错误态上，
> 那些场景一个都没开 dark。**台账因此报不出它**，这也是「台账之外还有活」的样本。
> 下一轮可以把带错误态的几个场景单独加一个 dark 维度（代价是每加一维就多一遍
> 两侧取样）。
>
> 逐条回上游对之后分三类：
>
> - **错误文案**（表单错误、取数失败、行内 alert）：两边一律 `text-destructive`。
>   共 23 处（本仓 18、上游 5）。此前本仓内部就有两种写法（`text-red-500` 与
>   `text-red-600`），三处注释分别点过它的名（`AgentCard.vue` ③、
>   `ChannelConnections.vue` 的动作条、`MemorySettings.vue` 的清空键）。
> - **浅红底的提示盒**（`bg-red-50 … text-red-700`，本仓 6 处、上游 0 处）：
>   `bg-red-50` 在深色主题下是一块近白的盒子压在深色页面上，里面还配深红字。
>   换成 `bg-destructive/10 text-destructive`——与上游 diff 行那套
>   `bg-red-500/10` 同一种「半透明底 + token 字」的做法。
> - **语义色照抄不动**：diff 的增删（emerald/red/sky）、subtask 的 failed 状态、
>   终端窗口的三颗圆点。上游用的就是固定档，它们表达的是「删除行」而不是「出错了」。
>
> **顺带修掉本仓一处真缺陷**：diff 行的三档配色本仓**一个 `dark:` 变体都没有**
> （上游 `workspace-change-panel.tsx:235` 三档各有一个 `dark:text-*-300`）。
> 深色主题下底是那层 `/10` 的半透明色、字仍然是 700 档——**深字压深底**，
> diff 基本读不出来。
>
> ## 2026-09-11 `mcp-settings` 的 `width Δ8`：两颗图标键差了一档尺寸
>
> `text:Local tools width React=654 Vue=662 Δ8`。整行的结构两边逐层相同
> （`Item variant="outline"` + ItemContent/ItemTitle/ItemDescription/ItemActions），
> 差的是动作列里那两颗图标键：上游 `size="icon"`（36px），本仓 `size="icon-sm"`（32px）。
> 两颗一共窄 8px，动作列窄了描述列就宽了 8px——**`Δ8` 就是这么来的**。
> 改成与上游同一档。
>
> **顺带修掉上游的一处 WCAG 4.1.2**：同一行里那颗 `Switch` 上游**没有任何可访问名**
> （本仓一直有 `:aria-label="String(name)"`），读屏器只念得出「switch」，
> 说不出是哪一个 server 的。两边同改。
>
> ## 2026-09-11 台账剩下的每一行都判掉了（收口）
>
> 到这一轮为止，台账 **330 → 108 行**。把判过的账刨掉之后**真正还开着的只有 19 行**，
> 逐条列在这里——目标是让「台账还剩多少行」这个数字**不再需要解释**。
> **写完这一节时，台账上没有任何一行是「还没判」的。**
> （同一天稍后开了 dark 与 mobile 两维，台账因此涨回去了——**新进来的每一行同样都有判词**，
> 其中窄屏那一批的判词是「已确认是缺陷，工单在上面那一条」。见本文件更靠前的两节。）
>
> ### 一条差异、47 行投影：`div[scroll-area-viewport]`
>
> wave 98 判过「不跟」：上游把欢迎建议行套在 `ai-elements/suggestion` 的
> `Suggestions` 里，那是一个横向 `ScrollBar` 写着 `className="hidden"` 的 ScrollArea，
> **永远不会真滚动**，只多一个键盘停靠点；本仓用 `flex-wrap` 的普通容器，什么都没少。
> 2026-09-11 复核：上游那个 `hidden` 还在，`Suggestions` 里那层 flex 容器
> **两边都是 `flex-wrap`**（所以上游那个 ScrollArea 也确实不会横向滚）。原判有效。
>
> **它占了台账的 43%**（47 行 `tabbablesOnlyReact` + 21 行 `tabOrder` 投影，
> 分布在 47 个以聊天页为底的场景上——设置对话框是盖在聊天页上的，
> 底下那一行建议芯片一直在 DOM 里）。读台账数字时先把这一条减掉。
>
> ### 三条请求层的账（22 行）
>
> - `retry: false`（wave 128，18 行）：同一次 500，上游发 3 次、本仓 1 次。
>   TanStack 默认重试**不分错误码**。
> - `thread-list-pin#mobile-drawer` 的 2 行（2026-09-11 判）：查询挂在抽屉里还是外面。
> - `thread-title-sync` 的 2 行：重命名之后上游重取、本仓靠乐观缓存。
>
> ### 真正还开着的 19 行
>
> | 行 | 判词 |
> | --- | --- |
> | `thread-history-mermaid` ×16（zh-CN）：`Zoom in` / `Zoom out` / `Reset zoom and pan` / `img "Mermaid chart"` | **不跟**：写死在 streamdown 2.5.0 的产物里，不在 `StreamdownTranslations` 的 29 个 key 之内。本仓的 mermaid 是自己实现的，翻译是对的。**翻案判据**：streamdown 把这 4 条加进 `StreamdownTranslations`，或上游换成自己的 mermaid 渲染。 |
> | `branch-thread#turn-actions` ×2：`tooltip "Branch conversation"` 只在上游的 aria 树里 | **不跟**：Radix 与 reka 都把 `role="tooltip"` 挂在一个 `VisuallyHidden` 节点上、都给触发器盖 `aria-describedby`（逐份读过 `TooltipContentImpl.js` 与 radix 的 `dist/index.mjs`），**读屏器行为等价**；差的是 Playwright 快照怎么渲染两份形状相近但不同的 primitive。**翻案判据**：reka 把 `role="tooltip"` 挪到可见内容上。 |
> | `thread-history` ×2：`tabbablesOnlyReact: div(menuitem)` | **不跟**：子菜单展开时 Radix 比 reka 多留一个 `tabindex=0` 的菜单项（父级触发器）。菜单的漫游焦点是 primitive 自己的实现细节，两边的键盘操作都走方向键而不是 Tab。**翻案判据**：哪一边的菜单出现真正的键盘不可达。 |
> | `chat-thread-init-ordering` ×5（en-US 独有） | **先怀疑取样时机**——这条形状本轮已经立过判据（语言维度不对称的差异不会是渲染规则）。其中 `alert` 空 vs `alert: New chat - DeerFlow` 是 Next 的路由播报器（wave 102 量过：1×1 裁剪、内容是上一拍的 `document.title`）；`button "Edit and rerun"` 那 3 行是 seq 移植的副产物，backlog 里记着「先加临时 dump 看读数，别猜」。 |
> | `sidecar-chat` ×2：分栏把手的点击区 4px vs 16px | wave 146 判过：**保留本仓这一侧**（WCAG 2.5.8 目标尺寸）。 |
> | `workspace-changes#changes-panel` ×2：`focus: React=button "Close" Vue=第一个文件行` | **不跟**：**两边都没有接管 `onOpenAutoFocus`**（逐份确认：上游 `ui/sheet.tsx` 与 `workspace-change-panel.tsx` 里一处都没有；本仓 `SheetContent.vue` 只把事件**转发**出去、`WorkspaceChangesBadge.vue` 没有监听），所以这不是任何一侧的产品决定，是 Radix 与 reka 的**默认落点不同**。两边的文件行都是 `<Collapsible>` 的 `CollapsibleTrigger`（一颗 button），关闭键在两边也都排在 `{children}` 之后——**我没有再往下探「为什么 Radix 落在关闭键上」**，那需要在场景里加一次 `document.activeElement` 转储。**翻案判据**：哪一边开始显式接管 `onOpenAutoFocus`（那时两边一起接管），或者 primitive 改了默认。 |
>
> ## 2026-09-11 产物面板的「JPG file」也是写死的英文
>
> 台账上只剩两条 zh-CN 专有的行（`showcase-public-thread` 与 `artifact-stream-state`
> 各 2 行）：`- text: doraemon-moe-comic.jpg JPG file` 对
> `JPG 文件`、`summary.txt Text file` 对 `Text 文件`。
> **又是那个形状**——只在中文维度报差异、英文维度一行都没有，所以两边渲染的是
> 同一棵树，只是一侧没翻译。
>
> 上游 `artifacts/artifact-file-list.tsx:187` 与 `artifact-file-preview.tsx:99` 写的是
> `{ext} file` 字面量，同一个文件里还有
> `"This file type cannot be previewed in the browser."`、iframe 的
> `title="Artifact preview"`、以及两处 `toast.error("Failed to install skill")`
> ——**上游的 `artifacts` 面板整块都没有进它自己的词典**。本仓一直有一个
> `artifacts` 命名空间（`fileTypeLabel` / `cannotPreview` / `previewTitle` /
> `installFailed` 都在里面），`ArtifactFileCards.vue` 的头注释里还点名了那句写死的英文。
>
> 两边同改：上游补上同名的 `artifacts` 块（只取本仓这四条），
> `vue-only-keys` 的 `VUE_ONLY_BLOCKS` 里把 `artifacts` 拿掉。
>
> **`placeholder="Select a file"` 不在这一批里**：它对应的是本仓
> `primitives.selectAFile`，而 `primitives.*` 那一组的规矩本来就是
> 「上游写死英文、两个应用念同一句」，两边现在念的就是同一句。
>
> ## 2026-09-11 `integrations` 46 → 34、`scheduled-tasks#default` 14 → 0
>
> 两族一起记，因为**剩下的全是早就判过的两条账**。
>
> **一、技能清单取数失败那一行（10 行）。** 上游画的是 `<div>Error: {message}</div>`：
> 没有 role（读屏器不会主动念）、硬编码一个 `Error: ` 英文前缀（中文界面上也是英文）、
> 画成普通正文（16px、前景色）而不是错误。本仓一直是
> `<p role="alert" class="text-sm text-red-600">{message}</p>`。
> `SkillSettings.vue` 的注释里写着「这两处差异有意留在台账里，各自有翻案判据」——
> **这一轮把翻案判据兑现了**：上游换成同形的一行。
>
> **二、设置对话框打开时的初始焦点（4 行）。** 上游不接管 Radix 的
> `onOpenAutoFocus`，默认落在第一个可聚焦元素——**永远是 "Account"**。
> 深链到 `?settings=appearance` 却把焦点丢在 "Account" 上，键盘与读屏用户得自己找路，
> 而 URL 已经说了要去哪一屏。本仓早就接管了（`SettingsDialog.vue` 的 `focusInitial`，
> 两条 e2e 钉着）。这一轮上游也接上了：一个 `ref` 表 + `onOpenAutoFocus`。
>
> **三、定时任务详情里缺了「复用会话」的提醒（14 行）。** 上游
> `scheduled-tasks/page.tsx:507` 在详情的「会话」那一行下面画 `ReuseThreadNotice`；
> 本仓**只在新建表单里画它**——一条任务建完之后，再回来看它的人永远看不到
> 「每次运行都往同一条会话里追加上下文，跑久了会越来越长、也越来越贵」，
> 而那正是想改掉它的人要知道的。台账上那条 `ariaOnlyReact: - alert: …` 加三行
> `y Δ-180`（缺这一块，下面的一切都上移了）报的就是它。补上，带两条做过变异验证的单测。
>
> **剩下的 34 + 6 行全是两条判过的账**：
> `div[scroll-area-viewport]`（wave 98，×28）与 `retry: false`（wave 128，×9）。
> `integrations` 与 `scheduled-tasks` 两族到此清完。
>
> ## 2026-09-11 手写 `<input>` / `<textarea>`：**7 份文件，其中三份把 primitive 的基类抄成了本地常量**
>
> 起因是上一笔留下的两行几何（`AgentSettingsDialog` 的两个数字输入）。顺着它盘了一遍
> `app/components` + `app/pages`：**19 份文件在手写**。逐条回上游对之后分成两半——
> 上游同样手写的照抄不动，上游走 `ui/input` / `ui/textarea` 的全部改过来。
>
> **改掉的 7 份**（上游那一处都是 primitive）：
>
> | 本仓 | 上游那一处 |
> | --- | --- |
> | `AgentChat.vue` 的消息编辑框 | `message-list-item.tsx:525` 的 `<Textarea autoFocus className="min-h-24 resize-y">` |
> | `ThreadSidebar.vue` 的重命名框 | `recent-chat-list.tsx:425` 的 `<Input>` |
> | `ChannelRuntimeConfigDialog.vue` 的凭据框 | `channel-runtime-config-dialog.tsx:113` 的 `<Input>` |
> | `MemorySettings.vue` 的三处 | `memory-settings-page.tsx:807/829/849` |
> | `chats/index.vue` 的搜索框 | `app/workspace/chats/page.tsx:107` |
> | `ScheduledTaskForm.vue` / `ScheduledTaskDetail.vue` / `ScheduledTaskScheduleInput.vue` 共 10 处 | `scheduled-tasks/page.tsx:289/300/306/533/538` 与 `scheduled-task-schedule-input.tsx:240/253/287/301/319` |
>
> 其中**三份是把 primitive 的整串基类抄成了本地常量**（`inputClass` / `textareaClass` /
> `editInputClass` / `editTextareaClass`），还有两份直接抄进了 `class=`（`chats/index.vue`
> 连 `data-slot="input"` 都手写了）。**抄的那几份都已经漏了 `aria-invalid:` 与 `disabled:`
> 两段**——也就是说无效态和禁用态在这些字段上一直是不生效的。
>
> **顺带修掉两个行为缺陷**：`AgentChat.vue` 的编辑框上游带 `autoFocus`，本仓没有
> （点「编辑」之后还得再点一次输入框）；`chats/index.vue` 的搜索框重复传了一个
> 与基类一模一样的 `w-full`，被 `primitive-class-overrides` 当场拦下。
>
> **留下的 12 份 16 处逐条注明了上游写法**，写进新的 `tests/guards/handwritten-input.test.ts`
> （`handwritten-button` 的同胞，双向清单：清单外的报错，清单里已经不存在的也报错）。
> 里面最值得记的一条是三个 composer 的输入框：上游走
> `PromptInputTextarea → InputGroupTextarea → <Textarea>`，而**本仓没有移植
> `ui/input-group`**，整块 composer 外壳都是手写的——那是独立的一笔账。
>
> **一个自己踩的坑，记在这里**：给 `MemorySettings.vue` 补 `Textarea` 导入的那段脚本
> 写的是「文件里没有 `ui/textarea` 才加导入」，而我刚插进去的**注释里就写着
> `ui/textarea`**——于是导入没加上，`<Textarea>` 退回成 Nuxt 自动导入解析不到的标签、
> 被当成普通 `<textarea>` 渲染，`v-model` 变成两个没人接的属性。
> `vue-tsc` 放行（Nuxt 生成的组件类型里有它），是那条 DOM 单测抓住的：
> 对话框上写着「Fact content cannot be empty.」而 DOM 里的值明明是 "Zero"。
> **这与守卫注释被自己扫到是同一个形状**（[[deerflow-guard-strip-comments]]）：
> 「文件里有没有这个字符串」这种判据，在一份**刚被自己写进说明文字**的文件上永远不可靠。
>
> ## 2026-09-11 `agents-feature-disabled` 三个状态 **32 行 → 0**
>
> 台账上最厚的一处（`#gallery` 16×2，`#loading` 7×2）。四类差异，**三类的根因都在上游**。
>
> **一、导航控件写成了按钮（`#loading` 4 行、`#gallery` 3 行）。**
> 「新建智能体」与卡片上的「聊天」都是「点了就跳到某个 URL」的控件，本仓写的是
> `<NuxtLink :class="buttonVariants()">`，上游写的是 `<Button onClick={router.push(...)}>`。
> 按钮不能中键打开、不能新标签页打开、不能复制地址，读屏器还念成按钮（WCAG 4.1.2）。
> 本仓那两处的注释里早就写着翻案判据「上游哪天给导航类按钮上了 `asChild`」——
> 这一轮就是去把它兑现：上游三处入口改成 `<Button asChild><Link>`
> （顺带把 agent 名 `encodeURIComponent`，上游原来是裸拼进路径的）。
>
> **二、加载占位没有 role、文案也不说在加载什么（`#loading` 2 行）。**
> 上游是一个没有 role 的 `<div>` 加通用的 `t.common.loading`（"Loading..."），
> 读屏器既听不到「在加载」，也听不出在加载什么。本仓早就是
> `role="status"` + `agents.loading`（「正在加载智能体…」）。两边同改，上游补上同名 key。
>
> **三、对话框的两处信息缺失（`#gallery` 5 行）。**
> - 标题只写「模型设置」：这是个模态框，打开之后那张卡片已经看不见了，
>   而说明文字只说「这个 agent」——页面上有好几个 agent 时，标题不说是哪一个。
>   两边统一成「模型设置 · <agent 名>」。
> - **agent 绑的模型不在清单里时，上游那颗选择器是空白的**：Radix 对找不到对应项的
>   值不渲染任何东西，于是对话框说不出这个 agent 现在跑在哪个模型上，
>   一按保存还会把它悄悄改掉。本仓早有一条 disabled 的兜底项（`<模型> · 不可用`），
>   照搬到上游。
>
> **四、剩下的两行几何是本仓自己的缺陷（`#gallery` 2 行）。**
> `[role=dialog] height React=555 Vue=548.8 Δ-6.2`、`y Δ3.1`（居中，高度差一半就是偏移）。
> 根因：温度与最大 token 两个数字输入**是手写的** `<input class="border-input … px-3 py-2">`,
> 而上游用 `ui/input`。手写那版丢掉焦点环、无效态、禁用态样式、深色 token 与 `h-9`
> 统一高度——**同一个对话框里另外三颗 Select 走的都是 primitive 的高度**，只有这两个不是。
> 顺带补上温度那颗缺的 `placeholder`（上游是 `settingsInherit`「继承」：空着的时候
> 用户看不出这是「跟随全局」还是「还没填」），并把字段块的容器与标签
> （`space-y-1.5` + `text-sm font-medium`）按上游对齐。
>
> **附带清掉一行 focus 差异**：`focus: React=button Vue=input[number]`。
> 本仓的模型选择器写的是 `:disabled="pending || modelsLoading"`，而清单是**打开对话框
> 才取**的——于是对话框打开那一刻它是禁用的，焦点越过它落到温度那个 spinbutton 上，
> 方向键会当场改掉温度值。判据：这颗选择器**任何时候都有东西可显示**
> （当前模型，或「用全局默认」），灰掉它等于把「这个 agent 现在跑在哪个模型上」一起藏了，
> 而那正是打开这个对话框要看的；「清单在取」由上面那条 `role="status"` 负责说。
> 改成只认 `pending`（正在保存）。
>
> **这一笔同时开出一条新账**：仓里有 `handwritten-button` 守卫，**却没有 input/textarea
> 的对应物**——上面那处盒模型缺陷因此一路活到今天，改回去也不会让任何门禁变红。
> 盘点是 19 份文件，工单写在 `vue-full-parity-backlog.md` 的「还开着的账」。
>
> ## 2026-09-11 中文界面里的一片英文：**全在 React 那一侧**
>
> 台账上有三个场景**只在 zh-CN 维度报差异、en-US 维度一行都没有**
> （`thread-history-mermaid#default` 14 行、`#download-menu` 15 行、`browser-feature` 12 行）。
> 这个形状本身就是判据：**两边渲染的是同一棵树，只是其中一侧没翻译。**
> 逐条查下来，没翻译的那一侧全是 React。
>
> **一、整个 markdown 面的控件都停在英文（两个场景各 7 行 + 1 行 focus）。**
> React 的 markdown 渲染器是 `streamdown`，代码块复制、表格导出菜单、mermaid 工具条、
> 外链确认这些**可见控件全部由它画**。它自带 `defaultTranslations`（英文）
> 并**开放 `translations` prop**——而本仓从来没有传过。于是中文界面下这一整片是英文。
>
> 修法：在 `ai-elements/streamdown.tsx` 这个唯一的收口处
> （`ClipboardSafeStreamdown`）把词典里的 `markdown` 命名空间传下去。
> **en-US 的值逐字抄 streamdown 2.5.0 的 `defaultTranslations`**，所以英文构建一字不变
> ——这一点很重要：如果英文值写得「更好」，en-US 维度会当场冒出一批新行。
>
> 代价是 `SafeStreamdown` 现在读 context 了，3 个测试文件 28 条用例要套上 i18n。
> 两个 `.ts` 文件里用的是 `I18nContext.Provider` 而不是 `I18nProvider`：
> React 19 的类型不允许 `createElement(Provider, props, child)` 这种写法带必填 children，
> 而 eslint 又禁止把 children 写进 props——Context.Provider 的 children 是可选的，两边都过。
>
> **`Zoom in` / `Zoom out` / `Reset zoom and pan` / `img "Mermaid chart"` 这 4 条跟不了。**
> 它们**写死在 streamdown 的产物里**，不在 `StreamdownTranslations` 的 29 个 key 之内
> （实测：`grep` 得到的字面量在 `chunk-*.js` 里，而 `defaultTranslations` 里没有对应 key）。
> 本仓的 mermaid 是自己实现的（`MermaidChart.vue` / `MermaidZoomPan.vue` / …），
> 翻译是对的。**判词：不跟。** 为了对齐一个第三方库写死的英文而把本仓的中文改回英文，
> 是拿真实用户的体验换一个指标。**翻案判据**：streamdown 把这 4 条加进
> `StreamdownTranslations`，或者 React 侧换成自己的 mermaid 渲染。
> 读数：`thread-history-mermaid` 两个状态 **14/15 → 8 / 8**（en-US 两个状态都是 0）。
>
> **二、浏览器面板整条工具条写死英文（5 行 aria + 2 行 geometry）。**
> `browser-view-panel.tsx` 里 `title="Back"` / `title="Forward"` /
> `placeholder="Enter a URL and press Enter"` / `"Connecting to live browser…"` /
> `"Waiting for the first live frame."` 等等全是字面量。本仓早有一个完整的 `browser`
> 命名空间，React 侧一个都没有。同一个文件里**上一轮已经用同样的方式修过一处**
> （面板标题那句注释：「This panel label was a hardcoded literal while `common.browser`
> sat unused in the dictionary, so zh-CN rendered "Browser" here.」）——这次是把剩下的补完。
>
> 那 2 行 geometry 是同一处的投影：标题 `Connecting to live browser…` 与
> 「正在连接实时浏览器…」字数不同，宽度差 26.5px。翻译对上之后自然消失。
>
> **三、两条门禁当场把「加词典」变成了一次对账。**
> 本仓有两条守卫在读**上游的词典**：`vue-only-keys.test.ts`（本仓独有的块清单）
> 与 `upstream-key-coverage.test.ts`（上游每一条 key 要么本仓同名有、要么落进
> ALIASES / movedByUpstream / pending 三个桶）。给上游加了 `browser` 与 `markdown`
> 两个块之后两条一起红，各逼出一个决定：
>
> - `browser` / `markdown` 从 `VUE_ONLY_BLOCKS` 里拿掉——它们不再是本仓独有的。
> - `markdown.close` **不进词典**：它标的是对话框关闭键，而本仓对这类
>   primitive 可访问名的规矩是「两个应用念同一句英文」（`primitives.*`，
>   I18N_INVENTORY 有说明）。不传这一条，streamdown 就用自己的默认值 "Close"，
>   与本仓 `primitives.close` 一字不差。传了反而会造出一处新的分叉。
> - `browser.navigatedNoScreenshot` **在本仓补实现**，而不是塞进 `pending`：
>   那一桶的 `$comment` 写着「目标状态是空数组，2026-09-10 达成」，往回塞是开倒车。
>   本仓这一支原来**什么都不说**——REST 导航成功但 `screenshot` 为空时把
>   `localFrame` 置空、面板变白，空状态照旧写着「在上方输入网址…」，
>   而用户刚刚就是输完网址按了回车。上游走 toast，本仓的浏览器面板整体不走 toast
>   （文件头记着这条分叉），所以同一句话放进**空状态的说明位**——那正是用户此刻
>   在看的地方；它不是错误，不进 `role="alert"` 那条。带一条做过变异验证的组件测试。
>
> **四、顺手补上本仓自己 `markdown` 命名空间里 7 条没翻的**
> （`copyLink` / `copied` / `openLink` / `downloadImage` / `imageNotAvailable` /
> `openExternalLink` / `externalLinkWarning`）。这一组当初是照 streamdown 的默认值抄进来的，
> 只翻了一半，`MarkdownLinkSafetyModal.vue` 那个对话框因此半中半英。
> 两边词典的 `markdown`（28 条共有）与 `browser`（11 条共有）现在**逐字相同**。
>
> ## 2026-09-11 `channels#settings-panel` 从 53/54 行清到 2/2：那颗 `Disconnect` 是**上游的缺陷**
>
> 这一屏原来是全台账最厚的一处。拆成几类逐条查，**最后一类不是「本仓欠上游」，
> 是反过来**——所以记在这里，它同时是「React 自身缺陷」这条已授权例外的又一个样本。
>
> **一、卡片本体没走 `ui/item`（13 行 `depth: React=2 Vue=3`）。**
> 上游整张卡片是 `<Item variant="outline">` 加五个槽位；本仓手写 `<article>` 套一层
> `div.flex` 再手写四个容器，**每一行可见元素都比上游深一层**。`ui/item` 这一族本仓
> 早就逐字移植好了、三个兄弟设置页都在用，这里是最后一处还在手写的。换过去之后
> `depth` 整档归零。
>
> **二、账号列表无条件渲染（21 行）。** 「已连接账号 / 尚无渠道账号。」这一块是本仓
> 独有的（上游一个 provider 只认一条 connection），留着是对的——多账号与逐账号断开被
> `tests/e2e-channels/channels.spec.ts` 拿真 Gateway 钉着。但它原来**对 7 个 provider
> 全部渲染**：对一个连配都没配的 provider 说「它还没有账号」是零信息；更糟的是
> `DEER_FLOW_AUTH_DISABLED=1` 下配好且跑起来的 provider 本来就不该有 binding row，
> 于是同一张卡片上边徽标写「已连接」、下边写「尚无渠道账号」。改成
> `v-if="view.connections.length > 0"`，空态那句文案（`channels.noAccounts`）一并删掉。
>
> **三、动作条顺序反了（1 行 `order` + tab 落点）。** 上游两个分支都是
> Modify 在前、那一档的状态操作在后（右对齐的一排里主操作在最右是通行做法），
> 本仓把 Connect 排在了 Modify 前面。
>
> **四、`Disconnect` ×3（React-only）对 `Remove provider configuration` ×6（Vue-only）
> ——查下去发现是同一个端点，而上游那一侧是错的。**
>
> 两边打的都是 `DELETE /api/channels/{provider}/runtime-config`。后端那条
> （`backend/app/gateway/routers/channel_connections.py:570`）做三件事：
> 停掉整个部署的这条渠道运行时、**把所有人的 connection 行一并吊销**、删掉 provider
> 的运行时配置；而且函数第一句就是 `await require_admin_user(...)`。
>
> 上游把它叫 "Disconnect"、**对所有人渲染**、点下去没有任何确认，而且只在
> `isConnected` 那一档才有。三件事都是错的：
>
> - 名字说的是「断开我的连接」，它删的是部署级配置；
> - 非管理员点下去只能拿到 403 和一句 `Failed to disconnect {provider}`，看不出是权限；
> - app secret 填错、永远连不上的 provider **没有任何办法清掉**。
>
> 本仓这一侧本来就是对的（管理员限定 + AlertDialog 确认 + 说实话的文案），
> 所以**两边同改 = 只改 React**：`isAdmin` 判据是同目录下 skill / subagent /
> integrations 三个设置页早就在用的那一行，渲染条件改成「配过就能清」，
> 词条 `channels.disconnect` 改名 `channels.removeProviderConfig`（React 侧它只有
> 这一个消费点）。**确认对话框没有跟过去**：React 侧没有 alert-dialog 这个 primitive，
> 为一颗键引进一个新 primitive 越过了「frontend/ 只做小改」的边界。
>
> 顺带修掉上游同一个文件里的另一处不一致：同一颗 Modify 在已连接分支带 `PlugIcon`、
> 未连接分支不带，于是 provider 连上之后这颗键自己宽出 18px。两个分支的变体与尺寸
> 完全相同，是漏写不是设计。
>
> **五、`channels.descriptions.buzz` 的中文是本仓独有的一版**（2 行）：上游
> 「通过 DeerFlow 智能体接收 Buzz 频道消息和私聊。」，本仓「通过 DeerFlow Agent 接收
> Buzz 渠道消息和私聊。」。另外 7 条描述**逐字相同**，而「智能体」在本仓中文词典里
> 出现 58 次——这一行是孤例漂移，不是术语选择。照上游改回。
>
> **读数（单场景实测，`PARITY_ONLY=channels make e2e-parity`）**：
> `channels#settings-panel` **53 → 2（en-US）/ 54 → 2（zh-CN）**，
> `depth`、`geometry`、`order`、`ariaOnlyReact`、`ariaOnlyVue`、`tabbablesOnlyVue`
> 六档全部归零。剩下的 2 行两个语言一样，都是 wave 98 就判过「不跟」的
> `div[scroll-area-viewport]`（上游那条 `ScrollBar className="hidden"` 永远不滚动，
> 只多一个键盘停靠点），以及它在 `tabOrder` 上的同一处投影。
>
> ## 2026-09-11 记一条判据：`thread-list-infinite-scroll` 那条 spec 再红时怎么判
>
> **这是我自己引入又修掉的竞态，留下判据免得下次当成偶发。**
>
> 症状：`sidebar recent chats loads more threads when scrolling to the bottom`
> **等满 15 秒超时**（正常 1–2 秒跑完），第 51 条永远不出现。
>
> 根因：侧栏的 IntersectionObserver 回调里写的是
> `if (threads.canLoadMore && entries.some(isIntersecting))`。
> 列表还空的时候哨兵本来就在视口内，回调触发一次、被 `canLoadMore === false`
> 挡掉；此后哨兵**一直可见，不会再有 intersection 事件**，于是首屏数据到了也
> 永远不翻页。`scrollIntoViewIfNeeded` 对已在视口内的元素不滚动，也不产生新事件。
>
> 为什么现在才露出来：`onMounted` 里原来有一句 `void threads.loadInitial()` 排在
> 建观察者之前，时序上遮住了它；列表查询改成自己会跑（`48e9297a`，`enabled` 打开）
> 之后那句删掉了。
>
> 修法：**观察者只记「哨兵在不在视口里」这个状态，翻页交给 `watch`**
> （`ThreadSidebar.vue` 与 `chats/index.vue` 两处同改）。
> 「一次性事件 + 依赖异步状态的守卫」本来就是脆的形状。
>
> **没有为它写测试**，理由写在这里而不是含糊过去：挂载 `ThreadSidebar` 要 mock
> router / i18n / projects / useThreads 一大片，而这条竞态在 e2e 里也复现不稳
> （实测重跑 3 遍 9 条全过、整套 e2e-mock 再跑一遍 272 条全绿，只在那一次红）。
> 所以判据写在这里 + 代码注释里。**再看到这条 spec 红，先对症状**：
> 是不是 15 秒超时、是不是第二页永远不来——是的话先看这两处观察者有没有被改回
> 「在回调里判守卫」。
>
> ## 2026-09-11 判一条「不跟」：`thread-list-pin#mobile-drawer` 上那两行
> （`POST /api/threads/search` 与 `GET /api/features` 各多一次）
>
> 单场景实测：React ×2 / 本仓 ×1（search），React ×3 / 本仓 ×2（features）。
>
> **判词：不跟。** 差别是**查询挂在哪一层**，不是行为：
>
> - 上游窄屏的 `Sidebar` 走 shadcn `Sheet`（Radix Dialog，没有 `forceMount`），
>   抽屉关着时内容**不挂载**；`useInfiniteThreads` 与 features 查询就住在那棵子树里，
>   所以「点开抽屉」＝ 一次挂载 ＝ 各多取一次。
> - 本仓 `useThreads()` 写在 `ThreadSidebar.vue:65`，也就是 Sheet 的**外面**
>   （`ThreadSidebarShell` 只拿 `<slot>`），查询自始至终只有一个观察者，
>   点开抽屉不产生任何请求。
>
> 两边**渲染结果一致**（这一档的 aria 差异只剩早就判过的 `scroll-area-viewport`），
> ~~本仓做的网络工作严格更少。~~ 要对上这两次，得把查询搬进抽屉子树、让桌面与移动端
> 各成一个查询所有者——那是在模仿**挂载拓扑**，不是在对齐行为。
>
> > **⚠️ 「本仓做的网络工作严格更少」这句 2026-09-12 第六轮被推翻了**（原文划掉保留）。
> > 那句话只在**抽屉被打开过**的前提下成立，而这个前提在手机上恰好是少数情况。
> > 第六轮给 `scheduled-tasks` 补了一维 mobile，量到的是**反方向**的三行：
> > `requestsOnlyVue: GET /api/channels/providers` / `GET /api/features` /
> > `POST /api/threads/search`——抽屉从没打开过，上游那棵子树因此从没挂载，
> > **一次请求都不发**；本仓的 `useThreads()` / `useAgentsApiEnabled()` 写在
> > `ThreadSidebar.vue` 的 setup 里（Sheet 的外面），照发不误。
> > **也就是说：每打开一个工作区页面，手机上要多三次往返，为的是一个没打开的抽屉。**
> >
> > **机制没变，变的是判词**：这不是「谁做得更少」，是**两种取舍**——
> > 本仓是**预取**（抽屉一开就有数据），上游是**按需**（开抽屉时转圈）。
> > 两种都站得住，代价分别是「每页三次请求」与「开抽屉一次等待」。
> > **仍然判「不跟」**，但理由换成这一条，而不是那句已经被证伪的「严格更少」。
> > **翻案判据不变**（本仓哪天把侧栏内容改成随抽屉条件挂载），
> > 另加一条：哪天有人量到这三次请求在真机弱网下拖慢首屏，那就该做。
>
> **唯一的行为细节**：上游点开抽屉会顺带重取一次列表，本仓不会（它的查询没卸载过）。
> 正常使用下没有差别——run 生命周期本来就会失效列表，而 `48e9297a` 之后那些失效
> 真的会触发重取了。
>
> **翻案判据**：本仓哪天把侧栏内容改成随抽屉条件挂载（或加上会让列表变旧的长驻页面），
> 这一条重新成立。
>
> ## 2026-09-11 已修：`chat-thread-init-ordering` 上那行
> `requestsOnlyReact: POST /api/threads/search`（`5cc426e3`）
>
> 用新加的 `PARITY_ONLY=<场景id> make e2e-parity`（单场景 + 两边完整请求序列转储，
> 4 分钟一轮）量清了**位置**：
>
> ```
> React: … POST /api/langgraph/threads → POST /api/threads/search → runs/stream …
> Vue:   … POST /api/langgraph/threads →                            runs/stream …
> ```
>
> 上游 `upsertThreadInInfiniteCache`（`hooks.ts:1281`）对**带 `archived` 过滤**的
> 缓存是 `invalidateQueries` 而不是乐观插入，注释写着「Run-created snapshots do not
> carry archive metadata」——run 里现造的快照没有归档元数据，塞进「只看未归档」的
> 列表是在替服务端猜。
>
> **照抄过来会过头，实测方向反了**：本仓每一份列表缓存都带 `archived` 过滤
> （`useThreads` 的 params 一定带），而 `upsert` 的调用点比上游多，
> 单场景实测 React 4 次 / 本仓 **6 次**。收窄成「只有这条 thread 还不在列表里时
> 才失效」也没降下来（仍是 6）——多半是失效之后重取还没落地，下一次 upsert 又判成
> 「不在列表里」，级联出去。**已回退，不留一个把台账变长的改动。**
>
> **按这条路查完了**：列清调用点之后根因很清楚——上游一次 run 只调一次
> `upsertThreadInInfiniteCache`，而本仓的 `upsert()` 靠「在不在视图里」分新旧行。
> 上一版跟着上游「只失效不插」，视图里永远没有那一行，于是后面每次 `upsert`
> 都再判一次新行、再失效一次（级联，6 : 4）。**插 + 失效**之后 4 : 4，
> 请求差集空，台账 204 → 203 零新增。
>
> ## 2026-09-11 已修：归档一条会话会把侧栏列表清空（`48e9297a`）
>
> 根因与「改名之后不与服务端收敛」同一个：**本仓的会话列表查询是 `enabled: false`
> 的手动查询**（`useThreads` 的 `useInfiniteQuery`，`eaf9d6a7` 写下时没有留任何理由）。
> 探针实测（Vue Query 5，`enabled:false` 的 infinite query）：
>
> | 操作 | queryFn 跑了吗 | 缓存数据 |
> | --- | --- | --- |
> | `query.refetch()` | ✅ | 有 |
> | `invalidateQueries` | ❌ | 有 |
> | `refetchQueries` | ❌ | 有 |
> | `refetchQueries({type:"all"})` | ❌ | 有 |
> | `resetQueries` | ❌ | **被清空** |
>
> `core/threads/archive.ts:109` 对这个 key 调的正是 `resetQueries`
> （注释写着「成员关系变了，旧的分页偏移作废——必须 reset 而不是 invalidate」，
> 判断没错，错在它 reset 的是一个**不会自己重取**的查询）。
> 第二个探针直接量了后果：`loadInitial()` 之后侧栏有 1 条，`resetQueries` 之后
> **变成 0 条，且没有任何重取**。也就是说**归档一条会话，侧栏列表就空了**，
> 直到换路由或手动刷新。现有 e2e 没有在归档之后看侧栏，所以门禁全绿。
>
> 同一个根因还产生了台账上 4 行 `requestsOnlyReact: POST /api/threads/search`
> （`chat-thread-init-ordering` 3 行 + `thread-list-pin#mobile-drawer` 1 行）：
> 一次 run 结束后上游会重取列表，本仓的 `invalidateStoppedThreadCaches` 是空操作。
>
> **已按这个修法落地**：列表查询自己会跑，`AgentChat.vue` 与 `ProjectsSection.vue`
> 显式传 `enabled: false`（它们只读缓存，上游的 chat-page 根本不挂这个查询）。
> 回归测试钉的是「reset 之后列表会自己回来」，做过变异验证。
>
> **验收结果**：零新增；`chat-thread-init-ordering` 上那 3 条重复的
> `POST /api/threads/search` 降到 1 条。**剩下的两行没结清**——
> `chat-thread-init-ordering` 1 条 + `thread-list-pin#mobile-drawer` 1 条，
> 上游仍然比本仓多问一次列表。下一轮从这里接着查。
>
> ## 2026-09-11 已清：`["threads", "search"]` 是一个死缓存键（`10335b5d`）
>
> 修改名那条账时量出来的：**本仓没有任何查询拥有 `["threads", "search"]`。**
> 会话列表走的是 `useInfiniteQuery`，key 是 `["threads", "searchInfinite", params]`；
> 而 `["threads","search"]` 的那个「本该的拥有者」`buildThreadsSearchQueryOptions`
> （`core/threads/thread-search-query.ts:59`）**在 `app/` 下零调用点**，只有它自己的
> 单测在用。两个 key 也不会互相前缀匹配（`"search" !== "searchInfinite"`）。
>
> 于是所有针对它的操作**都是空操作**：`setQueriesData` 只更新已存在的查询，
> 没有查询就什么都不做；`invalidateQueries` / `cancelQueries` 同理。产品侧 11 处：
>
> | 文件 | 处数 |
> | --- | --- |
> | `core/threads/archive.ts` | 3（write / cancel / invalidate）|
> | `core/threads/cache-invalidation.ts` | 2 |
> | `composables/useThreadStream.ts` | 2 |
> | `composables/useThreads.ts` | 1（`updateCachedThread` 的第一半）|
> | `composables/useProjects.ts` | 1 |
> | `core/threads/infinite.ts` | 1（`upsertThreadInSearchCache`）|
> | `core/threads/thread-search-query.ts` | 1（死模块本身）|
>
> **而单测是绿的**——因为有几处用例自己 `setQueryData(["threads","search"], …)`
> 造出一个生产里不存在的拥有者，再断言镜像写入落进去了（`thread-stream.dom.test.ts`、
> `infinite.test.ts`、`account-settings-auth-boundary.dom.test.ts`）。
> 这与本仓已经记过的那一次同形：`use-threads.dom.test.ts` 头注释里那句
> 「这些用例覆盖的是一段不会执行的代码，而且照样全绿」。
>
> **已删**（11 处 + 死函数 + 只服务于它的两个常量），6 处「自己造拥有者」的用例改成
> 断言真实那张列表缓存。验收判据满足：`make e2e-parity` 121 passed，
> `baseline/parity-diff.json` 未被改写。
>
> **顺手删掉的一条假保证**：`thread-search-query.test.ts` 里那条
> 「refetchInterval 让 IM 建的会话出现在侧栏」测的是一个从来没挂上过的查询选项。
> **两个应用的会话列表都不轮询**——这句产品性质此前只有那条用例在「保证」。
> 要它成立得先真的加轮询，那是产品决定，已从测试里移除而不是改写。
>
> ## 2026-09-11 判一条「不跟」：改名之后上游那次 `GET /api/langgraph/threads/{id}`
>
> 台账 `thread-title-sync` 上那一行 `requestsOnlyReact:
> GET /api/langgraph/threads/00000000-…-0001`（两个语言维度各一行）。
>
> **判词：不跟。** 上游那一次请求是 `useThreadMetadata` 这个查询被
> `useRenameThread` 的 invalidate 触发的——上游的会话头部读的是
> `threadMetadata.data?.values?.title`（`chat-page.tsx:399`）。
> 本仓的头部读的是**列表缓存**（`AgentChat.vue` 的 `headerTitle` 直接从
> `threads.threads` 里找当前这条），没有第二个查询要收敛。为了让请求计数对上而去发
> 一个**没有任何读者**的请求，是搬运不是对齐（本仓明写的判据：不承重就别写）。
>
> **同一轮结清的那一半**：`requestsOnlyReact: POST /api/threads/search` 是真差异，
> 已修——本仓的 `rename` 此前只写本地缓存，不 cancel、不失效。三步补齐之后
> （见 `useThreads.ts` 的 `rename`），标题被服务端规范化或别的设备并发改过名时才收敛得回来。
>
> **翻案判据**：本仓哪天给会话头部单独开一个 thread-metadata 查询
> （比如头部要显示列表投影里没有的字段），这一条立刻成立，跟上即可。
>
> ## wave 202 新挂一条：**`e2e-agents` 里有一处没人在看的静默失败**
>
> 补跑 `e2e-backend`（EXIT=0，22 条）时看到的：`suggest_agent` 每跑必报两次
>
>     app.gateway.routers.suggestions - ERROR - Failed to generate suggestions:
>     err='replay miss: … Caller: suggest_agent'
>
> **而用例照绿**——那几条不断言跟进建议，于是这条错误每次都在日志里、没人看。
> **不是产品缺陷**（生产走真实 LLM），是 `write_read_file.ultra` 这份 cassette
> 里没有这两个输入的录制。
>
> **三条可选的做法，各自的代价**：① 重录 cassette（要后端活 + API key，
> **与 `animationName` 卡点② 同一个障碍**，一次能解两条账）；
> ② 让用例显式断言「这里现在没有建议、因为夹具没覆盖」，把静默变成写下来的事实；
> ③ 让 `e2e-backend` 见到 `replay miss` 就红——**信号最强，但今天没法修就等于把门禁钉死在红**。
> **翻案判据**：哪天有人重录 cassette，①②③ 都不必做了。
>
> ## wave 200：**机器可读的账全清了。**（2026-09-09 实测）
>
> | 表 | pending |
> | --- | --- |
> | `baseline/parity-route-sampling.json` | **0**（`/auth/callback` 本轮结清）|
> | `baseline/parity-scenario-coverage.json` `pending` / `$pendingReasons` | **0 / 0** |
> | `baseline/react-parity-scope.json` `pendingRoutes` | **0** |
>
> **两条都是从根因结清的，不是重新判一次**：
>
> - `/auth/callback` 挂着的理由（「要一次真实的 OIDC callback session」）**是猜的、
>   而且是错的**——两边都只是问一次 `auth/me` 再分支，用 `delayMs` 挂住那个端点
>   就得到稳定的「还在验证」终态。**en-US 十一档全空，zh-CN 只有 2 行**（已判类）。
> - `integrations.spec.ts:461` 的偶发点击超时：**对话框缩放进场时点它里面的东西**，
>   实测位移 **21.2px**、约 170ms 停稳。收成唯一入口 `openSettingsDialog` + 零豁免守卫。
>
> **wave 201 追加**：第五节「还没筛的同形目标」那一条（`DEERFLOW_DURABLE_STATUS` /
> `DEERFLOW_WIRE_EVENTS`）**也已过期**——前者 wave 107 就钉住了，后者 wave 201 补上，
> `backend/` 早就在 `make verify` 的读取面里。**两张表现在都有机器守。**
>
> **下面第一节那个标题「真正还开着的（4 条）」是历史文本**，它下面那张表里的行
> 早就逐条判过或划掉了；数字没跟着改过。**以上面这张表为准**——它是机器可读的。

> **wave 196 结清一条、新挂一条。**
>
> **结清**：`sidecar-chat.spec.ts` 那条约 1/40 的偶发红（wave 195 留下的）。
> **不是抖动**——`invalidateQueries` 的 `cancelRefetch` 只在查询已有数据时才生效，
> 新建 thread 的第一次取数满足不了这个前提，于是 run 结束时的失效被在飞的取数
> 整个吃掉、一次请求都不产生。**两边同改**（上游同形），并给 Vue 补上上游那道
> `!thread.isLoading`。负向验证是确定性的：无补丁 3/3 红、有补丁 3/3 绿。
>
> **新挂**：`e2e-mock` 整套四次里有两次各红一条**不同**用例
> （`artifact-panel-resize:106` 拖拽折叠、`thread-history:105` 千轮虚拟列表），
> 另两次与干净树一次都绿。**两条都与 wave 196 的改动无关**（判据是执行路径：
> 两个用例全程没有 run，本轮两处改动一处都进不去），拖拽那条隔离态
> `--repeat-each=20` **100/100 绿**。**下一轮查的是「整套负载下」这个条件本身。**
>
> **那两次的 trace 已经没了**——`test-results/` 会被下一次运行清空，而我为了判断
> 是不是回归恰好重跑了两次。**wave 197 修的就是这件事**：真跑用例统一走
> `E2E_RUN`，失败时把现场另存到 `test-results/failures/<时间戳>/`。
> 下一次整套红时，trace/video/截图都会留住。
>
> **wave 198 收掉两条里的第一条**（`artifact-panel-resize:106`）：splitpanes 的窗格
> `width .2s ease-out` 让分隔条 200ms 内滑 332px，而命中区只有 16px——
> 在过渡途中量一次就按在那个读数上，拖拽静默失效。已改成按真实时间间隔判稳，
> 并当场断言「抓住了没有」。
>
> **wave 199 收掉第二条**（`thread-history:105`）：`dispatchEvent("wheel")` 是合成事件、
> 不会真的滚动，列表还停在尾部，`onScroll` 的 `atTail` 分支把 `followingTail` 置回 true，
> 虚拟窗口被钉死在尾部。改用真滚轮，并把那个致命 scroll 事件永久留在用例里
> （换回合成 wheel 就确定性红）。**这两条都清了。**
>
> **新挂一条**：默认并行度整套跑 10 轮红了 1 条 `integrations.spec.ts:461`
> （点击超时），现场已由 wave 197 的归档器留下。同一段里 196/198/199 都是
> 「在还没稳定的界面上量一次、再照读数行动」这一类，这条大概率同族。

> **判据提醒**：台账**实测**是 **103 行 / 95 个取样点**（wave 200 用 `scripts/parity-ledger-report.mjs` 量的；此处原来写着「202 行 / 90 个取样点」，是 wave 150 前后的旧数，**别引用散文里的数字，跑那个脚本**）（wave 150 不动 app 代码，行数未变）。
>
> **wave 150 把上一轮留的两条线索都就地判掉了，两条都是「量完不改」**：①`ariaOnly*`/`order`/`focus` 四档共 83 行、认不出的只有 6 行（7%），远低于上一轮那个 75%，按 wave 99 的先例不动尺子；②上游那个 4px 拖拽把手**不做两边同改**——目标尺寸是判断题（WCAG 2.5.8 有「周围留白 24px」这条替代路径，分隔条恰好符合），不属于 wave 138 那种「控件对读屏器无名」的客观缺陷。
>
> **wave 149 结清了上一轮新挂的第 8 条，代码改动为零**：那个 `tabbablesOnlyReact: div` 是 ScrollArea 的 viewport（wave 98 判过「不跟」那笔账在另一屏上的复现）；两条请求是**次数差不是集合差**，而且**只在抽屉打开那一刻**上游多发一轮（桌面态两边完全一致）。
>
> **顺手修了尺子**：`tabbablesOnly*` / `tabOrder` 三档共 79 行，**其中 59 行是裸 `div`/`span`、认不出是谁**。描述器给 generic 标签补上 `data-slot`（判据窄到「只在认不出时补」）之后，**59 行进 59 行出、台账行数一格没动**，而且全部解析成同一个 `div[scroll-area-viewport]`——那 59 行原来是同一笔账。现在认不出的行是 **0**。
>
> **wave 148 结清了上一轮新挂的第 6b 条**：移动端抽屉换成 `ui/sheet`（reka Dialog），34 行里 **32 行归零**——抽屉背后那一整页不再留在可访问性树里。顺着这个根因**系统扫了全仓**，同类另有两处（外链确认弹窗、mermaid 全屏），一并换成 `ui/dialog`；并配上零豁免守卫 `tests/guards/hand-rolled-overlays.test.ts`。
>
> **wave 147 新挂一笔（第 6b 条）、下一轮就修**：移动端侧栏抽屉第一次进取样面，34 行里 30 行是同一件事——上游用 Radix `Sheet`（给兄弟节点打 `aria-hidden`），本仓是手写的 `role="dialog" aria-modal="true"` + 手写焦点陷阱，**快照工具认前者不认后者**。键盘那一半两边等价（`tabbablesOnlyVue` 是空的，量过）。
>
> ~~**wave 144 新挂一笔、下一轮就修**：Tabs 的 variant 体系本仓整套没有。~~
> **wave 145 已修**：三处联动（根的 `group/tabs`、`TabsList` 的 `tabsListVariants`
>
> - `data-variant`、`TabsTrigger` 的四段类串）全部逐字搬过来，调用点传 `variant="line"`
>   并把创建键挪进上游那个 `<header class="flex justify-between">`。
>   **每语言 11 行归零，台账 219 → 197。**
>
> ~~**wave 145 新挂一笔（第 7 条）**：取样面看不见伪元素。~~
> **wave 146 已做**：伪元素进取样面（只对已有锚点顺带取，不记位置），
> 干净树 0 行且那个 0 是算出来的，另配形状断言 `pseudoSamples >= 4`。
> 顺带把分栏拖拽把手第一次挂成锚点，量出两行：一行是画法不同（已对齐，
> 屏幕上没变化），一行是点击区 4px vs 16px（**本仓更好，接受**）。
>
> wave 96 用 tab 序那一档量出的
> 64 行，**wave 97 已逐条结清**（修掉 52 行、接受 2 行、剩下的变成下面第 6 条那处
> 新的结构差异）。规则仍是「新出现的行要么已决定、要么有名有姓地挂在这张表上」。
> 其余各类是——
> 2 行 reka-ui 的 tooltip 播报节点（wave 91）+ 42 行「上游把字写死成英文、本仓翻译了」
> （wave 92 量出 28 行，wave 93 给 mermaid 加第二个终态时同一类在同屏又记一次，+14）
>
> - **7 行焦点差异**（wave 94），三类都在下面第一节里逐条交代。
>   **规则相应改成：「新出现、还没定过的行只能减不能增」**，「台账 0 行」这个目标不再成立。
>   「量不出差异」的准确含义一直是「**这些取样点上量不出差异**」，
>   不是「两个应用一样」。天生看不见的八类见交接文档。
>   **wave 88 又给它补了一条**：双向比对**看不见「两边一起漏」**——
>   22 颗按钮两个应用都没有 `aria-pressed`，三档全是 0 行。
>   **wave 89 把这条补成了机器守的**：`tests/guards/toggle-variant-pressed.test.ts`
>   两个应用一起扫，并顺手扫出剩下的两边各 12 颗。

---

## 一、历史逐条台账（**读之前先看这一句**）

> **2026-09-11/12 那一轮把台账上的每一行都重判了一遍**，下面这张表里
> **4 / 5 / 6 三条的结论已经被推翻或部分推翻**（逐条标在行末的「⚠ 已被推翻」里）。
> **以本文件顶部那一串 2026-09-11 条目为准**，这张表留着是为了能看到判据是怎么演进的。
> 带删除线的行是更早就结清的。

> **wave 195：安装页那 5 处缺口全修，`setup/en-US` 10 行 → 1 行。**
> 其中输入框尺寸那条是**旧账**：`login.vue` 的文件头早就记着同一段读数，
> wave 68 修过登录页却漏了安装页——而安装页直到 wave 194 才第一次进取样面，**挂了 126 轮**。
>
> **顺带发现一条静默失效的配置**：`retries: 0` 配 `trace: "on-first-retry"`
> ——**trace 从来没被录过**（旁边的 `video` 却是 `retain-on-failure`，同一份文件自相矛盾）。
> 这正是那条 sidecar 偶发红查不下去的直接原因：现场只有截图。已改 + 实测 trace.zip 写得出 + 配守卫。
> **但那条偶发红本身的根因仍未知**：单跑 8 次、整文件 3 次、整套 3 次共 14 次全绿，复现不出来。


> **wave 194：上一轮那条「同不同屏」的判据是错的。** 它把「同一屏但一侧没翻译」当成了
> 「不在同一屏」——实测两边都停在 `/setup`，只是**上游那一屏在 zh-CN 下几乎整屏英文**。
> 判据换成**最终路径必须相同**（`ParityCapture` 加 `url`，不进台账）。
> `/setup` 因此进了取样面，**第一次比就照出 5 处 Vue 侧缺口**：缺副标题、缺「保持登录」说明、
> 缺确认密码占位符、标签大小写不同、确认密码输入框高 42/16px 对上游的 36/14px。
> **下一轮修，全在 `frontend-vue/` 内。** 路由棘轮只剩 `/auth/callback`。


> **wave 193：wave 191 的分叉查清了——是我自己的场景写错。** `mock-api.ts` 对
> `GET /api/v1/auth/me` 返回「已登录」，而 Vue 的 `login.vue` 在挂载时探这个端点、
> 探到就跳去工作区；我给那两条场景写了 `backend: "mock"`。**不是 Vue 的缺陷。**
> 套件已重建（场景一律 `backend: "gateway"`），并加了一条**防再犯**的断言：
> 两棵可访问性树公共行太少就当场红——「差异很多」和「根本不在同一屏」不是一回事。
> 它当场抓到 `/setup` 在 zh-CN 下只有 3 行公共行（en-US 正常，换锚点无效），
> **原因未查清、因此没有写进场景表**。
>
> **登录页正式进了取样面，十一档只有 1 行**：`requestsOnlyVue: GET /api/v1/auth/me`
> （Vue 登录页的会话探测），**判接受**；其余全部一致。


> **wave 192：登录页第一次被真正比过——两边完全一致。**
> 不用新套件：跑着的 Docker 栈本身就是「鉴权开 + 无会话」（`auth/me` 实测 401）。
> 在它上面逐项比：文案、输入框、按钮、链接**逐字相同**；`/setup` 两边都跳 `/login`，之后同上。
> 所以 wave 191 那份基线记的确实是夹具假象，**而我当时的两个猜想也都被实测否掉**
> （回放 Gateway 的 `auth/me` 返回 401、种子只挂一个 seed-runs 路由）——**真正原因还没查到，如实记着**。
> 路由棘轮那两条 pending 现在欠的不是「这一屏对不对」，而是「让它进自动化取样面」。


> **wave 191：搭了开鉴权的对照，量出它还不可对照，整体撤回。** 基础设施都跑通了
> （config / testDir / spec / baseline / make 目标 / README×2 / 三条守卫），
> 但生成的基线记的不是差异：**`/login` 上 React 停在登录表单、Vue 直接进工作区**，
> `/setup` 上 React 自己也跳到了 `/login`。接上开着鉴权的回放 Gateway 后**读数一模一样**，
> 所以不是缺后端。请求档指出原因：**两边判会话用的端点不同**
> （React 问 `auth/providers` + `setup-status`，Vue 问 `auth/me`）。
> 在分清「产品差异」还是「种子会话让两边看到不同状态」之前，这份读数**不能签入**——
> 签进去就是把噪声当发现，而且会以「已判过的台账行」的身份长期误导。
> 已整体撤回，**量到的东西写进了那两条 pending 的理由**。


> **wave 190：不动台账。** 为下一轮的「开鉴权对照」做前置：**判词抽成一处共享**
> （`support/diff-entry.ts`），否则新套件会带来这个工厂的**第二把尺子**。
> 等价性判据是「签入基线一行不动」——`make e2e-parity` **103 passed** 即为证。
> 顺带给这把尺子补了单测（此前只有一个要跑 11 分钟的消费者），
> 四次变异各红一条，钉的都是「坏了会让台账**变短**」的那几条性质。


> **wave 189：路由棘轮 4 条待做关掉 2 条，另 2 条的挡路理由从猜的换成实测的。**
> `/showcase/[thread_id]` 原来的理由（「需要可公开读的 thread 夹具」）**本身就是猜的**——
> 实测两边把 demo 夹具都签在自己的 `public/` 里，不打 Gateway、不需要鉴权，接进去就跑。
> 它照出 **10 行**，其中 8 行是真缺陷：**匿名访客打开公开分享页，React 替他发了四条工作区请求**
> （features / skills / suggestions-config / uploads-limits），Vue 一条不发。
> **已修，8 行归零**——修法是小改：`isMock` 本来就靠 `/showcase/` 前缀判出来了，
> 那四条查询只是没挂这个已有的门控。台账 **216 → 208**。
> `/login` `/setup` 的挡路已查清：**auth 模式是构建期决定的**，要取样得为两个应用
> 各起一份开鉴权的 preview，属于基础设施活。


> **wave 188：换了个坐标系，照出 9 条从没被取样过的路由——其中 4 条是真产品屏。**
> 覆盖率棘轮的坐标系是**上游 e2e spec 的文件名**，而它的两条断言合起来是一道天花板：
> **上游没写过 spec 的屏永远排不进取样面**。`/login`（第一屏）、`/setup`、
> `/workspace/agents/new`、`/showcase/[thread_id]` 就是这样一直在外面。
> 已把「恰好相等」放松成「上游每一份 spec 都被表过态」，并新加**以路由为坐标的第二个棘轮**
> （`baseline/parity-route-sampling.json`，4 豁免 / 4 待做，各写明理由）。
> 当轮关掉一条：`/workspace/agents/new` 第一次进取样面，**两边十一档全空，台账一行没长**
> （206 行不变，取样点 91 → 93）。
>
> **新的 4 条 pending 不是回归**：原棘轮仍是 `pending: 0`，这 4 条是换坐标系才看见的缺口。


> **wave 187：九门禁全扫（八绿 + audit 预期红 14），并问了一个此前没问过的问题——CI 到底跑不跑。**
> 九条里 **三条 CI 不跑**（`standalone-sim` / `e2e-parity` / `icon-parity`），而只有 `e2e-visual`
> 的「只在本地」是有守卫和成因绑住的。顺着 `icon-parity` 挖到**我自己写的一句假话**：
> 它的文件头写着「顾问工具，不进任何门禁」，而 **wave 111（也是我改的）**给过期豁免加了
> `exitCode = 1`——**它会红，它就是门禁**，这也解释了它为什么既不在 README 也不在 CI。
> 已改正、两份 README 同补，并把「CI 实际跑哪些」写进文档 + 配**双向守卫**
> （接进 CI 而不改 README 也会红）。


> **wave 186：上一轮新记的第 10 条当轮判掉并结清。** React 补上容器 HEALTHCHECK，
> 但**不新增产品路由**：探 `/` 会每小时触发 360 次 GitHub 取数（限额 60，正是 wave 174 那个坑），
> 新增 `/health` 会把运维端点塞进产品树；**用 TCP 连通探测**——依据是仓库自己已经判过一次，
> Helm 的 frontend Deployment 对同一个 workload 用的就是 `tcpSocket`。
> 判据因此是「**声明了 HEALTHCHECK**」而不是「声明同一个」。双向实测（healthy / unhealthy）。


> **wave 185：不动台账，但新记一笔。** 把「三份配置比一遍」的手法搬到两个前端的 Dockerfile：
> **生产 compose 下 React 的前端容器以 root 在跑，Vue 的是 `node`**（Helm 另用 `runAsUser: 1000`
> 压过，于是 K8s 加固而 Compose 不是）。已照 Vue 那份改（`--chown` + `USER node`），
> **真构建真运行验过**：`uid=1000(node)`、HTTP 200、`.next/cache` 可写。
>
> **新记一笔（第 10 条）**：Vue 有 `server/routes/health.get.ts` 与容器 HEALTHCHECK，
> **React 两样都没有**。没修——补它要往 `frontend/src/app/` 加一条运维用的路由，
> 属于运维面不是产品面，**下一轮判要不要做**。


> **wave 184：不动台账。** 判据再提一档，但**不是**提到「所有指令」——日志与 pid 路径是真的
> 环境差异，写进豁免表就是坑 180。提到 **`map`** 这一档：`map` 从请求推导变量、与进程跑在哪儿
> 无关，两份需要第三份就需要，零豁免。它要求的那条有实际后果：local 缺
> `map $http_x_forwarded_proto`，**`make dev` 跑在另一层 TLS 反代后面时登录会 403**。已补。


> **wave 183：不动台账。** 别再一条一条找了——把「三份 nginx 配置是同一份配置」做成判据：
> **凡是出现在 ≥2 份里的 `location`，必须三份都有**（零豁免；只出现在一份是环境特有的
> 合理增补，出现在两份少第三份就是漂移）。它自己吐出两条我肉眼没找到的真缺陷：
> **Helm 缺 browser/stream 那条 location**（K8s 上浏览器面板实时流被降级成普通 HTTP、建不起来），
> **local 缺 `/api/sandboxes`**（`make dev` 下 provisioner 模式不可达）。
> 另外把「API 文档地址随跑法而变」也统一了。三份配置各跑过真的 `nginx -t`。


> **wave 182：不动台账。** 把 wave 181 的发现系统扫一遍——`test_gateway_runtime_cleanup.py`
> 的**四条** nginx 性质各写着一个内联二元组，Helm 那份四条都不在内。实测**三条成立、一条不**：
> Helm 的前端 location 写死 `proxy_set_header Connection 'upgrade';`（正是守卫明令禁止的字符串），
> **每个前端请求都被当成 WebSocket 升级发给上游**。已补 `map` 并改成 `$connection_upgrade`，
> 四条接到共享发现上。顺带把「Helm 只发 React」这条边界在 AGENTS.md 与守卫里**双向**钉住。


> **wave 181：不动台账。** 台账上已无「待办」的账，这一轮回到「找一句写下来当规则用、
> 却没有机器在守的话」：`test_nginx_langgraph_body_size.py` 写着这份配置维护在**三处**，
> 而 `test_nginx_compression.py` 的名单只有**两处**——漏掉的正是 Helm 的 ConfigMap，
> **它一条 `gzip` 都没有**，Helm 装出来的那套所有资产都不压缩，而 AGENTS.md 把压缩写成
> Nginx 的性质、不带条件。已补齐，并把「哪几份 nginx 配置」抽成**一处会自己去发现**的定义。


> **wave 180：第 9 条最后一条（④⑧⑨ `Edit and rerun`）结清，台账 209 → 206，一处改动关掉三行。**
> **前两轮的猜测全错。** 两个应用同时插桩，groups 与判定结果 **一模一样**——
> 新建会话刚发出第一条时那条人类消息**还没有后端给的 id**，两边算出的 editable 都是 null。
> 差别只在比法：上游有 `Boolean(msg.id)` 挡着，本仓的
> `editable?.humanMessage.id === message.id` 变成 `undefined === undefined`——**相等**，
> 于是给一条**根本没法寻址、点了也重跑不了**的消息画出编辑键。**本仓错、上游对**，已补。
>
> **判据做成行为判据不是源码扫描**：同形的 `a?.x.id === b.id` 全仓还有三处，
> 都是两边成对、右侧恒有值的正常写法，要给它们开豁免就是错判据（坑 180）。
>
> **第 9 条到此全部处理完**：三条「下一轮验」全部结清，剩下的两行是 wave 175
> 判过并留了翻案判据的（路由播报器、`threads/search` 次数差）。


> **wave 179：第 9 条三条「下一轮验」的第二条结清，台账 210 → 209。**
> ③ `Completed in <1s` 只在 React——**wave 175 的判词错了，是缺功能**：上游有一条
> **客户端兜底计时**（`message-list.tsx:339`），本仓只认后端给的 `turn_duration`。已补齐。
> **中途被自己的单测骗过一次**：照抄上游把键写成 `${threadId}:${group.id}`，五条单测全绿、
> 真应用一个字都不显示——实测下降沿那一刻 threadId 还是空串（**第三例 id 交接**，
> 与 wave 158 / 175 同族）。键改成只用 `group.id`，换会话清空由 watch 保证，
> 并补了两条专门照这件事的用例。
>
> **④⑧⑨ 仍开着，但排掉了几项**：React 的编辑键在 +0.5s / +4.5s / hover / **刷新之后**
> 都是 0，**不是时序**；`isMock` / `STATIC` / `isUploading` / `hasGoal` 都实测为假；
> `getLatestEditableTurn` 与 `isTerminalAssistantTextMessage` 两边逐字相同。
> **下一轮把两边的消息数组 dump 出来比**——假设是历史端点不同导致 assistant 消息的
> 「终态」判定不同，**没验**。


> **wave 178：第 9 条里三条「下一轮验」的第一条结清，台账 211 → 210。**
> ⑤`focus: React=body Vue=textarea` 的**根因不是我猜的那个**——不是 composer 重挂
> （打标的 textarea 一直是同一个节点、`removals` 为空），是 React 在 run 结束那一刻给
> **正被聚焦**的 textarea 置了 **11~12ms 的 `disabled`**；浏览器当场失焦，摘掉也不还。
> 按同形扫全仓，两边各三处 composer + 其它会被打字的 textarea 共九处，**全部**改成
> `readonly` + `aria-disabled`，并各配一份零豁免守卫。那一行台账已归零。
>
> **③ 的判词要订正**：wave 175 写的「不是缺功能」是错的。React 有一条**客户端兜底计时**
> （`message-list.tsx:339`），Vue 的 `core/messages/run-duration.ts` 只认后端给的时长，
> **没有兜底**。是功能缺口，**下一轮补**。
>
> **④⑧⑨ 仍开着**，这一轮只把候选缩到 React `canEdit` 比 Vue 多出的那几项
> （`chat-page.tsx:358`）——**靠读代码缩的，没实测，下一轮拿探针量。**


> **wave 177**：**不动台账**。这一轮修的是 Docker 构建期的一道断言（自审里那唯一一条
> 「不是根因」的另一半），与对照台账无关。**自审结论见
> `docs/plans/vue-parity-fix-audit-2026-09-08.md`：16 处修改 = 12 根因 / 1 半根因 / 1 不是。**
> 那条「不是」的档位**没有升**——现在拦得住，但当初怎么产生的仍未查清。


> **wave 175**：第 2 条（覆盖率棘轮 pending）结清——判据达成、场景进 covered。
> 但**同一轮新开了一条**：那个场景进套件时带出 **9 行新台账**，逐条判词见下面新增的第 9 条。

> **wave 157**：第 3 条（tooltip 播报节点）判决关闭，5 → 4。理由写在那一行的末尾。

> ~~**wave 137 新挂一条**：~~ **wave 138 已修（两边同改，marker 推到 `7f97efd1`）。**
> 原文如下——
> **上游模型设置对话框那五个表单控件对读屏器都是无名的**（13 行 × 两种语言）。
> 上游 `agent-settings-dialog.tsx:137/158/178` 把标签写成
> `<span className="text-sm font-medium">`——不是 `<label>`、没有 `htmlFor`、
> 控件上也没有 `aria-label`，模型下拉与两个数字输入在可访问性树里全是无名的
> （WCAG 3.3.2 / 4.1.2）；本仓那三个都有名字。
> **按判据应当两边同改**（上游自己是坏的；同形缺陷仓库已同改过三次：
> wave 88/89 的 `aria-pressed`、wave 97 的 ScrollArea `tabIndex`）。
> **下一轮做**，做法与规矩写在交接文档 wave 137 第五节。

| #      | 账                                 | 状态                                         | 下一步要做什么                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~7~~  | ~~**划词工具条的 6 行层级差异**~~  | **wave 124 结清：根因是 `role="log"`，已修** | wave 122 发现归一化把每层缩进都塌成一个空格，wave 123 在**保住缩进**的数据上重做层级比对，量到 **6 行**：`Add to conversation` / `Ask in side chat` / `Close` 三颗按钮 × 两种语言，**React 深度 2、Vue 深度 3**。两边行数相同（60/60）、工具条标记逐行相同，所以多出来的是**祖先里的一个 generic 容器**——而 `- generic` 正好被归一化过滤掉，于是它在行比对里看不见、只在深度上现形。**下一步**：把那一层揪出来（探针打印祖先链），再决定修掉还是接受，以及要不要把「深度」这一档常驻台账（要走 `PARITY_ACCEPT_GROW=1`）。**判据参考**：工具条是 `position: fixed` + 显式 left/top，多一层 generic **没有布局后果**，按 wave 34「欢迎区在树里的位置」的先例多半是「保留」——但**先揪出来再决定**。                                                                                                                                                                                                                                                      |
| ~~7~~  | ~~**取样面看不见伪元素**~~         | **wave 146 已做，账结清**                    | wave 145 的负向验证 N2 暴露的：把 `Tabs` 根上的 `group/tabs` 删掉——`TabsList` 的 `group-data-[orientation=horizontal]/tabs:h-9` 与 `TabsTrigger` 里那一串 `group-data-[orientation=*]/tabs:after:*` 全部失效——**台账零反应**。两条原因：①横向 tablist 去掉 `h-9` 之后的自然高度**恰好也是 36px**（`p-[3px]` + 触发器 30px），属于巧合；②**几何档量的是元素，不量伪元素**，而 `line` 档的选中态（`group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100`）**全部画在 `::after` 上**。也就是说：整个 `line` variant 的视觉主体，现有八档一档都够不着。**下一步**：先按线索 258 的门槛问一句——「有没有一种变异能让新档响、而现有各档都不响」，N2 本身就是答案（举得出来）；做法是给 `sampleGeometry` 的锚点顺带取 `getComputedStyle(el, '::after')` 的 `content`/`opacity`/`height`/`background-color`，**只取锚点、不扩面**（线索 214/255）。**翻案判据**：如果那一档量出来的行几乎全是别的档已经报过的，就撤掉（wave 99 的先例）。 | **wave 146 结果**：只对已有锚点顺带取伪元素样式，干净树 **0 行**，而那个 0 是算出来的（N2 当场报 `w=56.7 h=2` vs `w=0 h=0`，其余七档零反应，重复率 0%）。整套只有 4 个锚点样本碰得到它——两个应用加起来用伪元素的地方只有九处——所以另配形状断言 `pseudoSamples >= 4` 挡住「尺子坏了→静默 0 行」。**没有撤掉。** |
| ~~6b~~ | ~~**移动端抽屉的模态做法不同**~~   | **wave 148 已修，账结清**                    | 抽屉换成 `ui/sheet`（reka `DialogContentModal` = `useHideOthers` + `FocusScope` + `DismissableLayer`），**34 行里 32 行归零**（背后整页 27 行 + `order` + `tabOrder` + 上游 Sheet 的 3 行 sr-only 标题说明——本仓照上游补了同样的 `SheetTitle`/`SheetDescription`）。**剩 2 行 `requestsOnlyReact`**（`GET /api/features`、`POST /api/langgraph/threads/search`）**与 1 行 `tabbablesOnlyReact: div`**，成因仍未查明、只记读数，另挂在下面第 8 条。订正一句上一轮写下的话：当时判成「两种都正确的模态做法」——不对等，`aria-modal` 是声明、`aria-hidden` 是事实，上游两样都有，本仓当时只有前者。                                                                                                                                                                                                                                                                                                                                                       |
| ~~8~~  | ~~**移动端抽屉那 3 行剩账**~~      | **wave 149 已查清，账结清（代码改动为零）**  | ① `tabbablesOnlyReact: div` → 探针查明是 `data-slot="scroll-area-viewport"`，即上游给建议行套的那层 `Suggestions`（`tabIndex={0}` 是 wave 97 两边同改补的）——**wave 98 判过「不跟」的那笔 ScrollArea 账在另一屏上的复现**，不是新缺陷。② 两条 `requestsOnlyReact` **不是集合差是次数差**（同 wave 102 的订正）：逐条量时间戳，桌面态两边都是 features ×2 / search ×2，**只有抽屉打开那一刻上游多发一轮**（+50ms 那一对）——上游抽屉挂载时重取、本仓走缓存，与 wave 128 的 `retry: 3` 同族，判据同样是「vue 有更好的可以保留」。**翻案判据**：哪天本仓需要「打开抽屉就刷新列表」，那要靠显式 invalidate，不是改回默认。                                                                                                                                                                                                                                                                                                                                 |
| ~~9~~  | ~~**新场景带出的 9 行**（`chat-thread-init-ordering`）~~ | **wave 180 全部结清**：三条「下一轮验」逐条查到根因并修掉（⑤焦点=w178、③兜底计时=w179、④⑧⑨ id 判断=w180），9 行→2 行，剩下两行是判过并留了翻案判据的 | wave 175 把这一屏接进取样面之后第一次照出来的，**不是这一轮改出来的**。逐条：**①②播报器那一对**（`ariaOnlyReact: - alert` / `ariaOnlyVue: - alert: New chat - DeerFlow`）——Next 的路由播报器认为标题没变就不播，Nuxt 每次路由变化都播。**框架管道差异，接受**。**翻案判据**：哪一边改掉播报器语义。 **③`text: Completed in <1s` 只在 React**——两边都有这条词条（`MessageList.vue:762` / `run-duration.tsx`），所以是**取到的运行时长有没有值**的差别，不是缺功能。**下一轮验**：查 Vue 在这一屏拿不到 duration 的原因（夹具没给，还是读的字段不同）。 **④⑧⑨`Edit and rerun` 那一组**（`ariaOnlyVue` 多一颗按钮 + `tabOrder` 第 16 个错位 + `tabbablesOnlyVue: button`）——三行同一个根：Vue 的人类消息在这一刻显示编辑键，React 不显示。两边都有这个功能，**条件不同**：React 多要求 `!replayActionBusy` 与 `canEdit`（`message-list.tsx:1025`）。**下一轮验**：哪一边是对的——首次提交后立刻能编辑那条消息，是该有还是不该有。 **⑤`focus: React=body Vue=textarea`**——提交之后 Vue 焦点留在输入框，React 掉到 `body`，键盘用户发完一条得重新 Tab 回去。**看起来 Vue 更好**，但**没验**：假设是 id 交接那一下 composer 重挂丢了焦点（与 wave 158 修的那处同族）。**下一轮验，别直接当结论。** **⑥⑦`POST threads/search` 各多一次**——与 wave 102 订正过的那一类同族（**次数差不是集合差**）。**接受**；**翻案判据**：哪天两边的列表刷新策略被明确对齐。 |
| 6      | **台账里那 42 行 ScrollArea 差异** | **判词仍然成立，但数字变了：现在是 47 行** | 2026-09-11 复核过：上游那条 `ScrollBar className="hidden"` 还在、两边的内层容器**都是 `flex-wrap`**（所以上游那个 ScrollArea 确实不会横向滚），原判有效。**它占了台账的四成**，读台账数字前先把它减掉。 原文如下：**wave 98 核完：接受**                       | 逐屏量过：`/workspace/chats`（会话列表页）两边**都**有一个 viewport，对得上；差异全部来自 `/workspace/chats/new` 那一屏——**上游的建议行套了一层 `ai-elements/suggestion` 的 `Suggestions`，而它就是一个 `ScrollArea`**。看它的实现：里面是 `flex w-full flex-wrap`（内容本来就换行）、外面那条横向 `ScrollBar` 还写着 `className="hidden"`——**这一层永远不会真的滚动**。本仓 `WelcomeSuggestionList.vue` 用的是一个普通的 `flex flex-wrap` 容器，**什么都没少**。**决定：不跟。** 补一层不产生滚动的 ScrollArea，只会多一个键盘停靠点（正是第 6 条上一轮刚修掉的那类噪声）。**翻案判据**：上游哪天把那条 `hidden` 去掉、让建议行真的横向滚动。                                                                                                                                                                                                                                                                                                        |
| 5      | **台账里那 7 行焦点差异**          | **⚠ 2026-09-11 部分推翻** | 其中「settings 深链的 4 行」那一半**已两边同改**（上游也接上了 `onOpenAutoFocus`）；「改动面板那 2 行」判为不跟（两边都没接管，是 Radix 与 reka 的默认落点不同）；而**当年没看出来的一条**是：重命名对话框关掉之后**两个应用都把焦点丢在 `body` 上**——那一直表现为幻影差异，2026-09-11 用 `visible: button:focus` 逼成稳定复现后两边同改。 原文如下：**已决定 / 已钉住**                          | wave 94 把「焦点」这一档接进取样面之后量出来的。**4 行**：settings 深链之后上游焦点落在导航第一项「账号」，而屏幕上显示的是另一个面板；本仓 `SettingsDialog.vue` 的 `focusInitial` 把焦点送到当前分区——**拿掉它之后本仓焦点会落到对话框背后的 composer textarea 上**，也就是模态开着而焦点在模态外面，所以那段代码挡的是真缺陷，**保留本仓这一侧**。**1 行**：mermaid 下载键的名字，是第 4 条那一类（译文）的重复。**2 行**：改动面板打开后的初始焦点（上游落在关闭键、本仓落在第一行文件）——**incidental，不是设计**（两边 `SheetContent` 的 DOM 顺序一致，本仓也没有显式焦点代码），最可能是文件列表到位的时机不同。**翻案判据**：这 2 行哪天翻过来，本身就是一个时序信号，值得去查。                                                                                                                                                                                                                                                               |
| 4      | **台账里那 42 行「上游写死英文」** | **⚠ 2026-09-11 已被推翻：改成两边同改** | 当年的判词是「保留本仓的翻译、不跟」。**错在没去看上游有没有能改的口子**：`streamdown` 自带 `translations` prop（上游从来没传）、浏览器面板与产物面板那几句是内联字面量（上游自己的词典里加一条就行）。那一轮全部两边同改；**真正跟不了的只剩 4 条**（`Zoom in` / `Zoom out` / `Reset zoom and pan` / `img "Mermaid chart"`——写死在 streamdown 产物里、不在 `StreamdownTranslations` 的 29 个 key 之内）。 原文如下（留作判据演进的对照）：**已决定：保留本仓的翻译**                   | wave 92 给 19 个只跑 en-US 的场景补上 zh-CN 之后量出来的，**同一类**：`browser-feature`（Back / Forward / 地址栏 placeholder /「Connecting to live browser…」/「Waiting for the first live frame.」）12 行、`thread-history-mermaid`（工具条六颗键 + 图片 alt）14 行、`artifact-stream-state`（`fileTypeLabel`）2 行。出处逐条查过：`browser-view-panel.tsx:401/462` 是**内联英文字面量**（词典里没有对应 key）；mermaid 工具条来自 **`streamdown` npm 包**，上游连改都改不了；`fileTypeLabel` 是本仓独有的 key。**判据是 fork-boundary 里那条已授权的例外「vue 有更好的可以保留」**——把 13 处译文改回英文，是在这个要留下来的应用上做一次用户可见的退化。**翻案判据**：上游哪天给这些字加了词典，或者 streamdown 支持了 i18n。                                                                                                                                                                                                                       |
| ~~3~~  | ~~**台账里那 2 行 tooltip 播报节点**~~ | **wave 157 判决关闭（够不着，且无用户可见后果）** | wave 91 接上悬停态之后量到：React 的可访问性树里多一个 `tooltip` 角色节点，本仓没有。根因在库里——Radix 的 `<VisuallyHidden role="tooltip">` **不**加 `aria-hidden`，而 reka-ui 2.10.1 的 `VisuallyHidden` 默认 `feature: "focusable"`，那一支会打 `aria-hidden="true"`（`node_modules/reka-ui/dist/VisuallyHidden/VisuallyHidden.js:28`），于是**专门给读屏器读的那个节点被摘出了树**。**两边的描述都还念得出来**（`aria-describedby` 的描述计算不受 aria-hidden 影响）。那个节点在 `TooltipContentImpl` 内部、不经过本仓的 slot，够不着。**翻案判据**：reka 改掉那个默认值，这两行自己就没了。 **wave 157 复核并结账**（reka **2.10.1**，逐行看了源码，不是凭记忆）：`node_modules/reka-ui/dist/Tooltip/TooltipContentImpl.js:134-139` 构造 `VisuallyHidden` 时**只传了 `id` 和 `role="tooltip"`，没有 `feature`**，于是吃 `VisuallyHidden.js` 的默认值 `"focusable"`，那一支无条件写 `aria-hidden="true"`。这个节点在 `TooltipContentImpl` 内部，**不经过任何本仓能传值的 slot**——「够不着」是结构性的，不是没找对地方。**为什么判关闭而不是继续挂着**：①**没有用户可见后果**——描述照样念得出来（accname 规范：被 `aria-describedby` 引用的节点参与名字/描述计算，**即使它 `aria-hidden`**）；②唯一的「修法」是在本仓侧手搓一个补偿节点，而那正是 **wave 148 刚从三处清掉的那一类**；③挂着不动的成本是每一轮都要重读它一遍。**翻案判据不变**：reka 哪天给这处传 `feature="none"` 或改掉默认值，这两行自己消失——那时**台账会先响**，不需要人记得。 |
| ~~2~~  | **覆盖率棘轮的 pending 1 条**      | **wave 175 结清：判据达成，场景已进 covered** | `chat-thread-init-ordering`。**判据未满足，`pending` 保留**（wave 101 连取 20 次：React 仍两个终态 15 B / 5 A，Vue 20/20 单一；不许改判据凑绿）。**wave 102 第一次逐行量出两个终态差哪几行**：只在 A 的是 `text: Completed in <1s Hello`、`button "Copy to clipboard"`、`alert: Loading... - DeerFlow`，只在 B 的是 `text: Completed in <1s`、`alert`——**两件产品层面的事（乐观消息还没去重、连带多一颗复制键）加一件框架层面的事（Next 的路由播报器）**。**请求集合两边完全相同**（此前记的「A 缺三条请求」是假的，差的只是重复次数 20 vs 23）。要接着追就盯 `Completed in <1s Hello` 这一行，别再盯 `Loading...`。全部读数与复现方法写在 `baseline/parity-scenario-coverage.json` 的 `$pendingReasons`。 **wave 158**：两处根因都从代码上修掉了（两边同改）——①「切会话就重置」的 effect 也会在这次发送自己的 id 交接时触发，把 `prevHumanMsgCountRef` 基线覆盖掉、吞掉边沿；②`Loading...` 盖掉已知标题，被 Next 的 assertive 播报器播出去且再不更正（WCAG 4.1.3）。读数：**react aria 终态 1 个 ×20（达标）、react requests 2 个（17/3 与 14/6 两跑，不达标）**，vue 两档都 1 个 ×20。两个请求终态只差**三条交接后的后续 GET**，是取样窗内的时序，不是集合差。**判据没放松、pending 保留**；整段理由与下一轮怎么接，写在 `baseline/parity-scenario-coverage.json` 的 `$pendingReasons`。 **wave 159（零代码改动）**：先订正 wave 158 自己写的话——那三条 GET **20/20 都发了**，差的是**发了几次**（各 2 次 vs 各 1 次，正好一整轮）；wave 158 拿 `diff` 看多重集，把「出现两次 vs 一次」读成了「缺一条」。根因是 **`onStart` 挂载即取** 与 **`onFinish` 刷缓存** 撞在一起：单轮样本 invalidate 落在取之后 **+7ms**（还在飞，被去重），双轮样本 **+16ms**（已落地，真重取）。**回放 Gateway 一次运行十几毫秒才会掷硬币；真实后端下第一轮必然先落地、必然被刷第二遍——生产里那一轮是稳定浪费的。**修法（推迟放行到运行结束）与它要带的四条失败路径写在 `$pendingReasons`，**这一轮判定风险大于收益、没做**。 **wave 175 收尾**：`requests` 那一档的根因不是竞态，是**重复**——`onStart` 把 history / token-usage / metadata 三个查询挂上就取，`onFinish` 又把同一批 key 失效一次；竞态只决定 React Query 有没有恰好去重（invalidate 落在第一次 fetch 之后 **+7ms 被去重、+16ms 真重取**）。修法：让这三个查询**等这一轮 run 结束再取**，用 SDK 维护的 `thread.isLoading`——报错 / 用户 stop / 正常结束**三条路走同一个翻转**，不用手搓标志去数失败路径（那正是前两轮否掉那个修法的理由）。两处：`chat-page.tsx` 两个查询、`hooks.ts` 的历史查询，都挪到 `useStream` 之后才拿得到那个信号（已确认中间没有别人用它们的结果）。**去掉的那一轮没有任何可观察效果**——两个终态的 `aria` 此前就逐字相同。**读数：连取 20 次 × 两轮，react/vue × aria/requests 四档全部单一终态**，判据一个字没改。场景已注册、棘轮 pending 清空（covered 24 → 25）。 |

---

## 二、已决定、不再复量的（有读数、有日期）

| 账                                                    | 决定                                         | 读数                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`retry: false` 与上游不一致**（**2026-09-12 是 18 行**，因为新开了 dark/mobile 两维，同一条账在更多维度上各投影一次）          | **wave 128 判完：保留本仓这一侧**            | 代码注释里原本写着「`retry: false` 与上游一致」——**假的**：上游是 `new QueryClient()`、没有 defaultOptions，吃 TanStack 默认的 `retry: 3`。台账在 `integrations#load-failed` 上量出来：同一次 500，**上游发 3 次请求、本仓 1 次**。判据是 fork-boundary 那条「vue 有更好的可以保留」——TanStack 默认重试**不分错误码**，而 thread history 的 404 意味着 thread 不存在，重试三次只是把跳回空聊天页推迟 3 秒。**翻案判据**：要按错误码分流时换成 `retry: (count, error) => …`，不是改回默认。                                                                                                                                                                                                                                                                                                                             |
| **分栏拖拽把手的点击区**（台账 2 行）                 | **wave 146 判完：保留本仓这一侧**            | `sidecar-chat` 那一屏第一次把 `[role=separator]` 挂成锚点（两个应用各恰好 1 个，盒模型逐字相同 1.0×800.0 @870,0）。伪元素那一档量出把手的点击区 **上游 `after:w-1` = 4px、本仓 16px**。1px 的可视分隔线配 4px 的抓取区非常难对准，本仓这一侧按 WCAG 2.5.8 的目标尺寸更好，按 fork-boundary 那条已授权的例外保留。**同一颗把手的其余各档全部一致**（含 `opacity` 两边都是 0.33——动手前我以为那是本仓独有的「悬停才显形」，探针一量不是）。**翻案判据**：上游放宽 `after:w-1`，或者决定两边同改补到 24px。                                                                                                                                                                                                                                                                                                               |
| **三处「只能变短」没有机器在守**                      | **wave 85 判完：一句补成门禁，两句改成实话** | `parity-diff.json` 能守——**只有 `make parity-accept` 一条路能让它变长**，现在 accept 时逐行比对、有新增就拒写（`PARITY_ACCEPT_GROW=1` 才放行；判据是集合包含不是行数）。`pending` 那两句守不了（手改文件 + 没有历史参照判不了单调性），改成实话：标出真正上门禁的四条，并写明「只能变短」是评审政策 + 真要机器守该用什么判据。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **wave 101 挂的「不会自愈的加载态」**                 | **wave 102 定性完毕：不是产品缺陷，账作废**  | wave 101 把那颗一直在的「Loading...」归到 `LoadMoreHistoryIndicator` 的 `isHistoryLoading`——**错的**。实测命中元素在 shadow root 里（`host=next-route-announcer`、`hostParent=body`、无 `button` 祖先、`document.querySelectorAll` 找不到它——Playwright 文本引擎穿开放 shadow root，`querySelectorAll` 不穿），是 **Next 自带的路由播报器**，1×1 裁剪、`aria-live="assertive"`，内容是上一拍的 `document.title`。**屏幕上没有任何东西在转。** mock 也不是嫌疑人（`messages/page` 永远 fulfill 200，不认识的线程返回 `data: []` + `has_more: false`）；请求也不是（三条在 A 里同样发了、+588ms 之前全部 200 回来，此后 60 秒网络上再无动静）。**不必再追。**                                                                                                                                                            |
| **artifact 头部长文件名的「18px 零头」**              | **wave 103 复量完：不算差异，账结清**        | **用户可见的部分两边逐字相同**：标题 `span` 文本 61 字、盒 `407/407` **被裁 0px**、`line-clamp:1`；`SelectTrigger` 两边都是 **455px 宽**（右边缘 1267 / 1266）；四颗动作键 `Open in new window / Copy / Download / Close` 位置只差 1px，**一颗都没越界**。**并订正 wave 82 的读数**：那条「上游 481/458、本仓 497/492」是拿**两个不同层级的盒子**在比——「从头部往上找第一个 `overflow-x:hidden` 祖先」在上游落到 `div.bg-background.flex.flex-col`（clientWidth **458**）、在本仓落到 `div.ml-auto.h-full.min-w-0`（clientWidth **492**），**两边 clientWidth 差 34px 本身就是「不是同一层」的证据**。所以「18px 零头」不是一个可比的量。本轮复量上游仍有 5px、本仓 0px，但那 5px 被 `overflow-hidden` 裁在右边缘之外，标题没被裁、动作键没越界，**没有任何用户可见后果**，按 fork-boundary 判据上游自己也不坏，不改。 |
| **验收判据「移走 frontend/ 还能跑」**                 | **wave 83 真跑了，已修并接上门禁**           | 实验第一次真做：BLOCKING 早已是 0，而 `make verify` **当场红**（`describe.skipIf` 跳过用例不跳过收集）。顺带量出第二条假话（`doc-references` 三条用例是 `return` 报绿不是跳过）。两条都修了，动态那一半现在是 `make standalone-sim`，进收工清单。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/showcase` 的请求层落差                              | **不放开**                                   | wave 27 / 28 / **81 三次逐条复量，一字不差**：react-only 四条（`features` / `skills` / `suggestions/config` / `threads/«generated»/uploads/limits`），vue-only 空，**aria 0/0**，落地 URL 相同。四条都打向需要鉴权的端点，而案例页是公开只读的。**翻案判据**：有没有哪个只读能力因为缺了这四条而在案例页上失灵。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 建 agent 页 chat step 的外壳                          | **保留本仓这一侧**                           | wave 81 复量，**比 wave 28 记的少一项**（wave 79 把保存搬进 ⋯ 菜单之后，触发器 React x=1232 / 本仓 1231）。剩下的是 header 本身：上游返回键 + `h1`，本仓侧栏触发器 + agent 名字 + 用量徽标。叠上游那个 header 会让这一屏有两个 header。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 欢迎区在树里的位置                                    | **保留**                                     | wave 34 复量：两边**定位完全一样**，只是 DOM 父节点不同。要对齐得给 ChatComposer 加 slot，**零可观察收益**。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Button` 的 as-child                                  | **不做**                                     | wave 37 量完、wave 58 订正理由。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| browser 面板的分叉                                    | **保留**                                     | 理由写在 `BrowserPanel.vue` 文件头。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 上游种子取数失败弹 toast                              | **本仓静默降级**                             | `BEHAVIOR_CONTRACTS.md` 的 S8 明写 403/404 属常态。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `agents.saveRequested` / `agentCreatedPendingRefresh` | **不补**                                     | 本仓 `useAgentCreationSession` 用 saving/verifying/created/error 四态 + 行内错误区表达同一件事，再加 toast 等于说两遍。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 建 agent 页那颗 `<Input>` 的可访问名                  | **照抄上游**（来自 placeholder）             | 「命名弱但存在」，按 wave 28 的判据不算缺陷。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ~~18~~ **15** 条 unused 词条（2026-09-11 实测）                                     | **逐条撞过上游**                             | wave 34 逐条撞，35 / 36 / 38 各做掉四 / 二 / 二条；剩下的分「上游自己也零消费」与「本仓有意不做」两类，逐条记在交接文档。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DropdownMenuContent` 的 `z-80`（上游 `z-50`）        | **保留**                                     | 本仓自己的一层 z-index 统一，不是漏抄。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 菜单项的 `hover:bg-accent`（上游只有 `focus:`）       | **保留**                                     | Reka 的菜单项悬停不触发 focus，而 Radix 给高亮项打的就是 focus；删掉鼠标悬停就没有反馈。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

## 三、这一轮（wave 78~128）清掉的

- **浮层层级也是一条正确、但没人守的规则**（wave 154）：`ARCHITECTURE.md:102`
  「所有 portal 浮层共用 `z-80`，只有 tooltip 用 `z-90`」——8 个 portal 组件逐一核对，
  一个漏写都没有，而守着它的机器是 0 台。这类缺陷**对照台账照不出来**：几何档量的是
  锚点自己的盒子、`hit` 只在中心取一次，两个应用各自内部一致时三档全 0。
  判据按**行为**收口（渲染了 reka `*Portal` 的组件），绕开 `ToggleGroupItem` 那两处
  非浮层的 `z-10`，因此零豁免；另配反向断言（`z-90` 只能是 tooltip）。
- **一条正确、但没人守的边界**（wave 153）：`ARCHITECTURE.md:84` 写着
  「`app/components/ui/` 是唯一的交互控件底座，建在 Reka UI 之上」——实测**wave 128 时是真的**（这句至今成立，且由 handwritten-button / handwritten-input / primitive-marker-classes 那一族守卫钉着）
  （`ui/` 之外 0 处 import、`ui/` 之内 69 份），而**守着它的机器是 0 台**。
  一条正确但没人守的边界和一条错的边界只差一次改动：产品组件直接建在 reka 上，
  就绕开了这一层统一补的 `aria-modal`、z-index 分层与可访问名约定
  （wave 148 那三处就是同一件事的另一半入口）。判据零豁免，另配反向断言。
- **两份 README 记的门禁不是同一套**（wave 152）：中文版少 `audit`、`coverage`、
  **`standalone-sim`**——最后那个是**验收判据的动态那一半**（静态那半是 `standalone-check`），
  中文 README 那句话当时只写了静态的一半，照它走的人根本不会跑那个实验。三处一起补齐，
  并把 `doc-references` 里那条「两份 README 都要列出每一个套件」的判据**扩到全部 make 目标**
  （对称差为空，零豁免）——那条守卫的注释写的理由对非套件目标一字不差地成立。
- **⚠ wave 151 订正了下面这一条的措辞**：那句「全表 A–S 共 19 组」**本来就有机器在守**
  （`doc-facts` 数 `## X.` 标题再和句子比，实测加一组 `T` 它当场红）。真正没人守的是
  `invariant-ownership` **自己声称的两件事都只覆盖子集**——尤其 `条目 id 唯一`
  看不见 O–S 里的重复 id。改动仍然是对的，理由换一个。原文如下——
- **「全表 A–S 共 19 组」那句话的守卫只读到 14 组**（wave 150）：合同表实际
  **221 条 / 19 组**，守卫的正则 `/^[A-N]\d+$/` 只读 176 条 / 14 组，**O–S 五组共
  45 条从来没被读过**；而那条用例断言的 `组数 === 14` **恰恰因为 O–S 看不见才成立**。
  正则放宽到 `[A-Z]`，并把「14」换成**从文档那句话解析出区间与组数、与表里实际的组
  双向核对**（还要求从 A 连续）。副作用：`条目 id 唯一` 这才第一次覆盖到 O–S。
- **台账里认不出是谁的行清零**（wave 149）：`tabbablesOnly*` / `tabOrder` 三档 79 行里
  **59 行是裸 `div`/`span`**——查一条得单开探针，等于没有账。描述器给 generic 标签补
  `data-slot`（**只在认不出时补**：有 role 的本来就认得出，补了反而会凭空造差异——
  负向验证 N2 实测去掉这个条件后 30 行变 86 行，因为本仓 splitpanes 分隔条没有
  `data-slot` 而上游 `ResizableHandle` 有）。行数一格没动，认不出的行 59 → **0**。
- **手搓的模态语义全仓清零**（wave 148）：三处一起换成 primitive——移动端侧栏抽屉
  → `ui/sheet`、外链确认弹窗与 mermaid 全屏 → `ui/dialog`。根因是
  **`aria-modal` 只是声明、`aria-hidden` 才是事实**，手写那套缺的正是后者。
  台账 **233 → 202 行**。并配上零豁免守卫（模态三标志只许出现在 `app/components/ui/`），
  带自证用例与反向断言。
- **连带清掉的死物**（wave 148）：`app/lib/focusable.ts` 归零消费者（手写焦点陷阱是
  它唯一的生产消费者，而 `ARCHITECTURE.md` 写的「抽屉与 primitive 共用」里
  primitive 那一半本来就是假的）——模块 + 单测 + 三处引用一并删；
  `navigation.workspace` 词条随之死掉，也删了。
- **手机上够不着的会话动作按钮**（wave 147）：会话行的 ⋯ 少了上游 `SidebarMenuAction`
  的两条「只在 768px 以下生效」的类——`md:opacity-0` 被写成无条件 `opacity-0`
  （触摸没有 hover，那一整组会话动作在手机上根本显不出来），以及上游自己写了注释的
  `after:absolute after:-inset-2 md:after:hidden`（增大移动端点击区）。实测 375px：
  React `opacity=1` / 点击区 **28×36**，本仓 `opacity=0` / **20×20**（低于 WCAG 2.5.8
  的 24×24）。改后两个断点逐字一致。
- **终态可以自己钉断点**（wave 147）：`ParityState.dimensions?`，与 wave 128 的
  `routes?` 同一条理由（场景 id 受棘轮约束、编不出新的）。靠它把移动端抽屉挂进了
  取样面，**而已有的 89 个键内容一字未变**。
- **伪元素进取样面**（wave 146）：结清上一轮新挂的第 7 条。干净树 0 行、
  而那个 0 是算出来的（N2 当场让它报，其余七档零反应），另配形状断言防它烂掉。
- **分隔条的画法对齐**（wave 146）：本仓用 `border-left` 画那条 1px 线、上游用
  `bg-border`，计算样式上是一条差异、屏幕上分不出来。改成与上游同一种画法，
  台账那行消失，用户看到的东西一个像素没变。
- **Tabs 的 variant 体系搬过来**（wave 145）：结清 wave 144 挂的那笔。三处联动缺一不可
  （根的 `group/tabs`、`TabsList` 的 `tabsListVariants` + `data-variant`、
  `TabsTrigger` 的四段类串）；调用点传 `variant="line"`，创建键挪进上游那个
  `<header class="flex justify-between">`。台账 **219 → 197**，每语言 11 行归零。
- **基类守卫看不见 7 个最高频组件**（wave 145）：`STRING_LITERAL` 那条
  `(['"`])([^'"`]*)\1` 不许字面量里出现另外两种引号，而 `[&_svg:not([class*='size-'])]:size-4`
  是 shadcn 惯用写法——`CommandItem` / `DropdownMenuItem` / `DropdownMenuRadioItem` /
  `DropdownMenuSubTrigger` / `SelectItem` / `SelectTrigger` / `TabsTrigger`
  **一个都没进过比对集合**。改成三支分写后当场露出 4 处漂移。
  **HEAD 那份守卫对注入的真实差异 5/5 全绿**（负向验证 N4 证实）。
- **七个调用点的 `as="button"`**（wave 145）：上游菜单项是 `<div role=menuitem>`，
  本仓因为调用点传 `as="button"` 渲染成 `<button>`，而 **`<button>` 的 `width:auto`
  是 fit-content**，不撑满菜单——此前靠在 primitive 基类里写 `w-full text-left` 压住，
  **补偿写在了错的那一层**。七处全删、两条补偿一起删，「删除」项宽度 81.8 → 182。
- **模型清单改成打开对话框才取**（wave 136）：结清上一轮挂的 `GET /api/models`。
  改的是谓词（`enabled: featureEnabled && editing !== null`）**不是搬家**——这份工作区的
  服务端真相由页面/composable 这一层的 Query 持有，对话框只收 props。
  台账 157/85/93 → **155/85/93**（近几轮第一次**缩短**，accept 不需要 GROW）。
  **抓到自己的一次无效变异**：想拿 `e2e-agents` 当安全网、把谓词改成 `false` 再跑，
  **3 条全绿**——那条用例回画廊之前已经走过 agent 会话页，模型清单早进了 TanStack 缓存，
  **`enabled: false` 的查询照样读缓存**。所以「冷开画廊再打开对话框还取不取得到」
  **目前没有自动化守着**，下一轮用「画廊有数据 + 打开设置对话框」那个终态一并补上
- **agents 画廊页第一次进取样面**（wave 135，第⑦类）：拿 wave 134 的 `delayMs` 去开一整屏
  此前一行台账都没有的页面（`agents-feature-disabled` 加一个「feature 覆盖回开着 + `/api/agents`
  慢 15 秒」的终态；`settle` 改成空的，因为两个终态一个共有元素都没有）。量出四处：
  **新建入口样式手写的**（没图标、字号大一档、高度差 4px，`width Δ-22.6`）**已修**；
  **加载占位不是同一个东西**（上游是居中 h-40 盒子，本仓左上角一行字，`height Δ-136`）**已修**；
  **元素类型不同**（上游 `<Button onClick>` / 本仓 `<NuxtLink>`）**保留本仓**（4 行，
  理由：跳 URL 的控件业界主流是链接，中键新标签页/复制链接/读屏器念成链接上游都做不到；
  **翻案判据**上游上了 `Button asChild`）；**加载文案不是同一条**（本仓自有 key + `role="status"`）
  **保留本仓**（2 行）。**另挂 1 行账**：`requestsOnlyVue: GET /api/models`——上游打开对话框才取、
  本仓进页面就取，**上游那种更省**，改法要跨两个文件还得动单测，下一轮做。
  台账 141/83/91 → **157/85/93**
- **「还在转」那一档第一次进取样面**（wave 134）：给 `ParityRouteOverride` 加 `delayMs`
  （纯数据，等待在 `installRoutes` 的固定实现里；取 15s——比整条取样链长一个量级、
  又不吃满用例的 30s 预算）。`integrations#skills-loading` 第一跑 **12 行 / 语言**，
  与上一轮同一处根因，**外加一条新的**：本仓 `Loading...` 写在 `<p>` 里，
  可访问性树多一个 `paragraph` 节点，上游是 `<div>`。改完 **12 → 2 行 / 语言**，
  剩下的 2 行是既有 ScrollArea 类。**这一档 aria/几何/顺序/焦点/深度全部归零。**
  台账 137/81/89 → **141/83/91**。
  **并订正 wave 133 提交说明里引错的一条证据**：`settings-session-unavailable` 用的
  **不是**红色小字那一套（实测 `text-sm text-red-600` 9 处、
  `rounded-md bg-red-50 …text-red-700` 4 处、`text-red-500` 1 处，它在第二组）——
  **结论不变、例子举错了**
- **技能清单取不到时本仓还留着筛选标签与「创建技能」按钮**（wave 133）：
  `integrations#skills-load-failed`（技能页在上游没有 spec 文件，场景 id 编不出新的，
  按既定做法挂现成场景）。第一跑 **15 行 / 语言**，根因一处——上游把标签、创建键与清单
  **一起**放在 `SkillSettingsList` 里、error 那一支整个不渲染；本仓把它们放在状态分支外面。
  三处加 `!skills.error.value` 之后掉到 **8 行 / 语言**（同一棵树前后两跑，只差这处 `v-if`）。
  **有意留在台账里的每语言 6 行**：`role="alert"` vs 没有 role 的 `<div>`、
  上游硬编码 `Error: ` 前缀（中文界面也是英文）、以及三行几何（红色小字 vs 无样式）。
  **翻案判据**：上游给那个 `<div>` 加 role 或样式。另每语言 2 行是既有 ScrollArea 类
  （这个对话框现有 5 个终态上都有，wave 98 判过）。台账 121/79/87 → **137/81/89**
- **第⑥类第一次量到产品层面的分叉**（wave 132）：`artifact-batched-stream#preview-failed`
  （产物来自 artifacts 清单、正文必须去取，所以 500 才盖得住；`artifact-preview` 那份
  夹具 wave 130 已量过接不住）。8 行里 6 行是**已判过的 `retry: 3`** 第三次复现，
  **2 行是新的**：`order` 报出「第 51 个公共节点 React=- radio Vue=- radio [checked]」。
  探针直接量到 —— **预览失败时本仓选中「代码」、上游仍然选中「预览」**
  （Vue `#0 aria-checked=true`；React `#1 aria-checked=true`）。机制：上游
  `preview.ts:238` 的 `initialViewMode` **只由文件策略决定**，与正文取没取到无关；
  本仓 `reset()` 置回 `code`，只有成功路径才设成 `preview`。
  **决定：保留本仓这一侧**——上游那一档等于念「预览，已选中」而同屏写着「无法预览此文件」，
  自相矛盾；**不做两边同改**（没有功能后果，够不上「上游自己是坏的」）。
  **翻案判据**：上游把 `initialViewMode` 接到加载结果上，或这一屏出现「重试」入口。
  台账 113/77/85 → **121/79/87**
- **8 个「一个锚点匹配到多份」逐个核完**（wave 131）：**3 个是缺陷、5 个是正常的多份**。
  判据是「那几份是同一个东西的多份，还是不同的东西」。最后一处缺陷在
  `thread-list-infinite-scroll`：`text:Conversation 001` 的 `.first()` 落在**侧栏**
  （x=16 w=**112**）而不是**页面那张列表的行**（x=376 w=**784**），于是 settle 可能在
  页面列表还没画出来时就通过，几何档量的也是侧栏标签——**而这个场景叫「会话列表页的
  首屏分页」**。改成 `a:not([data-sidebar]):has-text("…")`。**决定性负向验证**：
  Vue 页面列表行改成显示 thread_id，**旧锚点 2 条全绿 exit 0**、新锚点两个维度全红。
  **台账 113/77/85 一行没动**——第三次「加覆盖面不加账」
- **同一类锚点缺陷的第二例，并把下一件活量到走不通**（wave 130）：
  `artifact-preview` 的 `text:report.html` **在 `click` 之前就已经满足**（消息卡的文字
  是整条路径，`getByText` 字符串是子串匹配），几何档那一行量的也是那张卡；
  `artifact-panel-resize` 点完之后**一个锚点都没有**，只靠 700ms 固定等待量分栏几何。
  两处都改成 `text:/^report\.html$/`（点击前 0 个、点击后 1 个，两个应用一致）。
  **决定性负向验证**：把 Vue 面板标题改成整条路径，**旧锚点集 5 条全绿（exit 0）**、
  新锚点集**三个维度全红**。**台账 113/77/85 一行没动**——加的是覆盖面不是账。
  **否定结论**：`artifact-preview#preview-failed` 用现有夹具走不通——那条产物是
  `write-file-artifact`，正文来自消息里的工具结果，**两个应用都不发
  `/api/threads/*/artifacts/**`**（探针：`/artifacts` 响应 0 条、iframe=1、previewFailed=0）。
  要接得先造一份「产物来自 artifacts 列表」的夹具；**判据本身没错，错的是夹具**
- **两句当规则用的话被实测推翻**（wave 129）：①`scheduled-tasks` 场景注释说两个
  schedule input 锚点钉住的是**编辑表单**——实际那两个 testid 在**创建表单**里也各有
  一份（探针实测两个应用都匹配 **2** 个），`.first()` 永远落在创建表单上，
  几何档那两行量的也是它。**决定性负向验证**：删掉 Vue 编辑表单里的整块 schedule
  input，**旧锚点集 4 条全绿**、新锚点集（`>> nth=1`）**当场 2 红**。
  ②wave 128 自己写的判据「那条 key 上游词典里也有」在 `artifacts.loadFailed` 上给出
  相反结论——上游那一支**是有的**（`ArtifactPreviewError`），只是用了另一个 key
  `artifactPreview.previewFailed`（两边词典都有）。**正确判据：grep 渲染点，不是词典。**
  同轮接上 `scheduled-tasks#load-failed`，台账 107/75/83 → **113/77/85**
- **第⑥类第一次进取样面**（wave 128）：给 `ParityState` 加 `routes`，同一条场景可以
  同时取「正常」与「失败」两个终态（不动棘轮的场景 id）。第一跑就量出
  **上游对同一次 500 发 3 次请求、本仓 1 次**——顺着查到代码注释里
  「`retry: false` 与上游一致」**是假话**。台账 95/73/81 → **107/75/83**
- **第⑤类（primitive 默认值）量完了，判定不做**（wave 127，代码改动为零）：
  按 `data-slot` 比语义属性，73 个样本 **2519 行**，**只在一边出现的 slot 名就有 62 个**
  ——两套 primitive 的词汇表本来就不同（splitpanes vs react-resizable-panels 是早就
  决定的分叉）。做成常驻等于往台账灌 2500 行「已决定」。**翻案判据**：两边词汇表收敛时再量
- **上一轮的产出立刻违反了那份文件自己的规矩**（wave 126）：`aria-parity.mjs` 的头
  写着「两份各自维护的归一化迟早会分叉」，而 wave 125 加 `normalizeAriaTree` 时
  **在同一个文件里抄了第二份**。抽成一份共享规则 + 一条**同源用例**
  （行归一化的每一行 `trimStart()` 必须等于树归一化的 `body`），负向验证两条都对
- **「深度」做成常驻的一档，第④类真正补完**（wave 125）：wave 99 撤它是因为量的是
  **被塌平**的数据。负向验证是决定性的——把 wave 124 的修复退回去，
  **只有 depth 这一档响、其余各档一行没动**，正是 wave 99 自己立的判据要的证据。
  基线 73 个样本各加 `depth: []`，**总行数仍是 95**
- **划词工具条渲染在 `role="log"` 这个 live region 里面**（wave 124）：上游把它写在
  `</Conversation>` 之后，本仓的模板根**就是**那个 log div、工具条是它最后一个子节点。
  **后果不是排版**——live region 里插入的内容会被读屏器当日志播报，而它是一条
  随选区出现/消失的浮动工具条。挪出去之后**深度差异 6 → 0**，台账一行没动、
  视觉基线一张没重录。**wave 123 猜的「多一层 generic 容器」是错的**
- **wave 99 那个「层级差异 0 行」被推翻**（wave 123，代码改动为零）：在**保住缩进**的
  数据上重做，**量到 6 行**（划词工具条三颗按钮 × 两种语言）。那个 0 是数据被塌平
  造成的。**已挂成第 7 条账**，下一步是把多出来的那一层 generic 容器揪出来
- **那条没有注释的归一化规则，抹掉的是整棵树的层级**（wave 122）：
  `normalizeAriaSnapshot` 里 `\s{2,}` 命中 **6698 / 7692 行（87%）**，而**有注释的
  那四条一次都没响过**。它塌掉的是**每一层缩进**——深度 1/2/3 全变成一个前导空格。
  保留（下游本来就要去缩进，台账一行没动），但**代价写下来了**：
  **任何层级维度都无法从归一化后的快照恢复**，**wave 99 那条归因就地存疑**
- **那张丢弃查询参数的表一条都没响过**（wave 121）：探针实测**116 次观测、
  `DROPPED` 0 次**（控制组打印出实际参数，证明那个 0 是算出来的）。
  取舍写清了：留着 = 产品用 `t`/`ts` 时**静默丢掉**差异；删掉 = 真出现破缓存参数时
  台账**变得不稳定**——**一个会喊的失效优于一个不出声的**，所以删
- **三个夹具 id 没登记进 `KNOWN_IDS`，请求归一把它们抹成了 `«generated»`**（wave 120）：
  `normalizeRequest` 那条规则本是为了吃掉客户端随机 id，对夹具 id 一样有效——
  **两个应用请求了不同的夹具线程，归一之后差异会消失**。当时没造成假绿是运气。
  补进去 + 双向守卫；**归一化改了而台账一行没动**，正好证明此前没抹掉过真差异
- **`standalone-check` 的正则要求带斜杠，安装期的写法一个都看不见**（wave 119）：
  `"file:../frontend"` / workspace 的 `- "../frontend"` 都是 **BLOCKING 0**，
  同一条加个斜杠就是 1。放宽主正则会多出 26 行假命中（Makefile 的 `@echo` 就有 9 行），
  所以收窄到「安装期清单」这一类没有散文的文件。
  **判据四步（install / build / test / e2e）到此第一次四格都有着落**
- **判据里 e2e 那一半从没验过**（wave 118）：`--with-e2e` 此前**只跑 `e2e-parity`**，
  而那是唯一一个兄弟应用不在时**整组跳过**的套件。第一次真跑：把 `frontend/` 移开后
  `e2e-mock` 265+22+15+2+6、`e2e-backend` 2+5+2+3+3+5+1+1，**两组都绿**。
  开关现在把它们带上（17 / 4 / 0，十分钟量级）。
  **四步里只剩 `install` 没人碰过**
- **「要不要让 standalone-sim 连 build 一起跑」答完了：不加**（wave 117）——
  构造一处「构建期才生效、静态扫描看不见」的依赖（`nuxt.config.ts` 运行时拼路径），
  **静态扫描 BLOCKING 0，而 test 那一步当场红**（nuxt 的 vitest project 会加载它）。
  只有 build 才看得见的那一类要同时满足三条苛刻条件，举不出像样的例子就别加。
  顺带修掉整套起不来时「把责任推给表里那几份文件」的误导输出
- **`standalone-sim` 只跑表里那 8 份文件，而判据说的是「整套」**（wave 116）：
  实测——写一份没人登记、运行时拼路径读兄弟应用的测试，
  **HEAD 的 sim 报「跑过 13 条 / 红 0」exit 0**，改动后「整套红了」exit 1。
  这正是 wave 83 撞到的形状，当时补了表却没改「只跑表里的」这条结构
- **拿旋钮把整张抖动名单量了一遍**（wave 115，代码改动为零）：#2 ×8 / #3 ×15 /
  #4 ×6 / #5 ×8，负载 20~115，**37 次一次没红**；而同一旋钮在 wave 113 修之前的
  #6 上 10 次红 1 次。**旋钮有效，这四条就是复现不出来**——它们现在的地位是
  「一次历史观察」，下次再红就是**新信息**
- **比 CPU 节流更好的复现旋钮**（wave 114，代码改动为零）：八个自限时的 CPU 忙循环
  把整台机器压住。**节流做不到的事它做到了**——把那份 spec 退回 wave 113 之前，
  load ~13 时 `--repeat-each=10` 是 **1 失败 / 9 通过**；修好之后 load 20→107 是 **10/10**。
  同形的另外两处（`mode-hover-guide`、`sidebar`）在同一旋钮下 **56/56 全绿**，
  所以 wave 113 那句「先不动」现在是**量过的结论**
- **已知抖动第六条查清并修掉，名单七条 → 六条**（wave 113）：探针实测
  tooltip 是**延时开**的（安静时也要约 600ms 持续悬停），而按钮**没有移动**、
  命中测试干净——**一次 `hover()` 赌不到**：那 600ms 里消息列表重渲一次，
  旧 trigger 卸载、计时器没了，鼠标又没再动，`pointerenter` 就永远不来。
  改成 `toPass` 里重新 hover。**同一复现条件下 3/10 → 10/10**，断言一个字没松
- **`upstream-drift` 会打一句假的「无漂移」**（wave 112）：`git log -- <不存在的路径>`
  **不报错、只返回空**，于是上游改个目录名，这份报告照样说「无漂移」——而这句话
  在交接文档里是**被当证据引用**的。实测 HEAD 的脚本 exit 0 且打印「无漂移」。
  同形的另外三张（i18n 扫描面的根与入口、`SUITE_INFRASTRUCTURE`、`SKIPPED_PREFIXES`）
  一起补上。**至此 `tests/guards/` 与 `scripts/` 里「指向外部东西」的表都双向了**
- **收工清单上「icon-parity 不报 stale」这句是假的**（wave 111）：`VERIFIED` 的
  stale 检查自 wave 87 起一直在报三条（`FileMinus`/`FilePlus`/`FilePenLine`，
  wave 87 重做改动面板之后两边都用了），而它只 `console.log`、不影响退出码——
  **本会话 wave 106/109/110 三份日志里那一行都在，而我三次都记成「不报 stale」**。
  三条过期豁免删掉；`EXEMPT` 也补成双向（第一跑就抓到已经不存在的 `magicui`）；
  stale 现在让 exit 1。顺带把 `e2e-suite-contract` 的 `standalone` 补上反方向
- **独立性判据自己身上的两处「登记了就不再检查」**（wave 110）：
  `kind: "data"` 此前**无条件 `ok: true`**——把一份 `.ts` 标成 data，
  改动前的 `standalone-sim` 报「跑过 13 / 未跑 6 / **红 0**」，
  它就此永远不会被这个实验跑到；`CROSS_APP_BY_DESIGN` 还是**单向**的
  ——一条不再引用 `../frontend` 的登记不产生 hit，既不在 BLOCKING 也不在 DECLARED，
  **报表一切正常**。两处都补上，四条负向验证里两条是「HEAD 绿、新版红」
- **最后 7 处写死的 5s 断言预算**（wave 109）：全仓显式超时是 15s×164 / 10s×40 /
  20s×28 / 5s×7——**5s 是离群值**，逐条读那 7 处**没有一处在断言「必须多快完成」**，
  只是旧默认值的回声，把断言永久钉在旧预算上。已全部改为继承默认。
  **有意不做成门禁**：短超时不是一律不许写（`capture.ts` 的 2s 是有意的），
  判据是「这个数字在断言一件事还是抄了默认值」，机器分不出来（线索 180）
- **订正 wave 108 的推断**（wave 109）：那句「第三/五/六条按症状同形推断」**不成立**
  ——#5 在 60x、#6 在 70x 节流下都还是绿的；节流只模拟「页面脚本慢」，
  模拟不了「服务端也慢 / 进程被抢占」。**那个旋钮有适用域。**
- **「负载抖动」第一次可以按需复现**（wave 108）：CDP 的
  `Emulation.setCPUThrottlingRate` 当旋钮，实测第四条抖动在 30x 节流下第一条断言
  用掉 **3832 / 5000ms**（77%）、50x 直接超时——**机制是 Playwright 默认的 5s
  expect 预算**（用例本身有 30s，二十几秒没人用），不是「断言钉错对象」。
  预算提到 10s；**只有第四条被复现验证过**，其余按症状同形推断，如实记
- **后端枚举的镜像 + 一处静默跳过**（wave 107）：`DEERFLOW_DURABLE_STATUS` 的
  「Gateway 的 durable run status 全集」现在与后端 `RunStatus` 逐个比
  （`tests/guards/backend-enum-mirror.test.ts`）；`doc-facts` 的
  `try { read("../backend/…") } catch { return }` **把「后端不在」与「文件被挪走」
  压成了一件事**——实测把那份文件挪走，HEAD 的守卫 11 条全绿。抽成
  `scripts/lib/backend-source.mjs` 之后两者分开。`DEERFLOW_WIRE_EVENTS`
  **量完判定不做**（后端没有枚举，做成门禁会误报），读数写进文件头
- **一条 e2e 断言钉错了对象**（wave 107）：`auth-contract.spec.ts` 的 `next` 落点是
  一个夹具里不存在的**线程路由**，工作区立刻把它换掉——`expect.poll` 采样快就绿、
  机器忙就红。探针量出 URL 轨迹后换成停得住的落点，**已知抖动名单没有变长**
- **五处「一张表把全集切成两半、另一半没人查」**（wave 106，判据来自 wave 105）：
  agent-core 的文档枚举**五句里只有一句是双向钉着的**（两句只查一半、两句没人钉，
  取样面现在从文档算出来、与登记表恰好一一对应）；`file-header-claims` 自己的头
  还写着 wave 105 已经推翻的「`tests/` 有意不在范围里」；settings 的分区表与联合
  类型两处各写一份（改成从表推类型，分叉不可能存在）；`gen-contract-constants.mjs`
  的「唯一阻断的一层」只对点名的三份契约成立（补 `CONSUMED`/`NOT_CONSUMED` 恰好划分）；
  **活违规一处**——`app/core/threads/utils.ts` 头里写「等 8 个」实际 9 个，
  从 `84108b5f`（2026-08-31）烂到现在，9 份写数量的文件里就它错
- **一句当规则用的话被实测推翻**（wave 106）：`settings-query.ts` 头里的
  「顺序天然测不出来——只能靠人盯着两边看」**自 wave 95 起就不成立**。
  把 `channels` 与 `memory` 对调，`make e2e-parity` 当场红，`order` 档报出 8 行
- **台账 16 → 0**（wave 78，五处根因：页脚两组 / 菜单 align+side / 模式项多传的 `py-2` / `ui/command` 的 class 合同 / artifact 头部三栏 / sidecar 页脚的 `pt-3`）
- **守卫注释里点名的两笔**（wave 79：保存 agent 键的位置与形状、MessageList 的 artifactTargets 文件名键）
- **一条红了七轮没人知道的 e2e**（wave 80：`hasText` 传 RegExp 不做空白归一；并把 `e2e-backend` 写进收工清单）
- **两笔「先复量再决定」的账**（wave 81，两条结论都不变，都已标注「不必再复量」）
- **长文件名把整排动作键推出可视区**（wave 82，**两边同改**，上游比本仓还差 18px）
- **验收判据本身**（wave 83：第一次真做实验，17 条声明里 **2 条是假的**；
  修完并做成 `make standalone-sim`，每次都真移走跑一遍）
- **两处 drag 助手里 `hover()` 与 `boundingBox()` 之间的观测缝**（wave 83，
  按空了整个拖拽却报「面板没关」；**没有证据说它就是那一次 e2e 红的原因**，
  补的是无条件正确的一条）
- **三条扫描器盖不全自己声称的范围**（wave 84）：`.vue` 的白名单外能溜进
  带硬编码英文的 SFC 而四道门禁全绿；三处 `git ls-files` 看不见未提交的文件；
  剥注释的正则不认字符串，`"/workspace/**"` 一口吃掉 1886 个字符
  （对「数 import」那一半是**静默放过**）
- **「只能变短」那三句话**（wave 85）：`parity-accept` 从「无条件覆盖」变成
  「有新增行就拒写」；另两句守不了的改成实话，并写清真要机器守该用什么判据
- **三处交互态第一次进取样面**（wave 86）：会话行的 ⋯ 菜单量出 7 处（三处根因）、
  侧栏 nav 菜单量出 9 行（少一个 group + 上游的 `menu > link > menuitem` 嵌套，
  **两边同改**）；定时任务的编辑表单 **0 差异**
- **命中测试进取样面**（wave 100）：**过了 wave 99 立的那道门槛**——
  一颗按钮可以名字对、位置对、能 tab 到**却点不动**，那是现有各档都答不了的问题。
  收窄成「只量用户要去点的东西」（第一版三行差异全部来自 `text:` 锚点，
  是「盒子中心恰好压在别的东西下面」，不是差异）。**0 行，而那个 0 是算出来的**：
  给一颗按钮加 `pointer-events: none`，只有这一档响
- **「层级」那一档：做完、量完、撤掉**（wave 99，**代码改动为零**）：
  73 个样本 0 行，而按坑 249 去验那个 0 才发现**它几乎永远不会响**——
  序列化的树里「换爹」必然「换位置」，`order` 那一档先撞上（实测把一项挪出
  `DropdownMenuGroup`：层级档一行没有、order 档当场报出来）。
  **一个几乎永远不会响的字段比没有更糟**，整档撤掉不留残余。
  **第④类到此结束，下一轮别再做第三次。**
- **一条记了很久、而且是规则依据的事实被订正**（wave 98）：记忆里写着
  「React 里零消费者的死代码（`ai-elements/*`、`ui/carousel`）……**禁止移植**」，
  实测 **28 份里有 14 份是活的**（`prompt-input` 8 处外部引用、`conversation` 4 处…），
  真正零消费者的是另外 14 份。已在 `deerflow-vue-alignment-scope` 里逐份列出并附量法
- **ScrollArea 那 42 行核完**（wave 98）：差异全部来自上游给建议行套的那层
  `Suggestions`——**它永远不会真的滚动**（内容 `flex-wrap`、横向滚动条写着 `hidden`），
  **决定不跟**
- **tab 序量出的四处逐条结清**（wave 97）：**关着的分隔条占着一个 Tab 停靠点**
  （`opacity:0 + pointer-events:none` 却仍是 `tabindex="0"`，WCAG 2.4.7，48 行清零）；
  browser 面板 `section` → `div`（没有可访问名的 section 不是地标，4 行清零）；
  菜单 roving tabindex 那 2 行**接受**；滚动区那一处**两边同改**（上游 viewport 补
  `tabIndex={0}`）——并如实交代它换来了第 6 条那处新的结构差异
- **tab 序进取样面**（wave 96）：aria 树看得见节点、看不见「能不能 tab 到」；
  尺子先量自己——第一版 114 行里 **~48 行是别的档已经报过的**（译文那一类的重复 +
  空白文本节点造成的名字差异），收窄描述后 64 行、四处根因全部归因到具体元素
- **一处会让 `make verify` 随机红的泄漏**（wave 96 的 `a165c96c`）：
  DOM 用例把 rAF stub 成 `setTimeout`，`unstubAllGlobals()` 不清已排队的定时器，
  于是「用例全绿、退出码却是 1」，三次只红一次
- **顺序进取样面，并当场修掉它抓到的那一处**（wave 95）：`diffAriaOrder`
  先取公共多重集再比相对顺序（所以「多包一层容器」不误报），
  **第一跑就抓到 `DropdownMenuSubContent` 多包了一层 Portal**——上游 shadcn
  只给 `DropdownMenuContent` 包，本仓照着兄弟抄错了，于是子菜单两项在可访问性树里
  与打开它的触发器**被拆开**。修完新档 **0 行**。
  顺带如实记一笔：本来要做的「复验文件头『做不到』的结论」**这个类比文档说的小得多**，
  10 处里多数是过去式的历史说明，下一轮别再照文档追它
- **焦点进取样面**（wave 94）：交接文档里 wave 28 就记下的「天生看不见的第八类」，
  此前只能靠临时 probe 量；做成 `DiffEntry.focus` 之后一次量出 7 行，
  其中最值钱的一条是**本仓 settings 的 `focusInitial` 挡住了「焦点留在模态外面」**。
  尺子自己先量了一遍：第一版 17 行里 **10 行是描述器造的噪声**
- **mermaid 下载菜单进取样面，方向 A 的清单清空**（wave 93）：菜单本身 0 差异，
  而且**那个 0 是算出来的**（多加一项 `JPG` 当场报一行）；顺带查明冷启动表上最后一条
  「chat 的 composer 菜单」**是过期的**——四个能展开的控件都已挂在别的场景上
- **19 个只跑英文的场景全部补上 zh-CN**（wave 92）：坑 244 系统扫完，21 处锚点
  改成跨语言正则（zh 文案全部从词典反查、不是猜的），量出一整类「上游写死英文」；
  方法上留下一条：**批量加维度先拿可达性层探路**（10 → 7 → 3 → 0）
- **几何档加 `opacity`、步骤档加 `hover`**（wave 91）：两处此前**三档同时看不见**
  的盲区（`opacity: 0` 的元素照样在 aria 树里、照样有位置与色板）；
  `branch-thread` 接上悬停态并**补上 zh-CN 维度**，一次量出 17 行，
  清到 2 行（真差异：两个应用的分支键在中文下取了不同的词典键）
- **channels 的连接对话框进取样面**（wave 90）：新建与编辑**两条互斥分支**各一个
  终态，四个新样本三档全 0；触发器的坐标是**夹具给的 `display_name`**
  （不进词典、两种语言逐字相同），这一处此前挂在「两边没有共用 testid」上
- **「选中态只靠换色」从散文变成守卫**（wave 89）：判据收得住口（`<Button>` +
  条件 `default`/`outline`，**零豁免**），扫出并清掉两边各 12 颗；
  另加一条 DOM 用例守「值跟着状态走」——静态守卫对 `:aria-pressed="false"` 照样绿
- **integrations 的两个交互态第一次进取样面**（wave 88）：权限面板的选中态
  （域 + 自定义 scope，连接键改写成「申请新权限」）与「切换飞书 Bot」的整块表单，
  三档全 0；量的过程中撞出**两个应用都缺 `aria-pressed`**（22 颗域按钮 + 2 颗品牌
  按钮，选中只靠换色），**两边同改**
- **wave 87 漏改的一份折叠断言**（wave 88 的 `55678738`）：`e2e-shell` 红了一轮，
  干净树上照样红——那一轮的收工清单里没有 `e2e-backend`
- **对照场景多了一条 `states` 轴**（wave 87）：一个场景可以有多个**互斥**终态，
  于是改动面板那一整块第一次进取样面，量出 7 处（Sheet 头部结构 / `<details>` 不是
  `Collapsible` / 少了增删数 / 链接的 `aria-label` 污染外层按钮名），全清

---

## 四、收工时的门禁读数（wave 129 逐条实跑，**2026-09-09 之前的快照，数字已过期**）

> 当前读数在 `docs/plans/vue-parity-cold-start.md` 的门禁块里（2026-09-12 实测）。

```
verify           exit 0    265 文件 / 2205 单测；词典 942 key / 18 unused
                           产品 SFC 218（总 220）
standalone-sim   exit 0    跑过 14 / 未跑 5（4 data + 1 e2e）/ 红 0      ← wave 83 新增
                           wave 116 起 test 那一步跑**整套** vitest（此前只跑表里的 8 份）
                           --with-e2e 实测 13 / 4 / 0（那一条：exit 0，47 条跳过）
e2e-parity       95        台账 187 行 / 87 样本（wave 128/129/132/133 各一个失败终态，wave 134 加一个「加载中」终态）
e2e-mock         265 + 22 + 15 + 2 + 6
e2e-backend      2 + 5 + 2 + 3 + 3 + 5 + 1 + 1      ← wave 88 修完 e2e-shell 之后才又全绿
e2e-visual       8         wave 88 一张没重录
asset-budget     exit 0
e2e-external     3         **不在任何聚合入口、也不在收工清单**；wave 107 顺带跑了一次，绿
icon-parity      0 处待核、**0 条 ⚠**（wave 111 起过期豁免会让它 exit 1；
                 **这一行在那之前是假的**，stale 自 wave 87 起一直在报三条）
audit            预期红 14（分诊写在 Makefile 的 audit 上方）
standalone-check BLOCKING 0 处 / 0 个文件（DECLARED 40 处 / 18 个文件）
                 ——**只是静态证明**；「移走还能跑」由 standalone-sim 管
覆盖率棘轮       covered 24 + pending 1 + exempt 2 = 27 = React spec 总数（坐标系已用尽）
React 侧         check 0 / test 1034 / test:e2e 146（wave 97 三条全真跑过）
```

---

## 五、之后要找活，只能从这三个方向选

`app/pages/` 下的路由一条不剩地量过了，台账清零，`icon-parity` 归零，
守卫注释里点名的账也清完了，覆盖率棘轮的坐标系用尽了。

1. **给取样面加交互态**（台账看不见的第①⑦类）。判据：一个域收工前，把它所有
   「点一下才出现」的东西列出来，逐个问「这一屏进过取样面没有」。
   wave 76 量出 27 处、**wave 86 又量出 16 行**（两个菜单），这条一直有货。
   **挂展开态很便宜**：场景 id 受棘轮约束，夹具与 steps 不受。
   **锚点要在这个场景的每一个维度上都成立**（语言维度最容易漏），
   而且别照着词典 key 猜——先量一遍它有没有被渲染。
   **这张表 wave 93 起是空的。** `integrations`（wave 88）、`channels`（wave 90）、
   `branch-thread`（wave 91）、`thread-history-mermaid` 的下载菜单（wave 93）都做掉了；
   最后一条「`chat` 的 composer 菜单」查明**是过期的**——四个能展开的控件都已经在
   取样面里，只是挂在别的场景上（斜杠建议→`sidebar` 的 fill；模型选择器→`agent-chat`；
   模式菜单→`user-message-plain-text` + `ui-polish-mobile`；推理强度→
   `workspace-changes#reasoning-menu`），剩下的 `addAttachments` 是操作系统文件对话框，
   取样够不着。**下一轮找活不要再看这条方向了。**
   **两条通用办法**：① 两边没有共用 testid 时，先去**夹具**里找字符串
   （不进词典、两种语言逐字相同，两个应用拿到同一份，线索 242）；
   ② **给场景补一个语言维度比加一个场景便宜得多，而且不动棘轮**——
   wave 91 就是这么撞出「两个应用在中文下取了不同词典键」的（线索 244）。
   **wave 92 已经把这一条扫完了**：24 个场景现在都跑两种语言，这条路走到头了。
   **wave 87 起可以用 `states` 挂互斥的终态**，不必再二选一。
2. **给现成的尺子加一档**（wave 75 的 `icon-parity`、wave 76 的几何锚点都是这么来的）。
   注意坑 213 / 186：**一把新尺子最先要量的是它自己**——wave 75 那批线索有近一半
   是扫描范围造出来的。

> **方向 B 的存量到 wave 100 基本见底**：`opacity`（91）、`focus`（94）、`order`（95）、
> tab 序（96）、命中测试（100）都补完了——最后这一档同时覆盖了
> `pointer-events` 与「被别的东西盖住」（z-index 的实际后果）；
> **层级那一半 wave 99 量完判定不必做**。
> 再想加档，先按坑 258 问一句：**有没有一种变异能让它响、而现有的档都不响？**

3. **把散文里的断言变成守卫**（**注意：wave 95 量过「文件头里『做不到』的结论」
   这一条，货很少**——10 处里多数是过去式的历史说明，别再照旧文档去追）
   （`tests/guards/` 下已有十条 + wave 83 加进
   `tooling-contracts` 的一组）。加之前先读它们的覆盖面。
   **wave 89 又证明一次**：把 wave 88 的线索 238 做成守卫，当场扫出两边各 12 颗。
   **判据再加一条**：一条规则值不值得做成守卫，先看它**要不要豁免表**——
   要，多半是判据没选对。
   **wave 83/84 连着证明这条最值钱**：83 是一张零消费者的表 17 条里 2 条假；
   84 是三条扫描器盖不全自己声称的范围。**判据两条**：
   「哪一行代码读它」，以及「这把尺子能不能自证盖全」。
   **已经量过、不必再查的**：`tests/guards/` 下各豁免表都已双向守着
   （stale 检查 + 精确颗数 + 字典序）；9 份单测里扫 `.vue` 的正则剥法今天
   一处都没错（219 份逐个比对）。
   **wave 105/106 又连着证明两次**，判据现在是四条，第四条最好用：
   **一张表把全集切成两半，而另一半的处理方式是「不检查」吗？**
   wave 106 用它扫 `app/` 与 `packages/`，五处全中，**其中一处有活违规**。
   **配套的一条**：同一个形状**可以不长成一张表**——`gen-contract-constants.mjs`
   那处是三个 `readContract("…")` 调用点，只 grep 常量声明会漏掉。
   **还没筛的同形目标**：`app/` 里以**后端**为全集的两张表
   （`DEERFLOW_DURABLE_STATUS` / `DEERFLOW_WIRE_EVENTS`，头里都写着「全集」，
   实测当前都对，但补守卫要把 `backend/` 拉进 `make verify` 的读取面，代价先想清楚）。
   **已筛过、不是缺口的**（别重筛）：`shared/showcase.ts` 三张表（已双向）、
   `config/routes.ts` 的 `csrRoutes`（不声称覆盖全集）、
   `SUPPORTED_RUN_STREAM_MODES`（白名单本来就更大）、
   `SECTION_ICONS` 与 i18n `settings.sections`（tsc 双向管住）、
   各种扩展名/协议 allowlist（全集无限）。

> **这条尾巴没有自然终点。** 历史命中率：wave 100 补上最后一档（并证明了它响）、
> wave 99 撤掉一档不该要的、wave 98 订正一条当规则用的错事实、
> wave 97 结清 tab 序那四处、
> 修掉一处「看不见却占着 Tab 停靠点」的真缺陷、
> wave 96 把 tab 序接上、量出四处此前
> 任何一档都看不见的差异，外加一处会让 verify 随机红的泄漏、
> wave 95 把第④类的顺序那一半补上、
> 第一跑就抓到一处 primitive 抄错、修完新档 0 行、
> wave 94 把挂了 66 轮的「第八类」补上、
> 一次量出 7 行（其中一条证明了本仓一段代码挡的是真缺陷）、
> wave 93 把方向 A 的清单清空
> （最后一处 0 差异，而且证明了那个 0 是算出来的）、
> wave 92 把「语言维度」这条路一次扫完、
> 量出一整类 28 行的已决定差异、wave 91 给尺子加两档、一次量出 17 行
> （其中一条真差异藏在一个**从来没取过的语言维度**里）、
> wave 90 把挂了好几轮的 `channels` 对话框
> 接上（四个新样本 0 差异，值在于**这一块从此永久有覆盖**）、
> wave 89 把上一轮的线索做成守卫、当场又捞出两边各 12 颗、
> wave 88 捞出**一处两个应用都有、而对照天生看不见**的缺陷
> （外加一条红了一轮的用例）、wave 87 捞出 7 行、
> wave 86 捞出 16 行、wave 75 捞出 6 处真差异、wave 76 捞出 27 处、
> wave 82 捞出一个**两个应用都存在**的产品缺陷、wave 83 证伪了**验收判据自己**、
> wave 84 捞出三条「扫描器盖不全自己声称的范围」、wave 85 把一条只靠人记得的
> 闸门变成了机器守的、wave 86 一次接上三处交互态就量出 16 行、
> wave 87 给尺子加一条轴又量出 7 行。**什么时候收，是个停止规则问题，
> 不是一个能算出来的轮数。**
