import { expect, test, type Page } from "./support/test";

import {
  captureScenario,
  normalizeRequestBody,
  sampleGeometry,
} from "./support/capture";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { reactAppPresent } from "./support/react-preview";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  scenarioStates,
  locateTarget,
  runScenario,
} from "./support/scenarios";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

/*
  取样稳定性的**测量**，不是偏好。请求序列如果两次一致，将来就可以把判据从
  多重集收紧成顺序；不一致的话，收紧只会得到一份随机变红的门禁。
  这里如实把测量结果留在报告里，而不是先假设一个答案。
*/
test("同一应用两次取样的请求序列", async ({ browser }) => {
  test.setTimeout(180_000);
  const scenario = PARITY_SCENARIOS[0]!;
  const samples: Record<string, string[][]> = {};

  for (const [name, base] of [
    ["vue", VUE_APP],
    ["react", REACT_APP],
  ] as const) {
    samples[name] = [];
    for (let round = 0; round < 2; round++) {
      const roundContext = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await roundContext.newPage();
      const capture = await captureScenario(
        page,
        base,
        scenario,
        DEFAULT_DIMENSION,
        scenarioStates(scenario)[0]!,
      );
      samples[name]!.push(capture.requests);
      await roundContext.close();
    }
  }

  for (const [name, rounds] of Object.entries(samples)) {
    expect(
      rounds[1],
      `${name} 两次取样的请求序列不同：顺序判据在收紧之前必须先稳定。`,
    ).toEqual(rounds[0]);
  }
});

/*
  几何取样只量布局、不量滚动状态——这条判据由这里实测，不由 capture.ts 的注释保证。

  这个场景是选出来的，不是随手挑的：它的锚点在 stick-to-bottom 的会话流里，是全部
  34 个样本中取样时刻**滚动量最大**的一个——实测 React 侧那条流被滚了 32~81px 不等
  （连跑五次量到 75/76/76/75/33），Vue 侧那条流没溢出、恒为 0；其余样本里最大的
  滚动量只有 artifact 面板那 1px。用没滚动的场景写这条用例会恒绿，也就什么都没测。

  所以还要断言这次实验真的把锚点挪动过：滚到顶与滚到底的**视口**坐标必须不同。
  否则哪天两边都不再溢出，这条用例会安静地退化成一句空话，而不是红。
*/
const SCROLL_INVARIANT_SCENARIO = "thread-history-mermaid";

async function scrollEverything(page: Page, where: "top" | "bottom") {
  await page.evaluate((target) => {
    for (const node of document.querySelectorAll("*")) {
      if (node.scrollHeight > node.clientHeight)
        node.scrollTop = target === "top" ? 0 : node.scrollHeight;
      if (node.scrollWidth > node.clientWidth)
        node.scrollLeft = target === "top" ? 0 : node.scrollWidth;
    }
    globalThis.scrollTo(0, target === "top" ? 0 : document.body.scrollHeight);
  }, where);
  // 贴底的容器会在下一帧回弹，等它落定再量。
  await page.waitForTimeout(200);
}

test("锚点的几何与滚到哪里无关", async ({ browser }) => {
  test.setTimeout(180_000);
  const scenario = PARITY_SCENARIOS.find(
    (entry) => entry.id === SCROLL_INVARIANT_SCENARIO,
  );
  expect(scenario, `场景目录里没有 ${SCROLL_INVARIANT_SCENARIO}`).toBeDefined();
  const anchor = scenario!.settle.find((step) => step.kind === "visible");
  expect(anchor, "这个场景没有可见锚点，量不了几何").toBeDefined();

  let moved = false;
  for (const [name, base] of [
    ["vue", VUE_APP],
    ["react", REACT_APP],
  ] as const) {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page: Page = await context.newPage();
    const state = scenarioStates(scenario!)[0]!;
    await runScenario(page, base, scenario!, DEFAULT_DIMENSION, state);
    await page.waitForTimeout(700);

    const locator = locateTarget(page, anchor!.target).first();
    const viewportY = () =>
      locator.evaluate(
        (element) => Math.round(element.getBoundingClientRect().y * 10) / 10,
      );

    await scrollEverything(page, "top");
    const atTop = await sampleGeometry(page, scenario!, state);
    const viewportAtTop = await viewportY();

    await scrollEverything(page, "bottom");
    const atBottom = await sampleGeometry(page, scenario!, state);
    const viewportAtBottom = await viewportY();

    if (viewportAtTop !== viewportAtBottom) moved = true;
    expect(
      atBottom,
      `${name} 的锚点几何随滚动位置变了：取样量到的是滚动状态，不是布局。`,
    ).toEqual(atTop);
    await context.close();
  }

  expect(
    moved,
    `两个应用滚到顶与滚到底时锚点都没动过：${SCROLL_INVARIANT_SCENARIO} 已经不再有` +
      `被滚动的容器，这条用例现在是空的，得换一个真会滚的场景。`,
  ).toBe(true);
});

test("multipart observation retains native binary payloads and removes only random delimiters", async ({
  page,
}, testInfo) => {
  await page.route("https://multipart.example.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<main>Multipart observation</main>",
    }),
  );
  await page.goto("https://multipart.example.test/");
  const samples: {
    contentType: string;
    rawBase64: string;
    canonical: string;
  }[] = [];
  for (const bytes of [
    [0, 255, 128, 10],
    [0, 255, 128, 10],
    [0, 254, 128, 10],
  ]) {
    const [request] = await Promise.all([
      page.waitForRequest((request) => request.method() === "POST"),
      page.evaluate(async (bytes) => {
        const data = new FormData();
        data.append(
          "file",
          new File([new Uint8Array(bytes)], "sample.bin", {
            type: "application/octet-stream",
          }),
        );
        data.append("scope", "project");
        await fetch("/api/parity-upload", { method: "POST", body: data });
      }, bytes),
    ]);
    const contentType = request.headers()["content-type"]!;
    const raw = request.postDataBuffer()!;
    samples.push({
      contentType,
      rawBase64: raw.toString("base64"),
      canonical: normalizeRequestBody(raw, new Set(), contentType),
    });
  }
  expect(samples[0]!.contentType).not.toBe(samples[1]!.contentType);
  expect(samples[0]!.rawBase64).not.toBe(samples[1]!.rawBase64);
  expect(samples[0]!.canonical).toBe(samples[1]!.canonical);
  expect(samples[0]!.canonical).not.toBe(samples[2]!.canonical);
  await testInfo.attach("actual-multipart-bodies", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
});

for (const contained of [false, true]) {
  test(`fixed anchor geometry respects its actual containing block (transformed=${contained})`, async ({
    page,
  }) => {
    await page.setContent(`
      <style>body {margin:0; height:4000px} #host {margin-top:300px; height:400px; overflow:auto; ${contained ? "transform:translateZ(0);" : ""}}
      #overlay {position:fixed;top:40px;left:20px;width:200px;height:150px;overflow:auto}
      #anchor {display:block; margin-top:100px; width:80px;height:30px}
      .space {height:800px}</style>
      <div id="host"><div id="overlay"><button id="anchor">Anchor</button><div class="space"></div></div><div class="space"></div></div>`);
    const scenario = {
      ...PARITY_SCENARIOS[0]!,
      settle: [{ kind: "visible" as const, target: { selector: "#anchor" } }],
    };
    const state = { ...scenarioStates(scenario)[0]!, steps: [] };
    const before = await sampleGeometry(page, scenario, state);
    const initialViewport = await page.locator("#anchor").boundingBox();
    await page.evaluate(() => {
      window.scrollTo(0, 200);
      document.querySelector("#overlay")!.scrollTop = 50;
    });
    expect(await page.evaluate(() => window.scrollY)).toBe(200);
    expect(
      await page.locator("#overlay").evaluate((node) => node.scrollTop),
    ).toBe(50);
    const after = await sampleGeometry(page, scenario, state);
    const laterViewport = await page.locator("#anchor").boundingBox();
    expect(initialViewport!.y).not.toBe(laterViewport!.y);
    expect(after["selector:#anchor"]!.y).toBe(before["selector:#anchor"]!.y);
    expect(after["selector:#anchor"]!.x).toBe(before["selector:#anchor"]!.x);
    // Negative control: a real 20px movement must still be visible to the ruler.
    await page
      .locator("#overlay")
      .evaluate((node) => ((node as HTMLElement).style.top = "60px"));
    const moved = await sampleGeometry(page, scenario, state);
    expect(moved["selector:#anchor"]!.y - after["selector:#anchor"]!.y).toBe(
      20,
    );
  });
}
