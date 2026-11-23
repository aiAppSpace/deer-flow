# W13 门禁接线复核

复核时间：2026-10-10。依据当前源码、Makefile、CI 与本期计划；这是接线审查，不代表尚在运行的最终门禁已通过。

## 结论和待收口入口

| 项目               | 当前事实                                                                                                                                                                                                         | W13 收口要求                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Showcase 全案例    | `shared/showcase.ts` 当前登记 13 个；`tests/e2e/showcase.spec.ts` 逐例验证 200、原资源 SHA、只读及无写请求，另验无效案例/资源 404；`tests/unit/vue/showcase.test.ts` 与当前 React 登记表、所有原始文件逐字节比较 | 最终 `make e2e-mock` 与完整 `make e2e-cross-app` 必须执行；独立副本缺 React 时的显式 UNRUN 不能证明双端一致                                         |
| Showcase UI 矩阵   | `tests/e2e-parity/support/scenarios.ts`：6 个代表案例各有 en/zh × light/dark × desktop/mobile 的 8 个组合，其余 7 个案例各有 en/zh 桌面 light；报告另有 8 维 #report-preview，共 70 个公开案例样本                                              | W11 已新增报告预览终态和 16 例共享真实交互回归；最终双端生产全量待执行。不能表述成 13 个案例全部完成 8 维组合，或由登记数量推断 W11 全部完成                            |
| 当前双端总入口     | `Makefile` 的 `e2e-cross-app` 串行执行 `e2e-parity`、`e2e-parity-auth`、`e2e-parity-session`；正式入口要求 React 在场；verify workflow 的 cross-app job 已执行该聚合                                             | 完整执行，不能用 PARITY_ONLY、React 缺席跳过或单个诊断文件替代                                                                                      |
| 独立安装/构建/单测 | `make standalone-sim` 创建无 React 的独立源码副本，冻结依赖安装、独立构建、完整单测                                                                                                                              | 当前 CI 接线覆盖此层                                                                                                                                |
| 独立 E2E           | `scripts/standalone-sim.mjs` 仅在 `--with-e2e` 时执行副本内 `e2e-mock` 和 `e2e-backend`；默认 `make standalone-sim` 不执行这两套                                                                                 | 最终验收必须另执行 `node scripts/standalone-sim.mjs --with-e2e`（工作目录 frontend-vue）。root 已将它列入最终全量清单，不能由默认 CI 步骤推断已通过 |
| 独立副本失败归档   | 脚本把失败命令日志、Vitest JSON、嵌套浏览器现场保存为 `frontend-vue/.cache/standalone-failures/run-*`，但审查时 verify job 上传仅覆盖普通 test-results/playwright-report                                         | 明确 W12 缺口；已授权修复既有上传步骤，并增加 Vue CI 契约负向回归。修复和实际结果见下方                                                             |
| 产品视觉           | Linux 原生 ARM64/pinned Playwright 的 product-visual job 执行 `make e2e-visual`；平台基线契约已接 verify                                                                                                         | Vue 平台快照不能替代双端证据。完整 parity 每样本另保存 React/Vue PNG，并比较语义、样式、几何等观察项；它不执行跨框架逐像素 PNG 相等断言             |
| 套件遗漏保护       | `tests/guards/e2e-suite-contract.test.ts` 守住每个 spec、config、Make 入口及聚合归属；external/visual 是独立强制 job                                                                                             | 新增正式 spec 必须仍被对应 config/聚合收集，不能只单跑                                                                                              |
| 失败现场           | 普通 E2E 经 `keep-e2e-failure-artifacts.mjs` 归档到 test-results/failures；各 CI job 失败时上传 test-results/playwright-report                                                                                   | 普通路径已有接线；独立副本隐藏目录是本次定位的遗漏                                                                                                  |
| 本地与容器         | dev-vue、dev-dual、prod-vue、容器 smoke 和真实 Compose Host/API/SSE/WS 为不同边界                                                                                                                                | 必须保留独立入口和最终源码指纹。新的 token/processing 布局与公开导出 owner 修复后需重跑本地三个实际入口，不能外推 Stage31 的历史 PASS                                |

## CI 归档修复依据

`actions/upload-artifact@v4` 默认排除隐藏文件和隐藏目录中的文件；仅增加 `.cache/...` 路径仍不能保证上传。修复需要同时满足：

- 既有 verify failure 上传步骤保留 `if: failure()`；
- 额外精确匹配 `frontend-vue/.cache/standalone-failures/run-*/**`，保留逐次运行层级；
- 为该上传步骤设置 `include-hidden-files: true`；
- 保留原 test-results/playwright-report 路径，不扩大到源码、运行配置或整个 `.cache`。

行为依据：[actions/upload-artifact v4 官方说明](https://github.com/actions/upload-artifact/tree/v4#uploading-hidden-files)。

回归守住真实 job 非空、实际上传接线，并拒绝缺独立路径、仅总缓存目录、未开启隐藏文件三类变异。

## W11 审查缺口与当前补齐

初始审查的 56 个样本仅在 12 个生成场景等待消息列表，首例操作推理展开/收起。资源 GET/SHA 检查不能证明公开案例预览、复制、导出、下载和刷新交互；唯一含 Mermaid/Markdown table 的研究报告 `fe3f7974-1bcb-4a01-a950-79673baafefd` 当时也只有两维、没有打开报告。

该缺口已按原 W11 范围补齐：报告默认 2→8 维，并新增 8 维 `#report-preview`，原默认键不退休；全登记 737→751，仅新增 14 个全 12 档空差异目标。新增 `showcase-interactions.spec.ts` 16 例共享 UI 回归覆盖真实报告表格/Mermaid、复制、原始下载、会话 MD/JSON 导出、刷新与只读限制，并打开 7 类现有可达产物。不是 13×8 的机械扩容。

实际探路发现并根因修复 Vue 公开报告导出 title 丢失、临时对象伪造 created_at 和仅首次 mounted 加载导致案例切换旧值残留。最终源码 Vue 开发入口的 8 例已实际全部 PASS；最终双端生产与 751 样本完整对照仍由 root 全量门禁验收，不能外推旧副本通过。精确源码冻结、RED/GREEN、资源类型和当前证据见 [W11 交互验收](2026-10-10-showcase-interaction-acceptance.md)。

## 文档边界

计划中的门禁表仍只显式列出 parity/parity-auth，正文已要求真实 session；当前 Makefile、CI 和双语 Vue README 已增加 `e2e-parity-session`/`e2e-cross-app`。这是计划命令表需要最终同步的历史描述，不是代码中遗漏 session 门禁。

远程分支保护是否将各 job 设为 required 未查询；这里的“强制”仅指签入 workflow 中正常执行、没有可选 dispatch 条件的 job，不声称远程仓库设置已验证。

## 实际验证记录

CI 归档修复：旧配置真实 RED（tooling-contracts 1 FAIL / 25 PASS）；补接线后 tooling-contracts、e2e-suite-contract、visual-baseline-platforms 共 3 文件 36 PASS，相关 ESLint PASS。日志保存在 `docs/reports/evidence/2026-10-10-w13-gate-review/`。GitHub hosted 上传执行本身 UNRUN；本地验证的是签入配置与负向契约，未伪造远程上传成功。

最终独立全 E2E、双端完整对照、产品视觉及本地入口由各负责者在最新冻结源码上分别记录；本审查不提前给出整体 PASS。

## Stage34 最终收集检查点

当前真实 `make e2e-list`：18 套配置共 1510 例，全部收集 direct exit 0；主 parity 886 例 / 29 文件。CURRENT 的 751 目标键及 536/28/187 维度分布未变化，non-desktop family 为 71。doc-facts 1 文件 19 PASS，collector 工具回归 1 文件 4 PASS。新增的代码 owner 校准 1 例与 scheduled-card 回流 8 例均已纳入正式主入口；不是仅单跑新 spec。完整结果见 [Stage34 收集证据](evidence/collection-stage34/collection-summary.json)。此记录只证明收集和文档一致性，`browserExecuted=false`，不提前宣称完整产品执行通过。

## Stage35 本地入口执行

三个实际本地入口最新均 PASS：dev-vue 1 次、dev-dual 两端各 1 次、完整构建的 prod-vue 1 次真实 Replay，共 4 次；源码选源8933… 的原2842项无漂移。同期唯一新增文件是仅供tests消费的Git inventory工具，广义当前指纹9e65…因此与已测清单不同，应用入口源码一致。精确运行/退出/端口和指纹边界见 [本地入口验收](2026-10-09-local-entry-acceptance.md)。后续生产变更仍需单独最终收口，不把本次PASS外推。
