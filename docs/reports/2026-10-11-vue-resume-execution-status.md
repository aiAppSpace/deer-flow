# Vue 统一计划恢复执行记录

恢复日期：2026-10-11；最近续记：2026-10-12，Asia/Shanghai。用户明确要求读取交接文档并继续工作，范围和标准不缩水。本文从 2026-10-10 暂停点续记，不覆盖原失败或把旧 PASS 改称新源结果。

## 当前状态

**PAUSED_USER_REQUEST。用户于2026-10-12再次要求暂停并保留现场，整个W00–W13及所有子任务现均暂停，尚未完成。最新恢复入口为 `docs/reports/2026-10-12-vue-whole-plan-paused-handoff.md`；下列执行经过保留为历史，不构成继续执行授权。** 仅保留 Vue 首页内容、docs/blog 内容站、整站无后端静态回放模式三类既定豁免，showcase、功能、流程、行为、UI 及架构/历史负担清理仍全部在范围内。原交接文档为暂停时快照，恢复授权来自用户本轮消息。

- R00：当前分支 main-wc，HEAD a7804539530846baecf548af7b5d2612deb89b68，main 5ecc1c2ac2de624af354bc515d5cb04f80df226c 为祖先，unmerged 为空。既有 WIP 全保留，不提交/推送/reset/新建分支。
- 原 Stage43 正式 cross-app 失败完整归档已从临时副本逐字节复制到 `docs/reports/evidence/resume-2026-10-11/original-cross-app-failure/`：904 文件、256685107 字节；原副本未变，保存不等于复验通过。
- 本机恢复检查已区分 sandbox EPERM 与实际连接结果；受权只读检查确认 3000 仍占用，其余本轮原 3370/3371/8260、auth/session、3100/8001 及准备的 Docker 端口未监听。没有停止 AiPPT 或其他项目服务。正式本地入口窗口仍需重新核身份/可恢复性并履行恢复验证。
- R01：双端 MCP 容量根因修复已取得 Vue 17/React 20 定向 GREEN。旧源+明确四条覆盖的第二轮独立诊断两完整文件实际 34 PASS/direct 0，5670 输入、两前端依赖、backend/stdlib/runtime/tools 前后无漂移。第一轮 33 PASS/1 FAIL 保留：模拟 Windows UA 与实际 Darwin 原生键映射不同；正式测试改用跨平台原生 ControlOrMeta+A→ArrowRight，全部旧断言保留。诊断是局部归因证据，最终整源 cross-app 尚待执行。
- R02：侧栏原 mounted RED 重现（2 PASS/1 FAIL），修后相关 15 项 PASS，格式/lint 0。外层承担定位/translate/containing block，内层承担原生滚动，未裁切掩盖；上述旧源+明确修复的独立诊断中，完整 chat-scroll 双端 6 项 PASS。该结果不替代最终当前整源 cross-app。
- W12：历史固定数量门槛已替换为实际合同/扫描集合/Makefile 目标结构和有效负控，修复原守卫漏 S8a/b/c 及 Makefile 续行两处解析缺陷；12 文件/158 项 PASS。MessageList 动作、选区、HIL owner 已提取，真实 mounted 复现并修复旧选区及 HIL late-owner 错误，相关完整请求=收集的 9 文件/108 项 PASS。AgentChat 的面板/命令 owner 已提取；进一步确认固定 agent page key 导致同 thread 换 Agent 复用，现有 sidecar owner 已补充身份退休：新增 10 DOM 文件/77 项与 4 node 文件/24 项 PASS，app/tests types、scoped lint/格式均 direct 0。进一步将一条新迁移的源码公式断言改为实际 mounted owner 行为验证，原 MessageList 集成测试保留；相关完整两文件通过。最终完整整源门禁尚未关闭。
- R03/R04：Stage44 独立冻结5684源码+2公开fixture，依赖全新冻结离线安装及归属检查通过；完整 canonical 与 extension fixture 实际 direct 0，481测试文件/3975项PASS，所有输入/依赖/工具围栏无漂移。仍有1条lint warning及6项精确审查 advisory，不称零警告/零advisory。此后旧公式守卫继续迁到实际消费者行为，不能沿用其 PASS 作为当前完整门禁。
- Stage45：5685源码+2公开fixture，copy SHA256 `e9c0250045a3e76620ff520fea3412a5f4a81f0d4f5cf9170c5a0a70e2eab973`；独立依赖冻结离线安装及 strict-peer supplement 通过，完整 e2e-list direct0，18配置/1602项实际收集，所有围栏无漂移。完整 canonical/React/cross-app/mock/external 未运行。
- R06/P03：Stage45 原完整 `make e2e-backend` 实际 FAIL/direct2。protocol 2 PASS；real 5 PASS/1截图FAIL（21560像素、约3%，超过原2%）；其后16项未运行。失败8文件逐字节保存，基准 SHA 与历史原始基准一致。独立同源真实 Replay 已确认：ordinary write 的自动预览按 pending 满100ms打开，原截图未明确面板业务状态；两端短写入可正确保持关闭。实际公开工具点击均能打开全文，使用检查文件、收起步骤、回到输入的真实用户流程，六次截图均在原2%内。诊断同时发现确定的 Vue CodeMirror 字号、行高、内边距及主题色对齐漏项，已按 React 实际消费补齐长行及主题合同，定向与后续 canonical 结果见下文，最终原生完整验收仍待执行。不能以截图总阈值通过略过这项产品差异；原完整门禁FAIL仍保留，最终需新冻结完整重跑。
- R08：Stage45 原 default standalone 实际 direct0，8个原子命令完成，471文件/3915项PASS，10文件/60项为原约定skip；源、依赖、工具前后无漂移。with-e2e 未运行；随后测试守卫迁移使当前源再次变化，最终同源两模式仍必须执行。
- W12 最终补审：AgentChat/follow-up/settings/save-hint/header、Composer只读/语音/推理颜色及overlay守卫，已把阻碍重构的公式/数量阈值迁为真实生产消费者或实际接线/集合合同，并保留有效负控。Composer完整两文件16 PASS/两个有效RED；follow-up等完整11文件137 PASS/23次有效RED；header/overlay完整3文件29 PASS/9次产品及2次扫描器有效RED，受控改错后产品字节全部还原。修正了 mentions 测试中违背真实 Promise 契约的 mock，并保留初始测试类型9项错误及修复记录；完整 app types、tests types 最终 direct0，后者1602项源码输入前后相同。另只修复一处与当前稳定human ID矛盾的注释，4251个非trivia TypeScript token完全相同。上述为定向/类型证据，不能代替最终 canonical。Stage46 工具已准备；P03 已在原断言、原基准和原2%阈值不变的前提下明确真实检查文件/收起步骤/回到输入业务流程。等待新增产品及浏览器合同收口后统一冻结。
- 细粒度UI补审：消息流式代码、渐进显示、KaTeX 定向滚动及两处截断文件 native pre 已按实际 React 消费修复，唯一消息适配器/显示timer owner、安全处理和懒加载保持。定向20文件153 PASS，5个有效mutation RED 后字节恢复；新浏览器8项仅收集通过，actual UNRUN。CodeMirror 完整原生编辑能力和实际主题/字号/长行已补齐，49项定向通过；独立实际构建前五轮均为 build0/budget1，全部失败保留；全静态方案单块295155字节超过原210000上限并被否定。第六轮按六种语法的真实共享消费者集合静态具名导入 view/language/autocomplete，模型/标签与操作系统保持独立动态入口，原 build0/asset-budget0；CodeMirror raw581311/gzip209687/max187267，分别满足原585000/210000/210000限制，1726源码/57025依赖/工具前后无漂移。没有删能力、改版本/预算/命名或强制拆块。该轮仅编辑器诊断副本，不代替最终新依赖整源门禁。输入框 placeholder 旧源4项真实浏览器RED已取得并修复实际utility。浏览器同时确认React Edit声明的autofocus在旧readonly DOM上提前调用；现通过唯一未履行请求及公开ViewUpdate修复，完整15项定向PASS，含保存锁不抢焦点、撤回及后续新请求。上述新源原生浏览器GREEN及完整门禁均未执行，所有中间失败保留。新增 CodeEditor14项、placeholder4项和Markdown/truncated8项均由原cross-app自动发现；原751宏/1502PNG、全部旧用例/预算/阈值/基线不减少。
- R11 依赖发行补审：修复前 React/Vue 均 override `lodash-es@4.18.0`，锁文件自身带维护者 bad-release deprecated 提示；官方 [4.18.1 发布说明](https://github.com/lodash/lodash/releases/tag/4.18.1) 明确修复模块构建 `template/fromPairs` 的 ReferenceError。两端实际4.18.0发行包均已复现 `fromPairs/template` ReferenceError；真实dagre layout/Mermaid parse旧版本本来通过，未伪称报错函数是当前必经路径。两端override和锁已由官方registry的标准命令更新为4.18.1，语义深比除该节点/integrity/引用外所有原键值不变；顺带丢失的React平台libc元数据按旧锁精确恢复。四文件SOURCE_FINAL；两端标准frozen正常生命周期安装均direct0，Vue严格peer且Nuxt prepare0，四源字节前后不变；新实际发行包两端各9 PASS，含此前报错函数、安全负控及真实dagre/Mermaid消费。在线audit和新整源完整build/browser仍UNRUN，仍需最终整源冻结和完整复验。
- R11 Replay测试覆盖补审：原环境测试探针记录Agent路由却无断言，且路径/config已过时；实际fixture与浏览器消费者均为/set-enabled。补正确断言与探针后原五scenario实际5 PASS，故意令该观测为false时1项有效RED，ruff/format0，测试/runner/原索引前后无漂移。初始4PASS1FAIL及观察工具的str-key错误完整保存于 `root-stage46-checkpoints/agent-route-contract/attempt1/`，修复后完整收据独立保留，不把测试探针问题报告为产品路由缺陷。
- Stage46：5700源码+2公开fixture独立冻结，标准全新冻结正常安装及Vue strict-peer/12实际入口归属探针通过。原完整canonical实际FAIL/direct2：486测试文件PASS/2FAIL，4028项PASS/3FAIL；OpenAPI/lint（1warning）/格式/类型先通过，build/asset/consumer/audit/extension fixture因单测失败UNRUN。失败为文档漏记26项及两项OIDC readiness；完整源/fixture、131025前端依赖、backend/stdlib/runtime/tools零漂移。原完整collection实际PASS/direct0，18配置共1628项，产品1004/认证21/持久会话8，全部围栏无漂移。文档已按真实收集数修正，原文档事实守卫完整通过；OIDC独立诊断已证明请求实际被本机代理接走（自有fixture零连接）；原client在受控毒代理两场景实际RED、命中289/292次，修复owned HTTP opener后全文件5 PASS/0skip，lint/format0，原8s/.2s/20s及全部真实协议断言不变。唯一attributes-order warning也已按原规则重排现有属性，精确转换及scoped lint/format均通过，无事件/绑定/值变化。任何定向修复通过均须Stage47全新冻结完整重验，Stage46失败不覆盖。
- Stage47：5718源码+2公开fixture独立冻结；三端全新冻结正常生命周期安装均direct0，Vue strict-peer/Nuxt prepare及12实际入口归属通过。原完整canonical实际PASS/direct0：488测试文件/4033项，OpenAPI、零error/零warning lint、格式、四类类型、完整构建、原资产预算、consumer、audit与扩展fixture均通过。audit仍有6项精确审查advisory，不称零advisory；5720源/fixture、131025前端依赖、backend/stdlib/runtime/tools前后零漂移。其他Stage47门禁未运行，此后新sidecar合同与布局修复必须新Stage48冻结，不继承47 PASS。
- Stage48侧聊增量补审：两端旧打开测试仅凭CSS auto和延后稳定检查不能排除显式smooth/rAF；新观察器原生12个小控制已有效区分smooth、rAF渐进、单中间可见位置、合法instant及空样本。独立双端实际生产构建均direct0；原两条restored-history业务体各direct0，但几何变化重置分类器漏报H5，不能把这两条direct0宣布新合同GREEN。固定1280×720/root16的真实浏览器中，Vue首次82可见frame的scroller宽26→379（23档）、content宽56.11→409.20、scrollHeight15792→3336、top14420→2808；重开91frame的scroller宽4→379、height49848→3336、top49476→2808。React首次80frame的scroller宽379/height3324保持稳定，仅0→2795 instant，重开top2795稳定。已确证Vue缺少共用面板固定内容宽度及开关呈现生命周期：由WorkspacePanels集中修复，AgentChat只接呈现身份，业务active/权限/session/draft仍属原owner；先真实mounted旧源RED，再修后GREEN及新原生合同。独立工具的CLI/loopback readiness错误及0case记录保留，未归因为产品失败；原用例/预算/20×25ms/220ms检查全部保留。
- R04–R12：尚待最终整源完整验收，不继承旧 canonical/default standalone/Linux/backend 的 PASS。最终整源须新跑backend原完整四分片、blocking-io、lint、format；010和fixture测试变化不能由历史生产字节未变替代当前测试输入。Stage47复制清单同时包含当前Git已跟踪的18份公共.agent资源，保留backend仓库合同对真实smoke输入和目录图的读取；未跟踪agent工作文件、私有运行配置仍排除，不修改或跳过消费者测试。完整 cross-app（1004产品+21认证+8持久会话）、mock/backend/external、751×2 截图与样式、standalone 两模式、Linux完整8视觉/12payload/asset及9PNG、Docker原六phase与Gateway实际构建、本地三入口、最终增量/marker/文档收口均保留。Linux/Docker已做的准备仅为准备，尚未执行实际门禁。

## 证据入口

- 原完整范围及恢复索引：`docs/reports/2026-10-10-vue-plan-progress-and-issues.md`。
- Git/WIP/历史副本：`docs/reports/evidence/resume-2026-10-11/root-preflight/summary.json`、`git-status-before.nul`。
- 原正式归档保存：`docs/reports/evidence/resume-2026-10-11/root-preflight/failure-preservation.json`。
- 环境只读检查：`docs/reports/evidence/resume-2026-10-11/root-preflight/environment-readonly.json`。前一沙箱探测 connectCode=1 是 EPERM，不能当端口空闲。
- P02 RED/GREEN：`docs/reports/evidence/resume-2026-10-11/sidebar/README.md`、`summary.json`。
- 新轮次工具：`docs/reports/evidence/root-stage44-checkpoints/tool-preparation.json`。
- 全范围与 W12 guard 审查：`docs/reports/2026-10-11-resume-scope-review.md`。
- MessageList 交互归属及实际 RED/GREEN：`docs/reports/2026-10-11-message-interaction-ownership.md`。
- 独立旧源+P01/P02 诊断：`docs/reports/evidence/root-stage44-diagnostic-checkpoints/final-diagnostic/`，不能冒称当前完整新源最终验收。
- Docker R09 新六 phase 观测准备中；仅准备新工具，等待同一最终整源冻结及独占构建窗口后再执行，不涉及 AiPPT/其他项目。
- Stage45冻结及完整收集：`docs/reports/evidence/root-stage45-checkpoints/final-source-frozen.json`、`final-collection/execution.json`。
- Stage45真实后端失败与完整现场：`docs/reports/evidence/root-stage45-checkpoints/final-backend/execution.json`、`p03-real-render-failure/preservation.json`。
- Stage45 standalone default：`docs/reports/evidence/resume-2026-10-11/standalone-round45/default/`。
- Composer实际消费者与负控：`docs/reports/evidence/resume-2026-10-11/message-actions/composer-guard-execution-summary.json`。
- 全部消费者守卫与负控：`docs/reports/evidence/resume-2026-10-11/followup-consumer-guards/README.md`、`docs/reports/evidence/2026-10-11-w12-header-overlay/README.md`。
- 最终整合类型：`docs/reports/evidence/resume-2026-10-11/message-actions/guard-integration-types-final.json`；初始失败单独保留，不覆盖。
- P03 同源真实回放因果与确定的编辑器UI漏项：`docs/reports/evidence/2026-10-11-p03-current-react-vue/causal-report.md`。
- 最终范围阶段审查：`docs/reports/evidence/2026-10-11-final-scope-review-stage46/stage-record.md`；路由/资源集合事实不等于全部行为/UI已通过。
- 完成条件、九项架构和真实证据映射：`docs/reports/evidence/resume-2026-10-11/final-conditions-source-map/report.md`；只读映射不替代运行。
- 编辑器原生能力/预算诊断：`docs/reports/evidence/2026-10-12-code-editor-parity/`。
- 真实旧源编辑器focus/placeholder及新14项合同：`docs/reports/evidence/2026-10-12-code-editor-browser-contract/native-diagnostic-report.md`。
- 聚焦请求/占位文字产品修复：`docs/reports/evidence/2026-10-12-code-editor-focus/README.md`、`source-stable.json`。
- 消息渐进显示/流式代码/公式/截断预览：`docs/reports/evidence/resume-2026-10-11/markdown-rendering/README.md`、`summary.json`。
- Stage46原完整失败与收集：`docs/reports/evidence/root-stage46-checkpoints/final-canonical/execution.json`、`final-collection/execution.json`及各自`gate.log`。
- 文档计数修复定向验证：`docs/reports/evidence/root-stage47-checkpoints/doc-facts-repair/execution.json`；不代替最终完整canonical。
- OIDC本地代理根因：`docs/reports/evidence/2026-10-12-oidc-fixture-readiness/README.md`、`causal-summary.json`；未增加原预算或改变协议断言。

本期任何必需 FAIL/UNRUN 仍在时，不宣称整体完成；代码实现、本地集成与双端验收、真实外部环境分开报告。
