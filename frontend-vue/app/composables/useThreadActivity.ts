import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  watch,
  toValue,
  type MaybeRefOrGetter,
} from "vue";

import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { useThreadActivityFeature } from "@/composables/useSchedulerFeatures";
import { AUTH_DISABLED_USER } from "@/core/auth/auth-disabled-user";
import {
  cachedThreadUnread,
  markThreadRead,
  MARK_THREAD_READ_DEBOUNCE_MS,
  resetThreadActivityState,
  THREAD_ACTIVITY_QUERY_KEY,
  threadActivityQueryOptions,
} from "@/core/threads/activity";

function useActivityAccount() {
  const session = useSettingsPermissions();
  return computed(() =>
    session.authDisabled
      ? AUTH_DISABLED_USER.id
      : session.session.value?.tag === "authenticated"
        ? session.session.value.user.id
        : null,
  );
}

/** Mounted once by the workspace sidebar. Cursor lifetime follows the account. */
export function useThreadActivity() {
  const client = useQueryClient();
  const owner = useActivityAccount();
  const feature = useThreadActivityFeature();
  const mounted = ref(false);
  onMounted(() => {
    mounted.value = true;
  });
  const reset = () => {
    resetThreadActivityState(client);
    void client.cancelQueries({ queryKey: THREAD_ACTIVITY_QUERY_KEY });
    client.removeQueries({ queryKey: THREAD_ACTIVITY_QUERY_KEY });
  };
  watch(owner, reset, { flush: "sync" });
  onScopeDispose(reset);
  return useQuery(
    computed(() =>
      threadActivityQueryOptions(client, {
        enabled:
          mounted.value && owner.value !== null && feature.available.value,
      }),
    ),
  );
}

/** Keep an open thread read after load, cache changes, stream completion and visibility. */
export function useMarkOpenThreadRead(
  threadId: MaybeRefOrGetter<string | null | undefined>,
  options: { enabled: MaybeRefOrGetter<boolean> },
) {
  const client = useQueryClient();
  const owner = useActivityAccount();
  const feature = useThreadActivityFeature();
  const version = ref(0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  const activeId = computed(() =>
    toValue(options.enabled) && owner.value && feature.available.value
      ? (toValue(threadId) ?? null)
      : null,
  );
  const unread = computed(() => {
    void version.value;
    return activeId.value
      ? cachedThreadUnread(client, activeId.value)
      : undefined;
  });
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  function markRead() {
    const id = activeId.value;
    const account = owner.value;
    if (!id || unread.value === false) return;
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      if (
        activeId.value !== id ||
        owner.value !== account ||
        cachedThreadUnread(client, id) === false
      )
        return;
      void markThreadRead(client, id);
    }, MARK_THREAD_READ_DEBOUNCE_MS);
  }
  const visible = () => {
    if (document.visibilityState === "visible") markRead();
  };
  onMounted(() => {
    unsubscribe = client.getQueryCache().subscribe(() => {
      version.value += 1;
    });
    document.addEventListener("visibilitychange", visible);
    markRead();
  });
  watch([activeId, owner], () => {
    cancel();
    markRead();
  });
  watch(unread, () => {
    if (unread.value !== false) markRead();
  });
  onScopeDispose(() => {
    cancel();
    unsubscribe?.();
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", visible);
  });
  return markRead;
}
