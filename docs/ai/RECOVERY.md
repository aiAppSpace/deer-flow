# 换平台接手与恢复检查表

**当前整个计划暂停。** 本文是恢复说明，不是运行指令。用户只要求了解或完善文档时，不安装依赖、不恢复新副本、不启动构建/测试/服务、不修改产品；先完成只读接手。任务状态与完整范围以[CURRENT_TASK](CURRENT_TASK.md)指向的交接为准。

## 1. 打开哪个目录、在哪里执行

本机路径用作定位，不保证未来存在：

- ROOT：`/Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow`。
- COPY9：`/private/tmp/deerflow-restored-s7-public-source-l27y902m`（**2026-11-23 核对时已不存在**，当前适用第 2 节“同机 COPY9 消失”场景）。
- 证据根（2026-11-23 起）：`/Volumes/edisk/deer-flow/docs/reports/evidence/`。下文和历史报告中的 `docs/reports/evidence/...` 均指这里，ROOT 内已无该目录。外接盘为 exFAT，只放证据，不放候选源码或依赖；新候选的目录规划见 [2026-11-23 R03 恢复方案](../reports/2026-11-23-r03-resume-plan.md)。

| 工作 | 当前应使用的位置 | 原因与边界 |
| --- | --- | --- |
| 新平台第一次阅读 | ROOT中的AGENTS、docs/ai、最新交接/证据 | 当前候选归档不含后来新增的跨平台入口，不要只打开COPY9就期待有这些文件 |
| 核main-wc/上游包含关系、原WIP/待集成状态 | ROOT的Git与实际文件 | COPY9内可能是测试准备的公共Git fixture，不能拿它的HEAD/index当原仓历史 |
| 明确恢复R03后修改产品/单测/构建/浏览器 | 先核验，再使用COPY9或新恢复候选 | 当前原仓尚未集成最新修复，在ROOT运行会测到另一版本 |
| 运行host pnpm、模块Makefile | **候选自身**的scripts/pnpm.py和Makefile，cwd为该候选 | wrapper按自身路径确定仓库；只切cwd却仍调用ROOT绝对wrapper，仍会落到ROOT。`--dir`只接frontend或frontend-vue，不接绝对路径 |
| 保存新的日志、冻结、复核和交接 | ROOT的docs/reports/evidence下新label/新目录 | 保留旧原件；runner写到哪里以实际绑定为准，不能靠cwd猜 |
| 最后有界集成原仓 | 全R03闭环后，按新清单逐项应用到ROOT | 不整树复制，不覆盖私有配置、原WIP及新接手入口 |

同机新编辑器可以先打开ROOT读文档，再在其界面明确切到/加入候选目录。当前`deer-flow.code-workspace`只有`.`，没有自动挂载COPY9。不同平台如何挂载目录按其实际能力操作；本次没有创建或实测Cursor多根工作区配置。必须知道一次编辑/终端命令实际落在哪个目录。

用户明确恢复后，候选中的wrapper调用形如以下两条，**先将终端切到已核验候选根目录**；这里只展示定位方式，不要求暂停期间执行：

```sh
python3 scripts/pnpm.py --dir frontend check
python3 scripts/pnpm.py --dir frontend-vue exec vitest run tests/unit/parity tests/unit/agent-deerflow tests/unit/chat
```

第二条是当前停点既有相关回归范围，不是Vue全仓验收；仍须先修复并冻结新输入，其他静态/原生及全计划门禁按最新交接和原command receipt完成。不要复制文档里的`frontend|frontend-vue`到shell，它会被当作管道。

## 2. 先选择恢复场景

| 场景 | 先做的只读核对 | 获准恢复后再做 | 不能冒称 |
| --- | --- | --- | --- |
| 同机换编辑器/模型，ROOT和COPY9都在 | 核真实路径、源码/依赖冻结、两层文档增量、原Git/WIP和服务归属 | 核验一致后从当前停点继续；不必为换模型重装一遍或重做已接受增量 | 新平台自动拥有旧工具/权限/服务 |
| 同机COPY9消失，ROOT与证据仍在 | 核候选归档、manifest/receipt/原件齐全；确认ROOT不是最新候选 | 用经审查的恢复入口创建全新目录；正常锁安装、核运行时并新绑定runner | 只解压就已恢复依赖/浏览器/测试环境 |
| 换机/容器/远程workspace | 核第3节材料、当前路径/系统/工具条件、允许迁移的私有配置范围 | 建新ROOT/COPY路径映射和恢复回执，恢复本地历史/WIP语义，准备依赖并执行原门禁 | clone远端即可获得本地成果；旧index/路径字节必须与新机相同 |
| 候选源码归档或必要原件缺失 | 记录缺失的确切文件、原SHA/引用、可从哪个持久来源取回 | 先补材料；若无法恢复，保留缺证和需重验的门禁，完成独立可做的工作 | 从更早包默默重建并称与最新候选相同 |
| 平台没有终端/浏览器/独立review能力 | 确认能力缺口及可执行的只读工作 | 使用获准的实际工具或独立审查渠道；无法执行项继续标UNRUN/BLOCKED | 把主实现者自查、截图或文件阅读当独立复审/浏览器通过 |

本轮不停止或探测宿主服务；交接中端口关闭/PID是其记录时点。恢复执行前重新确认服务归属，保留其他项目服务。AiPPT不是关联项目，端口历史不建立业务关系。

## 3. 必须带走的材料：各自不能替代谁

这里描述用户授权迁移后应保留的内容，本轮**没有执行搬迁、打包整个工作区或传输私有数据**。

| 材料 | 当前来源 | 缺失的影响 |
| --- | --- | --- |
| 原仓本地Git历史与引用 | ROOT实际Git；main/main-wc及HEAD等由最新现场记录 | 本地ahead提交不一定在远端；clone或公共源码tar不保证包含HEAD对象、父链和分支。授权后的受控备份/bundle等须覆盖需要的本地refs；bundle本身不含工作树/index内容 |
| 原仓staged/unstaged/untracked改动 | ROOT实时Git状态、逐路径内容/差异；未跟踪源码和文档也算 | 不能只保存git diff而漏未跟踪文件，不能恢复后把全部WIP重新add。区分内容、暂存意图、文件mode/符号链接；Git私有目录/凭据按迁移边界处理 |
| 当前候选完整公共源 | H03的candidate-public-source.tar.gz及inputs/receipt | ROOT不是候选替身；tar只含5964公共文件+2example fixture，不含.git、依赖、构建、真实配置或全部历史证据 |
| 跨平台入口及其两轮增量 | ROOT的AGENTS/CLAUDE/Copilot/两旧开工文档、docs/ai；D1/D2目录（见第4节） | 候选tar没有新入口；只迁tar或远端仓库会丢当前导航与用户更正 |
| 完整范围/最新交接 | docs/reports/2026-11-03-vue-whole-plan-handoff.md及其链接的原计划、W/R/C/T/九架构/共同矩阵与历史限制 | 只拿当前三处类型错误会丢整计划，不能擅自缩为小修复 |
| 真实证据与恢复工具 | N01、N02、H03、D1、D2及其引用的更早报告/原件/命令/脚本/manifest/审查 | manifest或截图不代替原日志/body/附件；须保留传递引用，不能只拷最近日期目录。明确历史缺失Stage43不会因迁移自动补齐 |
| 固定依赖与正式补丁 | 两端package/lock/pnpm-workspace/patch文件，backend pyproject/uv.lock及工具准备合同 | 不从缓存node_modules反推依赖，不只迁lock漏patch；新环境正常安装并核实际入口 |
| 实际配置/运行数据（若任务需要） | 用户管理的安全配置和所需持久化数据 | 公共fixture不能代替真实生产配置；真实key/cookie/数据库不进入公开材料，不能默认搬迁或启动真实外部调用 |

H03、N01、N02是文档简称：

- [H03保全目录](../reports/evidence/handoff-2026-11-03/README.md)；候选归档SHA为`6d1e02d21dce8df254b81a1635f73c7c267a78f76977affdb31169ac9c5747cd`，精确清单在[candidate-public-source-inputs.json](../reports/evidence/handoff-2026-11-03/candidate-public-source-inputs.json)。
- N01=`docs/reports/evidence/resume-2026-11-01`，含原公开基线/保护记录、依赖准备和早期实际证据。
- N02=`docs/reports/evidence/resume-2026-11-02`，含当前run-consumer-v4冻结、run-projection-v4限定接受及最近actual-v3失败原件。

迁移前后应有文件清单与内容SHA、归档成员/路径/唯一性核对及缺失报告。若只迁任务最小集合，必须先核完整引用闭包，不能凭文件夹日期截断。受保护.git和真实配置须走明确授权的私密传递方式；不要把凭据和hooks一起复制执行来凑旧哈希。公共源恢复与完整开发现场恢复是两件事。

## 4. 验证文档与源码的层次

1. **产品基线**：N02/package-run-consumer-v4/source-frozen.json及runtime-frozen.json；ROOT历史公开基线为N01/r00-public.json。H03保存完整公共候选；产品代码本轮不变。
2. **D1首次入口文档增量**：`docs/reports/evidence/portable-onboarding-2026-11-03/document-delta.json`，记录4份原公开文档before→after和首版4份docs/ai。4原文件before必须等于N01对应值；4原文件after至今不变。
3. **D2本次复核增量**：`docs/reports/evidence/portable-onboarding-review-2026-11-03/document-delta.json`，承接D1中3份docs/ai的精确before→after，新增RECOVERY。PROJECT_RELATIONSHIPS保持D1原值。当前指针以D2为最新；不是让旧D1哈希随新文本改写。
4. 同机原现场核原index/private/hooks字节可判是否被改；换机/重新初始化Git时不能直接要求index字节相同。应证明提交/分支对象和所需staged/unstaged/untracked语义保持，源/patch/lock内容与权限所允许的数据一致，并为新环境生成新的状态回执。新机缺node_modules是尚未安装，不是自动判产品被改。
5. 旧N01/H03/D1验证脚本只绑定当时文件集合及目录。D1现在会因其3份docs/ai已被本次修订而拒绝旧哈希，这是预期文档变化；不要删除旧断言、改旧manifest，或把所有docs豁免。用能核对D1→D2链的新只读回执解释差异。意外的其他差异仍须单列并处理。

新同机只读核验入口与回执在[D2复核记录](../reports/evidence/portable-onboarding-review-2026-11-03/README.md)。本轮脚本不是通用跨机恢复程序；换机必须先审路径和依赖条件，再在新证据目录创建适用的新核验入口。

## 5. 旧脚本的具体绑定与换机限制

| 工具/记录 | 当前绑定 | 恢复时必须处理 |
| --- | --- | --- |
| H03 restore-public-source.py | 默认目录`/private/tmp`，读脚本旁的tar/inputs/receipt；只创建公共源码 | 只在收到恢复指令后执行；Linux/Windows不保证此目录/模式语义可用，先审查并建立新平台入口。原脚本保留 |
| N01 prepare-frozen-dependencies-online.py | s7目录前缀、final-source-frozen与dependencies-ready约束 | 不对恢复助手的新前缀盲跑，生成新准备元数据/入口并正常安装 |
| N02 run-check.py/freeze.py及原生runner | 读取旧copy-path.txt，部分历史配置/导入/testDir/outputDir/reporter为绝对路径 | 新执行目录复制并审查完整绑定；更改cwd或label本身不足；旧receipt/copy-path不改写 |
| source/runtime/边界回执 | `copy`、`resolved`及已记录文件路径常是原机器绝对路径 | 建立旧ROOT→新ROOT、旧COPY→新COPY的显式映射；逐内容SHA复核，生成新的位置回执，不改原证据声称原先在新机运行 |
| 旧verification/final-boundary | 写入时拒绝覆盖已有输出，旧schema/文档哈希与路径绑定 | 先读工具接口，以新输出/新label记录；不能重跑失败后误判业务缺陷或覆写原结果 |
| 原Git保护快照 | 旧index字节、hooks和私有配置hash | 同机原现场与新机恢复采用不同判据；不输出私密值，不自动运行旧hooks |

正式安装仍使用实际候选的wrapper和锁；两端显式frozen+strict，backend按锁与browser extra。操作系统/CPU架构、Node/Python/uv、浏览器/字体及平台视觉基线均须记录。新平台不能直接借用Darwin/Linux旧运行结果，也不能因工具缺失删门禁。

## 6. 接手确认单：第一次回复要能回答

先用文件事实简短确认以下内容，不能只回“已理解”：

1. 本次任务是只读/文档还是用户已明确恢复？当前整个计划是否暂停？
2. ROOT与候选各在哪里，产品修改/命令实际会落在哪棵树？候选是否已存在并核验？
3. 原分支/HEAD/WIP怎样；当前内容来自本地现场、候选归档还是远端clone？不能用候选Git替代原仓Git。
4. 最后限定接受是什么、当前未接受是什么、最后真实失败是什么？这里三者分别为run-projection-v4、run-consumer-v4、actual-v3 16P12F；以最新交接更新。
5. v4尚有三处startedAt类型错误、1632相关单测通过不等于静态/实际通过；完整W/R/C/T/九架构/共同矩阵仍在，没有缩范围。
6. D1/D2文档链与产品冻结如何区分；何处有旧hash/绝对路径，哪些工具不能直接重跑？
7. 证据、Git本地历史、候选、运行能力或权限若缺失，哪些是BLOCKED/UNRUN？哪些只读工作仍可继续？
8. 用户授权恢复后的第一步是什么，结束时将在哪里保存新命令/日志/审查和交接？

只有文件内容核验、路径归属和能力缺口明确，才算完成只读接手准备。当前材料尚未实际在Cursor新会话、另一模型或另一机器上演练，不能保证任何环境零配置无缝运行；这项限制不允许降低原计划验收要求，也不授权在本次暂停期间进行演练。
