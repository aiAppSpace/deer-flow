# 工具/token 消费回流验收（2026-10-09）

当前状态：Stage32c 独立双端生产构建上的正式 42 例全部 PASS（0 skipped/flaky/unexpected）。其中 tool 三终态 × 双端共 6 例，保留严格 survey、所有 token 文本的自身列边界、Tool details 全文可达、处理步骤与最终回答唯一归属断言。

实际 RED：360px 宽与 32px 根字号下，两端消息 scroller 的 clientWidth 为 330，scrollWidth 为 361。根因来自 266px 正文里的 token-debug 卡：nowrap/shrink-0 的 “No usage returned” 徽标宽 279.64px，右边到 375.64px，并把左侧标签列挤成 0 宽。Tool details 触发器宽 187.28px，超过 Vue 的 160px / React 的 144px 父列，受旧父级 overflow-hidden 裁切。

四个 consumer 的修复仅允许真实内容回流：token 卡可换行，文本列保留合理 basis，标签完整换行，徽标按容器限制宽度并可断行；Tool details 按内容增长、保留原最小高度及最大宽度。没有改变 scroller、隐藏文字或放宽量具。

旧独立 3304/3305 生产页面上的六个 tool 终态因果实验，严格 survey 全部为零。正常桌面 collapsed 双端及 opened Vue 几何零变化；opened React 的两份视口 y 读数被原生 smooth-scroll 的统一平移影响，未将其称为桌面零差异通过。随后只读等待实际滚动停止的复验遇服务已退出，明确记录为连接拒绝，不充当产品通过证据。

局部单测 Vue 3 文件 17 PASS、React 2 文件 19 PASS；双端 scoped lint、React/Vue app/tests 类型与格式 PASS。正式 chat-content-reflow 保留原全部量具与行为断言，并补充完整 Tool details 触发文字和 token 卡所有文本实际 bounds 检查。Stage32c 新构建的六终态与全文可达性已经全部通过。最后两条焦点前置失败查明为对已聚焦节点再次 focus 不产生事件；正式夹具使用真实 Shift+Tab → Tab 重入，仍要求完整可视比例为 1，没有修改产品焦点处理或放宽断言。

[精确证据](evidence/2026-10-09-tool-token-reflow/summary.json)。另发现的 token step-debug 工具/最终回答归属差异由消息 owner 修复负责，本报告不将其布局修复冒称为归属修复。

最终证据：[42 例日志](evidence/message-scroll-owner-stage31/stage32c-strong42.log)、[JSON](evidence/message-scroll-owner-stage31/stage32c-strong42.json)、[完整生产指纹](evidence/message-scroll-owner-stage31/final-source-fingerprint.json)。该构建 Vue 898 文件 SHA `b6252ec2b328ef15bd3e3d83c1d15a477c65c2dc9c4f10543f33504c9ac77d1d`，React 810 文件 SHA `307599f295f43f9e9116deb948c85aff7942b65a7d4dc517cd735707c7f508f4`。构建源漂移为空；当前工作区仅 Vue AgentChat 三行不可执行注释在构建后变动，已由完整指纹明确记录，后续最终镜像需刷新。该结果不替代本地三个入口的最终源码复验。
