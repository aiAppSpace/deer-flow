# P01：双端 MCP JSON 编辑器容量修复

记录时间：2026-10-11；工作区 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`，分支 `main-wc`。本轮只修改获授权的 7 个文件，没有创建分支、提交或推送，没有启动生产构建、浏览器或服务。

## 当前结论与验收边界

双端最小生产修复已冻结：Vue 和 React 各只改 JSON textarea 的一行样式。定向单元测试实际 Vue **17 PASS**、React **20 PASS / 0 skip**，两端 scoped lint / 格式、当时的 Vue app types 与 React tsc 均直接退出 0。正式文件实际收集 **28 cases / 1 file**，净新增 Playwright case 为 0。

**新编译产物上的真实几何、原生滚动及完整正式文件回归仍为 UNRUN。** 根任务将从保全的旧冻结副本叠加 P01/P02 获授权文件独立构建、执行整个正式文件；该诊断也不代替之后统一最终源码的完整门禁。当前 Vue tests 类型检查非零，剩余错误来自并行实施中的 W12 MessageList / useChatConversationActions / useChatPanels 消费测试，未修改或排除它们；根任务统一源稳定后须重验。详细原始日志保留在本报告末尾的证据目录。

## 原正式失败及根因

旧冻结全量跨端运行中，`capability-controls-reflow.spec.ts` 的 `mcp-settings#edit-personal` 两端均真实失败。在 360×800、根字号 32px 时：

- textarea 的 `h-96` 为 24rem，即 768px；
- dialog 的 `max-height: 100dvh - 2rem` 为 736px border-box，实测 `clientHeight` 为 734px；
- textarea 在原生滚动后仍为 `[49, -1, 311, 767]`，高于外层可见容量；dialog 可正常滚动，但没有任何 scrollTop 能让这个完整 textarea 进入外层可见区；
- 旧正式 survey 只在该 textarea 产生 lost control；原 icon 64×64、Choose image 32px、dialog 数量及其他原断言已经通过。没有观测到 API 状态错误或页面异常。

这不是新增放行规则的问题，而是固定 rem 高度在放大字体后超过既有 whole-dialog 原生 scrollport。仅增加 max-height 仍不够：旧 `min-h-24` 在低高度时可以覆盖 max-height。

原失败 archive 为：

`/private/tmp/deerflow-next-final-stage43-ao4rs6c4/frontend-vue/test-results/failures/2026-10-10T03-55-25-561Z/e2e-parity/`

根任务保全该正式 archive；本轮没有覆盖原 trace / PNG / error-context。暂停前 `mcp-editor-capacity-stage43` 中 3 次 A/B 工具错误（模块加载及浏览器 sandbox 启动错误）仍为工具失败，不能算候选样式已通过真实页面验证。

## 最小实现与容量推导

保留 `field-sizing-fixed h-96 resize-none overflow-auto font-mono text-xs`，将 `min-h-24` 改为 `min-h-0`，并追加：

```text
max-h-[calc(100dvh-4rem-2px)]
sm:max-h-[calc(100dvh-5rem-2px)]
```

上限来自同一个 dialog 的现有尺寸，不按截图选经验高度：外边距合计 2rem，`p-4` 上下合计 2rem（`sm:p-6` 合计 3rem），上下 border 合计 2px。textarea 是 border-box，因此上限为 `100dvh - 4rem - 2px`，`sm` 为 `100dvh - 5rem - 2px`。`min-h-0` 保证这一上限在短窗口中有效。标题、图标与 actions 仍在自然流中；整 dialog 的原生 pan 和 textarea 自身的原生文本滚动都保留。

以下只是 CSS 推导，不能冒充浏览器实测：

| viewport / root | 适用上限              | 推导 textarea 高度                               |
| --------------- | --------------------- | ------------------------------------------------ |
| 1280×800 / 16px | 800 − 80 − 2 = 718px  | `min(384, 718)` = 384px                          |
| 360×800 / 32px  | 800 − 128 − 2 = 670px | `min(768, 670)` = 670px                          |
| 360×360 / 32px  | 360 − 128 − 2 = 230px | `min(768, 230)` = 230px                          |
| 1280×240 / 32px | 240 − 160 − 2 = 78px  | `min(768, 78)` = 78px；可抓旧 192px minimum 冲突 |

没有修改 JSON 解析、权限、数据提交、scope、Dialog / Textarea primitive、shared scenario、survey 或任何 baseline。

## RED → GREEN 与保留证明

在生产样式改动前，给两端现有 DOM 测试各新增 1 条实际消费者用例：真实 MCPPluginManager、Dialog 和 Textarea，domain fixture 提供 80 个带 Unicode 的配置字段。它验证原生 textarea 与容量策略、完整预填、编辑和 resize 后同一 DOM / 完整草稿、保存前不 mutation、最终精确一次 Save 和全部字段。

| 命令                                                                                                                                  | 原样式 RED                             | 修复后 GREEN                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| `python3 scripts/pnpm.py --dir frontend-vue exec vitest run tests/unit/mcp/mcp-server-management.dom.test.ts`                         | 16 PASS / 1 assertion FAIL，直接退出 1 | 17 PASS，直接退出 0          |
| `python3 scripts/pnpm.py --dir frontend exec rstest run tests/unit/components/workspace/capabilities/mcp-plugin-manager.dom.test.tsx` | 19 PASS / 1 assertion FAIL，直接退出 1 | 20 PASS / 0 skip，直接退出 0 |

RED 都来自实际 textarea 缺少 `min-h-0` 的新策略断言；已有正式页面的几何 RED 是独立且更强的根因证据。单元测试不建立物理几何 GREEN。

React 第一次 sandbox 执行在测试之前 `listen EPERM ::1:3000`，直接退出 1；保留为工具失败。按原命令升级权限重跑后才获得上述真正断言 RED。没有给无关端口进程发信号。

TypeScript AST canonical matcher 核对：Vue unit 原 24 个、React unit 原 29 个、正式文件原 16 个 matcher 调用全部按原顺序保留；原 APPS / STATES 完整 AST 相同，120000ms / 30000ms / survey 24 未改。该证明结合逐文件 patch，不代替新正式执行。

## 原正式用例的增强

`frontend-vue/tests/e2e-parity/capability-controls-reflow.spec.ts` 保留原 14 状态×2端、原 desktop icon 控件断言、原 360×800/root32 的全部 survey 断言。仅在 MCP 两例原断言之后增加：

1. 初始及恢复正常桌面 textarea 为 384px；
2. 同一打开的 dialog 依次 360×360/root32 → 1280×240/root32 → 1280×800/root16 → 360×800/root32 → 1280×800/root16；
3. 同 DOM identity、完整 value、真实 whole-dialog wheel 和 textarea 内部 wheel；
4. ShiftTab→Tab 原生重入、textarea focus 和严格 `ratio: 1` 视口交集；容量只沿用现有 survey 的 0.5px 几何边界；
5. 用平台原生键盘到文本末尾、输入空格再 Backspace，完整值恢复；
6. 每个尺寸仍执行原 survey，要求 documentOverflowX 0、非合法横向 scroller 空、lostControls 空、unreachableClips 空；原 API 漏捕和 pageerror 断言保留。

没有以新步骤替换旧失败场景，没有新增截图阈值或隐藏/裁切规则。

## 冻结文件与证据

两端生产文件、两份原 DOM 测试、正式回归和两处 MCP 容量文档共 7 个文件；各文件 before / after SHA、时间、大小和命令 direct exit 见：

`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/mcp-editor-capacity-resume-2026-10-11/source-freeze.json`

同目录的 `owned-changes.patch` 是相对于旧冻结副本的精确 7 文件差异，排除 Git HEAD 之前已有的大量 WIP；`assertion-preservation.json` / `.cjs` 保存上述 AST 核对及可重放工具。原 `reflow-survey.ts` SHA 为 `eef66587c0a55815b32e4a3ea2a048d2aaec3c223ec6b880a58615b78263c1ba`，未修改。

原始日志：`vue-red.log`、`react-red.log`、`react-red-unsandboxed.log`、`vue-green.log`、`react-green.log`、两端 lint/format/types 日志、`formal-collection.log`。

`vue-test-types.log` 还保留一次误用 `tsconfig.test.json` 的 TS5058 工具失败；随后按 Makefile 正确 `tsconfig.tests.json` 重跑并保留所有并行 W12 类型错误，不把它们写成 PASS。最终整体类型与生产/正式门禁由根任务在统一新源上执行。
