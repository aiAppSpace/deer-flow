# Stage43 standalone 默认完整验收

最终默认入口 **PASS**：原 `make standalone-sim` 实际直接退出 0，总耗时 **615.478306209 秒**。本轮未运行 `--with-e2e`，它仍为 **UNRUN / 等待固定端口窗口**。

## 实际执行

2026-10-10 11:26:08.500602 至 11:36:23.981278（Asia/Shanghai），原入口在无 React、无根运行配置、无已安装依赖的冻结外层副本执行，并按原 factory 另建内部副本。Git 初始化、完整 Git 登记、冻结离线 pnpm 安装、生产构建、三个缺 React 时的标准脚本以及完整 Vitest，共 **8 个原始命令全部直接退出 0**。原测试、预算与范围均未修改。

- Nuxt 生产构建：46.555 秒，直接退出 0。
- 完整 Vitest 子进程：49.600 秒，直接退出 0。
- 原 default reporter：**467 文件通过 / 11 文件声明跳过 / 478 文件收集**；**3,870 测试通过 / 60 声明跳过 / 3,930 收集**，0 断言失败、0 未处理异常。
- 60 条跳过中，46 条依赖明确缺席的 React，14 条依赖默认模式不安装的 backend venv；没有新加 skip。逐条名称见 `actual-declared-skips.json`。

## 输入与隔离闭合

| 实际范围 | 数量 | SHA-256 | 前后结果 |
| --- | ---: | --- | --- |
| 冻结 outer 与实际 inner 的完整非生成源码树 | 82,512 | `053078e971a3d30bfeae3fa1b4ea441a4f7b19c841c8ae0e95b05eb7c2c7302e` | 全部新增/删除/修改为 0 |
| 实际冻结离线安装后的 Vue 原生依赖文件与链接 | 57,012 | `5db4e69decfd69f110df6d0ea9554cb68304f8d39b7ff89d3900383e20bb023d` | 全部新增/删除/修改为 0 |
| factory 实际复制的辅助缓存 | 3,749 | 独立清单见输入收据 | 全部新增/删除/修改为 0 |
| 实际执行边界工具 | 7 | 各文件独立 SHA 清单 | 逐字相同 |
| 预审观测工具 | 8 | 各文件独立 SHA 清单 | 逐字相同 |

实际 Node 为 22.23.2（arm64/Darwin），pnpm 为 10.26.2；Node 可执行文件字节、实际 pnpm 离线 store 位置与观测工具 SHA 见 `runtime.json`。全局离线 store 只记录来源路径，不能外推其整棵内容被哈希；实际已安装依赖的全部字节与内部链接是严格校验范围。

backend 源码和测试属于上述完整源码树；MCP caller fixture SHA 为 `f782ccd31717b3a31b3aefab30928f338f06d8a27566d001d02973550aa0ee4d`。本默认模式没有安装 backend venv，没有执行 backend 全量或真实 Gateway 浏览器套件，不能声称验证其 Python 环境；该环境与解释器标准库将由 `--with-e2e` 的真实 uv 安装另行捕获。已有独立 backend 全量 PASS 继续只引用其自身收据。

本轮 0 漂移指 **冻结 outer ↔ 实际 inner 的 gate 前后输入**。与原仓库的启动前对照有 4,419 条冻结非 React 源路径，生产、测试、普通文档 0 漂移；两份持续更新的报告差异单列。outer 创建期间另有 20 条报告级差异（16 条未进入快照、4 条更新）。未宣称原仓库全树 0 漂移。

内部副本已按原 dispose 清理；外层副本仍保持无安装依赖，可供后续原 `--with-e2e` fresh-inner 使用。当前没有 builder、服务或固定端口占用。

## 保留的历史失败

新增 evidence 准备脚本首次相对 import 路径错误发生于调用 factory 前，直接退出 1，原错误日志保留；修正后原 factory 复制与完整 capture 均退出 0。第一份启动 preflight 又把明确允许变化的两份报告错误纳入严格断言，直接退出 1；原收据与纠正后仅要求非报告源码 0 漂移的收据同时保留。两项均不改原 gate 命令或测试。

所有此前完整 FAIL/PASS 日志均未覆盖。本轮默认 PASS 不能代替尚未运行的 `--with-e2e`、最终完整跨端或真实外部入口。

## 可复核证据

全部位于 `docs/reports/evidence/2026-10-10-standalone-stage42/`：

- `default/summary.json`：本报告机器可读汇总与各范围边界。
- `default/actual-run.json`、`actual-run.log`、`actual-commands.json`、`command-1.log` 至 `command-8.log`：原入口、每个实际命令、直接退出码与完整输出。
- `default/actual-vitest.json`、`actual-declared-skips.json`：完整测试结果及原声明跳过。
- `default/input-receipt.json`、`input-verify.json`、`runtime.json`：完整源/native/cache 清单与前后差异、实际 runtime。
- `default/execution-tools-before.json`、`execution-tools-after.json`：7 个实际边界工具逐字闭合；8 个预审观测工具复核见 `summary.json`。
- `outer-source-final.json`、`outer-source-final-inputs.json`、`outer-preparation-summary.json`：原 factory 复制与完整 outer 输入、报告差异。
- `default-start-preflight.json`、`default-start-preflight-corrected.json`：保留首份误判与准确范围复核。
