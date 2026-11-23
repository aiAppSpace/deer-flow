# Playwright 收集事实守卫修复

2026-10-09，当前 main-wc 工作区。旧 doc-facts 用基线条目加固定常量 38 推算 e2e-parity 数量，并用 test 调用点数验证自身；动态循环展开后真实套件已远超该模型。新增项目 Tabs spec 使旧守卫显式红（1 FAIL / 17 PASS），但加 2 仍无法修复量法。

已删除固定 spec/调用点模型。doc-facts 每个文件仅调用一次真实 Playwright `--list`，复用 loopback wrapper 和 summarizeCollection；显式 PARITY_REQUIRE_REACT=0、PARITY_ONLY 空、浏览器 channel 空，检查子进程成功、无启动错误且总数非零。不会启动服务/浏览器。collector 回归覆盖非零失败退出、空套件、不完整输出、无法启动与单复数正式 summary。

现场收集：777 tests in 18 files，exit 0；日志 `/private/tmp/deerflow-parity-collected-stage24.log`。cold-start 文档已写当前 collected，并将 233 passed/1.6h 标为第七十一轮历史证据，不声称当前完整 777 项浏览器已通过。

修复后 doc-facts + collector：2 files / 22 tests PASS；日志 `/private/tmp/deerflow-doc-facts-collection-green-stage24.log`。ESLint/Prettier PASS。原红测 `/private/tmp/deerflow-doc-facts-collection-red-stage24.log` 保留。完整 standalone/full verify 由主任务在更新后的最终副本重新执行，不能由这 22 个 focused tests 代替。

后续源码新增真实 reflow/状态持久回归后，再次现场收集为789 tests in21files，exit0；日志 `/private/tmp/deerflow-parity-collected-stage25.log`。当前cold-start已同步该实际值，Stage24的777仅为当时收集记录。

Stage26 新增跨端真实回归后再次现场收集为 805 tests in 22 files，exit 0；日志 `/private/tmp/deerflow-parity-collected-stage26.log`，当前 cold-start 已同步真实收集结果。777/789 保留为历史收集快照，不代表当前浏览器执行结果。

Stage28 现场实际 `--list` 为 823 tests in 25 files，exit 0；日志 `/private/tmp/deerflow-parity-collected-stage28.log`。新增 capture-invariants spec 保持自动失败追踪，主 capture spec 独占手动 recorder；不因追踪冲突把收集错误计成 0 或通过。cold-start 同步当前 collected，历史 passed 不变。
