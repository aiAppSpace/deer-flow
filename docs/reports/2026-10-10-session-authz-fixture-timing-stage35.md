# 真实 SQL 鉴权夹具超时复核

保留原 30 秒限制，夹具和测试代码未改。两次独立定向执行均为 1 文件 / 2 项 PASS，direct exit 0，无 skip。第二次逐项计时分别为 12,987ms、11,395ms；第一轮两项共 18.58 秒，第二轮共 24.38 秒。完整日志、JSON、未改源 SHA 见 [证据摘要](evidence/session-authz-fixture-stage35/summary.json)。

原全量在多个重构建同时执行时，第一项耗时 31,439ms，超过 30,000ms，整个两项文件为 51,667ms。其余三条失败属于独立的文档 Git inventory ENOBUFS，由 root 另行修复。原始失败不覆盖或改写，见 [canonical 原日志](evidence/root-stage34-checkpoints/vue-canonical.log)。

`run_authz_gateway.py --check` 使用临时 home/配置/数据库和真实 TestClient，检查首启、SQL preferences、CSRF、expected-owner、真实角色撤销和恢复；环境清理在 app 导入前完成，不读取运行配置。唯一尝试的 run 在 admission 被 403 拒绝，没有获准 run 进入配置中的 45 秒 M0 模型等待，也没有固定 45 秒等待链。

本次只复现了耗时差异，没有复现断言或流程缺陷。结合当时多个构建与完整 Vitest 并发，资源竞争是相符的解释；失败时没有 OS CPU profile，不能把具体竞争归因表述成已独立证明。无需增加 timeout 或缩减真实 SQL 断言。最终仍须错峰执行完整单测，以证明该原阈值在完整运行中通过；两次定向通过不冒充全量 PASS。
