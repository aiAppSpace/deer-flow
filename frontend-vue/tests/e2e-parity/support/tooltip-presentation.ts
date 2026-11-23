/** Browser predicate for the tooltip belonging to one named trigger. */
export function tooltipPresentationVisible(trigger: Element): boolean {
  const name = trigger.getAttribute("aria-label")?.trim();
  const state = trigger.getAttribute("data-state");
  if (!name || (state !== "delayed-open" && state !== "instant-open"))
    return false;
  const ids = (trigger.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const descriptions = ids.map((id) =>
    trigger.ownerDocument.getElementById(id),
  );
  if (descriptions.length !== 1 || !descriptions[0]) return false;
  const description = descriptions[0];
  const popup = description.closest('[data-slot="tooltip-content"]');
  if (!popup || popup.getAttribute("data-state") !== state) return false;
  const normalize = (value: string | null) =>
    (value ?? "").replace(/\s+/g, " ").trim();
  if (normalize(description.textContent) !== normalize(name)) return false;
  // Radix/Reka duplicate the label in hidden accessible-description nodes.
  // Require the painted label too, so a correct hidden label cannot conceal
  // different visible text. The actual DOM is never changed.
  const copy = popup.cloneNode(true) as Element;
  for (const node of copy.querySelectorAll(
    '[role="tooltip"], [aria-hidden="true"]',
  ))
    node.remove();
  if (normalize(copy.textContent) !== normalize(name)) return false;
  for (const element of [trigger, popup]) {
    if (
      !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    )
      return false;
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement)
      opacity *= Number(getComputedStyle(node).opacity);
    if (opacity !== 1) return false;
    const rect = element.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.left < 0 ||
      rect.top < 0 ||
      rect.right > window.innerWidth ||
      rect.bottom > window.innerHeight
    )
      return false;
  }
  return true;
}
