/*
  【文件职责】     Scheduled-task 表单草稿、可提交判定与 Gateway payload 的纯逻辑。
  【架构位置】     L3 scheduled-task application core
  【主要导出】     ScheduledTaskDraft 与 create/edit/recipe/payload 转换函数
  【依赖关系】     recipes · schedule · types · api payload types
  【边界与注意】   Gateway 仅支持 once/cron；PATCH 只带 title/prompt/schedule_spec/timezone。

                   这里**不做校验**，也不抛异常。能不能提交由
                   `isScheduledTaskDraftComplete` 这一条谓词回答，它就是 React 那颗
                   Create 按钮 `disabled` 的取值；除此之外的输入（cron 语法、已经过去
                   的 run_at、不认识的时区）一律发给 Gateway，由 422 的 detail 回来。

                   此前 Vue 在这一层额外拦了三种情况（本地时间在该时区不存在、run_at
                   不在将来、时区不认识），每种带一句写死的英文文案。它们看起来是更好的
                   表单，但两个应用在同一次误操作上会说不同的话，而且那三句文案不在词典
                   里、不参与翻译。

                   `run_at` 在 draft 里就是 **UTC ISO**（ScheduleInput 已经转好），
                   所以 payload 直接搬运。`thread_id` 在 fresh 模式下显式发 `null` 而不是
                   省略——React 就是这么发的，Gateway 两种都接受，但"发了什么"是可比的。
*/
import type {
  ScheduledTaskCreatePayload,
  ScheduledTaskUpdatePayload,
} from "./api";
import type { Recipe } from "./recipes";
import type { ScheduleValue } from "./schedule";
import type { ScheduledTask } from "./types";

export type ScheduledTaskContextMode = "fresh_thread_per_run" | "reuse_thread";

export type ScheduledTaskDraft = {
  contextMode: ScheduledTaskContextMode;
  threadId: string;
  title: string;
  prompt: string;
  schedule: ScheduleValue;
};

function cloneSchedule(schedule: ScheduleValue): ScheduleValue {
  return {
    schedule_type: schedule.schedule_type,
    schedule_spec: { ...schedule.schedule_spec },
    timezone: schedule.timezone,
  };
}

/**
 * 新建表单的初始草稿。
 *
 * `timezone` 是空串，不是浏览器时区：ScheduleInput 挂载时会把检测到的时区发回来
 * （见该组件文件头），与 React 的 `createSchedule.timezone = ""` 一致。
 */
export function createScheduledTaskDraft(
  options: { routeThreadId?: string | null } = {},
): ScheduledTaskDraft {
  const routeThreadId = options.routeThreadId?.trim() ?? "";
  return {
    contextMode: routeThreadId ? "reuse_thread" : "fresh_thread_per_run",
    threadId: routeThreadId,
    title: "",
    prompt: "",
    schedule: {
      schedule_type: "cron",
      schedule_spec: { cron: "0 9 * * *" },
      timezone: "",
    },
  };
}

export function draftForScheduledTask(task: ScheduledTask): ScheduledTaskDraft {
  const spec = task.schedule_spec as { cron?: string; run_at?: string };
  return {
    contextMode: task.context_mode,
    threadId: task.thread_id ?? "",
    title: task.title,
    prompt: task.prompt,
    schedule: {
      schedule_type: task.schedule_type,
      schedule_spec: {
        cron: typeof spec.cron === "string" ? spec.cron : undefined,
        run_at: typeof spec.run_at === "string" ? spec.run_at : undefined,
      },
      timezone: task.timezone || "UTC",
    },
  };
}

/**
 * 应用一个 recipe。
 *
 * 只改 title / prompt / schedule / contextMode，**不清空** threadId：React 的
 * `applyRecipe` 没碰 `targetThreadId`，用户切回 reuse 时之前填的线程还在。
 */
export function applyScheduledTaskRecipe(
  draft: ScheduledTaskDraft,
  recipe: Recipe,
  localizedTitle: string,
): ScheduledTaskDraft {
  return {
    ...draft,
    contextMode: "fresh_thread_per_run",
    title: localizedTitle,
    prompt: recipe.prompt,
    schedule: cloneSchedule(recipe.schedule),
  };
}

/** React 那颗 Create 按钮 `disabled` 的反面，pending 由调用方另外并上。 */
export function isScheduledTaskDraftComplete(
  draft: ScheduledTaskDraft,
): boolean {
  const hasSchedule =
    Boolean(draft.schedule.schedule_spec.cron) ||
    Boolean(draft.schedule.schedule_spec.run_at);
  if (!draft.title || !draft.prompt || !hasSchedule) return false;
  return draft.contextMode !== "reuse_thread" || Boolean(draft.threadId);
}

export function buildScheduledTaskCreatePayload(
  draft: ScheduledTaskDraft,
): ScheduledTaskCreatePayload {
  return {
    context_mode: draft.contextMode,
    thread_id: draft.contextMode === "reuse_thread" ? draft.threadId : null,
    title: draft.title,
    prompt: draft.prompt,
    schedule_type: draft.schedule.schedule_type,
    schedule_spec: draft.schedule.schedule_spec,
    timezone: draft.schedule.timezone || "UTC",
  };
}

export function buildScheduledTaskUpdatePayload(
  draft: ScheduledTaskDraft,
): ScheduledTaskUpdatePayload {
  return {
    title: draft.title,
    prompt: draft.prompt,
    schedule_spec: draft.schedule.schedule_spec,
    timezone: draft.schedule.timezone || "UTC",
  };
}

/**
 * 从一条已有任务造一份**新建**草稿（复制任务）。
 *
 * 与 `draftForScheduledTask`（编辑用）的差别只在标题后缀：复制出来的那条如果
 * 与原任务同名，列表里两条一模一样，谁也分不出哪条是新的。其余字段照抄——
 * 复制的意义就是「和这条一样，我再改两处」。
 */
export function duplicateScheduledTaskDraft(
  task: ScheduledTask,
  titleSuffix: string,
): ScheduledTaskDraft {
  const draft = draftForScheduledTask(task);
  return { ...draft, title: `${draft.title}${titleSuffix}` };
}
