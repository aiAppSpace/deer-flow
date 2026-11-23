import { expect, test } from "./support/test";
import {
  buildMarkdownUpdateComponent,
  type MarkdownUpdateApp,
} from "./support/markdown-update";

const scripts = new Map<MarkdownUpdateApp, string>();
test.beforeAll(async () => {
  for (const app of ["react", "vue"] as const)
    scripts.set(app, await buildMarkdownUpdateComponent(app));
});

for (const app of ["react", "vue"] as const) {
  for (const [kind, before, target] of [
    ["paragraph", "Sunny", "p"],
    ["table", "| Weather |\n| --- |\n| Sunny |", "td"],
  ] as const) {
    test(`${app}: same-length ${kind} replacement reaches the actual Markdown DOM`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setContent('<div id="fixture"></div>');
      await page.evaluate(
        (value) => Reflect.set(window, "__initialMarkdown", value),
        before,
      );
      await page.addScriptTag({ content: scripts.get(app)! });
      await expect(page.locator("html")).toHaveAttribute(
        "data-markdown-ready",
        "true",
      );
      const cell = page.locator(`#fixture ${target}`).first();
      await expect(cell).toHaveText("Sunny");
      await cell.evaluate((node) =>
        Reflect.set(window, "__originalMarkdownNode", node),
      );
      const after = before.replace("Sunny", "Rainy");
      expect(after).toHaveLength(before.length);
      await page.evaluate(
        (value) =>
          document.dispatchEvent(
            new CustomEvent("markdown:replace", { detail: value }),
          ),
        after,
      );
      await expect(cell).toHaveText("Rainy");
      expect(
        await cell.evaluate(
          (node) => node === Reflect.get(window, "__originalMarkdownNode"),
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
      await testInfo.attach(`${app}-${kind}-updated`, {
        body: await page.locator("#fixture").screenshot(),
        contentType: "image/png",
      });
    });
  }
}
