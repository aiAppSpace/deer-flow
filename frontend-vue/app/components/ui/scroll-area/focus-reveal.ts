import {
  inject,
  onBeforeUnmount,
  provide,
  watch,
  type InjectionKey,
  type Ref,
} from "vue";

interface FocusReveal {
  reveal: (event: FocusEvent, portalAnchor?: HTMLElement | null) => void;
  retire: () => void;
}

const focusRevealKey: InjectionKey<FocusReveal> = Symbol("focus-reveal");

/** Physical viewport ownership also covers portals whose trigger lives inside it. */
export function provideFocusReveal(viewport: Ref<HTMLElement | null>) {
  let revision = 0;
  let frame: number | undefined;
  let frameWindow: Window | null = null;
  function retire() {
    revision += 1;
    if (frame !== undefined) frameWindow?.cancelAnimationFrame(frame);
    frame = undefined;
    frameWindow = null;
  }
  function reveal(event: FocusEvent, portalAnchor?: HTMLElement | null) {
    const host = viewport.value;
    const view = host?.ownerDocument.defaultView;
    const target = event.target;
    if (
      !host ||
      !view ||
      !(target instanceof view.HTMLElement) ||
      !host.contains(portalAnchor ?? target)
    )
      return;
    retire();
    if (event.defaultPrevented) return;
    const ownerRevision = revision;
    frameWindow = view;
    frame = view.requestAnimationFrame(() => {
      if (
        ownerRevision !== revision ||
        viewport.value !== host ||
        !host.isConnected ||
        !target.isConnected ||
        !host.contains(portalAnchor ?? target) ||
        target.ownerDocument.activeElement !== target
      )
        return;
      frame = undefined;
      frameWindow = null;
      target.scrollIntoView({
        block:
          view.getComputedStyle(host).overflowY === "auto"
            ? "center"
            : "nearest",
      });
    });
  }
  watch(viewport, retire, { flush: "sync" });
  onBeforeUnmount(retire);
  provide(focusRevealKey, { reveal, retire });
  return { reveal, retire };
}

/** A Teleport keeps injection ancestry, while native focus events follow its DOM. */
export function usePortalFocusReveal() {
  return inject(focusRevealKey, undefined);
}
