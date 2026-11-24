# DeerFlow 项目关系与边界

核对日期：2026-11-24。此表基于本仓Git remote、workspace/package配置、源码指导和用户确认；不是扫描整台机器所得的“所有相关仓库”。新关系必须给出实际依赖、接口调用或用户明确指定的证据，不按名称/目录邻近推断。

## 已确认的仓库关系

| 对象 | 关系 | 证据 / 操作边界 |
| --- | --- | --- |
| `https://github.com/bytedance/deer-flow.git` | 开源上游，local remote名upstream | 本次git remote get-url核验；用户维护main周期性同步。不自行fetch/pull/merge；当前冻结的基线见执行约定第0.1节 |
| `https://github.com/aiAppSpace/deer-flow.git` | 当前fork，local remote名origin | 本次remote核验；main-wc为本地定制分支。提交状态/领先数量看实时Git，remote URL不是远端最新内容证明 |
| `../deer-flow-candidates/r03-v5` | 已合入本仓的旧隔离候选，不再使用 | 2026-11-24 已有界合入 `main-wc`；它不是第二个业务项目或发布源，不在其中修改或验证 |

## 仓内模块及其真实耦合

| 模块 | 职责与关系 | 维护入口 |
| --- | --- | --- |
| `frontend/` | React/Next参照前端，调用同一Gateway；浏览器对照必须存在React。内容站是它自己的范围 | frontend/AGENTS.md、frontend/src/AGENTS.md、frontend/docs/workspace-behavior-contracts.md |
| `frontend-vue/` | Nuxt/Vue前端，独立框架实现相同产品合同；与React是对照关系，不是运行时嵌入React | frontend-vue/README.md、ARCHITECTURE.md、BEHAVIOR_CONTRACTS.md |
| `frontend-vue/packages/agent-core/` | Vue workspace内部`@deerflow/agent-core`包，通用协议/session/reducer/store合同 | package.json标private:true、Vue以workspace:*依赖；[frontend-vue/REUSE.md](../../frontend-vue/REUSE.md)只支持workspace或本仓pack tarball，未发布npm，不臆造agent-ui-kit |
| `backend/app/` | FastAPI Gateway、鉴权/REST/嵌入式LangGraph兼容runtime、IM入口 | backend/AGENTS.md及app/gateway、channels指导 |
| `backend/packages/harness/` | agent框架、模型/工具/中间件、内存、sandbox、MCP、扩展运行 | backend uv workspace成员；按细目录AGENTS阅读 |
| `backend/packages/extension-api/` | 对外扩展合同 | 同一uv workspace；变更需核扩展消费者，不能把core快照与扩展schema混合 |
| `contracts/` | 跨端JSON合同 | 源合同和生成检查、双方真实消费者共同核验 |
| `examples/deerflow-extension-*` | 仓内扩展示例及验收消费者 | 不是另一个外部业务项目；core OpenAPI与extension fixture隔离 |
| `skills/public/`、自定义/集成skills | DeerFlow产品执行的技能 | 产品数据/运行能力，区别于Cursor/Codex开发助手自身的工具、技能或权限 |
| `scripts/`、`docker/`、`deploy/` | 主机命令、Compose、Helm部署与诊断 | 根Makefile/AGENTS和对应脚本；Compose双前端与Helm React-only范围不同，不能互相代替验收 |

`deer-flow.code-workspace`当前只挂载`.`；前端依赖清单没有外部仓库file/link依赖，Vue已确认的本地workspace依赖为agent-core；backend两个本地包在本仓uv workspace内。这只说明已检查配置范围，不能据此断言所有可选运行集成均不存在。

## 外部服务与仓库依赖要分开

模型提供方、可选MCP服务器、知识库/RAG服务、sandbox/provisioner、IM平台、真实IdP和DNS/TLS/外层代理，属于可配置运行服务或部署环境。是否启用、地址、凭据、模型型号及可达性，以当前根config.yaml/extensions_config.json/.env解析及实际探测为准。

- 配置里有provider或SDK，不等于本机有它的源码仓库，也不等于已验证连接。
- 文生图/视频/语音/音乐脚本的默认模型，不等于全部已调用成功。
- 单元/mock/replay/受控IdP通过，不等于真实外部LLM、IM、生产IdP或外部部署通过。
- 指南只记配置入口与契约，不能记录明文key/token/cookie或未经核实的私有服务地址。

用户已明确：**AiPPT与本项目没有项目关联**。不把它列为依赖、参考项目、关系图节点或联调对象。历史本机端口冲突仅属于环境资源避让，统一按“不干扰其他项目服务”处理；本指南不记录其源码位置或业务情况。

## 增加关联关系时需要的最小信息

只在有证据后增加：仓库/模块名、关系类别（上游/直接依赖/接口服务/参考）、谁调用谁、实际配置或import位置、接口/版本合同、开发与测试入口、变更影响、权限/数据边界、最后核验日期及证据。关系不明就标未确认，并定位配置/源码；不能填一个看似完整的猜测图。
