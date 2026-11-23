# Stage42 三轴剩余容量与 paint 资格根因收口

截至 2026-10-10 10:35 CST。当前本域生产与门禁已冻结；本报告不把旧编译页面的候选 CSS/DOM 因果实验当作最新生产构建通过。

## 结论与范围

旧完整三轴两端各 156 个 lost 的同源分类为：聊天列表 102（另一 owner）、models/mentions 11（另一 owner），本域 43。本域 43 分为 MCP/plugin 编辑器 22、closed details 未绘制子控件 13、侧栏 5、项目 instructions 2、workspace changes 1。

实际修复 10 个生产文件及 3 个量具/正式回归文件。完整逐文件 SHA、日志 SHA、主命令直接退出码见 [production-gate-freeze.json](evidence/triple-capacity-repair-stage42/production-gate-freeze.json)。本域 aggregate SHA 为 `4e42ca06042cd6bcd5d6642a2edf0f3cfe72d532b29627781439304888184c33`。不包含父代理维护的文档或其他代理文件。

## 最小生产修复

| 消费者 | 原因 | 修复与保留的合同 |
| --- | --- | --- |
| 两端 MCP/plugin 编辑器 | 固定首尾压缩内层 body 到 16px，普通按钮与 JSON 编辑框无法通过同一有效 clip 交集 | 既有 Dialog 改原生 outer pan；body 自然流 `flex-none/overflow-visible`，保留原表单、文案与按钮，无新滚动组件 |
| 两端 Sidebar | header/footer 将导航区压到小于现有 h-8 行 | 原物理外壳原生 overflow；导航区最低一个既有行高，不新增焦点栈或导航停点 |
| 两端 Changes | 固定 sheet 首尾把内层实际容量压到小于完整文件动作 | 原 sheet 外层原生 pan；命名 size container 只在低实际容量时让 body 自然流，正常桌面全部节点几何不变 |
| 两端 Project instructions | 原 10rem 最小高度超过真实可用滚动容量；初版恰等于 port 的 textarea 又与分数 label offset/整数 scrollTop 冲突 | label+textarea 使用原容量内的自然两行组：正常 `contents`，低高度 `auto/minmax(0,1fr)`；label 自动高度、textarea 分剩余空间，footer/alert 仍普通流；保留原 Panel owner、原文本、原字号、编辑框内部原生滚动 |

根因与开发合同由父代理同步至 `frontend/docs/responsive-capacity-contracts.md` 与 Vue `ARCHITECTURE.md`，本代理不并写这些文档。

## 量具资格修复

Chromium 关闭原来已展开的 details 后，子 checkbox 仍可返回非零缓存 layout rect，但没有 paint，也不参与原生 Tab。本量具现使用默认 `checkVisibility()` 判定真实 paint 资格，不开启 opacity 或 viewport 裁切排除选项；已有 viewport/全部 overflow 祖先交集与可达性算法不变。

新正式校准保留同一个 details/checkbox：展开且 120px 控件处于 100px port 必须 lost；关闭后 Tab 确实 Before→Summary→After、同 checkbox 不应被收集；重开同节点再次 lost；增大真实 port 后恢复。旧 helper 实际 RED，新 helper 实际 GREEN。原 .5px、clip24、window oversized、普通控件完整同时可见及其他负控不变。

## 最终实际验证

| 门禁/实测 | 直接结果 | 边界 |
| --- | --- | --- |
| Vue 相关 DOM 单测 | 5 files / 25 PASS，exit0 | 最终生产源码 |
| React 相关 DOM 单测 | 原 4 files / 35 PASS；最终 Project 1 file / 11 PASS，exit0 | 最终新增两行组由后者复验；默认 sandbox listen EPERM 的失败原样保留，原命令 escalated 后通过 |
| Vue app/tests 与 React types | 全部 exit0 | tests 先前外域 generic SFC 测试类型错已由其 owner 修复，最终完整 tests types0 |
| 本域 scoped ESLint/Prettier | exit0 | 既有 generated Sidebar ignore warning 没有改成新的豁免 |
| 共享重流原生正负校准 | 7/7 PASS，exit0 | 包括闭合 details、普通 120>100、嵌套 clip、真实缩放、分数布局、原生恢复等既有完整控制 |
| 原编译页面执行新增正式 8 项 | 8/8 RED，exit1 | 真正旧产品负控，未修改旧产物或 Gateway |
| 安装版 Tailwind 精确新 classes + 仅候选 DOM 结构，原正式 8 项 | 8/8 PASS，exit0 | **辅助因果**；不是 fresh Nuxt/Next 生产编译 PASS |
| 正常 desktop Sidebar | 双端 2/2 PASS，exit0 | 所有原节点 rect 逐字零差；前后 12 次原生 Tab 序列相同、无新增 wrapper 停点；Rail 原生命中 trial PASS |
| 正常 desktop 项目 | 双端 2 tests / 4 states PASS，exit0 | 每个原既有节点 rect 零差；低容量原生 Tab/wheel/编辑/内部 scroll 仍完整通过 |
| 最终回归动作再次跑旧项目 | 双端 2/2 RED，exit1 | 加原生 wheel 没有让原本过大的 field 被放行 |

`formal-auxiliary-body-proof.json` 用安装版 TypeScript 的完整 callback AST（含字面量、标识符与全部节点种类）验证四个参数化 test callback 一致；辅助副本只在 reach helper 注入候选 CSS/自然布局，原 matcher、ratio1、文本、状态循环和动作不减。

新增正式 Playwright 数为 8 个产品 case + 1 个量具校准；父代理以真实 collector 更新当前总数，不从本报告手算。

## 保留的真实失败与诊断纠正

1. 初版新增测试错误要求 textarea focus 自动完整显示其 border box。实际浏览器只保证 caret 可见；经合同审核改为真正原生 panel wheel 后再保留 ratio1，Tab/focus/caret/编辑断言全部保留。第一次 6PASS/2FAIL 的日志保留。
2. 随后 Vue 仍 0.9999182224：label+gap 为 47.984375px，textarea/port 同为 191px，native scrollTop=48，field 比当前 port 高出 1/64px。标准 native start/end/center 都得到同结果；原量具 .5px 下 lost0。`project-fractional-native.json` 保存完整每级 DOMRect/client/offset/scrollTop。最终从 label+field 的实际容量分配修复，未加任意 px、round、字体或焦点补偿。
3. 第一版辅助样式 restore 把 null 原值误复写，第一次数据无效，已迁至 `candidate-first-invalid-restore/`；修正后完整 22 状态 old→candidate→撤销均保存，不能引用旧无效 before0 作为产品负控。
4. 一次项目辅助探针误取隐藏的第一个 TabPanel，导致 saved 残余假象；改为 active 物理 owner 后四态原生因果均 1→0→1。原错误日志保留。
5. 一次 React 包裹脚本误匹配前一个 label，Prettier 真实捕获未闭合 JSX；仅逆转该次包裹并准确锁定 instructions label 后，最终源码 format/types/原项目 DOM 全部通过。辅助 GREEN 没有替代生产语法校验。
6. 最初校准 grep 使用文件名前锚点未正确排除宏，0 collected 状态的两宏尝试失败后停止并保留 `all-controls-first-invalid-grep.log`；正确非宏选择下正式 7 项完整 PASS。没有修改宏场景或预算。

## 尚待统一最新构建

最新源 fresh compiled 产品 8 项、两端完整 211 三轴终态/751登记样本及完整聚合、Linux 8 visual/12 payload/asset/9PNG、当前 Docker 与 standalone 均不能由本域辅助结果外推。最终统一源构建与完整门禁由父代理按窗口推进。本代理所有 native contexts 均经共享 mock 路由，不向 Gateway8160/SQL 发 mutation，不改 active immutable crosscopy。
