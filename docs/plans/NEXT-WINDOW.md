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

## ⚠ 签入基线是 0，但那是 **macOS** 的读数

第三十六轮把签入基线推到 0。第三十七轮把 `e2e-parity` 接进 CI，
**第一次运行就红**——同一棵树在 ubuntu-latest 上量出 16 行。
所以「清零」的边界是三重的：**当前尺子、当前取样面、当前这台笔记本**。

台账只覆盖 147 个场景-维度（`tests/e2e-parity/support/scenarios.ts`）。
覆盖率棘轮：covered 37 / pending 1 / exempt 3，那 1 条 pending
（`artifact-table-performance`）**已有完整判词，别重新问**。

---

## 第三十七轮收工状态：Linux 台账 **8 行**

| 账 | 行 | 状态 |
| --- | --- | --- |
| **A 组**（`integrations` mobile 宽度 Δ4.1/4.2） | **5** | **未结清**，见「别再做的事」第 1 条 |
| **E 组**（表格 y 偏移） | **0** | ✅ ①上游 `{" "}` 的句首空格 ②本仓整层漏了 `Artifact` 外框 |
| **账 J**（`div(separator)` 30 行） | **0** | ✅ **不是应用的账**——尺子标签改成「只在重复时才补 `data-slot`」 |
| **账 K**（菜单 tab 停靠点 / 焦点） | **0** | ✅ 菜单项指针移出后不释放焦点，按 Radix `onItemLeave` 同形补上 |
| `hit React=self Vue=div` | **3** | 未判，**飘**（四次读数 2/3/0/3），Linux-only |

**已结清的三笔全是「六档全盲」**——拖拽手柄属性、菜单焦点释放、面板外框，
没有一项能被 aria 树 / 几何锚点 / 请求看见。
**「台账 0 行」只意味着「当前这些档在当前这些锚点上量不出差异」。**

---

## ⚠ 别再做的事（第三十七轮踩过，逐条带读数）

### 1. 别删 ScrollArea 根元素的 `overflow-hidden` —— A 组不能那样"结清"

删掉它，台账 A 组那 5 行确实归零，**但 `tests/e2e/integrations.spec.ts` 的
「设置面板在 375px/360px 屏上装得进对话框」当场从 `panelOverflow: 0` 变成 `4`**。

那颗类是**承重的**：对 grid/flex 子项，`overflow` 非 `visible` 会把「自动最小尺寸」
从 min-content 变成 0，这一层因此能缩到内容宽度以下。
**它同时就是 A 组那 4px 的来源**——本仓靠它多缩 4px。
**台账那 5 行和「窄屏不溢出」是同一个「0 余量」的两面。**

**真正该修的**：`CardHeader` 的 `grid-cols-[1fr_auto]` 第 2 列那颗
`whitespace-nowrap` 的 Refresh 按钮顶着 min-content（第二十一轮量到同一张卡
375px 下「macOS 恰好装得下、Linux 溢出 9px」）。**先修那个 0 余量**，
修完之后删掉 `overflow-hidden` 而窄屏门禁仍绿，A 组才真的结清。

### 2. 本机 `make verify` **不含** `e2e-mock`

上面那条红就是这么漏过去的：本机一路绿、CI 才照出来。
**改动碰到布局 / primitive 时，本机要额外跑 `make e2e`**（约 3 分钟，275 条）。

### 3. 「逐字对齐上游」不是无条件正确的

本仓比上游多出来的东西，可能正扛着上游没有的约束。
**删之前问「它在守什么」，而不是只问「上游有没有」。**

---

## 下一轮最该先拿的（按顺序）

### 1. 那个「0 余量」——它同时挡着 A 组和窄屏门禁

见「别再做的事」第 1 条。当前**唯一一笔能一次结清两边**的账。

### 2. `hit` 那 3 行（飘、Linux-only）

`integrations#permission-request` 三个维度：
`role:button[/^(Request permissions|申请新权限)$/] hit React=self Vue=div`。
截图里**本仓那颗按钮不在可视区**，中心点因此打到对话框外的遮罩上。

**已量到**（本机探针，平台无关的量）：

```
本仓 scrollTop=460  scrollHeight=950  clientHeight=490
上游 scrollTop=411  scrollHeight=950  clientHeight=490
```

**内容度量完全相同**，`maxScrollTop = 460` → **本仓滚到了最底，上游只做最小滚动**。
场景那一步是 `fill` OAuth 输入框，而 Playwright 的 `fill` 会把元素滚进视野。

**已排除**：两边都没有显式滚动代码（`scrollIntoView` / `scrollTop` / `scroll-margin`
零命中）、都没有 `scroll-behavior: smooth`、输入框前后标记逐字等价、
且 run1/run3 就有这 3 行（不是第三十七轮引入的）。

**下一步**：在 `fill` 前后插桩，记录 click Calendar → click Docs → fill 三个时刻的
`scrollTop`，看分岔发生在哪次交互。**别从源码推**——第三十七轮在这类问题上
从源码推了四次，四次都被源码本身推翻。
⚠ 它在 macOS 量不出来，本机回路无效，只能 `parity_only` 跑 Linux。

### 3. 扩取样面

`baseline/parity-route-sampling.json` 是路由坐标系，先看哪些路由取样点最少。
对照场景 id **就是上游 spec 文件名**，想不出对应 spec 就加不了新场景（棘轮会红）。
加新场景要**给它加终态断言**，否则「零差异」可能只是「压根没采到」。

### 4. 三张 pending 表是工单队列

记忆 `deerflow-upstream-features-must-land-in-vue`：上游有的功能 Vue 必须实现。
台账看不见「本仓整个屏都没做」这一类。

---

## 手上的工具（第三十七轮建的，直接用）

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

### 探针三件套（第三十七轮三次靠它定位到根因，都是源码看不出来的）

写一份 `tests/e2e-parity/zz-*.spec.ts`，**用
`runScenario(page, base, scenario, undefined, state)` 把场景跑到位**
（自造夹具会失败），然后在两个应用上各拍一次快照 `console.log` 出来，用完即删：

1. **焦点快照**：`document.activeElement` + 各菜单项 `tabindex` → 定位到账 K；
2. **文本快照**：`JSON.stringify(el.textContent)` + `getComputedStyle(el).font`
   → 照出上游的句首空格；
3. **祖先链**：逐层 `width` / `padding` / `borderLeftWidth`
   → 照出整层漏掉的 `Artifact` 外框。

### 截图归属

`diff.spec.ts` 里 `captureScenario` **先采 Vue、再采 React**，
所以 `test-failed-<2i+1>` 是 Vue、`<2i+2>` 是 React（`i` 是该场景键在
`report.json` 里的序号）。**别按奇偶猜**——我猜反过一次。

---

## ⚠ 第三十七轮我被订正了十次，共同形状只有一个

**「说得通的东西」和读数长得一模一样。** 逐条：

| # | 我拿什么当了读数 | 被什么推翻 |
| --- | --- | --- |
| 1 | 算术（`230/255 = 90.2%` 恰好是 Tailwind `/90` 档） | 下一次 CI 运行 |
| 2 | 源码结构（`CardTitle` 是块级 div → 排除字体） | React 自己的注释：那一列卡在 min-content |
| 3 | **一次运行**（16 → 8 就说根因找到了） | 同一棵树的下一次运行回到 16 |
| 4 | **总数**（16 → 29 就说改坏了） | 逐行比：消掉 7 行伪差异 + 照出 20 行真差异 |
| 5 | 奇偶推断（奇数号截图是 React） | `diff.spec.ts` 的采样顺序 |
| 6 | 把「让红变绿」当「修好了」（往 Vue 塞 `data-slot`） | `invariant-ownership` 门禁 |
| 7-9 | 三次从源码推账 K 的机制 | 那三处**确实逐字相同**，分岔在它们之外 |
| 10 | **又一次单次运行**（run10 的 0 行 → 说 `hit` 随账 K 消失） | run11 回到 3 行 |

**判据**：

- **一次运行是一个样本**——判「修好了」要同一棵树连着量到稳定；判「飘」两次不一致就够；
- **推翻一次实测只能靠另一次实测**，算术和源码结构都只是线索；
- **总数不是读数**——它会被「尺子变准」和「修好差异」两个相反方向同时推动；
- **「源码一样」不等于「运行时一样」**；
- **尺子报出差异时先问：两边用户看到的东西有没有区别**——角色/几何/可达性全同、
  只差一颗内部样式钩子，那是尺子的问题，不是应用的问题。

---

## 跑长命令的纪律

`make e2e-parity` ~25 分钟、`make e2e` ~3 分钟、`make verify` ~4 分钟。
**用 `run_in_background` 起一次然后等通知**，不要开 `while pgrep; do sleep; done` 轮询。
要串行跑多套就写成一条命令（`make a > a.log; echo "A=$?" >> a.log; make b > b.log; ...`）。

⚠ **门禁的退出码要卡住提交**，不能只打印——第三十七轮把 `make verify` 和
`git commit && git push` 串在一条命令里，看到 `VERIFY_EXIT=2` 时已经推出去了。

⚠ **`frontend-vue parity` 的并发组是 `cancel-in-progress`**：run 跑着时推送会把它取消。
纯 docs 提交不匹配 `paths:`，推了既不触发也不取消。
