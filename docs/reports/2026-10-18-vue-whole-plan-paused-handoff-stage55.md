# Vue 全计划暂停交接：Stage55 后续候选验收

**状态：PAUSED_USER_REQUEST。** 2026-10-18 23:42（Asia/Shanghai）验收进程已退出，随后完成证据保全和现场核对。用户要求“找个干净的点干完后，然后写个交接文档，后续有空了，再继续做”。停在候选定向回归及完整844键盘遍历已完成之后：正常SIGINT停止剩余整套调度，保留18个实际失败、1个被中断用例和71个未运行用例的区别。没有为追求全绿继续修复或启动下一轮。整个计划现已暂停，下一次明确恢复后才能继续。

仓库绝对路径：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。本文件覆盖**整个计划**，不是仅交接最后几个焦点缺陷。W00–W13、R00–R12、C01–C13、九项架构及共同矩阵全部保留。总进度仍沿用约 **80% 工作量估计**，不是测试通过率；本轮还有真实失败及尚未落地的修复，不能说代码已全部收尾或只剩形式验收。

## 1. 范围、依据与授权边界

- 当前 `frontend`（React）、`frontend-vue`（Nuxt/Vue）、`backend`、`contracts` 及真实消费者优先于文档。功能、流程、行为、UI样式必须可平替；可从根因重构Vue和清理历史负担。
- 仅三项不要求同步：Vue首页内容、docs/blog内容站、整站无后端静态回放。**Showcase仍需完整对齐**；必要无障碍、原生键盘/焦点、滚动与可达性不能整类删除。
- 不删失败样本、增加跳过、提高预算、放宽断言、更新接受差异台账、以mock替代被验证机制、手改node_modules或编造后端字段来过关。
- 原计划：[本期执行计划](2026-10-09-vue-period-plan.md)；完整工作包/九项架构/共同矩阵：[进度与问题索引](2026-10-10-vue-plan-progress-and-issues.md)。[Stage54交接](2026-10-12-vue-whole-plan-paused-handoff-stage54.md)及旧暂停记录均保留为历史，当前事实由本文件和实际收据覆盖。
- 原仓库维持 `main-wc`。没有为本次候选提交、推送、切分支、reset、stash或接受marker；不要为提交另建分支。最终commit/push仍待用户明确要求。
- 暂停后只允许本次文档/保全/停止/只读核验；下一次必须由用户明确恢复整个计划，才可继续安装、测试、构建、启动服务和产品修改。

## 2. 不能混淆的三层源码

| 层次 | 当前含义 | 位置 |
| --- | --- | --- |
| 原工作区 / Stage55 | F01草稿deadline、F02编辑器等已落地；5742公共源。完整Stage55 cross-app仍失败 | 原仓库；冻结副本 `/private/tmp/deerflow-next-final-stage55-7r190c1d` |
| 61文件统一候选 | F03–F11候选及8份配套文档，只并入诊断副本，**未回写原WIP**；5756公共源+2公开配置夹具；本轮部分失败后按用户请求中断 | `/private/tmp/deerflow-resume-20261018-restored-y35om1ot`；持久候选 `docs/reports/evidence/resume-2026-10-18/unified-candidate/` |
| 待并入的后续候选 | F11 textarea布局、F12 iframe入口、F13测量负对照、F14通知键盘及卸载；**尚未进入上述61文件验收** | 下文逐项列出的F目录，均在仓库持久证据内 |

统一候选清单 `unified-candidate/manifest.json` 有61文件；`pending-docs/manifest.json` 有8文档。`f11-checks/inputs.json` 固定5756源，`runner-revision-f11/source-provenance.json` 证明来源恰为Stage55的 `copyRows` 加61候选和8文档，无未声明差异。Nuxt隔离副本唯一原转换仍是 `buildDir: "./.nuxt"`；核副本用copyRows，不能误与sourceRows直接比较后把该转换当新漂移。

当前 `run-native.py` 和 `integrate-validated-candidate.py` **固定绑定61/5756/25份spec**。前者已有执行目录，禁止覆盖重跑；后者要求该次完整原生零失败/零跳过/零flaky，当前结果为FAIL且用户已暂停，**不可直接执行**。恢复后需保存旧版本、精确合并后续候选、重新形成完整清单/围栏/测试收集及新runner，不能只改一个成功字段绕过准入。

## 3. 已完成及未完成的实际证据

| 项目 | 结果与边界 | 持久证据（均相对仓库根） |
| --- | --- | --- |
| F01草稿保存期限 | 真实挂载/storage/query/受控时钟复现deadline被无关render推迟；按有效草稿和owner计时，4文件65 PASS | `docs/reports/evidence/resume-2026-10-18/f01-*` |
| F02编辑器 | 搜索事件、初始JSON括号、Lezer身份、平台redo及Vue桌面Escape归属根因处理；最终完整原生14 PASS/0 FAIL/0 SKIP | `.../f02-native-editor-panel-ownership/`，相关前序RED/GREEN均保留 |
| Stage55 React完整 | 326文件3001 PASS，check退出0 | `docs/reports/evidence/root-stage55-cross-app-checkpoints/final-react/` |
| Stage55 Vue完整canonical | 497文件4138 PASS；lint/format/types/OpenAPI/build/assets/consumer/audit等实际原门禁退出0。audit有既有精确审查，不能描述为零漏洞 | 同上 `final-canonical/`、`final-icons/` |
| Stage55完整收集 | 18配置1632项，其中product1008。仅收集通过 | 同上 `final-collection/` |
| Stage55完整cross-app | **986 PASS /21 FAIL /1 did-not-run，directExit2**；后续auth21/真实SQL session8 UNRUN。非用户中断，不能写成“测试没跑完所以失败” | 同上 `final-cross-app/`；汇总 `resume-2026-10-18/stage55-final-result.json` |
| Stage55 751视觉宏 | 仅156完整截图对，失败于旧Tooltip delayed-open-only前置；不满足751对/1502PNG或零接受差异台账 | 同上完整日志与保全目录 |
| Stage55失败全量保全 | 3216文件/4629023977 bytes，SHA逐项核对，**PASS_PRESERVATION_ONLY** | `root-stage55-cross-app-checkpoints/final-cross-app-preserved/`；inventory SHA `4e622763e1c9afa26cb75740460c83bb186181bf2d14322052a94c971cde2f76` |
| 61候选定向/静态 | 最近31文件303 PASS，全Vue app/tests类型、候选lint/format、i18n通过。早期React118/Vue129、49守卫等只证明各自范围 | `unified-candidate/f11-checks/` 及其README索引 |
| 61候选完整收集 | 18配置1681项，其中product1057；新增正式回归未替换原样本。**收集不等于浏览器PASS** | `unified-candidate/f11-collection/` |
| 61候选25spec生产原生 | 原生产构建、原预算；实际 **55 PASS /18 FAIL /1 interrupted /71 did-not-run**，directExit130。完整844遍历已执行，后续三轴宏等未执行；不是完整门禁PASS | `unified-candidate/native-production/` |
| 后端完整四门 | 最近完整实际PASS仍是Stage54：27149 PASS/414原有SKIP，blocking235 PASS，lint/format退出0。Stage55/新候选全量后端尚未跑，不能搬用旧PASS | `docs/reports/evidence/resume-2026-10-11/backend-full-stage54/actual/` |

原Stage55收据完整source/dependencies/runtime围栏无漂移，backend依赖核验退出0；原始失败和warnings不覆盖。新的候选源码需要新的全量验证，不能将旧完整PASS和新定向PASS拼成当前整体验收。

## 4. F03–F14精确恢复位置

以下前缀统一为 `docs/reports/evidence/resume-2026-10-18/`，每个目录有原始失败、局部诊断和版本清单。旧README里的“正在运行/未应用”只指各自写入时点；以本交接、统一manifest及实际receipt为准。

| 编号 | 根因与本轮状态 | 恢复时读什么 |
| --- | --- | --- |
| F03 | Tooltip合法instant-open被delayed-open-only前置拒绝；另含可达性/窄屏/场景/视觉宏前置。修复在61候选内，完整原始4个失败场景还须新源全聚合复验 | `f03-content-reachable/`、tooltip诊断及统一manifest |
| F04 | 原键盘环测量区分有限DOM变化、浏览器边界、实际陷阱；相关产品focus边界及唯一owner修复已入61。保留原844遍历和原固定初始容量预算 | `f04-keyboard-order/`、`keyboard-order.spec.ts`完整结果 |
| F05 | 原公共夹具同一行 `$$x$$`实际是inline math，不能断言block；改为真正分行块公式，原排版/流式/亮暗/宽度断言保留 | `f05-markdown-presentation/`，61候选内 |
| F06 | Mermaid fullscreen的实际Dialog owner与定位/生命周期 | 统一manifest所指候选及原完整4项失败产物；不能凭定位修正就称下载/焦点/Escape全通过 |
| F07 | 静止指针因列表滚动重新mouseenter抢活动项，加上测量过早固定旧ID；两端所有权与实际目标等待同修，保留全部选项 | `f07-reference-popup/`，61候选内 |
| F08 | 首次批次请求未完成就采ARIA树，后续导航取消；按真实响应稳定取样，保留两次全树比较 | `f08-topology/`，61候选内；原React串行case未运行不能算PASS |
| F09 | 三轴原生焦点：负入口、portals、knowledge返回、通知、skill标题、table和model-picker等；相关候选入61。当前通知新增问题另由F14处理 | `f09-triple-keyboard/`、新 `focus-capacity-regressions.spec.ts` |
| F10 | 产物内外滚动容量、长链接/表格、instructions自然换行、Delete project完整标签；两端产品修复入61 | `f10-triple-reflow/`、三轴完整宏及新增局部正式spec |
| F11 | Agent页头动作组、canonical metadata、实际stream导出、不补造created_at等已入61。原生6case中4通过，两个360px/200%仍差12px，根因是Vue textarea inline基线占高 | `f11-visible-layout/README.md`；**后续候选 `candidate-v2/ChatComposer.vue` 仅加真实textarea flex，未并入**。DOM级6组合实验消除12px，尚未完整源构建复验 |
| F12 | 两端sandbox无内层可聚焦元素的HTML文档被完整Chromium正向Tab跳过；仅外层iframe tabindex无效。ready时给未声明tabindex的body设0，保留作者0/-1及sandbox | **`f12-iframe-forward/candidate-v1/files/` 5文件，未并入**；`candidate-native-v2.json` 16原生对照PASS；Vue `units-v2` 6PASS、React `units-v4-react` 6PASS。原版各4PASS/2FAIL。整站spec、类型/格式仍待 |
| F13 | 两条旧测量负对照仍断言60/61次立即结束，与已明确的原固定容量预算不一致。修真正无限增长/替换负控，不改helper或预算 | **`f13-keyboard-measurement-contract/candidate-v2/keyboard-measurement.spec.ts` 未并入**；`native-v2` 原版10PASS/2FAIL，候选12PASS/0FAIL/0SKIP/0flaky；5756输入不变 |
| F14 | focusout恢复activeElement后，同一Tab默认动作仍使网页失焦。仅在通知实际首尾取消原生离开并返回真实入口；内部动作导航保留。React卸载还需揭示真实入口 | **`f14-toast-return/candidate-v3/files/` 4文件未并入**；产品字节等于v2。`native-components-v2` 两端候选16/16实际组件原生PASS，原版负控失败；Vue单位16PASS、React `units-v3-react` 11PASS。完整应用正式复验仍待 |

F12/F14的独立Rstest诊断曾因.cache默认排除、tsconfig paths优先级而没有执行/没有绑定候选；失败记录保留，不能误引用这些轮次。最新React分别是 `units-v4-react` / `units-v3-react`，实际收集和负对照均确认。F14不以只看activeElement、延时或强制页面置前冒充焦点修复。

这11份后续文件（F11×1、F12×5、F13×1、F14×4）可能覆盖统一候选中的现有路径；**不要把61+11简单当成新清单条数**。按路径合并、核每项基准SHA、保留所有先前修改，补类型/格式、完整收集、准确文档与新输入围栏。当前暂停不执行这步。

P01（MCP编辑器容量）与P02（Vue侧栏横滚）的根因修复已落源，仍纳入完整验收。P03仍需新源真实Gateway截图复验：旧源backend阶段protocol 2PASS、real 5PASS/1 Darwin截图FAIL（约21032px，差异约0.03超过原0.02），后续六拓扑16项及external3项未执行；旧mock560PASS属于旧输入。保留原baseline/0.02，不直接断言当前仍必现，也不据定向通过宣布关闭。入口仍为R06完整八拓扑与external，详见原进度文档P03节。

## 5. W00–W13全工作包状态

“已实施”不等于最终关闭。当前所有未完成条件继续保留。

| 工作包 | 已实施/阶段证据 | 最后仍缺什么 |
| --- | --- | --- |
| W00 基准/契约 | 三端范围、OpenAPI真实消费、隔离输入/退出码、完整收集 | 新候选所有拓扑一致性、CI和最终文档 |
| W01 账户/偏好/features | session owner、RBAC、locale/timezone、字段PATCH、能力语义及阶段回归 | auth21、真实SQL session8、全部异常/恢复/切用户 |
| W02 run/消息 | gap/durable/END、create/join/stop/dispose、human ID、附件owner、HIL及消息动作 | 完整protocol/real/双端；不重复create、不污染旧owner |
| W03 产物/预览 | bounded/Range/SHA/conflict/保存锁/资源退休、F02编辑器14原生PASS | F12、完整产物/媒体、P03真实Gateway截图与751人工复核 |
| W04 输入/模型 | 草稿/附件/引用/知识/reasoning/语音owner，F01已修 | F11大字号输入布局、完整输入/模型/浮层、mock和真实提交 |
| W05 能力/Agent/知识 | gallery/安装/权限、Skill409、定义包/知识范围，MCP容量修复 | 能力、Agent、知识真实拓扑及双端最终验收 |
| W06 历史/来源/未读 | activity、虚拟化、原生滚动owner、删除部分失败与历史 | 完整分页/追尾/resize/删除、归档直达、跨owner及持久化 |
| W07 调度/channel | 页面/卡片/prompt/events/分页、queue/DST/后台owner及通知 | scheduled/channels/agents/settings真实聚合与双端 |
| W08 扩展完整宿主 | assets/inline、模块图/页面/导航/动作/mentions生命周期，fixture阶段PASS | 全宿主权限/晚返回/卸载及Docker实际消费 |
| W09 项目/文档/trash | 四tabs、instructions、分页/附加/预览/转换/冲突/部分失败 | 全项目/trash双端和真实Gateway恢复 |
| W10 浏览器/Sidecar等 | WorkspacePanels原生resize、280ms呈现退出、Agent identity/ABA、设置/memory/subagent | 全站真实面板/权限/请求中关闭/重开与受控外部链 |
| W11 Showcase/UI | 全案例登记、渲染/流式/math/tooltip及完整矩阵接线 | 751对/1502PNG、零差异接受台账、Showcase动作和人工审图 |
| W12 架构/历史负担/CI | 状态owner收敛、Pinia/Splitpanes/孤立模型退役、必要守卫及负控保留、正常依赖修复 | 九项架构最终消费者+运行闭合，Linux/独立运行/CI/部署 |
| W13 全量验收/同步 | Stage55基础PASS、完整失败已分类保全、候选精确来源 | 全部R04–R12、WIP增量审阅和marker最终关闭 |

## 6. R00–R12全部剩余任务和运行入口

所有重型build/全聚合顺序执行；新源必须新轮次，不覆盖任何55收据。Stage56工具已准备75文件并做inverse-byte/AST/语法检查，但**仍为UNBOUND_STAGE56_MANIFEST，没有实际执行授权延续到暂停期间**。

| 任务 | 已有准备与准确下一步 |
| --- | --- |
| R00 | 恢复先读本文件与pause-preservation，核真实分支/HEAD/WIP/index/私有hash、临时副本是否完整、端口/进程出生与cwd；旧PID不能直接操作 |
| R01/R02 | 旧MCP/侧栏根因修复已经实施，保留原回归并纳入最终完整双端，不无理由重做 |
| R03 | 先处理本次25spec全部真实失败并合并F11–F14，完成新候选完整诊断后精确回写原WIP；同步文档，建立新独立Stage56公共源与正常fresh frozen依赖。保留公开fixtures、唯一Nuxt转换、独立Git/正常Readabilipy前置和所有围栏 |
| R04 | 新源完整Vue `make verify` / asset / consumer / audit / extension fixture / icons、完整React check/unit及原18配置收集；backend `make test`四分片、blocking-io、lint、format-check按原入口全跑。不能用定向替代 |
| R05 | 原 `make -j1 -C frontend-vue e2e-cross-app` 完整product→auth→SQL-session；751/1502全部解码/尺寸/零接受台账核验及人工审图。源码变化后全聚合重新执行，不拼接旧通过项 |
| R06 | 独立浏览器副本准备为 `/private/tmp/deerflow-vue-browser-stage55-iely47xc`，依赖已装，实际full mock/backend/external均UNRUN。新源需重新派生。backend保protocol/real/scheduled/channels/agents/settings/shell/browser八拓扑及P03；external受控WS/OIDC不等于真实IdP |
| R07 | Stage55 Linux仅正常fetch1119/offline install与字体/runtime capture；8visual/12payload/asset、额外8+12捕获及9图人工审阅均未跑。固定Playwright1.59.1-noble镜像SHA `b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`、ARM64、Node24.14.1、host IPC保留；Stage56重新绑定 |
| R08 | Stage55 standalone outer `/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-pGM2la` 已形成4491源+2metadata，无React/私有配置/依赖，observer负控PASS；两种fresh inner实际安装/完整unit/build未跑。`--with-e2e`还必须真实完整mock/backend；只有依赖React的parity配置collection-only |
| R09 | Stage55 Docker项目 `deerflow-vue-ingress-6b30c6a577`、端口2426/2486只有只读准备；Gateway/React/Vue canonical build、engine COPY、build-vue/build-react/probe/probe-oidc/smoke/normal-stop六phase、非root/SQL/SIGTERM均UNRUN。新源重新绑定，不用旧镜像假验收 |
| R10 | dev-vue `/private/tmp/deerflow-local-entry-stage55-ywr9kv80`；dev-dual `...-tc8w5vlx`；prod-vue `...-y80nwvdr`，仅源副本，未安装/启动。原30/300/180秒启动预算、注册/me/permissions/preferences204、单SSE/context/三suggestions、刷新持久会话、无重复提交、同owner正常停止/SQL保全全部保留 |
| R11 | 原deps已正常frozen更新，React Lezer安装图通过正常force install恢复，相关原17项PASS；没有手改node_modules。Stage55九项架构消费者审阅、增量19文件、CI接线审阅已记录，11个WATCHED prefix快照84 tracked-dirty+29 untracked=113，marker仍REVIEW_REQUIRED。新候选及新增文档须重新枚举/审核，不能接受旧marker |
| R12 | 逐一关闭W/R/C/九架构/共同矩阵与文档；分开代码、本地集成/双端、外部生产条件；必需FAIL/UNRUN在则不报整体完成。commit/push单独等待用户要求 |

Stage55/56的 `prepare-source-copy.py` 已改为从当前枚举公共源新建独立目录，不再依赖失效的Stage47临时模板；旧Stage54交接关于必须先恢复Stage47物理模板的前提已过期。新副本的独立Git、后端合成HEAD和依赖/Readabilipy预热仍按各原工具实际前置执行。

Stage56准确工具位置：

- `docs/reports/evidence/root-stage56-cross-app-checkpoints/`：source/dependency/browser factory、run-frozen-gate、preserve-formal-artifacts、verify-parity-png-evidence。
- `docs/reports/evidence/2026-10-18-linux-stage56/`。
- `docs/reports/evidence/resume-2026-10-18/standalone-round56/` 与 `backend-full-stage56/run-backend-full.py`。
- `docs/reports/evidence/container-ingress-stage56/`。
- `docs/reports/evidence/local-entry/stage56/` 及工具声明的stage56-dev-dual/stage56-prod-vue位置。
- `docs/reports/evidence/resume-2026-10-18/prepare-stage56-tools.py`、`stage56-tool-preparation/execution.json`、`capture-editor-visuals-stage56.py`。当前为准备态，恢复时核实际路径与绑定，不跳过准入assert。

人工视觉以 `docs/reports/evidence/resume-2026-10-18/visual-review-stage55/plan.json` 为选样来源，恢复需重新绑定新源：18组矩阵样本（工作区9组+产物/sidecar/browser9组，共36张双端PNG）、4组成功态附件（共8张）、8组编辑器格式/主题代表组合（每组两应用×Source/Edit，共32张），另有Linux9图。编辑器完整观察运行仍须14case×两应用×Source/Edit=56图、七语言×两主题，32张只是其中人工选样；这些选样不能替代751/1502完整自动验收，也不是新阈值。部分成功态附件曾只以body附在reporter而未必落盘，补图必须实际取图/存盘/readback，不能预造路径、拿HTML preview替代CodeMirror或以静图代证动态owner/WS。

## 7. 九项架构与共同验收矩阵

当前消费者审阅见 `docs/reports/evidence/resume-2026-10-18/r11-stage55/architecture-closure-map.md`。九项均有实现及阶段证明，最终运行收口仍OPEN：

| 项目 | 必须保留的最终核验 |
| --- | --- |
| 消息虚拟化 | MessageList→VirtualMessageList真实物理scroller、prepend/追尾/暂停/目录/活动组/调度after-group、resize长会话 |
| 聊天编排 | AgentChat的thread/agent/panels/actions和Composer draft/submission/polish/voice职责及取消/退休，draft URL adoption不换owner |
| 状态归属 | 输入草稿/附件、唯一artifact draft/baseline、session/stream生命周期；无双写镜像，core与agent-core边界清楚 |
| 缓存/features | Vue Query identity/去重/失效、mutation发起身份；loaded/available/running/toolEnabled分开消费 |
| 集成流程 | Lark单一owner的窗口/轮询/取消/过期/retry与用户身份，不复制第二套迁移流程 |
| 孤立代码/重复模型 | 退役thread-context/proxy/keyboard/upload/artifact editing等有真实消费者依据；不误删WIP、生成types、worker URL及仍用原生Resizable的M0测试路由 |
| 重复算法 | workspace-change anchor真实接线、混合AI/tool/最后assistant边界，不把不同行为的算法强合并 |
| 历史叙事/门禁 | 陈旧固定规模/拼写守卫清理，同时完整收集、缺React、失败归档、隔离和负控仍生效；远程CI事实单列 |
| UI适配 | 必要原生focus/键盘/菜单/路由播报/滚动仍保留，F03–F14及最终两端/UI/Linux证明不能用“已拆组件”代替 |

共同矩阵不删任何维度：同Gateway/seed/权限/字体/浏览器/时钟；中英×明暗×桌面/手机及真实页面主题限制；loading/empty/error/selected/disabled/hover/focus；低高度、200%文字、双向resize、弹层/菜单/抽屉/表单/多面板；直达/刷新/返回/深链/404；刷新/重登/跨tab/用户/线程/Agent切换后的真实持久化；离线/超时/鉴权/资源消失/冲突/SSE中断/部分上传/授权窗口过期及可继续操作；asset成本、长会话、本地/独立/Compose各自拓扑。

## 8. C01–C13最终关闭条件

全部保持OPEN；这是最终证据未齐，不是宣称全部代码未写。

| 条件 | 关闭依据 |
| --- | --- |
| C01 | 全范围页面/入口/操作真实完整，仅三项豁免；R05–R07/R11 |
| C02 | 全Showcase资源/只读动作/双端UI；工作区写操作另验；R05–R07 |
| C03 | 全WIP已接线验证或有依据移除，无悬空半迁移；R00/R11 |
| C04 | P01–P03、F01–F14及本次新增失败根因与有效回归；R01–R07 |
| C05 | gap/durable/human ID/run input/附件合并，无重复create/旧草稿假提交；R04–R06 |
| C06 | 偏好/locale/timezone、引用授权分层、三套reasoning、知识恢复、Agent定义、来源/未读；R04–R06 |
| C07 | 调度/channel、项目四tab/trash部分失败、扩展完整宿主真实场景；R04–R06 |
| C08 | 功能/流程/行为/UI完整双端，751/1502及人工审图，无新增豁免；R05–R07 |
| C09 | 九架构/历史负担、唯一owner、真实消费者和必要无障碍；R01–R07/R11 |
| C10 | 当前backend REST/SSE/JSON消费者、持久化/取消/异常恢复；R04–R06/R11 |
| C11 | 完整verify/浏览器/backend/visual、CI接线及失败现场可取；R03–R09/R11 |
| C12 | Vue构建/无React独立/本地三入口/容器各自真实证据；R04/R08–R10 |
| C13 | 文档/源码/命令/实际结果/marker一致；R11–R12 |

## 9. Git、保全与环境边界

23:26只读核对：分支 `main-wc`；HEAD `a7804539530846baecf548af7b5d2612deb89b68`；main `5ecc1c2ac2de624af354bc515d5cb04f80df226c` 为HEAD祖先；无unmerged。索引SHA `109661be26054eff97a2c4ceee44d5bc6833a6dd6ac2a8ecb507f77bea854969`；5742原公共源与Stage55仍一致，私有三文件hash与本次恢复起点一致。准确收据：`docs/reports/evidence/resume-2026-10-18/pause-preservation/original-readonly-before-handoff.json`。本新交接属于新增文档，恢复必须将其作为明确新源，不改旧freeze来冒充相同输入。

23:47交接后再次只读核对，上述分支/HEAD/main/索引/私有输入/原5742源/pre-commit与WATCHED路径集合均未变，11项检查全部通过；收据 `pause-preservation/original-readonly-after-handoff.json`。最终文档范围与链接审计见同目录 `handoff-audit.json`，总暂停索引为 `summary.json` / `README.md`；这些只证明交接完整性与现场保全，不证明产品验收通过。

新持久源码包：

`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-10-18/pause-preservation/diagnostic-61-candidate-public-source.tar.gz`

- SHA256 `a92c0d571d503299a10d7d2c2951ba8effd91fa5d45a09189be18f276b30b65c`；52561367 bytes；5759成员=5756公共源+2公开example夹具+1metadata；逐成员核验通过，源前后不变。
- `diagnostic-source-manifest.json` / `source-preservation.json` 固定内容，**仅保全PASS，不是产品PASS**。F11后续/F12/F13/F14在各自持久目录，不在61候选源码包中。
- 另有 `pending-11-candidate-files.tar.gz`，SHA `60611042cbe0b83dd352284ecfe771547b3c7ee85f368d314efcbd12465766c3`，43304 bytes，11候选+1metadata；`pending-candidates.json`同时记录原工作区与61候选基准SHA，防止跨层误覆盖。
- 不含原操作员.env/config值、Git、node_modules、构建物。若临时目录被清理，先校验归档和成员，解包到全新自有目录，再正常按锁安装并建立原factory所要求的独立Git/预热前提；不能直接覆盖原工作区或认为解包后旧PASS自动续接。
- 原Stage55公共包仍在 `docs/reports/evidence/root-stage55-cross-app-checkpoints/source-preservation/`，SHA `d161a70ae8755ca4f3274816fb6a3f3395cc11b94891d86c3f20cbfa2dfcbc88`；Stage54历史包及补充文档继续保留。

当前会话协作树只剩root，无活动子代理。本轮Linux准备容器 `deerflow-vue-linux-stage55-final` 已按暂停要求停止，容器ID `b81f1686f08f3e7080a13cb33218af8f3ba2ca57e0100c8404eddd5a8a640f08`。停止前只有PID1的sleep，无安装/测试任务；`docker stop --time 10`退出0，容器最终exit137且Running=false，文件系统/镜像保留。这是闲置准备容器的暂停，**不是R09生产SIGTERM正常停止验收**。收据 `pause-preservation/owned-linux-stop.json`；Stage55 ingress项目没有容器。只停止本轮确证所有权的服务/容器，不全局kill/stop，不碰AiPPT、registry或历史其他任务容器。本轮原生门禁端口3115/3116/8021、独立诊断端口3348/3349已由各自runner负责停止；最终实际复查见最后停点。

AiPPT端口3000临停授权仍有效但尚未使用：未来最终 `make dev-dual` 窗口，先重新确认当时进程身份、启动方式/依赖/受限恢复输入及HTTP/UI基线可恢复，才可临时暂停，验收后恢复并证明。不能复用历史PID、仅凭旧日志停止，或把私有恢复值写入报告。

宿主pnpm经 `python3 scripts/pnpm.py --dir frontend|frontend-vue ...`，不手改依赖。原完整入口仍以Makefile为准。隔离loopback若仅sandbox EPERM，可在准许本地环境原命令重跑，前次零测试不能记PASS。主命令直接退出码和原失败必须保留。

真实模型/第三方IM/Lark、真实IdP、生产DNS/TLS/外层代理/线上切流、GitHub hosted上传和required设置保持独立外部证据边界；受控WS/OIDC、配置守卫、本地PASS均不能冒充这些条件已通过，亦不能以外部条件省略本地必做任务。

## 10. 最后停点与下一次恢复

已闭合收据：`docs/reports/evidence/resume-2026-10-18/unified-candidate/native-production/execution.json`，状态 **FAIL_DIAGNOSTIC**，directExit **130**，结束 `2026-10-18T23:42:01.035276+08:00`。145项中 **55通过 /18实际失败 /1中断 /71未运行 /0flaky**。JSON统计的skipped=72包含1个interrupted，不能全部写成原有skip。没有修改任何测试预算、筛选或断言，18个已发生的失败不能归咎于用户暂停。

原生生产服务由Playwright正常清理。只对实时验证出生时间、argv hash及cwd的CLI PID92957发送SIGINT；父观察器PID92828未被发送信号，继续完成原输入围栏并自然退出。旧PID仅供追溯，恢复禁止复用。`host-after-stop.json` 核原19个进程身份、同cwd可能残留和相关监听，**自有进程0、声明端口监听0**；3000也为空，AiPPT停启授权未使用。Linux准备容器停止收据已在第9节列明。没有活动子代理、没有新后台验收。

本轮所有声明附件存在，外部附件按真实路径保全，持久输出全目录逐文件hash：**968文件 /2478970056 bytes**，inventory SHA `bec7763a3c36826c7e33493176f090426c31f5bcdf2b123924f7c8507e3ef0d3`。证据目录 `docs/reports/evidence/resume-2026-10-18/pause-preservation/` 内：`native-preservation.json`、`native-artifact-inventory.json`、`native-cases.json`、`native-pause-request.json`、`host-after-stop.json`。原始产物在同一持久证据树的 `unified-candidate/native-production/`，保全不等于门禁通过。候选61份及5756源+2公开fixture前后完全不变。

18个实际失败按原规格归组：

| 完整规格 | FAIL数 | 恢复起点 |
| --- | ---: | --- |
| artifact-frame-keyboard | 2 | F12候选未并入；原生正向iframe进入 |
| chat-header-layout | 2 | F11后续候选未并入；360px/200% textarea基线差12px |
| focus-capacity-regressions | 2 | F14候选未并入；通知返回后网页失焦 |
| keyboard-measurement | 2 | F13候选未并入；两个旧负控前提 |
| keyboard-order | 1 | **61候选完整844遍历后仍有9条未闭环**，见下面；不是超时或中断 |
| knowledge-radio-boundary | 3 | **React** file-selection / agent-file-selection / catalog-error，在Escape关闭Dialog后 `knowledge-scope-trigger` 未聚焦（spec第66行）；根因尚未继续诊断 |
| markdown-rendering | 6 | 亮暗×360/1280消息+两主题artifact，失败点改为 `.katex-display` 中 TeX annotation找不到（richRendering第197行）。不能把旧inline夹具解释直接当成新失败根因；恢复需读实际trace |

键盘宏9条未闭环：sidebar的Shift+Tab（两端）、thread-archive的Tab（两端）、skills-settings#toggle-error的Tab（两端）、project-document-attach的Tab（React）、project-trash#restored的Tab（两端）。全844遍历在40.3分钟内结束；第一notClosed断言失败，后续mismatch/allBody/unreachable断言未执行，**不能推断它们通过**。844截图和约2.2GB trace.zip已在上述全量保全中，恢复可先离线提取完整focus/census，不在暂停期间继续修产品或量具。

唯一被中断的是 `mermaid-fullscreen-owner.spec.ts` 的React en-US/desktop用例；不把它算成第19个产品失败，也不宣称本轮Mermaid已通过。剩余71项含后续Mermaid、popup、settings/tooltip/topology、三轴键盘/浮层/布局/viewport等，以 `native-cases.json` 逐项列表为准，**新冻结仍须原完整门禁**。

下一次优先级：重新核现场 → 回读本次18失败及1中断 → 核实11份F11–F14候选（只覆盖已知8失败对应组） → 继续处理F04未闭环、React知识返回和Markdown annotation三组未关闭问题 → 新统一候选全验证 → 精确集成、新源冻结及全R04–R12。不得只合并11份候选便假定18失败全部解决。


下一次可直接对新会话说：

> 读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-18-vue-whole-plan-paused-handoff-stage55.md` 和其中 pause-preservation 收据，恢复整个计划，不能缩水。先核真实现场及最后一轮候选验收的实际失败与中断，再从未并入的F11–F14及其他新增失败继续。保留原WIP/私有输入/所有旧证据，不直接重跑已有目录或执行旧integration；新候选完整通过后新冻结，再完成全部R04–R12、W00–W13、C01–C13、九架构与共同矩阵。

恢复顺序：只读核现场 → 回读本轮全部实际失败/trace、未运行清单和候选原hash → 建新候选版本并逐文件合并 → 类型/格式/相关完整单测及18配置完整收集 → 新候选完整生产规格 → 精确原WIP集成和文档同步 → 新源Stage56绑定/正常安装 → 原全门禁与人工审图/部署和本地入口 → R11/R12收口。不存在“只补跑旧套件未通过的几项就整体完成”的捷径。
