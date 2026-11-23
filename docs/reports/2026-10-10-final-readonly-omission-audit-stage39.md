# Stage39 最终只读遗漏复核

记录时间：2026-10-10 06:26 CST。依据当前三端源码、W00–W13 原计划及实际 source/gate receipts；本次没有修改产品、测试、门禁、主状态报告或 Git marker，没有运行 build、unit 或浏览器。这里只记录独立读码结论，不能代替执行中的完整门禁。

**未发现新的、已经证实的实现/架构遗漏或根因绕过。整期验收仍未完成。** 当前完整跨端、修复后的完整 Vue 聚合、两种 standalone 与最终本地入口仍须各自收口；最新 standalone 默认模式确已失败，不能保留为 RUNNING 或凭断言零失败记 PASS。

## W00–W13 消费与清理核对

表内测试文件表示已阅读的有效回归入口，不表示本次重新执行通过。未写三端前缀的 Vue 路径以 `frontend-vue/` 为根；仅给文件名的项按对应组件/测试模块定位。

| 计划 | 当前真实消费者与有效回归 | 只读结论 |
| --- | --- | --- |
| W00 契约与门禁基础 | `scripts/gen-contract-constants.mjs` 实际读取六份根契约；`core/contracts/backend.gen.ts` 被 scheduled goal/run-error/events/errors/messages 和 thread origin 消费。`gen-contract-constants.test.ts` 改真实输入、重新生成并检查真实消费者/编译缺口。`list-e2e.mjs`、正式 React-presence guard 和 standalone 副本入口仍实际接线 | 生成消费遗漏已修，未发现仅登记常量或空消费者；collection 与浏览器执行仍分开 |
| W01 身份与偏好 | `core/auth/session-query.ts` 唯一 session key；`UserPreferencesBoundary` → `useUserPreferencesBoundary` → `user-preferences.ts/preferences-sync.ts`。后端 `routers/user_preferences.py` 仍要求浏览器 session、expected owner，PATCH 204/exclude-unset。对应 boundary/sync/用户偏好 DOM 和真实 session 套件保留 | owner、tab-local outbox、旧响应拒绝、局部 PATCH/locale 兼容都仍在实际链路；auth-disabled 没被拿来替代真实权限验收 |
| W02 run 与提交 | `AgentChat → useChatThreadOwner/useThreadStream`；`ChatComposer → useComposerSubmission`，runner/gap recovery 保留独立 abort/stop/dispose 与 durable/terminal-tail 语义。`thread-runner`、`gap-recovery`、`composer-workflow` 和真实 stream/session 回归实际覆盖失败重试、相同 target adoption、稳定 human/附件 snapshot | 没有恢复旧取消 owner 或按终态跳过尾帧；Stop 仍由 stream owner 发服务端 cancel |
| W03 产物 | 主面板消费 `useArtifactFileContent` 的五段 canonical Query，draft 与 HTML/表格 preview owner 独立；exact saved-cache write、warm full cache 单请求、A→B→A 最近全文选择都已有 mounted 回归。对照 React `core/artifacts/hooks.ts` 的实际 full selection/focus 语义 | 手工 window-focus/response 镜像未保留；write-file draft 仍纯本地，dirty/save snapshot/412/旧 owner/preview-full key 边界没被合并或绕过 |
| W04 输入与引用 | `useComposerDraft/References/Submission/Voice/Polish` 实际由组件调用；`threads/submit.ts` 移除 stored conversation grants 并生成 client timezone；`useConversationKnowledgeScope` 被 AgentChat 捕获后放到当前 human kwargs。真实双 tab 提交与 scope/selector/草稿回归保留 | display metadata、每次 grant、skills、knowledge 与 extension mentions 没合并为一个权限字段；provider effort 与 Agent effort 边界保留 |
| W05 能力与 Agent | `CapabilityCenter`、`MCPPluginManager → useScopedMCPConfig`、`LarkPluginSettings → useLarkIntegrationFlow`；AgentChat 实际消费 `useChatAgent` 的 shared detail Query，展示名由 presentation helper/Welcome 消费。能力、MCP、知识、Agent query/import/export 回归存在 | 旧 unscoped MCP owner 已退役，权限/PATCH/re-read/pending 断言迁入真实 scoped consumer；没留“新 Query 写了却页面手工 GET”的双 owner |
| W06 历史/未读/滚动 | `ThreadSidebar` 唯一挂载 `useThreadActivity`；AgentChat 实际挂 `useMarkOpenThreadRead`。MessageList 把同一物理 scroll element 交给 VirtualMessageList，measured row 承载事件/目录锚点。history、active-run、read/activity、scroll-owner/virtualizer 回归保留 | origin、legacy fallback、feature gate、cursor/read-version、prepend/tail/目录职责均有当前消费者；未发现第二物理消息 scroller 或旧 writable 镜像重新接回 |
| W07 计划任务 | `ScheduledTaskDetail.vue:86` 实际调用 `useScheduledTaskRunHistory`；按 task/page 请求 51、显示 50，非第一页 mount/focus/reconnect/poll 关闭。表单/schedule/renewal/outcome/event/card 共用当前规则，事件仍在 measured row | 旧 infinite history 页面链已替换；没有只写新 hook。原秒精度、DST/null/省略、任务/occurrence、live card/不可变 event/删除历史回归保留 |
| W08 插件 | `useFrontendExtensions` 以 viewer/account fence 加载 inline/assets-v1；PluginSurfaces/Surface、页面、菜单 action、mentions 都使用真实 registry/services/extension owner。Surface cleanup abort+dispose，backend plugins router 仍验证 installed action/viewer/authz | 宿主不是静态壳；关闭/切 owner 后续体与动作 allowlist 保留，没新增 web 安装 Python 的路径 |
| W09 项目/文档/trash | 四 tab 页面按 project.id 给 instructions/doc/settings owner key；instructions 用 TextEncoder 和提交 snapshot。`ProjectConversationFiles` 真实 200-file/page 链；attachment staging 只接服务端确认结果、按 staging revision 退休。TrashView 的 empty 调用全量 backend purge，而不是循环已加载页，失败 onSettled 重取 | UTF-8/保存竞态/归档/附件 handoff/merged/content-missing/部分清空都有实际 DOM/API 回归；未见“只实现 API 无 UI” |
| W10 已有功能 | BrowserPanel 实际消费 BrowserStream/Connection，binary blob 与 legacy frame、REST abort/reconnect/frame cleanup 分层；Sidecar/session、Memory、Subagent batches、Channels 的当前入口仍接真实各自 owner 与能力策略 | 没因无新增路由跳过存量消费者。真实 browser extra/受控 channels 与第三方账号边界仍清楚，不以 replay 证明外部 delivery |
| W11 UI/showcase | 当前 shared showcase 登记、只读宿主和资源路由被公开交互套件消费；报告/table/Mermaid/复制/导出/下载/刷新已进入实际场景。跨端零目标台账 751 键，所有 211 终态保留，窗口/字体/键盘回归未删 | 只有原三类豁免：首页内容、四个 docs/blog 路由、整站无后端静态模式；showcase/权限/响应式没有被新写成豁免。目标为零不等于已执行通过 |
| W12 历史负担/工程 | 旧 thread-context、proxy-policy/buildProxyRules、keyboard/upload adapter/FileUIPart、artifact editing/feedback wrapper、旧 MCP owner 已无生产入口；真实快捷键、上传、proxy 安全、draft/反馈数据回归仍在。生成类型、worker、Nuxt 自动入口未按零显式引用误删 | 职责拆分由实际调用证实，组件仍有编排职责不等于缺少重构。没有用行数/文件数/测试数作为完成标准 |
| W13 完整验收 | Make 的 cross-app 顺序为 product→匿名 auth→真实 session；正式入口要求 React。CI verify/real/external/cross-app/Linux visual 和失败现场上传实际存在，standalone hidden failure path 被上传。upstream marker 在 dirty 或不完整 reviewed evidence 下拒绝推进 | 未发现新增 mandatory 豁免或静默 continue-on-error。完整结果必须等实际直接退出；当前 REVIEW_REQUIRED/dirty 原样保留 |

## Copy 与宏观量具合同

`tests/e2e-parity/chat-state-resize.spec.ts` 仍在 360/32px 与 1280/16px 双向变换后保留：ToolDetails expanded、Input/Error 唯一、原错误全文逐字不变、全部四个 Copy 控件、实际 button≤动态 scrollport、两次完整 `ratio:1`、真实 focused 及无漏 mock 请求。它先保留 `scrollIntoViewIfNeeded`，再聚焦并通过真实 Shift+Tab→Tab 进入后读 ratio；没有改文字、隐藏控件、加容差或给产品加 focus 回调。重复对已 focused 节点 `.focus()` 是 no-op，程序 scroll 的瞬时读数不能替代真正键盘可达性；原 fractional-clip RED 仍留档。

程序滚动合同并未因此消失：`combined-reflow.spec.ts` 仍对全部登记终态调用原生 survey。当前 `reflow-survey.ts` 对 ordinary 控件要求**同一次状态下**完整落入 viewport∩所有真实 clipping ancestor，不拼首尾；仅原 window-sized oversized 分支验原生两端。普通120>100、nested clip/auto、fractional 无伪 scale、真实 scale/zoom、inline/contents、out-of-flow escape、sticky/hidden 与 other-axis 负控仍存在，恢复原 owner scroll positions。原 .5px/24px 和原合法 PRE/table/native-input 规则没变。

Stage39 实际两端全部211终态已分别 PASS：Vue initial/restored1932，React1936，horizontal/lost/clipped 全0、droppedDialogs空。该结果是量具修复后真实整矩阵，不用局部 CSS 注入或 Copy 聚焦测试替代；它也不能替代尚在运行的 keyboard/主751 diff/auth/session。

## 当前验收边界

以读取时的直接 receipts 为准，后续进度由根任务更新，本文件不抢写主状态。

| 门禁/来源 | 此时能确认的结果 |
| --- | --- |
| React final check/unit | 当前生产源实际直接0；314文件2887 PASS、0skip；独立 source/dependency 前后证明 |
| Vue完整 verify+asset | repair-round-3 于06:25:15完整直接0，462文件3823 PASS/0unhandled；5590输入 SHA634dd3eb…前后无漂移，包含最终三份stream修复。之后新standalone观测修复必须另列实际影响检查，不冒称已在此receipt中执行 |
| mock/backend/external | 旧完整 mock 产品512、auth25等已到554 PASS后 stream6 FAIL，直接2，后续 backend/external 未执行；最终三文件修复的 HTTP5与真 socket6专项均直接0。repair-round-3于06:26:04从原聚合入口重新完整启动，当前RUNNING，尚不能称新完整聚合 PASS |
| 完整 cross-app | 913产品+21auth+8真实session 无 filters/accept，751零目标和双端211仍全范围；当前在运行，不前瞻记 PASS。两端211宏已实际全部通过 |
| standalone 默认模式 | 最新 `default/actual-run.json` 于06:22:51结束 **direct2**，full Vitest direct1；462文件/3763 assertions PASS/60 skip/0assertion FAIL 不足以推翻进程失败。JSON-only reporter没有保留实际失败原因，composer正向根任务报告诊断补全；不猜产品失败、不降低原预算 |
| standalone --with-e2e | 尚未得到本轮完整直接0，不拿默认模式、可预期 sibling 对照 skip 或历史结果替代 |
| Linux最终visual/payload/asset | 原8/12/asset直接0、无skip/flaky/基准更新，9实际PNG回读；之后三 stream 测试变更的真实文件集合/COPY漂移另列，完整 installed Tailwind old/current候选生成CSS逐字相同，不伪称当前全树0drift |
| Docker完整范围 | 本期最终两canonical image、实际BuildKit COPY、原3probe、真Nginx双hostname OIDC、init停机、mandatory smoke15→0与无9全部直接0。两旧stream测试已被COPY、新unit不在旧COPY；生产/配置和实际运行消费者不变，不能把测试树变化抹掉 |
| 最终本地入口/后端/契约audit | 本地最终三入口仍按root/cap实际调度收口；backend完整四分片/blocking/lint历史最终源边界保留；OpenAPI/extension fixture/audit/clean consumer有独立实际记录，不能由Docker/单测代替 |

## 追加变更与 Git 边界

stream 修复只涉及两旧测试文件修改和一个新增测试，无生产、配置或React模块变化。已独立重新枚举新增/删除集合，而非仅遍历旧receipt行；实际自动扫描候选完整生成CSS为202104bytes、SHA `23044705e630d37342dcf5fd7e6e442a7a7352c0f9c066a0a0173b8030682054`，old/current逐字相同。完整方法和消费者闭包见 [stream 独立复核](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-stream-fixture-independent-review-stage39.md)。

Git仍在main-wc，HEAD `a7804539530846baecf548af7b5d2612deb89b68`；marker仍是历史reviewed commit，当前脚本还发现watched范围扩展未确认、dirty/untracked变化，状态 **REVIEW_REQUIRED**。本次审查不等同全部上游变更已提交/接受，不自动更新marker、不提交或push。

来源入口：[原计划](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-period-plan.md)、[当前根receipt](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage39-checkpoints/progress-observed.json)、[完整跨端日志](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/root-stage39-checkpoints/cross-app.log)、[standalone实际退出](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/2026-10-10-standalone-stage39/default/actual-run.json)、[Linux报告](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-linux-stage39-final.md)、[Docker报告](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-container-ingress-stage39-final.md)。本次只新增本审查报告，未改变上述冻结输入。

06:27读取补证：[最新canonical receipt](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/capabilities-final-stage38/repair-round-3/canonical-receipt.json) 与 [新聚合receipt](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/capabilities-final-stage38/repair-round-3/aggregate-receipt.json) 已据实际结果更新上表。standalone JSON-only失败诊断缺口已由root明确授权composer作最小gate-only观测修复，仍待其冻结与受影响检查，不记为产品修复。
