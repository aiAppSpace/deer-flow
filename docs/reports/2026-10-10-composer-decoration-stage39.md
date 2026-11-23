# Stage39：主聊天与侧聊输入框的底部装饰容量

记录时间：2026-10-10 05:36 CST。本文只声明本轮源码和定向证据；完整新编译聚合、Linux 和 Docker 仍由后续统一快照验收。

## 实际问题与最小修复

原 Vue 完整 mock 中，选文创建侧聊后两输入框高度相同，但主聊天距窗口底部 17px，侧聊 16px，原严格等式失败。对 React 自己的原生侧聊用例复核，存在相同真实布局缺陷。

原因是宿主 `pb-4` 在默认根字号下预留 16px，绝对定位背景却固定伸出 17px。窄分栏启用现有 main 原生 pan 后，背景将 main 的 `scrollHeight` 从 720 扩大到 721；输入框真实聚焦使 main 滚动 1px，输入框随之上移。这是装饰参与溢出容量的产品问题，不是断言容差问题。

两端均只将背景 `-bottom-[17px]` 改为 `-bottom-4`，与既有宿主预留使用同一 spacing token。保留 `pb-4`、背景高度和遮罩、原生滚动 owner、文本、输入框结构和全部侧聊行为。

- Vue：`frontend-vue/app/components/chat/ChatComposer.vue`，SHA `336464ff2603bc0f5be4a64729c701aa34f01a09942061ce0e89e70cad88f981`。
- React：`frontend/src/components/workspace/input-box.tsx`，SHA `5a9277f1470507230d630eec9b502e3cd7f9c8ac7f75114f6004313a4b08d5fd`。

上述两个文件与诊断使用的旧副本逐字比较，精确差异均仅为这一次 class 替换。现有 Vue DOM 样式契约、历史 a11y 注释和两端架构事实同步；原正式侧聊测试没有修改。

## 真实浏览器因果证据

两端使用已编译历史产物、独立 context。诊断只注入与最终 class 同义的 CSS，不改产物或服务器源码。以下是因果证明，不能冒称修改后的新编译验收。

| 场景 | 原样 | 同 spacing 修复 |
| --- | --- | --- |
| 两端 root16，main clientHeight | 720 | 720 |
| 两端 root16，main scrollHeight / scrollTop | 721 / 1 | 720 / 0 |
| 两端 root16，main / sidecar form bottom | 703 / 704 | 704 / 704 |
| root32，真实长内容 | main 和侧聊 form 矩形、main scrollHeight/scrollTop 保持原值 | 全部逐字不变 |
| root32，底部背景 | 固定 17px，未覆盖宿主 32px 预留 | 覆盖完整 32px 预留，不增加滚动容量 |

Vue 原完整选文创建侧聊用例：原样严格等式 RED，注入后完整用例 PASS。React 原样也在同一严格几何等式 RED；随后使用 **React 自己的原完整侧聊 spec**，保留其所有原 wire 断言，root16/root32 因果矩阵加完整用例 1 PASS，直接退出 0，17.0s。

中间两类诊断错误均保留：抽取 React 临时 runner 时遗漏辅助函数；把 Vue wire 断言临时移植到 React 导致错误期待。两者没有引起产品修改，最终使用 React 原 spec 验证。root32 首次只等待两帧时量在重排过程中的失败日志也保留；最终用既有有限动画和 DOM settle 量具后，根字号矩阵通过。

Vue 原 spec 要求 sidecar `context` 不含 `thread_id`；React 原 spec 要求 `context.thread_id` 为侧聊 UUID，实际不存在名为 `sidecar_thread_id` 的字段。`backend/app/gateway/services.py::build_run_config` 从 URL 的线程 ID 设置 `context.thread_id`。本轮未证明两端有效服务端语义不同，因此不改变任何 wire 行为。

## 定向检查与边界

- Vue composer DOM：1 文件 / 39 PASS，直接 0。
- React InputBox：9 文件 / 122 PASS，0 skip/todo，直接 0。
- Vue 应用及 tests 类型、React 类型、双端 scoped lint、相关六文件格式检查：全部直接 0。
- 两端诊断 preview 已结束；自有 React 3292 正常 SIGINT，监听释放。root 自有 Vue 3291 未由本代理停止。
- 修改后的正式新编译侧聊和完整聚合在本记录时为 **UNRUN**；不能将上述 CSS 因果 PASS 外推为新产物 PASS。

完整冻结清单、检查退出码、原 RED、矩阵和 trace 位于 `docs/reports/evidence/composer-decoration-stage39/source-freeze.json` 及同目录。后续统一验收应使用该两处生产修改以及最新 Dropdown、SettingsDialog、虚拟列表和 IdP fixture 输入。

## 后续真实新编译复验

在父任务 Stage39 的统一新编译 React 3271 上，独立 context 又执行了 React 自己原始选文创建侧聊完整用例：1 PASS / 0 skip / 0 flaky，直接 0，5.3s。没有 CSS 注入，没有改动任何原 helper、步骤、几何或 wire 断言；临时文件仅把两个 import 变为指向同一 Playwright 实例与冻结 mock 的绝对路径，并已逆变换核对原文件逐字相等。InputBox、ChatComposer 和原 React spec 在仓库与实际运行副本逐字零漂移。

该父快照为 5584 inputs，SHA `184f808c5c7412a232b81576dbf7053aa1758e12e99770b6b159d1316ec5e04f`。完整来源、stats、实际 log/JSON 与原断言临时副本在 `react-new-compiled-native-receipt.json` 及同目录。Vue 原完整 mock 512 项也已由 capabilities_acceptance 在最新编译产物上执行全部 PASS，包含未经修改的 strict sidecar bottomGap 用例；其完整 source/aggregate receipt 由该代理负责。以上关闭这处修复的两端新编译局部边界，不代替父任务完整 913 项与真实 session、Linux、Docker 验收。
