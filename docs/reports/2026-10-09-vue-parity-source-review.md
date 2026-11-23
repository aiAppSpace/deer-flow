# React/Vue 对照基线与消息交互补充审查

日期：2026-10-09。依据：当前 `main-wc` 工作树；此文件记录一次审查，不能替代后续构建与浏览器验收。

## 基线数据的正确解释

`frontend-vue/baseline/parity-diff.json` 的 `entries` 有 **195 个场景/断点/主题/语言组合键、37 个场景家族**，不是 195 条历史差异。每个组合的 12 个差异数组均为空，历史差异行数为 **0**。本次没有修改基线，也没有增加豁免。

数组分别约束可访问性树两侧差异、请求多重集两侧差异、请求体、锚点几何/色板、焦点、公共节点顺序、深度、可 Tab 元素两侧差异和 Tab 顺序。该数据只能说明记录时对应样本的结果，不能证明当前工作树、全部功能或任意交互状态都已对齐。

按可观察界面归类：

| 类别                   | 组合数 | 主要组件/可观察界面                                                        |
| ---------------------- | -----: | -------------------------------------------------------------------------- |
| 消息、输入、线程与历史 |     64 | AgentChat、ChatComposer、MessageList、人类/助手回合、Sidecar、线程生命周期 |
| 工作区外壳与上下文面板 |     35 | Sidebar、WorkspacePanels、浏览器、后台任务、项目、工作区变更               |
| 产物预览与编辑         |     20 | ArtifactPanel、流式产物、窗口模式、表格预览                                |
| 能力、设置、渠道与调度 |     74 | agents、integrations、channels、MCP、通知、scheduled tasks                 |
| 公开 Showcase          |      2 | 历史记录中的公开线程样本                                                   |

195 键的完整家族分布如下。键数反映覆盖样本数，不反映差异严重度；Showcase 的这两个历史样本也不能证明当前所有公开案例均已验收。

| 场景家族                      | 组合数 |
| ----------------------------- | -----: |
| `chat`                        |     12 |
| `chat-thread-init-ordering`   |      1 |
| `sidebar`                     |      6 |
| `thread-history`              |      4 |
| `agent-chat`                  |      4 |
| `showcase-public-thread`      |      2 |
| `agent-create-name-step`      |      2 |
| `agents-feature-disabled`     |      9 |
| `browser-feature`             |      4 |
| `sidecar-chat`                |      4 |
| `thread-list-pin`             |      3 |
| `mcp-settings`                |      4 |
| `thread-title-sync`           |      3 |
| `thread-ordering`             |      2 |
| `thread-todos`                |      3 |
| `sidebar-collapsed`           |      3 |
| `background-tasks`            |      8 |
| `thread-archive`              |      3 |
| `thread-list-infinite-scroll` |      3 |
| `ui-polish-mobile`            |      2 |
| `user-message-plain-text`     |      2 |
| `integrations`                |     28 |
| `branch-thread`               |      8 |
| `subtask-card`                |      4 |
| `artifact-preview`            |      4 |
| `artifact-panel-resize`       |      3 |
| `scheduled-tasks`             |      8 |
| `settings-notification`       |      2 |
| `channels`                    |     21 |
| `thread-history-mermaid`      |      6 |
| `workspace-changes`           |      9 |
| `streaming-reasoning-order`   |      2 |
| `artifact-stream-state`       |      2 |
| `artifact-batched-stream`     |      6 |
| `artifact-viewer-window`      |      3 |
| `artifact-table-preview`      |      2 |
| `project-detail`              |      3 |

## 源码发现与本次处理

| 问题                       | 当前 React 事实                                                                                | 修复后的 Vue 边界                                                                                     | 验证                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 编辑并重跑的位置与失败草稿 | MessageListItem 在人类正文位置编辑；等待回调；false 结果保留草稿；附件和知识摘要仍在原栈       | 编辑状态归 MessageList，AgentChat 提供请求 callback；原 absolute 浮层移除；保留旧 edit 事件签名       | 真实 DOM 覆盖行内位置、警告顺序、附件/知识保留、失败重试                                      |
| 编辑等待状态与快捷键       | pending 时 Textarea readonly/aria-disabled，取消/更新不可用；Escape 取消，Ctrl/Meta Enter 提交 | 同状态与键盘行为；重复提交及其他 replay 操作被 pending 拦截                                           | 真实 DOM 覆盖 pending、重复、取消、分支/重跑禁用、快捷键                                      |
| 编辑的异步归属与知识范围   | 请求绑定当前线程和知识范围                                                                     | 发起前复制知识 snapshot，捕获 submission owner；线程/用户/agent 变更退休编辑状态，晚回包不能清新草稿  | DOM 验证 thread/session owner 隔离；既有 stream K3 继续断言知识 scope、checkpoint 和 metadata |
| 助手操作移动端与焦点可见性 | 移动端 opacity-100，桌面 hover、focus-within、菜单 open 时可见                                 | 同 class 契约，并挂对应命名 group                                                                     | DOM 回归覆盖实际组件输出                                                                      |
| 复制成功反馈和编辑图标     | copied 时 aria-label 变化；复制 tooltip 仍为 Copy；图标 size-4                                 | 两类回合 copied label 对齐；tooltip 保持当前 React；Pencil size-4                                     | DOM 验证 copied/复原、图标尺寸                                                                |
| React 删除失败旧 fixture   | 删除菜单后先确认；失败 toast，确认框保留；可再次删除成功                                       | 只更新 React fixture 的确认、toast、重试断言，不改 React 产品                                         | ESLint/Prettier PASS；真实 Chromium 整文件 3/3 PASS，未匹配 API 请求为 0                      |
| Agent 创建页隐藏请求       | agents/new 不消费 suggestions config、post-run suggestions 或 token summary                    | bootstrap 不启用 config query，onFinish 和 refreshPostRun 双重阻止隐藏请求                            | 源接线及生命周期定向回归 PASS；真实两轮请求计数由 Agent gate 验证                             |
| 空会话 Markdown 资源边界   | 富文本渲染随消息内容进入                                                                       | rich 默认 map 归已异步的 MessageMarkdownContent；MessageList 只传业务 a/img；caller override 最后合并 | 真实 adapter DOM、空会话不加载 rich map、默认表格/代码及 override 回归 PASS                   |
| 历史加载失败反馈与重试     | useThreadHistory 报固定 toast；普通 Load more 按钮保留；没有内联错误行                         | query onError → stream notify；保留原错误/status/detail 与消息；移除独有 inline alert/Try again       | 真实分页失败/同游标重试、初始失败、stream toast、按钮/焦点回归 PASS                           |

主要源文件：

- React：`frontend/src/components/workspace/messages/message-list-item.tsx`、`messages/message-list.tsx`、`copy-button.tsx`、`thread-delete-dialog.tsx`。
- Vue：`frontend-vue/app/components/chat/AgentChat.vue`、`MessageList.vue`、`AssistantTurnActions.vue`、`HumanTurnActions.vue`。
- 新 DOM 回归：`frontend-vue/tests/unit/chat/edit-rerun-inline.dom.test.ts`。

## 历史 intentional 注释的逐项复核

1. **Dropdown z80 / React z50 仍是活动实现，但单独降级不安全。** Vue 的 Dialog、Sheet、AlertDialog、Select、Popover、HoverCard 与主菜单全部 portal 至 body 且统一 z80；Tooltip z90，应用 fixed 最高50，toast120。同层通过后出现的 DOM 决定顺序。主菜单 portal，子菜单留在父菜单子树，两端相同。真实嵌套链包含 mobile WorkspacePanels Sheet → ArtifactPanel → ArtifactPreview → MarkdownTable 下拉，及 AgentSettingsDialog → Select。把 Dropdown/Select 单独降到50会低于现行 Dialog/Sheet80。现有 parity capture.ts 按同一 viewport 中心点 elementFromPoint 记录 clickable 的 hit，并由 diff-entry.ts 对比；triple-overlay-keyboard.spec.ts 按运行时发现的 menu/listbox 验证方向键、Enter/Space、typeahead、子菜单和 Escape/focus 恢复。当前源码已覆盖这两类判据，最后双端运行结果仍由 root gate 确认；本次没有凭数字替换，也没有宣称该差异已获豁免。
2. **旧 Reasoning 根组件的手动展开分叉目前没有生产消费者。** app 内没有 Reasoning 根或 ReasoningTrigger 消费；实际聊天使用 ReasoningDisclosure，只复用 ReasoningContent。旧注释不能作为当前聊天行为的豁免依据；根/Trigger 是否保留应按组件库存与公开边界清理，而非删掉实际 Markdown/Reasoning 内容能力。
3. **TodoList 的 button 行为已在两端一致。** 当前 React 已有 button/aria-expanded，不能根据旧 header 注释再算一条 Vue 独有功能。React 的可控 collapsed/hidden 在当前主/agent 聊天消费者中未启用，不能把未消费的 prop 差异等同实际页面差异。
4. **项目缓存失效的旧“有意不同”注释已过时。** 当前两端 create/patch 都只失效项目，archive/restore/delete 才额外失效无限线程列表，实际消费者边界一致。
5. **slash-suggestions 的旧技能名额说明不代表当前菜单行为。** 当前 ChatComposer 调用 helper 的 skills 参数为 []，仅 goal/compact 参与 `/` 菜单，与 React 的 builtin commands 过滤相对应；旧技能优先级路径不能当作当前 UI 分叉证据。
6. **历史错误行的旧“保留差异”说明不成立。** 当前 React hook 已以 toast 展示查询失败，并非无反馈；Vue 已接通同一反馈职责并移除独有内联错误行。原 historyError 数据/API 仍可观测，普通按钮保持实例、焦点和重试能力。仅删随该 UI 退役、当前 React 无同名合同的两个 Vue messages 翻译字段及原生 button 库存条目。

## 本轮历史负担清理的实际结果

原 AgentChat 绝对定位编辑浮层及其第二份编辑状态已移除，消息内编辑成为唯一草稿/pending owner。
默认富文本组件 map 从 MessageList 的静态依赖移入既有异步产品适配器，保留实际默认 UI 与 caller
override 优先级。历史分页错误由 query 通知端口负责，删除独有内联错误/重试 UI、失实差异注释与
相应按钮登记；保留错误结构、消息数据、查询取消、正常重试和基本无障碍。
这几项以真实消费者和行为回归收口，没有把减少文件/测试/行数作为完成标准。

### W12 对照计划第三节与职责落点的源码复核

下表依据当前生产引用，不以旧审计、文件存在或测试数量代替实际接线。完成指实现与局部
回归；完整最终 verify、真实 Gateway 与双端浏览器仍由 root 按同一最终源码串行验收。

| 计划整理项                       | 当前路径与实际消费者                                                                                                                                               | 实现/必要保留边界                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 消息虚拟化、滚动与锚点           | `MessageList → VirtualMessageList → @tanstack/vue-virtual`                                                                                                         | 已收敛：测量、物理滚动、阅读/分页锚点、内容 resize 与 tail 动画只归 VirtualMessageList；MessageList 仅动作/意图/pending token。原 prepend、短长阈值、长工具 resize、目录、追尾、卸载断言完整保留；新增第二 writer、旧 completion 与切 owner 同索引仍发目录高亮的回归。                                                                                                                                                                                                                                                                                               |
| AgentChat 会话、Agent 创建和面板 | `useChatThreadOwner`、`useThreadStream/useActiveThreadRun`、`useAgentCreationSession`、`useArtifactsPanel`、`useSidecar/useSidecarSession` 均由 AgentChat 实际调用 | 生命周期已独立：页面保留 route/Agent/project 及互斥面板编排，浏览器展示选择也归该单一页面 owner；会话 run 只归 stream/runner。sidecarReady 的 ref/watch 镜像已退役，模板直读 session.ready；原 absolute 编辑状态已退役。                                                                                                                                                                                                                                                                                                                                             |
| ChatComposer 生命周期            | `ChatComposer → useComposerSubmission`；草稿/引用继续消费 `useComposerDraft/References`，Voice/Polish 独立；上传纯规则共用 `core/uploads/submission-files.ts`      | 已接线：compact/goal/upload-submit 统一 epoch、AbortController、身份/草稿/model/context/host metadata snapshot；失败保留，accepted 才退休，稳定重试 ID 与 descriptor cache。AgentChat 捕获 quote/knowledge 后经 send → stream.buildRunContext 传递，知识仅 human kwargs。事务 owner 只按 user/实际 target thread/agent 取消；同 target 的 new→URL 草稿 adoption 不取消已接受 run，UI/voice/polish 保留 threadKey scope。组件 submit 只转交 owner 与 placeholder DOM。28 文件/213 定向测试及 app/tests 类型、lint/format PASS；新增完整 HTTP fixture 待最终构建验收。 |
| 唯一输入、产物与 session 状态    | ChatComposer 草稿 refs 接 `useComposerDraft`；ArtifactPanel 通过 `useArtifactsPanel.draftOwner → useArtifactDraft`；stream runner 独占 run/session                 | 输入与 accepted 清理、产物 baseline/remote/draft/dirty/conflict、session 生命周期各有真实单一 owner；`localGoal` 为等待权威 snapshot 的提交覆盖，浏览器 observed/display frame 为 UI 选择/一次自动打开账本，不是另一份服务端状态。                                                                                                                                                                                                                                                                                                                                   |
| 缓存与 feature flags             | `useWorkspaceFeatures → core/features/query.ts → useQuery`；账号 mutation 使用 `captureWorkspaceQueryOwner/resetWorkspaceQueries`                                  | 手工 feature cache/inflight 已不在生产路径；Agent 的 localStorage 冷启动值保留当前 React 行为，实时结果仍归 Query；引用 capability 失败不利用缓存结果授权发送。                                                                                                                                                                                                                                                                                                                                                                                                      |
| Lark 授权流程                    | `LarkPluginSettings → useLarkIntegrationFlow`                                                                                                                      | status Query、配置/授权窗口、轮询、attempt/generation、账号 owner、timer/dispose 集中同一 hook；旧 settings 没有复制该流程。                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 旧 thread-context                | `app/composables/thread-context.ts` 原仅独立 unit                                                                                                                  | 已删除闲置抽象及只测试该抽象的文件，实际领域 provide/inject 不动；REUSE 清单改为真实 useChatThreadOwner。                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 旧 proxy policy/builder          | `app/core/auth/proxy-policy.ts` 零消费；`config/routes.ts.buildProxyRules` 原仅孤立参数化用例                                                                      | 均已退役。Nuxt 继续消费 csrRoutes；Nitro catch-all/`server/utils/gateway-proxy.ts` 继续消费 body 上限、路径与 Forwarded 规则；这些真实安全断言全部保留。                                                                                                                                                                                                                                                                                                                                                                                                             |
| 旧 keyboard/upload adapter/type  | `app/core/input/keyboard.ts`、`uploads/prompt-input-files.ts`、`FileUIPart` 原仅孤立 unit                                                                          | 均已退役；键盘原 5 断言转到 CommandPalette 实际使用的 workspace-shell/shortcuts；上传/重试继续由 ChatComposer 与 useSidecarSession 共用 submission-files。forbidden-deps 的 SDK 禁用约定保留，理由不再引用死类型。                                                                                                                                                                                                                                                                                                                                                   |
| 旧 artifact editing/feedback     | `artifacts/editing.ts` 已不存在；`api/feedback.ts` 零生产/测试消费                                                                                                 | 孤立反馈 wrapper 已退役；Message/Run feedback 数据与 backend 契约保留，未增上游当前不可达的 Feedback UI。实际产物编辑、保存冲突、离开保护继续消费 draft/policy，不删除其行为测试。                                                                                                                                                                                                                                                                                                                                                                                   |
| 重复 workspace change anchor     | `MessageList.workspaceChangeAnchors → getWorkspaceChangeAnchorGroupIndices`                                                                                        | 已接实际纯 helper，原第二套选择算法已退役；混合 human/assistant/tool、同 run 多末态和 processing-only 边界继续由既有用例验证。                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| UI 适配与基本无障碍              | active Reka 菜单/Select/Dialog、MessageList 行内编辑、CommandPalette、route announcer                                                                              | 保留实际 label/focus/Escape/键盘/响应式与防越界消费。z 层级审计见前文；未经真实浏览器证明不能机械删定位/焦点适配，也不将其声明为功能/UI 豁免。Reasoning 根/Trigger 仍是有库级契约测试的公共 L2 导出；实际聊天只消费 Content，不能据零页面引用误删公共渲染边界。                                                                                                                                                                                                                                                                                                      |
| 工程/测试/公共包边界             | `app/core` 为产品规则与 API 适配，`packages/agent-core` 为框架无关协议/runner；现有 guards/consumer/standalone gates                                               | 本轮只退役无消费者的实现及其专属用例，迁移键盘覆盖、增加真实 owner 回归，未改变 gate 的产品行为范围。完整公共包消费、独立副本与最后 CI/视觉由 root 正式 gate 验证，局部 PASS 不替代它们。                                                                                                                                                                                                                                                                                                                                                                            |

W12 局部证据：消息全部真实消费者、Markdown/history 与现行 shortcuts **31 文件/279 测试
PASS**（最后同索引 owner 回归新增前）；最终滚动 owner/目录 **3 文件/25 测试 PASS**，
workspace change anchor **1 文件/5 测试 PASS**。最终 app/tests vue-tsc PASS（最后滚动 owner 修复后）。新增同索引 owner 回归先实证漏发高亮，再通过
reset lastActive、取消旧 active/settle frame 和 nextTick revision fence 修复；不改变阅读位置。
配置/真实 Nitro/上传/禁止依赖/文件头守卫 **5 文件/45 测试 PASS**。
ChatComposer 独立 owner 已完成，定向 **28 文件/213 测试 PASS**；源码冻结交统一最终门禁。

## 组合回流门禁的最新证据

stage19 的大量读数实际来自 combined-reflow，而非 content-reachable。前者逐端要求横滚、
lost 与 clipped 全空，没有接受表；后者纵/横 KNOWN 也都为空。当前结果不能写成既有豁免，
共有缺陷也仍需由门禁收口。stage19 React 同尺记录为 scanned182、horizontal76、lost48、clipped25；Vue scanned194。两端部分终态尚未到达，因此这些历史诊断不能代替最终完整终态对照。

已修复 combined/triple-reflow 固定 61 库存断言：期待集合来自当前登记表的实际 terminal state，
每次成功扫描登记 key；missing、unexpected、重复登记与重复扫描都必须为空，且扫描数严格等于
期待集合。没有改阈值、过滤或产品判据。新增漏扫描、等数替代/重复、意外状态、重复登记、
新登记自动纳入的负向回归；连同原 scenario-coverage **2 文件/14 测试 PASS**。

真实双端项目详情页探针 **1/1 PASS**（指证据采集成功，不是产品裁切通过）：
360×800 viewport、32px 根字号下，Tabs 内容区 264px，w-fit/nowrap 标签栏 608.8px；
Instructions 起点 x335.8、宽180.7px。ScrollArea viewport clientWidth360 / scrollWidth657，
overflow-x:hidden / overflow-y:scroll，仅纵向滚动可达。两端都 lost2/clipped1、横向裁297px，
截图均只露出 Instructions 首字。根因是两端 projects/[id] 的宽标签栏进入单轴 ScrollArea，
不是 Vue 单边回归；每个 context 的未匹配 API 为0，无共享后端访问。

随后两端项目页已采用相同内容容器响应式修复：Tabs 为命名 container，列表仅在内容宽度
低于28rem时限制 max-width、换行、以同 orientation variant 解除固定高度；正常宽桌面保留
w-fit/h9 与 trigger 百分比高度。先注入普通 height:auto 实证会使桌面 trigger 高度增加1px，
该方案已弃用，没有像素补偿或放宽0.1px判据。两端安装的 Tailwind 都是4.1.18，各自生成
精确类 CSS 逐字相同；实际浏览器注入该 CSS/class 后，1280/root16 的列表和4个 trigger
x/y/width/height 全部保持原值，360/root32 列表264px宽/约238px高，lost/clipped/横滚全0，
ArrowRight 依次聚焦并激活 Documents/Instructions/Settings。源已落地、两端 scoped lint/format、
Vue tests 类型 PASS；新增 project-tabs-reflow.spec.ts 两条双端回归待最终构建真正消费源码后运行。
原目录没有重新构建，CSS 注入验证不冒充源码构建后的最终通过。

- [Vue 实际截图](evidence/2026-10-09-reflow-probe/vue-project-detail.png)
- [React 实际截图](evidence/2026-10-09-reflow-probe/react-project-detail.png)
- [双端 DOM 祖先与完整 survey](evidence/2026-10-09-reflow-probe/project-detail-dom.json)
- [精确 Tailwind CSS 注入后几何/键盘/survey](evidence/2026-10-09-reflow-probe/project-detail-wrap-dom.json)
- [Vue 修复验证截图](evidence/2026-10-09-reflow-probe/vue-project-detail-wrapped.png)
- [React 修复验证截图](evidence/2026-10-09-reflow-probe/react-project-detail-wrapped.png)
- 临时执行日志：`/private/tmp/deerflow-reflow-probe.log`、`/private/tmp/deerflow-w12-reflow-coverage.log`、`/private/tmp/deerflow-reflow-proposed-wrap-tailwind.log`。

## 验证边界

- 定向回归：9 文件 / 95 测试 PASS。
- Vue 应用类型、测试类型、所改文件 ESLint/Prettier：PASS。
- 完整 Vue Vitest stage13：434 文件 / 3600 测试 PASS；exit 0、JSON success true；日志无 Unhandled Errors 段。该次运行早于后续 bootstrap/Markdown/历史错误修复，不能替代最终完整运行。JSON 的 suite 数包含 describe 层，不可拿它代替文件数。
- bootstrap guard 定向 4 文件 / 45 测试 PASS；Markdown 产品适配器相关定向 14 文件 / 98 测试 PASS；历史反馈初轮定向 3 文件 / 40 测试 PASS。最终组合回归以随后证据为准。
- 最新组合 DOM 回归：21 文件 / 192 测试 PASS，包含 Markdown、行内编辑、回合操作、composer workflow/消息表面、真实 history query/stream 通知/按钮交互，以及切线程后旧请求被取消、晚失败不通知新线程。所改生产/fixture 的 scoped ESLint exit 0。
- stage14 与 Nuxt build 同时修改生成态，出现 3 个 Nuxt suite 的 `#app-manifest` 装载错误；3585 测试 PASS、0 断言 FAIL、17 skipped。该轮整体不是 PASS，也不将环境装载错误算作产品断言失败。后续完整 unit 与 build 必须由 root 串行执行。
- 两端 agent 编辑 E2E 统一使用 `.is-user textarea` 并断言焦点；原 prepare、checkpoint、metadata、context、替换消息等断言全部保留。fixture 静态检查 PASS，浏览器待 root 的最终构建与正式对照。
- React thread-list-pin.spec.ts 真实浏览器整文件 **3/3 PASS**（4.2 秒）：pin/unpin、旧 pinned 首屏、确认删除→403 toast→保留 dialog/row/Cancel 焦点→重试成功。每页最先注册未匹配 API abort，afterEach 断言零漏请求；PATCH/DELETE/search 均由该页 mock 消费，没有共享 Gateway 写入。临时 Playwright config 仅连接现有 3116 production，无 webServer/build/dev，保留失败 trace/screenshot 策略及独立 JSON/log。
- 本子任务没有构建、没有运行完整 E2E、没有提交或推送；旧 preview 不能证明这一轮新生产消费者。

本次运行临时证据：`/private/tmp/deerflow-inline-edit-{targeted,types,eslint,prettier}.log`、`/private/tmp/deerflow-vue-full-unit-stage13-inline-edit.{json,log}`、`/private/tmp/deerflow-vue-full-unit-stage14-bootstrap-suggestions.{json,log}`、`/private/tmp/deerflow-markdown-adapter-{red,green}.log`、`/private/tmp/deerflow-history-feedback-{red,green,eslint}.log`、`/private/tmp/deerflow-composer-history-markdown-final.log`。证据可能随系统清理；本报告中的已执行边界与源码指针保留于仓库。

W12 最终临时证据：`/private/tmp/deerflow-w12-active-owner-{red,green}.log`、`/private/tmp/deerflow-w12-scroll-owner-final.log`、`/private/tmp/deerflow-w12-scroll-anchor-final.log`、`/private/tmp/deerflow-w12-messages-final.log`、`/private/tmp/deerflow-w12-cleanup-guards-final.log`、`/private/tmp/deerflow-react-thread-pin-browser.{json,log}`。

## 聊天、工具与设置回流的收口证据

以下区分生产接线、局部实际浏览器证据与最终整站门禁；CSS 注入只验证根因，不冒充新源码已构建。
未增加 KNOWN、过滤、阈值或差异豁免。所有探针每个 context 先注册未匹配 API abort，均断言零漏请求，
没有真实共享 Gateway 写入。正式双端 spec 仍由 root 在最终两端构建后运行。

| 消费链 / 问题                | 当前根因修复                                                                                                                                                                                                                        | 已执行证据                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React `ChatBox` 断点切换     | mobile 早返回替换整个 chat owner 导致输入/展开错误/详情状态卸载；改为同一个 ResizablePanelGroup 与 chat 子树，移动 Sheet 仍由同一 details owner 关闭                                                                                | 真实 DOM 2 PASS：输入节点、draft、展开错误及 mount 次数跨 desktop→mobile→desktop 保持；新构建浏览器状态门禁待 root                                                                                                                                                                                       |
| 两端 Appearance              | 命名内容 container 下约束预览最小宽度、允许装饰行与长文本换行，保留正常桌面卡片布局                                                                                                                                                 | 两端真实 Tailwind CSS 完全一致，桌面92个后代 rect 0 diff；360/root32 lost/clipped/横滚全0；`appearance-compiled-dom.json`                                                                                                                                                                                |
| 两端 Memory toolbar          | 窄内容容器中按钮换行、自然高度、长文案可换行；共享导入 fixture 按真实 dialog file input 定位                                                                                                                                        | 5状态×2端实际编译 CSS 探针 PASS，桌面19个后代 rect 0 diff；`memory-compiled-dom.json`。无效/旧格式/导入成功原断言保留                                                                                                                                                                                    |
| 两端 ToolDetails copy header | container 放在既有 flex header，窄宽度允许 copy 按钮换行/自然高度；不在 section 上新增 BFC                                                                                                                                          | 实际编译 CSS 双端 PASS，16个 section/header/child rect 0 diff；`tool-payload-compiled-dom.json`。旧 React preview 仍存在 owner remount，探针重新打开只用于 CSS 诊断；正式 `chat-state-resize.spec.ts` 必须保留原展开错误状态                                                                             |
| 两端 SkillUsagePanel         | 183px可用正文宽度小于 icon+gap+badge 的233px最小和；仅内容容器低于20rem时标题/metadata 换行，正文继承 anywhere                                                                                                                      | 两端实际编译 CSS 探针 PASS，桌面20个后代 rect 0 diff；`chat-compiled-{vue,react}-skill-usage.json`；未用28rem以免改变409px桌面面板                                                                                                                                                                       |
| Vue DropdownMenu             | 触发器移出视口时 Reka 默认只约束一个轴；用原生 `prioritizePosition:true`，保留 optimized、sticky always、collision padding8；移除手写 translate 坐标修正                                                                            | 实际 production preview VNode/native prop 注入 PASS，桌面 menu rect 完全不变、窄屏 lost/clipped0；`skill-menu-native-positioning.json`。真实 primitive DOM 断言方向键焦点与不存在 translate                                                                                                              |
| 两端 chats list              | Radix table intrinsic 受标题 truncate/nowrap、origin、unread、gap 与 padding 驱动至429px；w-full/min-w0/max-width不足。业务列表根声明 `@container/chat-list` 为 inline-size 宽度 owner；header 独立 container，窄 tabs 同项目页换行 | 仅 max-width100%+min-width0 阴性试验两端失败；业务 inline containment 两端 PASS，桌面所有 header/list 后代 rect 0 diff、窄屏四项 strict0、ArrowRight/Left 焦点可达。`chat-intrinsic-*-content-{contain,max}.json`、`chat-compiled-*-thread-activity.json`。保留内部 table、标题 truncate、分页与虚拟测量 |
| 两端消息正文                 | 长标题/路径的 intrinsic word 超过窄内容宽度；消息内容根统一继承 `wrap-anywhere`                                                                                                                                                     | 两端 showcase/scheduled 真实 raw CSS 探针保持原桌面几何并消除文本横滚；新增4条正式 chat/skill reflow spec 共覆盖20个状态，仍待最终新源码整站验收                                                                                                                                                         |
| Vue bash processing          | `ProcessingToolStep` 误用 Markdown CodeBlock，增加 Streamdown 语言栏、复制/下载、行号和 nowrap。改消费独立 `ui/code-block/CodeBlock.vue`，与 React AI-elements 契约相同：无行号默认、pre-wrap、one-light/one-dark-pro               | 实际消费者 DOM 红→绿；A→B→A code/language、失败 fallback、unmount 迟到结果回归。`core/markdown/highlight-code.ts` 按需加载 Shiki，64项 LRU/超100000字符不缓存，保留 React 的主题与 line number 选项。通用 Markdown CodeBlock 两条原 SSR DOM fixture 不改且 PASS                                          |

相关新增正式门禁是 `project-tabs-reflow.spec.ts`、`settings-controls-reflow.spec.ts`、
`chat-state-resize.spec.ts`、`chat-content-reflow.spec.ts`；均要求原场景实际状态可见，再做真实
窄屏/32px根字号 reflow、键盘与严格 survey，不能用关闭 modal/panel 取代通过。

输入历史负担已按现行 React owner 清理：ChatComposer 不再持有不可写入的 selectedSkill owner，
现代技能只通过 inline reference 选择；公开 useComposerDraft/useComposerSubmission 的 legacy
skillName 参数保持可选兼容。恢复旧 localStorage 草稿时，仍启用的 skill 转为唯一 inline token
（已有 token 不重复）；禁用/缺失 skill 保留可编辑字面文本。SlashSkillChip 的历史消息只读
消费者保留，退役 removable 分支及 Vue-only primitives.removeSlashSkill 文案/类型/按钮登记。
原 submit/goal/compact/upload/accepted/身份快照 owner 不改；两类 legacy 恢复负向/正向与既有
生命周期合计17 DOM文件/147测试 PASS，随后最终定向结果见日志。

共享 browser fixture 按解码后的 `/threads/:id` 路径段精确匹配，修复 tool-details 与
skill-history 前缀抢占 tool-details-precise/skill-history-old；精度、duplicate key、旧无证据
状态原断言完整保留。实际双端 precise-result 与 old-no-evidence 到达通过。两端 mock 默认
GET `/api/subagents` 返回 `{subagents:[]}`，后登记的 agent-knowledge 专属 route 仍优先。
人类气泡 toolbar fixture 通过 human-turn-actions 真实语义定位，并断言 offsetParent 是
最近 human bubble；原气泡相对位置与外部 chatOverflow≤1 判据均保留，不按 children 顺序猜测。
该原用例在现有 Vue production preview 上实际浏览器1/1 PASS（957ms），每页漏 API 请求0，
日志 `/private/tmp/deerflow-artifact-toolbar-probe.log`；没有修改产品来迁就 locator。
SkillUsage DOM fixture 预热真实异步 MessageMarkdownContent/StreamMarkdown 模块，不替换渲染或删
Original snapshot、本地链接/图片过滤、远程链接、复制、焦点/owner 隔离断言。

React stage26 的安全 guard 不是过时预期：锁里的 xmldom0.9.8 实际命中
[官方 GHSA-965w-775f-mr7g](https://github.com/advisories/GHSA-965w-775f-mr7g)。按已授权补丁覆盖
`@xmldom/xmldom:0.9.12`，定向 install 仅该包 +1/-1；Vue lock 无此依赖。原安全 guard 未放宽，
连同 exact-thread 5例和 ChatBox2例，React定向3文件/8测试 PASS。React完整check/unit由root接管。

当前生产源局部 freeze 后 Vue tests vue-tsc（含app）、app vue-tsc、所改 scoped eslint及
Vue/React prettier PASS。通用 Markdown、SkillUsage、native dropdown、processing、ToolDetails
初轮6 DOM文件/26测试 PASS；最后12 DOM文件/111测试、7 node文件/30测试、3个源码守卫文件/18测试 PASS。DOM日志存在 happy-dom未mock子查询的localhost:3000 EPERM console噪声，最终汇总没有断言失败或 Unhandled Errors 段，不以此宣称完整联网集成通过。最终定向执行日志：
`/private/tmp/deerflow-composer-final-{types2,app-types,lint,dom,core2}.log`；
实际浏览器编译 CSS 日志 `/private/tmp/deerflow-{appearance,memory,tool-payload,chat}-compiled*.log`。
完整 verify、最终构建后双端/真实后端、Linux视觉与Compose仍以root最终相同源码快照结果为准。

工具代码暗色链路的最后核验：React globals.css 仅对 html.dark 下 `.shiki span` 使用
`--shiki-dark !important`，Vue旧 Markdown renderer 依靠自己的 token类，因此此前没有此规则。
新工具 CodeBlock 把同一规则内聚为 scoped deep +原生CSS嵌套；实际 Vue compiler 输出带该组件
scope的 selector。浏览器 light→dark→light 实测170/187/204→17/34/51→170/187/204，owner外
相同 Shiki span 颜色保持不变。该根因验证1/1 PASS，`tool-code-dark-scoped.json` 与
`/private/tmp/deerflow-tool-code-dark-probe.log`；不加入影响其他 renderer 的全局覆盖。

新增 CodeBlock 后 source inventory 实测345产品SFC+2测试fixture=347总数、unscanned0，已同步
I18N_INVENTORY 与 source-guard精确断言并显式要求覆盖新组件；i18n baseline1821 keys/64 unused
及 audit JSON不变。本轮 doc-facts 完整尝试19PASS/3FAIL：parity collection因diff.spec describe内
`test.use({trace:'off'})`被Playwright拒绝、实际0例，已移交root按worker配置根因修复。没有把
文档case数改成0或静默跳过collection；SFC/typed词典等独立事实仍保持真实检查。

interaction-settles-first 严格滚动差异的只读闭环：旧3115/3116逐步采集显示，Vue Lark Card
相对dialog起点142.98px，旧React起点215px；React仍有现行源码已退役的 SettingsPage
section/header/main wrapper（额外72px），内容高1132对1060、client678相同。Calendar在Vue
部分可见，click仅滚30；React完全在可视区外，Playwright居中滚425。随后的fill使Vue输入
底部恰好可见（198），React已可见保持425。8组每步first与500ms late一致，排除动画漂移。
在旧React独立context仅解包已退役 wrapper，保持同样原生click/fill，不改CSS/scrollTop或
滚动策略，两端initial1060/client678→click30→最终198严格相同，1/1 PASS。当前
`plugin-adapters.tsx` 已直接异步消费 LarkPluginSettings/Card，因此不另加生产修正。
正式 interaction spec保留scroll>0及Vue===React，fresh React build实际结果由root接管。
证据 `integration-scroll-{vue,react}-step{0,1,2,3}.json`、
`integration-scroll-current-adapter-topology.json`，日志
`/private/tmp/deerflow-integration-scroll-{probe2,current-adapter}.log`。

Stage28 全量两个 fixture 边界单独收口：SettingsDialog shell 测试原按组件名 stub 无法拦截
defineAsyncComponent 的真实 import，Memory 面板在环境 teardown 后仍加载。改为当前8个 panel
模块的显式 default mock，并等待实际 account/memory/appearance mock DOM 后执行原 dialog/focus/
Escape/history 断言；独立 loading 测试仍验证所有面板按需加载。scheduled reuse/duplicate 用例
每次实际挂载都构造系统 ICU 数百个时区 SelectItem（关闭列表也构造），全量并发时首例8907ms；
固定该文件不关注的时区候选为 UTC/NY，保留真实 Form/Schedule、日期/DST转换、接口 owner 与
全部原断言，清理每个 QueryClient 后再完成 teardown。没有增大 timeout。原单独首例768ms，
改后161ms；5文件33测试 PASS，types/scoped lint exit0，日志
`/private/tmp/deerflow-stage28-fixtures-{green,types,lint}.log`。完整 unit 由root重新执行。

最新上传锁接线已核：AgentChat 将唯一 submission owner 的 localUploading 纳入既有 disabled，
knowledge slot 共用锁。另一个tab的原生storage模型同步只影响实时可见选项与下一次提交，
不能解锁当前上传、取消上传或改写首笔快照。cap实际双端各1条E2E与8文件112测试 PASS；
本报告未重跑该组，以root最终统一源码门禁为准。

Stage29 完整 mock 的消息域真实缺陷：historical Mermaid 图与 labelled dotted arrow 已正常，
相邻 TypeScript fence 却渲染为工具 AI-elements CodeBlock（one-light/one-dark-pro，无语言/
复制下载栏/行号），原 data-streamdown token 断言失败。不是 selector 过时：React completed
Markdown 仍消费 Streamdown，Vue MarkdownPre 源码也明确导入同目录通用 CodeBlock。
真实 Nuxt 4.5.1 LoaderPlugin 正则匹配 `h(CodeBlock)` 后按全局组件登记表替换，不检查局部
import；新增 shadcn ui/code-block/index.ts 同名导出触发错误。原 server/client 产物均指向
ui CodeBlock。生产只将 MarkdownPre 局部 import 与 h 参数明确命名为 MarkdownCodeBlock，
不改两个 renderer 的 DOM/主题或引入样式补偿。

独立公共 Nuxt test-utils 配置提取当前真实 loader，并编译实际 SFC script：旧同名引用重现
import ui/code-block/index.ts + h(__nuxt_component_0)，新别名保留 ./CodeBlock.vue +
h(MarkdownCodeBlock)，断言 PASS、原缓存未用。证据与可复跑 probe 位于
[evidence/2026-10-09-markdown-resolution](evidence/2026-10-09-markdown-resolution/nuxt-transform-summary.json)。
原 historical Mermaid browser 用例所有图/tokens/style/color 断言保留，并增加通用工具栏、
行号计数器和 --sdm-c/--shiki-dark 检查；实际最新生产 browser 结果待本轮门禁，不能用纯 Vue
DOM PASS 外推 Nuxt 编译正确。探索用临时 Nuxt runtime fixture 在隔离 buildDir 初始化遇到
Reka Omit extends 类型解析错误、实际0例；没有将该环境错误记为断言 RED/PASS，也未保留
known-red formal suite。

Stage29 composer-permissions 两项属于测试拓扑错误：主 mock 套件以 authDisabled=true
构建，selector 按当前产品合同不请求 /api/v1/auth/me，原 fixture mock 的 RBAC 用户未被
消费。两项完整迁入 tests/e2e-auth/composer-permissions.spec.ts，mock 引用相应改为
../e2e/utils/mock-api；保留禁止发送/goal、草稿与 toast、缺 cancel 权限时 disabled Stop、
Space 不发 cancel、完成后 Submit 恢复等全部原断言。没有让 authDisabled 产品重新取 /me，
实际启用认证的生产浏览器验收由 cap 的最终 auth copy 执行。

Stage30 selection-toolbar fixture 生命周期收口：全量21条 EnvironmentTeardownError 均由未被
本文件断言的异步 MessageMarkdown→MarkdownBlock→render.ts 在环境结束后加载造成；原测试
也未卸载20次 mount 的 MessageList。按被测职责在真实 MessageMarkdown 模块边界提供文本
surface，每例显式 unmount 全部 wrapper、clear 对应 QueryClient、flush pending promises，
然后恢复 animation frame/globals/body。全部原锚定、翻转、四边约束、按钮、mousedown、
跨轮选区、processing/streaming/selectionMode、Escape/scroll 和行内标记选区断言保持。
selection-toolbar 20/20 与独立真实 code-block/message-adapter 7/7，共3文件27测试 PASS、
无 Unhandled Errors；没有修改产品 catch 或增大 timeout。完整全量由root复跑，聚焦证据
`/private/tmp/deerflow-selection-markdown-green-stage30.{json,log}`。

Stage30 消息编译缺陷已在实际生产浏览器收口：独立 Linux fresh production 产物运行
thread-history-mermaid 原用例1/1 PASS（6.1s），全部原图/tokens/style/color 与新增工具栏/
行号/双主题断言通过。编译 server chunk 明确含 components/markdown/CodeBlock.vue、
github-light/github-dark 和 code-block-body，不含工具 renderer module；与真实 Nuxt
loader old/new 转换断言互相印证。证据
[evidence/2026-10-09-linux-stage30/mermaid.json](evidence/2026-10-09-linux-stage30/mermaid.json)、
[compiled resolution](evidence/2026-10-09-linux-stage30/compiled-markdown-resolution.json)。

Stage31 滚动布局修复期间复核：VirtualMessageList 继续唯一物理 scroll owner，MessageList 只
保留滚动意图与分页pending。当前真实组件 owner/virtualizer定向2文件17测试 PASS，保留
旧线程迟到完成、短列表与虚拟阈值、prepend锚点、内容resize/长工具折叠和尾部追随回归。
这组DOM测试模拟测量几何，不证明窄屏CSS；没有新增class自洽断言冒充真实布局证据。
新独立双端browser用例由artifacts owner验证原scroller identity、真实wheel与scrollTop、
长历史虚拟窗口与键盘focus。定向日志
[evidence/2026-10-09-scroll-owner-stage31.log](evidence/2026-10-09-scroll-owner-stage31.log)。

Stage30 历史Linux快照的8visual/12payload/asset与9图回读已经完整留档；当前Stage31源码
变动使该结论只对精确历史SHA有效，最终新源Linux/standalone仍待统一冻结后重新执行。
payload阳性renderer用例修复采样边界：等待真实Mermaid chart可见后才卸载CDP，避免将导航
SVG误当图表并提前停止下载观测；默认路由预算/原所有断言与预算不变。详见
[Stage30历史报告](2026-10-09-linux-stage30-historical.md)。

Stage31 非auth composer fixture 生命周期收口：只观察原生http.request的纯DOM调查精确
定位19条session +2条features外部请求，源于mode-icons/read-only/autofocus/compact四个
夹具未接管真实ComposerModelSelector→useAuthSession模块边界；compact还漏features。
四夹具现以文件级模块mock提供明确unauthenticated session refs，并逐例unmount/clear
QueryClient/flush后恢复globals；不全局mock fetch或吞console，不改生产认证gate。原
UploadLimits mock返回undefined违反公开合同，改为真实三字段数据，消除Querydata噪声。
同一观察器下4文件15原断言PASS且真实HTTP0、stderr0；与真实模型选择器/Gateway认证
恢复组件联跑6文件25PASS。完整canonical最终结果仍以root后续复验为准。证据
[unit网络根因与修复](evidence/2026-10-09-unit-network-stage31/analysis.md)。

### 2026-10-10 Stage31：逐消息 Token 调试归属消费者修复

当前 backend token_usage_middleware 将 token_usage_attribution 写入单条 AIMessage；React
message-list 对完整 messages 调用一次 buildTokenDebugSteps，processing/普通卡/subagent reasoning
再按真实 message id 取自己的步骤。Vue 原先只有末组 MessageTokenUsage 消费整轮消息，processing
没有用量端口，造成末尾卡混入工具行、工具步骤遗漏 No usage returned/总量，无 ID 消息误挂 debug。
真实组件回归先得到 7 项中 6 FAIL，再按相同归属合同修复；现归属 10/10、相关 21 文件 263 项与
独立 node 文档事实 19 项 PASS，app/tests types 与 scoped lint PASS。证据位于
`docs/reports/evidence/2026-10-10-token-attribution-stage31/`。

MessageList 只计算全局 debug 一次并投影，原 deriveAssistantTurnUsageState 整轮汇总保留；
ProcessingMessageGroup 用同一个 message map 分配工具 inline/纯 thinking inline/shared 首 eligible
摘要，ProcessingTokenSummary 仅消费已选择的步骤；折叠状态、共享归属去重、backend 精确 action
文案与 subagent reasoning 排除末尾重复均有真实 DOM 断言。MessageTokenUsage 新增可选
tokenDebugSteps，显式空数组不能退回整轮，独立旧消费者省略时保留旧计算。普通历史 debug 卡
在新 run streaming 时仍与当前 React 一样按全局 loading 隐藏，不凭推测新增差异。

生产 5 文件冻结于 2026-10-10 00:03:32 CST，详见 summary.json 精确指纹。新 SFC 库存为
346 产品 + 2 测试 fixture = 348，源码扫描无区外文件/英文硬编码，1828 key/64 unused 未变。
新增双端 token-attribution-reflow 正式 4 用例在 360px/root32 下逐 Text Range 验证共享文本/工具
摘要有用量和无用量时所有文案仍处于 consumer 与 clip 祖先边界，且保留完整 reflow survey。
其实际浏览器结果等待统一 fresh build；这段源码/DOM证据不外推任何旧快照或浏览器通过。

### 2026-10-10 Stage32：双端 inline Token 列宽根因

Stage31 新增的逐 Text Range 父列边界检查在真实两端产物上得到 2 PASS（有 usage）与
2 FAIL（无 usage）。React 的同一个 DebugStepLabel 左列只有 7.40625px，首个字形宽
19.890625px，文字压出所属列；Vue 左列23.40625px虽然能装下单字，但工具标题被迫排成
17行、679.734375px高。完整证据、截图、逐元素几何与源指纹位于
`docs/reports/evidence/2026-10-10-token-columns-stage32/`。

在相同真实 DOM 上仅注入 flex-wrap、标题 basis12rem 与 token max-width100% 后，
双端标题列恢复160/144px、3行；原4项严格摘要回归全部 PASS（8.9s），仍检查每个文本父列、
中间 clipping 祖先和完整 reflow survey，未改断言。正常桌面上两端 main 所有后代几何
diff 都为0。随后落实相同响应式 flex 约束到 React message-group 的 DebugStepLabel 及
Vue ProcessingToolStep/ProcessingTokenSummary/ProcessingMessageGroup thinking label。
4文件格式后生产冻结于2026-10-10 00:15:38 CST，定向4文件28项、双端 scoped lint PASS。

同探针另证工具按钮80px高，但滚动区只有46.016/58px，故按钮的ratio1失败不能被列宽修复
解释或宣称闭环。另一个根因是 header 已转为窄屏正常文档流而仍保留旧顶部占位；该根因由
artifacts owner 独立验证和修复。当前记录只证明同产物 CSS 提案红绿，最终源码需要fresh
canonical两端编译后的42严格浏览器回归，仍标PENDING。

Stage32c 的同源 canonical 两端构建后，完整42项严格浏览器回归已全部PASS（2.4m），
包含最强 shared usage/no-usage 4项、工具三终态逐列文字边界、真实键盘重入焦点、
90轮虚拟历史与原reflow四项断言。Stage32b两项原失败现场仍保留；opened按钮原本
已聚焦，resize后重复focus是DOM noop，正式fixture以ShiftTab→Tab产生真实focusin，
仍断言原ratio1、展开状态与可达性，不添加产品focus/滚动补偿。42项结果只对应该次
精确构建快照，后续生产变化仍需要自己的门禁。

## Stage 34 — standalone 注释词法 owner 修复

实际 `agent-save-hint.test.ts` 的 MessageList class-binding 正则使旧 strip-comments 把正则内双引号当字符串开头，后续两条注释引用误报 BLOCKING。已从共享词法 owner 修复：消费正则转义/字符类，跟踪表达式、控制括号、函数/类表达式与除法上下文；模板文本保留、插值代码扫描，所有换行/列位置保留。未改调用正则、扫描范围或豁免。

真实 RED 17 / 28 FAIL，真实 CLI 2 误报；最终新 33 cases +全部 7 个消费者共72 PASS，standalone-check 0 BLOCKING / 0 files / stale[]，lint/format PASS。独立 CLI 阴性证明真实跨应用 import 仍 exit1 /1 BLOCKING。日志与源码 SHA 见 `docs/reports/evidence/2026-10-10-comment-scanner-stage34/`。完整 canonical verify 由 root 重新执行，定向通过不代替全量。

这次只更改门禁扫描器及测试，不进入 Vue Nuxt 运行产物；Stage33 Linux 941 的宽清单包含该工具，因此其完成时零漂移成立，之后这一条 gate-only 字节变化单独记录，不能说宽清单永久与当前零漂移。实际 Linux 执行的 visual/payload/asset 输入没有改动。

## Stage34 引用弹层的真实布局边界

当前两端非 portal 引用弹层已统一按 visual viewport 与当前 overflow 裁切祖先的交集定位，实际 CSS margin 保留间距；打开期 ResizeObserver/原生事件是唯一几何更新 owner，关闭完整清理。Vue 补回 React 已有的 welcome suggestions suppression。真实组件 Vue32/React41、类型/lint PASS；旧 compiled 正式引用两端 RED 与临时注入双端 GREEN/desktop0diff 完整归档。root 统一 fresh compiled 正式引用两端 2/2 PASS（53.8s，direct0），包含每端三终态、操作前可见范围与原生键盘/pointer/全部 survey；不把注入/历史 Linux 结果外推。见 [Stage34 根因与证据](2026-10-10-reference-placement-stage34.md)。
