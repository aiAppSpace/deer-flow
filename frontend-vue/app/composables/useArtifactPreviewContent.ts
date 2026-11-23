import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

const WRITE_PREVIEW_INTERVAL_MS = 3_000;

/** Matches the React write-file preview cadence and flushes the completed tool immediately. */
export function useArtifactPreviewContent(options: {
  content: MaybeRefOrGetter<string>;
  writing: MaybeRefOrGetter<boolean>;
  identity: MaybeRefOrGetter<string>;
}) {
  const displayed = ref(toValue(options.content));
  let selection = toValue(options.identity);
  let lastFlushAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function flush() {
    clearTimer();
    lastFlushAt = Date.now();
    displayed.value = toValue(options.content);
  }
  watch(
    () =>
      [
        toValue(options.content),
        toValue(options.writing),
        toValue(options.identity),
      ] as const,
    ([, writing, identity]) => {
      if (identity !== selection || !writing || lastFlushAt === 0) {
        selection = identity;
        flush();
        return;
      }
      const elapsed = Date.now() - lastFlushAt;
      if (elapsed >= WRITE_PREVIEW_INTERVAL_MS) flush();
      else if (timer === undefined)
        timer = setTimeout(flush, WRITE_PREVIEW_INTERVAL_MS - elapsed);
    },
    { immediate: true },
  );
  onScopeDispose(clearTimer);
  return computed(() =>
    !toValue(options.writing) || selection !== toValue(options.identity)
      ? toValue(options.content)
      : displayed.value,
  );
}
