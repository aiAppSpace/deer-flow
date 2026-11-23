import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

for (const [app, base] of [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const) {
  for (const rootPx of [16, 32]) {
    test(`${app}: side-chat empty content stays within its own body at root ${rootPx}`, async ({
      browser,
    }, testInfo) => {
      const scenario = PARITY_SCENARIOS.find(
        (item) => item.id === "sidecar-chat",
      )!;
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        await runScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          scenarioStates(scenario)[0]!,
        );
        await page.evaluate((px) => {
          document.documentElement.style.fontSize = `${px}px`;
        }, rootPx);
        await page.evaluate(() => document.fonts.ready);
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const heading = page.getByRole("heading", {
          name: "Ask a follow-up",
          exact: true,
        });
        const initial = await heading.evaluate((node) => {
          const body = node.parentElement!.parentElement!;
          const rect = body.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            firstTop: body.firstElementChild!.getBoundingClientRect().top,
            scrollHeight: body.scrollHeight,
            clientHeight: body.clientHeight,
          };
        });
        await testInfo.attach(`${app}-empty-initial`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
        expect.soft(initial.firstTop).toBeGreaterThanOrEqual(initial.top);
        const end = await heading.evaluate((node) => {
          const body = node.parentElement!.parentElement!;
          body.scrollTop = body.scrollHeight;
          return {
            bottom: body.getBoundingClientRect().bottom,
            descriptionBottom: body.querySelector("p")!.getBoundingClientRect()
              .bottom,
            scrollTop: body.scrollTop,
          };
        });
        await testInfo.attach("empty-capacity", {
          body: JSON.stringify({ initial, end }, null, 2),
          contentType: "application/json",
        });
        expect(end.descriptionBottom).toBeLessThanOrEqual(end.bottom);
      } finally {
        await context.close();
      }
    });
  }
}
