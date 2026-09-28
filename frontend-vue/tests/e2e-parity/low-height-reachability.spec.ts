/*
  低高度可达性门禁：终态先按原维度完整走到位，再只把高度压到 360px。
  它不看「控件一开始是否在视口外」这一半事实，而是沿用户可滚动的祖先或
  document 实际滚动，确认控件最终能完整进入视口。两端共用同一把尺子，且
  必须命中、移动并恢复真实控件，避免没有样本时静默绿灯。
*/

import { expect, test } from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

const LOW_HEIGHT = 360;

function surveyLowHeightControls() {
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

  const rendered = (element: Element) => {
    if (element.closest('[aria-hidden="true"],[inert]')) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  };

  const describe = (element: Element) => {
    const html = element as HTMLElement;
    const role = element.getAttribute("role");
    const name =
      element.getAttribute("aria-label") ??
      element.getAttribute("title") ??
      html.innerText?.trim().replace(/\s+/g, " ").slice(0, 28) ??
      "";
    const slot = element.getAttribute("data-slot");
    return `${role ?? element.tagName.toLowerCase()}${slot ? `[${slot}]` : ""}"${name}"`;
  };

  const scrollingElement = document.scrollingElement as HTMLElement | null;
  const isScrollable = (element: Element) => {
    const style = getComputedStyle(element);
    return (
      ["auto", "scroll", "overlay"].includes(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1
    );
  };
  const fullyInViewport = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= -0.5 && rect.bottom <= innerHeight + 0.5;
  };

  const candidates = Array.from(document.querySelectorAll(INTERACTIVE)).filter(
    (element) => {
      if (!rendered(element)) return false;
      const rect = element.getBoundingClientRect();
      /* 横向完全不在视口的是另一把尺子的账；这里只隔离低高度变量。 */
      if (rect.right <= 0 || rect.left >= innerWidth) return false;
      return !fullyInViewport(element);
    },
  );

  const recovered: string[] = [];
  const lost: string[] = [];
  let routesSeen = 0;
  let routesMoved = 0;

  for (const control of candidates) {
    const routes: HTMLElement[] = [];
    let ancestor = control.parentElement;
    while (ancestor && ancestor !== document.body) {
      if (isScrollable(ancestor)) routes.push(ancestor);
      ancestor = ancestor.parentElement;
    }
    if (
      scrollingElement &&
      scrollingElement.scrollHeight > scrollingElement.clientHeight + 1
    )
      routes.push(scrollingElement);
    routesSeen += routes.length;

    const before = routes.map((route) => route.scrollTop);
    for (const route of routes) {
      const controlRect = control.getBoundingClientRect();
      const routeRect =
        route === scrollingElement
          ? { top: 0, bottom: innerHeight }
          : route.getBoundingClientRect();
      let delta = 0;
      if (controlRect.bottom > routeRect.bottom)
        delta = controlRect.bottom - routeRect.bottom;
      else if (controlRect.top < routeRect.top)
        delta = controlRect.top - routeRect.top;
      if (Math.abs(delta) > 0.5) route.scrollTop += delta;
    }

    const moved = routes.some(
      (route, index) => Math.abs(route.scrollTop - before[index]!) > 0.5,
    );
    if (moved) routesMoved += 1;
    const label = describe(control);
    if (moved && fullyInViewport(control)) recovered.push(label);
    else {
      const rect = control.getBoundingClientRect();
      const chain: string[] = [];
      let node = control.parentElement;
      while (node && node !== document.body) {
        const nodeRect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        chain.push(
          `${node.tagName.toLowerCase()}` +
            `${node.getAttribute("role") ? `[role=${node.getAttribute("role")}]` : ""}` +
            `${node.getAttribute("data-slot") ? `[${node.getAttribute("data-slot")}]` : ""}` +
            ` y=[${Math.round(nodeRect.top)},${Math.round(nodeRect.bottom)}]` +
            ` oy=${style.overflowY} sh/ch=${node.scrollHeight}/${node.clientHeight}` +
            ` pos=${style.position}`,
        );
        node = node.parentElement;
      }
      lost.push(
        `${label} y=[${Math.round(rect.top)},${Math.round(rect.bottom)}] ` +
          `routes=${routes.length} moved=${moved} :: ${chain.join(" <- ")}`,
      );
    }

    /* 每颗控件从相同终态量，避免上一颗的滚动替下一颗制造假可达。 */
    routes.forEach((route, index) => {
      route.scrollTop = before[index]!;
    });
  }

  return {
    height: innerHeight,
    initialOutside: candidates.length,
    recovered: recovered.length,
    recoveredSamples: recovered.slice(0, 8),
    lost,
    routesSeen,
    routesMoved,
  };
}

for (const [name, base] of APPS) {
  test(`${name}: 360px 高度下的交互控件都能滚进视口`, async ({ browser }) => {
    test.setTimeout(1_800_000);
    const lost: string[] = [];
    const failed: string[] = [];
    const heights = new Set<number>();
    const samples: string[] = [];
    let scanned = 0;
    let initialOutside = 0;
    let recovered = 0;
    let routesSeen = 0;
    let routesMoved = 0;

    for (const scenario of PARITY_SCENARIOS)
      for (const state of scenarioStates(scenario)) {
        const key = `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`;
        const dimension =
          state.dimensions?.[0] ??
          scenario.dimensions?.[0] ??
          DEFAULT_DIMENSION;
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        try {
          await runScenario(page, base, scenario, dimension, state, 30_000);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const width = page.viewportSize()!.width;
          await page.setViewportSize({ width, height: LOW_HEIGHT });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);

          const survey = await page.evaluate(surveyLowHeightControls);
          heights.add(survey.height);
          initialOutside += survey.initialOutside;
          recovered += survey.recovered;
          routesSeen += survey.routesSeen;
          routesMoved += survey.routesMoved;
          for (const sample of survey.recoveredSamples)
            if (samples.length < 12) samples.push(`${key}: ${sample}`);
          for (const row of survey.lost) lost.push(`${key}: ${row}`);
          scanned += 1;
        } catch (error) {
          failed.push(`${key}: ${String(error).split("\n")[0]?.slice(0, 110)}`);
        } finally {
          await context.close();
        }
      }

    console.info(
      `[low-height] ${name} scanned=${scanned} initialOutside=${initialOutside} ` +
        `recovered=${recovered} routesSeen=${routesSeen} routesMoved=${routesMoved} ` +
        `samples=${JSON.stringify(samples)}`,
    );
    expect(failed, "这些终态没走到位，低高度探针空转").toEqual([]);
    expect(scanned, "一个终态都没量到").toBeGreaterThan(0);
    expect([...heights], "高度压缩没有稳定落到 360px").toEqual([LOW_HEIGHT]);
    expect(initialOutside, "没有命中任何初始在低视口外的控件").toBeGreaterThan(
      0,
    );
    expect(routesSeen, "没有找到任何合法纵向滚动路径").toBeGreaterThan(0);
    expect(routesMoved, "合法滚动路径一次都没有实际移动").toBeGreaterThan(0);
    expect(
      recovered,
      "没有任何视口外控件被滚回视口，量具没有阳性对照",
    ).toBeGreaterThan(0);
    expect(
      lost,
      "这些可交互控件初始在 360px 低视口外，且通过 document / 可滚动祖先仍无法完整进入视口",
    ).toEqual([]);
  });
}
