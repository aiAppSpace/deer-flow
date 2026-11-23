/**
 * Owns only a message adapter's visible prefix and its reveal timer. The message
 * and run owners retain the full content. Append updates share one cadence;
 * replacement, completion, reduced motion and disposal retire that cadence.
 * Timing follows frontend/src/components/workspace/messages/markdown-content.tsx.
 */
import {
  computed,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

const MIN_INITIAL_DELTA = 80;
const CADENCE_MS = 50;
const MIN_CHARS_PER_COMMIT = 64;
const DURATION_MS = 300;

export function useSmoothStreamingContent(
  content: MaybeRefOrGetter<string>,
  isLoading: MaybeRefOrGetter<boolean>,
) {
  const initial = toValue(content);
  const displayContent = shallowRef(
    toValue(isLoading) && initial.length >= MIN_INITIAL_DELTA ? "" : initial,
  );
  let target = initial;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let revealStartedAt: number | null = null;

  function retire() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    revealStartedAt = null;
  }

  function scheduleTick() {
    if (timer !== null) return;
    revealStartedAt ??= performance.now();
    timer = setTimeout(tick, CADENCE_MS);
  }

  function tick() {
    timer = null;
    const latest = displayContent.value;
    if (!target.startsWith(latest) || latest.length >= target.length) {
      revealStartedAt = null;
      return;
    }
    const startedAt = (revealStartedAt ??= performance.now());
    const remainingDuration = Math.max(
      CADENCE_MS,
      DURATION_MS - (performance.now() - startedAt),
    );
    const remainingCommits = Math.max(
      1,
      Math.ceil(remainingDuration / CADENCE_MS),
    );
    const nextLength = Math.min(
      target.length,
      latest.length +
        Math.max(
          MIN_CHARS_PER_COMMIT,
          Math.ceil((target.length - latest.length) / remainingCommits),
        ),
    );
    displayContent.value = target.slice(0, nextLength);
    if (nextLength < target.length) scheduleTick();
    else revealStartedAt = null;
  }

  watch(
    () => [toValue(content), toValue(isLoading)] as const,
    ([next, loading]) => {
      target = next;
      // React effects do not run during SSR; keep the same initial prefix there.
      if (typeof window === "undefined") return;
      const current = displayContent.value;
      const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (
        next !== current &&
        next.startsWith(current) &&
        !reducedMotion &&
        loading
      ) {
        scheduleTick();
      } else {
        retire();
        displayContent.value = next;
      }
    },
    { immediate: true, flush: "sync" },
  );
  onScopeDispose(retire);

  return {
    content: computed(() => displayContent.value),
    isRevealing: computed(() => displayContent.value !== toValue(content)),
  };
}
