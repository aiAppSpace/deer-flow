# Vue / React / backend 全计划暂停交接（2026-10-27）

**状态：`PAUSED_USER_REQUEST`。整个计划暂停，等待用户明确恢复。** 用户要求“找个干净的点，写交接文档吧”“后续再继续执行任务”。本次不再启动下一轮原生回归、不应用待验候选、不继续修复新问题；仅核对现场、保存源码与证据、完善交接。

**本文覆盖整个计划：W00–W13、R00–R12、C01–C13、九项架构和完整共同矩阵。** 最新恢复入口就是本文，取代 [10 月 25 日交接](2026-10-25-vue-whole-plan-paused-handoff.md)中的旧当前状态；历史记录、失败和已绑定的 PASS 原样保留。整体工作量仍估计约 **90%**，不是测试通过率，不能说代码全部完成或只剩走流程。

仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。

## 1. 当前停在哪里

这是可恢复的源码与验证边界，不是全计划验收完成：

| 层次 | 当前准确状态 |
| --- | --- |
| 原工作区 main-wc | 已应用 COMMON 35 文件批次以及此前布局、渲染器、Streamdown memo 等修复。暂停前 5,835 个公开输入与 COMMON 应用后的清单完全一致，无后续代码漂移 |
| S7 联合候选 | 23 个唯一输入尚未应用原工作区；包含 Dialog/query 生命周期、React 账户缓存、mentions 筛选及已批准 Reka 源码修复。完整 Vue verify：527 文件 / 4,751 测试通过，类型与生产构建通过；React check 和 344 文件 / 3,198 单测通过 |
| S7 原生验证 | v4 已结束，但早于 Reka 源码修复和 mentions 合并。当前源码的完整原生 v5 **尚未创建或运行**；不得将 v4 或单元通过算成修复后的原生通过 |
| 独立初始焦点候选 | 另有 3 文件只在 MCOPY，尚未并入 S7。26 文件 / 217 UI 单测通过；类型、完整 verify、真实浏览器均未验 |
| 最后完成的观察 | feature 消费者追踪 4 用例通过、源输入不变，定位到 agents 子路由能力门禁的接线差异；尚未修复 |
| 全量最终验收 | 最新完整双端 S15 仍是 1,114 PASS / 1 FAIL；当前源码已离开 S15。未建立新的统一最终冻结，不存在整计划 PASS |

三个源码位置：

- 原工作区：上面的仓库路径，主开发现场。
- S7：`/private/tmp/deerflow-next-final-stage56-wwnqv1sm`，完整独立候选；所有后续应用只能按明确文件清单，禁止整棵覆盖原仓库。
- MCOPY：`/private/tmp/deerflow-mention-query-yp8v2gog`，Vue 独立开发副本，依赖软链接到 S7；仅适合既有单测/类型用途，不在此直接安装或声称独立部署通过。
- 账户最初 RED 副本：`/private/tmp/deerflow-account-query-nz6s7mv_`，原始失败和开发过程保留；最新联合字节以 S7 持久快照为准。

所有这些临时目录都有相应持久源码或候选快照，恢复方法见第 9 节。仅文档更新不会把当前候选改为已应用或已验收。

## 2. 范围、授权与禁止误操作

- `frontend` 是当前上游 React 参照；`frontend-vue` 必须在功能、操作流程、行为和 **UI 样式**上可平替，并与实际 backend 契约一致。以代码和真实运行证据为准，文档用于导航。
- 唯一排除：Vue 首页**内容**、docs/blog 内容站、整站无后端静态回放模式。Showcase、完整键盘/焦点/三轴/响应式验收均包含；用户明确选择“仍按原计划完整验收”，不能因其非核心业务而删去。
- 不合理架构、历史负担应修根因；不允许吞错、任意等待、假数据代替真实合同、跳过原规格、放宽差异列表或改掉业务语义来消除红灯。
- 用户允许有实测依据的少量体积预算调整，且明确不要以牺牲维护性换预算。已落地的默认 chunk 优化及具体资产预算取舍继续有效，不能扩展成任意放宽性能或 UI 门禁。
- 依赖源码例外已批准：Sonner、Radix Tooltip、Radix DismissableLayer、Happy DOM、Nextra Theme Docs、Streamdown memo，以及 **Reka Tooltip 广播归属**。均采用正式 pnpm patch/lock 机制；不建 npm 私仓、不手改 node_modules。Reka 已获批，不重复询问；其批准不自动覆盖新的 FocusScope 等依赖修改。Streamdown 表格补丁提案已被公开组件扩展替代，不要再应用旧方案。
- React 本地开发端口已按用户要求改为 **3200**；Vue **3100**。AiPPT **3000** 不动。Docker 容器内部 3000、固定测试 3002 等有不同职责，不能全仓替换。先前有条件临停 AiPPT 的许可本轮未使用，也不应因旧文档说 dev-dual 要 3000 而执行。
- 不自行 commit/push，不新建提交分支；保护当前分支、索引、hooks、跟踪的 `.env/config.yaml/extensions_config.json` 和无关 WIP。不把这些配置加入 ignore 或复制进公共验收源码。
- Host pnpm 经 `python3 scripts/pnpm.py --dir frontend|frontend-vue`；在模块 cwd 使用 `../scripts/pnpm.py`。正常 frozen 安装和 Vue strict peers，不跳依赖约束。
- 暂停期间只允许交接完善及必要现场保全，不能把这当成继续项目开发的许可。

## 3. 已应用原工作区的工作，不要重复实施

更早的 253 份 v75 集成、20 个有效提案、22 个历史退休目标（14 删除 / 8 替换）、Vue 两个直接依赖清理均已完成，详见 [前次交接第 2 节](2026-10-25-vue-whole-plan-paused-handoff.md#2-本次恢复以来已完成的工作)。`uuid` 仍有传递消费者；不要重删。HTML SSR 提案已被证伪，旧线程/归档提案已被新 owner 方案替代，不可再次应用。

本次恢复后的已应用增量：

| 已应用工作 | 证据与边界 |
| --- | --- |
| 早期七个 mock 失败 | 侧栏真实边框几何、提及 selection、流式 reasoning 的根因修复和 41 原生回归保留；S15 mock565 后续整套通过。不是继续按旧交接将七项标为未修 |
| 本地端口与原入口 | React 3200 / Vue3100，local18 三个标准入口真实流程、停止/SQL/端口检查通过；AiPPT 无操作 |
| OIDC 并发首次登录 | 相同 provider/subject 首次并发创建竞态修复；不新增按 email 自动关联。8 个真实 SQL 回归、144 相关测试；B15 / D19 后续实际通过；[根因记录](evidence/resume-2026-10-26/oidc-provisioning-discovery/README.md) |
| 原生 hover、指导文档 | 先原生显露再执行稳定性/命中检查，36 原消费者通过；OIDC 说明归入 SSO/认证文档，原指导检查通过，软警告及额外严格诊断失败保留 |
| 消息布局与 CI | 主聊/侧聊间距、卡片 run owner/忙碌状态、随字号变化的尾部空间；10 原生用例及 686 单测。CI 八个整文件组、独立 Gateway、组内单 worker、完整宏与正式本地入口保留；远程 CI 未观察。[应用回执](evidence/resume-2026-10-26/layout-ci-application/execution.json) |
| 渲染器 64 输入 | 70 图标站点分类后 32 处尺寸修复；引用复制晚返回/卸载；公开表格全屏归属、独立菜单、DOM serializer；终态消息卡片归属；空态容量及 Vue lazy slots。仅明确清单应用；[回执](evidence/resume-2026-10-26/renderer-application/execution.json) |
| Streamdown memo 7 输入 | 官方 memo 修复正式锁定，19 契约最终通过、17 真实 stale-content/attribute/meta RED 保留；正常 frozen 安装。React3192、Vue4731、9完整规格61原生用例通过，135附件逐字保存。[回执](evidence/resume-2026-10-26/streamdown-memo-proposal/application/execution.json) |
| COMMON 35 输入 | API URL/runs 归属、服务端 thread_id 不进入 run context、composer blur/阴影、Sonner 字体/手机宽度、关闭抽屉不提前 bootstrap plugin、关闭 schedule 表单不查询、multipart 二进制观察、固定 viewport 观察器、知识按钮位置、project/trash/status、capability Close 和中文文案等。[回执](evidence/resume-2026-10-26/s15-complete-diff-discovery/common-owner-repair/application/execution.json) |

批次有重叠，不将 17/64/7/35 简单相加冒充唯一修改文件数。原工作区暂停前公开输入精确等于 COMMON 的 `application/public-after.json`，证明后续候选尚未写回。COMMON 完整 Vue526文件/4745测试、React343文件/3193测试与 check、18配置收集1798通过；这些是已应用版本的诊断证据，仍不是新统一全计划通过。

早期通知、退出层、编辑器、Mermaid/资源释放、artifact SHA/BOM/修订、tool_artifacts registry、Showcase 52资源、Sidecar session、Lark owner、技能详情/调度等覆盖继续保留在 [10 月 24 日交接](2026-10-24-vue-whole-plan-paused-handoff.md)及 [10 月 25 日交接](2026-10-25-vue-whole-plan-paused-handoff.md)。其中“未集成”“未执行清理”等旧状态已失效，不能按旧步骤重做。

## 4. 尚未应用的候选、准确验证边界

最新 23 输入的逐项路径、当前字节、SHA 和原工作区差异在 [候选清单](evidence/resume-2026-10-26/pause-preservation-2026-10-27/candidate-inventory.json)、[完整候选差异](evidence/resume-2026-10-26/pause-preservation-2026-10-27/pending-candidates.diff)。其中另外标注的 3 个 initial-focus 文件属于独立候选，不能算进 23。

### 4.1 Dialog/query 与 Reka：11 输入

- Vue KnowledgeScopeSelector 改用公共 DialogTrigger，修 aria 关系及 Enter/Space 重开/焦点归还；真实组件原 1 FAIL / 7 PASS，修后相关15 PASS，原知识库6浏览器用例已扩展并运行。
- React AttachToThreadDialog 在 document=null 时不再查询线程；真实 hook/QueryClient RED 后完整25 PASS。project-workflows 15键、project-document-upload 9键全部零差异。
- Reka 2.10.1 的 document 发送/window 接收不冒泡广播错误，先正常升级官方 **2.10.5**；官方升级清掉知识库原3项 tooltip 残留，但完整原生 v3 新暴露自身广播误关。
- v3：七个完整相关规格加 knowledge diff，共 **29 PASS / 1 FAIL / 0 SKIP/flaky**。Vue 原生 Shift+Tab → Tab 回到 Branch conversation 时提示框关闭；React 通过。首败、trace、25附件及24知识库样本保留，不改写结果。
- 用户已批准正式源码修复：Root 广播携带现有 open Ref 的稳定 owner；Content 只对其他 owner 关闭，旧无 owner 广播仍关闭。四个 ESM/CJS 发布入口，无新 timer/global registry/公共 props，不取消退出动画。它是本仓最小源码修复，不能称官方已合并。
- 正式 patch SHA `16be8235e4121ff5dcb10bf99ff34fa7f98009669dbde29bafa8f8bd63982e87`。第一次 frozen 因 patch-commit 未刷新 lock 正确失败；正常 lock 刷新后 frozen+strict peers 0，四入口匹配批准方案。7 Tooltip 单测通过；**修改后的完整原生回归未跑**。

详细 [Dialog 记录](evidence/resume-2026-10-26/s15-complete-diff-discovery/dialog-query-lifetime/README.md)、[Reka 提案与当前状态](evidence/resume-2026-10-26/reka-tooltip-owner-proposal/README.md)、[安装核验](evidence/resume-2026-10-26/reka-tooltip-owner-proposal/installed-entrypoints.json)、[23 输入及完整门禁绑定](evidence/resume-2026-10-26/reka-tooltip-owner-proposal/full-gate-source.json)。

### 4.2 React 账户 QueryClient：7 输入

模块单例导致独立 SSR、账户切换及旧查询/mutation 晚返回共用缓存，真实 RED 已复现。候选改为 provider 实例拥有，UserPreferencesBoundary 在身份屏障内按用户身份建立 client；同账户刷新保留缓存，跨账户/退出/default 身份隔离，旧异步结果只写旧 client，不用删除少数业务 key 修补。

4个账户用例含 SSR、普通/StrictMode、Alice→Bob→退出→default→Alice、同账户刷新、旧读写迟到；设置全组6文件30 PASS；React check0（既有 `_threadId` 警告保留）和344文件3198 PASS。原 `auth-refresh-http.spec.ts` 两项真实页面增加私有会话列表归属验证，v4 中两端都通过。仍须真正 SQL/cookie 8例及最终完整源验收。[详细记录](evidence/resume-2026-10-26/s15-complete-diff-discovery/account-query-owner/README.md)。

### 4.3 mentions 会话筛选：6 输入，与上组文档有重叠

Vue 错用侧栏默认 archived=false，缺少已归档引用。候选给 useThreads 显式 `archived: "all"`，仅 MentionPicker 使用；侧栏 false、归档页 true 保持，查询缓存键隔离。实际 picker RED 后覆盖活跃/归档、排除自身/侧聊、能力关闭零 I/O、选中身份；分页验证 raw offset50/limit1补齐后下一页必须51。

相关59文件556 PASS，独立应用/测试类型0。已合入 S7 并通过整体 Vue527/4751；新测试按 S7 正确格式配置重排，ARCHITECTURE 合并了 Reka 说明。**旧 proposed/validation 是历史副本，不得覆盖最新联合快照。** 新 mentions 原生诊断未跑。[详细记录](evidence/resume-2026-10-26/s15-complete-diff-discovery/mention-query-owner/README.md)。

### 4.4 独立 initial-focus：额外3输入

Reka 首次焦点候选包含文档链接，Radix 首次选择排除链接；候选用公开 `openAutoFocus` 在调用方未 preventDefault 时选首个非链接动作/输入，链接保留普通 Tab，无动作聚焦容器，不改依赖源码。只在 MCOPY，真实 RED 3 FAIL / 1 PASS；UI目录26文件217 PASS。类型、完整 verify、架构说明和原生均未完成；不继承 S7 的全量通过。[详细记录](evidence/resume-2026-10-26/s15-complete-diff-discovery/dialog-initial-focus/README.md)。

## 5. 已发现但未关闭的问题：恢复首批入口

| 问题 | 当前事实与下一步 |
| --- | --- |
| 已批准 Reka 修复的原生完整回归 | 第一优先：新 v5 输出目录，保留 v3 失败用例和全部七个规格，不删断言；再知识库/mentions等定向诊断 |
| agents 子路由门禁 | 最后4用例只读消费者追踪：React桌面/手机 features各7，Vue桌面6/手机5；thread_activity React2/Vue1，手机Vue无 agents_api。React agents/layout 等能力后挂子页；Vue chat 直接挂 AgentChat，能力只在index/侧栏。需补真实 pending/disabled/直达子路由负例后修真实门禁，不能为凑请求数改 staleTime；[观察与代码位置](evidence/resume-2026-10-26/s15-complete-diff-discovery/feature-query-discovery/README.md) |
| integrations 初始焦点 | Vue 文档链接 vs React Close，独立3文件候选待原生证明，不能据217单测宣布消除6个实际样本 |
| 异步禁用/DOM更新后的孤立焦点 | v4 多处 React div vs Vue body；Reka FocusScope 与 Radix mutation条件不同是待验证方向，尚无新依赖修改。先记录原生事件/活动节点；若真需改新的 FocusScope 入口，另提具体方案，不把 Tooltip 批准无限扩大 |
| thread-delete 关闭焦点 | React composer vs Vue body，两个样本未闭环；查关闭/触发器/删除 owner，不能仅设置全局 focus |
| 账户切换 sidebar 几何 | integrations 某些几何差异可能来自 SidebarProvider 在身份边界重挂、defaultOpen使用旧SSR cookie；只是待证假设，不能宣称已修 |
| Showcase references 能力时机 | React InputBox 的 references hook 与 Vue disabled gating 尚有不同；它与本轮 knowledge features 追踪是不同问题，不能混为同一根因 |
| ScheduledTaskCard 详情查询 | 仍须按实际消费者确认 initialData/stale/refetchOnMount/IntersectionObserver 生命周期；不能仅删多出的 GET。COMMON scheduled36键全零不等于所有调度卡片生命周期都关闭 |
| 路由/加载播报 | React Loading/New chat 与 Vue 空 alert 的7个样本待核对真实状态/文案；不得泛化忽略 aria/语义字段 |
| 动态身份观察 | UUID/run/local-human/fact_8hex 等需要基于已观察真实身份的类型化映射及“错路由仍失败”负控；尚未增加宽泛正则归一化 |
| 全部 S15 差异与最终 UI | 原751键556非零；若干修复组已清零，仍不能由局部通过推算整表通过。需新最终源完整 matrix、图像完整性、人工审图与零接受台账 |

v4 六组诊断加两项账户刷新共8 PASS，0 SKIP/flaky，源输入不变；**`PARITY_ONLY` 退出0仅表示诊断完成**。76键仍29非零：thread-history 0/4、integrations13/18、skill-export3/13、plugin-icons8/20、settings-memory-import3/15、thread-delete-confirm2/6。详细 [v4 原回执](evidence/resume-2026-10-26/s15-complete-diff-discovery/dialog-query-lifetime/native-v4-receipt.json)及每组 capture/preserved 文件；不要抹掉非零项或把局部键数相加当唯一全矩阵覆盖。

原初始知识库差异24键中20零、4请求残余；最后消费者追踪已经否定“这四项都来自 conversation references”的旧猜测。每端还有1个未由自有属性观察器标注的 feature 响应，未证明其消费者，不得猜写为已确认。

## 6. 完整验收台账：历史通过不改绑当前源

| 门禁/拓扑 | 最后可用证据 | 当前边界 |
| --- | --- | --- |
| S15 canonical / React | Vue523文件4701测试及原完整检查通过；React340文件3159测试和check通过 | S15历史；当前COMMON和23候选另有局部门禁，不拼为统一PASS |
| S15 full cross-app | 1114 product PASS、1 full matrix FAIL，原退出2；auth21 / SQLsession8未执行；所有输入/依赖/backend/tool边界通过 | 约6.2小时原完整轮；3008原始文件约222MB已逐字保留，未关闭 |
| 最新收集 | 18配置1798；product1169、auth21、SQLsession8；mock565、backend24、external3、visual8 | 收集不是执行；新增原生测试必须全部保留在CI和完整本地入口 |
| S15 mock / backend浏览器 / external | 565 / 24（八拓扑）/ 3 全部通过 | 旧源历史通过，新统一源仍须完整执行 |
| B15 backend | 四分片27186 PASS / 414原策略SKIP；blocking235，lint/format通过 | 原失败及原SKIP策略保留；不能说零跳过或当前最终源四入口全通过 |
| Linux15 | 正式visual8/payload12/asset、补充观察8/12、9实际PNG人工审阅及归属/恢复边界通过 | 最终源重绑；测试容器137不是产品SIGTERM证据 |
| Standalone15 两模式 | default与with-e2e完整结束；4639单测PASS/62原React缺席SKIP；后者mock565+backend24；3observer负控通过 | 无React跨端只收集，不冒称可运行双端；两个fresh拓扑最终源仍需重做 |
| D19 Docker | canonical三镜像、engine COPY、probe/privateNuxt/WS、并发首次OIDC、smoke、normal-stop及source/host边界均通过，SQL保留 | 五容器已停止；Vue exit0、React entry exit1、IdP143如实保留。截图仅欢迎页范围，不证明全UI |
| local18 | dev-vue / dev-dual / prod-vue 原标准入口，真实注册/偏好204/单SSE/三建议/刷新持久化、标准stop/SQL/端口全通过 | 旧源通过；最终源再次运行，无AiPPT动作 |
| 视觉材料 | 全751对/1502PNG清单、解码/尺寸及零接受台账；原声明人工选样保留 | 全矩阵未PASS，最终源人工结论未闭环；不能将Vue自身基线当两端整图一致 |
| R11源码/CI | 1472公开WIP有界审查映射、76近期应用输入、dirty124/untracked56拒绝负控、12监测前缀两事件 | 不是1472文件逐行重读，不是R11关闭；新增COMMON/候选需最终归并，远程CI未观察 |

关键入口：[S15全量轮](evidence/root-stage56-attempt15-final/final-cross-app/execution.json)、[S15状态索引](evidence/resume-2026-10-26/current-state.json)、[本轮完整证据索引](evidence/resume-2026-10-26/README.md)。S8/S9/S11/S12/S14、Docker下载/OCI引用/OIDC失败、沙箱EPERM、格式/测试加载器错误等都保留原直接退出码，不改写历史。S13/S14四个过期副本曾仅清理12个可重建依赖目录，源码/fixture/回执保留；旧ready回执不代表现在可直接运行，需正常重装并生成新回执。

人工范围保持：18双端矩阵36图、4成功附件8图、8编辑器格式/主题×两端×Source/Edit=32选样（完整编辑器14case共56图）、Linux9图。751完整对必须另验key/文件/解码/尺寸/缺失/额外；diff测语义、几何和选定computed styles，**不是两端整图逐像素自动比较**，截图失败还可能不使主diff失败。Darwin P03阈值仍0.02，不接受历史约0.03失败。

真实外部 LLM、IM、IdP、DNS/TLS、外层代理和远程 CI 仍 **UNOBSERVED**。受控本地 Gateway/IdP/replay 的通过不能升级为这些生产环境通过。旧 Stage43临时失败原件缺失的历史限制继续保留，新保全不能反推它已补齐。

## 7. 全计划逐项保留

原范围目录：[本期原计划](2026-10-09-vue-period-plan.md)、[进度问题索引](2026-10-10-vue-plan-progress-and-issues.md)、[W细项映射](evidence/resume-2026-10-20/handoff-document-review/README.md#原计划细项映射)。下面列状态，不能删掉链接中更细的验收内容。

| 工作包 | 已有实现/证据 | 未完成的最终关闭 |
| --- | --- | --- |
| W00 基准/契约 | OpenAPI/JSON、源码/依赖冻结、18配置收集 | 新统一源全部拓扑与文档/CI/契约一致 |
| W01 账户/偏好/features | session/RBAC/locale/timezone/PATCH204；刷新修复已落地，账户缓存候选已验局部 | 账户候选应用、agents路由能力、auth21/SQL8/跨tab/错误恢复 |
| W02 run/消息 | gap/durable/END、create/join/stop/dispose、human ID、附件/bridge/cache、终态卡片归属 | 最终协议与实际run全验，无重复create/旧草稿/旧owner污染 |
| W03 产物/预览 | Range/SHA/BOM/修订/保存锁、编辑器/iframe/Mermaid及资源释放 | 全媒体异常/P03、完整视觉/动态归属与实际产物 |
| W04 输入/模型 | 草稿、知识、reasoning、语音/润色/上传、命令菜单；mentions候选 | 原生mentions回归与集成、全部IME/授权/取消/提交持久化 |
| W05 能力/Agent/知识 | catalog/RBAC、Skill409、Agent包/display_name、知识选择器候选 | 子路由能力门禁、全部安装/OAuth/范围/冲突/权限 |
| W06 历史/来源/未读 | activity、scroller、分页/归档、source/registry/cache；历史4键零差异 | 删除焦点、完整prepend/追尾/resize/跨owner/恢复 |
| W07 调度/channel | events/history、queue/DST/秒精度、通知复制、channel owner；scheduled36键零差异 | card详情生命周期、全量调度/channel/深链/冲突/取消 |
| W08 扩展宿主 | inline/assets模块图、导航/动作/mentions/abort/dispose、关闭抽屉不预取 | 最终权限/晚返回/卸载/真实Docker完整消费 |
| W09 项目/文档/trash | 四tab/instructions/上传/预览/转换/恢复；attach查询候选24键零差异 | 候选集成及完整双端/真实Gateway权限/冲突/分页/部分失败 |
| W10 Browser/Sidecar/设置 | binary/legacy/WS owner/resize/Sidecar session/memory/subagents；旧八拓扑/external通过 | 当前源重连/关闭重开/资源释放/权限；剩余设置焦点差异 |
| W11 Showcase/UI | snapshot52资源、Markdown/代码/图表/图标/表格/字体容量，众多原生回归 | 完整751对1502图、人工矩阵、初始/异步焦点与完整键盘三轴 |
| W12 架构/历史负担/CI | 22目标/两直接依赖退休、唯一owner、七项获批依赖修复范围、八组CI | 新候选归并/依赖维护、九架构最终运行、源码/CI/独立交付复核 |
| W13 全量验收/同步 | 历史完整门禁、实际Docker/三入口、持久归档；main已并入main-wc历史 | 剩余根因修复、新冻结R04–R12、C条件/文档/marker |

| 恢复/验收步骤 | 当前状态及下一轮要求 |
| --- | --- |
| R00 | 暂停保护边界与保全已核；恢复重新核现场、hash、私有/index/hooks、服务与端口归属 |
| R01/R02 | MCP容量P01/横滚P02已保留，纳入最终原生验收，不重建旧临时方案 |
| R03 | v75/历史清理已应用；当前23+3候选与未修问题另处，完成后新统一最终冻结 |
| R04 | 原完整canonical/React/backend/check/audit/contracts/collection/icons按新源整套执行；不可只跑unit |
| R05 | 原完整cross-app product1169→auth21→SQLsession8（恢复时按真实collection更新新增数，不删原例）；含三轴、751/1502、零接受与人工审图 |
| R06 | mock565、八backend拓扑24、external3，保留原预算/错误策略；P03阈值不变 |
| R07 | Linux正式visual8/payload12/assets和9人工图按最终源绑定，核实际原生依赖/执行身份 |
| R08 | standalone default / with-e2e fresh双模式、正常安装/fullunit/build，第二模式全mock/backend；仅缺React跨端允许collection-only |
| R09 | engine-context实际COPY、build-vue/build-react/probe/probe-oidc/smoke/normal-stop七阶段，canonical Gateway、双host/nonroot/SQL/退出码全部实证 |
| R10 | dev-vue/dev-dual/prod-vue三个标准入口，原30/300/180秒及真实注册/me/权限/204/SSE/建议/刷新/stop/SQL；3200不占AiPPT3000 |
| R11 | 九架构、全WIP最新有界差异、CI12前缀/全部规格恰好一次、dirty/untracked拒绝、失败现场可取；不擅自更新marker/提交 |
| R12 | W/R/C/九架构/共同矩阵逐项有明确证据，文档/源码/命令/revision一致；代码、本地集成、外部生产就绪分列 |

九架构全部保留：①消息虚拟化真实scroller；②聊天编排/草稿提交/adoption；③唯一状态owner；④query identity/features/mutation发起身份；⑤Lark单流程owner；⑥孤立代码/真实消费者；⑦重复算法的真实行为差异；⑧历史叙事/门禁/负控/失败归档；⑨必要UI适配、原生焦点与键盘。现有实现和有界审阅不能替代九项最终运行闭环。

共同矩阵：同Gateway/seed/权限/字体/浏览器/时钟；中英×明暗×桌面/手机及真实主题限制；loading/empty/error/selected/disabled/hover/focus；低高度、200%文字、双向resize、弹层/表单/多面板；直达/刷新/返回/深链/404；跨tab/用户/线程/Agent及持久化；离线/超时/鉴权/资源消失/冲突/SSE中断/部分上传/授权过期后继续操作；资产成本、长会话、本地/独立/Compose拓扑。

| C关闭条件（均尚未整项最终关闭） | 必须保留的证据 |
| --- | --- |
| C01 | 全范围入口/动作，只有三项明确排除 |
| C02 | Showcase全公开案例/资源/只读/UI，写操作另用真实验收 |
| C03 | 全WIP有真实接线或有依据移除，无半迁移 |
| C04 | P01–P03、F01–F14及所有新失败根因与永久回归；F01草稿期限/F02编辑器搜索括号redo/Escape不遗漏 |
| C05 | gap/durable/human ID/run input/附件，无重复create或旧草稿假提交 |
| C06 | 偏好/locale/timezone、引用授权、三套reasoning、知识、Agent/来源/未读 |
| C07 | 调度/channel、项目四tab/trash部分失败、扩展完整宿主 |
| C08 | 功能/流程/行为/UI双端，751/1502与人工审图，无新增豁免 |
| C09 | 九架构/历史负担、唯一owner、真实消费者及必要无障碍 |
| C10 | 当前backend REST/SSE/JSON、持久化/取消/异常恢复 |
| C11 | 完整verify/浏览器/backend/visual、CI接线与失败材料可取 |
| C12 | Vue构建、无React独立交付、本地三入口、容器分别实证 |
| C13 | 文档/源码/命令/结果/marker一致，保持dirty接受拒绝、不擅自提交 |

## 8. 下一次从哪里恢复，按顺序执行

1. 先读本文、[暂停核验](evidence/resume-2026-10-26/pause-preservation-2026-10-27/README.md)、`current-state.json`。重新读适用 AGENTS，核原分支、index/private/hooks、当前改动是否属于其他窗口；不要沿用旧PID或覆盖后来新增工作。
2. 校验持久归档、23+3候选快照及S7门禁输入。原工作区 baseline 是 COMMON `application/public-after.json`；本次只有交接文档增量，见暂停最终边界。旧 candidate-owner-union 中的 SHA 或某组 proposed 可能早于 S7格式/ARCH合并，精确最新版用本次 snapshot。不要重跑已经执行且防覆盖的 apply-reviewed.py。
3. 恢复 S7 时先正常核安装归属与四个 Reka 实际入口。为当前23输入创建新的原生 **v5** 目录/回执，沿用 `dialog-query-lifetime/run-diagnostics-v3.py` 中的七个完整规格：knowledge-radio-boundary、tooltip-presentation、disabled-agent-tooltip、focus-capacity-regressions、overlay-survives-resize、reasoning-menu-resize、composer-command-focus，再知识库诊断；保留首次失败且不改断言。另加 mentions 定向诊断及完整 composer-keyboard-lifecycle / popup-capacity-reflow 相关规格。v3/v4脚本已用过，不能直接重跑覆盖历史。
4. 原生运行期间冻结该副本源码/依赖；独立副本可以继续核 initial-focus 的类型/契约。v5完毕保全附件后，再从 feature消费者追踪建立 agents 子路由真实RED，修门禁与挂载生命周期；按第5节逐项排查剩余焦点、sidebar、调度、播报和身份映射。候选只按有效差异合并；INITIAL不覆盖S7的ARCH、Reka等文件。
5. 有界候选完成相应测试后，准备明确 before/proposed/清单/预期改变集合，保护原私有/index/hooks。精确应用到原工作区，正常 frozen+strict 安装并核入口，记录当前源码。不得把临时 Nuxt `buildDir: "./.nuxt"` 变换回写产品；S7除了23候选，现有共同输入只有此一隔离差异。
6. 所有已知根因处理后，建立 **新的统一最终冻结** 和新执行目录。不要冒称已存在 S16最终轮，也不要仅改名继承S15 PASS；重绑backend/Linux/standalone/Docker/本地三入口/编辑器取图器。按R04–R10跑完整原入口，长套件单副本串行，保留原预算、全部测试与真实观测。
7. 完成全图完整性、成功附件、原人工选样、九架构/R11/C条件和R12文档。外部无凭证/环境项诚实列UNOBSERVED，范围不暗减，提交/发布按用户另行指示。

工具导航仍可用 [原恢复工具定位表](evidence/resume-2026-10-25/handoff-document-review-2026-10-26/README.md#恢复工具定位)，但实际新轮工具应参照 `root-stage56-attempt15-final/`、B15、Linux15、`standalone-attempt15/`、D19与local18，而非直接执行旧S4路径。部分工具硬编码manifest，必须查看源码重新建立binding，不能只改显示名称。容器binder不自动建立全部本地模式binding，三入口分别核对。

环境前置：两端正常锁安装、backend browser extra/匹配Chromium、Readabilipy公共初始化、独立公共Git夹具/readiness；受控SQL/seed/runtime home、核心OpenAPI `plugins: []`及显式webhook，扩展fixture另验。配置只在独立副本使用公共示例，不借原私有插件/用户数据凑验收。沙箱仅因listen EPERM阻塞时原命令在获准环境运行，不改测试。`keep-e2e-failure-artifacts` 可能迁移失败附件，preserve-report需要传真实失败目录；第一次保存不完整时保留partial再重做，不能吞附件缺失。

## 9. 源码保全、恢复与保护边界

持久目录：

`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-10-26/pause-preservation-2026-10-27/`

| 文件 | 内容 / SHA-256 |
| --- | --- |
| `original-public-source.tar.gz` | 暂停时原工作区5,835公开文件，52,261,780字节；`d4b5ee31bda94a11295d78973ba7fdf3322e7a874765ada1c78c48e5b62059b6` |
| `s7-public-source.tar.gz` | 当前S7完整公开源码5,838文件，52,265,942字节；`0bc00d5d5c8cbf78994361ba696fb0cde8ea767a1bdf6df9d19cdf57687b894b` |
| `original-public-inputs.json` / `s7-public-inputs.json` | 每个归档成员的路径和SHA；全部成员安全类型/相对路径/无重复及逐字readback已验证 |
| `s7-candidate/` / `initial-focus-only/` | 23个联合候选及3个独立候选精确源码，不依赖/tmp存活 |
| `candidate-inventory.json` / `pending-candidates.diff` | 源位置、原/候选SHA、已保存位置及完整可审查差异 |
| `public-before.json` / `baseline-delta.json` | 暂停前原输入精确等于COMMON应用后，delta为空 |
| `protected-before.json` / `final-boundary.json` | 私有/index/hooks仅哈希记录、分支和最终仅文档变化；不暴露配置内容 |
| `host-state.json` / `preservation.json` / `review.json` | 实时宿主只读快照、源码保全回执、交接链接与范围复核 |

两份归档不含 `.env/config.yaml/extensions_config.json`、原Git/索引/hooks、依赖、构建、运行数据或evidence；测试日志/trace/图片仍在各持久证据目录。归档生成在最终交接写入之前，因此不含本文；本文和最新状态单独保存在仓库，最终文档增量另记，不能重写归档身份。

临时副本丢失时：先核归档SHA，遍历成员只允许普通文件/安全相对路径，无`..`，恢复到**新建本任务目录**，按相应inputs逐行核SHA，禁止解压覆盖原仓库。S7归档已包含唯一Nuxt buildDir隔离变换，不能重复插入。所需runtime fixture从同份公开example创建并单列SHA；不能恢复真实私有配置。新路径创建独立公共Git索引、正常安装依赖、核执行入口，建立新的恢复manifest和gate binding；旧回执绑定旧路径不修改。本次已全成员验证，但**没有执行全新路径还原/重跑演练**。

原Git：分支 `main-wc`；HEAD `a7804539530846baecf548af7b5d2612deb89b68`；main `5ecc1c2ac2de624af354bc515d5cb04f80df226c`，已在HEAD祖先链内；无未合并索引项。索引SHA `109661be26054eff97a2c4ceee44d5bc6833a6dd6ac2a8ecb507f77bea854969`。本次未创建提交/推送，原私有配置及hooks保护基线一致。

## 10. 暂停现场与最后边界

**2026-10-27 10:59:51 +08:00** 实际只读核验：按本仓与验收副本命令路径未发现运行进程；20个列明端口无监听，包括3000/3100/3200/3410/3411/8310及2026/2426/2486；29个本计划命名容器全部已Exited。当前团队只有主agent，无仍在执行的子任务。没有发送终止信号、没有启动服务、没有停止/恢复AiPPT、没有清理容器或用户数据。快照只证明该时点；恢复须重新检查。

用户暂停后未继续产品实现或验收，原/S7/MCOPY产品输入已保存且不变。现有源码、已完成结果、原始失败、未执行范围和精确恢复入口均保留。最新状态为 **整个计划暂停、未完成、不缩水**。

下次可直接说：**读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-27-vue-whole-plan-paused-handoff.md`，恢复整个计划，不能缩水；先核现场和持久快照，从第8节继续。**
