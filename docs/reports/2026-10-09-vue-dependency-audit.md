# W12 依赖漏洞审查与双端渲染器更新

日期：2026-10-09；发行补审：2026-10-12。原始审计计数及定向命令为各自当时的收据，不能替代最终冻结源全门禁。事实来源是当前 package/lock、实际已安装消费者源码、官方 npm registry audit 和下列定向命令。后续资源实验另有生产构建与浏览器证据，范围见“首屏资源与依赖归因”；本报告不代表全量门禁、真实 Gateway、视觉或生产环境验收完成。

## 实际结论

官方原始 `pnpm audit --registry https://registry.npmjs.org --json`：更新前 metadata 共 60 个安装漏洞条目，advisories 共 59 条公告/范围记录（low 8、moderate 24、high 25、critical 3）；最终 6 条（high 4、critical 2），54 个安装漏洞条目（53 条原公告/范围记录）消除。最终原始 audit 退出码仍为 1，不能描述为“零漏洞”。新增 qrcode-generator 2.0.4 后已重新审计，无新增公告。

`node frontend-vue/scripts/audit-triage.mjs` 最终退出码 0：6 条实际公告与 6 条具体源码分诊逐项匹配。分诊只接受 `accept-unreachable`，必须带 GHSA、affected range、实际安装版本及各版本绑定的依赖路径、severity、来源、依据和重新审查条件；新公告、同包新漏洞、版本/路径/严重度变化、过期记录、网络错误、残缺 JSON、计数错位、muted advisory、重复记录均失败。已删除旧七包表和 Mermaid 11.12.2 的 hold；该旧判断把 HTML/CSS 注入等错误概括为标签页卡顿，已被官方公告证伪。

## 安全更新与兼容性

Vue 及 compiler/server-renderer 统一 3.5.42，已确认 renderer 解析到同一个 Vue runtime。Vitest/coverage 精确对齐 4.1.11。Nuxt 保留当前 4.5.1；未为了审计消零跨框架大版本升级。原 W12 审计阶段安装使用 `--strict-peer-dependencies --ignore-scripts`，当时没有运行 prepare/build；2026-10-12 的发行补审按标准 frozen 安装执行正常生命周期，Vue 保留 strict-peer 检查。

双端实际统一 Mermaid 11.16.1、DOMPurify 3.4.16、KaTeX 0.18.2、lodash-es 4.18.1。React 的 @streamdown/mermaid 与 rehype-katex、Vue 的 Mermaid 与 rehype-katex 都解析到上述对应版本；新增测试校验真实依赖解析树及两端 KaTeX CSS 字节一致。Vue 原来完全没有导入 KaTeX CSS，现由数学按需 loader 同时等待插件和安装包 stylesheet；纯文本不提前加载数学资源。

2026-10-12 发行补审发现：原 `lodash-es@4.18.0` 虽已修复安全公告，实际发布的模块构建遗漏内部导入，不能继续作为可用版本推荐。两端真实 Mermaid → dagre-d3-es 解析出的发布包分别复现 `fromPairs` 的 `baseAssignValue` 与 `template` 的 `assignWith` ReferenceError；双端只更新 override/锁节点到 [官方 4.18.1 修复版](https://github.com/lodash/lodash/releases/tag/4.18.1)。[ES 发行分支差异](https://github.com/lodash/lodash/compare/4.18.0-es...4.18.1-es) 与 [模板注入公告](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc)、[数组路径原型删除公告](https://github.com/lodash/lodash/security/advisories/GHSA-f23m-r3pf-42rh) 一起说明应升级而非退回仍受影响的 4.17.23。正常 frozen 安装双端直接退出 0；新发布包两端各 9 项实际函数/安全边界/dagre layout/Mermaid parse 验证通过。原 dagre layout 与 Mermaid parse 在旧版也通过，未将发行包缺陷夸称为当前所有图表必然损坏。完整旧 RED、新 GREEN、镜像注册表缺版本失败、官方命令来源及最小锁深比保留在 `docs/reports/evidence/2026-10-12-lodash-es-release-repair/`；最终生产构建、完整浏览器与在线 audit 仍由新冻结源正式门禁判定。

已真实验证 `simple-git 4.0.1` 移除 default export，而已安装 Nuxt DevTools 3.4.1 与官方稳定 patch 3.4.2 仍 `import Git from 'simple-git'`。强制 override 会在模块加载时报缺少默认导出，strict peers 无法发现。已撤回 simple-git/argv-parser major override，未写 shim、未修改 node_modules。恢复 3.36.0 后按真实 DevTools 方法实际调用 branch()/固定 revparse()/status() 成功。

## 六条剩余公告的当前边界

完整机器记录在 `frontend-vue/baseline/audit-triage.json`，下述结论只覆盖该文件的具体公告和已安装路径。

- node-forge 1.4.0 / GHSA-86w9-cpqp-85rv：官方 registry latest 仍 1.4.0，无已发布修复。listhen 1.10.1 `dist/shared/listhen.*.mjs` 的 forge 调用为开发 HTTPS 的证书生成、签名、PEM/PKCS12 导入导出；没有 RSA signature verify 或证书链 verify。Gateway 认证不经此库。若 listhen 调用变更、其他消费者引入验证或发布修复，重新审查/升级。
- braces 3.0.3 / GHSA-vfj7-8cjw-p6xm：官方 registry latest 仍 3.0.3，无已发布修复。Nitro 2.13.4 `dist/core/index.mjs` 和 `dist/rollup/index.mjs` 的 globby 模式为固定扫描字符串或操作者配置的 ignore/publicAssets.pattern。消息与上传文件内容不成为 glob 表达式。它属于构建调用边界，不能据此宣称已检查生产 chunk；本轮未构建。
- argv-parser 1.1.1 / GHSA-v5rq-49vh-5v5c：漏洞需要攻击者可控 VISUAL/TERM 环境和打开编辑器的 Git 操作。DevTools 构造 Git(rootDir) 后只调用 branch()/revparse(["--short", "HEAD"])/status().isClean()，不调用 env()/commit/rebase，不转发请求环境。
- simple-git 3.36.0 / GHSA-x6jw-m9v5-85vh：需要攻击者控制 trailer.*.cmd 配置并执行 interpret-trailers；当前消费方没有该命令或外部配置参数。
- simple-git 3.36.0 / GHSA-g4wm-2vf7-vfgr：需要攻击者注入 include.path/includeIf 配置或 clone 参数；当前消费方没有 clone/config/raw/外部 customArgs。
- simple-git 3.36.0 / GHSA-858h-whjf-mvg5：需要 push --receive-p/--exe 等缩写命令参数；当前消费方没有 push 或不可信命令参数。

**DevTools 状态核验**：项目 nuxt.config.ts 没有显式关闭 devtools。Nuxt 4.5.1 `dist/index.mjs` 在 Vite builder 下，devtools 不是 false 且 enabled 不是 false 时自动加入模块；DevTools 的 setup 在测试环境提前返回，enableModule 在非 dev 模式只可能安装 build.analyze 支持后返回，dev 模式会启用实际面板。故不能声称当前 DevTools 被配置关闭。上述 Git 接受依赖具体调用参数，不是泛称“devDependency 所以安全”。非 dev 时 module-main 仍先被导入，故不兼容 default export 会破坏构建模块加载。生产服务/浏览器不提供这些 Git RPC 是源码控制流判断；未运行生产构建，不提供 chunk 缺席证明。

## 数学 DOM 兼容证据

在 /private/tmp 隔离安装 0.16.28 与 0.18.2，使用当前双端选项 output=html、throwOnError=false、strict=false，12 个公式 × inline/display = 24 例。24 例字节 DOM 都变化；20 例把内部 CSS class 加上 katex- 命名空间后，结构、属性、style、文本完全相同。其余四例为 inline 积分 margin-right 0.19445→0.1945em、display 积分 0.44445→0.4445em，及 inline/display underbrace 的 mord→minner 分类变化。没有在比较器中忽略 style 或此分类变化。

React SSR 数学对照语料新增积分/underbrace 的 inline/display、矩阵、颜色、非法命令和不可信 href；从当前 React + Streamdown + KaTeX 真实重录共 18 个 Markdown 场景。归一化 DOM 对照继续严格比较，fixture provenance 同时校验实际 KaTeX 版本。实际旧/新渲染实验显示 inherited trust 会令 0.16.28 输出 javascript anchor，0.18.2 忽略继承的 trust，新增回归保护。

Mermaid state classDef 注入的真实 renderer 测试在 loose 下单独验证 CSS 修复，不依赖最终 sanitizer 消除整个输出而假绿；产品配置仍为 strict，既有组件测试校验初始化参数。另按当前 React Streamdown 实件移除旧代码块降级分叉，统一图块工具栏、延迟进入视口、加载 spinner、错误/Show Code、最后有效 SVG 保留、fullscreen 和导出当前源码的状态链，并新增异步请求身份与取消回归。上述 DOM/Mock 状态回归通过；最终 strict 浏览器 SVG/DOMPurify、布局字体、缩放/下载和双端截图由 root 串行验收，本轮没有运行。

## 实际验证

- 先红：audit identity 负向测试缺新 API；数学 provenance 缺 KaTeX 标签；KaTeX stylesheet loader 未加载 CSS。均已记录实际失败并修复。
- 正式 Vue、React strict-peer install 均退出码 0；最终追加二维码依赖并撤回不兼容 Git override 的 Vue strict-peer install 退出码 0。
- 最终官方原始 audit 退出码 1，6 条公告；增强在线 audit gate 退出码 0，6 对 6 精确匹配。
- 首轮 markdown/audit 17 文件 166 项通过；增加安全/样式/数学差异语料及真实 renderer 解析树保护后，最终 19 文件 177 项通过（退出码 0）。
- 后续 Mermaid 状态/下载/全屏、虚拟消息动态锚定和 Browser 导航 fallback 收口，共 11 个针对性文件 81 项通过（退出码 0，`/private/tmp/deerflow-mermaid-virtual-delivery-tests.log`）；其中 Mermaid 新增 8 项状态回归，虚拟列表从原 2 项增加到 10 项真实虚拟器回归。历史前插、尺寸变化、阅读锚定和组件销毁均未 mock 虚拟器实现。
- `node frontend-vue/scripts/record-react-markdown.mjs --check` 退出码 0，真实 React 重录与签入夹具字节一致。
- 本包 scoped Prettier 与 ESLint 退出码均为 0。`vue-tsc --noEmit -p tsconfig.tests.json` 首轮退出码 0；最后一轮因并行 W10 新增 wechat-qr.dom.test.ts 的 plugins tuple/可能 undefined fixture 错误退出码 2，已交该文件 owner 修复；本包无诊断。测试/审计日志为 `/private/tmp/deerflow-w12-{verified-tests,final-gate,lint,test-types-final}.log`，durable 结论及完整原始身份存于本报告和 evidence.json。
- 上述 UI 收口后再次 scoped ESLint 退出码 0（BrowserPanel 仅已有 HTML void 自闭合 warning）；W12 parser/renderer/数学及相关 tests 再次 ESLint 退出码 0。该时点的 test typecheck 退出码 2，仅并行 E2E `ParityTarget`/`ParityStubs` 接口和 `Agent` fixtures 诊断，已交各 owner；本包无诊断，记录于 `/private/tmp/deerflow-mermaid-virtual-types.log`，不宣称全仓类型通过。
- 本节 W12 审计阶段未运行 build、全量 verify/suite、服务、真实浏览器/E2E、生产部署。后续资源实验的独立范围如下；最终原 checkout 串行门禁仍由 root 负责。

## 首屏资源与依赖归因

本节记录 2026-10-09 后续 C/F 实验。使用同一 WIP 源码副本、保存各轮独立 `.output-A` 至 `.output-F`，浏览器访问真实 Nuxt 生产服务。每个路由/语言使用新 Chromium context、实际 locale cookie、正常 hydration 与合成 API fixtures，等待 networkidle 及页面内容可见，统计实际请求过的去重 JS 文件。raw/Brotli 是对应保存产物文件的字节和，不是网络 `encodedDataLength`；下列数据为原生 macOS arm64 实验值，不能据此推算最终 Linux 预算。完整 36 组 A–F 路由记录、交互证据、统计与来源 hash 已保存到同目录 `2026-10-09-vue-dependency-audit-evidence.json` 的 `payload_experiment`。

### 先修正计量前提

Nuxt 的 HTML script prefetch 与 NuxtLink 的 visibility prefetch 是两套机制。只关闭前者（B）时，首页仍会因可见 workspace 链接加载路由及 layout：首页英语实际下载 1,282,165 raw / 390,246 Brotli。Nuxt 4.5.1 的 `nuxt-link.js` 分发 visibility/interaction 预取，`composables/preload.js` 执行路由 loader，`pages/runtime/plugins/prefetch.client.js` 还会 import layout。因此 Profiler “已执行”不能证明模块被当前页面使用；旧 `VeryLow` 分组也把应用正在等待的选中词典计成 prefetch。历史 workspace 792 KB critical 预算和“把 Markdown 移到 prefetch”的收益不能继续作为必要依赖闭包的事实依据。

C 使用两个标准配置点：`build:manifest` 仅将 `.js` 的 `prefetch` 设为 false，保留 preload、入口 script 与 imports；`experimental.defaults.nuxtLink.prefetchOn` 设为 `{ interaction: true, visibility: false }`。本地 @nuxt/vite-builder 4.5.1 在标准 manifest 生成后调用该 hook，vue-bundle-renderer 2.3.1 根据 `dep.prefetch` 生成提示。`noScripts` 会关闭应用脚本，`earlyHints` 只管 HTTP 103，均不适合本问题。C 首屏没有推测 JS 请求；真实 hover 和 focus 都在停留首页时加载了 workspace layout，随后点击正常进入聊天页，8 个浏览器用例全部通过。没有拦截应用 JS、禁用 hydration 或改变测试专用产品行为。

### C/F 实际首屏下载

C 保留 Memory 单面板异步。D 再将 About 异步；E 将八个设置面板全部异步；F 在 E 上让每个异步面板自行负责加载状态（`suspensible: false`）。D–F 同步了 CSR 首次按 cookie 选择语言的修复；C 的 CSR 中文场景仍先载英语再载中文，因此不能把该差额全归给设置拆分。各组均保留正常应用内容。

| 路由 / 语言                    | C 文件数 / raw / Brotli（bytes） | F 文件数 / raw / Brotli（bytes） |
| ------------------------------ | -------------------------------- | -------------------------------- |
| `/` / en-US                    | 35 / 388,465 / 130,354           | 37 / 389,564 / 131,062           |
| `/login` / en-US               | 45 / 459,932 / 148,624           | 47 / 461,031 / 149,329           |
| `/workspace/chats/new` / en-US | 167 / 1,783,944 / 528,043        | 179 / 1,492,881 / 458,426        |
| `/` / zh-CN                    | 35 / 386,741 / 131,828           | 37 / 387,840 / 132,536           |
| `/login` / zh-CN               | 46 / 544,249 / 174,721           | 47 / 459,307 / 150,803           |
| `/workspace/chats/new` / zh-CN | 168 / 1,868,261 / 554,140        | 179 / 1,491,157 / 459,900        |

以上 C/F 初始 HTML JS prefetch 和初始推测 JS 下载均为 0；首页与登录页均没有下载 workspace layout。F 各路由只请求选中词典。英语 workspace 实际闭包减少 291,063 raw / 69,617 Brotli；公共页增加 1,099 raw、约 0.7 KB Brotli。该差值包含 D 同步的 CSR 初始化代码，属于所记录 C/F 方案整体比较，不能宣称是单个设置模块的纯净差分。

根因不是 async Memory 失效，而是静态 About 仍经 `app/core/markdown/plugins.ts` 的顶层 `rehype-raw` 引入 parse5。C 真实下载的 parse5 所在 chunk 为 226,047 raw。About 拆分后 D 的英语 workspace 降到 1,531,901 raw / 462,453 Brotli；D/F 在同一 CSR 初始化前提下，八面板按需加载再减少 39,020 raw / 4,027 Brotli。这与 React `frontend/src/components/workspace/settings/settings-dialog.tsx` 的各面板 `next/dynamic` 职责一致，已选择 F 落地。仍有聊天正文组件和全局 channel runtime 的真实静态依赖；本报告不宣称已移除所有关闭面板相关字节。

E 的“已声明 loadingComponent”并未在真实应用显示：Vue `defineAsyncComponent` 默认让父级 Suspense 接管，Nuxt 恰好提供了父级 Suspense；孤立组件测试会漏报。D/E 各六组网络用例通过，但首次 About 加载断言实际失败。F 使用原有 `SettingsPageLoading`，设置 `suspensible: false` 与 `delay: 0`。真实浏览器在正常网络延迟下用 DOM MutationObserver 捕获 Loading…，随后显示 About，关闭再打开不重载该 chunk。F 7 个用例通过；两项已在 C 验证的交互用例未重复执行。源代码回归在真实外层 Suspense 下以 deferred import 验证八个面板的首次加载、只加载选中项和缓存复用；连同相关设置/分桶测试共 14 文件 102 项通过，canonical app+tests 类型及 scoped lint 通过。

### 整包增长与分桶错误

原 `vendor-vue` 正则未限定 package path 边界，误把 Shiki 的 `vue-vine.mjs`（190,058 raw）、`vue.mjs`（24,489 raw）和 `vue-html.mjs`（8,474 raw）归到 Vue runtime，共 223,021 raw。已提取纯分类器到 `frontend-vue/config/client-chunk-file-name.ts`，仅识别真实 `@vue/子包`、`vue/`、`vue-router/`、`@tanstack/vue-query/` 路径。实际 grammar 名称与四类真实包路径回归先红后绿；这些 grammar 仍计入整包，只纠正归属，未通过改名免除预算。

实际 client module graph 中，没有同一正 renderedLength 的精确 module id 被重复输出到多个 chunk；Vue/reactivity/compiler 统一 3.5.42，Reka 2.10.1、query-core 5.90.20 没有重复 runtime。多版本集中在 Mermaid 的 d3/layout/cose 生态，以及 Mermaid 的 marked 16.4.2 与应用 marked 17.0.6；未用强制 override 合并不同 major。`vendor-ui` 是含 UI 基础模块的混合产品 chunk，不等于 Reka 库大小；C 的 217,378 raw 与 184,768 raw 两块主要含聊天/消息产品代码，176,694 raw 的 layout 块还含 settings/channel runtime。新增二维码库在该块的未压缩 rendered 模块为 43,826 bytes，不能当成 minified wire 增量。

C 期 i18n 170,836 raw 主要来自英语 86,041 与中文 84,317，以及 locale helpers；当前正式词典为 1,822 键，功能文案增长有源码依据，但首屏只应请求选中语言。依赖实际从 Mermaid 11.12.2 更新至 11.16.1、parser 0.6.3 至 1.2.1、KaTeX 0.16.28 至 0.18.2、Vue 3.5.40 至 3.5.42，并新增 qrcode-generator 2.0.4。未执行完全相同源码的更新前后整包重建，故不能把整包约 1.14 MB 增长逐字节归因给安全更新，也不能据此一次性抬高所有预算。

### 实验隔离限制与最终门禁

源码副本和保存的 `.output-*` 独立，node_modules 为原目录 symlink。已查证 @nuxt/kit 4.5.1 `dist/index.mjs` 的 `loadNuxtConfig`：非 dev、未显式 buildDir 且已有默认 `.nuxt` 时，将生产 buildDir 自动切换为 `node_modules/.cache/nuxt/.nuxt`。因此后续副本构建共享了原 checkout 的构建缓存与锁，不能称为完全缓存隔离；串行保存产物及各轮真实浏览器记录仍可核查。最后实验构建已自然退出，锁自动释放，未删锁或忽略锁；所有实验 preview 已停止。今后同类副本应显式使用副本内 buildDir，或让 node_modules 的可写缓存独立。

上述 A–F 实验阶段没有调整预算。后续原生 Linux 测量与预算收口单独记录如下。这里的 macOS 数据、fixture API 与定向通过均不替代真实 Gateway、完整 browser/parity suite、生产网络或上线验收。

## 逐条原始安装漏洞清单

以下按 60 个安装漏洞条目展开；js-yaml 同一公告的两个安装版本分行。所有范围、严重度与原版本来自官方 npm audit 返回的 GitHub advisory 元数据；每行链接到对应官方公告。保留项已在上文逐条解释；其余均通过兼容补丁或双端统一 renderer 更新消除。各实际版本与依赖路径的完整绑定见同目录 evidence.json。

| 官方公告                                                                 | 包                      | 严重度   | 原受影响范围               | 原安装版本 | 最终 lock 版本                 | 处理结果           | 当前调用与处理依据                                                                                         |
| ------------------------------------------------------------------------ | ----------------------- | -------- | -------------------------- | ---------- | ------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) | lodash-es               | high     | >=4.0.0 <=4.17.23          | 4.17.21    | 4.18.1                         | 已消除             | 模型输出图表 → Mermaid parser；双端 override 4.18.1，消除模板/原型相关公告。                               |
| [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) | lodash-es               | moderate | <=4.17.23                  | 4.17.21    | 4.18.1                         | 已消除             | 模型输出图表 → Mermaid parser；双端 override 4.18.1，消除模板/原型相关公告。                               |
| [GHSA-ghcm-xqfw-q4vr](https://github.com/advisories/GHSA-ghcm-xqfw-q4vr) | mermaid                 | moderate | >=11.0.0-alpha.1 <=11.14.0 | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-xcj9-5m2h-648r](https://github.com/advisories/GHSA-xcj9-5m2h-648r) | mermaid                 | moderate | >=11.0.0-alpha.1 <=11.14.0 | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-6m6c-36f7-fhxh](https://github.com/advisories/GHSA-6m6c-36f7-fhxh) | mermaid                 | moderate | >=11.0.0-alpha.1 <=11.14.0 | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) | lodash-es               | moderate | >=4.0.0 <=4.17.22          | 4.17.21    | 4.18.1                         | 已消除             | 模型输出图表 → Mermaid parser；双端 override 4.18.1，消除模板/原型相关公告。                               |
| [GHSA-87f9-hvmw-gh4p](https://github.com/advisories/GHSA-87f9-hvmw-gh4p) | mermaid                 | moderate | >=11.0.0-alpha.1 <=11.14.0 | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-c4c3-pg64-4m4v](https://github.com/advisories/GHSA-c4c3-pg64-4m4v) | mermaid                 | low      | >=11.0.0-alpha.1 <11.16.1  | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-6x64-9x62-f2gx](https://github.com/advisories/GHSA-6x64-9x62-f2gx) | mermaid                 | moderate | >=11.0.0-alpha.1 <11.16.1  | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-3rrr-jr9j-h3q3](https://github.com/advisories/GHSA-3rrr-jr9j-h3q3) | mermaid                 | moderate | >=11.5.0 <11.16.1          | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-2v8p-3f2j-5mp7](https://github.com/advisories/GHSA-2v8p-3f2j-5mp7) | mermaid                 | moderate | >=11.0.0-alpha.1 <11.16.1  | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-rhh3-jpg6-66xh](https://github.com/advisories/GHSA-rhh3-jpg6-66xh) | mermaid                 | moderate | >=11.6.0 <11.16.1          | 11.12.2    | 11.16.1                        | 已消除             | 模型输出围栏 → MermaidDiagram/render；双端统一 11.16.1，不能用 strict 或“仅标签页卡顿”接受 HTML/CSS 注入。 |
| [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | js-yaml                 | high     | >=4.0.0 <4.3.1             | 4.3.0      | 4, 4.3.2                       | 已消除             | OpenAPI 和 ESLint schema 工具读取受信任配置；同 major 更新 4.3.2。                                         |
| [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | nanoid                  | high     | <3.3.18                    | 3.3.17     | 3, 3.3.18                      | 已消除             | Vue compiler/PostCSS 工具路径；仅 3.x override 到 3.3.18。                                                 |
| [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | vitest                  | moderate | >=2.1.0 <4.1.11            | 4.1.10     | 4.1.11                         | 已消除             | 本地/CI 测试运行器；与 coverage 同步精确 4.1.11。                                                          |
| [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | @vitest/mocker          | moderate | >=2.1.0 <4.1.11            | 4.1.10     | 依赖链已移除                   | 已消除             | Vitest mock/server 路径；随 Vitest 更新 4.1.11。                                                           |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | js-yaml                 | high     | >=4.0.0 <4.3.2             | 4.3.0      | 4, 4.3.2                       | 已消除             | OpenAPI 和 ESLint schema 工具读取受信任配置；同 major 更新 4.3.2。                                         |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | js-yaml                 | high     | >=4.0.0 <4.3.2             | 4.3.1      | 4, 4.3.2                       | 已消除             | OpenAPI 和 ESLint schema 工具读取受信任配置；同 major 更新 4.3.2。                                         |
| [GHSA-w27v-7q3p-w38r](https://github.com/advisories/GHSA-w27v-7q3p-w38r) | svgo                    | high     | >=4.0.0 <4.1.0             | 4.0.2      | 4, 4.1.0                       | 已消除             | Nuxt CSS 压缩路径；同 major 更新 4.1.0。                                                                   |
| [GHSA-4vpr-x523-8j87](https://github.com/advisories/GHSA-4vpr-x523-8j87) | svgo                    | moderate | >=4.0.0 <4.1.0             | 4.0.2      | 4, 4.1.0                       | 已消除             | Nuxt CSS 压缩路径；同 major 更新 4.1.0。                                                                   |
| [GHSA-3wwx-pv8p-q78v](https://github.com/advisories/GHSA-3wwx-pv8p-q78v) | undici                  | moderate | >=8.1.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-pmjh-fq2x-6v4x](https://github.com/advisories/GHSA-pmjh-fq2x-6v4x) | undici                  | moderate | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) | undici                  | low      | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) | undici                  | high     | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-3xpg-4rpp-hhhm](https://github.com/advisories/GHSA-3xpg-4rpp-hhhm) | undici                  | moderate | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-2jfj-6hjv-fm6j](https://github.com/advisories/GHSA-2jfj-6hjv-fm6j) | undici                  | moderate | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-2gqq-gqf2-x968](https://github.com/advisories/GHSA-2gqq-gqf2-x968) | undici                  | low      | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) | undici                  | high     | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-8436-99hf-9mmv](https://github.com/advisories/GHSA-8436-99hf-9mmv) | undici                  | low      | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-vp8m-p9jh-q5pm](https://github.com/advisories/GHSA-vp8m-p9jh-q5pm) | undici                  | high     | >=8.10.0 <8.10.2           | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-rx4f-c7p8-82vq](https://github.com/advisories/GHSA-rx4f-c7p8-82vq) | undici                  | moderate | >=8.0.0 <8.10.2            | 8.10.0     | 8, 8.10.2                      | 已消除             | Nuxt 服务器网络客户端；同 major 更新 8.10.2，未以 dev 标签忽略。                                           |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion         | moderate | <1.1.21                    | 1.1.18     | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion         | moderate | >=2.0.0 <2.1.7             | 2.1.4      | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion         | moderate | >=4.0.0 <5.0.12            | 5.0.9      | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion         | high     | <1.1.20                    | 1.1.18     | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion         | high     | >=2.0.0 <2.1.6             | 2.1.4      | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion         | high     | >=4.0.0 <5.0.11            | 5.0.9      | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion         | high     | <1.1.19                    | 1.1.18     | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion         | high     | >=2.0.0 <2.1.5             | 2.1.4      | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion         | high     | >=4.0.0 <5.0.10            | 5.0.9      | 1, 1.1.21, 2, 2.1.7, 5, 5.0.12 | 已消除             | ESLint/minimatch 与 test-utils 工具路径；分别保持 1/2/5 major 更新 1.1.21/2.1.7/5.0.12。                   |
| [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p) | dompurify               | low      | >=3.4.13 <=3.4.15          | 3.4.13     | 3.4.16                         | 已消除             | 模型输出图表最终 sanitizer；双端 override 3.4.16。                                                         |
| [GHSA-j22f-vq7h-c4qm](https://github.com/advisories/GHSA-j22f-vq7h-c4qm) | devalue                 | high     | >=5.1.0 <=5.9.2            | 5.9.2      | 5.9.3                          | 已消除             | Nuxt 序列化路径；5.9.2→5.9.3。                                                                             |
| [GHSA-hx4r-w6wj-j8fg](https://github.com/advisories/GHSA-hx4r-w6wj-j8fg) | devalue                 | moderate | <=5.9.2                    | 5.9.2      | 5.9.3                          | 已消除             | Nuxt 序列化路径；5.9.2→5.9.3。                                                                             |
| [GHSA-mcm9-63f2-9j32](https://github.com/advisories/GHSA-mcm9-63f2-9j32) | devalue                 | high     | <=5.9.2                    | 5.9.2      | 5.9.3                          | 已消除             | Nuxt 序列化路径；5.9.2→5.9.3。                                                                             |
| [GHSA-wf3x-273g-mvxv](https://github.com/advisories/GHSA-wf3x-273g-mvxv) | devalue                 | low      | >=1.0.0 <=5.9.2            | 5.9.2      | 5.9.3                          | 已消除             | Nuxt 序列化路径；5.9.2→5.9.3。                                                                             |
| [GHSA-x5rw-q4pp-hg5g](https://github.com/advisories/GHSA-x5rw-q4pp-hg5g) | devalue                 | high     | >=5.8.0 <=5.9.2            | 5.9.2      | 5.9.3                          | 已消除             | Nuxt 序列化路径；5.9.2→5.9.3。                                                                             |
| [GHSA-4q55-j62x-fr9h](https://github.com/advisories/GHSA-4q55-j62x-fr9h) | devalue                 | moderate | <=5.9.2                    | 5.9.2      | 5.9.3                          | 已消除             | Nuxt 序列化路径；5.9.2→5.9.3。                                                                             |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | node-forge              | high     | <=1.4.0                    | 1.4.0      | 1.4.0                          | 保留具体不可达分诊 | 保留精确分诊：listhen 证书生成/签名/导入导出，不调用 RSA verify；暂无已发布修复。                          |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | braces                  | high     | <=3.0.3                    | 3.0.3      | 3.0.3                          | 保留具体不可达分诊 | 保留精确分诊：Nitro globby 模式来自固定字符串和受信任构建配置；暂无已发布修复。                            |
| [GHSA-v5rq-49vh-5v5c](https://github.com/advisories/GHSA-v5rq-49vh-5v5c) | @simple-git/argv-parser | critical | <2.0.1                     | 1.1.1      | 依赖链已移除                   | 保留具体不可达分诊 | 保留精确分诊：DevTools 无攻击者环境/交互编辑器参数；修复 major 的实际消费者 API 不兼容。                   |
| [GHSA-x6jw-m9v5-85vh](https://github.com/advisories/GHSA-x6jw-m9v5-85vh) | simple-git              | critical | >=3.15.0 <4.0.1            | 3.36.0     | 3.36.0                         | 保留具体不可达分诊 | 保留精确分诊：DevTools 仅 branch()/revparse([--short,HEAD])/status()；不接受外部命令/配置。                |
| [GHSA-g4wm-2vf7-vfgr](https://github.com/advisories/GHSA-g4wm-2vf7-vfgr) | simple-git              | high     | <=3.36.0                   | 3.36.0     | 3.36.0                         | 保留具体不可达分诊 | 保留精确分诊：DevTools 仅 branch()/revparse([--short,HEAD])/status()；不接受外部命令/配置。                |
| [GHSA-858h-whjf-mvg5](https://github.com/advisories/GHSA-858h-whjf-mvg5) | simple-git              | high     | <=3.36.0                   | 3.36.0     | 3.36.0                         | 保留具体不可达分诊 | 保留精确分诊：DevTools 仅 branch()/revparse([--short,HEAD])/status()；不接受外部命令/配置。                |
| [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) | dompurify               | low      | <=3.4.15                   | 3.4.13     | 3.4.16                         | 已消除             | 模型输出图表最终 sanitizer；双端 override 3.4.16。                                                         |
| [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) | katex                   | low      | >=0.11.0 <0.18.2           | 0.16.28    | 0.18.2                         | 已消除             | 消息/产物数学输出；双端统一 0.18.2，CSS 与 renderer 同源，新增 inherited trust 回归。                      |
| [GHSA-jp82-f5mq-hwhp](https://github.com/advisories/GHSA-jp82-f5mq-hwhp) | seroval                 | high     | <=1.6.2                    | 1.6.2      | 1.6.3                          | 已消除             | Nuxt Vite builder 序列化路径；1.6.2→1.6.3。                                                                |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | source-map-js           | high     | >=1.0.0 <1.2.2             | 1.2.1      | 1.2.2                          | 已消除             | Vue SFC 编译路径；1.2.1→1.2.2。                                                                            |
| [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | postcss-selector-parser | moderate | <7.1.6                     | 7.1.4      | 7, 7.1.6                       | 已消除             | eslint-plugin-vue 选择器工具路径；同 major 更新 7.1.6。                                                    |
| [GHSA-g2v6-rqmx-r4w6](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6) | @vue/server-renderer    | high     | <3.5.42                    | 3.5.40     | 依赖链已移除                   | 已消除             | Vue SSR 与 test-utils 渲染；Vue/compiler/renderer 同步 3.5.42并验证同一 runtime。                          |
| [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) | shell-quote             | critical | >=1.8.4 <1.11.0            | 1.10.0     | 1.11.0                         | 已消除             | Nuxt DevTools launch-editor 命令解析路径；1.10.0→1.11.0。                                                  |

## 原生 Linux 当前路由与整包预算

2026-10-09 Stage23 使用显式独立 buildDir 的源码副本，在原生 Linux 生产服务运行全部 12 个正式 payload 用例，12 PASS、0 skip、0 flaky（84.3 秒）。生产源码 SHA256 为 `108258bc65aeafb505f438ef2a38545f1744e1edec9333feb5c1c4d787fbf0a6`；六组实际请求文件及 raw/Brotli 明细保存在 [Linux 请求证据](2026-10-09-linux-route-payload-final.json)。此指纹对应预算测量时的源码，后续任何源码变更仍需最终构建重新验收。

| 路由                   | en-US files / raw / Brotli | zh-CN files / raw / Brotli | 当前上限 files / raw / Brotli |
| ---------------------- | -------------------------- | -------------------------- | ----------------------------- |
| `/`                    | 37 / 389,346 / 131,046     | 37 / 387,627 / 132,526     | 39 / 402,000 / 137,000        |
| `/login`               | 47 / 461,166 / 149,679     | 47 / 459,447 / 151,159     | 49 / 476,000 / 156,000        |
| `/workspace/chats/new` | 178 / 1,470,750 / 453,138  | 178 / 1,469,031 / 454,618  | 184 / 1,515,000 / 469,000     |

上限取每条路由双语言各字段较大值，字节保留约 3% 余量，文件数保留整数小余量。六组初始 prefetch 均为 0 files / 0 raw / 0 Brotli，上限保持零。Stage22 在旧预算下六案失败，结构断言通过；更新预算后的 Stage23 六组测量、两个按内容渲染器用例和四个实际 hover/focus→预加载→点击用例全部通过。原三项禁入标记和四个交互断言保持原样，整包 asset-budget 同轮 exit 0。

`critical` 键保留以兼容消费者，但现在在产品侧关闭初始投机 JS hints、只按交互预取，且测试同时禁止初始 HTML JS prefetch、VeryLow 推测请求、公共页的 workspace layout、未选词典和无内容时的重量级 renderer。在这些独立断言下，初始实际 critical 等于 all；CDP priority 本身不再被当作“当前页面必需”判据。旧 workspace 792 KB critical + 914 KB prefetch 是调度分摊，不能与当前完整必要闭包直接比较，也不能继续声称 Markdown 被移到 prefetch 就改善了首屏。原三项重量级标记、正向 Mermaid 内容触发下载、真实请求文件清单均保留。

整包 Linux Stage23 为 680 个 JS 文件，15,960,906 raw / 3,797,152 gzip；最大 chunk 761.6 KiB raw / 224.7 KiB gzip，原最大单文件上限保持 800,000 / 240,000。纠正 package path 分桶后 Vue 为 10 chunks、167.5 KiB raw / 63.1 KiB gzip，原预算已通过；Shiki grammar 仍计入整包。Markdown 为 859.1 KiB raw / 261.9 KiB gzip、CodeMirror 为 542.7 / 195.0，均未抬预算。精确字节和所有分桶见 [Linux 整包证据](2026-10-09-linux-asset-exact-final.json)。

仅更新确实超出旧值的项目：两份完整的 1,822 键词典和 helpers 为 170,349 raw / 60,304 gzip，预算 176,000 / 62,500；35 个含 UI primitive 的混合产品 chunk 为 240,156 gzip，预算 248,000，raw/max 旧值保持；整体总量预算为 16,440,000 raw / 3,911,000 gzip，约 3% 余量。这里建立的是当前完整产品和依赖图的真实上限。已确认没有重复精确模块输出和 Vue/Reka/query runtime 副本，功能文案、二维码和 renderer 版本更新有源码依据；缺少同一功能树的旧构建，无法把 1.16 MB 整包增长逐字节归因给安全更新。该限制保留，不能把当前预算重定说成所有增长均已逐字节解释，也没有调整分桶隐藏总量。

## 历史路由预算说明归档

以下从旧 `baseline/route-payload-budget.json` 的 `$measured` 原文移入，仅保留预算沿革，不是当前性能或因果证据。尤其 CDP priority 分摊与“Markdown 移到 prefetch”的推论已由上文源码和实际网络实验修正。当前验收只采用后续原生 Linux 实际请求与反预取/按内容加载断言。

2026-09-20 实测（收尾轮，**这一条是按 CI 而不是本机设的**）：`/login` 的 critical 在 CI 上红了——measured 26 files / **372,139** raw / **123,465** brotli，预算 26 / 372,000 / 123,000，**raw 超 139 B、brotli 超 465 B**。而同一棵树在本机（macOS）量到的是 **25 files / 369,534 raw / 122,205 brotli**，绿的。

**平台差是 +1 file / +2,605 raw / +1,260 brotli，而且是系统性的**：这道预算历轮都按本机读数设，所以它在 Linux 上**本来就几乎没有余量**——本机自 2026-09-16 那次记录（369,228）以来只涨了 306 raw（第五十四～五十八轮给两个应用加的那几条无障碍相关的 Tailwind 任意值：`max-w-[calc(100vw-1rem)]`、`grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]`、`@container` 与 `@max-[12rem]:basis-full` 等），**是这 306 B 把早就贴着线的 CI 读数顶过去的，不是它一家吃掉了 2.7 KB 余量**。

按 **CI 实测 + 约 2%** 抬到 380,000 / 126,000；**文件数留在 26 不动**——它是「有没有意外把大块拆碎」的旁证，CI 实测正好 26，抬它等于把这个探针关掉。

⚠ **下次设这道预算要用 CI 的数，不要用本机的。** 另外两条路由同理可能也贴着线：本机 `/` 是 29 / 398,437 / 131,046 而预算 31 / 401,000 / 131,200——**按 +2,605/+1,260 的平台差推，它在 CI 上的 brotli 会非常接近 131,200**（这次没红，说明还在里面）。**这是推算不是读数**，哪天 `/` 也红了，先照这条查，别去找代码回归。

2026-09-16 实测（第二十四轮，收起态侧栏补上 tooltip）：**只有 prefetch 的字节越线，critical 三条路由全部在预算内且一格没动**（/ 29 files 398,131 raw 130,981 br vs 预算 31/401,000/131,200；/login 25/369,228/122,140 vs 26/372,000/123,000；/workspace/chats/new 38/771,115/226,158 vs 42/792,000/232,000）。prefetch 实测 / 60/858,764/236,419（预算 62/851,000/234,000）、/login 与 /workspace/chats/new 64/895,843/247,857（预算 66/888,000/245,500）——**raw 各超约 7.8 KB、brotli 各超约 2.4 KB，而文件数反而比预算少 2**：reka 的 tooltip 没有新切 chunk，是并进了已有的那几个。成因是 `ui/sidebar/SidebarMenuButton.vue` 开始静态 import `../tooltip`——收起成图标条时要说出那四颗导航键的名字（账 C，上游 `ui/sidebar.tsx` 一直这么做，而且它是把 `TooltipProvider` 包在 `SidebarProvider` 外面、**进关键路径**，本仓这一份落在 prefetch 里，比上游轻）。**没有改成懒加载**：它已经在空闲期最低优先级那一侧，换懒加载只会让首次悬停晚一拍，并且与上游的结构再差一层。预算按实测 + 约 2% 抬（/ 876,000 / 241,000；另两条 914,000 / 253,000），**文件数与 critical 一个不动**。criticalPathForbidden 三个标记仍然不在 critical ∪ prefetch 中（那条用例本轮是绿的）。

2026-09-05 实测（wave 73，WorkspaceToaster 补上四颗类型图标）：**只有 prefetch 的文件数越线，字节数三条路由全部还在预算之内、而且比预算低**（/ 765,306 raw vs 793,000；/login 与 /workspace/chats/new 801,442 vs 831,000）。涨的是 chunk **个数**：toaster 进了 workspace 布局，四颗 lucide 图标让 Rollup 多切了两个共享 chunk。文件数按实测 + 2 抬（/ 36→40，另两条 41→44），字节预算一个不动——**这条门禁真正要挡的是字节，文件数只是「有没有意外把大块拆碎」的旁证**。critical 三条全部在预算内且没有变化。criticalPathForbidden 三个标记仍不在 critical ∪ prefetch 中。

2026-09-02 实测（wave 23，settings 其余六个面板）：关于页从一段手写 article 换成上游那份 markdown 文档，于是它也进了 markdown 那个共享 chunk。三条路由的 prefetch 再涨约 43 KB raw（/ 754,936、/login 与 /workspace/chats/new 791,104），按实测 + 约 5% 抬。`/workspace/chats/new` 的 critical 又降了一档（748,794 → **717,123**，文件数 35 → 34）——appearance 换掉原生 select 之后 ui/select 的引用者集合变了，Rollup 的共享 chunk 划分跟着重排；预算按实测 + 约 5% 收到 753,000 / 36 files。criticalPathForbidden 三个标记仍全部不在 critical ∪ prefetch 中。

2026-09-02 实测（wave 22，记忆面板对齐）：记忆面板开始用 markdown 渲染摘要区，于是 markdown 管线同时被会话路由与设置面板引用，Rollup 把它提成一个**共享 chunk**，而那个 chunk 落在 prefetch 一侧。结果是 `/workspace/chats/new` 的 critical 从 40 files / 1,037,124 raw 掉到 **35 / 748,794**，prefetch 从 36 / 442,868 涨到 **39 / 747,789**——总量几乎不变（约 1,500 KB），换的是「阻塞首屏」与「空闲期投机」的分配，方向对用户有利。三条路由的 prefetch 全部按实测 + 约 5% 抬（文件数 + 2）。`/workspace/chats/new` 的 critical **调低**了：wave 19 抬到的 1,040,000 已经比实测高 40%，那不是预算而是一张空头支票，按实测 + 约 5% 收到 790,000 / 37 files。同一轮量过两种写法并取了更小的一种：MemorySettings 里 `MessageMarkdown` 用 defineAsyncComponent 时是 37 / 754,573 critical 与 41 / 743,235 prefetch，改成静态 import 是 35 / 748,794 与 39 / 747,789——critical 少 5.8 KB、两侧文件数各少 2，所以留静态 import。criticalPathForbidden 三个标记核对过，仍然全部不在 critical ∪ prefetch 中（`keeps heavyweight renderers out of the critical path` 两次都绿）。

2026-08-31 实测（wave 10，mermaid 工具栏）：`/workspace/chats/new` 的 critical 从 40 files / 997,601 raw / 287,606 br 涨到 40 / 1,009,783 / 290,683——**+12,182 raw / +3,077 br，文件数一格没动**。两个数都是同一次改动前后各跑一次这条用例量的：先把这条路由的 critical 预算压到 0 逼它把实测值打出来，再在 HEAD 的树上重跑一次。涨的是 markdown 渲染层新增的六个 SFC 与 core/markdown/mermaid-export.ts（mermaid 图块的工具栏、缩放平移、下载下拉、全屏遮罩）。它们进关键路径是**结构决定的**，不是疏忽：markdown 渲染器在会话路由上是同步的，上游 React 侧同样把整个 streamdown chunk 同步装进这一页。mermaid 库本体仍然是动态 import——criticalPathForbidden 的三个标记（KaTeX parse error / getSingletonHighlighter / sequenceDiagram）核对过，仍然全部不在 critical ∪ prefetch 中。prefetch 一侧同一次量到 36 / 442,868 / 124,370，与改动前的 36 / 442,868 / 124,374 只差 4 字节，也就是说这一轮没有把任何东西挪进投机下载。预算按实测 + 约 2% 抬（raw 1,030,000 / brotli 296,500），文件数留在 40。

2026-08-30 实测（critical / prefetch）：/ 29 files 376,659 raw 124,589 br 与 31 / 406,258 / 113,066；/login 24 / 347,737 / 115,749 与 36 / 442,403 / 124,208；/workspace/chats/new 40 / 995,042 / 286,930 与 36 / 442,403 / 124,208。这一轮只抬了 **prefetch**（预算 = 实测 + 约 5%，文件数 + 2），三条路由的 critical 一格没动：/ 与 /login 的关键路径反而变小了（378,519 -> 376,659、349,597 -> 347,737 raw），/workspace/chats/new 涨了 5 KB raw 仍在原预算内。涨的全部落在懒加载的 IntegrationsSettings chunk 上（22.5 KB raw，只在 rel=prefetch 里出现）：设置页对齐 React 之后，这一页多了 ui/{card,alert,badge,input}、SettingsSection 与 LarkStatusItem，以及 pendingFlow / changeApp / 安装中三块此前没有渲染的分支。已核对新增的 primitive 只出现在这一个 chunk 里（grep data-slot=card-action / alert-description），没有一个字节进关键路径；criticalPathForbidden 三个标记仍然全部不在 critical ∪ prefetch 中。

同一轮里量过、并因此放弃的一种改法：把九个设置面板全部改成 defineAsyncComponent（React 用 next/dynamic 就是这么切的）。实测 /workspace/chats/new 的 critical 从 40 / 994,976 / 286,937 涨到 45 / 1,007,885 / 291,507，prefetch 则从 442,174 掉到 380,725 raw——把 4.5 KB 阻塞首屏的字节换成 61 KB 空闲期字节，方向是反的。改回去数字立刻回到 40 / 995,042 / 286,930，归因是确定的：九个异步 chunk 的公共依赖被 Rollup 上提，而上提出来的那批落在入口图里。chunk 划分是构建产物、不是可观察行为，所以这里按实测取更小的一种。

2026-08-30 实测（critical / prefetch）：/workspace/chats/new 40 files 989,725 raw 285,613 br 与 30 / 431,640 / 119,520。这一轮只抬了这条路由 critical 的**文件数** 37 -> 40，字节数一格没动，因为它反而下降了（998,886 -> 989,725 raw，286,782 -> 285,613 br）：同一批代码被切成了更多更小的 chunk，总量更小。原因是 scheduled-tasks 域重写改变了共享模块的引用者集合（ui/select 多了一个引用页、ui/alert-dialog 少了一个、vue-query 的 infinite query 整个消失），Rollup 的共享 chunk 划分随之重排。已实测确认与本轮那处 AgentChat 改动无关：把那处改回去，文件数仍是 40（989,684 raw）。

2026-08-26 实测（critical / prefetch）：/ 30 files 378,519 raw 125,379 br 与 28 / 386,303 / 108,224；/login 25 / 349,597 / 116,539 与 33 / 422,448 / 119,366；/workspace/chats/new 37 / 998,886 / 286,782 与 33 / 422,448 / 119,366。预算 = 实测值 + 约 5% 余量（文件数 + 2）。那一轮只抬了 **prefetch**：会话列表页接上了 React 一直就有的两样东西——date-fns（相对时间措辞）与 @tanstack/vue-virtual（长列表虚拟化，React 是 @tanstack/react-virtual），外加 WorkspaceContainer / ScrollArea / tooltip / 渠道图标。Vue 之前更轻，是因为它少做了这些事，不是因为它更省。
