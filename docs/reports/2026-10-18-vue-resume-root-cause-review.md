# 2026-10-18 恢复后的 F01/F02 根因与验证

范围：整个计划继续执行，本文件只记录两组阻断问题；局部验证不关闭 R04–R12。Stage54 的失败和中断记录保持原样。

## F01：React 草稿保存期限被无关渲染推迟

`InputBox.scheduleDraftSave` 依赖每次渲染新建的 conversation capability 对象。保存 effect 的清理取消计时器，下一次 effect 又从头开始 300 ms，即使有效文本、引用和 owner 全未改变。实际输入事件本身也会安排保存，不能只把某一个 effect 的依赖改为稳定对象：能力请求真实完成而内容不变时，同样不能后移期限。

新增真实挂载回归保留 InputBox、PromptInputProvider、QueryClient、实际 features hook 和 sessionStorage，仅控制网络返回与时钟。旧实现：

- 同一 owner 在第 100、200 ms 的无关父级重渲染：第 300 ms 尚未写入，FAIL。
- 第 150 ms 实际 capability query 完成而普通文本不变：第 300 ms 尚未写入，FAIL。
- 实际编辑、切线程、pagehide/unmount、能力撤销后的有效引用变化四项 PASS。

修复：以 owner 和待持久化内容（text、skillName、引用的 threadId/title/agentName 及顺序）识别同一快照。相同内容保留原期限；真实变化重置期限。计时器由 composer 生命周期管理，effect 负责发布有效快照；切 owner/unmount/pagehide 保持原 flush，已接受发送保持原失效和退休逻辑。

证据均在 [resume-2026-10-18](evidence/resume-2026-10-18/)：

| 实际运行 | 结果 | 边界 |
| --- | --- | --- |
| `f01-original-file` | exit 2，零测试 | 旧临时目录缺少脚本；不可用环境，不计产品失败 |
| `f01-original-file-restored` | 原整文件 11 PASS | 不靠重跑绿关闭历史失败 |
| `f01-deadline-red` | 3 FAIL / 3 PASS | 其中一项新增引用夹具 token 写错，不是产品问题 |
| `f01-deadline-red-corrected-fixture` | 2 FAIL / 4 PASS | 修正夹具后，未改产品实现的有效红灯基线 |
| `f01-deadline-green` | 4 文件 65 PASS | 新期限回归及原附件、引用、存储测试；不是 React 全量 |

历史 Stage54 单次失败没有足够计时遥测，不能断言它一定由某个具体请求触发；现在已确定并修复可产生同一“保存前仍为空”症状的真实机制。最终原全量门禁仍须执行。

## F02：搜索输入事件与初始括号匹配依赖版本

### 六项搜索失败

Stage54 的 Python/JavaScript/Markdown × 明暗主题六项都停在 React，尚未走到 Vue。原生 CodeMirror search panel 在 `keyup`/`change` 提交查询；测试的 Playwright `fill("parity")` 只有 input，不会触发该提交。trace 中输入框已有 parity，而文档没有搜索标记，与已安装库源码一致。

测试改为原生 `Mod+A` 和 `pressSequentially("parity")`，保留原搜索结果、Escape、焦点、文档不变、编辑/保存/冲突断言及全部预算。未修改搜索库或产品输入事件，未放宽断言。

### 两项 JSON 初始标记差异

trace 显示 Vue 初始有两个 `.cm-matchingBracket`，React 没有。实际安装源码确认：

- React `@codemirror/language@6.12.1` 的 StateField 初始返回 `Decoration.none`，仅 doc/selection 事务后计算。
- Vue `@codemirror/language@6.12.4` 的 ViewPlugin 在创建时计算匹配。随包 CHANGELOG 明确 6.12.2 修复初始括号匹配及组合输入，6.12.3 修复组合输入时崩溃，6.12.4 修复大量折叠范围的复杂度。
- 因而不能把该差异归因为 Vue 异步加载或调色板，也不能从 UI 比较里删去括号标记。

React 使用正常 `package.json -> pnpm.overrides` 固定 language 6.12.4、Lezer common 1.5.3、highlight 1.2.5，再由 pnpm 生成锁文件；没有手工修改 node_modules。保留 Vue 已有的上游修复，React 补齐相同修复。两次实际锁差异分别在 `f02-language-dependency-package-override/lockfile.diff` 和 `f02-language-graph-update/lockfile.diff`。

第一次在 pnpm-workspace.yaml 添加覆盖后安装 exit 0，但 package.json 的现有 overrides 优先，实际依赖未变；该尝试明确不算修复证据，随后把配置放到有效层。已撤回该无效 YAML 增量，并修正开发说明中的实际配置层。

真实 React CodeEditor 新增初始只读 JSON 回归：旧依赖 1 FAIL / 9 PASS，更新后连同原 extensions 与 focus 两文件 16 PASS。双端原生 spec 同时增加 JSON 初始括号存在断言，继续完整比较 source/edit 呈现。

### 首轮完整原生测试暴露的后续问题

`f02-native-editor-complete` 实际跑完 14 项，4 PASS / 10 FAIL / 0 SKIP，并保留原 trace、截图、JSON。不能将 16 项单测通过当成完整修复：

- 单独更新 language 的正常依赖解析保留了并存的 Lezer common/highlight 版本。CSS/JS/Markdown 丢失语法高亮；HTML 嵌套语法在不同 Tree 身份之间崩溃。`lezer-identity-probe.cjs` 从真实消费者路径加载解析器和高亮器，同一 CSS 语法树由 language 的 highlight 处理是 0 个 token，由语法包自身的 highlight 处理是 12 个；keyword tag 身份确实不同。
- 按共享身份统一 common/highlight 后，探针的模块和 keyword tag 身份相同，两条路径均为 12 个 token。新增真实 CSS 着色回归在旧混合图 1 FAIL / 10 PASS，统一后相关两文件 17 PASS；保留 `f02-grammar-identity-red/green`。
- Python 两项已通过实际搜索，继续到 redo 才失败。trace 的真实键是 `Control+Shift+z`；CodeMirror 默认 redo 为 Mod-Y，仅 macOS 改成 Mod-Shift-Z，Linux 额外支持 Ctrl-Shift-Z。当前 Desktop Chrome 上下文使用 Windows platform，原测试选错快捷键。修正为 macOS Meta-Shift-Z、其余 Control-Y，保持原 undo/redo 文本断言，不添加产品键盘补丁。

### Vue 桌面面板的多余 Escape 监听

`f02-native-editor-coherent-graph` 完整 8 PASS / 6 FAIL。六项均已走过 React 的搜索、redo 和保存链路，在 Vue 搜索 Escape 后失去编辑器焦点，随后整个侧栏关闭。

源码比对：React `chat-box.tsx` 桌面 aside 没有通用 Escape 关闭；Vue `WorkspacePanels.vue` 的 `@keydown.esc="emit('collapse')"` 不分事件是否已由子组件消费，给整栏增加了 React 没有的行为。移除此监听，让 CodeMirror 搜索/补全、消息详情和窄屏 Sheet 各归自己的键盘 owner；没有用 CodeMirror 选择器或临时布尔锁拦截。

真实 WorkspacePanels + CodeEditor 组合回归覆盖已消费 Escape 和普通 Escape。第一版单测在 Happy DOM 搜索初始焦点断言提前失败，另一项已证明多余关闭；随后显式聚焦真实搜索 input，隔离待验证的 Escape 冒泡，未修复代码下两项都在 open 状态断言 FAIL。修复后六文件 38 PASS，包含消息详情独立关闭和焦点归还、侧栏生命周期及编辑器原有行为。原生测试继续负责搜索的自动焦点和像素/键盘行为。

## 尚待完成

面板所有权修复后的完整 14 项代码编辑器原生 spec 已实际 **14 PASS / 0 FAIL / 0 SKIP**，退出 0，使用原 parity production server config 正常构建 React/Vue/回放 Gateway，保留全 trace。对应目录 `f02-native-editor-panel-ownership`，2026-10-18 17:47:49 +08:00 结束，已声明诊断输入前后相同。

上述局部结果之后必须重新冻结最终源和正常安装依赖，再运行原完整 React/Vue/backend 门禁与 R05–R12。全部范围、751/1502、Linux、standalone 两模式、Docker 六 phase、本地三入口、最终 WIP/marker 审查仍保留，不因定位两组问题而宣称完成。
