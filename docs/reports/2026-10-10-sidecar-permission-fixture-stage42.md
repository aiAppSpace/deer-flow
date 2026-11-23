# Sidecar 权限单测依赖边界修复（Stage42）

本轮只修 `frontend/tests/unit/components/workspace/sidecar-delete-gating.dom.test.tsx`。生产文件、权限实现、用例数、超时与服务进程均未修改。

## 根因

完整 React 单测原结果是 318 files、2924 assertions PASS，但测试文件存在未处理的 `HTTP 400` rejection，命令实际退出1，不能算整体通过。原日志 [react-full-unit.log](evidence/root-stage42-checkpoints/react-full-unit.log) 保留不覆盖。

该权限 DOM fixture 只隔离了 models，真实 `SidecarPanel` 仍运行 `useThreadStream`，SDK 由模拟线程身份请求 `http://localhost:3000/mock/api/threads/sidecar-thread-1/history`。`isMock` 选择 mock HTTP 路由，不意味着停止 transport。面板还会读取 parent/sidecar 的上传限额；这些与被测删除权限无关，却跨过了单测依赖边界。请求结束和 happy-dom 卸载的相对时序使旧完整测试间歇报告 unhandled rejection。

拒绝网络的探针复现原3条用例：每条都观察到 `/api/threads/parent-1/uploads/limits`、`/api/threads/sidecar-thread-1/uploads/limits` 和 SDK history 共3次调用，严格零调用断言全部失败。探针直接返回本地400响应，**没有转发任何请求**；此处合成400仅用于拒绝漏出的网络，与原完整运行实际服务400分别记录。详见 [fail-closed-red.log](evidence/sidecar-unit-fixture-stage42/fail-closed-red.log)。

## 修复与保留合同

沿相邻发送失败单测的 domain 边界，为 threads stream/delete transport 提供稳定空闲状态，隔离 sidecar lookup/create 与 upload-limits 上游。`SidecarProvider` 的 lookup 本轮被线程 probe 的先行采用避开，但显式隔离能保证 provider 生命周期不再隐式依赖真实 API。

真实 `AuthProvider`、`SidecarProvider`、`SidecarPanel` 和实际 `hasPermission` 均保留。原三条 `it` 调用及完整测试体 AST 完全相同：允许删除、未解析权限兼容、同一 provider 原位由允许翻转到拒绝。新增 owner 清理在真实卸载后清空本文件所有 QueryClient，再严格断言 fetch 从未被调用；finally 只负责恢复测试环境，不吞断言或异常。[AST 保留证明](evidence/sidecar-unit-fixture-stage42/original-permission-assertions-preserved.json) 已保存。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 原3条用例加拒绝网络探针，尚未隔离上游 | 3 FAIL / exit1；每条拦截3次，原生网络0 |
| 修复后原3条权限用例 | 3 PASS / exit0 / 0skip / 0unhandled，严格fetch0 |
| 与相邻 sidecar-submit-failure 合跑 | 2 files / 7 PASS / exit0 / 0skip |
| React `tsc --noEmit` | exit0 |
| 该文件 ESLint / Prettier check | exit0 / exit0 |
| 新完整 React check/unit | 根代理接管；本代理未运行完整套件 |

唯一正式文件冻结时间 **2026-10-10 08:13:58 CST**，SHA `c6b20e1b60506a31754f16dfe93e0f3690cdd9d27d19a2be471b2376c271f3ee`。所有原输入、RED/GREEN 日志和直接退出记录见 [source-freeze.json](evidence/sidecar-unit-fixture-stage42/source-freeze.json)。未停止、检查或发信号给端口3000的无关服务。
