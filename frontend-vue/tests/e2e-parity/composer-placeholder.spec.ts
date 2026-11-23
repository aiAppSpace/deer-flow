import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  PARITY_SCENARIOS,
  runScenario,
  type ParityScenario,
} from "./support/scenarios";

const APPS = [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const;

for (const id of ["sidebar", "agent-chat"] as const)
  for (const theme of ["light", "dark"] as const)
    test(`${id}/${theme}: the empty native composer paints its placeholder like React`, async ({
      browser,
    }, testInfo) => {
      const registered = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
      const scenario: ParityScenario = {
        ...registered,
        settle: [
          {
            kind: "visible",
            target: { role: "textbox", name: /how can i assist you/i },
          },
        ],
      };
      const observations: Record<string, unknown> = {};
      for (const [app, base] of APPS) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await runScenario(
            page,
            base,
            scenario,
            { locale: "en-US", viewport: "desktop", theme },
            { id: "welcome-placeholder", steps: [] },
          );
          const textarea = page.getByRole("textbox", {
            name: /how can i assist you/i,
          });
          await expect(textarea).toBeVisible();
          await expect(textarea).toHaveValue("");
          await expect(textarea).toHaveAttribute("placeholder", /\S/);
          observations[app] = await textarea.evaluate((element) => {
            const style = getComputedStyle(element, "::placeholder");
            // Compare actual painted colors, independent of whether the two
            // frameworks serialize the same color as lab, oklch or color-mix.
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const paint = canvas.getContext("2d")!;
            paint.fillStyle = style.color;
            paint.fillRect(0, 0, 1, 1);
            return {
              color: [...paint.getImageData(0, 0, 1, 1).data],
              opacity: style.opacity,
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
            };
          });
          expect(errors).toEqual([]);
          await testInfo.attach(`${app}-empty-composer.png`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
        } finally {
          await context.close();
        }
      }
      await testInfo.attach("placeholder-comparison.json", {
        body: JSON.stringify(observations, null, 2),
        contentType: "application/json",
      });
      expect(observations.vue).toEqual(observations.react);
    });
