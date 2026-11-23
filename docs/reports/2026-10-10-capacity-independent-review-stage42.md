# Stage42 六处容量修复独立复核

复核时间：2026-10-10 08:27 CST。评审者未修改任何生产文件、正式规格、量具阈值或基线；仅新增此报告和 `docs/reports/evidence/capacity-independent-stage42/` 内的诊断工具/证据。未启动构建或完整单测。现有预览 3270/3271 的源目录和运行页面均未修改，诊断使用独立浏览器 context。

**结论：最终六文件的容量方案未发现剩余代码级阻断；首次项目方案的真实 1/64px 裁剪已定位并由页面已有内边距容量方案消除。候选因果验证通过不等于新源码编译验收通过。新编译正式 8 项及完整原门禁仍由根代理执行。**

## 当前源码与根因

精确六文件 SHA 已逐个重新计算，全部匹配根代理的 [冻结清单](evidence/root-stage42-checkpoints/capacity-six-production-freeze.json)，聚合 SHA `0e07e3c2a4b4ab791f1c0c4b88237dcc725d57d67ede6c25e9d0e9ef9800089b`。本次独立 [receipt](evidence/capacity-independent-stage42/independent-freeze-receipt.json) 包含逐文件 SHA、字节数、旧编译副本 SHA、检查直接退出状态与输入时间边界；不是全仓库零漂移声明。

- **ArtifactPanel / artifact-file-detail**：删除仅在低高度强制 `h-auto/min-h-full` 的覆盖，恢复宿主已有 `size-full` 的有界面板与原生滚动。原覆盖使面板按长报告撑高、落在外层裁切范围以外；删除覆盖没有改预览、编辑、请求、焦点或虚拟化业务。原面板和正文滚动仍各自承担原职责，没有加入脚本滚动或新容器。
- **SettingsDialog 两端**：既有、明确高度的 dialog size container 为容量依据；低容器高度时 grid 使用自然行、面板 viewport 高度按容器上界约束，同时让既有 dialog 自身可原生滚动。没有再把 header/nav/正文压成无容量的固定分数行。双列保留；正常桌面高度不命中新增低高度查询，已有桌面逐节点几何对照为零差异。
- **项目详情两端**：已聚焦的 TabPanel 必须在一次原生滚动状态中完整落入外层 viewport。最终上界为 `calc(100cqh - var(--spacing)*14)`，14 正好来自当前页面 `pt-8 + pb-6`；随实际 spacing/root font 缩放。保留现有外层页面滚动与语义 TabPanel 的原生内容滚动，未隐藏内容、减小字体或修改 Tab 行为。

第一次项目上界 `100cqh` 的真实失败不是焦点动作空操作：Vue 原生 Tab 后 outer scrollTop=160，panel 高 312、top=47.984375、bottom=359.984375，祖先 viewport 为 48..360，IO ratio=0.999949932。原生 wheel 到 159/161 分别切掉底部/顶部，不能同时容纳等高节点。React 同终态为 48..360、ratio=1。

分数源头已定位到真实生产 CSS：Vue 行高变量优化为 `1.42857`，项目 header/new-chat 自然高度 35.984375、h1 高 31.984375；React 保留 `calc(1.25/.875)`，相应高度 36/32。没有 transform/scale/zoom、额外 margin/border 或两端 TabPanel focus handler 差异。已安装 Reka/Radix TabsContent 均只声明 tabindex=0；故不能靠焦点重试弥补等高容量的整数原生滚动相位。最终方案按现有页面内容盒计算容量，没有添加 1px 补偿。

## 本次直接执行的证据

| 检查 | 结果与边界 |
| --- | --- |
| Vue 现有 artifact/settings/project DOM | 8 文件 / 38 PASS，直接 0；最后两项目 CSS token 之前执行 |
| React 现有 artifact/project/settings consumer/Dialog DOM | 7 文件 / 66 PASS，直接 0；最后两项目 CSS token 之前执行。未把 Account consumer 或 Dialog primitive 单测冒称 SettingsDialog CSS 布局验证 |
| Vue 最终项目 DOM | 3 文件 / 10 PASS，直接 0；最终 token 后执行 |
| Vue/React scoped lint、format 与类型 | 均直接 0；Vue 最终项目 lint/format、Vue app types 另在最终 token 后直接 0。React 后续完整 check/unit 由根代理独占 |
| 首次六源等价 CSS + 原正式 8 断言 | 6 PASS / 2 Vue 项目 FAIL，直接 1；原 ratio1 红项保留 |
| 页面 padding 候选矩阵 | 56 PASS，直接 0，0 skip/flaky；含两端全部 14 个已登记项目详情路由终态 × root16/32 |
| 最终等价 CSS + 原正式 8 断言 | 8 PASS，直接 0，17.8s，0 skip/flaky |
| 新源码编译正式 8 与完整门禁 | 本评审 UNRUN，不以候选结果替代 |

56 项中 52 项实际保留项目 TabPanel，均原生 Tab focus + ratio1；其中 30 项确有内容溢出，原生 Home→PageDown 产生实际 scrollTop 增长。4 项 attach 终态按原步骤已导航 chat、无项目 TabPanel，明确记录为目标 owner 不适用，没有伪称其项目键盘合同通过。原 modal 终态先按原 scenario 到达，再原生 Escape 返回保留的项目 panel。正常桌面共 3020 个后代 rect 比较完全相同。两 Vue 原红终态撤销候选重新得到 ratio<1，恢复后 ratio1；没有放宽或删除原断言。

最终辅助 8 用例只增加等价 CSS 调用及必要导入；剥离该调用后，两份正式规格的完整 `for` 测试主体与当前源码逐字一致，记录在 receipt。所有矩阵 API 均由已有 page mocks 处理；context 层兜底 abort 未匹配 API，实际 fallthrough=0，没有向根代理 Gateway 8160 发送 mutation/seed/reset。

## 证据与剩余边界

- [独立 receipt / 六 SHA](evidence/capacity-independent-stage42/independent-freeze-receipt.json)
- [首轮严格 6 PASS / 2 FAIL](evidence/capacity-independent-stage42/aux-native-results.json)、[完整原生 Tab/wheel 几何](evidence/capacity-independent-stage42/project-native.log)、[行高来源](evidence/capacity-independent-stage42/project-layout.log)
- [56 项矩阵](evidence/capacity-independent-stage42/project-padding-matrix-results.json)、[52 个实际 panel 读数](evidence/capacity-independent-stage42/project-padding-observed.json)
- [最终原 8 断言辅助结果](evidence/capacity-independent-stage42/aux-spacing-native-results.json)、[log](evidence/capacity-independent-stage42/aux-spacing-native.log)
- [六文件相对旧编译副本的真实差异](evidence/capacity-independent-stage42/six-source-vs-old-compiled-copy.patch)

根代理既有 artifact 多宽/32px候选矩阵 `matrix-candidate-results.json` 实际为 2 FAIL，不能记成更广矩阵 PASS：React 移动端切换到 Sheet 后原 aux 的 `#artifacts` 宿主假设失效；Vue 单次最近 owner wheel 的 ratio0.673 也未证明串联外层原生 pan 后不可达。本次没有改该 aux 或降低合同；正式 artifact 新增 2 项保持指定 1280×360×16，全部既有宽度、字号、宏观 reflow 和实际可达门禁继续保留，须在最终新编译源重验。

最初 evidence-only aux 因 ESM package scope 初始化失败、0 用例执行的日志和 JSON 亦已保留为 `loader-failure-*`；只给证据目录补 module 声明后才产生上述实际浏览器结果。该准备失败不是产品验收 PASS，也没有覆盖后续真实 RED。
