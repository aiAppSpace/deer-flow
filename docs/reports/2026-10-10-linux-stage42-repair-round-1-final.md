# Stage42 Linux 新冻结源复验

本轮最终原 **8 visual、完整 12 route-payload、asset-budget 均直接 exit 0**。
同一最终产物的额外 8 / 12 原断言补证也全部直接 exit 0；9 张当前 PNG 已逐张通过
`view_image` 打开检查。最终各 Playwright 执行均 0 skipped、0 flaky、0 unexpected、`errors: []`。
没有更新截图基准、改变预算、减少范围或放宽时限。

首轮完整 payload 实际为 **10 PASS / 2 timeout / direct 1**，不是整轮从未失败。
原始 JSON/log、两份完整 trace/PNG/video/context 和逐段计时均保留；在明确静默窗口，
同源、同原配置重新构建并完整重跑 12 项后才取得最终 exit 0。

本报告替代旧源的当前有效性，不覆盖
[上一轮准确检查点](2026-10-10-linux-stage42-final.md)。其他跨端、Docker、认证、后端与
standalone gate 各自保持独立结果边界。

## 新实体输入

- 根代理统一冻结时间：2026-10-10 11:12:42 CST；本轮完整 capture 于 11:18:50 CST 完成。
- 新物理副本：`/private/var/folders/sr/60jzrfv10vj68z78j6n2kf4h0000gn/T/deerflow-linux-stage42-repair-1-KPlrq1`。
  新容器 `deerflow-vue-linux-stage42-repair-1` 挂载为 `/work`，没有复用旧生成产物或原 checkout 缓存。
- Linux ARM64、Node `v24.14.1`，镜像
  `sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`。
- 重新枚举的保守构建/门禁输入 **1784 项**，SHA
  `8f95da3b0529909b219698bdb4da65d28b7c49776d67dc517e6cc1beb2c26e5a`。
  覆盖非生成 Vue workspace、root scripts/contracts/files、隐藏配置、shared、锁文件、
  测试与 baseline。React、私有 `.env`/运行配置和生成目录未复制到本轮 Linux 执行输入。
- 更宽的实际物理 copied tree **86217 项**单独枚举，SHA
  `def8b7c01946f2965717b81cdf8fc6d4510b1f94783d196c96ca6fa0db357368`；不把其中后端和报告
  都称作 Vue 编译消费者。
- **58200 项实体原生依赖及内部链接**，SHA
  `dff4868f6a16f29115a8a1492528c847ddea7d5cd9603352533df12a55210acc`。
  锁文件 SHA 为 `3d48ffad9654f4156e84bab73989279df8b9fac3b9b4ac39719fea2d160ef316`，未升级依赖。

实际 Node startup / globalPaths 已验证：生成 `.bin` 的 `NODE_PATH` 仅指向当前容器 `/work`
或 Node 标准默认目录，没有原 checkout、旧副本或 host 的绝对路径。相对软链从复制开始
原样保留。真实包版本、Chromium / headless 二进制 SHA 和系统字体另有捕获。

与上一轮不可变输入比较，只有 `MCPPluginManager.vue` 的重复 caller 类删除和
`tests/unit/chat/chat-header.test.ts` 的当前测试修复改变；没有新增、删除输入。
详见 [previous-round-input-diff.json](evidence/2026-10-10-linux-stage42-repair-round-1/previous-round-input-diff.json)。
本轮已实际重构建，未仅用 class 等价推导视觉通过。

完整输入见 [input-receipt.json](evidence/2026-10-10-linux-stage42-repair-round-1/input-receipt.json)、
[runtime.json](evidence/2026-10-10-linux-stage42-repair-round-1/runtime.json)、
[node-startup-paths.jsonl](evidence/2026-10-10-linux-stage42-repair-round-1/node-startup-paths.jsonl) 与
[native-fonts.log](evidence/2026-10-10-linux-stage42-repair-round-1/native-fonts.log)。

## 正式执行与首轮失败

| 执行                                         | 实际结果                      | Playwright 耗时 |
| -------------------------------------------- | ----------------------------- | --------------: |
| 原 `playwright.visual.config.ts`             | 8 PASS，direct 0              |         83.285s |
| 原 `playwright.config.ts` 完整 payload，首轮 | 10 PASS / 2 timeout，direct 1 |        157.458s |
| 同源原配置完整 payload，静默窗口重建重跑     | 12 PASS，direct 0             |         88.380s |
| 最终产物原 `scripts/asset-budget.mjs`        | direct 0                      |        无新构建 |

原 startup **240000ms**、payload case **30000ms**、**6 workers**、全部截图阈值、资源预算
和 12 项路由/hover/focus/renderer 断言均未改。全部 argv、直接退出码和执行时间在
[execution-journal.json](evidence/2026-10-10-linux-stage42-repair-round-1/execution-journal.json)。

两项首轮 timeout 是英文 hover/focus。Trace 显示它们都完成真实预取、点击导航、URL、
输入框可见、locale/pageErrors 断言，并到达 interaction attachment；主要额外耗时在
`assetContaining` 对全部 678 个 JS 的五次同步扫描。相邻断言间的扫描段耗时约 2.51–6.95s，
累计耗尽全用例时限。同文件、同 Node 的独立只读扫描随后为 73.97–117.39ms。
没有把资源竞争当作自动通过条件；只是等待其他完整任务结束，再取得原全 12 项真实通过。

首轮 [payload-initial.json](evidence/2026-10-10-linux-stage42-repair-round-1/payload-initial.json)、
[payload-initial.log](evidence/2026-10-10-linux-stage42-repair-round-1/payload-initial.log)、
[逐段 trace timing](evidence/2026-10-10-linux-stage42-repair-round-1/payload-initial-trace-timing.json) 与
[因果记录](evidence/2026-10-10-linux-stage42-repair-round-1/payload-initial-failure-analysis.json)
不会被最终结果覆盖。完整失败现场保存在同目录 `payload-initial-failure/`。

## 最终资源与同产物补证

以下是构建文件 raw / gzip-9 bytes，不是浏览器实际 wire bytes。

| 前缀桶            | JS 数 | raw bytes | gzip bytes |
| ----------------- | ----: | --------: | ---------: |
| vendor-vue        |    10 |    172325 |      64831 |
| vendor-markdown   |    13 |   1076729 |     324678 |
| vendor-codemirror |    11 |    555743 |     199698 |
| vendor-i18n       |     3 |    170868 |      60415 |
| vendor-ui         |    34 |    589682 |     187657 |
| 全部 client JS    |   678 |  15985874 |    3803264 |

最大单文件 raw 779847 / gzip 230136。逐文件 SHA、raw/gzip/Brotli 与产物指纹
`c0306a76c103d6f44edab5f3732e8d5fa22f4d6c81528c52265d189ba6d9af34`
见 [asset-exact.json](evidence/2026-10-10-linux-stage42-repair-round-1/asset-exact.json)。

仅在正式门禁全部通过后，clone 的两份 fixture 追加原断言之后的观察；临时配置不启动
webServer，没有再构建。额外 visual **8 PASS / 10.246s / direct 0**，payload
**12 PASS / 13.622s / direct 0**。

| route                  | locale | initial JS | raw bytes | Brotli bytes | prefetch |
| ---------------------- | ------ | ---------: | --------: | -----------: | -------: |
| `/`                    | en-US  |         37 |    389490 |       131049 |        0 |
| `/`                    | zh-CN  |         37 |    387750 |       132524 |        0 |
| `/login`               | en-US  |         47 |    461373 |       149195 |        0 |
| `/login`               | zh-CN  |         47 |    459633 |       150670 |        0 |
| `/workspace/chats/new` | en-US  |        175 |   1479752 |       454061 |        0 |
| `/workspace/chats/new` | zh-CN  |        175 |   1478012 |       455536 |        0 |

六组正式/补证 bytes、文件数与 critical/prefetch/all 文件集合完全一致；四组 hover/focus
initial/preloaded/final 集合也精确一致，保留集合成员的重复次数。真实 URL、请求优先级
与完整逐文件列表见 [payload-url-observations.json](evidence/2026-10-10-linux-stage42-repair-round-1/payload-url-observations.json)，
十组对照见 [payload-observation-comparison.json](evidence/2026-10-10-linux-stage42-repair-round-1/payload-observation-comparison.json)。

artifact、dark、empty、attachment、mobile、reasoning/tool、中文 dark settings、light settings、
streaming 九张实际 PNG 均逐张打开，未发现这些记录状态的新视觉问题。
路径、SHA 与回读结论见 [actual-images-readback.json](evidence/2026-10-10-linux-stage42-repair-round-1/actual-images-readback.json)。

## 后验与清理

完整新枚举后验 **actual direct 0**：

- snapshot 和原 checkout 的 1784 项构建/门禁输入：新增、删除、修改均为空。
- snapshot 的 86217 项 copied tree：新增、删除、修改均为空。
- 58200 项原生依赖：新增、删除、修改均为空。
- 12 项正式执行/观察工具、另行在首次使用前捕获的 1 项比较器，以及 Node/包/浏览器
  runtime 前后一致。不是用旧清单只复算已有行。
- 原 checkout 更宽 copied tree 有 **119 项报告/evidence 新增、3 项辅助文档/准备工具修改**，
  无删除。它们不在本轮构建/门禁输入中；完整集合保留，不能称整个 checkout 零漂移。

后验依据为 [input-verify.json](evidence/2026-10-10-linux-stage42-repair-round-1/input-verify.json)、
[runtime-inputs-verify.json](evidence/2026-10-10-linux-stage42-repair-round-1/runtime-inputs-verify.json)、
[execution-tools-after.json](evidence/2026-10-10-linux-stage42-repair-round-1/execution-tools-after.json) 与
[runtime-comparison.json](evidence/2026-10-10-linux-stage42-repair-round-1/runtime-comparison.json)。

`.extensions_config.json.skills-cache-reset.json` 是 backend reset/Gateway 生成的 runtime marker，
从本轮捕获开始就单列，不纳入不可变 Vue 编译源，完整 copied tree 仍保留它。
root/snapshot 在 capture 和 verify 前后均为 SHA
`5a9e5730164d2ec959876058250556f5417f81aefa78baba4c6b60b95b8da7af`。
没有执行后吸收漂移；上一轮宽口径 postverify 的真实 direct 1 仍完整保留在旧报告。

两份 observer fixture 已恢复原始 SHA，三项临时配置/launcher 已删除。仅自有 preview
进程组 **2511** 正常收到 SIGTERM，3101 实测 `ECONNREFUSED`；新容器保留供复现，没有本轮
活动构建或预览监听。两项证据编排纠正（首次 closure probe 缺 `-i`、首次 runtime comparison
早于 capture 完成）记录于 [observation-tool-errors.json](evidence/2026-10-10-linux-stage42-repair-round-1/observation-tool-errors.json)，
空输出/不完整 JSON 未作为通过依据，纠正后才写最终有效结果。

该结论只覆盖这里列出的冻结 Vue 源、Linux 原门禁与同产物补证，不替代尚在其他 agent
执行的完整跨端、真实 Gateway/认证、Docker、后端或 standalone 验收。
