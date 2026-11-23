/*
 * L3 REST client assembly, cached by resolved base URL. The run session owns
 * streaming, replay cursors and gap recovery; this module exposes their shared
 * gap helpers without reintroducing the removed LangGraph SDK lifecycle.
 */

import { getLangGraphBaseURL } from "@/core/config";

import { createDeerFlowApiClient } from "./client";
import type { DeerFlowApiClient } from "./client";

export type { StreamReplayGapData } from "@/core/agent-deerflow/gap";
export {
  parseStreamReplayGap,
  replayGapError,
} from "@/core/agent-deerflow/gap";
export type { DeerFlowApiClient, DeerFlowRun } from "./client";

/**
 * 按解析出来的 base URL 缓存。
 *
 * 上游按 `isMock` 缓存两份；这里按 URL 缓存，效果相同但少一个隐含约定——
 * runtime options 换了之后 `getLangGraphBaseURL` 的结果就变了，缓存键跟着变，
 * 不会拿着旧 base URL 的 client 继续用。
 */
const clients = new Map<string, DeerFlowApiClient>();

export function getAPIClient(isMock?: boolean): DeerFlowApiClient {
  const baseUrl = getLangGraphBaseURL(isMock);
  const cached = clients.get(baseUrl);
  if (cached) return cached;

  const client = createDeerFlowApiClient({ baseUrl });
  clients.set(baseUrl, client);
  return client;
}

/** 测试与 HMR 用。 */
export function resetAPIClients(): void {
  clients.clear();
}
