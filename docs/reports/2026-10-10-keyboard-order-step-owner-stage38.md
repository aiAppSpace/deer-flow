# Keyboard order：完整遍历的步骤 owner 修复

当前结论：旧完整门禁为 **FAIL（1 小时超时）**；标准步骤 owner 的因果验证、串行真实浏览器小样本与测试接线回归为 **PASS**。修复后的完整宏门禁仍为 **UNRUN**，由根代理的新完整 cross-app 执行。没有产品修改、依赖修改、运行中副本修改或 trace 降采样。

冻结时间、两个测试文件的 SHA、完整检查结果见 [receipt](evidence/keyboard-order-step-owner-stage38/receipt.json)。

## 实际失败与耗时证据

旧副本的错误上下文只有 `Test timeout of 3600000ms exceeded`。原始 trace 为 2,438,557,164 bytes，缺 ZIP central directory，不能作为可完整打开的 trace 声称通过；本次没有修改或修复它，只读取 ZIP local entries，恢复其中可完整解压的 trace 记录。原路径与读取边界见 receipt，错误上下文另存为 [original-error-context](evidence/keyboard-order-step-owner-stage38/original-error-context.md)。

可恢复的 test trace 有 808 次创建 context、807 次关闭；807 个完整相邻 context 时间段合计 3,593.63 秒。它没有完成要求的 844 次独立遍历。

| 按运行顺序分组 | 单次遍历平均 | 第一次按键前 | 60 次按键和读取窗口 | 按键 API 实际耗时合计 |
| -------------- | -----------: | -----------: | ------------------: | --------------------: |
| 第一四分之一   |     2.777 秒 |     1.521 秒 |            1.072 秒 |              0.346 秒 |
| 第二四分之一   |     4.112 秒 |     2.055 秒 |            1.826 秒 |              0.298 秒 |
| 第三四分之一   |     5.023 秒 |     2.421 秒 |            2.394 秒 |              0.300 秒 |
| 第四四分之一   |     5.892 秒 |     2.854 秒 |            2.788 秒 |              0.241 秒 |

耗时随测试历史积累而增长，键盘 API 本身没有相应变慢。最后一次读取至下一 context 的均值约 0.18–0.25 秒，没有证据将 context 关闭或视频归档当作主要原因。Route actions 有大量时间重叠；按区间并集统计约 520.15 秒，占完整遍历墙钟 14.44%，没有把 action duration 的直接求和误当墙钟。

原始统计与只读分析脚本保存在本报告的 evidence 目录，包括 [critical-metrics](evidence/keyboard-order-step-owner-stage38/critical-metrics.json) 和 [trace-metrics](evidence/keyboard-order-step-owner-stage38/trace-metrics.json)。没有复制或声称保存完整的 2.4 GB 损坏归档。

## 精确根因与最小修复

实际安装并由测试执行的 Playwright 为 1.59.1。

源码位置是该包的 `lib/worker/testInfo.js` 第 184–204 行：无当前 step zone 时，`_parentStep()` 调用 `_findLastPredefinedStep(this._steps)`；后者递归回扫已积累的整个步骤树。原宏没有显式步骤，数十万次 API 操作不断扩大此树，导致重复扫描接近二次增长。

同包 `lib/common/testType.js` 第 235–242 行显示，标准 `test.step` 在 async zone 内设置 `stepZone`。API 直接取得当前 owner，因此不必回扫旧树。

修复只增加以下标准步骤结构：完整遍历 → 登记终态和方向 → Vue / React。应用仍串行执行，每次新建且关闭独立 context；当前 app 的操作全部处于明确步骤内。内部两处原 `continue` 改为当前终态步骤的 callback `return`，继续处理下一登记项的含义不变。

没有并行化两端焦点、复用 context、增加 timeout、减少按键、删除登记终态、增加 skip、关闭 trace 或修改 settle。额外的步骤标签也明确记录了失败所在的终态、方向和应用。

## 实际浏览器因果验证

使用已启动的最终 3270 / 3271 服务，创建全新独立 context，不启动服务或构建，不改 active copy。选取四个现有登记终态：sidebar、integrations 的 change-app、sidecar-chat 的 mobile-sheet、scheduled-tasks 的 queued-delete。

先运行原串行方式，再运行仅增加标准 outer step 的串行方式。两种策略各含四终态 × 两方向 × 两应用 × 60 次真实按键和 active-element 读取，共 32 个 fresh contexts、1,920 次按键及读取。16 组同应用、同方向的转移集合逐项一致，直接 exit 0，1 个验证用例通过。

诊断仅在该临时测试内包裹 `_parentStep`，计时后原样返回，并在 finally 恢复；没有修改安装依赖或正式门禁。

- 原方式：3,282 次 browser API 全部没有当前 owner，parent lookup 累计 848.83 ms。
- 标准步骤：同样 3,282 次 browser API 全部取得 `test.step` owner；计入外围 root-step 创建和末尾 32 次比较断言后，累计 lookup 48.38 ms，至少减少 94.3%。
- 这次小样本的遍历墙钟之和分别为 31.23 秒和 38.59 秒。执行时存在其他门禁负载，**没有据此宣称总体墙钟已缩短或完整宏已通过**。确定的因果证据是历史回扫被消除；完整时限由新一轮正式大门禁判断。

完整落点、时间与 observer 统计见 [step-parent-timing](evidence/keyboard-order-step-owner-stage38/step-parent-timing.json)，直接执行结果见 [step-parent-results](evidence/keyboard-order-step-owner-stage38/step-parent-results.json)。此前独立双应用并行小样本仅作为诊断记录保留，未采纳到正式实现，也不构成新的焦点合同。

## RED → GREEN 与合同保持

新增单测执行实际宏源码和完整登记数据，只将浏览器 API 换成可计数的确定性边界，并用 AsyncLocalStorage 检查操作 owner。它验证测试接线，不替代真实浏览器行为。

旧源码：owner 合同 **1 FAIL**，检测到 106,344 次没有完整 owner 的操作；原完整遍历合同 **1 PASS**。修复后两项均 PASS，逐项核对 844 个 fresh contexts、50,640 次按键及读取、Vue 后 React 的串行顺序、前 context 关闭后才允许新建下一 context，以及原 3,600,000 ms 预算。

独立 AST 对比确认：原 7 个断言、7 个常量声明、4 个函数（包括真实 walk）、测试题名及 timeout 完整一致。原已有 unstable-ring / single-stop 集合与反空转下限保留；没有更换采样数据。[assertion-audit](evidence/keyboard-order-step-owner-stage38/assertion-audit.json) 保存逐项打印结果。

验证结果：

- 聚焦 3 files / 36 tests：direct exit 0。
- tests TypeScript、两文件 ESLint、Prettier：均 direct exit 0。
- 正式 parity `--list`：当前实际 913 tests / 32 files，direct exit 0；本文件始终只有 1 个 Playwright case。与旧 909 的差值来自同期间另外三个已变动的 spec，不由本修复增减。
- 新完整 keyboard-order 宏：UNRUN。

keyboard-trap 只读发现同类无显式步骤的大 loop，但目前没有收到它的实际失败；本次没有扩大修改范围。
