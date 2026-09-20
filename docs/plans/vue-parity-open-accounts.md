# React → Vue 平替：挂账总清单（截至 2026-09-20 第五十八轮）

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

> **⚠ 下面这张表是**还账前**的快照**（2026-09-16 第三十轮的分族），
> 留着是因为它记录了归族与路径的推导。**逐族还账进度**：
>
> | 族 | 当时 | 现在 | 谁改的 |
> | --- | --- | --- | --- |
> | A `scroll-area-viewport` 可 tab | 6 条 / 105 投影 | **0** | 本仓补上游缺的整层 `Suggestions`（第三十一轮） |
> | B 请求集合 | 9 条 / 43 投影 | **1 条 / 2 投影** | 大头（33 投影）是重试策略，**两边同改**（第三十二轮）；侧栏窄屏挂载时机那 8 个**两边同改**（第三十四轮）；剩下的 2 个是 `thread-title-sync` 上游多发的 `GET /langgraph/threads/{id}` |
> | C 请求体 | 2 条 / 2 投影 | 2 条 / 2 投影 | 未动（判词见第三十轮条目） |
> | D 多账号绑定块 | 12 条 / 12 投影 | **0** | **改上游**：它把账号列表塌成了一条（第三十三轮） |
> | G 分栏把手 | 1 条 / 2 投影 | **0** | **两边同改**：上游那 4px 拖拽热区改成 16px（第三十四轮） |
> | E/F/H + 其余 | — | **7 条 / 9 投影** | 未动（tooltip 播报节点 / 焦点落点 / alert 播报 / `div(menuitem)`） |
>
> **现状读数**（2026-09-17 第三十五轮 accept 之后的签入基线）：
> **147 场景-维度 / 0 唯一行 / 0 多重集 / 0 条不同的差异**，起点是 170 个投影。
>
> **清零了，但 0 不等于对齐完成**：台账只覆盖这 147 个场景-维度，
> 取样面之外它一个字都没说。覆盖率棘轮 covered 37 / pending 1 / exempt 3。
> 边界说明与下一轮三条方向写在 `NEXT-WINDOW.md`，**那份是当前版本**。

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


> ## 2026-09-17 第三十七轮：**尺子第一次离开这台笔记本，台账当场不是 0**
>
> ### 一、读数
>
> `e2e-parity` 接进 CI 的**第一次运行就红了**（run 35143922501，commit `98f27946`）：
>
> | | 本机 macOS | ubuntu-latest（首跑） | ubuntu-latest（修完动画等待后复量） |
> | --- | --- | --- | --- |
> | `e2e-parity` | 158 passed / 台账 0 行 | **1 failed / 155 passed**，台账 **16 行** | **1 failed / 157 passed**，台账 **8 行** |
> | `e2e-parity-auth` | 绿 | 绿（suite 步骤 2m53s） | 绿 |
> | `icon-parity` | 绿 | 绿（瞬时） | 绿 |
>
> **所以「台账清零」这句话此前的边界还要再收一格**：它不只是「当前尺子、当前
> 取样面」，还是**「当前这台笔记本」**。第三十六轮那句「0 是复现过的，不是单次
> 读数」也只在 macOS 上成立——复现两次，两次都是同一台机器。
>
> 16 行按形状分成五组（原始读数在 CI artifact `parity-failures` 的
> `e2e-parity/report.json` 里，别照抄下面的转述）：
>
> | 组 | 行 | 形状 | 初判 |
> | --- | --- | --- | --- |
> | A | 5 | `integrations` 的 card-title / textbox **宽度 Δ≈4.1–4.2px** | 未判 |
> | B+D | 4 | 按钮 background **alpha=230 / 102** | **已判：取样器不等动画。已修，复量消失** |
> | C | 3 | `hit React=self Vue=div` | **同上，复量消失** |
> | E | 3 | `artifact-table-preview` 的 **y 偏移 Δ-18 / -2.1** | 未判 |
> | F | 1 | `requestsOnlyVue: POST /api/threads/search` | **同上，复量消失** |
>
> ### 二、三次 Linux 读数放在一起：**8 行是真差异，9 行是尺子在飘**
>
> **同一棵树跑三次**（run1 没有动画等待，run2/run3 有）：
>
> ```
> run1 16 行 | run2 8 行 | run3 16 行
> 三次并集 17 行 —— 稳定(3/3) 8 行，飘的 9 行
> ```
>
> | 出现模式 | 行数 | 是什么 |
> | --- | --- | --- |
> | `[111]` 三次都在 | **8** | A 组 5 行（`integrations` mobile 宽度 Δ4.1–4.2）+ E 组 3 行（`artifact-table-preview` 的 y 偏移）。**三次数值逐字相同** |
> | `[1.1]` 只有 run2 干净 | 6 | `permission-request` 的 `Docs background` ×3 与 `Request permissions hit` ×3 |
> | `[..1]` / `[1..]` | 3 | mermaid 的 `PNG background`（run1 1 个、run3 2 个）、`POST /api/threads/search`（只 run1） |
>
> **只有 A 组和 E 组是账，其余是尺子不稳。**
>
> ### 三、**本轮第三次同一形状的错：拿一次运行当结论**
>
> 我先判「B+D 是取样器不等动画」，加了 `waitForFiniteAnimations`，run2 量到
> **16 → 8**，于是写成「实测，动画等待确实是其中 8 行的根因」——
> **run3 同一棵树又回到 16 行，把它推翻了**。run2 是异常采样：那 6 行在 run1 和
> run3 都在，只有 run2 全干净，**是整轮的效应而不是逐行随机**，
> 更像那台 runner 当时快慢不同。
>
> 这一轮我在同一个形状上栽了三次，形状是**「说得通的东西被当成读数」**：
>
> 1. 用算术（`230/255 = 90.2%` 恰好是 Tailwind `/90` 档）推翻一次实测；
> 2. 用源码结构（`CardTitle` 是块级 div）排除字体——而 React 自己的注释里记着
>    那一列卡在 min-content 上，**宽度确实是文本派生的**；
> 3. 用**一次**运行的 16 → 8 判定根因。
>
> **判据：一次运行是一个样本。** 判「修好了」要同一棵树连着量到稳定；
> 判「飘」只要两次不一致就够。飘和修好在单次读数上长得一模一样。
>
> `waitForFiniteAnimations` **留着**，但它的理由降级为**健壮性**
> （固定 700ms 的静置快慢取决于机器），**不再声称它消除了任何一行**。
>
> ### 三之二、把指针归位：**总数涨了，但逐行看是尺子变准了**
>
> 飘的那几行是 hover 态，不是样式差异——判据：`230/255 = 90%`，而两个应用
> `Button variant="default"` 的基类**逐字相同**、都写着 `hover:bg-primary/90`。
> 起因是两侧同屏滚动位置差约 110px，**同一个指针坐标落到不同元素上**
> （Vue 的 Authorization scope 标题在 y=456、React 在 y=346）。
>
> ⚠ **截图归属按代码钉**：`diff.spec.ts` 里 `captureScenario` **先采 Vue 再采 React**，
> 所以 `test-failed-<2i+1>` 是 Vue、`<2i+2>` 是 React。
>
> 修法 `parkPointer`：取样前把指针挪到 (0,0)。
>
> #### ⚠ 这里我按总数判错过一次，**逐行才是结论**
>
> 加上它之后台账总数 **16 → 29**，我据此判「它把场景弄坏了」并回退。
> **逐行比对（run 35183780602 → 35186315711）推翻了那个判断**：
>
> | | 行数 | 内容 |
> | --- | --- | --- |
> | **消掉的** | 7 | `Docs background` 那一族 hover 伪差异 |
> | **新照出的** | 20 | **两个根因的真差异，见下** |
>
> **总数是两个方向叠加出来的，方向相反，所以总数不含信息。**
> 这是本轮第五次「说得通的东西被当成读数」——这回是**总数**。
>
> #### 新照出来的行分两类，**其中一类是我自己造的**
>
> **不是账：`branch-thread#turn-actions` 那 6 行。** 那个场景的步骤**本身就是
> `kind: "hover"`**——它明确声明「我要采悬停打开的 tooltip」，
> 而第一版 `parkPointer` 无条件归位，把场景自己摆好的姿势撤销了。
> 修法是**场景里有 hover 步骤就不归位**：那种场景里「指针停在哪」是判据本身，
> 不是残留状态。
>
> **账 I 原判「Vue 的子菜单不收」——那 14 行里 12 行是尺子造的。**
> `page.mouse.move` 默认 `steps: 1`，指针**瞬移**、中间不产生 `pointermove`；
> 而菜单库判「要不要收子菜单」靠的正是指针经过父菜单时那串 `pointermove`
> 与安全三角宽限区（Radix 与 reka 的 `handlePointerLeave` 我逐行比过，
> **几乎逐字相同**）。瞬移把那条路径整个跳过。
>
> 本机 `PARITY_ONLY=thread-history` 实测（一次 2.2 分钟）：
> `steps: 1` → **14 行**；`steps: 12` → **2 行**。已改成 `steps: 12`。
>
> **剩下的 2 行是真账（账 I′）**：
> `tabbablesOnlyVue: div(menuitem)[dropdown-menu-item]`，两个语言各一行。
>
> **认出它靠的是同轮放宽的标签规则**（见下）：此前它读作 `div(menuitem)`
> ——菜单里每一项都长这样，说不出是哪一个，我为它单开过一个探针，
> 而 `capture.ts` 自己就写着「**一条要靠探针才认得出的账，等于没有账**」。
>
> 读数：两边 26 / 25 项 tabbable 逐项相同、Vue 末尾多一个；`aria` 档 0 行、
> `focus` 档 0 行。也就是**菜单打开时 React 有 0 个 tab 停靠点、Vue 有 1 个**，
> 而那一个是**普通菜单项**（不是子菜单触发器）。
>
> ⚠ **这一处很可能是 React 不对，方向与第三十五轮正好翻过来。**
> ARIA APG 的 menu 模式要求菜单里**恰好有一个** tab 停靠点
> ——第三十五轮补 `vMenuTabStop` 时引的就是这一条；0 个意味着 Tab 进不去。
> 疑是 Radix 的 `onItemLeave` 在指针离开菜单项时把焦点收回 content、
> 顺带清掉了那个停靠点，**但这是推测，没量**。
>
> **判词：按「两边都不对时取业界做法两边同改」处理，优先级排在 A/E 之后**
> ——它 2 行，A/E 8 行，而且 A/E 是纯粹的对齐缺陷。
>
> #### 顺带：tabbable 标签规则放宽了（永久改进，此刻代价为零）
>
> 原规则**只在没有 role 时**才补 `data-slot`，理由写的是「有 role 的本来就认得出」
> ——`div(menuitem)` 证明那条理由不成立。已改成 **generic 标签（div/span）就补**。
> **此刻改代价为零**：签入基线是 0 行，没有任何既有行文本要跟着改写。
>
> ### 三之三、**A 组没有结清——我"修好"它的办法是把一处承重的遮挡拆了**
>
> ⚠ **这一节整个订正过。** 先写的是「A 组结清，根因是 ScrollArea 那四处基类」
> （run8 实测那 5 行确实一条不剩）。**收工前核 CI 才发现同一次提交把
> `frontend-vue verify` 搞红了**：`tests/e2e/integrations.spec.ts` 的
> 「设置面板在 375px / 360px 屏上装得进对话框」从 `panelOverflow: 0` 变成 `4`。
>
> 根因是我把本仓 ScrollArea 根元素的 `overflow-hidden` 按「逐字对齐上游」删掉了。
> **那颗类是承重的**：对 grid/flex 子项，`overflow` 非 `visible` 会把
> 「自动最小尺寸」从 min-content 变成 0，这一层因此能缩到内容宽度以下。
>
> **它同时就是 A 组那 4px 的来源**——本仓靠它多缩 4px，内容比上游窄
> （`card-title` 76.3 vs 72.1、`textbox` 203.1 vs 199）。
> 也就是说：**台账那 5 行和「窄屏不溢出」是同一个「0 余量」的两面**，
> 拆掉遮挡只是把账从一边搬到另一边。
>
> **已恢复 `overflow-hidden`**，豁免重新挂上并写了这一轮量出来的真理由与翻案判据。
> **A 组重新计入未结清（5 行）。**
>
> **真正该修的**：`CardHeader` 的 `grid-cols-[1fr_auto]` 里第 2 列那颗
> `whitespace-nowrap` 的 Refresh 按钮顶着 min-content
> （第二十一轮量到同一张卡 375px 下「macOS 恰好装得下、Linux 溢出 9px」）。
> 把那个 0 余量修掉之后，`overflow-hidden` 才该删，A 组才真的结清。
>
> **同轮真正对齐的**（与上面无关，保留）：滚动条 `p-px` / `w-2.5` / 透明左上边框、
> viewport 的整组焦点环——这四处是真的逐字差异，已对齐。
>
> ### 三之三之二、原记录（run8 的读数，仍然是真的，但结论被上面推翻）
>
> `frontend-vue parity` run 35193198808（ScrollArea 对齐后的第一次全量）：
> **A 组那 5 行 `width React=… Vue=… Δ-4.1/-4.2` 一条不剩。**
> 那 4px 既不是字体（run6 的 `fontFamily` 档 0 行已实测排除），
> 也不是 header 结构 / 文案 / 图标 / 按钮基类（源码逐字对过），
> **是滚动区 primitive 的基类差**：`w-2.5` vs `w-2`、`p-px` vs `p-0.5`、
> 少一道透明边框、Root 多一个 `overflow-hidden`。
>
> **它为什么只在 Linux 显形**：macOS 的覆盖式滚动条不占布局，
> Linux 的经典滚动条占；而这一族本来就贴着 0 余量
> （第二十一轮量到同一张卡 375px 下「macOS 恰好装得下、Linux 溢出 9px」）。
>
> ### 三之四、同一轮里尺子照出的另外两笔
>
> **账 J：那 30 行不是账，是我放宽标签造出来的——而我第一次修错了方向。**
>
> 放宽标签后 CI 上多出 30 行
> `tabbablesOnlyReact: div(separator)[resizable-handle]` 对
> `tabbablesOnlyVue: div(separator)`。上游用 shadcn 的 Resizable primitive、
> 手柄自带那颗属性；本仓用 splitpanes，**根本不存在这个 primitive**。
>
> **我的第一反应是往 Vue 的 splitter 上 `setAttribute("data-slot", …)`——
> 被 `tests/guards/invariant-ownership.test.ts` 当场拦下，而那条不变量是对的。**
> `data-slot` 是 shadcn 标识 primitive 部件的约定；为了让尺子闭嘴，
> 往一个压根没有那个 primitive 的实现里塞一颗没有意义的属性，方向反了。
>
> **判据（值得单独记）**：尺子报出差异时先问**两边用户看到的东西有没有区别**。
> 这里角色、几何、可达性完全一样，差的只是一颗内部样式钩子——**那是尺子的问题**。
>
> 改的是尺子：`data-slot` **只在标签重复、确实需要区分时才补**。
> `div(menuitem)` 有多个，补；`div(separator)` 全树只有一个，不补。
> 本机 `PARITY_ONLY=artifact-panel-resize` 复量：**0 行**，
> 而 `[dropdown-menu-item]` 的区分能力保留。
>
> ⚠ **同一段里我还犯了一个流程错误**：把 `make verify` 与 `git commit && git push`
> 串在一条命令里，看到 `VERIFY_EXIT=2` 时已经推出去了，分支带着一条红。
> **门禁的退出码要卡住提交**，不能只是打印出来。
>
> **账 K：菜单项在指针移出后不释放焦点（6 行，已修）。**
>
> 两处：`thread-history` 的 `tabbablesOnlyVue: div(menuitem)` ×2、
> `thread-list-pin` 的 `tabbablesOnlyVue: a(menuitem)` ×2 与
> `focus: React=div Vue=a "…官网…"` ×2。
>
> **用户看得见**：鼠标移出打开的菜单后，本仓留一项亮着、上游不留。
> 而它**六档全盲**——aria 树一样、几何一样、请求一样，
> 只有同轮新加/已有的 `focus` 与 `tabbables` 两档照得出来。
>
> #### 排查路径值得记：**三次从源码推，三次被源码推翻**
>
> | 猜法 | 被什么推翻 |
> | --- | --- |
> | reka 在指针离开时不收焦点 | 两库 `onItemLeave` **逐字相同** |
> | 开菜单时焦点落点不同 | 两库 mount auto-focus **逐字相同** |
> | 那一项的元素本身不同 | 两边都是 `as-child` 包 `<a href target rel>`，标记等价 |
>
> 三处**确实逐字相同**，分岔在它们之外——**「源码一样」不等于「运行时一样」**。
> 最后是探针在两个时刻各拍一张快照才定位到：
>
> ```
> 跑完场景步骤：  两边都是 active=div(menu) ti=-1，六个菜单项全 ti=-1
> 指针归位之后：  上游一切不变；本仓 active=a(menuitem) ti=0 ——那一项拿着焦点不放
> ```
>
> #### 修法
>
> 在 `vMenuTabStop` 指令里补一个 `pointerleave`，与上游 Radix 的 `onItemLeave`
> （`contentRef.current?.focus(); setCurrentItemId(null)`）同形：
> **指针真的离开整个菜单时，把焦点交还菜单容器。** 三条保险：
> 只认鼠标事件、只在该元素确实持有焦点时动、`relatedTarget` 仍在同一份菜单内容里
> （挪到兄弟项或正往子菜单走）一律不管——**最后那条正是第三十五轮踩过的坑**
> （在 reka 的事件序列中间抢焦点会让子菜单打不开）。
> 全程只 `focus()` 容器、不碰 prop、不经过渲染。
>
> **复量**：探针四个状态全部一致；本机 `PARITY_ONLY=thread-list-pin` 与
> `PARITY_ONLY=thread-history` 双双 **0 行**（此前 4 + 2）。

> ### 三之五、E 组：**探针一次抓出两条，其中一条根因在上游**
>
> 两边那个 `<p role="status">` 的运行时快照（本机探针，平台无关的部分）：
>
> ```
> Vue  : text="Some rows have different numbers of fields. Missing fields are marked."   width=460.4
> React: text=" Some rows have different numbers of fields. Missing fields are marked."  width=458.4
>                ↑ 句首多一个空格
> ```
>
> `font` 简写两边逐字相同、内边距相同、高度相同——**所以不是字体、不是内边距**。
>
> #### ① 上游的句首空格（已修，根因在 React）
>
> `artifact-table-preview.tsx` 里写的是
> `{columnCount > 50 && labels.columnsLimited}{" "}{unevenRows && labels.uneven}`
> ——那个 `{" "}` 本意是**两句话之间的分隔符**，但第一句为假时它**照样渲染**，
> 于是最常见的情形（有缺字段、列数没超限）渲染出的是**句首带空格**的文本。
>
> **平时完全看不见**，只有当这一行正好卡在折行临界点上才显形——而那一屏恰好是：
> 一个空格把 React 推到第二行，整张表下移 18px。
>
> 修法：先 `filter(Boolean)` 再 `join(" ")`，两边输出逐字一致。
> **这是「修 React 自身缺陷」那条已授权的例外**，不是把本仓改成和上游一样错。
>
> #### ② 那 2px 的根因：**本仓整层漏了上游的 `Artifact` 外框**（已修）
>
> 祖先链探针逐层打两边的宽度/内边距/边框，一眼看出 React 多一层：
>
> ```
> React  4 div w=460.4 bd=1px/1px cls="bg-background flex flex-col overflow-hidden rounded-…"
> Vue    （没有这一层）3 section w=460.4 → 4 div w=492.4 p-4
> ```
>
> 上游 `ai-elements/artifact.tsx` 的 `Artifact`：
> `bg-background flex flex-col overflow-hidden rounded-lg border shadow-lg`，
> 只在 artifact 这一路用（`artifact-file-detail.tsx:397`），
> **sidecar / browser 两个面板都没有**——所以那两处不带框是对的。
>
> **本仓的 artifact 面板因此没有边框、没有圆角、没有阴影**，用户看得见；
> 那 2px 只是它的副产品，而 2px 正好压在容差线上，于是表现成
> 「警告在上游折行、本仓不折，整张表错开一个行高」。
>
> **又一次六档全盲**：边框挂在非锚点的 div 上，aria 树不带边框。
> 已补在 `ArtifactPanel.vue` 的根 `section` 上。
>
> #### 这一笔的普遍意义
>
> **对照工厂不只是让 Vue 追上 React。** 两个独立实现写同一份设计，
> 不一致处就暴露**至少一侧**的缺陷。本轮已经三次根因在上游或两侧：
> 第三十六轮的 `context.thread_id`（两边都发一个服务端保证丢弃的值，
> 且上游发的还是错的那个）、账 I′（菜单 tab 停靠点 0 个，疑 React 不符 APG）、
> 以及这次的句首空格。
>
> ### 三之六、**E 组结清**，而 `hit` 那笔我又一次拿单次运行当了结论
>
> run 35202704174（两个 E 组修法之后）：**E 组那 3 行一条不剩**。
> 上游的句首空格 + 本仓漏掉的 `Artifact` 外框，两个修法都对。
>
> #### ⚠ 但 `hit React=self Vue=div` 回来了，而我上一轮说它「已随账 K 消失」
>
> 四次 Linux 读数：
>
> | run | 8 | 9 | 10 | 11 |
> | --- | --- | --- | --- | --- |
> | `hit` 行数 | 2 | 3 | **0** | 3 |
>
> 我根据 run10 的 0 写下「`hit` 跟着账 K 一起消失，证实同源」——
> **那是又一次拿单次运行当结论**，而这个错本轮已经栽过一次、还写进了记忆
> （`measure-dont-guess` 第 9 条）。run10 只是一次幸运采样。
>
> **判词订正：`hit` 是飘的，与账 K 无关（K 修好之后它照样出现）。**
> 它只在 Linux 出现（macOS 四次本机复量都是 0 行），所以**本机诊断回路对它无效**
> ——这也是它比其他几笔难办的原因。

> ### 三之七、剩下的唯一一笔：`hit`（3 行，飘，Linux-only）
>
> `integrations#permission-request` 三个维度：
> `role:button[/^(Request permissions|申请新权限)$/] hit React=self Vue=div`。
>
> **现场看图就明白**：run11 的截图里**本仓那颗按钮根本不在可视区**
> （面板滚动位置比上游高、按钮落在折叠线以下），它的中心点因此打到了
> 对话框外的遮罩 div 上；上游那颗可见，命中 `self`。
>
> #### 量到哪一步了（本机探针，平台无关的量）
>
> | | scrollTop | scrollHeight | clientHeight |
> | --- | --- | --- | --- |
> | 本仓 | **460** | 950 | 490 |
> | 上游 | **411** | 950 | 490 |
>
> - **内容度量完全相同**（950 / 490）→ **不是布局差异、不是内容高度差异**；
> - `maxScrollTop = 950 - 490 = 460`：**本仓滚到了最底，上游只做了最小滚动**；
> - 场景那一步是 `fill` OAuth 输入框，而 Playwright 的 `fill` 会把元素滚进视野。
>
> #### 已排除
>
> - 两边**都没有任何显式滚动代码**（`scrollIntoView` / `scrollTop` / `scroll-margin` 零命中）；
> - 两边**都没有 `scroll-behavior: smooth`**（所以不是滚动动画没停稳）；
> - 输入框前后的标记**逐字等价**（`Input` + `<p class="text-muted-foreground text-xs">`）；
> - **不是我这一轮引入的**：run1 / run3（改 ScrollArea 之前）就有这 3 行。
>
> #### 下一步（别从源码推，本轮在这上面栽过四次）
>
> 要的是**在 `fill` 这一步前后插桩**：记录两个应用在 click Calendar → click Docs →
> fill 三个时刻的 `scrollTop` 与那颗连接键的位置，看分岔发生在哪一次交互。
> 猜测是点击 chip 让连接键的文案从「连接」变成「申请新权限」，行宽变化导致
> 中间态的内容高度不同、于是 `fill` 的最小滚动量不同——**但这是猜测，没量**。
>
> ⚠ **它在 macOS 上量不出来**（本机四次复量都是 0 行），所以 2.2 分钟的本机回路
> 对它无效，只能用 `parity_only` 在 Linux 上定点跑。

> ### 四、A / E 两组当时的排查过程（**A 组已结清，见三之三**）
>
> #### A 组（5 行，`integrations` 三个 mobile 档的宽度 Δ≈4.1–4.2px）
>
> **已经排除掉的，逐条带判据——别重查这五项。**
>
> | 排除项 | 判据 |
> | --- | --- |
> | 字体渲染 | CI artifact 里那两张 375×812 Linux 截图（`test-failed-177/178.png`，177=Vue、178=React，按输入框右边缘 288 vs 292 对上 199 vs 203.1）：**字形完全一致**，差别只在换行位置与输入框宽度 |
> | 文案 | `settings.integrations.lark.title` / `.description` 两边词典**逐字相同** |
> | header 结构 | 两边都是 `CardHeader class="px-4 sm:px-6"` → `flex min-w-0 items-center gap-3` → `shrink-0` 图标 → `min-w-0` 文本列 → `CardAction`，**逐字相同** |
> | 图标尺寸 | 两边都是 `size-5` 包在 `p-2 rounded-lg` 里，**逐字相同**（`icon-parity` 那道门也绿） |
> | 按钮基类 | `Button` 的 `size="sm"`：React `h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5`，Vue 同一集合（只是 class 顺序不同） |
>
> **宽度是怎么来的**（React 自己在 `integrations-settings-page.tsx:642` 的注释里写了，
> 第二十一轮实测）：有 `CardAction` 时 `CardHeader` 是 `grid-cols-[1fr_auto]`，
> 第 1 列是默认 `min-width: auto` 的 grid 子项，**降不到自己的 min-content 以下**
> （icon 36 + gap 12 + text 89 = 137px）。375px 下 **macOS 恰好装得下、Linux 溢出 9px**
> ——**和 A 组是同一族**。
>
> 所以 `card-title` 的宽度**确实是 min-content 派生的**（我一度据「它是块级 div」
> 判成「与文本无关」，**那是第二次同类越界**，已订正）。而三项输入都相同，
> 那 4px 只可能出在**第 2 列那颗 Refresh 按钮的 min-content** 上：它宽 4px，
> 第 1 列就窄 4px。**源码层查到这里为止，再往下只能靠定点复量。**
>
> #### 追 A 组时挖出的一笔**独立真账（已修）**：ScrollArea 的基类差四处
>
> 路子是顺着门禁自己的规矩走出来的，值得记：
>
> 1. `fontFamily` 报 0 行 → **字体排除**，于是回头查容器；
> 2. A 组那几屏都在**设置对话框**里，而那一屏用 `ScrollArea`；
> 3. `tests/guards/primitive-base-classes.test.ts` 给 `ScrollArea` 挂着豁免，
>    **豁免自己写了翻案判据**：「哪天台账在 ScrollArea 所在的屏上报出几何差异，
>    就回来逐字对一遍」；
> 4. **条件正好满足**——A 组那 5 行几何差异就出在那一屏。
>
> 逐字对出来四处真分歧：
>
> | | 上游 | 本仓（改前） |
> | --- | --- | --- |
> | 滚动条内边距 | `p-px`（1px） | `p-0.5`（2px） |
> | 竖条宽 | `w-2.5`（10px） | `w-2`（8px） |
> | 透明左/上边框 | `border-l border-l-transparent` | 无 |
> | viewport 焦点环 | `focus-visible:ring-ring/50 … ring-[3px] … outline-1` 一组 | 只有 `outline-none` |
> | Root | `relative` | 多一个 `overflow-hidden` |
>
> **滚动条是用户看得见的东西**，10px 与 8px 是实打实的视觉差，
> 而它不进可访问性树、也不是台账的锚点，所以六档一条都不响——
> 与 `fontWeight`、`borderRadius` 那两次是同一个形状的盲区。
>
> 已全部对齐；**豁免退役后门禁直接通过**（说明现在逐字相同）。
>
> ⚠ **它是不是 A 组那 4px 的根因，还不知道** —— macOS 上那几屏本来就是 0 行，
> 要 Linux 读数说了算。**别把「顺着线索挖出来的真账」直接当成「根因找到了」**，
> 本轮已经在这种地方栽过。
>
> #### E 组（3 行，`artifact-table-preview` 的 y 偏移 Δ-18 / -2.1）
>
> **看截图就看出来了，而且它很可能和 A 组是同一个根因。**
>
> 表格面板顶上那条警告——「Some rows have different numbers of fields.
> Missing fields are marked.」——**React 折成两行**（在 `are` 后断开），
> **Vue 排成一行**。下面整张表因此错开约 18px，正好是一个行高。
>
> 对得上台账：`Missing y React=305 Vue=286.9`、`Ada, L. y React=221 Vue=203`
> ——**React 更靠下**，因为它上面多了一行。
>
> **把两组连起来的是宽度**：一条文本折不折行，取决于容器宽几个像素；
> 而 A 组量到的正是**同一量级的 ~4px 宽度差**。
> zh-CN 那行只有 Δ-2.1 也吻合——中文那句更短，两边都不折行，只剩残差。
>
> ⚠ **方向和 A 组相反**：这里是 **React 更窄**（所以它折行），
> 而 integrations 那边是 React 更宽（203.1 vs 199）。
> 所以不是「Vue 一律窄 4px」这种整体缩放，**是某一层容器的盒模型在两处各自不同**。
> **未判**：还没有读数说出那 4px 具体出在哪一层。
>
> #### ⚠ A 与 E 合起来看有一个**还没解开的矛盾**，别急着下结论
>
> 三条读数摆在一起是互相打架的：
>
> 1. **两组在 macOS 上都是 0**（签入基线 0 行）——所以那个宽度差在 macOS 上
>    **小于 2px 容差**，在 Linux 上是 4.1px。**差值本身随平台变。**
> 2. 随平台变 → 指向**文本度量派生**（min-content / 折行），
>    而 React 自己的注释也确实说那一列卡在 min-content 上；
> 3. 但 CI 截图里**两侧字形一模一样**，两边的 header 结构、文案、图标、
>    按钮基类也**逐字相同**——找不到让文本量出不同宽度的源头。
>
> 再加上 A 与 E **方向相反**（integrations 是 React 更宽，artifact 面板是
> React 更窄），「Vue 一律窄 4px」这种解释也不成立。
>
> **所以这两组现在都是未判，而且连「是不是同一个根因」都未判。**
> 我这一轮在这里来回改过两次判词（先「排除字体」、后「文本派生」），
> **两次都是从源码/截图推的，没有一次是量的**。下一个窗口不要接着推——
> **要的是一次 Linux 上的定点读数**：那几个锚点上
> `getComputedStyle(el).font` 两边是不是同一个值、那 4px 落在哪一层盒子上。
>
> **这一族还有一个更值得记的形状**：第二十一轮量到 integrations 那张卡在 375px 下
> **macOS 恰好 0 余量、Linux 溢出 9px**。加上这两组，本仓有**好几处贴着 0 余量**，
> 任何一点度量差都会把它们推过临界。**真正该修的是那个 0 余量，不是追某一次折行。**
>
> #### 顺带记下的一处真实源码差异（与上面两组都还没连上）
>
> React `styles/globals.css` 在 `@theme` 里定义 `--font-sans`（尾部四个 emoji
> 兜底字体，与 Tailwind v4 默认值逐字相同）；Vue `assets/css/main.css` 的 `body`
> 用 `ui-sans-serif, system-ui, sans-serif` 覆盖掉它、**丢掉那四个兜底**，
> 且 `@theme inline` 里没有 `--font-sans`。macOS 上两边都落到 San Francisco，
> 所以这个分叉在本机**量不出来**。
> **它是一处该对齐的差异，但目前没有任何读数把它和 A/E 连起来**——
> 别拿它当那 8 行的根因。
>
> ### 五、没做的事，以及为什么
>
> **没有重录基线。** 把 Linux 那 16 行 accept 进去等于把回归洗白
> （Makefile 里那句「把回归洗白的按钮」），而且其中至少 4 行是尺子自己的噪音。
> **也没有放宽几何容差**：2px 那个阈值是先定后测的，为了让红变绿去调它，
> 正是判据里点名禁止的那种打补丁。
>
> 代价说清楚：**`frontend-vue parity` 这条工作流现在是红的**，而且在 A/C/E/F
> 四组判完之前会一直红。这是有意的——它红着说明它在量东西，
> 而它量出来的正是本机十四轮都没看见的东西。
>
> ### 六、第三十六轮那套改动，第三十七轮独立审过一遍（**别再审**）
>
> `98f27946` 是另一个会话提交并推送的，提交说明写得很细——但**说明不是判据**。
> 第三十七轮对着代码和后端源码重审了一遍，结论是**站得住，不回退**。
> 查过的四项与各自的判据：
>
> | 改动 | 判据（现场量的） | 结论 |
> | --- | --- | --- |
> | 删 `context.thread_id`（两边同改） | `backend/app/gateway/services.py:763` 是**合并调用方 context 之后的无条件覆盖**，`thread_id` 取自 URL path；两个应用仍发别的 context 键，所以走的正是这个分支，agent 照样拿得到 | 属实 |
> | `stream_mode` 拔掉 `values` | `reduceUpdates` 逐通道 patch、其余通道原样保留、`messages` 走 `add_messages`；「上游只订这三个」是**台账 `requestBodies` 行里 React 侧的实测 wire**，不是引文档；`values` 的处理代码**保留**（`stream_mode` 整字段缺失时 Gateway 退回 values-only）；`e2e-backend` 对真 Gateway 全绿 | 站得住 |
> | 新增 `useThreadMetadata` | 四处失效 `["thread","metadata",id]` 此前确实**没有任何查询拥有这颗 key** | 补的是真缺口 |
> | 台账对账 | `git show 98f27946 -- baseline/parity-diff.json`：**精确减 3 行、不增一行**，与三条根因一一对应 | 对得上 |
>
> **专门查过「测试有没有被改松」**——结果是**改严了**：
> `chat-dataflow.spec.ts` 的键集仍是 `toEqual` 全等，而且**新增**了一条
> `expect(body).not.toHaveProperty("stream_resumable")`；
> `model-capabilities.test.ts` 只是跟随 `buildRunContext` 去掉参数，断言仍是 `toEqual`。
>
> 唯一要记住的形状是那次提交本身的教训（已在 `c10df2f5` 补记）：
> **`git add -A` 之前要重新看一次 `git status`**——那次把另一个会话的在途成果
> 一并提交了，而提交说明里一个字没提。记录失真比多提交几个文件严重。

---


> ## 2026-09-17 第三十六轮：**最后两条——一条是本仓缺了一层，一条是两边都在发空转字段**
>
> ### 一、`stream_mode` 拔掉 `values`
>
> 上游 wire 上是 `["messages-tuple","updates","custom"]`，本仓多一个 `"values"`。
> **这不是多一个字符串**：`values` 是全量快照，里面用户刚发出的那条 human 消息
> **没有 id**（两个应用发出去的消息本来就不带 id），于是 `reduceValues` 要给它编
> 一个 `values-0` 这样的位置键；`getLatestEditableTurn` 据此认为这一轮可编辑、
> 画出「编辑并重新运行」，而那颗键按下去会把 `values-0` 交给
> `POST /runs/edit-regenerate/prepare`，**服务端解析不了**。
> `isSyntheticValuesMessageId` 是为这件事打的补丁，**这一轮拔的是根**。
>
> 状态改由 `updates` 累积——`reduceUpdates` 的 `patch-state` 本来就在做这件事，
> 上游 SDK 也是这么维护 `thread.values` 的。
> **判据是真后端**：`make e2e-backend` 八个套件 22 条全绿，todos / goal / 最终状态照常到。
>
> `stream_resumable` 一起去掉：Gateway 把它声明成 `Literal[False] | None`、默认 `None`
> （`run_models.py` 写着「compatibility placeholder」），发 `false` 与不发是同一个请求。
>
> **顺带订正了一条已经变假的门禁注释**：`chat-dataflow.spec.ts` 里写着
> 「wave 42 用一次性 probe 打上游的 mock 后端」量到上游键集含 `stream_resumable`、
> `stream_mode` 含 `values`——而 `e2e-parity` 的 `requestBodies` 档每轮都在真跑两个
> 应用录真请求体，它记的上游值两者都没有。**一次性 probe 与常驻尺子矛盾时以尺子为准**；
> 那条过期读数把本仓多发的两处钉成了「合同」。
>
> ### 二、补上 `useThreadMetadata` 这一层（`thread-title-sync` 那 2 个投影）
>
> 上一轮把这条判成「架构差异、退让」，**这一轮查出来判错了**：本仓
> `core/threads/archive.ts`、`composables/useProjects.ts`、
> `core/threads/cache-invalidation.ts`、`useThreads.rename` **四处**都在
> cancel / setQueriesData / invalidateQueries `["thread","metadata",threadId]`，
> 而**没有任何查询拥有这个 key**——四处全是空操作。归档、移到项目、run 结束、改名
> 都以为自己重读了这条线程，其实什么都没发生。
>
> **那不是「本仓不需要」，是「本仓缺了那一层，而好几处已经按它存在来写了」。**
> 新增 `useThreadMetadata`（key 收进 `core/threads/metadata.ts`，消灭四处字面量），
> 把 `AgentChat` 里那次命令式探测换成它。顺带修掉一个真缺陷：原来的探测只在
> `onMounted` 打一次、用的是 `initialRouteThreadId`，而 `AgentChat` 切线程并不重建
> ——**切到一条已被删除的线程不会被退回新会话**。改成查询之后按 key 隔离，自然就对了。
>
> ### 三、`context.thread_id`：两边都在发一个服务端保证丢弃的值
>
> 剩下那条 `requestBodies` 差异最后只剩 `context.thread_id`：
> React 是一个被尺子归一成 `«generated»` 的 id、本仓是夹具线程 id，而 **URL 是同一条线程**。
>
> **去后端查了才判的**：`services.py` 的 `build_run_config` 里写着
> `context["thread_id"] = thread_id`，注释明写「thread_id comes from the URL path,
> not caller config」——客户端传什么都会被当场覆盖。也就是说这颗键**完全空转**；
> 而上游发的还是**错的那一个**（`sendMessage(threadId, …)` 拿到的是提交那一刻客户端
> 预生成的 draft id，run 却打到后端真正创建出来的线程）。
>
> 一个服务端保证丢弃、且有一侧一直发错的字段——**两边都不发**才是对的。
>
> ### 四、复量时冒出来的两处，都是同一个形状：重复的取数
>
> - 加完查询后 `chat-thread-init-ordering` 上多出 `requestsOnlyVue`：本仓在那一屏
>   **发两次** `GET /threads/{id}`，一次是新查询、一次是 `refreshPostRun` 里命令式打的。
>   上游只有一次——它靠 `runInFlight` 翻假之后让查询自己重取。本仓照同一条机制：
>   查询的 `enabled` 带 `!isStreaming`，`refreshPostRun` 不再自己打。
> - 那个 `!isStreaming` 与本仓历史查询那道门（`enabled: Boolean(threadId) && !isStreaming`）
>   **是同一条理由**：`/chats/new` 提交之后 threadId 由 `onStart` 交出来，那一刻 run 已经
>   在流，此时取回来的是 run 之前的世界。
>
> ### 五、去掉那次重复取数之后，尺子当场照出另一个真 bug
>
> 复量只剩一行，而那一行是 `requestsOnlyVue: GET /api/threads/**null**/token-usage`
> ——**字面量 `null` 拼进了 URL**。
>
> 根因：`useThreadTokenUsage` 的 `queryFn` 写的是
> `fetchThreadTokenUsage(threadId.value!)`，那个 `!` 等于在说「`enabled` 保证非空」，
> 而 **`refetch()` 按 TanStack 的设计就是绕过 `enabled` 的强制取数**，
> `refreshPostRun` 在 run 落定之后正好有这么一次调用。
>
> **它此前一直藏着**：`refreshPostRun` 里在 refetch 之前还命令式打了一次
> `threads.get()`，那次 await 恰好把路由更新等到了。把那次重复取数去掉之后
> （它本身是与上游对不上的一条多发），这个缺陷当场显形。
> **一处重复请求把另一处缺陷遮住了**——这也是"多发一个请求"值得当账还的理由之一。
>
> 修法是让 `queryFn` 自己挡空 id（与 `useThreadMetadata` 同形），
> 而不是在调用点小心翼翼地不去 refetch：任何一处 `refetch()` 都不该能拼出 `null`。
> 门禁：`tests/unit/threads/use-thread-token-usage.dom.test.ts` 的
> 「threadId 为空时 refetch() 也不发请求」。

---


> ## 2026-09-17 第三十五轮：**四条根因一次清掉，台账只剩 2 条**
>
> **投影 13 → 3，不同的差异 10 → 2。零回归。**
>
> 四条都是「根因已经定位就直接修」，而且四条里有三条查出来是**库或时序的副产品，
> 不是任何一边的契约**——这与第三十四轮那条侧栏是同一个形状。
>
> ### 一、路由播报器：一份抓早了的快照（`ariaOnlyVue: - alert: New chat - DeerFlow`，2 投影）
>
> `RouteAnnouncer` 在 `onMounted` 里抓 `previousName`，而**页面标题是页面组件自己
> 在挂载后写的**——快照抓到的是根标题 `DeerFlow`，于是第一次路由切换会把一个
> 根本没变过的标题播出去。`chat-thread-init-ordering` 那一跳
> （`/chats/new` → `/chats/{id}`）两边标题都是 `New chat - DeerFlow`，上游没播，本仓播了。
>
> 改成**进入导航时读「离开页的名字」**（那一刻 DOM 还是旧页面的），
> 与「这一帧渲染完之后的名字」比。不需要再维护快照，也比上游稳一点：
> 上游存的是上一次导航结束时的标题，标题若在那之后才异步变成新值，
> 上游会在下一次导航时把它当成变化播出来。
>
> **门禁连着改了**：原来那条用例先写标题再改路由，顺序与真实相反，
> 所以它对这个缺陷是瞎的。改成用一个「跟着路由写标题」的假页面复现真实顺序。
> 负向验证：把实现改回快照版，用例当场红（`expected 'New chat - DeerFlow' to be ''`）。
>
> ### 二、tooltip 播报节点：reka 把它标成了 `aria-hidden`（2 投影）
>
> 探针实测：本仓 `[role=tooltip]` **存在、文本也对**，但带着 `aria-hidden="true"`
> ——根本不在可访问性树里，读屏器按元素浏览找不到这条提示。
> 根因在 `reka-ui/dist/Menu/…` 隔壁：`TooltipContentImpl` 调 `VisuallyHidden` 时
> **没有覆盖 `feature`**，而那颗 primitive 的默认档 `"focusable"` 就会写
> `aria-hidden="true"`。Radix 的 `VisuallyHidden` 不写。
>
> 够不着库内部那颗，所以在 `ui/tooltip/TooltipContent.vue` 里**自己补一颗可达的**，
> 形状照 Radix（`aria-label || children`）。同时把算好的文本显式传给 `aria-label`
> ——不传的话 reka 那颗会把新补的这份也算进 `textContent`，读屏器念两遍。
>
> ### 三、`div(menuitem)`：reka 把菜单项的 `tabindex` 写死成 `-1`（2 投影）
>
> `PARITY_ONLY=thread-history` 的 `TABBABLES` 段逐项比出来：两边 26 项里 25 项相同，
> 只差菜单里那一个。上游菜单项走 Radix 的 `RovingFocusGroup.Item`
> （`isCurrentTabStop ? 0 : -1`），这是 ARIA APG 的 menu 模式明写的技术；
> reka 写死 `-1`，于是**本仓菜单打开时一个 tab 停靠点都没有**。
>
> **实现走了一次弯路，值得记**：先写的是 `:tabindex` + `@focus` 的响应式版，
> 结果**子菜单打不开**——`thread-actions-menu` 那条导出用例当场红。二分到是 `@focus`：
> reka 的 `MenuSubTrigger.onClick` 里先 `event.currentTarget?.focus()` 再
> `onOpenChange(true)`，我们的处理器在那一句里同步改了一个 prop，
> 触发的重渲染把后半段打断了。改成**自定义指令直接 `addEventListener` + `setAttribute`**，
> 不经过渲染，与 Radix 自己的做法同形。
> （不会被覆盖回 `-1`：Vue patch 比的是新旧 vnode 的 props，reka 那侧前后都是 `"-1"`，
> 于是根本不写 DOM。）
>
> ### 四、变更面板的焦点落点：又一个时序副产品（3 投影）
>
> 上游打开面板时 `files` 还是空的（detail 查询在飞），唯一可聚焦的是关闭键；
> 本仓的 summary 查询本来就带 `includeFiles`，打开那一刻文件行已经画出来了，
> 于是焦点落在第一行的折叠触发器上。**两边都不是有意的**，所以不是「跟谁」的问题。
>
> 两边同改成 APG 对话框模式的第一推荐做法：**焦点放在对话框容器本身**，
> 读屏器从标题和描述开始念，用户再 Tab 进内容；也避免焦点一上来就停在一个
> 按 Enter 会折叠某一行的触发器上。
>
> ### 五、顺带：建线程不再多带 `assistant_id`（1 投影）
>
> 后端 `ThreadCreateRequest` 收这颗键，但 `"lead_agent"` 正是
> `_DEFAULT_ASSISTANT_ID`，`build_run_config` 那一支写着
> `if assistant_id and assistant_id != _DEFAULT_ASSISTANT_ID`——传与不传对 agent
> 路由完全等价，自定义 agent 走的是 `metadata.agent_name`。**去后端查过才判的**，
> 不是「上游没有所以上游对」。
>
> ### 六、剩下的两条
>
> | 差异 | 投影 | 判词 |
> | --- | --- | --- |
> | `requestsOnlyReact: GET /langgraph/threads/{id}` | 2 | **架构差异，退让**。上游头部标题来自 `useThreadMetadata`（改名后失效重取），本仓头部读列表缓存、由 `loadInitial(true)` 收敛；两边都收敛到服务端，端点不同。本仓那三处对 `["thread","metadata",id]` 的失效**全是空操作**（没有任何查询拥有这个 key，已核）。**翻案判据**：本仓哪天真有一个消费该 key 的查询，这一行必须归零 |
> | `requestBodies: runs/stream` | 1 | **欠账，下一轮做**。本仓 `stream_mode` 多一个 `"values"`、多一个 `stream_resumable:false`。多订 `values` 不只是多一个字符串：`reducer.ts` 因此要给 values 里没有 id 的消息编 `values-0` 这种合成 id，而 `isSyntheticValuesMessageId` 正是为它打的补丁。**根因是多订了 `values`**，还账路径是让自研 transport 用 `updates` 累积状态（上游 SDK 就是这么做的），把合成 id 那一套连根拔掉 |

---


> ## 2026-09-16 第三十四轮：**侧栏窄屏挂载时机——两处根因，两边同改**
>
> ### 零、先说这一轮被尺子推翻的那个前提
>
> 上一轮的半程判词写着「两边窄屏分支**都是 Sheet**，关着时内容都不在 DOM 里」，
> 于是把这 8 个投影当成「本仓多发」。**这个前提只对了一半，而错的那一半是关键**：
> Sheet 关着确实不渲染内容，但**首帧渲染的不是 Sheet**——窄屏由 JS 判定，
> 首帧两边都先挂桌面那一支，整棵侧栏连同它的查询起来一次，随后才被扔掉。
>
> **是尺子把这件事翻出来的，不是推理。** 只改本仓、只跑完整 `e2e-parity` 之后，
> 台账不是少 6 行而是**多出 45 行**：15 个 mobile 场景上变成
> `requestsOnlyReact: channels/providers · features · threads/search`。
> 也就是说**上游在 chats 系路由上一直在发这三条**，只有 `scheduled-tasks` 那两屏不发。
> 直接探针（`E2E_REACT_APP_URL` 上打 `fetch` 钩子）实测：
> `/workspace/chats/new` 三条请求发出时 `[data-slot=sidebar]` 的 `data-mobile` 是
> **desktop**，而终态 DOM 里一个侧栏都没有——**上游自己就是那个「白挂载一次」**。
> 同一份 layout、同一个 hook，`/workspace/scheduled-tasks` 却一条都不发：
> **上游在这件事上没有契约，只有一个随水合时序开奖的结果。**
>
> ### 一、两处根因
>
> **① 断点判定晚了一帧。** 本仓 `isNarrow` 初值 false、在 `onMounted` 里才读
> `matchMedia`，而父组件的 `onMounted` 跑在**子组件全部挂载之后**。
> `ThreadSidebar` / `WorkspacePanels` 各手搓了一份，`toggleSidebar` 里还有第三处
> 直接 `matchMedia`。统一成 `app/composables/useMediaQuery.ts`：
> **客户端首次渲染就是真值**，订阅随 scope 释放。
> `/workspace/**` 是 `ssr: false`（`config/routes.ts` 的 `csrRoutes`），
> 首帧就是客户端渲染，**不存在水合不一致**。
>
> **② 查询挂在抽屉外面。** 上游 `WorkspaceSidebar` 自己的函数体里**没有查询**，
> 三个查询分别归 `WorkspaceNavChatList`(`features`) /
> `WorkspaceChannelsList`(`channels/providers`) / `RecentChatList`(`threads/search`)，
> 它们都是 `<Sidebar>` 的子节点。本仓把前两个写在 `ThreadSidebar` 的 setup 里，
> 那是抽屉**外面**那一层。按上游分层补两颗真组件
> （`WorkspaceNavChatList.vue` / `RecentChatList.vue`），
> `ThreadSidebar` 退回编排层，它那份 `useThreads({ enabled: false })` 是只读缓存
> ——重命名/置顶/删除三套处理器要与 `ProjectsSection` 的行共用同一个对话框和同一条 alert。
>
> ### 二、上游那一侧（两边同改）
>
> 上游躲不开①：workspace 是 SSR（`force-dynamic`），`useIsMobile` 的
> `getServerSnapshot()` 必须返回 false 才不水合不一致。所以上游改的是②那一半的极端形式——
> `ui/sidebar.tsx` 的桌面分支**水合期间不渲染 `children`**（`useIsHydrated()`，
> 标准的 React 18 水合探针：服务端快照 false / 客户端快照 true，只翻一次、不额外排渲染）。
>
> **代价是量过的**：`sidebar-gap` 与 `sidebar-container` 仍然进服务端 HTML，
> 所以**桌面不位移**，晚一帧到的只是侧栏自己的内容——而它本来就全是客户端取数。
> **没有改成「给查询加 enabled」**：那样整棵子树照样挂一次再卸一次，
> 而且每加一个子组件都要记得再 opt-in 一次。
>
> ### 三、读数（都是实测，不是推理）
>
> | 探针 | 改前 | 改后 |
> | --- | --- | --- |
> | 本仓 375px `/workspace/chats/new` | `channels/providers` 1 · `features` 2 · `threads/search` 1 | `features` 1，其余 0 |
> | 上游 375px `/workspace/chats/new` | 同上三条 + 页面自己的 | 只剩页面自己的 |
> | 上游 375px `/workspace/scheduled-tasks` | 本来就只有 `scheduled-tasks` | 不变 |
> | 两边 1280px | 三条都发 | 不变（晚一帧，集合相同） |
>
> **负向验证**：把 `useMediaQuery` 改回「挂载后再纠正」，
> `tests/e2e/sidebar.spec.ts` 那条新门禁当场报红
> （`requestsOnlyVue: GET /api/channels/providers`），改回来即绿。
>
> ### 四、顺带结清的一笔：账 G（分栏把手）
>
> 上游 `ui/resizable.tsx` 的拖拽热区是 `after:w-1`（4px），本仓是 16px，
> 历轮判词是「本仓更好，已接受」。按最终目标那是欠账不是结清，
> 而 4px 的热区是**上游的可用性缺陷**（分隔线是改宽度的唯一入口，
> 4px 鼠标都难稳中，触控板更不用说），所以**两边同改**：上游改成 `after:w-4`。
> 可见的那条 1px 线一个像素都没动，两个方向（水平/垂直）一起改。
> `sidecar-chat` 那两行 `geometry: role:separator after w=4 vs w=16` 归零。
>
> ### 五、这一轮留下的门
>
> - `tests/e2e/sidebar.spec.ts`：窄屏抽屉关着时那三条请求为 0，**打开后必须出现**
>   （反向那一半不能少，否则「把侧栏整个弄没了」也能绿）；
> - `tests/unit/workspace/use-media-query.dom.test.ts`：子组件挂载那一刻就拿到真值；
> - `tests/unit/workspace-shell/sidebar-skeleton.test.ts` 的读取面从两份扩到四份
>   ——拆完它当场报红，报的正是搬走的那三颗 slot。**这就是这道门存在的理由。**

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
> **⚠ 这条判词 2026-09-16 第三十一轮作废**：按「完全一致」这条最终判据，
> 「只多一个键盘停靠点」正是**交互逻辑上的真差异**——React 的键盘用户能 Tab 进去，
> 本仓不能。补上那一层之后该族 105 个投影清零。
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

## 2026-09-17 第三十八轮：A 组结清、`hit` 三行判给尺子

> **本轮把 `frontend-vue parity` 推到 Linux 上第一次全绿**（`b8cc8b19`）。
> 此前 14 次全是 failure / cancelled。⚠ **一次运行是一个样本**——A 组那 5 行
> 此前是稳定的 3/3，这次归零是实的；`hit` 那 3 行是飘的（2/3/0/3），
> 单次绿不足以判它结清，本轮是从**机制**上判的，见下。

### 一、A 组（`integrations` mobile 宽度 Δ4.1/4.2）——结清，两边同改

**第三十七轮留下的判词是错的，实测推翻。** 它说根因是 `CardHeader` 的
`grid-cols-[1fr_auto]` 第 2 列那颗 `whitespace-nowrap` 的 Refresh 按钮顶着
min-content。探针（逐层把元素设成 `width:min-content` 读固有宽度）量出来：

    headerMinContent 40    actionMinContent 95    ← 第二十一轮的 min-w-0 早修好了

真正顶着的是两处**两个应用完全相同**的东西（承重链逐层同值，所以这从来不是
「本仓没对齐」，是两边共有的窄屏缺陷）：

| | 承重物 | min-content | 处置 |
| --- | --- | --- | --- |
| ① | scope 说明里嵌的 `calendar:calendar.free_busy:read.` | 192.2px 的一个「单词」 | `wrap-anywhere` |
| ② | 「在浏览器重新注册」按钮 nowrap | 191.1px，列宽只有 186px | 允许折行 + `min-h-8` |

①**顺带订正一条会重犯的规则**：状态格上那颗 `break-words` 对尺寸是**空转的**
——按 css-text-3，`overflow-wrap: break-word` 新增的换行机会**不计入
min-content**；`anywhere` 才计入。凡是「加了 break-words 但盒子还是缩不动」的，
根因都是这一条。

读数（macOS）：

    面板 min-content   286.2 → 240.5    （「换 Lark 应用」态 285.1 → 240.5）
    375px 余量 6.8 → 52.5     360px 由「上游溢出 / 本仓裁掉」→ 37.5
    375 / 360 / 340 / 320 四档上两个应用逐值相同

余量够了，`ScrollArea` 根元素那颗承重的 `overflow-hidden` 就不再守着谁——删掉，
基类回到与上游一字不差；`primitive-base-classes` 里那条 `ScrollArea` 声明
按它自己写的翻案判据同轮删除。

**门禁补了「余量」这一维**（`tests/e2e/integrations.spec.ts`）：只断言「溢出为 0」
抓不到「余量为 0」，而后者正是第二十一轮与第三十七轮各栽一次的地方。门限 12px
——第二十一轮实测同一张卡 Linux 比 macOS 宽约 9px，12 盖得过那个平台差；而任何
一处重新钉住 min-content 的改动一次吃掉 30–50px，不会卡在门限附近。

**取舍**：320px 上两边仍然一起溢出 3px。同值、不是对照问题、也不在门禁的受支持
档里；再往下压要动徽标的 `whitespace-nowrap` 或第四层内边距，那是没有读数支持的
设计改动。**翻案判据**：哪天 320px 进了受支持档，回来重量这条链。

### 二、`hit` 那三行——判给尺子，但**先排除了应用**

`integrations#permission-request` 的
`role:button[Request permissions] hit React=self Vue=div`。

按判据 #9 先问「两边用户看到的有没有区别」，三跑同号：

    对话框出现 → Lark 卡片出现     本仓 ~15ms      上游 ~293ms
    dialog-content enter 动画       200ms/ease/0    200ms/ease/0    逐字相同
    dialog-overlay  enter 动画      150ms/ease/0    150ms/ease/0    逐字相同

**动画本身两边一样**（而且这几个值已经被 `primitive-base-classes` 的类串比对
守着——`duration-200` / `zoom-in-95` 都在被比的基类串里，不需要补新门禁）。
差的是那块面板的 chunk 何时就位，而**这一笔早有判词**，写在
`SettingsDialog.vue` 文件头：九个面板全切开反而让关键路径涨了
（994,976 → 1,007,885 raw），所以本仓只切 Integrations；两边的 loading 占位
都是同一句 `role=status` 的「Loading…」。**用户看到的是同一个占位符、只是时长
不同**，chunk 划分是构建产物而不是可观察行为。

⚠ 我这一轮差点把这条当新账重开——`SettingsDialog.vue` 的文件头早写着判词和读数。
**记忆 `deerflow-parity-three-docs` 的同一形状：动手之前先看那份文件自己怎么说的。**

于是 settle 的锚点在两边落在开场动画的**不同相位**：本仓 15/200、上游 200/200。
Playwright 的 `click` / `fill` 会把目标滚进视野，**滚动量按当时的几何算**——
对话框还在 `zoom-in-95` 里就算出不同的结果：

    点第一颗按钮之后   本仓 scrollTop=460（滚到底）   上游 411
    补上「交互前等开场动画」之后   两边都是 411

这也解释了它**为什么一直是飘的**：分岔取决于两边各自的 chunk 什么时候就位，
而不是应用有没有改坏。

做法：`waitForFiniteAnimations` 从 `capture.ts` 抽成 `support/settle.ts` 独立一层
（`capture.ts` 依赖 `scenarios.ts`，反向 import 会成环——拆层而不是打补丁），
`runScenario` 在 settle 步骤之后、交互步骤之前调用它。

**新门禁** `interaction-settles-first.spec.ts`：跑完同一串交互，两个应用停在
同一个滚动位置。断言**两边相等**而不是等于某个数（滚动量随文案与字体变，
「两边一样」不会）。为什么不让台账自己守：它在这上面是飘的，偶发红的门等于
没有门。变异验证：摘掉那道等待，当场红成 `vue=460 react=411`。

**翻案判据**：这道等待不许用来掩盖动画差异。哪天 `primitive-base-classes` 给
`DialogContent` 的动画类开了豁免，这道等待就必须连同一条「两边动画声明相同」的
门禁一起重新审。


### 三、扩取样面：dark 维从 19 → 33 个样本，**顺带照出一个「0 行」是假的**

台账 0 行、四张工单表三张归零之后，唯一能推进的方向是扩取样面。当时 147 个
场景-维度里只有 19 个是 dark，其中 14 个挤在 `integrations` / `scheduled-tasks` /
`workspace-changes` 三块错误态上（2026-09-11 那轮有意只挑错误态，因为那是
「固定色 vs token」的高发区）——**43 个场景一个 dark 样本都没有**。

加维之前先确认这一维采得到东西：`geometry` 档采 `color` / `background` /
`fontSize` / `fontWeight` / `fontFamily` / `borderRadius` / `opacity`。确认过再加，
否则「零差异」只是「压根没采到」。

挑**彼此不重叠的色彩面**，每块一个场景（照既有纪律，一个场景补一维）：
`thread-history`（Markdown 渲染面）、`sidebar`（外壳选中/悬停态）、
`channels`（连接状态徽标）、`thread-todos`、`background-tasks`、
`artifact-preview`、`mcp-settings`、`branch-thread`。
共 14 个新场景-维度（有些场景有多个终态），**全部 0 行**。

这是有价值的负结果：那 8 块面在深色下是干净的，而取样面从此永久覆盖它们，
代价约 2 分钟跑时（18.1 min）。

#### 但这一跑同时报出 8 行,而它们指向一个**此前一直存在**的坑

`streaming-reasoning-order` 两个语言维各 4 行：

    ariaOnlyReact:- button "Reasoning"
    ariaOnlyVue:  - button "Reasoning" [expanded]
    ariaOnlyVue:  - paragraph: The user asked who I am, …
    geometry:text:… y React=208 Vue=244 Δ36

**Linux（CI 35223990201）与 macOS 本机量到完全相同的 8 行**，不是飘。
但探针一量，**两个应用的行为一模一样**：推理折叠块先展开、在 +300~+500ms 之间
自动收起，两边收起的时刻也一样。

差的是**取样相位**：

    settle 时  本仓 anims=[]                       → 等待返回 0ms   → 采到「展开」
               上游 anims=[CSSTransition×5, 250ms] → 等约 250ms     → 采到「收起」

`waitForFiniteAnimations` 是**内容相关**的等待，两个应用等的时长天然不同，
而 400ms 的自动收起正好夹在中间。

**⚠ 真正要记住的是这一句：改之前这一屏是 0 行，而那个 0 是两处错误互相抵消
出来的。** 两边都采在自动收起**之前**，一起采到「展开」，于是「一致」。
这一屏的 `settle` 从头到尾只等到正文出现，而屏幕在那之后还会自己再变一次——
**一个还会自己变的屏幕不算终态**，它的「0 行」从来就不说明任何事情。

而且这道内容相关的等待**在取样那一步早就有了**（`captureScenario` 一直在调
`waitForFiniteAnimations`）：第三十八轮只是又加了一道，让总延迟差得更开。
**这处脆弱性比这一轮早得多。**

处置：给这条场景补一条 `hidden` 终态断言（等那次自动收起真的发生），
**按状态等、不按秒表等**。复量：161 个条目、**差异行合计 0**。

#### 这一笔的普遍判词

- **「台账 0 行」不等于「这一屏对齐了」**，它还可能是「两边一起采早了」；
- **加新场景/新维度时的那句「要给它加终态断言」，对既有场景同样成立**——
  历轮加进来的场景里，有多少条的 `settle` 只写到「第一眼看到的东西出现」，
  没人系统查过；
- 排查这一类的办法：跑一遍场景，`settle` 之后隔 1.5 秒再读一次页面文本，
  两次不同的就是终态没定义完的。**只需要跑一个应用**——问的是「这一屏自己稳不稳」，
  不是「两边一不一样」。


### 四、逐条扫「终态没定义完」：57 个场景键，扫出 4 条，其中一条是**空断言**

第三部分那次是撞出来的一例；这一节是把它当**类**扫了一遍。

办法：跑一遍场景，**在取样点上**读一次 `document.body.innerText` 加一串
`aria-expanded/aria-selected/data-state/aria-hidden/aria-busy`，隔 1.5 秒再读一次，
两次不同的就是取样时这一屏还在变。只跑**一个**应用——问的是「这一屏自己稳不稳」，
不是「两边一不一样」。

⚠ **探针必须和 `captureScenario` 同点**。第一版只跑到 `runScenario` 就读，
于是把 `sidebar-collapsed` 报成不稳定；真实取样点后面还有
`waitForTimeout(700)` + `waitForFiniteAnimations` + `waitForDomQuiet` 三道。
对齐之后那一条自己就消失了。

| 场景 | 取样之后还在变的 | 归哪一层 |
| --- | --- | --- |
| `streaming-reasoning-order` | 推理块定时自动收起 | 场景终态断言 |
| `showcase-public-thread` | 同一个根因 | 场景终态断言 |
| `sidebar-collapsed` | 收起分支的 `DF` 迟一帧挂载 | 尺子（`waitForDomQuiet`） |
| `background-tasks#disabled` | 侧栏还在 `Loading conversation…` | **空断言，见下** |

#### `background-tasks#disabled` 的主角断言一直在空壳上通过

那一档的 `settle` 是 `[]`，而它唯一的断言是一条
`hidden { testId: "background-tasks-trigger" }`。
`locateTarget(...).first()` 在匹配不到时是个**空 locator**，而
`waitFor({ state: "hidden" })` 对不存在的元素**立刻通过**——
页面还没渲染出来，这条断言就已经绿了。

扫描当场照出来：它的 settle 之后 1.5 秒，侧栏还从「Loading conversation…」
变成「Projects / Recent chats / Background work」三块。

处置：先等一条**只有外壳真的渲染完才成立**的正向锚点（`role=link, New chat`：
两个应用都有，且与 `mcp_tasks` 这个开关无关，不会把主角断言变成同义反复），
再去断言入口不在。

⚠ **同一轮我自己又踩了一次**：给 `showcase-public-thread` 写 `hidden` 时没先
`visible`，推理那段还没渲染出来它就凭空通过了。
**判据：`hidden` 断言前面必须有一条 `visible`，否则它证明的是「没找到」，
不是「消失了」。**

#### 分层：两种「还在变」要用两种办法

- **定时触发的**（自动收起这一类）必须靠**场景自己的终态断言**：
  `waitForDomQuiet` 的安静窗口是 250ms，跨不过一个 400ms 的定时器；
- **渲染节奏差一帧的**归 `waitForDomQuiet`：它等的是「这一屏不再自己变」，
  不需要知道变的是哪一颗。

`waitForDomQuiet` 用 MutationObserver 数安静时长，**按状态等不按秒表等**；
超时 3s 之后不抛（取样本身不该变成失败源）。
它同时装在 `runScenario`（交互步骤之前）与 `captureScenario`（取样之前）。

#### 一处**没有**那样做的地方，理由写在场景里

`sidebar-collapsed` 我先试了往 settle 加 `visible DF`，**当场超时**——收起是
`steps` 里那次点击干的，settle 跑的时候侧栏还是展开的。改挂到 `steps` 末尾同样
不行：`DF` 挂着 `group-hover/workspace-header:hidden`，点击之后鼠标还停在头部。
上游有 `[data-slot="sidebar"][data-state="collapsed"]` 可以当锚点，**本仓这一层
没有那个元素**，而为了迁就尺子往应用里塞 `data-slot` 是第三十七轮被
`invariant-ownership` 门禁按回来过的做法。所以这一帧交给 `waitForDomQuiet`。

**收工复量**：57 个场景键、**0 条在取样点上还在变、0 条跳过**。


### 五、窄屏门禁从 1 个分区推到 10 个——**当场抓到两处两边共有的缺陷**

`integrations` 那一个分区此前单独有「窄屏装得下」的门禁。它出过事的方式是两边
共有的：某个不给换行机会的字面量、或某颗 `whitespace-nowrap` 的按钮，把整块面板
的 min-content 顶到比它那格还宽——第二十一轮、第二十七轮、第三十八轮各出过一次。
**一个分区有门禁，另外九个不是没问题，是没人看。**

新门禁 `tests/e2e/settings-narrow-screen.spec.ts` 用 `SETTINGS_SECTIONS` 反查分区
（不另抄名单：抄一份的话新增分区默认不在门禁里，而那正是它要防的形状），
375/360 两档各断言 `panelOverflow === 0` 与 `panelSlack >= 12`。

第一次跑 20 条，**3 条红**：

| 分区 | 读数 | 根因（上游逐字相同） |
| --- | --- | --- |
| `appearance` | `panelOverflow` **55@375 / 70@360** | 主题预览卡写死 `grid-cols-[1fr_240px]`，**固定轨道不会缩**，面板 min-content 348 而那格只有 293 |
| `skills` | 余量 **3px@360** | 外层 header 有 `flex-wrap`，里面那组按钮没有，两颗 nowrap 键连成 240.7px 整块 |

`appearance` 那条不是「余量小」，是**这块面板在所有手机上都挂在设置对话框外面**，
而这一屏此前没有任何机器看着。改法：`minmax(0,240px)`（上限不变，约 420px 以上
毫无变化）与内层补 `flex-wrap`。两边同改。

**这两处都不减对照分——两边一样坏。** 台账按定义看不见它们。

### 六、这一轮量到的两个负结果（都有价值，别重做）

1. **产品路由在 360px 上全干净**：8 条产品面路由（workspace / chats / chats/new /
   chats/:id / agents / agents/new / scheduled-tasks / showcase）默认态
   `documentElement.scrollWidth === 360`、越界元素 0。
   **缺陷在叠加其上的对话框里**，不在路由本身。
2. **`subagent-editor` 对话框在 360px 上有富余**：dialog 328、min-content 218。

### 七、下一步该怎么做「对话框的窄屏扫描」——**别再逐个手接入口**

第三十八轮试过逐个手写触发器去开对话框（channels runtime config、agent settings），
两个都是 30 秒超时**卡在打不开**，而不是量到了什么。
**parity 场景表里已经编码了到达这些状态的步骤**（`channels#runtime-config-edit`
等），正确做法是复用 `runScenario`，而不是在 e2e-mock 里把入口重写一遍。

挡路的是套件边界：`scenarios.ts` 在 `tests/e2e-parity/` 下，而 e2e-mock 套件不该
反向依赖它（`tests/guards/e2e-suite-contract.test.ts` 管着）。两条路各有代价，
**下一轮先判这个，再动手**：

- 把窄屏溢出断言加进 parity 取样（它跑得到两个应用，但台账看不见「两边一样坏」，
  要单独断言而不是进台账）；
- 或者把场景表提到两个套件都能引的一层。


### 八、新门禁在 CI 上第一次跑就抓到一条**本机看不见**的缺陷

`bd8353bc` 的 verify 在 Linux 上红了（parity 绿）：

| | 读数 |
| --- | --- |
| macOS 本机 | `about` 两档都绿，360px 余量 **41px** |
| Linux CI | `about` **panelOverflow 4 / panelSlack −3** |

根因：这一页的标题是 `text-2xl` 的**单个长词**——「🙌 Acknowledgments」就是这一屏
最宽的东西，而 360px 下内容列只有约 200px。两边字体栈不同，Linux 那边这个词宽出
约 18%（本机 min-content 237.5，CI 推算约 281）。

**这正是写这条门禁的理由**：「一个只在某个平台成立的缺陷，和没有缺陷长得一模一样」
——第二十一轮踩过一次，这次是门禁自己照出来的。

修法与 scope 字面量同一条：`wrap-anywhere`（`break-words` 对 min-content 无效）。
**改在调用点而不是共享的 markdown 基类**——后者镜像上游 Streamdown 的类串，
动它是另一回事，而且没有读数支持。两边同改
（React `SafeStreamdown className`，Vue `MessageMarkdown class`）。

实测：面板 min-content **237.5 → 68.2**，360px 余量 41 → **210**。

### 九、窄屏状态扫描：一次**我自己造出来的假读数**，与两条真溢出

第一版扫描报出「43 个状态全溢出」。**那是我自己的 bug**：`runScenario` 里的
`applyDimension` 会按 `VIEWPORTS.mobile` 把视口设成 **375**，覆盖掉
`newContext` 里的 360——于是我拿 361 去卡一个 375 宽的页面。
**判据：探针里凡是「全都红」，先怀疑探针。**

改成按页面实际 `innerWidth` 量、并在 `runScenario` 之后再压到 360，真实读数：

    43 个状态检查，2 个有溢出；另有 14 个状态在窄屏下压根到不了（侧栏在手机上是抽屉）

- `subtask-card`：一个 `svg` 出界 20px（right=380，w=16）→ **真缺陷**，见第十一节；
- `artifact-table-preview`：`table` 出界 2px → **不是缺陷**，见下。

#### `artifact-table-preview` 那 2px：**探针的规则太粗，不是应用的账**

两边几何**完全相同**：`table l=-226 r=362 w=588`，而它的父容器是
`div.min-h-0.flex-1.overflow-auto`（`sw=588 cw=317`，`l=30 r=347`）——
这是一张**本来就横向滚动**的表格，被父容器裁在 347，根本没跑到视口外。

**「right > 视口宽」这条规则会把被滚动容器裁掉的元素也算成溢出。**
`subtask-card` 那条之所以是真的，正因为它**一路到顶都是 `overflow: visible`**，
没有任何裁剪祖先。

⚠ **做成常驻门禁时，规则必须是「逐层往上走，遇到 `overflow` 非 `visible` 的祖先
就不算」**，否则每一张可滚动的表格、每一个横向滚动条都会报一行。
（`document.documentElement.scrollWidth <= innerWidth` 这一条本身是干净的：
这次扫描里它对 43 个状态全部成立。）

### 十、两条**只在全套负载下红**的用例（飘）

| 用例 | 全套 | 单跑 |
| --- | --- | --- |
| `artifact-table-preview · zh-CN`（parity 可达性） | 红过 1 次 | `--repeat-each=3` 六次全绿 |
| `thread-list-infinite-scroll`（e2e-mock） | 红过 1 次 | `--repeat-each=5` 十五次全绿，随后整套复跑 295 passed |

两条都不是这一轮改出来的。**「偶发红的门会被当成噪音忽略掉，等于没有门」**
（记忆 `deerflow-gate-needs-an-entrypoint` 的同一形状），所以它们值得单独查一轮，
但不该在别的账里顺手改。挂账。


### 十一、窄屏扫描抓到一条**真的两边分叉**——而且是台账天生看不见的那种

`subtask-card` 折叠头右侧那格，360px 上：

    上游  div class="… flex min-w-0 items-center gap-1 …"   w=144  → 状态图标 294–310（视口内）
    本仓  div class="… flex        items-center gap-1 …"   w=214  → 状态图标 364–380（视口外）

**本仓漏抄了 `min-w-0`**（上游 `subtask-card.tsx:179` 一直有）。flex 子项默认
`min-width: auto`、缩不到 min-content 以下，少了它这一格从 144 涨到 214、
把 164px 的父格撑破 50px，**把右边那颗状态图标整个推出屏幕**。

**为什么台账一直看不见**：`subtask-card` 只有 desktop/zh/dark 三维，窄屏从没采过。
同轮给它补上 mobile 维。

#### 顺带证伪一条「看起来很对」的排查思路

找到这一条之后，我去数两边的 `min-w-0` 用量想找出同类缺口：**116 vs 114**，
看着只差两处。**但按文件配对之后这个差值毫无意义**——两边组件拆分方式不同，
React 的 `input-box.tsx`（11 处）在本仓对应 `ChatComposer`（9）+ `ComposerSurface`（1）
+ …，配对表里一半条目是「React N / Vue 0」或反过来。

**判据：源码计数在这里是错的仪器**（「判据是渲染与行为一致，不是源码字面一致」）。
真正找到这一条的是**窄屏逐状态扫描**，不是数类名。

### 十二、窄屏扫描已做成常驻门禁——**判定规则被变异验证按回来三次**

它值得常驻：43 个状态里量出 1 条真缺陷 + 1 条待判，而其余所有门禁都没看见。

**位置**：`tests/e2e-parity/`（需要 `runScenario`），**只跑一个应用**——问的是
「这一屏溢不溢出」，共有缺陷同样要抓。代价约 3 分钟（当前 parity 已 23 分钟）。

**⚠ 别用「checked === 43」这种快照数字兜底**：`e2e-suite-contract` 的文件头写过
为什么不钉快照数（加一个用例就得改守卫，而真正会出事的它反而看不见）。
按本仓惯用的两张表来：**可达且干净** 与 **窄屏下到不了**（14 条，各写原因），
两张表必须恰好划分全集——新增状态无处可去，必须显式选一边。**反向也查**。

**那 14 条「窄屏下到不了」本身可能就是账**：**十二条同一个根因**——桌面侧栏在
手机上不渲染（换成 Sheet 抽屉），于是 `[data-sidebar='sidebar']` 以及侧栏里那些
会话行的定位器永远解析不到。到不了不等于没问题，只等于这条路径是按桌面写的。

#### 落地时判定规则错了三版，**每一版都「说得通」**

| 版本 | 规则 | 被什么推翻 |
| --- | --- | --- |
| 1 | 越过视口 且 无裁剪祖先 | 变异后**照样绿**——消息列表是 `overflow-y-auto`，它里面一切都被判成「被裁掉」 |
| 2 | 算最近裁剪祖先的可滚动右界 | **误报 36 条**——`scrollWidth` 的原点是内边距盒左边，不是 `rect.left` |
| 3 | 越过视口 且 无可滚祖先 | 又是绿的——链上几乎每层都 `sw>cw`，而**`sw>cw` 在 `overflow: visible` 的盒子上根本不代表能滚** |
| 4 | **把不变量直接说出来**：360px 上不该有任何容器需要横向滚动 | 干净时绿、变异时红、且只报那一行 ✓ |

**判据（这一条比门禁本身值钱）：**

- **只跑「干净时绿」的话，这条门禁会以一个永远不会红的形态签进去**，
  看起来和真门禁一模一样。前三版我每一版都差点收下。
- **判据里不要做算术**（第 2 版）：那个算式要把祖先的边框与内边距都算对，
  它自己就会错，而且错得很像读数。
- ⚠ **键的拼法**：没有显式 `states` 的场景，`scenarioStates` 合成的 id 是**空串**
  （不是 `"default"`）。第一版没处理，门禁报出九条假「走不到了」。

**代价**：parity 173 passed 23.4m → **175 passed 25.0m**（净增约 1.6 分钟）。


### 十三、那「4 块没覆盖的屏」查完了：**3 块不是缺口，1 块查出一条可访问性树差异**

逐条在 360px 上跑，**两个应用各跑一遍**（这一步是判据本身——只跑本仓的话，
「到不了」看起来永远像本仓的问题）：

| 场景 | 上游@360 | 本仓@360 | 判 |
| --- | --- | --- | --- |
| `agent-create-name-step` | 卡在 `[data-sidebar='sidebar'] a[href='/workspace/chats/new']` | **同一处** | 不是缺口：那条路径两边都是按桌面写的 |
| `browser-feature` | 卡在 `getByText(/^(Browser\|浏览器)$/)` | **同一处** | 不是缺口：浏览器面板在手机上两边都不开 |
| `workspace-changes#reasoning-menu` | 卡在推理深度键 | **同一处** | 不是缺口：那颗键两边都不在窄屏出现 |
| `sidecar-chat` | 卡在 `separator`（**最后一步**） | 卡在 `Side chat`（**第 42 步**） | **有差异**，见下 |

#### `sidecar-chat`：窄屏 sr-only 面板标题，本仓翻译了、上游写死英文

    上游  SheetTitle  "Sidecar" / "Browser" / "Artifacts"（chat-box.tsx:408-419，不进词典）
    本仓  SheetTitle  sidecar.title → 「Side chat」/「侧边对话」

于是本仓在窄屏下多出一个**文本恰好等于 "Side chat" 的隐藏 `h2`**，
`getByText(/^Side chat$/).first()` 命中它、等它 visible 就超时——
而**窄屏下读屏器听到的东西两边确实不一样**，这才是真账。
按既定约定搬进 `primitives.*`（同 `close` / `toggleSidebar` 那几条），
两种语言同一串；`workspace.sidePanelDescription` 随之无人引用，删掉。
复量：两边停在同一步。

#### ⚠ 查这一条的过程里，**仪器骗了我三次**

1. 第一跑（8s 超时）看到两边停的步骤不同 → 疑似真差异；
2. 直接读面板 `innerText` → 两边**一模一样** → 我改判「是超时造成的假象」——**错的**；
3. 30s 重量 → 读数和 8s **完全一样**，根本不是超时；
4. 精确量「文本恰好等于 `Side chat` 的元素」→ 本仓多一个隐藏 `h2` → 才是真相。

**第 2 步那个 `innerText` 拼接太粗，把结构差异盖掉了。**
`getByText` 的 `^...$` 要求元素**整段文本**恰好匹配，所以它看得见、我的探针看不见。
**判据：探针的粒度必须至少和被它解释的那个断言一样细**——
用 `innerText` 去解释一条 `getByText` 的失败，等于换了把更粗的尺子再问同一个问题。


### 十四、普适 a11y 不变量扫了一遍：**真分叉 0 条**，「共有缺陷」全是已判过的或夹具造成的

本轮有收获的仪器有个共同点：**都是单应用不变量**（溢出、终态稳定、余量），
而不是加维度——因为两应用台账天生看不见「两边一样坏」。照这个方向再挑一条：

> **每个可交互控件都要有可访问名**（WCAG 4.1.2）。

现有六个 a11y 门禁全是**按屏**写的（artifacts / chat / scheduled-tasks /
sidebar / thread-list / primitives），又是「一块屏有门禁、其余没人看」的形状。
于是拿对照套件同一把尺子（`ariaSnapshot`）逐终态扫，**两个应用一起跑**。

**读数（57 个终态，跳过 1 个）：**

| | 结果 |
| --- | --- |
| **只有一边缺名字的（真分叉）** | **0 条** |
| 两边都缺的 | `button` 22 个终态、`link` 5 个、`combobox` 若干 |

#### 但那些「共有缺陷」逐条查下来都不是账

- **`composer-mode-trigger`**：`ChatComposer.vue:1885-1888` 的注释**早就判过**
  ——「没有显式 mode 时上游四条判断全不成立、什么也不画，所以这里同样挂在
  `explicitMode` 上，**按钮此时是一颗无名的空按钮，两边一致**」。
- **`composer-model-selector`**：触发器的内容只有 `selectedModel?.display_name`，
  而 **e2e mock 的 `/api/models` 返回 `models: []`**——空的是夹具，不是产品。
  （真实应用里选中模型后它有名字。空模型列表在真实部署里可达，
  那时两边都会出现一颗只念「按钮」的控件——**这一条是真的边缘账，但两边一样**，
  而且修它要么新造产品文案、要么让 `aria-label` 盖掉模型名，是产品决定。）

#### 判词

**这一档不值得做成常驻门禁**：它找到的每一条要么已有判词、要么是夹具，
真要常驻就得配一张「上游也这样」的豁免表，而那张表的每一条都会重复
`ChatComposer.vue` 里已经写过的话。

⚠ **我又一次差点重开一笔已经判过的账**——和 `SettingsDialog.vue` 那次同形。
**判据（第二次记）：动手之前先读那个组件自己的注释。**

**但「真分叉 0 条」这个负结果本身是有价值的读数**：可访问名这一整类上，
两个应用在 57 个终态上没有任何差异。


### 十五、语言 × 窄屏扫了一遍：**0 条溢出**，外加一条潜在的账

假设是「zh-CN 文案长度不同，窄屏更容易撑破」——两个轴各自都出过真账，
所以值得合起来量一次。做法是复用已有的窄屏溢出门禁，只把 locale 换成 zh-CN。

**读数：42 个可达终态、0 条溢出。** 这一档上语言轴没有东西。
（事后想也说得通：中文可以在任意字符间断行，min-content 反而更小；
真正撑破布局的是**不给换行机会的长 token**，那是英文那一侧的形状。
——但这句是事后解释，读数在前。）

#### 唯一一条失败是潜在账，不是活的

`thread-list-pin#mobile-drawer` 在 zh-CN 下走不到：

    locator.click: Timeout — getByRole('button', { name: /^(Toggle Sidebar|Open sidebar)$/ })
    locator resolved to <button aria-label="Toggle Sidebar" data-sidebar="trigger" …>

**按钮在、可见、名字也对**（`primitives.toggleSidebar` 两种语言同一串，
上游写死英文那条约定是对的）——失败的是**点不动**，有东西挡着。

它**只是潜在的**：这个终态只声明 `{ viewport: mobile, locale: "en-US" }`，
harness 从不在 zh-CN 下跑它。**谁哪天给它加 zh-CN 维，先回来读这一条。**

⚠ 顺带核过一条**不是**缺陷的：zh-CN 词典里有两个 `toggleSidebar`——
`primitives` 那条是写死英文（对，照抄上游），`shortcuts` 那条是「切换侧边栏」，
而它只用在**命令面板的命令名**上，是正当的产品文案。所有真正的侧栏触发器
用的都是 `primitives.*`。


### 十六、「点得动吗」扫了一遍：**0 条**，而第一版探针给出 7 条全是噪音

线索来自第十五节那条潜在账（按钮在、可见、名字对，却点不动）。
推广成普适不变量：**每个可见的可交互控件，中心点打下去要打到它自己**。
现有的 `hit` 那一档只查 settle 锚点那几个点，这是把它铺到全部控件上。

**第一版读数：7 个终态有命中。逐条看下来全是噪音**：

| 噪音源 | 例子 |
| --- | --- |
| **滚动位置** | `branch-thread` 的消息动作条被 `header.absolute.z-30` 粘头压住——滚下去就能点 |
| **背景控件** | `channels#settings-panel` 的按钮在打开的浮层后面，本来就该点不到 |
| `pointer-events: none` | 装饰层 |

收紧两条之后（**先 `scrollIntoView` 再测** + 跳过 `pointer-events:none`）：
**57 个终态、两个应用，0 条。**

#### 判词

- **这一档不值得做成常驻门禁**：收紧到不误报之后它一条都找不到。
- ⚠ **第一版那 7 条「发现」全是假的**——这是本轮第三次「新仪器第一跑给出一片红」
  （另两次：窄屏溢出扫描的 43/43、可访问名扫描的 22 个终态）。
  **判据（第三次记）：新仪器第一跑的结果，先假设是仪器错了。**
- ⚠ 收紧用的 `scrollIntoView` **会改页面状态**，探针可以、常驻门禁要另想办法。
- 它**没有**解释第十五节那条 zh-CN 的点不动——那一条是语言相关的，
  这个探针跑的是默认语言。两者不矛盾。


## 2026-09-18 第三十九轮：对话框窄屏扫描——**「门禁覆盖了」不等于「门禁量到了」**

### 一、结论先写：这一轮的缺陷是**门禁自己的夹具**放进来的

`settings-narrow-screen.spec.ts` 从第三十八轮起就按 `SETTINGS_SECTIONS` 覆盖**全部十个**
分区、两档宽度、带余量门限，十轮以来一直绿。而它用的是共享 mock 的默认值：

    GET /api/channels/providers  →  { enabled: false, providers: [] }

**它量的是一块空面板。** 装上对照场景那份 `CHANNEL_PROVIDERS` 之后同一条断言当场红，
而且两个应用都红：

| 读数（360px，`?settings=channels`，直接开、不缩窗口） | 本仓 | 上游 |
| --- | --- | --- |
| 那一格宽 | 278 | 278 |
| 面板实宽 / 固有最小宽度 | 297 | **500** |
| `panelOverflow`（= 实宽 − 格子） | **+19** | **+222** |
| 面板右边界（对话框右边界 344，`overflow: visible`） | 338 | **541** |
| `settings-panel-connected` 那一支 | +30 | **+250** |

上游那块面板**冲出对话框和视口 181px**。

**判据（新）：一条门禁的夹具是它的一部分，不是背景。**
「每个分区都有用例」和「每个分区都量到了东西」是两回事——
后者要问的是「这一屏上有东西吗」。

### 二、根因三层，全部两边同改

1. **设置对话框的栅格在 `md` 以下没有显式列模板**（两边同一行代码）。
   `grid min-h-0 flex-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]` —— md 以下隐式列是
   `auto`，栅格项的 `min-width` 默认 `auto`，于是**列被内容的固有最小宽度撑开**。
   实测列宽解析成 `296.859px` / `500.094px`，而那一格本该是 278。
   修法：补一档基础 `grid-cols-[minmax(0,1fr)]`。
   **为什么修列不修面板**：md 以下 `nav` 和面板在同一列里，列的最小宽度取两者较大值。
2. **上游 `ItemActions` 缺 `flex-wrap`**（真分叉）。本仓是 `ml-auto flex-wrap justify-end`，
   文件里还写着判词「两边都可能三颗」；上游只有 `ml-auto`。补上之后**上游的固有最小宽度
   从 500 掉到 297、528 掉到 308，与本仓逐像素相同**——这是这两条修正都对的最强证据。
3. **「移除 provider 配置」那颗按钮 `whitespace-nowrap`**（两边共有）。
   Button 基类就是 `whitespace-nowrap`，而这颗键文案最长：**固有最小宽度 229px**，
   而那张卡片只有 244 可用（面板 276 − 外层 `p-4` 的 32）。
   加上卡片自己的 `p-4`(32) + 图标位(32) + 两道 `gap-2`，卡片固有最小宽度 **263**。
   修法用的是第三十八轮「在浏览器重新注册」那一笔的同一串类：
   `h-auto min-h-8 py-1 whitespace-normal`。

修完之后 `gridCols` 两边都是 `278px`、`panelWidth == cell`、`panelRight 319 < 344`。

### 三、变异验证：三条变异，**其中一条证明我的第二条修正当前验不到**

| 变异 | 结果 |
| --- | --- |
| A：只撤栅格那一档 | **绿**（`2 passed`） |
| B：只撤按钮那一串 | **红**：余量 −19（360）/ −4（375） |
| C：两条都撤 | **红**：`panelOverflow` 19（360）/ 4（375） |

**A 为什么绿**：按钮换行之后面板的固有最小宽度掉到 278 以下，隐式列就不会被撑开了——
栅格那一档现在是**潜在守卫**，守的是下一条长文案。这一句已经写进
`SettingsDialog.vue` 的注释，连同翻案判据。

⚠ **值得单独记一笔**：要不是做了变异验证，我会把「A 也能红」当成事实写进交接文档。
**「说得通的东西」和读数长得一模一样**，这是第 N 次。

### 四、仪器的两笔账（都是我自己的）

1. **第一把尺子量错了对象。** 我先量的是「整个对话框的 min-content vs 它的实宽」，
   七个终态给出负余量。但 `escaped` 全空、`docScrollWidth` 全是 360、横滚只有两条
   已登记的——**对话框宽度本来就被视口硬顶住，负余量在那个对象上不代表任何东西**。
   承重链给出的 347−297=50 正好是 `p-6`+边框，才看出该量的是面板那一层。
   已验证有效的那把尺子（`settings-narrow-screen` 的「面板 vs 它那格」）换上去，
   对照组三条立刻给出 `targetWidth == cell == 278`、余量 37/45/98，与门禁的绿读数吻合。
   **判据：换了测量对象的尺子不是同一把尺子，先拿已知答案的样本验它。**
2. **「桌面开对话框再缩到 360」会把一部分对话框弄没。** `channels#runtime-config`
   与 `runtime-config-edit` 实测 `dialogsBeforeResize: 1 → dialogsAfter: 0`——
   桌面侧栏在 <768px 卸载，挂在它下面的对话框跟着卸载。
   **这两块屏我那一跑根本没量到**，是下一笔账。

### 五、这一轮量到的对话框全集（23 个终态开着对话框）

负余量七条里，`artifact-table-preview`(−271) / `artifact-batched-stream`(−133/−97) /
`workspace-changes#changes-panel`(−25) 都含已登记的「有意横滚」（表格、`pre`），
`browser-feature`(−3) 与 `background-tasks#drawer`(余量 10) 是尺子对象错了的产物。
**真账只有 channels 那两条**，已结清。

### 六、还没量到的（下一轮）

- `channels#runtime-config` / `runtime-config-edit` 两块对话框（缩窗口会把它们弄没）；
- `narrow-screen-overflow.spec.ts` 的 `MOBILE_UNREACHABLE` 那 14 条，
  「桌面开→缩到 360」是够得到它们的路子，但要先解决上面那条；
- `settings-narrow-screen.spec.ts` 里仍然量空面板的四个分区：
  `tools` / `subagents` / `skills` / `integrations`（共享 mock 给空列表）。
  另外五个（`account` / `appearance` / `notification` / `memory` / `about`）本来就没有列表。
- **上游那一侧没有任何门禁钉着这条**：`settings-narrow-screen` 只跑本仓，
  而 `channels#settings-panel` 没有 mobile 维（场景的 settle 要桌面侧栏），
  所以对照台账也看不见。上游单边回归会没人发现。


## 2026-09-18 第四十轮：那 14 条「窄屏到不了」量掉了，外加一条**差点判反**的共有缺陷

### 一、14 条「窄屏到不了」——**0 条溢出**，负结果，别重做

做法：桌面维把场景跑到位，再把视口压到 360（第三十九轮验证过这条路子够得到
`channels#settings-panel`），**两个应用各跑一遍**。

**读数：14 条 × 2 应用，`documentElement.scrollWidth` 全是 360、非「有意横滚」的
横向滚动容器 0 条。** 这一档上没有东西。

顺带量出「缩窗口之后哪些浮层没活下来」，**两个应用完全一致**：

| 终态 | 缩到 360 之后 | 两边 |
| --- | --- | --- |
| `channels#runtime-config` / `runtime-config-edit` | 对话框 1→0 | 一致 |
| `thread-history` | 菜单 2→0、浮层 2→0 | 一致 |
| `thread-list-pin` | 菜单 1→0、浮层 1→0 | 一致 |
| 其余 10 条 | 不变 | 一致 |

**判据：「缩窗口会把它弄没」不是本仓的毛病**，桌面侧栏在 <768px 卸载，挂在它下面的
浮层跟着卸载，两边同理。所以这条路子对**侧栏拥有的对话框**无效，量不到就是量不到，
要显式记下来，不要让它长得像「量过、没问题」。

### 二、`workspace-changes#reasoning-menu`：**我先判成本仓单边，一次实测把它翻了**

第一跑（从 1280 缩到 360）：

    vue    缩完 aria-expanded="true"，菜单还在 [0, 4, 280, 326]
    react  缩完 aria-expanded="false"，菜单没了，焦点回到 body

截图也对得上：本仓在左上角留下一块**离输入区十万八千里**的菜单，上游干净。
**我当时的判词是「上游是对的，本仓留了孤儿菜单」。**

分档再量（1280 → 1200 → 900 → 800 → 700 → 500 → 360，在触发器上打标记验节点身份）：

    vue    每一档都是 same-node
    react  800 → 700 之间 trigger=REMOUNTED，菜单跟着关

也就是说**上游关菜单是跨 `md`（768）重挂输入区的副作用**，不是它处理了这件事。
于是换起点重量——**700px 开菜单**（已经过了重挂点），再缩：

| 宽度 | 触发器 | 菜单 | aria-expanded | 两边 |
| --- | --- | --- | --- | --- |
| 700 / 660 | `[180, 739, 162]` | `[180, 409, 280]` | true | **一致** |
| 600 / 360 | `[0, 0, 0]` | `[0, 4, 280]` | true | **一致** |

**两边逐像素相同**：`sm`（40rem）以下那颗键的类 `hidden … sm:inline-flex` 把它压成
0×0，而 Radix 与 reka-ui 的 popper 都老老实实锚在那个 0×0 上，菜单停在原点附近。

#### 判词

- **这是两边共有缺陷，不是分叉**，按「两边都不对时取业界做法两边同改」修：
  菜单改成受控，触发器所在断点失效时关掉它。
  本仓 `ChatComposer.vue` 用 `useMediaQuery("(min-width: 40rem)")`；
  上游在 `hooks/use-mobile.ts` 里把 `useIsMobile` 建到一个通用
  `useMediaQuery` 上（`useSyncExternalStore`，服务端快照仍是 `false`），
  `input-box.tsx` 用 `REASONING_TRIGGER_VISIBLE_QUERY` 控制同一颗菜单。
- **常驻门禁**：`tests/e2e/mode-hover-guide.spec.ts` 新增一条，起点宽度 **700**。
  变异验证：撤掉 `v-model:open` → `1 failed`（`toHaveCount`）。
- ⚠ **起点宽度是这条用例的判据的一部分**，写在它的文件注释里。从 1280 起步
  它永远绿——上游那次重挂会把共有的那一半盖住。

#### 这一轮最该记住的一条

**「一次实测」能推翻推理，但推翻不了另一次实测——而两次实测可以互相推翻。**
第一跑的读数是真的（1280→360 两边确实不同），**结论却是错的**，因为起点选择
本身是实验设计的一部分。**换一个起点，同样的两个应用给出完全相同的行为。**
判据：报出「只有一边有问题」时，先问**这个差异会不会是我进入方式造成的**。

### 三、一条没成立的探针，不下结论

想量「跨 `md` 重挂会不会把输入区草稿弄丢」。探针写坏了两次（第一次定位器选到别的
`contenteditable` 卡死 5 分钟；第二次 `fill` 之后在 1280 上读回来就是空串），
**所以关于「丢草稿」这一轮没有任何读数，不要引用**。
重做时先确认那个 `textarea` 是不是受控的那一个。


## 2026-09-18 第四十一轮：把「门禁在空面板上空转」这件事本身堵住

### 一、先订正我自己上一轮写错的一句话

第四十轮的交接文档里写「`tools` / `subagents` / `skills` / `integrations` 四个分区
有列表但共享 mock 给空」。**逐个分区量了一遍，那句话有一半是错的**
（360px，`?settings=<id>`，面板 vs 它那格）：

| 分区 | item 行 | 按钮 | 正文字符 | min-content | 余量 |
| --- | --- | --- | --- | --- | --- |
| about | 0 | 11 | 2240 | 68 | 210 |
| memory | 0 | 0 | 464 | 124 | 154 |
| notification | 0 | 1 | 581 | 146 | 132 |
| skills | **3** | 7 | 537 | 172 | 106 |
| account | 0 | 2 | 376 | 204 | 74 |
| integrations | 0 | **3** | **827** | 241 | 37 |
| appearance | 0 | 4 | 530 | 254 | **24** |
| channels（已装夹具） | 7 | 16 | 1118 | 256 | **22** |
| **tools** | **0** | **1** | **373** | 144 | 134 |
| **subagents** | **0** | **1** | **615** | 168 | 110 |

`integrations`（827 字符、3 颗按钮）与 `skills`（3 行）**本来就有内容**。
真正空着的只有 `tools` 与 `subagents`。
**判据：写进交接文档的「哪些还没量」也要有读数，否则下一轮会照着它去修不存在的洞。**

### 二、给那两个分区装上夹具——**没有缺陷**

`/api/mcp/config` 与 `/api/subagents` 接上共享夹具之后：

    tools      item 0→2  按钮 1→7  min-content 144→180  余量 98
    subagents  item 0→3  按钮 1→4  min-content 168→172  余量 106

两个都很宽裕。**这一档是负结果。**

### 三、但光补夹具只修了一半——**空转本身才是那个缺陷**

第三十九轮的教训是「夹具是门禁的一部分」，可**补夹具是一次性的**：哪天 mock 不作答、
端点改名、或者新增一个带列表的分区，那条断言又会悄悄退回空转，而且**它会是绿的**。

所以这一轮给它补了**反空转断言**：`SECTIONS_WITH_LISTS` 里的分区必须真的画出行，
其余分区必须一行都没有。两张表恰好划分 `SETTINGS_SECTIONS`。
写成「哪些分区有列表」而不是「每个分区有几行」——行数是夹具的实现细节，
「这个分区该有行」才是产品事实。

变异验证：拆掉 `/api/subagents` 那条路由 → **2 failed**。

### 四、这一轮我自己的两笔仪器账

1. **一次静默失败的编辑。** 用 `str.replace` 往门禁里插两条路由，锚点因为 prettier
   已经重排而匹配不上，`replace` **返回原串、不报错**，于是我拿着「已经装好夹具」的
   前提去读那 4 条红，差点去查应用。**判据：脚本改文件必须断言锚点命中**
   （`assert s.count(old) == 1`），这一轮前面几次都写了，偏偏这一次漏了。
2. **第一反应又是怀疑应用。** 那 4 条红我先假设是「列表异步没到」，改成
   `expect.poll` ——**还是红**。写一个同样设置的调试用例才照出来：`items` 是 2 和 3，
   请求也确实发了，**应用一直是对的**。
   （这是「新仪器第一跑先怀疑仪器」的同一条，只是这次仪器是我的编辑脚本。）


## 2026-09-18 第四十二轮：两条静态扫描全是死路，一条常驻门禁落地

### 一、「死 testid」扫描——**0 条真账**

想法：测试里用的 `getByTestId`，如果那个 id 在 `app/` 里根本不存在，定位器永远
匹配不到，断言就是结构性空转。

**第一跑 35 条——先怀疑仪器**：大多数是模板插值（`agent-card-${AGENT_NAME}`
在源码里是模板不是字面量）。把源码里的**静态 testid（174 个）与模板前缀（33 个）**
都抽出来再比，剩 13 条；逐条查完：

- `agent-chat-stub`——**测试自己渲染的桩**（`agents-new-page.nuxt.test.ts:41`）；
- `message-list-bottom-spacer` / `sidecar-composer-disclaimer`——**有意的
  「不许长回来」断言**（`.exists()).toBe(false)`），而且 sidecar 那条旁边还有
  一条不依赖 testid 的文本断言兜着；
- 其余 10 条是我的前缀抽取没覆盖到的发出形式，`app/` 里都在。

**判词：不值得常驻。** 现在就有 13 条要豁免，而它一条真账都找不到——
那是「豁免表比门禁长」的形状。

### 二、「无肯定断言的缺席断言」扫描——**仪器坏了，判死路**

想把文档里那条「`hidden` 断言前面必须有一条 `visible`」推广成静态检查：
凡是断言「某元素不存在」的地方，同一份文件里要有一条证明这个定位器能匹配到东西的断言。

**读数 230 条**，而候选点总共才 176 个——正则把 `can-polish.test.ts` 这类
**纯逻辑单测的 `toBe(false)`** 也算了进来。

**判词：静态扫描回答不了「这条门禁会不会红」，不要再迭代这个正则。**
本仓两次真正抓到空转，靠的都是**去量那一屏**（`background-tasks#disabled` 的空
locator、`settings-narrow-screen` 的空面板），不是扫源码。
下一个人要查空转，做法是**挑一条门禁、把它要证明的前提拿掉、跑一遍**。

### 三、常驻门禁：窄屏扫描的第二轮

把第四十轮那次实测（14 条「到不了」× 2 应用、0 条溢出）常驻进
`narrow-screen-overflow.spec.ts`：桌面把状态走到位 → 压到 360 → 问同一个不变量。

**只数对话框，不数菜单**——第一版数了菜单，当场误报两条：

| 误报 | 真相 |
| --- | --- |
| `channels#settings-panel-connected` | 打开对话框用的那个菜单在快照那一刻还没关完（第四十轮同一状态量到的是不掉） |
| `workspace-changes#reasoning-menu` | 它的菜单**现在就是该关的**——第四十轮那笔两边同改 |

**判据：断言要稳，账要写清。** 菜单类终态的浮层这一轮量不到，这件事写在注释里，
不做成一条会飘的断言。

变异验证：拿掉 `channels#runtime-config-edit` 的登记 → 门禁把它报成「意外掉了」。

### 四、跑门禁时踩的两个环境坑（与产品无关）

1. **后台跑被中途掐掉两次**，日志停在构建、没有退出码行，而任务通知显示
   「completed」。**判据：拿退出码行判完成，不要拿任务通知判。**
2. 被掐掉的跑**留下占着 3115/3116/8021 的进程**，下一跑报
   `http://localhost:3115 is already used`。清理：
   `lsof -ti tcp:3115 | xargs kill -9`（三个端口都要）。

### 五、第三次栽在「编辑静默失败」上

这一轮又有一次 `python - <<PY` 的补丁**整块没写进去**：脚本在**后台**跑，
`AssertionError` 进了任务输出文件而我没读，于是我拿着「已经改好」的前提
去读后面的红。
**判据（第二次记）：改完当场 grep 核验落地结果**，而且**改文件的脚本不要放后台**。


## 2026-09-18 第四十三轮：前提变异跑通了——**方法成立，两条轴上 0 条空转**

第四十二轮判了「静态扫描查不出空转」。这一轮把**能用的那个方法**做成可重复的动作：
**把门禁要证明的前提拿掉，跑一遍，看谁还绿。**

### 一、做法（照抄即可）

前提不是产品代码，是**夹具**。共享 mock 的入口在
`tests/e2e/utils/mock-api.ts`，调用方喂进来的列表在这几行落地：

```
337  let threads = [...(options?.threads ?? [])];
338  const agents = options?.agents ?? [];
339  const skills = options?.skills ?? DEFAULT_SKILLS;
340  const scheduledTasks = options?.scheduledTasks ?? [];
1515 const projects = options?.projects ?? [];
```

把其中一行改成恒空，跑 `make e2e`，再把结果按 spec 聚合，
和「显式喂了这个选项的 spec」求交集。**整份仍然全绿的那些就是候选。**

⚠ **改 mock 的脚本不要放后台**，改完当场 grep 核验（第四十二轮的判据）。
⚠ 跑完**一定要还原**，并 `grep -c` 确认残留为 0。

### 二、读数

| 变异 | 结果 | 显式喂它的 spec | 如期变红 | 仍全绿 |
| --- | --- | --- | --- | --- |
| `threads` 恒空 | 107 failed / 189 passed（7.3m） | 31 | **27** | 4 |
| `agents`+`skills`+`scheduledTasks`+`projects` 恒空 | 22 failed / 274 passed（3.2m） | 9 | **4** | 5 |

**27/31 与 4/9 如期变红，这就是仪器可信的证据。**

### 三、九个「仍全绿」逐条查完——**0 条空转**

| spec | 真相 |
| --- | --- |
| `thread-history-mermaid` | 直接 `goto` 会话页并**自己 stub 了 `messages/page`**；`threads` 只填侧栏 |
| `scheduled-tasks` | 自带 9 条 `page.route`，自己 stub `/api/scheduled-tasks` |
| `scheduled-tasks-a11y-shape` | `threads` 轴上不依赖，**`scheduledTasks` 轴上如期红了 8 条** |
| `ui-select-shape` | 断言的是**新建表单里**那颗 Select，不是任务行——任务夹具对它是附带的 |
| `agents-feature-disabled` | 喂的本来就是 `agents: []`，清空等于没变 |
| `ui-primitives-a11y` / `integrations` | **我的「喂了什么」检测不准**：那两处 `skills:` 是它们自己路由的**载荷键**，不是 mock 的选项名 |

⚠ **最后一条是仪器的账**：判「谁喂了这个选项」不能只 grep `"<opt>:"`，
载荷里同名的键会混进来。下次按
`mockLangGraphAPI\([^)]*<opt>:` 这样的形状去匹配。

### 四、判词

- **这个方法值得留着，但不值得做成常驻门禁**：它要跑两遍全套（各 3–7 分钟）
  并人工判读交集，而它找到的东西是「测试写法」而不是「产品缺陷」。
  **做成一次性动作、写清怎么跑**，比塞进 CI 有用。
- **两条轴上 0 条空转是有价值的负结果**：夹具驱动的那 31+9 个 spec，
  绝大多数真的依赖它们喂的数据。
- 还没试过的轴：每个 spec **自己的** `page.route`（28 个 spec 用它喂数据），
  那才是剩下的大头，但它是逐 spec 的，没有统一入口。


## 2026-09-20 第五十八轮：同应用两跑幂等——**名单上最后一个面，0 条稳定缺陷**

方案 B 名单的最后一条。问的是：**同一个终态、同一个应用，新开 page 再跑一遍，
aria / 几何 / 请求序列与第一遍一样吗？**（第四十八轮那条飘是跨应用比，同应用自比从没做过。）

| 量 | 收工读数 |
| --- | --- |
| 新面 | 同应用两跑自比（**新开 page**，不复用——第五十轮判词） |
| 取样规模 | 58 个终态 × 2 跑 × 2 应用，**scanned=58/58，无 fail** |
| 仪器自检 | 阳性对照「改一处 aria-label → 差异=1」**两个应用都成立** |
| 产品缺陷 | **0 条稳定的**（1 条飘，三跑复现不了） |
| 本仓 | **58 个格子全 0**——完全幂等 |

### 唯一有差异的那一格，是飘不是账

```
react|branch-thread#turn-actions
  元素数 43/43 相同 · 请求序列 16/16 **完全相同**（reqDiff=0）
  但 43 条签名里 31 条对不上——抽样 6 条，**全是整列 x 平移 +8px**：
      div  "Original chat …"   248 → 256
      a    "Scheduled tasks"   923 → 931
      status "Context window" 1084 → 1092
      button "Open browser"   1120 → 1128
      button "Export"         1164 → 1172
  宽高与名字一格没变。
```

**定点复量三跑，`main` 恒为 `x=256 w=1024`、侧栏恒为 256、无滚动条——8px 没复现。**
按「判『飘』两次不一致就够 / 一次运行是一个样本」，**判飘，不判账**。
248 = 256 − 8，最可能是**第一跑被采在侧栏 `transition-[width]` 收敛之前**。

### ⚠ 真正该记的：`branch-thread#turn-actions` 在上游是不稳的，**三个面各撞到一次**

| 轮 | 面 | 撞到的形状 |
| --- | --- | --- |
| 52 | 文本缩放 200% | DOM 变了（281 → 277 个元素） |
| 55 | 点得动吗 × 200% | 两跑之间「只有上游/只有本仓」的行进进出出 |
| 58 | 同应用两跑幂等 | 整列 x 平移 8px（三跑复现不了） |

**三个互不相干的尺子，都只在这一个终态上抖。** 这不是三条账，是**一个不稳的终态**。

> **判词：同一个终态在多个互不相干的面上都抖，就该把它当成「这一屏本身不稳」，
> 而不是在每个面里各记一条账。** 下次再有尺子在这里报东西，
> **先假设是它，再去看是不是新东西。**

⚠ **不建议为它改产品**：它在上游、复现不了、请求序列完全相同、
台账也看不见（第四十五轮判过：几何比的是相邻关系，整列平移会抵消）。
**翻案判据**：哪天它在同一把尺子上连着两跑都报同一个差异，就回来查侧栏的收敛时机。

## 2026-09-20 第五十七轮：`forced-colors` 这个面——**0 条，而且是有信息量的 0**

按用户 2026-09-20 拍板的**方案 B**（走完已点名的名单再收），开名单上的第一个面。

| 量 | 收工读数 |
| --- | --- |
| 新面 | `forced-colors: active`（Windows 高对比）× 两个应用对照 |
| 取样规模 | 带文字的叶子 **本仓 3512 / 上游 3852** |
| 产品缺陷 | **0 条** |
| 仪器账 | **1 笔**——第一把尺子量错了东西，被阴性对照当场拆穿 |
| 顺带 | `prefers-contrast` 两边都**一行没写**，同一结论（对称缺席） |

### 静态那一半：两个应用**都没有任何强制配色代码**

```
forced-color-adjust / @media (forced-colors)   上游 0 处 · 本仓 0 处
prefers-contrast                               上游 0 处 · 本仓 0 处
```

**两边都完全依赖 UA 的默认行为**——所以强制配色下的任何差异只可能来自
primitive 的 DOM/CSS 本身，不可能来自「谁特意处理了、谁没处理」。
这一条把这个面的**上界**先钉住了。

### 运行时那一半：字底同色 0 条，而对照证明尺子在跑

判据用第四十四轮那套（画进 1×1 canvas 读像素，**不在 JS 里手工解析 `oklch`**）：

```
              唯一低对比签名      跨应用
normal 档     3                  只有本仓 0 · 只有上游 0 · 共有 3   ← 阴性对照成立
forced 档     0                  只有本仓 0 · 只有上游 0 · 共有 0
```

**normal 那 3 条正是第四十四轮判过的那一族**（上游的配色取舍，两边逐值相同）——
**它们是这把尺子「确实在量」的证据**；而 forced 档掉到 0，
是因为 Chrome 把作者色全换成系统调色板，系统色天然保证对比。

> **这个 0 有信息量**：同一把尺子在 normal 档报得出 3 条、在 forced 档报 0 条，
> 而不是两档都 0（那种 0 说明尺子没跑）。

### ⚠ 仪器账：第一把尺子量的是「有没有边框」，那是错的东西

第一版判据写的是「`border` / `outline` / `background-image` 三样都没有 = 没有边界」。
**阴性对照当场拆穿**：

```
normal 档就报出 borderless   本仓 623 · 上游 685
```

这个设计里**大量按钮本来就是 ghost 的**（无边框，靠底色和文字区分），
普通模式下 600 多条「没边界」是**正常**——尺子测错了东西。
它还顺带把跨应用差异也污染了（normal 档就有 15/77 的差，与强制配色无关），
而键 `tag[role]"文字"` 对**没有可访问名的按钮**会全部塌成一条。

换成「字和底的对比度」之后，normal 档 3 条、forced 档 0 条，两档都干净可读。

> **判词（第四十四轮 4c 的同一条，换个面又踩一次）：
> 「有没有 X」这种结构判据，在做对照之前先问「阴性对照报几条」。
> 报出几百条就说明它量的不是你想问的那件事——
> 而它照样会给你一张看起来很像发现的差异表。**

### 顺带记一条**未验证**的线索

`motion-reduce` / `prefers-reduced-motion` 的**源文件数**：上游 11 · 本仓 12。
**这是源码计数，不是渲染读数**——对照上下文已经钉了 `reducedMotion: "reduce"`，
台账在那个前提下是 0，所以多出来的那一处大概率是写法差异而非行为差异。
**要当账就得先实测**，别照着这个数去改。

## 2026-09-20 第五十六轮：把那条链修到底——**父菜单归位，残留定性，门禁落地**

接第五十五轮的 1a。产出三件：**推翻上一轮一条错判词**、
**父菜单两边同改并归位**、**这一类缺陷第一次有了会红的门禁**。

| 量 | 收工读数 |
| --- | --- |
| 订正 | **第五十五轮「本仓变量不生效」那条判词是错的**，用读数推翻 |
| 产品缺陷 | **1 条，两边同值，已两边同改**（⋯ 菜单 384px 摆在 375px 的屏幕上） |
| 撤回 | **1 处**：给 SubContent 加的同一个 clamp **让基线退化**，已撤 |
| 残留 | **1 条上游单边**，已定性 + 登记 + 写翻案判据（三条改法都被读数否掉） |
| 新常驻门禁 | `viewport-fit.spec.ts`（两个应用都跑，变异验证过） |

### 一、先订正上一轮那条错判词

第五十五轮写的是「补 `max-w-(--*-content-available-width)`，**本仓 reka 侧不生效**」。
**不是不生效，是不顶用。** 把变量直接读出来：

```
父菜单 menu0   两边都 available-width = 210px    实宽 384   maxW=none
子菜单 menu1   本仓 --reka-...-available-width  = 375px    ← 比自己的 344 还大，夹不住
               上游 --radix-...-available-width = 174px    ← 夹得住
```

**变量两边都设了、类也都应用了**，差的是两个 primitive 算出来的值：
reka 从视口边算，radix 从触发器翻转那一侧算。
另外 `min-w-32` = 8rem 在 200% 下是 **256px**——它是个 rem 下限，会把 `max-w` 顶回去
（上一轮量到的「256」就是这么来的，不是 174）。

> **判词：「改了没反应」有两种——没生效 / 生效了但不顶用。**
> 前者去查绑定，后者去查那个值是怎么算的。**写错方向会让下一个人白跑一轮。**

### 二、父菜单：两边同改，归位

改法是**把 `max-w` 和 `min-w` 双双夹进可用宽度**（只加在 `DropdownMenuContent`）：

```
max-w-(--*-content-available-width)
min-w-[min(8rem,var(--*-content-available-width,8rem))]
```

⚠ **只夹 `max-w` 没用**：`min-w` 那个 rem 下限会把它顶回去。这是第一节那条判词的直接后果。

```
                 改前                      改后
基线   两边 [59,314 192x243]          两边 [59,314 192x243]   ← 一格没动（那一档 clamp 不 binding）
200%   两边 [-46,289 384x483] 出界      两边 [0,209 210x603]   ← 归位，且逐字相同
```

### 三、⚠ 撤回：同一个 clamp 加在 SubContent 上**让基线退化**

上游子菜单被夹到 **129px**，条目 `Export as Markdown` **换行成两行**（高 32→52）；
本仓那一侧夹不住（值是 375），于是**两边基线宽度从相同变成 181 vs 129**。
**为修 200% 而弄坏基线、还把两边弄得更不一样——整处撤回。**

> **判词：一个改动要同时在「它要修的那一档」和「它没打算动的那一档」上量。
> 只量目标那一档，就会拿 200% 的好处去换基线的退化。**

### 四、残留：上游子菜单不翻进视口（**已登记，带翻案判据**）

撤回 SubContent 的 clamp 之后，**两边子菜单宽度逐字相同**（基线 181 / 200% 344），
**差的只有 x**：

```
基线   本仓 x=[194,375] 完整可见      上游 x=[246,427] vw=375  **右边出界 52px**
200%   本仓 x=[31,375]  完整可见      上游 x=[201,545] vw=375  **右边出界 170px**
```

**注意它不是 200% 才有的**——上游这颗 Export 子菜单**在默认字号下就已经在视口外**。
reka 把它翻到左边，Radix 不翻也不移。这是两个 primitive 的碰撞策略不同。

三条改法都被读数否掉，**别重走**：

| 试过的 | 读数 |
| --- | --- |
| `sticky="always"` | 一格没动。Radix 的 shift 是 `crossAxis:false`，右侧子菜单不在那条轴上移 |
| SubContent 加 `max-w-(available)` | 上游被夹到 129、条目换行，**基线退化**（见上一节） |
| 把本仓子菜单改成 portal 让变量生效 | ✗ 「不 portal」是 wave 95 拿可访问性树读数判的，不为这个翻 |

**已登记进新门禁的 `KNOWN_OUTSIDE`（两行，就是这一条账的两档）**，
翻案判据写在那张表旁边：哪天 Radix 把子菜单翻进视口、或者本仓这一处也跑出去，就改。

⚠ **一个顺带的事实**（解释未验证，但事实是量出来的）：
**这一处基线就差 52px，而台账报 0。** 台账那一档要么没采到子菜单，
要么比的是相邻关系而不是绝对位置。**这是「台账 0 不等于这一屏对齐」的又一个实例。**

### 五、新常驻门禁 `viewport-fit.spec.ts`

**不变量：浮层的矩形要整个落在视口里。** 两个应用都跑，基线与 200% 两档。

⚠ **判据选的是「位置」不是「宽度」**，这一步有读数支持：
全套上「比视口还宽」报 **0 行**，而「有部分在视口外」报 **2 行真账**——
一层 344px 的子菜单在 375px 的屏上完全装得下，**却可以被摆到 x=201、右边缘 545**。
「位置」那条**包含**「宽度」那条。

```
全套规模   两个应用各看见 62 个浮层（对称）
登记表     2 行，都是上游那条子菜单（基线 + 200%）
变异验证   撤掉第五十五轮的抽屉修正 → 本仓那条当场红，
           报出 抽屉 x=[0,576] vw=375 与它里面的菜单 x=[132,507]
```

**这条门禁补上的是第五十五轮明写的那个缺口**：
「固定 rem 尺寸的容器在 200% 下宽过视口」此前五次出现（浏览器工具条、
集成状态格、sidecar 页脚、移动端抽屉、这颗 ⋯ 菜单）**都没有任何门禁看得见**。

## 2026-09-20 第五十五轮：开「点得动吗 × 200%」这个面——**一条共有缺陷，外加三笔仪器账**

照交接的 1a 造面：第三十八轮那条「点得动吗」的单应用不变量**只在基线字号上跑过**，
这一轮把它搬到 200% 文本，并且**改成两个应用对照**。

| 量 | 收工读数 |
| --- | --- |
| 新面 | 「点得动吗」× 200% 文本 × 两个应用（58 终态 × 2 档 × 2 应用） |
| 取样规模 | considered **2767**（本仓）/ **2769**（上游）· modalSkips 1260 · inertSkips 122/120 |
| 仪器自检 | 阳性对照 **covered=10 / considered=10**，两个应用都成立 |
| 产品缺陷 | **1 条，两边共有，已两边同改** |
| 已量未修 | **2 条**（都在下面，带读数与翻案判据） |
| 仪器账 | **3 笔**——而其中两笔各让这把尺子整场报 0 |
| 失败的假设 | **2 个**，都实测过、都已还原 |

### 那条缺陷：移动端抽屉在 200% 下比屏幕还宽

`thread-list-pin#mobile-drawer` @200%、视口 375。两个应用**逐字相同**：

```
改前
  dialog（抽屉本体）        rect=[0,0 576x812]     ← 18rem 在 200% 下 = 576px > 375 视口
  ⋯ 触发器                  rect=[511,628 40x40]   ← 它自己就在屏幕外
  父菜单                    rect=[123,329 384x483]
  Export 子菜单   本仓      rect=[   0,530 344x146]  贴左边缘，勉强可读
                  上游      rect=[-212,530 344x146]  **只剩「…arkdown」「…SON」**（有截图）
改后（两个应用同值）
  dialog                    rect=[0,0 279x812]     ✓ 进视口
  ⋯ 触发器                  rect=[214,628 40x40]   ✓ 进视口
```

**根因是一个尺度错配，和第五十四轮那三处同形**：`18rem` 是**文字尺度**，
而这个抽屉只在手机宽度上出现。里面每一层都继承这份溢出——
所以**要修的是这一处，不是逐个 popper 去修**。

改法：`min(18rem, calc(100vw - 3rem))`（上游 `SIDEBAR_WIDTH_MOBILE` / 本仓 `w-72` 同改）。

⚠ **「基线没动」是量出来的，不是算出来的**——台账**证不了**这一条：
两个应用改的是同一处，真要一起变宽台账照样 0（「台账 0 不等于这一屏对齐」）。
所以单独定点量了一遍，两个应用逐字相同：

```
基线  drawer=[0,0 288x812]   ← 与改前一致（18rem @ root 16 = 288）
200%  drawer=[0,0 279x812]   ← 夹住了，375 的视口里留 96px 给遮罩
```

279 差不多正好是 `SheetContent` 默认的 `w-3/4`。

### ⚠ 这一条**没修完**，剩下的两截已量、已判、留给下一轮

```
父菜单      改后 rect=[-46,289 256x523]（两应用同值）——仍然 256 > 视口能给的宽度，
            现在是挂到**左边** 46px（改前是挂右边 141px）。**两边一样坏，不是对照缺陷。**
子菜单      本仓 [31,490 344x146]   上游 [201,490 344x146]
            **两边位置仍然不同**，但都已在视口内。
```

**为什么没接着修**：往下就是 popper 的碰撞策略，而**试过的两条路都被读数否掉了**，
见下面「两个失败的假设」。**继续往下改会造出新的两边不一致，所以停在这里。**

### ⚠ 两个失败的假设（**都实测过，都已还原；写在这里免得下一个人再试**）

1. **给上游 `DropdownMenuSubContent` 传 `sticky="always"`** —— **读数一格没动**（仍 `-212`）。
   我的推断是「Radix 用 `limitShift()` 限住了 shift」，**错了**：
   Radix 的 shift 配的是 `mainAxis: true, crossAxis: false`，
   而 `side="right"` 的子菜单要移的是 **x（cross 轴）**——它根本不在那条轴上 shift，
   `sticky` 管的是 y 轴上的 limiter。**推断说得通，读数不认。**

2. **两边都补 `max-w-(--*-content-available-width)`**（两个应用都已经在用
   `max-h-(--*-content-available-height)`，看起来只是补上对称的另一半）——
   **上游生效**（子菜单 344→256、条目换行到 104px 高），**本仓看起来没反应**，
   于是当轮整组还原了。

   ⚠⚠ **这条当轮的判词是错的，第五十六轮用读数推翻了。**
   当轮我写的是「本仓 reka 侧两个变量名都不生效」——**不是不生效，是不顶用**。
   第五十六轮把变量直接读出来：

   ```
   父菜单 menu0   两边都 available-width = 210px   实宽 384   maxW=none
   子菜单 menu1   本仓 --reka-dropdown-menu-content-available-width  = 375px
                  上游 --radix-dropdown-menu-content-available-width = 174px
   ```

   **变量两边都设了、类也都应用了**；差的是**两个 primitive 算出来的值不一样**：
   reka 从视口边算（375，比子菜单自己的 344 还大，所以夹不住），
   radix 从触发器翻转那一侧算（174，夹得住）。
   另外 `min-w-32` = 8rem 在 200% 下是 **256px**，它是个 rem 下限，
   会把 `max-w` 顶回去——上游那次量到的 256 就是这么来的，不是 174。

> **判词（订正后）：「改了没反应」有两种，
> **没生效**和**生效了但不顶用**——差别在于另一条声明把它顶回去了，
> 或者那个值本来就比内容还大。**别把后者写成前者**：
> 前者让人去查绑定，后者要去查那个值是怎么算的。**
>
> 这也是「推翻一次实测只能靠另一次实测」的又一例：
> 当轮的读数（改了、没变）是真的，**从它推出来的原因是假的**。

### ⚠ 三笔仪器账——**其中两笔各让这把尺子整场报 0**

1. **`top.contains(el)` 让「被盖住」永远检测不出来。**
   我照着 v4 探针写了 `el.contains(top) || top.contains(el)`，
   而**`body.contains(el)` 恒真**——盖住时 `elementFromPoint` 常常回的就是 body/祖先。
   `capture.ts` 那套原本只写 `element.contains(topmost)`，**是我抄的时候加错了**。
   抓到它的是阳性对照：盖一层整屏遮罩，报出来 **0 条**。

2. **浮层开着时 primitive 把整页设成不可点，尺子整场失效。** 实测：

   ```
   body 的 style 属性 = "pointer-events: none; overflow: hidden;"
   bodyPE=none   htmlPE=auto   每颗 button 的 computed pointerEvents = none
   于是 elementFromPoint 对**每一个点**都返回 <html>
   ```

   这些控件**确实点不动，而且那是对的**（判据与第四十四轮 `aria-hidden` 同形）。
   ⚠ 它同时解释了为什么**修好第 1 笔之后阳性对照还是 0**：
   **`pointer-events` 是继承属性**，盖上去的遮罩是 body 的孩子，自己也变成 none 了。
   遮罩必须显式写 `pointer-events: auto`，写了才 `top=div#zz-overlay`。

3. ⚠ **把「改文件的脚本」放进后台命令里，第三次踩。**
   编辑脚本的 `AssertionError` 进了后台任务的输出文件，我没去读，
   于是**拿着「已经改好」的假前提读完了一整跑的读数**，
   还纳闷为什么读数和上一跑逐字相同。
   判词文档里早就有这一条（「改文件的脚本不要放后台 …… 改完当场 grep 核验落地结果」）。
   **这一次是靠「两跑读数逐字相同」才起疑的——那本身就该是个信号。**

### 这一面掉出来的东西，和现有门禁**不重复**（有读数）

`content-reachable` 守的是「盒子把自己裁了且滚不到」。这一面守的是
「**在屏幕上但点不到**」与「**被推出视口**」，两者都不是裁剪：

- 第五十四轮本仓 sidecar 发送键 200% 下 `x=[1229,1293]`、视口 1280，**出界 13px**——
  它不是「盒子裁自己」，13px 也够不到 `content-reachable` 的 24 门限，**那把尺子看不见它**；
- 这一轮上游子菜单 `x=-212`，同理。

### ⚠ 门禁缺口（**明写，别当成已经守住了**）

**「固定 rem 尺寸的容器在 200% 文本下宽过视口」这一类，目前没有任何门禁。**
这一轮改的抽屉、第五十四轮改的工具条/状态格，都属于这一类。

**没有当轮做成常驻门禁，是刻意的**：这一面今天还剩 3(本仓) + 13(上游) + 2(原因不同)
条稳定差异（多数是上面那两截没修完的），现在常驻就要配一张十几行的登记表——
而第五十四轮刚证明**登记表会长假账**。
**先把那两截修完、行数归零，再常驻。** 探针全文留在下一节。

### 探针全文（第五十五轮，已验过两侧对照；下一轮直接拿去用）

放回 `frontend-vue/tests/e2e-parity/zz-hit200.spec.ts` 即可跑。
⚠ **它的两条自检都不能删**：阳性对照（盖整屏遮罩必须报满）与
`inertSkips`／`modalSkips` 计数——这一轮两次「整场报 0」全是它们抓到的。

<details><summary>zz-hit200.spec.ts</summary>

```ts
/* 一次性探针（第五十五轮）：「点得动吗」× 200% 文本，两个应用对照。用完即删。 */
import { test } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

/* 阳性对照：往页面上盖一层整屏透明遮罩，探针必须把底下的控件全报出来。 */
const POSITIVE_CONTROL_STATE = "thread-history";

/**
 * 「这颗控件点得动吗」。
 *
 * ⚠ 判据与选择器**照抄 capture.ts 的 `clickable`**，不另起一套——
 * 第三十八轮那一遍扫的就是它，换一套选择器就没法和那个 0 比较了。
 * `page.evaluate` 的函数闭包不到模块作用域，所以选择器当参数传（判词 4i）。
 */
function unhittable(args: { selector: string }) {
  const { selector } = args;
  const nameOf = (el: Element) =>
    (
      el.getAttribute("aria-label") ??
      (el as HTMLElement).innerText?.trim().replace(/\s+/g, " ") ??
      ""
    ).slice(0, 40) || `<${el.tagName.toLowerCase()}>`;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  /*
    **两支分开记，因为它们的含义完全不同**：

      covered      在屏幕上，但点下去打到别的东西——**没有任何现有门禁在守它**，
                   这一面新增的信息量全在这一支。
      offViewport  中心点不在视口里。**它不等于「够不到」**：翻到折线以下
                   的按钮本来就要滚一下。`content-reachable` 已经在守
                   「裁掉且滚不到」那一半，所以这一支**只看两个应用差不差**，
                   绝对值不当缺陷读（实测 showcase-public-thread 基线就有 12 条）。
  */
  const covered: string[] = [];
  const offViewport: string[] = [];
  let considered = 0;
  let modalSkips = 0;
  let inertSkips = 0;
  document.querySelectorAll(selector).forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    /*
      **模态开着时背景被 aria-hidden / inert 正是正确写法**（第四十四轮判词）：
      那些按钮点不动不是缺陷，是模态该挡住它们。不排掉的话 `integrations`
      一屏就报 48 条，全是噪声——第五十四轮当探针时实测过。
    */
    if (el.closest('[aria-hidden="true"], [inert]')) {
      modalSkips += 1;
      return;
    }
    /*
      ⚠ **浮层开着时 primitive 会把整页设成不可点**（第五十五轮实测），
      这也是这把尺子第一版整个失效的原因：

          浮层打开时 body 的 style 属性 = "pointer-events: none; overflow: hidden;"
          于是每颗背景按钮的 computed pointerEvents 都是 none，
          `elementFromPoint` 一路落到 <html>——**每一个点都返回 html**。

      这些控件**确实点不动，而且那是对的**：判据与第四十四轮 aria-hidden 那条
      同形，模态开着时背景本来就该挡住。不排掉整屏都是噪声。

      ⚠ 它同时解释了为什么阳性对照报 0：盖上去的遮罩是 body 的孩子，
      **`pointer-events` 是继承属性**，遮罩自己也变成 none 了。
      对照必须显式写 `pointer-events: auto`（实测那样才 top=div#zz-overlay）。
    */
    if (cs.pointerEvents === "none") {
      inertSkips += 1;
      return;
    }
    considered += 1;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const inViewport = cx >= 0 && cy >= 0 && cx <= vw && cy <= vh;
    if (!inViewport) {
      offViewport.push(`${nameOf(el)} :: off-viewport`);
      return;
    }
    /*
      ⚠ **判据逐字照抄 capture.ts：只有 `element.contains(topmost)` 算命中。**
      第一版多写了一个 `top.contains(el)`，而 `body.contains(el)` 恒真——
      于是「被盖住」这一支永远检测不出来，**阳性对照当场报 miss=0**。
      （被盖住时 `elementFromPoint` 常常回的就是 body / 某个祖先。）
    */
    const top = document.elementFromPoint(cx, cy);
    if (top && el.contains(top)) return;
    covered.push(
      `${nameOf(el)} :: covered-by ${top ? top.tagName.toLowerCase() : "nothing"}`,
    );
  });
  return {
    covered: covered.sort(),
    offViewport: offViewport.sort(),
    considered,
    modalSkips,
    inertSkips,
    vw,
    vh,
  };
}

const CLICKABLE =
  "a[href],button,input,select,textarea,summary,[role=button]," +
  "[role=menuitem],[role=menuitemradio],[role=option],[role=tab]," +
  "[role=switch],[role=checkbox],[role=separator],[contenteditable=true]";

for (const [name, base] of APPS) {
  test(`hit200 ${name}`, async ({ browser }) => {
    test.setTimeout(900_000);
    const lines: string[] = [];
    let totalConsidered = 0;
    let totalModalSkips = 0;
    let totalInertSkips = 0;
    let positiveControlRows = -1;
    for (const scenario of PARITY_SCENARIOS)
      for (const state of scenarioStates(scenario)) {
        const key = `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`;
        const dimension =
          state.dimensions?.[0] ??
          scenario.dimensions?.[0] ??
          DEFAULT_DIMENSION;
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        try {
          await runScenario(page, base, scenario, dimension, state, 30_000);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          for (const phase of ["base", "200"] as const) {
            if (phase === "200") {
              await page.addStyleTag({
                content: `html{font-size:32px !important}`,
              });
              await waitForFiniteAnimations(page);
              await waitForDomQuiet(page);
            }
            const r = await page.evaluate(unhittable, { selector: CLICKABLE });
            totalConsidered += r.considered;
            totalModalSkips += r.modalSkips;
            totalInertSkips += r.inertSkips;
            lines.push(
              `@@ ${name}|${key}|${phase}|considered=${r.considered}` +
                `|modalSkips=${r.modalSkips}|inertSkips=${r.inertSkips}` +
                `|covered=${r.covered.length}|off=${r.offViewport.length}`,
            );
            for (const row of r.covered)
              lines.push(`@@cov ${name}|${key}|${phase}|${row}`);
            for (const row of r.offViewport)
              lines.push(`@@off ${name}|${key}|${phase}|${row}`);
          }
          /* 阳性对照：盖一层整屏遮罩，报出来的条数必须 > 0。 */
          if (key === POSITIVE_CONTROL_STATE) {
            /*
              ⚠ 遮罩必须是**真元素**且显式 `pointer-events: auto`：
              伪元素那版与不写 pointer-events 那版都盖不住，见上面的判词。
            */
            await page.evaluate(() => {
              const d = document.createElement("div");
              d.id = "zz-positive-control";
              d.style.cssText =
                "position:fixed;inset:0;z-index:2147483647;pointer-events:auto;" +
                "background:rgba(0,0,0,0.01)";
              document.body.appendChild(d);
            });
            await waitForDomQuiet(page);
            const r = await page.evaluate(unhittable, { selector: CLICKABLE });
            positiveControlRows = r.covered.length;
            lines.push(
              `@@control ${name}|${key}|盖整屏遮罩后 covered=${r.covered.length} / considered=${r.considered}`,
            );
          }
        } catch (error) {
          lines.push(
            `@@fail ${name}|${key}|${String(error).split("\n")[0]?.slice(0, 80)}`,
          );
        } finally {
          await context.close();
        }
      }
    lines.push(
      `@@total ${name}|considered=${totalConsidered}|modalSkips=${totalModalSkips}` +
        `|inertSkips=${totalInertSkips}|positiveControl=${positiveControlRows}`,
    );
    console.log(`\n@@PROBE-START@@\n${lines.join("\n")}\n@@PROBE-END@@\n`);
  });
}
```

</details>

## 2026-09-20 第五十四轮：两张登记表 11+1 行全部还清——**其中 3 行是尺子，8 行是两边一样坏**

第一步照交接文档的 1a：还 `content-reachable.spec.ts` 的纵横两张登记表。
交接把它写成「便宜且有先例」——**不是**。12 行摊开来是**四处**，
逐处定性之后只有一处符合交接的描述（上游单边），其余三处各是另一种东西。

| 量 | 收工读数 |
| --- | --- |
| 登记表 | 纵向 1 → **0** · 横向 11 → **0**（两张都空了） |
| 产品缺陷 | **4 处**：3 处两边同改（两处两边同值 + 一处两边各坏各的）+ 1 处本仓单边（两个调用点的 `gap`） |
| 尺子的洞 | **1 个**（3 行是它造出来的） |
| 顺带掉出 | **1 条本仓单边**：sidecar 发送键 200% 下出界 13px——查上游那 70x 时掉出来的 |
| 变异验证 | **2 次，都红在该红的地方** |

### 逐处定性（每处都带改前/改后读数）

#### 1. `thread-list-pin#mobile-drawer`（纵 1 行 + 横 2 行）——**尺子的洞，不是账**

命中的元素两个应用**逐字相同**：

```
div.flex.flex-col.gap-1.5.p-4.sr-only   "Sidebar / Displays the mobile sidebar."
  基线  cw=32 ch=32  sw=197 sh=82    →  报 50y / 165x
  200%  cw=64 ch=64  sw=368 sh=164   →  报 100y / 304x
```

它是 Sheet 的 `<SheetHeader className="sr-only">`。**`p-4` 压过 `sr-only` 的
`padding: 0`**，于是盒子是 32×32 而不是 1×1，尺子那条
`clientWidth <= 1 || clientHeight <= 1` 的读屏器守卫**一个都拦不住**——
而 `clip: rect(0,0,0,0)` 仍然把它整个裁没，屏幕上一个像素都不画。

**这一条挂在登记表里两轮，被当成「两边一样坏、排队等还」。**
改法是修尺子：认「把自己整个裁没」的那两条声明（`clip: rect(0,0,0,0)` /
`clip-path: inset(50%)`），而不是认 1×1，也不是认类名叫不叫 `sr-only`。

> **判词：一条「跳过」分支写歪了，症状不是漏报，是让登记表长出假账。**
> 而假账和真账在表里长得一模一样——两轮都没人怀疑过它。

⚠ **同一个洞在另一条轴上也在造数**：第五十三轮断点轴那「18 个两边逐字相同的签名」
里，**头一族 `Sheet 头 50y/265x ×6 @mobile` 就是这同一个 `p-4 sr-only`**。
那一轮拿它当「尺子在这两档报得出东西」的反空转证据——**证据成立**
（尺子确实在跑），但那 6 处**同样不是内容**。修完 `clippedAway` 之后它们一起没了。

> **一个尺子的洞会在你打开的每一条新轴上各造一批假读数，
> 而每一批看起来都像「这一轮新量到的」。**

配套加了**反空转之三**：把命中次数回传出来断言 `> 0`。
那条分支是「跳过」，写错了只会一次都不命中，而**那时候门禁照样绿**
（多报的噪声会被登记表吸收）——第五十三轮 4i 那条的同一形状。

#### 2. `browser-feature` 217x（横 2 行）——**真缺陷，两边同值，两边同改**

侧栏格的宽度按视口百分比算（~307px），而里面每件都按 rem 排：
200% 下这条工具条要 **524px**。「点得到吗」那把尺子当场给出后果：

```
改前（两个应用逐字相同，基线那档 miss=0）
  <input>          x起 1307   inViewport=false
  "…"（实时控制）   x起 1323   inViewport=false
  "Close browser"  x起 1433   inViewport=false     ← 视口 1280，面板关不掉
```

两边给 header 加 `flex-wrap`、给 URL 表单把 `flex-1` 换成
`grow basis-0` 再加 `@max-[12rem]:basis-full`。

⚠ **`flex-1` 换成 `grow basis-0` 不是洁癖**：`flex-basis: 0` 的假想尺寸是 0，
换行时它会落进「还剩点空的那一行」再去长剩余空间——**实测长出来 5px 的地址栏**。
⚠ **门限写 `rem` 是判据本身**：这一行要随文字变大而重排，不是随窗口。
12rem 在默认字号下是 192px，而这条 header 在 100% 下有 283px（91px 余量）。

```
改后（两个应用逐字相同）
  clips = 0 / 0
  "Close browser"  x=[1107,1171]  fullyInView=true
  基线那档：clips=0，截图逐格未动（仍是单行 🖥 Browser ← → [URL] ((•))… ✕）
  200% 那档：两个应用的截图**看不出区别**，同为四行
             [🖥 Browser] / [← →] / [URL] / [((•))… ✕]
```

#### 3. `integrations` ×3 终态 ×2 应用 41x（横 6 行）——**真缺陷，两边同值，两边同改**

承重链逐层量下来，两个应用**逐层同形、逐值同数**：

```
div.grid.gap-3.md:grid-cols-4        rect=734  sw=872
  → div.rounded-lg.border.p-3        rect=166  sw=302
    → div.mb-2.flex.justify-between  rect=116  sw=278
      → span（Badge "Pending"）      rect=153  [shrink-0 · whitespace-nowrap]
```

**`md:grid-cols-4` 是视口断点，而格里每一件都按 rem 排**：200% 下四列还是
166px 宽，而状态徽标涨到 151px，和它并排的标签再也放不下。

改成 `grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]`——rem 门限自己重排
（默认字号 4 列 / 200% 2 列 / 手机 1 列），**顺带把 3-vs-4 那个三元吃掉**：
空轨道会塌，三张卡片排出来与原先的 `grid-cols-3` 逐格相同。改后两应用同为 `clips=0`。

⚠ 这里没有用容器查询，虽然两个应用都支持：`auto-fit` 不需要多立一个容器，
也就不会给 `CardContent` 加上 `contain: layout`（它下面有绝对定位的孩子）。
**能不引入新的包含块就别引入。**

#### 4. `react/sidecar-chat` 70x（横 1 行）——**真缺陷，而查它的时候掉出本仓的另一半**

交接把这一行写成「只有上游」，读数没错，但**结论只对了一半**：

```
上游  div.flex.items-center.gap-1.min-w-0.flex-1.flex-nowrap.overflow-hidden
        cw=113 sw=183 dx=70     → 档位标签 "Flash" 被自己裁掉
      sidecar 发送键 x=[1159,1223]  fullyInView=true

本仓  同一行不裁（只有 13x，够不到 24 门限）
      sidecar 发送键 x=[1229,1293]  **fullyInView=false**   ← 视口 1280，出界 13px
```

**两边各坏各的，而门禁只看得见上游那一半**——本仓那一半不在任何一张表里，
因为它溢出的方式不是「盒子裁自己」而是「把兄弟推出视口」。

根因是同一条：`flex-1` 的假想尺寸是 0，行永远挤不满，也就永远不换行。
上游左组因此拿到 113px 去装 183px；本仓没有那个 `overflow-hidden`，
于是改成把发送键推出去。

两边同改：上游 footer `flex-nowrap` → `flex-wrap`，两个 `PromptInputTools`
的 `flex-1`/无 → 都给 `grow`（右组单独落到第二行时 `justify-end` 才按得住）。
本仓**按上游的分层补两层真容器**并撤掉 `<span class="flex-1" />` 那根撑杆——
它和上游的两分组在 100% 下渲染逐格相同，**换行时却完全不同**。

#### 5. 两个 composer footer 的 `gap`（**本仓单边，两个调用点**）——从「未验证的源码印象」转成读数

这一条不在登记表里，是查第 4 处时顺出来的。**它的价值不在 4px，在于它为什么藏得住。**

上游的三层：

```
InputGroupAddon 的 cva 基类            gap-2      （input-group.tsx:38）
PromptInputFooter  cn("justify-between gap-1", …)  → 压回 gap-1
两个调用点各自再传 gap-2               → 压回 gap-2
  sidecar-panel.tsx:638   "@container flex flex-wrap gap-2"
  input-box.tsx:2418      "flex flex-wrap gap-2 sm:flex-nowrap"
```

本仓 `ComposerSurface.vue:130` 的 scoped CSS 只实现到 `gap: 0.25rem` 那一层
（= 上游 `PromptInputFooter` 的默认值，**这一层是对的**），
**两个调用点的 `gap-2` 覆盖一个都没有。**

实测（sidecar，两个应用同屏）：

```
              基线 rowGap/colGap   200% rowGap/colGap   200% footer 高   200% 第一行 y
本仓          4px                  8px                  172             [607,671]
上游          8px                  16px                 180             [599,663]
```

⚠ **为什么台账报不出它**：不换行时两个组一个 `grow`/`flex-1`、一个右对齐，
多出来的 4px 被 free space 吃掉——**外沿逐像素相同**（submit 与档位键两边
x 全等，`[1219,1251]` / `[932,994]`）。**一换行它才现形成行间距。**

改法：两个调用点各补 `gap-2!`（带 `!` 是要压过 scoped CSS 的 `(0,2,0)`，
普通工具类 `(0,1,0)` 压不过；`gap-1!` / `px-2!` 是本仓已有的同一写法）。

> **判词：一条「被 free space 吃掉」的差异，在布局换行之前是量不出来的。**
> 这一轮是**先改了 sidecar 的换行**，它才从「源码印象」变成「读得出的 8px」。
> 换句话说——**改布局会让此前藏着的差异现形，所以改完要重新量一遍，
> 而不是只量你打算改的那一处。**

⚠ 顺带：这条起点是第五十四轮中途写在交接 1c 里的一行「**未验证**」。
**写「未验证」是对的**——当时确实只读了源码；而它后来成立了。
**别把未验证的印象写成读数，也别因为没量就不记。**

### 变异验证（两次，都红在该红的地方）

```
M1  撤掉本仓 integrations 那条修（注释不动）
    → 红：+ integrations / #permission-request / #change-app  各「裁掉 0y/41x 且滚不到」
M2  把 clippedAway 打瞎（恒 false）
    → 红：+ thread-list-pin#mobile-drawer[基线] 50y/165x
          + thread-list-pin#mobile-drawer[200%] 100y/304x
    （纵向那条断言先炸，所以横向那两行没走到——信号仍然唯一：那 3 行是 clippedAway 去掉的）
```

⚠ **第一次变异跑白跑了一趟**：`--grep "^vue"` 一条都没匹配上，
Playwright 报的是 `No tests found` 而 shell 退出码同样是 1。
**「红」和「压根没跑」的退出码一模一样**——判变异成不成立要看**它报了哪几行**，
不是看退出码。（第三十九轮「门禁绿 ≠ 这屏没问题」、第五十三轮「门禁绿 ≠ 门禁跑过」
的第三层：**门禁红 ≠ 门禁跑过**。）

### 这一轮最该记住的

> **登记表是会长假账的。** 12 行里 3 行根本不是产品的事，而它们在表里
> 和真账长得一模一样，还各自配着「两边逐字相同」的读数当背书——
> **「两边读数相同」证明的是两边一样，不是证明那是账。**

> **交接文档的难易判断不作数。** 这一条被写成「便宜且有先例」，
> 实际是四处、三种性质、两个应用、一条顺带掉出来的新缺陷。
> **摊开来逐处定性之前，行数不是工作量。**

## 2026-09-20 第五十三轮：断点轴 0 条——**而掉出东西的是给这个 0 做的自检**

第一步照交接文档的 1a：把第五十二轮那把「够不够得到」的尺子换一个自变量——**断点**。
结论分两半：**换轴本身 0 条**，**给这个 0 做的「浮层还在不在」自检掉出 5 条**。

| 量 | 收工读数 |
| --- | --- |
| 新面 | 断点轴（375 / 768），每应用 **114 个「终态×断点」** |
| 对照缺陷 | **0 条**（本仓 18 处 · 上游 18 处，**18 个签名逐字相同**） |
| 顺带掉出 | **5 条**跨应用行为差异（已判：上游重挂树的副作用，本仓不改） |
| 新常驻门禁 | `overlay-survives-resize.spec.ts`（两个应用都跑） |
| 仪器账 | **2 笔**，都是自己的 |

### 一、断点轴：有信息量的 0

```
本仓 18 处 · 上游 18 处
去掉 class 串（两边 primitive 不同构）后按「场景@断点 + 裁剪量」比：
  两边逐字相同 18 · 只有本仓 0 · 只有上游 0
```

**这个 0 过了「尺子会不会红」那一关**——它在这两档上报得出 18 处，不是 0。
18 条全落在已知族里：Sheet 头 `50y/265x`×6 @mobile、分栏格 `1y/38~49x` @tablet、
面板内层 `0y/64x`、integrations `0y/24x`×3，**都是两边共有**。

⚠ 顺带确认了第五十二轮那条判词的反面：**`runScenario` 之后再 `setViewportSize` 是
能落地的**（自检读回 `375x812` / `768x1024`）。死的是外部 context viewport，不是这条路。

### 二、⚠ 真正掉出东西的是自检：**缩过断点时上游关浮层、本仓留着**

交接文档第 3 条写着「缩窗口会把一部分浮层弄没，必须显式记缩完还在不在」。
照做之后：

```
浮层数缩前→缩后          本仓 13 格变化 · 上游 18 格变化
其中 5 格只有上游在变：
  agent-chat#model-picker@mobile          本仓 2→2   上游 2→0
  background-tasks#drawer@mobile          本仓 1→1   上游 1→0
  ui-polish-mobile@tablet                 本仓 1→1   上游 1→0
  user-message-plain-text@mobile          本仓 1→1   上游 1→0
  workspace-changes#changes-panel@mobile  本仓 1→1   上游 1→0
「缩前两边浮层数就不同」的格子：**0**   ← 所以不是「本仓没开过」
```

**三跑逐字同号**（一次全量 + 两次定点），稳定。
而第四十轮判过的那三条（`channels#runtime-config` 1→0、`thread-history` 2→0、
`thread-list-pin` 1→0）**本轮逐条复现且两边相同**——尺子与那一轮同源。

### 三、判词：**本仓不改**

决定性读数是「缩完之后本仓那个浮层还贴不贴触发器」：

```
本仓 5 条全部              出视口 0 · 触发器可见 · 间距 0 / 4 / 4 / 37 / （抽屉无触发器）
上游 5 条全部              浮层 0（关掉了）
```

**本仓的浮层没有飘**——全在视口内、仍贴着可见的触发器。所以：

- 上游关掉是 `chat-box.tsx` 的 `if (isMobile)` 分支**整棵换树**的副作用，
  与第四十轮那句「**上游那次『关掉』是重挂的副作用，不是它处理了这件事**」同形；
- 本仓 `WorkspacePanels.vue` **故意不换树**，文件头早有判词并带读数
  （换树会让聊天区连同 query 一起重挂载，**实测多打一次 `/api/skills`**）。

**照抄「跟着关」等于照抄一个副作用，而且会和那条既有判词打架。本仓这一侧不改。**

⚠ **翻案判据**：哪天量到本仓的浮层在缩完之后跑出视口、或触发器不可见、
或间距远大于 anchor 偏移，就回来让它跟着关——这正是新门禁守的三件事。

### 四、常驻门禁 `overlay-survives-resize.spec.ts`

不变量：**把窗口缩过断点之后，凡是还开着的浮层，都必须整个在视口里，
并且仍贴着一个可见的触发器。**

**它故意不断言「浮层还在不在」**——两个应用在这一点上合理地不同，
上游靠「关掉」平凡满足，本仓靠「贴着」满足，两边都过；
而哪天本仓的浮层真飘了它会红。

反空转四条：跑不到位清零 · 量到的终态 >0 · **缩完的 `innerWidth` 必须只有 375** ·
**本仓必须至少有一格缩完仍开着浮层**（否则这门禁退化成空转而照样绿）。

**变异验证**：`MAX_GAP_PX` 64 → 0，当场红并报出 `离触发器 37px` / `离触发器 4px`，
且「跑不到位」清零；还原后绿。

### 五、⚠ 两笔仪器账，都是自己的

**1. 只记「变了的」格子 → 「不变」有歧义。**
第一版只记浮层数发生变化的格子，于是「不变」同时覆盖
「1→1 浮层扛住了」与「0→0 这屏压根没开过浮层」——**含义完全相反**。
改成**每一格都记 [缩前, 缩后]** 之后才看得出那 5 格是 `N→N` 而不是 `0→0`。
这是第四十轮「『没量到』要和『量过、没问题』分得开」在**计数**上的同一条。

**2. ⚠ 反空转断言第一次抓到的是门禁自己的空转。**
`survey()` 是序列化到浏览器里跑的，**闭包不到模块作用域**。
我把内联的 `64` 「整理」成具名常量之后，每个终态都抛
`ReferenceError: MAX_GAP_PX is not defined`——

> 而 `broken` 因此**一直是空数组**。要不是那条「跑不到位清零」的断言，
> **这条门禁会绿着交付，而它什么都没验。**

判词：**`page.evaluate` 的函数，门限/配置一律当参数传**；
以及——**反空转断言不只防应用的空转，它首先防的是门禁自己的**。


## 2026-09-20 第五十二轮：文本缩放那 59 处全部定性——**两条真分叉，一条基线就在丢**

第五十一轮留下「59 处一条都还没定性」。这一轮把同一把尺子在上游跑了一遍，
59 处按「场景键 × 族」逐条对完，掉出**两条本仓单边的真缺陷**；
其中一条**与文本缩放无关**——基线字号下就已经丢内容，200% 只是把它放大。

| 量 | 收工读数 |
| --- | --- |
| 新面 | 文本缩放 200%（WCAG 1.4.4）**走完**，并**常驻**成 `content-reachable.spec.ts` |
| 产品缺陷 | **2 条**（都在本仓，都已修） |
| zz-zoom 本仓档 | 59 → **45**（消失 14 条，**新增 0 条**） |
| 「够不到」的终态 | 3 → **1**（剩的那个两边逐字相同，已进豁免表） |
| 仪器账 | **3 笔**（两笔是第五十一轮留下的，一笔是我自己的） |

### 一、⚠ 第五十一轮那张「按族归类」表是在**截断过**的输出上做的

探针末尾 `findings.slice(0, 40)`，而本仓那一档有 **59** 处。
「新裁掉的 59 处」这一行**是对的**，所以表看起来自洽——但表里只有 37 条。

| 族 | 第五十一轮表里 | 本轮全量 |
| --- | --- | --- |
| `peer/menu-button` | 13 | **28** |
| FlipDisplay | 12 | 12 |
| `splitpanes__pane` | 4 | **8** |
| integrations | 3 | 3 |
| `ml-auto.h-full` | 2 | 2 |
| DOM 变了 | 2 | 2 |
| 其他 | 1 | **4** |
| **合计** | **37** | **59** |

**整族漏掉的那一条正是全集里最大的一条**：`scheduled-tasks` 的
`div.relative.min-h-0.flex-1` **+3289y**（基线就已经 1086y）。
也就是说，这一轮真正要修的那条缺陷，上一轮的表里**根本没有它**。

> **判词：总数对，不等于表对。** 一个会截断的报告配一个不截断的计数，
> 长出来的就是「自洽但不完整」——比报错更难发现。
> **凡是「按族归类」，先核对各族之和等不等于总数。**

### 二、两边对照（同一把尺子、同一次会话、58 个终态）

```
本仓 59 处      上游 82 处
按「场景键 × 族」求交并差：逐字相同 20 组 · 对不上 0 组
```

#### 两边逐字相同 → 共有，不是分叉

| 族 | 本仓/上游 | 增量 |
| --- | --- | --- |
| `peer/menu-button`（侧栏四条） | 28 / 28 | 都是 `+2y +8x`（基线 2y/9x vs 2y/8x） |
| 分栏格 | 7 / 7 | `+32y+232x`·`+0y+204x`·`+0y+200x`×4 **逐字同号** |
| integrations 卡 | 3 / 3 | `+0y +41x` |
| 面板内层 | 1 / 1 | `browser-feature +0y +217x` |
| `scheduled input` | 1 / 1 | `+0y +24x` |
| `mobile-drawer` | 1 / 1 | `+50y +139x` |

⚠ **分栏格这一族两边 primitive 完全不同构**（splitpanes 的 CSS
vs react-resizable-panels 的内联样式），class 串天生不同，
**跨应用不能按 class 串对**。按「场景键 × 族」对之后增量逐字相同，才是「两边一样」的证据。

#### 只有上游的那条大的是**尺子的**

`branch-thread` / `#turn-actions` 的消息列 `div.relative.flex-1.overflow-y-hidden`
在 200% 下裁掉 **998px**（基线 201px），看着比本仓那条还大——
它是 `use-stick-to-bottom` 的 `StickToBottom`，**外层 `overflow-y-hidden`、
滚动条在内层**，内容完全够得到。
**这一条决定了门禁的判据必须是「裁掉 **且** 全链路滚不动」**，只判「裁掉」会把它报成缺陷。

另外 37 个终态上游在分栏根 `ResizablePanelGroup` 上 `+0y +8x`（基线 8x），
本仓 splitpanes 根不裁。8px、横向、两边都有各自的裁剪层，**未判**。

### 三、真分叉之一：`scheduled-tasks` 整页内容够不到（**基线就丢**）

```
             基线(16px)                        放大(32px)
本仓   内容壳 clientH 800 / scrollH 1886      clientH 800 / scrollH 5175
       裁掉 1086px   docScrollable=0         裁掉 4375px  docScrollable=0
       祖先可滚 null · 内层滚动容器 0         同左
上游   不裁          docScrollable=1086       不裁         docScrollable=4376
```

**同样的内容、同样的溢出量**（1086 vs 1086、4375 vs 4376），两边截图顶部逐像素一样，
都停在「Prompt」那一行——差别只有「能不能往下滚」。
滚到底的定点读数：

```
              顶部                        底部
上游   末尾控件 y=4403 inView=false   scrollTop=4376  y=27 inView=true  页头 y=-4376  侧栏 fixed y=0
本仓   末尾控件 y=4402 inView=false   **滚不动**      y=4402 inView=false 永远够不到
```

根因是**结构差**：

```
上游  SidebarProvider  <div class="… flex min-h-svh w-full"> + 调用方 h-screen   ← 不裁
      SidebarInset     <main class="bg-background relative flex w-full flex-1 flex-col">  ← 不裁
                       {children} 直接进 main，**没有中间层**
本仓  layouts/workspace.vue
      <div class="… flex h-screen overflow-hidden">                    ← 裁 ①
        <main class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">  ← 裁 ②
          <div class="relative min-h-0 flex-1 overflow-hidden">        ← 裁 ③（上游没有这一层）
```

**修法与取舍**：把第 ③ 层改成 `overflow-y-auto`，**没有**照搬上游那套
「三层都不裁 + 侧栏 `fixed` + 占位 div」。

- 判据是**渲染与行为一致，不是源码字面一致**。这一层是内容区、侧栏在它外面，
  所以滚起来的表现与上游相同：内容与页头一起走、侧栏钉住。
  改后定点读数 **末尾控件 y 4402 → 27、inView false → true，与上游的 y=27 同号**；
  页头 `-4375`（上游 `-4376`）、侧栏 y=0 不动。
- 上游那套要把侧栏从 `md:static` 改成 `fixed` 再补一个占位 div，
  动的是 58 个取样终态里**每一个**都画着的那根柱子；
  而全应用 58 终态 ×2 字号扫下来，**上游整页可滚的只有这 2 个终态**，
  其余 56 个两边都是 0。为 2 个终态去动那根柱子不划算。
- ⚠ **残差是「滚动条挂在谁身上」**（上游 document、本仓这一层）。
  **翻案判据已写进代码注释**：哪天量到滚动条位置 / 键盘滚动 / 滚动锚定
  三者任一有用户可感的差别，就回来照上游那套改。
- `overflow-y-auto` 而不是 `overflow-auto`：横向仍然不给滚动口，
  别在 `narrow-screen-overflow` 那条门禁上开后门。

### 四、真分叉之二：会话标题**上游给省略号、本仓硬切**

```
上游  thread-title.tsx:66
      <FlipDisplay uniqueKey={threadId} className={cn("min-w-0 [&>div]:truncate", className)}>
本仓  AgentChat.vue:1778
      <FlipDisplay v-if="headerTitle" :unique-key="routeThreadId ?? ''">   ← 一个 class 都没传
```

两边 `FlipDisplay` 本体**完全同构**（`relative overflow-hidden` 外层 + 一个内层 div，
上游是 motion.div、本仓是 `.flip-display__item`，**同一个位置**），
所以长标题画成什么样全由调用方这两个类决定。读数：**12 个终态本仓 `+17~117x`、上游 0**
——上游内层 `truncate` 之后不再溢出，被尺子「有意截断」那条排除掉了。

⚠ **而 `AgentChat.vue` 那段注释把这件事写反了**：

> 「上游的裁剪来自 FlipDisplay 自己的 `relative overflow-hidden`，是直接切掉而不是
>  省略号。省略号看着更好，但……这一处并不是 React 坏了——是它选的裁剪方式。」

上游**恰恰**传了 `[&>div]:truncate`，画的就是省略号。已补类串并订正注释。

> **判词：行内注释是线索，不是证据。** 交接文档第 4 条说「动手改之前先看那份文件
> 自己怎么说的」——这一轮踩到的是它的反面：**那句话本身是错的，而且它劝退了一次
> 本该发生的修复**。第 4 条要补半句：**注释给方向，读数给判决**。

### 五、⚠ 第二笔仪器账：**`PROBE_WIDTH` 在这把尺子上是死的**

`runScenario` → `applyDimension` → `page.setViewportSize(VIEWPORTS[dimension.viewport])`
（scenarios.ts:474）**会把 context 的 viewport 覆盖掉**。

```
VIEWPORTS = { mobile: 375×812, tablet: 768×1024, desktop: 1280×800 }
```

**决定性读数不是读代码读出来的**：`zz-sched` 里把 context 显式设成 `1280×900`，
量回来的 `clientH` 是 **800**——正是 `VIEWPORTS.desktop.height`。

于是：「1280 档」对 desktop 终态**碰巧**是对的；mobile / tablet 终态**一直是按
它们自己的维度量的**；第五十一轮那一跑「375 档」**根本没跑成 375**。

**所以交接文档「375 档还没用对的尺子跑过」这条问法本身是错的**：
这把尺子没有「档」这个自变量。真正的覆盖缺口是另一件事——探针取的是
`state.dimensions?.[0] ?? scenario.dimensions?.[0] ?? DEFAULT_DIMENSION`，
**每个终态只量了它的第一个维度**。要专门量某个断点，得在 `runScenario` **之后**再设。

> **判词：「换个自变量再跑一遍」之前，先确认那个自变量真的进得去。**
> 与第五十一轮「`addInitScript` 没落地」同一形状——那次是注入没生效，
> 这次是注入生效了但**被下游覆盖**，而两次的症状都是「读数看起来很正常」。

### 六、⚠ 第三笔仪器账（这笔是我自己的）：**写盘抛异常把整跑的数据吞了**

改后那跑 reach 探针 ✘ 在 1.7m——跑满了 58 个终态，然后
`writeFileSync` 报 `ENOENT`（我传了 `PROBE_OUT_DIR=.../after` 却没建那个目录），
而它在 `console.log` **之前**，于是**一个读数都没留下**。

> **判词：探针的落盘要么放在输出之后，要么自己建目录。**
> 「第一跑红先怀疑探针」这条这次立刻用上了，只花了一次重跑。

### 六之二、收工阶段又两笔仪器账

#### 4. i18n 体检的「叶子名」启发式被一个测试字段撞上

新门禁里一个 `clip.desc` 字段，让
`scheduledTasks.recipes.{news,trending,weekly}.desc` 三个 key
从 unused 翻成 used，`make i18n-check` 当场红。
`scripts/i18n-manager.mjs` 判「被引用」用的是**叶子名**是否以属性访问出现过
（脚本注释里写明是有意为之：`const { common } = t` 那类间接访问强求全路径会误判）。

> **正确处理是改字段名（`desc` → `label`），不是 `make i18n-refresh`。**
> 刷基线等于把一次巧合记成事实，把这道门禁磨钝。判词已写进门禁文件头。

#### 5. ⚠ 归因用的 stash **漏了未跟踪文件**，于是「不是我干的」这个结论是假的

第一次定位时 `git stash push -- app/ tests/`，**没带 `--include-untracked`**，
而肇事者正是那个**新建的**（未跟踪）spec 文件——它从头到尾都在场。
于是「去掉我的改动还是红」这一步给出了**错误的**结论，
差点把它判成「HEAD 本来就红、与本轮无关」。
改用 `--include-untracked` 之后干净树**通过**，再逐项放回才定位到真正的肇事文件。

#### 4b. ⚠ **同一轮内第五次踩「守卫扫源文本前先剥注释」**

改完字段名之后我在门禁文件头写了一段注释解释这件事——**而注释里原样写出了那个
属性访问**。那把尺子**不剥注释**，于是 `make i18n-check` **第二次**报出同样三条。

> **判词：写判词的时候，不要把违规样本原样写进被扫的那份文件。**
> 拆开写（本轮写成 `d-e-s-c`）。这是本仓第五次踩这条，
> 记忆 `deerflow-guard-strip-comments` 记的就是它——
> **而这一次是「解释这个坑的那段话」自己掉进了这个坑。**

> **判词：用 stash 做归因，必须 `--include-untracked`。**
> 否则新增文件永远不在被排除的集合里，而「新增文件」恰恰是这一轮最可能的肇事者。
> 与第四十八轮「删之前问『谁在读』」同一类错误：**排除法的前提是真的排掉了。**

### 七、常驻门禁：`content-reachable.spec.ts`

**两个应用都跑**（理由同 keyboard-trap：台账按定义只报「两边不一致」，
上游单边回归没有门禁看得见）。不变量：

> 任何一个 `overflow:hidden` 的盒子里装不下的内容，都要有一条路能滚到它。

| 设计点 | 依据 |
| --- | --- |
| 判据是「裁掉**且**全链路滚不动」 | 只判「裁掉」会把上游 `StickToBottom` 那条 `+998y` 报成缺陷 |
| **两档字号都量** | 只量基线漏「放大才装不下」；只量 200% 会把「本来就装不下」说成缩放的锅——`scheduled-tasks` 两档都中 |
| 门限 24px | 噪声簇（menu-button 基线 2px / 200% 4px，两边逐字相同）与真账簇（1086/4375、50/100）之间 |
| 四条反空转断言 | 量到的终态 >0 · 整场至少找到过一个裁剪 · 跑不到位清零 · **放大后根字号必须读回 32px** |
| 豁免表 1 条 | `thread-list-pin#mobile-drawer` 50/100，**两边逐字相同**，带翻案判据 |

**变异验证**：把 `layouts/workspace.vue` 那层改回 `overflow-hidden`，
门禁当场红并报出三行、`EXIT=1`：

```
scheduled-tasks[基线]: 裁掉 1086y/0x 且滚不到 div.relative.min-h-0.flex-1
scheduled-tasks[200%]: 裁掉 4375y/31x 且滚不到 div.relative.min-h-0.flex-1
scheduled-tasks[200%]: 裁掉 0y/24x  且滚不到 input.file:…
```

还原后绿。**它不是潜在守卫。**

### 七之二、⚠ 门禁第一次进全套就**两个应用同时红**——而报出来的一条都不是对照缺陷

第一版把纵横两轴混在**一个**断言里。全套跑出来：

```
本仓 4 条 · 上游 5 条，全部是横向、全部只在 200% 那一档
  browser-feature   两边都 0y/217x（本仓在 ml-auto 层、上游在 aside 层）
  integrations ×3   两边都 0y/41x
  sidecar-chat      **只有上游** 0y/70x（本仓同处仅 13x）
```

**纵向 0 条**——也就是说这一轮真正修掉的那类缺陷已经守住了，
红的全是另一条标准条款（**1.4.10 Reflow**，不是 1.4.4）下的、而且绝大多数两边相同。

> **判词：一条门禁只该守一个不变量。**
> 把「内容竖着掉没了」和「固定宽度的盒子横着装不下」混在一个断言里，
> 结果是两个应用同时红，而**那条真正要守的东西（纵向）恰恰是绿的、被淹掉了**。
> 拆成两个断言之后：纵向**不许有豁免**，横向做成带读数的棘轮。

⚠ **没有靠「改窄判据」让它变绿**：横向那 9 条**逐条登记**在
`HORIZONTAL_KNOWN` 里并写明哪条是两边共有、哪条是上游单边，
没登记的一律红。其中 `react/sidecar-chat` 明确标成**上游单边的真账**，
**不是结清**。

⚠ 分栏格那几条（`+200~232x`）**没有**进登记表：它们有内层滚动容器，
判定为**够得到**——这正是这把尺子与 zz-zoom 的区别所在。

**拆轴当场就有正面收益**：`thread-list-pin#mobile-drawer` 纵横都中，
而它原来整个终态被纵向那条豁免盖掉了——**横向那一半（165x 基线 / 304x 放大）
从来没有显形过**。拆开之后它当场报出来，两边读数逐字相同，已补进横向表。

> **这就是那条判词的正面证据：一条门禁守两个不变量时，
> 豁免其中一个会连带把另一个也关掉，而且关得无声无息。**


## 2026-09-20 第五十一轮（**中途收工**）：文本缩放 200%——尺子找对了，**还没跑上游对照**

⚠ **这一轮没有任何产品改动，是一个进行到一半的探针轮。**
下面每一条都是**只量了本仓**的读数，**不知道是分叉还是两边共有**。
下一个窗口接着做的话，**第一件事是把同一把尺子在上游跑一遍**。

### 一、⚠ 同一个「0 条」拿到三次，三次都不算数

| 跑 | 读数 | 为什么不算 |
| --- | --- | --- |
| 1（1280） | 58 终态 **0 条** | 仪器未验 |
| 2（375，加自检） | 0 条，**`root=16px`** | **`addInitScript` 没落地**，根字号从头到尾 16px |
| 3（375，改注入方式） | 0 条，`root=32px 1rem=32px` ✅ | 注入验过了，但**尺子选错了** |

第 3 跑的变异验证直接证明尺子无效：注入一个 `40rem`（=1280px）宽的元素，
探针**照样 0 条**——这个应用是整页不滚动的 app shell，
`narrow-screen-overflow` 那把**横滚**尺子在它身上天生无效。

而且判据本身就选错了：**WCAG 1.4.4 问的是「文本放大后内容与功能丢不丢失」，
横向滚动是 1.4.10 Reflow 的事。** 200% 文本的典型症状是
**固定高度容器把文字裁掉**，不是页面能横拖。

⚠ **报了一个好看结果的坏仪器，比报错的坏仪器危险**——报错会让人去查，
好结果只会被写进文档。这一轮如果没加那行自检，
「本仓在 200% 文本下完全没问题」就落盘了。

### 二、换对的尺子（下一个窗口照抄）

**判据：同一元素、同一页面，基线字号下内容完整，放大后被裁掉且滚不到。**
用**同一跑里的基线**做对照，所以「本来就 truncate」的不会误报。

```ts
// 在 runScenario + settle 之后测一次基线，addStyleTag 放大后再测一次，比增量。
// ⚠ 放大必须用 addStyleTag，不能用 addInitScript（见上面第 2 跑）。
await page.addStyleTag({ content: `html{font-size:32px !important}` });

function clipped() {                       // 索引即身份：放大只改样式，不改结构
  const out = [];
  const all = Array.from(document.querySelectorAll("body *"));
  all.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const hidesY = cs.overflowY === "hidden" || cs.overflowY === "clip";
    const hidesX = cs.overflowX === "hidden" || cs.overflowX === "clip";
    if (!hidesY && !hidesX) return;
    if (el.clientWidth <= 1 || el.clientHeight <= 1) return;   // sr-only 那一类
    if (cs.textOverflow === "ellipsis") return;                // 有意截断
    if (cs.webkitLineClamp && cs.webkitLineClamp !== "none") return;
    const dy = hidesY ? el.scrollHeight - el.clientHeight : 0;
    const dx = hidesX ? el.scrollWidth - el.clientWidth : 0;
    if (dy <= 1 && dx <= 1) return;
    out.push({ i, dy, dx, desc: /* tag + class + innerText 前 26 字 */ "" });
  });
  return { total: all.length, out };
}
// 报「放大后比基线多裁 > 4px」的；两次 total 不等就说明 DOM 变了，索引不可比。
```

**这把尺子的变异验证过了**：给一个真实内容容器钉死 `height:40px; overflow:hidden`，
当场报出 `+760y`。

⚠ **不排除有意截断的话会淹掉**：第一版 74 处里绝大多数是 `truncate` / `line-clamp`。
**尺子报得越多越要先分类。**

### 二之二、**跑得起来的那份探针（整份照抄，别重写）**

存成 `frontend-vue/tests/e2e-parity/zz-zoom.spec.ts`，跑法：

```bash
cd frontend-vue
# 本仓；上游对照把 PROBE_APP 换成 $E2E_REACT_APP_URL（默认 http://localhost:3116）
PROBE_WIDTH=1280 node scripts/with-loopback-no-proxy.mjs -- \
  python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test \
  -c playwright.parity.config.ts zz-zoom.spec.ts
# 变异验证（必须先跑一次，确认尺子会红）：PROBE_MUTATE=1 PROBE_LIMIT=2
```

⚠ **用完即删**，并 `grep -c zz-zoom` 核验残留为 0。

<details><summary>探针全文</summary>

```ts
/* 一次性探针（用完即删）v2：文本缩放 200%（WCAG 1.4.4）——**内容会不会被裁掉**。

   ⚠ v1 用的是 narrow-screen-overflow 的横滚尺子，**变异验证当场证明它抓不到**：
   注入一个 40rem（=1280px）宽的元素，探针照样报 0 条——这个应用是整页不滚动的
   app shell，横滚那一档在它身上天生无效。而且 1.4.4 问的本来就不是横滚
   （那是 1.4.10 Reflow），是「文本放大后内容与功能丢不丢失」。

   v2 的判据：**同一元素、同一页面，基线字号下内容完整，放大后被裁掉且滚不到。**
   用同一跑里的基线做对照，所以「本来就 truncate」的不会误报。 */
import { test } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const APP = process.env.PROBE_APP ?? process.env.E2E_APP_URL ?? "http://localhost:3115";
const ROOT_PX = Number(process.env.PROBE_ROOT_PX ?? "32");
const WIDTH = Number(process.env.PROBE_WIDTH ?? "1280");
const LIMIT = Number(process.env.PROBE_LIMIT ?? "9999");

/** 每个元素的「被裁掉多少」。索引即身份：放大只改样式，不改 DOM 结构。 */
function clipped() {
  const out: { i: number; dy: number; dx: number; desc: string }[] = [];
  const all = Array.from(document.querySelectorAll("body *"));
  all.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const hidesY = cs.overflowY === "hidden" || cs.overflowY === "clip";
    const hidesX = cs.overflowX === "hidden" || cs.overflowX === "clip";
    if (!hidesY && !hidesX) return;
    /* sr-only 那一类（1px×1px + overflow:hidden）天生就在"裁"，不是缺陷。 */
    if (el.clientWidth <= 1 || el.clientHeight <= 1) return;
    /*
      **有意截断的不算**：`truncate`（text-overflow:ellipsis）与 `line-clamp-*`
      本来就是"切掉并给出省略号"，放大之后切得更多是设计如此，两边也一样。
      第一版没排除它们，74 处里绝大多数都是这一类——**尺子报的越多越要先分类**。
    */
    if (cs.textOverflow === "ellipsis") return;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== "none") return;
    const dy = hidesY ? el.scrollHeight - el.clientHeight : 0;
    const dx = hidesX ? el.scrollWidth - el.clientWidth : 0;
    if (dy <= 1 && dx <= 1) return;
    out.push({
      i,
      dy,
      dx,
      desc:
        `${el.tagName.toLowerCase()}` +
        `.${(el.className?.toString?.() ?? "").split(/\s+/).slice(0, 3).join(".").slice(0, 48)}` +
        `"${(el as HTMLElement).innerText?.trim().replace(/\s+/g, " ").slice(0, 26) ?? ""}"`,
    });
  });
  return { total: all.length, out };
}

test("probe: 文本缩放 200% 下内容会不会被裁掉", async ({ browser }) => {
  test.setTimeout(1_800_000);
  const findings: string[] = [];
  let scanned = 0;
  let selfCheck = "";
  for (const scenario of PARITY_SCENARIOS.slice(0, LIMIT))
    for (const state of scenarioStates(scenario)) {
      const key = `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`;
      const dimension =
        state.dimensions?.[0] ?? scenario.dimensions?.[0] ?? DEFAULT_DIMENSION;
      const ctx = await browser.newContext({
        ...PARITY_CONTEXT_OPTIONS,
        viewport: { width: WIDTH, height: 900 },
      });
      const page = await ctx.newPage();
      try {
        await runScenario(page, APP, scenario, dimension, state, 30_000);
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const before = await page.evaluate(clipped);
        await page.addStyleTag({
          content: `html{font-size:${ROOT_PX}px !important}`,
        });
        if (process.env.PROBE_MUTATE === "1")
          await page.evaluate(() => {
            // 变异：给一个真实的内容容器钉死高度，放大后必然裁掉文本。
            const t = document.querySelector("main, [role=main], body > div");
            if (t instanceof HTMLElement) {
              t.style.overflow = "hidden";
              t.style.height = "40px";
            }
          });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const after = await page.evaluate(clipped);
        if (!selfCheck)
          selfCheck = await page.evaluate(
            () => `root=${getComputedStyle(document.documentElement).fontSize}`,
          );
        scanned += 1;
        if (before.total !== after.total) {
          findings.push(`${key}: ⚠ DOM 数量变了 ${before.total}→${after.total}，索引不可比`);
          continue;
        }
        const was = new Map(before.out.map((o) => [o.i, o]));
        for (const o of after.out) {
          const b = was.get(o.i);
          const grewY = o.dy - (b?.dy ?? 0);
          const grewX = o.dx - (b?.dx ?? 0);
          if (grewY > 4 || grewX > 4)
            findings.push(
              `${key}: +${grewY}y +${grewX}x ${o.desc}（基线 ${b?.dy ?? 0}y/${b?.dx ?? 0}x）`,
            );
        }
      } catch (e) {
        findings.push(`${key}: 跑不到位 ${String(e).split("\n")[0]?.slice(0, 60)}`);
      } finally {
        await ctx.close();
      }
    }
  console.log(
    `\n===ZOOM2===\n${selfCheck} 视口 ${WIDTH} 扫了 ${scanned} 个终态，` +
      `新裁掉的 ${findings.length} 处：\n${findings.slice(0, 40).join("\n")}\n===END===`,
  );
});
```

</details>

### 三、本仓 1280 档的读数（**59 处，按族**）

| 族 | 处数 | 形状 | 先判 |
| --- | --- | --- | --- |
| `a.peer/menu-button.flex.w-full` | 13 | `+2y +8x`，**基线已是 `2y/9x`** | 增量很小，基线就在裁，**优先级最低** |
| `div.relative.overflow-hidden`（FlipDisplay，会话标题） | 12 | `+0y +17~117x`，基线 `2y/0x` | **大概率两边共有**：`AgentChat.vue` 的注释写过「上游的裁剪来自 FlipDisplay 自己的 `relative overflow-hidden`，是直接切掉而不是省略号」 |
| `div.splitpanes__pane.workspace-panels__main-pane` | 4 | `+0~32y +204~232x` | **最像真问题**：面板主区内容横向溢出 200+px |
| `div.focus-visible:…size-full.rounded-[in`（integrations） | 3 | `+0y +41x` | 未判 |
| `div.ml-auto.h-full.min-w-0` | 2 | `+0y +217x` / `+13x` | 未判 |
| `⚠ DOM 数量变了` | 2 | `branch-thread#turn-actions` 281→277 | **索引对照失效**，要换身份标识才量得了 |
| `div.flex.flex-col.gap-1.5` | 1 | `+50y +139x`，基线 `50y/165x` | 基线就在裁 |

### 四、下一个窗口接着做

1. **把同一把尺子在上游跑一遍**（`PROBE_APP=$E2E_REACT_APP_URL`）。
   两边一样坏 → 「两边同改」；只有本仓有 → 分叉。**现在这 59 处一条都还没定性。**
2. `splitpanes__pane` 那 4 处先看——增量最大（200+px）。
3. `DOM 数量变了` 那 2 处要换身份标识（索引不可比）：
   建议用「tag + 父链深度 + 在父下的序号」或给元素打临时 `data-zz-id`。
4. 375 档还没用**对的尺子**跑过（只用错的尺子跑过）。

### 五、判词

- **「0 条」从来不是可以直接落盘的读数**，它必须先通过「尺子会不会红」这一关。
  这一轮同一个 0 拿到三次，三次原因都不同：注入没生效 / 尺子对这个应用无效 /
  判据选错了标准条款。
- **先查清楚要量的是哪一条标准**：1.4.4（文本缩放，内容不丢失）与
  1.4.10（Reflow，不出现横滚）是两回事，尺子也是两把。
- **尺子报得越多越要先分类**：74 处里绝大多数是有意截断，
  不排除掉就会把真信号淹掉。


## 2026-09-20 第五十轮：反向遍历——**新面没掉出产品缺陷，掉出了尺子的四个洞**

名单第四十九轮走空，这一轮开的是**造出来的**第一个新面：`Shift+Tab`。
量法整套照抄第四十五轮那条已常驻的正向门禁（它的四条硬判据在反向上同样成立），
成本只是把同一条用例多跑一个方向。

### 一、收工形态

`keyboard-order.spec.ts` 从「正向一条环」变成：

| 改动 | 读数 |
| --- | --- |
| 反向遍历**常驻** | 同一条用例跑两个方向；10.5 分钟（原 4.5） |
| `PRESSES` 40 → **60** | `integrations#change-app` 的真实环长 **44**，40 一直少比 4 个 |
| 新增**窗口体检** | 每个终态的环必须在 `PRESSES` 内闭合，否则当场红 |
| 新增 `SINGLE_STOP` 名单 | **13 个「终态×方向」**，每个都是「本仓 1 / 上游 1」 |
| 新增 `UNSTABLE_RING` | `thread-list-infinite-scroll` 整体排除，附四组读数与翻案判据 |

### 二、⚠ 那条「分叉」判反了两次——**能纠回来的每一次都是新的实测**

```
thread-list-infinite-scroll[Shift+Tab]
  上游  Settings and more → 「Load older chats」 → More
  本仓  Settings and more → (body)              → More
```

| 时刻 | 判断 | 推翻它的读数 |
| --- | --- | --- |
| 首跑（全套 40） | 「真差异」 | 定点探针：两边 DOM 里那颗按钮**逐字相同**（`tabIndex 0`、可见、`223x32@16,2112`） |
| 判成「尺子的：窗口不够」 | 300 次按键 201 个落点 → 环无界 | 我自己新加的 `nowBounded` 断言报「**反向那一半闭合了**」——反向不触发翻页，环是有界的，「窗口不够」在反向上不成立 |
| 再判「真差异」 | 全套 `PRESSES=60` 报**逐字相同**的那一条，环已闭合、窗口足够 | 干净的逐步定点探针：两边第 5 步**都**落在那颗按钮上，分叉没复现 |
| 最终判「尺子的，但原因不是窗口」 | 定点两跑**不同号** | —— |

最终读数（定点，每方向新开 page）：

```
第 1 跑  vue 第5步 = Load older chats      body 落点 0 次
第 2 跑  vue 第5步 = (body)，按钮 absent   body 落点 1 次
上游同样不稳：body 落点 1 次 / 2 次
遍历途中形变：列表行数 54 → 39 → 24；按钮 y 在 2112 → 687 → 1880 → 3916 之间跳
```

**判词：环在被走的过程中就被改掉了。** 按键让焦点元素滚进视野，滚动触发翻页与
虚拟列表回收，于是这一屏在遍历途中不断重排——两个应用**都**如此。
全套两跑之所以逐字同号，是那种负载下两边的回收相位系统性不同，
**不是两边的可达性不同**：定点跑里两个应用都走到过那颗按钮，也都掉过 body。

⚠ 这是第四十五轮「**钉起点的动作要先证明它不改变被测对象**」的同一形状，
只不过这次改变被测对象的是**遍历本身**。

### 三、⚠ 四条仪器账（连同第四十九轮的三条，两轮共七条）

| # | 洞 | 怎么露出来的 |
| --- | --- | --- |
| 1 | 闭合判据用「不同落点数 < 按键数」，把**相邻重复**（连按两次焦点没动）当成走回起点 | 已知不闭合的 `thread-list-infinite-scroll` **没出现在名单里** |
| 2 | 扫描时两个方向**共用一个 page**，反向的起点被正向污染 | 同一个 `workspace-changes#changes-panel`，污染读数「bwd 3 个落点、闭合」，干净读数「1 个落点」 |
| 3 | `UNSTABLE_RING` 一度「跳过比对但仍参与体检」 | 当场收到一条**误导性的红**（「反向那一半闭合了」，看起来像可以放回比对） |
| 4 | 排除表一度只排 `[Tab]`（理由：翻页只由正向触发） | 定点跑证明反向同样会回收行、同样会掉 body |

⚠ 第 1 条最该记：**手上有一个已知答案的样本，却先读了新仪器的结论。**
第三十九轮的判词「先拿一个已知答案的样本验仪器，再去读它的结论」这一轮又欠了一次
——靠「名单里怎么没有它」才反查出来。

### 四、顺带量清的

- **58 个终态的环长**：除 `integrations#change-app`（44）与 `thread-list-infinite-scroll`
  （无界/不稳）外，其余 56 个都在 40 次内闭合。
- **13 个单落点「终态×方向」两边逐字相同**——文件头早写过「最小的 6 个各 1
  （菜单开着时 Tab 被浮层吃掉）」，这一轮把它量成了一张可断言的名单，
  并且发现 `workspace-changes#changes-panel` **只在反向**是单落点：
  按终态排除会把它正向那一半的体检也一起关掉，所以键必须带方向。

### 五、判词

- **新面的第一产出不一定是产品缺陷**，也可能是「这把尺子在某些屏上问不出那个不变量」。
  两者都值钱，但**不能互相冒充**。
- **「窗口被占满」= 一圈没走完**，不是「刚好够」。`PRESSES` 那句注释十几轮来
  把读数读反了，于是两个终态一直在比弧段而门禁一直是绿的。
- **同一个终态两次实测冲突时，分辨的依据是哪一次的起点干净**
  （第四十轮「两次实测可以互相推翻」的后半句）。
- **遍历本身可能改变被测对象**——这一类屏（无限滚动 + 虚拟列表）上，
  「两个应用走同一条环」这个不变量不成立，要排除并附读数，不要修产品。


## 2026-09-19 第四十九轮：逐 spec 的 `page.route` 前提变异——**0 条空转，三条仪器账**

名单上最后一个没打开的取样面。第四十三轮把**共享 mock** 的五条列表选项变异过了
（0 条空转），剩下的大头是**每个 spec 自己的 `page.route`**，交接文档里写的是
「它没有统一入口，所以没法一次性变异」。

### 一、绕开「没有统一入口」：**一个开关变异 27 个 spec**

几乎每个 spec 都先调 `mockLangGraphAPI(page, ...)` 再注册自己的路由。
于是在那个函数**开头**把 `page.route` / `page.context().route` 恢复成真的、
在**函数体最末尾**换成记数空操作——共享 mock 自己的 46 处注册照常生效，
此后 spec 注册的全部变成空操作。`ZZ_KILL_SPEC_ROUTES=1 make e2e` 一条命令。

收工读数：**110 failed / 187 passed（6.9m）**，压掉 342 次注册 / 84 种 pattern，
31 个用了 `page.route` 的 spec 里 **27 个如期变红**。

### 二、⚠ 三条仪器账——**三条都把结果往「有空转」的方向偏**

「新仪器第一跑的结果先假设是仪器错了」这一轮栽了三次，**而且三次是同一个方向**：
都让某个 spec 看起来「拿掉前提还全绿」。**偏向漏判的仪器比偏向误报的危险得多。**

| # | 洞 | 读数 | 修法 |
| --- | --- | --- | --- |
| 1 | 开关插在共享 mock 的**最后一条注册之前** | 候选 spec 上「压掉 3 次」压的全是 `**/api/agents/*`——共享 mock 自己那条 | 插到函数体最末尾；核验「被吞次数 = 0」 |
| 2 | 只换 `page.route`，漏了 `page.context().route` | `artifact-table-performance` 的 2 处走后者，于是它假绿；堵上后如期 **0 passed / 3 failed** | 两个入口一起换 |
| 3 | **文本序不等于执行序** | `artifacts-a11y-shape` 文本上 `mockLangGraphAPI(` 在前，**执行时**它先 `page.route(...)` 再调内含 mock 的 helper → 压掉 **0** 次 | 覆盖面必须用**运行时压制计数**核，不能用文本序 |

⚠ 第 3 条最该记住：**这条警告是我自己上一轮写进交接文档的**
（「文本序，不等于执行序——这三个要单独核」），而我只核了预判的那三个 spec，
没想到**一个 helper 就能把别的 spec 也拖进同一类**。
**判「变异覆盖到了吗」只有一个可信读数：那个 spec 的压制计数 > 0。**

### 三、三个「全绿」逐条判完：**0 条空转**

| spec | 压制计数 | 判词 |
| --- | --- | --- |
| `chat-thread-init-ordering` | **2**（两条 `/runs/stream`） | **不是空转。** 那两条路由只是给流加 250ms「拉宽竞速窗口」的**灵敏度放大器**；流本身由共享 mock 提供，而且用例自带肯定断言 `expect(runsStreamSent).toBeDefined()`。去掉只是降低灵敏度，不是让它空转 |
| `artifacts-a11y-shape` | **0** | 变异没覆盖到（洞 3）。**手工变异补上**：把那条路由整个拿掉，**12 条仍然全绿** → 见下一节 |
| `chat-dataflow` | **0** | 变异没覆盖到（整份 spec **不调共享 mock**，自己 mock 一切）。**手工变异补上**：停掉它自己那 8 处 `page.route`，**6 条用例全红** → 路由是真前提，不是空转 |

### 四、唯一一条落地的加固：**观测器型路由要配一条肯定断言**

`artifacts-a11y-shape` 那条路由的用途是**计数**（`contentRequests`），
配的断言是 `expect(contentRequests).toBe(0)`——「没选中文件就不该去拉内容」。
把观测器整个拿掉之后 `contentRequests` 恒为 0，**这条缺席断言恒真，12 条全绿**。

也就是说：哪天产物内容换了端点、或者这条 pattern 不再匹配，
「没选中不拉内容」这条守卫会**静默失效，而且是绿的**。

补一条肯定断言配对：选中文件之后 `contentRequests` 必须 > 0（`expect.poll`，
点击到发出请求之间隔着一次更新与 fetch 排队）。
**变异验证**：拿掉观测器 → 新断言当场红；还原 → 12 passed。

⚠ 这不是「空转」那一类（路由本来就不是前提），而是
**「缺席断言 + 观测器」这个组合天生需要一条肯定断言来证明观测器还接着**。
第四十二轮判过「用静态扫描找无肯定断言的缺席断言」是死路（230 条候选、仪器坏了）；
这一轮说明**用变异找它是可行的**——拿掉它依赖的东西，看它红不红。

### 五、判词

- **「没有统一入口」常常只是还没找到那个入口。** 31 个 spec 看起来要逐个来，
  实际上它们共享一个必经之地（`mockLangGraphAPI`），在那里装开关就够了。
- **但「装在必经之地」不等于「覆盖到了」**：谁在它之前注册、谁根本不路过，
  都逃得掉。**覆盖面要用运行时读数核，逐 spec 看压制计数。**
- **这条轴的结论与第四十三轮一致：0 条空转。** 两条轴加起来，
  「夹具驱动的断言其实在空转」这个假设**在本仓不成立**，可以收了。
- **开了新面、0 条产品缺陷**——按收工判据，这是「连续 3 轮」里的第 1 轮。


## 2026-09-19 第四十八轮：那条反复判成「复量消失」的 `threads/search` **查到根因了**

这个签名从 wave 214 一路判到第四十七轮，判词一直是「复量消失」「时序」「偶发」——
**全是「还没找到根因」的代称**。这一轮把它变成了一个**按开关复现**的东西。

### 一、先把「是谁多发」定下来：**不是上游少发，是本仓多发**

第四十七轮的交接文档写的是「两行 `requestsOnlyVue`」，但没说清是哪一侧不对。
扒 CI 那次红的**原始日志**（`gh api .../runs/35432167446/attempts/1/logs`）看到关键一行：

```
      "requestBodies": Array [],          ← 这一档**没变**
-     "requestsOnlyVue": Array [],
+     "requestsOnlyVue": Array [
+       "POST /api/threads/search",
```

`diffRequestBodies` 按「不同的体的集合」比，`diffMultiset` 按**多重集**比。
体那一档没动、请求那一档多一行，只有一种解释：**本仓发了两次，体逐字相同**。
（同一形状第二十九轮记过一次，方向相反：`thread-list-pin#mobile-drawer` 上
上游发两次、本仓一次。）

### 二、五步读数（**前三步全是否定**，第四步才把它钉住，第五步给机理）

| # | 实验 | 读数 | 排除了什么 |
| --- | --- | --- | --- |
| 1 | 本机原速，两个应用各 5 跑 × 2 个场景 | **20/20 都是 1 次**，落在 200–576ms，取样窗 1.6–3.4s | 本机不复现，与交接文档一致 |
| 2 | CDP `Emulation.setCPUThrottlingRate` ×4 / ×8 | **32/32 仍是 1 次**；请求时刻 290→1073→2252ms，窗口同比例变长，余量始终 ~3s | **不是「CI 机器慢」**——CPU 降速会把触发和窗口一起拉长，比值不变 |
| 3 | 推算「上游会不会发得太晚掉出窗口」 | 上游的请求恒在 settle 锚点**之前**（锚点要等水合＋数据＋渲染，请求只要水合） | 「React 发晚了」结构上不可能 |
| 4 | **把 `/api/threads/search` 的响应推迟 D 毫秒**（`addInitScript` 包 `fetch`） | **D=0 → Vue 4/4 发 1 次；D=300/900/2000 → Vue 12/12 发 2 次**；上游四档 **16/16 全是 1 次** | **稳定复现，且是本仓单边** |
| 5 | 拿 `@tanstack/query-core@5.90.20` 在 Node 里搭同样时序 | 在飞时**只失效** → queryFn **1** 次；**先 `setQueryData` 再失效** → **2** 次 | 机理与应用无关，是库的语义 |

两次请求的体逐字相同，都是 `{"archived":false,"limit":50,"offset":0}`，
调用栈都落在 `Query.fetch → infiniteQueryBehavior → useThreads 的 queryFn`
（**不是 `fetchNextPage`**）。

### 三、根因：**空缓存上那次多余的 `invalidateQueries`**

```js
// useThreads.upsert()
const existing = threads.value.find(...);   // ← 判的是「在不在我当前这份列表里」
if (existing) { merge; return; }
if (!queryClient.getQueryData(queryKey.value)) {                 // 列表还没数据
  queryClient.setQueryData(queryKey.value, { pages: [[thread]], pageParams: [0] });
}
upsertThreadInInfiniteCache(queryClient, thread);   // 末尾 invalidateQueries ← 有害的是它
```

链条：

1. `AgentChat.vue` 有一条 `watch(() => threadMetadata.data.value, … threads.upsert(metadata),
   {immediate:true})`。它与侧栏列表首取是**两条并行请求**，谁先回来是赛跑。
2. 这条 `else` 支真正的含义是「**这条线程不在我当前这份列表里**」——列表首取还在飞时
   `threads.value` 是空的，于是**每一条既有线程都走到这里**。
   （`infinite.ts` 当时的注释写的是「走到这个函数的只有刚建出来的 thread」，
   **那句话是错的**，本轮已订正。）
3. 对空缓存来说，`upsertThreadInInfiniteCache` 的插入部分本来就是空操作
   （`infinite.test.ts` 第一条用例钉着），**唯一实际发生的是它末尾那次
   `invalidateQueries`**。而放进缓存那一步让查询变成「idle 且有数据」，
   于是这次失效不再与在飞的首取合并，**另发一次体逐字相同的请求**。
4. 本机列表几乎总是先回（走 `existing` 支，早早 return）→ 0 行；
   CI 整套 205 条 50.9 分钟（本机同一套约 34 分钟），偶尔相位一换就露出来。

### 四、修法：**去掉那次失效，而不是去掉放进缓存那一步**

第一版我把「放进缓存」那 5 行整个删了——**理由看起来很硬**：
`git log -S "pages: [[thread]]"` 只有一条命中，来自 `eaf9d6a7`，
正是把列表写成 `enabled: false` 手动查询的那次提交；那时没有任何人会去填这个 key，
不播就永远看不见，2026-09-11 查询改成自己会跑之后它「显然多余」。
**而且上游从来不播**（`hooks.ts:1272` 的 `if (!oldData) return oldData`），
上游那一侧连触发点都没有（`chat-page.tsx:191` 的 `useThreadMetadata` 结果只被读去渲染）。

**这个判断是错的，见下一节。** 正确的修法是精确到那一次失效：

```js
if (!queryClient.getQueryData(queryKey.value)) {
  queryClient.setQueryData(queryKey.value, { pages: [[thread]], pageParams: [0] });
  return;                                   // ← 不再往下走到 invalidateQueries
}
upsertThreadInInfiniteCache(queryClient, thread);
```

query-core 5.90 把四种组合逐个量过，这张表是判据：

```
                              queryFn 次数   最终缓存
只 seed、不失效（桌面）            1          服务端那份（seed 被首取覆盖）
seed + 失效（此前的写法）          2          服务端那份   ← 多出来的那一次
只 seed、不失效（窄屏 disabled）    0          seed
seed + 失效（窄屏 disabled）        0          seed         ← 失效在这里根本不重取
```

**两行读数一起看，结论是唯一的**：那次失效在这条支上要么无效（窄屏没有 enabled 的
观察者，`invalidateQueries` 默认只重取 active 查询），要么有害（桌面首取在飞时多发一次）。
**它没有任何一种情况是有用的。**

### 四之二、⚠ **「它在守什么」我问了，但问的是「谁在写」**

删掉那 5 行之后 `verify` 0、`make e2e` 296 全绿、针对性探针 32/32 全对。
**整套 `e2e-parity` 红了一行**：

```
subtask-card/mobile/light/en-US · ariaOnlyReact: ['- text: Stopped subtask']
```

`Stopped subtask` 是那条夹具线程的**标题**——**窄屏下本仓的会话页顶栏没标题了**。
接着单跑 `ui-polish-mobile.spec.ts`，既有那条 artifacts 抽屉用例也红了
（`artifact-trigger` 等不到）。

根因是同一个：`AgentChat` 有**四处**把 `threads.threads.find(...)` 当作
「当前线程的服务端快照」在读——`headerTitle`、`authoritativeArtifacts`、
`authoritativeGoal`、`authoritativeTodos`。而窄屏的侧栏是抽屉，关着时
`RecentChatList` 整棵不挂载、列表查询**根本不跑**（第三十四轮两边同改的结果），
那份缓存唯一的填充点就是这 5 行。

交接文档第 8 条写着「本仓比上游多出来的东西，删之前问『它在守什么』」。
这一轮我**问了**——`git log -S` 查来历、查 `upsertThreadInInfiniteCache` 的单测、
查 `upsert` 的全部调用方——**全是「谁在写这份缓存」，一条都没问「谁在读」**。
扛事的那四处是**读**方，隔着一个组件、四个 computed。

**正确的问法**：删掉一处写缓存的代码之前，`grep` 那份缓存的**读取点**，
逐个问「它在那条写入不存在时还拿得到东西吗」。

**而且三道读数全绿也没拦住它**：`verify` 0、`make e2e` 296 全绿、
针对性探针 32/32 全对——抓到它的是整套 189 个取样点里的**一个 mobile 维**。
**取样面的价值不在于它今天报了什么，在于它替你记住了你没想到要看的地方。**

⚠ **更彻底的方向没做，判据留在代码里**：上游那四处根本不读列表缓存
（标题走 `canonicalTitle={threadMetadata.data?.values?.title}`，其余走 stream 的
thread state）。把 `AgentChat` 那四处逐一换过去，这 5 行就可以整个去掉。
**翻案判据**：哪天要动 `AgentChat` 的服务端快照读取，连同四处一起换，
并用 `subtask-card/mobile` 与 `ui-polish-mobile` 两处验收。
**这一轮不做**，因为它是四处联动的重构，而本轮的账只要求去掉那次失效。


### 五、两条门禁（都做了变异验证）

| 门禁 | 守什么 | 变异验证 |
| --- | --- | --- |
| `use-threads.dom.test.ts`「列表首取在飞时 upsert 只落缓存，不再发一次搜索」 | 空缓存那一支不许再走到 `invalidateQueries` | 去掉那行 `return` → 当场红，`expected 1 times, but got 2 times`；还原绿 |
| `ui-polish-mobile.spec.ts`「窄屏顶栏在列表缓存没取过时仍显示标题」 | 放进缓存那一步不许被删 | 删掉那 5 行 → 当场红；还原绿 |

两条**互为反向**：一条守「别多做」，一条守「别少做」。
这一轮之所以需要两条，是因为第一版修法正好从「多做」滑到了「少做」——
**单向的门禁挡不住过度修复。**

⚠ 单测那条的前提是「首取必须停在半空」：用 `mockResolvedValue` 首取当场就回来、
命中 `existing` 支，**它会在修好之前就绿**。
⚠ e2e 那条**必须跑在 375**：桌面下侧栏展开、列表查询会跑，
**它在 1280 上永远绿**；并且带一条反空转断言（抽屉必须关着）。

### 六、顺带查出第二笔账：**`PARITY_ONLY` 的 CI 产物一直是空的**

交接文档第四十七轮写着「定点复量：**读产物**，结论在 artifact `parity-failures` 的
`e2e-parity/report.json` 里」。本轮照着跑了一次（run 35441283188，绿），
**产物列表是空的**——`gh run download` 报 `no valid artifacts found`。

根因：`diff.spec.ts` 在 `if (ONLY) { console.log(...); return; }` 里**提前 return**，
`writeFileSync(REPORT, ...)` 在那之后，所以 ONLY 模式**不落盘**；
而 workflow 那一步的 `if: failure() || inputs.parity_only != ''` 配着一整段注释写明
「PARITY_ONLY 这次跑**唯一的产物**就是这份 report」——**两处对不上**，
`if-no-files-found: ignore` 让它十几轮来静默上传了个空。

这正是本仓反复警告的那个形状：**「拿不到东西」和「量过、没问题」长得一模一样。**
本轮把 report 的落盘挪到 ONLY 分支之前，并把 ONLY 模式下才收的
`rawRequests` / `rawTabbables` 一起写进产物——那两份才是查「谁多发一次」要看的东西。

### 七、判词

- **「偶发」不是判词，是还没找到根因的代称**（第四十七轮写下这句，这一轮兑现了它）。
  这个签名被判过至少四次「复量消失」，每次都只是没找到那个开关。
- **找不到复现，就去找能把相位掰过来的旋钮。** CPU 降速不行，因为它把触发和窗口
  一起拉长；**推迟某一条响应**才是有效的旋钮——它单独移动一条并行请求的相位，
  而竞态恰恰住在两条并行请求的相对顺序里。
- **多重集差与集合差要分清。** `requestsOnly*` 是多重集（「多发一次」看得见），
  `requestBodies` 是集合（「体一样的两次」看不见）。这两档放在一起读，
  一眼就能把「谁多发」和「谁发了不一样的东西」分开——本轮的方向就是这么定下来的。
- **一行代码在它被写下的那一版里可能是对的。** 判「该不该删」不能只问「上游有没有」，
  要问「它当时守的那个前提还在不在」。
- **注释写错的杀伤力比代码大**：`infinite.ts` 那句「走到这个函数的只有刚建出来的
  thread」让人以为这一支只处理新建线程。**订正注释和改代码是同一笔修复。**
- ⚠ **「它在守什么」要问「谁在读」，不是「谁在写」。** 这一轮我问了，
  但查的全是写方（git 来历 / 单测 / 调用方），扛事的四处是读方。
- ⚠ **单向的门禁挡不住过度修复。** 第一版修法从「多做」滑到了「少做」，
  而当时手上那条门禁只守「别多做」。最后留了互为反向的两条。
- ⚠ **三道读数全绿不等于没回归。** `verify` 0、`make e2e` 296 全绿、
  针对性探针 32/32 全对，抓到它的是整套 189 个取样点里的一个 mobile 维。
  **取样面的价值不在于它今天报了什么，在于它替你记住了你没想到要看的地方。**

## 2026-09-19 第四十七轮：tablet 轴铺到 14 个场景——**15 个新样本全干净**，外加一条查清的飘

第四十六轮把 tablet 从 1 个场景铺到 4 个、当场掉出一条真分叉。这一轮把剩下的铺开。

### 一、先筛后铺（省掉一次 12 分钟的空跑）

第四十六轮吃过一次亏：`artifact-table-preview` 的 settle 锚点在 768 上不可见，
是在**对照跑里**才发现的。这一轮改成**先全量筛一遍**——把「只有 desktop 的
24 个场景族」逐个在 768 上跑 `runScenario`，只问「settle 得了吗」：

```
两边都能 settle   28 / 32 个终态
settle 不了的 4 个，而且两边都不行：
  artifact-stream-state · artifact-batched-stream(#preview-failed) · artifact-table-preview
```

**那 4 个与第四十六轮 `artifact-table-preview` 的判词同因**（锚点在 768 上两边都不可见），
不是对照缺陷。**判据：铺维度之前先花 5 分钟筛 settle**，比在对照跑里撞出来便宜得多。

### 二、按「彼此不重叠」挑的十个

artifact 面板（`artifact-panel-resize`）与弹出窗（`artifact-viewer-window`）、
消息悬停工具条（`branch-thread`）、mermaid 工具条（`thread-history-mermaid`）、
标签页 + 归档行（`thread-archive`）、会话列表行（`thread-list-infinite-scroll`）、
折叠态侧栏（`sidebar-collapsed`）、卡片网格（`agents-feature-disabled`）、
抽屉（`background-tasks`）、浏览器面板（`browser-feature`）。

**读数：15 个新场景-维度，全部 0 行。** tablet 样本 13 → 28，场景族 4 → 14。

### 三、那条 `GET /api/skills` 查清了：上游侧偶发，不是差异

它在第四十六轮（`thread-history/tablet`）和这一轮（`thread-list-infinite-scroll/tablet`）
**同签名出现两次**，所以不能再当噪音放过。量时刻：

| 场景 / 宽度 / 应用 | 三跑的发出时刻（ms，相对 goto） | settle |
| --- | --- | --- |
| `thread-history` desktop react | 332 · 300 · 325 | ~930 |
| `thread-history` desktop vue | 280 · 287 · 290 | ~970 |
| `thread-history` tablet react | 440 · 302 · 322 | ~950 |
| `thread-history` tablet vue | 266 · 251 · 279 | ~975 |
| `thread-list-infinite-scroll` **两个应用 × 两个宽度** | **全空** | — |

两条结论：

1. `thread-history` 上**两边每跑必发、且都远早于 settle**——第四十六轮那一行是噪音；
2. `thread-list-infinite-scroll` 上**两边六跑一次都没发**，而对照跑里上游发过一次。
   合计：**2 次完整 diff 里出现 1 次、6 次定点探针里出现 0 次**。

⚠ **上面这段判词当场被推翻了，经过留着**——它是本轮最该记住的一条。

写完「记成已知的飘、别再查」之后，全套对照跑又红了一次，而且这次落在
**`user-message-plain-text/desktop/light/en-US`**——一个**桌面**的老键，
和 tablet 毫无关系。也就是说：**我把「它总在 tablet 上出现」当成了线索，
而那只是我恰好在 tablet 上看见它的两次。**

定位靠的是把 jest 的 `@@ -2511` 行号换算回键名（每条 14 行，pretty-format 按键排序），
比再跑一遍便宜。

### 真根因：上游把技能目录取了**两遍**

`user-message-plain-text` 正是第四十四轮我加了一条 `/data-analysis …` 消息的那一屏——
于是 composer 与 `HumanSlashSkillText` **同时观察 `["skills"]` 这个查询**。
逐跑量（各五跑，desktop）：

```
vue    [1, 1, 1, 1, 1]              （192–283ms）
react  [1, 2, 2, 1, 1]              （第二次在 274ms 之后的 323ms）
```

两边都画出了胶囊，**功能没问题**；差的是上游那第二个观察者在第一次取**已经取回来之后**
才挂载，而 `staleTime` 默认是 0，于是触发一次后台重取。本仓的两个观察者在同一拍挂载，
被去重吃掉。**这是「底层不同构」，但它有一个可观察后果：多一次网络请求。**

### 修法：**两边同改**，给这个查询一个新鲜窗

目录只通过 mutation 变，而两边的 mutation 都会 `invalidateQueries(["skills"])`
——所以 `staleTime` 挡不住真更新，它挡的正是「第二个观察者重取第一个刚取回来的东西」。

`frontend/src/core/skills/hooks.ts` 与 `frontend-vue/app/composables/useSkillsCatalog.ts`
各加 `staleTime: 5 * 60 * 1000`。收工读数：**两边 5/5 都是一次**，胶囊照常渲染。

### 判词（本轮最该记住的）

- **「偶发」不是判词，是还没找到根因的代称。** 我写下「记成已知的飘」之后，
  它当场又出现了一次——而且证明我连它落在哪一屏都判错了。
- **一个飘出现在哪些键上，取决于我在哪些键上看过它**，不是它的分布。
  两次都在 tablet，只是因为那两轮我只在看 tablet 的新键。
- **这条重复除了对照台账的 requests 档，没有任何门禁看得见**——它不改渲染、
  不改可访问性树、不改几何，`make e2e` 与 `verify` 全绿。

### 七、收工时 CI 又红了一次——**同一类、同一条判据，留给下一轮**

第四十七轮推上去之后，CI 的 parity **第一次跑红**，两行、都在 desktop 老键上：

```
artifact-table-preview/desktop/light/en-US          requestsOnlyVue: POST /api/threads/search
workspace-changes#changes-panel/desktop/dark/en-US  requestsOnlyVue: POST /api/threads/search
```

本机 3 次完整跑 0 行，CI 重跑（attempt 2）**绿**。计数：**CI 2 跑里 1 次**。

⚠ **按本轮自己刚写下的判据，这不构成判词**：「重跑绿了」和「偶发」一样，
只是还没找到根因。这个签名历轮判过多次（本文件搜 `threads/search`，
第 201 行那条的判词就是「复量消失」）——**那些判词同样没有给出根因**。

**留给下一轮，方法写死在交接文档第 1 条**：量时刻，两个应用各五跑，
分出「谁多发一次」与「谁发得晚、掉出取样窗」。
本轮 `/api/skills` 正是这么查成的。

**「台账 0，macOS 与 Linux 同时」这一条因此退回待确认**，等根因查清再打勾。

### 四、判词

- **铺取样维度之前先筛 settle。** 5 分钟的筛换掉一次 12 分钟的对照跑，
  而且筛出来的「两边都到不了」本身就是一条读数。
- **同一个签名出现两次就不能再当噪音**，但**「不是噪音」和「是差异」之间还有一层**：
  这一条查完是「偶发」，既不是稳定差异、也不是纯随机——它有一个具体的触发路径。
- **这一轮 15 个样本 0 缺陷是有信息量的 0**：它们是十个此前完全没有非 desktop
  样本的场景族，第一次被量。与「不开新面的 0」不是一回事。


## 2026-09-19 第四十六轮：重名扫完（**0 条对照缺陷**）+ tablet 轴开面

### 一、先拦下一次重复劳动

交接文档的名单把「**重复的可访问名** / 焦点陷阱」并列成没打开的面。动手前按
记忆 `deerflow-parity-three-docs` 搜了三份文档，**「缺可访问名」第三十八轮已经
整档扫过并判死**（第十四节：真分叉 0 条，两边都缺的逐条有判词，明写
「这一档不值得做成常驻门禁」）。**没扫过的只有「重名」那一半。**

⚠ 而「重名」有一个先验结论要先说出来：**台账的 aria 档是 0 行**，也就是两个应用的
`role + name` 树**已经逐字相同**——所以「重名的对照差异」**天然是 0**，
这个面上唯一有信息量的是**单应用**形态（两边一样坏，台账按定义看不见那种）。

### 二、量法与读数

`page.locator("body").ariaSnapshot()` 逐终态取一份，解析成树，
找**同一个父节点下同角色同名字的兄弟控件**。

⚠ **第一版的父节点判定是错的**（本轮的仪器账）：拿「祖先标签串」当父路径，
于是所有 `listitem` 被并成同一个桶，读数看起来像一堆重名。
**父节点必须用唯一 id（行号）**，不能用标签串。改对之后：

```
58 个终态全部取到　有同名兄弟的终态 33 个　重名种类 13
```

| ×N | role / name | 例 |
| --- | --- | --- |
| ×2（26 个终态） | `button "Toggle Sidebar"` | 根节点下两颗 |
| ×2…×18 | `button "Copy to clipboard"` | 每条消息一颗 |
| ×2…×9 | `button "Branch conversation"` | 每条消息一颗 |
| ×50 | `button "Restore chat"` | 归档列表每行一颗 |
| ×6 / ×4 | `button "Modify"` / `"Connect"` | 渠道设置每行一颗 |
| ×2 | `textbox "Time"` | **新建表单与编辑表单同屏并存** |

### 三、逐条判完：**0 条对照缺陷**，1 条两边共有的记账

- **每行一颗那一类（Copy / Branch / Restore / Modify / Connect）不是缺陷**：
  它们分属不同的行，上下文由周围结构给。⚠ 这里有一条量法的限制要写下来：
  **`ariaSnapshot` 会丢掉没有语义角色的容器**，所以消息动作键在快照里全是
  `main` 的直接兄弟——**这把尺子分不出「不同行里的同名键」和「同一格里的同名键」**。
  想把「重名」做成门禁，得换一把能看见 DOM 容器的尺子。
- **`button "Toggle Sidebar"` ×2** 是 shadcn 的默认形状（`SidebarTrigger` + `SidebarRail`
  都叫这个名字），**上游一模一样**。
- **`textbox "Time"` ×2 是真的、但两边共有**：`ScheduleInput` 是新建与编辑**共用**的
  组件，`aria-label={labels.fields.time}` 写死在里面
  （`scheduled-task-schedule-input.tsx:260`），两个实例同屏就必然同名；
  而这一屏上**两张表单都没有可访问名**（快照里它们的父节点就是 `main""`，
  连 `form` 地标都没有）。同屏的 `Task title` / `Edit title` 是分开写的 JSX
  所以恰好不撞，`Time` 撞了。

  **本轮判定：记账不改。** ①它**不是对照缺陷**（两边逐字相同，台账 0）；
  ②业界做法不是给每个字段编一套「Edit 前缀」文案，而是**给两张表单各一个
  可访问名的地标**，那是产品结构决定、要在两个应用各改一处并新增两条文案；
  ③本轮预算更该花在 tablet 那条真正空着的取样轴上。
  **翻案判据**：哪天给这两张表单加了地标名，或者上游先改了，回来一起做。

### 四、判词

- **「名单上还没打开的面」不等于「没量过」**——这一条第 7 次成立。
  扫三份文档花两分钟，重开一笔判过的账要花一轮。
- **尺子的分辨率决定了不变量能不能表达**：`ariaSnapshot` 丢掉无角色容器，
  于是「同一格里的两颗同名键」这条不变量**在这把尺子上根本说不出来**。
  不是没找到，是**问不出来**——这两种 0 要分开写。

### 五、tablet 轴开面：**一开就掉出一条真分叉**

开工时 165 个场景-维度里**只有 `chat` 一个场景有 tablet**（它跑满 12 维矩阵），
是取样面上最薄的一条轴。768 不是「中间那档宽度」，**它是 `md` 这条边界本身**
（`useIsMobile` 的门限就是 768，桌面侧栏在它以下卸载），而历轮两条真账恰好都长在
宽度带上（第三十九轮的栅格、第四十轮的 800→700 重挂）。

挂到 4 个彼此不重叠的场景上：`sidecar-chat`（分栏，最吃宽度）、
`workspace-changes`（正在那条重挂带里）、`channels`（设置栅格恰好在 `md` 这一格）、
`thread-history`（markdown 面的中间宽度换行）。

第一跑掉出 **3 行台账**，逐条查完是 **1 真 1 假**：

| 行 | 判定 |
| --- | --- |
| `sidecar-chat/tablet` 两条 `geometry y Δ-7` | **真分叉**，见下 |
| `thread-history/tablet` 的 `requestsOnlyReact: GET /api/skills` | **取样窗时序**：两边各连取三次都是 `[1,1,1]` |

⚠ `artifact-table-preview` 原本也在名单里，**量完撤掉了**：它的 settle 锚点
`rows.csv` 在 768 上**两个应用都不可见**，几何逐字同号（各两份、`32×160` 与 `0×160`）
——两边共有的窄布局产物，不是对照缺陷。判词写在那个场景自己的注释里。

### 六、这条真分叉：sidecar 的正文行在 768 上高 14px

逐层量下来，14px 全在正文那一行：

```
768   页脚块  V 204×208   R 204×194
      正文行  V div[input-group-body] 170×78（textarea 146×48）
              R textarea 170×64（**没有包装盒**）
1280  页脚块  V 204×194   R 204×194        ← 桌面下看不出来
```

**根因是两件事叠在一起，而它们在桌面下恰好抵消**：

1. **结构**：上游的 `PromptInputBody` 是 **`display: contents`**
   （`ai-elements/prompt-input.tsx:879`）——sidecar 那一层**根本不产生盒子**，
   内边距与 `min-h-16` 都在 textarea 自己身上（`InputGroupTextarea` 的 `py-3`
   ＋ `Textarea` 基类的 `px-3`）。本仓 `ComposerSurface` 的 body CSS
   （`min-height:4rem; padding:.75rem`）逐字对着的是**主输入框**那一层
   （`input-box.tsx:2346` 的 `min-h-16 w-full min-w-0 px-3 py-3`），
   两个 composer 共用了它，于是 sidecar 多出一层 30px 的盒子。
2. **类串**：本仓 sidecar 的 textarea 抄的是**主输入框**那套
   （`max-h-48 min-h-6! leading-6!`），而上游 sidecar 是**刻意覆盖**成
   `max-h-36 min-h-16 text-sm`（下限 64、上限 144，**不写 leading**）。

桌面下 `min-h-6!` 算出 36px，加那 30px 正好凑成 66 ≈ 上游的 64——**抵消**。
768 上抵消不掉，于是露出 14px，而空态是垂直居中的，两行字整体上移 7px。

#### ⚠ 一次把事情改坏的实测（判据）

先只改类串（`min-h-6!` → `min-h-16`），**两个宽度一起变坏**：
页脚块 V 224 / R 194。因为那 30px 的盒子还在，textarea 一长高就直接加上去。
**「先改一个变量再量」这一步不能省**——它把「两件事叠加」和「一件事」分开了。

#### 修法与收工读数

给 `ComposerSurface` 加 `variant: "main" | "sidecar"`，sidecar 档把 body 槽设成
`display: contents`（**不是只去掉 padding**：那样 textarea 仍是那层的孩子、
与上游「直接是 InputGroup 的 flex 孩子」不同构），textarea 换成
`max-h-36 min-h-16 px-3 py-3 text-sm`（去掉 `leading-6!`——那是主输入框才有的，
`input-box.tsx:2394`；留着它会让占位文案在 768 上折成 2×24 而不是 2×20）。

```
768   页脚块 204×194  textarea 170×64   两边同号
1280  页脚块 409×194  textarea 375×64   两边同号
空状态首行 y  Vue 413 = React 413（原来 406 / 413）
```

**判词**：这一条是「**两个 composer 在上游本来就不同构**，而本仓把它们做成了同一层」。
台账此前看不见，是因为唯一采到它的宽度（desktop）上两个错误互相抵消——
**「零差异」也可能是两个非零加起来等于零**。


## 2026-09-19 第四十五轮：把键盘面走完——**0 条产品缺陷，但那三条挂账是用读数结清的**

第四十四轮开了「Tab 落点」这个面，只做了「会不会被吸住」那一半，
留下 3 条「只在上游有的落点」当挂账。这一轮把另一半做完：**逐位比序列**。

**结论：3 条挂账全是仪器造成的**，两个应用的键盘遍历**逐位完全相同**。
这不是「没去看」的 0，是**量到了 58 个终态 × 40 次按键、每一位都对上**的 0。

### 一、五跑换来的量法（这一节就是那条门禁的全部）

| 跑 | 改了什么 | 跨应用差异 | 判词 |
| --- | --- | --- | --- |
| 1 | focusin 流水 + `aria-label ?? textContent` | **28 条** | 一片红，先怀疑探针 |
| 2 | 名字换成 `aria-label ?? placeholder ?? innerText` | **5 条** | 23 条是描述符的账 |
| 3 | 改读**按完之后停住**的 `activeElement` | **0 条** | 那 5 条是 roving-focus 容器的中转 |
| 4 | 同一棵树再跑一遍 | **1 条** | `branch-thread#turn-actions`：**同一个环整体差 15 位** |
| 5 | 用 `blur()` 钉起点 | **4 条**（同应用两跑还多出 2 条不稳） | **更坏，撤掉** |

最终量法：**停住的 `activeElement`** + **比相邻关系而不是逐位**。
四次对照（跨应用两跑 + 同应用两跑）下**转移集合差异全是 0**。

#### ① 名字不能用 `textContent`（第 1→2 跑，砍掉 23 条）

三条成因各不相同，都得实测才看得见：

- **表单控件的 `textContent` 是它的默认值**。上游的 textarea 靠 `placeholder`
  取可访问名，本仓写 `aria-label`——**同一个名字、两种写法**，
  于是 `textContent` 一个有一个没有。**可访问名相同，台账因此是 0。**
- **Radix 的 ScrollArea 往容器里塞 `<style>`**，`textContent` 会把那段 CSS
  也算进名字。读数里那串 `div(tabpanel)"[data-radix-scroll-area-viewpo…"`
  就是它——看着像个天大的差异，其实是一段样式表。
- **`textContent` 不含渲染折叠**。模板里的换行空白在 Vue 编译产物里是真空格，
  JSX 里不是：`🔥 GitHub Trending daily` vs `🔥GitHub Trending daily`、
  `Surprise Write Research` vs `SurpriseWriteResearch`。
  **`innerText` 反映的是用户看到的那一串**，换过去就全对上了。

#### ② roving-focus 的容器中转不是落点（第 2→3 跑，砍掉最后 5 条）

Radix 与 reka **都**给 roving-focus 的 group 挂 `tabindex=0`
（`reka-ui/dist/RovingFocus/RovingFocusGroup.js:113`），焦点会先落到容器、
再立刻转给当前条目。那一下在 focusin 流水里是一条记录，**而用户从来没停在那儿**。

决定性读数：**`integrations#skills` 上游 43 条事件 / 40 次按键**——
事件比按键还多，只能是中转。改读停住的 `activeElement` 之后：

```
integrations#skills                      事件 V=40 R=43   停住序列相同 ✅
artifact-preview / artifact-panel-resize 事件 V=14 R=15   停住序列相同 ✅
artifact-batched-stream(#preview-failed) 事件 V=38 R=40   停住序列相同 ✅
```

**第四十四轮那三条挂账（`div(tablist)"Agent Skills"` 与四处 `div(group)""`）
就此结清，判词是「不是落点」。**

#### ③ 起点会漂，所以比相邻关系（第 4 跑）

`branch-thread#turn-actions` 在**上游自己两跑之间**同一个环整体差 15 位：
settle 之后焦点停在哪取决于最后一步交互，而那一步在上游不稳定。
**逐位比会在这一条上间歇性地红，而两边走的明明是同一条环。**

#### ④ ⚠ 不要用 `blur()` 去钉起点（第 5 跑，负结果）

想法是「把焦点清回 body，两边就从同一处起步」。实测**当场更坏**：

```
跨应用差异 0 → 4      同应用两跑不稳 0 → 2
```

菜单开着时 `blur()` 会扰动浮层自己的焦点管理（Radix 与 reka 的恢复策略不同），
**而那正是要量的东西**。判据：**钉起点的手段不能碰被测对象**。

### 二、新常驻门禁：`tests/e2e-parity/keyboard-order.spec.ts`

不变量：**两个应用按 Tab 走的是同一条环**（落点的相邻关系集合相同）。

- 跑时 **4.5 分钟**，一条用例同时驱动两个应用；
- 三条反空转断言：整条序列全是 `(body)` 的终态必须为 0、跑不到位的必须为 0、
  全套「不同非 body 落点」合计不得低于 600（签入时 **925**）；
- `(body)` 是合法落点并参与比对——两边**从同一个落点**离开文档本身就是判据；
- **变异验证**：给 `SlashSkillChip` 的移除键加 `tabindex="-1"`，门禁当场红，
  报的是

  ```
  sidebar / sidebar#slash-selected:
    只在上游 ["button\"Settings and more\" → button\"Remove /data-analysis\"", …]
  ```

  还原后 `1 passed (4.5m)`。**顺带证明了 `sidebar` 那条默认终态也覆盖着这颗键**
  （Tab 在两个应用里都会接受当前建议，见第四十四轮的判词）。

### 三、这一轮的判据

- **「没找到缺陷」分两种，只有一种算数**：不开新面的 0 是没去看；
  这一轮的 0 是 58 × 40 = 2320 个位置逐位对上的 0。
- **同一条读数换一个投影就会从 28 条变成 0 条**。28、5、0 三个数量的是同一件事，
  差的全是尺子——**第一跑一片红先怀疑探针，这已经是第六次成立**。
- **钉住实验起点的手段本身可能是干扰源**（`blur()` 那一跑）。
  第四十轮的教训是「起点是设计的一部分」，这一轮补上后半句：
  **改起点的动作也要先证明它不改变被测对象**。


## 2026-09-18 第四十四轮：三个新取样面，**掉出两条产品缺陷**（一条在上游）

第四十一～四十三轮都没开新面，产出都是 0——这一轮按交接文档那张名单开了三个，
规律又应验了一次。**判读一轮的产出，先问它开没开新面。**

| 新取样面 | 结果 |
| --- | --- |
| `aria-hidden` 子树里的可聚焦元素 | **负结果，0 条**（静态命中 23/23 两边相同，全被模态焦点陷阱抵消） |
| dark 下的文本对比度 | **1 条跨应用分叉**（免责声明 `/70` vs `/67`），其余低对比度两边逐值相同 |
| **按下 Tab 之后焦点落在哪** | **2 条产品缺陷 + 3 条待查的单边落点** |

### 一、`aria-hidden` 面：负结果，别重做

底稿（第三十九轮写好、一次没跑过）照搬进 `zz-aria-hidden.spec.ts` 跑完两个应用：

```
vue 23 个场景命中   react 23 个场景命中   only-vue 0   only-react 0
```

差的只是 **`aria-hidden` 落在哪一层**：上游打在 `div[sidebar-wrapper]` 一层上，
本仓打在 `div[sidebar-inner]` + `main` 两层上——`hideOthers` 沿祖先链标兄弟节点，
两边覆盖的是同一片内容。

**但这个问法本身是错的**，axe-core 对这条规则有 `focusable-modal-open` 例外：
模态开着时背景被 `aria-hidden` 正是**正确写法**，焦点由 FocusScope 陷住。
换成量「键盘真的走得进去吗」之后，**两个应用 56 个终态 `hiddenHits` 全 0**。

**翻案判据**：哪天某一屏的 `aria-hidden` 背景**没有**配焦点陷阱，
`keyboard-trap.spec.ts` 会先响（焦点会走进去并继续走）。

### 二、dark 对比度面：1 条真分叉，其余是上游的配色取舍

量法：每个可见文本元素，把祖先链的背景色**逐层画进 1×1 canvas** 再读像素
（⚠ 本仓色板是 `oklch(...)`，**Chrome 的 computed value 原样保留色彩空间**，
手工解析 rgb 会全盘读错），合成 alpha 与累计 opacity，按 WCAG 1.4.3 判 4.5 / 3.0。

```
vue checked 1994   react checked 1989   唯一失败签名 15 / 15
```

**唯一的跨应用分叉**（46/56 个终态都看得见，台账一行没报）：

| | 类串 | 实测 | 对比度 |
| --- | --- | --- | --- |
| 上游 | `text-muted-foreground/67`（input-box.tsx:2848） | `#767675` on `#1f1f1d` | 3.63 |
| 本仓 | `text-muted-foreground/70`（ChatComposer.vue:2195） | `#7a7a79` on `#1f1f1d` | 3.84 |

**台账为什么没报**：`geometry` 档只采**锚点**的颜色，而这个 `<p>` 不是任何场景的锚点。
已改成 `/67`。

**其余 14 个签名两边逐值相同**，是上游的配色选择、不是对照问题，**别去重新配色**：

```
button「Continue」 2.38（×4 终态）   span「Agents」 1.55   「PARITY-TODO-DONE」 2.62
text-red-500 的 -1/-2 4.29–4.38     Flash/Minimal/Ultra 与它们的说明 3.67
「1 more step」 3.19                 markdown 正文 #333333 on #1f1f1d 1.31（×2）
aurora 渐变标题 1.00（`bg-clip-text` + 透明文字，尺子够不着，已标 img=1）
```

**翻案判据**：上游把某一档 alpha 或 token 改了，跟着改；**单方面重新配色会造出新的分叉**。

### 三、键盘面：两条产品缺陷

#### ① 上游的键盘陷阱（WCAG 2.1.2）——**本轮最重的一条**

`browser-feature` 这一屏，两边前 14 个 tab 落点**逐字相同**；落到浏览器面板那个
`div` 之后：

```
上游  stops 14 / distinct 13，其后 26 次 Tab 零次 focusin，activeElement 仍是那个 div
本仓  stops 58 / distinct 29，走完面板控件 → 侧栏 → 绕回开头
页面里 iframe 数 = 0（两个应用），所以不是「焦点进了框架」
```

根因是**一个被丢掉的返回值**：

```
上游 browser-view-panel.tsx:  if (!input) return; sendInput(input); event.preventDefault();
本仓 ChatComposer/BrowserPanel: if (!input || stream.sendInput(input) !== "sent") return; …
```

`Tab` 在 `FORWARDED_NAMED_KEYS` 里，上游拿到判定就吞键，**不管有没有真送出去**；
那一屏还停在 "Connecting to live"，socket 没开，于是键被吞、人出不来。
上游的 `sendInput` **本来就返回布尔**（socket 未 OPEN 返回 `false`），只是没人接。
**已按已授权的例外修上游**（一行 + 判词），改成与本仓同一个契约。

#### ② 斜杠技能胶囊：本仓两处都缺（上游有）

两边都用 `Tab`/`Enter` 接受斜杠建议（`input-box.tsx:1669` 与 `ChatComposer.vue:1164`
逐字同形），但接受之后：

| | 输入区那颗 | 会话流那颗 |
| --- | --- | --- |
| 上游 | `SlashSkillChip` 可移除档：`<button aria-label="Remove /<name>">` + X，`border-primary/20 bg-primary/10 text-primary … font-mono shadow-xs` | 只读档：胶囊 + 剩下的话（message-list-item.tsx:355） |
| 本仓（改前） | 纯 `<span class="bg-secondary mr-2 … rounded px-2 py-1">`，**没有任何移除入口** | **一个字都没画**——整行裸文本 |

`resolveSlashSkillDisplay` 在本仓 `core/skills/slash.ts` **实现了、单测也有，
但没有任何组件调用它**。

**台账为什么没报**：这两处都只在「选中了斜杠技能」之后才存在，而此前
**没有任何对照终态停在那个状态上**——`ChatComposer.vue` 自己的注释里那句
「取样发生在无 chip 的稳定态」就是这块盲区的自白。

修法按「该重构重构」：补一层真组件 `SlashSkillChip.vue`（照抄上游的
`CHIP_BASE_CLASS`，一份视觉两个调用点），加 `HumanMessageText.vue` /
`HumanSlashSkillText.vue` 两层——**分两层是刻意的**，与上游同一个理由：
只有长得像斜杠激活的消息才该订阅技能目录，而 Vue 的 composable 在 setup 阶段
无条件执行，"不订阅"只能靠"不挂载那一层"来表达。

#### ③ 三条**只在上游有**的 tab 落点——**挂账，下一轮查**

去掉 `data-slot` 之后按集合比，只在上游出现、本仓没有的落点：

| 终态 | 只在上游的落点 | 猜测（**未验证**） |
| --- | --- | --- |
| `integrations#skills` | `div(tablist)"Agent Skills"` | Radix Tabs 的 list 容器本身可聚焦 |
| `artifact-preview` / `artifact-batched-stream` | `div(group)""` | Radix ToggleGroup 根可聚焦 |
| `sidebar` | `button"Remove /data-analysis"` | **本轮已修**（就是上面第②条） |

⚠ 前两条与 wave 98/149 判过的 `scroll-area-viewport` 是同一族
（「上游给容器补了 tabIndex，本仓没跟」），**那一族当时判的是「不跟」**。
所以这两条**不能直接照抄上游**，要先看它是不是同一笔账。

### 四、本轮的仪器账（两条，都值得记）

1. **`runScenario` 在 `state.steps` 之后不再 settle。**
   `captureScenario` 是自己补的那一道（capture.ts:845）。探针照着
   `runScenario` 写就会**读在 animate-in 中段**：对比度探针第一跑报出一批
   `ratio ≈ 1.00` 的「失败」（`#2c2c2b` on `#2d2d2c` 的 Save 键），
   全是那一帧 opacity 还在 0.05。补上 `waitForFiniteAnimations` +
   `waitForDomQuiet` 之后，**唯一签名从 39/43 塌到 15/15**。
   **判据**：探针里 `runScenario` 之后必须自己补那两道。
2. **第一跑一片红，先怀疑探针**（累计第五次）。
   `aria-hidden` 探针第一跑两边各 23 个场景命中，看着像一堆账；
   查下来是问法错了（漏了 axe 的 `focusable-modal-open` 例外）。

### 五、新常驻门禁：`tests/e2e-parity/keyboard-trap.spec.ts`

不变量：**从任一终态起连按 Tab，焦点不会被某个元素永久吸住。**

- **两个应用都跑**——这是本轮定的：它抓到的那一条**只有上游有**，而
  `settings-narrow-screen` / `narrow-screen-overflow` 都只跑本仓、台账又按定义
  只报「两边不一致」，上游单边回归此前没有任何门禁看得见
  （正是交接文档「下一轮最该先拿的」第 2 条点名的那个洞）。
- 量法：装 focusin 记录器 → 按 30 次 → 读 → 再按 10 次 → 再读。
  后一段零新增、而 `activeElement` 还停在具体元素上，就是吸住。
- **两条反空转断言**：①「一次都没动」只在**有浮层接管键盘**时才放行
  （写成规则不是清单；实测五个终态落在这一支，两个应用完全相同）；
  ②「跑不到位」单列一张表并断言为空。
- `activeElement` 落到 `body` 不算吸住（`artifact-preview` 那一屏有 iframe，
  两边 `frames: 1`），**翻案判据**：哪天两边在「会不会落到 body」上分叉，那才是账。

**变异验证**（签入前必做）：把上游那个 `if (!sendInput(input))` 撤回成
`sendInput(input);`，门禁当场红，报的就是
`browser-feature: 停在 div"Browser…Connecting to live bro"，其后 10 次 Tab 无变化`；
还原后 `1 passed (2.9m)`。**它不是潜在守卫。**

**收工整套读数**：`e2e-parity` **181 passed / 29.4m**（其中 keyboard-trap
vue 1.5m + react 1.7m）、`make e2e` 296 passed / 2.9m、`verify` 0、
`cd frontend && pnpm check` 0 + `prettier --check` 0。
台账 `make parity-accept` 之后 **165 个场景-维度 / 0 唯一行**。

### 五b、顺手撞出的第三条仪器账：**门禁拿自己的残缺模型去对文档，两边一起错**

`doc-facts.test.ts` 算 `e2e-parity` 用例数的公式是
`台账键数 + PARITY_FIXED_TESTS`，而 `PARITY_FIXED_SPECS` 那张表
**漏了两份 spec**：`narrow-screen-overflow`（2 条，第三十八轮加的）与
`interaction-settles-first`（1 条，第三十八轮加的）。

于是它算出 173、文档也写 173，**门禁一直绿**——而实跑是 178。
第四十四轮加 `keyboard-trap` 时拿实跑读数（181）去对，才现形。

```
实跑逐 spec：scenarios 165 · topology 5 · diff 3 · animation-settle 2 ·
             narrow-screen-overflow 2 · keyboard-trap 2 ·
             sidebar-collapsed-affordance 1 · interaction-settles-first 1
固定部分 16（此前常量写 11）　调用点 14（此前断言写 10）
```

**判词**：那张表现在多了一条断言——`tests/e2e-parity/` 下除 `scenarios.spec`
之外的每一份都必须登记，**漏一份就红**。
原来那条「调用点还是 N 个」的断言只对得上表自己，看不见表外的东西。

### 六、新进取样面的两个终态

- `sidebar#slash-selected`——输入区那颗可移除胶囊。用 `press: Tab` 接受建议
  （这条场景的注释早写过「不能有 click 步骤」：虚拟指针会留在点过的地方）。
  终态断言钉在那颗移除键上，**它只在胶囊里存在**，所以「零差异」不可能是「压根没采到」。
- `user-message-plain-text` 的夹具补了一条 `/data-analysis …` 的人类消息——
  会话流那颗只读胶囊从此进台账。


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
| 6      | **台账里那 42 行 ScrollArea 差异** | ~~判词仍然成立~~ **⚠ 2026-09-16 第三十一轮判词作废：本仓把 `Suggestions` 整层补上了，那一族 105 个投影清零**（做法见第三十一轮条目）。下面是作废前的原文。 | 2026-09-11 复核过：上游那条 `ScrollBar className="hidden"` 还在、两边的内层容器**都是 `flex-wrap`**（所以上游那个 ScrollArea 确实不会横向滚），原判有效。**它占了台账的四成**，读台账数字前先把它减掉。 原文如下：**wave 98 核完：接受**                       | 逐屏量过：`/workspace/chats`（会话列表页）两边**都**有一个 viewport，对得上；差异全部来自 `/workspace/chats/new` 那一屏——**上游的建议行套了一层 `ai-elements/suggestion` 的 `Suggestions`，而它就是一个 `ScrollArea`**。看它的实现：里面是 `flex w-full flex-wrap`（内容本来就换行）、外面那条横向 `ScrollBar` 还写着 `className="hidden"`——**这一层永远不会真的滚动**。本仓 `WelcomeSuggestionList.vue` 用的是一个普通的 `flex flex-wrap` 容器，**什么都没少**。**决定：不跟。** 补一层不产生滚动的 ScrollArea，只会多一个键盘停靠点（正是第 6 条上一轮刚修掉的那类噪声）。**翻案判据**：上游哪天把那条 `hidden` 去掉、让建议行真的横向滚动。                                                                                                                                                                                                                                                                                                        |
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
