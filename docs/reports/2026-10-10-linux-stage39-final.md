# Stage39 Linux 最终冻结源验收

本轮正式 **8 visual、12 route-payload、asset-budget 全部直接 exit 0**，没有 skipped、
flaky 或截图基准更新。额外同产物 8 / 12 补证也全部 exit 0，9 张当前实际 PNG 已逐张
通过 `view_image` 回读。完整跨端、Docker 和两个 standalone modes 的结果独立记录，
不从本报告外推。

## 实际输入与环境

- 独立副本：`/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-yp3BMR`。
  React 与私有运行配置未复制；未写原 checkout 的 `.nuxt`、`.output` 或依赖。
- `deerflow-vue-linux-gates`，Linux ARM64、Node `v24.14.1`，image
  `sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`。
- 全部非生成 Vue workspace 加 root scripts/contracts/files 共 **1750 项**：
  `1e6e5bb924e7f2ce6a3c257c8e374813cfb6815789df49d9fb3bd4469d9a9381`。
  包含隐藏/根配置、`shared/showcase.ts`、tsconfig、`.nuxtrc`、components、ESLint、Nuxt
  配置及真实 gate/test/baseline 来源，未沿用旧固定生产清单。
- **58200 个原生依赖项**（实体文件和内部链接）指纹：
  `dff4868f6a16f29115a8a1492528c847ddea7d5cd9603352533df12a55210acc`。
  Node/包版本、Chromium 二进制 SHA 和执行工具另记，未将依赖清单冒称整个系统清单。
- 最后 ChatComposer spacing token、ARCHITECTURE 和相关 fixture 已逐字核对最终 freeze。
  原配置 startup **240000ms**、测试预算、资源上限、workers 与截图阈值均未改变。

完整 source/snapshot 清单、排除项及原生运行时见
[`input-receipt.json`](evidence/2026-10-10-linux-stage39/input-receipt.json) 和
[`runtime.json`](evidence/2026-10-10-linux-stage39/runtime.json)。执行工具位于产品副本之外时，
其执行前后 SHA 也独立记录。

## 正式执行

| 门禁                                                | 实际结果        | Playwright 实际耗时      |
| --------------------------------------------------- | --------------- | ------------------------ |
| 原 `playwright.visual.config.ts`                    | 8 PASS，exit 0  | 53.844s                  |
| 原 `playwright.config.ts` 的完整 route-payload 文件 | 12 PASS，exit 0 | 52.750s                  |
| 原 `scripts/asset-budget.mjs`                       | exit 0          | 同一正式产物，无额外构建 |

每条完整 argv、开始/完成时间、直接退出码、原始日志与 JSON 在
[`execution-journal.json`](evidence/2026-10-10-linux-stage39/execution-journal.json)。

最终 679 个 client JS：raw **15976870 bytes**、gzip **3800101 bytes**；最大单文件 raw
779847、gzip 230136。输出文件指纹为
`57c3451e7f892bdebdc94957720bfaa923454203eba193a01527e9d944ed02c1`。
这些是构建文件与原 gate 的 gzip-9 读数，不是页面实际 wire bytes。

| 原 gate 前缀桶    | 文件数 | raw bytes | gzip bytes |
| ----------------- | -----: | --------: | ---------: |
| vendor-vue        |     10 |    172330 |      64830 |
| vendor-markdown   |     13 |   1075074 |     324035 |
| vendor-codemirror |     11 |    555743 |     199698 |
| vendor-i18n       |      3 |    170868 |      60415 |
| vendor-ui         |     34 |    584223 |     185636 |

全部文件 raw/gzip/Brotli 与 SHA 见
[`asset-exact.json`](evidence/2026-10-10-linux-stage39/asset-exact.json)；前缀桶不表示独占模块归属。

## 实际截图与 URL 补证

正式门禁完成后，只在独立副本的两个 fixture 增加原断言后的截图/URL 观察，复用已编译
产物，临时 config 不带 webServer。补跑 visual **8 PASS / exit 0 / 26.621s**，payload
**12 PASS / exit 0 / 15.435s**。四个 hover/focus 与两个 renderer guards 原断言保留。

6 组 route × locale 的初始 bytes、文件数和 critical/prefetch/all 文件集合，补证与正式
执行 **全部完全一致**。准确 URL、请求优先级、文件集合和 raw/Brotli 数值见
[`payload-url-observations.json`](evidence/2026-10-10-linux-stage39/payload-url-observations.json)
与 [`payload-observation-comparison.json`](evidence/2026-10-10-linux-stage39/payload-observation-comparison.json)。

空会话、附件、streaming、reasoning/tool、artifact、settings、mobile、dark、中文 dark
settings 共 9 张当前实际图均已逐张打开检查，未发现新的显示问题。图片、每张 SHA 与回读
说明见 [`actual-images-readback.json`](evidence/2026-10-10-linux-stage39/actual-images-readback.json)。
这不是仅凭 PASS JSON 宣称看过图片。

## 后验与清理

两 fixture 恢复准确原始字节，三项临时 config/launcher 删除；owned preview group 27629
收到 SIGTERM，3101 已实际确证关闭。执行工具前后 SHA 全部一致。

完整 verify **直接 exit 0**：snapshot build/gate、root build/gate、snapshot copied tree、
原生依赖均无新增、删除或修改。root 更宽的 copied tree 有其他任务新增/更新的验收报告
与 evidence，逐项保留在 [`input-verify.json`](evidence/2026-10-10-linux-stage39/input-verify.json)，
没有把这些文档/证据漂移改称全树零漂移。

本轮对应当前冻结的 Vue 构建与 Linux 原门禁范围。完整跨端与真实认证、所有 standalone
模式、Docker/入口验收仍由各自实际执行证据负责。

## 执行结束后的测试夹具变更边界

本轮后 cap 修复了 stream Gateway/spec，并新增其 HTTP/SSE 单测：两条原清单测试路径
字节改变，新增单测不在原 1750 条清单中。因此上文零漂移仅成立于实际执行与后验时点，
不表示现在整个 Vue 源树仍与该清单逐字相同。产品源码、visual/payload 原 fixture、配置、
预算和实际 runtime consumers 均未随这三文件改变；独立已安装 Oxide 扫描与真实 CSS 生成
确认 main.css 仍为 202104 bytes、SHA 23044705…，详情见
[stream 独立复核](2026-10-10-stream-fixture-independent-review-stage39.md)。

完整 standalone 两模式使用修复后新副本、重新执行全部对应门禁；本 Linux receipt 不被
事后替换或外推为该新副本的全树验收。
