"use client";

import { useEffect } from "react";

/** Keep an open portaled menu attached to a reachable native reference on reflow. */
export function useOpenMenuAnchorRetention(content: HTMLElement | null) {
  useEffect(() => {
    if (!content) return;
    const view = content.ownerDocument.defaultView;
    if (!view) return;
    let stopLayout: (() => void) | undefined;

    const watchOpenLayout = () => {
      stopLayout?.();
      stopLayout = undefined;
      if (content.dataset.state !== "open") return;
      const referenceId = content.getAttribute("aria-labelledby");
      let reference = referenceId
        ? content.ownerDocument.getElementById(referenceId)
        : null;
      // Dropdown labels its content with the trigger. Popover instead exposes
      // the trigger's aria-controls relation; use it only when unambiguous.
      if (!reference && content.id) {
        const controls = Array.from(
          content.ownerDocument.querySelectorAll<HTMLElement>(
            "[aria-controls]",
          ),
        ).filter(
          (element) => element.getAttribute("aria-controls") === content.id,
        );
        if (
          controls.length === 1 &&
          controls[0]?.getAttribute("aria-haspopup") === "dialog"
        )
          reference = controls[0];
      }
      if (!reference) return;

      const outsideVisibleArea = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return false;
        const viewport = view.visualViewport;
        let left = viewport?.offsetLeft ?? 0;
        let top = viewport?.offsetTop ?? 0;
        let right = left + (viewport?.width ?? view.innerWidth);
        let bottom = top + (viewport?.height ?? view.innerHeight);
        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = view.getComputedStyle(ancestor);
          if (style.display === "inline" || style.display === "contents")
            continue;
          const bounds = ancestor.getBoundingClientRect();
          if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {
            left = Math.max(left, bounds.left + ancestor.clientLeft);
            right = Math.min(
              right,
              bounds.left + ancestor.clientLeft + ancestor.clientWidth,
            );
          }
          if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) {
            top = Math.max(top, bounds.top + ancestor.clientTop);
            bottom = Math.min(
              bottom,
              bounds.top + ancestor.clientTop + ancestor.clientHeight,
            );
          }
        }
        return (
          box.left < left ||
          box.right > right ||
          box.top < top ||
          box.bottom > bottom
        );
      };
      let frame = 0;
      const schedule = () => {
        if (frame) return;
        frame = view.requestAnimationFrame(() => {
          frame = 0;
          if (
            content.isConnected &&
            reference.isConnected &&
            content.dataset.state === "open" &&
            outsideVisibleArea(content) &&
            outsideVisibleArea(reference)
          ) {
            // Radix retains placement and keyboard/focus ownership. Reveal its
            // actual reference through the existing native scroll owners rather
            // than replacing portal coordinates or moving keyboard focus.
            reference.scrollIntoView({
              block: "nearest",
              inline: "nearest",
              behavior: "instant",
            });
          }
        });
      };
      const resize = new ResizeObserver(schedule);
      resize.observe(content);
      for (
        let element: HTMLElement | null = reference;
        element;
        element = element.parentElement
      )
        resize.observe(element);
      view.addEventListener("resize", schedule);
      view.visualViewport?.addEventListener("resize", schedule);
      schedule();
      stopLayout = () => {
        resize.disconnect();
        view.removeEventListener("resize", schedule);
        view.visualViewport?.removeEventListener("resize", schedule);
        if (frame) view.cancelAnimationFrame(frame);
        frame = 0;
      };
    };
    const state = new MutationObserver(watchOpenLayout);
    state.observe(content, {
      attributes: true,
      attributeFilter: ["data-state", "aria-labelledby", "id"],
    });
    watchOpenLayout();
    return () => {
      state.disconnect();
      stopLayout?.();
    };
  }, [content]);
}
