# Vue 全计划再次暂停交接

> 历史快照：本文记录较早的 Stage48 暂停。后续已恢复并推进至 Stage54，再次按用户要求暂停；最新已完成、失败、未完成及恢复位置请读 [Stage54 全计划暂停交接](2026-10-12-vue-whole-plan-paused-handoff-stage54.md)。本文旧状态、旧数量和旧恢复指令不再是当前停点。

**历史状态：PAUSED_USER_REQUEST。暂停日期：2026-10-12，Asia/Shanghai，Stage48。** 当时用户明确要求“先暂停吧，保留现场”“确保后续可无缝继续开工”。以下保留当时整个 W00–W13、R00–R12、C01–C13 及全部子任务的暂停快照；最新恢复入口是顶部 Stage54 链接。本文旧恢复指令不构成继续实施授权。

仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。暂停前总进度仍为约80%的工作量估计，不能视为验收通过率。**当前还剩共用面板产品修复和完整最终验收。**

## 1. 完整范围与权威顺序

- 继续采用当前 React `frontend`、Vue `frontend-vue`、`backend`、`contracts` 的实际源码、消费者与合同；文档提供恢复索引，不能替代代码或真实结果。
- 功能、操作流程、可观察行为及 UI 样式均需对齐，两端应能替换使用。
- 既定豁免只有 Vue 首页内容、docs/blog 内容站、整站无后端静态回放模式。Showcase 全部在范围内；不新增豁免。
- Vue 架构优化、唯一 owner、历史工程负担清理、必要无障碍/键盘/焦点合同、CI/部署及独立运行均保留。不得通过删能力、绕开测试或调整基线、阈值、超时、预算解决问题。
- 完整工作包、九项架构整理、共同矩阵及十三条完成条件见 [原全计划交接](2026-10-10-vue-plan-progress-and-issues.md) 与 [本期计划](2026-10-09-vue-period-plan.md)。恢复以来逐项记录见 [执行记录](2026-10-11-vue-resume-execution-status.md)。原交接是2026-10-10快照，后来修复的结果以本文件及实际receipt为准。

## 2. Git 与保全边界

- 当前分支 `main-wc`；HEAD `a7804539530846baecf548af7b5d2612deb89b68`，main `5ecc1c2ac2de624af354bc515d5cb04f80df226c`，原核对为祖先关系；本次暂停核对 HEAD/main 未变，unmerged 为空。
- 所有既有未提交改动及未跟踪源码保留。没有 commit、push、reset、stash 或新建分支；不为暂停而改原索引。
- 暂停保全目录：`docs/reports/evidence/root-stage48-checkpoints/pause-preservation/`。其 `summary.json` 记录公共源码包、Stage47冻结源码包、源码清单、持久证据清单、Git状态及索引/运行文件hash。归档和hash是保全，不是测试或新的源码验收冻结。
- 原 `.env`、`config.yaml`、`extensions_config.json` 留在原处，只记录hash，不把值复制进交接或公共源码包。原有运行配置跟踪政策保持。
- 大量既有证据已经位于持久化的 `docs/reports/evidence/`；清单记录其路径、大小与SHA，不再重复复制整个证据树。当前公共源码和旧Stage47冻结输入另外持久化归档，避免恢复仅依赖临时目录。

## 3. 全部工作包的已完成与剩余落点

“已实施/阶段通过”均有输入边界，不能替代最终整源验收。

| 工作包 | 已实施或已有实际证据 | 本次暂停后仍需完成 |
| --- | --- | --- |
| W00 契约/入口 | OpenAPI、扩展schema、生成类型/常量及隔离输入链；Stage47原canonical通过 | 新源最终冻结、原18配置collection、各拓扑与CI最终一致性 |
| W01 账户/偏好 | session owner/RBAC/偏好/locale/timezone等已实现，旧阶段回归保留 | 最终anonymous-auth及真实SQL-session双端、账号与恢复路径 |
| W02 run/消息 | nullable gap、durable/error/END、create/join/stop/dispose、稳定human/附件owner等；消息动作/选区/HIL owner已整理 | 最终完整protocol/real与双端，确认无重复create/旧owner污染 |
| W03 产物 | bounded/Range/冲突/资源退休/保存锁；CodeMirror完整能力、主题/字号/长行补齐；49定向及原预算诊断通过，Stage47完整构建/预算通过 | 14项编辑器双端native GREEN、P03完整真实截图复验及全部artifact流程 |
| W04 输入/模型 | 提交事务、附件/引用/知识/reasoning/语音/只读owner；placeholder旧源4native RED后utility已修 | 新源placeholder4项GREEN及完整输入/模型/overlay双端与mock |
| W05 能力/Agent | MCP容量根因修复Vue17/React20定向GREEN；旧源加限定修复34项native通过；Agent/安装/权限等既有实现保留 | 最终全部gallery/config/Agent/knowledge/权限与本期新源双端 |
| W06 历史/删除 | 侧栏定位/滚动owner旧mounted RED→相关15项PASS，独立完整chat-scroll6项通过；历史/活动/删除等已实现 | 最终追尾/分页/resize/删除及跨owner完整验收 |
| W07 调度/channel | 原调度/卡片/事件/队列/DST/后台owner、channel及Agent实现与阶段回归保留 | 最终scheduled/channels/agents/settings等真实拓扑与双端 |
| W08 扩展 | assets/inline宿主、模块图/导航/动作/mentions及owner边界；Stage47扩展fixture通过 | 最终完整宿主、卸载/权限/晚返回与Docker真实消费 |
| W09 项目/trash | 四tabs、附件/转换、instructions、分页/权限/冲突/部分失败等已实施 | 最终全部项目/trash双端及真实Gateway恢复链 |
| W10 面板/设置 | 原browser/sidecar/memory/subagent/设置owner保留；已确证新的共用面板动画/固定内容宽缺陷 | **共用WorkspacePanels产品修复尚未开始**；9有效旧源RED已保存；再做mounted GREEN/negative及native，随后全部面板/设置完整验收 |
| W11 Showcase/UI | Showcase实现与场景登记、原751宏/1502PNG目标保留；消息流式代码/pacing/math/truncated已修，153定向/5有效negative通过 | 新8项Markdown/truncated native GREEN、完整751宏/1502PNG与样式审图、Showcase全部案例/只读操作 |
| W12 架构/历史负担/CI | 多处公式/数量守卫迁到真实消费者/有效negative；MessageList/AgentChat/composer/follow-up/header等owner整理及阶段回归；lodash-es实际发行缺陷最小升级4.18.1，两端各9PASS | 面板字符串timer守卫需随真实owner验证迁移；新harness默认消费者回归；最终独立运行/Linux/CI/部署及清理收口 |
| W13 完整验收/交付 | 旧失败现场、源/依赖/工具围栏、全计划映射与本次暂停现场已保留 | 下列R03–R12全部最终闭环；必需FAIL/UNRUN尚在不得称完成 |

## 4. 最新可靠完整结果与失败边界

### Stage47完整canonical：实际PASS，限定旧冻结输入

- 副本 `/private/tmp/deerflow-next-final-stage47-3mjms8s5`，5718源码+2公开fixture。
- source SHA `95fb63d9d911805e98ac685cf46e05908f2c4d56694887123d9ce1f5fbd909f7`；copy SHA `0ca6a320786afba236665d55a7fa3b70c4f7e30f398cb144b839f9c4e2cfa3d6`；manifest SHA `f55138fcdb9a223f92d0a4cdaebff74011965fca2871cbb74ad3aeac68cc77aa`。
- 全新冻结正常依赖安装/strict-peer/12实际入口归属通过。原完整canonical实际 direct0：488文件/4033项、OpenAPI、lint零error/零warning、格式、四类类型、完整build、原asset-budget、consumer、audit及扩展fixture通过。audit仍有6条精确审查advisory，未称零advisory。
- 5720源/fixture、131025前端依赖、backend/stdlib/runtime/tools前后零漂移。
- receipt：`docs/reports/evidence/root-stage47-checkpoints/final-canonical/execution.json`。其他Stage47实际门禁均UNRUN；live新测试WIP不能沿用此PASS。

### 旧失败不得覆盖

- Stage46原完整canonical：4028PASS/3FAIL（文档计数及两OIDC readiness），完整collection实际18配置1628项，其中产品1004/auth21/SQL8。定向文档19PASS、显式owned no-proxy HTTP opener5PASS及毒代理有效RED、唯一属性顺序warning已修，Stage47完整PASS关闭的是这些指定输入问题。
- Stage45原完整backend：protocol2PASS，real5PASS/1截图FAIL，其后16UNRUN。P03真实检查文件/收起步骤/回输入流程已明确，原2%阈值/基准不变，最终完整backend新源复验仍UNRUN。
- Stage43正式失败原始904文件/256685107字节已持久保存；Stage45 P03原8文件/1925124字节亦已保存。
- 历史backend repair-round-1四分片27133PASS/414skip、blocking235及lint/format通过仅属历史输入；新010/fixture测试变化要求最终backend全量新跑。

## 5. 精确停点：新共用面板缺陷尚未修产品

### 已确证的原因

React打开/关闭时固定最终内容宽度，外Pane裁剪动画280ms，并保留退出呈现身份；Vue当前依赖Splitpanes默认200ms宽度过渡，内容跟随变窄/变宽，关闭时v-show/v-if立即隐藏或卸载。

实际1280×720/root16原生诊断：Vue首次82可见frame的scroller宽26→379（23档），content宽56.11→409.20，scrollHeight15792→3336，top14420→2808；重开91frame宽4→379，height49848→3336，top49476→2808。React首次80frame的scroller宽379/height3324稳定，仅0→2795 instant，重开top2795稳定。不能把Vue自身opening引起的重排算合法外部resize。

### 产品字节未修改

- `frontend-vue/app/components/workspace/WorkspacePanels.vue` SHA `e5debe2a46a50d494ab9a9939799425a4247e782682e57ad1728efac1e02d700`。
- `frontend-vue/app/components/chat/AgentChat.vue` SHA `717430e043bab4c753c56be69bcab2b36a066818c9c7edf1bb565086ad670497`。
- 以上等于reviewer保存旧源。已授权的修复尚未开始就收到用户暂停，不能报告已实现。

### 留存的测试WIP

- 新 `tests/unit/chat/workspace-panels-lifecycle.dom.test.ts` 6项与 `agent-chat-panel-presentation.dom.test.ts` 7项；共享 `helpers/agent-chat-harness.ts` 新增默认不变的realPanels opt-in。
- 第二轮真实挂载旧源码13项=9有效RED/4保护PASS：普通close立即卸载、快重开实例/draft丢失、readonly退出消失及实际pin/退出DOM缺失。首轮AgentChat7项fixture浅stub错误不计产品RED，原receipt保留。
- 这些文件是**未完成测试WIP**。修后GREEN、有效negative、共享默认137消费者、完整types/lint/format及新原生均UNRUN。不要删RED或先跑整源宣称完成。
- `tests/guards/invariant-ownership.test.ts` 的literal `animationTimer`禁令尚未迁移；迁移必须改为真实生命周期退休/取消验证及有效negative，不能改名规避。
- 新的close nextTick focus continuation代际准入尚未写测试或实现，恢复时一并纳入快反转/owner退休；保留details显式return优先级，不改Sheet焦点primitive。

### 两端sidecar spec停点

- React `frontend/tests/e2e/sidecar-chat.spec.ts` SHA `38f6cedf189805af5fd66d97c5c437b9fee74ea0a5ec81ae340d8c3012b3d487`。
- Vue `frontend-vue/tests/e2e/sidecar-chat.spec.ts` SHA `204870dae31a2536311194e9524cb758a8fbe8b2403aa125ad1416aed2feb673`。
- 逐真实帧观察器12个原生小控制实际通过：CSS auto+smooth、库式rAF、单中间可见位置的有效RED，以及instant/外部geometry/空样本准入。原两restored-history业务体各direct0，但几何reset漏H5，不能当新合同GREEN。
- 最新两helper已加fixed viewport/font epoch内容raw宽差<1px、clientWidth整数差≤1的断言（对应实际React量化0.78125px/client1），**新增断言尚未跑**。H5独立真实重排负控尚未跑；H3/H4真实外Pane transition/关闭退出/非开关resize禁过渡仅为方案，未落源。两端artifact-panel-resize spec未修改/未领取。
- 全部原用例、操作、20×25ms/后220ms、350ms重开及预算保留，当前净新增E2E case为0。只有外部viewport/font变化可以分epoch；opening自生width不得豁免。
- 产品修复集中在WorkspacePanels呈现owner，AgentChat只接rendered identity；不复制业务open/session/权限/draft，不缓存旧thread数据。details关闭/sidecar discard的清空不可恢复，Browser active=false仍立即停止输运。包含快反转、kind切换、真实resize打断/release-only、owner退休、narrow/main稳定、reduced-motion和unmount取消。

暂停receipt：`docs/reports/evidence/sidecar-layout-owner-readonly-stage48/{pause-state.json,pause-readme.md}`、`docs/reports/evidence/sidecar-open-observation-stage48/pause-state.json`。coverage只读补审：`docs/reports/evidence/resume-2026-10-11/workspace-panel-coverage-stage48/`。

## 6. 恢复后完整顺序与所有剩余门禁

此表只在用户明确恢复后执行。各阶段原完整命令、预算、用例、阈值和基线不变；独占原生/构建窗口，不让资源竞争污染原小预算结果。

| 编号 | 准确下一步 |
| --- | --- |
| R00 | 读取本文件和暂停清单；重新核Git/WIP、源码hash、私有运行文件hash、全部端口/PID出生/工作目录及现存副本；旧PID不得重用。保全已有失败现场，不启动额外服务 |
| R01/R02 | MCP与侧栏已有定向修复；保持原回归，将其纳入新最终完整双端，不重做无原因的诊断 |
| R03 | 先完成第5节共用面板产品及真实测试/负控/原生；普通文档收口后，创建Stage48新物理源副本、18份Git已跟踪公共.agent、2公开fixture、独立Git清单及正常新依赖。Stage48当前无copy指针/未冻结，禁止改Stage47不可变副本 |
| R04 | 原完整Vue canonical/OpenAPI/extension/asset/consumer/audit；原18配置collection、React完整check+full unit、icons。另新跑backend原四分片、blocking-io、lint、format check |
| R05 | 原完整cross-app产品/auth/SQL，当前1004+21+8仅历史收集参考；完整751宏/1502PNG、原全部预算/基准。聚合清理前先完整归档正式产物，核解码/尺寸/零新增接受台账并实际审代表场景 |
| R06 | 第二物理浏览器副本、正常新安装，原完整mock/backend/external依次执行。backend保protocol/real/scheduled/channels/agents/settings/shell/browser八拓扑及P03；external完整WS/受控OIDC |
| R07 | 新源实际Linux原8visual/12payload/asset和9PNG审阅。product-visual实际CI为ubuntu24.04arm/Node24.14.1/不可变PW镜像/host IPC；其它job的Node22不能冒充。旧47 Linux仅准备，须新绑定 |
| R08 | 最终新源无React standalone default与`--with-e2e`均实际执行；install/build/unit/mock/backend保持原factory。旧47仅outer准备，不能沿用45默认PASS |
| R09 | 最终新源Gateway及双前端canonical镜像实际构建，原build-vue/build-react/probe/probe-oidc/smoke/normal-stop六phase，双hostname真实受控OIDC/API/SSE/WS、正常SIGTERM/端口释放/SQL保留。旧47 source/context及Docker只读准备须新绑定 |
| R10 | 原`make dev-vue`、`make dev-dual`、`bash scripts/serve.sh --prod --vue`实际启动与浏览器auth/me/permissions/preferences204/单提交SSE/context/三suggestions/刷新持久会话/无重复提交。正常install与原30/300/180启动预算保留 |
| R11 | 有界三端增量、WIP/consumer、marker、docs/CI收口。已有103WIP/1878来源核对与112React/11backend差异审阅保留，但来源投影不等于全历史逐行语义认证或runtime PASS；脏marker继续REVIEW_REQUIRED/UNKNOWN |
| R12 | 分开报告代码、完整本地集成/双端验收、外部条件；任一必需FAIL/UNRUN尚在则不称全完成。提交/推送需后续实际授权 |

原生14编辑器+4placeholder+8Markdown/truncated新合同均属于上述原完整cross-app自动发现；不能只跑这些替代完整产品集。原P03正式源修复尚未完整GREEN。六advisory精确审查仍需最终audit，不能泛化豁免。

## 7. 已准备工具的精确状态

- `root-stage48-checkpoints/` 六根工具仅语法准备，未copy/install/gate。原 `run-frozen-gate.py` SHA `d6f4a09fbbf774a45e9b92c1722d45c21b3e3ea1bac58f86a8be1fb4fbff7262` 未改；执行账本README已标暂停。
- `resume-2026-10-11/backend-full-stage48/` 新runner SHA `74894f796e01a399a3dd204553715d051457272baf68470917bd3ef8c1080a29`。原四argv/五围栏函数AST一致；补公开fixture/template非symlink准入和finally独立全后围栏保全。13项纯内存观察器自检通过，仅工具自检。`MANIFEST_SHA256=None`、无copy指针、无actual/readiness目录，所有backend实际门禁UNRUN。先新冻结，再绑定与readiness。
- 47 standalone、Linux、Docker、本地三入口准备都属于47源。新48未建对应context/runtime/依赖；不能仅改标签继承原准备收据。
- 未启动AiPPT暂停、生产切流或外部真实IdP/IM/模型；hosted CI required/upload及DNS/TLS为外部环境边界。

## 8. 停止结果与其他项目

- 所有子任务已确认暂停，无自有活动session/服务；reviewer两次RED进程均已结束，cap自有preview/Chromium已退出，backend48工具无运行进程。
- root受权只读核对：本轮3390/3391、3370–3375、8260/8262/8264、3100/3101、8001、2426/2486未监听，自有运行marker进程匹配为空。详见 `docs/reports/evidence/root-stage48-checkpoints/pause-host-readonly.json`；这是观测时快照，恢复时仍须重查。
- 3000仍由AiPPT项目服务占用，已读取PID/出生时间/cwd确认，未发signal、未暂停或恢复其他项目。既有“先证明可恢复再临时暂停”授权仅在未来dev-dual实际窗口使用，不能复用此次PID/旧私有恢复输入。
- 本次保全只写文档、归档与观察器记录，并核hash/进程；暂停后没有继续产品修复、测试、构建、安装或启动服务。

## 9. 最短恢复指令

在下一会话明确要求恢复后，先读本文件，再读 `pause-preservation/summary.json` 和两个面板pause-state。第一项实施为旧源9RED已确证的共用面板生命周期根因修复；完成相关GREEN/有效negative及新原生后，才进入新Stage48冻结与全部R04–R12。临时副本不在时使用持久化源码包恢复输入，再按锁文件建立独立环境；不复用旧进程或声称旧PASS等于新源通过。
