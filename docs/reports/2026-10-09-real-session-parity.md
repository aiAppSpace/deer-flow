# 真实会话与动态权限双端验收

本文件记录当前实现及本地证据边界，不代表整个 Vue 平替任务完成。

## 正式入口

在仓库根目录执行 `make -C frontend-vue e2e-cross-app`。
该聚合入口依次执行产品对照、匿名认证对照和真实会话对照。子命令采用顺序 recipe，
即使外层 make 使用 `-j` 也不会并发改写 Nuxt/Next 构建产物。

真实会话单套件入口为 `make -C frontend-vue e2e-parity-session`。
默认 Vue 端口 3119、React 端口 3120、Gateway 端口 8023；两个前端均开启认证。
所有正式跨应用入口要求 `PARITY_REQUIRE_REACT=1`，缺少 React 会失败，不能以跳过表示通过。
`.github/workflows/frontend-vue-verify.yml` 的强制 `cross-app-parity` job 执行上述聚合入口。

## 测试边界

- Gateway 使用真实 FastAPI、SQL 用户和偏好仓储、认证 Cookie、CSRF 校验与 RBAC provider。
- 管理员按真实 setup-status 只初始化一次；每个用例独立登录管理员，并通过 UUID email 严格 register 201 创建普通用户。Playwright worker 重启不重复 initialize；角色通过真实管理员 PATCH API 修改。
- `/me` 的 permissions 由生产 provider 计算，测试不拦截、不改写该数组。
- 每次套件启动都使用新的临时 SQL/home/config，隔离 operator dotenv 和环境开关；退出后清理。
- 不修改仓库中有意跟踪的 `.env`、`config.yaml`、`extensions_config.json`。
- 模型复用签入的 replay fixture，只增加首轮受控空闲窗口，使真实 active run 的撤权/停止可观测。
- 匿名认证对照使用自己的进程和数据目录；真实会话初始化管理员不会破坏其 needs_setup 前置条件。

## 四个浏览器用例

1. 同一真实账号从 Vue、React 分别通过 composer 编辑 Flash/Ultra 模式，验证真实偏好 PATCH 的 CSRF/expected-owner、visibility 刷新、reload、两个 context 的账号切换、旧账号写入 409 和旧账号数据保留。同时验证真实通知字段 SQL/API 持久化，以及真实浏览器权限对应的通知 UI 状态。
2. 无 session 401、无 CSRF 403、expected-owner 不匹配 409、PAT 不能访问 session-only 偏好；普通用户平台 MCP 读写 403，UI 只允许个人 MCP。
3. mounted 页面真实角色撤权后禁止发送且保留草稿，已打开的删除菜单立即移除 Delete；Gateway 同时拒绝 run/create 与 thread/delete。显式空权限与回授权后 UI/确认删除同样验证。
4. 两个应用分别创建真实 active replay run；撤销 runs:cancel 后 Stop 禁用且直接取消 API 403，run 仍 running；回授权后使用 UI 停止并验证真实 CSRF 请求。

## 本地证据

| 验证                                                       | 状态                                                     | 证据                                                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| CodeEditor pending/readiness 回归                          | PASS，先红后绿                                           | 初始化中的真实 EditorView 保持布局，但 aria-hidden/inert；fallback 移除后的 nextTick 才 autofocus，并检查 generation                             |
| 编辑器与验收基础设施相关单元                               | PASS，9 文件 74 用例                                     | `/private/tmp/deerflow-artifacts-acceptance-units.log`                                                                                           |
| stage13 修复后的 docs/i18n/真实 session fixture/容器准备器 | PASS，10 文件 61 用例                                    | `/private/tmp/deerflow-artifacts-stage13-final-unit.log`                                                                                         |
| stage14 会话 fixture 启动导入边界                          | PASS，2 用例；新增注入回归先红后绿                       | `/private/tmp/deerflow-authz-import-path-red-stage14.log`、`/private/tmp/deerflow-authz-import-path-green-stage14.log`                           |
| stage14 文档/i18n/真实会话/入口准备整组                    | PASS，10 文件 62 用例                                    | `/private/tmp/deerflow-artifacts-stage14-final-unit.log`                                                                                         |
| 真实 Gateway fixture 自检                                  | PASS，SQL/Session/CSRF/expected-owner/动态角色拒绝和恢复 | `/private/tmp/deerflow-session-fixture-check.log`                                                                                                |
| tests 类型检查                                             | PASS                                                     | `/private/tmp/deerflow-session-types.log`                                                                                                        |
| scoped ESLint 与 Python Ruff                               | PASS                                                     | `/private/tmp/deerflow-session-lint-final.log`                                                                                                   |
| 全部 18 套 E2E 收集                                        | PASS，包含真实会话 4 条                                  | `/private/tmp/deerflow-all-e2e-collection-stage11.log`                                                                                           |
| standalone 静态检查                                        | PASS，BLOCKING 0，无过期登记                             | `/private/tmp/deerflow-session-standalone-check.json`                                                                                            |
| 双端真实会话浏览器执行，stage13                            | FAIL：2 失败、2 未执行                                   | `/private/tmp/deerflow-parity-session-stage13.log`；失败证据在 `frontend-vue/test-results/failures/2026-10-09T11-29-25-166Z/e2e-parity-session/` |
| stage13 修复后、当时完整双端复验                           | 历史 UNRUN；Stage29 已完整执行 4 PASS                    | 下文 Stage29 独立源码构建与真实浏览器记录                                                                                                     |
| 最终 Linux 产品视觉复验                                    | UNRUN                                                    | 等全部 UI 修改稳定后同步隔离容器，重新生成并无 update 复验                                                                                       |

日志路径用于本次本地核对；CI 失败证据统一通过现有 wrapper 和 artifact 保存。
standalone 隔离副本只收集全部跨应用 config，其双端执行明确为 UNRUN，不计作 parity PASS。

## stage13 根因与修复边界

第一条失败发生在通知开关的可用性断言。本机真实 Chromium 的 `Notification.permission`
为 `denied`，因此两端产品都应禁用开关并显示拒绝提示。独立 localhost 探针确认：
即使 Playwright context 已授予 notifications、`navigator.permissions.query` 返回 `granted`，
`Notification.permission` 仍为 `denied`，显式按 origin 授权结果相同。
测试现在直接读取真实 Notification API，并严格验证真实权限对应的开关状态；没有覆盖、模拟
Notification API，也没有为了测试启用产品的禁用控件。

跨框架编辑与可见性刷新改用两端共同支持且可编辑的 mode。通知偏好的 true/false 仍通过
真实 session/SQL/CSRF/expected-owner API 检查，并与新旧账号的数据隔离一起验证。
通知权限为 granted 时的用户点击开关流程和实际系统通知投递，不能声称已在本机浏览器通过。

第二条失败是前一例失败后 worker 重启，beforeAll 再次 initialize 同一套件 SQL 得到 409。
修复采用 setup-status 决定唯一一次初始化，随后每例使用同一测试管理员真实登录；普通用户
仍按每例 UUID email 注册且必须返回 201，不把 409 放宽成成功。真实 Gateway 自检补充了
重新登录保持管理员身份、前例 no_access 不泄漏到下一普通账号、再次登录旧账号仍保留其角色。

## stage14 启动导入隔离

仅清环境中的 PYTHONPATH 不能移除 Python 启动时已经写入 sys.path 的父级路径。
新增真实子进程回归把会立即失败的 uvicorn.py 放入临时 ambient PYTHONPATH：先复现导入失败，
修复后真实 session/SQL/RBAC 自检与后续真实 uvicorn 导入均通过。runner 在加载任何生产配置
前同时清理环境和这部分导入路径，保留 backend/tests/support；uvicorn 在配置隔离后才进入
server 分支。未修改生产认证或角色实现，也不把该自检当作完整双端浏览器通过。

## Stage26 独立 Docker 镜像提前诊断（非最终源码验收）

使用 Stage23 两端 canonical images 与 Stage25 real Gateway image，在专属 Compose project、新独立 SQL/home、正式 AUTHORIZATION_BLOCK 和 45 秒 replay idle 下执行原四个 spec，未改行为断言。实际可用诊断拓扑为 Vue localhost:3119 → Nuxt 真实 HTTP proxy → Gateway，以及 React localhost:2326 → 真实生产 Nginx → 同一 Gateway。临时 Playwright config 只取消自动 build/server 并声明这两个实际入口；不写原 `.next/.nuxt`。

结果 **2 PASS / 2 FAIL**（3.5 分钟），日志 `/private/tmp/deerflow-parity-session-docker-topology-stage26.log`。session-only preferences/PAT/CSRF/owner 与普通用户 MCP 约束 PASS；真实管理员动态撤权、send/delete UI、显式空权限及恢复 PASS。偏好跨端先成功从 Ultra 改为 Flash、React visibility GET 返回 mode=flash 200，但随后 React reload 的 Flash 按钮精确可达断言失败，trace 未见 reload 后的新 preferences GET。失败截图有 Flash 文案，尚待最终源码/DOM owner 审查，不能按肉眼放宽断言。

active run 用例实际完成两端创建、no_cancel 角色撤销、禁用 Stop、直接取消 API 403、run 仍 running，以及双端截图。重新授权后 Vue Stop 可用并被点击，但未产生新的 UI cancel POST，等待响应达到 180 秒，finally context.close 又报已关闭。不能声称取消恢复通过；旧镜像诊断与最新源差异待最终正式复验。

此前两次失败属于诊断拓扑不成立：直接 Docker React 入口中的 Next rewrites 在 build 时固化默认 127.0.0.1:8001，runtime 环境变量不能改写；随后试图以同一 Nginx 的 IP/localhost 区分两端，生产 Nginx 将 IP GET canonical redirect 到 localhost，使 cookie 域不匹配。两者均保留失败，不改产品代理或 Cookie 规则。已按实际支持拓扑重新执行完整四项。结束后仅清理专属 project，3119/3120/8023/2326 均释放，Linux gates 与 Verdaccio 保留。

Stage26 记录时正式 real-session 四项仍 UNRUN；其后 Stage29 已完成下文四项真实复验。以上 Stage23 UI 诊断不外推到最新源码。

## Stage29 真实会话四项完整复验 PASS

主任务使用新的独立 Vue/React 源码与独立构建目录，正式真实 session suite 四项全部 PASS，exit0，总1.5分钟；四条实际browser执行分别11.5s、1.8s、5.2s、3.5s。日志 `/private/tmp/deerflow-parity-session-stage29.log`。真实SQL、UI编辑/reload、跨账号旧owner409、HttpOnly/CSRF、真实RBAC、no_cancel403/run仍running及恢复授权后的真实UI cancel202或204断言均保留，没有伪造 `/me` permissions。

该轮先确认并修复了两个实际根因。偏好fixture原先仅发visibilitychange以刷新/me，但React偏好同步独立监听window focus；改为同时发原生focus，并等带expected-owner的真实偏好GET，不拦截响应。Vue Stop原先先调用submission.cancel，signal abort经stream abortRunner清除active run，再emit stop时已无run可向Gateway取消；现在Stop只走stop事件的唯一取消owner，生命周期取消仍由原submission owner负责。消费者TDD先RED1/38PASS，后4files74PASS（`/private/tmp/deerflow-stop-consumer-red-stage29.log`、`/private/tmp/deerflow-stop-consumer-green-stage29.log`）。

本记录精确对应Stop根因修复后的source checkpoint；随后DropdownMenuContent原生trigger anchor仍有晚修，全量`e2e-cross-app`将再次包含该四项。这里不把一次suite PASS写成所有后续源码或完整聚合入口已通过。真实Chromium通知权限denied及通知授权场景未验收的边界继续保留。
