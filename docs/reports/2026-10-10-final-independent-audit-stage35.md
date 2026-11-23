# 本期最终独立审计：Stage35 → Stage36 冻结前

审计日期：2026-10-10。审计者：artifacts_acceptance。依据为当前三端源码、实际测试/Make/CI，以及逐次保存的运行证据；历史总结仅用来定位。本文件不代替 root 的最终执行总账。

## 结论

**当前不能声明整期全部完成。** 只读复核确实发现两项原计划遗漏，而不是仅发现文字不一致：W00 两份调度契约没有进入实际生成/消费；宏观重流量具把“位于浏览器窗口内”误当成“位于真实 scrollport 内”。两项均已按根因修复，并取得真实负控和定向 GREEN，但最新统一源码的完整门禁仍待 root 重跑。

本次另外检查了 Copy 回归动作重排、Git 文件清单修复、三类范围豁免、主零差异台账、真实身份套件、CI 接线和证据来源边界。未发现把新增功能差异写入功能豁免、放宽几何阈值或用静态生成代替流式验收的情况。审计期间其他独立复核又发现 Agent display_name 与两个移动宿主触发图标遗漏，已由 composer 修复；这些后加生产修改同样不能继承旧 snapshot 的完整 PASS。

本次只修改两个 gate 文件和本审计证据，不修改产品、其他规格或 root 主报告，不启动生产构建/服务，不提交或推送。

## 1. 审计边界与 Git 事实

- 当前分支 `main-wc`，HEAD `a7804539530846baecf548af7b5d2612deb89b68`。本次实际读取验证 main 为 HEAD 祖先，`git ls-files -u` 为空。
- root 已保留原 WIP。`.env`、`config.yaml`、`extensions_config.json` 仍遵循刻意跟踪策略；本次审计没有读取或改变其私有值。
- 当前 upstream marker 仍为历史 `a93900d4e645cfcbdb1004df77977ebec72ad309`。实际 drift 结果为 **REVIEW_REQUIRED**，`scopeReviewPending=true`；不能写成 CLEAN，也不能用当前 HEAD 自动认可未提交源码。
- `scripts/upstream-drift.mjs` 的 WATCHED 已覆盖 frontend/src、frontend/tests、manifest/lock、backend/app/packages/tests、backend manifest/lock、contracts 和配置模板。accept 要求显式完整 revision、非空验收文件，且拒绝 dirty/untracked。

Git 边界和 drift 的已保存数据：[git-boundary.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage35-checkpoints/git-boundary.json)、[upstream-drift.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage35-checkpoints/upstream-drift.json)。脏工作区仍需以最终源码指纹证明审阅/执行边界；本次不擅自提交以推进 marker。

## 2. W00 真遗漏：调度契约实际生成与消费

### 原始问题

[计划 W00](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md:240) 明确要求 scheduled_goal_notes、scheduled_task_errors、thread_origin 迁移后进入“实际生成与消费”，不能只改登记表。复核时前两个契约仍在 NOT_CONSUMED，理由却与已有 goal、host error、生命周期和 API error UI 相矛盾。

当时 32 个 UI error 的手写映射与当前契约恰好一致，没有发现当前 32 条展示错误；实质缺口是未来契约新增错误码不会形成缺失映射门禁，而是静默落到 generic。原检查分类、host 文本、生命周期词汇虽有直接契约测试，也没有满足原计划规定的生产生成链。

复核原始数据：[scheduled-contract-source-review.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/final-independent-audit-stage35/scheduled-contract-source-review.json)。

### 当前修复审查

cap 已完成七个生产/生成文件的最小改动。本次逐个读取当前 generator、生成产物及 goal-outcome/run-error/events/errors/messages 消费点，确认：

- 六个顶层契约由真实读取列表驱动，NOT_CONSUMED 为空；没有只改分类却继续手写生成字段。
- stop prefix、auto_pause、check_failure 分类、host run error 文本、scheduled origin key 被真实运行逻辑读取。
- unmet reason、host error、event/reason、UI error 的本地化表通过生成 union 的完整 `satisfies` 约束；没有建立与实际 UI 无关的第二套常量模型。
- 未知服务端值仍沿原流程展示 raw/Details 或既有 fallback；自身属性检查避免原型名误入本地化键。
- 隔离变异测试运行真实生成脚本，并将再生输出交给真实消费者。新增 code/event/reason/host 会使真实 TypeScript 映射产生缺失诊断；新 prefix/origin/host 值会改变真实消费者输出。测试没有复制业务实现来制造自洽。

cap 的 **28 files /362 tests、生成检查、应用/测试 types、lint/format 均 direct exit 0**。本次读到了相应日志和实现，未识别新的根因风险；没有重新执行该整组已通过检查。

当前七文件证明见 [production-freeze.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/w00-scheduled-contract-stage36/production-freeze.json)。本次实际复算全部逐文件 SHA 与 receipt 一致；内容集合 SHA 为 `431c25a0caf083d348ae65c5c0604536bbb7857a321814459e62a05d27c8d9c9`。详细修复证据：[W00 报告](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-w00-scheduled-contract-generation-stage36.md)。这解决局部实现遗漏，**最新完整 build/browser/Linux/Docker/local-entry 仍需统一验收**。

## 3. 宏观重流量具盲区及真实 TDD

### 原始 false-negative

旧 `surveyReflow` 的控件初始可见和滚动恢复判定只看 innerWidth/innerHeight。真实 DOM 中，120px 高按钮完全处于 800px 高窗口内，却只能由 100px 高原生 overflow:auto 区域显示；旧量具返回 initialOutside=0、lost=[]。实际 IntersectionObserver 比例为 0.8333333。这会漏掉与 Copy 按钮同类的用户不可完整到达问题。

旧量具的三个正式控制 **3 FAIL /direct exit 1**，包括初始误判、没有执行恢复路径，以及 nested hidden/auto 实际交集。原始 RED 和错误上下文已保留，不把“诊断成功复现漏洞”的 PASS 称为产品 PASS。

### 最小修复

只修改：

1. [support/reflow-survey.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/e2e-parity/support/reflow-survey.ts)
2. [combined-reflow.spec.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/e2e-parity/combined-reflow.spec.ts)

量具在初始和原生滚动尝试后，均使用 **window 与全部实际 overflow hidden/clip/auto/scroll/overlay 裁切祖先 client box 的逐轴交集**。route reveal 区域也使用该交集。原始 `.5px`、clipThreshold=24、PRE/table/native input 规则保持。

真实浏览器进一步证明并修正了坐标/box 语义：

- 普通 display:inline 不应用 overflow 裁切，display:contents 没有 principal box；原中间实现分别产生假 lost。inline-block/flex/grid 的真实 box 仍正常检查。
- scale(2) 的物理 client 边界与布局 clientWidth/scrollTop 单位不同；现在边界乘真实比例、原生 scroll delta 除比例。缩放控制实际由 wheel 滚入，恢复检查独立保存原位置。
- absolute/fixed 在自己到真实 containing block 之间会逃逸 overflow；使用 Chromium 的实际 offsetParent 判断，而非为 portal 名称加豁免。相同按钮逃逸时 ratio=1，positioned/transformed 祖先成为真实 containing block 后仍被判 lost，两面均有真实控制。
- oversized 仍只由原窗口大小判定，不把“大于 port”新增为可接受类别；超窗口轴仍要求两端原生可达，未超窗口的另一轴要求完整真实交集。900px 高、240px 宽按钮处于 220px 宽 port 的独立负控先 RED，修复后不再借长轴例外掩盖横向裁切；900px 高、200px 宽按钮的原长轴正控继续通过。

所有控制保留原 scroll owner identity/scrollTop 恢复，之后另用真实 wheel 验证完整可达；没有坐标补偿、强关界面、隐藏标签、缩小内容或新增功能豁免。

### 当前直接结果与冻结

| 检查                                    | 直接结果                                    |
| --------------------------------------- | ------------------------------------------- |
| 原 viewport-only 量具，三个新增正式控制 | 3 FAIL，exit 1，已保全                      |
| inline/contents/scale 中间实现          | 3 FAIL，exit 1，已保全                      |
| escaped absolute/fixed 中间实现         | 2 FAIL，exit 1，已保全                      |
| oversized 另一轴裁切中间实现            | 1 FAIL，exit 1，已保全                      |
| 最终原 2 控制 +新增 3 正式控制          | **5 PASS，exit 0，0 skip/flaky/error**      |
| 两文件 ESLint                           | **exit 0**                                  |
| 全测试 vue-tsc                          | **exit 0**                                  |
| 最新量具下两端完整 211 终态扫描         | **UNRUN，root 后续完整 cross-app 必须执行** |

正式净新增 **3 个 Playwright 用例**，原主 751 取样键与 211 终态没有退休或减少。inline/scale/定位/oversized 控制在这三个用例内，未另增第四个。root 持有最后实际 collector/CURRENT 同步；本报告不把预测总数写成实际收集结果。

最终 SHA：

- survey：`ad465ec28b6f5c03563ca925c3cd623737728ece0a149807c76745a074014412`，最后写入 02:24:02 CST。
- spec：`f77331339df733c006baaf55406d46686ab3959586cad567d93110fa93b659c4`，最后写入 02:23:15 CST。

composer 已独立只读复核有效 clip、restore、scale 和 oversized 分支，没有指出实质漏测；该复核不替代上述实际浏览器控制或后续全量扫描。

完整机器证据、源快照、原始 RED、正式 JSON/log、直接退出状态及 diff：[acceptance.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/final-independent-audit-stage35/acceptance.json)。

## 4. Copy 键盘重排：保留合同与不能外推的边界

本次读取最终 [chat-state-resize.spec.ts](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/e2e-parity/chat-state-resize.spec.ts)，SHA `209f2f342639e285d2edc195b06072d0645cfb33ac8a47913460ce982cedb132`。

原真实失败有两类，不能混称为夹具问题：最早按钮本身高于 port 是真实消费者布局缺陷，已通过有界自然布局修复；修复后 React 程序 scroll/focus 的部分可见，则在真实键盘进入后完全可见，才调整测试动作。

最终保留：360×800/root32 与返回 1280/root16；expanded=true；Input/Error 单一实例；完整原错误字符串；四个 Copy 区域；原 `scrollIntoViewIfNeeded`；实际 buttonHeight>0、scrollportHeight>0 且 buttonHeight≤scrollport；两次 exact ratio=1；焦点断言；未匹配 API 请求必须为空。没有调低 ratio 或删除原文/状态断言。

**两次 ratio=1 现在均在真实 Shift+Tab→Tab 后读取。** 因此最终 3/3 formal PASS 证明用户键盘进入后的完整可达和 resize 状态保存；两次不再代表两种独立滚动模态，不能说原纯程序 scroll 后的即时 ratio=1 已通过。纯程序滚动实际 RED（包括 0.997526 的分数裁切）保留原始证据。旧源码对已 active 按钮重复 `.focus()` 产生 focusin=0，也是先实证后改为真实转移，不给产品添加专门 resize 回调。

宏观独立程序 scroll 检查由 `surveyReflow` 对每个终态的每个控件执行；本次补齐其真实 port 交集后，这条独立覆盖仍存在。**必须等最新 helper 的两端全 211 终态均严格通过，才能一起闭合两种验证边界**。单靠 Copy 的两次键盘断言，或者单靠本次 5 个控制 PASS，均不足以替代宏观全量。

旧 RED、原生 focus 因果数据及最终同编译 3/3 结果见 [Copy 报告](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-copy-control-reflow-stage34.md)。该 formal 运行使用 root 新 preview 的 source/build/start receipt，不混用 Docker 镜像 receipt，也未虚构没有保存的完整产物字节 inventory。

## 5. Git inventory gate-only 修复审查

读取 [git-file-inventory.mjs](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/scripts/lib/git-file-inventory.mjs)、[真实测试](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/unit/tooling/git-file-inventory.test.ts) 和 [doc-references 守卫](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/guards/doc-references.test.ts)。

- Git 使用 spawn 与 `-z` 真实流式输入，UTF-8 decoder 保留跨 chunk 字符，pending 保存跨 chunk 文件名，Set 去重；没有提高同步 maxBuffer 来延迟失败。
- spawn error、非零 close/signal、未完整 NUL record 均 reject，失败不会被当作空清单。模块扫描顶层 await，三个全 checkout 检查均 await 同一 Promise，异步错误没有丢失。
- tracked 与全部 unignored 文件仍扫描，未新增放宽排除。root 后加的 existsSync 只去掉已在实际 working tree 删除、但仍在 index 的路径，避免 ghost basename 掩盖真实断链；有真实负控。
- standalone 建立私有 Git index，因此没有兄弟 React 的隔离副本仍能获取自己的模块清单。原全 checkout-only 三项以明确 skipIf 表达不适用，不能把这三项跳过误记为 standalone 中也通过；模块文档检查继续执行。
- 真实 5000 长文件超过 1MiB、Unicode/空格/换行/引号/反斜杠、tracked deletion 与 Git 失败传播均有当前测试。

本次独立运行 **2 files /23 tests PASS，direct exit 0**（5 inventory +18 文档守卫），见 [focused log](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/final-independent-audit-stage35/git-inventory-review-focused.log)。没有发现当前类型、失败传播或 standalone 语义回归。

## 6. W00–W13 源码与门禁逐包复核

下表是本次源码/接线审查，**不是每包最新完整运行 PASS**。具体阶段结果仍以执行报告的源码 receipt 为准。

| 工作包 | 当前核对内容及证据边界                                                                                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W00    | scope/product-surface/scenario 唯一登记、受控 OpenAPI、六 JSON 契约、可靠 collector、隔离 source/env。上述调度生成遗漏已修；OpenAPI 生成幂等不能替代受控导出 freshness 或 SSE。                                                        |
| W01    | session/preferences/expected-owner、locale/timezone、features、真实 SQL/HttpOnly/CSRF、admin 动态赋权撤权。anonymous auth 与 real-session 分开；Chromium 原生 denied 时通知 switch 禁用，不冒称通知授权 UI 已通过。                    |
| W02    | useThreadStream 与提交 owner 分离，server stop 与 scope/dispose 分别处理；nullable gap/durable/end/error、稳定消息 ID 和本地/项目附件接线。Stop 真实 session 阶段 PASS 不代替最终 session 聚合。                                       |
| W03    | artifacts API/editor/response body/资源释放/独立路由、冲突与 range 原始读取。206 及真实 browser body 严格断言保留，无第二 HTTP 请求兜底。CodeEditor ready/fallback 有 lifecycle 回归。                                                 |
| W04    | useComposerSubmission 实际快照、线程/new adoption fencing、上传锁、知识/quote/skills/mentions/model schema/favorites。authDisabled synthetic owner 与显式可见性 real-session 边界均有回归；真实 wire 测试不能只由 mock 状态证明。      |
| W05    | CapabilityCenter、三类 gallery、Agent 定义导入/导出/冲突/权限、知识范围与来源。独立审计新增 display_name header/welcome/选择器漏接已由 composer 修复，最终新编译仍待验收。                                                             |
| W06    | VirtualMessageList 唯一物理 scroll/测量/prepend anchor，MessageList 追尾意图/活动组/目录；90 轮真实虚拟行有 >0 与 <60 下限/上限、wheel、focus、owner identity。两端原窄屏取消 owner 的 CSS 覆盖已退役。                                |
| W07    | 页面+聊天卡片/prompt/events/history、51取50/DST/queued/delete/renew/error/Details、MCP owner/outbox pending。channel fixture get_channel 返回真实 None，worker 启停真实测试，不假造第三方通知送达。                                    |
| W08    | PluginPage、assets/inline/module/导航/action/mentions 的装载卸载和权限 owner。审计新增移动触发图标遗漏正在统一冻结中，不以其路由已存在推断 UI 通过。                                                                                   |
| W09    | 项目四 tab/instructions/trash/文档预览/附件交接、部分失败/409/无权；tabs 的窄屏自然布局有真实键盘回归，未靠缩短标签或阈值过滤。                                                                                                        |
| W10    | browser binary/JSON、Sidecar、memory、subagent、settings/account/channels/integration。Lark 确认结构差异改用已有 SettingsSection，原 interaction 等式/scroll/window/容差保留；完整 topology 各自验证，不用单 replay 模型覆盖所有环境。 |
| W11    | showcase 13 个真实案例、70 样本、报告预览的 table/Mermaid/复制/导出/下载/刷新；共享状态增加仍是零目标。公开只读场景不能证明工作区发送/停止/恢复。                                                                                      |
| W12    | 实际 owner 替换后移除孤立历史代码，非按数量删功能；i18n 当前1828/unused64、必要无障碍/键盘语义保留。审计 advisory 精确 triage，不宣称漏洞数为零。失败现场含 .cache/standalone-failures 且 CI include-hidden-files。                    |
| W13    | 必需门禁接线完整，但最终统一执行仍未完成；dirty marker、未知/失败/未执行与外部环境边界必须在最终交付中单列。                                                                                                                           |

当前本地真实缺口已被发现并修复的事实，恰好说明早期“局部都绿”不能推出范围内没有遗漏。没有用模块数量、词条数量或本表存在来替代运行验收。

## 7. 豁免、零目标与覆盖没有缩减

本次实际读取 `baseline/react-parity-scope.json`：四条 docs/blog exemptRoutes；contentExemptRoutes 仅 `/`；exempt mode 仅 NEXT_PUBLIC_STATIC_WEBSITE_ONLY=true；pendingRoutes 为空。没有把 showcase、鉴权、workspace 或动态扩展宿主加入豁免。

forbiddenUpstreamModules 是当前 React 零消费者死代码的禁止移植清单，与功能豁免含义不同，且仍通过调用关系守卫；不能据此把活功能退休。

本次实际复算 `baseline/parity-diff.json` **751 entries，所有差异数组均空**。这是零差异目标，不是 751 实际 PASS。auth baseline 是 6 样本，只有四条只读 `GET /api/v1/auth/me` 请求组织差异；UI/focus/geometry/order 等数组仍为空。它是已说明影响边界的框架请求组织差异，不是新增功能豁免，真实身份/RBAC 后续另验。

组合重流扫描仍从全部登记状态逐一运行；stateCoverageFailures 验证 missing/unexpected/duplicateExpected/duplicateScans，固定旧61计数已退役。单轴、组合轴及三轴检查没有因本次修量具改小终态集。主 diff 没有 PARITY_ONLY、ACCEPT_GROW 或接受非零目标。

## 8. Mandatory gates 与当前证据边界

| 必做入口                                  | 复核结论/最终边界                                                                                                                                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify +asset-budget                      | Make 实际包含 lint/format/app/tests/core types/unit/i18n/generated/static independence/build；多次历史 PASS 可靠，但最后 W00/Agent/mobile 源与新 survey 尚须 canonical 同源完整重跑。                                                               |
| export-openapi-check/audit/consumer-check | 均为计划独立 mandatory 入口，不在 verify 中不能写成已隐含通过。生成幂等≠live schema freshness；audit6 精确条目≠0 advisory。agent-core 真 tarball clean consumer 与 W00 生成消费测试是两项不同检查。                                                 |
| e2e-mock                                  | 五拓扑全部必需；产品 authDisabled 不承担真实 RBAC 证明。最新完整结果等 root，不用 focused 抽样替代。                                                                                                                                                |
| e2e-backend                               | protocol/real/scheduled/channels/agents/settings/shell/browser 八拓扑必需；受控模型不证明真实模型质量。最终应保留真实主退出码和每片结果。                                                                                                           |
| e2e-external                              | 本地受控 IdP/WS/browser 拓扑必需；不是远程生产 IdP/真实第三方账号验证。                                                                                                                                                                             |
| e2e-cross-app                             | Make 顺序 product→anonymous auth→real SQL session，正式入口 export PARITY_REQUIRE_REACT=1，缺 React 失败；`--list` 允许 diagnostic 收集不等于执行验收。最终包含新增3量具控制与全部211状态，不先记 PASS。                                            |
| visual/route-payload/asset                | 原生 pinned Linux 强制 CI 仍存在。历史 Stage33/34/35 的具体源 PASS 保存；最新 Vue 源在 W00/Agent/mobile 后变化，需最后 refresh/build 后8visual/12payload/asset及9PNG读回。未放宽基准或阈值。                                                        |
| standalone                                | CI 默认 standalone-sim 只 install/build/test；计划另要求实际 `standalone-sim.mjs --with-e2e`，最终仍 mandatory。不能用默认 PASS 代替含完整 mock/backend 的隔离动态实验；跨端执行在无 React 副本明确 UNRUN。                                         |
| 本地入口                                  | dev-vue/dev-dual/prod-vue 需最新源实际入口，而不是只检查某个镜像 health；当前生产增量后应重新取同源证据。                                                                                                                                           |
| Docker/smoke                              | Stage35 两 canonical 镜像、三链路、真实二进制 WS、non-root/health/资源策略及 SIGTERM→exit0 已 direct0，但新增 Vue 生产源使 Vue receipt 成为 pre-W00/Agent/mobile checkpoint。React 源未变可保持自己的精确边界，最终由 root 排程重建受影响镜像复验。 |
| React/backend                             | 真实产品修复触发各端要求。React stage35 check/unit 310/2869 的 PASS 属于其精确源；backend stage32四分片27096/451skip、blocking235、Ruff/1960format direct0 是已保存结果，后续 backend 若无变更可引用该边界。                                        |
| marker/交付                               | REVIEW_REQUIRED 与未提交 WIP 明确，不能给最终 CLEAN；整期仍有必做 FAIL/UNRUN 时不勾全部完成，不提前 commit/push。                                                                                                                                   |

CI 接线实际审过 `.github/workflows/frontend-vue-verify.yml` 的 verify/mock、real-backend、external、cross-app 和 pinned Linux product-visual job。失败上传包括 `.cache/standalone-failures/run-*`，hidden 开关真实启用；manual 基准生成没有替代强制无更新比较。

本地 Docker 实证的准确范围见 [Stage35 入口报告](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-container-ingress-stage35-final.md)：受控隔离配置/SQL、nginx Vue hostname、Nuxt 内部代理、API/SSE/upload/range/download/真实cookie及WS，不是只测单镜像。它不覆盖环境所有的公网 DNS/TLS、外层代理可信配置、远程 IdP 注册或真实 IM provider。

## 9. 最终收口动作

1. root 等最后生产/test 冻结后，实际重收所有配置并刷新唯一 CURRENT 事实区；新增3量具 case 必须被收集。保留历史195/737/823/877/886的日期与 stage，不能批量替换档案历史。
2. 最终独立副本用最新源完整运行全部 cross-app；特别读取新量具两端211状态的 horizontal/lost/clipped、恢复路径和缺失/重复状态集合，不能只读取全局“tests passed”。
3. canonical verify/mocks/8真实拓扑/external、Linux/standalone--with-e2e/本地入口/Docker 相应最新源复验，保存主命令直接退出码、source receipt 和0 drift范围。
4. 最后主执行总账将“当前事实摘要”替换为最新统一结果；历史段保留。此刻顶部及中间阶段表中旧规模/UNRUN是历史记录，不能被用作新的完成声明，也不能把新聚焦PASS倒填旧来源。
5. 最终交付分代码实现、本地双端/部署、外部环境三档，并明确 marker REVIEW_REQUIRED；所有本期必需项严格达到 PASS 后，才可声称本期完成。

本次没有另发现可由当前源码直接确认、且尚未分工处理的范围豁免或根因实现遗漏。此结论是独立源码/门禁审查的结果，不能替代尚未执行完的全量浏览器与最终部署验收。


## 后续追加：Stage36 Query 与产物实际 owner（2026-10-10 02:55 CST）

本节追加于上述 Stage35 只读审计之后，不改写原审计时间或将旧通过结果归到新源。独立复核随后发现全局 Query focus=false 与 React 默认策略不齐，以及主产物面板手工 window.focus owner 没有消费实际 TanStack visibility 生命周期；root 授权分别由 capabilities_acceptance 与 artifacts_acceptance 根因修复。会话无限列表/token/history/模型/扩展/旧分页等明确局部例外必须保留；多页 subagent batches 只停止 interval，不停止 React 原有 focus 更新。完整源对照见 [Query 独立审查](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-query-policy-independent-review-stage36.md)。

产物面板已用现有五段 artifact Query key 与 plain loader 数据接入生产 QueryClient，不再保存私有服务端镜像。原真实 visibility 恢复与 TypeError 重试两项 RED；迁移中 stale full cache 双 GET 负控另一次 RED（总请求应2、实际3），经复用当前请求修复。最终 8 owner 测试及相关 19 文件/200 测试直接 exit0，app/tests types、scoped lint 均直接0。dirty draft/412、截断/完整内容、精确 save 当前 key、迟到请求取消、最终 observer dispose、run settle 单读和 write-file 零 GET 原合同保留，独立 reviewer 未发现新增实质缺口。精确冻结字节与真实退出值见 [artifact-freeze.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/query-policy-independent-stage36/artifact-freeze.json)。

已有真实 Gateway artifact-write 用例增强实际 document visibility 事件→精确206/Range/finished/body/DOM读取，原断言全部保留、Playwright 净增0。此新源浏览器/full211宏观矩阵仍须 root 的统一最终构建执行，本节不声明它们已 PASS。Stage35 旧 Docker 全通过仅保持原选源899/812文件与当时镜像边界；补审发现旧899清单漏记录5个实际已存在输入，当前字节对比均相同也不能逆推历史构建时字节。后续 Stage36 会以新独立完整 context/真实 Dockerignore COPY 输出及镜像 receipt 关闭证据缺口；旧证据不覆盖。


### 后续最终选择语义复验（2026-10-10 02:59 CST）

root 独立复审又发现原手工流程遗留的 full 选择差异：实际同实例 A加载全文→B预览→回A，React 保留最近一次 `{filepath,threadId}`，Vue旧ref清空导致A重新取Range。新增真实挂载/URL/Range计数回归先RED，再复用React和现Vue standalone同一选择模型；B/不同thread预览，mock仍独立cache key但不额外清显式full选择。最终唯一生产文件 SHA `e3015c0f99faa3b84307b1d2960eb19d0b3e63fec49c7b44f8c8395f90033386`，9 owner及19files201tests、app/tests types、lint全部直接0。最终 [artifact-freeze-final.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/query-policy-independent-stage36/artifact-freeze-final.json) 取代02:55的8cf9/8-owner/200 checkpoint；旧证据保留历史，不冒称最终。PW净增0。


## 2026-10-10 03:19 CST — Stage37 actual reflow follow-up (not final acceptance)

The current root-owned immutable app snapshot is under full 889-case acceptance. A newly observed Vue directory failure was proven to be a survey error: `DOMRect.height / offsetHeight` interpreted fractional ordinary layout as scale. Its 687.015625px / 687 ratio caused long-scroll undershoot. An actual synthetic 687.015625px native port and 6318.6px leading content first failed the old helper, then passed the root-authorized correction based on actual CSS matrices, individual scale and zoom ancestry. All five existing expanded browser calibration cases and both unchanged strict directory cases pass directly; tests types and scoped lint exit 0. No original half-pixel/24px threshold, overflow/oversized exception, 211-state registration or 751-sample target changed. No new Playwright case was added. See `2026-10-10-reflow-survey-stage37.md` and `evidence/reflow-survey-stage37/`.

This does **not** clear the old Vue macro's 268 lost controls. An independent full 211-state diagnostic using the corrected helper and the same compiled app is still running. Agent completed-turn already has a real independent reachability defect: physical port 38px < action 64px; native keyboard focus cannot fully expose it. Sidebar slash command initial popup y56..282 crosses main's y120 clipping boundary, while reopening moves it; its placement owner is being independently diagnosed. Direct IntersectionObserver ratios in chat focus tests are a separate investigation and have not been declared fixed by the helper.

The running root copy and servers were not modified. Docker Stage35 and earlier Linux receipts remain historical checkpoints; Stage36 Docker preparation has not run a new build. Final source and gate acceptance remain pending these actual findings and a full rerun.


## 2026-10-10 03:52 CST — Native sticky/hidden restoration gate follow-up

This is a gate-only follow-up; it changes `reflow-survey.ts` and the existing calibration case in `combined-reflow.spec.ts`, with **zero net new formal Playwright cases**. Production files and the immutable Stage37 executing copy were not changed by it.

The same static apps proved that a single inferred native-scroll delta can leave a toolbar pinned on its sticky plateau. The PNG action remains at 312–384 in a 160–360 port even though a real wheel traversal followed by native focus reveals the complete same button. The long React tool PRE also has a valid first/last-edge path: native reveal scrolls its `overflow:hidden` motion ancestor by two pixels, which the previous auto/scroll-only saved route list omitted. These are measured browser paths, not permission to treat ordinary oversized actions as recovered.

The helper retains the original manual route measurement. If that does not reveal the complete node, it tries native `scrollIntoView` start/end. A sticky plateau may require traversing an existing auto/scroll owner's native endpoint first; it then tries standard reveal again and measures the **current intersection of window and every effective clipping ancestor**. Ordinary controls must be wholly visible in one state. Only a node larger than the original window-size boundary may use the original separate leading/trailing-edge rule; the other axis must fit. No 0.5px, 24px, PRE/table/input classification or scope threshold was relaxed. Every ancestor's original horizontal/vertical scroll position is saved and restored, including programmatically scrollable hidden ancestors and the document owner. The helper does not focus elements, and the formal positives assert that the original focus is retained. `overflow:clip` remains a true non-scrollable negative.

For R existing auto/scroll routes, an ordinary node makes at most 2(R+1) native reveal calls. The worst case with four oversized edge checks plus the ordinary check is 6(R+1) reveal calls and 5R native endpoint calls. There are at most six complete ancestor restoration passes. There is no retry timer, viewport change, padding compensation or new exemption.

Actual verification:

- Five existing calibration cases: **5 PASS / 0 skipped**, direct exit 0. They include the original 120px button in a 100px port, nested 100px button clipped to 80px, window-oversized with clipped other axis, CSS scales/zoom, inline/contents and out-of-flow containing-block checks, owner/scroll/focus restoration, real wheel/keyboard positives, native sticky recovery and hidden-versus-clip two-pixel edge controls.
- Importing the actual pre-fallback helper into an isolated diagnostic mutation suite: **2 expected FAIL / 0 skipped**, direct exit 1, for the real-positive sticky path and translated oversized edge. The native positive is established before the failing old-helper assertion.
- Vue full tests typecheck, scoped ESLint and Prettier: direct exit 0.
- The first synthetic sticky shape used insufficient trailing pan space and was not a valid all-actions positive; its exploratory failure and an ESM-only mutation collection error are retained as checkpoints and are not counted as causal RED evidence. The final controls establish the wheel/focus positive explicitly, and the final two executed mutation failures are the causal RED evidence.

Exact source hashes, direct exits and bounds are in `evidence/reflow-survey-stage37/native-fallback-freeze.json`; final controls and mutation logs are adjacent. The old full Vue 211-state result of 57 lost controls stays RED. Full-matrix and new compiled product acceptance remain pending the unified build. The already frozen four modal sources and twelve new capacity regressions also still require that fresh compiled run.


## 2026-10-10 04:10 CST — 最终量具冻结与报告预览容量（新编译待验）

本节追加最新事实，不改写上面 03:52 的历史输入与退出状态。最新唯一 receipt 为 `docs/reports/evidence/reflow-survey-stage37/native-report-final-freeze.json`；03:52 的 `native-fallback-freeze.json` 已被替代，仍作为历史保留。

量具最后收口了两个独立、已实测的生命周期问题。其一，CSS `scroll-behavior:smooth` 会让直接赋回 scrollTop 后的位置继续变化：原 owner 应恢复20，旧实现实际返回89。恢复现在通过标准 `scrollTo({behavior:"instant"})`，每次覆盖所有原祖先及文档滚动位置，不触发 focus。其二，窗口级 oversized 的每个端点测量需要先重新执行双轴真实 reveal；先恢复原Y、只移动X会丢掉实际可达的另轴状态。最终端点断言重新读取同一节点和全部有效裁切交集，未使用前一轮 fits 缓存；非 oversized 另轴仍要求完整可见。

最新普通控件仍须在同一个状态完整落入窗口与所有实际裁切祖先的交集。只有原窗口宽/高+1判据成立时，才逐端验证相应 oversized 轴。所有旧 0.5px/24px、普通120>100失败控件、另轴裁切负控、PRE/table/native input规则均保留。最终5项实际 Chromium 校准全部 PASS、0skip、直接exit0，日志 `native-final-controls.log`。新多行片段/双轴正控属于最后校准增强；其首次合成运行本来就是PASS，不能写成该合成例先RED。真实报告预览在原端点量具下仍lost1、双轴修正后lost0的因果日志另存。

最终有界次数修正为：R为原 auto/scroll 路由数，普通控件至多2(R+1)次标准 `scrollIntoView`；两个窗口 oversized 轴的四端点与普通检查合计至多10(R+1)次，至多5R次原生路由端点遍历、6次完整祖先位置恢复。03:52 的6(R+1)是旧候选实现边界，不能用于最新实现。没有基于时间的retry、坐标补偿、viewport变化或新白名单。实际sticky证据 `sticky-native-platform.json` 保留手工delta、单次native start/end仍312..384/port160..360，以及真实wheel→focus后224..296完全可见的逐步数据。

独立报告预览另有真实双端产品容量缺陷：同一个原始长URL action为746×374，旧内层预览port仅341高；即使原生键盘聚焦，也不能在同一状态完整暴露Y轴。单独换行仍产生更高的662px action，故不是合理修复。复用现有28rem容器边界，Vue ArtifactPanel body与React ArtifactContent现在采用CSS自然内容下限、viewport最大高度与原整面板pan，保留内层bounded预览owner、原文/href、文件与Query行为。正常桌面全部后代矩形变化严格为0。

新增 `artifact-preview-capacity-reflow.spec.ts` 的原正式两端断言在旧compiled应用均真实FAIL（direct1）；仅注入同一容量CSS的因果版本2PASS（direct0），包含双实际滚动owner容量、真实wheel、原生键盘focus、原文/href、完整survey及pageerrors。相关Vue3files32tests、React1file19tests，双端app types、Vue tests types、scoped lint与format均直接0。本轮没有把旧compiled因果PASS写成新产物PASS。前述4源/12case modal修复与本轮2源/2case report修复合计新增14正式case；量具净增0，原751样本及211状态不变。

**当前边界：产品/测试/开发文档已冻结，量具5校准与静态/定向unit/因果验证PASS；最新compiled modal12、report2、完整双端211、统一cross-app及Docker仍PENDING父任务最终统一build。** 原Stage37全211的57lost结果仍为历史RED，不能用局部PASS外推清零。未触碰仍在取证的旧副本源码或测试上下文。


### 同期门禁输入流复核

再次只读检查 `scripts/lib/git-file-inventory.mjs`、实际Git特殊名/长清单/删除/失败单测与 `doc-references.test.ts` 消费：`git ls-files -t -z` 的流式UTF-8/NUL记录保留完整特殊路径；tracked删除经真实存在性判断排除，untracked直接消费Git当次枚举；非零退出、signal、进程error和不完整末记录都reject，不能降为空库存。模块路径相对调用cwd，独立副本自身Git库存重新读取；文档守卫对当前模块与实际存在的上层范围分别await，保留原覆盖与历史边界。未发现新的失败吞没或跨副本伪接线。此处是源码复核，未冒记重跑root此前实际单位/18文档PASS。


## 2026-10-10 04:27 CST — Docker双hostname OIDC验收补齐准备

最终mandatory复核确认原容器验收仅覆盖本地密码登录/HttpOnly/CSRF，尚未通过canonical Nginx分别选中React/Vue执行真实SSO callback。已有external两hostname测试都落同一Nitro端口，不能替代该部署入口。因此本项在此时明确为UNRUN，旧三个容器探针PASS不外推到OIDC。

仅测试域新增受控阶段：复用 `frontend-vue/tests/support/run_m0_idp.py` 的授权码/PKCE/nonce fixture，新增可选host/issuer参数，默认仍127.0.0.1与原issuer；既有Gateway镜像运行该fixture，Compose专属overlay仅添加idp与切换Gateway受控config。公开IdP端口固定loopback，容器内network alias与Chromium的*.localhost使用同一个issuer。没有修改产品auth、生产Nginx、远端IdP或原三个探针。

`prepare_container_oidc.py` 保留原project、compose、replay/browser配置和SQL，生成独立overlay/config；`probe_container_oidc.mjs` 从两端实际登录UI发起授权，在真实authorize请求继续前同时核对同名host-only signed state Cookie，错误host state真实403且正确cookie保留，随后放行真实HTTP并验证各自Gateway302、各自前端callback200/next、同SQL owner、HttpOnly/CSRF、state清理与reload身份。没有fulfill/me mock或绕过真实exchange。

TDD真实1PASS2FAIL→最终2files8PASS/0skip/direct0；默认与容器CLI都执行实际discovery、授权码、PKCE与nonce。tests types、ESLint、Ruff/format、Prettier、Node语法均直接0，四个输入的精确receipt为 `docs/reports/evidence/container-ingress-stage36/oidc-fixture-input-freeze.json`。Playwright净增0、Vitest净增3。Docker执行工具独立位于evidence目录，新增probe-oidc阶段，保原probe/smoke全部合同；实际容器阶段仍等待统一最终镜像与编译窗口。外部DNS/TLS、outerproxy和真实组织IdP仍不由该受控loopback验收声明通过。


### 2026-10-10 04:32 CST — OIDC探针最终脱敏输入边界

root原5572输入/dbd94完整canonical已direct0：460files3816tests且0Unhandled、四types、lint/format/OpenAPI/构建/asset/consumer/audit全部通过。其probe输入为47b638ec，保持该精确checkpoint；此后经root同意，仅将3个state/cookie字符串比较换为完全相同的boolean断言，避免失败日志自动输出原始签名state。没有删除条件、捕获忽略异常或mock响应。最终probe SHA为 `b57c9035a359c1e48729f3c2ecf840d8ec8df0a83eb976f726fb07ae928e9ad6`，专项2files8tests/0skip、tests types/ESLint/Prettier/Node语法均直接0；其余3个fixture输入未变。唯一最终receipt是 `docs/reports/evidence/container-ingress-stage36/oidc-fixture-input-freeze-final.json`，旧源与3处diff单独保留。实际Docker OIDC仍UNRUN，后续必须执行b57输入，不能将canonical47通过冒记为b57容器通过。


## 2026-10-10 04:38 CST — 新compiled容量14正式PASS

父任务实际统一源码5573inputs SHA192904942e4a470105c4ca7c18ab2e4b04d49a222c21695320445353350d4251，经canonical构建在Vue3270/React3271运行。本域从同一副本的Playwright/spec/helper读取，独立contexts执行新增report2与model/Memory/Channels12正式用例，主命令直接exit0：14PASS、0skip、0flaky、errors[]，36.2s。原实际wheel/同owner、完整动作容量、原生键盘focus/ratio、全文与原文/href、严格全部clip交集和横滚/survey断言均保留。执行后9项所选生产/测试/helper当前仓库与副本逐字零drift。

该结果关闭此前本域modal12/report2的新compiled PENDING。精确命令、父快照引用、JSON stats、逐文件SHA与范围在 `docs/reports/evidence/reflow-survey-stage37/final-compiled-capacity-14-receipt.json`；对应完整log/JSON和临时config的durable副本相邻。先前0执行的双Playwright实例collector配置错误单独保留为runner checkpoint，修成副本单实例后真实collection14/direct0；未计入产品FAIL/PASS。

**这只是14项新compiled容量验收，不代替完整909产品矩阵、双端211宏观重流、751主diff、真实Gateway、Linux或Docker/OIDC。** 父完整cross仍运行；Docker尚未启动最终重build，受控OIDC真实容器阶段仍UNRUN。没有改动正在运行的父副本或任何冻结生产/测试输入。

### 2026-10-10 04:50 CST — fresh React skill-menu placement is a real product defect

The final immutable cross-app copy (`192904942e4a470105c4ca7c18ab2e4b04d49a222c21695320445353350d4251`, Vue 3270 / React 3271) reproduced the React `skill-usage#menu` failure in a separate browser context. Before calling `surveyReflow`, the settled React menu already occupied Y=1069..1320 while its reference occupied Y=1324..1388. The same values remained after the survey and two additional animation frames. Native menu-item focus and ArrowDown did not reveal the menu. The Vue menu stayed at Y=541..791.953125 with its reference also outside the viewport. This therefore is neither a synchronous-survey measurement error nor a reason to relax the survey.

The installed Radix Popper implementation fixes `shift({mainAxis:true,crossAxis:false})`. For a top/bottom placement its shift cannot clamp the vertical axis. Public `sticky="always"` removes its limiter, and `updatePositionStrategy="always"` enables frame updates; neither enables that missing shift axis. Collision boundary/padding cannot change the axis. A generic native reference-retention lifecycle was evaluated only as a browser-injected causal alternative: reveal the existing reference through `scrollIntoView(nearest)` when an open menu and its reference leave the viewport after layout. Normal desktop descendants retained identical geometry, and the same original survey/ratio/ArrowDown/Escape assertions then passed. That experiment changes native scrolling and is not a shipped fix or a final product PASS; the parent owns the final design decision.

Evidence: `evidence/reflow-survey-stage37/stage38-skill-placement-receipt.json`, both app geometry JSON files, and `stage38-native-anchor-retention-causal.{log,json}`. Active cross-app source and all original product/helper/assertions remained unchanged. The previously accepted 14 modal/report cases remain bounded to their own byte-identical current consumers; they do not close this menu defect or the full 909-case aggregate.

### 2026-10-10 05:05 CST — source repair and controlled ingress checkpoint

The generic React Dropdown now owns native reference retention for open menus during layout/visual-viewport changes. It preserves the actual `aria-labelledby` reference, existing native scroll owners, Radix placement and all original focus/selection/close behavior. It writes no portal coordinates. Mounted TDD: old 2 failed / 2 passed; final 3 files / 10 passed / 0 skipped, direct exit 0. React types, scoped lint including the otherwise generated primitive, and formatting all exited 0. Close/unmount retire observers, listeners and pending frames. A sibling independent source review found no substantive gap in the current consumer paths; transformed clipping ancestors beyond the actual translated virtual rows were not claimed as validated by those mounted cases. Source receipt: `evidence/reflow-survey-stage37/dropdown-anchor-production-freeze.json`. Fresh compiled generic-menu validation remains pending the parent's new unified build.

The parent's additional Settings Dialog CSS container-capacity repair changed both current consumers after the earlier fresh-compiled 14-case checkpoint. Therefore those earlier 14 passes remain historical source-bounded evidence and must be rerun on the new dialog source. The full current product/211-state/751-key aggregate remains pending; no passing subset closes it.

The formerly missing production-Nginx dual-host OIDC check is now actually exercised with the real controlled IdP, Gateway SQL, React/Vue hostname selection and callbacks. The checked-in probe passed direct exit 0 after fixing two probe root causes: native Chromium Fetch interception observes redirect hops that Playwright route intentionally skips, and state-cookie assertions inspect the real callback path rather than the root path. It retained simultaneous host-only signed-state separation, wrong-host 403 without correct-state consumption, real code/PKCE/nonce, both own callbacks, one SQL owner, HttpOnly/CSRF, expected-owner preferences and reload stability. All eight fixture tests and associated checks passed. No product-auth/backend source changed.

The three original Docker ingress probes and mandatory smoke also passed, with actual signal 15 → exit 0 → destroy and no signal 9. These Docker results belong to the immutable pre-new-dialog/pre-dropdown image checkpoint and the separately recorded final native OIDC probe input. They do not validate the latest product source. Full source/COPY/image/runtime/mount boundaries, retained probe RED stages and exact phase exits are in [the Stage36 checkpoint report](2026-10-10-container-ingress-stage36-checkpoint.md). Final current-source dual-image builds and all runtime revalidation remain UNRUN pending the agreed build window.

### 2026-10-10 05:38 CST — independent SettingsDialog review and final decoration repair

The parent's two SettingsDialog consumers and their actual Dialog/ScrollArea primitives were reviewed independently. The explicit `75vh`/low-height `dvh` dialog height gives the new size container a definite content box. The narrow viewport's `100cqh` maximum therefore derives from that dialog, rather than the tall panel content or the browser window. Existing dialog/native nav/ScrollArea owners remain; no new DOM scroll owner, hidden control, focus callback or business-state owner is added. The desktop two-column grid and bounded inner scroller remain unchanged. No blocking source defect was found in this repair.

Its four recorded browser causes are old compiled products with equivalent CSS injection, not fresh compiled passes. The current formal file has 16 cases, retaining wheel movement on the same dialog, real keyboard exit/reentry, full control visibility and the unchanged complete clipping-intersection survey. Those individual cases use 360×800/root32; low-height and desktop/two-column behavior are not falsely claimed as separately exercised by that 16-case file. Existing wider/low-height macro gates and fresh full execution remain required. The earlier owned 14 compiled passes predate these latest two dialog changes.

The complete mock suite also exposed a shared product defect in the composer decoration: fixed 17px extension exceeded the real `pb-4` reserve of 16px and enlarged the native main pan to 721px in a 720px client. Real input focus scrolled it by 1px, leaving main/sidecar bottoms at 703/704. Vue and React native compiled contexts independently reproduced the exact cause. Replacing only the decoration token with `-bottom-4` restores the true 720px extent and strict equal geometry, without changing the original test or adding tolerance. At root32, form rectangles and actual main scroll positions/extents remain unchanged while the background covers the existing 32px reserve completely.

Both original full sidecar flows passed the CSS cause experiment; React used its own original wire contract. Vue 39 DOM tests and React 9 files/122 tests passed with no skip, and affected types/lint/format all exited 0. The two product files and associated six-path input receipt are frozen in `evidence/composer-decoration-stage39/source-freeze.json`; [the specific report](2026-10-10-composer-decoration-stage39.md) preserves old RED and diagnostic preparation failures. Fresh compiled acceptance remains pending the new unified source build. No wire behavior was normalized based on merely different client context keys.

The controlled IdP fixture's former exit 137 was also retained as a real failure boundary. A minimal fixture-only `init:true` overlay, with a generated-overlay regression, now gives actual one-off SIGTERM→143/no SIGKILL, without changing backend/product signal behavior. That is distinct from the mandatory Vue runtime smoke's expected SIGTERM→0. The final Docker round must execute the new fixture configuration and all existing probes; its prepared context and old Stage36 images cannot be described as current product acceptance.

### 2026-10-10 06:16 CST — Stage39 actual Docker closure and independent stream-source boundary

The final Stage39 Docker scope has now actually completed, with every phase directly exiting 0: immutable physical context, real BuildKit COPY, both canonical images, all three original real Gateway probes, real Nginx dual-host controlled OIDC, unchanged mandatory smoke, and normal stop of only the owned five-service project. Vue's actual smoke events are signal15→die0→destroy with no signal9; the actual init-enabled IdP stop is signal15→143 with no signal9. SQL/runtime are preserved and published ports released. This replaces the earlier Docker UNRUN boundary for the Stage39 snapshot; it does not rewrite Stage36 history. Exact context/image/mount/event proof is in [the final Docker report](2026-10-10-container-ingress-stage39-final.md).

The shared decoration repair also has new compiled evidence: React's complete original native selected-text flow passed directly, without CSS injection or test/assertion changes, and the capability owner's complete Vue product512 includes the original strict sidecar case passing. Those proofs remain separate from this independent read-only source review.

The subsequent stream repair changes exactly two existing Vue test files and adds one real HTTP/SSE unit. A fresh physical inventory includes the addition: 2906→2907, two changes/one addition/no deletion, production/configuration unchanged. The two old files were genuinely in historical Docker COPY; the new unit was not. Existing Linux1750/root5584 lists show two changed old rows, and the extra current unit is explicitly reported outside those old lists. There is no claim of current whole-tree zero drift or of rebuilding new test bytes into old images.

An independent installed Tailwind4.1.18 check used complete auto-discovery on both source trees and separately generated the unchanged real main.css from all old/current candidates. Scanner files1614→1615, candidates24563→24568, seven additions/two removals; both generated CSS outputs are byte-identical202104/SHA23044705e630d37342dcf5fd7e6e442a7a7352c0f9c066a0a0173b8030682054. Tests are therefore not falsely described as unread by the compiler. Actual parity/auth/session/visual/payload/Docker runtime entrypoints do not execute this stub; full unit/types and e2e-stream do consume the new tests and require their own new execution results.

Source review found no blocking defect in the bounded fixture repair. All six original case titles and matcher method/arguments remain, with one added exact physical-row attribution assertion. The duration badge locator now follows the real row's preceding sibling structure; it is not weakened to any page-wide badge. The capability owner's final actual HTTP5 and socket-browser6 passes, their preceding RED stages, and pending full aggregate boundary are preserved independently. Exact review and reproducible source-set/CSS/AST proof are in [the stream independent review](2026-10-10-stream-fixture-independent-review-stage39.md).

The parent now reports both actual211-state reflow macros passing with horizontal/lost/clipped0; its other complete913/751/auth/session work continues. Neither those macros nor the Docker scope is being used to replace the rest of the mandatory plan.
