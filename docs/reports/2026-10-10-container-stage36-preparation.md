# Stage36 独立容器验收准备

本文件记录准备方案，不是新镜像验收PASS。现有Stage35镜像/三探针/smoke的实际PASS保持原源码边界，不覆盖后续W00/Agent/Query/artifact变化。

所有可执行准备脚本位于 `/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/container-ingress-stage36/`。入口 `run.sh` 支持按序 `refresh` → `engine-context` → `build-vue` → `build-react` → `probe` → `smoke`。仅获root明确构建窗口后执行Docker阶段。原checkout不构建，原/旧snapshot不覆盖，新tag为 `deerflow-ingress-{vue,react}:stage36-final`。

`context.py refresh` 创建全新私有/tmp源码目录，遍历两前端整个实际模块树，包含shared和所有模块根配置；排除已明确的node_modules、cache、生成输出、runtime/.env、日志和测试结果。完整prepared实际文件/字节/SHA清单与仓库/副本前后零drift校验独立保存。不会制造新Dockerignore规则，复制仓库真实`.dockerignore`。

`engine-context`以scratch COPY两模块并本地导出，真实测量当前Dockerignore下的COPY成员、每文件字节/SHA与未进入COPY的prepared条目。selected Dockerfile和Dockerignore作为单独引擎指令输入；不能将COPY成员偷换为编译器语义消费或网络发送字节总量。两镜像采用原canonical Dockerfile/target/无新bundler/timeout/依赖开关，实际iidfile与tag/imageID一致，再从无网络临时容器读取完整Vue.output、React.next/public/package/config编译产物字节清单。

Gateway/nginx保留原不可变imageID，单独fence当前894项生产源/实际消费fixtures；挂载路径与只读目录完整实际字节另存receipt，明确来自旧隔离fixture目录，不能伪称新frontend context。隔离home/SQL只记录路径存在与mount边界，不导出凭据/数据库内容。仅自有project `deerflow-vue-ingress-00aff39027`，当前已正常stop、未down/deleteSQL，2326已释放；真实退出和保留挂载见 `owned-project-stop-receipt.json`。

正式probes仍完整保留 publicVuehostname→nginx→Gateway、Nuxt内部代理→Gateway、public原生WS三链；实际登录/HttpOnly/CSRF/owner、2MiB upload+206download、17chunk SSE、浏览器WS原assert不变。mandatory原container-smoke完整执行，并独立Docker事件证明SIGTERM15→die0→destroy且无SIGKILL9；最终PNG实际逐图回读。

Stage35旧899项清单漏记录shared/showcase.ts、tsconfig、.nuxtrc、components.json、eslint.config.mjs。当前旧copy与repo5项字节均相同，见 `stage35-input-receipt-boundary.json`，但不追认未记录的历史构建时字节。Stage36上述完整physical/actualCOPY输入链关闭此证据缺口。


## 2026-10-10 04:27 CST — Docker双hostname OIDC验收补齐准备

最终mandatory复核确认原容器验收仅覆盖本地密码登录/HttpOnly/CSRF，尚未通过canonical Nginx分别选中React/Vue执行真实SSO callback。已有external两hostname测试都落同一Nitro端口，不能替代该部署入口。因此本项在此时明确为UNRUN，旧三个容器探针PASS不外推到OIDC。

仅测试域新增受控阶段：复用 `frontend-vue/tests/support/run_m0_idp.py` 的授权码/PKCE/nonce fixture，新增可选host/issuer参数，默认仍127.0.0.1与原issuer；既有Gateway镜像运行该fixture，Compose专属overlay仅添加idp与切换Gateway受控config。公开IdP端口固定loopback，容器内network alias与Chromium的*.localhost使用同一个issuer。没有修改产品auth、生产Nginx、远端IdP或原三个探针。

`prepare_container_oidc.py` 保留原project、compose、replay/browser配置和SQL，生成独立overlay/config；`probe_container_oidc.mjs` 从两端实际登录UI发起授权，在真实authorize请求继续前同时核对同名host-only signed state Cookie，错误host state真实403且正确cookie保留，随后放行真实HTTP并验证各自Gateway302、各自前端callback200/next、同SQL owner、HttpOnly/CSRF、state清理与reload身份。没有fulfill/me mock或绕过真实exchange。

TDD真实1PASS2FAIL→最终2files8PASS/0skip/direct0；默认与容器CLI都执行实际discovery、授权码、PKCE与nonce。tests types、ESLint、Ruff/format、Prettier、Node语法均直接0，四个输入的精确receipt为 `docs/reports/evidence/container-ingress-stage36/oidc-fixture-input-freeze.json`。Playwright净增0、Vitest净增3。Docker执行工具独立位于evidence目录，新增probe-oidc阶段，保原probe/smoke全部合同；实际容器阶段仍等待统一最终镜像与编译窗口。外部DNS/TLS、outerproxy和真实组织IdP仍不由该受控loopback验收声明通过。


### 2026-10-10 04:32 CST — OIDC探针最终脱敏输入边界

root原5572输入/dbd94完整canonical已direct0：460files3816tests且0Unhandled、四types、lint/format/OpenAPI/构建/asset/consumer/audit全部通过。其probe输入为47b638ec，保持该精确checkpoint；此后经root同意，仅将3个state/cookie字符串比较换为完全相同的boolean断言，避免失败日志自动输出原始签名state。没有删除条件、捕获忽略异常或mock响应。最终probe SHA为 `b57c9035a359c1e48729f3c2ecf840d8ec8df0a83eb976f726fb07ae928e9ad6`，专项2files8tests/0skip、tests types/ESLint/Prettier/Node语法均直接0；其余3个fixture输入未变。唯一最终receipt是 `docs/reports/evidence/container-ingress-stage36/oidc-fixture-input-freeze-final.json`，旧源与3处diff单独保留。实际Docker OIDC仍UNRUN，后续必须执行b57输入，不能将canonical47通过冒记为b57容器通过。

### 2026-10-10 04:50 CST — complete context and actual Docker COPY receipts

The isolated physical context was prepared successfully at `/private/tmp/deerflow-ingress-source-stage36-whb_c6m0`: 2901 actual inputs, SHA256 `8b9ce4a43700b3f7045bc1d9a02b89c07683645d8cc49771e43205fc5401ac92`. The unchanged canonical `.dockerignore` has SHA256 `a826e200a2b17254a17acd3085734f9c29c3d3e76cc85f06717375dc4fe0290f`. Actual BuildKit scratch COPY export passed separately: 2900 module files, SHA256 `4bab3ec0a937472d2c16f231c87905202c0bea80c40339455ada0e44d776e7e7`. The remaining physical input is the Dockerignore engine instruction; this is not a claim about network transfer bytes or semantic compiler consumption.

The canonical Vue image build completed with direct exit 0, image ID `sha256:ecaa55a210f126ea1849859ef97f91114b85c87a45ddc19c68eddba2ca25220f`; its actual compiled-file receipt records 6765 entries. React canonical build is still in progress. The three existing runtime probes, new production-Nginx dual-host OIDC probe, and mandatory container smoke/SIGTERM are not yet executed for this context. A newly confirmed React menu positioning defect is tracked separately; these images must not be described as validating a future menu fix.
