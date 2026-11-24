# Vue 前端行为合同

本文记录 `frontend-vue` 已满足后必须持续保持、以及为了替换 React 必须达到的产品和
协议行为。它不是完成清单，也不表示每一条当前都已实现；**真实实现以当前源码为准**，
验证入口以 [README.md](README.md) 和各测试配置为准。

全表 **A–S 共 19 组**。A–K 与 O–S 是产品行为，L 是 SSE/会话协议约束，M 是 Vue
框架语义约束，N 是需要跨浏览器或跨层验证的模块。修改相关代码时必须同时更新本合同、
差异清单和对应测试，不能用单次全绿替代逐项判断。

本地门禁全绿**不代表**生产 IdP、DNS/TLS、外层代理、外部 provider 或目标部署环境
已经验收。发现新的未满足行为时，直接在本文件加合同并补测试——不要另建待办清单，
那种清单最后只会变成一份没人核对的自述。

---

## A. 流式与重连

> ⚠️ 本组原本由 LangGraph SDK 的 `useStream` 保证。改为**自研 SSE** 后，这些语义的实现方变成了自己——约束一条不减，另见 L 组的补强项。

| #   | 约束                                                                                                                                                | 为什么                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 同宏任务内的流事件要合并成一次通知，**不要用固定延时防抖**                                                                                          | 这是 SDK `throttle: true`（boolean 档）的语义。数字档是尾部防抖，chunk 持续到达时会一直推迟，饿死 UI 更新                                                                    |
| A2  | 所有生产聊天 run 创建入口必须请求 `messages-tuple` `updates` `custom`，不订阅全量 `values`；协议白名单仍允许 `values` `debug` `tasks` `checkpoints` | 字段缺失时 Gateway 会默认成 `values`-only：连接仍是 SSE，但回答失去文本分片，只能按完整状态成段刷新。含不支持模式时必须**在 HTTP 之前抛错**；`messages` 与 `events` 不被支持 |
| A3  | Vue run transport 原样发送已验证的 wire payload，不做字段剥离或兼容改写                                                                             | Vue 不使用 React 的 SDK submit transport；重放只走 SSE `Last-Event-ID` 游标，不能再引入第二套 resumable stream 语义                                                          |
| A4  | SSE `gap` 帧要包住**初始流和 join 流两者**                                                                                                          | 上游 SDK 会忽略未知事件名；包装器必须保持惰性 async iterable（SDK 用 `for await` 消费）                                                                                      |
| A5  | gap 恢复最多 5 次 rejoin（全 gap 路径共 6 次流调用）                                                                                                | —                                                                                                                                                                            |
| A6  | gap **不得当作正常流结束**，也**不得取消仍在运行的后端 run**                                                                                        | 会丢失正在进行的任务                                                                                                                                                         |
| A7  | gap 发生时要清空乐观 / 瞬态 / subtask 状态、失效持久化历史缓存、显示本地化恢复警告                                                                  | —                                                                                                                                                                            |
| A8  | Stop 后立即失效 4 类缓存（当前 thread、thread history、token usage、侧栏/搜索），并**再安排一次延迟 refetch**                                       | SDK 的 stop 可能在后端标题定稿提交前就以 abort + fire-and-forget cancel 结束                                                                                                 |

> 主要代码位置：`packages/agent-core/src/session/`、`packages/agent-core/src/transport/`、
> `app/core/agent-deerflow/`、`app/core/threads/cache-invalidation.ts` 和
> `app/composables/useThreadStream.ts`。

### A1 的实现形状

实现在 L1：`packages/agent-core/src/store/external-store.ts`。默认调度器是
`queueMicrotask`——微任务检查点就是「同一个宏任务」的边界，且发生在渲染之前。
合并的关键是一个 `pending` 短路：一个宏任务里派发一百次也只**登记一次**调度。
每次都重新排队就退化成尾部防抖了，那正是 A1 禁的。

三条回归钉在 `packages/agent-core/tests/store.test.ts`，用的是**真的**
`queueMicrotask` 与真的宏任务边界，不是注入的假调度器（假调度器只能证明
「代码调用了注入的函数」，证明不了默认档是合并还是防抖）：

| 断言                         | 合并档 | 同步档 | 固定延时防抖档 |
| ---------------------------- | ------ | ------ | -------------- |
| 一个宏任务里派发 50 次       | 1 次   | 50 次  | 0 次           |
| 三个宏任务、每个派发 5 次    | 3 次   | 15 次  | 0 次（被饿死） |
| 派发之后立刻 `getSnapshot()` | 最新   | 最新   | 最新           |

`getSnapshot()` 同步最新，合并的只有通知。`flushNotifications()` 给同步读者留出口。

### A2 的命名与边界

`stream-mode.ts` 位于 DeerFlow 应用适配层，不进入 `@deerflow/agent-core`。架构测试禁止
协议专有的 `messages-tuple` 泄漏到通用包。不要增加第二条 re-export 路径。

直接把 `sanitizeRunStreamOptions` 套在 wire 请求体上，校验不会生效。
它认的是 SDK 的 `streamMode`（camelCase），而 Gateway 收的是 `stream_mode`
（snake_case）——`"streamMode" in options` 恒为 false，**一声不响地放行**。
适配层只把 wire 的 `stream_mode` 映射成 validator 输入；验证通过后原样发送
wire payload。回归用例在 `tests/unit/agent-deerflow/run-protocol.test.ts`。

生产模式定义在 `app/composables/useThreadStream.ts`，普通发送、重新生成和编辑后重跑
共享同一个常量，不能让某个入口省略后退回 Gateway 的 `values` 默认值。对应黑盒回归在
`tests/unit/threads/thread-stream.dom.test.ts`：它从 fake runner 的 submission 断言真实 wire
payload，而不是只测协议层能否转发一个由测试手工构造的 `stream_mode`。

同一处还冻结 React SDK 与 Gateway 已有的断线契约：普通发送和重新生成都发送
`on_disconnect: "continue"`，wire 中不携带 `stream_resumable`。React 的适配层会去掉
SDK 选项 `streamResumable`；Vue 的提交常量直接省略该字段。Gateway 接受缺省或
`false`，两者均不启用服务端 resumable stream。Gateway 保持 run 继续执行，
Vue 通过 `Content-Location` 与 `Last-Event-ID` 恢复；不得改回 backend 的默认
`on_disconnect: "cancel"`，也不得请求不受支持的 server-side resumable stream。

---

## B. 消息渲染与分组

| #   | 约束                                                                                                                                                                                                                                                                                                                                                                                    | 为什么                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | 带 `tool_calls` 的 AI 消息里若有可见文本，必须作为 processing step 渲染                                                                                                                                                                                                                                                                                                                 | 保留 provider 的错误解释、"换个思路试试"这类文本                                                                                                                                                                              |
| B2  | 当前回合仍在 loading 时，最新可见 human 之后的纯内容 AI 消息**留在 processing 分组**                                                                                                                                                                                                                                                                                                    | provider 可能稍后往同一条消息追加 tool-call chunk；过早判定为终态气泡会让文本跳进步骤面板                                                                                                                                     |
| B3  | 前面已有 tool call 之后出现的纯内容 AI 消息，流式期间仍显示在最后一个 tool-call 步骤之后                                                                                                                                                                                                                                                                                                | 同上，它自己也可能再获得 tool call                                                                                                                                                                                            |
| B4  | **reasoning 必须在答案文本上方**，两个渲染组件都要（#4576）                                                                                                                                                                                                                                                                                                                             | 同一条消息在生命周期内由 `MessageGroup` 和 `MessageListItem` 先后渲染；两边不一致会导致回合settle瞬间两者互换位置                                                                                                             |
| B5  | reasoning 之**前**发出的 assistant 文本保持原位，只有 reasoning 产出的答案移到其下方                                                                                                                                                                                                                                                                                                    | —                                                                                                                                                                                                                             |
| B6  | run duration 折叠为一份，锚定在该 run 最后一个可见消息组之后                                                                                                                                                                                                                                                                                                                            | 兼容字段 `additional_kwargs.turn_duration` 在历史 AI 消息上重复出现                                                                                                                                                           |
| B7  | run duration 是**整个 run 的墙钟时间**，不是单条消息的思考时间；与 reasoning 披露分开渲染                                                                                                                                                                                                                                                                                               | —                                                                                                                                                                                                                             |
| B8  | workspace-change 卡片只挂在该 run 的**最后一个 assistant 气泡**（#4555）                                                                                                                                                                                                                                                                                                                | 卡片由 `(threadId, runId)` 解析，否则该 run 的每条 AI 消息都会渲染一份                                                                                                                                                        |
| B9  | 两个 anchor helper 的候选集合**故意不同**，不要统一                                                                                                                                                                                                                                                                                                                                     | run duration 由 `MessageList` 在每个组周围发出，接受任意类型；workspace-change 由 `MessageListItem` 发出，只接受 `assistant`                                                                                                  |
| B10 | 每个 processing 组的 tool-result / browser-preview 查找表**每组只构建一次**                                                                                                                                                                                                                                                                                                             | 保留首个非空结果与首个带截图的 browser view，避免为每个 tool call 重扫全组                                                                                                                                                    |
| B11 | citation 链接的 `citation:` 标签要从**完整 children 树**推导                                                                                                                                                                                                                                                                                                                            | 流式期间 children 可能是元素或数组，不是纯字符串                                                                                                                                                                              |
| B12 | 消息视口贴底时，流式内容的每次尺寸增长都继续跟随底部；用户主动上滚后立即释放，回到底部时恢复                                                                                                                                                                                                                                                                                            | AI token 会持续追加在同一个消息组内，不能只监听组数量；语义与 React `use-stick-to-bottom` 的 resize/follow 行为一致                                                                                                           |
| B13 | 实际 `MessageList → StreamMarkdown` 的全部链接必须经过统一 MarkdownLink；协议 allowlist 先于 citation/artifact 分支，危险 href 降级为不可点击文本；HTTP(S) 外链与 artifact/citation 使用 `target="_blank"` 和安全 `rel`                                                                                                                                                                 | 只在默认 Markdown pipeline 加 sanitizer 不能保护消息实际覆盖的 `components.a` 路径                                                                                                                                            |
| B14 | HumanMessage 附件以持久化 `additional_kwargs.files` 为主，并兼容 `current_uploads` / `uploaded_files` 标签；图片走 thread artifact 预览，普通文件走安全新窗口下载                                                                                                                                                                                                                       | 刷新后的 UI 不能依赖 composer 本地 `File` 状态                                                                                                                                                                                |
| B15 | 当前 React `MessageList` 调用点未向 `MessageListItem` 传入 `feedback`，因此 Vue 消息操作区也不得显示点赞/踩或触发 feedback mutation；历史消息仍可无损携带 Gateway feedback 字段                                                                                                                                                                                                         | core API/data contract 不等于已启用的产品入口；React 日后接通调用点时必须重新审计两端 UI                                                                                                                                      |
| B16 | human 与 assistant turn 都提供复制；citation sources 展开后显示去重 URL、domain、引用次数和单条 reference copy，且只接受 core 已归一化的 HTTP(S) URL                                                                                                                                                                                                                                    | 保持 Markdown 安全合同，同时补齐消息操作                                                                                                                                                                                      |
| B17 | `thread.values.todos` 从 live snapshot 或持久化 thread state 读取，只渲染真实 `pending` / `in_progress` / `completed` 状态                                                                                                                                                                                                                                                              | 实时 `updates` 按节点顺序归约 todos；历史/恢复快照提供完整 state，不在消息文本中反推                                                                                                                                          |
| B18 | token usage feature 由完整 models 响应的 `token_usage.enabled` 控制；线程最终 snapshot 为总量基线，只追加当前 active run 的 SSE usage，settled 后以最终 snapshot 替换；inline off 不渲染局部 usage                                                                                                                                                                                      | 避免刷新丢失、跨线程闪回和增量/最终值重复累计                                                                                                                                                                                 |
| B19 | processing 组必须先投影为唯一步骤视图：较早的非文本步骤折叠、最新 tool call/关联结果只显示一次、trailing reasoning 单独披露、其后答案保持在下方；不得逐条渲染 raw ToolMessage                                                                                                                                                                                                           | 同一组同时画 AI tool call 与 ToolMessage 会重复工具名称、参数和结果，并让流式/settled 布局跳变                                                                                                                                |
| B20 | 当前 run 尚无终态 assistant 气泡时显示 live run activity；终态 reasoning 流式时展开，settle 后延迟 1 秒只自动收起一次，用户之后的手动开关不再被 timer 覆盖                                                                                                                                                                                                                              | 对齐 React 的等待态与 disclosure 生命周期，避免页面空白或历史 reasoning 永久展开                                                                                                                                              |
| B21 | 实际 MessageList Markdown 的标题、强调、行内代码、列表、引用、分隔线与表格元素必须携带 React Streamdown 等价基础 class；列表标记不得被 Tailwind preflight 清除                                                                                                                                                                                                                          | 结构化回答在两端必须有相同的信息层级，不能把项目符号列表退化成无标记段落                                                                                                                                                      |
| B22 | 消息、reasoning 与 processing 文本必须统一经过 `MessageMarkdown`：默认启用 React 消息路径等价的 GFM/math/streaming 插件；GFM 表格必须渲染为 table，并提供复制、下载、全屏三项 Streamdown 等价操作                                                                                                                                                                                       | 只实现 `MarkdownTable` 而漏传 `remark-gfm` 会让真实天气回复仍显示为管道文本；插件链必须由单一产品适配器拥有                                                                                                                   |
| B23 | assistant 尾部动作统一由 `AssistantTurnActions` 使用共享 `ghost/icon-sm` Button 渲染：按钮 32 px、相邻步进 36 px、行内 gap 4 px、动作到耗时 8 px；消息滚动区使用 `stable both-edges` gutter，Vue 尾部空间由内容 wrapper 的 padding 持有：共享 gap-8 + pb-4 随字号缩放，另加主聊24px / 侧聊12px；两端虚拟窗口由 VirtualMessageList 总高度及测量行 transform 持有，不得伪装成空消息列表项 | 裸图标按钮和单侧 scrollbar gutter 会同时造成按钮命中区、横向起点与尾部间距偏离 React；尺寸必须由正确的结构 owner 持有，布局节点不得污染消息语义                                                                               |
| B24 | 代码高亮、图表与公式排版三个重量级渲染器**必须按内容加载**，不得进入关键路径                                                                                                                                                                                                                                                                                                            | 它们分别是 848 KB / 1.42 MB / 264 KB 量级。KaTeX 曾经被静态 import，于是每一次工作区加载都为公式排版付费，而绝大多数会话一个公式都没有；`tests/e2e/route-payload.spec.ts` 在真实导航里同时钉住首屏体积和「谁不许出现」        |
| B25 | 对话区在可访问性树里是一个**没有名字**的 `log`，消息流是 div 不是 list                                                                                                                                                                                                                                                                                                                  | React 的 `Conversation` 就是 `role="log"` 且不带 aria-label，`ConversationContent` 是纯 div。加名字会让读屏器把整段对话当成一个具名区域反复念；用 `ul`/`li` 则会把一段对话报成「共 N 项」的清单，空会话还会凭空多出一个空列表 |

会话的 Markdown/JSON 导出在隐藏消息过滤之外，还必须清理带属性的 project/documents
以及现有内部 marker 块；真实用户围栏/缩进代码内的同名标签保持原文。消息渲染仅
去除泄漏标签、保留其正文，代码保护边界与导出一致。带 info string 的围栏行不能
关闭外层代码块；注入块自身包含围栏也不能使整个注入块逃过清理。对应 core 消息、
导出和预处理单测，以及 chat-header-layout 中两端实际渲染/下载回归。

`<think>` 的正文/思考划分必须保护 fenced、缩进、列表内围栏与行内代码，
当前 run 的实际 assistant message ID 决定对应回答的复制准入，主聊天与侧聊共享此合同。
等待首包、隐藏指令或后续轮次运行不能禁掉已完成回答；正在生成的回答不显示复制按钮，
settle 后按钮与复制内容同时开放。消息流归属在同一 run 重连时保留，终态或 owner 退休时清空；
持久化历史与 values 快照不推断为当前流消息。按钮与点击行为必须消费同一推导。

支持未完成代码、转义、段落/标题/列表边界及未关闭的真实 reasoning。复制、导出与
渲染消费同一解析结果。只有实际答案文本才进入 assistant 气泡；非空 reasoning 加答案
即使仍在 streaming 也保留气泡，thinking-only 或空 reasoning 的未决正文仍属 processing。
澄清工具结果是新 run 边界，隐藏回复后的续接不得改变此前完成答案的分组。
纯逻辑、真实 Vue MessageList 组合挂载和两端真实 SSE/下载各自覆盖对应层次。

B6/B8 的呈现边界：耗时与消息组共享 `flex-col gap-2`；workspace-change 卡片位于
assistant 正文 flex 栈中，禁用状态只跟随该卡片所属的当前运行回合。后续运行不能禁用
已完成回合的卡片。B23 尾部空间必须随共享 spacing token 缩放；1440/768/375/360px
和放大文字的真实双端几何回归同时覆盖正文/卡片间距、尾部空间与滚动内容总高度。

B23 的尾部 padding 描述只限定 Vue owner；当前 React 在 hasTimelineContent 时保留其
原有 tail spacer div。两端外层 log/content 与 VirtualMessageList 的容器和行均为 div，
B25 不要求引入消息 list/listitem，也不要求修改 React 的占位实现。

B22 的渐进显示只归消息适配器：长流式首块以 80 字符为初始边界，50ms cadence、
每次至少 64 字符、300ms 目标；非追加替换、完成与 reduced motion 立即刷新，卸载取消
未决 timer。流式代码围栏为 12px mono 的轻量 pre，不提前显示 settled 工具栏或行号；
行内代码为 14px，完成后交回原富文本 renderer，显式 caller components 始终优先。
宽 display equation 保留与 React 相同 cascade、padding 及有界原生横向滚动。
mounted fake-clock 测试守护显示节奏、退休和 override，真实消息与 artifact browser
consumer 另守字体、颜色、table/math 及流式到 settled 的交接。

截断文件的两个 source fallback 保持原生 pre，以 14px/20px、完整容器尺寸、p-4、
overflow-auto、pre-wrap 对齐 React；完整内容才交给原编辑器，Range、草稿和安全策略保持
原 owner。实际 .js/.csv 消费者回归分别覆盖两条分支。

> 主要代码位置：`app/core/messages/utils.ts`、`app/core/messages/processing.ts`、
> `app/core/messages/run-duration.ts`、`app/core/messages/workspace-change-anchor.ts`、
> `app/components/chat/ProcessingMessageGroup.vue`、`app/components/chat/MessageList.vue`。

B12 由 `MessageList.vue` 的内容 `ResizeObserver` 驱动。主会话按 React 默认值平滑跟随，
sidecar 与 React 一样使用即时跟随；真实分块 SSE 回归位于
`tests/e2e-stream/real-stream.spec.ts`，同时固定贴底和用户主动上滚两条路径。

---

## C. 历史加载与顺序

| #   | 约束                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 历史分页保留后端的 **thread 全局 `seq`**；渲染时按规范身份叠加 checkpoint / live 副本                                                                                        |
| C2  | 上下文压缩救援要 diff **每一个保留的可见身份**，不能在第一个锚点处切片                                                                                                       |
| C3  | 维护 run 作用域的已提交可见消息账本，使替换更新与滚动 checkpoint 窗口不会抹掉已显示的步骤                                                                                    |
| C4  | 对于规范位置仍落在未加载游标页之后的 checkpoint / 瞬态前缀，**抑制**而非在最近锚点前折叠该未知间隙                                                                           |
| C5  | 添加乐观消息时**不要按时间戳重排序**                                                                                                                                         |
| C6  | 历史失效时**保留已加载的页**，不要丢弃已确立的顺序位置                                                                                                                       |
| C7  | 动态上下文会把提交的用户消息从 `X` 重新键为 `X__user`；UI 身份匹配**只对 human message** 归一化该保留后缀                                                                    |
| C8  | 本地提交的回合要记录 pre-submit 身份基线：若 `messages-tuple` 先于 `values` 发布新的 AI/tool 步骤，只把非基线的可见步骤移到新 human 之后，不动历史、隐藏控制消息和重连的 run |
| C9  | 该本地顺序锚点要**保持到 finish / stop / stream error**；下次本地提交时替换，切换 thread 或 replay-gap 恢复时清除                                                            |
| C10 | 历史初次只请求最新一页；只有显式按钮或用户向上交互后的 sentinel 才取下一页。重复触发要合并，前插旧消息后保持可见内容的滚动锚点                                               |

> 主要代码位置集中在 `app/core/threads/history.ts`、`message-merge.ts`、
> `checkpoint-seed.ts`、`local-turn-order.ts`、`cache-invalidation.ts` 以及
> `app/composables/useThreadHistory.ts`、`useThreadStream.ts`。这些纯函数和生命周期
> 测试必须一起维护。

---

## D. Artifacts

| #   | 约束                                                                                                                                                                                                                    | 为什么                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 文件工具的自动打开由当前 processing 组的最后工具拥有，effect/watch 的 100ms timer 在目标变化、失去资格或卸载时清理；退出动画不得保留旧调用的副作用                                                                      | 渲染期间不得起定时器；短于 100ms 的 pending、已返回结果、后继工具或 run 结束均取消普通写入的自动打开                                                                                                 |
| D2  | `write_file` / `str_replace` 仅在最后组仍 loading 且工具尚无返回消息时打开流式草稿 URL；`finalize_artifact_write` 仅在实际返回文本 `trimStart().startsWith("OK")` 后打开真实路径（后端已无此工具，随对齐计划 B32 删除） | 普通历史写入不开；用户可点击工具步骤打开；`autoOpen` / `autoSelect` 任一关闭或目标已选时不重复打开                                                                                                   |
| D3  | HTML 预览要过 `app/core/artifacts/preview-policy.ts` 的轻量文档完整性检查；正式文件还必须完整加载且未截断                                                                                                               | 已完成的 `.html`/`.htm` 若 `html`/`body` 标签缺失或错序、或 `head`/`style`/`script` 不配对，**留在代码视图**而不是塞进 iframe。仅仍在组装的 write-file 草稿允许安全前缀块                            |
| D4  | `ThreadState.artifacts` 是**权威列表**；provider 只持久化 thread 作用域的面板 UI 状态（open、选中路径、刷新引导缓存）                                                                                                   | 历史加载完成前，**初始的空流值不得覆盖已恢复的状态**                                                                                                                                                 |
| D5  | run 结束时刷新一次正式 artifact 内容；瞬态 `write-file:` 预览保持消息驱动                                                                                                                                               | —                                                                                                                                                                                                    |
| D6  | 显式编辑**只对 `/mnt/user-data/outputs` 下完整加载、带 SHA-256 修订的正式 UTF-8 文本 artifact**开放                                                                                                                     | Office、archive、SVG、未知扩展名、无扩展名和其他二进制必须 fail closed 为 download-only，不能进入文本 loader 或 PUT；MIME 不得把未知扩展名提升为可编辑文本                                           |
| D7  | run 进行中禁止保存；保存携带精确 `expected_sha256`。远程刷新或 412 冲突都保留本地草稿并显示冲突，**不得覆盖 agent 输出**                                                                                                | 成功保存以 Gateway 返回的 SHA/size 建立新 baseline；403/404/409/412/413/415 保留真实状态与 detail，不能伪装成功                                                                                      |
| D8  | 常规 artifact 文本加载最多通过 HTTP byte range 请求**前 1 MiB**；只有显式加载完整内容后才允许编辑或正式 HTML 预览                                                                                                       | 截断预览必须保持轻量并提供显式的“加载完整文件”操作；在用户请求并拿到完整内容之前**不要挂载 CodeMirror 或 iframe**                                                                                    |
| D9  | `useArtifactDraft` 是 baseline、remote、draft、dirty、conflict 和 edit 状态的唯一 owner；切文件、关面板、切右侧产品、切线程、路由离开和页面关闭共用该 owner                                                             | 仅 dirty 时注册 `beforeunload`；确认离开后确定性丢弃，取消则保持当前文件、面板和草稿；远程刷新不能覆盖 dirty draft                                                                                   |
| D10 | copy/open/download/install-skill 均由显式策略决定可见性；open/download 先用认证 GET Range 预检，install 只对真实 skill artifact + admin 开放                                                                            | 预检只读取一字节，合法空文件的 `416 + Content-Range: bytes */0` 视为可访问；其他权限/Gateway 错误必须可见                                                                                            |
| D11 | 正式 artifact、write-file 瞬态草稿和 skill artifact 是不同来源；自动历史打开不得覆盖用户或持久化选择，旧 load/save/action 结果不得跨路径回写                                                                            | load 由五段 Query key、AbortSignal 与 account owner fence 隔离；save/action 在 path/kind/thread 变化时 abort 并递增 generation；组件按 FileList、Editor、Preview、Actions 分工，面板根只编排当前选择 |
| D12 | 编辑视图是 CodeMirror 6：语言按 `app/core/code-editor/language.ts` 的 7 值规则归一并动态加载；只读、主题、语言通过 Compartment reconfigure；语言请求只允许最新身份落地，销毁退役在途请求                                | 切主题或文件不能丢选区、撤销历史；慢语法包不得覆盖后来选择的文件，未知语言仍可作为纯文本编辑                                                                                                         |
| D13 | 编辑器不得把自己写入的文档当成用户编辑再 emit 一次；`Mod-S` 必须走 ArtifactPanel **已有**的 revision 保存路径，不另开保存入口                                                                                           | v-model 少了这道 annotation 就会自激；另开保存入口意味着 D7 的 `expected_sha256`、冲突与 streaming 禁保存要被复制第二遍，而复制的那份迟早和主路径分叉                                                |
| D14 | 产物面板根在低高度窗口仍受宿主高度约束，并保留真正有滚动容量的面板或预览 owner                                                                                                                                          | 长报告不得把根撑成自然高度后被固定父容器裁切；原文、链接和操作必须保留，通过真实原生滚动验证                                                                                                         |
| D15 | Source/Edit 的 basicLight/monokai 完整语法、正文/绘制光标/选区主题与 React 当前消费者一致；`--text-sm`、monospace、1.4 行高、content 4px 0 / line 0 8px / host 横向 8px；长行不折行                                     | 使用原生 CM search、补全、括号闭合、Tab 缩进、特殊字符、多选与撤销；保留四个已关闭 visual 开关，不添加无消费者的设置或 diagnostics provider；几何与键盘最终由真实双端浏览器验证                      |

---

## E. Composer / 输入框

| #   | 约束                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Composer 草稿是 **tab 作用域**：只把文本 + 选中的 slash 技能名存 `sessionStorage`，按 user / agent / 逻辑会话作用域分键                                                                                                                                                                             |
| E2  | 新会话草稿使用稳定 `new` scope，实际 run/context target 使用本次 runtime UUID；已建立会话两者都用真实 thread ID。新建/删除后返回 `/new` 必须重置 runtime UUID；普通导航保留同一 tab 草稿，成功删除当前会话则清空该 composer 的文本、附件和引用（含仍在 `/new` 的已创建会话）                        |
| E3  | 附件、sidecar 引用、语音状态、polish 撤销状态**不持久化**                                                                                                                                                                                                                                           |
| E4  | `InputBox` 要等技能列表就绪后再恢复技能 chip；技能缺失或被禁用时**降级为可编辑的斜杠文本**                                                                                                                                                                                                          |
| E5  | 草稿与附件只有在 Gateway 已创建 run、runner 发出 `onStart` 后，才通过 `onAccepted` 清除；调用提交函数或写入乐观消息都不算后台接受                                                                                                                                                                   |
| E6  | `/goal` 与 `/compact` 是**内置命令，不是技能激活**；在正常聊天提交前拦截                                                                                                                                                                                                                            |
| E7  | `/goal <condition>` 除设置目标外还要把条件文本作为下一个用户任务提交（立即开跑）；查询状态与 clear 不启动 run                                                                                                                                                                                       |
| E8  | goal / compact / polish / post-run suggestion 绑定 thread、route、agent 与 generation，并尽量带 `AbortController`；切换、stop、替代请求或卸载后旧结果不得回写                                                                                                                                       |
| E9  | 选中技能 chip 后，在旁边的可编辑文本里输入 `/` 要能**重新打开**技能列表；选中条目是**替换 chip 而非追加**（wire 格式只允许一个前导 `/skill`）                                                                                                                                                       |
| E10 | 已选中 chip 时**不提供内置命令**（`/goal` 会被当作聊天文本提交）                                                                                                                                                                                                                                    |
| E11 | 斜杠**只在输入起始位置**打开列表（`getLeadingSlashSkillQuery`）—— 由 `tests/e2e/chat.spec.ts` 固定                                                                                                                                                                                                  |
| E12 | established thread 的 `/compact` 只允许一个在途请求；成功清草稿并失效 thread/history/search/token 六个 key，4xx/409 保留输入并显示 Gateway 原始 `detail`；新会话不调用 API                                                                                                                          |
| E13 | models 与 skills catalog 是 Vue Query 服务端状态；默认模型按 requested → agent default → Gateway 顺序选择。capability 控制可选 mode/effort UI，最终 run context 与 React 一样优先 explicit effort、否则按 mode fallback；Gateway model factory 负责剥离 provider 不支持的 kwargs                    |
| E14 | 主 composer 与 sidecar 上传/发送前保留 text、skill、files 与 context；失败、取消、断网、同步异常、路由切换均不清草稿。已成功上传的同一 `File` 在最终 thread 重试时复用，双击/上传中重复提交被 in-flight guard 丢弃                                                                                  |
| E15 | follow-up 在空草稿时直接发送；已有 text/skill/file 时必须提供 append-and-send、replace-and-send、cancel。所有按钮使用现有 i18n 字典，不静默覆盖                                                                                                                                                     |
| E16 | suggestions config 由 `useSuggestionsConfig` 的 Vue Query 独占；run 完成时配置若仍在途，必须等待/重取同一 query 后再决定是否请求 follow-up，禁止以组件 `onMounted` 布尔值造成首次回合竞态                                                                                                           |
| E17 | 主 composer 的附件入口必须是可聚焦、可键盘触发并具有 React 同名 accessible label 的真实 `button`；隐藏 file input 只负责文件选择 transport，不能代替产品操作入口                                                                                                                                    |
| E18 | 主 composer 与 sidecar 的 body/footer 使用同一分区；空草稿单行态由 64 px body、50 px footer 与边框形成 116 px surface，外层在 viewport 底部保留 16 px。disclaimer/background 绝对定位且不得参与 composer 高度；文本增长、附件和 welcome 状态仍可按内容扩展                                          |
| E19 | sidecar 在 submission pending 或 stream 运行期间只由一个 `composerBusy` 派生 form busy、textarea disabled 与 submit disabled；关闭再打开面板不得提前解锁，settle 后三者一起恢复                                                                                                                     |
| E20 | 主 composer 与 sidecar 的模式触发器共用 `ModeHoverGuide`，说明浮层建在 `ui/tooltip` 上，hover 与键盘焦点都能唤出；触发器文案与说明取自同一条模式记录，不各自 find 一遍                                                                                                                              |
| E21 | 发送与停止是**同一个控件**：流式期间换可访问名与图标，不换元素——换元素会在开始输出的那一刻把焦点丢回 body。名字取自 `primitives.submit` / `primitives.stop`，两份词典同为英文（React 的 ai-elements primitive 也没把它们接进词典）。空草稿**不**禁用，只有外部 `disabled` 或正在润色时才禁用        |
| E22 | 润色按钮的可用性判据是 `canPolishInput` 加上流式 / 斜杠查询 / 外部 disabled，与 React 的 `inputPolishDisabled` 一一对应；`/goal …` 与 `/compact` 这类内置命令行永远不可润色。撤销态是唯一例外——润色过之后「撤销」必须始终可按。润色进行中整个 composer 锁住，放弃在途润色的入口是取消按钮，不是停止 |
| E23 | 模式与模型触发器在**没有显式选择**时渲染成没有名字的按钮，而不是消失、也不自造一个默认名：控件个数不能随后端返回什么而变。模型触发器直接是工具条的 flex 子项，外面不包容器——包着的时候行盒会多出约 2 px，整条工具条随之变高，输入框跟着下移                                                         |

---

## F. Human input 协议

| #   | 约束                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **请求侧有版本，回复侧固定 v1。** v1 = `free_text` / `choice_with_other`；v2 增加 `form`                                                                                                                      |
| F2  | 表单卡片提交 `response_kind: "text"`，值为"人类可读摘要 + 一个以稳定字段名为键的 JSON 块"（`buildHumanInputFormSubmissionValue`）                                                                             |
| F3  | 校验器要拒绝未知版本 / 模式，以及与 `Object.prototype` 成员冲突的字段名 → 降级为纯文本 ToolMessage                                                                                                            |
| F4  | 表单值只走 own-property 读取（`readHumanInputFormValue`）                                                                                                                                                     |
| F5  | select 字段从空字符串占位状态起就是受控的                                                                                                                                                                     |
| F6  | checkbox 用原生 `<input type="checkbox">`，显式初始化为 `false`（`buildInitialHumanInputFormValues`）；required checkbox 的 `false` 是未满足，但**不加 HTML `required` 属性**（原生约束会拦截自定义提交路径） |
| F7  | 表单控件需 label/`for`、`aria-required` + 视觉隐藏的本地化"必填"标记、`aria-invalid` 与错误关联；只要还有字段无效，错误节点保持挂载                                                                           |
| F8  | **Composer 绕过闭合**：可见的普通 human 消息只回答"在它之前打开的最新一个未回答请求"——只关最新一个。更早的请求重新成为活动卡片                                                                                |
| F9  | 已回答状态从**原始 `thread.messages`** 推导（回复是隐藏的）；pending 在隐藏回复出现、派发失败/丢弃、新 `thread.error`、run 终态或 thread 切换时清除；失败时保留卡片输入供重试                                 |
| F10 | 页面级卡片提交回调发普通 human 消息，把 `hide_from_ui: true` 与响应载荷放在 `sendMessage` 第 4 个参数的 `additionalKwargs`；第 3 个参数仍是 run 上下文（如 `{ agent_name }`）                                 |
| F11 | 有未答请求时 composer 入口**保持可用**；普通可见消息会绕过卡片并启动下一个 run                                                                                                                                |

> 主要代码位置：`app/core/messages/human-input.ts`、`app/components/chat/HumanInputCard.vue`。

sidecar 必须把同一回调绑定到自己的 thread/stream；restore/create、普通发送、附件和 HIL
只能由 `useSidecarSession` 这一条路径拥有。面板隐藏不终止 run，只有真实删除才清空 thread
与本地瞬态状态。

---

## G. Subtask（子智能体）

| #   | 约束                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | `Subtask.steps[]` 从 `task_running` 事件**累加**（`mergeSteps` 追加，不是覆盖）                                                                                                  |
| G2  | 历史 run 展开时用 `fetchSubtaskSteps` 回填：按单个 task 分页拉 `GET /runs/{runId}/events?event_types=subagent.step&task_id=…&after_seq=…` 直到短页，避免 run 级 limit 截断时间线 |
| G3  | `computeNextSubtask` 保留**最大**累计用量，使重放或迟到的 SSE 帧不会重复计数或让卡片回退                                                                                         |
| G4  | `useUpdateSubtask` 针对镜像最新 state 的 `tasksRef` 应用更新（**不是闭包快照**），使迟到的回填不会覆盖 SSE 步骤或兄弟 subtask                                                    |
| G5  | `stepsForDisplay` 保留 tool 步骤与有文本的 AI 步骤；完成后丢弃末尾的 final-answer AI 步骤（它已作为 `result` 显示）                                                              |
| G6  | 重新加载后从终态 ToolMessage 元数据（`subagent_model_name` / `subagent_token_usage`）恢复，**不需要**逐卡片拉事件                                                                |
| G7  | `task_started/running/completed/failed/cancelled/timed_out` 进入同一个 reducer；`message_index` 去重排序，迟到进度不得把终态回滚                                                 |
| G8  | `llm_retry` 必须显示 Gateway 提供的用户文案，并在下一条有效进度、普通 update、finish、error 或 replay-gap 时清除                                                                 |
| G9  | Subtask 卡片的折叠按钮保持 `aria-expanded`/`aria-controls` 与键盘焦点；历史步骤失败要显示可重试错误                                                                              |

---

## H. 面板与布局

Vue 前端使用本仓 L2 `ui/resizable/ResizablePanels.vue`，通过声明式 `:sizes`
及 `@resize` / `@resized` 驱动。原生 pointer capture 只归当前手势 owner；
产品呈现、业务状态和持久化由调用方维护。

| #   | 约束                                                                                                                                                            | 为什么                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **三个右侧面板（artifacts / sidecar / browser）共用同一个面板组**，不要按面板种类分叉出非可调整尺寸的分支                                                       | 分叉正是 artifacts 分隔条静默失去拖拽手柄的原因（#4465）                                                                                                          |
| H2  | 开关靠**改绑定的 `:sizes`（侧区 → 0 / → 上次正值）**；pane 骨架常驻，closed 内容消费者不预挂载，关闭后仅保留 280ms 退出展示                                     | React 使用 `collapse()` / `resize()` 句柄；Vue 声明布局达到相同结果，主区不能随右侧开关或断点重挂载                                                               |
| H3  | 尺寸过渡作用在**实际参与 flex 布局的 `[data-panel]` 元素**上，两端均过渡 `flex-grow`                                                                            | 子节点 class 不能替代物理 pane 的过渡；静止宽度或仅内层裁切不能作为打开动画通过                                                                                   |
| H4  | 过渡**只在开关的 280ms 阶段**启用，拖拽、键盘及普通尺寸更新时不启用                                                                                             | 否则拖拽会被逐帧插值                                                                                                                                              |
| H5  | 动画期间面板内容按最终 `cqw` 宽度固定并由外层裁剪；viewport/root-font 不变时，开关自身不得导致内容逐帧换行                                                      | 重排的消息列表会重跑滚动到底（由 `tests/e2e/sidecar-chat.spec.ts` 的 no-animated-scroll 测试固定），重新换行的 composer 会改变显示哪些响应式标签                  |
| H6  | 拖拽中（`@resize`）记录最后的正值，业务 `sidecar` / `browserView` / `artifactsOpen` **只能在有效 `@resized` 的最终 0% 时关闭**                                  | preview 到 0 后仍可拖回；pointerup 必须应用最终坐标。cancel、capture 丢失、disabled、owner 退休及卸载都不 commit                                                  |
| H7  | 上下文窗口控件**故意常驻**：`context_usage` 不可用时渲染仪表占位而不是卸载                                                                                      | —                                                                                                                                                                 |
| H8  | `useThreadTokenUsage` 只在响应的 `thread_id` 仍匹配当前路由时保留占位数据                                                                                       | 同 thread 刷新不闪烁，跨 thread 导航永不显示上一个会话的用量                                                                                                      |
| H9  | 右侧面板关闭时分隔线**留在可访问性树里并标记 disabled**，不是 `visibility: hidden`                                                                              | React 的 `ResizableHandle` 关闭时传 `disabled`，元素还在（`aria-disabled`）。摘掉它，「这里有一条可以拖的分隔线、现在不能拖」这句话没人说得出来；窄屏两边都没有它 |
| H10 | Token debug 按真实 AI message id 归属：工具/纯 thinking 显示 inline 用量，共享或文本摘要只挂第一个合格步骤；末尾卡不能复制 processing/subagent reasoning 的用量 | 整轮 per_turn 汇总仍覆盖所有 AI 消息；无 id 的 debug 不虚构所属组，显式空步骤集合不能回退成整轮。折叠状态与普通卡全局 loading 合同保持一致                        |

桌面主区 min 30%，侧区 min 20%、collapsible 0%、default 40%、有效 max 70%；
分隔条外观保留 React 当前 `withHandle` 的 GripVertical。ArrowLeft/ArrowRight 每次
改变 5 个百分点，Shift 不改变步长；Home/End 在约束内到极值，Enter 仅切换前一个
collapsible pane。F6/Shift+F6 只在本组分隔条间移动焦点。手柄提供 separator、vertical
orientation、实际 pane 的 aria-controls 及当前百分比，禁用时退出 Tab 次序。

手势以扣除所有固定分隔条后的实际 pane 总宽计算比例，多 pane 声明布局仍可 collapse/
restore。每个实例独立 pointer capture；blur、hidden、pointercancel、lostpointercapture、
disabled、声明 sizes/约束变化、owner 退休和卸载同步清理临时监听，旧 release 不得写入
新 owner，取消后首个新手势必须正常。正常 preview 回显相同 sizes 不取消当前手势。
这些生命周期要求须验证真实手势和资源，不能用手工 emit `resized` 代替。

退出身份只控制展示，不能成为第二份业务 open/session/permissions/draft owner。
关闭立即 aria-hidden/inert 且业务 active=false；desktop close focus 在同一次 DOM
post-flush 完成，详情的显式 origin 返回优先。重开取消旧退出，owner 变化立即退休
旧内容，unmount 取消任务；关闭期间切换窄宽断点仍使用原 280ms 截止时间。
详情关闭后正文立即消失，保留外壳不缓存旧内容；线程/账号/Agent 变化同步清空原详情 owner。
呈现身份复用提交 owner 的退休标识，同一次 Vue flush 的 A→B→A 也必须卸载旧面板
实例并拒绝旧焦点续体；采用已准备的 UUID 则保留同一 owner 和面板草稿。

消息详情菜单的退出动画可以保留 DOM，但关闭内容因布局变化收到 pointerenter 时
不得重新打开；只有触发器的新操作才能开始下一次打开。已打开菜单仍允许鼠标从
触发器移入内容并取消关闭计时，保留原有 120ms 打开、180ms 关闭和退出动画。
技能详情选择后必须比较两端完整焦点转移与稳定闭环，不能只验证各自成环。

测试必须等待响应式 flush/rAF，不能在 click/mousemove 返回的同一 tick 读取状态。
Mounted 测试的 cqw 断言限定为实际生产模板的 renderer 输出；happy-dom 不提供此单位的
像素布局，固定内容宽度、换行/滚动轨迹和 CSS 过渡必须由原生跨端测试验证。

---

## I. Browser view

| #   | 约束                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I1  | 每次物理指针点击只转发**一个** `click` 输入；不要为同一手势同时发 `down`/`up`（远端 Playwright 点击会执行两次）                                                                                                          |
| I2  | 请求二进制 JPEG 帧（`frame_format=binary`）；状态、URL、标签页、导航拒绝消息保持 JSON                                                                                                                                    |
| I3  | 帧缓冲只保留**最新的一个**待处理帧，每个动画帧最多发布一次，并负责 object-URL 回收                                                                                                                                       |
| I4  | 保留 Gateway 的旧版 JSON/base64 帧路径以兼容老客户端                                                                                                                                                                     |
| I5  | Workspace Browser 触发器与右侧面板由 `/api/features -> browser_control.enabled` 控制；默认/失败的特性发现要**隐藏**该控件                                                                                                |
| I6  | 静态 browser frame 只来自当前主线程 ToolMessage 的 `additional_kwargs.browser_view`；不得从可见文本、artifact 名或 sidecar 消息猜测，截图变化才自动打开面板；已观察过的旧消息帧不得覆盖新的 REST 权威截图                |
| I7  | WS 是 per-panel 唯一 owner：初连或重连期间只保留最后一次 navigate；open 后至多发送一次。close/error 使用 800ms 起、10s 封顶、最多 6 次的指数退避；耗尽后显式 error + 手动重试                                            |
| I8  | thread/route 变化必须 generation 失效旧 socket/REST 结果并回收旧 object URL；feature 禁用、面板关闭、`active=false` 和 scope dispose 必须停止 socket、timer 与 REST 请求                                                 |
| I9  | Live/Connecting/Reconnecting/Static 是客户端根据 `requestedLive` 与实际连接状态推导的展示状态；Gateway 没有对应 mode/state 字段，HTTP/WS 都不得新增该字段                                                                |
| I10 | WS 最终不可用且仍有 pending navigate 时，只把该意图交接一次到 REST；已由 WS 接受的 navigate 不得再发 REST，禁止“双保险”双写                                                                                              |
| I11 | REST 导航只发 `POST /api/threads/{thread_id}/browser/navigate` + `{ url }`；`screenshot`/`url`/`title` 响应是权威结果。4xx/5xx 必须显示 Gateway 错误、保留原目标并提供重试                                               |
| I12 | live URL/title 只按 Gateway `url` 与 active `tabs` 事件收敛；Static 持有最后 live 或 REST 结果。`nav_rejected` 立即结束导航状态并显示服务端原因，不用固定 timer 假装完成                                                 |
| I13 | click/move 按 `object-contain` 的真实内容盒归一化；letterbox 外不发送。move 每动画帧只发最新点；wheel 使用 native non-passive listener，归一化 deltaMode 并逐帧合并                                                      |
| I14 | 键盘只在 live + 非 editable + 非 composition 的 `keydown` 转发；printable 用 `text`、命名键/远端编辑 chord 用 `key`，keyup 不重复。宿主浏览器/系统快捷键不 `preventDefault`；IME 只在 `compositionend` 发一次完整 `text` |
| I15 | 关闭 Live 只停 transport 并保留最后可见帧；切 thread/销毁才清帧和回收 blob URL。重新进入 Live 使用最后权威 URL seed，归一化 hash/尾斜杠后避免重复 navigate                                                               |
| I16 | Vue browser 的 framework-specific DOM/wire 测试归 `frontend-vue/tests/e2e/browser-control.spec.ts`；共享 `browser-feature.spec.ts` 只保留 feature flag 这一框架无关合同。Mock、real Gateway/replay、生产证据必须分开表述 |

---

## J. 认证与存储

| #   | 约束                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J1  | 登录页的"保持登录"只向 Gateway 提交 `remember_me`，本地**只能持久化邮箱地址**                                                                                                                                                                                                 |
| J2  | **密码与 token 绝不能进前端存储**；`HttpOnly access_token` 与可读的 `csrf_token` cookie 归 Gateway 所有                                                                                                                                                                       |
| J3  | auth-disabled 只用于 mock 合同；真实认证必须经 Nuxt preview 同源代理验证 register/login、Set-Cookie、CSRF 写请求、refresh 与 logout                                                                                                                                           |
| J4  | `localhost` cookie 不按端口隔离：React 与 Vue 会共享登录/退出状态，不能用两个端口模拟两个不同用户                                                                                                                                                                             |
| J5  | 生产 OIDC 必须保证“从哪个前端发起就回哪个合法前端”；相对回跳方案要求 `frontend_base_url` 与 provider `redirect_uri` 同时留空、IdP 注册两个 callback URI、可信代理正确传 Host/Proto。若必须用任一单值绝对 URL，就要以后端签名 state + allowlist 扩展解决，未解决前属于发布阻断 |
| J6  | OIDC state cookie 不按端口隔离，cookie 名又只按 provider 区分；同一 hostname 的 React/Vue 两个端口不能并发发起同一 provider 登录。生产认证隔离使用独立 hostname，G0-7 必须覆盖并发/覆盖风险                                                                                   |
| J7  | OIDC callback 必须通过同源 `/api/v1/auth/me` 验证 session，复用 `next-path.ts` 拒绝开放重定向，并分别收敛 authenticated、401、Gateway unavailable 的状态与 replace 跳转                                                                                                       |
| J8  | Gateway session 只由统一 Vue Query key/composable 持有；middleware 与 workspace 不能各存一套用户真相。普通 401 跳登录；unavailable 保留当前工作区，通过后台自动探测恢复。恢复期 401 计数达到 3 后再做权威 session 探测（服务错误使计数减 1），恢复 authenticated 后原地继续   |
| J9  | 真实模式的 `/workspace` 固定进入 `/workspace/chats/new`；不得恢复已排除的 static demo/mock 分支                                                                                                                                                                               |
| J10 | Gateway 完全连不上时，登录与首次设置页仍必须渲染完整表单、显示明确的不可用状态并提供可用的重试；恢复必须**就地**完成，不能要求用户整页刷新                                                                                                                                    |

`permissions` 缺失或 null 时沿用 React 的兼容允许语义，显式空数组拒绝受控动作；前端仅提供操作提示与禁用，Gateway 始终执行真实权限校验。真实 authenticated user 优先于 auth-disabled 合成身份。异步路由守卫必须在首次 await 前捕获 Vue Query 上下文。

---

## K. 路由与其他

| #   | 约束                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1  | Web UI 会话路径必须通过 `app/core/threads/utils.ts::pathOfThread()` 构造 —— 它会对自定义 agent 名和 thread ID 做百分号编码后再插入路由段                                                                     |
| K2  | 编辑并重跑**只限最新回合**：仅当记录空闲且最近的可见回合以终态 assistant 消息结尾时才暴露（`getLatestEditableTurn()`）                                                                                       |
| K3  | 编辑并重跑走 `POST /api/threads/{id}/runs/edit-regenerate/prepare`，用与 regenerate 相同的流路径提交返回的替换消息/checkpoint/元数据，乐观隐藏被取代的消息 id，持久化替换到达后清除乐观态                    |
| K4  | 重命名走同一条序列化状态写入路由；活动 run 返回 409 时对话框保持打开并显示服务端错误                                                                                                                         |
| K5  | 设置 > 工具的 MCP 开关调用定向的 `PATCH /api/mcp/config`；在该 mutation 的成功 refetch 完成前禁用开关；通过 toast 显示后端错误 `detail`；**成功后才**失效 `["mcpConfig"]`                                    |
| K6  | 定时后台运行是**非交互**的：`context.non_interactive=true` 时 lead-agent 工具集排除 `ask_clarification`。该键只对内部认证的调用方生效，客户端提交的会被丢弃（后端行为，前端不要伪造）                        |
| K7  | prepared replay 的 prepare 与 stream 共用 generation/AbortController；重复提交、切路由、stop、error、cancel 和成功都必须清掉 guard、乐观态与 superseded masks                                                |
| K8  | Gateway 非成功响应统一保留 HTTP status、FastAPI `detail`、结构化 body 与原始正文，不能在 prepared replay 或 compact 路径换成通用错误                                                                         |
| K9  | 所有主 thread 列表按**原始后端行数**推进 offset，再过滤 sidecar；不得保存第二份 server-state 列表                                                                                                            |
| K10 | 删除主 thread 时先全量搜索并并发尝试删除 sidecar；与 React 相同，sidecar 搜索/删除失败记录警告后继续主 thread 删除。主 thread 或本地状态清理失败则保留确认框、显示错误并允许重试；仅 404 视为幂等成功        |
| K11 | Workspace 可见入口以 React 当前调用点为准：聊天 header 是定时任务 → token/context → sidecar → browser → export → artifacts；侧栏底部菜单只含 React 六项操作，品牌文字在非静态工作区不得成为 Vue 独有导航链接 |
| K12 | 自定义 Agent bootstrap 的 Save 在初始 design conversation 成功完成且 send owner 完整释放前保持禁用；不能让保存操作与 bootstrap run 竞争同一 runner，也不能用定时延迟掩盖竞态                                 |

定时任务 ID 的复制成功提示仅在 Clipboard API 实际写入成功后显示；接口缺失、
权限拒绝或写入失败均不能报告成功，不增加与 React 不同的隐式复制路径。

> K6 是后端合同。前端只验证请求中不会伪造 `context.non_interactive`；后端的工具集裁剪
> 由后端测试负责。

---

## L. SSE transport 与会话协议

DeerFlow 经 Nginx/Nitro 代理流式响应，并使用 SSE `Last-Event-ID` 重放。通用实现位于
`packages/agent-core/src/transport/` 和 `session/`，DeerFlow 协议适配位于
`app/core/agent-deerflow/`。

| #       | 补强项                                    | 为什么                                                                                                                                                                                                                   |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1      | **CRLF 归一化**                           | SSE 规范允许 `\r\n\r\n`；只找 `\n\n` 时，代理链产生 CRLF 会让 buffer 无法完成分帧                                                                                                                                        |
| L2      | **保留 `id:` 字段**                       | DeerFlow 重放依赖 SSE `Last-Event-ID`；解析器必须保留 `id:`，resume 请求必须携带该游标                                                                                                                                   |
| L3      | **`data:` 只剥一个前导空格**              | SSE 规范只要求去掉字段名后的一个可选空格；对流式 token 使用 `trim()` 会丢失有意义的前导空格                                                                                                                              |
| L4      | **重试加指数退避**                        | 立即连续重试会在短时网络抖动期间集中失败                                                                                                                                                                                 |
| L5      | **重试计数需要总量上限**                  | 局部成功后清零重试预算会让持续抖动的长连接无限重连                                                                                                                                                                       |
| L6      | **buffer 需要上限保护**                   | 后端一直不发分隔空行时 buffer 会无限增长。长报告场景值得加保护                                                                                                                                                           |
| L7      | **看门狗阈值重定**                        | DeerFlow 的 sandbox、浏览器和子智能体调用可能长时间没有业务帧，不能用固定的短静默阈值误杀正常 run                                                                                                                        |
| L8      | **不要模块级可变状态**                    | sidecar 子会话与多个 thread 可并存，消息缓冲必须属于 message 或 per-stream context                                                                                                                                       |
| **L9**  | **心跳注释帧要识别、且不能当事件**        | 以 `:` 开头的 SSE 注释是 keep-alive；它不能进入 reducer，但必须重置看门狗计时                                                                                                                                            |
| **L10** | **create POST 最多一次**                  | 初始请求创建 run；响应头前断网且后端没有 idempotency key 时必须 fail closed，不能自动重放 POST                                                                                                                           |
| **L11** | **续传必须切到既有 run 的 GET stream**    | 拿到 run handle 后，网络中断调用 `resume()` 并带 `Last-Event-ID`；不得复用 create URL/method/body                                                                                                                        |
| **L12** | **Content-Location 与 Location 分开验证** | Gateway create 明确发 `Content-Location`；当前 SDK 的 metadata 与 reconnect 读取不同 header。Nuxt proxy 前后都要记录，不能假定二者等价                                                                                   |
| **L13** | **abort 不等于 cancel**                   | 本地停止读取只能释放连接；用户点 stop 时必须显式调用 Gateway cancel/cancel-then-drain，并观察最终 session 状态                                                                                                           |
| **L14** | **最终 checkpoint 不是流式 oracle**       | 516 条消息只能验证最终 adapter/state；raw SSE trace 才验证 chunk、id、namespace、heartbeat、gap 与重连时序                                                                                                               |
| **L15** | **完整 state 与消息同一次归约**           | `values` 会带 messages、artifacts、todos、goal 等；不能只维护 message map，再让组件各自补业务状态                                                                                                                        |
| **L16** | **cancel 结果不能压成 `void`**            | UI stop 先进入 `stopping`；200 SSE 要 drain 尾帧，202 accepted 要轮询 durable run，204/已确认终态后再按 Gateway durable status 映射为 `cancelled`/`completed`/`failed`。创建阶段无 handle 的断开是“不确定”，不是“已取消” |

同时，A 组全部约束仍然适用。L1–L16 分别由 transport 单测、session 状态机测试、
raw trace、代理 smoke 和 replay Gateway 浏览器测试覆盖，不能只依赖最终 checkpoint。

---

## M. Vue 框架语义

| #   | 约束                                                                                                                                    | 为什么                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | `provide()` 必须传 **ref / reactive / computed**，不能传普通对象或裸值                                                                  | Vue 的 `inject` 在 setup 期间**一次性解析**，拿到的是当时那个引用；传裸值时后续变化不会传播到消费方                                                                                                                                                           |
| M2  | `inject()` 只能在 setup 同步阶段调用                                                                                                    | `await` 之后或回调里调用会拿不到值。React 的 `useContext` 无此限制                                                                                                                                                                                            |
| M3  | 自定义 Markdown 组件覆盖接收的是 **`class`** 而不是 `className`                                                                         | `hast-util-to-jsx-runtime` 对 Vue 必须设 `elementAttributeNameCase: 'html'`                                                                                                                                                                                   |
| M4  | 逐词动画的 key 必须稳定                                                                                                                 | 与 B 组无关，是 Vue 的 diff 语义：key 变化会重新挂载节点并重播动画。铁律仍是**不要用 per-word rehype 插件**                                                                                                                                                   |
| M5  | `watch` 默认是**惰性**的，React 的 `useEffect` 默认首次就跑                                                                             | 搬 effect 时若原逻辑依赖挂载即执行，要显式 `{ immediate: true }`。A7、D1、D4 这类"初始状态不得被覆盖"的约束最容易在这里翻车                                                                                                                                   |
| M6  | `onErrorCaptured` 返回 `false` 才阻止错误继续冒泡                                                                                       | 与 React ErrorBoundary 的语义不同，Markdown 错误边界要显式返回                                                                                                                                                                                                |
| M7  | Reka 的 tooltip 触发器与下拉触发器套在同一个按钮上时，**tooltip 必须在里层**                                                            | 两者各渲染一个 `PopperAnchor`，而它注入的是**最近**的 `PopperRoot`。tooltip 在外层时，下拉的 anchor 会注册进 tooltip 的 Popper，下拉自己的 Popper 一个 anchor 都没有——实测菜单打得开但整块渲染在视口外（y = -563），一个选项都点不到，且没有任何报错          |
| M8  | 根节点是 fragment 的包装组件必须 `inheritAttrs: false` 并显式 `v-bind="$attrs"`                                                         | 多根组件不会自动继承 attrs，Vue 只在开发期警告。以 as-child 传下来的 `onClick`/`aria-*` 会被静默丢掉，表现是「菜单根本打不开」                                                                                                                                |
| M9  | Tooltip 默认延迟为 0，显式延迟仍生效；禁用 Agents 保留常驻说明和一个 Tab 入口，hover/后代 focus 使用正式右侧浮层，feature 切换退休 open | React 合成 onFocus/onBlur 会冒泡，原生 focus/blur 不会；Vue 使用 focusin/out 和公共受控 open 衔接，不能添加 Tab 包裹层或伪造 focus。按钮原 pointer-events:none 与静态 aria-describedby 在打开、Escape、关闭后都保持，不能用临时 tooltip id 替换永久禁用原因。 |

---

Markdown 组件覆盖的 children 必须经函数 slot 传递，原生元素/Fragment 的 children 和
稳定词 key 不变。表格复制/下载读取各自已渲染的 table；复制包含选定格式纯文本与真实
HTML，CSV 下载保留 BOM。普通与全屏菜单反馈独立；全屏占满实际视口，不能继承普通
Dialog 的高度上限或桌面 padding。真实单元格更新不得通过替换整个表格或弹层丢失焦点。
同长度文字替换也必须更新正文和表格；React 的 Streamdown memo 使用正式锁定的官方
修复比较实际渲染 props，代码围栏另比较 metadata。未变化的前置 block 保留缓存，
不得以强制 key、重新挂载或关闭动画来掩盖旧内容。
引用复制离开所属来源后，不发布旧请求的通知、反馈或新 timer；已完成的剪贴板写入不撤销。

## N. 上传 / 通知 / 语音 / i18n

| #   | 模块                                                 | 持续合同                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | `app/core/uploads/`、`app/composables/useUploads.ts` | 上传限制来自 Gateway；附件属于提交前状态，切换 thread 或提交后不得错误复用；前端校验与后端限制要同步验证                                                                                                                                                                                                                                                                  |
| N2  | `app/composables/useNotifications.ts`                | 只在浏览器支持且用户授权时发通知；页面可见性与 run 生命周期变化不得产生重复通知                                                                                                                                                                                                                                                                                           |
| N3  | `app/core/voice-input/speech-recognition.ts`         | 不支持 SpeechRecognition 或权限失败时必须可恢复；语音状态不持久化                                                                                                                                                                                                                                                                                                         |
| N4  | `app/core/i18n/`、`app/plugins/i18n.ts`              | plugin 的 ref/computed 是唯一 locale owner；启动只等待选中语言字典，切换先加载后原子发布，并拒绝旧语言加载结果回写；cookie、`document.lang`、已打开 UI 与后续 toast 同步更新。双 locale 精确 key、audited unused 与全部产品 SFC AST guard 必须同时通过；backend/user/code/file/URL/protocol 动态值不得翻译                                                                |
| N5  | `app/core/theme/`、`app/plugins/theme.ts`            | 应用级 controller 是唯一 theme lifecycle owner；head bootstrap 只做 mount 前 class/color-scheme。system 实时跟随 media，显式 light/dark 忽略变化，切回 system 立即同步；storage 非法值回退，scope dispose 幂等解绑唯一 listener；`/` 只强制当前 resolved dark，不改写用户 preference/storage，离开后恢复                                                                  |
| N6  | `app/core/i18n/locales/*`（`primitives.*`）          | 这一组 key 在两份词典里**同为英文**，对应 React 写死在 vendored primitive 里、没有接进词典的可访问名（shadcn sidebar 的 `Toggle Sidebar`、ai-elements 的 `Submit`/`Stop`、sonner 的 `Notifications alt+T`）。判据是「两个应用听到同一句」，各自翻译会让同一个控件在两边有两个名字。放词典而不是写死在 SFC 里，是为了让这条决定可 review、也能在上游接入 i18n 之后一次翻掉 |

---

## O. Scheduled tasks

| #   | 约束                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O1  | Gateway wire 只支持 `schedule_type=once\|cron`。create 不发送空字段、`enabled`、`interval`或`context.non_interactive`；PATCH 不发送 `schedule_type`，启停只走 pause/resume endpoint                                                        |
| O2  | `fresh_thread_per_run` 不携带旧 `thread_id`；`reuse_thread` 必须携带用户可访问的真实 thread。route query 只初始化表单/列表作用域，用户仍可切换 context                                                                                     |
| O3  | cron preset 只生成 hourly/daily/weekly/monthly 的五段表达式；custom 原样交给 Gateway 校验。timezone 默认浏览器时区但可编辑，非法 cron/timezone 必须显示 Gateway 的 422 `detail`                                                            |
| O4  | once 的 `datetime-local` 按所选 IANA timezone 转为显式 UTC ISO；DST gap、过去时间与不满足 Gateway min-delay 的值不能伪装成功。重复时刻使用确定性的较早 occurrence                                                                          |
| O5  | `useScheduledTasks` 是 list/thread-list/detail/runs 的唯一服务端状态 owner；query key 与 mutation invalidation 只能在集中 factory 中定义。create/update/delete/pause/resume/trigger 后必须刷新实际受影响的全局、thread、detail 与 runs key |
| O6  | task/type 筛选覆盖 once/cron 与 enabled/paused/running/completed/failed/cancelled；当前 selection 被过滤或删除后必须确定性地选择首个可见 task 或清空                                                                                       |
| O7  | running 时 edit/pause/resume/trigger/delete 的冲突操作禁用；mutation pending 阻止重复提交。403/404/409/422/502 的 status/detail 保留到可见错误面；401 遵循共享 fetcher 的 `Unauthorized` + 登录跳转合同，均不得被本地成功提示覆盖          |
| O8  | run history 使用 `limit/offset` 分页或明确“加载更多”，不得把默认前 50 条当作完整历史；每条 run 显示 trigger、queued/running/success/failed/skipped/interrupted、scheduled/started/finished time、thread/run ID 与 error                    |
| O9  | 只有含 queued/running run 的 runs query 轮询；task/thread 切换、query disable 与 scope dispose 后 observer/timer/AbortController 必须清理。旧请求只能回写自己的 query key，不能跨 task/thread 污染新选择                                   |
| O10 | delete 必须二次确认；recipes 只填充同一表单并保留 `{{repo}}` 等占位符，不建立第二条提交路径。真实 Gateway 的 create/update/pause/resume/trigger/delete 响应与 runs 数据是最终真相                                                          |

> O1 与 K6 共同固定 `context.non_interactive` 的所有权：它只能由内部认证的 scheduler
> launch path 添加，浏览器客户端永远不提交该键。

定时任务表单的 features/agents 查询随非空 `TaskFormRequest` 启用；关闭表单后，
迟到的 features 响应不能启动 agents 查询。再次打开时按现有 query 失效策略刷新。

Run 的线程身份只由 URL 和 Gateway 的 `build_run_config` 决定；React/Vue context
builder 都移除旧 settings 或额外 context 中的 `thread_id`。Vue 的历史 runs REST
适配器保留 React SDK 的 `limit=10&offset=0` 请求默认值；当前 Gateway 的 bare-list
路由忽略这两个参数，不得把它误写成已实现的分页行为。
知识库选择位于模式与 reasoning effort 控件之间，同时保持原生键盘顺序与禁用态。

---

## P. Channels

| #   | 约束                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | providers 只描述 capability/config/connectable；当前用户所有账号、connection ID 与展示 status 只从 scoped `/connections` query 推导。两端冲突时 connections 获胜，多账号保持响应顺序与稳定 ID。                                        |
| P2  | `useChannelConnections` 是 providers/connections query、connect/configure/disconnect mutation、invalidation、poll 与 cleanup 的唯一 owner；组件不得复制 server state。query key 必须包含认证 user scope。                              |
| P3  | connect 必须同时消费 `url`、`instruction`、`expires_in`：deep link 通过同步预开窗口交给现有 URL helper；URL-only 和 instruction-only 都可见且可收敛。                                                                                  |
| P4  | expiry 必须规范到正数且不超过一小时的有限 deadline。success、expiry、cancel、重新连接、组件卸载、effect scope dispose 或 user scope 切换都清 timer 并 abort 在途请求；late result 不得跨 scope 回写。                                  |
| P5  | 新多账号绑定只由发起请求后新出现/重新激活的 connected instance 完成；绑定前已 connected 的 ID 不能让新 poll 提前成功。waiting mutation/poll 阻止同 provider 重复 connect。                                                             |
| P6  | 用户断开只走 `DELETE /api/channels/connections/{connection_id}`；管理员移除运行时只走 `DELETE /api/channels/{provider}/runtime-config`，后者是实例级配置删除与全 provider active connections revoke，UI 必须明确区分并二次确认。       |
| P7  | mutation 成功后重读 providers 与 connections；失败保留 Gateway detail，401 继续走共享登录跳转，400/403/404/429 不得被本地成功态覆盖。                                                                                                  |
| P8  | Mock E2E 证明 DOM、deep-link、instruction、poll/expiry/dispose、多账号、两个删除目标、pending/race 与错误展示；real-backend gate 证明 Auth/CSRF/router/SQLite/HTTP/UI。受控外部 worker/callback 不等于真实 IM 平台授权或生产网络证明。 |

---

## Q. Agents

| #   | 约束                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | bootstrap 页面创建 prepared real thread 后不提前离开 `/workspace/agents/new`，但必须把该 thread 作为 `displayThreadId` 消费 live snapshot；route-owned history 仍保持 disabled。                                                                                                                    |
| Q2  | Save 只发送一条 `hide_from_ui: true` 的 human 指令。成功判定只允许匹配 `AIMessage.tool_calls[].name=setup_agent` 的 call ID 与同 ID `ToolMessage`，并要求 ToolMessage 明确 `status=success`；assistant prose、未匹配 tool result 或缺 status 都不能冒充成功。                                       |
| Q3  | `useAgentCreationSession` 是 idle/saving/verifying/created/error、重复提交 guard、run 完成、有限 visibility retry 和 cleanup 的唯一 owner；组件不得再建 timer、一次性 `getAgent` 或第二条保存路径。                                                                                                 |
| Q4  | visibility retry 只重试 404，使用有限 `[0, 200, 500, 1000, 2000]` ms 预算；tool/run/其他 Gateway 错误立即保留真实 detail。retry verification 不得新建第二个 run，已 created 后不得再次提交。                                                                                                        |
| Q5  | run 与验证共享 generation/AbortSignal 边界；取消、route/scope dispose 或新 session 会清 timer、abort 在途请求并拒绝 late result 回写。                                                                                                                                                              |
| Q6  | `useAgents` / `useChatAgent` 与 `useModels` 持有 Agent catalog/detail、model catalog 与 mutation cache convergence；feature 尚未 ready 或 disabled 时不查询。普通 Agent catalog 沿用仅传输错误自动重试，scheduled form 禁止自动重试；models Unauthorized 不重试，其余错误最多一次。组件不复制缓存。 |
| Q7  | 设置模型只来自 `/api/models`。`__default__` 发送 `model: null`，并使用模型列表首项的 capability；未知显式模型拒绝提交。temperature 为 0–2，max_tokens 为 1–200000 整数；两者都空时 `model_settings: null`，显式 0 不得丢失。                                                                        |
| Q8  | thinking 使用 true/false/null 三态；reasoning 使用 low/medium/high/null。模型不支持对应 capability 时必须发送 null 清除 stale override；mutation pending 禁止重复保存/删除，失败保持 dialog 和 Gateway detail，成功同步并重读 Agent list。                                                          |
| Q9  | Agent card 的 model、skills、tool_groups 只来自 Agent 响应，保留顺序、重复和长文本。`tool_groups: null` 表示不限制已配置 group，`[]` 表示没有配置 group；不得改写成“全部工具/无工具”。                                                                                                              |
| Q10 | Mock M7 证明 Vue DOM、隐藏保存、tool correlation、错误/retry、capability exact payload 与 card；real-backend gate 证明 Auth/CSRF/features/models/thread-run/setup_agent/SQLite/user isolation/HTTP/UI。受控 LLM 不等于真实 provider 或生产环境证明。                                                |

---

## R. Memory、Skills 与 MCP 设置

| #   | 约束                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `useMemory` 是 `/api/memory` response、fact mutation、clear、import、export 与 scope cleanup 的唯一服务端状态 owner；组件不得复制 response。mutation pending 阻止重复提交，成功写入/重读同一 query，失败保留 status/detail 和当前 dialog/import preview。                                                     |
| R2  | import 只接受完整 export root、六个 summary section 与 facts 数组。malformed/partial/type/range/storage-invalid fact/重复 fact ID 在纯 validator 内拒绝且不发请求；forward extra 与不同 ID 的重复 content 保留到 preview 并警告，Gateway 忽略未知 request 字段的事实必须可见。                                |
| R3  | fact confidence 是有限数值 `0..1`，UI step 为 `0.01`，显式 0 必须保留。edit PATCH 只发送实际改变的 `content/category/confidence`；搜索匹配 content/category，confidence 筛选与无数据/无匹配空态必须区分。                                                                                                     |
| R4  | delete fact、clear all 与覆盖 import 都必须使用可访问的 alert dialog 二次确认；cancel 零请求，pending 锁定关闭/重复动作，失败保留 dialog 与 Gateway detail。create/edit 也使用同一 pending/focus/escape 边界，不调用 `window.confirm`。                                                                       |
| R5  | 权限只从共享 session 与 auth-disabled Gateway 语义派生。Skills GET 对 authenticated user 开放，Skills PUT 只允许 admin；MCP GET/PATCH/PUT 均只允许 admin。已知 non-admin 的 MCP 页面必须零 I/O，两类 mutation 在无权限时都必须 disabled 且零请求。                                                            |
| R6  | Skill toggle 只发送 `{enabled}`；MCP toggle 只发送 `{server_name, enabled}`。两者不做 optimistic flip，成功后 authoritative re-read 各自共享 query key；401 走共享登录，403/admin-required 与普通网络/服务错误分开展示，不得用本地成功态覆盖。                                                                |
| R7  | Mock M7 覆盖导入 preview/失败保留、CRUD/搜索筛选/确认、auth-disabled admin 与普通用户零 MCP I/O；real-backend gate 以真实 Auth/CSRF/FastAPI/DeerMem/Noop 固定 400/404/409/422/500/501，并证明 skills/MCP atomic write/cache reload/secret masking/Nuxt/UI。fixture 不等于外部 backend/MCP/IdP/凭据/网络证明。 |

---

## S. Workspace shell、导航与 Workspace Changes

通知的普通 Tab/Shift+Tab 按文档顺序进入和离开，不取消原生导航或抢回历史入口。
Alt+T 访问单独记录调用入口，在 Tab 边界返回该入口；Escape 收起列表但不移动焦点。viewport 被移除时，
仅仍持有焦点的访问可以恢复尚连接的入口。失焦后必须清除旧归属，即使没有后继 focusin。
最后一条通知移除与整个 viewport 卸载都在 DOM 删除前完成有效归还，
不能由浏览器删除节点产生的失焦先清空入口；真实 Chromium 生命周期回归覆盖两种入口。

| #   | 约束                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Workspace layout 只能挂载一个 command palette、settings host 和 toast owner。全局 listener 必须随 layout scope 解绑；离开 workspace 后快捷键不得继续生效。                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| S2  | 快捷键精确匹配 Meta/Ctrl-K、Meta/Ctrl-Shift-N、Meta/Ctrl-comma、Meta/Ctrl-slash 与 Meta/Ctrl-B；拒绝 repeat、IME、Alt 和双 command modifier。除 palette K 外，input/textarea/select/contenteditable 不得触发全局动作。                                                                                                                                                                                                                                                                                                                                                                                                           |
| S3  | Settings section 由有效 `settings` query 唯一决定。dialog 必须有 modal aria、初始焦点、focus trap、Escape 和焦点归还；用户关闭只移除 `settings` 并保留其他 query/hash，浏览器 back/forward 重放开闭状态。                                                                                                                                                                                                                                                                                                                                                                                                                        |
| S4  | Gateway banner 与 route middleware 复用唯一 auth session Query。unavailable 不清 cookie，横幅只显示状态和退出按钮，每 10 秒自动探测。恢复成功直接复用该响应，不额外读取用户或显示恢复 toast；恢复期 401 计数达到 3 后再确认 session（服务错误使计数减 1），普通非恢复期 401 立即进入登录。                                                                                                                                                                                                                                                                                                                                       |
| S5  | Share 只生成 React 等价稳定 URL 并写剪贴板，不调用不存在的 share API。Export 必须先读真实 thread state；无消息、Gateway、剪贴板和下载错误可见，临时 anchor/object URL 在成功和异常路径都清理。列表相对时间只来自有效 `updated_at`。                                                                                                                                                                                                                                                                                                                                                                                              |
| S6  | `useWorkspaceChanges` 是 summary/detail 的唯一 server-state owner；key 必须包含 thread/run/include_files/include_diff 并透传 AbortSignal。切换 key 时旧请求被取消，late response 不得覆盖当前 thread/run。                                                                                                                                                                                                                                                                                                                                                                                                                       |
| S7  | UI 完整显示 summary `truncated`、created/modified/deleted/symlink_created 和 binary/large/sensitive/truncated/symlink reason；summary/detail 错误保留 Gateway detail 并提供显式 retry。Mock M7 证明 DOM/焦点/浏览器边界；real gate 证明真实 Auth/owner check/thread state/event store/response filtering/Nuxt/UI，受控 event 与注入 503 不等于生产网络或部署证明。                                                                                                                                                                                                                                                               |
| S8  | 线程是否存在的判据是「后端还能不能给出这段会话」，**不是 checkpoint 是否存在**。`GET /threads/{id}` 与 `/state` 在上下文压缩后 404 属常态，此时 `/threads/{id}/messages/page` 仍完整返回历史。只有「元数据 403/404 确认缺失」**且**「历史已问出结论（含失败）」**且**「确实没有任何可见消息」三者同时成立，才放弃该 URL 退回新会话；其余错误一律不构成缺失，一次瞬时 5xx 不得把用户踢出会话。                                                                                                                                                                                                                                    |
| S8a | 打开线程时**只探一次 `GET /threads/{id}`**，不再另发 `/state`（与 React `useThreadMetadata` 同形）。两个路由的 `values` 是同一份：后端都走同一个 accessor 的 `aget(config)` 取同一个最新快照，再用同一个 `serialize_channel_values_for_api` 序列化（实测键集与 JSON 全等），所以 `{ ...metadata.values, ...state.values }` 是拿一份值盖它自己——有 checkpoint 时两边同值，没有时 `/state` 404 而 `GET /threads/{id}` 仍 200 返回空快照，两条分支都是 no-op。                                                                                                                                                                      |
| S8b | 打开线程时**无条件**取一次最新 checkpoint 当种子（`POST /history`，`{ limit: 1 }`），把它喂进 runner，再由 `mergeMessages` 覆盖在 `/messages/page` 的行上——与 React `useStream({ fetchStateHistory: { limit: 1 } })` 同形（SDK 的 `values = stream.values ?? historyValues`）。**不能用 `GET /state`**：后端只有 `get_thread_history` 会把 run 身份写回消息（每条 ai/tool 的 `run_id` + 每回合最后一条 AI 的 `turn_duration`），`get_thread_state` 两个字段都没有。**`useThreadHistory` 保持纯分页，不得再加 checkpoint 退路**（上游 hooks.ts:2623 也没有）：那会让同一条线程发两次 `/history`，而且两条路径造出来的行形状不同。 |
| S8c | 种子有两道**不可合并**的守卫：run 已经开始（`threadId` 从 `null` 变成真 id 那条路径）就**不发请求**（对应上游 SDK 的 `submittingRef.current === threadId` 就 return），而 runner 的 `seedDurableState` 只在 `idle` 时收下（`values` 帧对 reducer 是全量替换，晚到的种子会抹掉正在流的消息）。切 thread 时 runner `reset()` 回到 idle，于是下一条线程能重新种。响应回来时线程已经换了就丢弃。**空数组不是空种子**：没有 checkpoint 时不种，种一帧 `{}` 等于把 store 清空。                                                                                                                                                        |
| S9  | 侧栏是 `div` + `ul`/`li`，不是 `aside` + `nav`；触发器名字恒为 `primitives.toggleSidebar` 且不带 `aria-expanded`/`aria-controls`；贴边的 rail 同名但 `tabindex="-1"`。窄屏抽屉关闭时整棵子树离开 DOM，一条会话都没有时「最近的对话」标题与列表都不渲染。这些都对着 React 的 shadcn sidebar 与 `RecentChatList`（`threads.length === 0` 直接 `return null`）取的形状——多出来的地标、随状态变化的按钮名、以及只在屏幕上消失的空列表，都会让读屏器听到的和 React 不是同一个界面                                                                                                                                                     |
| S10 | 线程无限查询每页显式保存 `{ threads, nextOffset }`，`nextOffset: null` 表示服务端已耗尽。`threads` 是可变的可见集合；map/filter/upsert、本地插入/删除与 TanStack structural sharing 都不得由可见条数重算服务端 offset 或结束状态。sidebar 默认 false、归档 true 与引用 all 各自持有独立 query key；真实 composable/QueryClient 回归覆盖变更后 raw offset 51 与短页结束。                                                                                                                                                                                                                                                         |

---

## 使用建议

1. 修改 `app/core/` 时连同单测和调用方一起检查；通用包变更还要运行 `make consumer-check`。
2. 组件层的约束（B、D、H 组）没有单测覆盖的部分，靠 Playwright E2E 兜底。
3. A 组与 L 组是自研 SSE 的正确性基线，必须有对应单测，**不能只靠 E2E**——流式的时序问题在 E2E 里既难复现也难定位。
4. M 组适用于所有 Vue 组件和 composable，不属于某一个业务域。
5. 每次改变产品行为、Gateway 合同或框架边界，都要回到对应小节更新约束和测试路径。

### 存储、子任务和响应展示

Lark 安装后目录刷新的晚完成不能越过已关闭面板或已退休账户发布通知、发起状态回读。
授权链接复制的成功/失败提示只属于发起时的 pending flow；该流程已完成、面板卸载或
账户失效后不再提示。已经发给浏览器的复制操作与异步完成提示分别处理。

- 项目视图共享 `deerflow.local-settings` 的 `projectsDisplayMode`；旧 Vue 分组值可读，
  下次正常保存迁移。账户设置和其他本地偏好不得随迁移丢失。
- 子任务标题取去空白后的 description、prompt 或当前语言标签；实时状态的占位描述不能
  覆盖当前工具调用。上传校验错误展示字段位置与消息；coded API 展示消息而非整段 JSON。
- Artifact 编辑的 expected_sha256 必须匹配完整文件原始字节；HTTP LAN 环境缺失 WebCrypto
  或 ETag 时仍计算真实 SHA-256，包括 BOM。截断内容不得使用完整文件的 ETag 进入编辑。

### 工具产物登记与流式通道

`agent-deerflow/reducer.ts` 在同一个 updates 帧内按节点顺序累积已渲染通道：
`artifacts` 追加去重，`tool_artifacts` 按 handle 更新、保留初见顺序并消费 trim_to
与1000上限，todos/goal 的 null 保留旧值，todos 的空数组清空。values 仍是完整替换。
未被 UI 消费的扩展字段仅保留最新 wire 值，不宣称是后端归约后的权威快照。
主聊天和侧聊从各自 stream owner 把 registry 传给 MessageList；processing 视图模型
按 tool_call_id 关联，通用工具步骤展示与 React 相同的文件/集合图标、名称、句柄和原始引用
title。组件不再次查询、不复制服务端状态；中途尚未收到的 args 归一为空对象。
`tool-artifact-registry.spec.ts` 覆盖真实开放 SSE 的追加、消费更新、裁剪、刷新恢复与两种主题。

Artifact preview reads remain bounded to the existing byte limit even when a server
ignores Range. Requesting the full file changes the request budget, not the
completeness check: partial responses or fewer bytes than the declared total
remain truncated and do not receive an editable revision, even with a SHA-256 ETag.

### Opt-in submission observation

Parity observation is disabled unless a capture explicitly opts in. Ordinary
human allocation/reuse and the actual submission-call attempt share one local
observer and their initiating action, including after asynchronous uploads.
Observation must not add UUIDs, alter callback order, reread caller getters,
change headers/retries or turn a call attempt into backend acceptance. Vue's
effective idempotency key is read once after onSend: nullish fallback, explicit
same-value and explicit empty keys remain separate facts. React's missing key
remains missing. Additional messages and matching text do not inherit the
appended human's identity. Mounted send tests and actual producer browser tests
check these boundaries; complete typed Request admission is a separate gate.

### Conversation mention scope

Conversation mentions include authorized active and archived conversations, as
React's unfiltered infinite thread query does. The current thread and sidecars
remain ineligible. The picker queries only while reference capability is enabled,
and reuses `useThreads({ archived: "all" })`; the sidebar keeps its active-only
default and its own query membership. Sidecar filtering must preserve raw server
offsets for subsequent pages. Mounted picker and pagination regressions verify
selection identity, capability gating and independent sidebar contents.

### Public Showcase state ownership

Public Showcase reads one complete fixture snapshot. Its title, messages, artifacts,
todos, goal, tool registry and exported state must share that owner. Pending, missing
or failed public reads must never display workspace metadata, stream values or a local
workspace goal. A route/mode change clears the snapshot synchronously and aborts the
previous read; a late response or unmount cannot publish it. Returning to workspace
mode restores the workspace owner. Tests mount the real Vue owner and AgentChat;
public browser regression uses the allowlisted Showcase URL and public read protocol.

已识别账户的 session refresh 遇到传输错误、JSON/用户结构解析错误或非 401 HTTP 错误时，
保留当前 session owner、query cache 与已编辑 DOM；冷启动仍报告 unavailable。
权威 401 与显式 logout 继续退休账户，成功的真实账户切换继续隔离状态。

### New project conversation creation

`useChatThreadOwner` sends one initial `POST /api/threads` with `thread_id`,
`project_id` and optional agent metadata before any run, goal or document attach.
The response must confirm the requested project before publishing or preparing the
thread. Existing-ID create is idempotent and never moves or patches metadata; the
client must not manufacture membership from the requested project. Failure leaves
the same draft UUID retryable and blocks subsequent operations. Unscoped chats
retain their existing REST client creation path. Creation is deduplicated per
owner; account, project, conversation and agent departure or unmount fences late
completions. Exact draft-to-durable route adoption preserves that owner.

Both create aliases in the shared Gateway mock use the same project state and
idempotent creation contract, strip server-reserved metadata and reject
unavailable projects. Mock HTTP coverage is distinct from
`tests/e2e-parity-session/project-thread-birth.spec.ts`, which exercises both
frontends with real authentication, replay Gateway and SQL project membership.

### Nested Dialog close ownership

每次程序化打开的 nested Dialog 归还本次 opener；显式 Trigger 优先。retained content
关闭也必须发出同一可取消 close-auto-focus，不得绕过调用方直接 focus 历史入口。
动画退出后的旧回调不能覆盖新的控件、重新打开的子层或已切换的 route/account。
opener 已移除、disabled 或 inert 时由仍存活的父 scope 接续键盘操作。Memory 导入
保留真实 pending、失败重试、规范化 payload 和 input 节点；自然 filechooser 与直接
设置 input 的原生用例保留各自实际 opener，并验证子节点物理消失及 Tab/Shift+Tab。

非模态程序化 Dialog 也须归还本次 opener；显式 Trigger 优先，但 outside interaction
与 close-auto-focus 的 preventDefault 不得被 retained present watcher 绕过。父子层
同批移除时，仍存活的外部 Trigger 应恢复焦点；实际新控件或新层已接管时不覆盖。

### 普通首发的有界来源准入

ordinary first-send 的 typed 准入限定独立声明的单一 thread lifetime、human
allocation、send/submission 与完整 Request 候选域；source action 与 send action
分别验证，Vue agent 的跨 action 不能被改写。draft→persisted 仅允许同 owner、
同 raw/account/project/agent 的规范路径采用。额外、退休、未知或矛盾来源全部
保留为缺证，不能按到达顺序或最近时间猜配。投影只替换获准尾项 id 与本请求
默认幂等键引用；显式同值键、正文同值、前置消息、response/failure 仍原样保留。
任一错误使整批三种请求视图恢复 literal；它不证明 HTTP 因果，T01–T18 穷举证明已于 2026-11-24 取消。

### Memory 导入的旁观发送边界

Memory typed 准入目前限定独立稳定账户与一个已发布文件 receipt，不能借 thread
scope 作为 Memory 账户证据。所有 choice/fact/select/dispatch/retire 与精确 import
POST 都参与；坏候选、预先取消或多来源不得先过滤。文件位置和 generated/literal
来自独立 fixture 声明；同来源重选/重试复用原事实。时间前缀只排除请求早于足量
dispatch 的矛盾，不产生请求与尝试的因果配对。多 generated 叶节点同时投影，
全部 literal 位置和重复数保留；共享冲突域核 thread/human/fact 来源，任何错误
整批回退。此范围不是任意并发/取消/跨账户及 T06 的完整因果证明。

默认关闭的 Memory 观测把 pending 和真实 normalized memory 对象关联到同一局部
WeakMap receipt；Vue 仅在已启用回调中对实际传入对象 `toRaw`，不改变业务 ref。
同内容 clone、不明来源、未选及已退休的消费不能自动成为当前选中导入。
`memory.dispatch` 只在真实 authenticated fetcher 完成 CSRF/最终 init 之后、原
native fetch 之前发出，记录 state/preAborted，不承诺请求送达或服务端接受。
序列化、CSRF 失败以及 mutationFn 之前的取消没有 dispatch；预先 abort 仍保留
原 fetch/AbortError 行为。观察关闭时不额外读取 signal.aborted，观察异常不能
改变 body、headers、credentials、重试、缓存、焦点和原错误。失败重试复用既有
normalized payload/source，不重新生成事实 ID。React static 短路同样没有原生
发送证据。实际设置页、API/真实 fetcher 和原生浏览器分别验证这些不同层次。

### Prepared replay 来源字段存在性

每个 response/attempt snapshot 必须保留 `source_message_ids` 的 own 字段类型：
absent、array、null、invalid、unreadable。空数组不能冒充缺省；own undefined
必须 invalid；观察器不得执行 accessor。缺新字段的旧记录不得补造存在性证明。
真实 JSON 单次消费、UUID 次数、原提交参数和公开消息采用行为保持不变；Vue 的
nullish fallback 与 React regenerate 的调用方覆盖列表分别按实际实现验证。
观察开启不能增加 source getter 的读取：合成非 JSON 对照中 Vue 产品自身一次，
React regenerate 零次。来源记录不等于 replay HTTP 归属或服务端 run 已接受。
