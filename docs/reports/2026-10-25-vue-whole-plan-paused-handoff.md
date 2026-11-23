# Vue / React / backend 全计划暂停交接（2026-10-25）

**交接范围：整个计划，W00–W13、R00–R12、C01–C13、九项架构及共同矩阵。** 用户要求“找一个干净的点，做完，就先放着，然后写一个详细的交接文档，后续有空再继续执行任务”。本次收尾点是已批准的 Nextra 上游修复及其 React 回归；不启动下一轮大验收。

**状态：PAUSED_USER_REQUEST；整个计划已暂停。** 最终收尾结果和进程清场记录见下文第 3、10 节；未关闭事项绝不视为通过。整体工作量仍约 **85%–90%**，只是估算，不是通过率；仍有实际失败及大量最终运行验收，不能说“代码全部写完、只剩走流程”。

仓库绝对路径：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。本文是新的主交接入口；[10 月 24 日交接](2026-10-24-vue-whole-plan-paused-handoff.md)保留历史事实，不能继续照其中“253 未集成”“22 目标未应用”等旧状态执行。

**2026-10-26 再次复核：仅完善交接、索引和文档核验记录，整个计划继续暂停。** 已回读原计划、W 细项、旧交接、实际回执和恢复工具的入口；本次未运行产品测试/构建/安装/服务，也未重新探测端口、进程或容器。查漏结果、准确套件计数及工具清单见[全计划文档复核](evidence/resume-2026-10-25/handoff-document-review-2026-10-26/README.md)。10 月 25 日的冻结、回执和归档保持原样，本次文档变化另记，不冒充新产品验收。

## 1. 范围与授权，恢复时全部保留

- `frontend` 是上游 React 参照；`frontend-vue` 应在功能、流程、行为、UI 样式上可平替；结合当前 backend 实现核对，以代码和实际运行结果为准。
- 仅排除 Vue 首页**内容**、docs/blog 内容站、整站无后端静态回放模式。Showcase 已明确要求对齐；基础及完整键盘/焦点/三轴矩阵仍在本期，用户再次选择“仍按原计划完整验收”。
- Vue 架构不合理和历史负担应从根因重构/清理。不得通过跳过测试、隐式豁免、吞错、强制等待或改掉真实业务语义掩盖失败。
- 用户最新允许“少量超预算”，并要求不要为了预算使代码难以维护。该授权只允许有实测依据的合理体积预算调整；**不缩减功能/UI/行为/键盘验收**。保留默认构建优化的预算决定已经落地，详见第 2 节。
- 正式 pnpm 依赖源码修复已获批五项：Sonner、Radix Tooltip、Radix DismissableLayer、Happy DOM，以及本轮 Nextra Theme Docs。Nextra 批准原文：“允许，按上游方案修复并完整回归”。不建私有 npm 仓库、不手改 node_modules；其他新依赖例外不得自动推定已获批。
- 最终 `make dev-dual` 如需 3000，允许先确认 AiPPT 原启动方式可恢复，再临时暂停，验收后恢复。本轮**没有使用**此许可、没有停止/重启 AiPPT。恢复时重新核实实时归属，不使用旧 PID。
- 不自行 commit/push；原分支、索引、hooks、私有跟踪配置和用户其他 WIP 必须保留。Host pnpm 入口统一通过 `scripts/pnpm.py`。
- 当前暂停后不得继续运行项目任务、修复新问题或启动服务；等待用户明确恢复。交接文档修订和必要现场保全不等于恢复执行。

## 2. 本次恢复以来已完成的工作

### 2.1 候选集成与历史清理已经落地

- 原 v75 完整 34 规格、216 项在 `resume-2026-10-24/native-complete-v5/` 通过，0 FAIL/SKIP/flaky，输入不变。它是集成前诊断，不替代当前最终验收。
- 253 份候选已精确集成到原 `main-wc` 工作区，见[集成回执](evidence/resume-2026-10-24/original-integration-candidate-v75/execution.json)；原依赖正常安装及批准入口核验见[安装回执](evidence/resume-2026-10-24/original-dependency-update-candidate-v75/execution.json)、[入口核验](evidence/resume-2026-10-24/original-dependency-update-candidate-v75/patched-entries.json)。**不再重复集成 v75。**
- 22 个退休目标已执行：14 删除、8 替换；两项无消费者依赖已正常移除并审查 lock。详见[22 目标应用回执](evidence/resume-2026-10-24/r11-retirement-followup/application/execution.json)、[依赖清理记录](evidence/resume-2026-10-25/dependency-retirement-application/execution.json)和[lock 审查](evidence/resume-2026-10-25/dependency-retirement-application/lock-review.json)。移除的是 Vue 的 `best-effort-json-parser`、`uuid` 两项直接声明；`uuid` 仍有传递消费者，不能误删整个传递依赖。不要再按旧交接“未执行”重删。
- 20 份有效提案共 75 个目标（73 个互不重叠目标 + 2 个浏览器文件，新增 4 个浏览器用例）已应用；[应用回执](evidence/resume-2026-10-25/reviewed-proposals-application/execution.json)。归档/线程旧独立提案已由 thread-cache-ownership 替代；HTML SSR 提案已证伪，不可应用。
- React 已正式声明 citation parser 的 remark-parse / unified 依赖。后续源码修复、测试 teardown、通知/置顶选择器及调度错误覆盖已落地，记录在 [最终源码后续修复](evidence/resume-2026-10-25/r11-final-source-followups/README.md)。
- 82 份历史 AGENTS 快照已逐字归档，并以 `.snapshot` 形式保留；39 份现行指引 0 错误，13 项守卫通过。旧脚本路径需要按[快照恢复说明](evidence/resume-2026-10-25/guidance-snapshot-storage/README.md)恢复/映射，不能改写旧清单冒充原路径仍在。

### 2.2 根因修复和审查覆盖

20 项有效提案包括：认证刷新 HTTP、Settings SSR、sidebar attrs、chain 默认展开、toggle pressed owner、消息 bridge seq、thread cache ownership、模型 mutation owner、模型收藏生命周期、browser input 生命周期、voice session owner、Agent import 生命周期、extension surface 生命周期、citation/code 边界、code highlight 生命周期、editor 初始化生命周期、channel dialog 生命周期，以及 feature reset、旧注释/退出分支、schedule timezone 清理。

具体提案及定向负例/正例仍在 [本轮证据索引](evidence/resume-2026-10-25/README.md)。这些是已应用修复，不代表每个领域的最终运行已关闭。

R11 原 324 份测试审查清单已完成列明范围的审阅：201 份完整文件、99 份完整差异及调用者、24 份 React 对照（其中 12 份逐字相同），无重叠、原清单剩余 0。10 月 25 日暂停时，Nextra 后的 1,416 份现存公开 WIP 加上本交接，共 1,417 份均绑定该时点字节与有界审查，见 [暂停时映射](evidence/resume-2026-10-25/r11-source-review/whole-wip-final-source-map.json)。不能把这说成 1,417 份均逐行通读或 R11 全部关闭；删除项另有退休记录。本次文档修订只更新本交接的内容身份，原映射不重写；最新文档哈希及仅文档变化由[本次复核记录](evidence/resume-2026-10-25/handoff-document-review-2026-10-26/review.json)补充，不能把旧交接哈希当成最新文件哈希。

CI 两事件的 12 个 watched 前缀已核。实际 dirty/untracked 负控拒绝 `upstream-drift --accept`，退出 2、marker 未变，见 [负控回执](evidence/resume-2026-10-25/r11-source-review/current-drift-negative/execution.json)。**不能为更新 marker 绕过脏工作区或擅自提交。**

### 2.3 安全依赖与预算取舍

Happy DOM 21.0.4 的动画 Promise / CSS 类型修复正式锁定到两端；React 精确约束 `@rstest/core@0.10.6>happy-dom`。正式全量回归及 Chromium 对照见 [完整回归](evidence/resume-2026-10-25/dependency-audit/happy-dom-full-regression-v2.json)。10 月 25 日保存的审计结果中，React 为零公告，Vue 为 1 条精确已审查记录，不能称“全仓无漏洞”，恢复时仍以当前审计为准。

预算诊断比较了默认构建与关闭 chunk optimization 的真实 12 路由测量。默认方案总 JS 更小、首页/工作区请求更少；因此保留默认优化和业务结构，只调整有实测根据的 Markdown、CodeMirror、登录/工作区数值上限。除列明数值调整外的其余上限、首屏预取 0、按需加载及所有结构断言保持。原失败保留，修改后 12 路由 + 28 守卫通过，S4 完整 canonical 再通过。详见[预算决定与完整数值](evidence/resume-2026-10-25/r11-asset-budget/README.md)。不要恢复已被用户最新指示取代的“一律不准调整任何体积预算”旧规则，也不要扩大为随意放宽性能门禁。

### 2.4 早期缺陷及原生验收的去向（不能丢掉旧范围）

10 月 24 日交接第 3 节列明的修复，现已随 253 份候选进入原工作区：通知普通 Tab/Alt+T 与 blur/unmount 生命周期；Tooltip 自身关闭、退出层残留及稳定 ref；iframe 原生前进环境；Mermaid 真 SVG/PNG 导出和晚返回；导出/Markdown/code 边界；真实 active-run assistant ID；产物 SHA/BOM/修订、tool_artifacts registry；Showcase snapshot/52 资源；API/owner/Sidecar session；Lark refetch/复制晚返回；技能详情重开；调度复制失败；Docker/Compose/CI 接线。具体根因、实现文件和原 RED/GREEN 链接继续在[旧交接第 3 节](2026-10-24-vue-whole-plan-paused-handoff.md#3-本轮已完成的修复与旧问题去向)，其中“尚未集成”状态已被本文覆盖。

F01 草稿期限、F02 编辑器搜索/括号/redo/Escape 已保留；P01 MCP 容量、P02 横滚纳入最终门禁。P03 的 Darwin 视觉阈值仍是 **0.02**，历史约 0.03 的失败不予默认接受。F03–F14 的完整最终关闭仍属于 R05–R07，不能只用局部诊断关闭。

10 月 25 日 `native-complete-v5` 已从头完整跑完 **34 规格 / 216 项，0 FAIL/SKIP/flaky**，包括 v4 被暂停的 23 项、原 844 普通遍历及完整三轴宏。逐项身份和结果已核对并另存[216 项索引](evidence/resume-2026-10-25/pause-preservation/native-v5-case-summary.json)。这覆盖 Tooltip、18 editor、Mermaid、16 notification、普通键盘、popup/capacity、iframe、所有三轴/viewport/workspace 规格；不是当前 1114 product 或整个计划的替代。不要再执行旧交接“先重跑 v5 才可集成”的步骤。

旧 Stage43 临时失败原件缺失的限制仍保留，见[旧复核记录](evidence/resume-2026-10-24/handoff-document-review/README.md)；新增保全只覆盖清单列明材料，不能反推所有历史附件齐全。原 v4 的 193 PASS / 1 interrupted / 22 UNRUN 及 v73/v10 失败均保持原记录，未改写为 v5 的结果。

## 3. 收尾的 Nextra 修复与 S5 / S6 检查点

S4 完整双端入口在 React 文档预渲染阶段失败，尚未运行 product/auth/session。根因是 `nextra-theme-docs@4.6.1` 移除 children 后再用要求它存在的 schema 校验。上游 [PR #4990](https://github.com/shuding/nextra/pull/4990/files) 已合并，但 10 月 25 日实查 npm latest 仍为 4.6.1。用户批准回移该修复。

正式变更只有五个公开文件：

- `frontend/patches/nextra-theme-docs@4.6.1.patch`：校验完整 props，并从 theme config 分离 children；两处修改，保留严格 schema 和 memo 逻辑。
- `frontend/package.json`、`frontend/pnpm-lock.yaml`：pnpm 正式 patch 锁定，无其他版本漂移。
- `frontend/tests/e2e/docs-layout.spec.ts`：4 项真实生产页面回归，中英首屏 SSR、客户端跳转、刷新、嵌套 MDX。
- `frontend/AGENTS.md`：修复维护/退休条件。

提案、批准、12 项有界依赖契约验证、安装日志与前后文件均在 [Nextra 修复目录](evidence/resume-2026-10-25/nextra-layout-proposal/README.md)。最初 patch-commit 没更新 lock，frozen 安装正确拒绝；随后正常离线刷新 lock，再 frozen 安装成功，未手改依赖文件。该首次拒绝日志保留。

**收尾结果已落盘：** S5 React 完整 check + **340 文件 / 3,157 单测 PASS**，源码/依赖/运行入口边界通过，[直接回执](evidence/root-stage56-attempt5-nextra-checkpoint/final-react/execution.json)。S5 首次文档生产构建已成功，但浏览器 **2 PASS / 2 FAIL**：测试使用的 Introduction/简介 链接在文章中重名。实际页面检查确认目标 Why DeerFlow/为什么选择 DeerFlow 唯一，修正测试定位并保留原 URL、heading、SSR、刷新和 pageerror 断言。原失败及附件保留在 [S5 原回执](evidence/root-stage56-attempt5-nextra-checkpoint/docs-regression/execution.json)。

S6 使用最新测试重新冻结并正常安装，原完整 Next 生产构建及 **4 项文档浏览器回归全部 PASS，0 FAIL/SKIP/flaky**，直接退出 0，源码与实际 Nextra 安装入口前后不变，[S6 直接回执](evidence/root-stage56-attempt6-nextra-checkpoint/docs-regression/execution.json)。没有重复跑未变化的产品单测；S5 单测与 S6 浏览器各自保留身份，不称全仓同源最终 PASS。S6 第一次沙箱离线安装缺少可用 tarball，原命令在宿主缓存环境正常安装通过；两次记录均保留，没有改 lock 或关闭 frozen。

S6 目录：`docs/reports/evidence/root-stage56-attempt6-nextra-checkpoint/`；源码副本：`/private/tmp/deerflow-next-final-stage56-73afrqvl`。5,809 公共文件 + 2 个明确声明的公共示例 fixture，正常安装两端依赖和 backend browser extra，实际 shim/运行入口归属通过。较 S5 唯一源差异是上面的测试定位和新增交接草稿；产品及依赖字节相同。S5 副本 `/private/tmp/deerflow-next-final-stage56-45woi9tl` 及其源码归档继续保留。

| S6 身份 | SHA-256 |
| --- | --- |
| original public source | `c48589c90d675cd8bde9d5cbe94fd5ee609372b68b852ac80df1d5820d6eb33b` |
| copy（唯一 Nuxt buildDir 变换） | `86a3ba4da6ea2cfff5f8fcaab68bb809d4b7a7263d08f646ad3f53b6a6c64a23` |
| manifest | `f0a7f58274537780bad8023d85c63a9d6fceb9178ff793039ca16eaf8ec25604` |
| 公共源码持久包 | `91c214b68ed387349c45c3ced7c38d336fe7dbb8d9018ae41b4a5ac876537a1b` |

S6 是暂停收尾检查点，**不是所有 R04–R12 已重新绑定/完成的最终候选**。S4、backend、Linux、standalone/container/local 的旧绑定不可改成 S6 后复用原 PASS；恢复修复剩余问题后，统一新冻结并使用新执行目录。S6 内含本交接的早期草稿；原工作区的最终交接和 evidence 状态文件是明确记录的冻结后文档变化，恢复时优先读本文最终版。

## 4. 实际验收结果，严格区分版本与范围

| 运行 | 实际结果 | 当前边界 |
| --- | --- | --- |
| S4 canonical | PASS：Vue 523 文件 / 4,700 单测；OpenAPI、格式、类型、生产构建、asset、consumer、audit、extension fixture 全部退出 0 | [回执](evidence/root-stage56-attempt4-cross-app-checkpoints/final-canonical/execution.json)，S4 输入前后不变 |
| S4 React | check + 3,157 单测 PASS | Nextra 后由 S5 React 收尾结果另计 |
| S4 collection | 18 配置 / 1,743 用例收集 PASS | 仅收集；main517、product1114、auth21、SQLsession8；相较 1,738 新增 5 项 scheduler 错误用例 |
| S4 icons | PASS，1 条扫描线索已源码核对 | Vue async loading component 含相同 status/文案/样式，扫描器无法从模板直接找到；非豁免，运行仍需正常覆盖 |
| S4 backend 独立同源副本 | 四分片 **27,177 PASS / 414 原策略 SKIP**；blocking 235 PASS；lint/format 0；全输入边界 PASS | [回执](evidence/resume-2026-10-25/backend-full-attempt4/actual/execution.json)，别误写成较早诊断 27,176 |
| S4 Linux R07 | 正式 visual8、payload12、asset PASS；额外观察 visual8、payload12 PASS；9 图逐张人工复核 PASS | [总结](evidence/2026-10-25-linux-stage56-attempt4/acceptance-summary.json)，源码/依赖/执行身份无漂移；仅闭环这份 S4 的 R07 |
| S4 cross-app | **FAIL**，原入口退出 2；React build 的 Nextra children 校验失败 | 产品 1114、auth21、SQLsession8 均未执行；失败留在 [原回执](evidence/root-stage56-attempt4-cross-app-checkpoints/final-cross-app/execution.json) |
| S4 mock | **FAIL**：主套件 517 = 510 PASS + 7 FAIL；后续 **48 UNRUN** | auth25 + infra15 + proxy2 + stream6 尚未开始；[原回执](evidence/root-stage56-attempt4-cross-app-checkpoints/final-mock/execution.json) |
| S4 backend 浏览器 8 拓扑 / external3 | UNRUN | 不混入前述 Python backend PASS |
| Standalone / Docker / 本地三入口 | 正式运行 UNRUN | 只完成部分前置，见第 8 节 |

聚合数量要分别计算：mock = main517 + auth25 + infra15 + proxy2 + stream6 = **565**；backend 浏览器 = protocol2 + real6 + scheduled3 + channels3 + agents3 + settings5 + shell1 + browser1 = **24**；external = **3**。这些与 product1114、parity-auth21、SQLsession8、visual8 合计为 18 配置 **1743**，来自 [S4 收集日志](evidence/root-stage56-attempt4-cross-app-checkpoints/final-collection/gate.log)。收集不是执行；S6 新增 React 文档 4 项属于 React 自己的套件，不计入 Vue 的 1743，Linux额外payload12也不是新增12个独立全计划配置。

Linux 固定镜像为 `sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`，Playwright 1.59.1、noble ARM64、host IPC；因当前 Nuxt engine 要求，使用官方校验的 Node **24.15.0**（替代旧准备的 24.14.1）。两处观察工具的路径/协调元数据分类修正原失败也保留，见 `native-provenance-repair.json`；没有修改产品或放宽断言。原始跨平台目录比较显示 pnpm cache/两份协调元数据差异，真实 build/gate 输入及已安装 Linux 依赖零变化，不能声称不同平台原始物理树完全相同。

S3 预算失败、S1 audit 失败、早期中断和诊断结果均保留。没有把不同源码的局部 PASS 拼为整计划 PASS。

## 5. 本轮新发现，恢复后的首批修复

| 问题 | 当前直接观察 | 下次切入点 |
| --- | --- | --- |
| Nextra 构建阻塞 | 修复已正式安装；S5 check/单测、S6 生产构建/4项文档回归通过 | 定向修复已闭环；仍须新冻结后完整 cross-app，不重写 S4 失败 |
| 侧栏宽度，5 项失败 | inner 展开 255px，测试预期 256；收起 47px，预期 48 | `artifacts-a11y-shape.spec.ts:188,218`；`sidebar-ime-a11y.spec.ts:41,81,185`。结合 React/Vue 外层/内层边框与宽度 owner 判断；根因未确认，不能直接把断言改小 1px |
| 提及对象中间编辑，1 项失败 | 光标移动后 research option 不出现，click 超时 | `mentions.spec.ts:116`，查实际 selection/menu 生命周期及 trace；不得补随意 sleep |
| 流式 reasoning，1 项失败 | 等待 Thinking 节点时找不到，未完成 reasoning 在 answer 上方断言 | `streaming-reasoning-order.spec.ts:126`，查 SSE、chain 默认展开/状态、当前语义和测试假设；根因未确认 |

[结构化问题清单](evidence/resume-2026-10-25/pause-preservation/open-runtime-issues.json)记录精确边界。mock 原始截图、视频、trace、error-context 和状态记录共 50 文件 / 17,653,971 字节已逐字持久保存到 `docs/reports/evidence/root-stage56-attempt4-cross-app-checkpoints/final-mock-artifacts/`，有完整哈希清单。完整运行日志及 510/7 汇总在 `final-mock/gate.log`，没有额外声称生成了 JSON reporter。不是只保存错误摘要。cross-app 失败也有独立 `final-cross-app-artifacts/`。

## 6. W00–W13 完整工作包状态

| 工作包 | 已实现/审查范围 | 最终仍需完成 |
| --- | --- | --- |
| W00 基准/契约 | 三端 OpenAPI/JSON 消费者、冻结、18 配置、退出码 | 全拓扑同源验收和文档/CI/契约事实一致 |
| W01 账户/偏好/features | session owner、RBAC、locale/timezone、PATCH/204、能力分离，刷新 HTTP 修复 | auth21、SQLsession8、503/403/409、跨 tab/账号恢复 |
| W02 run/消息 | gap/durable/END、create/join/stop/dispose、human ID、附件 owner、seq bridge/cache | 全协议与真实 run、无重复 create/旧 owner 污染；新增 reasoning 失败处理 |
| W03 产物/预览 | Range/SHA/完整字节/保存锁、编辑器、iframe、Mermaid 导出/资源释放 | 全媒体/异常/P03、完整视觉及手工审图、侧栏失败 |
| W04 输入/模型 | 草稿、引用/知识、reasoning、语音/润色/上传、命令菜单及 owner | 全输入/模型/弹层、真实提交、授权/IME/取消/持久化；mentions 新失败 |
| W05 能力/Agent/知识 | catalog/RBAC、Skill409、Agent 包/display_name、知识/技能菜单与 import 生命周期 | 全拓扑安装/OAuth/知识范围/冲突/权限 |
| W06 历史/来源/未读 | activity、虚拟化 scroller、删除部分失败、归档分页、source/registry/cache | 分页/prepend/追尾/resize/跨 owner/恢复及事件位置 |
| W07 调度/channel | events/history分页、queue/DST/秒精度、通知复制、channel owner、错误覆盖 | scheduled/channels 聚合、冲突/取消/深链/切任务 |
| W08 扩展宿主 | inline/assets 模块图、页面/导航/动作/mentions、abort/dispose | 权限/晚返回/卸载、真实 Docker 消费 |
| W09 项目/文档/trash | 四 tab、instructions、上传/附加/预览/转换/恢复/部分失败 | 完整双端与真实 Gateway 权限/冲突/分页 |
| W10 Browser/Sidecar/设置 | binary/legacy帧、WS owner、resize、Sidecar session、memory/subagents | 八后端拓扑/external、关闭重开/重连/资源释放/权限 |
| W11 Showcase/UI | 公开 snapshot/52 资源、Markdown/代码/图表、键盘/弹层；S4 Linux 完整通过 | 751 对 / 1502 PNG、人工矩阵及完整双端主题/语言/尺寸 |
| W12 架构/历史负担/CI | 22 目标/两依赖退休、owner收敛、5 项正式依赖修复、源码审查 | 九架构运行闭环、最新差异/CI/独立交付复核 |
| W13 全量验收/同步 | v75 已集成，S4 部分完整门禁，S5/S6 收尾检查点、持久保全 | 剩余失败修复、新冻结 R04–R12、C01–C13/文档/marker |

原详细范围继续以 [本期原计划](2026-10-09-vue-period-plan.md)、[全进度问题索引](2026-10-10-vue-plan-progress-and-issues.md)、[W 细项映射](evidence/resume-2026-10-20/handoff-document-review/README.md#原计划细项映射)为检查目录；旧日期的完成状态由本文及实际回执更新，不删细项。

## 7. R00–R12、九架构与关闭条件

| 门禁 | 当前状态 / 恢复后要求 |
| --- | --- |
| R00 | 新恢复时重核分支/index/private/hooks、源码/归档/服务归属；不沿用旧 PID |
| R01/R02 | P01 MCP 容量、P02 侧栏横滚修复已保留，仍纳入最终 UI 验收 |
| R03 | v75完整原生诊断、253集成、22目标/两依赖清理已经完成；新发现修复后建立新的统一最终冻结 |
| R04 | S4完整各项已通过、S5 React 单列；最新最终源仍须按原完整入口形成一致证据，不称全部关闭 |
| R05 | 重新完整 `make -j1 -C frontend-vue e2e-cross-app`：1114 product →21 auth →8真实SQLsession；保留全部键盘/三轴；751对/1502PNG全解码/尺寸/零接受台账+人工审图 |
| R06 | 修复7项失败，再完整mock565；protocol/real/scheduled/channels/agents/settings/shell/browser八拓扑24；external3；Darwin P03阈值0.02不变 |
| R07 | S4完整通过且9图已人工看；最终源变动后按实际输入重新绑定/执行所需整套，不能把S4改名为新源结果 |
| R08 | standalone default、with-e2e 两个 fresh 拓扑；正常install/fullunit/build，with-e2e完整mock/backend；仅缺React的parity允许collection-only |
| R09 | 先完成仍 UNRUN 的 `engine-context` 真实 BuildKit COPY，再做 build-vue/build-react/probe/probe-oidc/smoke/normal-stop 六个正式phase；canonical Gateway build、双host/nonroot/SQL SIGTERM 均需实际证据 |
| R10 | 标准dev-vue/dev-dual/prod-vue，原30/300/180秒；注册/me/permissions/preferences204、单SSE/context/三建议、提交刷新持久化、同owner正常stop/SQL；AiPPT有条件临停恢复 |
| R11 | 当前有界源码审查不等于完成；九架构、全WIP最新差异、CI12前缀、dirty/untracked拒绝与可取失败材料继续核 |
| R12 | W/R/C/九架构/共同矩阵逐项闭环；文档/源码/命令/revision一致；代码、本地集成、外部生产准备分列 |

九架构完整保留：①消息虚拟化真实scroller；②聊天编排/草稿提交/adoption；③唯一状态owner；④query identity/features/mutation发起身份；⑤Lark单流程owner；⑥孤立代码及真实消费者；⑦重复算法的真实行为差异；⑧历史叙事/门禁/负控/失败归档；⑨必要UI适配、原生焦点与键盘。实现/有界审阅已有记录，**九项最终运行闭环仍待完成**。

共同矩阵：同Gateway/seed/权限/字体/浏览器/时钟；中英×明暗×桌面/手机及真实主题限制；loading/empty/error/selected/disabled/hover/focus；低高度、200%文字、双向resize、弹层/表单/多面板；直达/刷新/返回/深链/404；跨tab/用户/线程/Agent与持久化；离线/超时/鉴权/资源消失/冲突/SSE中断/部分上传/授权过期后的继续操作；资产成本、长会话、本地/独立/Compose拓扑。

双端主 diff 检查语义、几何和选定 computed styles，**不是 React↔Vue 整图逐像素自动比较**；`diff.spec.ts` 的截图保存失败可能被捕获而不令主 diff 失败。因此，751 对 / 1502 PNG 的完整 key、实际文件、解码/尺寸、缺失/额外图必须另验，零接受台账也不能代替这些检查及人工样式审阅。不能用 Vue 自身平台基线通过宣称两端 UI 可平替。

人工选样仍用 `evidence/resume-2026-10-18/visual-review-stage55/plan.json` 的范围，重新绑定最终源：18双端矩阵36图、4成功附件8图、8编辑器格式/主题×两端×Source/Edit为32选样；编辑器完整14case×两端×两模式56图；Linux9图。成功态附件必须实际落盘/readback；选样不替代751完整对，静图不替代动态owner/WS。

| C 关闭条件（均未整项关闭） | 尚需最终证据 |
| --- | --- |
| C01 | 全范围入口/动作，只有三项排除，R05–R07/R11 |
| C02 | Showcase全公开案例/资源/只读/UI；写操作另用真实验收 |
| C03 | 全WIP接线或有依据移除，无半迁移 |
| C04 | P01–P03、F01–F14及本轮新失败根因和永久回归 |
| C05 | gap/durable/human ID/run input/附件，无重复create或旧草稿假提交 |
| C06 | 偏好/locale/timezone、引用授权、三套reasoning、知识、Agent/来源/未读 |
| C07 | 调度/channel、项目四tab/trash部分失败、扩展完整宿主 |
| C08 | 功能/流程/行为/UI双端、751/1502、人工审图，无新增豁免 |
| C09 | 九架构/历史负担、唯一owner、真实消费者和必要无障碍 |
| C10 | 当前backend REST/SSE/JSON、持久化/取消/异常恢复 |
| C11 | 完整verify/浏览器/backend/visual、CI接线和失败现场可取 |
| C12 | Vue构建、无React独立、本地三入口与容器分别实证 |
| C13 | 文档/源码/命令/结果/marker一致，保持dirty接受拒绝，不擅自提交 |

真实外部 IdP、LLM、IM、DNS/TLS、外部代理及远程 CI 未观测时继续标 **UNOBSERVED**。本地受控 Gateway/IdP/replay 通过不能升级为这些生产环境通过。audit 的精确影响路径、过期审查、收集失败/缺React/视觉变异等负控仍需保留。

## 8. 已准备入口、旧绑定与恢复顺序

| 入口 | 保留位置 / 当前状态 |
| --- | --- |
| S4原完整入口/浏览器副本 | `evidence/root-stage56-attempt4-cross-app-checkpoints/`；副本 `/private/tmp/deerflow-next-final-stage56-cq4r1ubg`，browser副本 `/private/tmp/deerflow-vue-browser-stage56-st1lkmk6`；PASS与FAIL各自保存 |
| S5/S6收尾 | `evidence/root-stage56-attempt5-nextra-checkpoint/` 和 `evidence/root-stage56-attempt6-nextra-checkpoint/`；S5 check/单测通过，S6生产构建/文档4项通过；其他完整门禁未绑定到S6 |
| backend完整S4 | `evidence/root-stage56-attempt4-backend-checkpoints/`、`evidence/resume-2026-10-25/backend-full-attempt4/`；副本 `/private/tmp/deerflow-next-final-stage56-q_8wsxgt` |
| Linux S4 | `evidence/2026-10-25-linux-stage56-attempt4/`；容器 `deerflow-vue-linux-stage56-attempt4`已停止保留；副本 `/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-linux-stage56-pDYkQL` |
| standalone S4前置 | `evidence/resume-2026-10-25/standalone-attempt4/`；outer `/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-xBC8O5`；无React/无已装依赖；3个observer负控通过；两正式模式未执行 |
| Docker S4前置 | `evidence/container-ingress-stage56/`；context、backend源码清单和只读引擎/镜像/2426/2486检查通过；未build/start，runtime未创建，窗口仍false |
| local S4前置 | `evidence/local-entry/stage56/` 已准备副本 `/private/tmp/deerflow-local-entry-stage56-cq9k7lrt` 和公共fixture；未安装/启动；dev-dual/prod-vue两个binding已创建，尚无source副本/运行 |

这些前置是 **S4** 身份，不是 S6。Docker 目前仅有 context/源码准备及只读预检：`engine-context`、镜像构建和所有运行 phase 均未执行；没有真实 BuildKit COPY 的本轮 PASS。恢复后若修复导致新冻结，保留旧目录，以新一轮命名建立所有真实consumer绑定；尤其 container binder不会自动创建两个特定local模式binding，三份都要核实。不得修改旧PASS所绑定manifest字节。Linux必须使用已核验的v2 provenance/input/identity工具；旧v1首次失败保留，不再当准入入口。

恢复用工具的准确文件、参数形式和前置约束见[恢复工具定位表](evidence/resume-2026-10-25/handoff-document-review-2026-10-26/README.md#恢复工具定位)。这些是保留的参考实现，**本次没有执行或重绑**。S6 只含收尾工具，不是完整 Stage56 调度器；新的全量轮次需要以 S4 完整工具为参照建立新目录。尤其编辑器额外取图器仍指向早期 `root-stage56-cross-app-checkpoints`，必须在恢复后核对实际新轮次，不能直接运行旧路径。

恢复依赖及环境前置继续保留：宿主两端 pnpm 走 `scripts/pnpm.py` 正常 frozen 安装、Vue strict peers；backend browser extra/匹配 Chromium、Readabilipy 正常预热、独立公共 Git 夹具及 readiness；受控 SQL/seed/runtime home、核心 OpenAPI 的 `plugins: []` 和显式 webhook，扩展 fixture 另验。所有配置/夹具写在独立副本，不能用真实私有插件、用户数据或原跟踪配置凑验收；需核实际 shim/依赖/运行入口归属。单副本的 `.next/.output` 仍须顺序使用，不同端口不代表构建隔离。

恢复顺序：

1. 读本文、当前状态、S5/S6收尾直接回执和7失败清单。重新核现场及归档；确认现在仍是暂停后的当前源码，没有其他窗口的新改动。
2. 从已持久保存的 mock trace/截图入手，逐项确认侧栏5、mentions1、reasoning1的根因，最小正式修复和有意义回归；不要按未经证实的猜测改断言。Nextra 收尾已通过，不重复申请批准或重新实施补丁。
3. 核对所有已集成实现、五项依赖修复、预算政策及最新WIP。不要重新集成v75或重做22目标清理。源码变动完成后新冻结，正常安装并核实际入口，更新全部观察器绑定。
4. 执行完整R04–R10；full cross-app、mock/八拓扑/external、Linux、standalone、Docker、本地三入口都保留。先检查固定端口/资源归属，避免重型套件相互争资源导致假启动超时。
5. 收集完整PNG/成功附件并人工审图；完成R11/C条件/九架构/共同矩阵和R12文档。保留每轮失败、原退出码、未运行项；不复用旧结果拼成新PASS。

实际脚本入口/参数以工具源码和对应manifest为准。当前有些工具硬编码某轮manifest/路径，不可只改显示名称。恢复时先选择新执行目录并重新审查绑定，不机械复制旧命令。

## 9. Git、源码保全与丢失副本后的恢复

分支 `main-wc`；HEAD `a7804539530846baecf548af7b5d2612deb89b68`；main `5ecc1c2ac2de624af354bc515d5cb04f80df226c`。实查 `main` 是 HEAD 祖先，无未合并索引项，无 MERGE_HEAD；上游合并已经进入当前历史，本轮没有再创建提交或推送。原索引/private/hooks边界由 `application-boundary.py` 对照既有受保护基线验证，不在文档暴露配置内容。

持久源码包绝对路径：

`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-10-25/pause-preservation/stage56-attempt6-public-source.tar.gz`

52,842,895 字节，5,812成员（5,809源码+2公共fixture+manifest）；全部成员安全路径/类型及逐字哈希已校验，见 [归档回执](evidence/resume-2026-10-25/pause-preservation/stage56-attempt6-archive.json)。不包含原 `.env/config.yaml/extensions_config.json`、原Git、原生依赖或构建输出；两个fixture是公共example字节。实际测试日志/截图/trace在各持久evidence目录，不能用源码包代替。

副本若仍在，先核manifest全部行和fixture，再决定复用。若丢失，先核上述archiveSHA，再遍历tar成员，仅允许普通文件、相对路径、无`..`，恢复到**新的本任务临时目录**，逐行核对copyRows/fixtureRows；禁止覆盖原工作区。归档已有唯一Nuxt buildDir变换，不要重复插入。

新路径必须生成独立恢复manifest，明确oldParent/newCopy/原source/copySHA，建立独立公共Git索引并正常安装依赖、核shim归属；旧manifest及运行回执绑定原路径，不能就地改写。当前已做归档全部成员验证，**没有声称实际执行过全新路径恢复/重跑演练**。原工作区仍是后续开发主现场，私有配置保留原位。

## 10. 原暂停现场与本次文档复核

2026-10-25 **23:22:52（Asia/Shanghai）** 实际只读核验：按原仓库/验收副本命令路径及相关运行时 cwd 未发现自有运行进程；列明的 17 个验收/外部相关端口均无监听（包括 3000、3002、3100、3370–3375、8260/8262/8264、2426/2486）。12 个本计划命名容器全部 exited，本轮 Linux 容器已停止并保留。容器进程退出码 137、`docker stop` 命令退出 0；这不是应用正常 SIGTERM/SQL 验收，R09/R10 仍未跑。详见[真实宿主快照](evidence/resume-2026-10-25/pause-preservation/final-host-state.json)及[Linux 停止回执](evidence/2026-10-25-linux-stage56-attempt4/pause-owned-container-stop.json)。

10 月 25 日最终核验未发送进程信号；当轮没有启动 Docker ingress/local 三入口，没有停止/恢复 AiPPT。3000 无监听及自有执行器已退出均是该时点观察，不能沿用旧 PID 或推断现在状态。10 月 26 日只读文件并完善文档，未重新探测运行环境。磁盘剩余和 Git/私有/index/hooks 保护结果保存在[最终边界](evidence/resume-2026-10-25/pause-preservation/final-boundary.json)；该文件及[交接审计](evidence/resume-2026-10-25/pause-preservation/handoff-audit.json)只证明暂停保全，不是产品验收通过。

原暂停时源码包逐成员已核。本次重新核对持久包哈希、直接回执、失败附件、文档引用与完整 W/R/C/九架构/共同矩阵，并记录在[10 月 26 日文档复核](evidence/resume-2026-10-25/handoff-document-review-2026-10-26/review.json)；原 `pause-preservation/handoff-audit.json` 和 `final-handoff.md` 仍绑定 10 月 25 日版本，不改写为本次结果。原工作区继续是主开发现场，源码包用于恢复这次准确检查点；临时依赖/构建可在新副本正常重建。没有清理用户其他项目、旧副本或原始失败材料。

下一次可直接发送：**读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-25-vue-whole-plan-paused-handoff.md`，恢复整个计划，不缩水；先核暂停现场，从第5节失败和第8节顺序继续。**
