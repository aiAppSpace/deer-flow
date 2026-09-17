# 新窗口开工：整段贴给下一个窗口

> 这份文件只有一个用途：**新窗口第一句话贴什么**。
> 真正的交接内容在 `vue-parity-cold-start.md` 里，那份是维护到当前事实的。
> 这份不重复它——重复就会有两份会各自过期的散文。

---

读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/plans/vue-parity-cold-start.md` 并按它执行。

先按文档开头那段命令**现场量一遍状态**（git、台账、CI），量完把读数说给我看；
**不要引用文档里的散文当读数**。

然后从「下一轮最该先拿的」第 1 条开始做，**做完自动开下一轮**，一直推到我喊停。
中途不要问「要不要继续 / 提交 / 推送」——提交与推送是 2026-09-06 就给的长期授权
（Claude 记忆 `deerflow-no-midway-questions`），取舍自己定并写进提交说明。

---

## ⚠ 最终判据（2026-09-16 用户重申，比旧文档强，读之前先看这一段）

用户原话：**「最终目的是 vue 版本和 react 版本在功能，体验，交互逻辑，界面上保持
完全一致」**，并追一句「这个才是最终目标」。

同日还给了四句，它们是同一条判据的四个面：

- **不能缩水和打补丁**——对齐要还**根因**，不是让台账那一行消失；
- **该重构重构**——上游那一层结构本仓缺了，就按本仓的分层**补一层真组件**；
- **按业界最佳方案**——两边都不对时取业界做法**两边同改**，不要把本仓改成和上游一样错；
- **不要机械式对齐**——**判据是渲染与行为一致，不是源码字面一致**，两者会给出相反答案。

**底层不同构时可以退让**（用户原话：「如果是因为底层架构有差异，实在不能实现完全
对齐，能最大程度对齐就行」）。**这条要读窄**：允许不一致的只是**实现字面**，
渲染/行为/可访问性树仍按完全一致要求；而且必须拿得出**实测读数**并写**翻案判据**。

判据全文：Claude 记忆 `deerflow-vue-replacement-goal` 与 `deerflow-long-term-top-tier-goal`。

---

## ⚠ 签入基线是 0，但**那是 macOS 的读数**

第三十六轮把签入基线推到 **0 唯一行 / 0 多重集 / 0 条不同的差异**（起点 170 个投影）。
第三十七轮把 `e2e-parity` 接进 CI，**第一次运行就红**——同一棵树在 ubuntu-latest
上量出 **16 行**（run 35143922501）。**边界因此是三重的**，否则新窗口会以为任务结束了：

- 台账只覆盖 **147 个场景-维度**，也就是 `tests/e2e-parity/support/scenarios.ts`
  那份目录。**取样面之外的屏，台账一个字都没说。**
- 覆盖率棘轮现状：**covered 37 / pending 1 / exempt 3**。那 1 条 pending
  （`artifact-table-performance`）**已经有完整判词，别再重新问一遍**——
  它量的是时延，而对照工厂的坐标系是 aria 树 / 几何 / 请求，表达不了时延断言；
  镜像 spec 早就有了。要变，得先有人决定豁免 `/artifacts/view` 这条路由。
- **第三重、也是第三十七轮才量到的一重：当前这台笔记本。** 同一棵树换一台机器
  就是 16 行。第三十六轮那句「本地复量过两次」复现的是同一台机器上的同一个结果
  ——`PARITY_EXIT=0` / 158 passed，而绿只说明**实测与签入基线一致**，
  不说明两个应用一样。
- 所以「0」的正确读法是：**当前这把尺子、在当前这个取样面上、在这台 Mac 上，
  量不出差异了。** 下一步是**判掉 Linux 那 16 行**（下面第 1 条）
  与**让尺子照到更多地方**（扩取样面）。

---

## 下一轮最该先拿的（按顺序）

### 1. 判掉 Linux 上那 16 行 —— **核实已经做完了，答案是红**

> 这一条上一版写的是「去核实那套 CI 接入跑绿没有」，并且写明「跑红了那就是真账」。
> **2026-09-17 核实完毕：红。** 所以这一条现在是那笔真账本身。

`e2e-parity` 已经在仓库里、也已经在 CI 上跑过（`frontend-vue-parity.yml`），
**不要重做**。run 35143922501（commit `98f27946`）的逐步结论：

| job | 结论 | 耗时 |
| --- | --- | --- |
| `parity` | **failure**，`Measure the React-vs-Vue parity ledger` 这一步红 | 24m50s（装配 1m15s + 套件 23m25s） |
| `parity-auth` | success | 4m17s |
| `icon-parity`（在 `parity` job 里） | success | 瞬时 |

套件本身是 **1 failed / 155 passed**，红的只有台账那条：
**Linux 上量出 16 行，而签入基线是 0 行。**

**当前状态：这条工作流是红的，而且应该保持红**，直到逐组判完。
它红着说明它在量东西——本机十四轮没看见的东西，换一台机器一次就照出来了。

**逐组清单与已判/未判写在 `vue-parity-open-accounts.md` 第三十七轮条目**，
那份是当前版本，这里不重复。**同一棵树在 Linux 上跑了三次，结论只能从三次一起读**：

```
run1(无动画等待) 16 行 | run2(有) 8 | run3(有) 16
三次并集 17 行 —— 稳定(3/3) 8 行，飘的 9 行
```

- **稳定 8 行 = 真差异**：A 组 5 行（`integrations` 三个 mobile 档
  `width Δ≈4.1–4.2px`）+ E 组 3 行（`artifact-table-preview` 的 y 偏移
  Δ-18 / -2.1）。三次数值逐字相同。
- **飘的 9 行 = 尺子不稳**：`permission-request` 的 `Docs background` ×3 与
  `Request permissions hit` ×3（只有 run2 干净）、mermaid 的 `PNG background`、
  `POST /api/threads/search`。

**A 组源码层已排除五项**（字体渲染 / 文案 / header 结构 / 图标尺寸 / 按钮基类，
逐条带判据在挂账文档）。按 React 自己注释里那条公式，三项输入都相同，
那 4px 只可能出在**第 2 列 Refresh 按钮的 min-content** 上。

**E 组看截图就看出来了**：表格面板顶上那条警告 **React 折成两行、Vue 排成一行**，
下面整张表因此错开一个行高（~18px）。一条文本折不折行取决于容器宽几个像素。

⚠ **但 A 与 E 合起来有一个还没解开的矛盾，别急着下结论**：

1. 两组**在 macOS 上都是 0**（签入基线 0 行）→ 那个宽度差在 macOS 上小于 2px
   容差、在 Linux 上是 4.1px，**差值本身随平台变**；
2. 随平台变 → 指向**文本度量派生**（min-content / 折行）；
3. **但截图里两侧字形一模一样**，header 结构 / 文案 / 图标 / 按钮基类也逐字相同
   ——找不到让文本量出不同宽度的源头。

再加上 A 与 E **方向相反**（integrations 是 React 更宽，artifact 面板是 React 更窄），
「Vue 一律窄 4px」也不成立。

**所以两组都未判，连「是不是同一个根因」都未判。**
我在这里来回改过两次判词，**两次都是从源码/截图推的，没有一次是量的**。
**别接着推——要的是一次 Linux 上的定点读数**：那几个锚点上
`getComputedStyle(el).font` 两边是不是同一个值、那 4px 落在哪一层盒子上。

**这一族更值得记的形状**：第二十一轮量到 integrations 那张卡在 375px 下
**macOS 恰好 0 余量、Linux 溢出 9px**。本仓有好几处贴着 0 余量，
任何一点度量差都会把它们推过临界。**真正该修的是那个 0 余量，不是追某一次折行。**

⚠ **看截图前先钉归属**：`diff.spec.ts`（`captureScenario` 的两次调用，vue 在前） **先采 Vue、再采 React**，
所以 `test-failed-<2i+1>` 是 Vue、`<2i+2>` 是 React。别按奇偶猜——我猜反过一次。

**飘的那 9 行是 hover 态**（两边 `Button variant="default"` 基类逐字相同、
都写 `hover:bg-primary/90`），起因是两侧滚动位置差 ~110px 让同一个指针坐标
落到不同元素上。`parkPointer` 已把指针在取样前归位。

⚠ **它让台账总数从 16 涨到 29，而那个总数不含信息**——逐行比是
**消掉 7 行伪差异 + 照出 20 行真差异**，两个方向叠加。我按总数判过一次
「它把场景弄坏了」并回退，逐行数据当场推翻。**总数不是读数。**

### 新照出来的行分两类，其中一类是我自己造的

- **不是账**：`branch-thread#turn-actions` 那 6 行。那个场景的步骤**本身就是
  `kind: "hover"`**，第一版 `parkPointer` 无条件归位把它撤销了。
  已改成**场景里有 hover 步骤就不归位**。
- **账 I（真账，未判，要修）**：`thread-history` 两语言各 7 行
  ——步骤是 `click "More"` → `click "Export"`，全是点击、没有 hover，
  而指针移开后 **Vue 的导出子菜单还开着、React 已关**。
  这是**交互逻辑差异**，正落在最终判据上。
  ⚠ **只有一个样本**，下一轮先复现再动手改菜单行为。

### 第三十七轮末尾埋好的两件事，下一轮直接收读数

1. **两边 `body` 的字体栈已对齐**：本仓此前只写前三项、丢了尾部四个
   emoji/符号兜底，上游 html 走 Tailwind preflight 拿的是七项那份。已两边一致。
2. **几何档新增 `fontFamily`**——这是最后一处「文本量得出来、各档都看不见」的盲区。
   下一次 CI 运行会直接回答那个反复推来推去的问题：
   **两个应用在那些锚点上是不是同一套字体栈。**

**为什么这件事是 A/E 的关键**：A 组那 4px 的三项输入（icon 36 / gap 12 / 文本）
源码逐字相同，所以只剩第 2 列 Refresh 按钮的 min-content；
而那颗按钮的 min-content = 内边距 + 图标 + gap + **「Refresh」这串字的宽度**
——**最后还是落到文本宽度上**。E 组那条警告折不折行同理。
所以：`fontFamily` 若报差异，根因就找到了；若两边一致，
说明文本宽度不是原因，再去找别的层。



下一步就是**逐组去量**，而不是继续猜：

> **定点复量的入口已经做好了**（第三十七轮，别重做）：
> `frontend-vue parity` 工作流带 `workflow_dispatch` 输入 `parity_only`，
> 填一个场景 id 就只量那一个（约 4 分钟，而不是 25 分钟）。
>
> ```bash
> gh workflow run "frontend-vue parity" -R aiAppSpace/deer-flow \
>   --ref main-wc -f parity_only=integrations#permission-request
> ```
>
> **读产物，别读颜色**：`PARITY_ONLY` 模式下 `diff.spec.ts` 刻意既不比基线也不
> accept（过滤过的报告里其余场景全缺席，拿去比会像「一大批差异一次修好了」），
> 所以那次 run **一定是绿的**。结论在 artifact `parity-failures` 里的
> `e2e-parity/report.json`——工作流为此把上传条件从 `failure()` 放宽到
> 「失败**或**这是一次定点复量」。


**两条禁止**（判据里点名的打补丁）：

- 不许 `make parity-accept` 把那 16 行录进基线——那是 Makefile 里说的
  「把回归洗白的按钮」，而且其中至少 4 行是尺子自己的噪音；
- 不许放宽几何容差让红变绿——2px 是先定后测的，调它就是把判据改成结论。

### 2. 扩取样面 —— 台账清零之后，新差异只能从这里来

**开新维度/新场景的单位产出在降**（第三十三轮连开两扇零新差异），所以
**别盲开**，按读数选：

- `baseline/parity-route-sampling.json` 是路由坐标系，先看哪些路由的取样点最少；
- 对照场景 id **就是上游 spec 文件名**，想不出对应 spec 就加不了新场景
  （棘轮门禁会红）；
- 加新场景要**给它加终态断言**，否则「零差异」可能只是「压根没采到」
  （第二十轮那条教训：拿到 0 不等于两边一样）。

### 3. 三张 pending 表是工单队列，不是可以停住的账

记忆 `deerflow-upstream-features-must-land-in-vue`：上游有的功能 Vue 必须实现。
台账看不见「本仓整个屏都没做」这一类——它只比两边都到得了的屏。

---

## 第三十六轮留下的两条教训（别重犯）

1. **一处重复请求会把另一处缺陷遮住。** 去掉 `refreshPostRun` 里那次多余的
   `threads.get()` 之后，尺子当场照出 `GET /api/threads/**null**/token-usage`
   ——`refetch()` 绕过 `enabled`，而 `queryFn` 里那个 `!` 假设了 `enabled` 挡得住。
   **「多发一个请求」值得当账还，理由之一就是它会藏别的 bug。**

2. **上一轮判成「架构差异、退让」的，这一轮翻案了。** `thread-title-sync` 那条
   先判「本仓没有第二个查询要收敛」，再查才发现本仓**四处**都在失效
   `["thread","metadata",id]` 而**没有任何查询拥有这个 key**——四处全是空操作。
   **「本仓不需要」和「本仓缺了那一层」长得很像**，判前先 grep 一遍谁在用这个 key。

---

## 量 CI 的两个坑（前几轮现场踩出来的，别再踩）

1. **`head_sha` 必须传全 sha**：传短 sha **永远返回 `total_count: 0`**，
   于是那条命令在任何情况下都会「证明」这个 sha 没被测过。
2. **纯 docs 提交不会有任何 CI run**（workflow 有 `paths:` 过滤），
   所以「HEAD 绿不绿」这个问题本身可能问错了——要问的是
   「**覆盖当前 `frontend-vue` 树的那次 run** 绿不绿」。
   （上一次交接文档在这里写错过：它断言 HEAD 是纯 docs 提交所以没有 run，
   而那次提交同时改了 `frontend-vue/` 下的文件，run 是有的。**现场量，别照抄。**）

```bash
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow
gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git rev-parse HEAD)" --jq '.total_count'
```

`0` 的意思是「这个 sha 没被测过」，**不是「没问题」**。往前找第一个动过
`frontend-vue/`、`contracts/`、`backend/app/gateway/` 的提交，那次 run 才是当前树的结论：

```bash
gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git log -1 --format=%H -- frontend-vue contracts backend/app/gateway)" \
  --jq '.workflow_runs[0] | "\(.head_sha[0:8]) \(.status)/\(.conclusion)"'
```

**一条红会让后面的步骤全部 `skipped`**，所以 job 级结论不够，要看**逐步结论**：

```bash
RID=$(gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git log -1 --format=%H -- frontend-vue contracts backend/app/gateway)" --jq '.workflow_runs[0].id') \
  && gh api "repos/aiAppSpace/deer-flow/actions/runs/$RID/jobs" \
    --jq '.jobs[] | "【\(.name)】\(.conclusion)", (.steps[] | select(.conclusion=="failure" or .conclusion=="skipped") | "    \(.conclusion)  \(.name)")'
```

（`visual-baselines` 恒为 `skipped` 是**设计如此**——它是 `workflow_dispatch` 专用，
见 `frontend-vue-verify.yml` 的 `if:`。别把它当红。）

---

## 跑长命令的纪律（这一轮踩到的）

`make e2e-parity` ~16 分钟、`e2e-backend` ~6 分钟、`verify` ~4 分钟。
**用 `run_in_background` 起一次，然后等通知**——不要再开
`while pgrep ...; do sleep; done` 去轮询：Bash 前台 600 秒超时会把那个循环也变成
一个后台任务，等一次就多一个，最后攒出十几个空转任务。
要串行跑多套就写成一条命令（`make a > a.log; echo "A=$?" >> a.log; make b > b.log; ...`）。
