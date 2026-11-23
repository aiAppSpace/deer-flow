# Stage42 Linux 冻结源验收

**精确检查点边界：** 本轮完成后，11:08:11 CST 仅从 `MCPPluginManager.vue` 删除了底层已提供的
`overflow-y-auto` 重复 caller 类。安装版 class merge 已证明最终 token 集合完全相同，仍按新源
执行另一个 fresh Linux repair round；本报告保留删除前的准确输入与结果，不事后替换为新源。
修复证据见 [source-freeze.json](evidence/mcp-dialog-base-class-stage42/source-freeze.json)。

本轮原 **8 visual、12 route-payload、asset-budget 全部直接 exit 0**，没有 skipped、flaky、
未预期失败、截图更新或预算调整。同产物额外 8 / 12 原断言补证也全部直接 exit 0，
9 张实际 PNG 已逐张通过 `view_image` 回读。

后验的 snapshot 构建/门禁输入、完整 copied tree 和原生依赖均零新增、零删除、零修改。
原宽口径 verify **直接 exit 1**：原 checkout 的一个后端 runtime marker 在执行期间改变。
该真实结果和 SHA 保留；其余 Vue 实际编译与门禁输入没有漂移。不能把本轮称为整个仓库
零漂移或推导其他 gate 已通过。

## 真实输入与隔离

- 新实体副本：`/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-linux-stage42-9E91rU`，
  在新容器 `deerflow-vue-linux-stage42` 内挂载为 `/work`。没有复用旧容器的生成产物，也未写原
  checkout 的 `.nuxt`、`.output` 或依赖。React、私有 `.env`、运行配置及生成目录未复制。
- Linux ARM64、Node `v24.14.1`；镜像为
  `sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`。
- 新枚举的保守构建/门禁输入 **1785 项**，SHA
  `dbc690345bb5683a507ae76d6a81920af7a006d8b13a456ed854dd98a9c87af7`。
  包含完整非生成 Vue workspace、root scripts/contracts/files、隐藏配置、shared、锁文件、
  测试与 baseline，没有沿用旧 1750 项清单。
- 更宽的物理 copied tree **86007 项**单独记录；它包含不参与本轮 Vue 执行的后端与报告。
- **58200 项实体原生依赖及内部链接**，SHA
  `dff4868f6a16f29115a8a1492528c847ddea7d5cd9603352533df12a55210acc`。
  前后清单、包版本、Chromium 二进制、系统字体和执行工具独立捕获。
- 当前锁文件 SHA 为 `3d48ffad9654f4156e84bab73989279df8b9fac3b9b4ac39719fea2d160ef316`。
  没有安装或升级依赖。

详见 [input-receipt.json](evidence/2026-10-10-linux-stage42/input-receipt.json)、
[container-image.json](evidence/2026-10-10-linux-stage42/container-image.json)、
[runtime.json](evidence/2026-10-10-linux-stage42/runtime.json) 与
[native-fonts.log](evidence/2026-10-10-linux-stage42/native-fonts.log)。

复制准备阶段曾发现 `fs.cpSync` 将相对软链改成旧 host 的绝对路径。首次 Node startup 因此失败，
此时尚未运行正式构建或测试。复制工具改为 `verbatimSymlinks:true`，3500 项链接恢复原始 target，
再完成实体依赖与原生启动校验。生成 `.bin` 的 `NODE_PATH` 全部属于本容器 `/work`；实际 Node
startup/globalPaths 没有原 checkout 或旧 host 路径。Nuxt 包版本为 4.5.1；启动日志显示的
3.37.0 是其 CLI 版本。

原始失败和纠正记录见 [copy-symlink-correction.json](evidence/2026-10-10-linux-stage42/copy-symlink-correction.json)、
[node-startup.log](evidence/2026-10-10-linux-stage42/node-startup.log)、
[node-startup-final.log](evidence/2026-10-10-linux-stage42/node-startup-final.log)、
[native-bin-path-audit.json](evidence/2026-10-10-linux-stage42/native-bin-path-audit.json) 与
[node-startup-paths.jsonl](evidence/2026-10-10-linux-stage42/node-startup-paths.jsonl)。准备阶段另一次
runtime 工具引用未挂载路径失败，后改为从 stdin 执行真实工具，保留 `runtime-first.log`。

## 正式门禁

| 门禁                                                   | 实际结果               |  Playwright 耗时 |
| ------------------------------------------------------ | ---------------------- | ---------------: |
| 原 `playwright.visual.config.ts`                       | 8 PASS，direct exit 0  |          57.692s |
| 原 `playwright.config.ts` 完整 `route-payload.spec.ts` | 12 PASS，direct exit 0 |          52.654s |
| 原 `scripts/asset-budget.mjs`                          | direct exit 0          | 同产物，无新构建 |

两次正式 builder 串行，startup 240000ms、worker、测试范围、截图阈值和资源预算均保持原值。
完整 argv、直接退出码与原始 JSON/log 见
[execution-journal.json](evidence/2026-10-10-linux-stage42/execution-journal.json)。

原资源预算桶的精确读数如下；它们是构建文件 raw / gzip-9，而非浏览器实际 wire bytes。

| 前缀桶            | JS 文件数 | raw bytes | gzip bytes |
| ----------------- | --------: | --------: | ---------: |
| vendor-vue        |        10 |    172341 |      64836 |
| vendor-markdown   |        13 |   1076729 |     324678 |
| vendor-codemirror |        11 |    555743 |     199698 |
| vendor-i18n       |         3 |    170868 |      60415 |
| vendor-ui         |        34 |    589682 |     187657 |
| 全部 client JS    |       678 |  15985890 |    3803271 |

最大单文件 raw 779847、gzip 230136；逐文件 bytes/SHA/Brotli 与完整产物指纹
`773c2fcb48599e27b4573b5447389571106c6774e389a83f2c194b4d20da7bdf`
见 [asset-exact.json](evidence/2026-10-10-linux-stage42/asset-exact.json)。

## 同产物截图与 URL 补证

正式门禁结束后，只在新副本的两份 fixture 增加原断言之后的观察。临时 config 不启动
webServer；原 8 个视觉断言、12 个路由/hover/focus/renderer 断言全部保留。
额外 visual **8 PASS / 10.246s / direct 0**、payload **12 PASS / 12.528s / direct 0**。

6 组 route × locale 的 bytes、文件数与 critical/prefetch/all 集合在正式与补证执行间完全一致：

| route                  | locale | initial JS | raw bytes | Brotli bytes | prefetch |
| ---------------------- | ------ | ---------: | --------: | -----------: | -------: |
| `/`                    | en-US  |         37 |    389490 |       131051 |        0 |
| `/`                    | zh-CN  |         37 |    387750 |       132526 |        0 |
| `/login`               | en-US  |         47 |    461373 |       149197 |        0 |
| `/login`               | zh-CN  |         47 |    459633 |       150672 |        0 |
| `/workspace/chats/new` | en-US  |        175 |   1479752 |       454063 |        0 |
| `/workspace/chats/new` | zh-CN  |        175 |   1478012 |       455538 |        0 |

4 组 hover/focus 的原始文件集合也一致。完整实际 URL、优先级与文件集合见
[payload-url-observations.json](evidence/2026-10-10-linux-stage42/payload-url-observations.json)；
逐项对照见 [payload-observation-comparison.json](evidence/2026-10-10-linux-stage42/payload-observation-comparison.json)。
首次证据对照命令误将 fixture 的 `final` 文件数组按对象读取而退出 1，纠正为实际数组结构后
才写对照结果；该观察工具错误没有改变测试或正式结果。

artifact、dark、empty、attachment、mobile、reasoning/tool、中文 dark settings、light settings、
streaming 共 9 张当前 PNG 均实际逐张打开，未发现这些状态的新视觉异常。每张文件 SHA、
绝对路径和回读结论在 [actual-images-readback.json](evidence/2026-10-10-linux-stage42/actual-images-readback.json)。

## 后验、runtime 漂移与清理

两份 fixture 已恢复准确原始字节，3 项临时 config/launcher 已删除；自有 preview group 1538
已收到 SIGTERM，3101 实测 `ECONNREFUSED`。11 个执行工具前后 SHA 全部一致，实际 Node、包版本
和浏览器二进制前后相同。新 Linux 容器保留供复现，仅剩其原 `sleep infinity`，没有本轮预览监听。

完整枚举后验的原始 [input-verify.json](evidence/2026-10-10-linux-stage42/input-verify.json) 与
直接退出码记录 [input-verify-execution.json](evidence/2026-10-10-linux-stage42/input-verify-execution.json)
完整保留，不能写成该工具 exit 0：

- snapshot 构建/门禁输入、snapshot copied tree、原生依赖：新增、删除、修改全部为空。
- root 保守输入：只改变 `.extensions_config.json.skills-cache-reset.json`。该文件由后端 reset
  测试/Gateway 生成，是 runtime marker，不是 Nuxt/visual/payload/asset 编译消费。
  capture 工具原策略纳入所有 root 文件，因而真实报 direct 1。
- 排除这一明确 runtime 分类后的其余 **1784 项**保守输入无漂移，SHA
  `bfe1fa5332652c161894c562141f02f3ccaa87128d74a3e95920720a6b4ef364`。
  没有修改 capture 工具、添加忽略规则或事后刷新副本来吞掉该差异。
- root 更宽 copied tree 新增 115 项报告/evidence、改变 marker、后端单测
  `backend/tests/test_mcp_task_service.py` 及根代理的准备工具；完整新增/删除/修改集合保留。
  这不等于整个 checkout 零漂移。

marker 在首次输入捕获前曾变化，按根代理授权仅刷新过副本中的该 metadata，旧/新 SHA 保留于
[root-runtime-metadata-refresh.json](evidence/2026-10-10-linux-stage42/root-runtime-metadata-refresh.json)。
正式执行后的再次变化未吸收入副本。准确 SHA、实际消费检索与分类依据见
[input-verify-runtime-classification.json](evidence/2026-10-10-linux-stage42/input-verify-runtime-classification.json)。

本报告只确认该冻结 Vue 源的 Linux 原门禁及列出的补证。React、完整跨端/真实认证、Docker、
后端、standalone 和环境切换各自保留独立实际 PASS / FAIL / UNRUN 边界。
