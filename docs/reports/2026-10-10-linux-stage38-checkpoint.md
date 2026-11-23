# Linux Stage38 精确快照验收 checkpoint

本轮按原命令、原预算完成 **8 visual / 12 route-payload / asset-budget，全部直接 exit 0**，
并逐张回读九张实际截图、补齐路由 URL 与请求优先级证据。**这是已记录旧快照的 PASS，
不是当前最新生产源的最终 PASS。** 根任务随后修改了 SettingsDialog 的真实容量布局，
并继续收口 React Dropdown anchor；最新统一验收仍待冻结后重跑。

证据目录：[`evidence/2026-10-10-linux-stage38/`](evidence/2026-10-10-linux-stage38/)。

## 执行环境与输入范围

- 独立 Linux ARM64 容器 `deerflow-vue-linux-gates`，工作目录 `/work/frontend-vue`；
  宿主副本 `/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-standalone-yp3BMR`。未写原仓库 `.nuxt/.output/.next`。
- Node **v24.14.1**，Linux **7.0.12-linuxkit**，Nuxt **4.5.1**，Vue **3.5.42**，
  Playwright **1.59.1**；原生 Linux 依赖及 Chromium 实际路径/SHA 见 `runtime.json`。
- 容器 image `sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`。
  root lock、clone lock、实际 pnpm installed lock 三份字节一致，
  SHA `3d48ffad9654f4156e84bab73989279df8b9fac3b9b4ac39719fea2d160ef316`。
- 构建/gate receipt 保守覆盖全部非生成 Vue 工作区及 root scripts/contracts/files，
  **1748** 项，包含 `shared/showcase.ts`、tsconfig、`.nuxtrc`、components、
  ESLint、Nuxt 根配置、包/lock、实际 Playwright factories/spec 与资产脚本；
  聚合 SHA **`4958fc6785aca255612cd44c90fbef9939e62f042087cf856ce7fb97ff6c3f83`**。
- 更宽复制树独立记录 **80494** 项；原生安装依赖记录 **58200** 项，
  聚合 SHA `dff4868f6a16f29115a8a1492528c847ddea7d5cd9603352533df12a55210acc`。它们不是用少量路径代表全部输入。
- `.env/.env.*` 与 private runtime config 不进入 Linux 产品副本；React 不存在于该独立副本。
  生成缓存/日志/测试产物按 receipt 中的明确政策排除。没有追认历史仅 942 路径的范围。
- 实际执行的七个外置观察工具另有 `execution-tools-before.json`、
  `observation-tools-before.json` 与 `execution-tools-after.json`，**7/7 前后 SHA 相同**。
  它们位于产品 source-copy 排除的 evidence 目录，未假称被根任务产品清单覆盖。

## 原门禁直接结果

| 门禁                               | 结果                                         | 时间           | 证据                           |
| ---------------------------------- | -------------------------------------------- | -------------- | ------------------------------ |
| 原 visual 配置，无 baseline update | 8 PASS，0 skip / unexpected / flaky，exit 0  | 86.049s        | `visual.log` / `visual.json`   |
| 原 route-payload 全文件            | 12 PASS，0 skip / unexpected / flaky，exit 0 | 73.155s        | `payload.log` / `payload.json` |
| 原 asset-budget                    | exit 0                                       | 原预算全部通过 | `asset.log`                    |

原 startup **240000ms**、测试预算、worker policy、截图差异门限及资产预算未修改。
准确 argv 与时间在 `execution-journal.json`；没有用 supplemental observer 替代上述原门禁。

## 实际 URL、预取与字节补证

原门禁完成后，使用**同一已有编译产物**启动独占 preview 3101，没有额外 build。
仅在 clone fixture 中增加附件/截图记录，保留原断言；原 fixture、instrumentation diff、
临时 config/launcher 字节均在 `observation-inputs.json` 和 `observer-inputs/`。
这批配置只把 webServer 换成已就绪 owned preview，并使用原 suite 的断言和测试集合。

补证 visual **8 PASS / exit 0 / 19.684s**。
补证 payload 首轮 **11 PASS / 1 unexpected / exit 1**，唯一失败为 Chromium **launch SIGSEGV**，
发生在获取 page 之前，没有执行该用例的 payload/UI 断言；日志、trace、context 保留于
`payload-observe-browser-launch-failure*`。同命令、同六 workers、同预算、同 fixture 完整
重跑 **12 PASS / exit 0 / 14.266s**，没有修改源来回避失败。

下列六个初始 URL 的原门禁与补证：**测量字节、计数与文件集合逐项完全相同**。
数字是实际读取产物 raw/Brotli 字节，不冒充网络传输压缩字节。

| 实际 URL                                    | locale | critical JS 数 | raw bytes | Brotli bytes | prefetch 数 |
| ------------------------------------------- | ------ | -------------: | --------: | -----------: | ----------: |
| `http://localhost:3101/`                    | en-US  |             37 |    389511 |       131118 |           0 |
| `http://localhost:3101/login`               | en-US  |             47 |    461394 |       149264 |           0 |
| `http://localhost:3101/workspace/chats/new` | en-US  |            176 |   1471282 |       451495 |           0 |
| `http://localhost:3101/`                    | zh-CN  |             37 |    387771 |       132593 |           0 |
| `http://localhost:3101/login`               | zh-CN  |             47 |    459654 |       150739 |           0 |
| `http://localhost:3101/workspace/chats/new` | zh-CN  |            176 |   1469542 |       452970 |           0 |

另外两语言 × hover/focus 共四个 intent 用例保留了预取时机与 click 导航原断言；
初始 URL `http://localhost:3101/`，最终 URL `http://localhost:3101/workspace/chats/new`。
所有完整请求 URL、initialPriority、每阶段文件集合保存在 `payload-url-observations.json`，
与原门禁的比较在 `payload-observation-comparison.json`。

## 构建 JS 资产实数

实际 JS 文件 **679**，raw **15976761 bytes**，gzip9 **3800070 bytes**；
逐文件原始 SHA、raw/gzip/Brotli 与清单在 `asset-exact.json`。
资产聚合 SHA **`3bad2631b83309cc64e018b68033e330c0fbd7caa545da30e5e7259dd34f1154`**。
分组沿原 asset-budget 前缀，非互斥模块归属或浏览器 wire 计数。

| 原前缀分组        | JS 数 | raw bytes | gzip9 bytes |
| ----------------- | ----: | --------: | ----------: |
| vendor-vue        |    10 |    172330 |       64830 |
| vendor-markdown   |    13 |   1075074 |      324035 |
| vendor-codemirror |    11 |    555743 |      199698 |
| vendor-i18n       |     3 |    170868 |       60415 |
| vendor-ui         |    34 |    584114 |      185609 |

## 九张实际截图回读

`actual-images/` 内九张截图已逐张通过 `tools.view_image` 实际查看：empty chat、attachment、
streaming、reasoning/tool、artifact、settings、mobile、dark mode、Chinese dark settings。
实际页面 URL 在 `visual-url-observations.json`，逐图 SHA、字节数、可见观察在
`actual-images-readback.json`。未更新 baseline；截图只证明对应已捕获状态的可见表现，
尤其 settings 滚动区不被描述成所有内容均已完整可达。

## 后验、清理与明确边界

补证完成后精确恢复两份 clone fixture，并移除三个临时执行输入；自有 preview process
group **24265** 收到 SIGTERM，端口 3101 实测 **ECONNREFUSED**。
`observation-restored.json` 证明恢复字节与原输入一致。

后验 `input-verify.json` **direct exit 1** 如实保留：

- **snapshot build/gate：0 增删改；snapshot copied tree：0 增删改；native dependencies：0 增删改。**
- root 的较新构建/gate清单已有 **2 新增、7 修改**，
  包括 SettingsDialog **生产布局**、Showcase 精确 history fixture、keyboard-order gate 与
  container OIDC probe（snapshot 实际执行 b57c9035…，root 已为 f2bdcb0…）。
- root 更宽复制树的报告/证据更新也单独列出；不是 snapshot 执行字节漂移。
  各路径前后 SHA 见 `root-build-gate-drift-detail.json`。

因此本轮结果仅针对以上精确 snapshot。**当前最新源最终 Linux、standalone basic/
with-e2e 均未完成**；standalone 还需根任务释放固定 801x 并安排原 SQL30s 的安静执行窗口。
没有据旧 PASS、test-only 变化或局部四用例，外推当前所有 runtime 输入仍相同。
