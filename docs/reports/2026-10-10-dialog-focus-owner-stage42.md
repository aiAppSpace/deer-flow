# Dialog 焦点 owner：Stage42 证据边界

普通键盘焦点在真正纵向溢出的 Dialog 中使用原生 `scrollIntoView({block: "center"})`，没有溢出时保留 `nearest`。每个宿主独占 pointer/keyboard modality 和可取消 rAF；仅当前物理宿主、所属文档的当前 activeElement 可以发布滚动。焦点迁移、pointerdown、关闭与卸载退休旧任务；嵌套 portal 不借用外层 owner。React 原 `enterDialogContent` 算法保留，按父任务授权新增具名导出供 Mermaid renderer 复用。

Vue 原通用 Dialog 实现的真实 mounted 旧源为 8 FAIL/1 PASS，React 为 9 FAIL；另有 caller 将 A 焦点同步重定向到 B 的两端 RED，修复后两端各 10 PASS。最后 test-only 格式清理复验两端各 10 PASS，完整 Vue tests types 与两域定向 lint/format 均直接退出 0。详细输入和退出见 [final-test-checks.json](evidence/dialog-focus-owner-stage42/final-test-checks.json)。

轻量 actual-source 原生 Chromium harness 使用真实 Vue/Reka、React/Radix 源码编译，包含严格 ratio=1、pointerdown 持续期间按钮位置不变且 click 成功、输入 caret 不变、Tab/ShiftTab、嵌套 owner、Escape 恢复和卸载退休：修复源 14 PASS，旧源 10 FAIL/4 PASS。它不是完整 Nuxt/Next 页面构建证据。

原编译页面的 Channels 容量因果探针保持原 wheel/poll/ShiftTab/Tab 顺序和 ratio=1：Vue 两状态旧值 `0.999433696269989`，使用新 owner 等价注入后为 1；React 两状态原为 1，保留为 1。4 项直接退出 0，API catchall 和 pageerror 均为 0。这是因果注入证据，完整新编译页面仍由父任务统一执行。

生产冻结 [source-freeze.json](evidence/dialog-focus-owner-stage42/source-freeze.json) 记录 09:11 的精确源码。随后父任务接管 Vue DialogContent/SheetContent 和 focus-boundary，因此该冻结为历史 checkpoint，不向后修改原 SHA，也不据此宣称新 Sheet/iframe 遍历已经通过。React Dialog 最终 SHA 保留在 test-only receipt；新的 iframe/ToggleGroup 独立原生证据在 `evidence/sheet-frame-owner-stage42/independent-native-*`，与原 Dialog 14 项分开。
