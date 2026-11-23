# 消息区容量、焦点与追尾根因收口（Stage38）

本报告只记录本轮消息宿主修复。生产六文件于 **2026-10-10 03:57:29.751 CST** 捕获冻结，
包含根任务最后的注释清理；准确路径、原始字节 SHA 与本域聚合 SHA 见
[`production-freeze.json`](evidence/chat-viewport-focus-stage38/production-freeze.json)。
这份清单仅覆盖本域六生产文件，不是完整构建输入清单。

## 已证实的根因与实际接线

1. **过时的焦点 rAF。** 旧 Vue 与 React 普通聊天会在焦点已经从 A 转到 B 后，仍执行
   A 的延后 `scrollIntoView`。原始 Call ID / Tool details 完整交集比率小于 1，并非字号
   或浮点容差门禁错误。现在回调同时检查连接状态及 `target.ownerDocument.activeElement`；
   外层原生 pan 活跃时使用标准 `center`，其他布局保留 `nearest`。真实 A→B、失焦、卸载和
   不同 document 回归保留。React 自定义 Agent 页原来没有该回调，未增加新处理器。
2. **可用高度被消息区之外的 header 与 composer 占用。** Agent 完成态旧消息 scrollport
   只有 38px，而按钮高 64px；todo 可被压到 0px；clarification textarea 高 234px，
   旧 port 只有 206px。在高度 360px 的窗口，184px header 放在外层 pan 之外，调整消息
   内部常数无法产生足够可见容量。两端普通/Agent 宿主现把 header 移入既有 main，
   在命名内容容器 `chat-pane` 小于 48rem 时进入普通 flow，并由该 main 原生滚动。
   消息 flex item 使用 `min-height:auto` 的内容下限与 `max-height:100dvh` 的上限，保留
   原有有界物理 scrollport、虚拟化、历史锚点和 wheel 行为。没有采用历史候选 12rem 或
   40dvh 常数。浮动 header 的顶部预留在同一个容器条件下取消，save hint 实际间距保留。
3. **只按视口宽度响应不足。** 宽 1280px、根字号 32px 时实际分栏只有 767px，旧 header
   工具条将主 pane 撑到 Vue 827px / React 825px。命名容器条件随根字号缩放，header action
   行自然换行；不是按 360px 样例做像素补偿。普通桌面布局的全部现有节点几何保持不变。
4. **追尾动画与阅读焦点竞争。** 原生键盘已将旧消息动作显露，但既有 tail rAF 随后把
   scrollTop 从阅读位置写回尾部。Vue 的实际消息 scroller focusin 调用原
   `VirtualMessageList.stopFollowingTail`；React 的静态/虚拟消息 root focus 调用原
   `StickToBottom.stopScroll`。没有新增物理写入 owner。Vue 继续使用原 tailRequest；
   React 两页从现有 `useThreadStream.onSend` 显式递增 tailRequest，经 MessageList 传入
   VirtualMessageList，再调用原 `scrollToBottom`。send、regenerate 与 edit replay 共用
   原 onSend 路径；历史 prepend、远端 human、assistant append 不被推断为提交。
5. **子菜单无法越过祖先层叠上下文。** React welcome composer 处在 z30，而 header 为
   z40；子 listbox 即使提高自身层级仍被 header 命中。三宿主现仅在包含真实 listbox 时
   使用标准 `:has([role=listbox])` 将原 composer 宿主置于 z50；关闭回到 z30。
   没有恒定提高整个 composer，也没有新 portal、坐标或状态 owner。

生产路径：

- `frontend-vue/app/components/chat/AgentChat.vue`
- `frontend-vue/app/components/chat/MessageList.vue`
- `frontend/src/components/workspace/chats/chat-page.tsx`
- `frontend/src/app/workspace/agents/[agent_name]/chats/[thread_id]/page.tsx`
- `frontend/src/components/workspace/messages/message-list.tsx`
- `frontend/src/components/workspace/messages/virtual-message-list.tsx`

## 已执行证据与边界

| 验证                                                         | 结果                                                                             | 边界                                                                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue focus/scroll owner、原虚拟化、save hint/header 定向 unit | 5 files / 37 PASS，直接 exit 0                                                   | focus 函数的 mounted DOM fixture 提取实际 SFC 回调，不冒称完整 AgentChat 路由集成                                                            |
| React focus/scroll owner、原虚拟化定向 unit                  | 3 files / 10 PASS，直接 exit 0                                                   | 提取实际普通 page 回调；实际 VirtualMessageList 消费者验证焦点停止和显式 tail 恢复                                                           |
| Vue app/tests types、React types                             | 全部直接 exit 0                                                                  | 本轮源与测试的静态类型门禁；最终完整 React check 由根任务重跑                                                                                |
| 本域 Vue/React scoped lint                                   | 均直接 exit 0                                                                    | 修复 AST fixture 的 VM 执行与 mock 引用，未屏蔽 lint 规则                                                                                    |
| 最终结构/CSS、已有 tail owner 的独立浏览器因果验证           | 24 / 24 PASS，直接 exit 0                                                        | 旧编译预览中注入最终候选 DOM/CSS；四类消息 × 双端 × 三尺寸，不等于新源码编译结果                                                             |
| React Agent 原生焦点专项                                     | 3 / 3 PASS，直接 exit 0                                                          | 没有注入任何 scrollIntoView/focus handler；原生 ShiftTab→Tab、ratio 1 与严格 survey 保留                                                     |
| Showcase 两报告 × 双端 × 三尺寸                              | 原 11 PASS / 1 FAIL；剩余低高度 oversized PRE 用当前量具复验 1 PASS，直接 exit 0 | 800px 高度下 PRE 440/480px、长链接 230px 均按 ordinary 完整控件规则达到；额外 360px 高度的 480px PRE 使用原 oversized 首尾规则，未豁免或放宽 |

24 组验证为 Agent 完成态、Tool details 展开错误态、todo、clarification，尺寸为
360×800、360×360、1280×800，根字号均为 32px。每组保留原 native keyboard、完整
IntersectionObserver ratio 1、四项严格 survey；同一次 JS frame 比较所有现有桌面节点，
全部几何零差异。失败候选及真实红日志保留，没有将历史候选绿结果外推为最终编译绿。

已加入 `frontend-vue/tests/e2e-parity/chat-scroll-owner-reflow.spec.ts` 的两端正式回归，
覆盖上述四类消息与两个真实 Showcase，保留同一个 scroller、非空实际控件集合、原生
ShiftTab→Tab、完整 ratio 1、真实 bounded error 展开内容不变及所有 API 被 fixture 接管。
原四条 welcome / 90 轮虚拟历史门禁保留。command 另外四条正式用例保留原 native trial，
并检查真实宿主打开 z50 / Tab 接受或 Escape 关闭后 z30。

## Fresh compiled Showcase fixture 根因与正式回归

本轮实际编译的正式容量矩阵首次出现 React Showcase c02 的非空 PRE 断言为 0。
保存的 trace 证明 `POST /mock/api/threads/c02bb4d5-4202-490e-ae8f-ff4864fc0d2e/history`
被严格 `**/api/**` catchall 中止，页面最后显示 Failed to fetch，没有载入消息。
原因是新容量用例缺少 React Showcase 的只读保存历史 fixture；既有 chat-content 用例已经
接管此请求。此前 PRE 1 / links 5 的诊断没有该 catchall，解释了两次库存不同。
这不是虚拟化或异步 Markdown 把已加载内容丢失。

保留该 catchall 的最小红对照直接 exit 1，唯一未接管请求就是上述 POST。修复把已有逻辑
抽为小型 `support/saved-showcase-history.ts`，两个消费者共同读取准确 thread.json，
只接管该 thread 的 POST，其他方法继续 fallback 到 catchall。原 CROSS_APP_BY_DESIGN
声明随实际读取点移到共享模块；没有增加声明数、扩大请求放行或删除 PRE/link 非空断言。

- 新容量正式两端 2 用例：**2 PASS，直接 exit 0，52.3s**。保留四类消息、两个 Showcase、
  三尺寸、真实键盘、ratio 1、同一 scroller、严格 survey 和完整错误内容断言。
- 既有 chat-content 两端消费者：**2 PASS，直接 exit 0，33.1s**，各自原九终态完整执行。
- scoped lint、Prettier check、正确的 vue-tsc tests、standalone-check：均直接 exit 0。
  一次误用普通 tsc 的 .vue 声明错误日志保留，未通过改源或屏蔽类型绕过；正式命令已通过。
- 仅四个 test/registry 文件变化，生产六文件未变。准确 SHA、红绿日志、配置、JSON 与原始
  失败 trace 见 [`showcase-pre-fixture/`](evidence/chat-viewport-focus-stage38/showcase-pre-fixture/)。

**最终边界：** 上述 fresh compiled 正式四用例已经通过，不外推到完整跨端集合。
Linux Stage38 的原 8 visual / 12 payload / asset 与 9 图补证也已完成，见对应精确快照报告。
随后根任务又落了 SettingsDialog 的真实容量生产修复，另有 Dropdown 根因收口，因此这些
结果保留为该旧快照的有效 checkpoint，不能作为最新源的最终验收。最新完整 canonical、
跨端、Linux、standalone 与 Docker 由根任务统一安排。实际输入 receipt 必须覆盖全部
执行的构建和 gate 来源，以及位于产品副本之外的观察工具，不能只记录本域六文件。

日志、每状态 geometry/survey JSON 与诊断脚本在
[`evidence/chat-viewport-focus-stage38/`](evidence/chat-viewport-focus-stage38/)；脚本中的
临时绝对路径只用于说明当时已执行环境，不是可直接执行的最终交付入口。

## React 静态消息的真实滚动归属修复

后续完整 combined React 只扫描到 210 / 211 终态：公开 Showcase 的正确 Reasoning
按钮接受了一次原生点击，却仍保持关闭，原 30s 内容断言失败。保存的 trace、同一节点
身份和真实 pointer/focus/scroll 调用栈排除了历史加载、隐藏首节点与 remount。

真实顺序是 pointerdown 时按钮 y648、消息 scrollTop 270；focusin 经现有 stopScroll
引发 Context 更新，原本无职责的 TanStack virtualizer 此时才取得父组件的 late ref，
在 pointerup 前通过 `_willUpdate → _scrollToOffset → scrollToFn` 写入 scrollTop 0。
按钮随之移到 y918，pointerup 命中其他内容，原生 click 无法切换该 disclosure。
main 的 focus rAF 在 pointerup 后才恢复 270；单独禁止它的 scrollIntoView 仍会失败，
所以修复没有删除正常焦点行为。

静态消息少于 60 组时，`VirtualMessageList` 现在向实际 `useVirtualizer` 传入
`enabled: false`；跨到 60 组后启用，并用标准 `initialOffset` 读取同一原生 scroller
当前位置。物理滚动仍只有原 owner，没有新增 writer、延迟、坐标补偿或 Vue 改动。

- 使用实际 TanStack hook/core 的 mounted 回归：旧生产 **3 FAIL，直接 exit 1**；
  修复后与原 focus/threshold/tail 回归合计 **4 files / 13 PASS，直接 exit 0**。
  覆盖 late-ref 首次焦点不改 270、同一 disclosure 节点切换、59↔60 保留位置、
  静态重渲染不恢复跟随及显式 tail 请求仍由原 owner 执行。
- 正确 reducedMotion 的原生诊断中，精确阻止已确认的 virtualizer top0 写入，
  **2 PASS，直接 exit 0**；其中一次实际命中该 writer，另一次已稳定未尝试写入。
  该诊断保留原焦点处理和单次原生点击，不能代替新生产编译后的完整 211 终态验收。
- 本轮 tsc、scoped lint、最终 Prettier check 均直接 exit 0。生产/测试准确 SHA、
  红绿日志和调用栈见 [`showcase-public-reasoning/production-freeze.json`](evidence/chat-viewport-focus-stage38/showcase-public-reasoning/production-freeze.json)。

当前完整 React check / unit 的输入指纹与直接退出码另存
[`showcase-public-reasoning/full-react-verification/`](evidence/chat-viewport-focus-stage38/showcase-public-reasoning/full-react-verification/)。
本轮 **完整 check 直接 exit 0、314 files / 2887 tests 全 PASS、完整 unit 直接 exit 0**，
没有 skipped、todo 或失败，Rstest 实际耗时 38.339s。1297 个仓库/实际生成类型输入前后
SHA 均为 `df4a386a51dd1c3a2118c51a907f10b0edb2b188b400c23bad7800bf2a2228db`，
73904 个安装依赖物理文件、依赖 symlink 和执行工具也均无漂移。该范围含合同、共享来源、
扩展示例与 backend catalog fixture，准确选择及排除项写在 receipt，未用旧 313 / 2884
读数代替本轮执行。

此结果先于 artifacts 负责的 input-box sidecar 装饰 1px 修复写窗口；如该源随后变化，
本轮仍是精确 checkpoint，不能外推到后改源。新编译的原 211 终态和完整跨端验收待根任务
统一刷新执行，生产修复与实际浏览器诊断、mounted 行为回归和全量单测的证据分别保留。
