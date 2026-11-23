# Keyboard-order 独立根因复核与最小修复

时间：2026-10-10 07:05 CST。本报告分开记录 Stage39 原冻结产物的真实 RED 与之后新增源码的定向验证；后者没有运行新的完整跨端聚合。

## 原始失败的完整读数

读取 `/private/tmp/deerflow-final-parity-stage38-dhwub23s/frontend-vue/test-results/e2e-parity/keyboard-order-两个应用按-Tab-Shift-Tab-走的是同一条环-chromium/trace.zip` 的 central directory，流式解析 `test.trace` 与 844 个 context trace。未展开资源、运行浏览器、修改正在运行的副本。

每个 context 归属原来的 Vue/React 嵌套 test.step，保留其 60 个实际 `evaluateExpression` after 返回值、callId 和 snapshotName。提取脚本 direct exit 0；844 × 60 项全部存在。

按原测量函数及原 14 个 SINGLE_STOP、原唯一无限列表排除项重算：

| 项目                                     | 实际结果 |
| ---------------------------------------- | -------: |
| context                                  |      844 |
| 终态 × 方向                              |      422 |
| notClosed                                |       47 |
| mismatched（被第一个断言挡住的后续数组） |      229 |
| allBody                                  |        0 |
| unreachable                              |        0 |
| 正向非 body 不同语义落点合计             |     3306 |

这些读数不是新门禁 PASS，也不能把 47 条全部归为分类器错误。

## 分清物理节点、语义标签与真实产品差异

- **scheduled 反向环**：两端原始 60 项逐项相同。其间 51 个连续 `a"Open chat"` 对应实际 DOM 的 51 个不同链接元素，且恰好全部同 href。相邻相同标签压缩、href 去重都不能证明物理环闭合。需要原门禁用物理节点 identity 验证闭合，另用可访问语义描述比较两端；不能提高预算、扩白名单或以重复标签直接接受闭环。
- **report-preview 表格**：实际 React snapshot 每张表都有 Copy table、Download table、View fullscreen 三个按钮，标题通过 `title` 提供；Vue 同时提供 `title` 与 `aria-label`。旧 ACTIVE 忽略 title，六个 React 按钮被压成同一个 `button""`。这不是缺失产品操作。首末 Export 的单边转移还受原 60 步截窗影响，不能直接定性为产品缺失。
- **Trash**：203 条 mismatched 包含明确的 React Trash 转移；其中 176 条的已列差异全部关联 New project/Trash。Vue ProjectsSection 确实漏了 React 已有的入口，是实际功能及键盘差异。统计只是聚类，不等于修复后 176 条已实跑 PASS。
- **Showcase Todos**：八个公开演示的 React 环包含 To-dos 及任务滚动区域，Vue 没有。Vue 公共 fixture owner 只发布 messages/artifacts/title，`authoritativeTodos` 却只消费 workspace stream/thread cache，丢失真实 fixture.values.todos。已向 AgentChat 当前负责代理提交精确接线方案；此报告不代其声称修复完成。
- **skill-usage menu**：React 60 次均停在原 menu 容器；Vue 则离开菜单进入 sidebar/composer。Installed Radix MenuContent 无条件消费菜单内 Tab；Installed Reka MenuContent 只在 modal 模式消费。两端该消费者原本都是 modal=false，根因在底座默认行为差异。
- **其他残余**：toast 的 React 可聚焦 li 与 Vue 缺失、mentions popup 生命周期与 welcome 输入状态、project document 附加状态，已交相应 owner 逐项根因处理。部分 Dialog 反向停在容器的现象仍需与原 FocusScope/起点及物理闭环一起判断。没有把这些真实分叉过滤掉。

## 本代理新增最小源码修复与验证

1. Vue ProjectsSection 增加与 React 相同的 Trash 图标链接、路径、名称、title 和尺寸；使用已有 Button as-child + NuxtLink，避免 button 嵌套链接。flat/grouped 两个真实 mounted DOM 回归验证 A、href、名称和实际 focus；原项目取数闸门保持。
2. Vue Dropdown 主内容与子内容共享 `retainMenuTab`，只在事件属于最近实际 `data-reka-menu-content` owner 时消费 Tab/Shift+Tab，与 React Radix 相同。没有切换 modal、实现第二份 focus trap、拦截非 Tab、改动选中/关闭/focus restoration 或消费者 MessageDetailsMenu。
3. 原 Dropdown 根注释及 ARCHITECTURE 同步真实合同；React 产品未修改。

| 验证                                 | 直接退出结果            |
| ------------------------------------ | ----------------------- |
| 初始 Trash ×2 / 非模态主菜单 Tab RED | exit 1，3 FAIL / 4 PASS |
| 非模态子菜单独立有效 RED             | exit 1，1 FAIL / 3 PASS |
| 最终相关 5 文件 DOM                  | exit 0，25 PASS         |
| Vue app / tests 类型检查             | 两者 exit 0             |
| scoped ESLint / Prettier check       | 两者 exit 0             |

DOM 范围含 modal 两模式、主菜单与子菜单 Tab、原方向键/Escape、非 Tab 不阻止、非模态原生外部 focus 仍关闭、hover 不抢 composer 焦点、选择与 thread 导出。它没有冒充真实浏览器 Tab 遍历；新源码完整跨端和实际原生浏览器复验仍须根代理统一执行。

冻结 receipt：`docs/reports/evidence/keyboard-order-independent-stage40/sidebar-menu-freeze.json`，2026-10-10 07:05:41 CST。正式 Playwright 净新增 0；没有调整原范围、PRESSES、timeout、白名单或阈值。后续旧 Docker/Linux/完整 cross 的历史源码边界必须保留，新生产字节不能沿用旧快照的 PASS。

完整证据：

- `docs/reports/evidence/keyboard-order-independent-stage40/raw-sequences.json`
- `docs/reports/evidence/keyboard-order-independent-stage40/compact.json`
- `docs/reports/evidence/keyboard-order-independent-stage40/snapshot-controls.json`
- 同目录 `extract-trace.py`、`snapshot-controls.py` 与 RED/GREEN/types/lint/format 日志。
