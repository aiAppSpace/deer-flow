# Linux Stage28 阶段证据（不是最终源码验收）

独立容器 `deerflow-vue-linux-gates`，Linux 原生依赖，未访问原 checkout 构建缓存。源码指纹见同目录 `2026-10-09-linux-stage28-source-fingerprint.json`，聚合 SHA256 为 `2971be76b7c6ee2637b00337bb24ddc4e1b8f0b14ef2ef184441b23eb3277e26`（940 个生产输入）。

正式 `playwright.visual.config.ts` 在该快照上 production build 后运行：**8 PASS / 0 FAIL / 0 SKIP / 0 RETRY / 0 ERROR**，200185.99ms，未更新 baseline、未放宽阈值。原始 JSON/log 保存在 `docs/reports/evidence/2026-10-09-linux-stage28/visual.{json,log}`。通过测试的当前 PNG 默认不会保留，9 图实际回读尚未执行，不能用基准图代替当前截图。

此快照之后 root 修复真实 Stop 生命周期、cap 修复 Tooltip 嵌套菜单的原生 reference owner。该阶段通过不能覆盖新生产代码。asset-budget 在同一旧产物上 PASS（679 chunks，15961676 raw / 3796909 gzip；精确各桶及文件见 `evidence/2026-10-09-linux-stage28/assets.{json,log}`）。payload 12 与9图回读留待两处修复统一稳定后，从新指纹整体刷新并完整重跑；本报告不将它们记作 PASS。
