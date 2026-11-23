# Processing 折叠按钮回流修复（Stage34）

当前生产冻结为 2026-10-10 01:41:59 CST。两端 earlier-steps 按钮使用自然 `h-auto min-h-9`；Vue 同步补齐 React 已有的标签收缩和正常换行规则。没有改消息滚动区、量具、裁切阈值或文字内容。

## 实际根因

旧正式 scheduled-card 8 例为 6 FAIL / 2 PASS，完整日志和现场保存在 [原始正式 RED](evidence/scheduled-card-reflow-stage34/formal-red.log)。除两端卡片 footer 的独立裁切问题外，Vue 两个中文状态都出现物理消息滚动区横滚：clientWidth 330、scrollWidth 338。造成横滚的是“查看其他 1 个步骤”按钮，221.27px 标签撑出仅 192px 的内列；human 文本和文件路径不是这次溢出的来源。

React 的 ChainOfThoughtStep 标签已正常换行。仅为 Vue 补换行后，又测出两端共有的高度问题：两行内容约 80px，按钮仍固定为 72px，文字超出按钮边界。原 survey 没有将 React 此状态报为裁切，因此正式回归额外检查真实文本 Range 是否全部处于按钮内，不能依赖页面无横滚推断全文可用。

## 最小修复及真实因果验证

- Vue `ProcessingMessageGroup.vue`：earlier 标签 `min-w-0 wrap-anywhere whitespace-normal`，内 flex 可收缩，图标保持原尺寸。
- 两端 earlier 按钮：`h-auto min-h-9`。这是随内容自然增高的规则，不绑定 360px 诊断宽度。
- 既有 `scheduled-card-reflow.spec.ts` 8 例保留全部 survey、原生消息 scroller 身份、footer 全文/焦点和 Run 完整 ratio 1 断言；增加 earlier 全文 Range、真实 Shift+Tab→Tab、Enter 展开/收起及 375px/root32 全文检查。没有新增或删减用例。

旧预览的独立 context 上注入对应标准 CSS，双端 × 两个中文状态共 **4 PASS，direct exit 0**：桌面所有 main 后代几何差异 0；360px/root32 原 survey 所有问题清零，全文位于按钮内，原生键盘重入后完整 ratio 1，Enter 展开/收起正确。375px/root32 以及 1280px 下 256px 约束容器也全部容纳完整标签。最后一项是模拟窄分栏约束，不声称执行了真实侧栏拖拽流程。

该因果实验没有新构建。随后在 root 最新编译的 3250/3251 两端服务、独立 mock contexts 上执行原正式 8 例：**8 PASS，direct exit 0，0 skip/flaky/error，2.5 分钟**。消费文件和正式 spec 的 SHA 与当前源码逐项一致；包含两 locale、全文 Range、375px/root32、原生键盘、全部 footer 和 Run 完整 ratio 1。见 [最终编译结果](evidence/processing-toggle-stage34/final-compiled-8.json)。这证明本域 8 例，不代替 root 仍在执行的完整 886 例及鉴权/session 套件。

## 当前验证与证据

最终生产源的 Vue 3 文件 23 项、React 2 文件 56 项消费者单测 PASS；Vue app/tests、React types 均 direct 0。源码指纹、原始 overflow DOM、因果探针和逐项日志见 [证据摘要](evidence/processing-toggle-stage34/summary.json)。旧正式 8 例的全部 trace 继续保留，不以新测量覆盖历史 RED。

当前正式主 collector 是 886 例 / 29 文件，18 套共 1510 例；此修复仅增强原 8 例，不改变计数或 751 目标键。收集结果不证明完整浏览器执行通过。
