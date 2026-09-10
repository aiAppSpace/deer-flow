/*
  【文件职责】     会话列表结果的过滤规则：什么算「该出现在主列表里」。
  【架构位置】     L3
  【主要导出】     ThreadSearchParams · filterThreadSearchResults
  【依赖关系】     core/sidecar/thread · core/types/message · ./types
  【边界与注意】   **这里曾经还有一个 `buildThreadsSearchQueryOptions`**，
                   它是 `["threads", "search"]` 这个 key 的唯一生产者——而
                   `app/` 下没有任何调用点，只有它自己的单测在用（上游同名的
                   `useThreads` 同样零调用点）。于是那个 key 在本仓**没有任何查询
                   拥有它**，所有针对它的 `setQueriesData` / `invalidateQueries` /
                   `cancelQueries` 全是空操作——`setQueriesData` 只更新已存在的查询。
                   2026-09-11 连同 11 处空操作一起删掉；会话列表走的是
                   `["threads", "searchInfinite", params]`（`./infinite.ts`）。

                   `shouldIncludeSidecarThreads` 不再导出：它只被下面这一个函数用。
*/

import {
  SIDECAR_METADATA_KEY,
  shouldShowInPrimaryThreadLists,
} from "@/core/sidecar/thread";
import type { ThreadsClient } from "@/core/types/message";

import type { AgentThread } from "./types";

export type ThreadSearchParams = NonNullable<
  Parameters<ThreadsClient["search"]>[0]
>;

type ThreadSearchFilterParams = Pick<ThreadSearchParams, "metadata">;

function shouldIncludeSidecarThreads(params: ThreadSearchFilterParams) {
  const metadata = params.metadata;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    Reflect.get(metadata, SIDECAR_METADATA_KEY) === true
  );
}

export function filterThreadSearchResults(
  threads: AgentThread[],
  params: ThreadSearchFilterParams,
) {
  if (shouldIncludeSidecarThreads(params)) {
    return threads;
  }
  return threads.filter(shouldShowInPrimaryThreadLists);
}
