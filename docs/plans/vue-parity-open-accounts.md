# React → Vue 平替：挂账总清单（截至 2026-09-12 第四轮）

这份文件回答一个问题：**「还欠什么」。** 逐条给状态，不给散文。
深度背景在 `vue-parity-handoff.md`，踩坑线索在 Claude 记忆 `deerflow-parity-harness-plan`。

> ## 2026-09-12 收工时发现两条门禁**一直红着**，都不是这一轮造成的
>
> 这一轮把九条门禁逐条真跑了一遍（上一轮的读数块写着两条 exit 0）。**两条是红的**，
> 而且都能证明与本轮改动无关。**记在这里是因为「一条长期红着又没人看的门禁等于不存在」。**
>
> ### 一、`icon-parity`：`ChevronLeft` 的豁免过期了（**已修**）+ `Unplug` 只有 Vue 用（**开着**）
>
> 门禁 `exit 1` 的那一半是**过期豁免**：`VERIFIED` 里 `ChevronLeft` 的理由写的是
> 「上游 `ai-elements/message.tsx` 的 `MessageBranchPrevious`，`MessageBranch*` 零消费者」
> ——那是 wave 75 的事实。现在**两边都在用**它（`artifact-table-preview.tsx` 与
> `ArtifactTablePreview.vue` 的翻页键），于是它根本不会再进「只有一边用」那张表，
> 这条豁免是死配置。按 stale 提示回去看过一遍、删掉，门禁回到 exit 0。
>
> **剩下的 1 处待核是真的**：`Unplug` **只有 Vue 用**。
> 本仓 `ChannelConnections.vue:459` 给**每一条 connection** 画了一颗「Disconnect」
> （`Unplug` 图标 + `channels.disconnect` / `disconnectAccount` 两条词条），
> 而上游那一页**没有任何 per-connection 动作**——它只在 `ItemDescription` 里写一句
> `connectedAs(...)`，动作列只有 Modify / Connect /（管理员）删 provider 配置。
> 上游词典里也**没有** `disconnect` / `disconnectAccount` 这两条（grep 过）。
>
> **它是 2026-09-11 那一轮之后才现形的**：在 `0f97c803` 之前上游也用 `UnplugIcon`
> （画在 provider 级那颗「Disconnect」上），两边的图标集合因此**恰好**相交；
> 那一轮把上游那颗键改成「删 provider 配置」并去掉图标之后，巧合结束。
> **也就是说这处 Vue 独有的产品面一直都在，只是此前被一个巧合盖住了。**
>
> **下一轮要判的是产品面的有无，不是图标**：按双向规则要么两边同加
> （per-connection 撤销是个真能力：一个账号连错了，今天上游只能删掉整个 provider 配置），
> 要么删掉本仓这一颗。**翻案判据**：上游哪天自己加了 per-connection 动作。
>
> ### 二、`asset-budget` 四条预算全超（**开着，且不是这一轮**）
>
> ```
> - vendor-ui.totalRaw:      740601 > 683000
> - vendor-ui.totalGzip:     223015 > 205000
> - vendor-ui.maxRaw:        318499 > 305000
> - all-client-js.totalGzip: 3415750 > 3400000
> ```
>
> **证过因果**：把本轮动过的三份 `app/` 文件换回 HEAD 版本重新构建再量一次，
> 四条照样超，读数只差 **16 字节**（740585 / 223012 / 318490 / 3415736）——
> 本轮那几个 Tailwind class 与注释在 JS 侧根本不计。
> **所以这是存量**，最可能来自 2026-09-10 那次上游合并（Projects 侧栏段、CSV 预览、
> 新 features 调用方都进来了）。
>
> **不要顺手抬数字**：`route-payload` 那条「抬到实测值以上」的做法有前提
> （量的是用户真下载了多少、而且要写清抬了多少）；这四条是**增量告警**，
> 抬之前先答出「哪一次改动让 vendor-ui 涨了 57 KiB」。
> 建议的查法：`git log --oneline` 挑几个点，各跑一次 `make asset-budget` 二分。
> **翻案判据**：查清增量来源之后，要么拆包、要么抬预算并在 `$measured` 里写明原因。

> ## 2026-09-12 窄屏那两簇结清：**上一轮排除掉的第四条假设是对的，它只是没生效**
>
> `integrations#change-app` 与 `#permission-request` 各 11 行 → **各 2 行**
> （剩下的 2 行是 `div[scroll-area-viewport]` 那笔老账 + 它在 `tabOrder` 上的投影）。
> `integrations` 全场景 **86 → 68**；台账 **154 → 137 唯一行**。
>
> **先记一条方法上的翻案**，因为它比结论值钱：backlog 里那张「四条死路」表的第四条写着
>
> | Radix 的 `display:table` 撑宽了面板 | **测了，无效**：给设置面板的 ScrollArea 加 `[&>div]:block` 覆盖掉它，读数 86 → 86，一行没动 |
>
> **这条假设是对的，那次实验是假阴性。** Radix 把 `min-width:100%; display:table`
> 写成**内联样式**（`@radix-ui/react-scroll-area@1.2.10` 的 `dist/index.mjs:130`），
> 而 Tailwind 的 `[&>div]:block` 生成的是一条普通 CSS 规则——**内联样式赢**。
> 那个变异从来没有生效过，于是「读数一行没动」这件事什么都没有证明。
> **这是「探针拿不到东西时先问『我这一步真的生效了吗』」的又一例**，
> 只不过这次被骗的是一条**否定**结论：否定结论同样要先证明变异生效。
>
> **父链量出来的读数**（375×812，`change-app` 终态，`App ID` 输入往上逐层）：
>
> | 层 | React | Vue |
> | --- | --- | --- |
> | `div.grid`（对话框主栅格） | w=293 client=293 **scroll=318** | w=293 client=293 scroll=293 |
> | `[data-slot=scroll-area]` | **318.2**（比格子宽 25.2） | 293 |
> | viewport 里那层 | `min-width:100%; display:table` → 316.2 | 普通 block → 291 |
> | `[data-slot=card]` | 268.2（scroll 266） | 243（**scroll 264**） |
> | `role:textbox[App ID]` | 192.2 | 167 |
>
> **两边都是坏的，只是坏法不同**：上游让 shrink-to-fit 把整个面板撑出栅格格子
> （右边那 25px 吃掉对话框的右内边距），本仓把内容裁掉。
> **台账只报得出「宽度不一样」，报不出「这一块本身对不对」**——两种坏法各自自洽。
>
> **真正的根因是内边距在窄屏下没有降档。** 逐层量 min-content（两边逐值相同）：
>
> ```
> card 268.2 · card-content 266.2 · box「Authorization scope」218.2 · box「Switch to a different Lark app」217.1
> button「Re-register in browser」191.1   ← 撑宽面板的就是它
> p「…Examples: calendar:calendar.event:read」192.2
> ```
>
> 而 375px 屏上给到的内容列只有 **167px**：对话框 343 → 面板 `p-6` → 这一页独有的
> Card `px-6` → 状态盒 `p-3`，三层内边距在一块 375px 的屏上吃掉 **208px**。
> 没有任何内边距方案能把一颗 191px 的按钮塞进 167px，**这不是一行一行修得完的表象**。
>
> **修法（两边同改）**：面板 `p-6` → `p-4 sm:p-6`，集成页 Card 的 header/content
> `px-6` → `px-4 sm:px-6`。`sm` 以上逐字不变，所以桌面维度与视觉基线一格没动。
> 修完两边内容列都是 **199px**，卡片 min-content 252.2 ≤ 259，全链零溢出。
>
> **两边各钉一条用例**（这是 wave 88 那条「接上新表面之后要另问一句『这一块本身对不对』」
> 的兑现）：375px 下断言 `panelOverflow == 0 && cardOverflow == 0`。
> 两个读数缺一不可——**上游那种坏法只让 `panelOverflow` 响，本仓那种只让 `cardOverflow` 响**。
> 负向验证 2×2 逐条做过：
>
> | 变异 | React | Vue |
> | --- | --- | --- |
> | 只还原面板内边距 | `panelOverflow 9 / cardOverflow 6` 红 | `cardOverflow 15` 红 |
> | 只还原 Card 内边距 | `panelOverflow 9` 红 | `cardOverflow 7` 红 |
>
> 两处改动各自承重，**没有一处是顺手加的**。
>
> ## 2026-09-12 给 diff 三档挂上锚点——**当场量出一处 4px，而且它一直在**
>
> 上一轮在本仓补上上游那三个 `dark:text-*-300`（diff 的增/删/hunk 三档）时，
> **台账一行都没反应**。原因不是修对了，是**那一块根本没有锚点**：
> `workspace-changes#changes-panel` 整块面板此前只有一个 heading 锚点。
>
> 这一轮给三档各挂一个锚点（文本取自夹具里的 diff：`+Ready` / `-Draft` / hunk 头），
> 并按 `DARK_DIMENSION` 的纪律给这个场景补一维 dark。**结果两件事**：
>
> 1. **颜色两边逐值相同**，深色下三档都正确翻到 `*-300`（探针打过四组读数：
>    `+Ready` 浅色 `rgba(0,122,85)` → 深色 `rgba(94,233,181)`）。
>    上一轮那处修法确认成立，**而且从现在起有机器守着**。
> 2. **当场报出 9 行 `y Δ4`**（三行 diff × 三个维度）。逐层量下去，分岔在
>    面板正文那一层：上游 `px-5 py-4`（padTop 16），本仓写的是 `p-5`（padTop 20）。
>    **这 4px 把面板里每一行都往下推**，而在挂锚点之前唯一的锚点在 header 里、量不到它。
>    本仓改成 `px-5 py-4`（上游没坏，照抄），9 行归零。
>
> **锚点自己也要有人守。** 锚点一旦指不到东西，两边都记 `null`、`diffGeometry` 直接跳过
> ——台账 0 行、没有任何用例会红（线索 131 的形状）。新增
> `tests/unit/parity/workspace-diff-anchors.test.ts`：每个文本锚点必须**恰好**命中夹具
> diff 里的一行，且 addition / deletion / hunk 三档**各被盖住一次**（归类走产品代码自己的
> `getWorkspaceChangeLineClass`，不重写一份）。**判据不是「有三个锚点」**——那只是把一个
> 数字写死在两处。两处变异都红：改掉夹具里那一行 → 2 条红；拿掉 hunk 锚点 → 1 条红。
>
> 顺带把同一份文件里最后一处 class 分叉对齐：`SheetContent` 上游是
> `sm:max-w-[900px]`、本仓写的是 `sm:max-w-none`。**今天两者渲染一模一样**
> （宽度本来就是 `min(92vw,900px)`，封顶封在同一个数上），**读数零变化**——
> 留下它的理由不是量出来的，是两个 token 语义不同，上游哪天动了那个 `w-[...]`，
> `max-w-none` 会安静地跟着走偏。这一条按「量不出效果的改动」的规矩**如实写在这里**。

> ## 2026-09-11 重命名之后焦点掉回文档顶部——**两个应用都是，而且是新加的取样步骤逼出来的**
>
> 台账上 `thread-title-sync` 的 `focus` 行**一轮有一轮没有、方向还会翻**
> （记过 `React=body Vue=button "更多"`，这次量到 `React=button "More" Vue=body`）。
> 原来的判词是「取样点不稳」，处理办法是加一条 `hidden: dialog[Rename]`。
> **那个判词只对了一半**：取样点确实不稳，但它盖住的是一条真缺陷。
>
> 把场景最后一步换成**「等到有一颗按钮拿到焦点」**（`visible: button:focus`）之后，
> 抖动消失了，两边先后**稳定超时**——先是本仓，修完本仓换成上游。
> 然后各写一个临时 e2e 探针读 `document.activeElement`，量到的是同一件事：
>
> | | 修之前 | 修之后 |
> | --- | --- | --- |
> | 本仓 | `body`（1.3 秒后仍是） | `button "More"` |
> | 上游 | `body`（1.3 秒后仍是） | `button "More"` |
>
> **根因两边同源**：重命名对话框**没有 `DialogTrigger`**（从 ⋯ 菜单里选「重命名」才开）。
> reka 的 `close-auto-focus` 默认还给 trigger——没有 trigger 就什么都不做；
> Radix 的 FocusScope 存的是「打开前谁有焦点」，而**打开那一刻焦点还在即将卸载的菜单里**
> （探针量到点开 ⋯ 之后焦点落在 `div[role=menu]` 上），于是它也还不回去。
> 键盘用户改完标题掉回文档顶部，要从头 Tab 一遍。
>
> **修法：归还给那颗 ⋯ 键，不是「打开前谁有焦点」。** 探针同时量到那颗键在重命名之后
> **仍在 DOM 里、仍连着、`tabIndex=0`**，所以它是稳的目标。本仓按线程 id 现查
> （对话框由上层持有，中继链有 5 层，穿元素引用太吵，而且引用跨不过重渲染）；
> 上游那一侧对话框就在行组件里，直接用 `ref`。
>
> **两次没修好的尝试，写在代码注释里**（都是猜的，都被实测推翻）：
> ① 在 `open-auto-focus` 那一拍存下当时的焦点——菜单关闭与对话框挂载在同一拍，
> 谁先谁后由组件更新顺序决定；② 让 ⋯ 菜单先把焦点交回触发器再报事件——
> 探针显示那句 `focus()` 随后就被对话框接管，**量不出效果，所以那一版撤掉了**。
>
> **方法上的一条**：`visible: button:focus` 这种「等到某个不变量成立」的步骤，
> 比「等某个元素消失」强——后者只能等到中间态，前者等到的是终态。
> 它的代价是**真有缺陷时会硬红而不是悄悄漂移**，这正是要的。
>
> ## 2026-09-11 那颗够不着的开关：**根因在 Radix 的 ScrollArea，不在行里**
>
> **先记两次错判**，因为它们各自省下的时间比结论本身多：
>
> 1. **误读 `hit=off-screen`。** 我把 `integrations#change-app` 上
>    `role:button[Re-register in browser] hit Vue=off-screen` 也读成「本仓那颗跑出视口」。
>    **不对**：`hit` 用的是**探针那一刻的视口矩形**（`capture.ts:392`，
>    `cx/cy` 取自 `getBoundingClientRect()`，超出 `innerWidth/innerHeight` 就记
>    `off-screen`），**竖直滚出去也算**。那一行的 `x` 两边相同、只有 `y` 差 274.9——
>    它在 y≈3250，375×812 的视口里本来就看不到。
>    **判据**：`hit=off-screen` 只有在同一行的 `x` 也超出视口宽度时才读成「横向够不着」。
> 2. **根因猜成了 `min-w-0`。** 六处 `ItemContent` 补上 `min-w-0` 之后**读数一行没动**
>    （88 → 88，开关还在 x=395.5）。那六处留着（与上游
>    `channels-settings-page.tsx:187` 一致，本身是对的），但它不是这条的根因。
>
> **真根因**：Radix 的 ScrollArea 把子节点包进
> `<div style="min-width:100%; display:table">`（`@radix-ui/react-scroll-area@1.2.10`
> 的 `dist/index.mjs:130`），而 **`display:table` 取的是「收缩到适合」的宽度**——
> 放不下的一行**不会溢出被裁掉，而是把整个面板撑得比对话框还宽**，
> 下面每一行都跟着按那个宽度排。**reka 的 viewport 没有这层包装**，
> 内容被约束在 100%，所以同样的 markup 只有上游那一侧坏。
>
> 撑宽它的是技能页的 header：`flex justify-between` 里左边 Tabs、右边两颗键
> （安装 .skill / 创建技能），375px 下并排放不下。两边同改成
> `flex flex-wrap justify-between gap-2`。
>
> **实测：`integrations#skills/mobile` 4 → 2 行**，`x Δ-135.5` 与 `hit React=off-screen`
> 双双消失；桌面维度一行没动（总数 88 → 86，正好是那两行）。
>
> **还开着的两簇**（工单在 backlog）：`integrations#change-app` 11 行与
> `permission-request` 11 行。后者三颗权限芯片两边折行点不同
> （React 的 Docs 在 x=104、Drive 在 169.6 同一行；本仓 Docs 在 211、Drive 换行到 104），
> 而且**两边的 `hit` 都不是 `self`**（React 命中 span/span/button，本仓命中
> div/div(dialog)/p）——那说明芯片中心点上盖着别的东西，**两边盖的还不是同一个**。
> 这一条需要探针，别接着猜。
>
> ## 2026-09-11 窄屏第一次进取样面：**上游有一颗够不着的控件**
>
> 122 个场景-维度里 **110 个是 desktop**；非 desktop 的只有 `chat`（跑满矩阵）、
> `thread-list-pin#mobile-drawer` 与 `ui-polish-mobile` 三个。
> 而设置对话框在上游是 `md:grid-cols-[220px_minmax(0,1fr)]`——**窄屏下导航与内容要叠起来**，
> 两个应用各写各的，**没有任何机器看过那一叠**。
>
> 给 `integrations` 加一维 `mobile/light/en-US`（375×812）。**当场量出两个真缺陷**：
>
> | 行 | 读数 | 说明 |
> | --- | --- | --- |
> | `integrations#skills` | `role:switch[review] x React=395.5 Vue=260`、**`hit React=off-screen`** | **上游的技能开关在 375px 下横向跑出了视口**：x=395.5 > 375（x 是把祖先滚动加回去的坐标，而这条链上没有横向滚动容器，所以它就是视口 x），`hit` 也确认拿不到指针。手机上点不到那颗开关。 |
>
> **一条自己立刻推翻的判断，留在这里免得下一轮照着错的查**：我最初把
> `integrations#change-app` 的 `role:button[Re-register in browser] hit Vue=off-screen`
> 也读成了「本仓那颗跑出视口」。**不对。** 那一行的 `x` 两边相同（没进 diff），
> 只有 `y` 差 274.9；而 `hit` 用的是**探针那一刻的视口矩形**
> （`capture.ts:392`：`cx/cy` 取自 `getBoundingClientRect()`，超出 `innerWidth/innerHeight`
> 就记 `off-screen`），**竖直方向滚出去也算**。那颗按钮在 y≈3250 处，
> 375×812 的视口里本来就看不到——它是「内容更高、于是被滚出去了」的结果，
> 不是一个够不着的控件。**判据**：`hit=off-screen` 只有在同一行的 `x` 也超出视口宽度时
> 才能读成「横向够不着」；只有 `y` 不同时，它是位移的投影。
>
> 另外 `integrations#permission-request` 上三颗权限芯片（Calendar / Docs / Drive）
> 的 x/y 与命中目标两边都不一样（`Docs` 的 x 差 107、`Drive` 差 -65.6，
> 命中目标分别落在 `span` / `div(dialog)` / `button` / `p` 上）——窄屏下那一排的折行方式不同。
> 其余的 `y Δ239~275` 是上面这些差异的累积位移。
>
> **这一维带进来的行全部接受进基线，判词是「已确认是缺陷，工单在下面这一条」**，
> 而不是「不跟」。理由：已知坏掉的地方**被机器看着**，比不看着强——
> 再坏一点门禁就会红。`PARITY_ACCEPT_GROW=1` 的正当用法里，
> 「新看见了」与「已确认是缺陷且开了票」都算（判据见 backlog 的「审新增行的四类」）。
>
> **工单**：窄屏下的设置对话框要逐屏对一遍——先把两颗够不着的控件修掉
> （两侧各一颗，都是 `ItemActions` 在窄屏下被挤出容器），再看权限芯片那一排的折行。
> 修的时候记得：**`Item` 是 `flex-wrap` 的，挤出去通常是因为 `ItemContent` 少了
> `min-w-0`**——同一条在 `channels` 那一轮已经踩过（上游那一行写的就是
> `<ItemContent className="min-w-0">`，而技能行与 MCP 行都没写）。
>
> ## 2026-09-11 给错误态补一个 dark 维度——**并且用它来守上一笔**
>
> 上一笔（错误红两套）暴露的不是一处缺陷，是**取样面的一个洞**：对照工厂的维度机制
> 一直支持 `dark`（`ParityTheme` 就有这一档），但**只有 `chat` 一个场景跑满 12 维矩阵**，
> 其余都只跑 `desktop/light/{en-US,zh-CN}`。红全长在设置页与错误态上，
> 那些场景一个都没开 dark——所以两个应用在深色主题下长什么样，**没有任何机器看过**。
>
> 给 `integrations` 加一维 `desktop/dark/en-US`（它有两支错误态：
> `load-failed` 与 `skills-load-failed`，是这类差异的高发区）。
> 与 `ZH_DIMENSION` 同一条纪律：**一个场景补一维就够**，主题轴与语言/断点轴正交。
>
> **实测结果：新维度 17 行，全部是两条判过的账的投影，零条新差异。**
> 14 行是 `div[scroll-area-viewport]` + 它的 `tabOrder` 投影（7 个状态各 2 行），
> 3 行是 `retry: false`。也就是说上一笔的修法在深色主题下确实成立，
> 而且**从现在起有机器守着它**。
>
> 台账因此 **118 → 135**，走的是 `PARITY_ACCEPT_GROW=1`——这是那道逃生口的正当用法：
> 新增行**不是新坏了**，是新看见了，而且逐条都能指回已有判词。
>
> ## 2026-09-11 错误的红有两套，深色主题下其中一套是坏的
>
> 本仓 36 处 `red-*`、上游 12 处，**两边都在混用固定红与 `destructive` token**。
> 这不是风格问题：`--destructive` 在浅色是 `oklch(0.577 0.245 27.325)`
> ——**与 `red-600` 同一个值**，所以浅色下看不出差别；深色主题下它变成
> `oklch(0.704 0.191 22.216)`（提亮），而 `text-red-600` 原地不动。
> 也就是说**这套差异只在深色主题下现形**。对照工厂的维度机制本来就支持 `dark`
> （`ParityTheme` 有这一档），但**只有 `chat` 一个场景跑满 12 维矩阵**，
> 其余场景都只跑 `desktop/light/{en-US,zh-CN}`——而红色全长在设置页与错误态上，
> 那些场景一个都没开 dark。**台账因此报不出它**，这也是「台账之外还有活」的样本。
> 下一轮可以把带错误态的几个场景单独加一个 dark 维度（代价是每加一维就多一遍
> 两侧取样）。
>
> 逐条回上游对之后分三类：
>
> - **错误文案**（表单错误、取数失败、行内 alert）：两边一律 `text-destructive`。
>   共 23 处（本仓 18、上游 5）。此前本仓内部就有两种写法（`text-red-500` 与
>   `text-red-600`），三处注释分别点过它的名（`AgentCard.vue` ③、
>   `ChannelConnections.vue` 的动作条、`MemorySettings.vue` 的清空键）。
> - **浅红底的提示盒**（`bg-red-50 … text-red-700`，本仓 6 处、上游 0 处）：
>   `bg-red-50` 在深色主题下是一块近白的盒子压在深色页面上，里面还配深红字。
>   换成 `bg-destructive/10 text-destructive`——与上游 diff 行那套
>   `bg-red-500/10` 同一种「半透明底 + token 字」的做法。
> - **语义色照抄不动**：diff 的增删（emerald/red/sky）、subtask 的 failed 状态、
>   终端窗口的三颗圆点。上游用的就是固定档，它们表达的是「删除行」而不是「出错了」。
>
> **顺带修掉本仓一处真缺陷**：diff 行的三档配色本仓**一个 `dark:` 变体都没有**
> （上游 `workspace-change-panel.tsx:235` 三档各有一个 `dark:text-*-300`）。
> 深色主题下底是那层 `/10` 的半透明色、字仍然是 700 档——**深字压深底**，
> diff 基本读不出来。
>
> ## 2026-09-11 `mcp-settings` 的 `width Δ8`：两颗图标键差了一档尺寸
>
> `text:Local tools width React=654 Vue=662 Δ8`。整行的结构两边逐层相同
> （`Item variant="outline"` + ItemContent/ItemTitle/ItemDescription/ItemActions），
> 差的是动作列里那两颗图标键：上游 `size="icon"`（36px），本仓 `size="icon-sm"`（32px）。
> 两颗一共窄 8px，动作列窄了描述列就宽了 8px——**`Δ8` 就是这么来的**。
> 改成与上游同一档。
>
> **顺带修掉上游的一处 WCAG 4.1.2**：同一行里那颗 `Switch` 上游**没有任何可访问名**
> （本仓一直有 `:aria-label="String(name)"`），读屏器只念得出「switch」，
> 说不出是哪一个 server 的。两边同改。
>
> ## 2026-09-11 台账剩下的每一行都判掉了（收口）
>
> 到这一轮为止，台账 **330 → 108 行**。把判过的账刨掉之后**真正还开着的只有 19 行**，
> 逐条列在这里——目标是让「台账还剩多少行」这个数字**不再需要解释**。
> **写完这一节时，台账上没有任何一行是「还没判」的。**
> （同一天稍后开了 dark 与 mobile 两维，台账因此涨回去了——**新进来的每一行同样都有判词**，
> 其中窄屏那一批的判词是「已确认是缺陷，工单在上面那一条」。见本文件更靠前的两节。）
>
> ### 一条差异、47 行投影：`div[scroll-area-viewport]`
>
> wave 98 判过「不跟」：上游把欢迎建议行套在 `ai-elements/suggestion` 的
> `Suggestions` 里，那是一个横向 `ScrollBar` 写着 `className="hidden"` 的 ScrollArea，
> **永远不会真滚动**，只多一个键盘停靠点；本仓用 `flex-wrap` 的普通容器，什么都没少。
> 2026-09-11 复核：上游那个 `hidden` 还在，`Suggestions` 里那层 flex 容器
> **两边都是 `flex-wrap`**（所以上游那个 ScrollArea 也确实不会横向滚）。原判有效。
>
> **它占了台账的 43%**（47 行 `tabbablesOnlyReact` + 21 行 `tabOrder` 投影，
> 分布在 47 个以聊天页为底的场景上——设置对话框是盖在聊天页上的，
> 底下那一行建议芯片一直在 DOM 里）。读台账数字时先把这一条减掉。
>
> ### 三条请求层的账（22 行）
>
> - `retry: false`（wave 128，18 行）：同一次 500，上游发 3 次、本仓 1 次。
>   TanStack 默认重试**不分错误码**。
> - `thread-list-pin#mobile-drawer` 的 2 行（2026-09-11 判）：查询挂在抽屉里还是外面。
> - `thread-title-sync` 的 2 行：重命名之后上游重取、本仓靠乐观缓存。
>
> ### 真正还开着的 19 行
>
> | 行 | 判词 |
> | --- | --- |
> | `thread-history-mermaid` ×16（zh-CN）：`Zoom in` / `Zoom out` / `Reset zoom and pan` / `img "Mermaid chart"` | **不跟**：写死在 streamdown 2.5.0 的产物里，不在 `StreamdownTranslations` 的 29 个 key 之内。本仓的 mermaid 是自己实现的，翻译是对的。**翻案判据**：streamdown 把这 4 条加进 `StreamdownTranslations`，或上游换成自己的 mermaid 渲染。 |
> | `branch-thread#turn-actions` ×2：`tooltip "Branch conversation"` 只在上游的 aria 树里 | **不跟**：Radix 与 reka 都把 `role="tooltip"` 挂在一个 `VisuallyHidden` 节点上、都给触发器盖 `aria-describedby`（逐份读过 `TooltipContentImpl.js` 与 radix 的 `dist/index.mjs`），**读屏器行为等价**；差的是 Playwright 快照怎么渲染两份形状相近但不同的 primitive。**翻案判据**：reka 把 `role="tooltip"` 挪到可见内容上。 |
> | `thread-history` ×2：`tabbablesOnlyReact: div(menuitem)` | **不跟**：子菜单展开时 Radix 比 reka 多留一个 `tabindex=0` 的菜单项（父级触发器）。菜单的漫游焦点是 primitive 自己的实现细节，两边的键盘操作都走方向键而不是 Tab。**翻案判据**：哪一边的菜单出现真正的键盘不可达。 |
> | `chat-thread-init-ordering` ×5（en-US 独有） | **先怀疑取样时机**——这条形状本轮已经立过判据（语言维度不对称的差异不会是渲染规则）。其中 `alert` 空 vs `alert: New chat - DeerFlow` 是 Next 的路由播报器（wave 102 量过：1×1 裁剪、内容是上一拍的 `document.title`）；`button "Edit and rerun"` 那 3 行是 seq 移植的副产物，backlog 里记着「先加临时 dump 看读数，别猜」。 |
> | `sidecar-chat` ×2：分栏把手的点击区 4px vs 16px | wave 146 判过：**保留本仓这一侧**（WCAG 2.5.8 目标尺寸）。 |
> | `workspace-changes#changes-panel` ×2：`focus: React=button "Close" Vue=第一个文件行` | **不跟**：**两边都没有接管 `onOpenAutoFocus`**（逐份确认：上游 `ui/sheet.tsx` 与 `workspace-change-panel.tsx` 里一处都没有；本仓 `SheetContent.vue` 只把事件**转发**出去、`WorkspaceChangesBadge.vue` 没有监听），所以这不是任何一侧的产品决定，是 Radix 与 reka 的**默认落点不同**。两边的文件行都是 `<Collapsible>` 的 `CollapsibleTrigger`（一颗 button），关闭键在两边也都排在 `{children}` 之后——**我没有再往下探「为什么 Radix 落在关闭键上」**，那需要在场景里加一次 `document.activeElement` 转储。**翻案判据**：哪一边开始显式接管 `onOpenAutoFocus`（那时两边一起接管），或者 primitive 改了默认。 |
>
> ## 2026-09-11 产物面板的「JPG file」也是写死的英文
>
> 台账上只剩两条 zh-CN 专有的行（`showcase-public-thread` 与 `artifact-stream-state`
> 各 2 行）：`- text: doraemon-moe-comic.jpg JPG file` 对
> `JPG 文件`、`summary.txt Text file` 对 `Text 文件`。
> **又是那个形状**——只在中文维度报差异、英文维度一行都没有，所以两边渲染的是
> 同一棵树，只是一侧没翻译。
>
> 上游 `artifacts/artifact-file-list.tsx:187` 与 `artifact-file-preview.tsx:99` 写的是
> `{ext} file` 字面量，同一个文件里还有
> `"This file type cannot be previewed in the browser."`、iframe 的
> `title="Artifact preview"`、以及两处 `toast.error("Failed to install skill")`
> ——**上游的 `artifacts` 面板整块都没有进它自己的词典**。本仓一直有一个
> `artifacts` 命名空间（`fileTypeLabel` / `cannotPreview` / `previewTitle` /
> `installFailed` 都在里面），`ArtifactFileCards.vue` 的头注释里还点名了那句写死的英文。
>
> 两边同改：上游补上同名的 `artifacts` 块（只取本仓这四条），
> `vue-only-keys` 的 `VUE_ONLY_BLOCKS` 里把 `artifacts` 拿掉。
>
> **`placeholder="Select a file"` 不在这一批里**：它对应的是本仓
> `primitives.selectAFile`，而 `primitives.*` 那一组的规矩本来就是
> 「上游写死英文、两个应用念同一句」，两边现在念的就是同一句。
>
> ## 2026-09-11 `integrations` 46 → 34、`scheduled-tasks#default` 14 → 0
>
> 两族一起记，因为**剩下的全是早就判过的两条账**。
>
> **一、技能清单取数失败那一行（10 行）。** 上游画的是 `<div>Error: {message}</div>`：
> 没有 role（读屏器不会主动念）、硬编码一个 `Error: ` 英文前缀（中文界面上也是英文）、
> 画成普通正文（16px、前景色）而不是错误。本仓一直是
> `<p role="alert" class="text-sm text-red-600">{message}</p>`。
> `SkillSettings.vue` 的注释里写着「这两处差异有意留在台账里，各自有翻案判据」——
> **这一轮把翻案判据兑现了**：上游换成同形的一行。
>
> **二、设置对话框打开时的初始焦点（4 行）。** 上游不接管 Radix 的
> `onOpenAutoFocus`，默认落在第一个可聚焦元素——**永远是 "Account"**。
> 深链到 `?settings=appearance` 却把焦点丢在 "Account" 上，键盘与读屏用户得自己找路，
> 而 URL 已经说了要去哪一屏。本仓早就接管了（`SettingsDialog.vue` 的 `focusInitial`，
> 两条 e2e 钉着）。这一轮上游也接上了：一个 `ref` 表 + `onOpenAutoFocus`。
>
> **三、定时任务详情里缺了「复用会话」的提醒（14 行）。** 上游
> `scheduled-tasks/page.tsx:507` 在详情的「会话」那一行下面画 `ReuseThreadNotice`；
> 本仓**只在新建表单里画它**——一条任务建完之后，再回来看它的人永远看不到
> 「每次运行都往同一条会话里追加上下文，跑久了会越来越长、也越来越贵」，
> 而那正是想改掉它的人要知道的。台账上那条 `ariaOnlyReact: - alert: …` 加三行
> `y Δ-180`（缺这一块，下面的一切都上移了）报的就是它。补上，带两条做过变异验证的单测。
>
> **剩下的 34 + 6 行全是两条判过的账**：
> `div[scroll-area-viewport]`（wave 98，×28）与 `retry: false`（wave 128，×9）。
> `integrations` 与 `scheduled-tasks` 两族到此清完。
>
> ## 2026-09-11 手写 `<input>` / `<textarea>`：**7 份文件，其中三份把 primitive 的基类抄成了本地常量**
>
> 起因是上一笔留下的两行几何（`AgentSettingsDialog` 的两个数字输入）。顺着它盘了一遍
> `app/components` + `app/pages`：**19 份文件在手写**。逐条回上游对之后分成两半——
> 上游同样手写的照抄不动，上游走 `ui/input` / `ui/textarea` 的全部改过来。
>
> **改掉的 7 份**（上游那一处都是 primitive）：
>
> | 本仓 | 上游那一处 |
> | --- | --- |
> | `AgentChat.vue` 的消息编辑框 | `message-list-item.tsx:525` 的 `<Textarea autoFocus className="min-h-24 resize-y">` |
> | `ThreadSidebar.vue` 的重命名框 | `recent-chat-list.tsx:425` 的 `<Input>` |
> | `ChannelRuntimeConfigDialog.vue` 的凭据框 | `channel-runtime-config-dialog.tsx:113` 的 `<Input>` |
> | `MemorySettings.vue` 的三处 | `memory-settings-page.tsx:807/829/849` |
> | `chats/index.vue` 的搜索框 | `app/workspace/chats/page.tsx:107` |
> | `ScheduledTaskForm.vue` / `ScheduledTaskDetail.vue` / `ScheduledTaskScheduleInput.vue` 共 10 处 | `scheduled-tasks/page.tsx:289/300/306/533/538` 与 `scheduled-task-schedule-input.tsx:240/253/287/301/319` |
>
> 其中**三份是把 primitive 的整串基类抄成了本地常量**（`inputClass` / `textareaClass` /
> `editInputClass` / `editTextareaClass`），还有两份直接抄进了 `class=`（`chats/index.vue`
> 连 `data-slot="input"` 都手写了）。**抄的那几份都已经漏了 `aria-invalid:` 与 `disabled:`
> 两段**——也就是说无效态和禁用态在这些字段上一直是不生效的。
>
> **顺带修掉两个行为缺陷**：`AgentChat.vue` 的编辑框上游带 `autoFocus`，本仓没有
> （点「编辑」之后还得再点一次输入框）；`chats/index.vue` 的搜索框重复传了一个
> 与基类一模一样的 `w-full`，被 `primitive-class-overrides` 当场拦下。
>
> **留下的 12 份 16 处逐条注明了上游写法**，写进新的 `tests/guards/handwritten-input.test.ts`
> （`handwritten-button` 的同胞，双向清单：清单外的报错，清单里已经不存在的也报错）。
> 里面最值得记的一条是三个 composer 的输入框：上游走
> `PromptInputTextarea → InputGroupTextarea → <Textarea>`，而**本仓没有移植
> `ui/input-group`**，整块 composer 外壳都是手写的——那是独立的一笔账。
>
> **一个自己踩的坑，记在这里**：给 `MemorySettings.vue` 补 `Textarea` 导入的那段脚本
> 写的是「文件里没有 `ui/textarea` 才加导入」，而我刚插进去的**注释里就写着
> `ui/textarea`**——于是导入没加上，`<Textarea>` 退回成 Nuxt 自动导入解析不到的标签、
> 被当成普通 `<textarea>` 渲染，`v-model` 变成两个没人接的属性。
> `vue-tsc` 放行（Nuxt 生成的组件类型里有它），是那条 DOM 单测抓住的：
> 对话框上写着「Fact content cannot be empty.」而 DOM 里的值明明是 "Zero"。
> **这与守卫注释被自己扫到是同一个形状**（[[deerflow-guard-strip-comments]]）：
> 「文件里有没有这个字符串」这种判据，在一份**刚被自己写进说明文字**的文件上永远不可靠。
>
> ## 2026-09-11 `agents-feature-disabled` 三个状态 **32 行 → 0**
>
> 台账上最厚的一处（`#gallery` 16×2，`#loading` 7×2）。四类差异，**三类的根因都在上游**。
>
> **一、导航控件写成了按钮（`#loading` 4 行、`#gallery` 3 行）。**
> 「新建智能体」与卡片上的「聊天」都是「点了就跳到某个 URL」的控件，本仓写的是
> `<NuxtLink :class="buttonVariants()">`，上游写的是 `<Button onClick={router.push(...)}>`。
> 按钮不能中键打开、不能新标签页打开、不能复制地址，读屏器还念成按钮（WCAG 4.1.2）。
> 本仓那两处的注释里早就写着翻案判据「上游哪天给导航类按钮上了 `asChild`」——
> 这一轮就是去把它兑现：上游三处入口改成 `<Button asChild><Link>`
> （顺带把 agent 名 `encodeURIComponent`，上游原来是裸拼进路径的）。
>
> **二、加载占位没有 role、文案也不说在加载什么（`#loading` 2 行）。**
> 上游是一个没有 role 的 `<div>` 加通用的 `t.common.loading`（"Loading..."），
> 读屏器既听不到「在加载」，也听不出在加载什么。本仓早就是
> `role="status"` + `agents.loading`（「正在加载智能体…」）。两边同改，上游补上同名 key。
>
> **三、对话框的两处信息缺失（`#gallery` 5 行）。**
> - 标题只写「模型设置」：这是个模态框，打开之后那张卡片已经看不见了，
>   而说明文字只说「这个 agent」——页面上有好几个 agent 时，标题不说是哪一个。
>   两边统一成「模型设置 · <agent 名>」。
> - **agent 绑的模型不在清单里时，上游那颗选择器是空白的**：Radix 对找不到对应项的
>   值不渲染任何东西，于是对话框说不出这个 agent 现在跑在哪个模型上，
>   一按保存还会把它悄悄改掉。本仓早有一条 disabled 的兜底项（`<模型> · 不可用`），
>   照搬到上游。
>
> **四、剩下的两行几何是本仓自己的缺陷（`#gallery` 2 行）。**
> `[role=dialog] height React=555 Vue=548.8 Δ-6.2`、`y Δ3.1`（居中，高度差一半就是偏移）。
> 根因：温度与最大 token 两个数字输入**是手写的** `<input class="border-input … px-3 py-2">`,
> 而上游用 `ui/input`。手写那版丢掉焦点环、无效态、禁用态样式、深色 token 与 `h-9`
> 统一高度——**同一个对话框里另外三颗 Select 走的都是 primitive 的高度**，只有这两个不是。
> 顺带补上温度那颗缺的 `placeholder`（上游是 `settingsInherit`「继承」：空着的时候
> 用户看不出这是「跟随全局」还是「还没填」），并把字段块的容器与标签
> （`space-y-1.5` + `text-sm font-medium`）按上游对齐。
>
> **附带清掉一行 focus 差异**：`focus: React=button Vue=input[number]`。
> 本仓的模型选择器写的是 `:disabled="pending || modelsLoading"`，而清单是**打开对话框
> 才取**的——于是对话框打开那一刻它是禁用的，焦点越过它落到温度那个 spinbutton 上，
> 方向键会当场改掉温度值。判据：这颗选择器**任何时候都有东西可显示**
> （当前模型，或「用全局默认」），灰掉它等于把「这个 agent 现在跑在哪个模型上」一起藏了，
> 而那正是打开这个对话框要看的；「清单在取」由上面那条 `role="status"` 负责说。
> 改成只认 `pending`（正在保存）。
>
> **这一笔同时开出一条新账**：仓里有 `handwritten-button` 守卫，**却没有 input/textarea
> 的对应物**——上面那处盒模型缺陷因此一路活到今天，改回去也不会让任何门禁变红。
> 盘点是 19 份文件，工单写在 `vue-full-parity-backlog.md` 的「还开着的账」。
>
> ## 2026-09-11 中文界面里的一片英文：**全在 React 那一侧**
>
> 台账上有三个场景**只在 zh-CN 维度报差异、en-US 维度一行都没有**
> （`thread-history-mermaid#default` 14 行、`#download-menu` 15 行、`browser-feature` 12 行）。
> 这个形状本身就是判据：**两边渲染的是同一棵树，只是其中一侧没翻译。**
> 逐条查下来，没翻译的那一侧全是 React。
>
> **一、整个 markdown 面的控件都停在英文（两个场景各 7 行 + 1 行 focus）。**
> React 的 markdown 渲染器是 `streamdown`，代码块复制、表格导出菜单、mermaid 工具条、
> 外链确认这些**可见控件全部由它画**。它自带 `defaultTranslations`（英文）
> 并**开放 `translations` prop**——而本仓从来没有传过。于是中文界面下这一整片是英文。
>
> 修法：在 `ai-elements/streamdown.tsx` 这个唯一的收口处
> （`ClipboardSafeStreamdown`）把词典里的 `markdown` 命名空间传下去。
> **en-US 的值逐字抄 streamdown 2.5.0 的 `defaultTranslations`**，所以英文构建一字不变
> ——这一点很重要：如果英文值写得「更好」，en-US 维度会当场冒出一批新行。
>
> 代价是 `SafeStreamdown` 现在读 context 了，3 个测试文件 28 条用例要套上 i18n。
> 两个 `.ts` 文件里用的是 `I18nContext.Provider` 而不是 `I18nProvider`：
> React 19 的类型不允许 `createElement(Provider, props, child)` 这种写法带必填 children，
> 而 eslint 又禁止把 children 写进 props——Context.Provider 的 children 是可选的，两边都过。
>
> **`Zoom in` / `Zoom out` / `Reset zoom and pan` / `img "Mermaid chart"` 这 4 条跟不了。**
> 它们**写死在 streamdown 的产物里**，不在 `StreamdownTranslations` 的 29 个 key 之内
> （实测：`grep` 得到的字面量在 `chunk-*.js` 里，而 `defaultTranslations` 里没有对应 key）。
> 本仓的 mermaid 是自己实现的（`MermaidChart.vue` / `MermaidZoomPan.vue` / …），
> 翻译是对的。**判词：不跟。** 为了对齐一个第三方库写死的英文而把本仓的中文改回英文，
> 是拿真实用户的体验换一个指标。**翻案判据**：streamdown 把这 4 条加进
> `StreamdownTranslations`，或者 React 侧换成自己的 mermaid 渲染。
> 读数：`thread-history-mermaid` 两个状态 **14/15 → 8 / 8**（en-US 两个状态都是 0）。
>
> **二、浏览器面板整条工具条写死英文（5 行 aria + 2 行 geometry）。**
> `browser-view-panel.tsx` 里 `title="Back"` / `title="Forward"` /
> `placeholder="Enter a URL and press Enter"` / `"Connecting to live browser…"` /
> `"Waiting for the first live frame."` 等等全是字面量。本仓早有一个完整的 `browser`
> 命名空间，React 侧一个都没有。同一个文件里**上一轮已经用同样的方式修过一处**
> （面板标题那句注释：「This panel label was a hardcoded literal while `common.browser`
> sat unused in the dictionary, so zh-CN rendered "Browser" here.」）——这次是把剩下的补完。
>
> 那 2 行 geometry 是同一处的投影：标题 `Connecting to live browser…` 与
> 「正在连接实时浏览器…」字数不同，宽度差 26.5px。翻译对上之后自然消失。
>
> **三、两条门禁当场把「加词典」变成了一次对账。**
> 本仓有两条守卫在读**上游的词典**：`vue-only-keys.test.ts`（本仓独有的块清单）
> 与 `upstream-key-coverage.test.ts`（上游每一条 key 要么本仓同名有、要么落进
> ALIASES / movedByUpstream / pending 三个桶）。给上游加了 `browser` 与 `markdown`
> 两个块之后两条一起红，各逼出一个决定：
>
> - `browser` / `markdown` 从 `VUE_ONLY_BLOCKS` 里拿掉——它们不再是本仓独有的。
> - `markdown.close` **不进词典**：它标的是对话框关闭键，而本仓对这类
>   primitive 可访问名的规矩是「两个应用念同一句英文」（`primitives.*`，
>   I18N_INVENTORY 有说明）。不传这一条，streamdown 就用自己的默认值 "Close"，
>   与本仓 `primitives.close` 一字不差。传了反而会造出一处新的分叉。
> - `browser.navigatedNoScreenshot` **在本仓补实现**，而不是塞进 `pending`：
>   那一桶的 `$comment` 写着「目标状态是空数组，2026-09-10 达成」，往回塞是开倒车。
>   本仓这一支原来**什么都不说**——REST 导航成功但 `screenshot` 为空时把
>   `localFrame` 置空、面板变白，空状态照旧写着「在上方输入网址…」，
>   而用户刚刚就是输完网址按了回车。上游走 toast，本仓的浏览器面板整体不走 toast
>   （文件头记着这条分叉），所以同一句话放进**空状态的说明位**——那正是用户此刻
>   在看的地方；它不是错误，不进 `role="alert"` 那条。带一条做过变异验证的组件测试。
>
> **四、顺手补上本仓自己 `markdown` 命名空间里 7 条没翻的**
> （`copyLink` / `copied` / `openLink` / `downloadImage` / `imageNotAvailable` /
> `openExternalLink` / `externalLinkWarning`）。这一组当初是照 streamdown 的默认值抄进来的，
> 只翻了一半，`MarkdownLinkSafetyModal.vue` 那个对话框因此半中半英。
> 两边词典的 `markdown`（28 条共有）与 `browser`（11 条共有）现在**逐字相同**。
>
> ## 2026-09-11 `channels#settings-panel` 从 53/54 行清到 2/2：那颗 `Disconnect` 是**上游的缺陷**
>
> 这一屏原来是全台账最厚的一处。拆成几类逐条查，**最后一类不是「本仓欠上游」，
> 是反过来**——所以记在这里，它同时是「React 自身缺陷」这条已授权例外的又一个样本。
>
> **一、卡片本体没走 `ui/item`（13 行 `depth: React=2 Vue=3`）。**
> 上游整张卡片是 `<Item variant="outline">` 加五个槽位；本仓手写 `<article>` 套一层
> `div.flex` 再手写四个容器，**每一行可见元素都比上游深一层**。`ui/item` 这一族本仓
> 早就逐字移植好了、三个兄弟设置页都在用，这里是最后一处还在手写的。换过去之后
> `depth` 整档归零。
>
> **二、账号列表无条件渲染（21 行）。** 「已连接账号 / 尚无渠道账号。」这一块是本仓
> 独有的（上游一个 provider 只认一条 connection），留着是对的——多账号与逐账号断开被
> `tests/e2e-channels/channels.spec.ts` 拿真 Gateway 钉着。但它原来**对 7 个 provider
> 全部渲染**：对一个连配都没配的 provider 说「它还没有账号」是零信息；更糟的是
> `DEER_FLOW_AUTH_DISABLED=1` 下配好且跑起来的 provider 本来就不该有 binding row，
> 于是同一张卡片上边徽标写「已连接」、下边写「尚无渠道账号」。改成
> `v-if="view.connections.length > 0"`，空态那句文案（`channels.noAccounts`）一并删掉。
>
> **三、动作条顺序反了（1 行 `order` + tab 落点）。** 上游两个分支都是
> Modify 在前、那一档的状态操作在后（右对齐的一排里主操作在最右是通行做法），
> 本仓把 Connect 排在了 Modify 前面。
>
> **四、`Disconnect` ×3（React-only）对 `Remove provider configuration` ×6（Vue-only）
> ——查下去发现是同一个端点，而上游那一侧是错的。**
>
> 两边打的都是 `DELETE /api/channels/{provider}/runtime-config`。后端那条
> （`backend/app/gateway/routers/channel_connections.py:570`）做三件事：
> 停掉整个部署的这条渠道运行时、**把所有人的 connection 行一并吊销**、删掉 provider
> 的运行时配置；而且函数第一句就是 `await require_admin_user(...)`。
>
> 上游把它叫 "Disconnect"、**对所有人渲染**、点下去没有任何确认，而且只在
> `isConnected` 那一档才有。三件事都是错的：
>
> - 名字说的是「断开我的连接」，它删的是部署级配置；
> - 非管理员点下去只能拿到 403 和一句 `Failed to disconnect {provider}`，看不出是权限；
> - app secret 填错、永远连不上的 provider **没有任何办法清掉**。
>
> 本仓这一侧本来就是对的（管理员限定 + AlertDialog 确认 + 说实话的文案），
> 所以**两边同改 = 只改 React**：`isAdmin` 判据是同目录下 skill / subagent /
> integrations 三个设置页早就在用的那一行，渲染条件改成「配过就能清」，
> 词条 `channels.disconnect` 改名 `channels.removeProviderConfig`（React 侧它只有
> 这一个消费点）。**确认对话框没有跟过去**：React 侧没有 alert-dialog 这个 primitive，
> 为一颗键引进一个新 primitive 越过了「frontend/ 只做小改」的边界。
>
> 顺带修掉上游同一个文件里的另一处不一致：同一颗 Modify 在已连接分支带 `PlugIcon`、
> 未连接分支不带，于是 provider 连上之后这颗键自己宽出 18px。两个分支的变体与尺寸
> 完全相同，是漏写不是设计。
>
> **五、`channels.descriptions.buzz` 的中文是本仓独有的一版**（2 行）：上游
> 「通过 DeerFlow 智能体接收 Buzz 频道消息和私聊。」，本仓「通过 DeerFlow Agent 接收
> Buzz 渠道消息和私聊。」。另外 7 条描述**逐字相同**，而「智能体」在本仓中文词典里
> 出现 58 次——这一行是孤例漂移，不是术语选择。照上游改回。
>
> **读数（单场景实测，`PARITY_ONLY=channels make e2e-parity`）**：
> `channels#settings-panel` **53 → 2（en-US）/ 54 → 2（zh-CN）**，
> `depth`、`geometry`、`order`、`ariaOnlyReact`、`ariaOnlyVue`、`tabbablesOnlyVue`
> 六档全部归零。剩下的 2 行两个语言一样，都是 wave 98 就判过「不跟」的
> `div[scroll-area-viewport]`（上游那条 `ScrollBar className="hidden"` 永远不滚动，
> 只多一个键盘停靠点），以及它在 `tabOrder` 上的同一处投影。
>
> ## 2026-09-11 记一条判据：`thread-list-infinite-scroll` 那条 spec 再红时怎么判
>
> **这是我自己引入又修掉的竞态，留下判据免得下次当成偶发。**
>
> 症状：`sidebar recent chats loads more threads when scrolling to the bottom`
> **等满 15 秒超时**（正常 1–2 秒跑完），第 51 条永远不出现。
>
> 根因：侧栏的 IntersectionObserver 回调里写的是
> `if (threads.canLoadMore && entries.some(isIntersecting))`。
> 列表还空的时候哨兵本来就在视口内，回调触发一次、被 `canLoadMore === false`
> 挡掉；此后哨兵**一直可见，不会再有 intersection 事件**，于是首屏数据到了也
> 永远不翻页。`scrollIntoViewIfNeeded` 对已在视口内的元素不滚动，也不产生新事件。
>
> 为什么现在才露出来：`onMounted` 里原来有一句 `void threads.loadInitial()` 排在
> 建观察者之前，时序上遮住了它；列表查询改成自己会跑（`48e9297a`，`enabled` 打开）
> 之后那句删掉了。
>
> 修法：**观察者只记「哨兵在不在视口里」这个状态，翻页交给 `watch`**
> （`ThreadSidebar.vue` 与 `chats/index.vue` 两处同改）。
> 「一次性事件 + 依赖异步状态的守卫」本来就是脆的形状。
>
> **没有为它写测试**，理由写在这里而不是含糊过去：挂载 `ThreadSidebar` 要 mock
> router / i18n / projects / useThreads 一大片，而这条竞态在 e2e 里也复现不稳
> （实测重跑 3 遍 9 条全过、整套 e2e-mock 再跑一遍 272 条全绿，只在那一次红）。
> 所以判据写在这里 + 代码注释里。**再看到这条 spec 红，先对症状**：
> 是不是 15 秒超时、是不是第二页永远不来——是的话先看这两处观察者有没有被改回
> 「在回调里判守卫」。
>
> ## 2026-09-11 判一条「不跟」：`thread-list-pin#mobile-drawer` 上那两行
> （`POST /api/threads/search` 与 `GET /api/features` 各多一次）
>
> 单场景实测：React ×2 / 本仓 ×1（search），React ×3 / 本仓 ×2（features）。
>
> **判词：不跟。** 差别是**查询挂在哪一层**，不是行为：
>
> - 上游窄屏的 `Sidebar` 走 shadcn `Sheet`（Radix Dialog，没有 `forceMount`），
>   抽屉关着时内容**不挂载**；`useInfiniteThreads` 与 features 查询就住在那棵子树里，
>   所以「点开抽屉」＝ 一次挂载 ＝ 各多取一次。
> - 本仓 `useThreads()` 写在 `ThreadSidebar.vue:65`，也就是 Sheet 的**外面**
>   （`ThreadSidebarShell` 只拿 `<slot>`），查询自始至终只有一个观察者，
>   点开抽屉不产生任何请求。
>
> 两边**渲染结果一致**（这一档的 aria 差异只剩早就判过的 `scroll-area-viewport`），
> 本仓做的网络工作严格更少。要对上这两次，得把查询搬进抽屉子树、让桌面与移动端
> 各成一个查询所有者——那是在模仿**挂载拓扑**，不是在对齐行为。
>
> **唯一的行为细节**：上游点开抽屉会顺带重取一次列表，本仓不会（它的查询没卸载过）。
> 正常使用下没有差别——run 生命周期本来就会失效列表，而 `48e9297a` 之后那些失效
> 真的会触发重取了。
>
> **翻案判据**：本仓哪天把侧栏内容改成随抽屉条件挂载（或加上会让列表变旧的长驻页面），
> 这一条重新成立。
>
> ## 2026-09-11 已修：`chat-thread-init-ordering` 上那行
> `requestsOnlyReact: POST /api/threads/search`（`5cc426e3`）
>
> 用新加的 `PARITY_ONLY=<场景id> make e2e-parity`（单场景 + 两边完整请求序列转储，
> 4 分钟一轮）量清了**位置**：
>
> ```
> React: … POST /api/langgraph/threads → POST /api/threads/search → runs/stream …
> Vue:   … POST /api/langgraph/threads →                            runs/stream …
> ```
>
> 上游 `upsertThreadInInfiniteCache`（`hooks.ts:1281`）对**带 `archived` 过滤**的
> 缓存是 `invalidateQueries` 而不是乐观插入，注释写着「Run-created snapshots do not
> carry archive metadata」——run 里现造的快照没有归档元数据，塞进「只看未归档」的
> 列表是在替服务端猜。
>
> **照抄过来会过头，实测方向反了**：本仓每一份列表缓存都带 `archived` 过滤
> （`useThreads` 的 params 一定带），而 `upsert` 的调用点比上游多，
> 单场景实测 React 4 次 / 本仓 **6 次**。收窄成「只有这条 thread 还不在列表里时
> 才失效」也没降下来（仍是 6）——多半是失效之后重取还没落地，下一次 upsert 又判成
> 「不在列表里」，级联出去。**已回退，不留一个把台账变长的改动。**
>
> **按这条路查完了**：列清调用点之后根因很清楚——上游一次 run 只调一次
> `upsertThreadInInfiniteCache`，而本仓的 `upsert()` 靠「在不在视图里」分新旧行。
> 上一版跟着上游「只失效不插」，视图里永远没有那一行，于是后面每次 `upsert`
> 都再判一次新行、再失效一次（级联，6 : 4）。**插 + 失效**之后 4 : 4，
> 请求差集空，台账 204 → 203 零新增。
>
> ## 2026-09-11 已修：归档一条会话会把侧栏列表清空（`48e9297a`）
>
> 根因与「改名之后不与服务端收敛」同一个：**本仓的会话列表查询是 `enabled: false`
> 的手动查询**（`useThreads` 的 `useInfiniteQuery`，`eaf9d6a7` 写下时没有留任何理由）。
> 探针实测（Vue Query 5，`enabled:false` 的 infinite query）：
>
> | 操作 | queryFn 跑了吗 | 缓存数据 |
> | --- | --- | --- |
> | `query.refetch()` | ✅ | 有 |
> | `invalidateQueries` | ❌ | 有 |
> | `refetchQueries` | ❌ | 有 |
> | `refetchQueries({type:"all"})` | ❌ | 有 |
> | `resetQueries` | ❌ | **被清空** |
>
> `core/threads/archive.ts:109` 对这个 key 调的正是 `resetQueries`
> （注释写着「成员关系变了，旧的分页偏移作废——必须 reset 而不是 invalidate」，
> 判断没错，错在它 reset 的是一个**不会自己重取**的查询）。
> 第二个探针直接量了后果：`loadInitial()` 之后侧栏有 1 条，`resetQueries` 之后
> **变成 0 条，且没有任何重取**。也就是说**归档一条会话，侧栏列表就空了**，
> 直到换路由或手动刷新。现有 e2e 没有在归档之后看侧栏，所以门禁全绿。
>
> 同一个根因还产生了台账上 4 行 `requestsOnlyReact: POST /api/threads/search`
> （`chat-thread-init-ordering` 3 行 + `thread-list-pin#mobile-drawer` 1 行）：
> 一次 run 结束后上游会重取列表，本仓的 `invalidateStoppedThreadCaches` 是空操作。
>
> **已按这个修法落地**：列表查询自己会跑，`AgentChat.vue` 与 `ProjectsSection.vue`
> 显式传 `enabled: false`（它们只读缓存，上游的 chat-page 根本不挂这个查询）。
> 回归测试钉的是「reset 之后列表会自己回来」，做过变异验证。
>
> **验收结果**：零新增；`chat-thread-init-ordering` 上那 3 条重复的
> `POST /api/threads/search` 降到 1 条。**剩下的两行没结清**——
> `chat-thread-init-ordering` 1 条 + `thread-list-pin#mobile-drawer` 1 条，
> 上游仍然比本仓多问一次列表。下一轮从这里接着查。
>
> ## 2026-09-11 已清：`["threads", "search"]` 是一个死缓存键（`10335b5d`）
>
> 修改名那条账时量出来的：**本仓没有任何查询拥有 `["threads", "search"]`。**
> 会话列表走的是 `useInfiniteQuery`，key 是 `["threads", "searchInfinite", params]`；
> 而 `["threads","search"]` 的那个「本该的拥有者」`buildThreadsSearchQueryOptions`
> （`core/threads/thread-search-query.ts:59`）**在 `app/` 下零调用点**，只有它自己的
> 单测在用。两个 key 也不会互相前缀匹配（`"search" !== "searchInfinite"`）。
>
> 于是所有针对它的操作**都是空操作**：`setQueriesData` 只更新已存在的查询，
> 没有查询就什么都不做；`invalidateQueries` / `cancelQueries` 同理。产品侧 11 处：
>
> | 文件 | 处数 |
> | --- | --- |
> | `core/threads/archive.ts` | 3（write / cancel / invalidate）|
> | `core/threads/cache-invalidation.ts` | 2 |
> | `composables/useThreadStream.ts` | 2 |
> | `composables/useThreads.ts` | 1（`updateCachedThread` 的第一半）|
> | `composables/useProjects.ts` | 1 |
> | `core/threads/infinite.ts` | 1（`upsertThreadInSearchCache`）|
> | `core/threads/thread-search-query.ts` | 1（死模块本身）|
>
> **而单测是绿的**——因为有几处用例自己 `setQueryData(["threads","search"], …)`
> 造出一个生产里不存在的拥有者，再断言镜像写入落进去了（`thread-stream.dom.test.ts`、
> `infinite.test.ts`、`account-settings-auth-boundary.dom.test.ts`）。
> 这与本仓已经记过的那一次同形：`use-threads.dom.test.ts` 头注释里那句
> 「这些用例覆盖的是一段不会执行的代码，而且照样全绿」。
>
> **已删**（11 处 + 死函数 + 只服务于它的两个常量），6 处「自己造拥有者」的用例改成
> 断言真实那张列表缓存。验收判据满足：`make e2e-parity` 121 passed，
> `baseline/parity-diff.json` 未被改写。
>
> **顺手删掉的一条假保证**：`thread-search-query.test.ts` 里那条
> 「refetchInterval 让 IM 建的会话出现在侧栏」测的是一个从来没挂上过的查询选项。
> **两个应用的会话列表都不轮询**——这句产品性质此前只有那条用例在「保证」。
> 要它成立得先真的加轮询，那是产品决定，已从测试里移除而不是改写。
>
> ## 2026-09-11 判一条「不跟」：改名之后上游那次 `GET /api/langgraph/threads/{id}`
>
> 台账 `thread-title-sync` 上那一行 `requestsOnlyReact:
> GET /api/langgraph/threads/00000000-…-0001`（两个语言维度各一行）。
>
> **判词：不跟。** 上游那一次请求是 `useThreadMetadata` 这个查询被
> `useRenameThread` 的 invalidate 触发的——上游的会话头部读的是
> `threadMetadata.data?.values?.title`（`chat-page.tsx:399`）。
> 本仓的头部读的是**列表缓存**（`AgentChat.vue` 的 `headerTitle` 直接从
> `threads.threads` 里找当前这条），没有第二个查询要收敛。为了让请求计数对上而去发
> 一个**没有任何读者**的请求，是搬运不是对齐（本仓明写的判据：不承重就别写）。
>
> **同一轮结清的那一半**：`requestsOnlyReact: POST /api/threads/search` 是真差异，
> 已修——本仓的 `rename` 此前只写本地缓存，不 cancel、不失效。三步补齐之后
> （见 `useThreads.ts` 的 `rename`），标题被服务端规范化或别的设备并发改过名时才收敛得回来。
>
> **翻案判据**：本仓哪天给会话头部单独开一个 thread-metadata 查询
> （比如头部要显示列表投影里没有的字段），这一条立刻成立，跟上即可。
>
> ## wave 202 新挂一条：**`e2e-agents` 里有一处没人在看的静默失败**
>
> 补跑 `e2e-backend`（EXIT=0，22 条）时看到的：`suggest_agent` 每跑必报两次
>
>     app.gateway.routers.suggestions - ERROR - Failed to generate suggestions:
>     err='replay miss: … Caller: suggest_agent'
>
> **而用例照绿**——那几条不断言跟进建议，于是这条错误每次都在日志里、没人看。
> **不是产品缺陷**（生产走真实 LLM），是 `write_read_file.ultra` 这份 cassette
> 里没有这两个输入的录制。
>
> **三条可选的做法，各自的代价**：① 重录 cassette（要后端活 + API key，
> **与 `animationName` 卡点② 同一个障碍**，一次能解两条账）；
> ② 让用例显式断言「这里现在没有建议、因为夹具没覆盖」，把静默变成写下来的事实；
> ③ 让 `e2e-backend` 见到 `replay miss` 就红——**信号最强，但今天没法修就等于把门禁钉死在红**。
> **翻案判据**：哪天有人重录 cassette，①②③ 都不必做了。
>
> ## wave 200：**机器可读的账全清了。**（2026-09-09 实测）
>
> | 表 | pending |
> | --- | --- |
> | `baseline/parity-route-sampling.json` | **0**（`/auth/callback` 本轮结清）|
> | `baseline/parity-scenario-coverage.json` `pending` / `$pendingReasons` | **0 / 0** |
> | `baseline/react-parity-scope.json` `pendingRoutes` | **0** |
>
> **两条都是从根因结清的，不是重新判一次**：
>
> - `/auth/callback` 挂着的理由（「要一次真实的 OIDC callback session」）**是猜的、
>   而且是错的**——两边都只是问一次 `auth/me` 再分支，用 `delayMs` 挂住那个端点
>   就得到稳定的「还在验证」终态。**en-US 十一档全空，zh-CN 只有 2 行**（已判类）。
> - `integrations.spec.ts:461` 的偶发点击超时：**对话框缩放进场时点它里面的东西**，
>   实测位移 **21.2px**、约 170ms 停稳。收成唯一入口 `openSettingsDialog` + 零豁免守卫。
>
> **wave 201 追加**：第五节「还没筛的同形目标」那一条（`DEERFLOW_DURABLE_STATUS` /
> `DEERFLOW_WIRE_EVENTS`）**也已过期**——前者 wave 107 就钉住了，后者 wave 201 补上，
> `backend/` 早就在 `make verify` 的读取面里。**两张表现在都有机器守。**
>
> **下面第一节那个标题「真正还开着的（4 条）」是历史文本**，它下面那张表里的行
> 早就逐条判过或划掉了；数字没跟着改过。**以上面这张表为准**——它是机器可读的。

> **wave 196 结清一条、新挂一条。**
>
> **结清**：`sidecar-chat.spec.ts` 那条约 1/40 的偶发红（wave 195 留下的）。
> **不是抖动**——`invalidateQueries` 的 `cancelRefetch` 只在查询已有数据时才生效，
> 新建 thread 的第一次取数满足不了这个前提，于是 run 结束时的失效被在飞的取数
> 整个吃掉、一次请求都不产生。**两边同改**（上游同形），并给 Vue 补上上游那道
> `!thread.isLoading`。负向验证是确定性的：无补丁 3/3 红、有补丁 3/3 绿。
>
> **新挂**：`e2e-mock` 整套四次里有两次各红一条**不同**用例
> （`artifact-panel-resize:106` 拖拽折叠、`thread-history:105` 千轮虚拟列表），
> 另两次与干净树一次都绿。**两条都与 wave 196 的改动无关**（判据是执行路径：
> 两个用例全程没有 run，本轮两处改动一处都进不去），拖拽那条隔离态
> `--repeat-each=20` **100/100 绿**。**下一轮查的是「整套负载下」这个条件本身。**
>
> **那两次的 trace 已经没了**——`test-results/` 会被下一次运行清空，而我为了判断
> 是不是回归恰好重跑了两次。**wave 197 修的就是这件事**：真跑用例统一走
> `E2E_RUN`，失败时把现场另存到 `test-results/failures/<时间戳>/`。
> 下一次整套红时，trace/video/截图都会留住。
>
> **wave 198 收掉两条里的第一条**（`artifact-panel-resize:106`）：splitpanes 的窗格
> `width .2s ease-out` 让分隔条 200ms 内滑 332px，而命中区只有 16px——
> 在过渡途中量一次就按在那个读数上，拖拽静默失效。已改成按真实时间间隔判稳，
> 并当场断言「抓住了没有」。
>
> **wave 199 收掉第二条**（`thread-history:105`）：`dispatchEvent("wheel")` 是合成事件、
> 不会真的滚动，列表还停在尾部，`onScroll` 的 `atTail` 分支把 `followingTail` 置回 true，
> 虚拟窗口被钉死在尾部。改用真滚轮，并把那个致命 scroll 事件永久留在用例里
> （换回合成 wheel 就确定性红）。**这两条都清了。**
>
> **新挂一条**：默认并行度整套跑 10 轮红了 1 条 `integrations.spec.ts:461`
> （点击超时），现场已由 wave 197 的归档器留下。同一段里 196/198/199 都是
> 「在还没稳定的界面上量一次、再照读数行动」这一类，这条大概率同族。

> **判据提醒**：台账**实测**是 **103 行 / 95 个取样点**（wave 200 用 `scripts/parity-ledger-report.mjs` 量的；此处原来写着「202 行 / 90 个取样点」，是 wave 150 前后的旧数，**别引用散文里的数字，跑那个脚本**）（wave 150 不动 app 代码，行数未变）。
>
> **wave 150 把上一轮留的两条线索都就地判掉了，两条都是「量完不改」**：①`ariaOnly*`/`order`/`focus` 四档共 83 行、认不出的只有 6 行（7%），远低于上一轮那个 75%，按 wave 99 的先例不动尺子；②上游那个 4px 拖拽把手**不做两边同改**——目标尺寸是判断题（WCAG 2.5.8 有「周围留白 24px」这条替代路径，分隔条恰好符合），不属于 wave 138 那种「控件对读屏器无名」的客观缺陷。
>
> **wave 149 结清了上一轮新挂的第 8 条，代码改动为零**：那个 `tabbablesOnlyReact: div` 是 ScrollArea 的 viewport（wave 98 判过「不跟」那笔账在另一屏上的复现）；两条请求是**次数差不是集合差**，而且**只在抽屉打开那一刻**上游多发一轮（桌面态两边完全一致）。
>
> **顺手修了尺子**：`tabbablesOnly*` / `tabOrder` 三档共 79 行，**其中 59 行是裸 `div`/`span`、认不出是谁**。描述器给 generic 标签补上 `data-slot`（判据窄到「只在认不出时补」）之后，**59 行进 59 行出、台账行数一格没动**，而且全部解析成同一个 `div[scroll-area-viewport]`——那 59 行原来是同一笔账。现在认不出的行是 **0**。
>
> **wave 148 结清了上一轮新挂的第 6b 条**：移动端抽屉换成 `ui/sheet`（reka Dialog），34 行里 **32 行归零**——抽屉背后那一整页不再留在可访问性树里。顺着这个根因**系统扫了全仓**，同类另有两处（外链确认弹窗、mermaid 全屏），一并换成 `ui/dialog`；并配上零豁免守卫 `tests/guards/hand-rolled-overlays.test.ts`。
>
> **wave 147 新挂一笔（第 6b 条）、下一轮就修**：移动端侧栏抽屉第一次进取样面，34 行里 30 行是同一件事——上游用 Radix `Sheet`（给兄弟节点打 `aria-hidden`），本仓是手写的 `role="dialog" aria-modal="true"` + 手写焦点陷阱，**快照工具认前者不认后者**。键盘那一半两边等价（`tabbablesOnlyVue` 是空的，量过）。
>
> ~~**wave 144 新挂一笔、下一轮就修**：Tabs 的 variant 体系本仓整套没有。~~
> **wave 145 已修**：三处联动（根的 `group/tabs`、`TabsList` 的 `tabsListVariants`
>
> - `data-variant`、`TabsTrigger` 的四段类串）全部逐字搬过来，调用点传 `variant="line"`
>   并把创建键挪进上游那个 `<header class="flex justify-between">`。
>   **每语言 11 行归零，台账 219 → 197。**
>
> ~~**wave 145 新挂一笔（第 7 条）**：取样面看不见伪元素。~~
> **wave 146 已做**：伪元素进取样面（只对已有锚点顺带取，不记位置），
> 干净树 0 行且那个 0 是算出来的，另配形状断言 `pseudoSamples >= 4`。
> 顺带把分栏拖拽把手第一次挂成锚点，量出两行：一行是画法不同（已对齐，
> 屏幕上没变化），一行是点击区 4px vs 16px（**本仓更好，接受**）。
>
> wave 96 用 tab 序那一档量出的
> 64 行，**wave 97 已逐条结清**（修掉 52 行、接受 2 行、剩下的变成下面第 6 条那处
> 新的结构差异）。规则仍是「新出现的行要么已决定、要么有名有姓地挂在这张表上」。
> 其余各类是——
> 2 行 reka-ui 的 tooltip 播报节点（wave 91）+ 42 行「上游把字写死成英文、本仓翻译了」
> （wave 92 量出 28 行，wave 93 给 mermaid 加第二个终态时同一类在同屏又记一次，+14）
>
> - **7 行焦点差异**（wave 94），三类都在下面第一节里逐条交代。
>   **规则相应改成：「新出现、还没定过的行只能减不能增」**，「台账 0 行」这个目标不再成立。
>   「量不出差异」的准确含义一直是「**这些取样点上量不出差异**」，
>   不是「两个应用一样」。天生看不见的八类见交接文档。
>   **wave 88 又给它补了一条**：双向比对**看不见「两边一起漏」**——
>   22 颗按钮两个应用都没有 `aria-pressed`，三档全是 0 行。
>   **wave 89 把这条补成了机器守的**：`tests/guards/toggle-variant-pressed.test.ts`
>   两个应用一起扫，并顺手扫出剩下的两边各 12 颗。

---

## 一、历史逐条台账（**读之前先看这一句**）

> **2026-09-11/12 那一轮把台账上的每一行都重判了一遍**，下面这张表里
> **4 / 5 / 6 三条的结论已经被推翻或部分推翻**（逐条标在行末的「⚠ 已被推翻」里）。
> **以本文件顶部那一串 2026-09-11 条目为准**，这张表留着是为了能看到判据是怎么演进的。
> 带删除线的行是更早就结清的。

> **wave 195：安装页那 5 处缺口全修，`setup/en-US` 10 行 → 1 行。**
> 其中输入框尺寸那条是**旧账**：`login.vue` 的文件头早就记着同一段读数，
> wave 68 修过登录页却漏了安装页——而安装页直到 wave 194 才第一次进取样面，**挂了 126 轮**。
>
> **顺带发现一条静默失效的配置**：`retries: 0` 配 `trace: "on-first-retry"`
> ——**trace 从来没被录过**（旁边的 `video` 却是 `retain-on-failure`，同一份文件自相矛盾）。
> 这正是那条 sidecar 偶发红查不下去的直接原因：现场只有截图。已改 + 实测 trace.zip 写得出 + 配守卫。
> **但那条偶发红本身的根因仍未知**：单跑 8 次、整文件 3 次、整套 3 次共 14 次全绿，复现不出来。


> **wave 194：上一轮那条「同不同屏」的判据是错的。** 它把「同一屏但一侧没翻译」当成了
> 「不在同一屏」——实测两边都停在 `/setup`，只是**上游那一屏在 zh-CN 下几乎整屏英文**。
> 判据换成**最终路径必须相同**（`ParityCapture` 加 `url`，不进台账）。
> `/setup` 因此进了取样面，**第一次比就照出 5 处 Vue 侧缺口**：缺副标题、缺「保持登录」说明、
> 缺确认密码占位符、标签大小写不同、确认密码输入框高 42/16px 对上游的 36/14px。
> **下一轮修，全在 `frontend-vue/` 内。** 路由棘轮只剩 `/auth/callback`。


> **wave 193：wave 191 的分叉查清了——是我自己的场景写错。** `mock-api.ts` 对
> `GET /api/v1/auth/me` 返回「已登录」，而 Vue 的 `login.vue` 在挂载时探这个端点、
> 探到就跳去工作区；我给那两条场景写了 `backend: "mock"`。**不是 Vue 的缺陷。**
> 套件已重建（场景一律 `backend: "gateway"`），并加了一条**防再犯**的断言：
> 两棵可访问性树公共行太少就当场红——「差异很多」和「根本不在同一屏」不是一回事。
> 它当场抓到 `/setup` 在 zh-CN 下只有 3 行公共行（en-US 正常，换锚点无效），
> **原因未查清、因此没有写进场景表**。
>
> **登录页正式进了取样面，十一档只有 1 行**：`requestsOnlyVue: GET /api/v1/auth/me`
> （Vue 登录页的会话探测），**判接受**；其余全部一致。


> **wave 192：登录页第一次被真正比过——两边完全一致。**
> 不用新套件：跑着的 Docker 栈本身就是「鉴权开 + 无会话」（`auth/me` 实测 401）。
> 在它上面逐项比：文案、输入框、按钮、链接**逐字相同**；`/setup` 两边都跳 `/login`，之后同上。
> 所以 wave 191 那份基线记的确实是夹具假象，**而我当时的两个猜想也都被实测否掉**
> （回放 Gateway 的 `auth/me` 返回 401、种子只挂一个 seed-runs 路由）——**真正原因还没查到，如实记着**。
> 路由棘轮那两条 pending 现在欠的不是「这一屏对不对」，而是「让它进自动化取样面」。


> **wave 191：搭了开鉴权的对照，量出它还不可对照，整体撤回。** 基础设施都跑通了
> （config / testDir / spec / baseline / make 目标 / README×2 / 三条守卫），
> 但生成的基线记的不是差异：**`/login` 上 React 停在登录表单、Vue 直接进工作区**，
> `/setup` 上 React 自己也跳到了 `/login`。接上开着鉴权的回放 Gateway 后**读数一模一样**，
> 所以不是缺后端。请求档指出原因：**两边判会话用的端点不同**
> （React 问 `auth/providers` + `setup-status`，Vue 问 `auth/me`）。
> 在分清「产品差异」还是「种子会话让两边看到不同状态」之前，这份读数**不能签入**——
> 签进去就是把噪声当发现，而且会以「已判过的台账行」的身份长期误导。
> 已整体撤回，**量到的东西写进了那两条 pending 的理由**。


> **wave 190：不动台账。** 为下一轮的「开鉴权对照」做前置：**判词抽成一处共享**
> （`support/diff-entry.ts`），否则新套件会带来这个工厂的**第二把尺子**。
> 等价性判据是「签入基线一行不动」——`make e2e-parity` **103 passed** 即为证。
> 顺带给这把尺子补了单测（此前只有一个要跑 11 分钟的消费者），
> 四次变异各红一条，钉的都是「坏了会让台账**变短**」的那几条性质。


> **wave 189：路由棘轮 4 条待做关掉 2 条，另 2 条的挡路理由从猜的换成实测的。**
> `/showcase/[thread_id]` 原来的理由（「需要可公开读的 thread 夹具」）**本身就是猜的**——
> 实测两边把 demo 夹具都签在自己的 `public/` 里，不打 Gateway、不需要鉴权，接进去就跑。
> 它照出 **10 行**，其中 8 行是真缺陷：**匿名访客打开公开分享页，React 替他发了四条工作区请求**
> （features / skills / suggestions-config / uploads-limits），Vue 一条不发。
> **已修，8 行归零**——修法是小改：`isMock` 本来就靠 `/showcase/` 前缀判出来了，
> 那四条查询只是没挂这个已有的门控。台账 **216 → 208**。
> `/login` `/setup` 的挡路已查清：**auth 模式是构建期决定的**，要取样得为两个应用
> 各起一份开鉴权的 preview，属于基础设施活。


> **wave 188：换了个坐标系，照出 9 条从没被取样过的路由——其中 4 条是真产品屏。**
> 覆盖率棘轮的坐标系是**上游 e2e spec 的文件名**，而它的两条断言合起来是一道天花板：
> **上游没写过 spec 的屏永远排不进取样面**。`/login`（第一屏）、`/setup`、
> `/workspace/agents/new`、`/showcase/[thread_id]` 就是这样一直在外面。
> 已把「恰好相等」放松成「上游每一份 spec 都被表过态」，并新加**以路由为坐标的第二个棘轮**
> （`baseline/parity-route-sampling.json`，4 豁免 / 4 待做，各写明理由）。
> 当轮关掉一条：`/workspace/agents/new` 第一次进取样面，**两边十一档全空，台账一行没长**
> （206 行不变，取样点 91 → 93）。
>
> **新的 4 条 pending 不是回归**：原棘轮仍是 `pending: 0`，这 4 条是换坐标系才看见的缺口。


> **wave 187：九门禁全扫（八绿 + audit 预期红 14），并问了一个此前没问过的问题——CI 到底跑不跑。**
> 九条里 **三条 CI 不跑**（`standalone-sim` / `e2e-parity` / `icon-parity`），而只有 `e2e-visual`
> 的「只在本地」是有守卫和成因绑住的。顺着 `icon-parity` 挖到**我自己写的一句假话**：
> 它的文件头写着「顾问工具，不进任何门禁」，而 **wave 111（也是我改的）**给过期豁免加了
> `exitCode = 1`——**它会红，它就是门禁**，这也解释了它为什么既不在 README 也不在 CI。
> 已改正、两份 README 同补，并把「CI 实际跑哪些」写进文档 + 配**双向守卫**
> （接进 CI 而不改 README 也会红）。


> **wave 186：上一轮新记的第 10 条当轮判掉并结清。** React 补上容器 HEALTHCHECK，
> 但**不新增产品路由**：探 `/` 会每小时触发 360 次 GitHub 取数（限额 60，正是 wave 174 那个坑），
> 新增 `/health` 会把运维端点塞进产品树；**用 TCP 连通探测**——依据是仓库自己已经判过一次，
> Helm 的 frontend Deployment 对同一个 workload 用的就是 `tcpSocket`。
> 判据因此是「**声明了 HEALTHCHECK**」而不是「声明同一个」。双向实测（healthy / unhealthy）。


> **wave 185：不动台账，但新记一笔。** 把「三份配置比一遍」的手法搬到两个前端的 Dockerfile：
> **生产 compose 下 React 的前端容器以 root 在跑，Vue 的是 `node`**（Helm 另用 `runAsUser: 1000`
> 压过，于是 K8s 加固而 Compose 不是）。已照 Vue 那份改（`--chown` + `USER node`），
> **真构建真运行验过**：`uid=1000(node)`、HTTP 200、`.next/cache` 可写。
>
> **新记一笔（第 10 条）**：Vue 有 `server/routes/health.get.ts` 与容器 HEALTHCHECK，
> **React 两样都没有**。没修——补它要往 `frontend/src/app/` 加一条运维用的路由，
> 属于运维面不是产品面，**下一轮判要不要做**。


> **wave 184：不动台账。** 判据再提一档，但**不是**提到「所有指令」——日志与 pid 路径是真的
> 环境差异，写进豁免表就是坑 180。提到 **`map`** 这一档：`map` 从请求推导变量、与进程跑在哪儿
> 无关，两份需要第三份就需要，零豁免。它要求的那条有实际后果：local 缺
> `map $http_x_forwarded_proto`，**`make dev` 跑在另一层 TLS 反代后面时登录会 403**。已补。


> **wave 183：不动台账。** 别再一条一条找了——把「三份 nginx 配置是同一份配置」做成判据：
> **凡是出现在 ≥2 份里的 `location`，必须三份都有**（零豁免；只出现在一份是环境特有的
> 合理增补，出现在两份少第三份就是漂移）。它自己吐出两条我肉眼没找到的真缺陷：
> **Helm 缺 browser/stream 那条 location**（K8s 上浏览器面板实时流被降级成普通 HTTP、建不起来），
> **local 缺 `/api/sandboxes`**（`make dev` 下 provisioner 模式不可达）。
> 另外把「API 文档地址随跑法而变」也统一了。三份配置各跑过真的 `nginx -t`。


> **wave 182：不动台账。** 把 wave 181 的发现系统扫一遍——`test_gateway_runtime_cleanup.py`
> 的**四条** nginx 性质各写着一个内联二元组，Helm 那份四条都不在内。实测**三条成立、一条不**：
> Helm 的前端 location 写死 `proxy_set_header Connection 'upgrade';`（正是守卫明令禁止的字符串），
> **每个前端请求都被当成 WebSocket 升级发给上游**。已补 `map` 并改成 `$connection_upgrade`，
> 四条接到共享发现上。顺带把「Helm 只发 React」这条边界在 AGENTS.md 与守卫里**双向**钉住。


> **wave 181：不动台账。** 台账上已无「待办」的账，这一轮回到「找一句写下来当规则用、
> 却没有机器在守的话」：`test_nginx_langgraph_body_size.py` 写着这份配置维护在**三处**，
> 而 `test_nginx_compression.py` 的名单只有**两处**——漏掉的正是 Helm 的 ConfigMap，
> **它一条 `gzip` 都没有**，Helm 装出来的那套所有资产都不压缩，而 AGENTS.md 把压缩写成
> Nginx 的性质、不带条件。已补齐，并把「哪几份 nginx 配置」抽成**一处会自己去发现**的定义。


> **wave 180：第 9 条最后一条（④⑧⑨ `Edit and rerun`）结清，台账 209 → 206，一处改动关掉三行。**
> **前两轮的猜测全错。** 两个应用同时插桩，groups 与判定结果 **一模一样**——
> 新建会话刚发出第一条时那条人类消息**还没有后端给的 id**，两边算出的 editable 都是 null。
> 差别只在比法：上游有 `Boolean(msg.id)` 挡着，本仓的
> `editable?.humanMessage.id === message.id` 变成 `undefined === undefined`——**相等**，
> 于是给一条**根本没法寻址、点了也重跑不了**的消息画出编辑键。**本仓错、上游对**，已补。
>
> **判据做成行为判据不是源码扫描**：同形的 `a?.x.id === b.id` 全仓还有三处，
> 都是两边成对、右侧恒有值的正常写法，要给它们开豁免就是错判据（坑 180）。
>
> **第 9 条到此全部处理完**：三条「下一轮验」全部结清，剩下的两行是 wave 175
> 判过并留了翻案判据的（路由播报器、`threads/search` 次数差）。


> **wave 179：第 9 条三条「下一轮验」的第二条结清，台账 210 → 209。**
> ③ `Completed in <1s` 只在 React——**wave 175 的判词错了，是缺功能**：上游有一条
> **客户端兜底计时**（`message-list.tsx:339`），本仓只认后端给的 `turn_duration`。已补齐。
> **中途被自己的单测骗过一次**：照抄上游把键写成 `${threadId}:${group.id}`，五条单测全绿、
> 真应用一个字都不显示——实测下降沿那一刻 threadId 还是空串（**第三例 id 交接**，
> 与 wave 158 / 175 同族）。键改成只用 `group.id`，换会话清空由 watch 保证，
> 并补了两条专门照这件事的用例。
>
> **④⑧⑨ 仍开着，但排掉了几项**：React 的编辑键在 +0.5s / +4.5s / hover / **刷新之后**
> 都是 0，**不是时序**；`isMock` / `STATIC` / `isUploading` / `hasGoal` 都实测为假；
> `getLatestEditableTurn` 与 `isTerminalAssistantTextMessage` 两边逐字相同。
> **下一轮把两边的消息数组 dump 出来比**——假设是历史端点不同导致 assistant 消息的
> 「终态」判定不同，**没验**。


> **wave 178：第 9 条里三条「下一轮验」的第一条结清，台账 211 → 210。**
> ⑤`focus: React=body Vue=textarea` 的**根因不是我猜的那个**——不是 composer 重挂
> （打标的 textarea 一直是同一个节点、`removals` 为空），是 React 在 run 结束那一刻给
> **正被聚焦**的 textarea 置了 **11~12ms 的 `disabled`**；浏览器当场失焦，摘掉也不还。
> 按同形扫全仓，两边各三处 composer + 其它会被打字的 textarea 共九处，**全部**改成
> `readonly` + `aria-disabled`，并各配一份零豁免守卫。那一行台账已归零。
>
> **③ 的判词要订正**：wave 175 写的「不是缺功能」是错的。React 有一条**客户端兜底计时**
> （`message-list.tsx:339`），Vue 的 `core/messages/run-duration.ts` 只认后端给的时长，
> **没有兜底**。是功能缺口，**下一轮补**。
>
> **④⑧⑨ 仍开着**，这一轮只把候选缩到 React `canEdit` 比 Vue 多出的那几项
> （`chat-page.tsx:358`）——**靠读代码缩的，没实测，下一轮拿探针量。**


> **wave 177**：**不动台账**。这一轮修的是 Docker 构建期的一道断言（自审里那唯一一条
> 「不是根因」的另一半），与对照台账无关。**自审结论见
> `docs/plans/vue-parity-fix-audit-2026-09-08.md`：16 处修改 = 12 根因 / 1 半根因 / 1 不是。**
> 那条「不是」的档位**没有升**——现在拦得住，但当初怎么产生的仍未查清。


> **wave 175**：第 2 条（覆盖率棘轮 pending）结清——判据达成、场景进 covered。
> 但**同一轮新开了一条**：那个场景进套件时带出 **9 行新台账**，逐条判词见下面新增的第 9 条。

> **wave 157**：第 3 条（tooltip 播报节点）判决关闭，5 → 4。理由写在那一行的末尾。

> ~~**wave 137 新挂一条**：~~ **wave 138 已修（两边同改，marker 推到 `7f97efd1`）。**
> 原文如下——
> **上游模型设置对话框那五个表单控件对读屏器都是无名的**（13 行 × 两种语言）。
> 上游 `agent-settings-dialog.tsx:137/158/178` 把标签写成
> `<span className="text-sm font-medium">`——不是 `<label>`、没有 `htmlFor`、
> 控件上也没有 `aria-label`，模型下拉与两个数字输入在可访问性树里全是无名的
> （WCAG 3.3.2 / 4.1.2）；本仓那三个都有名字。
> **按判据应当两边同改**（上游自己是坏的；同形缺陷仓库已同改过三次：
> wave 88/89 的 `aria-pressed`、wave 97 的 ScrollArea `tabIndex`）。
> **下一轮做**，做法与规矩写在交接文档 wave 137 第五节。

| #      | 账                                 | 状态                                         | 下一步要做什么                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~7~~  | ~~**划词工具条的 6 行层级差异**~~  | **wave 124 结清：根因是 `role="log"`，已修** | wave 122 发现归一化把每层缩进都塌成一个空格，wave 123 在**保住缩进**的数据上重做层级比对，量到 **6 行**：`Add to conversation` / `Ask in side chat` / `Close` 三颗按钮 × 两种语言，**React 深度 2、Vue 深度 3**。两边行数相同（60/60）、工具条标记逐行相同，所以多出来的是**祖先里的一个 generic 容器**——而 `- generic` 正好被归一化过滤掉，于是它在行比对里看不见、只在深度上现形。**下一步**：把那一层揪出来（探针打印祖先链），再决定修掉还是接受，以及要不要把「深度」这一档常驻台账（要走 `PARITY_ACCEPT_GROW=1`）。**判据参考**：工具条是 `position: fixed` + 显式 left/top，多一层 generic **没有布局后果**，按 wave 34「欢迎区在树里的位置」的先例多半是「保留」——但**先揪出来再决定**。                                                                                                                                                                                                                                                      |
| ~~7~~  | ~~**取样面看不见伪元素**~~         | **wave 146 已做，账结清**                    | wave 145 的负向验证 N2 暴露的：把 `Tabs` 根上的 `group/tabs` 删掉——`TabsList` 的 `group-data-[orientation=horizontal]/tabs:h-9` 与 `TabsTrigger` 里那一串 `group-data-[orientation=*]/tabs:after:*` 全部失效——**台账零反应**。两条原因：①横向 tablist 去掉 `h-9` 之后的自然高度**恰好也是 36px**（`p-[3px]` + 触发器 30px），属于巧合；②**几何档量的是元素，不量伪元素**，而 `line` 档的选中态（`group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100`）**全部画在 `::after` 上**。也就是说：整个 `line` variant 的视觉主体，现有八档一档都够不着。**下一步**：先按线索 258 的门槛问一句——「有没有一种变异能让新档响、而现有各档都不响」，N2 本身就是答案（举得出来）；做法是给 `sampleGeometry` 的锚点顺带取 `getComputedStyle(el, '::after')` 的 `content`/`opacity`/`height`/`background-color`，**只取锚点、不扩面**（线索 214/255）。**翻案判据**：如果那一档量出来的行几乎全是别的档已经报过的，就撤掉（wave 99 的先例）。 | **wave 146 结果**：只对已有锚点顺带取伪元素样式，干净树 **0 行**，而那个 0 是算出来的（N2 当场报 `w=56.7 h=2` vs `w=0 h=0`，其余七档零反应，重复率 0%）。整套只有 4 个锚点样本碰得到它——两个应用加起来用伪元素的地方只有九处——所以另配形状断言 `pseudoSamples >= 4` 挡住「尺子坏了→静默 0 行」。**没有撤掉。** |
| ~~6b~~ | ~~**移动端抽屉的模态做法不同**~~   | **wave 148 已修，账结清**                    | 抽屉换成 `ui/sheet`（reka `DialogContentModal` = `useHideOthers` + `FocusScope` + `DismissableLayer`），**34 行里 32 行归零**（背后整页 27 行 + `order` + `tabOrder` + 上游 Sheet 的 3 行 sr-only 标题说明——本仓照上游补了同样的 `SheetTitle`/`SheetDescription`）。**剩 2 行 `requestsOnlyReact`**（`GET /api/features`、`POST /api/langgraph/threads/search`）**与 1 行 `tabbablesOnlyReact: div`**，成因仍未查明、只记读数，另挂在下面第 8 条。订正一句上一轮写下的话：当时判成「两种都正确的模态做法」——不对等，`aria-modal` 是声明、`aria-hidden` 是事实，上游两样都有，本仓当时只有前者。                                                                                                                                                                                                                                                                                                                                                       |
| ~~8~~  | ~~**移动端抽屉那 3 行剩账**~~      | **wave 149 已查清，账结清（代码改动为零）**  | ① `tabbablesOnlyReact: div` → 探针查明是 `data-slot="scroll-area-viewport"`，即上游给建议行套的那层 `Suggestions`（`tabIndex={0}` 是 wave 97 两边同改补的）——**wave 98 判过「不跟」的那笔 ScrollArea 账在另一屏上的复现**，不是新缺陷。② 两条 `requestsOnlyReact` **不是集合差是次数差**（同 wave 102 的订正）：逐条量时间戳，桌面态两边都是 features ×2 / search ×2，**只有抽屉打开那一刻上游多发一轮**（+50ms 那一对）——上游抽屉挂载时重取、本仓走缓存，与 wave 128 的 `retry: 3` 同族，判据同样是「vue 有更好的可以保留」。**翻案判据**：哪天本仓需要「打开抽屉就刷新列表」，那要靠显式 invalidate，不是改回默认。                                                                                                                                                                                                                                                                                                                                 |
| ~~9~~  | ~~**新场景带出的 9 行**（`chat-thread-init-ordering`）~~ | **wave 180 全部结清**：三条「下一轮验」逐条查到根因并修掉（⑤焦点=w178、③兜底计时=w179、④⑧⑨ id 判断=w180），9 行→2 行，剩下两行是判过并留了翻案判据的 | wave 175 把这一屏接进取样面之后第一次照出来的，**不是这一轮改出来的**。逐条：**①②播报器那一对**（`ariaOnlyReact: - alert` / `ariaOnlyVue: - alert: New chat - DeerFlow`）——Next 的路由播报器认为标题没变就不播，Nuxt 每次路由变化都播。**框架管道差异，接受**。**翻案判据**：哪一边改掉播报器语义。 **③`text: Completed in <1s` 只在 React**——两边都有这条词条（`MessageList.vue:762` / `run-duration.tsx`），所以是**取到的运行时长有没有值**的差别，不是缺功能。**下一轮验**：查 Vue 在这一屏拿不到 duration 的原因（夹具没给，还是读的字段不同）。 **④⑧⑨`Edit and rerun` 那一组**（`ariaOnlyVue` 多一颗按钮 + `tabOrder` 第 16 个错位 + `tabbablesOnlyVue: button`）——三行同一个根：Vue 的人类消息在这一刻显示编辑键，React 不显示。两边都有这个功能，**条件不同**：React 多要求 `!replayActionBusy` 与 `canEdit`（`message-list.tsx:1025`）。**下一轮验**：哪一边是对的——首次提交后立刻能编辑那条消息，是该有还是不该有。 **⑤`focus: React=body Vue=textarea`**——提交之后 Vue 焦点留在输入框，React 掉到 `body`，键盘用户发完一条得重新 Tab 回去。**看起来 Vue 更好**，但**没验**：假设是 id 交接那一下 composer 重挂丢了焦点（与 wave 158 修的那处同族）。**下一轮验，别直接当结论。** **⑥⑦`POST threads/search` 各多一次**——与 wave 102 订正过的那一类同族（**次数差不是集合差**）。**接受**；**翻案判据**：哪天两边的列表刷新策略被明确对齐。 |
| 6      | **台账里那 42 行 ScrollArea 差异** | **判词仍然成立，但数字变了：现在是 47 行** | 2026-09-11 复核过：上游那条 `ScrollBar className="hidden"` 还在、两边的内层容器**都是 `flex-wrap`**（所以上游那个 ScrollArea 确实不会横向滚），原判有效。**它占了台账的四成**，读台账数字前先把它减掉。 原文如下：**wave 98 核完：接受**                       | 逐屏量过：`/workspace/chats`（会话列表页）两边**都**有一个 viewport，对得上；差异全部来自 `/workspace/chats/new` 那一屏——**上游的建议行套了一层 `ai-elements/suggestion` 的 `Suggestions`，而它就是一个 `ScrollArea`**。看它的实现：里面是 `flex w-full flex-wrap`（内容本来就换行）、外面那条横向 `ScrollBar` 还写着 `className="hidden"`——**这一层永远不会真的滚动**。本仓 `WelcomeSuggestionList.vue` 用的是一个普通的 `flex flex-wrap` 容器，**什么都没少**。**决定：不跟。** 补一层不产生滚动的 ScrollArea，只会多一个键盘停靠点（正是第 6 条上一轮刚修掉的那类噪声）。**翻案判据**：上游哪天把那条 `hidden` 去掉、让建议行真的横向滚动。                                                                                                                                                                                                                                                                                                        |
| 5      | **台账里那 7 行焦点差异**          | **⚠ 2026-09-11 部分推翻** | 其中「settings 深链的 4 行」那一半**已两边同改**（上游也接上了 `onOpenAutoFocus`）；「改动面板那 2 行」判为不跟（两边都没接管，是 Radix 与 reka 的默认落点不同）；而**当年没看出来的一条**是：重命名对话框关掉之后**两个应用都把焦点丢在 `body` 上**——那一直表现为幻影差异，2026-09-11 用 `visible: button:focus` 逼成稳定复现后两边同改。 原文如下：**已决定 / 已钉住**                          | wave 94 把「焦点」这一档接进取样面之后量出来的。**4 行**：settings 深链之后上游焦点落在导航第一项「账号」，而屏幕上显示的是另一个面板；本仓 `SettingsDialog.vue` 的 `focusInitial` 把焦点送到当前分区——**拿掉它之后本仓焦点会落到对话框背后的 composer textarea 上**，也就是模态开着而焦点在模态外面，所以那段代码挡的是真缺陷，**保留本仓这一侧**。**1 行**：mermaid 下载键的名字，是第 4 条那一类（译文）的重复。**2 行**：改动面板打开后的初始焦点（上游落在关闭键、本仓落在第一行文件）——**incidental，不是设计**（两边 `SheetContent` 的 DOM 顺序一致，本仓也没有显式焦点代码），最可能是文件列表到位的时机不同。**翻案判据**：这 2 行哪天翻过来，本身就是一个时序信号，值得去查。                                                                                                                                                                                                                                                               |
| 4      | **台账里那 42 行「上游写死英文」** | **⚠ 2026-09-11 已被推翻：改成两边同改** | 当年的判词是「保留本仓的翻译、不跟」。**错在没去看上游有没有能改的口子**：`streamdown` 自带 `translations` prop（上游从来没传）、浏览器面板与产物面板那几句是内联字面量（上游自己的词典里加一条就行）。那一轮全部两边同改；**真正跟不了的只剩 4 条**（`Zoom in` / `Zoom out` / `Reset zoom and pan` / `img "Mermaid chart"`——写死在 streamdown 产物里、不在 `StreamdownTranslations` 的 29 个 key 之内）。 原文如下（留作判据演进的对照）：**已决定：保留本仓的翻译**                   | wave 92 给 19 个只跑 en-US 的场景补上 zh-CN 之后量出来的，**同一类**：`browser-feature`（Back / Forward / 地址栏 placeholder /「Connecting to live browser…」/「Waiting for the first live frame.」）12 行、`thread-history-mermaid`（工具条六颗键 + 图片 alt）14 行、`artifact-stream-state`（`fileTypeLabel`）2 行。出处逐条查过：`browser-view-panel.tsx:401/462` 是**内联英文字面量**（词典里没有对应 key）；mermaid 工具条来自 **`streamdown` npm 包**，上游连改都改不了；`fileTypeLabel` 是本仓独有的 key。**判据是 fork-boundary 里那条已授权的例外「vue 有更好的可以保留」**——把 13 处译文改回英文，是在这个要留下来的应用上做一次用户可见的退化。**翻案判据**：上游哪天给这些字加了词典，或者 streamdown 支持了 i18n。                                                                                                                                                                                                                       |
| ~~3~~  | ~~**台账里那 2 行 tooltip 播报节点**~~ | **wave 157 判决关闭（够不着，且无用户可见后果）** | wave 91 接上悬停态之后量到：React 的可访问性树里多一个 `tooltip` 角色节点，本仓没有。根因在库里——Radix 的 `<VisuallyHidden role="tooltip">` **不**加 `aria-hidden`，而 reka-ui 2.10.1 的 `VisuallyHidden` 默认 `feature: "focusable"`，那一支会打 `aria-hidden="true"`（`node_modules/reka-ui/dist/VisuallyHidden/VisuallyHidden.js:28`），于是**专门给读屏器读的那个节点被摘出了树**。**两边的描述都还念得出来**（`aria-describedby` 的描述计算不受 aria-hidden 影响）。那个节点在 `TooltipContentImpl` 内部、不经过本仓的 slot，够不着。**翻案判据**：reka 改掉那个默认值，这两行自己就没了。 **wave 157 复核并结账**（reka **2.10.1**，逐行看了源码，不是凭记忆）：`node_modules/reka-ui/dist/Tooltip/TooltipContentImpl.js:134-139` 构造 `VisuallyHidden` 时**只传了 `id` 和 `role="tooltip"`，没有 `feature`**，于是吃 `VisuallyHidden.js` 的默认值 `"focusable"`，那一支无条件写 `aria-hidden="true"`。这个节点在 `TooltipContentImpl` 内部，**不经过任何本仓能传值的 slot**——「够不着」是结构性的，不是没找对地方。**为什么判关闭而不是继续挂着**：①**没有用户可见后果**——描述照样念得出来（accname 规范：被 `aria-describedby` 引用的节点参与名字/描述计算，**即使它 `aria-hidden`**）；②唯一的「修法」是在本仓侧手搓一个补偿节点，而那正是 **wave 148 刚从三处清掉的那一类**；③挂着不动的成本是每一轮都要重读它一遍。**翻案判据不变**：reka 哪天给这处传 `feature="none"` 或改掉默认值，这两行自己消失——那时**台账会先响**，不需要人记得。 |
| ~~2~~  | **覆盖率棘轮的 pending 1 条**      | **wave 175 结清：判据达成，场景已进 covered** | `chat-thread-init-ordering`。**判据未满足，`pending` 保留**（wave 101 连取 20 次：React 仍两个终态 15 B / 5 A，Vue 20/20 单一；不许改判据凑绿）。**wave 102 第一次逐行量出两个终态差哪几行**：只在 A 的是 `text: Completed in <1s Hello`、`button "Copy to clipboard"`、`alert: Loading... - DeerFlow`，只在 B 的是 `text: Completed in <1s`、`alert`——**两件产品层面的事（乐观消息还没去重、连带多一颗复制键）加一件框架层面的事（Next 的路由播报器）**。**请求集合两边完全相同**（此前记的「A 缺三条请求」是假的，差的只是重复次数 20 vs 23）。要接着追就盯 `Completed in <1s Hello` 这一行，别再盯 `Loading...`。全部读数与复现方法写在 `baseline/parity-scenario-coverage.json` 的 `$pendingReasons`。 **wave 158**：两处根因都从代码上修掉了（两边同改）——①「切会话就重置」的 effect 也会在这次发送自己的 id 交接时触发，把 `prevHumanMsgCountRef` 基线覆盖掉、吞掉边沿；②`Loading...` 盖掉已知标题，被 Next 的 assertive 播报器播出去且再不更正（WCAG 4.1.3）。读数：**react aria 终态 1 个 ×20（达标）、react requests 2 个（17/3 与 14/6 两跑，不达标）**，vue 两档都 1 个 ×20。两个请求终态只差**三条交接后的后续 GET**，是取样窗内的时序，不是集合差。**判据没放松、pending 保留**；整段理由与下一轮怎么接，写在 `baseline/parity-scenario-coverage.json` 的 `$pendingReasons`。 **wave 159（零代码改动）**：先订正 wave 158 自己写的话——那三条 GET **20/20 都发了**，差的是**发了几次**（各 2 次 vs 各 1 次，正好一整轮）；wave 158 拿 `diff` 看多重集，把「出现两次 vs 一次」读成了「缺一条」。根因是 **`onStart` 挂载即取** 与 **`onFinish` 刷缓存** 撞在一起：单轮样本 invalidate 落在取之后 **+7ms**（还在飞，被去重），双轮样本 **+16ms**（已落地，真重取）。**回放 Gateway 一次运行十几毫秒才会掷硬币；真实后端下第一轮必然先落地、必然被刷第二遍——生产里那一轮是稳定浪费的。**修法（推迟放行到运行结束）与它要带的四条失败路径写在 `$pendingReasons`，**这一轮判定风险大于收益、没做**。 **wave 175 收尾**：`requests` 那一档的根因不是竞态，是**重复**——`onStart` 把 history / token-usage / metadata 三个查询挂上就取，`onFinish` 又把同一批 key 失效一次；竞态只决定 React Query 有没有恰好去重（invalidate 落在第一次 fetch 之后 **+7ms 被去重、+16ms 真重取**）。修法：让这三个查询**等这一轮 run 结束再取**，用 SDK 维护的 `thread.isLoading`——报错 / 用户 stop / 正常结束**三条路走同一个翻转**，不用手搓标志去数失败路径（那正是前两轮否掉那个修法的理由）。两处：`chat-page.tsx` 两个查询、`hooks.ts` 的历史查询，都挪到 `useStream` 之后才拿得到那个信号（已确认中间没有别人用它们的结果）。**去掉的那一轮没有任何可观察效果**——两个终态的 `aria` 此前就逐字相同。**读数：连取 20 次 × 两轮，react/vue × aria/requests 四档全部单一终态**，判据一个字没改。场景已注册、棘轮 pending 清空（covered 24 → 25）。 |

---

## 二、已决定、不再复量的（有读数、有日期）

| 账                                                    | 决定                                         | 读数                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`retry: false` 与上游不一致**（**2026-09-12 是 18 行**，因为新开了 dark/mobile 两维，同一条账在更多维度上各投影一次）          | **wave 128 判完：保留本仓这一侧**            | 代码注释里原本写着「`retry: false` 与上游一致」——**假的**：上游是 `new QueryClient()`、没有 defaultOptions，吃 TanStack 默认的 `retry: 3`。台账在 `integrations#load-failed` 上量出来：同一次 500，**上游发 3 次请求、本仓 1 次**。判据是 fork-boundary 那条「vue 有更好的可以保留」——TanStack 默认重试**不分错误码**，而 thread history 的 404 意味着 thread 不存在，重试三次只是把跳回空聊天页推迟 3 秒。**翻案判据**：要按错误码分流时换成 `retry: (count, error) => …`，不是改回默认。                                                                                                                                                                                                                                                                                                                             |
| **分栏拖拽把手的点击区**（台账 2 行）                 | **wave 146 判完：保留本仓这一侧**            | `sidecar-chat` 那一屏第一次把 `[role=separator]` 挂成锚点（两个应用各恰好 1 个，盒模型逐字相同 1.0×800.0 @870,0）。伪元素那一档量出把手的点击区 **上游 `after:w-1` = 4px、本仓 16px**。1px 的可视分隔线配 4px 的抓取区非常难对准，本仓这一侧按 WCAG 2.5.8 的目标尺寸更好，按 fork-boundary 那条已授权的例外保留。**同一颗把手的其余各档全部一致**（含 `opacity` 两边都是 0.33——动手前我以为那是本仓独有的「悬停才显形」，探针一量不是）。**翻案判据**：上游放宽 `after:w-1`，或者决定两边同改补到 24px。                                                                                                                                                                                                                                                                                                               |
| **三处「只能变短」没有机器在守**                      | **wave 85 判完：一句补成门禁，两句改成实话** | `parity-diff.json` 能守——**只有 `make parity-accept` 一条路能让它变长**，现在 accept 时逐行比对、有新增就拒写（`PARITY_ACCEPT_GROW=1` 才放行；判据是集合包含不是行数）。`pending` 那两句守不了（手改文件 + 没有历史参照判不了单调性），改成实话：标出真正上门禁的四条，并写明「只能变短」是评审政策 + 真要机器守该用什么判据。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **wave 101 挂的「不会自愈的加载态」**                 | **wave 102 定性完毕：不是产品缺陷，账作废**  | wave 101 把那颗一直在的「Loading...」归到 `LoadMoreHistoryIndicator` 的 `isHistoryLoading`——**错的**。实测命中元素在 shadow root 里（`host=next-route-announcer`、`hostParent=body`、无 `button` 祖先、`document.querySelectorAll` 找不到它——Playwright 文本引擎穿开放 shadow root，`querySelectorAll` 不穿），是 **Next 自带的路由播报器**，1×1 裁剪、`aria-live="assertive"`，内容是上一拍的 `document.title`。**屏幕上没有任何东西在转。** mock 也不是嫌疑人（`messages/page` 永远 fulfill 200，不认识的线程返回 `data: []` + `has_more: false`）；请求也不是（三条在 A 里同样发了、+588ms 之前全部 200 回来，此后 60 秒网络上再无动静）。**不必再追。**                                                                                                                                                            |
| **artifact 头部长文件名的「18px 零头」**              | **wave 103 复量完：不算差异，账结清**        | **用户可见的部分两边逐字相同**：标题 `span` 文本 61 字、盒 `407/407` **被裁 0px**、`line-clamp:1`；`SelectTrigger` 两边都是 **455px 宽**（右边缘 1267 / 1266）；四颗动作键 `Open in new window / Copy / Download / Close` 位置只差 1px，**一颗都没越界**。**并订正 wave 82 的读数**：那条「上游 481/458、本仓 497/492」是拿**两个不同层级的盒子**在比——「从头部往上找第一个 `overflow-x:hidden` 祖先」在上游落到 `div.bg-background.flex.flex-col`（clientWidth **458**）、在本仓落到 `div.ml-auto.h-full.min-w-0`（clientWidth **492**），**两边 clientWidth 差 34px 本身就是「不是同一层」的证据**。所以「18px 零头」不是一个可比的量。本轮复量上游仍有 5px、本仓 0px，但那 5px 被 `overflow-hidden` 裁在右边缘之外，标题没被裁、动作键没越界，**没有任何用户可见后果**，按 fork-boundary 判据上游自己也不坏，不改。 |
| **验收判据「移走 frontend/ 还能跑」**                 | **wave 83 真跑了，已修并接上门禁**           | 实验第一次真做：BLOCKING 早已是 0，而 `make verify` **当场红**（`describe.skipIf` 跳过用例不跳过收集）。顺带量出第二条假话（`doc-references` 三条用例是 `return` 报绿不是跳过）。两条都修了，动态那一半现在是 `make standalone-sim`，进收工清单。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/showcase` 的请求层落差                              | **不放开**                                   | wave 27 / 28 / **81 三次逐条复量，一字不差**：react-only 四条（`features` / `skills` / `suggestions/config` / `threads/«generated»/uploads/limits`），vue-only 空，**aria 0/0**，落地 URL 相同。四条都打向需要鉴权的端点，而案例页是公开只读的。**翻案判据**：有没有哪个只读能力因为缺了这四条而在案例页上失灵。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 建 agent 页 chat step 的外壳                          | **保留本仓这一侧**                           | wave 81 复量，**比 wave 28 记的少一项**（wave 79 把保存搬进 ⋯ 菜单之后，触发器 React x=1232 / 本仓 1231）。剩下的是 header 本身：上游返回键 + `h1`，本仓侧栏触发器 + agent 名字 + 用量徽标。叠上游那个 header 会让这一屏有两个 header。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 欢迎区在树里的位置                                    | **保留**                                     | wave 34 复量：两边**定位完全一样**，只是 DOM 父节点不同。要对齐得给 ChatComposer 加 slot，**零可观察收益**。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Button` 的 as-child                                  | **不做**                                     | wave 37 量完、wave 58 订正理由。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| browser 面板的分叉                                    | **保留**                                     | 理由写在 `BrowserPanel.vue` 文件头。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 上游种子取数失败弹 toast                              | **本仓静默降级**                             | `BEHAVIOR_CONTRACTS.md` 的 S8 明写 403/404 属常态。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `agents.saveRequested` / `agentCreatedPendingRefresh` | **不补**                                     | 本仓 `useAgentCreationSession` 用 saving/verifying/created/error 四态 + 行内错误区表达同一件事，再加 toast 等于说两遍。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 建 agent 页那颗 `<Input>` 的可访问名                  | **照抄上游**（来自 placeholder）             | 「命名弱但存在」，按 wave 28 的判据不算缺陷。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ~~18~~ **15** 条 unused 词条（2026-09-11 实测）                                     | **逐条撞过上游**                             | wave 34 逐条撞，35 / 36 / 38 各做掉四 / 二 / 二条；剩下的分「上游自己也零消费」与「本仓有意不做」两类，逐条记在交接文档。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DropdownMenuContent` 的 `z-80`（上游 `z-50`）        | **保留**                                     | 本仓自己的一层 z-index 统一，不是漏抄。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 菜单项的 `hover:bg-accent`（上游只有 `focus:`）       | **保留**                                     | Reka 的菜单项悬停不触发 focus，而 Radix 给高亮项打的就是 focus；删掉鼠标悬停就没有反馈。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

## 三、这一轮（wave 78~128）清掉的

- **浮层层级也是一条正确、但没人守的规则**（wave 154）：`ARCHITECTURE.md:102`
  「所有 portal 浮层共用 `z-80`，只有 tooltip 用 `z-90`」——8 个 portal 组件逐一核对，
  一个漏写都没有，而守着它的机器是 0 台。这类缺陷**对照台账照不出来**：几何档量的是
  锚点自己的盒子、`hit` 只在中心取一次，两个应用各自内部一致时三档全 0。
  判据按**行为**收口（渲染了 reka `*Portal` 的组件），绕开 `ToggleGroupItem` 那两处
  非浮层的 `z-10`，因此零豁免；另配反向断言（`z-90` 只能是 tooltip）。
- **一条正确、但没人守的边界**（wave 153）：`ARCHITECTURE.md:84` 写着
  「`app/components/ui/` 是唯一的交互控件底座，建在 Reka UI 之上」——实测**当前是真的**
  （`ui/` 之外 0 处 import、`ui/` 之内 69 份），而**守着它的机器是 0 台**。
  一条正确但没人守的边界和一条错的边界只差一次改动：产品组件直接建在 reka 上，
  就绕开了这一层统一补的 `aria-modal`、z-index 分层与可访问名约定
  （wave 148 那三处就是同一件事的另一半入口）。判据零豁免，另配反向断言。
- **两份 README 记的门禁不是同一套**（wave 152）：中文版少 `audit`、`coverage`、
  **`standalone-sim`**——最后那个是**验收判据的动态那一半**（静态那半是 `standalone-check`），
  中文 README 那句话当时只写了静态的一半，照它走的人根本不会跑那个实验。三处一起补齐，
  并把 `doc-references` 里那条「两份 README 都要列出每一个套件」的判据**扩到全部 make 目标**
  （对称差为空，零豁免）——那条守卫的注释写的理由对非套件目标一字不差地成立。
- **⚠ wave 151 订正了下面这一条的措辞**：那句「全表 A–S 共 19 组」**本来就有机器在守**
  （`doc-facts` 数 `## X.` 标题再和句子比，实测加一组 `T` 它当场红）。真正没人守的是
  `invariant-ownership` **自己声称的两件事都只覆盖子集**——尤其 `条目 id 唯一`
  看不见 O–S 里的重复 id。改动仍然是对的，理由换一个。原文如下——
- **「全表 A–S 共 19 组」那句话的守卫只读到 14 组**（wave 150）：合同表实际
  **221 条 / 19 组**，守卫的正则 `/^[A-N]\d+$/` 只读 176 条 / 14 组，**O–S 五组共
  45 条从来没被读过**；而那条用例断言的 `组数 === 14` **恰恰因为 O–S 看不见才成立**。
  正则放宽到 `[A-Z]`，并把「14」换成**从文档那句话解析出区间与组数、与表里实际的组
  双向核对**（还要求从 A 连续）。副作用：`条目 id 唯一` 这才第一次覆盖到 O–S。
- **台账里认不出是谁的行清零**（wave 149）：`tabbablesOnly*` / `tabOrder` 三档 79 行里
  **59 行是裸 `div`/`span`**——查一条得单开探针，等于没有账。描述器给 generic 标签补
  `data-slot`（**只在认不出时补**：有 role 的本来就认得出，补了反而会凭空造差异——
  负向验证 N2 实测去掉这个条件后 30 行变 86 行，因为本仓 splitpanes 分隔条没有
  `data-slot` 而上游 `ResizableHandle` 有）。行数一格没动，认不出的行 59 → **0**。
- **手搓的模态语义全仓清零**（wave 148）：三处一起换成 primitive——移动端侧栏抽屉
  → `ui/sheet`、外链确认弹窗与 mermaid 全屏 → `ui/dialog`。根因是
  **`aria-modal` 只是声明、`aria-hidden` 才是事实**，手写那套缺的正是后者。
  台账 **233 → 202 行**。并配上零豁免守卫（模态三标志只许出现在 `app/components/ui/`），
  带自证用例与反向断言。
- **连带清掉的死物**（wave 148）：`app/lib/focusable.ts` 归零消费者（手写焦点陷阱是
  它唯一的生产消费者，而 `ARCHITECTURE.md` 写的「抽屉与 primitive 共用」里
  primitive 那一半本来就是假的）——模块 + 单测 + 三处引用一并删；
  `navigation.workspace` 词条随之死掉，也删了。
- **手机上够不着的会话动作按钮**（wave 147）：会话行的 ⋯ 少了上游 `SidebarMenuAction`
  的两条「只在 768px 以下生效」的类——`md:opacity-0` 被写成无条件 `opacity-0`
  （触摸没有 hover，那一整组会话动作在手机上根本显不出来），以及上游自己写了注释的
  `after:absolute after:-inset-2 md:after:hidden`（增大移动端点击区）。实测 375px：
  React `opacity=1` / 点击区 **28×36**，本仓 `opacity=0` / **20×20**（低于 WCAG 2.5.8
  的 24×24）。改后两个断点逐字一致。
- **终态可以自己钉断点**（wave 147）：`ParityState.dimensions?`，与 wave 128 的
  `routes?` 同一条理由（场景 id 受棘轮约束、编不出新的）。靠它把移动端抽屉挂进了
  取样面，**而已有的 89 个键内容一字未变**。
- **伪元素进取样面**（wave 146）：结清上一轮新挂的第 7 条。干净树 0 行、
  而那个 0 是算出来的（N2 当场让它报，其余七档零反应），另配形状断言防它烂掉。
- **分隔条的画法对齐**（wave 146）：本仓用 `border-left` 画那条 1px 线、上游用
  `bg-border`，计算样式上是一条差异、屏幕上分不出来。改成与上游同一种画法，
  台账那行消失，用户看到的东西一个像素没变。
- **Tabs 的 variant 体系搬过来**（wave 145）：结清 wave 144 挂的那笔。三处联动缺一不可
  （根的 `group/tabs`、`TabsList` 的 `tabsListVariants` + `data-variant`、
  `TabsTrigger` 的四段类串）；调用点传 `variant="line"`，创建键挪进上游那个
  `<header class="flex justify-between">`。台账 **219 → 197**，每语言 11 行归零。
- **基类守卫看不见 7 个最高频组件**（wave 145）：`STRING_LITERAL` 那条
  `(['"`])([^'"`]*)\1` 不许字面量里出现另外两种引号，而 `[&_svg:not([class*='size-'])]:size-4`
  是 shadcn 惯用写法——`CommandItem` / `DropdownMenuItem` / `DropdownMenuRadioItem` /
  `DropdownMenuSubTrigger` / `SelectItem` / `SelectTrigger` / `TabsTrigger`
  **一个都没进过比对集合**。改成三支分写后当场露出 4 处漂移。
  **HEAD 那份守卫对注入的真实差异 5/5 全绿**（负向验证 N4 证实）。
- **七个调用点的 `as="button"`**（wave 145）：上游菜单项是 `<div role=menuitem>`，
  本仓因为调用点传 `as="button"` 渲染成 `<button>`，而 **`<button>` 的 `width:auto`
  是 fit-content**，不撑满菜单——此前靠在 primitive 基类里写 `w-full text-left` 压住，
  **补偿写在了错的那一层**。七处全删、两条补偿一起删，「删除」项宽度 81.8 → 182。
- **模型清单改成打开对话框才取**（wave 136）：结清上一轮挂的 `GET /api/models`。
  改的是谓词（`enabled: featureEnabled && editing !== null`）**不是搬家**——这份工作区的
  服务端真相由页面/composable 这一层的 Query 持有，对话框只收 props。
  台账 157/85/93 → **155/85/93**（近几轮第一次**缩短**，accept 不需要 GROW）。
  **抓到自己的一次无效变异**：想拿 `e2e-agents` 当安全网、把谓词改成 `false` 再跑，
  **3 条全绿**——那条用例回画廊之前已经走过 agent 会话页，模型清单早进了 TanStack 缓存，
  **`enabled: false` 的查询照样读缓存**。所以「冷开画廊再打开对话框还取不取得到」
  **目前没有自动化守着**，下一轮用「画廊有数据 + 打开设置对话框」那个终态一并补上
- **agents 画廊页第一次进取样面**（wave 135，第⑦类）：拿 wave 134 的 `delayMs` 去开一整屏
  此前一行台账都没有的页面（`agents-feature-disabled` 加一个「feature 覆盖回开着 + `/api/agents`
  慢 15 秒」的终态；`settle` 改成空的，因为两个终态一个共有元素都没有）。量出四处：
  **新建入口样式手写的**（没图标、字号大一档、高度差 4px，`width Δ-22.6`）**已修**；
  **加载占位不是同一个东西**（上游是居中 h-40 盒子，本仓左上角一行字，`height Δ-136`）**已修**；
  **元素类型不同**（上游 `<Button onClick>` / 本仓 `<NuxtLink>`）**保留本仓**（4 行，
  理由：跳 URL 的控件业界主流是链接，中键新标签页/复制链接/读屏器念成链接上游都做不到；
  **翻案判据**上游上了 `Button asChild`）；**加载文案不是同一条**（本仓自有 key + `role="status"`）
  **保留本仓**（2 行）。**另挂 1 行账**：`requestsOnlyVue: GET /api/models`——上游打开对话框才取、
  本仓进页面就取，**上游那种更省**，改法要跨两个文件还得动单测，下一轮做。
  台账 141/83/91 → **157/85/93**
- **「还在转」那一档第一次进取样面**（wave 134）：给 `ParityRouteOverride` 加 `delayMs`
  （纯数据，等待在 `installRoutes` 的固定实现里；取 15s——比整条取样链长一个量级、
  又不吃满用例的 30s 预算）。`integrations#skills-loading` 第一跑 **12 行 / 语言**，
  与上一轮同一处根因，**外加一条新的**：本仓 `Loading...` 写在 `<p>` 里，
  可访问性树多一个 `paragraph` 节点，上游是 `<div>`。改完 **12 → 2 行 / 语言**，
  剩下的 2 行是既有 ScrollArea 类。**这一档 aria/几何/顺序/焦点/深度全部归零。**
  台账 137/81/89 → **141/83/91**。
  **并订正 wave 133 提交说明里引错的一条证据**：`settings-session-unavailable` 用的
  **不是**红色小字那一套（实测 `text-sm text-red-600` 9 处、
  `rounded-md bg-red-50 …text-red-700` 4 处、`text-red-500` 1 处，它在第二组）——
  **结论不变、例子举错了**
- **技能清单取不到时本仓还留着筛选标签与「创建技能」按钮**（wave 133）：
  `integrations#skills-load-failed`（技能页在上游没有 spec 文件，场景 id 编不出新的，
  按既定做法挂现成场景）。第一跑 **15 行 / 语言**，根因一处——上游把标签、创建键与清单
  **一起**放在 `SkillSettingsList` 里、error 那一支整个不渲染；本仓把它们放在状态分支外面。
  三处加 `!skills.error.value` 之后掉到 **8 行 / 语言**（同一棵树前后两跑，只差这处 `v-if`）。
  **有意留在台账里的每语言 6 行**：`role="alert"` vs 没有 role 的 `<div>`、
  上游硬编码 `Error: ` 前缀（中文界面也是英文）、以及三行几何（红色小字 vs 无样式）。
  **翻案判据**：上游给那个 `<div>` 加 role 或样式。另每语言 2 行是既有 ScrollArea 类
  （这个对话框现有 5 个终态上都有，wave 98 判过）。台账 121/79/87 → **137/81/89**
- **第⑥类第一次量到产品层面的分叉**（wave 132）：`artifact-batched-stream#preview-failed`
  （产物来自 artifacts 清单、正文必须去取，所以 500 才盖得住；`artifact-preview` 那份
  夹具 wave 130 已量过接不住）。8 行里 6 行是**已判过的 `retry: 3`** 第三次复现，
  **2 行是新的**：`order` 报出「第 51 个公共节点 React=- radio Vue=- radio [checked]」。
  探针直接量到 —— **预览失败时本仓选中「代码」、上游仍然选中「预览」**
  （Vue `#0 aria-checked=true`；React `#1 aria-checked=true`）。机制：上游
  `preview.ts:238` 的 `initialViewMode` **只由文件策略决定**，与正文取没取到无关；
  本仓 `reset()` 置回 `code`，只有成功路径才设成 `preview`。
  **决定：保留本仓这一侧**——上游那一档等于念「预览，已选中」而同屏写着「无法预览此文件」，
  自相矛盾；**不做两边同改**（没有功能后果，够不上「上游自己是坏的」）。
  **翻案判据**：上游把 `initialViewMode` 接到加载结果上，或这一屏出现「重试」入口。
  台账 113/77/85 → **121/79/87**
- **8 个「一个锚点匹配到多份」逐个核完**（wave 131）：**3 个是缺陷、5 个是正常的多份**。
  判据是「那几份是同一个东西的多份，还是不同的东西」。最后一处缺陷在
  `thread-list-infinite-scroll`：`text:Conversation 001` 的 `.first()` 落在**侧栏**
  （x=16 w=**112**）而不是**页面那张列表的行**（x=376 w=**784**），于是 settle 可能在
  页面列表还没画出来时就通过，几何档量的也是侧栏标签——**而这个场景叫「会话列表页的
  首屏分页」**。改成 `a:not([data-sidebar]):has-text("…")`。**决定性负向验证**：
  Vue 页面列表行改成显示 thread_id，**旧锚点 2 条全绿 exit 0**、新锚点两个维度全红。
  **台账 113/77/85 一行没动**——第三次「加覆盖面不加账」
- **同一类锚点缺陷的第二例，并把下一件活量到走不通**（wave 130）：
  `artifact-preview` 的 `text:report.html` **在 `click` 之前就已经满足**（消息卡的文字
  是整条路径，`getByText` 字符串是子串匹配），几何档那一行量的也是那张卡；
  `artifact-panel-resize` 点完之后**一个锚点都没有**，只靠 700ms 固定等待量分栏几何。
  两处都改成 `text:/^report\.html$/`（点击前 0 个、点击后 1 个，两个应用一致）。
  **决定性负向验证**：把 Vue 面板标题改成整条路径，**旧锚点集 5 条全绿（exit 0）**、
  新锚点集**三个维度全红**。**台账 113/77/85 一行没动**——加的是覆盖面不是账。
  **否定结论**：`artifact-preview#preview-failed` 用现有夹具走不通——那条产物是
  `write-file-artifact`，正文来自消息里的工具结果，**两个应用都不发
  `/api/threads/*/artifacts/**`**（探针：`/artifacts` 响应 0 条、iframe=1、previewFailed=0）。
  要接得先造一份「产物来自 artifacts 列表」的夹具；**判据本身没错，错的是夹具**
- **两句当规则用的话被实测推翻**（wave 129）：①`scheduled-tasks` 场景注释说两个
  schedule input 锚点钉住的是**编辑表单**——实际那两个 testid 在**创建表单**里也各有
  一份（探针实测两个应用都匹配 **2** 个），`.first()` 永远落在创建表单上，
  几何档那两行量的也是它。**决定性负向验证**：删掉 Vue 编辑表单里的整块 schedule
  input，**旧锚点集 4 条全绿**、新锚点集（`>> nth=1`）**当场 2 红**。
  ②wave 128 自己写的判据「那条 key 上游词典里也有」在 `artifacts.loadFailed` 上给出
  相反结论——上游那一支**是有的**（`ArtifactPreviewError`），只是用了另一个 key
  `artifactPreview.previewFailed`（两边词典都有）。**正确判据：grep 渲染点，不是词典。**
  同轮接上 `scheduled-tasks#load-failed`，台账 107/75/83 → **113/77/85**
- **第⑥类第一次进取样面**（wave 128）：给 `ParityState` 加 `routes`，同一条场景可以
  同时取「正常」与「失败」两个终态（不动棘轮的场景 id）。第一跑就量出
  **上游对同一次 500 发 3 次请求、本仓 1 次**——顺着查到代码注释里
  「`retry: false` 与上游一致」**是假话**。台账 95/73/81 → **107/75/83**
- **第⑤类（primitive 默认值）量完了，判定不做**（wave 127，代码改动为零）：
  按 `data-slot` 比语义属性，73 个样本 **2519 行**，**只在一边出现的 slot 名就有 62 个**
  ——两套 primitive 的词汇表本来就不同（splitpanes vs react-resizable-panels 是早就
  决定的分叉）。做成常驻等于往台账灌 2500 行「已决定」。**翻案判据**：两边词汇表收敛时再量
- **上一轮的产出立刻违反了那份文件自己的规矩**（wave 126）：`aria-parity.mjs` 的头
  写着「两份各自维护的归一化迟早会分叉」，而 wave 125 加 `normalizeAriaTree` 时
  **在同一个文件里抄了第二份**。抽成一份共享规则 + 一条**同源用例**
  （行归一化的每一行 `trimStart()` 必须等于树归一化的 `body`），负向验证两条都对
- **「深度」做成常驻的一档，第④类真正补完**（wave 125）：wave 99 撤它是因为量的是
  **被塌平**的数据。负向验证是决定性的——把 wave 124 的修复退回去，
  **只有 depth 这一档响、其余各档一行没动**，正是 wave 99 自己立的判据要的证据。
  基线 73 个样本各加 `depth: []`，**总行数仍是 95**
- **划词工具条渲染在 `role="log"` 这个 live region 里面**（wave 124）：上游把它写在
  `</Conversation>` 之后，本仓的模板根**就是**那个 log div、工具条是它最后一个子节点。
  **后果不是排版**——live region 里插入的内容会被读屏器当日志播报，而它是一条
  随选区出现/消失的浮动工具条。挪出去之后**深度差异 6 → 0**，台账一行没动、
  视觉基线一张没重录。**wave 123 猜的「多一层 generic 容器」是错的**
- **wave 99 那个「层级差异 0 行」被推翻**（wave 123，代码改动为零）：在**保住缩进**的
  数据上重做，**量到 6 行**（划词工具条三颗按钮 × 两种语言）。那个 0 是数据被塌平
  造成的。**已挂成第 7 条账**，下一步是把多出来的那一层 generic 容器揪出来
- **那条没有注释的归一化规则，抹掉的是整棵树的层级**（wave 122）：
  `normalizeAriaSnapshot` 里 `\s{2,}` 命中 **6698 / 7692 行（87%）**，而**有注释的
  那四条一次都没响过**。它塌掉的是**每一层缩进**——深度 1/2/3 全变成一个前导空格。
  保留（下游本来就要去缩进，台账一行没动），但**代价写下来了**：
  **任何层级维度都无法从归一化后的快照恢复**，**wave 99 那条归因就地存疑**
- **那张丢弃查询参数的表一条都没响过**（wave 121）：探针实测**116 次观测、
  `DROPPED` 0 次**（控制组打印出实际参数，证明那个 0 是算出来的）。
  取舍写清了：留着 = 产品用 `t`/`ts` 时**静默丢掉**差异；删掉 = 真出现破缓存参数时
  台账**变得不稳定**——**一个会喊的失效优于一个不出声的**，所以删
- **三个夹具 id 没登记进 `KNOWN_IDS`，请求归一把它们抹成了 `«generated»`**（wave 120）：
  `normalizeRequest` 那条规则本是为了吃掉客户端随机 id，对夹具 id 一样有效——
  **两个应用请求了不同的夹具线程，归一之后差异会消失**。当时没造成假绿是运气。
  补进去 + 双向守卫；**归一化改了而台账一行没动**，正好证明此前没抹掉过真差异
- **`standalone-check` 的正则要求带斜杠，安装期的写法一个都看不见**（wave 119）：
  `"file:../frontend"` / workspace 的 `- "../frontend"` 都是 **BLOCKING 0**，
  同一条加个斜杠就是 1。放宽主正则会多出 26 行假命中（Makefile 的 `@echo` 就有 9 行），
  所以收窄到「安装期清单」这一类没有散文的文件。
  **判据四步（install / build / test / e2e）到此第一次四格都有着落**
- **判据里 e2e 那一半从没验过**（wave 118）：`--with-e2e` 此前**只跑 `e2e-parity`**，
  而那是唯一一个兄弟应用不在时**整组跳过**的套件。第一次真跑：把 `frontend/` 移开后
  `e2e-mock` 265+22+15+2+6、`e2e-backend` 2+5+2+3+3+5+1+1，**两组都绿**。
  开关现在把它们带上（17 / 4 / 0，十分钟量级）。
  **四步里只剩 `install` 没人碰过**
- **「要不要让 standalone-sim 连 build 一起跑」答完了：不加**（wave 117）——
  构造一处「构建期才生效、静态扫描看不见」的依赖（`nuxt.config.ts` 运行时拼路径），
  **静态扫描 BLOCKING 0，而 test 那一步当场红**（nuxt 的 vitest project 会加载它）。
  只有 build 才看得见的那一类要同时满足三条苛刻条件，举不出像样的例子就别加。
  顺带修掉整套起不来时「把责任推给表里那几份文件」的误导输出
- **`standalone-sim` 只跑表里那 8 份文件，而判据说的是「整套」**（wave 116）：
  实测——写一份没人登记、运行时拼路径读兄弟应用的测试，
  **HEAD 的 sim 报「跑过 13 条 / 红 0」exit 0**，改动后「整套红了」exit 1。
  这正是 wave 83 撞到的形状，当时补了表却没改「只跑表里的」这条结构
- **拿旋钮把整张抖动名单量了一遍**（wave 115，代码改动为零）：#2 ×8 / #3 ×15 /
  #4 ×6 / #5 ×8，负载 20~115，**37 次一次没红**；而同一旋钮在 wave 113 修之前的
  #6 上 10 次红 1 次。**旋钮有效，这四条就是复现不出来**——它们现在的地位是
  「一次历史观察」，下次再红就是**新信息**
- **比 CPU 节流更好的复现旋钮**（wave 114，代码改动为零）：八个自限时的 CPU 忙循环
  把整台机器压住。**节流做不到的事它做到了**——把那份 spec 退回 wave 113 之前，
  load ~13 时 `--repeat-each=10` 是 **1 失败 / 9 通过**；修好之后 load 20→107 是 **10/10**。
  同形的另外两处（`mode-hover-guide`、`sidebar`）在同一旋钮下 **56/56 全绿**，
  所以 wave 113 那句「先不动」现在是**量过的结论**
- **已知抖动第六条查清并修掉，名单七条 → 六条**（wave 113）：探针实测
  tooltip 是**延时开**的（安静时也要约 600ms 持续悬停），而按钮**没有移动**、
  命中测试干净——**一次 `hover()` 赌不到**：那 600ms 里消息列表重渲一次，
  旧 trigger 卸载、计时器没了，鼠标又没再动，`pointerenter` 就永远不来。
  改成 `toPass` 里重新 hover。**同一复现条件下 3/10 → 10/10**，断言一个字没松
- **`upstream-drift` 会打一句假的「无漂移」**（wave 112）：`git log -- <不存在的路径>`
  **不报错、只返回空**，于是上游改个目录名，这份报告照样说「无漂移」——而这句话
  在交接文档里是**被当证据引用**的。实测 HEAD 的脚本 exit 0 且打印「无漂移」。
  同形的另外三张（i18n 扫描面的根与入口、`SUITE_INFRASTRUCTURE`、`SKIPPED_PREFIXES`）
  一起补上。**至此 `tests/guards/` 与 `scripts/` 里「指向外部东西」的表都双向了**
- **收工清单上「icon-parity 不报 stale」这句是假的**（wave 111）：`VERIFIED` 的
  stale 检查自 wave 87 起一直在报三条（`FileMinus`/`FilePlus`/`FilePenLine`，
  wave 87 重做改动面板之后两边都用了），而它只 `console.log`、不影响退出码——
  **本会话 wave 106/109/110 三份日志里那一行都在，而我三次都记成「不报 stale」**。
  三条过期豁免删掉；`EXEMPT` 也补成双向（第一跑就抓到已经不存在的 `magicui`）；
  stale 现在让 exit 1。顺带把 `e2e-suite-contract` 的 `standalone` 补上反方向
- **独立性判据自己身上的两处「登记了就不再检查」**（wave 110）：
  `kind: "data"` 此前**无条件 `ok: true`**——把一份 `.ts` 标成 data，
  改动前的 `standalone-sim` 报「跑过 13 / 未跑 6 / **红 0**」，
  它就此永远不会被这个实验跑到；`CROSS_APP_BY_DESIGN` 还是**单向**的
  ——一条不再引用 `../frontend` 的登记不产生 hit，既不在 BLOCKING 也不在 DECLARED，
  **报表一切正常**。两处都补上，四条负向验证里两条是「HEAD 绿、新版红」
- **最后 7 处写死的 5s 断言预算**（wave 109）：全仓显式超时是 15s×164 / 10s×40 /
  20s×28 / 5s×7——**5s 是离群值**，逐条读那 7 处**没有一处在断言「必须多快完成」**，
  只是旧默认值的回声，把断言永久钉在旧预算上。已全部改为继承默认。
  **有意不做成门禁**：短超时不是一律不许写（`capture.ts` 的 2s 是有意的），
  判据是「这个数字在断言一件事还是抄了默认值」，机器分不出来（线索 180）
- **订正 wave 108 的推断**（wave 109）：那句「第三/五/六条按症状同形推断」**不成立**
  ——#5 在 60x、#6 在 70x 节流下都还是绿的；节流只模拟「页面脚本慢」，
  模拟不了「服务端也慢 / 进程被抢占」。**那个旋钮有适用域。**
- **「负载抖动」第一次可以按需复现**（wave 108）：CDP 的
  `Emulation.setCPUThrottlingRate` 当旋钮，实测第四条抖动在 30x 节流下第一条断言
  用掉 **3832 / 5000ms**（77%）、50x 直接超时——**机制是 Playwright 默认的 5s
  expect 预算**（用例本身有 30s，二十几秒没人用），不是「断言钉错对象」。
  预算提到 10s；**只有第四条被复现验证过**，其余按症状同形推断，如实记
- **后端枚举的镜像 + 一处静默跳过**（wave 107）：`DEERFLOW_DURABLE_STATUS` 的
  「Gateway 的 durable run status 全集」现在与后端 `RunStatus` 逐个比
  （`tests/guards/backend-enum-mirror.test.ts`）；`doc-facts` 的
  `try { read("../backend/…") } catch { return }` **把「后端不在」与「文件被挪走」
  压成了一件事**——实测把那份文件挪走，HEAD 的守卫 11 条全绿。抽成
  `scripts/lib/backend-source.mjs` 之后两者分开。`DEERFLOW_WIRE_EVENTS`
  **量完判定不做**（后端没有枚举，做成门禁会误报），读数写进文件头
- **一条 e2e 断言钉错了对象**（wave 107）：`auth-contract.spec.ts` 的 `next` 落点是
  一个夹具里不存在的**线程路由**，工作区立刻把它换掉——`expect.poll` 采样快就绿、
  机器忙就红。探针量出 URL 轨迹后换成停得住的落点，**已知抖动名单没有变长**
- **五处「一张表把全集切成两半、另一半没人查」**（wave 106，判据来自 wave 105）：
  agent-core 的文档枚举**五句里只有一句是双向钉着的**（两句只查一半、两句没人钉，
  取样面现在从文档算出来、与登记表恰好一一对应）；`file-header-claims` 自己的头
  还写着 wave 105 已经推翻的「`tests/` 有意不在范围里」；settings 的分区表与联合
  类型两处各写一份（改成从表推类型，分叉不可能存在）；`gen-contract-constants.mjs`
  的「唯一阻断的一层」只对点名的三份契约成立（补 `CONSUMED`/`NOT_CONSUMED` 恰好划分）；
  **活违规一处**——`app/core/threads/utils.ts` 头里写「等 8 个」实际 9 个，
  从 `84108b5f`（2026-08-31）烂到现在，9 份写数量的文件里就它错
- **一句当规则用的话被实测推翻**（wave 106）：`settings-query.ts` 头里的
  「顺序天然测不出来——只能靠人盯着两边看」**自 wave 95 起就不成立**。
  把 `channels` 与 `memory` 对调，`make e2e-parity` 当场红，`order` 档报出 8 行
- **台账 16 → 0**（wave 78，五处根因：页脚两组 / 菜单 align+side / 模式项多传的 `py-2` / `ui/command` 的 class 合同 / artifact 头部三栏 / sidecar 页脚的 `pt-3`）
- **守卫注释里点名的两笔**（wave 79：保存 agent 键的位置与形状、MessageList 的 artifactTargets 文件名键）
- **一条红了七轮没人知道的 e2e**（wave 80：`hasText` 传 RegExp 不做空白归一；并把 `e2e-backend` 写进收工清单）
- **两笔「先复量再决定」的账**（wave 81，两条结论都不变，都已标注「不必再复量」）
- **长文件名把整排动作键推出可视区**（wave 82，**两边同改**，上游比本仓还差 18px）
- **验收判据本身**（wave 83：第一次真做实验，17 条声明里 **2 条是假的**；
  修完并做成 `make standalone-sim`，每次都真移走跑一遍）
- **两处 drag 助手里 `hover()` 与 `boundingBox()` 之间的观测缝**（wave 83，
  按空了整个拖拽却报「面板没关」；**没有证据说它就是那一次 e2e 红的原因**，
  补的是无条件正确的一条）
- **三条扫描器盖不全自己声称的范围**（wave 84）：`.vue` 的白名单外能溜进
  带硬编码英文的 SFC 而四道门禁全绿；三处 `git ls-files` 看不见未提交的文件；
  剥注释的正则不认字符串，`"/workspace/**"` 一口吃掉 1886 个字符
  （对「数 import」那一半是**静默放过**）
- **「只能变短」那三句话**（wave 85）：`parity-accept` 从「无条件覆盖」变成
  「有新增行就拒写」；另两句守不了的改成实话，并写清真要机器守该用什么判据
- **三处交互态第一次进取样面**（wave 86）：会话行的 ⋯ 菜单量出 7 处（三处根因）、
  侧栏 nav 菜单量出 9 行（少一个 group + 上游的 `menu > link > menuitem` 嵌套，
  **两边同改**）；定时任务的编辑表单 **0 差异**
- **命中测试进取样面**（wave 100）：**过了 wave 99 立的那道门槛**——
  一颗按钮可以名字对、位置对、能 tab 到**却点不动**，那是现有各档都答不了的问题。
  收窄成「只量用户要去点的东西」（第一版三行差异全部来自 `text:` 锚点，
  是「盒子中心恰好压在别的东西下面」，不是差异）。**0 行，而那个 0 是算出来的**：
  给一颗按钮加 `pointer-events: none`，只有这一档响
- **「层级」那一档：做完、量完、撤掉**（wave 99，**代码改动为零**）：
  73 个样本 0 行，而按坑 249 去验那个 0 才发现**它几乎永远不会响**——
  序列化的树里「换爹」必然「换位置」，`order` 那一档先撞上（实测把一项挪出
  `DropdownMenuGroup`：层级档一行没有、order 档当场报出来）。
  **一个几乎永远不会响的字段比没有更糟**，整档撤掉不留残余。
  **第④类到此结束，下一轮别再做第三次。**
- **一条记了很久、而且是规则依据的事实被订正**（wave 98）：记忆里写着
  「React 里零消费者的死代码（`ai-elements/*`、`ui/carousel`）……**禁止移植**」，
  实测 **28 份里有 14 份是活的**（`prompt-input` 8 处外部引用、`conversation` 4 处…），
  真正零消费者的是另外 14 份。已在 `deerflow-vue-alignment-scope` 里逐份列出并附量法
- **ScrollArea 那 42 行核完**（wave 98）：差异全部来自上游给建议行套的那层
  `Suggestions`——**它永远不会真的滚动**（内容 `flex-wrap`、横向滚动条写着 `hidden`），
  **决定不跟**
- **tab 序量出的四处逐条结清**（wave 97）：**关着的分隔条占着一个 Tab 停靠点**
  （`opacity:0 + pointer-events:none` 却仍是 `tabindex="0"`，WCAG 2.4.7，48 行清零）；
  browser 面板 `section` → `div`（没有可访问名的 section 不是地标，4 行清零）；
  菜单 roving tabindex 那 2 行**接受**；滚动区那一处**两边同改**（上游 viewport 补
  `tabIndex={0}`）——并如实交代它换来了第 6 条那处新的结构差异
- **tab 序进取样面**（wave 96）：aria 树看得见节点、看不见「能不能 tab 到」；
  尺子先量自己——第一版 114 行里 **~48 行是别的档已经报过的**（译文那一类的重复 +
  空白文本节点造成的名字差异），收窄描述后 64 行、四处根因全部归因到具体元素
- **一处会让 `make verify` 随机红的泄漏**（wave 96 的 `a165c96c`）：
  DOM 用例把 rAF stub 成 `setTimeout`，`unstubAllGlobals()` 不清已排队的定时器，
  于是「用例全绿、退出码却是 1」，三次只红一次
- **顺序进取样面，并当场修掉它抓到的那一处**（wave 95）：`diffAriaOrder`
  先取公共多重集再比相对顺序（所以「多包一层容器」不误报），
  **第一跑就抓到 `DropdownMenuSubContent` 多包了一层 Portal**——上游 shadcn
  只给 `DropdownMenuContent` 包，本仓照着兄弟抄错了，于是子菜单两项在可访问性树里
  与打开它的触发器**被拆开**。修完新档 **0 行**。
  顺带如实记一笔：本来要做的「复验文件头『做不到』的结论」**这个类比文档说的小得多**，
  10 处里多数是过去式的历史说明，下一轮别再照文档追它
- **焦点进取样面**（wave 94）：交接文档里 wave 28 就记下的「天生看不见的第八类」，
  此前只能靠临时 probe 量；做成 `DiffEntry.focus` 之后一次量出 7 行，
  其中最值钱的一条是**本仓 settings 的 `focusInitial` 挡住了「焦点留在模态外面」**。
  尺子自己先量了一遍：第一版 17 行里 **10 行是描述器造的噪声**
- **mermaid 下载菜单进取样面，方向 A 的清单清空**（wave 93）：菜单本身 0 差异，
  而且**那个 0 是算出来的**（多加一项 `JPG` 当场报一行）；顺带查明冷启动表上最后一条
  「chat 的 composer 菜单」**是过期的**——四个能展开的控件都已挂在别的场景上
- **19 个只跑英文的场景全部补上 zh-CN**（wave 92）：坑 244 系统扫完，21 处锚点
  改成跨语言正则（zh 文案全部从词典反查、不是猜的），量出一整类「上游写死英文」；
  方法上留下一条：**批量加维度先拿可达性层探路**（10 → 7 → 3 → 0）
- **几何档加 `opacity`、步骤档加 `hover`**（wave 91）：两处此前**三档同时看不见**
  的盲区（`opacity: 0` 的元素照样在 aria 树里、照样有位置与色板）；
  `branch-thread` 接上悬停态并**补上 zh-CN 维度**，一次量出 17 行，
  清到 2 行（真差异：两个应用的分支键在中文下取了不同的词典键）
- **channels 的连接对话框进取样面**（wave 90）：新建与编辑**两条互斥分支**各一个
  终态，四个新样本三档全 0；触发器的坐标是**夹具给的 `display_name`**
  （不进词典、两种语言逐字相同），这一处此前挂在「两边没有共用 testid」上
- **「选中态只靠换色」从散文变成守卫**（wave 89）：判据收得住口（`<Button>` +
  条件 `default`/`outline`，**零豁免**），扫出并清掉两边各 12 颗；
  另加一条 DOM 用例守「值跟着状态走」——静态守卫对 `:aria-pressed="false"` 照样绿
- **integrations 的两个交互态第一次进取样面**（wave 88）：权限面板的选中态
  （域 + 自定义 scope，连接键改写成「申请新权限」）与「切换飞书 Bot」的整块表单，
  三档全 0；量的过程中撞出**两个应用都缺 `aria-pressed`**（22 颗域按钮 + 2 颗品牌
  按钮，选中只靠换色），**两边同改**
- **wave 87 漏改的一份折叠断言**（wave 88 的 `55678738`）：`e2e-shell` 红了一轮，
  干净树上照样红——那一轮的收工清单里没有 `e2e-backend`
- **对照场景多了一条 `states` 轴**（wave 87）：一个场景可以有多个**互斥**终态，
  于是改动面板那一整块第一次进取样面，量出 7 处（Sheet 头部结构 / `<details>` 不是
  `Collapsible` / 少了增删数 / 链接的 `aria-label` 污染外层按钮名），全清

---

## 四、收工时的门禁读数（wave 129 逐条实跑，**2026-09-09 之前的快照，数字已过期**）

> 当前读数在 `docs/plans/vue-parity-cold-start.md` 的门禁块里（2026-09-12 实测）。

```
verify           exit 0    265 文件 / 2205 单测；词典 942 key / 18 unused
                           产品 SFC 218（总 220）
standalone-sim   exit 0    跑过 14 / 未跑 5（4 data + 1 e2e）/ 红 0      ← wave 83 新增
                           wave 116 起 test 那一步跑**整套** vitest（此前只跑表里的 8 份）
                           --with-e2e 实测 13 / 4 / 0（那一条：exit 0，47 条跳过）
e2e-parity       95        台账 187 行 / 87 样本（wave 128/129/132/133 各一个失败终态，wave 134 加一个「加载中」终态）
e2e-mock         265 + 22 + 15 + 2 + 6
e2e-backend      2 + 5 + 2 + 3 + 3 + 5 + 1 + 1      ← wave 88 修完 e2e-shell 之后才又全绿
e2e-visual       8         wave 88 一张没重录
asset-budget     exit 0
e2e-external     3         **不在任何聚合入口、也不在收工清单**；wave 107 顺带跑了一次，绿
icon-parity      0 处待核、**0 条 ⚠**（wave 111 起过期豁免会让它 exit 1；
                 **这一行在那之前是假的**，stale 自 wave 87 起一直在报三条）
audit            预期红 14（分诊写在 Makefile 的 audit 上方）
standalone-check BLOCKING 0 处 / 0 个文件（DECLARED 40 处 / 18 个文件）
                 ——**只是静态证明**；「移走还能跑」由 standalone-sim 管
覆盖率棘轮       covered 24 + pending 1 + exempt 2 = 27 = React spec 总数（坐标系已用尽）
React 侧         check 0 / test 1034 / test:e2e 146（wave 97 三条全真跑过）
```

---

## 五、之后要找活，只能从这三个方向选

`app/pages/` 下的路由一条不剩地量过了，台账清零，`icon-parity` 归零，
守卫注释里点名的账也清完了，覆盖率棘轮的坐标系用尽了。

1. **给取样面加交互态**（台账看不见的第①⑦类）。判据：一个域收工前，把它所有
   「点一下才出现」的东西列出来，逐个问「这一屏进过取样面没有」。
   wave 76 量出 27 处、**wave 86 又量出 16 行**（两个菜单），这条一直有货。
   **挂展开态很便宜**：场景 id 受棘轮约束，夹具与 steps 不受。
   **锚点要在这个场景的每一个维度上都成立**（语言维度最容易漏），
   而且别照着词典 key 猜——先量一遍它有没有被渲染。
   **这张表 wave 93 起是空的。** `integrations`（wave 88）、`channels`（wave 90）、
   `branch-thread`（wave 91）、`thread-history-mermaid` 的下载菜单（wave 93）都做掉了；
   最后一条「`chat` 的 composer 菜单」查明**是过期的**——四个能展开的控件都已经在
   取样面里，只是挂在别的场景上（斜杠建议→`sidebar` 的 fill；模型选择器→`agent-chat`；
   模式菜单→`user-message-plain-text` + `ui-polish-mobile`；推理强度→
   `workspace-changes#reasoning-menu`），剩下的 `addAttachments` 是操作系统文件对话框，
   取样够不着。**下一轮找活不要再看这条方向了。**
   **两条通用办法**：① 两边没有共用 testid 时，先去**夹具**里找字符串
   （不进词典、两种语言逐字相同，两个应用拿到同一份，线索 242）；
   ② **给场景补一个语言维度比加一个场景便宜得多，而且不动棘轮**——
   wave 91 就是这么撞出「两个应用在中文下取了不同词典键」的（线索 244）。
   **wave 92 已经把这一条扫完了**：24 个场景现在都跑两种语言，这条路走到头了。
   **wave 87 起可以用 `states` 挂互斥的终态**，不必再二选一。
2. **给现成的尺子加一档**（wave 75 的 `icon-parity`、wave 76 的几何锚点都是这么来的）。
   注意坑 213 / 186：**一把新尺子最先要量的是它自己**——wave 75 那批线索有近一半
   是扫描范围造出来的。

> **方向 B 的存量到 wave 100 基本见底**：`opacity`（91）、`focus`（94）、`order`（95）、
> tab 序（96）、命中测试（100）都补完了——最后这一档同时覆盖了
> `pointer-events` 与「被别的东西盖住」（z-index 的实际后果）；
> **层级那一半 wave 99 量完判定不必做**。
> 再想加档，先按坑 258 问一句：**有没有一种变异能让它响、而现有的档都不响？**

3. **把散文里的断言变成守卫**（**注意：wave 95 量过「文件头里『做不到』的结论」
   这一条，货很少**——10 处里多数是过去式的历史说明，别再照旧文档去追）
   （`tests/guards/` 下已有十条 + wave 83 加进
   `tooling-contracts` 的一组）。加之前先读它们的覆盖面。
   **wave 89 又证明一次**：把 wave 88 的线索 238 做成守卫，当场扫出两边各 12 颗。
   **判据再加一条**：一条规则值不值得做成守卫，先看它**要不要豁免表**——
   要，多半是判据没选对。
   **wave 83/84 连着证明这条最值钱**：83 是一张零消费者的表 17 条里 2 条假；
   84 是三条扫描器盖不全自己声称的范围。**判据两条**：
   「哪一行代码读它」，以及「这把尺子能不能自证盖全」。
   **已经量过、不必再查的**：`tests/guards/` 下各豁免表都已双向守着
   （stale 检查 + 精确颗数 + 字典序）；9 份单测里扫 `.vue` 的正则剥法今天
   一处都没错（219 份逐个比对）。
   **wave 105/106 又连着证明两次**，判据现在是四条，第四条最好用：
   **一张表把全集切成两半，而另一半的处理方式是「不检查」吗？**
   wave 106 用它扫 `app/` 与 `packages/`，五处全中，**其中一处有活违规**。
   **配套的一条**：同一个形状**可以不长成一张表**——`gen-contract-constants.mjs`
   那处是三个 `readContract("…")` 调用点，只 grep 常量声明会漏掉。
   **还没筛的同形目标**：`app/` 里以**后端**为全集的两张表
   （`DEERFLOW_DURABLE_STATUS` / `DEERFLOW_WIRE_EVENTS`，头里都写着「全集」，
   实测当前都对，但补守卫要把 `backend/` 拉进 `make verify` 的读取面，代价先想清楚）。
   **已筛过、不是缺口的**（别重筛）：`shared/showcase.ts` 三张表（已双向）、
   `config/routes.ts` 的 `csrRoutes`（不声称覆盖全集）、
   `SUPPORTED_RUN_STREAM_MODES`（白名单本来就更大）、
   `SECTION_ICONS` 与 i18n `settings.sections`（tsc 双向管住）、
   各种扩展名/协议 allowlist（全集无限）。

> **这条尾巴没有自然终点。** 历史命中率：wave 100 补上最后一档（并证明了它响）、
> wave 99 撤掉一档不该要的、wave 98 订正一条当规则用的错事实、
> wave 97 结清 tab 序那四处、
> 修掉一处「看不见却占着 Tab 停靠点」的真缺陷、
> wave 96 把 tab 序接上、量出四处此前
> 任何一档都看不见的差异，外加一处会让 verify 随机红的泄漏、
> wave 95 把第④类的顺序那一半补上、
> 第一跑就抓到一处 primitive 抄错、修完新档 0 行、
> wave 94 把挂了 66 轮的「第八类」补上、
> 一次量出 7 行（其中一条证明了本仓一段代码挡的是真缺陷）、
> wave 93 把方向 A 的清单清空
> （最后一处 0 差异，而且证明了那个 0 是算出来的）、
> wave 92 把「语言维度」这条路一次扫完、
> 量出一整类 28 行的已决定差异、wave 91 给尺子加两档、一次量出 17 行
> （其中一条真差异藏在一个**从来没取过的语言维度**里）、
> wave 90 把挂了好几轮的 `channels` 对话框
> 接上（四个新样本 0 差异，值在于**这一块从此永久有覆盖**）、
> wave 89 把上一轮的线索做成守卫、当场又捞出两边各 12 颗、
> wave 88 捞出**一处两个应用都有、而对照天生看不见**的缺陷
> （外加一条红了一轮的用例）、wave 87 捞出 7 行、
> wave 86 捞出 16 行、wave 75 捞出 6 处真差异、wave 76 捞出 27 处、
> wave 82 捞出一个**两个应用都存在**的产品缺陷、wave 83 证伪了**验收判据自己**、
> wave 84 捞出三条「扫描器盖不全自己声称的范围」、wave 85 把一条只靠人记得的
> 闸门变成了机器守的、wave 86 一次接上三处交互态就量出 16 行、
> wave 87 给尺子加一条轴又量出 7 行。**什么时候收，是个停止规则问题，
> 不是一个能算出来的轮数。**
