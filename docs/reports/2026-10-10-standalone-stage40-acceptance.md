# 无 React 独立运行验收：Stage40

本报告记录独立副本的真实执行。它不替代完整双端对照、原仓库聚合、部署或外部环境验收。

这是下一轮生产修复之前的精确 checkpoint。后续键盘对照发现的实际差异正在另行修复；本报告的通过不外推到后续源码。增强模式及新源完整最终验收等待统一冻结。

## 当前状态

- Stage40 默认完整模式：**PASS**，原 `make standalone-sim` 直接退出 0，450.45 秒；全部八个原命令直接退出 0。
- Stage40 `--with-e2e` 完整模式：未执行。
- 历史 Stage39 默认完整模式：**FAIL**，原 `make standalone-sim` 直接退出 2；内部完整 Vitest 直接退出 1。

## 历史失败与观测修复

Stage39 的真实 JSON 记录为 462 个测试文件、3,763 条断言通过、60 条按既有条件跳过、零断言失败。退出码仍是失败，不能据 JSON 的 `success: true` 判通过。60 条跳过分别为 46 条缺 React 对照用例和 14 条缺后台 `.venv` 的夹具用例；没有修改跳过条件。

当时只有 JSON reporter，未留下导致非零退出的具体未处理错误栈，因此具体消费者根因仍未知。独立真实 Vitest 负控证明：一条通过断言加一个未处理 rejection 会使 JSON reporter 输出 `success: true`，进程却退出 1；同时启用 default 和 JSON reporter 后，仍退出 1，并打印实际错误栈。

观测修复只增加 default reporter，以及存在有效 JSON、进程退出非零时打印已捕获的原始 stdout/stderr。原退出码检查、必需文件收集检查、失败保存、清理、预算和测试范围均保留。新增三项实际 orchestrator 边界回归仅替代昂贵子命令，与真实 Vitest reporter 负控分别记录。旧源该边界测试 1 FAIL / 2 PASS，新源相关两文件 5 PASS；类型、lint、格式检查均直接退出 0。

证据：`docs/reports/evidence/2026-10-10-standalone-stage39/reporter-observability/`。历史完整失败保留在同阶段的 `default/`，不会被新运行覆盖。

## Stage40 冻结输入

独立 source-only outer：

`/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-RAZWlq`

由原有 `createStandaloneWorkspace` 复制，未裁剪复制范围。没有 React、根私有运行配置或已安装依赖。77,601 是保守的完整非生成物理复制树条目数，包含历史证据文件，**不是产品源码数量**。

该集合 SHA-256：`ce6413dff6aad364b9053177a3f40da20bf372361ed63f9d15720e95d86086a5`。首次核验与原仓库在该范围零差异；各原始执行副本还将分别进行前后核验。

冻结观测修复：

- `frontend-vue/scripts/standalone-sim.mjs`：`be69b9e272f5e94d7e7c726138cded5ccbac0bb7ad640a95979972379896e114`
- `frontend-vue/tests/unit/tooling/standalone-sim-failure-output.test.ts`：`992ca116cd1f0645086780734e727d153cafa561b5abdaeb12a382ad93f1a0bb`

完整输入清单、复制缓存边界和执行工具原始字节记录位于 `docs/reports/evidence/2026-10-10-standalone-stage40/`。

## Stage40 默认完整模式实际结果

实际内层副本为 `deerflow-standalone-8EdRxZ`；原离线冻结安装、原生产构建、完整 Vitest 及三项无 React 辅助脚本全部直接退出 0。完整单测收集 463 个文件，其中 452 个文件通过、11 个文件按既有条件整文件跳过；3,766 条断言通过、60 条既有条件跳过、零断言失败、零未处理错误。60 条跳过已经逐条记录，仍为 46 条缺 React 对照和 14 条缺后台 `.venv`，未改变条件。

Node 为 v22.23.2 / Darwin ARM64，pnpm 10.26.2；原离线缓存路径为 `/Users/wangcheng/Library/pnpm/store/v10`。实际安装的 57,012 条原生依赖文件/内部链接 SHA-256 为 `3a87203ba112fc65aa8c65b67ac53aea8f837fd3ab21447f67e9b2e2f2d73603`。

完整冻结 outer 与执行 inner 的源码、全部实际安装依赖、复制缓存，以及外部执行工具均前后零差异；实际内层副本已按原逻辑清理。原模拟器登记 21 条已执行、7 条未执行（纯数据和默认模式未执行的 E2E 项），零红项。该通过只对应此次默认完整模式，不能覆盖历史失败或尚未执行的增强模式。

实际证据：`docs/reports/evidence/2026-10-10-standalone-stage40/default/{actual-run.json,actual-commands.json,actual-vitest.json,actual-declared-skips.json,input-receipt.json,input-verify.json,execution-tools-before.json,execution-tools-after.json}`。

## 执行与证明边界

默认模式执行原 `make standalone-sim`；增强模式执行原 `node scripts/standalone-sim.mjs --with-e2e`。每个模式自行创建内层副本、原样初始化 Git、离线冻结安装、生产构建和完整单测。增强模式还按原逻辑离线同步后台依赖，运行全部无 React 收集检查及 mock/backend 聚合。

遥测仅观察原命令及其直接退出码，不替换原命令。完整输入、所有实际安装的 Vue workspace 原生依赖、增强模式实际后台 `.venv`/解释器/标准库分别核验。安装前失败应标为依赖核验未到达。最终结论还须检查所有必要 receipt 实际存在且核验退出 0，不能仅根据外层包装器退出码推定。

复制树中的 `.pnpm-store` 按辅助缓存单独完整登记；实际安装缓存路径与安装后的原生字节另记。没有把复制缓存的外部项目链接冒称为隔离源码或实际安装依赖，也没有声称对整份共享全局缓存做过字节核验。

独立范围不含真实 React 双端执行；缺 React 的收集检查通过不能外推成双端行为通过。增强模式最终结论以真实聚合直接退出结果为准。
