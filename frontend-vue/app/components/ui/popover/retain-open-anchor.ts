/** Reveal a detached picker's real trigger through its existing native pan. */
export function retainOpenAnchor(content: HTMLElement, reference: HTMLElement) {
  const view = content.ownerDocument.defaultView;
  if (!view) return () => {};
  const outside = (element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    const viewport = view.visualViewport;
    let top = viewport?.offsetTop ?? 0;
    let left = viewport?.offsetLeft ?? 0;
    let right = left + (viewport?.width ?? view.innerWidth);
    let bottom = top + (viewport?.height ?? view.innerHeight);
    for (
      let parent = element.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const style = view.getComputedStyle(parent);
      if (style.display === "inline" || style.display === "contents") continue;
      const bounds = parent.getBoundingClientRect();
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {
        left = Math.max(left, bounds.left + parent.clientLeft);
        right = Math.min(
          right,
          bounds.left + parent.clientLeft + parent.clientWidth,
        );
      }
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) {
        top = Math.max(top, bounds.top + parent.clientTop);
        bottom = Math.min(
          bottom,
          bounds.top + parent.clientTop + parent.clientHeight,
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
        outside(content) &&
        outside(reference)
      )
        reference.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "instant",
        });
    });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(content);
  for (
    let element: HTMLElement | null = reference;
    element;
    element = element.parentElement
  )
    observer.observe(element);
  view.addEventListener("resize", schedule);
  view.visualViewport?.addEventListener("resize", schedule);
  schedule();
  return () => {
    observer.disconnect();
    view.removeEventListener("resize", schedule);
    view.visualViewport?.removeEventListener("resize", schedule);
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
  };
}
