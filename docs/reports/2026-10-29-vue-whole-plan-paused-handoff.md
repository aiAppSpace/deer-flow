# Vue / React / backend 全计划交接（2026-10-29）

**状态：PAUSED_USER_REQUEST / WAIT_FOR_EXPLICIT_USER_RESUME。已在当前组合修复的干净边界收尾，整个计划暂停，等待用户明确恢复。**

本交接覆盖整个计划 **W00–W13、R00–R12、C01–C13、九项架构和完整共同矩阵**，不是只交接本轮焦点问题。替代 2026-10-27 文档中的“当前状态/恢复位置”；旧文档和历史失败证据保留。当前仍有代码实现、独立审查、原生回归和整套验收未完成，不能说代码全部写完、只剩验收，更不能把局部 PASS 相加为全计划 PASS。

仓库绝对路径：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。

本文路径：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-29-vue-whole-plan-paused-handoff.md`。

本轮证据根目录（下文简称 **N28**）：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-10-28/`。本轮跨越 10 月 28、29 日，沿用同一目录，没有把旧结果改绑成新日期结果。除明确标注的仓库路径、绝对路径或专节目录外，证据路径均相对 N28。

**本次仅复核交接文档，计划仍暂停。** 复核记录及新文档哈希见 [文档复核记录](evidence/resume-2026-10-28/handoff-document-review-2026-10-29/README.md)。历史执行/审查回执、源码归档及暂停时点快照保持原样；本次没有运行产品测试、构建、浏览器、安装或恢复演练。

## 1. 范围与执行约定

- `frontend` 为 React 参照；`frontend-vue` 在功能、操作流程、行为、UI 样式上可平替，同时对齐实际 `backend` REST/SSE/JSON、持久化和权限合同。以源码和运行证据为准，文档仅为索引。
- 唯一排除是 Vue 首页**内容**、docs/blog 内容站、整站无后端静态部署模式。Showcase、键盘/焦点、完整三轴和响应式矩阵仍全部包含；用户已明确选择完整验收。
- 架构不合理和历史负担修根因；不吞错、不猜字段、不补偿请求、不加任意延时、不扩大归一化或差异豁免、不跳既有用例。本期维护性优先，预算仅按已证实且明确批准的边界处理。
- 已批准的依赖源码修复均通过正式 pnpm patch/lock 机制交付，不建私仓，不留下手改 node_modules。历史 Sonner、Radix Tooltip/DismissableLayer、Happy DOM、Nextra、Streamdown memo、Reka Tooltip 均保留；本窗口用户另明确授予任务所需权限，已据实际根因审查新增 ReKa/Radix FocusScope/Dialog 生命周期修复。具体源码/发布状态必须以各提案及锁文件为准，不能把本仓维护修复称作上游已合并。旧 Streamdown 表格补丁方案已被公开组件扩展替代，不再应用。
- 本地 React **3200**、Vue **3100**；AiPPT **3000** 无操作。Docker 内部 3000、固定测试端口各有职责，不能全仓替换。
- 不自行 commit/push、切分支、更新同步 marker、清理证据或覆盖无关 WIP；原跟踪 `.env`、`config.yaml`、`extensions_config.json` 保持原策略。公共副本只用有 SHA 的 example fixture，不复制真实私有配置。
- Host pnpm 一律 `python3 scripts/pnpm.py --dir frontend|frontend-vue …`；模块内用 `../scripts/pnpm.py`。正常 frozen 安装，Vue strict peer；临时副本中的 Nuxt buildDir 隔离变换不得回写原仓。
- 原生套件运行时冻结相应副本源码和依赖，完整规格执行、保留实际直接退出码及所有附件。沙箱 listen/uv-cache 权限导致零执行时，原命令在许可环境重跑，不将环境失败算成产品失败或 PASS。
- 暂停后等待用户明确恢复，不再启动后续实现/浏览器/构建；权限授权不能覆盖最新暂停指令。

## 2. 原工作区与隔离候选的关系

原分支 `main-wc`，HEAD `a7804539530846baecf548af7b5d2612deb89b68`；`main` 为 `5ecc1c2ac2de624af354bc515d5cb04f80df226c`，已在 HEAD 祖先链中。不存在待完成的 Git merge。本轮没有再拉上游，也没有提交/推送。

原工作区已经有先前 v75/COMMON/布局/渲染器/Streamdown/端口等实现；**10 月 28–29 日本轮产品修复仍只在隔离候选，未应用原工作区**。原仓仅追加/完善本轮文档和证据。R00 公开基线为 5,836 个输入；index SHA `109661be26054eff97a2c4ceee44d5bc6833a6dd6ac2a8ecb507f77bea854969`。最新核验见保全回执，不把 09:41 的旧核验写成最终时点。

| 名称 | 临时路径 | 暂停时用途 |
| --- | --- | --- |
| S7 联合候选 | `/private/tmp/deerflow-next-final-stage56-resume28-hrh6bi3f` | 当前所有已审核集成代码；原仓未应用，最终整套未验 |
| Memory 组合修复副本 | `/private/tmp/deerflow-memory-close-resume29-buk84hub` | Task6 与 Task5 组合根因修复/单元/静态，精确 before/proposed 留在 N28 |
| Task7 路由播报候选 | `/private/tmp/deerflow-route-head-resume29-_m0x82ld` | 独立审查 Needs fixes；**产品未集成 S7** |
| Task8 Showcase 准备副本 | `/private/tmp/deerflow-showcase-capability-resume29-_xr43ftc` | 5,860+2 基线、正常 Vue 安装；未派发、未实现 |
| Task9 滚动准备副本 | `/private/tmp/deerflow-initial-scroll-resume29-op5de3bx` | 与 Task8 相同公共源码；未派发、未实现 |

旧交接中的 `/private/tmp/deerflow-next-final-stage56-wwnqv1sm` 等目录在恢复时已经不存在。本轮按持久归档逐成员 SHA 恢复并正常安装，不依赖旧依赖软链接。未来临时目录仍可能消失，所以以第 8 节持久归档为恢复依据。

## 3. 已完成事项与严格证据边界

以下“局部闭环”表示该任务独立审查与完整相关组已通过，**不代表新联合源码通过完整 W/R/C**；后续共享依赖变更还需组合回归。

| 工作 | 本轮已完成、证据入口 | 尚不能宣称 |
| --- | --- | --- |
| R00 恢复 | `restoration.json`：原 5,838 公共成员恢复、2 example fixtures、保护边界、正常依赖与入口核验 | 不是产品验收/生产就绪 |
| 旧 23 候选原生 v5 | `native-v5/`：knowledge30 + mentions19，共49 PASS、0 skip/flaky；原始诊断差异保留 | 诊断 exit0 不代表所有比较键为零 |
| Task1 Vue 初始焦点 | `initial-focus/`：radio 根因再修、UI26文件223测试、类型/lint/格式、审查；原生22 PASS，integrations6个首焦点差异消除 | 全部模态/键盘最终矩阵仍待验 |
| 账户刷新/分页 owner | `candidate23-review/`：21路径修复 HTTP/network/parse 暂态保留身份、raw分页cursor；Vue76/679、React7/36及实际双端刷新/JSON/草稿/账户切换通过 | 最终完整 auth/SQL/全量重新绑定 |
| Task2 Agents 能力门禁 | `agents-route-gate/native-green-v2/`：真实 pending/disabled/直达/子路由；相关223、审查、完整原生10 PASS | 不用凑 features 请求数替代真实门禁 |
| Task3a 项目首次创建 | `project-thread-birth/implementation/` 与 `project-thread-birth/native-green-v1/`：真实归属/创建根因、两轮审查、真实 session/CSRF/Gateway/SQL8 PASS | 不把受控 SQL 当外部生产证据 |
| Task3b 真实浏览器契约 | `project-thread-birth/browser-fix/`、`project-thread-birth/affected-mock-v3/`：8测试路径审核；完整 React84/Vue74 PASS、0 skip/flaky，6附件 | v1 实际 React77 PASS/7 FAIL、Vue74 PASS；v2 两端环境零执行；v3 才是两端全组 PASS，三轮回执均保留 |
| Task4a ReKa 孤立焦点/重开 | `focus-scope-source-fix/`：正式源码/分发入口修复，审查查出旧 lastFocusedElement 跨 present 激活残留并修复；20重点/243UI、完整10原生规格55 PASS、42附件 | 后续 Task6 同包扩大修改后须重跑组合 |
| Task4b React Dialog/Sheet 初始 guard | `react-dialog-entry-fix/`：7路径审查；13完整原生规格75 PASS、72附件；旧 iframe about:blank fixture 警告已在所属测试修正 | `_threadId` 旧 warning 和可选 host-swap 覆盖分别在未完清单 |
| Task5 删除当前会话 | `delete-focus-fix/ACCEPTANCE.md`：Vue真实路由取消 owner、React已提交 draft 的 keyed editor 交接；Vue120/1045、React152/1259，完整两端 mock16 + 4完整 parity规格16 PASS | 这是 Task6 扩大依赖之前的局部接受；组合问题见下一节 |
| Task6 通用关闭焦点 | `memory-close-fix/fix-round1/`：三项 review 阻断均修复，13路径增量独立 Approved；React147/1176、Vue118/1031及其余直接消费者133/1090、完整静态；真实 CJS/ESM 挂载验证 | 原生候选/完整框架 Memory 与删除 mock 尚未执行，不能关闭 Task6 |

原工作区更早已完成：253份 v75 集成、20有效提案、22历史目标退休（14删除/8替换）、Vue两项直接依赖清理；`uuid` 仍有传递消费者，不重删。COMMON35、渲染器64、Streamdown memo7、OIDC并发首次登录、消息布局/CI、React3200等以 10 月 27 交接第3节及其实际 application 回执为索引，不重复应用。HTML SSR 提案已证伪、旧线程/归档方案被新 owner 替代，不复活旧方案。

## 4. 当前干净点：Task5 + Task6 组合收尾

Task6 初始17路径包被独立审查拒绝，原因是真实 CJS ASI 挂载异常、非模态程序化关闭丢 opener、React父子同时关闭丢外部 Trigger；旧包原样保留。`memory-close-fix/fix-round1/` 以 TS AST/printer生成 ReKa CJS/ESM、公开 FocusScope restoreFocusElement、同激活/同scope的关闭生命周期修复全部三项，未新增 Memory 专用 DOM 查询、全局 focus 兜底或任意延时。

已审核 21路径 union、19处实际变化有界集成 S7，`frontend/AGENTS.md` 只合并新增段落并保留 Task5 说明。正常 React/Vue frozen+strict 安装通过，31个实际源码/分发/types入口和四个 CJS/ESM mounted controls 通过：

- 首次组合源码：`memory-close-fix/candidate-integration/source-frozen.json`，5,870公共+2fixture，SHA `e2dd7f5355280875b3d391f96a7c31438a0bd6bfc276f5f92c0a599eec328ad5`。
- 实际 runtime：`memory-close-fix/candidate-integration/runtime-frozen.json`，31入口，SHA `b26e6ec653a3ad5ad2879098bff836d2010ef0f66854afa1b9a763056e006d7f`。
- 完整 React components/core-threads/Streamdown：182文件、1560测试，**1555 PASS / 5 FAIL / 0 skip**；`memory-close-fix/candidate-integration/checks/react-components-threads-permitted/`。前一次 sandbox listen EPERM 为零执行，单独保留。
- 完整 Vue UI/settings/threads：65文件、686 PASS、0 skip；`memory-close-fix/candidate-integration/checks/vue-ui-settings-threads/`，源码/runtime前后一致。

五项不能统称 fixture 问题：Cancel/background 的泛化 focus spy 混淆合法默认 opener 恢复与业务删除交接；合成 click 未执行真实 pointer 聚焦。另三项 account/roundtrip/旧账号失败涉及同一 DOM 被新账户复用，默认关闭恢复缺少消费者账户归属 veto，必须保留严格负控。诊断在 `memory-close-fix/composition-diagnosis/initial.md`；所有失败调用带 preventScroll，与显式 focusIfOwned 无参调用区分。

组合副本通过明确9路径输入恢复为与 S7 相同的 5,870+2基线，未重装/改依赖：`memory-close-fix/composition-baseline/source-frozen.json` SHA `52abb85fefb23e3446575b4bc3fa4b3d83b9d6de92ad63ac7fab3aab259db3ea`。

**本次干净点已完成：** `memory-close-fix/fix-round2/` 仅3文件：React delete provider、实际composer测试、frontend AGENTS。请求接受时捕获accountRevision，所有close在no-completion早返回之前取消已退役账户的默认恢复。Cancel/background保留原负控并焦点激活真实入口，另加原programmatic exactreturn；新增未确认Cancel/Escape账号/往返与新账户重新请求，正向业务handoff也验证一次。无依赖/原生规格/Vue修改。

- 原19测试真实RED为14 PASS/5 FAIL；透明调用栈诊断保持全部19原断言，确认三账号场景是真实消费者漏洞。扩展26 RED中7个账号失败、1个TanStack变量/第二参数的fixture断言错误分开保留；早期prototype-spy污染及14筛选排除只是诊断，不当验收。
- 两完整删除组件文件31 PASS；实现副本完整182文件1567 PASS、0 fail/skip/todo；全React eslint+tsc exit0保留原 `_threadId` warning，3个变更文件format通过。
- 独立 `memory-close-fix/fix-round2/review.md` **Spec compliant / Quality Approved，0 Critical/Important/Minor**；SHA `f2770ff49ef3b545050bdc4eecd416e0eed7d7cdda635b26f4d5b16a4937e260`。StrictMode/重复请求的部分结论是静态审查，不冒称新增专门运行控制。
- 仅3路径有界集成 S7，全5,870+2逐字与实现副本相同；正式包 `memory-close-fix/fix-round2/manifest.json` SHA `3bcb173b42a39ececd61e854cfbebb01e2da4c28b4180df26863ac4c19521133`。
- **S7 再跑同一完整组合命令，实际182文件1567 PASS、0失败/跳过/待办，exit0，结束于2026-10-29 13:37:22 +08。** 回执 `memory-close-fix/candidate-integration-round2/checks/react-components-threads-closeout/`；源码与31 runtime前后不变。
- 最终源码 `memory-close-fix/candidate-integration-round2/source-frozen.json` SHA **`ef7f955b3fe9f956c8d07a74fba99da49dbe60996b3081aab4d3f301edebec31`**；最终runtime `memory-close-fix/candidate-integration-round2/runtime-frozen.json` SHA **`319fd047d018ba238dd74b092d5f5524cb24e2796a8c051cd15e80f42809930b`**，实际31入口未变、未重装、未重复挂载控制。
- 这里是“审核+组件/静态+精确组合”的干净点；**Task6原生候选、完整框架mock、生产构建和全部最终门禁仍UNRUN**。未为暂停开启后续Task7修复、Task8/9或新浏览器。

原生基线仍完整保留：`memory-close-fix/native-red-v1/` close12为React6焦点FAIL/Vue6PASS；`memory-close-fix/native-retry-red-v2/` retry4为React2焦点FAIL/Vue2PASS，均0skip/flaky。前一次 retry4全失败是隐藏父弹窗的 lazy role locator，单列fixture失败；正式测试只提前持有同一父节点并确认 native disabled，行为断言未删。

**下次 Task6 验收必须执行** `memory-close-fix/planned-native-groups.json` 的17个完整 parity规格（先实际collection，不推算数量）：artifact-frame-keyboard、chat-scroll-owner-reflow、composer-command-focus、composer-keyboard-lifecycle、disabled-agent-tooltip、disabled-control-focus、focus-capacity-regressions、knowledge-radio-boundary、markdown-table-actions、memory-dialog-close、memory-dialog-retry、mermaid-fullscreen-owner、overlay-survives-resize、popup-capacity-reflow、reasoning-menu-resize、thread-delete-focus、tooltip-presentation。另有完整框架组 React settings-memory-import/thread-delete-confirm；Vue settings/settings-memory-import/thread-delete-confirm。`run-memory-close-native.py` / `run-memory-mock-native.py` 为现有工具，需新 label/当前 manifest。全部候选原生仍 UNRUN，不沿用前轮 PASS。

## 5. 未完成实现、发现的问题与恢复入口

| 项目 | 准确状态 / 下一步 |
| --- | --- |
| Task7 路由 head 播报 | 六路径候选 `route-head-fix/package-manifest.json` SHA `65cb958fbb6b518c5cb5e134ed979f6f59242a995727bc073be8f0199051be55`。16 mounted、完整439组件及静态通过，但独立 `route-head-fix/review.md` **Needs fixes R1**，产品未集成。Nuxt较早middleware可在mounted beforeEach之前abort/throw/defer，使前次pending owner未退休；旧测试将拒绝guard装在mount之后，未覆盖真实顺序。`route-head-fix/review/guard-order-probe.mjs`、`route-head-fix/review/guard-order-evidence.md`保全真实Router机制证据；实际执行的是 abort 机制 probe，throw/defer 为源码推导，mounted 与候选原生均仍需验证。恢复先做早注册 reject/throw/defer mounted RED，公开生命周期修根因，不粗暴清所有 unmatched afterEach（会破坏旧晚失败/新成功保护）。保持原冻结native-v2 SHA `36bc5f0c3cd8142c0a7630b5c9cacfc380c7ac6817edb7124d3a9940f985d8b6`；原生基线10：Vue3空alertFAIL+2PASS、React5PASS，22附件；候选原生UNRUN |
| Task8 Showcase 能力订阅 | `task-8-showcase-capability-brief.md`，仅准备副本。React能力订阅独立于可编辑性，Vue `useComposerReferences` 被 `!disabled` 关闭；真实Showcase features4vs3。修现有query owner生命周期，编辑/polishing/compactPending仍禁用；实际挂载fetch admission、账户/晚返回/失败/卸载/引用重整/正常提交，以及完整相关原生。禁止补偿GET/改staleTime/专设Showcase请求 |
| Task9 调度卡初始滚动 | `task-9-initial-scroll-brief.md`。真实两端detail-query合同一致，React5卡入视口/详情6，Vue1卡/详情2；初始滚动和observer生命周期有差异。React use-stick-to-bottom采用时间归一化spring，Vue每帧gap比例；不能仅把instant改smooth就宣称同义。保留单scroller/虚拟化/prepend/用户中断/adoption/显式发送/Sidecar instant/缩放等，真实滚动RED后实现，禁止改查询来掩盖运动差异 |
| 类型化动态身份观察 | `typed-identity-capture-notes.md`。尚未实现；当前normalizeRequest将未知UUID折成同一标记，会丢归属/基数并漏local-human/fact。必须capture-local typed provenance、真实创建/响应/已有草稿关系、错owner/错kind/重复/碰撞/任意内容/失败创建/异步顺序/跨账户负控；不可按UUID形状或全局生成序号映射。未提交草稿的provenance仍未闭环；Idempotency-Key的backend/React实际语义仅为待核线索，不能当作已保证的幂等合同 |
| 身份诊断已完成 | `identity-producer-observation/README.md`：8真实观察，7PASS/1观察器假设失败（React项目附件使用固定线程、正确mint0）；所有8raw capture/12附件保全。新chat生成Vue1/React8、提交2/37，证明全局生成序号无效；只包装真实generator观察，未伪造ID。临时规格已按hash退休，S7恢复原冻结。诊断不是产品验收，未实施归一化 |
| Vue guard 重复 agents | `task-7-route-head-report.md`及`route-head-fix/guard-baseline-control.log`证明现有`breadcrumb-linkable-sections.test.ts`把父`agents.vue`和index子页扫描成两个agents，导航policy只有一个。Task7未改这些文件；应按路由语义修scanner/测试，不能加重复policy或删父能力门禁 |
| 文档事实/最终collection | Task7副本baseline实际1203、新规格后1213，对应文档1179过时；全18配置最后完整1824也是更早历史值。最终联合源码重新实际收集，更新doc-facts及CI恰好一次归属，不能累加局部数推算。缺React安装导致Streamdown guard失败和8既有条件skip单独记录 |
| 剩余架构/命令清理 | `remaining-owner-task-notes.md`：React hooks.ts旧 `_threadId` warning（按identity-stripping合同修）、React主playwright webServer裸pnpm核适用边界、Vue Makefile主机提示PORT3000应与3200核齐；Docker3000不动。Task4b同组件physical host-swap额外测试为可选review建议，不是已观测产品缺陷 |
| permissions-mobile旧几何差异 | 当前一次原生观测未复现，不能据此关闭；最终共同矩阵再次核验，没有新增豁免 |
| 原始S15全矩阵差异 | 751键中556非零的历史轮仍是全量FAIL；局部已修与零差异不能推算全部清零。完整矩阵/图像/人工审阅/键盘三轴均待最终统一源 |

## 6. 全计划工作包与最终关闭条件

原计划导航：[完整计划](2026-10-09-vue-period-plan.md)、[逐工作包/九架构/共同矩阵/C条件映射](2026-10-10-vue-plan-progress-and-issues.md)、[W00–W13详细契约索引](evidence/resume-2026-10-20/handoff-document-review/README.md)。以下摘要不替代原文细项。历史文档中的缺陷状态、数量和临时路径以本文及对应新回执更新；未列入摘要的原验收义务不因此取消。

| 工作包 | 已有实现/局部证据 | 最终仍需关闭 |
| --- | --- | --- |
| W00 基准/契约 | OpenAPI/JSON、源码与实际入口冻结、拓扑收集 | 最终新统一源/所有拓扑/文档/CI/契约一致 |
| W01 账户/偏好/features | session/RBAC/locale/timezone/204、账户缓存暂态修复、Agents门禁 | 原仓集成、全auth/SQL/跨tab/账户退役/异常恢复 |
| W02 run/消息 | gap/durable/END/create/join/stop/dispose、human/附件/bridge/cache、创建归属 | 完整协议、真实run，零重复create/旧草稿/owner污染 |
| W03 产物/预览 | Range/SHA/BOM/修订/保存锁、编辑器/iframe/Mermaid | 全媒体异常/P03/完整视觉/动态owner/资源释放 |
| W04 输入/模型 | 草稿/知识/reasoning/语音/润色/上传/mentions/命令菜单 | Showcase capability、全部IME/授权/取消/提交持久化 |
| W05 能力/Agent/知识 | catalog/RBAC/Skill409/Agent包/display_name、门禁和初始焦点局部通过 | 全安装/OAuth/范围/冲突/权限和最终keyboard |
| W06 历史/来源/未读 | activity/分页/归档/source/registry/cache、删除owner局部及组合修复 | 最终prepend/追尾/resize/跨owner/恢复和删除原生重验 |
| W07 调度/channel | events/history/queue/DST/秒精度/通知复制/channel owner | Task9滚动触发详情、完整调度/channel/深链/冲突/取消 |
| W08 扩展宿主 | inline/assets模块图/导航/动作/mentions/abort/dispose | 最终权限/晚返回/卸载及真实Docker消费 |
| W09 项目/文档/trash | 四tab/instructions/上传/预览/转换/恢复、创建归属和mock/SQL局部闭环 | 完整双端/Gateway权限/冲突/分页/部分失败 |
| W10 Browser/Sidecar/设置 | binary/legacy/WS/resize/Sidecar session/memory/subagents | Task6完整原生、重连/关闭重开/释放/权限/八拓扑 |
| W11 Showcase/UI | snapshot52、Markdown/图标/表格/字体容量、多项原生闭环 | Task7/8/9及全部751对1502图/人工矩阵/键盘三轴 |
| W12 架构/历史负担/CI | 22目标退休/两个直接依赖/唯一owner/正式依赖修复/八组CI | 最终九架构/新候选归并/guard与命令清理/依赖维护/独立交付 |
| W13 全量验收/同步 | main已在main-wc历史、旧完整门禁/容器/三入口/归档 | 新统一源R04–R12、全部C条件与marker；不自行提交 |

| 步骤 | 恢复后保留的完整执行义务 |
| --- | --- |
| R00 | 重核原分支/index/private/hooks/public/WIP、归档SHA、服务归属；不能沿用旧PID |
| R01 | MCP容量P01完整验收，保留原预算/负例，不复活旧临时方案 |
| R02 | 横滚P02及P03相关约束保留，真实scroller和原生验证 |
| R03 | 已知根因修复/独立review/相关原生完成后，有界集成原仓、正常安装、生成新最终冻结 |
| R04 | 完整canonical verify、React、backend四分片+blocking/lint/format、check/audit/contracts/实际collection/icons |
| R05 | 全cross-app product→auth→SQLsession；新增数按实际collection，含三轴/751对1502图/零接受/人工审图 |
| R06 | 全5配置mock聚合、八backend拓扑、external；原mock565/backend24/external3仅历史数，保留所有新增与原错误/预算策略 |
| R07 | Linux正式visual8/payload12/assets及9人工图，实际源码和原生依赖执行身份绑定 |
| R08 | standalone default / with-e2e两个fresh目录、正常安装/全部unit/build；后者全mock/backend；仅缺React跨端允许collection-only |
| R09 | Docker七阶段：engine-context实际COPY、build-vue/build-react/probe/probe-oidc/smoke/normal-stop；canonicalGateway/双host/nonroot/SQL/退出码 |
| R10 | 原dev-vue/dev-dual/prod-vue标准入口及30/300/180秒预算；真实注册/me/权限/204/SSE/建议/刷新/stop/SQL，React3200 |
| R11 | 九架构、全部WIP有界语义审查、CI12前缀/两事件/全部规格恰好一次、dirty/untracked拒绝、失败材料可取 |
| R12 | W/R/C/九架构/共同矩阵逐项证据；文档/源码/命令/revision一致；本地集成与真实外部生产分别列 |

### 6.1 易在摘要中遗漏的原计划细项

下表用于保留原要求，不表示全部未实现，也不新增范围。最终关闭须逐项指向当前统一源码的证据；后端决定真实 wire/auth 合同，React 的实际可达行为决定参照，Vue 使用自身框架实现。不得照抄 SDK 私有字段、已失效行为或凭文档猜测后端字段。

| 对应工作包 | 恢复后必须核对的细项 |
| --- | --- |
| W00 / W01 | JSON 的 scheduled_goal_notes、scheduled_task_errors、thread_origin 及真实消费者；core OpenAPI 的 plugins空列表与显式webhook、扩展另验；能力 available/running/toolEnabled 与错误分别处理。expected-user、changed-only PATCH/null/204、403/409退休、503离线outbox、跨tab不同key、auth-disabled不发session请求；locale兼容与IANA timezone分开 |
| W02 / W04 | disconnect continue、cancel/stop/dispose及202/204/409；gap两型、terminal不冒充END、error尾帧、durable失败、run-input水合、同run join/幂等create；稳定human/附件快照。展示元数据不等于grants，恢复用原turn知识范围；引用3/4、Skill16/17原子边界、历史skill快照；run/provider、账户开放token、Agent low/medium/high/null 三套reasoning；textarea/contenteditable锁定、语音/润色取消 |
| W03 / W06 | 保存快照/SHA/412/锁与离开保护、迟到续体禁止创建资源；code/MD/HTML/image/audio/video/PDF/chart/CSV/TSV、pending/截断/分页/超时/资源上限、原始下载与转换预览。分支/压缩/adoption；activity cursor/read_version/truncated/首次seed、唯一poll与visibility标读、feature off零IO；prepend/追尾/目录/折叠/长输出/动态测量与混合AI-tool边界 |
| W05 | models与capabilities迁移；旧settings深链保持React行为及其他query/focus，不自动重写；平台/个人MCP、secret与installation ID、Lark owner；Skill409明确刷新不自动重试下载；Agent name/display_name、100 Unicode、create-only导入/409/无私密导出；knowledge all/none/selected/搜索分页/默认值/409与503/权限门禁 |
| W07 | 实际页面hook接线、task_id/thread_id、搜索tab/404/重复删除续期；run_at秒精度/DST fold、未改interval保留秒、PATCH省略与null；fresh/reuse、goal/stop/max_runs/end_at。task与occurrence、queued/launching/running/unmet/failed、paused手动触发及冲突；取51显50、仅page0轮询/focus/reconnect/Abort/key重置；每task-turn最后卡片、只读scheduled human与隐藏启动文本、删除后title snapshot；通知字段存在性/locale/timezone/pending-retry/MCP身份/subagent历史停止 |
| W08 / W09 | 扩展inline/assets模块图、相对chunk、单贡献故障隔离；所有page/nav/toolbar/sidebar/mentions、viewer expected-user/action allowlist/Abort/dispose/custom-Agent/晚返回；capabilities Reload与asset404分开，Python安装走CLI。项目四tab及刷新不臆造tab URL；UTF8 instructions/A→B/rename name-only；next_offset/200上限/截断；archive可读/可附加而禁止写；暂存附件跨路由去重、真实filename；trash missing project/merged/content_missing409、整库清理500部分成功refetch/跨用户404 |
| W10 / W11 | account/appearance/notifications/channels/memory/subagents/about、密码/退出/OAuth/快捷键/互斥面板恢复；Browser二进制JPEG与legacy JSON/base64、WS重连/blob/导航/重试/焦点几何，Sidecar独立协议鉴权；memory missing/edit/reset、repository与worker历史分开。所有注册Showcase案例/资源/unknown404/只读无隐藏写；原文仅按React翻译、UI含shadow/backdrop。旧13案例与52资源、70样本均为各自历史口径，70不是13×8，最终按实际registry和完整矩阵核对 |
| W12 / W13 | 有真实替代/消费者证据后才退休旧代码；保留Nuxt自动入口、worker URL、types、M0原生Resizable及原WIP，不追文件/测试数量。CI全部失败材料及隐藏.cache上传（include-hidden-files）、两事件/前缀/规格恰好一次；audit按advisory+版本+可达性。README/ARCHITECTURE/BEHAVIOR/OpenAPI/AGENTS同步，不编辑CLAUDE；frontend/backend/contracts marker分别核验，missing React/history/dirty为UNKNOWN或REVIEW_REQUIRED，不自动接受HEAD。同构建参数复用仅可选优化；远程required checks/附件上传未观察仍列UNOBSERVED |

P01–P03原定义在[10月10日问题与进度](2026-10-10-vue-plan-progress-and-issues.md)第4节；F01/F02既有修复、F03–F14逐组对应在[10月20日全计划交接](2026-10-20-vue-whole-plan-paused-handoff.md)第3.1–3.2节。旧“九份未应用方案”的历史清单仅作追溯，当前是否应用以第2–5节与各application回执为准，不把它们误当九项架构或重新整树应用。

### 6.2 九架构、共同矩阵和关闭条件

九架构全部保留：①消息虚拟化真实scroller；②聊天编排/草稿提交/adoption；③唯一状态owner；④query identity/features/mutation发起身份；⑤Lark单流程owner；⑥孤立代码/真实消费者；⑦重复算法真实行为差异；⑧历史叙事/门禁/负控/失败归档；⑨必要UI适配/原生焦点/键盘。当前有界审阅不等于全部最终运行闭环。

共同矩阵保持同Gateway/seed/权限/字体/浏览器/时钟，中英×明暗×桌面/手机及真实主题限制；loading/empty/error/selected/disabled/hover/focus；低高度/200%文字/双向resize/弹层表单多面板；直达/刷新/返回/深链/404；跨tab/用户/线程/Agent/持久化；离线/超时/鉴权/资源消失/冲突/SSE中断/部分上传/授权过期后继续；资产/长会话/本地/独立/Compose拓扑。

| C关闭条件（均未整项最终关闭） | 必须保留 |
| --- | --- |
| C01 | 全范围入口/动作，仅三项排除 |
| C02 | Showcase公开案例/资源/只读/UI，写操作另用真实验收 |
| C03 | 全WIP真实接线或有依据移除，无半迁移 |
| C04 | P01–P03/F01–F14及新失败根因和永久回归，含F01草稿期限、F02搜索括号redo/Escape |
| C05 | gap/durable/human ID/run input/附件，无重复创建或旧草稿假提交 |
| C06 | 偏好/locale/timezone、引用授权、三套reasoning/知识/Agent/来源/未读 |
| C07 | 调度/channel、项目四tab/trash部分失败、扩展完整宿主 |
| C08 | 功能/流程/行为/UI双端、751/1502与人工，无新增豁免 |
| C09 | 九架构/历史负担/唯一owner/真实消费者/必要无障碍 |
| C10 | 当前backend REST/SSE/JSON、持久化/取消/异常恢复 |
| C11 | 全verify/浏览器/backend/visual、CI和失败材料 |
| C12 | Vue构建/无React独立交付/本地三入口/容器分别实证 |
| C13 | 文档/源码/命令/结果/marker一致，dirty拒绝，不擅自提交 |

## 7. 历史完整门禁不能改绑当前源

| 门禁 | 最后完整历史结果 | 当前意义 |
| --- | --- | --- |
| S15 canonical/React | Vue523文件4701测试及完整检查；React340文件3159/check | 历史PASS，不是当前修复源 |
| S15 full cross-app | 1114 product PASS、1全矩阵FAIL，直接exit2，约6.2小时；当次auth21/SQL8未执行；3008原始文件约222MB保全 | 全量仍FAIL，局部诊断不能抵消 |
| S15 mock/backend浏览器/external | 565 / 八拓扑24 / 3通过 | 当前最终源要全量重做 |
| B15 backend | 四分片27186 PASS/414原策略SKIP；blocking235、lint/format通过 | 不说零跳过，不继承当前源 |
| Linux15 | visual8/payload12/assets与9PNG人工，归属/恢复边界通过 | 最终重新绑定；容器137不是产品SIGTERM证据 |
| Standalone15 | 两模式全结束；4639 PASS/62原React缺席SKIP；with-e2e mock565/backend24；3负控 | 无React跨端只收集；最终fresh两模式重做 |
| D19 Docker | 三镜像/engineCOPY/probe/OIDC并发/smoke/normal-stop/SQL；5容器已停 | Vue exit0/React entry exit1/IdP143原样；欢迎页截图不证明全UI |
| local18 | 三标准入口/真实注册204/单SSE/3建议/刷新持久化/stop/SQL/端口通过 | 旧源，最终源再跑，无AiPPT动作 |
| R11历史 | 1472公开WIP映射、76近期输入、dirty124/untracked56负控、CI12前缀两事件 | 不等于1472文件逐行审阅/R11关闭，远程CI未观察 |

实际收集边界：`current-collection-after-project-focus/execution.json` 记录2026-10-28 21:59+08全18配置1824（parity1187/session16/mock517）；之后新增规格未做最终全18汇总。`ci-ownership-after-memory-spec29.json` 记录2026-10-29 12:16+08只读观察77个parity整文件分入8组各一次、interactions64；不是最终全部新增规格清单，也不是远程CI执行。

视觉完整范围仍为751对1502 PNG：逐key/文件/解码/尺寸/缺失/额外，另做已承诺人工18对36图、4成功附件8图、8编辑器格式主题×两端×Source/Edit的32选样（完整编辑器14case56图）、Linux9图。已有采样不能称1502全人工。当前diff测语义/几何/选定computed styles，不是整图逐像素自动比较；截图失败可能不使主diff失败。Darwin P03阈值仍0.02，旧约0.03失败不能接受。

真实外部LLM、IM、IdP、DNS/TLS、外层代理、远程CI仍 **UNOBSERVED**。受控本地Gateway/IdP/replay通过不能提升成这些生产环境通过。Stage43旧临时失败原件缺失的历史限制仍存在，本轮新保全不能补称它已恢复。

## 8. 持久源码保全、保护边界和恢复顺序

持久目录：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-10-28/pause-preservation-2026-10-29/`。

| 持久归档 | 公共成员/fixture | SHA-256 |
| --- | --- | --- |
| `original-public-source.tar.gz` | 5836 / 0 | `1104d820abd931de4a2c5cd662c837bd489edfafaf50a024c3b9a0b4d8bb4d53` |
| `s7-public-source.tar.gz` | 5870 / 2 | `30d7a38073e8ebd644d824f3368411ad68d761fda2d66fd1b6dd9c5d88152f51` |
| `task7-rejected-candidate-source.tar.gz` | 5859 / 2 | `6ff46dbfdf77f1d930bc377eba54b1ad612affca80a9a602c8ff351aac32cac2` |
| `task8-task9-prepared-source.tar.gz` | 5860 / 2 | `89d289c83a5d7077c2979b2f86c5557a71536344fb6bd469d70a9943ce370053` |

暂停保全时四份归档均逐成员读取校验，源文件前后SHA一致；inputs/receipt分别保存，不依赖临时副本。Task8与Task9公共内容逐字相同，共用一份归档，两个原路径均已核验；Task7归档是**未通过审查的独立候选**，不能误当已审核S7。原仓归档不含本次新增交接文档，本文与最新ledger独立持久保存。S7已经含Task7的冻结原生规格（test-only overlay），但没有Task7未获批准的产品实现；不能因规格存在就认定实现已集成。

- `pending-candidate-inventory.json` / `pending-candidates.diff`：原仓与最终S7有 **108个待应用候选路径 + 1个仅Nuxt buildDir隔离差异**。明列每路径原/候选SHA和新增/修改，后者不得应用原仓；不是旧23+3数量。S7的最新公共快照是权威，不能拿旧proposed整树覆盖。
- `actual-runtime-readback.json` / `actual-runtime/`：31个实际依赖源码/分发/types入口逐字持久保存，仅供证据比对；恢复必须正常pnpm锁安装，不能把这些文件复制进node_modules冒充安装。
- `attachment-readback.json`：暂停保全时本轮42个preserved清单的 **492个附件引用** 全部存在且SHA相符；这是N28本轮范围，不补称旧Stage43缺失材料已恢复。
- `host-check-permitted.json`：13:39:04+08只读核验，5,836基线公开输入零变化；当时新增公开路径仅本文；branch/HEAD/main/index/private/hooks一致、无unmerged，main为HEAD祖先。首次sandbox ps被拒绝另存`host-check-sandbox-failure.json`，不是“无进程”证据。
- `team-state.json`：实现和两位reviewer均已完成，无活动子任务。未发终止信号、未启动/停止服务、未操作AiPPT或删除容器/数据。
- `restore-public-source.py`：提供恢复后可用的安全归档助手，只在新`/private/tmp/deerflow-restored-…`目录逐成员恢复和校验，不安装、不初始化Git、不启动服务、不改原仓。**本次只做源码语法核验与归档readback，未执行新路径恢复/正常安装演练**；此限制保留。


归档只允许清单内普通文件、安全相对路径、无重复/无symlink；不含原私有配置/Git/index/hooks/node_modules/构建/运行数据/evidence。副本 `config.yaml` / `extensions_config.json` 仅是逐字等于公共example且单列SHA的fixture。证据/截图/trace仍在仓库N28及前轮持久目录，不依赖 `/tmp`。

下一次恢复必须按顺序：

1. 先读本交接、N28 `current-state.json`、`progress.md`，再适用根/模块AGENTS。重核现场和用户后续改动；旧“ACTIVE/进行中”历史段落不覆盖最新暂停状态。
2. 校验持久归档SHA及每成员；临时副本不存在则恢复至新建隔离目录，禁止整树覆盖原仓。已含Nuxt buildDir隔离变换，不重复插入。不复制真实私有配置。建立独立公共Git fixture、正常依赖与实际入口归属核验，新路径用新binding，不改旧回执。
3. 从最终S7冻结开始 Task6 **17完整规格+完整框架Memory/删除组**的候选原生验收。保留失败和全部附件、实际collection/retries0；运行期间不改该副本。已有before/proposed/旧基线不可覆盖。
4. Task7先按独立review R1做有意义RED→根因修复→完整相关静态/组件→独立复审→有界组合；保留十项immutable native及完整影响组。其旧副本不含最新Task6，不能整树回灌S7，共享README/ARCH只做语义合并。
5. 顺序完成 Task8/9、类型化身份观察和已列最终清理；一个实现worker，独立review可并行。准备副本早于Task6，不继承最新原生/依赖结论；先按明确清单同步当前候选或建立新基线。
6. 所有已知根因和相关原生闭环后，审查完整 before/proposed/预期集合，保护原WIP/index/private/hooks，再有界应用原仓、正常锁安装、记录新统一冻结。原工作区没有这些增量，不能漏此步骤。
7. 新执行目录重绑全部R04–R10完整标准入口、backend/Linux/standalone/Docker/local/编辑器图。没有预先存在的“新最终轮PASS”，不能仅重命名S15；长套件在单副本串行。
8. 完成R11/R12、全部W/C/九架构/共同矩阵、图像完整性与人工、文档/CI/负控/依赖维护。外部生产缺环境证据单列UNOBSERVED；按用户另行指示提交/发布。

### 8.1 恢复脚本的实际绑定与范围

- `run-memory-close-native.py`、`run-memory-mock-native.py`、`run-route-head-native.py` 的实际ROOT读取 N28 `copy-path.txt`，不是从传入source manifest的copy字段决定。恢复到新目录后，单换manifest或label不足；在新的执行目录保存并审查对应runner、copy-path、source/runtime与preserve工具引用的完整绑定，旧回执不改。先核路径/参数/正常安装/实际入口，再运行。
- Memory原生runner未显式传spec时只跑 `memory-dialog-close`；必须显式传 `memory-close-fix/planned-native-groups.json` 的全部17规格，并核实际collection。框架runner默认两端：React两规格，Vue三规格；不得传单端后称双端通过。
- 两runner均显式传入最新31入口runtime manifest；框架runner默认的旧 `reka-restored-entrypoints.json` 不是当前schema/入口集合，不能沿用。使用新label、新输出目录、原retries0及完整规格，所有失败/partial与附件均保存。新路径恢复、依赖安装、这些原生/框架命令本次全部UNRUN。

### 8.2 最终大轮工具导航（历史工具，恢复后先重绑）

下表路径相对仓库 `docs/reports/evidence/`，仅定位已保存工具；不表示现在允许执行或已有当前源结果。

| 用途 | 确切持久目录与入口 |
| --- | --- |
| S15 全量canonical/React/collection/icons/cross-app/mock/backend/external | `root-stage56-attempt15-final/`：prepare-source-copy.py、prepare-frozen-dependencies.py、prepare-browser-copy.py、run-frozen-gate.py；按runner区分root copy与browser copy |
| B15 Python backend | `resume-2026-10-26/backend-full-attempt15/run-backend-full.py`；manifest/source/readiness及内部常量全部一致，四分片/blocking/lint/format不可省 |
| Linux15 | `2026-10-26-linux-stage56-attempt15/`：prepare-native.py、run-gate.py、run-observer.py、native-provenance-v2.py、execution-identity-v2.py、capture-linux-inputs-v2.py；绑定实际原生依赖与执行身份，不退回v1 |
| Standalone15 | `resume-2026-10-26/standalone-attempt15/`：prepare-outer.mjs、capture-outer.py、run-standalone.py、capture-standalone-inputs.py、validate-observer.py；default/with-e2e分别fresh，负控不替代正式运行 |
| D19 Docker | `container-ingress-stage56-attempt19/`：freeze-binding.json、run-light-preparation.py、prepare-runtime.py、run-phase.py、run-build-sequence.py、runtime-proof.py、run.sh；先实际engine-context再六phase，canonical Gateway及停止/SQL证据保留 |
| local18 三入口 | `local-entry/stage56-attempt18/`、`local-entry/stage56-attempt18-dev-dual/`、`local-entry/stage56-attempt18-prod-vue/`：各自binding.json、source-copy.py、run-entry.py、browser-flow.mjs；重新核端口3200/3100与入口预算，不照抄旧3000占用处理 |
| 图像完整性/人工取样/保全 | `root-stage56-attempt4-cross-app-checkpoints/preserve-formal-artifacts.py`、同目录verify-parity-png-evidence.py；`resume-2026-10-18/capture-editor-visuals-stage56.py`；`resume-2026-10-18/visual-review-stage55/plan.json`；旧工具须新源新receipt，成功前置不能用定向PASS替代 |

恢复工具：本轮 `run-memory-close-native.py` / `run-memory-mock-native.py` / `run-route-head-native.py` 及各任务brief；最终大轮参照旧 `root-stage56-attempt15-final/`、B15、Linux15、`standalone-attempt15/`、D19、local18，先读源码重建binding。某些工具硬编码manifest/旧路径，不能只改输出名称。React文档启动120秒原约束保留；backend browser extra/匹配Chromium、Readabilipy初始化、公共Git fixture/readiness、受控SQL/seed/runtime home、核心OpenAPI `plugins: []`与显式webhook等仍需准备，扩展fixture单验。失败保全工具若移动附件，preserve-report传真实失败目录；partial保留，不能吞缺失。

### 8.3 文档复核不改写历史证明

`pause-preservation-2026-10-29/final-boundary.json` 的handoff哈希绑定13:42时旧版本文。此次补全文档后哈希自然改变，旧回执、四份归档与执行结果不重写；新文档哈希、链接/范围检查及源码保护复核另存 `handoff-document-review-2026-10-29/verification.json`。13:39宿主快照及42清单/492附件检查仍各代表原暂停时点，本次未重新执行宿主进程/端口/容器检查。

## 9. 暂停完成确认

当前组合修复已审核、集成并完成同组实际1567测试，已停止产品实现与验收，仅完成交接保全。**13:39:04+08** 实际只读宿主快照：按本仓/验收副本路径没有匹配运行进程，列明29端口无监听（含3000/3100/3200/3430/3431/8330），29个本计划命名容器均为exited。没有发送信号、没有启停其他项目、没有清理数据。该快照只证明当时，恢复须重核。

最终状态为 **整个计划暂停、尚未完成、范围不缩水**。当前缺陷/未验工作从第4–6节恢复；文档历史ACTIVE/旧临时路径/旧候选“尚未集成”描述只能作为当时记录，不能替代本文最新状态。

下次可直接说：**读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-29-vue-whole-plan-paused-handoff.md`，恢复整个计划，不缩水；先核持久归档与现场，从第8节按顺序执行。**
