#!/usr/bin/env node
/*
  【文件职责】     从 <repo>/contracts/*.json 生成 app/core/contracts/backend.gen.ts，
                   让后端契约里的枚举、保留字与语法在 Vue 侧只有一份真相。
  【架构位置】     构建脚本
  【主要导出】     CLI：默认写文件；--check 校验签入产物与契约一致
  【依赖关系】     ../contracts/*.json（后端拥有，随 backend/ 同步上游）
  【边界与注意】   契约文件属于后端，**不复制**到本仓——每次生成都从原文件读。
                   后端改了契约，`make gen-contract-constants-check` 就红，
                   这是三层同步方案里唯一**阻断**的一层：它是上游变更能直接
                   让 Vue 功能损坏的路径。
                   产物签入，所以窄 context 的 Docker 构建不需要 contracts/ 也能编译。

                   **上面那句「唯一阻断的一层」以前只对点名的那几份成立**
                   （wave 106）：本文件按写死的文件名读三份契约，而
                   「`contracts/` 下还有没有第四份」没有任何机器在看——
                   后端新加一份契约，`--check` 照样绿，Vue 这边没有任何征兆。
                   现在 `CONSUMED` 与 `NOT_CONSUMED` 必须**恰好划分**
                   `contracts/*.json`：新来一份就得表态，要么接进来，要么写清
                   为什么当前 Vue 界面不消费它。上游新增功能尚未迁入 Vue 时，
                   明确记录原因；这不构成 React/Vue 完整对齐的证据。
*/

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONTRACTS = fileURLToPath(new URL("../../contracts/", import.meta.url));
const OUT = fileURLToPath(
  new URL("../app/core/contracts/backend.gen.ts", import.meta.url),
);

function readContract(name) {
  const path = `${CONTRACTS}${name}`;
  if (!existsSync(path)) {
    console.error(`缺少后端契约：${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/** 本脚本真的读进来、并且会进产物的契约。 */
const CONSUMED = [
  "subagent_status_contract.json",
  "slash_skill_contract.json",
  "run_event_stream_contract.json",
  "thread_origin_contract.json",
  "scheduled_goal_notes_contract.json",
  "scheduled_task_errors_contract.json",
];

/**
 * 认得、但前端用不到的契约：键是文件名，值是**为什么用不到**。
 * 空表是正常状态；往里加一条就是在说「这份契约前端故意不跟」。
 */
const NOT_CONSUMED = {};

/*
  读取由 CONSUMED 驱动，不是另写三行 readContract——否则那张表会与真正读了
  什么漂开，而「表里写着、其实没读」在报表上和真话长得一模一样（wave 83 的教训）。
*/
const contracts = Object.fromEntries(
  CONSUMED.map((name) => [name, readContract(name)]),
);
function contractOf(name) {
  const value = contracts[name];
  if (!value) {
    console.error(`契约 ${name} 不在 CONSUMED 里，生成不出来`);
    process.exit(1);
  }
  return value;
}

const subagent = contractOf("subagent_status_contract.json");
const slash = contractOf("slash_skill_contract.json");
const runEvents = contractOf("run_event_stream_contract.json");
const origin = contractOf("thread_origin_contract.json");
const scheduledGoal = contractOf("scheduled_goal_notes_contract.json");
const scheduledErrors = contractOf("scheduled_task_errors_contract.json");

/*
  两张表必须恰好等于 contracts/ 顶层的 json 全集。
  放在读取之后：契约目录整个不在时，`readContract` 那句友好的
  「缺少后端契约」先报，不让 readdirSync 抛一个难读的 ENOENT。
  只看顶层——`contracts/skill_review/` 是后端 skill-reviewer 的 JSON Schema，
  不是「前端要不要跟」的那种契约，它们不在这条判据的全集里。
*/
const onDisk = readdirSync(CONTRACTS, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort();
const declared = [...CONSUMED, ...Object.keys(NOT_CONSUMED)].sort();
if (declared.join("\n") !== onDisk.join("\n")) {
  const missing = onDisk.filter((name) => !declared.includes(name));
  const stale = declared.filter((name) => !onDisk.includes(name));
  console.error(
    "后端契约的表态不全：CONSUMED + NOT_CONSUMED 必须恰好等于 contracts/*.json。\n" +
      (missing.length ? `  没表态的契约：${missing.join("、")}\n` : "") +
      (stale.length ? `  表里有、盘上没有：${stale.join("、")}\n` : "") +
      "  新契约要么接进本脚本，要么写进 NOT_CONSUMED 并说明前端为什么用不到。",
  );
  process.exit(1);
}

const tuple = (values) =>
  `[\n${values.map((value) => `  ${JSON.stringify(value)},`).join("\n")}\n] as const`;

const aliasEntries = (runEvents.legacy_event_aliases ?? []).map(
  (alias) =>
    `  ${JSON.stringify(alias.event_type)}: ${JSON.stringify(alias.canonical_event_type)},`,
);
const hostRunErrors = Object.entries(scheduledGoal.host_run_errors).map(
  ([name, value]) => `  ${name}: ${JSON.stringify(value)},`,
);
const lifecycleReasons = Object.entries(scheduledGoal.lifecycle_reasons).map(
  ([event, reasons]) =>
    `  ${event}: [${reasons.map((reason) => JSON.stringify(reason)).join(", ")}],`,
);

const body = `/*
  由 scripts/gen-contract-constants.mjs 从 <repo>/contracts/*.json 生成，勿手改。
  改后端契约后运行 \`make gen-contract-constants\`；\`make verify\` 会校验一致性。
*/

/** 生成时各契约声明的版本号。契约做不兼容变更时这里会跟着变。 */
export const BACKEND_CONTRACT_VERSIONS = {
  subagentStatus: ${JSON.stringify(subagent.version)},
  slashSkill: ${JSON.stringify(slash.version)},
  runEventStream: ${JSON.stringify(runEvents.version)},
  threadOrigin: ${JSON.stringify(origin.version)},
  scheduledGoalNotes: ${JSON.stringify(scheduledGoal.version)},
  scheduledTaskErrors: ${JSON.stringify(scheduledErrors.version)},
} as const;

export const THREAD_ORIGIN_KEY = ${JSON.stringify(origin.key)};
export const THREAD_ORIGIN_KINDS = ${tuple(origin.kinds)};

/** \`ToolMessage.additional_kwargs.subagent_status\` 的合法取值。 */
export const SUBAGENT_STATUS_VALUES = ${tuple(subagent.valid_status_values)};
export type BackendSubagentStatus = (typeof SUBAGENT_STATUS_VALUES)[number];

/** \`subagent_stop_reason\` 的合法取值（附加字段，旧前端读不到也不会坏）。 */
export const SUBAGENT_STOP_REASON_VALUES = ${tuple(subagent.valid_stop_reason_values)};
export type BackendSubagentStopReason = (typeof SUBAGENT_STOP_REASON_VALUES)[number];

/** 占用前导斜杠的 composer 控制命令，永远不能当作技能激活。 */
export const RESERVED_SLASH_SKILL_NAMES = ${tuple(slash.reserved_slash_skill_names)};

/** 后端 \`parse_slash_skill_reference\` 使用的技能名语法。 */
export const SLASH_SKILL_PATTERN_SOURCE = ${JSON.stringify(slash.skill_name_pattern)};

/** run event 的分类维度。 */
export const RUN_EVENT_CATEGORIES = ${tuple(Object.keys(runEvents.categories))};
export type RunEventCategory = (typeof RUN_EVENT_CATEGORIES)[number];

/** 只读兼容：历史 event_type 到当前规范名的映射。新生产者不得使用左边的名字。 */
export const LEGACY_RUN_EVENT_ALIASES = {
${aliasEntries.join("\n")}
} as const;

/** Host-owned scheduled-task notes; readers must not duplicate their text. */
export const SCHEDULED_AGENT_STOP_LAST_ERROR_PREFIX =
  ${JSON.stringify(scheduledGoal.agent_stop_last_error_prefix)};
export const SCHEDULED_AUTO_PAUSE_LAST_ERROR =
  ${JSON.stringify(scheduledGoal.auto_pause_last_error)};
export const SCHEDULED_ORIGIN_KEY = ${JSON.stringify(scheduledGoal.scheduled_origin_key)};

export const SCHEDULED_GOAL_UNMET_REASON_CODES = ${tuple(scheduledGoal.unmet_reason_codes)};
export type BackendScheduledGoalUnmetReasonCode =
  (typeof SCHEDULED_GOAL_UNMET_REASON_CODES)[number];

export const SCHEDULED_GOAL_CHECK_FAILURE_CODES = ${tuple(scheduledGoal.check_failure_codes)};

export const SCHEDULED_HOST_RUN_ERRORS = {
${hostRunErrors.join("\n")}
} as const;
export type BackendScheduledHostRunError =
  (typeof SCHEDULED_HOST_RUN_ERRORS)[keyof typeof SCHEDULED_HOST_RUN_ERRORS];

export const SCHEDULED_TASK_LIFECYCLE_EVENTS = ${tuple(scheduledGoal.lifecycle_events)};
export type BackendScheduledTaskLifecycleEvent =
  (typeof SCHEDULED_TASK_LIFECYCLE_EVENTS)[number];

export const SCHEDULED_TASK_LIFECYCLE_REASONS = {
${lifecycleReasons.join("\n")}
} as const satisfies Record<BackendScheduledTaskLifecycleEvent, readonly string[]>;
export type BackendScheduledTaskLifecycleReason<
  Event extends BackendScheduledTaskLifecycleEvent,
> = (typeof SCHEDULED_TASK_LIFECYCLE_REASONS)[Event][number];

/** Codes returned to the UI; agent-only codes have no UI consumer. */
export const SCHEDULED_TASK_UI_ERROR_CODES = ${tuple(scheduledErrors.ui_codes)};
export type BackendScheduledTaskErrorCode =
  (typeof SCHEDULED_TASK_UI_ERROR_CODES)[number];
`;

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current === body) {
    console.log("后端契约常量与 contracts/*.json 一致。");
    process.exit(0);
  }
  console.error(
    "后端契约常量已过期：contracts/*.json 变了但 app/core/contracts/backend.gen.ts 没重新生成。\n" +
      "运行 `make gen-contract-constants`，然后检查引用这些常量的代码是否需要跟进。",
  );
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body, "utf8");
console.log(`已生成 ${OUT.split("frontend-vue/")[1]}`);
