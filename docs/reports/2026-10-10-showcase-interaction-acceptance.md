# W11 公开案例交互与代表矩阵验收

当前边界：本报告记录 W11 真实交互补齐及实际产品修复。修复前隔离副本用于定位，不能冒称最终生产通过；最终同源浏览器与全量双端对照结果按下方证据更新。此前 13 案例原始资源/404/只读检查继续保留，本项没有退休任何旧样本或接受非零差异。

## 原覆盖缺口与补齐

原登记为 13 个公开案例：5 个代表案例各 8 维，其他 8 个各英文/中文桌面浅色，共 56 个默认样本。实际含 Markdown 表格和 Mermaid 的研究报告 `fe3f7974-1bcb-4a01-a950-79673baafefd` 当时只有 2 维，且只等待消息列表出现，没有打开报告产物。

当前将该报告默认矩阵补为英文/中文 × 浅色/深色 × 桌面/手机，并新增同样 8 维的 `#report-preview` 终态。保留原默认 state 的键；共新增 14 个键，公开案例登记样本 56 → 70，全部主登记 737 → 751。新增键只加入各 12 档空差异目标，未使用 ACCEPT/GROW。精确 ledger 来源见 [零目标扩充证据](evidence/showcase-stage33/zero-target-expansion.json)。实际主双端对照必须到达新增终态并比较；登记本身不算验收通过。

共享场景使用双方共有的公开 UI：点击报告文件，等待 Preview 单选项、报告标题、两张表格；正常 hover 图表消费区使懒加载 Mermaid 进入视口，等待真正 SVG。没有强制渲染、跳过 hydration 或拦截资源来制造结果。

正式新增 `tests/e2e-parity/showcase-interactions.spec.ts` 16 例：两端分别在两语言/桌面浅色与手机深色下执行报告交互 8 例，以及 7 类真实可达预览组合 8 例。它只读取 Vue 自有公开 fixture 和共享登记，无 React 源码依赖，也不引入跨框架业务抽象。

- 报告：表格与 Mermaid 真图、全屏打开/退出、原文剪贴板逐字相同、只读 source、浏览器原始下载字节 SHA、Markdown/JSON 会话导出标题/文件名/可见消息、刷新再打开、无写请求、发送/分支/重跑锁定。
- 代表预览：JPG、PNG 图表、HTML 实际 iframe、CSS、JS、TXT 代码视图、MP4 实际媒体元数据。7 个表面 × 两端 × 两语言 × 两视口/主题组合，共 56 次实际打开。公开 CSV 虽在资源 allowlist 中，但保存消息没有它的附件入口；保留原始资源字节检查，不把不可达动作伪称为 UI 预览覆盖。
- `POST /mock/api/threads/search` 和 `POST /mock/api/threads/{id}/history` 是当前静态 LangGraph 协议的只读查询；其余 API POST/PUT/PATCH/DELETE 全部作为禁止的 mutation 记录。没有拦截或忽略创建/运行/更新请求。

## 实际 RED 与根因修复

双端同一公开研究报告，React 实际导出 `Deer-Flow Research and Analysis.md/.json`，正文标题同名；Vue 实际两文件均为 `Untitled`。Vue header 单独消费了真实 `demoTitle`，但交给 ExportTrigger 的 `currentThread` 从账户列表或临时对象生成，没有公开 fixture 标题。

实际下载还确认 Vue 把临时对象创建的当前时间输出为会话 `created_at`；React 当前 ExportTrigger 只构造 loaded values，并不声称拥有创建时间，因此 Markdown 为 `Created Unknown`、JSON 无 `created_at`。完整实际下载事实见 [双端 RED 元数据](evidence/showcase-stage33/export-metadata-actual-red.json)，不是仅从源码推断。

双端 app/tests 类型与本域 scoped lint direct exit 0（本轮修改只在 Vue）。公开导出 owner 修复为两份 Vue 生产文件：

- `app/components/chat/AgentChat.vue`：公开案例的真实 fixture title 优先，不读取同 ID 账户列表行；普通未命名会话仍由下游输出 `Untitled`。公开 fixture loader 从仅首次 onMounted 改为挂载后的同步 route watch，切案例立即退休旧 title/messages/artifacts，标准 AbortController/onCleanup 取消请求并拒绝晚响应，失败保持当前公开路由空内容，避免落入普通 stream。
- `app/components/workspace/ExportTrigger.vue`：按当前 React 构造 `thread_id/updated_at/values` 导出输入；不从列表行或临时对象伪造创建时间。

生产冻结：2026-10-10 00:41:44 CST。AgentChat SHA `342544a0bed60ee3475fac97339e477ff8d8438dd15c371526fbdd6b045b2fdd`；ExportTrigger SHA `12d2f19f938a9778ec40f4a3eafd3b4ef7ab84e3633ecca3be81fe3a0123906e`。随后所有最终镜像、Linux 与本地入口需以此源刷新；旧快照通过没有外推。

## 验证记录

- 生产表达式/loader 直接行为回归：真实标题、普通无标题、同 ID 账户行隔离、切案例同步清理、B→C 晚响应拒绝从 3 FAIL / 4 PASS 到 GREEN；导出消费不传伪造创建时间另有独立 RED→GREEN。最终相关 4 文件 25 PASS。
- 修复前隔离副本上 56 次类型预览的 8 例全部 PASS，只用于确认未发现其他类型消费缺口；它不证明修复后源码的最终状态。
- 最终源码隔离 `make dev-vue` 入口：真实 Replay 提交 PASS，随后 Vue 正式新增 8/8 交互测试 PASS（1.9m），包含两格式正确标题/文件名/正文及创建时间语义；全部 7 类型预览、刷新、复制和只读断言完整。详见 [新源码 Vue 证据](evidence/showcase-stage33/new-source-vue/)。该开发入口结果不冒充 React 最终生产或主 751 样本对照通过。
- 正式全 collector：Stage34 的 18 套配置共 1510 例收集 PASS，主 parity 实际 886 例 / 29 文件，含新增交互与 751 目标键；doc-facts 19 PASS。精确结果见 [collection-summary](evidence/collection-stage34/collection-summary.json)。这是收集结果，browserExecuted=false，不算 886 例实际通过。
- 双端最终生产浏览器与主 751 样本：待 root 全量实际输出回填，不使用旧副本或登记数量代替。

[本轮证据目录](evidence/showcase-stage33/) 保留 fixture 定位失败、真实产品 RED、单测 RED/GREEN 和实际下载事实。Mermaid 的 React portal 角色为 button、Vue 为有焦点管理的 dialog；共享验收针对真正图表及全屏退出控件，不假设框架 primitive 内部角色。该差别不代替截图/UI 对照。

## 全量新增终态发现的代码块问题（后续检查点）

Stage33 完整组合回流进入新增 `#report-preview` 后，两端代码块的局部横滚被量具误判：当前 Streamdown 的原生代码滚动 owner 是 `data-streamdown="code-block-body"` DIV，直接包 PRE/CODE；量具原来仅认识 PRE 自身。真实两端滚轮横 pan 都从 0 到 980，原文不变；页面横溢出 0、控件丢失 0、不可达裁切 0。校准只识别有界、唯一 PRE/CODE 子树且无交互控件的该专用 owner。普通内容、伪标记、控件、外层和页面横滚仍由负向回归拒绝，其他量具分支及 24px 阈值不变。

同时实际 DOM 发现 Vue 6 行、React 5 行（代码区高度约 306/266px），不是量具差异：Vue 高亮传入了尾换行，React Streamdown 在 fallback 和高亮前均移除全部尾 LF。最小修复 `app/components/markdown/CodeBlock.vue` 统一 displayCode，仅用于两条渲染路径；复制/下载仍使用未改的原文，内部空行保留。真实 Shiki 组件回归 2 RED → GREEN，相关 2 文件 14 PASS，app types 与 scoped lint direct 0；tests 类型在并行 composer 修复后已再次 direct 0。

该第三份生产文件冻结于 2026-10-10 01:14:16.561800 CST，SHA `97d67eababe3f446a74bd17476cdccd25a5c83d9b98544e1a998fcbac93c017b`。此前 00:41:44 版本与本地三入口 PASS 是精确历史检查点，后续统一生产构建、双端完整对照与本地入口必须纳入此变更。新增代码 owner 的 1 个真实浏览器校准用例已通过；主套件新增 1 例及 scheduled-card 8 例后，Stage34 正式 collector 已 direct 0：886 例 / 29 文件，18 套共 1510 例，登记 751 键不变。完整证据见 [报告回流证据](evidence/showcase-stage33/report-reflow/summary.json)。
