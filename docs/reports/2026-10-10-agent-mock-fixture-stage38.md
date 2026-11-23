# Agent mock 夹具根因收口（Stage38）

本次只修改 `frontend-vue/tests/e2e/agent-chat.spec.ts` 的两个现有夹具，不改产品、Query policy、等待预算或用例数量。首轮完整产品套件的 **507 PASS / 5 FAIL** 已保留；本报告记录其中两个失败的实际修复，不能替代后续完整聚合验收。

## 欢迎区刷新事件

首轮初始 Agent `display_name` 的欢迎区与页头均已通过；更新后的两个位置没有变化。installed `@tanstack/query-core@5.90.20/src/focusManager.ts:24` 监听的是 `window` 的 `visibilitychange`，旧夹具在 document 上构造的 Event 默认不冒泡，未到达该 Query owner。实际 `useChatAgent` 已订阅 canonical detail query，并明确启用 focus 刷新。

夹具改为向 document 派发 `bubbles:true` 的相同事件，并临时用一次性 window listener 断言真实传播已到达；保留欢迎区和页头 `Review Assistant` → `Updated Review Assistant`、detail GET 精确 **1 → 2** 的全部原断言。没有新增等待或修改产品。

## 模型 503 重试计数

首轮 trace 的两次 `/api/models` 均为真实 503：`21:13:23.285Z` 与 `21:13:24.335Z`，约间隔 1.05 秒。React `core/models/hooks.ts` 和 Vue `composables/useModels.ts` 均明确为非 `UnauthorizedError` 且 `failureCount < 1` 重试；focus=false、staleTime=Infinity 保持一致。旧夹具的精确一次请求与这两个当前生产 owner 矛盾。

夹具保留原 503、终态错误提示以及提示后原 300ms 的 bounded/no-storm 检查，精确请求断言改为 **2**，没有改成范围。实际 Query consumer 回归同时验证 transport/503 各两次、401 一次，以及 visibility 不额外请求。

## 实际验证与输入边界

- 原 `.output`、root 自有 `3291` preview 上运行两个原用例：**2 PASS / 0 FAIL / 0 SKIP，direct exit 0**。没有重新构建。
- 实际 Query consumer 两文件：**24 PASS**；完整 tests types、局部 ESLint、Prettier 均 direct exit 0。
- 唯一测试文件 SHA256：`edaa41d45e646141297b0a6e78df357126b3a70bc139fde4005f1466d858e68c`。
- 精确改动、当前生产 owner SHA、首轮 GET 时序与所有真实日志见 `docs/reports/evidence/capabilities-final-stage38/agent-fixture-receipt.json`、`agent-fixture-exact.diff` 和同目录日志。
- 首次工具包装参数与 scratch grep 的修正单独保留在 receipt 中；真正验收结果只引用修正后实际运行的检查。

另外三个首轮失败由各自 owner 处理。完整 `e2e-mock → e2e-backend → e2e-external` 在根因统一收口后重跑；当前不将尚未执行的套件或入口记为通过。
