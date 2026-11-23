import { expect, test } from "./support/test";

import { sampleGeometry, targetLabel } from "./support/capture";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { tooltipPresentationVisible } from "./support/tooltip-presentation";

// The observation must reject a different trigger, hidden description only,
// incorrect painted text and invisible content, while accepting both native
// open timing states. These controls test the measuring predicate itself.
test("tooltip presentation measures its owner's painted content", async ({
  page,
}) => {
  const cases: Array<[string, boolean, () => void]> = [
    ["delayed-open remains valid", true, () => {}],
    [
      "instant-open remains valid",
      true,
      () => {
        document
          .querySelectorAll("[data-state]")
          .forEach((node) => node.setAttribute("data-state", "instant-open"));
      },
    ],
    [
      "closed trigger cannot borrow another open tooltip",
      false,
      () => {
        document
          .querySelector<HTMLElement>("#trigger")!
          .setAttribute("data-state", "closed");
        document.body.insertAdjacentHTML(
          "beforeend",
          '<button data-slot="tooltip-trigger" data-state="delayed-open">Other</button>',
        );
      },
    ],
    [
      "hidden description alone is insufficient",
      false,
      () => {
        document
          .querySelector<HTMLElement>("#popup")!
          .removeAttribute("data-slot");
      },
    ],
    [
      "missing description is rejected",
      false,
      () => {
        document
          .querySelector<HTMLElement>("#trigger")!
          .setAttribute("aria-describedby", "absent");
      },
    ],
    [
      "wrong description is rejected",
      false,
      () => {
        document.querySelector<HTMLElement>("#description")!.textContent =
          "Different action";
      },
    ],
    [
      "wrong painted text cannot borrow a correct hidden description",
      false,
      () => {
        document.querySelector<HTMLElement>("#popup")!.firstChild!.textContent =
          "Different action";
      },
    ],
    [
      "closed popup is rejected",
      false,
      () => {
        document
          .querySelector<HTMLElement>("#popup")!
          .setAttribute("data-state", "closed");
      },
    ],
    [
      "display-none popup is rejected",
      false,
      () => {
        document.querySelector<HTMLElement>("#popup")!.style.display = "none";
      },
    ],
    [
      "transparent popup is rejected",
      false,
      () => {
        document.querySelector<HTMLElement>("#popup")!.style.opacity = "0";
      },
    ],
    [
      "transparent ancestor is rejected",
      false,
      () => {
        document.querySelector<HTMLElement>("#layer")!.style.opacity = "0";
      },
    ],
    [
      "partially faded popup is not a settled state",
      false,
      () => {
        document.querySelector<HTMLElement>("#popup")!.style.opacity = "0.5";
      },
    ],
    [
      "offscreen popup is rejected",
      false,
      () => {
        document.querySelector<HTMLElement>("#popup")!.style.left =
          `${window.innerWidth + 1}px`;
      },
    ],
  ];
  for (const [name, expected, mutate] of cases) {
    await page.setContent(`<!doctype html><style>
      body { margin: 0; font: 16px sans-serif; }
      #trigger { position: absolute; left: 100px; top: 100px; }
      #popup { position: fixed; left: 100px; top: 50px; padding: 6px; background: black; color: white; }
      #description { position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0); }
    </style><button id="trigger" aria-label="Branch conversation" aria-describedby="description" data-slot="tooltip-trigger" data-state="delayed-open">Branch</button>
    <div id="layer"><div id="popup" data-slot="tooltip-content" data-state="delayed-open">Branch conversation<span id="description" role="tooltip">Branch conversation</span></div></div>`);
    await page.evaluate(mutate);
    expect(
      await page.locator("#trigger").evaluate(tooltipPresentationVisible),
      name,
    ).toBe(expected);
  }
});

for (const [name, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  test(`${name}: branch tooltip retains its visible owner across hover and native focus`, async ({
    browser,
  }, testInfo) => {
    const scenario = PARITY_SCENARIOS.find(
      (entry) => entry.id === "branch-thread",
    )!;
    const state = scenarioStates(scenario).find(
      (entry) => entry.id === "turn-actions",
    )!;
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      await runScenario(page, base, scenario, DEFAULT_DIMENSION, state);
      const trigger = page
        .getByRole("button", { name: "Branch conversation", exact: true })
        .first();
      const waitForPresentation = async () => {
        const element = await trigger.elementHandle();
        expect(element).not.toBeNull();
        try {
          await page.waitForFunction(tooltipPresentationVisible, element!, {
            timeout: 30_000,
          });
        } finally {
          await element?.dispose();
        }
      };
      await waitForPresentation();
      const hoverState = await trigger.getAttribute("data-state");
      expect(["delayed-open", "instant-open"]).toContain(hoverState);
      // The replaced global selector also sampled this same button. Its
      // named visible anchor must still provide all geometry/style fields.
      const anchor = state.steps.find(
        (step) =>
          step.kind === "visible" &&
          "role" in step.target &&
          step.target.role === "button",
      );
      if (!anchor || anchor.kind !== "visible")
        throw new Error("The branch button lost its visible geometry anchor");
      const geometry = (await sampleGeometry(page, scenario, state))[
        targetLabel(anchor.target)
      ];
      expect(geometry).toBeDefined();
      expect(geometry).not.toBeNull();
      expect(geometry!.width).toBeGreaterThan(0);
      expect(geometry!.height).toBeGreaterThan(0);
      expect(geometry!.opacity).toBe("1");
      await trigger.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("data-state", "instant-open");
      await waitForPresentation();
      await testInfo.attach(`${name}-branch-tooltip-open-state.json`, {
        body: JSON.stringify({
          hoverState,
          keyboardState: await trigger.getAttribute("data-state"),
          paintedOwnerVerified: true,
        }),
        contentType: "application/json",
      });
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(
        0,
      );
      await expect(trigger).toBeFocused();
      expect(await trigger.evaluate(tooltipPresentationVisible)).toBe(false);
    } finally {
      await context.close();
    }
  });
}
