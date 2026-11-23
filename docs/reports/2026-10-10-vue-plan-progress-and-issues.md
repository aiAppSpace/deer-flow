# Vue 统一计划已完成内容 剩余任务与问题

> 2026-10-11 更新：用户已明确恢复整个计划，范围与标准不缩水；下文保留 2026-10-10 暂停快照，当前执行以[恢复记录](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-11-vue-resume-execution-status.md)为准。

整理日期：2026-10-10，Asia/Shanghai。状态截止于当天约 11:58 的暂停收尾。

**整个计划保持 PAUSED。** 本次只整理既有执行记录和证据，没有恢复业务修改、代码审查、测试、构建、浏览器诊断、Docker 或本地入口验收。只有用户明确要求恢复后，才继续后续任务。

本次复核只完善本文：已将完整计划 W00–W13、九项架构整理、共同验收矩阵和十三条完成条件逐项映射，并补充准确停点与证据保存边界。未重新检查运行环境或产品源码，未产生新的产品 PASS/FAIL，也未将原计划恢复执行。文档链接检查不属于产品验收。

主体功能实现、架构整理与历史负担清理已大部分落源；最后的完整验收尚未完成，仍有已确认失败及未执行项目。暂停前约 **85%** 是计划完成度估算，不是测试通过率，也不是各工作包已全部完成的证明。

## 一 目标 范围与基准

本期同时处理两项工作：

1. 优化 `frontend-vue` 的架构和状态归属，清理失去消费者的旧实现、重复模型及历史工程负担。
2. 以当前 `frontend` React 的实际可达功能、操作流程、行为和 UI 为基线，以 `backend` 的校验、权限及 REST/SSE/JSON 契约为服务端依据，使 Vue 与 React 可以平替。

仅有三类明确豁免：**Vue 首页内容、docs/blog 内容站、整站无后端静态回放模式**。首页入口仍需可用；`showcase` 公开只读案例页属于本期同步范围，内容、样式、只读交互、产物展示和资源均需对齐。

暂停记录中的 Git 基准如下；本次文档整理没有重新执行 Git 检查：

| 项目 | 暂停时记录 |
| --- | --- |
| 工作分支 | `main-wc` |
| HEAD | `a7804539530846baecf548af7b5d2612deb89b68` |
| main | `5ecc1c2ac2de624af354bc515d5cb04f80df226c`，已为 HEAD 祖先，无未解决 merge entries |
| 工作区 | 保留既有及本期 WIP，没有 reset、回滚、提交或推送 |
| upstream marker | 仍为 `a93900d4…`，未推进；脏的审阅范围不能由当前 HEAD 自动确认 |
| 运行配置 | `.env`、`config.yaml`、`extensions_config.json` 的既定跟踪策略保留，验收使用隔离配置与数据 |

依据：[完整计划](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md)、[执行记录](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-execution-status.md)、[暂停记录](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-vue-plan-paused.md)。

原计划的审查结论、初始缺口及“尚未实施/UNRUN/实施进行中”措辞是对应阶段快照，不能覆盖本报告的暂停状态与后续精确 receipt。其他旧交接文件（包括 NEXT-WINDOW/cold-start）的“继续执行/提交/推送”措辞也不构成本次恢复授权。源码仍是后续判断实现现状的依据；本次只核对既有记录，没有重新裁决所有源码。

## 二 已实施的主要内容

下表中的“已实施”指代码已落源且有阶段性验证，**不等于对应整个工作包已经通过最终双端验收**。旧轮次的数量仅代表那次实际执行，不累加为最终覆盖率。

| 工作包 | 已落地内容 | 已有验证及当前边界 |
| --- | --- | --- |
| W00 契约和验收入口 | 受控核心 OpenAPI、扩展 schema 独立验证、类型和常量生成消费链；收集失败真实退出码；React 缺席与隔离副本边界 | 核心 172 paths /202 schemas；当前完整收集 18 配置、1602 项，其中产品 parity 978 项/45 文件。收集成功不代表浏览器通过 |
| W01 账户和偏好 | 登录/setup/callback、改密、账户中文；session owner、RBAC、偏好持久化与跨账号归属 | 真实 session/owner/RBAC/偏好 SQL、独立 auth parity 与 callback 等有阶段 PASS；最终完整聚合中的 auth/session 尚未运行 |
| W02 run 和消息 | nullable gap、durable 失败、END/error 尾帧、create/join/stop/dispose、稳定 human ID、附件交接 | 13 文件/218 项阶段回归及 protocol/real 阶段结果；最终真实 Gateway 全聚合待复验 |
| W03 产物 | 有界读取、Range/UTF-8/sha/conflict/owner、加载保存竞态、CodeMirror readiness、预览资源释放、项目转换预览和原始下载 | artifact/editor 37 项、项目浏览器 16 项等阶段 PASS；最终 real 截图和完整链路尚未收口 |
| W04 输入和模型 | 草稿/附件唯一 owner、提交身份快照、UUID、上传期锁、知识与引用、reasoning/model schema、语音润色等生命周期 | 事务 28 文件/213 项、17 项产品回归等阶段 PASS；完整双端与 mock 最终复验待完成 |
| W05 能力和 Agent | 三类 gallery、安装配置权限、Skill 409 刷新、Agent 定义包和 Save 校验、默认知识范围 | 46 文件/354 项等阶段 PASS；新发现 MCP 编辑器容量问题仍未修复 |
| W06 历史和删除 | 会话来源/未读/activity、虚拟行、分页/锚点/追尾、删除确认、部分 sidecar 失败继续主删除、行内编辑失败保留草稿 | owner 切换、活动组和历史原生滚动等已有回归；当前侧栏新 RED 尚未修复 |
| W07 调度 后台和 channel | 调度表单、goal/stop、DST/秒精度、history 51 取 50、卡片/events、后台 owner 与取消 | 29 文件/328 项及 scheduled/channels/agents 阶段 PASS；当前统一源后端浏览器全聚合仍待执行 |
| W08 扩展宿主 | assets-v1/inline-v1、动态页面、动作和 mentions、卸载、账号 owner、未知贡献不可用态 | 相关产品场景有阶段结果；最终双端完整聚合待完成 |
| W09 项目和 trash | 四 tabs、分页过滤、instructions、预览/附件交接/原始下载、权限、409 和部分失败 | 7 个 stateful fixture、16 文件/113 项等阶段 PASS；最终同源全量待完成 |
| W10 面板和设置 | browser/sidecar/memory/subagent/channels/shortcuts/changes；八个设置面板异步加载及请求归属 | 真实父 Suspense 下 loading/缓存等回归通过；整体布局与运行时验收待最终收口 |
| W11 showcase 和 UI | 公开案例内容/产物/只读操作、导出标题和时间、切案例 owner；多主题/语言/视口与交互状态样本 | 751 主差异样本目标；代表场景和定向回归已扩展，但本轮 751 主 diff 未执行，最终截图和样式审阅未完成 |
| W12 清理和 CI | 旧 owner/孤立模块/重复状态与 helper 清理；历史拼写守卫调整为必要语义/行为守卫；失败证据上传、独立运行、平台视觉和部署门禁接线 | 默认 standalone、Linux 及静态独立检查有实际 PASS；清理收益不能以删文件数或测试减少衡量，最终替换结论仍依赖未完成验收 |
| W13 最终验收和收口 | 完整命令、来源边界、失败现场、暂停停点及授权记录已维护 | **未完成，整个工作包暂停** |

### 架构和历史负担整理的具体落点

- 聊天页面保留路由/Agent/project 编排；run/session 生命周期收敛到流式链，提交、取消、销毁和恢复有明确 owner。
- 输入草稿与附件、产物编辑草稿/baseline、会话生命周期分别保持明确归属，避免多个可写状态镜像同时驱动结果。
- 消息展示、虚拟测量、prepend 锚点、追尾意图和消息操作职责分开；物理滚动 owner 与虚拟化观察对象保持一致。
- 服务端状态使用 Vue Query 的身份、缓存与失效范围；设置、集成授权、窗口/轮询/取消按各自生命周期处理。
- 无真实消费者的旧模块和重复实现按调用链核对后清理，保留实际产品需要的能力；基础无障碍、键盘焦点、可达性与必要语义没有作为无关功能整体删除。
- i18n 当前记录为 1828 keys /64 unused；unused 有逐键审计依据，不能据数量直接推断都应删除。
- Dialog/Sheet、菜单、ToggleGroup、引用/模型 picker、聊天/项目/设置/产物容量等已完成多轮根因修复和定向回归；最终整体通过仍由完整新构建验收决定。

这些实施细节和历史证据见[执行记录](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-execution-status.md)。本次整理没有重新审计所有源码，不能把这张表扩张为“每项当前工作树均已验收完成”。

## 三 已实际通过的完整检查

以下 PASS 均只覆盖各自 receipt 中的冻结源码和环境。**暂停前新增的侧栏 RED 测试不在旧 Vue canonical 或旧默认 standalone 的通过输入内，且属于无 React 时仍执行的 DOM 测试，因此当前整个工作树不能标记为全绿，也不能直接继承旧 standalone PASS。**

| 检查 | 最近有效结果 | 限定范围 |
| --- | --- | --- |
| React check 和完整 unit | 324 文件、2983 测试 PASS，0 FAIL/skip；两个原命令直接 0 | React/shared 消费输入在后续冻结间有零变化对照；不代替新生产浏览器、Docker 或部署入口 |
| 后端完整四分片 | 27133 PASS、414 既定 skip、0 FAIL；`make test` 直接 0 | 不能把 skip 当通过；完整分片不代替实际 Gateway 浏览器操作 |
| 后端 blocking/lint/format | blocking 235 PASS；lint 和 1960 文件格式检查直接 0 | MCP 测试假仓库补齐方法，原 0.2 秒预算及原断言保留，无该修复的后端生产算法修改 |
| Vue 完整 canonical | 478 文件、3930 测试全部 PASS；原完整入口直接 0 | 包含 lint/format、三类 types、i18n/生成/独立静态检查、生产 build、asset、核心/扩展 schema、真实 tarball 消费者及 audit。lint 为 0 errors /1 existing warning |
| 严格 peer 安装 | 原 frozen/strict-peer/offline 安装直接 0 | 不升级锁文件；已安装依赖与实际入口路径有独立核对 |
| Linux 视觉和资源 | 原 8 visual、完整 12 payload、asset 直接 0；同产物额外 8/12 通过，9 张 PNG 逐张回读 | 初次 10 PASS/2 timeout 保留；静默窗口按原构建、原 workers/timeout/预算完整复跑后才计 PASS |
| 无 React 默认 standalone | 原完整入口 8 条命令均直接 0；467 文件 PASS/11 声明 skip，3870 测试 PASS/60 声明 skip | 46 条因无 React、14 条因默认无后端 venv 跳过；不包括 `--with-e2e`，也不证明后端原生环境 |
| 消费者与依赖 audit | 真实 tarball 安装、消费者类型及最小 session 直接 0；audit 直接 0 | 仍有 6 advisories，与 6 项精确源码评审匹配；不是零漏洞或零 advisory |
| Docker 准备 | 2954 context 输入、真实 scratch COPY 2953 项直接 0；Gateway 894 生产输入对照通过 | 只完成输入和准备检查，当前双应用镜像及完整运行时验收仍未执行 |

关键收据：

- [React 完整执行](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage42-checkpoints/final-react/execution.json)及[后续输入边界对照](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/previous-react-consumer-boundary.json)。
- [后端完整结果](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/backend-final-stage42/repair-round-1/summary.json)。
- [Vue canonical 汇总](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/current-canonical-full-summary.json)及[原执行收据](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/final-canonical/execution.json)。
- [Linux 最终报告](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-linux-stage42-repair-round-1-final.md)。
- [默认 standalone 报告](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-standalone-stage43-default.md)及[结果收据](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/2026-10-10-standalone-stage42/default/summary.json)。

## 四 暂停时发现且尚未修复的问题

### P01 两端 MCP JSON 编辑器超过弹窗可见容量

状态：**FAIL，根因已确认，生产修复未实施。**

原正式 `capability-controls-reflow.spec.ts` 中，Vue 和 React 的 `mcp-settings#edit-personal` 各失败 1 项。在 360×800、root font-size 32px 时，`h-96` 的 textarea 达到 **768px**，实际 dialog clientHeight 为 **734px**。完整控件高于可见滚动容量，无法通过滚动完整进入视口。

桌面控件库存、弹窗保留及横向溢出断言已通过；两端同几何失败。暂停前没有修改本问题的生产文件或正式测试。候选 A/B 因模块解析和 Chromium 启动权限问题未进入应用，**实际候选验证为 UNRUN**，不能称已修复或验证通过。

涉及文件：

- [Vue MCPPluginManager](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/capabilities/MCPPluginManager.vue)。
- [React MCPPluginManager](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/capabilities/mcp-plugin-manager.tsx)。

恢复后需按弹窗实际可见容量、原 padding/border 和 min-height 优先级约束编辑器，保留正常桌面 384px、完整 JSON 值、textarea 原生编辑滚动及 whole-dialog pan；再验证低高度、字体放大和双向 resize。不改原量具、ratio 或预算。

证据：[MCP 暂停停点](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/mcp-editor-capacity-stage43/PAUSED.md)及[机器收据](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/mcp-editor-capacity-stage43/paused-checkpoint.json)。其中 `causal-results/` 是未进入应用的诊断工具失败现场，不能代替正式双端 MCP 失败 trace，也不是候选修复 GREEN。

### P02 Vue 桌面侧栏出现非预期横向滚动

状态：**FAIL，结构根因候选已有 trace/源码对照和 mounted RED 支持，原生因果验证及生产修复未实施。**

原 `chat-scroll-owner-reflow.spec.ts:169` 在 Vue agent-chat 的 1280×800、root32 context 中检出唯一非预期横向滚动对象 `sidebar-inner`。该次的 documentOverflowX=0、lostControls=[]、unreachableClips=[]，Copy/Regenerate 的真实 Shift+Tab→Tab 和 ratio1 均通过；之前两个窄屏 context 也通过。因此不能把此失败笼统描述为聊天内容高度不足或复制按钮不可达。

结构对照显示 Vue 同一节点兼任定位/translate 和滚动 owner；React 虽然也将 rail 放在 inner 的 DOM 后代中，但 absolute containing block 是外层 `sidebar-container`。候选修复方向是分离定位与原生滚动职责，保留侧栏 rail 的点击/拖动能力和原有低高度焦点合同，而非以 `overflow-x:hidden` 裁切掩盖。

暂停前本轮唯一新增的正式测试修改为：

- [thread-sidebar-lifecycle.dom.test.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/unit/workspace-shell/thread-sidebar-lifecycle.dom.test.ts)。定向 3 项中，原 2 项 PASS、新增 1 项 RED；直接退出 1。
- [ThreadSidebarShell.vue](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/ThreadSidebarShell.vue) 的本问题生产修复尚未实施。

证据：[侧栏暂停停点](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/chat-scroll-sidebar-stage43/paused-checkpoint.md)、[trace 量测收据](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/chat-scroll-sidebar-stage43/trace-extracted.json)。该条正式失败的 trace、3 张 PNG 与 error-context 已持久保存于 [original-failure](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/chat-scroll-sidebar-stage43/original-failure)。这不表示整个 cross-app 的全部失败现场都已持久归档。

### P03 旧真实 Gateway 截图失败尚未完成最终复验

状态：**旧源 FAIL 保留，最终修复后新构建复验 UNRUN。**

前一完整 mock 为 560/560 PASS；后续 backend 顺序中 protocol 2 PASS，real 为 5 PASS/1 Darwin 截图 FAIL。该截图约 21032px、差异比例约 0.03，超过原 0.02；之后 scheduled/channels/agents/settings/shell/browser 共 16 项及 external 3 项未执行。

相关实现和现场已在执行记录中追踪，但暂停前新的隔离浏览器副本尚未执行最终 mock/backend/external。因此不能将旧失败直接说成当前必然复现，也不能凭定向修复或 DOM 断言通过就宣布截图问题已收口。原 baseline 和 0.02 阈值保留。

证据：[完整执行记录中的 e2e-mock/e2e-backend 状态](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-execution-status.md)。

## 五 已处置问题与仍需保留的结论边界

| 项目 | 已完成处置 | 不能外推的结论 |
| --- | --- | --- |
| Stop 只中断本地观察而未真正取消 run | 显式 Stop 交由 stream owner 发送服务端 cancel，保留卸载/作用域取消链；相关消费回归已通过 | 最终全部流式拓扑仍需完整复验 |
| Dialog/Sheet iframe 焦点边界、低容量布局和 picker 生命周期 | 已落源并有定向 mounted/native 回归；继续使用公开 primitive 生命周期 | 定向 PASS 不替代三轴全状态/全键盘宏 |
| React 公开 Mermaid Escape 关闭层级错误 | 使用公开 renderer 扩展点及标准 Dialog；React 最新完整 check/unit 覆盖已冻结修复 | 公开案例完整新编译浏览器仍需最终验证 |
| Vue canonical 前轮 3 FAIL | 删除重复 Dialog caller class、header 改必要 AST 语义断言、隔离副本补两份公开 example fixture；后续完整 canonical 3930 PASS | 后来新增侧栏 RED 不属于该次通过输入 |
| pnpm 副本 shim 回用原仓库 NODE_PATH | 独立副本按原 frozen/offline 安装重生入口，核实际 startup/globalPaths；后端独立 venv | 不能把复制 node_modules 或仅路径存在当隔离成功 |
| 后端 MCP 测试假仓库缺通知方法 | 补齐协议并保留/增加成功路径断言；原四分片、blocking/lint/format 实际通过 | 没有证明此前 0.2 秒超时的每一项精确时序原因 |
| Linux 初轮 2 timeout | 保留现场；在静默窗口按原完整 12 项及原预算重建复跑，取得真实 PASS | 不称首轮从未失败，也不把资源竞争假设当自动豁免 |
| 旧 Linux postverify 的生成标记变化 | 新轮从捕获开始单列 runtime marker，构建/门禁输入与全副本分别核验 | 不覆写旧 direct1，不称整个原仓库零漂移 |
| closed-details 内未绘制 checkbox 被量具误收 | 按真实绘制资格修量具，并保留可见裁剪等负向控制 | 不扩大真实可见控件的豁免范围 |
| auth 四条额外只读 GET | 旧 baseline 保留 login/setup × 两 locale 的 Vue `/auth/me` 请求；符合计划允许的无副作用请求组织差异 | 不是鉴权功能豁免，也不能声称两端全部网络请求逐条相同 |
| 历史文档运行措辞 | 执行记录顶部已明确暂停；下面各轮记录作为历史现场保留 | 历史“正在运行/待执行”不代表目前仍有任务在后台推进 |

旧完整 cross-app 曾为 913 产品项中的 878 PASS/35 FAIL；751 主 diff 当时只采集到 376 对，377 号前置定位失败，余下 374 对未执行。多项修复已落源，**这 35 项不能全部继续称为未修复，也不能因为修复已落源就全部改写为 PASS**；仍由下一次完整新源验收收口。

旧 376 对仅表示采集到该位置，不等于 376 对零差异；主 diff 的累积比较尚未完整结束。历史计数、阶段修复与本轮 57/3/1 分属不同输入和执行，不能相加计算最终通过率。

## 六 本轮中断的准确状态

原命令为 `make -j1 -C frontend-vue e2e-cross-app`，在冻结副本中于 11:42 开始。完整顺序保持 **产品 978 → anonymous auth 21 → 真实 SQL session 8**。

暂停时实际日志：

| 项目 | 结果 |
| --- | --- |
| 已完成通过 | 57 PASS |
| 已完成失败 | 3 FAIL，即两端 MCP 编辑器和 Vue 侧栏 |
| 用户中断 | 1 项 Vue combined-reflow 全状态宏；reporter 的叉号不计第 4 个产品失败 |
| 主聚合 | `INTERRUPTED_USER_REQUEST`，直接退出 130；未完成 |
| 751 主 diff | 本轮尚未执行 |
| anonymous auth 21 /真实 SQL session 8 | 本轮 UNRUN |
| gate 后源码/依赖校验 | 因暂停未执行，不能为此次中断补称 postverify PASS |

证据：[中断执行 receipt](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/final-cross-app/execution.json)。原 RUNNING receipt 已另存，不覆写历史现场。

UI 主 diff 比较选定锚点的几何和 computed styles，并核对语义、ARIA、请求、焦点及 Tab；既有几何容差为 2px。**它没有 React↔Vue 逐像素自动比较断言。** 双端 PNG 是独立证据，保存失败被 catch 不必然使主 diff 失败，所以最终必须另核实际截图齐备及代表状态样式。

751 样本对应预期 1502 张双端截图，本轮尚未生成。恢复后应按完整 key 集合核两张 PNG、解码/尺寸、缺失/额外文件，并按桌面/手机、中英、明暗及代表案例审阅字体、颜色、间距、边框、阴影、图标、滚动容器与交互状态。不能只以 Vue 自身平台回归或语义零差异宣称 UI 可平替。

## 七 剩余任务

**下表是暂停后的待办清单，不是本次启动的执行指令。全部保持 PAUSED/UNRUN，等待明确恢复。**

| 顺序 | 剩余任务 | 完成条件 |
| --- | --- | --- |
| R00 | 恢复前核对与现场保全 | 仅在用户明确恢复后进行：先读本文暂停边界，确认实际 Git/WIP、原始失败现场及私有恢复输入仍在；保存易失现场，核活动任务/端口/构建归属，再建立新轮次；不依据旧 PID、旧 PASS 或旧交接指令直接启动 |
| R01 | 修复双端 MCP 编辑器容量 | 真实旧源失败可复现；候选因果验证、新编译正式回归通过；保桌面几何、完整值和原生编辑/弹窗滚动 |
| R02 | 修复 Vue 侧栏定位与滚动归属 | 原 trace 问题复验通过，新增 mounted RED 转 GREEN；拖动/点击/键盘/移动端生命周期及低高度合同保留 |
| R03 | 汇总改动并重新冻结验收输入 | 新物理副本、独立依赖和后端环境、公开受控 fixture、工具及来源边界明确；不修改旧不可变副本或覆盖旧 receipt |
| R04 | 完整静态/单元/契约/构建复验 | Vue canonical、OpenAPI/扩展、asset、consumer/audit；双端 MCP 若修改 React，重跑 React check/完整 unit。若再改 backend，按该端测试先行及完整四分片/blocking/lint/format 要求执行；其他端按实际受影响输入决定复验，不以旧 PASS 冒充新源 |
| R05 | 完整 cross-app | 原完整产品、anonymous auth、真实 SQL session 顺序执行；无筛选、无跳过替代、原全部宏/751目标/预算/阈值保留 |
| R06 | 完整 mock/backend/external | mock 各子套件；backend protocol/real/scheduled/channels/agents/settings/shell/browser 八拓扑；external WS/受控 OIDC。关闭旧 real 截图失败及前置阻断遗留 |
| R07 | Linux 和双端样式验收 | 新生产源触发相应 visual/payload/asset 复验；751×2截图完整性与有意义代表状态审图完成 |
| R08 | 无 React 独立运行 | 对最终新源完成默认 standalone 与显式 `--with-e2e`；install/build/unit 和完整 mock/backend 均保留，skip 原因和真实后端环境分别记录 |
| R09 | Docker 最终验收 | 两端 canonical 镜像、原三入口探针、真实双 hostname OIDC、Vue container-smoke、正常 SIGTERM、端口释放与 SQL 保留；scratch COPY 不能替代 |
| R10 | 本地三入口 | 原 `make dev-vue`、`make dev-dual`、Vue production 入口实际启动及浏览器 API/提交/恢复验收；按入口实际影响独占排程 |
| R11 | 三端增量与同步收口 | 核 frontend/backend/contracts 的最终变更及既有 WIP；必要文档/CI/门禁同步；marker 仅按实际审阅范围记录，脏基准保持 REVIEW_REQUIRED/UNKNOWN |
| R12 | 最终交付 | 分开报告代码实现、本地集成与双端验收、外部环境验证；本期必需项有 FAIL/UNRUN 就不能宣布全部完成。提交/推送按后续实际授权执行 |

Nuxt `.output` 与 React `.next` 的共享输出边界仍须遵守：同一副本相关套件顺序执行；不同端口不代表构建隔离。不得为节省时间减少场景、键盘次数、宏范围、截图目标或放宽预算，也不得用更新 baseline 接受新差异。

完整命令保留在[原计划的执行入口表](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md)，本次没有运行这些命令。

### 逐工作包恢复核对索引

以下保留原计划的领域要求，供恢复后逐项查证，不是新发现的代码缺陷，也不是另一份独立完成台账。实施进度沿用第二节与执行记录；未找到对应最终证据的细项保持待核，不能因为所属套件曾 PASS 或页面存在就自动关闭。范围、场景、API/状态、Vue 消费者与验证结果应继续维护同一条对应链。

| 工作包 | 恢复后不可遗漏的核对项 | 收口入口与原计划位置 |
| --- | --- | --- |
| W00 | 唯一 scope/product-surface/scenario 清单；旧 WIP 与本期实现区分；`scheduled_goal_notes`、`scheduled_task_errors`、`thread_origin` 等 JSON contract 的生成与实际消费者；缺 React、收集失败、隔离副本的负向路径。静态整站模式是范围豁免，不能据此虚构已有模式级断言 | R03–R06、R11；[W00](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:240) |
| W01 | session-only preferences 与 `X-Expected-User-Id`；字段级 PATCH、null/204；auth-disabled 不发偏好 API；403/409 停旧 owner、503/离线 pending 恢复；跨 tab 不同 key；locale 兼容旧 Gateway、IANA timezone 分开；scheduled/activity/subagent 等 feature 各自判定 available/running/toolEnabled 等状态 | R05–R06；[W01](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:249) |
| W02 | `on_disconnect=continue`；显式 Stop、cancel 与 observer abort/dispose 分开，202/204/409 不统一伪造终态；两种 nullable gap、durable 失败、终态后的 error/END 尾帧；run input 水合；同 run join/同身份幂等重试、不重复 create；稳定 human ID、项目/本地附件合并，成功只退休本次提交快照 | R04–R06；[Run 契约](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:172)、[W02](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:258) |
| W03 | 保存中锁编辑、baseline SHA/提交快照、失败/412/离开保护；切文件及卸载晚返回；blob URL/worker/iframe/generation 释放；当前实际支持的代码、Markdown、HTML、图像、音视频、PDF、图表、CSV/TSV 等预览及 pending/截断只读/分页/资源上限；转换预览与原始下载分开 | R04–R07；[W03](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:267) |
| W04 | 展示元数据、conversation grants、Skill、knowledge_scope、extension mentions 各自通道；旧 grant/replay 不隐式重授权；3/4 引用、16/17 skills、重复/非法/跨用户/已移除 Skill 历史快照与整批原子；typed slash；reasoning 的 run/provider、账户 preference、Agent 三套 schema；普通 textarea/Skill contenteditable 同锁定；语音润色、聊天 IANA 时区 | R04–R06；[授权分层](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:155)、[W04](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:276) |
| W05 | models 设置与能力迁移；旧 settings query 不新增自动重写，关闭保留其他 query/焦点；MCP 平台/个人及管理员权限、密钥遮罩与安装身份；Lark 窗口/轮询/取消 owner；Skill revision 409 后显式刷新，禁止使用旧 manifest 或自动重试；Agent 100 Unicode 码点、稳定 URL name、create-only 409 不覆盖、导出排除私有绑定；知识 all/none/selected/search/page/default/recovery/不可选项 | R01、R04–R07；[W05](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:285) |
| W06 | 编辑重跑/regenerate/分支 lineage/checkpoint/压缩/adopt/join；origin legacy fallback；activity cursor/read_version/truncated/首 poll seed/单 poll owner/visibility/mark-read 时机，feature off 不请求；prepend、追尾暂停、目录跳转、活动组与 resize/折叠长输出；调度事件随 measured row；混合 AI/tool 的 change anchor；删除与部分 sidecar 失败 | R02、R04–R07；[W06](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:294) |
| W07 | 页面与 hook 实际接线，`task_id/thread_id`、搜索/tab/404/复制/删除/续期；`run_at` 秒精度/DST fold、未改 interval 秒数/changed-only PATCH、assistant 省略与 null；fresh/reuse/goal 的停止条件；task 与 occurrence、queued/launching/running/unmet/failed、手动触发冲突/排队取消；51 取 50、分页取消/仅 page0 轮询；live card 最后一张、只读 scheduled human/隐藏 prompt/删任务 title snapshot/events measured row；通知 pending/retry、字段 presence 与后台 owner 竞态 | R04–R07；[W07](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:303) |
| W08 | inline-v1/assets-v1 模块图、相对 chunk/资源与未知 transport 的单贡献故障隔离；动态页面、导航、侧栏/会话行菜单/工具栏、mentions 全部宿主；abort/dispose/viewer/expected-user/allowlist/账号切换/导航晚返回；custom Agent 元数据、409 与卸载；未知 surface 不可用态和资源 API 404 分开；发现页仅指引，不新增网页 Python 安装器 | R04–R06、R09；[W08](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:315) |
| W09 | 项目四 tab，刷新回 chats 不虚构 deep URL；instructions UTF-8 限额、保存 A→B 竞态、rename-only-name；成员线程 `next_offset`/每线程 200 文件/截断提示；归档读和附加与写限制；转换预览不等于原始文件；跨路由附件去重/retry/成功只退休快照及 backend 返回文件名；trash 原项目消失、active/merged 不重复、content_missing 409 保留、永久删除确认、全量清空与部分 500 后 refetch、读写/删除分权及 404 | R04–R07；[W09](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:323) |
| W10 | 既有 account/appearance/notifications/channels/memory/subagents/about 设置与 models、密码/logout/OAuth；命令/快捷键与面板互斥/恢复；browser extra/匹配 Chromium/单 worker，binary JPEG 与 legacy JSON/base64、WS 重连/blob/导航失败重试/原生键盘/几何；memory 缺失不可用、编辑/reset；subagent repository/worker/history/pause/resume/retry/result；Sidecar 独立协议、权限、关闭及账号/线程晚返回 | R04–R07、R09–R10；[W10](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:332) |
| W11 | 全部当前登记 showcase 案例及资源逐一核对；未知案例/资源 404、原始正文、只读且无隐藏写请求；消息/推理/工具、Markdown/代码/表格/Mermaid、产物实际类型及展开/复制/导出/原始下载/滚动/刷新/切案例 owner；全部 UI 状态及菜单/抽屉/表单/多面板、低容量/放大/resize/键盘；截图数量不能替代专项行为 | R05–R07；[showcase 专项](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:97)、[W11](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:340) |
| W12 | 新 owner/生产链替换并通过相关回归后才删旧实现；不误删 WIP、Nuxt 自动入口、worker URL 或生成 types；公开组件 API 替代 DOM/tabstop/播报/聚焦补丁须有实测；协议/缓存/权限/代理/键盘负向保护保留；spec/config/Make/CI 收集及失败归档、新 advisory/版本/路径识别；提速只复用同构建参数且保留不同拓扑 | R04–R09、R11；[架构清理](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:108)、[W12](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:348) |
| W13 | 三端最终增量与 WIP 接线/验证或有依据移除；README/ARCHITECTURE/BEHAVIOR_CONTRACTS/OpenAPI/相关 AGENTS 与命令/CI 一致，不编辑 CLAUDE shim；frontend/backend/contracts marker 分别审阅，缺兄弟/历史不可达/脏基准记 UNKNOWN/REVIEW_REQUIRED；revision、直接退出码、skip、来源、失败现场、遗留与外部边界齐全 | R00–R12；[W13](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:358) |

showcase 的阶段登记为 **13 个案例**；已有 UI 场景为 6 个代表案例各 8 维、其余 7 个各 2 维，另有报告预览 8 维，共 **70 个公开案例样本**，不是 13×8。另有 16 例共享交互回归及 7 类产物打开记录。恢复后先核实际登记是否变化，再按全案例资源与代表内容类型收口，不能以现有样本数固定未来范围。依据：[W13 接线与 showcase 审查](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-w13-gate-review.md)。该报告后面的 Stage34/35 数量与本地 PASS 是旧轮记录，不能替代本文最终停点。

### 九项架构整理的最终核对

第二节保留已实施摘要；下表补足原计划九项整理要求的关闭依据。它们均仍需与最终消费者/回归结果对应，不因“代码已拆分”而整体勾选，也不因本次补表而被改称九个新缺陷。

| 整理项 | 恢复后应核对的关闭依据 |
| --- | --- |
| 消息虚拟化 | Vue Virtual 的动态测量、prepend/追尾/目录/活动组/调度事件共用正确物理 owner；长会话、resize 和折叠回归有实际结果 |
| 聊天编排 | AgentChat 保留页面编排，session/Agent 创建/面板、Composer 语音/润色/命令/上传、MessageList 测量与消息动作各有可取消的明确职责 |
| 状态归属 | 输入草稿/附件、产物草稿/baseline、session 生命周期各有唯一可写 owner；reset/generation/派生状态无双写镜像；app/core 与框架无关 agent-core 边界清楚 |
| 缓存与 feature flags | Vue Query 的 query identity/去重/失效范围一致；重复手工缓存确被新链替换，mutation 结果归发起身份，feature 能力状态分别消费 |
| 集成流程 | Lark 授权窗口/轮询/取消有可复用 owner，能力迁移后的 UI 不复制第二套流程 |
| 孤立代码与重复模型 | thread-context、旧 proxy policy/builder、keyboard/upload adapter、旧 artifact editing 等候选逐项有真实消费者判断；不把暂未接线 WIP 当废代码 |
| 重复算法 | workspace change anchor 等生产 inline 与 helper 已收敛，尤其混合 AI/tool 边界有回归，不能只保留一个未被生产消费的 helper |
| 历史叙事与门禁 | 固定规模/行数/旧轮次叙事与纯拼写守卫按实际职责清理；必要结构、行为和负向保护仍在，并且正式入口收集到新增回归 |
| UI 适配 | 必要无障碍、键盘焦点与可达性保留；菜单 DOM/tabstop、路由播报和聚焦滚动补丁仅在公开 API 实测能替代后收缩；P01/P02 不靠裁切或绕过解决 |

### 共同验收矩阵和环境前置

| 维度 | 最终必须保留的核对内容 |
| --- | --- |
| 对照环境与数据 | 同 Gateway、seed、权限、Chromium/字体、viewport/主题/语言、时钟/动画控制；两个 workspace 各用其锁定 pnpm，经根 `scripts/pnpm.py`；隔离配置，不使用私有插件或真实用户数据 |
| 浏览器与持久化 | backend 的 `browser` extra、匹配 Playwright Chromium 与受控 browser/channel 单 worker；activity/preferences 真实 SQL persistence；scheduler available/running/toolEnabled 分开；MCP/知识 provider/扩展适配器和权限由受控 seed 建立 |
| UI 与布局 | 中英×明暗×桌面/手机，按页面真实主题限制；loading/empty/error/selected/disabled/hover/focus；窄屏、低高度、文本放大、双向 resize、弹层/菜单/抽屉/表单/多面板；原生键盘/焦点归还与真实可达性 |
| 路由与任务恢复 | 直达、刷新、站内切换、返回、深链和 404；运行中刷新/切换仍恢复正确 run/消息/输入，旧请求不能污染新作用域 |
| 持久化边界 | 主题/语言、模型选择与收藏、用户设置、草稿、Agent/project、面板尺寸、历史在刷新、重登、切用户/线程/Agent、跨 tab 时逐项按 React 实际行为核对；附件等短期资源不笼统要求永久保存 |
| 异常可继续操作 | 离线/超时、鉴权失效/权限拒绝、资源消失/冲突、流中断、部分上传失败、授权窗口关闭/过期、请求中切路由；反馈及恢复后能继续操作，不能吞错成成功 |
| 成本与运行 | 原 asset budget、必要构建/场景耗时、关键长会话表现有实测；本地单/双端、生产、无 React 独立运行、Compose/容器各自证明其拓扑，不能互相代替 |

原计划中的同参数产物复用和提速是可选优化，不是新增必做项，也不阻塞产品修复；独立隔离与完整覆盖属于必做。不能借优化降低样本、阈值、workers/timeout 原约束或省略不同鉴权/代理/degraded Gateway 拓扑。

CI 的阶段性事实也须分别保留：隐藏 standalone 失败目录 `frontend-vue/.cache/standalone-failures/run-*/**`、`include-hidden-files: true` 与原 test-results/playwright-report 上传路径已有接线及负向回归；旧配置 RED 后 3 文件 36 PASS。**GitHub hosted 的实际失败上传和远程分支 required 设置未验证。** 恢复后核签入配置、实际收集、失败现场可获取性与证据；本地配置 PASS 不能称远程上传成功，未查询的远程设置也不能被写成新发现的代码缺陷。详见上述 W13 审查及[最终 gate 范围审查](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-final-gate-scope-audit-stage42.md)。

### 原计划十三条完成条件映射

以下十三条均**尚未最终关闭**；其中已有大量阶段 PASS，仍须按上文精确输入与剩余任务收口。此表是原计划完成条件的定位索引，不另算进度百分比，不将缺最终证据自动判为代码未实现。

| 条件 | 完成条件摘要 | 最终关闭位置 |
| --- | --- | --- |
| C01 | 范围内实际页面/入口/操作完整，三类豁免不扩张，showcase 不排除，不以空页面/字典/types 代替功能 | W00、W05、W08–W11；R05–R07、R11 |
| C02 | showcase 全登记案例/资源、UI、只读交互与双端对照完整；工作区可写操作分别验收 | W11 专项；R05–R07 |
| C03 | 暂停前 WIP 已接线并验证，或有依据明确移除，无悬空半套迁移 | W00–W12 的实际消费者；R00、R11 |
| C04 | 已复现缺陷根因修复、有意义回归通过，异步结果不污染其他作用域 | P01–P03 及历史修复边界；R01–R07 |
| C05 | nullable gap/durable 失败/human ID/run input/附件合并正确，无重复 create、丢 human 或旧草稿假提交 | W02–W04、W09；R04–R06 |
| C06 | preferences/locale/timezone、授权分层、三套 reasoning、知识 recovery、Agent 定义包、来源/未读分别通过 | W01、W04–W06；R04–R06 |
| C07 | 调度页面/卡片/prompt/events/分页/队列/续期/通知、项目四 tab/附件、trash 部分失败及扩展完整宿主有实际场景结果 | W07–W10；R04–R06 |
| C08 | 范围内功能/流程/可观察行为/UI 样式通过双端验收，无新增豁免掩盖差异 | W00–W11、共同矩阵、1502 PNG 与样式审阅；R05–R07 |
| C09 | 九项架构整理与历史负担清理完成，唯一 owner/真实消费者清楚，必要无障碍及验证能力保留 | 上述九项清理表、W12；R01–R07、R11 |
| C10 | 当前 backend 的 REST/SSE/JSON 及实际消费者核对，持久化/取消/异常/恢复可继续使用 | W00–W04、各域 owner、共同矩阵；R04–R06、R11 |
| C11 | 完整 verify、相关浏览器/真实后端/视觉有明确结果，CI 接线可复核、失败现场可获取 | 第三/六节的旧 PASS 与中断边界；R03–R09、R11 |
| C12 | Vue 生产构建、独立运行及本地入口通过；容器入口保留独立证据，外部生产/第三方条件单列 | R04、R08–R10、第八节外部边界 |
| C13 | 文档/源码/命令/验证结果一致，marker 与实际审阅范围一致 | W13；R11–R12，保留 UNKNOWN/REVIEW_REQUIRED |

与[原计划完成条件](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:396)一一对应；任何本期必需 FAIL/UNRUN 仍在时，R12 不得报告整体完成。

## 八 暂停收尾和外部边界

### 已完成的停止动作

- 根验收 session 88730 已中断。
- 只向实际 cwd 确认属于本次冻结副本的 7 个残留服务/包装进程发送 SIGTERM；3370/3371/8260 实测 ECONNREFUSED。
- 各实施子任务已停止；本次文档核对任务也仅只读既有记录，未执行原计划工作。
- Docker 最终构建与运行时验收未启动，本地三入口未启动。
- AiPPT 未发送停启信号，暂停收尾时 3000 仍可连接；没有改变其代码或配置。

这些是暂停时的检查点，不是本次重新进行全机进程普查或当前生产健康验收。证据：[自有服务停止收据](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/pause-owned-services-stop.json)。

MCP 诊断浏览器的退出/清理来自执行日志；额外 `ps` 复查被 sandbox 拒绝，不能声称已独立普查全机进程。停止本次自有服务也不等于删除宿主的全部容器或中断其他项目；恢复前仍须重新核实际活动任务与资源归属。

### 已有授权和待验证环境

用户已允许：最后标准 `make dev-dual` 窗口，如确认可恢复，可临时暂停占用 3000 的 AiPPT，验收后恢复。**授权尚未使用。** 恢复执行前需重新核真实进程身份、cwd/argv、启动依赖与私有恢复输入，取得原 HTTP/UI 基线，再执行暂停及恢复并验证。历史 PID 不能直接作为操作依据。

`serve.sh` 的 sandbox-prefix 清理存在跨副本影响，正式入口窗口前还需核其他活动容器/任务。已有恢复准备只证明当时输入可用，不证明重启/恢复成功。

私有环境值及精确恢复输入只保存在受限临时目录，持久收据只保留指针/哈希；恢复前必须确认这些输入仍存在、权限及字节符合记录。若已失效，先重新取得可恢复依据，不能仅凭旧记录暂停 AiPPT，也不能把私有环境值复制到本文或其他持久报告。原 PTY 可能退场，恢复应使用独立私有日志；实际重启及 HTTP/UI 恢复验证尚未执行。

参见：[本地入口恢复准备](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/local-entry/stage43/README.md)、[恢复输入与前置条件收据](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/local-entry/stage43/port3000-owner-restore-readonly.json)及[实际用户授权记录](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/local-entry-authorization.json)。

真实模型、远程 IdP、Lark/IM 等第三方账号、生产 DNS/TLS 和外层代理保持独立外部验证边界；受控 replay/IdP 的 PASS 不代表这些环境已通过。本期本地必做链路仍须全部完成，外部条件不能作为省略本地任务的理由。

## 九 续做证据入口

| 记录 | 路径 |
| --- | --- |
| 本报告 | [2026-10-10-vue-plan-progress-and-issues.md](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-vue-plan-progress-and-issues.md) |
| 完整计划 | [2026-10-09-vue-period-plan.md](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md) |
| 历轮执行记录 | [2026-10-09-vue-execution-status.md](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-execution-status.md) |
| 原暂停记录 | [2026-10-10-vue-plan-paused.md](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-vue-plan-paused.md) |
| MCP 未实施修复停点 | [PAUSED.md](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/mcp-editor-capacity-stage43/PAUSED.md) |
| Vue 侧栏 RED 和根因候选 | [paused-checkpoint.md](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/chat-scroll-sidebar-stage43/paused-checkpoint.md) |
| Vue 当前 canonical | [current-canonical-full-summary.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/current-canonical-full-summary.json) |
| 本轮中断与三条失败 | [execution.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/final-cross-app/execution.json) |
| 暂停与独占端口清理 | [pause-owned-services-stop.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/pause-owned-services-stop.json) |
| 机器状态记录 | [progress-live.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/progress-live.json) |
| 冻结来源与最终输入 | [final-source-frozen.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/final-source-frozen.json) |
| 独立浏览器副本准备 | [browser-copy-preparation.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/browser-copy-preparation.json) |
| 隔离准备裁决 | [preparation-decision.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/preparation-decision.json) |
| Docker context/COPY 准备完成点 | [preparation-completed.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/container-ingress-stage43/preparation-completed.json) |
| Docker runtime 拓扑/项目/镜像准备 | [runtime-preparation.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/container-ingress-stage43/runtime-preparation.json) |
| Docker 准备工具指纹 | [preparation-tools-final.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/container-ingress-stage43/preparation-tools-final.json) |
| standalone 外层副本准备 | [outer-preparation-summary.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/2026-10-10-standalone-stage42/outer-preparation-summary.json) |
| standalone 外层最终来源 | [outer-source-final.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/2026-10-10-standalone-stage42/outer-source-final.json) |
| standalone 默认入口实际执行 | [default/actual-run.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/2026-10-10-standalone-stage42/default/actual-run.json) |
| canonical/fixture/消费者边界审查 | [2026-10-10-canonical-fixture-coverage-audit-stage42.md](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-canonical-fixture-coverage-audit-stage42.md) |

上述准备收据中的 READY、PREPARED、输入核对 PASS 均不代表相应应用验收 PASS；准备时的 UNRUN 若有后续执行，以后续精确 receipt 为准。例如 standalone 准备收据的 default UNRUN 已被 default/actual-run.json 的实际 PASS 取代，`--with-e2e` 仍未执行。各审查报告内旧轮次的数量、阻塞与运行措辞不覆盖本文最终停点。

### 物理副本和准确停点

| 边界 | 暂停记录中的绝对位置 | 已执行与恢复位置 |
| --- | --- | --- |
| root canonical/cross-app | `/private/tmp/deerflow-next-final-stage43-ao4rs6c4` | canonical 完整 PASS；cross-app 在产品段 57 PASS/3 FAIL/1 用户中断，直接 130；751/auth/session/postverify 未执行。修复生产源后建立新副本，不从中断样本续跑冒充完整聚合 |
| 独立 Vue 浏览器 | `/private/tmp/deerflow-vue-browser-stage43-4nfbic4d` | 已建物理副本、独立依赖及 backend imports；最终 mock/backend/external 均未启动。只可重现旧源或参考准备方法，不能作为新源最终输入 |
| Docker 源 context | `/private/tmp/deerflow-ingress-source-stage43-is3bkv8g` | 已完成输入捕获及真实 scratch COPY；`build-vue/build-react/probe/probe-oidc/smoke/normal-stop` 六 phase 全部 UNRUN |
| Docker runtime 准备 | `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docker/.cache/container-ingress-stage43` | 准备项目为 `deerflow-vue-ingress-5348c55bfc`，旧准备入口 `vue.localhost:2326`/`localhost:2326`；镜像编译、Compose 启动和实际探针均未执行。项目名/端口只是准备值，恢复时重核归属，不称仍有运行服务 |
| 无 React standalone outer | `/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-4CUZ8O` | 旧源 default 完整 PASS，实际 inner 已按 dispose 清理；outer 当时保持无 React、无根私有运行配置、无安装依赖。`--with-e2e` UNRUN；后续生产变更应重新冻结 outer，由原 factory 新建 inner |

root/browser 冻结的来源记录为 5668 份源码；加入两份从根公开 example 逐字复制的 runtime fixture 后，门禁输入为 5670。不得将此差异记成未说明的私有配置，也不得沿用原仓库的私有运行配置。Nuxt buildDir 的副本转换、依赖重建和工具字节等边界以对应准备收据为准；复制 node_modules、旧 shim 或共享 `.output/.next` 不能替代独立性证明。

Docker 恢复时仍需三条原入口探针（公共入口 replay、公共入口 browser/WS、内部 Nuxt proxy）、独立双 hostname OIDC、container-smoke 的 non-root/health/showcase/404、正常 SIGTERM/端口释放和 SQL 保留。复用 Gateway 镜像须重核生产输入；仅镜像标签或旧 Stage39 PASS 不是最终来源证明。旧 Docker 运行脚本包含既有轮次/镜像/证据目录，不能未经核对直接执行或覆盖旧结果。

### 已保存的准备工具

以下只定位既有方法和观测入口，本次没有执行这些脚本。恢复后先核新源、工具路径、硬编码旧轮次和输出目录，再创建独立新轮次；不能直接复用旧 execution.json 或覆盖已执行 phase。

| 用途 | 已保存工具 |
| --- | --- |
| root 源副本 | [prepare-source-copy.py](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/prepare-source-copy.py) |
| 独立依赖与 backend 环境 | [prepare-frozen-dependencies.py](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/prepare-frozen-dependencies.py) |
| 独立浏览器副本 | [prepare-browser-copy.py](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/prepare-browser-copy.py) |
| 原门禁与输入/退出码观测 | [run-frozen-gate.py](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage43-checkpoints/run-frozen-gate.py) |
| Docker 逐 phase 观测 | [run-phase.py](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/container-ingress-stage43/run-phase.py) |
| standalone 原入口观测 | [run-standalone.py](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/2026-10-10-standalone-stage42/run-standalone.py) |

### 失败现场的保存边界

正式 cross-app 完整失败归档的收据指向 `/private/tmp/deerflow-next-final-stage43-ao4rs6c4/frontend-vue/test-results/failures/2026-10-10T03-55-25-561Z`。**尚不能声称完整归档已经持久保存到仓库。** 侧栏正式失败的 trace、3 PNG、error-context 已在 P02 所链的 original-failure 中持久保存；MCP 的诊断 causal-results 不能替代正式双端失败 trace。恢复后先确认完整临时归档是否仍在，保存缺少的正式 trace/截图/上下文；若现场已丢失，如实标注缺失并重建相同旧源复现，不能伪造原始现场齐备。

临时副本仅用于现场重现，不能保证其长期保留；持久报告和主要收据在仓库 `docs/reports/`。恢复时应先确认所需原始现场仍存在，必要时保存完整现场，再创建新验收轮次，不直接覆盖旧失败或继续引用旧编译产物证明新源码。

本次文档复核已逐项对照 W00–W13、九项架构整理、共同矩阵、十三条完成条件及 R00–R12；75 处本地链接均核实存在。链接存在只证明记录入口可定位，不证明产品通过、临时现场仍在或运行环境健康；没有运行产品检查，也没有修改业务或测试代码。

**本报告不会触发任何继续执行。整个原计划保持暂停，未完成项没有被标记为完成。**
