import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  scenarioStates,
  type ParityDimension,
  type ParityScenario,
  type ParityState,
} from "../../e2e-parity/support/scenarios";

const source = readFileSync(
  new URL("../../e2e-parity/narrow-screen-overflow.spec.ts", import.meta.url),
  "utf8",
);
const keyOf = (scenario: ParityScenario, state: ParityState) =>
  `${scenario.id}${state.id && state.id !== "default" ? `#${state.id}` : ""}`;
const cases = PARITY_SCENARIOS.flatMap((scenario) =>
  scenarioStates(scenario).map((state) => ({
    key: keyOf(scenario, state),
    scenario,
    state,
  })),
);

type Fault = "unreachable" | "reachable" | "overflow" | "dropped";
type Walk = {
  key?: string;
  dimension?: ParityDimension;
  timeout?: number;
  dialogs: number;
  surveys: number;
  widths: number[];
  closed: boolean;
};
type Registered = {
  title: string;
  run: (fixtures: { browser: object }) => Promise<void>;
};

/** Execute the actual registered macros with inert browser boundaries. This
 * verifies complete traversal and failure propagation; real CSS and native
 * navigation remain the responsibility of the browser suites.
 */
function harness() {
  const registered: Registered[] = [];
  const budgets: number[] = [];
  const test = Object.assign(
    (title: string, run: Registered["run"]) => registered.push({ title, run }),
    { setTimeout: (budget: number) => budgets.push(budget) },
  );
  const exports: { unreachable?: Record<string, string> } = {};
  const observed: Walk[] = [];
  let fault: Fault | undefined;
  let fallback = false;
  let current: Walk;
  let faultKey: string;
  const modules: Record<string, unknown> = {
    "./support/test": { test, expect },
    "./support/context-options": { PARITY_CONTEXT_OPTIONS: {} },
    "./support/reflow-survey": {},
    "./support/scenarios": {
      DEFAULT_DIMENSION,
      PARITY_SCENARIOS,
      scenarioStates,
      async runScenario(
        _page: object,
        _baseUrl: string,
        scenario: ParityScenario,
        dimension: ParityDimension,
        state: ParityState,
        timeout: number,
      ) {
        current.key = keyOf(scenario, state);
        current.dimension = dimension;
        current.timeout = timeout;
        if (fault === "unreachable" && current.key === faultKey)
          throw new Error("Terminal state failed");
        if (
          !fallback &&
          current.key in exports.unreachable! &&
          !(fault === "reachable" && current.key === faultKey)
        )
          throw new Error("Declared mobile entry unavailable");
      },
    },
  };
  const compiled = ts.transpileModule(
    source + "\nexport const unreachable = MOBILE_UNREACHABLE;",
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInNewContext(compiled, {
    exports,
    process: { env: {} },
    require: (id: string) => {
      if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`);
      return modules[id];
    },
  });
  const browser = {
    async newContext() {
      current = {
        dialogs: 0,
        surveys: 0,
        widths: [],
        closed: false,
      };
      const walk = current;
      observed.push(walk);
      return {
        async newPage() {
          return {
            async setViewportSize({ width }: { width: number }) {
              walk.widths.push(width);
            },
            async waitForTimeout() {},
            async evaluate(callback: (() => unknown) | undefined) {
              if (callback?.name === "countDialogs") {
                walk.dialogs++;
                return fault === "dropped" && walk.key === faultKey
                  ? 2 - walk.dialogs
                  : 1;
              }
              walk.surveys++;
              return {
                nonDeliberateHorizontalScrollers:
                  fault === "overflow" && walk.key === faultKey
                    ? ["Unexpected horizontal scroller"]
                    : [],
              };
            },
          };
        },
        async close() {
          walk.closed = true;
        },
      };
    },
  };
  return {
    registered,
    budgets,
    unreachable: exports.unreachable!,
    async run(entry: Registered, failure?: Fault) {
      observed.length = 0;
      fault = failure;
      fallback = entry.title.includes("桌面开");
      faultKey =
        fallback || failure === "reachable"
          ? Object.keys(exports.unreachable!)[0]!
          : cases.find((item) => !(item.key in exports.unreachable!))!.key;
      try {
        await entry.run({ browser });
      } finally {
        expect(observed.every((walk) => walk.closed)).toBe(true);
      }
      return [...observed];
    },
  };
}

describe("narrow-screen macro scenario ownership", () => {
  it("visits every registered state on both apps, retaining locale, viewport and budgets", async () => {
    const suite = harness();
    const primary = suite.registered.filter((entry) =>
      entry.title.includes("每个终态"),
    );
    const fallback = suite.registered.filter((entry) =>
      entry.title.includes("桌面开"),
    );
    expect(primary).toHaveLength(2);
    expect(fallback).toHaveLength(2);
    for (const entry of primary) {
      const walks = await suite.run(entry);
      expect(walks.map((walk) => walk.key)).toEqual(
        cases.map((item) => item.key),
      );
      for (const [index, walk] of walks.entries()) {
        const item = cases[index]!;
        const unavailable = item.key in suite.unreachable;
        expect(walk.dimension).toEqual({
          viewport: "mobile",
          theme: "light",
          locale: item.state.dimensions?.[0]?.locale ?? "en-US",
        });
        expect(walk.timeout).toBe(unavailable ? 4_000 : 30_000);
        expect(walk.surveys).toBe(unavailable ? 0 : 1);
        expect(walk.widths).toEqual(unavailable ? [] : [360]);
      }
      expect(
        walks.find(
          (walk) =>
            walk.key ===
            "settings-model-sync#thread-model-and-account-effort-zh",
        )?.dimension,
      ).toEqual({ viewport: "mobile", theme: "light", locale: "zh-CN" });
    }
    for (const entry of fallback) {
      const walks = await suite.run(entry);
      expect(walks.map((walk) => walk.key)).toEqual(
        cases
          .filter((item) => item.key in suite.unreachable)
          .map((item) => item.key),
      );
      for (const walk of walks) {
        expect(walk.dimension).toEqual(DEFAULT_DIMENSION);
        expect(walk.timeout).toBe(30_000);
        expect(walk.dialogs).toBe(2);
        expect(walk.surveys).toBe(1);
        expect(walk.widths).toEqual([360]);
      }
    }
    expect(suite.budgets).toEqual(Array(4).fill(1_800_000));
  });

  it("still fails each primary assertion: overflow, missing state and stale unreachable roster", async () => {
    for (const fault of ["overflow", "unreachable", "reachable"] as const) {
      const suite = harness();
      const entry = suite.registered.find((item) =>
        item.title.includes("每个终态"),
      )!;
      await expect(suite.run(entry, fault)).rejects.toThrow();
    }
  });

  it("still fails each desktop-to-mobile assertion: missing state, overflow and lost dialog", async () => {
    for (const fault of ["unreachable", "overflow", "dropped"] as const) {
      const suite = harness();
      const entry = suite.registered.find((item) =>
        item.title.includes("桌面开"),
      )!;
      await expect(suite.run(entry, fault)).rejects.toThrow();
    }
  });
});
