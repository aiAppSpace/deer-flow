import {
  computed,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import {
  getFavoritesSnapshot,
  setModelFavorite,
  subscribeFavorites,
} from "@/core/models/favorites-store";

/** One user-scoped store across main and sidecar pickers, including storage events. */
export function useModelFavorites(userId: MaybeRefOrGetter<string | null>) {
  const snapshot = shallowRef(getFavoritesSnapshot(toValue(userId)));
  let unsubscribe: (() => void) | undefined;
  watch(
    () => toValue(userId),
    (id) => {
      unsubscribe?.();
      snapshot.value = getFavoritesSnapshot(id);
      unsubscribe = subscribeFavorites(id, () => {
        snapshot.value = getFavoritesSnapshot(id);
      });
    },
    { immediate: true },
  );
  onScopeDispose(() => unsubscribe?.());
  return {
    names: computed(() => snapshot.value.names),
    persistence: computed(() => snapshot.value.persistence),
    canEdit: computed(() => toValue(userId) !== null),
    setFavorite: (name: string, favorite: boolean) =>
      setModelFavorite(toValue(userId), name, favorite),
  };
}
