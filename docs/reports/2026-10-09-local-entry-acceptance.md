# 本地入口实际验收（2026-10-09）

当前最新实际记录：Stage35 三个入口均 PASS，共 4 次真实浏览器 Replay；完整 Nuxt/Nitro 生产构建也已执行。它们覆盖当时全部冻结的应用生产源码，包括 CodeBlock、Copy、references、scheduled footer、earlier-toggle 与 Lark 修复。Stage33/Stage31 保留为历史检查点，不外推给后续生产变化。此报告只证明所记受控隔离环境和精确源码的本地联调链路。

| 原样执行的入口 | Stage35 结果 | 实际验证 |
| --- | --- | --- |
| `make dev-vue` | PASS | Gateway 8001 + Vue 3100；React 3000 未启动；真实新会话、模型代理、流式回复、运行结束后可继续发送 |
| `make dev-dual` | PASS | Gateway 8001 + React 3000 + Vue 3100；两端分别完成同一实际 Replay 运行 |
| `bash scripts/serve.sh --prod --vue` | PASS | 原样完整 Nuxt/Nitro production build，Gateway + Vue 实际启动并执行相同 Replay/wire/新 UUID 断言 |

每次浏览器均验证 `/api/models` 与工作区页面返回 200，提交只产生一次 `/runs/stream`，实际收到 `hi from replay.`，新会话 URL 采用真实 UUID，提交按钮恢复可用，页面异常数为 0。请求上下文中的模型、Ultra 模式、thinking/plan/subagent admission 均按原断言验证；原始公开夹具上下文保留在 JSON 中，没有把两端所有字段宣称为逐字相同。Vue 会话建立时可正常取消旧 history GET，JSON 如实记录 `ERR_ABORTED`。

## Stage35 精确输入与结果

[Stage35 完整证据](evidence/2026-10-09-local-entry/stage35/summary.json) 保存三入口日志、4 次真实浏览器 JSON、源码清单、端口 cwd 与清理记录。实测选源 SHA `8933ed9f292a519a5b916e3b51daa5d25aa70562c0f17c098b6365b2be35e620`，2842 个选取源文件。它是本入口的广义源清单口径，不能与其他门禁不同选源方式的 SHA 直接比较。

执行过程中 root 仅新增文档校验工具 `frontend-vue/scripts/lib/git-file-inventory.mjs`，当前广义 SHA 因而为 `9e65b43666a142754752ec74722c5a7b78c03a9e4374b9a78ca563901f2681c7`。原 2842 项逐文件 SHA、隔离副本 SHA 均无变化；新增工具只有两处 tests consumer，不进入这三个应用入口的执行图。因此应用生产源一致，但不声称整棵当前源码指纹完全相同。精确差异见 [source-drift](evidence/2026-10-09-local-entry/stage35/current-source-drift.json)。

三个 browser 命令都 direct exit 0。开发入口完成后受控 Ctrl+C，工具 PTY 实测退出 1，make 日志记录 serve 子命令 Error 130；这一次不推断外层 make 返回 2。生产 serve 实测受控退出 130。三次均独立证明 3000/3100/8001 全部释放；执行期间监听进程 cwd 属于隔离副本，root 服务未被本次操作认领。生产入口完整构建后 40 秒就绪，没有跳过构建。

## 隔离与清理

- 源码副本无 `.git`，不被启动脚本当作原工作树或其他 worktree；不启动原 checkout。
- 原仓库受跟踪的 `.env`、`config.yaml`、`extensions_config.json` 未读取、未复制、未修改。副本使用空 env、公开 deterministic Replay/M0 配置、空 skills、独立 home 和 SQLite。
- `node_modules`、backend venv 是独立的 copy-on-write 副本。副本 venv 的脚本 shebang 与 editable `.pth` 已校准到副本；曾因复制后的旧 shebang 仍指向原解释器而失败的启动不算通过结果。
- Vue 在副本内显式使用 `.nuxt`，依赖缓存也归副本；React `.next` 同样独立。生产入口确实执行新 Nuxt build，未使用跳过构建选项。
- 最终重跑每次启动前确认 3000/3100/8001 无监听，退出后再次核实全部释放。进程 cwd 证明生产 Gateway/Vue 均属于副本；未操作根任务的 3240/3241/3242/3243/8140/8142 端口。初轮历史 3115/3116/8021 保护记录保留在初轮证据中。SIGINT 后启动脚本受控退出 130；开发入口外层 make 实际退出 2（日志明确 Error 130），生产入口直接调用 serve 因而退出 130。这不是启动/浏览器失败，端口释放另有独立记录。
- `DOCKER_HOST` 指向副本内不存在的 socket，防止清理脚本接触其他 Docker 栈。启动脚本输出的 Docker“none found/cleanup complete”不能证明 Docker 可用；本项 Docker 验收为 **UNRUN**，由专门的 Compose 门禁负责。

## 实际发现并修复的根因

### Vue/dual 入口错误要求宿主 Nginx

两个入口直接使用前端开发代理到 Gateway，启动脚本本来就不启动 Nginx，但通用 `scripts/check.py` 无条件检查 Nginx，导致实际 `make dev-dual` 在此前置检查失败。为 checker 加入明确的 frontend 模式，并只由这两个 Make target 传 `vue/dual`。默认 React 和通用检查仍要求 Nginx，其余 Node/pnpm/uv/config 检查保留。

实际 RED 及单元 RED 均已记录；相关 pytest **22 PASS**，Vue 文档引用检查 **18 PASS**。中英文 README 均明确区分仓库根目录检查与 Vue 模块命令。

### 冷启动首次导航触发 Vite 依赖重优化

首次真实 Vue 运行曾在导航时出现 ArtifactPanel、MessageMarkdownContent 动态模块 fetch 失败。Nuxt 默认只给 Vite 一个生成的入口，异步组件依赖被首次访问时才发现，重优化使浏览器已经拿到的模块 URL 失效。

读取当前 Nuxt/Vite 实现确认 Vite root 是 `frontend-vue/app`；使用标准 `vite.optimizeDeps.entries: ["**/*.{vue,ts}"]` 扫描实际 Vue/TS 入口。此前错误的 `app/**/*` 会落到 `app/app`，已舍弃。正式配置在首次浏览器访问前完成实际依赖扫描；正确配置下冷启动 Vue 与 dual 的真实 Replay 均通过，未出现访问后的新依赖优化日志。没有添加模块 fetch 重试、忽略页面异常或关闭 hydration。

## Stage33 证据与历史版本

全部可复核数据保存在 [Stage33 证据目录](evidence/2026-10-09-local-entry/stage33/summary.json)，包含每个入口的浏览器请求/状态 JSON、首次冷启动失败、优化扫描清单、构建启动摘要及清理前后端口记录。

历史 Stage33 选源为 2840 生产文件 SHA `2e8b17f53e9af4b570619efcdd867edb3d0c6509f589ee2852a6486861dda6a3`，包含最新 token/processing、滚动预留与 W11 公开导出 owner 修复。三个入口日志、真实浏览器数据、清理和逐文件副本 0 漂移位于 [Stage33 目录](evidence/2026-10-09-local-entry/stage33/)。生产入口完整构建后 Replay PASS，安全终止并保留 root 三个监听 PID。后续布局修复尚未纳入此 SHA，最终入口需用新源重新验收。

以下为保留的 Stage31 历史边界：Stage31 重跑采用当时刷新后的完整同源副本，包含此前 chat owner、上传锁、身份初始化、Stop 和原生菜单 reference 修复，也包含最新 setup/callback/safe-next 双端鉴权、MarkdownPre 生产别名、原生消息滚动和 tool header，以及七个能力回流源文件修复。三个入口使用同一选源；生产入口原样重新构建 Nuxt/Nitro并真实启动。结束后对 2839 个已登记生产文件逐一复核：原源码漂移与副本源码漂移均为 0，唯有已登记的副本 Nuxt buildDir 路径差异。

选源 SHA-256：`aef0ba499e80f9127aad32446efc7f3727ba9963f3747c952a7d2b29d7bde2fa`。计算口径和逐文件 hash 位于 [Stage31 历史源码清单](evidence/2026-10-09-local-entry/final/source.json)：git cached + others 的生产文件，排除运行 env/config、tests/docs、生成缓存和静态图片；该指纹不是其他门禁的不同选源指纹。副本仅为隔离缓存而覆盖 Nuxt buildDir 的绝对路径，已明确登记。Stage31 [历史汇总](evidence/2026-10-09-local-entry/final/summary.json) 包含四次浏览器执行（Vue dev、React dev、Vue dual dev、Vue prod）、三入口日志和清理证据；初轮结果另存 initial-summary.json；Stage29 原快照和全部旧结果另存 stage29/，不作为本次新源结论。

本报告只验收本地入口与真实 Replay 联调链路；完整双端 UI、全量单测、外部环境和生产切换仍以根任务各自最终门禁为准。
