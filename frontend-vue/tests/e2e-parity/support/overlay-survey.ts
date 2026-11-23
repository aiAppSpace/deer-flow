/** Serialized browser survey; keep all geometry dependencies inside this function. */
export function surveyOverlayGeometry(maxGapPx: number) {
  const visible = (el: Element) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const overlays = Array.from(
    document.querySelectorAll(
      '[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"]',
    ),
  ).filter(visible);
  return {
    innerWidth,
    count: overlays.length,
    bad: overlays.flatMap((el) => {
      const id = el.getAttribute("id");
      const controllers = id
        ? Array.from(document.querySelectorAll(`[aria-controls="${id}"]`))
        : [];
      const trigger = controllers[0] ?? null;
      let floating = el;
      let anchor = trigger;
      // ARIA identifies the controlled options, not the positioning rectangle.
      // Only this exact non-portaled MentionPicker structure is anchored to its
      // composer: the header/footer are siblings of the internal listbox.
      const panel = el.parentElement;
      const popup = panel?.parentElement;
      const composer = popup?.offsetParent;
      if (
        el.getAttribute("role") === "listbox" &&
        el.getAttribute("aria-multiselectable") === "true" &&
        panel?.matches('[data-testid="mention-picker"]') &&
        panel.querySelectorAll('[role="listbox"]').length === 1 &&
        popup instanceof HTMLElement &&
        popup.children.length === 1 &&
        popup.firstElementChild === panel &&
        getComputedStyle(popup).position === "absolute" &&
        composer instanceof HTMLElement &&
        popup.parentElement === composer &&
        controllers.some(
          (controller) =>
            composer.contains(controller) &&
            !popup.contains(controller) &&
            controller.matches(
              'textarea,[role="textbox"][contenteditable="true"]',
            ),
        )
      ) {
        floating = popup;
        anchor = composer;
      }
      const r = floating.getBoundingClientRect();
      const outside = Math.round(
        Math.max(0, -r.x, -r.y, r.right - innerWidth, r.bottom - innerHeight),
      );
      const label =
        `${el.getAttribute("role")} ` +
        `${el.tagName.toLowerCase()}.${(el.className?.toString?.() ?? "").split(/\s+/).slice(0, 2).join(".").slice(0, 28)}` +
        `"${(el as HTMLElement).innerText?.trim().replace(/\s+/g, " ").slice(0, 20) ?? ""}"`;
      const problems: string[] = [];
      if (outside > 1) problems.push(`跑出视口 ${outside}px`);
      if (trigger) {
        if (!visible(trigger)) problems.push("触发器不可见了");
        else {
          const t = anchor!.getBoundingClientRect();
          const gap = Math.round(
            Math.max(0, Math.max(t.left - r.right, r.left - t.right)) +
              Math.max(0, Math.max(t.top - r.bottom, r.top - t.bottom)),
          );
          if (gap > maxGapPx) problems.push(`离触发器 ${gap}px`);
        }
      }
      return problems.length ? [`${label} —— ${problems.join(" / ")}`] : [];
    }),
  };
}
