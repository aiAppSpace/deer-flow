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

⚠ **run 挂在「那次推送的 tip」上，不是挂在代码那条提交上**（2026-09-18 实测）：
第三十九轮把代码提交和 docs 提交一起推出去，两条 run 都落在 docs 那条 tip
`482e67bf` 上。所以「纯 docs 不触发 CI」只对**整条推送都是 docs** 成立。

**第四十一轮收工时这几条命令给出的是（拿它对照，不一致就先查为什么）：**

```
（本轮最后一条提交的 sha）   工作树干净   未推送 0
场景-维度 162 唯一行 0
frontend-vue parity  completed/success
frontend-vue verify  completed/success
```

第三十九轮那次推送（`482e67bf`）的 CI 已确认**双绿**；
第四十轮（`4c3fc4dd`）verify 绿、parity 收工时仍在跑，**新窗口自己复核一遍**。

---

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

### 已量到的负结果

- 8 条产品路由在 360px 默认态全干净（`documentElement.scrollWidth === 360`、越界元素 0）；
- `subagent-editor` 对话框有富余（dialog 328 / min-content 218）。
  **缺陷在对话框的内容里，不在路由本身。**

### 320px 那 3px（低优先，取舍已写）

两边一起溢出 3px，同值、不是对照问题、不在受支持档里。
翻案判据：哪天 320px 进了受支持档，回来重量那条链。

---

## 下一轮最该先拿的（按顺序）

### 1. 把前提变异铺到「每个 spec 自己的 `page.route`」那条轴上

第四十三轮把共享 mock 的五条列表选项都变异过了，**0 条空转**（读数见收工状态）。
**剩下的大头是逐 spec 的 `page.route`**——28 个 spec 用它喂数据，
而它没有统一入口，所以没法一次性变异。

做法：挑那些 `page.route` 条数多、而「缺席断言」占比高的 spec 逐个来。
排名（route 数 / 肯定断言 / 缺席断言）：

```
sidecar-chat 12/40/1 · agent-chat 11/25/11 · chat 7/38/3 · channels 6/40/6
scheduled-tasks 6/30/4 · artifact-preview 6/26/2 · integrations 5/24/3
artifacts-a11y-shape 1/14/13 · thread-history 2/24/11 · workspace-shell 2/17/8
```

⚠ **别再写静态扫描**（第四十二轮两条全是死路）。

### 2. 上游那一侧没有任何门禁钉着这一类

`settings-narrow-screen` 只跑本仓；而 `channels#settings-panel` 没有 mobile 维
（场景的 settle 要桌面侧栏），所以对照台账也看不见。
**上游单边回归会没人发现。** 两条路：给那个场景补一条「先开抽屉」的 mobile 终态，
或者把窄屏余量断言加进 parity 取样（单独断言，不进台账）。

### 3. 挑下一条**单应用不变量**（方向已验证）

还没试过的，各自**先当探针量一遍、有收获再常驻**：
`aria-hidden` 里套可聚焦元素、重复的可访问名、焦点陷阱、**dark 下的对比度**。
⚠ 上面那张表里标 0 条的**别重做**。

### 4. 把「桌面开 → 缩到 360」做成 `narrow-screen-overflow.spec.ts` 的第二轮扫描

⚠ **那 14 条第四十轮已经量过了（两个应用各一遍，0 条溢出），别重做那次扫描**；
要做的是把它**常驻**下来，并且**显式断言「缩完浮层还在不在」**——
已知缩完会掉的：`channels#runtime-config` / `runtime-config-edit`（对话框）、
`thread-history` / `thread-list-pin`（菜单），**四条两边都掉，不是本仓的毛病**。
掉了的单独一张表各写原因，否则「没量到」会长得和「量过、没问题」一模一样。

### 5. 继续扩取样面（tablet 只有 4 个样本，是最薄的一条轴）

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
清理：`for p in 8021 3115 3116; do lsof -ti tcp:$p | xargs -r kill -9; done`

⚠ **改文件的脚本不要放后台**：`AssertionError` 会进任务输出文件而你不会去读，
于是你拿着「已经改好」的假前提去读后面的红（第四十二轮第三次栽在这上面）。
**改完当场 grep 核验落地结果。**

⚠ **`frontend-vue parity` 的并发组是 `cancel-in-progress`**：run 跑着时推送会把它取消。
纯 docs 提交不匹配 `paths:`，推了既不触发也不取消。

⚠ **改了 React 侧要另外跑 `cd frontend && pnpm check` 与 `pnpm format`**——
`make verify` 只管 `frontend-vue/`。
