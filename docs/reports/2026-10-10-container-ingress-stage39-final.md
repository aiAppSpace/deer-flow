# Stage39：最终双镜像与真实容器入口验收

本轮指定的 Docker 验收范围已全部实际执行通过，所有阶段直接退出 0。未使用 Stage36 旧镜像外推；没有改生产代码、Nginx、依赖、预算或原探针断言。完整源码、实际 COPY、镜像、运行挂载和退出事件均有独立证据。

这不代替完整跨端 913 项、751 样本、双端 211 状态、auth/session、原生 Linux 或 standalone 门禁。其他代理后续修正的测试夹具也不自动变成本轮镜像的已执行输入。

## 实际输入与镜像

| 边界 | 实际记录 |
| --- | --- |
| 独立物理上下文 | `/private/tmp/deerflow-ingress-source-stage39-hhsax3_h`，2906 文件，SHA `4928d9eddff0b5673bfef6647b93e33ee07d081818733d4246b743b93a32cafb` |
| canonical Dockerignore 下真正 BuildKit COPY | 2905 文件，SHA `c0c8fb917b73dd50eada6c3687e547cab058aaf3da3624b8a6ec8d32549ef314` |
| Vue 模块物理与实际 COPY | 同为1668文件，SHA `bbede8580e0111bfa18df831f810e4ee998bf23a9b1f292e5776f064752a70c3` |
| React 模块物理与实际 COPY | 同为1237文件，SHA `1d9691610cb8fcafe9d8f1d80784e7043a2fba33ee41991c12195b81c7b3abc1` |
| Vue canonical image | `deerflow-ingress-vue:stage39-final`，`sha256:284c0c75da4d02d6e9939ec2e6add09706e07462e632981da6feeab2a48bd0ab` |
| React canonical prod image | `deerflow-ingress-react:stage39-final`，`sha256:5a59d817adb706ade8efb7f22e54d8fdc8ed3feb0b5b54add8dd44da3894e660` |
| Vue 实际镜像内 `.output` | 6765文件，SHA `e2d579530949fe6e67434c49a3c88d7312e2709fa5e9b878e60dca17ee067fbf` |
| React 实际镜像内 `.next/public/package/config` | 4493文件，SHA `45c5ad40df7e505a6b5efb0d95289cfe1a8078b58561ed8e5b9ea5def96d6486` |

物理上下文完整枚举两前端模块，包括 shared、所有模块根配置、测试与工具；排除本地生成目录、缓存、依赖、测试产物和私有 `.env*` 等，清单在 receipt 中逐项记录。这是预备上下文的明确范围，不声称复制整个 monorepo。仓库 tracked runtime 配置政策没有改变。

实际 BuildKit scratch COPY 使用仓库原 `.dockerignore`，没有另造过滤规则。少一文件为单独读取的 `.dockerignore`，模块内容实际全部进入 COPY 输出。**测试文件确实被 COPY，不能称为 Dockerignore 排除。** COPY 成员证明也不等于每字节都被编译器语义消费，或等于网络传输总字节数。

两镜像均从这份不可变上下文执行原 Dockerfile，Vue→React 串行构建。镜像内字节在启动前实际枚举，基础系统和依赖树用不可变镜像 ID 表示，没有混算为编译产物。

Gateway 复用前后严格核验894个生产/包/锁/构建元数据文件及实际挂载 fixture，SHA `f9b69382f64f5c78b7fc1b36bbdab14af33d00f8391215032d62e0b55ba44740`，缺失/新增/变化均空。复用镜像 `sha256:eabda78a6c905d45bd1030262ef935ad75559b4e361e86cad03ed01a5b703206`；Nginx 镜像与真实只读配置也分别记录。数据库、credentials 和隔离 runtime 是运行状态，没有被冒充为构建输入或导出内容。

## 门禁逐项实际结果

| 阶段 | 结果与保留合同 |
| --- | --- |
| physical context / engine COPY | 直接0；实际文件与字节全记录 |
| canonical Vue build | 直接0；原 Dockerfile、Linux依赖、镜像实际产物 |
| canonical React prod build | 直接0；原 Next构建/类型/静态页/原prod target |
| 公开Vue hostname：Nginx→Gateway replay | 直接0；Vue提供页面，公开API由Nginx直接代理Gateway；真实 UI login、HttpOnly/CSRF/expected-owner、2MiB上传、精确下载/range、增量未压缩SSE、真实产物字节；默认/未知hostname仍React |
| private Nuxt→Gateway | 直接0；真实register/login/owner、CSRF、models、LangGraph重写、上传下载/range、增量SSE与精确产物 |
| 公开 Nginx→Gateway browser tool WS | 直接0；same-origin Cookie/Origin、真实Upgrade与真实Chromium二进制帧 |
| Nginx真正双hostname OIDC | 直接0；下述完整授权/callback/state/SQL合同 |
| 原 mandatory container-smoke | 直接0；non-root、health、showcase、resource404，实际15→0→destroy且无9 |
| 自有五服务正常stop | 直接0；全部标签先验、IdP真实init、退出事件、端口释放与SQL保留 |

## 真正双 hostname OIDC 与信号边界

公开入口仅绑定 `127.0.0.1:2326`，受控 IdP 仅绑定 `127.0.0.1:2386`。两端及 Gateway 实际 `authDisabled=false`，不是匿名模式或伪造 `/me`。

通过 `react.localhost` 和 `vue.localhost` 的真实 Nginx 入口，从各自实际登录UI同时发起同provider授权。Native Chromium redirect 请求实际继续到受控IdP，不mock授权/token/me。断言同时存在的同名host-only signed-state cookie互相隔离，错误hostname消费state真实403且正确state保留；之后各自真实code/PKCE/nonce、Gateway302、自己hostname的前端callback/next、同一个SQL owner、state清理、HttpOnly/CSRF、expected-owner preferences和reload稳定全部通过。

受控IdP本轮实际挂载来自最终物理上下文，运行时 `HostConfig.Init=true` 被 inspect 核验。它与产品 Vue 的退出期望不同：最终正常stop中，IdP实际signal15→exit143，Vue实际signal15→exit0；两者均无signal9/OOM。此前IdP137的旧失败保留在Stage36历史证据，没有隐藏或改产品信号配置。

## 停机与来源连续性

只操作项目 `deerflow-vue-ingress-00aff39027` 的五个逐一label验证的服务。实际正常stop后：Nginx0、Vue0、React143、Gateway0、IdP143；所有服务均停止，无SIGKILL/OOM。2326和2386已释放。两个实际SQL文件仍存在且非空，隔离runtime、容器和镜像保留；未执行down、删除SQL或影响其他project。

全部探针及smoke结束时，当前仓库与2906文件的冻结物理上下文仍逐字零漂移，见 `full-context-post-probes.log`。这是有明确时点的证明。后续 stream fixture/spec 等测试修正若发生，必须另列整树/COPY中的路径漂移，不能继续把“当前全树零漂移”写成无时间边界的结论；它们也没有在这些镜像里重新执行。补充只读边界记录为 `post-probe-current-source-boundary.json`。

06:13 的 stream 三文件冻结之后，独立重新枚举已实际确认两旧测试修改、一个新 unit、无删除，当前集合2907；生产/配置及React模块字节未变。两个旧测试在历史actual COPY中，新unit不在该历史COPY中。完整old/current Tailwind候选生成真实CSS逐字一致，实际runtime入口不执行该stub。以上不是重新构建镜像或当前全树零漂移；精确当前文件集合、消费者及实际CSS对照见 [独立边界复核](2026-10-10-stream-fixture-independent-review-stage39.md) 和 `evidence/stream-fixture-independent-stage39/`。

外部DNS/TLS、外层代理与组织真实IdP仍是部署环境事实，本次仅证明上述真实受控loopback拓扑，没有将其声明为环境切流完成。

## 证据入口

全部日志、原始JSON和脚本位于：

`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/container-ingress-stage39/`

- `phase-exits.json`：各阶段真实直接退出结果。
- `complete-context-fingerprint.json`、`engine-copy-fingerprint.json`：全部物理输入与实际COPY逐文件字节。
- `frontend-vue-build-proof.json`、`frontend-build-proof.json`及各自image-artifact-inventory：输入/COPY/image/实际产物链。
- `backend-source-proof.json`、`runtime-images-health*.json`、`runtime-mount-receipt*.json`：Gateway连续性、实际images/health/auth/ports/mount配置。
- `public-replay.json`、`private-nuxt.json`、`public-browser.json`、`public-oidc.json`：原三探针与真实OIDC结果。
- `container-smoke-events-summary.json`、`container-events.jsonl`：mandatory实际退出事件。
- `normal-stop-receipt.json`、`normal-stop-events.jsonl`：最后五服务停机与SQL保留。
- `idp-full-unit-timeout-observation.json`：同冻结源首次外层5s超时及之后原预算完整3818PASS均保留；没有借窄8PASS替代全量。
