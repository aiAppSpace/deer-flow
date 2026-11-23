import { expect, test } from "./support/test";

import { surveyOverlayGeometry } from "./support/overlay-survey";

const fixture = `
  <style>
    body { margin: 0; }
    #composer { position: relative; margin: 100px 20px 0; width: 300px; height: 120px; }
    textarea { height: 20px; }
    #popup { position: absolute; top: 100%; margin-top: 8px; width: 300px; }
    [data-testid=mention-picker] { padding: 8px; background: white; border: 1px solid; }
    #header { height: 40px; }
    #options { height: 60px; }
    #footer { height: 100px; }
  </style>
  <div id="composer">
    <textarea aria-controls="options"></textarea>
    <div id="popup">
      <div data-testid="mention-picker">
        <div id="header">Add a reference</div>
        <div id="options" role="listbox" aria-multiselectable="true">
          <button role="option">Research</button>
        </div>
        <div id="footer">Reference instructions</div>
      </div>
    </div>
  </div>`;

test("reference options use their real popup/composer geometry without changing the gap limit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.setContent(fixture);
  const rawGap = await page.evaluate(() => {
    const options = document.querySelector("#options")!.getBoundingClientRect();
    const input = document.querySelector("textarea")!.getBoundingClientRect();
    return options.top - input.bottom;
  });
  expect(rawGap).toBeGreaterThan(64);
  expect(await page.evaluate(surveyOverlayGeometry, 64)).toMatchObject({
    count: 1,
    bad: [],
  });
  await page.getByRole("option", { name: "Research" }).click({ trial: true });
});

test("an ordinary listbox or an invalid reference structure retains the original trigger geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const change of [
    "#popup { position: static; margin-top: 120px; }",
    "#composer { position: static; }",
  ]) {
    await page.setContent(`${fixture}<style>${change}</style>`);
    expect((await page.evaluate(surveyOverlayGeometry, 64)).bad).toEqual([
      expect.stringContaining("离触发器"),
    ]);
  }
  await page.setContent(fixture.replace('data-testid="mention-picker"', ""));
  expect((await page.evaluate(surveyOverlayGeometry, 64)).bad).toEqual([
    expect.stringContaining("离触发器"),
  ]);
  await page.setContent(
    fixture.replace('aria-controls="options"', "") +
      '<textarea aria-controls="options" style="position:absolute;top:100px"></textarea>',
  );
  expect((await page.evaluate(surveyOverlayGeometry, 64)).bad).toEqual([
    expect.stringContaining("离触发器"),
  ]);
});

test("a real reference popup still fails for anchor drift, viewport overflow and a hidden controller", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [style, failure] of [
    ["#popup { margin-top: 80px; }", "离触发器 80px"],
    ["#popup { margin-top: 700px; }", "跑出视口"],
    ["textarea { display: none; }", "触发器不可见了"],
  ] as const) {
    await page.setContent(`${fixture}<style>${style}</style>`);
    expect((await page.evaluate(surveyOverlayGeometry, 64)).bad).toEqual([
      expect.stringContaining(failure),
    ]);
  }
});
