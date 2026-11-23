import { expect, test } from "./support/test";

import {
  keyboardTraversalCycle,
  walkKeyboardTraversal,
} from "./support/keyboard-focus";

for (const [name, html, stops] of [
  ["ordinary document", "<button>A</button><button>B</button>", 2],
  [
    "terminal read-only frame",
    '<button>A</button><iframe title="Preview" srcdoc="<p>Read-only report</p>"></iframe>',
    2,
  ],
  [
    "frame between document controls",
    '<button>A</button><iframe title="Preview" srcdoc="<p>Read-only report</p>"></iframe><button>B</button>',
    3,
  ],
] as const) {
  for (const key of ["Tab", "Shift+Tab"])
    test(`native browser boundary: ${name}, ${key}`, async ({ page }) => {
      await page.setContent(`<!doctype html><body>${html}</body>`);
      if (html.includes("iframe"))
        await expect(page.frameLocator("iframe").locator("body")).toBeVisible();
      const walk = await walkKeyboardTraversal(page, key, 60, true);
      expect(walk.capacityChanged).toBe(false);
      expect(keyboardTraversalCycle(walk)).toBeDefined();
      expect(
        new Set(
          walk.sequence
            .filter((stop) => stop.identity !== "(body)")
            .map((stop) => stop.identity),
        ).size,
      ).toBe(stops);
    });
}

test("native browser boundary still rejects a real keyboard trap", async ({
  page,
}) => {
  await page.setContent("<button>Stuck</button><button>Unreachable</button>");
  await page.getByRole("button", { name: "Stuck", exact: true }).focus();
  await page.evaluate(() => {
    document.querySelector("button")!.addEventListener("keydown", (event) => {
      if (event.key === "Tab") event.preventDefault();
    });
  });
  const walk = await walkKeyboardTraversal(page, "Tab", 60, true);
  expect(walk.capacityChanged).toBe(false);
  expect(keyboardTraversalCycle(walk)).toBeUndefined();
  expect(
    walk.sequence.every((stop) => stop.descriptor === 'button"Stuck"'),
  ).toBe(true);
});
