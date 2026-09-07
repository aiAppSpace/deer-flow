# 冷启动 prompt：继续 React → Vue 平替的下一轮

> **用法**：新开一个窗口，把下面「开工指令」整段贴进去（或者直接说
> 「读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/plans/vue-parity-cold-start.md` 并按它执行」）。
> 这份文件只写「怎么接手」，**深度背景不在这里**——在下面点名的三份东西里。

---

## 开工指令（整段贴给新窗口）

你接手一个已经跑了 **138 轮**的长期任务：把 `frontend-vue/`（Nuxt/Vue）对齐
`frontend/`（Next.js/React），目标是「移走 `frontend/` 之后 Vue 仍能自足」。
仓库在 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，
分支 `main-wc`，**接手时 HEAD 是 wave 138 的 docs 提交，已推到
`origin/main-wc`，本地与远端齐平**。

**这个阶段的工作性质已经变了，先知道这一点再动手**：产品面的差异基本清完了
（台账 95 行**全部已决定**、一页纸清单「真正还开着的」5 条全是「已决定 / 够不着」），
现在最有货的不是「再找一处 UI 差异」，而是
**「找出一句写下来、当规则用、却没有任何机器在守的话」**——
wave 101~106 连着六轮都是这个形状，之后又连着撞出来好几句，
到 wave 129 为止已经十二句：
「A 会自愈」「两边差 18px」「这几份是手工维护的」「仍然在外面的两类」
「pending 只能变短」「凡是能机械算出来的都在这里对一遍」
「tests/ 有意不在范围里」「顺序天然测不出来，只能靠人盯着两边看」
「`retry: false` 与上游一致」（wave 128）
「这两个锚点钉住的是编辑表单」「那条 key 上游词典里也有 → 才算共有分支」
「守住本仓写下的、**对上游的** `文件:行号` 引用」（三句都在 wave 129）。
**在被撞之前，没有任何门禁会因此变红。**

**wave 106 又补了一条配套判据**：同一个形状**可以不长成一张表**——
`gen-contract-constants.mjs` 那处是三个 `readContract("…")` 调用点，
只 grep `const [A-Z_]+ =` 会漏掉。要问的是「**这段代码凭什么认为自己盖全了**」。

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
  （`make -C frontend-vue upstream-accept`）。**动过 `frontend/` 的至今是二十三轮**（wave 138 动了：模型设置对话框的可访问名，marker 已推到 `7f97efd1`），
  别传这个数字，用 `git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests` 量。
- **不要中途提问。** 取舍自己定，写进提交说明。分歧的兜底判据是**按业界主流做法**。
- **每轮收工写交接文档 + 一页纸清单 + 记忆，然后自动开下一轮**，
  推到我喊停为止；**不要停下来问「要不要继续」**。
- **台账的规则现在是「新出现、还没定过的行只能减不能增」**，不再是「保持 0」。
  `frontend-vue/baseline/parity-diff.json` 当前 **185 行 / 87 样本**
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

### 收工门禁（逐条真跑，命令与上一轮实测读数）

```bash
make -C <abs>/frontend-vue verify          # exit 0；265 文件 / 2205 单测；词典 942 key / 18 unused
make -C <abs>/frontend-vue standalone-sim  # exit 0；跑过 14 / 未跑 5 / 红 0（wave 116 起跑整套 vitest）
make -C <abs>/frontend-vue e2e-parity      # 95 passed；台账 185 行 / 87 样本
make -C <abs>/frontend-vue e2e-mock        # 265 + 22 + 15 + 2 + 6
make -C <abs>/frontend-vue e2e-visual      # 8 passed（只有 -darwin 基线，本机门禁）
make -C <abs>/frontend-vue asset-budget    # exit 0
make -C <abs>/frontend-vue e2e-backend     # 2+5+2+3+3+5+1+1（需要 backend 的 uv 环境）
make -C <abs>/frontend-vue icon-parity     # 0 处待核、**0 条 ⚠**（wave 111 起 stale 会 exit 1）
make -C <abs>/frontend-vue audit           # **预期红 14**，分诊写在 Makefile 的 audit 上方
make -C <abs>/frontend-vue e2e-external   # 3 passed（它**不在任何聚合入口**，
                                          #  也一直不在这张清单里；wave 107 跑了一次，绿）
```

**读门禁输出不要只 grep 最后一行**（wave 111）：`icon-parity` 的 stale 警告
（`⚠ VERIFIED 表里这几条已经不再出现`）在「共 0 处待核」**上面**，而它此前只
`console.log`、不影响退出码——于是那三条过期豁免从 wave 87 起一直在报，
连着几十轮被记成「不报 stale」。现在它会让退出码变成 1；**但这条教训是通用的：
一句要靠人眼读的断言等于没有断言。**

**`icon-parity` 一定要用 `make -C` 跑，并且读输出**：直接
`node frontend-vue/scripts/icon-parity.mjs` 在仓库根下按 cwd 找不到 `../frontend/src`，
会打一句「跳过」然后 **exit 0**——那一行「0 处待核」看起来照样成立（线索 239）。

动过 `frontend/` 的话再加 React 三条：
`python3 scripts/pnpm.py --dir frontend check`（0）/ `test`（**1034**）/
`test:e2e`（**146**，要用 3002 端口的绕法，写在交接文档「React 的 test:e2e 绕法」那一段）。

产品 SFC **218 / 总 220**；新增 SFC 要同步改三处数字（`tests/unit/i18n/source-guard.test.ts`
的 `toHaveLength`、`I18N_INVENTORY.md` 的两句、`tests/architecture.test.ts` 的 `l2Files` 按字母序）。

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
**别再从这条方向找活了**；下面 B / C 两条还在。

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

### C. 把「写下来当规则用、却没人守」的话变成守卫 —— **现在最有货，先挑这条**

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
