/*
  Wave 68 三轴键盘闭环门禁。

  `triple-reflow.spec.ts` 证明 360px × 360px × 200% 下控件可以通过真实滚动路径
  回到视口；它没有按过键，不能证明 Tab / Shift+Tab 真的能走到那些控件、也不能
  证明重排后的浮层和内层滚动区不会吞键。本文件补的是这个行为层，不重复静态
  tabbable 清单，也不拿「可以 scrollIntoView」冒充「键盘能够操作」。

  量法：
  1. 每个终态、每个方向都新建 context，避免正向遍历污染反向起点；
  2. 先在终态声明的原始尺寸完成交互，再施加三轴条件；
  3. 连按 30 次、再按 10 次尾段。尾段没有任何新 focusin 且焦点还停在普通元素上，
     就是键盘陷阱；一次 focusin 都没有且没有可见浮层接管，也是失守；
  4. 每次按键后读取最终 activeElement 的真实裁剪交集。焦点虽变化但停在完全不可见
     的元素上，不能算「可达」。

  菜单、列表框和模态框可以依法接管键盘，因此按运行时语义判断，不维护场景白名单。
  `TRIPLE_KEYBOARD_ONLY` 只用于定位，默认仍强制双端 61 个终态 × 两个方向。
*/

import { expect, test, type Page } from "@playwright/test";

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

const WIDTH = 360;
const HEIGHT = 360;
const ROOT_PX = 32;
const PRESSES = 30;
const TAIL = 10;
const DIRECTIONS = ["Tab", "Shift+Tab"] as const;
const ONLY = new Set(
  (process.env.TRIPLE_KEYBOARD_ONLY ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const SCENARIOS = ONLY.size
  ? PARITY_SCENARIOS.filter((scenario) => ONLY.has(scenario.id))
  : PARITY_SCENARIOS;
const EXPECTED_STATES = SCENARIOS.reduce(
  (count, scenario) => count + scenarioStates(scenario).length,
  0,
);

const INSTALL_FOCUS_LOG = () => {
  const scope = globalThis as unknown as { __tripleKeyboardStops?: number };
  scope.__tripleKeyboardStops = 0;
  document.addEventListener(
    "focusin",
    () => {
      scope.__tripleKeyboardStops = (scope.__tripleKeyboardStops ?? 0) + 1;
    },
    true,
  );
};

const READ_FOCUS = async () => {
  const scope = globalThis as unknown as { __tripleKeyboardStops?: number };
  const active = document.activeElement;
  const visibleOverlays = Array.from(
    document.querySelectorAll('[role="menu"],[role="listbox"],[role="dialog"]'),
  ).filter((element) => {
    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.contentVisibility === "hidden"
    )
      return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  const overlayOwnsKeyboard = visibleOverlays.some((overlay) => {
    const role = overlay.getAttribute("role");
    if (role === "menu" || role === "listbox") return true;
    if (!active || (overlay !== active && !overlay.contains(active)))
      return false;
    const tabbables = Array.from(
      overlay.querySelectorAll<HTMLElement>(
        'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        !element.hasAttribute("disabled") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    return tabbables.length <= 1;
  });
  const visibleTabbables = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => {
    if (
      element.hasAttribute("disabled") ||
      element.closest('[inert],[aria-hidden="true"]')
    )
      return false;
    const rect = element.getBoundingClientRect();
    return (
      element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      }) &&
      rect.width > 0 &&
      rect.height > 0
    );
  }).length;

  if (
    !active ||
    active === document.body ||
    active === document.documentElement
  )
    return {
      stops: scope.__tripleKeyboardStops ?? 0,
      active: "body",
      describe: "",
      overlayOwnsKeyboard,
      visibleTabbables,
      visible: true,
      geometry: "",
    };

  const label =
    active.getAttribute("aria-label") ??
    active.getAttribute("placeholder") ??
    (active as HTMLElement).innerText ??
    "";
  const describe =
    `${active.tagName.toLowerCase()}` +
    `${active.getAttribute("role") ? `(${active.getAttribute("role")})` : ""}` +
    `"${label.trim().replace(/\s+/g, " ").slice(0, 30)}"`;
  const style = getComputedStyle(active);
  const rect = active.getBoundingClientRect();
  /*
    不手算祖先 overflow 链：fixed / portal / containing-block 的裁剪规则不是简单的
    DOM 父子求交。IntersectionObserver.intersectionRect 是浏览器对真实渲染裁剪链
    的结论，也会等到按键触发的自动滚动完成一帧后再采样。
  */
  const intersection = await new Promise<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>((resolve) => {
    const observer = new IntersectionObserver((entries) => {
      const value = entries[0]?.intersectionRect;
      observer.disconnect();
      resolve({
        left: value?.left ?? 0,
        top: value?.top ?? 0,
        width: value?.width ?? 0,
        height: value?.height ?? 0,
      });
    });
    observer.observe(active);
  });
  const clippingChain: string[] = [];
  for (
    let parent = active.parentElement;
    parent && clippingChain.length < 6;
    parent = parent.parentElement
  ) {
    const parentStyle = getComputedStyle(parent);
    if (
      parentStyle.overflowX === "visible" &&
      parentStyle.overflowY === "visible"
    )
      continue;
    const parentRect = parent.getBoundingClientRect();
    clippingChain.push(
      `${parent.tagName.toLowerCase()}` +
        `${parent.getAttribute("data-slot") ? `[${parent.getAttribute("data-slot")}]` : ""}` +
        `(${parentStyle.overflowX}/${parentStyle.overflowY})` +
        `@${Math.round(parentRect.left)},${Math.round(parentRect.top)},` +
        `${Math.round(parentRect.width)}x${Math.round(parentRect.height)}` +
        `:${parent.clientWidth}x${parent.clientHeight}/${parent.scrollWidth}x${parent.scrollHeight}`,
    );
  }
  const wrapper = active.parentElement;
  const wrapperStyle = wrapper ? getComputedStyle(wrapper) : undefined;
  const wrapperRect = wrapper?.getBoundingClientRect();
  const wrapperGeometry =
    wrapper && wrapperStyle && wrapperRect
      ? ` wrapper=${wrapper.tagName.toLowerCase()}` +
        `${wrapper.hasAttribute("data-reka-popper-content-wrapper") ? "[reka-popper]" : ""}` +
        `(${wrapperStyle.position};${wrapperStyle.transform})` +
        `@${Math.round(wrapperRect.left)},${Math.round(wrapperRect.top)},` +
        `${Math.round(wrapperRect.width)}x${Math.round(wrapperRect.height)}`
      : "";
  const geometry =
    `rect=${Math.round(rect.left)},${Math.round(rect.top)},` +
    `${Math.round(rect.width)}x${Math.round(rect.height)} ` +
    `intersection=${Math.round(intersection.left)},${Math.round(intersection.top)},` +
    `${Math.round(intersection.width)}x${Math.round(intersection.height)} ` +
    `clips=${clippingChain.join(">")}${wrapperGeometry}`;
  return {
    stops: scope.__tripleKeyboardStops ?? 0,
    active: "element",
    describe,
    overlayOwnsKeyboard,
    visibleTabbables,
    visible:
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.contentVisibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0 &&
      intersection.width > 0 &&
      intersection.height > 0,
    geometry,
  };
};

type FocusReading = Awaited<ReturnType<typeof READ_FOCUS>>;

async function walk(page: Page, direction: (typeof DIRECTIONS)[number]) {
  await page.evaluate(INSTALL_FOCUS_LOG);
  const invisible = new Set<string>();
  let invisibleStops = 0;
  let bodyEdges = 0;
  let overlayOwned = 0;
  let reading: FocusReading | undefined;
  for (let i = 0; i < PRESSES; i += 1) {
    await page.keyboard.press(direction);
    reading = await page.evaluate(READ_FOCUS);
    if (reading.active === "body") bodyEdges += 1;
    if (reading.overlayOwnsKeyboard) overlayOwned += 1;
    if (!reading.visible) {
      invisibleStops += 1;
      if (invisible.size < 2)
        invisible.add(`${i + 1}:${reading.describe} ${reading.geometry}`);
    }
  }
  const first = reading ?? (await page.evaluate(READ_FOCUS));
  for (let i = 0; i < TAIL; i += 1) {
    await page.keyboard.press(direction);
    reading = await page.evaluate(READ_FOCUS);
    if (reading.active === "body") bodyEdges += 1;
    if (reading.overlayOwnsKeyboard) overlayOwned += 1;
    if (!reading.visible) {
      invisibleStops += 1;
      if (invisible.size < 2)
        invisible.add(
          `${PRESSES + i + 1}:${reading.describe} ${reading.geometry}`,
        );
    }
  }
  return {
    first,
    second: reading ?? (await page.evaluate(READ_FOCUS)),
    invisible: [...invisible],
    invisibleStops,
    bodyEdges,
    overlayOwned,
  };
}

test("三轴键盘量具只在 360px × 360px × 200% 交集识别吞键", async ({ page }) => {
  const mutation = process.env.TRIPLE_KEYBOARD_MUTATE === "1";
  const probe = async (
    width: number,
    height: number,
    rootPx: number,
    direction: (typeof DIRECTIONS)[number],
  ) => {
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<style>html{font-size:${rootPx}px}</style>` +
        '<button id="first">first</button><button id="second">second</button>' +
        `<script>
          document.addEventListener("keydown", event => {
            const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
            const threshold = ${mutation ? 16 : ROOT_PX};
            if (event.key === "Tab" && innerWidth <= ${WIDTH} && innerHeight <= ${HEIGHT} && root >= threshold)
              event.preventDefault();
          });
        </script>`,
    );
    await page.locator(direction === "Tab" ? "#first" : "#second").focus();
    return walk(page, direction);
  };

  const axes = [
    ["baseline", 1280, 720, 16],
    ["width", WIDTH, 720, 16],
    ["height", 1280, HEIGHT, 16],
    ["text", 1280, 720, ROOT_PX],
    ["widthHeight", WIDTH, HEIGHT, 16],
    ["widthText", WIDTH, 720, ROOT_PX],
    ["heightText", 1280, HEIGHT, ROOT_PX],
    ["triple", WIDTH, HEIGHT, ROOT_PX],
  ] as const;

  for (const [name, width, height, rootPx] of axes)
    for (const direction of DIRECTIONS) {
      const result = await probe(width, height, rootPx, direction);
      const dead =
        result.first.stops === 0 &&
        result.second.stops === 0 &&
        !result.second.overlayOwnsKeyboard;
      expect(dead, `${name}[${direction}] 的吞键判定不符`).toBe(
        name === "triple",
      );
    }
});

for (const [name, base] of APPS) {
  test(`${name}: 61 个三轴终态的 Tab / Shift+Tab 可达且无陷阱`, async ({
    browser,
  }) => {
    test.setTimeout(3_600_000);
    const trapped: string[] = [];
    const deadWithoutOverlay: string[] = [];
    const invisible: string[] = [];
    let invisibleStops = 0;
    const unreachable: string[] = [];
    const widths = new Set<number>();
    const heights = new Set<number>();
    const rootSizes = new Set<number>();
    let scanned = 0;
    let focusEvents = 0;
    let bodyEdges = 0;
    let overlayOwned = 0;

    expect(
      SCENARIOS.length,
      `TRIPLE_KEYBOARD_ONLY=${[...ONLY].join(",")} 没有匹配到任何场景`,
    ).toBeGreaterThan(0);
    expect(
      SCENARIOS.length,
      "TRIPLE_KEYBOARD_ONLY 中至少一个场景 id 没有匹配",
    ).toBe(ONLY.size || PARITY_SCENARIOS.length);

    for (const scenario of SCENARIOS)
      for (const state of scenarioStates(scenario))
        for (const direction of DIRECTIONS) {
          const key = `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}[${direction}]`;
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
            await page.setViewportSize({ width: WIDTH, height: HEIGHT });
            await page.addStyleTag({
              content: `html{font-size:${ROOT_PX}px !important}`,
            });
            await waitForFiniteAnimations(page);
            await waitForDomQuiet(page);

            const applied = await page.evaluate(() => ({
              width: innerWidth,
              height: innerHeight,
              rootPx: Number.parseFloat(
                getComputedStyle(document.documentElement).fontSize,
              ),
            }));
            widths.add(applied.width);
            heights.add(applied.height);
            rootSizes.add(applied.rootPx);

            const result = await walk(page, direction);
            focusEvents += result.second.stops;
            bodyEdges += result.bodyEdges;
            overlayOwned += result.overlayOwned;
            if (
              result.first.stops === 0 &&
              result.second.stops === 0 &&
              !result.second.overlayOwnsKeyboard &&
              result.second.visibleTabbables > 0
            )
              deadWithoutOverlay.push(key);
            else if (
              result.second.stops === result.first.stops &&
              result.second.active !== "body" &&
              !result.second.overlayOwnsKeyboard
            )
              trapped.push(
                `${key}: 停在 ${result.second.describe}，尾段 ${TAIL} 次按键无变化`,
              );
            invisibleStops += result.invisibleStops;
            for (const row of result.invisible) {
              if (invisible.length >= 32) break;
              invisible.push(`${key}: ${row}`);
            }
            scanned += 1;
          } catch (error) {
            unreachable.push(
              `${key}: ${String(error).split("\n")[0]?.slice(0, 120)}`,
            );
          } finally {
            await context.close();
          }
        }

    console.info(
      `[triple-keyboard] ${name} scanned=${scanned} focusEvents=${focusEvents} ` +
        `bodyEdges=${bodyEdges} overlayOwned=${overlayOwned} ` +
        `dead=${deadWithoutOverlay.length} trapped=${trapped.length} ` +
        `invisible=${invisibleStops} unreachable=${unreachable.length}`,
    );
    console.info(
      `[triple-keyboard-dead] ${name} ${JSON.stringify(deadWithoutOverlay)}`,
    );
    console.info(
      `[triple-keyboard-trapped] ${name} ${JSON.stringify(trapped)}`,
    );
    console.info(
      `[triple-keyboard-invisible] ${name} ${JSON.stringify(invisible)}`,
    );
    expect(scanned).toBe(EXPECTED_STATES * DIRECTIONS.length);
    if (!ONLY.size) expect(scanned).toBe(61 * DIRECTIONS.length);
    expect([...widths], "360px 宽度没有稳定落地").toEqual([WIDTH]);
    expect([...heights], "360px 高度没有稳定落地").toEqual([HEIGHT]);
    expect([...rootSizes], "200% 根字号没有稳定落地").toEqual([ROOT_PX]);
    if (!ONLY.size) {
      expect(focusEvents, "全量没有产生任何 focusin，量具空转").toBeGreaterThan(
        100,
      );
      expect(overlayOwned, "全量没有命中任何浮层键盘接管分支").toBeGreaterThan(
        0,
      );
    }
    expect(
      deadWithoutOverlay,
      "这些三轴终态按键后焦点一步都没动，且没有可见浮层依法接管键盘",
    ).toEqual([]);
    expect(
      trapped,
      "这些三轴终态把键盘焦点扣在普通元素上（WCAG 2.1.2）",
    ).toEqual([]);
    expect(
      invisibleStops,
      `这些三轴终态的焦点虽变化，却落在视口或裁剪祖先之外，不能算键盘可达：${JSON.stringify(invisible)}`,
    ).toBe(0);
    expect(unreachable, "这些三轴终态没有走到位，键盘探针空转").toEqual([]);
  });
}
