/*
  【文件职责】     为浏览器合同测试提供一个 Gateway 的 route-level mock。
  【架构位置】     测试基础设施
  【主要导出】     mockLangGraphAPI / handleRunStream / MOCK_THREAD_ID /
                   MOCK_THREAD_ID_2 / MOCK_SIDECAR_THREAD_ID / MOCK_RUN_ID
  【依赖关系】     @playwright/test（仅类型）
  【边界与注意】   这是本仓自有的 mock。它描述的是 **Gateway 的 HTTP/SSE 行为**，
                   不是任何一个前端的实现——所以判断它对不对，看的是 backend 的路由与
                   contracts/*.json，不是另一个前端怎么写的。
                   后端契约变了要改这里；改动会同时影响所有消费它的 spec。
*/

/**
 * Shared mock helpers for E2E tests.
 *
 * Intercepts all LangGraph / Backend API endpoints so tests can run without
 * a real backend.  Each test file imports `mockLangGraphAPI` and
 * `handleRunStream` from here.
 */

import {
  installProjectGatewayMock,
  type ProjectMockOptions,
} from "../../support/project-gateway-mock";
import { mockCapabilityCatalog } from "../../support/capability-fixtures";

import type { Agent } from "@/core/agents/types";
import type { BrowserContext, Page, Route } from "@playwright/test";

import { threadIdFromRequest } from "./thread-request";

export type {
  MockProject,
  MockProjectDocument,
  MockTrashDocument,
  MockThreadFileGroup,
} from "../../support/project-gateway-mock";

// ---------------------------------------------------------------------------
// Constants — deterministic IDs used across tests
// ---------------------------------------------------------------------------

export const MOCK_THREAD_ID = "00000000-0000-0000-0000-000000000001";
export const MOCK_THREAD_ID_2 = "00000000-0000-0000-0000-000000000002";
export const MOCK_SIDECAR_THREAD_ID = "00000000-0000-0000-0000-0000000000aa";
export const MOCK_RUN_ID = "00000000-0000-0000-0000-000000000099";
// Keep in sync with frontend runtime thread utils and the backend thread_meta
// constant; the mock must mirror the same metadata contract for pin ordering.
export const THREAD_PINNED_METADATA_KEY = "deerflow_pinned";

const MOCK_AUTH_USER = {
  id: "default",
  email: "default@test.local",
  system_role: "admin",
  needs_setup: false,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MockThread = {
  unread?: boolean;
  thread_id: string;
  title?: string;
  updated_at?: string;
  agent_name?: string;
  metadata?: Record<string, unknown>;
  messages?: unknown[];
  artifacts?: string[];
  /** Current Gateway capture registry, independent of either UI implementation. */
  tool_artifacts?: Record<string, unknown>[];
  goal?: Record<string, unknown> | null;
  /*
    真后端的 channel values 里有 `todos`（`app/core/threads/types.ts` 的
    `AgentThread["values"]`），产品也读它——而这份 mock 在 2026-09-12
    第十八轮之前**从来不吐它**，于是任何 `backend: "mock"` 的用例都看不见
    待办列表那一屏。与上面 `threadChannelValues` 注释里记的
    「此前 GET /threads/{id} 复用了 search 的投影，比真后端少了 messages
    与 artifacts」是同一种保真度缺口。
  */
  todos?: {
    content?: string;
    status?: "pending" | "in_progress" | "completed";
  }[];
};

/** Input fixtures may omit defaults; mockLangGraphAPI normalizes the complete Gateway response. */
export type MockAgent = Pick<Agent, "name"> & Partial<Agent>;

export type MockSkill = {
  name: string;
  description: string;
  category?: string;
  license?: string | null;
  enabled?: boolean;
};

export type MockScheduledTask = {
  id: string;
  thread_id: string | null;
  context_mode?: "fresh_thread_per_run" | "reuse_thread";
  assistant_id?: string | null;
  last_thread_id?: string | null;
  title: string;
  prompt: string;
  schedule_type: "once" | "cron" | "interval";
  schedule_spec: Record<string, unknown>;
  timezone: string;
  status:
    "enabled" | "paused" | "running" | "completed" | "failed" | "cancelled";
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_id: string | null;
  last_error: string | null;
  run_count: number;
  goal_objective?: string | null;
  max_runs?: number | null;
  end_at?: string | null;
  origin_thread_id?: string | null;
  standing_notes?: string[] | null;
  stop_condition?: string | null;
  automatic_runs_used?: number;
  active_run_status?: "queued" | "launching" | "running" | null;
  created_at: string;
  updated_at: string;
};

export type MockScheduledTaskRun = {
  id: string;
  task_id: string;
  thread_id: string | null;
  run_id: string | null;
  scheduled_for: string;
  trigger: "scheduled" | "manual";
  status:
    | "queued"
    | "launching"
    | "running"
    | "success"
    | "unmet"
    | "failed"
    | "skipped"
    | "interrupted";
  error: string | null;
  goal_objective?: string | null;
  goal_verdict?: Record<string, unknown> | null;
  stop_requested_run_id?: string | null;
  attempt_count?: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  run_number?: number | null;
  total_tokens?: number | null;
  summary?: string | null;
};

/** Fill the response fields newer backends always send, so older fixtures stay valid. */
function scheduledTaskResponse(task: MockScheduledTask) {
  return {
    context_mode: "fresh_thread_per_run",
    last_thread_id: null,
    assistant_id: null,
    goal_objective: null,
    max_runs: null,
    end_at: null,
    origin_thread_id: null,
    standing_notes: [],
    stop_condition: null,
    automatic_runs_used: 0,
    active_run_status: null,
    ...task,
    thread_id: task.thread_id ?? null,
  };
}

function scheduledTaskNotFound(route: Route) {
  return route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({
      detail: { code: "task_not_found", message: "Scheduled task not found" },
    }),
  });
}

const CLEARABLE_TASK_FIELDS = [
  "goal_objective",
  "max_runs",
  "end_at",
  "stop_condition",
] as const;

/** PATCH/resume semantics: a present key replaces the value; `null` clears the clearable fields. */
function applyClearableTaskFields(
  task: MockScheduledTask,
  payload: Record<string, unknown>,
): MockScheduledTask {
  const next: MockScheduledTask = { ...task };
  for (const key of CLEARABLE_TASK_FIELDS) {
    if (!(key in payload)) continue;
    const value = payload[key];
    if (value === null || value === "") {
      next[key] = null;
    } else if (key === "max_runs" && typeof value === "number") {
      next.max_runs = value;
    } else if (key !== "max_runs" && typeof value === "string") {
      next[key] = value;
    }
  }
  return next;
}

export type MockScheduledTaskEvent = {
  id: string;
  task_id: string;
  event: "task_stopped" | "task_paused" | "task_finished";
  reason_code: string;
  task_title?: string | null;
  stop_condition?: string | null;
  run_thread_id?: string | null;
  run_number?: number | null;
  run_status?: MockScheduledTaskRun["status"] | null;
  max_runs?: number | null;
  end_at?: string | null;
  schedule_type?: "once" | "cron" | "interval" | null;
  after_run_id?: string | null;
  created_at: string;
};

function scheduledTaskEventResponse(event: MockScheduledTaskEvent) {
  return {
    task_title: null,
    stop_condition: null,
    run_thread_id: null,
    run_number: null,
    run_status: null,
    max_runs: null,
    end_at: null,
    schedule_type: null,
    after_run_id: null,
    ...event,
  };
}

/** One server-originated run change reported by the mocked `/api/thread-activity`. */
export type MockThreadActivityEntry = {
  thread_id: string;
  /** Default `"schedule"`; `null` is the caller's own interactive run (never listed). */
  origin_kind?: "schedule" | "im_channel" | "github" | "extension" | null;
  status?: string;
};

/** Handles a spec can use to drive the mocked backend after `mockLangGraphAPI`. */
export type MockAPIController = {
  /** Add or replace a thread in the thread search results. */
  upsertThread: (thread: MockThread) => void;
  /** Record run changes; the next activity poll after the seed returns them. */
  pushThreadActivity: (...entries: MockThreadActivityEntry[]) => void;
  /** Simulate a read on another device (raises `read_version`). */
  bumpReadVersion: () => void;
  /**
   * Replace the scheduled tasks every task route serves (the list, one task,
   * a chat's tasks), e.g. to flip a task to paused or delete it.
   */
  setScheduledTasks: (tasks: MockScheduledTask[]) => void;
  /** Replace the lifecycle events of an originating chat. */
  setScheduledTaskEvents: (
    threadId: string,
    events: MockScheduledTaskEvent[],
  ) => void;
  /** Thread ids of every `POST /api/threads/{id}/read`, in order. */
  readonly readRequests: readonly string[];
};

export type MockAPIOptions = ProjectMockOptions & {
  threads?: MockThread[];
  agents?: MockAgent[];
  skills?: MockSkill[];
  scheduledTasks?: MockScheduledTask[];
  scheduledTaskEvents?: Record<string, MockScheduledTaskEvent[]>;
  /** 按 task id 预置的运行历史；不给就是空的，只有 trigger 才会长出一条。 */
  scheduledTaskRuns?: Record<string, MockScheduledTaskRun[]>;
  uploadLimits?: {
    max_files: number;
    max_file_size: number;
    max_total_size: number;
  };
  features?: {
    agentsApiEnabled?: boolean;
    browserControlEnabled?: boolean;
    knowledgeScopeSelectionEnabled?: boolean;
    threadActivity?: { available?: boolean };
    scheduledTasks?: {
      available?: boolean;
      running?: boolean;
      toolEnabled?: boolean;
      minIntervalSeconds?: number;
    };
  };
};

const DEFAULT_SKILLS: MockSkill[] = [
  {
    name: "data-analysis",
    description: "Analyze structured data and produce charts.",
    category: "public",
    enabled: true,
  },
  {
    name: "frontend-design",
    description: "Create polished frontend interfaces.",
    category: "public",
    enabled: true,
  },
  {
    name: "disabled-skill",
    description: "Hidden from slash autocomplete.",
    category: "public",
    enabled: false,
  },
];

function isHiddenInputMessage(message: unknown) {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  const additionalKwargs = Reflect.get(message, "additional_kwargs");
  return (
    typeof additionalKwargs === "object" &&
    additionalKwargs !== null &&
    Reflect.get(additionalKwargs, "hide_from_ui") === true
  );
}

function visibleInputMessages(messages: unknown[]) {
  return messages.filter((message) => !isHiddenInputMessage(message));
}

function mockMessageRunId(message: unknown, fallback: string) {
  if (typeof message === "object" && message !== null) {
    const runId = Reflect.get(message, "run_id");
    if (typeof runId === "string" && runId.length > 0) {
      return runId;
    }
  }
  return fallback;
}

function visibleRunInputMessages(route: Route) {
  try {
    const body = route.request().postDataJSON() as {
      input?: { messages?: unknown[] };
    };
    return visibleInputMessages(body.input?.messages ?? []);
  } catch {
    return [];
  }
}

function messageId(message: unknown): string | undefined {
  if (typeof message !== "object" || message === null) {
    return undefined;
  }
  const raw = Reflect.get(message, "id");
  return typeof raw === "string" ? raw : undefined;
}

function branchMessagesFromTurn(messages: unknown[], targetIds: Set<string>) {
  let targetEndIndex = -1;
  for (const [index, message] of messages.entries()) {
    const id = messageId(message);
    if (id && targetIds.has(id)) {
      targetEndIndex = Math.max(targetEndIndex, index);
    }
  }
  return targetEndIndex >= 0 ? messages.slice(0, targetEndIndex + 1) : messages;
}

function mockStreamMessages(route?: Route, inputMessages?: unknown[]) {
  const submittedMessages = inputMessages
    ? visibleInputMessages(inputMessages)
    : route
      ? visibleRunInputMessages(route)
      : [];
  const responseMessage = {
    type: "ai",
    id: "msg-ai-1",
    content: "Hello from DeerFlow!",
  };
  if (submittedMessages.length > 0) {
    return [...submittedMessages, responseMessage];
  }

  return [
    {
      type: "human",
      id: "msg-human-1",
      content: [{ type: "text", text: "Hello" }],
    },
    responseMessage,
  ];
}

function runStreamThreadId(route: Route) {
  const pathThreadId = /\/threads\/([^/]+)\/runs\/stream/.exec(
    new URL(route.request().url()).pathname,
  )?.[1];
  if (pathThreadId) {
    return pathThreadId;
  }

  try {
    const body = route.request().postDataJSON() as {
      thread_id?: string;
      threadId?: string;
      context?: { thread_id?: string };
      config?: { configurable?: { thread_id?: string } };
    };
    return (
      body.thread_id ??
      body.threadId ??
      body.context?.thread_id ??
      body.config?.configurable?.thread_id ??
      MOCK_THREAD_ID
    );
  } catch {
    return MOCK_THREAD_ID;
  }
}

// ---------------------------------------------------------------------------
// mockLangGraphAPI
// ---------------------------------------------------------------------------

/**
 * Mock all LangGraph API endpoints that the frontend calls on page load and
 * during message sending.  Without these mocks the pages would hang waiting
 * for a real backend.
 */
/**
 * 把一切**离开本机的** http(s) 请求就地答掉，绝不真的出网。
 *
 * 为什么要有这条（2026-09-08 实测）：`integrations.spec.ts` 里那条 Lark 授权流程会
 * `globalThis.open("about:blank")` 之后把弹窗导航到 `https://open.feishu.cn/...`
 * （旧设置页面，当前由 BusinessPluginGallery.vue 承接）——**那是一个真实外网地址，套件里没有任何 mock
 * 盖住它**。同一批用例的耗时因此完全取决于那台服务器答不答：
 *
 *     绿的那次   1.7s / 2.6s / 3.4s / 3.8s
 *     红的那次   58.8s / 59.7s / 1.0m / 1.0m   ← 四条一起，拆 context 超 30s 预算
 *
 * 20~35 倍，而且四条同时发生——不是负载渐变，是一个外部依赖有时挂住。
 *
 * **fulfill 而不是 abort**：那几条用例断言 `popup.url()` 变成了那个地址；abort 会让导航
 * 失败、URL 停在 `about:blank`，等于用「改判据」换绿。fulfill 之后可观察行为不变
 * （地址真的换了），只是不出网。
 *
 * **装在 `page.context()` 上而不是 `page` 上**：弹窗是同一个 context 里的**另一个 page**，
 * `page.route` 盖不到它——而出问题的正是弹窗那一跳。
 */
const offMachineRequests = new WeakMap<BrowserContext, string[]>();

/**
 * 这条拦截**拦到过什么**。用例可以据此断言「那一跳确实想出网」——否则这条规则会变成
 * 一个永远不响的摆设，而且没人分得清「拦住了」和「压根没请求」（坑 131 的形状）。
 */
export function offMachineRequestsSeenBy(page: Page): string[] {
  return offMachineRequests.get(page.context()) ?? [];
}

function blockOffMachineRequests(page: Page) {
  const context = page.context();
  if (offMachineRequests.has(context)) return;
  const seen: string[] = [];
  offMachineRequests.set(context, seen);
  void context.route(
    /^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/]|\[::1\][:/])/,
    (route) => {
      seen.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<!doctype html><title>blocked by e2e</title>",
      });
    },
  );
}

export function mockLangGraphAPI(
  page: Page,
  options?: MockAPIOptions,
): MockAPIController {
  blockOffMachineRequests(page);
  let threads = [...(options?.threads ?? [])];
  const agents = (options?.agents ?? []).map((agent) => ({
    description: "",
    model: null,
    tool_groups: null,
    skills: null,
    ...agent,
  }));
  const skills = options?.skills ?? DEFAULT_SKILLS;
  const scheduledTaskEvents = { ...(options?.scheduledTaskEvents ?? {}) };
  const scheduledTasks = options?.scheduledTasks ?? [];
  let mutableScheduledTasks = [...scheduledTasks];
  const mutableTaskRuns: Record<string, MockScheduledTaskRun[]> =
    Object.fromEntries(
      Object.entries(options?.scheduledTaskRuns ?? {}).map(([taskId, runs]) => [
        taskId,
        [...runs],
      ]),
    );
  const uploadLimits = options?.uploadLimits ?? {
    max_files: 10,
    max_file_size: 50 * 1024 * 1024,
    max_total_size: 100 * 1024 * 1024,
  };
  let larkIntegrationStatus = {
    installed: false,
    version: "v1.0.65",
    manifest_version: null as string | null,
    latest_available_version: "v1.0.65" as string | null,
    runtime_version_mismatch: false,
    app_configured: false,
    app_id: null as string | null,
    app_brand: null as string | null,
    skills_expected: 27,
    skills_installed: 0,
    installed_skills: [] as string[],
    enabled_skills: [] as string[],
    install_path: "/tmp/deer-flow/integrations/skills/lark-cli",
    cli: {
      available: false,
      path: null as string | null,
      version: null as string | null,
      error: "lark-cli is not on PATH" as string | null,
    },
    auth: {
      status: "unavailable",
      message: "lark-cli is not installed on the Gateway" as string | null,
      user: null as string | null,
      verified: false,
    },
    sandbox_runtime_mode: "init-container" as
      "none" | "gateway-download" | "init-container",
    sandbox_runtime_ready: false,
    sandbox_runtime_detail:
      "The provisioner has no lark-cli init image configured (LARK_CLI_INIT_IMAGE)." as
        string | null,
  };
  mockCapabilityCatalog(page, skills, () => larkIntegrationStatus);
  const featureFlags = {
    agentsApiEnabled: options?.features?.agentsApiEnabled ?? true,
    browserControlEnabled: options?.features?.browserControlEnabled ?? true,
    threadActivity: {
      available: options?.features?.threadActivity?.available ?? false,
    },
  };

  // Thread activity feed: a run-change log ordered by `seq`, plus the
  // per-user read clock. Cursors are "<seq>:<run id>".
  const activityLog: Array<
    Required<MockThreadActivityEntry> & { seq: number }
  > = [];
  let activitySeq = 100;
  let readVersion = 0;
  const readRequests: string[] = [];
  const upsertThread = (thread: MockThread) => {
    threads = [
      thread,
      ...threads.filter((existing) => existing.thread_id !== thread.thread_id),
    ];
  };

  /*
    「建 thread」只在它还不存在时插入，**永远不覆写已有 thread 的消息**。

    真实后端的 create 只是分配一个 id；它不知道也不该知道消息。而在这份 mock 里
    create 与 `POST /runs/stream` 是两个独立的 route，落地顺序不保证——
    create 后到时，一个无条件的 upsert 会把这次 run 刚记下的消息**整段抹掉**。

    原来这里没有这个区分，靠的是「create 时顺手塞一段写死的 Hello /
    Hello from DeerFlow!」把覆盖的后果盖住。代价是**新建的 thread 一出生就带着
    一段它从没发生过的对话**：`GET /threads/{id}/messages/page` 立刻返回一条 human，
    `useThreadStream` 的「服务端 human 到了就清乐观消息」于是把**用户刚打的那条**
    清掉。跑得快断言先到（绿）、跑得慢分页先到（红）——`thread-history.spec.ts:695`
    因此在整套里约 50% 概率红，而红的原因与它测的东西毫无关系。
  */
  // 让 `handleRunStream`（含用例自己覆盖 stream 路由的那 4 个 spec）把流出去的
  // 消息回写到这份 threads 数组，见该函数上方的说明。
  streamRecorders.set(page, (threadId, messages) => {
    const existing = threads.find((t) => t.thread_id === threadId);
    upsertThread({
      thread_id: threadId,
      title: existing?.title ?? "New Chat",
      updated_at: new Date().toISOString(),
      goal: existing?.goal,
      metadata: existing?.metadata,
      agent_name: existing?.agent_name,
      artifacts: existing?.artifacts,
      messages: messages as MockThread["messages"],
    });
  });

  const createThreadIfAbsent = (thread: MockThread) => {
    if (threads.some((existing) => existing.thread_id === thread.thread_id))
      return;
    threads = [thread, ...threads];
  };

  const threadSearchResult = (thread: MockThread) => {
    /*
      标注成开放的 metadata 袋子，不是让 TS 从两个 spread 里推——推出来的是
      `{ agent_name?: string }`，于是搜索处理器按 `deerflow_archived` 过滤时
      被判成「这个键不存在」。真后端的 metadata 就是个自由字典。
    */
    const metadata: Record<string, unknown> = {
      ...(thread.metadata ?? {}),
      ...(thread.agent_name ? { agent_name: thread.agent_name } : {}),
    };
    return {
      thread_id: thread.thread_id,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: thread.updated_at ?? "2025-01-01T00:00:00Z",
      metadata,
      status: "idle",
      values: { title: thread.title ?? "Untitled", goal: thread.goal ?? null },
      unread: thread.unread ?? false,
    };
  };

  /**
   * 一条线程的**完整 channel values**——`GET /threads/{id}` 与
   * `GET /threads/{id}/state` 返回的是同一份。
   *
   * 后端两个路由都走同一个 accessor 的 `aget(config)` 取同一个最新快照，
   * 再用同一个 `serialize_channel_values_for_api` 序列化；实测（replay Gateway）
   * 两边的键集与 JSON 完全相等。而 `POST /threads/search` 不一样，它只返回
   * `{"title": display_name}` 这一个投影字段。
   *
   * 这里把「完整」抽成一个函数，就是为了让这条后端事实在 mock 里也是结构性的：
   * 此前 `GET /threads/{id}` 复用了 search 的投影，于是它比真后端少了
   * `messages` 与 `artifacts`——只要有人不再额外取一次 `/state`，
   * artifact 面板在 mock 下就会凭空消失，而真后端下不会。
   */
  const threadChannelValues = (thread: MockThread | undefined) => ({
    title: thread?.title ?? "Untitled",
    goal: thread?.goal ?? null,
    messages: thread
      ? (thread.messages ?? [
          {
            type: "human",
            id: `msg-human-${thread.thread_id}`,
            content: [{ type: "text", text: "Previous question" }],
          },
          {
            type: "ai",
            id: `msg-ai-${thread.thread_id}`,
            content: `Response in thread ${thread.title ?? thread.thread_id}`,
          },
        ])
      : [],
    artifacts: thread?.artifacts ?? [],
    tool_artifacts: thread?.tool_artifacts ?? [],
    todos: thread?.todos ?? [],
  });

  const threadGetResult = (thread: MockThread) => ({
    ...threadSearchResult(thread),
    values: threadChannelValues(thread),
  });

  const threadUpdatedAt = (thread: MockThread) =>
    Date.parse(thread.updated_at ?? "2025-01-01T00:00:00Z") || 0;

  const sortThreadSearchResults = (items: readonly MockThread[]) =>
    [...items].sort((left, right) => {
      const pinnedDiff =
        Number(right.metadata?.[THREAD_PINNED_METADATA_KEY] === true) -
        Number(left.metadata?.[THREAD_PINNED_METADATA_KEY] === true);
      return (
        pinnedDiff ||
        threadUpdatedAt(right) - threadUpdatedAt(left) ||
        right.thread_id.localeCompare(left.thread_id)
      );
    });

  const patchThreadMetadata = (
    threadId: string,
    metadata: Record<string, unknown>,
  ) => {
    let updated: MockThread | undefined;
    threads = threads.map((thread) => {
      if (thread.thread_id !== threadId) {
        return thread;
      }
      // Preserve ``updated_at`` for pin/unpin metadata changes; the search mock
      // below mirrors the Gateway's server-side pinned-first ordering.
      updated = {
        ...thread,
        metadata: {
          ...(thread.metadata ?? {}),
          ...metadata,
        },
      };
      return updated;
    });
    return updated;
  };

  // Auth — keep workspace tests independent from a real gateway session.
  // Thread activity feed (`GET /api/thread-activity`): 503 when unavailable,
  // like a memory-backed Gateway; no cursor seeds; a cursor returns the
  // logged changes after it (deduped by thread, latest last).
  void page.route(/\/api\/thread-activity(?:\?|$)/, (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    if (!featureFlags.threadActivity.available) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Thread activity is not available" }),
      });
    }
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    if (cursor === null) {
      const head = activityLog.at(-1);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cursor: head ? `${head.seq}:run-${head.seq}` : "0:",
          threads: [],
          truncated: false,
          read_version: readVersion,
        }),
      });
    }
    const match = /^(\d+):/.exec(cursor);
    if (!match) {
      return route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            code: "invalid_cursor",
            message: "Invalid activity cursor",
          },
        }),
      });
    }
    const after = Number(match[1]);
    const changed = activityLog.filter((entry) => entry.seq > after);
    const last = changed.at(-1);
    const latest = new Map<string, (typeof changed)[number]>();
    for (const entry of changed) {
      latest.delete(entry.thread_id);
      latest.set(entry.thread_id, entry);
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cursor: last ? `${last.seq}:run-${last.seq}` : cursor,
        threads: [...latest.values()]
          .filter((entry) => entry.origin_kind !== null)
          .map(({ thread_id, origin_kind, status }) => ({
            thread_id,
            origin_kind,
            status,
          })),
        truncated: false,
        read_version: readVersion,
      }),
    });
  });

  // Mark read (`POST /api/threads/{id}/read`): raises `read_version` only
  // when the thread was unread, like the Gateway.
  void page.route(/\/api\/threads\/[^/]+\/read$/, (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    const parts = new URL(route.request().url()).pathname.split("/");
    const threadId = decodeURIComponent(parts.at(-2) ?? "");
    readRequests.push(threadId);
    const thread = threads.find((item) => item.thread_id === threadId);
    if (!thread) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: `Thread ${threadId} not found` }),
      });
    }
    if (thread.unread) {
      threads = threads.map((item) =>
        item.thread_id === threadId ? { ...item, unread: false } : item,
      );
      readVersion += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ unread: false, read_version: readVersion }),
    });
  });

  void page.route("**/api/v1/auth/me", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_AUTH_USER),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/v1/auth/setup-status", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ needs_setup: false }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/v1/auth/logout", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  });

  void page.route("**/api/channels/providers", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: false, providers: [] }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/channels/connections", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections: [] }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/suggestions/config", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: false }),
      });
    }
    return route.fallback();
  });

  // Lifecycle events of an originating chat. Rows outlive their task, so
  // this route never looks at the task list.
  void page.route(
    /\/api\/threads\/[^/]+\/scheduled-task-events(?:\?|$)/,
    (route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }
      const parts = new URL(route.request().url()).pathname.split("/");
      const threadId = decodeURIComponent(parts.at(-2) ?? "");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          events: (scheduledTaskEvents[threadId] ?? []).map(
            scheduledTaskEventResponse,
          ),
        }),
      });
    },
  );

  void page.route("**/api/scheduled-tasks", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mutableScheduledTasks.map(scheduledTaskResponse)),
      });
    }
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      const threadId =
        typeof payload.thread_id === "string" ? payload.thread_id : "";
      const title = typeof payload.title === "string" ? payload.title : "";
      const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
      const timezone =
        typeof payload.timezone === "string" ? payload.timezone : "UTC";
      const created: MockScheduledTask = {
        id: "task-created",
        thread_id: threadId || null,
        context_mode:
          (payload.context_mode as "fresh_thread_per_run" | "reuse_thread") ??
          "fresh_thread_per_run",
        assistant_id:
          typeof payload.assistant_id === "string"
            ? payload.assistant_id
            : "lead_agent",
        last_thread_id: null,
        title,
        prompt,
        schedule_type: payload.schedule_type as "once" | "cron" | "interval",
        schedule_spec: (payload.schedule_spec as Record<string, unknown>) ?? {},
        timezone,
        status: "enabled" as const,
        next_run_at: null,
        last_run_at: null,
        last_run_id: null,
        last_error: null,
        run_count: 0,
        created_at: "2026-07-01T00:00:00+00:00",
        updated_at: "2026-07-01T00:00:00+00:00",
      };
      const stored = applyClearableTaskFields(created, payload);
      mutableScheduledTasks = [stored, ...mutableScheduledTasks];
      mutableTaskRuns[stored.id] = [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scheduledTaskResponse(stored)),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/scheduled-tasks/*/pause", (route) => {
    if (route.request().method() === "POST") {
      const taskId = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").at(-2) ?? "",
      );
      mutableScheduledTasks = mutableScheduledTasks.map((task) =>
        task.id === taskId
          ? { ...task, status: "paused" as const, active_run_status: null }
          : task,
      );
      const task = mutableScheduledTasks.find((item) => item.id === taskId);
      if (!task) return scheduledTaskNotFound(route);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scheduledTaskResponse(task)),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/scheduled-tasks/*/resume", (route) => {
    if (route.request().method() === "POST") {
      const taskId = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").at(-2) ?? "",
      );
      // Optional renewal body: `max_runs` / `end_at`, `null` clears that cap.
      const renewal = (() => {
        try {
          return (route.request().postDataJSON() ?? {}) as Record<
            string,
            unknown
          >;
        } catch {
          return {};
        }
      })();
      mutableScheduledTasks = mutableScheduledTasks.map((task) =>
        task.id === taskId
          ? {
              ...applyClearableTaskFields(task, {
                ...("max_runs" in renewal
                  ? { max_runs: renewal.max_runs }
                  : {}),
                ...("end_at" in renewal ? { end_at: renewal.end_at } : {}),
              }),
              status: "enabled" as const,
            }
          : task,
      );
      const task = mutableScheduledTasks.find((item) => item.id === taskId);
      if (!task) return scheduledTaskNotFound(route);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scheduledTaskResponse(task)),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/scheduled-tasks/*/trigger", (route) => {
    if (route.request().method() === "POST") {
      const taskId = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").at(-2) ?? "",
      );
      const task = mutableScheduledTasks.find((item) => item.id === taskId);
      if (!task) return scheduledTaskNotFound(route);
      const threadId = task.thread_id ?? `trial-thread-${taskId}`;
      const runId = `run-${taskId}`;
      mutableTaskRuns[taskId] = [
        {
          id: `task-run-${taskId}`,
          task_id: taskId,
          thread_id: threadId,
          run_id: runId,
          scheduled_for: "2026-07-01T00:00:00+00:00",
          trigger: "manual",
          status: "success",
          error: null,
          attempt_count: 1,
          started_at: "2026-07-01T00:00:00+00:00",
          finished_at: "2026-07-01T00:00:00+00:00",
          created_at: "2026-07-01T00:00:00+00:00",
        },
        ...(mutableTaskRuns[taskId] ?? []),
      ];
      mutableScheduledTasks = mutableScheduledTasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              last_run_id: runId,
              last_run_at: "2026-07-01T00:00:00+00:00",
              run_count: item.run_count + 1,
            }
          : item,
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: taskId,
          triggered: true,
          outcome: "launched",
          existing: false,
          thread_id: threadId,
        }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/scheduled-tasks/*", (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      const taskId = decodeURIComponent(
        new URL(request.url()).pathname.split("/").at(-1) ?? "",
      );
      const task = mutableScheduledTasks.find((item) => item.id === taskId);
      if (!task) return scheduledTaskNotFound(route);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scheduledTaskResponse(task)),
      });
    }
    if (request.method() === "PATCH") {
      const taskId = decodeURIComponent(
        new URL(request.url()).pathname.split("/").at(-1) ?? "",
      );
      const payload = request.postDataJSON() as Record<string, unknown>;
      let updated: MockScheduledTask | undefined;
      mutableScheduledTasks = mutableScheduledTasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }
        updated = {
          ...applyClearableTaskFields(task, payload),
          ...("assistant_id" in payload
            ? {
                assistant_id:
                  (payload.assistant_id as string | null) ?? "lead_agent",
              }
            : {}),
          ...("context_mode" in payload
            ? {
                context_mode: payload.context_mode as
                  "fresh_thread_per_run" | "reuse_thread",
              }
            : {}),
          ...("thread_id" in payload
            ? { thread_id: payload.thread_id as string | null }
            : {}),
          ...("schedule_type" in payload
            ? {
                schedule_type: payload.schedule_type as
                  "once" | "cron" | "interval",
              }
            : {}),
          ...(typeof payload.title === "string"
            ? { title: payload.title }
            : {}),
          ...(typeof payload.prompt === "string"
            ? { prompt: payload.prompt }
            : {}),
          ...(payload.schedule_spec
            ? {
                schedule_spec: payload.schedule_spec as Record<string, unknown>,
              }
            : {}),
          ...(typeof payload.timezone === "string"
            ? { timezone: payload.timezone }
            : {}),
          updated_at: "2026-07-01T00:00:00+00:00",
        };
        return updated;
      });
      if (!updated) return scheduledTaskNotFound(route);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scheduledTaskResponse(updated)),
      });
    }
    if (request.method() === "DELETE") {
      const taskId = decodeURIComponent(
        new URL(request.url()).pathname.split("/").at(-1) ?? "",
      );
      mutableScheduledTasks = mutableScheduledTasks.filter(
        (task) => task.id !== taskId,
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: taskId, deleted: true }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/threads/*/scheduled-tasks", (route) => {
    if (route.request().method() === "GET") {
      const url = new URL(route.request().url());
      const parts = url.pathname.split("/");
      const threadId = decodeURIComponent(
        parts[parts.indexOf("threads") + 1] ?? "",
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          mutableScheduledTasks.flatMap((task) => {
            const runInThread = (mutableTaskRuns[task.id] ?? []).find(
              (run) => run.thread_id === threadId,
            );
            const relation =
              task.origin_thread_id === threadId
                ? "origin"
                : task.thread_id === threadId
                  ? "reuse"
                  : runInThread
                    ? "run"
                    : null;
            if (!relation) return [];
            return [
              {
                ...scheduledTaskResponse(task),
                thread_relation: relation,
                thread_run:
                  relation === "run" && runInThread
                    ? {
                        run_number: runInThread.run_number ?? null,
                        trigger: runInThread.trigger,
                        scheduled_for: runInThread.scheduled_for,
                        status: runInThread.status,
                      }
                    : null,
              },
            ];
          }),
        ),
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/scheduled-tasks\/[^/]+\/runs(?:\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      const url = new URL(route.request().url());
      const taskId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          (mutableTaskRuns[taskId] ?? []).slice(offset, offset + limit),
        ),
      });
    }
    return route.fallback();
  });

  // Thread search — sidebar thread list & chats list page
  /*
    会话搜索有**两条**路由，喂的是同一份 fixture。

    本仓走 SDK 的 `POST /api/langgraph/threads/search`；上游 #5265 之后，React
    的会话列表在带 `archived` 过滤时改打 Gateway 原生的
    `POST /api/threads/search`（`core/threads/api.ts::searchThreadsByArchive`）。
    对照工厂把这一份 mock **同时套在两个应用上**，所以少了后一条，React 侧栏
    会渲染成空列表——2026-09 合并上游时实测：thread-history / thread-list-pin /
    thread-list-infinite-scroll 共 6 条对照场景全部在等会话标题时超时 30 秒，
    而失败快照里 React 那侧的侧栏只剩「Projects」一栏。

    两条喂同一份数据，差异才落在 UI 上而不是数据上。
  */
  const searchThreadsHandler = async (route: Route) => {
    let body = sortThreadSearchResults(threads).map(threadSearchResult);

    let limit: number | undefined;
    let offset = 0;
    try {
      const postData = route.request().postDataJSON() as {
        limit?: number;
        offset?: number;
        metadata?: Record<string, unknown>;
        archived?: boolean;
      } | null;
      if (postData) {
        if (typeof postData.limit === "number") {
          limit = postData.limit;
        }
        if (typeof postData.offset === "number") {
          offset = postData.offset;
        }
        if (postData.metadata && typeof postData.metadata === "object") {
          body = body.filter((thread) =>
            Object.entries(postData.metadata ?? {}).every(
              ([key, value]) => thread.metadata?.[key] === value,
            ),
          );
        }
        /*
          后端 `ThreadSearchRequest.archived` 的语义：省略含全部、`false` 含未归档。
          fixture 里的线程除非自己标了 `deerflow_archived: true`，否则都算未归档。
        */
        if (typeof postData.archived === "boolean") {
          const wantArchived = postData.archived;
          body = body.filter(
            (thread) =>
              (thread.metadata?.deerflow_archived === true) === wantArchived,
          );
        }
      }
    } catch {
      // No / invalid JSON body — fall back to returning the full list.
    }

    const sliced =
      typeof limit === "number" ? body.slice(offset, offset + limit) : body;

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sliced),
    });
  };

  void page.route("**/api/langgraph/threads/search", searchThreadsHandler);
  void page.route("**/api/threads/search", searchThreadsHandler);

  // One project state owner serves project mutations and create admission.
  const projects = installProjectGatewayMock(
    page,
    options ?? {},
    () => threads,
  );
  const createThreadHandler = (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON() as {
      thread_id?: string;
      project_id?: string | null;
      metadata?: Record<string, unknown>;
    };
    const threadId = body.thread_id ?? crypto.randomUUID();
    let created = threads.find((thread) => thread.thread_id === threadId);
    // Match Gateway create_thread: idempotency precedes project admission.
    // A repeated create neither moves a thread nor overwrites its metadata.
    if (!created) {
      if (body.project_id && !projects.canAssignProject(body.project_id)) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Project not found" }),
        });
      }
      const metadata: Record<string, unknown> = Object.fromEntries(
        Object.entries(body.metadata ?? {}).filter(
          ([key]) =>
            ![
              "owner_id",
              "user_id",
              "deerflow_project_id",
              "deerflow_origin",
            ].includes(key),
        ),
      );
      if (body.project_id) metadata.deerflow_project_id = body.project_id;
      createThreadIfAbsent({
        thread_id: threadId,
        title: "New Chat",
        updated_at: new Date().toISOString(),
        metadata,
        messages: [],
      });
      created = threads.find((thread) => thread.thread_id === threadId)!;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...threadSearchResult(created),
        values: {},
      }),
    });
  };
  void page.route("**/api/langgraph/threads", createThreadHandler);
  void page.route("**/api/threads", createThreadHandler);

  // Thread update (PATCH) — metadata update after creation
  void page.route("**/api/langgraph/threads/*", (route) => {
    const threadId = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").at(-1) ?? "",
    );
    const matchingThread = threads.find(
      (thread) => thread.thread_id === threadId,
    );
    if (route.request().method() === "GET") {
      if (!matchingThread) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Thread not found" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(threadGetResult(matchingThread)),
      });
    }
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as {
        metadata?: Record<string, unknown>;
      };
      const updated = body.metadata
        ? patchThreadMetadata(threadId, body.metadata)
        : matchingThread;
      if (!updated) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Thread not found" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(threadSearchResult(updated)),
      });
    }
    if (route.request().method() === "DELETE") {
      // Same `require_existing=True` ownership guard as the `/api/threads`
      // handler below. Vue's thread client deletes through this LangGraph
      // path, so leaving it permissive here made a duplicate delete look
      // successful in the one place it actually happens.
      if (!matchingThread) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: `Thread ${threadId} not found` }),
        });
      }
      threads = threads.filter((thread) => thread.thread_id !== threadId);
      return route.fulfill({
        status: 204,
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/threads\/[^/]+$/, (route) => {
    if (route.request().method() === "PATCH") {
      const threadId = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").at(-1) ?? "",
      );
      const body = route.request().postDataJSON() as {
        metadata?: Record<string, unknown>;
      };
      const matchingThread = threads.find(
        (thread) => thread.thread_id === threadId,
      );
      const updated = body.metadata
        ? patchThreadMetadata(threadId, body.metadata)
        : matchingThread;
      if (!updated) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: `Thread ${threadId} not found` }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(threadSearchResult(updated)),
      });
    }
    if (route.request().method() === "DELETE") {
      const threadId = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").at(-1) ?? "",
      );
      // Mirror the gateway's `require_existing=True` ownership guard: deleting
      // an already-removed thread 404s. Production sends one canonical delete
      // request per thread, so a duplicate remains a real caller error.
      if (!threads.some((thread) => thread.thread_id === threadId)) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: `Thread ${threadId} not found` }),
        });
      }
      threads = threads.filter((thread) => thread.thread_id !== threadId);
      return route.fulfill({
        status: 204,
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/threads\/[^/]+\/branches$/, (route) => {
    if (route.request().method() === "POST") {
      const pathParts = new URL(route.request().url()).pathname.split("/");
      const sourceThreadId = decodeURIComponent(pathParts.at(-2) ?? "");
      const sourceThread = threads.find(
        (thread) => thread.thread_id === sourceThreadId,
      );
      const body = route.request().postDataJSON() as {
        message_id?: string;
        message_ids?: string[];
        title?: string;
      };
      const targetIds = new Set(
        [body.message_id, ...(body.message_ids ?? [])].filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        ),
      );
      let sourceTitle = sourceThread?.title?.trim();
      if (sourceThread?.metadata?.deerflow_branch === true) {
        sourceTitle = sourceTitle?.replace(/^(Branch:\s*)+/i, "").trim();
      }
      const title = body.title ?? sourceTitle;

      upsertThread({
        thread_id: MOCK_THREAD_ID_2,
        title,
        updated_at: new Date().toISOString(),
        metadata: {
          deerflow_branch: true,
          branch_parent_thread_id: sourceThreadId,
          branch_parent_message_id: body.message_id,
          branch_parent_checkpoint_id: "mock-checkpoint",
        },
        messages: branchMessagesFromTurn(
          sourceThread?.messages ?? [],
          targetIds,
        ),
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          thread_id: MOCK_THREAD_ID_2,
          parent_thread_id: sourceThreadId,
          parent_checkpoint_id: "mock-checkpoint",
          branched_from_message_id: body.message_id,
          workspace_clone_mode: "current_thread_best_effort",
        }),
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/threads\/[^/]+\/goal$/, async (route) => {
    const threadId = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "",
    );
    let matchingThread = threads.find(
      (thread) => thread.thread_id === threadId,
    );

    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ goal: matchingThread?.goal ?? null }),
      });
    }

    if (route.request().method() === "DELETE") {
      if (matchingThread) {
        matchingThread.goal = null;
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ goal: null }),
      });
    }

    if (route.request().method() === "PUT") {
      const payload = route.request().postDataJSON() as {
        objective?: string;
      };
      const goal = {
        objective: payload.objective ?? "",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        continuation_count: 0,
        max_continuations: 8,
        no_progress_count: 0,
        max_no_progress_continuations: 2,
      };
      matchingThread ??= {
        thread_id: threadId,
        title: "New Chat",
        updated_at: new Date().toISOString(),
      };
      upsertThread({ ...matchingThread, goal });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ goal }),
      });
    }

    return route.fallback();
  });

  void page.route("**/api/threads/*/uploads/limits", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(uploadLimits),
      });
    }
    return route.fallback();
  });

  // These queries are mounted by the shared workspace shell. Own them in the
  // standard mock harness so an isolated frontend E2E run never falls through
  // to a real Gateway merely because a test does not exercise these surfaces.
  // Scenario-specific routes are registered after this helper and therefore
  // still take precedence.
  void page.route("**/api/threads/*/token-usage", (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    const parts = new URL(route.request().url()).pathname.split("/");
    const threadId = decodeURIComponent(
      parts[parts.indexOf("threads") + 1] ?? "",
    );
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        thread_id: threadId,
        total_tokens: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_runs: 0,
        by_model: {},
        by_caller: { lead_agent: 0, subagent: 0, middleware: 0 },
        context_usage: null,
      }),
    });
  });

  void page.route("**/api/threads/*/runs/*/workspace-changes?*", (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: false,
        version: 1,
        summary: {
          created: 0,
          modified: 0,
          deleted: 0,
          symlink_created: 0,
          additions: 0,
          deletions: 0,
          truncated: false,
        },
        files: [],
        limits: {},
      }),
    });
  });

  // Thread history — useStream fetches state history on mount
  void page.route("**/api/langgraph/threads/*/history", (route) => {
    const url = route.request().url();

    // For threads that exist in our mock data, return history with messages
    const matchingThread = threads.find(
      (t) => t.thread_id === threadIdFromRequest(url),
    );
    if (matchingThread) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            /*
              **走 `threadChannelValues`，不要在这里再抄一份。**
              这里原来是手抄的第三份 channel values，而它已经漂了：
              2026-09-12 第十八轮给 mock 补 `todos` 时，`GET /threads/{id}`
              与 `/state` 两处都跟上了，**只有这里没有**——于是
              `useStream` 从 `/history` 水合的那一侧（上游）看不见待办列表，
              而读 `/state` 的那一侧（本仓）看得见。一个字段两种行为，
              对照场景当场卡在「React 没能到达」。
              这正是 `threadChannelValues` 的注释想防的那件事。
            */
            values: threadChannelValues(matchingThread),
            next: [],
            metadata: {},
            created_at: "2025-01-01T00:00:00Z",
            parent_config: null,
          },
        ]),
      });
    }

    // New threads — empty history
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  // Thread state — getState for individual thread
  void page.route("**/api/langgraph/threads/*/state", (route) => {
    /*
      **POST 也要接住。** 本仓的重命名走的就是它
      （`useThreads.rename` → `apiClient.threads.updateState(id, { values: { title } })`
      → `POST {base}/threads/{id}/state`）。此前这里只处理 GET，POST 掉进
      `route.fallback()`，于是那次写**必然失败**、乐观更新回滚、标题纹丝不动。

      后果不是「少测了一条」，是**重命名的成功路径从来没被任何 e2e 走过**：
      本模块 `tests/e2e/ui-primitives-a11y.spec.ts` 那条断言的恰恰是「写失败时对话框仍在」，
      它在这个 mock 下永远成立。2026-09-10 加 `thread-title-sync` 对照场景时，
      两个应用同时到不了终态，才把它照出来。
    */
    if (route.request().method() === "POST") {
      const url = route.request().url();
      const matchingThread = threads.find(
        (t) => t.thread_id === threadIdFromRequest(url),
      );
      const body = route.request().postDataJSON() as {
        values?: { title?: unknown };
      };
      const title = body.values?.title;
      const updated =
        matchingThread && typeof title === "string"
          ? { ...matchingThread, title }
          : matchingThread;
      // 与上游 mock 同形（frontend/tests/e2e/utils/mock-api.ts:1262）：
      // 找不到 thread 是 404，不是静默成功。
      if (!updated) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Thread not found" }),
        });
      }
      upsertThread(updated);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configurable: {
            thread_id: updated.thread_id,
            checkpoint_ns: "",
            checkpoint_id: "mock-checkpoint",
          },
        }),
      });
    }
    if (route.request().method() === "GET") {
      const url = route.request().url();
      const matchingThread = threads.find(
        (t) => t.thread_id === threadIdFromRequest(url),
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          // 与 `GET /threads/{id}` 同源，理由见 `threadChannelValues`。
          values: threadChannelValues(matchingThread),
          next: [],
          metadata: {},
          created_at: "2025-01-01T00:00:00Z",
        }),
      });
    }
    return route.fallback();
  });

  // The URL carries a query string (e.g. `?limit=10&offset=0`), which Playwright
  // glob `*` does NOT cross, so we match with a regex anchored to `/runs`
  // followed by `?` or end-of-string.  This must NOT match `/runs/stream`.
  void page.route(/\/api\/langgraph\/threads\/[^/]+\/runs(\?|$)/, (route) => {
    if (route.request().method() === "GET") {
      const url = route.request().url();
      const matchingThread = threads.find(
        (t) => t.thread_id === threadIdFromRequest(url),
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          matchingThread
            ? [
                {
                  run_id: `run-${matchingThread.thread_id}`,
                  thread_id: matchingThread.thread_id,
                  assistant_id: "lead_agent",
                  status: "success",
                  metadata: {},
                  kwargs: {},
                  created_at: "2025-01-01T00:00:00Z",
                  updated_at:
                    matchingThread.updated_at ?? "2025-01-01T00:00:00Z",
                },
              ]
            : [],
        ),
      });
    }
    return route.fallback();
  });

  void page.route(/\/api\/threads\/([^/]+)\/messages\/page/, (route) => {
    if (route.request().method() === "GET") {
      const url = route.request().url();
      const matchingThread = threads.find(
        (t) => t.thread_id === threadIdFromRequest(url),
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: (matchingThread?.messages ?? []).map((message, index) => ({
            run_id: mockMessageRunId(
              message,
              `run-${matchingThread?.thread_id ?? "unknown"}`,
            ),
            seq: index + 1,
            content: message,
            metadata: { caller: "lead_agent" },
            created_at: `2025-01-01T00:00:${String(index).padStart(2, "0")}Z`,
          })),
          has_more: false,
          next_before_seq: null,
        }),
      });
    }
    return route.fallback();
  });

  // Run stream — returns a minimal SSE response with an AI message
  const handleMockRunStream = (route: Route) => {
    const threadId = runStreamThreadId(route);
    const existingThread = threads.find(
      (thread) => thread.thread_id === threadId,
    );
    const fallbackGoal = threads.find((thread) => thread.goal)?.goal ?? null;
    const goal = existingThread?.goal ?? fallbackGoal;
    upsertThread({
      thread_id: threadId,
      title: threadId === MOCK_SIDECAR_THREAD_ID ? "Side chat" : "New Chat",
      updated_at: new Date().toISOString(),
      goal,
      metadata: existingThread?.metadata,
      messages: mockStreamMessages(route),
    });
    return handleRunStream(route, { goal });
  };

  void page.route("**/api/langgraph/runs/stream", handleMockRunStream);
  void page.route(
    "**/api/langgraph/threads/*/runs/stream",
    handleMockRunStream,
  );

  // Models list — model picker dropdown
  // Empty default catalog; feature-specific scenarios register their own later route.
  void page.route("**/api/subagents", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subagents: [] }),
    });
  });

  void page.route("**/api/models", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [],
          token_usage: { enabled: false },
        }),
      });
    }
    return route.fallback();
  });

  // Feature flags — frontend gates UI (e.g. agents/browser) on these. Default to
  // enabled so existing tests exercise the normal path; tests that need the
  // disabled state override this route after calling mockLangGraphAPI.
  void page.route("**/api/features", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          agents_api: { enabled: featureFlags.agentsApiEnabled },
          thread_activity: { available: featureFlags.threadActivity.available },
          browser_control: { enabled: featureFlags.browserControlEnabled },
          knowledge_base: {
            scope_selection_enabled:
              options?.features?.knowledgeScopeSelectionEnabled ?? false,
          },
          scheduled_tasks: {
            available: options?.features?.scheduledTasks?.available ?? true,
            running: options?.features?.scheduledTasks?.running ?? true,
            tool_enabled:
              options?.features?.scheduledTasks?.toolEnabled ?? true,
            min_interval_seconds:
              options?.features?.scheduledTasks?.minIntervalSeconds ?? 60,
          },
        }),
      });
    }
    return route.fallback();
  });

  // Skills list — settings page and slash autocomplete
  void page.route("**/api/skills", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/integrations/lark/status", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(larkIntegrationStatus),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/integrations/lark/install", (route) => {
    if (route.request().method() === "POST") {
      larkIntegrationStatus = {
        installed: true,
        version: "v1.0.65",
        manifest_version: "v1.0.65",
        latest_available_version: "v1.0.65",
        runtime_version_mismatch: false,
        app_configured: false,
        app_id: null,
        app_brand: null,
        skills_expected: 27,
        skills_installed: 3,
        installed_skills: ["lark-doc", "lark-im", "lark-shared"],
        enabled_skills: ["lark-doc", "lark-im", "lark-shared"],
        install_path: "/tmp/deer-flow/integrations/skills/lark-cli",
        cli: {
          available: true,
          path: "/usr/bin/lark-cli",
          version: "lark-cli version v1.0.65",
          error: null,
        },
        auth: {
          status: "not_configured",
          message: "lark-cli auth is not configured",
          user: null,
          verified: false,
        },
        sandbox_runtime_mode: "init-container",
        sandbox_runtime_ready: true,
        sandbox_runtime_detail: null,
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          installed_skills: ["lark-doc", "lark-im", "lark-shared"],
          message: "Installed 3 Lark/Feishu skills.",
          status: larkIntegrationStatus,
        }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/integrations/lark/config/start", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verification_url: "https://open.feishu.cn/page/cli?user_code=config",
          device_code: "mock-config-device-code",
          generation: "config-generation",
          expires_in: 600,
          interval: 5,
          user_code: "config",
          brand: "feishu",
        }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/integrations/lark/config/complete", (route) => {
    if (route.request().method() === "POST") {
      larkIntegrationStatus = {
        ...larkIntegrationStatus,
        app_configured: true,
        app_id: "cli_mock",
        app_brand: "feishu",
        auth: {
          status: "not_authorized",
          message: "Lark user authorization is not configured",
          user: null,
          verified: false,
        },
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Lark/Feishu connection setup completed.",
          generation: "config-generation",
          status: larkIntegrationStatus,
        }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/integrations/lark/config/credentials", (route) => {
    if (route.request().method() === "POST") {
      larkIntegrationStatus = {
        ...larkIntegrationStatus,
        app_configured: true,
        app_id: "cli_switched_mock",
        app_brand: "feishu",
        auth: {
          status: "not_authorized",
          message: "Lark user authorization is not configured",
          user: null,
          verified: false,
        },
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message:
            "Lark/Feishu app switched. Reconnect to authorize the new app.",
          generation: "switch-generation",
          status: larkIntegrationStatus,
        }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/integrations/lark/auth/start", (route) => {
    if (route.request().method() === "POST") {
      const request = route.request().postDataJSON() as {
        generation?: string;
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verification_url: "https://open.feishu.cn/auth/mock-device",
          device_code: "mock-device-code",
          generation: request.generation ?? "auth-generation",
          expires_in: 600,
          user_code: null,
          hint: null,
        }),
      });
    }
    return route.fallback();
  });

  void page.route("**/api/integrations/lark/auth/complete", (route) => {
    if (route.request().method() === "POST") {
      larkIntegrationStatus = {
        ...larkIntegrationStatus,
        auth: {
          status: "authenticated",
          message: "Lark/Feishu authorization is live-verified.",
          user: "Alice",
          verified: true,
        },
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Lark/Feishu authorization completed.",
          status: larkIntegrationStatus,
        }),
      });
    }
    return route.fallback();
  });

  // Follow-up suggestions — input box auto-suggest after AI response
  void page.route("**/api/threads/*/suggestions", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ suggestions: [] }),
      });
    }
    return route.fallback();
  });

  // Agents list — sidebar & gallery page
  void page.route("**/api/agents", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ agents }),
      });
    }
    return route.fallback();
  });

  // Individual agent — agent chat page
  void page.route("**/api/agents/*", (route) => {
    if (route.request().method() === "GET") {
      const url = route.request().url();
      const agent = agents.find((a) => url.endsWith(`/api/agents/${a.name}`));
      if (agent) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(agent),
        });
      }
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Agent not found" }),
    });
  });
  return {
    upsertThread,
    pushThreadActivity: (...entries) => {
      for (const entry of entries) {
        activitySeq += 1;
        activityLog.push({
          seq: activitySeq,
          thread_id: entry.thread_id,
          // Server-originated unless a spec passes `null` (an interactive run).
          origin_kind:
            entry.origin_kind === undefined ? "schedule" : entry.origin_kind,
          status: entry.status ?? "success",
        });
      }
    },
    bumpReadVersion: () => {
      readVersion += 1;
    },
    get readRequests() {
      return readRequests;
    },
    setScheduledTasks(tasks: MockScheduledTask[]) {
      mutableScheduledTasks = [...tasks];
    },
    setScheduledTaskEvents(threadId: string, events: MockScheduledTaskEvent[]) {
      scheduledTaskEvents[threadId] = [...events];
    },
  };
}

// ---------------------------------------------------------------------------
// handleRunStream
// ---------------------------------------------------------------------------

/**
 * Build a minimal SSE stream that the LangGraph SDK can parse.
 * The stream returns a single AI message: "Hello from DeerFlow!".
 */
/*
  **一个 thread 的消息只有一个写入者：真正跑起来的那次 run。**

  这份 mock 有两个真相源——SSE 流，和喂给 `/messages/page` 与 `/history` 的
  `threads` 数组。它们会不一致，而不一致的后果是**产品级的**：流里刚渲染出来的
  对话会被随后返回的空分页结果抹掉。

  此前靠「建 thread 时顺手塞一段写死的 Hello / Hello from DeerFlow!」让两边
  碰巧一致，代价是**新建的 thread 一出生就带着一段它从没发生过的对话**：
  `/messages/page` 立刻返回一条 human，`useThreadStream` 的「服务端 human 到了
  就清乐观消息」于是把**用户刚打的那条**清掉——`thread-history.spec.ts:695`
  因此在整套里约 50% 概率红，而红的原因与它测的东西毫无关系。

  改法是让**流自己回写**：`handleRunStream` 每次都把它发出去的消息记回当前 page
  的 `threads` 数组。这样无论用例覆盖的是哪一条 stream 路由（有 4 个 spec 直接
  用 `handleRunStream`），分页与历史都和刚才流出去的内容一致。
*/
type StreamRecorder = (threadId: string, messages: unknown[]) => void;
const streamRecorders = new WeakMap<Page, StreamRecorder>();

export function handleRunStream(
  route: Route,
  values: Record<string, unknown> = {},
  inputMessages?: unknown[],
) {
  const threadId = runStreamThreadId(route);
  const streamedMessages = mockStreamMessages(route, inputMessages);
  const recorder = streamRecorders.get(route.request().frame().page());
  recorder?.(threadId, streamedMessages);
  const events = [
    {
      event: "metadata",
      data: { run_id: MOCK_RUN_ID, thread_id: threadId },
    },
    {
      event: "values",
      data: {
        ...values,
        messages: streamedMessages,
      },
    },
    { event: "end", data: {} },
  ];

  const body = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");

  return route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    headers: {
      "Content-Location": `/api/threads/${threadId}/runs/${MOCK_RUN_ID}`,
    },
    body,
  });
}
