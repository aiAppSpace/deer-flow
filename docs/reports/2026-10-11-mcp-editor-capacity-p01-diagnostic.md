# P01 / P02：独立新编译正式回归

记录时间：2026-10-11。第二轮实际 **34 PASS / direct exit 0**：完整
`capability-controls-reflow.spec.ts` 28 项，以及完整
`chat-scroll-owner-reflow.spec.ts` 6 项。两端 MCP 的原失败状态及新增容量、原生编辑、
完整值和桌面恢复断言均通过；原预算、原 survey、ratio 1 和全部原断言未减弱。

这是旧 Stage43 冻结整源加精确 4 个覆盖文件的独立诊断，不是当前 W12 重构后完整整源
的最终 aggregate PASS。当前全源验收由根任务另行执行。生产修复推导及单元 RED/GREEN
见[实施报告](2026-10-11-mcp-editor-capacity-p01.md)；其中未跑真实几何的描述是本诊断之前的检查点。

## 两轮实际结果

| 执行                                                 | capability                          | chat-scroll-owner | 实际整体结果                           |
| ---------------------------------------------------- | ----------------------------------- | ----------------- | -------------------------------------- |
| 第一轮新编译                                         | Vue 14 PASS；React 13 PASS / 1 FAIL | 6 PASS            | 33 PASS / 1 FAIL，direct 1             |
| 修正原生键盘测试后，第二轮全新副本、全新依赖、新编译 | 28 PASS                             | 6 PASS            | 34 PASS，direct 0；Playwright 3.8 分钟 |

第一轮 React MCP 例失败于新增的文本末尾 selection 断言：expected 362，actual 0。
此前原 360×800/root32 全部 survey，以及新增 360×360/root32 的容量、完整 textarea
ratio 1、原生 whole-dialog pan、textarea 内部 wheel 与焦点断言均已通过。
没有据此把第一轮整体记为 PASS，也没有把该测试错误写成产品容量失败。

第一轮完整失败现场保留在：

`docs/reports/evidence/root-stage44-diagnostic-checkpoints/formal-round-1-failure/`

原暂停前的双端正式容量失败也仍保留，未覆盖 trace、PNG、error-context 或 baseline。

## 原生键盘根因与负控

正式共享 factory 在 `tests/support/playwright-factory.ts:203` 使用 installed Playwright
1.59.1 的 `devices["Desktop Chrome"]`。它模拟 Windows UA；原失败 trace 的 context
记录该 Windows UA，而实际执行平台为 `darwin`。

原测试根据页面 `navigator.platform` 选择键盘映射。六组独立无网络原生 textarea
对照确认：模拟 Windows UA 会令页面平台成为 `Win32`，但文本编辑按键仍按 macOS
宿主解释。原判断因此选择 `Control+End`，trusted keydown 到达已聚焦 textarea，
选区仍停在 0。未模拟 UA 的页面为 `MacIntel`，同一 `Control+End` 同样原生不移光标。

| 页面环境                         | 原生按键                     | 起始/结束 selection | 焦点及事件                          |
| -------------------------------- | ---------------------------- | ------------------- | ----------------------------------- |
| MacIntel / Win32，各自新 context | Control+End                  | 0 → 0               | textarea 始终聚焦；事件全部 trusted |
| MacIntel / Win32，各自新 context | Meta+ArrowDown               | 0 → 295             | textarea 始终聚焦；事件全部 trusted |
| MacIntel / Win32，各自新 context | ControlOrMeta+A → ArrowRight | 0 → 295             | textarea 始终聚焦；事件全部 trusted |

上述对照的起始 selection 也由原生 SelectAll → ArrowLeft 建立，没有 evaluate 设置 selection。
Playwright installed `lib/server/input.js:160–161` 的公开 `ControlOrMeta` 按宿主平台选择
Meta 或 Control。正式回归因此改为这一原生 SelectAll → ArrowRight 序列；末尾 selection、
输入空格、Backspace、完整值恢复断言均逐字保留。没有修改产品处理器或全局浏览器模拟配置。

证据工具、实际值、trusted keydown 与直接退出码现场：

`docs/reports/evidence/root-stage44-diagnostic-checkpoints/native-editor-key-platform-probe.{cjs,json,log}`

修复后的正式 spec SHA：

`80016342e74f150df23757faa5ae389471215fe13eef4ee37919b8d2f4d01250`

格式、scoped lint、完整 Vue tests 类型检查及 AST 原断言保留检查均 direct 0。
两端原 MCP 生产文件未因这次测试修复再次变化。

## 第二轮精确输入与执行

父来源：`/private/tmp/deerflow-next-final-stage43-ao4rs6c4`。
新物理副本：`/private/tmp/deerflow-next-final-stage44-diagnostic-round2-v_tzgk8z`。

仅覆盖这 4 个文件：

- Vue `MCPPluginManager.vue`：`607b3f8fa48fdea416ccdab365857faea8503c225693b76343d44dea3c24521e`
- React `mcp-plugin-manager.tsx`：`4a87fdef7a9cd1da558872050e650e37bc58fc251bb9dd77d5e93901be1c0de7`
- 正式 `capability-controls-reflow.spec.ts`：`80016342e74f150df23757faa5ae389471215fe13eef4ee37919b8d2f4d01250`
- P02 `ThreadSidebarShell.vue`：`b8b657b9e45eba74b2217f90625880e9ab8c78a8c1e71c8fc87c7fffe19aebe6`

其余父来源 source rows 原样保留；继承父来源已声明的 Nuxt buildDir 单一变换。
5668 个 source rows，加独立声明的 2 个公开 example 配置 fixture。
派生 copy SHA 为 `126361ef89f4b0bbf8473f06cd2a6c0aa92026640ebf6730df7ffc89ade9b870`。

两前端 node_modules 和 backend venv 全部删除后，按各 workspace 的原 frozen/offline
安装入口重新安装。初次 sandbox React 安装出现 `ERR_PNPM_NO_OFFLINE_TARBALL`，direct 1，
保留为准备环境失败；同命令升级权限后，两前端及 uv 三个命令均 direct 0，未改 lock、
registry，也没有在线静默补包。12 个真实 shim startup/globalPaths、软链、Python imports、
venv entrypoints 与 .pth 归属均通过，未指向原 checkout 或旧副本。

执行保留原 parity 配置、两端 production build、Replay Gateway、failure artifact wrapper，
独占 3390 / 3391 / 8280。原两个完整文件的 34 个 case 均执行，没有筛掉非 MCP 状态。

## 后验闭合与清理

最终 runner 记录时间 2026-10-11 23:21:11 CST，状态 PASS / direct 0：

- 5670 个实际 source + fixture 输入前后相同，新增、删除、修改均为 0；
- 两前端 131012 个实体依赖文件/链接前后相同，新增、删除、修改均为 0；
- backend 实体环境、Python stdlib 及解释器哈希前后相同；
- 6 个宿主入口 executable bytes、实际 Node binary 与三项执行/捕获工具前后相同；不外推未枚举的全局 Corepack/pnpm 实现树；
- 原仓库 `.env`、`config.yaml`、`extensions_config.json` 只 hash 比较，内容未输出；三者及 Git index 均未改；
- 3390 / 3391 / 8280 均实际返回 ECONNREFUSED；未触碰 AiPPT 3000。

最终完整 receipt、原始 stdout、源和依赖 inventory、Python/runtime/tool proof：

`docs/reports/evidence/root-stage44-diagnostic-round-2-checkpoints/final-diagnostic/execution.json`

同目录 `gate.log` 保留完整 34 个 case 与原 production build 输出。
父来源 metadata、4 覆盖 SHA、离线安装两次真实结果及端口收尾分别在该 evidence 目录中单列。
没有将当前工作区其他 agent 的重构 WIP 纳入这份诊断，也没有把该叶组件诊断替代最终全源门禁。
