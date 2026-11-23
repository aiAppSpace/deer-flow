# Stage 28 Linux 独立验收执行交接

接收者：composer_acceptance。收到 artifacts_acceptance 的 selector 根因修复真实 artifact PASS + stable 通知后执行。不得构建原 checkout，不更新截图基准，不放宽阈值。

## 已有资源

- 容器：`deerflow-vue-linux-gates`
- 容器工作根：`/work`
- Host 实体根：`/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-yp3BMR`
- 独立 Linux 原生 `frontend-vue/node_modules` 已存在（不是原目录 symlink）。
- `/work/frontend` 不存在；私有 root `.env`、`config.yaml`、`extensions_config.json` 不复制。
- Stage 28 初始源码已同步，但 selector fix、对应新 unit 和最新库存文档需要 stable 后再次同步。可按下面命令同步全部源码，保留独立依赖。

```bash
rsync -a --delete --exclude=frontend --exclude=node_modules --exclude=.git --exclude=.cache --exclude=.nuxt --exclude=.output --exclude=.next --exclude=.venv --exclude=.deer-flow --exclude=__pycache__ --exclude=.pytest_cache --exclude=.ruff_cache --exclude=.hypothesis --exclude=test-results --exclude=playwright-report --exclude=coverage --exclude=logs --exclude=.env --exclude='.env.*' --exclude=config.yaml --exclude=extensions_config.json /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/ /private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-yp3BMR/
```

同步后移除 **clone 内** `.nuxt`、`.output`、`node_modules/.cache/nuxt`；核依赖实体路径、平台和两端锁文件相同。Vue lock 未变时无需重装。不得动原 node_modules/cache。仓库 `.git` 仍是既有独立 Git 初始快照，不把其 HEAD 当生产源码指纹。

## 串行命令

两个正式 Playwright config 都会自行 production build + preview（每次独立构建），不要并发访问同一 clone 构建目录。

```bash
docker exec -w /work/frontend-vue -e PLAYWRIGHT_JSON_OUTPUT_NAME=/work/frontend-vue/test-results/linux-visual-stage28.json deerflow-vue-linux-gates node scripts/keep-e2e-failure-artifacts.mjs -- node scripts/with-loopback-no-proxy.mjs -- python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test -c playwright.visual.config.ts --reporter=line,json

docker exec -w /work/frontend-vue -e PLAYWRIGHT_JSON_OUTPUT_NAME=/work/frontend-vue/test-results/linux-payload-stage28.json deerflow-vue-linux-gates node scripts/keep-e2e-failure-artifacts.mjs -- node scripts/with-loopback-no-proxy.mjs -- python3 ../scripts/pnpm.py --dir frontend-vue exec playwright test -c playwright.config.ts tests/e2e/route-payload.spec.ts --reporter=line,json

docker exec -w /work/frontend-vue deerflow-vue-linux-gates node scripts/asset-budget.mjs
```

visual 完整 8 tests、9 PNG；payload 完整 12 tests（先实际 `--list` 复核），6 条 measured route + 4 hover/focus + 2 renderer guards。任何失败保留原 JSON/trace/PNG，并直接通知 root/artifacts_acceptance；不盲目更新基准。

## 证据

1. 对当前 clone 生产输入（`frontend-vue/app`, `packages`, `server`, `config`, `public`, `nuxt.config.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` 等实际构建输入）记录 sorted relative paths + 每文件 SHA256 + 聚合 SHA256，附排除项、git branch 与 source HEAD。可沿 `docs/reports/2026-10-09-linux-final-source-fingerprint.json` 现有 `sources` 模型，但不能只沿旧清单遗漏新文件。
2. 新建 Stage 28 文件，不覆盖 Stage 23 历史测量。6 组 route 要保留全部 URL、critical/prefetch files、raw/br 精确数，所有禁预取/renderer/pageErrors 断言保持原样。
3. asset 输出保存完整精确 bytes（必要时只读复用 asset 脚本测量逻辑输出 JSON），给 cap/root all raw/gzip、UI gzip、i18n raw/gzip 和最大块。
4. 实际 9 张当前 Linux PNG 回读检查，结果写入 durable repo `docs/reports`，不能只看 JSON PASS。正式基准位于 `frontend-vue/tests/e2e-visual/*-snapshots/*-linux.png`；当前 run 还需按 Playwright output/trace 对应回读截图。
5. 完成后将 Stage 28 source SHA、8/12/asset PASS/FAIL、9 图视觉检查结论、证据绝对路径回传 root 与 artifacts_acceptance。
