# 调度历史中文夹具初始化竞态修复

修复仅涉及两个 E2E 文件，不改产品、语言持久化策略、测试预算或中文断言。原完整 512 用例运行中两项中文历史测试失败，现场保存在 `evidence/capabilities-final-stage38/initial-mock-failure/`。

两条夹具先以英文启动应用，再直接写中文 cookie 并刷新。真实浏览器仅观察 locale 的 setter 时序，确认其中运行历史夹具在写入 `zh-CN` 后 2.4ms，被先前尚未结束的 `app:mounted` 默认语言选择写回 `en-US`，下一份文档因此仍是英文。本次两项精确诊断为 1 PASS /1 FAIL，不能描述成每次必现；另一项使用相同前置模式，原全量现场已实际失败。

现在复用已有 `scheduled-fixtures.setLocaleCookie`，在首次导航前设置中文。两条原真实 reload 操作继续保留，32 与39项 matcher 调用的 AST 分别完全相同。两个原测试文件全部10项在同一既有生产产物上通过，直接退出0；tests types、lint、format均退出0。产品文件修改0，新增用例0，原预算未变。

逐文件 SHA、原生时序、完整失败/通过日志与检查结果见 `evidence/root-stage38-checkpoints/scheduled-locale-native/repair-freeze.json`。完整最新 mock 聚合仍须在最后布局修复冻结后重跑，本次定向通过不替代它。
