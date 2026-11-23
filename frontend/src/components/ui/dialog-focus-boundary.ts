"use client";

import * as React from "react";

const BOUNDARY = "data-dialog-focus-guard";

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

function candidates(container: HTMLElement) {
  const view = container.ownerDocument.defaultView;
  if (!view) return [];
  const values: HTMLElement[] = [];
  const walker = container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
  );
  while (walker.nextNode()) {
    const element = walker.currentNode as HTMLInputElement;
    if (
      element.hasAttribute(BOUNDARY) ||
      element.disabled ||
      element.hidden ||
      (element.tagName === "INPUT" && element.type === "hidden") ||
      element.tabIndex < 0 ||
      view.getComputedStyle(element).visibility === "hidden"
    )
      continue;
    let ancestor: HTMLElement | null = element;
    while (ancestor !== container && ancestor !== null) {
      if (view.getComputedStyle(ancestor).display === "none") break;
      ancestor = ancestor.parentElement;
    }
    if (ancestor === container) values.push(element);
  }
  return sequentialCandidates(values);
}

function focusEdge(container: HTMLElement, reverse: boolean) {
  const values = candidates(container);
  if (reverse) values.reverse();
  for (const candidate of values) {
    const previous = container.ownerDocument.activeElement;
    candidate.focus({ preventScroll: true });
    const active = container.ownerDocument.activeElement;
    if (
      active === candidate ||
      (active !== previous &&
        active instanceof HTMLElement &&
        container.contains(active) &&
        !active.hasAttribute(BOUNDARY))
    )
      return true;
  }
  return false;
}

export function enterDialogContent(event: React.KeyboardEvent<HTMLDivElement>) {
  if (
    event.defaultPrevented ||
    event.key !== "Tab" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const host = event.currentTarget;
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
  if (focusEdge(event.currentTarget, event.shiftKey)) event.preventDefault();
}

/**
 * Native Tab into an iframe does not bubble focusin to the parent document;
 * native radio groups also have fewer Tab stops than primitive enumeration.
 * Scope-local boundaries let the browser reach the edge before wrapping to a
 * real native stop, without intercepting caller key handlers or arrow keys.
 * Radix retains modal admission, nesting, outside interaction and focus return.
 */
function retainNativeFocusBoundary(container: HTMLElement) {
  const view = container.ownerDocument.defaultView;
  if (!view) return;
  const guards = [false, true].map((end) => {
    const element = container.ownerDocument.createElement("span");
    element.setAttribute(BOUNDARY, end ? "end" : "start");
    element.tabIndex = 0;
    Object.assign(element.style, {
      outline: "none",
      opacity: "0",
      position: "fixed",
      pointerEvents: "none",
    });
    element.addEventListener("focusin", (event) => {
      // The real target's nested focusin updates Radix's last-focused owner.
      // Do not overwrite that owner with this transparent boundary afterward.
      event.stopPropagation();
      if (!focusEdge(container, !end)) container.focus({ preventScroll: true });
    });
    return element;
  });
  const [first, last] = guards as [HTMLSpanElement, HTMLSpanElement];
  function sync() {
    if (
      container.dataset.state === "closed" ||
      !container.querySelector('iframe,input[type="radio"]')
    ) {
      for (const guard of guards) guard.remove();
      return;
    }
    if (container.firstChild !== first) container.prepend(first);
    if (container.lastChild !== last) container.append(last);
  }
  sync();
  const observer = new view.MutationObserver(sync);
  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-state"],
  });
  return () => {
    observer.disconnect();
    for (const guard of guards) guard.remove();
  };
}

export function useDialogContentRef(
  forwarded: React.Ref<HTMLDivElement> | undefined,
) {
  const [host, setHost] = React.useState<HTMLDivElement | null>(null);
  // Radix's descendant FocusScope owns mount autofocus. Install native Tab
  // boundaries in this owner's effect, after that scope has entered real
  // content (or honored caller cancellation), never in its candidate ref phase.
  React.useEffect(() => {
    if (host) return retainNativeFocusBoundary(host);
  }, [host]);
  return React.useCallback(
    (container: HTMLDivElement | null) => {
      setHost(container);
      if (!container) return;
      const forwardedCleanup =
        typeof forwarded === "function" ? forwarded(container) : undefined;
      if (forwarded && typeof forwarded !== "function")
        forwarded.current = container;
      return () => {
        setHost(null);
        if (typeof forwardedCleanup === "function") forwardedCleanup();
        else if (typeof forwarded === "function") forwarded(null);
        else if (forwarded) forwarded.current = null;
      };
    },
    [forwarded],
  );
}
