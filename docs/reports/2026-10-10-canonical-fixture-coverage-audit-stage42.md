# 当前强制入口与新增夹具覆盖复核

本次只读核对 W00–W13 计划、当前 Make / Vitest / Playwright / CI 配置及已经存在的真实收集日志；没有执行全量单测、构建、浏览器宏或服务启停，也没有修改生产源码、正式测试或门禁。

**结论：没有发现新增夹具或正式 spec 脱离入口、被错误项目排除或遗漏收集的情况。**
入口接线完备不代表当前最终验收通过。新源码的完整执行，以及 standalone with-e2e 等尚未执行的强制步骤仍须完成。

当前读取指纹、每个单元文件所属 project、每个正式 spec 所属 config 和完整产品收集文件清单见
[canonical-coverage-readonly.json](evidence/narrow-screen-overflow-stage41/canonical-coverage-readonly.json)。
该 JSON 是本次源码结构检查，不能冒称新的测试执行 receipt。

## Canonical 覆盖边界

`frontend-vue/Makefile` 的 `verify` 实际依赖 lint、format-check、app / tests / core 类型、完整 Vitest、i18n-check、i18n-source-check、API / contract generation、standalone 静态检查和当前源码 build。

三个 Vitest project 按文件后缀互斥：`.nuxt.test.ts` 进入 Nuxt、`.dom.test.ts` 进入 DOM，其余 `.test.ts` 进入 Node；agent-core 的测试也有实际 include。
本次静态枚举得到 283 Node、186 DOM、3 Nuxt 文件，未将此数量当作新的实际执行结果。
新添的 ThreadSidebar owner DOM、viewport dispatcher、延迟 route owner 和 narrow 宏 VM 文件均有唯一所属 project；没有声明缺 React skip，因此 standalone 默认模式也会收集并执行这些 Node / DOM 回归。

`tsconfig.tests.json` 包含 `tests/**/*.ts`、全部 Playwright config 和 app，新增 browser fixture / spec / helper 不在类型检查盲区。
本域已对当前冻结输入实际完成 app / tests 类型、6 files / 21 focused 断言、scoped lint / format 和 standalone 静态检查，均直接退出 0；该定向证据不替代全量 canonical。

下列计划强制步骤有**独立实际入口**，不能声称只跑 `make verify` 已覆盖：

| 职责                                  | 当前实际入口                                                      |
| ------------------------------------- | ----------------------------------------------------------------- |
| 真实核心 OpenAPI                      | `export-openapi-check`                                            |
| extension schema                      | `export-openapi.py --check-extension-fixture`                     |
| 独立打包消费者                        | `consumer-check`                                                  |
| advisory / 影响版本和路径             | `audit`                                                           |
| 当前构建资源预算                      | `asset-budget`                                                    |
| 完整 E2E 收集                         | `e2e-list`                                                        |
| mocked 产品 / auth / proxy / stream   | `e2e-mock`                                                        |
| 八种真实 Gateway 拓扑                 | `e2e-backend`                                                     |
| 受控 WS / OIDC                        | `e2e-external`                                                    |
| product → auth → SQL session 双端对照 | `e2e-cross-app`                                                   |
| Linux 平台视觉                        | `e2e-visual`                                                      |
| 无 React 完整独立运行                 | standalone 默认与 `--with-e2e` 两种模式                           |
| 容器与实际代理链、本地入口            | 计划原有 container / Compose / dev-vue / dev-dual / prod-vue 入口 |

协调者的最终 canonical 组合显式包含 `export-openapi-check verify asset-budget consumer-check audit`；其余属于单独必跑入口。这是职责划分，不是把它们从计划省略。

## 正式浏览器收集

当前 18 份 Playwright config 各有唯一 testDir 和 Make target。静态枚举 152 个正式 spec，逐一匹配 config，没有孤立或重复归属。
`tests/guards/e2e-suite-contract.test.ts` 在默认完整 Vitest 内验证这条结构，并检查 mock / backend / cross-app 聚合覆盖；visual 与 external 则由独立强制入口负责。

现有真实收集 receipt 为 2026-10-10 08:27:22 CST 的 **18 configs / 1571 tests**，其中 product **947 tests / 39 files**。这是 collection PASS，不是 browser PASS。
本域最后 locale 修正与新增 Node VM 不改变 Playwright 用例数；两个 lifecycle 用例和 narrow 校准已经在该收集中。

| 最近正式文件                | 现有实际 product 收集数 | 执行归属                                         |
| --------------------------- | ----------------------: | ------------------------------------------------ |
| composer-keyboard-lifecycle |                       6 | parity product                                   |
| narrow-screen-overflow      |                       5 | parity product；含原四宏与新原生横滚校准         |
| scenario-route-lifecycle    |                       2 | parity product；完整 15 秒真实响应与页面销毁负控 |
| settings-capacity-reflow    |                      16 | parity product                                   |
| settings-project-capacity   |                       6 | parity product                                   |
| artifact-panel-capacity     |                       2 | parity product                                   |
| reasoning-menu-resize       |                       2 | parity product，内部保留两语言路径               |
| command-popup-reflow        |                       4 | parity product                                   |
| overlay-anchor-survey       |                       3 | parity product，结构正负控                       |
| overlay-survives-resize     |                       2 | parity product，原完整双端宏                     |
| keyboard-measurement        |                      12 | parity product，实际原生量具正负控               |

完整文件与用例标题来自已有 `root-stage42-checkpoints/e2e-parity-collection.log`，未靠表中数字推算覆盖。

此前从 auth-disabled 主产品移出的 composer 权限和 settings-sync 仍位于 `tests/e2e-auth`；`playwright.auth.config.ts` 实际 build `authDisabled:false`，由 `e2e-mock` 包含的 e2e-auth 执行。没有通过重新绕开 session gate 来迁就旧夹具。

## CI 与计划对应

`frontend-vue-verify.yml` 默认工作流实际接入 verify、asset、standalone 默认、audit、container smoke、全部 collection、mock；另有 real-backend、external、cross-app-parity 和固定 ARM64 / Playwright image / Node 的 product-visual jobs。
visual-baselines 仅显式 workflow_dispatch 才更新，不能作为默认视觉成功路径。
`frontend-vue-parity.yml` 还有双端依赖安装、icon-parity 与正式 parity / auth job；正式缺 React 由 PARITY_REQUIRE_REACT 拒绝，诊断 PARITY_ONLY 不被计作完整结论。

`consumer-check` 和 standalone `--with-e2e` 当前没有独立 CI step；它们有明确本期本地强制入口与责任人，不能把其他 CI 绿色外推为这两项成功。计划没有要求将所有本地部署 / 环境验收塞入默认 verify，本次不额外发明 CI 范围。
失败归档通过 E2E wrapper 与 verify / real / external / cross-app / visual 的 upload steps 接线；standalone 失败目录也被 verify job 的 hidden-files 上传覆盖。

W00 的六份 contracts 当前均列 CONSUMED，NOT_CONSUMED 为空，生成检查接入 verify。功能、查询、owner 的实质消费者审阅仍由各域源码报告负责，本次不由常量登记表替代行为证明。

## 未闭合结果，保持原状态

没有发现需要新增实现才能让最近夹具进入当前强制门禁的遗漏。当前的阻断来自**最终执行与已观测缺陷尚未收口**：

- 新生产源码尚需统一完整 canonical / mock / backend / external / product / auth / session 及 Linux / standalone / 容器 / 入口执行；旧 checkpoint 保留准确来源。
- 当前 standalone `--with-e2e` 仍不能由默认成功或原目录有 React 的 E2E 代替。
- 最新 backend 第一轮有两个 guidance 失败，纯文档修复后的最终完整四 shard 复验由 cap / root 负责，不能用定向 guidance 成功补成完整成功。
- 当前 channels settings 的 native largest-control ratio=1 仍是实际 FAIL；精确根因另交协调者处理，不能因整个 survey 返回零 lost 而写通过。
- Mermaid fullscreen 的新实际 React 缺陷已由 artifacts 接手，尚未最终冻结；本次只读清单不宣称该新文件已完成收集或当前整树冻结。

外部真实 IdP / IM / 模型质量、DNS / TLS / 切流继续沿原计划环境边界单列，不影响本地受控必做门禁。
