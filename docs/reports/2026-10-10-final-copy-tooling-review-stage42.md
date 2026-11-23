# Stage42 最终副本执行链独立审查

审查仓库：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。
本审查只读产品、正式测试和执行工具；仅创建本报告及 `docs/reports/evidence/copy-tooling-review-stage42/` 下独立观察工具/证据。未安装、构建、运行完整测试、启动或停止服务。审查中的主任务修复由 root 实施。

## 结论与实际边界

原始执行命令没有缩小范围，源码只在 Nuxt 配置加入 `buildDir: "./.nuxt"`；新 Git 索引独立，未接触原仓库 Git 元数据。实际准备副本 `/private/tmp/deerflow-next-final-stage42-ymsxbkft` 的两个 `node_modules` 是物理目录，7,314 个依赖链接全部解析在本副本内；抽查两个 pnpm 安装锁文件与旧副本 inode 不同。

但物理目录独立并不等于全部运行时解析独立：原 `.bin` 脚本保留原仓库的 `NODE_PATH`，实际 Node 启动已证明可回退原安装。这一准备前缺陷已交 root，新增标准离线安装与实际 shim 启动准入正在闭合。完整 gate 尚未在本次新副本执行，不能由本审查称 PASS。

最终应以 root 后续 `dependencies-ready.json`、每个 phase 的源码/两端依赖/后端环境前后 receipt，以及实际直接退出码为准。本报告的负控不是产品验收结果。

## 审阅入口

| 文件/消费者 | 审查内容 |
| --- | --- |
| `docs/reports/evidence/root-stage42-checkpoints/refresh-next-copy.py` | 当前 Git tracked + 全部 unignored 文件；删除已退休路径；逐文件复制和 hash；唯一 Nuxt 转换；独立 Git 索引 |
| `docs/reports/evidence/root-stage42-checkpoints/prepare-browser-copy.py` | APFS 物理 sibling clone；源码 hash 保留；对新 sibling 重做依赖准备 |
| `docs/reports/evidence/root-stage42-checkpoints/run-frozen-gate.py` | 原 Make/pnpm 入口、真实子进程返回值、源码新增/删除/内容漂移、依赖/工具前后检查 |
| `docs/reports/evidence/root-stage42-checkpoints/prepare-frozen-dependencies.py` | 标准 workspace `install --frozen-lockfile --offline`；不跳过 lifecycle；全新 backend venv；shim 原生启动归属 |
| `docs/reports/evidence/2026-10-10-standalone-stage42/capture-standalone-inputs.py` | 两端每个物理安装及内部 link，明确列出生成缓存排除项 |
| `docs/reports/evidence/2026-10-10-standalone-stage42/backend-inputs.py` | 实际 venv、解释器 binary、标准库目录文件及前后差异 |

审查时版本 SHA、实际 observations 与同一轮前后工具 SHA 见 `docs/reports/evidence/copy-tooling-review-stage42/audit-probes.json`；该轮工具漂移为零。`reviewed-*.py` 保留该轮审阅字节，后续 root 修复不覆盖这些观察快照。

## 发现与最小闭合

### 1. 已实证：复制后的 pnpm shim 仍允许回原安装

原 `prepare-next-copy.py` 复制已安装 `node_modules`，只验证 manifest/lock 和物理根目录。复制不重生成 `.bin` 中的绝对 `NODE_PATH`。

独立 preload 在包入口执行前读取 `Module.globalPaths` 并立即退出，未运行 Nuxt/Next/Vitest：

| 实际副本命令 | 包入口位于本副本 | 原 checkout fallback 数 | 准入退出 |
| --- | --- | ---: | ---: |
| frontend `.bin/next` | 是 | 5 | 1 |
| frontend-vue `.bin/nuxt` | 是 | 4 | 1 |
| frontend-vue `.bin/vitest` | 是 | 3 | 1 |

这证明运行时搜索链存在外部 fallback；没有声称某一次历史 build 已实际从 fallback 读取模块。

root 新工具采用本副本自己的 `scripts/pnpm.py` 与正常 frozen/offline install，随后检查全部 `.bin` 旧根引用/所有依赖 link，并对实际 gate 使用的 12 个 shim 做启动 preload。方向正确；必须取得安装后 probe 的真实零外部结果，不能仅依据 install 退出 0。

观察工具：`docs/reports/evidence/copy-tooling-review-stage42/shim-global-paths-probe.cjs`。实际 preload 读取 `DEERFLOW_PROBE_COPY` 和 JSON 数组 `DEERFLOW_PROBE_FORBIDDEN_ROOTS`；任何禁根搜索路径或包入口越出本副本都退出 1。系统 Node binary 另由 runtime receipt 记录。

### 2. 已收口接线：后端依赖不能只由 imports 检查代替

初版 runner 只捕获 frontend 两套安装，没有对 `.venv`、实际 interpreter、stdlib 做前后验证。一次 `app/deerflow` import 只证明当次项目入口归属。

root 已接入 `backend-inputs.py` 的每 phase capture/verify，且 backend verify 非零进入 gate FAIL。该 helper 可复用，实际当前环境为：

- `sys.prefix` 位于本副本 `backend/.venv`；三个项目 imports 都位于本副本 `backend`。
- `.venv` 外链仅三个 Python 别名，均指明确定义的 pyenv 3.12.9 interpreter；没有外部目录 link。
- 两个项目 editable `.pth` 指本副本 packages；`uvicorn/pytest/deerflow` Python shebang 指本副本 `.venv/bin/python`。
- 合法 pyenv interpreter 和 stdlib 是显式宿主运行时输入，不应泛化禁止。当前 `python312.zip` 搜索路径不存在，应记 NOT_PRESENT。

browser clone 后必须新建 venv，再运行原 `uv sync --frozen --offline --extra browser`，避免旧 console shebang/editable 元数据保留 template 路径。root 新准备工具已采用这一方法。建议把 `sys.prefix/sys.path`、项目 imports 和实际 Python console shebang 的归属作为准入；后端 helper verify 应同时比较 runtime 结构/路径，而非只比较 binary hash。

### 3. 已有真实负控：忽略的环境输入可以漏过 Git 清单

初版 `capture()` 在隔离 scratch 中新增 ignored `frontend-vue/.env.local` 后，文件 hash 清单和 `gitWorktreePaths` 完全不变；环境文件却是 Nuxt 的实际输入。

root 已增加 root/frontend/frontend-vue/backend 的禁止环境/runtime 文件缺席断言。最新原函数 AST scratch 负控实际拒绝该 `.env.local`，见 `audit-probes.json` 的 `ignoredInputNegative.admissionRejected=true`。这保持原 Git 扫描范围，不以扩大忽略表掩盖漏输入。

### 4. 已有真实负控：继承 Make dry-run 会造成空执行返回 0

scratch 原命令形态 `make -j1 gate`，recipe 原本失败（Make 直接退出 2）；继承 `MAKEFLAGS=-n` 后 recipe 未执行而直接退出 0。初版 runner 未拒此变量。

root 已拒非空 `MAKEFLAGS/MFLAGS/GNUMAKEFLAGS/MAKEOVERRIDES`，并拒 `E2E_GATEWAY_URL`，避免 factory 的 `??=` 保留外部 Gateway URL。当前观察终端这些控制变量均为空，未据此指控历史实际 gate 是假绿。

依赖准备也应在 installer 前拒未声明的 `NODE_PATH/NODE_OPTIONS/PYTHONPATH/PYTHONHOME/UV_PROJECT_ENVIRONMENT` 覆盖，或逐项记录并证明解析/安装仍属于本副本。root 已接受该最小建议。

### 5. 已消除误漂移风险：执行元数据不是源码新增

新增根 `dependencies-ready.json` 原本会进入 unignored Git 清单，触发 gate 准入的路径数量不等。root 已在独立 `.git/info/exclude` 精确登记它，与既有 `preparation-source.json/final-source-frozen.json` 一起排除；未扩大产品源码排除范围。

### 6. 需要准确标注的宿主工具范围

初版 `runtime_capture()` hash 的 pnpm/corepack 是约 200-byte wrapper；实际 wrapper `require('./lib/corepack.cjs')`，再加载 pinned pnpm 缓存实现。它们与 Node/Python interpreter 属于宿主工具链，不能把仅四个入口文件的 hash 称为完整实现输入零漂移。

最小闭合是记录实际 Corepack implementation、选中 pnpm 10.26.2 实现以及 uv/make 等实际工具输入，或准确限定原 receipt 的范围。未提出把整个 OS/所有无关用户目录纳入，也未改变任何产品 gate。

## 范围与退出码复核

- canonical 仍为原 `export-openapi-check verify asset-budget consumer-check audit`，附加原 extension fixture；React 仍原 `check` 成功后完整 `test`。
- cross-app 仍原完整 `e2e-cross-app`，mock/backend/external 仍各自原聚合。唯一拓扑调整是明确独占的端口；无 case filter、baseline update、accept、skip 或新预算。
- Nuxt 源码转换只插入 `buildDir: "./.nuxt"`；其余所选源码逐字 hash 一致。关键 `.nuxtrc/shared/showcase.ts/tsconfig/components.json/eslint/Nuxt root config/scripts/pnpm.py` 实际在准备副本中。
- APFS COW 文件系统可以共享存储块，但目录/文件修改互相隔离；没有 shared node_modules root link。复制本身无法证明生成脚本的绝对路径已重定位，因此使用前述实际 probe。
- 原子进程直接失败原样传播；原 gate 返回 0 但源码、依赖、工具或后端 verify 漂移时 wrapper 返回 1，没有把 FAIL receipt 转成成功退出。
- gate 前的准入失败会保持非零；若没有最终 execution receipt，应标 PRECONDITION_FAIL/NOT_REACHED，不能从缺结果推定 PASS。

本次没有运行任何最终 build、完整 unit 或 browser suite。后续 root 修复、真实依赖准备与完整执行必须产生新的实际 receipt；本报告及准备前 RED 证据保留其精确历史边界。
