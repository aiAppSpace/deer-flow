/*
  【文件职责】     用 DeerFlow Gateway 实现内核的 RunProtocol 四个方法。
  【架构位置】     L3
  【主要导出】     DeerFlowRunInput · DEERFLOW_DURABLE_STATUS · createDeerFlowRunProtocol
  【依赖关系】     @deerflow/agent-core · ./endpoints · @/core/api/stream-mode · @/core/api/fetcher
  【边界与注意】   **stream mode 校验在这里、在 HTTP 之前（05 A2）。**
                   上游是在调 SDK 之前校验的；改成自研 transport 之后那个时机
                   没有了，所以契约挪到「适配层构造请求时」——把它固定在一个有
                   测试覆盖的模块里，比指望每个调用点自觉可靠。
                   `sanitizeRunStreamOptions` 仍然落在 `@/core/api/stream-mode`
                   而不是本目录：它与 React 共用白名单语义，但由 Vue 适配层维护
                   wire 命名桥接，不进入通用内核。"不在内核里"这条已由
                   architecture.test.ts 守住。

                   durable status → 内核 outcome 的映射也在这里。内核不认识
                   `"interrupted"` 这类字符串（L1 禁入清单第 2/3 条），
                   它只收 completed/cancelled/failed 三选一。
*/

import { runInvocationForInput } from "@/core/diagnostics/run-observation";
import type {
  CancelResult,
  InspectedRun,
  OpenedStream,
  RunOutcome,
  RunProtocol,
} from "@deerflow/agent-core";
import { AgentStreamError } from "@deerflow/agent-core";

import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { sanitizeRunStreamOptions } from "@/core/api/stream-mode";

import type { DeerFlowRunHandle } from "./endpoints";
import {
  parseRunHandle,
  runCancelUrl,
  runResourceUrl,
  runResumeUrl,
  runStreamUrl,
} from "./endpoints";

/** 这一层反复出现的具体化，给它一个名字省得每处都写两个类型参数。 */
export type DeerFlowProtocol = RunProtocol<DeerFlowRunInput, DeerFlowRunHandle>;

export interface DeerFlowRunInput {
  threadId: string;
  /** 原样转发给 Gateway 的 run 请求体（assistant_id / input / context / …）。 */
  payload: Record<string, unknown>;
  /** Reuse only when deliberately retrying the same immutable submission. */
  idempotencyKey?: string;
}

/**
 * 把 wire 请求体桥接成 `sanitizeRunStreamOptions` 认识的形状再校验。
 *
 * ⚠️ **这个桥是必需的。** 到了适配层构造请求的时刻，手里已经不是 SDK 的
 * options 对象而是 wire 请求体了：
 * SDK validator 认 `streamMode`（camelCase），Gateway wire 收
 * `stream_mode`（snake_case）。把 validator 直接套在 wire 请求体上，
 * `"streamMode" in options` 恒为 false，**校验一声不响地什么都不做**——
 * 这是被本文件的 A2 测试抓出来的，不是推理出来的。
 */
function assertSupportedStreamModes(payload: Record<string, unknown>): void {
  const streamMode = payload.stream_mode;
  if (streamMode == null) return;
  sanitizeRunStreamOptions({ streamMode });
}

/**
 * Gateway 的 durable run status 全集，以及它们到内核终态的冻结映射（08 §258）。
 *
 * `pending` / `running` 不是终态，所以没有 outcome——它们对应内核的
 * `creating` / `streaming`，由会话自己维护，不从这里读。
 *
 * **「全集」这句话现在有机器守着**（wave 107）：
 * `tests/guards/backend-enum-mirror.test.ts` 拿这张表的键与后端
 * `packages/harness/deerflow/runtime/runs/schemas.py` 的 `RunStatus` 逐个比。
 * 在那之前它只是一句注释——wave 106 实测两边确实一致，但后端加一个状态
 * 不会有任何征兆，而后果是**停止操作在那个状态上永远收敛不了**（下面
 * `inspect` 把不认识的 status 当作「还没到终态」，只能靠有界轮询兜底）。
 */
export const DEERFLOW_DURABLE_STATUS: Record<string, RunOutcome | null> = {
  pending: null,
  running: null,
  success: "completed",
  interrupted: "cancelled",
  error: "failed",
  timeout: "failed",
};

export interface DeerFlowProtocolOptions {
  /** `/api/langgraph` 前缀的完整 base（02：前缀不能改，它是 nginx 与 E2E 的挂载点）。 */
  baseUrl: string;
  /** 便于测试注入；默认走带 CSRF 与 credentials 的 fetcher。 */
  fetchImpl?: typeof fetchWithAuth;
}

async function failFromResponse(
  response: Response,
  action: string,
): Promise<never> {
  const body = await response.text().catch(() => "");
  throw new AgentStreamError(
    "http",
    `${action} failed with HTTP ${response.status}${body ? `: ${body}` : ""}`,
  );
}

export function createDeerFlowRunProtocol(
  options: DeerFlowProtocolOptions,
): RunProtocol<DeerFlowRunInput, DeerFlowRunHandle> {
  const { baseUrl, fetchImpl = fetchWithAuth } = options;

  return {
    async create(input, signal): Promise<OpenedStream<DeerFlowRunHandle>> {
      const observation = runInvocationForInput(input);
      // 05 A2：含不支持模式时必须**在 HTTP 之前**抛错，不能部分转发、
      // 也不能静默降级为 values。这两行的位置就是那条不变式。
      assertSupportedStreamModes(input.payload);
      if (input.payload.stream_resumable === true) {
        throw new AgentStreamError(
          "http",
          "Gateway does not support stream_resumable=true.",
        );
      }

      const response = await fetchImpl(runStreamUrl(baseUrl, input.threadId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : {}),
        },
        body: JSON.stringify({ on_disconnect: "continue", ...input.payload }),
        signal,
      });
      if (!response.ok) await failFromResponse(response, "Run creation");

      // 05 L12：只认 Content-Location。实测 Gateway 不发 Location，
      // 找不到就 fail closed——没有 handle 就不能自动续传（08 §硬规则 2）。
      const handle = parseRunHandle(response.headers.get("Content-Location"));
      if (!handle) {
        throw new AgentStreamError(
          "missing_handle",
          "Gateway did not return a Content-Location for the new run.",
        );
      }
      observation?.received(handle, handle.threadId, handle.runId);
      return { handle, response };
    },

    async resume(handle, cursor, signal): Promise<Response> {
      const response = await fetchImpl(runResumeUrl(baseUrl, handle), {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          // 游标为空时**不发**这个头：发一个空的 Last-Event-ID 与"从头开始"
          // 不是一回事，后端会把它当成一个真实的、已经不存在的游标。
          ...(cursor ? { "Last-Event-ID": cursor } : {}),
        },
        signal,
      });
      if (!response.ok) await failFromResponse(response, "Run resume");
      return response;
    },

    async cancel(handle, cursor, signal): Promise<CancelResult> {
      const response = await fetchImpl(runCancelUrl(baseUrl, handle), {
        method: "POST",
        signal,
      });

      // 三种结果各有含义，压成 void 就等于把「run 到底停没停」这个问题丢掉
      // （05 L16）。204 是已确认终态；202 是收到了但还没停；200 带 SSE body
      // 说明要继续读尾帧。
      if (response.status === 204) {
        return { kind: "terminal", outcome: "cancelled" };
      }
      if (response.status === 202) return { kind: "accepted" };
      if (response.ok && response.body) {
        return { kind: "drain", response };
      }
      if (response.ok) return { kind: "accepted" };
      if (response.status === 409) {
        const body: unknown = await response
          .clone()
          .json()
          .catch(() => null);
        const detail =
          typeof body === "object" && body !== null
            ? Reflect.get(body, "detail")
            : undefined;
        const match =
          typeof detail === "string"
            ? /^Run (.+) is not cancellable \(status: (success|interrupted|error|timeout)\)$/.exec(
                detail,
              )
            : null;
        const status = match?.[1] === handle.runId ? match[2] : undefined;
        const outcome = status ? DEERFLOW_DURABLE_STATUS[status] : undefined;
        if (status && outcome) {
          // The run finished before cancel won the race. Drain its tail; a
          // terminal record alone is not proof that all stream events arrived.
          const tail = await fetchImpl(runResumeUrl(baseUrl, handle), {
            method: "GET",
            headers: {
              Accept: "text/event-stream",
              ...(cursor ? { "Last-Event-ID": cursor } : {}),
            },
            signal,
          });
          if (!tail.ok) await failFromResponse(tail, "Run cancel tail");
          return { kind: "drain", response: tail, outcome, reason: status };
        }
      }
      return failFromResponse(response, "Run cancel");
    },

    async inspect(handle, signal): Promise<InspectedRun> {
      const response = await fetchImpl(runResourceUrl(baseUrl, handle), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) await failFromResponse(response, "Run inspect");

      const run = (await response.json()) as { status?: unknown };
      const status = typeof run.status === "string" ? run.status : "";
      const outcome = DEERFLOW_DURABLE_STATUS[status];

      // 未知 status 当作**还没到终态**，不是失败：多一个枚举值就把 run 判死，
      // 会在后端加状态的那天让所有停止操作都报错。有界轮询本身会兜底。
      if (outcome === undefined || outcome === null) {
        return { terminal: false, reason: status };
      }
      return { terminal: true, outcome, reason: status };
    },
  };
}
