import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import * as keyboardFocus from "../../e2e-parity/support/keyboard-focus";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  scenarioStates,
} from "../../e2e-parity/support/scenarios";

const source = readFileSync(
  new URL("../../e2e-parity/keyboard-order.spec.ts", import.meta.url),
  "utf8",
);
const cases = PARITY_SCENARIOS.flatMap((scenario) =>
  scenarioStates(scenario).map((state) => ({ scenario, state })),
);

type Walk = {
  app?: string;
  scenario?: string;
  state?: string;
  presses: string[];
  reads: number;
  closed: boolean;
};

/** Execute the registered macro without launching a browser: this checks the
 * full traversal and API-step ownership, rather than a source spelling. Real
 * keyboard sequences are verified by the independent browser A/B and full gate.
 */
async function execute(longState = false) {
  const scopes = new AsyncLocalStorage<string[]>();
  const walks: Walk[] = [];
  const unowned: string[] = [];
  const stepTitles: string[] = [];
  let timeout: number | undefined;
  let callback: ((fixtures: { browser: object }) => Promise<void>) | undefined;
  let current: Walk | undefined;
  const api = (name: string) => {
    const owner = scopes.getStore();
    if (!owner || owner.length < 3) unowned.push(name);
  };
  const test = Object.assign(
    (_title: string, run: typeof callback) => {
      callback = run;
    },
    {
      setTimeout(value: number) {
        timeout = value;
      },
      async step<T>(title: string, run: () => Promise<T>) {
        stepTitles.push(title);
        return scopes.run([...(scopes.getStore() ?? []), title], run);
      },
    },
  );
  const browser = {
    async newContext() {
      api("newContext");
      // A subsequent context must not replace a still-live prior observer.
      expect(current?.closed ?? true).toBe(true);
      const walk: Walk = { presses: [], reads: 0, closed: false };
      current = walk;
      walks.push(walk);
      return {
        async newPage() {
          api("newPage");
          return {
            walk,
            keyboard: {
              async press(key: string) {
                api("keyboard.press");
                walk.presses.push(key);
              },
            },
            async evaluate(callback: (...args: never[]) => unknown) {
              api("evaluate");
              const long =
                longState &&
                walk.scenario === "scheduled-run-history" &&
                walk.state === "default";
              const length = long ? 70 : 4;
              const potentialIds = Array.from({ length }, (_, index) =>
                String(index),
              );
              if (callback.name === "beginKeyboardTraversal")
                return { potentialIds };
              if (callback.name === "inspectKeyboardTraversal")
                return {
                  potentialIds,
                  events: [],
                  stableFrom: 0,
                  topologyChanges: [],
                };
              if (callback.name === "endKeyboardTraversal") return;
              const index = walk.reads++ % length;
              return {
                identity: String(index),
                descriptor: `button"stop-${index}"`,
              };
            },
          };
        },
        async close() {
          api("close");
          walk.closed = true;
        },
      };
    },
  };
  const modules: Record<string, unknown> = {
    "./support/test": { test, expect },
    "./support/context-options": { PARITY_CONTEXT_OPTIONS: {} },
    "./support/keyboard-focus": keyboardFocus,
    "./support/settle": {
      async waitForFiniteAnimations() {
        api("finiteAnimations");
      },
      async waitForDomQuiet() {
        api("domQuiet");
      },
    },
    "./support/scenarios": {
      DEFAULT_DIMENSION,
      PARITY_SCENARIOS,
      scenarioStates,
      async runScenario(
        page: { walk: Walk },
        app: string,
        scenario: (typeof PARITY_SCENARIOS)[number],
        _dimension: unknown,
        state: ReturnType<typeof scenarioStates>[number],
      ) {
        api("runScenario");
        Object.assign(page.walk, {
          app,
          scenario: scenario.id,
          state: state.id,
        });
      },
    },
  };
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  runInNewContext(compiled, {
    exports: {},
    process: { env: { E2E_APP_URL: "vue", E2E_REACT_APP_URL: "react" } },
    require(name: string) {
      if (!(name in modules)) throw new Error(`Unexpected import ${name}`);
      return modules[name];
    },
  });
  if (!callback) throw new Error("Keyboard macro was not registered");
  await callback({ browser });
  return { timeout, walks, unowned, stepTitles };
}

describe("keyboard macro operation ownership", () => {
  it("keeps a continuous explicit step owner for every browser operation", async () => {
    const result = await execute();
    expect(result.unowned.length, result.unowned.slice(0, 5).join(", ")).toBe(
      0,
    );
    expect(result.stepTitles).toHaveLength(1 + cases.length * 2 * 3);
  });

  it("keeps both applications serial and isolated for every registered state and direction", async () => {
    const result = await execute();
    expect(result.timeout).toBe(3_600_000);
    expect(result.walks).toHaveLength(cases.length * 2 * 2);
    const expected = cases.flatMap(({ scenario, state }) =>
      ["Tab", "Shift+Tab"].flatMap((key) =>
        ["vue", "react"].map((app) => ({
          app,
          scenario: scenario.id,
          state: state.id,
          presses: Array<string>(60).fill(key),
          reads: 60,
          closed: true,
        })),
      ),
    );
    expect(result.walks).toEqual(expected);
  });

  it("executes bounded additional native keys for a registered finite long ring without changing any other state", async () => {
    const result = await execute(true);
    const extended = result.walks.filter(
      (walk) =>
        walk.scenario === "scheduled-run-history" && walk.state === "default",
    );
    expect(extended).toHaveLength(4);
    for (const walk of extended) {
      expect(walk.presses).toHaveLength(71);
      expect(walk.reads).toBe(71);
    }
    for (const walk of result.walks.filter(
      (walk) => !extended.includes(walk),
    )) {
      expect(walk.presses).toHaveLength(60);
      expect(walk.reads).toBe(60);
    }
    expect(result.unowned).toEqual([]);
    expect(result.timeout).toBe(3_600_000);
  });
});
