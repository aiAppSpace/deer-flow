# Followups、文件自动打开与聊天宿主生命周期修复

生产冻结时间：2026-10-10 07:22:10 CST。本文只记录本次四个生产文件及其消费测试；不是全项目验收通过声明。

## 结论与边界

本次聚焦回归实际通过：React **4 文件 / 81 项**，Vue **7 文件 / 48 项**；双方类型、局部 ESLint 与格式检查均直接退出 0。四个生产文件的冻结 SHA 在验证结束后再次逐一核对一致。

新生产源码尚未完成编译后浏览器验收。旧真实截图失败仍为 **FAIL**，旧基准与 `maxDiffPixelRatio: 0.02` 未改变。原完整聚合为 **567 PASS / 1 FAIL，直接退出 2**；其后 backend 16 项与 external 3 项 **UNRUN**。这些结果不能用聚焦单测替代，也不能外推此前 Linux、Docker、standalone 或本地入口快照为当前源码通过。

精确收据：

- [生产冻结与四个 SHA](evidence/capabilities-final-stage38/repair-round-3/real-render-failure/product-cluster-freeze-stage40.json)
- [最终测试、类型、格式与源文件核对](evidence/capabilities-final-stage38/repair-round-3/real-render-failure/product-cluster-validation-stage40.json)
- [原完整聚合](evidence/capabilities-final-stage38/repair-round-3/aggregate-receipt.json)

## 已证实的根因与修复

### React 后续问题生成丢失完成边沿

真实浏览器记录显示，同一 InputBox / textarea 生命周期内，run 在约 950ms 进入 ready 时 `disabled=true`，约 984ms 才恢复为 false。配置已经成功返回，不是配置缺失或组件重挂。旧 effect 在 disabled 状态消费了 streaming→ready 边沿，后续恢复不会重新生成。

`frontend/src/components/workspace/input-box.tsx` 保留一次待接纳的完成快照，绑定 composer lifetime、thread、user、model、消息与 AI ID。接纳恢复后恰好一次 POST；Stop、新 run、身份切换与卸载会退休快照并中止请求，晚返回不能污染新 owner。历史首次挂载与禁用配置仍不生成。

真正挂载旧生产组件的回归先得到 **2 FAIL / 6 PASS**；修复后扩展的 12 项均通过。覆盖 disabled 恢复、配置晚到、历史初挂、Stop、新 run、thread/user/lifetime、卸载与晚返回。最初 sandbox 本地端口 EPERM 单独保留，不计作行为 RED。

### 自动打开副作用归属错误

React 原 ToolCall 被 `FlipDisplay` 的退出动画保留，后继工具出现时旧子组件仍持有旧 `isLast` 和 100ms 定时器。真实挂载测试证明短 pending 返回会取消，但换成不同最后工具时旧文件仍会打开。另一个独立问题是 `finalize_artifact_write` 属于 generic step，成功文本位于实际 `resultMessage`，原判据读不到它。

React 将 effect 放到实际当前最后工具所在的 MessageGroup owner，读取真实结果消息；保留 100ms 延迟、autoOpen/autoSelect 与已选同目标的判断。目标、资格、选择变化或卸载均清理旧定时器。工具手动打开 finalize 路径也读取同一实际返回。

Vue 原先扫描本 run 中曾出现的 write 调用，短 Replay 已完成后仍会打开。现在从实际消息分组取当前最后工具：普通 write/replace 仅在最后组仍 loading 且尚无结果消息时调度；成功 finalize 读取真实返回文本。watch 同样清理 100ms 定时器，不另造路由 owner。

旧源真实挂载结果：React **4 PASS / 2 FAIL**；Vue **1 PASS / 8 FAIL**。最终两端各 13 项生命周期测试通过，涵盖短/长 pending、后继工具、历史、run 结束、路由/卸载、配置关闭、同目标与失败/空 finalize。React 挂载完整 MessageGroup；Vue 抽取实际生产 computed/watch 语句放入挂载 owner，并使用真实消息分组逻辑。Vue 的这部分不是整个 AgentChat 编译后验收。

### 公共案例丢失 Todo 状态

Vue 公共 fixture 原先只发布 messages/artifacts/title，未发布 `values.todos`。研究报告案例真实包含 9 项 Todo。现在 todos 与其它 demo 数据共享同一个路由 watcher 和 AbortController fence，切案例同步清空、拒绝旧响应、离开或卸载时退休；既有 TodoList 继续负责展示与键盘语义。

旧源 **3 FAIL / 1 PASS**；修复后 4 项通过。测试挂载实际 TodoList，验证公开报告数据、全部文本、折叠、案例切换、晚响应与卸载。

### 附件准备完成后欢迎状态未退休、项目标题缺失

React 附件准备成功后将新聊天切换为 materialized thread；Vue 虽正确接纳 UUID，但欢迎状态只看空消息与历史加载，因此仍显示欢迎建议。Vue 现在仅无实际 route thread 时进入欢迎态。旧源 3 项全失败，修复后全通过，并保留 bootstrap/agent 路由边界。

React 普通聊天会在元数据带 project_id 时显示真实项目名称链接；Vue 原宿主没有该调用点。新 `ProjectAffiliationBadge.vue` 消费现有 `useProject` canonical Query，使用相同图标、链接和样式；pending/error 无数据时隐藏。AgentChat 仅普通非 demo 的已存在聊天消费该徽标。实际元数据、切项目/删除错误与 demo/agent/new 负向共 5 项；旧宿主 **2 FAIL / 3 PASS**，新宿主全通过。测试消费实际宿主 header 片段、computed、新组件与 QueryClient；不冒称完整 AgentChat 浏览器通过。

## 浏览器合同保留

`frontend-vue/tests/e2e-real/artifact-write.spec.ts` 保持一个原有案例。短 Replay 不再预设每次自动打开；先等待实际回答，再通过真实 “more steps” 和写入工具步骤打开文件。文件正文、Range 206、Content-Range、ETag、浏览器读取、PUT revision、412 冲突、编辑、焦点和下载等原后续断言保留。长 pending 的 socket suite 继续承担流式草稿自动打开合同。

本次没有调整请求/截图预算、减少案例、增加 skip 或更新截图基准。新编译产物必须继续执行原完整 mock→backend→external，以及受影响的双端实际 UI 对照，之后才能判定截图是否仅含过时样式。

## 证据索引

以下均位于 `docs/reports/evidence/capabilities-final-stage38/repair-round-3/real-render-failure/`：

| 证据                                                                     | 实际结果                         |
| ------------------------------------------------------------------------ | -------------------------------- |
| `followups-mounted-red-native.log`                                       | 旧 React 2 FAIL / 6 PASS         |
| `artifact-autoopen-react-mounted-native.log`                             | 旧 React 4 PASS / 2 FAIL         |
| `artifact-autoopen-vue-mounted-red.log`                                  | 旧 Vue 1 PASS / 8 FAIL           |
| `demo-todos-mounted-red-native.log`                                      | 旧 Vue 1 PASS / 3 FAIL           |
| `reference-welcome-red.log`                                              | 旧 Vue 3 FAIL                    |
| `project-affiliation-header-red.log`                                     | 旧 header 3 PASS / 2 FAIL        |
| `cluster-react-consumers-frozen.log`                                     | 当前 4 文件 / 81 PASS，0 skip    |
| `cluster-vue-consumers-frozen.log`                                       | 当前 7 文件 / 48 PASS，0 skip    |
| `cluster-react-types-frozen.log`                                         | 当前 React tsc 直接退出 0        |
| `cluster-vue-app-types-frozen.log` / `cluster-vue-test-types-frozen.log` | 当前 Vue 两份 vue-tsc 直接退出 0 |
| `cluster-react-lint-frozen.log` / `cluster-vue-lint-frozen.log`          | 当前局部 lint 直接退出 0         |

初始假时钟把微任务也冻结造成的测试超时、fixture 缺失包、模板提取错误及 beforeEach 误返回 mock 函数，均作为测试准备错误保留；未把它们混入生产行为 RED。最终真实 effects 使用只替换 setTimeout/clearTimeout 的时钟，未扩展任何测试时限。
