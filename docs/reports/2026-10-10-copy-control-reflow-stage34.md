# 工具详情 Copy 控件重排验收（Stage34）

当前状态：Stage35 新编译产物的原 Copy 两项正式回归 **2 PASS（direct exit 0）**，同批原 Lark interaction 一项也 PASS，合计 **3 PASS / 0 skipped / 0 flaky / 0 errors**。此前旧源正式 2 FAIL 与标准布局因果 2 PASS 均保留为根因证据。最终测试同时保留两个完整可见性 ratio=1 断言，均通过真实键盘重入验证。

## 根因与修复

360×800、根字体 32px 时，Vue Copy 按钮高 159.9375px，而其原生 scrollport 只有 126px；React 分别为 240px 和 138px。真实键盘聚焦仍无法完整容纳按钮。问题是嵌套面板 `p-3` 与 Button `px-3` 将可用文本列压得过窄，不是滚动 owner 或焦点事件遗漏。

只去掉 Copy 横向 padding 的负控让 Vue 可达，但 React 按钮仍高 160px，超过 138px scrollport。完整最小方案沿用 Tailwind 标准命名 container：工具详情外层声明 `tool-details`；其窄容器面板改为 `p-2`；现有 `tool-payload` 窄容器 Copy 按钮改为 `px-0`。保留全部文案、字号、换行与原生滚动结构。因果实验中 Vue 按钮为 79.96875px，React 为 120px，scrollport 均不变。

桌面实验在原生 smooth scroll 稳定后比较 main 全部后代的矩形与 padding，Vue 324 / React 357 个元素均零差异。对照和实验均使用同一已构建产物的独立浏览器 context。

## 正式回归边界

原 `chat-state-resize.spec.ts` 两用例保留 360/32px→1280/16px 两方向、四类 Copy 按钮、expanded=true、Input/Error 唯一性、原始错误全文、所有请求 mock 和 ratio=1。新增从真实 overflow 祖先读取的按钮高度≤scrollport 高度断言，及 Shift+Tab→Tab 的真实键盘重入、toBeFocused 与 ratio=1；没有放宽阈值或缩减状态。

旧正式失败的 trace、截图与错误上下文已保全；增强后的正式旧源回归再次稳定 2 FAIL。此前临时 runner 缺失包解析的 0tests 错误不计为 TDD RED。

## 定向验证

- Vue 两文件 40 tests PASS，direct exit 0。
- React 两文件 45 tests PASS，direct exit 0。
- 两端定向 ESLint 与 Prettier direct exit 0。
- Stage35 Vue3250 / React3251 新编译产物正式三项 **3 PASS，12.7s，direct exit 0**；Copy 两项分别4.6s / 5.0s，原 Lark interaction 1.5s。

## 证据

全部证据在 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/copy-control-reflow-stage34/`：`production-freeze.json` 记录三源 SHA 和精确冻结时刻；`formal-old-source-red.{json,log}` 与同名 results 保存正式失败；`native-container-causal.{json,log}`、两端 causal JSON 和精确 runner 保存标准布局实验；`copy-padding-only-*` 保存不完整方案的负控；`vue-unit.log` / `react-unit.log` 保存既有行为回归结果。

Stage33 Docker / Linux 成功只对其原冻结输入有效，此次生产修改之后的最终镜像与浏览器证据须重新取得。

## Stage35 真实焦点顺序复验

生产容器布局已生效：Vue 按钮79.96875px≤原生port126px；React120px≤138px。程序滚动后直接读取可见性仍红；随后只调用程序 `.focus()`，React 首按钮顶239.703125px、port顶240px，得到 ratio0.997526。该失败现场完整归档，没有提高容差。

同一产物的真实 Shift+Tab→Tab 让按钮顶248.703125px，全部四类 Copy、两个断点方向均完整可见；焦点事件也确实离开再进入。最终正式 spec 在两个原 ratio=1 读数之前分别执行原生键盘进入，保留 toBeFocused、动态 buttonHeight≤scrollportHeight、全部 expanded/Input/Error/原错误全文和 API mock 断言。没有产品焦点补偿、手工坐标或滚动 owner 改动。

最终正式日志/JSON/精确 runner/spec 与生产输入 SHA：`docs/reports/evidence/copy-control-reflow-stage34/stage35-formal-final/`。程序 focus 边缘失败在 `stage35-programmatic-focus-red/`；原生键盘分阶段真实几何在 `stage35-native-focus/`。这批preview的5538项独立源码snapshot SHA为04ce0e533629af6b2f8010d4a6f25bdcf0f358762dd4caa1b1bc07e92b3fbc89，receipt见 `docs/reports/evidence/root-stage34-checkpoints/cross-source-final.json`；`freeze-copy-proof.json` 与实际cross-app/prebuild日志证明关键产品源/副本无漂移、真实build/start和新进程。没有独立完整编译产物字节inventory，不作该项声明；Docker镜像的899/812生产选源receipt是另外一套证据。完整 aggregate 仍须更新最终测试文件后重新运行，本次三项不外推为全量通过。
