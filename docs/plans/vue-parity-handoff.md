# React → Vue 对照对齐：轮次交接文档

**这份文档是每一轮开工的第一读物。** 它记录「上一轮做完了什么、下一轮做什么、
有哪些账挂着」。深度背景（踩坑线索、每一轮的实测记录）在 Claude 的记忆文件
`deerflow-parity-harness-plan` 里；这里只放接手一轮所需的最小集合。

**每推完一个阶段（一轮 wave），就地更新这份文档，然后开始下一轮。**

---

## 当前状态（截至 wave 179，2026-09-08）

- 分支 `main-wc`。`b700cf17` = wave 39（chore `b09adb80`），
  `aef3618d` = wave 40（chore `2f9627fa`），`096c17d4` = wave 41，`706b3785` = wave 42，
  `54454b7c` = wave 43，`46f62dea` = wave 44，`f15c7181` = wave 45，`ca1c7f1d` = wave 46，
  `c12c4d37` = wave 47，`3f152764` = wave 48，`5978d533` = wave 49，`80ef4d15` = wave 50，
  `a1d675d6` = wave 51，`3382f7e0` = wave 52，`333edeef` = wave 53，`ff2cd759` = wave 54，`c8b2d1a8` = wave 55，`509219ea` = wave 56，`ccf6d0b8` = wave 57，`3e47b1fd` = wave 58，`cffb11f4` = wave 59，`ed0439ee` = wave 60，`88d4859d` = wave 61（chore `891d3f7a`），`ff9552d8` = wave 62（chore `088ea168`），`85ca893a` = wave 63，`2759b3e8` = wave 64，`bc34c7b3` = wave 65，`2b2f56b7` = wave 66，`5cf9d44d` = wave 67，`e775ba9e` = wave 68，`585e0bc7` = wave 69（chore `eec54d3c`），`43d5f289` = wave 70，`32d71958` = wave 71，`3034bd05` = wave 72，`209c49db` = wave 73（chore `7630e6e3`），`16ca870e` = wave 74（chore `b0b7fcb6`），`7d2b7a30` = wave 75，`e96f0adf` = wave 76，`60b8f1e8` = wave 77，`ba84b142` = wave 78，`b79695de` = wave 79，`e1028406` = wave 80，`0722d66a` = wave 81（无代码改动），`c3399c3b` = wave 82（chore `809237ec`），`3703ae61` = wave 83（另有 `5a5580d5`：两处 drag 助手的观测缝），`55022f02` = wave 84，`27fb23ad` = wave 85，`3bfec0f9` = wave 86（chore `1677e96b`），`289cb588` = wave 87，`1083b122` = wave 88（chore `9abc8d0c`；另有 `55678738`：wave 87 漏改的那一份折叠断言），`91ab3b2a` = wave 89（chore `9cb61684`），`1e5a2815` = wave 90，`fa66fb66` = wave 91，`d36c2d60` = wave 92，`0ec3b9a4` = wave 93，`6804bd6b` = wave 94，`855c209c` = wave 95，`d21a1b67` = wave 96（另有 `a165c96c`：rAF stub 的定时器泄漏），`a16ff72a` = wave 97（chore `b92c90e0`，**两边同改**），wave 98 **只有度量与订正、没有代码改动**；wave 99 **是一次否定结论，代码改动为零**；`b34f4f4e` = wave 100；wave 101 **同样只有度量与订正**（只改了 `baseline/parity-scenario-coverage.json` 里 `$pendingReasons` 的一行），**没有代码改动**。wave 102~105 见各自那一节；`29a233e3` = wave 106（五处守卫缺口，**其中一处有活违规**）。`97089b4f` = wave 107（后端枚举镜像 + doc-facts 的静默跳过 + 一条 auth e2e 的根因修复）。`2afc0ba8` = wave 108（把「负载抖动」变成可复现实验，expect 预算 5s → 10s）；`059d8bd5` = wave 109（订正 108 的推断 + 清掉最后 7 处写死的 5s）；`52a35b5b` = wave 110（独立性判据自己身上的两处单向检查）；`a750347f` = wave 111（icon-parity 的两张豁免表补成双向，过期豁免开始让门禁红）；`bdf79e73` = wave 112（四张「指向外部东西」的表补反向校验；upstream-drift 的假「无漂移」）；`071a2414` = wave 113（第六条抖动查清机制并修掉，名单七条 → 六条）；wave 114 / 115 **都只有度量、代码改动为零**；`786cd37e` = wave 116（standalone-sim 只跑 8 份文件而判据说的是整套）；`4279a42e` = wave 117（答掉「要不要加 build」：不加，理由量出来了）；`29fcbb1c` = wave 118（--with-e2e 只跑了那个必然跳过的套件）；`af94ed0d` = wave 119（standalone-check 的正则要求带斜杠）；`9502a05c` = wave 120（三个夹具 id 没登记进 KNOWN_IDS）；`92a8f87d` = wave 121（丢弃查询参数那张表一条都没响过）；`f46dbbd3` = wave 122（那条没注释的归一化规则抹掉的是整棵树的层级）；wave 123 **只有度量、代码改动为零**（在保住缩进的数据上重做层级比对，6 行）；`d440b68c` = wave 124（划词工具条挪出 `role="log"`）；`74fab84a` = wave 125（「深度」做成常驻的一档）；`7d171e03` = wave 126（两个归一化抽成一份共享规则）；wave 127 **只有度量、代码改动为零**；`e53db1d0` = wave 128（第⑥类进取样面，量出 `retry: false 与上游一致` 是假话）；`03c85d6f` = wave 129（场景注释里「锚点钉住编辑表单」是假的——两个锚点都落在创建表单上；并订正 wave 128 自己写下的那条判据）；`d691ec36` = wave 130（同一类的第二例：artifact 面板的两处锚点，一个点击前就满足、一个压根不存在；**并把 `#preview-failed` 那条路量到走不通**）；`2100cb23` = wave 131（把 8 个「一个锚点匹配到多份」逐个核完——3 个是缺陷、5 个正常；会话列表页的锚点一直落在侧栏上）；`6477ec4a` = wave 132（第⑥类第一次量到产品层面的分叉：**预览失败时上游仍然选中「预览」**）；`fbed3dde` = wave 133（技能清单取不到时本仓还留着筛选标签与「创建技能」按钮，已对齐）；`5ffb7fee` = wave 134（**「还在转」那一档第一次进取样面**，同一处根因一并对齐；并订正 wave 133 提交说明里引错的一条证据）；`1c99f9cb` = wave 135（**agents 画廊页第一次进取样面**，量出四处修掉两处；第一版锚点被负向验证当场抓到太松）；`ae941be2` = wave 136（模型清单改成打开对话框才取，结清上一轮挂的那行账；**并抓到自己的一次无效变异**）；`f1a3e3bf` = wave 137（AgentCard 与模型设置对话框第一次进取样面，**量出上游那五个表单控件都没有可访问名**）；`7f97efd1` = wave 138（**两边同改**：给那些控件补上可访问名；chore `ba942911` 把 marker 推到它）；`19cb7edd` = wave 139（**把 wave 137 的错归因查到底**：对话框标题在调用点重复写了一次 `text-lg`，把 primitive 的 `leading-none` 顶掉了）；`86a66f4c` = wave 140（**深色主题少了上游的全局字重 300**；几何档加 `fontWeight`；新门禁 primitive-class-overrides）；`96750443` = wave 141（**逐个对比两边 primitive 的基类**：37 个里 10 个不一致，四处漏抄已修，其余逐条声明）；`71aa29cf` = wave 142（清掉声明表里那三条「真差异、待修」，**一条待修都不剩**）；`ac741338` = wave 143（把 cva variants 那一类也接进基类比对，三个最高频组件一字不差）；`8b5f53e4` = wave 144（技能设置页那一屏第一次进取样面，**Tabs 的 variant 体系本仓整套没有**）；`f7c90563` = wave 145（搬来 Tabs 的 variant 体系，**顺带发现基类守卫看不见 7 个最高频组件**，并把七处 `as="button"` 造成的错层补偿一起删掉；`d468c4bf` = wave 146（**伪元素进取样面**，分栏拖拽把手第一次挂成锚点）；`ab4dea2c` = wave 147（**会话行的 ⋯ 在手机上够不着**；并推翻了我自己 wave 146 那张表的两行；`ParityState.dimensions` 让终态自己钉断点；`b60966bf` = wave 148（**手搓的模态语义全仓扫一遍，三处一起换成 primitive**，并配上零豁免守卫；`91af7855` = wave 149（**台账里认不出是谁的行清零**，59/79 → 0；`ef247138` = wave 150（**「全表 A–S 共 19 组」那句话守卫只读到 14 组**，O–S 五组 45 条从没被读过；`cc4c6e60` = wave 151（**订正 wave 150 的说明**：那句话本来就有 `doc-facts` 在守）；`0f9d304f` = wave 152（**两份 README 记的门禁不是同一套**，中文版少了 `standalone-sim`；`cb625bc1` = wave 153（**一条正确、但没人守的边界**：Reka 只能出现在 `app/components/ui/` 里）；`ca8eef42` = wave 154（**浮层层级也是一条正确、但没人守的规则**）；`016704d1` = wave 155（**判据走出 frontend-vue**：AGENTS.md 拓扑表里 Vue 那行写的是本机端口不是容器端口）；`10be0106` = wave 156（**「it maps the whole repo」而四个已跟踪的顶层目录不在图上**）；`8a69c12a` = wave 157（**被文档标成 optional 的 compose 服务，裸 `up` 会无条件启动它**——实测 `RestartCount 4370`；顺带抓到我自己引入的两处回归与两次假绿）；`ce1a1c04` = wave 158（**两边同改**：发送自己的 id 交接被当成「用户换了会话」，把这次发送的基线冲掉；chore `352753b1` 把 marker 推到它）。另有 `3ec1f496`（**容器里的 .venv 不属于这个平台时，启动前就地重建**，用户实测事故）。
  wave 159~177：`ea1b4666` = wave 159（**只有度量**：#2 剩下那一半查到根因）；`fe882f61` = wave 160（chore `de67deae`，**两边同改**：三处产品动画不理会减动偏好）；`decab3bd` = wave 161（chore `90b03ea0`，**两边同改** ambilight）；`c360d05c` = wave 162（chore `ec3e7f40`，**两边同改** shimmer）；`e6a264d1` = wave 163（**判据换个形状**：会无限循环的动画都必须表态）；`cd5945ac` = wave 164（**零代码改动**：给动画加一档，三重堵死）；`767abd31` = wave 165（chore `b49b02ab`，**两边同加** `data-slot`）；`f6ab35ed` = wave 166（**九门禁全扫读数**）；`34e49e22` = wave 167（chore `d418a691`，**两边同改** fade-in-up）；`642dda3f` = wave 168（chore `a8332f14`，**两边同改**骨架屏 + 新守卫）；`ac30835c` = wave 169（chore `a5534c82`，**两边同改**骨架屏与可访问播报）；`80d72dd1` = wave 170（chore `9ef01c59`，**两边同改**挥手动画）；`e9752c31` = wave 171（**前端镜像里装的是 macOS 原生二进制**，用户实测事故）；`fc1615f3` = wave 172（**九门禁全扫读数**）；`ea873d2b` = wave 173（**那条「抖动」不是抖动**：四条用例真的会出网）；`08793db0` = wave 174（chore `1c735271`，**改 `frontend/`**：外部 fetch 没超时）；`a9c04f3a` = wave 175（**改 `frontend/`**：挂了 146 轮那条账收了）；`6473e83a` = wave 176（chore `b4b7ffbf` 一次覆盖 175/176 两处 `frontend/` 改动；**改 `frontend/`**：一块全屏 shader 跑在软件光栅化上）；`0f4b3e02` = **这一段修过的每一处的自审**（12 根因 / 1 半根因 / 1 不是）；`06beaf48` = wave 177（**把自审里那唯一一条「不是根因」补上构建期拦截**）。
- **动过 `frontend/` 的是二十四轮**（wave 158 新增一轮：发送交接冲掉基线 + 标题里的 `Loading...`）
  （此前记的是二十三轮）（wave 138 新增一轮：模型设置对话框的可访问名）（wave 52 实测订正，wave 62 / 73 / 74 / 82 / 86 / 88 / 89 / 97 各加一轮）：
  wave **3 / 4 / 6 / 11 / 17 / 20 / 21 / 22 / 23 / 27 / 28 / 36 / 39 / 40 / 62 / 73 / 74 / 82 / 86 / 88 / 89 / 97**。
  此前这里只列了 36/39/40（那三行本身没说错，它们的范围是「wave 30 以来」），
  而记忆里的压缩版把它读成了「总共三次」。**别再传这个数字，用命令量**：

  ```bash
  git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests
  ```

  **marker 已推到 `a16ff72a`**（wave 97 的两边同改）；`node scripts/upstream-drift.mjs`
  wave 97 实测**无漂移**，marker 也确实是 HEAD 的祖先——
  **边界规则本身有机器在守，需要人记的只有「这类改动做过哪些轮」。**
  最近几轮的内容：**wave 97 给上游 ScrollArea 的 viewport 补 `tabIndex={0}`**
  （滚动区纯键盘到不了，而 shadcn 早就给它配了 focus-visible 样式）；
  wave 89 再给两边各 12 颗筛选/上下文/周期按钮补 `aria-pressed`
  （并把这条判据做成守卫）；wave 88 给 22 颗域按钮 + 2 颗品牌按钮补 `aria-pressed`（两个应用
  都只用换色表达选中）；wave 86 侧栏 nav 菜单去掉 `menu > link > menuitem` 的嵌套可交互元素；
  wave 82 长文件名把 artifact 面板整排动作键推出可视区；
  wave 74 两处 `<Toaster />` 用的不是 shadcn wrapper；wave 73 五条「本仓修掉了上游缺陷」；
  wave 62 `/auth/callback` 吞掉 `?next=` 深链。wave 41~~59、75~~81 都没动过。

- **对照台账 202 行**，**90** 个样本，`make -C frontend-vue e2e-parity` **98** 条全绿（wave 149 把 `tabbablesOnly*` / `tabOrder` 三档里 **59/79 行认不出是谁**的问题修掉：描述器给 generic 标签补 `data-slot`，行数一格没动、认不出的行降到 **0**）（wave 145 把 Tabs 的 variant 体系搬过来，219 → **197**：每语言 11 行归零，另有 2 行是同一笔账的读数变好——`switch[review] y` Δ41.9 → Δ-4.1，集合包含判据表达不出「同一个键、更小的值」，所以走了 `PARITY_ACCEPT_GROW=1`）（wave 130/131 换了三处锚点，**台账一行都没动**——加的是覆盖面不是账；wave 132 接上 `artifact-batched-stream#preview-failed`，113/77/85 → **121/79/87**，新增 8 行里 6 行是已判过的重试差异、2 行是新决定）（wave 128：95/73/81 → 107/75/83；wave 129：107/75/83 → **113/77/85**，新增 6 行全部是 wave 128 已判过的 `retry: 3` 那一条在另一屏上的复现）。
  wave 96 用 tab 序那一档量出 64 行、四处根因，**wave 97 逐条结清**：
  分隔条那 48 行与 browser 标签那 4 行**修掉了**，菜单 roving 那 2 行**决定接受**，
  滚动区那一处两边同改之后变成了另一处此前完全看不见的结构差异，
  **wave 98 已核完并决定接受**（见下）。
  **51 行里没有一行是「还欠的」**：2 行 reka-ui 的 tooltip 播报节点（wave 91）+
  42 行「上游把字写死成英文、本仓翻译了」（wave 92/93）+ 7 行焦点差异
  （wave 94：4 行本仓的 settings 深链焦点更好、1 行是上面那一类的重复、
  2 行是改动面板打开后的 incidental 初始焦点）。
  **wave 95 新加的「顺序」档一行都没留下**——它量出的两行是真差异，当轮就修掉了。
  **「只能缩短」这条规则对「新出现、还没定过的行」依然有效。**
  （39 → 40：wave 87 的 `states` 轴；40 → 44：wave 88 给 `integrations` 挂上
  `default` / `permission-request` / `change-app`；44 → **48**：wave 90 给 `channels`
  挂上 `default` / `runtime-config` / `runtime-config-edit`——都是三个终态 × 两个语言维度；
  48 → 51：wave 91 给 `branch-thread` 挂 `default` / `turn-actions` 两个终态，
  并给它**补上 zh-CN 维度**；51 → **71**：wave 92 把**19 个只跑 en-US 的场景
  全部补上 zh-CN**；71 → **73**：wave 93 给 `thread-history-mermaid` 挂上下载菜单。）
  路径是 1716 → …… → 23（wave 76 接上交互后的锚点，量出 27 处此前看不见的差异）
  → 16（wave 77 一处改动关掉 7 行）→ **0**（wave 78 把剩下的 16 行归到五处根因）。
  **这里的 0 是「当前这 39 个取样点上量不出差异」，不是「两个应用一样」**——
  台账天生看不见的八类见下。
- 覆盖率棘轮：covered **24**，pending **仍是 1 条**（`chat-thread-init-ordering`）——
  **wave 63 用 23 个样本重测过，仍然不能加**（React 两个终态 19B/4A，Vue 23/23 单一）。
  翻案判据已从「连取 5 次」**收紧到连取 20 次**，连同复现脚本一起写在 `$pendingReasons` 里。
  **wave 30 没有碰它**（正题是给现成场景加一步，不是加场景）。
- 已彻底对齐的域（14 个 + settings/memory）：chat / artifacts / 会话列表 /
  scheduled-tasks / channels / integrations + 设置外壳 / mermaid / subtask-card /
  workspace 头部 / sidebar / messages / sidecar / browser / composer，
  外加 **settings 域全部**（wave 22~24）、**auth**（wave 26：`/login` 58→0）、
  **只读案例页**（wave 27：`/showcase/<id>` 29→0）、
  **建 agent 页**（wave 28：`/workspace/agents/new` 9→0）、
  **composer 的焦点 + follow-up 整簇**（wave 29）、
  **划词工具条整簇**（wave 30：aria 1→0，位置从 (955,642) 挪到与上游逐像素相同的
  (367,197)）、**聊天面的播报机制**（wave 31：22 处收进 workspace toaster，
  unused 39→36）与 **CSS 基础层的级联层次序**（wave 32：全仓 90 处 border 颜色
  工具类从「一处都没生效」变成全部生效）与 **词典手术**（wave 33：删掉扫描器结构上
  看不见的 10 条死词条，并给「本仓独有的词典块」补了守卫）与
  **写操作的成功播报**（wave 34：五个面 12 处，unused 36→26）与
  **四条「上游在用、本仓没有」的 UI 形状**（wave 35，unused 26→22）与
  **窄屏侧栏触发器 + 两句说明文字**（wave 36，unused 22→20，**两边同改**）与
  **模型选择器筛选 + 技能 chip 那一行**（wave 37）与
  **掉线时的退出出路 + 登录页分隔**（wave 38，unused 20→18）与
  **命令面板搜索框的可访问名**（wave 39，两边同改）与
  **重连预算耗尽后的模式键**（wave 40，两边同改）与
  **run 结束后重取 checkpoint**（wave 41）与**提交键的出错态**（wave 43）。
  **wave 42/44 把「请求体」这一整类扫完并补上了守卫**（台账只比 method+path+query，
  请求体从来没进过任何比对；wave 44 在这一类里撞出并修掉了 `sortBy`→`sort_by`）。

> **`app/pages/` 下的路由已经一条不剩地量过了**（wave 28 量完最后三条）。
> **要找活只能去「挂着的账」里挑**，不要再指望「还有没量过的路由」。

> **settings 域有一个取样点**（`settings-notification`，wave 25 的 `stubs`）。
> 其余六个面板仍然没有合法的场景 id（棘轮要求 id 逐字等于 React spec 文件名），
> 它们的差异只能靠 probe 找、靠单测守（线索 107）。

### 门禁实测值（wave 113 收工时逐条跑过）

```
make -C frontend-vue verify        exit 0；**265** 文件 / **2205** 单测，词典 942 key、18 unused
                                   （2183 → 2187 是 wave 104/105 加的；2187 → 2192 是 wave 106：
                                   agent-core 契约守卫 8 → 11、file-header-claims 8 → 10；
                                   2192 → **2195** 是 wave 107 新加的
                                   `tests/guards/backend-enum-mirror.test.ts`，**文件数 263 → 264**）
                                   产品 SFC **218**（总 **220**，wave 86 新增 DropdownMenuGroup）
make -C frontend-vue standalone-sim exit 0（wave 83 新增）**判据的动态那一半**：真把
                                   ../frontend rename 走，跑 CROSS_APP_BY_DESIGN 表里
                                   点名的每一条，再移回来。**wave 116 起 test 那一步跑
                                   整套 vitest**（此前只跑表里的 8 份，而判据说的是「整套」）。
                                   跑过 **14** 条 / 未跑 5 条
                                   （4 data + 1 e2e）/ 红 0。**有意不进 verify**
                                   （动文件系统，且不能与任何构建并发）。
                                   `--with-e2e` **wave 118 起还跑 e2e-mock + e2e-backend**
                                   （此前只跑 e2e-parity，而那是唯一一个兄弟应用不在时
                                   **整组跳过**的套件——这个开关几乎什么都没证）。
                                   实测 **17 / 4 / 0**；十分钟量级，opt-in。
make -C frontend-vue icon-parity   **0 处待核、0 条 ⚠**（wave 75 逐条核完；`VERIFIED`
                                   与 `EXEMPT` 两张表现在都双向，**过期豁免会让它 exit 1**）
                                   **⚠ 这一行 wave 111 之前是假的**：stale 从 wave 87 起
                                   一直在报三条，而它只 console.log 不影响退出码，
                                   核清单的人 grep 的是最后那句「共 0 处待核」
make -C frontend-vue asset-budget  exit 0（wave 72 把 vendor-ui 预算按实测重定了一次，
                                   见 scripts/asset-budget.mjs 里那段注释）
make -C frontend-vue audit         **预期红**：14 条，分诊写在 Makefile 的 audit 上方
make -C frontend-vue coverage      语句 73.22% / 分支 64.72% / 函数 70.55% / 行 74.9%
                                   **诊断工具，不进 verify，没有阈值**
                                   standalone-check BLOCKING 0 处 / 0 个文件（DECLARED **40** 处 / **18** 个文件）
                                   ——**它只是静态证明**，证不了「移走之后还能跑」：
                                   wave 83 第一次真做实验时它早已是 0，而 verify 当场红。
make -C frontend-vue e2e-parity    **81**  台账 **95 行**，**73** 样本
                                   （wave 94 起多一档 `focus`：7 行；
                                   wave 95 起多一档 `order`：**0 行**；
                                   wave 96 起多三档 tab 序：wave 97 结清后剩 **44 行**；
                                   wave 100 起几何里多一格 `hit`（命中测试）：**0 行**）
                                   2 行 = reka-ui 的 tooltip 播报节点被打上
                                   aria-hidden（wave 91）；42 行 = 上游把字写死成
                                   英文而本仓翻译了（wave 92 的 28 行 + wave 93
                                   给 mermaid 加第二个终态时同一屏又记一次的 14 行）。
                                   **两类都已决定，没有一行是「还欠的」。**
                                   wave 87 加了 `states` 轴：键是 `场景#终态/断点/主题/语言`；
                                   wave 88 用它给 `integrations` 挂了三个终态（× 两种语言）
make -C frontend-vue e2e-mock      265 + 22 + 15 + 2 + 6   (= e2e + auth + infra + proxy-options + stream)
make -C frontend-vue e2e-backend   2 + 5 + 2 + 3 + 3 + 5 + 1 + 1
                                   **wave 88 又抓到一条**：`e2e-shell` 红，而且干净树上
                                   照样红——wave 87 把改动面板的行改成 `Collapsible` 时
                                   漏改了这一份折叠断言，**那一轮没跑 e2e-backend**。
                                   坑 194 的又一次，见下面 wave 88 那一节。
                                   **这一行 wave 65~78 一直是抄下来的，没人真跑过**：
                                   wave 79 跑全套，`e2e-channels` 当场红，而且单独跑
                                   两遍也红——wave 72 给渠道那颗连接键补上图标那天起
                                   就红着（坑 220/222）。**它现在是收工清单的一项**，
                                   不是「顺带跑跑」。注意 `make e2e-backend` 是 8 个
                                   套件**串行、第一个失败就停**，channels 排第四，
                                   它红之后后面四个套件的状态是**未知**不是绿（坑 221）。
make -C frontend-vue e2e-visual    8    **不在 make e2e 里**；wave 78 重录 3 张
                                   （容差压到 0 跑两遍：empty chat **两遍都是 595px**
                                   ——稳定＝我改的，diff 图上就是模式键与推理档从右边
                                   挪回左边；artifact panel 2006 / 2082 **两遍不同**，
                                   但 diff 图上除了已知的整条消息列文字平移，
                                   右上角那排动作键也在高亮里——**抖动与我的改动叠在
                                   同一张图上**，两样都在，所以照样要重录。
                                   `=changed` 连带重录了 empty-chat-attachment，
                                   同 wave 72，机制见坑 94）；wave 74 同样一张没重录
                                   （容差压到 0 跑两遍：只有 artifact panel 红，
                                   1926 / 2089，**两遍不同 = 抖动**；其余七张
                                   在零容差下逐像素相同）；wave 73 一张没重录
                                   （容差压到 0 跑两遍：只有 artifact panel 红，
                                   1807 / 1902——**两遍差 95px，是抖动不是改动**，
                                   而且因果够不着：那一屏没有 toast、没有 todo、
                                   没有对话框、没有附件。抖动的振幅比记的大得多，
                                   历轮实测 855/815 → 258/167 → 1807/1902，
                                   **不是「±40px」**，随基线录在哪个相位而定）；
                                   wave 72 重录 4 张
                                   （容差临时压到 0 跑两遍：empty chat 990px 与
                                   reasoning/tool 49px **两遍逐像素相同 = 我改的**，
                                   artifact panel 258→167 是已知抖动；
                                   `=changed` 连带重录了 empty-chat-attachment——
                                   **一条用例里的第二张截图，第一张不修好它根本跑不到**（坑 94）；
                                   **别用裸 `--update-snapshots`，它等于 `all`**）
make -C frontend-vue e2e-external  3
```

产品 SFC **217**（总 219；wave 72/73 都没有新增 SFC）。动了 `frontend/` 再加
`python3 scripts/pnpm.py --dir frontend check` / `test`（**1029**）/ `test:e2e`（**146**）。
**wave 74 三条全真跑过**：check 0、test **1034** passed、
test:e2e **145 + 1 条已知抖动**（`landing.spec.ts:61`，`--repeat-each=5` 35/35）。
（1029 → 1034 是 wave 73/74 加的 5 条，全在
`tests/unit/components/ui/interactive-affordances.dom.test.tsx`。）

> **React 的 `test:e2e` 绕法**（wave 73 又用了一次，有效）：先自己
> `SKIP_ENV_VALIDATION=1 pnpm exec next build`，再
> `PORT=3002 SKIP_ENV_VALIDATION=1 DEER_FLOW_AUTH_DISABLED=1 npx next start -p 3002`，
> 最后 `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3002 npx playwright test`。
> **3000 端口本机常被占**，用 3002。跑完记得 `lsof -ti tcp:3002 | xargs kill`。

> **wave 40 实测：`test:e2e` 的 `webServer` 那 120 秒窗口在这台机器上喂不饱一次
> `next build`**（负载 30+ 时编译要 6.6 分钟，`Timed out waiting 120000ms from
config.webServer` 在任何测试跑起来之前就炸）。**绕法**：先自己 `next build`，
> 起 `PORT=3002 SKIP_ENV_VALIDATION=1 DEER_FLOW_AUTH_DISABLED=1 next start`，
> 再 `PLAYWRIGHT_SKIP_WEB_SERVER=1 pnpm exec playwright test`。
> **注意超时那一次会把 `.next` 留成半成品**（`next start` 会说
> "Could not find a production build"），收工前记得重建。

> **wave 108 给这一整段补了一个「可复现」的旋钮，并量出其中一条的机制**：
> `page.context().newCDPSession(page)` + `Emulation.setCPUThrottlingRate`。
> 第四条在 **30x 节流**下实测第一条断言用掉 **3832 / 5000ms**（77%），50x 直接超时——
> **机制是 Playwright 默认的 5s expect 预算**（用例本身有 30s，二十几秒没人用），
> 不是「断言钉错对象」（那是 wave 107 修的另一类）。预算已提到 **10s**。
> **两类的区分判据**：把机器调慢，失败点会不会移动——钉错对象的那类调慢了照样红在
> 同一个语义上（它等的东西永远不来），预算不够的那类是「等的东西来了，只是晚了」。
> **注意：只有第四条被复现验证过**，第三/五/六条是按症状同形推断的，没有逐条验。
> **wave 109 把这句推断查完了：不成立。** #5 在 60x、#6 在 70x 节流下**都还是绿的**
> ——节流只模拟「页面脚本慢」，模拟不了「服务端也慢 / 进程被抢占」；而 #3 与 #5 的
> 关键断言**本来就写着 `timeout: 15_000`**，它们从一开始就不在这一类里。
> **那个旋钮有适用域，别当通用复现器用。**

> **wave 115 用真负载旋钮把这张名单逐条量过了（37 次，一次没红）**：
> #2 ×8、#3 ×15、#4 ×6、#5 ×8，负载 20~115。而同一把旋钮在 wave 113 修之前的
> **#6 上 10 次红 1 次**——**旋钮有效，这四条就是复现不出来**。
> **所以这张名单不是同质的类**：能按需复现的只有 #6（已修），#7 本来就是另一类，
> #1 在 `frontend/`；**剩下四条现在的地位是「一次历史观察」**。
> **下次它们再红，先跑旋钮——本轮已把「不红」定成默认结果，所以那时候红就是新信息。**

**已知的两条负载抖动**（都不是产品缺陷，但每次遇到都要重新证一遍因果）：

1. `frontend/tests/e2e/landing.spec.ts:61`——`locator.boundingBox` 等动画区的
   `.max-w-6xl`，wave 20~23 与 wave 28 都遇到过。
2. **`frontend-vue/tests/e2e/channels.spec.ts:1020`（wave 29 新增）**——
   「channel query 401 follows the shared login redirect」。它 `page.goto` 之后用
   **5s** 等 `/login?next=`，而那次跳转要等水合完成、`providersQuery` 发出去、
   拿到 401、`fetchWithAuth` 才 `window.location.href`。wave 29 在 **load 41** 时红过
   一次，随后在 load 3~10 时 `--repeat-each=5` **5/5 全绿**。
   因果链是 `layouts/workspace.vue → ThreadSidebar → WorkspaceChannelsList →
useChannelConnections → providersQuery → fetchWithAuth 401`，
   wave 29 改的三个文件一个都不在这条链上；而且 **ThreadSidebar 本来就 import
   `ui/dialog`**，所以那一轮往 ChatComposer 里加的 Dialog 没给这条路由的
   critical path 添任何模块（同一次跑里 `/workspace/chats/new` 的 route-payload 是过的）。

**wave 33 赶上别的仓库在构建，load 一度到 60**：`e2e-settings` 与 `e2e-external` 两次
`Timed out waiting 240000ms from config.webServer`（**基建超时，不是断言**），
`ui-primitives-a11y.spec.ts:288` 的 hover tooltip 在 load 22 时红过一次。
**wave 113 已经把它查清并修掉了，名单从七条减到六条**（机制是「一次 hover 赌不到
延时开的 tooltip」，见 wave 113 那一节）。下面这段读数保留作为它的病史。
**wave 112 实测它的真实频率高得多**：四个套件连跑之后（load 7~9）立刻单跑
`--repeat-each=10` 是 **3 失败 / 7 通过**；机器安静下来之后两次都 **10/10**。
**「红过一次」这个记录严重低估了它。** 而 wave 109 已证明 CPU 节流复现不了它（70x 仍绿），
所以下一轮要查它，用的复现条件是「跑完几个套件之后立刻跑」，不是节流。
**load 降到 5 之后三套全绿。** 这台机器上 `webServer` 的 240s 在 load>20 时不够用，
遇到就等负载，不要先去查产品。

**第七条已知抖动（wave 102 新增，而且这一条与前六条不同类）**：
`tests/e2e-settings/settings.spec.ts:275`
（`real memory backends preserve 400/404/409/422/500/501 taxonomy`）。
wave 102 收工跑 `e2e-backend` 时红了一次，断言是 12 路并发 `POST /api/memory/import`
**期望每一个都是 200 或 409**。前六条的机制都是「异步 / hover / 滚动 + 固定超时」，
**这一条是并发竞态下的状态码分布**，形状不一样。

因果验过：`git stash` 之后干净树 **5/5 全绿**，`stash pop` 回来再跑 **又 5/5 全绿**
——那一轮改的只有三份文档和 `$pendingReasons` 的一行字符串，够不着这条路由。

**顺带修了一处真问题**：这三条断言原来**不带消息**，红的时候日志里只有
`Expected: true / Received: false`，**到底是 500 还是 429 还是别的，事后完全查不到**，
只能重跑。同一个文件上面那条 `expect(duplicate.status(), await duplicate.text())`
早就是带消息的写法，这三条只是漏了。现在补上 `statusSummary`，
负向验证（把判据改成 `status === 999`）确认失败消息里能读到
`12 路并发 import 的实际状态码：[200,200,409,409,...]`。
**下次它再红，先看那一行，不要直接重跑。**

**第五条已知抖动（wave 66 新增）**：`tests/e2e/thread-history.spec.ts:695`
（`new chat does not show previous optimistic user message after client-side navigation`）
报 `element(s) not found`。**因果够不着**：那一轮唯一影响产物的改动是
`chunkFileNames`，只改**文件名**、不改分组也不改执行，而**同一份改动在同一轮更早
那次 `make e2e` 里这条是绿的**。整份 spec `--repeat-each=5` **90/90 全过**。
机制与前四条同类：异步 + 固定超时。

**第四条已知抖动（wave 54 新增）**：`tests/e2e/i18n-theme.spec.ts:45` 里
`sidebarPanel.locator('[data-sidebar="trigger"]').click()` 30s 超时，
call log 是 `element is not visible / not stable`——**一个 hover 才出现的控件**。
因果够不着：那一轮改的 `app/` 两处**都在块注释里**（编译产物逐字节不变），
其余改动是脚本注释、fixture 的 `$comment` 和一条门禁测试。
负载降到 ~2.5 后 `--repeat-each=5` **35/35 全绿**，整套 `e2e-mock` 重跑到 265。
机制与前三条同类：hover/滚动/异步 + 固定超时。

**wave 30 与 wave 31 全程零重跑**；**wave 32 重跑过一次**：第一遍 `e2e-mock` 在
**load 18** 时 `thread-list-infinite-scroll.spec.ts:74` 红了一次，因果够不着
（那一轮只改了 border/outline 颜色与规则所在的层，都不进布局；边框宽度 probe 前后
逐个元素相同），load 8 时 `--repeat-each=5` **15/15 全绿**，收工前整套也重跑到 263。
**这是第三条已知的负载抖动**，机制与前两条同类：滚动/异步加载 + 固定超时。

### 开工前必查

```bash
for p in 8021 3115 3116 3114 8018 3101 3109; do lsof -ti:$p; done
```

```bash
ls frontend/.next/BUILD_ID frontend-vue/.output/server/index.mjs frontend-vue/.output/nitro.json
```

端口都该空，三个文件都该在，`git status` 干净。残缺的构建产物会让整轮以
`Process from config.webServer exited early` 收场。

---

## 四条硬规则

1. **台账只能缩短。** 不要用 `make parity-accept` 收工。
   （wave 76 之前这条写的是「保持 0」。那一轮把几何档接到交互后的锚点上，
   量出 27 处**一直存在、此前没有任何工具够得着**的差异，accept 了其中 23 行
   ——**破例的前提是先证明它们不是回归**：把那几轮动过的文件还原成 wave 72 之前
   的版本重跑一次逐条对比。**这条规则防的是「新回归被顺手 accept 掉」，
   不是「清单必须是空的」**——它从 1716 行开始，一直在缩。）
   **真正的判据是 `e2e-parity` 本身**——`diff.spec.ts` 做的是
   `expect(entries).toEqual(baseline.entries)`，**整棵结构深比**，
   新增、消失、内容变更、场景增减全覆盖，比「NEW/GONE 都是 0」更严。
   要把结果读成人话就跑 **`node scripts/parity-ledger-report.mjs`**，
   **不要再手搓第二套比法**——wave 50 复核发现，此前每轮临时写的那段 python
   走 `d.get("scenarios", d)` 兜底，而基线的顶层键是 **`entries`**，
   于是**基线行数恒为 0 与内容无关**：`NEW` 那一半是真量的，
   **`GONE` 那一半是结构决定的、从来没测出过任何东西**，
   「两边场景集合一不一致」更是压根没查。结论没错（门禁一直在深比），
   但那句「独立复核过」是空的。
   新增场景时基线加一条**五个数组全空**的记录。
2. **归一化/取样规则只能因为实测而增加。** 每一条都在抹掉信息。
3. **不要靠重跑收工。** 「偶尔红」先当真缺陷查——先证因果够不着，再谈负载。
4. **「本仓可能更好」的取舍自己定，不要中途提问**（2026-09-02 用户明确）。
   判据仍是「这处不改，React 自己是不是也是坏的？」，但把选了哪边、代价是什么
   **单独列进提交说明的一节**。

### 边界

默认只改 `frontend-vue/`。**根因确实在 `frontend/` 时可以两边同改**——同一处修法
同时落到两个应用，两边的树仍逐行一致，台账不增行。判据：**这处不改，React 自己是不是
也是坏的？** 是，才动 `frontend/`。改完必须跑 `make -C frontend-vue upstream-accept`
并**单独提一个 chore 提交**（范本 `git show 6912c5cf`）。**React 侧注释写英文。**

> **wave 28 用的判据，下一轮可以直接抄**：**没有可访问名的交互控件**算缺陷（读屏器
> 只念得出「按钮」），**命名弱但存在、或缺一层播报**算风格不算缺陷。前者两边同改，
> 后者照抄上游。判缺陷时最强的证据是**同一份代码库里的既定写法**——
> wave 28 那颗返回键的邻居（同一个 header 里的 More）写着 `aria-label`，
> 那两处同形的表单错误（`account-settings-page.tsx:133`、`human-input-card.tsx:339`）
> 都写着 `role="alert"`。

### 台账天生看不见的八类差异（wave 145 加了第⑨类，wave 146 补完）

① 需要交互才看得见的；② 藏在请求 body 里的；③ portal 出去还会遮蔽页面的浮层；
④ ~~顺序与层级~~ —— **顺序那一半 wave 95 补上了**（`diffAriaOrder`：先取公共多重集
再比相对顺序，所以「多包一层容器」不误报）；**层级那一半 wave 99 量过了，结论是
不必单做**——把一个节点挂到别的父节点下，几乎必然同时改变它在线性序里的位置，
**⚠⚠ wave 123 把这条归因推翻了**：在**保住缩进**的数据上重做一次层级比对，
**量到 6 行**（划词工具条的三颗按钮 × 两种语言，React 深度 2 / Vue 深度 3）。
wave 99 的 0 是数据被塌平造成的，不是「层级差异不存在」。原文与 122 的存疑保留如下。
**⚠ wave 122 给这条归因加了一条存疑**：`normalizeAriaSnapshot` 的 `\s{2,}` 规则
把**每一层缩进都塌成一个空格**（实测 7692 行里命中 6698 次），也就是说
**层级信息在归一化那一步就没了**——wave 99 量到的那个 0 也可能只是「数据不在」。
真要做层级，得先让 capture 另存一份带缩进的。原文保留如下：
`order` 那一档已经把它抓住了（实测：把一项挪出 `DropdownMenuGroup`，
`order` 当场报「第 3 个公共节点 React=group: Vue=menuitem …」，
而专门写的层级档一行都报不出来）；只在一边多包一层容器则由 `diffAriaLines` 报。
~~**这一类到此为止，别再做第三次。**~~ → **wave 125 把层级那一半做成了常驻档**（`depth`）：wave 99 的 0 是数据造成的（见 122/123/124），而 wave 124 那处缺陷**只有它看得见**。**第④类到此真正补完。**；
⑤ primitive 的默认值——**wave 127 量过了**：按 `data-slot` 比语义属性，73 个样本 **2519 行**（只在一边出现的 slot 名就有 62 个，两套 primitive 词汇表本来就不同），**信噪比太低，不做**，翻案判据见那一节；
⑥ 只在某种后端状态下才分叉的渲染路径——**wave 128 第一次接上**（`ParityState.routes` + `integrations#load-failed`），第一跑就量出上游重试 3 次而本仓 1 次；**wave 129 接上第二处**（`scheduled-tasks#load-failed`，同一条结论独立复现），并订正了 wave 128 写下的判据——**「上游词典里有没有这条 key」是错的判据，要看的是「上游有没有一段代码在这个分支上渲染出东西」**（`artifacts.loadFailed` 就是被它误判的那一条）；⑦ **这一屏压根没被取样**；
⑧ **焦点**（`document.activeElement`，见下）。

⑨ **伪元素**（wave 145 新增）：几何档取的是**元素**的 `getBoundingClientRect` 与
`getComputedStyle`，`::before` / `::after` 一律不在量程里。这不是理论问题——
上游 Tabs 的 `line` 档，**选中态整根下划线就画在 `::after` 上**
（`group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100`），
也就是说 wave 145 刚搬进来的那套 variant，**视觉主体没有任何一档在守**。
识别信号很干脆：负向验证时把它依赖的那个标记删掉（`group/tabs`），
**台账零反应**。

**wave 146 补上了**：只对已有锚点顺带取 `getComputedStyle(el, "::before"|"::after")`
的 `content` / `opacity` / 宽高 / 底色，不记位置。干净树上 0 行，
而那个 0 是**算出来的**（同一个 N2 变异当场让它报出 `w=56.7 h=2` vs `w=0 h=0`，
其余七档一行都没报）。整套里只有 4 个锚点样本碰得到它——不是取样面漏了，
是两个应用加起来用伪元素的地方只有九处——所以另配了一条形状断言
（`pseudoSamples >= 4`）挡住「尺子坏了→永远返回 none→静默 0 行」。
**这一类到此补完，别再做第三次。**

wave 20/21 连着两轮正面打了 ① 和 ⑦。**判据：一个域收工前，把它所有「点一下才出现」
的东西列出来，逐个问「这一屏进过取样面没有」。** 挂展开态很便宜：场景 id 受
`baseline/parity-scenario-coverage.json` 的棘轮约束，但**夹具与 steps 不受**，
直接挂现成场景，基线不用加记录。

**第八类：焦点——wave 28 记下、wave 94 已经补上，现在它进台账了。**
`document.activeElement` 不进 aria 快照、不是几何量、也不进请求，所以在 wave 94
之前「打开这一屏之后光标在哪」三档同时看不见，只能靠临时 probe 顺手加一行
（wave 28 正是这样发现建 agent 页与 composer 都少了 autoFocus，composer 那条 wave 29 做掉）。
**wave 94 把它做成 `ParityCapture.focus` + `DiffEntry.focus`**，一次量出 7 行，
其中最值钱的一条：本仓 settings 对话框有显式 `focusInitial`，**拿掉之后焦点会落到
对话框背后的 composer textarea 上**——那段代码挡的是一个真缺陷，不是「更好看」。

**wave 29 给第⑦类补了一条推论**：一屏「没被取样」可能不是因为没人写场景，
而是因为**上游在那一屏上不确定**——`chat-thread-init-ordering` 就是这样。
遇到这种，先量再决定，不要硬加；量出来的数字本身就是产出。

**wave 30 给第⑦类补了第二条，而且它比第一条常见**：一屏没被取样，可能是因为
**已有的那条场景在最后一步把它关掉了**。划词工具条挂了九轮「要一条新场景」，
真相是 `sidecar-chat` 的 steps 是 `select-text` → **click** → 等面板，
而两个应用都在那次点击里清掉选区。**判据：一个「点一下才出现」的东西如果还没进
台账，先去看已有场景的 steps 是不是刚好走过它又走开了；给现成场景加一步比新加
一条场景便宜得多，而且不动棘轮。**

---

## wave 65~66 做了什么：**全套跑一遍,三处红全部定性并处理**

用户要求「全面测试 frontend-vue」，14 项门禁串行跑完，**3 项红**。

### 红一：`e2e-mock` —— **是我 wave 62 埋的**（wave 65 修）

`i18n-theme.spec.ts:45` 报
`strict mode violation: getByLabel('复制到剪贴板') resolved to 2 elements`。
wave 62 给消息轮次的复制键补上可访问名之后，这一屏同名元素从 1 个变 3 个，
那条裸定位器能不能唯一**取决于轮次操作条那一刻渲染没渲染**。
**它在 wave 62 与 wave 64 两次全跑里都是绿的**——**绿过两次不等于它是对的。**

两颗同名按钮**不是缺陷**（上游 `artifact-file-detail.tsx:563` 用的也是同一句），
所以改的是定位器：`ArtifactPanel.vue` 的 `<header>` 加 `data-testid`，用例限定作用域。
变异实测（拿掉 testid → 当场红）+ `--repeat-each=6` **42/42**。

### 红二：`asset-budget` —— **一个测错了东西的门禁**（wave 66）

它报 `vendor-ui 728591 > 380000`，而注释写着这一格装的是 Reka 的那些 primitive。
**量出来：最大的两个 chunk（320 KB / 192 KB）一个匹配包都不含。**
根因是 chunk 名字按「chunk 里任意一个模块 id 命中」贴，而原来的种子里有
`lucide-vue-next|cva|clsx|tailwind-merge`——**几乎每个组件都 import**。

收窄种子（24→10 chunk）+ **删掉注释里那个做不到的承诺**（这一格是漂移警报，
不是字节归属；收窄之后仍有 4 个 chunk 两个标记都搜不到）+ 按实测重定预算。
新门禁 `chunk-buckets.test.ts` 钉「预算的桶 ↔ 命名规则的桶」双向对应。
**route-payload 复跑全绿——改名不动分组，用户下载的东西一个字节没变。**

### 红三：`audit` —— **逐条查可达性，结论是不动**（wave 66）

三个 high 全部不可达（`js-yaml` 0 个客户端 chunk；`nanoid` 要传自定义生成器；
`lodash-es` 的 `_.template` 注入，chevrotain 不这么用）。
**mermaid 那条有意不升**：上游经 `@streamdown/mermaid` 解析成 **11.12.2**，
本仓精确锁同一版**为的是两个应用画出同一张图**，而 mermaid 渲染直接进对照取样面。
单边升级台账当场分叉；两边一起升要覆盖被 vendored 的依赖树。
**归属方是上游，不是这个 fork。** 分诊写进 Makefile 与 README。

### 顺带

`asset-budget` 与 `audit` **此前不在任何一轮的门禁清单里**——和 `make coverage`
之前的处境一样。`asset-budget` 现在是绿的，已进清单；`audit` 预期红，分诊已记。

## 上一轮（wave 179）做了什么：**补上 Vue 缺的客户端兜底计时——中途被自己的单测骗过一次**

#9 的第③条：`text: Completed in <1s` 只在 React 出现。

### 先订正 wave 175 的判词

当时写的是「两边都有这条词条，所以是**取到的运行时长有没有值**的差别，**不是缺功能**」。
**是缺功能。** 两边 `core/messages/run-duration.ts` 逐字相同，差的在组件里：

- 后端把 `turn_duration` 写在 AI 消息的 `additional_kwargs` 里，
  但那要等这一轮**落库、再被历史查询取回来**才有值——刚跑完的这一轮拿不到。
- 上游 `message-list.tsx:339` 因此有一条**客户端兜底计时**：`thread.isLoading` 翻真记开始时间、
  翻假算出秒数存进 `clientDurationsByGroupId`，**先顶上**，等后端那个值到了再让位。
- 本仓的 `durations` 只是 `getRunDurationDisplaysByGroupIndex(groups)`，**没有这条兜底**。

Vue 其实已经有 `turnStartTime`（`RunActivity` 用它显示「跑了几秒」），
只是在下降沿**把它丢掉了**。改动就是「先量再清」，加一个 Map，渲染时后端优先。

### 中途被自己的单测骗了一次——这一段比修法本身重要

第一版照抄上游把键写成 `${threadId}:${group.id}`。**五条单测全绿，真应用一个字都不显示。**
探针在真应用里打了一条日志：

```
PROBE_FALLING_EDGE {"startTime":…,"threadError":"","threadId":"","groups":[["human","values-0"],["assistant","msg-ai-1"]]}
```

**下降沿那一刻 `props.threadId` 还是空串**，渲染时才是真 id：写进去的键是 `":msg-ai-1"`、
读出来找的是 `"<id>:msg-ai-1"`，**永远对不上**。
**又是 id 交接那一族**（wave 158「发送自己的 id 交接被当成换了会话」、
wave 175「三条请求各发两次」，这是第三例）。

上游那条键在它那侧成立，因为 React 一开始就把 threadId 生成好、从头到尾不变；
本仓这个组件的 threadId 是**交接过来的**。所以这里**有意与上游分叉**：
键只用 `group.id`，「换会话别复用上一轮秒数」改由一个 watch 保证——
**真 id 之间切换时清空，空串→真 id 是交接本身、不清**。

**为什么单测照不出来**：七条里前五条都在「threadId 从头到尾不变」的前提下跑。
补了第 6 条（threadId 在 run 跑完之后才交接过来）之后，把键改回上游写法它就红。

### 负向验证

七条用例、七次变异，各红对应的一条：撤回整份改动、兜底不让位、写入侧 `threadError`
判断删掉、落点找成 human 组、渲染侧 `threadError` 判断删掉、键改回上游写法、
删掉换会话清空的 watch。

**其中两次是被变异抓出「我的用例太松」才补的**：
- 把落点改成 human 组时，红的是「不会两个都画」而不是第一条——因为第一条只问了
  「页面上有没有 run-duration」，**没问它挂在哪儿**（每个组都会渲染 `durations[index]`）。
  现在第一条还要断言它的父节点里**不含**那条人类消息的文本。
- 把写入侧 `threadError` 判断删掉时四条全绿——渲染侧还有一道同样的判断兜着。
  补了第 4、5 条之后两道门各有各的用例。

**最后回真应用验了一次**：react `Completed in <1s`、vue `Completed in <1s`，两边一致。
**单测绿不算数，这一轮就是被它骗过一回。**

### 台账

**210 → 209**，只少 `ariaOnlyReact` 里的 `- text: Completed in <1s`。

### ④⑧⑨ 仍然开着，但量到了两件事

- **不是时序**：React 的编辑键在 +0.5s、+4.5s、hover、**以及刷新之后**都是 0，
  Vue 一直是 1。所以「刚提交完还没轮到」这条解释被否掉了。
- **三项候选被实测排掉**：`isMock` / `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` / `isUploading`
  都在 InputBox 的 `disabled` 表达式里，而提交前输入框是可用的 → 三项全假。
  `hasGoal` 也排掉（若为真，台账里会出现 goal 面板的行，没有）。
- **`getLatestEditableTurn` 与 `isTerminalAssistantTextMessage` 两边逐字相同**，
  所以差异只能来自**喂给它的消息形状**——
  **假设**：刷新后两边走的是不同的历史端点
  （React `/api/langgraph/threads/<id>/history`，本仓自己的那条），
  assistant 消息的「终态」判定因此不同。**这是假设，没验，下一轮把两边的消息数组 dump 出来比。**

### 顺带修了一条被这次改动照出来的过度断言

`e2e-stream/real-stream.spec.ts:143` 原来是
`await expect(items.nth(1)).toHaveText("Hello from DeerFlow!")`——
`items.nth(1)` 是 assistant 的**整个回合块**，而上游 `withRunDuration` 把正文和时长
包在同一个 div 里。补上兜底计时之后这一块变成 `Hello from DeerFlow!Completed in <1s`，
用例红了。**红得对，但断言本来就错**：它顺带断言了「这一块里没有别的东西」，
那从来不是这条用例要守的东西，而且上游也不成立。
改成 `toHaveText(/^Hello from DeerFlow!/)`——截断与重复照样挡得住——
并**顺手把时长钉成这一块里的另一个元素**（`getByTestId("run-duration")` 可见），
免得下次又被读成正文。

### 九门禁全扫（wave 179，2026-09-08）——上一次全扫是 wave 172

| 门禁 | EXIT | 说明 |
| ---- | ---- | ---- |
| `verify` | 0 | 272 files / **2237 tests** |
| `standalone-sim` | 0 | |
| `e2e-parity` | 0 | 99 条（accept 之后） |
| `e2e-mock` | 0 | 269 + 22 + 15 + 2 + 6 |
| `e2e-visual` | 0 | |
| `asset-budget` | 0 | |
| `e2e-backend` | 0 | |
| `icon-parity` | 0 | |
| `audit` | **2** | **预期红**：14 vulnerabilities（1 low / 10 moderate / 3 high），**与 wave 166 / 172 读数一致，没有新增** |

**八绿 + audit 预期红。**

- 改动只在 `frontend-vue/`，不需要 marker chore。

---

## 上一轮（wave 178）做了什么：**焦点丢了不是「重挂」，是有人给聚焦的控件置了 12ms 的 `disabled`**

wave 175 收 #2 那笔账时带出 9 行新台账，其中三行我自己标了「下一轮验」。这一轮去验。

### 先说我 wave 175 写错的那句

原话：「**假设**是 id 交接那一下 composer 重挂丢了焦点（与 wave 158 修的那处同族）。
**下一轮验，别直接当结论。**」

**实测把这个假设否掉了。** 在两个应用上各挂一枚探针：给 textarea 打一个 expando 标记、
挂 `focusin`/`focusout`（连 `relatedTarget` 一起记）、再用 `MutationObserver` 盯着
它自己和往上八层祖先的属性变化，然后跑场景的那两步（`fill` + `Enter`）。

| 量什么 | React | Vue |
| ------ | ----- | --- |
| 打标的那个 textarea 还在不在 | **在**，`removals: []` | 在 |
| 现在的 textarea 还是同一个吗 | **是**（标记还在） | 是 |
| focus 事件 | `focusout`，**`relatedTarget: null`** | **一个都没有** |
| 结束时的 activeElement | `body` | textarea |

**没有重挂。** `relatedTarget` 是 null 的 `focusout` 是「元素被弄成不可交互了」的形状，
不是「焦点移到别处」。接着盯属性，答案就在读数里：

```
textarea  disabled  null → ""    t=545ms
textarea  disabled  ""   → null  t=556ms
```

**`disabled` 只挂了 11~12 毫秒。** 给一个正被聚焦的控件置 `disabled`，浏览器当场把它失焦；
**摘掉 `disabled` 不会把焦点还回来**。键盘用户发完一条消息就落在 `<body>` 上。

那 12 毫秒是谁：`chat-page.tsx` 的
`disabled={... || (!isNewThread && isHistoryLoading)}`。wave 175 把 `useThreadHistory`
门控成 `enabled: !isMock && !thread.isLoading` 之后，这条查询**恰好在 run 结束那一刻**
第一次开跑（网络时序对得上：`/api/threads/<id>/messages/page` 542→547，锁 545→556）。

### 但这不是根因，触发条件才是引子

**根因是「用 `disabled` 去锁一个可能正被聚焦的输入框」**。换个触发条件同样会丢焦点。
于是按同形扫全仓——**扫出来的比 composer 多**：

| | React | Vue |
| --- | --- | --- |
| composer 草稿框 | `input-box.tsx`、`agents/new/page.tsx`、`sidecar-panel.tsx` | `ChatComposer.vue`、`AgentBootstrapComposer.vue`、`SidecarPanel.vue` |
| 其它会被打字的 textarea | `human-input-card.tsx` ×2、`message-list-item.tsx`（编辑消息框） | `HumanInputCard.vue` ×2 |
| 非 composer 的 textarea（定时任务、记忆设置…） | **一处动态 `disabled` 都没有** | 同 |

**九处，两边同构，零豁免。** 一张「这些可以留着 `disabled`」的表，记的只会是
「我们决定不修哪些键盘用户」（坑 180）。所以九处全改。

### 改法：`readonly` + `aria-disabled`，不是 `disabled`

`readonly` 挡住编辑、**保住焦点**、留在 Tab 序里；`aria-disabled` 照样播报「不可用」。
这也是 WAI-ARIA 对「要暂时不可用、又不想丢焦点」的标准答案。

代价要认：**readonly 的 textarea 收得到按键**，此前靠 `disabled` 顺带吞掉的东西现在要自己判。
逐处补上了：React 的 `handlePromptTextareaKeyDown`（历史翻页、斜杠面板）、
`handleTextKeyDown`（human-input 的提交快捷键）、编辑框的 Esc / Cmd+Enter；
Vue 的 `ChatComposer.onKeydown` / `submit()`、`SidecarPanel.onKeydown`、
`HumanInputCard.handleTextKeyDown`。回车提交那条路 React 本来就查
`submitButton?.disabled`（按钮仍然是 `disabled`），不用动。

顺带两件小事：两边 `Textarea` primitive 的基类各补
`aria-disabled:cursor-not-allowed aria-disabled:opacity-50`（**一字不差**，否则基类比对守卫会红），
锁住时看起来和以前一样；`showSkillSuggestions` / `showSuggestions` 的门控从
「只看 `disabled`」扩到整把锁——此前是 `disabled` 把 textarea 失焦、
`textareaFocused` 顺带变假才关掉的，现在焦点不走了，得自己说。

### 负向验证

- **修完再跑一次探针**：React `focus 事件: 无`、`activeElement: textarea`，
  `readonly`/`aria-disabled` 照常闪一下再摘掉——**锁还在，焦点不丢了**。两边一致。
- 两份新守卫（`frontend/tests/unit/a11y/textarea-lock.test.ts`、
  `frontend-vue/tests/guards/textarea-lock.test.ts`）各三条，各三次变异恰好红对应的一条：
  只加回 `disabled`（红第 2 条）、拿掉 `readonly`（红第 3 条）、扫描根指错目录（红第 1 条）。
- **剥注释是不是承重的，单独验了一次**：往一份 `.vue` 的注释里塞
  `<textarea :disabled="composerDisabled" />`，剥注释时绿（正确）、不剥时红（误报）。

> ⚠ **本轮抓到自己一次假绿，记下来**：第一次做「把 readOnly 改回 disabled」这个变异时，
> 我用 `grep -q "disabled={disabled}"` 确认变异生效——它绿了，我差点写成
> 「守卫抓不住」。实际上 perl 的替换**根本没落下去**，而那句 grep 命中的是文件里
> **本来就有的**提交按钮 `<PromptInputSubmit disabled={disabled} />`。
> **确认变异是否生效，要用 `diff`，不要用 grep 一个可能在别处也出现的字符串。**

### 台账

**211 → 210**，只少一行，正是 #9 里标着「下一轮验」的
`focus: React=body Vue=textarea`——现在是空数组。合法缩短，`make parity-accept` 直接过。

### #9 另外两条的进展

- **③ `Completed in <1s` 只在 React——根因查清了，而且我 wave 175 的判词说错了一半。**
  当时写的是「两边都有这条词条，所以是取到的运行时长有没有值的差别，**不是缺功能**」。
  **是缺功能**：React 在 `message-list.tsx:339` 有一条**客户端兜底计时**——
  `thread.isLoading` 翻真时记开始时间、翻假时算出秒数存进 `clientDurationsByGroupId`，
  在后端元数据到位之前先显示；Vue 的 `core/messages/run-duration.ts` 只会把
  **后端给的** `durationByRunId` 映到组下标上，**没有这条兜底**。
  这是 Vue 侧的功能缺口，**下一轮补**。
- **④⑧⑨ `Edit and rerun` 那一组仍然开着。** 这一轮只把差异缩到了具体的项上（**靠读代码，
  没有实测，别当结论**）：React 的 `canEdit` 比 Vue 多了
  `!isUploading`、`!branchThread.isPending`、`!hasGoal`、`!isMock` 与
  `Boolean(onEditAndRegenerateMessage)` 几项（`chat-page.tsx:358`），
  Vue 那边只有 `interactive !== false && !hasOpenHumanInput && editable?.humanMessage.id === message.id`。
  **下一轮用同一套探针实测是哪一项在这一刻为真**，再判哪边对。

- 提交：见下方门禁读数那一段。**动了 `frontend/`**（第二十五轮），marker 要另起 chore 推。
- 门禁：React `pnpm check` EXIT=0、`pnpm test` **1050 passed**、`pnpm test:e2e` **148 passed**；
  Vue `make verify` **271 files / 2230 tests 全过**、`make e2e-parity` 99 条、`make e2e-mock` **269 + 22 + 15 + 2 + 6 全过**。

---

## 上一轮（wave 177）做了什么：**自审判成「不是根因」的那一条，重现没拿到，但补上了另一半**

上一步的自审（`docs/plans/vue-parity-fix-audit-2026-09-08.md`）把 16 处修改分了三档，
其中**只有一条被判成「不是根因」**：wave 171——前端镜像里装着 macOS 的原生二进制。
这一轮就去啃它。

**先量，不推断。** 四条实测：

| 量什么 | 读数 | 说明什么 |
| ------ | ---- | -------- |
| `.dockerignore` 排除 `node_modules` 从哪天起 | **2026-02-09**，早于事故七个月 | 「宿主机的树被 COPY 进去」这条路早就堵死 |
| 2026-08-23 的生产镜像 `deer-flow-frontend:latest` 里是什么 | `lightningcss-linux-arm64-**musl**` | **同一份 Dockerfile、早于我介入，产出是对的** |
| 今天重建的两个前端 | react → `-musl`、vue → `-gnu` | 各自拿到**正确的 libc 变体**（Alpine vs bookworm-slim），不是缺陷 |
| 坏层还在不在 | 不在——我自己 `--no-cache` 重建冲掉了，dangling 里最近的是 6 月的 | **重现取不回来了** |

**所以「构建本身会产出 darwin 包」这个猜想被否掉了。** 我没有编一个根因出来顶上。

**但有一件事是能解释、也能修的**：那一层**被永久缓存**。`dependencies` 阶段的输入只有
`package.json` 与 `pnpm-lock.yaml`；这两个文件不变，**同一棵树就会被永远发下去，
没有任何东西复核它**。这解释不了它当初怎么产生，但解释了**它为什么能活一个月**。

于是补上构建期这一道，和 wave 171 的启动期那道配成一对：

| 挡在哪 | 做了什么 | 挡住的是 | 为什么另一道挡不住 |
| ------ | -------- | -------- | ------------------ |
| **构建期**（本轮） | 两份 Dockerfile 在 `pnpm install` **之后**扫 `node_modules/.pnpm`，撞见 `*-darwin-*` / `*-win32-*` 就 `exit 1`，报错逐字给出 `--no-cache` 修法 | 坏树被**烤进**镜像 | 启动期那道是**事后**才发现，镜像已经发出去了 |
| **启动期**（wave 171） | `docker/node-entrypoint.sh` 同样的扫描，撞见就**拒绝启动** | **已经缓存**的坏镜像被**启动** | 构建期这道**对已缓存的层根本不会重跑** |

**负向验证**：构建期那条实测把一次真实构建打到 `BUILD_EXIT=1`，报错原文对得上；
用例三次变异（拿掉自查 / 挪到 `install` 之前 / 拿掉修法指引）**各红一条**。

**其中「挪到 install 之前」那次第一版没抓住**——Dockerfile 注释里写着
「pnpm install**s** exactly the optional platform package」，`text.index("pnpm install")`
找到的是**那句散文**，于是变异后断言照样绿。剥注释后才转红。
**同一个坑（扫描前先剥注释）这一天撞了四次**（坑 202/316）。

**档位不变，仍然是「不是根因」**：现在是产不出来、也启动不了，
但**没人知道它当初是怎么来的**。自审文档已就地更新，写清「能拦住 ≠ 查清了」。
**下一次若再出现，先 `docker save` 那个镜像再动手**——那是拿到重现的唯一机会。

- 提交：`06beaf48`（`frontend/Dockerfile`、`frontend-vue/Dockerfile`、
  `backend/tests/test_node_entrypoint.py`、自审文档）。
- 门禁：backend 整套 **11354 passed / 72 skipped，exit 0**；
  两个前端镜像重建（`BUILD_EXIT=0`）并重建容器后，react 200（0.13s）/ vue 200（0.02s）/ gateway 200。

---

## 上一轮（wave 176）做了什么：**落地页那条抖动的真根因——一块全屏 shader 跑在软件光栅化上**

wave 174 给 GitHub 那个 fetch 加超时之后，`landing.spec.ts:61` 连绿四次，我以为结了。
**它又红了。** 这一轮不再绕，把 wave 160 量到、又被我两次搁置的那个性能问题查到底。

### 两层根因

**第一层：装饰性全屏 shader 没有分辨率上限。**

```js
const scale = 1;
renderer.setSize(ctn.offsetWidth * scale, ctn.offsetHeight * scale);
```

1366×768 是 1.05 Mpx，3930×1650 是 **6.5 Mpx**——每帧片元成本随视口面积无上限增长，
正好对上 wave 160 量到的长任务 122ms → 786ms（6.4 倍）。
封顶到 ~2.07 Mpx（`renderer.dpr` 是对的旋钮：ogl 用参数定 **CSS 尺寸**、用 dpr 定
**后备缓冲**，所以元素照旧铺满容器，只是画得粗一点——星云渐变没有边缘可丢）。

**但封完顶还是 308ms。** 说明小视口下**也**有东西在满负荷烧主线程——于是有第二层。

**第二层（真正的那个）：这个浏览器的 WebGL 是软件渲染的。**

```
webgl renderer = ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader driver)
```

**每一个片元都由 CPU 逐帧算，永不停止。** 有硬件加速时这是 GPU 的活，主线程几乎无感；
落到 SwiftShader / llvmpipe 就变成一个被占满的核。

**这不是「测试环境的问题」**：远程桌面、虚拟机、GPU 被拉黑的浏览器、老机器，
落到的都是同一条回退路径——那里的用户为一张没人要求过的背景图付出整页卡顿。
无头浏览器只是**最容易观察到**的那个场景。

修法：检出软件渲染就不跑这个特效，走这份文件**已经写好的**「没有 WebGL 就不画」那条路。

### 读数

| 视口 | 修前 evaluate 中位 | 封顶后 | 再加软渲染检出 |
| --- | --- | --- | --- |
| 1366×768 | 123ms（长任务 16 次 / 2007ms） | 123ms | **9ms（长任务 0 次）** |
| 3930×1650 | **749ms**（最长 786ms） | 308ms（最长 403ms） | **54ms（最长 63ms）** |

`landing.spec.ts` 连跑 **3 次全绿**；整套 e2e 连跑 **2 次 148 passed**；单测 1047。

### 订正我自己

- wave 160 把这一屏的读数记下来了，但**判成「对齐范围外，不修」**——
  那个判断把「谁的页面」和「谁的缺陷」混为一谈了。
- wave 174 说 GitHub 超时修好了这条抖动，**证据是连绿四次**——
  **四次绿不足以证明一个负载相关的抖动没了**。真根因还在下面。

---

## 上一轮（wave 175）做了什么：**挂了 146 轮的那条账收了——判据一个字没改**

`chat-thread-init-ordering` 的 `requests` 那一半。wave 159 已经查到根因，
但我**两次判「风险大于收益」搁置**，理由是「要给取数放行条件加运行生命周期依赖，
四条失败路径都得配用例」。**这一轮把那个理由本身推翻了。**

### 它不是竞态，是重复

`onStart` 一把 id 交出去，就把 history / token-usage / metadata 三个查询挂上并立刻取；
而 `onFinish` 又把同一批 key 失效一次。**同一个逻辑事件被两个独立机制各触发一次取数。**
竞态只决定 React Query 有没有恰好去重——实测 invalidate 落在第一次 fetch 之后
**+7ms 被去重（一轮）、+16ms 真重取（两轮）**。

**去掉哪一次：`onStart` 那一次。** 它取的是一轮**正在跑的** run 的历史与用量，
随即被 `onFinish` 覆盖——而两个终态的 `aria` **此前就逐字相同**，
也就是说**那一轮取数没有任何可观察效果**。这不是推断，是 wave 158 已经量过的读数。

### 四条失败路径不用手搓标志去数

用 SDK 自己维护的 **`thread.isLoading`**（「有一轮 run 正在流」）：
**报错、用户 stop、正常结束三条路都走同一个翻转**；运行中刷新页面是全新一次挂载，
本来就没有 run 在流。**我前两轮否掉的是「手搓一个标志再逐条堵四个出口」——
那个理由成立；但换成 SDK 已经维护好的信号之后，四个出口是同一个。**

两处，都要挪到 `useStream` 之后才拿得到那个信号（**先验过中间没有别人用它们的结果**）：

- `chat-page.tsx`：`useThreadTokenUsage` / `useThreadMetadata`
- `hooks.ts`：`useThreadHistory`（第一次只改前两个时，`messages/page` 仍在飘——
  **三条差异降到一条**，正好指出漏了哪个）

### 读数

| | 修之前 | 修之后 |
| --- | --- | --- |
| react `aria` | 1 个终态 | 1 个 |
| react `requests` | **2 个**（17/3、14/6） | **1 个 ×20，连取两轮都是** |
| vue 两档 | 1 个 | 1 个 |

**判据「同一次构建连取 20 次，React 只出现一个终态」达成，一个字没改。**
场景已注册进对照套件，棘轮 `pending` 清空（covered 24 → 25）。

### 代价：台账多了 9 行

新场景进套件带出 **9 行**（wave 158 试注册时是 12 行，少的 3 行正是这次修掉的请求）。
**这 9 行不是这一轮改出来的，是这一屏第一次被照到。** 逐条判词写在一页纸清单第 9 条：
两条播报器差异（框架管道，接受）、两条请求次数差（与 wave 102 同族，接受）、
**三条要下一轮验**（`Completed in <1s` 只在 React、`Edit and rerun` 那一组三行、焦点落点）。
台账 202 → **211 行**，走 `PARITY_ACCEPT_GROW=1`。

---

## 上一轮（wave 174）做了什么：**落地页那条抖动查了六轮，根因是一个没有超时的外部 fetch**

wave 173 把 Vue 那侧「拆 context 超时」查成「用例真的在出网」之后，按规矩扫同形问题。
**扫到了 React 那条挂了六轮的 `landing.spec.ts:61`。**

### 扫描本身先踩了一次坑

第一版扫描是「同一行里既有 `fetch(` 又有 `https://`」——**报了零处**。
而我明明知道有一处。**因为 URL 在下一行**（多行调用）。
**（线索 339：扫「调用」就要按调用扫，不能按行扫。）**
改成从每个 `fetch(` 走到它配平的右括号再看整段之后，全集出来了：

**两个应用加起来，对外部主机的 `fetch` 只有一处** ——
`frontend/src/components/landing/header.tsx:95`，取 GitHub 的 star 数。
其余十几个外部 URL 全是链接 `href` 或分享地址常量，没人 fetch。

### 根因

那一处**没有超时**：

```tsx
async function StarCounter() {
  let stars = 10000;              // 兜底值，已经写好了
  try {
    const response = await fetch("https://api.github.com/repos/bytedance/deer-flow", {
      next: { revalidate: 3600 },
    });
```

`try/catch` 接得住**报错**，接不住**「一直不返回」**。
而它在一个 **async Server Component** 里——所以卡住的不是那颗 star 徽章，
**是整个 `/` 的响应**。

未认证的 GitHub API 是**每 IP 每小时 60 次**；`landing.spec.ts` 有 7 条用例、
每条都载入 `/`，一个下午跑十来次 `test:e2e` 就打满了。

**这也订正了我自己前几轮的归因**：wave 160 量到那一屏空 `evaluate` 往返中位 749ms
（3930 宽），那个读数是真的，但**它不是抖动的扳机**——扳机是这个网络停顿。

### 修法与读数

`signal: AbortSignal.timeout(3000)`。兜底值 `10000` 本来就是「读不到时该显示什么」的设计答案，
超时直接走它。

**默认 workers 下连跑四次全绿：**

| | 修之前（本 session） | 修之后 |
| --- | --- | --- |
| `pnpm test:e2e` | **6 跑红 4 次**，每次都是 `landing.spec.ts:61` | **4 跑全绿，148 passed** |

### 守卫

`frontend/tests/unit/styles/external-fetch-timeout.test.ts`：
**凡是 fetch 外部主机，必须带 `signal`。** 零豁免（全集就 1 条）。
扫描按**调用**走（从 `fetch(` 到配平右括号），并先剥注释。

三次变异：拿掉超时 → 红；扫描面指向不存在的目录 → exit 1；
**只在注释里写一个外部 fetch → 绿（正确）**。

### 这一轮和上一轮是同一件事

Vue 那侧是**浏览器里**的一跳出网（弹窗导航到 `open.feishu.cn`），
React 这侧是**服务端**的一跳出网（Server Component fetch GitHub）——
**两条都是「用例的成败取决于一台我们不控制的服务器」**，
只是一条能用 Playwright 路由拦住，另一条只能靠超时。

---

## 上一轮（wave 173）做了什么：**那条「抖动」不是抖动——四条用例会真的去访问外网**

wave 172 全扫时 `e2e-mock` 首跑红了四条，全在 `integrations.spec.ts`，
形态一样：`Tearing down "context" exceeded the test timeout of 30000ms`。
当时记的是「一次红两次绿，形态像资源竞争，翻案要拿一次能复现的红」。

**这一轮不等下一次红，直接去比耗时。**

| 用例 | 绿的那次 | 红的那次 |
| ---- | -------- | -------- |
| falls back when copying a Lark authorization link… | **1.7s** | **58.8s** |
| keeps selected permissions when re-registering… | **2.6s** | **1.0m** |
| can switch the Lark app by entering new credentials | **3.4s** | **59.7s** |
| can install the Lark integration skill pack… | **3.8s** | **1.0m** |

**20~35 倍，四条一起。** 这不是负载渐变——**是一个外部依赖有时挂住**。

### 根因

`IntegrationsSettings.vue:345/362`：Lark 授权流程先 `globalThis.open("about:blank")`，
再把那个弹窗导航到 `result.verification_url` ——
mock 里给的是 **`https://open.feishu.cn/auth/mock-device`**，
而**套件里没有任何 route 盖住这个域**。

于是这四条用例**真的会去连 open.feishu.cn**：连得上就 2 秒，连不上就 60 秒，
拆 context 时还挂在那一跳上 → 超 30 秒预算。

**为什么只有这四条**：通过的三条（`:47/:59/:184`）根本不走 auth/start 那条路。

### 修法

`mockLangGraphAPI` 里加一条**离开本机就地答掉**的拦截。三处判据都是有理由的：

1. **装在 `page.context()` 上，不是 `page` 上**——**弹窗是同一个 context 里的另一个 page**，
   `page.route` 盖不到它，而出问题的正是弹窗那一跳。
2. **`fulfill` 而不是 `abort`**——那几条用例断言 `popup.url()` 变成了那个地址；
   abort 会让导航失败、URL 停在 `about:blank`，那是**用改判据换绿**。
   fulfill 之后可观察行为不变（地址真的换了），只是不出网。
3. **记下拦到过什么**（`offMachineRequestsSeenBy`），并在用例里断言那一跳确实发生过。
   否则这条拦截会变成一个永远不响的摆设，而且**没人分得清「拦住了」和「压根没请求」**
   （坑 131 的形状）。

### 负向验证

| # | 变异 | 结果 |
| - | ---- | ---- |
| 1 | 整条拦截去掉（回到事故前） | 红 1 条 |
| 2 | 拦截留着、只把记录关掉 | 红 1 条 |
| 3 | 还原 | 7 passed |

**第 1 条只红了一条**——其余三条那一刻外网是通的，**正好印证这条抖动的性质**：
它的红与不红取决于一台我们不控制的服务器。

### 读数

`integrations` 那四条回到 **1.3~9.5 秒**；`e2e-mock` 全组 269+22+15+2+6 全绿；
`verify` 270 文件 / 2227 单测 exit 0。

**这条抖动从「待复现」变成「已根治」**，而且顺带把整套 mock e2e 的网络依赖切断了——
40 个 spec 都走 `mockLangGraphAPI`，从此谁想出网都会被就地答掉。

---

## 九门禁全扫（wave 172，2026-09-08）

距上一次全扫（wave 166）过了 5 轮，按批次规则补一次。**八绿 + `audit` 预期红 14**，
外加一条**新记的抖动**（见下）。

| 门禁 | 读数 | exit |
| ---- | ---- | ---- |
| `verify` | **270 文件 / 2227 单测** | 0 |
| `standalone-sim` | 跑过 15 条 / 未跑 5 条 / 红 0 | 0 |
| `e2e-parity` | **98 passed**，台账 **90 样本 / 202 行** | 0 |
| `e2e-mock` | **首跑 4 failed / 265 passed**，见下；单独复跑两次都是 **269 passed** | 0（复跑） |
| `e2e-visual` | 8 passed | 0 |
| `asset-budget` | — | 0 |
| `e2e-backend` | 2+5+2+3+3+5+1+1 | 0 |
| `icon-parity` | 共 0 处待核、0 条 ⚠ | 0 |
| `audit` | **预期红 14 条** | 2 |

### 新记一条抖动：`integrations.spec.ts` 的 context 拆除超时

首跑那次红的四条**全在 `tests/e2e/integrations.spec.ts`**，而且**四条的失败形态一样**：

```
Tearing down "context" exceeded the test timeout of 30000ms.
Error: browserContext.close: Test ended.
```

**不是断言失败**——是拆 browser context 超过 30 秒。单独复跑**两次都是 269 passed**。

**如实记法**：一次红、两次干净复现绿，形态是资源竞争而不是产品失败。
**没有把它判成「环境问题」就算了**——它与 React 那侧的 `landing.spec.ts:61`
是同一族（都是「某个操作在负载下超过 30 秒」），两条都记在这里。
**要翻案就拿一次能复现的红来翻**，别拿「我这次跑绿了」。
> ⚠ **wave 173 已翻案，而且不是靠再红一次**：直接比耗时（绿 1.7~3.8 秒 vs 红 58.8 秒~1 分钟）
> 就看出是外部依赖。根因与修法见上一节。

**这一轮我自己踩了一次并发**：想复跑 `e2e` 时 `e2e-backend` 还在跑（`pgrep` 当场看到），
那次 `RETRY=2` 是撞车不是门禁红——**线索 335 的第三次**。复跑前先 `pgrep -f "playwright test"`。

---

## 上一轮（wave 171）做了什么：**React 容器答了十小时之后开始 500——镜像里装的是 macOS 的原生二进制**

wave 170 收尾时例行检查服务，发现 `http://localhost:2026` **120 秒都不返回**
（Vue 与 Gateway 都正常）。

### 一路量下来

```
nginx 日志          GET / 499        ← 是我的 curl 自己超时断开，不是服务返回错误
frontend 容器日志   Compaction failed: Another write batch or compaction is already active
                    （无限刷屏 —— Turbopack 持久化缓存卡死）
重启容器之后        GET / 500
                    Error: Cannot find module '../lightningcss.linux-arm64-musl.node'
```

`lightningcss` 是 Tailwind v4 用的**原生二进制**。容器是 **Alpine/arm64**，
需要 `lightningcss-linux-arm64-musl`；而它 `node_modules` 里装的是
**`lightningcss-darwin-arm64`——macOS 的构建**，那一族里没有别的。

**这不是我这几轮改 CSS 改坏的**，几条证据：

- 容器**没有任何挂载**（`docker inspect .Mounts` 为空）——`node_modules` 烤在镜像层里。
  往宿主机 `node_modules` 里放标记文件，容器里看不到。
- 容器 `.pnpm` **1087 个条目，与 macOS 宿主机同数**；那个包目录的时间戳是 **8 月 4 日**，
  比 10 小时前那次 `--build` 早一个月 → **Docker 复用了缓存的 `dependencies` 层**
  （它的输入 `package.json` / `pnpm-lock.yaml` 一直没变）。
- **锁文件里是有 `lightningcss-linux-arm64-musl` 的**（`pnpm-lock.yaml:4270`），
  所以不是锁文件的问题。

**为什么藏了十小时**：那个原生模块只在 Tailwind **冷编译** `globals.css` 时才加载。
dev server 的编译缓存把之前所有请求都答掉了——**直到容器重启**。

### 修法

立即恢复：`docker compose build --no-cache frontend` + `up -d --force-recreate`。
重建后容器里是 `lightningcss-linux-arm64-musl@1.30.2`，React 200（85ms）。

**durable 的那一半**：新增 `docker/node-entrypoint.sh`，两个前端容器都从它启动。
它在起 dev server 之前扫一遍 `node_modules/.pnpm`，
**发现 `*-darwin-*` / `*-win32-*` 平台包就拒绝启动**，并打出确切修法。

**为什么是「拒绝启动」而不是「就地自愈」**——与后端 `.venv` 那条正好相反，
两条的判据都写在各自脚本头里：

| | 后端 `.venv`（`3ec1f496`） | 前端 `node_modules`（本轮） |
| --- | --- | --- |
| 住在哪 | **命名卷**，从镜像只填充一次 | **镜像层** |
| 自愈行不行 | 行，而且只能这样——卷永远不自己纠正 | **不行**：下次 `up --build` 就冲掉，还会掩盖坏镜像 |
| 所以做法 | 清空 `.venv` 就地重建 | **拒绝启动 + 给出 `--no-cache` 指引** |

### 两条现成守卫响了，而其中一条**比它自己的意图严**

- `test_agents_md_topology` 与 `test_dual_frontend_production_ingress` 的三条：
  它们用**子串**匹配钉住 `command`，我改成 YAML 列表就红了。
  钉的意图没变，**换成字符串形式**即可，一行不用动它们。
- `test_development_compose_uses_one_watch_path_for_both_frontends`
  断言 `"volumes" not in react`——**意图是「源码走 Compose Watch，别 bind-mount 源码」**
  （bind-mount 源码正是那两条轮询监听环境变量存在的原因），
  但我加的是一个**只读单文件**脚本挂载，gateway 一直就是这么挂 `dev-entrypoint.sh` 的。
  **没有给它加豁免**（坑 180），而是把断言改成表达意图本身：
  挂载可以有，但必须只读、必须是单个 `.sh`、不许指向仓库里的应用目录。
  两次变异验过：把源码 bind-mount 进去→红；把脚本挂载改成可写→红。

### 负向验证

平台自查 4 次（本平台包 ok / darwin 红 / win32 红 / 连 `.pnpm` 都没有也红），
接线 4 次（去掉 darwin 分支 / 让空目录算 ok / 把 command 改回裸 `pnpm run dev` /
从报错里拿掉 `--no-cache` 指引），各红一条。
另在**真容器里**喂一棵坏树，脚本 exit 1 并指名那个包。

后端整套 **11352 passed / 72 skipped，exit 0**。

---

## 上一轮（wave 170）做了什么：**wave 167 那张缺口表的最后一条：👋 不会挥手**

wave 167 量出三条 Vue 缺的动画，wave 168 证明 `bouncing` 那条其实是**上游死代码**，
wave 169 补了骨架屏那条。**剩下 `wave` 这一条**——上游欢迎页的 👋 会挥两下，本仓的不会。

上游的做法是一个**模块级**的 `let waved = false`，在 `useEffect` 里置 true：
整个页面生命周期只有第一次挂载会挥。本仓照同一套语义
（模块级 `hasWavedOnce` + `onMounted` 置位），keyframes 与 `0.6s ease-in-out 2` 逐字照抄。

**两边同时套上 `motion-safe:`**——0.6s×2 的纯装饰动作，减动偏好下不播；
表情本身照常渲染，收住的只是动作。只给一边加会造出新的分叉，
所以这一条和前三轮一样是两边同改。

它是**有限次数**（2 次）的动画，所以不进 `looping-animations` 声明表；
起点也不透明，`animation-visibility` 那条判据不适用。

**至此 wave 167 那张表全部结清**：`aurora` / `shine` / `fade-in-up` / `skeleton-entrance` /
`wave` 两边一致，`fade-in` / `loading-bar` / `suggestion-in` / `bouncing` 四条死条目已删。

**踩到两次并发撞车**（都是我自己的操作，不是门禁问题）：
`pnpm test:e2e` 与 `make e2e-parity` 同时跑 → `Another next build process is already running`；
`make e2e-mock` 与 `make e2e-parity` 同时跑 → `Another Nuxt build is already running`。
**这两套门禁都要独占构建，只能串行。**

---

## 上一轮（wave 169）做了什么：**历史加载那一屏，两个应用各缺一半**

wave 167 量出的最后一条实质缺口：历史加载时上游画一整块骨架屏
（`message-list.tsx:926`，`thread.isThreadLoading && messages.length === 0`），
本仓只有一行居中的灰字。**没有任何地方判过这件事**，而且
**上游根本没有 `loadingConversation` 这条词条**——那行文字是本仓自己发明的。

### 判断：不是「谁抄谁」，是两边各缺一半

| | 上游 | 本仓 |
| --- | --- | --- |
| 视觉 | 骨架屏（保住布局，内容到达时不跳） | 一行灰字（内容到达时整屏跳一下） |
| 读屏器 | **完全无声**（骨架是纯视觉占位） | 念得出「正在加载会话…」 |

按主流做法，这两件事本来就该同时有：**骨架屏 + `role="status"` 的可访问播报**。
所以两边同改，各补对方缺的那一半。

### 顺手修掉的：上游那两个不是 ARIA 角色

```jsx
<div role="human-message" …>
<div role="assistant-message" …>
```

**ARIA 的角色词表是固定的**，这两个不在里面——浏览器直接丢掉，元素照样是 generic。
而且**没有任何地方查询它们**（grep 过 `frontend/src`、`frontend/tests`、`frontend-vue`）。
两边都改成 `data-slot`：不声称一个交付不了的语义。

### 做了什么

- **上游**：外层加 `role="status"` + `aria-busy`，播报文案放在一个 `sr-only` 子元素里
  （**活动区播报的是内容变化，不是它的 `aria-label`**）；两处非法 role 换成 `data-slot`；
  新增 `conversation.loadingConversation` 词条。
- **本仓**：从零补一条 `ui/skeleton` primitive（类名与 `data-slot` 逐字照抄上游），
  再补 `MessageListSkeleton.vue`——结构、宽度、60ms 错峰、keyframes 全部照抄，
  最后接进 `MessageList.vue` 顶掉那行灰字，文案沿用本仓既有的词典键。

`skeleton-entrance` 的 keyframes 我第一版写成了 `scaleX(0.6)`，上游是 `scaleX(0)`——
**照抄就要逐字照抄**（wave 167 aurora 那条教训），当场改正。

### 四条守卫按设计响了，一条不落

`make verify` 一次红了四条，全是这次改动应该触发的：

| 守卫 | 它要什么 |
| ---- | -------- |
| `architecture` L2 集合 | 新增的 `ui/skeleton/*` 要登记进 `l2Files`（**而且按字母序**——我第一次插在 `sidebar` 前面，它当场又红一次：`sidebar` < `skeleton`） |
| `doc-facts` | `I18N_INVENTORY.md` 里的 SFC 数要跟着走（221 → 223） |
| `i18n source-guard` | 产品 SFC 计数 219 → 221 |
| `upstream-key-coverage` | 上游新增的 `conversation.loadingConversation` 在本仓叫 `messages.loadingConversation`，要写进 `ALIASES` |

**这四条正是「加一个组件」应该惊动的全部东西**——没有一条是误报，也没有一条漏报。

---

## 上一轮（wave 168）做了什么：**同形缺陷全仓扫一遍，扫出第二处，并把这一类锁住**

wave 167 修掉「建议芯片的可见性挂在动画上」之后，按规矩系统扫同形问题。

### 扫出第二处，一模一样

`workspace/messages/skeleton.tsx` 的 `SkeletonBar`：

```jsx
className="animate-skeleton-entrance fill-mode-[forwards] …"
style={{ opacity: 0, ...style }}
```

**同一个写法**：`opacity: 0` 是元素自己的静止态，靠 `forwards` 把动画终点留住。
而这块骨架屏是**历史加载时整屏的内容**（`message-list.tsx:926`，
`thread.isThreadLoading && messages.length === 0`）——动画一旦被跳过，
用户看到的是**一片空白**，不是「正在加载」。

修法与上一轮同：`--animate-skeleton-entrance` 的 `forwards` → **`both`**，
去掉内联 `opacity: 0` 与那个重复的 `fill-mode-[forwards]`，再套 `motion-safe:`。

### 顺手：第四条死代码

`workspace/streaming-indicator.tsx` **零消费者**——整个组件是死的。
它是 `--animate-bouncing` 唯一的使用者，所以那条主题条目也跟着是死的。
两个一起删。**上游的 `--animate-*` 从 9 条降到 5 条**（wave 167 删了三条，这一轮第四条）。

**订正 wave 167 的说法**：我当时把 `bouncing` 记成「本仓没有对应组件的缺口」——
不对，**上游那个组件本身就没人用**，谈不上缺口。

### 判据：怎么锁住这一类

想过扫调用点（「class 串里既有 `animate-` 又有 `opacity-0`」），但**人肉扫的时候
正是这一招漏掉了第二处**——那里的 `className` 与 `style={{opacity:0}}` 隔着几行，
grep 关联不起来。

**所以判据钉在声明上，而且是纯静态的**：

> **`0%` / `from` 帧把 `opacity` 设成 0 的动画，声明里必须有 `both` 或 `backwards`，
> 不许只有 `forwards`。**

因为 `forwards` 只保住最后一帧，错峰入场需要的 `animation-delay` 期间没人画第一帧，
**调用方只能自己把元素藏起来**——根因就在这里。零豁免：
今天全集 5 条，起点透明的两条都已是 `both`，另外三条根本不从透明开始。
第二条用例再补上调用点那半边（同一串 class 里不许既有 `animate-` 又有 `opacity-0`），
两个方向都堵住。

两边各一份：`frontend/tests/unit/styles/animation-visibility.test.ts` 与
`frontend-vue/tests/guards/animation-visibility.test.ts`。

### 负向验证：Vue 那份**第一跑就被自己抓了**

第三条用例当场红，指着 `WelcomeSuggestionList.vue` ——**里面那句写着
`animate-fade-in-up + opacity-0 + forwards` 的注释**，是 wave 167 我自己写下来
解释这条规则的。**「扫描前先剥注释」这一天里撞了第三次**（坑 202 / 316）。
两份守卫都补上剥注释，并各留一条用例专门验「剥注释没剥过头」。

| # | 变异 | React | Vue |
| - | ---- | ----- | --- |
| 1 | 起点透明的动画改回 `forwards` | 红 | 红 |
| 2 | 给 class 串加回 `opacity-0` | 红 | 红 |
| 3 | 只在**注释里**写那串字 | — | **绿（正确）** |
| 4 | 扫描面指向不存在的目录 | 红（`failedFiles: 1`，exit 1） | 红 3 条 |

**第 4 条 React 那侧要小心**：计数是 `0 passed / 0 failed`，
**「一条用例都没跑」和「全绿」在计数上长得一样**——是查退出码才确认它真红的。

---

## 上一轮（wave 167）做了什么：**取样上下文钉死 `reduce`，于是两个应用在 `no-preference` 下的动画从没被比过**

`PARITY_CONTEXT_OPTIONS` 把 `reducedMotion` 钉死成 `reduce`，注释给的理由是
「否则第一层比对会被时区、**动画中间帧**和配色方案淹没」——**理由成立**。
但它覆盖的是「为什么不在那儿取样」，**不是「两个应用在那儿一不一致」**。
而 `animation-duration/timing/iteration/direction/fill` 是**声明**，不随帧变，可以比。

在 `no-preference` 下取一次**动画声明**（不是帧），当场两条：

```
chat 那一屏     React 7 条带动画   Vue 1 条
subtask-card    React 8 条         Vue 8 条（逐字相同）
```

### 一、aurora：Vue 是「重新实现」而不是「照抄」

```
React  name=aurora        dur=10s  timing=ease-in-out  iter=infinite  dir=alternate
Vue    name=aurora-shift  dur=10s  timing=linear       iter=infinite  dir=normal
```

上游 `@keyframes aurora` 有**五个停点、而且带 `transform: rotate(±5deg) scale(0.9~1.1)`**；
本仓那条 `aurora-shift` 只是 `background-position` 从 `0% 50%` 线性走到 `200% 50%`。
时长一样，**动的东西根本不是一回事**：一个是缓入缓出的来回摆动加缩放，一个是匀速单向平移。

**根因是「重新实现」**——本仓对 `ambilight`、`shine` 走的都是逐字照抄。
修法：keyframes 与三个参数按上游写，减动分支不变。

### 二、`fade-in-up`：上游把可见性挂在了动画上（两边同改）

上游 `ai-elements/suggestion.tsx` 给每个建议芯片套一层
`className="animate-fade-in-up max-w-full opacity-0"`，配 `animation-fill-mode: forwards`
和错峰 `animationDelay`。

**`opacity-0` 是元素自己的静止态。** 错峰延时期间靠它保持透明——
于是**动画一旦被跳过（减动分支、打印、跳过动画的浏览器），那几颗芯片就永远看不见**。
本仓 FlipDisplay 的注释早写过同一条教训（「稳定态写成静态样式，不靠动画的 fill-mode」）。

**根因修法（企业主流做法）**：`forwards` → **`both`**，并把 `opacity-0` 从元素上去掉。
`both` 里的 `backwards` 负责延时期间那一帧，视觉逐帧不变，
而元素自身的静止态变回可见。**有了这一条，才敢做下一步**：
给它套 `motion-safe:`——0.15s 的装饰性入场正是减动偏好要跳过的东西。

**Vue 此前一处都没有**，这一轮补上（scoped 样式，参数与常数照上游：`250 + index*60` ms）。
**不跟的仍然不跟**：上游那层 `Suggestions` 是个永不滚动的 ScrollArea，
一页纸清单第 6 条判过「不跟」，这一轮只补动画那一半。

### 三、顺手扫出三条死主题条目

按 `--animate-*` 全集逐条对消费者：

| | React 用在哪 | Vue |
| --- | --- | --- |
| `aurora` | `ui/aurora-text.tsx` | ✓（本轮对齐） |
| `shine` | `ui/shine-border.tsx` | ✓ |
| `fade-in-up` | `ai-elements/suggestion.tsx` | ✓（本轮补上） |
| `bouncing` | `workspace/streaming-indicator.tsx` | ✗ **本仓没有这个组件** |
| `skeleton-entrance` | `workspace/messages/skeleton.tsx` | ✗ **本仓没有这个组件** |
| `wave` | `workspace/welcome.tsx` 的 👋 | ✗ |
| **`fade-in`** | **0 个消费者** | — |
| **`loading-bar`** | **0 个消费者** | — |
| **`suggestion-in`** | **0 个消费者** | — |

后三条是**死 CSS**，按主流做法删掉（变量 + keyframes 共 566 字节）。
**顺带订正我自己**：wave 163 的交接文档里写着「`loading-bar` / `bouncing` 是状态指示，
有意留着不门控」——`bouncing` 对，**`loading-bar` 根本是死的**，我连着两轮拿它当活的在推理。

剩下三条（`bouncing` / `skeleton-entrance` / `wave`）**这一轮没做**：
前两条本仓连对应组件都没有（流式指示器、骨架屏），那是组件级的缺口不是动画级的；
`wave` 是欢迎页 👋 的一次性挥手。**都记在这里，不写进声明表**——
声明表只收「会无限循环的」，这三条都不是。

### 读数

改完再取一次：**两边都是 7 条、逐项相同**（只剩 Vue 的 scoped keyframes 后缀，
那是 SFC 机制不是行为差异）。台账 **90 样本 / 202 行一行未动**——
给 Vue 加那层 `<span>` 没有产生新差异，因为上游本来就有同一层。

---

## 九门禁全扫（wave 166，2026-09-08）

距上一次全扫（wave 157）过了 8 轮，按批次规则补一次。**八绿 + `audit` 预期红 14。**

| 门禁 | 读数 | exit |
| ---- | ---- | ---- |
| `verify` | **269 文件 / 2224 单测** | 0 |
| `standalone-sim` | 跑过 15 条 / 未跑 5 条 / 红 0 | 0 |
| `e2e-parity` | **98 passed**，台账 **90 样本 / 202 行** | 0 |
| `e2e-mock` | 269 + 22 + 15 + 2 + 6 | 0 |
| `e2e-visual` | 8 passed | 0 |
| `asset-budget` | — | 0 |
| `e2e-backend` | 2+5+2+3+3+5+1+1 | 0 |
| `icon-parity` | 共 0 处待核、0 条 ⚠ | 0 |
| `audit` | **预期红 14 条**，分诊写在 Makefile 的 audit 上方 | 2 |

`frontend/` 侧（wave 165 实跑）：`pnpm check` 0、`pnpm test` **1042 passed** 0、
`pnpm exec playwright test --workers=1` **148/148** 0。
默认 workers 下 `landing.spec.ts:61` 仍会随负载红——wave 160 量清是主线程饥饿，
干净树上同样红，与本段任何改动无关。

---

## 上一轮（wave 165）做了什么：**订正 wave 164——那条路是通的，只是我上一轮找错了卡点**

wave 164 判「`animationName` 这一档三重堵死」，第②条写的是
「子任务卡片：回放 Gateway 跑不出来，只有一份 `write_read_file` cassette」。
**那是在答一个错的问题。**

`subtask-card` **本来就在对照套件里**，它是 `backend: "mock"` 的场景——
走的是**静态路由 mock**，根本不经过回放 Gateway。我上一轮查的是回放 fixture，
而这条场景从来不用它。**（线索 330：查「够不够得着」之前，先确认这一屏是怎么到达的。）**

真正的卡点是另一件事，而且是这一轮量出来的：
**`sampleGeometry` 只把 `visible` 的 target 当锚点**（`if (step.kind !== "visible") continue`），
而两个应用底下那层 `.ambilight` 在终态卡片上**盒子高度为 0**，`visible` 匹配不上。

### 三处改动

1. **锚点面扩到 `hidden` 的 target**。听着别扭——场景刚断言它不可见，为什么还量它？
   因为「不可见」有两种：**元素不在**（两边都 `null`，`diffGeometry` 跳过，等于没取）
   和**元素在、只是不占位或透明**。后一种正是装饰层的常态。
   代价接近零：现有三处 `hidden` 步骤的目标本来就不存在。
2. **伪元素那一格多取 `animationName`**。几何、颜色、opacity 在动画停住前后**完全一样**，
   `animationName` 是唯一看得见它的字段。
3. **`subtask-card` 加一个 `hidden` 锚点**指向那一层。

### 守卫按设计拦了我一次，而它是对的

第一版锚点写的是 `{ selector: ".ambilight" }`，`scenario-coverage` 当场红：
**「每个场景的步骤只用两边共有的定位方式」——不许拿 class 当选择器**
（class 是组件库实现细节，写进场景等于把 reka/radix 的差异写进取样面）。

`.ambilight` 其实不是库的类、是两边逐字相同的自有类，但**给守卫开一条豁免正是坑 180 禁止的**。
按仓库自己的约定走：**两边同加 `data-slot="ambilight"`**（本仓到处在用这套命名），
锚点改成 `[data-slot="ambilight"]`。

### 判据：这一档真的响吗

坑 258 的门槛问题这次有**实测**答案，不是举例：

```
门控着（当前）  react anim=none        vue anim=none
把 Vue 的门控还原   react anim=none        vue anim=ambilight   ← 响了
```

而**同一个变异在现有各档上零反应**——wave 161 两边同改时台账 98 条 202 行一格没动，
那次的「零反应」正是这一档不存在的证据。

### 读数

- 干净树：**新增 0 行**。两个应用在这一层上一致（都已门控），
  只有原有两行 `separator ::after` 的样本串多了 ` anim=none`。
- 台账仍 **90 样本 / 202 行**。
- 因为那两行文案变了，`parity-accept` 按「集合包含」判成「新增 2 行」而拒写——
  与 wave 145 同一情形（判据表达不出「同一行、文案变长」），走 `PARITY_ACCEPT_GROW=1`。
  **那两行不是新差异，是同两行的新写法。**

---

## 上一轮（wave 164）做了什么：**把「给动画加一档」这条路走到底，三重堵死——零代码改动**

wave 163 把 `animationName` 这一档记成否定结论，理由是「没有一个锚点本身是会动的元素」，
并写下「要让它有货，得先按方向一给子任务卡片那一屏加取样点」。**这一轮去走那条路。**

三重堵死，每一重都是量出来的：

**① 锚点集合里没有会动的元素**（wave 163 已量）。
取样锚点是 `[...scenario.settle, ...state.steps]` 的 target——
textarea / 侧栏链接 / 对话框 / assistant turn。
`ambilight` 在子任务卡片的伪元素上，`shimmer` 在一段 `<p>` 上，都不在里面。

**② 子任务卡片：回放 Gateway 跑不出来。**
> ⚠ **wave 165 订正：这一条是在答错的问题。** `subtask-card` 是 `backend: "mock"` 的场景，
> 走静态路由 mock，根本不经过回放 Gateway。真正的卡点是「`sampleGeometry` 只取 `visible`
> 的 target，而那一层盒子高度为 0」。wave 165 已经做通，见上面那一节。

`backend/tests/fixtures/replay/` 下**只有一份** cassette（`write_read_file.ultra`），
里面 `subagent` 只出现两次、都是配置开关（`subagent_enabled`），**没有真的子代理运行**。
要让它出现得先录一份新 cassette——后端活，还要 API key。

**③ Shimmer 的「还在跑」态：两条独立的路都不通。**
- `streaming-reasoning-order` 这条场景**自己的注释就写着**：
  「另一半要挂一个『一直不关』的流服务器，那超出当前步骤词汇能表达的范围」。
- 更要命的是**就算够得着也不能用**：`run-duration.tsx` 的 `RunActivity` 旁边挂着一个
  `setInterval` **每秒刷新的已用时**（`(3s)`、`(4s)`……），
  取样面会读到一个一直在变的数字——**那一屏天生就不是确定的**。
  这一条 wave 163 没想到，是这一轮量出来的。

**所以 `animationName` 这一档不是「暂时不加」，是「在现有取样面上加不了」。**
解锁它需要的三件事写在这里，任何一件单独做都不够：
录一份带子代理的 cassette；给步骤词汇加「挂住一条流」；
把 `RunActivity` 的计时器在取样上下文里冻住（或换一个不带计时器的锚点）。

**这一轮零代码改动**，只把三条路各堵在哪写清楚——省下的是下一轮重新推一遍的时间。
先例：wave 98 / 99 / 101 / 114 / 115 / 123 / 127 都是这种轮次。

---

## 上一轮（wave 163）做了什么：**先否掉一个想加的档，再把刚修的四条动画钉住**

### 否定结论：`animationName` 这一档加不了

连着三轮（160/161/162）修的都是**台账根本看不见**的动画差异，
所以第一反应是给几何档加 `animationName`。按坑 258 的门槛问一句
「有没有一种变异能让新档响、而现有各档都不响」——**答案是有**
（revert wave 161 的 ambilight 门控，实测台账零反应：98 条、202 行，改前改后一样）。

**但它仍然加不了**：取样锚点是 `[...scenario.settle, ...state.steps]` 的 target，
都是 textarea / 侧栏链接 / 对话框 / assistant turn 这类元素，
**没有一个锚点本身是会动的元素**（ambilight 在子任务卡片的伪元素上，
shimmer 在一段 `<p>` 上，都不在锚点集合里）。加了也是恒读 `none`，
正是坑 258 说的「一个几乎永远不会响的东西比没有更糟」。**记成否定结论**（wave 99 先例）。
要让它有货，得先按方向一给子任务卡片那一屏加取样点——那是另一件事。

### 改做：把「必须表态」变成门禁

wave 160~162 修了四条动画，但**没有任何机器守着**——明天再写一条无限动画、
照样没人拦。wave 160 当时想的判据是「无限 ⇒ 必须 `motion-safe:`」，
被自己按坑 180 否掉（`animate-spin`/`animate-pulse` 是状态指示，需要豁免表）。

**这一轮换了判据的形状**：不是「必须门控」，而是
**「凡是会无限循环的动画，都必须在声明表里有名有姓、写清停不停以及为什么」**。
零豁免——新加一条不登记就红。这是本仓已经用熟的「两张表恰好划分全集」，
不是豁免表。

**顺手把全集数对了**（前两轮数了两次都不全）：除了手写的
`shimmer` / `shine-border` / `aurora-shift` / `ambilight`，
还有 Tailwind 自带、默认就是无限的 **`animate-spin`（26 处）与 `animate-pulse`（3 处）**。
后两条声明为 `always` 并写明翻案判据：转圈本身就是「还在等」的全部信息，
冻住之后用户看到的是「卡住了」——**那是把界面变成撒谎，比不理会偏好更糟**。

`tests/guards/looping-animations.test.ts` 四条用例：扫描面自证 / 全集双向相等 /
每条都写清 decision+where+why（`why` 有长度下限，挡「因为要动」这种四个字的理由）/
声明为 `gated` 的源码里确实有减动分支（**粗筛**，真停没停仍由 e2e 的计算样式核）。

### 负向验证 7 次

| # | 变异 | 结果 |
| - | ---- | ---- |
| 1 | 新写一条无限动画、不登记 | 红 |
| 2 | 从声明表里删掉 `ambilight` | 红 |
| 3 | 声明表里多一条源码里没有的 | 红 |
| 4 | `why` 写成四个字 | 红 |
| 5 | 删掉 `shimmer` 的减动分支但仍声明 `gated` | 红 |
| 6 | 扫描面指向不存在的目录 | 红 **2 条**（自证生效） |
| 7 | 只在**注释里**写一条无限动画 | **绿**（剥注释生效，正确） |

第 7 条是特意验的：这份守卫**自己的头注释里就写着 `infinite`**，不剥注释它会扫到自己（坑 202）。

### 两条现成守卫按设计响了

- 新 baseline 没登记 → `baseline-keys-consumed` 红两次：
  先要「进 HAND_MAINTAINED 还是 GENERATED」，再要 `$readers` 与实测引用集逐字相等。
- lint 抓到我在注释里为了不提前闭合而插的零宽空格（`no-irregular-whitespace`）。

---

## 上一轮（wave 162）做了什么：**上一轮说「停住会让文字看不见」——那是推断，而且是错的**

wave 160 / 161 两次把 `shimmer` 留在门外，理由都写着
「它是『还在跑』的状态文字，而且用 `bg-clip-text`，**停错位置会让文字看不见**」。
**这一轮先验这句话。**

### 证伪

Shimmer 的背景是**两层**：

```
背景层 1（--bg）  linear-gradient(90deg, #0000 …, var(--color-background), #0000 …)   ← 会动的高光带，两端透明
背景层 2          linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))  ← 实心底色
```

底下那层是**实心**的，文字任何时候都由它画出来。而两边停住的位置都是
`background-position: 100% center`——**那正是这条动画自己的起始帧**
（React 的 `initial`、Vue `.shimmer` 的基础规则），
也就是说**这一帧今天每个周期都会在屏幕上出现一次**。它要是会让文字消失，
现在每两秒就该闪一次白。**所以停住是安全的，那句话是错的。**

### 两边同改

- **Vue**：`animation` 挪进 `@media (prefers-reduced-motion: no-preference)`，
  基础规则里的 `background-position: 100% center` 留着当停车位。
- **React**：`motion/react` **默认不理会这个媒体特性**（FlipDisplay 那处的注释早写过），
  所以显式问 `usePrefersReducedMotion()`；减动时 `animate` 落到 `initial` 同一处、
  `transition` 换成 `{ duration: 0 }`。

两边停车位都是 `100% center`。

### 用例：一边单测一边 e2e，因为两边的机制不是一回事

- **React 的 Shimmer 由 motion/react 驱动**，实测 **jsdom 里真的会动**
  （250ms 后 `100% center` → `75% center`，1s 线性）。所以钉在单测里，
  断言「减动时 250ms 后仍在 `100% center`」+「无偏好时已经不在」。
- **Vue 的是 scoped CSS**，jsdom 不套用 scoped 样式，只能在真浏览器里核。
  做法：从**浏览器解析好的 CSSOM** 里把 `.shimmer[data-v-xxxxxxxx]` 的 scope 属性名捞出来，
  再造一个带同样属性的元素读 `getComputedStyle`。核的仍是计算值，不是 CSS 源文本。

**两个坑**（都靠形状断言当场现形）：

1. 造的元素没有 `--shimmer-duration`，`animation: shimmer var(--shimmer-duration) …`
   **整条声明作废**，computed 读回 `none`——**和「被减动收住」长得一模一样**。
   补上变量才分得开。
2. scoped 样式里的 `@keyframes` **会被改名**（实测 `shimmer-b57f278c`），
   按前缀匹配而不是钉死那串哈希。

负向验证 5 次（React 2 + Vue 3），各红一条，还原全绿。
其中 Vue 的第三次第一版**没打上**（字符串对不上，脚本 assert 直接抛），
那次「4 passed」是**无效变异不是假绿**——改对字符串后转红。

### 两条守卫按设计响了

- 改名 spec 之后 `doc-references` 当场红：Vue spec 头注释里还写着旧路径。
- 之前 `scenario-coverage` 也响过一次（新增 React spec 没在棘轮里表态）。
  这一轮把 `exempt` 那条的 id 改成 `reduced-motion`，并写清两边覆盖面为什么不对称。

### 无限动画那张表现在的样子

| 动画 | React | Vue |
| ---- | ----- | --- |
| `aurora` | 门控（wave 160） | 门控 |
| `shine` / `shine-border` | 门控 | 门控 |
| `ambilight` | 门控（wave 161） | 门控（wave 161） |
| **`shimmer`** | **门控（wave 162）** | **门控（wave 162）** |
| `loading-bar` / `bouncing` | 未门控（状态指示，冻住会让界面撒谎） | 无对应物 |

**剩下两条是有意留的**，判据写在这里：它们是**状态指示**，
正确做法是换一种更轻的动效而不是停住；而「换成什么」没有现成答案，
所以不动，也**不要**给它们配「必须 motion-safe」的守卫（坑 180）。

---

## 上一轮（wave 161）做了什么：**上一轮写下的「全集只有四条」是错的，第五条两个应用都没门控**

wave 160 结尾写着「可做的变体：两个应用对同一条动画的取舍必须一致，留给下一轮」。
这一轮先去量那张表，**第一件事就是发现自己上一轮数错了**。

### 订正：无限动画的全集是 5 条，不是 4 条

wave 160 grep 的是 `--animate-*`（Tailwind 主题变量那种写法），
漏掉 **`globals.css:377` 那条直接写在规则里的 `animation: ambilight 40s ease-in-out infinite`**。
**又是线索 324**（grep 一个概念之前先把它在这个仓库里的所有拼法列全），
上一轮刚记下、这一轮立刻又踩。

补齐之后两边的全集与取舍：

| 动画 | React | Vue | 一致？ |
| ---- | ----- | --- | ------ |
| `aurora` | 已门控（wave 160） | 已门控 | ✓ |
| `shine` / `shine-border` | 已门控 | 已门控 | ✓ |
| `shimmer` | 未门控（`motion/react`） | 未门控（CSS） | ✓ |
| **`ambilight`** | **未门控** | **未门控** | ✓ |
| `loading-bar` / `bouncing` | 未门控（状态指示） | 无对应物 | — |

**所以 wave 160 想做的那条守卫本身是空的**——两个应用在每一条共有动画上取舍都一致。
这是一个否定结论（wave 99 的先例：撤掉一档不该要的）。**但这张表把真东西翻出来了。**

### `ambilight`：两边同改，而且触发条件是上一轮自己写死的

`ambilight` 是子任务卡片「正在跑」时垫在下面那层彩色环境光——
**自动播放、无限循环、纯装饰**（WCAG 2.2.2，A 级），两个应用都不理会减动偏好。

而 Vue 的 `main.css` 里早就写着：

> 这里刻意**不加** prefers-reduced-motion 分支：上游没有，而对照要求两边在同一组
> 环境条件下长得一样。**要改的话得两边同改。**

**触发条件写死在那里，这一轮满足它。** 两边把 `animation` 挪进
`@media (prefers-reduced-motion: no-preference)`——发光那一层照旧，只是不再游走。

**停在哪不用谁去钉**：两份 keyframes 逐字节相同，首尾都是 `background-position: 0 0`，
正好也是 CSS 初始值，所以两边停在同一处。
（ShineBorder 那处就是栽在「动画开关一致、静止位置不一样」上，这次天然避开。）

### 用例：核浏览器算出来的样式，不核 CSS 源文本

两边各加一份镜像 spec（`tests/e2e/ambilight-reduced-motion.spec.ts`）：
注入一个 `.ambilight` 元素，读 `getComputedStyle(el, "::before")`。
整个机制就是一条媒体查询，**读源文件证明不了浏览器会怎么算**。

踩到的两件事：

1. **`test.use({ reducedMotion })` 在 describe 级没传到页面上**——探针读回
   `matchMedia("(prefers-reduced-motion: reduce)").matches === false`，
   于是两个用例其实在断言同一件事。**改成显式 `page.emulateMedia()`。**
   我是因为在断言里顺手带了一条 `expect(seen.reduce)` 才看见的——
   **没有那条，这份用例会以「两边都绿」的样子骗过去。（线索 325）**
2. 计算值是 `0px 0px` 不是 `0% 0%`。

负向验证 4 次（两边各 2）：把 `animation` 挪回媒体查询外 → 减动那条红；
整条 `animation` 删掉 → 形状断言那条红；还原后两边各 2 条全绿。

### 棘轮守卫按设计响了

给 React 加 spec 之后 `make verify` 当场红：
「三个桶恰好划分 React 的用例清单」。按它的规矩登进 `exempt`
（spec 落在 `/`，而 `/` 已在 `exemptRoutes` 里），并写清**这份 spec 与路由无关**：
它注入元素核全局样式规则，用 `/` 只是因为随便哪一页都会加载那份样式表；
本仓自己带了镜像 spec，所以两侧都有机器守着。

### `landing.spec.ts:61` 今天 6 跑红了 4 次

仍是 wave 160 量清的那条：主线程饥饿（该页空 `evaluate` 往返中位 124ms / 749ms）。
`--workers=1` **148/148 exit 0**。**没有动它**——把超时调大是拿更大的预算盖住一个真的
性能问题，而真修要逐段 profile 落地页动画，那在对齐范围之外。**读数记在 wave 160 那一节。**

---

## 上一轮（wave 160）做了什么：**React 有那个 hook、用过两次，却在三处产品动画上漏掉了减动偏好**

### 起点是一条「默认就红」的门禁

wave 158 记下 `pnpm test:e2e` 在这台机器上默认 workers 会红一条
（`landing.spec.ts:61`，3930×1650 下 `scrollIntoView` 超时 30s），
`--workers=1` 则 146/146。这一轮先把它量清楚：

- `playwright.config.ts` 是 **`workers: CI ? 1 : undefined`、`retries: CI ? 2 : 0`**——
  **CI 串行且重试两次，开发机并行且零重试**。所以 CI 永远绿，开发机上的红没有信息量。
- 但这一轮复跑，默认 workers **146 passed / 1.1m**，零重试就绿了。**跟机器负载相关，此刻复现不出来。**
  不停在「flaky」这个词上，直接量那一屏（**生产构建**，`next build && next start`）：

  | 视口 | 空 `evaluate` 往返中位 | 2 秒窗口内长任务 | 最长单个任务 |
  | ---- | ---------------------- | ---------------- | ------------ |
  | 1366×768   | **124ms** | 18 次 / 累计 2164ms | 122ms |
  | 3930×1650  | **749ms** | 4 次 / 累计 3032ms  | **786ms** |

  也就是**首屏动画把主线程占满了**，而且随视口面积恶化。这是真问题，但它在落地页
  （对齐范围双向豁免），要修得先分清是哪一段动画、逐个 profile——**这一轮没做，读数记在这里**。

### 顺着「动画」查下去，撞到一条真的

React 里 honor `prefers-reduced-motion` 的文件只有 4 个，Vue 有 8 个。
**第一次数是错的**：我只 grep 了 `prefers-reduced-motion|motion-reduce`，
漏掉 Tailwind 的 **`motion-safe:`** 写法，差点写出一条不存在的缺陷。补齐拼法重数之后，
逐个配对，**三处 React 真的漏了，而且都在产品面**：

| 组件 | React 用在哪 | 此前 | Vue |
| ---- | ------------ | ---- | --- |
| `AuroraText` | `workspace/welcome.tsx` 的欢迎标题 | `animate-aurora` 无限跑 | `@media (reduce)` 停在 `50% 50%` |
| `ConfettiButton` | `workspace/input-box.tsx` | 无条件发射 | `shouldEmitConfetti()` |
| `FlickeringGrid` | `(auth)/login` 与 `(auth)/setup` | rAF 循环常开 | `prefersReducedMotion()` |

前两个是**自动播放的无限动画**（WCAG 2.2.2，A 级），第三个是登录/初始化页的整片背景。
`globals.css` 里**一条 `prefers-reduced-motion` 都没有**。

**最关键的一点**：React **早就有** `usePrefersReducedMotion()`，而且 `chat-box`、
`markdown-content` 两处已经在用——**这三处只是没调它**。
「本仓的动画尊重减动偏好」是一条已经在执行、却没有任何机器在守的规则。

### 修法（React 单侧；Vue 三处本来就是对的，属 wave 73 那一类）

- `aurora-text.tsx`：`animate-aurora` → **`motion-safe:animate-aurora`**（与本仓 `shine` 同一写法），
  并把停住的位置显式写成 `backgroundPosition: "50% 50%"`。
  **停在哪和停不停一样重要**——ShineBorder 那处的注释记着同一条教训：
  200% 宽的渐变停在初始的 `0% 0%` 与停在中间，露出的颜色不是一段。
- `confetti-button.tsx`：减动时不发射，**`onClick` 照常执行**（没有功能挂在动画上）。
- `flickering-grid.tsx`：减动时**画一帧就停**，不起 rAF 循环。
  只 `return` 不重绘会让登录页背景整块空掉——那是「消失」不是「静止」。

### 负向验证 6 次，其中一次假绿

| # | 变异 | 结果 |
| - | ---- | ---- |
| 1 | 还原 confetti 的减动判断 | 红 |
| 2 | 还原 aurora 的 `motion-safe:` | 红 |
| 3 | 拿掉 aurora 的静止位置 | 红 |
| 4 | 让 confetti 永远不发 | 红（形状断言） |
| 5 | 让 grid 永远起 rAF | 红 |
| 6 | 让 grid 的减动分支不重绘 | ⚠ **绿 → 假绿**，改尺子后红 |

**6 为什么假绿**：我拿 `fillRect` 次数当「画了没有」，而组件里的 `toRGBA` 自己
建了一个 1×1 canvas 解析 CSS 颜色、也调了一次 `fillRect`——于是计数**恒 ≥ 1**。
换成 `clearRect`（只有 `drawGrid` 调）之后转红。**（线索 323）**

### 为什么没有配守卫

想过一条「`globals.css` 里 `--animate-*` 带 `infinite` 的，用的时候必须走 `motion-safe:`」。
全集只有四条：`aurora`、`shine`（都已合规）、**`loading-bar`、`bouncing`**。
后两个是**状态指示**——把加载条冻住会让界面撒谎，正确做法是换一种更轻的动效而不是停住。
也就是说这条判据需要豁免表，**按坑 180「需要豁免表就说明判据错了」，不做**。
**可做的变体**：两个应用对同一条动画的取舍必须一致——那是一张双向表、零豁免，
但要跨应用读 `../frontend`，得做成 `icon-parity` 那样的 opt-in 工具。**留给下一轮。**

---

## 上一轮（wave 159）做了什么：**把 #2 剩下的那一半查到根因——这一轮零代码改动，只有度量**

wave 158 把 `chat-thread-init-ordering` 的 `aria` 那一档做到 20/20，
`requests` 那一档还是 2 个终态。这一轮把它查到底。

### 先订正我自己上一轮写的话

wave 158 说两个请求终态「差三条交接后的后续 GET」，读起来像是「有没有发」。
**不对。那三条 20/20 都发了，差的是发了几次。**

我当时拿**排序后的列表**做 `diff`，而 `diff` 把「一份里出现两次、另一份一次」
显示成一条 `<`，我读成了「缺一条」。按 `Counter` 重比：

```
GET /api/langgraph/threads/{id}          2  vs  1
GET /api/threads/{id}/messages/page      2  vs  1
GET /api/threads/{id}/token-usage        2  vs  1
```

正好差一整轮。**多重集差异不能用 `diff` 看，要用计数比**（线索 321）。

顺带把 wave 158 那条「是不是落在取样窗外」的猜想也证伪了：
把 settle 从 700ms 拉到 2500ms 各取 20 个样本，
**两组都是 20/20 三条齐全**，逐样本命中数只有 5 或 8——从来不是 0。

### 根因（探针实测）

把 `queryClient.invalidateQueries` 包起来记时刻与调用栈：

```
单轮样本   取: t=679 / 679 / 682      invalidate: t=686        （+7ms）  → 无第二轮
双轮样本   取: t=340 / 340 / 343      invalidate: t=356 / 358  （+16ms） → 第二轮 t=356/358/358
```

那批 invalidate 的栈是 **`Object.onFinish`**——运行结束就刷
`thread` / `thread-messages` / `thread metadata` / `thread-token-usage`。
而这三个 query 是在 **`onStart`**（`isNewThread` 翻假）时挂载并立刻取的。

于是**「第一轮取回来了没有」决定 1 轮还是 2 轮**：还在飞就被 React Query 去重，
已经落地就真的重取。**第一轮的解析耗时被那两个数夹在 `(7, 16] ms` 之间。**

### 所以这不是抖动，是结构

回放 Gateway 一次运行只要十几毫秒，正好落在那个夹缝里。
**换成任何真实后端（运行以秒计），第一轮必然先落地、必然被刷第二遍，稳定 2 轮**——
也就是说**生产里 `onStart` 那一轮请求是稳定浪费的**：
它取的是一个**正在跑的**运行的历史与用量，随即被 `onFinish` 覆盖。

### 为什么这一轮不修

修法是把 `chat-page.tsx` 里
`useThreadTokenUsage(isNewThread || isMock ? undefined : threadId)` 与同族的历史查询，
从「`onStart` 就放行」推迟到「运行结束才放行」。
**收益**：每次新建会话省一轮必然被覆盖的三条请求。
**代价**：给取数放行条件加上**运行生命周期依赖**，四条失败路径都得想清并各配用例——
①运行报错（`onError`）②用户中途 stop ③运行中刷新页面 ④运行永不结束。

**为省一轮请求，换来取数与运行生命周期耦合，风险大于收益。**
所以这一轮只把结论钉死、不动代码。**下一轮要做就带着那四条失败路径做**，
写在 `baseline/parity-scenario-coverage.json` 的 `$pendingReasons` 里。

**判据仍不满足，`pending` 保留**，并且**不许**用「给场景加一个等第二轮的步骤」
或「把请求档从这个场景排除」来凑绿。

---

## 上一轮（wave 158）做了什么：**挂了 129 轮的那条 pending 查清并修掉——两边同改**

`chat-thread-init-ordering` 从 wave 29 起就挂着，卡点是
**「上游这一屏在取样点上有两个终态，而 Vue 只有一个」**。
判据是 **「同一次构建连取 20 次，React 只出现一个终态」**，从没满足过：
wave 63 量到 19/4、wave 101 量到 15/5、wave 102 又取了 22 个。

**这一轮做到了一半，判据一个字没改：`aria` 那一档 20/20 单一，`requests` 那一档还是 2 个。**
所以 **`pending` 保留**——按判据它覆盖两档，我没有把它改成「只看 aria」。
但账的性质变了：从「两个终态，病因不明」变成
**「两处产品缺陷已从根因修掉，只剩请求档一处已定位的时序」**。

### 先量：两个终态到底差哪几行（今天重量，不引用旧读数）

| 只在多数态（16/20，坏）              | 只在少数态（4/20，好）  |
| ------------------------------------ | ----------------------- |
| `text: Completed in <1s Hello`       | `text: Completed in <1s`|
| `button "Copy to clipboard"`         | —                       |
| `alert: Loading... - DeerFlow`       | `alert`                 |

也就是 **AI 回复之后多出一整条重复的「Hello」人类消息**（连带它自己的复制键），
外加播报器里压着一句 `Loading...`。**两件事，各有各的根因。**

### 根因一：那个「切会话就重置」的 effect，也会在**这次发送自己的 id 交接**时触发

**是量出来的，不是读出来的。** 往 `hooks.ts` 里塞了四处临时探针
（`globalThis.__w158` 记事件），两个终态各 dump 一条 trace——**只差一个数**：

```
坏  … {"e":"send","base":0} … {"e":"reset","view":"0000…0001","to":1} … {"e":"clearFx","hmc":1,"prev":1}  → 1>1 假，永不清
好  … {"e":"send","base":0} … {"e":"reset","view":"0000…0001","to":0} … {"e":"clearFx","hmc":1,"prev":0}  → 1>0 真，清掉
```

`/chats/new` 用**客户端生成的 uuid** 渲染，而 `onStart` 报回来的是**后端另给的 id**
（trace 里那个 `0000…0001`）。于是 `[threadId]` 那个重置 effect 在**发送进行中**触发，
把 `sendMessage` 刚捕好的 `prevHumanMsgCountRef` 基线覆盖成「交接那一刻的计数」——
服务器那条人类消息若已经先到，边沿就被吞掉，乐观消息永远留在屏幕上。

**修法**：那个 effect 的注释自己写着「switching between threads … across chat views」，
所以让它只在**真的换了会话视图**时跑：

```ts
if (optimisticThreadIdRef.current === currentViewThreadIdRef.current) return;
```

手上的乐观消息属于我刚切过去的那个视图 → 这是发送自己的 id 交接，不是用户换会话。
真属于别的视图的乐观消息，本来就有下面那个
`optimisticThreadId !== currentViewThreadId` 的 effect 在丢，不会泄漏。

**顺带修掉的**：这个 effect 一并重置 `sendInFlightRef`、`pendingUsageBaselineMessageIdsRef`、
`localTurnOrderBaselineIdentitiesRef` 等**十一处**发送自己拥有的状态——台账只看得见其中一处。

### 根因二：`Loading...` 盖掉了已经知道的名字，而 assertive 播报器把它播出去且再不更正

`thread-title.tsx` 原来把 `isLoading` 排在优先级**最前面**：

```ts
if (thread.isThreadLoading) { document.title = `Loading... - ${appName}`; }
else { document.title = `${_title} - ${appName}`; }
```

新会话交接那一刻 SDK 开始拉 `/history` → 标签页闪一下 `Loading... - DeerFlow`；
Next 的路由播报器（`aria-live="assertive"`）在导航时读 `document.title`，
**把这一闪播了出去，然后再不更正**——读屏器用户听到「Loading...」，
而那一刻真正的标题已经是 `New Chat - DeerFlow`（探针实测过）。这是 WCAG 4.1.3。

**修法（两边同改）**：`Loading...` 是「还不知道叫什么」的**占位**，
不许盖掉已经知道的名字。改成按「知道得最确切的优先」排：
有标题 → 新会话 → 加载中 → 未命名。
Vue 的 `core/threads/utils.ts` 里 `documentTitleOfThread` **同形同病**，一起改，
并把它的单测从「加载中就说 Loading」改成两条：
「只在没有更好的名字时才说」+「不许盖掉已经知道的名字」。

### 读数

| 阶段                       | 20 样本终态数 | 含重复消息的样本 |
| -------------------------- | ------------- | ---------------- |
| 基线（未改）               | **2**（16/4） | 16               |
| 只改根因一                 | **2**（10/10）| **0**            |
| 只改根因一（拆掉探针复测） | **2**（13/7） | **0**            |
| 根因一 + 根因二            | **1**（20/20）| **0**            |

**中间那两跑是关键**：根因一修完，重复消息 20/20 全消失，但终态仍是 2 个——
剩下的**整整一行**就是播报器。不把根因二一起修，aria 那一档就差这一行不满足。

### 但判据还没满足：请求档仍是两个终态

**差点漏掉这一档**——我的第一个探针只哈希了 `aria`。补上 `requests` 之后：

```
react aria 终态 1: ab789dcf x20      ← 达标
react req  终态 2: ec80f1c4 x14  2bf7296b x6   ← 不达标
vue   aria 终态 1: 459b6ce2 x20
vue   req  终态 1: 0c4eb3dc x20
```

两个请求终态**只差三条交接后的后续 GET**：`GET /api/langgraph/threads/{id}`、
`GET /api/threads/{id}/messages/page`、`GET /api/threads/{id}/token-usage`。
多数态（17/20，19 条）里**没有**它们，少数态（3/20，22 条）里有——
也就是**「这三条在 700ms 取样窗内发没发出去」的时序**，不是集合差。

**没有用「给场景加一个等这三条的步骤」凑绿**：判据原文写着那算换取样点、不算翻案。
**`pending` 保留**，理由整段改写进 `baseline/parity-scenario-coverage.json`。

**顺带订正 wave 102 的一句话**：它说这三条「在 A 里同样发了、也都 200 回来了」。
今天 20 个样本里 **17 个在取样窗内根本没有它们**。是当时只看了一个样本，
还是这一轮的改动改了它们的时机——**没查清，只记读数**。

### 试注册过一次，带出 12 行台账（已回滚，留作下一轮的清单）

场景一旦进 `scenarios.ts`，`make e2e-parity` 当场多出 12 行，其中**三行 aria 是
此前从没量过的真差异**：Vue 的人类消息上有 `button "Edit and rerun"` 而 React 那一刻没有
（两边都有这个功能，条件不同——React 多要求 `!replayActionBusy` 与 `canEdit`）；
React 有 `text: Completed in <1s` 而 Vue 那一刻没有；播报器 React 空、
Vue 是 `New chat - DeerFlow`。**这三行这一轮没有判**——场景还进不来，
判了也是空判。清单写在 `$pendingReasons` 里。

### 走过的弯路（都记下来）

- **第一版诊断错了一半。** 我先按「`threadId` 是 SDK 闸门（`undefined` → id）」写了修法，
  改完 20 样本读数**逐字节不变**（连哈希都一样）。
- 接着我判「构建没吃到改动」——**也错**。`.next/BUILD_ID` 就是那一分钟写的。
  我做的破坏性变异（把清除分支改成 `if (false && …)`）零反应，是因为
  **清除路径有六条，我只堵了一条**。
- 真正有用的一步是**停止推理、上探针**：把决策变量打进 `globalThis`，
  两个终态各 dump 一条 trace，差异当场收敛到一个数字。

---

## 上一轮（wave 157）做了什么：**一个被文档标成 optional 的服务，裸 `up` 会无条件启动它——崩溃重启了 4363 次没人知道**

**触发**：用户发来一张 Docker Desktop 截图，`deer-flow-provisioner` 一直在
`Restarting`。**先量再改**：

```
docker inspect deer-flow-provisioner --format '{{.RestartCount}} {{.State.Status}}'
→ 4370 restarting                     # 三天，静默
docker logs deer-flow-provisioner --tail 20
→ ConfigException: Invalid kube-config file. Expected key current-context
  ERROR:    Application startup failed. Exiting.
wc -c ~/.kube/config → 28             # 只有 `kind: Config` 的空壳
```

沙箱模式实测是 **aio**（`config.yaml` 用 `AioSandboxProvider` 且无
`provisioner_url`）。而 `scripts/docker.sh:194` 在这种模式下**根本不会**把
provisioner 放进 `up` 的服务名单，还会打印「Provisioner disabled」。

**那它是怎么起来的。** `docker-compose-dev.yaml` 第 2 行自己写着

```
# Usage: docker compose -f docker-compose-dev.yaml up --build --watch
```

——裸 `up` 启动**全部**服务，而 provisioner 当时**没有 `profiles:`**；再配上
`restart: unless-stopped`，就成了一个无声的死循环。

**这条账的形状**：`AGENTS.md` 的拓扑表里那句
「Optional — only when sandbox is configured for provisioner/K8s mode」，
**是一条当规则用、却没有任何机器在守的散文**——和 wave 150/152/153/154 同族。

### 修法与两处我自己引入的回归

**第一版**：给两份 compose 的 provisioner 加 `profiles: ["provisioner"]`。
按「先量再改」把 Compose 的行为逐条实测（**v5.4.0**，别照抄记忆里的 v2 语义）：

| 实测                                                | 结果                                        |
| --------------------------------------------------- | ------------------------------------------- |
| `up --dry-run` 裸跑                                 | provisioner **不出现** ✅ 事故修掉了        |
| `up --dry-run provisioner`（显式点名，命令行无 profile） | **照常启动** ✅ 显式点名会自动启用它的 profile |
| `--profile provisioner up redis frontend … nginx`   | provisioner **不出现** ✅ 选择权仍在服务名单 |
| `down --dry-run`                                    | **带不走**正在跑的 provisioner ❌            |
| `down --remove-orphans --dry-run`                   | **一样带不走** ❌                            |
| `build`（不点名）                                    | **漏掉** provisioner 镜像 ❌                 |

后两行是我自己刚引入的回归：`profiles:` 的语义是「不被选中就不参与」，
而不是「不被 `up` 启动」。于是
`scripts/deploy.sh` 的 `build` 横幅自己写着 "Build produces **mode-agnostic**
images"、`docker.sh stop` / `deploy.sh stop` 走的是不带服务名的 `down`——
**profile 一加，这两条路就静默漏掉它**：K8s 模式下 `build` 少一个镜像、
`stop` 留下一个还在跑的容器。

**第二版（提交的这版）**：profile 留在服务上（挡住裸 `up`），
**两个脚本在 `COMPOSE_CMD` 里各声明一次 `--profile provisioner`**。
`up` 那条路的选择权仍然只在 `$services` 名单里（上表第三行实测过），
而 `build` / `down` / `restart` / `logs` 这些不带服务名的子命令重新变完整。

### 守卫（两半都钉，零豁免）

`backend/tests/test_compose_optional_services_are_profiled.py`，8 条：

1. **服务这半**：`OPTIONAL_SERVICES` 里的每一项，在两份 compose 里都必须有非空 `profiles:`。
2. **反方向**：不在这张名单里的服务**不许**躲在 profile 后面（否则裸 `up` 起不全这套栈）——
   「两张表恰好划分全集」。
3. **脚本这半**：凡是自己拼 `docker compose … -f <compose>` 的 `scripts/**.sh`，
   都必须声明全部 optional profile。扫描面是**自证**的（`rglob` 出来的集合里
   必须含 `docker.sh` / `deploy.sh`，否则先红）。

### 负向验证（8 次），**其中两次假绿**

| # | 变异                                | 期望 | 实际                        |
| - | ----------------------------------- | ---- | --------------------------- |
| 1 | 拿掉 dev compose 的 `profiles:`     | 红   | 红（只红那一份）            |
| 2 | 拿掉 prod compose 的 `profiles:`    | 红   | 红                          |
| 3 | 给核心服务 nginx 加 `profiles:`     | 红   | 红（反方向那条）            |
| 4 | 名单里写一个不存在的服务名          | 红   | **6 条全红**（尺子自查有效）|
| 5 | 从 `docker.sh` 命令行拿掉 `--profile` | 红 | ⚠ **绿 → 假绿**            |
| 6 | 从 `deploy.sh` 命令行拿掉 `--profile` | 红 | ⚠ **绿 → 假绿**            |
| 7 | `SCRIPTS_DIR` 指向不存在的目录      | 红   | 红                          |
| 8 | 修好后全部复测                      | —    | 5/6 转红，其余不变          |

**5/6 为什么假绿**：我在脚本注释里写了 `--profile provisioner` 这串字解释它为什么在，
守卫 grep 到的是**散文**、不是命令。这正是本仓踩过的「扫描前先剥注释」那条坑
（线索 202）——**我知道这条坑，还是又踩了一次**，因为这次的注释是我自己刚写的。
修法：`_strip_sh_comments()` 之后再扫；行尾注释只认前面有空白的 ` #`，
避开 `${VAR#pat}`。

### 顺手订正的文档

- `AGENTS.md` 拓扑表下面补一段：它在 profile 后面、为什么、谁负责启用、谁在守。
- 两份 compose 的 Usage/服务清单注释各补一句 K8s 模式该怎么跑。

### 顺手发现：**wave 156 把 `AGENTS.md` 顶过了软预算，我红着推了出去**

跑完整套后端才看见：`test_agent_guidance_check.py` 报
`assert 13279 <= 12288`。逐个 commit 量回去——

```
016704d1 12148     wave 155
10be0106 12772  超  wave 156（仓库地图那段）
（本轮 +507）13279 超
```

**是 wave 156 越的界，不是这一轮。** 我那一轮只跑了文档相关的几条守卫、
**没跑整套后端**，于是一个红门禁被推上了远端。

**修法不是调预算**，是把深度按 `AGENTS.md` 自己写的定位
（"orientation layer … points to the module guides that own the depth"）推下去：
调度任务那两条 → `backend/AGENTS.md`（余量 +3022）与 `frontend-vue/README.md`；
Vue 那三条 → `frontend-vue/README.md`；我这一轮新写的 provisioner 说明压成一句
（细节本来就在 compose 注释和守卫里）。**结果 12098，余量 +190**，
一条事实都没丢。

### 判据：什么时候把一个服务加进 `OPTIONAL_SERVICES`

它在某处文档里被写成 optional / 有前置条件。**加的时候必须把出处写进那张表的值里**
（现在那一项写的是 `AGENTS.md` 的原句）——否则下一个人只看得到一个名字，
没法判断这条豁免还成不成立。

---

## 上一轮（wave 156）做了什么：**「it maps the whole repo」——四个已跟踪的顶层目录不在图上**

### 一、语气决定判据

`AGENTS.md` 第 5 行：

> It is the **monorepo orientation layer**: it **maps the whole repo** and points to
> the module guides that own the depth.

「maps the whole repo」是**显式的全集声明**，所以「每个顶层目录必须表态」是它自己的
判据，不是外加的洁癖。逐条量：

| 已跟踪的顶层目录 | 在 Repository Map 里？ | 是什么                                               |
| ---------------- | ---------------------- | ---------------------------------------------------- |
| `deploy/`        | **否**（27 份）        | Kubernetes 的 helm chart                             |
| `.github/`       | **否**（21 份）        | CI 工作流与 issue/PR 模板                            |
| `plans/`         | **否**（1 份）         | 2026-07 落错地方的一份设计笔记（家在 `docs/plans/`） |
| `pr-build/`      | **否**（2 份）         | 2026-04 的前后对比截图（#1986）                      |
| 其余 10 个       | 是                     | —                                                    |

前两个是真内容，补进图里；后两个连同 `.agent/` 在图下面新增的一行里点名，
说清它们是什么、为什么不在图上——**每个顶层目录都表了态**。

### 二、为什么这次加反向校验是对的

wave 105 判过一次「**别无差别补表**」：`ROOT_MAKE_TARGETS` 不声称覆盖全集，
给它加反向校验反而是错的。这两次不矛盾——**判据要跟着语气走**：
那张表从不声称全集，这一节自己声称了。同一形状的先例是
`frontend-vue/scripts/standalone-check.mjs` 的 `SCAN_ROOTS ∪ EXCLUDED_ROOTS`。

扫描面用 `git ls-files`（已跟踪）而不是 `os.listdir`：本地构建产物、缓存和临时目录
不是「仓库的一部分」，算进来只会逼出一张永远在变的豁免表。

### 三、我自己先量错了一次

第一版脚本把树里 `app/`、`packages/extension-api/`、`packages/harness/` 拿到**仓库根
目录**去找，报出三个「缺失」——它们其实**嵌在 `backend/` 下面**，是我的解析没跟缩进走。
**一份报「文档写错了」的读数，先怀疑自己的解析。** 守卫因此专门有一条覆盖嵌套路径，
负向验证 N4 就是验它。

### 四、负向验证

| #   | 变异                                  | 打中的用例         |
| --- | ------------------------------------- | ------------------ |
| N1  | 把 `deploy/` 从图里删掉               | 表态那条           |
| N2  | 把「不在图上」那行里的 `plans/` 删掉  | 表态那条（另一半） |
| N3  | 在那行里点名一个已经不存在的目录      | 过期说明那条       |
| N4  | 把树里 `backend/app` 改成不存在的路径 | 嵌套解析那条       |

四条各自打中**不同的**用例——说明四条判据没有互相覆盖。

### 五、下一轮：**批尾**

154 / 155 / 156 已在批内，**下一轮是批尾，跑九条全套**。

`AGENTS.md` 里还剩「Commands: Root vs. Module」那张表没逐条问过。
**先读语气再定判据**：那一节写的是「Rule of thumb: 根 `make` 拥有应用生命周期」，
末尾还写着「Run `make help` for the full list」——**它明确把全集推给了 `make help`**，
所以**正向可以查（列出的 target 都还在吗），反向不该查**（没列的不算漏）。
这正是 wave 105 那条的原样复用，别在这上面再犯一次。

---

## 上一轮（wave 155）做了什么：**判据走出 frontend-vue——AGENTS.md 的拓扑表写错了一个端口**

这一轮的起点不是台账，是上一条 Docker 事故（容器里跑着一份 macOS venv）留下的方向：
**运行期的环境不变量同样存在「写下来当规则、却没人守」的缺口**。

### 一、先扫同形状的坑：一个都没剩

具名卷覆盖构建产物、且**一次性写入**——两份 compose 里只有 `gateway-venv` 一处
（已在 `3ec1f496` 修好并配上启动自愈 + 5 条单测）。`gateway-uv-cache` 是内容寻址的缓存、
`redis-data` 是数据，都不是这个形状。两个前端走 Compose Watch 且
**`ignore: node_modules/`**——`node_modules` 不从宿主机同步、留镜像里那份，
**天然避开了同一个坑**。这是个干净的负结果。

### 二、换到同一形状的另一处：文档里的数字

`AGENTS.md` 的 Service Topology 表，表头写着
「A single `make dev` / **Docker stack** runs four cooperating services」：

| 服务             | 表里写的 | Docker 里实际的 |
| ---------------- | -------- | --------------- |
| Nginx            | 2026     | 2026 ✅         |
| Gateway API      | 8001     | 8001 ✅         |
| React frontend   | 3000     | 3000 ✅         |
| **Vue frontend** | **3100** | **3000** ❌     |
| Provisioner      | 8002     | 8002 ✅         |

Docker 里 Vue 跑的是 `nuxt dev --host 0.0.0.0 --port 3000`，nginx 也是按 hostname
代理到 `frontend-vue:3000`。**3100 是本机 `make dev-vue` 那条路径的端口**
（`frontend-vue/nuxt.config.ts` 的 `devServer.port`）。

代价不是「文档不好看」：**AGENTS.md 是这个仓库的入门层，是每个 agent 进来读的第一份
文件**。照着它去 Docker 栈里找 3100 上的 Vue，什么都找不到。

### 三、判据为什么只钉这一张表

先量了范围：**全仓其余写 `3100` 的地方都是对的**——`make dev-vue` / `make dev-dual` /
`make -C frontend-vue dev`，`ENTRY.md` 甚至明标「本地开发端口」。
所以判据不能写成「文档里不许出现 3100」，那会把正确的十几处一起打红（又是坑 180 的形状）。
判据只钉这一张表，**逐行对上它各自的真实来源**：

| 行             | 来源                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| Nginx          | 两份 compose 的 `ports:` 那一行                                                       |
| Gateway API    | `docker/dev-entrypoint.sh` 里 uvicorn 的 `--port`                                     |
| React frontend | `nginx.conf` 的 `default frontend:PORT`                                               |
| Vue frontend   | `nginx.conf` 的 `frontend-vue:PORT`，**再从 dev compose 的 `nuxt dev --port` 核一次** |
| Provisioner    | `docker/provisioner/Dockerfile` 的 `EXPOSE`                                           |

外加一条**尺子先量自己**：表必须解析出恰好那五个服务，否则锚点写坏会让上面每条静默全绿。

与既有 `test_compose_default_bind_host.py` 的分工写清楚了：那边钉那行 `ports` 的
**绑定地址**那一半（默认 loopback、不许 0.0.0.0、仍可覆盖），这里钉**端口**那一半
以及它与文档的对应。

### 四、负向验证

| #   | 变异                          | 实测                                                    |
| --- | ----------------------------- | ------------------------------------------------------- |
| N1  | 把 Vue 那行改回 `3100`        | **真红两条**（nginx 上游 + dev compose 命令两头都抓到） |
| N2  | 把 nginx 的 Vue 上游改成 3100 | **真红**（反方向成立）                                  |
| N3  | 把 gateway 的 `--port` 改掉   | **真红**                                                |
| N4  | 把表格解析锚点弄坏            | **6 条全红**（尺子先量自己那条挡住）                    |

**踩到一次自己的坑**：N4 之后 `git checkout --` 恢复不了那份测试——**它是新建的、
未跟踪的文件**。变异脚本备份要按「文件是否已跟踪」分开处理，不能一律指望 git。

### 五、下一轮

同一条判据在仓库根部还没走完。`AGENTS.md` 里还有几处**说的是集合关系**的话没有逐条问过：
「Repository Map」那棵目录树（列出的每个目录都还在吗？没列的有没有该列的？）、
「Commands: Root vs. Module」那张表（列的 target 都还在吗？）。
**先量再改**，并且注意 wave 105 已经判过一次同类：`ROOT_MAKE_TARGETS` 不声称覆盖全集，
**给它加反向校验反而是错的**——同一张表在不同文档里的语气不同，判据要跟着语气走。

---

## 上一轮（wave 154）做了什么：**又一条正确、但没人守的规则——浮层层级**

### 一、先量再改

`ARCHITECTURE.md:102` 写着：

> 所有 portal 浮层共用 `z-80` 一层，谁后打开谁在上；只有 tooltip 用 `z-90`。

逐个核对渲染了 reka `*Portal` 的组件：

| 组件                                    | z      |
| --------------------------------------- | ------ |
| `tooltip/TooltipContent.vue`            | `z-90` |
| `alert-dialog/AlertDialogContent.vue`   | `z-80` |
| `hover-card/HoverCardContent.vue`       | `z-80` |
| `dropdown-menu/DropdownMenuContent.vue` | `z-80` |
| `dialog/DialogContent.vue`              | `z-80` |
| `popover/PopoverContent.vue`            | `z-80` |
| `select/SelectContent.vue`              | `z-80` |
| `sheet/SheetContent.vue`                | `z-80` |

**8 个组件，一个漏写都没有——而守着它的机器是 0 台**（全仓提到 `z-80` 的只有一条
e2e 注释，在解释「本仓 z-80、React z-50 是有意不同」，不是守卫）。
与 wave 153 那条「`ui/` 是唯一的交互控件底座」**同一形状**。

### 二、这类缺陷为什么台账照不出来

层级被谁悄悄抬高，症状是「某个浮层盖住了它不该盖的东西」——而
**几何档量的是锚点自己的盒子**，`hit` 档只在锚点中心取一次，
两个应用**各自内部一致**时三档全是 0 行。所以这条只能写在守卫里。

### 三、判据为什么不是「z 值集合 == {80, 90}」

实测 `ToggleGroupItem.vue` 有两处 `z-10`——那是同组按钮之间的层叠、**不是 portal 浮层**。
写成值集合就得配一张豁免表，而**需要豁免表说明判据选错了**（坑 180）。
扫描面因此按**行为**收口：「渲染了 reka `*Portal` 的组件」。

两个方向都查：portal 组件必须落在正确的那一档（正向），
`z-90` 在整个 `ui/` 里只能是 tooltip（反向）。只查正向的话，
别的组件偷偷抬到 `z-90` 是看不见的——而那正是这条规则会被破坏的方式：
某个浮层被盖住了，就地抬一档最省事。

### 四、负向验证

| #   | 变异                    | 期望         | 实测                              |
| --- | ----------------------- | ------------ | --------------------------------- |
| N1  | Popover 抬到 `z-90`     | 真红         | **真红两条**（正向 + 反向都抓到） |
| N2  | tooltip 降到 `z-80`     | 真红         | **真红两条**                      |
| N3  | Portal 识别正则写坏     | 阈值挡住     | **真红**（扫描面阈值那条）        |
| N4  | 只在**注释**里写 `z-90` | **不该**误报 | **不误报**（剥注释生效，坑 202）  |

### 五、门禁

`verify` exit 0，**267 文件 / 2219 单测**（+3 是新守卫的三条用例）；
`e2e-parity` **98 passed**、台账 **202 行 / 90 样本**（本轮不动 app 代码）。

### 六、下一轮

`ARCHITECTURE.md` 的集合断言到这里挑完了两条最能一比一翻成判据的。剩下的是
「唯一 owner」那一整节——**注意它自己写了免责声明**（「本节描述的是应当成立的边界，
不是完成度声明——某一条当前是否成立，去读对应的代码和测试」），
**所以它不是「当规则用的假话」**；要做的话判据得换一种写法，别把免责声明当缺陷修。

换个方向也可以：这次会话里从产品截图查出的那条 Docker 事故
（容器里跑着一份 macOS venv，`uv sync` 看不见二进制架构）说明
**运行期的环境不变量同样存在「写下来当规则、却没人守」的缺口**，
而它们比源码里的更难发现——症状是一条不提 Docker 也不提平台的 import 报错。
`docker/dev-entrypoint.sh` 现在有了平台自愈 + 5 条单测，可以照这个形状再找几处。

---

## 上一轮（wave 153）做了什么：**一条正确、但没人守的边界**

**这一轮是批尾**（150 / 151 / 152 / 153 一批），九条全套跑过，读数在末尾。

### 一、逐句盘点 `ARCHITECTURE.md` 的集合断言

上一轮的做法（先 grep 谁读了这份文件，再问「谁进不了这个扫描面」）这次落到句子上：
`ARCHITECTURE.md` 43 句规范性断言里，挑出**说的是集合关系**的那些
（「只有一份」「唯一」「不得」「全部」）逐句问一次。

最好的靶子是第 84 行：

> `app/components/ui/` 是**唯一的**交互控件底座，建在 Reka UI 之上。

它能一比一翻成判据：**`ui/` 之外不许 import `reka-ui`**。量：

|                                                      | 结果      |
| ---------------------------------------------------- | --------- |
| `app/` + `packages/` 里 `ui/` **之外**的 reka import | **0 处**  |
| `ui/` **之内**                                       | **69 份** |
| 守着这条边界的机器                                   | **0 台**  |

（`grep -rn reka-ui tests/ scripts/` 只找到三处，全部是 chunk 分桶与体积预算
拿它当**打包种子**，没有一处在守这条边界。）

### 二、为什么「当前是真的」不等于「可以不守」

**一条正确但没人守的边界，和一条错的边界只差一次改动。** 产品组件直接建在 reka 上，
绕开的是这一层统一补的东西：

- `aria-modal`（Reka 全库不写，本层显式补 —— `ARCHITECTURE.md:101`）；
- z-index 分层（所有 portal 浮层 `z-80`，只有 tooltip `z-90`）；
- 可访问名走 `primitives.*`（照抄上游写死的英文，见那条记忆）；
- 以及 wave 148 刚刚从三处产品组件手里收拢回来的模态语义。

wave 148 那三处正是「产品层自己搓」的后果，而它们当时都**没有**直接 import reka
——只是自己写 `role="dialog"`。这条边界守的是同一件事的另一半入口。

判据零豁免（坑 180）。反方向也查：`ui/` 那一半必须**真的**在用 reka
（`inside > 50`），否则上面那个 0 是在数空气。

### 三、负向验证

| #   | 变异                                                     | 期望         | 实测                             |
| --- | -------------------------------------------------------- | ------------ | -------------------------------- |
| N1  | 产品组件直接 `import { useForwardProps } from "reka-ui"` | 真红         | **真红**，点名违规文件           |
| N2  | 把扫描面的 pathspec 写坏                                 | 阈值挡住     | **真红**（`inside > 50` 那条）   |
| N3  | 只在**注释**里写 `"reka-ui"`                             | **不该**误报 | **不误报**（剥注释生效，坑 202） |

### 四、批尾九条全套（逐条真跑，2026-09-07）

| 门禁             | 读数                                     |
| ---------------- | ---------------------------------------- |
| `verify`         | exit 0；**267 文件 / 2216 单测**         |
| `standalone-sim` | exit 0；跑过 **15** / 未跑 5 / **红 0**  |
| `e2e-parity`     | **98 passed**；台账 **202 行 / 90 样本** |
| `e2e-mock`       | 265 + 22 + 15 + 2 + 6，全绿              |
| `e2e-visual`     | 8 passed                                 |
| `asset-budget`   | exit 0                                   |
| `e2e-backend`    | 2 + 5 + 2 + 3 + 3 + 5 + 1 + 1，全绿      |
| `icon-parity`    | **0 处待核**                             |
| `audit`          | **红 14**（与预期一致）                  |

**批到此结束**（150 / 151 / 152 / 153）。下一批从 wave 154 起算。

### 五、下一轮

`ARCHITECTURE.md` 那 43 句里还剩两类没逐句问过：

1. **z-index 那句**（「所有 portal 浮层共用 `z-80`，只有 tooltip 用 `z-90`」）——
   可以一比一翻成「扫 `ui/` 里的 `z-` 工具类，集合恰好是 {z-80, z-90}」；
   **先量再改**：先数一数现在有几种 z 值，比例够低才值得做成守卫。
2. **「唯一 owner」那一整节**（`useThreads` / `useMCPConfig` / `client-state` …）——
   注意那一节**自己写了免责声明**（「本节描述的是应当成立的边界，不是完成度声明」），
   所以它不是「当规则用的假话」；要做的话判据得换一种写法，别把免责声明当成缺陷。

---

## 上一轮（wave 152）做了什么：**两份 README 记的门禁不是同一套——中文版少了验收判据的一半**

### 一、把上一轮那条判据系统地用一次

wave 151 的教训是「查一句话有没有机器在守，先 grep 谁读了这份文件」。
这一轮把它变成一次盘点：**每份文档有几台机器在读、里面有多少句当规则用的话**。

| 文档                    | 机器读者 | 规范性断言（中/英） |
| ----------------------- | -------- | ------------------- |
| `ARCHITECTURE.md`       | 3        | 43 / 0              |
| `BEHAVIOR_CONTRACTS.md` | 4        | 114 / 3             |
| `README.md`             | 5        | 0 / **44**          |
| `README_zh.md`          | 2        | 16 / 1              |
| `I18N_INVENTORY.md`     | 2        | 5 / 0               |
| `REUSE.md`              | 1        | 0 / 6               |

**判据自己先量错了一次**（同 wave 150）：第一版正则只认中文情态词，
于是 `README.md` 和 `REUSE.md` 报 0 句——它们是英文文档。补上
`must / never / only / always / exactly / every` 才是上表的数。

### 二、量出来的活缺口

`README.md` 与 `README_zh.md` 记的 `make` 目标**不是同一个集合**：

> **中文版少三个**：`audit`、`coverage`、**`standalone-sim`**。

最后那个不是随便一条——它是**验收判据的动态那一半**
（「移走 `frontend/` 之后 Vue 仍能自足」，wave 83 做的；静态那一半是 `standalone-check`）。
中文 README 里对应那句话当时只写了静态的一半：

```
（`make standalone-check`）。`../frontend` 缺席时它不启动 React，用例整组跳过。
```

而英文版是「`make standalone-check` proves it statically, `make standalone-sim`
proves it by actually doing it」。**照中文 README 走的人根本不会跑那个实验**，
而这个仓库的中文文档正是主要入口。

### 三、为什么此前没人发现

`doc-references.test.ts` 里本来就有一条「两份 README 都要列出每一个**套件**」，
它的注释写着理由：

> 加一个套件却不写进 README，下一个人只能靠读 Makefile 才知道它存在——
> 这正是套件改名之后文档整整落后一个版本的起点。

**这条理由对非套件的门禁目标一字不差地成立**（`standalone-sim` / `audit` /
`coverage` / `typecheck-core` / `proxy-security`…），只是那一半没人守。
判据补成**两份 README 的 `make` 目标对称差为空**，零豁免（坑 180）。

三处一起补进中文 README：门禁清单里的 `coverage`、定向检查清单里的 `standalone-sim`、
以及 `audit` 与 `coverage` 那两段说明（英文版有、中文版整段缺）。

### 四、负向验证

| #   | 变异                                 | 期望       | 实测                                                                                                                                  |
| --- | ------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | 中文 README 去掉 `standalone-sim`    | 真红       | 第一版**只删了一处**（清单里），而那句话里还有一处——**无效变异，守卫理应绿**。两处全去之后**真红**，报 `只在英文: ['standalone-sim']` |
| N2  | 只在中文 README 加一个英文没有的目标 | 反方向真红 | **真红**，顺带让「指向已删除 target 的命令」那条也红                                                                                  |
| N3  | 把目标提取的正则弄坏                 | 阈值挡住   | **真红**（`en.size > 30` 那条断言）                                                                                                   |

N1 那次无效变异值得记：**一处修改落在文档的两个位置时，只改一处的变异什么都没测**
（同 wave 78 那次「两条要同时在才会截断」）。

### 五、门禁

`verify` exit 0，**267 文件 / 2215 单测**（+1 就是新加的那条守卫）；
`e2e-parity` **98 passed**、台账 **202 行 / 90 样本**（本轮不动 app 代码）。

### 六、下一轮：**批尾**

150 / 151 / 152 已在批内，**下一轮是批尾，跑九条全套**。
方向 C 手上还剩这次盘点顺出来的线索：`ARCHITECTURE.md` 有 **43 句**中文规范性断言、
只有 3 台机器读它（其中两台只管「点名的路径存在吗」和「写的数字对吗」）。
**先量再改**：挑出那些「说的是集合关系」的句子（「只有一份」「唯一」「不得」），
逐句问一次「谁进不了这个集合的扫描面」——与本轮同一套做法。

---

## 上一轮（wave 151）做了什么：**订正我自己上一轮的说明——那句话本来就有机器在守**

### 一、我推错了什么

wave 150 我写：`BEHAVIOR_CONTRACTS.md` 开头那句「全表 **A–S 共 19 组**」
**「没有任何机器在核」**，并由此推出「再加一组 `T`，没有任何机器会响」。
这句话进了提交说明 `ef247138`、交接文档、一页纸清单和记忆。

**它是假的。** `tests/guards/doc-facts.test.ts` 的
「BEHAVIOR_CONTRACTS 声明的组数就是实际的组数」一直在核它——数 `## X. ` 标题，
再和句子比。**实测**（在文档末尾加一组 `T`，一个标题 + 一条表行）：

| 守卫                                     | 反应         |
| ---------------------------------------- | ------------ |
| `invariant-ownership`（wave 150 改动前） | **全绿 7/7** |
| `doc-facts`                              | **当场红**   |
| `invariant-ownership`（wave 150 改动后） | 红           |

**错因**：我读了 `invariant-ownership` 这一份守卫，确认它没在守那句话，
就写成了「没有任何机器在守」。**「这一份没守」不等于「没有任何一份在守」**——
同一份文档可以被多条守卫从不同角度读。查一句话有没有人守，判据是
**「grep 这份文档的文件名，把读它的都列出来」**，不是「我打开的那一份里有没有」。

### 二、订正之后，wave 150 还剩什么是成立的

**成立**（未被推翻）：

- `invariant-ownership` 的解析正则是 `/^[A-N]\d+$/`，合同表实际 **221 条 / 19 组**，
  **O–S 五组共 45 条从来没被这份守卫读过**；
- 它那条名叫「读取到**完整**的合同」的用例，断言的是 `组数 === 14`
  ——这个 14 恰恰因为 O–S 看不见才成立；
- **真正没人守的是它自己声称的第二件事**：`条目 id 唯一` 因此只覆盖 176/221 条，
  **O–S 里的重复 id 看不见**——wave 150 的负向验证 N3 当场证实过。

所以 wave 150 的代码改动**仍然是对的**，只是理由要换一个：不是「补上一句没人守的话」，
而是「**一份守卫自己声称的两件事，都只覆盖了子集**」。

### 三、顺带量清两条守卫的分工（这一条是新的）

改完之后有两条守卫都在核那句话，**它们互补、不重复**：

| 守卫                  | 比的是                   |
| --------------------- | ------------------------ |
| `doc-facts`           | `## X.` **标题** vs 句子 |
| `invariant-ownership` | **表行**的组 vs 句子     |

**实测差别**：加一个**有标题、没有表行**的空组 `T` 并把句子改成「A–T 共 20 组」——
`doc-facts` **全绿**（标题与句子对得上），`invariant-ownership` **红**（表行还是 A–S）。
两条合起来才把「标题 == 表行 == 句子」三者钉住；单独任何一条都留着一个缺口。

### 四、这一轮的规矩产出

**线索：查一句话有没有机器在守，先 grep 谁读了这份文件，不要只看你手上打开的那一份。**
`grep -rl BEHAVIOR_CONTRACTS.md tests/` 一秒钟就能列全，而我上一轮跳过了这一步。
同一份文档被多条守卫从不同角度读，是这个仓库的常态而不是例外。

### 五、门禁

`verify` exit 0，**267 文件 / 2214 单测**；`e2e-parity` **98 passed**、台账 **202 行 / 90 样本**。本轮只改注释与文档，不动 app 代码，两个数都与上一轮逐字相同。

---

## 上一轮（wave 150）做了什么：**「全表 A–S 共 19 组」这句话，守卫只读到 14 组**

### 一、先把上一轮留的两条线索就地判掉（都是「量完不改」）

**线索一：`ariaOnly*` / `order` / `depth` / `focus` 四档是不是也有「认不出是谁」的行？**
量了：

| 档              | 行数 | 认不出      |
| --------------- | ---- | ----------- |
| `ariaOnlyReact` | 34   | 0           |
| `ariaOnlyVue`   | 36   | 2           |
| `order`         | 2    | 2           |
| `focus`         | 11   | 2           |
| **合计**        | 83   | **6（7%）** |

**7% 远低于上一轮那个 59/79 = 75%**，而且那 6 行看下来其实都说得出是谁
（`- main:`、`radio [checked]`、`button` vs `input[number]`）。
按 wave 99 的先例——**一个几乎不响的改动比不改更糟**——**不动尺子**。
（第一版判据把「文本写在冒号后面」的行也算成认不出，量出 8 行；
**判据自己先量错了一次**，收紧成「既没有引号名字、也没有冒号后文本」才是 6 行。）

**线索二：上游那个 4px 拖拽把手要不要两边同改？** **不改。**
它不属于「上游自己是坏的」那一档：wave 138 那次是**客观缺陷**（控件对读屏器没有名字），
而目标尺寸是判断题——WCAG 2.5.8 还有「周围留白 24px」这条替代路径，分隔条恰好符合；
`after:w-1` 就是 shadcn/React 生态的主流默认值。**保留本仓 16px 并声明**（wave 146 已记账）。

### 二、这一轮真正的产出

`BEHAVIOR_CONTRACTS.md` 开头写着一句当规则用的话：

> 全表 **A–S 共 19 组**。

「全表」这个词是判据本身——读的人靠它判断自己有没有漏看整整一组。
而**这一份**读它的守卫（`tests/guards/invariant-ownership.test.ts`）——**⚠ wave 151 订正：当时我写成「唯一读这份文档的守卫」，是错的，`doc-facts` 也在读它，而且那句「全表 N 组」本来就由 `doc-facts` 守着**——解析正则是
`/^[A-N]\d+$/`：

|              | 条数    | 组数               |
| ------------ | ------- | ------------------ |
| 实际表里     | **221** | **19（A–S）**      |
| 守卫读到     | 176     | 14（A–N）          |
| **从没读过** | **45**  | **5（O P Q R S）** |

更要命的是那条用例的名字叫「读取到**完整**的 A–N 合同，而不是解析失败后假绿」，
它断言的是 `组数 === 14`——**这个 14 恰恰因为 O–S 看不见才成立**，
等于把缺口钉死。**⚠ wave 151 订正**：当时由此推出「再加一组 `T`，没有任何机器会响」——**那句是错的，`doc-facts` 会响**（实测）。真正没人守的是这份守卫自己声称的两件事都只覆盖子集，其中 `条目 id 唯一` 看不见 O–S 里的重复 id。
**与线索 229 同一形状**（「checkout 共有 219 个」由一个看不见 checkout 的数字撑着）。

**修法**：

1. 正则放到 `/^[A-Z]\d+$/`；
2. 「组数 === 14」换成**从文档那句话里解析出字母区间与组数，与表里实际的组双向核对**
   （表里多一组 → 红；文档多声明一组 → 红；组必须**从 A 连续**，否则「A–S 共 19 组」不成立）；
3. 条数阈值 110 → 200（实测 221）。

**副作用是量出来的**：`条目 id 唯一` 那条用例此前也只覆盖 A–N，
**O–S 里塞一条重复 id 是看不见的**——负向验证 N3 当场证实。

### 三、负向验证

| #   | 变异                     | 期望          | 实测                                                    |
| --- | ------------------------ | ------------- | ------------------------------------------------------- |
| N1  | 正则退回 `[A-N]`         | 双向核对红    | **真红两条**（条数阈值 + 双向核对）                     |
| N2  | 文档改成「A–T 共 20 组」 | 双向核对红    | **真红**                                                |
| N3  | 在 S 组塞一条重复 id     | id 唯一那条红 | **真红**——证明扩正则之后 O–S 的唯一性才第一次真的被守着 |

### 四、门禁

`verify` exit 0，**267 文件 / 2214 单测**（比上一轮 +1，就是新加的那条双向用例）；
`e2e-parity` **98 passed**、台账 **202 行 / 90 样本**（本轮不动 app 代码，行数一格没动）。

### 五、下一轮

同一条判据还没用完：**仓库里还有哪些「文档里写着的数字/清单，被一个看不见全集的东西撑着」**。
这一轮是 `BEHAVIOR_CONTRACTS.md` 的组数；wave 105 是文件头门禁漏掉 `tests/` 整个目录；
线索 229 是 i18n 的 SFC 总数。**做法固定**：找一句带「全表 / 共 N / 唯一 / 全部」的话，
去看读它的那个机器**扫描面是什么**，再问「谁进不了这个扫描面」。

---

## 上一轮（wave 149）做了什么：**把一条只有两个字的账查清——顺手发现四分之三的行都认不出是谁**

**这一轮是批尾**（146 / 147 / 148 / 149 一批），九条全套跑过，读数在末尾。

### 一、上一轮挂的第 8 条，两笔都量清了

wave 148 把移动端抽屉换成 primitive 之后，`thread-list-pin#mobile-drawer` 上还剩三行：
1 行 `tabbablesOnlyReact: ["div"]`，2 行 `requestsOnlyReact`。当时**只记读数、没写猜测**。

**那个 `div` 是 ScrollArea 的 viewport**——`data-slot="scroll-area-viewport"`，
在上游给建议行套的那层 `Suggestions` 里（`tabIndex={0}` 是 wave 97 两边同改时补的）。
也就是 **wave 98 已经判过「不跟」的那笔 ScrollArea 账在另一屏上的复现**，不是新缺陷。

**两条请求不是集合差，是次数差**（与 wave 102 那次订正同形）。逐条量时间戳：

```
(default) / React · desktop     features ×2 (498/501ms)   search ×2 (506/508ms)
(default) / Vue   · desktop     features ×2 (158/160ms)   search ×2 (157/159ms)
mobile-drawer / React · mobile  features ×3 (206/209/259) search ×3 (213/213/260)
mobile-drawer / Vue   · mobile  features ×2 (149/150ms)   search ×2 (148/149ms)
```

**桌面两边一样；只有抽屉打开那一刻上游多发一轮**（+50ms 那一对）——上游的抽屉挂载时
重取，本仓走缓存。与 wave 128 那笔 `retry: 3` 同族，判据同样是 fork-boundary 的
「vue 有更好的可以保留」：数据一样，用户看不出差别，少两次请求。
**翻案判据**：哪天本仓需要「打开抽屉就刷新列表」这个行为，那要靠显式 invalidate，
不是靠改回默认。

**第 8 条到此结清，代码改动为零。**

### 二、真正的产出：**尺子说不出那是谁**

`tabbablesOnlyReact: ["div"]` 这条账，我是**单开一个探针**才查出它是谁的。
一条要靠探针才认得出的账，等于没有账。顺手量了范围：

> `tabbablesOnly*` 与 `tabOrder` 三档共 **79 行，其中 59 行含裸 `div`/`span`**
> ——**四分之三认不出**。

`sampleTabbables` 的描述器原来只取 `tag` + `type` + `role`。给它补一个 `data-slot`，
**判据取最窄的那一种：只有 generic 标签（div/span）且没有 role 时才补**。
`data-slot` 是两个应用共有的 shadcn 约定（侧栏骨架合同已经在钉它），
不像 `data-testid` 那样两边对不上（wave 94 定过同一条）。

复量结果：**59 行进、59 行出，台账行数一格没动（202），而且只有两种行形**——
每一条裸 `div` 都解析成 `div[scroll-area-viewport]`。
**也就是说：那 59 行原来是同一笔账**（wave 98 判过的 ScrollArea），
只是台账此前说不出来。现在三档 **79 行里认不出的是 0 行**。

### 三、负向验证

| #   | 变异                          | 期望            | 实测                                                                                                                                                                                                                             |
| --- | ----------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | 描述器退回改动前（不补 slot） | 59 行退回 `div` | **真红**，逐字退回                                                                                                                                                                                                               |
| N2  | 去掉 `!role` 那个条件         | 应当有反应      | **真红，而且红在坏的方向**：30 行变 86 行——本仓 splitpanes 分隔条**没有** `data-slot`、上游 `ResizableHandle` 有，尺子会**凭空造出新的差异行**（`div(separator)` vs `div(separator)[resizable-handle]`）。这条窄判据挡的正是这个 |

N2 值得单独记一句：**给尺子加信息，加多了会制造差异**。判据必须是「只在认不出的时候补」，
不是「能补就补」。

### 四、批尾九条全套（逐条真跑，2026-09-07）

| 门禁             | 读数                                     |
| ---------------- | ---------------------------------------- |
| `verify`         | exit 0；**267 文件 / 2213 单测**         |
| `standalone-sim` | exit 0；跑过 **15** / 未跑 5 / **红 0**  |
| `e2e-parity`     | **98 passed**；台账 **202 行 / 90 样本** |
| `e2e-mock`       | 265 + 22 + 15 + 2 + 6，全绿              |
| `e2e-visual`     | 8 passed                                 |
| `asset-budget`   | exit 0                                   |
| `e2e-backend`    | 2 + 5 + 2 + 3 + 3 + 5 + 1 + 1，全绿      |
| `icon-parity`    | **0 处待核**                             |
| `audit`          | **红 14**（与预期一致）                  |

**批到此结束**（146 / 147 / 148 / 149）。下一批从 wave 150 起算。

### 五、下一轮

这一轮把「台账里认不出的行」清零之后，方向 C 手上还剩两条现成的：

1. **`ariaOnly*` 与 `order`/`depth` 三档也用同一条判据检查一遍**——
   它们记的是 `- generic` / `- button "名字"` 这种形状，有没有同样「认不出是谁」的行？
   **先量再改**：数一数三档里有多少行落在没有名字的角色上（`- generic`、`- group`、
   `- main` 这类），比例够高才动尺子（这一轮的 59/79 就是够高的样子）。
2. **上游那个 4px 的拖拽把手要不要两边同改**（wave 146 挂的账，还没量过「它到底多难抓」）。
   要做就得跑 React 的三条门禁 + marker 的 chore 提交。

---

## 上一轮（wave 148）做了什么：**手搓的模态语义全仓扫一遍，三处一起换成 primitive，并配上守卫**

用户在这一轮中途给了两条指令：**「从根因彻底修复」**、**「不要打补丁或绕过」**，
以及**「这个问题处理了之后，还要系统扫描下，其它地方是不是也有类似的问题」**。
所以这一轮不是「修好那 30 行」，是**把这一类修干净**。

### 一、根因

wave 147 量出移动端抽屉那 34 行差异时，我把它归成「两种都正确的模态做法」。
再往下走一层，两者并不对等：

- `aria-modal="true"` 是一句**声明**，靠 AT 自己认；
- 上游（Radix Dialog）打的 `aria-hidden` 是**事实**，谁都绕不过去。

本仓那一套是手写的四件套——`aria-modal` 一句、一个 `keydown` 里的 Tab 陷阱、
一个 window 上的 Escape 分支、一颗 `fixed inset-0` 的背景按钮。**第三件事它压根没做。**

### 二、系统扫描：全仓还有几处同根因

扫描面是整个 `app/`（`.vue` + `.ts`），**先剥注释**再匹配（否则守卫会把自己的说明
文字报成违规，坑 202 踩过三次）：

| 类别                                                                       | 处数        | 结论                                                                                                         |
| -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| 手搓模态/浮层                                                              | **3**       | 全部换成 primitive（见下）                                                                                   |
| `role="listbox"` / `role="option"`                                         | 1 份        | 上游 `input-box.tsx:2160/2177` **一模一样是手写的** → 照抄不动                                               |
| `aria-expanded`                                                            | 4 处 / 3 份 | 上游 `todo-list.tsx:56`、`subtask-card.tsx:143` 同样写在普通 `<button>` 上 → disclosure 本就不需要 primitive |
| `role="menu*"` / `role="tooltip"` / `aria-haspopup` / `Teleport to="body"` | **0**       | —                                                                                                            |

三处手搓的是：

1. **移动端侧栏抽屉**（`ThreadSidebar.vue`）——与桌面侧栏**共用一个元素**，
   靠 `:role="mobileOpen ? 'dialog' : undefined"` 这类三元在两种形态之间切。
2. **外链确认弹窗**（`MarkdownLinkSafetyModal.vue`）——`role="button" tabindex="0"`
   的裸遮罩 + `role="presentation"` 的卡片 + document 上的 Escape + 手写引用计数滚动锁。
3. **mermaid 全屏**（`MermaidFullscreen.vue`）——同上形状。

### 三、怎么改的

**没有拆 570 行模板**：新增 `ThreadSidebarShell.vue`，形状照上游 `ui/sidebar.tsx`
的 `Sidebar`——窄屏返回 `<Sheet><SheetContent>`，宽屏返回版面里的一块，
主体作为 slot 内容原地不动。宽屏那一支的类串与改动前**逐字相同**。

另外两处直接换成 `ui/dialog`。**`MermaidFullscreen` 的文件头原来写着「不能换成
Dialog，因为两边引的是同一个 npm 包，改了就是纯粹制造差异」**——这一轮把它推翻了：
**wave 92 在同一个包（streamdown）上做过相反的决定并且沿用至今**（工具条文案上游
写死英文、改不了，本仓保留翻译，台账为此记着 14 行），判据是 fork-boundary 那条
已授权的例外「vue 有更好的可以保留」。一个全屏浮层对读屏器不是对话框、Tab 能走到
它背后去，比文案更硬。

### 四、连带清掉的东西（这一半是「不要打补丁」的直接后果）

- 手写焦点陷阱删掉之后，`app/lib/focusable.ts` **归零消费者**——而
  `ARCHITECTURE.md` 还写着「这一份判据抽屉与 primitive 共用」，**primitive 那一半
  本来就是假的**（全仓没有一个 `ui/` 组件引它）。模块 + 单测 + 三处引用一并删。
- `navigation.workspace`（抽屉的 `aria-label`）随之死掉，从 types 与两个 locale 删掉。
- 三份手写 `<button>` 的清单跟着缩（关闭键与遮罩现在归 primitive）。
- 两份 DOM 测试**换掉了钉的东西**：不再钉「我自己实现得对不对」，
  改钉「我确实把它交给了 primitive」——真的是 dialog、真的有 `aria-labelledby` /
  `aria-describedby`、Escape 真的关得掉。滚动锁那条用例随实现一起删。
- 侧栏骨架合同现在**同时读两份文件**（外壳与主体），否则 `sidebar-inner`
  那一条会静默失守。

### 五、防复发：新守卫

`tests/guards/hand-rolled-overlays.test.ts`。判据取**零豁免**那一种（坑 180：
放宽判据 → 需要豁免表 → 判据选错了）：模态语义的三个标志（`role="dialog"` /
`role="alertdialog"`、`aria-modal`、`fixed inset-0` 全屏遮罩）**只允许出现在
`app/components/ui/`**。四条用例：

1. 扫描面不是空的，而且两半加起来等于全集（尺子先量自己）；
2. 产品层零违规；
3. **反方向**：primitive 那一半必须**真的**有这些标志——否则第 2 条是在数空气；
4. **自证**：重放这三处修掉之前的原文，检测器必须响。

模式串是**拼出来**的不是字面量（坑 267：写进源码的模式串会把守卫自己算进扫描结果）。

### 六、负向验证

| #   | 变异                                                                  | 期望                      | 实测                                                             |
| --- | --------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| N1  | `<Sheet :modal="false">`（reka 改走 non-modal，不再 `useHideOthers`） | 抽屉背后整页回到树里      | **真红**：`ariaOnlyVue` 那一整块 + `order` + `tabOrder` 全部回来 |
| N2  | 拿掉 `SheetHeader` 的 sr-only 标题与说明                              | 3 行 `ariaOnlyReact` 回来 | **真红**，逐字回来                                               |
| N3  | 在 `TodoList.vue` 塞回 `role="dialog" aria-modal="true"`              | 新守卫红                  | **真红**，报出两处违规                                           |
| N4  | 外链弹窗拿掉 `DialogDescription`                                      | DOM 测试红                | **第一版假绿** → 改断言后真红（见下）                            |
| N5  | mermaid 全屏拿掉 `DialogHeader`                                       | DOM 测试红                | **第一版假绿** → 改断言后真红                                    |

**线索：`aria-labelledby` / `aria-describedby` 存在 ≠ 它指得到东西。**
我给两处新写的 DOM 测试断言的是「这两个属性是 truthy 的」——而
**reka 的 `DialogContent` 无论有没有标题/说明元素都会写上生成的 id**。
N4/N5 把元素整个删掉，那两条断言照样全绿。改成**顺着 id 解析到元素、比它的文字**
之后才真红。**凡是断言「某个 aria 引用属性存在」的地方，都要往下再走一步。**

### 七、门禁

| 门禁                               | 读数                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `verify`                           | exit 0；**267 文件 / 2213 单测**                                               |
| `e2e-parity`                       | **97 passed**；台账 **233 → 202 行 / 90 样本**（只减不增，accept 不需要 GROW） |
| 定向 `make e2e` / `make e2e-shell` | 见提交说明                                                                     |

**顺带修了一条负载抖动**：`source-guard` 那条「219 份产品 SFC 全过一遍 AST」的用例
在整套并发跑时实测 6689ms、撞上 vitest 默认的 5 秒上限，**单独跑是 2.2~5.3 秒**
（连测三次）。给它显式配 15 秒并写明理由——与 wave 108 把 expect 预算 5s 抬到 10s 同一类。

---

## 上一轮（wave 147）做了什么：**先推翻我自己上一轮写的一张表，再顺着它修掉一处手机上够不着的按钮**

### 一、上一轮那张表，两行是错的

wave 146 末尾我列了一张「两个应用的伪元素用在哪儿」的对照表，并把其中两行当成
下一轮的线索写进了交接文档、记忆和提交说明。这一轮头一件事就是把它推翻：

| wave 146 写的                                          | 实际                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `ui/sidebar.tsx` → **无对应**                          | **有**：`ThreadSidebar.vue` 里那颗 rail，类串与上游逐字一致（只有 `-right-4` 写死、上游是 side 感知的两条）                |
| `workspace/recent-chat-list.tsx` → `ThreadSidebar.vue` | 错配。`ThreadSidebar.vue` 对应的是 `ui/sidebar.tsx` 的 rail；`recent-chat-list.tsx` 那条 `after:left-0` **本仓没有对应物** |

**错在哪**：我拿「哪些文件出现过 `after:`/`before:`」的**文件级**清单去配对，
而一份文件里可以有好几处伪元素、分别对应上游的不同文件。
判据应该是**逐条类串**去配，不是文件名。改法很便宜——把每份文件用到的
`after:`/`before:` **逐条列出来**再配对，一眼就看出 `ThreadSidebar.vue` 那四条
（`after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border`）
逐字就是 rail。

### 二、真正没有对应物的那一条，是一个手机上够不着的按钮

`recent-chat-list.tsx:356` 的 `after:left-0!` 挂在 `SidebarMenuAction` 上，而那个
primitive 的基类里有一句**上游自己写了注释**的话：

```
// Increases the hit area of the button on mobile.
"after:absolute after:-inset-2 md:after:hidden",
```

再加上 `showOnHover` 那一支的 `md:opacity-0`——**两条都只在 768px 以下才生效**。
本仓那颗按钮（会话行的 ⋯）少了前者，并且把后者写成了**无条件的 `opacity-0`**。

**实测（375px，打开抽屉）**：

|             | opacity | 盒子  | `::after`                                   | 有效点击区 |
| ----------- | ------- | ----- | ------------------------------------------- | ---------- |
| React       | **1**   | 20×20 | `content="" display=block inset=-8/-8/-8/0` | **28×36**  |
| Vue（改前） | **0**   | 20×20 | `content=none`                              | **20×20**  |

两条后果都只在触摸设备上出现：触摸没有 hover，`group-hover/menu-item:opacity-100`
永远不触发，于是**置顶 / 重命名 / 分享 / 导出 / 删除这一整组动作在手机上根本够不着**；
就算够得着，20×20 也低于 WCAG 2.5.8 的 24×24 下限。

改法是照上游**渲染之后**的结果写类串（不是照 primitive 的基类——上游调用点用
`cn()` 顶掉了两条，本仓这里是普通 class 属性、没有 tailwind-merge，
**冲突类谁赢由样式表顺序决定而不是书写顺序**，所以只写赢的那一条）。
顺带补上键盘焦点环（本仓此前一条都没有）。**没有跟的**两组：
`peer-data-[size=*]/menu-button:top-*` 与 `group-data-[collapsible=icon]:hidden`
——标记在本仓不存在，跟了就是死类。

**改后两个断点逐字一致**：375px 都是 `opacity=1` / 点击区 28×36，1280px 都是
`opacity=0` / `::after` `display:none` / 20×20。

### 三、为了守住它，给取样面加了一档：**终态可以自己钉断点**

这一处此前没有任何机器看得见，因为**这一屏不在取样面里**（第⑦类）。要挂上去有个
结构问题：会话行的 ⋯ 在移动端要先点开抽屉，而同一条场景的默认终态是桌面的。

`ParityState` 因此多一个 `dimensions?`（与 wave 128 的 `routes?` 同一条理由：
**场景 id 受覆盖率棘轮约束、编不出新的**，所以「同一条场景里换一个维度」只能做成
终态自己的一档）。不写就沿用场景那一层，**没写过的场景键逐字不变**。

两处细节是为了**不动已有的账**：

1. 新终态的第一个兄弟**不取名字**（`id: ""`）——`key()` 只在 `state.id` 非空时加
   `#`，所以 `thread-list-pin` 原来那两个键逐字不变。
2. `settle` 只等两个断点上都在的东西。原来它等两条会话标题，而移动端侧栏是抽屉、
   默认关着，于是新终态**还没跑到自己的第一步就在 settle 上超时**（实测等满 30 秒）。
   两条会话锚点挪进默认终态的 `steps`——**`steps` 里的 `visible` 同样进取样面**
   （wave 76），一格几何都不少。

实测结果证明这两处生效：**只新增了一个键，已有的 89 个键内容一字未变。**

### 四、新键第一跑：34 行，一处根因

`thread-list-pin#mobile-drawer/mobile/light/en-US` 报 **34 行**，绝大多数是同一件事：

- **27 行 `ariaOnlyVue`**（抽屉背后的整页：composer、欢迎语、各种按钮）+
  1 行 `order` + 1 行 `tabOrder` + 1 行 `tabbablesOnlyReact` ——
  **两个应用用了两种都正确的模态做法**：上游是 Radix `Sheet`，它给兄弟节点打
  `aria-hidden`；本仓是手写的 `role="dialog" aria-modal="true"` + 手写焦点陷阱。
  **快照工具认 `aria-hidden`、不认 `aria-modal`**，所以背后那一页只在本仓这边露出来。
  **键盘那一半两边是等价的，这一点是量出来的**：`tabbablesOnlyVue` 是**空的**
  ——本仓的焦点陷阱确实把 Tab 关在抽屉里了。
  **翻案判据**：把这个抽屉改成 reka 的 Dialog primitive（`modal` 那一档会自己给
  兄弟节点打 `aria-hidden`），这 30 行应当一起消失。**下一轮做。**
- **3 行 `ariaOnlyReact`**：`Sheet` 自带的 sr-only 标题「Sidebar」与说明
  「Displays the mobile sidebar.」。同一笔账，随上一条一起翻。
- **2 行 `requestsOnlyReact`**（`GET /api/features`、`POST /api/langgraph/threads/search`）：
  **成因未查明**。只记读数，不写猜测（wave 101/102 在这上面栽过一次）。
  可能与「上游的抽屉是新挂载的模态」同源，下一轮连模态一起查。

台账 **199 → 233 行 / 89 → 90 样本**（走 GROW）。

### 五、负向验证

| #   | 变异                                                   | 期望                 | 实测                                                                                                       |
| --- | ------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| N1  | `md:opacity-0` 退回无条件 `opacity-0`                  | 移动端可见性差异现形 | **真红**：`role:button[More] opacity React=1 Vue=0`                                                        |
| N2  | 拿掉 `after:absolute -inset-2 left-0! md:after:hidden` | 点击区差异现形       | **真红**：`after React=w=28 h=36 Vue=none`——**wave 146 那一档在第二个组件上抓到了东西**                    |
| N3  | 把 `state.dimensions` 的支持撤掉                       | 该终态跑回桌面       | **真红**：用例从 `#mobile-drawer · mobile/light/en-US`（1 条）变成 `desktop/light/en-US` + `zh-CN`（2 条） |

**踩到一次自己的坑**：第一版变异脚本按 token 去改，`after:-inset-2` 与
`md:after:hidden` 在**我刚写的注释里也各出现一次**，`count == 1` 的断言当场失败、
脚本在写盘前中止——那一跑测的是干净树。**变异要限定在代码行上，别在整份文件里做替换。**

### 六、本轮门禁（wave 147 在批内，跑每轮那三条）

| 门禁                    | 读数                                                     |
| ----------------------- | -------------------------------------------------------- |
| `vitest run tests/unit` | **229 文件 / 1924 用例**                                 |
| `e2e-parity`            | **98 passed**（新终态 +1 条）；台账 **233 行 / 90 样本** |
| 定向 `make e2e`         | **265 passed**                                           |

### 七、下一轮：**把移动端抽屉换成 Dialog primitive**

1. 本仓 `ThreadSidebar.vue` 的抽屉是手写的：`role="dialog"` + `aria-modal="true"`
   - 一个 `keydown` 里的 Tab 陷阱 + 一个 Escape 分支 + 一颗 `fixed inset-0` 的背景按钮。
     上游用的是 `Sheet`（Radix Dialog）。reka 有对等的 `DialogRoot modal`。
2. 换过去应当一次清掉台账里那 30 行（背后整页 + order + tabOrder + tabbable），
   剩 3 行标题/说明按上游补或声明。
3. **别顺手把 `aria-modal` 删掉**：两种做法都是对的，换 primitive 是为了**同时**
   得到 `aria-hidden`，不是因为 `aria-modal` 错。
4. 顺带查那两条 `requestsOnlyReact`。

---

## 上一轮（wave 146）做了什么：**伪元素进取样面——上一轮那个假绿现在有人守了**

### 一、先过门槛，再动手

wave 145 的负向验证 N2 是这一轮的起因：把 `Tabs` 根上的 `group/tabs` 删掉，
`line` 档的下划线整根塌掉，**台账零反应**。坑 258 的门槛问的正是
「有没有一种变异能让新档响、而现有的档都不响」——**N2 本身就是答案**，举得出来。

做法收得很紧（坑 214 / 255）：**只对已有锚点顺带取**
`getComputedStyle(el, "::before" | "::after")`，记 `content` / `opacity` / 宽高 / 底色，
**不记位置**（伪元素的 x/y 跟着宿主走，宿主位置已经是 x/y 两档在报的事，
再报一遍就是同一处差异的第二个投影，坑 219）。`content: none` 记成 `none`，
两边都不存在时不产生任何行。

### 二、第一跑 0 行——而这个 0 是算出来的

干净树上新档报 **0 行**。按坑 249，**要验一个 0，变异必须绕开锚点**：
重跑 N2（去掉 `group/tabs`，不碰锚点），新档当场报出

```
role:tab[Public] after React=content="" op=1 w=56.7 h=2 bg=rgba(10,10,10,255)
                       Vue=content="" op=1 w=0    h=0  bg=rgba(10,10,10,255)
```

**同一个变异在 wave 145 让台账一行都不动**——这一档补的正是那个洞。
重复率也顺带答了坑 255：那次红的**只有**这一档，其余七档一行都没报。

### 三、给这个 0 配一条形状断言

0 行有两种：算出来的 0，和没算的 0。`pseudo()` 里写错一句（比如判断写反、
或者 `getComputedStyle` 少传第二个参数）就会永远返回 `none` → 两边一致 →
台账 0 行 → **没有任何一条用例会红**（坑 131 的形状）。

所以数了一下真正采到伪元素的锚点样本：**4 个**。不是取样面漏了，是
**整个仓库用伪元素的地方就这么少**——本仓 4 份组件、上游 5 份用到
`before:` / `after:`。断言写成 `>= 4`，并在注释里写明「数字变了要看一眼再改，
不要顺手调低」。

### 四、顺着这一档看出去：两个应用的伪元素用在哪儿

| 上游                             | 本仓                                           | 说明                                                                                                                                              |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/tabs.tsx`                    | `ui/tabs/TabsTrigger.vue`                      | wave 145 刚对齐                                                                                                                                   |
| `workspace/input-box.tsx`        | `chat/ChatComposer.vue`                        | placeholder                                                                                                                                       |
| `workspace/recent-chat-list.tsx` | ~~`workspace/ThreadSidebar.vue`~~ → **无对应** | **⚠ wave 147 推翻了这一行**：`after:left-0!` 挂在 `SidebarMenuAction` 上，本仓那颗按钮当时既没有它也没有 `after:-inset-2`——手机上点击区只有 20×20 |
| `ui/resizable.tsx`               | `workspace/WorkspacePanels.vue`                | **分栏把手：把 1px 的线放大成抓得住的区域**                                                                                                       |
| `ui/sidebar.tsx`                 | ~~无对应~~ → `workspace/ThreadSidebar.vue`     | **⚠ wave 147 推翻了这一行**：本仓**有**这颗 rail，类串逐字一致（见 wave 147 第一节）。真正没有对应物的是下面 `recent-chat-list.tsx` 那一条        |
| 无                               | `markdown/CodeBlock.vue`                       | 本仓独有                                                                                                                                          |

第四行是唯一一处「两边都有、却从没量过」的。按 wave 131 的规矩先数锚点：
`[role=separator]`（含 `hr`）在 `sidecar-chat` 那一屏**两个应用各恰好 1 个**，
盒模型逐字相同（1.0×800.0 @870,0），于是把它挂成锚点。**它是第一次进取样面。**

量出两行：

1. `background React=rgba(232,229,222,255) Vue=rgba(0,0,0,0)` —— **不是用户可见差异**：
   同一条 1px 线，上游用 `bg-border` 画、本仓用 `border-left` 画（`box-sizing: border-box`，
   1px 的左边框正好占满 1px 的盒子）。与其在台账里留一条「看着像差异、其实不是」的账
   ——**那种账会让人不再相信这份清单**——不如把画法对齐。改完这行消失，
   屏幕上一个像素都没变。
2. `after React=w=4 h=800 Vue=w=16 h=800` —— **真差异**：拖拽把手的点击区，
   上游 4px、本仓 16px。**本仓这一侧更好**（WCAG 2.5.8 的目标尺寸，4px 的拖拽把手
   很难抓住），按 fork-boundary 那条已授权的例外保留，**接受进台账**。
   **翻案判据**：上游哪天把 `after:w-1` 放宽，或者决定两边同改把它补到 24px。

**顺带订正一条我自己的猜测**：动手前我以为本仓分隔条的 `opacity: 0.33` 是本仓独有的
「悬停才显形」设计，探针一量——**上游也是 0.33**，两边一致，不是差异。

台账 **197 → 199 行**（89 样本不变），新增的两行是同一笔账（点击区）× 两种语言。

### 五、负向验证

| #   | 变异                       | 期望                | 实测                                                                    |
| --- | -------------------------- | ------------------- | ----------------------------------------------------------------------- |
| N1  | `pseudo()` 永远返回 `none` | 形状断言红          | **真红**，报「伪元素这一档一个样本都没采到」                            |
| N2  | `Tabs` 根去掉 `group/tabs` | 新档报下划线塌陷    | **真红**：`w=56.7 h=2` vs `w=0 h=0`；**同一变异在 wave 145 台账零反应** |
| N3  | 分隔条点击区 16px → 4px    | 已接受那行消失      | **真红**（行消失，台账对不上）                                          |
| N4  | 画法退回 `border-left`     | `background` 行回来 | **真红**，逐字回来                                                      |

### 六、本轮门禁（wave 146 起是新一批，跑每轮那三条）

`vitest run tests/unit` 229 文件 / **1924**；`e2e-parity` **97 passed**、台账 199 行 / 89 样本；
定向 e2e：`make e2e` 265 passed、`make e2e-shell` 1 passed。

### 七、下一轮

**第⑨类到此补完，别再做第三次。** 下一轮回到方向 C 本身——
「找出一句写下来、当规则用、却没有任何机器在守的话」。手上有两条现成的线索：

1. ~~**`ui/sidebar.tsx` 的 rail 在本仓没有对应部件**（上表第五行）。~~ **⚠ wave 147 查明这条线索本身是错的**——rail 在本仓有、且逐字一致；错的是我按「文件名」而不是「逐条类串」去配对。真正的缺口在 `recent-chat-list.tsx` 那一条，已在 wave 147 修掉。
   别的东西承担同一件事」，再决定是补还是登记成有意不做——**别直接补**，
   wave 98 的 ScrollArea 就是「上游那一层永远不会真的滚动」的先例。
2. **上游那个 4px 的拖拽把手**：本仓 16px 已经接受进台账，但上游那一侧
   按 WCAG 2.5.8 是不是该两边同改，还没有量过「它到底多难抓」。
   要做就得跑 React 的三条门禁 + marker 的 chore 提交。

---

## 上一轮（wave 145）做了什么：**把 Tabs 的 variant 体系搬过来——顺带发现基类守卫看不见 7 个最高频组件**

**这一轮是批尾**（143、144、145 一批），九条全套跑过，读数在本节末。

### 一、说好要做的：Tabs

wave 144 量出的 14 行 × 两种语言，根因是**上游的 Tabs 有一套 variant 体系，本仓整套没有**。
搬过来分三处，**缺一处就等于没搬**：

| 处            | 上游                                                                                            | 本仓 wave 145 之前                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Tabs`（根）  | `group/tabs flex gap-2 data-[orientation=horizontal]:flex-col`                                  | **一个类都没有**                                                          |
| `TabsList`    | `tabsListVariants` 两档（`default`=`bg-muted` / `line`=`gap-1 bg-transparent`）+ `data-variant` | 写死 `inline-flex w-fit items-center gap-2`，**连 `variant` prop 都没有** |
| `TabsTrigger` | 四段类串（基础 / line 档去底色 / default 档选中底色 / `after:` 下划线）                         | 另写的一套带边框胶囊 + `data-[state=active]:bg-accent`                    |

三处靠 `group/tabs` 与 `group/tabs-list` 两个标记 + `data-variant` 联动。
类串**逐字照抄**，抄完用脚本按字符串比对确认五段全部一致（不是肉眼看）。

调用点（`SkillSettings.vue`）两件事：传 `variant="line"`；把「创建技能」按钮从
**自己一行**挪进与标签**同一行**的 `<header class="flex justify-between">`
（上游 `skill-settings-page.tsx:82` 就是这个结构）。标签顺带挪到权限分支**外面**——
上游根本没有权限查询，这一整个 header 只由技能清单的 loading/error 决定，
放在里面等于让 header 多等一个上游没有的 gate。

**结果**：台账 **219 → 197 行**（89 个样本不变）。每种语言 11 行归零
（7 行 tab 几何 + 3 行 tablist 几何 + 1 行 order），
`switch[review] y` 从 Δ41.9 收到 **Δ-4.1**。

### 二、没说好、但更值钱的：**基类守卫看不见 7 个最高频组件**

搬完 Tabs 我去跑 wave 141/143 那条「基类不一致的，每一条都要在 DECLARED 里有名有姓」，
**它绿了**。差一点就把这个绿当成「Tabs 抄对了」。

它绿是因为**它根本没看**。`literalTokens` 用的
`STRING_LITERAL = /(['"`])([^'"`]*)\1/g` **不许字面量里面出现另外两种引号**，
而 `[&_svg:not([class*='size-'])]:size-4` 是 shadcn 最常见的写法之一。命中这一条的：

- 本仓 21 份读不出、上游 34 处读不出；
- **两边同名、都因此被跳过的有 7 个**：`CommandItem`、`DropdownMenuItem`、
  `DropdownMenuRadioItem`、`DropdownMenuSubTrigger`、`SelectItem`、`SelectTrigger`、
  `TabsTrigger`。

菜单、选择器、标签这三类最高频的交互组件**一个都没进过 `shared`**，
于是那句成文判据在它们身上是空的——**不进集合就不会不一致**。

改成三支分写的字面量正则（各自只禁自己那种引号），当场露出 **4 处此前完全看不见的漂移**。

### 三、那 4 处顺出来的东西：`w-full` 补偿写错了层

- `CommandItem`：`data-[highlighted]` vs `data-[selected=true]`、`data-[disabled]` vs
  `data-[disabled=true]`——框架属性名，同 `--reka-*` 那一类，**声明**。
- 三个 DropdownMenu 项：只差 `hover:bg-accent`（reka 悬停不 focus，文件头早有理由）——**声明**。
- 四个组件都多 `w-full text-left`，**没有任何人给过理由**。删掉 → 复量 → **线程历史菜单当场红**：
  「删除」项 React=182 / Vue=**81.8**（中文 68），而菜单本身两边都是 192。

不急着塞回去，先量祖先链，根因是**元素本身**：

```
React  0 <div    role=menuitem> w=182.0
Vue    0 <button role=menuitem> w=81.8
两边   1 <div role=menu> w=192.0   2 <div> w=192.0 min-width:max-content
```

`<button>` 的 `width: auto` 解析成 fit-content（表单控件的固有尺寸规则，`display:flex` 也改不了），
**所以它不会撑满菜单**。而 `as="button"` 是**七个调用点**各自传的，
reka 的 `Primitive` 默认就是 `div`、与上游一致。

**补偿写在了错的那一层**：primitive 的基类为一个调用点的选择买单。
七处 `as="button"` 全部删掉，`w-full text-left` 一起删，复量菜单宽度回到 182。

### 四、负向验证

| #   | 变异                                                 | 期望           | 实测                                                                          |
| --- | ---------------------------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| N1  | `TabsList` 退回无 variant 的基类                     | skills 几何红  | **真红**，每语言 6 行（tablist height 36/30、tab background、tablist color…） |
| N2  | `Tabs` 根去掉 `group/tabs`                           | 应当红         | **假绿**——台账零反应（见下）                                                  |
| N3  | header 内「标签块 / 按钮块」前后对调                 | `order` 行回来 | **真红**，那一行逐字回来 + tab/tablist x 各偏 678 / 700                       |
| N4  | 给 `TabsTrigger` 注入 `w-full`，用 **HEAD 那份**守卫 | 应当红         | **HEAD 5/5 全绿**（假绿证实）；修好的守卫当场红                               |
| N5  | 删除项退回 `as="button"`                             | 菜单项宽度红   | **真红**：182 vs 81.8 / 68                                                    |

**N2 是本轮唯一的假绿，两条原因都值得记住**：

1. 横向 tablist 去掉 `h-9` 之后的自然高度**恰好也是 36px**（`p-[3px]` + 触发器 30px）；
2. `line` 档的选中态**全靠 `::after` 那根下划线**，而**取样面看不见伪元素**。

第 2 条是新的盲区：整个 `line` variant 的视觉主体不在任何一档的量程里。
已挂进一页纸清单。

### 五、还撞到一条

`app/components/ui/tabs/variants.ts` 头里写着 `【架构位置】 L2`，
但没登记进 `tests/architecture.test.ts` 的 `l2Files`——`verify` 与 `standalone-sim`
双双当场红（wave 105 那条双向校验在守）。补登记后绿。**这条守卫是活的，不是摆设。**

### 六、批尾九条全套（逐条真跑，2026-09-07）

| 门禁             | 读数                                                         |
| ---------------- | ------------------------------------------------------------ |
| `verify`         | exit 0；**267 文件 / 2214 单测**；词典两个 locale 各 942 key |
| `standalone-sim` | exit 0；跑过 **15** / 未跑 5 / **红 0**                      |
| `e2e-parity`     | **97 passed**；台账 **197 行 / 89 样本**                     |
| `e2e-mock`       | 265 + 22 + 15 + 2 + 6，全绿                                  |
| `e2e-visual`     | 8 passed                                                     |
| `asset-budget`   | exit 0                                                       |
| `e2e-backend`    | 2 + 5 + 2 + 3 + 3 + 5 + 1 + 1，全绿                          |
| `icon-parity`    | **0 处待核**、0 条 ⚠                                         |
| `audit`          | **红 14**（与预期一致，分诊在 Makefile 的 audit 上方）       |

**顺手订正一个数**：`e2e-parity` 此前一路记的是「96 条」，实测是
**97**（`playwright test --list` 报 `Total: 97 tests in 3 files`——
`diff.spec.ts` 3 条 + `scenarios.spec.ts` 92 条 + **`topology.spec.ts` 2 条**）。
本轮没有动过场景表，所以少的那一条是旧读数漏了 `topology.spec.ts` 里的一条，
不是这一轮新增的。

**批到此结束**（143 / 144 / 145）。下一批从 wave 146 起算。

### 七、下一轮：**把伪元素接进取样面**

本轮的 N2 假绿指的很明确：`line` 档的选中态**全部画在 `::after` 上**，
而八档里没有一档量伪元素——也就是说**刚搬进来的这套 variant，视觉主体没有人在守**。

1. 先过线索 258 那道门槛：「有没有一种变异能让新档响、而现有各档都不响」——
   **N2 本身就是答案**（去掉 `group/tabs`，下划线整根消失，台账零反应）。举得出来，可以做。
2. 做法：在 `sampleGeometry` 里对**已有的锚点**顺带取
   `getComputedStyle(el, "::after")` 的 `content` / `opacity` / `height` / `background-color`
   （`::before` 同理）。**只取锚点、不扩面**（线索 214：每加一个锚点就多 30 秒 auto-wait；
   线索 255：先问其中几行是别的档已经报过的）。
3. 量完先看重复率。**如果新档报出来的行几乎都是别的档已经报过的，就撤掉**——
   wave 99 的「层级」那一档就是这么撤的，代码改动为零也是合格的一轮。
4. 撤不撤都要把 N2 这个变异**留成用例**：它是这一档存在与否的判据本身。

---

## 上一轮（wave 144）做了什么：**技能设置页那一屏第一次进取样面——Tabs 的 variant 体系本仓整套没有**

wave 143 顺出来的问题：上游 12 个 `cva`、本仓 4 个，其中 `toggle` / `tabsList` 是
**上游用 variants 参数化、本仓写死**的。这一轮把它量出来。

### 一、先解决「看不见」

wave 133/134 只取了技能页的「失败」与「加载中」两支（那两支里筛选标签被挡掉了），
`integrations#default` 又停在集成面板上——**这一页真正长东西的那一屏一个样本都没有**。
新终态 `integrations#skills`。

**第一版锚点又踩了自己立的规矩**：用了 `skill-review` 这个**本仓独有的 testid**
（上游那些行一个 testid 都没有），**React 侧当场等不到**。改用
`role: "switch", name: "review"`。**wave 131 立的「锚点必须两边都有」，
这是它第一次被我自己违反。**

### 二、量出 14 行 × 两种语言，根因两处

**根因一：`TabsList` / `TabsTrigger` 的 variant 体系本仓整套没有。**
上游 `tabs.tsx:28` 的 `tabsListVariants`（`default` / `line`）靠 `group/tabs-list`
标记 + `group-data-[variant=*]/tabs-list:` 选择器联动，技能页用 `variant="line"`；
本仓两个组件是另写的一套（带边框的胶囊 + `data-[state=active]:bg-accent`），
**连 `variant` 这个 prop 都没有**。逐条对得上：

|                  | 上游                                   | 本仓        |
| ---------------- | -------------------------------------- | ----------- |
| `tablist` color  | 115,115,115（`text-muted-foreground`） | 10,10,10    |
| `tab` background | 透明                                   | 238,235,228 |
| `tab` fontWeight | **500**                                | **400**     |
| `tab` height     | 29                                     | 34          |

**根因二：头部顺序不同。** 上游那一行是「标签在左、创建键在右」
（`skill-settings-page.tsx:81` 的 `<header>`），本仓是创建键单独一行排在标签**上面**
（`order` 报「第 27 个公共节点 React=tablist Vue=button "Create skill"」）。

### 三、这一轮只量不修

修法是把上游那套 variant 体系搬过来再调头部顺序——**成规模的改动，要有自己的前后读数
与负向验证**。这一轮先架尺子。台账 **187 行 / 87 样本 → 219 行 / 89 样本**（走 GROW）。

### 四、下一轮：**修 Tabs**

1. 把 `tabsListVariants` 的两档搬过来（含 `group/tabs-list` 标记），
   `TabsList` 加 `variant` prop，`TabsTrigger` 补上那一串
   `group-data-[variant=line]/tabs-list:*`；
2. 技能页调用点传 `variant="line"`，并把创建键挪进与标签同一行（标签左、按钮右）；
3. 复量，这 14 行应当大部分归零；剩下的逐条声明。

**批次**：143、144 已在批内，**下一轮是批尾，跑九条全套。**

---

## 上一轮（wave 143）做了什么：**把 cva variants 那一类也接进基类比对——三个最高频组件一字不差**

wave 141/142 的比对只覆盖「基类是字符串字面量」的写法，
**`Button` / `Badge` / `Alert` 这三个最高频的组件一个都没比过**（类串在
`cva(base, { variants })` 里，上一轮的正则读不出来）。

### 一、第一跑是**否定结果**

`alertVariants` / `badgeVariants` / `buttonVariants`（本仓叫 `rawButtonVariants`，
外面包一层 `cn`，比名字时去掉 `raw`）——**base 与每一档 variant 的类串全部相等**。

**价值在于把那个 0 变成有人维持的 0**：`buttonVariants` 的漂移**对照台账多半看不见**
（variant 的类只在被取样到的那颗按钮上才现形，而 size/variant 的组合远多于取样点）。

### 二、只比同名的三个；另外九个是另一件事

上游 12 个 `cva`、本仓 4 个。其余九个要么是本仓没有的组件
（`inputGroup*` / `item*` / `sidebarMenuButton` / `buttonGroup` / `emptyMedia`），
要么是**本仓没用 variants 表达的**（`toggle` / `tabsList`）。
**「上游用 variants 参数化、本仓写死」不是类串漂移**——要判它得另立一条判据，
而且先得回答「写死是不是就一定不对」。

### 三、负向验证与读数

- 变异：`buttonVariants` 的 default size `h-9` → `h-10` ⇒ **红**
  （`buttonVariants.default 只在上游[h-9] 只在本仓[h-10]`）
- `verify` exit 0，**267 文件 / 2214 用例**（用例 +2，文件数不变）
- **没跑 `e2e-parity`**：这一轮**一行产品代码都没动**，台账没有可测量的前后差别。
  新节奏里 `e2e-parity` 是「先量再改」的尺子，**没有改就没有要量的东西**；
  下一次全套清扫会连它一起跑到。

### 四、下一轮

批里已经跑了 wave 143 一轮（142 收尾时刚跑过全套）。**再做两轮就到批尾，届时跑全套九条。**
候选：

1. `/workspace/chats/[thread_id]` 上还没取样的终态（第⑦类还剩的几屏）；
2. 「上游用 variants 参数化、本仓写死」那一类——先回答判据问题，再决定要不要立。

---

## 上一轮（wave 142）做了什么：**清掉 primitive 基类声明表里那三条「真差异、待修」**

### 一、两个 DropdownMenu content：三处，三个不同的理由

| 类              | 为什么去掉 / 改掉                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `border-border` | **与 base layer 重复**——两个应用的基础层都给 `*` 设了边框色（上游 `globals.css:323`、本仓 `main.css:137`）。这是 wave 140 那条「调用点重复」的同族，只不过这次重复的是 base layer。 |
| `text-sm`       | **上游不在容器上设字号**：`DropdownMenuItem` 两边都各自写着 `text-sm`；容器上再设一次会把菜单里**不是菜单项**的东西（标题、分隔、自定义内容）一起改掉。                             |
| `shadow-lg`     | 上游 `dropdown-menu.tsx:45` 的 Content 是 **`shadow-md`**，233 行的 SubContent 才是 `shadow-lg`。本仓两个都写成了 `shadow-lg`——**Content 这一个是错的**。                           |

### 二、HoverCardContent

`w-80`→`w-64`、`p-3`→`p-4`、`outline-none`→`outline-hidden`，补上整组进出动画与
`origin-(--reka-hover-card-content-transform-origin)`（reka 确实导出它）。

**`outline-hidden` 与 `outline-none` 在 Tailwind v4 里不是同一件事**（前者保留
forced-colors 下的轮廓）——**别当成等价写法**。
本仓唯一一处用 HoverCard 的地方传的是 `class="w-auto p-2"`，把宽度与内距都覆盖了，
所以这次改基类**不改变任何现有渲染**，改的是这颗 primitive 对将来调用者的合同。

### 三、结果与读数

**声明表里一条「待修」都不剩**：剩下 7 条只差 z-index（本仓统一那一层）、
`--reka-*` 对 `--radix-*` 的变量名、Tailwind 等价写法，外加 ScrollArea 那笔已决定的账。
**再有新条目进来就是新的漂移。**

- 改动前（= wave 141 收工那一跑）：`e2e-parity` **95 passed**，台账 **187 行 / 87 样本**
- 改动后：**95 passed (9.6m)**，台账 **187 行 / 87 样本，一行没动**（与 wave 141 同因，线索 287）

### 四、**收工门禁的节奏从这一轮之后改了**（用户 2026-09-07 明确要求）

原来是「每轮跑九条全套」，实测单轮固定成本二十多分钟。改成：

- **每轮仍跑**：`e2e-parity`（**它就是「先量再改」的那把尺子，不能省**）+ `vitest run tests/unit`
  - 该场景的定向 e2e；
- **每 3~4 轮跑一次**九条全套清扫；
- **批不超过 4 轮**——批里某一轮引入的回归要到批尾才发现，红了就在批内二分。

**没改的是硬规则本身**：改动前后仍然各要一次读数、负向验证仍然逐条做、
收工文档与记忆仍然每轮写。省掉的只是**回归清扫的频率**，不是测量。

---

## 上一轮（wave 141）做了什么：**逐个对比两边 primitive 的基类——37 个里 10 个不一致，四处漏抄已修**

wave 140 的负向验证 N2 是一条**否定结果**：那一轮的 `primitive-class-overrides`
只管「调用点重复传了基类里已有的类」，**抓不到那一轮真正的发现**
（两边 primitive 的基类本身不一样）。这一轮补上缺的那条判据。

### 一、第一跑 10 条不一致；四处是漏抄，已修

| 组件                    | 少了什么                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CommandShortcut`       | `tracking-widest`                                                                                                                      |
| `DropdownMenuSeparator` | `-mx-1`（分隔线的负外边距）                                                                                                            |
| `TabsContent`           | `flex-1`                                                                                                                               |
| `TooltipContent`        | `data-[state=closed]:zoom-out-95`、四条 `data-[side=*]:slide-in-from-*`、`dark:bg-[#050504]`、transform-origin——**整组进出动画都没有** |

TooltipContent 那条 origin 用 `--reka-tooltip-content-transform-origin`
（实测 reka 确实导出它：`node_modules/reka-ui/dist/Tooltip/TooltipContentImpl.js:128`），
与上游的 `--radix-*` 一一对应，**没有照抄 radix 的变量名**。

### 二、剩下 7 条逐条声明，分三类

- **已决定**：z-index（本仓统一到 80，tooltip 90）、ScrollArea 那一整类（wave 98）；
- **天生不同**：`--reka-*` 对 `--radix-*`；`min-w-32` ≡ `min-w-[8rem]`；
  `top-1/2 -translate-x-1/2` ≡ `top-[50%] translate-x-[-50%]`；
- **真差异、待修**（下一轮）：`DropdownMenuContent` / `SubContent` 多 `border-border`
  `text-sm`、`shadow-lg` 对上游 `shadow-md`；`HoverCardContent` 的 `w-80` 对 `w-64`、
  `p-3` 对 `p-4`、`outline-none` 对 `outline-hidden`，还缺整组进出动画。

**判据不是「必须一字不差」**（两个组件库的变量名天生不同），
而是「**不一致的必须有名有姓地声明，并写清是哪一类**」，且**声明表双向**
——修好之后声明留着不删同样报错（线索 186）。

### 三、这一轮修的四处，**对照台账一处都看不见**

改完 `e2e-parity` **95 passed，台账 187 行 / 87 样本一行没动**。
tooltip 那组动画是 `animate-in` / `data-[state=closed]:*`，取样时早已结束；
另外三处所在组件当前没有一个锚点落在上面。
**它们是靠源码对源码比出来的**——这正是这条新判据存在的理由。

### 四、负向验证（一条对一条打在三条用例上）

| #   | 变异                             | 实测                                           |
| --- | -------------------------------- | ---------------------------------------------- |
| N1  | 把 `tracking-widest` 拿掉        | **红** `['CommandShortcut']`（不一致且没声明） |
| N2  | 删掉 `ScrollArea` 那条声明       | **红** `['ScrollArea']`                        |
| N3  | 给一个本来就一致的组件加一条声明 | **红** `['Badge']`（过期声明）                 |

### 五、顺带避开的一处旧坑

`reactBases()` 在兄弟应用缺席时**直接返回空表**——`describe.skipIf` 跳过的是**用例**
不是**收集**，`describe` 回调体在收集阶段就会读 `../frontend`（wave 83 踩过一模一样的一次）。
文件已登记进 `CROSS_APP_BY_DESIGN`，`standalone-sim` 因此**多跑一条（15 条）**。

### 六、下一轮

把第二节那三条「真差异、待修」做掉：`DropdownMenuContent` / `SubContent` 的
`border-border` `text-sm` `shadow-lg`，以及 `HoverCardContent` 的尺寸、内距、
`outline-hidden` 与整组动画。**注意 `outline-hidden` 与 `outline-none` 在 Tailwind v4 里
不是同一件事**（前者保留 forced-colors 下的轮廓），别当成等价写法。

---

## 上一轮（wave 140）做了什么：**深色主题少了上游的全局字重 300——几何档加 `fontWeight`，第一跑就抓到**

wave 139 那句「调用点重复传 `text-lg`，把基类的 `leading-none` 顶掉了」是一条
**写下来当规则用、却没有任何机器在守**的话。这一轮把它做成扫描——
**扫描本身只报了 3 处看着无害的重复，顺着那 3 处查下去才是真正的产出。**

### 一、primitive 的基类被改过

|      | `DropdownMenuLabel` 的基类                                  |
| ---- | ----------------------------------------------------------- |
| 上游 | `px-2 py-1.5 `**`text-sm font-medium`**` data-[inset]:pl-8` |
| 本仓 | **`text-muted-foreground`**`px-2 py-1.5`**`text-xs`**       |

本仓**把调用点的覆盖烤进了 primitive**，同时丢掉了 `font-medium` 与 `data-[inset]:pl-8`。
连锁后果是本仓自己的调用点再去补偿：`TokenUsageIndicator.vue` 那两处写着
`class="text-foreground text-sm font-semibold"`，而上游同一处是**光秃秃的
`<DropdownMenuLabel>`**——token 用量菜单的分组标题**上游 medium、本仓 semibold**。
基类改回上游、补偿删掉；那三处 `text-muted-foreground text-xs` **不动**
（与上游一字不差，在新基类下变成有意义的覆盖）。

### 二、给几何档加 `fontWeight`——第一跑 6 行

aria 树不带字重、几何档只采 color/fontSize/opacity/命中测试。按坑 258 的判据，
**只改一个 `font-weight`，现有各档一行都不会动**。加上之后：

```
selector:textarea fontWeight React=300 Vue=400   ×6（全部落在 dark 样本上）
```

**根因不在 textarea**：上游 `frontend/src/styles/globals.css:318` 在 `.dark` 块里写着
`font-weight: 300`，**本仓 `main.css` 整条没有**——深色下所有没有显式字重的文字都比上游
重一档。补上之后 **6 行归零**。

### 三、新门禁 `tests/guards/primitive-class-overrides.test.ts`

判据是**「重复了、并且顶掉了基类里别的东西」，两个条件都要**。
只用前半条时立刻撞上反例：`MemorySettings.vue:393` 的 `<Input class="min-w-0 …">`
重复了基类的 `min-w-0`，**而上游那一处一字不差地也是这么写的**——按「重复即报」
就得让本仓与上游的源码分家，而渲染一模一样。**照抄上游是更高的一条规矩。**

**扫描面自己是双向的**，而且它在这一轮**顶出了两次正则漏洞**（漏 prettier 尾逗号 →
21 个组件全落到「第三种」；只认单个字面量 → `Input.vue` 那种多段的又落出去 4 个）。

### 四、负向验证：**其中一条是否定结果**

| #   | 变异                                      | 预期     | 实测                                                   |
| --- | ----------------------------------------- | -------- | ------------------------------------------------------ |
| N1  | 把 wave 139 那处 `class="text-lg"` 写回去 | 新门禁红 | **红**：`重复传 [text-lg] → 基类被顶掉 [leading-none]` |
| N2  | 把 `DropdownMenuLabel` 的基类改回原样     | 新门禁红 | **绿（4 passed）**                                     |
| N3  | 去掉 `main.css` 那行 `font-weight: 300`   | 几何档红 | **红 6 行**                                            |

**N2 是这一轮最该记的**：**新门禁抓不到本轮的主要发现**。那处不是「调用点重复」，
而是「**两个应用的 primitive 基类本身不一样**」——需要另一条判据。
**别把「我加了个门禁」当成「这一类以后有人守了」。**

### 五、读数

- 改动前（= wave 139 收工那一跑）：`e2e-parity` **95 passed**，台账 **187 行 / 87 样本**
- 改动后：**95 passed (9.4m)**，台账 **187 行 / 87 样本**（**新加一整档、净增 0 行**）
- `verify` **266 文件 / 2209 用例**（新门禁 +1 文件 / +4 用例）

### 六、下一轮：**把 N2 那条缺口补上**

**逐个对比两个应用同名 primitive 的基类字符串。** 判据现成、双向、零豁免：
`app/components/ui/**` 与 `frontend/src/components/ui/**` 里同名组件的 `cn()` 第一段
字面量应当逐字相等；不相等的每一条要么改回去、要么有名有姓地写下理由。
wave 140 这一处（`DropdownMenuLabel`）就是靠手工比出来的，**说明这条判据有货**。
注意它必然要处理「本仓有、上游没有」和反过来的两类，以及 Vue/React 拆文件方式不同
（`ui/dialog/DialogTitle.vue` vs `ui/dialog.tsx` 里的一个函数）。

---

## 上一轮（wave 139）做了什么：**把我自己 wave 137 的错归因查到底——那 3.9px 是三件事互相抵消**

wave 137 把模型设置对话框那 3.9px 记成「可访问名那处布局差异的投影」；
wave 138 把可访问名整个改完之后**它一点没变**。这一轮用探针逐层量下去。

### 一、真正的出处

| 应用  | 元素                                            | 高       | line-height   |
| ----- | ----------------------------------------------- | -------- | ------------- |
| Vue   | `H2.font-semibold `**`text-lg`**                | **28.0** | **28.0001px** |
| React | `H2.text-lg `**`leading-none`**` font-semibold` | 18.0     | 18px          |

`DialogTitle` 这颗 primitive 的基类两边都是 `text-lg leading-none font-semibold`，
而本仓**在调用点又传了一次** `class="text-lg"`。`cn`/tailwind-merge 把它当成同一组的
后来者，**连带把 `leading-none` 顶掉**（Tailwind v4 的 `text-lg` 自带 line-height）。
**那行 class 长得像「无害的重复」**：值和基类一模一样，看上去什么都没改。

### 二、3.9px 的完整分解

```
标题多出的 line-height      Vue +10
最大 token 那一格           Vue +2
上游内容块的 py-1           React +8
--------------------------------
净                          Vue +4   （台账量到 3.9）
```

**三项互相抵消**，所以它长得像「一处小零头」，其实是三件事。
这正是 wave 137 那个归因错在哪里：**「同时出现」不等于「谁是谁的投影」**
（线索 284：要修掉源头再复量才知道）。

### 三、修掉的与留下的

**修掉**：调用点那句 `class="text-lg"`（一行）。
**留下（有意，2 行）**：剩下的是**结构差异**——上游是「header / `div.space-y-4 py-1`
内容块 / footer」三段，本仓把所有字段直接铺在一个 `form.grid gap-4` 里。
台账因此从 `height Δ3.9` 变成 `height Δ-6.1` + `y Δ3.1`（对话框居中，矮了就往下坐）。
**这两行是同一处结构差异的两个投影**（这一次是真的投影，分解在第二节），
**没有用户可见后果**。

### 四、读数与验证

- 改动前（= wave 138 收工那一跑）：`e2e-parity` **95 passed**，台账 **185 行 / 87 样本**
- 改动后：**95 passed (9.4m)**，台账 **187 行 / 87 样本**（−2 +4）

因果是**探针直接量到的**：同一个元素 `lh=28.0001px`（本仓）对 `lh=18px`（上游），
class 列表里本仓那颗**没有 `leading-none`**；改完 `height` 从 `Δ3.9` 翻成 `Δ-6.1`，
**方向翻转、幅度正好 10px**，与量到的标题高度差逐字对上。

### 五、下一轮

**把本仓这个对话框改成与上游一样的三段式**：字段包进 `div.space-y-4 py-1`、
每个字段自身用 `space-y-1.5`（上游 `agent-settings-dialog.tsx:136` 起就是这个形状），
第三节那两行会一起没。**顺带值得扫一遍的**：还有多少处「在调用点重复传 primitive 基类里
已有的类」——这一轮那句 `text-lg` 是**看上去无害、实际顶掉了 `leading-none`** 的写法，
**判据是「传进去的类和基类同组吗」**，同组就会顶掉基类里同组的其它类。

---

## 上一轮（wave 138）做了什么：**两边同改——模型设置对话框里的表单控件对读屏器没有名字**

wave 106 以来第一次动 `frontend/`（**动过上游的从此是二十三轮**，marker 推到 `7f97efd1`）。

### 一、两个应用各有一半问题

- **上游：控件根本没有名字。** `agent-settings-dialog.tsx` 把标签写成
  `<span className="text-sm font-medium">`——不是 `<label>`、没有 `htmlFor`、
  控件上也没有 `aria-label`。模型下拉与两个数字输入在可访问性树里是
  `- combobox` / `- spinbutton` / `- spinbutton`，**一个名字都没有**
  （WCAG 3.3.2 / 4.1.2）；thinking 与 reasoning 那两个下拉同样如此。
- **本仓：名字里混进了提示文字。** 两个数字输入用「`<label>` 整个包住输入框」的隐式关联，
  而温度那条提示 `<span>` 也在 `<label>` 内部，读屏器把整句提示念成名字的一部分：
  `- spinbutton "Temperature 0 = deterministic, higher = more creative (0–2)."`

### 二、改法：`id` + `aria-labelledby`（温度那条加 `aria-describedby`）

**不是新发明的写法**——本仓那三个 Select 早就写着
`aria-labelledby="agent-settings-*-label"`。上游**没有 `Label` primitive**
（`components/ui/` 下没有 label.tsx，全仓一个 `<Label` 都没有），
所以补一个新组件是更大的改动也不必要；指向已有的标签 `<span>` 就够，**视觉一像素不变**。
顺带把本仓那条提示由 `<span>` 改成 `<p>`（与上游一致；`<span>` 不产生
可访问性节点，会和下一段标签粘成同一段）。

### 三、读数

| 阶段                                                    | 台账                                                 |
| ------------------------------------------------------- | ---------------------------------------------------- |
| 改动前（= wave 137 收工那一跑，`e2e-parity` 95 passed） | **199 行 / 87 样本**                                 |
| 改可访问名之后                                          | **191 行**（−10 +2）                                 |
| 再对齐 `<p>` 之后                                       | **185 行 / 87 样本**（−6 +0，**纯缩短、不用 GROW**） |

**净减 14 行。还剩一行有意留着**：`- combobox "Default model"`（上游）vs
`- combobox "Default model": parity-basic · Unavailable`（本仓）——
agent 配的模型不在可用清单里时，本仓仍然显示它并标注「不可用」
（`agents.settingsModelUnavailable`，**上游词典里没有这条 key**），上游那个下拉是空的。
**保留本仓。翻案判据**：上游给 `<SelectValue>` 补上「值不在清单里」那一支。

### 四、React 那三条门禁：一次红、一次绿，两个读数都记下来

```
pnpm check     exit 0
pnpm test      exit 0   138 文件 / 1034 用例，0 失败
pnpm test:e2e  第一跑 145 passed / 1 failed；第二跑 146 passed exit 0
```

红的是 `tests/e2e/landing.spec.ts:61`（落地页技能动画的 `boundingBox` 超时），
**是交接文档里记了很多轮的已知抖动第一条，与这次改动无关**（这次只动了
`agent-settings-dialog.tsx`）。**第一跑是与 Vue 那九条门禁并跑的**，第二跑单独跑
（`load averages: 3.39`）绿。**两个读数都在，不要读成因果**——这一条本来就是负载敏感的
（wave 108/112 记过同样的坑）。

### 五、下一轮

`agents-feature-disabled#gallery` 上还剩 **18 行 / 语言**，全部已决定：

- 1 行下拉的值（上面第三节，保留本仓）；
- 2 行对话框标题带不带 agent 名（保留本仓）；
- 7 行卡片动作控件 `<Button onClick>` vs `<NuxtLink>`（同 wave 135 那一条）；
- 1 行初始焦点 incidental；1 行对话框高度差 3.9px；其余是这几条的投影。

**那 3.9px 值得再看一眼**：wave 137 判断它是可访问名那处布局差异的投影，
而这一轮改完它**没有变**——也就是说那个判断是错的，**它另有出处，下一轮去量**。

---

## 上一轮（wave 137）做了什么：**AgentCard 与模型设置对话框第一次进取样面——量出上游那五个表单控件都没有名字**

wave 135 只接了画廊的**加载态**（那一屏一张卡都没有）。这一轮接「有数据 + 打开设置对话框」，
它同时补上 wave 136 缺的那一半（把模型清单改成「打开对话框才取」之后，
**没有任何自动化在守「冷开画廊、打开对话框、清单仍然到得了」**——这里是冷开的）。

### 一、先踩到一件事：夹具缺字段会让**两个应用一起白屏**

第一版复用了 `MOCK_AGENTS`（只有 name/description/system_prompt），两个应用都只剩页头
——`Agent` 类型里 `model` / `tool_groups` / `skills` 是必填的，卡片直接对它们取 `.length`。
**这件事台账看不见**（两边一起坏，wave 88 的同一形状），是被「锚点等不到」抓出来的。
新加 `GALLERY_AGENTS`，两个 agent 刻意走不同分支（一个有值、一个三项全 `null`）。

### 二、量出 22 行 × 两种语言，逐类交代

| #   | 类                                                        | 行数/语言 | 处置                               |
| --- | --------------------------------------------------------- | --------- | ---------------------------------- |
| ①   | **上游那五个表单控件对读屏器都是无名的**                  | 13        | **已归因、待修**（下一轮两边同改） |
| ②   | 对话框标题带不带 agent 名                                 | 2         | **保留本仓**                       |
| ③   | 卡片动作控件：上游 `<Button onClick>` / 本仓 `<NuxtLink>` | 7         | **保留本仓**（同 wave 135 那一条） |
| ④   | 初始焦点 `React=button Vue=input[number]`                 | 1         | incidental（wave 94 那一类）       |
| ⑤   | 对话框高度还差 3.9px                                      | 1         | ① 修完再复量                       |

**①的证据**：上游 `agent-settings-dialog.tsx:137/158/178` 把标签写成
`<span className="text-sm font-medium">`——**不是 `<label>`、没有 `htmlFor`、
控件上也没有 `aria-label`**，于是模型下拉与两个数字输入在可访问性树里全是无名的
（WCAG 3.3.2 / 4.1.2）。本仓那三个都有名字。
**按判据应当两边同改**（上游自己是坏的；仓库对同形缺陷同改过三次：wave 88/89 的
`aria-pressed`、wave 97 的 ScrollArea `tabIndex`）。**这一轮没做**——那是跨应用改动，
要另配 chore 提交推 marker、还要跑 React 那三条门禁。

**②的理由**：画廊上可以有很多 agent，上游那个标题不告诉你在改哪一个。
**翻案判据**：上游把 agent 名加进标题。

### 三、这一轮修掉的：对话框宽度

两边 `DialogContent` 的基类都是 `sm:max-w-lg`（512px），而本仓在**这一处**单独覆盖成
`sm:max-w-md`（448px），上游那一处什么都没传。几何档报 `width Δ-64`。
去掉覆盖、回到共用默认值（**primitive 的默认值正是天生看不见的第⑤类**）。
改完 `x` 与 `width` 归零。

### 四、读数与负向验证

- 改动前（= wave 136 收工那一跑）：`e2e-parity` **93 passed**，台账 **155 / 85**
- 接上取样面、改宽度之前：该终态 **24 行 / 语言**
- 改动后：**22 行 / 语言**，`e2e-parity` **95 passed (9.2m)**，台账 **199 行 / 87 样本**

| #    | 变异                           | 预期         | 实测                                         |
| ---- | ------------------------------ | ------------ | -------------------------------------------- |
| 对照 | 无                             | 6 条全绿     | **6 passed (1.6m)**，exit 0                  |
| N1   | 夹具换回缺字段的 `MOCK_AGENTS` | 该终态两条红 | **2 failed**（30.9 / 31.5s，两个应用都白屏） |

N1 不是特意设计的，是第一版就踩到的真事。

### 五、下一轮：**这是本轮唯一该做的事**

**两边同改，给上游那个对话框的五个控件补上可访问名。** 判据、证据、行号都在第二节 ①。
做法建议：把 `<span className="text-sm font-medium">` 换成 shadcn 的 `<Label htmlFor>`
并给控件加 `id`（比加 `aria-label` 更符合上游自己的既定写法），
本仓那一侧顺带对齐「提示文字是独立 `<p>` 还是折进可访问名」——
第二节 ⑤ 那 3.9px 多半跟着一起没。

**别忘了跨应用改动的规矩**：代码放同一个提交，另配一条 `chore` 提交
`make -C frontend-vue upstream-accept` 推 marker；收工门禁要多跑 React 那三条
（`pnpm check` / `pnpm test` / `pnpm test:e2e`，端口 3002）。

---

## 上一轮（wave 136）做了什么：**模型清单等到对话框真的打开才取——并抓到自己的一次无效变异**

wave 135 挂的那行账：`requestsOnlyVue: GET /api/models`。上游把 `useModels()` 放在
`agent-settings-dialog.tsx:58`（**打开对话框才取**），本仓写的是 `enabled: featureEnabled`
（**进画廊页就取**）。只是来浏览画廊的人不需要模型清单。

### 一、改法：改谓词，不搬家

`enabled: computed(() => featureEnabled.value && editing.value !== null)`。

**没有把 `useModels` 搬进对话框组件**——这份工作区的服务端真相一律由页面/composable
这一层的 Query 持有（`ARCHITECTURE.md` 那一节），对话框只收 props，单测也是靠 props
挂载的；搬家会同时改掉架构边界和一份干净的 props-in/DOM-out 单测。
改谓词与 `ChatComposer.vue:260`、`AgentChat.vue:187` 的既定写法一致。
`useModels` 是 `staleTime: Infinity`，关掉再打开直接命中缓存。

### 二、读数（同一棵树前后两跑，只差这一行谓词）

- 改动前（= wave 135 收工那一跑）：`e2e-parity` **93 passed**，台账 **157 行 / 85 样本**
- 改动后：**93 passed (9.2m)**，台账 **155 行 / 85 样本**

两种语言各掉一行，掉的正是那条 `GET /api/models`。**这一轮 accept 不需要 GROW**
——台账是缩短的（近几轮第一次）。

### 三、负向验证：**一次无效变异，如实记下来**

本想拿现成的 `make e2e-agents` 当安全网（`agents.spec.ts:247` 真的打开
「Model settings」对话框、按 `data-value` 选 `reasoning-model`），
于是把谓词整个改成 `false` 再跑——**3 条全绿**。

**那不是「安全网有效」，是变异无效**：那条用例回到画廊之前先走过 `/workspace/agents/new`
与 agent 会话页，那一屏的模型选择器已经把 `MODELS_QUERY_KEY` 填进了 TanStack 缓存；
**一个 `enabled: false` 的查询照样读缓存**。

**所以这一轮的验证只有一半**：

- 有验证的：请求确实不再发（台账那两行掉了）。
- **没有自动化守着的**：「冷开画廊、打开对话框、模型清单仍然到得了」。

### 四、下一轮（这两件事是同一件）

**给画廊加一个「有数据 + 打开设置对话框」的终态**：
`agents-feature-disabled` 再加一个 state——feature 开着、`/api/agents` 返回两个 agent
（不延迟）、步骤点开 `agent-card-*` 上的「Model settings」按钮。
它一次做两件事：

1. **第一次把 `AgentCard` 与设置对话框接进对照取样面**（预计还会露出一批，
   按线索 278 先去现有样本 grep 已决定类，别重复计价）；
2. **正好补上第三节缺的那一半**——两个应用都要在冷开的画廊里把模型清单取回来才画得出
   同一个 `<Select>`，取不回来就会在台账上现形。

---

## 上一轮（wave 135）做了什么：**agents 画廊页第一次进取样面——量出四处，修掉两处**

wave 134 的 `delayMs` 只在设置对话框里用过一次。这一轮拿它去开一整屏此前
**一行台账都没有**的页面（第⑦类：这一屏压根没被取样）。

### 一、怎么开的

场景 id 编不出新的，而 `agents-feature-disabled` 的路径就是 `/workspace/agents`
——它此前只走「功能已关闭」那一支。加一个终态：**把 feature 覆盖回开着**，
再让 `/api/agents` 慢 15 秒。`settle` 改成**空的**（两个终态一个共有元素都没有；
几何取样取 `settle` **与** `state.steps`，一格不少）。

### 二、量出四处

| #   | 差异                                                                                                                                             | 处置                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| 1   | 新建入口样式是手写的（上游 `<Button>` + 加号图标、h-9、`text-sm`；本仓 `px-3 py-2`、**没图标**）：`width Δ-22.6 / height Δ4 / fontSize 16 vs 14` | **已修**（`buttonVariants()` + `<Plus>`） |
| 2   | 加载占位不是同一个东西（上游是**居中的 h-40 盒子**、`text-sm`；本仓左上角一行 16px 字）：`height React=160 Vue=24 Δ-136`                         | **已修**                                  |
| 3   | 元素类型不同（上游 `<Button onClick>`、本仓 `<NuxtLink>`）                                                                                       | **保留本仓**（4 行）                      |
| 4   | 加载文案不是同一条（上游 `t.common.loading`；本仓自有的 `agents.loading` + `role="status"`）                                                     | **保留本仓**（2 行）                      |

第 3 条的理由：「点了就跳到某个 URL」的控件，业界主流是链接——中键新标签页、复制链接、
读屏器念成链接，上游那颗三样都做不到。**不做两边同改**：改上游要 `Button asChild`，
而本仓 wave 37/58 判过「`Button` 的 as-child 不做」。**翻案判据**：上游上了 `asChild`。

另有 **1 行挂账**：`requestsOnlyVue: GET /api/models`——上游把 `useModels()` 放在
`agent-settings-dialog.tsx:58`（打开对话框才取），本仓放在画廊页 `index.vue:44`
（进页面就取）。**上游那种更省**。改法是把 `useModels` 挪进对话框组件、
去掉页面上的两个 prop，**跨两个文件还要动单测，这一轮不做**。

### 三、读数

- 改动前（= wave 134 收工那一跑）：`e2e-parity` **91 passed**，台账 **141 / 83**
- 接上取样面、改动前：该终态 **10 行 / 语言**
- 改动后：该终态 **8 行 / 语言**，`e2e-parity` **93 passed (9.2m)**，台账 **157 行 / 85 样本**

第 1 处那五行几何是**加了新锚点之后才露出来的**，修完把锚点留在原地复量、**归零**
——修没修好有人盯着，不是一句「改了」。

### 四、负向验证：第一版锚点被当场抓到太松

| #    | 变异                              | 预期         | 实测                                   |
| ---- | --------------------------------- | ------------ | -------------------------------------- |
| 对照 | 无                                | 4 条全绿     | **4 passed (1.2m)**，exit 0            |
| N1   | 去掉「把 feature 覆盖回开着」那条 | 该终态两条红 | **zh-CN 红、en-US 绿（395ms）** ← 假绿 |
| N1c  | 同一个变异，锚点收紧之后          | 该终态两条红 | **两条都红**（31.0 / 31.1s）           |

N1 那次假绿是真信号：第一版只钉那句加载文案，而本仓那句的条件是
`!features.loaded.value || agentCatalog.loading.value`——`/api/features` 还没回来的
那一小段里它同样在。**两种语言表现不同，正说明那是一场竞态。**
收紧办法：先钉页头 `heading`（两边画廊页都是 `<h1>{agents.title}</h1>`，
而「功能已关闭」那一页两边画的都是 `<p>`）。

### 五、两条新踩坑

- **`getByText` 用正则时不做空白归一**：给新建入口加图标之后，
  `getByText(/^(New Agent|新建智能体)$/)` **在本仓这一侧突然等不到、上游那一侧照常匹配**
  ——Vue 模板在 `<Plus />` 与插值之间留了一个空白文本节点（`" New Agent "`），
  上游 JSX 里两者紧挨着。**手动挤掉会被 `prettier --write` 格式化回来。**
  可访问名不受影响，所以前置锚点用 `role: "heading"`，几何那一格用**不加 `^$` 的正则**
  （`text=` 只取最内层元素，不会落到 header 上）。
- **线索 277 又踩了一次**：注释里写 `**` + `/api/features` 把块注释提前关掉，
  `prettier` 当场 `SyntaxError`。已在注释里就地标注。

### 六、下一轮

1. **把 `useModels` 挪进 `AgentSettingsDialog`**（上面挂的那一行账）。
2. **`agents-feature-disabled#default` 之外，画廊「有数据」那一屏还没取样**：
   加一个终态（feature 开着 + `/api/agents` 返回两个 agent，不延迟），
   会第一次比到 `AgentCard`。**预计还会露出一批**，按线索 278 先 grep 已决定类。

---

## 上一轮（wave 134）做了什么：**给取样面接上「还在转」那一档，并订正 wave 133 引错的一条证据**

wave 133 只对齐了「取数失败」那一支，**「还在转」那一支当时没量过、所以没动**。
这一轮补上——**取样面此前一个「加载中」的样本都没有**。

### 一、新机制：`ParityRouteOverride.delayMs`

`states` 造得出「失败」，因为失败是一个稳定终态；**「加载中」不是**——正常 mock 立刻返回，
取样时它早过去了。加一个字段让应答慢到取样窗口之后，两个应用就都停在各自的加载分支上。
**仍然是纯数据**（一个数字），等待发生在 `installRoutes` 的固定实现里。
取 **15 秒**：比整条取样链（步骤 auto-wait + `settleMs` 700ms）长一个量级，
又不会让失败时的报错等满用例的 30s 预算。

### 二、量出来的（第一跑 12 行 × 两种语言）

```
ariaOnlyReact   - main: Loading...
ariaOnlyVue     - button "Create skill" / - main: / - paragraph: Loading...
                - tab "Custom" / - tab "Public" [selected] / - tablist "Agent Skills":
geometry        text:/^(Loading…)$/ y React=280 Vue=378 Δ98
tabOrder / tabbablesOnly*   共 4 条
```

**与 wave 133 同一处根因**，**外加一条新的**：本仓那句 `Loading...` 写在 `<p>` 里，
在可访问性树里多出一个 `paragraph` 节点；上游那一句是 `<div>`，直接挂在 main 的文本上。

### 三、改动与读数

`SkillSettings.vue`：创建键那一行、`<Tabs>`、清单三处补上 `!skills.loading.value`；
`Loading...` 由 `<p>` 改成 `<div>`（**仓内先例**：同目录 `ToolSettings.vue` 的空态
早就因为同一条理由用的 `<div>`）。

- 改动前（= wave 133 收工那一跑）：`e2e-parity` **89 passed**，台账 **137 / 81**
- 接上取样面、改 Vue 之前：该终态 **12 行 / 语言**
- 改动后：该终态 **2 行 / 语言**，`e2e-parity` **91 passed (8.9m)**，台账 **141 行 / 83 样本**

**剩下 2 行 / 语言不需要新决定**（ScrollArea 那一类，这个对话框每个样本上都有；
判据按线索 278 去现有样本里 grep）。**这一档 aria / 几何 / 顺序 / 焦点 / 深度全部归零。**

### 四、负向验证

| #    | 变异           | 预期         | 实测                         |
| ---- | -------------- | ------------ | ---------------------------- |
| 对照 | 无             | 2 条全绿     | **2 passed (57.7s)**，exit 0 |
| N1   | 去掉 `delayMs` | 该终态两条红 | **2 failed**（31.4/31.5s）   |

两处改动的因果分得开：`- paragraph: Loading...` **只可能由 `<p>` → `<div>` 消掉**，
其余几行只可能由三处 `v-if` 消掉。

### 五、订正 wave 133 提交说明里引错的一条证据

`fbed3dde` 写着「红色小字是这份代码库里错误行的既定写法（`actionError`、
**`settings-session-unavailable`** 都是这个样式）」——**后一个例子是错的**。实测分布：

| 样式                                            | 处数                                         |
| ----------------------------------------------- | -------------------------------------------- |
| `text-sm text-red-600`                          | **9**                                        |
| `rounded-md bg-red-50 p-3 text-sm text-red-700` | 4（`settings-session-unavailable` 在这一组） |
| `text-sm text-red-500`                          | 1                                            |

**结论不变**（多数写法就是红色小字，上游那一条连颜色都没有），**引的例子举错了**。
顺带记下：这份代码库里错误行有**两套**样式，本身是一处不一致，**但那不是对照的事**
（上游只有一套「什么都不写」），不在这一轮动。

### 六、同形但量过之后决定不接的

上游 `tool-settings-page.tsx:35` 有同一形状的 `) : error ? (`。**不接**：
本仓 `ToolSettings.vue` 的 loading/error 本来就是 `v-if / v-else-if` 互斥的，
头部也没有像技能页那样的按钮（上游那一页同样没有），
它只会把 wave 133 已判过的那几类在另一屏上再记一次账——**按线索 278 那是重复计价**。
接它还要先给 `**/api/mcp/config` 补一条 mock 路由。

### 七、下一轮

`delayMs` 现在是一把新尺子，**第一次量的应该是它自己够不够用**：

- 还有哪些屏的「加载中」值得接？判据仍是**上游有没有一段代码在这一支上渲染出东西**，
  外加**线索 278**（新样本里有几行是已决定类的复制品，先 grep 再记账）。
- 候选：`agents` 列表页、`scheduled-tasks` 列表、`thread-history`——
  三处本仓都有 skeleton / loading 分支，**先去上游 grep 对应的渲染点**。

---

## 上一轮（wave 133）做了什么：**技能清单取不到时，本仓还留着筛选标签与「创建技能」按钮**

按 wave 129 订正过的判据（**grep 渲染点、不是词典**）继续筛后端失败分支，
筛到设置对话框里的技能页，接上取样面之后当场量出一处真差异。

### 一、为什么挂在 `integrations` 这个场景 id 下

技能设置页在上游**没有对应的 spec 文件**，场景 id 受棘轮约束编不出新的；
夹具与步骤不受约束，按既定做法「直接挂现成场景」。`integrations` 本来就是
**设置对话框**那一屏，导航到「技能」只是一次点击。两边都有这一支
（上游 `skill-settings-page.tsx:50` 的 `) : error ? (`；本仓 `SkillSettings.vue`），
两边 `isAdminRequired` 都是 `status === 403`，所以 500 走 error 那一支。
**锚点用夹具喂进去的那个词（`boom`），不用任何一边的措辞**——措辞本身就是要量的东西。

### 二、量出来的（第一跑 15 行 × 两种语言）

```
ariaOnlyReact   - main: "Error: boom"
ariaOnlyVue     - alert: boom / - main: / - tab "Custom" / - tab "Public" [selected]
                - tablist "Agent Skills": / - button "Create skill"
geometry        text:/boom/ y Δ98、height、color、fontSize
tabOrder / tabbables*   各一条
```

**根因一处**：上游把筛选标签、「创建技能」按钮与清单**一起**放在 `SkillSettingsList` 里，
error 那一支整个不渲染它；本仓把创建键与标签放在状态分支**外面**，
于是取数失败时它们仍然在——一屏拿不到数据、却还留着一颗指向同一个后端的「创建」按钮。

### 三、改动与保留

`SkillSettings.vue` 三处加 `!skills.error.value`（创建键那一行、`<Tabs>`、清单——
清单套一层 `<template v-if>`，`v-if` 不能和 `v-for` 写在同一个元素上）。

**有意保留、有意留在台账里的两点**：错误行是 `role="alert"`（上游是没有 role 的
`<div>`，读屏器不会主动念）；措辞走词典（上游硬编码 `Error: ` 前缀，中文界面上也是英文
——wave 92 判过的那一类）。**翻案判据**：上游给那个 `<div>` 加上 role 或样式。

**没动的**：`loading` 那一支本仓也是加在标签下面而不是替换整块。**这一轮没量过它**，
按「先量再改」不动 —— **下一轮的活**。

### 四、读数

- 改动前（= wave 132 收工那一跑）：`e2e-parity` **87 passed**，台账 **121 / 79**
- 接上取样面、改 Vue 之前：该终态 **15 行 / 语言**
- 改动后：该终态 **8 行 / 语言**，`e2e-parity` **89 passed (8.3m)**，台账 **137 行 / 81 样本**

新增 16 行里**每种语言 2 行是既有已决定类**（`tabbablesOnlyReact: div` 与
`tabOrder: 第 13 个公共可 tab 元素` 在这个对话框现有的 **5 个终态 × 两种语言上都已经有**
——wave 98 判过的 ScrollArea 那一类，逐条查过）。**真正新决定的是每种语言 6 行。**

### 五、负向验证

| #    | 变异                            | 预期         | 实测                         |
| ---- | ------------------------------- | ------------ | ---------------------------- |
| 对照 | 无                              | 2 条全绿     | **2 passed (58.5s)**，exit 0 |
| N1   | 终态的路由 pattern 改成打不中的 | 该终态两条红 | **2 failed**（31.4/31.5s）   |

第三节那处改动的因果**不是靠推的**：同一棵树上跑了两次完整台账，中间只差这一处 `v-if`，
该终态从 **15 行**掉到 **8 行**，掉掉的正好是 `tablist` / 两个 `tab` /
`button "Create skill"` / 那两条 tabbables 与一条几何。

### 六、下一轮

1. **技能页的 `loading` 那一支**：本仓同样是「加在标签下面」而不是替换整块，
   上游是 `isLoading ? 只画一句 Loading : …`。这一轮没量过，先给它一个样本再决定。
   做法与本轮同形——终态里把 `**/api/skills` 挂成一个**永不 resolve**的路由
   （`route.fulfill` 之前 `await new Promise(() => {})` 那种做不到，`ParityRouteOverride`
   是纯数据；可能要给它加一个 `delayMs` 之类的字段，**先想清楚要不要加**）。
2. 同一把梳子还没梳完的失败分支：`workspaceChanges.loadFailed`
   （本仓 `WorkspaceChangesBadge.vue:103`；上游 `core/workspace-changes/api.ts:29` 抛的是
   硬编码英文，**先 grep 上游把它渲染在哪**，没有渲染点就是本仓独有的分支，别接）、
   以及上游 `tool-settings-page.tsx:35` 的同形 `) : error ? (`（MCP 那一页，
   端点 `/api/mcp/config`，**mock 里还没有这条路由**，要先加）。

---

## 上一轮（wave 132）做了什么：**第⑥类第一次量到产品层面的分叉——预览失败时上游仍然选中「预览」**

wave 128 / 129 给「只在某种后端状态下才分叉的渲染路径」接上了两处，两处量出来的
都是同一件事（上游 `retry: 3`）。这一轮第一次量到别的。

### 一、哪份夹具接得住（wave 130 留下的问题）

`artifact-preview` 接不了——它的产物是 `write-file-artifact`，正文来自消息里的
工具结果，**两个应用都不发内容请求**。`artifact-batched-stream` 的产物来自 thread 的
`artifacts` 清单，正文**必须**去取，场景自己那条 `routes` 就是喂正文的，
把同一条 pattern 在终态上盖成 500 就够了。

**顺带订正我自己在 wave 130/131 交接文档里写下的一句话**：那里说「造一份产物来自
artifacts 清单的夹具，会**第一次**让文件下拉那条分支进取样面」——**假的**，
`artifact-batched-stream` 本来就是那条分支（四个产物 + 头部下拉逐个切过去）。
**不需要新夹具，只需要一个新终态。**

### 二、量出来的 8 行（两个语言维度各 4 行）

```
requestsOnlyReact ×3   GET /api/threads/«…»/artifacts/mnt/user-data/outputs/batched-report.md
order             ×1   第 51 个公共节点 React=- radio Vue=- radio [checked]
```

前 6 行是**已判过那一类的第三次复现**（上游 `retry: 3`；用例耗时也印证：
`#default` 4.6s / `#preview-failed` **9.0s**）。**后 2 行是新的，而且是产品层面的。**

### 三、那 2 行是什么：探针量到的，不是推的

| 应用  | #0（代码档）                         | #1（预览档）                         |
| ----- | ------------------------------------ | ------------------------------------ |
| Vue   | `aria-checked=`**`true`** `state=on` | `aria-checked=false state=off`       |
| React | `aria-checked=false state=off`       | `aria-checked=`**`true`** `state=on` |

**预览失败时，本仓选中「代码」，上游仍然选中「预览」。** 机制两边都读过：

- 上游 `frontend/src/core/artifacts/preview.ts:238`
  `initialViewMode: canPreview ? "preview" : "code"` ——**只由文件策略决定**，
  跟正文取没取到无关，所以取失败之后它还停在 preview。
- 本仓 `ArtifactPanel.vue`：`reset()` 把 `viewMode` 置回 `"code"`，
  **只有成功那两条路径**才把它设成 `preview`；失败就停在 code。

**取舍：保留本仓这一侧**（fork-boundary 里那条已授权的例外）。上游那一档等于对读屏器
念「预览，已选中」，而同一屏上写着「无法预览此文件，但仍可下载原始文件」——**自相矛盾**。
**不做两边同改**：上游这一档没有功能后果，只是失败态里一个高亮位置，
够不上「上游自己是坏的」。
**翻案判据**：上游把 `initialViewMode` 接到加载结果上；或这一屏出现「重试」入口。

### 四、读数与负向验证

- 改动前（= wave 131 收工那一跑，同一份代码）：`e2e-parity` **85 passed**，台账 **113 / 77**
- 改动后：**87 passed (8.1m)**，台账 **121 行 / 79 样本**（`PARITY_ACCEPT_GROW=1`，8 行逐条有名有姓）

| #    | 变异                            | 预期                     | 实测                                            |
| ---- | ------------------------------- | ------------------------ | ----------------------------------------------- |
| 对照 | 无                              | 4 条全绿                 | **4 passed (1.4m)**，exit 0                     |
| N1   | 终态的路由 pattern 改成打不中的 | `#preview-failed` 两条红 | **2 failed**（31.4/31.5s），`#default` 两条仍绿 |

### 五、一条新踩坑

**块注释里写 glob 会把注释提前关掉**：`**/api/threads/*/artifacts/**` 里的 `*/`
就是注释结束符，`prettier` 当场报 `SyntaxError: ',' expected`。
注释里提这类 pattern 要写成 `/api/threads/<id>/artifacts/<path>`。

### 六、下一轮

第⑥类现在有三处样本（`integrations` / `scheduled-tasks` / `artifact-batched-stream`），
**而且证明了它能量出产品差异、不只是重试次数**。还能接的同形分支，判据用 wave 129
订正过的那条（**grep 渲染点、不是词典**）：

- `channels` 的连接失败（`channels.connectFailed` 之类）——先 grep 上游有没有渲染点；
- `workspace-changes` 的 `workspaceChanges.loadFailed`（本仓 `WorkspaceChangesBadge.vue:103`）
  ——上游 `frontend/src/core/workspace-changes/api.ts:29` 抛的是硬编码英文，
  **先确认上游把它渲染在哪**，没有渲染点就是本仓独有的分支，别接。

---

## 上一轮（wave 131）做了什么：**把 8 个「一个锚点匹配到多份」逐个核完——3 个是缺陷、5 个正常**

判据用的是 wave 130 定下的那条：**匹配到的那几份是同一个东西的多份，还是不同的东西。**
探针把每一份的标签 / testid / 文本 / 祖先链 / 坐标都打了出来，**两个应用逐条相同**。

| 场景 / 终态                    | 锚点                                                  | 两份分别是什么                                              | 判定                                                                                                                  |
| ------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `branch-thread#turn-actions`   | `role:button[Branch…]`                                | 两个回合各一颗图标键（文本都是空）                          | **正常**，`.first()` 正是被 hover 的那回合                                                                            |
| `branch-thread#turn-actions`   | `[data-assistant-turn]`                               | DIV"First answer" / DIV"Intermediate answer"                | **正常**，同上                                                                                                        |
| `channels#runtime-config-edit` | `text:DingTalk`                                       | SPAN"DingTalk"（侧栏行）/ H2"Modify DingTalk"（对话框标题） | **正常**：这是**场景的 settle 锚点**，钉的就是侧栏那行；终态自己的步骤用的是 `[role=dialog] [data-slot=dialog-title]` |
| `sidecar-chat`                 | `text:/^1 (selected text fragment\|个已选文本片段)$/` | DIV / SPAN，**同一段文字的外层与内层**                      | **正常**：整串正则会同时匹配祖先与后代，两边取的都是外层                                                              |
| `scheduled-tasks#default`      | `schedule-preset` / `schedule-timezone`               | 创建表单 / 编辑表单各一份                                   | **wave 129 已说清并修好**                                                                                             |
| `artifact-preview`             | `text:report.html`                                    | 消息卡 / 面板标题                                           | **缺陷，wave 130 修好**                                                                                               |
| `thread-list-infinite-scroll`  | `text:Conversation 001`                               | **侧栏的会话行 / 页面里那张列表的行**                       | **缺陷** ← 这一轮修                                                                                                   |

### `thread-list-infinite-scroll`：这一屏真正的主角从来没被量过

```
#0  span < a[data-sidebar=menu-button] < li[data-sidebar=menu-item] < …
    @ x=16  y=258 w=112     ← 侧栏的会话行
#1  div < div < div < a < …
    @ x=376 y=176 w=784     ← 页面里那张列表的行
```

`.first()` 落在侧栏那一份上，于是 `settle` 可能在**页面列表还没画出来**时就通过，
几何档那一行量的也是 **112px 的侧栏标签**——而这个场景叫「会话列表页的首屏分页」。
改成 `a:not([data-sidebar]):has-text("…")`（两个应用的侧栏链接都写死
`data-sidebar="menu-button"`）。**没有用 `chats-page-sentinel`**：它是 `aria-hidden`
的 1px 哨兵，量它的几何没有意义，而且只在 `hasMore && !isSearching` 时才渲染。

### 读数与负向验证

- 改动前（= wave 130 收工那一跑，同一份代码）：`e2e-parity` **85 passed**，台账 **113 / 77**
- 改动后：**85 passed**，台账 **113 / 77，一行没动** —— 又是一次**加覆盖面不加账**

| #    | 变异                                      | 预期       | 实测                                 |
| ---- | ----------------------------------------- | ---------- | ------------------------------------ |
| 对照 | 无                                        | 2 条全绿   | **2 passed (57.9s)**，exit 0         |
| M1   | Vue 页面列表行显示 `thread_id` 而不是标题 | 新锚点红   | **2 failed**（两个维度，31.0~31.2s） |
| M1b  | **同一个变异**，锚点换回旧写法            | 旧锚点不响 | **2 passed，exit 0** ← 决定性        |

### 这一类到此结束

wave 129 量出的 8 个现在全部有定论。判据写进场景目录的注释里：
**加锚点时问三句——它在每个维度上都成立吗、它在这一屏上只有一份吗、
如果不止一份那几份是不是同一个东西。**

### 下一轮

**给 artifact 造一份「产物来自 artifacts 列表」的夹具**（thread 上带 `artifacts: [...]`
而不是 write_file 工具调用），然后接 `#preview-failed`
（`{ pattern: "**/api/threads/*/artifacts/**", status: 500, json: { detail: "boom" } }`，
锚点用 `artifactPreview.previewFailed` 的两种译文——**上游那一块没有 testid**）。
wave 130 已经量过：**现有夹具走不通**（`write-file-artifact` 的正文来自消息里的工具结果，
两边都不发那个请求，`/artifacts` 响应 **0** 条）。顺带那份新夹具会第一次让
Select 那条分支进取样面。

---

## 上一轮（wave 130）做了什么：**wave 129 那一类的第二例修掉；并把「下一件活」量到走不通**

### 一、`artifact-preview` 的锚点在点击之前就已经满足

`{ visible, text: "report.html" }` 跟在 `{ click, text: "/artifact-fixtures/report.html" }`
后面，本意是「面板打开了」。但 `getByText` 的**字符串**是子串匹配，消息列表里那张
文件卡的文字就是整条路径。实测（两个应用逐条相同）：

| 时机   | 锚点                    | 匹配数 | `.first()` 的文本                               |
| ------ | ----------------------- | ------ | ----------------------------------------------- |
| 点击前 | `text:report.html`      | **1**  | （那张卡，visible）                             |
| 点击后 | `text:report.html`      | **2**  | `"/artifact-fixtures/report.html"` ← 还是那张卡 |
| 点击前 | `text:/^report\.html$/` | **0**  | —                                               |
| 点击后 | `text:/^report\.html$/` | **1**  | `"report.html"` ← 面板标题                      |

这一步既没等到面板，几何档那一行量的也是消息卡——**而那张卡 `settle` 已经量过一次**。
改成整串匹配的正则。

### 二、`artifact-panel-resize` 点完之后**一个锚点都没有**

它的 `steps` 只有一个 click，取样只靠 `captureScenario` 那 **700ms 固定等待**
——而这个场景量的正是**分栏几何**（坑 237）。补同一条锚点。

### 三、量过之后被排除的候选

`[data-slot="select-trigger"]` / `[data-slot="select-value"]` / `role:combobox`
在这一屏上**两个应用都是 0 个**。wave 103 记着「artifact 头部有个 455px 宽的
SelectTrigger」，照那条记忆选锚点会选空——**这份夹具走的是 write_file 分支，
不是 artifacts 列表那条 Select 分支**（坑 265）。

### 四、`artifact-preview#preview-failed` 走不通——量出来的否定结论

wave 129 把它列为「下一轮可以直接抄」，并留了一个开工前要确认的问题。**答案是不走**：

```
VUE    previewFailed en=0 zh=0   iframe=1   pre=0   /artifacts 响应 0 条
REACT  previewFailed en=0 zh=0   iframe=1   pre=0   /artifacts 响应 0 条
```

`ARTIFACT_MESSAGES` 那条产物是 `write-file-artifact`（`isWriteFile`），正文直接来自
消息里的工具结果，**两个应用都不会发 `/api/threads/*/artifacts/**`**。盖一个 500
什么都不会变，量出来必然 0 行、没有对照意义。

要接这一支，得先造一份**产物来自 artifacts 列表**的夹具（thread 上带 `artifacts: [...]`
而不是 write_file 工具调用），那时 `useArtifactContent` 才会真的发请求。
**判据本身仍然成立**（wave 129 订正过的「grep 渲染点、不是词典」，两边都有
`ArtifactPreviewError` + `artifactPreview.previewFailed`）——**走不通的是这份夹具。**

### 五、读数与负向验证

- 改动前（= wave 129 收工那一跑，同一份代码）：`e2e-parity` **85 passed (7.4m)**，台账 **113 行 / 77 样本**
- 改动后：`e2e-parity` **85 passed (7.5m)**，台账 **113 / 77，一行没动**

**台账没变，但那两个 0 的含义变了**：几何档从「量消息卡」换成「量面板标题」，
`artifact-panel-resize` 多了一个此前根本不存在的取样点。**加了覆盖面而没有加账。**

| #    | 变异                                                            | 预期       | 实测                                                   |
| ---- | --------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| 对照 | 无                                                              | 5 条全绿   | **5 passed (1.1m)**，exit 0                            |
| M1   | Vue 面板标题渲染整条路径（`{{ filename }}` → `{{ filepath }}`） | 新锚点红   | **5 failed**（三个维度 + 另一个场景，31.2~31.4s 超时） |
| M1b  | **同一个变异**，锚点换回旧写法                                  | 旧锚点不响 | **5 passed，exit 0** ← 决定性                          |

### 六、下一轮

1. **给 artifact 造一份「来自 artifacts 列表」的夹具**，然后接
   `#preview-failed`（`{ pattern: "**/api/threads/*/artifacts/**", status: 500 }`，
   锚点用 `artifactPreview.previewFailed` 的两种译文——**上游那一块没有 testid**）。
   顺带那份夹具会第一次让 Select 那条分支进取样面（wave 103 量过它的几何，但那是
   临时探针，不在台账里）。
2. wave 129 剩下的 6 个「匹配数 > 1」的锚点还没逐个看过是不是同一类：
   `branch-thread#turn-actions` 的两个、`channels#runtime-config-edit` 的 `text:DingTalk`、
   `sidecar-chat` 的 `text:1 selected text fragment`、
   `thread-list-infinite-scroll` 的 `text:Conversation 001`。
   **判据**：匹配到的那几份**是不是同一个东西的多份**（列表里两条消息各一份，属正常），
   还是**不同的东西**（消息卡 vs 面板标题，那就是这一类缺陷）。

---

## 上一轮（wave 129）做了什么：**两句写下来当规则用的话，一句在场景目录里、一句是上一轮自己写的，都被实测推翻**

### 一、`scheduled-tasks` 的两个锚点从来没钉住它们声称要钉的东西

`tests/e2e-parity/support/scenarios.ts` 的注释写着「锚点选「Save edit」这颗按钮，
加上 schedule input 里面的两个 testid（`schedule-preset` / `schedule-timezone`）：
**只钉外壳的话，那一整块换了位置也看不见**」。

**假的。** 那两个 testid 在**创建表单**里也各有一份，页面一打开就在
（两边创建草稿默认都是 `schedule_type: "cron"`，创建表单都**无条件**渲染
`ScheduledTaskScheduleInput`），而 `runStep` 与 `sampleGeometry` 都取 `.first()`
——这两步在点「Edit」**之前**就已经满足，几何档那两行量的也是创建表单的控件。

**读数（临时探针，两个应用各打一遍匹配数）**：

| 应用        | 场景/终态                                     | 锚点                       | 匹配数    |
| ----------- | --------------------------------------------- | -------------------------- | --------- |
| Vue / React | `scheduled-tasks#default`                     | `testId:schedule-preset`   | **2 / 2** |
| Vue / React | `scheduled-tasks#default`                     | `testId:schedule-timezone` | **2 / 2** |
| Vue / React | 同上，改成 `>> nth=1`                         |                            | 1 / 1     |
| Vue / React | `scheduled-tasks#load-failed`（没开编辑表单） | 两个 testId                | 1 / 1     |

**改法**：创建表单那两份挪去 `settle`（它们本来就是页面加载态的控件），
编辑表单那两份用 `>> nth=1` 显式取第二份——**编辑表单的 schedule 块这才第一次
真的进取样面**（结果 0 行，两边一致）。判据补上第二问：
**「一个锚点在加进来之前，问它在这个场景的每一个维度上都成立吗」+「它在这一屏上只有一份吗」。**

### 二、wave 128 自己写下的那条判据是错的

上一轮的交接文档写着，接下一批失败分支的判据是「**那条 key 上游词典里也有**
（grep 一下就知道），否则就是本仓独有的分支」。四个候选逐条查完，
**判据在其中一条上给出相反的结论**：

| 候选                          | 上游词典有这条 key？ | 上游真的渲染这一支？                                                                                                                | 结论                  |
| ----------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `scheduledTasks.loadFailed`   | 有（`en-US.ts:381`） | 有（`page.tsx:339`），**两边同一个 testid**                                                                                         | 共有 ✅               |
| `agents.loadFailed`           | 没有                 | **没有**——上游 `agent-gallery.tsx:14` 只解构 `{agents,isLoading}`，error 整个丢掉                                                   | 本仓独有              |
| `settings.account.loadFailed` | 没有                 | **没有**——上游账户面板从 `useAuth()` 拿 user，没有独立的账户请求                                                                    | 本仓独有              |
| `artifacts.loadFailed`        | 没有                 | **有！**`ArtifactPreviewError`（`artifact-file-detail.tsx:656/731`），用的 key 是 `artifactPreview.previewFailed`，**两边词典都有** | 共有 ❌**被判据误判** |

**正确的判据：上游有没有一段代码在这个失败分支上渲染出东西——grep 的对象是渲染点，不是词典。**
两边的 `ArtifactPreviewError` 结构逐行同形，唯一差别是本仓多一个
`data-testid="artifact-preview-error"`。

### 三、接上的失败分支与读数

`scheduled-tasks#load-failed`（两边同一个 testid `scheduled-task-load-error`，
两边都走 `throwGatewayApiError` 从 `{detail}` 取文案，比的是结构不是措辞）。

`settle` 同时改了一处：**它必须在每一个终态下都成立**（settle 跑在 `state.steps`
之前，而原来等的「Daily summary」恰恰是失败态里唯一不会出现的东西）。
这句规则此前不在任何地方，wave 128 的 `integrations` 是恰好选对了锚点。

- 改动前（HEAD = wave 128）：`e2e-parity` **83 条全绿**（7.0m），台账 **107 行 / 75 样本**
- 改动后：`e2e-parity` **85 条**，台账 **113 行 / 77 样本**

新增 **6 行**，逐条有名有姓（`PARITY_ACCEPT_GROW=1`）：两个语言维度各
`requestsOnlyReact: GET /api/scheduled-tasks ×3`。**不需要新的决定**——
就是 wave 128 判过的 `retry: 3` vs `retry: false`，**在另一屏上独立复现了一次**
（用例耗时也印证：`#default` 1.1s，`#load-failed` **8.1s**，正好是三次退避）。
其余各档在两个新样本上全是 0；`scheduled-tasks#default`（改名而来）仍然 0 行。

### 四、锚点匹配数的全量普查（只量、不加档）

临时探针把**每个 visible 锚点在两个应用里的匹配数**都打了一遍：**119 个锚点 / 512 条读数**。

- 匹配数 > 1 的 **8 个**（含上面那两处）。另外 6 个：`artifact-preview` 的
  `text:report.html`、`branch-thread#turn-actions` 的 `role:button[Branch conversation]`
  与 `[data-assistant-turn]`、`channels#runtime-config-edit` 的 `text:DingTalk`、
  `sidecar-chat` 的 `text:1 selected text fragment`、
  `thread-list-infinite-scroll` 的 `text:Conversation 001`。
- **两个应用匹配数不相等的：0 个。**

**决定：不把「匹配数」做成台账的一档**（坑 258：举不出一种「只有它会响、现有各档
都不响」的变异——匹配数在两边不等，必然意味着树上多／少了一个节点，`ariaOnly*` 先响）。

第二个探针量了另一件事：**`state.steps` 里的 visible 锚点，在交互还没做之前是不是
就已经满足了**。234 条里 **33 条 ALREADY**。这一条**同样不能直接做成门禁**——
多数是合法的「等一等」而不是「断言交互产生了什么」，做成门禁必然要一张豁免表（线索 180）。
但其中**两条是真问题**，已记在下面「下一轮」。

### 五、下一轮可以直接抄

1. **`artifact-preview` 是同一处缺陷的第二例**（这一轮量到、没修）：
   `text:report.html` 匹配 **2** 个元素，而且**在 `click` 之前就已经满足**（两个应用都是）
   ——那一步声称「面板打开了」，实际被消息列表里的文件卡满足，几何档那一行量的也是卡片。
   修法与本轮同形（`>> nth=1` 或换一个只在面板里的锚点），**会新增几何取样点，走 GROW**。
2. **`artifact-preview#preview-failed`**：按订正后的判据，这一支两边都有。
   路由覆盖写 `{ pattern: "**/api/threads/*/artifacts/**", status: 500, json: { detail: "boom" } }`
   （两边 URL 形状逐字相同：`utils.ts` 的 `urlOfArtifact`），
   锚点只能用 `artifactPreview.previewFailed` 的两种译文——**上游那一块没有 testid**。
   开工前先确认一件事：`report.html` 在上游走的是 `useArtifactContent`
   （`enabled: isCodeFile && !isWriteFile`）那一支吗——不是的话上游根本不发这个请求，
   锚点会在 React 侧超时。

---

## 上一轮（wave 128）做了什么：**第⑥类第一次进取样面，第一跑就撞到一句写在代码里的假话**

**没动 `frontend/`。** 第⑥类（只在某种后端状态下才分叉的渲染路径）是「天生看不见的
八类」里最后一个**没有任何读数**的。

### 一、改动：`states` 可以带自己的路由覆盖

错误态只有让接口真的失败才走得到，而场景自己的 `routes` 是一份「正常」的响应、
一个场景只有一份后端。给 `ParityState` 加 `routes?`，装在场景的之后
（Playwright 后注册者优先）——同一条场景于是可以同时取「正常」与「失败」两个终态，
**而且不动覆盖率棘轮的场景 id**（wave 87 那条轴的直接延伸）。

新终态 `integrations#load-failed`：让 `/api/integrations/lark/status` 返回 500，
锚点用两边词典**都有**的 `settings.integrations.loadFailed`（上游 `en-US.ts:885`）。

### 二、量出来的 12 行

| 行                                        | 定性                                                   |
| ----------------------------------------- | ------------------------------------------------------ |
| `focus` × 2                               | 已知类（wave 94 的 settings 深链焦点，清单第 5 条）    |
| `tabOrder` × 2 + `tabbablesOnlyReact` × 2 | 已知类（ScrollArea，清单第 6 条）                      |
| **`requestsOnlyReact` × 6**               | **新的**：同一次 500，**上游发 3 次请求、本仓发 1 次** |

### 三、顺着那 6 行查到一句假话

`app/plugins/vue-query.ts` 的文件头写着：

> 「`retry: false` **与上游一致**。**不要改成默认的 3 次重试**」

**这句话是错的。** 上游是 `new QueryClient()`——**没有 defaultOptions**，
吃的是 TanStack 的默认值 `retry: 3`。**台账把它量了出来**（这也是这一档第一次
证明自己：请求层的重试策略差异，别的档一个都看不见）。

**取舍：保留本仓的 `retry: false`。** 判据是 fork-boundary 那条已授权的例外
「vue 有更好的可以保留」——thread history 的 404 意味着 thread 不存在
（上游把 403 也当 404，为的是不泄露存在性），而 TanStack 的默认重试**不分错误码**，
重试三次只是把跳回空聊天页推迟 3 秒。注释就地改成实话；
**翻案判据**：真要按错误码分流，换成 `retry: (count, error) => …`，而不是改回默认。

### 四、台账

**95 行 / 73 样本 → 107 行 / 75 样本**，走 `PARITY_ACCEPT_GROW=1`，
**12 行逐条有名有姓**（6 行新决定 + 6 行落在两条既有的已决定类里）。
`e2e-parity` 81 → **83**。

### 五、这一档还能接什么（下一轮可以直接抄）

同形的、两边词典都有的失败分支：`scheduledTasks.loadFailed`、`agents.loadFailed`、
`account.loadFailed`、`artifact.loadFailed`。**判据**：那条 key 上游词典里也有
（`grep` 一下就知道），否则就是本仓独有的分支，量出来必然是差异、没有对照意义。

## 上一轮（wave 127）做了什么：**试了「语义属性」这一档，量完判定不做**（代码改动为零）

**没动 `frontend/`，也没留下代码。** 第⑤类（primitive 的默认值）是「天生看不见的八类」里
唯一还没被机器看过的一半。做法与 wave 123 相同：先装探针量，再决定。

### 一、做法

对每个带 `data-slot` 的元素取一组**语义属性**（`role` / `type` / `tabindex` / `disabled` /
`aria-label` / `aria-expanded` / `aria-pressed` / `aria-checked` / `aria-current` /
`aria-hidden` / `aria-haspopup` / `aria-disabled` / `data-state`），拼成
`slot｜attr=value …` 一行，两边取多重集差异。**不取 class / style / id**——那些必然不同。

### 二、读数：**2519 行**（只在 React 1667 / 只在 Vue 852），73 个样本

**约每个样本 34 行**。逐条看最高频的那些，绝大多数是**两个库的结构差异**，不是产品差异：

```
138 R input-group-addon｜role=group      69 V input-group-footer｜role=group + 69 V input-group-body｜
120 R resizable-panel｜                  （本仓走 splitpanes，这个 slot 根本不存在）
 66 R sidebar-gap｜ / sidebar-container｜（同上）
```

**只在一边出现的 slot 名就有 62 个**——两个应用的 primitive 词汇表本来就不一样，
而「splitpanes vs react-resizable-panels」是早就决定的分叉。
把这一档做成常驻，等于往台账里灌 2500 行「已决定」。**按 wave 99 的规矩：不做。**

### 三、顺带看到、但**不是**新东西的两条

```
137 R sidebar-trigger｜                 vs  137 V sidebar-trigger｜type=button aria-label=Toggle Sidebar
 92 R button｜                          vs   90 V button｜type=button
```

上游那颗 `<button>` **不写 `type`**、可访问名放在 sr-only 的 span 里（线索 224 记过），
所以可访问性树上两边同名——**这一档看见的是属性层面的写法差异，不是用户能感知的差异**。
`type` 缺失只在 `<form>` 里才有后果（默认变成 submit），而这两处都不在表单里。
**不动上游**（fork-boundary 的判据：这处不改，React 自己也不坏）。

### 四、结论与翻案判据

**第⑤类到此有了读数**：这一档在当前两套 primitive 下**信噪比太低**，不做。
**翻案判据**：哪天两边的 primitive 词汇表收敛了（比如本仓也换成同一套 resizable），
只在一边出现的 slot 名从 62 掉到个位数，那时再量一次值不值得做。

## 上一轮（wave 126）做了什么：**两个归一化不许各写一份——按这份文件自己的话抽成一处**

**没动 `frontend/`。** `aria-parity.mjs` 的文件头写着：

> 两份各自维护的归一化迟早会分叉，而分叉的后果不是「报告长得不一样」，
> 是**同一处差异在一边被抹掉、在另一边报出来**。

那句话说的是两个**消费者**（`dom-parity` 与 `e2e-parity`）；
而 **wave 125 加 `normalizeAriaTree` 时，在同一个文件里制造了第二份**
——同样三条 replace 抄了两遍。**上一轮的产出立刻违反了这份文件的规矩。**

### 一、改动

三条行内规则抽成 `normalizeLineBody`，装饰性空节点的判断抽成 `isDecorative`。
**`normalizeAriaSnapshot` 把整行（含缩进）传进去**，所以那条 `\s{2,}` 连缩进一起吃掉
（wave 122 的读数）；**`normalizeAriaTree` 先把缩进量出来再传行内容**，层级因此留下来。
**两者的差别现在只剩这一处，而且写在代码里、不在注释里。**

### 二、新增一条同源用例（机器证明，不是承诺）

同一份快照，行归一化的每一行 `trimStart()` 之后必须与树归一化的 `body` 逐个相等。

| #   | 变异                           | 期望                             | 实测                     |
| --- | ------------------------------ | -------------------------------- | ------------------------ |
| 1   | 改共享规则（`-v-…` → `«idx»`） | 规则自己的用例红、**同源用例绿** | 正是如此（两边一起变了） |
| 2   | 让树归一化跳过共享规则         | 同源用例红                       | **红**                   |

### 三、读数

verify 0 / 265 文件 / **2205** 单测；e2e-parity 81，**台账 95 行 / 73 样本未动**
（行为逐字节不变）；standalone-sim 14/5/0；icon-parity 0/0⚠；asset-budget 0；audit 红 14。

## 上一轮（wave 125）做了什么：**把「深度」做成常驻的一档——第④类到此真正补完**

**没动 `frontend/`。** wave 99 做过层级差异这一档，量到 73 个样本 0 行就整档撤了，
并立下判据：**「有没有一种变异能让它响、而现有的档都不响？举不出来就别加。」**
**现在举得出来了，而且当年那个 0 是数据造成的。**

### 一、三步读数

| wave | 读数                                                                                   |
| ---- | -------------------------------------------------------------------------------------- |
| 122  | `normalizeAriaSnapshot` 的 `\s{2,}` → 一个空格，**把每层缩进都塌掉**（7692 行里 6698） |
| 123  | 在**保住缩进**的数据上重量：**6 行**——wave 99 的 0 是数据造成的                        |
| 124  | 6 行的根因：工具条被渲染在 `role="log"` 里；**其余六档全是 0**                         |

### 二、改动

`normalizeAriaTree`（同样的规则，**先量缩进再收拾行内容**）与 `diffAriaDepth`
（**只比两边都恰好出现一次的行**，不跟 `diffAriaLines` 抢活）进 `aria-parity.mjs`；
capture 多存一份 `ariaTree`；`DiffEntry` 加 `depth`。
基线 73 个样本各加一个 `depth: []`——**总行数仍是 95**，
`parity-accept` 那条「有新增行就拒写」没有被触发（它看的是行，不是字段）。

### 三、负向验证（决定性）

把 wave 124 的修复退回去（工具条放回 `role="log"` 里）再跑：

```
Expected -2 / Received +10
+ "depth": ["- button \"Add to conversation\" React 深度 2 / Vue 深度 3", …]
+ "depth": ["- button \"关闭\" React 深度 2 / Vue 深度 3", …]
```

**只有 depth 这一档响，其余各档一行没动**——正是 wave 99 立的判据要的证据。
另加四条单测：不同深度报一行 / 同深度不报 / 同名行出现多次时跳过（那是行差异）/
归一化确实保住了缩进（0,1,2）。

### 四、这意味着台账的形状变了

**「天生看不见的八类」第④类到此真正补完**（顺序 wave 95、层级 wave 125）。
现在还看不见的是：② 请求 body（wave 42/44 已另有守卫）、③ portal 出去的浮层遮蔽、
⑤ primitive 默认值、⑥ 只在某种后端状态下才分叉的渲染路径、⑦ 没被取样的那一屏。

## 上一轮（wave 124）做了什么：**划词工具条渲染在 `role="log"` 里面——挪出去，与上游一致**

**没动 `frontend/`。** wave 123 挂的那条账（6 行层级差异）揪到根因了，
**而它不是「多一层 generic 容器」**——那是当时基于「行数相同」的推测，**推测错了**。

### 一、根因：祖先链第一层就分岔

探针打印工具条的祖先链：

```
本仓  DIV{bg-popover…}  <  DIV[log]{min-h-0 flex-1 transition-[padding] pt-10}  <  MAIN…
上游  DIV{bg-popover…}  <  DIV{flex min-h-0 flex-1 justify-center}             <  MAIN…
```

上游 `message-list.tsx` 把工具条写在 `</Conversation>` **之后**（`Conversation` 才是
带 `role="log"` 的那个）；本仓 `MessageList.vue` 的模板根**就是** `role="log"` 的 div，
工具条是它的**最后一个子节点**。

**后果不是排版**：`role="log"` 是一个 live region，插进去的内容会被读屏器当作日志
播报——而它是一条随选区出现/消失的浮动工具条。读屏用户选一段文字，
听到的会是「添加到对话 / 在侧边聊天中提问 / 关闭」被当成新日志念出来。

### 二、改法

把工具条挪出那个根，组件变成**两个根节点**（与上游同构：日志区与工具条是兄弟）。
多根组件不再自动继承 attrs，所以加 `defineOptions({ inheritAttrs: false })` +
在日志区那个根上 `v-bind="$attrs"`——`AgentChat.vue` 传的是 `:class="… pt-10"`，
那是布局 class，不该落到 `position: fixed` 的工具条上。

### 三、改前 / 改后（同一把尺子）

| 量                            | 改前            | 改后                                                           |
| ----------------------------- | --------------- | -------------------------------------------------------------- |
| 深度差异（wave 123 那把探针） | **6 行**        | **0 行**                                                       |
| 台账                          | 95 行 / 73 样本 | **一行没动**                                                   |
| e2e-visual                    | 8 张            | 8 张，**一张没重录**（fixed + 显式 left/top，挪 DOM 不动布局） |

### 四、这条线索（122 → 124）的完整形状，值得记

1. **122**：发现归一化里唯一没注释的规则把每层缩进都塌成一个空格；
2. **123**：于是在保住缩进的数据上重量——**wave 99 的「0 行」被推翻，实际 6 行**；
3. **124**：把 6 行揪到根因——**不是猜的那个「generic 容器」，是 `role="log"`**。

**三步里每一步都推翻了上一步的一个假设**，而每一步的依据都是读数不是推理。
**一页纸清单第 7 条账结清。**

## 上一轮（wave 123）做了什么：**在没被塌平的数据上重做层级比对——wave 99 的那个 0 是数据造成的**（代码改动为零）

**没动 `frontend/`，也没留下任何代码。** wave 122 发现归一化把每层缩进都塌成一个空格，
于是给 wave 99 的归因挂了存疑。这一轮正面验它。

### 一、做法

临时探针：`normalizeAriaTree`（与现有归一化同样的几条规则，**但保住缩进**，
把每行变成 `{depth, body}`）+ `diffAriaDepth`（**两边都恰好出现一次**的行，比它们的深度
——这样「一边多包一层容器」不会把整棵子树刷成差异）。只 `console.log`，不进台账。

### 二、读数

```
控制组：73 个样本都取到了树（每个样本 react=60 / vue=60 这类，行数两边相同）
深度差异：6 行
```

**wave 99 在塌平后的数据上量到 0；在保住缩进的数据上是 6。** 那个 0 是数据造成的，
不是「层级差异不存在」。**wave 99 的归因（「换爹必然换位置，order 先撞上」）
就此推翻**——原文按规矩保留在下面第④类那一段里，已就地标注。

### 三、6 行是什么

三颗按钮 × 两种语言，全在**划词工具条**上：

```
- button "Add to conversation" / "添加到对话"   React 深度 2 / Vue 深度 3
- button "Ask in side chat"    / "在侧边聊天中提问" React 深度 2 / Vue 深度 3
- button "Close"               / "关闭"          React 深度 2 / Vue 深度 3
```

**两边行数相同（60/60）**，工具条本身的标记逐行相同（同一组 class、同一个
`data-sidecar-selection-toolbar`）——所以多出来的那一层是**祖先里的一个 generic 容器**，
而 `- generic` 正好被归一化过滤掉，于是它在行比对里**看不见**、只在深度上现形。

### 四、这一轮**没有**把这一档做进台账，理由写清楚

- 做进去要走 `PARITY_ACCEPT_GROW=1` 的接受仪式（台账会长 6 行），
  而**那 6 行的根因还没钉到具体是哪一个容器**——只知道「祖先里多一层 generic」。
- 工具条是 `position: fixed` + 显式 `left/top`，多一层 generic **没有布局后果**；
  按 wave 34「欢迎区在树里的位置」的先例，这类多半是「保留」。
- **所以先挂账**：见一页纸清单新增的那一条，下一轮要做的是「把那一层揪出来」，
  再决定是修掉还是接受、以及要不要把这一档常驻。

### 五、过程里踩了一次（新坑 271）

探针里写 `console.log(\`W123_DEPTH ${key} ...\`)`，而**同一文件里正好有一个叫 `key`
的函数**——`${key}` 把**函数源码**插了进去，日志里每一行都带着那三行函数体。
**不报错、不影响计数**（73 与 6 都是对的），只是标签全是垃圾，
差点让人以为探针坏了。**模板串里插一个短名字之前，先确认它在这个作用域里是什么。**

## 上一轮（wave 122）做了什么：**那条没有注释的归一化规则，抹掉的是整棵树的层级**

**没动 `frontend/`。** wave 120/121 查的是请求归一化的两半；这一轮往上一层查
`normalizeAriaSnapshot`——整套里最大的归一化器，每一行 aria 快照都过它。

### 一、实测（探针 + 控制组，7692 行）

| 规则                                    | 命中               |
| --------------------------------------- | ------------------ |
| `collapse-space`（`\s{2,}` → 一个空格） | **6698 次（87%）** |
| `trailing-space`                        | 0                  |
| `reka-radix-id`（**有注释**）           | 0                  |
| `v-index`（**有注释**）                 | 0                  |
| `blank-line`                            | 0                  |
| `generic-line`（`- generic` 过滤）      | 0                  |

**有注释的那几条一次都没响过；真正在抹信息的那一条此前没有注释。**
控制组的 7692 行证明探针在跑（线索 195）。

### 二、它抹的是什么

aria 快照按每层两个空格缩进，所以 `\s{2,}` 命中的绝大多数是**缩进本身**：

```
输入  ["- main:", "  - navigation:", "    - button \"A\"", …]
输出  ["- main:", " - navigation:", " - button \"A\"",   …]
```

**深度 1、2、3 全部塌成同一个前导空格**——层级信息在这一步就没了。

### 三、取舍：保留，但把代价写下来

下游 `diffAriaLines` 本来就要去缩进（不去的话「一边多包一层容器」会把整棵子树刷成
差异），所以塌掉缩进**不改变当前任何一项比对结果**——e2e-parity 81 passed、
台账 95 行 / 73 样本一行没动。

**但代价要知道**：**任何「层级」维度都不可能从归一化之后的快照里恢复**。
**wave 99 那条归因就地存疑**——它做过一档层级差异、量到 0 行，当时归因为
「换爹必然换位置、order 先撞上」；**那个 0 也可能只是因为数据在这一步已经被塌掉了**。
真要做层级，得先让 capture 另存一份带缩进的。

### 四、四条零命中的规则**没有删**（与 wave 121 的处理不同）

理由如实写：本轮只测了 e2e-parity 这一个消费者，而
`scripts/dom-parity.mjs` 跑的是**活着的两个应用**、可能真的见得到 reka/radix 的 id。
**没量过就不动它**——要动，先给 dom-parity 也装一次探针。

## 上一轮（wave 121）做了什么：**那张丢弃查询参数的表一条都没响过——删掉，理由是「一个会喊的失效优于一个不出声的」**

**没动 `frontend/`。** wave 120 查的是 `KNOWN_IDS`（漏登记 → 抹掉真差异）；
这一轮查同一段归一化的**另一半**：`VOLATILE_QUERY_KEYS = {_, t, ts, cacheBust}`，
**四条无条件丢弃**。

### 一、实测 0 次，而且那个 0 是算出来的

给 `normalizeRequest` 装探针跑一整轮 e2e-parity：
**116 次查询参数观测，`DROPPED` 0 次**。
**控制组**（同一轮打印实际出现的参数）证明探针在跑（线索 195）：

```
include_files 48 / include_diff 48 / limit 8 / task_id 4 / offset 4 / event_types 4
```

### 二、取舍：两种失效各是什么样，选那个会叫的

- **留着**：产品哪天用了一个叫 `t` / `ts` 的参数，会被**静默丢掉**，
  两个应用在那个参数上的差异**看不见**——与 wave 120 那三个夹具 id 同一类失效。
- **删掉**：真出现破缓存参数时，它每次值都不同，台账会**变得不稳定**——吵，
  但**自己会喊**，而且那正是硬规则 2 要的「因为实测才加」的证据。

**一个会喊的失效优于一个不出声的。** 要加回来就拿着那条不稳定的读数加，
别凭「看起来像缓存参数」加。

### 三、顺带：那条单测本来是自证的

`normalizers.test.ts` 里原有一条「丢掉只为破缓存而存在的查询参数」——它拿一个
**合成 URL** 验规则，**没有任何东西说这种 URL 真的出现过**。
改成「不丢弃任何查询参数」，并把读数与取舍写在用例上方。

### 四、读数

**e2e-parity 81 passed，台账 95 行 / 73 样本一行没动**——归一化**放宽**了而台账
没动，正好再证一次「此前一次都没丢过东西」。
（与 wave 120 那条对称：那次是归一化**收紧**、台账也没动。）

## 上一轮（wave 120）做了什么：**三个夹具 id 没登记进 `KNOWN_IDS`，请求归一把它们抹成了 `«generated»`**

**没动 `frontend/`。** wave 111/112 把 guards 与 scripts 里的表都按「有没有反向校验」
筛过了；**对照工厂自己那几张表是唯一没筛过的面**。筛出来一处，而且这一处会造**假绿**。

### 一、机制

`normalizeRequest` 把「UUID 形状、且不在 `KNOWN_IDS` 里」的路径段抹成 `«generated»`。
那条规则是为了吃掉**客户端随机生成**的 id——但它对**夹具** id 一样有效：
**两个应用请求了不同的夹具线程，归一之后变成同一个字符串，差异就此消失**
（硬规则 2：每一条归一化都在抹掉信息）。

实测：`tests/e2e-parity/support/` 下六个 UUID 字面量，`KNOWN_IDS` 只登记了三个
（外加 mock-api 的 sidecar 那个）。漏在外面的三个：

```
…010a  历史线程「Newest chat」
…010b  历史线程「Older chat」
…09c1  workspace-changes 的 run id
```

**它们当时没造成假绿**（两个应用请求的是同一个），**但那是运气，不是判据**。

### 二、改动

两个内联 `thread_id` 起名字并导出，三个一起补进 `KNOWN_IDS`；
新增 `tests/unit/parity/known-ids.test.ts` **双向**钉住——没登记的要红，
登记了却在源码里找不到的也要红（死配置）。**零豁免**：真出现一个「必须被当成
客户端生成」的 UUID 字面量，把它挪出这几份文件，而不是在守卫里开口子。

### 三、负向验证

| #   | 变异                            | 期望 | 实测                        |
| --- | ------------------------------- | ---- | --------------------------- |
| 1   | 从 `KNOWN_IDS` 拿掉一个         | 红   | 红（点名那一个）            |
| 2   | `KNOWN_IDS` 放一个源码里没有的  | 红   | 红（死配置）                |
| 3   | 看 HEAD 的 `KNOWN_IDS` 成员清单 | —    | 实测只有 4 个，三个确实漏着 |

### 四、一条值得记的读数

**归一化改了而台账一行没动**（e2e-parity 仍 81 passed / 95 行 / 73 样本）
——这正好证明这三个 id 此前没产生过差异，与「当时没造成假绿」的判断一致。
**改归一化规则时，台账不动是个好消息，但要专门去看它**：动了才说明此前抹掉了东西。

## 上一轮（wave 119）做了什么：**`standalone-check` 的正则要求带斜杠，安装期的那几种写法一个都看不见**

**没动 `frontend/`。** wave 118 那张表上只剩 `install` 没人碰过。查它，
撞到的不是「没人验」，而是**验的那把尺子在这一档上有洞**。

### 一、实测

```
package.json          "w119-probe": "file:../frontend"   → BLOCKING 0
pnpm-workspace.yaml     - "../frontend"                  → BLOCKING 0
同一条加个斜杠          "file:../frontend/"               → BLOCKING 1
```

主正则是 `/frontend(?!-vue)[/\\]/`——**要求带斜杠**。斜杠原本是为了把 `frontend/`
和 `frontend-vue/` 分开，而 `(?!-vue)` 本来就够了；真正拦不住的是**路径末尾**那一种，
也正是 `file:` 依赖与 workspace 条目的写法。

### 二、为什么不直接放宽主正则

实测放宽之后全仓多出 **26 行**命中，其中 `Makefile` 的
`@echo "  make standalone-check ... ../frontend"` 有 **9 行**——Makefile 的注释是 `#`，
`@echo` 那些不是注释，会直接变成**假 BLOCKING**。
**放宽判据 → 需要豁免表 → 判据选错了**（线索 180）。

### 三、改法：收窄到「安装期清单」

`package.json` / `pnpm-workspace.yaml`（含 `packages/*/`）这一类**没有散文**，
出现兄弟应用就是引用，不需要斜杠。这一档覆盖的正是判据四步里的 `install`。
当前实测这两份文件里 `frontend(?!-vue)` 命中 **0**
（`"name": "deer-flow-frontend-vue"` 被 `(?!-vue)` 正确排除）。

### 四、负向验证（3 条）

| #   | 变异                                               | 期望   | 实测         |
| --- | -------------------------------------------------- | ------ | ------------ |
| 1   | `package.json` 放不带斜杠的 `file:` 依赖（新脚本） | 红     | 红，点名到行 |
| 2   | 同上（**HEAD 的脚本**）                            | **绿** | **绿（洞）** |
| 3   | `pnpm-workspace.yaml` 指向兄弟应用（新脚本）       | 红     | 红           |

### 五、判据四步的覆盖，到这一轮为止

| 步      | 谁在验                                                                | 状态   |
| ------- | --------------------------------------------------------------------- | ------ |
| install | `standalone-check` 的**安装期清单**那一档（wave 119 起）              | ✅     |
| build   | 有意不加（wave 117 量过：配置级依赖已被 test 接住）                   | 已决定 |
| test    | `standalone-sim` 默认跑**整套** vitest（wave 116 起）                 | ✅     |
| e2e     | `standalone-sim --with-e2e` 跑 mock + backend + parity（wave 118 起） | ✅     |

**这张表第一次四格都有着落。** 下一轮要接着挖，得换一条线索——
这一条（判据自己有没有被验）到此为止。

## 上一轮（wave 118）做了什么：**`--with-e2e` 只跑了那个必然跳过的套件——判据里 e2e 那一半从没验过**

**没动 `frontend/`。** wave 116 把判据的 test 那一半补成了整套；这一轮看 e2e 那一半。

### 一、缺口：这个开关几乎什么都没证

判据（`cross-app-by-design.mjs` 的文件头）写的是「`../frontend` 不存在时，本仓的
install / build / **test / e2e** 必须照常全绿」。而 `--with-e2e` 此前**只跑
`make e2e-parity`**——**那是唯一一个兄弟应用不在时整组跳过的套件**
（它的存在就是为了对照两个应用）。**真正会执行的那些套件，从来没有在
「兄弟应用不在」的状态下跑过。**

### 二、第一次跑：两组都绿

手工把 `frontend/` 移开（用 `standalone-sim` 同一个 parked 目录名，
崩了它下次启动会自愈）：

```
make e2e-mock     265 + 22 + 15 + 2 + 6     exit 0
make e2e-backend  2+5+2+3+3+5+1+1           exit 0
```

**判据里 e2e 那一半到今天为止是成立的**——但在这一轮之前没有任何人验过。

### 三、改动与代价

`--with-e2e` 现在把这两个会真跑的聚合入口也带上，从约 1 分钟变成**十分钟量级**。
**这个开关本来就是 opt-in**，换来的是判据里 e2e 那一半第一次真的有人验。
`e2e-backend` 需要 backend 的 uv 环境，与收工清单同一条前提。

实跑：**跑过 17 条 / 未跑 4 条 / 红 0**（此前 14 / 4；新增
`（make e2e-mock）`、`（make e2e-backend）` 两行），兄弟应用已还原。

### 四、判据现在的覆盖情况（一次说清）

| 判据里的四步 | 谁在验                                                                             | 状态           |
| ------------ | ---------------------------------------------------------------------------------- | -------------- |
| install      | 无（`pnpm install` 不读兄弟应用）                                                  | 没有专门的检查 |
| build        | 无（wave 117 量过：**配置级依赖已被 test 接住**，只有 build 才看得见的举不出例子） | 有意不加       |
| test         | `standalone-sim` 默认就跑**整套** vitest（wave 116 起）                            | ✅             |
| e2e          | `standalone-sim --with-e2e` 跑 e2e-mock + e2e-backend + e2e-parity（wave 118 起）  | ✅             |

**install 那一档是这张表上唯一没人碰过的**——下一轮要接着做，先问 wave 117 那条判据：
「有没有一种失效，是它能看见而现有检查看不见的」。

## 上一轮（wave 117）做了什么：**答掉 wave 116 留的问题——build 不加，理由是量出来的**

**没动 `frontend/`。** wave 116 结尾留了一个明确的问题：**要不要让 `standalone-sim`
连 lint/typecheck/build 一起跑**，判据是「有没有一种失效，是这三步能看见、
而现有检查看不见的」。

### 一、答案：不加。最像样的那一类已经被 test 那一步接住了

构造一处「构建期才生效、静态扫描看不见」的跨应用依赖——`nuxt.config.ts` 里
**运行时拼路径**读兄弟应用的 `package.json`（绕开 `standalone-check` 的正则）：

```
standalone-check（静态）：BLOCKING 0 处      ← 看不见，符合预期
standalone-sim（跑整套）：红，exit 1         ← 接住了
```

原因：**`nuxt` 那个 vitest project 会加载 `nuxt.config.ts`**，配置一坏整套就起不来。
也就是说「配置级的构建期依赖」已经在 test 这一步的射程里。

剩下能想到的、只有 build 才看得见的，要同时满足三条：**运行时拼路径 + 只在预渲染
路径上执行 + 没有任何测试覆盖**——举不出一个像样的例子，就别加（wave 99 的规矩）。
代价那一侧也不划算：`make build` 会让这条门禁再多两三分钟。

**翻案判据**：哪天真出现一处「只有 build 才看得见」的跨应用依赖，
把它写下来，再谈加这一步。

### 二、顺带修掉这次实测暴露的一处误导

整套跑不起来时（`report === null`），原来的输出是给**表里那 8 份文件**各记一行
「vitest 没产出报告」——**它们其实一次都没被执行**，看输出的人会以为是它们坏了
（这次实测就先误导了我一次）。现在先记一行
「（整套 vitest）整套没跑起来：exit N」，那几份的说明改成
「整套没跑起来，这一条没被执行（不是它自己红）」。

### 三、门禁与一条如实说明

verify 0 / 264 / 2197；standalone-sim 跑过 14 / 未跑 5 / 红 0；
icon-parity 0 待核 / 0 条 ⚠；asset-budget 0；audit 红 14。

**e2e 四套没有为这一轮重跑。** 理由：本轮改动只有 `scripts/standalone-sim.mjs` 里
**报错分支**的两行输出，不进产物、不进测试运行路径；wave 116 在**同一份应用构建**上
刚跑过全套。**这里不把那组读数抄成本轮的读数**——它们是 wave 116 的
（坑：历轮真正出事的是「抄读数当自己跑过」，不是「明说没跑」）。

## 上一轮（wave 116）做了什么：**`standalone-sim` 只跑表里那 8 份文件，而判据说的是「整套」**

**没动 `frontend/`。** `cross-app-by-design.mjs` 写着的验收判据是：
**`../frontend` 不存在时，本仓的 install / build / test / e2e 必须照常全绿**。
而 `standalone-sim` 的 test 那一步是 `vitest run ...tests`——**只跑表里点名的 8 份**。
**两者差着整整一套测试。**

### 一、这正是 wave 83 撞到的形状，只是没被修干净

wave 83 那次：`standalone-check` 的 BLOCKING 早已是 0 整整几十轮，而兄弟应用一移走
`make verify` 当场红——红在**一份当时没人登记过的**文件上
（`upstream-key-coverage.test.ts` 的工厂函数）。它后来被补进了表，
**但「只跑表里的」这条结构没变**：下一份没人登记的照样看不见。

### 二、实测（决定性的那一条）

临时探针 `tests/unit/zz-w116-probe.test.ts`，模块作用域里无条件读兄弟应用的
`package.json`，**路径在运行时拼出来**（绕开 `standalone-check` 的静态扫描——
要验的正是「静态扫不到、只有真跑才看得见」那一类）：

```
HEAD 的 standalone-sim：「跑过 13 条，未跑 5 条，红 0 条」，exit 0
改动后：              「✗ [test]（整套 vitest）整套红了：exit 1」，红 1 条，exit 1
```

### 三、改法与代价

test 那一步改成**跑整套**，并把整套的结论单独记一行（表里那 8 份仍逐个核对
「跑到了、没红」——那回答的是「登记过的还好吗」，新那一行回答的是**判据本身**）。
代价：这一步从 ~10s 变成整套（本机约 40s）。`standalone-sim` 本来就不在 `verify` 里、
只在收工清单上跑一次。

**`lint` / `typecheck` / `build` 三步有意没跟着做**：`standalone-check` 的静态扫描
覆盖 import 那一类，而 wave 83 的教训指向的是**测试运行期**读文件。
**要不要连它们一起跑，留给下一轮按同样的判据决定**——判据是
「有没有一种失效，是这三步能看见而现有检查看不见的」。

## 上一轮（wave 115）做了什么：**用 wave 114 那把旋钮把剩下的抖动逐条过一遍**（代码改动为零）

**没动 `frontend/`，也没动任何代码。** 这条尾巴上第一次有了能按需复现的手段，
就该拿它把整张名单量一遍，而不是继续按「历史上红过」传下去。

### 一、读数（负载 20~115，全部用 `--repeat-each`）

| #   | 抖动                                                    | 跑法 | 结果                                      |
| --- | ------------------------------------------------------- | ---- | ----------------------------------------- |
| 2   | `channels.spec.ts` 的 401 → `/login?next=`              | ×8   | **8 / 8 绿**                              |
| 3   | `thread-list-infinite-scroll.spec.ts`（整份，3 条用例） | ×5   | **15 / 15 绿**                            |
| 4   | `i18n-theme.spec.ts` 的 locale 切换                     | ×6   | **6 / 6 绿**                              |
| 5   | `thread-history.spec.ts` 的乐观消息                     | ×8   | **8 / 8 绿**                              |
| 6   | `ui-primitives-a11y.spec.ts` 的 hover tooltip           | —    | **wave 113 已修**（修前同一旋钮 1/10 红） |

**37 次跑，一次没红。** 而同一把旋钮在 wave 113 修之前的第六条上 10 次红 1 次
——**旋钮是有效的，这四条就是复现不出来**。

### 二、这意味着什么（也说清楚它不意味着什么）

- **不意味着它们不存在**：复现不出来只是「现有最强的手段复现不出来」。
- **意味着这张名单不是一个同质的类**：七条里**只有第六条**能按需复现，
  而它已经修掉了；第七条本来就是另一类（并发状态码分布，wave 102 定性）；
  第一条在 `frontend/`（React 自己的 landing.spec）。
  **剩下四条（2/3/4/5）现在的地位是「一次历史观察」，没有任何现有方法能复现。**
- **顺带对上一件事**：wave 109 量到 #3 与 #5 的关键断言**本来就写着 `timeout: 15_000`**
  ——它们从一开始就不属于「5s 预算不够」那一类，这一轮的全绿与那条读数一致。

### 三、下次它们再红时该怎么做（写下来省得再猜）

1. **先跑旋钮**：八个自限时忙循环 + `--repeat-each=10`。
   **本轮已经证明「不红」是这把旋钮下的默认结果**，所以那时候一旦红，
   就是**新信息**，值得往下查，而不是又一次「负载抖动」。
2. 再看症状分类：
   - `element(s) not found` 且触发动作本身不报错 → 先按 wave 113 的机制查
     （延时打开的浮层，事件被重渲吃掉）；
   - 断言的是一个**会被应用离开**的中间态 → wave 107 那一类（换落点）；
   - 单条断言用光预算而用例还剩很多 → wave 108 那一类（预算，现在默认 10s）。

## 上一轮（wave 114）做了什么：**找到比 CPU 节流更好的复现旋钮，并用它做完 wave 113 欠的两组对照**（代码改动为零）

**没动 `frontend/`，也没动任何代码。** 这一轮全是度量。

### 一、旋钮：真的把机器压住，而不是只压浏览器

wave 108 用 CDP 的 `Emulation.setCPUThrottlingRate`，wave 109 证明它**复现不了**
第五、第六条抖动（60x / 70x 仍绿）——因为它只让**页面脚本**变慢，而不是
「服务端也慢 / 进程被抢占」。这一轮换成**真负载**：

```bash
for i in $(seq 1 8); do (sh -c 'end=$((SECONDS+260)); while [ $SECONDS -lt $end ]; do :; done' &) ; done
```

八个自限时的 CPU 忙循环（到点自己退出，不留残余）。**它当场复现了 wave 113 修掉的
那条**——把那份 spec 退回 `071a2414~1`，load ~13 时 `--repeat-each=10`：**1 失败 / 9 通过**。
**CPU 节流做不到的事，真负载做到了。**

### 二、wave 113 那个修法的受控前后对照（这才是它欠的证据）

| 版本                                   | load     | `--repeat-each=10`  |
| -------------------------------------- | -------- | ------------------- |
| wave 113 之前（一次 `hover()`）        | ~13      | **1 失败 / 9 通过** |
| wave 113 之后（`toPass` 里重新 hover） | 20 → 107 | **10 通过**         |

wave 113 当时用的是「跑完套件之后碰运气」的负载，这一轮是**按需造出来的**，
而且后一组的负载还高得多。

### 三、wave 113 说「同形的另外两处先不动」，现在量过了

`mode-hover-guide.spec.ts`（三处 hover→延时浮层）与 `sidebar.spec.ts` 的
「Feature not enabled」，在同一个旋钮下 `--repeat-each=4`：**56 / 56 全绿**。

**所以「先不动」现在是量过的结论，不是假设。** 合理的解释：wave 113 那一处的浮层
挂在**消息列表**上，而消息列表会重渲（流式状态、水合）；composer 与侧栏那两处不会。
**翻案判据**：哪天它们红了，先按 wave 113 的机制查，不要当负载。

### 四、这条旋钮的用法与边界

- **要自限时**（`SECONDS+N`），不要留后台进程；跑完 `pgrep` 确认为 0。
- 负载会**滞后**：`uptime` 的 1 分钟均值在忙循环退出后还会高一阵，
  两组对照之间要等它落下来再开始，否则又是一次被混淆的比较（wave 112 的教训）。
- **它比节流贵**：整台机器都慢，一轮 `--repeat-each=10` 从 40s 变成 1.7 分钟。
  先用节流（便宜）；节流复现不了、而症状又指向「等一个外部事件」时，再上这个。

## 上一轮（wave 113）做了什么：**查清已知抖动第六条的机制并修掉——一次 hover 赌不到延时开的 tooltip**

**没动 `frontend/`。** wave 112 给这条量到了复现条件（跑完几个套件之后立刻跑，
`--repeat-each=10` 是 3 失败 / 7 通过），这一轮正面查它。
**它不是超时不够，是一次 hover 赌不到。已知抖动名单从七条减到六条。**

### 一、机制（探针实测，不是推理）

临时探针：hover 之后每 200ms 记一次「鼠标那点上是谁 / 有没有打开的 trigger /
tooltip 内容在不在」，跑 6 次，六次一致：

```
W113_PROBE moved dx=0.0 dy=0.0 | 600ms top=BUTTON… closestTrigger=yes openTrigger=yes content=yes
```

三件事：

- 按钮**没有移动**（dx=dy=0），命中测试干净——**不是**「点歪了」或「被盖住」；
- tooltip 是**延时开**的，安静时也要**约 600ms 的持续悬停**（Reka 的 `delayDuration`）；
- 失败时的症状是 `element(s) not found` 一直到超时，**而 `hover()` 那一步本身不报错**。

**结论**：在那 600ms 里消息列表只要重渲一次，旧 trigger 卸载、计时器跟着没，
而鼠标**没有再动**，新 trigger 收不到 `pointerenter`——tooltip 就永远不开。
这同时解释了两件此前对不上的事：

- 为什么它**对负载敏感**（重渲落在 hover 之后）；
- 为什么 **wave 109 用 CPU 节流复现不了**（70x 时整条用例一起变慢，重渲又落回 hover 之前）。

### 二、修法与前后对照

`expect(async () => { await branch.hover(); await expect(tooltip).toBeVisible({timeout: 2_000}); })
.toPass({ timeout: 20_000 })`——每一轮**重新 hover 一次**。
**断言一个字没松**：tooltip 仍必须出现、仍必须念出同一条 label。

| 条件                                             | 改动前              | 改动后                   |
| ------------------------------------------------ | ------------------- | ------------------------ |
| 跑完四个套件之后（load 7~9），`--repeat-each=10` | **3 失败 / 7 通过** | **10 通过**（load 7.26） |
| 机器安静时                                       | 10/10               | 10/10                    |

**只有第一行算数**——安静时两边都绿，那组比不出东西（wave 112 差点把另一组
被负载混淆的对照读成因果，教训在那一节）。

### 三、负向验证

把 `toPass` 里的 `await branch.hover()` 删掉（tooltip 永远不开）：**红**，
`Timeout: 2000ms` + `Timeout 20000ms exceeded while waiting on the predicate`。

### 四、这条方法可以推广

**「hover / focus 触发 + 延时打开」的浮层，都不能用一次 `hover()` 加一条等待**：
延时窗口里任何一次重渲都会吃掉那次 `pointerenter`。本仓还有几处同形的
（`mode-hover-guide`、`sidebar` 的「Feature not enabled」），**目前没复现过，
先不动**——但下次它们红的时候，先按这条查，别再当负载。

## 上一轮（wave 112）做了什么：**四张「指向外部东西」的表补上反向校验；`upstream-drift` 会打一句假的「无漂移」**

**没动 `frontend/`。** wave 111 的正题（按**有没有反向校验**把表过一遍）被 icon-parity
那件事岔开了，这一轮过完。**最值钱的一条是 `upstream-drift`。**

### 一、`upstream-drift` 会打印一句假的「无漂移」

`WATCHED = ["frontend/src", "frontend/tests/e2e"]` 喂给的是
`git log <range> -- frontend/src frontend/tests/e2e`。**git 对一个不存在的 pathspec
不报错，只会一条 commit 都不返回**——上游把某个目录改了名，这份报告照样打印
「无漂移：marker 之后上游没有改动被监视的路径」，而**它其实什么都没看**。
而「无漂移」这句话在本文档里是**被当证据引用**的（wave 97 那条）。

**实测**：把 `frontend/tests/e2e` 改成不存在的名字，**HEAD 的脚本 exit 0 并打印
「无漂移」**；改动后 exit 1，并说明「在这条修好之前，『无漂移』这个结论不成立」。

### 二、i18n 扫描面点名的根与入口

`PRODUCT_ROOTS` / `PRODUCT_ENTRY_FILES` 走 `git ls-files <root>`，**对不存在的路径
同样不报错、只返回空**。把 `app/layouts` 改个名，清单会安静地少掉一整个目录，
而「产品 SFC 218 / 总 220」这类数字**照样自洽**——它们就是从这里算出来的。
与「白名单要能自证覆盖全」是同一件事的另一半。

### 三、`doc-references` 的两张

`SUITE_INFRASTRUCTURE`（从「套件」里排除的 5 个入口）此前只有正方向：一个改了名的
入口会留一条死配置，同时它自己变成一个「新套件」进了清单，**两头都不红**。
`SKIPPED_PREFIXES` 同理——指向已经不在的目录的排除项，看起来像「有意不扫」，
实际什么都没排除。

### 四、按判据筛过、**不是**缺口的（别重筛）

`FORK_ROOT_DOCS`（已有「文件没了就拿掉」）、`LOCKSTEP`（已有「这些包都还在
devDependencies 里」）、`SKIPPED_DIRS`（构建产物，死条目无害）、
`CONSUMED`/`NOT_CONSUMED`（106）、`HAND_MAINTAINED`/`GENERATED`（104）、
`SCAN_ROOTS`/`EXCLUDED_ROOTS`（105）、`CROSS_APP_BY_DESIGN`（110）、
`VERIFIED`/`EXEMPT`（111）。**这一轮之后，`tests/guards/` 与 `scripts/` 里
「指向外部东西」的表都双向了。**

### 五、负向验证（5 条）

| #   | 变异                                    | 期望   | 实测                           |
| --- | --------------------------------------- | ------ | ------------------------------ |
| 1   | `SUITE_INFRASTRUCTURE` 放一个改名的入口 | 红     | 红                             |
| 2   | `SKIPPED_PREFIXES` 放一个不存在的目录   | 红     | 红                             |
| 3   | `WATCHED` 放一个不存在的路径（新脚本）  | 红     | 红 exit 1                      |
| 4   | 同上（**HEAD 的脚本**）                 | **绿** | **绿（洞）**，还打印「无漂移」 |
| 5   | `PRODUCT_ROOTS` 放一个改名的目录        | 红     | 红（抛错）                     |

### 六、`e2e-mock` 第一次跑红了一条，如实记

红的是 `ui-primitives-a11y` 的 hover tooltip——**交接文档里的已知抖动第六条**。

- 本轮改的是 scripts 与 guards，**碰不到浏览器里的 tooltip**；
- 紧接着单跑 `--repeat-each=10`：**3 失败 / 7 通过**（load 7~9，刚跑完四个套件）；
- 机器安静下来之后再跑两次 `--repeat-each=10`：**两次都 10/10**
  （一次用旧的显式 5s、一次用现在继承的 10s）；
- **所以「5s vs 10s」那组对照是被负载混淆的，不能当因果读**——差一点就写成
  「wave 109 removing 5s 让它变差了」，那是错的；
- 重跑 `e2e-mock` 收工读数 265 + 22 + 15 + 2 + 6 全绿。

**这条抖动的真实频率比记录高得多**（负载上来时 30%），**而且 wave 109 已经证明
CPU 节流复现不了它**（70x 仍绿）。下一轮值得正面查它：现在至少知道
「四个套件连跑之后立刻跑它」能把频率抬到 30%，这比「红过一次」好用得多。

## 上一轮（wave 111）做了什么：**收工清单上「icon-parity 不报 stale」这句是假的，而且假了很多轮**

**没动 `frontend/`。** 本轮的正题是「把 guards / scripts 里的表按**有没有反向校验**
过一遍」（104/105/110 都是零散撞出来的）。第一处就撞到一件更难看的事。

### 一、`VERIFIED` 的 stale 检查一直在报，而没有人读

`icon-parity` 里那张 `VERIFIED` 表是**双向**的（wave 75 就写了 stale 检查），
但它只 `console.log` 一行 ⚠、**不影响退出码**。收工清单上写的读数是
「0 处待核，**不报 stale**」——核清单的人 grep 的是最后那句「共 0 处待核」，
**⚠ 那一行在它上面**。

**证据就在本会话自己的日志里**：wave 106 / 109 / 110 三次 `make icon-parity`
全部打印

```
⚠ VERIFIED 表里这几条已经不再出现，回去重看一遍再删：FileMinus、FilePenLine、FilePlus
```

而 `EXIT=0`，三次都被我记成「0 处待核，不报 stale」。
**一句要靠人眼读的断言等于没有断言**（线索 194 的同一形状）。

### 二、那三条豁免自 wave 87 起就过期了

wave 69 记的理由是「改动面板双视图，本仓那一屏结构不同」。**wave 87 重做改动面板
之后两边都用了这三颗**（上游 `FileMinusIcon` 等别名，本仓裸名，canonical 之后同一颗），
于是它们既不在 `onlyR` 也不在 `onlyV`——正是 stale 的定义。删掉。

### 三、`EXEMPT` 那张表也是单向的，新检查第一跑就抓到 `magicui`

`EXEMPT = {landing, docs, blog, magicui}` 是 walk 时按目录名跳过的豁免，
**只有「撞到就跳过」，没有「表里的每一条还撞得到吗」**。加 `exemptSeen` 之后第一次
跑就报：**`magicui` 在两个应用里都已经没有这个目录了**。删掉。

### 四、让它真的红 + 顺带一处

`stale` / `staleExempt` 非空时 `process.exitCode = 1`——清单上的读数从此是机器守的。
顺带把 `e2e-suite-contract` 的 `standalone = {external, visual, parity}` 补上反方向：
一个改了名的套件会**同时**从 `expected` 里消失、又在 `standalone` 里留一条死配置，
两头都不红，而它从此不进任何聚合入口也没人知道。

### 五、负向验证（4 条，其中一条是历史证据）

| #   | 变异                                               | 期望 | 实测                                      |
| --- | -------------------------------------------------- | ---- | ----------------------------------------- |
| 1   | EXEMPT 里放回 `magicui`                            | 红   | 红 exit 1 + ⚠                             |
| 2   | VERIFIED 里放回 `FileMinus`                        | 红   | 红 exit 1 + ⚠                             |
| 3   | standalone 里加一个不存在的 id                     | 红   | 红「standalone 里点名的套件已经不存在了」 |
| 4   | **历史证据**：wave 106/109/110 的 icon-parity 日志 | 绿   | **绿（洞）**——⚠ 一直在，`EXIT=0`          |

## 上一轮（wave 110）做了什么：**独立性判据自己身上的两处「登记了就不再检查」**

**没动 `frontend/`。** wave 83 建 `kind` 是为了让 `CROSS_APP_BY_DESIGN` 的每条 `note`
都接上一个能跑的检查。这一轮回头量那套东西自己，**两处都还漏着**，而且**两处都实测过洞**。

### 一、`kind: "data"` 是唯一一档**什么都不查**的

`standalone-sim` 里那一支原文就是无条件 `ok: true`：

```js
for (const file of data) {
  results.push({
    file,
    kind: "data",
    ok: true,
    skipped: true,
    detail: "纯数据，没有可执行行为",
  });
}
```

那句「纯数据，没有可执行行为」是**散文**，没有任何机器读它。失效方式很具体：
**把一份 `.ts` 标成 `data`，它就永远不会被这个实验跑到**——而这个实验正是
「移走兄弟应用还能跑」的判据本身。

**实测**：往表里塞一条 `app/lib/utils.ts` / `kind: "data"`，
**改动前的 `standalone-sim` 报「跑过 13 / 未跑 6 / 红 0」，exit 0**；
改动后当场 `✗ [data] app/lib/utils.ts`、红 1 条、exit 2。

判据用**黑名单**（可执行源码后缀）不用白名单：可执行后缀有限且稳定，
而数据格式会长（今天 `.json`，明天可能 `.yaml`/`.csv`），白名单会变成一张要维护的表。

### 二、`CROSS_APP_BY_DESIGN` 这张表是**单向**的

只有正方向——「有代码级引用的文件如果在表里就不算 BLOCKING」。
**没有人查「表里的每一条还真的提到兄弟应用吗」**。一条已经不再引用 `../frontend`
的登记会永远留着，而它**不产生 hit**，于是既不在 BLOCKING 里、也不在 DECLARED 计数里
——**看报表只会觉得「40 处 / 18 个文件」一切正常**（线索 186 的清单腐烂，
与 wave 104 在 `HAND_MAINTAINED` 上撞的是同一形状）。
`standalone-sim` 那条「表里点名的文件必须真的在」只管**文件在不在**，
管不了「它还是不是一个对照工具」。

**实测**：同一条塞进去的登记（`app/lib/utils.ts` 不提 `frontend/`），
**HEAD 的 `standalone-check` exit 0**；改动后打印
「过期的登记（表里有，而文件已经不再提到兄弟应用）」并 exit 1。

判据取「任意一处提到」（代码或注释），不是「代码级引用」：一份只在注释里点名上游
文件的对照工具仍然是对照工具，只是不阻断构建。

### 三、负向验证（4 条，一条变异同时验两处）

| #   | 变异                                                              | 期望   | 实测                                    |
| --- | ----------------------------------------------------------------- | ------ | --------------------------------------- |
| 1   | 表里加一条既过期、又标成 `data` 的 `.ts`（新 `standalone-check`） | 红     | 红「过期的登记」exit 1                  |
| 2   | 同上（**HEAD 的 `standalone-check`**）                            | **绿** | **绿（洞）**                            |
| 3   | 同上（新 `standalone-sim`）                                       | 红     | 红 `✗ [data]`，红 1 条 exit 2           |
| 4   | 同上（**HEAD 的 `standalone-sim`**）                              | **绿** | **绿（洞）**「跑过 13 / 未跑 6 / 红 0」 |

还原后 `diff -q` 逐字节一致，探针脚本已删。

## 上一轮（wave 109）做了什么：**订正 wave 108 的推断，并清掉最后 7 处写死的 5s 预算**

**没动 `frontend/`。** wave 108 如实写着「只有第四条抖动被复现验证过，第三/五/六条
按症状同形**推断**」。这一轮把那句推断查完——**推断不成立**。

### 一、订正：CPU 节流复现不了第五、第六条

| 抖动                                                           | 30x      | 更高               |
| -------------------------------------------------------------- | -------- | ------------------ |
| #5 `thread-history.spec.ts`（wave 66，`element(s) not found`） | 绿 43.4s | **60x 仍绿** 51.8s |
| #6 `ui-primitives-a11y.spec.ts`（wave 33，hover tooltip）      | 绿 42.8s | **70x 仍绿** 55.1s |

**原因**：节流只模拟「页面脚本执行慢」，模拟不了真实负载下「服务端也慢 /
进程被抢占 / 磁盘被占」。第四条能复现，是因为它的瓶颈恰好在页内（水合 + 对话框渲染）。
**那个旋钮有适用域，别当成通用复现器。**

顺带看到一条本该更早发现的事：**#3 与 #5 的关键断言本来就写着 `timeout: 15_000`**
——它们从一开始就不在「5s 预算」那一类里，wave 108 的推断从这里就该停住。

### 二、确定的那件事：7 处写死的 5s 把 wave 108 的提升挡在门外

全仓显式超时分布（实测）：**15s 164 处 / 10s 40 处 / 20s 28 处 / 30s 12 处 /
60s 10 处 / 5s 7 处 / 2s 1 处**——**5s 是离群值，没人真的想要它**。
逐条读那 7 处，**没有一处在断言「必须多快完成」**：全是「等 tooltip 出现」
「等布局稳下来」「等选区落定」。5s 只是**旧默认值的回声**，写下来就把这条断言
永久钉在旧预算上，后来把默认调大也救不到它。

```
mode-hover-guide.spec.ts   ×2   ui-primitives-a11y.spec.ts ×1   sidebar.spec.ts ×1
browser-control.spec.ts    ×1   sidecar-chat.spec.ts       ×1   chat.spec.ts    ×1
```

七处全部去掉显式值、改为继承默认（poll 那三处保留 `intervals`）。

### 三、有意不做成门禁

「短超时」不是一律不许写：`tests/e2e-parity/support/capture.ts` 的 `{ timeout: 2_000 }`
是有意的（逐元素探针，长超时会吃光整套 600s 预算）。判据是
**「这个数字在断言一件事，还是只是抄了默认值」**，不是数值大小；这条判据机器分不出来，
做成门禁必然要一张豁免表（线索 180）。所以写进 `playwright-factory.ts` 的注释里。

### 四、负向验证

把那条 tooltip 用例的 `await branch.hover()` 删掉（tooltip 永远不出现），
失败消息是 **`Timeout: 10000ms`**——继承的预算真的生效，断言照样红，只是晚一倍。
另有一次变异把 `<TooltipContent` 改名，**构建直接失败**，属于变异写坏了、不算数，如实记。

### 五、门禁

verify 0 / 264 文件 / 2195 单测；standalone-sim 13/5/0；e2e-parity 81（台账 95/73 未动）；
e2e-mock 265+22+15+2+6；e2e-backend 2+5+2+3+3+5+1+1；e2e-visual 8；e2e-external 3；
asset-budget 0；icon-parity 0 待核；audit 红 14。

## 上一轮（wave 108）做了什么：**把「负载抖动」变成可复现实验，量出机制是 5s 断言预算**

**没动 `frontend/`。** 交接文档里挂着七条「已知抖动」，规矩是「每次遇到都要重新证
一遍因果」——但**从来没有办法按需复现它们**，所以历轮每一条都只能靠「换个时间重跑，
绿了就算证完」。这一轮先解决复现，再谈修。

### 一、复现的旋钮：CDP 的 CPU 节流

```ts
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 30 });
```

拿**第四条**（`tests/e2e/i18n-theme.spec.ts`，wave 54 新增，症状
`element is not visible / not stable`）做实验：

| 节流 | 结果                                                        |
| ---- | ----------------------------------------------------------- |
| 20x  | 绿（45.8s）                                                 |
| 30x  | 绿，但**第一条 `expect(dialog).toBeVisible()` 实测 3832ms** |
| 50x  | **红**——红在第 54 行那条 dialog 断言上，`Timeout: 5000ms`   |

### 二、机制：不是「断言钉错对象」，是预算给小了

`tests/support/playwright-factory.ts` 只设了用例超时（30s），**没设 expect 超时**，
于是全仓吃 Playwright 的默认值 **5000ms**。30x 节流下那条断言用掉
**3832 / 5000 = 77%**——机器再慢三成就红，而**同一个用例还剩二十几秒没人用**。

**这与 wave 107 修的那条不是同一类**：那条是断言钉在一个「应用本来就要离开的中间态」
上（换落点才对），这一条**断言本身完全正确**，只是预算不够。
两类的区分判据：**把机器调慢，失败点会不会移动**——钉错对象的那类调慢了照样红在
同一个语义上（因为它等的东西永远不来），预算不够的那类是「等的东西来了，只是晚了」。

### 三、改动：默认 expect 预算 5s → 10s（一处，套件仍可覆盖）

- **语义一行不变**：能过的断言立刻返回，过不了的照样红。
- **代价只有一个**：真失败时报错慢一倍，且只在失败的那一条上付。
- 仍远低于用例的 30s，失败消息还是「哪个 locator 没等到」，
  不会退化成「Test timeout of 30000ms exceeded」。
- 为什么不是 15s/20s：越接近 30s，用例超时越可能先触发，报错就没有 locator 了。

### 四、验证：同一个节流等级下的前后对照

```
50x 节流，改动前：红在第 54 行（dialog，5000ms 用尽）
50x 节流，改动后：第 54 行过了，一路走到第 129 行才撞上用例本身的 30s
                  ——50x 已经超出任何超时调参能救的范围（CPU 慢 50 倍）
负向验证：断言一个不存在的 locator，实测 10009ms 后失败
```

### 五、这条改动**没有**解决什么，如实写

- **不声称七条抖动从此消失**。量到机制的只有第四条；第三、五、六条症状同形
  （异步 / hover / 滚动 + 固定超时），按同一机制**推断**，**没有逐条复现验证**。
- **第七条不在这一类**（12 路并发 import 的状态码分布，wave 102 已定性）。
- **第一条在 `frontend/`**（React 自己的 landing.spec），本轮没动上游。
- 真正的产出除了那行配置，是**那个节流旋钮**：下次再遇到「偶尔红」，
  先用它复现，而不是换个时间重跑。写在 `playwright-factory.ts` 的注释里。

### 六、顺带量掉一条线索，结论是「货很少」

wave 106 留的「其余 baseline 的 `$comment` / 文档里的数字断言」这一条量过了：
`frontend-vue/*.md` 里带数字量词的行**一共 11 行**，其中 SFC 数、key 数、
BEHAVIOR_CONTRACTS 的组数、`516 条消息` **都已经有机器钉着**；
唯一没人钉的是 `I18N_INVENTORY.md` 的「Lark 的 22 个授权域」——**实测就是 22**
（en-US / zh-CN 各 22 条 `authDomains`）。另一处「18 条真实未渲染的 Lark 文案」
是**过去式的历史说明**（线索 252 那一类）。**结论：这条方向不值得再建机制。**

## 上一轮（wave 107）做了什么：**给「以后端为全集」的表补镜像门禁，并把一个静默跳过拆成两件事**

**没动 `frontend/`。** wave 106 留的线索是「`app/` 里还有两张以**后端**为全集的表」。
这一轮把它们逐个量完：**一张补上了门禁，另一张量完判定不做**（wave 99 的形状），
过程中在 `doc-facts` 里撞到一处**静默跳过**——那才是本轮最实的一条。

### 一、`DEERFLOW_DURABLE_STATUS`：注释说「全集」，现在有机器守着

`run-protocol.ts` 的注释写着「Gateway 的 durable run status 全集」。后端那边是一个
干净的 `StrEnum`（`backend/packages/harness/deerflow/runtime/runs/schemas.py`，
六个成员），**能机械比**。新守卫 `tests/guards/backend-enum-mirror.test.ts`（3 条用例）：

- 形状先断言再计算：解析不出 `RunStatus` 成员直接红（枚举改写法 ≠ 悄悄跳过）；
- **键集合逐个相等**（双向）；
- 映射内部自洽：映射成 `null` 的恰好是 `pending` / `running`，其余落在内核三个终态里。

**只钉成员集合，不钉映射**：status → outcome 是一条冻结决策（08 §258），
后端加一个状态该映射成什么只有人能决定——机器能替人做的是**让他不能忘**。
漏掉的后果不是崩溃：`inspect` 把不认识的 status 当作「还没到终态」，
于是**停止操作在那个状态上永远收敛不了**，只能靠有界轮询兜底。

### 二、`doc-facts` 的 `catch { return }` 把两件事压成了一件（本轮最实的一条）

原文：

```ts
let app: string;
try {
  app = read("../backend/app/gateway/app.py");
} catch {
  return;
}
```

它想表达的是「后端不在 checkout 里就跳过」，实际吃掉的是**任何**读取失败——
**后端把那份文件改个名，用例照常绿**，而它守的那条断言（「其余 N 个 router 无条件挂载」）
从此不再被检查，没有任何征兆。

**实测（负向验证 3）**：把 `backend/app/gateway/app.py` 挪走，
**HEAD 的 `doc-facts` 11 条全绿**；换成新写法当场红，并打印「后端挪了文件」。

修法抽成 `scripts/lib/backend-source.mjs`：后端整个不在 → 返回 `null`（调用方**明确**跳过），
后端在、文件不在 → **抛错**。新守卫用同一个 helper，所以两边的跳过语义一致。

### 三、`DEERFLOW_WIRE_EVENTS`：量了，判定**不做**

同样写着「当前 Gateway 会发出的 wire 事件名全集」，但**后端没有对应的枚举**——
wire 名字散在 `bridge.publish(run_id, <mode>)` 的调用点上。实测扫下来
**只有 `values` 与 `messages` 是字面量**，其余走变量（`worker.py` 里的 `single_mode`），
控制事件 `error` / `end` / `gap` 又在别处。照这个扫出来的集合会漏，
**做成门禁就是一条会误报的规则**。

按 wave 99 的规矩：读数写进 `event-map.ts` 的头，写明**别再试第二次**，
以及翻案条件（后端哪天给 stream mode 也定了枚举）。

### 四、顺带：`e2e-external` 实测绿

它既不在 `e2e-mock` / `e2e-backend` 两个聚合入口里（`e2e-suite-contract` 明写这是
有意的，理由三条），**也不在收工清单里**——正是 wave 79（`e2e-channels` 红了七轮）
与 wave 88（`e2e-shell`）那个形状。这次跑下来 **3 passed，没有活违规**。
`e2e-suite-contract` 里那张 `standalone = {external, visual, parity}` 表是单向的
（没人查表里的 id 还是不是真的 config），**留给下一轮**——本轮没动它，
因为它现在错不了：三个 id 都在，而且改名会先让「每个 config 有一个 make 目标」那条红。

### 五、收工跑 `e2e-mock` 时红了一条 auth，**查到根因、就地修掉，没有进抖动名单**

`auth-contract.spec.ts:192`「an existing session leaves the login page for the
validated next path」——期望 `/workspace/chats/safe?view=1`，实际 `/workspace/chats/new`。
先按硬规则 3 排除因果：本轮改的是两份守卫 + 两处注释，**产品行为一行没动**；
单跑 `--repeat-each=5` **5/5 绿**。

不重跑收工，写探针量 URL 轨迹（`page.on("framenavigated")` + 每 250ms 采一次，共 10 秒）：

```
直接进 /workspace/chats/safe?view=1  → ["/workspace/chats/safe?view=1", "/workspace/chats/new"]
从 /login?next=… 出发               → ["/login?next=…", "/workspace/chats/new"]
```

**根因**：`next` 的落点 `/workspace/chats/safe` 是一个**线程路由**，而夹具里没有
`safe` 这个线程，工作区立刻把它换成 `/workspace/chats/new`。也就是说这条断言钉的是
一个**应用本来就要离开的中间态**——poll 采样快就绿、机器忙就红。
**这不是负载抖动，是断言钉错了对象**（线索 237 的同一家）。

修法：`next` 换成会话列表页 `/workspace/chats?view=1`——探针实测 10 秒不动。
**它照样证明这条契约**：默认落点是 `/workspace` → `/workspace/chats/new`，
与 `/workspace/chats?view=1` 不同。负向验证 7（把 `navigateTo(redirectPath.value)`
写死成 `navigateTo("/workspace")`）当场红，收到的正是 `/workspace/chats/new`。

**已知抖动名单没有变长**（仍是七条）：这一条被修成了确定的。

### 六、被自己的守卫抓了一次，如实记

新写的 `backend-source.mjs` 头里 `【依赖关系】` 顺手写了「无」，而它 import 了
`node:fs` / `node:url`——`make verify` 当场红（wave 84 补的那条「写『无』的必须真的零 import」）。
**一条守卫在自己这一轮里抓住作者本人，是它值钱的直接证据。**

### 七、负向验证（8 条；7 条期望红、1 条期望绿）

| #   | 变异                                                    | 期望         | 实测                              |
| --- | ------------------------------------------------------- | ------------ | --------------------------------- |
| 1   | 后端 `RunStatus` 多一个 `paused`                        | 红           | 红                                |
| 2   | 本仓表删掉 `timeout`                                    | 红           | 红                                |
| 3a  | 后端 `app/gateway/app.py` 挪走（**HEAD 的 doc-facts**） | **绿**       | **绿（洞）**                      |
| 3b  | 同上（改动后的 doc-facts）                              | 红           | 红「后端挪了文件」                |
| 4   | `pending` 映射成 `failed`                               | 红           | 红                                |
| 5   | 后端 `class RunStatus` 改名                             | 红           | 红（形状断言，不是静默跳过）      |
| 6   | **`backend/` 整个移走**                                 | 绿且明确跳过 | 绿，**3 skipped**（不是假绿）     |
| 7   | login 把 `navigateTo(redirectPath)` 写死成 `/workspace` | 红           | 红（收到 `/workspace/chats/new`） |

后端文件逐个 `diff -q` 还原确认；`backend/` 已移回原位。

### 八、过程里踩了自己一次（新坑 270）

跑单测时写了 `... > /tmp/w107/unit.log 2>&1; echo "EXIT=$?" >> ... || { mkdir -p /tmp/w107; }`
——目录当时**还不存在**，重定向失败，整条命令没跑；而那个 `||` 兜底子句
**把非零退出码吃掉了**，于是后台任务报「completed (exit 0)」、日志文件是空的，
下游 `grep` 什么都没匹配到。冷启动文档里已经有「重定向前先 `mkdir -p`」，
这次踩的是它的变体：**给失败接一个兜底子句，等于把失败改写成成功**。
判据：**`||` / `; true` 只能接在「失败无所谓」的命令后面，不能接在被观测的命令后面。**

## 上一轮（wave 106）做了什么：**把 wave 105 的判据往 `app/`、`packages/` 上筛，五处缺口、一处活违规**

**没动 `frontend/`。** wave 105 只筛了 `tests/guards/` 与 `scripts/` 里「长得像表的常量」。
这一轮把同一条判据（**一张表把全集切成两半，而另一半的处理方式是「不检查」吗**）
往外扫，量出五处，其中**一处有活的违规**——一份文件头写着「等 8 个」而实际 9 个，
从 2026-08-31 起烂到今天，每一轮门禁都是绿的。

**方法上先补一条**：wave 105 的筛法漏了 `gen-contract-constants.mjs`，
因为**同一个形状可以不长成一张表**——那里是三个 `readContract("…")` 调用点。
找这类缺口不能只 grep `const [A-Z_]+ = [`。

### 一、`packages/agent-core`：文档里五句枚举，只有一句是双向钉着的

`tests/contract.test.ts` 的头写着「凡是能从源码机械算出来的，都在这里对一遍」。
按「数量词 + 量词 + `：` + **两个以上**反引号项」把 ARCHITECTURE.md 扫一遍，
恰好五句：

| 文档那句              | 源码那侧                       | wave 106 之前 |
| --------------------- | ------------------------------ | ------------- |
| `AgentErrorKind` 九种 | `unionMembers(errors.ts)`      | 双向 ✅       |
| 角色四种              | `unionMembers(message.ts)`     | **只查一半**  |
| 四个文件各管一段      | `readdirSync(src/transport/)`  | **没人钉**    |
| 九个状态              | `RunSessionState` 的 `status:` | **只查一半**  |
| 会话向外只发三种输出  | `SessionOutput` 的 `kind:`     | **没人钉**    |

「只查一半」是什么样：数量那条比的是**数量词**与源码条数、列表本身不参与计数，
「每个成员都被点名」又只从源码一侧看——于是**文档里躺一个源码没有的成员，
三条断言全过**。这个漏洞本文件自己在错误 kind 那一条里写明过，只是没推广出去
（wave 48 在 baseline 键上、wave 104 在 `HAND_MAINTAINED` 上撞的是同一形状）。

修法不是再抄两条用例，而是**把取样面算出来**：`enumerationSentences()` 从文档
提取那五句，`PINNED_ENUMERATIONS` 必须与它**恰好一一对应**（多一句没人钉会红，
登记了却在文档里找不到也会红），每条再做数量词 + 清单的**双向**比对。用例 8 → **11**。

**这一处 0 活违规**——五句今天都对。补的是守卫的洞，不是文档的错，如实记。
最硬的证据是负向验证第 1 条：给「九个状态」的清单加一个源码没有的 `paused`、
**数量词不动**，`HEAD` 的守卫 **8 条全绿**，新守卫当场红。

### 二、`file-header-claims` 自己的头，还写着 wave 105 已经推翻的政策

那份文件的 `【边界与注意】` 里写着「**`tests/` 有意不在范围里**……两种约定各自成立，
只是不能共用一条判据」，而**同一份文件下面的 `SCAN_ROOTS` 注释写着「wave 105 补上 `tests`」**。
一份文件里两段话互相矛盾，而没有任何机器读它们。按交接文档的规矩**就地划掉、保留原文**，
并写明推翻它的是什么、代价当时没算（195 份文件、73% 的扫描面）。

### 三、`app/` 的 settings 分区：一张表、一个联合类型，两处各写一份

`SETTINGS_SECTIONS`（`core/workspace-shell/settings-query.ts`）标注成
`readonly SettingsSection[]`，而 `SettingsSection` 是 `composables/useSettingsDialog.ts`
里另写的一个九成员联合。**「联合里多一个、表里漏登记」没有任何机器会发现**：
`SECTION_ICONS[id]` 那种索引会被 tsc 挡住，而这张表少一项只表现为
「导航里不显示、深链打不开」，编译照样过。实测两处成员相同、**顺序已经不同**
（联合是 …tools/skills/memory/integrations/channels…，表是 …channels/integrations/memory/tools/skills…）
——没人在同步它们。

改成**从表推类型**（`typeof SETTINGS_SECTIONS[number]`），分叉不再存在；
`useSettingsDialog` 只转出这个类型，既有 import 路径一行不动。

顺带把 `SECTION_ICONS` 从 `as const` 改成 `as const satisfies Record<SettingsSection, Component>`：
**少一个图标本来就会红，多一个此前是静默的**（负向验证第 10 条实测：老写法加一个
`ghost:` 键，`vue-tsc` **0 error**）。

### 四、`gen-contract-constants.mjs`：「唯一阻断的一层」只对点名的那三份成立

它的头写着「后端改了契约就红，这是三层同步方案里唯一**阻断**的一层」。
实际它按写死的文件名读三份契约，而「`contracts/` 下有没有第四份」**没有任何机器在看**。
负向验证第 12 条：往 `contracts/` 放一份新契约，**改动前的脚本照样打印
「后端契约常量与 contracts/\*.json 一致」**——它自己的成功消息就是假的。

补 `CONSUMED` / `NOT_CONSUMED` **恰好划分** `contracts/*.json`（顶层；
`contracts/skill_review/` 是后端 skill-reviewer 的 JSON Schema，不在这条判据的全集里），
并且**读取由 `CONSUMED` 驱动**——不是另写三行 `readContract`，否则那张表会与
真正读了什么漂开（wave 83 的教训）。`NOT_CONSUMED` 现在是**空表**：豁免表为空，
才说明判据收口选对了（线索 180）。

### 五、活违规在这里：`【主要导出】` 里写「等 N 个」的九份文件

`file-header-claims` 明写「**只钉一个方向：点名的必须存在**」，理由是
「`主要`两个字就是说它是索引不是全集」。**但有 9 份文件自己写了数量**——
`… 等 9 个` 不是索引，是一句**关于全集**的断言，而且能算。逐份量：

```
ok  12/12  app/core/tasks/subtask-result.ts      ok   8/8  app/core/threads/export.ts
ok  22/22  app/core/messages/human-input.ts      ok   7/7  app/core/threads/types.ts
ok  31/31  app/core/messages/utils.ts            ok   8/8  app/core/sidecar/context.ts
ok   7/7   app/core/messages/usage-model.ts      ok   8/8  app/core/messages/usage.ts
MISMATCH 8 → 实际 9   app/core/threads/utils.ts
```

`documentTitleOfThread` 是 `84108b5f`（2026-08-31，「把头部导出按钮换回 Button primitive」）
加的，头里的数字没跟着改，此后每一轮全绿。补一档：**写了「等 N 个」就得对，
不写的一行不受影响，零豁免**——判据自选口径，不需要豁免表。

### 六、顺带推翻一句当规则用的话（第三处的副产品）

`settings-query.ts` 头里写着「对照台账按多重集比可访问性树，顺序天然测不出来
——所以这一行只能靠人盯着两边看」。**wave 95 加了 `order` 档之后这句就不成立了。**
实测（负向验证第 19 条）：把 `channels` 与 `memory` 对调，`make e2e-parity` 当场红，
`order` 档报出 **8 行**（`integrations` 的三个终态 + `settings-notification`，各两种语言）：

```
第 14 个公共节点 React=- button "Channels" Vue=- button "Memory"
第 14 个公共节点 React=- button "渠道"     Vue=- button "记忆"
```

就地划掉原文并写明**改这张表的顺序跑一次 e2e-parity 就行**。

### 七、负向验证（19 条；15 条期望红、**4 条期望绿**）

期望绿的那四条不是漏网，它们是**证明洞是真的**的实验：同一个变异在改动前后
一绿一红。

| #   | 变异                                                             | 期望           | 实测                       |
| --- | ---------------------------------------------------------------- | -------------- | -------------------------- |
| 1   | 「九个状态」多列一个源码没有的 `paused`、数量词不动（HEAD 守卫） | **绿**         | **绿（洞）**               |
| 2   | 同上（新守卫）                                                   | 红             | 红                         |
| 3   | 源码 `SessionOutput` 加一个 kind                                 | 红             | 红                         |
| 4   | 文档新增一句没登记的枚举                                         | 红             | 红                         |
| 5   | 登记表删掉 transport 那条                                        | 红             | 红                         |
| 6   | 文档把「会话向外只发…」整句改写                                  | 红             | 红                         |
| 7   | 文档整句删掉（登记了、文档找不到）                               | 红             | 红（「没有恰好命中一句」） |
| 8   | 文档点名一个源码没有的 controller                                | 红             | 红                         |
| 9   | `SECTION_ICONS` 多一个键（新写法）                               | 红             | 红 TS2353                  |
| 10  | 同上，退回 `as const`（老写法）                                  | **绿**         | **绿（洞）**               |
| 11  | `SETTINGS_SECTIONS` 删掉 `tools`                                 | 红             | 红 TS2353 + TS2367         |
| 12  | `contracts/` 多一份契约（改动前的脚本）                          | **绿**         | **绿（洞）**               |
| 13  | 同上（改动后）                                                   | 红             | 红                         |
| 14  | `CONSUMED` 少一份                                                | 红             | 红                         |
| 15  | `NOT_CONSUMED` 里有盘上没有的                                    | 红             | 红                         |
| 16  | `threads/utils.ts` 头写「等 8 个」（HEAD 守卫）                  | **绿**         | **绿（洞）**               |
| 17  | 同上（新守卫）                                                   | 红             | 红                         |
| 18  | 另一份写数量的文件加一个导出、数字不动                           | 红             | 红                         |
| 19  | 全仓「等 N 个」都拿掉                                            | 红（形状断言） | 红                         |
| 20  | settings 分区顺序对调 → `make e2e-parity`                        | 红             | 红（`order` 档 8 行）      |

还原后逐个 `diff -q` 逐字节一致；临时契约文件已删，`contracts/` 干净。

### 八、过程里踩了自己一次，如实记（新坑 269）

第 19 条变异要把全仓 9 份文件的「等 N 个」都拿掉，还原时图省事写了
`git checkout -- frontend-vue/app/core`——**它按 HEAD 还原，把本轮尚未提交的
`settings-query.ts` 一起冲掉了**（类型倒推 + 那段划掉的注释全没了），
下一条命令的 `git status` 才看见。**变异实验的还原一律用备份文件逐个 `cp` 回去**；
`git checkout -- <目录>` 在一棵有未提交改动的树上不是还原，是回滚。

## 上一轮（wave 105）做了什么：**文件头门禁整整漏掉 `tests/` 一整个目录，195 份没扫过**

**没动 `frontend/`。** wave 104 在 `baseline` 那张名单上撞到「单向校验」，
这一轮把同一个形状往外扫了一遍——**在扫描面上又撞到一处，而且这一处漏得多得多**。

### 一、先按判据筛，大多数表不是缺口

`tests/guards/` 与 `scripts/` 下有 29 张硬编码表。判据不是「有没有反向校验」，
而是——**这张表把全集切成两半，而另一半的处理方式是「不检查」吗**：

- `VERIFY_STEPS`（doc-facts）：已经是「**逐个等于** verify 的先决条件」，双向，**不是缺口**；
- `ROOT_MAKE_TARGETS`（doc-references）：它**不声称覆盖全集**（根 Makefile 几十个目标，
  文档只提 5 个），反向校验没有意义，**不是缺口**；
- `SCAN_ROOTS`（file-header-claims）：**是缺口**，见下。

### 二、`SCAN_ROOTS` 漏掉 `tests/`，而注释里写着「仍然在外面的两类」

```
const SCAN_ROOTS = ["app", "config", "packages", "scripts", "server", "shared"];
```

注释说明了两类在外面（根上的 config 文件、`examples/`）。**实际是三类**——
`tests/` 下有 **195 份**文件带着 `【主要导出】` 头，这条门禁**一份都没扫过**，
而且没有任何机器会发现。当前扫描面一共才 268 份带头文件，**漏掉的这块占 73%**。

**扩进来当场报出 13 处**（12 份 spec + 1 份工具）：

```
tests/unit/artifacts/artifact-actions.test.ts：【主要导出】点名了 probeArtifactAction，文件没有导出它
tests/unit/browser/browser-keyboard.test.ts  ：【主要导出】点名了 decideBrowserKeyInput，文件没有导出它
…（artifacts/ 6 份、browser/ 6 份，同一批写法）
tests/e2e/utils/mock-api.ts                  ：【主要导出】点名了 MOCK_，文件没有导出它
```

12 份 spec 把**被测符号**写在了 `【主要导出】` 上，而它们一个 `export` 都没有。
按仓库既定写法（`normalizers.test.ts` 那种）改成「无；Vitest cases」——
**信息不丢**：被测对象本来就写在 `【文件职责】` 与 `【依赖关系】` 里。
`mock-api.ts` 不是说谎，只是 `MOCK_*` 这个**通配写法**守卫认不出，改成列全四个常量。

### 三、补上「顶层目录必须表态」

光扩一次面不解决下一次。补 `EXCLUDED_ROOTS`（每条写理由），并加用例：
**`SCAN_ROOTS ∪ EXCLUDED_ROOTS` 恰好等于 checkout 里的顶层目录**。

```
扫描  app config packages scripts server shared tests   （7）
不扫  baseline（数据）public（静态资源）examples（独立样例，consumer-check 跑）（3）
```

`checkoutFiles` 用的是 `git ls-files --cached --others --exclude-standard`，
**未跟踪的新目录也算进全集**——所以新建一个目录、不表态，门禁当场红。

### 四、负向验证（5 条，全部真红）

| 变异                                   | 期望 | 实测                     |
| -------------------------------------- | ---- | ------------------------ |
| 从 SCAN_ROOTS 删掉 tests               | 红   | **红**                   |
| 从 EXCLUDED_ROOTS 删掉 baseline        | 红   | **红**                   |
| 新增一个没表态的顶层目录               | 红   | **红**                   |
| 把某份 spec 的【主要导出】改回被测符号 | 红   | **红**（证明扩面真生效） |
| EXCLUDED_ROOTS 的理由写成空话          | 红   | **红**                   |

还原后 `diff -q` 逐字节一致，临时目录已清理。

## 上一轮（wave 104）做了什么：**HAND_MAINTAINED 那张表是单向校验的，补成双向**

**没动 `frontend/`。** 改了一份守卫（`tests/guards/baseline-keys-consumed.test.ts`），
用例 5 → **7**。**新守卫第一次跑负向验证就抓到自己假绿**，见第三节。

### 一、缺口：一张只查一半的名单

那份守卫要求「手工维护的 baseline 必须声明 `$readers`」，而「哪些是手工维护的」
靠一张硬编码名单 `HAND_MAINTAINED`（3 份）。校验只有一条，而且是**单向**的：

```
it("手工维护清单自己不会腐烂") → 只查「表里的每一份都真的在 baseline/ 里」
```

反过来没人查。于是**新加一份手工维护的 baseline、忘了登记**，它就永远不必声明
`$readers`，而**没有任何机器会发现**——正是线索 229 那个形状：
判据由一个看不见新东西的扫描面撑着。

### 二、修法：两张表恰好划分，且「它是生成的」这句话要能被撞

补一张 `GENERATED`，**每一份点名谁生成它**：

```
i18n-keys.json        → scripts/i18n-manager.mjs
openapi.snapshot.json → scripts/gen-api-types.mjs
parity-diff.json      → tests/e2e-parity/diff.spec.ts   （make parity-accept 写的）
upstream-marker.json  → scripts/upstream-drift.mjs
```

两条新用例：**两张表合起来恰好等于 `baseline/*.json`**（与覆盖率棘轮的三个桶同构），
以及**每个生成器真的存在、真的提到那份 baseline、真的有写文件调用**——
后一条是 wave 83 的教训（散文里点名的符号可以根本不存在），
「这份是生成的」同样会烂：生成器改名、挪走、或者不再写它。

**顺带确认现有那张表没写错**：实测七份 json 里，恰好这三份没有写者。

### 三、新守卫第一次跑负向验证就抓到自己假绿（新坑 267）

N5「生成器提到了它但没有写调用」**第一次跑是绿的**。原因：那条检查写成

```ts
if (!/writeFileSync|writeFile\(/.test(text)) { … }
```

而扫描面**包含本文件自己**——当 GENERATED 指向本守卫时，它匹配到的是
**自己那段正则的源码**，于是判定「有写调用」。
**写进源码里的模式串会把自己算进扫描结果**（线索 126 的同一形状，
那次是写进注释就被算成有人用）。改成拼接构造之后 N5 真红。

### 四、负向验证（5 条，全部真红；其中一条第一次是假绿）

| 变异                          | 期望 | 实测                      |
| ----------------------------- | ---- | ------------------------- |
| 新增一份没登记的 baseline     | 红   | **红**                    |
| 从 HAND_MAINTAINED 删掉一份   | 红   | **红**                    |
| 生成器文件不存在              | 红   | **红**                    |
| 生成器存在但不提这份 baseline | 红   | **红**                    |
| 生成器提到了它但没有写调用    | 红   | **第一次假绿 → 修好后红** |

还原后 `diff -q` 逐字节一致，临时探针文件已清理。

## 上一轮（wave 103）做了什么：**清单第一条账复量完，结论是「不算差异」，并订正它的基准**

**没动 `frontend/`，也没动任何代码**（探针跑完即删）。产出是一组读数、一条订正、一笔结清的账。

### 一、用户可见的部分，两边逐字相同

1280 宽视口、61 字符的 basename、走 **Select 分支**：

|                 | 上游                                                    | 本仓                               |
| --------------- | ------------------------------------------------------- | ---------------------------------- |
| 标题 `span`     | 文本 61 字 · 盒 `407/407` **被裁 0px** · `line-clamp:1` | **完全相同**                       |
| `SelectTrigger` | 宽 **455**，右边缘 1267                                 | 宽 **455**，右边缘 1266            |
| 四颗动作键      | `@1115/1151/1187/1223`，**无越界**                      | `@1116/1152/1188/1224`，**无越界** |

wave 82 修的那件事（长文件名把整排动作键推出可视区）**仍然是好的**：一颗都没越界。

### 二、订正：wave 82 的「23px vs 5px」是拿两个不同层级的盒子在比

那条账写的是「上游 `scrollWidth 481 / clientWidth 458`、本仓 `497 / 492`，差 18px」。
问题在基准：探针的做法是「从头部往上找第一个 `overflow-x:hidden` 的祖先」，而这一步
**在两个应用里落到了不同层级**——

```
上游 → div.bg-background.flex.flex-col      clientWidth 458
本仓 → div.ml-auto.h-full.min-w-0           clientWidth 492
```

**两边 clientWidth 差 34px，本身就是「这不是同一层」的证据**（wave 82 记下的正是这
同一对 458 / 492，当时没往这上面想）。所以「18px 零头」从来不是一个可比的量。

本轮复量：上游仍有 **5px** 溢出、本仓 **0px**。但那 5px 被 `overflow-hidden` 裁在右
边缘之外，标题没被裁、动作键没越界，**没有任何用户可见后果**；按 fork-boundary 的判据
（「这处不改，React 自己是不是也是坏的？」）**上游自己也不坏**，所以两边都不改。
**这笔账结清，不必再追。**

### 三、探针自己先量错了一次分支（新坑 265）

第一版夹具用 write_file 工具调用造 artifact，量出来两边**都是溢出 0px**，看着像
「问题早就没了」。实际是走错了分支：artifact 头部是

```tsx
{isWriteFile ? <div className="truncate px-2">…</div> : <Select …>}
```

而 `isWriteFile = filepathFromProps.startsWith("write-file:")`。wave 82 那笔账明写着
「两边 `SelectTrigger` 的最小内容宽不同」，说的是 **Select 分支**，而 write_file 夹具
走的是 truncate 分支，**根本没碰到那条路径**。
**识别信号是动作键的名字变了**：truncate 分支那四颗里有一颗是消息里的
`Copy to clipboard`，Select 分支才是 `Open in new window / Copy / Download / Close`。
改用 `artifacts: [长路径]` + `artifact-trigger` 打开，才走到 Select 分支。

## 上一轮（wave 102）做了什么：**把 wave 101 的归因推翻，并第一次逐行量出 A/B 差在哪**

**没动 `frontend/`，也没动任何代码。** 改的仍是 `$pendingReasons` 的一行加几份文档。
产出是**一条被推翻的归因、三条被订正的事实、一笔被结清的账**。

### 一、A 与 B 到底差哪几行（此前 39 轮只有行数与请求数的推断）

按行做多重集差，`B = 62554acd79`（55 行）对 `A = 4080b1f763`（56 行）：

```
只在 A： - text: Completed in <1s Hello
         - button "Copy to clipboard"
         - alert: Loading... - DeerFlow
只在 B： - text: Completed in <1s
         - alert
```

**两件产品层面的事加一件框架层面的事**：①乐观的用户消息「Hello」在 A 里还没去重，
连带②多一颗复制键；③`alert` 那一行是框架的，见下。

### 二、那颗「Loading...」是 Next 的路由播报器，不是产品 UI

wave 101 把它归到 `LoadMoreHistoryIndicator` 的 `isHistoryLoading`——**错的**。
实测命中的元素：

```
root=ShadowRoot | host=next-route-announcer | hostParent=body
outerHTML=<div aria-live="assertive" id="__next-route-announcer__" role="alert"
           style="position: absolute; ... height: 1px; width: 1px ...">
文本="Loading... - DeerFlow"   而此时 document.title 已经是 "New Chat - DeerFlow"
```

**没有 `button` 祖先、`document.querySelectorAll("*")` 也找不到它**——因为它在
shadow root 里，而 **Playwright 的文本引擎会穿开放 shadow root，`querySelectorAll` 不会**。
它是 Next 的框架管道（Nuxt 没有对应物），A 里它留着上一拍的 `document.title`。
**屏幕上并没有一个转着的加载指示器**，wave 101 那句描述作废，据此挂的账也作废。

### 三、再订正两条

1. **「A 里那三条后续请求还没发」按集合比是假的。** 实测时间线上
   `token-usage` / `messages/page` / `langgraph/threads/{id}` 在 A 里同样发了、
   也都 200 回来了（**+588ms 之前全部完成，此后 60 秒网络上再没有任何东西**）。
   两个终态的请求**集合完全相同**，差的只是重复次数（20 vs 23）。
2. **mock 不是嫌疑人。** `messages/page` 的路由**永远 fulfill 200**，
   线程不认识时返回 `data: []` + `has_more: false`（`tests/e2e/utils/mock-api.ts`）。

### 四、「A 会不会自愈」仍然无解——而这正是 wave 101 读数的真正含义

wave 101 量的「5/5 未收敛」量的是**播报器那一行**，它永远不清（Next 不会回头改它）。
**产品层面①②那两行会不会收敛，至今没有量过。** 要接着追，直接盯
`text: Completed in <1s Hello` 消不消失，别再盯 `Loading...`。

### 五、为什么不给播报器加一条归一化

它在今天 **73 个已采纳取样点上一行都没出现**（台账里 0 处）。按坑 258
「一个几乎永远不会响的东西比没有更糟」，**先不加**；哪天某个已采纳场景被它污染了再加，
先例是请求档早就在丢 `_next/*` 与 `_nuxt/*`。
**而且就算加了也不解锁这条 pending**——真正的不确定性是①②那两行产品差异。

### 六、结论没变

**`pending` 保留**，判据不变、不放松。变的是**知道它为什么卡着**：
不是取样点抖，是那一屏在 700ms 这一刻**乐观消息去没去重**本身就不确定。

## 上一轮（wave 101）做了什么：**把挂了 38 轮的 pending 量到底：判据没满足，但病因订正了**

**没动 `frontend/`，也没动任何代码。** 这一轮的产出是三组读数、两条订正、一笔新账。
样本仍 **73**，台账仍 **95 行**，`pending` 仍 **1 条**——
改的只有 `baseline/parity-scenario-coverage.json` 里 `$pendingReasons` 的**那一行**。

### 一、按登记的判据跑，结论是「不翻案」

wave 63 把判据收紧成「**同一次构建连取 20 次，React 只出现一个终态**」。
照登记的复现方法跑（settle 仍是默认 700ms、每次取样换 fresh context、`--workers=1`）：

|       | 终态数 | 分布                                                                    |
| ----- | ------ | ----------------------------------------------------------------------- |
| React | **2**  | B `62554acd79/d2326c6393` ×15 · **A `4080b1f763/45e907c1a3` ×5（25%）** |
| Vue   | **1**  | `5c9e8360de/e2083d5866` ×20                                             |

**判据未满足，`pending` 保留。** 这正是事先写下判据的意义——
wave 63 当时就估过「20 次全干净约 2.4%」，这次没撞上，**不许改判据凑绿**（硬规则 3）。

### 二、订正：A **不是**「慢」，它不会自愈

原文写着「A 现在只是『慢』，几秒之后会收敛到 B」。这一轮在**取样之后**再等最长 90s：

```
A 样本 ×5 ：未收敛(>90s) ×5
B 样本 ×15：2ms 2ms 2ms 3ms 3ms …（那颗元素根本不在，所以立刻算「已隐藏」）
Vue  ×20 ：1~3ms
```

**5 个 A 样本无一收敛。** 回头看，整份历史记录反而全对得上：
wave 29「5 次里 2 次等满 30s」才是真信号、被读成了「慢」；
wave 62「14/14 都清掉了」只说明那 14 次**没出现 A**，不说明 A 会自愈。
~~所以这条 pending 的病因不是「取样点抖」，是上游这一屏有一个不会自己恢复的加载态：
`LoadMoreHistoryIndicator` 的 `isHistoryLoading` 一直为 true，屏幕上一颗「Loading...」一直在转。~~

**⚠️ 这段归因是错的，wave 102 已推翻。** 那颗「Loading...」根本不在产品 UI 里——
它是 **Next 自带的路由播报器**（`<next-route-announcer>` 的 shadow root 里那个
`#__next-route-announcer__`，`aria-live="assertive"`、1×1 裁剪），留着上一拍的
`document.title`。**屏幕上没有任何东西在转**，`LoadMoreHistoryIndicator` 与这件事无关。
本轮据此挂出去的那笔账（原第 7 条）随之作废。详见 wave 102 那一节。
**本轮真正站得住的读数**是「20 次里 React 两个终态、Vue 单一」，那部分不受影响。

### 三、A → B 第一次被逐字确认

把「等 Loading 消失」当成一条步骤加进场景（**只作探索，不作判据**），
React 落在**与 B 逐字节相同**的哈希上 18/20。所以 A 是 B 的前一态、不是另一个产品形态——
wave 63 只能从行数与请求数**推断**这件事。

### 四、A 率的变化**不显著**，别当回归

wave 63 是 4/23（17%），这一轮探索跑是 9/20（45%）、判据跑是 5/20（25%）。
看着像涨了，但**这是两个都带误差的样本在比**：Fisher 双侧 **p = 0.094**，不显著。
用二项尾概率算会得到 p = 0.0038——那是把 wave 63 的 4/23 当成真值，问错了问题。
**两个检验给出相反结论时，先问哪一个才是这次的问题。**

### 五、过程里踩了三次，如实记

1. **`captureScenario` 的第 6 个位置参数是 `settleMs`，不是 timeout。**
   我当成 timeout 传了 `90_000`，于是每个样本恰好睡 90 秒——**既让实验作废，
   又等于把 settle 从 700 偷偷改成 90000（硬规则 2 明令不许动）**。
   识破它靠的是「两个应用耗时完全一样、且恰好等于我填的那个数」。
2. **`grep -v "isLoading"` 又一次把信号本身过滤掉了**（坑 257 的同一形状）：
   要找的那一行正是 `{isLoading ? t.common.loading : …}`。
   差一点写下「这一屏 DOM 里没有 Loading 文案」这个错结论，
   而那个错结论会让第三节的读数变得无法解释。
3. **`prettier --check <被忽略的文件>` 会打印「All matched files use Prettier code style!」**
   ——**零个文件匹配也是这句话**。`baseline/` 在 `.prettierignore` 里，
   原因就写在那份文件里：prettier 会把短数组折成一行、生成器不会，
   两边都格式化会让 `*-check` 门禁在一次 `make format` 之后立刻红。
   我据此误以为可以拿 prettier 规范化，结果把整份文件的缩进从 1 空格变成 2 空格、diff 97 行。
   改法：**以 HEAD 原文为底稿、只替换那一行**，diff 回到 1 行。

### 六、负向验证（4 条，全部真红）

| 变异                        | 期望 | 实测   |
| --------------------------- | ---- | ------ |
| 把理由缩到 2 字             | 红   | **红** |
| 多挂一条无主的理由          | 红   | **红** |
| 删掉理由                    | 红   | **红** |
| 偷偷把 pending 挪进 covered | 红   | **红** |

还原后 `diff -q` 与备份逐字节一致，**没有假绿**。

## 上一轮（wave 100）做了什么：**命中测试进取样面**

提交 `b34f4f4e`。**没动 `frontend/`。** 样本仍 **73**，台账仍 **95 行**——
**新档一行没留下**，但它证明得了自己。

### 一、先过 wave 99 立的那道门槛（坑 258）

「**有没有一种变异能让它响、而现有的档都不响？**」——这一档举得出来：
**一颗按钮可以名字对、位置对、尺寸对、颜色对、能 tab 到，却点不动**
（`pointer-events: none` 或被透明浮层盖住）。aria 看不见（树没变）、
几何看不见（盒模型没变）、tab 序看不见（照样可聚焦）。

做法：锚点中心的 `elementFromPoint`，命中自己或后代记 `self`，
命中别的记**标签与 role**（不记名字——名字是 aria 档的活，坑 255）。

### 二、尺子先量自己，收窄了一次

第一版对所有锚点都量，报 3 行，**三行全部来自 `text:` 锚点**
（`React=textarea Vue=div(group)`、`React=header Vue=self`）。
`getByText` 解析到的是包着那段文字的元素，盒子可能很宽，中心点落在贴顶 header
或压在上面的输入框下面——**那不是「文字被挡住」，是「盒子中心恰好在别的东西下面」**，
对正文也没有后果。判据收成「**它是不是一个用户要去点的东西**」，其余记 `n/a`。
**3 → 0。**

### 三、那个 0 是算出来的

给 Drive 域按钮加 `pointer-events: none`（它只被 `visible` 取样、不被点，
所以不会先撞上 Playwright 自己的可操作性检查）：

```
role:button[/^(Drive|云空间)$/] hit React=self Vue=div     ← 两个语言维度各一行
其余字段（x/y/width/height/color/opacity）一行都没动
```

### 四、过程里踩了自己一次，如实记

第一次改 `capture.ts` 的 python 块**断言没匹配上**，而整条命令丢后台跑了，
**那条 traceback 我从头到尾没看见**；`diffGeometry` 于是在比
`undefined !== undefined`，报出「0 行」——**那个 0 不是算出来的，是没算**。
连着两次变异「没反应」，才回头 `grep -c hit capture.ts`，一个都没有。

## 上一轮（wave 99）做了什么：**层级那一档做了，量完发现不该要，撤了**

**代码改动为零**（写出来的东西全部还原）。这一轮的产出是一个否定结论。

### 做了什么

「天生看不见的八类」里第④类只剩「层级」那一半没补。写了 `diffAriaParents`：
不比绝对深度、也不比直接父节点，而是比**最近的、两边都有的祖先**——
只在一边出现的容器天然被跳过，这样「多包一层 wrapper」不会造成任何行，
而「同一个节点换了个爹」应该被抓住。配了 5 条单测，全过。

### 量出来：**73 个样本 0 行**，而那个 0 不是「都一样」，是「它几乎永远不会响」

按判据去验那个 0（坑 249：要验一个 0，变异必须绕开锚点）——
把侧栏菜单里的「设置」挪出 `DropdownMenuGroup`（两个应用都有这个 group，
所以节点集合不变）。结果：

```
parents 档   一行都没有
order  档    第 3 个公共节点 React=- group: Vue=- menuitem …   ← 它抓住了
```

**原因**：在序列化的树里，把一个节点挂到别的父节点下，**几乎必然同时改变它在
线性序里的位置**，于是 `diffAriaOrder` 先撞上；层级档只在「顺序不变、只有父子
关系变」这种几何上很窄的情形下才可能响。

### 决定：撤掉，不留

一个几乎永远不会响的字段比没有更糟——它会造出「层级也比过了」的错觉。
这与坑 194（长期红着又不在清单里的 gate 等于不存在）、
以及「这个 0 是算出来的还是没算」是同一条纪律。
**函数、台账字段、单测全部还原**（留着就是一段零消费者的代码）。

**收获写进了那八类的清单里**：第④类现在标成「顺序那一半已补、层级那一半
不必单做，理由如上」——**下一轮别再做第三次**。

## 上一轮（wave 98）做了什么：**核完 ScrollArea 那 42 行，并订正一条当规则用的错事实**

**没有代码改动**：这一轮的产出是两个读数和两条决定。

### 一、42 行核完：差异全在建议行那一层，而**那一层永远不会滚动**

```
/workspace/chats（会话列表页）     两边都有 1 个 viewport —— 对得上
/workspace/chats/new（聊天屏）     上游 1 个（在 #chat 里）、本仓 0 个 —— 差异全在这
```

顺着祖先链找到出处：上游的建议行套了一层 `ai-elements/suggestion` 的 `Suggestions`，
**它就是一个 `ScrollArea`**。再看实现——里面是 `flex w-full flex-wrap`（内容本来就换行），
外面那条横向 `ScrollBar` 写着 `className="hidden"`。**这一层永远不会真的滚动。**
本仓 `WelcomeSuggestionList.vue` 用普通的 `flex flex-wrap` 容器，**什么都没少**。

**决定：不跟。** 补一层不产生滚动的 ScrollArea，只会多一个键盘停靠点——
正是 wave 97 ① 刚修掉的那类噪声。翻案判据写进清单了。

### 二、订正：`ai-elements/*` **不是**整个目录都零消费者

记忆 `deerflow-vue-alignment-scope` 写着「React 里零消费者的死代码
（`ai-elements/*`、`ui/carousel`）不是豁免，是**禁止移植**」——**这句话把整个目录
都算进去了，而实测 28 份里有 14 份是活的**：`prompt-input`（8 处外部引用）、
`conversation`（4）、`shimmer` / `streamdown`（各 3）、`chain-of-thought` /
`model-selector` / `reasoning`（各 2）、`artifact` / `code-block` / `loader` /
`message` / `queue` / `suggestion` / `task`（各 1）。真正零消费者的是另外 14 份
（`canvas` / `checkpoint` / `connection` / `context` / `controls` / `edge` / `image` /
`node` / `open-in-chat` / `panel` / `plan` / `sources` / `toolbar` / `web-preview`）。
已在记忆里逐份列出并附量法。

**这条要紧，因为它是一条规则的依据**——「禁止移植」按目录理解会把一半活代码划进禁区。
（`ui/carousel` 那一半这一轮没复核，仍按原文。）

### 三、量的过程里踩了自己一次

第一版统计脚本 `grep -rn "ai-elements/$base\""` 之后再 `grep -v "/ai-elements/"`
想排掉目录内的自引用——**而每一行 import 里都含 `/ai-elements/`，于是把信号本身
过滤光了**，28 份全报「外部引用 0」，正好「印证」了那条错事实。
按**文件路径**排除才对。

## 上一轮（wave 97）做了什么：**结清 tab 序量出的四处，台账 115 → 95**

提交 `a16ff72a`（**两边同改**），chore `b92c90e0`，**marker 推到 `a16ff72a`**。
**动过 `frontend/` 的从此是二十二轮。**

### ① 关着的分隔条占着一个 Tab 停靠点（48 行 → 0）

`.workspace-panels--closed` 把 splitpanes 的分隔条设成
`opacity: 0; pointer-events: none`——鼠标用户完全感知不到，而它的 `tabindex="0"`
让**纯键盘用户照样 Tab 进来**，落在一个没有焦点环、也没有任何可见反馈的地方
（WCAG 2.4.7）。**本仓每一屏都有一个**（splitpanes 恒渲染），上游只在面板展开时
才渲染 resizable-handle。修在已有的 `syncSplitterDisabled` 里（它本来就在同步
`aria-disabled`）：关着 `-1`、开着 `0`；`artifact-panel-resize.spec.ts` 补两条断言。

### ② 滚动区键盘到不了：两边同改，**但代价要说清楚**（10 行 → 34+8 行）

本仓 `ScrollArea.vue` 文件头写着「viewport 保持 tabindex 可聚焦」（WCAG 2.1.1，
reka 默认给）。**上游 Radix 不给，而 shadcn 的 `scroll-area.tsx` 上写着
`focus-visible:ring-*`**——把它当可聚焦元素配了样式，而那个焦点环永远画不出来。
**这处不改 React 自己就是坏的**，所以补 `tabIndex={0}`。

**改完这一类从「本仓多 10 个」变成「上游多 34 个 + 8 行顺序」**——因为**上游用
ScrollArea 的地方本来就比本仓多**（settings 对话框等）。那是一处此前**完全看不见**
的结构差异，不是这次改动造成的回归。**已挂清单，下一轮逐个核。**

### ③ browser 面板 `section` → `div`（4 行 → 0）

**没有可访问名的 `<section>` 不是地标**，给不了任何语义，上游同一格用的就是 `div`。

### ④ 菜单 sub-trigger 的 roving tabindex（2 行）：**接受**

同一时刻只有一颗是 0，两边停在不同的项上；两种都是合法实现，感知不到差别。

### 门禁（逐条真跑）

Vue：verify 0（**263** 文件 / **2183** 单测）· e2e-parity **81**（台账 **95 行 / 73 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8 · asset-budget 0 · standalone-sim 13 / 5 / 0 ·
icon-parity 0 处待核 · e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14**。
React：check 0 · test **1034** · test:e2e **146**。

## 上一轮（wave 96）做了什么：**tab 序进取样面 + 修掉一处会让 verify 随机红的泄漏**

提交 `d21a1b67`，另有 `a165c96c`。**没动 `frontend/`。**
样本仍 **73**，e2e-parity 仍 **81**，台账 51 → **115 行**。

### 一、这一档比 aria 多出来的是「能不能 tab 到」

节点在树里好端端待着、却因为 `tabindex="-1"` / `disabled` / 被盖住而 tab 不到；
反过来 `tabindex="0"` 的 `<div>` 在树里可能只是 generic。
**两个应用 aria 树逐行相同、tab 序却不同，是完全可能的**——wave 86 那处
「上游多一层 `menu > link > menuitem`」正是这一类。

### 二、尺子先量自己：第一版 114 行，只有一处是新东西

带名字的第一版里，**~40 行是「上游写死英文」那一类的重复**（名字不同 → 同一颗键
被当成两个项），**8 行是 `"🏷️GitHub Issue triage"` vs `"🏷️ GitHub Issue triage"`**
（emoji 与标题之间差一个空白文本节点，aria 档按可访问名比、根本没报）。
**名字那一半是 aria 档的活**，描述收窄成 `标签[类型](role)`，114 → **64**。

### 三、64 行四处根因，全部归因到具体元素（都还没定，已挂清单）

```
48 行  div(separator) 只在本仓可 tab  →  splitpanes__splitter，本仓每一屏都有一个，
                                        上游只在可调整面板存在时才渲染 resizable-handle
10 行  div 只在本仓可 tab            →  div[data-slot=scroll-area-viewport] 可聚焦
 4 行  browser 面板那一格            →  同一个元素、不同标签（上游 div / 本仓 section）
 2 行  div(menuitem) 只在上游可 tab  →  菜单 roving tabindex 停在不同的项上
```

### 四、顺带修掉一处「用例全绿、退出码却是 1」

收工跑 verify 时 14 条 `ReferenceError: requestAnimationFrame is not defined`。
**先证因果**：我的树一红一绿、干净树绿、单跑那个文件绿——不是我的改动，
但按硬规则不当抖动放过，查到底是：DOM 用例把 rAF stub 成 `setTimeout`，
`vi.unstubAllGlobals()` **只换全局、不清已排队的定时器**，它 16ms 后触发时
全局已经没有 rAF 了。三份用例的 mount/unmount 是 1/0、6/3、1/0，
**靠「记得 unmount」收不了口**，改成 stub 自己记账。
**收窄过一次**：全仓五份 stub 里另两份是同步版与「收集回调自己 drain」版，
五份一起改会当场红——**同样的形状不等于同样的机制**（坑 236）。

### 门禁（逐条真跑）

verify 0（**263** 文件 / **2183** 单测）· e2e-parity **81**（台账 **115 行 / 73 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8 · asset-budget 0 · standalone-sim 13 / 5 / 0 ·
icon-parity 0 处待核 · e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14**。

## 上一轮（wave 95）做了什么：**顺序进取样面，第一跑就抓到子菜单被 portal 走**

提交 `855c209c`。**没动 `frontend/`。** 样本仍 **73**，e2e-parity 仍 **81**，
台账仍 **51 行**——**新档没留下任何一行**，它量出的两行是真差异，当轮修掉了。

### 一、本来要做的那件事没做成，如实记

冷启动清单上方向 C 的下一个同形目标是「各文件头『实测过、做不到』的结论
（已经翻案十一次）」。**量了一遍，这个类比文档说的小得多**：
按 `做不到 / 不可能 / 测不出 / 办不到` 扫全仓产品与工具源码只有 **10 处**，
逐条读完，多数是**过去式的历史说明**（`HumanInputCard.vue` 那句
「本仓**此前**……于是这件事在 Vue 上做不到」讲的是修好之前的状态）。
真正「现在仍然做不到」的活断言只有两三条，而且成立。
**下一轮别再照文档去追这条。**

### 二、但其中一条活断言指出了真的空白

`core/workspace-shell/settings-query.ts` 文件头：「对照台账按多重集比可访问性树，
**顺序天然测不出来**」——这条是对的，而它正是「天生看不见的八类」里的**第④类**。
wave 94 补完第⑧类（焦点），这一轮补第④类的顺序那一半。

`diffAriaOrder`：**先取两边的公共多重集**，再比这些公共节点的**相对顺序**。
这样「多包一层容器」不会误报（那正是 `diffAriaLines` 当初去缩进的原因）。
只报**第一处**分岔（一次重排会让后面全部错位，坑 219）。**五条单测钉住算法。**

### 三、第一跑就抓到一处真差异

```
thread-history/en-US 与 /zh-CN：第 7 个公共节点 React=menu "Export" Vue=separator
```

读两边的树才看清：

```
上游：… Export ▸ → [Export as Markdown, Export as JSON] → 分隔线 → Delete
本仓：… Export ▸ → 分隔线 → Delete （父菜单读完）→（页面末尾）子菜单那两项
```

**根因：`DropdownMenuSubContent.vue` 包了一层 `DropdownMenuPortal`，上游没有。**
上游 shadcn 里 `DropdownMenuContent` 包 Portal、`DropdownMenuSubContent` **不包**。
本仓那一层是照着 Content 抄的，文件头写的理由是「同样 portal 到 body」——
**抄来的假设，不是量出来的**。后果是**子菜单两项与打开它的触发器被拆开**。
去掉那层 Portal，两行消失。

### 四、另加一条单测（台账只钉「一不一致」）

两边一起改成 portal 时台账照样 0 行（线索 238）。所以在
`tests/unit/ui/primitives.dom.test.ts` 里钉：打开子菜单后
`dropdown-menu-sub-content` 必须是 `dropdown-menu-content` 的**后代**。

### 负向验证 2 条，全红

| #   | 变异                    | 结果                      |
| --- | ----------------------- | ------------------------- |
| N1  | Portal 装回去，跑对照   | 两行顺序差异回来 → 台账红 |
| N2  | Portal 装回去，只跑单测 | 新加的那条当场红          |

### 门禁（逐条真跑）

verify 0（**262** 文件 / **2180** 单测）· e2e-parity **81**（台账 **51 行 / 73 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8 · asset-budget 0 · standalone-sim 13 / 5 / 0 ·
icon-parity 0 处待核 · e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14**。

## 上一轮（wave 94）做了什么：**焦点进取样面（天生看不见的第八类）**

提交 `6804bd6b`。**没动 `frontend/`。** 样本仍 **73**，e2e-parity 仍 **81**，
台账 44 → **51 行**。

### 一、尺子先量自己：第一版报 17 行，10 行是它自己造的

第一版描述器「标签 + type + （aria-label → placeholder → title → 文本）」报 17 个键，
逐条看完是两类噪声：`button "X"` vs `button[button] "X"`（同一颗键、同一个名字，
差的只是上游没写 `type="button"`）、`div "SettingsDeerFlow's…"` vs
`div "Settings DeerFlow's…"`（焦点在同一个**没有名字的容器**上，差的只是子节点间
有没有空白文本节点）。

收紧三条（写进函数头）：**`type` 只对 `input` 取**、**文字只对「文字就是它名字」的
标签取**（button/a/summary/label/option）、**不取 testid/id/class**。**17 → 7。**

### 二、剩下 7 行，三处，全是真的

**① settings 深链后的焦点（4 行）——本仓更好，而且不是「更好看」。**
上游走 Radix Dialog 默认自动聚焦 = 第一个可聚焦元素（导航第一项「账号」），
**而屏幕上显示的是「集成」面板**；本仓 `SettingsDialog.vue` 的 `focusInitial`
把焦点送到当前分区那颗导航键。
**负向验证顺手证明了这段代码挡的是真缺陷**：拿掉它之后，本仓焦点落到了
**对话框背后的 composer textarea** 上——模态开着而焦点在模态外面。

**② mermaid 下载键的名字（1 行）** —— wave 92 那一类（译文）在焦点档的重复。

**③ 改动面板打开后的初始焦点（2 行）—— incidental，不是设计。**
两个应用的 `SheetContent` 里关闭键都排在 children 后面（DOM 顺序一致），
本仓也没有任何显式焦点代码。最可能是文件列表到位的时机不同。
**如实记成 incidental，并且现在它被钉住了**——哪天翻过来就是一个时序信号。

### 三、先证稳定再钉

新档的行**不是抖动**：连跑三次（两次 diff + 一次 accept），7 个键逐字相同。
坑 246 的教训——间歇地量错比稳定地量错更难查。

### 负向验证 2 条，全红

| #   | 变异                       | 结果                                          |
| --- | -------------------------- | --------------------------------------------- |
| N1  | 拿掉 Vue 的 `focusInitial` | 四行变成「Vue=textarea 背后的输入框」→ 台账红 |
| N2  | 描述器退回宽松版           | 噪声行回来 13 处 → 台账红                     |

### 门禁（逐条真跑）

verify 0（**262** 文件 / **2174** 单测）· e2e-parity **81**（台账 **51 行 / 73 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8 · asset-budget 0 · standalone-sim 13 / 5 / 0 ·
icon-parity 0 处待核 · e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14**。

## 上一轮（wave 93）做了什么：**mermaid 下载菜单进取样面；方向 A 的清单清空**

提交 `0ec3b9a4`。**没动 `frontend/`。** 样本 71 → **73**，e2e-parity 79 → **81**，
台账 30 → **44 行**（新增 14 行是 wave 92 那一类在同屏第二个终态上的重复）。

### 一、下载菜单本身 **0 差异**，而且那个 0 是算出来的

**上游那一侧不是上游源码**，是 `streamdown` 这个 npm 包的发布产物，所以锚点名字是
**去那份产物里核出来的**（触发器 `title="Download diagram"`，三项可见文字
`SVG` / `PNG` / `mmd`），不是照本仓词典猜的。

```
thread-history-mermaid#download-menu/en-US   0 行
thread-history-mermaid#download-menu/zh-CN   14 行（= 工具条那一类，与 #default 同）
```

**en-US 那个 0 是算出来的**：往本仓菜单里多加一项 `JPG`，那个键当场从
`ariaOnlyVue: []` 变成 `["- button \"JPG\""]`（N2）。

### 二、方向 A 的清单到此**清空**

冷启动 prompt 上最后一条「`chat` 那一屏的 composer 菜单」**是过期的**——
composer 上四个能展开的控件**都已经在取样面里**，只是挂在别的场景上
（wave 30 记下的更便宜的做法）：

```
斜杠建议    → sidebar 场景的 fill 步骤（那个场景明写着不能有 click）
模型选择器  → agent-chat
模式菜单    → user-message-plain-text（桌面）+ ui-polish-mobile（移动端）
推理强度    → workspace-changes#reasoning-menu
```

剩下的 `addAttachments` 是文件选择器，点开是操作系统对话框，取样够不着。
**下一轮找活不要再看这张表了，它空了。**

### 三、守卫抓到一次：别把带构建哈希的文件名写进注释

第一版注释写了那个 chunk 的完整文件名，`doc-references` 当场红——它按
「路径里的文件名在 checkout 里搜得到」判，而 `node_modules` 不在 checkout 里。
**更要紧的是那个名字带构建哈希，下次装依赖就变了。**
这次挡住的是一个**必然过期**的引用，不是误报。

### 负向验证 2 条，全红

| #   | 变异                         | 结果                                  |
| --- | ---------------------------- | ------------------------------------- |
| N1  | 菜单项 `PNG` → 「PNG 图片」  | 锚点 `/^PNG$/` 先不匹配 → 到不了 → 红 |
| N2  | 多加一项 `JPG`（锚点全匹配） | en-US 那个键多出一行 → 台账红         |

N1 与 wave 92 的 N3 同形（锚点同时也是文案守卫，比台账更早撞停）；
**N2 才是证明「那个 0 是算出来的」那一条**——它专挑「不碰锚点、只改内容」的改法。
**这是一条通用做法：要验一个 0，变异必须绕开锚点。**

### 门禁（逐条真跑）

verify 0（**262** 文件 / **2174** 单测）· e2e-parity **81**（台账 **44 行 / 73 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8（一张没重录）· asset-budget 0 ·
standalone-sim 13 / 5 / 0 · icon-parity 0 处待核 ·
e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14**。**没动 `frontend/`。**

## 上一轮（wave 92）做了什么：**19 个只跑英文的场景全部补上 zh-CN**

提交 `d36c2d60`。**没动 `frontend/`。** 样本 51 → **71**，e2e-parity 59 → **79**，
台账 2 → **30 行**（新增 28 行是**同一类、已决定保留**的差异）。

### 一、把坑 244 系统地扫完

24 个场景里 **19 个只跑 en-US**，全部补上。**一个场景补一维就够**——语言轴与
断点/主题轴正交，翻译分叉在哪个断点上都一样，给每个既有维度都配中文孪生
只会让取样时间翻倍而不多查出东西。

### 二、先用可达性层探路，不拿大用例去撞

19 个新维度里 **10 个当场到不了**。**没有直接跑 `diff.spec.ts`**——一个坏锚点卡满
30 秒，10 个就是 300 秒，会把那条 600 秒的用例拖垮。改跑 `scenarios.spec.ts`
（一个键一条用例、各自计时），三轮把锚点收干净：**10 → 7 → 3 → 0**。
**这条方法本身值得记住**：批量加维度/加场景时，可达性层是廉价的探路工具。

**zh 文案一个都不是猜的**：写脚本把 en 文案反查成词典 key，再取同一 key 的 zh 值，
两个应用各查一遍确认一致（坑 235）。一共 **21 处锚点**改成跨语言正则。

### 三、量出来的 28 行是同一类：上游把字写死成英文

```
browser-feature/zh          12 行  Back / Forward / 地址栏 placeholder /
                                   「Connecting to live browser…」/「Waiting for…」
thread-history-mermaid/zh   14 行  mermaid 工具条六颗键 + 图片 alt
artifact-stream-state/zh     2 行  「Text file」vs「Text 文件」
```

逐条查过出处：`browser-view-panel.tsx:401/462` 是**内联英文字面量**（词典里没有
对应 key）；mermaid 工具条来自 **`streamdown` npm 包**，上游连改都改不了；
`fileTypeLabel` 是**本仓独有的 key**，上游内联拼。

**取舍：保留本仓的翻译。** 判据是 fork-boundary 里那条已授权的例外
——「**vue 有更好的可以保留**」。把 13 处译文改回英文，是在**这个要留下来的应用**上
做一次用户可见的退化；两边同改也不成立（mermaid 那半在依赖包里）。

**为什么进台账而不是只写进文档**：**台账自己就是这一类的守卫**——`diff.spec.ts`
是整棵结构深比，这一类多一条、少一条、或译文改一个字，它立刻红（N2/N3 实测）。
写进文档就没有任何机器看着了。

### 负向验证 3 条，全红

| #   | 变异                            | 结果                                              |
| --- | ------------------------------- | ------------------------------------------------- |
| N1  | Rename 锚点还原成只认英文       | thread-history zh 当场「到不了」→ 红              |
| N2  | 拿掉 thread-list-pin 的 zh 维度 | 台账深比少一个键 → diff 用例红                    |
| N3  | `browser.back` 中文改一个字     | 锚点先不匹配 → 红（**来自可达性层，不是台账行**） |

**N3 如实记**：跨语言正则**同时也是一道译文守卫**，改译文会先在锚点上撞停，
比台账更早。

### 门禁（逐条真跑）

verify 0（**262** 文件 / **2174** 单测）· e2e-parity **79**（台账 **30 行 / 71 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8（一张没重录）· asset-budget 0 ·
standalone-sim 13 / 5 / 0 · icon-parity 0 处待核 ·
e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14**。**没动 `frontend/`。**

## 上一轮（wave 91）做了什么：**几何加 opacity、步骤加 hover，branch-thread 17 行清到 2 行**

提交 `fa66fb66`。**没动 `frontend/`。** 样本 48 → **51**，e2e-parity 56 → **59**，
台账 0 → **2 行**（两条都逐条交代过）。

### 一、两处尺子升级，各自先量了自己

**`opacity` 进几何档。** `opacity: 0` 的元素**照样在可访问性树里**、照样有
x/y/宽高、computed `color` 一点不变——「一边看得见一边看不见」这件事
**aria / 几何 / 请求三档同时报不出来**。加上去之后既有 48 个样本**一行没多**
（单独跑了一遍确认），而且**它是活的**：把 Vue 那颗分支键自己的 opacity 改成
0.5，台账当场报两行（N4）。只取元素自己的值、不乘祖先链（坑 219）。

**`hover` 进步骤档。** `click` 造不出悬停态（点下去有副作用），`visible` 只等待
不移动指针。**实现是移三次不是一次**——探针里「hover 一次 + 等 1.5 秒」Vue 到了
React 没到；场景里「hover 一次 + 30 秒轮询」**两边都到不了**，等待时间不是变量。
**机制没查到底就没写死**（能确定的是 hover 会先 `scrollIntoViewIfNeeded`，
而这一屏容器确实被滚动了：React scrollTop=60 / Vue=0）。坑 237 的同族。

### 二、量出来的 17 行，三处根因

```
①  4+4 行  zh-CN 分支键的可访问名不同
②  2   行  React 的可访问性树里多一个 tooltip 节点
③  5   行  tooltip 浮层的位置/宽度
```

**① 真差异，修掉。** 上游用 `common.branch`（zh「分叉」），本仓用
`messages.actions.branch`（zh「创建对话分支」）——**en-US 下两条恰好都是
"Branch conversation"，所以只跑 en-US 永远看不出来**。这一屏此前只有 en-US 一维。
按 wave 28 判据「命名弱但存在算风格不算缺陷」→ 照抄上游。
**这条对下一轮通用：只跑一种语言的场景，等于把「翻译分叉」整类排除在取样之外。**

**③ 是尺子的毛病不是产品的。** tooltip 是 portal 到 body 的 `position: fixed`
元素，`sampleGeometry` 的「祖先 scrollTop 加回去」对它无效（祖先只有 body/html），
量到的 y 里原样带着**触发器所在容器的滚动**。直接量过：分支键**文档**坐标两边
都是 **y=208**，**视口**坐标 React=148 / Vue=207。改用**触发器自己的
`data-state="delayed-open"`** 当锚点——普通在流元素，滚动补偿成立。
（另记：`[role=tooltip]` 不能当锚点，两个库都把它挂在 1×1 clip 的隐藏播报节点上。）

**② 接受进台账，理由查到库里。** Radix 的 `<VisuallyHidden role="tooltip">`
**不**加 `aria-hidden`；reka-ui 2.10.1 的 `VisuallyHidden` 默认
`feature: "focusable"`，那一支会打 `aria-hidden="true"`
（`node_modules/reka-ui/dist/VisuallyHidden/VisuallyHidden.js:28`），
于是 reka 把**专门给读屏器读的那个节点**从树里摘了出去。
**两边的描述都还念得出来**（`aria-describedby` 的描述计算不受 aria-hidden 影响），
差的只是 React 树里多一个 `tooltip` 角色节点。那个节点在 `TooltipContentImpl`
内部、不经过我们的 slot，本仓够不着。**翻案判据**：reka 改掉那个默认值，
这两行自己就没了。

### 负向验证 4 条：3 红 + **1 条假绿**

| #   | 变异                       | 结果                                 |
| --- | -------------------------- | ------------------------------------ |
| N1  | 还原 zh 分支文案           | zh-CN 那把从 1 行涨到 4R+3V 行 → 红  |
| N2  | hover 只移一次             | **四个 capture 全部「到不了」** → 红 |
| N3  | 锚点换回 portal 出去的浮层 | **geometry 0 行，没复现** → **假绿** |
| N4  | Vue 分支键自己 opacity 0.5 | 台账报 `opacity R=1 V=0.5` 两行 → 红 |

**N3 的假绿本身就是结论**：同一棵树、同一个锚点，一次跑出 `Δ44/Δ48`、另一次
跑出 0——那个锚点**不是稳定地量错，是间歇地量错**，而间歇变红的门禁比恒错的
更难查。换锚点的依据因此不靠 N3，靠上面那组直接读数（文档坐标两边都是 208）。

### 门禁（逐条真跑）

verify 0（**262** 文件 / **2174** 单测）· e2e-parity **59**（台账 **2 行 / 51 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8（一张没重录）· asset-budget 0 ·
standalone-sim 13 / 5 / 0 · icon-parity 0 处待核 ·
e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14**。**没动 `frontend/`。**

## 上一轮（wave 90）做了什么：**channels 的连接对话框进取样面，两条互斥分支都接上**

提交 `1e5a2815`。**没动 `frontend/`。** 台账仍 **0 行**，样本 44 → **48**，
e2e-parity 52 → **56**。

### 一、触发器怎么定位（这一处挂了好几轮就卡在这里）

两个应用**没有共用的 testid**（本仓按钮上有 `channel-provider-*`，上游没有），
按钮文案又都是 "Connect"/"Connected" 的翻译，一屏上好几颗一模一样。
唯一两边都成立、又与语言无关的坐标是**夹具自己给的 `display_name`**——
它不进词典，两种语言下逐字相同：

```
[data-sidebar="menu-item"]:has-text("Feishu") button
```

`data-sidebar` 是两个应用都写死的 data-* 选择器（场景文件头允许的四种定位之一）。
对话框里的字段锚点同理：`Token` 来自夹具的 `credential_fields`，
所以 `role: textbox` + `name: "Token"` **连正则都不用写**。
**这条对下一轮通用：两边没有共用 testid 时，先去找夹具里的字符串——
它天然与语言无关，而且两个应用拿到的是同一份。**

### 二、两条互斥分支，各挂一个终态

- `providerNeedsRuntimeConfig`（enabled 且未 configured 且有 credential_fields）
  → **新建**分支（`setupTitle` / `saveAndConnect`），夹具里只有 **Feishu**
  （Discord 也未 configured，但 `enabled: false`，整行不渲染）。
- 已连接 + `providerCanEditRuntimeConfig` → **编辑**分支
  （`setupEditTitle` / `saveChanges`），取 **DingTalk**。

提交键的文案是这两条分支**唯一在可访问树上分得开**的地方，拿它当锚点等于顺手
钉住「点已连接的那一行进的是编辑分支」。

### 三、读数：四个新样本三档全 0，而且是算出来的

raw 几何里对话框 512×244、Token 输入框 462×36、两颗页脚键的位置与色板逐字相同；
zh-CN 下对话框高度变成 224、提交键宽度 149.3 → 102（文案变短），**两边一起变**。

### 四、按 wave 88 的判据问了一句「这一块本身对不对」

台账 0 只说明两个应用一致（线索 238）。这个对话框逐条看过：`<label for>` 给了
输入框可访问名、两颗页脚键有文字名、对话框有标题与描述、`required` 在。
唯一扎眼的是**密文字段用 `type="text"` + `-webkit-text-security` 而不是
`type="password"`**——两个应用都这么写，**而且文件头写了理由**：后端回的是掩码
占位串，不该让浏览器与密码管理器当成一次真实登录输入。**这是决定不是漏**，不动。

### 负向验证 2 条，全红

| #   | 变异                          | 结果                                                        |
| --- | ----------------------------- | ----------------------------------------------------------- |
| M1  | Vue 的 `<label>` 去掉 `:for`  | **两个新终态 Vue 双双「没能到达场景」**，`default` 不受影响 |
| M2  | Vue 的 `isEditing` 恒为 false | **只有 `runtime-config-edit` 到不了**，另两个仍是 0         |

M1 证这两个新键**是承重的**——一处单边的可访问名回归，门禁当场红在**可达性**
那一层（比台账多一行还早）。M2 证锚点选得准：`Save changes` 真的在区分分支。

### 顺带：探针自己错了一次

第一版探针想在 `page.evaluate` 里用 `document.querySelectorAll(TRIGGER)` 复核触发器，
而 `:has-text()` 是 **Playwright 的 CSS 扩展、原生 DOM 不认**，那条用例当场抛错。
真正验证触发器的是另一条用例（点开了、对话框出来了）。
**教训：复核锚点要用与门禁同一套定位引擎，别换一套。**

### 门禁（逐条真跑）

verify 0（**262** 文件 / **2174** 单测）· e2e-parity **56**（台账 **0 行 / 48 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8（一张没重录）· asset-budget 0 ·
standalone-sim 13 / 5 / 0 · icon-parity 0 处待核 ·
e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14**。
**没动 `frontend/`，所以 React 三条不在本轮清单里。**

## 上一轮（wave 89）做了什么：**把「选中态只靠换色」做成守卫，顺手清掉两边各 12 颗**

提交 `91ab3b2a`，React 侧同一条（两边同改），chore `9cb61684`，
**marker 推到 `91ab3b2a`**。**动过 `frontend/` 的从此是二十一轮。**

wave 88 量出对照台账的一个**结构性盲区**（线索 238）：两个应用一起漏掉同一个属性时，
aria / 几何 / 请求三档全是 0 行。这一轮把那条散文判据变成机器守的。

### 一、先量：判据能不能收住口

全仓（两个应用）`variant` 在 `default` / `outline` 之间条件切换的地方逐个归位：

```
React  15 处 <Button> + 1 处 <Badge>
Vue     9 处 <Button> + 1 处 <Badge>
```

`<Button>` 那些**全部**是选中/未选中开关；`<Badge>` 那两处不可交互、状态就在徽标
文字里。其余条件 variant 也逐条看过：`secondary`/`ghost` 的面板触发器（sidecar /
browser）状态在**可访问名**里（`open ? close : open`），`outline`/`secondary` 的
渠道键是动作键不是开关。
**所以「`<Button>` + 条件 `default`/`outline` ⇒ 必须有 `aria-pressed`」这条规则
一条豁免都不需要**（线索 180：豁免表为空才说明收口选对了）。

### 二、尺子先量自己，再量代码

`tests/guards/toggle-variant-pressed.test.ts` 第一次跑的读数：
**Vue 6 处（v-for 展开后 12 颗）· React 12 处**，两边同样是 12 颗
（React 把筛选逐颗写开了，Vue 用 `v-for`）。
它**没有**报星期几按钮、也没有报 wave 88 刚修好的 24 颗——那三处本来就有。
报出来的集合与手工点出来的逐条相同，不多不少。

**扫描面自证**：Vue 那一半复用 `productVueInventory()` 并断言 `unscanned` 恒为空
（线索 229）；React 那一半自己走目录树并断言扫到的文件数不为 0。

### 三、修的是同一个文件里 60 行开外就有的写法

`scheduled-tasks` 页状态筛选 5 + 类型筛选 3、上下文模式 2、周期类型 2。
**判据仍是「同一份代码库里的既定写法」**——`scheduled-task-schedule-input.tsx`
里星期几按钮一直写着 `aria-pressed`，而同一个文件里的 cron/once 那两颗没有。
是漏了，不是决定。

### 四、静态守卫守不住的那一半

守卫只看得见「属性在不在」，写成 `:aria-pressed="false"` 它照样绿（N5 实测）。
所以另加 `tests/unit/scheduled-tasks/filters.dom.test.ts`：真渲染一次，钉
**值跟着状态走**、同组只有一颗 true、而且**九颗全都有这个属性**
（缺属性和 `false` 不是一回事，读屏器只有属性存在时才念「未按下」）。

### 五、跨应用声明与 skip 的真伪

守卫要读 `../frontend/src`，已进 `cross-app-by-design.mjs`。
**React 那一条是 `it.skipIf` 不是 `describe.skipIf`**，读文件也在用例体里（线索 225）。
`make standalone-sim` 实测报的是 **1 过 / 1 跳过 / 0 红**——跳过在报表上真的显示为
跳过（线索 226）。DECLARED 39 → **40 处 / 18 个文件**，BLOCKING 仍 0。

### 负向验证 6 条，全红，无假绿

| #   | 变异                                   | 跑什么                         | 结果                                  |
| --- | -------------------------------------- | ------------------------------ | ------------------------------------- |
| N1  | 删掉 Vue 一处 `:aria-pressed`          | 守卫 Vue 那条                  | 1 failed / 1 passed                   |
| N2  | 删掉 React 一处 `aria-pressed`         | 守卫 React 那条                | 1 failed / 1 passed                   |
| N3  | 往白名单外塞一个 `app/dodge-probe.vue` | 守卫 Vue 那条                  | 红在 `unscanned` 上，**不是**静默放过 |
| N4  | 标签扫描器换成 `/<Button\b[^>]*>/`     | 守卫 React 那条                | **12 条假报**                         |
| N5  | 值写死成 `:aria-pressed="false"`       | 守卫 vs DOM 用例               | **守卫照样绿**，DOM 用例 2 failed     |
| N6  | 删掉 React 筛选那颗 `aria-pressed`     | `frontend` scheduled-tasks e2e | 1 failed / 7 passed                   |

**N4 是这一轮最值钱的一条**（线索 241）：朴素正则在
`onClick={() => setStatusFilter("all")}` 的那个 `>` 上把标签截断，写在后面的
`aria-pressed` 就看不见——同一棵干净的树被报成 12 处缺陷。**方向由属性顺序决定**：
单独量过 `<Button onClick={() => setX("a")} variant={sel ? "default" : "outline"}>`，
朴素版切出来是 `<Button onClick={() =>`，**连 variant 都读不到**，那颗会被静默跳过。
噪的那一半看得见，静默那一半看不见（线索 230 的同一件事）。

### 门禁（逐条真跑）

Vue：verify 0（**262** 文件 / **2174** 单测；词典 942 key / 18 unused）·
e2e-parity **52**（台账 **0 行 / 44 样本**）· e2e-mock 265+22+15+2+6 ·
e2e-visual 8（一张没重录）· asset-budget 0 · standalone-sim **13 / 5 / 0** ·
icon-parity 0 处待核 · e2e-backend 2+5+2+3+3+5+1+1 · audit 预期红 **14** ·
standalone-check BLOCKING 0（DECLARED **40 / 18**）。
React：check 0 · test **1034** · test:e2e **146**。

## 上一轮（wave 88）做了什么：**integrations 的两个交互态进取样面，并两边同改补上 aria-pressed**

提交 `1083b122`，React 侧同一条（两边同改），chore `9abc8d0c`，**marker 推到 `1083b122`**。
另有 `55678738`：wave 87 漏改的那一份折叠断言。**动过 `frontend/` 的从此是二十轮。**

### 一、接上取样面：三个终态，两个是新的

`integrations` 此前只有一个默认终态。这个面板上「点一下才出现」的东西，
`useState` 数一遍**正好四个**：`selectedAuthDomains` / `customAuthScope` /
`showChangeApp` / `changeAppBrand`（其余状态要真的授权流程才走得到）。
四个全挂上，用 wave 87 那条 `states` 轴分成两个终态：

- `permission-request`：点两个域（Calendar / Docs）+ 填自定义 scope。
  连接键因此改写成「申请新权限」——**这一颗锚点是「交互真的落到状态上」的凭据**，
  没有它，三颗按钮同色只能说明主题相同。
- `change-app`：展开「切换飞书 Bot」的整块表单，并把品牌从默认的 feishu 点成 lark。

台账键 `integrations/…` → `integrations#default/…` 等六个，样本 **40 → 44**，
e2e-parity **48 → 52**。**两个新终态的 aria、几何、请求三档全是 0 行。**

### 二、那个 0 是算出来的，不是没算

先量的是尺子自己（坑 213/186）。把锚点的原始几何打出来：

```
选中的 Calendar   color rgba(250,250,250) background rgba(0,0,0,255)     ← default 档
未选中的 Drive    color rgba(10,10,10)    background rgba(253,250,243)   ← outline 档
```

两个应用逐字相同，而**选中与未选中在读数上分得开**——所以这个 0 是「量了，相等」。

### 三、量出来的差异：两个应用都不把选中态念出来

```
- button "Calendar"                 ← 视觉上已经是黑底白字的选中态
- button "Drive"
- button "Switch app" [disabled]    ← 同一份快照里 disabled 是出得来的
```

**22 颗域按钮 + 2 颗品牌按钮，两个应用都只用 variant 换色表达选中**，
`aria-pressed` 一处都没有。`[disabled]` 在同一份快照里出得来，
说明不是快照看不见这类状态，是它真的不在。

判据三条都指向两边同改：① **同一份代码库里的既定写法**（wave 28 那条最强证据）——
`scheduled-task-schedule-input.tsx:275` / `ScheduledTaskScheduleInput.vue:253`
的星期几按钮**逐字同形**，那边两个应用都写着 `aria-pressed`；
② 这处不改 React 自己也是坏的（WCAG 1.4.1 / 4.1.2）；③ 业界主流做法。

**取舍：品牌那两颗为什么不做成 radiogroup。** `ToggleGroupItem.vue` 的文件头
（坑 102）写的是「单选该是 `role="radio" + aria-checked`」——但那是给一个自带
single/multiple 模式的 primitive 定的。这里是两颗手写按钮，真做成 radiogroup
就欠一套方向键 roving focus，两个应用都没有，只挂 `role="radio"` 比现在更糟。
选的是「普通按钮 + `aria-pressed`」，代价（读屏器听到的是两颗独立的按下键，
不是「二选一」）写进了两边的注释。

### 四、**台账钉的是「一不一致」，不是「在不在」**

**两边一起漏掉 `aria-pressed` 时，台账照样是 0 行**——这一轮就是这么量出来的。
所以存在性只能各自钉：Vue 那一侧两条 DOM 单测（2168 → **2170**），
React 那一侧 `frontend/tests/e2e/integrations.spec.ts` 的同一处交互上六条断言。
**这条对下一轮有用：「台账 0 行」永远不能读成「这一处没问题」。**

### 五、e2e-backend 又抓到一条红了一轮的用例

`e2e-shell` 的 `workspace-shell.spec.ts:271` 报 `element(s) not found`。
`git stash` 之后在**干净树上照样红**——是 wave 87 把改动面板的行改成
`<Collapsible defaultOpen={hasDiff}>` 时漏改的一份折叠断言（同一处断言在
`tests/e2e/workspace-shell.spec.ts` 里那一份，那一轮已经改过了）。
**漏得掉的原因是 wave 87 的收工清单里没有 e2e-backend**——坑 194 的又一次。
修法照抄已经改好的那一份：先把 `[data-slot="collapsible-trigger"]` 里
`data-state="closed"` 的逐个点开，断言内容一个字没动。

### 六、锚点自己先量了一遍

先跑探针把 `[role=dialog]` 里的 **36 颗按钮 + 1 个输入框**在四种
（应用 × 语言）组合下全打出来，才定的锚点：域名与按钮文案两边词典都翻译了
→ 写成覆盖两种语言的正则；**`App ID` 两种语言逐字相同**，是这一块唯一敢直接
按名字找的锚点；自定义 scope 输入框两种语言都含 `OAuth scope` → 用它做子串。

顺带记一笔（**不改**）：`button "Close"` 在 React 是 sr-only 的 span、
在 Vue 是 `aria-label`，textContent 一个是 "Close" 一个是空，
而可访问名相同、台账 0 行。按 wave 28 的判据「命名存在即可」，不动。

### 负向验证 5 条，全红，无假绿

| #   | 变异                               | 跑什么                              | 结果                   |
| --- | ---------------------------------- | ----------------------------------- | ---------------------- |
| M1  | 删掉 Vue 域按钮的 aria-pressed     | `integrations-settings.dom.test.ts` | 1 failed / 5 passed    |
| M2  | 删掉 Vue 品牌按钮的 aria-pressed   | 同上                                | 1 failed / 5 passed    |
| M3  | 删掉 React 域按钮的 aria-pressed   | `frontend` `tests/e2e/integrations` | 1 failed / 5 passed    |
| M4  | 删掉 React 品牌按钮的 aria-pressed | 同上                                | 1 failed / 5 passed    |
| M5  | **只删 Vue 两处**，跑对照探针      | integrations 的两个新终态           | aria 差异 0 → **3 行** |

M5 一次证了三件事：新取样面**真的抓得到单边回归**（`button "Calendar" [pressed]` /
`"Docs" [pressed]` / `"Lark" [pressed]` 只在 React 侧出现）；`/^Lark$/` 那一步
**真的点中了**（默认品牌是 feishu，而 React 侧 Lark 是 pressed）；
`[pressed]` 确实进得了快照。

### 门禁（逐条真跑）

Vue：verify 0（**260** 文件 / **2170** 单测；词典 942 key / 18 unused；
产品 SFC 218 / 总 220）· e2e-parity **52**（台账 **0 行 / 44 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8（一张没重录）· asset-budget 0 ·
standalone-sim 12 / 5 / 0 · icon-parity 0 处待核（不报 stale）·
e2e-backend 2+5+2+3+3+5+**1**+**1**（修完之后）· audit 预期红 **14**。
React：check 0 · test **1034** · test:e2e **146**。

## 上一轮（wave 87）做了什么：**给对照场景加一条 `states` 轴，量出改动面板的 7 处**

提交 `289cb588`。**没动 `frontend/`。**

### 起因：一个场景只有一个终态，而互斥的交互态谁也进不去

`workspace-changes` 上的推理档菜单与改动面板**都是模态的**——开了一个就点不到
另一个。此前只能二选一，于是改动面板那一整块从来没进过取样面。
**不能靠加场景绕过去**：场景 id 受棘轮约束，必须逐字等于上游 spec 文件名。
夹具与步骤不受约束，所以把「多个终态」做成场景内部的一个轴是唯一不动坐标系的做法。

`ParityScenario.states?: { id, steps }[]`，与 `steps` 二选一（两个都写会抛）。
台账键变成 `场景#终态/断点/主题/语言`，**没声明 `states` 的场景键逐字不变**
（换名字的话台账会一次报出「全部消失 + 全部新增」，那和真差异长得一模一样）。
样本 39 → **40**，e2e-parity 47 → **48**。

### 量出来的 7 处，四处根因，全清

① **Sheet 头部结构**：上游图标在 `SheetTitle` 里面，本仓是标题旁边一列
（`flex-row gap-3 pr-14`）——标题右移 28px、可用宽度少 64px。
② **文件行是 `<details>` 不是 `Collapsible`**：`<details>` 的隐式 role 是 **group**
（树里多一行 `group:`），原生 `<summary role="button">` 不广播 `aria-expanded`。
③ **少了 `+N -M` 增删数**；两个 span 之间要有**真的文本节点**（用 `{{ " " }}`，
靠源码里那个空格不行——prettier 一换行 Vue 就把它 condense 掉）。
④ **「打开文件」链接挂的是 `aria-label`**，它会被算进**外层按钮**的可访问名；
上游用 `title`，链接自己仍有名字而按钮名里没有它。

两条断言「不展开就看得到理由」的用例跟着改成「点开再断言」——
**是用例过期不是产品回归**：上游那一行本来就是 `defaultOpen={hasDiff}`，
折叠时 Radix / reka 不渲染子节点。

### 顺带：**我的改动把一条流式 e2e 的红率从 0/6 抬到 2/6**

`real-stream.spec.ts` 里「流式期间用户上滚后不该被拽回底部」那条开始间歇红。
**因果查到底，过程如实记**：干净树 3/3 绿 → 我的树 3 次红 2 → `git stash` 后
3/3 绿 → 只还原 `WorkspaceChangesBadge.vue` 也 3/3 绿。
**第一次归因说过头了**：怀疑是新加的 `watch(files, …, { immediate: true })`
把组件订阅到了 detail 查询上，删掉之后红率 2/3 → 1/3，**没有消失**
（那个 watch 本来就多余，删得对，但它不是原因）。
真正的机制：**这条 spec 里根本没有 workspace changes，被改的组件一次都没渲染**
——能影响它的只剩包体与时序。
所以改的是**测量方式**：`page.mouse.wheel` 只发一个事件，落在两次程序化滚动
之间才留得下来；改成「滚到它真的动为止」。契约没放宽（契约在下半段），
硬化后同一棵树 **6/6 全绿**（坑 237）。

### 门禁

verify 0（**260** 文件 / **2168** 单测）· e2e-parity **48**（台账 **0 行 / 40 样本**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8 · asset-budget 0 · standalone-sim 0。
`make parity-accept` **放行**（新键 0 行，正是 wave 85 那道闸门要放行的情形）。

## 上一轮（wave 86）做了什么：**给取样面接上三处交互态，两处有货一处干净**

提交 `3bfec0f9`，React 侧同一条提交（两边同改），chore `1677e96b`，
**marker 推到 `3bfec0f9`**。**动过 `frontend/` 的从此是十九轮。**

连做三轮尺子之后回到产品面。判据照 wave 20/21：**一个域收工前，把它所有
「点一下才出现」的东西列出来，逐个问「这一屏进过取样面没有」。**

### 一、会话行的 ⋯ 菜单（挂在 `thread-history`）：一次量出 7 处

```
role:menuitem[Delete]             x React=252 Vue=56    Δ-196
role:menuitem[Delete]             y React=400 Vue=423.9 Δ23.9
role:menuitem[Delete]             color React=rgba(10,10,10,255) Vue=rgba(231,0,11,255)
role:menuitem[Export as Markdown] x React=439 Vue=243   Δ-196
role:menuitem[Export as Markdown] y React=364 Vue=388   Δ24
role:menuitem[Rename]             x React=252 Vue=56    Δ-196
role:menuitem[Rename]             y React=295 Vue=319   Δ24
```

三处根因（x 全差 -196、y 全差 24 是同一处的两个投影，坑 215）：
① 本仓 `align="end"` 且**不传 side**，上游 `side="right" align="start"`
——菜单整个落在侧栏**里面**而不是侧栏右侧；
② 内容盒 `min-w-48` vs 上游 `w-48 rounded-lg`；
③ 删除项本仓传了 `variant="destructive"`，而上游那颗是普通项——
**全仓没有一处**给 `DropdownMenuItem` 传过 destructive（那个 variant 只用在
Button 与 Alert 上）。按双向规则删掉本仓多出来的这一处。

### 二、侧栏页脚的「设置和更多」菜单（挂在 `thread-list-pin`）：两边同改

`ariaOnlyReact` 9 行：四条外链各多一个 `link` 节点 + `/url`，外加一个 `group:`。

**几何 0 差异**——本仓那颗菜单的 `align` / `side` / 圆角三处都与上游不同，
而两个取样锚点的位置逐像素相同（碰撞翻转把差异抵消了）。**先量再改救了这一处**：
照着「形状看着像 wave 78 那次」去改，会改出一个真差异来（坑 236）。

两处根因，方向相反：
① **本仓少一个 `DropdownMenuGroup`**（上游用它把「设置 + 四条外链」括成一组），
补了这个 primitive；
② **上游把 `<DropdownMenuItem>` 套在 `<a>` 里面**，于是菜单里出现
`link > menuitem` 这种嵌套可交互元素——`menu` 的子节点该是 menuitem，
外层那个 `<a>` 还会自己进 tab 序、不受 Radix 的 roving tabindex 管。
**Radix/shadcn 文档给的写法正是本仓用的 `asChild`**，所以按判据两边同改，
把上游那四处改成 `<DropdownMenuItem asChild><a>`。

### 三、定时任务的编辑表单（挂在 `scheduled-tasks`）：**0 差异**

整块只在点「Edit」之后才存在。接上之后一处差异都没有。**不必再量。**

### 锚点自己先量错了两次

① 内层锚点写成 `text: "Timezone"`，**两边都到不了**——`fields.timezone`
这条词条在两个应用的 schedule input 里都没有被渲染成可见文字（坑 235）。
② 按可访问名找「Edit」/「Save edit」，**en-US 过、zh-CN 当场超时**——
这个场景有**两个语言维度**（坑 234）。改成覆盖两种语言的正则；
内层两个锚点用两边逐字相同的 testid。

### 门禁

Vue：verify 0（**260** 文件 / **2168** 单测）· e2e-parity **47**（台账 **0 行**）·
e2e-mock 265+22+15+2+6 · e2e-visual 8（一张没重录）· asset-budget 0 ·
standalone-sim 0 · icon-parity 0 处待核。
React：check 0 · test **1034** · test:e2e **146**。

## 上一轮（wave 85）做了什么：**「只能变短」那三句话——一句补成门禁，两句改成实话**

提交 `27fb23ad`。**没动 `frontend/`**——仍是十八轮，marker 仍是 `809237ec`。

wave 84 挂上的那笔账。三处写着「只能缩短 / 只能变短」，实测**没有任何机器在守**。
这一轮逐处判了一遍：**能守的补上门禁，守不了的把话改准。**

### 一、`parity-diff.json`：能守，因为**只有一条路能让它变长**

`make parity-accept` 此前是**无条件覆盖**基线。Makefile 里那句
「否则这个目标会变成把回归洗白的按钮」说的正是这件事，而它一直只靠人记得。

现在 accept 时逐行比对新旧，出现一行基线里没有的就**拒写**并打出来；
真要接受得 `PARITY_ACCEPT_GROW=1 make parity-accept`。

**判据是集合包含，不是行数**——修好一条、同时新坏一条，行数不变，而台账里多了
一行没人看过的东西。那正是「洗白」的样子（坑 232）。

**算法抽成 `tests/e2e-parity/support/ledger.ts` + 单测**，因为
**那条分支在台账 0 行时永远走不到**：跑真的 `make parity-accept` 验不了它，
留在 spec 里就等于一段没人验过的逻辑（坑 233）。

### 二、`pending` 那两句：**守不了，所以把话改准**

`baseline/parity-scenario-coverage.json` 的 `$semantics` 与
`support/scenarios.ts` 的文件头各写了一遍「pending 只能变短」。
**没有历史参照就判不了单调性**，而这份 baseline 是手改的、没有 accept 那样的唯一入口。

所以两处都改成实话：标出真正上了门禁的四条（covered == 目录 / 三桶恰好划分上游
spec 清单 / 每条 pending 有不短于 20 字的理由且无多余理由 / exempt 落在已豁免路由上），
并写明「只能变短」是**评审政策**，靠的是「从目录里删一个场景」会同时逼出
「covered 少一个」和「pending 多一条理由」两处 diff。
真要机器守，可行判据写在那里：「不许有 id 从 covered/exempt 退回 pending」，
而那需要一份只增不减的 covered 底线。

**这不是绕过去。** 一句不可能被守住的承诺写成门禁的口气，正是 wave 83/84
反复撞见的那一类：**它长得和真门禁一模一样。**

### 负向验证

| 变异                         | 期望   | 实测                                            |
| ---------------------------- | ------ | ----------------------------------------------- |
| `addedRows` 改成按**行数**判 | 单测红 | 3 failed / 6 passed——正好是区分两种判据的那三条 |

配套：`make parity-accept` **实跑了一次**（台账 0 行，`added` 为空所以放行）。
它确实改写了基线——逐行 diff **只有 `$comment` 那一行**，正是 accept 分支里
同步换掉的那段说明。这一跑同时证明新逻辑端到端走通且没有误拦。

## 上一轮（wave 84）做了什么：**把「扫描面盖全了没有」当成一条判据，量出三处**

提交 `55022f02`。**没动 `frontend/`**——仍是十八轮，marker 仍是 `809237ec`。

把 wave 83 的方法（**真跑一遍那句声明**）套到「扫描器的扫描面」上。
三处的形状完全一样：**一张白名单出发的门禁，看不见「自称是、但不在名单里」的那些**
（坑 186），而报表上「没有违规」与「没有扫过」逐字相同（坑 176）。

### 一、`.vue` 的扫描面漏在白名单之外——**真的能溜过去**

`PRODUCT_ROOTS`（`app/components` / `app/pages` / `app/layouts`）+ `app/app.vue`
是白名单。实测：往 `app/error.vue`（Nuxt 的约定文件之一）塞四条硬编码英文——

```
make i18n-source-check   exit 0   "no core English literals"
make i18n-check          exit 0
source-guard.test.ts     绿（checked 仍是 217，toHaveLength(217) 一动不动）
doc-facts.test.ts        绿（「共有 219 个 Vue SFC」照旧，实际已经是 220）
```

**四道门禁全绿，而那四条英文会照常发给用户。**
修法：`productVueInventory()` 多返回 `unscanned`（checkout 里没被白名单盖住的
`.vue`），**恒为空**；CLI 先判扫描面盖全没有、再判扫到的干不干净；
`doc-facts` 的 total 改成从 checkout 算，那句「当前 checkout 共有 N 个」才真是
关于 checkout 的。**有意不加豁免表**（坑 180）。

### 二、三处 `git ls-files` 看不见还没提交的文件

`standalone-check.mjs` 早就诊断并修好了这个盲区，而同一个盲区在
`tests/architecture.test.ts`（L2 边界）与 `tests/guards/file-header-claims.test.ts`
（两处）**一直开着**。抽成 `scripts/lib/checkout-files.mjs` 共用。
**一条已经被诊断过的坑，在另一个文件里照样是新的**（坑 231）。

### 三、剥注释的正则不认字符串——**静默放过的那一半**

顺手把 `file-header-claims` 的扫描面补上 `config/` 与 `shared/`（都是生产源码：
Nuxt 4 的 `shared/` 被 app 与 server 自动导入，`config/routes.ts` 被 nuxt.config 消费），
**补进来当场红了一条**：

```
config/routes.ts：【主要导出】点名了 buildProxyRules，文件没有导出它
```

它导出着。是这条门禁自己的 `source.replace(/\/\*[\s\S]*?\*\//g, "")` 不认字符串：
`"/workspace/**"` 开了一个假注释，**一口吃掉 1886 个字符**。扫描面内有 **8 份**
文件的字符串里带 `/*`——这条门禁一直在半截源码上工作。
`【主要导出】` 那一半会误报（吵，看得见），`【依赖关系】 无` 那一半**静默放过**
（被吃掉的 import 数不到）。`standalone-check` 那份按字符走的实现是对的，
抽成 `scripts/lib/strip-comments.mjs` 共用（抽取前后 standalone-check 输出逐字相同），
`architecture.test.ts` 的同名副本一并换掉（它靠数 import 判 L2 边界，同一个方向）。

**剩下那批（9 份单测里扫 `.vue` 的正则剥法）实测今天一处都没错**——219 份 SFC
逐个比对，两种剥法产出的 token 集合完全相同。**不必再量一遍。**

### 负向验证（3 条全过）

| 变异                                      | 期望       | 实测                                                          |
| ----------------------------------------- | ---------- | ------------------------------------------------------------- |
| 放回带硬编码英文的 `app/error.vue`        | 三条路径红 | i18n-source-check exit 2；source-guard 点名；doc-facts 要 220 |
| 剥注释换回正则版                          | 守卫红     | 1 failed / 5 passed，点名 `config/routes.ts`                  |
| 未提交的违规 L2 文件 + 退回「只看已跟踪」 | 抓不到     | **15 passed（漏掉）**；带 `--others` 时 1 failed（抓住）      |

## 上一轮（wave 83）做了什么：**第一次真做验收实验——判据自己是假的**

提交 `3703ae61`，另有 `5a5580d5`（两处 drag 助手）。**没动 `frontend/`**——
仍是十八轮，marker 仍是 `809237ec`。

一页纸挂账清单上排第一的那条（「验收判据本身没被验过」）这一轮做掉了。
做法就是它写的那句：**把 `frontend/` 移出 checkout，跑一遍，再移回来。**

### 结果：BLOCKING 早已是 0，而 `make verify` 当场红

```
install (frozen lockfile)   exit 0
verify                      **exit 1**  ← test 这一步红
build / asset-budget        exit 0
e2e-mock                    **exit 2**  ← 与兄弟应用无关，见下
e2e-visual                  8 passed
e2e-parity                  47 skipped, exit 0     （声明的行为，逐条对上）
upstream-drift / icon-parity / record-react-markdown   都打印一行后 exit 0
```

红的是 `tests/unit/i18n/upstream-key-coverage.test.ts`：

```
Error: ENOENT: no such file or directory,
  open '.../frontend/src/core/i18n/locales/en-US.ts'
❯ readDictionary tests/unit/i18n/upstream-key-coverage.test.ts:66:25
 Test Files  1 failed | 255 passed | 3 skipped (259)
```

它的文件头写着「上游缺席则整组 skipIf」，`standalone-check` 的
`CROSS_APP_BY_DESIGN` 也照抄了这句话。**两句都是假的**——
`describe.skipIf` 跳过的是**用例**，不是**收集**：工厂函数照样执行一次，
里面那句 `readFileSync` 于是照样跑（坑 225）。表里另外两个
`describe.skipIf` 的作者都自己挡了（`present ? walk(...) : []`），只有这一个没挡。

**这就是线索 183 的正面靶子**：`CROSS_APP_BY_DESIGN` 的 `note` 那一栏挂了几十轮，
**零消费者**。写错了不会有任何征兆——它长得和写对的一模一样。

### 顺手量出第二条假话

修完之后跑新尺子，`doc-references.test.ts` 报 **12 过 / 0 跳过**，
而表里写的是「缺席时只有那一条用例跳过」。**两处都不准**：受影响的是**三条**用例，
而且它们根本不是跳过——是函数体里 `if (known === null) return;` **报绿**（坑 226）。
一条什么都没查的用例和一条查过、干净的用例，在报表上逐字相同。
改成 `it.skipIf(!checkoutComplete)`，并让 `checkoutBasenames()` **不再返回 null**
——真少了东西就该炸。改完实测 **12 过 / 3 跳过**。

### 落地的四样

1. **`scripts/lib/cross-app-by-design.mjs`（新）**——表搬出来，每条从「一句散文」
   变成 `{ kind, note }`。`kind ∈ test | script | data | e2e` 说的是
   **「兄弟应用缺席时靠什么保证不红」**，也就是那句 note 该怎么验。
   17 条 = 9 test + 3 script + 4 data + 1 e2e。
2. **`make standalone-sim`（新）**——判据的**动态**那一半：真 rename 兄弟应用
   （`<repoRoot>/.frontend-standalone-sim-parked`），跑完 `finally` 移回来，
   SIGINT / 未捕获异常 / process exit 三条路径都挂了还原，**下次启动先自愈**。
   逐条打印每个文件的「过 / 跳过 / 红」。**有意不进 `verify`**：它动文件系统，
   而且不能与任何构建并发。它是**收工清单**的一项。
3. **`tooling-contracts.test.ts` 加一组守卫**（进 verify）——每条都分了类、
   类与路径形状对得上、点名的文件还在。这样「新加一条却没想清楚缺席怎么办」
   当场红，不必等谁去跑 sim。
4. **`standalone-check` 文件头**补一句：它是**静态**证明，证不了「移走之后还能跑」。

### 那条 e2e 的红：与兄弟应用无关，是尺子自己的一条老缝

`artifact-panel-resize.spec.ts:100`（drag-collapse）在整套 265 条里红了一次，
**单独跑三遍 15/15 全绿**。因果够不着兄弟应用（这条 spec 一个字都不碰它）。

但翻 `dragPanel` 时找到一条真缝：`hover()` 把光标放到**它当时**量到的中心，
`boundingBox()` 是**之后**另一次观测。两次之间布局再动一下，`mouse.down()`
就按在旧位置——**按空了整个拖拽什么都不发生**，报出来却是「面板没关」这种离得很远的断言。
`tests/e2e-infra/splitpanes.spec.ts` 的注释里记的正是同一件事，**而它自己也没挡**。
两处都在 `mouse.down()` 前补一次 `mouse.move(x, y)`（挪到**这次**量到的坐标）。
**没有证据说这就是那一次红的原因**——一次观测不足以定性；补的是无条件正确的一条。

### 门禁（收工时逐条实跑）

```
verify           exit 0    259 文件 / 2158 单测（+3 = 新守卫）；词典 942 key / 18 unused
standalone-sim   exit 0    跑过 12 条、未跑 5 条（4 data + 1 e2e）、红 0
                           `--with-e2e` 本轮也跑过一次：**13 / 4 / 0**，
                           那一条报「make e2e-parity exit 0，47 条跳过」
e2e-parity       47        台账 0 行 / 39 场景
e2e-mock         265 + 22 + 15 + 2 + 6
e2e-visual       8         一张没重录
asset-budget     exit 0
standalone-check BLOCKING 0 处 / 0 个文件（DECLARED 39 处 / 17 个文件）
```

## 上一轮（wave 82）做了什么：**长文件名把整排动作键推出可视区——两边同改**

提交 `c3399c3b`，React 侧 chore `809237ec`，marker 推到 `809237ec`。

wave 78 挂的那笔账（「上游同样没有截断，长文件名会把动作键推出可视区，**做之前先量**」）
这一轮量完了。**是真的，而且两边都坏，上游还差 18px。**

### 实测（1280 宽视口，59 字符的 basename）

|                  | 上游                                                | 本仓                        |
| ---------------- | --------------------------------------------------- | --------------------------- |
| 面板裁剪盒       | `scrollWidth 657 / clientWidth 458`，溢出 **199px** | `673 / 492`，溢出 **181px** |
| 编辑键越过裁剪边 | +53.1px                                             | +36.1px                     |
| 关闭键越过裁剪边 | **+197.1px**                                        | **+180.1px**                |

五颗动作键（编辑 / 新窗口 / 复制 / **下载** / **关闭**）**全部落在面板的
`overflow-hidden` 盒子之外**，x 从 1285 起而视口只有 1280 宽——这份产物
**既下载不了、面板也关不掉**。短文件名下两边都正常。

### 修法：宽度归标题栏，动作栏不让位

三处，两边逐条相同：**标题栏 `min-w-0`**（flex item 默认 `min-width:auto`，
不写它就不肯缩；中间那一栏本来就 `min-w-0 grow`，该让位的是标题）、
**`SelectTrigger` 加 `max-w-full`**（它是 `w-fit`，不写这条不理会外层的收缩；
里面的 `SelectValue` 自带 `line-clamp-1`。write_file 那一支的纯文字标题加 `truncate`）、
**动作栏 `shrink-0`**（里面的 Button 自己带 `shrink-0`，容器一缩它们就溢出容器盒子
——两条要一起写才闭合）。

复测：长名下五颗键**全部回到裁剪盒内**，位置与短文件名时逐像素相同。
**残留如实记**：长名下裁剪盒仍有轻微溢出——上游 481/458（23px）、本仓 497/492（5px），
溢出的是标题那一侧（两边 SelectTrigger 的最小内容宽不同），**没有任何一颗动作键在里面**。
台账那条场景用的是短文件名，这 18px 差进不了取样面；要不要追是下一笔账。

### 探针自己先量错过一次（坑 186 又一次）

第一版按 `aria-label` 找动作键，**React 侧一个都没找到**——上游 `ArtifactAction`
把 label 塞进一个 sr-only 的 span，不是 `aria-label`。报表因此把 React 那一半读成
「没有面板」，看起来像「上游根本没走到详情页」。改成 `aria-label ?? textContent` 之后
两边都读得到。**可访问名的来源两边不同，按属性找的探针会静默漏掉一整边。**

### 门禁

Vue：verify 259 / 2155、e2e-parity 47（台账 **0 行**）、
**e2e-visual 8 一张没重录**（修法在短文件名下是空操作，正如预测）、
e2e-mock 265+22+15+2+6、e2e-backend 2+5+2+3+3+5+1+1（全绿）、
icon-parity 0 处待核不报 stale、asset-budget 0、audit 预期红 14。
React：check 0 / test **1034** / test:e2e **146**（`landing.spec.ts:61` 那条已知抖动
这次没出现）。

## 上一轮（wave 81）做了什么：**把两笔「先复量再决定」的账量完，两条结论都不变**

**没有代码改动**（探针跑完即删），产出是两组读数。

### `/showcase` 的请求层：第三次逐条复量，一字不差

```
react  /api: GET /api/features · GET /api/models · GET /api/skills
             · GET /api/suggestions/config · GET /api/threads/«generated»/uploads/limits
vue    /api: GET /api/models
react-only : features · skills · suggestions/config · threads/«generated»/uploads/limits
vue-only   : （空）        aria: onlyReact 0 / onlyVue 0        落地 URL 两边相同
```

与 wave 27 / wave 28 完全一致。wave 28 的决定不变（四条都打向需要鉴权的端点，
案例页是公开只读的，可见差异实测为零）。**翻案判据仍是「有没有哪个只读能力因为缺了
这四条而在案例页上失灵」。**

### 建 agent 页 chat step 的外壳：**比 wave 28 记的少一项**

wave 79 之后 **More 菜单已经对上**（React 触发器 x=1232，本仓 x=1231，相差 1px），
`agents.more` 也有了消费点。剩下的是 header 本身：上游
`justify-between gap-3 border-b px-4 py-3`（高 57，左边返回键 + `h1 "Design your Agent"`，
右边只有 More），本仓是 AgentChat 的 `absolute h-12 backdrop-blur`（高 48，左边侧栏
触发器 + agent 名字，右边用量徽标 + More）。**结论不变：保留本仓这一侧**
（叠上去会有两个 header）。

aria 差 onlyReact 3 / onlyVue 10，**但后者大半不是外壳**——轮次操作条与会话链接是
两次跑拿到的对话状态不同，属于 wave 63 记的那条竞态。
`agents.createPageTitle` 在本仓**有消费点**（命名步骤那张页的 h1），不是死词条。

### 方法学

线索 187 又一次算对了账：**两条都是「先复现再修」省下的一整轮**。
但也要反过来记一句——**复量的结论是「不变」时，要把「不必再复量」写进账里**，
否则下一轮还会再量一遍。这两条现在都写了。

## 上一轮（wave 80）做了什么：**修一条红了七轮没人知道的 e2e**

提交 `e1028406`。wave 79 收工时跑全套 `e2e-backend`——**它自 wave 64 起就不在任何一轮的
收工清单里**——`e2e-channels/channels.spec.ts:64` 当场红，**单独跑两遍也红**，不是抖动。

根因见坑 220：`filter({ hasText: /^Add account$/ })` 匹配的是**没归一过的** textContent，
而这颗按钮是 `<Plug />` 图标 + 插值，Vue 模板在两者之间留下一个文本节点，
`textContent` 因此是 `" Add account"`。实测 `allTextContents()` 返回
`[" Add account","Modify","Remove provider configuration"]`——只有带图标的那几颗有前导空格。
报错是 `element(s) not found`，**而同一次失败的 page snapshot 里那颗按钮明明在、
状态也正是断言要的 `[disabled]`**。

**不是这一轮弄的**：图标是 wave 72（`32d71958`）加的，定位器从 `18b7ad2c`（08-30）就在；
图标本身是对的（上游 `channels-settings-page.tsx:281` 同样带 `PlugIcon`），
所以修的是定位器不是产品。**因果与 wave 78/79 够不着**：`ChannelConnections.vue` 的
传递闭包 48 份文件，这两轮动过的 12 份一份都不在里面。

配套：**把 `e2e-backend` 写进收工清单**（坑 222），并记下 `make e2e-backend` 是 8 个套件
**串行、第一个失败就停**——channels 排第四，它红之后后面四个套件的状态是**未知**不是绿
（坑 221）。

## 上一轮（wave 79）做了什么：**清掉守卫注释里点名的最后两笔账**

提交 `b79695de`。`tests/guards/handwritten-button.test.ts` 的 `ALLOWED` 注释里点名两笔，
wave 72 点了名没做——两处都是「位置与形状」而不是样式。

### 一、保存 agent 键：工具条上一颗手写 button → 页头右上角的 ⋯ 菜单

上游 `agents/new/page.tsx:309` 是 header 右端一颗 `ghost / icon-sm` 的 More 触发器，
菜单里一个 `DropdownMenuItem` + `SaveIcon`。先按线索 199 确认上游那颗**活着**
（`step === "chat"` 渲染、`handleSaveAgent` 接 `sendMessage`；没有 e2e 走到那条路由，
但那是取样面的问题不是死代码）。

**决定性的证据是文案自己**（线索 216）：`agents.saveHint`（两个应用共用的上游文案）
写的是 "You can save this agent at any time **from the top-right menu**"，
而本仓的保存是工具条上一颗可见按钮——**界面和它自己的说明打架**。
这不是「本仓更好」的取舍。顺带把 agents 那条 more 接上（wave 28 记的「永远没有消费点」
到此结束；扫描器按叶子名匹配，词典 942 / 18 不变）。

### 二、MessageList 的 artifactTargets 文件名键：删掉

ALLOWED 里写着「上游那一支渲染的是 ArtifactFileCards」——**这句是错的**（线索 217），
`frontend/src` 里没有这个名字，那是本仓自己的组件。逐条量下来：写文件那三个工具调用
在**两个应用**里都归 `assistant:processing` 组画成 chain-of-thought 的一步
（上游 `message-group.tsx:853` ↔ 本仓 `ProcessingToolStep.vue`），`present_files`
两边都走各自的 present-files 分支。剩下唯一走得到那排按钮的缝是 `assistant:subagent`
组，而上游那一支只画「执行 N 个子任务」+ reasoning + SubtaskCard，同样不画文件名键。
零测试覆盖 → 按双向规则删掉（线索 218）。

## 上一轮（wave 78）做了什么：**16 行几何归到五处根因，台账清零**

提交 `ba84b142`。做法沿用 wave 77：**把同形的一组归因到一处，先找那一处**。
每一处都先用临时探针在两个应用上取一次渲染读数（线索 204）再动代码，
没有一处是照着 Δ 值硬调偏移调出来的。

| 根因                                                                                                                      | 关掉        | 出处                                |
| ------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------- |
| 页脚被拍平成一排 + 一根 `flex-1` 撑杆（上游是 `justify-between` 里两个 `PromptInputTools`）                               | 3 行 x      | `input-box.tsx:2323`                |
| 菜单写死 `align="end" side="top"`（上游 `align="start"`、不传 side）                                                      | 3 行 x/y    | `prompt-input.tsx:1066`             |
| 模式菜单项多传一个 `py-2`（primitive 已经是 `py-1.5`）                                                                    | 2 行 height | 推理档那个菜单 wave 76 已拆过同一条 |
| `ui/command` 的 class 合同只抄了一半（`CommandList` 多 `p-2`；`CommandItem` 是 `gap-3 px-3 py-2 rounded-md`）             | 5 行        | `ui/command.tsx:102/159`            |
| artifact 头部是**三栏**不是一排（动作键 gap 8 vs 4；标题那层的 `min-w-0 flex-1` + 触发器 `max-w-full` 把文件名截掉 21px） | 2 行        | `artifact-file-detail.tsx:400`      |
| sidecar 页脚少一条 `pt-3`（页脚矮 12px → 内容区高 12px → 垂直居中的空态下移 6px）                                         | 2 行        | `sidecar-panel.tsx:602`             |

**触发器本身不在取样面里**（几何只取 `visible` 锚点，`click` 目标不取），所以
「一根撑杆把模式键从 x=468.5 推到 805.2」这件事只能从菜单项的 x 差里反推——
判据见线索 215。

顺带补的：`DropdownMenuContent` 缺 `max-h-(--reka-dropdown-menu-content-available-height)`

- `overflow-y-auto`（**比视口高的菜单滚不动**，实测本仓 max-height 恒为 `none`，
  上游同屏 507 / 735px）与 zoom/slide/transform-origin 那几条；`Command` 根缺
  `bg-popover text-popover-foreground`（模型选择器整块底色是 `--background` 而不是
  `--popover`，两个 token 在明暗两套里都不是同一个值，同 wave 76 的 sidecar 底色）。

### 取舍

- **artifact 标题不再截断**，照抄上游。代价是文件名足够长时头部被撑开、右边的动作键
  被推出可视区——**上游同样如此**，所以这是一笔要两边同改的账，记在「挂着的账」里，
  不是本仓单边保留的理由。
- `z-80`（上游 `z-50`）与 `hover:bg-accent`（上游只有 `focus:`）继续保留，理由同前几轮。

### 负向验证：16/16，第一次跑只报出 15 行

把五处一次性反转成改动前的**效果**（`display:contents` 拍平两处容器 + 撑杆 +
align/side + py-2 + CommandList/Item 的内边距 + 去掉 sidecar 的 pt-3 + 标题那两条），
`e2e-parity` 当场红，报出的 16 行与改动前的台账**逐字相同**。

第一次跑只报出 **15** 行：`text:batched-report.md width` 没回来。**是变异不完整**——
标题的截断需要 `min-w-0 flex-1`（外层）与 `max-w-full`（触发器）**两条同时在**，
第一版只还原了外层。补上之后 16/16。

## 上一轮（wave 77）做了什么：**验了 wave 76 记下的那条假设，一处改动关掉七行**

提交 `60b8f1e8`。wave 76 在待办里写着「artifact 头部那几条 `y Δ-7.5` / `Δ-14`
三个场景都出现，多半是同一处，**一处修好可能同时消掉五六行**，先找它」。
**这一轮验了，是对的。**

上游 `ai-elements/artifact.tsx` 的 `ArtifactHeader` 是
`bg-muted/50 flex items-center justify-between border-b px-4 py-3`，
调用点再传 `className="px-2"`（artifact-file-detail.tsx:400）。本仓三条都不一样：

|      | 上游                              | 本仓（改前）         | 后果                                                                 |
| ---- | --------------------------------- | -------------------- | -------------------------------------------------------------------- |
| 高度 | `py-3`（上下各 12px，高度随内容） | **`h-12` 写死 48px** | **比上游矮 8px**，底下的东西整体上移——五条 `y Δ-7.5` / `Δ-14` 全是它 |
| 横向 | `px-2`                            | `px-3`               | 右侧那排动作键左移，`Download x Δ-7`                                 |
| 底色 | `bg-muted/50`                     | **没有**             | 头部与正文之间只有一条下边框                                         |

**结果**：`artifact-stream-state` 3 行 → **0**；`artifact-batched-stream` 6 行 → **2**
（`Download x` Δ-7 收到 Δ-3；文件名宽度 Δ-29.3 收到 Δ-21.3，**没查完**）。
台账 **23 → 16**。

**视觉基线重录一张**：容差压到 0 跑两遍，`artifact panel` **两遍都是 5866 像素**
——稳定，就是这次改动。其余七张零容差逐像素相同。
**这一轮那条已知抖动没出现**，两遍完全一致。

## 上一轮（wave 76）做了什么：**几何档接上交互后的锚点，量出 27 处此前看不见的差异**

提交 `e96f0adf`。这是线索 137 的正题：`sampleGeometry` 只取 `settle` 里的
`visible` 锚点，而 settle 跑在 steps 之前——**靠交互才出现的东西，位置永远进不了台账**。

### 改法与两处配套

`steps` 里的 `visible` 也当锚点。原来那句「click/fill 的目标在交互后可能已经移动
或消失」**只对 click/fill 成立**——`visible` 是「这次交互该让什么出现」，
场景本身就在等它稳定。click / fill 的目标仍然不取。

- **每个锚点最多等 2 秒。** `steps` 里的 `visible` 到取样时可能已经被后续步骤换掉
  （`artifact-batched-stream` 一路点过好几个文件），`locator.evaluate` 的 auto-wait
  用默认超时就是每个 30 秒——**第一版把 diff 用例从 4 分钟拖到 10 分钟超时**，
  而报错是 context 被拆时的 `page.route: Target page ... has been closed`，
  **完全看不出真正的原因**。
- **两边都没取到就跳过。** 两个应用同时没有这个锚点，就没有可比的几何；
  一边有一边没有仍然报。

### 先证明了一条都不是 waves 72~75 的回归

把这几轮动过的四份文件（三份 dropdown primitive + SidecarPanel）**还原成 wave 72
之前的版本重跑一次**，34 行新增逐条对比——只有一处不同，而那一处是**改好了**
（mode 菜单项高度 Δ-12 → Δ4，wave 75 的 dropdown 合同修的）。
**这一步是 accept 的前提**，不是事后解释。

### 当轮修掉四行

- **sidecar 面板根画了底色**：上游 `sidecar-panel.tsx:527` 一条 `bg-*` 都没有，
  底色由外层容器给。实测 React `rgba(0,0,0,0)` / 本仓 `rgba(253,250,243,255)`。
  两层都涂底色时看不出差别，**外层一换就露馅**。
- **推理档位菜单不按选中态染色**：上游每项传
  `选中 ? "text-accent-foreground" : "text-muted-foreground/65"`
  ——**没选中的几档是暗的**；本仓一项都不染，四档看起来一模一样，
  只有单选圆点在区分。内层结构与多余的 `py-2` 一并对齐（高度 Δ-4 → 0）。

### 负向验证

把 sidecar 的底色画回去，`e2e-parity` **当场红**并报出那一行——
**那个锚点在 wave 76 之前根本不被取样**。两处颜色修改另有源码级守卫（秒级红）。

## 上一轮（wave 75）做了什么：**icon-parity 的清单归零，一半功劳属于尺子自己**

提交 `7d2b7a30`。那份清单从 wave 69 挂到现在，每一轮都被重新读一遍、
每一轮得出同样的结论。这一轮逐条核完——**21 → 0**。

### 一、尺子看错了地方（三处，占掉将近一半线索）

| 缺陷                                 | 后果                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 只扫 `components/`（两个默认根都是） | `core/` / `pages/` / `composables/` 下的图标一颗看不见，而**字形档比的是全仓集合**——扫不全等于拿两个残缺集合做差                                       |
| 只收 `.tsx` / `.vue`                 | 两边都把图标表放在 `.ts` 里（本仓 `core/artifacts/display.ts` 的 `Image as ImageIcon`），「只有 React 用 Image」就是这么来的                           |
| map 按 basename 存                   | **同名文件静默覆盖**：React 侧 167 份 `.tsx` 只剩 162 个 key，扫到整个 src 之后 409 份只剩 267。丢掉的既不进集合也不参与配对，**报告里看不出少了什么** |

改成按完整路径存、逐文件配对另建 basename 索引且**只在两边各自唯一时才配**。
顺带发现扫 `.ts` 会把上游 `ai-elements/message.tsx` 配到本仓 `core/types/message.ts`
（纯类型文件），所以配对只认 `.tsx` ↔ `.vue`。
**把扫描范围退回 `components/` 复跑，清单从 0 变回 8**——这三处修的是真问题。

### 二、核出来的六处真差异

| 处                      | 上游                                                          | 本仓（改前）                                             |
| ----------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `web_fetch` 步骤图标    | `GlobeIcon`(=`Globe`)                                         | `Globe2`(=`Earth`)——**两颗画的不是一回事**               |
| 引用面板标题图标        | `BookOpenTextIcon`                                            | `Library`；顺带那条 summary 悬停无反应                   |
| 置顶菜单项              | 按状态在 `PinOff` / `Pin` 之间切                              | 两种状态都画 `Pin`（文字换了图标没换）                   |
| 渠道状态                | `<Badge>` + `CheckCircle2` / `AlertCircle`，挨着渠道名        | 描述下面一行裸文字，**已连接与未连接只差几个字**         |
| 单选指示器              | `<CircleIcon className="size-2 fill-current" />` 8px 实心圆点 | `<Check :size="14" />`——**单选画成对勾会让人以为能多选** |
| 下拉菜单项的 class 合同 | 见下                                                          | 只抄了一半                                               |

**最后一条是前一条的根因。** 本仓三份 dropdown primitive 都缺
`[&_svg:not([class*='size-'])]:size-4`、
`[&_svg:not([class*='text-'])]:text-muted-foreground`、`[&_svg]:shrink-0`、
`focus:text-accent-foreground`、destructive 那一支的三条、`rounded-sm`、`text-sm`、
`data-[inset]:pl-8`。**图标没有默认尺寸**，所以每个调用点自己写 `:size="14"`
（比上游小 2px、颜色也没变灰）——侧栏那六颗就是这么来的，补进 primitive 之后
它们改回裸标签。

### 三、剩下 12 条写进尺子，报告只列没核过的

`VERIFIED` 表一条一个理由：五条上游死代码
（`ConversationScrollButton` / `sources.tsx` / `MessageBranch*` / 点赞点踩）、
两条 primitive 实现不同、三条改动面板双视图结构不同、
`Github`（上游画的是**本地手写 svg**，不是 lucide 同名件）、
`Maximize2`（streamdown 内部渲染，扫不到源码）。
**表是双向的**：某一条不再出现会被报成 stale。

### 取舍

- **`hover:bg-accent` 保留**（上游只有 `focus:`）：Reka 的菜单项悬停不触发 focus，
  而 Radix 给高亮项打的就是 focus——删掉本仓鼠标悬停就没有反馈了。
- **渠道状态挪到了渠道名旁边**（上游的位置），这会改 aria 文本顺序；
  `e2e-parity` 跑完仍是 0 行 / 39 场景，说明现有场景没取样到那一屏。

### 负向验证 9 条全红

其中一条第一次是**无效变异**：只改用处不改 import，`Globe2` 变成未定义标识符
——模板里渲染成空而不是编译失败，报表看起来是绿的。成对改之后 RED。

## 上一轮（wave 74）做了什么：**去补 wave 73 没量的那一半，翻出上游一处死代码**

提交 `16ca870e`，React 侧 chore `b0b7fcb6`，marker 推到 `b0b7fcb6`。

### 翻案：上游的 toast 走的根本不是那份 wrapper

wave 73 写下「上游那五颗是 lucide 图标」，依据是 `ui/sonner.tsx:19` 的 `icons` prop。
**这一轮的渲染读数说不是**：画出来的是 sonner **自带**的 20×20 资产
（`viewBox="0 0 20 20"` 的实心圆叹号），不是 `OctagonXIcon`。

根因：两处 `<Toaster />` 都写着 `import { Toaster } from "sonner"`
——**`src/components/ui/sonner.tsx` 零消费者**。wrapper 存在的三件事全部落空：

1. sonner 的 `theme` prop 默认 `'light'`，wrapper 是唯一喂它 `useTheme()` 的地方
   ——**深色主题下上游的 toast 一直是白的**；
2. `--normal-bg` / `--normal-text` / `--normal-border` / `--border-radius` 落回
   sonner 自己的调色板（实测 `rgb(255,255,255)` / `rgb(237,237,237)` / 8px），
   而不是应用的 popover token；
3. 五颗 lucide 图标从没生效。

**这是「一个写错的 import 长得和写对的一模一样」**：toast 照样出现、照样有图标、
照样念得对，没有任何东西指向 wrapper 是死的。两边同改（判据「这处不改，
React 自己是不是也是坏的？」→ 深色下不跟着翻，是）。
**线索 204 的又一次自证**：读 prop 只能告诉你调用方传了什么。

### 本仓这一侧：toast 尺寸逐条抄 sonner 的 CSS

出处 `sonner/dist/index.mjs` 的 `[data-sonner-toast][data-styled=true]` 与
`[dir=ltr]` 那组变量。**每一条都不一样**：

|            | sonner                               | 本仓（改前）                  |
| ---------- | ------------------------------------ | ----------------------------- |
| 宽         | `--width` = 356                      | 420（**宽 64px**）            |
| 内边距     | 16px                                 | `px-4 py-3`                   |
| 字号       | 13px                                 | 14px                          |
| 图标间距   | `gap:6px` + 图标 `-3px / 4px` 外边距 | `gap-3`(12px)、无外边距       |
| 对齐       | `align-items:center`                 | `items-start` + 图标 `mt-0.5` |
| 阴影       | `0 4px 12px rgba(0,0,0,.1)`          | Tailwind `shadow-lg`          |
| 视口偏移   | `VIEWPORT_OFFSET` 24px               | `top-3`(12px)                 |
| 条间距     | `GAP` 14px                           | `gap-2`(8px)                  |
| 错误态边框 | 不按类型改色                         | `border-destructive/40`       |

改完复量：**x / y / 宽 / 高 / 内边距 / 间距 / 字号 / 圆角 / 图标尺寸 / 按钮数
十项逐值相同**（356×73 @ (462,24)，图标 16×16 @ x=475）。
只剩两条**已知的非差异**：颜色 React 序列化成 `lab()`、本仓成 `oklch()`；
本仓的 `shadow-[...]` 前面多两层 Tailwind 的空 ring 层。

### 侧栏底部触发器：收起态换尺寸，不是只换内容

上游 SidebarMenuButton 的 cva：base 有 `group-data-[collapsible=icon]:size-8!`，
lg 档有 `group-data-[collapsible=icon]:p-0!`（两条都带 `!`，后定义的 `p-0` 赢）。
本仓的收起态走自己的 `collapsed` ref，那两条选择器**永远不成立**——
实测 React **32×32 / padding 0**，本仓 **31×48 / padding 8**，整块 footer 高出 16px。
这就是 wave 72 探针里那一行「整份场景只有这一颗对不上、没查」的差异。
**展开态两边本来就一样**（239×48）——wave 72 记的「React 43px」是没等 settle 读的。

### 探针这一轮踩的两个坑

1. **`page.route` 后注册的优先。** 第一版把 409 的路由覆盖写在 `runScenario`
   **之前**，于是场景自己的 mock 后注册、赢了它——两边都没弹出 toast，
   而探针**没有报错**（点击成功了，只是没有 toast）。
   **判据：探针拿不到东西时，先问「我这一步真的生效了吗」，而不是先改断言。**
2. 触发一条真 toast 比想象的难。走 artifact 面板复制键的那版（wave 73）
   **10 分钟超时都没跑完**；换成 `scheduled-tasks` 场景 + 把 PATCH 打成 409，
   一次就成——**上游与本仓的 e2e 里已经有的触发路径最稳**。

### 负向验证 5 条全红

toast 宽度 / 内边距 / 红边框 / 收起态尺寸 / React 的 Toaster 改回裸 sonner。

## 上一轮（wave 73）做了什么：**结清「本仓修掉了上游缺陷」那一整类，并把 toaster 补齐**

提交 `209c49db`，React 侧 chore `7630e6e3`。
**这一轮的产出一半是判据**：wave 72 留下五笔同形状的账，它们都不是「谁更像上游」，
而是「上游那处本来就是坏的」。判据定成——**按业界主流做法**，
而不是「与上游一致」。`ARCHITECTURE.md` 的双向规则管的是**产品面的有无**，
管不了「上游那一处是不是缺陷」。

### 一、WorkspaceToaster：这一轮最值钱的一处

| 处             | 上游                                                                                                                                             | 本仓（改前）                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| **类型图标**   | `ui/sonner.tsx:19` 给 `<Toaster>` 传 `icons={{success, info, warning, error, loading}}`，sonner 的 `[data-icon]` 是 16×16 常驻槽位，**每条都画** | **一颗都不画**              |
| **warning 档** | `toast.warning`，实测 3 处调用点                                                                                                                 | 折进 info                   |
| **停留时长**   | sonner 的 `TOAST_LIFETIME = 4000`（两处调用点都没传 `duration`）                                                                                 | 5000                        |
| **关闭键**     | `<Toaster position="top-center" />` **没传 `closeButton`**，sonner 默认关                                                                        | 每条一颗，还是拿 `×` 当图标 |

调用点分布实测：error **86** / success **33** / info **10** / warning **3**。
也就是说本仓每一次写操作播报，都比上游少一颗图标。

**warning 那条尤其值得记**：本仓折叠它的理由写在文件头里——
「warning 与 info 在可访问性上同一档，区别只有图标，而这个 toaster 一个图标都不画」。
**前半句对，后半句是本仓自己的缺陷**。一条用「另一处缺陷」当论据的取舍，
在那处缺陷修掉之后就该重新过一遍。

`loading` 那一颗**够不着**：本仓 store 没有这一档，上游那颗只在 `toast.promise` 里用，
DeerFlow 一处都没调（线索 199 又一例）。

### 二、四条可达性账，两边同改

| 处              | 上游原样                             | 判据                                                                                     |
| --------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Dialog 关闭键   | 没有任何尺寸类，命中区就是 16px 字形 | WCAG 2.5.8 的下限是 24×24 → 改成 `size-7`(28px) + `cursor-pointer`                       |
| Switch          | 没有 `cursor-pointer`                | Tailwind 4 preflight 不给小手，鼠标停上去像不可点（线索 206 的同一条）                   |
| TodoList 折叠头 | 挂 onClick 的 `<header>`             | 它是这块面板**唯一**的折叠入口，键盘完全够不着（WCAG 2.1.1），可访问性树里也读不出展开态 |
| 附件移除键      | 只有 `group-hover` 才显形            | 键盘 Tab 到它时整颗透明，焦点落在看不见的控件上（WCAG 2.4.7 / 2.4.11）                   |

本仓这四处**此前就是对的**（前三处是前几轮顺手做的，第四处是 wave 72 记的账），
这一轮把上游改成同一个形状，两边的树仍逐行一致、台账不增行。
**四条都补了 React 侧的守卫**
（`frontend/tests/unit/components/ui/interactive-affordances.dom.test.tsx`），
补之前逐条确认过是假绿。

### 三、取舍

- **Toaster 的关闭键选择删掉，而不是给上游加。** 判据「这处不改，React 自己是不是
  也是坏的？」在这里是**否**——sonner/shadcn 的默认就是不给关闭键，一条 4 秒自动
  消失的状态播报没有它不构成缺陷。既然不是缺陷，就走双向规则的另一半。
  代价：一条 toast 只能等它自己走。
- **附件移除键的可访问名仍带文件名**（上游写死 "Remove attachment"）：
  一次多个附件时上游那串名字每颗都一样，读屏器听不出在删哪一个。**单方面保留。**
- **`route-payload` 的 prefetch 文件数抬了**（/ 36→40，另两条 41→44）：
  **只有文件数越线，三条路由的字节数全部还在预算之内而且比预算低**
  （/ 765,306 vs 793,000；另两条 801,442 vs 831,000）。涨的是 chunk **个数**。
  字节预算一个没动——**这条门禁真正要挡的是字节，文件数只是「有没有意外把大块
  拆碎」的旁证**。

### 四、探针没跑成，说清楚了

原计划用 parity 探针触发一条真 toast 两边同读。**探针在 10 分钟超时里没跑完**
（走 artifact 面板的复制键触发，locator 卡住），`toast.json` 是空的。
所以**图标那条结论是源码级的**：上游的 `icons` prop + sonner 的 `[data-icon]` CSS +
本仓 store 文件头自己写的「这个 toaster 一个图标都不画」，三方互证。
**不是渲染读数**——按线索 204 的口径，这里降了一档，写在这里而不是假装量过。
Vue 侧改完之后有单测直接数 svg，那一半是真读到的。

**顺带没验的**：sonner 的宽度 356px / gap 14px / 视口偏移 24px，
对本仓的 `w-[min(92vw,420px)]` / `gap-2`(8px) / `top-3`(12px)。
**一条都没量、一条都没改**，记成一笔新账。

### 五、负向验证 9 条，1 处假绿

| #             | 变异                                                            | 结果                                                            |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| W1            | 把 warning 的图标换成 info 的                                   | RED                                                             |
| W2            | 把关闭键加回来                                                  | RED（handwritten / glyph / DOM 三份守卫都红）                   |
| W3            | 时长改回 5000                                                   | **假绿**（一条守卫都没有）→ 补「传给 timer 的毫秒数是 4000」    |
| W3b / W4 / W5 | 补完守卫再改时长 / warning 折回 info / replay-gap 播报改回 info | RED                                                             |
| R1~R4         | React 侧四条逐条改回原样                                        | 四条全 RED（守卫是同一轮补的，补之前确认过 R1/R2/R3/R4 都假绿） |

## 上一轮（wave 72）做了什么：**把「上游走的是哪条路径」逐颗问完，76 → 49**

提交 `3034bd05`。正题是 wave 71 留下的那批手写 `<button>`。
**做法不是「补样式」，是逐颗回上游问「这一颗上游走的是什么」**，三种答案三种处理。

### 先量准：73 颗产品手写 button，其中一半上游自己也手写

同口径复量（剥掉 HTML 注释与 JS 块注释再数开标签）：**77 处，去掉 `Button.vue`
本体与三处 `__m0` 夹具页，产品面 73 处**（交接文档写的 76 是没剥注释的数）。
分成三档：

| 档                                                                       | 处数 | 处理                     |
| ------------------------------------------------------------------------ | ---- | ------------------------ |
| **上游 streamdown 自己就手写**（markdown/ 整片）                         | 19   | **一条不动**，逐字核对过 |
| **上游同一处也手写**（sidebar / recent-chat-list / settings-dialog / …） | ~16  | **照抄不动**             |
| **上游走 primitive，本仓手搓**                                           | ~24  | **改走 primitive**       |

markdown/ 那 19 颗是这一轮**最值钱的否定结论**：把 streamdown 2.5.0 的
`dist/chunk-BO2N2NFS.js` 解出来逐条比，复制 / 下载 / 全屏那一档的 className 是
`cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground
disabled:cursor-not-allowed disabled:opacity-50`——**与本仓逐字相同**，
ZoomPan 的三颗、link-safety 弹窗的三颗、图片下载、安全外链也都对得上。
线索 199 的又一例：先问「上游那处是什么」，再问「本仓少了吗」。

### 改走 primitive 的（24 颗按钮 + 3 处结构）

| 处                                        | 上游走的是什么                                                           | 差在哪（都是用户看得见的）                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ArtifactPanel 代码/预览**               | `ToggleGroup type="single" variant="outline" size="sm"`                  | **当前档位在视觉上根本看不出来**：`aria-checked` 对，但两颗 class 是常量，没有 `data-[state=on]:bg-accent`。顺带丢了 roving tabindex（左右键换档、整组只占一个 Tab 位）                                                                                                        |
| **ArtifactPanel 文件下拉**                | shadcn `<Select>`                                                        | **触发器上没有下拉箭头**、选中项**没有对勾**、列表不 portal（被头部 overflow 裁）、整套键盘行为（上下键 / 首字母 / Escape / 打开时焦点落到当前项）一条没有；高度 32 vs 36                                                                                                      |
| **ArtifactPanel 关闭键**                  | `ArtifactAction`（= ghost Button + Tooltip）                             | wave 70 修那八颗时漏的孤儿：静息色是前景色而上游是 muted、没有 Tooltip                                                                                                                                                                                                         |
| **artifact 工具条顺序**                   | 安装 → 打开 → 复制 → 下载                                                | 本仓是复制 → 打开 → 下载 → 安装。**台账看不见顺序**（aria 去缩进后按多重集比，八类差异之④）                                                                                                                                                                                    |
| **SidecarPanel 提交键**                   | `PromptInputSubmit variant="outline"` + Tooltip，status 会传 `submitted` | 画的是**实心 primary**（上游是描边圆钮）、**发送中不转圈**、没有 Tooltip                                                                                                                                                                                                       |
| **SidecarPanel 纸夹 / 档位键**            | `PromptInputButton` / `PromptInputActionMenuTrigger`                     | 纸夹没有 Tooltip；两颗都少 cursor / 焦点环 / 禁用态                                                                                                                                                                                                                            |
| **AgentBootstrapComposer 提交键**         | 裸 `PromptInputSubmit`（**不传 className**）                             | 本仓画成 `rounded-full` 的**圆**钮，上游是 `rounded-md` 的**方**钮——那两颗圆的之所以圆，是各自显式传了 `className="rounded-full"`，这一颗没传                                                                                                                                  |
| **ComposerModelSelector 触发器**          | `PromptInputButton`                                                      | `text-xs` 写在按钮上（上游写在里层 name 上）、只有一层 span 所以 `truncate` 作用在错的盒子上；`px-2.5` 与 `shadow-none` 要显式写——**InputGroupButton 的 sm 是 `px-2.5`，shadcn Button 的 sm 是 `px-3`**，两套 sm 差 2px                                                        |
| **ProcessingMessageGroup 两颗折叠键**     | `Button variant="ghost"`                                                 | 少 `hover:text-accent-foreground`、少 `dark:hover:bg-accent/50`（深色悬停底色差一档）、少 `text-sm font-medium`                                                                                                                                                                |
| **MessageList 加载更早**                  | `Button variant="ghost" size="sm" rounded-full` + `ChevronUp`            | 本仓是**下划线文字、没有图标**；加载态**换成一段 span**（点完那一刻焦点所在元素被卸载，键盘用户被丢回 body）；哨兵挂在按钮上（加载中按钮卸载，IntersectionObserver 跟着掉）；文案自造了 loadEarlier / loadingEarlier，渲染出来是「Load earlier messages」而上游是「Load more」 |
| **TokenUsageIndicator 徽标**              | `Button variant="ghost"`                                                 | 少 `hover:text-accent-foreground`（上游悬停时文字也变色）、cursor、焦点环                                                                                                                                                                                                      |
| **ThreadSidebar 加载更早会话**            | `Button variant="ghost" size="sm"`                                       | 悬停色写成了 **sidebar-accent**，上游这一颗走的是普通 **accent**——深色主题下不是同一个值                                                                                                                                                                                       |
| **ComposerAttachmentChip 移除键**         | `Button variant="ghost"`                                                 | 少 ghost 变体的另两条与焦点环                                                                                                                                                                                                                                                  |
| **ReferenceAttachment 清除键 + 引用预览** | `Button variant="ghost" size="icon-sm"` + `Tooltip`                      | 预览走的是**整块的原生 `title`**：延迟/位置/配色不受控、触屏不出现，而且**连清除键也会弹**（上游那颗不弹）                                                                                                                                                                     |
| **settings：通知 ×2 / 技能 ×1**           | `Button` + `BellIcon` / `Button size="sm"` + `SparklesIcon`              | **一颗图标都没有**；尺寸也差一档                                                                                                                                                                                                                                               |
| **setup ×3 / login ×1 / chats 列表 ×1**   | `Button`（default / outline / submit）                                   | 只抄了填色或描边：悬停完全没反应、少 cursor、少 3px 焦点环、少 `dark:*` 三条（深色下 outline 是透明的，上游是浅一档填色）                                                                                                                                                      |

### 顺带修的三处「上游写了本仓没抄」

- **CitationSourcesPanel 复制键**（上游也手写，本仓抄漏）：没有任何悬停反馈、
  少 `shrink-0`，而且**复制成功那颗对勾上游是 `text-green-500`**、本仓恒为 muted
  ——可访问名换了、视觉没换，用户看不出复制成没成。
- **TodoList 折叠头**：`min-h-9` vs 上游 `min-h-8`（高 4px）、没有 `cursor-pointer`、
  没有 300ms 过渡，箭头也少了 `text-muted-foreground`（本仓继承前景色，比上游深一档）。
- **禁用的「Agents」入口**：上游 `text-muted-foreground/50` + `cursor-not-allowed` +
  `aria-disabled:pointer-events-none aria-disabled:opacity-50`，本仓一条都没有
  ——**这个点不动的入口还会跟着鼠标高亮**。
- **侧栏 rail 的光标**：上游展开时 `cursor-w-resize`、**收起时翻成 `cursor-e-resize`**；
  本仓写死 w-resize——侧栏已经最窄了，鼠标还在说「往左拖」。探针实测同一屏
  React `e-resize` / 本仓 `w-resize`。

### 探针实测：改完之后四个场景逐行相同

重建 wave 71 的 parity 探针（两个应用同屏、按 role + 可访问名配对、逐颗读计算样式）。
**第一遍读出一堆假差异**——`captureScenario` 在 runScenario 之后还等 `settleMs=700`，
探针没等，React 的异步面板还没挂上，于是 artifact-preview 报「Vue 多 4 颗控件」、
settings 报「每颗导航键 svg 15×15 vs 16×16、高 34 vs 36」。**补上等待之后全部消失。**
**判据：探针的取样点必须与它要佐证的那个门禁同一个点**（线索 191 的同一条）。

补齐之后：

| 场景                    | 行数     | 剩余差异                                                                              |
| ----------------------- | -------- | ------------------------------------------------------------------------------------- |
| `artifact-preview`      | 17 vs 17 | **0**（两颗 radio 的选中底色两边同值，只是 React 序列化成 `lab()`、Vue 成 `oklch()`） |
| `artifact-stream-state` | 22 vs 22 | 只剩工具条顺序（本轮已修）与 `Settings and more`                                      |
| `sidecar-chat`          | 23 vs 23 | **0**                                                                                 |
| `thread-history`        | 18 vs 18 | **0**                                                                                 |
| `settings-notification` | 28 vs 28 | 只剩两条 primitive 的旧账（见下）                                                     |

### 探针顺带量出来的三笔新账（**都不是这一轮的正题，一条没动**）

1. **Dialog 的关闭键两边差一倍**：React 16×16 / `rounded-xs`(2px) / `cursor: default`，
   本仓 28×28 / `rounded-md`(8px) / `cursor: pointer`。上游那个 16px 的点击区
   够不到 WCAG 2.5.8 的 24px，**本仓这一处更好**——要翻案得先决定「双向判据在
   上游自己的可达性缺陷上认不认」，与 `WorkspaceToaster` 那条同一类。
2. **Switch 的光标**：React `default`、本仓 `pointer`。同上。
3. **`Settings and more` 那颗侧栏底部键**：React 32×32（收起态）/ 43px（展开态），
   本仓 48px。整份 `sidebar` 场景里只有这一颗对不上，**没查**。

### 落地的两把新尺子

1. **`tests/guards/handwritten-button.test.ts`**：钉住「哪些文件还在手写 `<button>`」
   这份集合，**双向 + 逐份计数 + 字典序**（线索 186 的修法）。每一条都写清
   **上游那处是什么**——判据不是「手写是缺陷」，是「上游走的是哪条路径」。
   加一颗新的手写 button 之前先回上游看；上游走 primitive 的，本仓也要走，
   **而不是把文件加进 ALLOWED**。
2. **`tests/guards/upstream-class-echo.test.ts`**：收「照抄上游 class 串」里
   **没有任何别的守卫盯着**的那几条（TodoList 的行高与光标、rail 的光标方向、
   禁用 Agents 入口的三条、设置面板里上游有图标的三颗键）。
   负向验证当场撞出四处假绿，这份就是补出来的。

**`disabled-affordance.test.ts` 的形状断言改了钉法**：原来是
`expect(scanned.length).toBeGreaterThan(60)`——一个贴着实测值的下限，
**池子每一轮都在缩，调它的人分不清「因为修好了」和「因为扫挂了」**。
改成一条很松的下限 + 一个**按契约永远手写**的正样本（MermaidZoomPan 的三颗缩放键）。

### 负向验证 21 条，**撞出 5 处假绿，4 处当场补上守卫**

| #                 | 变异                                       | 结果                                                                                                                                                     |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1                | ToggleGroupItem → 手写 radio               | RED（新守卫 + DOM 各一条）                                                                                                                               |
| N2                | sidecar 提交键去掉转圈分支                 | RED                                                                                                                                                      |
| N3                | sidecar 回形针 size-3 → size-3.5           | RED                                                                                                                                                      |
| N4                | model selector 去掉 `px-2.5`               | RED                                                                                                                                                      |
| N5                | ArtifactFileList 加一颗手写 button         | RED                                                                                                                                                      |
| N6                | ProcessingMessageGroup `Button` → `button` | RED                                                                                                                                                      |
| N7 / N9           | 新守卫 ALLOWED 里删/改一条                 | RED（过期条目 + 清单之外各一条）                                                                                                                         |
| N8                | 换回已删的 loadEarlier 词条                | **假绿**：i18n 的 7 份测试全过，实际由 `typecheck` 拦下（TS2339）                                                                                        |
| N10               | CitationSourcesPanel 去掉悬停              | **假绿**（无守卫）→ 补断言                                                                                                                               |
| N10b              | 补完守卫再变异一次                         | **还是假绿**：断言在整份源码里找 class 名，而**我刚写的注释逐字引用了它们**（坑 202 第四次，又是自己踩）→ 收紧成「剥注释 + 只看那颗按钮自己的 class 串」 |
| N10c / N10d       | 对勾去掉绿色 / 收紧后再去掉悬停            | RED                                                                                                                                                      |
| N13               | ReferenceAttachment 退回整块 `title`       | RED                                                                                                                                                      |
| N14 / N15         | TodoList 退回 `min-h-9` / rail 光标写死    | **假绿**（无守卫）→ 新建 `upstream-class-echo`                                                                                                           |
| N14b / N15b / N16 | 补完守卫再变异                             | RED                                                                                                                                                      |
| N17               | artifact 工具条顺序换回去                  | RED（`artifact-actions` 单测就在盯）                                                                                                                     |
| N18               | 去掉一颗 BellIcon                          | **假绿**：`icon-parity` 也盯不住——它比的是**全仓**图标集合，Bell 在别处还用着，删掉之后集合一点没变 → 补守卫                                             |
| N18b / N20        | 补完守卫再去掉 Bell / Sparkles             | RED                                                                                                                                                      |
| N21               | 新守卫自己定位失败时                       | RED                                                                                                                                                      |

### 三处自己造出来的坑

1. **`git checkout -- <file>` 把整轮改动一起还原了。** 负向验证的还原步骤
   第一版写的是 `git checkout`——它还原到 **HEAD**，而 HEAD 是这一轮开始之前。
   ArtifactPanel 的全部改动（ToggleGroup + 关闭键 + 两个 import）一次没了，
   而**当时的报表看起来是绿的**。修法：变异前 `cp` 一份备份，还原时 `cp` 回来
   并 `diff` 确认。**新线索 207。**
2. **`cd X && <整条链>`：`cd` 失败时后面一条都不跑，而最后一条命令的退出码是绿的。**
   往 `artifact-panel.dom.test.ts` 里加的那条 DOM 测试**根本没写进去**，
   而同一次输出里 vitest 报「17 passed」——那是**改动之前**的条数。
   两次都以为加上了。**判据：写文件的命令必须自己打印一句确认，并且要去看那句
   确认有没有出现，而不是只看整条链的退出码。新线索 208。**
3. **改完 SFC 的第一轮负向验证读错了报表**：`Test Files 1 failed | 1 passed`
   我读成了「守卫过、DOM 红」，实际相反。`--reporter=verbose` 一跑就分清了。

## 上一轮（wave 71）做了什么：**焦点环那条前提是错的，但那个池子是对的**

提交 `32d71958`。**正题是「100 处没有焦点环的手写按钮」，量下来第一句就翻案了。**

### 翻案：Vue 的手写按钮**有**焦点环，只是画得不一样

`app/assets/css/main.css:135` 有一条基础层兜底：

```css
:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

**上游没有这一条。** 于是同一颗控件上，两边画的是两种环：

| 走的路径                      | React                                  | Vue                                     |
| ----------------------------- | -------------------------------------- | --------------------------------------- |
| `<Button>` primitive          | `ring-[3px]` + `ring-ring/50` 软阴影环 | **一模一样**（实测逐值相同）            |
| 手写 `<button>`（本仓 98 处） | 走 UA 默认 `outline: auto 1px`         | 基础层兜底 `outline: 2px solid` off 2px |

实测（parity 探针，六个场景两个应用同屏，按 role+名字+尺寸配对，
先按一次 Tab 建立键盘模态再逐个 `.focus()`）：**115 颗按钮里 55 颗焦点样式不同、
60 颗完全相同**，而相同的那 60 颗**全部是两边都走 `<Button>` 的**。

所以 wave 70 记的「**没有 `focus-visible` 焦点环 100**」这句，
**作为源码事实是对的**（本轮同口径复量 94/98），
**作为渲染结论是错的**——「键盘用户看不见焦点在哪」不成立。
判据：**任何关于「渲染成什么」的结论，都不能只从 class 串推**（新线索 204）。

### 但那个池子里有更值钱的东西：**三处拿字符当图标**

同一批手写按钮里翻出来的，全部是 `ariaSnapshot()` / 对照台账 / `dom-parity`
几何档 / `icon-parity` **四样都看不见**的：

| 处                        | 本仓画的            | 上游画的                                             |
| ------------------------- | ------------------- | ---------------------------------------------------- |
| AgentChat sidecar 触发器  | **文字 `◫`** U+25EB | `MessageSquareTextIcon` in `<Button size="icon">`    |
| AgentChat agent 建成那屏  | **文字 `✓`** U+2713 | `CheckCircleIcon`(=CircleCheckBig) 40px text-primary |
| AgentChat followup 关闭键 | **文字 `×`** U+00D7 | `XIcon` 16px in `<Button variant="outline">`         |

`icon-parity` 看不见它们，是因为它只解析 `import ... from "lucide-vue-next"`
收上来的名字，而**这三处压根没 import 任何图标**。
wave 69 与 wave 70 两轮都从它眼皮底下漏过去了。

**但「用了字符」本身不是缺陷**：上游 `message-list.tsx:1372` 的划词关闭键就是
`<span aria-hidden="true">×</span>`，本仓照抄是对的。所以这一档**必须两边一起比**。

### 一起修掉的（22 颗按钮改走 primitive）

| 处                                        | 差在哪                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| sidecar 触发器（新 `SidecarTrigger.vue`） | 文字 `◫`、32px vs 36px、无 Tooltip、开合不换 variant、**重查期间不置灰会发两次 restore**                           |
| agent 新建会话键                          | 12px vs 14px、`gap-2` vs `gap-1.5`、无 `font-medium`、**窄屏收起文字后是纯图标却无 Tooltip**                       |
| followup 关闭键 + 建议 chip               | 文字 `×`；chip `px-3 py-1.5` vs 上游 `px-4 py-2`                                                                   |
| agent 建成那屏的 ✓                        | 文字 30px 继承色 vs 图标 40px `text-primary`                                                                       |
| **改完重跑的两颗**                        | 无图标、无禁用；**上游禁用「草稿为空」与「一个字没改」两种提交，本仓两条都没有**——两种都会丢掉这一轮之后的全部消息 |
| composer 附件/语音/优化/模式/思考档/提交  | 六颗；**提交键上游是描边圆钮（`variant="outline"` + `shadow-none`），本仓画的是实心 primary**                      |
| composer 页脚颜色                         | 颜色归容器（上游 `InputGroupAddon` 的 `text-muted-foreground`），此前靠每颗按钮各写一遍                            |
| memory 设置六颗                           | **导入/导出/新增三颗一条 hover 都没有**；清空键写死 `bg-red-600`（深色主题不翻转）且**没有 disabled 绑定**         |
| channels 四颗                             | **一颗图标都没有**（上游 `PlugIcon`/`UnplugIcon`/转圈）、无 hover、连接键用描边而上游是实心主操作、`text-red-600`  |

手写 `<button>` **98 → 76**；缺 hover **45 → 34**，缺 cursor **80 → 62**，
缺焦点类 **94 → 72**。

### 顺带量出来的两件事

- **`cursor` 是这一类里最容易看见的一条。** Tailwind 4 的 preflight 不给按钮
  `cursor: pointer`，上游所有 Button 变体都显式写了 `cursor-pointer`，
  手写那些没有——**实测同一颗控件 React 是小手、本仓是箭头**。
- **上游 `PromptInputSubmit` 的 `submitted`（转圈）分支够不着**：调用点只传
  error / streaming / ready 三种（chat-page.tsx:414）。本仓三个分支就是全集，
  不是少了一支（线索 199 又一例）。

### 落地的两把尺子

1. **`make icon-parity` 加「拿字符当图标」档**：两边一起比、按全仓比、
   排除 emoji（scheduled-tasks 的示例配方带着一串），只报本仓独有的字形。
   配 exit 2 形状断言（拿上游 `message-list` 的 `×` 当探针——
   React 那边解析成 0 会让本仓每个符号都变线索，而那和「上游真的不用」长得一样）。
   **实测会红**：把三处改回字符，它当场报出 `◫` 与 `✓`，而 `×` 正确地不报。
2. **`tests/guards/glyph-as-icon.test.ts`**：钉住「用了符号字符的文件集合」，
   **双向**（线索 186 的修法），每一条都写清上游那处画的是什么。

### 这两把尺子当轮各自踩坑

- **守卫把自己的说明文字报成违规**（线索 202 第三例，而且踩它的是专门为
  这一类写的守卫本人）：第一版只剥 `<!-- -->`，而 `SidecarTrigger.vue` 的
  块注释里正解释着「原来这里写的是 `◫`」。
- **注释里写 `/* */` 会提前闭合块注释**，整个测试文件解析失败。
- **形状断言写成了对着 `.source` 找 `u00D7`**，而正则里写的是字面字符——
  那条断言必然失败。改成拿三个已知真样本 + 两个已知假样本双向探。

### 一条我自己造出来又被探针抓回来的回归

把三颗 composer 按钮改走 `<Button>` 时，我**从源码推断**「颜色由页脚容器提供」
就删掉了每颗上的 `text-muted-foreground`。**推断是错的**：上游那层
（`InputGroupAddon` 的 cva）有 `text-muted-foreground`，而本仓那层是 scoped CSS，
**只写了布局没写颜色**。探针实测四颗算出来是 `foreground`（近黑）而上游是
`muted-foreground`（中灰）。修法是把颜色补在容器上（与上游同一个 owner），
不是每颗按钮各写一遍。**这正是新线索 204 的自证。**

### 负向验证 13/13 全红，无假绿

sidecar 触发器五条（画回 `◫` / 退回 size-8 / 丢 pending 锁 / 不换变体 / 脱 Tooltip）、
提交键画回实心、memory 清空键画回 `bg-red-600` / 丢 disabled 绑定、
改完重跑丢「一个字没改」那条、followup 关闭键画回 `×`、建成那屏画回 `✓`、
icon-parity 形状断言被拿掉。

**「脱 Tooltip」那条第一次是无效变异**（线索 198 原样重演）：单边替换开标签让
SFC 编译不过，报表打的是 `条数=?`。成对替换后 **RED，13 条一条没少**。

## wave 70 做了什么：**回答「全排查完了吗」——没有，并把数字量准**

提交 `43d5f289`。用户问「所有页面和组件全部排查完毕了吗」，
并明确了判据：**「只要功能和交互一致样式一致就行，拆的更细没问题」**。

### 修掉的

- **artifact 工具条八颗键**：三颗画错字形（`Edit3`(=PenLine) vs 上游 `Pencil`、
  `X` vs 上游 `PencilOff`、`ExternalLink` vs 上游 `SquareArrowOutUpRight`）、
  八颗 15px vs 上游 16px、**只有一颗 hover 有反应**而上游八颗都包 `<Tooltip>`、
  手写按钮少了 `disabled:opacity-50`（保存与复制禁用时和能点一样）与焦点环。
  整排改走 `<Button>`。
- **agent 卡片页脚三颗**：聊天键没图标、设置键画的是**文字 `⚙`**、
  删除键是文字 `×` 且用固定色 `text-red-600`（深色主题不跟着变）。
- **消息附件卡**画 `FileText` 而上游 `File`。
- **15 处「禁用了但看不出来」**，并加 `tests/guards/disabled-affordance.test.ts`。

### 量出来的剩余面（**下一轮正题**）

| 项                              | 数字                                                  |
| ------------------------------- | ----------------------------------------------------- |
| 手写 `<button>`                 | **Vue 102 / React 12**，9 倍                          |
| 其中自己画外观                  | **80**                                                |
| **没有 `focus-visible` 焦点环** | **100**                                               |
| `icon-parity` 未核实字形线索    | 30 → 剩 **20**（全在 `ai-elements/`、`ui/` 或豁免面） |
| `dom-parity` 几何档             | 仍**只有 `/login`** 真验过                            |

> **wave 71 订正（不要照这一段做事）**：上面这张表是 wave 70 当时量的，
> 数字保留原样；但「没有 `focus-visible` 焦点环 100」**只是源码事实，不是渲染结论**。
> `main.css:135` 有一条上游没有的基础层兜底环，实测两边都有环、只是画得不一样
> （55/115 不同，相同的那 60 颗全部是两边都走 `<Button>` 的）。
> wave 71 同口径复量是 **Vue 98 / React 15**、无焦点类 94。详见 wave 71 那一节。

~~**焦点环那 100 处不能机械补**：有的按钮贴着容器边，加 3px 环会顶到别的元素，
要逐处看。~~ 分布（wave 70 记的）：AgentChat 9、ChatComposer 7、ThreadSidebar 6、
MemorySettings 6、MermaidDownloadMenu 4、ChannelConnections 4，其余 1~3。

### icon-parity 自己的第 6~8 次

1. **我写的注释把 `CheckCircle` 从扫描里静默剔掉了**——按逗号切 import 块时
   注释粘在名字前，整段当无效名丢弃，于是报告说「`CircleCheckBig` 只有 React 用」，
   而那一处当轮刚改对。**方向是漏报，比误报更难发现。**
2. tooltip / aria 那档**跟一层委托**（用户已确认「拆得更细没问题」）。
3. **尺寸加了一档全仓的**——按文件只覆盖 57/199，本仓 71% 的组件从没被那档看过。

### 第六条负载抖动

`tests/e2e-auth/auth-contract.spec.ts:192`（`?next=` 深链回跳）。
因果够不着（本轮对 login.vue 的唯一改动是给一颗按钮加两个 `disabled:` class），
`--repeat-each=3` **42/42**。

## wave 69 做了什么：**把 wave 68 的手法做成机械扫描，又扫出六处**

提交 `585e0bc7`（chore `eec54d3c`）。wave 68 那十六处是**读 React 源码**读出来的，
而「图标字形 / 图标尺寸 / 有没有 Tooltip」这三样都不进可访问性树，几何档也只在
两边同时跑起来、且元素当时可见时才够得着。做成 `make icon-parity`
（`scripts/icon-parity.mjs`，**只读源码，不用把应用跑起来**，所以够得着登录后的屏），
扫出 30 条线索，逐条回源码核实后确认六处。

| 处  | 内容                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- |
| 1~2 | `SubtaskCard` 画 `CheckCircle2`(=CircleCheck)，上游 `CheckCircleIcon`(=**CircleCheckBig**)——两颗不同字形  |
| 3   | `CitationSourcesPanel` 外链图标 13px，上游 `size-3.5` = 14px                                              |
| 4   | `SidecarPanel` 回形针 14px，上游 `size-3` = 12px                                                          |
| 5   | `GoalStatus` 续跑计数用原生 `title`，上游包在 `<Tooltip>` 里                                              |
| 6   | `ArtifactTrigger` 没有 Tooltip；窄屏下文字被 `hidden sm:inline` 收起来，那时它是纯图标键                  |
| 7~8 | `AgentCard` 的名字与描述被截断后**没有任何办法看到全文**（新增 `TruncatedTooltip.vue`，只在真截断时才出） |

### 两条量过的否定结论

- **消息点赞/点踩不是「Vue 缺功能」。** 本仓 `core/api/feedback.ts` 零消费者，
  看着像少了一整个功能；但**全 React 仓库没有一处**传 `feedback={...}`，
  而 `FeedbackButtons` 的渲染条件是 `feedback !== undefined`，
  `MessageListItem` 又只被 `message-list.tsx` 引用——**上游那套 UI 也从来不渲染**，
  也没有任何测试。两边都带着死的反馈代码，位置不同而已。
- **workspace 改动面板的逐文件 `+N/-N` 不是缺失**，本仓放在内联徽章列表里、
  上游放在展开面板里；状态本仓用文字、上游用带色图标。**两边双视图结构不同，
  记成待核线索，没有半修。**

### 这把新尺子自己被修了五次（与 wave 68 的 `dom-parity` 同源）

1. `size-3.5` 被 `size-(\d+)` 读成 `size-3` → 14px 报成 12px，
   **三条里两条是这么来的假线索**。
2. 只比「两边同名的图标」，名字不同就完全看不见——而 wave 68 一轮已被这一类咬两次。
   改成按两个包各自的 `.d.ts` 解析成 lucide 规范名。
3. 字形档拿「写了尺寸的」当「用没用过」，把 composer 在用的 `Zap` 报成「只有 React 用」。
   改成从 import 语句收集。
4. 按文件问「有没有这颗」全是噪声（两边组件切分方式不同）。
   **尺寸按文件比，字形按全仓比。**
5. `DialogPrimitive` 这类也带 `size-*` 但不是图标。只认在别名表里的名字。

配两条 exit 2 形状断言 + `tests/guards/icon-parity-tool.test.ts` 钉「那些断言还在」。
工具按 `upstream-drift.mjs` 的先例进 `CROSS_APP_BY_DESIGN`，
**并真的做到「上游缺席时打印一行退出 0」**（否则声明就是假的）。

### 负向验证

五条变异全部转红。**头两次 N5/N6 是无效变异**：单边替换开标签把 SFC 改坏了，
整个测试文件加载失败（14 条变 8 条 / 6 条）——**「跑出来少了几条」和「红了几条」
要分清**，重做成成对替换才算数。

### 一条负载抖动

`thread-list-infinite-scroll.spec.ts:74`（已登记的第四条）。因果够不着：
侧栏子树的传递闭包是 **88 文件 / 31 SFC**，七个改动件一个都不在。
（第一版遍历只跟 `@/….vue`、漏了桶导出，只数出 7 个 SFC——
**从少算的集合里得出「无命中」不算数**。）`--repeat-each=5` **15/15**。

## wave 68 做了什么：**用户报了一处间距，量下来一屏十六处**

提交 `e775ba9e`。**入口是用户自己看出来的**：「标题和描述怎么跟输入框没有间距」。

### 最值钱的一条不是样式：撤销优化会吞掉用户后来打的字

上游 `input-box.tsx:1339` 的撤销判据是三条与——没在润色中、有过一次成功改写、
**而且输入框现在的文本仍逐字等于那一版改写**。本仓只有前两条。用户润色完接着
往下打字时，那颗键仍写着「撤销优化」，按下去把新打的一起换回润色前那一版，
且没有二次撤销。补第三条（新增 `polishRewritten`）。

### 十六处的分布

| 处    | 内容                                                                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 撤销判据缺第三条 → 数据丢失                                                                                                                                     |
| 2~4   | 润色中的胶囊：没 `role="status"`/`aria-live`、8px 脉冲点而非 12px 转圈、取消键被放到页脚顶替优化键                                                              |
| 5     | 撤销态不换 `Undo2Icon`                                                                                                                                          |
| 6     | 欢迎区渲染成 composer 的**兄弟节点** → 零高度锚点挂到外层容器（top 304 而非 288），宽 2px 之差让段落少折一行                                                    |
| 7~9   | 三颗图标键 `size-8`（32×32）而上游 `h-8 px-2` + 12px 图标（28×32）                                                                                              |
| 10~11 | 优化键多渲染「优化输入」（28px→82px）、且没有 Tooltip                                                                                                           |
| 12    | 语音键用原生 `:title` 而不是 Tooltip 组件                                                                                                                       |
| 13    | 优化键图标 `WandSparkles` 而上游 `SparklesIcon`                                                                                                                 |
| 14~16 | 登录页**整页绕开 Input/Button primitive** 手写 class：输入框 42/16px vs 36/14px、复选框 13px vs 16px、提交键 40px vs 36px、链接撑满整行 vs 行内、少一层字段分组 |

**这十六处 `ariaSnapshot()` 一处都看不见**，对照台账也全绿——两边 role、可访问名、
层级、顺序**全都一样**，只是画在不同位置和尺寸上；`sampleGeometry` 又只量场景
settle 锚点（线索 137）。所以给 `dom-parity` 加了几何档（按 `data-testid`、
否则 role+可访问名连接，比位置/尺寸/字号/内边距/圆角/边框）。

### 加完当轮，这把新尺子自己踩了线索 176 三次

1. **`diffBoxes` 不报连上了几个。** 补上计数后当场炸出问题——三个完全不同的页面
   都恰好「连上 7 个」。
2. **`waitUntil: "networkidle"` 在开发服务器上永不成立**（HMR 长连接）。landing 每次
   走到 30s 超时，catch 里**静默返回空 boxes**，印出来是「几何差异 0 处」，
   和「逐条量过、确实一样」长得一模一样。改 `domcontentloaded` + 有上限静置后
   landing 才真的加载（连上 12 个 / 27 处差异，豁免区只记录）。
3. **不校验落地 URL。** `/setup` 与 `/showcase/<id>` 在本机这套 Docker 栈上两边都要
   登录、各自跳 `/login`，于是拍到的是**同一张登录页**，aria 与几何自然逐字相同。
   `showcase` 是当轮刚加的场景，**差点把「第三次量登录页」当成「工作区对齐了」
   写进结论**。现在跳转会明说「下面的 0 不构成这一屏的对齐证据」。

### 视觉基线重录九张（取舍）

零容差下逐张量两遍：六张逐像素稳定（dark-mode 11895 / empty-chat 9167 /
streaming 5574 / zh-CN settings 990 / settings 599 / reasoning 234），
只有 artifact panel 带 ~80px 抖动（249/332）。**全在 `maxDiffPixelRatio: 0.01`
的地板之下才没红**——留着不录等于把容差预算花在一次已经发生的改动上。
注意 `-u all` 会无条件重写（含逐像素相同的那张），字节差里混着编码噪声，
**不能拿它当「变了」的证据**；正确做法是把容差临时压到 0 再 `--update-snapshots`。

### 三条旧断言改了钉法（不是为了变绿）

两条钉「按钮的可见文字」，而上游这颗键三态都只有一颗图标——**拿可见文字当断言
等于把落差写进合同**，改成钉可访问名 + 图标类名。一条钉含换行缩进的源码子串，
套上 Tooltip 后 prettier 折了行、表达式一个字没变就红了，改成压掉空白再比。

### 量过的否定结论

`next` 参数编码**不是缺陷**。实测 React 跳 `next=%2Fshowcase%2F…`、Vue 跳
`next=/showcase/…`，但两边源码都调 `encodeURIComponent`，差别来自 vue-router
导航后重新序列化 query 时不给 `/` 重新编码；登录页读的是 `route.query.next`
（已解码），两种形态回跳一致。

### 负向验证

六条变异逐条落盘后只跑 composer 单测，全部转红，**无假绿**：撤销判据退回旧式 1、
撤销态画回 Sparkles 1、胶囊去 role/aria-live 1、取消键换 testid 2、
页脚优化键润色时消失 1、语音键丢 disabled 1。

## 下一轮：**半条**

> **wave 81 把「下一轮」里那两条「先复量再决定」的账都量完了**（见「挂着的账」里
> 更新过的两节）：`/showcase` 的四条请求第三次逐条复量，**一字不差**，aria 仍是 0/0，
> wave 28 的决定不变；建 agent 页 chat step 的外壳复量之后**比 wave 28 记的少一项**
> （More 菜单 wave 79 已经对上），结论同样不变。
> **这两条从此不必再复量**，除非上游那两屏自己变了。
> **wave 82 又把「下一轮」的第一条做掉了**（artifact 标题的长文件名，两边同改）。
> **wave 83 把一页纸清单上排第一那条做掉了**（验收判据本身没被验过）——
> 实验真跑了，判据当场被证伪并修好，动态那一半现在是 `make standalone-sim`。

> **wave 88 又把「还没接的交互态」里最干净的那一处做掉了**（`integrations` 的权限
> 面板与换应用表单），并顺带在 `e2e-backend` 里抓到一条 wave 87 漏改、干净树上
> 照样红的用例。**还没接的四处**：`channels` 的连接对话框、`branch-thread`、
> `thread-history-mermaid` 的下载菜单、`chat` 那一屏的 composer 菜单
> （各自的已知难点见 `docs/plans/vue-parity-cold-start.md` 那张表）。

> **wave 101 把一页纸清单上的第 2 条（覆盖率棘轮的 pending）量到底了**：
> 按登记的判据连取 20 次，React 仍是两个终态（15 B / 5 A），**判据未满足、pending 保留**；
> 但顺带订正了它的病因——A **不会自愈**（5/5 等满 90s 都没收敛），
> 所以真正挡路的是上游那个加载态，已作为新的一条挂在下面第三节。

剩下的：

### 一、~~artifact 头部的标题不截断~~ —— **wave 82 两边同改；剩下的零头 wave 103 判定不算差异**

量出来是真的，而且两边都坏（59 字符的文件名把五颗动作键全推出 `overflow-hidden`
盒子，上游溢出 199px、本仓 181px，下载与关闭都点不到）。修法与复测见 wave 82 那一节。
~~剩一个零头：长名下裁剪盒仍有轻微溢出，上游 481/458（23px）、本仓 497/492（5px）。~~
**wave 103 复量并判定：不算差异，账结清。** 那两个读数是拿**两个不同层级的盒子**在比
（clientWidth 458 vs 492，差 34px 本身就是证据）；用户可见的标题 `span`（407/407 被裁 0px）、
`SelectTrigger`（两边都 455 宽）与四颗动作键（位置差 1px、无越界）**两边逐字相同**。
详见 wave 103 那一节。

### 二、~~验收判据本身没被验过~~ —— **wave 83 跑完，判据是假的，已修**

一页纸清单上排第一的那条。实验就是它写的那句：移走 `frontend/`、跑、移回来。
**BLOCKING 已经 0 了几十轮，而 `make verify` 当场红**（`describe.skipIf` 跳过用例
不跳过收集，坑 225）。顺带量出第二条假话（`doc-references` 三条用例是函数体里
`return` 报绿，不是跳过，坑 226）。落地见 wave 83 那一节。
**这条从此有机器守着**：`make standalone-sim` 每次都真做一遍。

### 三、~~上游那个不会自愈的加载态~~ —— **wave 102 定性完毕：不是产品缺陷，这笔账作废**

wave 101 挂这笔账时写的是「`LoadMoreHistoryIndicator` 的 `isHistoryLoading` 一直是 true，
屏幕上一颗『Loading...』一直转」。**wave 102 逐个查完，这句话每一半都不成立**：

- 命中的元素在 **shadow root** 里，`host=next-route-announcer`、`hostParent=body`，
  没有 `button` 祖先，`document.querySelectorAll("*")` 也找不到它
  （Playwright 的文本引擎穿开放 shadow root，`querySelectorAll` 不穿）。
  它是 **Next 自带的路由播报器**，1×1 裁剪、`aria-live="assertive"`，
  内容是上一拍的 `document.title`。**屏幕上没有任何东西在转。**
- **mock 也不是嫌疑人**：`messages/page` 的路由永远 fulfill 200，
  线程不认识时返回 `data: []` + `has_more: false`。
- **请求也不是**：`token-usage` / `messages/page` / `langgraph/threads/{id}` 在 A 里
  同样发了、也都 200 回来了，**+588ms 之前全部完成，此后 60 秒网络上再没有任何东西**。

**这笔账结清，不必再追。** 真正剩下的不确定性回到 `pending` 那一条上——
是「乐观消息在 700ms 这一刻去没去重」，见 wave 102 那一节。

### 四、往下挖什么

`app/pages/` 下的路由一条不剩地量过了，台账清零，`icon-parity` 归零，
守卫注释里点名的账也清完了。**下一轮要找活，只能从这三个方向选**：

1. **给取样面加交互态**（第①⑦类）。判据仍是 wave 20/21 那条：一个域收工前，
   把它所有「点一下才出现」的东西列出来，逐个问「这一屏进过取样面没有」。
   wave 76 刚证明这条还有货——一次接上就量出 27 处。
   **挂展开态很便宜**：场景 id 受棘轮约束，夹具与 steps 不受。
2. **给现成的尺子加一档**（wave 75 的 icon-parity、wave 76 的几何锚点都是这么来的）。
   注意线索 213/186：**一把新尺子最先要量的是它自己**。
3. **把散文里的断言变成守卫**（`tests/guards/` 下已有九条 + `tooling-contracts`
   里 wave 83 新加的一组）。加之前先读它们的覆盖面。
   **wave 83 又证明这条最值钱**：那张表的 `note` 挂了几十轮、零消费者，
   17 条里有 2 条是假的，而**两条假话在报表上都长得和真话一模一样**。
   下一个同形的目标：`baseline/*.json` 的 `$semantics`、
   各文件头「实测过、做不到」的结论——**判据是「哪一行代码读它」**。

> **wave 107 把 wave 106 留的那两张「以后端为全集」的表量完了**：
> `DEERFLOW_DURABLE_STATUS` **补上了镜像门禁**（后端那边是干净的 `StrEnum`），
> `DEERFLOW_WIRE_EVENTS` **量完判定不做**（后端没有枚举，wire 名字散在
> `bridge.publish` 的调用点上，只有两个是字面量；做成门禁就会误报——读数写进
> `event-map.ts` 的头，别再试第二次）。**这条线索到此清空。**
> 顺带留下一条**新的同形目标**：`e2e-suite-contract` 里那张
> `standalone = {external, visual, parity}` 是单向的——没人查表里的 id 还是不是
> 真的 config。本轮没动它，因为三个 id 都还在，且改名会先让「每个 config 有一个
> make 目标」那条红；真要补就是一条反向断言。

> **wave 106 把方向 3 往 `app/` 与 `packages/` 上扫了一遍**（wave 105 只筛了
> `tests/guards/` 与 `scripts/`），量出五处、修完五处，其中**一处有活违规**
> （`app/core/threads/utils.ts` 的「等 8 个」实际 9 个，从 2026-08-31 烂到现在）。
> **还没筛的**：`app/` 里那些以**后端**为全集的表——`DEERFLOW_DURABLE_STATUS`
> （头里写着「Gateway 的 durable run status 全集」，实测与
> `backend/packages/harness/deerflow/runtime/runs/schemas.py` 的 `RunStatus`
> 六个成员**当前一致**，但没有任何机器在对；补的话要把 `backend/` 拉进
> `make verify` 的读取面，代价要先想清楚）、`DEERFLOW_WIRE_EVENTS`
> （「当前 Gateway 会发出的 wire 事件名全集」，同形）。
> **已筛过、不是缺口的**（别再重筛）：`shared/showcase.ts` 的三张表
> （已经与 `public/demo/threads/` 双向逐文件比）、`config/routes.ts` 的
> `csrRoutes`（**不声称覆盖全集**，同 `ROOT_MAKE_TARGETS`）、
> `SUPPORTED_RUN_STREAM_MODES` ⊃ `THREAD_STREAM_MODES`（白名单本来就更大）、
> `SECTION_ICONS` / i18n `settings.sections`（tsc 已经双向管住）、
> 各种扩展名 / 协议 allowlist（全集无限，不是「另一半没人查」）。

## wave 64 做了什么：**把覆盖率接上，并订正 wave 63 的误判**

### 订正：不是「配置工程」，是一个 devDependency 装错了大版本

wave 63 说「要出真数字得先做配置工程」——**错的**。裸
`pnpm add -Dw @vitest/coverage-v8` 装到了 **5.0.0**（peer 要 vitest 5.0.0），
而本仓是 **vitest 4.1.10**。报出来的是

```
AssertionError: coverageFilesDirectory is required
```

出现在**每一个 worker** 上、一次 251 个未处理错误、summary 是
`0/14384 statements`，而且 node / dom / nuxt 三个 project **全都一样**
——**看起来像「这套三-project 配置不支持覆盖率」，实际是 v5 的 provider
在跟 v4 的核心说话**。装同一条 range 之后一次就过，
**`vitest.config.ts` 一个字都不用改**（试过加 `coverage` 块，再还原成
只用命令行参数，一样跑通）。

### 实测的覆盖率

```
语句 73.22%   分支 64.72%   函数 70.55%   行 74.90%
```

| 目录                  | 行覆盖 |     | 目录                                        | 行覆盖                 |
| --------------------- | ------ | --- | ------------------------------------------- | ---------------------- |
| `app/lib`             | 100.0% |     | `app/composables`                           | 72.4%                  |
| `packages/agent-core` | 94.3%  |     | **`app/components`**                        | **66.0%**（3995/6052） |
| `app/pages`           | 91.6%  |     | `server/utils`                              | 21.9%                  |
| `app/core`            | 85.5%  |     | `app/layouts` / `server/routes` / `app.vue` | **0%**                 |

**那几个 0% 不代表没测**：layouts、Nitro 路由、`app.vue` 靠 **e2e** 覆盖，
而 v8 只看得见单测进程里执行的代码。**这个数是「单测行覆盖」，不是「测试覆盖」。**

### 落地的三样

1. **`@vitest/coverage-v8` 与 `vitest` 用同一条 range**（`^4.1.10`）。
2. **`make coverage`** —— **有意不进 `verify`，也没有阈值**。覆盖率当门禁会逼着
   写凑数的测试；它是**诊断工具**，用来找「哪一块没人测」。
3. **`tests/guards/tooling-contracts.test.ts`**（新）：
   - **成组依赖的 range 必须逐字相同**——钉的不是版本号（那会让每次升级都要改守卫），
     是「这两条一起动」。变异实测：把 provider 跳到 `^5.0.0` 当场红。
   - **`.PHONY` 与实际 target 一一对应**。wave 60 手工量过一次（53:53 全对）
     **但没留门禁**；wave 64 变异实测：把 `coverage:` 改名而 `.PHONY` 不动，
     **当时一条用例都不红**。两个方向都钉（有 target 没声明最阴——
     目录里有同名文件时 make 会静默什么都不做）。

### 负向验证 6/6 全红，其中两条第一次是假绿

| 变异                                  | 结果                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| provider 跳到大版本 5（正是踩过的坑） | RED                                                                                                                                      |
| 整条依赖被删掉                        | RED                                                                                                                                      |
| 只升 vitest 不升 provider             | RED                                                                                                                                      |
| **LOCKSTEP 清单清空**                 | **第一次 GREEN**——两个 for 都不进循环，断言全部落空却照样绿（**线索 176 本人**）。补 `expect(LOCKSTEP.length).toBeGreaterThan(0)` 后 RED |
| **target 改名而 `.PHONY` 没跟**       | **第一次 GREEN**——那条门禁当时还不存在，写出来之后 RED                                                                                   |
| 反方向：`.PHONY` 里去掉 `coverage`    | RED                                                                                                                                      |

## wave 63 做了什么：**去补最后一条场景，量完是「补不了」**

覆盖率棘轮里 `chat-thread-init-ordering` 的翻案判据是「竞态修好之后连取 5 次
只出现一个终态」，而 wave 62 刚说竞态没了。去验证 —— **判据没满足，
而且 wave 62 那句是错的。**

### 错在哪：量的取样点不对

wave 62 的探针**等了 30 秒**才读标题；棘轮的取样点是 `captureScenario` 的
**`settleMs = 700`**，它不会多等（硬规则 2 还明写这个数不许动）。
**按 700ms 重测 23 个样本（5 + 6 + 12 三批，同一次构建）**：
React 仍是**两个终态、19 B / 4 A（约 17%）**；Vue **23/23 单一**。

变的只有一件事：**A 不再是吸收态**（wave 29 时 5 次里 2 次等满 30s，
现在 14/14 都会清掉）。**A 从「终态」变成了「慢」——但对等不了那么久的
那个消费者来说仍然是缺陷。**

### 产出不是新场景，是三样

1. **两个终态的精确差异钉进 `$pendingReasons`**：
   B（55 行 / 23 请求）播报区空、`token-usage` + `messages/page` + `threads/{id}`
   三条已发；A（56 行 / 20 请求）播报区仍是 `Loading... - DeerFlow`、那三条没发、
   **乐观的用户消息还没去重**（`Completed in <1s Hello` + 一颗
   `button "Copy to clipboard"`）。**wave 29 记的「无名按钮」就是这颗复制键。**
2. **复现脚本一并写进去** —— wave 29 只记了现象，害得 34 轮之后要重建整套观测。
3. **翻案判据从「连取 5 次」收紧到「连取 20 次」。** 17% 翻面率下一批干净的 5 次
   并不罕见，**旧判据等于允许靠重跑收工**（撞硬规则 3）。本轮第二批 6/6 全同，
   就此收工正好满足旧判据 —— 而第一批与第三批里两个终态都出现过。

### 顺带答了「frontend-vue 全面测过吗」

**本仓此前从来没有测过行覆盖率**（没配任何工具）。wave 63 临时装
`@vitest/coverage-v8` 挂不上，当时判成「要做配置工程」——**那句 wave 64 订正了，
是错的**：真正的原因是裸 `pnpm add` 装到了 **5.0.0** 而本仓是 vitest **4.1.10**，
报的 `coverageFilesDirectory is required` 完全看不出是版本问题。
**装同一条 range 之后一次就过，`vitest.config.ts` 一个字都不用改。**

规模是：单测 251 文件 / 2090 条；e2e-mock 310、e2e-backend 22、e2e-parity 47
（台账 0 行 / 39 样本）、visual 8、external 3;门禁测试 13 文件。
**已知盲区**：台账天生看不见的八类差异、六个 settings 面板没有合法场景 id、
命令面板那一屏没被取样、以及这条 pending。

## wave 62 做了什么：**按产品价值挑了三条，做完；顺手翻出三颗无名控件**

判据换了：**不是「哪里还没对齐」，是「哪一条对真实用户有好处」**（2026-09-04 用户
明确「React 那一侧有 bug，你也得修」）。挑出三条，全部做完。

### 一：`/auth/callback` 吞掉 `?next=` 深链（**改的是 `frontend/`**）

上游 `(auth)/layout.tsx` 见到 `authenticated` 就服务端 `redirect("/workspace")`，
而真实 OAuth 走到 callback 时 session cookie 已经在了——**那一页从来没渲染过**，
它自己对 `next` 的处理是死代码。用户从别人分享的深链登录，登完被扔到工作区首页。

**修法就是 wave 28 记的那条「更小的」**：`src/app/(auth)/auth/` → `src/app/auth/`，
自带一个 `dynamic = "force-dynamic"` 的 layout（不带 AuthProvider / I18nProvider，
那页本来就不用）。守卫按**结构**钉：`/auth/callback` 上方不许有任何 layout 在
`authenticated` 时跳走。**本仓一个字都不用改**——它的全局 middleware 只在
`/workspace/*` 上探 session，一直是对的。

### 二：模型选择器补上 cmdk 的模糊匹配 + 评分排序

把 `cmdk@1.1.1` 的 `command-score` **逐行移植**进
`app/core/models/command-score.ts`，实测 **950 组逐值差 0**。
筛选与排序改走 `app/core/models/filter.ts`。wave 37 那条「分隔符不敏感」删掉了
——**不是放弃是被覆盖**（`formatInput` 把 `[\s-]` 归成空格，`MiniMax M3` 打
`minimax-m3` 得 0.9996）。**原来的理由「引评分库不划算」成立，
但结论应该是「移植算法」而不是「不做」。**

### 三：首次发送那一屏 —— 两条账过期，**第三条我说过头了（wave 63 订正）**

`Completed in <1s` 本仓从 `524beace`（2026-08-13）就画了，比记这条账早两周;
`Edit and rerun` 上游也早有 `aria-label`。**这两条确实过期。**

**但「竞态已经没有了」这句是错的。** wave 62 量的是「等 `Loading…` 消失」
（14/14 都清掉），而**棘轮的取样点是 `settleMs=700`，不会多等**。
wave 63 按那个取样点重测 23 个样本：**React 仍是两个终态（19 B / 4 A，约 17%）**，
Vue 23/23 单一。变的只是 **A 不再是吸收态**（wave 29 时 5 次里 2 次等满 30s）。
**详见「挂着的账」那一节与 `$pendingReasons`。**

### 但同一次普查翻出了三颗真的无名控件，两边都有

探针里顺手加了一条「跑完一轮之后，屏幕上还有哪些交互控件没有可访问名」：

| 控件                         | React | Vue                |
| ---------------------------- | ----- | ------------------ |
| 复制键（human turn）         | 无名  | 无名（**照抄的**） |
| 复制键（assistant turn）     | 无名  | 无名（**照抄的**） |
| 侧栏底部设置触发器（收起态） | 无名  | 无名               |

**tooltip 不是可访问名** —— Radix / Reka 都把它挂成 `aria-describedby`，
读屏器念出来就是一颗「按钮」。两个 Vue 文件头此前都写着「不给可访问名，
因为上游只有图标和 tooltip」——**对上游的描述是准的，照抄的却是缺陷**。
按 wave 28 的判据三处**两边同改**。

### 门禁与负向验证

见下面「门禁实测值」。**9 条有效变异全红**；**1 条第一次假绿**（排序那条用例的
输入序恰好等于分数序，删掉 `.sort()` 照样绿，已补一条输入序≠分数序的）；
**1 条无效变异**（空查询短路——所有分数都是 0.99，删掉它一条用例都不红，
`filter.ts` 里那条「不短路会打乱顺序」的理由因此**是错的，已订正**）。

## wave 61 做了什么：**按 C2 跑了第一轮，清单已经空了**

wave 60 提的新判据 C2 是「不数写错的记录，改数**还没有机器看着的记录类别**；
一个类别要么上门禁，要么写下为什么上不了」。wave 61 就是按它跑的第一轮，
把 wave 60 点名剩下的两条全部收口。**这一轮翻出来的东西，是 C2 第一次被执行
就撞到的**——用旧判据（找一句写错的话）根本找不到它。

### 翻出来的：30 份文件自称 L2，而 L2 的进口边界只遍历白名单

`tests/architecture.test.ts` 有两条 L2 断言：白名单里每一份都要有 `【架构位置】 L2` 头，
以及白名单里每一份都不许 import 产品层（`l2ForbiddenImports`：`@/core/{auth,api,threads…}`、
`@/components/{chat,workspace}`、`@/composables`、`@/stores`、`#app`、`#imports`）。
**两条都只从白名单出发**，于是「自称 L2 但没上白名单」的文件**谁都不检查**。

实测：**162 份文件自称 L2，白名单里只有 132 份**。缺的 30 份**全部**创建于白名单
最后一次改动（`fa2cde27`，**2026-08-13**）之后——`MarkdownTable.vue` 是 08-24，
`dropdown-menu` 的 Sub 三件是 08-26，`select` / `card` / `alert` / `input` / `badge`
是 08-30，横跨至少四次提交。**也就是说，「新增 L2 组件要加进 `l2Files`」这条成文规则，
三周里每一次都被违反，而没有任何门禁变红。**

**其中一份拿边界一跑就违规**：`app/core/auth/logout.ts` 头写着 `L2 core`，
而它 import `@/core/auth/client-state`，正好命中 `l2ForbiddenImports` 第一条。
它本来就不该是 L2——ARCHITECTURE.md 的分层表把 L2 圈定在 `app/core/markdown/`、
`app/core/code-editor/`、`app/components/markdown/`、`app/components/ui/`、
`app/lib/utils.ts` 与当时还在的 focusable 模块（wave 148 删），并明写 L2 **不得依赖**「DeerFlow API、线程、认证、
产物和业务 store」。**已改成 L3，理由写进它自己的文件头。**

**门禁**：`architecture.test.ts` 的 L2 段补三条——① 形状先断言（扫到的数不是零）；
② **自称 L2 的集合逐个等于 `l2Files`**（双向：多出来的会绕过进口边界，少掉的说明
名单里有份文件改了头）；③ 名单按字母序（插入位置唯一）。
名单同时从 132 → **161**（新增 29 + logout 改判 L3），并**排序**——它此前是
「按冻结时间追加」（那份 focusable 模块卡在第 30 位、`app/core/code-editor/*`
在第 41 位），而本文件一直写着「按字母序」，**那句话也是错的**。

### 另一条 C2 类别：`【依赖关系】`

逐条读完一遍，**这一栏整体不可能有单一真值**：同一个字段里混着四种东西——
「我 import 什么」（`cn`、`Reka DialogRoot`）、「谁 import 我」（20 份写「被产品组件
显式导入」、`被 Badge.vue 引用`）、一个指路（23 份写「见下方 import。」）、
和散文（`零运行时依赖，纯 type-only`）。**方向都不统一的字段，分类器的豁免表会比
门禁本身长**（线索 180）。

**唯一可证伪的一档是「无 / 零依赖」**：31 份文件这么写，**实测 31 份全对**。
已上门禁（`file-header-claims.test.ts` 的第二个 describe）——
**这是「量过、成立、并且从此有机器看着」，不是「没查」。**

### 写下了「为什么上不了门禁」的

- **`【架构位置】` 的 L1 / L3**（写在 `architecture.test.ts` 的 L2 段前）：L2 有牙
  （对应白名单与进口边界，写错会让产品代码混进可复用层），L1/L3 **没有任何被强制的
  后果**——L1 的定义域就是 `packages/agent-core/`（实测 23 份 src 文件全写着 L1，
  一份不漏），L3 是「除此之外的一切」。**一条只保护注释、不保护任何约束的门禁，
  不如把理由写下来。** 实测唯一的第二义是 `app/core/channels/provider-state.ts`
  的 `L1 framework-neutral channel policy`（只 import 一个同目录 type，说的是
  「与框架无关」这条另一个轴）——**有意保留**。
- **`【文件职责】` 与 `【边界与注意】`**（写在 `file-header-claims.test.ts` 头）：
  它们是**解释**不是断言，没有可判真假的形式。里面**引用**的东西（路径、上游
  file:line、行数、make target、裸文件名、词典 key）另有五条守卫在管，
  **剩下的就是散文，靠读它的人**——wave 57/58/59/60 那几条正是这么翻出来的。
- **测试标题**：wave 59（`it`/`test`）与 wave 60（`describe`）两轮把机械可核对的那半
  扫完了（符号名、数字、上游断言），**语义那半不可机械化**——「这条标题说的是不是
  这段代码在做的事」要读代码。同上，写下理由，不立门禁。

### 门禁

verify **250 文件 / 2080 单测**（wave 60 是 250 / 2075；+5 = 3 条 L2 反向断言 +
2 条 `【依赖关系】`），词典 945/18，BLOCKING 0/0，DECLARED 37/16。
e2e 五套全绿、数字与 wave 59/60 逐条相同。

---

## wave 60 做了什么（保留全文——两个新门禁的口径都在这里）

**扫三类从来没被任何东西验过的记录：`describe` 标题、`app/**` 的 `【主要导出】`、
`Makefile` 每条 target 的说明。三类各翻出一条，其中两类当场上了门禁。**

### 一：`【主要导出】` 点名了七个不存在的符号（**这一栏此前零消费者**）

全模块 478 份文件写着这一行，而只有 `【架构位置】` 有人读
（`tests/architecture.test.ts:373`，且只读 L2 那一档）。逐条撞了一遍：

| 文件                                                    | 头里点的名                  | 文件真正导出的                              |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------- |
| `app/components/ui/chain-of-thought/context.ts`         | `provideChainOfThought`     | `injectChainOfThought`（+ key + interface） |
| `app/components/ui/effects/confetti.ts`                 | `confettiOrigin`            | `emitConfettiFrom`                          |
| `app/components/ui/effects/flickering-grid.ts`          | `updateFlickeringOpacities` | `prefersReducedMotion`                      |
| `app/components/workspace/browser-view/frame-buffer.ts` | `createFrameBuffer`         | `LatestBrowserFrameBuffer`（class）         |
| `app/composables/useSkillsCatalog.ts`                   | `SKILLS_CATALOG_QUERY_KEY`  | `SKILLS_QUERY_KEY`                          |
| `app/core/auth/session.ts`                              | `probeAuthSession`          | `probeSession`                              |
| `app/core/input/keyboard.ts`                            | `isEditableEventTarget`     | `isEditableKeyboardTarget`                  |

**七个幽灵名在整个 checkout 里各自只有一处——自己那一行。** 真名的引入提交
早于或等于幽灵名的引入提交，所以**七条全都是写下那天就错的**，没有一条是改名漂掉的。
五条出自同一个批量补文件头的提交 `fa2cde27`，其中 `keyboard.ts` 那条**真名就在
错行下面三行、同一个 diff hunk 里**。

**门禁**：`tests/guards/file-header-claims.test.ts`——`app`/`server`/`packages`/`scripts`
下每份 `.ts`/`.mts`/`.mjs` 的 `【主要导出】` 里，凡是长得像标识符的 token 都必须真的被
这个文件导出。实测 331 份文件 / 261 份写了这一行 / 209 份点了名 / 502 个 token /
**0 条豁免**。只钉一个方向（点名的必须存在），反过来不钉——`主要`两个字就是说它是索引。
`tests/` **有意不在范围里**：那边同一行写的是「被测对象是谁」，套上去会产 14 条误报
（那 12 个被测符号逐条撞过，在 `app/` 里全找得到）。

### 二：`reducer.test.ts` 的 describe 标题与同一份文件里的机器断言互相矛盾

`describe("合成载荷（write_read_file.ultra 不产生这些帧）")` 里六条用例测的全是
`updates` 与 `values`——而**同一份文件 90 行之外的帧普查一直在断言
`updates: 50, values: 13`**。写下那天（`d6048f81`）录制里就已经是 50 / 13，
**不是过期、是从头就说反了**。同一段里 `节点写 null（录制里 7 帧都是这样）`
实测是 **38** 帧，当天也是 38。

**这条比错字重**：这份文件存在的理由就是「分开写，读的人才知道哪条结论的证据强度是多少」，
而这个标题把「有 50 帧真实录制佐证」说成了「录制里根本没有」——**恰好朝着它要防的
方向说反**。修法是把分档说明搬进分节注释，并把「录制到底佐证了哪几条」加进普查那一条
（38 个 null 节点写 / 10 帧写 messages 通道 / remove 与 values 重排各 0），
**数字只留在那一处**。

### 三：`make verify` 的步骤表，四处散文互不相同、且都和 recipe 对不上

| 出处                  | 写的                                           | 缺 / 多                               |
| --------------------- | ---------------------------------------------- | ------------------------------------- |
| `Makefile` help       | lint + format-check + typecheck + unit + build | 缺 i18n / OpenAPI / 契约常量 / 独立性 |
| `ARCHITECTURE.md:361` | …、**清单**、i18n、OpenAPI、独立性、build      | **多一个幽灵步骤**，缺契约常量        |
| `README_zh.md:66`     | …、i18n、OpenAPI、独立性、build                | 缺契约常量                            |
| `README.md:78`        | …, i18n, OpenAPI, standalone, build            | 缺契约常量                            |

`清单` 是 `collected-check`，`1209651f`（2026-08-25 **00:11**）已把它从 verify 里删掉，
而这句话是同一天 **12:57** 的 `c6fc60b4` 写下的——**提交说明恰好是
「make every documented command and path real, and gate it」**。
写下那一刻就是错的，同线索 178。

**门禁**：`doc-facts.test.ts` 里新的 `make verify 的步骤表`——一张
「类别名 → 真实 target」的表，断言 ① 表的并集逐个等于 `verify:` 的先决条件、
② 四处散文逐字按表写、③ 散文里不许再出现 `collected-check` / `header-check` / `清单`。

### 扫过没问题的

`describe` 标题 421 条：以 PascalCase 开头的 24 条全是英文散文不是符号引用；
带数字/上游断言的 30 条逐条撞过（`13 个 checkpoint 夹具` 由 `toHaveLength(13)` 自守、
issue #3482 与上游逐字同、`ui/sidebar.tsx` 路径在）。
`.vue` 的 `【主要导出】` **217/217 全对**（184 份有可判 token）。
`Makefile` 的 `.PHONY` 与实际 target **53 : 53 一一对应**，help 里点名的 35 条全部存在。

---

## 更早几轮的记录（49~59 一句话，48 保留全文）

- **wave 59**：`cron.test.ts:265` 的标题 `Asia/Shanghai is UTC-8` 符号写反，
  **断言是对的、括号里就是它自己的反证**，同 describe 另三条同类断言符号全对。
- **wave 58**：`Button` as-child 那条账说「两边都没有任何选择器消费 data-*」，
  **而本仓 14 个测试文件在消费它，最早那条比「两次复验」早十四轮**；
  **决定不变，错的是翻案判据太松**，已收紧成两条 grep 的交集（→ 线索 182）。
- **wave 57**：`scenarios.ts` 同一份文件里两句话互相矛盾（`Notification.permission`
  默认值），**量了四次全是 `denied`，错的是没带日期的那句**（→ 线索 181）。
- **wave 56**：把本文件里每个数字逐条量，两个错的**都是自己造的**（「176 条线索」是
  同一数字写三处、改两处漏一处；「L2 约 60 个文件」是 wave 55 随手估的，实际 104）。
  **修法：一个数字只写一处。** 同轮真跑复核了 React 侧 1023 / 146，全对；
  路径守卫收进兄弟树（172 处此前一条不查）。
- **wave 55**：本文件写着「`BrowserPanel.vue` 文件头已同步改过（四处 → 三处）」，
  而文件头从 wave 39 起就写着**两处**，文档十六轮没跟。同轮给
  `packages/agent-core/tests/contract.test.ts` 补上了一个真存在的单向断言
  （文档多点名一个源码里没有的 kind，收紧前全绿）。
- **wave 54**：三条**不带反引号**的死引用（`lib/source-facts.mjs` 是 `1209651f` 删的
  第三处遗留；另两条从写下那天起就是错的），其中一条**本文件 wave 41 就记过是错的、
  代码里没人改**（→ 线索 180）。门禁补第四档：顶层目录前缀的路径带不带反引号都查。
- **wave 53**：`message-merge.test.ts` 的「上游 1,740 行」在 `44832a5e`（合上游）之后
  变成 2,095，两个文件各挂一份、错了三周；`globals.css` 的 453→454 是本仓自己改的。
  **三处都是写下时准确的——过期不是记错**。门禁是「行数断言 == 实际行数」（→ 线索 179）。
- **wave 52**：`react-parity-scope.json` 的 `$comment` 说「product-surface.test.ts 是它
  唯一的消费者」，而 `scenario-coverage.test.ts` 在那句话落地 **30 分钟后**就开始读它，
  错了九天约五十轮。修法是 `$readers` 数组 + 门禁与实测引用集逐字比对（→ 线索 178）。
  同轮订正了「三次动 `frontend/`」（实际十四轮）。
- **wave 51**：`tests/fixtures/streams/README.md` 说「debug 实测数据留在
  `playwright.m0-real-backend.config.ts` 的注释里」，而那份 config 在 `1209651f`
  ——**正是写下 `doc-references.test.ts` 的那次重命名**——里被拆掉，数字没跟着搬。
  漏掉是因为守卫**两半覆盖面差得远**，路径那半的正则按顶层目录前缀收口，
  模块根上的裸文件名两半都不匹配（→ 线索 177）。修法：数字搬回活着的 config +
  「裸文件名在 checkout 里搜得到」新门禁 + streams README 的「怎么录的」== 录制器
  实际所做 + 把 wave 46 的引用守卫从 `app/**` 推到整个模块（+91 处）。

- **wave 49**：`react-markdown-dom.json` 的 `recordedFrom` 说「录自 streamdown 2.5.0」，
  没有任何东西验过。修法是两条一起：录制器从 `node_modules/<pkg>/package.json` 读真版本，
  守卫钉「标签 == 实际装的版本」（→ 线索 175）。
- **wave 50**：每轮收工手搓的「独立复核台账」脚本走 `d.get("scenarios", d)` 兜底，
  而基线顶层键是 `entries`——**基线行数恒为 0 与内容无关**。改掉硬规则 1 +
  固化 `scripts/parity-ledger-report.mjs`（形状先断言再计算，→ 线索 176）。

## wave 48 做了什么

**扫从来没有被任何东西验过的那一类：`baseline/` 下的纯数据文件——它们说的话没有任何代码验。**
翻出一条，**所以收尾判据重新计数**（47 干净、48 不干净）。

### 翻出来的：`exemptModes` 声明了一条豁免，零消费者

`react-parity-scope.json` 的 `exemptModes` 写着「静态整站模式不欠」，**没有任何东西读它**。
这是**线索 131 的第二次发作**（wave 29 的 `$pendingReasons` 挂了十几轮没人读）。

**它确实是纯说明，不是漏接**：`product-surface.test.ts` 比的是**路由**，
而静态模式不是路由、是 env 开关（`NEXT_PUBLIC_STATIC_WEBSITE_ONLY`，上游 35 处）下的分支，
路由级比对里天生没有它要排除的东西。**问题在归错了类**——本仓约定 `$` 开头 = 纯说明，
它没带 `$`，长得像真数据。已改名 `$exemptModes`。

### 把约定变成门禁，而不是只修这一个键

`tests/guards/baseline-keys-consumed.test.ts`：**`baseline/*.json` 里每个不带 `$` 前缀的
顶层键都必须至少有一个 `.ts`/`.mjs`/`.vue` 读它。**
`$` 开头 = 纯说明；不带 `$` = 真数据，没人读就是「写了没人看」——**改错了不会有任何门禁变红**。
**只钉顶层键**（深层字段的消费方式太多，钉进去是噪声；顶层键是这些文件的目录）。

### 守卫自己第一版假绿了 → 线索 174

第一版对 K1（把 `$exemptModes` 改回 `exemptModes`）**绿**：守卫扫 `tests/**`，
而**它自己的文件头注释里提到了 `exemptModes`**，注释被算成了消费者。
**这是线索 126 反咬守卫本身。** 改成**先剥注释再判**才红。
**写「有没有人用 X」这类守卫时，第一件事是把注释剥掉**——否则守卫的文档会把被测对象救活。

---

## 挂着的账（有意没修；**当假设重新验**）

> **一页纸的总清单在 [vue-parity-open-accounts.md](vue-parity-open-accounts.md)**
> （wave 82 收尾时建的）：真正还开着的 3 条、已决定不再复量的 11 条、
> 这一轮清掉的 5 条、门禁读数、以及「之后要找活只能从哪三个方向选」。
> **下面这一节是每一条的完整背景，总清单只给状态。**

### 只读案例页剩下的

> **wave 81 第三次复量（2026-09-05），与 wave 27 / 28 逐条相同**：
> `/showcase/<demo id>` 的 aria 差异 **onlyReact 0 / onlyVue 0**，落地 URL 两边相同。

- **请求层的落差**（台账天生看不见的第②类：`/showcase` 不在取样面里）。
  三轮实测一字不差：

  ```
  react  /api: GET /api/features · GET /api/models · GET /api/skills
               · GET /api/suggestions/config · GET /api/threads/«generated»/uploads/limits
  vue    /api: GET /api/models
  react-only : features · skills · suggestions/config · threads/«generated»/uploads/limits
  vue-only   : （空）
  ```

  **wave 28 决定不放开，并把它从「待办」改成「已决定」**：这四条都打向需要鉴权的
  端点，而案例页是公开只读的——上游发它们只是因为
  `showcase/[thread_id]/page.tsx` 直接渲染整个 `ChatPage`，没有为 demo 分支特判。
  它们在这一屏上产生的可见差异实测为零（aria 0/0）。哪天要翻案，判据是
  「有没有哪个只读能力因为缺了这四条而在案例页上失灵」，不是「上游发了所以要发」。
  **wave 81 按线索 187「先复现再修」重量了一遍，结论不变——这一条不必再复量，
  除非上游那一屏的取数变了。**

### settings 域剩下的

- ~~`settings.memory.*` 六条 unused 全部核实为「上游自己也零消费」~~ ——
  **这条记错了，wave 34 翻案**：只有 `rawJson` 是上游也零消费的，其余五条上游全在
  `toast.success`，本仓一条都没有。连同被 `common.exportSuccess` 遮蔽的
  `exportSuccess`，六条已于 wave 34 全部接上。
  **「已核实」这三个字本身要重验**（线索 152）。
- settings 域已全部归 0（wave 24 收尾）。

### 建 agent 页剩下的（wave 28 新增）

- **确认名字之后那一步（chat step）两边的外壳不同。** 上游 `new/page.tsx` 自己画一张
  极简页：同一个 header（返回 + 标题）再加一颗 More 下拉，里面只有 Save；本仓走
  `AgentChat` 的**完整会话头**。**有意保留本仓这一侧**：把上游那个 header 叠上去
  会让这一屏有两个 header。

  > **wave 81 复量（2026-09-05，probe 打到 chat step 之后取样）**。
  > wave 79 之后剩下的差异比 wave 28 记的少一项——**More 菜单已经对上了**
  > （React 触发器 x=1232，本仓 x=1231，相差 1px），`agents.more` 也有了消费点。
  > 剩下的是：
  >
  > |        | 上游                                              | 本仓                                              |
  > | ------ | ------------------------------------------------- | ------------------------------------------------- |
  > | header | `justify-between gap-3 border-b px-4 py-3`，高 57 | AgentChat 的 `absolute h-12 backdrop-blur`，高 48 |
  > | 左侧   | 返回画廊键 + `h1 "Design your Agent"`             | 侧栏触发器 + agent 名字                           |
  > | 右侧   | 只有 More                                         | 用量徽标 + More                                   |
  >
  > aria 差是 onlyReact 3（返回键、h1、`Completed in <1s`）/ onlyVue 10，
  > **但后者大半不是外壳**：轮次操作条（分支 / 编辑重跑 / 重新生成 / More）与
  > 会话链接是**两次跑拿到的对话状态不同**，属于 wave 63 记的那条竞态，不是这一屏的形状。
  > `agents.createPageTitle` 在本仓**有消费点**（命名步骤那张页的 h1），不是死词条。
  > **结论不变：保留本仓这一侧。**

- **`agents.saveRequested` 与 agents 下的 agentCreatedPendingRefresh 有意不补。**
  上游靠这两条 toast 报告保存进度；本仓 `useAgentCreationSession` 用
  saving/verifying/created/error 四态 + 行内错误区表达同一件事，再加 toast 等于说两遍。
- **上游那颗 `<Input>` 的可访问名来自 placeholder。** 本仓照抄了（去掉了自己加的
  `aria-label`）。这是「命名弱但存在」，按 wave 28 的判据不算缺陷；要改是两边同改。

### ~~`/auth/callback`~~ —— **wave 62 做掉了（改的是 `frontend/`）**

> **判据是「有人真的因深链被吞而报障」——没等到报障就做了，理由写在这里。**
> 2026-09-04 用户明确「React 那一侧有 bug，你也得修」，并要求按产品价值排序
> 而不是按对齐价值。这一条的产品损失是实打实的：从别人分享的
> `/workspace/chats/<id>` 深链发起 OAuth，登录完被扔到 `/workspace`，
> 原本要去的那一屏丢了。**对齐价值仍然是零**（这一屏在 `AUTH_DISABLED` 下
> 两边打开的不是同一个页面，进不了取样面），所以它**不占一轮平替**，
> 是一次纯 React 缺陷修复。
>
> **做法就是 wave 28 记的那条「更小的修法」**：把 `auth/callback` 从
> `(auth)` 路由组里移出来（`src/app/auth/callback/`），自带一个
> `dynamic = "force-dynamic"` 的 layout，不带 AuthProvider 也不带 I18nProvider
> ——那个页面本来就不用它们（一句 `t` 都没有）。`/login` 的服务端跳转不受影响。
> 守卫 `frontend/tests/unit/app/auth-callback-route.test.ts`：**结构上**钉住
> 「`/auth/callback` 上方不许有任何一个 layout 在 `authenticated` 时
> `redirect("/workspace")`」，并钉 `?next=` 的处理还在。
> 变异实测：把页面挪回 `(auth)` 组，守卫当场红。
>
> **剩下的一条没做**：React 的 callback 页三句状态文案是写死英文的
> （`Signing you in...` / `Redirecting...` / `Authentication failed...`），
> 而本仓那三句走词典。这一条**没有跟着修**——它要给新 layout 加回
> I18nProvider，属于另一件事；记在这里当下一个候选。

以下保留 wave 28/33 当时的分析。

- **差异是真的**：上游 `(auth)/layout.tsx` 见到 authenticated 就服务端
  `redirect("/workspace")`。真实 OAuth 流程走到 callback 时 session cookie 已经在了，
  于是**回跳带的 `?next=` 深链总是被丢掉**，那个页面对 `next` 的处理是死代码。
  本仓的全局 middleware 只在 `/workspace/*` 上探 session，callback 页照常渲染并尊重 `next`。
- **但修法只在 `frontend/` 一侧，本仓不需要任何改动。** 这不是「两边同改」——
  那条边界的目的是让两棵树在**被取样的面**上逐行一致；这一屏在
  `DEER_FLOW_AUTH_DISABLED=1` 下两边打开的根本不是同一个页面（wave 28 量过 44 行噪声），
  **进不了取样面，对齐价值为零**。**所以它不占一轮平替。**
- **wave 28 记的修法也不是最好的。** 那条「把 `authenticated → redirect` 从共享
  layout 挪到各页」会把 `/login` 的服务端跳转变成客户端跳转（闪一下登录表单）。
  **更小的修法**：把 `auth/callback` 移出 `(auth)` 路由组——那个页面不用
  AuthProvider、不用 I18nProvider（它一句 `t` 都没有），只需要自带一个
  `dynamic = "force-dynamic"` 的 layout（`useSearchParams` 在静态渲染下要 Suspense）。
- **哪天要做**，判据是「有人真的因为深链被吞而报障」，做的时候按上面那条更小的修法，
  并且要跑一遍上游的 e2e-auth。401 与 5xx 两支两边**已经一致**。

### ~~首次发送之后那一屏~~ —— **wave 62 全部结清，四条里三条是过期账**

wave 29 记了四条，wave 62 逐条量了一遍（replay Gateway，React/Vue 各取样，
探针跑完即删）：

- **上游那条竞态 —— wave 62 说「已经没有了」，那句说过头了，wave 63 订正。**
  **竞态还在，变的是 A 不再是终态。**
  - wave 62 量的是「等 `Loading…` 消失」：14/14 都清掉了，用户消息每次 1 份。
    wave 29 同样的等法是 5 次里 2 次等满 30s 超时。**这一半确实变了**：
    A 以前是吸收态，现在只是慢。
  - **wave 63 按棘轮自己的取样点（`settleMs=700`）重测 23 个样本**：
    React 仍然是**两个终态，19 B / 4 A（约 17%）**；Vue **23/23 单一终态**。
    **wave 62 之所以没看见，是因为它多等了 30 秒**——而棘轮不会多等，
    `settleMs=700` 是硬规则 2 明写不许动的。
  - 两个终态的**精确差异**已经钉进 `$pendingReasons`（wave 29 只记了现象）：
    B（55 行 / 23 请求）播报区空、三条后续请求已发；
    A（56 行 / 20 请求）播报区仍是 `Loading... - DeerFlow`、那三条没发、
    **乐观的用户消息还没去重**（aria 里是 `Completed in <1s Hello` + 一颗
    `button "Copy to clipboard"`——wave 29 记的「无名按钮」就是这颗复制键，
    wave 62 已两边同改给了名字）。
  - **翻案判据 wave 63 收紧了**：原来「连取 5 次只出现一个终态」太松——
    17% 翻面率下一批干净的 5 次并不罕见，**那等于允许靠重跑收工**（撞硬规则 3）。
    改成 **连取 20 次只出现一个终态**。复现脚本也一并写进 `$pendingReasons`。
- ~~上游画 `Completed in <1s`，本仓不画~~ —— **这条从写下那天就是错的。**
  本仓 `MessageList.vue:1415` 从 `524beace`（**2026-08-13**）起就渲染回合耗时
  （`data-testid="run-duration"` + 时钟图标），比 wave 29 早两周，
  而且有两条测试守着（`thread-history.spec.ts:381` 断言 count 1、
  `message-surfaces.dom.test.ts:126` 断言图标）。
- ~~本仓多一颗 `Edit and rerun`，上游那个位置是无名按钮~~ —— **也过期了。**
  上游 `message-list-item.tsx:246` 写着 `aria-label={t.common.editAndRerun}`。
- 播报区那条**仍然不算差异**（框架自带的路由播报区，线索 135）。

**但同一次普查翻出了三颗真的无名控件，两边都有，wave 62 两边同改**：
两颗复制键（human/assistant turn，上游 `copy-button.tsx` 只有图标 + tooltip，
而 tooltip 在 Radix / Reka 里挂的是 `aria-describedby`，**不是可访问名**）
与侧栏底部的设置触发器（收起态只渲染一个图标，上游
`workspace-nav-menu.tsx` 既不传 tooltip 也没有 `aria-label`）。
**本仓此前是照抄了这处缺陷**，两个文件头都写着「不给可访问名，因为上游没有」。

### 跨域 / 更早挖出的

- **欢迎区在树里的位置** —— wave 34 复量后**改写**：本仓早就照抄了上游那对
  absolute 容器（AgentChat 那段注释写着为什么：留在文档流里会把输入框顶下去 24px），
  两边的**定位完全一样**。剩下的只是 DOM 父节点不同（上游是 InputGroup 的
  `extraHeader`，本仓是同一个定位祖先下的兄弟）。要对齐得给 ChatComposer 加一个 slot，
  **零可观察收益**（aria 去缩进后看不见层级，几何两边相同）。**有意保留。**
- ~~命令面板~~ —— **两条都做完了**：dialog 标题 wave 33（照抄上游写死的
  "Command Palette"），搜索框的可访问名 **wave 39 两边同改**（上游根本没有名字，
  是 WCAG 4.1.2 缺陷；本仓从 `aria-label` 换成同一套 `label` 机制）。
  **这一屏仍然没被取样**，靠 `shell-components.dom.test.ts` 守着。
- ~~模型选择器的筛选~~ —— **wave 62 做完了，这一条已结清。** wave 37 补的
  「分隔符不敏感」那一档已删掉——不是放弃而是**被覆盖**。现在走
  `@/core/models/command-score`，**`cmdk@1.1.1` 的 `command-score` 逐行移植**：
  实测 19 名 × 25 查询 × 带/不带 aliases = **950 组逐值差 0**。
  于是本仓与 React **筛出同一批、排出同一序**（上游把 `value={m.name}` 交给
  cmdk，cmdk 的默认 filter 就是这个函数）。
  原来的理由是「要连排序一起来，而引评分库不划算」——**引依赖确实不划算，
  移植算法划算**：`cmdk` 是 React 组件库（本仓用 Reka），`command-score` 也没有
  可直接用的独立发布包。等价性那次比对**没有签入**（它要 require
  `../frontend/node_modules`，撞 `standalone-check`），留存是
  `tests/unit/models/command-score.test.ts` 里 22 组从真实现取回的定值。
- ~~上游 toast / 本仓静默或内联~~ —— **wave 31 做完了**（普查出 22 处，
  全部收进 workspace toaster）。判据写在 `AgentChat.vue` 的 `failedSend` 声明上：
  **一刻发生的事走 toaster，一段时间为真的事留在页面里**。
  **留在页面里的三处不是遗漏**：发送失败 +「再试一次」、`stream.llmRetry` 的横幅、
  历史加载失败 +「再试一次」。要翻案得先推翻那条判据。
- ~~上游 `SidebarTrigger` 在窄屏读的是桌面的 `open`~~ —— **wave 36 两边同改做完了**
  （marker 推到 `79afa765`）。以下保留当时的分析。
  **wave 34 复量确认属实，而且就在可见面上**——上游三处调用都是
  `<SidebarTrigger className="md:hidden" />`，专门给移动端渲染；移动端抽屉的开合是
  `openMobile`，所以图标永远说「收起」。**「需要用户先拍板」那句已经过期**
  （取舍现在自己定）。**判定：值得做**（这处不改 React 自己也是坏的），
  但可访问名恒为 "Toggle Sidebar"、读屏器无碍，是纯视觉缺陷，
  而它要跑一遍上游的全套门禁（check / test 1022 / test:e2e 146，还有线索 125 那个
  超时坑）。**做法**：上游在组件里 `isMobile ? openMobile : open`；本仓在调用点分开传
  （`md:hidden` 那两处传 mobileOpen，桌面那处传 sidebarOpen）——本仓这个形状更好，
  因为 class 已经把「这是哪个语境」写死了。**建议与其他 `frontend/` 改动打包成一轮。**
- ~~划词工具条整簇差异~~ —— **wave 30 做完了**；留下的那条选区跨轮次播报
  **wave 31 也做掉了**。这一条已结清。
- **browser 面板有意保留的分叉**（写在 `BrowserPanel.vue` 文件头）。
  **其中「上游耗尽重连预算之后什么都不显示」这条 wave 40 翻案了**，见下面
  「上一轮做了什么」：上游是**永远画着 "…"**（意思是「还在连」），而且那条账
  只写了「本仓保留内联提示与重试」——**同一处缺陷的另一半本仓照抄了**。两边已同改。
  其中 `border-border` 那一条 **wave 32 已经结清**——本仓一直有那条基础层，
  错的是它裸写在顶层因而赢过所有工具类；挪进 `@layer base` 之后，
  BrowserPanel 里那些裸 `border-b` 与上游落到同一个颜色，那条分叉不再存在。
  **另一条「关闭按钮没有可访问名」wave 28 就两边同改结清了**，于是
  `BrowserPanel.vue` 文件头现在写的是**两处**：`role="alert"` 的内联错误 + 重试，
  以及画面上的 `@mousemove`（上游 forwardMouse 只接 onClick）。
  **这里原来写着「四处 → 三处」，从 wave 39（`b700cf17`）起就过期了**——
  记录与被记录的东西是两份（线索 180）。
- **`Button` 的 as-child —— wave 37 量完决定不做，wave 58 订正了理由。** 上游
  `<Button asChild>` 会把 `data-slot`/`data-variant`/`data-size` 放到 `<a>` 上，
  本仓裸调 `buttonVariants()` 只出 class。**决定不变**（要动 L2 primitive 的 9 个
  消费者，而 `data-*` 不进 aria 快照），**但「两边都没有任何选择器消费它」是错的**：
  `tests/unit/settings/settings-panels.dom.test.ts` 里那条
  `button[data-slot="button"]` 既选 `data-slot` 又断言 `data-variant`，
  而它是 **wave 23（`3d6bb266`）** 落的——**比 wave 37 那次「复验」还早十四轮**
  （线索 152：「已核实」三个字本身要重验）。而且它不是孤例：
  **全仓有 14 个测试文件在按 `data-slot="button"` / `data-variant` 选或断言。**
  **它不影响这个决定**：那条选择器要的是真 `<button>` 上的 `data-*`，本仓的
  `Button.vue` 一直就有；as-child 缺的只是**裸调 `buttonVariants()` 的那两处
  `<NuxtLink>`**（`app/pages/index.vue:51`、`app/components/chat/AgentChat.vue:1659`）
  上的 `data-*`，而没有任何选择器去选它们。
  **翻案判据也跟着收紧**（原来那句松到会被上面那条误触发）：

  ```bash
  # 有没有人按 data-* 去选一个「裸调 buttonVariants 的元素」（当前是那两处 NuxtLink）
  grep -rn 'buttonVariants(' frontend-vue/app | grep -v 'ui/button/'
  grep -rn 'data-slot=.button.\|data-variant' frontend-vue/tests frontend-vue/app | grep -v 'ui/button/'
  ```

  两条的交集非空时才翻案。**wave 58 实测：交集为空。**

- ~~run 成功结束之后退回「重新取的 checkpoint」~~ —— **wave 41 做完了。**
  `useThreadStream` 的 `onSettled` 在 `completed` 上重取一次，走新加的
  `runner.refreshDurableState`（`seedDurableState` 的 `idle` 判据会把这一帧**无声丢掉**
  ——run settle 之后状态停在 `completed`，永远不会自己回到 `idle`）。
  **三条不能省的判据**：① 不能复用 `seedDurableState`；② 也不能把它一起放宽
  （那道 `idle` 守的是「run 之前发出、run 之后落地」的那一帧，放进来会抹掉整个 run）；
  ③ 线程 id 取 `adoptedThreadId` 不取路由（`/chats/new` 提交后路由换得晚，
  run settle 时 `threadId.value` 还可能是 `null`，而首个回合最可能压缩）。
  **只在 `completed` 上做**，取消跟上游一样不刷，台账的请求多重集因此仍然齐平。
  **wave 38 记的 e2e 范本路径是错的**（`tests/e2e-backend/thread-summarized-checkpoint.spec.ts`
  不存在，真身是 `tests/e2e-real/summarized-checkpoint.spec.ts`），而且「需要专门造后端状态」
  只对一半——`e2e-real` 的 replay gateway 驱动不了一次真 run，**mock 后端的
  `tests/e2e/` 才能跑完整条流**，落点在 `chat-dataflow.spec.ts`。

- **上游种子取数失败会弹 toast**（`hooks.ts:1839`），本仓静默降级（S8 明写 403/404 属常态）。
  **这一条 wave 31 有意没动**：它不是「缺一层播报」，是 S8 写死的「403/404 属常态」，
  弹 toast 会在每次打开只读线程时报一次假故障。
  **wave 42 复核过这条引用，它是对的，机制比记的更准**：`hooks.ts:1839` 是**流**的
  `onError`，看起来像引错了——但 SDK 把 history 取数的错误接进了同一个回调
  （`useThreadHistory(client, threadId, historyLimit, { …, onError: options.onError })`），
  所以种子取失败时上游确实走到那里，而且除了 toast 还会**清掉乐观消息**。
  本仓静默那一侧在两半上都更好，**没有「只在一部分上更好」**（线索 163 撞过）。
- ~~`messages.*` 与 `browser.*` 的死条目~~ —— **wave 33 做完了**：连同
  `navigation.*` 那五条一共 **10 条**，全部删掉（953 → 943，再加命令面板两条 → 945）。
  **剩下的是共有块里的死条目**：要判准得先有类型感知的分析（wave 33 实测正则会误报
  122 条），那是一次工具投资而不是一轮平替，**先问它值不值**。
- **inputBox 下的 voiceInputStop 是上游自己也零消费的死条目**，有意留着，**不是缺 UI**。
- ~~chip 编辑区~~ —— **wave 33 做完了**（span + `aria-multiline` + `aria-placeholder`
  - `data-empty`/`data-placeholder` 的空态占位 + `tabindex`）。
    ~~只剩布局那两个类（`min-h-10 flex-1`）~~ —— **这条记错了，wave 45 翻案**：
    那两个类从 **wave 37（`7eea78f0`）** 起就从元素上去掉了（那一轮把 chip 行改成上游的
    行内可滚行），只有 `ChatComposer.vue` 的注释和这条账留在原地，**一挂八轮**。
    现在那个 span 的 class 里没有任何布局类，尺寸由外层容器给，与上游同形。
    **这一条已结清。**

### 剩余 18 条 unused 词条（**34 逐条撞过上游；35/36/38 各做掉四/二/二条**）

复量的做法：对每一条 unused key 问「上游用不用它」。**用 = 本仓少了一块 UI。**
26 条分三档：

- ~~5 条上游在用、本仓没有~~ —— **wave 35 处理完了**：四条是真缺口（已补），
  **`channels.connectedAs` 是记录写错了**——本仓早就在显示这个信息，只是形状不同
  （每条连接一行 vs 追加到 provider 说明里），**本仓这一侧对多账号更清楚，有意保留**。
- **若干条上游在用但本仓有意不做**（已各自记在上面）：`agents.saveRequested` 与
  `agents.agentCreatedPendingRefresh`（本仓用四态 + 行内错误表达同一件事）、
  `home.blog`（`components/landing/header.tsx`，落地页）与 `sidebar.demoChats`
  （静态整站模式那一支）——**这两条 wave 38 逐条撞过上游，确实在范围外**；
  同一批里的 `workspace.logout` 与 `login.orContinueWith` **归错了，wave 38 已做掉**
  （前者是掉线横幅的退出键、后者在登录页）。**成批归类的理由要逐条撞**（线索 160）。
  `uploads.uploading` / `uploads.uploadingFiles` / `toolCalls.skillInstallTooltip`
  （**wave 36 量完了**：`uploads.uploading` 与 `toolCalls.skillInstallTooltip` 是真缺口、
  已补；`uploads.uploadingFiles` **不是缺口**——上游边传边发所以要插一条乐观 AI 消息，
  本仓的上传发生在 composer 里、进度由 composer 自己的 `uploading` 态表达，
  **架构不同不是漏了一句话**）。
- **上游自己也零消费的死条目**：`settings.memory.rawJson`、`inputBox.voiceInputStop`、
  `common.preview`、`conversation.startConversation`、`scheduledTasks.preview` 等。

**注意 `make i18n-unused` 不能当「这处代码还在」的守卫**：叶子名撞车时它两边都看不见
（线索 153）。要钉代码就写代码守卫，范本
`tests/unit/i18n/success-announcements.test.ts`。

逐条 grep 时注意**扫描器按叶子名匹配，双向都会漏报**：不在 unused 里不等于有人用
（`inputBox.mode` 就是这样被埋了很久），而**写进注释就会被算成有人用**（线索 126）。
当前清单见 `baseline/i18n-keys.json`。

---

## 很省时间的调查手段

临时写 `frontend-vue/tests/e2e-parity/probe.spec.ts`，两个应用各开一个 fresh context
打开同一条路径，取 `body` 的 `ariaSnapshot()`，用 `normalizeAriaSnapshot` 归一后
`diffAriaLines` 比：

```bash
cd frontend-vue && PROBE_OUT=/tmp/p.json node scripts/with-loopback-no-proxy.mjs -- python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test -c playwright.parity.config.ts probe.spec.ts --workers=1 --reporter=line
```

- **必须在 `frontend-vue/` 目录下跑**（`with-loopback-no-proxy.mjs` 是模块内路径）。
- **`--workers=1` 不能省**：`test.afterAll` 写文件，多 worker 下模块级 results 收不齐。
- `captureScenario` 在 settle 之后还静置 700ms；probe 用 `waitForTimeout(5000)` 够稳。
- **顺手记三样**：`/api/` 请求序列、最终 URL（按 pathname + search 拆开比，线索 118）、
  以及 `document.activeElement`（线索 127）。三样各自都抓到过台账看不见的差异。
- `page.evaluate` 传字符串形式的函数不会执行，**要传真的函数**。
- **每测一种交互态换一个 fresh context**（线索 104）。
- **先想清楚这一屏在 `DEER_FLOW_AUTH_DISABLED=1` 下长什么样**：上游有整片路由
  （`(auth)/**`）在这种配置下**服务端直接跳走**，probe 量到的会是另一个页面。
- **提交前记得删掉 probe**（留着会让门禁条数对不上，`any` 会让 lint 红，
  删了不 `git add` 会让 `doc-references` 守卫假红）。
- 一次 probe ≈ 5 分钟（瓶颈是 React 侧的 `next build`），丢后台跑。

### 量「这一轮动没动 `frontend/`」

```bash
git log --format='%h %ci %s' --since=2026-08-25 -- frontend/src frontend/tests
node scripts/upstream-drift.mjs        # marker 之后上游/本仓有没有改动被监视的路径
```

**别传数字，跑命令。** wave 52 就是因为传了一个数字，把十四轮记成了三轮。

## 负向验证的做法

逐条变异 → **回读文件确认变异真的落地** → 只跑相关单测/e2e 文件 → 还原，
结果做成表格贴进提交说明。**假绿要如实写进去，连同成因。**
变异脚本跑完确认 `git status` 干净再提交。
只有对照门禁抓得到的那几条，要**真跑一遍 parity** 证实。
（macOS 的 BSD sed 不支持 `0,/pat/`，**退出码 0 但文件一个字节没改**；用 python harness。）
**锚点要按 prettier 格式化之后的样子写**：wave 28 有一条变异因为把三元写成一行而
锚点 0 次命中，脚本报了「变异没落地」——那一条如果没被脚本自己抓住，就是一条假绿。

## 其他常踩的坑（完整 270 条在记忆文件里）

- **给失败接一个兜底子句，等于把失败改写成成功**（线索 270，wave 107）。
  跑单测时写了 `… > /tmp/w107/unit.log 2>&1; echo "EXIT=$?" >> … || { mkdir -p /tmp/w107; }`
  ——目录当时还不存在，重定向失败、整条命令根本没跑，而那个 `||` 兜底把非零退出码
  吃掉了：后台任务报「completed (exit 0)」、日志是空文件、下游 `grep` 什么都没匹配到，
  于是「单测跑完了」是假的。冷启动文档里已有「重定向前先 `mkdir -p`」，
  这次踩的是它的变体。**判据：`||` / `; true` 只能接在「失败无所谓」的命令后面，
  不能接在被观测的命令后面。**

- **一条 e2e 断言钉在「应用本来就要离开的中间态」上，表现出来就是抖动**
  （wave 107，线索 237 的同一家）。`auth-contract.spec.ts` 的 `next` 落点写的是
  一个**线程路由**，而夹具里没有那个线程，工作区立刻把它换成 `/workspace/chats/new`；
  `expect.poll` 采样快就绿、机器忙就红。**判据：断言一个 URL / 一屏之前，
  先用探针量一遍它到底停不停得住**（`page.on("framenavigated")` + 定时采样，
  打印整条轨迹）；停不住就换一个停得住的落点，别把它加进抖动名单。

- **变异实验的还原，一律用备份文件逐个 `cp` 回去，不要用 `git checkout -- <目录>`**
  （线索 269，wave 106）。第 19 条变异要把全仓 9 份文件的「等 N 个」都拿掉，还原时
  图省事写了 `git checkout -- frontend-vue/app/core`——**它按 HEAD 还原，把本轮尚未
  提交的 `settings-query.ts` 一起冲掉了**（类型倒推 + 那段划掉的注释全没了），
  下一条命令的 `git status` 才看见。**在一棵有未提交改动的树上，`git checkout --`
  不是「还原变异」，是「回滚这一轮」。**

- **同一个「表把全集切成两半」的形状，可以不长成一张表**（线索 268 的补充，wave 106）。
  wave 105 筛 `scripts/` 时漏了 `gen-contract-constants.mjs`——那里没有
  `const CONTRACTS = [...]`，只有三行 `readContract("…")` 调用。
  **按形状找缺口不能只 grep 常量声明**，要问的是「这段代码凭什么认为自己盖全了」。

- **写文件的命令不要和长任务一起丢后台**（线索 259，wave 100）。
  改 `capture.ts` 的 python 块断言没匹配上，而整条命令（改文件 + 跑 6 分钟的对照）
  是一起丢后台的，**那条 traceback 从头到尾没人看见**；下游 `diffGeometry` 于是在比
  `undefined !== undefined`，报出一个**看起来很干净的「0 行」**。
  连着两次变异「没反应」才回头 `grep -c hit capture.ts`——一个都没有。
  **坑 208 的又一形态**：那次是 `cd` 失败而退出码是绿的，这次是后台吞掉了失败。
  **写完立刻回读确认**，或者把写文件与长任务拆成两条命令。

- **一个「几乎永远不会响」的字段，比没有这个字段更糟**（线索 258，wave 99）。
  层级那一档写完之后 73 个样本 0 行；按坑 249 去验那个 0——把一项挪出
  `DropdownMenuGroup`（两边都有这个 group，节点集合不变），**层级档一行都没有，
  而 `order` 档当场抓住了**。原因是序列化的树里「换爹」几乎必然同时「换位置」。
  **它造出的是「层级也比过了」的错觉**，所以整档撤掉、不留半点残余
  （留着就是一段零消费者的代码）。
  **判据：新加一档之前先问「有没有一种变异能让它响、而现有的档都不响」**——
  举不出来就别加。

- **过滤器要作用在「哪个文件」上，不是「这一行长什么样」**（线索 257，wave 98）。
  统计 `ai-elements/*` 有没有外部消费者时，先 `grep -rn "ai-elements/$base\""`
  再 `grep -v "/ai-elements/"` 想排掉目录内部的自引用——**而每一行 import 里都含
  `/ai-elements/`，于是信号本身被过滤光了**，28 份全报「外部引用 0」，
  正好「印证」了那条我本来就想验的错事实。按**文件路径**排除才对。
  与坑 213 一家：**一把尺子长期给出同一个（顺手的）答案，先怀疑尺子。**
- **一次正确的「两边同改」也可能让台账变长，那不是回归**（线索 256，wave 97）。
  给上游 ScrollArea 的 viewport 补 `tabIndex={0}` 之后，这一类从「本仓多 10 个」
  变成「上游多 34 个 + 8 行顺序」——**此前完全看不见的结构差异被露出来了**。
  **判据：先问「多出来的行是新坏的，还是本来就在、只是现在才量得到」**；
  后者要如实写进提交说明并挂上清单，不能因为「台账会变长」就把正确的修改撤掉。

- **stub 掉一个全局，别忘了它排出去的定时器**（线索 254，wave 96）。
  DOM 用例把 `requestAnimationFrame` stub 成 `setTimeout(cb, 16)`，
  `vi.unstubAllGlobals()` **只把全局换回去、已排队的那个 setTimeout 还在**；
  它触发时被唤醒的代码再调一次 rAF，而全局已经没有它了 →
  **用例全绿、退出码却是 1**（Uncaught Exception）。三次只红一次。
  **收口不能靠「记得 unmount」**（那三份用例 mount/unmount 是 1/0、6/3、1/0），
  要让 stub 自己记账、`cleanup()` 一律清掉。
- **新加一档尺子，先问「其中几行是别的档已经报过的」**（线索 255，wave 96）。
  tab 序那一档第一版带名字，114 行里 **~40 行是「上游写死英文」那一类在这一档的
  重复**（名字不同 → 同一颗键被当成两个不同的项），**8 行是空白文本节点造成的
  名字差异**（aria 档按可访问名比，根本没报它）。
  **判据：一档只回答一个问题。** tab 序回答「能不能 tab 到」，名字归 aria 档；
  把名字放进来等于让同一处差异在两档各记一次（坑 219 的同一件事）。

- **「文件头里的历史说明」不是「活断言」，别混着追**（线索 252，wave 95）。
  照文档去追「各文件头『实测过、做不到』的结论」，扫出 10 处，
  **多数是过去式**（「本仓**此前**……于是这件事做不到」讲的是修好之前）。
  真正「现在仍然做不到」的只有两三条，而且成立。
  **判据：先看时态与主语**——讲的是「此前的本仓」还是「现在的这套工具」。
- **一个 wrapper 照着它的兄弟抄，抄错的地方注释还会替它圆回来**（线索 253，wave 95）。
  `DropdownMenuSubContent` 照着 `DropdownMenuContent` 包了一层 Portal，
  而上游 shadcn **只给前者包**；文件头写的理由是「与 DropdownMenuContent 同样
  portal 到 body」——**读起来像是查过的，其实是抄的时候顺手写的**。
  后果是子菜单内容被挂到 body 末尾，与打开它的触发器在可访问性树里拆开。
  **判据：`ui/` 下成对的 wrapper（Content / SubContent、Menu / SubMenu）
  要逐个对着上游确认，别假设「同一族就同一种包法」。**

- **给「元素」做一句话描述时，要分清「这是哪个元素」和「它怎么声明的」**
  （线索 251，wave 94）。焦点描述器第一版把 `type` 与 `textContent` 一律取进来，
  17 行差异里 **10 行是它自己造的**：`button "X"` vs `button[button] "X"`
  是同一颗键（差的只是上游没写 `type="button"`）；`div "SettingsDeerFlow's…"` vs
  `div "Settings DeerFlow's…"` 是同一个没名字的容器（差的只是子节点间的空白文本节点，
  那是 aria 树该管的）。**判据：描述里只放「认出它是谁」需要的东西**——
  标签、名字，以及只有 `input` 才取的 `type`。

- **要验证一个「0」，变异必须绕开锚点**（线索 249，wave 93）。改菜单项的文案去验
  「这个 0 是算出来的吗」，红是红了，但红在**锚点**上（`/^PNG$/` 不匹配了），
  台账那一格根本没跑到——**那不是对 0 的验证**。换成「多加一项、锚点全不碰」，
  那个键才真的从 `[]` 变成一行。wave 92 的 N3 也踩过同一条。
- **别把带构建哈希的文件名写进注释**（线索 250，wave 93）。
  引用 `streamdown` 发布产物时写了 `chunk-XXXXXXXX.js`，`doc-references` 当场红
  （`node_modules` 不在 checkout 里，那条守卫按「文件名搜得到」判）。
  **更要紧的是那个名字下次装依赖就变了**——守卫挡住的是一个必然过期的引用。
  引用第三方产物写**包名 + 里面那段行为**，不写文件名。

- **批量加维度/加场景，先拿可达性层探路，别直接跑 diff**（线索 247，wave 92）。
  一次给 19 个场景补 zh-CN，10 个当场到不了；`diff.spec.ts` 是**一条**用例跑完
  所有样本、总预算 600 秒，一个坏锚点卡 30 秒，10 个就把它拖垮，
  而且报错是 context 被拆时的假象（坑 214 的同一件事）。
  `scenarios.spec.ts` 是**一个键一条用例、各自计时**，坏锚点逐个点名。
  三轮 10 → 7 → 3 → 0。
- **一整类「已决定不改」的差异，该进台账还是该进文档？看有没有机器读它**
  （线索 248，wave 92）。28 行「上游写死英文、本仓翻译了」进了台账，
  理由是 `diff.spec.ts` 的整棵深比**就是这一类的守卫**——多一条、少一条、
  或译文改一个字都会红（实测）。写进文档则零消费者（坑 183/225 那一类）。
  **代价要说清楚：「台账 0 行」这个目标从此不成立**，规则改成
  「**新出现、还没定过的行只能减不能增**」，已决定的行在一页纸清单里有名有姓。

- **只跑一种语言的场景，等于把「翻译分叉」整类排除在取样之外**（线索 244，wave 91）。
  `branch-thread` 此前只有 en-US 一维，而两个应用的分支键取的是**不同的词典键**
  （上游 `common.branch`，本仓 `messages.actions.branch`）——en-US 下两条恰好
  都是 "Branch conversation"，zh-CN 下一个是「分叉」一个是「创建对话分支」。
  **加一维比加一个场景便宜得多，而且不动棘轮。**
- **portal 出去的 `position: fixed` 浮层，绝对坐标不能比**（线索 245，wave 91）。
  `sampleGeometry` 靠「把祖先链的 scrollTop 加回去」得到文档坐标，而浮层的祖先
  只有 body/html（scrollTop 恒 0），于是量到的 y 里**原样带着触发器所在容器的滚动**。
  实测：分支键文档坐标两边都是 y=208，视口坐标 React=148 / Vue=207。
  **要量就量触发器**（普通在流元素），它同样能证明浮层开了
  （`[data-slot="tooltip-trigger"][data-state="delayed-open"]`）。
  顺带：`[role=tooltip]` 不能当锚点——Radix 与 Reka 都把它挂在 1×1、
  `clip: rect(0,0,0,0)` 的隐藏播报节点上，等它「可见」会 30 秒超时。
- **一个「间歇地量错」的锚点比「稳定地量错」更难查**（线索 246，wave 91）。
  换掉浮层锚点之后做负向验证，把锚点换回去**没能复现**那 5 行几何差异——
  同一棵树、同一个锚点，一次 `Δ44/Δ48`、一次 0。假绿如实记下来，
  而换锚点的依据改成直接读数（文档坐标 vs 视口坐标 + 两边的 scrollTop）。

- **两边没有共用 testid 时，先去夹具里找字符串**（线索 242，wave 90）。
  `channels` 侧栏一屏好几颗一模一样的 "Connect"，两个应用又没有共用的 testid，
  这一处因此挂了好几轮。真正的坐标在**夹具自己给的 `display_name`**——
  它不进词典，两种语言下逐字相同，而且两个应用拿到的是同一份响应。
  `[data-sidebar="menu-item"]:has-text("Feishu") button` 一次就成。
  对话框里的字段标签 `Token` 同理，连跨语言正则都省了。
- **复核锚点要用与门禁同一套定位引擎**（线索 243，wave 90）。
  探针想在 `page.evaluate` 里 `document.querySelectorAll(TRIGGER)` 复核触发器，
  而 `:has-text()` 是 **Playwright 的 CSS 扩展、原生 DOM 不认**，当场抛错——
  看起来像「锚点不成立」，实际是复核工具用错了引擎。

- **朴素的 `<Tag ...>` 正则会在属性值里的 `>` 上把标签切断，而错的方向由属性顺序
  决定**（线索 241，wave 89）。`/<Button\b[^>]*>/` 碰上
  `onClick={() => setX("a")}` 只切出 `<Button onClick={() =>`：
  写在后面的 `aria-pressed` 看不见 → **12 条假报**（噪，看得见）；
  写在后面的 `variant` 也看不见 → 那颗按钮**连「是不是开关」都判不出来，静默跳过**
  （看不见）。**扫标签要按字符走，跟踪引号与 `{}` 深度。**
  与线索 230（正则剥注释不认字符串）是同一件事的另一面。

- **「台账 0 行」只说明两个应用一致，不说明那一处是对的**（线索 238，wave 88）。
  22 颗权限域按钮 + 2 颗品牌按钮，两个应用**都**只用换色表达选中、
  `aria-pressed` 一处都没有——对照的三档（aria / 几何 / 请求）全是 0，
  而读屏器听到的是 22 颗一模一样的按钮。**双向比对天生看不见「两边一起漏」**，
  所以每接上一块新表面，都要另问一句「这一块本身对不对」，
  并把答案钉在**各自**的用例里（这里是 Vue 两条 DOM 单测 + React 六条 e2e 断言）。
- **一个「跳过」的工具和一个「查过、干净」的工具，输出可以长得几乎一样**（线索 239，
  wave 88）。`node frontend-vue/scripts/icon-parity.mjs` 从**仓库根**跑时，
  它按 `process.cwd()` 找 `../frontend/src`、找不到，打一句「跳过」然后 **exit 0**；
  收工清单上那一行「0 处待核」看起来照样成立。**用 `make -C … icon-parity` 跑**，
  并且**读输出**，不要只读退出码。（这一条与坑 226 同形，区别是它至少打了那句话。）
- **`until grep -qE "passed|failed"` 会被 `bypassed` 骗到**（线索 240，wave 88）。
  Gateway 启动横幅里那句 `authentication is bypassed` 含子串 `passed`，
  于是等待循环在测试**一条都还没跑**的时候就退出了，紧接着读到的「读数」是空的。
  **等 Playwright 收工要锚在行首**：`^ *[0-9]+ (passed|failed)`；
  更稳的是自己在命令末尾追加一行 `echo "EXIT=$?"` 再等 `^EXIT=`。

- **别拿一次输入去赌一个动着的界面**（线索 237，wave 87；wave 86 那两处 drag
  助手是同族）。`page.mouse.wheel` 只发**一个**事件，而流式期间应用每收到一个
  delta 就把列表拉回底部——那一个滚轮落在两次程序化滚动之间才留得下来。
  实测同一棵树 **6 次红 2 次**。修法是「滚到它真的动为止」（每次 poll 再发一个），
  **契约不放宽**：真正被测的那一半在后面（后续 delta 到了仍然不把它抢回底部）。
  同一轮还学到：**归因要一路查到「被改的东西真的被执行了吗」**——
  那条 spec 里根本没有 workspace changes，被改的组件一次都没渲染，
  所以「删掉那个 watch」只是顺手删对了一件事，不是原因。

- **一个锚点加进来之前，先问它在这个场景的每一个维度上都成立吗**（线索 234，wave 86）。
  `scheduled-tasks` 有 **en-US 与 zh-CN 两个语言维度**，而按可访问名找的锚点
  天生只在一种语言下成立：en-US 过、zh-CN 当场 30 秒超时。
  两边没有共用的 testid 时，名字写成覆盖两种语言的正则；内层锚点优先用
  两边逐字相同的 `data-testid`。
- **照着词典 key 猜锚点，会猜到一条从来没被渲染过的 key 上**（线索 235，wave 86）。
  `fields.timezone` 在两个应用的 schedule input 里都只是个 Select 的值，
  标签根本没画出来，于是 `text: "Timezone"` 两边都到不了——
  报出来是「Vue 没能到达场景」，看着像产品缺陷。**锚点自己先量一遍。**
- **「形状看着像上一次那处」不等于「同一处差异」**（线索 236，wave 86）。
  侧栏 nav 菜单的 `align` / `side` / 圆角三处都与上游不同，长得和 wave 78
  修过的那处一模一样——而几何量出来是 **0 差异**（碰撞翻转把它们抵消了），
  真正的差异在别处（少一个 group + 上游的嵌套 link）。
  **照着形状去改会改出一个真差异来。先量再改。**

- **「只能缩短」这类单调性判据，要按「集合包含」判，不能按数量判**（线索 232，wave 85）。
  修好一条、同时新坏一条，**行数不变**——按行数判会放行，而台账里多了一行
  没人看过的东西。判据写成 `next 里有、previous 里没有的行`，
  连带把「同一行挪到别的场景键/字段下」也算成新增（那确实是另一处差异）。
- **只在罕见状态下才走到的分支，等于一段没人验过的代码**（线索 233，wave 85）。
  `parity-accept` 的「台账将要变长」分支，在台账是 0 行时**永远走不到**——
  跑真的 accept 验不了它。**修法是把判据抽成纯函数放进单测**
  （`support/ledger.ts` + `tests/unit/parity/ledger.test.ts`），
  而不是留在 spec 里等某天有人正好撞上那个状态。
  这和坑 194「一条长期红着、又不在任何门禁清单里的 gate 等于不存在」是同一件事的
  另一半：**跑不到的分支和没人跑的门禁，可靠性是一样的。**

- **一张白名单出发的扫描器，加一个白名单外的文件就能全绿溜过去**（线索 229，wave 84）。
  `app/error.vue` 塞四条硬编码英文，`i18n-source-check` / `i18n-check` /
  `source-guard.test.ts` / `doc-facts.test.ts` **四道全绿**——`checked` 是 217，
  它不在里面，所以 `toHaveLength(217)` 一动不动。
  **判据：扫描器要能自证盖全**——返回一个 `unscanned` 并断言它恒为空，
  而不是只断言「扫到的那些干净」。坑 186 的又一次，这次是本仓的产品面门禁。
- **正则剥注释不认字符串，一个 `"/workspace/**"` 就能开出假注释**（线索 230，wave 84）。
  `file-header-claims` 的 `source.replace(/\/\*[\s\S]*?\*\//g, "")` 在
  `config/routes.ts` 上一口吃掉 **1886 个字符**，连 `export function buildProxyRules`
  一起。扫描面内 **8 份**文件的字符串里带 `/*`。
  **两个方向不对称**：靠「点名的必须存在」那一半会误报（吵，看得见），
  靠「数 import」那一半**静默放过**。修法是用按字符走、跟踪引号与转义的那份
  （`scripts/lib/strip-comments.mjs`）。**扩扫描面最先量到的是尺子自己**（线索 213）。
- **一条已经被诊断并修好的坑，在另一个文件里照样是新的**（线索 231，wave 84）。
  `git ls-files` 看不见未跟踪文件这件事，`standalone-check.mjs` 的注释里写得清清楚楚
  （「本脚本自己就踩过一次」），而 `architecture.test.ts` 与
  `file-header-claims.test.ts` 三处一直开着——**修好的是那一处，不是那一类**。
  抽成共享库比在第二处重新发现它便宜。**判据：修完一条坑，grep 一遍同形的写法。**

- **`describe.skipIf(cond)` 跳过的是「用例」，不是「收集」**（线索 225，wave 83）。
  工厂函数照样执行一次，所以工厂里那句读兄弟应用的 `readFileSync` 在缺席时照样跑，
  ENOENT 让整个文件报「Failed Suite / 0 test」，`make verify` 当场红。
  **正确写法是把读放进 `it()`，或者像 `upstream-zero-claims` 那样
  `present ? walk(...) : []` 自己挡一下。**
  这条挂了几十轮没人知道，因为**没有任何门禁真的在缺席状态下跑过**。
- **「缺席时跳过」如果是函数体里 `return`，报表上和「查过、干净」逐字相同**
  （线索 226，wave 83）。`doc-references.test.ts` 三条用例这么写，
  `make standalone-sim` 报出来是「12 过 / **0 跳过**」——而表里声明的是
  「那一条用例跳过」。**跳过要用 `it.skipIf`，让它在报表上真的显示为跳过**；
  取数函数则**不要返回 null**——真少了东西就该炸，别安静地返回。
  （线索 176 的又一例，这次踩它的是本仓自己的守卫。）
- **`run_in_background: true` 又加 `nohup … &` 会立刻收到一条「completed (exit 0)」**
  （线索 227，wave 83）。被追踪的是外层 shell，它 fork 完就退了；
  真活还在后台跑，日志停在半路。**两者选一个**：要么让 harness 追踪真命令，
  要么自己 poll 进程，别信那条通知。
- **zsh 里 `${PIPESTATUS[0]}` 是空的**（zsh 用 `$pipestatus[1]`），
  而 `cmd | head` 之后的 `$?` 是 **head 的**（线索 228，wave 83 连踩两次：
  一次把两个脚本的退出码读成空，一次把一条本该 exit 1 的负向验证读成 0）。
  **量退出码就不要接管道**：`cmd > file 2>&1; echo $?`。

- **`git checkout -- <file>` 还原的是 HEAD，不是「变异之前」**（线索 207，wave 72）。
  负向验证的还原步骤一旦用它，**整轮的改动会跟着一起没**，而报表看起来照样是绿的
  （那些测试本来就该在改动前是绿的）。修法：变异前 `cp` 一份备份，还原时 `cp` 回来
  再 `diff -q` 确认。
- **`cd X && <整条链>`：`cd` 失败时后面一条都不跑，而整条链的退出码看起来是绿的**
  （线索 208，wave 72 连踩两次）。这台机器上工具调用之间 cwd 会被重置，
  `cd frontend-vue` 在已经身处该目录时**会失败**。**判据：写文件的命令必须自己
  打印一句确认（`print("WROTE-OK", ...)`），而且要真的去看那句有没有出现。**
  wave 72 有一条 DOM 测试两次都以为加上了，实际一次都没写进去——
  同一次输出里 vitest 报的「17 passed」是**改动之前**的条数。
- **探针的取样点必须与它要佐证的那个门禁同一个点**（线索 191 的同一条，wave 72 重演）。
  parity 探针第一版没等 `settleMs=700`，于是 React 的异步面板还没挂上，
  一次报出「Vue 多 4 颗控件」「每颗导航键 svg 15×15 vs 16×16」等一整批**假差异**。
  补上等待之后全部消失。
- **一个「按全仓集合比」的门禁，看不见「某一处少了一颗」**（wave 72）。
  `icon-parity` 比的是两边用到的图标名集合；把 `BellIcon` 从通知设置那两颗键上删掉，
  Bell 在别处还用着，集合一点没变、它一声不吭。**集合口径挡不住分布问题。**
- **`InputGroupButton` 的 sm ≠ shadcn `Button` 的 sm**（wave 72）。
  前者 `h-8 px-2.5 gap-1.5`，后者 `h-8 px-3 gap-1.5`——**水平内边距差 2px**，
  而且 `shadow-none` 只在 InputGroupButton 的 base 里。上游 composer 那一排走的是
  前者，本仓走 `<Button size="sm">` 时这两条要显式补。
  另外 `InputGroupButton` **不把 size 透给 Button**，于是 Button 用的是 default 档，
  `py-2` 会留在类串里——探针上表现为「React padding 8px 8px、本仓 0px 8px」，
  但两边 `h-8` 固定、内容居中，**这一条没有视觉差异，不要去追**。
- **给一把尺子加取样点，先问「这个点到取样时还在吗」**（线索 214，wave 76）。
  `steps` 里的 `visible` 锚点到取样时可能已经被后续步骤换掉，
  而 `locator.evaluate` 的 auto-wait 用的是**默认 30 秒**：加了 20 个锚点之后
  diff 用例从 4 分钟变成 10 分钟超时，**报错是 context 被拆时的
  `page.route: Target page ... has been closed`——完全看不出真正的原因**。
  修法是每个锚点一个短超时（2s）+ 两边都取不到就跳过。
- **`sed -i` / 写文件之前，别把 `cd` 放在 `&&` 链的开头**（线索 208 第三次踩）。
  `cd frontend-vue && sed ... && nohup ... & echo started`——`cd` 失败时
  整条链一步都不跑，而 `echo started` 照样打印。**写文件一律用绝对路径，
  并让命令自己回读一次确认。**
- **一把尺子长期报同一批线索，先怀疑尺子**（线索 213，wave 75）。
  `icon-parity` 的字形档从 wave 69 挂着十几条，每一轮重读一遍、每一轮同样的结论。
  逐条核完发现**将近一半是扫描范围造出来的**：只扫 `components/`（`core/` 里的
  图标表看不见）、只收 `.tsx`/`.vue`（两边都把图标表放在 `.ts` 里）、
  map 按 basename 存（同名文件**静默覆盖**，React 侧 409 份只剩 267 个 key）。
  **判据：一条线索连着三轮得出同样的「不是差异」，那多半不是线索，是口径。**
- **核完的线索要写进尺子，不要写进文档**（wave 75）。
  写进文档，下一轮还是得把整份清单重读一遍；写进脚本的 `VERIFIED` 表并做成
  **双向**（某条不再出现就报 stale），报告才只列没核过的。
  这是线索 194「长期红着等于没有」的正解。
- **一个写错的 import 长得和写对的一模一样**（线索 212，wave 74）。
  上游两处 `<Toaster />` 写的是 `from "sonner"` 而不是 `from "@/components/ui/sonner"`，
  于是 shadcn 那份 wrapper **零消费者**：主题绑定、颜色 token、五颗 lucide 图标全落空
  ——**深色主题下 toast 一直是白的**。而 toast 照样出现、照样有图标、照样念得对，
  **没有任何东西指向 wrapper 是死的**。这是线索 183 的运行时版本：
  一栏零消费者的元数据写错了没有征兆，一份零消费者的 wrapper 同理。
  **判据：`ui/` 下的 wrapper 都要问一句「谁 import 它」——`grep components/ui/<name>`
  返回空，就是它。**
- **探针拿不到东西时，先问「我这一步真的生效了吗」，别先改断言**（wave 74）。
  `page.route` **后注册的优先**：把路由覆盖写在 `runScenario` 之前，场景自己的 mock
  会赢，而点击**不报错**（它成功了，只是没触发那条分支），两边一起读到空。
  同一轮还证实：**触发一条真 toast，用上游与本仓 e2e 里已有的那条路径最稳**
  （`scheduled-tasks` + PATCH 打成 409 一次就成；走 artifact 复制键的那版 10 分钟超时）。
- **一条用「另一处缺陷」当论据的取舍，在那处缺陷修掉之后要重新过一遍**
  （线索 211，wave 73）。toaster 把 `warning` 折进 `info` 的理由写在文件头里：
  「两档在可访问性上同一档，区别只有图标，而这个 toaster 一个图标都不画」。
  **前半句对，后半句是本仓自己的缺陷。** 补上图标之后那条取舍当场失效，
  而没有任何门禁会因此变红——它是一条散文里的因果链。
  **判据：写下「因为 X，所以这里可以不做 Y」时，把 X 也记成一笔账。**
- **「本仓修掉了上游的缺陷」不是一种要挂着的状态**（wave 73）。
  判据已经定死：**按业界主流做法两边同改**（改 `frontend/` + 单独 chore 提交 +
  `upstream-accept`），而不是「与上游一致」。`ARCHITECTURE.md` 的双向规则管的是
  **产品面的有无**，管不了「上游那一处是不是坏的」。
  反过来也要问一句「这处不改，React 自己是不是也是坏的？」——**否**的时候
  （例：sonner 默认不给 toast 关闭键）就走双向规则的另一半，把本仓多出来的删掉。
- **React 的 `test:e2e` 用 3002，不用 3000**（wave 73）。本机 3000 常被占；
  绕法是先自己 `next build`，起 `npx next start -p 3002`，再
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3002 npx playwright test`。
  跑完 `lsof -ti tcp:3002 | xargs kill`。
- **`route-payload` 越线时先看是字节还是文件数**（wave 73）。
  字节全在预算内、只有 prefetch 的 **files** 超了，说明 Rollup 多切了几个 chunk，
  不是用户多下了流量。**抬文件数、不动字节预算**，并在 `$measured` 里写清哪一半没动。
- **`artifact panel` 那张视觉基线的抖动振幅比记的大得多**（wave 73 复量）。
  历轮实测 855/815 → 258/167 → **1807/1902**，**不是「±40px」**——
  它随基线录在哪个相位而定，diff 图上是整条消息列的文字上下平移。
  容差 0.01（≈9,216 px）之下一直是绿的。**遇到它先看 diff 图**：
  只有文字平移、结构没变，就是它。
- **新增 Vue SFC 要同步三个数字**：`I18N_INVENTORY.md` 的「共有 N 个 Vue SFC」与
  「N 个产品 SFC」（**219 / 217**）、`tests/unit/i18n/source-guard.test.ts` 的
  `toHaveLength(217)`。`tests/guards/doc-facts.test.ts` 把 key 数与 unused 数对死
  （**942 / 18**）——改 i18n 后跑 `make i18n-refresh`，`I18N_INVENTORY.md` 里那句
  「N 个已审阅 unused key」也要一起改。
  **这三个数字 wave 77 复核时全是过期的**（写着 217/215、`toHaveLength(215)`、945/18），
  而 `doc-facts` 只对死 I18N_INVENTORY 与基线、**不看这份交接文档**——
  线索 179 的又一例：**不承重的数字写在散文里必然过期，抄之前先量一遍**。
- **新增 L2 组件要加进 `tests/architecture.test.ts` 的 `l2Files` 允许清单**
  （要有 `【架构位置】 L2` 头、不许 import 产品层——`@/composables`、`#app`、`#imports`
  都是禁的，所以 L2 primitive 不能自己取 i18n，标签由调用点传）。清单按字母序。
- **动 `app/components/ui/` 下任何东西之前，先 grep 出全部消费者**——共享组件会把
  上游两个调用点之间的分叉**静默**抹平。
- **门禁清单不是全集。** 改了哪个域就把 `make help` 里相关的都跑一遍。
- **裸 `getByRole()` / `getByText()` 在长页面上是定时炸弹**（strict violation）。
  修法是 `data-testid` 或 `.first()`，不要给定位器加文本过滤。
- **「测试红了」的第一步永远是分「用例过期」还是「产品回归」**，两者修法相反。
- **首屏预算**：`tests/e2e/route-payload.spec.ts` 因新增组件变红时，直接把
  `baseline/route-payload-budget.json` 对应路由的数字抬到实测值以上继续走，
  提交说明里提一句抬了多少。**但 `criticalPathForbidden` 仍然守着**
  （katex / shiki / mermaid 的本体特征串不许进 critical ∪ prefetch）。
- **后台跑长命令时不要用 `| tail`**——管道会缓冲到命令结束。直接 `> file 2>&1`。
  等它的时候**不要 `grep -q 'passed'`**：Gateway 那句
  `authentication is bypassed` 里就有 "passed"，等待循环会立刻退出，
  看起来像「命令秒完成」。写成 `grep -aqE '^ +[0-9]+ (passed|failed)'`（线索 132）。
- **baseline 里每加一个字段，先问「哪一行代码读它」。** `$pendingReasons` 挂了十几轮
  没有任何消费者，删掉一条理由不会让任何门禁变红（线索 131；wave 29 补了守卫）。
- **几何容差 `GEOMETRY_TOLERANCE_PX = 2` 在 `diff.spec.ts:76`，不要动。**（wave 42 复核：
  文件长了，原来记的 66 行已经漂了——**行号也要当假设撞**，线索 167。）
- **同一时刻只能有一个后台门禁任务**（Nuxt 构建锁，线索 120）。
- **`sampleGeometry` 只量 settle 里的 `visible` 锚点，而 settle 跑在 steps 之前**——
  所以**靠交互才出现的东西，位置永远进不了台账**，只能单测守（线索 137）。
- **注释里带点写一条死词条会把它从 unused 集里弄没**（线索 126）。要写成
  「container 下的 leafName」，改完跑 `make i18n-unused` 核对。
- **一条「有意保留」的账，越老越可能已经被别人修掉了**（线索 187）。
  wave 62 拿 wave 29 记的竞态去复现，同一条账里另外两句确实过期。
  **复现优先于修复**：先花五分钟量一遍，比照着账改代码省一整轮。
  **mock 复现不了的要回到当初观测它的环境**，而且 replay Gateway 上**提示词要用
  录制里的原句**——换一句会 replay miss，量到的不是那一屏。
  **竞态类的账要记「怎么复现」，不要只记「什么现象」。**
- **「按名字聚合」的预算，名字来自哪一个模块决定了它有多不像话**（线索 193，wave 66）。
  `vendor-ui` 的种子里有 `lucide/cva/clsx/tailwind-merge`——几乎每个组件都 import，
  于是任何产品 chunk 只要碰过一个图标就被叫成 vendor-ui，最大的两个（320/192 KB）
  **一个匹配包都不含**。收窄种子只能减少误标（24→10），**「按 chunk 名字做字节归属」
  本身做不到**：Rollup 把 vendor 与产品代码 co-locate，名字只取自其中一个模块。
  **正确做法是把注释里那个做不到的承诺删掉**，而不是继续抬数字或去拆包——
  真正量用户下载什么的是 `route-payload-budget.json`，两条没有对应关系。
- **一条长期红着、又不在任何门禁清单里的 gate，等于不存在**（线索 194，wave 66）。
  `asset-budget` 的预算定于 2026-08-25，之后 UI 一路加，它就一直红着；
  `audit` 同理。**收工清单里没有的门禁，红多久都没人知道。**
- **一个「看起来像架构不支持」的错，先查依赖版本**（线索 192，wave 64 补）。
  `coverageFilesDirectory is required` 出现在每个 worker 上、三个 project 全一样、
  summary 是 `0/14384`——**长得像「这套配置不支持覆盖率」，实际是 provider 装了
  大版本 5 配 vitest 4**。裸 `pnpm add` 默认抓 latest，这类错会被伪装成架构问题。
  **判据：报错来自工具链内部断言（不是你的代码）+ 全环境一致复现 → 先对版本。**
  修法是把成组依赖的 range 钉成逐字相同（不钉版本号，那会让每次升级都要改守卫）。
- **但「复现不出来」要先问「我量的是不是它量的那个点」**（线索 191，wave 63 补）。
  wave 62 据此宣布竞态「已经没有了」——**说过头了**：它等了 30 秒才读，
  而棘轮在 `settleMs=700` 就取样。**换个取样点重测，两个终态原样还在（19 B / 4 A）。**
  一个「等久一点就好了」的现象，对**等不了那么久的那个消费者**来说仍然是缺陷。
  **判据里写死的那个观测点，就是复现时必须照抄的那个点。**
- **顺手加一条普查，往往比正题更值钱**（线索 188）。wave 62 的探针本来只为复现竞态，
  顺手加了「还有哪些交互控件没有可访问名」，一次跑出三颗真缺陷、两个应用都有。
  **`tooltip` 不是可访问名**（Radix / Reka 都挂 `aria-describedby`）。
  **最值钱的一半**：本仓两个文件头写着「不给可访问名，因为上游只有图标和 tooltip」
  ——**对上游的描述完全准确，照抄的却是缺陷**。**「与上游一致」不是正确性论据**，
  还要问「上游那处对吗」。
- **「引一个库不划算」的正确结论常常是「移植那段算法」**（线索 189）。
  `command-score` 只有 60 行；移植进来与 `cmdk@1.1.1` 实测 950 组逐值差 0。
  **等价性比对不能签入**（要 require `../frontend/node_modules`，撞
  `standalone-check`），**留存方式是把真实现算出来的值当定值签进单测**。
- **测排序的用例，输入序必须与期望序不同，否则删掉 `sort()` 照样绿**（线索 190）。
  同轮还撞到一次无效变异（空查询短路——所有分数都是 0.99，删掉它产出不变），
  **而它顺带证伪了我自己刚写下的那句理由**。
  **变异跑出假绿时先别急着补用例：先看被删的那段到底保证了什么，
  它旁边那句注释可能一起错了。**
- **只从白名单出发的门禁，看不见「自称是、但没上名单」的那些**（线索 186）。
  `architecture.test.ts` 的两条 L2 断言都遍历 `l2Files`，于是 30 份自称 L2 的文件
  三周里一直不受进口边界约束，其中一份（`app/core/auth/logout.ts`）一跑就违规。
  **凡是「清单 + 逐条检查」的门禁，都要再问一句：清单本身谁在维护？**
  修法是让清单**可推导**（实测集合 == 清单，双向），再给它一条顺序断言，
  让插入位置唯一——顺序对这份清单没有语义，但没有顺序规则，下一个人只会往末尾追加。
- **「跑出来少了几条」和「红了几条」是两回事**（wave 69）。负向验证时单边替换
  一个开标签，SFC 编译不过，**整个测试文件不加载**——报表上是「8 passed」，
  看起来像绿的，实际是那个文件的 8 条根本没跑。**变异必须保持文件可编译**，
  并且核对总条数有没有变。
- **「上游那边有、本仓没有」不等于本仓缺功能**（wave 69）。`core/api/feedback.ts`
  零消费者，看着像少了点赞点踩；实测**上游那套 UI 也从来不渲染**
  （没有一处传 `feedback={...}`，而渲染条件是 `feedback !== undefined`）。
  **先问「上游那边真的活着吗」，再问「本仓少了吗」。**
- **一把新尺子最先要量的是它自己**（线索 186~188，wave 68 一轮踩了三次；
  wave 69 的 `icon-parity` 又五次）。wave 69 那五次分别是：正则漏掉 `size-3.5`
  的小数点（14px 报成 12px，**三条线索里两条是假的**）、只比同名图标（名字不同
  就完全看不见，而这正是要找的那一类）、拿「写了尺寸的」当「用没用过」、
  按文件问「有没有这颗」（两边组件切分方式不同，全是噪声）、
  把 `DialogPrimitive` 这类非图标也算进来。
  **收口原则：尺寸按文件比，字形按全仓比；名字先解析成规范名再比。**
  几何档加进 `dom-parity` 的当轮：① 不报「连上了几个元素」，于是三个完全不同的
  页面都「连上 7 个」这种事没人看得见；② `waitUntil: "networkidle"` 在开发服务器上
  永不成立，超时后 catch 里**静默返回空数据**，印出来的「差异 0 处」和「量过、
  确实一样」逐字相同；③ 不校验落地 URL，两边都跳登录页时**拍到的是同一张页面**，
  0 差异是白送的。**判据：任何输出 0 的工具，都要能回答「这个 0 是算出来的、
  还是没算」**——这是线索 176 的同一条，只是这次踩它的是我自己刚写的工具。
- **拿「可见文字」当断言，可能是把落差写进合同**（wave 68）。两条老用例钉
  `button.text()` 等于「优化输入」，而上游那颗键三态都只有一颗图标——那段文字
  本身就是差异。图标按钮钉**可访问名 + 图标类名**，不钉可见文字。
  同理，钉「含换行缩进的源码子串」钉的是格式不是语义，包一层组件就会假红。
- **视觉基线的容差地板会静默吃掉真实改动**（wave 68）。`maxDiffPixelRatio: 0.01`
  之下，九张里八张都变了却全绿。**留着不录 = 把容差预算花在一次已经发生的改动上**，
  下一次回归的余量就少了。量法：把容差**临时压到 0** 再 `--update-snapshots`，
  并**跑两遍**分清「稳定 = 我改的」与「每次不同 = 固有抖动」。
  **别用 `-u all`**：它无条件重写，字节差里混着 PNG 编码噪声，不构成「变了」的证据。
- **翻案判据写太松，会被毫不相干的东西误触发，和写错一样坏**（线索 182）。
  好判据要能把「该翻」和「不该翻」分开——as-child 那条收紧成两条 grep 的**交集**才够。
- **一栏「零消费者」的元数据，写错了不会有任何征兆——它长得和写对的一模一样**
  （线索 183）。`【主要导出】` 478 份文件写着它，零代码读它，七处点名的符号
  在 checkout 里只剩自己那一行。**判「有没有人读」用 grep 剥掉自身头注释之后再看**，
  别看「有多少文件写着它」。
- **同一份文件里，散文和机器断言打起来时，信机器**（线索 184）。
  `reducer.test.ts` 的 describe 标题说「录制不产生这些帧」，90 行之外的
  `expect(byName).toEqual({... updates: 50, values: 13 ...})` 一直在说反话。
  **线索 181 的升级版：那次是两句散文，这次一边是断言，冲突的一刻就该结束了。**
- **一段「批量补文件头 / 批量对齐文档」的提交，是这一类错误的产地**（线索 185）。
  `fa2cde27` 一次给几十份文件补头，七个幽灵名里五个出自它；
  `c6fc60b4` 的提交说明写着「make every documented command and path real, and gate it」，
  同一次落下的 `清单` 在 **12 小时 46 分钟前**就已经不存在了。
  **翻这类提交时不要按「后来漂了吗」查，要按「当天就对吗」查。**
- **先在本仓内部找「自相矛盾的两句」，比拿去撞上游更快**（线索 181）。
  冲突时**信带日期的实测标注**，不信不带日期的断言。
  **结论对、理由错比两者都错更危险**：结论让人以为这条验过了。
- **「账记对了」不等于「那处改掉了」**（线索 180）。交接文档在 wave 41 记下
  「那条 e2e 路径是错的」，而代码里那行注释又挂了十三轮——**记录与被记录的东西
  是两份，改一份不会改另一份**。翻旧账时要问的是「那处真的改了吗」，不是「记了吗」。
- **引用上游的一个「值」（行数、class 串、常量）会随上游前进静默过期**（线索 179）。
  `文件:行号` 允许漂几行，**「N 行」不允许**——它是关于整份文件的精确断言。
  **不承重的数字干脆别写。** 另：`git log -- <path>` 默认做历史简化，
  **合并进来的上游改动看不见**，查这类过期要 `--full-history`。
- **散文里「谁在引我 / 谁是唯一消费者」这类话，写下当天就可能过期**（线索 178）。
  `react-parity-scope.json` 那句 30 分钟后就错了。**改成数据 + 门禁比对**，
  而且口径要选**能量准**的那个（「引用」可以，「读取」要靠正则猜行）。
- **一条「证据在那边」的指路比一条说错的事实更难发现**：它不含任何可判真假的断言，
  只含一个文件名（线索 177）。而**守卫的覆盖面要按半边分开问**——
  `doc-references` 的 make target 那半扫全部文本文件，路径那半只扫 Markdown、
  还要求带目录前缀，模块根上的裸文件名两半都漏。

## 背景在哪

- 每一轮的实测记录与踩坑线索：Claude 记忆 `deerflow-parity-harness-plan`
  （**条数只在上面那一节写一处**——同一个数字写三处，就会像 wave 56 撞见的那样，
  改两处漏一处）
- 判据与踩过的坑写在各文件头注释里，**不要跳过**：
  `frontend-vue/tests/e2e-parity/support/{capture,scenarios,react-preview,context-options,fixture-thread}.ts`、
  `frontend-vue/tests/e2e-parity/diff.spec.ts`、`frontend-vue/scripts/lib/aria-parity.mjs`、
  `frontend-vue/tests/parity/scenario-coverage.test.ts`、
  `frontend-vue/tests/unit/chat/followup-chip-guards.test.ts`、
  `frontend-vue/tests/unit/composer/composer-autofocus.dom.test.ts`、
  `frontend-vue/tests/unit/chat/selection-toolbar.dom.test.ts`、
  `app/components/chat/*.vue`、`app/components/ui/command/*.vue`、
  `app/components/workspace/artifacts/ArtifactFileCards.vue`、
  `app/pages/workspace/agents/new.vue`、
  `app/core/skills/slash-suggestions.ts`、`workspace/sidecar/SidecarPanel.vue`、
  `workspace/browser-view/BrowserPanel.vue`
- 取数合同在 `frontend-vue/BEHAVIOR_CONTRACTS.md` 的 **S8 / S8a / S8b / S8c**
- **文件头里写着「实测过、做不到」的结论，也要看它给的机制对不对。已经翻案十一次。**
- **`tests/guards/` 下已有十条「把散文变门禁」的守卫**（wave 163 新增
  **looping-animations**：凡是会无限循环的动画都必须在
  `baseline/looping-animations.json` 里表态——注意它**不证明「门控了」，只保证「表过态」**，
  「门控了」由 `tests/e2e/reduced-motion.spec.ts` 的计算样式去证）（doc-facts / doc-references /
  upstream-citations / upstream-zero-claims / golden-fixture-provenance /
  baseline-keys-consumed / invariant-ownership / e2e-suite-contract /
  **file-header-claims**）。`doc-facts` 里现在有两张表：文档数字、`make verify` 步骤表；
  `architecture.test.ts` 的 L2 段 wave 61 补了反向断言。
  **加新守卫前先读它们的覆盖面**——wave 51 那条就躺在现成守卫的正则缝里。
  **上一轮写下的推断，下一轮仍要当假设重新验。**
