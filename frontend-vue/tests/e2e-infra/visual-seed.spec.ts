/*
  【文件职责】     冻结 Button 在 light/dark 的可重复视觉种子。
  【架构位置】     测试
  【主要导出】     @visual-seed cases
  【依赖关系】     使用隔离的 /__m0/visual 页面
  【边界与注意】   固定 viewport、locale、motion；产物写进本次运行的 outputPath，
                   不能硬编码 test-results/m0：那是 playwright.m0.config.ts 的
                   outputDir，同一条 e2e-m0 里后跑的 splitpanes 会把它清空。
                   Button 带 transition-all，主题切换会让颜色在 150ms 内插值：
                   reducedMotion 只设置媒体查询，main.css 没有对应规则，所以必须
                   显式停掉 transition/animation，否则读到的是过渡中间值、截图也
                   不可重复。
*/

import { expect, test } from "@playwright/test";

/*
  `reducedMotion` 在 `use` **顶层不是选项**（Playwright 1.59 的 PlaywrightTestOptions
  里没有这个键），写在那里会被安静忽略；只有 contextOptions 这条路真的传到页面上。
  实测见 tests/e2e-parity/support/context-options.ts 的文件头。
*/
test.use({
  viewport: { width: 1440, height: 900 },
  contextOptions: { reducedMotion: "reduce" },
});

/** Freeze every transition/animation so computed styles and screenshots are at rest. */
const FREEZE_MOTION = `*, *::before, *::after {
  transition: none !important;
  animation: none !important;
}`;

test("@visual-seed compares React reference and Vue Button in light and dark", async ({
  page,
}, testInfo) => {
  const seed = async (
    name: string,
    target: ReturnType<typeof page.locator>,
  ) => {
    const path = testInfo.outputPath(name);
    await target.screenshot({ path });
    await testInfo.attach(name, { path, contentType: "image/png" });
  };

  await page.goto("/__m0/visual");
  await page.addStyleTag({ content: FREEZE_MOTION });
  const fixture = page.locator("[data-m0-visual]");
  await expect(fixture).toBeVisible();

  const reference = page.locator("[data-react-reference]");
  const vueButton = page.locator("[data-slot=button]").first();
  const [referenceBox, vueBox] = await Promise.all([
    reference.boundingBox(),
    vueButton.boundingBox(),
  ]);
  expect(referenceBox?.height).toBe(vueBox?.height);

  const PROPERTIES = [
    "backgroundColor",
    "color",
    "borderRadius",
    "fontSize",
    "fontWeight",
    "paddingInline",
  ] as const;

  /** Read the whole property set in one page call so nothing can drift mid-read. */
  const computed = (locator: typeof reference) =>
    locator.evaluate((node, properties) => {
      const style = getComputedStyle(node);
      return Object.fromEntries(
        properties.map((property) => [property, style[property]]),
      );
    }, PROPERTIES);

  const assertParity = async (theme: string) => {
    expect(
      await computed(reference),
      `Button parity drifted in ${theme}`,
    ).toEqual(await computed(vueButton));
  };

  await assertParity("light");
  await seed("button-light.png", fixture);

  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await assertParity("dark");
  await seed("button-dark.png", fixture);
});
