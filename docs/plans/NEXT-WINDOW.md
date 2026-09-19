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

⚠ **先读「✅ 已经量过、别重做」那一节再动手。**

⚠ **第四十八轮把那条 `POST /api/threads/search` 查到根因并修掉了**（本仓单边，
读数与判词见 open-accounts 第四十八轮）。所以新窗口量完状态后，
**第一件事是「下一轮最该先拿的」第 1 条——开一个新取样面**，别再去查那个签名。

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

## 总进度与**收工判据**（2026-09-18 用户问过一次，答在这里）

**没有「百分之多少」这个数**，历轮判据明写「总数不是读数」。能报的是三类：

### 待办队列：基本清空

```
上游路由 pending 0（exempt 4）   上游文案 pending 0
取样路由 pending 0（exempt 4）   上游 spec pending 1 / covered 37 / exempt 3
```

那 1 条是 `artifact-table-performance`：量的是性能时延，对照工厂的坐标系
（aria 树 / 几何 / 请求）**表达不了**，已有完整判词并配了镜像 spec。
**它不是「还没做」，别再问。**

### 真正的限制是取样面，不是待办

```
台账   189 个场景-维度 / 58 个不同场景状态 / 0 唯一行
断点   desktop 141 · mobile 20 · tablet 28     ← 四十六轮 4→13、四十七轮 13→28
主题   light 155 · dark 34
语言   en-US 128 · zh-CN 61
```

⚠ 上面每一行都是 2026-09-19 第四十八轮**当场量的**（量法见下面「现场量一遍」）。
⚠ **主题与语言这两行此前写的是 `light 131` / `en-US 104`**——那是第四十四轮的值，
四十六/四十七轮铺 tablet 之后没同步。**以自己量的为准，别引用这份文档里的历史值**；
「不同场景状态」同理（更早写过 84）。

### ⚠ 历轮规律：**打开新取样面就掉出缺陷，不开新面就是 0**

第三十九～四十三轮正好是这条规律的对照：

| 轮 | 做了什么 | 产品缺陷 |
| --- | --- | --- |
| 39 | 打开「对话框 × 窄屏」这个新面 | **2 条** |
| 40 | 打开「浮层在断点处的行为」这个新面 | **1 条** |
| 41–43 | 加固门禁、验证方法，**没开新面** | **0 条** |
| 44 | 一口气开三个面（`aria-hidden` / dark 对比度 / **Tab 落点**） | **2 条**（一条在上游）+ 3 条挂账 |
| 45 | 把 Tab 落点那个面**走完**（逐位比序列） | **0 条**——而那 3 条挂账**用读数结清**，不是搁置 |
| 46 | 重名扫完（0）+ **开 tablet 轴** | **1 条**——sidecar 正文行在 768 上高 14px，桌面下两个错误互相抵消 |
| 47 | tablet 轴**铺到 14 个场景**（4 → 14 族） | **1 条**——上游把技能目录取两遍（两边同改）；15 个 tablet 新样本本身全干净 |

**所以 41–43 的 0 不是证据**，它只说明那三轮没去开新面。
**判读一轮的产出，先问它开没开新面。**

### 已知还没打开的取样面（点名，按建议顺序）

1. ~~**`aria-hidden` 里套可聚焦元素**~~ —— **第四十四轮走完，负结果 0 条**，
   探针底稿已删。判词见 open-accounts 第四十四轮第一节：静态命中 23/23 两边相同，
   全被模态焦点陷阱抵消；换成「键盘真的走得进去吗」之后两边 `hiddenHits` 全 0。
   **别重做。**
2. ~~**dark 下的对比度**~~ —— **第四十四轮走完，1 条跨应用分叉（已修）**，
   其余 14 个低对比度签名**两边逐值相同**、是上游的配色取舍。
   读数逐条写在 open-accounts 第四十四轮第二节。**别去重新配色。**
3. **每个 spec 自己的 `page.route` 前提轴**——**这是名单上唯一还没开的面，
   下一轮就该是它**。31 个 spec 用它喂数据（第四十八轮重量的，此前写 28），
   第四十三轮验证了方法、还没铺过去。做法与候选名单见下面「下一轮最该先拿的」第 1 条；
4. ~~**tablet 轴**~~ —— 四十六轮 4→13、**四十七轮 13→28 个样本（14 个场景族）**，
   共掉出 1 条真分叉（已修）。**仍有 14 个场景族只有 desktop**，其中 5 个
   （artifact 流/表那一族）**两边都 settle 不了**、已判；剩下 9 个多与已覆盖的面重叠；
5. ~~**重复的可访问名**~~ —— **第四十六轮扫完，0 条对照缺陷**。
   ⚠ 而且「缺可访问名」第三十八轮早就判死过，**这两半都别再开**；
6. ~~**`Tab` 落点序列**~~ —— **第四十五轮走完，0 条差异**（58 个终态 × 40 次按键
   逐位对上），并常驻成 `keyboard-order.spec.ts`。那 3 条挂账是 roving-focus
   容器的**中转**，不是落点，已用读数结清。**别重做。**

### 收工判据（建议，用户尚未拍板）

> **连续 3 轮、每轮都打开一个新取样面、且产品缺陷 0 条 → 收工。**

不是「跑满 N 轮」——不开新面的轮次天然是 0，凑不出信息。

⚠ **名单本身快走空了**：六条里只剩第 3 条（逐 spec 的 `page.route` 前提变异）没开。
所以这个判据接下来会卡在「**想不出新面**」而不是「还没跑完」——
**下一轮开完那条之后，真正的工作是造新面，不是从名单里挑。**
按这个判据估**还要 4 轮左右**（1 轮走完名单 + 3 轮确认，有收获或造出新面则顺延）。

**「完全一致」证不出来**（没有方法能证明两个八万行的应用在所有未取样处相同）。
能拿到的终态是这四条同时成立，目前**只差最后一条**：

- 四张工单表 0 ✅
- 台账 0，macOS 与 Linux 同时 ⚠ **仍是「待确认」，但性质变了**：第四十七轮那两行
  `POST /api/threads/search` **第四十八轮查到根因并修掉了**（本仓单边，
  `useThreads.upsert()` 里一行上一版设计的残留；按开关稳定复现、修后 32/32 全对）。
  **要打勾还差一次 Linux 全套绿**——修在 macOS 上验的，CI 上还没跑过完整一轮
- **每一类找到过的缺陷都有一条会红的门禁** ✅
  （窄屏溢出 · 面板余量 · 反空转 · 第二轮扫描 · 浮层随触发器关闭 ·
  **键盘陷阱**（44，两个应用都跑）· **键盘遍历同环**（45，跨应用））
- **已知取样面名单走空，且最后三轮开面无收获** ⬜

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

⚠ **run 挂在「那次推送的 tip」上，不是挂在代码那条提交上**（2026-09-18 实测）：
第三十九轮把代码提交和 docs 提交一起推出去，两条 run 都落在 docs 那条 tip
`482e67bf` 上。所以「纯 docs 不触发 CI」只对**整条推送都是 docs** 成立。

### ⚠ 当前 CI 状态（**新窗口第一件事就是复核它**）

```
<第四十八轮那条提交>  待新窗口复核
08f4cb2b  第四十七轮   verify 绿   parity 第 1 次**红**、重跑（attempt 2）**绿**
327a5dc0  第四十六轮   双绿
8b1a7871  第四十五轮   双绿
2d0997db  第四十四轮   双绿
```

**第四十七轮那次红的两行已经结清了**（第四十八轮）：

```
artifact-table-preview/desktop/light/en-US          requestsOnlyVue: POST /api/threads/search
workspace-changes#changes-panel/desktop/dark/en-US  requestsOnlyVue: POST /api/threads/search
```

根因是 `useThreads.upsert()` 里一行 `eaf9d6a7`（列表还是 `enabled: false` 手动查询
那一版）留下来的「给缓存播一页假数据」。完整链条、五步读数、修法与门禁写在
**open-accounts 第四十八轮**。一句话版：列表首取还在飞时，`upsert` 会把**每一条既有
线程**都当成新行，播一页假数据让查询变成「idle 且有数据」，紧跟着的 `invalidateQueries`
就不再与在飞的首取合并，而是另发一次体逐字相同的请求。上游同一处从来不播。

⚠ **这一条留着，因为它是「怎么查一个查不出来的飘」的范本**：

- CPU 降速（×4/×8，32 跑）**查不出来**——它把触发和取样窗一起拉长，比值不变；
- **推迟某一条响应**才是有效旋钮——竞态住在两条并行请求的**相对顺序**里，
  只有单独移动其中一条的相位才掰得动它。`page.addInitScript` 包 `window.fetch`，
  命中就 `await sleep(D)` 再返回，D 扫 0/300/900/2000。
- **先分「谁多发」再查「为什么」**：`requestsOnly*` 是**多重集**差、
  `requestBodies` 是**集合**差。请求那一档多一行、体那一档没动 → 一定是
  「同一侧发了两次、体逐字相同」。扒 CI 原始日志（`gh api .../attempts/1/logs`）
  就能看到这两档，比重跑便宜得多。

**第四十八轮收工时这几条命令给出的是（拿它对照，不一致就先查为什么）：**

```
（本轮最后一条提交的 sha）   工作树干净   未推送 0
场景-维度 189 唯一行 0
frontend-vue parity  completed/success
frontend-vue verify  completed/success
```

---

## 第四十八轮收工状态（2026-09-19）

一句话：**那条判了四次「复量消失」的飘，查到根因了——本仓单边，一行上一版设计的残留。**

| 量 | 收工读数 |
| --- | --- |
| 台账 | **189 个场景-维度 / 0 唯一行**（无新增终态；本轮没开新面） |
| 跑时 | `verify` 0（337 文件 / **2726** 单测）　`make e2e` 296 passed / 1.9m　`e2e-parity` 见提交说明 |
| 修前/修后 | 同一把尺子（延迟 0/300/900/2000 × 2 场景 × 2 应用 × 各 2 跑 = 32 跑）：修前 Vue 在非零延迟上 **12/12 发两次**、延迟 0 时 4/4 一次，上游 16/16 恒一次；修后 **32/32 全是一次** |

### 本轮清掉的账

| 类别 | 具体 |
| --- | --- |
| **本仓单边缺陷** | `useThreads.upsert()` 的空缓存那一支会顺手走到 `upsertThreadInInfiniteCache` 末尾的 `invalidateQueries`。列表首取还在飞时，**每一条既有线程**都会走到这一支；放进缓存那一步让查询变成「idle 且有数据」，失效于是不再与在飞的首取合并，**另发一次体逐字相同的 `POST /api/threads/search`**。改成「放进缓存之后直接 return」 |
| **写错的注释**（同一笔修复） | `infinite.ts` 里「走到这个函数的只有『刚建出来的 thread』那条路」——正是这句话让人以为这一支只处理新建线程。已订正 |
| **两条门禁（互为反向）** | ① `use-threads.dom.test.ts`「首取在飞时 upsert 只落缓存，不再发一次搜索」，带反空转断言（先断言首取确实已发出）；② `ui-polish-mobile.spec.ts`「窄屏顶栏在列表缓存没取过时仍显示标题」，带反空转断言（抽屉必须关着）。**两条都做了变异验证** |
| **工具修复** | `PARITY_ONLY` 模式下 `diff.spec.ts` 提前 `return`，`report.json` **从来没落过盘**，而 workflow 那一步的注释写着「这次跑唯一的产物就是这份 report」。产物十几轮来一直是空的（`gh run download` 报 `no valid artifacts found`）。已把落盘挪到 ONLY 分支之前，并把只有 ONLY 才收的 `rawRequests`/`rawTabbables` 一起写进去 |
| **交接文档的端口清单** | 漏了 `e2e-mock` 自己的 3101，照着清完下一跑照样报 `already used`。已补 |

### ⚠ 本轮最贵的一次错：**过度修复，而且三道绿都没拦住**

第一版修法是把「放进缓存」那 5 行整个删掉——理由看着很硬：`git log -S` 只有一条命中、
来自手动查询那一版；上游从来不播；上游那一侧连触发点都没有。
`verify` 0、`make e2e` 296 全绿、针对性探针 32/32 全对。

**整套 `e2e-parity` 红了一行**：`subtask-card/mobile/light/en-US ·
ariaOnlyReact: - text: Stopped subtask`——窄屏下顶栏没标题了。
接着 `ui-polish-mobile` 的 artifacts 抽屉也打不开。

根因：`AgentChat` 有**四处**（标题 / artifacts / goal / todos）把
`threads.threads.find(...)` 当「当前线程的服务端快照」在读，
而窄屏侧栏是抽屉、列表查询根本不跑，那份缓存**只有这 5 行会填**。

### 负结果（**别重做**）

- **CPU 降速查不出这类竞态**：`Emulation.setCPUThrottlingRate` ×4/×8、32 跑，
  两边恒为 1 次；请求时刻 290→1073→2252ms，取样窗同比例变长，**余量始终 ~3 秒**。
  降速把触发和窗口一起拉长，比值不变。
- **「上游发得太晚掉出取样窗」结构上不可能**：上游的请求只等水合，
  而 settle 锚点要等水合＋数据＋渲染，所以它恒在锚点之前。
- `setQueryData` 本身**不会**引发重取（query-core 单独验过）；
  引发重取的是「**先** setQueryData **再** invalidate」这个组合。
  `cancelRefetch: false` 挡不住它（也是 2 次）——因为 seed 之后查询已经算「idle」了。

### ⚠ 最该记住的一条：**「它在守什么」要问「谁在读」，不是「谁在写」**

交接文档第 8 条写着「本仓比上游多出来的东西，删之前问『它在守什么』」。
这一轮我**问了**——`git log -S` 查来历、查 `upsertThreadInInfiniteCache` 的单测、
查 `upsert` 的全部调用方——**全是「谁在写这份缓存」，一条都没问「谁在读」**。
扛事的那**四处**（`AgentChat` 的 `headerTitle` / `authoritativeArtifacts` /
`authoritativeGoal` / `authoritativeTodos`）是**读**方，隔着一个组件、四个 computed。

**正确的问法**：删掉一处写缓存的代码之前，`grep` 那份缓存的**读取点**，
逐个问「它在那条写入不存在时还拿得到东西吗」。

**还有一条同样贵的**：⚠ **单向的门禁挡不住过度修复。** 第一版修法从「多做」
滑到了「少做」，而当时手上那条门禁只守「别多做」。这一轮最后留了**互为反向**的两条。

**而且三道读数全绿也没拦住它**：`verify` 0、`make e2e` 296 全绿、
针对性探针 32/32 全对——抓到它的是整套 189 个取样点里的**一个 mobile 维**。
**取样面的价值不在于它今天报了什么，在于它替你记住了你没想到要看的地方。**

### ⚠ 本轮的仪器账（第六次）

新探针第一跑报 `page.evaluate: TypeError: Failed to construct 'URL': Invalid URL`
——`fetch("/api/...")` 是相对 URL，`new URL()` 不带 base 会抛。
**又一次「第一跑红先怀疑探针」**，这次只花了一次重跑。

## 第四十七轮收工状态（2026-09-19）

一句话：**先筛后铺，15 个新 tablet 样本全干净；那条反复出现的 `/api/skills` 查清了。**

| 量 | 收工读数 |
| --- | --- |
| 台账 | **189 个场景-维度 / 0 唯一行**（tablet 13 → **28**，非 desktop 场景族 13 → **23**） |
| 跑时 | `parity-accept` 3 passed / 19.9m　`verify` 0 |

### 本轮的做法（**下一轮铺维度照抄**）

**铺之前先筛 settle**：把「只有 desktop 的 24 个场景族」逐个在 768 上跑一遍
`runScenario`，只问「settle 得了吗」——5 分钟出一张完整的图：

```
两边都能 settle   28 / 32 个终态
settle 不了的 4 个、且两边都不行：
  artifact-stream-state · artifact-batched-stream(#preview-failed) · artifact-table-preview
```

第四十六轮是在**对照跑里**才撞出 `artifact-table-preview` 到不了的，
花了一次 12 分钟。**先筛便宜得多，而且「两边都到不了」本身就是读数。**

### 那条 `GET /api/skills` 查到根因了：**上游把技能目录取了两遍**

它在四十六、四十七轮各出现一次，我一度判成「上游侧偶发，别再查」——
**当场被下一次全套跑推翻**：第三次出现落在
**`user-message-plain-text/desktop/light/en-US`**，一个**桌面**老键。
也就是说「它总在 tablet 上」只是**我那两轮只在看 tablet 的新键**。

那一屏正是第四十四轮加了一条 `/data-analysis …` 消息的那屏，于是 composer 与
`HumanSlashSkillText` **同时观察 `["skills"]`**。各五跑：

```
vue    [1, 1, 1, 1, 1]        react  [1, 2, 2, 1, 1]   （第二次 274ms → 323ms）
```

上游那第二个观察者在第一次取**已经取回来之后**才挂载，`staleTime` 默认 0 → 后台重取；
本仓两个观察者同一拍挂载、被去重吃掉。**两边同改**：两处各加
`staleTime: 5 * 60 * 1000`（目录只通过 mutation 变，而两边 mutation 都 invalidate，
所以新鲜窗挡不住真更新）。收工读数 **两边 5/5 都是一次**。

⚠ **定位技巧**：jest 的 `@@ -2511` 行号能换算回键名——每条 14 行、pretty-format 按键排序，
比再跑一遍全套便宜。

### ⚠ 判词

- **这 15 个 0 是有信息量的 0**：十个此前完全没有非 desktop 样本的场景族第一次被量。
  与「不开新面的 0」不是一回事。
- ⚠ **「偶发」不是判词，是还没找到根因的代称。** 我写下「记成已知的飘」之后，
  它当场又出现了一次，并且证明我连它落在哪一屏都判错了。
- **一个飘出现在哪些键上，取决于我在哪些键上看过它**，不是它的分布。
- **这条重复除了对照台账的 requests 档，没有任何门禁看得见**——不改渲染、
  不改可访问性树、不改几何，`make e2e` 与 `verify` 全绿。


## 第四十六轮收工状态（2026-09-19）

一句话：**tablet 轴一开就掉出一条真分叉，而它在桌面下是「两个错误互相抵消」。**

| 量 | 收工读数 |
| --- | --- |
| 台账 | **174 个场景-维度 / 0 唯一行**（tablet 样本 4 → 13） |
| 跑时 | `e2e-parity` 190 passed / 34.2m　`make e2e` 296 passed / 2.3m　`verify` 0 |

### 本轮清掉的账

**sidecar 的正文行在 768 上比上游高 14px**，空态垂直居中所以两行字整体上移 7px。
根因是两件事叠加，桌面下**恰好抵消**（`min-h-6!` 算出 36 ＋ 多出来的 30px 盒子
≈ 上游的 64）：

1. **结构**：上游 `PromptInputBody` 是 `display: contents`，sidecar 那一层
   **不产生盒子**；本仓 `ComposerSurface` 的 body CSS 对着的是**主输入框**那一层，
   两个 composer 共用了它。→ 加 `variant: "main" | "sidecar"`。
2. **类串**：本仓 sidecar 抄了主输入框的 `max-h-48 min-h-6! leading-6!`，
   而上游 sidecar **刻意覆盖**成 `max-h-36 min-h-16 text-sm`（不写 leading）。

收工读数：768 与 1280 两个宽度下，页脚块与 textarea **逐像素同号**，
空状态首行 y 从 406/413 变成 413/413。

### 负结果（别重做）

- **重名**：58 个终态扫完，13 种同名兄弟，**0 条对照缺陷**。
  每行一颗那一类不是缺陷；`Toggle Sidebar ×2` 是 shadcn 默认形状；
  唯一真的是 `textbox "Time" ×2`（新建/编辑表单共用 `ScheduleInput`），
  **两边逐字相同**，记账不改，翻案判据写在 open-accounts。
- ⚠ **`ariaSnapshot` 会丢掉无语义角色的容器**，所以「同一格里的同名键」
  这条不变量**在这把尺子上说不出来**——不是没找到，是问不出来。
- `artifact-table-preview` 的 tablet 维**量完撤掉**：settle 锚点在 768 上
  两边都不可见（各两份、`32×160` 与 `0×160`），判词在该场景注释里。
- `thread-history/tablet` 那条 `requestsOnlyReact: GET /api/skills` 是**取样窗时序**：
  两边各连取三次都是 `[1,1,1]`，复跑也没再出现。

### ⚠ 本轮的三笔仪器账

1. **脚本改数组时多写了一个逗号**，`dimensions` 里出现空洞 → `dimension.viewport`
   读到 `undefined`。**改完当场核验落地结果**（第三次记）。
2. **重名扫描第一版用「祖先标签串」当父节点**，把所有 `listitem` 并成一个桶。
   **父节点必须用唯一 id。**
3. **探针漏了 `runScenario`**，量的是一张没打开面板的页（`count: 0`）。
   交接文档早写过「必须用 runScenario 把场景跑到位」。

### ⚠ 最该记住的一条

**「零差异」也可能是两个非零加起来等于零。**
sidecar 那条在唯一采到它的宽度（desktop）上，结构多的 30px 与类串少的 28px
互相抵消；换一个宽度就露出来。**只有一个取样点的「一致」，不是一致。**


## 第四十五轮收工状态（2026-09-19）

一句话：**同一件事换三把尺子，读数从 28 条变成 0 条——第四十四轮那 3 条挂账全是尺子的。**

| 量 | 收工读数 |
| --- | --- |
| 台账 | **165 个场景-维度 / 0 唯一行**（无新增终态） |
| 跑时 | `e2e-parity` 182 passed（新增 keyboard-order 4.5m）　`verify` 0（337 文件 / 2725 单测） |
| 键盘遍历 | **58 个终态 × 40 次按键，两个应用逐位相同**；不同非 body 落点合计 **925** |

### 五跑换来的量法（**下一个人照抄这张表，别重走**）

| 跑 | 改了什么 | 跨应用差异 |
| --- | --- | --- |
| 1 | focusin 流水 + `aria-label ?? textContent` | **28** |
| 2 | 名字换成 `aria-label ?? placeholder ?? innerText` | **5** |
| 3 | 改读**按完之后停住**的 `activeElement` | **0** |
| 4 | 同一棵树再跑一遍 | **1**（同一个环整体差 15 位） |
| 5 | 用 `blur()` 钉起点 | **4**（还多出 2 条同应用不稳）→ **撤掉** |

三条判词：

1. **`textContent` 不是名字。** 表单控件的 textContent 是默认值（上游用
   `placeholder` 取名、本仓用 `aria-label`，**可访问名相同**）；Radix 的
   ScrollArea 会往容器里塞 `<style>`，那段 CSS 也会被算进去；
   模板换行空白在 Vue 里是真空格（`🔥 GitHub` vs `🔥GitHub`）。用 `innerText`。
2. **roving-focus 的容器中转不是落点。** Radix 与 reka 都给 group 挂
   `tabindex=0`，焦点先落容器再转条目。决定性读数：`integrations#skills`
   上游 **43 条事件 / 40 次按键**——事件比按键还多。
3. **⚠ 钉起点的手段可能就是干扰源。** `blur()` 会扰动菜单自己的焦点管理，
   跨应用差异 0 → 4。最终用**比相邻关系**（转移集合）绕开相位漂。

### 新常驻门禁

`keyboard-order.spec.ts`——「两个应用按 Tab 走的是同一条环」，一条用例同时驱动
两个应用，4.5 分钟，三条反空转断言。
**变异验证**：给 `SlashSkillChip` 的移除键加 `tabindex="-1"`，
`sidebar` 与 `sidebar#slash-selected` 当场红并报出丢失的相邻关系；还原后绿。

### 顺带量到的

`sidebar` 那条**默认**终态也覆盖着斜杠胶囊——Tab 在两个应用里都会接受当前建议
（`input-box.tsx:1669` 与 `ChatComposer.vue:1164` 逐字同形）。
所以第四十四轮新加的 `#slash-selected` 不是唯一的覆盖点，但它是**显式**的那个。


## 第四十四轮收工状态（2026-09-18）

一句话：**开了三个新面，掉出两条产品缺陷——其中一条在上游，而且是 WCAG A 级。**

| 量 | 收工读数 |
| --- | --- |
| 台账 | **165 个场景-维度 / 0 唯一行**（新增 `sidebar#slash-selected` 三维，各档全空） |
| 跑时 | `e2e-parity` 181 passed / ~28m　`make e2e` 296 passed / 2.9m　`verify` 0（337 文件 / 2725 单测） |
| React 侧 | `pnpm check` 0 · `prettier --check` 0 |

### 本轮清掉的账

| 类别 | 具体 |
| --- | --- |
| **上游单边缺陷（WCAG 2.1.2）** | `browser-view-panel.tsx` 把 `Tab` 吞掉却**不管有没有真送出去**——`browser-feature` 那一屏停在 "Connecting to live"，焦点进了面板就出不来（26 次 Tab 零次 focusin，`activeElement` 不变，iframe 数 0）。上游的 `sendInput` 本来就返回布尔，只是没人接。已改成与本仓同一个契约 |
| **本仓缺失的上游功能** | 斜杠技能胶囊**两处都缺**：输入区那颗是没有移除入口的纯 `<span>`（上游是 `<button aria-label="Remove /<name>">` + X），会话流那颗**一个字都没画**（`resolveSlashSkillDisplay` 实现了、单测了、没人调用）。补了 `SlashSkillChip.vue` / `HumanMessageText.vue` / `HumanSlashSkillText.vue` 三层 |
| **dark 色差** | 免责声明 `text-muted-foreground/70` → `/67`（上游值）。46/56 个终态看得见，台账看不见——`geometry` 档只采锚点的颜色 |
| **新常驻门禁** | `keyboard-trap.spec.ts`，**两个应用都跑**，带两条反空转断言 |
| **新进取样面** | `sidebar#slash-selected`（输入区胶囊）+ `user-message-plain-text` 夹具里那条 `/data-analysis …`（会话流胶囊） |

### 负结果（**别重做**）

- **`aria-hidden` 子树里的可聚焦元素：0 条。** 静态命中 23/23 两边相同，
  全被模态焦点陷阱抵消（axe 的 `focusable-modal-open` 例外）。
  换成「键盘真的走得进去吗」之后两边 `hiddenHits` 全 0。探针底稿已删。
- **dark 对比度的其余 14 个签名两边逐值相同**，是上游的配色取舍。
  `Continue` 2.38 · `Agents` 1.55 · `PARITY-TODO-DONE` 2.62 · `text-red-500` 4.29–4.38 ·
  Flash/Minimal/Ultra 3.67 · `1 more step` 3.19 · aurora 标题 1.00（尺子够不着）。
  **单方面重新配色会造出新的分叉。**

### ⚠ 本轮的仪器账（两条）

1. **`runScenario` 在 `state.steps` 之后不再 settle**（`captureScenario` 是自己补的那一道）。
   探针照着它写就会读在 animate-in 中段：对比度探针第一跑报出一批 `ratio ≈ 1.00`
   的假失败，补上 `waitForFiniteAnimations` + `waitForDomQuiet` 之后，
   **唯一签名从 39/43 塌到 15/15**。**写探针必须自己补那两道。**
2. **第一跑一片红先怀疑探针**（累计第五次）：`aria-hidden` 探针两边各 23 个场景命中，
   看着像一堆账，实际是问法漏了模态例外。

### 挂账：3 条**只在上游有**的 tab 落点（下一轮查）

| 终态 | 只在上游的落点 | 猜测（**未验证**） |
| --- | --- | --- |
| `integrations#skills` | `div(tablist)"Agent Skills"` | Radix Tabs 的 list 容器本身可聚焦 |
| `artifact-preview` / `artifact-batched-stream` | `div(group)""` | Radix ToggleGroup 根可聚焦 |

⚠ 与 wave 98/149 判过的 `scroll-area-viewport` 同一族（「上游给容器补了 tabIndex，
本仓没跟」），**那一族当时判的是「不跟」**。所以**不能直接照抄上游**，
先去看它是不是同一笔账。


## 第四十三轮收工状态（2026-09-18）

一句话：**前提变异跑通了——方法成立，两条轴上 0 条空转。**

| 变异 | 结果 | 喂它的 spec | 如期变红 | 仍全绿 |
| --- | --- | --- | --- | --- |
| `threads` 恒空 | 107 failed / 189 passed（7.3m） | 31 | **27** | 4 |
| `agents`+`skills`+`scheduledTasks`+`projects` 恒空 | 22 failed / 274 passed（3.2m） | 9 | **4** | 5 |

九个仍全绿的**逐条查完 0 条空转**（自带 stub / 断言的是别的东西 / 本来就喂空 /
我的检测假阳性）。判词与完整表格见 open-accounts 第四十三轮那一节。

**怎么跑**（照抄）：改 `tests/e2e/utils/mock-api.ts` 里那几行
（`options?.threads` / `agents` / `skills` / `scheduledTasks` / `projects`）
让它恒空 → `make e2e` → 按 spec 聚合 → 和「显式喂了这个选项的 spec」求交集 →
**整份仍全绿的就是候选**。跑完**一定要还原并 `grep -c` 确认残留为 0**。

⚠ 判「谁喂了这个选项」**不能只 grep `"<opt>:"`**——spec 自己路由的载荷里同名的键
会混进来（本轮 `ui-primitives-a11y` / `integrations` 两条假阳性）。
按 `mockLangGraphAPI\([^)]*<opt>:` 这样的形状匹配。


## 第四十二轮收工状态（2026-09-18）

一句话：**静态扫描回答不了「这条门禁会不会红」。** 两条静态扫描全是死路（读数见下），
唯一落地的是把第四十轮那次实测常驻成门禁。

| 量 | 收工读数 |
| --- | --- |
| 台账 | **162 个场景-维度 / 0 唯一行** |
| `narrow-screen-overflow.spec.ts` | **2 条用例 / 4.4m**（新增第二轮扫描 26.5s） |
| `verify` | 0 |

### 本轮的三条读数

| 做的事 | 读数 | 判词 |
| --- | --- | --- |
| 「死 testid」扫描 | 179 个 testid，对不上 13 个，**真账 0** | 不值得常驻：13 条要豁免而一条都抓不到 |
| 「无肯定断言的缺席断言」扫描 | **230 条**（候选点才 176 个） | **仪器坏了**，判死路，别再迭代那个正则 |
| 窄屏扫描第二轮 | 14 条「到不了」全部量到，0 条溢出 | 已常驻，变异验证过 |

⚠ **查空转的正确做法不是扫源码**：本仓两次真正抓到空转，靠的都是**去量那一屏**
（`background-tasks#disabled` 的空 locator、`settings-narrow-screen` 的空面板）。
**挑一条门禁、把它要证明的前提拿掉、跑一遍**——这才是能用的方法。


## 第四十一轮收工状态（2026-09-18）

一句话：**补夹具只修了一半，空转本身才是那个缺陷。**
第三十九轮发现「门禁量的是空面板」，补了夹具；但补夹具是一次性的——哪天 mock
不作答、端点改名、或者新增一个带列表的分区，那条断言又会悄悄退回空转，**而且它是绿的**。
这一轮给它加了**反空转断言**，并顺带订正了我自己上一轮写错的一句话。

| 量 | 收工读数 |
| --- | --- |
| 台账 | **162 个场景-维度 / 0 唯一行** |
| 跑时 | `e2e-parity` 175 passed / 25.8m　`make e2e` 296 passed / 2.1m　`verify` 0 |

### 十个设置分区在 360px 上的余量（面板 vs 它那格，实测）

```
about 210 · memory 154 · tools 134 · notification 132 · subagents 110 ·
skills 106 · account 74 · integrations 37 · appearance 24 · channels 22
```

装上夹具之后 `tools` 余量 98、`subagents` 余量 106——**没有缺陷**。
**最紧的两个是 `channels`(22) 与 `appearance`(24)**，门限是 12。

### ⚠ 订正：上一轮我写的「四个分区量的是空面板」有一半是错的

`integrations`（正文 827 字符、3 颗按钮）与 `skills`（3 行）**本来就有内容**。
真正空着的只有 `tools` 与 `subagents`，已经接上共享夹具。
**判据：写进交接文档的「哪些还没量」也要有读数**，否则下一轮会照着它去修不存在的洞。

### 本轮我自己的两笔仪器账

1. **一次静默失败的编辑。** 用 `str.replace` 往门禁里插两条路由，锚点因为 prettier
   已重排而匹配不上，`replace` **返回原串、不报错**，于是我拿着「夹具已装好」的前提
   去读那 4 条红。**判据：脚本改文件必须断言锚点命中**（`assert s.count(old) == 1`）。
2. **第一反应又是怀疑应用。** 那 4 条红先当成「列表异步没到」，改 `expect.poll`
   还是红；写一个同样设置的调试用例才照出来 `items` 是 2 和 3、请求也确实发了，
   **应用一直是对的**。


## 第四十轮收工状态（2026-09-18）

一句话：**「只有一边有问题」可能是我的进入方式造成的。**
`workspace-changes#reasoning-menu` 从 1280px 缩下来时两边读数确实不同，截图也对得上，
我差点判成本仓单边；分档再量才发现上游是在 800→700 之间把输入区**整块重挂**了，
菜单关闭只是副作用。换成 700px 起点，**两边逐像素相同**——是一条两边共有缺陷。

| 量 | 收工读数 |
| --- | --- |
| 台账 | **162 个场景-维度 / 0 唯一行** |
| 跑时 | `e2e-parity` 175 passed / 25.7m　`make e2e` 296 passed / 2.4m　`verify` 0 |
| React 侧 | `pnpm check` 0 · `prettier --check src` 0 |

### 本轮清掉的账

| 类别 | 具体 |
| --- | --- |
| **负结果（别重做）** | 14 条「窄屏到不了」用「桌面开 → 缩到 360」量过，**两个应用各一遍：`documentElement.scrollWidth` 全 360、非「有意横滚」的横滚容器 0 条** |
| **两边共有缺陷** | `hidden … sm:inline-flex` 的推理深度键在 `sm` 以下塌成 0×0，菜单仍开着并停在 `[0, 4, 280]`——两边同改成受控菜单 |
| **新常驻门禁** | `mode-hover-guide.spec.ts` 加一条，**起点宽度 700**（1280 起步永远绿） |

### 顺带量清的

「缩窗口会把浮层弄没」**两个应用完全一致**：`channels#runtime-config` /
`runtime-config-edit` 对话框 1→0、`thread-history` 菜单 2→0、`thread-list-pin` 菜单 1→0。
桌面侧栏在 <768px 卸载，挂在它下面的浮层跟着卸载。**不是本仓的毛病**，
但也意味着这条路子对侧栏拥有的对话框无效——量不到就要显式记下来。

### 一条没成立的探针

想量「跨 `md` 重挂会不会丢输入区草稿」，探针写坏两次（定位器选错、`fill` 没生效）。
**关于「丢草稿」这一轮没有任何读数，不要引用。**


## 第三十九轮收工状态（2026-09-18）

一句话：**这一轮的缺陷是门禁自己的夹具放进来的。**
`settings-narrow-screen.spec.ts` 覆盖全部十个设置分区、两档宽度、带余量门限，
十轮以来一直绿——而它用的是共享 mock 的 `{ enabled: false, providers: [] }`，
**量的是一块空面板**。装上内容之后同一条断言当场红，两个应用都红。

| 量 | 收工读数 |
| --- | --- |
| 台账 | **162 个场景-维度 / 0 唯一行** |
| 四张工单表 | 路由 0 · 文案 0 · 取样路由 0 · 上游 spec pending 1（有判词） |
| 跑时 | `e2e-parity` 175 passed / 25.0m　`make e2e` 295 passed / 2.0m　`verify` 0 |

### 本轮清掉的账

| 类别 | 具体 |
| --- | --- |
| **结构性、两边共有** | 设置对话框栅格在 `md` 以下没有显式列模板——隐式列 `auto` + `min-width:auto` 被内容撑开。实测列宽解析成 296.9px（本仓）/ **500.1px**（上游），而那一格只有 278；上游那块面板**冲出对话框和视口 181px** |
| **真分叉** | 上游 `ItemActions` 缺 `flex-wrap`。补上之后上游的固有最小宽度 500→297、528→308，**与本仓逐像素相同** |
| **两边共有** | 「移除 provider 配置」按钮 `whitespace-nowrap`，固有最小宽度 229px，而卡片只有 244 可用 |
| **门禁的夹具** | `settings-narrow-screen.spec.ts` 接上 `CHANNEL_PROVIDERS`；夹具提到 `tests/support/channel-providers.ts`，两个套件共用一份 |

### 三条最该记住的

1. **「门禁覆盖了这个分区」不等于「门禁量到了东西」。**
   夹具是门禁的一部分，不是背景。十轮绿的那条门禁量的是空面板。
2. **换了测量对象的尺子不是同一把尺子。**
   我先量「整个对话框的 min-content vs 实宽」，七个终态负余量——全是噪音，
   因为对话框宽度本来就被视口硬顶住。换成已验证的「面板 vs 它那格」之后，
   对照组三条立刻给出 `targetWidth == cell == 278`、余量 37/45/98，与门禁绿读数吻合。
3. **变异验证又一次推翻了「说得通」的东西。**
   我以为撤掉栅格那一档门禁会红；实测 `2 passed`——因为按钮改可换行之后
   固有最小宽度已掉到 278 以下，栅格那条现在是**潜在守卫**。
   要不是做了变异，我会把「A 也能红」当事实写进这份文档。

---

## ⚠ 别再做的事（逐条带读数）

### 1. 新仪器第一跑的结果，先假设是仪器错了

本轮又中一次（累计第四轮）：第一把尺子量对话框本身，报出 7 条负余量，
逐条查下来 `escaped` 全空、`docScrollWidth` 全是 360、横滚只有两条已登记的
「有意横滚」——**那 7 条里只有 channels 那两条是真的**。

**先拿一个已知答案的样本验仪器，再去读它的结论。**
本轮的已知样本是 `integrations`：设置门禁说它余量 ≥12，新尺子给 37，对上了。

### 2. 报出「只有一边有问题」时，先问这是不是我进入方式造成的

第四十轮实测：`workspace-changes#reasoning-menu` 从 **1280** 缩到 360，
上游菜单关了、本仓没关（截图也对得上）——看起来是本仓单边。
从 **700** 起步（已经过了上游跨 `md` 的重挂点）再量，**两边逐像素相同**。
上游那次「关掉」是重挂的副作用，不是它处理了这件事。

**一次实测能推翻推理，但两次实测可以互相推翻。**
实验的**起点**本身是设计的一部分，换个起点可能得到相反结论。

### 3. 「桌面开对话框 → 缩窗口到 360」会把一部分对话框弄没

实测 `channels#runtime-config` 与 `runtime-config-edit`：
`dialogsBeforeResize: 1 → dialogsAfter: 0`。桌面侧栏在 <768px 卸载，
挂在它下面的对话框跟着卸载。**用这个办法扫描时，必须显式记「缩完还在不在」**，
否则「没量到东西」会长得和「量过、没问题」一模一样。

### 4. 动手改之前，先看那份文件自己怎么说的

本轮又省下一次：`ChannelConnections.vue` 的注释早写着
「`flex-wrap justify-end` 留着——两边都可能三颗」。那句话直接给出了
上游缺 `flex-wrap` 这条真分叉的方向。
**记忆 `deerflow-parity-three-docs` 的同一形状。**

### 4b. 写探针时 `runScenario` 之后必须自己补 settle（第四十四轮）

`runScenario` 在 `state.steps` 之后**不再 settle**——`captureScenario` 是自己补的
那一道（capture.ts:845）。照着 `runScenario` 写的探针会**读在 animate-in 中段**：
对比度探针第一跑报出一批 `ratio ≈ 1.00` 的「失败」（`#2c2c2b` on `#2d2d2c` 的
Save 键），全是那一帧 opacity 还在 0.05。补上
`waitForFiniteAnimations(page)` + `waitForDomQuiet(page)` 之后
**唯一签名从 39/43 塌到 15/15**。

### 4c. 拿现成的 a11y 规则当不变量之前，先查它的**例外**（第四十四轮）

`aria-hidden` 探针第一跑两边各 23 个场景命中，看着像一堆账——
实际是漏了 axe-core 的 `focusable-modal-open`：**模态开着时背景被 `aria-hidden`
正是正确写法**，焦点由 FocusScope 陷住。
**判据：把规则换成「用户真的经历得到吗」再量**——换成「键盘走得进去吗」之后
两边 `hiddenHits` 全 0。

### 4d. 颜色不要在 JS 里手工解析（第四十四轮）

本仓色板是 `oklch(...)`，**Chrome 的 computed value 原样保留色彩空间**
（不会降级成 `rgb()`）。把颜色画进 1×1 canvas 再 `getImageData` 读像素，
顺带把 alpha 合成和祖先 opacity 一起做掉。

### 4e. 钉住实验起点的动作，本身要先证明它不改变被测对象（第四十五轮）

第四十轮的判据是「起点是设计的一部分」。这一轮补上后半句：
想用 `blur()` 把焦点清回 body 来统一起点，**当场把读数弄坏**——
跨应用差异 0 → 4、同应用两跑不稳 0 → 2，因为菜单开着时 blur 会扰动
浮层自己的焦点管理，而那正是要量的东西。
**换成「比相邻关系」绕开相位漂**，比「强行统一起点」稳。

### 4f. 查竞态：CPU 降速无效，**推迟某一条响应**才是旋钮（第四十八轮）

同一个飘，两种旋钮的读数：

```
CDP CPU 降速 ×4 / ×8，32 跑        两边恒 1 次（触发与取样窗同比例变长，余量始终 ~3s）
把某一条响应推迟 300/900/2000ms    Vue 12/12 发两次、上游 16/16 全 1 次 —— 当场复现
```

**竞态住在两条并行请求的相对顺序里**，全局降速动不了这个顺序；
只有单独移动其中一条的相位才掰得动。做法：`page.addInitScript` 里包 `window.fetch`，
命中目标就 `const r = await orig(...); await sleep(D); return r;`。
⚠ 相对 URL 不能直接 `new URL()`（第一跑就栽在这）。

### 4g. 先分「谁多发」，再查「为什么」（第四十八轮）

`requestsOnly*` 是**多重集**差，`requestBodies` 是**集合**差
（`diff-entry.ts` 里有判词）。所以：

```
请求那一档多一行 + 体那一档没动  →  同一侧发了两次，体逐字相同
请求那一档多一行 + 体那一档也动  →  发了一条不一样的请求
```

扒 CI 那次红的原始日志就能同时看到这两档
（`gh api repos/<owner>/<repo>/actions/runs/<id>/attempts/1/logs` 下回来是 zip），
**比重跑一次 50 分钟的 CI 便宜得多**，而且方向一开始就定死了。

### 5. `hidden` 断言前面必须有一条 `visible`

`locateTarget(...).first()` 匹配不到时是个**空 locator**，而
`waitFor({ state: "hidden" })` 对不存在的元素**立刻通过**。

### 6. 锚点不能写死英文

场景跑 en-US 与 zh-CN 两维。**优先挑夹具里的字符串**（`display_name`、
`mock.threads[].title`）——它不过词典，天生语言无关，而且证明的东西更强。
本轮 channels 场景的注释里已经把这条写成判词了。

### 7. 本机 `make verify` **不含** `e2e-mock`

**改动碰到布局 / primitive 时，本机要额外跑 `make e2e`**（约 2.4 分钟，296 条）。

### 8. 「逐字对齐上游」不是无条件正确的

本仓比上游多出来的东西，可能正扛着上游没有的约束。
**删之前问「它在守什么」，而不是只问「上游有没有」。**
本轮的 `flex-wrap justify-end` 就是反方向的同一条：本仓多出来的那颗类
正是上游缺的那条账。

### 9. 「余量为 0」和「守住了」长得一模一样

只断言「溢出为 0」抓不到「余量为 0」。本轮 channels 在 **375px** 上的余量是 **−4**，
而 `panelOverflow` 在 375 上只有 4——**门限 12 是唯一抓得住 375 那一档的东西**。

### 10. 改 React 的 JSX 注释，别插进三元表达式的分支位置

`{cond ? ( {/* 注释 */} <X/> ) : null}` 是语法错误。注释要放在
`{cond ? (` **之前**。第三十九轮踩了一次，`pnpm check` 之前先自查 diff 更快。

### 11. 上游的 `import/order` 是 error 不是 warning

第四十轮给 `input-box.tsx` 加了一行 import，放在文件头 import 块之后就红了
（`@/hooks/use-mobile` 要排在 `@/core/**` 之后）。`eslint --fix` 一把过。

---

## ✅ 已经量过、**别重做**（每条都带读数和判词）

### 六条单应用不变量（第三十八轮）

| 不变量 | 读数 |
| --- | --- |
| 窄屏溢出（57 终态） | 1 条真分叉，已修并做成常驻门禁 |
| 终态稳定（57 终态） | 4 条，含一条**一直在空壳上通过**的断言，已修 |
| 设置面板窄屏余量（10 分区） | 2 条共有缺陷 + CI 上第 3 条，已修并常驻 |
| **可访问名**（57 终态 ×2 应用） | **真分叉 0 条**，不值得常驻（open-accounts 第十四节） |
| **语言 × 窄屏**（42 可达终态 zh-CN） | **0 条溢出**（第十五节） |
| **「点得动吗」**（57 终态 ×2 应用） | 收紧后 **0 条**（第十六节） |

### 对话框窄屏扫描（第三十九轮）

**23 个终态开着对话框，全量量过一遍。** 负余量七条里只有 channels 那两条是真的，
其余是「有意横滚」（`artifact-table-preview` −271 / `artifact-batched-stream` −133、−97 /
`workspace-changes#changes-panel` −25，都含已登记的表格或 `pre`）
或尺子对象错了的产物（`browser-feature` −3、`background-tasks#drawer` 余量 10）。
**别拿「整个对话框的 min-content」当判据重扫一遍。**

### 第四十四轮开的三个面（**别重做**）

| 面 | 读数 | 判词 |
| --- | --- | --- |
| `aria-hidden` 里套可聚焦元素 | 静态命中 23/23 两边相同；换成「键盘走得进去吗」后两边 `hiddenHits` **全 0** | 负结果。探针底稿已删 |
| dark 文本对比度（两边各 ~1990 个元素） | 唯一签名 15/15，**跨应用分叉只有 1 条**（免责声明 `/70` vs `/67`，已修） | 其余 14 条两边逐值相同，是上游配色取舍，**别重新配色** |
| Tab 会不会被吸住 | 上游 `browser-feature` 吸住（已修），其余两边全过 | **已常驻**成 `keyboard-trap.spec.ts`，两个应用都跑 |

⚠ 同一个面上「逐位比 Tab 序列」**第四十五轮已经走完**（0 条差异，已常驻），
见下面那一节。这里原来指向「下一轮最该先拿的第 1 条」，那个位置早就换人了。

### 第四十五轮把键盘面走完（**别重做**）

| 量 | 读数 | 判词 |
| --- | --- | --- |
| 两个应用的 Tab 落点序列 | 58 个终态 × 40 次按键，**逐位相同** | 已常驻 `keyboard-order.spec.ts` |
| 第四十四轮那 3 条「只在上游有的落点」 | **全是 roving-focus 容器的中转**（上游 43 事件 / 40 按键） | 结清，不是落点 |
| 用 `blur()` 钉起点 | 跨应用差异 0 → **4**、同应用两跑不稳 0 → **2** | **负结果，别再试** |

⚠ 这一面的量法有三条硬判据（`textContent` 不是名字 / 容器中转不是落点 /
起点会漂所以比相邻关系），**全写在 `keyboard-order.spec.ts` 的文件头**，
改那条门禁之前先读它。

### 已量到的负结果

- 8 条产品路由在 360px 默认态全干净（`documentElement.scrollWidth === 360`、越界元素 0）；
- `subagent-editor` 对话框有富余（dialog 328 / min-content 218）。
  **缺陷在对话框的内容里，不在路由本身。**

### 320px 那 3px（低优先，取舍已写）

两边一起溢出 3px，同值、不是对照问题、不在受支持档里。
翻案判据：哪天 320px 进了受支持档，回来重量那条链。

---

## 下一轮最该先拿的（按顺序）

### 1. **逐 spec 的 `page.route` 前提变异**——名单上唯一还没开的面

第四十三轮把**共享 mock** 的五条列表选项变异过了，**0 条空转**。
剩下的大头是**每个 spec 自己的 `page.route`**：31 个 spec 用它喂数据
（第四十八轮重量的；此前文档写 28）。

**⚠ 「它没有统一入口」这句话是可以绕开的**（第四十八轮想到、**还没跑**）：
几乎每个 spec 都先调 `mockLangGraphAPI(page, ...)` 再注册自己的路由，
所以在 `mockLangGraphAPI` 的**末尾**把 `page.route` 换成一个记数的空操作，
就等于「一次性关掉所有 spec 级路由、保留共享 mock」——
**一个开关变异 31 个 spec**。已量过的前提：

```
用了 page.route 但从不调 mockLangGraphAPI 的： chat-dataflow.spec.ts（1 个）
第一处 .route( 出现在第一处 mockLangGraphAPI( 之前的：
  channels.spec.ts · settings.spec.ts · thread-without-checkpoint.spec.ts
  （文本序，不等于执行序——这三个要单独核，别默认它们被盖到了）
```

跑法：`ZZ_KILL_SPEC_ROUTES=1 make e2e` → 按 spec 聚合失败 →
**整份仍然全绿的 spec 就是候选**，再逐条判是真空转还是「那些路由本来就不是它断言的对象」。
⚠ 跑完**一定要还原并 grep 核验残留为 0**（第四十三轮的纪律）。

各 spec 的 `page.route` 条数 / 肯定断言 / 缺席断言（第四十八轮量的，正则见提交说明）：

```
channels 23/58/9 · agent-chat 19/20/6 · sidecar-chat 17/57/20 · chat 16/92/14
integrations 13/24/3 · settings 7/17/3 · scheduled-tasks 6/36/6 · artifact-preview 6/39/2
thread-history 5/50/12 · chat-dataflow 5/9/1 · thread-list-a11y-shape 3/30/7
artifacts-a11y-shape 3/9/9 · workspace-shell 2/22/9 · …共 31 个
```

⚠ **别再写静态扫描**（第四十二轮两条全是死路）。

### 2. 上游那一侧的门禁——**第四十四轮开了个头，还没铺完**

`keyboard-trap.spec.ts` 是**第一条两个应用都跑的门禁**，它当场就抓到一条只有上游
有的缺陷。但窄屏那一类仍然只跑本仓：`settings-narrow-screen` 只跑本仓，
而 `channels#settings-panel` 没有 mobile 维（场景的 settle 要桌面侧栏），
所以对照台账也看不见。**上游那一侧的窄屏回归仍然没人发现。**
两条路：给那个场景补一条「先开抽屉」的 mobile 终态，
或者把窄屏余量断言加进 parity 取样（单独断言，不进台账）。

### 3. 挑下一条**单应用不变量**（方向已验证，但**现成的都用完了**）

⚠ **这一条现在是空的，别照着上一版去做**：`aria-hidden` 里套可聚焦元素（0 条）、
焦点陷阱（已常驻）、dark 下的对比度（1 条已修）**第四十四轮走完**；
**重复的可访问名第四十六轮走完（0 条）**，而「缺可访问名」第三十八轮就判死过。
要用这条路，得先想出一条**新的**单应用不变量，而不是从名单里挑。

### 4. 把「桌面开 → 缩到 360」做成 `narrow-screen-overflow.spec.ts` 的第二轮扫描

⚠ **那 14 条第四十轮已经量过了（两个应用各一遍，0 条溢出），别重做那次扫描**；
要做的是把它**常驻**下来，并且**显式断言「缩完浮层还在不在」**——
已知缩完会掉的：`channels#runtime-config` / `runtime-config-edit`（对话框）、
`thread-history` / `thread-list-pin`（菜单），**四条两边都掉，不是本仓的毛病**。
掉了的单独一张表各写原因，否则「没量到」会长得和「量过、没问题」一模一样。

### 5. 继续扩取样面（⚠ tablet 已经 28 个样本 / 14 个场景族，**不再是最薄的那条轴**）

- `baseline/parity-route-sampling.json` 是路由坐标系，先看哪些路由取样点最少；
- 对照场景 id **就是上游 spec 文件名**，想不出对应 spec 就加不了新场景（棘轮会红）；
- 加新场景要**给它加终态断言**，否则「零差异」可能只是「压根没采到」。

### 6. 工单表读数（会漂，自己重量）

```
react-parity-scope.json  → pendingRoutes.routes  0     （注意它是个对象，不是数组）
upstream-i18n-map.json   → pending.keys          0
parity-route-sampling.json → pending             0     （exempt 4）
parity-scenario-coverage.json → pending          1     artifact-table-performance
                                                       **已有完整判词，别重新问**
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

### 一次性探针：写 `tests/e2e-parity/zz-*.spec.ts`，用完即删

**必须用 `runScenario(page, base, scenario, dimension, state)` 把场景跑到位**
（自造夹具会失败）。第三十九轮用的四个形状：

1. **全量扫描**：遍历 `PARITY_SCENARIOS × scenarioStates`，每个终态拍一次快照；
2. **min-content 承重链**：从根往下，每层把元素临时设成 `width:min-content` 读固有宽度，
   挑「不超过父亲 min-content」的最宽孩子继续。
   ⚠ **break 的门限不能写 `mine - 1`**：一层 `rounded-lg border` 就差 2px，
   链会在第一层就断掉（本轮踩过，改成 `mine - 4` 才走得下去）；
   ⚠ **`w-full` 的孩子固有宽度更大但不参与**；
   ⚠ 在**横向 flex 容器**里逐个量孩子不可靠——设一个孩子的宽度会让兄弟重排。
   量到 flex 容器那一层就停，改成直接列「固有最小宽度 ≥ N 的元素」。
3. **直接开到位**：`applyScenarioBackend` + `applyScenarioStubs` + `goto(URL)`，
   **不缩窗口**——用来复核「缩窗口」那条路子有没有造出假读数（本轮复核成立）。
4. **截图**：`page.screenshot()` 两个应用各一张。**最后判「用户看得见吗」只有它说了算**。

### 变异验证（**门禁签入前必做**）

```bash
# 备份 → 撤掉修正 → 跑门禁 → 还原 → 再跑一次确认绿
cp <file> $SCRATCH/<file>.bak
# ...改...
make e2e / playwright test -c playwright.config.ts <spec> --grep <name>
cp $SCRATCH/<file>.bak <file>
```

⚠ **别用 `git checkout -- <file>` 还原**——它会把你这一轮在那个文件里写的
注释一起回滚。本轮踩过一次，注释重写了一遍。

### Linux 定点复量

```bash
gh workflow run "frontend-vue parity" -R aiAppSpace/deer-flow \
  --ref main-wc -f parity_only=integrations#permission-request
```

**读产物，别读颜色**——该模式下那次 run 一定是绿的，结论在 artifact
`parity-failures` 的 `e2e-parity/report.json` 里。

⚠ **第四十八轮之前这条路是断的**：`diff.spec.ts` 在 ONLY 分支里提前 `return`，
report **从来没落过盘**，产物是空的（`gh run download` 报 `no valid artifacts found`），
结论只在**日志**里。本轮已修，`rawRequests` / `rawTabbables` 也一起进产物。
**在更早的提交上定点复量时，去日志里搜 `PARITY_ONLY=` 那一行。**

### 截图归属

`diff.spec.ts` 里 `captureScenario` **先采 Vue、再采 React**，
所以 `test-failed-<2i+1>` 是 Vue、`<2i+2>` 是 React。**别按奇偶猜**。

---

## ⚠ 判据（历轮被订正十几次，形状只有一个）

**「说得通的东西」和读数长得一模一样。**

- **一次运行是一个样本**——判「修好了」要同一棵树连着量到稳定；判「飘」两次不一致就够；
- **推翻一次实测只能靠另一次实测**，算术和源码结构都只是线索；
- **总数不是读数**——它会被「尺子变准」和「修好差异」两个相反方向同时推动；
- **「源码一样」不等于「运行时一样」**；反过来，**「文档写过」不等于「现在还成立」**，
  但**「文件头写过并带读数」通常就是判词**，重开之前先读它；
- **「台账 0 行」不等于「这一屏对齐了」**——它还可能是两边一起采早了；
- **「门禁绿」不等于「这一屏没问题」**——它还可能是**夹具是空的**（第三十九轮实证）；
  补夹具只修了一半，**空转本身要被断言堵住**，否则它会再回来（第四十一轮）；
- **脚本改文件必须断言锚点命中**——`str.replace` 匹配不上时返回原串、不报错，
  于是你会拿着一个假前提去读后面的红（第四十一轮实证）；
- **尺子报出差异时先问：两边用户看到的东西有没有区别**——角色/几何/可达性全同、
  只差一颗内部样式钩子或只差一个时长，那是尺子的问题，不是应用的问题。

---

## 跑长命令的纪律

`make e2e-parity` ~25 分钟、`make e2e` ~2 分钟、`make verify` ~4 分钟。
**用 `run_in_background` 起一次然后等通知**，不要开 `while pgrep; do sleep; done` 轮询。
要串行跑多套就写成一条命令（`make a > a.log; echo "A=$?" >> a.log; make b > b.log; ...`）。

⚠ **门禁的退出码要卡住提交**，不能只打印。

⚠ **拿退出码行判完成，不要拿任务通知判**——第四十二轮两次后台跑被中途掐掉，
日志停在构建、没有退出码行，而任务通知显示「completed」。

⚠ **被掐掉的跑会留下占着端口的进程**，下一跑报 `http://localhost:3115 is already used`。
⚠ **这份清单原来漏了 `e2e-mock` 自己的端口 3101**（`playwright.config.ts` 的
`E2E_PORT ?? "3101"`）——第四十八轮照着它清完，下一跑照样报
`localhost:3101 is already used`。两套端口一起清：

```bash
pkill -9 -f playwright; pkill -9 -f nuxt
for p in 3101 3113 3114 3115 3116 8021 8022; do lsof -ti tcp:$p | xargs -r kill -9; done
```

⚠ **改文件的脚本不要放后台**：`AssertionError` 会进任务输出文件而你不会去读，
于是你拿着「已经改好」的假前提去读后面的红（第四十二轮第三次栽在这上面）。
**改完当场 grep 核验落地结果。**

⚠ **`frontend-vue parity` 的并发组是 `cancel-in-progress`**：run 跑着时推送会把它取消。
纯 docs 提交不匹配 `paths:`，推了既不触发也不取消。

⚠ **改了 React 侧要另外跑 `cd frontend && pnpm check` 与 `pnpm format`**——
`make verify` 只管 `frontend-vue/`。
