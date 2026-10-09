# main 合并到 main-wc：冲突审核与验证记录

日期：2026-10-09（Asia/Shanghai）。仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。

## 合并范围

- 来源：本地 `main`，提交 `5ecc1c2ac2de624af354bc515d5cb04f80df226c`（用户已拉取，本次没有再次 pull 或更换来源）。
- 目标起点：`main-wc`，提交 `63a8afb06f6a450c6f021ffce3942068ce484749`。
- 共同祖先：`0d4925305a6330a3442dcd336ed25750aea87cbd`。
- 起点工作区干净。采用普通双亲 merge，保留两边历史；没有 rebase、强制覆盖或新建开发分支。提交留在 `main-wc`，没有 push。
- `.env`、`config.yaml`、`extensions_config.json` 与合并前 `main-wc` 逐字节相同；此处不记录配置内容。
- 初始 56 个冲突路径全部逐项审核，含 3 个上游删除的旧 UI 文件。删除文件上的有效改动移入新组件；其余按行为语义组合，未整批采用 ours/theirs。

## 验证结果

| 检查 | 状态 | 实测结果与边界 |
| --- | --- | --- |
| 后端完整四分片覆盖 | PASS | 共 26987 passed、451 skipped。前三分片 20232 passed；停止取消修复后单独重跑第四分片 6755 passed。原聚合进程因第四分片死锁被中止，不将该次聚合退出码计为成功。 |
| 冲突相关后端测试 | PASS | 277 passed；涵盖 staged artifact、读写门禁、Lark、pnpm、代理路由、双前端与 provisioner。 |
| 子任务停止/运行时/Gateway 关闭回归 | PASS | 41 passed；修复上游批量停止取消死锁后复验。 |
| 后端 `make test-blocking-io` | PASS | 235 passed。 |
| 后端 `make lint` | PASS | ruff check 全量通过；1957 文件符合格式。 |
| React `pnpm check` | PASS | eslint 与 TypeScript 全量通过。 |
| React 全量 rstest | PASS | 307 文件，2843 项通过，无 skip/todo；最终微信动作语义调整后另有该模块 7 项复验通过。 |
| React 相关 Playwright | PASS | 5 份 spec 共 77 项：首次 76 通过；修正一个测试路由 fallback 后，失败用例单独复跑通过。没有声称完整 React E2E 全量通过。 |
| Vue lint / format-check | PASS | 0 lint errors，54 个现有 warnings；格式检查通过。 |
| Vue app / tests / core 类型检查 | PASS | vue-tsc 两个范围与 agent-core 两份 tsconfig 均通过。 |
| Vue 生产构建 | PASS | Nuxt 构建完成。 |
| Vue 生成契约常量 | PASS | 与当前 contracts 一致；增加保留 slash 名称 context，并明确 3 份新契约当前不消费的原因。 |
| Vue OpenAPI 类型幂等检查 | PASS | 仅证明与签入的旧快照一致；本次没有刷新快照，不代表覆盖最新 Gateway API。 |
| Vue 完整单元/门禁测试 | FAIL | 332 文件通过、5 文件失败；2719 项通过、8 项失败。剩余属于当前源码引用与新上游能力的对齐差异，见下节。 |
| 版本一致性 | PASS | backend/frontend/Helm 均为 2.2.0-dev；backend uv.lock 与 main 一致。 |
| 真实服务/外部 API/部署验收 | UNRUN | 未启动真实生产栈或调用 live API；Vue 最新后端 E2E、跨应用 parity 与 Docker/Helm 运行验收未执行。 |

执行入口：

```bash
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend
make test
# 第四分片单独复验入口：
make test-shard SPLITS=4 GROUP=4
make test-blocking-io
make lint

cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow
python3 scripts/pnpm.py --dir frontend check
python3 scripts/pnpm.py --dir frontend exec rstest run
python3 scripts/pnpm.py --dir frontend exec playwright test tests/e2e/thread-history.spec.ts tests/e2e/streaming-reasoning-order.spec.ts tests/e2e/scheduled-tasks.spec.ts tests/e2e/scheduled-run-history.spec.ts tests/e2e/channels.spec.ts --workers=2 --reporter=line

cd frontend-vue
make lint format-check typecheck typecheck-tests typecheck-core build
make gen-api-types-check gen-contract-constants-check
make test
```

后端测试还存在非阻断警告，包括 aiosqlite 测试线程在 event loop 关闭后的异常警告；分片退出码均为 0。本次不将测试通过扩大为生产关闭流程已经验收。

## Vue 尚未完成的上游对齐

本次完成 Git 合并和冲突集成，不把此前 main-wc 的“完整对齐”历史结论沿用到新 main，也未更新 parity 基线来掩盖新增差异。Vue 新功能迁移需要后续工作。

| 失败文件 | 失败项数 | 当前差异 |
| --- | ---: | --- |
| frontend-vue/tests/parity/product-surface.test.ts | 1 | 新缺失路由：/workspace/capabilities、/workspace/extensions/[namespace]/[surface_id]、/workspace/trash。 |
| frontend-vue/tests/parity/scenario-coverage.test.ts | 1 | 32 个新增上游 spec 尚未逐项迁移或明确分类，包括能力中心、项目资料、知识来源、定时运行历史、偏好同步、模型管理、会话活动等。 |
| frontend-vue/tests/unit/i18n/upstream-key-coverage.test.ts | 2 | 715 个新增未分类词条路径、21 处同名文案差异。不能只复制词条来宣称功能已对齐。 |
| frontend-vue/tests/guards/doc-references.test.ts | 2 | Vue 内仍引用上游已被重构删除的 integrations settings 与 thread scheduled tasks link 文件。 |
| frontend-vue/tests/guards/upstream-citations.test.ts | 2 | 上游重构后，旧组件的引用/行号及 3 处总行数声明失效；需结合实际行为迁移刷新引用。 |

新契约 scheduled_goal_notes_contract、scheduled_task_errors_contract、thread_origin_contract 在 Vue 的生成脚本中各有明确“不消费”理由；这是当前实现边界记录，不能作为新目标生命周期、错误码本地化或 origin/unread UI 已完成的证据。

## 审核时补出的集成修正

- 上游批量子任务 stop 的取消死锁：第四分片重复停滞，逐项日志与超时堆栈定位到 test_cancelled_batch_stop_allows_successful_retry。该测试及 batch_service.py 原本都与 main 相同。停止调用取消时直接等待 gather，会与暂缓退出的 poller 互相等待；改为 shield owned-task drains，保留 ownership/start fence，并允许后续 stop 重试完成清理。相关 41 项关闭与运行时回归通过；模块 AGENTS 同步更新。
- 微信 QR 的 Close/Done 属于动作按钮，使用随同一连接条件变化的 aria-label；guard 同时验证条件一致且两侧名称不同，拒绝无名选中开关、恒定名称和无关条件名称。新增反例覆盖，未为具体文件加豁免。
- 新 project documents 代理路由补齐 X-Forwarded-Host，并在本地配置沿用已有 forwarded_proto 规范，避免与上传路由及跨来源信任边界不一致。
- 保留双前端 hostname envsubst 与 IPv6 不可用启动保护；测试同时覆盖 envsubst/cp 两种启动模板。
- Compose env_file 测试显式启用 provisioner profile，以实际检查可选服务的配置加载，而非把服务强行放回默认启动集合。
- 恢复上游 docker-logs-frontend 兼容入口，同时保留 --react / --vue；Vue CI 门禁测试的名单对齐现有 workflow/README。
- 删除会话统一调用上游远端删除和本地清理逻辑；保留 main-wc sidecar helper 导出，确保父会话/侧会话各清理一次，失败可重试。
- 保留原生图片/音视频预览的名称和控制；PDF 独立采用上游不带 sandbox 的 iframe。测试与实际组件一致。
- 保留输入框 readOnly 焦点策略，并扩展到新任务表单的目标字段；锁定时仍可聚焦且通过 aria-disabled 表达状态。
- 上游技能页重构后，迁入 alert、TabsList 名称、响应布局和隐藏上传 input 的键盘边界，并迁移原有 DOM 回归用例。
- 修复测试中漏掉的 route fallback，防止非目标请求挂起；将旧 UTC-host 回归迁入新任务 dialog。
- 按冻结的 frontend lockfile 和 backend uv.lock 同步本地依赖；没有手改依赖版本或锁文件。旧环境中的扩展 API 0.2.0 更新为 0.2.5，checkpoint 4.1.1 更新为 4.2.0。

## 56 个冲突路径的处理依据

下表“路径”是初始冲突路径；已删除的旧组件明确写在说明中。

| 路径 | 处理依据 |
| --- | --- |
| .env.example | 保留 Vue 跨来源 CORS 说明，增加上游 Unbrowse 配置。 |
| AGENTS.md | 保留 Vue、双前端、跟踪配置政策与目录发现约束；同步扩展、调度器及 Windows 说明。 |
| CONTRIBUTING.md | 保留本地沙箱无需镜像和应用构建由 docker-start 完成的说明。 |
| Makefile | 合并目标声明；保留 Vue、React 显式日志目标并恢复上游 docker-logs-frontend 兼容别名，加入 extension-upgrade/prod-logs。 |
| README.md | 保留示例记忆、分块文件协议、多账户频道说明；同步 QQ、能力中心和上游 SDK/浏览器说明。 |
| backend/packages/harness/deerflow/agents/middlewares/read_before_write_middleware.py | 保留 finalize_artifact_write 门禁并加入上游阻断写入负载裁剪。 |
| backend/packages/harness/deerflow/sandbox/tools.py | 保留三个 staged artifact 工具并加入上游 CRLF 匹配 helper。 |
| backend/packages/harness/deerflow/sandbox/AGENTS.md | 保留分块文件协议，采用上游 AIO 超时、列表错误和 CRLF 文档。 |
| backend/packages/harness/deerflow/tools/AGENTS.md | 采用上游图像 blob/权限约束及重建保留 display_name；保留 setup_agent 状态契约。 |
| backend/tests/test_fastcrw_tools.py | 加入上游离线 DNS fixture。 |
| backend/tests/test_lark_broker.py | 保留上游新增测试所需导入。 |
| backend/tests/test_pnpm_script.py | 保留 Vue workspace/module 测试和上游 Windows .cmd 测试。 |
| backend/tests/test_nginx_langgraph_body_size.py | 保留配置动态发现，复用上游 location/大小/超时解析器及新增门禁。 |
| docker/docker-compose.yaml | 保留 Vue hostname envsubst；同步 IPv6 不支持的启动修复与 optional env_file。 |
| docker/nginx/nginx.conf | 保留 Vue hostname map 与上游 localhost 规范化 map。 |
| deploy/helm/deer-flow/templates/configmap-nginx.yaml | 保留 Connection upgrade map；独立保留 browser WebSocket location，并加入 project documents 上传 location。 |
| scripts/deploy.sh | 采用上游可选 .env 数组，并保留 provisioner profile 与双前端协调。 |
| scripts/docker.sh | 采用上游生产日志路由并保留 provisioner profile 和 --react/--vue 别名。 |
| scripts/doctor.py | 保留 Docker/local ready command，采用上游 Gateway 配置路径和 dotenv 检查。 |
| frontend/src/AGENTS.md | 采用上游 stream state/artifacts 与 active-run recovery 说明。 |
| frontend/src/app/workspace/chats/page.tsx | 保留窄屏换行并加入未读语义和时间关联。 |
| frontend/src/app/workspace/workspace-content.tsx | 采用上游用户偏好/扩展边界，保留频道配置 dialog 在移动抽屉外部。 |
| frontend/src/components/workspace/agents/agent-card.tsx | 修正上游 skills/tool_groups OR 判断，保留窄屏卡片内边距。 |
| frontend/src/components/workspace/agents/agent-gallery.tsx | 保留新建 Agent 链接语义，加入上游 Agent package import。 |
| frontend/src/components/workspace/agents/agent-settings-dialog.tsx | 采用上游 dialog 高度和滚动布局，保留标题中的 Agent 身份。 |
| frontend/src/components/workspace/artifacts/artifact-file-detail.tsx | 保留 main-wc 原生 img/audio/video 预览及可访问名称；PDF 使用上游不带 sandbox 的 iframe，避免浏览器 PDF 阅读器被阻断。 |
| frontend/src/components/workspace/chats/chat-box.tsx | 保留移动端依赖，整合上游 message details panel 的移动 Sheet。 |
| frontend/src/components/workspace/chats/chat-page.tsx | 保留 token usage，增加未读标记与定时任务事件。 |
| frontend/src/components/workspace/citations/artifact-link.tsx | 采用上游知识源链接与共享 UnsafeLink，文案本地化移到共享组件。 |
| frontend/src/components/workspace/messages/markdown-link.tsx | 保留本地化安全提示并采用上游知识源/共享 UnsafeLink。 |
| frontend/src/components/workspace/messages/message-group.tsx | 保留 staged artifact 呈现，使用上游规范化 tool kind。 |
| frontend/src/components/workspace/messages/subtask-card.tsx | 保留 disclosure aria 状态，加入上游 fallback task。 |
| frontend/src/core/i18n/locales/en-US.ts | 保留历史分页文案与上游新增词条。 |
| frontend/src/core/i18n/locales/types.ts | 保留历史分页文案类型与上游新增词条。 |
| frontend/src/core/i18n/locales/zh-CN.ts | 使用上游新任务文案，保留四个历史分页词条。 |
| frontend/src/core/scheduled-tasks/api.ts | 采用上游 task URL 和可取消分页。 |
| frontend/src/core/scheduled-tasks/hooks.ts | 采用上游单任务观察和新 run-history 分页，迁移分支回归测试。 |
| frontend/src/core/skills/hooks.ts | 保留 showcase enabled 门禁，加入上游 loading/refetch 状态。 |
| frontend/src/components/workspace/settings/settings-dialog.tsx | 保留移动宽度/padding，加入上游 Models settings。 |
| frontend/src/core/threads/hooks.ts | 保留分支取消旧查询、流断线继续和乐观 ID 交接；合入上游 active run 恢复、引用 context 和删除重试。 |
| frontend/src/components/workspace/recent-chat-list.tsx | 采用上游持久删除 dialog/error retry，保留分支移动 export submenu 与 rename focus restoration。 |
| frontend/src/components/workspace/input-box-helpers.ts | 采用上游 skills @ picker / 内置 slash commands，保留完整命令 Enter 识别 helper。 |
| frontend/src/app/workspace/scheduled-tasks/page.tsx | 采用上游新任务页组合结构；旧分页由 run-history 接替，移动/无障碍行为复核新组件。 |
| frontend/tests/e2e/scheduled-tasks.spec.ts | 采用上游新任务 UI 回归，移植 UTC-host 用例到新任务对话框；上游 scheduled-run-history 的翻页/哨兵/重试用例接替旧追加分页，过滤和移动布局回归继续验证。 |
| frontend/tests/e2e/streaming-reasoning-order.spec.ts | 保留 credentialed CORS，加入上游动态 stream frame/thread ID fixture。 |
| frontend/tests/e2e/thread-history.spec.ts | 采用上游删除失败重试流程并补齐 mock route fallback；保留其他历史、乐观消息、长会话和切换测试。 |
| frontend/tests/e2e/utils/mock-api.ts | 采用上游分页 mock，与分支 regex 修复语义相同。 |
| frontend/tests/unit/core/artifacts/preview.test.ts | 保留资源 URL、inline embedding 和 head scroll restoration 回归。 |
| frontend/tests/unit/core/scheduled-tasks/hooks.test.ts | 保留上游任务观察回归与分支分页回归，迁移到 run-history 模块。 |
| frontend/src/components/workspace/input-box.tsx | 采用上游 @ references、项目附件、reasoning/model picker；逐项移植展示页查询限制、只读焦点、完整命令 Enter、菜单 radio aria 和视口 popup。 |
| frontend/src/components/workspace/sidecar/sidecar-panel.tsx | 采用上游 reasoning/model picker，移植 radio 可访问状态、只读焦点和 200% 文字换行。 |
| frontend/src/components/workspace/channels/workspace-channels-list.tsx | 保留移动抽屉外配置 host，把上游 WeChat QR/配置完成流程和定时推送说明移入该 host。 |
| frontend/src/components/workspace/settings/channels-settings-page.tsx | 保留逐账户解绑与窄屏布局，加入上游定时推送说明及 WeChat 配置流程。 |
| frontend/src/components/ai-elements/model-selector.tsx | 采用上游删除：新 ModelPicker 自带 dialog/按钮可访问名称且不再有无名称搜索框。 |
| frontend/src/components/workspace/settings/tool-settings-page.tsx | 采用上游删除：MCPPluginManager 已具备 Switch 名称、受限 textarea 和滚动布局。 |
| frontend/src/components/workspace/settings/skill-settings-page.tsx | 采用上游删除：将 alert、TabsList 名称、响应布局和隐藏 file input 移植到 SkillGallery。 |

## Git 结果核验

提交完成后用以下只读命令检查：当前分支应为 main-wc；HEAD 的两个父提交分别为本报告记录的目标起点和 main 来源；main 必须是 main-wc 的祖先；工作区应干净。

```bash
git branch --show-current
git log -1 --format='%H%n%P%n%s'
git merge-base --is-ancestor main main-wc
git status --short
```
