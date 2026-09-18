# 新窗口开工：整段贴给下一个窗口

> 这份文件只有一个用途：**新窗口第一句话贴什么**。
> 深度背景在 `vue-parity-cold-start.md`（怎么接手）与
> `vue-parity-open-accounts.md`（每一笔账的判词）里。

---

读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/plans/NEXT-WINDOW.md`
并按它执行。

先按下面「现场量一遍」那段命令**把状态量出来**，量完把读数说给我看；
**不要引用文档里的散文当读数**。

然后从「下一轮最该先拿的」第 1 条开始做，**做完自动开下一轮**，一直推到我喊停。
中途不要问「要不要继续 / 提交 / 推送」——提交与推送是 2026-09-06 就给的长期授权
（Claude 记忆 `deerflow-no-midway-questions`），取舍自己定并写进提交说明。

---

## ⚠ 最终判据（2026-09-16 用户重申）

用户原话：**「最终目的是 vue 版本和 react 版本在功能，体验，交互逻辑，界面上保持
完全一致」**，并追一句「这个才是最终目标」。

同日给的四句是同一条判据的四个面：

- **不能缩水和打补丁**——对齐要还**根因**，不是让台账那一行消失；
- **该重构重构**——上游那一层结构本仓缺了，就按本仓的分层**补一层真组件**；
- **按业界最佳方案**——两边都不对时取业界做法**两边同改**；
- **不要机械式对齐**——**判据是渲染与行为一致，不是源码字面一致**。

**底层不同构时可以退让**，但允许不一致的只是**实现字面**；渲染/行为/可访问性树
仍按完全一致要求，而且必须拿得出**实测读数**并写**翻案判据**。

判据全文：记忆 `deerflow-vue-replacement-goal` 与 `deerflow-long-term-top-tier-goal`。

---

## 现场量一遍（别信散文，这几个数会漂）

```bash
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow
git rev-parse --short HEAD && git status --short && git rev-list --count origin/main-wc..HEAD

python3 - <<'EOF'
import json
d = json.load(open("frontend-vue/baseline/parity-diff.json"))["entries"]
rows = {f"{k}·{f}:{x}" for k, v in d.items() for f, r in v.items()
        if isinstance(r, list) for x in r}
print("场景-维度", len(d), "唯一行", len(rows))
EOF

# CI：⚠ head_sha 必须传全 sha（短 sha 永远返回 total_count: 0）
gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git rev-parse HEAD)" --jq '.total_count'
gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git log -1 --format=%H -- frontend-vue contracts backend/app/gateway)" \
  --jq '.workflow_runs[] | "\(.name) \(.status)/\(.conclusion) \(.head_sha[0:8])"'
```

⚠ **纯 docs 提交不会触发任何 CI run**（workflow 有 `paths:` 过滤），
所以 `total_count: 0` **不是「没问题」**。要问的是「覆盖当前 `frontend-vue` 树的
那次 run 绿不绿」；一条红会让后面的步骤全 `skipped`，所以要看**逐步结论**。

---

## 第三十八轮收工状态

**`b8cc8b19` 是 `frontend-vue parity` 在 Linux 上第一次全绿**（此前 14 次全是
failure / cancelled）。之后 `87dbe46e` 又改了尺子，**它的 CI 读数要自己去量**。

| 账 | 状态 |
| --- | --- |
| **A 组**（`integrations` mobile 宽度 Δ4.1/4.2） | ✅ 结清，两边同改，根因是两处 min-content |
| **E 组**（表格 y 偏移） | ✅ 第三十七轮结清 |
| **账 J**（`div(separator)`） | ✅ 第三十七轮结清（尺子的账） |
| **账 K**（菜单 tab 停靠点 / 焦点） | ✅ 第三十七轮结清 |
| `hit React=self Vue=div` 三行 | ✅ 判给尺子并补了确定性门禁，见下 |

⚠ **一次运行是一个样本。** A 组那 5 行此前稳定 3/3，归零是实的；
`hit` 那 3 行一直是飘的（2/3/0/3），**本轮是从机制上判的，不是靠一次绿**。

### A 组怎么结清的（顺带订正一条会重犯的规则）

第三十七轮写的判词（「Refresh 按钮顶着 min-content」）**是错的**，探针推翻：
`headerMinContent 40 / actionMinContent 95`，第二十一轮的 `min-w-0` 早修好了。
真正顶着的是两处**两边完全相同**的东西：

- scope 说明里嵌的 `calendar:calendar.free_busy:read.`（192.2px 的一个「单词」）；
- 「在浏览器重新注册」按钮 nowrap 191.1px，而那一列只有 186px。

**⚠ `break-words` 对 min-content 是空转的**——按 css-text-3，
`overflow-wrap: break-word` 新增的换行机会**不计入 min-content**，`anywhere` 才计入。
凡是「加了 `break-words` 但盒子还是缩不动」，根因都是这一条。

```
面板 min-content  286.2 → 240.5    375px 余量 6.8 → 52.5    360px → 37.5
375/360/340/320 四档上两个应用逐值相同
```

余量够了 ⇒ `ScrollArea` 那颗承重的 `overflow-hidden` 删掉、基类与上游一字不差、
`primitive-base-classes` 那条豁免按它自己的翻案判据删除。

### 扩取样面：dark 维 19 → 33，**顺带照出一个「0 行」是假的**

八块彼此不重叠的色彩面各补一个 dark 维（`thread-history` / `sidebar` /
`channels` / `thread-todos` / `background-tasks` / `artifact-preview` /
`mcp-settings` / `branch-thread`），共 14 个新场景-维度，**全部 0 行**。
加维之前先确认过 `geometry` 档采 `color` / `background` / `opacity` 等，
不是白加。跑时 18.1 min（原来约 17.7）。

**同一跑报出 8 行，指向一个此前一直存在的坑**：`streaming-reasoning-order`
两个语言维各 4 行，Linux 与 macOS 读数完全相同、不是飘。但探针一量，
**两个应用行为一模一样**——推理折叠块都是先展开、+300~500ms 自动收起。
差的是取样相位：

```
settle 时  本仓 anims=[]                       → 等待返回 0ms → 采到「展开」
           上游 anims=[CSSTransition×5, 250ms] → 等约 250ms   → 采到「收起」
```

⚠ **改之前这一屏是 0 行，而那个 0 是两处错误互相抵消出来的**——两边都采在
自动收起之前，一起采到「展开」。这条场景的 `settle` 从头到尾只等到正文出现，
而屏幕在那之后还会自己再变一次。**一个还会自己变的屏幕不算终态。**

处置：补一条 `hidden` 终态断言（等那次自动收起真的发生），按状态等不按秒表等。

### 窄屏门禁从 1 个分区推到 10 个：**当场抓到两处两边共有的缺陷**

`integrations` 那一个分区此前单独有「窄屏装得下」的门禁，而它在第二十一/二十七/
三十八轮各出过一次事。**一个分区有门禁，另外九个不是没问题，是没人看。**
新门禁 `tests/e2e/settings-narrow-screen.spec.ts` 用 `SETTINGS_SECTIONS` 反查，
375/360 两档各断言 `panelOverflow === 0` 与 `panelSlack >= 12`。第一次跑就红 3 条：

| 分区 | 读数 | 根因（上游逐字相同） |
| --- | --- | --- |
| `appearance` | `panelOverflow` **55@375 / 70@360** | 主题预览写死 `grid-cols-[1fr_240px]`，固定轨道不会缩 |
| `skills` | 余量 **3px@360** | 外层 header 有 flex-wrap，里面那组按钮没有 |

`appearance` 那条不是「余量小」，是**这块面板在所有手机上都挂在设置对话框外面**。
两边同改（`minmax(0,240px)` / 内层补 `flex-wrap`）。
**这两处都不减对照分——两边一样坏，台账按定义看不见。**

### 窄屏扫描抓到一条**真的两边分叉**

`subtask-card` 折叠头右侧那格漏抄了 `min-w-0`（上游一直有）：360px 上它从 144 涨到
214、撑破 164px 的父格，**把状态图标推到 364–380，整个跑出视口**。
**台账一直看不见**，因为这个场景只有 desktop/zh/dark 三维，窄屏从没采过——
同轮补上 mobile 维。

补完 mobile 维当场又照出一行 `ambilight` 的 **0.1px**，而那是**尺子的问题**：
常规几何有 2px 容差，伪元素那一档却按整串精确比，同一把尺子对同一种量用了两套判据。
已把 `w=`/`h=` 拆出来走同一容差（其余字段仍逐字比），配三条单测 + 变异验证。

### `hit` 三行怎么判的

**先排除应用**（判据 #9），三跑同号：两边的 dialog 动画声明**逐字相同**
（content 200ms/ease/0、overlay 150ms/ease/0），差的只是那块面板的 chunk 何时就位
——而那一笔 `SettingsDialog.vue` 文件头**早有判词**（九个面板全切开反而让关键路径
涨了；两边 loading 占位都是同一句 `role=status`）。

于是 settle 锚点在两边落在开场动画的**不同相位**（本仓 15/200、上游 200/200），
Playwright 的 scroll-into-view 按当时的几何算滚动量：

```
点第一颗按钮之后   本仓 scrollTop=460（滚到底）   上游 411
补上「交互前等开场动画」之后   两边都是 411
```

`waitForFiniteAnimations` 抽成 `support/settle.ts` 独立一层（原地反向 import 会成环），
`runScenario` 在 settle 之后、交互之前调用它；新门禁
`interaction-settles-first.spec.ts` 断言**两边滚动位置相等**（不是等于某个数）。
变异验证：摘掉等待当场红成 `vue=460 react=411`。

---

## ⚠ 别再做的事（逐条带读数）

### 1. 动手改之前，先看那份文件自己怎么说的

第三十八轮差点把「两边内容到达时刻差 280ms」当新账重开——
`SettingsDialog.vue` 的文件头早写着判词和实测读数。
**记忆 `deerflow-parity-three-docs` 的同一形状。**
`ScrollArea.vue`、`SettingsDialog.vue`、`integrations-settings-page.tsx`
这几份的文件头都很长，而且都带读数，值得先读完。

### 2. `hidden` 断言前面必须有一条 `visible`

`locateTarget(...).first()` 匹配不到时是个**空 locator**，而
`waitFor({ state: "hidden" })` 对不存在的元素**立刻通过**。
`background-tasks#disabled` 的主角断言就是这么在空壳上绿了很久的。
**同一轮我自己在 `showcase-public-thread` 上原样又写了一遍。**

### 3. 锚点不能写死英文

场景跑 en-US 与 zh-CN 两维，导航文案两边词典都翻译了。
第三十八轮给 `background-tasks` 写 `role=link, name: "New chat"`，zh-CN 三条超时。
**优先挑夹具里的字符串**（如那个场景的 `mock.threads[].title`）——它不过词典，
天生语言无关，而且证明的东西更强。

### 4. 本机 `make verify` **不含** `e2e-mock`

**改动碰到布局 / primitive 时，本机要额外跑 `make e2e`**（约 2 分钟，275 条）。
第三十七轮就是这么漏过一条红的：本机一路绿、CI 才照出来。

### 5. 「逐字对齐上游」不是无条件正确的

本仓比上游多出来的东西，可能正扛着上游没有的约束。
**删之前问「它在守什么」，而不是只问「上游有没有」。**
（`ScrollArea` 那颗 `overflow-hidden` 就是：第三十七轮删过一次，当场被门禁按回来；
第三十八轮先修掉它守着的那个 0 余量，才真的删得掉。）

### 6. 「余量为 0」和「守住了」长得一模一样

只断言「溢出为 0」抓不到「余量为 0」。第二十一轮和第三十七轮各栽一次。
补门禁时把**余量**直接量出来（把元素临时设成 `width:min-content` 读固有宽度，
读完还原），门限要盖得过 macOS↔Linux 的字体差（实测约 9px）。

---

## 下一轮最该先拿的（按顺序）

### 1.（已完成，留着当判据）窄屏溢出常驻门禁

`tests/e2e-parity/narrow-screen-overflow.spec.ts` 已落地（`e2d4d366`）。
**这一条留在这里不是待办，是判据**——它的判定规则被变异验证按回来三次：

| 版本 | 规则 | 被什么推翻 |
| --- | --- | --- |
| 1 | 越过视口 且 无裁剪祖先 | 变异后**照样绿**（消息列表是 `overflow-y-auto`） |
| 2 | 算最近裁剪祖先的可滚动右界 | **误报 36 条**（`scrollWidth` 原点不是 `rect.left`） |
| 3 | 越过视口 且 无可滚祖先 | 又绿（**`sw>cw` 在 `overflow:visible` 上不代表能滚**） |
| 4 | 把不变量直接说出来 | ✓ |

**⚠ 只跑「干净时绿」的话，一条门禁会以永远不会红的形态签进去。**
前三版每一版都「说得通」，是变异验证而不是推理把它们按回去的。
**判据里也不要做算术**——算式自己会错，而且错得很像读数。

当时判好的三件事（已照此实现）：

1. **位置**：`tests/e2e-parity/`（需要 `runScenario`），**只跑一个应用**——问的是
   「这一屏溢不溢出」，两边一样坏的也要抓。代价约 3 分钟（当前 parity 已 23 分钟）。
2. **规则必须排除被裁的元素**：「right > 视口宽」会把每一张横向滚动的表格都报进来
   （`artifact-table-preview` 就是这么误报的）。**逐层往上走，遇到 `overflow` 非
   `visible` 的祖先就不算。** `subtask-card` 那条是真的，正因为它一路到顶都是
   `visible`。`documentElement.scrollWidth <= innerWidth` 这一条本身干净，可以直接用。
3. **两张表而不是快照数字**：**可达且干净** 与 **窄屏下到不了**（14 条，各写原因），
   两张表恰好划分全集，新增状态必须显式选一边。
   别写 `checked === 43`——`e2e-suite-contract` 的文件头写过为什么不钉快照数。

⚠ **写探针时的两个坑，我都踩过**：
- `runScenario` 里的 `applyDimension` 会按 `VIEWPORTS[viewport]` 设视口，
  **覆盖 `newContext` 的 viewport**。要量 360 必须在它之后再 `setViewportSize`。
  没注意时我量出「43 个状态全溢出」——那是拿 361 去卡一个 375 宽的页面。
  **判据：探针里凡是「全都红」，先怀疑探针。**
- 那 14 条「窄屏下到不了」**本身可能就是账**：比如 `channels` 系列走侧栏点击，
  而侧栏在手机上是抽屉。到不了不等于没问题，只等于那条路径是按桌面写的。

### 2.（已查完，留着当判据）那 14 条「窄屏下到不了」

`narrow-screen-overflow.spec.ts` 的 `MOBILE_UNREACHABLE` 里躺着 14 条，
**十二条同一个根因**：桌面侧栏在手机上不渲染（换成 Sheet 抽屉），
于是 `[data-sidebar='sidebar']` 以及侧栏里那些会话行的定位器永远解析不到。

**「到不了」不等于「没问题」，只等于那条路径是按桌面写的。**

⚠ **但也别把这 14 条当成 14 块没人看的屏**——逐条对过之后，
**真正没有窄屏覆盖的只有 5 块**：

| 到不了的终态 | 那块屏别处有没有窄屏覆盖 |
| --- | --- |
| `channels` ×5 | **有**（实测）：`settings-narrow-screen.spec.ts` 按 `SETTINGS_SECTIONS` 覆盖 `?settings=channels`，375/360 两档含余量 |
| `thread-list-pin` | **有**：同一场景的 `#mobile-drawer` 终态本来就跑 mobile |
| `thread-history` | ~~大概率有~~ **已订正并补上**，见下 |
| `thread-title-sync` | ~~没有~~ **已订正并补上**，见下 |
| `artifact-batched-stream` | **大概率有**（仍未逐屏核）：`artifact-preview` 有 mobile 维，是同一块面板 |
| `sidebar` | **部分**：移动抽屉由 `thread-list-pin#mobile-drawer` 与 `ui-polish-mobile` 采着 |
| `agent-create-name-step` | **没有** |
| `browser-feature` | **没有** |
| `sidecar-chat` | **没有** |
| `thread-title-sync` | **没有**（侧栏行内的 ⋯ 菜单） |
| `workspace-changes#reasoning-menu` | **没有**（`#changes-panel` 也没有 mobile 维） |

**那 4 块已经在同一轮查完了**——逐条在 360px 上**两个应用各跑一遍**：

| 场景 | 判 |
| --- | --- |
| `agent-create-name-step` / `browser-feature` / `workspace-changes#reasoning-menu` | **不是缺口**：两边卡在同一个定位器，那几条路径/功能在手机上两边都一样 |
| `sidecar-chat` | **有差异**，已修：窄屏 sr-only 的 `SheetTitle` 本仓翻译了、上游写死英文，读屏器听到的两边不一样。搬进 `primitives.*` 后两边停在同一步 |

**判据：这一类排查必须两个应用各跑一遍。** 只跑本仓的话，「到不了」看起来
永远像本仓的问题——实测 4 条里 3 条是两边一样的。 做法是照 `thread-list-pin#mobile-drawer`
的样子**另开一个 mobile 终态**（先开抽屉再走），而不是改现有终态的步骤——
步骤是跨维度共用的，加一句「点开抽屉」会把桌面那几维弄坏。

⚠ 表里「大概率有」那条**是推断不是读数**，动手前先量一眼。

#### 我自己那条推断当场就被量翻了（2026-09-18，同一轮）

我写「`thread-history` 那块屏由 `chat` 的 mobile 维采着」——**错的**。
去读那个场景才发现它根本不是消息流，是**侧栏会话列表 + 会话行的 ⋯ 菜单**，
和 `thread-title-sync` 是同一块面。

而 `thread-list-pin#mobile-drawer` 那个终态开了抽屉、断言 ⋯ 按钮**可见**，
**但从没点开它**——于是那块菜单在窄屏上一格都没采过。
所以做法不是给两个场景各开一个 mobile 终态，而是**把已有那个终态多点一下**：
点开 ⋯ → 断言置顶/重命名/删除 → 展开导出子菜单。
实测：新增那一维 **0 行**，窄屏溢出门禁也绿。

**判据：说「那块屏别处采着呢」之前，先去读那个场景到底在量什么。**
场景 id 常常和它实际覆盖的面对不上（`thread-history` 听起来像消息流，
其实是侧栏）。

### 3. 挑下一条**单应用不变量** —— 本轮四条仪器里三条有收获，方向是对的

本轮真正有收获的仪器有个共同点：**都是单应用不变量**（窄屏溢出、终态稳定、
面板余量），而不是加维度——因为两应用台账**天生看不见「两边一样坏」**。

已经扫过、**别重做**：

| 不变量 | 读数 |
| --- | --- |
| 窄屏溢出（57 终态） | 1 条真分叉（`subtask-card`），已修并做成常驻门禁 |
| 终态稳定（57 终态） | 4 条，含一条**一直在空壳上通过**的断言，已修 |
| 设置面板窄屏余量（10 分区） | 2 条共有缺陷 + CI 上第 3 条（Linux-only），已修并常驻 |
| **可访问名**（57 终态 ×2 应用） | **真分叉 0 条**；「共有缺陷」全是已判过的或夹具造成的，**不值得常驻**（判词见 open-accounts 第十四节） |
| **语言 × 窄屏**（42 可达终态，zh-CN） | **0 条溢出**。中文可在任意字符间断行，min-content 反而更小——撑破布局的是不给换行机会的长 token，那是英文那侧的形状（判词见第十五节） |

还没试过的方向（各自要先当探针量一遍、有收获再常驻）：
`aria-hidden` 里套可聚焦元素、重复的可访问名、焦点陷阱、对比度、
**同一处内容在 dark 下的对比度**、以及**点得动吗**
（`thread-list-pin#mobile-drawer` 在 zh-CN 下就是「按钮在、可见、名字对，
但点不动」——见 open-accounts 第十五节那条潜在账）。

### 4.（旧第 1 条）对话框的窄屏扫描 —— **别再逐个手接入口**

设置对话框的十个分区已经有门禁了（见上）。**同一类缺陷的下一块地是别的对话框**：
`AgentSettingsDialog` / `ChannelRuntimeConfigDialog` / `SubagentEditorDialog` /
`ComposerModelSelector` / `ProjectMoveDialog` / `MarkdownTable` / `MermaidFullscreen`
等，一共 18 个带 `DialogContent` 的组件。

⚠ **第三十八轮试过逐个手写触发器，两个都卡在打不开（30 秒超时），不是量到了什么。**
parity 场景表里**已经编码了到达这些状态的步骤**（`channels#runtime-config-edit` 等），
正确做法是复用 `runScenario`。挡路的是套件边界：`scenarios.ts` 在
`tests/e2e-parity/` 下，e2e-mock 不该反向依赖它（`e2e-suite-contract` 管着）。
**先判这个再动手**，两条路：

- 把窄屏溢出断言加进 parity 取样（跑得到两个应用；但台账看不见「两边一样坏」，
  要单独断言而不是进台账）；
- 或者把场景表提到两个套件都能引的一层。

**已量到的负结果，别重做**：8 条产品路由在 360px 默认态全干净
（`documentElement.scrollWidth === 360`、越界元素 0）；`subagent-editor`
对话框有富余（dialog 328 / min-content 218）。**缺陷在对话框里，不在路由本身。**

### 5. 系统查一遍「终态没定义完」的场景 —— 已经做过一轮，工具留着

`streaming-reasoning-order` 的 `settle` 只写到「第一眼看到的东西出现」，
而那一屏之后还会自己变一次，于是它的「0 行」一直是假的。
**历轮加进来的场景里有多少条是这样，没人系统查过。**

排查办法（只需要跑**一个**应用——问的是「这一屏自己稳不稳」，不是「两边一不一样」）：
跑一遍场景，`settle` 之后隔 1.5 秒再读一次 `document.body.innerText`，两次不同的
就是终态没定义完的。约 57 个场景键，估计 5–6 分钟。

⚠ 这个办法只抓得到**文本**变化；属性（`aria-expanded`）与样式（颜色过渡）
它看不见。抓到的每一条都要按 `streaming-reasoning-order` 那样补终态断言，
**不要用 `waitForTimeout` 顶**。

### 6. 继续扩取样面（tablet 只有 4 个样本，是最薄的一条轴）



四张工单表里三张归零、一张剩 1 条（读数见下），台账在 macOS 与 Linux 上同时是 0。
**剩下的不是「还有多少没做」，是「还有多少没被看见」。**

- `baseline/parity-route-sampling.json` 是路由坐标系，先看哪些路由取样点最少；
- 对照场景 id **就是上游 spec 文件名**，想不出对应 spec 就加不了新场景（棘轮会红）；
- 加新场景要**给它加终态断言**，否则「零差异」可能只是「压根没采到」。

**校准用的轶事**（是轶事不是统计）：第三十七轮结清的 5 笔里有 **3 笔是六档全盲的**
——拖拽手柄属性、菜单焦点释放、整层漏掉的面板外框，aria 树 / 几何锚点 / 请求
一个都没报出来，全靠临时写探针照出来的。

### 7. 320px 那 3px（低优先，取舍已写）

两边一起溢出 3px，同值、不是对照问题、不在受支持档里。
要动就得动徽标的 `whitespace-nowrap` 或第四层内边距，**没有读数支持**。
翻案判据：哪天 320px 进了受支持档，回来重量那条链。

### 8. 工单表读数（会漂，自己重量）

```
react-parity-scope.json  → pendingRoutes        0     （18 条 page.tsx − 4 条豁免）
upstream-i18n-map.json   → pending.keys         0     （2026-09-10 达成）
parity-route-sampling.json → pending            0     （exempt 4）
parity-scenario-coverage.json → pending         1     artifact-table-performance
                                                      **已有完整判词，别重新问**
                              covered 37 / exempt 3
```

---

## 手上的工具（直接用）

### 本机诊断回路：**2.2 分钟**，而不是 25 分钟

```bash
cd frontend-vue
PARITY_ONLY=thread-history node scripts/keep-e2e-failure-artifacts.mjs -- \
  node scripts/with-loopback-no-proxy.mjs -- \
  python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test \
  -c playwright.parity.config.ts diff.spec.ts
```

该模式**既不比基线也不 accept**，结果打在 console 上（`取样计数` 之后那段 JSON），
还附 `REQUESTS` 与 `TABBABLES` 两段全量清单。

### Linux 定点复量

```bash
gh workflow run "frontend-vue parity" -R aiAppSpace/deer-flow \
  --ref main-wc -f parity_only=integrations#permission-request
```

**读产物，别读颜色**——该模式下那次 run 一定是绿的，结论在 artifact
`parity-failures` 的 `e2e-parity/report.json` 里。

### 探针四件套（历轮靠它定位到源码看不出来的根因）

写一份 `tests/e2e-parity/zz-*.spec.ts`，**用
`runScenario(page, base, scenario, dimension, state)` 把场景跑到位**
（自造夹具会失败），然后在两个应用上各拍一次快照 `console.log` 出来，用完即删：

1. **焦点快照**：`document.activeElement` + 各菜单项 `tabindex` → 定位到账 K；
2. **文本快照**：`JSON.stringify(el.textContent)` + `getComputedStyle(el).font`
   → 照出上游的句首空格；
3. **祖先链**：逐层 `width` / `padding` / `borderLeftWidth`
   → 照出整层漏掉的 `Artifact` 外框；
4. **min-content 承重链**（第三十八轮新增）：从根往下走，每层把元素临时设成
   `width:min-content` 读固有宽度、挑最大的孩子继续，走出承重链。
   ⚠ **`w-full` 的孩子固有宽度更大但不参与**，要按「不超过父亲的 min-content」过滤，
   否则会一路走进 `<input>` 的默认 `size` 里。
   ⚠ **一个终态只是一个取样面**：第三十八轮先只量了 `default` 态，
   结果门禁在「换 Lark 应用」态上照样红——**门禁点开的每一个态都要各量一遍**。

### 时间线/动画探针（第三十八轮新增）

`page.addInitScript` 里挂一个 rAF 循环打点（`performance.now()`），量
「对话框出现 → 内容出现 → 动画跑完」。
⚠ **别把 `performance.now()` 和 `Date.now()-t0` 混着比**——
前者以文档开始为原点，后者以 `goto` 之前为原点，两个时钟差一大截，
我照着它推出过一个不存在的矛盾。
⚠ 动画时长要读**声明值**（`effect.getComputedTiming().duration`），不要用墙钟差
——墙钟的起点边噪声能造出 200 vs 179 这种假差异。

### 截图归属

`diff.spec.ts` 里 `captureScenario` **先采 Vue、再采 React**，
所以 `test-failed-<2i+1>` 是 Vue、`<2i+2>` 是 React（`i` 是该场景键在
`report.json` 里的序号）。**别按奇偶猜**。

---

## ⚠ 判据（历轮被订正十几次，形状只有一个）

**「说得通的东西」和读数长得一模一样。**

- **一次运行是一个样本**——判「修好了」要同一棵树连着量到稳定；判「飘」两次不一致就够；
- **推翻一次实测只能靠另一次实测**，算术和源码结构都只是线索；
- **总数不是读数**——它会被「尺子变准」和「修好差异」两个相反方向同时推动；
- **「源码一样」不等于「运行时一样」**；反过来，**「文档写过」不等于「现在还成立」**，
  但**「文件头写过并带读数」通常就是判词**，重开之前先读它；
- **「台账 0 行」不等于「这一屏对齐了」**——它还可能是**两边一起采早了**，
  两处错误互相抵消（第三十八轮 `streaming-reasoning-order` 实证）；
- **尺子报出差异时先问：两边用户看到的东西有没有区别**——角色/几何/可达性全同、
  只差一颗内部样式钩子或只差一个时长，那是尺子的问题，不是应用的问题。

---

## 跑长命令的纪律

`make e2e-parity` ~25 分钟、`make e2e` ~2 分钟、`make verify` ~4 分钟。
**用 `run_in_background` 起一次然后等通知**，不要开 `while pgrep; do sleep; done` 轮询。
要串行跑多套就写成一条命令（`make a > a.log; echo "A=$?" >> a.log; make b > b.log; ...`）。

⚠ **门禁的退出码要卡住提交**，不能只打印——第三十七轮把 `make verify` 和
`git commit && git push` 串在一条命令里，看到 `VERIFY_EXIT=2` 时已经推出去了。

⚠ **`frontend-vue parity` 的并发组是 `cancel-in-progress`**：run 跑着时推送会把它取消。
纯 docs 提交不匹配 `paths:`，推了既不触发也不取消。
