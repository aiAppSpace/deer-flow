import {
  computed,
  onScopeDispose,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import { useCapabilityUser } from "@/composables/useCapabilities";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import {
  createMCPServers,
  deleteMCPServer,
  loadMCPConfig,
  MCPConfigRequestError,
  updateMCPServer,
  updateMCPServerState,
  type MCPScope,
} from "@/core/mcp/api";
import type { MCPServerConfig } from "@/core/mcp/types";

export type MCPServerMutationVariables =
  | { operation: "create"; servers: Record<string, MCPServerConfig> }
  | { operation: "update"; serverName: string; server: MCPServerConfig }
  | { operation: "delete"; serverName: string }
  | { operation: "toggle"; serverName: string; enabled: boolean };

export function useScopedMCPConfig(scope: MaybeRefOrGetter<MCPScope>) {
  const user = useCapabilityUser();
  const client = useQueryClient();
  const canManage = computed(
    () =>
      !!user.value &&
      (toValue(scope) === "user" || user.value.system_role === "admin"),
  );
  const key = computed(
    () => ["mcpConfig", toValue(scope), user.value?.id] as const,
  );
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal, queryKey }) =>
      loadMCPConfig({ scope: queryKey[1], signal }),
    enabled: canManage,
    retry: (count, error) =>
      !(error instanceof MCPConfigRequestError) && count < 3,
  });
  const controllers = new Set<AbortController>();
  function cancel() {
    controllers.forEach((controller) => controller.abort());
  }
  watch(key, cancel);
  onScopeDispose(cancel);
  const mutation = useMutation({
    onMutate: () => captureWorkspaceQueryOwner(client),
    mutationFn: async (input: MCPServerMutationVariables) => {
      if (!canManage.value) throw new Error("Admin privileges required.");
      // The request owns its identity even if the UI switches while it replies.
      const requestKey = key.value;
      const controller = new AbortController();
      controllers.add(controller);
      const options = { scope: requestKey[1], signal: controller.signal };
      try {
        const config =
          input.operation === "create"
            ? await createMCPServers(input.servers, options)
            : input.operation === "update"
              ? await updateMCPServer(input.serverName, input.server, options)
              : input.operation === "delete"
                ? await deleteMCPServer(input.serverName, options)
                : await updateMCPServerState(
                    input.serverName,
                    input.enabled,
                    options,
                  );
        return { config, requestKey, aborted: controller.signal.aborted };
      } finally {
        controllers.delete(controller);
      }
    },
    onSuccess: async (
      { config, requestKey, aborted },
      _variables,
      isCurrent,
    ) => {
      if (aborted || !isCurrent?.()) return;
      client.setQueryData(requestKey, config);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["mcpConfig"] }),
        client.invalidateQueries({ queryKey: ["capabilities"] }),
      ]);
    },
  });
  return { query, mutation, canManage };
}
