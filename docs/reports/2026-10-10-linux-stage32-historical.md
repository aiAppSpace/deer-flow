# Linux Stage 32 历史快照验收

本轮只证明固定旧源码；不代表随后 W11 公开报告导出修复后的最终生产源。

- Source: `941` inputs / SHA256 `6fd61f6e2130c0f3e13acb5a4d5182ac37aaeaea717f7d10a3c18e15ccfd59bf`。清单见同目录 `2026-10-10-linux-stage32-source-fingerprint.json`。
- Visual：正式 8 / 8 PASS，direct exit 0，原 240s 启动限制、未更新基准。
- Route payload：正式 12 / 12 PASS，direct exit 0。
- Asset 与当前 9 张实际 PNG 回读：本轮 UNRUN，未借历史结果冒充。
- 失效边界：capabilities_acceptance 真实浏览器证实 Vue 公开报告导出为 Untitled.md，而 React 使用报告真实标题；AgentChat fallback 的 demoTitle 根因修复将更改生产源。
- 本轮完整日志、JSON 和初始中断边界见 `evidence/2026-10-10-linux-stage32/`；初始中断 0 用例并非产品失败，后续同源正式结果独立保留。

后续 Stage 33 将重新捕获当前源码并执行正式视觉、负载、资产和实际截图回读。
