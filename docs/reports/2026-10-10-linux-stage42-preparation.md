# Stage42 Linux 完整复验准备

当前仅准备，所有本轮门禁 **UNRUN**。未复制最终源码、创建新容器、安装依赖或启动构建；等待 root 最终生产/测试冻结与明确构建窗口。Stage39 报告、挂载目录及产物均作为历史证据保留。

## 环境与隔离

已只读核对 `deerflow-vue-linux-gates` 的实际 image ID 为 `sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`，旧 `/work` 仍挂载独立 `deerflow-standalone-yp3BMR`，容器命令为 `sleep infinity`，Node 为 `v24.14.1`。Linux ARM64、字体和 Playwright 浏览器沿用已验证镜像，实际二进制与版本在新运行前重新采集，旧指纹不冒充新运行结果。

收到窗口后创建全新实体 snapshot 和专属 `deerflow-vue-linux-stage42` 容器，以同一镜像挂载新 snapshot 到 `/work`。不覆盖旧挂载目录，不共享原 checkout 的 `node_modules`、`.nuxt`、`.output`、`.cache` 或 React `.next`。可以从旧独立目录复制实体 Linux 依赖，随后重新枚举文件及链接指纹并核对锁文件；不沿用固定的 1750 项清单。

源码 copy 排除 React、私有运行配置、依赖及所有生成目录，保留 root scripts/contracts/config templates 和 Vue workspace 的隐藏配置、shared、测试、预算与基准。新 `capture-inputs.py --scope linux` 在构建前与结束后重新完整枚举 source/snapshot/dependencies，含新增/删除集合；实际执行工具在副本外单独 SHA 捕获。当前 prepared 工具清单见 [preparation.json](evidence/2026-10-10-linux-stage42/preparation.json)。

## 完整正式命令

替换下述容器名和 output stage 标识是隔离执行接线，不改变配置、启动 240000ms、测试预算、workers、截图阈值或 baseline。

```bash
docker exec -w /work/frontend-vue \
  -e PLAYWRIGHT_JSON_OUTPUT_NAME=/work/frontend-vue/test-results/linux-visual-stage42.json \
  deerflow-vue-linux-stage42 node scripts/keep-e2e-failure-artifacts.mjs -- \
  node scripts/with-loopback-no-proxy.mjs -- \
  python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test \
  -c playwright.visual.config.ts --reporter=line,json

docker exec -w /work/frontend-vue \
  -e PLAYWRIGHT_JSON_OUTPUT_NAME=/work/frontend-vue/test-results/linux-payload-stage42.json \
  deerflow-vue-linux-stage42 node scripts/keep-e2e-failure-artifacts.mjs -- \
  node scripts/with-loopback-no-proxy.mjs -- \
  python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test \
  -c playwright.config.ts tests/e2e/route-payload.spec.ts --reporter=line,json

docker exec -w /work/frontend-vue deerflow-vue-linux-stage42 \
  node scripts/asset-budget.mjs
```

正式完整范围为 8 visual、12 payload、asset。执行器保留原直接退出码与原始 JSON/log；失败不得更新截图基准或降低预算。两次正式构建串行，并与其他 builder 错峰。

正式通过后，沿用已验证的 clone-only observer 方法，在原断言后追加 9 张实际截图与 URL/请求文件观察；复用第二次正式产物，不额外构建。所有原断言继续执行，两个临时 fixture 原字节恢复，观察工具与 preview 在 finally 清理。逐张 `view_image` 回读 9 PNG，比较六组正式与观察读数的文件集合/raw/Brotli，生成完整 JS raw/gzip 指纹；最终 source/dependency/tooling 前后再验。

本轮使用新 evidence `docs/reports/evidence/2026-10-10-linux-stage42/` 与新最终报告，不覆盖 Stage39。若 root 新冻结改动了生产、测试或 gate，先刷新输入再执行；辅助报告的后续变更单列，不伪称全树零漂移。Linux 结果不替代完整 cross-app、Docker、真实认证、外部入口或 standalone。
