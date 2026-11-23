import { useQuery, type QueryClient } from "@tanstack/vue-query";
import { computed, toValue, watch, type MaybeRefOrGetter } from "vue";

import { getAgent } from "@/core/agents/api";
import { agentKeys } from "@/core/agents/query-keys";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";

type ChatAgentOptions = {
  agentName: MaybeRefOrGetter<string | null | undefined>;
  userId: MaybeRefOrGetter<string | null>;
  demo: MaybeRefOrGetter<boolean>;
  bootstrap: MaybeRefOrGetter<boolean | undefined>;
  queryClient: QueryClient;
};

/** Consume the canonical Agent detail cache, including verified creation writes. */
export function useChatAgent(options: ChatAgentOptions) {
  const name = computed(() => toValue(options.agentName) ?? "");
  const enabled = computed(
    () =>
      Boolean(name.value) &&
      !toValue(options.demo) &&
      !toValue(options.bootstrap),
  );
  const query = useQuery(
    {
      queryKey: computed(() => agentKeys.detail(name.value)),
      enabled,
      // React's Agent detail query uses the default stale-on-focus policy. Keep
      // this local: history and the other workspace owners have their own policy.
      refetchOnWindowFocus: true,
      queryFn: async ({ queryKey, signal }) => {
        const userId = toValue(options.userId);
        const ownsAccount = captureWorkspaceQueryOwner(options.queryClient);
        const loaded = await getAgent(queryKey[2], { signal });
        // A transport may resolve after ignoring abort. It must still never
        // publish the previous account's definition into the shared cache.
        if (
          signal.aborted ||
          !ownsAccount() ||
          userId !== toValue(options.userId)
        ) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        return loaded;
      },
    },
    options.queryClient,
  );

  watch(
    [() => toValue(options.userId), name, enabled],
    ([userId, currentName, isEnabled], [previousUser, previousName]) => {
      const previousKey = agentKeys.detail(previousName);
      if (userId !== previousUser) {
        // Auth resets the workspace tree. Also retire this mounted detail
        // synchronously when its account changes before that reset completes.
        void options.queryClient.resetQueries({
          queryKey: previousKey,
          exact: true,
        });
      } else if (currentName !== previousName || !isEnabled) {
        const previous = options.queryClient
          .getQueryCache()
          .find({ queryKey: previousKey, exact: true });
        // Other mounted consumers may still need a deduplicated request.
        if (previous && previous.getObserversCount() <= 1) {
          void options.queryClient.cancelQueries({
            queryKey: previousKey,
            exact: true,
          });
        }
      }
    },
    { flush: "sync" },
  );

  return {
    agent: computed(() =>
      !toValue(options.demo) && query.data.value?.name === name.value
        ? query.data.value
        : null,
    ),
    resolved: computed(() => !enabled.value || !query.isLoading.value),
    error: query.error,
  };
}
