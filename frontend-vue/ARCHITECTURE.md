# Vue 前端架构

本文描述 `frontend-vue` 当前代码结构和依赖边界。它只维护长期有效的实现事实；阶段计划、
迁移过程和单次验收结果不属于本文件。

> **状态边界：** 本文件描述已经存在或应保持的架构边界，不表示 L3 产品能力已与 React
> 完全对齐。如果架构描述与实际源码不一致，**以当前源码为准**，并在同一改动中修正文档。
> 完成度不由任何文档自述，只由代码、测试和门禁证明。

## 与 React 的对齐范围

对齐范围**只覆盖产品面**。范围内的判据是双向的：**React 有的 Vue 都要有，React 没有的
Vue 不许有。** 后半句是最容易漏掉的一半——此前的规则只写了前半句，于是 Vue 自造的错误
提示、自加的 aria-label、以及被重新措辞的整组 artifact 面板文案，在所有门禁全绿的情况
下长期存在：门禁只比对了「React 有、Vue 无」这一个方向。差异必须**双向**枚举。

豁免项**不写在这里**。它们是数据，写在 `baseline/react-parity-scope.json`，由
`tests/parity/product-surface.test.ts` 读取并在过期时变红。上一版豁免是本文件的一节
散文；那节被整段删除之后，`/pricing` 与 `/about` 当场被判成违规删掉，而没有任何门禁
能说出那是一次决定还是一次事故。散文改不出这个性质，数据可以。

当前豁免的是营销落地页 `/` 的**内容**（双向：Vue 保留自己的入口页，既不复刻 React 的
落地页，也不因为「React 没有这个 UI」被反向清理删掉）、Nextra 内容站的四条路由，以及
整站无后端的静态回放部署模式。准确定义、边界情形和过期判据都在那份 JSON 里，它同时钉
住两件反直觉的事：`/showcase/[thread_id]` **在**对齐范围内，而 React 里零消费者的死代码
不是豁免、是**禁止移植**。

### 三处只能对齐可观察行为

以下三处的**源码形式**无法相同，因为两边是不同的框架和库。这不是豁免，是把判据
从「代码一样」换成「行为一样」：

- **Next Route Handler ↔ Nitro server route**：判据是同样的 URL、method、
  状态码、响应体与错误形状。React 侧每有一个 route handler，Vue 就要有一条对应的
  HTTP 行为——静态回放模式下的那些除外，它们属于豁免的部署模式。
- **图标库与组件库内部 DOM**：React 用 lucide-react + shadcn(radix)，Vue 用
  lucide-vue-next + reka-ui。判据是 role、accessible name、层级、顺序、可聚焦性
  与键盘行为一致；不比 class 名、包装元素和 primitive 内部结构。
- **React Context/hook ↔ Vue composable 的写法**：判据是它们产生的状态转换与
  副作用时机一致。

这三处是**判据的换算**，不是豁免；豁免只有 `baseline/react-parity-scope.json` 里那些。
「那个组件反正没人用」尤其不构成理由——按双向判据，没人用的组件搬进 Vue 是新增差异。

### 严格对齐的内容

URL、method、query、headers、body、响应解析、错误信息、缓存失效、SSE/WS 事件、
用户状态、页面能力、交互顺序、语义 DOM、键盘和焦点行为、响应式布局，以及
**用户可见的每一段文案**——包括 React 从第三方组件（如 streamdown 的表格
复制与全屏控件）渲染出来、并不在它自己词典里的那些。比对文案时只看词典会把
Vue 的忠实复刻误判成自创。

未对齐项由投影工具枚举，不写进本文件：写进散文的清单会先于代码过期，而且会被
下一个读者当成「已经想清楚可以不做」的东西。

## 运行拓扑

浏览器只访问同源的 Nuxt/Nginx 入口。`/api/langgraph/**` 在代理到 Gateway 前改写为
`/api/**`，其余 `/api/**` 原路径转发。Nitro catch-all
`server/routes/api/[...path].ts` 委托 `server/utils/gateway-proxy.ts`，统一执行：

- 路径穿越、Host 和请求体大小检查；
- 覆盖可信的 `Forwarded` / `X-Forwarded-*` 头；
- SSE 请求与响应流式转发；
- 手动处理重定向，避免 Gateway 的认证跳转被代理吞掉。

Docker 开发统一使用 `make docker-start`：React 与 Vue 都在容器内运行开发服务器，
Compose Watch 同步源码并在依赖清单变化时重建对应镜像；Nginx 以默认 host 选择 React，
以 `vue.localhost` 选择 Vue。本地非 Docker 开发时，`make dev-vue` 启动 Gateway `:8001`
和 Vue `:3100`。生产 Compose 同时构建 React 与 Vue，由 Nginx 按 hostname 选择：
未知/default host 仍进入 React，只有 `DEER_FLOW_VUE_HOSTNAME` 进入 Vue。部署细节见
[`../docs/dual-frontend-production.md`](../docs/dual-frontend-production.md)。

## 三层边界

| 层                 | 当前目录                                                                                                            | 职责                                                                   | 禁止依赖                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| L1 通用 Agent 内核 | `packages/agent-core/`                                                                                              | SSE 分帧、session 状态机、退避、watchdog、external store、通用消息合同 | Vue/Nuxt、Pinia、TanStack Query、DeerFlow URL/事件名 |
| L2 可复用 UI       | `app/core/markdown/`、`app/core/code-editor/`、`app/components/markdown/`、`app/components/ui/`、`app/lib/utils.ts` | Markdown 流式渲染、代码块、Mermaid、代码编辑器、UI primitive 层        | DeerFlow API、线程、认证、产物和业务 store           |
| L3 DeerFlow 应用   | `app/core/agent-deerflow/`、`app/core/api/`、`app/composables/`、页面和业务组件                                     | Gateway 协议适配、缓存、线程生命周期、认证和产品功能                   | 不得把协议专有知识反向写入 L1/L2                     |

## UI primitive 层

`app/components/ui/` 是唯一的交互控件底座，建在 Reka UI 之上：Dialog、AlertDialog、
Sheet、Popover、DropdownMenu、Select、Tabs、Switch、Tooltip、HoverCard、ScrollArea、
Command、Button、Suggestion（建议 chip 行，对位上游 `ai-elements/suggestion.tsx`），
以及建在 CodeMirror 6 之上的 CodeEditor。

**上游 `ai-elements/*` 映射进这一层，不另开一个平行目录**——`components/markdown/*`
一直是这么来的，2026-09-16 补 `ui/suggestion/` 时沿用了同一条。产品组件不再直接 import
`reka-ui`——焦点陷阱、Escape、外点关闭、方向键与 aria 状态属于这一层，散在调用点
就会各写一份、各错一处。

三条硬约束，都是实测踩出来的：

- **primitive 不持有产品文案。** 关闭按钮只在调用方传入 `closeLabel` 时渲染，
  placeholder、aria-label 一律由调用方给。i18n 源码门禁把 `app/components/**` 全部
  纳入扫描，primitive 也不例外。
- **转发 props 用 Reka 的 `useForwardProps`，不要展开 `{ ...props }`。** `defineProps`
  会把没传的 prop 也变成存在的键（Boolean 甚至是 `false`），整份展开等于对底座的每个
  默认值显式赋值，且不报任何错。
- **内容 portal 到 body 的 primitive 必须 `inheritAttrs: false` 并把 `$attrs` 绑到内容
  元素上**，否则调用方的 `data-testid` / `aria-label` 会落在不渲染 DOM 的 Portal 上。

模态语义与层级：Reka 不写 `aria-modal`，本层显式补上（Popover 这类非模态浮层绝不加）。
所有 portal 浮层共用 `z-80` 一层，谁后打开谁在上；只有 tooltip 用 `z-90`。
tooltip 与 dropdown 套在同一个按钮上时 tooltip 必须在里层——两者各渲染一个
`PopperAnchor`，顺序反了下拉就会失去自己的 anchor（见 `BEHAVIOR_CONTRACTS.md` 的
M7/M8——那是合同编号，不是迁移阶段）。

代码编辑器同样住在这一层。框架无关的部分是纯 TS：`app/core/code-editor/language.ts`
拥有唯一的语言归一表和语法包动态加载边界，`palette.ts` 只放语法色（外壳颜色走
CSS 变量，跟随主题自动翻转），`editor.ts` 在任意宿主 DOM 上创建 `EditorView` 并
暴露 `setDocument/setLanguage/setTheme/setReadOnly/focus/destroy` 句柄。
`CodeEditor.vue` 只做接线：v-model、只读、主题、可访问名字和销毁。
CodeMirror 全部经 `await import()` 进入，首屏不加载一个字节；`nuxt.config.ts`
的分包规则把它们收进 `vendor-codemirror`，预算在 `scripts/asset-budget.mjs`。

`@deerflow/agent-core` 只允许从包根导入。`package.json#exports` 和
`packages/agent-core/tests/architecture.test.ts` 同时阻止深路径依赖。包仍是私有源码包，
没有发布到 npm；复用方式见 [`REUSE.md`](REUSE.md)。

## 聊天数据流

1. `useThreadStream.ts` 创建当前会话的运行上下文，并通过
   `app/core/agent-deerflow/thread-runner.ts` 装配 L1 session 与 DeerFlow `RunProtocol`。
2. `run-protocol.ts` 负责 create/resume/cancel/inspect；`event-map.ts`、`message-adapt.ts`
   和 `reducer.ts` 把 Gateway wire 事件转换成内核动作。
3. `packages/agent-core/src/session/` 管理 create-once、resume 游标、gap、重试、取消和终态；
   `src/store/` 合并同一宏任务内的通知并发布不可变 snapshot。
4. TanStack Query/composable 将 live snapshot、checkpoint 历史、乐观消息和分页数据
   合并为 UI 状态。`useThreads.ts` 是主线程列表的唯一 server-state 所有者；models、skills、
   session 与 thread token usage 也各有唯一 Vue Query composable，不保留第二份真相。
   排序、sidecar 过滤与身份规则集中在 `app/core/threads/`。
5. custom 帧由 `tasks/custom-event.ts` 统一折叠 task 生命周期、步骤、累计 token、模型和
   `llm_retry`；`SubtaskCard.vue` 展开历史 run 时才回填持久化步骤。
6. `messages/processing.ts` 在每个 processing 组内一次性关联 tool result/browser frame，并投影
   React 可观察的步骤顺序、折叠边界和 trailing reasoning；`ProcessingMessageGroup.vue` 与
   `MessageList.vue` 只消费该视图模型，不再逐条渲染原始 ToolMessage。composer、产物/
   sidecar/browser 面板仍消费同一线程状态，扩展通过事件和 panel state 接入，不改变 L1 session 状态机。

Composer 的 tab 草稿由 `useComposerDraft.ts` 集中管理，key 是 user + agent/lead-agent +
真实 thread 或稳定 `new` 草稿 scope；新会话实际 run target 仍使用本次 runtime UUID。
技能目录 ready 后才恢复，后台 run `onStart` 前不清草稿。
本地 `File` 与已上传 descriptor 留在 composer 内存中，失败可重试但不进入服务端缓存。
模型/模式经 `models/capabilities.ts` 归一化后才进入 `threads/submit.ts` 的最终 context。模型能力
控制 composer 可见选项；wire context 保留 explicit effort 或按 mode 推导的 React 等价 fallback，
Gateway model factory 再负责在创建 provider 前剥离模型不支持的 kwargs。

Agent 创建沿用同一个 thread runner，没有第二条保存 transport。`AgentChat` 创建真实 prepared
thread 后，在 bootstrap 页面通过 `displayThreadId` 消费该 thread 的 live snapshot；Save 的隐藏
human 指令由 `useAgentCreationSession` 独占生命周期。纯 `agents/creation-session.ts` 只把
`AIMessage.tool_calls[].name === "setup_agent"` 与匹配 `ToolMessage.tool_call_id`、显式
`status` 关联，assistant 文本不参与成功判定。成功结果进入有界 `getAgent` 验证；generation、
AbortController、timer cleanup 和 effect-scope dispose 共同拒绝旧 run/验证结果回写。
初始 design conversation 成功且同一 send owner 完整释放后，Save 才进入 ready；这是一条显式
状态边界，不通过 timeout 或并行提交来规避 runner 所有权。

MessageList 直接消费持久化消息：现代/legacy 附件、隐藏 HIL 回复、
citation 和 per-turn usage 都不依赖提交前 UI 状态。processing 只走一份步骤投影；终态 reasoning
流式时展开、settle 后只自动收起一次，尚无终态 assistant 时显示 live run activity。
`AssistantTurnActions.vue` 独占 assistant 尾部按钮的共享 Button 规格，`MessageList.vue` 只决定
哪些动作可用并拥有滚动 gutter、内容 padding 和组间 gap；72 px 尾部空间属于内容 wrapper，
长历史虚拟窗口偏移属于语义 `<ul>` 的 padding，二者都不插入 spacer DOM 或伪装成消息列表项，
因此按钮命中区、
横向起点和消息尾部留白都能从结构推导，而不由调用页添加位置偏移。
`MessageMarkdown.vue` 是消息、reasoning 与 processing 文本的唯一产品适配器，集中提供安全预处理、
GFM/math/streaming 插件和 Streamdown 等价组件，防止调用点漏传插件后把表格静默退化成纯文本。
三个重量级渲染器都按内容加载，不进关键路径：代码高亮（shiki）由 `CodeBlock.vue` 触发，
图表（mermaid）由 `MermaidDiagram.vue` 触发，公式排版（KaTeX，约 264 KB raw）由
`core/markdown/math.ts` 的 `containsMath` 判定后动态 import。判据宁可多报不可漏报——
多报只是白下一次，漏报是公式永远渲染不出来且不报错。
第四个是 artifacts 面板：`AgentChat.vue` 用 `defineAsyncComponent` 引入 `ArtifactPanel`。
它本来就在 `v-if` 后面，但静态 import 会把 `ArtifactPreview` → `rawHtmlRehypePlugins`
→ `rehype-raw` → **parse5** 整棵树放进聊天首屏，而消息路径从不渲染 raw HTML
（见 `core/markdown/plugins.ts` 文件头：DeerFlow 整条替换了 Streamdown 默认链，
raw HTML 由 `remarkHtmlToText` 降级成转义文本）。parse5 一个包就占 `vendor-markdown`
源码体积的 24.8%。
`thread.values.todos` 与最终 token usage 仍由 thread snapshot/API 提供。Gateway feedback 字段和 core
API 可继续无损存在，但当前 React 消息调用点没有启用该入口，因此 Vue 不显示点赞/踩，也不建立
只由 Vue 触发的 feedback mutation。

follow-up 配置是 Vue Query 持有的服务端状态，由 `useSuggestionsConfig.ts` 独占缓存和重取；run 完成
时若配置尚未返回，先等待同一 query，再决定是否请求 suggestions，组件不维护第二份布尔配置。
主 composer 的附件入口是唯一可见、可聚焦的语义 button；隐藏 file input 只承担文件选择，避免
用 label 点击偶然实现鼠标可用、键盘与可访问性却偏离 React。
`ComposerSurface.vue` 拒绝隐式 padding 和 padded 双轨，通过
`input-group-header/body/footer` data-slot 统一拥有输入组边界、焦点环与分区几何；主
`ChatComposer.vue` 和 sidecar 都消费同一套 64 px body / 50 px footer 合同，调用方只提供功能
控件。主会话与 sidecar disclaimer 都由各自底部容器脱离文档流呈现，不改变 surface 高度。
sidecar 的 `composerBusy` 是提交/流式期间唯一的交互锁 owner，同时驱动 form busy 语义、textarea
与 submit 禁用；面板隐藏再打开不会提前解锁同一条仍在运行的会话。

流式重连、消息顺序、缓存失效和面板行为的硬合同见
[`BEHAVIOR_CONTRACTS.md`](BEHAVIOR_CONTRACTS.md)。

## Browser control 所有权

Browser control 是 L3 DeerFlow 能力，不进入通用 agent 内核或 L2 UI。状态链只有一条：

1. `AgentChat.vue` 从**当前主线程**消息中提取最新 ToolMessage
   `additional_kwargs.browser_view`，持有静态 `BrowserViewFrame` 与面板开关。截图变化可自动
   打开；它另外记录已经观察过的消息帧，避免消息列表刷新时用旧截图覆盖新 REST 结果。
   route 变化清空，feature 禁用关闭，`BrowserPanel :key="threadId"` 保证旧实例销毁。
2. `BrowserPanel.vue` 持有本实例的 `requestedLive`、URL 编辑态、最后 live/REST
   URL/title 和 REST mutation。Live/Connecting/Reconnecting/Static 都是这些客户端事实的
   推导值；Gateway 没有也不接收 mode/state 字段。
3. `useBrowserStream.ts` 是 Vue scope 适配层：把纯 `BrowserConnectionController` snapshot
   映射成 refs，并独占 `LatestBrowserFrameBuffer`。关闭 Live 保留末帧；换 thread 或
   scope dispose 才回收 blob URL。
4. `app/core/browser/connection.ts` 是 socket、最后一次 pending navigate、重连 timer/
   budget、generation stale guard 和 terminal REST 交接的唯一 owner。组件不得另建 retry
   timer 或第二个 socket 状态机。
5. `browser-api.ts` 只调用 Gateway 已有的
   `POST /api/threads/{thread_id}/browser/navigate`，请求 `{ url }`，并以生成的
   `BrowserNavigateResponse` 收敛 screenshot/url/title。4xx/5xx 经统一 Gateway error parser
   保留 `detail`；切 thread、关闭/隐藏面板或销毁会 abort 并拒绝过期响应回写。
6. `app/core/browser/geometry.ts`、`keyboard.ts` 与 `protocol.ts` 是框架无关业务规则：只声明
   Gateway 已接受的 wire；object-contain letterbox、move/wheel rAF 合并、keydown/IME 和
   宿主快捷键边界不散落在模板中。

测试证据分层：`tests/unit/browser/` 使用 fake socket/HTTP 证明纯状态机和 DOM 生命周期；
`tests/e2e/browser-control.spec.ts` 使用 Mock Gateway/Mock WS 证明 Vue 自有 DOM 到 wire；
`tests/e2e-browser/browser-panel.spec.ts` 使用本地真实 FastAPI Gateway 与真实 Playwright
Chromium browser runtime 证明握手、REST 和二进制帧。最后一层的模型 harness 仍是 replay，
不等于生产模型、DNS/TLS、外层代理或真实 IdP 证明。

## 路由、渲染与认证

- `config/routes.ts` 是 CSR 分区、代理常量和转发头策略的单一来源；公开页面保留 SSR，
  使请求 cookie 派生的 locale 与首屏 HTML、Nuxt payload 在 hydration 两端一致。
- `/workspace/**`、登录/设置/认证回调使用 CSR；首页、价格和关于页按请求 SSR，不能把
  cookie 派生的 locale 固化进静态 HTML。
- `app/core/auth/session-query.ts` 与 `app/composables/useAuthSession.ts` 是 Gateway session
  的唯一服务端状态来源。全局 middleware 通过同一个 Vue Query key 做路由判定，workspace
  banner 复用该缓存做后台/手动恢复；401 才进入登录，Gateway unavailable 保留当前工作区
  并显示可见恢复路径，不清 session/cookie。
- `/auth/callback` 复用同一 session query，按 `next-path.ts` 的规则拒绝开放重定向，并把
  authenticated、401、Gateway unavailable 收敛为不同状态和 replace 跳转。`/workspace`
  在真实模式固定 replace 到 `/workspace/chats/new`，不恢复 static demo/mock 分支。
- `app/core/auth/client-state.ts` 是认证主体切换的唯一浏览器状态清理边界。成功登录、注册、
  SSO callback、首次设置、密码重置设置和退出都会清空整棵 TanStack Query 用户态缓存与
  composer 草稿；不能只失效 thread key，因为 models、memory、skills、channels 等 key
  并非全部携带 user id，保留它们会在换账号后短暂暴露上一账号的数据。
- 密码和 access token 不进入前端存储，CSRF/HttpOnly cookie 由 Gateway 管理。
- 双 hostname OIDC 依赖请求 Host/Proto 重建回调地址。目标环境仍需配置真实 DNS、TLS、
  外层可信代理和 IdP callback allowlist；本地 fixture 不能替代这些部署配置。

## 状态所有权

以下所有权边界写在这里，是因为它们必须**持续保持**。本节描述的是**应当成立的
边界**，不是完成度声明——某一条当前是否成立，去读对应的代码和测试。

- 线程列表、历史页、models、skills、session 和 token usage：TanStack Query 缓存；`useThreads.ts` 负责主列表的
  raw-offset 分页和 sidecar 过滤，失效/删除镜像规则在 `app/core/threads/cache-invalidation.ts`。
- 当前流、乐观消息、prepared replay 掩码、task/retry 状态：thread composable 的
  thread-scoped ref；切换 thread、stop、error、finish 或 scope dispose 时按合同收敛。
- **本工作区没有客户端 store。** 服务端真相一律由 TanStack Query 持有，跨页面的
  纯 UI 状态由 composable + `provide/inject` 持有。Pinia 曾经注册着但一个
  `defineStore` 都没有，只往生产包里塞了一个空插件，已经移除；再引入客户端 store
  之前先确认它保存的不是服务端真相的副本。
- artifacts、sidecar、browser：各自 composable/集成根持有面板状态，但最终业务数据仍来自同一
  thread snapshot/API。artifacts 由 `useArtifactsPanel` 持有 open/selection UI 状态，
  `useArtifactDraft` 独占 baseline/remote/draft/dirty/conflict/edit 生命周期；切文件、关面板、
  切右侧产品、切线程、路由离开和 `beforeunload` 都必须先经过该 owner。文件能力只由
  `app/core/artifacts/policy.ts` 的显式扩展名/source allowlist 决定，未知、Office、archive、
  SVG、无扩展名和其他二进制 fail closed；MIME 不提升能力。`ArtifactPanel` 只编排当前路径的
  abort/generation 与 I/O，FileList、Editor、Preview、Actions 不复制状态。`ArtifactEditor`
  把 policy 语言与当前 resolved theme 交给 L2 编辑器，并把 `Mod-S` 转回同一条
  revision 保存路径；它不持有第二个保存入口。sidecar 进一步拆成 `useSidecar` 的开关/引用状态与
  `useSidecarSession` 的唯一会话状态；后者独占 restore-before-create、run、附件上传缓存、
  HIL 与真实删除，`SidecarPanel` 只做 UI 适配。隐藏或切换右侧面板不销毁 session，切换主
  thread 或 scope dispose 才使旧异步结果失效。
- browser 的静态 frame/open 归 `AgentChat`，transport 归 per-panel controller，REST 归
  `BrowserPanel` 的 Vue Query mutation；三者不得互相复制。Gateway `url`/`tabs` 事件与 REST
  响应是 URL/title 真相，live/static 只是客户端展示状态。
- scheduled tasks 的服务端真相只归 `useScheduledTasks` 的 TanStack Query key tree：全局列表、
  thread 列表、detail 与分页 runs 使用不同 key，mutation 通过 `query-keys.ts` 集中声明精确
  invalidation/remove 目标。页面只拥有 route 默认值、筛选和当前 selection；selection 在过滤或
  删除后由纯 view-model 确定性收敛。`form.ts` 独占 once/cron、recipe、timezone/DST 与
  create/PATCH payload 转换，组件不得另拼 wire body。runs 只由 infinite query 的
  `limit/offset` 分页持有，活动 run 轮询随 query observer/scope dispose 停止，旧 task/thread
  请求不能写入新 key。
- channels 的服务端真相只归 `useChannelConnections`：providers key 只保存能力、配置与
  connectable，connections key 按认证 user scope 保存全部账号 instance，并独占展示状态。
  connect/configure/单 connection DELETE/provider runtime DELETE 后重读两端；connect poll 只
  更新原 scope 的 connections key，发起绑定前已 connected 的 ID 不得完成新账号绑定。
  generation、AbortSignal、effect scope dispose 共同阻止旧 query/poll/mutation 跨用户回写。
  组件与 provider.connection_status 均不得建立第二份用户连接真相。
- agents/models 的服务端真相只归 `useAgents` 与 `useModels` 的 TanStack Query key；gallery、
  creation success、settings update 与 delete 都同步或失效同一份 Agent key，组件不
  保留镜像。`agents/settings.ts` 独占 capability-aware exact PUT body，`agents/presentation.ts`
  独占 card 的 model/skills/tool-groups 映射；`tool_groups` 的 null/empty/ordered values 不在
  模板中重新解释。
- Memory 服务端真相只归 `useMemory` 的单一 TanStack Query key；fact create/PATCH/delete、
  clear/import 成功后由该 owner 写入或重读同一缓存，组件不保留第二份 response。导入解析与
  storage-valid fact 检查只归 `memory/schema.ts` 纯函数：完整 export 结构才进入 preview，重复
  fact ID 拒绝，forward extra 与不同 ID 的重复 content 保留并警告。搜索、confidence 筛选和
  PATCH diff 只归 `memory/view-model.ts`，显式 `0` 不得被 truthy 判断丢失。
- Settings 权限只从共享 `useAuthSession` 与 Gateway auth-disabled 语义经
  `useSettingsPermissions` 派生。`useSkillSettings` 复用 catalog 的 skills query key，允许普通
  authenticated user 读取但只允许 admin mutation；`useMCPConfig` 是 MCP config 的唯一 owner，
  已知 non-admin 时不发 GET/PATCH。两类 mutation 均不 optimistic，并在成功后 authoritative
  re-read；401、403/admin-required 与通用请求失败保持不同状态。
- Workspace shell 的 command palette、settings host 与 toast store 只在
  `app/layouts/workspace.vue` 各挂载一次。`useSettingsDialog` 只持有客户端 dialog/focus
  边界，实际 open section 由 route query 决定；关闭仅移除 `settings`，保留其余 query/hash。
  Gateway banner 复用唯一 session Query，并立即观察 middleware 预填的 unavailable 状态，
  因此恢复通知不依赖组件先于路由守卫挂载。
- workspace changes 的服务端真相只归 `useWorkspaceChanges`。summary/detail 由
  thread/run/include_files/include_diff 完整 key 隔离，queryFn 必须消费 AbortSignal；组件只持有
  panel open 状态，不复制 response/error。recent-thread 的 share/export pending 状态归每个
  `ThreadActionsMenu` 实例，线程列表仍只由 `useThreads` 持有。
- composer draft 是 `sessionStorage` 的 tab 状态，只持久化文本/skill；user、agent 与逻辑会话
  三维隔离，并在确认 logout/thread delete 后清理。上传文件、语音、follow-up dialog、polish
  和 generation guard 是组件/composable 瞬态状态，不得错误跨 thread 复用。
- locale 的唯一运行期状态归 `app/plugins/i18n.ts`：同一 ref/computed 同步 typed dictionary、
  cookie 与 `document.documentElement.lang`，SSR 请求从 cookie 派生首屏状态，CSR shell 在
  hydration 完成后消费浏览器偏好；已打开组件和后续 toast 不缓存第二份 locale。
  `en-US`/`zh-CN` 精确 key 与 audited unused 集合由 `baseline/i18n-keys.json` 固定；
  `make i18n-source-check` 以 Vue/TypeScript AST 扫描全部产品 SFC。完整范围、动态内容边界与
  两个精确测试 fixture 排除项见 [`I18N_INVENTORY.md`](I18N_INVENTORY.md)。
- theme 的唯一运行期 owner 是 `app/plugins/theme.ts` 创建的应用级 controller；它独占
  `theme` storage、三态 preference/resolved、唯一 `matchMedia` listener、根 `dark` class 与
  cleanup。`AppearanceSettings` 和 sidebar 只读写该 owner。`nuxt.config.ts` 注入由同一
  `theme/bootstrap.ts` 生成的首屏脚本，在组件 mount 前应用 class/color-scheme，脚本本身不注册
  listener，因此不形成第二个生命周期 owner。公开根路由 `/` 临时强制 dark，但不改写
  用户 preference/storage；离开后立即恢复实际 preference。完整 locale payload 归独立
  `vendor-i18n` chunk 与显式 asset budget，不占用 `vendor-ui` 预算。
  **两本词典同装一个 chunk 是权衡后的结果，不是没人想过拆。** 实测拆过：把
  `clientTranslations` 换成按 locale 的 `await import()` 之后，`/` 的关键路径确实
  掉了 92,053 raw / 26,629 brotli——然后 prefetch 涨了 93,066 raw / 29,621 brotli，
  每个用户**净多下载 2,992 brotli**。原因是 Nuxt 按 client manifest 给 entry 的每个
  动态 import 都发 `<link rel="prefetch">`，两本词典都会被投机拉下来；而只要运行期
  还能切语言，两本就都从 entry 可达，这个 prefetch 无法只留一本。更糟的是当前 locale
  那本**也只拿到 prefetch**——`ssrContext.modules` 只收 SSR 渲染过的组件，plugin 里
  import 的纯 TS 模块进不去，所以拿不到 `modulepreload`。于是 hydration 会等一个
  `VeryLow` 优先级的请求，而路由预算反而报告「关键路径变小了」。结论：维持现状。

## 遗留的阶段命名

`tests/unit/` 的阶段目录（`wp02`…`wp12`、`m7`）已按用途归位，测试标题里的
`WP-xx` / `Mx` 前缀也一并去掉。**还剩下面这些**，它们都不表达当前的模块边界，
读代码时按内容找，不要从名字反推范围。清单由
`tests/guards/doc-facts.test.ts` 冻结：既不许某一项悄悄消失而文档还留着，
也不许再新增阶段命名的测试目录。

| 名字                                             | 实际是什么                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `app/pages/__m0/`                                | 两个浏览器测试 fixture 页，仅在 `NUXT_PUBLIC_M0_TEST_PAGES=1` 时挂载          |
| `NUXT_PUBLIC_M0_TEST_PAGES`                      | 上面那两页的开关；改名会波及 Dockerfile、CI 与 playwright factory             |
| `tests/support/run_m0_gateway.py`、`m0Gateway()` | 本仓自有的 Gateway 包装与它的 factory 入口                                    |
| `tests/support/m0_replay_provider.py`            | replay provider                                                               |
| `AGENT_CORE_CONTRACT_VERSION = "m8"`             | `@deerflow/agent-core` 的契约版本字符串；改它是对消费方的破坏性变更，不是改名 |

这些是**标识符**，不是文档措辞——改它们要连带动 Dockerfile、CI、后端 harness，
属于去迁移化任务，不属于本文描述的架构边界。E2E 套件、`app/core/`、
`app/components/`、`packages/` 与 `tests/unit/` 下已经没有阶段命名。

## 验证入口

```bash
cd frontend-vue
make verify          # lint、格式、类型、单测、i18n、OpenAPI、契约常量、独立性、build
make asset-budget    # 构建产物总量天花板（**不是**用户下载量，见下）
make e2e-mock        # 不需要后端进程的全部套件
make e2e-backend     # 需要真实 Gateway 的全部套件
make e2e-visual      # 产品截图；基线只有 `-darwin`，本机门禁
make e2e-list        # 收集全部套件并打印各自 test 数
make consumer-check  # 打包并在隔离 consumer 中验证 @deerflow/agent-core
make container-smoke # 生产镜像、health、SIGTERM、Showcase 资源与拒绝策略
```

两条体积门禁量的是不同的东西，别混：`make asset-budget` 把**全部**构建产物加起来，
管的是产物总量失控；用户真正下载的是 `make e2e` 里的
`tests/e2e/route-payload.spec.ts`——在真实导航里量浏览器请求的脚本，并禁止
shiki / mermaid / KaTeX 进入关键路径。两条命令都会打印当前实测值，**这里不抄**，
抄进散文的数字先于代码过期。两者可以反向变动：KaTeX 改成按需之后首屏少了
269 KB，而产物总量反而涨了 1 KiB。调性能看后者。

路由预算再往下分成 **critical 与 prefetch 两组，分别钉死**。一次导航里被请求的脚本
有两类来源：浏览器为了把这一页跑起来而拉的（entry、`modulepreload`、运行期
`import()`），和 Nuxt 为**下一次**导航投机拉的 `<link rel="prefetch">`。判据是 CDP 的
`initialPriority`——prefetch 是 `VeryLow`，其余都不是。加总会说谎：`/` 的四个
reka-ui chunk 曾被读成「营销页同步加载了 65 KB 对话框机器」，实测它们 100% 落在
prefetch 组，阻塞首屏的那 136 KB 里没有一个字节的 reka-ui；加总还会互相掩盖，
关键路径涨 30 KB、prefetch 少 30 KB，总量纹丝不动。成分检查（shiki/mermaid/KaTeX）
仍覆盖两组之并，投机下载同样是用户付的流量。

一个套件 = 一份 playwright config = 一种后端拓扑；套件名说的是**测什么**，
不是迁移阶段，完整清单见 [`README.md`](README.md) 的验证一节。新增功能按实际影响
选择 unit、协议、浏览器、视觉、真实 Gateway 或生产镜像门禁，不要从单次全绿推断
完成状态。

文档里写出来的每一条 `make` 命令都由 `tests/guards/doc-references.test.ts` 校验必须
真实存在——套件在 `1209651f` 按用途改名后，各处文档整整落后了一个版本，而所有门禁
当时全绿，因为没有任何一条检查读过文档。
