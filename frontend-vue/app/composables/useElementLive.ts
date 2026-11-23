import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
/** Poll a live card only while both its element and its document are visible. */
export function useElementLive(element: Ref<HTMLElement | null>) {
  const intersects = ref(false),
    visible = ref(
      typeof document !== "undefined" && document.visibilityState !== "hidden",
    );
  let observer: IntersectionObserver | undefined;
  const visibility = () => {
    visible.value = document.visibilityState !== "hidden";
  };
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", visibility);
  watch(
    element,
    (el) => {
      observer?.disconnect();
      intersects.value = false;
      if (!el) return;
      if (typeof IntersectionObserver === "undefined") {
        intersects.value = true;
        return;
      }
      observer = new IntersectionObserver(([entry]) => {
        intersects.value = entry?.isIntersecting ?? false;
      });
      observer.observe(el);
    },
    { flush: "post" },
  );
  onScopeDispose(() => {
    observer?.disconnect();
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", visibility);
  });
  return computed(() => intersects.value && visible.value);
}
