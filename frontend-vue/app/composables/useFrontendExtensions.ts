import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useCapabilityUser } from "@/composables/useCapabilities";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import {
  fetchFrontendExtensions,
  frontendExtensionsQueryKey,
} from "@/core/extensions/api";
import { loadFrontendExtensions } from "@/core/extensions/registry";
import { searchExtensionMentions } from "@/core/extensions/mentions";
import {
  conversationText,
  latestVisibleAnswer,
} from "@/core/extensions/services";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

export function useFrontendExtensions() {
  const user = useCapabilityUser();
  const client = useQueryClient();
  return useQuery({
    queryKey: computed(
      () => [...frontendExtensionsQueryKey, user.value?.id] as const,
    ),
    queryFn: async ({ signal, queryKey }) => {
      const isCurrent = captureWorkspaceQueryOwner(client);
      const entries = await fetchFrontendExtensions(signal);
      signal.throwIfAborted();
      if (
        !isCurrent() ||
        entries.some((entry) => entry.viewer_id !== queryKey[1])
      )
        throw new DOMException("Plugin viewer changed", "AbortError");
      const loaded = await loadFrontendExtensions(
        entries,
        undefined,
        undefined,
        signal,
      );
      signal.throwIfAborted();
      if (!isCurrent())
        throw new DOMException("Plugin viewer changed", "AbortError");
      return loaded;
    },
    enabled: computed(() => !!user.value),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

/** Each mounted host owns cancellation; global account invalidation is synchronous. */
export function useExtensionOwner(scope: MaybeRefOrGetter<unknown>) {
  const user = useCapabilityUser();
  const client = useQueryClient();
  let controller = new AbortController();
  let disposed = false;
  watch(
    [() => user.value?.id, () => toValue(scope)],
    () => {
      controller.abort();
      controller = new AbortController();
    },
    { flush: "sync" },
  );
  onScopeDispose(() => {
    disposed = true;
    controller.abort();
  });
  return {
    capture() {
      const signal = controller.signal;
      const ownsAccount = captureWorkspaceQueryOwner(client);
      const isCurrent = () => !disposed && !signal.aborted && ownsAccount();
      return {
        signal,
        isCurrent,
        assertCurrent() {
          if (!isCurrent())
            throw new DOMException("Plugin host changed", "AbortError");
        },
      };
    },
  };
}

/** Keep sidebar actions alive across menu dismissal, fenced by the conversation row. */
export function useConversationExtensionOwner(
  threadId: MaybeRefOrGetter<string>,
) {
  const user = useCapabilityUser();
  const query = useFrontendExtensions();
  const { $i18n } = useNuxtApp();
  return useExtensionOwner(
    computed(() => [
      toValue(threadId),
      user.value?.id,
      query.data.value,
      $i18n.locale.value,
    ]),
  );
}

export function useFrontendServices() {
  const toast = useWorkspaceToast();
  return {
    conversationText,
    latestVisibleAnswer,
    showMessage: (message: string) => toast.info(message),
  };
}

export function useExtensionMentions(
  threadId: MaybeRefOrGetter<string>,
  query: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const extensions = useFrontendExtensions();
  const user = useCapabilityUser();
  const client = useQueryClient();
  const { $i18n } = useNuxtApp();
  const attempt = ref(0);
  let abort: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scope = computed(() => ({
    userId: user.value?.id,
    locale: $i18n.locale.value,
    threadId: toValue(threadId),
    entries: extensions.data.value,
  }));
  const hasProviders = computed(() =>
    (scope.value.entries ?? []).some(
      (entry) =>
        entry.viewer_id === scope.value.userId &&
        entry.settings.enabled === true &&
        (entry.extension?.mentionProviders?.length ?? 0) > 0,
    ),
  );
  const state = shallowRef<{
    scope: typeof scope.value;
    result: Awaited<ReturnType<typeof searchExtensionMentions>>;
  }>();
  const result = computed(() =>
    !hasProviders.value || !toValue(enabled)
      ? { items: [], failed: false }
      : state.value?.scope === scope.value
        ? state.value.result
        : undefined,
  );
  watch(
    [scope, () => toValue(query), () => toValue(enabled), attempt],
    () => {
      abort?.abort();
      clearTimeout(timer);
      if (!toValue(enabled)) state.value = undefined;
      if (!hasProviders.value || !toValue(enabled)) return;
      const current = scope.value;
      const search = toValue(query);
      const isCurrent = captureWorkspaceQueryOwner(client);
      abort = new AbortController();
      const signal = abort.signal;
      timer = setTimeout(() => {
        void searchExtensionMentions(
          (current.entries ?? []).filter(
            (entry) => entry.viewer_id === current.userId,
          ),
          search,
          { locale: current.locale, threadId: current.threadId, signal },
        )
          .then((next) => {
            if (!signal.aborted && isCurrent())
              state.value = { scope: current, result: next };
          })
          .catch(() => undefined);
      }, 150);
    },
    { immediate: true, flush: "sync" },
  );
  onScopeDispose(() => {
    abort?.abort();
    clearTimeout(timer);
    state.value = undefined;
  });
  return {
    items: computed(() => result.value?.items ?? []),
    failed: computed(
      () => extensions.isError.value || result.value?.failed === true,
    ),
    loading: computed(
      () => extensions.isPending.value || result.value === undefined,
    ),
    retry: () => {
      void extensions.refetch();
      attempt.value++;
    },
  };
}
