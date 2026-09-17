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
那份是当前版本，这里不重复。**第三十七轮收工时的 Linux 台账 = 12 行**（run 35196875277 实测，逐行如下）：

| 账 | 行 | 状态 |
| --- | --- | --- |
| **A 组**（`integrations` mobile 宽度 Δ4.1/4.2） | **0** | ✅ **结清**——根因是 `ScrollArea` 的四处基类差 |
| **账 J**（30 行 separator） | **0** | ✅ **结清**——不是应用的账，是尺子的：标签改成「只在重复时才补 `data-slot`」 |
| E 组（`artifact-table-preview` 的 y 偏移） | 3 | 未判。那条警告 React 折行、Vue 不折；那一屏是原生 `overflow-auto`，**不是 ScrollArea** |
| 账 K（菜单多一个 tab 停靠点 / 焦点落点） | 6 | 未判，**机制连猜三次全被推翻**，见挂账文档 |
| `hit React=self Vue=div` | 3 | 未判（run8 是 2 行、run9 是 3 行，**略飘**） |

**起点 16 行 → 12 行**，其间结清两笔、尺子大幅变准。

⚠ **别拿总数当读数**：本轮总数被「尺子变准」和「修好差异」两个相反方向同时推动，
16 → 8 → 16 → 22 → 41 → 11，**没有一次总数单独说明问题**。逐行比才是结论。

### 第三十七轮后半段的读数（**都是量的，不是推的**）

**本机诊断循环建起来了**：`PARITY_ONLY=<场景>` 一次 **2.2 分钟**，全量 CI 一次 25 分钟。
后半段每个判断都是用它量的。

1. **字体被实测排除。** run6 里 `fontFamily` 这一档报 **0 行**——两个应用在所有
   取样锚点上声明的字体栈完全相同（本机 `PARITY_ONLY=integrations` 28 个维度同样
   0 行）。它是声明值、与平台无关，所以两个平台同时成立。
   **「A/E 那 4px 是不是字体」这个我推过三次的问题，到此关闭：不是。**
2. **顺着它挖出一笔独立真账并已修：`ScrollArea` 的基类差四处**
   （`p-px` vs `p-0.5`、`w-2.5` vs `w-2`、少一道透明边框、viewport 少一整组焦点环，
   外加 Root 多一个 `overflow-hidden`）。**滚动条是用户看得见的东西**，
   而它不进可访问性树、也不是台账锚点，**六档一条都不响**。
   路子是顺着门禁自己的豁免走出来的——那条豁免写着「哪天台账在 ScrollArea 所在的
   屏上报出几何差异，就回来逐字对一遍」，而 A 组正好满足。**豁免已退役，门禁通过。**
   ⚠ **它是不是 A 组的根因还不知道**，要 Linux 读数说了算。
3. **`steps: 1` 的瞬移指针造过 12 行伪差异**：菜单库判「收不收子菜单」靠指针经过
   父菜单那串 `pointermove`，瞬移把那条路径整个跳过。改成分步移动后
   `thread-history` 从 14 行降到 2 行（`steps: 4` 与 `12` 读数相同，成本三分之一）。
4. **run7 红的不是差异，是我引入的成本**：diff 那条用例撞了 900s 闸门。
   已按文件自己定的政策「往上提而不是砍维度」提到 1_500_000，
   并先把成本降下来（指针没动过的场景不归位）。

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
