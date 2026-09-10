# Vue 产品文案清单与门禁

盘点范围由 `scripts/i18n-source-guard.mjs --inventory` 实时生成，
不是手工维护的组件 allowlist。当前 checkout 共有 258 个 Vue SFC：

- `app/app.vue`、`app/components/**/*.vue`、`app/layouts/**/*.vue`、
  `app/pages/**/*.vue` 中 256 个产品 SFC 全部进入 AST source guard；
- 仅精确排除 `app/pages/__m0/splitpanes.vue` 与
  `app/pages/__m0/visual.vue` 两个 M0 浏览器测试 fixture；
- `node scripts/i18n-source-guard.mjs --inventory` 输出逐文件清单（文件总数由
  `tests/unit/i18n/source-guard.test.ts` 精确钉住，改一个 SFC 就要同步），
  `make i18n-source-check` 执行阻断检查。

## 分类结果

| 类别               | 处理规则                                                                                                       | 当前结果                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 用户可见产品文案   | 模板文本与 UI 脚本值必须来自唯一 `$i18n` owner                                                                 | 256 个产品 SFC 无核心英文硬编码          |
| 可访问性与状态文案 | `aria-label`、`aria-description`、`alt`、`title`、`placeholder`、empty/loading/error/toast/dialog 一并检查     | 已迁入 typed dictionaries                |
| 参数化文案         | 完整句子由 typed formatter 持有，参数保持 opaque                                                               | 文件名、URL、Gateway detail 等参数不翻译 |
| 动态内容           | backend 响应、用户内容、代码、文件名和 URL 继续直接渲染                                                        | 不进入英文 literal 告警                  |
| 品牌与技术术语     | 产品需要显示的值仍通过词典管理；source guard 只精确词法豁免品牌、单键快捷键及 `API`/`HTML`/`OIDC` 等纯技术缩写 | 无按组件或目录放行                       |
| 协议与内部标识     | HTTP method、MIME、事件名、路由、test id 等不进入 UI sink                                                      | 不翻译、不误报                           |
| 测试专用页面       | 只允许上面两个精确 `__m0` fixture                                                                              | 2 个排除项可由 inventory 审计            |
| Primitive 可访问名 | `primitives.*` 若干条在两份 locale 里**同为英文**，因为 React 的 vendored primitive 就没把它们接进词典         | 见下方说明，不是漏翻                     |

`primitives.toggleSidebar` / `submit` / `stop` / `skillSuggestions` / `notifications` /
`loadingPanel` / `breadcrumb` / `channel` 是「中文词典里写英文」的一组 key。它们对应
React 侧写死在 primitive 或组件里的可访问名——shadcn sidebar 的 `Toggle Sidebar`、
ai-elements prompt-input 的 `Submit`/`Stop`/`Skill suggestions`（后者是
`input-box.tsx` 斜杠命令下拉列表的 `aria-label`）、sonner 的 `Notifications alt+T`、
shadcn breadcrumb 的 `aria-label="breadcrumb"`、以及 thread-channel-source 里拼出来的
`${label} channel`；实测中文界面下 React 读屏器念的也是这几串英文。
对照门禁的判据是「两个应用听到同一句」，各自翻译反而会让同一个控件在两边有两个名字。
放进词典而不是写死在 SFC 里，是为了让这条决定留在一个能被 review、也能在上游接入
i18n 之后一次性翻掉的位置。

## Key 与 unused baseline

`en-US` 和 `zh-CN` 当前各有 1066 个完全一致的 leaf key。
`baseline/i18n-keys.json` 同时固定精确 key 集合和 16 个已审阅 unused key；
新增、删除、新增 unused 或旧 key 意外恢复使用都会使
`i18n-check`、`i18n-diff` 或 `i18n-unused` 失败。只有审阅精确 diff 与真实消费者后，
才允许运行 `make i18n-refresh`。

unused 的判据是**叶子名**在 `app`/`tests`/`packages` 里以属性访问出现过（脚本文件头
解释了为什么不做全路径匹配）。代价是同名叶子会互相遮蔽：`app/core/code-editor/editor.ts`
写 `EditorState.readOnly.of(...)` 之后，词典里真正没人用的 `humanInput.readOnly`
就被算成「已引用」而退出 unused 集。这类漂移必须在 diff 里逐条看懂再 refresh，
不能因为「反正只是 unused 集」就放过——它同时也是「key 是否还有消费者」的唯一记录。

叶子名之外还认**带形状的变量下标**：`.authDomains[domain].label` 记成
`(authDomains, label)`，`.descriptions[provider]` 记成 `(descriptions, *)`。
没有这一条时，凡是用变量下标渲染的整组文案都会被报成 unused——Lark 的 22 个
授权域和 channels 的 provider 描述都在里面，而后者的 e2e 明明断言
"Buzz channels and direct messages" 可见。形状是必须的：早先那版只记容器名、
放行整棵子树，被 `app/core/settings/store.ts` 里一处与词典无关的 `.settings[key]`
一次吞掉 18 条真实未渲染的 Lark 文案。

source guard 使用 Vue compiler AST 与 TypeScript AST，覆盖模板文本、可访问性属性、
绑定属性中的字面量、插值字面量，以及 error/toast/label/placeholder 等 UI script sink。
它不靠全局英文正则扫描动态表达式，也不维护现有英文大 allowlist。
