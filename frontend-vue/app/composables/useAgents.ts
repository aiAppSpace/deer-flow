/*
  【文件职责】     作为 Agent catalog 与 lifecycle mutations 的唯一 Vue Query owner。
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useAgents
  【依赖关系】     @tanstack/vue-query · core/agents API/query keys
  【边界与注意】   feature 未加载或关闭时不发 list；detail 由 useChatAgent 订阅 canonical key。
*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  deleteAgent,
  importAgentPackage,
  listAgents,
  updateAgent,
} from "@/core/agents/api";
import { agentKeys } from "@/core/agents/query-keys";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import type { Agent, UpdateAgentRequest } from "@/core/agents/types";

type UpdateVariables = { agent: Agent; request: UpdateAgentRequest };

export function useAgents(options: {
  enabled: MaybeRefOrGetter<boolean>;
  retry?: false;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: agentKeys.list(),
    enabled: computed(() => Boolean(toValue(options.enabled))),
    queryFn: ({ signal }) => listAgents({ signal }),
    ...(options.retry === false ? { retry: false as const } : {}),
  });

  async function syncAgent(next: Agent) {
    queryClient.setQueryData(agentKeys.detail(next.name), next);
    queryClient.setQueryData<Agent[]>(agentKeys.list(), (rows) =>
      (rows ?? []).map((row) => (row.name === next.name ? next : row)),
    );
    await queryClient.invalidateQueries({
      queryKey: agentKeys.list(),
      exact: true,
    });
  }

  const update = useMutation({
    onMutate: () => captureWorkspaceQueryOwner(queryClient),
    mutationFn: ({ agent, request }: UpdateVariables) =>
      updateAgent(agent.name, request),
    onSuccess: async (next, _variables, isCurrent) => {
      if (isCurrent?.()) await syncAgent(next);
    },
  });
  const remove = useMutation({
    onMutate: () => captureWorkspaceQueryOwner(queryClient),
    mutationFn: (agent: Agent) => deleteAgent(agent.name),
    onSuccess: async (_result, agent, isCurrent) => {
      if (!isCurrent?.()) return;
      queryClient.removeQueries({
        queryKey: agentKeys.detail(agent.name),
        exact: true,
      });
      queryClient.setQueryData<Agent[]>(agentKeys.list(), (rows) =>
        (rows ?? []).filter((row) => row.name !== agent.name),
      );
      await queryClient.invalidateQueries({
        queryKey: agentKeys.list(),
        exact: true,
      });
    },
  });
  const importPackage = useMutation({
    onMutate: () => captureWorkspaceQueryOwner(queryClient),
    mutationFn: ({
      agentPackage,
      name,
    }: {
      agentPackage: unknown;
      name?: string;
    }) => importAgentPackage(agentPackage, name),
    onSuccess: async (next, _variables, isCurrent) => {
      if (!isCurrent?.()) return;
      queryClient.setQueryData(agentKeys.detail(next.name), next);
      await queryClient.invalidateQueries({
        queryKey: agentKeys.list(),
        exact: true,
      });
    },
  });

  return {
    agents: computed(() => query.data.value ?? []),
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    update,
    remove,
    importPackage,
  };
}
