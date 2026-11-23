# Stage42 当前工作区后端完整验收

本报告记录当前真实 `main-wc` checkout 的实际后端门禁；不复用旧 Stage32 PASS 推断当前源码，不在无 `.git` 的准备副本中运行。先读取 backend 与 backend/tests 指导，使用现有 `.venv`，没有修改产品、测试、预算或 Make 命令。

## 首轮实际结果

2026-10-10 08:27:22–08:32:03 CST。四分片全部结束后继续执行其余门禁；完整 stdout/stderr 各自保全，退出码来自原 subprocess，没有经 tail/grep 管道判断成功。

| 原命令（cwd=`backend`）        | 直接退出码 | 实际结果                                                    |     耗时 |
| ------------------------------ | ---------: | ----------------------------------------------------------- | -------: |
| `make test`                    |          2 | **FAIL**：27131 PASS /414 skipped /2 FAIL，原四分片全部完成 | 265.729s |
| `make test-blocking-io`        |          0 | **PASS**：235 PASS                                          |  14.266s |
| `make lint`                    |          0 | **PASS**：ruff check 与 format --check；1960 files          |   0.151s |
| `uv run ruff format --check .` |          0 | **PASS**：1960 files                                        |   0.050s |

`TEST_JOBS`、`SPLITS`、`GROUP`、`DEER_FLOW_RUN_LIVE_TESTS` 无 ambient override；日志确证 `make -j4`、四组 SPLITS=4/GROUP=1..4 和原 `not live`/blocking 分离政策。414 skip 是本轮实际值，不能沿用旧 451。四 shard 原 summary 分别为：

- 6783 PASS /103 skipped /1 FAIL。
- 6777 PASS /111 skipped /0 FAIL。
- 6794 PASS /93 skipped /1 FAIL。
- 6777 PASS /107 skipped /0 FAIL。

精确计数：[`counts.json`](evidence/backend-final-stage42/counts.json)。直接退出与时间：[`execution.json`](evidence/backend-final-stage42/execution.json)。完整日志：[`full-test.log`](evidence/backend-final-stage42/full-test.log)、[`blocking-io.log`](evidence/backend-final-stage42/blocking-io.log)、[`lint.log`](evidence/backend-final-stage42/lint.log)、[`format-check.log`](evidence/backend-final-stage42/format-check.log)。

## 两个真实失败及修复边界

1. `test_agent_guidance_check.py::test_repository_has_the_approved_scoped_guidance_shape`：实际 Git 工作区枚举多出 `docs/reports/evidence/root-stage38-checkpoints/obsolete-runs/stage38/changed-old-source/frontend/AGENTS.md`。它是历史归档内容，却因精确文件名进入有效指导清单。
2. `test_agent_guidance_check.py::test_repository_guidance_stays_below_hard_budgets_and_avoids_doc_indexes`：当前 `frontend/AGENTS.md` normalized UTF-8 为 **36234 bytes**，超过原 module hard limit **32768**。

两项均为实际断言失败，非 sandbox/超时/资源推测。原 checker、预算和测试不应放宽。根代理接手将详细容量合同完整移入独立前端文档，原指导保留强制读取入口；历史归档改为 `.snapshot` 并保留字节 SHA 和迁移收据。首轮结束时修复及最终复验尚未完成；下文按实际发生顺序保留后续修复与复验。

## 首轮输入指纹与限制

首轮存在源输入 5507 项，其中 backend 2109、contracts 10，涵盖根/CI/scripts/deploy/examples/skills、两前端和普通 docs。指纹：

- before：`c1d5097831b11bad3a4f91c6183d81db3112545a3caa7a66916aee3c52571f9c`。
- after：`78b65ad6e92a7b1e642befac0df583e2484fdfdb167caebeb82588e9dcac62b8`。
- Git index 内容清单哈希相同。
- 三个刻意跟踪运行配置 `.env`、`config.yaml`、`extensions_config.json` **仅记录/比较 SHA，全部相同**；未输出内容。
- 宽输入漂移仅 `.extensions_config.json.skills-cache-reset.json` 缓存失效标记与 `docs/plans/vue-parity-cold-start.md`；没有 backend/contracts 产品字节变化。标记变化未被冒称为零漂移。

原输入收据不事后修改：[`source-before.json`](evidence/backend-final-stage42/source-before.json)、[`source-after.json`](evidence/backend-final-stage42/source-after.json)、[`environment.json`](evidence/backend-final-stage42/environment.json)。Python 3.12.9、uv0.11.3、pytest9.0.3 为本轮实际工具版本。

首次 fence 排除了辅助 reports/evidence。真实 guidance 失败证明该排除不能覆盖**结构扫描**的所有消费者：`checker._worktree_paths` 会枚举全 Git 工作区，即使文件在 evidence，精确 `AGENTS.md` 仍影响结果。首次收据因此不能外推为全体实际 consumer 输入已闭合；它保留为 FAIL 现场。下一轮 fence 必须额外保全完整 Git 路径结构及所有 guidance 内容，不以排除 evidence 规避本次失败。

## 后续要求

根代理第一步指南结构修复后，08:34:17–08:34:25 CST 已实际执行：

- 完整 `uv run pytest tests/test_agent_guidance_check.py -q`：**13 PASS、直接 0**。
- 真实 `make check-agent-guidance`：**FAIL、直接 2**，39 个 AGENTS 中发现 8 个 effective ancestor chain 超过原 **98304 bytes** hard limit，另有 10 warnings。

八个真实链条读数为 channels98448、gateway98416、routers98956、memory101051、middlewares104495、mcp99933、sandbox104399、subagents104752。单文件修复没有自动解决累加继承链；不能用 13 项单元 PASS 替代真实入口。前端 5816 字节原容量合同完整移至新文档，AGENTS30657；旧归档 `.snapshot` SHA90c046e6 保留，checker/预算/测试未变，五项 affected 输入前后无漂移。

证据：[`guidance-repair/receipt.json`](evidence/backend-final-stage42/guidance-repair/receipt.json)、[`actual-guidance-entry.log`](evidence/backend-final-stage42/guidance-repair/actual-guidance-entry.log)。这条新入口红项已交根代理处理；当前不擅自改指导或提高链条预算。

随后按根代理授权，将 backend 共同祖先的详细运行合同完整迁出，08:36:42 CST 冻结：

- [`backend/AGENTS.md`](../../backend/AGENTS.md)：31107→**24110 bytes**，净减少 **6997 bytes**；保留强制阅读指针及原 admission 小节指针。
- [`backend/RUNTIME_CONTRACTS.md`](../../backend/RUNTIME_CONTRACTS.md)：同目录专题文档保留原 Runtime6984、admission469 两块全部字节，原 `packages/...` 相对链接仍有效。
- 反向替换指针、移回原块后，完整旧 AGENTS SHA 与原始 snapshot **逐字一致**。没有新增 AGENTS 路径、删除规则或改 checker/budget/expected shape。
- 08:37:07–08:37:14 的完整 guidance 文件 **13 PASS/direct0**，真实 Make 入口 **direct0**：39 AGENTS、0 errors、15 个既有 soft-limit warnings；最大继承链104752→**97755<98304**。六项受影响输入前后无漂移。

原文、移动 SHA 与反向还原证据：[`move-receipt.json`](evidence/backend-final-stage42/guidance-chain-repair/move-receipt.json)。真实两命令：[`verification.json`](evidence/backend-final-stage42/guidance-chain-repair/verification.json) 及该目录完整日志。此前 8-error 入口 FAIL 不覆盖删除。

当前等待其他产品统一冻结；之后重新冻结全部当前输入，再执行原四分片完整 `make test`、blocking、lint 与只读 format check。不能拿定向 GREEN 代替完整后端收口，也不能改写本轮 FAIL。

最终新收据完成前，本报告整体状态为 **FAIL，最终复验待执行**。无操作 AiPPT3000、无提交/推送、无改动原跟踪运行配置。

## 第二轮输入闭包准备（尚未执行门禁）

当前只完成第二轮runner准备与一次只读捕获，不是最终freeze、不是后端PASS。根代理仍在协调其它真实产品修复，第二轮完整四入口继续hold。

新runner `evidence/backend-final-stage42/final/run.py` 复用首轮原命令执行器，首轮任何日志/receipt未覆盖。它捕获全部Git cached/others/exclude-standard路径结构，精确basename的实际AGENTS发现，包括任意evidence位置；同时记录 `AGENTS.md.snapshot` 内容SHA、非active指导身份和旧文件名。唯一旧归档snapshot SHA仍为90c046e6ebbbe8f0a1f483ef9b478710f7b80b6e8a6cec280f9e30cc82b7a028。

额外消费者审查发现 `backend/tests/test_gateway_runtime_cleanup.py` 真实读取8个 `.agent/skills/smoke-test/` 文件。首轮内容fence也未包括这些输入，因此不能宣称首轮全consumer闭包完整。第二runner从实际测试 `_read` 字面调用的AST提取这8个路径，内容逐个hash，明确consumer路径；不维护易过期的第二份路径清单。checker/tests、backend/contracts、普通docs、skills/CI/scripts/examples/deploy、两前端继续按原宽source集合保全。完整路径清单还覆盖归档更名及运行新增输出，不隐去结构变化。

准备态 [readiness-only.json](evidence/backend-final-stage42/final/readiness-only.json) 明确标注 `PREPARED_ONLY_NOT_FINAL_FREEZE_OR_TEST_RUN`；其中39个实际active指导、1个归档snapshot、8个实际smoke输入均捕获。源项/完整路径数量仅为该准备时刻读数，不外推后续最终输入。

三个刻意跟踪运行配置只记录存在性/SHA并严格比较前后，内容未打印或序列化；可被原reset测试改变的skills-cache sidecar另记生成runtime marker漂移，不冒称源零漂移。完整Gate后会独立保存structural postproof；任何source/guidance/archive/实际smoke输入或执行工具变化都不声明最终闭合。
