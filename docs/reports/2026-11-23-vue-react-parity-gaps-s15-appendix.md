# 附录一：S15 实测差异全量明细（2026-10-27，旧源码）

主文档：[Vue / React 待对齐清单](2026-11-23-vue-react-parity-gaps.md)。

来源（外接盘证据目录）：

- 完整差异：`resume-2026-10-26/s15-complete-diff-discovery/differences-by-field.json`（类别 → 差异 → 场景键）
- 保全回执：`resume-2026-10-26/s15-complete-diff-discovery/preservation.json`（3008 个原始文件、222,106,121 字节）
- 运行回执：`root-stage56-attempt15-final/final-cross-app/execution.json`（2026-10-26 21:04 到 10-27 03:18，directExit 2）

本附录由脚本从完整差异数据生成，替代此前从 gate.log 解析的版本（那一版只拿到 412 个键，因为日志里的 diff 输出不完整）。

**这是 10 月 26–27 日冻结源码（5813 个源文件）上的测量，不是 ROOT 当前代码的结果。** 之后已有部分修复（见主文档第 4 节），每条都要在新的统一源上重跑对比确认。

实测结论：751 个场景键中 **556 个非零**（本附录从完整数据重算得到 556 个）；产品用例 1114 通过、1 失败；auth、SQL 会话两组因产品失败未执行。

## 一、各类别规模

| 类别 | 不同差异条数 | 受影响场景键 |
| --- | ---: | ---: |
| 只有 React 发出的请求（`requestsOnlyReact`） | 19 | 420 |
| 只有 Vue 发出的请求（`requestsOnlyVue`） | 28 | 263 |
| 请求体不同（`requestBodies`） | 14 | 29 |
| 只在 React 无障碍树中的节点（`ariaOnlyReact`） | 23 | 67 |
| 只在 Vue 无障碍树中的节点（`ariaOnlyVue`） | 32 | 77 |
| 只在 React 可 Tab 的元素（`tabbablesOnlyReact`） | 2 | 13 |
| 只在 Vue 可 Tab 的元素（`tabbablesOnlyVue`） | 1 | 4 |
| 焦点落点不同（`focus`） | 6 | 30 |
| Tab 顺序不同（`tabOrder`） | 1 | 13 |
| 顺序不同（`order`） | 0 | 0 |
| 层级深度不同（`depth`） | 0 | 0 |
| 计算样式/几何不同（`geometry`） | 71 | 140 |

## 二、按场景汇总

每个场景（`#` 之前的部分）有差异的键数，以及出现的差异类别。键由 场景#终态/断点/主题/语言 组成。

| 场景 | 非零键数 | 差异类别（条目数） |
| --- | ---: | --- |
| scheduled-tasks | 36 | requestsOnlyVue 30, requestsOnlyReact 18, geometry 8, ariaOnlyReact 1, ariaOnlyVue 1 |
| channels | 21 | geometry 31 |
| skill-usage | 20 | requestsOnlyReact 24, requestsOnlyVue 24 |
| mentions | 16 | requestsOnlyVue 29, requestsOnlyReact 24, requestBodies 16, ariaOnlyVue 7, ariaOnlyReact 3, focus 1 |
| reasoning-duration | 16 | requestsOnlyReact 16, requestsOnlyVue 16, geometry 4 |
| showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | 16 | ariaOnlyReact 96, ariaOnlyVue 48, requestsOnlyReact 16, geometry 8 |
| knowledge-scope | 15 | requestsOnlyReact 11, geometry 8, ariaOnlyVue 6 |
| integrations | 14 | geometry 20, focus 12, requestsOnlyReact 6 |
| plugin-icons | 13 | focus 8, requestsOnlyReact 5, ariaOnlyReact 4, ariaOnlyVue 4 |
| settings-memory-import | 13 | geometry 22, ariaOnlyReact 9, ariaOnlyVue 9, requestsOnlyReact 5, requestBodies 3, focus 3 |
| chat | 12 | geometry 36, requestsOnlyReact 4 |
| knowledge-citations | 12 | requestsOnlyReact 16, requestsOnlyVue 16 |
| model-management | 12 | requestsOnlyReact 12, requestsOnlyVue 12, geometry 4 |
| scheduled-task-search | 12 | requestsOnlyVue 15, geometry 4, requestsOnlyReact 3 |
| tool-call-details | 12 | requestsOnlyReact 12, requestsOnlyVue 12 |
| project-workflows | 11 | ariaOnlyReact 9, ariaOnlyVue 9, requestsOnlyReact 8 |
| capability-center | 10 | requestsOnlyReact 8, ariaOnlyReact 2, ariaOnlyVue 2, focus 1 |
| settings-model-sync | 10 | requestsOnlyVue 93, tabbablesOnlyReact 56, requestsOnlyReact 39, geometry 7, tabOrder 7 |
| project-document-upload | 9 | requestsOnlyReact 12, ariaOnlyVue 9, requestBodies 9, ariaOnlyReact 3 |
| settings-sync | 9 | requestsOnlyVue 36, tabbablesOnlyReact 24, requestsOnlyReact 16, tabOrder 6 |
| workspace-changes | 9 | requestsOnlyReact 9, requestsOnlyVue 9 |
| background-tasks | 8 | requestsOnlyReact 8, requestsOnlyVue 8 |
| branch-thread | 8 | requestsOnlyReact 8, requestsOnlyVue 8 |
| mcp-settings | 8 | requestsOnlyReact 5, ariaOnlyReact 3, ariaOnlyVue 3 |
| project-trash | 8 | requestsOnlyReact 6, ariaOnlyReact 3, ariaOnlyVue 3 |
| scheduled-goal-history | 8 | requestsOnlyVue 10, requestsOnlyReact 2, geometry 1 |
| scheduled-run-history | 8 | requestsOnlyVue 10, geometry 4, requestsOnlyReact 2 |
| scheduled-tasks-dst | 8 | requestsOnlyReact 8 |
| showcase-3823e443-4e2b-4679-b496-a9506eae462b | 8 | requestsOnlyReact 8 |
| showcase-4f3e55ee-f853-43db-bfb3-7d1a411f03cb | 8 | requestsOnlyReact 8 |
| showcase-7cfa5f8f-a2f8-47ad-acbd-da7137baf990 | 8 | requestsOnlyReact 8 |
| showcase-ad76c455-5bf9-4335-8517-fc03834ab828 | 8 | requestsOnlyReact 8 |
| showcase-public-thread | 8 | requestsOnlyReact 8 |
| skill-export | 7 | requestsOnlyReact 4, focus 3, ariaOnlyReact 1, ariaOnlyVue 1 |
| skills-settings | 7 | geometry 13, requestsOnlyReact 4 |
| artifact-batched-stream | 6 | requestsOnlyReact 6, requestsOnlyVue 6 |
| project-document-preview-download | 6 | requestsOnlyReact 8, ariaOnlyVue 6, ariaOnlyReact 3 |
| thread-delete-confirm | 6 | requestsOnlyReact 20, requestsOnlyVue 6, geometry 2, ariaOnlyReact 2, ariaOnlyVue 2, focus 2 |
| thread-history-mermaid | 6 | requestsOnlyReact 6, requestsOnlyVue 6 |
| agent-chat | 4 | requestsOnlyReact 6, geometry 4, requestsOnlyVue 2 |
| agent-knowledge-binding | 4 | requestsOnlyReact 4 |
| artifact-preview | 4 | requestsOnlyReact 4, requestsOnlyVue 4 |
| browser-feature | 4 | requestsOnlyReact 4, requestsOnlyVue 4 |
| business-plugins | 4 | geometry 3, requestsOnlyReact 2 |
| business-plugins-dingtalk | 4 | geometry 3, requestsOnlyReact 2 |
| business-plugins-wecom | 4 | geometry 3, requestsOnlyReact 2 |
| scheduled-run-thread | 4 | requestsOnlyReact 4, requestsOnlyVue 4 |
| scheduled-task-chat-card | 4 | requestsOnlyReact 24, requestsOnlyVue 4 |
| scheduled-task-chat-events | 4 | requestsOnlyReact 8, geometry 4, requestsOnlyVue 4 |
| sidecar-chat | 4 | requestsOnlyReact 4, requestsOnlyVue 4 |
| subtask-card | 4 | requestsOnlyReact 4, requestsOnlyVue 4 |
| thread-activity | 4 | requestsOnlyReact 4, requestsOnlyVue 3, ariaOnlyReact 2, ariaOnlyVue 2 |
| thread-history | 4 | ariaOnlyVue 16, geometry 4, ariaOnlyReact 4, tabbablesOnlyVue 4 |
| artifact-panel-resize | 3 | requestsOnlyReact 3, requestsOnlyVue 3 |
| bookmark-plugin | 3 | requestsOnlyVue 2, requestsOnlyReact 1 |
| model-favorites | 3 | requestsOnlyReact 3 |
| project-document-archived | 3 | ariaOnlyVue 6, requestsOnlyReact 4, ariaOnlyReact 3 |
| project-document-attach | 3 | requestsOnlyReact 3, ariaOnlyReact 3, ariaOnlyVue 3, requestsOnlyVue 3 |
| project-document-promotion | 3 | ariaOnlyVue 6, requestsOnlyReact 4, ariaOnlyReact 3 |
| project-trash-content-conflict | 3 | geometry 7, ariaOnlyReact 3, ariaOnlyVue 3, requestsOnlyReact 1 |
| project-trash-partial-purge | 3 | geometry 7, requestsOnlyReact 1 |
| sidebar-collapsed | 3 | requestsOnlyReact 3, requestsOnlyVue 3 |
| thread-list-pin | 3 | geometry 3 |
| thread-title-sync | 3 | geometry 3, requestsOnlyReact 3, requestsOnlyVue 3 |
| thread-todos | 3 | requestsOnlyReact 3, requestsOnlyVue 3 |
| agent-create-name-step | 2 | geometry 2 |
| artifact-stream-state | 2 | requestsOnlyReact 2, requestsOnlyVue 2 |
| artifact-table-preview | 2 | requestsOnlyReact 2, requestsOnlyVue 2 |
| showcase-5aa47db1-d0cb-4eb9-aea5-3dac1b371c5a | 2 | requestsOnlyReact 2 |
| showcase-7f9dc56c-e49c-4671-a3d2-c492ff4dce0c | 2 | requestsOnlyReact 2 |
| showcase-90040b36-7eba-4b97-ba89-02c3ad47a8b9 | 2 | requestsOnlyReact 2 |
| showcase-b83fbb2a-4e36-4d82-9de0-7b2a02c2092a | 2 | requestsOnlyReact 2 |
| showcase-c02bb4d5-4202-490e-ae8f-ff4864fc0d2e | 2 | requestsOnlyReact 2 |
| showcase-d3e5adaf-084c-4dd5-9d29-94f1d6bccd98 | 2 | requestsOnlyReact 2 |
| showcase-f4125791-0128-402a-8ca9-50e0947557e4 | 2 | requestsOnlyReact 2 |
| streaming-reasoning-order | 2 | requestsOnlyReact 2, requestsOnlyVue 2 |
| thread-ordering | 2 | requestsOnlyReact 2, requestsOnlyVue 2 |
| ui-polish-mobile | 2 | geometry 3, requestsOnlyReact 2 |
| user-message-plain-text | 2 | requestsOnlyReact 2, requestsOnlyVue 2 |
| chat-thread-init-ordering | 1 | requestsOnlyReact 3, requestsOnlyVue 3, geometry 2, ariaOnlyReact 1, ariaOnlyVue 1, requestBodies 1 |
| extension-mentions | 1 | requestsOnlyReact 2 |
| project-detail | 1 | requestsOnlyReact 1 |
| project-trash-orphan | 1 | requestsOnlyReact 1 |

## 三、按类别的全部差异明细

UUID 归一为 `<id>`；`boxShadow` 中透明的 `rgba(0, 0, 0, 0) 0px 0px 0px 0px` 片段已删去；超过 240 字符的条目截断。


### 只有 React 发出的请求（`requestsOnlyReact`）：19 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 120 | agent-chat, artifact-batched-stream, artifact-panel-resize, artifact-preview, artifact-stream-state 等 25 个 | `GET /api/langgraph/threads/<id>/runs?limit=10&offset=0` |
| 108 | agent-knowledge-binding, bookmark-plugin, business-plugins, business-plugins-dingtalk, business-plugins-wecom 等 34 个 | `GET /api/plugins` |
| 106 | agent-chat, knowledge-scope, scheduled-task-chat-card, scheduled-task-chat-events, scheduled-tasks 等 21 个 | `GET /api/features` |
| 37 | project-document-archived, project-document-preview-download, project-document-promotion, project-document-upload, project-workflows 等 7 个 | `POST /api/threads/search` |
| 18 | mentions, thread-delete-confirm | `POST /api/langgraph/threads/search` |
| 17 | chat-thread-init-ordering, mentions, scheduled-run-thread, scheduled-task-chat-card, scheduled-task-chat-events | `GET /api/langgraph/threads/«generated»/runs?limit=10&offset=0` |
| 16 | skill-usage | `GET /api/langgraph/threads/skill-history/runs?limit=10&offset=0` |
| 13 | settings-model-sync, settings-sync | `GET /api/channels/providers` |
| 8 | reasoning-duration | `GET /api/langgraph/threads/duration-provider/runs?limit=10&offset=0` |
| 8 | tool-call-details | `GET /api/langgraph/threads/tool-details/runs?limit=10&offset=0` |
| 4 | reasoning-duration | `GET /api/langgraph/threads/duration-inline/runs?limit=10&offset=0` |
| 4 | reasoning-duration | `GET /api/langgraph/threads/duration-none/runs?limit=10&offset=0` |
| 4 | skill-usage | `GET /api/langgraph/threads/skill-history-old/runs?limit=10&offset=0` |
| 4 | tool-call-details | `GET /api/langgraph/threads/tool-details-precise/runs?limit=10&offset=0` |
| 4 | scheduled-task-chat-card | `GET /api/scheduled-tasks/task-f3a00a4dd1574021b6cacfa875fd1bdd` |
| 3 | settings-model-sync | `GET /api/langgraph/threads/agent-model-sync/runs?limit=10&offset=0` |
| 2 | thread-delete-confirm | `GET /api/threads/«generated»/uploads/limits` |
| 1 | extension-mentions | `GET /api/plugins/modules/team/4f248239627ceaddc7be24464139aff75012686bd52a5dcc39608d0ecbe4464f.mjs` |
| 1 | chat-thread-init-ordering | `GET /api/threads/«generated»/runs/run-<id>/workspace-changes?include_diff=false&include_files=true` |

### 只有 Vue 发出的请求（`requestsOnlyVue`）：28 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 120 | agent-chat, artifact-batched-stream, artifact-panel-resize, artifact-preview, artifact-stream-state 等 25 个 | `GET /api/langgraph/threads/<id>/runs` |
| 52 | scheduled-goal-history, scheduled-run-history, scheduled-task-search, scheduled-tasks | `GET /api/agents` |
| 19 | settings-model-sync, settings-sync | `GET /api/models` |
| 19 | settings-model-sync, settings-sync | `GET /api/skills` |
| 19 | settings-model-sync, settings-sync | `GET /api/suggestions/config` |
| 19 | settings-model-sync, settings-sync | `POST /api/langgraph/threads/search` |
| 17 | chat-thread-init-ordering, mentions, scheduled-run-thread, scheduled-task-chat-card, scheduled-task-chat-events | `GET /api/langgraph/threads/«generated»/runs` |
| 17 | chat-thread-init-ordering, mentions | `POST /api/threads/search` |
| 16 | skill-usage | `GET /api/langgraph/threads/skill-history/runs` |
| 13 | scheduled-goal-history, scheduled-run-history, scheduled-task-search, scheduled-tasks | `GET /api/features` |
| 8 | reasoning-duration | `GET /api/langgraph/threads/duration-provider/runs` |
| 8 | tool-call-details | `GET /api/langgraph/threads/tool-details/runs` |
| 7 | settings-model-sync | `GET /api/threads/<id>/messages/page` |
| 7 | settings-model-sync | `GET /api/threads/<id>/scheduled-task-events?limit=200` |
| 7 | settings-model-sync | `GET /api/threads/<id>/uploads/limits` |
| 4 | reasoning-duration | `GET /api/langgraph/threads/duration-inline/runs` |
| 4 | reasoning-duration | `GET /api/langgraph/threads/duration-none/runs` |
| 4 | skill-usage | `GET /api/langgraph/threads/skill-history-old/runs` |
| 4 | tool-call-details | `GET /api/langgraph/threads/tool-details-precise/runs` |
| 4 | mentions | `GET /api/projects/proj-1` |
| 4 | mentions | `POST /api/langgraph/threads` |
| 3 | settings-model-sync | `GET /api/agents/researcher` |
| 3 | settings-model-sync | `GET /api/langgraph/threads/agent-model-sync/runs` |
| 3 | settings-model-sync | `GET /api/threads/agent-model-sync/messages/page` |
| 3 | settings-model-sync | `GET /api/threads/agent-model-sync/scheduled-task-events?limit=200` |
| 3 | settings-model-sync | `GET /api/threads/agent-model-sync/uploads/limits` |
| 2 | bookmark-plugin | `GET /api/plugins` |
| 1 | chat-thread-init-ordering | `GET /api/threads/«generated»/runs/run-<id>/workspace-changes?include_diff=false&include_files=true` |

### 请求体不同（`requestBodies`）：14 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 16 | mentions | `POST /api/langgraph/threads/search body React=[{"limit":50,"offset":0,"select":["thread_id","updated_at","values","metadata"],"sort_by":"updated_at","sort_order":"desc"}] Vue=[]` |
| 1 | chat-thread-init-ordering | `POST /api/langgraph/threads/«generated»/runs/stream body React=[{"assistant_id":"lead_agent","config":{"recursion_limit":1000},"context":{"client_timezone":"UTC","is_plan_mode":false,"subagent_enabled":false,"thinking_enabled":true,"thread_` |
| 1 | settings-memory-import | `POST /api/memory/import body React=[{"facts":[{"category":"cognitive","confidence":0.5,"content":"User prefers conclusions first.","createdAt":"","id":"fact_20ce6d6d","source":"unknown"}],"history":{"earlierContext":{"summary":"","updatedAt` |
| 1 | settings-memory-import | `POST /api/memory/import body React=[{"facts":[{"category":"cognitive","confidence":0.5,"content":"User prefers conclusions first.","createdAt":"","id":"fact_27ce75c6","source":"unknown"}],"history":{"earlierContext":{"summary":"","updatedAt` |
| 1 | settings-memory-import | `POST /api/memory/import body React=[{"facts":[{"category":"cognitive","confidence":0.5,"content":"User prefers conclusions first.","createdAt":"","id":"fact_f483b74c","source":"unknown"}],"history":{"earlierContext":{"summary":"","updatedAt` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundary2M2xp8v9wgwRBcYN Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundary2M2xp8v9wgwRBcYN-- ] Vue=[` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundaryGfqW12hCLvvyhv8K Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundaryGfqW12hCLvvyhv8K-- ] Vue=[` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundarySR7SbdyWN31TzRcY Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundarySR7SbdyWN31TzRcY-- ] Vue=[` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundaryTejzU0av8h0T4TU9 Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundaryTejzU0av8h0T4TU9-- ] Vue=[` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundaryZxoRir5RskelVL8L Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundaryZxoRir5RskelVL8L-- ] Vue=[` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundarygPcRXbQ9WRbpnnjU Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundarygPcRXbQ9WRbpnnjU-- ] Vue=[` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundaryk3uJjDB2nL5QG2wm Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundaryk3uJjDB2nL5QG2wm-- ] Vue=[` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundarykD0VfQ5Zsjx8Bjdf Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundarykD0VfQ5Zsjx8Bjdf-- ] Vue=[` |
| 1 | project-document-upload | `POST /api/projects/<id>/documents body React=[------WebKitFormBoundaryvYHBVULA8Attfops Content-Disposition: form-data; name="file"; filename="notes.txt" Content-Type: text/plain hello shelf ------WebKitFormBoundaryvYHBVULA8Attfops-- ] Vue=[` |

### 只在 React 无障碍树中的节点（`ariaOnlyReact`）：20 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 18 | project-document-archived, project-document-preview-download, project-document-promotion, project-document-upload, project-trash 等 6 个 | `- paragraph: Showing 1 of 1` |
| 9 | capability-center, mcp-settings, plugin-icons, skill-export | `- button "Close"` |
| 9 | settings-memory-import | `- text: No saved facts yet.` |
| 8 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- img` |
| 5 | project-document-attach, thread-activity | `- alert: Loading... - DeerFlow` |
| 4 | chat-thread-init-ordering, mentions | `- /url: /workspace/chats/<id>` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "Copy table":` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "Download table":` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "View fullscreen":` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "下载表格":` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "全屏查看":` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "复制表格":` |
| 3 | thread-history | `- menuitem "Export"` |
| 3 | project-workflows | `- paragraph: 6 / 6 bytes` |
| 3 | project-workflows | `- paragraph: 7 / 6 bytes` |
| 3 | project-workflows | `- status: Saved` |
| 2 | thread-delete-confirm | `- alert: New chat - DeerFlow` |
| 1 | scheduled-tasks | `- alert: 加载定时任务失败：出了点问题。` |
| 1 | capability-center | `- combobox: 中文` |
| 1 | thread-history | `- menuitem "导出"` |

### 只在 Vue 无障碍树中的节点（`ariaOnlyVue`）：29 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 18 | project-document-archived, project-document-preview-download, project-document-promotion, project-document-upload, project-workflows | `- separator` |
| 18 | project-document-archived, project-document-preview-download, project-document-promotion, project-document-upload, project-trash 等 6 个 | `- text: Showing 1 of 1` |
| 9 | capability-center, mcp-settings, plugin-icons, skill-export | `- button "关闭"` |
| 9 | settings-memory-import | `- paragraph: No saved facts yet.` |
| 7 | project-document-attach, thread-activity, thread-delete-confirm | `- alert` |
| 4 | chat-thread-init-ordering, mentions | `- /url: /workspace/chats/<id>` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "Copy table"` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "Download table"` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "View fullscreen"` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "下载表格"` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "全屏查看"` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `- button "复制表格"` |
| 4 | mentions | `- group` |
| 3 | thread-history | `- menu "Export":` |
| 3 | thread-history | `- menuitem "Export as JSON"` |
| 3 | thread-history | `- menuitem "Export as Markdown"` |
| 3 | thread-history | `- menuitem "Export" [expanded]` |
| 3 | project-workflows | `- text: 6 / 6 bytes Saved` |
| 3 | project-workflows | `- text: 7 / 6 bytes` |
| 2 | knowledge-scope | `- text: Knowledge · Off` |
| 2 | knowledge-scope | `- tooltip "Knowledge · Off"` |
| 1 | scheduled-tasks | `- alert: "加载定时任务失败: 出了点问题。"` |
| 1 | capability-center | `- combobox: 简体中文` |
| 1 | thread-history | `- menu "导出":` |
| 1 | thread-history | `- menuitem "导出" [expanded]` |
| 1 | thread-history | `- menuitem "导出为 JSON"` |
| 1 | thread-history | `- menuitem "导出为 Markdown"` |
| 1 | knowledge-scope | `- text: 知识库 · 关闭` |
| 1 | knowledge-scope | `- tooltip "知识库 · 关闭"` |

### 只在 React 可 Tab 的元素（`tabbablesOnlyReact`）：2 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 13 | settings-model-sync, settings-sync | `a` |
| 13 | settings-model-sync, settings-sync | `button` |

### 只在 Vue 可 Tab 的元素（`tabbablesOnlyVue`）：1 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 4 | thread-history | `div(menuitem)` |

### 焦点落点不同（`focus`）：6 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 17 | integrations, plugin-icons, skill-export | `React=div Vue=body` |
| 6 | integrations | `React=button "Close" Vue=a "Open setup documentation"` |
| 3 | settings-memory-import | `React=div Vue=button "Memory"` |
| 2 | thread-delete-confirm | `React=textarea "How can I assist you today?" Vue=body` |
| 1 | mentions | `React=body Vue=span "今天我能为你做些什么？"` |
| 1 | capability-center | `React=button "Close" Vue=button "关闭"` |

### Tab 顺序不同（`tabOrder`）：1 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 13 | settings-model-sync, settings-sync | `第 1 个公共可 tab 元素 React=button Vue=a` |

### 计算样式/几何不同（`geometry`）：71 种

| 键数 | 场景 | 差异 |
| ---: | --- | --- |
| 29 | agent-chat, channels, thread-list-pin, thread-title-sync, ui-polish-mobile | `selector:textarea boxShadow React= Vue=none` |
| 12 | chat | `selector:[data-slot="input-group"] backdropFilter React=none Vue=blur(8px)` |
| 10 | channels, chat, chat-thread-init-ordering | `selector:textarea boxShadow React=oklab(0.579991 -0.0465969 -0.173847 / 0.5) 0px 0px 0px 0px, Vue=none` |
| 9 | settings-memory-import | `text:Failed to read the selected memory file. Please choose a valid JSON export. fontFamily React=ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji` |
| 7 | channels | `role:textbox[Token] boxShadow React=oklab(0.579991 -0.0465969 -0.173847 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.58 -0.0465874 -0.173867 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` |
| 7 | channels, chat | `selector:textarea boxShadow React=oklab(0.739992 -0.0414199 -0.154525 / 0.5) 0px 0px 0px 0px, Vue=none` |
| 6 | business-plugins, business-plugins-dingtalk, business-plugins-wecom | `role:textbox[Connection name] boxShadow React=oklab(0.579991 -0.0465969 -0.173847 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.58 -0.0465874 -0.173867 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` |
| 6 | chat | `selector:[data-slot="input-group"] boxShadow React=oklab(0.579991 -0.0465969 -0.173847 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.58 -0.0465874 -0.173867 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0` |
| 6 | chat | `selector:[data-slot="input-group"] boxShadow React=oklab(0.739992 -0.0414199 -0.154525 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.74 -0.041411 -0.154548 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0p` |
| 6 | scheduled-run-history, scheduled-tasks | `testId:scheduled-task-item-task-1 boxShadow React=lab(2.75381 0 0) 0px 0px 0px 1px, Vue=oklch(0.145 0 0) 0px 0px 0px 1px, ` |
| 6 | settings-memory-import | `text:Failed to read the selected memory file. Please choose a valid JSON export. fontWeight React=500 Vue=400` |
| 4 | thread-history | `role:menuitem[/^(Export as Markdown\|导出为 Markdown)$/] 取样缺失 React=无 Vue=有` |
| 4 | settings-model-sync | `role:menuitemradio[/^(High\|高)/] x React=569 Vue=465 Δ-104` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `role:table[undefined] y React=5132.1 Vue=5128.1 Δ-4` |
| 4 | showcase-fe3f7974-1bcb-4a01-a950-79673baafefd | `role:table[undefined] y React=6721.5 Vue=6717.5 Δ-4` |
| 4 | skills-settings | `text:Toggle rejected fontFamily React=ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji" V` |
| 3 | knowledge-scope | `role:button[/^(?:Knowledge · Off\|知识库 · 关闭)$/] x React=652.5 Vue=950.5 Δ298` |
| 3 | model-management | `role:textbox[/^(Unique name\|唯一名称)$/] boxShadow React=oklab(0.579991 -0.0465969 -0.173847 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.58 -0.0465874 -0.173867 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2p` |
| 3 | business-plugins, business-plugins-dingtalk, business-plugins-wecom | `role:textbox[Connection name] boxShadow React=oklab(0.739992 -0.0414199 -0.154525 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.74 -0.041411 -0.154548 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` |
| 3 | knowledge-scope | `testId:knowledge-scope-trigger x React=652.5 Vue=950.5 Δ298` |
| 3 | scheduled-task-chat-events | `testId:scheduled-task-event-line y React=873 Vue=865 Δ-8` |
| 3 | scheduled-task-search | `testId:scheduled-task-item-limited boxShadow React=lab(2.75381 0 0) 0px 0px 0px 1px, Vue=oklch(0.145 0 0) 0px 0px 0px 1px, ` |
| 3 | integrations | `text:CLI installer unavailable fontFamily React=ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Colo` |
| 3 | settings-memory-import | `text:Failed to read the selected memory file. Please choose a valid JSON export. fontWeight React=500 Vue=300` |
| 3 | settings-memory-import | `text:Failed to read the selected memory file. Please choose a valid JSON export. y React=33 Vue=41 Δ8` |
| 3 | integrations | `text:Installed 3 Lark/Feishu skills. fontFamily React=ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Not` |
| 3 | project-trash-partial-purge | `text:Purge failed during file cleanup; the remaining documents stay in trash and the purge can be retried fontFamily React=ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-` |
| 3 | project-trash-content-conflict | `text:This document's content is missing or damaged, so it stays in the trash. fontFamily React=ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", ` |
| 3 | skills-settings | `text:Toggle rejected fontWeight React=500 Vue=400` |
| 3 | skills-settings | `text:Toggle rejected width React=96.1 Vue=299 Δ202.9` |
| 3 | reasoning-duration | `text:你好！有什么可以帮你的吗？ y React=217 Vue=209 Δ-8` |
| 2 | scheduled-goal-history, scheduled-tasks | `role:dialog[undefined] y React=760 Vue=237 Δ-523` |
| 2 | settings-model-sync | `role:menuitemradio[/^Ultra/] x React=514 Vue=410 Δ-104` |
| 2 | channels | `role:textbox[Token] boxShadow React=oklab(0.739992 -0.0414199 -0.154525 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.74 -0.041411 -0.154548 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` |
| 2 | agent-create-name-step | `selector:input[placeholder] boxShadow React=oklab(0.579991 -0.0465969 -0.173847 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.58 -0.0465874 -0.173867 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` |
| 2 | scheduled-run-history, scheduled-tasks | `testId:scheduled-task-item-task-1 boxShadow React=lab(98.26 0 0) 0px 0px 0px 1px, Vue=oklch(0.985 0 0) 0px 0px 0px 1px, ` |
| 2 | integrations | `text:CLI installer unavailable fontWeight React=500 Vue=400` |
| 2 | integrations | `text:CLI installer unavailable width React=146.2 Vue=299 Δ152.8` |
| 2 | integrations | `text:Installed 3 Lark/Feishu skills. fontWeight React=500 Vue=400` |
| 2 | integrations | `text:Installed 3 Lark/Feishu skills. width React=178.2 Vue=299 Δ120.8` |
| 2 | project-trash-partial-purge | `text:Purge failed during file cleanup; the remaining documents stay in trash and the purge can be retried fontWeight React=500 Vue=400` |
| 2 | project-trash-content-conflict | `text:This document's content is missing or damaged, so it stays in the trash. fontWeight React=500 Vue=400` |
| 1 | knowledge-scope | `role:button[/^(?:Knowledge · Off\|知识库 · 关闭)$/] x React=185 Vue=258 Δ73` |
| 1 | scheduled-tasks | `role:button[/^(Save changes\|保存修改)$/] y React=1908.6 Vue=1385.6 Δ-523` |
| 1 | settings-memory-import | `role:button[Import memory] hit React=off-screen Vue=div` |
| 1 | ui-polish-mobile | `role:menuitemradio[/^(Flash\|闪速) /] x React=52 Vue=13 Δ-39` |
| 1 | settings-model-sync | `role:menuitemradio[/^高/] x React=569 Vue=465 Δ-104` |
| 1 | model-management | `role:textbox[/^(Unique name\|唯一名称)$/] boxShadow React=oklab(0.739992 -0.0414199 -0.154525 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px Vue=oklab(0.74 -0.041411 -0.154548 / 0.5) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px` |
| 1 | thread-delete-confirm | `role:textbox[How can I assist you today?] boxShadow React=oklab(0.579991 -0.0465969 -0.173847 / 0.5) 0px 0px 0px 0px, Vue=none` |
| 1 | thread-delete-confirm | `role:textbox[How can I assist you today?] boxShadow React=oklab(0.739992 -0.0414199 -0.154525 / 0.5) 0px 0px 0px 0px, Vue=none` |
| 1 | channels | `selector:[data-sidebar='sidebar'] boxShadow React=rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px Vue=rgba(0, 0, 0, 0.25) 0px 25px 50px -12px` |
| 1 | scheduled-tasks | `selector:[role="dialog"] button:is(:text-is("Delete"), :text-is("删除")) y React=968 Vue=407 Δ-561` |
| 1 | knowledge-scope | `testId:knowledge-scope-trigger x React=185 Vue=258 Δ73` |
| 1 | scheduled-task-chat-events | `testId:scheduled-task-event-line y React=1289 Vue=1281 Δ-8` |
| 1 | scheduled-tasks | `testId:scheduled-task-form y React=563.6 Vue=40.6 Δ-523` |
| 1 | scheduled-task-search | `testId:scheduled-task-item-limited boxShadow React=lab(98.26 0 0) 0px 0px 0px 1px, Vue=oklch(0.985 0 0) 0px 0px 0px 1px, ` |
| 1 | integrations | `text:CLI installer unavailable fontWeight React=500 Vue=300` |
| 1 | integrations | `text:CLI installer unavailable width React=146.2 Vue=288 Δ141.8` |
| 1 | integrations | `text:CLI installer unavailable y React=33 Vue=41 Δ8` |
| 1 | chat-thread-init-ordering | `text:Hello from DeerFlow! y React=217 Vue=209 Δ-8` |
| 1 | integrations | `text:Installed 3 Lark/Feishu skills. fontWeight React=500 Vue=300` |
| 1 | integrations | `text:Installed 3 Lark/Feishu skills. width React=178.2 Vue=288 Δ109.8` |
| 1 | integrations | `text:Installed 3 Lark/Feishu skills. y React=33 Vue=41 Δ8` |
| 1 | project-trash-partial-purge | `text:Purge failed during file cleanup; the remaining documents stay in trash and the purge can be retried fontWeight React=500 Vue=300` |
| 1 | project-trash-partial-purge | `text:Purge failed during file cleanup; the remaining documents stay in trash and the purge can be retried y React=33 Vue=41 Δ8` |
| 1 | project-trash-content-conflict | `text:This document's content is missing or damaged, so it stays in the trash. fontWeight React=500 Vue=300` |
| 1 | project-trash-content-conflict | `text:This document's content is missing or damaged, so it stays in the trash. y React=33 Vue=41 Δ8` |
| 1 | skills-settings | `text:Toggle rejected fontWeight React=500 Vue=300` |
| 1 | skills-settings | `text:Toggle rejected width React=96.1 Vue=288 Δ191.9` |
| 1 | skills-settings | `text:Toggle rejected y React=33 Vue=41 Δ8` |
| 1 | reasoning-duration | `text:你好！有什么可以帮你的吗？ y React=265 Vue=257 Δ-8` |
