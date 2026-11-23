/*
 * L3 REST adapter for the eight consumed threads/runs methods. Keep the
 * /api/langgraph prefix used by the proxy, SSE routing and public API contract.
 * fetcher owns credentials and CSRF; response errors retain structured details.
 */

import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { throwGatewayResponseError } from "@/core/api/errors";
import type { AgentThread, AgentThreadState } from "@/core/threads/types";
import type { ThreadSearchQuery } from "@/core/types/message";

export interface DeerFlowRun {
  run_id: string;
  thread_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface DeerFlowApiClient {
  threads: {
    create(input?: {
      threadId?: string;
      metadata?: Record<string, unknown>;
    }): Promise<AgentThread>;
    search(query?: ThreadSearchQuery<AgentThreadState>): Promise<AgentThread[]>;
    get(
      threadId: string,
      options?: { signal?: AbortSignal },
    ): Promise<AgentThread>;
    getState(threadId: string): Promise<{ values: AgentThreadState }>;
    updateState(
      threadId: string,
      update: { values: Partial<AgentThreadState> },
    ): Promise<void>;
    delete(threadId: string): Promise<void>;
  };
  runs: {
    list(
      threadId: string,
      options?: { signal?: AbortSignal },
    ): Promise<DeerFlowRun[]>;
    get(threadId: string, runId: string): Promise<DeerFlowRun>;
  };
}

export interface DeerFlowApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetchWithAuth;
}

/** Keep AbortSignal out of JSON and translate the SDK-shaped sort options to wire names. */
function splitSearchQuery(query: ThreadSearchQuery<AgentThreadState> = {}): {
  signal: AbortSignal | undefined;
  body: Record<string, unknown>;
} {
  const { signal, sortBy, sortOrder, ...rest } = query;
  const body: Record<string, unknown> = { ...rest };
  if (sortBy !== undefined) body.sort_by = sortBy;
  if (sortOrder !== undefined) body.sort_order = sortOrder;
  return { signal, body };
}

export function createDeerFlowApiClient(
  options: DeerFlowApiClientOptions,
): DeerFlowApiClient {
  const { baseUrl, fetchImpl = fetchWithAuth } = options;
  const base = baseUrl.replace(/\/+$/, "");
  const threadUrl = (threadId: string) =>
    `${base}/threads/${encodeURIComponent(threadId)}`;

  async function request<T>(
    url: string,
    init: RequestInit,
    fallback: string,
  ): Promise<T> {
    const response = await fetchImpl(url, init);
    if (!response.ok) await throwGatewayResponseError(response, fallback);
    // 204 与空 body 都不能喂给 json()：SyntaxError 会把「删除成功」报成失败。
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  const json = { "Content-Type": "application/json" };

  return {
    threads: {
      create(input = {}) {
        return request<AgentThread>(
          `${base}/threads`,
          {
            method: "POST",
            headers: json,
            // The Gateway supplies its default assistant. Custom agents are
            // selected by metadata.agent_name, matching the React request.
            body: JSON.stringify({
              ...(input.threadId ? { thread_id: input.threadId } : {}),
              metadata: input.metadata ?? {},
            }),
          },
          "Failed to create thread.",
        );
      },
      search(query) {
        const { signal, body } = splitSearchQuery(query);
        return request<AgentThread[]>(
          `${base}/threads/search`,
          {
            method: "POST",
            headers: json,
            body: JSON.stringify(body),
            ...(signal ? { signal } : {}),
          },
          "Failed to search threads.",
        );
      },
      get(threadId, options = {}) {
        return request<AgentThread>(
          threadUrl(threadId),
          {
            method: "GET",
            ...(options.signal ? { signal: options.signal } : {}),
          },
          "Failed to load thread.",
        );
      },
      getState(threadId) {
        return request<{ values: AgentThreadState }>(
          `${threadUrl(threadId)}/state`,
          { method: "GET" },
          "Failed to load thread state.",
        );
      },
      async updateState(threadId, update) {
        // 这两个是 `Promise<void>`，所以**不能**写成 `request<void>`：
        // `void` 当泛型实参会被 @typescript-eslint/no-invalid-void-type 拦下。
        // 包一层 async 函数，返回值自然被丢弃。
        await request<unknown>(
          `${threadUrl(threadId)}/state`,
          { method: "POST", headers: json, body: JSON.stringify(update) },
          "Failed to update thread state.",
        );
      },
      async delete(threadId) {
        await request<unknown>(
          threadUrl(threadId),
          { method: "DELETE" },
          "Failed to delete thread.",
        );
      },
    },
    runs: {
      list(threadId, options = {}) {
        // Match the consumed SDK wire defaults, even though the current Gateway
        // bare-array route ignores pagination. Cancellation remains transport-only.
        return request<DeerFlowRun[]>(
          `${threadUrl(threadId)}/runs?limit=10&offset=0`,
          { method: "GET", signal: options.signal },
          "Failed to list runs.",
        );
      },
      get(threadId, runId) {
        return request<DeerFlowRun>(
          `${threadUrl(threadId)}/runs/${encodeURIComponent(runId)}`,
          { method: "GET" },
          "Failed to load run.",
        );
      },
    },
  };
}
