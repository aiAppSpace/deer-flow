# Docker Stage42 实际验收记录

截至本记录，已完成物理准备和真实 BuildKit scratch COPY 校验。两个应用的 canonical 镜像构建、运行态探针、双 hostname OIDC、smoke 与正常停止均 **UNRUN**。不得用 Stage39 或仅 COPY 成功替代这些运行态门禁。

## 已执行范围

- 新物理源目录：`/private/tmp/deerflow-ingress-source-stage42-uiy_00du`。
- 完整准备输入：2954 文件，SHA256 `535eee04a1625eb1de69684fcfe7437d7788b7b1af0bb8698925f5582a23560b`。
- 实际 canonical `.dockerignore` 下的 scratch `COPY frontend/`、`COPY frontend-vue/`：2953 文件，SHA256 `5872cead67ef36f0b56dd2cde733c3d1f42015340bfb069673e92458615fc757`。Vue 1703 文件，React 1250 文件；`.dockerignore` 本身是引擎指令输入，没有进入这两条模块 COPY 输出。
- `engine-context` 实际 direct exit 0，执行工具与完整物理源前后均无漂移。它只复制文件，没有执行 Next/Nuxt 编译或创建应用运行服务。
- Gateway 894 个生产/依赖锁/构建元数据及精确消费 fixture 输入与原候选镜像的不可变源相同，独立 source proof direct exit 0。此证明只覆盖列出的集合，不声称旧整个测试目录与当前工作树一致。
- 新隔离 runtime：`docker/.cache/container-ingress-stage42`；project `deerflow-vue-ingress-8444c50b59`。只计划发布 loopback `2326` 和 IdP `2386`，不占 host `3000`。旧 Stage26 runtime/SQL、Stage39 原始证据均保留。

物理输入覆盖两个完整模块的非 generated/private 文件，包含 `shared/showcase.ts`、`tsconfig.json`、`.nuxtrc`、`components.json`、`eslint.config.mjs`、`nuxt.config.ts` 和两个 canonical Dockerfile。完整排除规则在 manifest 中；这不是推测编译器逐文件读取，也不是镜像传输字节统计。

## 待执行的原完整链路

统一窗口放行后，顺序执行 `build-vue` → `build-react` → `probe` → `probe-oidc` → `smoke`，最后独立执行 `stop-owned.py`。两镜像分别使用原 Vue Dockerfile 默认 runtime target、原 React Dockerfile `--target prod`，不修改参数、超时或资源预算。

`probe` 保留 public Vue → Nginx → Gateway 的真实 auth/API/SSE/upload/download、private Nuxt → Gateway 以及 public real browser WebSocket 三条原探针。`probe-oidc` 保留真实 Nginx 双 hostname authorize/callback/SQL owner/CSRF/state isolation 与 `init:true` 受控 IdP。smoke 保留 nonroot/health/showcase/resource 404 与实际 SIGTERM15 → exit0 → destroy、无 SIGKILL。最终停止只操作 project/service label 验证过的五个本任务服务，保留 runtime/SQL。

应用 image input、实际 COPY、image ID 和编译产物库存分别记录。host probe 使用明确声明的原工作树 pnpm/Playwright/Python 依赖；不能称为隔离镜像内构建依赖。`host-inputs.py` 将在探针实际使用前后另捕获/验证工具、全部 Vue workspace node_modules、Corepack/固定 pnpm 实现、Chromium/headless shell/ffmpeg 以及 Python venv/interpreter/stdlib；该 observer 目前只有 AST 校验，实际 capture/verify **UNRUN**。不声称已完整枚举 host OS/shared libraries。

## 证据入口

- `docs/reports/evidence/container-ingress-stage42/complete-context-fingerprint.json`
- `docs/reports/evidence/container-ingress-stage42/engine-copy-fingerprint.json`
- `docs/reports/evidence/container-ingress-stage42/executions/20261010T025624303587Z-engine-context/receipt.json`
- `docs/reports/evidence/container-ingress-stage42/backend-source-proof.json`
- `docs/reports/evidence/container-ingress-stage42/preparation.json`
- `docs/reports/evidence/container-ingress-stage42/preparation-tools-final.json`

Stage42 验收工具从 Stage39 原工具派生；逐文件逆变换实证仅 stage/tag/evidence/runtime/project 标识变化。新增 `run-phase.py` 仅保留原 argv/stdout/direct exit 并记录源与工具前后 fence；它不会把 command 非零改成成功。最终成功结论必须以各实际 phase receipt 和 host input verify 齐备为准。
