# Vue 平替、架构与历史负担清理：全计划暂停交接（2026-10-24）

**状态：PAUSED_USER_REQUEST。** 用户要求到干净节点后收尾、写交接，等待后续有空再恢复。已在本轮双端三轴键盘宏正式结果落盘后，仅向重新核实身份的 Playwright CLI 发送 SIGINT；外层记录器于 **2026-10-24T20:04:28.317760+08:00** 收尾。本轮自有服务/浏览器/记录器已退出，验收端口已释放。此后只保全现场与文档，不再启动任务；下次必须有用户明确恢复指令。

仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，分支 `main-wc`。本文交接的是**整个计划**：W00–W13、R00–R12、C01–C13、九项架构及共同矩阵。约 **85%** 仅是整体工作量估算，不是测试通过率，也不表示代码全部写完。

本文优先于 2026-10-20 及更早交接中的阶段状态。旧材料原样保留，事实以当前源码、冻结清单和直接执行回执为准。没有缩小范围，没有将历史 PASS 拼接为最终通过。

**暂停后再次复核：仅更新本文和交接索引/核验记录。** [逐项复核与精确清单](evidence/resume-2026-10-24/handoff-document-review/README.md)保留本次查漏、34规格逐项结果、22目标及恢复前置。没有重跑测试、安装、构建、源码修复或服务操作；下文进程、端口、容器和磁盘情况均指原暂停时的观测，不是本次重新探测。

## 1. 范围与既有授权

- React `frontend`、Vue `frontend-vue` 和 `backend` 共同核对。Vue 的功能、流程、行为及 UI 样式应可以平替 React；架构优化和历史工程负担清理同属本计划。
- 唯一排除：Vue 首页**内容**、docs/blog 内容站、整站无后端静态回放。**Showcase、必要无障碍、原生键盘/焦点、弹层、响应式和视觉交互均在范围内。**
- 根因修复，不放宽阈值/预算，不跳过失败，不扩大差异接受，不以重置焦点、延迟取样或模拟成功掩盖问题。
- 用户已批准 Sonner 2.0.7、`@radix-ui/react-tooltip` 1.2.8、`@radix-ui/react-dismissable-layer` 1.1.11 的正式依赖源码修复，采用仓库 patch 文件、pnpm 登记与 lockfile、正常安装校验；包含 Layer 的稳定 ref 修复。**不用再次询问这三项，不手改 node_modules，不需要 npm 私仓。**
- 最终标准 `make dev-dual` 的 3000 端口若仍被 AiPPT 占用，用户允许先确认其原启动方式可恢复，再临时暂停、验收后恢复。本轮未使用此授权，恢复时重新确认归属，不能照旧 PID 操作。
- 无 commit/push 授权；保留原分支、索引、所有 WIP、`.env`/`config.yaml`/`extensions_config.json` 及刻意跟踪策略。不得为了提交新建分支。

以下证据短路径以 `docs/reports/evidence/resume-2026-10-24/` 为基准；明确以 `docs/` 开头的路径相对仓库根目录。

## 2. 当前候选、停点与结果边界

| 项 | 准确状态 |
| --- | --- |
| 诊断副本 | `/private/tmp/deerflow-next-final-stage56-uyc554wf`，与原工作区分开 |
| 当前候选 | `candidate-v75/manifest.json`；**253 份差异、5790 个公共输入**；manifest SHA256 `07e7ea1c74a8b1d57d1d599326e4e3c85951042eb7870e3914baa36f43f73847` |
| Vue 完整 unit | v75，509 文件 **4577 PASS** |
| React 完整 unit | v75，333 文件 **3105 PASS** |
| 同 v75 静态 | React check、Vue ESLint、format、test-types 全部 PASS；不是完整 Vue verify |
| 完整收集 | 18 配置 **1734 collected，product 1110**；收集不等于执行 |
| 定向原生 | `native-focused-v8`，19 完整规格、174 PASS，0 FAIL/SKIP/flaky；原36定向遍历保持，源/辅助输入/身份不变 |
| 完整原生 | **用户暂停、未全跑完：193 PASS / 0 FAIL / 1 interrupted / 22 UNRUN，flaky=0，directExit=130**：`native-complete-v4`，34完整规格/216身份，原844普通遍历及全部三轴宏；源及路径集合未变，216身份完整保留 |
| 原工作区 | **尚未集成这253份候选，也未正常更新原依赖安装图** |
| 待应用收尾 | `r11-retirement-followup/proposal.json`：22目标，14删除/8替换，另有2项依赖待正常 pnpm remove；均未应用 |
| 最终验收 | 新 Stage56 尚未冻结/绑定；R04–R12 仍待最终同一份源码完整执行 |

本轮在双端三轴键盘宏之后按用户要求暂停，完整34规格没有跑完；通过数与中断/未运行分别保留。下次需同源从头完整重跑，不拼接当前PASS。即使后续34规格全绿，也不能冒充 product1110、18配置1734、全后端或整个计划完成。清理会改变源码，必须重新冻结并完成完整验收，不能迁移 v75 PASS。

外层原回执仍为 `FAIL_COMPLETE_NATIVE_DIAGNOSTIC`，不改写成PASS：原因是用户暂停后exit130、整轮未完成；原报告`skipped=23`明确拆为1 interrupted和22 UNRUN，不是23项豁免。

阶段回执：`candidate-v75-check-sequence/execution.json`、各 `candidate-v75-*` 目录、`native-focused-v8/execution.json`、`native-complete-v4/execution.json`。逐项结果与附件以 `pause-preservation/native-cases.json`、`pause-preservation/native-preservation.json` 和原报告为准。


本轮未通过部分按正式规格列全，逐项title/id/attempt在`pause-preservation/native-cases.json`；用户中断不计为产品失败：

| 状态 | 规格 | 数量 |
| --- | --- | ---: |
| UNRUN | `triple-overlay-keyboard.spec.ts` | 1 |
| UNRUN | `triple-panel-capacity.spec.ts` | 8 |
| UNRUN | `triple-reflow.spec.ts` | 3 |
| UNRUN | `viewport-fit.spec.ts` | 2 |
| UNRUN | `workspace-control-capacity.spec.ts` | 8 |
| interrupted | `triple-overlay-keyboard.spec.ts` | 1 |

原844普通键盘遍历与两端三轴键盘宏的实际结果见下列原日志摘要；不据此接受本轮未执行的浮层/布局规格：

```text
  ✓   92 [chromium] › tests/e2e-parity/keyboard-order.spec.ts:239:1 › 两个应用按 Tab / Shift+Tab 走的是同一条环 (29.2m)
[triple-keyboard] vue scanned=422 focusEvents=15031 bodyEdges=520 overlayOwned=1202 dead=0 trapped=0 invisible=0 unreachable=0
[triple-keyboard] react scanned=422 focusEvents=15278 bodyEdges=520 overlayOwned=1202 dead=0 trapped=0 invisible=0 unreachable=0
```

## 3. 本轮已完成的修复与旧问题去向

以下实现已在 v75，**尚未进入原工作区**。每项历史 RED/GREEN 保留，最终验证边界见第2节，不能重复套用旧 proposal。

| 问题或工作 | 当前实现与证据入口 |
| --- | --- |
| 通知焦点 | Sonner 正式源码修复及真实挂载/原生生命周期回归保留；普通 Tab 与 Alt+T、离开/失焦/卸载/dismiss 分开处理；旧授权见 `../resume-2026-10-20/notification-focus-proposal/` |
| Tooltip 自关闭 | Tooltip 全局打开通知携带 content identity，仍挂载的自身退出监听不误关闭本次重开；`tooltip-source-proposal/`、`tooltip-application.json` |
| Tooltip 残留交互层与 ref | 已关闭内容退出 DismissableLayer 交互栈，同时保留退出动画；稳定 composed ref 避免层更新时销毁真实焦点节点；`tooltip-layer-lifetime-proposal/`、`tooltip-ref-source-repair/`、`tooltip-ref-lifetime-review.md` |
| iframe 原生前进 | 独立 A/B 证实本机 Chromium Translate 气泡抢走 opaque iframe 后的焦点；仅自有临时浏览器 profile 设 `translate.enabled=false`，16例保留；没有改产品焦点或缩遍历。`iframe-browser-environment-resolution.md` |
| 键盘量具、端口、格式 | 物理 iframe 转移计数修复、composer 3370/3371 工厂变量接线、I18N 表格格式、收集文档与三份 backend 依赖交付测试已并入；旧 v10 的五组9文件不再是待应用项 |
| Mermaid 真下载 | detached DOM 通过 XMLSerializer 生成有效 SVG，PNG 走真实 Image/canvas，Unicode/entities/两语言/两视口回归；旧渲染或PNG异步结果在卸载/换码后不下载。正式规格已纳入34完整范围 |
| 导出与消息解析 | Vue 对齐当前 React 的项目/文档上下文剥离与 fenced/indented literal 保护；reasoning code 边界、meaningful-answer 分组、澄清继续、Markdown 标题与 CSV split CRLF 均有根因回归。`export-rendering-contract-resolution.md`、`source-contract-review.md` |
| 消息 run owner | 从真实 runner 的不可变 active-run assistant IDs 经 composable/父组件进入 MessageList/动作；历史缓存与伪SDK metadata helper 的行为转到真实消费者；两主题 held-SSE 浏览器用例保留。`message-copy-owner-resolution.md` |
| artifact 字节与 registry | 原字节 SHA256、BOM/无WebCrypto/空文件、完整性/修订与编辑状态；tool_artifacts 从 wire 到实际 badge/视图/历史；`artifact-byte-revision-resolution.md`、`tool-artifact-registry-resolution.md` |
| Showcase 完整状态 | 单一 public snapshot 提供 title/messages/artifacts/todos/goal/registry，不回退私有工作区；同步退休/AbortSignal/晚返回及真实 TodoList 保留；52/52公开资源两端路径和字节相同。`showcase-snapshot-resolution.md`、`r11-candidate-v75-review/showcase-resource-current.json` |
| API 与 owner | 语音片段、`/context`、调度目录标题、子任务、共享展示偏好、上传/项目/memory/Agent/models/WeChat/MCP/extensions 错误展示按实际消费者核对；workspace changes 回归统一认证fetch；Sidecar使用既有session owner；`source-contract-review.md` |
| Lark 晚返回与复制完成 | 状态失效/刷新覆盖真实 QueryObserver 持有的 refetch；mutation 发起身份、cancel 后 owner 核验、账号切换与卸载拒绝晚写；两端 clipboard 完成也受账号/组件/流程生命周期约束。`lark-post-refresh-resolution.md`、`lark-copy-react-red/`、`lark-copy-react-green-local/` |
| 技能详情重开 | 关闭后退出动画内容移到静止鼠标下触发 hover-open 是根因；内容只有打开时才能续期，trigger仍正常；真实 RED1FAIL2PASS→GREEN3PASS，永久3DOM与4双端转移回归。`skill-menu-lifetime-review/`、`current-fix-followup/` |
| 调度复制误报 | Clipboard API 缺失不得显示 Copied；真实写入成功/拒绝语义保留；RED1FAIL2PASS→GREEN3PASS，新增永久3DOM。`scheduled-copy-review/` |
| 交付接线 | React Docker COPY patches、Compose rebuild/exclude、CI双事件和12 watched前缀；v73三份真实 backend pytest **32 PASS**只代表定向交付检查，实际Docker/全后端仍待 |

`r12-comment-followup` 四处注释已在 v74/v75，**不要在原工作区重复应用该旧方案**。真实行为、声明与收集数量以 v75 为准，不把较早文档中的“仍未修复/运行中”当当前状态。

### 3.1 F03–F14 的本轮证据与未完成部分

以下全部来自已关闭的 `native-complete-v4`，计数按规格分别列出，不能重复相加当作额外通过项；它们是193 PASS的一部分。F编号解释仍见旧交接，当前状态由本表覆盖。逐规格全部216身份及实际attempt分类见[复核清单](evidence/resume-2026-10-24/handoff-document-review/README.md#完整原生34规格结果)。

| 历史编号 | v75本轮实证 | 尚未关闭 |
| --- | --- | --- |
| F03 Tooltip | `tooltip-presentation` 3 PASS；`disabled-agent-tooltip` 4 PASS | 全部浮层/窄屏/视觉矩阵及最终整体验收 |
| F04 普通键盘 | `keyboard-order` 1 PASS，含原844遍历；技能新增正式规格4 PASS | 当前整轮未完成；不能据局部通过接受其余布局/弹层 |
| F05 Markdown | `markdown-rendering` 10 PASS | 最终全量、平台与视觉证据 |
| F06 Mermaid | `mermaid-fullscreen-owner` 4 PASS；`mermaid-image-export` 10 PASS | 最终全量及其它产物/媒体；不再把旧PNG四项失败写成当前未修复 |
| F07 / F08 引用弹层/拓扑 | `popup-capacity-reflow` 12 PASS；`topology` 5 PASS | product1110及所有后端/权限拓扑 |
| F09 / F10 焦点/三轴容量 | `focus-capacity-regressions` 10 PASS；`triple-keyboard` 3 PASS（负控加双端422遍历） | 三轴overlay有1中断/1未运行，panel8/reflow3/viewport2/workspace8未运行，完整分组见第2节 |
| F11 / F12 / F13 页头/iframe/量具 | `chat-header-layout` 10 PASS；`artifact-frame-keyboard` 2 PASS；`keyboard-measurement` 12 PASS | iframe相关浏览器环境及Layer ref根因已处理；最后同源聚合仍待 |
| F14 通知生命周期 | `notification-lifecycle` 16 PASS | 原工作区正常安装、完整双端/容器与最终生命周期验收 |

## 4. 历史结果必须分开保留

- 2026-10-20 v10：完整163项为133 PASS/6 FAIL/1 interrupted/23 UNRUN，exit130；这是历史真实失败加用户暂停，不能改写。其问题已由本轮候选修复和新运行覆盖。
- 本轮 v73 `native-complete-v3`：187 PASS/1 FAIL/1 interrupted/23 UNRUN，exit130。唯一实际失败为844遍历中两个技能 Tab 转移；根因方案完成后主动停止旧失败源并从 v75 重新全跑，不是本次用户暂停造成。
- v74 full unit 中的文档收集事实失败已经在 v75 按实际新增4例修正；原失败回执保留。
- Stage55 React 326文件3001PASS；Vue497文件4138PASS与完整canonical/assets/consumer/audit；旧完整双端986PASS/21FAIL/1UNRUN、只有156视觉对。全部是历史源证明。
- 最近完整后端仍是 Stage54：27149PASS/414既有SKIP，blocking235PASS，lint/format退出0；本轮不能以32定向PASS替代新的完整后端。
- F01草稿期限、F02编辑器/搜索/括号/redo/Escape已进入原工作区。F03–F14、P01/P02及本轮新增修复均仍须最终同源整体验收。P03保留原0.02阈值，旧约0.03失败不能忽略。

F01/F02的历史证据分别为 `docs/reports/evidence/resume-2026-10-18/f01-deadline-green/`（4文件65PASS）和 `f02-native-editor-panel-ownership/`（14原生PASS）；后一个短路径同属 `resume-2026-10-18/`。本轮完整 `code-editor` 18 PASS另有当前原生记录，两者不混算。较早Stage43完整临时失败目录本次只读核实已不存在；当前4GB保全仅覆盖列明的本轮文件，不能外推为所有历史轮次附件齐全。旧证据可取性限制与已保存的侧栏原始附件见复核文档；恢复时继续按R11/C11核对，缺失原件如实登记，新复现不冒充旧原件。

历史完整入口：[2026-10-20交接](2026-10-20-vue-whole-plan-paused-handoff.md)、[Stage55交接](2026-10-18-vue-whole-plan-paused-handoff-stage55.md)。旧“待并入11文件”、v10五组9方案、旧待应用CI注释已过时；253当前差异清单是唯一集成依据。

## 5. 已准备但未应用的清理与一个真实缺陷

完整清单、preimage hash、拟议字节和diff：`r11-retirement-followup/proposal.json`、`files/`；暂停保全有50文件hash索引。**当前未应用，不能算代码完成。**

- 14删除：孤立的 model filter/command-score及只测旧算法的1个测试、ThreadChannelIcon、SettingsActionDialog、client-translations/resolve、旧json/uuid工具、5个无人导入的私有L3 barrel（artifacts/models/mcp/memory/tasks）。删除依据包括2650代码文件/7375边/84入口的AST接线、动态入口和Nuxt自动导入规则、实际消费者复查；不能由零引用字符串搜索单独决定。
- 8替换：实际i18n plugin/loader/AppearanceSettings消费者测试及cookie测试、两处旧owner注释、ARCHITECTURE/I18N_INVENTORY、standalone复制工具和永久回归。10项实际i18n方案测试PASS；旧算法8例与孤立resolver2例随死实现退休，真实UI/浏览器/模型功能回归保留。
- 正常 pnpm 移除 Vue 直接依赖 `best-effort-json-parser`、`uuid`；package/lock尚未改。检查真实依赖图和lock差异，不能顺带升级无关包。
- **standalone实际缺陷**：旧copy过滤只列举固定dotenv名称，漏掉3个owner（root/frontend-vue/backend）下12个变体组合，如 `.env.development`、`.env.test`、`.env.production.local`、`.env.staging`。只用合成sentinel复现，未读真实私有值。实际旧helper加永久测试3FAIL2PASS→拟议修复5PASS；方案识别这些owner的`.env`/`.env.*`并保留`.env.example`，原配置不修改、不移动、不改gitignore。
- 独立公共L1/L2出口、生成type/真实compile-time contract、公开Showcase、实际model favorites、仍用原生Resizable的M0保留，不误删。

应用顺序不能倒置：**v75完整原生PASS → 精确集成253份 → 原工作区正常依赖安装及三包入口校验 → 应用22目标与正常pnpm remove → 新Stage56冻结与全部最终门禁**。当前工具 `apply-reviewed-retirement.py` 默认只预检，`--apply` 才修改；依赖安装回执与入口校验是强前置。不要提前修改正在冻结验收的候选，也不要删断言绕过前置。

## 6. R11 审查完成到哪里

`r11-candidate-v75-review/whole-wip-current-map.json` 枚举原1269公共WIP，含22原删除和2份原工作区独有历史交接（后者不是删除）；253候选增量与全部原WIP是两种口径。

已保存候选增量有界审阅、AST接线、8组非module审查、21工具/配置源码审查、14聊天组件改动及其消费者、6份指南改动/逐字移动段落。旧watched审阅103项中87项同字节；旧条件审阅152绑定中103同字节，只有哈希相等的有界审阅可以继承，49变化项不能继承。

**R11未关闭。** 接线图不等于语义正确，旧审阅也不等于新运行通过；当前映射仍有**306条**产品/配置记录没有`sourceReview`标记；已有标记也只代表其列明的有界审阅，并非整个文件或运行已经关闭。暂停前对认证/session/query又做了部分只读核对，未生成完整闭环收据，不可把这些阅读算成已关闭。九架构、CI12前缀、dirty/untracked拒绝和全部剩余矩阵仍要完成。

## 7. 恢复第一步和准确顺序

**暂停期间不得执行本节；等待用户明确恢复。**

1. 读本文、`pause-preservation/summary.json`、`ACTIVE-NEXT.md`、`current-findings.json`；核分支/HEAD/main/索引/私有hash、原5744公共输入、v75全部5790输入与253preimage、proposal22目标、端口与临时副本。旧PID仅作历史记录，不直接重用。
2. 副本仍在且完整，则复用；丢失按第11节从持久包恢复。核v4结束回执、216身份、34规格、source/path集合相等以及用户暂停分类。**v4不完整，不允许直接集成**；先核v75完整单测/静态及focused-v8的同源与辅助输入、安装入口/依赖归属，再以新目录从头跑原34规格：`python3 docs/reports/evidence/resume-2026-10-24/run-native-complete.py native-complete-v5 candidate-v75 native-focused-v8`。这个入口不把v4的130当PASS；保留旧收据。若新目录名已存在，选下一个未用编号。只有新整轮216身份、全部原844和三轴宏完整、零FAIL/SKIP/flaky、source/path集合不变才进入下一步。真实失败按根因处理，用户中断不伪装成产品失败。
3. 在仓库根执行 `python3 docs/reports/evidence/resume-2026-10-24/integrate-candidate.py candidate-v75 native-complete-v5 --dry-run`，审查253目标后去掉`--dry-run`执行精确集成。工具逐文件备份原WIP，仅移除Nuxt诊断`buildDir`行；backend只准入列明的3份交付测试，不笼统放开。
4. `python3 docs/reports/evidence/resume-2026-10-24/update-original-dependencies-after-pause.py candidate-v75`：两端正常frozen/offline安装，Vue strict peers，保护Git/私有/公共输入。然后 `node docs/reports/evidence/resume-2026-10-24/verify-original-patched-entries.cjs` 校验三包6个CJS/ESM+2个Layer类型入口，并确认Dialog/Tooltip共享同一Layer实例。两工具本次未执行。必须使用这个 after-pause 版本：新增本交接属于公共输入，旧安装工具的5744输入清单会拒绝它；新工具仅按最终handoff-audit中的精确路径/hash纳入本文，保持其余源/路径/私有/Git检查，且前置失败不创建空执行目录。差异见`pause-preservation/dependency-resume-admission.diff`，没有执行安装。
5. `python3 docs/reports/evidence/resume-2026-10-24/r11-retirement-followup/apply-reviewed-retirement.py` 预检，审查后加`--apply`；再通过 `scripts/pnpm.py --dir frontend-vue` 正常remove两项直接依赖，审查lock、i18n实际SFC集合、格式/类型与行为。不要手工改依赖目录，不假定删除后单测数量，按实际收集说明变化。
6. 只有以上完成，才运行 `docs/reports/evidence/root-stage56-cross-app-checkpoints/prepare-source-copy.py` 新建真正最终副本，再正常准备物理依赖并绑定所有Stage56工具。**不要重跑 `resume-2026-10-18/prepare-stage56-tools.py` 覆盖已准备工具；不要拿旧manifestSHA运行未绑定工具。**
7. 保留 Readabilipy prewarm、受控synthetic Git readiness、正常依赖入口/符号链接归属、backend browser extra/匹配Chromium，再开始门禁。浏览器聚合使用独立物理副本及其依赖/构建目录；同副本重型任务顺序执行，端口不同不能隔离`.next/.output`。
8. 完成第8–10节所有范围。若发现问题，按实际根因修复、保留有效RED/GREEN并重新冻结受影响最终输入；不移植旧PASS，不以定向测试代替完整门禁。没有完整闭环不能宣布完成。

工具均在持久证据目录，但“脚本已准备”不等于“已执行”。原集成、原依赖安装、入口校验、22目标应用、新冻结均尚未运行。

恢复前还要核对实际工具绑定：`verify-original-patched-entries.cjs` 只从旧 `candidate-v47-patched-entrypoints.json` 继承Sonner记录；Tooltip/Layer使用 `tooltip-ref-source-repair/frozen-installed-entries.json` 的最后批准字节，不能拿v47的旧Tooltip/Layer哈希验收。三份后端集成准入仅为 `backend/tests/test_frontend_dockerfile_cache.py`、`test_dual_frontend_production_ingress.py`、`test_vue_gate_ci_coverage.py`（后两项同目录）。新运行label变化时，后续集成参数必须使用实际成功的label；本次没有执行dry-run或任何集成步骤。

## 8. W00–W13 整体状态

| 工作包 | 已实施或候选覆盖 | 最终仍须完成 |
| --- | --- | --- |
| W00 基准/契约 | 三端范围、OpenAPI/JSON实际消费者、18配置当前收集、冻结与退出码 | 最终全部拓扑、CI及契约事实一致 |
| W01 账户/偏好/features | session owner、RBAC、locale/timezone、字段PATCH/204、功能能力分离 | auth21/真实SQLsession8，503/403/409、跨tab/账号与恢复 |
| W02 run/消息 | gap/durable/END、create/join/stop/dispose、human ID、附件owner、真实run assistant归属 | protocol/real/双端完整，无重复create或旧owner污染 |
| W03 产物/预览 | bounded/Range/SHA/完整字节/保存锁、编辑器、iframe、Mermaid真实导出及资源退休 | 全媒体/异常/P03，全部视觉矩阵与手工审图 |
| W04 输入/模型 | 草稿、引用/知识、reasoning、语音/润色/上传、命令菜单 | 完整输入/模型/弹层和真实提交，授权/IME/取消/持久化 |
| W05 能力/Agent/知识 | catalog/RBAC、Skill409、Agent定义包/display_name、知识与技能菜单 | 各实际拓扑、安装/OAuth/知识范围/冲突/权限完整回归 |
| W06 历史/来源/未读 | activity、虚拟化scroller、删除部分失败、归档分页、source/registry历史 | 分页/prepend/追尾/resize/跨owner/恢复与事件位置 |
| W07 调度/channel | prompt/events/history分页、queue/DST/秒精度、通知/复制、后台owner | scheduled/channels等真实聚合、冲突/取消/深链/切任务 |
| W08 扩展宿主 | inline/assets模块图、页面/导航/动作/mentions、abort/dispose | 完整权限/晚返回/卸载/实际Docker消费 |
| W09 项目/文档/trash | 四tab、instructions、上传/附加/预览/转换/恢复/部分失败 | 完整项目/trash双端和真实Gateway权限、冲突与分页 |
| W10 Browser/Sidecar/设置 | binary/legacy帧、WS owner、面板resize、Sidecar session、memory/subagents | 八后端拓扑/external，关闭重开/重连/资源释放/权限 |
| W11 Showcase/UI | 完整公开snapshot与52/52资源、Markdown/代码/图表、键盘/弹层候选 | 751对/1502PNG、Linux、人工审图与全部主题/语言/尺寸矩阵 |
| W12 架构/历史负担/CI | owner收敛、Pinia/Splitpanes/孤立缓存退役、正式依赖修复接线 | 22目标与两依赖清理、九架构、全WIP/CI/独立交付 |
| W13 全量验收/同步 | v75冻结、定向与全单测、当前原生诊断与持久保全 | 精确集成、新Stage56、R04–R12、C01–C13和文档marker |

逐项细节仍保留在[原计划](2026-10-09-vue-period-plan.md)、[全进度与问题索引](2026-10-10-vue-plan-progress-and-issues.md)、[完整W细项映射](evidence/resume-2026-10-20/handoff-document-review/README.md#原计划细项映射)。映射中的具体权限、分页、冲突、DST、消息/附件、extension host、知识、项目/trash、WS/资源和负控条件均不能用本表摘要替代；其旧候选/结果状态由本文更新。

## 9. R00–R12 完整剩余门禁

| 项 | 恢复后要求 |
| --- | --- |
| R00 | 现场/原WIP/私有/index/候选/归档hash与服务归属再核；新恢复授权与旧暂停分清 |
| R01/R02 | P01 MCP容量、P02侧栏横滚修复保留，纳入最终整体验收 |
| R03 | 先从头重跑被暂停的完整34规格并通过；候选精确集成、原依赖同步/实际入口核验、22目标清理、新Stage56源/依赖绑定；本阶段尚未整体关闭 |
| R04 | Vue完整verify、asset/consumer/audit/OpenAPI+extension fixture/icons；React完整check/unit；全部18配置收集；backend四分片make test、blocking、lint、ruff format-check |
| R05 | 原 `make -j1 -C frontend-vue e2e-cross-app`：product1110→auth21→真实SQLsession8；原完整键盘/三轴均保留；751对/1502PNG全解码/尺寸核对/零接受台账和人工审图 |
| R06 | mock560（main512）；protocol/real/scheduled/channels/agents/settings/shell/browser八拓扑24；受控external3；Darwin P03仍用0.02。新收集变化要说明根因，不静默减项 |
| R07 | Playwright1.59.1 noble ARM64镜像SHA `b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`、Node24.14.1、host IPC；8visual/12payload+asset，额外8/12捕获与9图人工审阅 |
| R08 | 新standalone default与with-e2e两fresh拓扑，正常install/fullunit/build；后者完整mock/backend。只有React-dependent parity允许collection-only |
| R09 | Docker六phase：build-vue/build-react/probe/probe-oidc/smoke/normal-stop；真实canonical build/engine COPY/双host/nonroot/SQL SIGTERM |
| R10 | 标准dev-vue/dev-dual/prod-vue，原30/300/180秒预算；注册/me/permissions/preferences204、单SSE/context/三建议、提交刷新持久化、同owner正常stop与SQL；3000/AiPPT先核恢复 |
| R11 | 九架构、全WIP与候选及清理语义/消费者审阅、CI12watched前缀；upstream-drift --accept拒绝dirty/untracked，不绕过、不自行commit/push |
| R12 | W/R/C/九架构/共同矩阵逐项关闭，源码/文档/命令/revision一致；代码、本地集成、外部生产准备分列 |

Stage56工具位置（全部相对`docs/reports/evidence/`）：

- `root-stage56-cross-app-checkpoints/`：prepare-source-copy、prepare-frozen-dependencies、run-frozen-gate、正式附件保全与PNG核验。当前仍未有最终`copy-path.txt`绑定。
- `2026-10-18-linux-stage56/`；`container-ingress-stage56/`。
- `local-entry/stage56/`、`local-entry/stage56-dev-dual/`、`local-entry/stage56-prod-vue/`。
- `resume-2026-10-18/backend-full-stage56/`、`resume-2026-10-18/standalone-round56/`。
- 编辑器取图工具`resume-2026-10-18/capture-editor-visuals-stage56.py`已修精确`./support/test`导入；`resume-2026-10-24/stage56-editor-observer-review/`只证明准备。Linux7源码锚点同样只是静态就绪，均不能当运行PASS。

**仍需绑定的确切位置：** `resume-2026-10-18/backend-full-stage56/run-backend-full.py` 以及 `standalone-round56/` 的 `prepare-outer.mjs`、`capture-outer.py`、`run-standalone.py`，均含 `UNBOUND_STAGE56_MANIFEST`；standalone目录同属 `resume-2026-10-18/`。`container-ingress-stage56/freeze-binding.json` 和 `local-entry/stage56/binding.json` 已有等待模板，均为 `WAITING_FOR_ROOT_FINAL_FREEZE`、snapshot为null；**`local-entry/stage56-dev-dual/binding.json` 与 `local-entry/stage56-prod-vue/binding.json` 尚不存在**，各自的 `source-copy.py` 却必须读取它们。恢复到新最终源冻结后，先按各自consumer要求建立这两份绑定，再绑定实际manifest、snapshot、工具与依赖归属；现有container绑定脚本只覆盖container与普通stage56，不会自动生成这两份。当前不能称所有入口已就绪，旧Stage55回执不能替代。

人工选样：`resume-2026-10-18/visual-review-stage55/plan.json`，重新绑定新源。18双端矩阵=36图；4成功附件=8图；8编辑器格式/主题×两端×Source/Edit=32人工选样；编辑器完整观察14case×两端×两模式=56图；Linux9图。成功态附件必须实际落盘/readback；选样不替代751完整对、静图不替代动态owner/WS。

## 10. 九架构、共同矩阵与 C01–C13

九架构均需最终运行闭环：消息虚拟化真实scroller；聊天编排/草稿提交与adoption；唯一状态owner；query identity/features/mutation发起身份；Lark单流程owner；孤立代码与真实消费者；重复算法的真实行为差异；历史叙事/门禁/负控/失败归档；必要UI适配/原生焦点与键盘。

共同矩阵保留：同Gateway/seed/权限/字体/浏览器/时钟，中英×明暗×桌面/手机和真实主题限制；loading/empty/error/selected/disabled/hover/focus；低高度、200%文字、双向resize、各类弹层/表单/多面板；直达/刷新/返回/深链/404；跨tab/用户/线程/Agent与真实持久化；离线/超时/鉴权/资源消失/冲突/SSE中断/部分上传/授权过期后的继续操作；资产成本、长会话、本地/独立/Compose拓扑。

| 关闭条件 | 必须保留的依据 |
| --- | --- |
| C01 | 全范围页面/入口/动作，只有三项排除；R05–R07/R11 |
| C02 | Showcase所有公开案例/资源/只读与UI；写操作另走真实验收 |
| C03 | 全WIP已接线验证或有依据移除，无悬空半迁移 |
| C04 | P01–P03、F01–F14及本轮新增问题根因/永久回归 |
| C05 | gap/durable/human ID/run input/附件，无重复create或旧草稿假提交 |
| C06 | 偏好/locale/timezone、引用授权、三套reasoning、知识、Agent/来源/未读 |
| C07 | 调度/channel、项目四tab/trash部分失败、扩展完整宿主 |
| C08 | 功能/流程/行为/UI全部双端、751/1502、人工审图，无新增豁免 |
| C09 | 九架构/历史负担、唯一owner、真实消费者与必要无障碍 |
| C10 | 当前backend REST/SSE/JSON、持久化/取消/异常恢复 |
| C11 | 完整verify/浏览器/backend/visual、CI接线与可取失败现场 |
| C12 | Vue构建、无React独立、本地三入口与容器各自实证 |
| C13 | 文档/源码/命令/结果/marker一致，未授权提交不绕过dirty拒绝 |

这些最终关闭条件仍 OPEN，表示最终证据未齐，不表示实现全部未写。真实IdP、LLM、IM、DNS/TLS、外部代理及远程CI没有实际观测就保留 **UNOBSERVED**，不以本地受控测试宣称生产环境完成。

原计划的验收可信度条件同样保留：audit逐条核advisory ID、影响版本与实际调用路径，历史audit通过不等于零漏洞；收集失败、缺React、视觉探针变异及新advisory负控必须仍能拒绝坏输入。核对verify/mock/real/external等CI失败上传与可取trace/截图/视频/日志，远程未观测则单列。frontend/backend/contracts的marker分别审阅，历史不可达/兄弟缺席/脏基准保持UNKNOWN或REVIEW_REQUIRED。成本优化只复用相同源码和构建参数，记录耗时/资源；不同鉴权/代理/degraded拓扑、完整范围和原预算不删减。

## 11. 持久保全、Git 与副本恢复

Git：`main-wc`；HEAD `a7804539530846baecf548af7b5d2612deb89b68`；main `5ecc1c2ac2de624af354bc515d5cb04f80df226c` 是HEAD祖先；无unmerged；索引SHA `109661be26054eff97a2c4ceee44d5bc6833a6dd6ac2a8ecb507f77bea854969`。暂停前原5744公共输入与253候选preimage核验不变，私有配置与hook不变。新增本交接不伪装成旧冻结输入。

持久目录：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-10-24/pause-preservation/`。

原暂停快照记录本轮自有进程20→0，3370/3371/8260已释放。20:07只读观测时3000端口为AiPPT，但前后PID从84205变为26597（该进程20:04:44启动）；变化原因未调查，**不能声称原进程未变**。本任务唯一信号发送给已核实的测试CLI 53495，没有对AiPPT执行停止/启动。当时cwd及只读身份见`pause-preservation/external-port3000-review.json`；下一次仍要重新确认可恢复性。原暂停时11个历史计划容器全部Exited，协调快照为无活动子代理或goal；本次文档复核没有重新探测进程/端口/容器，也没有启动后台工作。不要把历史PID或容器快照当作未来操作依据。

- `candidate-v75-public-source.tar.gz`：5790成员，逐成员hash已验证；51,883,021字节；SHA256 `63c373d4d58f0103a668f39fdadccfd8f7768eb11969a8d88ecc35096314bb03`。含5788公共源和2个与公开example完全同字节的运行夹具；不含原私有值、Git历史/index、node_modules/venv/build/cache。
- `source-preservation.json`：manifest/归档hash、两个fixture及唯一Nuxt诊断变换。`candidate-v75/files/`还保留253差异原件。
- `pending-proposal-inventory.json`：22目标的50方案/回执文件，14删除/8替换，全部未应用；不是删掉必要功能/验收。
- `native-cases.json`、`native-artifact-inventory.json`、`native-preservation.json`：本轮216项逐项结果、持久trace/附件索引；定向辅助配置另存`focused-auxiliary/`。已索引206文件/4,057,630,948字节，包含原报告与本轮实际产生的trace附件；保全不表示整轮通过。
- `source-boundary-before-handoff.json` / `source-boundary-after-handoff.json`：原源码、候选、Git/私有配置保护；`host-before-stop.json` / `host-after-stop.json`记录本轮进程归属和端口，不能未来直接使用旧PID。
- `resume-tools-inventory.json`保留97份恢复/Stage56工具输入指纹；`receipt-count-review.json`复核7份同v75直接回执；`disk-space.json`记录收尾时磁盘余量，恢复重型构建前重新检查，不自行清理历史现场。
- `pause-request.json`、`summary.json`、`handoff-audit.json`：用户暂停范围、正式停点、链接/范围/结果/恢复材料核对。最终文档核验绑定本文hash；不构成产品验收PASS。

临时副本若丢失：先校验归档和manifest，逐成员安全恢复到新的自有`/private/tmp/deerflow-next-final-stage56-*`目录；禁止绝对路径/`..`/符号链接成员。保留5790路径、两个公共fixture，归档已含唯一Nuxt buildDir，不重复插入。不要从原工作区重新冻结冒充v75，否则253份未集成修复会丢。

为新目录生成新的`restored-source-frozen.json`（5788copyRows+2fixtureRows、原source/新copy/旧parentCopy、v75与归档hash），建立独立公共Git索引，无原Git历史或remotes。正常运行`prepare-restored-dependencies.py <新目录>`准备两端/backend browser extra与实际shim归属，保存新的安装回执；不要删除旧`dependencies-ready.json`强行复用旧前置，不手修shim/符号链接。这个工具会核查读取到的恢复元数据，必须是新的v75元数据。

旧v75 manifest/native receipt绑定旧路径，**不能就地改写它们或拷贝旧PASS冒充新运行**；恢复后明确登记新候选/恢复身份，按当前工具的路径前置建立合法新回执并重跑需要的定向/完整原生后再集成。若旧目录仍完整，则直接核验复用最省事。本次未执行新目录恢复演练，不声称已实现一键恢复。

**下一窗口恢复指令：**读 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-24-vue-whole-plan-paused-handoff.md`，恢复整个Vue/React/backend对齐、架构和历史负担清理计划，不能缩水。先核暂停现场与全部hash，按第7节从头完整重跑被用户暂停的34规格；原工作区还未集成候选，22目标清理未应用；完整R04–R12、W/C/九架构/共同矩阵全部保留。不得拼接旧PASS、改变阈值/预算、跳过未运行项。
