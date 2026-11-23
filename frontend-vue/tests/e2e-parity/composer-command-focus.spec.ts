import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  test(`${app}: slash options keep keyboard ownership in the textbox across reverse Tab`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      const scenario = PARITY_SCENARIOS.find((item) => item.id === "sidebar")!;
      await runScenario(
        page,
        base,
        scenario,
        DEFAULT_DIMENSION,
        scenarioStates(scenario)[0]!,
        30_000,
      );
      const input = page.locator("textarea");
      const list = page.getByRole("listbox");
      await expect(list).toBeVisible();
      const originalList = await list.elementHandle();
      const options = list.getByRole("option");
      expect(await options.count()).toBeGreaterThan(1);
      for (const option of await options.all())
        await expect(option).toHaveAttribute("tabindex", "-1");
      await expect(input).toHaveAttribute(
        "aria-controls",
        (await list.getAttribute("id"))!,
      );
      const first = await input.getAttribute("aria-activedescendant");
      await page.keyboard.press("ArrowDown");
      const second = await input.getAttribute("aria-activedescendant");
      expect(second).toBeTruthy();
      expect(second).not.toBe(first);
      // The actual active option, not a second hidden selection, owns completion.
      const active = list.locator('[aria-selected="true"]');
      await expect(active).toHaveAttribute("id", second!);
      const command = (await active.innerText()).split("\n")[0]!.trim();
      await page.keyboard.press("Shift+Tab");
      await expect(input).not.toBeFocused();
      expect(
        await page.evaluate(
          () => document.activeElement !== document.body && document.hasFocus(),
        ),
      ).toBe(true);
      await expect(list).toBeHidden();
      // Hidden presentation does not destroy the list while this slash query lives.
      expect(await originalList!.evaluate((node) => node.isConnected)).toBe(
        true,
      );
      await page.keyboard.press("Tab");
      await expect(input).toBeFocused();
      await expect(list).toBeVisible();
      expect(
        await list.evaluate((node, old) => node === old, originalList),
      ).toBe(true);
      await page.keyboard.press("Tab");
      await expect(input).toBeFocused();
      await expect(input).toHaveValue(`${command} `);
    } finally {
      await context.close();
    }
  });
}
