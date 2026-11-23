# Stage39 stream 夹具修复：独立只读复核与消费边界

复核时间：2026-10-10 06:15 CST。没有修改产品、测试、预算或正在执行的副本；没有运行 Nuxt/Next、镜像构建或全量单测。结论：未发现阻断修复本身的缺陷。当前生产代码及配置仍与已验收镜像逐字相同，但完整源码集合已发生明确的测试漂移，不能再写“当前整树零漂移”。

## 实际三文件与修复合同

以 capability owner 的 `repair-round-2/stream-fixture-freeze.json`（06:13:00 CST）为唯一冻结点，独立复算三个 SHA 完全一致：

| 路径 | 当前 SHA256 | 对历史 Docker context |
| --- | --- | --- |
| `frontend-vue/tests/support/stream-gateway.mjs` | `1b62549f88bc63b42a1c6825de49e9d8ed5618c9f0c52a6b74e8abe27ad21cfe` | 变更，历史实际 COPY 包含旧版 |
| `frontend-vue/tests/e2e-stream/real-stream.spec.ts` | `f649630e478d1ed8b685aaaa70a439d6dc30d77285c4dd7e31489d230a202197` | 变更，历史实际 COPY 包含旧版 |
| `frontend-vue/tests/unit/tooling/stream-gateway-fixture.test.ts` | `6f9781925f976d71f06b56ebcc11471434c63a17ae2c90c3ceb9877c4d8cd160` | 新增，历史 context/COPY 不存在 |

假 Gateway 现在按请求线程保存创建、正文、metadata 和完成态；搜索先匹配明确 POST `/threads/search`，返回数组，避免落入 detail 分支。SSE metadata、Content-Location、resume URL 与实际线程保持一致；原真实分块、心跳、gap 和 Last-Event-ID 路径保留。提交的 human 内容被原样保留，其他线程保持独立。

完成态的最后 AI 消息获得实际 run_id 和 elapsed 整数秒，包括零秒。这与 `backend/app/gateway/routers/thread_runs.py` 的 `compute_run_durations` / `stamp_turn_duration_on_last_ai` 合同一致；没有为测试改生产 duration 行为。这个可编排 HTTP 夹具仍不是实际 Gateway，也不用于证明认证、RBAC 或真实后端持久化。

测试选择器恢复到真实虚拟消息行结构。retry 定位当前实际 toaster 的 status，仍验证完整文本先出现后消失。耗时徽章实际是同物理行中 AI 内容前的兄弟节点，测试保留 visible，并新增行索引 `1` 的归属断言；没有泛化为整页任意徽章。

独立 TypeScript AST 对照确认六个原 case 标题完全相同；30 个 case 内原 matcher 的方法与参数全部保留，另有原共享 helper 的一条可见性 matcher 同样保留，总计31→32，唯一新增为物理行属性断言。原首尾跟随、用户 wheel 后不被抢回、全文与 human/AI 顺序、心跳无额外消息、终态 subtask/model/token/展开与焦点、唯一 `resumed@e8` 全部保留。方法数量不是 locator 正确性的替代，因此已另读实际 MessageList / VirtualMessageList 的 owner 结构及完整 spec diff。

修复 owner 的实际执行证据保留：HTTP/SSE 初始5 FAIL→5 PASS；完成态补强3 FAIL/2 PASS→5 PASS；浏览器最初6 FAIL，两次补验各5 PASS/1 FAIL，最后完整6 PASS、0 skip/flaky、直接0、14.7s。最后一轮复用同一已编译 `.output`，通过真实 socket/Nitro，没有 fulfill SSE。以上是其实际日志和 receipt，不冒称由本次只读审查重新执行。完整 canonical/mock/backend/external 的新轮仍由其各自执行结果负责，不能用6项替代。

## 全集合、COPY 与构建语义

独立重新枚举完整预备前端集合，包含新增文件：历史2906→当前2907；2变更、1新增、0删除。当前集合 SHA 为 `37ad867db6c7d5c031342bd3728225a33a67e98457db8c97716bbc48a6ac6602`。所有生产、配置、依赖锁及 React 模块字节无变更。历史物理 context 仍与其原2906清单逐字一致，没有事后更新旧 snapshot。

历史 BuildKit 实际 COPY 为2905文件。两个已存在的测试文件确实进入该 COPY，不能说 Dockerignore 排除了它们。新 unit 不在历史 context/COPY；本审查没有重新执行当前 COPY 或重新构建镜像，不能把预测成员数写成引擎实测。

Tailwind 4 默认扫描会读取这些测试文本，不能仅用“没有运行时 import”推断构建无影响。使用已安装的 `@tailwindcss/{vite,oxide,node}` 4.1.18，分别对不可变历史模块与完整当前模块执行实际默认 auto-discovery：

| 实测 | 历史 | 当前 |
| --- | ---: | ---: |
| scanner 实际文件 | 1614 | 1615 |
| raw candidates | 24563 | 24568 |
| 独立生成真实 main.css bytes | 202104 | 202104 |
| 生成 CSS SHA256 | `23044705e630d37342dcf5fd7e6e442a7a7352c0f9c066a0a0173b8030682054` | 同左，逐字相同 |

实际 scanner 文件漂移恰为上述三路径；新增7个、删除2个 raw candidate 均记录。对全部旧/新候选分别生成 CSS，不只对新增字符串采样，也未沿用 compiler 的累计候选缓存。真实 CSS、显式 source 配置及锁文件未变；新增/删除候选没有改变有效 utilities。这个轻量编译器对照不是新 Linux/Nuxt/Docker 构建，其精确方法、包入口 SHA 和结果见 `candidate-css-review.{mjs,json,log}`。

## 逐门禁的实际 consumer 边界

| 门禁或入口 | 真正消费 | 本次漂移影响 |
| --- | --- | --- |
| `e2e-stream` | `playwright.stream.config.ts` 直接启动该 stub，执行该6项 spec，经 Nuxt 代理真实 socket | 直接消费两修改文件；需记录新源6项实际结果，不沿用旧红/旧源绿 |
| Vue full unit / tests types / lint | Vitest node project 收集新 unit；unit 启动 stub；tests typecheck 包含它 | 直接消费新增文件和 fixture；最终这些 gate 必须以新3文件实际执行，不能沿用旧3818全量结果 |
| Linux visual8 | 自己的 `e2e-visual` spec、mock helper 与独立 held-stream server | 不执行该 stub/spec/unit；源码清单仍有2行变化+1新增，Tailwind语义对照无 CSS 差异；保留原1750 snapshot实际 PASS，不伪称当前清单0漂移 |
| Linux payload12 / asset | 原 route-payload spec、预算、生产 `.output`、asset脚本 | 不执行该 stub/spec/unit；产品/配置/门禁消费者未变，Tailwind输出逐字等同；原产物测量仍属于原snapshot |
| root product913 / 751样本 / 双端211状态 | `playwright.parity.config.ts` 的 replay Gateway与真实两端，其 testDir为e2e-parity | 不收集e2e-stream或unit，不启动stub；旧5584清单的2测试行变化和新unit必须披露，不能把正在跑的旧冻结copy称为当前全树 |
| root auth21 / session8 | 各自 testDir、replay Gateway / `run_authz_gateway.py`、实际SQL | 不执行该stub/spec/unit；实际认证与状态来源没有被本次假Gateway接替 |
| 生产 Docker与原3 probe/OIDC/smoke | 原 Dockerfile、实际镜像，Gateway replay/browser fixture、受控IdP；Vue CMD为`.output/server/index.mjs` | 构建 COPY 包含旧测试，运行不执行该stub。生产字节不变，Tailwind差异为零；Stage39 images和实际全scope PASS仍保留其原context边界，不称新3文件已在镜像里执行 |
| standalone | 自己的完整verify/全unit，以及选定e2e模式 | 新复制应包括新增unit和两修改文件，其实际结果另记；本审查不替代该mandatory gate |

代码引用搜索仅在 `WorkspaceChangesBadge.vue` 留下一个注释中的 spec 名，没有 runtime import。visual 的 streaming 用例自建 held-stream HTTP server；生产 ingress SSE 请求实际进入真实 Gateway，不能仅因同为 SSE 就混同为这个可编排 stub。

root 最新 Stage39 日志已记录双端211终态宏各自 PASS、horizontal/lost/clipped均0；这是 root 的实际执行，仍不替代正在继续的其他 product/keyboard/diff/auth/session聚合。本审查没有停止或修改那些执行副本。

## 证据

本次独立脚本、完整文件集合比较、真实候选/CSS对照、AST断言保留、两份源码 diff 与引用搜索：

`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/stream-fixture-independent-stage39/`

原修复 RED/GREEN、最终三文件 SHA 与真实6项 JSON/log：

`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/docs/reports/evidence/capabilities-final-stage38/repair-round-2/stream-fixture-freeze.json`

本次 `candidate-css-review.mjs`、`source-boundary.py`、`matcher-review.mjs` 均实际直接退出0。没有实质新增产品问题需要修复，没有扩大豁免或放宽断言。
