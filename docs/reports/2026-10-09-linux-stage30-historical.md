# Stage30 Linux 历史快照验收

本报告只证明 Stage30 精确快照：visual 8/8、payload 12/12、asset-budget、9张实际PNG回读均 PASS。Stage31 已修改生产布局，以上结果不能外推到当前源码；当前最终 Linux 与 standalone 验收等待统一冻结后重新执行。

## 输入和执行边界

- `main-wc`，HEAD `a7804539530846baecf548af7b5d2612deb89b68`，未提交或推送。
- 940项输入聚合 SHA256 `a83e4574fd6ad42cbbc9407c873be1f61c2eaa3897b651379760c66be05f4f4d`；[完整清单](2026-10-09-linux-stage30-source-fingerprint.json)。
- 独立 Linux 容器 `deerflow-vue-linux-gates`，工作根 `/work/frontend-vue`，原生独立 node_modules。没有使用原 checkout 缓存，React与root私有运行配置不复制。
- 正式 visual 与首轮 payload 都按原配置 production build。payload 首轮11PASS/1FAIL后只修测试采样生命周期，在同一正式编译产物完整复验12项，不以重建掩盖差异。
- clone全部940项与清单零drift；当前checkout变更及证据边界见 [source-boundary.json](evidence/2026-10-09-linux-stage30/source-boundary.json)。采集fixture已恢复，临时配置已删除，自有preview按记录PID停止。

## 门禁及真实失败处理

| 执行                         | 结果                                             | 证据                                                                                                                                                |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正式 visual 原配置重跑       | 8 PASS，154248.803ms；0 FAIL/SKIP/FLAKY/ERROR    | [JSON](evidence/2026-10-09-linux-stage30/visual.json)、[log](evidence/2026-10-09-linux-stage30/visual.log)                                          |
| 原截图断言后保存当前PNG      | 8 PASS，9张实际图                                | [JSON](evidence/2026-10-09-linux-stage30/visual-capture.json)、[采集diff](evidence/2026-10-09-linux-stage30/capture-instrumentation.patch)          |
| 完整 payload 采样修复后复验  | 12 PASS，16715.857ms；0 FAIL/SKIP/FLAKY/ERROR    | [JSON](evidence/2026-10-09-linux-stage30/payload.json)、[log](evidence/2026-10-09-linux-stage30/payload.log)                                        |
| 原12项断言附加CDP URL采集    | 12 PASS，37840.708ms；六条测量尺寸与正式复验一致 | [JSON](evidence/2026-10-09-linux-stage30/payload-capture.json)、[采集diff](evidence/2026-10-09-linux-stage30/payload-capture-instrumentation.patch) |
| asset-budget                 | PASS，exit0，原预算不变                          | [精确字节](evidence/2026-10-09-linux-stage30/assets.json)、[log](evidence/2026-10-09-linux-stage30/assets.log)                                      |
| 编译后历史Mermaid+通用代码块 | 1 PASS，6053.614ms；原全部token/theme断言保留    | [JSON](evidence/2026-10-09-linux-stage30/mermaid.json)、[编译module证据](evidence/2026-10-09-linux-stage30/compiled-markdown-resolution.json)       |

首次视觉启动在原240000ms构建窗口超时，实际0测试执行，保留[JSON](evidence/2026-10-09-linux-stage30/visual-initial-build-timeout.json)与[log](evidence/2026-10-09-linux-stage30/visual-initial-build-timeout.log)。当时其它独立Docker构建并发，资源压力只属推断；待其结束使用相同配置重跑通过，没有增大timeout或更新截图基准。

首次payload真实1项失败也保留[JSON](evidence/2026-10-09-linux-stage30/payload-initial-failure.json)、[现场](evidence/2026-10-09-linux-stage30/payload-initial-failure/trace.zip)。Mermaid通过可见性、debounce和idle调度渲染；旧fixture在networkidle时就卸载CDP，随后通用SVG选择器可以命中导航图标，漏采实际图表下载。测量函数只为阳性图表用例增加真实 `Mermaid chart` 可见前提，并以finally停止CDP；六条默认路由采样未改。保留sequenceDiagram产物标记、下载尺寸、pageErrors及原SVG断言，未修改产品。修复后单项、完整12项和附加完整12项均通过；scoped lint/format PASS。

## 实际下载与资产

全部六组初始prefetch均0文件/0bytes。raw/Brotli是浏览器实际下载去重文件的产物尺寸，缺.br时回退raw；不是wire bytes。完整[文件集合](evidence/2026-10-09-linux-stage30/route-payloads.json)、[URL](evidence/2026-10-09-linux-stage30/route-payload-urls.json)、[逐文件大小](evidence/2026-10-09-linux-stage30/route-file-sizes.json)、[四组交互URL](evidence/2026-10-09-linux-stage30/route-interaction-urls.json)保留。

| 路由                   | 语言  | critical文件 | raw bytes | Brotli bytes |
| ---------------------- | ----- | -----------: | --------: | -----------: |
| `/`                    | en-US |           37 |    389508 |       131105 |
| `/login`               | en-US |           47 |    461367 |       149741 |
| `/workspace/chats/new` | en-US |          176 |   1461471 |       450094 |
| `/`                    | zh-CN |           37 |    387768 |       132580 |
| `/login`               | zh-CN |           47 |    459627 |       151216 |
| `/workspace/chats/new` | zh-CN |          176 |   1459731 |       451569 |

全部chunk总量不等于首屏下载。gzip为Linux Node gzipSync(level9)，最大raw 779847 bytes，最大gzip 230136 bytes。

| 分组              | chunks | raw bytes | gzip bytes |
| ----------------- | -----: | --------: | ---------: |
| vendor-vue        |     10 |    172271 |      64800 |
| vendor-markdown   |     13 |   1069094 |     322864 |
| vendor-codemirror |     11 |    555743 |     199698 |
| vendor-i18n       |      3 |    170868 |      60415 |
| vendor-ui         |     34 |    581213 |     184723 |
| all-client-js     |    678 |  15966798 |    3797467 |

## 实际视觉回读

9张当前PNG均逐张通过view_image读取，未发现空白、遮挡或布局损坏；[尺寸/SHA/逐图观察](evidence/2026-10-09-linux-stage30/image-readback.json)，实际PNG位于 [actual目录](evidence/2026-10-09-linux-stage30/actual/)。原快照断言成功后才额外保存PNG；采集不会改变原断言和阈值。18张基准均未更新。

完整真实Gateway、外部IdP、Compose与双端对照由各自门禁证明；standalone当前最终轮尚未执行，本报告不赋予其PASS。
