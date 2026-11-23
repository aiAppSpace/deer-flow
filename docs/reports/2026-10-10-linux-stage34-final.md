# Linux Stage34b 精确快照验收（checkpoint）

正式 visual 8/8、route payload 12/12 和 asset budget 均 direct exit 0。原配置、240 秒启动上限、基准及预算未修改。两组同产物采集分别再次通过全部原 8/12 项断言，9 张实际 PNG 已逐张 `view_image` 回读，六组路由字节与正式测量精确一致。

本轮固定 942 个生产/工具输入，SHA256 `6d6de968eb44da804c10d5d83d8cdbe791150609678bba597fcb6ce2d0bd4013`，独立 Linux aarch64 / Node 24.14.1、原生独立依赖，未复制 React 或私有运行配置。包含 CodeBlock 显示尾换行、Copy 窄屏可达、引用弹层几何 owner、ScheduledCard、Earlier steps 和 Lark 层级修复。

| 验收 | 结果 |
| --- | --- |
| 正式 visual | 8 PASS / 0 skip / 0 unexpected / 0 flaky，111.6 秒，direct 0 |
| 9 PNG 补证 | 同产物原 8 项断言 PASS，27.6 秒，direct 0，9 张逐图回读 |
| 正式 route payload | 12 PASS / 0 skip / 0 unexpected / 0 flaky，93.2 秒，direct 0 |
| 实际 URL 补证 | 同产物原 12 项断言 PASS，15.4 秒，direct 0；6 路由组、4 hover/focus 组 |
| Asset budget | 原预算 PASS，direct 0 |

## 实测路由字节

raw/Brotli 来自浏览器实际请求过的去重产物文件；Brotli 使用构建的 `.br`，小文件无 `.br` 时按 raw 计，与正式 fixture 相同，并非网络 wire bytes。

| 路由 | 语言 | Critical files | Raw | Brotli | Prefetch files |
| --- | --- | ---: | ---: | ---: | ---: |
| / | en-US | 37 | 389508 | 131081 | 0 |
| /login | en-US | 47 | 461367 | 149717 | 0 |
| /workspace/chats/new | en-US | 176 | 1468499 | 451397 | 0 |
| / | zh-CN | 37 | 387768 | 132556 | 0 |
| /login | zh-CN | 47 | 459627 | 151192 | 0 |
| /workspace/chats/new | zh-CN | 176 | 1466759 | 452872 | 0 |

全部 678 JS：raw 15974191 / gzip 3799134 bytes。vendor-ui：582616 raw / 185221 gzip；i18n：170868 raw / 60415 gzip。全部 vendor 桶及逐文件明细在证据目录。

## 执行与源码边界

首次 visual 在原 240 秒 webServer 启动阶段超时，0 测试执行，未产生视觉断言失败。原日志、JSON 和构建进程记录保留；资源重编译结束后，同源、同配置、同 240 秒重跑得到正式 8 PASS，未提高超时。负载原 12 项随后完整通过。

捕获的 942 个既有文件与 50 个实际执行门禁输入，在 root 和 snapshot 对捕获清单逐文件 SHA 均零变化。root 随后新增 `frontend-vue/scripts/lib/git-file-inventory.mjs`，属于未在本轮 Linux visual/payload/asset 执行的 gate-only 工具；不声称新增文件也由旧快照覆盖。两个采集 fixture 已精确恢复、临时 config 删除、专用手动预览停止，未更新快照基准。

本轮完成后审计发现 W00 scheduled contract 必须落实 generator→consumer，root 已交 cap 修复，Vue 生产源将变化。**本报告仅为所列精确快照 checkpoint，不证明 W00 后源码通过。** 完整 cross-app、当前 canonical、真实后端和后续 standalone 由各自最终门禁给证据；standalone basic / with-e2e 等待统一新源冻结及 801x 释放，当前不记 PASS。

全部日志、Playwright JSON、精确输入清单、6 组实际 URL/优先级、4 组 hover/focus URL、文件字节、资产桶、9 PNG 与逐图结论：`docs/reports/evidence/2026-10-10-linux-stage34/`。源码细分见 `source-boundary.json`，总结果见 `summary.json`。
