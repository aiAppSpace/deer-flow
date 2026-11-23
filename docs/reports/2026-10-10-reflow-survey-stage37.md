# Stage37 reflow survey: fractional layout root cause

Recorded 2026-10-10 CST. This is a gate-only correction; no product source or running Stage37 cross-app copy was modified. The app under observation is the root-owned immutable snapshot served at Vue 3250 / React 3251 / Gateway 8150. Its source receipt remains `docs/reports/evidence/root-stage37-checkpoints/`.

## Proven cause

The previous `layoutScale` divided `DOMRect.height` by `offsetHeight`. `DOMRect` preserves fractional layout pixels; `offsetHeight` is integral. The Vue directory's ordinary native scrollport was 687.015625px tall with offset/client height 687, with no CSS transform. The inferred 1.0000227438 scale made a long scroll undershoot the unchanged 0.5px visibility boundary. React's corresponding 687px port did not infer that phantom scale.

The unmodified old helper reported 17 lost controls / 33 recovered. A diagnostic-only scale=1 measurement of the same static Vue product yielded 0 lost / 50 recovered; all 16 View details buttons also scrolled fully into the actual native viewport. This diagnosed the cause and was not accepted as the final implementation.

## Correction and actual focused validation

`reflow-survey.ts` now composes actual CSS transform matrices, individual scale and zoom along the ancestor chain. Translation and transform origin affect position rather than scroll-distance scale. It no longer infers CSS scale from rounded layout dimensions.

The existing positive-control case now contains an ordinary 687.015625px scrollport with 6318.6px content before the button. It failed against the old helper (recovered 0 instead of 1) and passed after the correction. Existing scale(2), escape/containing-block, nested clipping, oversized-window, legal PRE/CODE owner, inline/contents and restoration checks remain. Additional matrix × individual-scale, zoom × transform and scale × zoom native controls pass in the same case. Net new Playwright cases: **0**.

Executed against real Chromium, all direct exit statuses recorded:

- Fractional regression RED: 1 test failed, exit 1.
- Original and expanded calibration controls: 5 passed, exit 0.
- Unchanged formal directory regression: Vue + React 2 passed, exit 0.
- Tests typecheck and scoped ESLint: exit 0.

No threshold, clip threshold, legal overflow rule, oversized rule, registered state or sample was changed. The 0.5px and 24px values remain unchanged.

## Full matrix and independent remaining findings

The corrected helper's complete Vue 211-state diagnostic run finished **FAIL**, direct exit 1: scanned 211, initialOutside 1770, recovered 1713, lost 57, horizontal 0, clipped 0, droppedDialogs []. It used independent contexts against the same static product. The original Stage37 Vue macro result (268 lost / horizontal 0 / clipped 0) remains historical RED evidence. Focused success must not be extrapolated to the full macro.

One independent remaining product issue is already proven: `agent-chat#completed-turn` has a 38px native message scrollport and 64px action buttons. Native Shift+Tab → Tab produces real focus but cannot expose the whole button (button y171..235 against port y184..222). This is not the fractional-scale cause. The sidebar slash popup's initial position is also outside its main scrollport; blur/reopening changes its placement, so placement lifecycle and stable geometry need separate diagnosis.

Evidence lives at `docs/reports/evidence/reflow-survey-stage37/`, including old and diagnostic directory JSON, actual RED trace/PNG, calibration and formal logs, type/lint logs and exact two-file candidate fingerprint. Direct IntersectionObserver ratio failures being investigated by another agent are not treated as fixed by this helper change.


## Modal capacity correction — source frozen, new compiled proof pending

The corrected full scan isolated the same real capacity failure in both apps: the settings shell left 135px for content under stacked navigation, while model form fixed chrome left 18px for 72px fields. Narrow layouts now keep the modal's height limit but allow native outer scrolling through natural-height navigation/panel or model form. Desktop retains its bounded content scrollport. Only Vue SettingsDialog/ManagedModelEditor and React settings-dialog/model-settings-page production files changed; Memory/Channels business logic and generic dialog primitives did not.

A causal twelve-case browser run (six states × two apps) passed directly with exact zero desktop descendant-rectangle changes, same modal identity, real wheel movement and all strict survey arrays empty. The corresponding new `settings-capacity-reflow.spec.ts` against the unmodified old compiled apps recorded twelve real failures; no existing assertion was removed. Vue related units 2 files / 8 cases, React 1 file / 4 cases, both app types, Vue tests types and scoped lint exited 0. The initial restricted Rstest invocation failed before tests at its loopback listener; the authorized same command outside that sandbox passed, and both logs remain.

The fresh compiled twelve-case proof remains **PENDING** the parent's unified source build. The exact source/test/doc receipt is `evidence/reflow-survey-stage37/modal-source-freeze.json`. The original 211 scan and remaining PRE/report/Mermaid failures are not declared fixed by this correction.


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


## 2026-10-10 04:38 CST — 新compiled容量14正式PASS

父任务实际统一源码5573inputs SHA192904942e4a470105c4ca7c18ab2e4b04d49a222c21695320445353350d4251，经canonical构建在Vue3270/React3271运行。本域从同一副本的Playwright/spec/helper读取，独立contexts执行新增report2与model/Memory/Channels12正式用例，主命令直接exit0：14PASS、0skip、0flaky、errors[]，36.2s。原实际wheel/同owner、完整动作容量、原生键盘focus/ratio、全文与原文/href、严格全部clip交集和横滚/survey断言均保留。执行后9项所选生产/测试/helper当前仓库与副本逐字零drift。

该结果关闭此前本域modal12/report2的新compiled PENDING。精确命令、父快照引用、JSON stats、逐文件SHA与范围在 `docs/reports/evidence/reflow-survey-stage37/final-compiled-capacity-14-receipt.json`；对应完整log/JSON和临时config的durable副本相邻。先前0执行的双Playwright实例collector配置错误单独保留为runner checkpoint，修成副本单实例后真实collection14/direct0；未计入产品FAIL/PASS。

**这只是14项新compiled容量验收，不代替完整909产品矩阵、双端211宏观重流、751主diff、真实Gateway、Linux或Docker/OIDC。** 父完整cross仍运行；Docker尚未启动最终重build，受控OIDC真实容器阶段仍UNRUN。没有改动正在运行的父副本或任何冻结生产/测试输入。
