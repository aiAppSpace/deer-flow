# Vue 平替、架构与历史负担清理：全计划暂停交接（2026-10-20）

**状态：PAUSED_USER_REQUEST。** 用户要求“找到一个干净的点，做完收尾，然后写交接文档，等待后续有时间了继续开始任务”。已在当前 Vue 完整三轴键盘宏通过后停止后续调度；2026-10-20 18:13:36（Asia/Shanghai）外层记录器正常收尾。暂停期间只做证据保全、只读核对与本文，不再修产品、启动测试、构建、安装、容器或外部调用。下次必须有用户明确恢复指令。

2026-10-20 再次复核仅完善文档：逐项回读原计划、阶段收据、当前候选和恢复工具。补充历史成果对应关系、未运行分组、恢复前置与证据定位；[本次文档复核及原计划细项映射](evidence/resume-2026-10-20/handoff-document-review/README.md) 为本文配套部分。进程/端口/容器状态仍引用原暂停快照，本次没有重启、停止或重新验收任何服务。

本文是**整个计划的当前接续入口**，覆盖 W00–W13、R00–R12、C01–C13、九项架构与共同矩阵。不是仅交接最后几个缺陷。约 **80%** 仍只是整体工作量估计；代码尚未完全收尾，最终完整验收仍有大量 UNRUN，不用单套通过率换算总进度。

仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，分支 `main-wc`。本文优先于旧交接、旧 `NEXT-WINDOW.md` 中的阶段状态；事实仍以当前源与直接执行收据为准。

## 1. 范围、授权与证据入口

- 目标：Vue 与 React 的功能、操作流程、行为、UI 样式可互换，结合 backend 实际契约；Vue 架构与历史工程负担清理属于同一完整计划。不能靠忽略失败、加预算、扩大容差、重置焦点、跳过状态或绕行隐藏根因。
- 唯一排除：Vue 首页内容、docs/blog 内容站、整站无后端静态回放。**Showcase 需要完整对齐**；原生键盘/焦点、必要无障碍、弹层与视觉交互不在排除范围。
- 用户已批准 Sonner **正式依赖源码修复**；批准见 `evidence/resume-2026-10-20/notification-focus-proposal/proposal.json`。不再因之前“不能打补丁”重复询问。禁止手改 node_modules。
- 最终 `make dev-dual` 若占用 3000，用户已允许先核实 AiPPT 可按原方式恢复，再临时暂停并恢复。**本轮没有使用这项授权，也没有停止其他项目。** 恢复时重查进程与恢复方式。
- 没有 commit/push 请求；原分支、索引、WIP、`.env`/`config.yaml`/`extensions_config.json` 及其刻意跟踪策略继续保留。不另开提交分支。

主要文档：

- [原执行计划](2026-10-09-vue-period-plan.md)、[完整进度与问题索引](2026-10-10-vue-plan-progress-and-issues.md)。
- [Stage55 历史交接](2026-10-18-vue-whole-plan-paused-handoff-stage55.md)：保留原范围、原门禁预算与历史事实；其中“11 份候选未合并”等旧状态已由本轮替代。
- [本轮恢复经过与所有新增问题](evidence/resume-2026-10-20/README.md)。历史段落的“运行中”仅属于当时，不是当前授权。
- [暂停总索引](evidence/resume-2026-10-20/pause-preservation/summary.json)、[现场与证据保全](evidence/resume-2026-10-20/pause-preservation/preservation.json)。它们只证明交接与保全，不是验收通过。

下文未带 `docs/` 的证据短路径均以 `docs/reports/evidence/resume-2026-10-20/` 为基准；以 `docs/` 开头的路径相对仓库根目录。Markdown 链接按所在文档目录解析。

## 2. 当前停点与准确结果

| 项目 | 当前事实与边界 |
| --- | --- |
| 候选 | `candidate-v10/manifest.json`：96 份差异候选、5766 个公共输入（含 2 个 example 原样夹具）；全部在诊断副本，**尚未集成原工作区** |
| 定向原生 | `native-focused-v5`：98 PASS，0 FAIL/SKIP/flaky，directExit 0，源未变；10 份完整受影响规格及 20 条诊断遍历，不能代替全量 |
| 完整原生 | `native-complete-v2`：27 规格、163 个用例身份完整；**133 PASS / 6 FAIL / 1 interrupted / 23 did-not-run**，0 flaky，directExit **130**，源及路径集合未变 |
| 完整双端普通键盘宏 | 844 个 context、51,290 次焦点读取全部执行完，最终断言 FAIL；没有到达失败，具体闭环/顺序问题见第 4 节 |
| 当前干净节点 | Vue 三轴键盘宏 **422 次遍历、15,037 focusin**，dead/trapped/invisible/unreachable 均为 0，PASS；之后向重新核验身份的 Playwright CLI 发 SIGINT |
| 中断项 | React 三轴键盘宏只创建了 1 个 context，明确为用户暂停中断，既不计第 7 个产品失败，也不算通过 |
| 尚未调度 | 23 项逐项保存在 `pause-preservation/native-cases.json`；下面按规格列全，不能拼接旧记录补成绿灯 |
| 静态检查 | `candidate-v10-react-check` 完整 ESLint+tsc PASS；v9 Vue 全 lint/测试类型 PASS；`candidate-v10-vue-format` **FAIL**，仅 I18N_INVENTORY.md 表格格式待处理 |
| 完整收集 | `candidate-v10-collection`：原 18 配置 **1699 collected，其中 product 1075**，exit 0、源未变；收集不等于运行通过 |
| 通知生命周期 | v9 React 2 文件 16 PASS、Vue 1 文件 13 PASS；永久真实浏览器旧源 RED 10 PASS/6 FAIL，修复后的 16 项已纳入上面的定向与本轮完整运行 |
| 原工作区与后续门禁 | 本轮没有集成、没有原 Sonner 安装图更新、没有新 Stage56 最终源绑定；全部 R04–R12 仍需新源执行 |

完整收据仍保留 `FAIL_COMPLETE_NATIVE_DIAGNOSTIC`，不重写成 PASS 或“仅有暂停”。报告里的 `skipped=24` 是 **1 interrupted + 23 未运行**，不是 24 项主动豁免。上次 v8 完整运行 `native-complete-v1` 的 60 PASS/1 interrupted/86 未运行仍单独保留，不合并统计。

最新非通过项的完整分组如下；逐项 title、id、project、原始 attempt 状态及附件位置见 [163 项清单](evidence/resume-2026-10-20/pause-preservation/native-cases.json)。

| 状态 | 正式规格 | 数量 |
| --- | --- | ---: |
| FAIL | `keyboard-order.spec.ts` | 1 |
| FAIL（原始 attempt 为 timedOut） | `mermaid-fullscreen-owner.spec.ts` | 4 |
| FAIL | `tooltip-presentation.spec.ts` | 1 |
| 用户中断 | `triple-keyboard.spec.ts` 的 React 宏 | 1 |
| UNRUN | `triple-overlay-keyboard.spec.ts` | 2 |
| UNRUN | `triple-panel-capacity.spec.ts` | 8 |
| UNRUN | `triple-reflow.spec.ts` | 3 |
| UNRUN | `viewport-fit.spec.ts` | 2 |
| UNRUN | `workspace-control-capacity.spec.ts` | 8 |

133/6/1/23 是本轮 27 规格的结果，不是整个 product1075、18 配置1699 或总计划的结果。

## 3. 本轮已经做完的实现与审查

所有实现仅进入候选；完整清单以 `candidate-v10/manifest.json` 的逐文件 hash 为准。

- 将上次 11 份 F11–F14 后续候选与旧候选按原 hash 精确组合，随后补齐 React 知识弹窗标准 DialogTrigger 返回焦点、命令列表 DOM 生命周期、欢迎建议和归档分页的真实准备流程。
- 通知修复覆盖普通 Tab 与 Alt+T 的不同归属、离开/失焦/卸载/dismiss 生命周期；用户批准的 Sonner CJS/ESM 修复由正常 pnpm patch/patch-commit 登记，正常 frozen/offline/force 安装后的实际入口 hash 已核实。永久挂载与真实原生回归均已建立。
- 候选包括 AgentChat 的 canonical metadata、真实 stream 导出、归档/页头布局，Dialog/Sheet 实际节点与面板/编辑器容量、HTML iframe 键盘入口、单选组及负 tabindex 入口、Vue portal 焦点可见性等修复。
- Markdown 量具改为符合实际 KaTeX HTML 输出、Shiki 行文本、流式/完成态各自样式的严格对照。Nuxt cssnano 只关闭有损 calc 预计算，保留真实精度，不放宽浮点容差。
- React Docker 依赖阶段已 COPY patches；Compose patch 变化走 rebuild 并排除普通 sync；Vue CI push/PR 与 drift 审查范围包含补丁目录。`patch-drift-green` 4 项 PASS。实际容器与完整交付仍待。
- 文档已在候选中同步通知语义与依赖升级边界。候选数量从早期 61/69 变化到当前 96，是完整差异枚举，不能手工相加；过去有另存文档未列入早期候选清单的问题，现由全公共输入比较封闭。
- `candidate-v10-review/semantic-read-checkpoint.json` 只是列明 32 个输入的局部审阅；之后又读了部分源。**没有完成全部 96 文件或 R11 最终审阅**。

### 3.1 本轮之前已完成的工作不能丢失

以下均是历史阶段实证，不能替代当前 v10 或下一候选的全量验收；完整工作包的既有实现还包括第 6 节所有行，并非仅这 96 份增量。

| 历史成果 | 已确认结果与位置 | 当前边界 |
| --- | --- | --- |
| F01 草稿期限 | 按有效草稿与 owner 计时，4 文件65 PASS；`docs/reports/evidence/resume-2026-10-18/f01-deadline-green/` | 已进入原工作区，最终完整输入/提交仍须复验 |
| F02 编辑器 | 搜索、括号/Lezer、redo、Escape owner；最终完整编辑器原生14 PASS；`docs/reports/evidence/resume-2026-10-18/f02-native-editor-panel-ownership/` | 已进入原工作区，不代表全部产物/媒体完成 |
| Stage55 React 完整 | check 退出0、326 文件3001 PASS；`docs/reports/evidence/root-stage55-cross-app-checkpoints/final-react/` | 本轮新增实现之后须重新执行完整 unit/check |
| Stage55 Vue 完整 | canonical 497 文件4138 PASS，lint/format/types/OpenAPI/build/assets/consumer/audit 退出0，另有 icons；同父目录 `final-canonical/`、`final-icons/` | audit 有既有精确审查，不是零漏洞；当前 v10 format 已另有 FAIL |
| Stage55 完整双端 | 986 PASS/21 FAIL/1 未运行，directExit2；同父目录 `final-cross-app/`；仅156完整视觉对 | auth21、真实 SQL session8 未运行；不满足751对/1502 PNG，不能拼接新定向 PASS |
| 最近完整后端 | Stage54 27149 PASS/414 原有SKIP、blocking235 PASS、lint/format退出0；`docs/reports/evidence/resume-2026-10-11/backend-full-stage54/actual/` | 当前新增三份交付测试以及最终全量仍待；原有跳过不扩展为新豁免 |

### 3.2 F03–F14 与当前候选的对应关系

旧 Stage55 交接的 F11×1、F12×5、F13×1、F14×4 共11份后续文件**已纳入 v10，不可再按旧“未并入”记录重复应用**。F14 后来又被本轮完整通知生命周期修复更新；以 v10 字节和最新实证为准。

| 历史编号 | v10 当前已完成部分 | 尚未关闭 |
| --- | --- | --- |
| F03 | 合法 instant-open 的前置判定已修 | 新 React 键盘 Tooltip 为真实 closed，见第 4 节；全部可达/窄屏/视觉宏仍待 |
| F04 | 完整844遍历已跑完，冻结测量与离线还原保留 | 实际未闭环及菜单差异、物理转移计数方案均未关闭 |
| F05 | 新完整原生 `markdown-rendering.spec.ts` 8 PASS | 最终全量与视觉证据仍待 |
| F06 | Mermaid 实际 Dialog owner 与 MMD/SVG 检查已到达 | PNG 四项 FAIL |
| F07 / F08 | 引用列表与拓扑候选已在 v10；本轮 `popup-capacity-reflow.spec.ts` 12 PASS、`topology.spec.ts` 5 PASS | 这些定向范围不能替代原完整 product 与所有拓扑 |
| F09 / F10 | focus-capacity 10 PASS；Vue 三轴键盘422遍历 PASS，局部容量/重排规格通过 | React 三轴键盘中断；完整三轴浮层、面板、reflow 等23项未运行 |
| F11 / F12 / F13 | chat-header-layout 6 PASS、artifact-frame-keyboard 2 PASS、keyboard-measurement 12 PASS | F12 基础入口通过不消除本轮 iframe resize 闭环失败；仍须新源全聚合 |
| F14 | 最新 React 单位16 PASS、Vue单位13 PASS，永久 notification-lifecycle 原生16 PASS；正式 Sonner 安装实证保留 | 当前原工作区未安装新依赖；最终双端、容器与生命周期整体验收仍待 |

上述规格计数全部来自本轮 `native-complete-v2`，单位结果分别见 `candidate-v9-react-lifecycle-v2/`、`candidate-v9-vue-lifecycle/`；Vue测试类型/lint 分别见 `candidate-v9-vue-test-types/`、`candidate-v9-vue-lint/`。这些 v9 检查不冒充 v10 完整 verify。正式依赖安装见 `sonner-patched-frozen-install/`，接线负控见 `patch-drift-green/`。

`docs/reports/evidence/resume-2026-10-18/r11-stage55/pending-ci-comments.patch` 的两处 CI 注释也已进入 v10；旧架构表“尚未应用”已过时。它不是第六组待应用方案，原工作区最终仍由精确集成统一处理。

## 4. 实际失败、未应用方案及下一步

| 问题 | 已确认事实 | 恢复后处理 |
| --- | --- | --- |
| React artifact-panel-resize 正向键盘未闭环 | 60 次原预算加固定 32 次补充按键仍未闭环；潜在容量未变，末尾 iframe 已有真实 `body tabindex=0`，随后主要停在 body | 原生记录跨 frame 的 Tab/focus 事件查清根因；不能称未加载，也不能改闭环预算 |
| artifact-preview 顺序计数误报 | 同一物理 iframe 经 body 后再次被观察，旧字符串算法制造 iframe→自身边；两端 canonical 物理循环实际一致 | `candidate-v10-review/physical-transition-followup/` 三文件方案未应用；离线重放只消除此 1 处误报，真实 resize/技能差异仍失败；需正式单测与原生验证 |
| Vue 技能菜单重开 | restored-after-reload/snapshot 两状态，菜单选择后先关闭、取样前又打开；存在两个 Reka guard，前 13 次后才消失；React 无此菜单 | 重开事件根因尚未实测。疑似布局触发 pointerenter 只是待验证假设；不能延迟取样或忽略 guard 来消差 |
| Mermaid PNG 四项失败 | React 中英×桌面/手机都在 PNG 下载等待超时；MMD/SVG 下载与内容检查已经通过 | 两端真实 Image/canvas 导出路径诊断。未确认零尺寸、画布污染或其他具体原因；模拟 Image/canvas 的单测不是实际导出证明 |
| React Tooltip 键盘失败 | Branch conversation 确实经 Shift+Tab/Tab 聚焦，但 data-state 持续 closed；hover 部分已通过 | 记录 focus/blur/scroll/tooltip.open 真实时序；不先归因 Radix 或滚动，也不改 10 秒断言 |
| Composer 非默认端口 | `composer-command-focus.spec.ts` 硬编码 3115/3116，未消费工厂 E2E_APP_URL/E2E_REACT_APP_URL | `candidate-v10-review/composer-port-followup/` 两行方案未应用；先在 3370/3371/8260 且默认端口空闲时运行原两项 RED，再改源码验证 |
| Vue 格式 | 全格式检查仅 I18N_INVENTORY.md 告警 | `candidate-v10-review/inventory-format-followup/` 已用原 Prettier 生成方案，非空白字节一致；应用后全格式检查，不加 ignore |
| 收集文档 | 当前 18 配置 1699/product1075，旧文档仍写 1681/1057 | `candidate-v10-review/collection-doc-followup/` 为 `docs/plans/vue-parity-cold-start.md` 的更新方案，旧数标历史；尚未应用 |
| 依赖交付回归缺口 | Docker/Compose/CI 接线已在候选，原测试未钉 patch 的安装层顺序、rebuild/exclude、双事件路径 | `candidate-v10-review/dependency-delivery-followup/` 三份 backend/tests 方案未应用；4 条断言对原真实配置均拒绝、对 v10 均通过，ruff PASS；仅直接函数对照，正式 pytest/后端全量/实际容器仍待 |

完整键盘离线还原：`native-complete-v2/keyboard-investigation/oracle-reconstruction.json` 用实际冻结 TS 纯函数、原常量和 844 次实际观察，找出首个断言遮住的 4 个顺序差异；allBody/unreachable 为空，Vue 不同物理落点总计 4073。`native-complete-v2/keyboard-investigation/skill-snapshot-live-owners.json` 保存从真实 trace 还原的菜单/guard DOM。离线计算不是新浏览器验收。

五个 `candidate-v10-review/*-followup/` 目录共 **9 份待应用源码/测试/文档方案**，连同 diff、收据共 28 个文件，完整 hash 索引在 `pause-preservation/pending-proposal-inventory.json`。不要只做其中一个便跳到集成。

历史 P01（MCP 编辑器容量）与 P02（Vue 侧栏横滚）修复已实施，需纳入最终门禁；P03 的真实 Gateway Darwin 截图仍待新源复验，保留原 **0.02** 阈值。旧源约 0.03 的失败与旧 mock560 PASS 都不等于当前源结论。

## 5. 恢复第一步与工具前置问题

**暂停期间不执行本节。** 用户明确恢复后按以下顺序：

1. 只读核对本文、暂停总索引、Git/私有 hash、原公共输入与候选清单、临时副本、进程/端口。旧 PID/容器名只作历史定位，重新确认归属；不得直接照旧 PID 发信号。
2. 优先复用通过全部 hash 核验的当前副本 `/private/tmp/deerflow-next-final-stage56-vyv09d0q`。若目录丢失，以第 9 节持久归档逐成员核验恢复到新的独立目录，保留公共 fixtures/唯一 Nuxt 转换；正常全新依赖安装，重新建立独立公共 Git 索引与元数据。不要复制原 Git 历史/私有配置，不手改依赖绝对路径。
3. 先完成 v10 原生实际失败诊断。已准备 `run-native-current-failures.py`、`focus-native-investigation.spec.ts`、`png-native-investigation.spec.ts`，**均尚未执行**：原生产工厂、隔离端口 3370/3371/8260、22 项（composer 原两项 + 18 焦点/菜单/tooltip 事件观察 + 两端 PNG）。观察器保留 native API 的原返回/异常，不替代正式门禁。
4. **先适配诊断脚本的暂停前置：** 该 runner 目前要求上一完整运行 directExit 为 0/1，实际现在为用户暂停的 130。不能直接运行、删除 assert 或改历史收据；新建/修订诊断入口，明确接受本暂停请求、已关闭收据、源未变、163 身份保留、133/6/1/23 分类与停止状态的联合核验。只扩大“允许开始诊断”的前提，不能把 130 当通过。
5. 根据真实根因修复上述产品问题并完成有效 RED/GREEN，将 5 组待应用方案逐文件按原 hash 纳入。若新增路径，先登记 `additional-source-paths.json`；`snapshot-candidate.py` 生成新版本，不覆盖 v10。完整类型/lint/格式、必要单测与 18 配置收集、全部受影响正式原生规格后，再做完整 27 规格新运行。若新增永久规格，用当前收集同步准入和完整运行清单；27 是现有基线，不能成为遗漏新增回归的上限。
6. 已准备 `run-native-complete-v3.py`：原 27 规格和预算、全部键盘/三轴宏，使用隔离端口；明确拒绝所有 6 个 TRIPLE_*_ONLY/MUTATE 诊断变量。不得拼接本轮 133 PASS 或 v5 98 PASS 代替新整轮。
7. 完整当前源原生全绿后才允许 `integrate-candidate-v2.py` 精确回写原 WIP，原文件逐个备份，唯一移除诊断 Nuxt buildDir。**该集成工具的路径白名单目前不含 backend：** 新增的 3 份交付回归位于 backend/tests，需先以这 3 个明确路径补齐准入及干运行审计，不能笼统放开整个 backend，不能改掉保护原 WIP 的断言。
8. 随后用 `update-original-sonner-install.py <新候选版本>` 正常更新原 React frozen/offline 安装图，核实 CJS/ESM 批准 hash 与 mounted 回归。写入 package/lock/patch 不代表原 node_modules 已更新。
9. 新建并绑定 Stage56 公共源/依赖与全部 R04–R12；禁止运行旧源/未绑定工具后宣称当前通过。最后逐一关 W/R/C/九架构/矩阵及文档；仍有 FAIL/UNRUN 就不能宣布完成。

重型构建/浏览器聚合顺序运行。本轮曾并行诊断时出现 Chromium/AppKit 卡顿，但具体根因未确认；保留旧采样，不以“已修复浏览器问题”叙述，也不靠更换浏览器掩盖失败。

### 5.1 临时副本丢失或依赖需重建时

这是恢复规约，**尚未实现一键恢复工具，也未在本次文档复核执行**。

- 当前副本的 `restored-source-frozen.json` 记录最初恢复的5756源+2夹具，已经早于 v10 的5766输入；不能把它当作最新源冻结。副本若仍在，先按 `candidate-v10/manifest.json` 的全部5766项验证，不直接重跑旧准备脚本。
- 副本若丢失，把第 9 节归档逐成员核验后恢复到新的自有 `/private/tmp/deerflow-next-final-stage56-*`。归档不含元数据与依赖；已经包含唯一 Nuxt `buildDir` 变换，不重复插入。保留5764公共源+2个与公开 example 原样一致的运行夹具。
- 若源仍完整但依赖已不可用，同样使用新的自有目录与新元数据重建，保留旧目录的准备收据；不删除旧 `dependencies-ready.json` 来强行复用旧入口。
- 为新副本生成**新的**恢复元数据：`copy` 为新目录，`source` 为原仓库，`parentCopy` 为上次目录；`copyRows` 对应当前5764公共源，`fixtureRows` 对应2个公开夹具，并关联 v10 manifest/归档 hash。重建独立公共 Git 索引，索引输入与5766路径一致，无原私有配置、原 Git 历史或 remotes；集合比较仅剔除 `dependencies-ready.json`、`restored-source-frozen.json` 两个执行元数据。
- `prepare-restored-dependencies.py` 会核上述元数据，并拒绝已有 `dependencies-ready.json` 或重复证据目录。它会在自有副本中正常重装两端及 backend browser extra；必须使用新恢复身份/新的执行记录，不能把旧准备 PASS 拷过来，也不能删除旧收据来绕过检查。原 `scripts/pnpm.py`、workspace 锁定版本、Readabilipy/browser extra/匹配 Chromium 及执行入口归属检查仍保留，不手改 shim 或符号链接。
- 新副本核验与依赖准备完成后才更新 `copy-path.txt`，记录旧/新位置；生成新候选清单关联新的路径。旧 v10 清单、旧恢复及安装收据保留原样。
- Stage56 最终准备工具读取的是**原工作区**，必须等候选精确集成之后再冻结；不能把它当临时副本恢复入口，否则会漏掉尚未集成的96份候选。现有 Stage56 工具仍未绑定最终源。

### 5.2 定向门禁不可直接复用旧范围

`run-native-focused-v2.py` 当前只有既有10规格+20条诊断遍历，未包含 Mermaid PNG、Tooltip 正式规格；20条遍历也不是当前失败的 artifact-preview、artifact-panel-resize 与 skill-usage 两状态。后续需在保留旧范围的基础上明确补齐当前受影响规格/状态，再新跑完整门禁。旧 `native-focused-v5` 的98 PASS 不能证明这些失败已消除。

该定向 runner 仍使用默认3115/3116；完整 v3/当前失败诊断使用3370/3371/8260，不能未经核对直接混用。端口隔离也不等于构建目录隔离：同一副本的 React `.next`、Nuxt `.output` 仍共享，构建/浏览器聚合顺序执行；复用产物只可依既有严格源与参数签名契约，不得改变门禁。

## 6. W00–W13：整个工作包状态

| 工作包 | 已实施及阶段成果 | 最终仍缺 |
| --- | --- | --- |
| W00 基准/契约 | 三端范围、OpenAPI 消费、隔离输入/退出码与 18 配置收集 | 新候选所有拓扑、CI 与最终事实同步 |
| W01 账户/偏好/features | session owner、RBAC、locale/timezone、字段 PATCH、能力语义 | auth21、真实 SQL session8、异常/恢复/切用户 |
| W02 run/消息 | gap/durable/END、create/join/stop/dispose、human ID、附件 owner、HIL/消息动作 | 完整 protocol/real/双端，不重复 create、不污染旧 owner |
| W03 产物/预览 | bounded/Range/SHA/conflict、保存锁/资源退休，编辑器阶段原生证明 | iframe 闭环与 PNG 根因、全部媒体、P03、751 对与人工审图 |
| W04 输入/模型 | 草稿/附件/引用/知识/reasoning/语音，命令 DOM 与页头候选回归 | 端口接线、完整输入/模型/弹层、mock/真实提交 |
| W05 能力/Agent/知识 | gallery/安装/权限、Skill409、定义包/知识范围、知识 DialogTrigger | 技能菜单重开、能力/Agent/知识真实拓扑及最终双端 |
| W06 历史/来源/未读 | activity、虚拟化、真实滚动 owner、删除部分失败、归档 55 条准备 | 分页/追尾/resize/删除、归档直达、跨 owner 持久化 |
| W07 调度/channel | prompt/events/分页、queue/DST/后台 owner，通知普通 Tab/Alt+T 生命周期 | scheduled/channels/agents/settings 真实聚合与双端 |
| W08 扩展完整宿主 | assets/inline、模块图/页面/导航/动作/mentions 生命周期、fixture 阶段证明 | 全宿主权限/晚返回/卸载、Docker 真实消费 |
| W09 项目/文档/trash | 四 tabs、instructions、分页/附加/预览/转换/冲突/部分失败 | 完整项目/trash 双端与真实 Gateway 恢复 |
| W10 浏览器/Sidecar等 | WorkspacePanels resize、退出生命周期、Agent identity/ABA、设置/memory/subagent | 面板权限/请求中关闭重开、受控外部链、后续三轴宏 |
| W11 Showcase/UI | 全案例登记、Markdown 真实渲染与样式、精度修复、Vue 三轴键盘 422 PASS | Tooltip/PNG/焦点剩余问题、751/1502 全量、零接受台账、人工审图 |
| W12 架构/历史负担/CI | owner 收敛、Pinia/Splitpanes/孤立模型退役、必要守卫/负控、正式依赖修复接线 | 九架构最终运行闭合，交付回归、Linux/独立/CI/部署 |
| W13 全量验收/同步 | v10 精确候选与证据保全、全部失败分类、恢复方案 | 新候选集成、新 Stage56、全部 R04–R12、WIP 与 marker 收口 |

本表是状态摘要，不取代原计划细项。恢复时同时读取 [W00–W13 细项映射与遗漏核对](evidence/resume-2026-10-20/handoff-document-review/README.md#原计划细项映射)：其中保存 owner/权限、分页/冲突、调度/DST、扩展宿主、项目/trash、Browser/Sidecar、Showcase、负控与历史负担退役的必要条件。

## 7. R00–R12：完整剩余执行清单

| 任务 | 恢复后要求 |
| --- | --- |
| R00 | 先核现场/暂停收据/hash/分支/索引/私有输入；临时副本不足则从持久包恢复；当前用户恢复授权与旧暂停分清 |
| R01 | P01 MCP 容量根因修复已实施；保留原回归，纳入最终完整双端 |
| R02 | P02 侧栏横滚根因修复已实施；保留原回归，纳入最终完整双端 |
| R03 | 第 4/5 节全部问题处理，新候选完整 27 规格通过；精确集成与原依赖同步，然后新 Stage56 源/依赖绑定 |
| R04 | Vue 完整 `make verify`、asset/consumer/audit/OpenAPI+extension fixture/icons；React 完整 check/unit；原 18 配置收集；backend `make test` 四分片、`make test-blocking-io`、lint、ruff format-check。不得以定向替代 |
| R05 | 原 `make -j1 -C frontend-vue e2e-cross-app` 顺序 product→auth21→真实 SQL session8；751 对/1502 PNG 全部解码、尺寸核对、零差异接受台账及人工审图 |
| R06 | 完整 mock560；backend protocol/real/scheduled/channels/agents/settings/shell/browser **八拓扑共 24 项**；external 受控 3 项，保留 P03 原 0.02；实际数量若当前收集变化须核根因，不能静默缩减 |
| R07 | 原生 Linux 固定 Playwright1.59.1-noble ARM64 镜像 SHA `b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`、Node24.14.1、host IPC；8 visual/12 payload/asset，额外 8+12 捕获及 9 图人工审阅 |
| R08 | 新源 standalone 默认与 `--with-e2e` 两条 fresh inner：正常安装、完整 unit/build；后者还须完整 mock/backend。只有依赖 React 的 parity 配置 collection-only；不能据此缩掉其他功能 |
| R09 | 实际 Docker 六 phase：build-vue/build-react/probe/probe-oidc/smoke/normal-stop；Gateway/双前端 canonical build、engine COPY、双 hostname、非 root、SQL 与 SIGTERM，不复用旧镜像假验收 |
| R10 | 本地 dev-vue/dev-dual/prod-vue 原 30/300/180 秒启动预算；真实注册/me/permissions/preferences204、单 SSE/context/三 suggestions、提交/刷新持久会话、无重复提交、同 owner 正常停止与 SQL 保全 |
| R11 | 九架构、全部 WIP/新候选/CI 接线增量审阅；补丁目录后为 12 个 WATCHED 前缀，旧 11 前缀 113 文件快照不能接受。`upstream-drift --accept` 本身拒绝 dirty/untracked；未提交时不能绕过，当前也无 commit/push 授权 |
| R12 | 逐项关闭 W/R/C/九架构/矩阵及源码/文档/命令一致性。代码完成、本地集成、外部生产准备分列；真实 IdP/LLM/IM/DNS/TLS/外部 CI 未观察即不得宣称已通过 |

Stage56 准备工具仍在以下持久目录，**尚未绑定最终新源**；不可因脚本存在便视为运行过：

- `docs/reports/evidence/root-stage56-cross-app-checkpoints/`：source/dependency/browser factory、run-frozen-gate、preserve-formal-artifacts、verify-parity-png-evidence。
- `docs/reports/evidence/2026-10-18-linux-stage56/`。
- `docs/reports/evidence/resume-2026-10-18/standalone-round56/`、`backend-full-stage56/run-backend-full.py`。
- `docs/reports/evidence/container-ingress-stage56/`。
- `docs/reports/evidence/local-entry/stage56/` 及工具指向的 stage56-dev-dual/stage56-prod-vue。
- `docs/reports/evidence/resume-2026-10-18/prepare-stage56-tools.py`、`stage56-tool-preparation/execution.json`、`capture-editor-visuals-stage56.py`。

人工选样来源仍为 `docs/reports/evidence/resume-2026-10-18/visual-review-stage55/plan.json`，需绑定新源：18 组双端矩阵共 36 图、4 组成功态附件共 8 图、8 组编辑器格式/主题×两端×Source/Edit 共 32 张人工选样，另 Linux9 图。编辑器完整观察仍为 14 case×两端×Source/Edit=56 图，7 语言×2 主题；选样不能代替 751/1502 自动完整矩阵。成功态附件须实际取图、落盘、readback，不预造路径、不拿 HTML preview 代替 CodeMirror，也不以静图代证动态 owner/WS。

## 8. 九架构、共同矩阵与 C01–C13

九项最终运行收口仍 OPEN；已有消费者证据见 `docs/reports/evidence/resume-2026-10-18/r11-stage55/architecture-closure-map.md`，不能用旧审阅代替当前新候选。

| 架构项 | 最终必须核验 |
| --- | --- |
| 消息虚拟化 | MessageList→VirtualMessageList 真实 scroller、prepend/追尾/暂停/目录/活动组/调度 after-group、长会话 resize |
| 聊天编排 | AgentChat 的 thread/agent/panels/actions 与 Composer draft/submission/polish/voice 职责；取消/退休，draft URL adoption 不换 owner |
| 状态归属 | 草稿/附件、唯一 artifact draft/baseline、session/stream 生命周期；无双写镜像，core/agent-core 边界 |
| 缓存/features | Vue Query identity/去重/失效、mutation 发起身份，loaded/available/running/toolEnabled 分开消费 |
| 集成流程 | Lark 单 owner 的窗口/轮询/取消/过期/retry/用户身份，无第二套迁移流程 |
| 孤立代码/重复模型 | 退役有消费者依据，不误删 WIP、生成 types、worker URL 或仍用原生 Resizable 的 M0 路由 |
| 重复算法 | workspace-change anchor 真实接线、混合 AI/tool/最后 assistant 边界，不强并不同行为 |
| 历史叙事/门禁 | 旧固定规模/拼写守卫清理，完整收集/缺 React/失败归档/隔离/负控仍生效，远程 CI 事实单列 |
| UI适配 | 必要原生 focus/键盘/菜单/路由播报/滚动保留，本轮剩余问题与双端 UI/Linux 完整验证 |

共同矩阵不删维度：同 Gateway/seed/权限/字体/浏览器/时钟；中英×明暗×桌面/手机及真实主题限制；loading/empty/error/selected/disabled/hover/focus；低高度、200%文字、双向 resize、弹层/菜单/抽屉/表单/多面板；直达/刷新/返回/深链/404；刷新/重登/跨tab/用户/线程/Agent 切换后的真实持久化；离线/超时/鉴权/资源消失/冲突/SSE中断/部分上传/授权窗口过期及可继续操作；asset成本、长会话、本地/独立/Compose 拓扑。751/1502 与所有行为证明并行保留。

全部最终关闭条件仍 OPEN，表示证据未齐，不表示全部实现未写：

| 条件 | 关闭依据 |
| --- | --- |
| C01 | 全范围页面/入口/操作，只有三项豁免；R05–R07/R11 |
| C02 | Showcase 资源/只读动作/双端 UI，写操作另外真实验；R05–R07 |
| C03 | 全 WIP 已接线验证或有依据移除，无悬空半迁移；R00/R11 |
| C04 | P01–P03、F01–F14 与本轮所有新增失败根因/有效回归；R01–R07 |
| C05 | gap/durable/human ID/run input/附件合并，无重复 create/旧草稿假提交；R04–R06 |
| C06 | 偏好/locale/timezone、引用授权、三套 reasoning、知识恢复、Agent 定义/来源/未读；R04–R06 |
| C07 | 调度/channel、项目四 tab/trash 部分失败、扩展宿主；R04–R06 |
| C08 | 功能/流程/行为/UI 完整双端、751/1502 与人工审图，无新增豁免；R05–R07 |
| C09 | 九架构/历史负担、唯一 owner、真实消费者与必要无障碍；R01–R07/R11 |
| C10 | 当前 backend REST/SSE/JSON 消费者、持久化/取消/异常恢复；R04–R06 |
| C11 | 完整 verify/浏览器/backend/visual、CI 接线与可取失败现场；R03–R09/R11 |
| C12 | Vue 构建/无 React 独立、本地三入口、容器各自真实证据；R04/R08–R10 |
| C13 | 文档/源码/命令/实际结果/marker 一致；R11–R12 |

## 9. Git、现场与持久恢复材料

只读核验：`main-wc`，HEAD `a7804539530846baecf548af7b5d2612deb89b68`，main `5ecc1c2ac2de624af354bc515d5cb04f80df226c` 为 HEAD 祖先，无 unmerged；索引 SHA `109661be26054eff97a2c4ceee44d5bc6833a6dd6ac2a8ecb507f77bea854969`。原 5742 公共源、私有三文件、hook、原 11 前缀下 84 tracked-dirty+29 untracked 路径均保持不变。新交接文档属于明确新增材料，不回写旧冻结清单假装同一源。

原候选副本暂存路径仍为 `/private/tmp/deerflow-next-final-stage56-vyv09d0q`；依赖目录仍在，但不以临时目录永久存在为前提。持久材料位于：

`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-10-20/pause-preservation/`

- `candidate-v10-public-source.tar.gz`：**5766 个公共源/夹具**，逐成员 hash 已核验；SHA-256 `161dade282dd032b3fd4403c01a378faaec0035fa17f3a1890b6ed0211c4114c`。不包含原私有运行配置、Git 历史/索引、node_modules/venv/build cache。
- `source-preservation.json`：归档/hash/manifest/fixtures 与唯一 Nuxt 转换。候选 manifest SHA-256 `14348dc2d8177cf1400de61bc598d600b12c0bf1f11cab12c43e2f5c09a78c10`。两个运行夹具与公开 config.example.yaml/extensions_config.example.json 完全同字节。
- `native-preservation.json`、`native-artifact-inventory.json`、`native-cases.json`：本轮完整收据、逐项状态、**native-complete-v2 的1006 文件/3,089,846,319 字节**已做 hash 索引；实际 trace/PNG 在持久 `native-complete-v2/` 内。完整普通键盘 trace 含 844 contexts，Vue 三轴含 422，React 中断 trace 含 1。该索引不声称覆盖所有历史临时缓存或依赖。
- `pending-proposal-inventory.json`：五组未应用方案 28 文件精确 hash；实际文件已在持久 evidence 下，不依赖临时副本。
- `native-pause-request.json`：用户授权、当前宏结束位置、被核实 PID/出生/argv hash、SIGINT 时间。历史 PID 已退出，不能复用。
- `host-before-stop.json` / `host-after-stop.json`：本轮 18 进程变为 **0**，3115/3116/8021 等验收端口已释放；3000 的其他项目 listener 前后相同。`docker-after-stop.json`：本计划 11 个历史容器均停止，本轮没有容器操作。
- `original-readonly-before-handoff.json` / `original-readonly-after-handoff.json`、`handoff-audit.json`：文档前后现场保护与范围/链接/恢复材料核验。没有活动子代理或 goal，也没有本轮留待后台继续执行的任务。

上述停止及旧审计是原暂停时快照，不代表本次重新探测；旧 `handoff-audit.json` 对应修订前文档 hash，保持不改。最新文档审计由 `summary.json → documentAudit` 指向 `../handoff-document-review/review.json`，其范围只限文档、已存证据与源保护。

本次还将原临时缓存中的永久通知 RED-v4 **6份既有 error-context.md 与1份 .last-run.json** 原样保存在 `../handoff-document-review/red-v4-recorded-contexts/`，逐文件来源/hash 见 `red-v4-context-preservation.json`（位于同一复核目录）。原 RED 执行收据及日志仍在 `notification-lifecycle-permanent-red-v4/`。这是既有文档保全，没有重跑测试、创建新产品证据或修改失败结果。

**下一窗口可直接给出的恢复指令：**

> 读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-20-vue-whole-plan-paused-handoff.md`，恢复整个 Vue/React/backend 对齐、架构与历史负担清理计划，不能缩水。先核现场与暂停证据，从第 4/5 节继续：处理 v10 的实际失败和五组未应用方案，注意诊断 runner 的用户中断前置与集成工具新增 backend/tests 准入；完整新候选通过后精确集成并正常同步依赖，再完成全部 R04–R12、W/C/九架构/共同矩阵。不要拼接旧 PASS，不改阈值/预算，不跳过任何未运行项。
