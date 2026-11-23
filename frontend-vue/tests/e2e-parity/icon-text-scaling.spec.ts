import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

function renderedIconSizes() {
  return Array.from(document.querySelectorAll<SVGSVGElement>("svg.lucide"))
    .filter((icon) => {
      if (
        !icon.getBoundingClientRect().width ||
        !icon.getBoundingClientRect().height
      )
        return false;
      for (
        let element: Element | null = icon;
        element;
        element = element.parentElement
      ) {
        const style = getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        )
          return false;
      }
      return true;
    })
    .map((icon) => {
      const shape = Array.from(icon.children).map((element) =>
        [
          element.tagName,
          Array.from(element.attributes)
            .filter((a) => a.name !== "class")
            .map((a) => `${a.name}=${a.value}`)
            .sort()
            .join(";"),
        ].join(":"),
      );
      const bounds = icon.getBoundingClientRect();
      return {
        shape: shape.join("|"),
        width: bounds.width,
        height: bounds.height,
      };
    })
    .sort(
      (a, b) =>
        a.shape.localeCompare(b.shape) ||
        a.width - b.width ||
        a.height - b.height,
    );
}

for (const scenarioId of [
  "sidebar",
  "sidecar-chat",
  "thread-todos",
  "workspace-changes",
]) {
  for (const rootPx of [16, 32]) {
    test(`rendered icons retain React sizing in ${scenarioId} at root ${rootPx}`, async ({
      browser,
    }, testInfo) => {
      const scenario = PARITY_SCENARIOS.find((item) => item.id === scenarioId)!;
      const state =
        scenarioId === "workspace-changes"
          ? { id: "closed", steps: [] }
          : scenarioStates(scenario)[0]!;
      const rows = [];
      for (const [app, base] of [
        ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
        ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
      ] as const) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          await runScenario(page, base, scenario, DEFAULT_DIMENSION, state);
          await page.evaluate((px) => {
            document.documentElement.style.fontSize = `${px}px`;
          }, rootPx);
          await page.evaluate(() => document.fonts.ready);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          rows.push({ app, icons: await page.evaluate(renderedIconSizes) });
          await testInfo.attach(`${app}-icons`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
        } finally {
          await context.close();
        }
      }
      await testInfo.attach("icon-measurements", {
        body: JSON.stringify(rows, null, 2),
        contentType: "application/json",
      });
      expect(rows[0]!.icons.length).toBeGreaterThan(10);
      expect(rows[1]!.icons).toEqual(rows[0]!.icons);
    });
  }
}
