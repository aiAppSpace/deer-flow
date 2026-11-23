/*
  【文件职责】     作为 Memory document 与 CRUD/import mutations 的唯一 Vue Query owner。
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useMemory
  【依赖关系】     @tanstack/vue-query · memory api/query key
  【边界与注意】   mutation 不乐观伪装成功；scope dispose 中止在途 I/O，完整 Gateway 响应原样进入同一缓存。
*/

import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useScopedGatewayRequests } from "@/composables/useScopedGatewayRequests";

import {
  clearMemory,
  createMemoryFact,
  deleteMemoryFact,
  exportMemory,
  importMemory,
  loadMemory,
  updateMemoryFact,
  type MemoryImportDispatchObserver,
} from "@/core/memory/api";
import { MEMORY_QUERY_KEY } from "@/core/memory/query-keys";
import type {
  MemoryFactInput,
  MemoryFactPatchInput,
  UserMemory,
} from "@/core/memory/types";

export function useMemory(observeDispatch?: MemoryImportDispatchObserver) {
  const queryClient = useQueryClient();
  const requests = useScopedGatewayRequests();
  const query = useQuery({
    queryKey: MEMORY_QUERY_KEY,
    queryFn: ({ signal }) => loadMemory({ signal }),
  });
  const sync = (next: UserMemory) => {
    queryClient.setQueryData(MEMORY_QUERY_KEY, next);
  };
  const clear = requests.mutation<UserMemory>({
    mutationFn: (_input, signal) => clearMemory({ signal }),
    onSuccess: sync,
  });
  const create = requests.mutation({
    mutationFn: (input: MemoryFactInput, signal) =>
      createMemoryFact(input, { signal }),
    onSuccess: sync,
  });
  const remove = requests.mutation({
    mutationFn: (factId: string, signal) =>
      deleteMemoryFact(factId, { signal }),
    onSuccess: sync,
  });
  const importDocument = requests.mutation({
    mutationFn: (input: UserMemory, signal) =>
      observeDispatch
        ? importMemory(input, { signal }, observeDispatch)
        : importMemory(input, { signal }),
    onSuccess: sync,
  });
  const exportDocument = requests.mutation<UserMemory>({
    mutationFn: (_input, signal) => exportMemory({ signal }),
  });
  const update = requests.mutation({
    mutationFn: (
      {
        factId,
        input,
      }: {
        factId: string;
        input: MemoryFactPatchInput;
      },
      signal,
    ) => updateMemoryFact(factId, input, { signal }),
    onSuccess: sync,
  });
  return {
    memory: query.data,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    clear,
    create,
    remove,
    importDocument,
    exportDocument,
    update,
  };
}
