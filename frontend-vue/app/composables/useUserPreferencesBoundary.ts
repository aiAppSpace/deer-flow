import {
  onBeforeMount,
  onMounted,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import { startUserPreferences } from "@/core/settings/user-preferences";

/** Start before child consumers mount; gate later account switches until shared reads reset. */
export function useUserPreferencesBoundary(
  owner: MaybeRefOrGetter<string | undefined>,
  resetSharedQueries: () => Promise<void> = async () => undefined,
) {
  const ready = ref(true);
  let initialized = false;
  let identity: string | undefined;
  let generation = 0;
  let mounted = false;
  let stop: ReturnType<typeof startUserPreferences> | undefined;
  let unwatch: (() => void) | undefined;

  onBeforeMount(() => {
    unwatch = watch(
      () => toValue(owner),
      (next) => {
        if (initialized && identity === next) return;
        const switching = initialized;
        initialized = true;
        identity = next;
        const current = ++generation;
        stop?.();
        stop = next
          ? startUserPreferences(next, { deferInitialApply: !mounted })
          : undefined;
        if (!switching) return;
        ready.value = false;
        void resetSharedQueries()
          .then(() => {
            if (generation === current) ready.value = true;
          })
          .catch((error: unknown) =>
            console.warn("Could not reset account workspace queries", error),
          );
      },
      { immediate: true, flush: "sync" },
    );
  });
  onMounted(() => {
    mounted = true;
    stop?.activate();
  });
  onScopeDispose(() => {
    generation++;
    unwatch?.();
    stop?.();
  });
  return { ready };
}
