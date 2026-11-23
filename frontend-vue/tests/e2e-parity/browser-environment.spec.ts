import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  keyboardTraversalCycle,
  walkKeyboardTraversal,
} from "./support/keyboard-focus";
import { expect, test } from "./support/test";

const url = "http://localhost/parity-browser-environment";

for (const language of ["en-US", "zh-CN"]) {
  for (const key of ["Tab", "Shift+Tab"]) {
    test(`native browser focus returns from an opaque frame: ${language} ${key}`, async ({
      page,
    }) => {
      await page.route(url, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html lang="${language}"><body><button>First</button><iframe title="Preview" sandbox="allow-scripts allow-forms"></iframe></body></html>`,
        }),
      );
      await page.goto(url);
      await page.evaluate((lang) => {
        document.querySelector("iframe")!.src = URL.createObjectURL(
          new Blob(
            [
              `<!doctype html><html lang="${lang}"><body tabindex="0"><h1>Report</h1></body></html>`,
            ],
            { type: "text/html" },
          ),
        );
      }, language);
      await expect(page.frameLocator("iframe").locator("h1")).toHaveText(
        "Report",
      );
      await page.getByRole("button", { name: "First" }).focus();
      const walk = await walkKeyboardTraversal(page, key, 60, true);
      expect(keyboardTraversalCycle(walk)).toBeDefined();
      for (const descriptor of ['button"First"', 'iframe"Preview"'])
        expect(
          walk.sequence.filter((stop) => stop.descriptor === descriptor).length,
        ).toBeGreaterThan(2);
      expect(
        walk.sequence.slice(-10).every((stop) => stop.identity === "(body)"),
      ).toBe(false);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("iframe")).toHaveAttribute(
        "sandbox",
        "allow-scripts allow-forms",
      );
    });
  }
}

test("browser preferences do not share test cookies or local storage", async ({
  browser,
}) => {
  const first = await browser.newContext(PARITY_CONTEXT_OPTIONS);
  const second = await browser.newContext(PARITY_CONTEXT_OPTIONS);
  try {
    for (const context of [first, second])
      await context.route(url, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Isolation</title>",
        }),
      );
    const firstPage = await first.newPage();
    await firstPage.goto(url);
    await firstPage.evaluate(() => {
      document.cookie = "parity_owner=first; path=/";
      localStorage.setItem("parity_owner", "first");
    });
    const secondPage = await second.newPage();
    await secondPage.goto(url);
    expect(await second.cookies()).toEqual([]);
    expect(
      await secondPage.evaluate(() => localStorage.getItem("parity_owner")),
    ).toBeNull();
    expect(await first.cookies()).toEqual([
      expect.objectContaining({ name: "parity_owner", value: "first" }),
    ]);
    await first.close();
    expect(await secondPage.title()).toBe("Isolation");
  } finally {
    await first.close();
    await second.close();
  }
});
