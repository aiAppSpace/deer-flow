# Linux Stage 33 精确快照验收（历史）

> Stage34 后续 CodeBlock、Copy、引用弹层和 ScheduledCard 生产修复已使当前源码变化。本报告仅保留所列精确快照的通过证据，不作为新源码最终通过结论。

固定 Vue source：941 inputs，SHA256 `d5a4c4661ef2183118125ca8c26a56606241b3128290cdba11275354e025c59a`。独立 Linux aarch64 / Node 24.14.1 原生依赖；React 与私有运行配置均未复制。包含 00:41:44 CST 冻结的 AgentChat demoTitle 与 ExportTrigger 使用 React 相同 live-thread 导出输入的修复。

| 门禁 | 结果 |
| --- | --- |
| 正式 visual | 8 / 8 PASS，direct exit 0，原 240s、原基准和阈值 |
| 实际截图补证 | 同产物原 8 项断言再次 PASS，9 PNG 已逐张 view_image 回读 |
| 正式 route payload | 12 / 12 PASS，direct exit 0 |
| URL 补证 | 同产物 12 / 12 PASS，6 组字节与正式测量精确相同，4 组 hover/focus URL |
| Asset budget | PASS，direct exit 0，预算未修改 |

## 实测字节

| 路由 | 语言 | Critical files | Raw | Brotli | Prefetch files |
| --- | --- | ---: | ---: | ---: | ---: |
| / | en-US | 37 | 389508 | 131094 | 0 |
| /login | en-US | 47 | 461367 | 149730 | 0 |
| /workspace/chats/new | en-US | 176 | 1467173 | 451066 | 0 |
| / | zh-CN | 37 | 387768 | 132569 | 0 |
| /login | zh-CN | 47 | 459627 | 151205 | 0 |
| /workspace/chats/new | zh-CN | 176 | 1465433 | 452541 | 0 |

全部 678 JS：raw 15972619 bytes / gzip 3798676 bytes。vendor-ui：581665 raw / 184875 gzip。i18n：170868 raw / 60415 gzip。最大 raw 块 779847 bytes（emacs-lisp-C9PiwqqW.js）；最大 gzip 块 230136 bytes（wasm-BnjxR4X6.js）。

## 源码与证据边界

- 941 生产输入与 50 个实际执行门禁输入：snapshot 内及当前 root 对捕获清单均零漂移。截图/URL 补证仅在 clone 添加采集代码，全部原断言保留；两个 fixture 已精确恢复，临时 config 已删除、手动预览进程已停止。
- 辅助文档 docs/plans/vue-parity-cold-start.md 在捕获后更新 CURRENT 为最终 751 / 877 / 28；它不进入本轮 Nuxt build/视觉/负载/资产执行。其单独字节变化已记录在 source-boundary.json，未声称全部辅助文档零漂移。下一轮 standalone 将复制最终文档。
- Stage32 的 pre-W11 8 / 12 PASS 保留为历史；本轮才包含最终公开报告导出修复。
- Vue-only Linux 验收不能代替真实后端、身份会话、全量跨端、Compose 或 standalone。最终 standalone basic / with-e2e 当前仍待 root 的构建和 801x 窗口，不把旧结果外推。

全部日志、Playwright JSON、6 组请求文件与 URL、4 组交互 URL、raw/Brotli 文件明细、全部资产桶、9 PNG 与逐图结论、精确源码清单位于 `docs/reports/evidence/2026-10-10-linux-stage33/`。
