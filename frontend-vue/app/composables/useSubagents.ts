/*
  【文件职责】     用 Vue Query 暴露 subagent 列表与托管 subagent 的增改删。
  【架构位置】     L3 composable
  【主要导出】     subagentKeys · useSubagents · useSubagentMutations
  【依赖关系】     @tanstack/vue-query · core/subagents
  【边界与注意】   三个写操作都失效同一个列表 key——它们改的是同一份清单。
                   写操作**不在这里弹提示**：成功说什么、失败说什么是产品面的事，
                   由调用方决定（同 `useProjects` 的做法）。
*/

import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { useScopedGatewayRequests } from "@/composables/useScopedGatewayRequests";

import {
  createManagedSubagent,
  deleteManagedSubagent,
  listSubagents,
  updateManagedSubagent,
  type CreateManagedSubagentRequest,
  type UpdateManagedSubagentRequest,
} from "@/core/subagents";

export const subagentKeys = {
  list: () => ["subagents"] as const,
};

export function useSubagents() {
  const query = useQuery({
    queryKey: subagentKeys.list(),
    queryFn: ({ signal }) => listSubagents({ signal }),
  });
  return {
    subagents: computed(() => query.data.value ?? []),
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useSubagentMutations() {
  const queryClient = useQueryClient();
  const requests = useScopedGatewayRequests();
  const invalidate = () => {
    return queryClient.invalidateQueries({ queryKey: subagentKeys.list() });
  };

  const create = requests.mutation({
    mutationFn: (request: CreateManagedSubagentRequest, signal) =>
      createManagedSubagent(request, { signal }),
    onSuccess: invalidate,
  });
  const update = requests.mutation({
    mutationFn: (
      {
        name,
        request,
      }: {
        name: string;
        request: UpdateManagedSubagentRequest;
      },
      signal,
    ) => updateManagedSubagent(name, request, { signal }),
    onSuccess: invalidate,
  });
  const remove = requests.mutation({
    mutationFn: (name: string, signal) =>
      deleteManagedSubagent(name, { signal }),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
