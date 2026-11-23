import type { ParityDimension, ParityScenario } from "./scenarios";
import type {
  MockScheduledTask,
  MockScheduledTaskRun,
} from "../../e2e/utils/mock-api";
import { liveMinuteTake, liveTake } from "../../e2e/utils/scheduled-fixtures";
const dimensions: ParityDimension[] = [
  { viewport: "desktop", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "light", locale: "zh-CN" },
  { viewport: "mobile", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "dark", locale: "en-US" },
];
const base: MockScheduledTask = {
  id: "task-1",
  title: "Daily summary",
  prompt: "Summarize the latest changes",
  thread_id: "thread-1",
  context_mode: "reuse_thread",
  assistant_id: null,
  schedule_type: "cron",
  schedule_spec: { cron: "0 9 * * *" },
  timezone: "UTC",
  status: "enabled",
  next_run_at: "2030-01-02T09:00:00Z",
  last_run_at: "2030-01-01T09:00:00Z",
  last_run_id: "run-1",
  last_error: null,
  run_count: 51,
  created_at: "2030-01-01T00:00:00Z",
  updated_at: "2030-01-01T09:00:00Z",
};
const limited: MockScheduledTask = {
  ...base,
  id: "limited",
  title: "Limited digest",
  thread_id: null,
  context_mode: "fresh_thread_per_run",
  status: "paused",
  max_runs: 3,
  automatic_runs_used: 3,
  goal_objective: "Finish the checklist",
  stop_condition: "Every entry is checked",
  origin_thread_id: "thread-1",
  standing_notes: ["Only use verified sources"],
};
const finished: MockScheduledTask = {
  ...limited,
  id: "finished",
  title: "Finished digest",
  status: "completed",
};
const queued: MockScheduledTask = {
  ...base,
  id: "queued",
  title: "Queued digest",
  active_run_status: "queued",
};
const history: MockScheduledTaskRun[] = Array.from(
  { length: 51 },
  (_, index) => ({
    id: `task-run-${index}`,
    task_id: "task-1",
    thread_id: "thread-1",
    run_id: `run-${index}`,
    trigger: index % 2 ? "manual" : "scheduled",
    status: index === 0 ? "unmet" : "success",
    goal_objective: index === 0 ? "Finish the checklist" : null,
    error: index === 0 ? "blocked:missing_evidence" : null,
    attempt_count: 1,
    scheduled_for: "2030-01-01T09:00:00Z",
    started_at: "2030-01-01T09:00:00Z",
    finished_at: "2030-01-01T09:01:00Z",
    created_at: "2030-01-01T09:00:00Z",
  }),
);
const minute = liveMinuteTake(),
  weekday = liveTake("weekday");
/** Current product states, shared verbatim between the two frontends. Root catalog spreads this array. */
const scheduledPage: ParityScenario[] = [
  {
    id: "scheduled-tasks",
    title: "定时任务页面、表单、历史与聊天调度",
    backend: "mock",
    path: "/workspace/scheduled-tasks",
    settle: [],
    dimensions,
    mock: {
      threads: [minute.chatThread, minute.runThread, weekday.chatThread],
      scheduledTasks: [
        base,
        limited,
        finished,
        queued,
        minute.task,
        weekday.task,
      ],
      scheduledTaskRuns: {
        "task-1": history,
        [minute.task.id]: minute.runs,
        [weekday.task.id]: weekday.runs,
      },
      scheduledTaskEvents: {
        [minute.chatThread.thread_id]: [
          {
            id: "event-stopped",
            task_id: minute.task.id,
            event: "task_stopped",
            reason_code: "agent_stop",
            task_title: minute.task.title,
            stop_condition: minute.task.stop_condition,
            run_thread_id: minute.runThread.thread_id,
            run_number: 2,
            run_status: "success",
            schedule_type: "interval",
            after_run_id: null,
            created_at: "2026-10-07T09:00:00Z",
          },
        ],
      },
    },
    states: [
      {
        id: "default",
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-item-task-1" } },
          { kind: "visible", target: { testId: "scheduled-task-detail" } },
          { kind: "visible", target: { testId: "scheduled-task-run-list" } },
        ],
      },
      {
        id: "create",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(New task|新建任务)$/ },
          },
          { kind: "visible", target: { testId: "scheduled-task-form" } },
          { kind: "visible", target: { testId: "schedule-preset" } },
          { kind: "visible", target: { testId: "schedule-timezone" } },
        ],
      },
      {
        id: "create-interval",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(New task|新建任务)$/ },
          },
          {
            kind: "click",
            target: { role: "button", name: /^(Interval|间隔)$/ },
          },
          { kind: "visible", target: { testId: "schedule-interval-unit" } },
          { kind: "visible", target: { testId: "schedule-preview" } },
        ],
      },
      {
        id: "edit",
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-detail" } },
          { kind: "click", target: { role: "button", name: /^(Edit|编辑)$/ } },
          { kind: "visible", target: { testId: "scheduled-task-form" } },
          {
            kind: "visible",
            target: { role: "button", name: /^(Save changes|保存修改)$/ },
          },
        ],
      },
      {
        id: "paused-filter",
        steps: [
          {
            kind: "click",
            target: { role: "radio", name: /^(Paused|已暂停)/ },
          },
          {
            kind: "visible",
            target: { testId: "scheduled-task-item-limited" },
          },
          { kind: "visible", target: { testId: "scheduled-task-detail" } },
        ],
      },
      {
        id: "search-no-results",
        steps: [
          {
            kind: "fill",
            target: { role: "searchbox", name: /^(Search tasks|搜索任务)$/ },
            value: "no-such-schedule",
          },
          {
            kind: "visible",
            target: {
              text: /^(No tasks match your search and filters\.|没有符合搜索内容和筛选条件的任务。)$/,
            },
          },
        ],
      },
      {
        id: "older-history",
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-run-list" } },
          {
            kind: "click",
            target: { role: "button", name: /^(Older runs|更早的运行)$/ },
          },
          { kind: "visible", target: { text: /^(Page 2|第 2 页)$/ } },
        ],
      },
      {
        id: "renew-limit",
        path: "/workspace/scheduled-tasks?task_id=limited",
        routes: [
          {
            pattern: "**/api/scheduled-tasks/limited/resume",
            status: 409,
            json: {
              detail: {
                code: "limits_exhausted",
                message: "The safety cap is exhausted",
                params: { limit: "max_runs", max_runs: 3, used: 3 },
              },
            },
          },
        ],
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-detail" } },
          {
            kind: "click",
            target: { role: "button", name: /^(Resume|恢复)$/ },
          },
          { kind: "visible", target: { role: "dialog" } },
        ],
      },
      {
        id: "queued-delete",
        path: "/workspace/scheduled-tasks?task_id=queued",
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-detail" } },
          {
            kind: "click",
            target: { role: "button", name: /^(More actions|更多操作)$/ },
          },
          {
            kind: "click",
            target: { role: "menuitem", name: /^(Delete|删除)$/ },
          },
          {
            kind: "visible",
            target: {
              selector:
                '[role="dialog"] button:is(:text-is("Delete"), :text-is("删除"))',
            },
          },
        ],
      },
      {
        id: "load-failed",
        routes: [
          {
            pattern: "**/api/scheduled-tasks",
            status: 503,
            json: { detail: "Temporary outage" },
          },
        ],
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-load-error" } },
        ],
      },
      {
        id: "missing-deep-link",
        path: "/workspace/scheduled-tasks?task_id=missing",
        steps: [
          {
            kind: "visible",
            target: { testId: "scheduled-task-link-missing" },
          },
        ],
      },
      {
        id: "scheduler-off",
        routes: [
          {
            pattern: "**/api/features",
            json: {
              agents_api: { enabled: true },
              browser_control: { enabled: true },
              scheduled_tasks: {
                available: true,
                running: false,
                tool_enabled: true,
                min_interval_seconds: 60,
              },
            },
          },
        ],
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-detail" } },
          { kind: "visible", target: { testId: "scheduler-off-notice" } },
        ],
      },
      {
        id: "chat-card",
        path: `/workspace/chats/${weekday.chatThread.thread_id}`,
        steps: [{ kind: "visible", target: { testId: "scheduled-task-card" } }],
      },
      {
        id: "scheduled-origin",
        path: `/workspace/chats/${minute.runThread.thread_id}`,
        steps: [
          { kind: "visible", target: { testId: "scheduled-run-prompt" } },
        ],
      },
      {
        id: "lifecycle-event",
        path: `/workspace/chats/${minute.chatThread.thread_id}`,
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-event-line" } },
        ],
      },
    ],
  },
];

const page = scheduledPage[0]!;
const takeStates = (...ids: string[]) =>
  page.states!.filter((state) => ids.includes(state.id));
function dstOnceSteps(
  value: string,
  invalid: boolean,
): import("./scenarios").ParityStep[] {
  return [
    {
      kind: "click",
      target: { role: "button", name: /^(New task|新建任务)$/ },
    },
    { kind: "click", target: { role: "button", name: /^(One-time|单次)$/ } },
    {
      kind: "fill",
      target: { role: "textbox", name: /^(Title|标题)$/ },
      value: "DST task",
    },
    {
      kind: "fill",
      target: { role: "textbox", name: /^(Instructions|任务指令)$/ },
      value: "Summarize",
    },
    { kind: "click", target: { testId: "schedule-timezone" } },
    { kind: "click", target: { role: "option", name: /^America\/New_York$/ } },
    {
      kind: "fill",
      target: {
        selector:
          'input[type="datetime-local"]:is([aria-label="Run at"], [aria-label="运行时间"])',
      },
      value,
    },
    { kind: invalid ? "visible" : "hidden", target: { role: "alert" } },
    { kind: "visible", target: { testId: "schedule-preview" } },
  ];
}
/** Each current React spec gets its own declared product surface; no pending exemption. */
export const SCHEDULED_PARITY_SCENARIOS: ParityScenario[] = [
  {
    ...page,
    states: page.states!.filter(
      (state) =>
        ![
          "paused-filter",
          "search-no-results",
          "older-history",
          "chat-card",
          "scheduled-origin",
          "lifecycle-event",
        ].includes(state.id),
    ),
  },
  {
    ...page,
    id: "scheduled-task-search",
    title: "调度搜索、状态过滤与不存在的深链接",
    states: takeStates(
      "paused-filter",
      "search-no-results",
      "missing-deep-link",
    ),
  },
  {
    ...page,
    id: "scheduled-run-history",
    title: "单页运行历史与旧页暂停轮询",
    states: takeStates("default", "older-history"),
  },
  {
    ...page,
    id: "scheduled-goal-history",
    title: "运行目标、安全上限与显式续期",
    states: [
      {
        id: "goal-cap-reached",
        path: "/workspace/scheduled-tasks?task_id=finished",
        steps: [
          { kind: "visible", target: { testId: "scheduled-task-outcome" } },
          {
            kind: "visible",
            target: { role: "button", name: /^(Extend limit|延长上限)$/ },
          },
        ],
      },
      ...takeStates("renew-limit"),
    ],
  },
  {
    ...page,
    id: "scheduled-task-chat-card",
    title: "聊天调度工具卡片",
    states: takeStates("chat-card"),
  },
  {
    ...page,
    id: "scheduled-task-chat-events",
    title: "任务生命周期事件与删除后保留的历史",
    states: takeStates("lifecycle-event"),
  },
  {
    ...page,
    id: "scheduled-run-thread",
    title: "自动调度会话的结构化只读输入",
    states: takeStates("scheduled-origin"),
  },
  {
    ...page,
    id: "scheduled-tasks-dst",
    title: "一次性时间的时区与精度编辑",
    states: [
      {
        id: "nonexistent-local-time",
        steps: dstOnceSteps("2027-03-14T02:30", true),
      },
      {
        id: "corrected-instant",
        steps: dstOnceSteps("2027-03-14T03:30", false),
      },
    ],
  },
];
