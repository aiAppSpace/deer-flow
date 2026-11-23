# Stage 37 canonical 两条单测失败的根因修复

仅修改测试，不修改生产源码、阈值、超时、场景数量或目标 ledger。完整 canonical 的原始结果是 458 files / 3804 tests 中 2 FAIL，原始日志由根任务保存在 root-stage37-checkpoints/vue-canonical.log；后续完整门禁仍由根任务重跑，此处不以定向结果替代完整 canonical。

## 契约变异负控

真实失败是默认 5000ms testTimeout：同一 case 的 generator + 三轮 TypeScript compiler 实际 6312ms。原始两文件定向复验中该 case 在原阈值下通过，但共享定位器仍红，见 [定向 RED](evidence/canonical-unit-fixtures-stage37/focused-red.log)。没有任何类型断言被删或被忽略。

旧 checker 每轮创建一个冷 Program，解析 111 个源文件，再计算整个传递依赖图的诊断，最后丢弃四个真实消费者以外的诊断。三个真实生成契约修订重复这份工作。新 checker 在本 case 内复用一个 CompilerHost、110 个未变化的真实 SourceFile 与 oldProgram；生成契约每次重新创建 SourceFile，保留真正的变异输入。编译器直接返回四个原目标消费者的 syntactic/semantic diagnostics，不再对最终会丢弃的其他实现做重复检查。未增加全局或单测 timeout，没有 catch 编译错误，没有构造替代消费者或截掉生产代码。

实际分阶段测量如下，单位 ms；两个 profiler 均读取真实生产消费者、实际 generator 与 contracts。

| 修订                        | 原 createProgram | 原 diagnostics | 新 createProgram | 新 diagnostics |
| --------------------------- | ---------------: | -------------: | ---------------: | -------------: |
| 原契约                      |           435.93 |         525.92 |           401.68 |         196.87 |
| 新 UI/unmet/host/event code |           238.35 |         370.46 |             2.65 |          69.02 |
| 新 finish/pause reason      |           226.31 |         440.34 |             1.96 |          41.65 |
| 合计                        |                  |    **2237.32** |                  |     **713.83** |

三轮诊断数量仍是 **0、4、5**；每条 diagnostic 的 file/code/start/length 完全相同。TypeScript 在两条消息中调整了 union 成员的枚举顺序，因此没有声称完整消息字符串逐字相等。原六个未来 code/reason 的真实缺失映射断言全部保留并通过。原 checker 快照、[旧测量](evidence/canonical-unit-fixtures-stage37/compiler-before.json)、[新测量](evidence/canonical-unit-fixtures-stage37/compiler-after.json) 与准确签名对照在证据目录；5000ms 前后未变。

## 共享 display_name 定位器

原场景用 Tailwind class 选择 Welcome，违反已有的跨框架共享定位规则。直接扩大为 main 内精确文本又会遇到外层 main 同时包含 header 的事实：两端都匹配 header 与 Welcome 两处，真实四个浏览器探针均 RED，完整 [日志](evidence/canonical-unit-fixtures-stage37/semantic-selector-first-red.log)、[JSON](evidence/canonical-unit-fixtures-stage37/semantic-selector-first-red.json)、trace/PNG 均已归档。

最终选择器使用实际共享内容与 landmark：`main :text-is("Review Assistant"):not(header *)`。它断言 main 内精确的 display_name，排除已另行断言的 header，不依赖 class、Vue-only test ID 或组件库内部结构。

在当前正式编译服务 3250/3251 的独立 contexts 上实际验证 React/Vue × en/zh 四案：header 名称唯一、Welcome 名称唯一且可见、原模型选择弹层与按钮交互全部通过。使用原场景和原 model-picker 全部 steps；不修改运行中的 cross copy、服务器、源码或构建。结果 **4 PASS，direct0，0 skip/flaky**，[日志](evidence/canonical-unit-fixtures-stage37/browser-final.log)、[JSON](evidence/canonical-unit-fixtures-stage37/browser-final.json)。这四案为隔离诊断，不增加正式 collector 数。

## 冻结与验证

准确两个测试路径、逐文件 SHA/mtime、命令、direct exit 与结果见 [receipt](evidence/canonical-unit-fixtures-stage37/receipt.json)。最后测试修改为 2026-10-10 03:14:01.112667 CST。

- 原始两文件：1 FAIL / 10 PASS，generator focused 原阈值通过，class guard 确定 RED。
- 修复后两文件：11 PASS，direct0，整体 1.52s。
- Tooling/parity/invariant 相关 19 files / 128 tests：PASS，direct0。
- 全测试 TypeScript、scoped ESLint、Prettier：PASS，direct0。
- 当前真实编译两端、两语言原交互：4 PASS，direct0。
- 新完整 canonical/full cross 与本地入口：由根任务按最终统一源排程，本报告不提前声明 PASS。
