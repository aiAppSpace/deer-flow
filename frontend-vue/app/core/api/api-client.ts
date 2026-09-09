/*
  【文件职责】     `getAPIClient()` 的落点：把自写 REST client 装配好并缓存。
  【架构位置】     L3
  【主要导出】     getAPIClient · resetAPIClients · gap 相关类型与 helper
  【依赖关系】     ./client · @/core/config · @/core/agent-deerflow/gap
  【边界与注意】   REWRITE，不是搬运。上游 `api-client.ts`（475 行）里**大部分是在给 SDK 打补丁**
                   （包 runs.stream/joinStream/cancel、SDK 错误串匹配、
                   sessionStorage 里的重连记账）。没有 SDK 就没有这些补丁的对象，
                   照着补一遍等于把 SDK 的问题连同解法一起搬进来。

                   有意**没有**从上游带过来的三样，理由都是「它的对象不存在了」：
                   - `isInactiveRunStreamError` / `isRunNotCancellableError`：
                     靠匹配 SDK 的 `"HTTP 409: {...}"` 消息串工作。自写 client
                     的错误经 `throwGatewayApiError` 归一化，形状不同，
                     照搬会得到两个永远返回 false 的函数。
                   - `clearReconnectRun` 与 `lg:stream:` 的 sessionStorage 记账：
                     那是 SDK 的重连簿记；自研 transport 的游标是 SSE
                     `Last-Event-ID`，由 run session 持有。
                   - gap 恢复循环：搬到了 run session 与
                     `agent-deerflow/gap.ts`，不再是 client 的职责。
                   这三样在 M4 接线 `threads/hooks.ts` 时要被重新审视一次——
                   它是目前唯一还引用它们的地方，而它本身也是 REWRITE 档。
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
