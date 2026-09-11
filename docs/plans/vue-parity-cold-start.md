# 冷启动 prompt：继续 React → Vue 平替的下一轮

> **用法**：新开一个窗口，把下面「开工指令」整段贴进去（或者直接说
> 「读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/plans/vue-parity-cold-start.md` 并按它执行」）。
> 这份文件只写「怎么接手」，**深度背景不在这里**——在下面点名的三份东西里。

---

## 开工指令（整段贴给新窗口）

你接手一个长期任务：把 `frontend-vue/`（Nuxt/Vue）对齐 `frontend/`（Next.js/React），
目标是「移走 `frontend/` 之后 Vue 仍能自足」。仓库在
`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，分支 `main-wc`。

**接手时的状态（2026-09-12 第七轮收工实测，不是估计）**：

- 工作区干净；**本地领先 `origin/main-wc` 三百多个提交、全部未推送**
  （没有收到过推送指令；要推就先问用户）。
- 对照台账 **159 唯一行 / 179 多重集 / 137 个场景-维度**。

**这几个数字会漂，接手第一件事是现场量一遍**（别信这里的散文）：

```bash
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow
git rev-parse --short HEAD && git status --short && git rev-list --count origin/main-wc..HEAD
python3 - <<'EOF'
import json
d = json.load(open("frontend-vue/baseline/parity-diff.json"))["entries"]
rows = {f"{k}·{f}:{x}" for k, v in d.items() for f, r in v.items()
        if isinstance(r, list) for x in r}
print("场景-维度", len(d), "唯一行", len(rows))
k = json.load(open("frontend-vue/baseline/i18n-keys.json"))
print("词典", k["total"], "key /", k["unusedTotal"], "unused")
EOF
```

（`frontend-vue/scripts/parity-ledger-report.mjs` 也能报，但它**要有上一次 e2e-parity
的运行产物**才跑得出来；签入的基线是随时可数的，所以上面直接数基线。）

> **远端布局**（2026-09-09 换过一次家）：
> `origin` = `https://github.com/aiAppSpace/deer-flow.git`（**私有**，工作副本，往这里推）；
> `upstream` = `https://github.com/bytedance/deer-flow.git`（上游，只取不推）。
> 旧文档里出现的 `YanivWang/deer-flow` 是这份工作副本的前身。
> **硬禁令：不要删任何远程 fork**——fork 关系删了建不回来，要换指向用 `git remote set-url`。

## 这个阶段的工作性质（先读完再动手）

**「台账还剩多少行」已经不能当坐标系了。** 第七轮收工时 **159 行逐条都有判词**，
**而且没有一条判词里还带「先怀疑」**。分布极不均匀：**99 行**是
`div[scroll-area-viewport]` 那一笔判过的账（含它在 `tabOrder` 上的投影）、
**20 行**是请求层那两族（`retry` 与抽屉挂载拓扑），
剩下 **40 行**是 tooltip 播报节点、写死英文、焦点落点、以及本仓独有的多账号绑定块
这几类早就判过的。
所以行数涨落本身不说明好坏——**连着三轮它都是因为取样面变大而涨的**：
09-11 新开 `dark` 与 `mobile` 两维（当场量出上游一颗手机上点不到的控件）、
第四轮给 diff 三档挂锚点（当场逼出一处 4px）、
第五轮把 `channels` 的「已连接」那一支接进来（当场逼出「上游的用户解绑不了自己的
IM 账号」）。**每一轮这条方向都有货，而且货比台账上剩下的那些大得多。**

**这一阶段真正有货的是三类**，按性价比排：

1. **把取样面往没人看过的维度开一扇窗。** 2026-09-11 实测：
   - 开 `dark`（只给 `integrations`）→ **零条新差异**，但从此有机器守着
     「固定红 vs destructive token」那一类（浅色下两者**同值**，只有深色才现形）；
   - 开 `mobile`（同样只给 `integrations`）→ **当场量出上游一颗够不着的控件**
     （技能开关在 375px 下 `x=395.5`，手机上点不到）。
   - **129 个场景-维度里仍有 110 个是 desktop**，非 desktop 的只有 `chat`（跑满矩阵）、
     `thread-list-pin#mobile-drawer`、`ui-polish-mobile` 与新开的 `integrations`。
     照同一条纪律（**一个场景补一维就够**，主题/断点/语言三轴正交）继续开，
     是现在最划算的一条。
2. **把「写下来当规则用、却没人守」的话变成守卫。** 这条一直有货，判据见下面 C 节。
   2026-09-11 新增一道：`handwritten-input`（手写 `<input>`/`<textarea>` 绕过
   `ui/input`——在它之前，把 primitive 的基类抄成本地常量不会让任何门禁变红）。
3. **上游的缺陷。** 2026-09-11 那一轮修掉的 16 处用户可见缺陷里**大半在上游**，
   包括一颗叫 "Disconnect"、实际删掉整个部署渠道配置、而且对所有人可见的按钮。
   判据是「修 React 自身缺陷是已授权的例外，做法是两边同改」。

### 第一步：按这个顺序读，不要跳

1. `docs/plans/vue-parity-open-accounts.md` —— **一页纸的挂账总清单**，
   先看「还欠什么」。三分钟读完。
2. `docs/plans/vue-parity-handoff.md` —— **轮次交接文档**，约 4100 行。
   必读：开头的「当前状态 / 门禁实测值」、「下一轮」那一节、
   结尾的「其他常踩的坑」（**270 条**里最近的十几条）。中间各轮的记录按需查。
   **最近二十八轮（101~128）在最前面，先读它们**——这个阶段的方法论都在那里。
3. Claude 记忆 `deerflow-parity-harness-plan`
   （`/Users/wangcheng/.claude/projects/-Users-wangcheng-Documents-workSpace-frontEnd-aiAppSpace-deer-flow/memory/`）
   —— 每一轮的实测记录与 **270 条踩坑线索全文**。同目录下另有
   `deerflow-fork-boundary` / `deerflow-vue-replacement-goal` /
   `deerflow-no-midway-questions` / `deerflow-vue-alignment-scope`。
4. `AGENTS.md`（仓库根）与 `frontend-vue/README.md` —— 命令与门禁。

### 硬规则（违反会白干一轮）

- **默认只改 `frontend-vue/`。** 例外只有一种：**上游自己是坏的**——
  那时按「业界主流做法两边同改」，`frontend/` 与 `frontend-vue/` 同一条提交里改，
  再单独一条 chore 提交把 `frontend-vue/baseline/upstream-marker.json` 推到那条 fix
  （`make -C frontend-vue upstream-accept`）。**动过 `frontend/` 已经是常态**（2026-09-11 那一轮 14 笔里大半都动了它——这一阶段的缺陷大半在上游），
  别传这个数字，用 `git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests` 量。
- **不要中途提问。** 取舍自己定，写进提交说明。分歧的兜底判据是**按业界主流做法**。
- **每轮收工写交接文档 + 一页纸清单 + 记忆，然后自动开下一轮**，
  推到我喊停为止；**不要停下来问「要不要继续」**。
- **台账的规则现在是「新出现、还没定过的行只能减不能增」**，不再是「保持 0」。
  `frontend-vue/baseline/parity-diff.json` 当前 **202 行 / 90 样本**
  （wave 149 把三档里 59/79 行「认不出是谁」的问题修掉，行数没动、可读性归零缺口）
  （wave 148 把三处手搓的模态换成 primitive，233 → 202）
  （wave 147 把移动端侧栏抽屉挂进取样面，+34 行，其中 30 行是同一处模态做法差异）
  （wave 145 把 Tabs 的 variant 体系搬过来，219 → 197；wave 146 伪元素进取样面，
  分栏把手第一次挂成锚点，+2 行——点击区上游 4px / 本仓 16px，本仓更好，已接受）
  （wave 128 / 129 / 132 各接一个后端失败终态，+12 / +6 / +8，逐条有名有姓；
  其中 wave 129 的 6 行与 wave 132 的 6 行都是 wave 128 已判过的 `retry: 3` 在别的屏上
  复现，不需要新决定；**wave 132 那 2 行 `order` 是新决定**——预览失败时本仓选中「代码」、
  上游仍然选中「预览」，保留本仓这一侧）。
  其中 51 行**已决定**（2 行 reka tooltip 播报节点 + 42 行「上游写死英文」+ 7 行焦点），
  **wave 97 把 tab 序那 64 行逐条结清了**（修掉 52 行、接受 2 行），
  剩下那 42 行 **wave 98 也核完了**：差异全来自上游给建议行套的那层
  `Suggestions`（`ai-elements/suggestion`），而**它永远不会真的滚动**
  （内容 `flex-wrap`、横向滚动条写着 `hidden`），**决定不跟**。
  **也就是说：95 行现在全部有名有姓、且都已决定。**两类都在一页纸清单第一节
  逐条交代，各带翻案判据。
  **注意它钉的是「两个应用一不一致」，不是「这一处对不对」**——wave 88 量出
  22 颗按钮两边都缺 `aria-pressed`，三档全是 0 行。接上一块新表面之后，
  要另问一句「这一块本身对不对」，并把答案钉进**各自**的用例里。
  `make -C frontend-vue parity-accept` 现在会逐行比对、有新增行就拒写；
  确实要接受得 `PARITY_ACCEPT_GROW=1`，并在提交说明里逐行交代。
- **先量再改。** 这个项目已经十几次证明「形状看着像上次那处」会改出新差异来。
  改之前先让尺子报出读数，改之后复量，两组数都写进提交说明。
- **负向验证**：每条改动逐条变异（`cp` 备份 → 改 → 只跑相关用例 → `cp` 回来 → `diff` 确认），
  结果做成表格贴进提交说明。**假绿要如实写进去。**
- **长内容给文件不要贴进对话**（这是我的全局约定）；回答里给绝对路径。

### 工作循环（一轮 = 一个 wave）

1. 从「还没接的交互态」或三个方向里挑一件（见下）。
2. **先量**：给对照取样面加锚点 / 跑现成的尺子 / 写探针，拿到读数。
3. 归因到**根因**，不要逐行修表象（历轮经验：N 行差异通常归到 2~5 处根因）。
4. 改，复量。**注意台账的目标不是 0**，是「新出现、还没定过的行只能减不能增」
   （见下面硬规则那一条）；每一行要么修掉、要么有名有姓地进一页纸清单并写翻案判据。
5. 跑收工门禁（下面那张表**逐条真跑**，不要抄上一轮的读数）。
6. 提交（fix / chore / docs 分开），更新交接文档 + 一页纸清单 + 记忆。
7. **直接开下一轮。**

### 收工门禁（命令与上一轮实测读数）

> **节奏（用户 2026-09-07 要求改的）**：**不再每轮跑全套**。
> **每轮仍跑** `e2e-parity`（**它就是「先量再改」那把尺子，不能省**）+ `vitest run tests/unit`
>
> - 该场景的定向 e2e；**每 3~4 轮跑一次下面这九条全套**，**批不超过 4 轮**
>   ——批里某一轮引入的回归要到批尾才发现，红了就在批内二分。
>   **硬规则没变**：改动前后各一次读数、负向验证逐条做、收工文档与记忆每轮写。

```bash
# 2026-09-12 第七轮收工实测（每一条都是那一轮真跑出来的，不是抄的；
# 第七轮只动 frontend-vue/，跑了 verify / e2e-parity / e2e-mock 三条，
# 其余读数是第五轮真跑的，那一轮九条全绿）
make -C <abs>/frontend-vue verify         # exit 0；321 文件 / **2642** 单测；词典 1139 key / 15 unused；产品 SFC 267
make -C <abs>/frontend-vue e2e-parity     # **145 passed**（整条 16.8 分钟）
                                          #  台账 162 唯一行 / 182 多重集 / 137 场景-维度
                                          #  （此处此前写「3 passed」——那是只跑 diff.spec.ts 的数字，
                                          #    整个套件还有 scenarios.spec 的每场景-维度一条 + topology）
make -C <abs>/frontend-vue e2e-mock       # 318 passed（273 + 22 + 15 + 2 + 6）
make -C <abs>/frontend-vue e2e-backend    # 22 passed（2+5+2+3+3+5+1+1；需要 backend 的 uv 环境）
make -C <abs>/frontend-vue parity-accept  # 只能让台账变短；要变长得 PARITY_ACCEPT_GROW=1
                                          #  并在提交说明里逐行解释
make -C <abs>/frontend-vue standalone-sim # exit 0（跑过 15 / 未跑 5 / 红 0）
make -C <abs>/frontend-vue e2e-visual     # 8 passed（只有 -darwin 基线，本机门禁）
make -C <abs>/frontend-vue asset-budget   # exit 0（第五轮查清是存量并重定预算，四条依据写在脚本注释里）
make -C <abs>/frontend-vue icon-parity    # exit 0、**0 处待核**（第五轮把 `Unplug` 那处从根因清掉）
make -C <abs>/frontend-vue audit          # 棘轮（wave 202 起分诊在 baseline/audit-triage.json）；
                                          #  实测 exit 0，20 条 / 7 个包逐条表过态
make -C <abs>/frontend-vue e2e-external   # 3 passed（不在任何聚合入口）
```

> **第四轮踩出来的一条教训，留在这里**：上面这块读数**本身也会过期**，而且过期得
> 毫无迹象——第四轮逐条真跑之前，`asset-budget` 与 `icon-parity` 两条都记着
> exit 0 / 0 处待核，实际一条红着、一条挂着一处待核（第五轮已把两条都结清）。
> **九条全跑一次比抄一次贵得多，但也只有它算数。**

**动过 `frontend/` 就必须加跑 React 三条**（这一阶段几乎每轮都会动它）：
`python3 scripts/pnpm.py --dir frontend check`（0）/ `test`（**1354**）/
`test:e2e`（**189 passed**，2026-09-12 第五轮实测；要用 3002 端口的绕法，
写在交接文档「React 的 test:e2e 绕法」那一段。实操上不必自己 `next build` +
`next start`——直接 `PLAYWRIGHT_BASE_URL=http://localhost:3002 SKIP_ENV_VALIDATION=1
pnpm exec playwright test`，config 会照这个 URL 的端口自己起 webServer）。

**一轮的典型节奏**（2026-09-11 那轮 14 笔提交都是这么走的）：
`PARITY_ONLY=<场景id> make e2e-parity`（约 5 分钟，单场景 + 两侧完整请求序列转储）
量一次 → 改 → 再量一次确认 → 然后才跑
`verify` → `e2e-mock` → `e2e-backend` → `parity-accept` 全套（约 40 分钟）→ 提交。
**别跳过单场景那一步**：它 5 分钟换掉一次 40 分钟的盲跑。

**读门禁输出不要只 grep 最后一行**（wave 111）：`icon-parity` 的 stale 警告
（`⚠ VERIFIED 表里这几条已经不再出现`）在「共 0 处待核」**上面**，而它此前只
`console.log`、不影响退出码——于是那三条过期豁免从 wave 87 起一直在报，
连着几十轮被记成「不报 stale」。现在它会让退出码变成 1；**但这条教训是通用的：
一句要靠人眼读的断言等于没有断言。**

**`icon-parity` 一定要用 `make -C` 跑，并且读输出**：直接
`node frontend-vue/scripts/icon-parity.mjs` 在仓库根下按 cwd 找不到 `../frontend/src`，
会打一句「跳过」然后 **exit 0**——那一行「0 处待核」看起来照样成立（线索 239）。

（React 那三条写在上面的门禁块里，读数以那里为准。`test:e2e` 要用 3002 端口的绕法，
写在交接文档「React 的 test:e2e 绕法」那一段。）

产品 SFC **267 / 总 269**（2026-09-12 实测；数字由 `I18N_INVENTORY.md` 与
`tests/unit/i18n/source-guard.test.ts` 双向钉住，别抄这里的散文——以那两处为准）。
新增 SFC 要同步改三处：`source-guard.test.ts` 的 `toHaveLength`、
`I18N_INVENTORY.md` 的两句、`tests/architecture.test.ts` 的 `l2Files`（按字母序）。

### 跑门禁的操作纪律（都踩过）

- 长门禁**丢后台**，`> file 2>&1`，**不要接 `| tail`**（管道会缓冲到命令结束）。
- **写文件的命令不要和长任务一起丢后台**（线索 259）：那次改文件的断言失败了，
  traceback 被后台吞掉，下游拿 `undefined` 比 `undefined`，报出一个看起来很干净的
  「0 行」。写完立刻回读确认，或者拆成两条命令。
- **等后台门禁收工要锚在行首**：`until grep -qE '^ *[0-9]+ (passed|failed)'`。
  裸 `grep -q "passed"` 会被 Gateway 横幅里的 `authentication is bypassed` 骗到，
  在一条测试都没跑的时候就退出（线索 240）。更稳的是命令末尾追一行
  `echo "EXIT=$?" >> <log>`，然后等 `^EXIT=`。
- **`run_in_background` 就不要再加 `nohup … &`**——被追踪的是外层 shell，
  会立刻假报 "completed (exit 0)"，而真活还在跑（线索 227）。
- **量退出码不要接管道**：zsh 没有 `${PIPESTATUS[0]}`，`cmd | head` 之后的 `$?` 是 head 的（线索 228）。
- **重定向之前先 `mkdir -p` 目标目录**，否则整条命令根本没跑而退出码是 1（本轮踩了两次）。
- **同一时刻只能有一个后台门禁任务**（Nuxt 构建锁）。
- 写文件一律用绝对路径并回读确认；`cd X && …` 在 cd 失败时整条链不跑而退出码是绿的（线索 208）。
- **`prettier --check <被忽略的文件>` 照样打印「All matched files use Prettier code style!」**
  ——**零个文件匹配也是这句话**（线索 261）。`baseline/` 在 `.prettierignore` 里，
  理由写在那份文件开头（prettier 折短数组、生成器不折，两边都格式化会让 `*-check` 门禁红）。
  **改 baseline / 生成物时，底稿用 `git show HEAD:<path>` 的原文、只替换要改的那一行**，
  改完看 `git diff --stat`——**行数不对就是碰到了不该碰的东西**。
- **按前缀找行要断言只命中一处**：`"chat-thread-init-ordering"` 在 `pending` 数组里也出现，
  按前缀找会先命中它，插错位置（线索 261 同一轮）。
- **传位置参数之前先把签名读出来**（线索 260）：`captureScenario(page, base, scenario,
dimension, state, settleMs = 700)` 的**第 6 个参数是 `settleMs` 不是 timeout**；
  传错不会报错，只会让实验安静地测别的东西。**一个「恰好等于你填的那个数」的输出，
  永远值得停一下。**
- **给失败接一个兜底子句，等于把失败改写成成功**（线索 270，wave 107 踩的）：
  `cmd > /tmp/x/log 2>&1; echo "EXIT=$?" >> … || { mkdir -p /tmp/x; }`——目录不在，
  重定向失败、整条命令没跑，而 `||` 把非零退出码吃掉，于是后台报「exit 0」、
  日志是空的。**`||` / `; true` 只能接在「失败无所谓」的命令后面。**
- **断言一个 URL / 一屏之前，先量一遍它停不停得住**（wave 107）：
  `auth-contract.spec.ts` 的断言钉在一个**应用本来就要离开的中间态**上
  （`next` 落点是夹具里不存在的线程路由，工作区立刻换成 `/workspace/chats/new`），
  表现出来就是「偶尔红」。探针写法：`page.on("framenavigated")` + 每 250ms 采一次、
  打印整条轨迹。**停不住就换落点，别加进抖动名单。**
- **变异实验的还原一律用备份文件逐个 `cp` 回去，不要 `git checkout -- <目录>`**
  （线索 269，wave 106 踩的）：那条命令按 HEAD 还原，**会把本轮尚未提交的改动一起冲掉**。
  在一棵有未提交改动的树上，它不是「还原变异」，是「回滚这一轮」。
- **凡是「扫源码找某个串」的守卫，先问「我自己这份文件里有没有这个串」**（线索 267）：
  wave 104 那条检查写成 `/writeFileSync|.../`，而扫描面包含守卫自己，
  于是匹配到自己那段正则的源码而**假绿**。改成 `["write","FileSync"].join("")` 才真红。
- 「测试红了」第一步永远是分「用例过期」还是「产品回归」，两者修法相反。
- 遇到疑似抖动：**先证因果**——干净树连跑 N 次、`git stash` 之后再跑、
  只还原可疑的那一个文件再跑。
- **复现「偶尔红」有两把旋钮，先便宜的后贵的**（wave 108 + 114）：
  ① **CPU 节流**（便宜，只压浏览器）——`newCDPSession` + `setCPUThrottlingRate`；
  ② **真负载**（贵，压整台机器）——`for i in $(seq 1 8); do (sh -c 'end=$((SECONDS+260));
while [ $SECONDS -lt $end ]; do :; done' &); done`，**自限时、跑完 `pgrep` 确认为 0**。
  **wave 114 实测：节流复现不了的，真负载能**（第六条抖动 70x 节流全绿，
  真负载 load~13 就 1/10 红）。负载会滞后，两组对照之间要等 `uptime` 落下来，
  否则又是一次被混淆的比较（wave 112 的教训）。
- **遇到「偶尔红」先用 CPU 节流复现，别换个时间重跑**（wave 108）：
  `page.context().newCDPSession(page)` + `Emulation.setCPUThrottlingRate({ rate: 30 })`。
  **两类的区分判据**：把机器调慢，失败点会不会移动——「断言钉错对象」那类调慢了
  照样红在同一个语义上（它等的东西永远不来，wave 107 那条），「预算不够」那类是
  「等的东西来了，只是晚了」（wave 108 量出第四条就是这一类，5s 预算用掉 77%）。
  **默认 expect 预算 wave 108 已从 5s 提到 10s**（`tests/support/playwright-factory.ts`），
  wave 109 又清掉了 spec 里最后 7 处写死的 `timeout: 5_000`（那是旧默认值的回声）。
  **但 wave 109 也证伪了这把旋钮的通用性**：#5 在 60x、#6 在 70x 节流下都还是绿的
  ——它只模拟「页面脚本慢」，模拟不了「服务端也慢 / 进程被抢占」。**别当通用复现器。**
- **「hover / focus 触发 + 延时打开」的浮层，不能用一次 `hover()` 加一条等待**
  （wave 113，第六条抖动的根因）：Reka 的 tooltip 安静时也要**约 600ms 持续悬停**，
  那个窗口里任何一次重渲都会卸载 trigger、吃掉计时器，而鼠标没再动，
  `pointerenter` 就永远不来——症状是 `element(s) not found` 等到超时，
  **而 `hover()` 那一步不报错**。写法用
  `expect(async () => { await x.hover(); await expect(tip).toBeVisible({timeout: 2_000}); }).toPass()`。
  **已知抖动因此从七条减到六条。** 本仓还有几处同形的（`mode-hover-guide`、
  `sidebar` 的「Feature not enabled」），没复现过、先不动，红了先按这条查。
- ~~**第六条抖动现在有复现条件了**（wave 112）~~ —— **wave 113 已修**，下面留作病史：
  **跑完四个 e2e 套件之后立刻单跑它**，`--repeat-each=10` 实测 **3 失败 / 7 通过**；
  机器安静时两次都 10/10。**「红过一次」那个记录严重低估了它**，而 CPU 节流
  复现不了（wave 109 实测 70x 仍绿）。**下一轮值得正面查它。**
  顺带一条方法教训：那一轮差点把「旧 5s vs 新 10s」读成因果，
  **两次测量的负载不同，那组对照是被混淆的**——比较之前先看 `uptime`。
- **已知抖动现在是七条**，第七条是 wave 102 新加的，**与前六条不同类**：
  `tests/e2e-settings/settings.spec.ts:275`（12 路并发 `POST /api/memory/import`
  期望每个都是 200 或 409）。前六条都是「异步 / hover / 滚动 + 固定超时」，
  这一条是**并发竞态下的状态码分布**。遇到它先看失败消息里那行
  `12 路并发 import 的实际状态码：[...]`（wave 102 补的），**不要直接重跑**。

---

## 上一轮（2026-09-12 第七轮）做了什么，下一轮从哪接

**台账上最后一条判词里带「先怀疑」的行结清了，而它底下是一颗点了会失败的按钮。**

`chat-thread-init-ordering` 的 3 行 `button "Edit and rerun"`：backlog 的假设
（「上游的 `thread.isLoading` 一直为真」）**被探针证伪**——上游那四个闸门全是开的，
唯独 `latestEditableHumanMessageId` 是 `null`。两边消息组逐条相同，只差第二条
human 的 `id`：上游 `null`、本仓 `values-0`。

来路：两边 POST 的 `input.messages` **逐字相同、都不带 id**，差的是 `stream_mode`
（上游没有 `"values"`，本仓有）。本仓的 `reduceValues` 给没有 id 的 `values` 消息
按位置编了一个键，**而它随后就坐在 `AgentMessage.id` 上**。
「编辑并重新运行」要把 id 交给 `POST /runs/edit-regenerate/prepare`，
`values-0` 服务端解析不了——**本仓画的是一颗点了会失败的按钮**。

修法只动 `frontend-vue/`：前缀与判据收进 reducer 一处导出，调用点用它挡。
读数 5 → 2 行。负向验证三条全红。

**下一轮最该先拿的（按顺序）**：

1. **继续给「整页」形状补窄屏**（第六轮那一页恰好是干净的，不代表这条方向空了）。
   还没被窄屏看过的整页：`project-detail`、`agents` 画廊（`agents-feature-disabled`）。
   **判据别只看「有没有开过这一维」，先问「这一页在 375px 下有没有东西会挤出去」**
   ——表单密、动作列长的那几屏优先。
2. **`ui/input-group` 没有移植**：三个 composer（`ChatComposer` /
   `AgentBootstrapComposer` / `SidecarPanel`）的输入框上游走
   `PromptInputTextarea → InputGroupTextarea → <Textarea>`，本仓整块外壳是手写的。
   工单在 backlog。**注意这是高流量组件**，动它之前先确认台账上它现在是 0 行。
3. **方向 C（把散文里的断言变成守卫）**：冷启动文档下面那一节列着还没筛的几条。
   这一阶段它一直有货，只是排在「开取样维度」后面。

### 第七轮踩出来的两条

1. **「还剩一种可能没测」这种话，下一轮要当假设撞，不要当结论用。**
   backlog 里那句假设写得很具体（`thread.isLoading` 在 SSE 关掉前一直为真），
   **听上去已经查过一半**——实测一打就翻。探针花了不到十分钟，
   而这条账挂了很多轮，**贵的从来不是量，是不量**。
2. **一个客户端为了对齐而编出来的 key，一旦坐进 `id` 字段，下游就再也认不出它是假的。**
   这一处的形状是「存储键 ≠ 服务端 id」，而两者在类型上完全一样。
   判据：**凡是「没有就编一个」的 id，都要问一句「下游有没有人拿它去请求服务端」**。

### 第六轮踩出来的一条（仍然有效）

**一个判词里的「支撑理由」和「结论」要分开验。** `thread-list-pin#mobile-drawer`
那条的结论（不跟）到今天仍然成立，而它下面那句「本仓做的网络工作严格更少」
**被新开的一维直接量翻了**——那句话只在「抽屉被打开过」这个前提下成立，
而那个前提在手机上是少数情况。**写判词时把前提写出来**，否则下一轮读到的是一句
听上去无条件的结论。

### 第五轮踩出来的两条（仍然有效）

1. **「台账 0 行」要先问「夹具把这一支喂空了吗」。** `channels` 报 0 行不是因为两边一致，
   是因为 `{ connections: [] }`——**已连接那一整块两个应用都没渲染过**。
   这是「量不出差异 = 这些取样点上量不出」那句话的最便宜的一种反例，
   而且**一查一个准**：夹具里的空数组/空对象就是线索。
2. **变异必须保持文件可编译**（wave 69 那条，这一轮又踩了一次）。
   把渲染条件写成 `{false && … ? … : null}` 之后 Next 构建直接失败，
   报出来是 `Process from config.webServer was not able to start`——
   **那不是「用例红了」，是用例根本没跑**。换成把条件反过来才拿到真红。

### 第四轮踩出来的四条（仍然有效）

1. **否定结论同样要先证明变异生效。** 上一轮那张「四条死路」表的第四条
   （「给 ScrollArea 加 `[&>div]:block`，读数 86 → 86」）是**假阴性**：Radix 把
   `min-width:100%; display:table` 写成**内联样式**（`dist/index.mjs:130`），
   Tailwind 生成的普通 CSS 规则顶不掉它。**那次变异从来没生效，读数不动什么都没证明。**
   「我这一步真的生效了吗」此前只用在**拿不到东西**的探针上，这一轮证明它对
   **「量到了、但没变化」**同样适用。
2. **一档尺子报 0 行，先问「这一块有锚点吗」。** 上一轮给 diff 三档补 `dark:` 变体时
   台账零反应，看着像「修法不影响对照」，实际是那一整块面板只有一个 heading 锚点。
   补上锚点当场报出一处存在很久的 4px。
3. **`getByText("字符串")` 是大小写不敏感的子串匹配**，会把外层容器一起匹配上，
   而 `sampleGeometry` 取 `.first()`——于是量到的是整块而不是那一行。
   文本锚点一律写**锚定整行的正则**。
4. **「两边都坏、坏法不同」台账只报得出「不一样」。** 窄屏那两簇就是：上游让
   shrink-to-fit 把面板撑出栅格，本仓把内容裁掉，两种坏法各自自洽。
   **接上一块新表面之后那一句「这一块本身对不对」，要靠各自的用例回答**，
   而且断言要把两种坏法都盖住（这一轮写成 `panelOverflow` + `cardOverflow` 两个读数）。

### 一条方法学（第四轮最值钱的）

**先量 min-content，再谈内边距。** 窄屏溢出的形状是「可用宽度 < 内容的固有最小宽度」，
而 `getBoundingClientRect()` 量到的是**已经被压过的结果**，两边都看不出谁在撑。
探针写法：`el.style.width = "min-content"` 量一次再还原，逐层打印——
一屏之内就能读出「撑宽面板的是哪一颗按钮」。
**顺带一条**：`overflow-wrap: break-word`（Tailwind `break-words`）**不减小 min-content**，
所以「加了 `break-words` 就不会撑宽」是错的；能减小的是 `overflow-wrap: anywhere`
与 `word-break: break-all`。

## 下一轮可以挑的活（按性价比排）

### A. ~~给取样面接互斥的交互态~~ —— **wave 93 起这张表是空的**

wave 86/87/88/90/91/93 逐个做完：`integrations` 的权限面板与换应用表单、
`channels` 的两条连接对话框分支、`branch-thread` 的悬停动作条、
`thread-history-mermaid` 的下载菜单。最后一条「`chat` 的 composer 菜单」
wave 93 查明**是过期的**——四个能展开的控件都已经在取样面里，只是挂在别的场景上：

```
斜杠建议    → sidebar 的 fill 步骤（那个场景明写着不能有 click）
模型选择器  → agent-chat
模式菜单    → user-message-plain-text（桌面）+ ui-polish-mobile（移动端）
推理强度    → workspace-changes#reasoning-menu
```

`addAttachments` 是操作系统文件对话框，取样够不着。

> **⚠️ 这一节的结论 2026-09-12 第五轮被部分推翻了**（保留原文，按「就地标注」的规矩）。
> 原话是「别再从这条方向找活了」，而第五轮正是从这条方向找到这一阶段最大的一处缺陷。
> **被推翻的是那张表的坐标系**：它数的是「哪些控件点一下才出现」，
> 而漏掉了另一种同样常见的「没取样」——**夹具把某一支喂空了**。
> `channels` 场景的 `{ connections: [] }` 让「已连接」那一整块两个应用都没渲染过，
> 台账因此对它报 0 行。**新判据：一个域收工前，除了问「哪些东西点一下才出现」，
> 还要问「这个域的夹具里有没有空数组 / 空对象」。**

### B. 给现成的尺子加一档

`icon-parity`（wave 75）、几何锚点（wave 76）、`states` 轴（wave 87）、
`opacity` 与 `hover`（wave 91）、`focus`（wave 94）都是这么来的。
**一把新尺子最先要量的是它自己**：任何输出 0 的工具，都要能回答「这个 0 是算出来的、
还是没算」；而任何输出**很多行**的新档，先问「其中几行是它自己造的」——
wave 94 的焦点档第一版 17 行里有 **10 行是描述器的噪声**。

**「天生看不见的八类」现在少了两类半**：第⑧类（焦点）wave 94 补完，
第④类的**顺序**那一半 wave 95 补完（层级那一半仍看不见）。
**tab 序 wave 96 也补完了；第④类的「层级」那一半 wave 99 量完判定不必做**
（**⚠⚠ wave 123 已把这条归因推翻：保住缩进重量，6 行**。原存疑：：归一化的 `\s{2,}` 把每层缩进都塌成一个空格，
7692 行里命中 6698 次——**层级信息在那一步就没了**，wave 99 量到的 0 也可能只是
「数据不在」。真要做得先让 capture 另存一份带缩进的。）
（序列化的树里「换爹」必然「换位置」，`order` 那一档先撞上——实测过）。
**wave 100 又补上「命中测试」**（锚点中心的 `elementFromPoint`），
它同时覆盖了 `pointer-events` 与「被别的东西盖住」这两件事。
**方向 B 的存量到此基本见底**；名义上只剩滚动位置，而那是**故意不比**的
（见 capture.ts 文件头）。
**加之前先按坑 258 问一句：有没有一种变异能让它响、而现有的档都不响？**
举不出来就别加（层级那一档就是这么被撤掉的）。
再问「它是不是真的几档都看不见」，加完先问两句：
**「其中几行是它自己造的」**（wave 94：17 行里 10 行是描述器噪声）与
**「其中几行是别的档已经报过的」**（wave 96：114 行里约 48 行是重复，线索 255）。

### C. 把「写下来当规则用、却没人守」的话变成守卫 —— **一直有货，但 2026-09-12 起排第二**

> 排序见本文件开头「这个阶段的工作性质」那一节：**第一位是「把取样面往没人看过的维度开一扇窗」**
> ——2026-09-11 开 `mobile` 当场量出上游一颗手机上点不到的控件，开 `dark` 则给
> 「固定红 vs destructive token」那一类装上了守卫。下面这一节的方法本身没变。

wave 83/84/85/89 证明过一次，**wave 101~105 又连着五轮证明**：这个阶段的缺口
几乎全是这个形状。**判据三条**，缺一条就别急着补表：

1. **「哪一行代码读它」** —— 没人读的声明，改错了不会有任何门禁变红。
2. **「这把尺子能不能自证盖全」** —— 扫描面漏一块，判据就由一个看不见新东西的
   数字撑着（线索 229）。
3. **「这条规则要不要豁免表」** —— 要豁免表，多半是判据没选对（线索 180）。

**wave 105 又磨出第四条，专门用来筛硬编码表**（线索 268）：

> **一张表把全集切成两半，而另一半的处理方式是「不检查」吗？**
> 是 → 缺口；不是 → 别动它。

按这条筛过的结论**别再重筛**：`VERIFY_STEPS`（doc-facts）已经是「逐个等于 verify
的先决条件」，双向；`ROOT_MAKE_TARGETS`（doc-references）**不声称覆盖全集**
（根 Makefile 几十个目标、文档只提 5 个），给它加反向校验反而是错的。

**已经做掉的**：

- wave 104：`baseline` 的 `HAND_MAINTAINED` 只查一半 → 补 `GENERATED`，
  两张表恰好划分 `baseline/*.json`，且「这份是生成的」也要能被撞
  （生成器真的存在、真的提到它、真的有写调用）。
- wave 105：`file-header-claims` 的 `SCAN_ROOTS` **漏掉 `tests/` 一整个目录**
  （195 份带 `【主要导出】` 头的文件一份没扫过，占当时扫描面的 73%），
  扩面当场报出 13 处；并补 `EXCLUDED_ROOTS`，
  **`SCAN_ROOTS ∪ EXCLUDED_ROOTS` 恰好等于 checkout 的顶层目录**。
- wave 106：把判据扫到 `app/` 与 `packages/`，**五处全中**——
  ① agent-core 的 ARCHITECTURE.md 里五句「数量词 + `：` + 反引号清单」的枚举，
  **只有一句是双向钉着的**（两句只查一半、两句没人钉）；取样面改成从文档**算**出来，
  与登记表恰好一一对应；② `file-header-claims` 自己的头还写着 wave 105 已推翻的政策；
  ③ settings 的分区表与联合类型两处各写一份（改成从表推类型，分叉不可能存在）；
  ④ `gen-contract-constants.mjs` 的「唯一阻断的一层」只对点名的三份契约成立；
  ⑤ **唯一的活违规**：`【主要导出】` 里写「等 N 个」的 9 份文件，
  `app/core/threads/utils.ts` 写着「等 8 个」而实际 9 个，从 2026-08-31 起全绿至今。

**wave 129 又磨出第五条，专门筛「锚点」这类东西**（线索 274）：

> `.first()` 让「锚点」有两种意思——**「等到它出现」**和**「量它的几何」**。
> 一个匹配到多份的锚点，两件事都落在第一份上，而注释往往说的是另一份。
> **加锚点时问两句：它在每个维度上都成立吗、它在这一屏上只有一份吗。**

**wave 130 现成的两件活（都已量到读数，直接接着做）**：

- ~~给 artifact 造一份「产物来自 artifacts 列表」的夹具~~ —— **wave 132 做完了**，
  而且**不需要新夹具**：`artifact-batched-stream` 本来就是那条分支
  （「会第一次让 Select 分支进取样面」那句话是错的，已订正）。
  接下来还能接的同形失败分支，判据用 wave 129 订正过的那条（**grep 渲染点、不是词典**）：
  `channels` 的连接失败、`workspaceChanges.loadFailed`（本仓 `WorkspaceChangesBadge.vue:103`；
  上游 `frontend/src/core/workspace-changes/api.ts:29` 抛的是硬编码英文，
  **先确认上游把它渲染在哪**，没有渲染点就是本仓独有的分支，别接）。
- ~~逐个看另外 6 个「匹配数 > 1」的锚点~~ —— **wave 131 做完了**：8 个全部有定论，
  **3 个是缺陷（都修了）、5 个是正常的多份**。判据留在场景目录的注释里：
  **加锚点时问三句——它在每个维度上都成立吗、它在这一屏上只有一份吗、
  如果不止一份那几份是不是同一个东西。**

**还没筛的（下一轮可以从这里挑）**：

- **以「后端」为全集的两张表**：`app/core/agent-deerflow/run-protocol.ts` 的
  `DEERFLOW_DURABLE_STATUS`（头里写着「Gateway 的 durable run status 全集」）与
  `event-map.ts` 的 `DEERFLOW_WIRE_EVENTS`（「当前 Gateway 会发出的 wire 事件名全集」）。
  wave 106 逐条量过，**当前都对**（前者与
  `backend/packages/harness/deerflow/runtime/runs/schemas.py` 的 `RunStatus` 六个成员一致），
  但没有任何机器在对。补守卫要把 `backend/` 拉进 `make verify` 的读取面——
  **代价先想清楚**，现在跨目录读的只有 `contracts/` 与 e2e 那边的 replay 夹具。
- **其余 baseline 的 `$comment` 里的断言**：`i18n-keys.json` / `parity-diff.json` /
  `upstream-marker.json` 三份只有 `$comment`、没有 `$readers`（它们是生成物，
  按约定 `$` 开头 = 纯说明、没人读是正常的）——但**说明里的断言仍然会烂**，
  判据是「这句话现在还成立吗」，不是「有没有人读」。
- **各文件头「实测过、做不到」的结论**：wave 95 量过一次，**货很少**
  （全仓 10 处，多数是过去式的历史说明）。**别再照旧文档追这一条**，
  除非有新的形状。**但 wave 106 撞到一个新形状值得记**：
  「**这一档尺子看不见 X**」这类话会因为**后来给尺子加了那一档**而失效——
  `settings-query.ts` 那句「顺序天然测不出来」自 wave 95 起就不成立，
  实测把两个分区对调，`order` 档当场报 8 行。
  写着「台账看不见 / 只能靠人」的地方，先对一遍现在有哪些档。

**wave 106 按判据筛过、判定不是缺口的（别再重筛）**：
`shared/showcase.ts` 三张表（已与 `public/demo/threads/` 双向逐文件比）、
`config/routes.ts` 的 `csrRoutes`（**不声称覆盖全集**，同 `ROOT_MAKE_TARGETS`）、
`SUPPORTED_RUN_STREAM_MODES` ⊃ `THREAD_STREAM_MODES`（白名单本来就更大）、
`SECTION_ICONS` 与 i18n `settings.sections`（tsc 已双向管住）、
各种扩展名 / 协议 allowlist（全集无限，不是「另一半没人查」）。

### D. ~~挂着的账~~ —— **wave 101/102/103 全部处理完，这一段空了**

一页纸清单「真正还开着的」现在是 **5 条**，且**全部是「已决定 / 够不着」**：
覆盖率棘轮的 pending 1 条（wave 101 按判据量到底，**不翻案**）、
tooltip 播报节点 2 行（reka-ui 内部，够不着）、
42 行「上游写死英文」（决定保留本仓翻译）、7 行焦点差异（已钉住）、
42 行 ScrollArea（wave 98 核完，决定不跟）。
**每条都带翻案判据，写在一页纸清单第一节。没有需要动手的。**

## 别忘了的三件事

- **台账当前是 95 行 / 73 个取样点**（此处原写「0 行 / 40 个取样点」，wave 101 订正——
  那是 wave 87 的数字）。**「量不出差异」的准确含义是「这些取样点上量不出」**，
  不是「两个应用一样」；而 95 行**全部已决定**，规则是「新出现、还没定过的行只能减不能增」。
  天生看不见的八类列在交接文档里（第⑧类、第④类的顺序那一半、tab 序都已补上）。
- **这条尾巴没有自然终点。** 历史命中率：**wave 107 捞出一处「静默跳过」
  （HEAD 的守卫在被守的文件挪走之后 11 条全绿）+ 一条钉错对象的 e2e 断言**、
  wave 75 捞出 6 处、wave 76 捞出 27 处、
  wave 82 捞出一个两个应用都存在的产品缺陷、wave 83 证伪了验收判据自己、
  wave 86 捞出 16 行、wave 87 捞出 7 行、**wave 105 捞出一个漏扫 195 份文件的扫描面**、
  **wave 106 一轮捞出五处守卫缺口（其中一处有活违规）并推翻一句当规则用的话**。
  **什么时候收是停止规则问题，不是能算出来的轮数。**
- **你写下的归因，下一轮可能被你自己推翻——那是正常的，但要就地标注、不要抹掉。**
  wave 101 把一处「Loading…」归到 `LoadMoreHistoryIndicator` 并据此挂了一笔账，
  **提交、推远端之后**，wave 102 才查明那是 Next 自带的路由播报器
  （shadow root 里的 `#__next-route-announcer__`，1×1 裁剪，屏幕上根本没有东西在转）。
  做法：**在原处划掉并写明「⚠️ 这段归因是错的，wave N 已推翻」，保留原文**，
  同时说清「本轮站得住的读数是哪部分」。
  **教训（线索 264）：写下「是 X 造成的」之前，先让探针把那个元素的身份打印出来
  （标签、祖先链、`getRootNode()`、`outerHTML` 前 160 字），别拿「文本对得上」当证据。**
