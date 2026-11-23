# 浮层缩放与推理菜单根因收口（Stage40）

本轮区分了量具错误与真实产品缺陷。引用选择器的可见定位边界是其绝对定位 popup 和 `offsetParent` composer；ARIA 连接的是内部选项列表与编辑器，直接量这两个内部节点会得到 164px。两端真实 popup 到 composer 的距离均为 8px，原生 hit-test、trial click 和实际选择都可达。React 推理菜单的触发按钮则被 `hidden sm:inline-flex` 在窄屏隐藏，菜单仍开着；这是实际产品缺陷。Vue 对应触发器一直可见，无需改 Vue 产品。

## 原始失败与证据边界

原完整 `overlay-survives-resize`：Vue 有 2 项引用列表距离错误，React 同样 2 项并另有 4 项推理菜单触发器不可见，两个原宏都为 **FAIL**。原始 trace、PNG、error-context 共 416 文件、444,292,697 字节已完整保全并校验 SHA，见 [evidence-manifest.json](evidence/overlay-resize-stage40/evidence-manifest.json)。运行时副本、Gateway8160 和原始产物均未修改。

原生独立 context 复现 8 个失败终态：引用选择器 composer 为 y306–454，popup 从 y462 开始，内部 listbox 从约 y499 开始，textarea 为 y311–335。React 推理按钮 `display:none`、矩形为零；可见菜单出现在 x8/y4，宽280、高326。具体 JSON/PNG 与诊断脚本保存在 [证据目录](evidence/overlay-resize-stage40/)。这些诊断完成不等于原完整宏通过。

## 最小修改

- `frontend/src/components/workspace/input-box.tsx` 只移除推理按钮的 `hidden` 与 `sm:inline-flex`。基础按钮已有 `inline-flex`；功能条件、disabled、模型能力、选项和 followups 生命周期均不变。完整文件逆替换精确还原前次冻结 SHA，见 [单行逆变换证明](evidence/overlay-resize-stage40/input-box-responsive-class-change.json)。
- 原浮层宏提取可序列化 survey，只有严格匹配真实 MentionPicker 的直接结构、单一 listbox、绝对定位 popup、直接 `offsetParent` composer、外部 ARIA 编辑器关系时，才以 popup/composer 量几何。ARIA 触发器可见性仍检查原 controller，其余浮层沿用原逻辑。
- 新增 3 个原生 DOM 几何守卫，验证合法结构，以及 static/wrong-offsetParent/缺 marker/外部 controller 等错误结构、真实80px漂移、越出视口与隐藏 controller 仍失败。64px 门限不变。
- 新增双端真实推理菜单 resize 回归，每端包含 en/zh，验证同一菜单与按钮、选 High、窄屏保留菜单、回桌面仍选中、Escape 关闭并回焦点；另有真实挂载 InputBox/Radix 的组件回归，验证 owner 身份和选项回调。组件环境不承担响应式 CSS 可见性证明。

原宏的完整执行循环与全部断言经 TypeScript AST 对比完全相同：全部注册终态、fresh context、原有 mobile skip、30s 场景预算、原整体预算、375×812、64px 和所有反空转断言均保留，见 [AST证明](evidence/overlay-resize-stage40/original-macro-ast-preserved.json)。净新增正式 Playwright 为 **5 cases / 2 files**，注册取样状态数没有增加；总数由根代理实际 collector 再核。

## 实际验证

| 验证 | 实际结果 | 边界 |
| --- | --- | --- |
| 新结构守卫3 + 原编译两端推理菜单 | 4 PASS / 1 FAIL，exit1 | Vue两语言通过；React真实隐藏触发器 RED，原现场保留 |
| 标准 CSS 等价因果，双端、每端两语言 | 2 PASS，exit0 | 所有 desktop main 后代矩形0差异；旧编译独立context，不是新编译验收 |
| 校准后实际引用选择终态 | 4 PASS，exit0 | 两端各两状态，新survey加原生实际选择 |
| React真实挂载与受影响既有回归 | 5 files / 82 PASS，exit0 | 含新InputBox owner用例与既有followups/autoopen/messagegroup/duration |
| React `tsc --noEmit` / Vue tests `vue-tsc` | exit0 / exit0 | 原始空输出日志保留；未运行fullunit/build |
| 本轮两端 scoped ESLint / 6 files Prettier check | 全exit0 | 无全仓重写 |
| 新编译菜单与原全部终态浮层宏 | **UNRUN** | 等根代理统一编译及全量门禁 |

生产冻结为 **2026-10-10 08:03:48 CST**，唯一生产文件 SHA 为 `e3e7b35297eec46ad6fedc0993ab6bc494c2a53f5a9918b242ce95540309782a`。六文件最终指纹、直接退出与结果详见 [test-freeze.json](evidence/overlay-resize-stage40/test-freeze.json)。本轮仅 React 生产文件变化，旧 React 最终验收不能外推到此新指纹；此前 Vue 产品边界不因本量具调整而改变，但原两端完整宏仍必须重新实际执行。没有更新任何截图基准、阈值、预算或退役原取样。
