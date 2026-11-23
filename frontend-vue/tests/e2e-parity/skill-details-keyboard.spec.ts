import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  keyboardFocusTransitions,
  keyboardTraversalCycle,
  walkKeyboardTraversal,
  type KeyboardTraversal,
} from "./support/keyboard-focus";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;
const scenario = PARITY_SCENARIOS.find((item) => item.id === "skill-usage")!;

// Selection opens the real detail panel and reflows the exiting menu under the
// pointer. Physical closure alone misses a transient reopen: compare every
// observed transition as well as the stable cycle, with the original budget.
for (const stateId of ["restored-after-reload", "snapshot"]) {
  const state = scenarioStates(scenario).find((item) => item.id === stateId)!;
  for (const direction of ["Tab", "Shift+Tab"]) {
    test(`${stateId}: skill selection preserves the same ${direction} path`, async ({
      browser,
    }, info) => {
      const walks: KeyboardTraversal[] = [];
      for (const [app, base] of APPS) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          await runScenario(
            page,
            base,
            scenario,
            state.dimensions?.[0] ??
              scenario.dimensions?.[0] ??
              DEFAULT_DIMENSION,
            state,
            30_000,
          );
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const walk = await walkKeyboardTraversal(page, direction, 60, true);
          walks.push(walk);
          await info.attach(`${app}-native-traversal`, {
            body: JSON.stringify(walk, null, 2),
            contentType: "application/json",
          });
          expect(
            keyboardTraversalCycle(walk),
            `${app} complete physical cycle`,
          ).toBeDefined();
          expect(
            walk.sequence.some((stop) => stop.identity !== "(body)"),
            `${app} must reach application controls`,
          ).toBe(true);
        } finally {
          await context.close();
        }
      }
      const [vue, react] = walks;
      expect([...keyboardFocusTransitions(vue!.sequence)].sort()).toEqual(
        [...keyboardFocusTransitions(react!.sequence)].sort(),
      );
      expect(keyboardTraversalCycle(vue!)).toEqual(
        keyboardTraversalCycle(react!),
      );
    });
  }
}
