import type { QueryClient } from "@tanstack/vue-query";
import {
  GatewayResponseError,
  throwGatewayResponseError,
} from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import {
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  mapInfiniteThreadsCache,
  type InfiniteThreadsData,
} from "./infinite";
import { isThreadOriginKind, type ThreadOriginKind } from "./origin";
import type { AgentThread } from "./types";

/**
 * Thread activity: how server-created threads (schedule, IM, GitHub,
 * extension) reach an open sidebar without a reload, and how opening a thread
 * clears its unread dot on every device.
 *
 * `useThreadActivity` polls `GET /api/thread-activity` with an opaque cursor
 * over the run-change clock. The first response only seeds the cursor. After
 * that, a page that names a server-originated thread, a truncated page, or a
 * higher per-user `read_version` (a read on another device) invalidates the
 * thread lists once; a scheduled thread also refreshes the scheduled-task
 * queries. An idle poll changes nothing.
 *
 * `useMarkThreadRead` posts `POST /api/threads/{id}/read` and patches the
 * cached `unread` flag; the `read_version` it gets back is stored where the
 * poll compares it, so a tab's own read never refetches its own lists.
 */

export const THREAD_ACTIVITY_QUERY_KEY = ["threads", "activity"] as const;
export const THREAD_ACTIVITY_POLL_MS = 15_000;
export const THREAD_ACTIVITY_PAGE_LIMIT = 200;
export const MARK_THREAD_READ_DEBOUNCE_MS = 1_000;

const THREAD_SEARCH_QUERY_KEY = ["threads", "search"] as const;
const SCHEDULED_TASKS_QUERY_KEY = ["scheduled-tasks"] as const;

export type ThreadActivityEntry = {
  thread_id: string;
  /** Server-owned origin of the thread's latest changed run; never null from a current backend. */
  origin_kind: ThreadOriginKind | null;
  status: string;
};

export type ThreadActivityResponse = {
  cursor: string;
  threads: ThreadActivityEntry[];
  truncated: boolean;
  read_version: number;
};

export type ThreadReadResponse = {
  unread: false;
  read_version: number;
};

/**
 * Poll state shared by the activity hook and `useMarkThreadRead`, one per
 * QueryClient. The app's QueryClient outlives a sign-out (it is a module
 * singleton and sign-in/out are client-side navigations), so
 * `useThreadActivity` resets this state when the workspace sidebar unmounts:
 * the next account seeds its own cursor and read clock.
 */
export type ThreadActivityState = {
  /** `null` until the first response seeds it. */
  cursor: string | null;
  /** Highest `read_version` seen or produced by this tab; `null` before the seed. */
  readVersion: number | null;
};

const activityStates = new WeakMap<QueryClient, ThreadActivityState>();

export function threadActivityState(
  queryClient: QueryClient,
): ThreadActivityState {
  let state = activityStates.get(queryClient);
  if (!state) {
    state = { cursor: null, readVersion: null };
    activityStates.set(queryClient, state);
  }
  return state;
}

/** Forget the cursor and read clock; the next poll seeds again. */
export function resetThreadActivityState(queryClient: QueryClient) {
  activityStates.delete(queryClient);
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseActivityResponse(body: unknown): ThreadActivityResponse {
  const record = (body ?? {}) as Record<string, unknown>;
  const threads = Array.isArray(record.threads) ? record.threads : [];
  return {
    cursor: typeof record.cursor === "string" ? record.cursor : "",
    threads: threads.flatMap((entry): ThreadActivityEntry[] => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const item = entry as Record<string, unknown>;
      if (typeof item.thread_id !== "string" || !item.thread_id) {
        return [];
      }
      return [
        {
          thread_id: item.thread_id,
          origin_kind: isThreadOriginKind(item.origin_kind)
            ? item.origin_kind
            : null,
          status: typeof item.status === "string" ? item.status : "",
        },
      ];
    }),
    truncated: record.truncated === true,
    read_version: readNumber(record.read_version),
  };
}

export async function fetchThreadActivity(
  cursor: string | null,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ThreadActivityResponse> {
  const params = new URLSearchParams({
    limit: String(THREAD_ACTIVITY_PAGE_LIMIT),
  });
  if (cursor !== null) {
    params.set("cursor", cursor);
  }
  const response = await fetch(
    `${getBackendBaseURL()}/api/thread-activity?${params}`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) {
    await throwGatewayResponseError(
      response,
      `Failed to load thread activity: ${response.statusText}`,
    );
  }
  return parseActivityResponse(await response.json());
}

export async function postThreadRead(
  threadId: string,
): Promise<ThreadReadResponse> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/read`,
    { method: "POST" },
  );
  if (!response.ok) {
    await throwGatewayResponseError(
      response,
      `Failed to mark the conversation read: ${response.statusText}`,
    );
  }
  const body = (await response.json()) as Record<string, unknown>;
  return { unread: false, read_version: readNumber(body.read_version) };
}

function invalidateThreadLists(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: THREAD_SEARCH_QUERY_KEY });
  void queryClient.invalidateQueries({
    queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
  });
}

export type ThreadActivityOutcome = {
  seeded: boolean;
  /** The thread lists were invalidated. */
  threads: boolean;
  /** The scheduled-task queries were invalidated. */
  scheduledTasks: boolean;
};

/**
 * Fold one activity response into the poll state and invalidate what
 * changed. Pure apart from the state update and the invalidations.
 */
export function applyThreadActivity(
  queryClient: QueryClient,
  state: ThreadActivityState,
  response: ThreadActivityResponse,
): ThreadActivityOutcome {
  if (state.cursor === null) {
    state.cursor = response.cursor;
    state.readVersion = Math.max(state.readVersion ?? 0, response.read_version);
    // The lists loaded on their own, possibly before a run this seed already
    // counts; later polls start after it, so refresh them once now.
    invalidateThreadLists(queryClient);
    return { seeded: true, threads: true, scheduledTasks: false };
  }
  // Defensive: an older backend may still list interactive (null-origin) rows.
  const relevant = response.threads.filter(
    (entry) => entry.origin_kind !== null,
  );
  // `read_version` only grows; a response computed before this tab's own read
  // (lower than what the POST returned) is not a change.
  const readChanged = response.read_version > (state.readVersion ?? 0);
  state.cursor = response.cursor || state.cursor;
  state.readVersion = Math.max(state.readVersion ?? 0, response.read_version);

  const threads = relevant.length > 0 || response.truncated || readChanged;
  if (threads) {
    invalidateThreadLists(queryClient);
  }
  const scheduledTasks = relevant.some(
    (entry) => entry.origin_kind === "schedule",
  );
  if (scheduledTasks) {
    void queryClient.invalidateQueries({ queryKey: SCHEDULED_TASKS_QUERY_KEY });
  }
  return { seeded: false, threads, scheduledTasks };
}

function isInvalidCursor(error: unknown): boolean {
  if (
    !(error instanceof GatewayResponseError) ||
    error.status !== 422 ||
    !error.body ||
    typeof error.body !== "object"
  )
    return false;
  const detail = Reflect.get(error.body, "detail");
  const record = detail && typeof detail === "object" ? detail : error.body;
  return Reflect.get(record, "code") === "invalid_cursor";
}

/** One poll: fetch from the stored cursor and apply the result. */
export async function pollThreadActivity(
  queryClient: QueryClient,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ThreadActivityResponse> {
  const state = threadActivityState(queryClient);
  try {
    const response = await fetchThreadActivity(state.cursor, { signal });
    signal?.throwIfAborted();
    if (activityStates.get(queryClient) === state)
      applyThreadActivity(queryClient, state, response);
    return response;
  } catch (error) {
    signal?.throwIfAborted();
    if (activityStates.get(queryClient) !== state) throw error;
    if (state.cursor === null || !isInvalidCursor(error)) {
      throw error;
    }
    // The server no longer accepts the cursor: seed again. Seeding refetches
    // the lists once, which covers the changes the old cursor cannot list.
    state.cursor = null;
    const response = await fetchThreadActivity(null, { signal });
    signal?.throwIfAborted();
    if (activityStates.get(queryClient) === state)
      applyThreadActivity(queryClient, state, response);
    return response;
  }
}

export function threadActivityQueryOptions(
  queryClient: QueryClient,
  { enabled }: { enabled: boolean },
) {
  return {
    queryKey: THREAD_ACTIVITY_QUERY_KEY,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      pollThreadActivity(queryClient, { signal }),
    enabled,
    staleTime: 0,
    refetchInterval: THREAD_ACTIVITY_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  } as const;
}

/**
 * The cached `unread` flag of a thread across the loaded thread lists: `true`
 * if any list says unread, `false` if lists know it and none does, `undefined`
 * when no list has the thread or none knows (`null`).
 */
export function cachedThreadUnread(
  queryClient: QueryClient,
  threadId: string,
): boolean | undefined {
  let known: boolean | undefined;
  const visit = (thread: AgentThread) => {
    if (thread.thread_id !== threadId || typeof thread.unread !== "boolean") {
      return;
    }
    known = known === true || thread.unread;
  };
  for (const [, data] of queryClient.getQueriesData<AgentThread[]>({
    queryKey: THREAD_SEARCH_QUERY_KEY,
  })) {
    if (Array.isArray(data)) {
      data.forEach(visit);
    }
  }
  for (const [, data] of queryClient.getQueriesData<InfiniteThreadsData>({
    queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
  })) {
    data?.pages.forEach((page) => page.threads.forEach(visit));
  }
  return known;
}

/** Set `unread` on a thread wherever the thread lists cache it. */
export function setThreadUnreadInCaches(
  queryClient: QueryClient,
  threadId: string,
  unread: boolean,
) {
  const patch = (thread: AgentThread) =>
    thread.thread_id === threadId && thread.unread !== unread
      ? { ...thread, unread }
      : thread;
  queryClient.setQueriesData<AgentThread[]>(
    { queryKey: THREAD_SEARCH_QUERY_KEY, exact: false },
    (data) => (Array.isArray(data) ? data.map(patch) : data),
  );
  queryClient.setQueriesData<InfiniteThreadsData>(
    { queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX, exact: false },
    (data) => mapInfiniteThreadsCache(data, patch),
  );
}

/**
 * Mark a thread read now: patch the caches optimistically, post the read and
 * record the returned `read_version` so the next poll does not refetch the
 * lists for this tab's own read; reads from other devices that the version
 * also covers refetch them. On failure the lists are refetched so the
 * server's state shows again.
 */
export async function markThreadRead(
  queryClient: QueryClient,
  threadId: string,
): Promise<void> {
  const state = threadActivityState(queryClient);
  setThreadUnreadInCaches(queryClient, threadId, false);
  try {
    const { read_version } = await postThreadRead(threadId);
    if (activityStates.get(queryClient) !== state) return;
    const previous = state.readVersion;
    // The returned clock is the user's, not this read's: a jump past this one
    // read includes reads on other devices, whose threads the non-polling
    // lists may still show unread, so refresh them instead of skipping those.
    if (previous !== null && read_version > previous + 1) {
      invalidateThreadLists(queryClient);
    }
    state.readVersion = Math.max(previous ?? 0, read_version);
  } catch {
    if (activityStates.get(queryClient) === state)
      invalidateThreadLists(queryClient);
  }
}
