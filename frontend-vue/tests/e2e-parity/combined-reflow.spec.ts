/*
  Wave 66 组合回流门禁：每个终态先按自己的原始维度走到位，再同时施加
  360px 窄宽与 32px 根字号（200% 文本）。单轴门禁已经分别常驻；这把尺子
  专门量交集，不能用“窄屏绿 + 文本放大绿”代替。

  两个应用共用同一把尺：登记表的全部终态、对话框生命周期、水平滚动、控件可达性与
  裁切内容的合法滚动路径都要逐一验证，并用下方的交集阳性样本防止量具空转。
*/

import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
import { stateCoverageFailures } from "./support/state-coverage";
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
const ROOT_PX = 32;
const EXPECTED_STATES = PARITY_SCENARIOS.flatMap((scenario) =>
  scenarioStates(scenario).map((state) => `${scenario.id}#${state.id}`),
);
test("未绘制的折叠 details 子控件不参与量具，展开后的真实裁切仍失败", async ({
  page,
}) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.setContent(
    "<style>body{margin:0}.port{margin-top:200px;width:220px;height:100px;overflow:auto}input{display:block;width:180px;height:120px}</style>" +
      '<button>Before details</button><details open><summary>Settings</summary><div class="port"><input type="checkbox" aria-label="Worker selection"></div></details><button>After details</button>',
  );
  const checkbox = page.getByRole("checkbox", { name: "Worker selection" });
  expect(await checkbox.evaluate((element) => element.checkVisibility())).toBe(
    true,
  );
  expect((await page.evaluate(surveyReflow, 24)).lostControls).toHaveLength(1);
  await page.locator("details").evaluate((element) => {
    if (!(element instanceof HTMLDetailsElement))
      throw new Error("Expected the physical details owner");
    element.open = false;
  });
  // Chromium retains the child's old nonzero layout box after details closes.
  // Native painting and Tab admission, rather than that cache, define the target.
  expect(
    await page
      .locator("input")
      .evaluate((element) => element.checkVisibility()),
  ).toBe(false);
  await page.getByRole("button", { name: "Before details" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByText("Settings", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "After details" }),
  ).toBeFocused();
  expect((await page.evaluate(surveyReflow, 24)).lostControls).toEqual([]);
  await page.locator("details").evaluate((element) => {
    if (!(element instanceof HTMLDetailsElement))
      throw new Error("Expected the physical details owner");
    element.open = true;
  });
  expect((await page.evaluate(surveyReflow, 24)).lostControls).toHaveLength(1);
  await page.locator(".port").evaluate((element) => {
    (element as HTMLElement).style.height = "160px";
  });
  expect((await page.evaluate(surveyReflow, 24)).lostControls).toEqual([]);
});
test("组合轴量具能命中仅在 360px × 200% 交集出现的裁切", async ({ page }) => {
  const probe = async (width: number, rootPx: number) => {
    await page.setViewportSize({ width, height: 720 });
    await page.setContent(
      `<style>html{font-size:${rootPx}px}.outer{width:calc(100vw - 20px);height:4rem;overflow:hidden}.inner{width:20rem;height:2rem}</style>` +
        '<div class="outer"><div class="inner">positive control</div></div>',
    );
    return page.evaluate(surveyReflow, 24);
  };

  const narrowOnly = await probe(WIDTH, 16);
  const textOnly = await probe(1280, ROOT_PX);
  const combined = await probe(WIDTH, ROOT_PX);

  expect(narrowOnly.unreachableClips).toEqual([]);
  expect(textOnly.unreachableClips).toEqual([]);
  expect(combined.unreachableClips.length).toBeGreaterThan(0);
});

test("代码横向滚动只允许有界的真实 PRE/CODE owner，普通内容和外层溢出仍失败", async ({
  page,
}) => {
  await page.setViewportSize({ width: WIDTH, height: 720 });
  const originalCode = "const example = 1234567890; ".repeat(30);
  const code = `<pre><code><span class="line"><span style="color:blue"><span>${originalCode}</span></span></span></code></pre>`;
  const show = async (content: string) => {
    await page.setContent(
      `<style>html{font-size:32px}body{margin:0}.host{width:180px}.owner{overflow-x:auto}pre{margin:0;white-space:pre}button{white-space:nowrap}</style>${content}`,
    );
    return page.evaluate(surveyReflow, 24);
  };
  const legal = await show(
    `<div class="host"><div class="owner" data-streamdown="code-block-body">${code}</div></div>`,
  );
  const owner = page.locator('[data-streamdown="code-block-body"]');
  await owner.hover();
  await page.mouse.wheel(1000, 0);
  await expect
    .poll(() => owner.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  expect(legal.documentOverflowX).toBe(0);
  expect(legal.nonDeliberateHorizontalScrollers).toEqual([]);
  expect(await owner.locator("code").textContent()).toBe(originalCode);

  for (const content of [
    '<div style="width:700px">ordinary overflow</div>',
    '<button style="width:700px">oversized action</button>',
    `${code}<button style="width:700px">action beside code</button>`,
    '<pre><code><button style="width:700px">action inside code</button></code></pre>',
    '<pre><code><button disabled style="width:700px">disabled action inside code</button></code></pre>',
    '<pre><code><input disabled style="width:700px" value="disabled field" /></code></pre>',
    '<pre><code><span role="button" tabindex="0" style="display:block;width:700px">token pretending to be an action</span></code></pre>',
    `<div>${code}</div>`,
    '<pre><span style="display:block;width:700px">not a CODE child</span></pre>',
  ]) {
    const result = await show(
      `<div class="host"><div class="owner" data-streamdown="code-block-body">${content}</div></div>`,
    );
    expect(result.nonDeliberateHorizontalScrollers.length).toBeGreaterThan(0);
  }
  const outer = await show(
    `<div style="width:320px;overflow-x:auto"><div class="host"><div class="owner" data-streamdown="code-block-body">${code}</div></div><div style="width:700px">outside code</div></div>`,
  );
  expect(outer.documentOverflowX).toBe(0);
  expect(outer.nonDeliberateHorizontalScrollers.length).toBeGreaterThan(0);
  const unbounded = await show(
    `<div style="width:700px" class="owner" data-streamdown="code-block-body">${code}</div>`,
  );
  expect(unbounded.documentOverflowX).toBeGreaterThan(0);
  expect(unbounded.nonDeliberateHorizontalScrollers.length).toBeGreaterThan(0);
});

test("原生滚动量具不能放过窗口内高于 scrollport 的完整控件", async ({
  page,
}) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.setContent(
    "<style>body{margin:0}.port{margin-top:200px;width:220px;height:100px;overflow-y:auto}button{display:block;width:200px;height:120px}</style>" +
      '<div class="port"><div style="height:40px"></div><button>Full copy control</button><div style="height:40px"></div></div>',
  );
  const button = page.getByRole("button", { name: "Full copy control" });
  const geometry = await button.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    portHeight: element.parentElement!.clientHeight,
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
  }));
  expect(geometry.height).toBeGreaterThan(geometry.portHeight);
  expect(geometry.top).toBeGreaterThan(0);
  expect(geometry.bottom).toBeLessThan(800);
  const survey = await page.evaluate(surveyReflow, 24);
  expect(survey.lostControls).toHaveLength(1);
  expect(survey.oversizedRecovered).toBe(0);

  // The existing oversized-window rule may reveal the long axis by its two
  // edges. It must not excuse clipping on the other, window-sized axis.
  await page.setContent(
    "<style>body{margin:0}.port{width:220px;height:200px;overflow:auto}button{display:block;width:240px;height:900px}</style>" +
      '<div class="port"><button>Oversized with clipped other axis</button></div>',
  );
  const oversized = await page.evaluate(surveyReflow, 24);
  expect(oversized.lostControls).toHaveLength(1);
  expect(oversized.oversizedRecovered).toBe(0);
});

test("原生滚动量具恢复原 owner 和位置后，正常控件仍可由 wheel 完整滚入", async ({
  page,
}) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.setContent(
    "<style>body{margin:0}.port{margin-top:100px;width:220px;height:100px;overflow-y:auto}button{display:block;width:200px;height:60px}</style>" +
      '<div class="port"><div style="height:90px"></div><button>Reachable copy control</button><div style="height:90px"></div></div>',
  );
  const port = page.locator(".port");
  const originalOwner = await port.elementHandle();
  await port.evaluate((element) => {
    element.scrollTop = 20;
  });
  const before = await port.evaluate((element) => element.scrollTop);
  const survey = await page.evaluate(surveyReflow, 24);
  expect(survey.initialOutside).toBeGreaterThan(0);
  expect(survey.routesMoved).toBeGreaterThan(0);
  expect(survey.recovered).toBeGreaterThan(0);
  expect(survey.lostControls).toEqual([]);
  expect(await port.evaluate((element) => element.scrollTop)).toBe(before);
  expect(
    await port.evaluate(
      (element, original) => element === original,
      originalOwner,
    ),
  ).toBe(true);
  await port.hover();
  await page.mouse.wheel(0, 40);
  await expect
    .poll(() => port.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(before);
  await expect(
    page.getByRole("button", { name: "Reachable copy control" }),
  ).toBeInViewport({ ratio: 1 });

  // A sticky toolbar can stay pinned while its native scroll owner moves.
  // The browser's own reveal algorithm must be measured, with both native
  // owners restored; a single inferred pixel delta is not proof of reachability.
  await page.setContent(
    "<style>body{margin:0}.port{margin-top:160px;width:220px;height:200px;overflow:auto}.diagram{height:360px}.sticky{position:sticky;top:16px;height:64px}.menu{position:absolute;top:64px;height:218px;overflow:hidden}button{display:block;width:118px;height:72px}</style>" +
      '<div class="port"><div style="height:120px"></div><div class="diagram"><div class="sticky"><div class="menu"><button>SVG</button><button>PNG</button><button>MMD</button></div></div></div><div style="height:400px"></div></div>',
  );
  const stickyOwner = page.locator(".port");
  await stickyOwner.evaluate((element) => {
    element.scrollTop = 120;
  });
  // Establish that this is a positive native path before testing the survey.
  await stickyOwner.hover();
  await page.mouse.wheel(0, 1_000);
  await expect
    .poll(() => stickyOwner.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(120);
  await page.getByRole("button", { name: "MMD", exact: true }).focus();
  await expect(
    page.getByRole("button", { name: "MMD", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "MMD", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await stickyOwner.evaluate((element) => {
    element.scrollTop = 120;
  });
  const stickySurvey = await page.evaluate(surveyReflow, 24);
  expect(stickySurvey.initialOutside).toBeGreaterThan(0);
  expect(stickySurvey.recovered).toBeGreaterThan(0);
  expect(stickySurvey.lostControls).toEqual([]);
  expect(await stickyOwner.evaluate((element) => element.scrollTop)).toBe(120);
  await expect(
    page.getByRole("button", { name: "MMD", exact: true }),
  ).toBeFocused();
  await stickyOwner.hover();
  await page.mouse.wheel(0, 1_000);
  await expect
    .poll(() => stickyOwner.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(120);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "MMD", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "MMD", exact: true }),
  ).toBeInViewport({ ratio: 1 });

  // The already-existing window-oversized rule still requires both actual
  // edges. Native reveal can pan overflow:hidden (unlike overflow:clip), as
  // happens with a translated animation child; that position must be restored.
  for (const overflow of ["hidden", "clip"]) {
    await page.setContent(
      `<style>body{margin:0}.port{width:220px;height:200px;overflow:auto}.motion{height:900px;overflow:${overflow}}button{display:block;width:200px;height:900px;transform:translateY(2px)}</style>` +
        '<div class="port"><div class="motion"><button>Translated oversized content</button></div></div>',
    );
    await page
      .getByRole("button")
      .evaluate((element) => element.focus({ preventScroll: true }));
    const result = await page.evaluate(surveyReflow, 24);
    await expect(page.getByRole("button")).toBeFocused();
    if (overflow === "hidden") {
      expect(result.oversizedRecovered).toBe(1);
      expect(result.lostControls).toEqual([]);
    } else {
      expect(result.oversizedRecovered).toBe(0);
      expect(result.lostControls).toHaveLength(1);
    }
    expect(
      await page.locator(".port").evaluate((element) => element.scrollTop),
    ).toBe(0);
    expect(
      await page.locator(".motion").evaluate((element) => element.scrollTop),
    ).toBe(0);
  }

  // Computed smooth scrolling must not turn the survey's restoration into
  // an asynchronous animation after this synchronous measurement returns.
  await page.setContent(
    "<style>body{margin:0}.port{margin-top:100px;width:220px;height:100px;overflow:auto;scroll-behavior:smooth}button{display:block;width:200px;height:60px}</style>" +
      '<div class="port"><div style="height:90px"></div><button>Smooth owner control</button><div style="height:90px"></div></div>',
  );
  const smoothOwner = page.locator(".port");
  await smoothOwner.evaluate((element) => {
    element.scrollTo({ top: 20, behavior: "instant" });
  });
  const smoothSurvey = await page.evaluate(surveyReflow, 24);
  expect(smoothSurvey.lostControls).toEqual([]);
  expect(await smoothOwner.evaluate((element) => element.scrollTop)).toBe(20);

  // An inline link can have several line fragments. Revealing an oversized
  // horizontal edge must preserve the already-revealed complete vertical
  // extent; native inline reveal may target just the first fragment.
  await page.setContent(
    "<style>body{margin:0}.port{margin-top:100px;width:220px;height:200px;overflow:auto}a{font:20px/30px monospace}.wide{white-space:nowrap}</style>" +
      '<div class="port"><div style="height:190px"></div><a href="#target"><span class="wide">' +
      "Horizontal content ".repeat(8) +
      '</span><br>Second line<br>Third line</a><div style="height:200px"></div></div>',
  );
  const fragments = page.getByRole("link");
  const fragmentGeometry = await fragments.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    fragmentCount: element.getClientRects().length,
  }));
  expect(fragmentGeometry.width).toBeGreaterThan(WIDTH);
  expect(fragmentGeometry.height).toBeLessThan(200);
  expect(fragmentGeometry.fragmentCount).toBeGreaterThan(1);
  const fragmentSurvey = await page.evaluate(surveyReflow, 24);
  expect(fragmentSurvey.oversizedRecovered).toBe(1);
  expect(fragmentSurvey.lostControls).toEqual([]);
  expect(
    await page.locator(".port").evaluate((element) => element.scrollTop),
  ).toBe(0);
  expect(
    await page.locator(".port").evaluate((element) => element.scrollLeft),
  ).toBe(0);

  for (const display of ["inline", "contents"]) {
    await page.setContent(
      `<style>body{margin:0}span{display:${display};overflow:hidden}button{width:160px;height:60px}</style>` +
        "<span><button>Visible inline control</button></span>",
    );
    await expect(page.getByRole("button")).toBeInViewport({ ratio: 1 });
    const inlineSurvey = await page.evaluate(surveyReflow, 24);
    expect(inlineSurvey.initialOutside).toBe(0);
    expect(inlineSurvey.lostControls).toEqual([]);
  }

  for (const position of ["absolute", "fixed"]) {
    await page.setContent(
      `<style>body{margin:0}.clip{width:100px;height:100px;overflow:hidden}button{position:${position};top:200px;left:0;width:200px;height:60px}</style>` +
        '<div class="clip"><button>Escaped visible control</button></div>',
    );
    await expect(page.getByRole("button")).toBeInViewport({ ratio: 1 });
    const escapedSurvey = await page.evaluate(surveyReflow, 24);
    expect(escapedSurvey.initialOutside).toBe(0);
    expect(escapedSurvey.lostControls).toEqual([]);

    // These ancestors really are containing blocks, so overflow still
    // constrains the same out-of-flow button in the native browser.
    await page.locator(".clip").evaluate((element, value) => {
      element.style.position = value === "absolute" ? "relative" : "static";
      element.style.transform = value === "fixed" ? "translateX(0)" : "none";
    }, position);
    await expect(page.getByRole("button")).not.toBeInViewport();
    const containedSurvey = await page.evaluate(surveyReflow, 24);
    expect(containedSurvey.lostControls).toHaveLength(1);
  }

  // Blink exposes integer offset/client dimensions even when ordinary layout
  // has fractional pixels. A long scroll must not invent a CSS scale from that
  // rounding and stop just short of the existing half-pixel reveal boundary.
  await page.setContent(
    "<style>body{margin:0}.port{margin-top:112.984375px;width:220px;height:687.015625px;overflow:auto}button{display:block;width:200px;height:60px}</style>" +
      '<div class="port"><div style="height:6318.6px"></div><button>Fractional reachable control</button><div style="height:90px"></div></div>',
  );
  const fractionalOwner = page.locator(".port");
  const fractionalGeometry = await fractionalOwner.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    offsetHeight: (element as HTMLElement).offsetHeight,
    transform: getComputedStyle(element).transform,
  }));
  expect(fractionalGeometry.height).toBe(687.015625);
  expect(fractionalGeometry.offsetHeight).toBe(687);
  expect(fractionalGeometry.transform).toBe("none");
  const fractionalSurvey = await page.evaluate(surveyReflow, 24);
  expect(fractionalSurvey.initialOutside).toBe(1);
  expect(fractionalSurvey.recovered).toBe(1);
  expect(fractionalSurvey.lostControls).toEqual([]);
  expect(await fractionalOwner.evaluate((element) => element.scrollTop)).toBe(
    0,
  );
  await page.getByRole("button").focus();
  await expect(page.getByRole("button")).toBeFocused();
  await expect(page.getByRole("button")).toBeInViewport({ ratio: 1 });

  await page.setContent(
    "<style>body{margin:0}.port{width:100px;height:100px;overflow:auto;transform:scale(2);transform-origin:top left}button{display:block;width:80px;height:80px}</style>" +
      '<div class="port"><div style="height:50px"></div><button>Scaled reachable control</button><div style="height:50px"></div></div>',
  );
  const scaledOwner = page.locator(".port");
  const scaledSurvey = await page.evaluate(surveyReflow, 24);
  expect(scaledSurvey.initialOutside).toBe(1);
  expect(scaledSurvey.recovered).toBe(1);
  expect(scaledSurvey.lostControls).toEqual([]);
  expect(await scaledOwner.evaluate((element) => element.scrollTop)).toBe(0);
  await scaledOwner.hover();
  await page.mouse.wheel(0, 40);
  await expect
    .poll(() => scaledOwner.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(page.getByRole("button")).toBeInViewport({ ratio: 1 });

  // CSS individual scale, zoom and an ancestor matrix are real physical
  // scale sources too. Their composition must retain the same native owner.
  for (const [outer, own] of [
    ["transform:matrix(1.25,0,0,1.25,0,0)", "scale:1.6"],
    ["zoom:1.25", "transform:scale(1.6)"],
    ["scale:1.25", "zoom:1.6"],
  ]) {
    await page.setContent(
      `<style>body{margin:0}.outer{${outer};transform-origin:top left}.port{width:100px;height:100px;overflow:auto;${own};transform-origin:top left}button{display:block;width:80px;height:80px}</style>` +
        '<div class="outer"><div class="port"><div style="height:50px"></div><button>CSS scaled reachable control</button><div style="height:50px"></div></div></div>',
    );
    const owner = page.locator(".port");
    expect(
      await owner.evaluate((element) => element.getBoundingClientRect().height),
    ).toBe(200);
    const result = await page.evaluate(surveyReflow, 24);
    expect(result.initialOutside).toBe(1);
    expect(result.recovered).toBe(1);
    expect(result.lostControls).toEqual([]);
    expect(await owner.evaluate((element) => element.scrollTop)).toBe(0);
    await page.getByRole("button").focus();
    await expect(page.getByRole("button")).toBeFocused();
    await expect(page.getByRole("button")).toBeInViewport({ ratio: 1 });
  }

  await page.setContent(
    "<style>body{margin:0}.port{width:220px;height:200px;overflow-y:auto}button{display:block;width:200px;height:900px}</style>" +
      '<div class="port"><button>Window oversized control</button></div>',
  );
  const oversizedSurvey = await page.evaluate(surveyReflow, 24);
  expect(oversizedSurvey.oversizedRecovered).toBe(1);
  expect(oversizedSurvey.lostControls).toEqual([]);
  expect(
    await page.locator(".port").evaluate((element) => element.scrollTop),
  ).toBe(0);
});

test("原生滚动量具检查 nested hidden 与 auto 祖先的实际交集", async ({
  page,
}) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.setContent(
    "<style>body{margin:0}.clip{margin-top:200px;width:220px;height:80px;overflow:hidden}.port{height:140px;overflow-y:auto}button{display:block;width:200px;height:100px}</style>" +
      '<div class="clip"><div class="port"><div style="height:40px"></div><button>Nested clipped control</button><div style="height:40px"></div></div></div>',
  );
  const survey = await page.evaluate(surveyReflow, 24);
  expect(survey.lostControls).toHaveLength(1);
  expect(survey.oversizedRecovered).toBe(0);
});

for (const [name, base] of APPS) {
  test(`${name}: 登记表全部终态在 360px × 200% 文本下仍可达且无需页面横滚`, async ({
    browser,
  }) => {
    test.setTimeout(2_700_000);
    const failed: string[] = [];
    const horizontal: string[] = [];
    const lost: string[] = [];
    const clipped: string[] = [];
    const droppedDialogs: string[] = [];
    const widths = new Set<number>();
    const rootSizes = new Set<number>();
    const scannedStates: string[] = [];
    let scanned = 0;
    let initialOutside = 0;
    let routesSeen = 0;
    let routesMoved = 0;
    let recovered = 0;
    let clippingBoxes = 0;
    let clippedAwaySkips = 0;
    let nativeTextInputSkips = 0;

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
          const dialogsBefore = await page
            .locator('[role="dialog"],[role="alertdialog"]')
            .count();
          const height = page.viewportSize()!.height;
          await page.setViewportSize({ width: WIDTH, height });
          await page.addStyleTag({
            content: `html{font-size:${ROOT_PX}px !important}`,
          });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const dialogsAfter = await page
            .locator('[role="dialog"],[role="alertdialog"]')
            .count();
          if (dialogsAfter < dialogsBefore)
            droppedDialogs.push(`${key}: ${dialogsBefore}→${dialogsAfter}`);

          const survey = await page.evaluate(surveyReflow, 24);
          widths.add(survey.width);
          rootSizes.add(survey.rootPx);
          initialOutside += survey.initialOutside;
          routesSeen += survey.routesSeen;
          routesMoved += survey.routesMoved;
          recovered += survey.recovered;
          clippingBoxes += survey.clippingBoxes;
          clippedAwaySkips += survey.clippedAwaySkips;
          nativeTextInputSkips += survey.nativeTextInputSkips;
          if (survey.documentOverflowX > 1)
            horizontal.push(
              `${key}: document 横向溢出 ${survey.documentOverflowX}px`,
            );
          for (const row of survey.nonDeliberateHorizontalScrollers)
            horizontal.push(`${key}: 非预期横滚 ${row}`);
          for (const row of survey.lostControls) lost.push(`${key}: ${row}`);
          for (const row of survey.unreachableClips)
            clipped.push(`${key}: ${row}`);
          scanned += 1;
          scannedStates.push(`${scenario.id}#${state.id}`);
        } catch (error) {
          failed.push(`${key}: ${String(error).split("\n")[0]?.slice(0, 120)}`);
        } finally {
          await context.close();
        }
      }

    console.info(
      `[combined-reflow] ${name} scanned=${scanned} initialOutside=${initialOutside} ` +
        `recovered=${recovered} routesSeen=${routesSeen} routesMoved=${routesMoved} ` +
        `clippingBoxes=${clippingBoxes} clippedAwaySkips=${clippedAwaySkips} ` +
        `nativeTextInputSkips=${nativeTextInputSkips} ` +
        `horizontal=${horizontal.length} lost=${lost.length} clipped=${clipped.length} ` +
        `droppedDialogs=${JSON.stringify(droppedDialogs)}`,
    );
    console.info(`[combined-horizontal] ${name} ${JSON.stringify(horizontal)}`);
    console.info(`[combined-lost] ${name} ${JSON.stringify(lost)}`);
    console.info(`[combined-clipped] ${name} ${JSON.stringify(clipped)}`);
    expect(failed, "这些终态没有走到位，组合轴探针空转").toEqual([]);
    expect(EXPECTED_STATES.length, "登记表不能空转").toBeGreaterThan(0);
    expect(scanned).toBe(EXPECTED_STATES.length);
    expect(stateCoverageFailures(EXPECTED_STATES, scannedStates)).toEqual({
      missing: [],
      unexpected: [],
      duplicateExpected: [],
      duplicateScans: [],
    });
    expect([...widths], "360px 没有稳定落地").toEqual([WIDTH]);
    expect([...rootSizes], "200% 根字号没有稳定落地").toEqual([ROOT_PX]);
    expect(initialOutside, "没有命中任何需要滚动恢复的控件").toBeGreaterThan(0);
    expect(routesSeen, "没有找到任何合法滚动路径").toBeGreaterThan(0);
    expect(routesMoved, "合法滚动路径一次都没有移动").toBeGreaterThan(0);
    expect(
      recovered,
      "没有控件被滚回视口，量具缺少真实阳性样本",
    ).toBeGreaterThan(0);
    expect(clippingBoxes, "没有命中任何裁剪盒，量具空转").toBeGreaterThan(0);
    expect(clippedAwaySkips, "读屏器专用裁剪分支一次都没命中").toBeGreaterThan(
      0,
    );
    expect(
      nativeTextInputSkips,
      "原生单行输入值视口分支一次都没命中",
    ).toBeGreaterThan(0);
    expect(droppedDialogs, "组合轴切换导致已打开的对话框消失").toEqual([]);
    expect(
      horizontal,
      "组合轴出现页面横滚或非预期内层横滚；表格与 pre 已按既有契约排除",
    ).toEqual([]);
    expect(lost, "组合轴下这些交互控件无法完整滚进视口").toEqual([]);
    expect(clipped, "组合轴下这些被裁内容没有合法滚动路径").toEqual([]);
  });
}
