import { watch, type ComputedRef } from "vue";
import { injectDialogRootContext } from "reka-ui";

const SENTINEL = "data-dialog-focus-sentinel";

function sentinel(document: Document, edge: "start" | "end") {
  const element = document.createElement("span");
  element.setAttribute(SENTINEL, edge);
  element.tabIndex = 0;
  Object.assign(element.style, {
    outline: "none",
    opacity: "0",
    position: "fixed",
    pointerEvents: "none",
  });
  return element;
}

function isRadio(element: HTMLElement): element is HTMLInputElement {
  return (
    element.tagName === "INPUT" &&
    (element as HTMLInputElement).type === "radio"
  );
}

function sameRadioGroup(left: HTMLElement, right: HTMLElement) {
  return (
    isRadio(left) &&
    isRadio(right) &&
    Boolean(left.name) &&
    left.name === right.name &&
    left.form === right.form &&
    left.getRootNode() === right.getRootNode()
  );
}

/** The selected native radio is its group's sequential stop. Arrow selection
 * and unrelated or unnamed radios retain their native behavior.
 */
function sequentialCandidates(values: HTMLElement[]) {
  return values.filter(
    (element) =>
      !isRadio(element) ||
      element.checked ||
      !values.some(
        (other) =>
          sameRadioGroup(element, other) && isRadio(other) && other.checked,
      ),
  );
}

function tabbableCandidates(host: HTMLElement) {
  const view = host.ownerDocument.defaultView;
  const result: HTMLElement[] = [];
  if (!view) return result;
  const walker = host.ownerDocument.createTreeWalker(
    host,
    NodeFilter.SHOW_ELEMENT,
  );
  while (walker.nextNode()) {
    const element = walker.currentNode as HTMLInputElement;
    if (
      element.hasAttribute(SENTINEL) ||
      element.disabled ||
      element.hidden ||
      (element.tagName === "INPUT" && element.type === "hidden") ||
      element.tabIndex < 0 ||
      view.getComputedStyle(element).visibility === "hidden"
    )
      continue;
    let ancestor: HTMLElement | null = element;
    while (ancestor !== host && ancestor !== null) {
      if (ancestor.hidden || view.getComputedStyle(ancestor).display === "none")
        break;
      ancestor = ancestor.parentElement;
    }
    if (ancestor === host) result.push(element);
  }
  return result;
}

/** Native radio grouping belongs to sequential navigation, not initial entry. */
function candidates(host: HTMLElement) {
  return sequentialCandidates(tabbableCandidates(host));
}

/** Match the dialog entry policy: actions and inputs precede informational links.
 * Links remain ordinary Tab stops. Callers can cancel and supply their own target.
 */
export function focusInitialDialogContent(event: Event) {
  if (event.defaultPrevented) return;
  const host = event.target as HTMLElement | null;
  const view = host?.ownerDocument?.defaultView;
  if (!view || !(host instanceof view.HTMLElement)) return;
  event.preventDefault();
  const previous = host.ownerDocument.activeElement;
  for (const candidate of tabbableCandidates(host)) {
    if (candidate.tagName === "A") continue;
    candidate.focus({ preventScroll: true });
    if (host.ownerDocument.activeElement === candidate) {
      if (candidate !== previous && candidate instanceof view.HTMLInputElement)
        candidate.select();
      return;
    }
    if (host.ownerDocument.activeElement !== previous) return;
  }
  host.focus({ preventScroll: true });
}

/**
 * Frame focus does not bubble to the parent document; native radio groups
 * also expose fewer Tab stops than primitive enumeration. Scope-local sentinels
 * receive native Tab at the boundary and wrap to the selected group stop.
 * Caller key handlers and arrow navigation stay native. Ordinary content keeps
 * the installed FocusScope unchanged. Imperative children preserve asChild.
 */
export function useDialogFocusBoundary(
  contentElement: ComputedRef<HTMLElement | undefined>,
) {
  const context = injectDialogRootContext();
  watch(
    [context.open, contentElement],
    ([open, host], _previous, cleanup) => {
      if (!open || !host?.isConnected) return;
      const view = host.ownerDocument.defaultView;
      if (!view) return;
      const start = sentinel(host.ownerDocument, "start");
      const end = sentinel(host.ownerDocument, "end");
      const wrap = (event: FocusEvent, reverse: boolean) => {
        if (
          event.defaultPrevented ||
          !host.isConnected ||
          host.dataset.state === "closed"
        )
          return;
        // Only real controls reach the installed scope's last-focused record.
        event.stopPropagation();
        const controls = candidates(host);
        if (reverse) controls.reverse();
        for (const control of controls) {
          const before = host.ownerDocument.activeElement;
          control.focus({ preventScroll: true });
          const active = host.ownerDocument.activeElement;
          if (
            active === control ||
            (active !== before &&
              active &&
              host.contains(active) &&
              !active.hasAttribute(SENTINEL))
          )
            return;
        }
        host.focus({ preventScroll: true });
      };
      start.addEventListener("focusin", (event) => wrap(event, true));
      end.addEventListener("focusin", (event) => wrap(event, false));
      const maintain = () => {
        if (host.querySelector('iframe,input[type="radio"]')) {
          if (host.firstChild !== start) host.prepend(start);
          if (host.lastChild !== end) host.append(end);
        } else {
          start.remove();
          end.remove();
        }
      };
      const observer = new view.MutationObserver(maintain);
      observer.observe(host, { childList: true, subtree: true });
      maintain();
      cleanup(() => {
        observer.disconnect();
        start.remove();
        end.remove();
      });
    },
    { immediate: true, flush: "post" },
  );
}

/** Enter the host, or wrap from a programmatic focus target at its real edge. */
export function enterDialogContent(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.key !== "Tab" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const host = event.currentTarget as HTMLElement;
  const controls = candidates(host);
  const target = event.target;
  const view = host.ownerDocument.defaultView;
  if (target !== host) {
    if (
      !view ||
      !(target instanceof view.HTMLElement) ||
      target.tabIndex >= 0 ||
      target.isContentEditable ||
      host.ownerDocument.activeElement !== target ||
      target.closest(
        '[data-slot="dialog-content"],[data-slot="sheet-content"]',
      ) !== host
    )
      return;
    // A programmatic heading/container is not a sequential tab stop. Only
    // wrap when native navigation from it would leave this scope's edge.
    const edge = event.shiftKey ? controls[0] : controls.at(-1);
    const toward = event.shiftKey
      ? view.Node.DOCUMENT_POSITION_FOLLOWING
      : view.Node.DOCUMENT_POSITION_PRECEDING;
    if (!edge || !(target.compareDocumentPosition(edge) & toward)) return;
  }
  if (event.shiftKey) controls.reverse();
  for (const candidate of controls) {
    const before = host.ownerDocument.activeElement;
    candidate.focus({ preventScroll: true });
    const active = host.ownerDocument.activeElement;
    if (
      active === candidate ||
      (active !== before &&
        active &&
        host.contains(active) &&
        !active.hasAttribute(SENTINEL))
    ) {
      event.preventDefault();
      return;
    }
  }
}
