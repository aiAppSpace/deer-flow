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

### 2. 本机 `make verify` **不含** `e2e-mock`

**改动碰到布局 / primitive 时，本机要额外跑 `make e2e`**（约 2 分钟，275 条）。
第三十七轮就是这么漏过一条红的：本机一路绿、CI 才照出来。

### 3. 「逐字对齐上游」不是无条件正确的

本仓比上游多出来的东西，可能正扛着上游没有的约束。
**删之前问「它在守什么」，而不是只问「上游有没有」。**
（`ScrollArea` 那颗 `overflow-hidden` 就是：第三十七轮删过一次，当场被门禁按回来；
第三十八轮先修掉它守着的那个 0 余量，才真的删得掉。）

### 4. 「余量为 0」和「守住了」长得一模一样

只断言「溢出为 0」抓不到「余量为 0」。第二十一轮和第三十七轮各栽一次。
补门禁时把**余量**直接量出来（把元素临时设成 `width:min-content` 读固有宽度，
读完还原），门限要盖得过 macOS↔Linux 的字体差（实测约 9px）。

---

## 下一轮最该先拿的（按顺序）

### 1. 扩取样面 —— 现在这是唯一能真正推进的方向

四张工单表里三张归零、一张剩 1 条（读数见下），台账在 macOS 与 Linux 上同时是 0。
**剩下的不是「还有多少没做」，是「还有多少没被看见」。**

- `baseline/parity-route-sampling.json` 是路由坐标系，先看哪些路由取样点最少；
- 对照场景 id **就是上游 spec 文件名**，想不出对应 spec 就加不了新场景（棘轮会红）；
- 加新场景要**给它加终态断言**，否则「零差异」可能只是「压根没采到」。

**校准用的轶事**（是轶事不是统计）：第三十七轮结清的 5 笔里有 **3 笔是六档全盲的**
——拖拽手柄属性、菜单焦点释放、整层漏掉的面板外框，aria 树 / 几何锚点 / 请求
一个都没报出来，全靠临时写探针照出来的。

### 2. 320px 那 3px（低优先，取舍已写）

两边一起溢出 3px，同值、不是对照问题、不在受支持档里。
要动就得动徽标的 `whitespace-nowrap` 或第四层内边距，**没有读数支持**。
翻案判据：哪天 320px 进了受支持档，回来重量那条链。

### 3. 工单表读数（2026-09-17 量的，会漂，自己重量）

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
