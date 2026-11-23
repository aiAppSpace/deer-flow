import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { AUTH_DISABLED_USER } from "@/core/auth/auth-disabled-user";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { readGatewayResponseError } from "@/core/api/errors";
import type {
  InstallationList,
  PluginManifest,
} from "@/core/capabilities/types";

export function useCapabilityUser() {
  const access = useSettingsPermissions();
  return computed(() =>
    access.session.value?.tag === "authenticated"
      ? access.session.value.user
      : access.authDisabled
        ? AUTH_DISABLED_USER
        : null,
  );
}

export async function capabilityRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/capabilities/${path}`,
    init,
  );
  if (!response.ok) {
    throw await readGatewayResponseError(
      response,
      `Capability request failed (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}
export function useCapabilityCatalog() {
  return useQuery({
    queryKey: ["capabilities", "catalog"],
    queryFn: ({ signal }) =>
      capabilityRequest<PluginManifest[]>("catalog", { signal }),
    staleTime: 60_000,
  });
}
export function useCapabilityInstallations(adapter: MaybeRefOrGetter<string>) {
  const user = useCapabilityUser();
  return useQuery({
    queryKey: computed(() => [
      "capabilities",
      "installations",
      toValue(adapter),
      user.value?.id,
    ]),
    queryFn: ({ signal, queryKey }) =>
      capabilityRequest<InstallationList>(
        `installations/${encodeURIComponent(String(queryKey[2]))}?scope=all`,
        { signal },
      ),
  });
}
export function installationQuery(adapter: string, userId?: string) {
  return {
    queryKey: ["capabilities", "installations", adapter, userId] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      capabilityRequest<InstallationList>(
        `installations/${encodeURIComponent(adapter)}?scope=all`,
        { signal },
      ),
  };
}
export function useInstallCapability() {
  const client = useQueryClient();
  return useMutation({
    onMutate: () => captureWorkspaceQueryOwner(client),
    mutationFn: (body: {
      plugin_id: string;
      name: string;
      configuration: Record<string, unknown>;
    }) =>
      capabilityRequest<InstallationList>("installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, scope: "user" }),
      }),
    onSuccess: async (_result, _variables, isCurrent) => {
      if (!isCurrent?.()) return;
      await Promise.all([
        client.invalidateQueries({ queryKey: ["capabilities"] }),
        client.invalidateQueries({ queryKey: ["mcpConfig"] }),
        client.invalidateQueries({ queryKey: ["skills"] }),
      ]);
    },
  });
}
