# 能力域回流根因与验证（2026-10-09）

当前结论：对应 React/Vue 组件已修复，Stage31 独立 canonical Next/Nuxt 生产构建下，正式 capability-controls-reflow 28/28 PASS，包含两端各十四个终态。全部保留真实登记状态与严格零横滚、零不可达、零裁切检查。下文保留初轮及 Stage30 旧构建因果实验的精确输入和范围；正式新构建结果见末段，不能把代表状态通过泛化为全产品已经验收。

| 共同根因 | 同源修复位置 |
| --- | --- |
| breadcrumb 单行 flex 的最小内容宽度超过可用宽度，React 页面横滚、Vue 外层内部横滚 | CapabilityCenter / PluginPage：允许行换行并保持原最小高度 |
| 主标签组与插件筛选标签组 w-fit、nowrap 和固定高度组合 | 以实际可用容器为边界的标准 Tailwind named container query；小于 24rem 时标签组与触发器允许换行/增长；正常桌面保持原布局 |
| 插件目录行把图标、文本和动作固定在同一行，放大文字后文本区可变为 0 宽 | PluginRow：允许行换行，文本使用可伸缩 basis，动作可换行，连续文字可断行 |
| 图标选择器固定同行，按钮内容超过窄正文列 | PluginIconPicker：预览与正文可分行，按钮保留原最小高度并按内容增长 |
| 配置说明里的 `crm.objects.companies.read` 等连续字符串无法断行，Save configuration 超过窄内容宽度 | ConfiguredPluginSettings：说明内容可在必要时断行，提交按钮允许换行 |

技能筛选器的 query container 位于全宽 toolbar；把 inline-size containment 放在 shrink-to-fit Tabs 自身会改变正常桌面宽度，该实验已舍弃。没有修改全局 Tabs/Button/Dialog 原语，没有加入隐藏溢出、过滤器、预算豁免或框架分支。

代表状态：capability directory、MCP personal edit、bookmark library、bookmark unknown page、Lark install、business configuration、skills builtin。保留旧失败与后续实验明细：[完整证据](evidence/2026-10-09-reflow-probe/capability-reflow-proposal-validation.json)。Agent gallery/settings/knowledge 与 Appearance/Memory 由另一个已验证修复负责，本次不重复修改。

初轮正式回归为 `frontend-vue/tests/e2e-parity/capability-controls-reflow.spec.ts`：14 个双端用例（Stage30 后扩为 28 条，见下文），沿用统一真实 API 夹具和全部原量具检查，并检查桌面标签组/分类按钮/图标选择器尺寸、弹窗生命周期、未匹配 API 与页面异常。最终 combined/triple 回流登记表的全部状态继续保留。

本次局部检查：Vue 能力/扩展/MCP 单测 18 文件、129 PASS；两端 scoped lint、格式化与 Vue app/tests typecheck 均 PASS。独立 Vue 新生产构建下七个正式 reflow 状态全部 PASS（15.3 秒），保留桌面尺寸、360px + 32px 根字号、全部严格零溢出检查；该初轮当时尚未执行最终两端重构建；最新 Stage31 的 28 条双端正式结果已在末段回填。

## Stage30 全量回流新增问题

全量双端 210 个终态进一步发现七个能力终态的共同缺陷，本节保留旧构建输入；上述早期七个代表状态通过不代表全产品已经没有回流问题。新增七个终态均在 Stage30 现有生产副本实际 RED，再以当前源码的标准 Tailwind utilities 和真实原语 class 合并输出在同页面验证：7/7 PASS，双端合计 14 页，耗时 41.3 秒。全部桌面 main/header/dialog/tab/button 几何变化为 0；360px + 32px 根字号下，严格 survey 的页面横滚、非预期内部横滚、不可达控件和裁切均为 0。没有加入过滤器或放宽量具。该阶段当时最终新构建验证尚待 root/artifacts 独立执行，不能把旧构建上的因果实验称为源码重构建验收；后续实际结果见 Stage31 段落。

| 终态 | 实证根因 | 双端最小修复 |
| --- | --- | --- |
| bookmark-plugin / directory-discovery-error | Reload extensions 按钮保持 nowrap，文字宽度超过窄内容列 | 限制最大宽度、允许文字换行，仅窄屏按内容增长并保留原最小高度；正常桌面高度仍为 36px |
| skill-export / manifest、download、stale-content、blocked | 统计 dl 固定三列，Directories / Uncompressed size 的最小内容宽度超过弹窗正文 | 正文使用标准命名容器查询；不足 24rem 改一列，充足空间保留三列 |
| knowledge-scope / file-selection、agent-file-selection | 文件模式单行同行标签超过内容列；React Radix ScrollArea 内层 display:table 继续按最小内容宽度扩张 | 模式标签允许换行；仅该 ScrollArea 消费位置使用 block 内容布局，两端相同职责，保留原生纵向滚动和可见文字 |

7 个生产文件冻结于 23:26:28.868 CST。Vue 4 文件 17 单测、React 2 文件 10 单测、两端 scoped lint/格式及 React/Vue app/tests 类型检查均 PASS。正式 capability-controls-reflow 由原 14 条扩为 28 条，旧行为与严格 survey 断言全部保留。[当前精确证据](evidence/2026-10-09-reflow-probe/capability-stage30-summary.json)。

Stage31 最终源码重构建复验：独立 canonical Next 与 Nuxt 生产构建已实际执行正式 capability-controls-reflow **28/28 PASS**，包含两端原十四条与新增七终态各十四条。全部沿用真实登记状态与原 survey/input/scroller 检查，严格零横滚/零不可达/零裁切。此前旧构建 CSS 因果实验的边界保留；当前新增证据为真正源码新构建结果。[正式 28 条结果摘录](evidence/2026-10-09-reflow-probe/capability-stage31-rebuilt-28pass.log)。同轮执行中其他 chat/owner 用例由对应负责人收口，不纳入本段 PASS 声明。
