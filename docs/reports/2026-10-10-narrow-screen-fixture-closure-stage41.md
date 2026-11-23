# 窄屏宏与共享场景根因收口

本轮代码、夹具和测试在 **2026-10-10 08:38:22 CST** 冻结。定向门禁通过；两端完整窄屏宏和新生产源码的统一编译验收仍待执行，不能将旧预览上的夹具验证外推为新源码全量通过。

完整路径、逐文件 SHA、直接退出码与边界见
[冻结 receipt](evidence/narrow-screen-overflow-stage41/final-freeze-receipt.json)。本轮 13 个源码、测试和架构文档输入聚合 SHA 为 `0bfa5f728dc010a364f8787cde1d3ccdaf98b798845c0b17e24200fcc935f225`。

## 原始失败与保全

旧完整宏的 Vue / React 主扫描均实际失败，约 12.3 分钟；桌面打开后缩窄的补充扫描分别通过，约 23.1 / 27.2 秒。两个完整失败的 trace、截图、错误上下文和解码 snapshot 共 426 个文件、496190347 bytes 已保全，逐项 SHA 见
[preserved-files.json](evidence/narrow-screen-overflow-stage41/preserved-files.json)。

旧 Vue 的 13 个非预期不可达、React 的 11 个非预期不可达，及双方原登记的 13 个移动不可达均保留在
[compact.json](evidence/narrow-screen-overflow-stage41/compact.json)。下表按原失败逐项映射，没有删除状态或扩大不可达名单。

| 原状态                                                   | Vue / React 原失败 | 根因及本轮处理                                                                                                                 | 当前验证边界                                                                   |
| -------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `agent-chat#model-picker`                                | 双方               | 原 settle 等待移动端隐藏的 header 名称；桌面 / tablet 原名称断言保留，mobile 等待真实 Toggle Sidebar 入口，后续完整状态不变    | 旧编译预览 + 新共享场景，两端实际 PASS                                         |
| `agent-chat#completed-turn`                              | 双方               | 同上；保留完成答案状态                                                                                                         | 两端实际 PASS                                                                  |
| `settings-sync#account-preference`                       | Vue                | 账户 preference owner 真实卸载 / 重挂载后，模块级 mobileOpen 仍为 true，旧 Sheet 与持续存活的 Settings Dialog 互相 aria-hidden | 真实旧浏览器 RED；新真实 Sheet + Dialog 组件 / owner 回归 PASS；新编译仍待执行 |
| `settings-sync#restored`                                 | Vue                | 同一宿主生命周期根因                                                                                                           | 同上                                                                           |
| `settings-sync#toggle`                                   | Vue                | 同一宿主生命周期根因                                                                                                           | 同上                                                                           |
| `settings-model-sync#thread-model-and-account-effort-zh` | 双方               | 返回 composer 前未关闭临时移动抽屉；窄屏宏另将明确中文 state 强制为英文输入                                                    | Vue 实际中文移动 PASS；React reasoning trigger 的生产修复由 cap 持有，待新编译 |
| `settings-model-sync#thread-model-and-account-effort`    | 双方               | 临时移动抽屉保持打开；React 另有 reasoning trigger 的 hidden 样式                                                              | Vue 实际移动 PASS；React 新编译待执行                                          |
| `settings-model-sync#mode-menu`                          | 双方               | 同上                                                                                                                           | Vue 实际移动 PASS；React 新编译待执行                                          |
| `settings-model-sync#custom-agent-effort`                | 双方               | 同上                                                                                                                           | Vue 实际移动 PASS；React 新编译待执行                                          |
| `thread-activity#opened-read`                            | 双方               | 导航后抽屉已关闭，旧步骤继续断言抽屉内 active / unread 行；补实际打开抽屉操作后保留原状态断言                                  | 两端实际 PASS                                                                  |
| `thread-delete-confirm#confirmation`                     | 双方               | 桌面步骤直接 hover 未打开的移动抽屉；补实际移动入口                                                                            | 两端实际 PASS                                                                  |
| `thread-delete-confirm#cancelled`                        | 双方               | 同上；保留取消后原会话仍存在的断言                                                                                             | 两端实际 PASS                                                                  |
| `thread-delete-confirm#deleted`                          | 双方               | 同上；删除完成后 React 抽屉仍开，原 greeting 被隐藏；移动流程按 Escape 关闭临时抽屉后继续原 greeting 断言                      | 两端实际 PASS；原首次 React greeting RED 也保留                                |
| `workspace-changes#reasoning-menu`                       | React              | 移动端 reasoning trigger 被 CSS 隐藏；cap 已最小修复 trigger                                                                   | 新编译待执行                                                                   |

移动模型流程曾用第二个 Escape 试图关闭 Sheet，真实 Vue 仍失败，该负控保留在
[model-mobile-escape-before.json](evidence/narrow-screen-overflow-stage41/model-mobile-escape-before.json)。最终步骤使用可见 Toggle Sidebar 按钮并等待真实移动 Sheet 隐藏；没有把账户刷新当作关闭动作。

中文 state 继续使用原中文 Reasoning Effort 断言。旧宏强制英文时，3 个英文状态 PASS、中文状态 FAIL；
[原日志](evidence/narrow-screen-overflow-stage41/model-mobile-native-results.log) 与对应截图保留。
最终仅 primary 的 locale 取 `state.dimensions?.[0]?.locale ?? "en-US"`，mobile / light 不变，
[四状态新日志](evidence/narrow-screen-overflow-stage41/model-mobile-native-green.log) 实际全部 PASS。

## 唯一新增生产修复

`frontend-vue/app/components/workspace/ThreadSidebar.vue` 的既有 `onUnmounted` 清理中关闭移动抽屉。
这个唯一宿主负责释放自己的 mobileOpen 生命周期；没有把 reset 分散到 Settings / account / 路由消费者。
正常路由继续原有关闭逻辑，同账户渲染不重置抽屉，桌面 collapsed 与 cookie 不变。

该文件最终 SHA 为 `810ebbac7038ef37010ae2cbcc9274ceaf8fd9dcb1414e27ad86c27f0ef85029`。
此前 `93fa6…` 之后仅纠正同文件里已经退役的 inline alert 旧注释；可执行修复仍只有卸载时关闭抽屉。
架构文档同时写明这条生命周期，不再描述已删除的 inline alert。

旧真实浏览器观测到 Vue 两个互相隐藏的 dialog、React 一个正常 Settings dialog，API catchall 均零漏捕：
[mobile-owner-native-red.json](evidence/narrow-screen-overflow-stage41/mobile-owner-native-red.json)。
真实 ThreadSidebar、Sheet、Dialog 与 useUserPreferencesBoundary 的 mounted 回归旧源 1 FAIL / 1 PASS，新源两条均 PASS。

前一轮 Toaster / toast store / ChatComposer / ProjectDocumentAttachDialog 的四个生产修复保持各自冻结 receipt，不在本轮重新归因：
[composer-keyboard-clusters-stage41](2026-10-10-composer-keyboard-clusters-stage41.md)。

## 横向代码 owner 与迟到夹具请求

双方唯一旧横滚报告来自公开报告中的 `data-streamdown="code-block-body"`。真实 owner 包含 PRE / CODE / token span，宽 265、内容 579，原生 wheel 可将 scrollLeft 从 0 移至 314，且 owner 有界。
窄屏旧扫描器只认识 PRE / TABLE，因此把真实 Streamdown owner 错判为普通 DIV。

本轮复用既有 `surveyReflow` 的精确代码 owner 内容判据，增加 horizontal-only 返回类型；完整默认扫描、全文可达规则、裁切规则和阈值不变。horizontal 结果只有实际执行的横向字段，不伪造 lostControls 为零。
新原生校准保持完整默认量具：合法 PRE / CODE owner wheel 正向、九类不合法 / 交互 / 无界 owner 负向，及普通 120px 按钮被 100px scrollport 裁切仍报 lost。

旧 `route.fulfill: Target page … closed` 的实际 callId / 延迟请求属于 agents gallery 的 15 秒 loading 夹具。
早期只按错误发生时的当前 context 推断为 thread-list-pin，是错误归因；完整旧 trace 保留，现按真实请求生命周期修复。
本页的 delayed-route owner 在 native page close 时取消自己的 timer 和 close listener，不再履行该已销毁请求。
存活页面仍等待完整 15000ms 并返回原 HTTP 200 / `[]`，没有 catch 吞 fulfill 错误或全局 ignore。

原生负控确证旧源关闭后仍调用一次 fulfill，实际 direct 1，trace 保存在
[route-owner-old-negative](evidence/narrow-screen-overflow-stage41/route-owner-old-negative/preserved.json)。
新正式两条分别验证零迟到 fulfill 与真实完整 15 秒响应，2 PASS / 16.0s / direct 0。

## 中文锚点的额外完整失败

旧完整 cross 的三个中文 tool detail state 硬编码英文 `Tool details`。
现在沿真实 locale 的 `toolCalls.details`，匹配具名 `mcp_lookup (call-4389)`；错 tool / 错 call / 附加前缀仍由负控拒绝。
三个状态在两端中文实际全部到达，6 PASS。

渠道 provider 的当前消费者会翻译已知 provider；旧夹具把后端 display_name 英文误当成固定 UI 名。
DingTalk / Feishu 入口改为当前两语言准确名称，行按钮仍限定 sidebar menu-item；原 token、创建 / 编辑 / 设置状态全部保留。
中文 default / runtime-config / runtime-config-edit 两端实际 6 PASS，所有请求由本 context mocks 接管，零 API 漏捕。

## 定向门禁与尚未完成范围

| 检查                                                                            | 实际结果                                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| mounted lifecycle、真实 dispatcher、实际注册宏 VM、相关 host / preference owner | 6 files / 21 PASS，direct 0                           |
| App 与完整 tests 类型                                                           | 两条 direct 0                                         |
| 13 路径中相关源码 / 测试 ESLint、Prettier                                       | direct 0                                              |
| 当前共享入口在旧编译两端上的 native 场景                                        | 18 + 6 channels + 4 Vue models = 28 PASS，零 API 漏捕 |
| 原生横向 owner 正负 formal calibration                                          | 1 PASS，direct 0                                      |
| 真实页面关闭与存活 15 秒响应 formal                                             | 2 PASS，direct 0                                      |

当前宏实际登记 **211 states、13 known mobile unreachable、两端各 primary + fallback**。
原三个 primary 与三个 fallback 断言数组全部保留；VM 实际执行注册回调，完整遍历登记集合，并逐项注入横滚、缺失状态、过时不可达表、dialog 丢失负控确认失败。
原 360px 测量、runScenario mobile 375px 后压窄流程、4000 / 30000ms 单状态预算、1800000ms 宏预算不变。
当前完整登记、每状态声明 / 实际 locale 和名单见
[current-macro-inventory.json](evidence/narrow-screen-overflow-stage41/current-macro-inventory.json)。

净新增正式 Playwright 用例为 3：原 narrow 文件中的 1 条校准，以及独立 route-lifecycle 文件中的 2 条。
新增 VM 守卫是 Node unit，不增加 Playwright 数量。完整当前 collector 总数由协调者重新实际收集。

**待统一新编译验证**：Vue Settings 同步三移动状态、React reasoning trigger 四模型状态及 workspace-changes 状态、两端完整窄屏 primary / fallback，以及最新完整 cross-app / canonical 门禁。
旧 Linux Stage39 的 8 / 12 / asset / 9PNG 与 Stage40 standalone default PASS 都保留精确旧源 checkpoint；本轮生产源不由那些旧 receipt 覆盖，当前完整 standalone with-e2e 仍 UNRUN。
