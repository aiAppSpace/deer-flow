# Vue 本期统一处理计划（三端复审后的执行版）

日期：2026-10-09。版本：v2。当前阶段：用户已授权严格执行，实施进行中；复审结论为实施前证据，运行结果见[执行记录](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-execution-status.md)。

## 复审结论与证据边界

**可以按本版计划进入实施。原稿范围方向正确，但不足以直接作为完整执行清单：有具体功能遗漏、部分工作包过宽、先后依赖不够明确，以及契约和验收可能产生假通过的地方。下文已补齐这些问题。**

本轮按当前 `frontend`、`frontend-vue`、`backend` 的路由、生产调用链、API 入参/响应、权限、状态生命周期、测试入口和部署配置交叉复核；文档仅辅助定位。重点修订包括：知识范围与来源、自定义 Agent 定义包、账户偏好和聊天时区、服务端会话来源/未读、调度消息与生命周期事件、合法 nullable gap、项目 instructions/附件交接、完整扩展宿主及针对性验收。

- 审查基准：`main = 5ecc1c2ac2de624af354bc515d5cb04f80df226c`；`main-wc / HEAD = a7804539530846baecf548af7b5d2612deb89b68`，同时审阅现有 Vue 未提交 WIP。
- 本轮未改业务代码，未启动服务、构建、运行测试或浏览器验收；不会把静态审查、既往测试或内存探针写成当前运行 PASS。
- 计划就绪与产品完成分别判断。下面的基准记录、回归、构建、真实 Gateway、双端功能/视觉验收均属于实施工作，当前为 UNRUN。
- 当前发现的契约缺口首先需要修正 Vue 接入；没有证据要求先重构 backend 或 React。实施若发现三端真实矛盾，按下述裁决规则解决，不能改基准或降低断言来迁就 Vue。

## 本期目标与任务关系

本期围绕两个主任务推进：

1. **Vue 架构优化**：修复状态与生命周期问题，整理职责和数据归属，完成历史工程负担清理。
2. **Vue 与 React 对齐**：在已确认的同步范围内，以当前 React 和 backend 代码为基准，达到功能、操作流程、行为和 UI 样式可平替。

稳定性、API 契约、持久化、异常恢复、验证和上游同步，是这两个任务共同的完成条件。不能只完成正常页面或新增组件，就宣布本期结束。

依据为当前源码，以及已完成的[整体审查](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-code-audit.md)。源码用于判断实现现状；明确约定的同步豁免属于任务边界。用户已于本轮再次确认以下三类不用同步，本期继续保留。

## 范围与基准

- 实施开始时记录 `main`、`main-wc` 和 React/backend 的实际比较 revision，保留当前未提交改动，区分已有代码与暂停前 WIP。
- 以 React 当前**实际可达**的页面、功能和交互为范围；只有类型、函数或休眠组件，不自动算作应新增的产品功能。
- 对齐范围包含 showcase、登录/setup/callback、全部 workspace 页面、扩展动态页面及产物独立查看。Vue 首页保持可用，但内容不要求复刻 React。
- **明确排除三类**：Vue 首页内容；docs/blog 内容站（四条 exemptRoutes）；`NEXT_PUBLIC_STATIC_WEBSITE_ONLY=true` 对应的整站无后端静态回放部署模式。它们不列入本期同步任务或对齐欠账。
- **showcase 仍需同步**：`/showcase/[thread_id]` 是公开只读案例页，不属于整站静态回放模式豁免。
- 范围定义沿用 [react-parity-scope.json](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/baseline/react-parity-scope.json:9)。React 零消费者模块的禁止移植规则与功能豁免分别处理，按当前调用链核实。
- Vue 采用现有 Nuxt、composables、Vue Query、Reka 和 agent-core 分层，优先复用已安装且已使用的能力。
- 对齐用户可观察的功能、交互、样式、权限和数据结果。框架内部 DOM、源码拼写及无副作用的请求组织差异，应说明影响，不强求实现形式相同。
- 如实施期间基准代码更新，补做增量核对，再给最终验收结论。

### 三端基准的裁决规则

1. backend 的 handler、validator、权限检查与契约测试定义有效 wire 契约；React 当前可达界面定义功能、操作流程和 UI 基线；Vue 使用自己的框架表达相同行为。
2. 三端出现差异时，分别核对“客户端请求”“服务端实际解释”“用户最终结果”。不直接复制 React SDK 私有状态、无效参数或被服务端覆写的字段，也不为简化 Vue 放宽后端权限/schema。
3. 例如 knowledge scope 的编辑重跑：React 可传当前选择，但 backend recovery 使用原 turn 的 scope。Vue 必须保留服务端的原范围语义，不能把逐字段复制请求当成授权依据。
4. 无运行证据的疑点记为待验证；真实共同缺陷才做最小 React/backend 修复，并补该端规定的测试。默认改动落在 Vue；不为对齐建立跨框架组件抽象或重写已有后端能力。

### 当前入口清点

静态路由清点：React 21 个 page 文件，扣除四条 docs/blog 豁免后为 17 条；Vue 16 个 page 文件，扣除两个 `__m0` 测试页后为 14 条。当前缺失的三条产品路由如下，`pendingRoutes` 仍为空，不能据此声称当前已对齐。

| 当前缺口 | 依赖的完整功能链 |
| --- | --- |
| `/workspace/capabilities` | 能力目录、平台/个人权限、MCP/Skill/集成状态与动作、设置迁移 |
| `/workspace/trash` | 文档回收列表、恢复目标、合并、永久删除与部分失败恢复 |
| `/workspace/extensions/[namespace]/[surface_id]` | 扩展模块加载、页面宿主、导航与动作权限、卸载清理 |

其余已存在路由仍需逐项检查功能状态，不能以“同名页面存在”推定其内部已经对齐。实施期将这些缺口列为 pending，只有实际接线并完成对应验收后才能清空；不加入 exempt。

## 一、稳定性与数据正确性：本期必做

| 待处理项 | 当前依据 | 完成条件 |
| --- | --- | --- |
| 取消与销毁分离 | runner.abort 永久退订，创建失败后重试失去快照通知；已内存复现 | 取消/失败后能再次提交并持续更新；卸载释放订阅；补真实行为回归 |
| 产物保存快照 | 保存 A 期间编辑 B，返回后 B 被标为已保存；已内存复现 | 按 React 在保存中锁编辑，按提交快照确认 baseline；保存失败/412/离开保护正确 |
| 异步返回身份 | 后台任务 A 请求返回时按当前 B 路由写缓存；已内存复现 | mutation 捕获请求 thread/user/scope 身份；切换后不污染其他 key；新 scoped MCP WIP 同步修正 |
| 预览任务清理 | HTML 预览切换/卸载后旧续体可能创建 URL；当前为源码推导风险 | 延迟资源请求后切换/卸载无旧回写，URL 成对释放；补针对性测试 |
| gap 与恢复输入 | Vue 拒绝 backend 合法的双 null 游标 gap，durable reload 错误被吞；run input 尚未用于恢复原始 human | 覆盖有游标/无保留流两种 gap、终态 observer end、durable 失败和 checkpoint 落后；不重复 create、不丢 human、不产生假完成 |
| 提交消息身份与附件 | Vue staged files 会被本次上传覆盖；optimistic 与 wire human 没有统一稳定 ID | 本地上传与项目文件同时保留，optimistic/wire/echo 可归并到同一消息；成功只退休本次快照 |
| 输入锁定一致 | 技能 contenteditable 与普通 textarea 使用不同锁定条件 | 上传、润色、执行命令、提交等状态下，两种 editor 按 React 一致锁定与恢复 |
| 其他异步 owner | 当前多个组件有 generation/controller/reset | 在本次修改链路中复核取消、卸载、切线程和重复操作；统一 owner，避免新增同类问题 |

这些缺陷的证据和限制详见[审查优先问题](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-09-vue-code-audit.md:53)。内存复现不能替代最终浏览器回归。

## 二、功能与入口完整对齐：本期必做

建立一份简洁的对应表：`范围内 React 路由/入口 → 关键场景 → API/状态 → Vue 实现 → 验证结果`，由当前源码和已确认范围生成初始清单并人工补充状态分支。复用现有场景体系，避免再维护多份互不一致的完成台账。

| 功能域 | 本期处理范围 |
| --- | --- |
| 页面和导航 | 补齐 capabilities、trash、extensions 动态路由；核对 showcase、鉴权、工作区与产物查看等范围内页面；保留 Vue 自有首页，不移植 docs/blog |
| 设置与能力中心 | 跟随当前 React 设置分区补 models，迁移 tools/skills/integrations；能力管理、安装/导入/导出、启停、作用域/权限与刷新形成实际链路；旧深链按当前 React 行为处理 |
| 模型与输入 | reasoning、收藏与管理、模式、skills、mentions、conversation references、草稿、文件、语音、润色与提交 payload；完成已有 WIP 接线 |
| 账户偏好与身份 | session-only preferences、按用户隔离的缓存/待同步修改、字段级 PATCH、locale 上报；主题等本地设置继续按当前 React 的持久化边界处理 |
| 知识范围与来源 | 普通/Agent 会话的范围选择、目录搜索/分页、Agent 默认范围、当前 human 快照、恢复原范围与消息来源展示；与 conversation references 分开 |
| 自定义 Agent | display_name、画廊/会话展示、定义 JSON 导入/改名/冲突/导出、模型与能力/知识默认值；稳定 name 仍用于 URL/API |
| 会话与历史 | 普通/Agent/创建/showcase、分支/编辑重跑/停止、历史分页、压缩后内容、active-run adopt/join、run input 水合、刷新及跨标签页恢复；来源/未读/活动 feed |
| 项目与文档 | chats/documents/instructions/settings 四 tab；instructions 保存；文档上传/会话提升/预览/原始下载/附加/回收及权限；不新增 React 没有的文档架正文编辑 |
| 计划任务与后台任务 | 表单/列表/详情/运行结果/续期 WIP，queued/launching/running、分页/轮询/取消、聊天卡片/计划 prompt/生命周期事件、通知展示与聊天默认时区 |
| 产物、浏览器与 Sidecar | 独立查看、预览/编辑/导出、草稿冲突、面板互斥/恢复、浏览器连接状态、Sidecar 会话与权限；核对当前新增行为 |
| channel、集成、memory、subagent | 对照当前 React/backend 的实际入口、流程、状态与错误；能力中心迁移复用集成流程 owner |
| trash 与扩展 | 回收站恢复/合并/永久删除/部分清空失败；扩展发现与安装指引、模块/页面/导航/会话与侧栏动作/@mentions；不新增网页安装 Python 部署包 |
| showcase 专项 | 同一案例的内容、样式、只读交互与产物展示双端对照；作为固定案例验收样本，按下述专项完成条件收口 |

暂停前新增的模块要逐项核对“只有实现”“已经接线”“已经验证”的状态。完成新入口和状态 owner 替换后，再清除旧 UI；暂时零消费者的 WIP 不列为历史废代码。

当前入口差异的源码示例：[React 页面目录](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/app/workspace/capabilities/page.tsx:1)、[React 当前设置分区](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/settings/settings-dialog.tsx:134)、[Vue 旧设置消费](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/components/workspace/settings/SettingsDialog.vue:302)。

### showcase 专项完成条件

用户明确要求 showcase 对齐好。本项为本期必做，当前仅确认范围，尚未实施或完成验收。

1. **案例及资源一致**：核对当前 React 登记的全部案例 ID、消息/工具调用/产物数据及资源映射；两端同一案例能正确打开和刷新，未登记 ID 按 React 返回 404。原始案例正文和文件内容保持上游文本，语言切换只跟随 React 实际翻译的部分。
2. **内容与 UI 一致**：在相同案例、语言、主题、窗口尺寸、字体和稳定加载状态下，比较消息顺序、推理/工具折叠、当前案例实际包含的 Markdown/代码/表格/图表，以及产物卡片和预览；布局、颜色、间距、字体、图标和状态样式均需核对。
3. **只读交互一致**：按 React 的实际可达控件验收展开/收起、滚动、复制、导出、下载及产物查看等行为；保持不提交新消息、不修改会话、不保存产物的只读限制，核对隐藏/禁用的工作区控件。
4. **双端证据完整**：全部登记案例完成可达性和资源检查；选取覆盖现有内容/产物类型的代表案例完成桌面/手机、双语/主题截图和关键交互对照，复用现有 `showcase-public-thread` 场景补足覆盖。发现差异后修实现，不扩大过滤或直接接受差异基线。

showcase 可作为固定数据的渲染和只读交互验收样本；发送、停止、断流恢复等工作区行为仍按各自场景验证。Vue 首页内容、docs/blog、整站静态回放模式继续豁免。

## 三、架构优化与历史工程负担清理：本期必做

| 整理项 | 本期目标 |
| --- | --- |
| 消息虚拟化 | 采用现有 Vue Virtual 动态测量，统一历史 prepend 锚点、追尾、目录跳转与活动组保留，跟随 React 当前交互 |
| 聊天编排 | 拆 AgentChat 的会话操作、Agent 创建、面板协调；拆 ChatComposer 的语音、润色、命令、上传提交；拆 MessageList 的滚动/虚拟化和消息交互 |
| 状态归属 | 保持一个输入草稿 owner、一个产物草稿 owner、一个 session 生命周期 owner；集中 reset/generation，纯派生不再维护可写镜像 |
| 缓存与 feature flags | 复用 Vue Query 去重和管理服务端状态；收掉 useWorkspaceFeatures 的重复手工缓存；统一 mutation 身份和失效范围 |
| 集成流程 | Lark 授权状态/窗口/轮询/取消抽出可复用 owner，旧设置迁移后不复制另一套流程 |
| 孤立代码与重复模型 | 逐项核实审查清单中的 thread-context、旧 proxy policy/builder、孤立 keyboard/upload adapter、旧 artifact editing 等；保留有真实消费者的实现 |
| 重复算法 | 统一 workspace change anchor 等“纯 helper 有测试、生产又 inline 一份”的逻辑，先核对混合消息边界，再移除重复实现 |
| 历史叙事与门禁 | 精简源码中的历史轮次、固定规模和整文件行数叙事；合并必要断链检查；将妨碍合理重构的拼写断言转为必要结构或行为验证 |
| UI 适配 | 保留基础无障碍；菜单内部 DOM、tabstop、路由播报及聚焦滚动补丁分段验证，证明公开组件能力可替代后收缩 |

清理不按文件数量或行数设指标，也不以减少测试数为验收目标。阶段产物是职责明确、实际生产消费者可追踪、重复实现被收敛，并且功能与 UI 验收保留。

### 重构后的职责落点

沿用现有目录和工具，按每个功能包渐进完成；拆分以状态所有权和独立生命周期为依据，不把长文件机械切成多个相互读写的文件。

| 当前集中点 | 实施后的职责 |
| --- | --- |
| AgentChat | 保留 route/Agent/project 输入与页面编排；会话操作、Agent 创建、面板协调各自持有明确 owner，run/session 只由 useThreadStream 链管理 |
| useThreadStream / runner | 持有本次会话与 run 生命周期、取消/销毁、恢复；消息提交/合并纯规则和 history 查询边界明确；组件不另存可回写 run 镜像 |
| ChatComposer / useComposerDraft | 一个草稿/附件 owner；语音、润色、命令、上传各自可取消，提交捕获身份/快照；其余选择状态纯派生 |
| MessageList | 消息分组与展示；虚拟测量/滚动/锚点归单独 owner，消息动作归操作链；调度事件随所在 measured row 测量 |
| ArtifactPanel / useArtifactDraft | 一个编辑草稿/baseline owner；加载/保存请求按文件身份；preview controller 负责 URL/worker/iframe 的释放 |
| 设置/能力/集成 | 服务端状态由 Vue Query，账户设置有 owner 与待同步修改；MCP/Lark 等流程 owner 可复用，UI 仅消费 |
| app/core 与 packages/agent-core | app/core 承担已有规则、类型、请求适配和清晰标注的桥接；agent-core 保持框架无关的协议/runner/reducer 公共边界 |

每次替换同时更新消费者和相关测试，不留下两套可写 owner 并行；只有新链路通过对应回归后，才能移除旧链及只为旧实现拼写存在的门禁。

## 四、API 契约与数据恢复：实施前置项

- 先核对当前 backend 契约，再动功能/owner。OpenAPI 导出和 types 刷新提前到首轮，不留到末尾清理。
- 使用当前 checkout、受控配置和隔离 runtime home 导出核心 OpenAPI，显式控制 webhook 路由并固定 `plugins: []`；另用受控样例验证扩展贡献 API，不能把开发机私有插件混入核心 snapshot。沿用现有 generator，形成 backend → snapshot/contract → type → 实际 Vue consumer 的关联。
- 当前 snapshot README 中“只有 webhook 一个条件路由”的说法已过时：Gateway 构造期会加载 Python extensions，末尾注册贡献路由。实施需修正导出说明、加入可重复的隔离导出入口和新鲜度核对，不照抄旧命令读取本地私密配置。
- REST 之外，核对 SSE 动态事件、JSON contracts、run create/join/cancel、错误信封与新增上下文字段；不能用 OpenAPI 生成幂等证明流式或全部 API 已对齐。
- 检查本轮涉及的 query key、请求取消、分页、数据失效与权限/作用域；每次 mutation 的结果归属于发起时的身份。
- 对主题、语言、模型选择/收藏、用户设置、输入草稿、Agent/project 上下文、面板尺寸、会话历史逐项核对持久化边界；刷新、退出重登、切用户/线程/Agent、跨标签页按 React 行为验收。
- 附件等短期资源是否保留，以 React 当前实际行为为准，不能笼统要求所有状态持久化。
- 异常验收覆盖相关链路实际支持的离线/超时、鉴权失效、权限拒绝、资源消失、冲突、流中断、部分上传失败、授权窗口关闭/过期及请求中切路由；验证处理后能继续操作。

现有生成检查的输入仅为签入快照：[gen-api-types](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/scripts/gen-api-types.mjs:30)。本期沿用现有工具补新鲜度核对，无需重写所有无关 API。

上述扩展路由依据：[构造期扩展加载](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/app.py:1152)、[注册贡献路由](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/app.py:1351)。调用 `openapi()` 不等于完成 Gateway 启动、权限或数据库迁移验收。

### 必须分开的消息与授权契约

| 数据/操作 | 正确归属及验收约束 |
| --- | --- |
| HumanMessage ID 与 files | 本次提交生成稳定 human ID，optimistic/wire/服务端 echo 可合并；staged 项目 files 与本次上传合并，不能覆盖 |
| conversation references 展示元数据 | 仅用于引用展示/草稿恢复，不授予后端访问权 |
| conversation references 访问授权 | 本次显式发送的独立参数，由 backend 校验来源/owner/工具/数量；清除 stored context 的旧授权，replay 不隐式重授予；当前上限 3，同时核对 feature 返回值 |
| Skill references | 按 slash skill contract 校验注册、启用、Agent 与动作权限；当前上限 16，非法项不能造成半批激活；保留 typed slash 现有行为及历史使用快照 |
| knowledge_scope | 只放当前唯一新 HumanMessage 的 additional_kwargs；新 turn 可继承 Agent 默认，recovery 恢复服务端原 turn 范围，不能当 conversation grant 或 run context |
| extension mentions | 保留 namespace/provider/id，走扩展自己的 backend action 与 owner 检查；不能凭展示文本授权 |
| context.client_timezone | 浏览器 IANA 时区，用于聊天创建计划任务的默认值；不是账户 locale，也不是知识范围 |
| reasoning_effort | 模型/run 的 provider token、账户 preference 的开放 token、Agent 保存的 low/medium/high/null 三套契约分开；不统一收紧 enum，也不擅自放宽 Agent schema |
| deerflow_origin | 服务端创建 run/thread 的来源，用于来源标记与活动刷新；依当前 contract 及 legacy fallback 解析 |
| deerflow_scheduled_origin | message-level 计划 prompt 标记；不得冒充 thread origin，不把隐藏启动文本当可编辑普通 human |

出处：[提交与 context](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/core/threads/hooks.ts:188)、[当前知识范围 admission](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/knowledge_scope_admission.py:88)、[账户偏好 schema](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/user_preferences.py:17)、[来源 contract](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/contracts/thread_origin_contract.json)。

### Run 协议的专项边界

- 创建流需要显式网页 `on_disconnect=continue`；离开页面/销毁 observer 不等于请求停止。explicit stop 与本地 abort/dispose 分开，cancel 的 202 表示可能仍在停止中，204 与 409 按 handler 实际结果处理，不一律直接写成终态。
- 保留当前支持的 stream modes；不发送 backend 不支持的 `stream_resumable=true`，不复制 SDK 私有 storage pointer。
- `gap` 支持有保留游标和 earliest/latest 均为 null 两种合法形态。重读 durable thread/run/input 后 observer join 同一个 run，按 `latest ?? undefined` 续接到 end/明确协议终止，不重新 create。run status 已终态不代表 SSE 尾帧/最终化完成，不能据 status 跳过剩余 error/其他尾帧。双 null 且流已清理时，join 由 backend 返回 end；普通终态 observer 的 end 与幂等创建重试的 gap 分开。
- durable reload 失败不能吞成“没有数据”。checkpoint 尚无本次 human 时，使用当前 run 的 input 水合，和 history/optimistic 按稳定身份合并，保留中断、重试与恢复反馈。

源码：[backend 无保留流 gap](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/services.py:2495)、[Vue 当前 strict parser](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/agent-deerflow/gap.ts:18)、[Vue 当前吞掉 durable 错误](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/core/agent-deerflow/gap-recovery.ts:209)、[observer join](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/thread_runs.py:1405)、[先写状态再发布 error](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/packages/harness/deerflow/runtime/runs/worker.py:1605)、[最终 publish_end](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/packages/harness/deerflow/runtime/runs/worker.py:1906)。

## 五、UI、交互及部署入口验收：本期补齐

| 验收面 | 条件 |
| --- | --- |
| 对照环境 | 同一 Gateway、数据、权限、Chromium、字体、viewport、主题、语言；控制时钟/动画等噪声 |
| 基本矩阵 | 中英双语 × 明暗主题 × 桌面/手机；范围内路由至少有可达性/功能覆盖，按页面的真实主题限制验收；首页只验自身入口可用性 |
| 状态覆盖 | loading、empty、error、selected、disabled、hover、focus；关键弹层、菜单、抽屉、表单和多面板展开态 |
| 视觉 | 双端同环境截图，加现有语义/几何探针；检查布局、字体、颜色、间距、边框、阴影、图标和滚动容器，不只比 Vue 自己前后的截图 |
| 复杂布局 | 对输入、弹层、多面板测试窄屏、低高度、文本放大、resize；保留键盘导航、焦点归还与控件可达性 |
| 路由与恢复 | 直接访问、刷新、站内跳转、返回、深链参数、404；实际任务运行中刷新/切换后状态正确 |
| 本地运行 | dev-vue/dev-dual 当前 Vue 直达 3100；生产使用 serve.sh --prod --vue；Docker 经 vue.localhost:2026 的 Nginx host 分流；分别验证，不能混写入口；Vue 生产运行不依赖 React 源码目录 |
| 成本与回归 | 使用现有 asset budget，并记录必要的构建/场景耗时和关键长会话表现；收益以测量为准 |

视觉允许浏览器字体栅格化等已说明的非产品噪声；不允许用提高阈值、扩大过滤或接受新差异来掩盖布局、样式及行为问题。双语/主题组合可按页面状态参数化，避免重复复制测试。

本地入口检查依据：[root dev-vue/dev-dual](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/Makefile:159)、[serve Vue 启动分支](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/scripts/serve.sh:340)。本地通过与生产 DNS/TLS、真实外部 IdP/第三方账号验证分别报告。

## 六、测试可信度与后续上游同步：本期补齐

- 修 `e2e-list` 吞掉收集失败，做一次负向验证证明失败能返回非零；正式对照要求 React 存在，局部诊断不替代完整验收。
- `standalone-sim` 当前会 rename 正在使用的 React checkout。先改为隔离副本再运行，验证 install/build/test 与既定独立 E2E；既有工作区及运行中的 React 不应被验收工具移走。这项属于验收正确性必做。
- 把本期范围内的 pending 和 auth 差异逐项收敛，保留已明确确认的三类豁免；框架必然差异需说明其不影响用户行为的依据，不能擅自新增或撤销功能豁免。
- 给本轮生命周期/身份/保存问题补有效行为回归；保留协议、缓存竞态、权限、代理及键盘等已有保护。
- 在现有 Playwright/CI 中补双端关键视觉回归，解决 Linux 基线/字体一致性后正式接线；不能只有手动生成基线。
- 给现有 verify/mock/real/external job补失败 trace、截图、视频与必要日志上传，复用既有归档方式；核对失败后能获取现场。
- 收缩 audit 仅按包名识别问题的盲区，至少能区分新 advisory 和影响版本；保留已有可达性判断。
- 上游 marker 只在对应改动实际审阅、实现与验收后推进；backend/contracts 的审阅范围单独核对，不能假定前端 marker 已覆盖它们。
- 缺少 React、marker 历史不可达或有未提交基准变化时，区分“无法判断/未验证”与“无漂移”；同步记录最终 revision 和验证范围。
- 同步必要开发/运行文档与实际命令、入口、模块边界；清除过时完成叙事，保持下一次同步有可复用入口。

当前缺口依据：[e2e-list](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/Makefile:340)、[现有视觉 CI 分支](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/.github/workflows/frontend-vue-verify.yml:255)、[已有 parity 失败上传](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/.github/workflows/frontend-vue-parity.yml:165)、[marker 历史缺失分支](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/scripts/upstream-drift.mjs:105)。

## 七、可在本期顺手完成的成本优化

相同构建参数的产物复用、共享 E2E 终态准备，可以与历史负担清理一并做。不同鉴权、代理开关、degraded Gateway 等拓扑继续保留；优化前后核对实际时长及覆盖。独立检查隔离副本已列为必做，不能作为可选提速跳过。

这类提速不阻塞主要产品修复，沿用现有构建、测试和 CI 工具，优先完成已定位且边界清楚的简化。

## 实施顺序

所有下列工作包均为本期必做；顺序表达依赖，不代表后面的项目可省略。已有行为通过对照即可保留，缺失或有差异才修改；不要求为每项重新写一套实现。可选提速仍只限上一节。

| 工作包 | 前置依赖 | 交付边界 |
| --- | --- | --- |
| W00 基准、契约与可信验收入口 | 无 | 范围/WIP/起点、受控 schema、退出码、隔离验收 |
| W01 鉴权、账户偏好与 features | W00 | 用户身份边界、服务端偏好、能力状态 |
| W02 run、消息提交与恢复 | W00、W01 | cancel/dispose、gap、稳定 ID、附件合并、run input |
| W03 产物与预览 | W00、W01 | 保存快照、冲突、资源清理、独立查看 |
| W04 输入与模型 | W01、W02 | reasoning/收藏管理、引用、草稿、输入锁定 |
| W05 能力中心、Agent 与知识 | W01、W02、W04 的提交边界 | 完整入口、权限、定义包、知识范围/来源 |
| W06 会话历史、来源/未读与虚拟化 | W02；消息快照复核结合 W04/W05 | 分支/历史/adoption、活动 feed、滚动 owner |
| W07 调度、后台任务与 channel 通知 | W01、W02、W06 | 页面/聊天两条链、队列与运行结果、事件定位 |
| W08 扩展完整宿主 | W01、W04、W05、W06 | 模块、页面、导航、动作、mentions 生命周期 |
| W09 项目文档与回收站 | W01、W02、W03、W04 | 四 tab、instructions、附件交接、trash 分支 |
| W10 浏览器、Sidecar、memory、subagent | W01、W02；面板协调结合 W06 | 全部现有面板与配置的状态/权限/交互对齐 |
| W11 showcase 与完整 UI 对照 | W03–W10 的相关渲染链 | 全案例、只读交互、双端样式证据 |
| W12 历史负担与 CI 收敛 | W00 起并行；删除依赖对应链路已替换 | 旧代码/门禁/文档整理、视觉 CI、失败现场 |
| W13 全量验收与同步收口 | W00–W12 | 本地/CI结果、运行入口、最终 revision/marker |

### W00：固定事实与契约，建立可信起点

- 记录 `main/main-wc/HEAD`、当前 React/backend revision、Vue tracked/untracked WIP 清单和内容指纹；在当前 `main-wc` 继续，不 reset、不覆盖 WIP、不为提交开新分支。
- 复用现有 scope、product-surface、scenario-coverage 维护唯一的范围清单；按实际 React 路由与交互补场景，三条缺路由进入 pending。保留三类既定豁免；静态模式当前只有范围元数据，不能宣称存在模式级自动断言。
- 核对四节契约，导出受控 OpenAPI 并生成类型；对新增调度、来源 contracts 完成真实消费者映射。当前 generator 将 scheduled_goal_notes、scheduled_task_errors、thread_origin 列为 NOT_CONSUMED，迁移相应功能时必须改为实际生成与消费，不能只改登记表。
- 先修 `e2e-list` 退出码和正式 parity 缺 React 时的失败/未验证语义；将 standalone-sim 改为隔离副本。负向验证检查器确实会红，然后记录当前静态/单元起点，保留失败原因，不把已有失败重记成基线通过。

依据：[契约生成登记](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/scripts/gen-contract-constants.mjs:49)、[产品面门禁](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/parity/product-surface.test.ts:99)、[standalone 当前 rename](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/scripts/standalone-sim.mjs:143)。

### W01：账户身份、偏好与服务端能力

- 建立登录/退出/切用户时统一的 owner boundary；接 session-only `/api/v1/auth/preferences`，发送 `X-Expected-User-Id`，按用户隔离缓存、待同步修改和返回结果。auth-disabled 不请求 session-only API。
- 部分 PATCH 只发送已改 key，null 按后端清空语义；204 不解析 JSON。403/409 停止旧账户同步，503/断网保留待同步修改并可恢复；跨 tab 不覆盖另一个 key 的修改。
- 接入模型、模式、reasoning、通知偏好与 locale。locale 只在 preferences 响应表明支持该字段时，于登录/语言切换上报，兼容旧 Gateway；验证它对计划任务通知语言的实际影响。主题、布局等本地状态按 React 保留各自边界。
- features 复用 Vue Query 管理，保留每种 capability 自己的 loading/错误/legacy 默认策略：scheduled available/running/toolEnabled 分开；thread_activity 不可用不 poll/post；subagent repository/worker 分开；knowledge/references/browser/MCP 不合并成一个总开关。

最小验收：A 请求飞行时切 B、旧 outbox、auth-disabled、403/409/503、不同 key 的跨 tab 修改、未知 effort token 与 locale；feature 缺字段/失败/关闭/有仓库无 worker。出处：[React 偏好 owner](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/core/settings/user-preferences.ts:63)、[backend session 与预期用户](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/user_preferences.py:33)、[features 实际能力](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/features.py:106)。

### W02：run、提交消息与恢复正确性

- 先补失败回归再分离 runner 的 cancel、explicit stop、dispose；取消或创建失败后再次提交继续有 snapshot 通知；销毁清理订阅和 observer，不能取消服务端其他连接的 run。
- 实现四节的 nullable gap/durable failure/终态判断/run input 水合；同一 run 只 join，创建重试沿用幂等身份，不额外创建新 run。清 transient 与载入 durable 的顺序保持正确。
- 统一 human ID 与提交快照，合并 staged/本次上传文件；持久/乐观/echo 按身份去重。成功只退休本次提交的草稿/附件，失败可重试；切线程后的上传、润色、mutation、MCP 结果不回写新 owner。
- 然后收敛 useThreadStream 的 session/reset/generation 与派生镜像，保留 history/checkpoint/gap 职责，不在重构中换掉既定 agent-core 公共接口。

最小验收：两种 gap、observer end、terminal status 但尚无 END/仍有 error 尾帧、durable 失败、create 重试、202/204/409 stop、失败后再次提交；项目+本地附件同时发送；checkpoint 落后时刷新 human 不丢不重复。扩展现有 [runner 测试](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/unit/agent-deerflow/thread-runner.test.ts)、[gap 测试](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/unit/agent-deerflow/gap-recovery.test.ts)、[提交测试](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/unit/threads/submit.test.ts)，再跑 stream/protocol/real E2E。

### W03：产物、编辑保存与预览资源

- 保存中按 React 锁 editor，以提交的内容与返回 sha 确认 baseline；不能用 await 返回时的当前草稿确认。覆盖失败、412、取消/切文件、离开保护、只读/showcase 和独立查看。
- HTML 预览所有异步续体受 generation/abort/dispose 约束；blob URL 成对释放，切到非 HTML 或卸载后不允许旧任务创建 URL/回写。
- 核对 code/Markdown/HTML/image/audio/video/PDF/图表/CSV/TSV 等当前 React 实际预览、截断、流中 pending 与导出操作；表格 worker、分页、超时和资源上限保留，不把预览转换稿误作原始下载。
- ArtifactPanel 的加载/保存/预览协调与唯一 draft owner 分开；全局面板协调留给会话编排 owner，避免产物组件反向持有会话状态。

最小验收：保存 A 期间编辑尝试、保存失败/412 重载、切文件/卸载后的延迟完成、截断只读与下载、项目文档复用预览。依现有 [draft lifecycle](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/unit/artifacts/artifact-draft-lifecycle.dom.test.ts)、[预览测试](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/tests/unit/core/artifacts/preview.dom.test.ts) 与 real artifact-write/browser 场景验收。

### W04：输入、模型与多类引用

- 完成暂停的 reasoning/收藏/管理/mentions/references/draft WIP 接线，核对 `/models` 能力、权限/fallback、provider values/default/aliases、thinking required/unsupported 与 Agent null 继承。分别断言 UI、保存请求、后端最终策略。
- 按四节将 display metadata、conversation grants、Skill activation、knowledge scope、extension mentions 分成不同类型与发送通道；草稿可以统一 owner，权限不能统一成一个字段。
- conversation references 本次显式授予，清除 stored context 中旧授权，replay 不重授予；Skill 校验整批原子处理，保留 typed slash；修改/删除 Skill 后历史使用快照仍可读和复制。
- 普通 textarea/技能 editor 在上传、润色、语音、命令与发送中按 React 一致锁定/恢复；拆出语音、润色、上传提交 owner，保留草稿跨路由的真实语义。聊天带 IANA client_timezone，不能只修调度页面。

最小验收：3/4 conversation、16/17 skills、重复与非法项、来源删除/跨用户、catalog 失败、伪造本地 context、`max`/自定义 effort、模型切换与权限变化、两种 editor 锁定、语音/润色中切线程、发送失败及重试。出处：[React per-send context](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/core/threads/hooks.ts:248)、[backend 引用校验](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/conversation_access.py:138)、[Skill 校验](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/packages/harness/deerflow/agents/middlewares/skill_activation_middleware.py:292)。

### W05：能力中心、Agent 定义与知识链

- 补 capabilities 页面和菜单/命令面板；models 放当前设置，tools/skills/integrations 迁入能力中心。旧 `?settings=tools|skills|integrations` 当前 React 不认可且不自动跳转，Vue 跟随该行为；关闭设置保留其他 query 与焦点归还。
- 完成平台/个人 MCP、普通用户安全投影、管理员配置权限；安装、启用、配置、授权分状态；复用 Lark popup/poll/取消 owner。Skill 导入/导出/预览 revision 冲突按当前后端处理，导出 409 后提示变更并禁用旧 manifest 下载，用户显式刷新预览后才能再次下载，不自动刷新或重试下载。
- Agent display_name 按 100 个 Unicode 码点，稳定 name 不变；补定义 JSON 导入、改名冲突和服务端导出。导入 create-only，409 不覆盖；导出排除凭证、部署绑定、memory 和会话。
- knowledge scope 单独建立类型/目录/query/选择器，接普通与 Agent 会话、Agent 默认值、当前 human 快照、恢复原范围、消息范围摘要和知识来源；按 provider/Agent tool groups/权限 gate，不能只补字典。

最小验收：管理员/普通用户、个人隔离/密钥遮罩、重复 installation ID、未改选择不提交、授权窗口关闭/过期；Skill revision 409；Agent Unicode/409/422；知识 all/none/selected、数据集/文档搜索分页、不可选项、409/503、Agent 切换、新建 ID 转换及 recovery 不扩大范围。对应：[React 能力权限](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/capabilities/plugin-gallery.tsx:179)、[Agent 导入导出](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/agents.py:348)、[知识目录](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/knowledge.py:66)。

### W06：历史、来源/未读与消息虚拟化

- 逐项对照普通/Agent 会话的编辑重跑、regenerate、分支 lineage/checkpoint、历史分页、压缩后显示、active-run adopt/join、归档/搜索/列表排序。现有已正确行为保留，不能在统一 owner 时退回旧快照覆盖新状态。
- 实现 thread origin 与 legacy fallback、来源图标/标签、未读点、`/api/thread-activity` cursor/read_version 与 mark-read。sidebar 只持有一个 poll owner，卸载/切用户重置；首 poll 种游标，truncated 继续推进，交互 run 不误触发服务端来源更新。
- 打开会话加载完成、未读变 true、标签页恢复可见、stream/join 完成时按 React 标已读；feature 不支持时不请求。SQL-only 由 features 判断，不能把不支持当“没有未读”。
- MessageList 使用现有 Vue Virtual 动态测量，支持 prepend 锚点、追尾/暂停追尾、目录跳转、活动组保留、resize/折叠和长工具输出；为 W07 生命周期事件保留同一 measured row 内的 after-group 位置。统一 workspace change anchor，先核对混合 AI/tool turn 边界。

最小验收：历史 prepend/分支/刷新无重复、流中切换、服务器创建新会话自动出现、跨设备 read_version、游标截断、打开会话不亮未读、不可用无请求；不同高度消息与事件下滚动稳定。出处：[React activity](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/core/threads/activity.ts:26)、[origin 投影](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/core/threads/origin.ts:73)、[backend feed](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/thread_activity.py:72)。

### W07：计划任务、聊天调度与后台任务

- 当前新 run-history hook 已存在 WIP，但页面仍消费旧 infinite hook。完成新表单/详情/续期/结果组件接线后替换旧链，不能将“函数已写”计为完成。列表搜索/tab、`?task_id`/`?thread_id`、详情/404、重复/删除/续期按 React 实际流程。
- 一次性时间保留原 run_at 精度与 DST fold，直到用户实际修改且未恢复；interval 未编辑保留原秒值，编辑后的最小值按当前 capability，不能无条件取整 60。PATCH 只改字段；省略 assistant_id 保留，null 重置。
- 表单包含 fresh/reuse thread、Agent 选择、goal、stop condition、max_runs 与 end_at；goal 仅 fresh thread 可保存，复用会话不能绕过该限制。清空 goal/stop condition/限额/end_at 用 null，未改字段省略；限额与结束时间续期不暗改其他排程或 Agent。
- 区分 task 与 occurrence 状态、queued/launching/running、unmet 与 failed、自动次数/限额/续期。queued 可经 pause/delete 取消；launching/running 受冲突约束；暂停任务手动触发仍按当前后端允许的行为。repository available、scheduler running、chat toolEnabled 分开。
- history 请求 51 显示 50，按 task/page key，不累加旧页；仅 page 0 轮询/focus/reconnect，切任务重置，传 AbortSignal，旧页不主动刷新；活跃终态更新 task 摘要。
- 聊天 `schedule_task` 结果渲染 live card，同 task/turn 取最后一张且不切 turn；scheduled human 使用来源结构、不可编辑，不显示隐藏启动文本。生命周期事件独立查询，任务删掉仍显示 title snapshot，按消息位置插入 measured row，不以当前任务列表是否存在为门控。
- channel 页面和设置中的 proactive_notifications 按字段存在性展示；locale/timezone 与 W01/W04 联验。后台 MCP 任务取消修复发起身份，终态但通知 pending/retry 时详情仍更新；subagent worker 停止不能抹掉历史。

最小验收：DST/秒精度/未改 PATCH、queued 冲突与取消、限额续期、unmet、本地语言错误码/Details、51/50 翻页及切任务、卡片/事件/删任务历史/只读 scheduled human、通知重试和 A→B 取消竞态。出处：[React history](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/core/scheduled-tasks/run-history.ts:29)、[Vue 页面旧消费](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue/app/pages/workspace/scheduled-tasks.vue:63)、[后端事件与 history](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/scheduled_tasks.py:423)。

### W08：扩展的模块、宿主和动作链

- 完成现有 loader/services/surfaces WIP 的生产接线：inline-v1 Blob、assets-v1 原生模块图及相对资源，单个贡献失败不破坏工作区。
- 补动态页面宿主、侧栏导航、普通/Agent 会话工具栏动作、侧栏行菜单与 @mention provider；发现目录只提供当前 React 的状态/安装指引，部署包仍由操作者 CLI 安装并重启。
- mount/dispose、AbortSignal、viewer/预期用户、动作 allowlist 与异步导航归 owner；打开 custom Agent 会话读取真实 metadata 决定路由，卸载后不导航/通知新页面。

最小验收：两种运输、相对 chunk/资源、disabled/未知运输/加载失败、账号切换 409、刷新；未知 namespace/surface 按 React 显示不可用提示、Reload 和返回能力中心，模块/资源 API 的 404 另验；动作可用性、mention 取消、卸载清理。依据：[React 页面宿主](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/plugin-surfaces.tsx:40)、[不可用页面](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/plugin-page.tsx:50)、[会话动作](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/components/workspace/conversation-extension-actions.tsx:35)、[backend 插件授权](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/plugins.py:93)。

### W09：项目、文档附加与 trash

- 补 chats/documents/instructions/settings 四 tab。instructions 按后端 UTF-8 字节限额，保存 A 返回不覆盖正在输入 B，切项目隔离草稿；改名仅提交 name。
- 文档按真实操作实现上传、从会话提升、预览转换稿、原始下载、附加、移入回收站；会话文件按成员线程与 next_offset 分页，每线程至多 200 个文件，截断提示进入会话。归档保留读取/附加到可写会话，禁止上传/提升/回收。
- 附加 API 完成后交给 W02/W04 的附件 owner，跨路由/刷新保留、连续附加去重，发送失败可重试，成功只退休本次快照；同名文件使用 backend 返回文件名。
- trash 恢复原项目或选择 active 项目重试，merged 不重复建档，409 content_missing 保留行；永久删除/清空分别确认。清空针对全部 trash，500 部分失败后重取剩余项，不把已加载页误当全部。

最小验收：多字节限额与保存竞态、项目 URL 直达/刷新、四 tab 切换及刷新回 chats 的当前 React 行为（不新增 tab URL 深链）、归档权限、转换稿预览/原始文件下载、成员线程分页、项目+本地文件发送、原项目消失、merged/409/部分清空、read/write/delete 分权与跨用户 404。依据：[React 四 tab](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/app/workspace/projects/[id]/page.tsx:105)、[附件暂存 owner](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend/src/core/projects/composer-attach.ts:62)、[backend 文件分页](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/project_thread_files.py:112)、[trash 部分失败](/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend/app/gateway/routers/trash.py:226)。

### W10：浏览器、Sidecar、memory、subagent 与其余已有功能

- 按 W00 的全部实际入口逐项复核；包括当前设置的 account/appearance/notification/channels/memory/subagents/about，账户密码/退出与 OAuth 差异，channel 连接，浏览器导航/只读控制/连接恢复，Sidecar 会话/权限/关闭，面板互斥与恢复，工作区命令/快捷键。models 由 W04/W05 负责。不能因没有新增路由而跳过存量界面。
- browser 核对 frame_format=binary JPEG 与 legacy JSON/base64，WebSocket 关闭/重连和 blob 生命周期、导航失败重试、输入焦点/键盘/几何映射。测试使用 backend browser extra/Chromium 和单 worker，不能拿无浏览器工具的 replay 配置证明 browser 通过。
- memory 配置缺失/不可用、编辑保存/重置；subagent 配置及批次历史、worker 停止/无仓库、pause/resume/retry/result artifact；Sidecar 按当前真实协议/权限与恢复语义分别验收。

最小验收：真实 Gateway 与对应受控配置下的状态/操作、账号/线程切换、请求中关闭和重新打开；双端同状态 UI/键盘对照。复用现有 browser/settings/channels/agents/shell 套件，W00 清单发现未覆盖动作即补场景，不能把这些套件名称当覆盖证明。

### W11：showcase 专项与 UI 收口

- 完成前述 showcase 四项条件：全部 13 个当前登记案例和资源核对、无效 404、原文一致、只读边界；新增/删除案例时重新从当前 React 登记表核对。
- 代表案例覆盖当前真实消息/工具/Markdown/代码/表格/图表/产物类型，按中英、明暗、桌面/手机对照；workspace 的发送、停止和恢复继续走可写场景。
- 其余范围内页面也按五节验收 UI。现有语义/几何探针补阴影/backdrop 等盲区，并保留真实双端截图；不能只拿 Vue 自己的平台基线或“diff 不增长”证明 React/Vue 样式一致。

最小验收：同例/同环境的展开、滚动、复制、导出、下载、产物预览；全部资源可达、无隐藏写请求；工作区关键弹层/多面板/窄屏/低高度/字体放大和焦点状态。

### W12：历史负担、门禁与 CI

- 各域新链路替换后核实并处理三节孤立实现、重复算法、可写派生镜像、旧设置与旧 run-history owner；不能按零引用误删暂停 WIP、Nuxt 自动入口、worker URL 或生成类型。
- 大组件按已有职责拆分，保留最少协调层；基础 labels/focus/Escape/键盘与响应式行为保留。菜单 DOM/播报补丁只有在公开 API 实测可替代且双端行为不变时才收缩。
- 历史轮次/固定规模/整文件行数与源码拼写断言改成必要结构或有效行为回归；不以减文件、减行数、减测试数作为目标。协议/权限/代理/缓存竞态/键盘保护继续守住。
- 接入双端关键截图与 Linux 产品视觉 CI；平台/字体基线来自实际目标平台并审阅，改 probes 时做负向变异证明能发现差异。auth 差异及 pending 逐项修实现，不能 accept 新差异、扩大过滤/阈值或删场景来清零。
- verify/mock/real/external 等 job 失败现场上传，验证失败仍留 trace/截图/视频/必要日志；audit 区分 advisory+影响版本，不能只按包名静默通过。产物复用需严格匹配构建参数，保留不同鉴权/代理/degraded 拓扑。

最小验收：被替换的旧 owner 无生产入口；行为回归仍能捕获坏实现；收集/缺基准/视觉/新 advisory 的负向路径非零或明确 UNRUN；CI 配置与上传现场可复核。代码清理收益以实测复杂度/耗时/资源为证据，不由行数推算。

### W13：完整验收、文档与下一次同步

- 按下一节执行正式 gates，修复发现的问题后重跑受影响检查；最终版本再跑完整 verify、mock/backend、parity/auth、visual 与本地生产/独立部署检查。
- 检查执行期 React/backend/contracts 增量与 WIP，完整范围不使用 PARITY_ONLY；所有实际必需场景必须被收集并执行，跳过/超时不能算通过。
- 同步 Vue README/ARCHITECTURE/BEHAVIOR_CONTRACTS、OpenAPI 说明及涉及的根/module 指导，删除过期“已完成”叙事，不改 CLAUDE.md。只维护必要的单一场景清单和最终报告。
- 扩展既有 drift/marker 的 frontend、backend、contracts 审阅范围，明确历史不可达/兄弟缺席/脏基准的 UNKNOWN 状态。只有实际完成审阅、实现与验收才推进已审阅 revision；工具不能凭当前 HEAD 自动抹去未提交差异或未审核后端改动。
- 最终报告记录 revision/本次改动、命令直接退出码、收集/跳过范围、证据路径、遗留项与外部边界。当前分支提交；commit/push 仅在后续实际授权范围内执行，本次审查不提交/推送。

## 执行命令、环境与 gate 顺序

以下为本期强制验收入口，按已落地的 Makefile 聚合同步；实际 PASS/FAIL/UNRUN 读取执行记录，不由本表推断。命令从仓库根目录运行；先完成 W00 的隔离/退出码修正。日志保存并记录主命令直接退出码，不经 tail/grep 管道判断通过。

| 阶段 | 当前命令/入口 | 通过含义及前置条件 |
| --- | --- | --- |
| 依赖 | `python3 scripts/pnpm.py --dir frontend-vue install --frozen-lockfile --strict-peer-dependencies`；React 使用相同 runner `--dir frontend install --frozen-lockfile` | 两个 workspace 各用自己的 pinned pnpm；不改 React lockfile 迁就 Vue |
| 后端受控 E2E 依赖 | 在 backend 中 `uv sync --group dev --extra browser`，`uv run playwright install --with-deps chromium` | 依既有 CI；受控 replay/IdP 不需要外部服务凭据 |
| 前端浏览器 | `make -C frontend-vue e2e-install` | 安装当前 Playwright 对应 Chromium，React/Vue 对照使用同一浏览器/字体 |
| 功能包快速回归 | `python3 scripts/pnpm.py --dir frontend-vue exec vitest run` 后接本包现有/新增测试文件 | 仅变动范围的有效回归；不能替代最终完整 verify |
| 收集 | `make -C frontend-vue e2e-list` | 所有配置可收集且直接退出码可靠；缺 React 的独立跳过不能用于正式 parity 完成结论 |
| 静态/单元/构建 | `make -C frontend-vue verify` | lint、format、三类 types、unit、i18n、生成检查、standalone 静态、生产 build 全部通过 |
| 契约/依赖/独立消费者 | `make -C frontend-vue export-openapi-check audit consumer-check`；另在 frontend-vue 中执行 `../backend/.venv/bin/python scripts/export-openapi.py --check-extension-fixture` | 核心受控 Gateway 契约一致，扩展示例路由在独立 schema 中出现且不污染核心快照；每条 advisory 与影响版本/路径/源码评审精确对应；真实 tarball 在独立消费者中安装、类型检查并运行最小 session |
| 资源预算 | `make -C frontend-vue asset-budget` | 当前产物预算通过；同参数可复用 verified build，但不能检查旧 .output |
| mock/基础设施 | `make -C frontend-vue e2e-mock` | 含产品、auth UI、proxy、options 与真实 chunked SSE stub；不是后台运行正确性证明 |
| 真实 Gateway | `make -C frontend-vue e2e-backend` | 现有 protocol/real/scheduled/channels/agents/settings/shell/browser 八拓扑；replay 替换模型，不能据此宣称真实模型质量通过 |
| WS/OIDC 受控验收 | `make -C frontend-vue e2e-external` | 当前是本地受控 IdP 与 browser/WS；名称 external 不等于真实外部 IdP 或第三方账号验证 |
| 双端正式功能对照 | `make -C frontend-vue e2e-cross-app` | 串行完整执行 product parity、anonymous auth parity、real SQL session parity；同 Gateway/同数据/权限、React 必须存在、无 PARITY_ONLY；HttpOnly/CSRF/expected-owner/动态 RBAC 不能用 auth-disabled 替代 |
| 视觉 | `make -C frontend-vue e2e-visual` 与 W11 新增双端截图 | 各目标平台基线匹配；当前 visual 主要 Vue 平台回归，新增跨框架证据后才能覆盖 UI 可平替 |
| 独立运行 | `make -C frontend-vue standalone-check standalone-sim`；另在 frontend-vue 中执行 `node scripts/standalone-sim.mjs --with-e2e` | 隔离副本中 React 缺席时 Vue 的 install/build/test，以及完整 mock/backend 聚合仍能运行；默认 standalone-sim 不含 E2E，不能替代 --with-e2e；正式双端 parity 另验 |
| Vue 容器 | `make -C frontend-vue container-smoke` | non-root、health、SIGTERM 的生产镜像检查；还需 Docker stack 的 Vue host 代理链路 |
| 本地双端入口 | `make dev-dual`；Vue 单端 `make dev-vue`；生产 `bash scripts/serve.sh --prod --vue` | 当前 Vue 本地入口 3100；启动器会管理本地服务/配置，执行前核对现有端口与运行任务，不能在活动验收中随意重启 |
| Docker 入口 | 现有 compose stack，Vue 默认 `http://vue.localhost:2026` | nginx Host 分流、API/SSE/WS/上传/下载/鉴权 callback；独立镜像 smoke 不覆盖该链路 |
| 如确需改 React | `python3 scripts/pnpm.py --dir frontend check`，相关 rstest/e2e 同样经该 runner | 仅真实最小缺陷修复；不能用改 React 行为使 Vue 差异消失 |
| 如确需改 backend | 依 backend AGENTS 执行测试先行；变更前后 `make test`、`make test-blocking-io`，并 lint/format | 当前并未预设 backend 必改；有改动才触发该端完整要求，不能省略其强制 gate |

执行约束：当前各 Nuxt 套件共享同一 `.output`，React 共享 `.next`；端口不同不代表构建隔离。未先建立独立构建目录/产物签名复用前，相关套件顺序跑，避免 auth/代理参数或 build 覆盖造成假故障。正式完成验收不调小覆盖换时间，也不拿局部诊断结果替代全量结果。

数据库/运行边界：activity/preferences 需要 SQL persistence；调度历史 available 与 scheduler running 分开；browser/channel 采用对应受控依赖与单 worker。账号、权限、MCP/知识 provider/扩展适配器由隔离 test seed 建立，不能使用真实用户数据或写入现有开发配置来凑验收。真实模型、远程 IdP、Lark/IM 等第三方账号、生产 DNS/TLS 另列外部验证；缺少这些环境只影响该项外部结论，不能抹掉本地必做链路。

## 本期完成条件

- [ ] 本期已确认的同步范围有实际 Vue 页面、入口与操作；三类豁免未被误列为缺口，showcase 未被误排除；没有用空页面、字典覆盖或类型通过替代功能实现。
- [ ] showcase 专项的案例/资源、UI、只读交互及双端对照验证全部完成，且与真实工作区的可写操作验收分别记录。
- [ ] 暂停前 WIP 均已完成接线与验证，或明确移除已证实不属于目标的实现；没有悬空的半套迁移。
- [ ] 已复现正确性缺陷修复，并有有意义的回归覆盖；异步结果不污染其他会话/作用域。
- [ ] nullable gap、durable 失败、稳定 human ID、run input 水合与项目/本地附件合并通过；没有重复 create、丢失 human 或过期草稿被标成已提交。
- [ ] 账户 preferences/locale/timezone、引用授权分层与 reasoning 三种 schema 分别通过；知识范围/recovery、Agent 定义包、服务端来源/未读没有漏项。
- [ ] 调度页面及聊天卡片/prompt/events、分页/队列/续期/通知、项目四 tab/附件交接、trash 部分失败和扩展完整宿主都有实际场景通过。
- [ ] 范围内 React 的功能、操作流程、用户可观察行为和 UI 样式通过双端验收；不以新增豁免掩盖范围内未完成项。
- [ ] 架构整理和历史负担清理完成，唯一 owner/真实消费者清楚；必要的无障碍与验证能力保留。
- [ ] 契约来自当前 backend，SSE/REST/JSON 和实际消费者均核对；持久化、取消、异常与恢复流程可继续使用。
- [ ] 现有 `make verify` 及本期相关浏览器/真实后端/视觉检查有明确结果，相关 CI 接线可复核，失败现场可获取。
- [ ] Vue 生产构建、独立运行与现有本地入口验证通过；外部生产/第三方条件如未验证，单独记录，不混为本地完成。
- [ ] 文档与源码、命令、验证结果一致；上游 marker 与实际审阅范围一致。

最终交付报告分别列“代码实现”“本地集成与双端验收”“外部环境验证”，使用 PASS/FAIL/UNRUN 标记；本期必需项仍为 FAIL/UNRUN 时，不宣称本期已全部完成。

本文件是本轮三端复审后的执行计划，尚未执行上述业务改动或运行验收；既有审查结果与内存探针结果不能充当未来最终验收结果。

本轮文档检查：引用的本地文件与行号已核对存在；Vue 内容指纹仍为 `27051e933db86184e50884b35000595a0b926d634a31208d9bc5f0717cae0405`（1261 个范围内文件，含数据/资产，排除依赖与构建目录），与审查起点一致。当前 31 个 tracked Vue WIP 的 diff 仍为 4365 insertions / 563 deletions；它们是前序暂停改动，不是本轮新增实现。
