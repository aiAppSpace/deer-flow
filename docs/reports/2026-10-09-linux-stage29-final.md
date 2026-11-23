# Stage29 Linux 最终验收

本轮 Linux 范围全部通过：正式视觉8/8、正式payload12/12、asset-budget、9张当前截图逐张回读。两个附加证据采集运行（视觉8/8、URL12/12）也全部通过，保留全部原断言。没有更新截图基准、放宽门槛、增加豁免或省略场景。

## 冻结源码与运行边界

- 当前分支 `main-wc`；HEAD `a7804539530846baecf548af7b5d2612deb89b68`；未提交或推送。
- 940项输入聚合SHA256：`33504235a17435d80477913fc8c66f330a8ac9a0cb484275c2d3e96121fba3ff`。清单与逐文件SHA见 [source fingerprint](2026-10-09-linux-stage29-source-fingerprint.json)。
- 完整重新同步后在 `deerflow-vue-linux-gates` 的 `/work/frontend-vue` 独立构建，保留Linux原生node_modules；原checkout `.nuxt/.output` 未使用或写入。
- root私有 `.env`、`config.yaml`、`extensions_config.json` 与React目录未复制。源码清单还覆盖整个agent-core包（含包内测试）与root contracts；frontend-vue/tests与文档不属于该生产指纹。
- 正式visual/payload config各自执行production build，随后preview；API使用既有mock。此报告证明Linux前端门禁，不冒充真实Gateway或外部IdP验收。
- 末次逐文件复核：当前源码、独立副本与冻结清单一致；新路径扫描没有增删漏项。两份临时采集fixture已恢复原文，临时config已删除；18个截图基准文件与原目录一致。专用采集preview均按实际owned PID停止。

## 正式门禁与补充采集

| 执行                                         | 结果                                          | 证据                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright.visual.config.ts`                | 8 PASS，0 FAIL/SKIP/FLAKY/ERROR；79141.141ms  | [JSON](evidence/2026-10-09-linux-stage29/visual.json)、[log](evidence/2026-10-09-linux-stage29/visual.log)                                            |
| 原visual断言后附加当前PNG保存                | 8 PASS，9PNG；11237.797ms                     | [JSON](evidence/2026-10-09-linux-stage29/visual-capture.json)、[仅采集diff](evidence/2026-10-09-linux-stage29/capture-instrumentation.patch)          |
| `playwright.config.ts route-payload.spec.ts` | 12 PASS，0 FAIL/SKIP/FLAKY/ERROR；75608.137ms | [JSON](evidence/2026-10-09-linux-stage29/payload.json)、[log](evidence/2026-10-09-linux-stage29/payload.log)                                          |
| 原12payload断言附加CDP完整URL                | 12 PASS；六组精确字节与正式运行完全相同       | [JSON](evidence/2026-10-09-linux-stage29/payload-capture.json)、[仅采集diff](evidence/2026-10-09-linux-stage29/payload-capture-instrumentation.patch) |
| `scripts/asset-budget.mjs`                   | PASS，exit0                                   | [精确字节](evidence/2026-10-09-linux-stage29/assets.json)、[log](evidence/2026-10-09-linux-stage29/assets.log)                                        |

原payload结构完整：六条测量、四条hover/focus导航、两个renderer守卫。初始HTML JS hints、错误页、语言闭包、重量renderer关键路径、hover/focus预取、实际导航断言均保留。

## 实际路由下载闭包

raw/Brotli为实际请求的去重产物文件体积，遵循原spec `.br`存在则用预压缩，否则用raw回退；不是网络wire bytes。全部六组prefetch均0文件/0raw/0Brotli。每组critical/prefetch/all完整文件清单、原URL与priority分别见 [正式测量](evidence/2026-10-09-linux-stage29/route-payloads.json)、[原URL](evidence/2026-10-09-linux-stage29/route-payload-urls.json)、[逐文件尺寸](evidence/2026-10-09-linux-stage29/route-file-sizes.json)。四组交互的initial/preloaded/final原URL见 [interaction URLs](evidence/2026-10-09-linux-stage29/route-interaction-urls.json)。

| 路由                   | 语言  | critical文件 | raw bytes | Brotli bytes |
| ---------------------- | ----- | -----------: | --------: | -----------: |
| `/`                    | en-US |           37 |    389315 |       131039 |
| `/`                    | zh-CN |           37 |    387596 |       132503 |
| `/login`               | en-US |           47 |    461135 |       149669 |
| `/login`               | zh-CN |           47 |    459416 |       151133 |
| `/workspace/chats/new` | en-US |          177 |   1462028 |       450694 |
| `/workspace/chats/new` | zh-CN |          177 |   1460309 |       452158 |

## 构建产物资产

下表为全部chunk总量，不能等同于用户首屏下载。gzip统一Linux Node的gzipSync(level9)，JSON保留全部679个chunk精确尺寸和最大文件名。最大gzip230136字节（wasm），最大raw779847字节（emacs-lisp）。原预算未修改。

| 分组              | chunks | raw bytes | gzip bytes | max raw bytes |
| ----------------- | -----: | --------: | ---------: | ------------: |
| vendor-vue        |     10 |    172271 |      64800 |         85357 |
| vendor-markdown   |     13 |    878108 |     267625 |        258534 |
| vendor-codemirror |     11 |    555743 |     199698 |        199773 |
| vendor-i18n       |      3 |    170279 |      60278 |         85840 |
| vendor-ui         |     35 |    769170 |     239613 |        216732 |
| 全部 client JS    |    679 |  15961721 |    3796927 |        779847 |

## 9张当前PNG实际回读

通过快照测试默认不保留actual PNG；因此在独立副本原 `toHaveScreenshot` 成功后再保存PNG，原断言/阈值保留，再将fixture恢复。逐张用view_image读取以下当前截图，均未发现异常空白、遮挡或布局损坏。该人工回读仅对应实际截取视口；设置正文仍保留其正常滚动区域。每图尺寸、SHA256、观察结论见 [readback manifest](evidence/2026-10-09-linux-stage29/image-readback.json)。

| 当前图                                                                                          | 尺寸     | 回读观察                                                             |
| ----------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| [artifact.png](evidence/2026-10-09-linux-stage29/actual/artifact.png)                           | 1280×720 | 折叠侧栏、chat 与 HTML 产物分栏完整；源码/预览/复制/关闭控件未遮挡。 |
| [dark-mode.png](evidence/2026-10-09-linux-stage29/actual/dark-mode.png)                         | 1280×720 | 深色页面、composer、导航与建议入口对比和边界正常。                   |
| [empty-chat-attachment.png](evidence/2026-10-09-linux-stage29/actual/empty-chat-attachment.png) | 1280×720 | 附件卡片、输入焦点轮廓与 composer 选项布局完整。                     |
| [empty-chat.png](evidence/2026-10-09-linux-stage29/actual/empty-chat.png)                       | 1280×720 | 桌面导航、欢迎文案、完整 composer 与六个建议入口均可见。             |
| [mobile.png](evidence/2026-10-09-linux-stage29/actual/mobile.png)                               | 390×844  | 390px 窄屏欢迎文案换行、composer、六入口均在视口内。                 |
| [reasoning-tool.png](evidence/2026-10-09-linux-stage29/actual/reasoning-tool.png)               | 1280×720 | 处理步骤与文件工具路径完整，底部 composer 保持可见。                 |
| [settings-zh-cn-dark.png](evidence/2026-10-09-linux-stage29/actual/settings-zh-cn-dark.png)     | 1280×720 | 中文深色 settings 导航与主题卡、选中轮廓完整；正文保留自身滚动视口。 |
| [settings.png](evidence/2026-10-09-linux-stage29/actual/settings.png)                           | 1280×720 | 浅色 settings 导航、三张主题卡与选中轮廓完整。                       |
| [streaming-message.png](evidence/2026-10-09-linux-stage29/actual/streaming-message.png)         | 1280×720 | human、推理、运行中子任务、Working 与 Stop 呈现完整。                |

Stage28 pre-stop/anchor阶段资料保留在原独立路径，不混入本轮结论。根目录最终verify、完整双端对照、真实后端、Compose及standalone由对应owner以各自最终证据收口。
