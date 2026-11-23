/** The non-portaled reference picker must fit its actual native scrollport. */
export function mentionPopupAncestors(root: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  for (
    let element = root.parentElement;
    element;
    element = element.parentElement
  ) {
    ancestors.push(element);
  }
  return ancestors;
}

function getPopupVisibleBounds(root: HTMLElement) {
  const viewport = window.visualViewport;
  let top = viewport?.offsetTop ?? 0;
  let bottom = top + (viewport?.height ?? window.innerHeight);
  // A breakpoint can introduce clipping on an ancestor that was visible before
  // resize, so inspect the current styles rather than cache the clipping set.
  for (const ancestor of mentionPopupAncestors(root)) {
    if (
      !/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(ancestor).overflowY)
    )
      continue;
    const bounds = ancestor.getBoundingClientRect();
    const clientTop = bounds.top + ancestor.clientTop;
    top = Math.max(top, clientTop);
    bottom = Math.min(bottom, clientTop + ancestor.clientHeight);
  }
  return { top, bottom };
}

export function getCommandPopupPlacement(root: HTMLElement) {
  const { top, bottom } = getPopupVisibleBounds(root);
  const fontSize = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  const rem = Number.isFinite(fontSize) ? fontSize : 16;
  // mb-2 is half a rem. Preserve the existing 8px edge clearance.
  const available = Math.max(
    0,
    Math.floor(root.getBoundingClientRect().top - top - rem * 0.5 - 8),
  );
  const inline = available < Math.min(160, rem * 3.5);
  return {
    inline,
    maxHeight: Math.min(
      rem * 18,
      inline ? Math.max(0, bottom - top - 32) : available,
    ),
  };
}

export function getMentionPopupPlacement(
  root: HTMLElement,
  popup: HTMLElement,
) {
  const { top, bottom } = getPopupVisibleBounds(root);
  const bounds = root.getBoundingClientRect();
  const style = getComputedStyle(popup);
  const gap = Math.max(
    parseFloat(style.marginTop) || 0,
    parseFloat(style.marginBottom) || 0,
  );
  // Preserve the existing 4px edge clearance, accounting for the real rem gap.
  const above = bounds.top - top - gap - 4;
  const below = bottom - bounds.bottom - gap - 4;
  const available = Math.max(0, above, below);
  const controlHeight = Math.max(
    0,
    ...Array.from(
      popup.querySelectorAll<HTMLElement>(
        "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
      ),
      (control) => control.offsetHeight,
    ),
  );
  // When the composer fills the clip, tethering leaves no usable picker. Keep
  // the complete picker in the existing native pan instead of clipping a row.
  const inline = available < controlHeight;
  return {
    above: above >= below,
    inline,
    maxHeight: inline ? Math.max(0, bottom - top - 8) : available,
  };
}
