# 冷启动 prompt：继续 React → Vue 平替的下一轮

> **用法**：新开一个窗口，把下面「开工指令」整段贴进去（或者直接说
> 「读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/plans/vue-parity-cold-start.md` 并按它执行」）。
> 这份文件只写「怎么接手」，**深度背景不在这里**——在下面点名的三份东西里。

---

## 开工指令（整段贴给新窗口）

你接手一个长期任务：把 `frontend-vue/`（Nuxt/Vue）对齐 `frontend/`（Next.js/React），
目标是「移走 `frontend/` 之后 Vue 仍能自足」。仓库在
`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，分支 `main-wc`。

**接手时的状态（2026-09-16 收工时的快照，**不是断言**——下面每个数都现场量一遍）**：

- 上一轮收工时工作区干净、**已推送到 `origin/main-wc`**。
  **领先多少、有没有未提交改动、CI 是绿是红，一律现场量**（命令见下一段）。
  **量 CI 别问「HEAD 绿不绿」**——这个 workflow 有 `paths:` 过滤，纯 docs 提交
  一个 run 都不会有，`total_count: 0` 不是「没问题」。正确的问法与命令写在
  下面第十九轮清单的第 3 条里（那里有三条，第三条就是这件事）。
- 对照台账 **3 唯一行 / 3 多重集 / 147 个场景-维度**。
  **但唯一行是投影数，不是待办数**（2026-09-16 全面审查量出来的）：它数的是
  `场景-维度 × 档 × 行`，同一处差异投影到多少个场景-维度就数多少次。
  按 `(档, 行文本)` 去重，**只有 2 条不同的差异**。
  **把唯一行读成「还有这么多件事」是错的**，件数看的是上面那个去重数。
  **这两条逐条的判词**写在 `vue-parity-open-accounts.md` 第三十五轮条目的第六节：
  一条是架构差异（已退让、有翻案判据），一条是欠账（`stream_mode` 多订 `values`）。

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

**「台账还剩多少行」已经不能当坐标系了。** 第九轮起**每一行逐条都有判词**，
**而且没有一条判词里还带「先怀疑」**。分布极不均匀（第二十三轮实测的投影数）：
**99 个投影**是 `div[scroll-area-viewport]` 那一笔判过的账（含它在 `tabOrder` 上的投影）、
**40 个**是请求层那两族（`retry` 与抽屉挂载拓扑），
剩下 **24 个**是 tooltip 播报节点、焦点落点、以及本仓独有的多账号绑定块
这几类早就判过的。（「写死英文」那一类**第二十三轮清零了**——见账 F。）
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
   - **147 个场景-维度里仍有 124 个是 desktop**；非 desktop 的 8 族逐字是：
     `artifact-preview` `chat` `integrations` `mcp-settings` `project-detail`
     `scheduled-tasks` `thread-list-pin` `ui-polish-mobile`。
     （这一行此前写「129 个里 110 个 desktop，非 desktop 只有 4 族」——**两个数
     和那份名单都是旧的**，第十九轮从基线数出来才发现；现在有门禁守着，见
     `tests/guards/doc-facts.test.ts`。）
     照同一条纪律（**一个场景补一维就够**，主题/断点/语言三轴正交）继续开，
     是现在最划算的一条。
2. **把「写下来当规则用、却没人守」的话变成守卫。** 这条一直有货，判据见下面 C 节。
   2026-09-11 新增一道：`handwritten-input`（手写 `<input>`/`<textarea>` 绕过
   `ui/input`——在它之前，把 primitive 的基类抄成本地常量不会让任何门禁变红）。
3. **上游的缺陷。** 2026-09-11 那一轮修掉的 16 处用户可见缺陷里**大半在上游**，
   包括一颗叫 "Disconnect"、实际删掉整个部署渠道配置、而且对所有人可见的按钮。
   判据是「修 React 自身缺陷是已授权的例外，做法是两边同改」。

### 第一步：按这个顺序读，不要跳

1. `docs/plans/vue-parity-open-accounts.md` —— 挂账总清单，**2668 行 / 236K**
   （名字叫「一页账」是历史叫法，早就不是一页了）。
   **只读开头的「零、全面审查」那一节**就够开工——它是 2026-09-16 逐条量出来的现状，
   含 41 条不同差异的分组、两笔新账（F / G）与全部现场读数。后面是历史，按需查。
2. `docs/plans/vue-parity-handoff.md` —— 轮次交接文档，**11189 行 / 736K**。
   **按轮次倒序排**：开头是「当前状态」，紧接着是最近几轮（第二十一轮 → 第十九轮 →
   第十八轮 …），越往后越旧。**只读开头的「当前状态」和最近两三轮**；
   结尾的「其他常踩的坑」按需查（线索编号已到 **339**、坑编号到 **316**）。
3. Claude 记忆 `deerflow-parity-harness-plan`
   （`/Users/wangcheng/.claude/projects/-Users-wangcheng-Documents-workSpace-frontEnd-aiAppSpace-deer-flow/memory/`）
   —— 每一轮的实测记录与踩坑线索全文（编号已到 **339**）。同目录下另有
   `deerflow-fork-boundary` / `deerflow-vue-replacement-goal` /
   `deerflow-no-midway-questions` / `deerflow-vue-alignment-scope`。
4. `AGENTS.md`（仓库根）与 `frontend-vue/README.md` —— 命令与门禁。

**`docs/plans/` 下其余那几份带日期的文件一律不要读、更不要引用它们的数字**
（`vue-parity-2026-09-1*-re*.md`、`upstream-merge-202609-review.md`、
`vue-parity-fix-audit-2026-09-08.md`、`vue-full-parity-backlog.md`）。
它们是历史快照，每一份开头都盖了章说明这一点——**但 grep 是不看抬头的**，
所以这里再说一遍：搜到它们里面的台账数字、「还剩多少」「未推送」这类话，
一律当历史，现状只看上面第 1、2 条。

### 硬规则（违反会白干一轮）

- **默认只改 `frontend-vue/`。** 例外只有一种：**上游自己是坏的**——
  那时按「业界主流做法两边同改」，`frontend/` 与 `frontend-vue/` 同一条提交里改，
  再单独一条 chore 提交把 `frontend-vue/baseline/upstream-marker.json` 推到那条 fix
  （`make -C frontend-vue upstream-accept`）。**动过 `frontend/` 已经是常态**（2026-09-11 那一轮 14 笔里大半都动了它——这一阶段的缺陷大半在上游），
  别传这个数字，用 `git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests` 量。
- **不要中途提问。** 取舍自己定，写进提交说明。分歧的兜底判据是**按业界主流做法**。
- **每轮收工写交接文档 + 一页纸清单 + 记忆，然后自动开下一轮**，
  推到我喊停为止；**不要停下来问「要不要继续」**。
- **每轮收工自动 `git push`，不再询问。** 2026-09-06 就给的长期授权
  （Claude 记忆 `deerflow-no-midway-questions`），2026-09-16 用户重申。
  **判据：记忆与计划文档冲突时，以记忆里的用户原话为准，并当场把文档改对。**
  此前这三份文档里写着「要推就先问用户」，与记忆直接矛盾而文档赢了——
  代价与来龙去脉写在一页账的账 E，这里不复述。
- **⚠ 最终目标是「完全一致」，所以台账的目标就是 0**（2026-09-16 用户原话：
  「最终目的是 vue 版本和 react 版本在功能，体验，交互逻辑，界面上保持完全一致」，
  并追一句「这个才是最终目标」）。
  **「新出现、还没定过的行只能减不能增」是过程规则，不是终点**——
  它管的是「这一轮别把账做烂」，管不了「这笔账要不要还」。
  于是此前那些判成**「保留本仓这一侧」**的行，在这条判据下**不是结清，是欠账**，
  逐条清单与还账路径见一页账的「零、按最终目标重排」那一节。
  **唯一的豁免仍然只有一条**：落地页 / docs / blog / 静态整站模式
  （Claude 记忆 `deerflow-vue-alignment-scope`，双向豁免）。
  还账不等于「照抄 React 的缺陷」——上游是坏的那一类走**两边同改**，
  这条老规矩不变，变的是「不许停在『两边不一样但都能用』」。
  `frontend-vue/baseline/parity-diff.json` 的**活读数只有一处**——本文开头
  「接手时的状态」那一条，或直接跑上面那段脚本。**下面这串是变更史，不是现状**：
  （wave 200 实测 103 行 / 95 个取样点）
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
  **变异之后先打印被改对象的前后状态再看用例红不红**——第十七轮踩过：
  `.replace(x, "", 1)` 命中了文件里更早的另一处，用例照样绿，
  而「一次没生效的变异」和「守卫没问题」长得一模一样。
  `diff | wc -l` 只能证明文件变了，**不能证明变对了地方**。
  结果做成表格贴进提交说明。**假绿要如实写进去。**
- **长内容给文件不要贴进对话**（这是我的全局约定）；回答里给绝对路径。

### 工作循环（一轮 = 一个 wave）

1. 从「还没接的交互态」或三个方向里挑一件（见下）。
2. **先量**：给对照取样面加锚点 / 跑现成的尺子 / 写探针，拿到读数。
3. 归因到**根因**，不要逐行修表象（历轮经验：N 行差异通常归到 2~5 处根因）。
4. 改，复量。**台账的目标是 0**（最终目标是「完全一致」，见上面硬规则那一条）；
   这一轮修不掉的，要么有名有姓地进一页纸清单**并写还账路径**
   （改本仓 / 两边同改 / 等后端 / 明确豁免），要么就不该被判成「保留本仓」。
   **「新出现、还没定过的行只能减不能增」只是过程规则**，别拿它当终点。
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
# 2026-09-16 第二十一轮收工实测（每一条都是真跑出来的，不是抄的；
# 第十九轮 verify 跑了七遍（前三遍红——见下面「读门禁的退出码」那条）；
# 第十九轮那次**没跑整条**，当时 `--list` 数出来是 148；
# 第二十轮加了 sidebar-collapsed 两维之后是下面那个 150（有门禁钉着）；
# e2e-visual 是第二十一轮真跑的（8 passed，截图一张没变）；icon-parity 是第十三轮的；
# 其余读数是第五 / 七轮真跑的，第五轮九条全绿）
# 【哪些数有门禁守着】`tests/guards/doc-facts.test.ts` 逐处比对签入产物：
#   台账三个数、不同的差异条数、desktop 档数与非 desktop 族名单、词典 key/unused、
#   e2e-parity 用例数。**但它只认 `N 唯一行` / `N 多重集` / `N 个场景-维度` /
#   `N 条不同的差异` 这一套措辞**——换个写法（如「N 行 / N 样本」）就绕过去了，
#   所以那两种旧写法已被另一条 BAN 规则禁掉。
#   **没有门禁的是**：verify 的「文件 / 单测」条数、各条耗时、e2e-mock /
#   e2e-backend 的 passed 数——那几个每加一条测试就变，写进散文只会不断说谎，
#   跑一次即可，别照抄。
make -C <abs>/frontend-vue verify         # exit 0；**332 文件 / 2700** 单测；词典 1140 key / 15 unused
make -C <abs>/frontend-vue e2e-parity     # **156 passed**（第三十三轮实测 15.7 分钟；
                                          #   此前记的 17.3 分钟是旧机况，耗时本来就没人守）
                                          #  `make parity-accept` 只跑 diff.spec.ts（3 passed，
                                          #   第二十三轮实测 13.1 分钟——它一条用例里抓全部场景）
                                          #  台账 3 唯一行 / 3 多重集 / 147 场景-维度（第三十五轮 accept）
                                          #  （第十二、十三两轮基线文件都一个字节没动；
                                          #    第十二轮新挂的两个锚点报出 4 行、当轮修完归零，
                                          #    第十三轮修的四处**本来就没有锚点**——那正是问题本身）
                                          #  （此处此前写「3 passed」——那是只跑 diff.spec.ts 的数字，
                                          #    整个套件还有 scenarios.spec 的每场景-维度一条 + topology）
make -C <abs>/frontend-vue e2e-mock       # 319 passed（274 + 22 + 15 + 2 + 6）；**第三十三轮真跑**
                                          #  （第十三轮之后一直没跑——规则写着「批不超过 4 轮」，
                                          #    实际隔了 7 轮。**但那条 375px 的红与此无关**——
                                          #    它在 macOS 上一直绿，本机跑多少遍都抓不到。
                                          #    详见下面第二十二轮的订正）
                                          #  **`thread-list-infinite-scroll` 在负载下抖过一次**
                                          #  （`scrollIntoViewIfNeeded` + IntersectionObserver 对负载敏感）——
                                          #  孤立复跑 1.8s 通过、空闲机器整套 318 全绿
make -C <abs>/frontend-vue e2e-backend    # 22 passed（2+5+2+3+3+5+1+1；需要 backend 的 uv 环境）
make -C <abs>/frontend-vue parity-accept  # 只能让台账变短；要变长得 PARITY_ACCEPT_GROW=1
                                          #  并在提交说明里逐行解释
make -C <abs>/frontend-vue standalone-sim # exit 0（跑过 18 / 未跑 5 / 红 0）
                                          #  **第二十七轮起它进了 CI 的 verify job**——在那之前
                                          #  它不在任何自动入口里，`invented-palette-colors.test.ts`
                                          #  从建档那天起在**收集阶段**读上游、红了二十多轮没人看见
                                          #  （本机 `../frontend` 永远在，`make verify` 照样全绿）。
                                          #  **第二十七轮它红过**：`invented-palette-colors.test.ts`
                                          #  从 2026-09-12 建档那天起就在**收集阶段**读上游
                                          #  （`describe.skipIf` 跳过用例不跳过收集——
                                          #   wave 83 那条坑在另一份文件上复发），
                                          #  而这道门当时既不在 verify 里也不在 CI 里，
                                          #  红了二十多轮没人看见。**第二十七轮把它加进了 CI**。
make -C <abs>/frontend-vue e2e-visual     # 8 passed（只有 -darwin 基线，本机门禁；第十三轮复跑）
                                          #  **第十二轮的教训**：这一档改完侧栏字重仍然全绿，
                                          #  而那**不是**「侧栏没变」的证据——它是 fullPage +
                                          #  maxDiffPixelRatio 0.01，一个词的字重差远在容差内。
                                          #  证据在对照档：那 4 行 fontWeight 从有到无。
make -C <abs>/frontend-vue asset-budget   # exit 0（第五轮查清是存量并重定预算，四条依据写在脚本注释里）
make -C <abs>/frontend-vue icon-parity    # exit 0、**0 处待核**（第十三轮复跑；第五轮把 `Unplug` 那处从根因清掉）
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
`next start`——**在 `frontend/` 目录里**跑
`PLAYWRIGHT_BASE_URL=http://localhost:3002 SKIP_ENV_VALIDATION=1 pnpm exec playwright test`
（**必须 cd 进 frontend/**，在仓库根跑找不到 config），
config 会照这个 URL 的端口自己起 webServer）。

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
  **这条已经写在这里，仍然被违反了三次**（第十八轮一次记成「verify exit 0」而实际红着、
  第十九轮开头两次）。写下规则挡不住它，**不自己拼命令**才挡得住——照抄这一行：

  ```
  make -C <abs>/frontend-vue verify > /tmp/v.log 2>&1; echo "VERIFY_EXIT=$?"
  ```

  先看 `VERIFY_EXIT`，再去 `grep` 那份日志要读数。**日志里出现 `Tests N passed`
  不等于 verify 绿**——单测只是九步里的一步，i18n / OpenAPI / 契约常量 /
  独立性 / build 都在它后面。
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

## 上一轮（2026-09-17 第三十五轮）做了什么

**四条根因一次清掉：投影 13 → 3，不同的差异 10 → 2。**

播报器抓早了的快照 / reka 把 tooltip 播报节点标成 `aria-hidden` /
reka 把菜单项 `tabindex` 写死 `-1` / 变更面板焦点落点由数据到没到决定。
**四条里有三条是库或时序的副产品，不是任何一边的契约**——与第三十四轮那条侧栏同形。
逐条读数与实现弯路（响应式版让子菜单打不开）写在一页账的第三十五轮条目。

### 再上一轮（2026-09-16 第三十四轮）做了什么

**侧栏窄屏挂载时机（8 投影）+ 账 G 分栏把手（2 投影）：投影 23 → 13，不同的差异 16 → 10。**

**这一轮最该记住的一件事：尺子推翻了上一轮的判词。** 半程判词说「两边窄屏都是 Sheet，
关着时不渲染」，于是把那 8 个当成「本仓多发」。只改本仓之后台账**不是少 6 行而是多 45 行**
——直接探针量到上游在 chats 系路由上**也**在窄屏白挂一次桌面侧栏并发那三条请求，
只有 `scheduled-tasks` 那两屏侥幸不发。**上游在这件事上没有契约，只有一个随水合时序开奖的结果。**
两处根因（断点判定晚一帧 / 查询挂在抽屉外面）与两边同改的做法，写在一页账的第三十四轮条目。

### 再上一轮（2026-09-16 第三十三轮）做了什么

**族 D 还清：投影 36 → 23，不同的差异 28 → 16。**

后端返回的就是账号列表，上游却把它塌成一条——第二个账号看不见也解不掉。
**改的是上游**（列表化、逐账号断开、主操作键两分支共用、两条词条），
本仓只跟了一处容器间距。

**中间走错一步值得记**：以为描述里那句 `Connected as` 是本仓多的、删掉之后
读数从 10 涨到 22。**「哪一边多了」要看差异档的方向**
（`ariaOnlyVue` 是本仓多、`ariaOnlyReact` 是上游多）。

## 再上一轮（2026-09-16 第三十二轮）做了什么

**族 B 的大头还清：投影 69 → 36，不同的差异 31 → 28。**

三条读数是同一个根因——重试策略。上游吃 TanStack 默认 `retry: 3`（不分错误码），
本仓写死 `retry: false`（连断网也不重试）。**两边都不对，所以两边同改**：
只重试传输层失败（`fetch` 抛的原生 `TypeError`），任何 HTTP 状态码一律不重试。

**这正是 wave 128 挂账时写下的翻案判据**——挂账时写清翻案条件，是会被真的兑现的。

## 再上一轮（2026-09-16 第三十一轮）做了什么

**族 A 清零：投影 170 → 69，不同的差异 35 → 31。**

根因不是 primitive 而是**整层组件缺失**——上游 `ai-elements/suggestion.tsx` 的
`Suggestions` 把建议行包在 ScrollArea 里，本仓整层没有。做法是**补一层真组件**
（新增 L2 `ui/suggestion/`），不是给那个元素硬加 `tabindex`。

**同一轮里还有一个方向相反的决定**：`CommandInput` 按字面对齐之后，
台账当场报出对话框高度 Δ-13.1px，**而改之前是全对的**——底层不同构
（Reka `ListboxFilter` vs cmdk `Input`）。回退字面对齐，把实测读数写进判词。
**两个决定的判据是同一条：看渲染与行为，不看字面。**

## 再上一轮（2026-09-16 第三十轮）做了什么

**给尺子补上「天生看不见的第②类」：请求体进取样面。**

`requests` 那一档只比 `METHOD /path?query`，**体一个字节都没进过取样面**
——而上游 `mcp-settings.spec.ts` 自己断言的就是「PUT body 里没丢 advanced 字段」。
补上之后**第一跑就报了三行此前任何一档都看不见的差异**（逐条判词见挂账清单）。

归一化**只有两条规则**（按 key 排序、抹客户端生成的 UUID），时间戳一律不抹；
**只比两边都发过的键，且按「不同的体」的集合比**——多重集写法第一跑就撞上
「同一处差异两份投影」。配套形状断言 `bodySamples >= 10` 与诊断计数。

顺带**退役了队列第 1 条**（账 C 的 `title` 扫描）：三次量下来前提不成立
（两边用量 80 vs 72，两处疑似逐个查都对得上，icon-only 的 `title` 本来就是
可访问名的兜底）。**第三扇维度窗也是零新差异，连续三扇**。

## 再上一轮（2026-09-16 第二十九轮）做了什么

**agent 会话上那颗分支键关掉了。判词是查后端定的，而且和第一印象相反。**

线索从「上游缺了什么」开始（agent 会话页不传 `canBranch`/`onBranchTurn`），
**从「本仓多了什么」结束**：分支接口不继承 `agent_name`
（`backend/app/gateway/routers/threads.py:1052-1058`），
本仓那颗键点下去会造出一条服务端不认为属于这个 agent 的线程。

**这一轮真正值得记的是判词是怎么定的**：不是「上游没有所以上游漏了」，
也不是「本仓有所以本仓更全」，而是**去查那条操作在后端到底做了什么**。
后端那笔账单独挂着（账 J），修好之后三处一起重判。

顺带：为了换落点给 `ParityState` 加了 `path`；
`canBranch` 必须给显式默认值 `true`（Vue 布尔 prop 不传是 `false`，wave 15 那条坑）。

## 再上一轮（2026-09-16 第二十八轮）做了什么

**账 I 结清。** 上游 `canEdit` / `canRegenerate` / `canBranch` 那三串条件逐条对完，
**六项里只有两项是真缺口**：`!isUploading` 与 `!branchThread.isPending`。
另外四项要么本仓已兑现（`!isMock`），要么**靠结构兑现**
（streaming / 新会话时键根本不画，上游同形），要么在对齐范围之外（`STATIC_WEBSITE_ONLY`）。

**`branchPending` 那一条不只是灰按钮**：本仓 `branch()` 可重入，连点两下两条新线程。

**那条不对称是判据本身**：上游 `canRegenerate` 里没有 `!branchThread.isPending`。
测里专门钉它，挡「三颗一起禁掉」那种看起来更整齐的写法。

顺带订正了 `AssistantTurnActions.vue` 文件头那段**撑着设计决定**的注释——
它列的四种只读态里三种不对，而「上传中」那一条**写下来那天就是假的**。

## 再上一轮（2026-09-16 第二十七轮）做了什么

**开了两扇窗、结清一处上游条件门槛。**

- **两扇新窗都报零新差异**：`mcp-settings` 补 `mobile/light`（URL 直达的设置对话框，
  不必先解决移动端抽屉）、`artifact-batched-stream#preview-failed` 补 `desktop/dark`
  （错误态是「固定红 vs `--destructive` token」的高发区）。两处量出来都只有已判过的
  老账（scroll-area 那笔 / `retry: 3` 那笔）。**机器证据是「不同的差异」这个数
  33 → 33 纹丝不动**，而唯一行 143 → 146 只是投影变多——
  这正是本文开头那句「唯一行是投影数不是待办数」的又一次实测。
- **清单第 2 条那条线索上摸到一处真差异**：上游**两个入口**
  （`chats/chat-page.tsx:559-561` 与 agent 页 `[thread_id]/page.tsx:442-448`）
  的欢迎区条件都是 `isWelcomeMode && !hasGoal && !hasTodos`，**本仓两处都没有**。
  后果是欢迎态下敲一条 `/goal …` 之后，两边在同一块绝对定位区域上各画各的。
  **台账看不见它**：上游的欢迎态等价于 `isNewThread`，那条路由上 `thread.values`
  根本没取过，也就是说上游这一支**只能靠 `/goal` 命令走到**，夹具喂不出
  「新会话 + 已有目标」。所以钉成源码守卫
  `tests/unit/chat/welcome-yields-to-goal.test.ts`，**两侧都钉**
  （上游那串条件哪天变了，这条守卫的理由就该重新判一次）。

- **沿途挖出一件比正题大的**：`make standalone-sim` 红了二十多轮没人看见
  （`invented-palette-colors.test.ts` 在 `describe.skipIf` 的回调体里读上游——
  skipIf 跳过用例不跳过收集）。修掉之后 18 过 / 5 未跑 / 0 红，
  **并把这道门加进了 CI**：它不在 `verify` 里也不在 CI 里，而它验的正是
  这整件事的目标本身。

**顺手量出、留给下一轮的**（见挂账清单第二十七轮条目）：上游 `canEdit` /
`canRegenerate` / `canBranch` 里还有 `!isUploading` / `!thread.isLoading` /
`!branchThread.isPending` 三串条件，本仓的 `interactive` 只等于 `!isDemo`。

## 再上一轮（2026-09-16 第二十一轮）做了什么，下一轮从哪接

**追 CI 上那条「本机绿」的红，修到根因。**

`make e2e-mock` 在 CI 上红：`integrations.spec.ts › the settings panel fits inside
the dialog on a 375px screen`，实测 `panelOverflow: 0` / **`cardOverflow: 9`**。

**根因是量出来的**：`CardHeader` 有 `CardAction` 时是 `grid-cols-[1fr_auto]`；
第 2 列是 `whitespace-nowrap` 的 Refresh（min-content 95px），第 1 列虽写 `1fr`，
但 grid/flex 子项默认 `min-width: auto`，**缩不到自己的 min-content 以下**，
卡死在 137px。三条证据：① 容器从 257 缩到 248，`grid-template-columns`
**完全没变**；② 第 1 列宽度 == 它的 min-content；③ 本机把视口收到 366px
**复现了同一个数**（溢出 8），越界者自始至终只有 `card-action`。

修法（**两边同改**，上游 `integrations-settings-page.tsx:642` 逐字相同、同样缺
`min-w-0`）：外层 flex 与内层文字 div 补 `min-w-0`，图标盒补 `shrink-0`。
修完开始溢出的宽度从 370 推到 320。上游那处**本来就有一段注释**记着同一张卡片
以前溢出过，当时的修法是把 `px-6` 降成 `px-4` 买回 16px——**没碰真正的原因**，
所以余量一直是 0；后半段已补进那段注释。

**门禁补到能抓住这一类**：原判据只量 375px，而那一档余量恰好为 0，
所以 macOS 绿、Linux 红。加了一档 360px（常见 Android 宽度）。
负向验证：拿掉修复 → **360px 那档在本机 macOS 就红，375px 仍绿**。

### 再上一轮（第二十轮）做了什么

把**收起态的侧栏**接进取样面，场景-维度 140 → 142、唯一行 159 不变，读数 0 行。
重点不是那个 0，是**证明它可信**：给场景加了终态断言（没有它，click 没生效
的话两边都停在展开态，十一档照样全空）。证明过程里修掉一处夹具串味——
`scenarios.spec` 两个应用共用一个 browser context，而双方把侧栏态存在**同名
cookie `sidebar_state`** 里，先跑的污染后跑的；改成一应用一 context。
同时**推翻了第十九轮写进本文档的一个猜测**（详见下面第二十一轮的教训 2 与
Claude 记忆 `measure-dont-guess`）。

**下一轮最该先拿的（按顺序，第 1 条就能直接动手）**：

> ~~第二十七轮把顺序换了：第 1 条是「上游条件门槛」那条线~~
> —— **第二十八轮结清账 I，第二十九轮结清 agent 分支那一条**。
> 下面是方向性的活，按性价比排。

> **⚠ 2026-09-16 用户重申了最终目标：「功能、体验、交互逻辑、界面上完全一致」，
> 并说「这个才是最终目标」。** 于是这张单子的排序换了——
> **先还台账上那 35 条欠账，按「一处根因还掉多少投影」排**；
> 逐族清单与还账路径写在一页账开头那节「按最终目标重排」。
> 原来那几条方向性的活（开维度、接 CI、账 J）排到它们后面。

1. **侧栏在窄屏上的挂载时机——8 个投影，现在最大的一块。第三十四轮已量到一半。**

   **已经量到的事实**（别重查）：
   - 三行全在 **mobile 维度**上，方向相反：`scheduled-tasks#default` 与
     `#load-failed` 上**本仓多发** `channels/providers` / `features` /
     `threads/search`（各 1），`thread-list-pin#mobile-drawer` 上**上游多发**
     `features` / `threads/search`（各 1）。
   - **不是「谁挂了侧栏」**：两边的 workspace layout 都挂，
     而且两边的窄屏分支**都是 Sheet**（`ThreadSidebarShell.vue` 的 `v-if="narrow"`
     对上游 `ui/sidebar.tsx:183` 的 `if (isMobile)`），关着时内容都不在 DOM 里。
   - **也不是请求集合差异**：desktop 维度上两边发的是**同一个五条集合**，
     只是顺序不同（`PARITY_ONLY=scheduled-tasks` 的 `REQUESTS` 段实测）。
   - 本仓 `ThreadSidebar.vue` 在**自己的 setup 里**起了两个查询
     （`useThreads()` → `POST /threads/search`、`useAgentsApiEnabled()` → `GET /features`），
     它们不在 Sheet 的插槽里，**Sheet 关着也照跑**；
     而 `channels/providers` 的所有者是插槽里的 `WorkspaceChannelsList`——
     **它按理不该在关着时跑，所以那一条还没解释**。

   **下一步的问题写清楚了**：窄屏是**由 JS 判定**的（`ThreadSidebar.vue` 里那段注释
   自己写着「窄屏由 JS 判定而不是只靠 CSS」），所以首帧很可能先挂桌面分支、
   子树跟着挂载并发请求，随后才切成 Sheet。**先证这一条**
   （探针：在 mobile 维度上打印 `narrow` 的首帧值与切换时刻），再决定修法：
   若属实，修法是让 `narrow` 在首帧就正确（SSR/媒体查询初值），
   而不是给查询加 `enabled` ——后者只挡住两条，挡不住「整棵子树白挂载一次」。


   `scheduled-tasks` 两个终态上本仓多发 `channels/providers` / `features` /
   `threads/search`（各 2），而 `thread-list-pin#mobile-drawer` 上**上游**多发
   `features` / `threads/search`（各 1）。**两向都有，先查是不是「谁挂了侧栏」**
   ——同一份查询在一侧被侧栏发起、在另一侧没有，那是布局差异不是请求差异。

2. **`chat-thread-init-ordering` 上 `context.thread_id` 两边不同**（第三十轮新尺子报出来的，
   见挂账清单第三十轮第四节那张表的第 4 行）。
   两边路径都是同一条线程，差的是 run 请求 `context` 里带的那一个：
   React 是一个客户端生成的 id、本仓是夹具线程 id。
   **这条场景本来就是为「线程初始化顺序」立的**，而上游 `chat-page.tsx:88`
   那段注释点名了 issue #2746——**先查上游那个 id 从哪来的再定判词**。

   ~~沿着账 C 那条线索扫 80 处 `:title=`~~ —— **第三十轮退役**，
   三次读数都证明前提不成立（两边用量 80 vs 72、两处疑似逐个查都对得上、
   icon-only 的 `title` 本来就是可访问名的兜底）。**判词与读数写在挂账清单第三十轮第一节。**

   ~~上游的 agent 会话页根本不传 `canBranch` / `onBranchTurn`~~ —— **第二十九轮已结清**，
   判词与后端那笔账（账 J）写在挂账清单第二十九轮条目。下面这段留作背景：
   第二十八轮扫完上游所有 `can*={` 传参之后剩下的唯一一条线索（全仓只有
   `chats/chat-page.tsx` 与 agent 页两处传，逐字比完就这一处不一样）：
   上游 `[agent_name]/chats/[thread_id]/page.tsx:356/364` **只有 `canRegenerate`
   与 `canEdit`**，没有 `canBranch`、也没有 `onBranchTurn`——而
   `message-list.tsx:890` 的渲染条件里有 `onBranchTurn &&`，
   **也就是说 agent 会话上游压根没有分支入口**。本仓 `AgentChat.vue`
   一个组件服务两条路由，`branchable` 不看 `agentName`。

   **夹具够不够得着，第二十八轮已经量过了：够不着。** `agent-chat` 的 path 是
   `/workspace/agents/test-agent/chats/new`——**一条新会话，一条消息都没有**，
   所以三颗回合键两边都不画，那两个档报的 0 是「压根没测到」，不是「两边一样」
   （第二十轮那条教训：拿到 0 不等于两边一样）。
   **所以第一步是给这条场景补一支带完整回合的终态**，
   与第二十六轮 `GoalStatus` 那笔账同一个形状——
   `thread-todos` 那份 goal 夹具只有十行配置，就一次逼出两处真差异。

   要是量出来确有差异，**判词要先定「谁对」**：上游 agent 会话不给分支，
   可能是有意（agent 线程的分支语义不清），也可能只是漏传——
   去读那两处的注释与 git 历史再定，别默认「上游就是对的」。

3. **把 `e2e-parity` 接进 CI——这把尺子从来没被这台笔记本以外的机器跑过。**
   第三十轮顺手量到的：`.github/workflows/` 里**一处都没有** `e2e-parity`
   （grep 零命中），而 `frontend-vue/README.md` 自己写着这是
   「**a cost decision that has never actually been made** —— local-only by
   default, not by design」。
   **这与第二十七轮 `standalone-sim` 那件事是同一个形状**（记忆
   `deerflow-gate-needs-an-entrypoint`），只是标的大得多：
   **整个对齐工作的坐标系就是这份台账**，而它只在本机被验过。
   第二十一轮那条 375px 的红正是「本机绿、Linux 红」——同一类风险在这里没有任何遮挡。

   **先量成本再决定**：CI 要装两个应用的依赖、build 两次、跑约 18 分钟。
   可行的中间档：只在 `frontend-vue/**` 或 `frontend/src/**` 变动时跑、
   或者只跑 `diff.spec.ts`（它一条用例抓全部场景，约 13 分钟）。
   **别默认"太贵所以不做"——那正是 README 里那句话说的，这个决定从来没人真做过。**

4. **方向 1：把取样面往没人看过的维度开一扇窗**（本文件开头那节排第一的一条）。
   **147 个场景-维度里仍有 124 个是 desktop**，非 desktop 只有 8 族。
   **但第二十七轮连开两扇都是零新差异**（`mcp-settings` 补 mobile、
   `preview-failed` 补 dark），所以这条现在排在条件门槛后面——
   它仍然出货（每开一扇就多一片有机器守着的面），只是单位产出降了。
   照「一个场景补一维就够」的纪律继续开。
   **两条边界要先知道**：
   - 对照场景的 id **就是上游 spec 的文件名**（`tests/parity/scenario-coverage.test.ts`
     拿 `frontend/tests/e2e/*.spec.ts` 当坐标系，三个桶必须恰好划分它）。
     **想不出对应的上游 spec 就加不了新场景**——那种差异要么挂到既有场景上，
     要么像账 C / H 那样自己写一条守卫。
   - **给既有场景补一维 / 补一支夹具，比开新场景便宜得多，而且一样出货**：
     第二十六轮只是给 `thread-todos` 补了一份 goal 夹具，就一次逼出两处真差异。

5. **账 J：后端的分支接口不继承 `agent_name`**（第二十九轮量出来的，见挂账清单）。
   它是「agent 会话没有分支入口」那一条的根，修好之后三处一起重判
   （后端、本仓的 `canBranch`、上游 agent 页那两处漏传）。
   **但它是 `backend/` 的改动，不在「只改 frontend-vue、上游缺陷两边同改」
   这条授权里**——所以这里只挂着，等一句明确的话再动；
   `backend/AGENTS.md` 写着那边 TDD 是强制的，真做要连夹具一起。

6. **方向 C 继续**（把「写下来当规则用、却没人守」的话变成守卫，判据见下面 C 节）。
   最近四轮给它加了四个新形状（第四个是第二十七轮的
   `welcome-yields-to-goal`：**守卫可以两侧都钉**——本仓那一条钉「照着做了」，
   上游那两条钉「照的还是那个样子」，上游一变，这条守卫的**理由**当场变红）：
   - 撑「**不做**某件事」的理由（`SidebarMenuButton.vue` 那句「没有图标条形态」）
     ——**它没有代码，只有一段注释和一个缺口**；
   - **立全称判据之前先量一遍**（「两边同名就得同字」听起来要豁免表，实测 0 条不一致）；
   - **挂着的账里那句「缺什么」本身要核**（`GoalStatus` 那条写着「先补夹具」，
     而夹具字段一直就有，缺的是用它的场景）。

7. ~~把「批不超过 4 轮」变成机器判据~~ —— **已降级**，前提被推翻，理由见下面
   「第二十二轮那条订正」。它仍有价值（抓本机能抓的回归），但**不是**那条 CI 红的成因。

### 第二十二轮那条订正（为什么第 6 条被降级）

第二十一轮挂账时给了一个现成的解释：「本机批次规则写了没执行，`e2e-mock` 隔了 7 轮
没跑，所以 CI 上那条 375px 的红躺了 6 天」。**听起来完全成立，所以它进了提交说明、
三份文档和一条记忆——而我没查。** 逐次查 CI 的 job **逐步结论**之后，因果是错的：

- `cc0387db`（09-09，上一次推送）那次 `verify` job **整个 success**——
  那条用例**当时还不存在**（`git log -S` 查到是 09-12 由 `6e1c06c2` 加的，晚于那次推送）；
- 两次推送之间本地攒了 **360 个提交**，CI 一次都没看见；
- `90af6bea`（09-15 13:58）红在 `Run fast verification`（i18n），后面的
  `Run every suite that needs no backend` 全部 **skipped**——**一条红挡住了另一条**；
- `c0d25064`（14:34）修掉 i18n 之后才第一次跑到它，当场红。

**推论**：本机跑 `e2e-mock` 再多遍也抓不到它——**它在 macOS 上就是绿的**。
能抓的只有 Linux，也就是 CI；而 **CI 只看得见推上去的东西**。
真正的变量是推送节奏（账 E，已结清：每轮收工自动推）。

**方法学**：「有一个说得通的解释」和「查过了」是两回事。查 CI 就去读 job 的**逐步结论**
（哪一步 failure、哪些 skipped），查回归就 `git log -S` 找那段代码何时进来的。


### 第二十六轮踩出来的两条

1. **挂着的账里那句「缺什么」本身要核。** `GoalStatus` 那条账挂了八轮，
   写的是「先补夹具」——而 mock 的 `MockThread.goal` 字段**一直就有**
   （`threadChannelValues` 里是 `goal: thread?.goal ?? null`），
   缺的是**一个同时喂 `goal` 与 `todos` 的场景**。
   **「缺夹具」要写代码，「缺一个喂它的场景」只要写十行配置**——
   这两件事写在账上长得一样，而它们的成本差一个数量级。
2. **别急着把剩下的读数归进老账。** 修完位置差异后还剩三行
   （`ariaOnlyVue: button "Edit and rerun"` + `tabbablesOnlyVue` + `tabOrder`），
   后两行的形状与判过的 `div[scroll-area-viewport]` 那笔账**长得一模一样**。
   真追下去：三行是同一个根因——上游 `canEdit` 里有 `!hasGoal` 而本仓没有。
   **判据是改完复量、看它跟不跟着一起消失**，不是「形状像哪一笔老账」。

### 第二十五轮踩出来的两条

1. **换语言的探针要带一条「这条词条确实变了」的负向对照。** 账 H 的第一版探针用
   `vi.stubGlobal("useNuxtApp", …)` 换 locale，zh-CN 与 en-US **都读出英文**
   ——看起来像「本仓也念英文」这条干净结论。实际是 `tests/setup/dom.ts` 把 `$i18n`
   放进 `config.global.mocks`，**模板里的 `$i18n` 走 ctx 而不是 `useNuxtApp()`**
   （那份 setup 的注释自己写着），locale 根本没换过。
   **「两种语言读数相同」与「locale 没生效」长得一模一样**，而前者会被当成结论写进账里。
2. **立一条全称判据之前先把它量一遍。** 「两边同名的词条必须同字」听起来像需要
   一张豁免表，实测 en-US 666 条 / zh-CN 709 条同名条目里**各 0 条**不一致
   ——于是它变成一条**零豁免**的门禁。**先量再立**能把「看起来要豁免表」的规矩
   与「判据真的选错了」区分开（线索 180 只说了后者）。

### 第二十四轮踩出来的三条

1. **「改完复量」抓到的是我自己刚做出来的回归——前提是复量的东西选对了。**
   账 C 的第一版摘掉了本仓那四个原生 `title`，探针一跑：本仓三颗导航键
   **从可访问性树上消失了**（`找到: false`），而 lint / typecheck / 单测全绿。
   根因是那个 `title` 同时撑着两件事——「悬停提示」和「可访问名」
   （本仓收起时 `v-if` 把标签删掉了，上游是留着让 `overflow-hidden` 裁）。
   **我只复量了我想修的那一件。判据：复量要把「原来靠什么撑着」也量一遍。**
2. **撑「不做某件事」的理由，比撑「做某件事」的更难发现——它没有代码。**
   `SidebarMenuButton.vue` 的文件头写着「本仓的侧栏外壳没有图标条形态，
   传进来也没有触发条件」，这是当初不移植上游 `tooltip` 参数的理由；
   而 `ThreadSidebarShell.vue` 写着 `props.collapsed ? 'w-12' : 'w-64'`，
   48px 正是上游的 `SIDEBAR_WIDTH_ICON = "3rem"`。**这句话从收起态做出来那天起就是假的**，
   而它撑着的是一个**缺口**，所以没有任何门禁、任何用例会因为它变假而变红。
3. **守卫要守「这件事」，不要守「这个现象」。** 第一版守卫数全局
   `[role="tooltip"]` 的个数，在「移开鼠标浮层应当消失」那一步红了——
   reka 会把内容投影到一个**常驻**的 `role="tooltip"` 节点上供读屏器读。
   改成读每颗键自己的 `aria-describedby`：不需要拆卸断言，
   量到的也确实是合同本身（「这颗键被这段文字描述着」）。

### 第二十一轮踩出来的两条

1. **一条只在某个平台上成立的断言，和它守住了长得一模一样。** 那张卡片的余量
   本来就是 0：macOS 刚好不溢出、Linux 宽 9px 就溢出。**判据要留余量**——
   把量的宽度往下再取一档，比把断言放宽到 `≤9` 强，后者是打补丁。
2. **「上次修过同一个症状」是强线索，去读那处注释。** 上游那段注释直接告诉我
   这张卡片以前溢出过、当时怎么修的——而那次修的是 padding 不是收缩链，
   所以余量一直是 0。**同一个地方第二次出问题，先怀疑上一次没修到根。**

### 第二十轮踩出来的两条（仍然有效）

1. **拿到 0 不等于两边一样。** 「没有差异」这种结论必须附带「目标状态真的
   到达了」的证据，否则和「压根没测到」长得一模一样。对照场景就把终态断言
   写进 `steps` 里。
2. **取样面之外的那一层，只有把两个应用并排放进真浏览器才看得见。**
   那条 tooltip 差异，台账、守卫、单测**全都是绿的**——它不在任何一条尺子上。

---

## 第十九轮做了什么（历史；下一轮清单以上面那节为准）

**这一轮零产品改动，做的全是「写下的范围 ≠ 机器生效的范围」这一件事。**
它有两个面，是同一个形状：

**面一：文档里的读数没人守。** 两处历史快照（交接文档的「历史快照」节、
一页账的「收工时的门禁读数」节）都自带「数字已过期」并把读者指向本文档——
**于是全仓唯一活着的台账读数只写在这里，而 `doc-facts` 的扫描面止于
`frontend-vue/`，够不到。** 实测五处活跃断言在说谎：本文档两处与交接文档一处
的场景-维度数停在上一轮之前、方向 A 那句的断点分布连族名单都是旧的
（漏了 `artifact-preview`、`project-detail`、`scheduled-tasks` 三族）、
词典 key 数与 e2e-parity 用例数各差一点。**没有任何门禁会因为这些变红。**

**面二：豁免表盖住的比它写的多。** 八张表逐条筛过，
`dead-data-selectors` 的 `collapsible` 是真缺口——理由白纸黑字写「那两条」，
实现按**属性名**在整棵 `ui/` 树上生效，实测放过 **6 处、跨 3 个文件**；
`glyph-as-icon`（比去重后的字符集）与 `primitive-marker-classes`（比标记类集合）
是同一个形状但今天 1 对 1、没有真缺口，一并按处数收紧。
其余五张（`handwritten-button` / `handwritten-input` /
`handwritten-variant-colors` / `icon-parity-tool` / `upstream-class-echo`）
去读实现之后确认是紧的：前三张都带处数断言，后两张分别有 `staleExempt`
反向检查和第十七轮做的逐 token 表。

**沿途挖出的第三件事，比上面两件都严重**：上一轮加的 `primitives.todos`
没进词典审计基线，`make i18n-check` 因此**自那次提交起一直红**；
而上一轮记的「verify exit 0」是 `make … | tail` 的退出码——**那是 tail 的码**。
CI 也确认了：fork 上 `frontend-vue verify` 这次推送后是 failure。
同一份日志还暴露出 `real-backend` 这个 job **至少从 2026-09-09 起一直红**，
根因是它起真 Gateway 却没装浏览器依赖（同文件里 `external-gates` 装了、是绿的），
**本机躲过是因为本机 backend venv 里装着 playwright**。

**下一轮最该先拿的（按顺序）**：

1. ~~收起态的侧栏整个不在取样面~~ —— **第二十轮已接进来，0 行，而且是真的 0**。
   连带订正第十九轮写在这里的一个**错误猜测**：当时以为「上游靠 CSS 藏、节点还在，
   所以上游收起后仍会朗读分组标题而本仓不会」。2026-09-15 在真实栈上逐项量过，
   **不是这样**：`sidebar.tsx:415` 那两条 `opacity-0` 在这个应用里走不到，
   收起时**两边的分组标题都从 DOM 里消失**，四颗导航键的可访问名也逐字相同。
   教训与本轮主题同源——**猜测写进文档就会被下一个人当读数用**。

   量的过程里挖出一条**台账天生看不见**的真差异，见下面第 2 条。
2. **收起态的侧栏里，Vue 有原生 tooltip 而 React 什么都没有**（第二十轮实测，未修）。
   上游的 `SidebarMenuButton` **自带 `tooltip` 属性**（`sidebar.tsx:509-548`，
   收起时渲染 Radix Tooltip），**而 workspace 侧栏一个都没传**；本仓
   `ThreadSidebar.vue:515/554/572` 写的是 `:title="collapsed ? … : undefined"`
   ——原生 title 提示，**是 Vue 自己加的**。
   于是收起之后：React 悬停毫无反馈，Vue 弹一个原生气泡。

   **台账为什么看不见它**：`aria` 档比的是可访问名，两边相同（一边来自被截断的
   文本节点，一边来自 `title`）；`geometry` 档不取 `title`/`data-*`。
   这正是「八类看不见」里的一类，只有把两个应用并排放进真浏览器才看得出来。

   **修法（两边同改，属于已授权的例外）**：上游自己造了机制却没在 workspace 用，
   那是上游的缺口——React 给那四颗 `SidebarMenuButton` 传 `tooltip=`，
   本仓把 `tooltip` 这个 prop 移植到自己的 `SidebarMenuButton` 上并改用它，
   撤掉临时的 `:title`。**改完这一屏仍然量不出来**（`title` 与 Radix tooltip
   都不在取样面），所以同一轮要把判据做成守卫，而不是靠台账。
3. **确认 CI 那条修复真的绿了。** 第十九轮照 `external-gates` 逐字补齐了
   `real-backend` 的装配步骤，并加了门禁钉住「起真 Gateway 的 job 装配一致」，
   但**CI 结论只能靠推送验证**；每轮收工自动推，所以下一轮开工时看一眼 CI 就有结论。
   **查 CI 必须显式指定 fork**——这个 checkout 里 `upstream` remote 指向
   `bytedance/deer-flow`，裸 `gh run list` 会打到上游去、返回空结果，
   很容易被误读成「CI 没问题」。照抄这两条：

   ```bash
   gh api 'repos/aiAppSpace/deer-flow/actions/runs?branch=main-wc&per_page=3' \
     --jq '.workflow_runs[] | "\(.created_at) \(.head_sha[0:8]) → \(.status)/\(.conclusion // \"进行中\")"'
   ```
   ```bash
   RID=$(gh api 'repos/aiAppSpace/deer-flow/actions/runs?branch=main-wc&per_page=1' --jq '.workflow_runs[0].id') \
     && gh api "repos/aiAppSpace/deer-flow/actions/runs/$RID/jobs" \
       --jq '.jobs[] | "【\(.name)】\(.conclusion)", (.steps[] | select(.conclusion=="failure" or .conclusion=="skipped") | "    \(.conclusion)  \(.name)")'
   ```

   **第二条不能省**：一条红会让后面的步骤全部 `skipped`，只看 job 级结论会把
   「被挡住、还没跑过」读成「没问题」——第二十二轮就是这么误判过一次。

   **还有第三条，第二十三轮开工时踩的**：**`gh run list --branch` 是按 sha 列的，
   而这个 workflow 有 `paths:` 过滤**（`.github/workflows/frontend-vue-verify.yml`
   只在 `frontend-vue/**`、`contracts/**`、`backend/app/gateway/**` 等路径变动时触发）。
   **纯 docs 提交不会有任何 run**，于是「HEAD 有没有绿」这个问题本身就问错了——
   第二十二轮收工点 `4ada3f4a` 是纯 docs 提交，一个 run 都没有，
   而三份文档都写着「已推送、CI 全绿」。**正确的问法是
   「覆盖当前 `frontend-vue` 树的那次 run 绿不绿」**——往前找第一个动过受控路径的提交：

   ```bash
   gh api "repos/aiAppSpace/deer-flow/actions/runs?head_sha=$(git rev-parse HEAD)" --jq '.total_count'
   ```

   **`head_sha` 必须是全 sha**（第二十三轮当场踩的）：传短 sha **永远返回 `0`**，
   于是这条命令会在任何情况下都「证明」没有 run——**一个恒绿的判据等于没有判据**。
   （那一轮的结论侥幸还是对的：`4ada3f4a` 用全 sha 查也是 0。**侥幸对不等于量对了。**）

   `0` 的意思是「这个 sha 没被测过」，**不是「没问题」**；这时去看上一个动过
   `frontend-vue/` 的 sha，那次 run 才是当前树的结论。
4. **给夹具补 `goal`，再把 `GoalStatus` 的位置对齐**（第十八轮留的）。
   上游把它和 TodoList 放在同一层包裹里，本仓的在 `ChatComposer.vue`；
   **目前没有任何场景同时喂 goal 与 todos**，改完没有读数可以验。
5. **方向 C 继续**（还剩几族 token，见下面那一节）。

### 第十九轮踩出来的三条

1. **门禁的退出码不能隔着管道读。** `make -C … verify | tail` 交出来的是 `tail`
   的退出码，**永远是 0**。上一轮就是这么把一条红的 i18n 门禁记成「exit 0」的，
   我这一轮开头又犯了同一次。**判据：量门禁一律
   `make … > 日志 2>&1; echo "VERIFY_EXIT=$?"`，不走管道。**
   要看读数再去 `grep` 那份日志。
2. **「以签入产物为准」比「以散文为准」强，但产物本身也要有门禁守着。**
   本轮的门禁拿 `baseline/i18n-keys.json` 当真值、判定文档写错了，
   我照着把文档改了——**结果是产物旧、文档对**。守产物的是 `i18n-check`，
   而它红着没人读。两层都得在，而且上层的读数必须先确认下层是绿的。
3. **本机绿和「这道门禁有效」是两件事，长得一模一样。** `real-backend` 在 CI 上
   红了至少六天，每一轮本地跑 `make e2e-backend` 都是 22 passed——
   因为本机 venv 里装着 CI 没装的东西。**判据：一条只在本机验过的门禁，
   等于没验；要么去看 CI 的结论，要么说清它只在本机成立。**

### 第十八轮踩出来的三条（仍然有效）

1. **一屏没进过取样面，五处差异谁也说不出来**——而挡在前面的往往不是「没挂锚点」，
   **是夹具根本喂不出那一屏**。第十三到十七轮这笔账一直挂着，真做的时候
   第一件事不是挂锚点，是去补 mock 里缺的那个字段。
   **判据：接一屏进取样面之前，先确认夹具能不能把它喂出来。**
2. **同一处结构问题会有多个投影，而在改对之前每一道门都是绿的。**
   标题文字单独放一层之后，i18n 源守卫立刻报了 `To-dos`——旧写法它扫不到，
   因为那时文本节点是元素的兄弟而不是唯一子节点。
   24px 的几何差和「这串英文没进词典」是同一件事的两面。
3. **锚点要两边都成立，不是本仓有就行。** 第一版用 `data-testid="thread-todos"`，
   而上游那份文件一个 testid 都没有——React 侧必然超时。
   **挂锚点之前回上游看一眼那个选择器在不在**（坑 214 的同一条，这次踩在 testid 上）。

### 第十七轮踩出来的两条（仍然有效）

1. **一次没生效的变异，和「守卫没问题」长得一模一样。**
   负向验证是用来证明门有效的，**它自己失效时没有任何东西会提示你**——
   这一轮 N1 第一次就是这样绿的。
   **纪律**：变异之后**先打印被改对象的前后状态**（不是只看 `diff | wc -l`，
   那只能证明文件变了，不能证明**变对了地方**），再看用例红不红。
2. **豁免的范围会被读宽。** 一条豁免写的是「这一处的 X 是例外」，
   而下一个人会读成「这一处是例外」。第十二轮跳过 footer 那颗按钮，
   靠的就是 wave 74 那条只覆盖 `peer/menu-button` 与收起态尺寸的豁免。
   **对策：豁免条目要写「例外的是哪一条」，而不是「这一处例外」。**

### 第十六轮踩出来的三条（仍然有效）

1. **「这件事没人守」会随着有人给它加了门禁而变假，而没有任何机器在看这件事。**
   这类断言有个特点：它**不是装饰，是理由**——七处里每一处都在撑一个设计决定。
   所以它变假的时候，坏掉的不是措辞，是**结论的地基**。
2. **判据不能把「记录历史」一并禁掉。** 第一版守卫把五处**刚改好的**文件全报成违规，
   因为那些文件引用了原句来记住坑。改成「引用可以，但同一份文件里必须点名
   是谁推翻的」。**这个仓库的价值有一半在那些「原文写的是 X，而 X 从某天起是假的」
   的段落里**，判据要能与它共存。
3. **块注释里写 glob 要避开 `*/`。** `` `./tests/**/*.ts` `` 会把注释提前闭合，
   eslint 报的是 `Parsing error: Expression expected`——看错误消息完全想不到是注释。

### 第十五轮踩出来的两条（仍然有效）

1. **一条写着却永远不成立的选择器，比没写更糟**——它让下一个人以为这件事有人管。
   找它的判据可以完全机械化：**类串里选了 `data-[X]`，就得有人把 X 打到 DOM 上**，
   而「有人」有两个来源（本仓包装层 / 底层库运行时），**只查一个会把另一个整片
   报成死的**。这与第十四轮那条「正则看不见的一半被当成 0」是同一件事，
   只是这次它出现在**判据**里而不是勘察脚本里。
2. **Vue 的布尔 prop 不传时是 `false`，不是 `undefined`；而 `data-[X]` 按属性存在匹配。**
   两件事撞在一起，`:data-x="props.x"` 会让**每一个**元素命中那条选择器。
   要打成「不传就没有」，必须显式 `|| undefined`。
   （上游 React 那边 `undefined` 才省略属性、`false` 会渲染成 `"false"`——
   也就是说这个坑上游也有，只是它零消费者。）

### 第十四轮踩出来的三条（仍然有效）

1. **「已经有门禁在守」这句话本身也要核。** 一份文件的注释可以准确地点出
   「哪道门在守我」，而那道门**只盖了一部分**——`MarkdownIcon` 那 9 条路径里
   夹具只录得到 3 条，因为另外 6 条只在交互态出现。
   **问法**：不是「有没有门禁」，而是「那道门的取样面盖得到这一条吗」。
2. **量法本身也要负向验证。** 这一轮两次量错：一次把 `Dialog` 这种
   `defineProps<DialogRootProps>()` 的类型引用当成「没声明 prop」，
   一次把 4 份用 `useAttrs()` 的文件当成「没接 attrs」。
   两次都是**正则看不见的那一半**被当成了 0——线索「算出来的 0 vs 没算的 0」
   不只对台账成立，对一次性的勘察脚本同样成立。
3. **判据要从「会出事的那一侧」出发。** 坑 72 的正确判据不是
   「声明了 prop P 就必须 emit `update:P`」（那会把 `class` / `readonly` 一起收进来、
   需要几十条豁免），而是「**被 `v-model` 绑过的那个 key**」——
   陷阱只在那一侧成立。判据选对了，豁免表自己就没了。

### 第十三轮踩出来的两条（仍然有效）

1. **一句写在注释里的全仓规则，可以一轮都没人守，而且可以已经被违反了四处。**
   「破坏性动作一律走 token」这句话在仓里躺了很多轮，期间**三处历史缺陷的病历
   就写在别的文件的注释里**（`AgentCard` 删除键 / `MemorySettings` 清空键 /
   `ChannelConnections` 清配置，都写死 `text-red-600`）——
   **有人一次次踩同一个坑、一次次写下病历，却没有人把它变成门禁。**
2. **判据收窄之后要再问一次「能不能扩」。** 这一条起手只盯「固定红」，
   扩到整块调色板之后才出货（三处里两处是蓝和琥珀，不是红）。
   收窄是为了去掉噪声，**扩张是为了让同一条判据覆盖同形的缺陷**——
   两件事不矛盾：先按「与 token 一一对应」收窄口径，再沿着「同一种失效方式」扩面。

### 第十二轮踩出来的三条（仍然有效）

1. **「锚点全绿」不等于「这一处没问题」——还要问「这一屏是不是恰好把差异藏起来了」。**
   一个由**状态**决定的差异，在只取样一种状态的屏上会**正负相消**：
   本仓无条件 500 撞上上游激活态 500，本仓无 500 撞上上游非激活 400，
   四个锚点全部「对上」。**取样面的覆盖率要按「状态×锚点」算，不是按「锚点」算。**
2. **「修了有锚点的那一支，没锚点的那一支跟着漏」这是第三次。**
   第十轮三颗芯片 → 第十一轮同一份文件第四颗 → 本轮 `WorkspaceChannelsList`
   的 loading 支。**修一处「手抄」时，先问这个组件还有几条分支没有锚点。**
3. **「不许手写」是比「必须抄全」更好的判据。** 后者听起来宽容，实际把抄本
   正当化，然后要求改 primitive 的人同时去改所有抄本——而守卫只在**下一次**跑的
   时候才说他漏了哪份。不许手写让漂移不可能，而且**零豁免**：
   写不了 `data-slot` 的地方，就是该用 primitive 的地方。
   （代价为零的前提是「那颗 primitive 存在」；不存在的那 11 处单独记了账。）

### 第十二轮的一条操作经验：**换尺子不换判词**（第十三轮又踩一次）

这一轮改完，两份既有测试报红，**判词都对、尺子都过期了**：

- `sidebar-skeleton.test.ts` grep 两份骨架文件的**源文本**找 `data-slot="…"`，
  而 slot 现在由 primitive 提供——**渲染结果照样有，源文本里没有了**；
- `upstream-class-echo.test.ts` 比的是**调用点抄本**里的 `aria-disabled:*`，
  而那两条本来就是从 cva 抄来的，改走 primitive 之后抄本没了。

**第十三轮第三次**：`message-surfaces.dom.test.ts` 那条 todo 断言取的是
`li … span` 的**第一个**、只查一个 `line-through`；完成态的指示器从 lucide 图标
换成上游的 CSS 圆点之后，那把尺子当场指到了圆点身上。
改成按三态各取 `span:first-child` / `span:last-child` 分别比。

**这三次有同一个形状**：尺子绑在「当时那个元素恰好是第几个 / 恰好写在源码里」
这类**位置事实**上，而不是绑在它要守的那件事上。位置会被下一次重构改掉，
要守的事不会。

两处都是坑 131 的形状（尺子测的不是它守的那件事）。修法不是删用例、也不是
放宽断言，而是**把尺子指到新的事实上，并且两头都断言**：
「调用点用了那颗 primitive」**加上**「那颗 primitive 自己真的声明了这个 slot /
真的带着这两条 class」——少了后半句，改错映射或者从 cva 删掉那两条都不会响。

### 第十一轮踩出来的两条（仍然有效）

1. **台账证明不了「没有手抄 primitive」——它只证明取样点上两边一样。**
   第十轮用 `borderRadius` 抓到三颗，修完看起来干净了；全仓一扫，同一份文件里
   第四颗还在。**分布式缺陷要用分布式判据（守卫）去查，不要指望取样面覆盖到。**
2. **判据收窄的正确方向是「只留与 primitive 一一对应的那部分」，
   而不是「加豁免表」。** 31 → 8 靠的是把主题 token 的正常用法整类排除掉，
   而排除的依据是**从 `variants.ts` 里读出来的**——不是一张手抄的白名单。

### 第十轮踩出来的一条（仍然有效）

**一把加对了的尺子，会在第一次跑的时候就把成本付清。**
这一档新增 5 行：**噪声 0、与别的档重复 0、真差异 1 处**（5 个投影），当轮修完归零。
对比 wave 94 的焦点档（17 行里 10 行是描述器噪声），差别在于**加之前那一问答得具体**
——「把 `rounded-2xl` 改成 `rounded-md`」是一个能立刻执行的变异，
而不是「形状可能会不一样」这种话。**答不出具体变异的档，就是还没想清楚要守什么。**

### 第九轮踩出来的一条（仍然有效）

**「这块是手写的」不是一个可以直接行动的判据，「它量出来和上游不一样」才是。**
`ui/input-group` 这笔账挂着的理由一直是**源码形态**（本仓手写、上游走 primitive），
而这一阶段真正的判据是**可观测差异**。正确的顺序不是「先重写、再看有没有变好」，
而是**先把它变成一个读数**——挂锚点比重写便宜两个数量级，而且不管结论是哪一个，
那个锚点都会永久留下来看着它。

### 第八轮踩出来的一条（仍然有效）

**跨语言正则锚点，要对每一种语言分别问一次「这一屏上有几份」。**
wave 131 那三问里的「它在这一屏上只有一份吗」**本身会随维度变**：
两个不同的词典键在**一种语言下撞车**，就只在那一种语言下多匹配一份，
而 `.first()` 会安静地换一个元素去量。症状是**一个只在单一维度出现、
且与那个维度逻辑无关的读数**（这次是 `fontWeight` 只在 en-US 报）。
**优先用结构坐标（href / data-slot），可访问名留给没有结构坐标的场合。**

### 第七轮踩出来的两条（仍然有效）

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

**第十二轮磨出第六条，也是它的一个现成起手式**（这一轮撞出来的）：

> **一句写在注释里的「不 / 必须 / 照抄」，往往只对它当时改的那一半成立。**
> `WorkspaceChannelsList.vue` 的头注释写着「外壳走 ui/sidebar 的四个 primitive，
> **不手抄它们的类串**」——而写下这句话的那一轮**只换了「已加载」那一支**，
> loading 那一支原样手抄着三颗 primitive，注释与代码整整一轮不符。
>
> **起手式**（第十三轮跑过一遍，磨出了收窄口径）：
> ```bash
> grep -rnE '不要|必须|不许|一律|禁止|只能|别再|不得' frontend-vue/app
> ```
> 全量 **346 条 / 165 份文件**——直接做要一张大豁免表。
> 收窄成**同一行（或下一行）里点名了具体 token 的**那些（反引号里的类 / 属性 /
> 组件 / API），因为只有这种才可能被扫描器验证：**131 条 / 87 份**。
> 然后逐条问两句：**「有没有门禁真的在守它」**，以及
> **「它在这份文件里是不是处处成立」**——第十三轮两次出货都出在第二问。
>
> **第十四轮又加了一问**（它自己踩出来的）：不是「有没有门禁」，
> 而是**「那道门的取样面盖得到这一条吗」**——`MarkdownIcon` 的注释准确地点出了
> 守它的是 DOM 等价 gate，而那道门只盖得到 9 条路径里的 3 条。
>
> **已经筛掉的**：「走 `ui/input` / `ui/textarea`，不要手写」一族 6 份
> （`handwritten-input` 同时扫 `<input>` 与 `<textarea>`）；
> 「破坏性动作一律走 token」「不要传 `as="button"`」（第十三轮成门）；
> landmark（对照台账）、`/api/` 分层（`architecture.test.ts`）、
> 尾部防抖（两层各一条用例）、`text-lg` 重复（`primitive-class-overrides`）；
> markdown 图标路径、`v-model` emits（第十四轮成门）。
> **量过判「不做门」的**：`aria-label` + `placeholder` 同在（6 处，多数正当，
> 判据会退化成豁免表）、`inheritAttrs: false` 必须接 attrs（19/19 成立，
> 但判据分不出「真接回来了」和「import 了没用」）——两条的理由都写在挂账清单里。
> **第十五轮把这一步机械化了**：把断言按**它点名的 token** 聚类，
> 只看**被 ≥2 份文件点名**的那些——16 个，一眼看完。
>
> ```bash
> # 见 vue-parity-handoff.md 第十五轮那节；要点是把 token 当聚类键，
> # 同一个 token 被多份文件的断言点名 = 跨文件同形 = 三轮出货的形状
> ```
>
> **16 个里已成门的**：`ui/input` / `ui/textarea` / `<Input>` / `<Textarea>`
> （handwritten-input）、`$attrs` / `renderComponentRoot`（v-model-emits-declared）、
> `data-size` / `data-variant`（dead-data-selectors）。
> **还剩的几族**：`values`（4 份，流协议）、`formatInput` / `[\s-]` / `MiniMax M3`
> （2 份，command-score 的分词 quirk）、`unknown` / `content`（类型契约）、
> `group-has-[[data-slot=item-description]]/item:`（ui/item 内部）。
> 先问它们是不是已经由单测守着——**并且按第十四轮的教训，核那道门的取样面盖不盖得到**。

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

> **⚠ 这一段已被 2026-09-16 的全面审查推翻**，留着看判据怎么演进。
> 现状以一页账的「零、全面审查」节为准：真正不同的差异 **41 条 / 6 组**，
> 其中 **Mermaid 工具条 8 条（账 F）** 和 **`channels#settings-panel-connected` 12 条（账 G）**
> 是**要动手的**，不是「已决定 / 够不着」。

一页纸清单「真正还开着的」当时是 **5 条**，且**全部是「已决定 / 够不着」**：
覆盖率棘轮的 pending 1 条（wave 101 按判据量到底，**不翻案**）、
tooltip 播报节点 2 行（reka-ui 内部，够不着）、
42 行「上游写死英文」（决定保留本仓翻译）、7 行焦点差异（已钉住）、
42 行 ScrollArea（wave 98 核完，决定不跟）。
**每条都带翻案判据，写在一页纸清单第一节。**（「没有需要动手的」这句已被上面那条推翻。）

## 别忘了的三件事

- **「量不出差异」的准确含义是「这些取样点上量不出」**，不是「两个应用一样」。
  过程规则是「新出现、还没定过的行只能减不能增」，**终点是 0**（见上面那条硬规则）。
  （**wave 101 时是 95 行 / 73 个取样点**；活读数只看本文开头那一处，别引用这里。）
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
