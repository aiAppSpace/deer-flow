# Dialog / Sheet iframe 焦点边界：Stage42 最终源证据

当前生产与测试冻结清单、完整 SHA、退出码和输入边界见 [final-freeze.json](evidence/sheet-frame-owner-stage42/final-freeze.json)。本报告只覆盖这一修复及其实际执行证据，不替代统一新构建和全量门禁。

## 根因与实现

浏览器进入 iframe 时，父文档收不到内部 focusin。离开末尾 iframe 后，document guard 只能让 FocusScope 回到进入 iframe 前的旧按钮，形成短循环；不能保证首尾完整遍历。React 的 ToggleGroup 首端逆 Tab 另有独立缺陷，由对应 owner 修复，最终原生矩阵纳入该当前实现，不把两项因果混为一项。

Vue `focus-boundary.ts` 使用 Reka 公开 content ref 和 open 状态，仅在实际 host 包含 iframe 时维护 host 内首尾两个透明边界。自然 Tab 到达边界时，同步进入本 host 第一或最后一个实际可聚焦控件，并阻止边界本身覆写底座的 last-focused 记录。候选排除边界、禁用和隐藏元素；实际调用方焦点重定向保留，失败的 focus 不被误认为成功，空内容回到实际 host。

MutationObserver 维护动态内容的物理首尾；关闭、iframe 移除和卸载清理本 host 的边界。实际 asChild host 保持原样。模态栈、嵌套暂停、外部交互、Escape 和焦点归还仍属于 Reka/Radix，不新增全局栈或 body guard，也不改变 iframe 的 tabindex。

Vue Sheet 原 `nearest` 显露语义保留，待执行 rAF 现在同时核对物理 host、当前 activeElement、revision、open 和连接状态，失焦、关闭与卸载退休旧帧。React 对应修复由父任务实现，避免 portal 事件冒泡令外层 Sheet 重复滚动内层 Dialog。普通 Dialog 原 pointer/keyboard 与 center/nearest 策略未被本次边界实现替换。

## 实际结果

| 证据范围 | 实际结果 |
| --- | --- |
| 旧 public body-guard mounted fixture（当时 12 项） | 9 FAIL / 3 PASS，直接退出 1 |
| 最终 Vue Sheet 边界与 Dialog 滚动 owner | 2 files / 26 PASS，直接退出 0 |
| 独立恢复旧 Sheet nearest callback 的精确负控 | 1 FAIL / 15 PASS；A→B→A 旧回调滚动 3 次，直接退出 1 |
| 旧实际源码原生矩阵 | 14 PASS / 10 FAIL，直接退出 1 |
| 最终 v4 实际源码原生矩阵 | 24 / 24 PASS，直接退出 0 |
| Vue app / 全 tests types、定向 ESLint、5 文件格式 | 全部直接退出 0 |
| 新正式消费者登记 | 2 app cases / 1 file，`--list` 直接退出 0 |
| 最终正式消费者对照旧编译 3270/3271 | 2 FAIL，直接退出 1；8 contexts 各 40 native keys，0 漏捕 API、0 pageerror |
| 最终正式消费者的新完整编译 | UNRUN，等待父任务统一 Next/Nuxt 构建与正式门禁 |

原生 24 项使用实际 Vue SFC、Reka、React、Radix 与当前 ToggleGroup 源码轻量 bundle，包含 iframe 中间/末尾、内部零按钮/两个按钮、正逆各 40 native keys、真实 roving controls、初始已有焦点，以及 caller-prevented、嵌套 Dialog、菜单共存、关闭和卸载。每个真实控件须反复到达；非交互 iframe 自身也是必需停点。任一步 host 外、透明边界或零矩形均失败。

最终正式 `artifact-frame-keyboard.spec.ts` 复用原 `artifact-preview` 与 `artifact-panel-resize` 终态，在 360×360 / 根字号 32px 下每个方向使用新 context。WeakMap 记录物理节点，不改 DOM；全部实际可见且 tabindex≥0 的按钮和非交互 iframe 每个至少到达两次。每步同时检查真实 IntersectionObserver 交集宽高大于零。所有 40 次键盘动作完成后汇总失败，不因第一个坏停点缩短遍历。

## 来源与边界

最终 [v4-native-inputs.json](evidence/sheet-frame-owner-stage42/v4-native-inputs.json) 包含 47 个实际 bundle 源输入，构建时物理副本在 `v4-source-snapshot/`；执行后逐项验证零漂移。receipt 同时保存两个最终 bundle、执行工具和当前五个生产/测试输入的 SHA。这不是完整 node_modules 库存，也不是完整 Next/Nuxt 产物验证。

旧 RED、v2/v3 checkpoint 与最终 v4 文件分别保存，未覆盖旧证据。正式旧编译的完整 trace、PNG 与每次焦点记录在 `old-compiled-formal-results/` 和 `old-compiled-formal.json`。临时配置最初的 ESM/CJS 装载错误保存为启动失败，未计作产品失败。所有自有原生服务器和 browser 在 finally 中清理；父任务旧预览未被修改或停止。
