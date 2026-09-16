/*
  【文件职责】     会话归档/取消归档的写入与缓存收尾。
  【架构位置】     L3 thread server-state
  【主要导出】     ArchiveThreadVariables · setThreadMetadataInCaches · useArchiveThread
  【依赖关系】     @tanstack/vue-query · ./api · ./infinite · ./utils · ../projects/query-keys
  【边界与注意】   顺序是**取消在途 → 写缓存 → 丢弃旧偏移 + 失效**，三步都承重：

                   1. 先取消三处在途查询。归档是一次写，而一个更早发出的读回来会把
                      旧状态放回去——UI 上就是「归档了一下又弹回来」，且没有任何征兆。
                   2. 写缓存让列表立刻反映新状态。
                   3. 无限列表用 **resetQueries 而不是 invalidateQueries**：成员关系变了，
                      旧的分页偏移不再对得上，只失效会拿着过时的 offset 继续翻。
                      搜索与单条元数据用失效即可，它们没有偏移。
                      项目会话列表也要失效——归档改变了它的成员关系，其余每一种会话
                      mutation（置顶/改名/删除/移动/停止）都失效这个前缀，归档不能例外。

                   回调注册在 **mutation 级**而不是每次 mutate 传：被归档的会话会立刻
                   离开侧栏列表，那一行卸载后按调用传入的回调就没了，成功提示会静默丢失。
*/

import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/vue-query";

import { projectKeys } from "@/core/projects/query-keys";

import { patchThreadMetadata, type ThreadMetadataPatchResponse } from "./api";
import { threadMetadataQueryKey } from "./metadata";
import {
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  mapInfiniteThreadsCache,
} from "./infinite";
import type { AgentThread } from "./types";
import { THREAD_ARCHIVED_METADATA_KEY } from "./utils";

export interface ArchiveThreadVariables {
  threadId: string;
  archived: boolean;
}

export interface ArchiveThreadOptions {
  onSuccess?: (
    data: ThreadMetadataPatchResponse,
    variables: ArchiveThreadVariables,
  ) => void;
  onError?: (error: Error, variables: ArchiveThreadVariables) => void;
}

/**
 * 把一条会话的元数据合并进三处缓存：搜索列表、无限列表、单条元数据。
 *
 * 三处都要写——只写一处会让侧栏与会话页显示不同的归档状态。
 */
export function setThreadMetadataInCaches(
  queryClient: QueryClient,
  threadId: string,
  metadata: Record<string, unknown>,
): void {
  const merge = (thread: AgentThread): AgentThread => ({
    ...thread,
    metadata: { ...thread.metadata, ...metadata },
  });

  queryClient.setQueriesData(
    { queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX },
    (old) =>
      mapInfiniteThreadsCache(
        old as Parameters<typeof mapInfiniteThreadsCache>[0],
        (thread) => (thread.thread_id === threadId ? merge(thread) : thread),
      ),
  );
  queryClient.setQueriesData<AgentThread | null>(
    { queryKey: threadMetadataQueryKey(threadId) },
    (old) => (old ? merge(old) : old),
  );
}

export function useArchiveThread(options: ArchiveThreadOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, archived }: ArchiveThreadVariables) =>
      patchThreadMetadata(threadId, {
        [THREAD_ARCHIVED_METADATA_KEY]: archived,
      }),
    async onSuccess(response, { threadId, archived }) {
      const metadataKey = threadMetadataQueryKey(threadId);
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
        }),
        queryClient.cancelQueries({ queryKey: metadataKey }),
      ]);

      setThreadMetadataInCaches(queryClient, threadId, {
        [THREAD_ARCHIVED_METADATA_KEY]: archived,
      });

      await Promise.all([
        // 成员关系变了，旧的分页偏移作废——必须 reset 而不是 invalidate。
        queryClient.resetQueries({
          queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
        }),
        queryClient.invalidateQueries({ queryKey: metadataKey }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.threadsPrefix(),
        }),
      ]);

      options.onSuccess?.(response, { threadId, archived });
    },
    onError: (error, variables) => {
      options.onError?.(error, variables);
    },
  });
}
