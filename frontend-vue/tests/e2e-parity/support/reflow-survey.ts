/*
  Shared reachability survey for multi-axis reflow gates. Keep every value
  needed by the positive controls inside this function: Playwright serializes
  it into the page, so module-scope helpers would disappear at runtime.
*/

export function surveyReflow(clipThreshold = 24) {
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
  const visibleRouteRect = (element: HTMLElement) => {
    const raw =
      element === scrollingElement
        ? { left: 0, right: innerWidth, top: 0, bottom: innerHeight }
        : element.getBoundingClientRect();
    /*
      A scroll container can itself extend beyond the window (portalled menus
      are the common case). Its usable reveal area is the intersection with the
      real viewport, not its off-screen border box. Using the raw bottom made a
      menu item at y=385 look visible merely because its menu ended at y=504.
    */
    return {
      left: Math.max(0, raw.left),
      right: Math.min(innerWidth, raw.right),
      top: Math.max(0, raw.top),
      bottom: Math.min(innerHeight, raw.bottom),
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

  const nonDeliberateHorizontalScrollers = Array.from(
    document.querySelectorAll("*"),
  )
    .filter((element) => {
      if (!rendered(element) || !scrollable(element, "x")) return false;
      if (element.tagName === "PRE" || element.querySelector("table"))
        return false;
      return true;
    })
    .map(describe);

  const fullyInViewport = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.left >= -0.5 &&
      rect.right <= innerWidth + 0.5 &&
      rect.top >= -0.5 &&
      rect.bottom <= innerHeight + 0.5
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
    for (const route of routes) {
      const controlRect = control.getBoundingClientRect();
      const routeRect = visibleRouteRect(route.element);
      if (route.x) {
        if (controlRect.right > routeRect.right)
          route.element.scrollLeft += controlRect.right - routeRect.right;
        else if (controlRect.left < routeRect.left)
          route.element.scrollLeft += controlRect.left - routeRect.left;
      }
      if (route.y) {
        if (controlRect.bottom > routeRect.bottom)
          route.element.scrollTop += controlRect.bottom - routeRect.bottom;
        else if (controlRect.top < routeRect.top)
          route.element.scrollTop += controlRect.top - routeRect.top;
      }
    }
    const moved = routes.some(
      ({ element }, index) =>
        Math.abs(element.scrollLeft - before[index]!.left) > 0.5 ||
        Math.abs(element.scrollTop - before[index]!.top) > 0.5,
    );
    if (moved) routesMoved += 1;
    const restoreRoutes = () => {
      routes.forEach(({ element }, index) => {
        element.scrollLeft = before[index]!.left;
        element.scrollTop = before[index]!.top;
      });
    };
    const edgeReachable = (axis: "x" | "y", edge: "leading" | "trailing") => {
      restoreRoutes();
      for (const route of routes) {
        if (!route[axis]) continue;
        const controlRect = control.getBoundingClientRect();
        const routeRect = visibleRouteRect(route.element);
        if (axis === "x") {
          const delta =
            edge === "leading"
              ? controlRect.left - routeRect.left
              : controlRect.right - routeRect.right;
          route.element.scrollLeft += delta;
        } else {
          const delta =
            edge === "leading"
              ? controlRect.top - routeRect.top
              : controlRect.bottom - routeRect.bottom;
          route.element.scrollTop += delta;
        }
      }
      const result = control.getBoundingClientRect();
      const edgePosition =
        axis === "x"
          ? edge === "leading"
            ? result.left
            : result.right
          : edge === "leading"
            ? result.top
            : result.bottom;
      const limit = axis === "x" ? innerWidth : innerHeight;
      return edgePosition >= -0.5 && edgePosition <= limit + 0.5;
    };
    const afterMove = control.getBoundingClientRect();
    const oversizedX = afterMove.width > innerWidth + 1;
    const oversizedY = afterMove.height > innerHeight + 1;
    const oversizedReachable =
      moved &&
      (oversizedX || oversizedY) &&
      (!oversizedX ||
        (edgeReachable("x", "leading") && edgeReachable("x", "trailing"))) &&
      (!oversizedY ||
        (edgeReachable("y", "leading") && edgeReachable("y", "trailing")));
    restoreRoutes();
    for (const route of routes) {
      const controlRect = control.getBoundingClientRect();
      const routeRect = visibleRouteRect(route.element);
      if (route.x) {
        if (controlRect.right > routeRect.right)
          route.element.scrollLeft += controlRect.right - routeRect.right;
        else if (controlRect.left < routeRect.left)
          route.element.scrollLeft += controlRect.left - routeRect.left;
      }
      if (route.y) {
        if (controlRect.bottom > routeRect.bottom)
          route.element.scrollTop += controlRect.bottom - routeRect.bottom;
        else if (controlRect.top < routeRect.top)
          route.element.scrollTop += controlRect.top - routeRect.top;
      }
    }
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
    width: innerWidth,
    height: innerHeight,
    rootPx: Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    ),
    documentOverflowX,
    nonDeliberateHorizontalScrollers,
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
