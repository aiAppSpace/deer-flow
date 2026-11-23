# Stage39 standalone 失败观测与消费边界独立复核

本次只读复核依据 2026-10-10 06:33:10 CST 的观测修复冻结点、原始失败/负控日志及当前源码；不修改产品、测试、门禁或历史报告，不执行构建、完整单测或浏览器。只运行轻量文件库存与已安装 Tailwind 候选编译对照，并新增本报告及独立证据。

结论：未发现观测修复削弱合同、吞掉 unhandled 或引入产品执行变化。完整 default 的历史 FAIL 仍是 FAIL；修复后 default 与 `--with-e2e` 的完成结果，必须等待各自真实完整执行。本报告不把 JSON 的 `success:true` 或断言全部通过替代命令退出码。

## 观测修复与负控

实际两路径为：

- `frontend-vue/scripts/standalone-sim.mjs`：`be69b9e272f5e94d7e7c726138cded5ccbac0bb7ad640a95979972379896e114`。
- 新增 `frontend-vue/tests/unit/tooling/standalone-sim-failure-output.test.ts`：`992ca116cd1f0645086780734e727d153cafa561b5abdaeb12a382ad93f1a0bb`。文件名不是先前消息中的 `standalone-command-boundary.test.ts`。

与不可变 Docker Stage39 源快照逐字比较，脚本仅增加两个语句：保留 JSON reporter 并同时启用 default reporter；在已有 JSON 且真实子进程非零退出的分支中打印捕获的 stdout/stderr。保存精确 diff，并用逆变换相等断言确认没有其他变化。

原实际退出码、整套 Vitest、JSON 文件、报告缺失即失败、必需文件逐项收集守卫、动态跨端 config 收集、无 React 时不计 parity PASS、`--with-e2e` 原 mock/backend 两目标、失败归档、finally/on-exit 清理、预算、超时及 skip 条件均保持原代码。成功仍要求真实 `vitest.code === 0` 且无失败断言；最终任一失败项使进程非零。

新回归在真实 Node 子进程中执行原 orchestrator，只替换昂贵的 copy/exec 边界，分别验证：JSON 自称成功但子进程退出 1 时仍失败并输出异步堆栈；子进程退出 0 但缺失必需文件时仍失败；完整成功才退出 0。三分支都验证隔离 owner 被清理。继承的 `NODE_OPTIONS` 仅从该显式假命令子进程移除，不改产品或独立性运行的环境。

独立读取冻结证据：旧源真实负控 1 FAIL/2 PASS；新源与现有 workspace 回归合计 2 files/5 PASS，types/lint/format 均 direct0。本审查未重复执行这些单测。另一个真实已安装 Vitest 负控保留相同的 1 PASS/0 assertion FAIL 与真实 unhandled rejection：JSON-only 和 default+JSON 均 direct1，后者显示原堆栈。该证据补足假 exec 边界的真实性，不声称已经定位历史完整 default 的具体异步来源。

## 60 条历史 skip 的真实分布

直接解析原 `default/actual-vitest.json` 的每个 assertion，逐条与当前 skip 条件核对：

| 原因 | 条数 | 边界 |
| --- | ---: | --- |
| 缺少 React 源码/依赖的跨端比较 | 46 | 原比较用例缺少 sibling React 时跳过 |
| 默认独立副本没有 `backend/.venv/bin/python` | 14 | ingress 5、OIDC 3、M0 isolation 2、OpenAPI 2、session fixture 2 |

不是“60 条全部跨端跳过”。原完整 default 是 make direct2、全 unit direct1、3763 assertion PASS/60 skip/0 assertion FAIL；JSON 无法反映 unhandled 不会抹掉该失败。`--with-e2e` 原流程在全单测之前安装 backend 虚拟环境，14 条的环境前提因此不同。没有调整任何 skip 条件。所有 60 条标题、文件及分类已另存 JSON。

## 完整新增/删除集合与 COPY 边界

按每种实际源准备规则重新枚举当前完整文件集合，比较旧/新集合的并集，不仅复算旧 receipt 行。

| 已有快照/当前集合 | 历史文件数 | 当前文件数 | 真实运行输入变化 |
| --- | ---: | ---: | --- |
| Docker 物理 context | 2906 | 2908 | 3 changed、2 added、0 deleted |
| Linux 保守 build/gate 输入 | 1750 | 1752 | 同五路径 |
| root 跨端实际 copy selection | 见独立 receipt | 见独立 receipt | 同五路径；辅助报告增改另列 |

三个 changed：`frontend-vue/tests/support/stream-gateway.mjs`、`frontend-vue/tests/e2e-stream/real-stream.spec.ts`、`frontend-vue/scripts/standalone-sim.mjs`。两个 added：`frontend-vue/tests/unit/tooling/stream-gateway-fixture.test.ts`、`frontend-vue/tests/unit/tooling/standalone-sim-failure-output.test.ts`。没有生产、配置或删除项。

历史实际 BuildKit COPY 的 2905 条记录确实包含这三个已有文件；两个新增单测在历史 context/COPY 中不存在。历史物理 context、Linux 完整输入、跨端已记录 copy 字节仍各自匹配原 receipt；当前目录不是全树零漂移。没有为当前新集合重新 COPY、构建镜像或冒称历史镜像包含新文件。root 当前选源通过与实际 factory 相同的 Git `-z` 枚举及过滤重建，辅助 `docs/reports` 新增/修改/删除单列；证据目录不属于该 factory 的输入，后续报告变化也不外推为门禁输入无漂移。

## Tailwind 与实际消费者

运行当前已安装的 Oxide 默认自动发现，对两棵完整 Vue 源树分别收集全部候选，并用当前已安装的 Tailwind node compiler、同一未变 `app/assets/css/main.css` 分别编译。验证没有未纳入的显式 source 图。候选、完整两份 CSS、版本/工具 SHA、源 SHA 前后 fence 均保存。

- 旧 1614 个扫描文件/24563 个候选；当前 1616/24580。
- 全量候选 19 新增、2 删除；不是只对新增字符串试编译。
- 两份完整 CSS 均为 **202104 bytes**，SHA **23044705e630d37342dcf5fd7e6e442a7a7352c0f9c066a0a0173b8030682054**，实际逐字节相等，命令 direct0。

| 消费者 | 这五路径的影响与证据边界 |
| --- | --- |
| Docker Vue build/COPY | COPY 有真实漂移；完整候选 CSS 语义相等。没有应用、Nuxt 配置或运行入口导入这五路径。运行镜像只复制 `.output`，不会执行 standalone/单测/stream stub。原镜像结果仍仅对应原精确快照。 |
| Docker React | 实际构建消费 `frontend/`；无该模块变化。不得将根级 scratch COPY 证明混称 React 编译读取 Vue tests。 |
| Linux visual/payload/asset | 不执行 standalone/stream fixture/新单测。执行配置、应用与资源输入保持原字节；候选 CSS 对照明确相同。历史 Linux PASS 保留原输入来源，不声称新全树重跑。 |
| root product/auth/session | 当前对应 testDir 是 parity/parity-auth/parity-session，Gateway 为各自真实 fixture；不执行 stream config 或 standalone 入口。当前五路径变化仍如实列在整体输入差异中。完整跨端结果必须等待原整轮结束。 |
| 原 stream 套件、整套 Vue unit/CI、standalone | 是实际受影响消费者。stream 配置直接启动变更 stub；完整 unit 收集两个新增单测；CI/Make 的 standalone 目标执行变更 orchestrator。观测专项 5 PASS 不替代新的两个完整 standalone 模式。 |

capabilities 代理已报告最新原 `e2e-mock` 新编译聚合 **560/560 PASS**，其中完整 stream 6/6；这取代此前同旧 `.output` 无重建补证的当前消费者边界，但不替代继续中的 backend/external 聚合。root 两端各 211 宏观终态已真实 PASS 也不替代剩余 keyboard、751 主样本及其余完整跨端聚合。

## 独立证据

证据目录：`docs/reports/evidence/standalone-observability-independent-stage39/`。

- `orchestrator-exact-diff.patch`、`orchestrator-contract-review.json`：精确变更及原合同复核。
- `historical-default-skip-classification.json`：60 条实际 skip 逐条分类。
- `source-boundary.py/.json/.log`、`current-input-sets.json`：完整当前集合、所有新增/删除/修改及历史 COPY 归属。
- `candidate-css-review.mjs/.json/.log`、`{old,current}-candidates.json`、`{old,current}-generated.css`：实际全量候选与完整 CSS 字节比较。

此前只读 W00–W13 查漏结论保留原审查时间，见 `2026-10-10-final-readonly-omission-audit-stage39.md`；本次没有发现新的实施/架构阻断，不把未完成全量 gate 改写为 PASS。Git REVIEW_REQUIRED/dirty 仍按现有人工复核流程保留。
