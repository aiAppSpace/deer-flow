# Vue 容器入口隔离验收

当前验收：2026-10-10 Stage35 两端 canonical 镜像、三条真实入口与正式 smoke/SIGTERM 全部 direct exit0；精确源码、镜像ID、实测和边界见 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-container-ingress-stage35-final.md`。完整 cross-app 与外部环境由独立门禁证明。Stage33及此前PASS都是对应旧源码的历史checkpoint，Stage34仅Vue中间镜像构建通过，均不外推当前源。

本文件是可执行步骤，不把单镜像 smoke、配置收集或静态检查当作入口验收通过。

## 代码所定义的实际拓扑

公开入口复用 `docker/nginx/nginx.conf`：Vue hostname 的 HTML/静态资源到 Nuxt，
默认 hostname 和未知 hostname 到 React；`/api/*`、认证、SSE、浏览器 WS 直接到 Gateway。
`/api/langgraph/*` 重写为 Gateway 的 `/api/*`。因此公开 API 不经过 Nuxt。
Nuxt 自身的内部 HTTP 代理另从容器内验收，明确配置 `NUXT_GATEWAY_INTERNAL_BASE_URL`。
生产 Compose 当前没有给 Vue 声明该变量；公开 nginx 拓扑本身不依赖这条内部代理。

本机 Node 解析 `vue.localhost` 实测 ENOTFOUND，而 Chromium 自行解析 `.localhost`。
公开探针的 setup/register 使用 127.0.0.1 与实际 Vue Host header，随后登录、偏好、上传下载、
SSE 与 WS 全走真实浏览器 Vue origin。没有修改系统 hosts、模拟 DNS 或拦截 API。

只读库存核对时 Docker 正在运行 `deerflow-vue-linux-gates`（无发布端口）与 Verdaccio
（127.0.0.1:80/4873）；没有运行现有 DeerFlow stack。2326 当时未监听，实际启动前仍须重查。
本流程不停止、重建或清理这些现有容器。

当前独立运行配置位于
`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docker/.cache/container-ingress-stage26`。
旧 project `deerflow-vue-ingress-efe3721b8a` 已按其独立 manifest 停止并移除；其
`frontend-vue/test-results/container-ingress-final-stage22` 配置不可继续使用。准备器拒绝自动清理目录，
新配置必须在独立、未存在的目录生成。Source copy 位于 `/private/tmp/deerflow-ingress-source-stage21-g9qsangd`（目录名沿用，实际已刷新为Stage35并由此构建双镜像）。Vue899输入SHA256 `36bf1b0b39a5f8c55f29e7674790eec803e5fd82979eb20abeafc2bc64061b85`；React812输入SHA256 `b54a93e8be7ab136cf22fc8b1a9c57ab73da9a11d815451a8fab549a9e3db114`。逐文件清单见 `2026-10-10-container-stage35-source-fingerprint.json`；生成缓存/私有配置未复制，构建前后及探针/smoke后选源字节零差异。当前运行前端是Stage35镜像，实际ID与构建receipt一致。Stage33及此前指纹保留为历史证据。

## 隔离边界

`frontend-vue/tests/support/prepare_container_ingress.py` 从当前生产 Compose 深拷贝四个服务，
保留实际 nginx launcher/template，然后生成唯一 `deerflow-vue-ingress-<UUID>` project、
唯一容器名和独立 network。仅发布 127.0.0.1:2326；前端和 Gateway 不发布端口。
它不会调用 Docker、构建镜像或启动服务，不覆盖既有输出目录。

独立 home、空 dotenv、空 MCP/skills、SQLite、一次性 JWT secret 和 replay model 均只在
输出目录使用。tracked `.env/config.yaml/extensions_config.json` 不读入也不修改；没有
真实 MCP、IM、Redis、Provisioner 或远程模型。API/auth/SQL/CSRF/owner 和浏览器 runtime
仍是实际生产实现。生成的 compose 含一次性测试 secret，权限为 0600，不应把全文作为证据。

SSE 阶段复用已有 M0 replay provider 的 2 秒首轮空闲窗口，要求浏览器在最终输出前收到
metadata，且至少分两次读取。浏览器工具会改变模型 prompt，因此 WS 是第二阶段：先完成
replay/SSE，再仅重建此 project 的 Gateway 配置。第二阶段不运行 replay，不忽略 replay miss。

## UI 稳定后的执行步骤

以下命令从仓库根目录执行。镜像须来自最终代码；不要用旧同名镜像充当本次证明。
`INGRESS_ACCEPTANCE_DIR` 选仓库内未存在且 gitignored 的独立绝对路径，保留证据直到最终审查结束。不得放在 Playwright 自动清理的 `test-results` 或 `playwright-report` 下。

```bash
INGRESS_ACCEPTANCE_DIR="$(pwd)/docker/.cache/container-ingress-final"
backend/.venv/bin/python frontend-vue/tests/support/prepare_container_ingress.py \
  --output "$INGRESS_ACCEPTANCE_DIR" --port 2326 \
  --vue-image deerflow-ingress-vue:final \
  --react-image deerflow-ingress-react:final \
  --gateway-image deerflow-ingress-gateway-browser:final

# 先确认该端口仍空闲，以及现有容器没有被本流程替换。
lsof -nP -iTCP:2326 -sTCP:LISTEN
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
docker build -f frontend-vue/Dockerfile -t deerflow-ingress-vue:final .
docker build -f frontend/Dockerfile --target prod -t deerflow-ingress-react:final .
docker build -f backend/Dockerfile --build-arg UV_EXTRAS=browser -t deerflow-ingress-gateway-base:final .
docker build -f "$INGRESS_ACCEPTANCE_DIR/Dockerfile.browser" \
  --build-arg BASE_IMAGE=deerflow-ingress-gateway-base:final \
  -t deerflow-ingress-gateway-browser:final "$INGRESS_ACCEPTANCE_DIR"

docker compose -f "$INGRESS_ACCEPTANCE_DIR/compose.json" config --quiet
docker compose -f "$INGRESS_ACCEPTANCE_DIR/compose.json" up -d --wait

# 原始 nginx 公开拓扑：真实 Vue UI 登录、默认 React、API、2MiB 上传/下载/range、增量 SSE。
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy \
  python3 scripts/pnpm.py --dir frontend-vue exec node \
  tests/support/probe_container_ingress.mjs "$INGRESS_ACCEPTANCE_DIR/metadata.json" replay

# Nuxt 私网 HTTP 代理：真实登录/CSRF/owner、API、上传下载/range、增量 SSE；不发布 Nuxt 端口。
docker compose -f "$INGRESS_ACCEPTANCE_DIR/compose.json" exec -T \
  -e INGRESS_PUBLIC_ORIGIN=http://vue.localhost:2326 frontend-vue node --input-type=module \
  < frontend-vue/tests/support/probe_nuxt_container_proxy.mjs \
  > "$INGRESS_ACCEPTANCE_DIR/evidence-private-nuxt.json"

# 使用同一 SQL/home/JWT，只为真实 browser REST/WS 增加工具配置。
docker compose -f "$INGRESS_ACCEPTANCE_DIR/compose.json" \
  -f "$INGRESS_ACCEPTANCE_DIR/browser.overlay.json" up -d --no-deps --wait gateway
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy \
  python3 scripts/pnpm.py --dir frontend-vue exec node \
  tests/support/probe_container_ingress.mjs "$INGRESS_ACCEPTANCE_DIR/metadata.json" browser

docker compose -f "$INGRESS_ACCEPTANCE_DIR/compose.json" logs --no-color \
  > "$INGRESS_ACCEPTANCE_DIR/compose.log"
docker compose -f "$INGRESS_ACCEPTANCE_DIR/compose.json" down --remove-orphans
```

无论中间哪一步失败，停止后都只能对上面生成的 `compose.json` 执行清理；不执行默认
Compose project 的 down，也不使用 Docker prune。后台返回异常或不支持 browser extra
必须修复环境/根因并复验，不能把 WS 4404、仅 open 事件、空二进制帧当成功。

## 审查证据

公开探针写 `evidence-replay.json`、`evidence-browser.json` 及各阶段截图；其中没有 Cookie、
密码、PAT 或原始认证头。私网探针成功才写 PASS，并记录 SSE 分片/时序。错误时须保留 stderr
和 Compose 日志，三份 PASS 缺一不可。随后复查独立 project 已停止、现有容器仍在。

正式结论还须记录三个镜像的 image ID、最终工作区代码版本/WIP 状态，以及实际执行日志；
准备器的单测只证明生成配置隔离和真实 nginx 复用，不证明 runtime 行为。

这套证据只覆盖本地 Docker 入口与离线 replay；DNS/TLS、外层反代、真实 IdP、真实模型和
真实第三方 IM 的生产接入仍属环境侧验收。

## 渠道 fixture 告警审查

stage13 的渠道浏览器三例通过，但 Gateway 日志出现
`_ExternalChannelServiceFixture` 缺少 `get_channel`。生产启动流程读取该接口以创建
scheduled-task notification worker，异常会断开 outbox enqueue，因此三例 UI 通过不能
作为定时通知已覆盖的证据。

修复仅在 `backend/tests/channel_e2e_fixture.py` 补真实接口形状：没有 external adapter
就返回 None。新增 `backend/tests/test_channel_e2e_fixture.py` 先复现 AttributeError，
再使用真实 worker/SQL 仓储证明启动、停止、缺 adapter 时保留 pending、attempts=0、
未来可再次 claim。当前只有 WeCom 支持主动通知，测试不把 Slack/Telegram readiness
或受控 binding callback 说成实际 IM delivery。

Focused backend：95 PASS，`/private/tmp/deerflow-channel-fixture-green-stage13.log`；红测
证据为 `/private/tmp/deerflow-channel-fixture-red-stage13.log`。Canonical backend blocking-I/O
235 PASS（两条第三方 websockets 弃用 warning），lint/format PASS（1958 files），分别见
`/private/tmp/deerflow-backend-blocking-stage14.log`、`/private/tmp/deerflow-backend-lint-stage14.log`。
完整 backend `make test TEST_JOBS=2` 已执行全部四分片：26984 PASS / 451 skipped / 4 FAIL，
日志 `/private/tmp/deerflow-backend-full-test-stage14.log`。两例是 scheduler 测试 double 继承外层
`TEST_JOBS=2`，一例是 CI 守卫仍把必跑 Linux visual 当 local-only，一例是 memory judging
测试的 host LLM 构造读取 operator AppConfig 并覆盖临时判断配置。这些测试边界和事实守卫
已按根因修复，真实行为断言保留；109 focused PASS，日志
`/private/tmp/deerflow-replay-env-final-stage14.log`。主任务随后 Stage20 最终完整 backend 已实际通过：26997 PASS / 451 skipped，blocking-I/O 235 PASS，Ruff lint/format 1959 files PASS；此前 Stage14 失败作为历史诊断保留，不改称通过。

同次新增 replay runner 的 5 种真实配置子进程回归（default/seed/Agent/channel/settings）：
空 dotenv、独立 project/home/SQL、固定 fixture JWT，丢弃环境中的 provider/proxy/私有配置；
保留显式 suite/auth/settings 控件。先 5 FAIL 后 5 PASS，分别见
`/private/tmp/deerflow-replay-env-red-stage14.log`、`/private/tmp/deerflow-replay-env-green2-stage14.log`。
子进程只在 uvicorn serving 边界停下，不把它当浏览器/外部服务验收。
追加启动 sys.path 注入回归先 FAIL，随后全部 109 focused PASS；仅清 PYTHONPATH 环境值
不能移除 Python 启动时已经生效的导入路径，runner 同时移除这些父级路径并保留可信 fixture 目录。

## 历史构建网络诊断（Stage22–25）

默认 UV 源 `ghcr.io/astral-sh/uv:0.11.1` 在获取 token 时 EOF。使用 Dockerfile 已声明的 `UV_IMAGE` 参数，专属 tooling image 仅从本机 image 提取并核验同版 uv 0.11.1；backend 产品源码与锁定依赖仍从独立 source copy 重建，没有复用旧产品代码。Vue Dockerfile frontend 的首次 metadata token EOF 原命令重试后成功。

Gateway 首次实际 build 在 Debian apt 下载阶段收到 Docker static HTTP proxy `127.0.0.1:1082` 的 500 EOF/503；保留 `/private/tmp/deerflow-ingress-gateway-build-stage22.log`，原命令精确重试中。默认 GHCR 与这一轮 apt 的网络错误不算生产 runtime 失败，也不算镜像构建成功。不得通过更改用户 Docker 全局代理、复用旧 Gateway 产品镜像或跳过真实 WS 掩盖。

默认 Debian 源原命令重试仍卡 package index；只读探针实测镜像源 index/security metadata/原失败 deb URL 均 200（0.04–0.13 秒）。继续使用 Dockerfile 已声明的 `APT_MIRROR=mirrors.aliyun.com` 参数，未修改 Dockerfile、产品源码、全局 Docker 代理或 tracked config。随后 8.7MB index 已实际取回，最终构建结果仍以退出码为准。

进一步完整 GET 吞吐探针发现 Ali 镜像约 75KiB/s，而 USTC 同一 8,689,464-byte package index 实际 200 / 1.69 秒（5.14MB/s），security metadata 200 / 0.11 秒。终止本任务 Ali 构建，仍用同一既有 `APT_MIRROR` 参数切到 `mirrors.ustc.edu.cn`；日志 `/private/tmp/deerflow-ingress-gateway-ustc-build-stage24.log`。这是构建下载环境选择，不变更产品或任何门禁断言。

当前 Stage23 前端 image 仅用于现有隔离入口链路定位；主任务后续正在修复的小屏/字体缩放与 React owner 变更尚未纳入，最终须增量刷新两端镜像并对最终版本复验，不能把旧UI链路当最终源码验收。

## Stage25 HTTPS 构建入口根因修复

实际同构入口为四处：backend、provisioner、Lark init 与 Lark broker。原 APT_MIRROR 只替换 hostname，因此传完整 HTTPS 地址会拼成错误 URL，无法避开本机 Docker HTTP 代理路径的 apt 503。真实对照中，HTTP 默认与禁用 pipeline 均失败（排除 pipeline 假设）；curl 相同 URL/相同 APT User-Agent 成功；同源仅改为 HTTPS 后 apt update +七个包全部通过。最终 canonical Gateway 的127系统包/约100MB已实际取回，uv --locked 原依赖全部安装，并构建成功：image `deerflow-ingress-gateway-base:stage25`，ID `sha256:22da4bc1a2336f93ee0b293405bb6ded120c46216b49430dbb6763617a346d12`，日志 `/private/tmp/deerflow-ingress-gateway-https-build-stage25.log`。

四个 Dockerfile 现在接受完整 http(s) base URI，并保留原 host-only 的 scheme；空值不改源，IPv4/IPv6/port/path prefix 可用，非法协议、credential/query、shell/sed控制字符、换行与无效端口在改写前拒绝。实际 shell 回归本机86 PASS、GNU/Linux86 PASS。旧 GNU 实现56 FAIL /16 PASS，证明 URI 与拒绝语义确实缺失。初始红测曾因提取器截断和 macOS sed -i 语法差异误报，已明确排除，未拿其72 FAIL当产品根因证据。

两个精简 Debian builder 实测没有初始CA bundle，现只从仓库已有固定 Python base复制公共CA roots，再照常安装原ca-certificates包，没有加入Python运行时或关闭TLS。实际 Lark init builder 前缀（截至安装CA/curl，不下载CLI）HTTPS build PASS：`deerflow-ingress-lark-trust:stage25`；日志 `/private/tmp/deerflow-lark-https-trust-stage25.log`。这不声称完整Lark CLI镜像或外部IM已验收。

测试用 browser派生层仍使用真实 Playwright `install --with-deps chromium`；准备器直接复用 backend Dockerfile 的同一 validated APT_MIRROR step，避免第五份复制逻辑漂移。前置回归先1 FAIL，再 ingress fixture +doc-facts+collector共23 PASS；日志 `/private/tmp/deerflow-artifacts-focused-stage25.log`。最后完整backend/full/blocking/lint由主任务重新执行，本次focused不能代替。

## 隔离运行目录生命周期回归

Stage25 首次 Compose `up --wait` 在 Gateway `/state/.env` 显式不存在处失败。宿主目录与只读独立容器都核验 home 为空，产品配置读取器正确拒绝缺失文件；没有修改产品配置加载逻辑。原配置目录处于 Playwright 输出树，其他 suite 清理输出可删除仍在使用的 bind mount 内容。准备器在任何写入前拒绝 React/Vue 的 `test-results` 与 `playwright-report`（包含子目录与解析后的符号链接），运行状态改放已忽略的 `docker/.cache`。4 条负向回归先实际 FAIL，修复后既有正向隔离断言与 4 条负向共 5 PASS，日志 `/private/tmp/deerflow-ingress-runtime-location-{red,green}-stage26.log`。此回归仅证明生命周期隔离，不代替 Compose 真实启动。

## Stage26 实际入口验收结果

专属 project `deerflow-vue-ingress-00aff39027` 的 Gateway/双前端真实 healthy，Nginx running（canonical 镜像无独立 healthcheck，以公开探针验收）。公开 Nginx 探针 PASS：Vue hostname 真实 UI 登录、HttpOnly cookie、CSRF 与 owner 负向校验、偏好 SQL 持久化，默认/未知 hostname 返回 React，2 MiB multipart 上传及逐字节下载、206 range，未压缩 SSE 17 chunks（首片 404 ms / 总计 2613.6 ms）与实际 replay 产物内容。Nuxt 内部 HTTP 代理 PASS：真实 register/login、CSRF/owner、模型与 LangGraph rewrite、文件上传/下载/range、SSE 17 chunks（首片 16.52 ms / 总计 2159.02 ms）及精确产物。第二阶段真实 browser navigate 返回截图，原生 WS 握手后收到 77352-byte 二进制帧，原生 close 事件实测 1000。没有 DNS、API、Notification 或 WS 模拟。

首次公开探针漏 GET preferences 所需 expected-owner header，修复后明确断言 200 才读 mode；首次内部探针使用 Node fetch 自定义 Host，实际 Node22 忽略该 header（临时 HTTP server 已回显核验），修复为原生 node:http 发送真实 public Host/Origin，并保留 ReadableStream。两次失败均记录为验收脚本缺陷，不修改产品 Origin/CSRF 校验或弱化断言。三份脱敏 PASS 与两张实际截图保存在 `docs/reports/evidence/container-ingress-stage26/`；完整 image ID、探针哈希与当前源边界见 `docs/reports/2026-10-09-container-ingress-stage26-evidence.json`。

两张截图均已人工回读，真实登录后的工作区正常渲染；它们证明容器页面可用，不替代最终 Linux 八项视觉基线验收。生产 UI 后续变更尚未纳入本轮 Stage23 前端 image，最终源版本必须增量重建两端并复验。

验收后仅按本专属 manifest 执行 `down --remove-orphans`，四个验收容器与独立 network 已移除；只读复核现有 `deerflow-vue-linux-gates` 与 Verdaccio 仍运行，未使用默认 Compose down 或 Docker prune。一次性 secret/SQL 原件留在 gitignored 的独立运行目录，未进入报告。

## Stage28 稳定快照的真实复验

两前端已由当前独立源码重新 canonical build（Vue包括authDisabled selector根因修复及upload锁，React包括此前reflow/owner修复与最新锁定依赖），均成功。源输入指纹见 `docs/reports/2026-10-09-container-stage28-source-fingerprint.json`。复用专属project的真实Gateway和Chromium镜像，没有重造旧前端产物、没有改tracked运行配置。

Gateway与双前端均真实healthy，Nginx为running（canonical镜像无独立healthcheck，另以真实public HTTP探针验收）后，三条原严格探针再次全部PASS：public Nginx→Vue/Gateway真实UI登录、HttpOnly、CSRF、expected-owner、2MiB multipart及精确下载/206、17chunk未缓冲SSE（first31.9ms,total2341ms）与精确replay产物；private Nuxt代理同样全部PASS（17chunks,first570.07ms,total2944.21ms）；public Cookie/Origin native WS upgrade、77292字节真实Chromium binary frame、实际native onclose1000。default及unknown hostname仍返回React，只有loopback2326公开。两张当前workspace截图已逐图回读，不能由此声称完整跨端UI或远程浏览器面板渲染验收。

本次最初private probe被提前启动于Gateway starting期间，严格502失败日志保留；等Compose --wait与真实health通过后，原探针原断言完整重跑PASS。没有修改产品超时/CSRF或以额外请求兜底。

Stage28通过后主任务又以真实session发现Stop取消owner问题，cap发现DropdownMenuContent anchor问题，二者正在根因修复。因此本段仅证明所记录Stage28快照，**不称后来生产源码最终已通过**；专属Gateway保持运行，待这两处修复稳定后精准刷新前端并重跑实际入口。持久证据为 `docs/reports/2026-10-09-container-ingress-stage28-evidence.json` 和 `docs/reports/evidence/container-ingress-stage28/`。


## Stage29 精确源码与正式生命周期验收

Vue 已精准纳入 ChatComposer Stop 取消 owner 与 DropdownMenuContent native trigger anchor 两处修复并 canonical build PASS。React 与 Stage28 的 810 个输入完全相同，因此复用该精确源码镜像；Gateway/Chromium 也复用原专属镜像。执行时原 checkout 与 source copy 的全部已记录构建输入逐文件 SHA 均无漂移。最终 Vue image ID 为 `sha256:ef5352d4e0e5f5b7b4e91795750a60c516ded5797199f9e508f5fad1a6768eee`。首次构建仅因官方 Dockerfile frontend token TLS handshake 超时在 Dockerfile 前失败，原 canonical 命令精确重试成功，未修改 registry、代理或锁定依赖。

等 Compose `--wait` 真正退出后，三条原严格探针全部 exit 0：public Nginx 真实 UI 登录/HttpOnly/CSRF/owner、2MiB 上传与精确下载/206、17 chunks SSE（first 34.2ms / total 2340.8ms）和精确 replay 产物；private Nuxt HTTP 代理同契约与 17 chunks SSE（first 78.48ms / total 2539.58ms）；public native Cookie/Origin WebSocket 收到真实 Chromium 77238-byte binary frame，实际 onclose 1000。默认/未知 hostname 仍返回 React，仅 127.0.0.1:2326 公开。两张当前工作区 PNG 已逐张回读；这只覆盖容器入口页面，不替代跨端视觉全套。

正式 `frontend-vue/scripts/container-smoke.sh deerflow-ingress-vue:stage29-final` exit 0，覆盖 non-root、health、最小产物、真实 Showcase HTML/manifest/JPG/allowlisted artifact、三类 404 及退出生命周期。另只读核实该唯一 smoke 容器的 Docker 实际事件：kill signal 15 → die exitCode 0 → destroy，未出现 signal 9；没有仅凭 exited 状态推断 graceful shutdown。

仅按专属 manifest `down --remove-orphans` 后，四容器及专属 network 已移除；既有 Linux/ Verdaccio 两容器的 ID 相同且仍运行。独立 fixture/home/SQL、镜像和构建缓存保留，可供后来 auth 域增量复验，不必重建 Gateway。随后确认的双端 setup/callback/change-password locale/UI 变更尚未纳入本快照，故本段不是后来代码的最终通过声明。完整脱敏证据、三份 JSON、实际日志、两图与 Docker events 在 `docs/reports/evidence/container-ingress-stage29/`，汇总见 `docs/reports/2026-10-09-container-ingress-stage29-evidence.json`。

最新完整 backend Stage26 实际执行 27088 PASS / 451 skipped，blocking-I/O 235 PASS、Ruff lint PASS、format 1960 files PASS；日志 `/private/tmp/deerflow-backend-full-final-stage26.log` 与 `/private/tmp/deerflow-backend-blocking-lint-final-stage26.log`。这替代前文历史 Stage20 数字作为当前已执行 backend 证据，不改变旧失败记录。


## Stage30 最终冻结源码的真实复验

两个 canonical image 均由独立副本重新构建并 exit 0，包含 auth 页面双端 locale/UI 与 MarkdownPre 显式局部别名修复。Vue image ID `sha256:4b64788bb5ee055fc0892c92938cb7c72592ec2f76d41186cea8485a67bcffe6`；React image ID `sha256:e1fdc23ff45c6a368879d833a9139cc1f4e3d0cefe5e48bd1c4f5aba5e18a4eb`。Gateway 生产 app/harness/extension-api 与 Docker/lock 等 892 个源码文件、两份 package metadata 在当前目录与副本中无漂移，复用原 Gateway/真实 Chromium 镜像。私有配置和原构建缓存未读取或改动。

Compose `--wait` exit 0 后三条原探针完整通过：公开 Vue hostname 的真实 UI 登录、HttpOnly、CSRF/owner、偏好持久化，默认/未知 hostname 的 React 分流，2MiB multipart 与逐字节下载/206，增量未压缩 SSE 16 chunks（first 157.9ms / total 3918.1ms）和精确 replay 产物；私网 Nuxt 同真实契约，SSE 17 chunks（first 735.67ms / total 3320.05ms）；公开 native WebSocket 收到 77265-byte 真实 Chromium frame，原生 onclose 1000。网络读取 chunk 边界可合并，记录实测数量而不把它当 SSE 事件数。两张当前工作区截图逐张回读无异常，但不代替完整视觉门禁。

正式 `container-smoke.sh deerflow-ingress-vue:stage30-final` exit 0，non-root、health、最小产物、真实 Showcase 与资源允许表、三类404全部通过。唯一 smoke 容器的真实 Docker 事件再次验证 signal15 → die0 → destroy，未出现 signal9。完整证据保存在 `docs/reports/evidence/container-ingress-stage30/`；静态准备或旧轮次 PASS 没有代替本轮执行。

专属 Compose 目前暂留给 root 完整跨端验收后的可能增量诊断；只允许按其 manifest 清理，独立 SQL/home/images/cache 均保留。不修改 root 正在使用的服务或 Linux 验收容器。Stage29 及更早段落保持历史结果，不外推后来源码。

## Stage31 正式 Docker context 缓存根因修复

原 root `.dockerignore` 没有排除各层级 `.cache`，因此 Vue 的 standalone 失败归档与其他运行缓存可经 canonical `COPY frontend-vue` 进入构建 stage。独立镜像副本此前明确排除缓存，历史镜像没有依赖该缺口。现将 `**/.cache/` 放在 extension sources 再包含规则之后，使 package 内嵌缓存也保持排除；合法扩展源码、README 及名称包含 cache 的源码文件继续保留。

TDD：新增五个缓存路径负控后，旧规则实际 5 FAIL / 18 PASS；根因修复后联合上下文、双前端入口及 extension dependency 守卫 58 PASS，Ruff/format 检查通过。额外使用真实 Docker/BuildKit、完整原 `.dockerignore` 和纯合成文件执行无网络 `FROM scratch; COPY . /proof/` local exporter：旧规则五个禁止路径全部进入结果；新规则五个全部缺席，四个合法输入全部保留，包括 extension 再包含的 README。最终规则再单独移除后，真实 Docker 负控中五个禁止缓存重新全部进入（合法输入仍 4/4 保留）。没有把有限 Python matcher 的自洽结果当作 Docker 真实语义证明；常态单测也没有新增 Docker 前置条件。

脱敏证据：`docs/reports/evidence/docker-context-cache-stage31/`。后续 canonical 镜像会复制该正式 `.dockerignore`；最终 backend 全量门禁由父任务统一排队纳入新测试。

## Stage32 当前 backend 门禁

父任务已对包含正式Docker context回归的当前backend完整四分片实际执行，27096 PASS /451 skipped，blocking-I/O235 PASS、Ruff lint及format1960 files PASS，全部直接exit0。原Stage14/20/26结果保留历史边界；这些Python门禁不替代尚待执行的Stage33容器入口。

## Stage33 分阶段执行入口

专属脚本已准备：`docs/reports/evidence/container-ingress-stage33/run.sh`，先在确认生产源码冻结后执行`refresh`，随后按团队独占编译窗口顺序执行`build-vue`、`build-react`，最后执行`probe`、`smoke`。每个构建前后核对当前源码/副本/签入指纹，漂移直接失败；三条入口保持原严格契约，正式smoke额外从Docker实际事件断言signal15/die0/destroy且无signal9。脚本不自动清理运行配置、SQL或其他容器。Shell语法及Python语法已检查，构建和运行阶段尚未执行。

## Stage33 精确checkpoint真实验收 PASS

两端canonical Dockerbuild均直接exit0，实际运行容器Image与各自source/image receipt精确相同。Vue898输入SHA `dcc9defc3f20049847f350c695a620b67b26d9057659241821f65864b68294f2`、React810输入SHA `307599f295f43f9e9116deb948c85aff7942b65a7d4dc517cd735707c7f508f4`，构建前后及验收后当前/副本逐文件零drift，正式Dockerignore亦核对。Gateway894生产输入无漂移，复用同一个真实Chromium镜像，不重造backend。

三条原严格probe全部直接exit0。公开Nginx真实VueUI登录/HttpOnly/CSRF/owner、默认及未知Host React分流、2MiB上传/逐字节下载/206、增量未压缩SSE17chunks（first378.2ms/total2772.5ms）与精确产物；私网NuxtHTTP代理同契约SSE17chunks（first84.44ms/total2300.82ms）；公开原生Cookie/Origin WebSocket接收77491-byte真实Chromium二进制帧、实际close1000。两张实际登录后工作区PNG均view_image逐图回读PASS。

正式`container-smoke.sh deerflow-ingress-vue:stage33-final`直接exit0，non-root、health、最小产物、真实Showcase/允许表、三类404均保留。唯一smoke容器`deer-flow-frontend-vue-m0-49610`实际Docker事件signal15→die0→destroy，无signal9。专属Compose保留以供fullcross若发现新生产修复时只重构受影响镜像再复验；不清理其他服务。脱敏记录在`docs/reports/2026-10-10-container-ingress-stage33-evidence.json`及`docs/reports/evidence/container-ingress-stage33/`。此结论严格对应00:41:44CST源码，主任务正在诊断的新跨端失败与未来编辑均不由本记录外推为PASS。
