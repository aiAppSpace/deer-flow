import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { throwGatewayResponseError } from "@/core/api/errors";

import { runResourceUrl, type DeerFlowRunHandle } from "./endpoints";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Checkpoints can lag the run's admitted input. IDs preserve later deduplication. */
export function hydrateDeerFlowRunInput(
  values: unknown,
  run: unknown,
): Record<string, unknown> {
  const durable = record(values) ?? {};
  const input = record(record(record(run)?.kwargs)?.input);
  if (!Array.isArray(input?.messages) || input.messages.length === 0)
    return durable;
  const messages = Array.isArray(durable.messages) ? [...durable.messages] : [];
  const seen = new Set(
    messages.flatMap((message: unknown) => {
      const id = record(message)?.id;
      return typeof id === "string" && id.length > 0 ? [id] : [];
    }),
  );
  for (const message of input.messages) {
    const id = record(message)?.id;
    if (typeof id === "string" && id.length > 0) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    messages.push(message);
  }
  return { ...durable, messages };
}

/** Only an explicitly evicted/legacy (404) run record may omit admitted input. */
export async function loadDeerFlowRunState({
  baseUrl,
  handle,
  signal,
  fetchImpl = fetchWithAuth,
}: {
  baseUrl: string;
  handle: DeerFlowRunHandle;
  signal: AbortSignal;
  fetchImpl?: typeof fetchWithAuth;
}): Promise<Record<string, unknown>> {
  signal.throwIfAborted();
  const [values, run] = await Promise.all([
    (async () => {
      const response = await fetchImpl(
        `${baseUrl.replace(/\/+$/, "")}/threads/${encodeURIComponent(handle.threadId)}/state`,
        { signal },
      );
      if (!response.ok)
        await throwGatewayResponseError(
          response,
          "Could not reload the thread state.",
        );
      const state: unknown = await response.json();
      return record(state)?.values;
    })(),
    (async () => {
      const response = await fetchImpl(runResourceUrl(baseUrl, handle), {
        signal,
      });
      if (response.status === 404) return undefined;
      if (!response.ok)
        await throwGatewayResponseError(
          response,
          "Could not reload the run input.",
        );
      return (await response.json()) as unknown;
    })(),
  ]);
  signal.throwIfAborted();
  return hydrateDeerFlowRunInput(values, run);
}
