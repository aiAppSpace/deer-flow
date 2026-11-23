# MemorySettings 测试生命周期收口

两份测试已于 2026-10-10 04:25:18 CST 冻结。本次只改测试和本报告，产品懒加载、组件源码、等待阈值及现有行为断言均未改变。

## 实际失败与因果

原完整 canonical 的 459 个文件、3813 条断言均通过，但产生 4 个未处理拒绝，因此整体失败。每条堆栈均为 `settings-components.dom.test.ts` 挂载 MemorySettings 后，经 MessageMarkdown、MessageMarkdownContent、StreamMarkdown、MarkdownBlock 加载 Markdown runtime，在 Vitest 环境已经结束时继续解析模块。原始日志保存在 [vue-canonical-unified.log](evidence/root-stage38-checkpoints/vue-canonical-unified.log)。

这里存在两个独立边界：

1. 七条事务测试中，仅前两条在成功路径末尾卸载组件，后五条完全没有卸载。清空 body 只移除节点，无法退役 Vue 组件 scope 和 portal owner。将 Markdown 单独替换为保留正文的边界后，用真实挂载实例的 `isUnmounted` 清点，原夹具得到 **5 FAIL / 2 PASS**，与源码缺口一致；最终夹具同一清点得到 **7 PASS**。
2. 卸载组件不会取消已经发出的动态模块加载。独立探针使用真实 MessageMarkdown 及一个由显式 Promise gate 控制的内容模块：模块进入加载后卸载组件，实际组件已经 `isUnmounted`，模块仍未完成；释放 gate 后模块继续完成，但不再提交渲染。该因果探针 **1 PASS**，正常释放资源，无睡眠、异常吞噬或 teardown 宽免。

冷进程单跑原七条测试得到 **7 PASS / direct exit 0**，没有复现完整套件的 teardown 时序。该结果如实保留，不能替代已经实际失败的完整 canonical，也没有据此把原失败改记通过。

## 修复边界

- `settings-components.dom.test.ts` 使用 Vue Test Utils 的标准 `enableAutoUnmount`；统一 afterEach 先卸载所有组件，再清 toast、mocks、globals 和 DOM。所有事务、导入确认、迟到结果隔离、失败保留及精确 mutation 断言保留。Markdown 使用已有测试边界模式，明确接收并呈现 `content`；另加一条正文仍包含 Vue parity 的断言。
- `memory-document.dom.test.ts` 同样统一卸载。原来的两条真实摘要呈现合同显式选择真实 renderer，原 `vi.waitFor`、5000ms、标题层级、引用、raw HTML、粗体样式及相对时间断言保留。其余五条筛选、metadata、按钮名合同使用正文边界，不启动不属于这些断言的动态渲染管线。
- 同类直接挂载 MemorySettings 的 DOM fixture 只有上述两份。settings-memory-loading 与 settings-dialog 模拟 MemorySettings 模块，并已有 wrapper 清理，本次未修改。
- 清理 memory-document 文件头已经失效的旧取样叙述，只留下当前实际职责及异步等待因果。

TypeScript AST 对照统一冻结副本，比较完整 matcher 调用和用例标题：事务文件原 **26** 条 expect 全部保留，新增正文断言 **1** 条；呈现文件原 **30** 条全部保留；两份文件的 **7 + 7** 个用例标题不变。

## 实际验证

| 检查 | 实际结果 |
| --- | --- |
| 原夹具独立冷跑 | 7 PASS，exit 0；未复现完整套件时序 |
| 原清理 owner census | 5 FAIL / 2 PASS，exit 1 |
| 最终清理 owner census + pending import 因果 | 8 PASS，exit 0 |
| 两份 MemorySettings fixture | 14 PASS，exit 0 |
| 全 settings、全 markdown、settings-dialog/loading 聚焦集合 | 28 files / 217 PASS，exit 0，无未处理异常 |
| 两份测试 ESLint / Prettier | 各 exit 0 |
| tests vue-tsc：实际 tsconfig.tests.json | exit 0 |
| 本代理完整 unit / build | UNRUN，根代理统一重跑 |

首次类型命令误写了不存在的 tsconfig.test.json，实际 exit 1；随后使用仓库真实 tsconfig.tests.json，实际 exit 0。两个结果及原因均保留，没有把错误调用记成通过。

冻结文件 SHA-256：

- settings-components.dom.test.ts：`568fee704112dce489653d7c08d7dd6ee9c5139b007ed4fe9b66236331de4c35`
- memory-document.dom.test.ts：`652d050a6a1613a9fce15b7bfc83fcfe70121ae7a23a22d9517869ad3c3808ad`

原始 JSON、命令日志、前后 fixture、因果探针与完整断言 inventory 保存在 [evidence/memory-fixture-lifecycle-stage38](evidence/memory-fixture-lifecycle-stage38/receipt.json)。所有诊断额外 case 仅位于证据副本，正式测试用例数量未改变。

CI 的 extension OpenAPI fixture 校验由根代理独立实际执行，direct exit 0，见 [openapi-extension-fixture-final.log](evidence/root-stage38-checkpoints/openapi-extension-fixture-final.log)。本代理未重复执行；该前置结果不替代后续完整 canonical 或浏览器聚合验收。
