# 附录二：全计划待关闭细项（逐条转录）

主文档：[Vue / React 待对齐清单](2026-11-23-vue-react-parity-gaps.md)。

**性质：转录，不是重新验证。** 内容来自以下文档，状态停在原文档的日期。本轮没有重新运行任何门禁。各项与 ROOT 当前代码的关系，以主文档第 3、4 节的核对为准。

| 来源 | 本附录中的位置 |
| --- | --- |
| [11-03 全计划交接](2026-11-03-vue-whole-plan-handoff.md) 第 6、6.1、7、7.1、7.2、8、11 节 | 第 1–3 节、第 6–12 节 |
| [10-10 进度与问题](2026-10-10-vue-plan-progress-and-issues.md) 第四节 | 第 4 节（P01–P03） |
| [10-20 全计划交接](2026-10-20-vue-whole-plan-paused-handoff.md) 第 3.1、3.2 节 | 第 5 节（F01–F14） |

总原则（各交接一致）：React 的实际可达行为是参照，后端实际契约决定请求格式和鉴权；Vue 用自身框架的合理实现；两端同错不算对齐；不靠扩大白名单、抹动态 ID、吞错、任意延时、删用例、改预算或阈值来通过。唯一排除项：Vue 首页内容、docs/blog 内容站、整站无后端静态模式。Showcase、完整键盘焦点、响应式和语言/主题矩阵都在范围内。

## 1. R03 内剩余的实现与验证（11-03 交接第 6 节）

1. **完成当前 run 阶段链**：修 v4 三处类型错误；重跑相关单测和静态检查；用新脚本回放 v3 的 human 4 个、replay 8 个真实原件，期望值独立给出；代码复审；冻结后对两个 spec 的 28 项（新增用例按实际 collection）做原生重验，回读全部附件；再做一次独立的实测证据复核。不能拿旧原件回放代替新浏览器测试。
2. **真实 SDK/adapter 活动流透明性**：目前只有设计。用真实 socket、阶段闸门和实际生产代理；第一片或 Stop 可见时封存并释放观察器但保留页面，继续收第二片和自然结束；用同一请求的被动终态见证，不读第二条流。先做普通 main 的开关两态 × 两端共 4 条，再做普通 main/agent + edit/regenerate main/agent × 开关两态 × 两端共 24 组合。固定完整响应或 `route.fulfill` 不能证明活动流；Node fixture 不等于真实后端。
3. **run 消费者、cursor、初始恢复**：同 run 的 join/cancel/stop-during-create；旧 run、恢复的 run、活动和已退休的 run；cursor 的独立来源。不能凭原始值相等或 Content-Location 就授予任意消费者权限。terminal、EOF、reader 释放各需证据，`ERR_ABORTED` 不设通用豁免。
4. **Sidecar 独立 owner**：独立协议、账户、agent、线程。POST search 的 `metadata.parent_thread_id` 目前仍按字面比较，两端请求列表相同但请求体和事实层不同。没有证明就不能加槽位抹平差异。
5. **普通 human、Memory、replay 的复杂来源**：真实并发、多文件、账户切换、取消、迟到路由、lease、project、原生 draft→persisted、来源变体、历史消息类型、引用边界。单一稳定 owner/账户和基础 8 项矩阵不能代表全部。Memory 取消/并发覆盖 preview 的静态风险，还没证明正常入口可达。
6. **T01–T18、T06 和 aggregate 全部接入**（见第 2 节）：包括 AAB/ABB 全关系、同原始值不同 kind、别名冲突、错 target/Content-Location、缺证、多文档、前置请求、跨 capture、退休和晚到、未选 Memory 和碰撞、真实 Service Worker 等。aggregate capture 目前仍按字面比较。错误必须进入正式 diff 判据，不能只放在附件里。
7. **有界集成与新的最终冻结**：所有根因修复、相关原生测试和审查闭环后，按 287 条候选路径及后续新变化更新清单，保护 ROOT 的私有配置和 WIP，排除 Nuxt 隔离 buildDir；正常安装，记录全部源码和实际运行时，然后才进入 R04–R12。

**身份比较的不变式**：独立场景和动作给出语义锚点；初始来源允许 React 首帧与 Vue settle 的真实时序差，但不按时钟或 UUID 排序配对；必须有完整同一 capture、同一 document、精确消费者和候选域证明；原始值与语义值双向防碰撞，别名只走显式边；原内容、query 编码、multipart、未知字段、失败关系都保留；React 无 key、Vue 有 key 时不能伪造相等；任何缺证都独立失败，不能两边同坏互相抵消。

**multipart 实际 producer 边界**：native-wire-v2 的 5 项通过只证明现有拦截拓扑下字节保真，以及裸 HTTP 缺字节时会拒绝。真实项目文档上传的双端 producer 还有 3 状态 × 3 维度没做。

## 2. T01–T18 逐项合同（11-03 交接第 6.1 节）

已有局部结果只在格内说明，不能把整项升级为通过。

| 编号 | 不能遗漏的合同 |
| --- | --- |
| T01 | 空 draft 的真 owner A；两个消费者都错用已 mint 的 B 时仍要失败；未使用或未知的 mint 不准入 |
| T02 | StrictMode、被丢弃的 render、重复 effect、重渲染，以及 Vue persisted setup/dispose，都不能造出新实体 |
| T03 | main/agent/showcase、过期参数、pathname 与 window 两种时序、encoded-new、只解码一次、离开未知路由；观察不改变行为 |
| T04 | 同 ID 的原生采纳和同一活动流不重复挂载；project 的增删替换，以及同一 flush 内 A→B→A 的退休 |
| T05 | 账户、agent、路由、删除后新建、卸载、迟到的 create 和回调；旧 scope 不能授权新请求，也不能改焦点 |
| T06 | 请求早于 publish 时的同一 commit 因果；未来的 owner 不能追认旧请求；有限一致性不等于通用 HTTP 所有权 |
| T07 | 固定错 thread、A 创建 B 的请求、两个 owner 互换、跨 kind 或原始值被双重认领；不同原始值不合并 |
| T08 | 失败、取消、缺 response、逆序、同 key 多请求；attempt 与 admitted 分开，晚到的回包仍属原 owner |
| T09 | 新 human、旧 replay、服务端替换、错 kind、`additionalInputMessages`、同一 human 复用与独立提交 |
| T10 | key 缺失、存在、为空、显式同值；错 human、跨提交、header 与 body 对调；POST 不盲目重试，GET 对同一 run join |
| T11 | Content-Location 指向错 thread、run 错误 join/cancel、缺头或错误 status、cursor 不是 run ID；开着的 SSE 不阻塞封存 |
| T12 | UUID、前缀、已登记 ID、canonical marker 作为内容；未知字段、自有 `__proto__`、JSON 额外 key 和数组顺序原样保留 |
| T13 | query 编码分隔符碰撞、重复 query、百分号、只解码一次、外部 origin、path segment；typed token 不发生字符串碰撞 |
| T14 | Memory 原 index、字面值、生成值、选文件、取消后迟到的文本、normalize、截断碰撞、与字面值相撞；内容相同也不合并 |
| T15 | body 的 AAB 与 ABB、header 与 body 配对、失败、空 body、请求多重集；展示层去重不能破坏判定 |
| T16 | multipart 只有 boundary 可以独立例外；二进制、文件名、MIME、顺序都要保真；裸 HTTP 下 Chromium 缺字节仍算缺证，不能当作无 body |
| T17 | 默认关闭、错 version、已关闭、观察器抛错、溢出；没有产品全局表；真实开关两态下 wire、导航、焦点、存储、流都一致 |
| T18 | capture、场景、账户、context 隔离；finally 中保留部分收据和原始错误；超时和解析失败要可见 |

## 3. 交接记录的已知问题总账（11-03 交接第 11 节）

| 项目 | 状态与恢复要求 |
| --- | --- |
| v4 三处类型错误 | FAIL，先修并重验 |
| 最近实测 28 项中 12 项失败 | FAIL 保留；v4 reader 已写，但还没有新的浏览器通过 |
| 活动 SDK/adapter SSE | 未实现、未运行；只有设计，先做的 4 条不能代替 24 组合 |
| R03 整体、T06、T01–T18、aggregate | 未完成；局部接受不代表整组完成 |
| 最新候选合入 ROOT | 未运行；287 条待审路径加后续变化，保留 WIP 和两份 ROOT 独有文档 |
| Sidecar `parent_thread_id` | 真实存在的差异，不能擅自归一化消除 |
| 通用 HTTP 归属、Memory 复杂并发 | 证据不足，同形请求的有限候选证明边界不变，不扩大结论 |
| permissions-mobile | 一次没复现不足以关闭，需完整矩阵重验 |
| S15 全量跨端 | 历史上 1114 项产品通过、1 项全矩阵失败，751 个键中 556 个非零；auth 21、SQL 8 未跑 |
| P01/P02/P03 和 F 系列问题 | 按原要求和历史根因继续（见第 4、5 节）；Darwin P03 阈值 0.02 不改，旧的约 0.03 不能接受 |
| Stage43 历史原件 | 旧临时失败原件缺失，未恢复 |
| 构建警告、条件跳过 | 按原回执保留；backend 414 个跳过、standalone 62 个跳过是旧策略，不能说零跳过；CI 未观察不能说通过 |
| Windows 原生、父进程 build 中断边界 | 按 cleanup ACCEPTANCE 的记录保留，不扩大范围，不说已验证 |
| 新路径恢复和正常安装 | 未运行；归档成员核对过不等于恢复运行通过 |
| 真实外部 LLM、IM、IdP、DNS/TLS、外层代理、远程 CI | 未观察；本地受控 fixture、SQL、IdP 通过不能升级成生产结论 |

## 4. P01–P03（10-10 进度与问题第四节）

### P01 两端 MCP JSON 编辑器超过弹窗可见容量

- 状态：FAIL，根因已确认，生产修复未实施（10-10）。之后 10-11 有 `mcp-editor-capacity-p01` 系列报告，11-03 交接列为 R01 仍需完整验收。
- 现象：`capability-controls-reflow.spec.ts` 中两端 `mcp-settings#edit-personal` 各失败 1 项。360×800、根字号 32px 时，`h-96` 的 textarea 高 768px，弹窗实际 clientHeight 734px，控件无法完整滚入视口。
- 涉及：Vue `MCPPluginManager.vue`、React `mcp-plugin-manager.tsx`。
- 恢复要求：按弹窗实际可见容量、原 padding/border 和 min-height 优先级约束编辑器；保留桌面正常的 384px、完整 JSON 值、textarea 原生滚动和整窗平移；验证低高度、字体放大和双向 resize。不改量具、比例或预算。

### P02 Vue 桌面侧栏出现非预期横向滚动

- 状态：FAIL，结构根因候选有 trace 和源码对照支持，原生因果验证和生产修复未实施（10-10）。
- 现象：`chat-scroll-owner-reflow.spec.ts:169` 在 Vue agent-chat 的 1280×800、根字号 32px 下检出唯一非预期横向滚动对象 `sidebar-inner`；页面本身无横向溢出，控件都可达。
- 根因候选：Vue 同一节点同时负责定位/translate 和滚动；React 的 absolute containing block 是外层 `sidebar-container`。
- 修复方向：拆开定位职责和原生滚动职责，保留 rail 的点击和拖动，以及原有低高度焦点合同；不能用 `overflow-x:hidden` 裁切掩盖。涉及 `ThreadSidebarShell.vue`，已有一条 mounted RED（`thread-sidebar-lifecycle.dom.test.ts`）。

### P03 真实 Gateway 截图失败尚未完成最终复验

- 状态：旧源码 FAIL 保留，修复后的新构建复验未运行（10-10）。
- 现象：backend 顺序中 real 为 5 通过、1 项 Darwin 截图失败；截图约 21032px，差异比例约 0.03，超过原阈值 0.02；之后 scheduled/channels/agents/settings/shell/browser 共 16 项和 external 3 项未执行。
- 要求：保留原 baseline 和 0.02 阈值；不能凭定向修复或 DOM 断言通过就宣布截图问题解决。

## 5. F01–F14（10-20 交接第 3.1、3.2 节）

11-03 交接说明：F01/F02 的既有修复和 F03–F14 的对应关系以 10-20 交接为准；是否已应用，以 11-03 交接第 2–5 节和各 application 回执为准。

| 编号 | 已完成部分（截至 10-20） | 尚未关闭 |
| --- | --- | --- |
| F01 草稿期限 | 按有效草稿和 owner 计时，4 个文件 65 项通过；已进入原工作区 | 最终完整输入和提交仍须复验 |
| F02 编辑器 | 搜索、括号/Lezer、redo、Escape owner；完整编辑器原生 14 项通过；已进入原工作区 | 不代表全部产物和媒体完成 |
| F03 | 合法 instant-open 的前置判定已修 | 新的 React 键盘 Tooltip 是真实关闭状态；全部可达性、窄屏、视觉仍待 |
| F04 | 完整 844 次遍历已跑完，冻结测量和离线还原保留 | 实际闭环、菜单差异、物理转移计数方案都未关闭 |
| F05 | 新的完整原生 `markdown-rendering.spec.ts` 8 项通过 | 最终全量和视觉证据仍待 |
| F06 | Mermaid 实际 Dialog owner 和 MMD/SVG 检查已到达 | PNG 四项 FAIL |
| F07 / F08 | 引用列表和拓扑候选已应用；`popup-capacity-reflow.spec.ts` 12 项、`topology.spec.ts` 5 项通过 | 定向范围不能代替完整产品测试和所有拓扑 |
| F09 / F10 | focus-capacity 10 项通过；Vue 三轴键盘 422 次遍历通过 | React 三轴键盘中断；完整三轴浮层、面板、reflow 等 23 项未运行 |
| F11 / F12 / F13 | chat-header-layout 6 项、artifact-frame-keyboard 2 项、keyboard-measurement 12 项通过 | F12 基础入口通过不消除 iframe resize 闭环失败；仍须在新源码上全量聚合 |
| F14 | React 单测 16 项、Vue 单测 13 项、notification-lifecycle 原生 16 项通过；正式 Sonner 补丁安装实证保留 | 最终双端、容器和生命周期整体验收仍待 |

## 6. W00–W13 工作包（11-03 交接第 7 节）

| 工作包 | 已有实现和局部证据 | 最终仍需关闭 |
| --- | --- | --- |
| W00 基准/契约 | OpenAPI/JSON、源码与实际入口冻结、拓扑收集 | 最终新统一源、所有拓扑、文档、CI、契约一致 |
| W01 账户/偏好/features | session/RBAC/locale/timezone/204、账户缓存暂态修复、Agents 门禁 | 合入原仓；全量 auth/SQL、跨标签页、账户退役、异常恢复 |
| W02 run/消息 | gap/durable/END/create/join/stop/dispose、human/附件/bridge/cache、创建归属 | 完整协议、真实 run；零重复 create，无旧草稿或 owner 污染 |
| W03 产物/预览 | Range/SHA/BOM/修订/保存锁、编辑器、iframe、Mermaid | 全部媒体异常、P03、完整视觉、动态 owner、资源释放 |
| W04 输入/模型 | 草稿、知识、reasoning、语音、润色、上传、提及、命令菜单 | Showcase capability 已局部通过；全部 IME、授权、取消、提交持久化 |
| W05 能力/Agent/知识 | catalog/RBAC/Skill409/Agent 包/display_name；门禁和初始焦点局部通过 | 全部安装、OAuth、范围、冲突、权限和最终键盘 |
| W06 历史/来源/未读 | activity/分页/归档/source/registry/cache；删除 owner 局部及组合修复 | 最终 prepend、追尾、resize、跨 owner、恢复和删除的原生重验 |
| W07 调度/channel | events/history/queue/DST/秒精度/通知复制/channel owner | Task9 已局部通过；最终滚动触发详情、完整调度/channel、深链、冲突、取消 |
| W08 扩展宿主 | inline/assets 模块图、导航、动作、提及、abort、dispose | 最终权限、晚返回、卸载，以及真实 Docker 消费 |
| W09 项目/文档/回收站 | 四个 tab、instructions、上传、预览、转换、恢复；创建归属和 mock/SQL 局部闭环 | 完整双端、Gateway 权限、冲突、分页、部分失败 |
| W10 浏览器/Sidecar/设置 | binary/legacy/WS/resize、Sidecar session、memory、subagents | Task6 已局部通过；最终组合原生、重连、关闭重开、释放、权限、八拓扑 |
| W11 Showcase/UI | snapshot 52、Markdown/图标/表格/字体容量，多项原生闭环 | Task7/8/9 已局部通过；全部 751 对 1502 张图、人工矩阵、键盘三轴 |
| W12 架构/历史负担/CI | 22 个目标退休、两个直接依赖、唯一 owner、正式依赖修复、八组 CI | 九项架构最终核对、新候选归并；guard 和命令清理已局部通过；最终组合、依赖维护、独立交付 |
| W13 全量验收/同步 | main 已在 main-wc 历史中；旧完整门禁、容器、三入口、归档 | 新统一源上的 R04–R12、全部 C 条件和 marker；不自行提交 |

## 7. 工作包细项（11-03 交接第 7.1 节）

这些是原计划要求，不表示全部未实现，也不新增范围。最终关闭时，每项都要指向当前统一源码上的证据。

| 工作包 | 恢复后必须核对的细项 |
| --- | --- |
| W00 / W01 | JSON 中的 `scheduled_goal_notes`、`scheduled_task_errors`、`thread_origin` 及其真实消费者；core OpenAPI 的 `plugins: []` 和显式 webhook，扩展另行验证；能力的 available/running/toolEnabled 与错误分别处理。expected-user、只发变化字段的 PATCH、null、204；403/409 退休；503 离线 outbox；跨标签页不同 key；auth-disabled 时不发 session 请求；locale 兼容与 IANA 时区分开 |
| W02 / W04 | 断连后继续；cancel/stop/dispose 以及 202/204/409；gap 两种类型；terminal 不冒充 END；错误尾帧；durable 失败；run-input 水合；同 run join 和幂等 create；稳定的 human/附件快照。展示元数据不等于授权，恢复时用原 turn 的知识范围；引用 3/4、Skill 16/17 的原子边界、历史 skill 快照；run/provider、账户开放 token、Agent low/medium/high/null 三套 reasoning；textarea/contenteditable 锁定、语音和润色取消 |
| W03 / W06 | 保存快照、SHA、412、锁和离开保护；迟到的续体禁止创建资源；code/MD/HTML/image/audio/video/PDF/chart/CSV/TSV；pending、截断、分页、超时、资源上限；原始下载与转换预览。分支、压缩、采纳；activity 的 cursor/read_version/truncated/首次 seed；唯一轮询与可见性标记已读；feature 关闭时零 IO；prepend、追尾、目录、折叠、长输出、动态测量，以及 AI 与工具混合边界 |
| W05 | models 与 capabilities 迁移；旧 settings 深链保持 React 行为及其他 query/focus，不自动改写；平台/个人 MCP、secret 与 installation ID、Lark owner；Skill 409 明确刷新，不自动重试下载；Agent name/display_name、100 个 Unicode 字符、仅创建的导入、409、不导出私密内容；knowledge 的 all/none/selected、搜索分页、默认值、409 与 503、权限门禁 |
| W07 | 实际页面 hook 接线、task_id/thread_id；搜索 tab、404、重复删除续期；run_at 秒精度和 DST fold；未改 interval 时保留秒；PATCH 省略字段与 null；fresh/reuse；goal/stop/max_runs/end_at。task 与 occurrence；queued/launching/running/unmet/failed；paused 时手动触发和冲突；取 51 显示 50；只有第 0 页轮询；focus/reconnect/Abort/key 重置；每个 task-turn 的最后卡片；只读的 scheduled human 和隐藏启动文本；删除后的标题快照；通知字段存在性、locale、时区、pending-retry、MCP 身份、subagent 历史停止 |
| W08 / W09 | 扩展 inline/assets 模块图、相对 chunk、单个贡献故障隔离；所有 page/nav/toolbar/sidebar/提及；viewer 的 expected-user、动作白名单、Abort、dispose、自定义 Agent、晚返回；capabilities Reload 与 asset 404 分开；Python 安装走 CLI。项目四个 tab 及刷新时不臆造 tab URL；UTF-8 instructions、A→B、只改名；next_offset、200 上限、截断；归档可读可附加但禁止写；暂存附件跨路由去重、真实文件名；回收站 missing project/merged/content_missing 409、整库清理 500 部分成功后重新拉取、跨用户 404 |
| W10 / W11 | account/appearance/notifications/channels/memory/subagents/about；密码、退出、OAuth、快捷键、互斥面板恢复；Browser 二进制 JPEG 与 legacy JSON/base64、WS 重连、blob、导航、重试、焦点几何；Sidecar 独立协议鉴权；memory 的 missing/edit/reset，repository 与 worker 历史分开。所有注册的 Showcase 案例和资源、未知 404、只读无隐藏写；原文只按 React 翻译；UI 包括 shadow/backdrop。旧 13 个案例、52 个资源、70 个样本都是各自的历史口径，70 不是 13×8，最终按实际 registry 和完整矩阵核对 |
| W12 / W13 | 有真实替代或消费者证据后才退休旧代码；保留 Nuxt 自动入口、worker URL、types、M0 原生 Resizable 和原 WIP，不追求文件或测试数量。CI 全部失败材料和隐藏 `.cache` 上传（include-hidden-files）、两种事件、前缀、所有规格恰好一次；audit 按 advisory + 版本 + 可达性判断。README/ARCHITECTURE/BEHAVIOR/OpenAPI/AGENTS 同步，不改 CLAUDE.md；frontend/backend/contracts 的 marker 分别核验，缺 React、history 或 dirty 时为 UNKNOWN 或 REVIEW_REQUIRED，不自动接受 HEAD。同构建参数复用只是可选优化；远程 required checks 和附件上传未观察的仍记为 UNOBSERVED |

## 8. R00–R12 执行步骤（11-03 交接第 7 节）

| 步骤 | 恢复后保留的完整执行义务 |
| --- | --- |
| R00 | 重新核对原分支、index、私有配置、hooks、公开文件、WIP、归档 SHA、服务归属；不沿用旧 PID |
| R01 | P01 MCP 容量的完整验收，保留原预算和负例，不复活旧临时方案 |
| R02 | P02 横向滚动以及 P03 相关约束，用真实 scroller 做原生验证 |
| R03 | 已知根因修复、独立审查、相关原生测试完成后，有界合入原仓、正常安装、生成新的最终冻结 |
| R04 | 完整 canonical verify、React、backend 四分片 + blocking/lint/format、check/audit/contracts/实际 collection/icons；含受控 core OpenAPI、独立扩展 schema、真实 tarball 消费者的安装/类型/运行，以及当前构建的 asset budget |
| R05 | 全部跨端 product→auth→SQL session；新增数按实际 collection，含三轴、751 对 1502 张图、零接受、人工审图 |
| R06 | 全部 5 种配置的 mock 聚合、八种 backend 拓扑、external；原 mock 565、backend 24、external 3 只是历史数，保留所有新增用例及原有错误和预算策略 |
| R07 | Linux 正式 visual 8、payload 12、assets 和 9 张人工审图，绑定实际源码和原生依赖的执行身份 |
| R08 | standalone default 与 with-e2e 两个全新目录，正常安装、全部单测、build；后者含全量 mock/backend；只有缺 React 的跨端允许只做收集 |
| R09 | Docker 七个阶段：engine-context 实际 COPY、build-vue、build-react、probe、probe-oidc、smoke、normal-stop；canonical Gateway、双 host、非 root、SQL、退出码 |
| R10 | 原有 dev-vue、dev-dual、prod-vue 标准入口及 30/300/180 秒预算；真实注册、me、权限、204、SSE、建议、刷新、stop、SQL；React 3200 |
| R11 | 九项架构、全部 WIP 的有界语义审查；CI 12 个前缀、两种事件、全部规格恰好一次；拒绝 dirty/untracked；失败材料可取回 |
| R12 | W/R/C、九项架构、共同矩阵逐项给出证据；文档、源码、命令、revision 一致；本地集成和真实外部生产分开列 |

R04 容易漏的入口：根目录 `make -C frontend-vue export-openapi-check audit consumer-check`，以及在 `frontend-vue` 内执行 `../backend/.venv/bin/python scripts/export-openapi.py --check-extension-fixture`。core 导出要隔离 runtime home、固定 `plugins: []`、显式控制 webhook；扩展示例不能污染 core 快照。consumer-check 要真实打包、安装、类型检查并跑最小 session。`make -C frontend-vue asset-budget` 必须检查与当前参数和源码匹配的构建产物，不能拿旧 `.output` 通过。

## 9. 九项架构（11-03 交接第 7.2 节）

1. 消息虚拟化使用真实 scroller
2. 聊天编排、草稿提交、采纳
3. 唯一状态 owner
4. query identity、features、mutation 的发起身份
5. Lark 单一流程 owner
6. 孤立代码和真实消费者
7. 重复算法的真实行为差异
8. 历史叙事、门禁、负控、失败归档
9. 必要的 UI 适配、原生焦点、键盘

当前的有界审阅不等于全部最终运行闭环。

## 10. 共同验收矩阵（11-03 交接第 7.2 节）

- 同一 Gateway、seed、权限、字体、浏览器、时钟。
- 中英文 × 明暗主题 × 桌面/手机，以及真实主题限制。
- loading、empty、error、selected、disabled、hover、focus。
- 低高度、200% 文字、双向 resize、弹层表单多面板。
- 直达、刷新、返回、深链、404。
- 跨标签页、跨用户、跨线程、跨 Agent、持久化。
- 离线、超时、鉴权失败、资源消失、冲突、SSE 中断、部分上传、授权过期后继续。
- 资产、长会话、本地/独立/Compose 拓扑。

## 11. C01–C13 关闭条件（11-03 交接第 7.2 节，均未整项最终关闭）

| 条件 | 必须保留 |
| --- | --- |
| C01 | 全范围入口和动作，只有三项排除 |
| C02 | Showcase 公开案例、资源、只读、UI；写操作另用真实验收 |
| C03 | 全部 WIP 真实接线或有依据地移除，不留半迁移状态 |
| C04 | P01–P03、F01–F14 及新失败的根因修复和永久回归，含 F01 草稿期限、F02 搜索括号/redo/Escape |
| C05 | gap、durable、human ID、run input、附件；无重复创建，无旧草稿假提交 |
| C06 | 偏好、locale、时区；引用授权、三套 reasoning、知识、Agent、来源、未读 |
| C07 | 调度和 channel；项目四个 tab 和回收站的部分失败；扩展完整宿主 |
| C08 | 功能、流程、行为、UI 双端一致；751 对 1502 张图和人工审图；不新增豁免 |
| C09 | 九项架构、历史负担、唯一 owner、真实消费者、必要无障碍 |
| C10 | 当前 backend 的 REST/SSE/JSON、持久化、取消、异常恢复 |
| C11 | 全部 verify、浏览器、backend、visual、CI 和失败材料 |
| C12 | Vue 构建、无 React 的独立交付、本地三入口、容器分别实证 |
| C13 | 文档、源码、命令、结果、marker 一致；拒绝 dirty；不擅自提交 |

## 12. 视觉与历史门禁范围（11-03 交接第 8 节）

- 视觉完整范围仍是 751 对 1502 张 PNG：逐 key、逐文件、解码、尺寸、缺失、多余都要核；另有承诺的人工审图 18 对 36 张、4 个成功附件 8 张、编辑器 8 种格式主题 × 两端 × Source/Edit 的 32 张选样（完整编辑器 14 个 case 56 张）、Linux 9 张。已有采样不能叫 1502 张全部人工审过。
- 当前 diff 测的是语义、几何和选定的计算样式，不是整图逐像素自动比较；截图失败可能不让主 diff 失败。Darwin P03 阈值仍是 0.02，旧的约 0.03 失败不能接受。
- 751 对是必须保留的历史范围，不是最终案例数上限；最终按当前 registry、实际 collection 和完整矩阵纳入所有新增案例。S15 历史上 751 个键中 556 个非零的 FAIL，不因局部 PASS 撤销。
- 真实外部 LLM、IM、IdP、DNS/TLS、外层代理、远程 CI 仍未观察；本地受控 Gateway/IdP/replay 通过不能升级为生产环境通过。
