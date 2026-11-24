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

## 导航页面名播报

`RouteAnnouncer` 是根组件的客户端 shell owner，保留真正的 open shadow root
实时区域，避免普通 DOM 的 aria-live 豁免破坏模态背景隐藏。首次加载和同路由的异步
标题更新不播报。Nuxt `page:loading:start` 在 middleware 前退休旧工作并读取实际
离开页名；只有成功且仍属于当前 Router 和 Nuxt displayed route 的导航可消费一次
提交，名字相同也消费而不重复写实时区域。较早的同步离页拒绝及重复导航由带来源
route 身份的失败回调退休，旧导航的晚失败不会清除新导航。

公开 `injectHead` 的 `entries:updated` / `dom:rendered` 跟踪已登记但尚未写入 DOM
的 head。head 完成和 displayed route 更新都汇合到 Vue 的 post watcher，再按
标题、h1、pathname 读取本次页面名。复用 page key 且没有 head 更新时也走 DOM
提交后的 fallback。`page:loading:end` 同样会由失败导航发出，没有目标身份，不能
充当当前页完成信号。组件不读取内部 head 字段，不使用毫秒延迟或 DOM 观察器。

当前 Nuxt 在新页面 Suspense 完成后同步 displayed route；复用同 key 的页面在
Router afterEach 同步。useHead 的 pre watcher 先登记 head，默认 renderer 延后
写入 DOM，因此 post watcher 必须保留 headPending 等待实际完成，不能假定一次
nextTick 就有新标题。一次消费针对首个页面提交，之后数据产生的新标题保持静默。
Unhead 3 的公开 `dom:rendered` 已标记在 v4 移除；升级框架必须重新验证此契约。

首次 run 已接受后，`AgentChat.onStart` 只有在 started ID、prepared ID 和现有
submission owner 的 thread ID 一致且 owner 未退休时，才声明当前页面的 URL
延续。`route-announcements` Nuxt plugin 为每个 app/request 创建单个待消费意图；
不使用模块单例或序列化 useState。意图通过 Vue Router 公开 navigation state 的
`deerflowRouteAnnouncementToken` 关联实际成功提交，另核离开 route 对象、目标
fullPath 和 owner 有效性。单靠来源/目标路径不能区分并发的同路径导航，因此该
关联不可删。成功 afterEach 消费一次后不写也不清实时区域，不改 document.title
或业务缓存。任何成功的不同导航会退休旧意图；旧 promise 的 finally 只取消自己。
redirect 不具备延续资格。历史 state 的标记没有活跃意图就不生效，不手动修改
Router 的 back/current/position 等字段。附件接管、打开其他会话和 bootstrap 不
生产此意图。现有真实标题加载行为保持；这不是 Loading 文案黑名单或延迟等待。

挂载测试在 `tests/unit/workspace-shell/route-announcer.dom.test.ts`，真实双端断言在
`tests/e2e-parity/route-head-announcement.spec.ts`；入口存在不代表验收已通过。

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

聊天调度卡片的 footer action 必须限制在卡片内容宽度内，保留完整标签并自然换行/增长高度；最小按钮高度保持与 React 一致。不要用 overflow-hidden 隐去操作文字，也不要改变消息物理滚动 owner。`tests/e2e-parity/scheduled-card-reflow.spec.ts` 对两端中英文的聊天卡片与历史事件卡片验证组合回流、原生 Tab、完整文本与原始 scroller。

## 异步操作与视图生命周期

服务端 mutation 的完成与当前弹窗的呈现分开持有。新建项目、移动会话、重命名和渠道配置
在打开/关闭及账号或对象变化时退休旧流程；旧请求可以完成后端已接受的操作，但不能关闭
重开的弹窗、清空新草稿、启动旧绑定或投递旧错误。删除会话仅在请求开始时的路由仍为当前
路由时重置聊天。登录和初始化页面卸载后不再接收异步跳转或本地表单回写。

公式准入使用与消息渲染一致的 remark-math 语法；KaTeX 加载失败释放失败 Promise，允许
后续内容重试。消息卸载或内容变化退休旧加载结果，不发布到新内容。

## UI primitive 层

能力中心的 `workspace/capabilities/LarkPluginSettings.vue` 使用既有 SettingsSection
承载本地化 section 标题、说明与正文 main，再组合 Lark Card，与 React 导出组件的层级一致。
外层 DialogContent 持有滚动范围；省略 section 会改变内容高度与原生交互后的滚动位置。

`app/components/ui/` 是唯一的交互控件底座。Dialog、AlertDialog、Sheet、Popover、
DropdownMenu、Select、Tabs、Switch、Tooltip、HoverCard、ScrollArea 与 Command
建在 Reka UI 之上；Button、Suggestion（建议 chip 行，对位上游
`ai-elements/suggestion.tsx`）沿用本层样式合同，CodeEditor 建在 CodeMirror 6 之上。
`ui/resizable/` 是本层的横向分栏 primitive，通过原生 Pointer Events 与 pointer capture
拥有单个手势；没有 Splitpanes 依赖，不借 Reka 的全局拖拽注册表。

**上游 `ai-elements/*` 映射进这一层，不另开一个平行目录**——`components/markdown/*`
一直是这么来的，2026-09-16 补 `ui/suggestion/` 时沿用了同一条。产品组件不再直接 import
`reka-ui`——焦点陷阱、Escape、外点关闭、方向键与 aria 状态属于这一层，散在调用点
就会各写一份、各错一处。

交互底座锁定官方 `reka-ui@2.10.5`：Tooltip 的打开广播发送与监听都在 document，
独立 provider 之间仍只保留当前提示；保留真实触发器焦点，不用关闭 focus 入口规避残留。
该版本还包含 Menu 异步 focus 目标保存与 FocusScope 孤立焦点判断修复。
升级通过正常 pnpm lockfile 安装。正式锁定的 Tooltip ESM/CJS 源码修复为打开广播
附上现有 Root 的 open Ref 身份，只关闭其他实例的提示，避免退出动画/forceMount
期间的重新打开被自身广播关闭；不新增计时器、不移除退出动画。知识库选择通过公共
DialogTrigger 注册触发关系、原生 Enter/Space 激活及关闭后的焦点归还。

同一正式 pnpm 补丁还维护 FocusScope 的 src/ESM/CJS 孤立焦点恢复：原生浏览器
可能在按钮 disabled 后把焦点移到 body，而按钮仍连接；后续 loading 子节点删除
不能再仅依靠旧按钮是否离开容器判断。MutationObserver 只由仍 present、trapped、
未暂停且连接中的 scope 响应，并须曾拥有焦点、确有子节点移除且当前焦点为该容器
ownerDocument.body 才恢复容器。正常内部输入、重定向的外部目标、嵌套 scope、
关闭或非模态内容保持各自所有权。present=false 时退休本次可见生命周期的焦点历史；
重开时只认当前仍实际聚焦的内部候选或之后真实获得的焦点，不沿用上次打开的历史。
调用方取消首次或重开 autofocus 时不会凭空建立焦点历史；嵌套暂停与恢复保留当前生命周期。
这是本仓维护的依赖修复，不代表上游已批准。`tests/unit/ui/focus-scope-orphan.dom.test.ts`
挂载真实 FocusScope/Dialog，显式区分 Happy DOM 的失焦模拟与 Chromium 原生证据；
`tests/e2e-parity/disabled-control-focus.spec.ts` 使用原业务场景动作比较安装、安装失败、
技能下载和图标上传预览终态，并继续原生 Tab、Shift+Tab、Escape。

ResizablePanels 只消费 pane 约束、声明式 sizes、disabled、ownerKey 和键盘步长，
通过命名 slot 承载内容；不认识业务面板、会话、认证或持久化。`layout.ts` 负责百分比、
约束和 collapse 的纯计算。每次手势捕获当前 owner、初始布局和实际 pane 总宽（扣除
分隔条）；preview 立即 emit `resize`，有效 pointerup 应用最终坐标后至多 emit 一次
`resized`。取消、丢失 capture、窗口 blur、文档隐藏、禁用、声明布局/约束变化、owner
退休和卸载同步释放捕获并移除本实例临时监听，不发业务 commit，不保留全局 pointer
状态或 rAF。调用方同步退休/卸载时拒绝旧续体；实例互不干扰。

WorkspacePanels 在 L3 组合固定 main/side panes，拥有开关呈现、280ms `flex-grow`
过渡、固定 `cqw` 内容宽和 GripVertical 外观。主区下限 30%，侧区下限 20%、可折叠为 0%，
默认侧区 40%、有效上限 70%；原生键盘按当前 React 消费者使用 5 个百分点。
提交 owner 已有的 draft UUID 也作为呈现/手势退休标识，真实账号/会话切换会产生新 UUID，
同一次 flush 的 A→B→A 也退休旧内容；已准备 UUID 的路由 adoption 保持同一 owner。
移动端只切换右侧 Sheet，主区 pane 和输入消费者保持挂载。业务 open、session、权限与
草稿仍各由原 composable 持有；只有有效 release 的最终 0% 才同步业务 close。

DropdownMenu 的主内容与子内容共享 Tab 边界适配：React Radix 在两种 modal 模式下
都消费 Tab，Reka 只在 modal 模式消费。适配层只在事件所属的最近菜单内容节点消费
Tab/Shift+Tab；方向键、Escape、外部交互和焦点归还仍由 Reka 原生 owner 处理。

DialogContent 通过公开 `openAutoFocus` 事件实现与 React Radix 相同的首次进入策略：
先把同一可取消事件交给调用方；未取消时在实际 host 内选择第一个非链接可聚焦控件，
没有动作/输入时回到 host。链接仍保留原生 Tab 入口，不能通过修改 tabindex 排除。
文本输入保留进入时的文本选择；控件 focus 处理器已重定向焦点时不再抢回。
首次候选按 DOM 顺序保留同组的所有 radio，不改变 checked；仅顺序 Tab 边界才把
同 name、form、root 的原生 radio 组收敛为已选项，不能把该过滤提前用于首次进入。
只接管这一次默认进入，后续 Tab 边界与模态生命周期仍由现有 owner 负责。

DialogContent 的延迟焦点显露只属于当前物理 host 内、所属文档当前激活的控件。
实际存在纵向原生滚动范围时，键盘焦点使用标准 `scrollIntoView({ block: "center" })`；
未溢出的内容保留 `nearest`。每个 host 在实际挂载期间通过所属文档的 capture keydown
记录键盘意图，覆盖嵌套浮层关闭后从 body/guard 发出的首次 Tab；指针按下立即
退休待执行任务，避免在点击或输入光标落定前移动控件。焦点迁移、关闭和卸载退休旧帧；
嵌套 portal 不借 React/Vue 的逻辑祖先获得外层 host 的滚动权。调用方焦点回调先执行，
重定向后的真实当前控件继续拥有显露任务。Sheet 保持原生 nearest 显露，并使用同一物理
host、当前焦点、revision 和关闭/卸载退休条件；嵌套 portal 不触发外层重复滚动。

包含 iframe 或原生 radio 的 Dialog/Sheet 在实际 content host 内维护首尾焦点边界。
iframe 的 focusin 不会冒泡到父文档；同 name、form 和 root 的 radio 组只有选中项是
顺序 Tab 落点。边界接住原生 Tab 并进入本 host 第一/最后实际控件，保留原生方向键
选择，不截获调用方键盘事件。忽略透明边界、禁用和隐藏候选，尊重焦点重定向，
空内容回到 host。程序聚焦的负 tabindex 标题仅在实际首尾 DOM 边缘补全 Tab 入口，
普通中间节点不强制环绕。公共 ref 指向 Presence 内实际 Primitive，首次打开与重开都随
物理 content 挂载/卸载管理边界，不依赖缓存组件 `$el`。保留 as/asChild 的原 DOM 语义，
随 iframe/radio 增删维护并关闭/卸载清理。模态栈、嵌套暂停、
Escape、外部交互与焦点归还继续由 Reka 负责。

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

公共 TooltipProvider 默认延迟为 0，与 React 一致；调用方仍可显式指定延迟。
禁用 Agents 按钮保留常驻 `aria-describedby` 和唯一 Tab 入口，由可接收 hover 的
非 Tab 包裹层触发同一个右侧 Tooltip。React 合成 onFocus/onBlur 的后代冒泡在 Vue 中由原生
`focusin`/`focusout` 衔接公共受控 open；状态只属于该导航实例，feature 切换同步退休，
关闭、Escape、卸载及浮层布局继续使用既有 Tooltip primitive（M9）。

代码编辑器同样住在这一层。框架无关的部分是纯 TS：`app/core/code-editor/language.ts`
拥有唯一的语言归一表和语法包动态加载边界，`palette.ts` 声明 React 当前产物编辑器
实际消费的 basicLight/monokai 完整语法和正文、光标、选区、gutter 主题；保留上游
重复 tag 的覆盖顺序，只引用 CodeMirror/Lezer 类型，运行时 tags 由惰性 owner 传入。
`editor.ts` 在任意宿主 DOM 上创建 `EditorView` 并暴露
`setDocument/setLanguage/setTheme/setReadOnly/focus/destroy` 句柄。语言请求由该 owner
分配身份，只有最新请求可 reconfigure；销毁同时退役在途请求，不能让旧文件的
慢语法包覆盖新文件。语言、主题、只读切换不重建 view，保留选区和撤销历史。

原生 `@codemirror/{state,view,language,commands,search,autocomplete,lint}` 直接依赖
组合当前 React basicSetup 实际启用项及 Tab 缩进，不引入 React/UIW 适配包。
原生 search panel、补全、括号闭合、特殊字符、匹配选区和多选保持可用；没有
lintSource 就不产生额外诊断功能。line numbers、fold gutter、active line 与
active gutter 均按当前消费者关闭。正文使用 `--text-sm`、monospace、1.4 行高，
content 纵向 4px、行横向 8px 与 host 横向 8px；长行不折行，走原生横向滚动。
`CodeEditor.vue` 只做接线：v-model、只读、主题、可访问名字和销毁。初始化完成前
只读 Textarea 是唯一可见文本框；尚未 ready 的编辑宿主保持布局但 inert/aria-hidden，
ready 发布并完成 DOM 更新后才聚焦，旧 generation 不能接管新编辑器。
桌面 WorkspacePanels 的 aside 与 React 一样不拥有通用 Escape 关闭行为；
CodeMirror 搜索/补全及消息详情各自消费自己的 Escape。不能在父面板追加折叠监听，
否则搜索已 preventDefault 的同一次键盘事件仍会关闭整个产物面板。窄屏 Sheet
继续由模态 primitive 管理关闭。真实组合挂载与完整双端编辑器用例覆盖这一边界。
宿主挂载后才动态加载 `editor.ts`，首屏不加载 CodeMirror；该惰性 owner 内静态具名
导入语法包共享的 view/language/autocomplete 平台，state/highlight 与
commands/search/lint 保持独立动态加载，六种语法仍按语言单独加载。共享平台按
真实消费者分块，避免动态 namespace 保留多余出口；不自定义强制拆块或改桶名。
`nuxt.config.ts` 仅按真实模块来源把含 CodeMirror 的 chunk 命名为
`vendor-codemirror`，各组和整包预算在 `scripts/asset-budget.mjs`。

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
   `useThreads` 默认只取活跃会话；归档列表显式传 `archived: true`，引用选择器
   显式传 `archived: "all"`，复用同一分页 owner 读取所有可引用会话。三者按
   归档筛选分开缓存；引用不改变侧栏默认值，也不另存第二份分页状态。过滤 sidecar
   后的分页仍按服务端实际返回条数推进 offset，不能按可见行数推导。
5. custom 帧由 `tasks/custom-event.ts` 统一折叠 task 生命周期、步骤、累计 token、模型和
   `llm_retry`；`SubtaskCard.vue` 展开历史 run 时才回填持久化步骤。
6. `messages/processing.ts` 在每个 processing 组内一次性关联 tool result/browser frame，并投影
   React 可观察的步骤顺序、折叠边界和 trailing reasoning；`ProcessingMessageGroup.vue` 与
   `MessageList.vue` 只消费该视图模型，不再逐条渲染原始 ToolMessage。composer、产物/
   sidecar/browser 面板仍消费同一线程状态，扩展通过事件和 panel state 接入，不改变 L1 session 状态机。

`core/messages/utils.ts` 按 Markdown 的代码与块边界解析 inline reasoning；
解析结果由真实消息对象及其当前 content 缓存。分组只把实际答案文本当作正文，
非空 reasoning 与正文同到时直接呈现 assistant 气泡，tool call 到达再进入 processing。
当前 run 边界由可见人类输入或 ask_clarification 工具结果确定，隐藏回复续接不能
把已完成答案重新归进 processing。Vue 不引入 React SDK 的 streamMetadata 生命周期。

会话页头的标题和归档状态由当前路由的 `useThreadMetadata` 查询持有；标题仅在该查询
没有非空标题时消费当前 stream title，不能使用过滤了归档项的侧栏列表。导出直接消费
当前 stream values/messages，不从列表取缓存，也不补造 created_at。Agent 页的新建会话
按钮位于后台任务/子任务之后的动作组；普通会话的定时任务快捷入口不出现在 Agent 页。
归档恢复在标题组内，扩展动作在 Export 之后；图标随 rem 字号缩放。提及按钮继承
InputGroupButton 的标准 sm 内边距，其余工具各自保持 React 调用方的显式覆盖。
`tests/e2e-parity/chat-header-layout.spec.ts` 对两端活动/已归档会话验证真实导出、恢复和
桌面、窄屏、200% 字体下的控件几何；单位回归独立覆盖 stale sidebar 和 live title。

公开 Showcase 由 `useShowcaseThreadState` 在 mounted scope 内持有一份完整公开快照，
AgentChat 的 messages、artifacts、title、todos、goal、tool_artifacts 和导出都从它派生。
同步路由 watcher 清空整个快照并取消旧请求，晚返回不得发布，卸载取消仍在途的读取。
缺失/失败的公开数据保持空态，不回退工作区 metadata、stream 或本地未提交的 goal；
只有退出公开模式才切回工作区状态。公开数据新增 channel 不需要再增加独立复制的 ref。
实际 AgentChat 消费者测试覆盖边界接线，TodoList 测试挂载同一真实公开 owner，
两端公开路由浏览器用例覆盖目标/工具产物、刷新及只读行为。

Composer 的 tab 草稿由 `useComposerDraft.ts` 集中管理，key 是 user + agent/lead-agent +
真实 thread 或稳定 `new` 草稿 scope；新会话实际 run target 仍使用本次 runtime UUID。
技能目录 ready 后才恢复，后台 run `onStart` 前不清草稿。
引用目录和斜杠命令目录由 `core/mentions/popup-placement.ts` 计算 visual viewport
与当前裁切祖先的可见交集。引用目录读取实际 CSS margin；命令目录按 `mb-2` 的半 rem
间距限制高度，空间不足时进入原生滚动容器的正常流。打开期间的
ResizeObserver 观察 composer 和祖先，配合原生 scroll/resize 及 visualViewport 事件重算；
关闭或卸载时清理。字体放大和容器断点改变不依赖额外窗口 resize。欢迎建议在引用目录
打开时隐藏，与 React InputBox 的同一消费合同一致。
引用目录高亮由原生方向键或有实际位移的 mouse/pen pointermove 驱动；滚动/重排
在静止指针下产生的进入事件不夺走键盘高亮。触摸滚动不改变高亮，实际选择仍由
既有 choose/引用 owner 管理，不能把 active 高亮当作 selected 引用。
textarea 的折叠光标移动通过原生 `selectionchange` 更新同一个引用 owner；
`select` 仅覆盖非空选择，不能代替光标事件。按钮打开、busy 和 Escape 的原有生命周期继续生效。

现代技能选择只由 inline references 持有；ChatComposer 不再保留旧 selectedSkill 状态。旧 tab 草稿中
仍启用的 skill 恢复成唯一 inline token，禁用/缺失技能保留可编辑的字面文本；历史消息只读
SlashSkillChip 继续保留。公开 draft/submission helper 的 legacy skillName 是可选兼容端口。
`useComposerSubmission.ts` 独占 compact、goal 与上传/提交事务，统一 epoch、AbortController、
重试 human ID、上传 descriptor 缓存及 accepted 退休；事务身份只含 user + 实际 target thread +
agent，相同 target 的 new→真实 URL 草稿 adoption 不取消已接受 run；UI/voice/polish 仍使用含
threadKey 的独立 composer scope。组件仅转交 submit 和处理 placeholder
选择/焦点。草稿/引用仍由 draft/references owner 持有，事务只消费快照并按接受结果清理。
本地 `File` 与已上传 descriptor 留在 owner 内存中，失败保留文本、引用与附件供再次提交。
上传期间由提交 owner 投影临时 human/上传任务消息；上传结束即退休上传状态，真实 human
以稳定 ID 接管，路由或账户切换拒绝旧上传结果。提交失败复用 Composer 的错误通知。
每次事务在任何 await 前捕获 context/model 与 AgentChat 提供的 quote/knowledge 快照；
后者经 `captureComposerSubmission` 提供附加 input、human kwargs 和仅退休捕获引用的回调。
`ComposerSubmitOptions.runSnapshot` 经 AgentChat 的 useChatConversationActions.send 进入
useThreadStream 的 buildRunContext，
确保上传中切换模型或知识范围只影响下一次提交；普通 send/replay 没有快照时仍消费实时状态。
知识范围只进入 human metadata，不进入 run context；A→B→A 的旧 accepted 不能清除新 A 草稿。
AgentChat 将同一提交 owner 的 `localUploading` 纳入既有 disabled 投影，知识范围控件共用该锁；
其他 tab 的模型 storage 更新仍可显示，但不能解除当前上传锁或改写已捕获的 run 快照。
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

AgentChat 保留路由、Agent/project 输入、创建与通知接线；`useChatConversationActions` 独占
发送/引用与知识快照、分支 pending、post-run suggestions 及其取消、generation 和新会话事件。
命令仍委托既有 useChatThreadOwner/useThreadStream；不持有第二份 session/run。分支 single-flight，
旧 owner 的结果不能 upsert、导航或通知，也不能释放新 owner 的 pending。相同已开始线程的
new→真实 URL adoption 保持同一事务，真实线程/账号/Agent 切换同步退休旧操作。
当前会话删除由 `ThreadDeleteDialog` 在 `router.replace` 完成、Vue route owner 已更新后
发出既有 `deerflow:new-chat` 命令。可选的 `NewChatFocusHandoff` 只允许匹配 Agent 的
交互主会话在 `/new` 领取：它复用 submission owner 退休规则，通过 ChatComposer
公开 ref 清理删除草稿并提供一次性 focus 操作。Dialog 的 close-auto-focus 生命周期
阻止恢复已删除行，只在未被新控件取得焦点时完成交接。等待 router.replace 期间只放行
本次预期的单次 route 提交，其余 route 变化持续退休旧操作；取消/中止的 NavigationFailure
不能完成交接，只有原本就在目标 `/new` 的 duplicated 结果允许同路由重置。失败仅恢复 Cancel；后台删除
不重置主会话。稳定页面/composer 不为焦点重挂载，新 UUID adoption 仍保留原 owner。
`useChatPanels` 组合现有 artifacts/sidecar/details owner，只拥有面板互斥、浏览器 presentation、
force restore pending 及自动选择 timer；dirty 离开仍由既有 artifact draft owner 决定。
`WorkspacePanels` 单独拥有展示生命周期：桌面开关时只对库自己的 pane 启用 280ms
宽度过渡，内容按最终 `cqw` 宽度固定并由外层裁剪；普通 resize 不开启过渡。
关闭立即提交 aria-hidden/inert、撤销业务 active 并在 DOM post-flush 返回主区焦点，
详情 owner 的显式 origin 返回仍优先；没有延迟 desktop close focus 续体。
退出中的 rendered kind、padding 与 label 保留到原关闭的 280ms 截止时间，尺寸/断点
阶段不会重置退出时钟。重开取消旧退出，线程/账号/Agent 退休立即取消旧展示，
卸载清理两类截止任务。AgentChat 只消费 scoped rendered identity 决定展示组件，
`active`、readonly、session、references 和 dirty 离开准入仍来自现有业务 owner，
布局不缓存详情、线程或草稿数据。呈现身份复用提交 owner 的 `draftThreadId` 退休标识：
真实线程、账号或 Agent 更换会同步生成新标识；采用已准备的 UUID 时保持不变。
因此同一 Vue flush 中的 A→B→A 也不能复活旧面板实例。详情 scope 同时包含现有身份
owner 与逻辑会话，以同步 watcher 退休旧选择和 origin；新建 UUID adoption 不改变
同一逻辑会话，真正换 owner 清空旧详情并拒绝晚 focus。

MessageList 直接消费持久化消息：现代/legacy 附件、隐藏 HIL 回复、
citation 和 per-turn usage 都不依赖提交前 UI 状态。processing 只走一份步骤投影；终态 reasoning
流式时展开、settle 后只自动收起一次，尚无终态 assistant 时显示 live run activity。
当前 run 的 assistant 消息归属由框架无关的 ThreadRunner 拥有：仅从实际 messages 帧
归一化后的 assistant action ID 建立不可变集合，不从最后一行、历史 values 或 SDK metadata
猜测。transport reconnect 保留同一 run 的集合；完成、失败、取消、reset、dispose 和新 run
退休旧集合。useThreadStream 发布可见会话的只读投影，AgentChat 与 SidecarPanel 都显式传给
MessageList；实际组归属同时决定复制按钮、复制内容、分支与技能动作。等待首包或隐藏控制消息
不能禁掉历史回答复制，正在生成的回答到 settle 才开放复制。消息模块仅保留实际消费者使用的
纯分组、当前组判定和 per-turn usage 推导，不维护第二套未接线的增量缓存或 SDK metadata 适配。
`useMessageTurnActions` 独占人类消息编辑事务、复制反馈及计时器；MessageList 只接线并在正文
位置渲染编辑器，附件/引用与知识摘要保留在同一消息栈。AgentChat 经 useChatConversationActions
提供 editAndRegenerateMessage 请求端口，并在请求前捕获
线程/账号/Agent owner 与知识范围 snapshot；false/失败保留草稿，成功才关闭。线程或 owner
变更退休旧编辑状态，晚回包不能清除新草稿；pending 时只读，取消/更新及其他 replay 动作禁用。
复制的异步结果和反馈计时器同样归发起时的会话/身份；切换或卸载后不能向新消息回写。
`useMessageSelection` 独占浏览器选区、工具条测量/ResizeObserver 和全局监听，切换会话/身份
退休旧引用，nextTick 后的定位仍核对当前选区；卸载清理全部监听与 observer。
`useMessageHumanInput` 独占 HIL pending 与提交 token：响应确认、流结束、新线程错误或
会话/身份退休清理对应事务。晚拒绝不能解除新身份同 request id 的 pending 或播报旧错误。
分页错误由 useThreadHistory 的 onError 端口经 useThreadStream.notify.error 发出与 React 相同
的 toast，query.error 仍保留完整错误。失败不替换分页按钮或丢失已加载行，正常 Load more
按钮按相同游标重试；分页禁用/取消仍由同一个 Vue Query 查询生命周期管理。
`AssistantTurnActions.vue` 独占 assistant 尾部按钮的共享 Button 规格，`MessageList.vue` 只决定
哪些动作可用并拥有滚动 gutter、内容 padding 和组间 gap；尾部空间由内容 wrapper 的 padding
持有，等价于 React 的 `gap-8` + `pb-4` + `paddingBottom`：前两项跟随共享 spacing token，
固定尾高默认24px，Sidecar显式传12px。不能将默认字号下的总量72px固化，文字放大时仍须缩放。
每组的耗时与正文由 `flex-col gap-2` 包装；workspace-change卡片属于 assistant正文的同一
flex栈，只由当前回合的streaming状态禁用，历史完成回合仍可操作。调度事件保持在组包装外。

VirtualMessageList 的 div 容器高度与定位行承担长历史窗口偏移，不插入伪装的消息列表项。
VirtualMessageList 是唯一物理滚动 owner，持有虚拟测量、阅读/分页锚点、目录定位、内容
ResizeObserver 与追尾 rAF；短列表 prepend 和跨虚拟阈值的补偿也在此完成。MessageList
仅传递 following/active 意图、发起分页和动作；独立请求 token 合并重复加载，并拒绝旧线程
完成后释放新线程的 pending。线程/会话 owner 变更与 unmount 退休锚点、observer 和动画。
按钮命中区、横向起点和消息尾部留白都能从结构推导，而不由调用页添加位置偏移。
聊天宿主使用命名 `chat-pane` 容器；内容列小于 `48rem` 时，header 进入既有 main 的普通
flow，同一原生外层 pan 可以把 header 与过高 composer 滚出窗口。此时取消仅服务 absolute
header 的消息顶部预留，保留 save hint 的真实间距；消息 flex item 使用自动内容最小高度，
并以 `100dvh` 限制最大高度，内层物理 scrollport 和虚拟化仍保持有界。容器断点随根字号
缩放，也覆盖宽视口内的窄分栏，不靠视口宽度推断实际可用列。
composer 底部装饰与宿主 `pb-4` 使用同一 spacing token，不能超出真实预留区域，
导致原生 pan 多滚一像素并使主聊天与侧聊的聚焦输入框错位。
模型 Popover 从 Reka 的公开 triggerElement 取得真实锚点；挂载期间持续由 primitive
更新定位，resize 引入新滚动祖先时也必须及时跟随。菜单与锚点同时离开可见交集时，
仅通过已有原生 scroll owner 显露真实锚点，保留键盘焦点，不写 portal 坐标。
AgentChat 提供物理 main 的 focus-reveal owner；模型 Popover 保留 Vue injection 祖先，
通过真实 triggerElement 声明所属 main，再把 Teleport 内 focus 交给同一显露路径。
只能声明实际包含该 trigger 的 host；帧执行前复核所属文档当前焦点、连接、host 和 revision，
关闭/焦点离开/卸载退休旧帧，不能把任意 portal 当作聊天后代。
引用 picker 在上下两侧均不足以容纳实际最大交互行时进入 composer 普通流，以当前
可见裁切交集限制 scrollport；ResizeObserver 同时观察正文、composer 和祖先，关闭时
退休 observer、监听与待执行帧。`tests/e2e-parity/popup-capacity-reflow.spec.ts` 保留完整
候选、上传命令与原生 Arrow/wheel 操作。
消息内 focusin 表示阅读意图，经既有 VirtualMessageList owner 停止追尾；历史 prepend、
远端消息或 assistant append 不恢复追尾，显式 send/regenerate 的 tailRequest 才恢复。
延后到 rAF 的焦点显露必须仍连接且是所属文档的当前焦点；外层 pan 活跃时采用原生 center，
其余布局保留 nearest。composer 的现有层叠宿主只跟随 textarea/contenteditable 上实际
生效的 aria-controls 关系进入浮层层级，关闭后回到原层级，避免 command/reference 被
welcome header 遮住。命令列表为定位测量保留隐藏 DOM 时，不得继续抬高宿主层级。
Skill 详情标题与动作使用可换行的独立 flex 分组，负 tabindex 标题仍有真实可见宽度。
产物的 body wrapper 和内部 preview 各自保留 flex/min-height 边界；移动 Sheet 中产物 root
保留内容最小高度，由 Sheet 原生 pan 承接完整长链接/表格控件，桌面仍受 host 约束。
项目说明页的字数与保存动作允许换行，设置操作按钮保留全文和原最小高度。
通知将焦点交还实际入口时允许原生显露；既有通知 owner 继续负责关闭、寿命与快捷键。
工具详情面板与 payload Copy 按钮根据各自命名 container 的可用宽度调整内边距；
窄列和放大字体不能把保留完整文案的按钮挤得高于原生 scrollport。
`tests/e2e-parity/chat-state-resize.spec.ts` 同时验证两个 resize 方向、真实键盘聚焦后的
完整可见性与已展开 payload 的内容保留。
生产 CSS 编译保留浏览器的精确 `calc()` 运算：`nuxt.config.ts` 仅关闭 cssnano 的
calc 预计算，避免把 Tailwind 的 `2 / 1.5` 提前舍入而改变真实行高，其余压缩保留。
共享 Markdown 原生测试严格比较两端对应阶段；processing 文本继承 step 的
14px/20px muted 样式，完成后转为正文的 16px/24px，不把合法状态转场混作样式漂移。

`MessageMarkdown.vue` 是消息、reasoning 与 processing 文本的唯一产品入口，异步加载
`MessageMarkdownContent.vue`，后者集中提供安全预处理、GFM/math/streaming 插件和
Streamdown 等价组件。默认 richContentComponents map 也只在这个异步边界内合并，调用方
components 的同名 override 优先；MessageList 仅传业务链接和图片适配器。空会话不引入
Markdown 管线及默认 table/pre 组件，调用点也不自行拼装插件。
`core/markdown/render.ts` 在 JSX 边界将组件 children 交为函数 slot；原生元素与 Fragment
保留自己的 children 形式。不要通过抑制 Vue 警告或重新挂载绕开 slot 协议，逐词 key
仍由绝对字符偏移持有。终态 human/assistant 组中的孤立 tool 正文沿用同一个 Markdown
入口；混合 task 调用的普通工具呈现仍由 processing owner 持有，不重复绘制 raw args。

`MarkdownTable` 持有普通/全屏两个实际 table，`MarkdownTableMenu` 各自持有菜单与复制反馈。
`core/markdown/table.ts` 只处理真实单元格数据、Markdown/CSV/TSV和剪贴板/下载载荷，
不读取消息或后端。全屏使用既有 Dialog primitive 的模态生命周期，显式覆盖普通弹窗的
最大高度和所有断点内边距；表格滚动区和工具栏分别持有间距。保留实际菜单按钮 Tab 顺序，
拒绝的复制仍可重试。共享 `markdown-table-actions/presentation` 原生规格核对三种视口、
root16/root32、HTML载荷、下载字节、独立表格和关闭重开。

引用来源的每行复制反馈属于该行组件；重复成功重置期限，卸载退休 timer 和未完成请求的
呈现续体，不能向后续页面发送旧通知。`ConversationEmptyState` 使用安全居中和原生纵滚，
图标与正文保留自然高度，使低容量侧聊能滚到完整说明。Lucide 尺寸按 React 对应的 rem
样式 token 对齐，父级控制尺寸和原固定 SVG 不进行机械替换。

`core/streamdown/fences.ts` 是无依赖的围栏判定叶子模块，由消息渲染预处理、
会话导出清理和 Mermaid 预处理共同消费。关闭围栏必须同字符、长度不少于开头，
且不带语言等信息字符串；较短或不同字符的行保留在代码块内。
导出清理整个后端内部上下文块（包括带属性的 project/documents），渲染只移除
泄漏的标签而保留正文；两者均保护围栏与缩进代码，不能用一个替换函数混淆语义。
`MessageMarkdownContent` 通过 `useSmoothStreamingContent` 单独拥有显示前缀和一个 reveal
timer，完整消息仍由原 stream owner 持有；追加更新保留节奏，替换、完成、reduced motion
与卸载退休 timer。loading 或 revealing 时由消息专属 `StreamingPre`/`StreamingCode`
展示轻量代码，调用方 pre/code 组件按 nullish override 优先。settled 后继续使用原
`MarkdownPre`/CodeBlock 的主题与操作；通用 `StreamMarkdown` 不拥有渐进显示或消息状态，
原有稳定 word key 与零 stagger 保留。KaTeX 的局部排版修整与 React 同处 base layer，
保持按需加载的 unlayered KaTeX 样式优先级。
bash 工具命令由 ProcessingToolStep 消费 `ui/code-block/CodeBlock.vue`，与 React AI-elements
代码展示同契约：默认无行号、无 Markdown 语言/复制下载栏、pre-wrap 与 one-light/one-dark-pro；
暗色 token 规则只作用于该组件的 scoped deep 边界，与 React html.dark 下的 --shiki-dark 行为一致。
`core/markdown/highlight-code.ts` 按需加载 Shiki，使用有界缓存。watch cleanup 退休旧 code/language
请求与卸载后的结果，失败保留原命令回退。settled Markdown fenced code 仍消费自己的 Streamdown
CodeBlock，不能为 bash 更改其 DOM/工具栏/主题合同。
MarkdownPre 的显式局部名称为 MarkdownCodeBlock：Nuxt 的组件 loader 会将
`h(已注册名称)` 改写成 shadcn 注册组件，即使同名变量已有局部 import。两个代码展示
组件因此不能共用 `h(CodeBlock)` 名称；历史消息浏览器回归同时守住 Mermaid 图、Markdown
工具栏、行号与双主题 token，纯 Vue DOM 测试不经过该 Nuxt 编译步骤。
SettingsDialog 与 ManagedModelEditor 在桌面保留有界的内容滚动区；低于设置双列断点时，
导航、面板和表单使用自然高度，改由限高的 dialog 本身承载原生滚动。标题、导航和底部
操作不能把正文 scrollport 压得低于一个完整字段/按钮；不能靠裁切、缩字或滚动坐标补偿。
SettingsDialog 使用自身的 size container 限制窄屏正文 viewport 的最大高度，避免自然高度
大于外层 dialog 可见区域而使该可聚焦滚动区无法完整进入视口；高度从容器的 `100cqh` 推导。
`tests/e2e-parity/settings-capacity-reflow.spec.ts` 用真实 wheel、键盘重入和完整交集量具守住该合同。
设置 dialog 自身高度不足 28rem 时也使用同一自然高度内容与外层滚动路径，
不依赖屏幕宽度；不能在两列布局中强加两条等分行，把正文 scrollport 压到完整主题卡以下。
项目详情的 size container 则为低高度下可聚焦的 tabpanel 提供 `100cqh` 减去既有 `pt-8`/`pb-6` 的容量上限与原生滚动，
保留 Tab 进入面板、PageDown 阅读内容和外层页面的原有滚动路径。
`tests/e2e-parity/settings-project-capacity.spec.ts` 验证这两种实际容量 owner。
MCP JSON/icon 编辑器正文保持自然高度，由已有整个 dialog 的原生滚动容纳完整字段和操作；
固定标题与底部动作不能把正文压成不足一个控件的 scrollport。JSON textarea 保留桌面
`h-96`（根字号 16px 时为 384px）及原生文本滚动；border-box 高度上限从 dialog 既有
外边距 2rem、两侧 `p-4` / `sm:p-6` padding 和两条 1px border 推导为
`100dvh - 4rem - 2px` / `sm:100dvh - 5rem - 2px`。`min-h-0` 防止旧最小高度在
低窗高、放大字体时覆盖该上限。重排不重建 textarea、不丢完整草稿，并保留整个 dialog
和 textarea 各自的原生滚动；`tests/e2e-parity/capability-controls-reflow.spec.ts` 的 MCP
用例保留原 strict survey，另验低高度、放大字体、原生编辑及桌面高度恢复。
侧栏正文最低容量复用现有
菜单行的 `h-8`；剩余空间不足时由物理侧栏父容器滚动，桌面未溢出时不新增键盘停点。
Workspace changes 的 Sheet 自身高度低于 28rem 时，正文进入自然流并由整个 Sheet 滚动，
普通桌面保留原来的内层滚动区。项目 instructions 在低高度下将 label 与 textarea 作为
自然两行 grid，使用同一 page size container 减去既有上下间距提供组容量；label 保留自然
高度，textarea 使用剩余行。桌面 `min-h-40`、完整 value 和原生文本滚动保留，底部操作
与错误仍在原生 panel owner 内的普通流中。
ArtifactPanel 在已有标题的 28rem 容器回流边界内，正文 flex item 使用自然内容下限和
viewport 上限，保留预览自身的原生滚动与外层整个面板的后备滚动路径；标题不能把完整
链接挤进更小的唯一 scrollport。链接内容、样式、Query/draft owner 与窗口 oversized
原规则保持不变；`tests/e2e-parity/artifact-preview-capacity-reflow.spec.ts` 验证双端真实路径。
产物面板根始终保持宿主提供的有界高度；不能在低高度窗口将它改为自然高度，
否则长报告会撑开整个面板并被固定父容器裁切，原生滚动也随之失去容量。
`tests/e2e-parity/artifact-panel-capacity.spec.ts` 专门验证这一低高度回归。
SettingsDialog 的八个设置面板分别异步加载，未打开的面板不加载其数据或渲染依赖；
每个异步面板使用 `suspensible: false` 与独立 SettingsPageLoading，保证 Nuxt 外层
Suspense 下仍显示当前面板的加载状态；
三个重量级渲染器都按内容加载，不进关键路径：代码高亮（shiki）由 `CodeBlock.vue` 触发，
图表（mermaid）由 `MermaidDiagram.vue` 触发，公式排版（KaTeX，约 264 KB raw）由
`core/markdown/math.ts` 的 `containsMath` 判定后动态 import。判据宁可多报不可漏报——
多报只是白下一次，漏报是公式永远渲染不出来且不报错。
Mermaid 的 SVG/PNG 导出由 `core/markdown/mermaid-export.ts` 将惰性 DOM 序列化为
XML，保留 foreignObject 的 HTML 命名空间、换行、实体和中文；不能直接把 HTML
序列化片段交给 SVG 图片解码器。下载组件按源码与组件生命周期持有 AbortController，
源码切换和卸载退休旧渲染及转码结果；Image 回调和 abort 监听随 owner 清理，旧任务
不能触发文件下载。共享原生 `mermaid-image-export.spec.ts` 验证两端真实下载和 5 倍 PNG
尺寸，不依赖 React 源文件，从而保留 Vue 独立工程的收集能力。
第四个是 artifacts 面板：`AgentChat.vue` 用 `defineAsyncComponent` 引入 `ArtifactPanel`。
它本来就在 `v-if` 后面，但静态 import 会把 `ArtifactPreview` → `rawHtmlRehypePlugins`
→ `rehype-raw` → **parse5** 整棵树放进聊天首屏，而消息路径从不渲染 raw HTML
（见 `core/markdown/plugins.ts` 文件头：DeerFlow 整条替换了 Streamdown 默认链，
raw HTML 由 `remarkHtmlToText` 降级成转义文本）。parse5 一个包就占 `vendor-markdown`
源码体积的 24.8%。
`thread.values.todos` 与最终 token usage 仍由 thread snapshot/API 提供。Gateway 的 feedback
数据字段继续保留，但当前 React 消息调用点没有启用该入口，因此 Vue 不显示点赞/踩，也不建立
只由 Vue 触发的 feedback mutation。
Token 调试归属由 MessageList 对完整 wire 消息一次计算，再按真实 AI message id 投影到组；
per_turn 仍由 deriveAssistantTurnUsageState 聚合整轮并只在末组呈现。ProcessingMessageGroup
将独立工具用量放在工具标签、纯 thinking 用量放在推理标签，共享或文本归属只在该消息第一个
合格步骤呈现 ProcessingTokenSummary。折叠步骤不提前泄露摘要，subagent reasoning 消费自己的
processing 组，末尾卡排除这些消息；普通卡继续遵循 React 的全局 loading 隐藏行为。
MessageTokenUsage 接收已投影的 tokenDebugSteps；独立消费者省略该 prop 时才按 messages 计算，
显式空数组保持空，不退回整轮消息。无真实 message id 的 debug 步骤不挂到组，整轮总量仍计入。

follow-up 配置是 Vue Query 持有的服务端状态，由 `useSuggestionsConfig.ts` 独占缓存和重取；run 完成
时若配置尚未返回，先等待同一 query，再决定是否请求 suggestions，组件不维护第二份布尔配置。
公开案例的 messages/artifacts/title/todos 由同一个 route watcher 发布；切换案例同步清空，
旧请求和卸载后的响应不得回写。已附加文件并物化 UUID 的空线程退出 welcome；普通聊天
header 的项目链接只消费当前线程 metadata 和 `useProject`，项目缺失或查询失败时不显示。
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

1. `useChatPanels.ts` 从 AgentChat 传入的**当前主线程**消息中提取最新 ToolMessage
   `additional_kwargs.browser_view`，持有静态 `BrowserViewFrame` 与面板开关。截图变化可自动
   打开；它另外记录已经观察过的消息帧，避免消息列表刷新时用旧截图覆盖新 REST 结果。
   route 或账号/Agent owner 变化同步清空，feature 禁用关闭；transport 仍由当前 BrowserPanel
   实例管理，不把旧 frame 或迟到的面板恢复交给新 owner。
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
  banner 复用该缓存做后台/手动恢复；需要认证的路由守卫在首次 await 前捕获 QueryClient。
  真实用户身份优先于 auth-disabled 合成身份，权限缺失/null 与显式空数组分别遵循兼容允许与拒绝。
  401 才进入登录，Gateway unavailable 保留当前工作区
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
- `/workspace/chats` 的列表和 `VirtualThreadList` 仍观察原 ScrollArea viewport。
  页容器实际高度低于 28rem 时，外层页原生滚动可让面包屑、页签和搜索退离窗口，
  内层列表保留有界的 `100dvh` 视口；仅此断点将 `py-4` 移入可滚动内容，桌面几何不变。
  `VirtualThreadList` 观察该 viewport 及其直接内容的 resize，更新同一物理 owner 的
  scrollMargin；阈值切换、owner 退休和卸载都清理旧 observer，不写入第二套 scrollTop。
- 当前流、乐观消息、prepared replay 掩码、task/retry 状态：thread composable 的
  thread-scoped ref；切换 thread、stop、error、finish 或 scope dispose 时按合同收敛。
- **本工作区没有客户端 store。** 服务端真相一律由 TanStack Query 持有，跨页面的
  纯 UI 状态由 composable + `provide/inject` 持有。Pinia 曾经注册着但一个
  `defineStore` 都没有，只往生产包里塞了一个空插件，已经移除；再引入客户端 store
  之前先确认它保存的不是服务端真相的副本。
- artifacts、sidecar、browser：各自 composable/集成根持有面板状态，但最终业务数据仍来自同一
  thread snapshot/API。artifacts 由 `useArtifactsPanel` 持有 open/selection UI 状态，
  `useChatPanels` 只投影当前 processing 组的最后工具：普通 write/replace 需仍在 loading 且无返回，
  finalize 需实际成功文本。自动选择等待 100ms，目标、选择资格、线程或 mounted owner 变化时
  退休旧 timer；短请求可以保持面板关闭，实际工具点击始终提供手动入口。
  `useArtifactDraft` 独占 baseline/remote/draft/dirty/conflict/edit 生命周期；切文件、关面板、
  切右侧产品、切线程、路由离开和 `beforeunload` 都必须先经过该 owner。文件能力只由
  `app/core/artifacts/policy.ts` 的显式扩展名/source allowlist 决定，未知、Office、archive、
  SVG、无扩展名和其他二进制 fail closed；MIME 不提升能力。`ArtifactPanel` 只编排当前路径的
  save/action 的 abort/generation 与 I/O，FileList、Editor、Preview、Actions 不复制状态。
  正式文本读取由 `useArtifactFileContent` 的实际 TanStack Query 持有，与独立 viewer 共用
  `artifactKeys.content` 的 path/thread/mock/full 五段 key 和 plain loader 结果；stale0、
  visibility 恢复、传输重试及最后 observer 取消沿统一 Query 生命周期。流式 write-file
  仍只投影消息，不发 GET；保存先取消当前 key 的旧读，再写当前 preview/full 缓存，远端
  刷新经 draft owner 对账，不能覆盖 dirty 草稿。`ArtifactEditor`
  把 policy 语言与当前 resolved theme 交给 L2 编辑器，并把 `Mod-S` 转回同一条
  revision 保存路径；它不持有第二个保存入口。sidecar 进一步拆成 `useSidecar` 的开关/引用状态与
  `useSidecarSession` 的唯一会话状态；后者独占 restore-before-create、run、附件上传缓存、
  HIL 与真实删除，`SidecarPanel` 只做 UI 适配。隐藏或切换右侧面板不销毁 session，切换主
  thread、账号/Agent owner 或 scope dispose 使旧异步结果失效。两个既有 sidecar owner
  接受可选 ownerKey：引用同步清理，session 原 lifecycle dispose 取消旧 restore；内存草稿
  以 ownerKey + parent thread 区分。同一 draft thread 的真实 URL adoption 不改变该 parent，
  因此保持已有引用和会话。账户更换仍沿 workspace preferences boundary 先退休旧宿主、
  完成共享查询清理后挂新宿主，不能靠 Nuxt 页面默认卸载假设保证隔离。
- browser 的静态 frame/open 归 `useChatPanels`，transport 归 per-panel controller，REST 归
  `BrowserPanel` 的 Vue Query mutation；三者不得互相复制。Gateway `url`/`tabs` 事件与 REST
  响应是 URL/title 真相，live/static 只是客户端展示状态。
- scheduled tasks 的服务端真相只归 `useScheduledTasks` 的 TanStack Query key tree：全局列表、
  thread 列表、detail 与分页 runs 使用不同 key，mutation 通过 `query-keys.ts` 集中声明精确
  invalidation/remove 目标。页面只拥有 route 默认值、筛选和当前 selection；selection 在过滤或
  删除后按当前任务列表收敛。`form-state.ts` 独占新建/编辑/复制的初始状态、校验与
  create/PATCH payload；`cron.ts` 处理时区、DST 与秒精度，`schedule.ts`/`recipes.ts`
  提供排程值和预设，组件不得另拼 wire body。`useScheduledTaskRunHistory` 按 task/page
  key 请求 51 条、显示 50 条，不累加旧页；仅 page 0 自动刷新，切 task 同步重置 page，
  AbortSignal 随请求传递，旧 task/page 请求不能写入新 key。
  `scripts/gen-contract-constants.mjs` 从仓库根 `contracts/` 生成调度契约常量；
  `goal-outcome.ts`、`run-error.ts`、`messages.ts` 直接消费 host note、检查失败分类和
  scheduled origin key。goal reason、lifecycle event/reason 与 UI error 的文案映射使用
  生成类型和 `satisfies` 完整覆盖；新增契约词汇必须先决定其展示语义，不能靠宽泛
  `Record<string, ...>` 静默通过。未知服务端错误仍保留原始 Details，未知生命周期事件
  不渲染、未知 finished reason 仍使用已有通用文案。生成器变异回归在隔离契约副本内
  运行真实 generator，并验证实际消费者行为和 TypeScript 缺失映射诊断。
- channels 的服务端真相只归 `useChannelConnections`：providers key 只保存能力、配置与
  connectable，connections key 按认证 user scope 保存全部账号 instance，并独占展示状态。
  connect/configure/单 connection DELETE/provider runtime DELETE 后重读两端；connect poll 只
  更新原 scope 的 connections key，发起绑定前已 connected 的 ID 不得完成新账号绑定。
  generation、AbortSignal、effect scope dispose 共同阻止旧 query/poll/mutation 跨用户回写。
  组件与 provider.connection_status 均不得建立第二份用户连接真相。
- Workspace 的 QueryClient 与 React provider 使用相同的传输错误重试策略，并沿用
  TanStack 的 stale-on-focus 默认值。各 query owner 保留领域例外：models 不跟随焦点且
  无限新鲜，Unauthorized 不重试，其余错误最多一次；session 由 boundary 的 60 秒可见性
  节流独占刷新；thread lists/history/metadata/active run/token usage、extensions 与
  workspace changes 各自保留显式焦点策略。skills 与 workspace changes 共享五分钟新鲜窗，
  feature discovery 禁止自动重试，scheduled form 的 Agent list 单独禁止自动重试。
- `/workspace/agents` 整棵路由的能力门禁只归 `app/pages/workspace/agents.vue`。
  该 Nuxt 父页面在首次查询 pending 时只显示居中通用 loading，disabled 时只显示
  `AgentsFeatureDisabled`，ready 且允许时才挂载 `NuxtPage`；目录、新建、Agent chat
  的 setup、焦点与业务 I/O 不能提前运行。能力撤销会卸载业务子树及其 portal 对话框，
  再允许时重新建立局部状态；离开该路由分支再返回由父页面现有 query 重新检查。
  目录页不再另建 feature observer，models 仍只在实际编辑时查询。共享 query 保留
  stale-on-mount、无自动重试和冷启动 last-known/failed-query fallback；不按请求数量
  添加额外 GET 或更改缓存时效。`tests/unit/agents/agents-route-gate.dom.test.ts` 验证
  挂载、撤销、abort 与回退；`tests/e2e-parity/agents-route-gate.spec.ts` 在两个实际应用
  的路由树上验证直达、移动端关闭侧栏、配置弹窗与浏览器返回。
- agents/models 的服务端真相归 `useAgents` / `useChatAgent` 与 `useModels` 的 TanStack
  Query key。AgentChat 通过 useChatAgent 实际订阅 `agentKeys.detail(name)`，settings update
  与 import 的同 key 写入立即进入会话名称、模型继承与知识范围；普通详情沿 React 的
  stale-on-focus 行为重读，后台刷新失败保留已解析内容。bootstrap 的 disabled observer
  只消费 creation owner 验证后的缓存发布，不自行 GET 或在 focus/invalidation 时补读；
  AgentChat 不再另写 agent/resolved 镜像。账户边界同步退休旧详情，Query 的订阅、
  AbortSignal 与 workspace generation 阻止旧请求跨 owner 回写，最后一个 observer 卸载
  才取消共享请求。`agents/settings.ts` 独占 capability-aware exact PUT body；
  `agents/presentation.ts` 统一非空 display_name → name → 路由名，并独占 card 的
  model/skills/tool-groups 映射。API/路由身份仍使用 name，`tool_groups` 的
  null/empty/ordered values 不在模板中重新解释。
- Memory 服务端真相只归 `useMemory` 的单一 TanStack Query key；fact create/PATCH/delete、
  clear/import 成功后由该 owner 写入或重读同一缓存，组件不保留第二份 response。导入解析与
  storage-valid fact 检查只归 `memory/schema.ts` 纯函数：完整 export 结构才进入 preview，重复
  fact ID 拒绝，forward extra 与不同 ID 的重复 content 保留并警告。搜索、confidence 筛选和
  PATCH diff 只归 `memory/view-model.ts`，显式 `0` 不得被 truthy 判断丢失。
- Settings 权限只从共享 `useAuthSession` 与 Gateway auth-disabled 语义经
  `useSettingsPermissions` 派生。`useSkillSettings` 复用 catalog 的 skills query key，允许普通
  authenticated user 读取但只允许 admin mutation；`useScopedMCPConfig` 按 scope 与 user ID
  持有 MCP config，personal scope 允许登录用户管理，deployment scope 仅允许 admin 读取与
  mutation。两类 mutation 均不 optimistic，并在成功后 authoritative re-read；401、
  403/admin-required 与通用请求失败保持不同状态。
- Workspace shell 的 command palette、settings host 与 toast store 只在
  `app/layouts/workspace.vue` 各挂载一次。Toast store 独占剩余寿命计时；viewport 只转发
  hover/pointer、Alt+T 展开和 document hidden 的暂停状态。普通 Tab 离开不抢回焦点；
  Alt+T 单独记录快捷键访问与入口，Tab 边界返回该入口，Escape 只收起列表；viewport 在仍持有焦点时
  被移除也恢复尚连接的入口，失去焦点即清除旧归属。恢复必须发生在 DOM 移除前：
  最后一条通知由 toast watcher 的 pre-flush 阶段处理，viewport 卸载由 onBeforeUnmount 处理；
  不能等 template ref 清空或 onUnmounted，届时 Chromium 已派发失焦并清除了入口。
  `tests/e2e-parity/notification-lifecycle.spec.ts` 用真实组件固定这组原生生命周期；
  happy-dom 单测与整站键盘遍历仍分别保留。
  引用 picker 的按钮打开状态不由 Tab/selection 事件清除；真正输入/行内光标编辑和外部 pointerdown
  由 composer 分别转交既有 references owner。项目 shelf 已完成附件交接保留普通可移除 chip，
  仅通过引用 picker 选择的文件携带 inline source 标记。
  `useSettingsDialog` 只持有客户端 dialog/focus
  边界，实际 open section 由 route query 决定；关闭仅移除 `settings`，保留其余 query/hash。
  Gateway banner 复用唯一 session Query，仅显示自动恢复状态和退出按钮。不可用时每
  10 秒探测，成功响应直接更新 session；恢复期 401 计数达到 3 后再做权威
  session 探测决定是否进入登录；中间的服务错误使计数减 1，成功则清零。恢复计数归缓存 query 所有，退出/移除 query 后失效。
- **单条线程的元数据（`GET /threads/{id}`）是一个有 key 的查询，不是一次命令式请求。**
  `useThreadMetadata` 拥有 `threadMetadataQueryKey`（`core/threads/metadata.ts` 是
  它唯一的定义处），归档、移到项目、run 结束、改名四处都失效同一颗 key。
  **这一层此前是缺的，而那四处已经按它存在来写了**——没有拥有者，
  `invalidateQueries` 找不到观察者，四处全是空操作。403/404 在 queryFn 里归一成
  `null`（= 线程不存在），其余错误照抛（= 判不出来），判据在
  `core/threads/thread-presence.ts`：一次瞬时 5xx 不许把用户退回新会话。
  查询按 `routeThreadId` 走，所以切线程时存在性判定跟着换，不会拿上一条的结论。
- **run 的 `stream_mode` 只有 `messages-tuple` / `updates` / `custom`，与上游逐字相同。**
  状态由 `updates` 累积（`reduceUpdates` 的 `patch-state`）。**不要加回 `values`**：
  全量快照里用户刚发出的那条 human 消息没有 id，本仓得给它编一个位置键，
  而「编辑并重新运行」会把那个假 id 交给后端，服务端解析不了——
  `isSyntheticValuesMessageId` 是为此打的补丁，根因是多订了 `values`。
  `stream_resumable` 也不发：Gateway 把它声明成 `Literal[False] | None` 的兼容占位。
- **侧栏导航查询由抽屉内实际消费的组件持有；工作区插件初始化独立于导航抽屉。**
  `WorkspaceNavChatList` 持有 `GET /api/features`，`WorkspaceChannelsList` 持有
  `GET /api/channels/providers`，`RecentChatList` 持有 `POST /api/threads/search`；
  `ThreadSidebar` 编排导航，它那份 `useThreads({ enabled: false })` 是**只读缓存**，
  让重命名/置顶处理器与 `ProjectsSection` 的行共用缓存，删除交共享确认框，失败用 toast
  反馈。窄屏的侧栏是 Sheet，关着时这几颗组件都不在 DOM 里，于是这几个查询
  不由侧栏发起——把任何一个提到 `ThreadSidebar` 的 setup 里都会让它变成
  「抽屉关着也发」。Agent 路由父页面的能力查询独立于侧栏，关闭抽屉不能绕过路由门禁。
  由 `tests/e2e/sidebar.spec.ts` 那条 mobile-drawer 用例双向守着（关着为 0、开了要有）。
  `useFrontendExtensions()` 则由抽屉外的 `ThreadSidebar` 初始化；它服务整个工作区，
  对应 React 的 `ExtensionPageBootstrap`，移动抽屉关闭也必须加载插件注册表。
  导航中的 `PluginNavigation` 共享同一账户 query，不创建第二份插件缓存。
  移动抽屉的打开状态随唯一 `ThreadSidebar` 宿主卸载而关闭；账户 preference 边界
  重挂载不会留下旧 Sheet 与仍存活的 Settings Dialog 交叠。同账户渲染不重置抽屉，
  普通路由切换沿既有关闭逻辑，桌面 collapsed 与 cookie 不受宿主卸载影响。
- **断点只有一个 owner：`useMediaQuery`，而且它在客户端第一次渲染就是真值。**
  `useWorkspaceSidebar` 的 `isNarrow` 与 `WorkspacePanels` 的窄屏分支都从它来。
  「挂载后再纠正」不是一种可接受的实现：父组件的 `onMounted` 跑在子组件全部挂载
  之后，窄屏首帧会先把桌面那一支连同它的副作用整个挂一次再扔掉。上游用
  `useSyncExternalStore` 的 layout-effect 重渲染抢在 passive effect 之前达到同样
  的结果，机制不同、要求相同，判词写在 `app/composables/useMediaQuery.ts` 的文件头。
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
  两个 M0 页面与一个单测编译夹具的精确排除项见 [`I18N_INVENTORY.md`](I18N_INVENTORY.md)。
- theme 的唯一运行期 owner 是 `app/plugins/theme.ts` 创建的应用级 controller；它独占
  `theme` storage、三态 preference/resolved、唯一 `matchMedia` listener、根 `dark` class 与
  cleanup。`AppearanceSettings` 和 sidebar 只读写该 owner。`nuxt.config.ts` 注入由同一
  `theme/bootstrap.ts` 生成的首屏脚本，在组件 mount 前应用 class/color-scheme，脚本本身不注册
  listener，因此不形成第二个生命周期 owner。公开根路由 `/` 临时强制 dark，但不改写
  用户 preference/storage；离开后立即恢复实际 preference。完整 locale payload 归独立
  `vendor-i18n` chunk 与显式 asset budget，不占用 `vendor-ui` 预算。
  词典由 `core/i18n/translations.ts` 按 locale 动态加载；每种语言有独立的
  `vendor-i18n` chunk。`nuxt.config.ts` 的 manifest hook 关闭生成的 JS prefetch
  提示，保留必要 preload/import 边，避免无关路由或语言被提前下载。旧的双词典
  静态 `clientTranslations` 和点路径解析器已退役；真实插件与已打开设置面板的
  测试使用同一个异步加载 owner。历史双词典同包的负载读数只适用于旧构建。

- 模型选择器使用 `ComposerModelSelector → projectModelChoices/useModelFavorites`，
  与当前 React 一样按收藏和其它模型分组、保持后端顺序与真实按钮焦点。旧 cmdk
  评分/搜索模块已无产品消费者，连同只测试该副本算法的用例退役；保留当前选择、
  收藏重排、账号隔离、存储失败与原生键盘/布局回归，不重新引入旧搜索 UI。
- 旧 `ThreadChannelIcon` 和 `SettingsActionDialog` 无实际消费者，已退役；线程列表
  仍使用 `ThreadChannelBadge`，设置面板仍使用各领域自己的 Dialog。公共 L2
  AlertDialog/Dialog 及其可访问性测试保持。未消费的 JSON/UUID wrapper 与仅为它们
  声明的直接依赖移除，现行解析、身份与数据协议实现保持各自实际 owner。

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

测试 DOM 依赖固定为 Happy DOM 21.0.4；`patches/happy-dom@21.0.4.patch` 与 React
使用同一份获批源码修复，分别维护动画 finished Promise 的取消/重播语义，以及
CSSStyleDeclaration 的 Web IDL 类型标识。补丁通过 pnpm 的正常安装与锁文件生效，
Docker 安装层和独立工程副本都必须携带它；不得直接修改已安装包。公开 API 回归在
`tests/unit/tooling/happy-dom-contracts.test.ts`，子进程保留未处理拒绝的致命行为；
真实菜单继续消费原始 computed style，不再使用 markRaw 替换。上游提供同等修复后，
必须通过这些契约及完整套件再移除补丁；原生焦点与动画浏览器验收仍单独执行。

独立工程验收由 `scripts/lib/standalone-workspace.mjs` 创建当前源码副本，React 目录和生成目录不进入副本。仓库根及 Vue/backend 模块根的 `.env` 与 `.env.*` 私有配置均排除，公开 `.env.example` 和配置模板保留；原工作区文件保持原位。副本内正常安装、构建、单测与真实 E2E 由 `scripts/standalone-sim.mjs` 驱动，React 缺席时的双端收集不计为对齐执行通过。

```bash
cd frontend-vue
make verify          # lint、格式、类型、单测、i18n、生成类型、契约常量、扩展说明、静态独立性、build
make asset-budget    # 构建产物总量天花板（**不是**用户下载量，见下）
make e2e-mock        # 不需要后端进程的全部套件
make e2e-backend     # 需要真实 Gateway 的全部套件
make e2e-visual      # 产品截图；Darwin 本地与固定 Linux CI 分别验证，基线分开
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

`vendor-*` 由 chunk 中的模块来源命名；一个文件可以同时包含依赖和产品代码，
分类桶变化不等于该依赖变大。保留构建器默认优化，不为桶的数字强制拆包或改变
功能边界。依赖更新后，先审查模块图、整包及真实路由载荷；确有依据的有限增长
可以记录实测值、日期、取舍和合理余量后更新预算，再完整回归。

路由预算保留 **critical 与 prefetch 两组**。CDP `initialPriority` 只表示调度优先级，
不能单独证明模块必要性。当前初始导航同时断言没有 HTML JS prefetch、没有投机
脚本、没有未访问的工作区 layout、没有未选语言，shiki/mermaid/KaTeX 也不进入
普通文本首屏；因此此时 critical 才等于实际请求全集。hover/focus 后的真实预加载
和点击导航另行验证。预算数值调整不改变这些断言，Darwin 与原生 Linux 的完整
路由套件分别验收；产物字节测量不等同于线上加载时间或 Web Vitals。

一个套件 = 一份 playwright config = 一种后端拓扑；套件名说的是**测什么**，
不是迁移阶段，完整清单见 [`README.md`](README.md) 的验证一节。新增功能按实际影响
选择 unit、协议、浏览器、视觉、真实 Gateway 或生产镜像门禁，不要从单次全绿推断
完成状态。

文档里写出来的每一条 `make` 命令都由 `tests/guards/doc-references.test.ts` 校验必须
真实存在——套件在 `1209651f` 按用途改名后，各处文档整整落后了一个版本，而所有门禁
当时全绿，因为没有任何一条检查读过文档。

### 持久化与错误展示边界

Lark 的流程归属覆盖每个异步续接点：安装后的技能/能力缓存刷新完成时，仍须
核验账户与组件 generation，才可提示成功并重新读取状态。复制授权链接完成后，
还须核验原 pending flow 仍存在；面板卸载、账户失效或授权已结束时不再发布旧提示。
真实组件测试使用 QueryObserver 持有实际目录刷新，并覆盖剪贴板成功与失败的晚返回。

`core/settings/local.ts` 保持 Vue 内部 `projects.displayMode` 分组，存储读写适配共享
`projectsDisplayMode`。读取时共享字段优先，兼容旧 Vue 分组值；普通保存完成迁移。
`core/api/errors.ts` 只解析一次响应并保留 status/body/responseText；coded API 的展示
取字符串 detail 或 detail.message，其他结构交给调用域的后备文案/本地化 presenter。
上传、memory、项目与技能各自的数据合同仍在所属 adapter，不把所有错误压成同一种格式。
子任务当前工具调用的规范化 description/prompt 属于展示 owner，不被 live placeholder 覆盖。

Artifact loader 对原始响应 bytes 计算 SHA-256（包括 BOM），不对解码后的文本计算。
完整响应优先使用 Gateway 的64位 ETag；weak/大小写按当前 React 规则归一。
无 WebCrypto 时惰性加载锁定的 `@noble/hashes/sha2.js`，计算同一算法；截断输入不提供
可编辑 revision。保留有界读取、AbortSignal 与 owner 生命周期。

### 工具产物登记与流式通道

`agent-deerflow/reducer.ts` 在同一个 updates 帧内按节点顺序累积已渲染通道：
`artifacts` 追加去重，`tool_artifacts` 按 handle 更新、保留初见顺序并消费 trim_to
与1000上限，todos/goal 的 null 保留旧值，todos 的空数组清空。values 仍是完整替换。
未被 UI 消费的扩展字段仅保留最新 wire 值，不宣称是后端归约后的权威快照。
主聊天和侧聊从各自 stream owner 把 registry 传给 MessageList；processing 视图模型
按 tool_call_id 关联，通用工具步骤展示与 React 相同的文件/集合图标、名称、句柄和原始引用
title。组件不再次查询、不复制服务端状态；中途尚未收到的 args 归一为空对象。
`tool-artifact-registry.spec.ts` 覆盖真实开放 SSE 的追加、消费更新、裁剪、刷新恢复与两种主题。

### 双端 CI 执行边界

`make e2e-cross-app` 保持完整的本地串行入口。CI 由 `scripts/parity-ci.mjs`
按完整测试文件分组，每组拥有独立 checkout/Gateway，沿用原 Playwright config
和单 worker，不拆宏用例中的场景状态链，不改断言或单用例超时。新增文件自动归入
interactions；命名文件缺失或参数不合法时直接失败。工作流从同一个脚本生成矩阵，
总检查要求规划、全部产品组、登录及真实 SQL 会话均成功，取消或缺失的组不能变绿。
分组规划、未来文件覆盖、退出码和工作流必需关系均由测试守住。

程序化 Dialog 的关闭归属由现有 FocusScope 生命周期持有：每次实际打开捕获 opener，
显式 DialogTrigger 仍只由 Trigger 自身登记。Reka 正式 pnpm 补丁将 retained present
关闭与物理卸载统一为一次可取消 close-auto-focus；重新打开会退休旧关闭代次。
现有 scope 栈只补充父容器引用，用于区分父 trap 的孤立焦点恢复与用户的新焦点；
不加入业务 DOM 查询、定时重试或额外全局 registry。不可用 opener 返回仍存活的父
scope，调用方取消和重定向优先，原有 paused/present/history mutation 守卫保持。
这是本仓本地修复，不代表上游批准；src 与 ESM/CJS 必须一致并通过正常 pnpm 安装。
真实 Dialog/Memory mounted 用例以及 memory-dialog-close 原生规格分别验证所有权与
自然 filechooser/direct-input 两种入口；升级依赖时重跑完整公共 UI 和直接消费者。

FocusScope 的可选 `restoreFocusElement` 接收消费者声明的返回目标；DialogContentImpl
仅传入实际注册的 Trigger，程序化 opener 仍按每次激活捕获。modal 与 non-modal
共用同一默认恢复阶段，后者只为 outside interaction 取消默认恢复。关闭先同步发出
可取消事件，再在既有延迟清理中检查 active stack、代次与有效目标；暂停中的已离场
子层不能阻止父层回到仍存活的入口。CJS/ESM 发布入口必须实际挂载、打开并关闭验证，
只 import/require 不足以验证 lifecycle。

## Composer 引用能力查询的生命周期

`useComposerReferences` 无条件订阅现有 `useConversationReferencesCapability`，由
`useFeatureQuery` / Vue Query 继续独占数据、刷新、错误、取消和同 key 去重。查询的
自动请求资格不依赖编辑锁：Showcase、上传/agent准备门禁、润色、compact 的锁只限制
编辑和动作，不暂停能力发现，也不因解锁额外发起请求。此规则只用于当前引用消费者，
不移除其他 feature hook 或 skills/uploads 的独立 opt-out，不新增补偿 GET、缓存配置
或第二份状态。

账户边界仍由 `UserPreferencesBoundary` 先退休消费者、取消/移除 workspace queries，
再开放新身份；最后一个共享 observer 卸载后才中止已消费 signal 的发现请求。失败刷新
保留引用文本和 metadata，但不以缓存授权新发送；只有成功禁用/收紧额度才收敛 grants。
查询响应不接管 attach/polish/submit 的草稿 owner，迟到结果仍由各自 generation/snapshot
保护。本次请求的 payload 固定于提交快照，下一次提交读取最新能力。

`composer-capability-lifetime.dom.test.ts` 使用真实组件、QueryClient、API和fetcher，
在底层HTTP边界控制结果，验证准确query key与请求生命周期；同名原生规格保留公开
Showcase只读/键盘、实际GET响应及正常run context。共享 `/api/features` URL本身不暴露
query key，二者联合证据才用于归因，不把请求总数当成浏览器逐条owner证明。

## 消息列表初次定位与运动所有权

`VirtualMessageList` 继续独占物理 scrollTop、virtualizer、内容 ResizeObserver 和追尾 rAF。
主聊 `initialScroll`/`resizeScroll` 默认为 smooth；Sidecar 显式把两项都设为 instant。
首次已有短历史由内容测量开始，空列表后第一次出现组由内容生命周期接纳（即便高度不变）；
后续组数增加仍是 instant 追加，减少不能当追加。长列表 >=60 使用测量后的 instant 定位，
历史 prepend 仍使用原身份锚点。自动 resize 更新当前运动目标，不能另起竞争写入器。

同一个 spring 使用帧间时间、速度和小数累计；停止阅读、inactive、元素更换、owner 退休
与卸载取消未完成请求。大纲对齐的请求代次独立于物理 owner，不能让一次正常跳转永久
废弃仍有效的内容观察器。MessageList 只交付阅读/提交/恢复意图，不新增第二条滚动循环。
AgentChat 从既有 useChatThreadOwner 传入稳定 draftThreadId，只有确切 prepared URL
接管保留读取位置；不同会话/账户/Agent 仍退休。编辑和历史分页继续保留自己的身份边界。

静态四时钟轨迹由真实 React Conversation+VirtualMessageList 挂载生成并分别固定。
异步空内容到有内容需另外验证：React 依赖内多条 Promise 回调的零时间动量叠加不移植到
Vue；Vue 保持单一运动，原生入视、到尾、读者中断与完整相关规格仍是独立门禁。

鼠标在本viewport内按住文本选区时，物理owner暂停写入但继续推进帧时钟；释放后原运动
自然继续。非本viewport选区不暂停。真实选区边缘滚动通过readingIntent交回MessageList，
与wheel/键盘/阅读focus一样退出追尾；自身迟到scroll事件用实际最后写入位置识别，
不能把程序滚动当新阅读动作。父级mouse pointerdown只给直接滚动条操作设置通用意图，
不把文本拖选永久锁成阅读；touch保留原生滚动意图。观察与文档级鼠标释放监听随组件清理。

非自身触发的向上 scroll 同样退出追尾，包括浏览器 focus/scrollIntoView，没有 wheel、
按键或选区也不能被后续追尾覆盖。物理 owner 同步记录自己的尾部、历史锚点和目录定位，
并保存当前 scrollTop/scrollHeight/clientHeight；合并事件仍以最后实际位置比较。
几何改变同周期的 scroll 不当成阅读（包括原生 clamp），与 React 的 resize 排除一致；
直接在 scroll 中读取几何，不依赖 ResizeObserver
先后或计时等待。viewport/会话 owner 更换时退休旧位置；不另起写入循环。
父级先消费当前阅读意图，再捕获分页锚点；显式停止同步接纳当前位置，避免同一 scroll
在子级监听中被二次识别、再次取消刚捕获的锚点。
TanStack 的 scrollToFn 保留官方 elementScroll 的全部参数并登记实际位置，覆盖内部行测量
和锚点校正；不能只记录调用层的 scrollToIndex/Offset，等总高度的行变化也可能调整位置。

## 正式 CI 对照的唯一归属

`frontend-vue-parity.yml` 独占完整 product 文件组、匿名 auth 与已认证 SQL session 对照。
`frontend-vue-verify.yml` 保留框架验证、资产/依赖/standalone/container、mock/backend/external
及 Linux visual 门禁，不再重复 product/auth/session。正式 aggregate 只有 `parity`，必须等
planner、全部矩阵和 auth 两套均成功；诊断 dispatch 独立为 frontend-vue-parity-diagnostic.yml，
独立并发组且不发布正式 aggregate，避免 job-level skipped success 冒充完成。React 缺失不能 skip 绿。
push/PR 都覆盖 upstream-drift 的完整观察边界。测试同时检查唯一归属和实际 shell 失败传播；
远端 ruleset / required-check 配置与执行记录另行验收，不由 YAML 或本地 PASS 代替。

### 默认关闭的来源观察

`app/core/diagnostics` 只在验收 harness 安装版本化 capability 后发布有限身份字段，
不参与产品状态或请求控制。thread 候选须真实选中，Memory facts 须来自实际选中的导入；
replay 在原有 JSON 消费、通过 owner 检查后的采用、最终 runner 提交处分别记录，
异步完成和 additionalKwargs 克隆仍保留最初 action。Vue replay 的独立幂等 UUID
在实际单次生成点记录，不能与 replacement human 混为同一身份。响应/提交记录不代表
后端已接纳；该关系由 wire 响应建立。未知字段、正文、文件、错误 payload 不发布，
观察超容量须明确 invalid，不能截断后接受；默认关闭不新增 reader、UUID 或请求。

### Parity 采集层的职责边界

跨端身份来源的浏览器 transport 由 `tests/e2e-parity/support` 持有：
`identity-document.ts` 是单个可序列化的页面收集器，`identity-receipts.ts`
定义有限协议并纯校验收据，`capture-identities.ts` 管理 Playwright 资源、
语义 action 和文档 census。它们不决定产品 owner，也不生成 canonical 实体。

来源时间与派发时刻分别保留；浏览器文档 nonce／sequence 只检查本次采集完整性。
公开主 frame 导航触发只读 harness control 的 census，逐 nonce 双向核对；
HTTP document response 计数只是额外必要检查，不按 URL、到达顺序或时间猜归属。
跨 realm、缺 control、未支持的恢复段与采集截止期间的新导航均明确 invalid。

producer/open/action 的 ACK 有有限终态：close 声明 pending，必要时由 settled
证书完成；终态证书以 Node 实际收到为终点，不再递归确认自己的 ACK。缺记录、
未确认、异常或超容量均不得接受。默认未安装采集时没有此 transport；关闭时清理
当前 document、未来 init script 和 binding，不包 fetch/UUID，不读 SSE 或写 storage。
这段说明是架构合同，不能代替实际双端 opt-in、完整 registry 或全套验收结果。

Node receipt 入口统一校验 envelope／packet／values 为普通 own-data record，再克隆；
数组、Map/Set/Date、accessor 与隐式转换的 event 不得成为有效证据。binding 与
seal/drain 的副本使用同一 issued action 登记校验，census 逐 document nonce
核对其初始 generation/action。已发行的另一 action 也不能替代该文档的初始 seed。
收据、文档、导航 census 工作及 issued action 都受既有固定容量限制；超出时
保留有限前缀并 invalid，不继续无界登记 metadata 或 init 资源。

`captureScenario` 在既有首航之前安装 transport。`runScenario` 的可选 beforeAction
只标注 entry、settle 原数组 index 和 steps 原数组 index，先确定 index 再按 viewport
过滤；不新增产品动作。finally 依次尝试 browser seal、Node network cutoff、有限 ACK
drain、当前与未来 hook 清理、原始收据附件。两截止点不是跨 browser/Node 的原子操作。
原始异常保持为第一 cause，清理/观察/附件异常不得覆盖它或让成功结果提前返回。
协议的固定字段、primitive 与终态数组都先验证后复制，不递归解释未知 payload。

SPA 的 pushState/replaceState 会连续触发公开 framenavigated，不能把每条通知都当
新的 document。census 允许同 nonce、同 bootstrap 的重叠读取；跨公开最终主文档
response 边界的未完成读取仍 invalid。response 按原 Request 去重并限制容量，外部
origin 直接 invalid；它只标示潜在文档边界，不能代替 nonce census、完整 close 范围
或身份归属证明。非 HTTP／缺 control／已关闭的 BFCache 恢复仍不获接纳。

自然 BFCache 恢复不会复活已关闭的身份采集器。旧 realm 在 persisted pageshow
先记录无效恢复，再自行释放它拥有的 control 与生命周期监听；新采集器不能
删除另一 capture 的对象。冻结期间未送达的终结收据仍是不完整证据，不作修补。
恢复页面上的采集保持 invalid，只有新受控导航及其完整收据可重新验收。

网络采集逐原 Request 保存公开的 main-frame/child-frame/service-worker/unknown
来源和 navigation 位；公开 API 取样失败保留 unknown/null 并报错。它们只表明
请求发起表面，不能把 frame 当 document 或 owner。采集仍订阅 Page 事件，
不扩大成整个 BrowserContext 的后台流量，不读取额外响应体或改动 fetch。
来源字段留在原始证据供关系校验；原请求 wire 多重集不丢字段或增加身份豁免。

上传限额旁观记录来自真实 Query 的 queryFn；主聊天、Agent composer 和侧聊的
parent fallback 传递实际 owner 的只读 consumption handle。已创建侧聊不能借
parent handle。候选在 render/setup 本地建立，exact commit/select 才认领；
实际 consumer 立即记录，即使该 render 最终未被采用也不能消失。queryKey、
enabled、retry、staleTime、参数、缓存共享和原错误路径保持原样；无 handle
或观察失败有明确未认领/invalid 证据，不能默认匹配“最近的”聊天。

## 运行接管观察边界

默认关闭的 run 观察沿真实 submit input 对象弱引用关联同次 human/replay；runner 在调用时捕获，协议记录实际解析返回的 handle 对象，generation 校验及 onStart 返回后才记录 runner 接管。reset/dispose/替换运行退休旧观察，普通完成不等于 owner 离开。它不新增网络字段、UUID、storage 或 SSE reader；不是 session 最早采用或 stop-during-create 的 cancel 授权。阶段事件保留实际 action/time，提交 action 单独记录。
