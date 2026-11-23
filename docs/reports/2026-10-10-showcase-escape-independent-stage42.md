# 移动端公开报告 Escape 事件独立诊断（Stage42）

当前真实缺陷在 React 全屏层的关闭所有权，不能通过限定 Copy locator 掩盖。原完整跨端的
React en-US/mobile、zh-CN/mobile 两条报告用例保持 FAIL；本次未改产品、正式测试、
基准或预算，未构建，未向 Gateway8160 / SQL 写入。

## 同编译产物证据

使用旧冻结副本 `/private/tmp/deerflow-final-parity-stage38-dhwub23s` 的 3270 / 3271 服务，
为每条诊断创建独立 browser context，先安装默认阻断 `/api/*` 的路由，再使用该副本
原 `runScenario` / report-preview 夹具。实际未匹配 API 阻断数全部 0；公开静态 mock
读协议保持原样。相关六条源路径及 installed Streamdown chunk 与当前 checkout 字节
一致，精确 SHA 见 [source-receipt.json](evidence/showcase-escape-stage42/source-receipt.json)。

| 实际步骤 | 文件 Sheet | 复制结果 |
| --- | --- | --- |
| React，en-US/mobile 原生 Escape | open → closed | 最后 assistant 网页回复，1685 bytes |
| React，zh-CN/mobile 原生 Escape | open → closed | 同上，1685 bytes |
| Vue，两 locale/mobile 原生 Escape | 保持 open | 原报告，18265 bytes，逐字相同 |
| React，两 locale/mobile 仅诊断阻止外层 dismiss | 保持 open，fullscreen 正常关闭 | 原报告，18265 bytes，逐字相同 |

错误剪贴板 SHA 为 `6391662c5033bd0a54f43782dfe4d9fe0e8737e735f05507edd4a6d4dcfff4f1`；
正确报告为 `5e949c6b042fbf52d54d20a9db5088ee62ac42842512c73b032c147b9878f51a`。
原测试紧接 Escape 后仍有一个 Mermaid 图的断言不足以证明文件面板仍开：会话本身也有图。

观察与因果检查共 6 项直接 exit 0，0 skipped / flaky / errors，21.347s。这是准确
观察到 React 的两项原缺陷并验证原因，**不表示原正式报告合同已通过**。原产品 FAIL
仍需修复和最新实际编译完整复验。

首轮观察曾错误要求退出中的 Sheet 立即从 DOM 移除；真实 `data-state=closed` 会在
退出动画期间继续保留 DOM。首轮 4 PASS / 2 FAIL 和完整现场保留在
`evidence/showcase-escape-stage42/first-observation-animation-assumption/`，随后只将
诊断观察改为实际 closed 状态，未修改任何产品验收断言。

## 原因与最小修复边界

- React `frontend/src/components/workspace/chats/chat-box.tsx` 移动端右栏使用共享
  `SheetContent`；`onOpenChange(false)` 会关闭 artifacts owner。
- installed `@radix-ui/react-dismissable-layer` 用 document **capture** Escape 处理
  最高登记层。内建 Streamdown 全屏图表没有登记这个层，Sheet 因而仍是最高层；
  它先 `preventDefault()` 并 dismiss。
- installed Streamdown2.5.0 的 Mermaid fullscreen 直接 `createPortal(...,document.body)`，
  再在 document **bubble** 监听 Escape，忽略 `defaultPrevented`，独立关闭自己。
  于是同一按键同时关闭两层。原生全屏打开后的焦点仍在 Sheet 内的 View fullscreen
  trigger，亦佐证这不是嵌套的标准焦点/关闭 owner。
- Vue `app/components/markdown/MermaidFullscreen.vue` 使用实际 Reka Dialog；内层
  fullscreen 已拥有独立的层栈和焦点合同，所以 Escape 只关闭内层。

仅在诊断 capture 阶段对全屏期间的 Escape 调用 `preventDefault()`，不停止传播：
Radix 保留 Sheet，Streamdown 仍正常关闭 fullscreen，随后原 Copy `.last()` 精确复制
报告。该实验没有 locator 改动，证明关闭 owner 是因果，而非选择器范围问题。

Streamdown 公共 `MermaidOptions` 只有 config / errorComponent，没有 fullscreen owner
或 Escape 生命周期注入；内部 onFullscreen / onExit 未导出。其公开
`plugins.renderers` 能按 `language: "mermaid"` 在内建分支之前提供 adapter。清晰的
根因方案是通过这个公开入口，让 Mermaid fullscreen 复用项目现有标准 Dialog，并
保留既有绘图、zoom/pan、copy/download、controls、streaming/config 与两 locale UI
合同；不访问未导出模块或通过 Sheet 特判某个报告。这个方案需要审查 renderer
适配面的具体最小实现。诊断中的 capture 拦截只作因果证据，尚未作为产品修复。

完整原测试的 clipboard/source mode/raw download/export/readonly/reload 所有断言均应
保留；应额外明确一次 Escape 后原 Sheet / 文件操作仍在、第二次才关闭外层，以及
桌面不受影响和焦点恢复。此处未新增正式 case 或修改 collection。

## 验收边界

本任务所有实际写入仅为本报告和 `docs/reports/evidence/showcase-escape-stage42/`。
runner 已直接 exit 0，独立 contexts 已清理；原预览服务未停止、原冻结副本未修改。
Linux Stage42 尚未构建，继续等待 root 统一源码与明确构建窗口。
