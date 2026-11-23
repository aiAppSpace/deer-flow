# 三轴浮层键盘：精确量具与搜索夹具修复

2026-10-10，测试源码冻结于 09:48:35 CST。本轮没有修改产品源码、运行中的旧副本、Gateway、预算、阈值或跳过名单。完整旧回流的 FAIL 原样保留；本轮定向通过不能替代统一最终源的完整回流。

## 原始失败与真实因果

旧完整日志为 `docs/reports/evidence/root-stage39-checkpoints/cross-app.log`。row907 完整三轴浮层宏执行 21.8 分钟后 FAIL：两端各遍历 211 个终态，发现 13 个含浮层终态、14 个浮层。Vue typeahead 为 11/14，React 同为 11/14；其他新增的 React 四条 Escape 失败属于旧产物隐藏 reasoning trigger 的独立问题，未在本次量具修复中放行或删除。

首次六个独立真实页面诊断，在原函数上观察到六个 `typeaheadWorked=false`。诊断程序故意断言这些旧失败存在，所以其 direct 0 / 6 PASS 仅证明因果复现，不是旧门禁通过。

| 终态 | 两端真实行为 | 问题边界 |
| --- | --- | --- |
| `mentions#all-reference-kinds` | 输入 `pdf` 后保留 `report.pdf` 和固定 `Upload a file` | 上传是固定 command，原量具将它作为未过滤的引用候选误判 |
| `extension-mentions#coexisting-candidates` | 两端确实发送带 query 的 search 请求；旧 route 对任何 query 恒回 Alice | 共享权威搜索夹具没有消费 query，不能靠在产品端二次过滤掩盖 |
| `settings-model-sync#thread-model-and-account-effort-zh` | 原 `keyboard.type("低")` 未产生菜单需要的 keydown；真实 trusted keyDown/keyUp 可将焦点移至目标项 | 非编辑菜单键盘驱动与文本插入通道混用 |

Vue 和 React 当前 MentionPicker 都先过滤引用，再追加固定上传选项。产品代码没有搜索缺陷。本机实际安装的是 Playwright **1.59.1**：`playwright-core/lib/server/input.js:63–67` 使用 US key map，未知字符的 `keyboard.press` 抛 `Unknown key`；`:96–107` 的 `keyboard.type` 对非 US 字符走 insertText。真实空白浏览器也证实 `keyboard.press("低")` 抛错，见 `repair/unicode-press-capability.json`。Reka `MenuContentImpl.js:198–211` 的 typeahead 消费 keydown 的单字符 key。

## 最小修复

1. `frontend-vue/tests/e2e-parity/triple-overlay-keyboard.spec.ts:398`、`:528`：只识别真实 MentionPicker 内、直接 role=group 下的 BUTTON、ID 精确为所属 listbox ID 加 `-upload` 的固定命令。仅从**引用过滤结果**中分离此命令，仍逐次发送原生 ArrowDown，要求它成为真实 active item 且有正交集。过滤读取限定到被测 listbox，不能混入另一个浮层。
2. 同文件 `:1235`：正向匹配后再输入确定无匹配后缀，要求零引用、上传命令仍在。此负向消费避免恒回 Alice 恰好命中正向 `team` token 而产生假 PASS。
3. `support/scenarios.ts:311`、`:445`：增加可选纯数据 `queryFilter`；固定安装器从请求 query 过滤声明的数据。不存在框架分支或可执行回调。`support/capability-scenarios.ts:417` 的 Team 搜索指定 label/description 字段；显式 `Team members` 与原产品 provider fallback 呈现相同。
4. `triple-overlay-keyboard.spec.ts:593`：ASCII 菜单字符继续使用 Playwright keyboard.press；当前 US key map 不支持的字符通过 Chromium CDP `Input.dispatchKeyEvent` 发出真实 keyDown/keyUp，并在 finally detach。输入框依旧使用原文本输入通道。初次及重复菜单 typeahead 共用该驱动。
5. 原校准用例中增加固定命令/搜索过滤和中文按键正反证；没有增加正式 Playwright 用例或减少旧断言。

## 实际验证

证据目录：`docs/reports/evidence/triple-overlay-keyboard-independent-stage42/`；最终修复证据位于其 `repair/` 子目录。

| 执行 | 实际结果 | 证据 |
| --- | --- | --- |
| 新权威搜索 unit 对旧夹具 | direct 1，5 FAIL | `route-filter-red.log` |
| 搜索、15 秒 route owner、场景覆盖 guards | direct 0，3 files / 16 PASS | `repair/focused-final.log` |
| 两端三个真实终态的原导航函数 | 6/6 PASS | `repair/*-green.json` |
| 同两端真实页面负控 | 8/8 成功检出失效 | `repair/native-results.json`，各变异 JSON |
| 原八轴校准加本轮精确正反证 | PASS | 同一次 native 结果第 1 项 |
| 最终 native 总执行 | direct 0，15 PASS / 0 skip / 0 flaky，48.6 秒 | `repair/native-results.log/json` |
| 全 tests vue-tsc、scoped ESLint、Prettier | 各 direct 0 | `repair/types-final.log`、`lint-final.log`、`format.log` |
| 原断言及用例保存 | 原 28 条 expect 表达式全部保留；28→37；原 2 个正式 case 仍为 2 | `repair/assertion-preservation.json` |

八个真实页面负控是每端各四项：恒回 Alice、漏掉正向搜索结果、伪造上传 ID、阻断中文 keydown 的产品消费。它们仍返回 `typeaheadWorked=false`；中文负控保留真实 trusted keydown/keyUp，证明失败来自未消费按键，而非没有送出按键。所有 14 个真实页面上下文均在安装场景之前默认阻断未捕获 API，实际漏捕为零，没有向 Gateway8160 写数据。

扩展校准另验证：未过滤普通引用、错误上传身份、缺上传命令、命令不可导航均不能通过；同名命令离开真实 MentionPicker 结构后仍作为 foreign 项被检出。文本插入不会冒充中文菜单按键；原生按键有 trusted=true 的 down/up，并且故意不响应的菜单仍被检出。

第一轮修复验证为 14 PASS / 1 FAIL：新增校准在同一 document 重复 setContent 时，脚本的顶层 const 重声明。该独立测试生命周期问题已修成 IIFE 和当前 menu 所有的 listener；完整现场保存在 `repair/first-native-run/`，后完整同 15 项 direct 0。首个 scratch 误混两个物理 Playwright runtime 的启动失败另保留于 `repair/duplicate-runtime-failed.log`，随后只用当前一个 runtime。两次失败均未以重试或忽略异常处理。

## 冻结与后续边界

完整路径、SHA256、mtime、direct exits、断言保存和范围记录在 `repair/source-freeze.json`。本轮仅三处原测试/fixture文件和一个新 unit 文件；正式 E2E 净增 0，unit 净增 5。真实浏览器 runner/config/通道能力验证和 AST 审计工具均有 `.snapshot` 保存。

当前最终源完整三轴宏 **UNRUN**，需根代理统一复制并完整执行全部登记终态、全部键盘功能断言；不能用本轮六个导航样本推断剩余浮层或四条旧 React Escape 已通过。旧完整 row909 的 Vue triple-reflow 后续仍 FAIL，属于独立持续回流，本轮未修改其量具或结果。报告写入时整体旧 cross-app 仍未看到最终 direct exit。Backend 第二轮完整验收继续依根代理排程 **HOLD**。
