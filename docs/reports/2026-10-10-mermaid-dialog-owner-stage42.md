# React Mermaid fullscreen owner — Stage42

截至 2026-10-10 09:11 CST。本报告只证明下述精确输入与定向验证，尚不宣称最新 Next 编译产物的公开报告验收通过。

## 已证实的根因与修复

旧 React Streamdown 2.5 fullscreen 只向 body 创建普通 portal，并用 document bubble Escape 关闭。外层 artifact Sheet 的 Radix DismissableLayer 在 document capture 阶段先处理同一次 Escape；fullscreen 未登记为 modal layer，外层 Sheet 同时关闭。公开报告中英文手机版均重现，clipboard 随后读到主会话最后回复，而不是所选报告。Vue 原生 Reka Dialog 保持外层面板。

项目通过公开 `plugins.renderers` 注册自有 Mermaid renderer，仍使用公开 `@streamdown/mermaid.getMermaid(config).render` 绘图。fullscreen 使用真实 Radix Root/Trigger/Portal/Overlay/Content/Close。透明标准 Overlay 保留原生 scroll lock；视觉背景由原 fullscreen Content 提供。FocusScope、DismissableLayer 与触发器恢复共同承担内外弹层生命周期，没有全局 Escape bridge、手改第三方包或 Sheet 特判。

fullscreen 复用项目唯一的 `enterDialogContent` 入口。真实 Retry 按钮异步消失时，FocusScope 会将 activeElement 放回 Content；反向 Tab 需要同一个标准入口，不能以常驻 Close 按钮代替实际验证。composer 独占公共 Dialog 文件并提供具名 export，本轮 renderer 不复制其候选算法。

## 精确范围

自有生产输入：

- `frontend/src/core/streamdown/mermaid-renderer.tsx`：`b61998d4a174be96215d6ac1511ad38174c561b25f8475490ab5c430bdee5e4b`。
- `frontend/src/core/streamdown/plugins.ts`：`25f642bea2cd1dd772eb18ee6d0bd792a5f48157466d41028cf82efe543c98dc`。

完整 6 路径、字节与 SHA、外部公共 Dialog 依赖边界见 [source-freeze.json](evidence/mermaid-dialog-stage42/source-freeze.json)。其中测试 3 路径、开发说明 1 路径；未改依赖、生成 primitives、共享 scenarios、原 showcase-interactions 断言或任何阈值。

公开 renderer API 没有导出原绘图状态、zoom/download/fullscreen 控制器，因而本域保留这些状态及 Streamdown 2.5 的原 toolbar SVG/类名、DOM scroller 结构。格式化后约 660 行主要是 SVG 与展开 JSX；未扩展 Markdown 其他渲染域。图标保留 installed 的 width/height=16 和原 size=14/16/20 属性，未把 size 属性误解释为新的几何尺寸。

## 已执行与边界

| 验证 | 实际结果 | 证据 |
|---|---|---|
| 真实 Sheet + 原 renderer 一次 Escape | RED，直接 exit1 | `consumer-red.log` |
| 新 renderer + 现有 Markdown/插件/normalizer 合同 | 4 files / 38 PASS，0 skip/todo，直接 exit0 | `contracts-final-with-admission.log` |
| 只撤销 `onKeyDown={enterDialogContent}` | 目标回归真实 FAIL，直接 exit1；finally 原字节恢复 | `admission-remove-fix-red.log`、`admission-remove-fix-control.json` |
| 原生浏览器撤销入口 | 正向 PASS、反向卡容器 FAIL，直接 exit1 | `native-without-admission-results.json` |
| 原生浏览器恢复入口 | 正反方向均 PASS，直接 exit0 | `native-fixed-results.json` |
| 自有 React scope eslint / types / prettier | 全部直接 exit0 | `lint-freeze.log`、`types-freeze.log`、`format-freeze.log` |
| 新正式浏览器 spec lint / collection / Vue tests types | 全部 exit0，实际 4 tests / 1 file | `browser-lint.log`、`browser-collection.log`、`browser-types-final.log` |
| 新编译公开报告中英文 × 桌面/手机版 | **UNRUN** | 待 root 统一新构建 |

原生辅助 harness 用当前 renderer、已安装 React/Radix/FocusScope 与真实 Sheet；仅受控公开绘图引擎和 i18n hook，独立 loopback port0、浏览器及上下文均在 finally 关闭。它验证真实 Tab/Shift+Tab、Retry 卸载、内外两次 Escape、触发器焦点恢复，pageerror=[]、外部 API 请求=[]。辅助 CSS 与引擎不会冒充最新 Next 页面、全 UI 或真实 Mermaid 绘图验收。

12 条 renderer 挂载回归还验证：当前两 locale 消费、原文复制（含末尾 LF）、whole/per-action controls、isAnimating/isIncomplete、code/config 切换晚到 fence、旧 SVG 遇 partial parse error 保留、custom error/retry、同步初始化错误回退、fullscreen pending Close、wheel 正/零/负 delta、zoom/reset、pointer capture 与 body userSelect 清理、精确 MMD/SVG/PNG 类型/文件名/5 倍 canvas、ObjectURL revoke、取消下载、IO leave/debounce/idle/disposal、异步下载失败保留菜单。新正式 4 case 保原生完整 focus 环、pan/zoom、三种真实下载、raw clipboard、外层 Sheet 与报告内容合同。

renderer 保当前实际产品调用的 i18n、controls、Mermaid config/errorComponent；当前代码无 Streamdown `prefix`、自定义 Mermaid icons 或单独覆盖 toolbar translations 的消费者。本报告不宣称所有未使用的第三方 API 变体兼容。

## 接续必须执行

待 root 明确构建窗口，在新隔离 React 产物执行原 `showcase-interactions.spec.ts` 的 React 4 维完整链及新增 `mermaid-fullscreen-owner.spec.ts` 4 项，逐张回读实际 UI PNG。原 public report clipboard/export/raw/read-only 断言完整保留。公共 Dialog 由 composer 最终冻结后，root 的完整 React check/unit、跨端矩阵、Docker React 镜像与入口验收均需按最新来源重新执行；旧 PASS 只保留历史来源边界。Vue/Linux 构建继续按 root 的统一窗口调度。

最终仅补 Streamdown Apache-2.0 原版权/许可及适配来源注释；精确撤销该注释可恢复已执行 38 unit/native 的源 SHA，重新 bundle 的正反两产物 SHA 与已执行产物逐字相同，prettier check exit0。该注释变化与之前实际检查输入分别记在 receipt，未冒称检查读取了事后注释。

公共 React Dialog 后续由其 owner 冻结为 `624734980e1da1a788562d6eaf5ee6746f0561676a600ef826c291da67c7a9d6`，与本报告最初记录的外部模块 SHA 不同。该差异单独保留，不声称整个 Dialog 模块前后零漂移；复用的具名入口算法未变，最后 native 正反 bundle 与已执行产物仍逐字一致。统一新编译验收必须纳入公共 Dialog 最终字节。
