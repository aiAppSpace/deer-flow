# DeerFlow Vue 前端

[English](README.md) | 简体中文

`frontend-vue` 是与 React 共存的 DeerFlow Nuxt 4 实现，与 `../frontend` 共用同一套
Gateway 接口，并已建立聊天工作区、产物、sidecar、浏览器控制、智能体、渠道、集成、
定时任务、设置、目标/模式、认证、Showcase、移动端布局和生产容器。

**这里不写完成度。** 某个能力做到什么程度，只能从代码、测试和门禁读出来；
任何写在散文里的"已完成"都会先于代码过期，然后被下一个读者当成事实。

生产环境目前仍由 React hostname 作为默认入口，只有 `DEER_FLOW_VUE_HOSTNAME` 选择
Vue。本地 parity 证据不代表可以直接切换默认入口；公网 DNS、TLS、外层代理信任、
真实 IdP callback 注册与目标环境验收仍需在生产切流前完成。

## 文档入口

- [ARCHITECTURE.md](ARCHITECTURE.md)：当前分层、运行数据流、状态所有权、代理与认证边界。
- [BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md)：修改时必须保留的产品、流式、顺序、
  缓存、面板与 Vue 语义。
- [REUSE.md](REUSE.md)：私有 `@deerflow/agent-core` 与可复用 UI 边界。
- [双前端生产说明](../docs/dual-frontend-production.md)：hostname、OIDC、验证和回滚。
- [I18N_INVENTORY.md](I18N_INVENTORY.md)：实时产品 SFC 文案清单、翻译/动态内容分类与
  source guard 边界。

## Docker 运行

在仓库根目录启动统一的 Docker 开发栈：

```bash
make docker-start
```

Vue 访问 `http://vue.localhost:2026`，React 仍访问 `http://localhost:2026`。两个前端都在
容器内运行框架开发服务器；Compose Watch 同步源码以触发 HMR，依赖清单变化则重建对应镜像。
命令会保持前台运行，使用 `Ctrl+C` 停止。

Vue 落地页的“进入工作区”按钮统一跳转到 `/workspace`，继续由现有认证、初始化和新对话路由负责
工作区准入，不创建第二套入口逻辑。

## 本地运行

在仓库根目录执行：

```bash
make dev-vue   # Gateway :8001 + Vue :3100
make dev-dual  # Gateway :8001 + React :3000 + Vue :3100
make stop
```

只运行 Vue 工作区：

```bash
cd frontend-vue
make install
make dev       # http://localhost:3100
```

如果希望 shell 留在仓库根目录，可使用等价命令 `make -C frontend-vue dev`。

## 验证改动

先运行与改动最相关的最小门禁，常规模块改动最终运行 `make verify`：

```bash
make verify             # lint、格式、类型、单测、i18n、OpenAPI、契约常量、独立性、build
make asset-budget       # 构建产物总量天花板（**不是**用户下载量）
make e2e-mock           # 不需要后端进程的全部套件
make e2e-backend        # 需要真实 Gateway 的全部套件
make e2e-visual         # 产品截图；只在本机，基线是 `-darwin`
make e2e-list           # 收集全部套件并打印各自 test 数
make consumer-check     # 修改 packages/agent-core 时运行
make container-smoke    # 生产镜像、health、SIGTERM 与拒绝策略
make coverage           # 单测行覆盖率——诊断用，刻意不作为门禁
```

`make audit` **今天预期就是红的**，分诊记在 `Makefile` 里那个 target 旁边：四个 high
里有三个够不着（`js-yaml` 进不到任何客户端 chunk；`nanoid` 那条要自定义生成器，本仓
没传；`lodash-es` 是经 mermaid 的 parser 进来的，而该 advisory 说的是 `_.template`）。
第四个——mermaid 的雷达图 DoS——**刻意不在这里修**：本应用把 `mermaid` 钉在 React 经
`@streamdown/mermaid` 解析出的同一个版本上，因为 mermaid 的产出要在两个应用之间对照
（`thread-history-mermaid` 是台账场景）。单边升会把台账劈开，两边一起升等于覆盖一个
vendored 库的依赖树。那次升级属于上游。

`make coverage` **不在** `verify` 里，也没有阈值。两个理由：覆盖率下限买到的是凑数的
测试；而且这个数字只看得见单测进程里执行过的代码——`app/layouts/`、`server/routes/`
与 `app.vue` 由 E2E 套件覆盖，在这里读作 0%。拿它去找**哪个模块没人测**，不要当及格线。
当前读数：语句 73%、行 75%，其中 `app/components/`（66%）是最大的缺口。

一个套件 = 一种后端拓扑，名字说的是**测什么**。迭代时挑最窄的那个：

```bash
make e2e                # mock Gateway 上的产品合同
make e2e-auth           # 认证 UI 合同，前端以 auth 开启构建
make e2e-infra          # 同源代理与 __m0 测试页
make e2e-proxy-options  # 关闭流式转发的代理
make e2e-stream         # 真实分块 SSE：心跳、续传游标、gap
make e2e-protocol       # 真实 Gateway 上的 run-protocol 状态机
make e2e-real           # 渲染、多 run 顺序、artifact 写入
make e2e-scheduled      # 真实 Gateway/SQLite 的定时任务
make e2e-channels       # channel 连接生命周期，auth 开启
make e2e-agents         # 自定义 agent 创建与设置，auth 开启
make e2e-settings       # 支持与降级两种 Gateway 下的设置
make e2e-shell          # workspace 壳层与 workspace-changes，auth 开启
make e2e-browser        # 真实 Chromium 后端上的 browser 面板
make e2e-external       # WebSocket 与 OIDC；需要 backend 的 browser extra
make e2e-parity         # React 与 Vue 架在同一个 replay Gateway 上；需要 ../frontend
make e2e-parity-auth    # 同样两个应用、但开着鉴权构建：登录页
```

`make e2e-mock` 聚合 `e2e`、`e2e-auth`、`e2e-infra`、`e2e-proxy-options` 与
`e2e-stream`；`make e2e-backend` 聚合 `e2e-protocol`、`e2e-real`、`e2e-scheduled`、
`e2e-channels`、`e2e-agents`、`e2e-settings`、`e2e-shell` 与 `e2e-browser`。
`make e2e-parity` 同样两边都不进，但理由不同：它是唯一需要兄弟 React 应用的套件，
而本工作区的 install、build、test 与 e2e 都必须在没有它的情况下跑通
（`make standalone-check` 静态证明，`make standalone-sim` 真做一遍）。
`../frontend` 缺席时它不启动 React，用例整组跳过。

不进聚合入口不等于不进 CI：`e2e-parity`、`e2e-parity-auth` 与 `icon-parity`
从 2026-09-17 起在 `.github/workflows/frontend-vue-parity.yml` 里跑，
那是唯一同时装两个应用 `node_modules` 的工作流。它带 `paths:` 过滤
（`frontend-vue/**`、`frontend/**` 与回放 Gateway 的输入），因为这三条要起两个
生产构建，成本是真的；**React 单侧的改动也在过滤里**——上游漂移把台账推动，
正是这把尺子要量的东西。
那份工作流设了 `PARITY_REQUIRE_REACT=1`：没有它，`../frontend` 不在 checkout 里时
156 条全跳过、退出 0，绿得和真绿一模一样。两半都由
`tests/guards/tooling-contracts.test.ts` 钉着，而且它扫的是
`.github/workflows/` **整个目录**而不是点名的那一份。

`make e2e-visual` 刻意两边都不进：截图基线只有 `-darwin` 一份，在生成并签入
`-linux` 基线之前，它是本机门禁。这两件事由
`tests/guards/visual-baseline-platforms.test.ts` 双向绑定：只签基线不接 CI 会红，
只接 CI 不签基线也会红。解除步骤、以及为什么不能在本机用 amd64 模拟生成基线，
写在那个文件的头注释里。

定向检查：

```bash
make parity-accept      # 对照差异变了之后重新记录 baseline/parity-diff.json
make parity-auth-accept # 同上，刷新 baseline/parity-auth-diff.json
make proxy-security     # Nitro body 限制、无 body/chunked DELETE、SSE 与 traversal
make i18n-source-check  # 全部产品 Vue SFC 的 AST 文案门禁
make standalone-check   # 不允许任何指向 ../frontend 的跨应用引用（静态证明）
make icon-parity        # 与 ../frontend 对图标/尺寸/变体；上游缺席时跳过
make standalone-sim     # 真把 ../frontend 移走，跑一遍声称能扛的东西，再移回来
make typecheck-core     # packages/agent-core 的独立 tsc
make upstream-drift     # 报告 ../frontend 自 marker 以来改了什么
```

**CI 实际跑哪些。** `frontend-vue-verify.yml` 跑 `verify`、`asset-budget`、`audit`、
`container-smoke`、`e2e-mock`、`e2e-backend`。有三条**只在本地**跑，理由各不相同：
`icon-parity` 是因为没有任何 workflow 会把两个应用的 `node_modules` 都装上；
`standalone-sim` 是因为它要把兄弟应用改名移出 checkout；`e2e-parity` 与 `e2e-parity-auth`
是因为它们都要把两个应用构建起来接回放 Gateway。**后两条是一个从来没有真正做过的成本决定**
——它们是默认只在本地，不是设计成只在本地。只有 `e2e-visual` 的「只在本地」是有机器和成因
绑在一起的（`tests/guards/visual-baseline-platforms.test.ts`）。

两条体积门禁量的不是同一个东西，别混：`make asset-budget` 把**全部**构建产物加起来，
管的是产物总量失控；用户真正下载的由 `make e2e` 里的
`tests/e2e/route-payload.spec.ts` 守——在真实导航里量浏览器请求的脚本，并禁止
shiki / mermaid / KaTeX 进入关键路径。两条命令都会打印当前实测值，**这里不抄**。
两者可以反向变动：KaTeX 改成按需加载后首屏少了 269 KB，产物总量却涨了 1 KiB。
调性能看后者。

这里刻意不写 test 数——`make e2e-list` 会打印每个套件的实时数字，而抄进散文里的
数字是最先过期的东西。本工作区文档里写出的每一条 `make` 命令、相对链接和仓库路径都由
`tests/guards/doc-references.test.ts` 校验；Makefile 里多出一个套件而这张表没跟上时，
它同样会红。执行 `make help` 查看完整目标列表。套件名说的是**测什么**，
不是迁移阶段；本地门禁全绿也不表达可平替差异的完成状态。

## 运行配置

浏览器默认使用同源请求，由 Nuxt 代理到 `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL`（默认
`http://127.0.0.1:8001`）。也可以配置公开 base URL，绕过对应的同源代理：

```bash
NUXT_PUBLIC_LANGGRAPH_BASE_URL=http://localhost:8001/api
NUXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8001/api
```

`DEER_FLOW_AUTH_DISABLED=1` 只用于隔离的合同测试环境。真实认证必须通过同源的
Nuxt/Gateway 链路验证。`NUXT_PUBLIC_M0_TEST_PAGES=1` 只为测试开放内部视觉 fixture；
变量名为了兼容现有测试配置而保留。

生产路由、OIDC callback 规则和回滚命令统一维护在
[双前端生产说明](../docs/dual-frontend-production.md) 中。

## 浏览器控制

面板默认进入 Live；切到 Static 时保留最后可见帧，Live transport 不可用时使用 Gateway
REST 导航。URL/title 只接受 Gateway WebSocket 事件或 REST 响应。关闭面板、切换线程或
feature 禁用都会停止重连 timer、socket 和未完成 REST。详细所有权与输入/清理硬合同见
[ARCHITECTURE.md](ARCHITECTURE.md) 和 [BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md)。

## Artifacts

Artifact 能力只由显式的路径/source 策略决定：已知 UTF-8 文本和代码可加载，图片、音频、
视频与 PDF 使用专用预览；Office、archive、SVG、无扩展名和未知二进制一律 fail closed 为
仅下载。MIME 元数据不能把未知文件提升为可编辑文本。正式 HTML 只有完整加载并通过文档
完整性检查后才创建预览。

只有 `/mnt/user-data/outputs` 下完整加载且带 SHA-256 修订的正式 UTF-8 文件可以编辑。
保存携带已加载修订；Gateway 冲突或权限错误会保留本地草稿。dirty 草稿统一保护切文件、
关面板、切线程、路由离开和页面关闭。打开与下载会先执行带认证的一字节 Range 预检；
安装 Skill 只对真实 skill artifact 和具备管理员权限的当前用户开放。

## 定时任务

工作区定时任务页面支持 Gateway 实际拥有的 `once` 与 `cron` 类型、
hourly/daily/weekly/monthly/custom cron、可编辑 IANA 时区、DST-aware 单次时间转换、
新建 thread 或复用现有 thread 的 context，以及内置 recipes。编辑时保持 schedule type
不可变；暂停、恢复、立即触发和二次确认删除分别使用 Gateway 的专用 endpoint。筛选覆盖两种
类型和全部六种 task 状态；运行历史使用明确的 `limit/offset` 分页，并展示全部 run 状态、
时间、thread/run ID 和错误。

`make e2e-scheduled` 会启动真实本地 FastAPI Gateway、SQLite、Nuxt preview 与
Playwright Chromium，覆盖真实 once/cron 创建与校验、context/thread 权限、PATCH、
pause/resume、trigger、分页 run 记录和 delete。模型侧使用签入的 replay fixture，认证也处于
测试隔离模式；该门禁不证明生产 scheduler/模型、真实时间推进、DNS/TLS、外层代理信任或
真实 IdP。

## Channels

Channel provider 只描述服务端能力与运行时配置，不拥有用户连接状态。当前认证用户的
`/api/channels/connections` 响应是连接状态和账号 instance 的唯一真相，同一 provider 可同时
展示多个账号。Connect 会精确消费 Gateway 的 URL、instruction 与有限 expiry：deep link
通过同步预开的浏览器窗口打开，轮询只观察当前用户 scope 下的 connections，直到新增账号
成功、过期或取消。query、mutation、poll 与 AbortController cleanup 全部由
`useChannelConnections` 独占。

Settings 明确区分两种破坏性操作：用户按准确 connection ID 断开单个账号；管理员移除
provider runtime 配置，该操作会在实例级撤销此 provider 的有效连接。
`make e2e-channels` 使用受控外部 worker/callback fixture，真实验证
FastAPI/Auth/CSRF/SQLite 路由与 Vue 收敛；它不证明 Slack、Telegram、Discord、Feishu 等
真实平台授权、生产凭据、真实 deep-link handler、DNS/TLS、外层代理或真实 IdP。

## Agents

Agent 创建在 bootstrap 期间保留 new-agent 页面，同时把预先创建的真实 thread 作为可见流
scope。Save 只发送一条隐藏 human 指令，再将名为 `setup_agent` 的
`AIMessage.tool_calls` 与相同 `ToolMessage.tool_call_id` 关联；只有明确的
`status: "success"` 才进入有限可见性验证。tool/run 错误和耗尽 404 重试都会保持可见且可重试；
重复点击复用同一个在途 owner，路由或 scope 销毁会同时中止 run 和有界的
`GET /api/agents/{name}` 验证。初始 design conversation 成功且 send owner 完整释放前，
Save 始终保持禁用。

Gallery 和模型目录的服务端状态分别只归 `useAgents`、`useModels`。设置从真实模型响应选择，
精确提交 `model`、`model_settings`、`thinking_enabled`、`reasoning_effort`，包括显式
`false`、数值零，以及切换到不支持 capability 的模型时用 `null` 清理旧配置。卡片保留
skills/tool groups 的响应顺序和重复项；`tool_groups: null` 明确显示为不限制已配置分组，
`[]` 明确显示为没有配置分组。

`make e2e-agents` 真实经过 FastAPI Auth/CSRF/features/models、thread/run router、
LangGraph、`setup_agent`、SQLite Agent 持久化、用户隔离和 Vue UI 收敛；只有外部 LLM
被确定性模型替换。该门禁不证明生产模型/provider、生产模型凭据、真实 IdP、DNS/TLS、
外层代理或生产部署。

## Memory 与管理员设置

Memory 是用户隔离的服务端状态，只由 `useMemory` 持有。页面支持搜索、confidence 筛选、
精确的 `0`～`1` confidence 编辑、导出，以及带确认的新增、编辑、删除与清空，不在组件内
复制 Gateway 响应。导入只接受完整 export 结构，并先展示覆盖预览。malformed、storage
不接受的 fact 和重复 fact ID 会在请求前拒绝；未知字段及不同 ID 的重复 content 会保留到
预览并明确警告。Gateway 按请求模型校验时可能忽略 forward-compatible 未知字段。

普通认证用户可以读取 Skills，但只有管理员可以启停；MCP 配置的读取和写入都只允许管理员，
因此 session 已证明是普通用户时，Vue 不会发送 MCP 请求。auth-disabled 合同环境沿用
Gateway 的管理员语义，不额外发明 static role。每次 mutation 只发送文档定义的字段，成功后
重读共享 TanStack Query 缓存；权限错误与未认证、普通传输错误分别展示。

`make e2e-settings` 通过 Nuxt 与 Playwright Chromium 真实经过本地 Auth/CSRF、
FastAPI router、用户隔离 DeerMem、独立真实 Noop manager、skill discovery/config write、MCP
原子配置写入和 secret masking，并固定 malformed 422、校验 400、missing 404、duplicate 与
revision-conflict 409、corrupted-storage 500、unsupported 501。fixture 只 seed operator-owned
skill/MCP 输入文件，并仅为损坏后恢复自身 manifest 的断言暴露本轮隔离临时 home。该门禁不
证明 Mem0/Honcho/OpenViking、真实外部 MCP 进程、生产 SkillScan/LLM/IdP/凭据、DNS/TLS、
外层代理或部署。

## Workspace 壳层与 Workspace Changes

workspace layout 只持有一个 command palette、settings host 和 toast store。palette 实现
React 当前跨平台快捷键集合，并排除 repeat、IME 和 editable target 冲突。Settings 由路由
持有：`?settings=<section>` 打开具备 focus trap 的 dialog，关闭只移除该 query key，浏览器
前进/后退恢复同一深链和焦点边界。Gateway unavailable 与 authenticated recovery 共用唯一
session Query owner，包括路由 middleware 先于 banner 挂载写入 unavailable 的时序。

每个 recent-thread menu 独立持有 rename、pin、share、export 和 delete 状态。Share 沿用纯
客户端稳定 URL/clipboard 合同，不发明 Gateway endpoint；Export 先加载真实 thread state，
再调用已有 serializer，并始终释放临时 anchor 与 object URL。列表 recency 只从 Gateway
`updated_at` 渲染。

Workspace-change summary/detail 使用独立 TanStack Query identity，完整包含 thread、run 和
两个 include flag。identity 切换会中止旧请求，late response 不能覆盖当前结果。UI 保留 summary
truncated、四种 status、五种精确 diff unavailable reason、保真 Gateway error 与显式 retry。

`make e2e-shell` 通过 Nuxt 与 Chromium 真实经过本地 Auth/CSRF/FastAPI Gateway、
thread/checkpoint、run-event store、production owner check 和 workspace-changes response builder。
隔离的 test-only seed 只向 Gateway 自身 event store 写一条受控 workspace event；include 过滤、
状态/reason 保留、认证、跨用户拒绝、thread state、clipboard 和下载仍是生产路径。唯一注入的
503 只用于证明 unavailable 到真实 session 的恢复；该门禁不证明生产 IdP、DNS/TLS、外层
代理或部署。

## 流式与历史行为

聊天 run 显式订阅 `values`、`messages-tuple`、`updates` 和 `custom`。task 生命周期与
`llm_retry` custom 事件统一折叠为 thread-scoped UI 状态；子任务卡片展示状态、模型、累计
token 和实时步骤，刷新后展开卡片可回填持久化步骤。长会话初次只请求最新一页历史，只有
显式按钮或用户向上滚动后才加载更早页面。已建立会话的 `/compact` 会调用真实 Gateway
接口；Gateway 拒绝时保留草稿并展示原始错误。

消息、reasoning 与 processing 文本统一经过一个产品 Markdown 适配器，真实天气 GFM 表格和
流式半成品不会因调用点不同而退化。表格复制/下载/全屏与消息操作按 React 当前调用点对齐；
React 未启用反馈入口时，Vue 也不显示点赞/踩。
