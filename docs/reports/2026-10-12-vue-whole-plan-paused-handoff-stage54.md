# Vue 全计划暂停交接：Stage54

**状态：PAUSED_USER_REQUEST。2026-10-12，Asia/Shanghai。** 用户先要求找干净停点、写交接，随后明确要求“暂停”。最新指令优先：已立即中断当时运行的跨端套件，停止自有服务；没有等待全部用例结束，也没有继续修复。整个 W00–W13、R00–R12、C01–C13、九项架构整理和共同验收矩阵全部暂停。本文件是本次最新恢复入口，只有用户明确恢复后才可继续安装、测试、构建、服务或产品修改。

仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。总进度仍沿用约 **80% 工作量估计**，不是验收通过率。主体功能、架构优化与历史负担整理已经实施，但新验收仍发现失败，不能声称“所有代码已最终收尾”或“只剩形式验收”。

## 1. 范围与依据

- 当前 React `frontend`、Vue `frontend-vue`、`backend`、`contracts` 的源码、真实消费者及测试合同优先；文档用于定位，不能替代源码和实际 receipt。
- 两前端的功能、操作流程、可观察行为及 UI 样式必须一致。允许对 Vue 从根因重构、清理历史负担；不能靠裁切、跳过、提高预算、放宽断言、更新接受台账或手改依赖绕过失败。
- 唯一明确不要求同步的是 **Vue 首页内容、docs/blog 内容站、整站无后端的静态回放模式**。Showcase 属于对齐范围，保留全案例、媒体、只读动作及样式验收。
- 必要无障碍、原生键盘/焦点、滚动可达性及相应保护继续保留，不能按“无关功能”整类删除。
- 原完整计划：[2026-10-09-vue-period-plan.md](2026-10-09-vue-period-plan.md)。逐工作包、九项架构和共同矩阵的完整核对索引：[2026-10-10-vue-plan-progress-and-issues.md](2026-10-10-vue-plan-progress-and-issues.md)。这些文档的旧状态和旧数量以本文件及当前收据覆盖。
- 之前的 [Stage48 暂停交接](2026-10-12-vue-whole-plan-paused-handoff.md)保留为历史；其中“共用面板尚未修复”、旧 1004 用例、旧 103/105 WIP 等不再是当前停点。恢复以来历史过程见 [2026-10-12 执行记录](2026-10-12-vue-resume-execution-status.md)；本文件补齐其最后一次更新之后的 Stage54 实际结果。

## 2. Git、配置和运行现场

- 分支 `main-wc`；HEAD `a7804539530846baecf548af7b5d2612deb89b68`；main `5ecc1c2ac2de624af354bc515d5cb04f80df226c`，main 已是 HEAD 祖先，无未解决合并。暂停归档再次记录实时结果。
- 原仓库没有 commit、push、reset、stash、新建分支或改索引。原索引 SHA256 应保持 `84b68fe72666057091585629383421939eca62a9e1875544f259fd1a6b95b2a6`。既有已跟踪改动、未跟踪文件和用户 WIP 全部保留。
- `.env`、`config.yaml`、`extensions_config.json` 是本项目有意跟踪的私有运行输入；只记录 hash，不复制值、不改策略。暂停归档核其前后不变。
- 原生跨端执行 session `62165` 已退出，观察器 exit 2。仅对当时属于本轮进程树的 Playwright CLI PID `49227` 发送 SIGINT；其 runner PID `47963` 留到完成原输入围栏后自然退出。上述 PID 仅为历史，恢复时禁止复用。
- `pause-preservation/host-after-stop.json` 已确认当时 20 个自有进程无同出生时间残留、冻结副本命令匹配为空，3370–3375、8260/8262/8264 均无监听。只读快照不是未来端口可用保证。
- AiPPT 的 3000 服务仍为 PID `86474`，未暂停、未发信号。未来 dev-dual 仍可按用户已有授权，在 **重新证明原方式可恢复后** 临时暂停，并在验收后证明已恢复；不能沿用旧 PID 或旧私有恢复输入。
- 所有运行型协作任务均已停止。本次用户要求“仔细审查下”后，仅继续只读文档/源码/收据审核并补文档；F01 静态报告已补齐，实际复现、诊断和修复仍未执行，不能把静态机制分析冒充已证现场根因。

## 3. 本次有效冻结输入与可恢复副本

Stage54 共有 **5737 个公共源文件 + 2 个公开示例配置夹具**。source SHA256 `05418946ff24f974776cc1a39e48ef9a425068bff82042957a2a405b9454830b`；copy SHA256 `ee55069da74cfaf47f9dc642b8e073e74b6ef4e6ef57c19a41818ac925e2bd1a`。唯一源码转换仍是隔离副本的 Nuxt `buildDir: "./.nuxt"`。两夹具逐字来自公开 example，不含原仓库操作员配置。

| 用途 | 副本与证据 | 暂停状态 |
| --- | --- | --- |
| 后端四门 | `/private/tmp/deerflow-next-final-stage54-1txljkvs`；`docs/reports/evidence/root-stage54-checkpoints/`，manifest SHA `0c48a32576b759783581e1708e9d3276a5b3ede2c0c2f325f8c31b448f2029bf` | 四门已完整 PASS。正常生成两项根配置 sidecar；保持现场，不从这个副本继续 generic 前端门禁 |
| Vue/React/cross-app | `/private/tmp/deerflow-next-final-stage54-1nqacteb`；`docs/reports/evidence/root-stage54-cross-app-checkpoints/`，manifest SHA `bb27d0c476d98b53809c0fa5d2c0fe075647ad666ec1da5a5cf82dac33d64457` | canonical/collection/icons PASS；React unit FAIL；cross-app 部分 FAIL 后用户中断，全部进程已退出 |
| 原 Stage53 失败现场 | `/private/tmp/deerflow-next-final-stage53-33cgd_i0`；`docs/reports/evidence/root-stage53-checkpoints/`及 `resume-2026-10-11/backend-full-stage53/` | 保留原失败和后来正常生成文件，不覆盖、不将其旧 PASS 当 Stage54 PASS |

两份 Stage54 均做过正常 fresh frozen 依赖安装、公开 Readabilipy 首次设置预热、完整输入捕获；自有副本创建了独立、无父提交、无远端/分支的真实合成 Git 根提交，原 Git 对象和索引未复制。这是 Git 基准测试夹具，不是向原仓库提交代码。初始 manifest 的“无 commit”是创建时事实，后续 Git provenance 单独记录。

**持久保全目录：** `docs/reports/evidence/root-stage54-cross-app-checkpoints/pause-preservation/`。`summary.json`、`live-source-manifest.json`、`stage54-frozen-source-manifest.json`、`durable-evidence-manifest.json` 和归档成员核验记录用于恢复；归档是保全，不是新门禁 PASS。临时副本若被系统清理，先按该目录清单从持久源码包恢复输入，再正常安装环境，不能把副本缺失当成证据消失。

两源码包是 **14:30–14:31 的不可变快照**：`paused-live-public-source.tar.gz` 为5738成员，SHA `3eef360130c6bcab6417dd515276115aee1c46984446124de2e7ed4324d37e1f`；`stage54-frozen-public-source.tar.gz` 为5740成员，SHA `e481a0fcb8e94193d8e672377d8b01dcafe2b4cd8928058e4d3b195cd429869c`。本次文档复核的修订晚于该快照，单独保存在 [文档复核与补充归档](evidence/resume-2026-10-12/stage54-handoff-audit/README.md)，不得改写旧 summary、清单或归档。恢复资料若来自旧包，应先按补充清单更新交接文档，再重新核对源差异；这不授权向原仓库盲目解包或用旧 PASS 接续新输入。

## 4. 当前实际门禁结果

| 门禁 | 当前实际结果 | 精确证据 |
| --- | --- | --- |
| 后端原四分片 `make test` | **27149 PASS / 414 原有 SKIP / 0 FAIL**，69 warnings 保留；未新增 skip/filter | `docs/reports/evidence/resume-2026-10-11/backend-full-stage54/actual/` |
| `make test-blocking-io` | **235 PASS / 0 FAIL**，原 2 warnings 保留 | 同上 `blocking-io.log` |
| 后端 lint / format-check | 原命令全部 exit 0 | 同上 `execution.json` SHA `666d060316865e84d6a78359dbd2874fb906bc2f2c38fc245fddcef580bd603b` |
| Vue 原完整 canonical | **496 文件 / 4136 PASS**；OpenAPI、lint 零 warning、format、四组 types、build、原 asset budget、consumer、audit、extension fixture 全部通过。audit 原日志为 **6 advisories / 6 exact source reviews**，并非“零漏洞” | `root-stage54-cross-app-checkpoints/final-canonical/`，execution SHA `0d85e0377710cbecf2b9e6ecba3a1e8b173f2f145a1d9be98b9ef22f5773ccb5` |
| 原完整 collection | **18 配置 / 1632 项**，其中 product **1008**；收集成功不能称浏览器通过 | `final-collection/`，execution SHA `085bf3c6283bbb11a41cee5a6794b255dd139814925bff050a1fdce355e0be82` |
| 图标门禁 | PASS；SettingsDialog 异步 loadingComponent 的唯一 status 人工信号保留，实际组件单测覆盖，不修改 scanner/allowlist 掩盖 | `final-icons/`，execution SHA `3c0633a1fecd44f70ec277f2c52e7b7bb9d5549c8f9244da9bef4148a781dd58` |
| React check + full unit | check 通过后实际进入 full unit；**325 文件 / 2992 PASS / 1 FAIL / 0 SKIP / 0 TODO**，整门 FAIL/direct 1 | `final-react/execution.json`、`gate.log`、`full-unit.log` |
| 原完整 cross-app | product **66 PASS / 8 FAIL / 1 interrupted / 933 did not run**；其后 auth 21 / SQL-session 8 均 UNRUN。Playwright 原 exit 130、Make exit 2，观察器 closed FAIL；不得把 8 个先发生的失败统称用户中断 | `final-cross-app/execution.json` SHA `6e08928bb88d41687d59e824be9fa233e5298cf465a8924f354d79a9628de16c` |
| 751 宏 / 1502 PNG | 全矩阵未执行、完整 PNG 验证和人工审图 **UNRUN**。本次 84 张失败/中断截图不能当完整矩阵 | 见下面保全清单 |

这些已闭合 gate 的公共源、公开 fixture、前端依赖、后端环境/stdlib、工具、运行时和 Git 路径围栏均按原规则完成核验，无未声明漂移。后端两项正常 sidecar 使用精确文件准入及空锁文件不变量，其余边界未扩大。原 build/plugin/sourcemap/chunk warnings 和全部旧失败原文保留。

独立只读回读：`resume-2026-10-12/stage54-r11-readonly/{backend-full-closed-independent-readback.json,frontend-base-closed-independent-readback.json}`。它们只确认各自范围，不关闭整个 R11 或其余 runtime 验收。

## 5. 两组未修复失败与准确恢复位置

### F01：React 发送前草稿持久化断言

- `frontend/tests/unit/components/workspace/input-box-project-attachment.dom.test.tsx`，`retires only the sending thread's state when its upload finishes after a thread switch`，line 307：预期 `summarize it`，实际 `undefined`。
- 失败发生于输入后固定 sleep 400ms 的读取；**尚未点击发送、切换 thread 或调用 dispatched**，不能据此报告“晚返回清错线程”。日志另有 `/api/features` 400/404，不能仅凭同时出现就归为直接原因。
- 静态已发现：`useConversationReferencesCapability` 每 render 返回新 object；`InputBox` 的 `scheduleDraftSave` 依赖整个 object，使草稿 effect 可在无关 render 时取消并重新安排 300ms timer。这是代码可达机制；本次没有 timer/fetch 完成时间遥测，尚未证明哪次重排直接造成 F01。HappyDOM 的同步 Storage 强引用路径不支持直接照搬之前 MutationObserver GC 根因。
- 恢复后最小诊断：真实挂载 InputBox，控制 capability 请求完成及同 owner 的无关 parent rerender，观察真实写入/取消与 key 归属；区分产品持久化饥饿和测试错误前置。不得单纯加长 sleep、重跑到偶然 GREEN 或 mock 掉被验证的草稿/发送机制。
- 原 Stage53 同 frontend 字节曾 2993 PASS，准确收据在 `root-stage53-checkpoints/native-final-react/execution.json`；同轮 `final-react` 是先前 EPERM/零用例失败，不能混用。这只是历史，不覆盖本次失败。尚未实施任何 F01 修复。
- 本次补齐的静态分析：[readonly-causal-analysis.md](evidence/resume-2026-10-12/stage54-react-failure-audit/readonly-causal-analysis.md)及同目录 JSON。实际触发、受控 mounted 诊断仍为 UNRUN；报告中“尚未授权执行”仅表示当前暂停禁止执行，不要求用户恢复整个计划后重复批准已在范围内的常规诊断。

### F02：CodeMirror 双端 8 项正式失败

- `frontend-vue/tests/e2e-parity/code-editor.spec.ts:238` 的 Python、JavaScript、JSON、Markdown，各 light/dark 共 8 项失败；CSS、HTML、text 的 6 项通过。
- Python/JS/Markdown 共 6 项在 `.cm-searchMatch` 预期 `parity` 处失败，原 timeout 10000ms，元素未找到。JSON 两项 `sourceRendering` 对照不等，日志显示额外括号 token 记录和颜色差异。具体先失败在哪个 app/步骤须读实际 trace，不从错误名推断 Vue 已确定为唯一责任方。
- 恢复首先读取持久化 trace/PNG/error-context 与完整原 log，区分真实搜索/焦点/语言配置差异、oracle 采样和测试前置；只从根因修。尚未复现诊断、修改源码、放宽原断言或调整基线。
- 被用户中断的是接下来的 Vue `combined-reflow.spec.ts:463` 全登记表重排，**单独标 interrupted**，不并入 8 FAIL。原 full product 剩余 933、auth/session 未执行，恢复最终仍须完整原聚合。

### 失败产物已持久化

原 `preserve-formal-artifacts.py` 从本次已闭合 FAIL 收据执行保全，未修改工具：

- 目录 `pause-preservation/cross-app-artifacts/`，完整两声明输出根实际 **103 文件 / 91018396 bytes**，包括 84 PNG、9 ZIP trace、8 MD、2 JSON。
- `preservation.json` 标记 **PASS_PRESERVATION_ONLY**，原 gate 仍 FAIL；inventory SHA `ea15e9974e360aa1dfdb5627355dca8c4f6caa9e6b3469571cc8448b8c069ae6`，逐文件前后及目标 SHA 一致。
- 原 failure wrapper 同时另存于副本 `frontend-vue/test-results/failures/2026-10-12T06-22-16-573Z`，本次保全包含它。今后重跑会清理 test-results，必须先读保全副本。
- `verify-parity-png-evidence.py` 要求完整 PASS，不可拿本次部分产物运行或伪造 PASS receipt。1502 解码/维度/零差异台账核验及人工审图均留待完整 GREEN。

## 6. 全部工作包：已实施与未完成

| 工作包 | 当前已实施/有效阶段证据 | 暂停后仍需收口 |
| --- | --- | --- |
| W00 基准/契约 | 核心和扩展 OpenAPI、类型/常量真实消费、隔离输入/退出码链；Stage54 canonical/collection 通过 | 全拓扑当前输入一致性、CI 与最后文档 |
| W01 账户/偏好 | session owner/RBAC/locale/timezone/字段 PATCH/恢复及相关阶段回归 | 本次 auth21、真实 SQL-session8、所有权限/恢复与异常链仍 UNRUN |
| W02 run/消息 | gap/durable/error/END、create/join/stop/dispose、human ID、附件 owner、HIL/消息动作 | 完整 protocol/real/双端未收口，禁止重复 create 或旧 owner 污染 |
| W03 产物 | bounded/Range/SHA/conflict/保存锁/资源退休、CodeMirror/预览及阶段回归 | **F02 8 项失败根因处理**；完整产物、P03 真实 Gateway 截图和媒体链 |
| W04 输入/模型 | 提交快照、草稿/附件/引用/知识/reasoning/语音 owner、placeholder 修复 | **F01 根因未定/未修**；完整输入/模型/浮层与 mock，不能称全完成 |
| W05 能力/Agent | gallery、安装/配置权限、Skill409、Agent 定义包/知识范围；MCP 容量根因修复及定向 GREEN | 全部能力/Agent/知识真实拓扑与双端最终验收 |
| W06 历史/删除 | 侧栏定位/原生滚动归属、来源/未读/activity/虚拟化/删除部分失败等已实施 | 完整追尾、分页、resize/删除/跨 owner；本次早期相关浏览器 PASS 仅覆盖实际已跑项目 |
| W07 调度/channel | 页面/卡片/prompt/events/分页、queue/DST/后台 owner/channel 阶段实现与回归 | scheduled/channels/agents/settings 全部真实聚合及双端 |
| W08 扩展 | assets/inline、模块图/页面/导航/动作/mentions 生命周期；Stage54 extension fixture PASS | 全宿主权限/晚返回/卸载/Docker 实际消费 |
| W09 项目/trash | 四 tabs、instructions/分页/附件/预览/转换/冲突/部分失败等已实施 | 全项目/trash 双端和真实 Gateway 恢复 |
| W10 面板/设置 | 共用 WorkspacePanels 原生 resize、280ms 呈现退出 owner、AgentChat identity/ABA/关闭准入已修；定向/负控/原生阶段证明保留 | 全站 sidecar/browser/memory/subagent/设置的完整当前输入验收；旧“尚未动产品”已过期 |
| W11 Showcase/UI | 全案例登记、Markdown/流式 pacing/math/truncated、Tooltip 默认延迟/禁用原因等已实施 | 当前完整 product 部分中断；751/1502、Showcase 动作、主题语言视口、样式审图未完成 |
| W12 架构/历史负担/CI | owner 与真实消费者收敛、Splitpanes 移除/原生 L2、守卫清理和有效负控；HappyDOM 官方修复版本正常锁定 | 九项架构逐项最终消费者/完整回归闭合、Linux/独立运行/CI/部署；不能把拆代码视为最终完成 |
| W13 验收/同步交付 | Stage54 基础/后端全量 PASS、FAIL/interrupt 分开、全部现场及交接保留 | R05–R12 和 F01/F02 未完成；marker 继续 REVIEW_REQUIRED |

九项架构检查继续使用原索引全部行：消息虚拟化、聊天编排、状态归属、缓存/feature、集成流程、孤立代码/重复模型、重复算法、历史叙事/门禁、UI 适配。共同矩阵继续包含数据/权限/浏览器、主题语言视口、低高放大/resize/键盘、路由恢复、持久化、异常恢复和运行成本；不得因暂停或已有单测 PASS 移除任一维度。

## 7. 所有恢复任务与原门禁

只在用户明确恢复后执行；优先保全旧输入，核 Git/WIP/私有 hash/端口进程出生和 cwd。旧工具中已有 execution 的目的目录不能重用，必须新轮次保留旧收据。普通文档新增也属于新源，恢复时核 delta，再决定新冻结和实际受影响门禁，不能静默把旧 Stage54 当新源。

| 编号 | 当前状态与准确下一步 |
| --- | --- |
| R00 | 重新读本文件、pause summary、host/stop/preservation 清单；核现场，不直接用旧 PID/进程或旧 PASS 启动 |
| R01/R02 | MCP/侧栏定向根因修复已实施，保原回归，不无理由重做；纳入最终完整双端 |
| R03 | Stage54 已独立冻结并 fresh 安装；恢复先处理 F01/F02，修改后新轮次冻结，保公开 fixture、Nuxt 唯一转换和所有输入/工具围栏 |
| R04 | Stage54 Vue/collection/icons/backend四门已 PASS；React unit FAIL。修复后按受影响 source 重跑原完整门禁，不以定向替代全量，不覆盖54 |
| R05 | 本次 full product 66PASS/8FAIL/1interrupt/933UNRUN；auth21/session8UNRUN。最终原 `make -j1 -C frontend-vue e2e-cross-app` 全部顺序执行；751宏/1502PNG/零接受差异台账/原全部预算，清理前先保全，再完整验证及人工审图 |
| R06 | 第二独立浏览器副本 + 正常新依赖，原完整 mock/backend/external sequential。backend 保 protocol/real/scheduled/channels/agents/settings/shell/browser 八拓扑及 P03；external 是受控 WS/OIDC，不冒充真实第三方 |
| R07 | Stage54 Linux 仅 metadata 已绑定，实际 copy/install/Docker/8visual/12payload/asset/9PNG审阅均 UNRUN；工具 `docs/reports/evidence/2026-10-12-linux-stage54/README.md`，固定镜像/Node24.14.1/native ARM64/host IPC 不变 |
| R08 | Stage54 standalone default / `--with-e2e` 仅工具绑定；outer 构造、各模式 fresh inner 安装/fullunit/build 均 UNRUN，outer 按原合同保持无已装依赖。**`--with-e2e` 还须在无 React 的 fresh inner 中实际完整执行 `make e2e-mock` 和 `make e2e-backend`**；只有依赖 React 的 parity 配置为 collection-only，不能把整个模式降成收集。入口 `resume-2026-10-12/stage54-manifest-binding/README.md`；实际工具路径见下表 |
| R09 | Gateway/React/Vue canonical Docker build 与 build-vue/build-react/probe/probe-oidc/smoke/normal-stop 六 phase 全 UNRUN。Stage54 metadata 通过不是 Docker PASS；项目 `deerflow-vue-ingress-ee55069da7`，入口 `stage54-r09-r10-binding/README.md` |
| R10 | 原 make dev-vue/dev-dual/`bash scripts/serve.sh --prod --vue` 三入口全 UNRUN；保30/300/180启动预算、auth/me/permissions/preferences204/单次SSE/context/三suggestions/刷新持久会话/无重复提交。dev-dual 重新证明 AiPPT 可恢复后才用已有临停授权 |
| R11 | source admission/Stage54 增量及部分实际检查点已回读；WATCHED 11prefix **83 tracked-dirty +28 untracked=111**，marker REVIEW_REQUIRED，未 accept。最后三端增量/WIP/消费者/docs/CI/marker 未闭合；111是这一 source 快照，恢复须重新枚举 |
| R12 | 分开报告代码、本地集成/双端验收、外部条件；必需 FAIL/UNRUN 在就不能称全完成。原仓库 commit/push 等待后续明确授权 |

R07/R08/R09/R10 的所有工具仅 metadata/静态读回，不能作为运行通过。若恢复后新源 SHA 改变，按原 derivation/inverse-byte/AST 规则重新绑定新轮次，保留54，不能直接改旧运行收据。

### 恢复工具、依赖与临时目录失效边界

以下均为仓库相对路径，根目录已列在本文开头；这些是恢复定位，不是现在执行指令。用户恢复整个计划后，由主任务按原门禁前提协调窗口；工具文档中的 window/flag 要求是运行准入和资源协调，不另行缩小已授权范围。

| 用途 | 精确位置与保留前提 |
| --- | --- |
| R03–R06 原冻结/门禁/产物工具 | `docs/reports/evidence/root-stage54-cross-app-checkpoints/` 下 `prepare-source-copy.py`、`prepare-frozen-dependencies.py`、`prepare-browser-copy.py`、`run-frozen-gate.py`、`preserve-formal-artifacts.py`、`verify-parity-png-evidence.py`。54 已有收据，须派生新轮次；R06 浏览器 copy 尚未构造，不能用已有副本代称独立环境 |
| R07 Linux | `docs/reports/evidence/2026-10-12-linux-stage54/README.md` 与 `stage54-manifest-bound-preparation.json`；无实际 `stage-context.json`。原固定 Playwright 镜像、Node24.14.1/ARM64/host IPC、8 visual/12 payload/asset/9PNG 全保留；正常 cache/install 与真实容器验收尚未执行 |
| R08 standalone | `docs/reports/evidence/resume-2026-10-11/standalone-round54/` 下 `prepare-outer.mjs`、`capture-outer.py`、`validate-observer.py`、`run-standalone.py`；日期目录是既有工具位置。先按新 manifest 准备真实 outer，读取实际 `outer-source-final.json`，再分别运行 default / with-e2e；旧 outer/旧 default PASS 不替代任何当前模式 |
| R09 Docker | `docs/reports/evidence/container-ingress-stage54/` 下 `run-light-preparation.py`、`run-phase.py`；预期 runtime 在 `docker/.cache/container-ingress-stage54`。`inputs`、`docker-readonly` 和 `engine-context` 为实际前提，之后原六 phase；canonical Gateway 重建、物理 context/engine COPY、REST/SSE/WS/OIDC、非 root/正常 SIGTERM/SQL 保全均须真实核验 |
| R10 本地三入口 | `docs/reports/evidence/local-entry/stage54/` 下 `run-entry.py`、`collect-owned-evidence.py`；每模式须独立 prepared copy、新准入、实际 start/采集/相同 owner 的 stop。已有 flags=false 不是执行结果，不用旧 PID；AiPPT 仅按本文已有条件处理 |
| R11 原范围核对 | `docs/reports/evidence/resume-2026-10-12/stage54-r11-readonly/README.md` 与 `review.json`；111 WIP 是该快照，恢复重枚举，保持 marker REVIEW_REQUIRED 至实际完整闭合 |

原 source factory 仍读取 `docs/reports/evidence/root-stage47-checkpoints/copy-path.txt` 的物理 Stage47 模板；若 `/private/tmp` 被清理，另有持久 `docs/reports/evidence/root-stage48-checkpoints/pause-preservation/stage47-frozen-public-source.tar.gz`、同目录 manifest/summary（5718源 +2公开夹具 +冻结manifest =5721成员）。**只解包不能直接保证 factory 可运行**：包不含依赖或原 Git，而原 factory 还依赖隔离模板的 `.git` 目录前提。恢复时先按原清单校验公共输入、恢复声明的隔离模板/合成 Git 前提，再派生新源和正常安装；绝不复制原仓库 Git/私有配置，也不在暂停期间修工具或重建目录。

人工审图计划位于 `resume-2026-10-12/stage54-visual-review-plan/{artifacts.md,artifacts.json,workspace.md,workspace.json}`。它们仍是 **UNRUN 计划**。部分成功态附件仅以 body 传给 list reporter，不保证落盘；不能预造 CM/placeholder/Tooltip PNG 路径或拿 HTML preview 代证编辑器。后续公开夹具同状态补充取图属于已有 UI 验收授权，但必须另有实际文件和记录；静图不代证动态 owner/滚动/真实 WS。暂停时子代理未完成最后文字更正，旧“需另外授权取图”叙述以本段为准。

## 8. C01–C13 的最后关闭条件

以下全部保持 OPEN，表示最终关闭证据尚不完整，不表示所有对应实现都缺失。

| 条件 | 保留的关闭依据 |
| --- | --- |
| C01 | 全范围页面/入口/动作真实完整，仅三项明确豁免；R05–R07/R11 |
| C02 | 全 Showcase 资源/只读动作/双端 UI，工作区写入另验；R05–R07 |
| C03 | 全 WIP 有真实消费者并验证或有据移除；R00/R11 |
| C04 | P01/P02/P03、F01/F02 及历史异步根因修复与有效回归；R01–R07 |
| C05 | gap/durable/human/run input/附件，不重复 create 或旧草稿假提交；R04–R06 |
| C06 | 偏好/locale/timezone/引用授权分层/reasoning 三套 schema/知识/Agent/来源未读分别验证；R04–R06 |
| C07 | 调度/channel、项目/trash 和扩展全真实场景；R04–R06 |
| C08 | 功能/流程/行为/UI 双端完整，包括751/1502与人工样式审阅；R05–R07 |
| C09 | 九项架构/历史负担、唯一owner/消费者和必要无障碍；R01–R07/R11 |
| C10 | backend REST/SSE/JSON 真实消费者、取消/持久化/异常恢复；R04–R06/R11 |
| C11 | 原完整verify/浏览器/backend/visual、CI接线和失败现场；R03–R09/R11 |
| C12 | Vue构建/无React独立/本地三入口/容器各自真实证据；R04/R08–R10 |
| C13 | 文档/源码/命令/验证/marker 一致；R11–R12 |

## 9. 环境与外部边界

- 本机原仓库 node_modules 尚未做最后正常 frozen 更新；**本次只读核对两端均实际为 HappyDOM20.11.1**，而本轮跨端独立副本两端为锁定20.11.2。恢复必须重新核对，不能以副本 PASS 证明用户当前 live 环境已更新。最终正常安装走 `scripts/pnpm.py`；不为安装改原 Git/pre-commit hooks。
- 浏览器 cache 是宿主 `~/Library/Caches/ms-playwright`，不在上述源码包/依赖归档内；原 runtime fence 只覆盖其声明的六个入口文件，不能冒称浏览器整个树被捕获。`resume-2026-10-12/stage54-browser-readiness/` 仅只读确认 JS Playwright1.59.1/Chromium1217、Python Playwright1.61.0/Chromium1228 及所需 headless/ffmpeg 路径存在与8字节 Mach-O/ARM64头，**未启动浏览器、未完整 hash 二进制**。恢复按各原配置重新验证实际浏览器可用性，不替换 channel 或沿用存在即 PASS。
- Readabilipy 正常首用会 npm 安装公开依赖；Stage54 在捕获依赖基线前通过公开 API 预热并完整纳入1889正常新增文件。不能把它当源码漂移后任意排除、手改 vendor、把首次未完整 receipt 改成 PASS。
- 原53的 Git 空 HEAD、macOS SystemConfiguration 回环代理、空锁 sidecar、Readabilipy 首用等已分别从根因处理。IPv4 回环 helper 仅包三个已有自有 server fixture 生命周期，不是 autouse/全门禁代理覆盖，不宣称复刻所有系统代理语义。
- Docker/沙箱/其他项目占用重新核实际 ownership；不做全局 stop/kill。3000临停仅限既有 dev-dual 授权。
- 受控 OIDC/WS、公开fixture/seed不等于真实外部 IdP/IM/LLM；DNS/TLS、外层代理、线上切流、GitHub hosted upload/required checks 等环境证据仍单列，不虚构 PASS。

### 已落源修复的回溯位置

这些是既有实施与阶段证明的定位，不能代替上面的未完成验收：

| 已实施事项 | 源码/记录入口与边界 |
| --- | --- |
| 共用面板及历史 Splitpanes 清理 | `frontend-vue/app/components/workspace/WorkspacePanels.vue`、`app/components/ui/resizable/ResizablePanels.vue`、`app/components/chat/AgentChat.vue`（后两项相对 frontend-vue）；`resume-2026-10-12/resizable-root-migration/` 和 `resizable-primitive-independent-review/`。owner/ABA/退休/280ms呈现及有效负控属于阶段证明，全应用最终验证尚未关闭 |
| Tooltip、图标委托、i18n 与 Markdown 测试边界 | `frontend-vue/app/components/ui/tooltip/TooltipProvider.vue`；执行记录中 tooltip/scanner/i18n 的源与有效 RED/GREEN 入口；`resume-2026-10-12/tooltip-parity-root-cause/`、`tool-call-status-readonly-stage51/`、`markdown-test-boundary-independent/attempt2/`、`fixture-reference-boundary/`。不把组件证据、collector 或测试替身当正式应用对齐 |
| HappyDOM 生命周期缺陷 | 两端 manifest/正常完整 lock 已锁定20.11.2；`resume-2026-10-12/sheet-observer-root-cause/`。官方修复与公开 API 负控不证明 F01 草稿失败也是 GC 根因；原仓 installed 环境仍待正常更新 |
| Stage53 七项后端失败及两围栏缺口 | `backend/tests/support/loopback_http.py`、`backend/tests/test_loopback_http.py`、`backend/tests/test_extension_manager.py`、`backend/tests/test_parallel_mcp_user_agent.py`、`backend/tests/blocking_io/test_typesafe_guardrail_provider.py`、`backend/tests/AGENTS.md`；`resume-2026-10-12/loopback-fixture-root-cause/`。该目录应用时 UNRUN 是历史，修复后真实全量 PASS 在本文 Stage54 backend actual；合成 Git、正常 Readabilipy 预热与精确 sidecar 准入另有准备/观察器记录，不手改已装依赖 |

保全本身另有一项派生清单边界：旧 `preservation-files.json` 在脚本最后输出前捕获了 `capture.stdout`（168 bytes），最终 stdout 又追加219 bytes成为387 bytes，因此旧清单的该项 hash 与最终文件不同。新独立审查已记录原因和最终值；不改旧清单，也不将此项扩大为源码包或103项产物保全失败。它不是门禁 PASS；两源码包成员及103项产物的实际字节核验结果分别保留在本次 [只读复核](evidence/resume-2026-10-12/stage54-handoff-audit/README.md)。

## 10. 最短恢复指令与精确停点

下一次可明确说：**“读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-12-vue-whole-plan-paused-handoff-stage54.md` 和其中 pause summary，恢复整个计划，保持原范围与门禁，从 F01/F02 的真实失败现场继续。”**

恢复第一项是只读重核现场和已保全失败；随后诊断 F01/F02，按实际根因修复并做有意义回归/负向保护。再为新源建立新独立冻结，依 R04–R12 完整收口。不要重启这次中断套件继续“剩下933项”来拼接全量 PASS，不覆盖任何 Stage54 receipt，不把暂停文档当自动恢复授权。

暂停后允许的操作仅限本次停止、只读现场核对、文档和归档；没有继续产品修复、测试、构建、安装或启动服务。
