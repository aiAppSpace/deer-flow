# W00 调度契约生成与生产消费：Stage36

## 结论与输入边界

本轮修复 W00 的实际遗漏：调度功能已迁入 Vue，但生成器仍将
`scheduled_goal_notes_contract.json` 和 `scheduled_task_errors_contract.json`
登记为不消费，生产代码各自手写相同字符串。现在仓库根六份顶层契约全部进入实际生成，
这两份调度契约的已有 UI 字段由生产消费者直接读取或以生成类型约束完整映射。

生产文件于 **2026-10-10 02:18:10 CST** 冻结，七文件内容指纹
`431c25a0caf083d348ae65c5c0604536bbb7857a321814459e62a05d27c8d9c9`。
逐文件 SHA-256/mtime 见
[production-freeze.json](evidence/w00-scheduled-contract-stage36/production-freeze.json)。
React、后端输入契约、locale 文案、请求/路由、预算均未改变。

Stage35 Linux、Docker 和三本地入口的 PASS 属于 **pre-W00 输入**，保留其原始证据；
不能据此宣称本轮生成消费修改后的构建、浏览器或部署验收完成。

## 实现范围

| 文件                                              | 唯一职责与实际消费                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `frontend-vue/scripts/gen-contract-constants.mjs` | 两份调度契约移入真实读取清单；生成版本、host notes、目标分类、origin key、生命周期词汇和 UI error 类型；顶层契约全集划分约束保留 |
| `frontend-vue/app/core/contracts/backend.gen.ts`  | 脚本实际再生的签入产物；不手工维护常量                                                                                           |
| `app/core/scheduled-tasks/goal-outcome.ts`        | stop prefix/autopause/check-failure 分类直接读取生成值；去除 `blocked:` 后的 reason 映射按生成 union 完整覆盖                    |
| `app/core/scheduled-tasks/run-error.ts`           | host error 文本使用生成对象的值作为真实键，映射按生成 value union 完整覆盖                                                       |
| `app/core/scheduled-tasks/events.ts`              | 公共生命周期常量重新导出生成值；每个事件和每个 reason 的展示语义通过生成类型逐项覆盖，生产 dispatch 实际使用该映射               |
| `app/core/scheduled-tasks/errors.ts`              | UI 错误码映射通过生成 code union 完整覆盖；`limits_exhausted` 的两种既有分支保留                                                 |
| `app/core/scheduled-tasks/messages.ts`            | scheduled origin key 改为生成常量；消息来源解析流程保持原样                                                                      |

没有生成无人消费的 `notification_events` 或 `agent_only_codes`，也没有引入跨框架业务抽象。
所有当前中文/英文展示继续使用原 locale key。未知 goal/host/API error 保持原始 code/Details；
未知生命周期事件不显示，未知 finished reason 仍使用通用 finished 文案。
映射查找显式使用自身属性，避免 `constructor`、`__proto__`、`toString` 等未知值继承对象原型而
被误认成翻译键。

## 真实 RED → GREEN

新增生成器回归会复制脚本和根契约到隔离临时树，原契约始终不变。
最初运行 **3/3 FAIL，direct exit 1**：

1. 改变契约 stop prefix 后 `--check` 仍报告一致，说明登记没有进入实际生成。
2. 将再生模块交给真实 `goal-outcome.ts` 后，新 prefix 仍解析失败，说明消费者依赖手写值。
3. 再生新增码后，对真实四个消费者做 TypeScript 检查，没有缺失映射诊断。

[red.log](evidence/w00-scheduled-contract-stage36/red.log) 保留原始失败。
第一轮实现后的测试还发现 TypeScript 内层 reason 缺失诊断会掩盖外层 event 缺失诊断；
负控拆成独立 event/reason 变异后，所有预期缺口均被实际编译器捕获，未削减断言。
该中间记录见
[first-green-incomplete-diagnostic.log](evidence/w00-scheduled-contract-stage36/first-green-incomplete-diagnostic.log)。

最终回归验证：

- 实际生成脚本分别改变两个契约后，旧输出 `--check` 红，再生后绿。
- 使用实际再生模块的真实消费者识别新 stop prefix、autopause、host queue timeout、
  check-failure 分类和 scheduled origin；对应旧值不再被误认。
- 新增 unmet code、host error、lifecycle event、finished reason、paused reason、UI error code，
  对实际生产映射逐项得到缺失字段的 TypeScript 诊断。这里只替换生成文件，不复制消费者实现。
- 原 scheduled node/DOM 回归和现有所有英文/中文生命周期/host-error 消费继续通过；
  新覆盖所有 32 个 UI code 的双语文案及未知未来值/对象原型名回退。

## 验证结果

| 检查                                                  | 当前结果                                     |
| ----------------------------------------------------- | -------------------------------------------- |
| scheduled core/messages/相关 DOM + generator 变异负控 | **28 files / 362 tests PASS，direct exit 0** |
| Vue 应用类型                                          | **PASS，direct exit 0**                      |
| Vue 测试类型，含新增真实编译器负控                    | **PASS，direct exit 0**                      |
| 七实现/对应测试的 scoped ESLint                       | **PASS，direct exit 0**                      |
| 对应实现、测试、README/ARCHITECTURE 格式              | **PASS，direct exit 0**                      |
| `gen-contract-constants.mjs --check`                  | **PASS，direct exit 0**                      |
| 当前完整构建/统一浏览器/Linux/Docker/三入口           | **待 root 统一重跑，不复用 pre-W00 PASS**    |

原始输出位于
[证据目录](evidence/w00-scheduled-contract-stage36/)。
README 中英文已同步生成入口，ARCHITECTURE 已记录单一契约真相与完整映射约束。
后续统一验收结果由 root 执行总账记录，本报告不预先标记全项目完成。

## W07 四视图只读复核

根要求的后续只读复核已按当前生产调用点完成，没有发现需要继续改变生产的生成消费遗漏：

| 实际视图                                                    | 调用链与未知值边界                                                                                                                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScheduledTaskList.vue`                                     | `taskListStatusLine` → `presentTaskStatus` → `describeTaskLastError`；列表只使用既有本地化状态，不显示 host 原文                                                                                           |
| `ScheduledTaskDetail.vue`，含 outcome notice 与 run history | `describeTaskOutcome` 共用生成 host-note 解释；`ScheduledTaskRunRow` 使用 `describeGoalOutcome`/`describeRunError`，未知 code 和 evaluator 原文仅位于原 Details；动作错误共用 `describeScheduledTaskError` |
| 聊天 `ScheduledTaskCard.vue`                                | `presentTaskStatus`/`describeTaskOutcome` 共用同一生成 host notes；动作错误共用完整 UI code 映射；没有第二份 host 字符串判定                                                                               |
| 聊天 `ScheduledTaskEventLine.vue`                           | 实际调用 `describeTaskEvent`，包括完整 event/reason 映射、未知 event 不渲染、未知 finished reason 通用文案；后续渲染仍沿原 measured-row 位置，不改变事件归属                                               |

scheduled human 的 `ScheduledRunPrompt` 仍经 `scheduledOriginOf` 读取来源，生成 key 的
隔离变异测试已证明该真实消费链。生产目录搜索没有找到生成产物之外重复手写的 stop/autopause/
host-error 文本；reason/UI code 表中的键是有生成类型约束的本地化语义映射，不能删除这些必要表。

版本门禁保留：生成产物记录 goal-notes **v3**、task-errors **v1**，`make verify` 包含
`gen-contract-constants-check`，CI verify job 实际调用该聚合。goal 原有回归明确锁定 v3，
lifecycle 原有回归要求 v3+，并逐项读取真实根契约；新增变异回归验证生成过期与实际映射缺口。
这些是当前源码/局部门禁事实，不代替最终完整浏览器聚合。

额外门禁边界：本轮 docs guards 实际 **36 PASS / 1 FAIL**，唯一失败为并行新增正式用例后
CURRENT 仍写 886、实际已收集 889；root 持有最后 collector/文档收口。本轮误启动的
`consumer-check` 属于 agent-core 打包 clean install，沙箱 DNS `ENOTFOUND` 后主动停止自身
临时 pnpm 子进程，主命令 direct exit 1，父脚本完成临时目录清理。该检查没有得到 PASS，
不是本报告所称的“生成消费者负控”；后者是已通过的真实 generator/生产映射测试。
