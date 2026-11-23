# Stage42 最终验收范围独立复核

证据读取截至：2026-10-10 08:26 CST。依据是当前 [W00–W13 计划](2026-10-09-vue-period-plan.md)、源码、Make/CI 定义和已有原始执行收据。本次审计本身只读；只新增本报告，没有运行构建、测试、浏览器或服务，没有修改产品、测试、计划、基线和阈值。审计完成后根代理另行授权的后端全量验收使用独立新收据，不事后改写本报告的历史状态。

## 结论

当前必需入口均能从计划映射到实际命令，没有发现新增的功能范围豁免或必须另建的架构。尚不能宣称本期完成：最终统一源码的 Vue canonical、完整 mock/backend/external、完整双端聚合、Linux 视觉/资源、两个 standalone 模式、双镜像/代理链及本地入口仍需各自实际结果。

需要显式安排、不能被其他绿色结果替代的事项：

1. `standalone-sim --with-e2e` 仍为 **UNRUN**；默认模式成功不覆盖它。
2. 最新完整原目录聚合曾在 real 截图失败后直接退出 2。其后的 backend 16 项和 external 3 项没有执行；旧分项通过不能补成整条命令通过。
3. Stage39 Linux/Docker、Stage40 默认 standalone、Stage35 三入口是真实历史 PASS，后续已有 Stage41/42 产品修改，不能称当前最终 PASS。
4. 标准 `make dev-dual` 需要端口 3000，AiPPT 占用且未获停启授权，因此是 **BLOCKED**。不能停无关服务、换端口冒称标准入口通过。Vue-only dev/prod 仍可在独占窗口和端口归属核对后完成。
5. 当前 CURRENT 的 18 套 1537、product 913/32 是 Stage38 的实际收集结果。后续新增测试后需要重新实际收集，再更新文档；本审计没有推算新数量。
6. 后端 Stage32 全量有真实成功日志，但现有 `backend-contract-input-continuity.json` 明确只证明 Stage37→current 连续性，不能单独证明 Stage32→current 的完整测试输入闭合。最终报告应补准确的已测输入连续性证据；确有受影响输入变动时，执行对应 backend 必需门禁。不能只由“生产源后续未变”外推所有测试输入一致。

以上 1–5 已在当前执行记录中分别记为待执行、历史 checkpoint、失败或端口边界；第 6 是本次发现的**收据证明边界待补**，不是新发现的后端业务缺陷，也不是无依据要求重新扩大任务。

## 范围与豁免核对

当前 [`react-parity-scope.json`](../../frontend-vue/baseline/react-parity-scope.json) 只有用户确认的三类例外：Vue 首页内容、docs/blog 内容站、整站无后端静态模式。具体 docs/blog 四路由与 `/` 内容例外仍分开；`pendingRoutes.routes` 为空。禁止移植的八个 React 零消费者模块是死代码约束，不能解释成业务豁免。

showcase 保持在范围内：主产品套件核全部 13 个公开案例及资源、404 和只读边界；双端交互套件消费公开 UI，覆盖代表报告的 table/Mermaid、复制、原始下载、导出、刷新和无 mutation。登记保留原默认状态，研究报告及预览有代表八维，不要求机械复制 13×8。所有已登记维度仍必须真实执行。

本次直接读取主 ledger：**751 个键，每键 12 档数组均为空**。它是零差异目标，不是执行 PASS。auth ledger 六样本没有 UI 差异登记，仅 login/setup 两语言各保留一条 Vue `GET /api/v1/auth/me` 请求组织差异；callback 两语言全空。该现有 SSR/client 请求组织边界不能扩大为其他网络、UI、流程或权限豁免。

当前 formal `e2e-cross-app` 强制 React 存在，按 product→anonymous auth→real SQL session 顺序运行。独立副本缺 React 时允许登记的单元跳过与 parity collect，只说明独立运行的边界，不是正式双端验收通过。没有发现新增 `PARITY_ONLY`、accept/grow、全局 skip 或预算放宽的完成路径。

## W00–W13 到实际门禁的映射

下表核对的是**入口和覆盖职责**；存在测试或已定向通过不等于当前全量执行通过。

| 工作包                    | 当前源码/测试职责                                                                      | 最终必需验收归属                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| W00 契约与起点            | backend JSON→实际 generator/生成类型→scheduled/origin 生产消费者；收集、隔离和负向门禁 | `verify` 的生成/类型/单元；core/extension OpenAPI；`consumer-check`；最新全收集及 source fence  |
| W01 身份/偏好/features    | session owner、SQL preferences、跨账户/跨 tab、能力 Query 策略                         | full unit、auth UI、真实 settings/channels、auth/session parity；auth-disabled 不能替代 session |
| W02 run/恢复/提交         | runner、UUID/input、gap/durable、stop/dispose、上传提交 owner                          | full unit、真实 chunked stream、protocol/real、可写 parity                                      |
| W03 产物                  | draft/保存/截断、共享内容 Query、预览/资源释放、自动打开生命周期                       | full unit、real artifact/browser、项目及 showcase 交互、低高度/窄容器、视觉                     |
| W04 composer/模型/引用    | command/upload/voice/polish、model/effort、grants/skills/knowledge、followups          | full unit、完整产品/auth mock、真实发送 wire、双端菜单/键盘/resize；不由 schema 类型通过替代    |
| W05 capability/Agent/知识 | 平台/个人 MCP、Skill revision、Agent 定义包/Query、知识选择/恢复                       | 产品 mock、真实 agents/settings、完整双端 registry 及能力 reflow                                |
| W06 历史/来源/虚拟化      | history/adopt/activity、稳定删除、唯一物理 scroll owner                                | full unit、真实 protocol/real、history/activity/owner 与完整键盘/可达性宏                       |
| W07 调度/后台/channel     | 表单/秒精度/DST/goal/events/history/错误映射、队列和通知                               | generated 检查、产品 mock、真实 scheduled/channels、四视图/聊天卡片/通知 parity                 |
| W08 扩展宿主              | modules/pages/actions/mentions、移动 sidebar、卸载/账户 owner                          | 产品 mock、定义/权限回归、双端扩展 registry；extension schema 独立检查                          |
| W09 项目/trash            | 四 tab、文档预览/原始下载/附件交接、分权与部分失败                                     | 产品 mock、实际项目交互、完整双端及窄屏/低高度；不能隐藏正文/按钮救通过                         |
| W10 存量面板/设置         | browser/WS、Sidecar、Memory、subagent、八个设置面板与 popup                            | settings/shell/browser/channels、auth、真实 WS/OIDC 受控套件及双端菜单/焦点/容量                |
| W11 showcase/UI           | 全 13 案例、代表八维、公开预览/导出，只读边界                                          | 主 mock、完整 751 diff、双端交互、截图、主题/locale/窗口/字体/键盘/低高度/resize 全登记范围     |
| W12 清理/CI               | 唯一 owner/旧实现退役、量具负控、失败归档、standalone reporter                         | full unit/guards、全收集、CI 上传接线、Linux/standalone、生成/clean consumer/audit              |
| W13 收口                  | 最新统一输入与每条 direct exit、必要复验、文档/marker                                  | 本报告后列全部正式入口及最终实际收据，不能由旧 checkpoint 填空                                  |

## 当前实际执行边界

| 验收                             | 可核验的实际结果                                                                                                              | 对当前最终源码的结论                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| React check/full unit            | Stage42 round2 两命令直接 0；318 files、2924 PASS、0 skip/fail/unhandled，1237 输入 SHA `7b9421da…` 前后无漂移                | **PASS**，限该 receipt 输入；产品/测试再改需按影响补验                      |
| Vue canonical/asset              | repair-round-3 直接 0，462 files/3823 PASS/0 unhandled，5590 输入 `634dd3eb…`                                                 | 历史 **PASS**；后续产品/门禁修改未覆盖，最终 **UNRUN**                      |
| mock/backend/external 聚合       | 560 mock PASS；protocol 2 PASS；real 5 PASS/1 截图 FAIL，主命令直接 2                                                         | 聚合 **FAIL**；后 backend 16/external 3 **UNRUN**，最终完整重跑             |
| 双端完整 product/auth/session    | 旧冻结副本完整任务有实际失败，执行记录按观察到的行数披露；751 主 diff 与最终 auth/session 尚无完整通过                        | **未闭合**；旧副本不可刷新冒充新输入，最终全范围重跑                        |
| Linux                            | Stage39 正式 8 visual/12 payload/asset 直接 0，9 PNG 逐张回读                                                                 | 历史 **PASS**；新产品最终 **UNRUN**                                         |
| standalone default               | Stage40 原完整 make 直接 0；463 files collected，3766 PASS/60 已声明缺席 skip，0 unhandled；8 子命令全 0                      | 历史 **PASS**；Stage41/42 新源最终 **UNRUN**                                |
| standalone `--with-e2e`          | 当前没有完整实际执行成功收据                                                                                                  | **UNRUN**，不能用 default、collect 或有 React 原目录替代                    |
| Docker/Compose                   | Stage39 双 canonical image、真实双 host API/SSE/WS/上传下载、Nuxt 内部代理、受控 OIDC、smoke 和 Vue SIGTERM 15→0 全部实际成功 | 历史 **PASS**；最新两端产品镜像及 probes **UNRUN**                          |
| 本地 dev-vue/dev-dual/prod-vue   | Stage35 三项真实 Replay PASS；后续准备收据不是启动结果                                                                        | 当前 Vue-only dev/prod **UNRUN**；标准 dev-dual **BLOCKED**（3000）         |
| core OpenAPI/生成/consumer/audit | 旧 canonical 与独立实际收据存在；当前最终仍须检查各自输入闭合                                                                 | 随新 canonical/显式 milestone 命令收口，不由旧输出默认继承                  |
| extension OpenAPI                | 04:22 独立命令直接 0；本次核对收据的三个输入 SHA 当前全部相同                                                                 | 已有真实 **PASS**，不能再写成“从未执行”；三个输入匹配不冒称全部传递依赖证明 |
| backend full/blocking/lint       | Stage32 四 shard 合计 27096 PASS/451 skip；blocking 235 PASS，ruff/format 实际成功                                            | 历史 **PASS**；完整输入连续性边界见后文                                     |
| marker                           | 仍 `a93900d4…`；正式 watched scope 已扩 frontend/backend/contracts，旧 marker scope 未覆盖，WIP 尚在                          | **REVIEW_REQUIRED**；不是测试成功可自动 accept 的状态                       |

React 证据：[`react-round2-current-receipt.json`](evidence/root-stage42-checkpoints/react-round2-current-receipt.json)。Vue/聚合证据：[`canonical-receipt.json`](evidence/capabilities-final-stage38/repair-round-3/canonical-receipt.json)、[`aggregate-receipt.json`](evidence/capabilities-final-stage38/repair-round-3/aggregate-receipt.json)。旧 FAIL 均保留，不重写为 PASS。

Linux、standalone、Docker 的精确边界分别见 [Linux Stage39](2026-10-10-linux-stage39-final.md)、[standalone Stage40](2026-10-10-standalone-stage40-acceptance.md)、[container Stage39](2026-10-10-container-ingress-stage39-final.md)。目前执行记录已经说明多数边界；Docker 行仍包含其实际执行时的零漂移措辞，最终统收须明确它不代表 Stage42 current。

## 必跑命令及依赖次序

以下是在**最终统一冻结输入**下的执行清单。只能在 root 交接构建和端口窗口后执行；本审计未执行任何一项。各独立副本必须实体独立依赖、显式 Nuxt buildDir、独立 `.next/.output`，并记录实际传入构建参数。相同端口以外的不同端口也不能证明缓存隔离。

### 1. 收集和原目录 canonical

```bash
make -C frontend-vue e2e-list
make -j1 -C frontend-vue export-openapi-check verify asset-budget consumer-check audit
```

`verify` 实际包含 lint/format、app/tests/core 类型检查、完整 unit、i18n、API/contract generation、standalone 静态检查和生产 build。`asset-budget` 依赖 build；同一 `make -j1` 可复用当次产物。`consumer-check`、`audit`、core OpenAPI 不可因 verify 绿色而省略。全收集必须由真实 18 配置直接退出码决定，随后 CURRENT/doc-facts 只更新实际数量。

extension schema 是单独入口：

```bash
cd frontend-vue
../backend/.venv/bin/python scripts/export-openapi.py --check-extension-fixture
```

已有该命令实际 PASS 收据：[`openapi-extension-fixture-final.json`](evidence/root-stage38-checkpoints/openapi-extension-fixture-final.json)。本次 SHA 核对 `export-openapi.py`、扩展示例入口、Gateway app 三项全部 MATCH。若最终相关传递输入变动，才按影响补验；不要把已执行事项误写 UNRUN。

### 2. 完整原目录 mock→backend→external

```bash
make -j1 -C frontend-vue e2e-mock e2e-backend e2e-external
```

mock 实际为 product/auth/infra/options/chunked stream 五拓扑；backend 为 protocol/real/scheduled/channels/agents/settings/shell/browser 八拓扑；external 为受控 IdP/WS。保留所有原 case、matcher、截图 `0.02`、budget 与失败归档。主命令失败即保全现场并记录后续未执行项，修复后按影响和最终完整要求复验。

受控后端前置为隔离 backend 环境 `uv sync --group dev --extra browser` 与 `uv run playwright install --with-deps chromium`；前端 `make -C frontend-vue e2e-install`。browser 不能用不含 browser extra 的 replay 环境替代。

### 3. 双端完整聚合

```bash
make -j1 -C frontend-vue e2e-cross-app
```

当前 Make 强制 `PARITY_REQUIRE_REACT=1`，内层按 product→auth→real SQL session 串行，含主 751 零差异键及完整实际登记测试、211 终态宏和全部已新增负控。不能携带 `PARITY_ONLY`、accept/grow 或缺 React 跳过。主产品 auth-disabled 不覆盖 HttpOnly/CSRF/expected-owner/RBAC；auth 和 session 不能被省略。真实双端截图和语义/几何都保留，Vue 平台截图不替代它。

### 4. Linux 视觉、路由 payload、同产物资产及图像回读

在 CI 对应固定 Playwright/Chromium、Linux ARM64、字体和 Node 环境的新副本运行：

```bash
make -C frontend-vue e2e-visual
node frontend-vue/scripts/keep-e2e-failure-artifacts.mjs -- node frontend-vue/scripts/with-loopback-no-proxy.mjs -- python3 scripts/pnpm.py --dir frontend-vue exec playwright test -c playwright.config.ts tests/e2e/route-payload.spec.ts
```

第二条 argv 由仓库根经 runner 进入 Vue workspace；保留原正式配置。其后在该同参数、同源码正式产物的 Vue 目录运行 `node scripts/asset-budget.mjs`，记录六组 locale/route 初始请求闭包、hover/focus 与 renderer 禁入全部 12 原用例及 8 visual。9 张当前实际 PNG 另逐张回读，不能仅凭 JSON 宣称看过；不更新 baseline/阈值救红。

### 5. standalone 两种完整模式

```bash
make -C frontend-vue standalone-check standalone-sim
cd frontend-vue
node scripts/standalone-sim.mjs --with-e2e
```

两个独立副本都取最终源，保留 install/build/full unit 与真实 direct exit；`--with-e2e` 额外完整 mock/backend。缺 React 的已登记 cross-app-only 单元跳过可逐项披露；缺 backend venv 的默认专属跳过不能移植到 with-e2e。独立 parity collect 不证明正式双端浏览器 PASS。完整失败归档保留 `.cache/standalone-failures/run-*` 结构。

### 6. Docker 双 canonical image、smoke 和真实入口链

Vue 正式入口为 `make -C frontend-vue container-smoke`；React 生产镜像入口为 `docker build -f frontend/Dockerfile --target prod ...`。受控隔离 Compose 的当前 source/COPY/image ID/运行挂载必须闭合。已有标准探针实际入口是：

- `tests/support/probe_container_ingress.mjs <isolated metadata.json> replay`：双 host Nginx→Gateway API/SSE、上传/下载与 session/CSRF。
- 同一入口的 `browser` 模式：真正 browser extra 与二进制 WebSocket。
- 容器内 `tests/support/probe_nuxt_container_proxy.mjs`：私有 Nuxt→Gateway proxy。
- `tests/support/probe_container_oidc.mjs <isolated metadata.json>`：受控 IdP 双 host callback/state owner。
- 原 `scripts/container-smoke.sh <current Vue image>`：non-root/health/showcase/404 与 SIGTERM；另留实际 container events，确认 Vue 15→exit0，没有 9/OOM。

这些由 `python3 scripts/pnpm.py --dir frontend-vue exec node ...`/既有 Compose wrapper 执行，metadata 必须来自当前隔离 runtime，不能拿 Stage39 镜像继续表示 current。原完整运行脚本和 argv 已保存在 [`container-ingress-stage39/run.sh`](evidence/container-ingress-stage39/run.sh)；它硬编码旧阶段/镜像/证据目录，仅作为已执行方法依据，不应直接覆写旧 receipt 或盲目重跑为新阶段。

### 7. 三个本地正式入口

在不带原 `.git`、不复制用户运行配置的最终源码副本中，使用空 dotenv、受控 Replay/M0、隔离 home/SQL，分别完整启动并做既有真实浏览器/wire 验收：

```bash
make dev-vue
make dev-dual
bash scripts/serve.sh --prod --vue
```

每条入口前后核端口/PID/cwd 与 source/env receipt，只清自己副本进程。Vue dev/prod 使用 3100/8001；prod 必须实际 build，不以 skip-build 代替。标准 dev-dual 使用 3000/3100/8001，目前 3000 是无关 AiPPT `dev:integration`：保护它，实际释放/明确授权前保持 BLOCKED。

`serve.sh` 的 stop_all 会查这些端口，但 `_kill_repo_port` 以 `_is_deerflow_pid` 限定本 checkout/注册 worktree；隔离副本不带原 `.git`，避免认领其他 worktree。保护性分类不是许可停 AiPPT，也不能用源审阅替代入口实际运行。

### 8. backend 与最终审阅边界

计划对确实改动的 backend 要求：

```bash
make -C backend test
make -C backend test-blocking-io
make -C backend lint
```

`lint` 本身包含 `ruff format --check`，无需为验收运行会改源的 `make format`。四 shard 不是四次相同全量，不能只读某一 shard 终行当完整计数。已有 Stage32 原日志合计 27096 PASS/451 skip，blocking235 与 lint/format PASS 保留。

目前独立复核找到的后续连续性收据是 [`backend-contract-input-continuity.json`](evidence/root-stage38-checkpoints/backend-contract-input-continuity.json)：2119 输入与 Stage37 copy 一致，并明确写明“不证明旧 Stage32”。因此最终收口需要准确的 Stage32 已测输入到最终输入证明；如果无法建立、或有必须补验的 backend 测试/工具变动，依计划执行受影响门禁及必要完整门禁。此处不自动增加 live 测试或真实第三方验证。

## CI 与证据接线

当前 [`frontend-vue-verify.yml`](../../.github/workflows/frontend-vue-verify.yml) 的 mandatory jobs 包括 verify/asset/default standalone/audit/container-smoke/全收集/mock、真实 backend、external、完整 cross-app 和固定 Linux product visual。core/extension OpenAPI 在 real-backend 前置实际接线。失败上传包含 `test-results/**`、`playwright-report/**` 和隐藏 `.cache/standalone-failures/run-*/**`；include-hidden-files 已启用。没有发现新增 continue-on-error 路径。

`consumer-check` 和 `--with-e2e` 并未被 verify/默认 standalone 自动包含，因此最终本地 milestone 必须显式保留。Docker 完整双 host 链与三本地入口也不是 container-smoke/CI install 成功的推论。可选 visual-baseline generation 不是验收通过；正式视觉失败不能靠触发更新基准解决。

最终每条收据应记：实际 argv/cwd、direct exit、执行/跳过/未执行数量、完整输入与依赖/构建参数、前后漂移、失败现场及清理归属。仅报告漂移可单列；产品/样式依赖漂移必须判定受影响门禁，不外推整树零漂移。

## 外部边界与最终完成表述

本地 `e2e-external` 和受控 Compose OIDC/WS 是必须完成的本地链路，名字 external 不等于真实远程 IdP、Lark/IM 账号、真实模型质量、生产 DNS/TLS、外层代理或最终切流。后者由环境所有者提供条件，未执行时单列 **UNRUN**，不能伪造外部送达/生产成功；同样不能因这些外部条件缺失而省略受控本地链。

marker 已扩展实际 watched frontend/backend/contracts 范围，旧 marker 的 watched 字段仍较窄。当前 WIP 不允许 `--accept` 用 HEAD 消除未审差异；最终可以如实保留 REVIEW_REQUIRED，并给已完成审阅/实现/验收证据。commit/push 未授权，不是本轮验收的隐含动作。

最终报告应分别列代码实现、本地集成/双端验收、外部环境。当前剩余必需项仍是 FAIL/UNRUN/BLOCKED，所以本审计不建议宣布“一次性全部完成”。没有新增范围或架构建议，执行既有完整入口即可。

## 本次读取指纹

下列是本次只读审阅时的具体版本，不是新构建 receipt：

| 输入                                         | SHA-256                                                            |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `docs/reports/2026-10-09-vue-period-plan.md` | `5f04a49d3ba7c78d5f6cd503cb53c5fe2fb6cc5c0f8ea1079306e8cecfa11027` |
| `frontend-vue/Makefile`                      | `81447e31fe254968726ad4a228d64ae8466ba5559897c973ab14e7d0ca29562b` |
| root `Makefile`                              | `27ecc4310ffbc7716a33e758fe7ff516202d051e1d16d3c30af25902dcefbba3` |
| `backend/Makefile`                           | `7daf53a0e43bf6aef5a1840a73726d83e7f6f3a707c6174ad3bf853f40f14800` |
| `.github/workflows/frontend-vue-verify.yml`  | `3915ea7183c9ae00f9b1a9e662095940753acfe3ba2d5c138a702910efe86398` |
| main zero ledger                             | `05a56fdc1dce0a770f1c80b84526ab45f88d5d69380a1610fbfeb8542237982f` |
| auth ledger                                  | `707705ce7a40ee8007000896c4e94be0a4590ef39e955f4e072f210eb9e4c217` |

本报告没有重新执行 collection、生成、编译、浏览器或任何测试；所列 PASS 均引用已存在的实际执行收据，并限定其输入和时间边界。
