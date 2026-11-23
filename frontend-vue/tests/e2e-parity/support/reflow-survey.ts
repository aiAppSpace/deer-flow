/*
  Shared reachability survey for multi-axis reflow gates. Keep every value
  needed by the positive controls inside this function: Playwright serializes
  it into the page, so module-scope helpers would disappear at runtime.
*/

type HorizontalSurvey = {
  width: number;
  height: number;
  rootPx: number;
  documentOverflowX: number;
  nonDeliberateHorizontalScrollers: string[];
};
type FullSurvey = HorizontalSurvey & {
  initialOutside: number;
  routesSeen: number;
  routesMoved: number;
  recovered: number;
  oversizedRecovered: number;
  lostControls: string[];
  clippingBoxes: number;
  clippedAwaySkips: number;
  nativeTextInputSkips: number;
  unreachableClips: string[];
};

export function surveyReflow(mode: "horizontal"): HorizontalSurvey;
export function surveyReflow(clipThreshold?: number): FullSurvey;
export function surveyReflow(mode: number | "horizontal" = 24) {
  const clipThreshold = typeof mode === "number" ? mode : 24;
  const INTERACTIVE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[contenteditable=true]",
    '[role="button"]:not([aria-disabled=true])',
    '[role="checkbox"]:not([aria-disabled=true])',
    '[role="combobox"]:not([aria-disabled=true])',
    '[role="link"]:not([aria-disabled=true])',
    '[role="menuitem"]:not([aria-disabled=true])',
    '[role="option"]:not([aria-disabled=true])',
    '[role="radio"]:not([aria-disabled=true])',
    '[role="switch"]:not([aria-disabled=true])',
    '[role="tab"]:not([aria-disabled=true])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  const clippedAway = (style: CSSStyleDeclaration) => {
    const rect = /^rect\((.+)\)$/.exec(style.clip ?? "");
    if (rect) {
      const [top, right, bottom, left] = rect[1]!
        .split(/,\s*|\s+/)
        .map((part) => Number.parseFloat(part));
      if (
        [top, right, bottom, left].every((value) => Number.isFinite(value)) &&
        (bottom! - top! <= 0 || right! - left! <= 0)
      )
        return true;
    }
    return /^inset\(50%\s*\)?$/.test(style.clipPath ?? "");
  };

  const rendered = (element: Element) => {
    if (element.closest('[aria-hidden="true"],[inert]')) return false;
    // Closed details/content-visibility can retain a nonzero cached layout
    // box while their descendants are not painted or admitted by native Tab.
    // The default check still includes genuinely painted offscreen controls.
    if (!element.checkVisibility()) return false;
    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      clippedAway(style)
    )
      return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  };

  const describe = (element: Element) => {
    const html = element as HTMLElement;
    const slot = element.getAttribute("data-slot");
    const role = element.getAttribute("role");
    const name =
      element.getAttribute("aria-label") ??
      element.getAttribute("title") ??
      html.innerText?.trim().replace(/\s+/g, " ").slice(0, 28) ??
      "";
    const classes = (element.className?.toString?.() ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(".")
      .slice(0, 50);
    return (
      `${element.tagName.toLowerCase()}` +
      `${slot ? `[${slot}]` : ""}` +
      `${role ? `[role=${role}]` : ""}` +
      `${classes ? `.${classes}` : ""}` +
      `"${name}"`
    );
  };

  const rectLabel = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return (
      `[${Math.round(rect.left)},${Math.round(rect.top)},` +
      `${Math.round(rect.right)},${Math.round(rect.bottom)}]`
    );
  };

  const scrollable = (element: Element, axis: "x" | "y") => {
    const style = getComputedStyle(element);
    const overflow = axis === "x" ? style.overflowX : style.overflowY;
    if (!["auto", "scroll", "overlay"].includes(overflow)) return false;
    return axis === "x"
      ? element.scrollWidth > element.clientWidth + 1
      : element.scrollHeight > element.clientHeight + 1;
  };

  const scrollingElement = document.scrollingElement as HTMLElement | null;
  const viewportRect = () => ({
    left: 0,
    right: innerWidth,
    top: 0,
    bottom: innerHeight,
  });
  const layoutScale = (element: Element, axis: "x" | "y") => {
    // offset/client sizes are integer layout pixels, while DOMRect retains
    // fractional layout pixels. Their ratio is not evidence of a transform:
    // that phantom scale loses real pixels across a long native scroll.
    // Instead compose the actual CSS scale/transform/zoom ancestry. Translation
    // and transform-origin affect position, but not the scroll delta scale.
    let matrix = new DOMMatrixReadOnly();
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const scaleParts = style.scale === "none" ? [] : style.scale.split(/\s+/);
      const number = (value: string | undefined, fallback: number) => {
        if (value === undefined) return fallback;
        const parsed = Number.parseFloat(value);
        return value.endsWith("%") ? parsed / 100 : parsed;
      };
      const scaleX = number(scaleParts[0], 1);
      const scaleY = number(scaleParts[1], scaleX);
      const zoom = number(style.zoom, 1);
      const transform =
        style.transform === "none"
          ? new DOMMatrixReadOnly()
          : new DOMMatrixReadOnly(style.transform);
      matrix = new DOMMatrixReadOnly()
        .scale(scaleX * zoom, scaleY * zoom)
        .multiply(transform)
        .multiply(matrix);
    }
    const scale =
      axis === "x"
        ? Math.hypot(matrix.a, matrix.b)
        : Math.hypot(matrix.c, matrix.d);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  };
  const clientRect = (element: Element) => {
    const raw = element.getBoundingClientRect();
    const scaleX = layoutScale(element, "x");
    const scaleY = layoutScale(element, "y");
    const left = raw.left + element.clientLeft * scaleX;
    const top = raw.top + element.clientTop * scaleY;
    return {
      left,
      right: left + element.clientWidth * scaleX,
      top,
      bottom: top + element.clientHeight * scaleY,
    };
  };
  const containingBlock = (element: Element) => {
    const position = getComputedStyle(element).position;
    return position === "absolute" || position === "fixed"
      ? (element as HTMLElement).offsetParent
      : undefined;
  };
  // Out-of-flow boxes escape overflow between themselves and their actual
  // containing block. A viewport-fixed box (offsetParent=null) escapes all of
  // those ancestors, while a transformed fixed containing block still clips.
  const clippingAncestors = (element: Element) => {
    const ancestors: Array<{ element: Element; x: boolean; y: boolean }> = [];
    let containing = containingBlock(element);
    for (
      let ancestor = element.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      if (containing !== undefined && ancestor !== containing) continue;
      const style = getComputedStyle(ancestor);
      const clips = (overflow: string) =>
        ["hidden", "clip", "auto", "scroll", "overlay"].includes(overflow);
      // Ordinary inline boxes do not apply overflow clipping; contents has no
      // principal box at all. Inline-block/flex/grid still form real boxes.
      if (style.display !== "inline" && style.display !== "contents") {
        const x = clips(style.overflowX);
        const y = clips(style.overflowY);
        if (x || y) ancestors.push({ element: ancestor, x, y });
      }
      containing = containingBlock(ancestor);
    }
    return ancestors;
  };
  // A control can be inside the window but clipped by a much smaller native
  // scrollport. Every effective clipping ancestor constrains its reveal area.
  const revealRect = (element: Element) => {
    const visible = viewportRect();
    for (const ancestor of clippingAncestors(element)) {
      const box = clientRect(ancestor.element);
      if (ancestor.x) {
        visible.left = Math.max(visible.left, box.left);
        visible.right = Math.min(visible.right, box.right);
      }
      if (ancestor.y) {
        visible.top = Math.max(visible.top, box.top);
        visible.bottom = Math.min(visible.bottom, box.bottom);
      }
    }
    return visible;
  };
  const visibleRouteRect = (element: HTMLElement) => {
    if (element === scrollingElement) return viewportRect();
    const raw = clientRect(element);
    const visible = revealRect(element);
    return {
      left: Math.max(visible.left, raw.left),
      right: Math.min(visible.right, raw.right),
      top: Math.max(visible.top, raw.top),
      bottom: Math.min(visible.bottom, raw.bottom),
    };
  };
  const documentOverflowX = Math.max(
    0,
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const documentOverflowY = Math.max(
    0,
    document.documentElement.scrollHeight -
      document.documentElement.clientHeight,
  );

  // Streamdown puts its native code pan on the body DIV around PRE/CODE.
  // Recognize that exact bounded owner, never an arbitrary ancestor of PRE.
  const codeScrollOwner = (element: Element) => {
    if (
      element.tagName !== "DIV" ||
      element.getAttribute("data-streamdown") !== "code-block-body" ||
      element.children.length !== 1 ||
      element.querySelector(INTERACTIVE)
    )
      return false;
    const pre = element.firstElementChild;
    const code = pre?.firstElementChild;
    if (
      pre?.tagName !== "PRE" ||
      pre.children.length !== 1 ||
      code?.tagName !== "CODE" ||
      pre.scrollWidth <= pre.clientWidth + 1 ||
      Array.from(code.querySelectorAll("*")).some(
        (token) => token.tagName !== "SPAN",
      )
    )
      return false;
    for (const [parent, onlyChild] of [
      [element, pre],
      [pre, code],
    ] as const)
      if (
        Array.from(parent.childNodes).some(
          (node) => node !== onlyChild && node.textContent?.trim(),
        )
      )
        return false;
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement?.getBoundingClientRect();
    return (
      !!parent &&
      rect.left >= Math.max(0, parent.left) - 0.5 &&
      rect.right <= Math.min(innerWidth, parent.right) + 0.5
    );
  };

  const nonDeliberateHorizontalScrollers = Array.from(
    document.querySelectorAll("*"),
  )
    .filter((element) => {
      if (!rendered(element) || !scrollable(element, "x")) return false;
      if (element.tagName === "PRE" || element.querySelector("table"))
        return false;
      if (codeScrollOwner(element)) return false;
      return true;
    })
    .map(describe);

  const horizontal = {
    width: innerWidth,
    height: innerHeight,
    rootPx: Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    ),
    documentOverflowX,
    nonDeliberateHorizontalScrollers,
  };
  // The width-only gate shares the exact predicate without claiming that a
  // native control/clip traversal took place. Full is the unchanged default.
  if (mode === "horizontal") return horizontal;

  const fullyInViewport = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const visible = revealRect(element);
    return (
      rect.left >= visible.left - 0.5 &&
      rect.right <= visible.right + 0.5 &&
      rect.top >= visible.top - 0.5 &&
      rect.bottom <= visible.bottom + 0.5
    );
  };

  let initialOutside = 0;
  let routesSeen = 0;
  let routesMoved = 0;
  let recovered = 0;
  let oversizedRecovered = 0;
  const lostControls: string[] = [];

  for (const control of Array.from(document.querySelectorAll(INTERACTIVE))) {
    if (!rendered(control) || fullyInViewport(control)) continue;
    const rect = control.getBoundingClientRect();
    /*
      横向完全离屏的是关闭抽屉/sidecar 的账；纵向完全落到下方的控件仍必须量，
      否则文字换行把整颗按钮推到折叠线下会静默漏掉。
    */
    if (rect.right <= 0 || rect.left >= innerWidth) continue;
    initialOutside += 1;

    const routes: Array<{ element: HTMLElement; x: boolean; y: boolean }> = [];
    let ancestor = control.parentElement;
    while (ancestor && ancestor !== document.body) {
      const x = scrollable(ancestor, "x");
      const y = scrollable(ancestor, "y");
      if (x || y) routes.push({ element: ancestor as HTMLElement, x, y });
      ancestor = ancestor.parentElement;
    }
    if (scrollingElement) {
      const x = scrollingElement.scrollWidth > scrollingElement.clientWidth + 1;
      const y =
        scrollingElement.scrollHeight > scrollingElement.clientHeight + 1;
      if (x || y) routes.push({ element: scrollingElement, x, y });
    }
    routesSeen += routes.length;

    const before = routes.map(({ element }) => ({
      left: element.scrollLeft,
      top: element.scrollTop,
    }));
    // Native reveal may also scroll overflow:hidden ancestors (for example a
    // translated animation child). Save every ancestor, including the document
    // owner, so neither that fallback nor its edge probes leak scroll state.
    const nativeBefore: Array<{
      element: HTMLElement;
      left: number;
      top: number;
    }> = [];
    for (
      let element = control.parentElement;
      element;
      element = element.parentElement
    )
      nativeBefore.push({
        element,
        left: element.scrollLeft,
        top: element.scrollTop,
      });
    if (
      scrollingElement &&
      !nativeBefore.some(({ element }) => element === scrollingElement)
    )
      nativeBefore.push({
        element: scrollingElement,
        left: scrollingElement.scrollLeft,
        top: scrollingElement.scrollTop,
      });
    let moved = false;
    const noteMovement = () => {
      moved ||= nativeBefore.some(
        ({ element, left, top }) =>
          Math.abs(element.scrollLeft - left) > 0.5 ||
          Math.abs(element.scrollTop - top) > 0.5,
      );
    };
    const revealViaRoutes = () => {
      for (const route of routes) {
        const controlRect = control.getBoundingClientRect();
        const routeRect = visibleRouteRect(route.element);
        if (route.x) {
          if (controlRect.right > routeRect.right)
            route.element.scrollLeft +=
              (controlRect.right - routeRect.right) /
              layoutScale(route.element, "x");
          else if (controlRect.left < routeRect.left)
            route.element.scrollLeft +=
              (controlRect.left - routeRect.left) /
              layoutScale(route.element, "x");
        }
        if (route.y) {
          if (controlRect.bottom > routeRect.bottom)
            route.element.scrollTop +=
              (controlRect.bottom - routeRect.bottom) /
              layoutScale(route.element, "y");
          else if (controlRect.top < routeRect.top)
            route.element.scrollTop +=
              (controlRect.top - routeRect.top) /
              layoutScale(route.element, "y");
        }
      }
    };
    revealViaRoutes();
    noteMovement();
    const restoreRoutes = () => {
      nativeBefore.forEach(({ element, left, top }) => {
        element.scrollTo({ left, top, behavior: "instant" });
      });
    };
    const revealNative = (
      options: ScrollIntoViewOptions[],
      accepts: () => boolean,
    ) => {
      const attempt = () => {
        for (const option of options) {
          control.scrollIntoView({ ...option, behavior: "instant" });
          noteMovement();
          if (accepts()) return true;
        }
        return false;
      };
      if (attempt()) return true;
      // A sticky child can remain pinned throughout a native nearest/start/end
      // delta. Traverse the existing native owner's end (as wheel/End can),
      // then ask the browser to reveal the same node. Only the actual clipping
      // intersection below decides success; this does not excuse a large box.
      for (const { element, x, y } of routes) {
        element.scrollTo({
          left: x ? element.scrollWidth : element.scrollLeft,
          top: y ? element.scrollHeight : element.scrollTop,
          behavior: "instant",
        });
        noteMovement();
        if (attempt()) return true;
      }
      return false;
    };
    const edgeReachable = (axis: "x" | "y", edge: "leading" | "trailing") => {
      restoreRoutes();
      // Retain the complete other-axis reveal before panning an oversized
      // edge. Restoring the original Y while testing X would discard a real,
      // reachable two-axis state (notably a multi-line inline link).
      revealViaRoutes();
      for (const route of routes) {
        if (!route[axis]) continue;
        const controlRect = control.getBoundingClientRect();
        const routeRect = visibleRouteRect(route.element);
        if (axis === "x") {
          const delta =
            edge === "leading"
              ? controlRect.left - routeRect.left
              : controlRect.right - routeRect.right;
          route.element.scrollLeft += delta / layoutScale(route.element, "x");
        } else {
          const delta =
            edge === "leading"
              ? controlRect.top - routeRect.top
              : controlRect.bottom - routeRect.bottom;
          route.element.scrollTop += delta / layoutScale(route.element, "y");
        }
      }
      const reachesEdge = () => {
        const result = control.getBoundingClientRect();
        const edgePosition =
          axis === "x"
            ? edge === "leading"
              ? result.left
              : result.right
            : edge === "leading"
              ? result.top
              : result.bottom;
        const visible = revealRect(control);
        const leading = axis === "x" ? visible.left : visible.top;
        const trailing = axis === "x" ? visible.right : visible.bottom;
        const fitsOtherAxes =
          (oversizedX ||
            (result.left >= visible.left - 0.5 &&
              result.right <= visible.right + 0.5)) &&
          (oversizedY ||
            (result.top >= visible.top - 0.5 &&
              result.bottom <= visible.bottom + 0.5));
        return (
          fitsOtherAxes &&
          edgePosition >= leading - 0.5 &&
          edgePosition <= trailing + 0.5
        );
      };
      noteMovement();
      if (reachesEdge()) return true;
      // Sticky constraints and programmatically scrollable hidden ancestors
      // are handled by the browser's native algorithm, not an inferred delta.
      const position = edge === "leading" ? "start" : "end";
      return revealNative(
        axis === "x"
          ? [
              { block: "start", inline: position },
              { block: "end", inline: position },
            ]
          : [
              { block: position, inline: "start" },
              { block: position, inline: "end" },
            ],
        reachesEdge,
      );
    };
    const afterMove = control.getBoundingClientRect();
    const oversizedX = afterMove.width > innerWidth + 1;
    const oversizedY = afterMove.height > innerHeight + 1;
    const oversizedReachable =
      (oversizedX || oversizedY) &&
      (!oversizedX ||
        (edgeReachable("x", "leading") && edgeReachable("x", "trailing"))) &&
      (!oversizedY ||
        (edgeReachable("y", "leading") && edgeReachable("y", "trailing")));
    restoreRoutes();
    revealViaRoutes();
    noteMovement();
    if (!fullyInViewport(control))
      revealNative(
        [
          { block: "start", inline: "nearest" },
          { block: "end", inline: "nearest" },
        ],
        () => fullyInViewport(control),
      );
    if (moved) routesMoved += 1;
    if (moved && (fullyInViewport(control) || oversizedReachable)) {
      recovered += 1;
      if (oversizedReachable) oversizedRecovered += 1;
    } else {
      const after = control.getBoundingClientRect();
      const routeDetails = routes.map(({ element, x, y }, index) => {
        const style = getComputedStyle(element);
        return (
          `${describe(element)} rect=${rectLabel(element)} axes=${x ? "x" : ""}${y ? "y" : ""}` +
          ` scroll=${Math.round(before[index]!.left)},${Math.round(before[index]!.top)}` +
          `→${Math.round(element.scrollLeft)},${Math.round(element.scrollTop)}` +
          ` size=${element.scrollWidth}/${element.clientWidth}x${element.scrollHeight}/${element.clientHeight}` +
          ` overflow=${style.overflowX}/${style.overflowY}`
        );
      });
      const chain: string[] = [];
      let node = control.parentElement;
      while (node && node !== document.body && chain.length < 10) {
        const style = getComputedStyle(node);
        chain.push(
          `${describe(node)} rect=${rectLabel(node)}` +
            ` size=${node.scrollWidth}/${node.clientWidth}x${node.scrollHeight}/${node.clientHeight}` +
            ` overflow=${style.overflowX}/${style.overflowY} pos=${style.position}`,
        );
        node = node.parentElement;
      }
      lostControls.push(
        `${describe(control)} rect=[${Math.round(after.left)},${Math.round(after.top)},` +
          `${Math.round(after.right)},${Math.round(after.bottom)}] size=` +
          `${Math.round(after.width)}x${Math.round(after.height)} routes=${routes.length} moved=${moved}` +
          ` :: routes ${routeDetails.join(" <- ")} :: chain ${chain.join(" <- ")}`,
      );
    }
    restoreRoutes();
  }

  let clippingBoxes = 0;
  let clippedAwaySkips = 0;
  let nativeTextInputSkips = 0;
  const unreachableClips: string[] = [];
  for (const element of Array.from(document.querySelectorAll("body *"))) {
    const style = getComputedStyle(element);
    const hidesX = style.overflowX === "hidden" || style.overflowX === "clip";
    const hidesY = style.overflowY === "hidden" || style.overflowY === "clip";
    if (!hidesX && !hidesY) continue;
    if (element.clientWidth <= 1 || element.clientHeight <= 1) continue;
    if (clippedAway(style)) {
      clippedAwaySkips += 1;
      continue;
    }
    if (style.textOverflow === "ellipsis") continue;
    if (style.webkitLineClamp && style.webkitLineClamp !== "none") continue;
    clippingBoxes += 1;

    const dx = hidesX ? element.scrollWidth - element.clientWidth : 0;
    const dy = hidesY ? element.scrollHeight - element.clientHeight : 0;
    if (dx < clipThreshold && dy < clipThreshold) continue;
    /*
      A single-line native text input is itself a horizontally navigable value
      viewport: caret movement, selection and Home/End reveal the full value.
      Its internal anonymous content is not lost merely because Blink reports
      overflow-x: clip. If the input box is clipped by an ancestor, that
      ancestor is still inspected separately.
    */
    if (
      element instanceof HTMLInputElement &&
      [
        "text",
        "search",
        "email",
        "url",
        "tel",
        "password",
        "number",
        "date",
        "time",
        "month",
        "week",
        "datetime-local",
      ].includes(element.type)
    ) {
      nativeTextInputSkips += 1;
      continue;
    }

    const ancestors: Element[] = [];
    let ancestor = element.parentElement;
    while (ancestor && ancestor !== document.body) {
      ancestors.push(ancestor);
      ancestor = ancestor.parentElement;
    }
    const descendants = Array.from(element.querySelectorAll("*"));
    const reachesX =
      dx < clipThreshold ||
      documentOverflowX > 1 ||
      ancestors.some((node) => scrollable(node, "x")) ||
      descendants.some((node) => scrollable(node, "x"));
    const reachesY =
      dy < clipThreshold ||
      documentOverflowY > 1 ||
      ancestors.some((node) => scrollable(node, "y")) ||
      descendants.some((node) => scrollable(node, "y"));
    if (!reachesX || !reachesY)
      unreachableClips.push(
        `${describe(element)} clipped=${Math.max(0, dx)}x/${Math.max(0, dy)}y ` +
          `reachable=${reachesX ? "x" : "-"}${reachesY ? "y" : "-"}`,
      );
  }

  return {
    ...horizontal,
    initialOutside,
    routesSeen,
    routesMoved,
    recovered,
    oversizedRecovered,
    lostControls,
    clippingBoxes,
    clippedAwaySkips,
    nativeTextInputSkips,
    unreachableClips,
  };
}

// Both callbacks serialize the same self-contained browser function. The
// typed view keeps the horizontal result distinct from full reachability.
export const surveyHorizontalReflow: (mode: "horizontal") => HorizontalSurvey =
  surveyReflow;
