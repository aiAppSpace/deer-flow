# DeerFlow：跨平台、跨模型接手入口

这份指南用于 Cursor、Codex、其他编辑器或命令行中的助手接手本仓库。它只依赖仓库文件与可核验现场，不依赖某个平台的聊天记忆、工具名称或隐式权限。**先弄清用户本次要讨论、审查、写文档还是实现；打开项目或读取本指南不自动开始任务。**

## 1. 新会话先读什么

1. 根 [AGENTS.md](../../AGENTS.md)：项目稳定规则、服务拓扑、命令归属。
2. [CURRENT_TASK.md](CURRENT_TASK.md)：当前任务、停点和下一步。
3. 当前任务指向的计划：[Vue 对齐 React 计划](../reports/2026-11-24-vue-react-alignment-plan.md)和它依据的[执行约定](../reports/2026-11-23-r03-resume-plan.md)。
4. [PROJECT_RELATIONSHIPS.md](PROJECT_RELATIONSHIPS.md)：仓内模块、上游/fork、可选外部服务和明确无关联项。
5. 本次要改的模块指导及源码/测试。

可以把 [NEW_SESSION_PROMPT.md](NEW_SESSION_PROMPT.md) 中的模板交给新平台；其中任务一栏由用户填写。不能假定某个平台一定自动加载 AGENTS.md，启动时显式要求读取上述入口最可靠。`CLAUDE.md` 只导入根 AGENTS；Copilot 入口引用同一份规则。

## 2. 哪类事实放在哪个文件

| 信息 | 唯一维护位置 |
| --- | --- |
| 长期约定、monorepo 地图、根命令 | 根 AGENTS.md；模块细节归各模块指导 |
| 模块职责、状态所有权、行为合同 | React/backend 各层 AGENTS；Vue 的 `ARCHITECTURE.md`、`BEHAVIOR_CONTRACTS.md`、`README.md` |
| 关联关系、外部依赖类别 | PROJECT_RELATIONSHIPS.md |
| 当前停点、下一步 | CURRENT_TASK.md |
| 对齐要做什么、做到什么程度 | 对齐计划（条目、顺序、结果记录）与执行约定（判据、范围、用户裁决） |
| 凭据与机器配置 | 实际运行环境和项目既有配置机制；不写进指南、提示词或报告 |

任务推进后更新 CURRENT_TASK 和对齐计划里的结果记录，不在多个入口各写一套进度。

## 3. 项目目标与裁决标准

本项目是上游 DeerFlow 的 fork。React `frontend` 是上游前端，Vue `frontend-vue` 由本仓另建；Vue 的目标是与 React 的**功能、操作流程、行为、界面样式**可平替，并与 backend 实际的 REST/SSE/JSON、权限和持久化一致。

- 豁免：Vue 首页内容、docs/blog 内容站、整站无后端静态模式、Showcase 公开回放页。电脑/手机/平板三种布局、中英文、浅色/深色都在范围内。
- 对齐判据以正常用户的正常使用为准（用户主要用鼠标）：影响正常使用的才要求对齐，包括功能、流程、可见界面与文案、交互结果、出错提示，以及输入框光标连续、对话框直接输入与 Esc/回车这类用户能感觉到的焦点行为；发往后端的请求（时机、顺序、请求体、请求头、多发或重复发）也要逐项一致。读屏内容与无障碍树、Tab 顺序、纯键盘焦点去向、看不出来的几何细节不再作为对齐要求。详见[执行约定第 0.2 节](../reports/2026-11-23-r03-resume-plan.md)。
- React 是参照，对齐时只改 Vue。后端实际契约决定 wire 与鉴权；Vue 用自身框架的合理实现，不照搬 React 私有实现。两端同错不等于对齐。
- 真实源码、直接运行结果和用户最新指令优先；文档可能过时，与代码冲突时以代码为准并修正文档。
- 不以任意延时、吞错、猜字段、补偿请求、抹动态 ID、扩大 allowlist、删用例、改阈值来绕过失败。

## 4. 修改前先确认的现场

- 当前分支应为 `main-wc`，跟踪 `origin/main-wc`；Git 状态、未提交改动和服务进程只能现场核验。
- 上游基线冻结在执行约定第 0.1 节写明的提交；对齐计划完成前不抓取或合并上游。
- `.env`、`config.yaml`、`extensions_config.json` 是受跟踪的私有配置，Gateway 和测试会改写它们；提交前检查它们的 diff，不随功能提交。backend 测试会改出 `.extensions_config.json.skills-cache-reset.json`，提交前恢复。
- 端口和进程先确认归属，不 kill 别人的进程，不因端口冲突停止无关项目的服务。
- 提交、推送、清理、发布要有用户的明确指令；推送前先问。获准提交就在当前分支提交，不为提交另开分支。
- 不要运行 `git reset --hard`、`git clean` 或整树 restore 来“清场”。

## 5. 命令

host pnpm 从仓库根目录调用 `python3 scripts/pnpm.py --dir frontend …` 或 `python3 scripts/pnpm.py --dir frontend-vue …`，它按目标 workspace 的 `packageManager` 选版本；不要凭全局 pnpm 版本改 lock。Python 版本和 uv 工作区以 `backend/pyproject.toml`/`uv.lock` 为准。

| 范围 | 入口 |
| --- | --- |
| React | `python3 scripts/pnpm.py --dir frontend check`、`… test`；详见 `frontend/AGENTS.md` |
| Vue | `make -C frontend-vue verify`；e2e、跨端对比（`e2e-parity*`）等目标见 `make -C frontend-vue help` |
| backend | `cd backend && make lint && make test && make test-blocking-io`；详见 `backend/AGENTS.md` |
| 整站 | `make dev`、`make dev-vue`；端口见根 AGENTS 的服务拓扑 |

跨端对比测试的端口写在 `frontend-vue/playwright.parity*.config.ts` 里，可用环境变量覆盖。全量测试耗时长，放后台跑并等结果，免得会话一中断任务就终止。

## 6. 结果怎么记

- 写了代码只说明实现存在，不等于测试通过；通过与否看命令的直接退出码，管道 `tail`/`grep` 不能替代退出码。
- 每完成一项，把实际执行的命令和结果记进对齐计划（执行约定第 0.2.1 节第 7 条），不另建证据目录、哈希回执或 manifest。
- 没跑的、环境挡住的、外部服务没观察到的，分别如实写明，不伪造运行结果。

## 7. 换机器或换平台

成果都在 Git 里：clone `origin` 后切到 `main-wc`，按根 AGENTS 的 `make config`、`make install` 准备环境，私有配置走已有的安全渠道，不放进公开源码包。外接盘 `/Volumes/edisk/deer-flow/docs/reports/evidence/` 存放着 11 月之前的历史证据和合并取舍记录，只读、可选，接手不依赖它。

不要假定新平台继承上一个助手的记忆、技能、工具名、子代理或会话；先查可用能力，遵守新平台的沙箱与审批规则。

## 8. 接手完成的判定

新模型用文件和现场事实向用户说明：当前分支与提交、未提交改动、对齐计划进行到哪一阶段、已知失败、下一步。用户明确要开始后再动手。路径或能力缺失就如实记下缺口，先做不依赖它的只读工作。长报告、配置和脚本写成持久文件，回复里给绝对路径；沟通用中文。
