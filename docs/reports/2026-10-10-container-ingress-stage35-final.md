# Stage35 双前端真实容器入口验收

2026-10-10 02:00 CST，本批 Vue / React canonical Docker build、三条真实入口探针、正式 Vue container-smoke 与实际 SIGTERM 事件检查全部 **PASS，命令直接 exit 0**。本结论只覆盖下列精确生产输入；完整跨端矩阵与外部部署由各自门禁证明。

## 源码与镜像

| 项目 | 精确选源 | 生产输入 SHA256 | 实际镜像 ID |
| --- | ---: | --- | --- |
| Vue | 899 files | `36bf1b0b39a5f8c55f29e7674790eec803e5fd82979eb20abeafc2bc64061b85` | `sha256:71cf04c6e65284d831c8723d8a226d52ebfa3fd50e9984ad62266a3807a0768c` |
| React | 812 files | `b54a93e8be7ab136cf22fc8b1a9c57ab73da9a11d815451a8fab549a9e3db114` | `sha256:4cc7c5726f51b201de4e9c1f944022eb78d64d06b68c2b981333f87364bb0ab3` |

使用当前仓库原 Dockerfile，Vue 默认 runtime target、React `--target prod`，没有替换构建器、依赖或超时。镜像标签分别为 `deerflow-ingress-vue:stage35-final`、`deerflow-ingress-react:stage35-final`。源码清单同时固定 `.dockerignore` SHA `a826e200a2b17254a17acd3085734f9c29c3d3e76cc85f06717375dc4fe0290f`。每次 build 前后、三探针结束后均逐文件比较选源、独立副本与持久指纹；差异为零。实际运行容器 `.Image` 与构建 receipt 的不可变 ID 完全一致。

选源与排除规则完整记录在 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/2026-10-10-container-stage35-source-fingerprint.json`。选源是 Dockerfile及运行配置、应用/公共资源与锁文件等生产输入，不能与全仓库文件数或 Linux 视觉清单文件数混用。副本未借用原 checkout 的 node_modules、`.next`、`.nuxt` 或 `.output`；所有 `.cache`、运行配置、私有 dotenv、测试输出与 Python/Git 缓存均排除。

复用的隔离 Gateway 镜像是 `sha256:eabda78a6c905d45bd1030262ef935ad75559b4e361e86cad03ed01a5b703206`。重新核对 Gateway 894 个生产源文件和包/Docker 元数据，当前仓库与其保留构建副本逐字节零差异，SHA `f9b69382f64f5c78b7fc1b36bbdab14af33d00f8391215032d62e0b55ba44740`；实际挂载 replay/M0 provider、replay 数据和 nginx 模板另逐文件核对。nginx 实际 image ID 也固定校验，没有把同名标签当作镜像身份。

## 三条实际链路

1. **公开 Vue hostname → nginx → Gateway：PASS。** 实际 Vue UI 登录、HttpOnly cookie、CSRF 与 expected-owner、SQL 偏好写入/读取；2 MiB multipart 上传、完整下载及206范围字节；LangGraph路径重写、未压缩增量SSE与最终精确产物。SSE共17块，首块490.3ms、总2710.1ms。默认与未知 hostname 仍返回 React。
2. **容器内 Nuxt HTTP proxy → Gateway：PASS。** 真实注册/登录/owner/CSRF、模型、LangGraph thread rewrite、2 MiB上传、精确下载/range及增量replay SSE。SSE共17块，首块78.9ms、总2306.4ms。此项独立于公开nginx直连Gateway拓扑，不宣称Nuxt WS代理通过。
3. **公开 Vue origin → nginx → Gateway native WebSocket：PASS。** 实际同源Cookie/Origin升级，真实浏览器工具返回Chromium二进制frame共77492 bytes，正常close1000。该阶段按专属配置切换Gateway，没有让browser工具改变replay prompt后仍忽略replay miss。

公开两次实际页面截图 `public-replay.png`、`public-browser.png` 均已用 `view_image` 回读。截图是入口/登录页面补证，不替代跨端视觉断言。

## 正式 smoke 与运行隔离

原 `frontend-vue/scripts/container-smoke.sh` 直接执行在本批 Vue 镜像，返回exit0；保留原non-root、health、showcase/resource404和退出检查。Docker实际事件再次证明：同一个owned smoke容器收到signal15，随后die exitCode0、destroy，未出现signal9。

运行前端均为 `node` 用户、`authDisabled=false`、健康；Gateway同样开启真实认证。仅nginx发布 `127.0.0.1:2326`，两个前端与Gateway不发布端口。专属project为 `deerflow-vue-ingress-00aff39027`，独立home/SQLite/空dotenv/test JWT/replay或browser provider。没有读取或修改tracked `.env/config.yaml/extensions_config.json`，没有启动真实MCP/IM/远程模型，也没有影响其他stack。

隔离Compose保留在 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docker/.cache/container-ingress-stage26`，供最终审查复用；其秘密配置不复制到报告。旧Stage33双镜像与Stage34单Vue镜像只作为历史checkpoint，不能外推为本批生产源码通过。

## 精确证据与执行入口

全部脱敏证据：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/container-ingress-stage35/`。

- `acceptance-summary.json`：本批结论、直接退出状态、源码SHA、运行镜像ID、探针实测、退出事件与边界。
- `frontend-vue-build-proof.json` / `frontend-build-proof.json`：构建源身份与不可变镜像receipt；对应build.log保存canonical命令输出。
- `public-replay.json` / `private-nuxt.json` / `public-browser.json`：各链路真实读数；日志与公开页面PNG同步保留。
- `runtime-images-health.json`：实际容器镜像、用户、认证开关、健康与发布端口。
- `container-events.jsonl` / `container-smoke-events-summary.json`：实际SIGTERM、正常退出与清理事件。
- `final-source-check.log` / `final-backend-source-check.log`：全部链路和smoke之后的零漂移复核。
- `run.sh` 及三个source/image/runtime proof脚本：精确独立执行入口，不复用原checkout构建缓存。

本验收不代表外部DNS/TLS/外层代理、真实IdP/模型/MCP/IM或整套cross-app已验收；这些边界没有借用本批PASS填充。完整矩阵必须以最终测试文件和相应独立构建的正式结果为准。
