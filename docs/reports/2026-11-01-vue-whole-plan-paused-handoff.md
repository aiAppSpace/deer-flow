# Vue / React / backend 全计划交接（2026-11-01）

**状态：PAUSED_USER_REQUEST / WAIT_FOR_EXPLICIT_USER_RESUME。当前增量已完成限定测试及独立复审，整个计划暂停。仅完成交接保全，不启动下一项实现或验收；最终回执见第9节。**

本文覆盖整个 **W00–W13、R00–R12、C01–C13、九项架构、共同矩阵**。它替代 2026-10-29 交接中的当前状态与恢复顺序；历史文件、原失败和阶段回执保持原样。总计划仍在 **R03**，没有可靠的工作量加权百分比；代码并非全部完成，不能称只剩验收，更不能把局部 PASS 相加为全计划完成。

仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。
本文：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-11-01-vue-whole-plan-paused-handoff.md`。
本轮证据根 **N01**：`docs/reports/evidence/resume-2026-11-01/`；身份增量 **E10**：N01 的 `typed-identity-fix/`。下文缩写是文件位置，不是另一个仓库。

最新补充是用户要求的**仅文档复核**，不是恢复实施或新增验收；[复核记录](evidence/resume-2026-11-01/handoff-document-review-2026-11-01/README.md)记录本次修订及只读完整性检查。下文产品 PASS 均属于暂停前已执行且绑定各自源码的历史结果。原19:49:53 `final-boundary.json`保持原样，本次文档新SHA另存，不能要求修改后的文档仍匹配旧回执。

## 1. 范围、授权与暂停边界

React `frontend` 是参照，Vue `frontend-vue` 的功能、操作流程、行为和 UI 必须可平替，并对齐 `backend` 的真实 REST/SSE/JSON、权限与持久化。依据代码和运行证据；文档仅导航。

唯一排除仍是 Vue 首页内容、docs/blog 内容站、整站无后端静态部署。Showcase、完整键盘/焦点/三轴/响应式均包含；用户明确选择完整验收，不得削减。架构与历史负担从真实 owner/契约/生命周期修复，不吞错、猜字段、补偿请求、扩大豁免、增加任意延时、改预算或跳过原用例。用户允许少量预算超出，但不允许牺牲维护性。

既有依赖修复依旧走正式 pnpm patch/lock，不建 npm 私仓、不手改 node_modules 交付。Sonner、Radix Tooltip/DismissableLayer、Happy DOM、Nextra、Streamdown memo、Reka Tooltip，以及后续已授权 FocusScope/Dialog 修复保留各自提案和锁文件。旧 Streamdown 表格 patch 被公开组件扩展替代，不复活。是否上游已合并以各报告事实为准，本仓修复不冒称官方修复。本收尾增量没有新增依赖补丁。

原分支修改/提交规则保持；**未获要求自行 commit/push**，未创建分支、拉上游、改同步 marker 或清理 WIP。原跟踪 `.env`、`config.yaml`、`extensions_config.json` 策略保持。用户已明确允许子代理独立复审；本轮主代理是唯一产品/测试写入者，reviewer只读复审并写证据。最新暂停指令优先于先前广泛权限，恢复必须等待用户明确指令。

本地 React 3200、Vue 3100；AiPPT 3000未操作。Docker内部3000不能批量替换。本轮实际验收使用自有3440/3441/8340，原生fixture用随机loopback端口。Host pnpm经 `python3 scripts/pnpm.py --dir frontend|frontend-vue`；Vue静态经Makefile。实际源与runtime冻结后测试，失败/退出码/附件不覆盖。

## 2. 原工作区、当前候选与整体进度

原仓 `main-wc` HEAD `a7804539530846baecf548af7b5d2612deb89b68`；`main` 为 `5ecc1c2ac2de624af354bc515d5cb04f80df226c`，已是HEAD祖先，无未完成merge。本轮原仓产品源码/index/私有配置/hooks未动；原仓仅增加文档和证据。11月1日R00公共基线是5837文件，与10月29日5836口径不同。

当前唯一续作候选 **COPY9**：`/private/tmp/deerflow-restored-s7-public-source-l27y902m`。它已含Task6–9、工程清理和本轮身份观察累计增量，**尚未有界集成原仓**。旧Task7/8独立副本不可整树回灌。完整持久归档在第8节，不能只依赖 `/private/tmp` 存活。

| 工作 | 已完成的限定结果与入口 | 仍保留的边界 |
| --- | --- | --- |
| 10月29日之前的实现 | [上轮全计划交接](2026-10-29-vue-whole-plan-paused-handoff.md)第3–4节，含Task1–5、v75/COMMON、端口、正式依赖修复 | 原历史证据，不重应用或提升为当前全计划PASS |
| Task6通用关闭焦点组合 | N01 `memory-close-fix/native-green-v1` 17完整规格99PASS；框架React13/Vue19PASS；72原生附件；限定接受 | 原仓与全量最终验收未完成；不是仍待Task6首次native |
| Task7路由head/真实路由身份 | N01 `route-head-fix/ACCEPTANCE.md`；v7完整18规格109PASS/84附件；React相关1283PASS、mounted47；独立Approved | 旧早guard和真实返回空线程失败均保留；当前不再从旧Needs fixes候选开始 |
| Task8Showcase能力与历史保留 | N01 `showcase-capability-fix/`；完整native64PASS；Vue框架最终138PASS；真实duration负控恢复后18PASS；独立限定接受 | React88与Vue138属各自明确冻结/桥接；不改写旧137PASS1FAIL或筛选负控为全绿 |
| Task9初始滚动、选择、Sidecar关闭重开 | N01 `initial-scroll-fix/ACCEPTANCE.md`；最终native145PASS/108附件，Vue124PASS，React100PASS经精确未变输入桥接；mounted61/related1774；独立接受 | 旧原生多轮失败、侧聊真实CSS动画owner根因保留；全共同矩阵仍待重跑 |
| 工程清理 | N01 `final-cleanup-fix/ACCEPTANCE.md`；CI真实分组/主机命令/guard语义/文档拆分/旧warning；Vueguards331、CI199、backend27312PASS414SKIP、blocking235、完整静态；正常Reactfresh strict安装 | 后端v4冻结写入时序、v5格式等价桥接在该文精确记录；不是本次最终源全backend重跑 |
| 身份观察已完成部分 | 下节列 producer/Memory/replay/transport/BFCache/lease/slot/fresh-page | 整组typed registry/T01–T18仍未接受，原仓集成和R04–R12未完成 |

本轮工程清理时最后完整收集是18配置1880项、parity82规格1239项、八组恰好一次。这是较早冻结的collection，不是当前最终collection或浏览器PASS；身份增量新增测试后的全部18配置仍须最终实际重收集。

## 3. 当前干净点与本轮完成事项

当前冻结：E10 `package-fresh-page-v3/`，累计76个相对cleanup-v5的变化路径，其中31新增；公共源5922＋example fixtures2。源码manifest SHA `3c3e8ce2367f5c75d7d58f1d0fd9ab8618ff7e0351b2c69ad5b4062cb2ffd336`；runtime SHA `ff4a9dbbc35f3e5e712ae950ded46ac0a0e5d67cfdc941a37c483089e1f7e3dd`。76是相对cleanup的累计增量，不是原仓待应用数量。

- 请求URL/query、JSON及multipart已有lossless表达，完整请求body/header/response/failure关系保持，不再按UUID形状抹身份；raw证据与可比较投影分开。**当前Content-Location响应头表示尚非完全保真**：`capture-network.ts`的projectNetwork先new URL再projectUrl，会合并同源相对/绝对头的不同写法；raw snapshot仍保存原头。此新发现只记录，后续projection需修，不能把本局部通过称全部wire保真。
- thread/main/agent、normal human、selected Memory事实、replay来源有只读opt-in观察点。React文件迟到覆盖新选择、prepare/replay退役及共享提交guard等真实产品漏洞已修，分别有mounted/静态/默认关闭native和独立报告。详见E10 README的14:40/14:51 Memory记录、`REPLAY-LIFETIME-SCOPED.md`、`REPLAY-OBSERVATION-SCOPED.md`；不得把这些默认关闭测试称整组opt-in验证。
- transport按capture/document nonce/bootstrap/action、完整收据、有限seal/drain/ACK、导航census和finally保留失败。SPA重叠census误报与自然BFCache退休control清理已修。失败/拒绝/迟到/缺证不转PASS。
- 请求来源只分类main/child/service-worker/unknown，来源读取失败明确invalid；它不能独自证明document或owner。SW真实浏览器并非本轮覆盖，unit证据单列。
- `uploads.limits` 在真实queryFn携带exact候选/选中lease，捕获实际raw/scope/实例/epoch；弃render、未来allocation、旧scope、retired、unowned不洗白。React/InputBox与Vue/Composer/Sidecar真实接线；default-off先准入再读getter；Query key/enabled/retry/staleTime未改。独立 `consumer-lease-implementation-review-v3` 已限定Approved。
- slot小表仅22个明确method/path和固定JSON位置/header角色；未列endpoint、内容、未知key、外origin、非规范编码保持literal。**识别slot不等于准入实体**，`responseSlot=run-location`仅标签，成功状态/target/Content-Location关联还未实现。
- fresh Page工厂执行真实newContext/newPage，通过私有WeakMap一次性证明构造来源，守卫factory→全部观察安装ready的await窗口。旧Page可存raw但无fresh准入，重复消费/前置请求导航/额外Page可见失败。额外Page不无限登记监听。capture、diff成对归档和on/off安装失败路径独立尝试所有cleanup并保留原cause。fresh＋census只限定document来源，**仍不能代替exact consumer与请求归属证明**。
- 活动SSE fixture证明采集seal/dispose后原应用唯一reader仍读到continuation/end，on/off原wire/焦点/存储一致；这不是实际安装SDK/adapter活动流的完整验收。

| 当前收尾门禁 | 实际结果 | 记录 |
| --- | --- | --- |
| 全parity unit | 18文件270PASS；其中slot48、factory8；0fail/skip | E10 `fresh-page-unit-v3-command.json` |
| 本增量Vue静态三项 | lint、test types、format全部exit0；不等于本增量完整app types或canonical verify | E10 `fresh-page-static-v3-command.json` |
| 完整原生fixture | 44PASS、0fail/skip/flaky/retry；51附件逐SHA | E10 `native-fresh-page-v3/readback.json`，SHA `2d2197f23cfabaae3bb3f7a61aecb4502939503a9785b8ab327db2ff11651ea2` |
| 实际React/Vue生产构建及原共享场景 | 完整12PASS；18附件逐SHA；源码/runtime不变；3440/3441/8340已关闭 | E10 `identity-products-native-v7/readback.json`，SHA `b512cef6212af6791007d6c1c7cfbe0c410cba03c3c9da1c1740fdf37eaa7488` |
| 产品相关既有最终门禁 | lease v3 React184文件1636PASS/check；Vue v2 81文件790PASS/完整静态，经精确未变输入桥接到v3 | E10 consumer-lease-v3及独立报告；不冒称Vue在v3重跑 |
| 原仓与候选保护 | 19:36:24回读5924源/fixture、31runtime、14依赖、原仓5837公开文件和全部保护状态一致 | E10 `pause-fresh-page-v3-protection-readback.json`，SHA `80bacb74b56435e085b94025d2996b56b24297300d718511549c9d6803c7bf83` |
| 暂停前最后保护回读 | 19:44:38再次核对同一5924源/fixture、31runtime、14依赖、原仓5837公开文件与保护状态；不是新增产品门禁 | E10 `final-pause-protection-readback.json`，SHA `caaf5e515e95fae7300b69a7182ded4f88110fd09f331f9940ca8d667c8ea6bd` |
| 本收尾独立复审 | fresh-page v3、slot v2附录均限定PASS/Approved；见第9节 | N01 `typed-identity-current-review/` |

actual12覆盖两端main/agent初始与首次发送、Memory所选文件来源、已存agent页面观察on/off wire/UI/focus/storage。只有10项captureScenario使用factory证明；两项on/off保持原独立raw观察，不将它们充作已做registry/活动run归属。

保留失败：slot/factory首次RED是模块缺失的suite失败、0行为测试，不冒称有效行为RED；fresh v1静态3错误、native43PASS1FAIL为重复tracing前提；v2静态7类型错误（非公开listeners与闭包），native44PASS；v3改公开行为验证并lint/test types/format三项静态及44native通过。早期lease默认关闭getter/React错误prop、1635PASS1FAIL的异步编辑器可见结果、census/BFCache前提错误和真实失败都保留在原回执，不覆盖或统称fixture。生产构建的既有sourcemap等warning保留在日志，不写成零warning。

### 3.1 已完成身份子层的证据入口

以下是**不同阶段的限定接受**，不是对最终统一源重跑所有门禁。早期报告中“后续尚未实现”只代表该报告当时状态，当前剩余以第4–5节为准；反之，后续局部通过也不扩大早期报告的验收范围。报告统一位于N01 `typed-identity-current-review/`，表中路径均可直接打开。

| 子层 | 已有证据入口 | 当前边界 |
| --- | --- | --- |
| 请求wire表示 | [wire实现v2](evidence/resume-2026-11-01/typed-identity-current-review/wire-implementation-review-v2.md) | 仍须修第4节Content-Location表示，不能称全部wire已无差异 |
| thread / 普通human来源 | [thread最终附录](evidence/resume-2026-11-01/typed-identity-current-review/producer-implementation-review-v2-thread-final-addendum.md)、[human v3](evidence/resume-2026-11-01/typed-identity-current-review/human-producer-review-v3.md) | 真实producer/mounted及其明确桥接；不代替registry或prepared replay验收 |
| Memory读取及选中文件来源 | [读取生命周期](evidence/resume-2026-11-01/typed-identity-current-review/memory-read-review-v1.md)、[来源v2](evidence/resume-2026-11-01/typed-identity-current-review/memory-provenance-review-v2.md)、[v3附录](evidence/resume-2026-11-01/typed-identity-current-review/memory-provenance-v3-addendum.md) | 默认关闭native的未变输入桥接与后续actual所选文件opt-in分别记；账户/失效/碰撞完整矩阵未关闭 |
| replay生命周期和来源 | [生命周期限定验收](evidence/resume-2026-11-01/typed-identity-fix/REPLAY-LIFETIME-SCOPED.md)、[来源限定验收](evidence/resume-2026-11-01/typed-identity-fix/REPLAY-OBSERVATION-SCOPED.md) | 两者已分别修复/复审；实际prepared replay opt-in和SDK活动流仍待验收 |
| transport / capture | [transport v4](evidence/resume-2026-11-01/typed-identity-current-review/transport-implementation-review-v4.md)、[capture v3](evidence/resume-2026-11-01/typed-identity-current-review/capture-integration-review-v3.md) | 观察传输的限定接受，不是实体归属证明 |
| 导航 / BFCache / 请求来源 | [导航census](evidence/resume-2026-11-01/typed-identity-current-review/navigation-census-implementation-review-v1.md)、[BFCache](evidence/resume-2026-11-01/typed-identity-current-review/bfcache-lifetime-implementation-review-v1.md)、[请求来源](evidence/resume-2026-11-01/typed-identity-current-review/request-source-implementation-review-v1.md) | 自然BFCache局部已实证；SW仅unit，child来源不准许复用parent owner |
| consumer lease / slot / fresh Page | [lease v3](evidence/resume-2026-11-01/typed-identity-current-review/consumer-lease-implementation-review-v3.md)、[slot附录](evidence/resume-2026-11-01/typed-identity-current-review/identity-slots-implementation-review-v2-addendum.md)、[fresh Page v3](evidence/resume-2026-11-01/typed-identity-current-review/fresh-page-implementation-review-v3.md) | 当前干净点；slot未接入身份代换，fresh与lease仍需完整registry准入链 |

## 4. 恢复后的直接位置：typed registry 与 T01–T18

**下一项尚未开始实现的代码是 `identity-registry.ts` / `identity-projection.ts`。** slot文件已实现但尚未用于身份代换；当前requestFacts仍保留raw动态ID，所以不能用未零差异的比较冒称完成，也不能补回UUID折叠。

先读N01 `typed-identity-current-review/`目录内的[registry设计复审](evidence/resume-2026-11-01/typed-identity-current-review/registry-implementation-design-review-v1.md)、[slot复审](evidence/resume-2026-11-01/typed-identity-current-review/registry-slot-review.md)、[transport因果设计](evidence/resume-2026-11-01/typed-identity-current-review/transport-causality-design-review.md)、[fresh document设计](evidence/resume-2026-11-01/typed-identity-current-review/fresh-document-proof-design-review-v1.md)，再读E10 [REGISTRY-IMPLEMENTATION-NOTES.md](evidence/resume-2026-11-01/typed-identity-fix/REGISTRY-IMPLEMENTATION-NOTES.md)末尾修正。早期方案中“fresh即owner证明”“按producer action作初始key”等已被独立复审核否，不能照旧草案直接落地。

必须保持的实现约束：

1. 独立scenario/state/dimension与原业务action提供语义锚点。实际Vue初始来源常在settle:0、React在entry；初始thread用独立initial-entry owner slot，不能用生命周期时序差配key。send步骤、Memory文件原index/action保持各自语义。
2. 同capture、完整单HTTP document/census、fresh来源、main非navigationAPI、真实exact lease/allocation/scope只构成候选证明。请求/consumer用完整指纹的有限候选集；不得按Node到达次序、UUID排序、毫秒宽限或“最近owner”配对。不同owner混合/缺收据/多文档/retired/旧请求仍unresolved；缺证要独立进入verdict，不能两边同坏相抵。
3. raw与semantic-key双向碰撞检查；distinct raw不能合并。human→idempotency仅显式alias边，不以跨kind重复实体开例外。active区间和历史退休定义保留，旧响应仍归原request。
4. 先修当前projectNetwork将相对/绝对Content-Location写法合并的问题，保留原header表示并加入负控，再做类型化投影。run只从同一原POST的成功Content-Location核target准入；错误/缺头/错target不fallback Location，不读第二条SSE。cursor有自己的来源，未证明保持literal。React absent与Vue present Idempotency-Key保持差异，不补头/删头或改变POST重试。
5. Memory使用明确稳定fixture账户＋选中文件来源/原input index；不能猜当前账户。generated:false保持literal；生成ID撞已有literal也失败。prepared/source/replacement/assistant/checkpoint/group不混kind，不凭等值伪造adoption。
6. 原body额外字段/内容、query编码、multipart bytes、未知位置保持原值。全部请求多重集关系不删字段；caption或附件中报invalid不够，必须进入正式diff判据。

后续必须执行完整[原T01–T18矩阵](evidence/resume-2026-11-01/typed-identity-current-review/design-review.md)，不能以已有producer单测或pure-map测试抵消。重点仍包括实际prepared replay opt-in、实际SDK/adapter活动SSE透明性、Sidecar独立owner、late account/route/lease、AAB/ABB完整关系、错thread/kind/alias/Content-Location、未选Memory/碰撞、失效与跨capture。自然BFCache和受控活动SSE已经有局部证据，勿误写全部未做或全部闭合。

所有已知根因和相关原生闭环后，才审查before/proposed预期路径集，有界集成原仓、正常锁安装、生成新统一freeze，再做完整R04–R12。不是现在批准整树覆盖或提交。

## 5. 已知未关闭与不能遗失的历史问题

- 整组typed identity、T06、registry/projection和全T01–T18未验收；scope/helper独立Approved均有限定。新增只读发现：Content-Location相对/绝对写法在requestFacts中被合并，原头仍在snapshot；暂停前未实施修复或新增测试，列为恢复时projection根因修复。
- 原仓未集成当前联合候选。持久inventory为237差异路径，其中1个Nuxt buildDir隔离差异必须排除；其余236需逐项审查而非自动授权应用。另有originalOnly路径保留，不据候选缺席删除。
- Task6–9和工程清理现已局部闭合；旧交接“未实现/未native/旧warning未修”不再是当前恢复步骤。最终全量组合仍未做。
- 原S15全cross-app751键556非零仍是历史FAIL；permissions-mobile一次未复现不能关闭。Stage43旧失败原件缺失仍未恢复。
- 真实外部LLM、IM、真实IdP、DNS/TLS、外层代理、远程CI/required checks/artifact下载仍UNOBSERVED，不被本地replay/受控SQL/IdP替代。
- Windows原生运行、build阶段只给父进程中断管理等清理边界仍按cleanup ACCEPTANCE保留；本次不扩scope解决。
- Memory cancel/并发mutation覆盖新preview的静态风险尚未证明普通入口可达，未冒称复现或修复；保留E10 README的14:40/14:51调查边界，后续真实生命周期验收时核对。
- 新统一源所有最终collection、预算、751对1502图/人工、完整backend/Linux/standalone/Docker/三入口仍须执行；历史PASS不得改绑。没有自动更新同步marker、接受差异基线或绕过dirty/untracked负控。

## 6. 全计划工作包与最终关闭条件

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

本段为10月28–29日历史收集；11月1日cleanup已重新完整收集18配置1880项、parity82规格1239项，见第2节。尚未执行的是其后身份增量的最终全18配置收集，不能恢复旧1824作为当前总数。

历史收集原件均在 `docs/reports/evidence/resume-2026-10-28/`：[current-collection-after-project-focus/execution.json](evidence/resume-2026-10-28/current-collection-after-project-focus/execution.json)记录2026-10-28 21:59+08全18配置1824（parity1187/session16/mock517）；“新增规格未做全18汇总”仅是该旧快照时的状态，后来已有上段11月1日cleanup的1880项收集。[ci-ownership-after-memory-spec29.json](evidence/resume-2026-10-28/ci-ownership-after-memory-spec29.json)记录2026-10-29 12:16+08只读观察77个parity整文件分入8组各一次、interactions64；它不是当前最终全部新增规格清单，也不是远程CI执行。

视觉完整范围仍为751对1502 PNG：逐key/文件/解码/尺寸/缺失/额外，另做已承诺人工18对36图、4成功附件8图、8编辑器格式主题×两端×Source/Edit的32选样（完整编辑器14case56图）、Linux9图。已有采样不能称1502全人工。当前diff测语义/几何/选定computed styles，不是整图逐像素自动比较；截图失败可能不使主diff失败。Darwin P03阈值仍0.02，旧约0.03失败不能接受。

751对/1502图是必须保留的完整历史范围，不是最终案例数量上限；最终按当前registry、实际collection和完整矩阵纳入全部新增案例，不能截取固定数量或用旧清单漏掉新增场景。S15历史751个key中556非零差异的FAIL也不因本次局部PASS被撤销。

真实外部LLM、IM、IdP、DNS/TLS、外层代理、远程CI仍 **UNOBSERVED**。受控本地Gateway/IdP/replay通过不能提升成这些生产环境通过。Stage43旧临时失败原件缺失的历史限制仍存在，本轮新保全不能补称它已恢复。

## 8. 持久保全与恢复顺序

保全目录：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/resume-2026-11-01/pause-preservation-2026-11-01/`。

| 归档 | 成员 | SHA-256 |
| --- | --- | --- |
| `original-public-source.tar.gz` | 原仓5837公共文件，0私有fixture | `659367052b366e177ceb39d7294f38f2eba5b6bcc3d5d1ec28f32853f8044857` |
| `candidate-public-source.tar.gz` | COPY9公共5922＋example fixture2 | `ba5fab3e5bfed1683116fa2feeb50a63304149aa2ec4070d7c26776d281e4270` |

两归档按显式清单逐成员读回、校验类型/路径/唯一性/SHA，源前后不变。排除真实私有配置、Git/index/hooks、node_modules、build、运行数据和evidence；仅config.yaml/extensions_config.json两fixture与公共example逐字一致。31实际依赖入口在`actual-runtime/`单列，仅证据比对，恢复必须正常锁安装，不能复制进node_modules伪装安装。

`pending-candidate-inventory.json`及`pending-candidates.diff`记录原仓与候选关系；不是旧108路径，也不是相对cleanup的76路径。隔离 `frontend-vue/nuxt.config.ts` buildDir不得回写原仓。新增交接文档、状态与证据在持久目录独立保留，不在早于本文生成的源码归档内。

恢复顺序（必须收到用户明确恢复后才执行）：

1. 读本文、N01 `current-state.json`/`progress.md`、适用根及模块指导。检查Git/私有配置/index/hooks/WIP、候选SHA、依赖实际入口、服务占用和其他用户改动。旧PID/路径不能直接复用或kill。
2. COPY9仍在且所有成员/runtime匹配可继续；若消失，先验归档/manifest，再用本目录`restore-public-source.py candidate-public-source`恢复到全新`/private/tmp/deerflow-restored-candidate-public-source-…`。该助手不安装、不初始化Git、不启动服务、不改原仓。**本次仅归档逐成员readback和脚本语法检查，新路径恢复＋正常安装演练未执行。**
3. 新副本按既有正常frozen/strict流程建立公共Git fixture、安装React/Vue/backend及浏览器extra，核14依赖输入/31runtime/CJS-ESM mounted/1897 Readabilipy文件等已有准备合同。不得依赖旧node_modules symlink或复制私有配置。新路径新binding、新输出label，不改旧回执。具体准备依据见下方8.1；原脚本不可原样用于新归档目录。
4. 从第4节registry/projection继续，一个写入者，独立review只读并行；新源码冻结后完整相关门禁，保留所有失败。E10的`apply-stage.py`/`freeze-candidate.py`/`run-check.py`/`preserve-native.py`/`run-identity-products-native-v2.py`真实ROOT来自N01 `initial-scroll-fix/copy-path.txt`，**不能只换传入manifest/输出名**。恢复到新路径应在新执行目录复制并审查全套绑定；旧copy-path、runner、receipt不改写。E10 `native-fresh-page-v3.config.mjs`的Playwright import/testDir硬编码COPY9，outputDir/reporter也绑定旧证据目录，都须新绑定。E10 `readback-actual.py`则从自身目录＋label读取证据，并检查硬编码3440/3441/8340，不读取copy-path；恢复时分别核对。实际runner默认完整identity-producers，44fixture配置则是独立完整spec；二者不能混称。
5. 完整typed identity接受后，在保护原WIP与私有配置的前提下审查236待应用路径，排除隔离buildDir，语义处理共享文件；正常安装并建立新最终冻结。执行全部R04–R10以及R11/R12，不用本次270/44/12替代。
6. 最终工具的精确导航仍见[上轮交接第8.2节](2026-10-29-vue-whole-plan-paused-handoff.md)：S15/B15/Linux15/Standalone15/D19/local18。它们有旧硬编码，必须按当前源码/路径/manifest/端口重绑，不能重命名旧PASS。所有W/C/九架构/共同矩阵/图像完整性/人工/CI/marker逐条核完；外部生产缺环境另列UNOBSERVED。

### 8.1 恢复准备与执行隔离

既有正常安装依据为N01 [prepare-frozen-dependencies-online.py](evidence/resume-2026-11-01/prepare-frozen-dependencies-online.py)及[该COPY9准备回执](evidence/resume-2026-11-01/dependency-preparation-deerflow-restored-s7-public-source-l27y902m/execution.json)。该脚本接受副本路径和可选attempt，但只接受 `deerflow-restored-s7-public-source-` 前缀，读取副本的 `final-source-frozen.json`，要求其中copy/source等来源字段，并拒绝覆盖既有 `dependencies-ready.json`；归档恢复助手创建的 `deerflow-restored-candidate-public-source-…` 不满足这个旧绑定，而且归档不含该准备元数据。**新路径恢复后要建立新来源清单与新准备入口，审查前缀/路径/工具探针/输出绑定；不能直接照抄旧命令或伪造旧准备通过。** 暂停期间没有实施此调整或演练。

正常安装合同仍是各workspace经 `scripts/pnpm.py` 的 `install --frozen-lockfile`（Vue另加 `--strict-peer-dependencies`），backend按锁安装browser extra，并按原计划安装匹配Chromium。已有回执中的READY仅指当时依赖准备，不是产品门禁PASS或恢复后可免验；新副本还需验证自身shims、实际import归属、runtime与正常锁安装结果。

同一副本的Nuxt套件共享`.output`/`.nuxt`，React共享`.next`。**不同端口不等于构建隔离**：未建立独立构建目录与相符产物签名前，同副本构建和浏览器套件必须串行，跨app聚合保持product→auth→SQLsession；冻结验收期间不并发改该副本源码/配置。只读复审可并行，但不能暗中启动共用构建的门禁。恢复先核实服务归属，不能把旧PID或历史端口关闭记录当作实时状态。

## 9. 暂停与最后复核

独立 `fresh-page-implementation-review-v3.md` SHA `07e8916798260b3969cd76ed7ee756dd44d393e127070ce9bd7ad4e0a430615d`；`identity-slots-implementation-review-v2-addendum.md` SHA `7e1f18c50f0381998d29d99d9f382df2671c9d25b227943897dea90f36bdd80c`，均限定通过。N01共66份附件清单的2033个引用已逐SHA核验（`attachment-readback-v2.json`）；首轮6项是旧root-relative路径被误拼两遍，旧失败读回保留、未改历史材料，实际未缺失。19:41:42只读宿主快照`host-check.json`：按本仓/候选路径无匹配进程，29个任务容器均exited；3440/3441/8340、3100/3200等所列端口无监听，仅3000仍有另一个node进程（未中断、未操作）。未发送服务信号。最终文档反馈处理见同目录`handoff-review-resolution.md`：独立reviewer已返回范围核对和具体发现，均已处理；其独立最终文档报告尚未写出时，为落实暂停已中断该文档子任务。主代理完成链接/范围/保护复核，不冒称未生成的独立报告；代码增量正式复审文件均完整。没有创建新目标，没有计划后台继续执行；没有提交/推送或清理其他项目。

后续可直接让助手读本文并恢复整个计划；在此之前保持暂停，不启动第4节的新实现。

本次仅文档复核重新读取了两份归档的全部成员、原仓5837公共文件、候选5924源/fixture、31runtime与14依赖输入，并核对原分支/HEAD/main/index/私有配置hash/hooks；这些完整性检查不等于产品验收。**没有重跑测试、构建、安装、浏览器或新路径恢复演练，没有检查或操作宿主服务/容器。** 上述19:41:42 host结果仍是历史快照；原独立文档reviewer未产出最终报告的事实保留。本次由主代理完成文档复核，不冒称新的独立代码或文档验收。修订前文档、修订差异与新核对回执见[文档复核目录](evidence/resume-2026-11-01/handoff-document-review-2026-11-01/README.md)，旧归档、失败记录和19:49:53回执均未改写。
