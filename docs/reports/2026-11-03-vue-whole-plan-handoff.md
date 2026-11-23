# Vue / React / backend 全计划交接与全面复核（2026-11-03）

**当前状态：HANDOFF_READY / IMPLEMENTATION_NOT_RUNNING。按用户要求整理交接，源码及失败现场原样保留；本轮只做文档、只读核验与持久归档，没有继续实现或启动产品验收。后续收到继续指令后，从第10节恢复。整个计划未完成、未最终验收、最新联合候选未集成原仓。**

本文件覆盖整个 **W00–W13、R00–R12、C01–C13、九项架构和完整共同矩阵**，不是仅本轮身份观察任务。当前总计划仍在 **R03**；仍有代码实现、代码审查、局部运行与整套验收工作，不能说“代码全部写完，只剩校验”。没有可靠的工作量加权百分比，不用局部测试数量或已写代码比例推算总进度。

本文替代11月1日交接和11月2日中间台账的**当前状态与恢复入口**。历史 PASS/FAIL、原始报告与失败原件保持其原时点，不重写为最新通过。旧文档中“尚未实现registry/Content-Location修复”和“reader还未写”等描述已过时；本页明确区分已实现、已限定接受与最终未验收。

## 1. 路径、阅读顺序与范围

| 名称 | 绝对路径 / 用途 |
| --- | --- |
| ROOT 原工作区 | `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`；保留原产品WIP、私有配置和Git现场 |
| 本交接 | `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-11-03-vue-whole-plan-handoff.md` |
| COPY9 当前唯一续作候选 | `/private/tmp/deerflow-restored-s7-public-source-l27y902m`；含累计修复和未接受run-consumer-v4 |
| H03 本次持久保全 | `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/handoff-2026-11-03` |
| N02 11月2日执行证据 | `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-11-02` |
| N01 11月1日执行证据 | `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-11-01` |

表内缩写只为阅读方便。后文证据链接均落在持久ROOT；候选源可由H03新归档恢复，不依赖临时目录永久存在。

阅读顺序：本文 → [当前状态](evidence/resume-2026-11-02/current-state.json) → [本次保全核验](evidence/handoff-2026-11-03/README.md) → [run consumer当前台账](evidence/resume-2026-11-02/run-consumer/README.md) → [原完整计划](2026-10-09-vue-period-plan.md)及第7节所有工作包/细项 → 适用根/模块AGENTS与Vue架构/行为合同。以源码和实际证据裁决，文档只导航。

### 不变的用户要求与授权

- React `frontend` 是参照，Vue `frontend-vue` 在**功能、流程、行为、UI样式**上可平替；结合backend真实 REST/SSE/JSON、鉴权和持久化。允许必要Vue重构与历史负担清理，必须修根因，维护性优先。
- 唯一排除：Vue首页内容、docs/blog内容站、整站无后端静态部署。Showcase必须对齐。完整键盘/焦点/三轴/响应式仍保留；用户曾明确选择继续全验收，不能因非核心而删减。必要无障碍不能未经证据批量删除。
- 不扩大allowlist、抹动态ID/未知字段、删失败请求、吞错、任意延时、假返回成功、缩减矩阵或改预算来通过。用户允许少量预算超出，不允许以预算牺牲可维护性。
- 正式依赖源码修复使用pnpm patch/lock；已授权Sonner、Radix Tooltip/DismissableLayer、Happy DOM、Nextra、Streamdown memo、Reka Tooltip，以及已审查的FocusScope/Dialog修复。不建npm私仓、不手改node_modules交付。旧Streamdown表格patch已由公开组件扩展替代，不复活。上游修复与本仓维护修复分别表述。
- 用户已授权必要本地执行/浏览器沙箱外运行和子代理独立审查。本轮仅使用只读检查与文档审查，不把广泛权限解释为继续启动验收。后续仍按任务范围执行，无需重复索取已有授权。
- 不自行commit/push/新建分支/拉上游/更新同步marker/清理WIP。在哪个分支修改，获准提交时就在该分支提交。根跟踪`.env`、`config.yaml`、`extensions_config.json`政策保持，不复制真实密钥到归档或测试副本。
- 本地React **3200**、Vue **3100**；AiPPT **3000**不得动。Docker内部3000和测试端口有独立用途，不能批量替换。当前浏览器门禁使用3440/3441/8340。
- 主代理唯一产品/测试写入者，子代理只读审查并写自己的证据；同副本Nuxt `.nuxt/.output`、React `.next`的构建与浏览器门禁串行。不同端口不代表构建隔离。冻结期间不改源码。

## 2. Git、原仓与候选的准确关系

本次实时核验：原仓 `main-wc`，HEAD `a7804539530846baecf548af7b5d2612deb89b68`；`main`=`5ecc1c2ac2de624af354bc515d5cb04f80df226c`，是HEAD祖先，无未解决merge。原仓相对origin/main-wc ahead753只是本地Git现状，不表示本轮提交了753次；本次没有fetch确认远端新状态。

原仓5837个既定公开源输入、Git/index/私有配置hash/hooks与N01保护基线一致。ROOT大量WIP既有且必须保留；本次只增加/完善文档和证据。候选5964公共文件+2 example fixtures、31实际runtime入口、14依赖输入与run-consumer-v4冻结一致。[核验回执](evidence/handoff-2026-11-03/protection-before.json)。

最新候选差异按明确公开源集合重算：[待集成清单](evidence/handoff-2026-11-03/pending-candidate-inventory.json)、[逐文件diff](evidence/handoff-2026-11-03/pending-candidates.diff)。共有 **159 changed +129 candidateOnly +2 originalOnly =290** 条差异：

- 候选侧288条中，`frontend-vue/nuxt.config.ts`的隔离buildDir差异必须排除，其余**287条为待语义审核的候选路径**，不是已批准整批应用。
- 原仓独有的10月27/29两份交接文档保留，不能按候选缺席删除。11月1日及以后新增交接/证据也不在旧5837基线里，必须继续保留；290不是全工作区文件差异总数。
- 旧11月1日“237差异/236待审”已被本次重算更新；不要直接累加各阶段package的路径数。run-consumer-v4的27条只相对run-projection-v4，不是原仓总待集成数。
- 只有完整R03闭环后才有界集成原仓、正常锁安装并生成统一新冻结；不能用旧Task7/8副本整树覆盖。

## 3. 已完成：更早实现与11月1日局部闭环

以下均为各自源码上的**限定结果/历史结果**，不是新统一源的最终全量PASS；原始失败与桥接条件保留。详细历史见[10月29交接](2026-10-29-vue-whole-plan-paused-handoff.md)、[11月1交接](2026-11-01-vue-whole-plan-paused-handoff.md)。

| 已做工作 | 已有实现与证据 | 仍须保留的限制 |
| --- | --- | --- |
| main同步与早期W包 | main已在main-wc历史；原仓已有253份v75集成、20有效提案、22历史目标退休（14删除/8替换）、Vue两项直接依赖清理 | 不重新应用；uuid有传递消费者不能重删；HTML SSR提案已证伪、旧归档owner方案已被替代 |
| 早期公共能力/UI | COMMON35、渲染器64、Streamdown memo7、OIDC并发首次登录、消息布局/CI、React3200 | 见[10月27交接](2026-10-27-vue-whole-plan-paused-handoff.md)第3节application；不升级为当前全验收 |
| Task1 初始焦点 | Vue radio根因修复、UI223、原生22，integrations6个首焦点差异关闭 | 完整键盘组合仍待最终验收 |
| 账户刷新/分页owner | HTTP/network/parse暂态保持身份、raw cursor；Vue679/React36及真实双端刷新/草稿/切换 | 最终全auth/SQL/退役仍须重验 |
| Task2 Agents门禁 | 真实pending/disabled/直达/子路由，相关223及完整native10 | 不以features请求数替代门禁行为 |
| Task3 项目首次创建/契约 | 真实归属/创建、session/CSRF/Gateway/SQL8；相关完整React84/Vue74 | 原v1 React7失败、v2环境零执行均保留 |
| Task4 焦点生命周期/React guard | Reka FocusScope同激活修复、CJS/ESM实际入口；原生55；React Dialog/Sheet原生75 | 后续Task6扩大包后已做组合，不能退回旧方案；可选host-swap建议不是已复现缺陷 |
| Task5 当前会话删除 | Vue路由取消owner、React keyed editor/账户revision与请求退休；最终组合1567 React通过 | 旧五项失败中有真实跨账户漏洞，不能统称夹具问题 |
| Task6 通用关闭焦点 | N01 memory-close-fix：完整17规格99PASS、React13/Vue19框架PASS、72附件 | 已做限定native，不是仍待首次验证；最终全量仍开放 |
| Task7 路由head/真实路由身份 | [限定验收](evidence/resume-2026-11-01/route-head-fix/ACCEPTANCE.md)：18规格109PASS/84附件，相关React1283、mounted47 | 早guard/真实空线程失败原件保留，不从旧Needs fixes候选恢复 |
| Task8 Showcase能力/历史保留 | N01 showcase-capability-fix：完整native64、Vue最终138、duration负控恢复18 | React88与Vue138绑定各自冻结；不把137P1F历史改绿 |
| Task9 初始滚动/选择/Sidecar开关 | [限定验收](evidence/resume-2026-11-01/initial-scroll-fix/ACCEPTANCE.md)：native145/108附件、Vue124、React100精确未变输入桥、mounted61/related1774 | 真实CSS动画owner根因及多轮旧失败保留；全共同矩阵待重跑 |
| 工程清理 | [限定验收](evidence/resume-2026-11-01/final-cleanup-fix/ACCEPTANCE.md)：CI分组、主机pnpm、路由guard、文档/旧warning；guards331/CI199/backend27312P414SKIP/blocking235/静态，React正常fresh strict安装 | v4冻结时序/v5等价格式桥接有记录；不是最新5964文件源上的全backend重跑 |
| 11月1身份基础 | lossless请求表示；thread/human/Memory/replay来源；transport nonce/ACK/seal/census/BFCache；consumer lease；22固定slot；fresh Page私有构造证明 | [11月1第3节](2026-11-01-vue-whole-plan-paused-handoff.md)及其全部独立报告；unit270/native44/actual12为当时结果，不是当前整体通过 |

N01自然BFCache和受控活动SSE已局部验证；后者证明观察器清理不截断其夹具流，**不能替代实际安装SDK/adapter活动SSE**。SW仍缺真实浏览器证据。default-off、raw事实与semantic投影分离、异常进入正式判据的约束继续有效。

## 4. 已完成：11月2日限定增量

每行链接的ACCEPTANCE记录准确冻结、运行命令、桥接和独立复核；不要把多个阶段测试数相加。早期报告的“下一步”是历史叙述，当前以本页第5/6/10节为准。

| 增量 | 已完成与门禁 | 明确未覆盖 |
| --- | --- | --- |
| [Content-Location保真](evidence/resume-2026-11-02/content-location/ACCEPTANCE.md) | 去掉URL重写导致的相对/绝对、dot segment/fragment信息损失；271 unit、静态3、45native、12actual、独立复审 | 不是run handle采用证明 |
| [Initial registry](evidence/resume-2026-11-02/registry/ACCEPTANCE.md) | initial main/agent +uploads-limits准入；309unit、静态3、历史raw5、独立审查 | aggregate、通用owner未闭合 |
| [Initial projection](evidence/resume-2026-11-02/projection/ACCEPTANCE.md) | 精确Request/固定槽三视图投影，任何错误整批literal回退；338unit、静态3、45native、12actual | Sidecar search正文parent_thread_id仍literal、网络全事实仍不同 |
| [普通发送来源](evidence/resume-2026-11-02/human-submission/ACCEPTANCE.md) | human.submission尾部message/default key分支；Vue408/React458、静态、45native/12actual、源码与原件审查 | 不改变header/UUID/重试；来源事件不代表HTTP成功 |
| [Memory dispatch](evidence/resume-2026-11-02/memory-dispatch/ACCEPTANCE.md) | Settings→mutation→API→真实fetch前观察、弱引用pending/normalized、selected/retired/preAbort；Vue488/React178、静态、45native、36actual | 通用并发/取消未关闭；旧33P3F完整保留 |
| [Human admission](evidence/resume-2026-11-02/human-admission/ACCEPTANCE.md) | draft→persisted同owner采用、独立send动作/Request候选域、key分支；445unit、静态、45native输入桥、20actual；4capture129请求仅14授权槽改变 | 单稳定owner首发；不是任意同形HTTP因果证明 |
| [Memory admission](evidence/resume-2026-11-02/memory-admission/ACCEPTANCE.md) | 单发布文件/稳定账户/有限重试；545unit、静态、旧raw14；最终source-presence冻结Vue648/React491、45native/20actual；10capture176请求仅6fact叶子+8thread槽 | 后续replay-projection使用的Memory10回放是6正例+4缺fresh proof预期拒绝，不能记成10个正例；多文件并发/账户仍开放 |
| Replay来源存在性/实际基础操作 | [来源台账](evidence/resume-2026-11-02/replay-source-presence/README.md)、[基础矩阵](evidence/resume-2026-11-02/replay-actual/README.md)：Vue自持两文件、guards21、双production基础8PASS、独立审查 | 来源变体/长流/全T矩阵仍开放；旧沙箱启动失败不改为产品通过 |
| Replay reader/统一请求域 | [来源reader](evidence/resume-2026-11-02/replay-admission/README.md)、[候选域](evidence/resume-2026-11-02/submission-domain/README.md)：版本、wrong method/额外prepare、原source presence/完整候选域独立复审 | 不直接授权任意run、cursor |
| [Replay HTTP v3](evidence/resume-2026-11-02/replay-http/ACCEPTANCE.md) | 742unit、静态4、actual8、源码/原件审查；326请求与16背景取消保留 | 单稳定账户/已存literal thread/单操作，prepare/run是route fixture |
| [Replay claims/projection v6](evidence/resume-2026-11-02/replay-projection/ACCEPTANCE.md) | 780unit、静态4、raw replay8/human4/Memory10；actual8/16附件、两独立审查；只12槽（8replacement+4Vue key），React regenerate零决策分支不变 | 不消除React无key/Vue有key的实际区别；不授予新run消费者权限 |
| [Run source v3](evidence/resume-2026-11-02/run-source/ACCEPTANCE.md) | exact原POST成功CL/target/prefix/encoded/suffix；851unit、静态4、历史raw12、独立审查 | 不要求SSE结束，不读第二流；公开headers可能合并行，非原始header唯一性证明 |
| [Run claims/CL projection v4](evidence/resume-2026-11-02/run-projection/ACCEPTANCE.md) | **最后限定接受基线**：899unit、静态4、raw12、actual8/16附件、代码/实际独立审查；326请求74body，只旧12槽+8CL，其他原值保留 | handle adoption、join/cancel/cursor、active SSE尚未被本次签收覆盖 |

最后限定接受基线：N02 `package-run-projection-v4`，source SHA `429551e4468510e5e55036d71aa019e55a174dc995d4b12a184ad46398e7ecce`，runtime SHA `3dffc06ff04372d1b8e62d0695cc718b9e09e062ac9ed11fdbc0078a187374e7`。不是应回滚到此包：当前后续工作必须保留。

## 5. 进行中的真实现场：run-consumer-v4（未接受）

### 5.1 三个状态必须分开

| 层级 | 准确状态 |
| --- | --- |
| 最后限定接受 | 上节run-projection-v4，仅run来源与CL精确投影 |
| 最近实际浏览器执行 | **run-consumer-actual-v3：28项=16PASS/12FAIL**，102附件，源/runtime不变；4普通首发+8replay因root未接run phase验证而失败；不是v4运行结果 |
| 当前磁盘代码 | **package-run-consumer-v4**：27差异路径（8新增），5964公共+2fixture；新reader/root/spec已写、33专测和1632相关单测通过，静态失败；没有v4实际浏览器通过回执 |

当前source SHA `2a4e4c40eeb274401ba847ce50d3b68f69e9b0b2c311ab60c5e8bed195620f60`；runtime SHA `af13ebbba799dc13350b487f26a8dda8a05de801beb2184b1b809c129bf8d565`。完整[27路径before/proposed清单](evidence/resume-2026-11-02/package-run-consumer-v4/package-manifest.json)及[冻结源](evidence/resume-2026-11-02/package-run-consumer-v4/source-frozen.json)保留。

### 5.2 已写的代码与职责

- 两端`core/diagnostics/run-observation.ts`：绑定实际human/replay input对象，WeakMap记录精确来源，WeakSet记录已发起对象；default-off先退出再读getter。拒绝重复/未来追补绑定，调用后输入被替换会invalid。`run.bind/called/received/delivered/retire`保留真实phase action/time与原sourceAction；unowned不删。无新增wire字段/header/UUID、无第二SSE reader。
- React `src/core/api/api-client.ts`：外层call-time捕获input，内部generator保持原惰性网络；sanitize后校验同一input；onRunCreated记录实际meta、原callback正常返回后才delivered。`threads/hooks.ts`管理独立run lifetime，不能在submit Promise finally退休；replay scope/新提交/卸载及owner cleanup已有退休接线；账户/Suspense等跨层完整矩阵仍待验证。
- Vue `useThreadStream.ts`绑定最终input；`run-protocol.ts`记录实际解析handle；`thread-runner.ts`捕获调用、按generation防迟到交付，onStart正常返回后delivered；reset/dispose/abort退休，自然结束不借finally退休。stop-during-create可能早于此delivered，尚不能宣称已验证最早采用。
- v4新增`frontend-vue/tests/e2e-parity/support/identity-run-adoption.ts`：root在全claims校验后统一验证全部run事件、独立sdk/adapter声明、精确source/owner/Request/handle、事件顺序与dispatch时间、active与退休。拒绝未声明/额外/重复/不明phase；有错清空adoptions/全部decisions，三视图literal回退。它不是忽略新事件的白名单，也没有赋予join/cancel/cursor权限。
- `identity-registry.ts`接内部admission；`identity-receipts.ts`固定事件字段；replay reader只分离明确五phase，仍由新root全量核验。两实际spec要求独立expected run/transport并附adoptions；33专测覆盖正例/缺失/重复/错owner/错transport/时序/退休/整批回滚。

上述是**当前实现说明**，不等于新reader已完成独立正式代码验收。设计入口：[实现审查](evidence/resume-2026-11-02/run-consumer/implementation-review.md)、[reader设计](evidence/resume-2026-11-02/run-consumer/adoption-reader-design.md)。设计原先建议外部wrapper；当前选择root内统一admit模式，需复核完整inventory只读一次与无重复build的边界。

### 5.3 最后门禁及可直接恢复的失败

| 回执 | 结果与含义 |
| --- | --- |
| [adoption专测](evidence/resume-2026-11-02/run-consumer-adoption-unit-v1-command.json) | 33PASS；仅该reader/root单测，执行早于v4冻结；已包含在1632中，不另加总 |
| [v4 Vue相关回归](evidence/resume-2026-11-02/run-consumer-vue-unit-v4-command.json) | **102文件1632PASS，directExit0**；parity+agent-deerflow+chat，不是canonical全部Vue测试 |
| [v4静态](evidence/resume-2026-11-02/run-consumer-static-v4-command.json)及[原日志](evidence/resume-2026-11-02/run-consumer-static-v4.log) | **directExit2**；lint先通过，typecheck-tests三错，后续format-check/standalone-check未执行 |
| v3 React/静态 | v3 React567/check通过；v3→v4只6个Vue harness/doc文件变化，React输入未变可明确桥接，不得叫v4重跑；Vue v3静态4通过也不能抵消v4失败 |
| [v3实际报告回读](evidence/resume-2026-11-02/run-consumer-actual-v3/readback.json) | 16P12F/102附件，v3 source/runtime保持；三端口已关，失败仍有效 |
| [v3源码独立审查](evidence/resume-2026-11-02/run-consumer/observation-code-review-v3.md) | 仅R1/R2修正/观察实现限定通过，明确集成失败；不是新v4 reader正式接受 |
| v4原件纯回放、实际浏览器、最终独立review | **UNRUN / NOT ACCEPTED**，恢复后新label运行，不能覆写v3 |
| 实际SDK/adapter active SSE off/on | **仅设计，未实现、未运行**；完整24组合仍未验 |

三处类型失败精确位置（均在COPY9）：

1. `frontend-vue/tests/e2e-parity/support/identity-run-adoption.ts:139` TS18047：`run.candidate.request.startedAt`可能null。
2. 同文件`:140`同样TS18047。
3. `frontend-vue/tests/unit/parity/identity-run-adoption.test.ts:54` TS2345：number|null传给number。

下一步应在真实时间字段验证后建立可被类型系统识别的有限number局部值，并明确null/NaN等拒绝测试；不能用`!`、`as number`、默认0/当前时间绕过。此次交接**没有修正这些代码**。33和1632是运行单测通过，不抵消编译失败。

### 5.4 必须保留的失败经过

原run SDK RED首次sandbox监听EPERM不是业务RED；沙箱外真实3FAIL后初轮通过。Vue adapter有2个有效RED。独立审查又发现React lazy前payload.input换对象、Vue creating回调晚绑定借未来来源，两轮冻结负控分别3P1F、2P1F；已修exact input与禁止补绑。SDK最初RED归档因未来路径不存在失败，最终包在测试后/修复前归档，不冒称测试前冻结。

v1 Vue1598中sandbox假上游12EPERM，原命令许可环境1598PASS；v1 React5个旧事件数量/action断言失败和9 lint、v2 React两个meta.thread_id类型错误均保留。v3再跑Vue1599/React567与静态通过后，实际28才暴露reader未接的12FAIL。v4补reader后止于当前静态三错，未跑新浏览器。不能将整个过程描述为“只剩一两条格式问题”或“全部修复已通过”。

## 6. 尚未完成：R03内剩余实现与验证

1. **完成当前run phase链**：解决v4三类型错；重跑完整相关单元/静态；用新的raw脚本回放v3真实human4/replay8原件并独立固定期望；代码复审；冻结后完整两spec28项（新增用例按实际collection）原生重验，所有附件回读；再次独立实际证据复核。不得拿旧raw回放当新浏览器。
2. **真实SDK/adapter活动流透明性**：[active SSE设计](evidence/resume-2026-11-02/run-consumer/active-sse-fixture-design.md)仅设计。用真正socket、阶段gate与实际production proxy；第一片/Stop可见时seal+dispose观察器但保留Page，继续第二片和自然end；被动同一Request终态witness不读第二流。先main普通on/off×两端4条验证，再完成普通main/agent+edit/regenerate main/agent×on/off×两端24组合。固定完整响应或route.fulfill不证明活动流；Node fixture不等于真实backend。
3. **run消费者/cursor/初始恢复**：同run join/cancel/stop-during-create、旧/恢复run/active和retired、cursor独立来源；不能凭raw等值或CL就授予任意消费者权限。terminal/EOF/reader释放需各自证据，ERR_ABORTED不设通用豁免。
4. **Sidecar独立owner**：独立协议/账户/agent/线程；POST search的metadata.parent_thread_id现仍literal，两端requests可相同但requestBodies/requestFacts不同。没有证明就不能加槽抹差异。
5. **普通human/Memory/replay复杂来源**：真实并发/多文件/账户切换/取消/迟到route/lease/project、native draft→persisted、source variants/历史消息类型/引用边界；单稳定owner/账户和基础8矩阵不能代表全部。Memory cancel/并发覆盖preview的静态风险还未证明正常入口可达，仍需调查，不冒称已复现或已修。
6. **全T01–T18/T06和aggregate**：[完整设计矩阵](evidence/resume-2026-11-01/typed-identity-current-review/design-review.md)、[registry记录](evidence/resume-2026-11-01/typed-identity-fix/REGISTRY-IMPLEMENTATION-NOTES.md)。包括AAB/ABB全关系、同raw/不同kind/alias冲突、错target/CL、漏证/多文档/前置请求、跨capture、退休/晚到、未选Memory/碰撞、真实SW等。aggregate capture目前仍literal，新增专测调用registry/projector不等于正式全矩阵已接入；错误必须进入正式diff判据，不能只放附件。
7. **有界集成与最终新冻结**：所有根因/相关原生/review闭环后，按本次287候选路径及后续新变化更新清单，保护ROOT私有配置与WIP，排除Nuxt隔离buildDir；正常安装、记录全源与实际runtime，才执行R04–R12。

身份比较不变式：独立场景/动作给语义锚点；初始来源允许真实React entry/Vue settle时序差但不按时钟/UUID排序配对；完整同capture/document/exact consumer与候选域证明；raw↔semantic双向碰撞，alias只显式边；原内容/query编码/multipart/未知字段/失败关系保留；React无key/Vue有key不伪造相等；任何缺证独立失败，不能两边同坏相抵。fresh Page只证明构造来源，不独自证明owner。早期设计中“fresh即owner”和“按producer action直接配key”已被否决。

补充未关闭的multipart实际producer边界：[运行边界审查](evidence/resume-2026-11-01/typed-identity-current-review/multipart-runtime-boundary-review.md)。native-wire-v2的5PASS只证明已有拦截拓扑的字节保真及裸HTTP缺字节时拒绝；真实project-document-upload双端producer的3状态×3维度仍须完成。不能将请求表示lossless误写为所有浏览器拓扑都能取得文件正文。

### 6.1 T01–T18逐项恢复清单

以下保留完整矩阵的原合同；已有局部结果只逐格标注，不把整项默认升级PASS。

| 编号 | 不能遗漏的合同 |
| --- | --- |
| T01 | 空draft真owner A、两消费者都错用已mint B仍失败；unused/unknown mint不准入 |
| T02 | StrictMode/discarded render/重复effect/重渲染与Vue persisted setup/dispose不造新实体 |
| T03 | main/agent/showcase、stale params、pathname/window双时序、encoded-new/一次解码/离开未知路由，观察不改行为 |
| T04 | 同ID native adoption/同active stream不重挂；project加删替换/同flush A→B→A退休 |
| T05 | account/agent/route/delete→new/unmount/late create与callback；旧scope不授新请求、不改焦点 |
| T06 | 请求早于publish的同commit因果；未来owner不得追认旧请求；有限一致性≠通用HTTP所有权 |
| T07 | 固定错thread、A创建B请求、两owner互换、跨kind/raw双认领、distinct raw不合并 |
| T08 | failed/cancel/缺response/逆序/同key多请求，attempt/admitted分开，晚回仍属原owner |
| T09 | 新human/旧replay/server replacement、错kind、additionalInputMessages、同human复用与独立submission |
| T10 | key absent/present/empty/显式同值、错human/跨提交、header-body对调；POST不盲重试、GET同run join |
| T11 | CL错thread、run错join/cancel、缺头/错误status、cursor非runID；开放SSE不阻塞seal |
| T12 | UUID/prefix/已登记ID/canonical marker作为内容、未知字段、own __proto__、JSON额外key和array顺序原样 |
| T13 | query编码分隔碰撞/重复query/百分号/单解码/外origin/path segment，typed token无字符串碰撞 |
| T14 | Memory原index/literal/generated/选文件/取消late text/normalize/截断碰撞/撞literal；相同content不合并 |
| T15 | body AAB vs ABB、header-body配对、失败/空body/请求多重集，展示去重不破坏verdict |
| T16 | multipart仅boundary独立例外，binary/filename/MIME/order保真；裸HTTP Chromium缺字节仍缺证，不当无body |
| T17 | default-off/错version/closed/observer throw/overflow；无产品global表，真实off/on wire/导航/焦点/存储/流一致 |
| T18 | capture/scenario/account/context隔离，finally部分收据+原error，timeout/parse失败可见 |


## 7. 全计划工作包与最终关闭条件

原计划导航：[完整计划](2026-10-09-vue-period-plan.md)、[逐工作包/九架构/共同矩阵/C条件映射](2026-10-10-vue-plan-progress-and-issues.md)、[W00–W13详细契约索引](evidence/resume-2026-10-20/handoff-document-review/README.md)。以下摘要不替代原文细项。历史文档中的缺陷状态、数量和临时路径以本文及对应新回执更新；未列入摘要的原验收义务不因此取消。

| 工作包 | 已有实现/局部证据 | 最终仍需关闭 |
| --- | --- | --- |
| W00 基准/契约 | OpenAPI/JSON、源码与实际入口冻结、拓扑收集 | 最终新统一源/所有拓扑/文档/CI/契约一致 |
| W01 账户/偏好/features | session/RBAC/locale/timezone/204、账户缓存暂态修复、Agents门禁 | 原仓集成、全auth/SQL/跨tab/账户退役/异常恢复 |
| W02 run/消息 | gap/durable/END/create/join/stop/dispose、human/附件/bridge/cache、创建归属 | 完整协议、真实run，零重复create/旧草稿/owner污染 |
| W03 产物/预览 | Range/SHA/BOM/修订/保存锁、编辑器/iframe/Mermaid | 全媒体异常/P03/完整视觉/动态owner/资源释放 |
| W04 输入/模型 | 草稿/知识/reasoning/语音/润色/上传/mentions/命令菜单 | Showcase capability已局部通过；全部IME/授权/取消/提交持久化 |
| W05 能力/Agent/知识 | catalog/RBAC/Skill409/Agent包/display_name、门禁和初始焦点局部通过 | 全安装/OAuth/范围/冲突/权限和最终keyboard |
| W06 历史/来源/未读 | activity/分页/归档/source/registry/cache、删除owner局部及组合修复 | 最终prepend/追尾/resize/跨owner/恢复和删除原生重验 |
| W07 调度/channel | events/history/queue/DST/秒精度/通知复制/channel owner | Task9已局部通过；最终滚动触发详情、完整调度/channel/深链/冲突/取消 |
| W08 扩展宿主 | inline/assets模块图/导航/动作/mentions/abort/dispose | 最终权限/晚返回/卸载及真实Docker消费 |
| W09 项目/文档/trash | 四tab/instructions/上传/预览/转换/恢复、创建归属和mock/SQL局部闭环 | 完整双端/Gateway权限/冲突/分页/部分失败 |
| W10 Browser/Sidecar/设置 | binary/legacy/WS/resize/Sidecar session/memory/subagents | Task6已局部通过；最终组合原生、重连/关闭重开/释放/权限/八拓扑 |
| W11 Showcase/UI | snapshot52、Markdown/图标/表格/字体容量、多项原生闭环 | Task7/8/9已局部通过；全部751对1502图/人工矩阵/键盘三轴 |
| W12 架构/历史负担/CI | 22目标退休/两个直接依赖/唯一owner/正式依赖修复/八组CI | 最终九架构/新候选归并/guard与命令清理已局部通过；最终组合/依赖维护/独立交付 |
| W13 全量验收/同步 | main已在main-wc历史、旧完整门禁/容器/三入口/归档 | 新统一源R04–R12、全部C条件与marker；不自行提交 |

| 步骤 | 恢复后保留的完整执行义务 |
| --- | --- |
| R00 | 重核原分支/index/private/hooks/public/WIP、归档SHA、服务归属；不能沿用旧PID |
| R01 | MCP容量P01完整验收，保留原预算/负例，不复活旧临时方案 |
| R02 | 横滚P02及P03相关约束保留，真实scroller和原生验证 |
| R03 | 已知根因修复/独立review/相关原生完成后，有界集成原仓、正常安装、生成新最终冻结 |
| R04 | 完整canonical verify、React、backend四分片+blocking/lint/format、check/audit/contracts/实际collection/icons；含受控core OpenAPI、独立扩展schema、真实tarball消费者安装/类型/运行，以及当前构建asset budget，见下方精确入口 |
| R05 | 全cross-app product→auth→SQLsession；新增数按实际collection，含三轴/751对1502图/零接受/人工审图 |
| R06 | 全5配置mock聚合、八backend拓扑、external；原mock565/backend24/external3仅历史数，保留所有新增与原错误/预算策略 |
| R07 | Linux正式visual8/payload12/assets及9人工图，实际源码和原生依赖执行身份绑定 |
| R08 | standalone default / with-e2e两个fresh目录、正常安装/全部unit/build；后者全mock/backend；仅缺React跨端允许collection-only |
| R09 | Docker七阶段：engine-context实际COPY、build-vue/build-react/probe/probe-oidc/smoke/normal-stop；canonicalGateway/双host/nonroot/SQL/退出码 |
| R10 | 原dev-vue/dev-dual/prod-vue标准入口及30/300/180秒预算；真实注册/me/权限/204/SSE/建议/刷新/stop/SQL，React3200 |
| R11 | 九架构、全部WIP有界语义审查、CI12前缀/两事件/全部规格恰好一次、dirty/untracked拒绝、失败材料可取 |
| R12 | W/R/C/九架构/共同矩阵逐项证据；文档/源码/命令/revision一致；本地集成与真实外部生产分别列 |

R04易遗漏的入口仍按[原计划“执行命令、环境与gate顺序”](2026-10-09-vue-period-plan.md)执行：根目录 `make -C frontend-vue export-openapi-check audit consumer-check`，以及在frontend-vue内执行 `../backend/.venv/bin/python scripts/export-openapi.py --check-extension-fixture`。core导出必须隔离runtime home、固定 `plugins: []`、显式控制webhook；扩展示例不得污染core快照。consumer-check须真实打包、安装、类型检查并运行最小session；OpenAPI生成通过不等于SSE合同通过。`make -C frontend-vue asset-budget`必须检查当前参数/源码匹配的构建产物，不能拿旧`.output`通过；audit保留advisory＋版本＋可达性判断。

### 7.1 易在摘要中遗漏的原计划细项

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

### 7.2 九架构、共同矩阵和关闭条件

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

## 8. 历史完整门禁不能改绑当前源

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

本段为10月28–29日历史收集；11月1日cleanup已重新完整收集18配置1880项、parity82规格1239项，见第3节工程清理及其ACCEPTANCE。尚未执行的是其后身份增量的最终全18配置收集，不能恢复旧1824作为当前总数。

历史收集原件均在 `docs/reports/evidence/resume-2026-10-28/`：[current-collection-after-project-focus/execution.json](evidence/resume-2026-10-28/current-collection-after-project-focus/execution.json)记录2026-10-28 21:59+08全18配置1824（parity1187/session16/mock517）；“新增规格未做全18汇总”仅是该旧快照时的状态，后来已有上段11月1日cleanup的1880项收集。[ci-ownership-after-memory-spec29.json](evidence/resume-2026-10-28/ci-ownership-after-memory-spec29.json)记录2026-10-29 12:16+08只读观察77个parity整文件分入8组各一次、interactions64；它不是当前最终全部新增规格清单，也不是远程CI执行。

视觉完整范围仍为751对1502 PNG：逐key/文件/解码/尺寸/缺失/额外，另做已承诺人工18对36图、4成功附件8图、8编辑器格式主题×两端×Source/Edit的32选样（完整编辑器14case56图）、Linux9图。已有采样不能称1502全人工。当前diff测语义/几何/选定computed styles，不是整图逐像素自动比较；截图失败可能不使主diff失败。Darwin P03阈值仍0.02，旧约0.03失败不能接受。

751对/1502图是必须保留的完整历史范围，不是最终案例数量上限；最终按当前registry、实际collection和完整矩阵纳入全部新增案例，不能截取固定数量或用旧清单漏掉新增场景。S15历史751个key中556非零差异的FAIL也不因当前局部PASS被撤销。

真实外部LLM、IM、IdP、DNS/TLS、外层代理、远程CI仍 **UNOBSERVED**。受控本地Gateway/IdP/replay通过不能提升成这些生产环境通过。Stage43旧临时失败原件缺失的历史限制仍存在，本轮新保全不能补称它已恢复。


## 9. 新持久归档、现场保全与证据完整性

新保全根H03：[README](evidence/handoff-2026-11-03/README.md)。本次按显式清单逐文件hash、逐tar成员内容/路径/类型/唯一性回读；没有整树归档私有信息，也没有安装、恢复演练或运行产品测试。

| 材料 | 当前值 / 边界 |
| --- | --- |
| [候选完整公共源码归档](evidence/handoff-2026-11-03/candidate-public-source.tar.gz) | 5964公共+2与example逐字一致fixture；52,505,519 bytes；SHA `6d1e02d21dce8df254b81a1635f73c7c267a78f76977affdb31169ac9c5747cd` |
| [归档输入](evidence/handoff-2026-11-03/candidate-public-source-inputs.json) / [归档回执](evidence/handoff-2026-11-03/candidate-public-source-receipt.json) | 全成员已回读，源前后未变；新路径恢复+依赖安装演练 **NOT_RUN** |
| [source冻结](evidence/handoff-2026-11-03/source-frozen.json) / [runtime冻结](evidence/handoff-2026-11-03/runtime-frozen.json) | 原v4文件逐字保存；31runtime与14输入当前匹配，不代表复制node_modules即可恢复 |
| 原仓旧公共归档 | N01/pause-preservation-2026-11-01/original-public-source.tar.gz，5837，SHA `659367052b366e177ceb39d7294f38f2eba5b6bcc3d5d1ec28f32853f8044857`；本次原仓公开输入逐一核验未漂移，旧归档仍作历史恢复参考 |
| [候选差异清单](evidence/handoff-2026-11-03/pending-candidate-inventory.json) | 290差异，287候选待语义审查，1隔离排除，2originalOnly保留；不是应用授权 |
| [旧状态文档快照](evidence/handoff-2026-11-03/previous-documents/current-state.json) | 更新live current-state前保留原v3状态及两README；旧运行证据不改写 |
| [只读宿主快照](evidence/handoff-2026-11-03/host-check.json) | 2026-11-03 18:02+08：本仓/候选匹配进程0，29任务容器均未运行；检查端口中仅3000另一个node PID27590监听；未发任何信号/容器操作 |

归档排除真实`.env/config.yaml/extensions_config.json`、Git/index/hooks、node_modules、build、运行数据及历史evidence；仅两公共example副本fixture进入。历史执行证据在ROOT另行保留；别把“公共源码完整归档”说成包含全部运行数据/生产数据库/私有配置的整机备份。

本次宿主快照未发现本任务原仓/候选的活动测试或产品进程，任务容器均未运行；11月2两条末尾命令均已结束，不能再等旧session。3000当前PID与旧记录不同，恢复时必须重新核服务归属，不能kill历史PID。此次独立审查只读、不启动共享构建。[独立证据完整性审计](evidence/handoff-2026-11-03/evidence-integrity-audit.md)已核27浏览器报告、190命令收据、977存档附件声明/1350项SHA声明均匹配，未发现存档缺失或不匹配。原report引用的66个临时路径已不存在，但对应持久存档均完整；不把它们误报成存档丢失，也不与Stage43历史缺失混淆。190命令的129次exit0/47次exit1/14次exit2仅是收据盘点，不是门禁通过率。全文审计见[全范围审查](evidence/handoff-2026-11-03/whole-plan-independent-audit.md)与[当前阶段审查](evidence/handoff-2026-11-03/current-stage-independent-audit.md)，最后文档完整性回执与源码保护复核单列，**这些不是新产品PASS**。

## 10. 下次恢复的逐步操作

1. 读本文和当前状态，检查用户最新要求；先核Git、ROOT5837基线/新增用户变更、index/private hashes/hooks，检查COPY9、source/runtime/依赖及服务归属。不要直接复用历史PID或把旧端口关闭当当前事实。
2. COPY9存在且匹配v4即可继续。若临时目录丢失，先核H03归档/输入/回执SHA，再运行H03 `restore-public-source.py candidate-public-source`恢复到新临时目录。该助手只恢复公共源，不初始化Git、不安装、不启动、不改ROOT。**此恢复助手本轮只复用并检查，未在新目录实际演练**。
3. 新副本建立新来源manifest/公共Git fixture与正常锁安装：host pnpm经`python3 scripts/pnpm.py --dir frontend|frontend-vue install --frozen-lockfile --strict-peer-dependencies`，两端均显式保留strict peer；backend按锁装browser extra/匹配Chromium。依照N01 dependency preparation的真实合同核shims/import归属、14输入31runtime/CJS-ESM及Readabilipy准备，不复制旧node_modules或私有配置。旧prepare脚本限制s7前缀并读取final-source-frozen，**不能对新restore路径原样运行**；先新建受审的新准备入口，保留旧回执不改。
4. 立即从第5.3节三处类型失败恢复（修真实校验/类型收窄），保持负控；先冻结新候选，再继续完整相关单测和静态，检查log directExit。N02 `run-check.py`、`freeze.py`等读取N02 `copy-path.txt`；N01部分runner/config硬编码旧COPY9/输出目录。新目录必须复制并审查整套新绑定，不能只换manifest或旧copy-path就冒称恢复成功。
5. 用新label保存run-consumer reader原件回放。输入是N02/run-consumer-actual-v3/report-artifacts中4个observed-first-send parity-network原件和8个actual-replay原件；由report-preserved找到准确路径并核SHA。源human/replay/knownrun期望独立给出，不信derived.expectedViews。旧run-projection raw脚本只是参考，复制新版本，不覆写执行过的脚本或旧输入清单。
6. v4修复形成新版本后冻结，独立源码审查；用N02 `run-identity-products-native.py LABEL SOURCE_MANIFEST RUNTIME_MANIFEST identity-producers identity-replay-producers`跑完整原2个spec文件、28个case集合（按最新collection纳入新增并核数量）。正式实际执行按已有授权在可启动Chromium环境，源/runtime冻结期间不编辑；随后用`readback-browser.py`按其实际参数回读结果/附件/端口。读runner接口再调用，不照抄过时signature。失败也先保全/readback再改源。
7. 完成第6节active SSE及所有剩余T矩阵、run/Sidecar/owner/aggregate；每项源/门禁/证据/独立review闭环。保留default-off无副作用，不让诊断改变产品调用。
8. 有界集成ROOT，正常安装并新统一冻结；执行第7节R04–R12。跨端product→auth→SQL顺序不省；同副本build串行。最后W/R/C/九架构/全矩阵逐项填真实证据/缺口，文档/源码/命令/marker一致。
9. 更早全量工具的精确导航保留在[10月29交接第8.2节](2026-10-29-vue-whole-plan-paused-handoff.md)：S15/B15/Linux15/Standalone15/D19/local18；全部按当前源/端口/manifest重绑，不能重命名旧PASS。部署外部条件缺失列UNOBSERVED；未获新的明确指令不自动提交/推送或更新同步marker。

恢复后跑测试所用命令必须来自实际文件与Makefile，不能把此文导航当可盲跑脚本；本次没有偷偷修源码或启动下一项验收。存在真实缺陷就修所属契约/owner/lifecycle并保留回归，不拿本交接当接受失败的豁免。

## 11. 仍未关闭的问题和限制总账

| 项目 | 状态 / 恢复要求 |
| --- | --- |
| 当前v4类型三错 | **FAIL**；精确位置第5.3节，首先修并重验 |
| 最新实际28中12失败 | **FAIL保留**；v4 reader虽已写但尚无新浏览器通过；不得标已解决 |
| active SDK/adapter SSE | **UNIMPLEMENTED/UNRUN**；仅设计，4条先行不替代完整24组合 |
| R03整体/T06/T01–T18/aggregate | **INCOMPLETE**；所有局部接受不代表整组完成 |
| ROOT最新候选集成 | **UNRUN**；287待审+后续变化，保留WIP与两originalOnly文档 |
| Sidecar parent_thread_id | **真实保留差异**；不能擅自normalize消除 |
| 通用HTTP归属/Memory复杂并发 | **证据不足**；同形请求有限候选证明的边界仍在，不扩大声明 |
| permissions-mobile | 一次未复现不足关闭；完整矩阵重验 |
| S15全cross-app | 历史1114产品PASS+1完整矩阵FAIL、751键556非零；后auth21/SQL8未跑，最终全套仍未验 |
| P01/P02/P03及F问题 | 依第7/8节原要求与历史根因继续；Darwin P03 0.02不改，旧约0.03不能接受 |
| 历史Stage43原件 | 旧临时失败原件缺失仍未恢复；本次归档不能补称追回 |
| 构建warnings / 条件skip | 按原回执保留；backend414skip/standalone62旧策略不能说零跳过；CI未观察不冒称通过 |
| Windows原生/父进程build中断边界 | 按cleanup ACCEPTANCE记录保留；本次不扩范围实现、不说已验证 |
| 新路径恢复+正常安装 | **NOT_RUN本次**；归档成员已核不等于恢复运行通过 |
| 真实外部LLM/IM/IdP/DNS/TLS/外层代理/远程CI | **UNOBSERVED**；本地受控fixture/SQL/IdP通过不能升级生产结论 |

## 12. 旁支问答与本轮交付边界

用户曾询问项目模型配置。只读检查ROOT当时配置：主语言/推理/读图路径MiniMax-M3；生图image-01、视频MiniMax-Hailuo-2.3、语音speech-2.6-hd、音乐music-2.6-free为生成技能配置/默认调用路径。`ChatOpenAI`是兼容适配器，不代表额外配置GPT。没有为这些问题实际调用付费生成、修改模型配置或扩大三端计划；不是所有模态真实连通性验证。恢复如涉及这些内容应重新读取当前配置，绝不在交接暴露API key。

本次交付只包含主交接、当前状态指针/台账纠偏、独立审查、公开源码持久归档及完整性证据。没有继续产品修改、测试、构建、浏览器、安装、Git提交或服务变更。最后复核以H03的文档核验与保护回执为准；不要把文档审计写成代码独立正式验收。后续可直接要求助手读取本文件并继续整个计划。
