import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
  type ParityScenario,
  type ParityStep,
  type ParityViewport,
} from "../../e2e-parity/support/scenarios";

vi.mock("../../e2e-parity/support/settle", () => ({
  waitForFiniteAnimations: async () => undefined,
  waitForDomQuiet: async () => undefined,
}));

async function execute(
  viewport: ParityViewport,
  missing?: string,
  actions = false,
  failAction?: string,
) {
  const observed: string[] = [];
  const page = {
    setViewportSize: async () => undefined,
    context: () => ({ addCookies: async () => undefined }),
    addInitScript: async () => undefined,
    goto: async (url: string) => observed.push(url),
    locator: (selector: string) => ({
      first: () => ({
        waitFor: async () => {
          observed.push(selector);
          if (selector === missing) throw new Error(`Missing ${selector}`);
        },
      }),
    }),
  } as unknown as Page;
  const visible = (selector: string, viewports?: readonly ParityViewport[]) =>
    ({ kind: "visible", target: { selector }, viewports }) as ParityStep;
  const scenario: ParityScenario = {
    id: "viewport-contract",
    title: "Shared viewport actions",
    backend: "gateway",
    path: "/real-state",
    settle: [
      visible("shared-ready"),
      visible("desktop-name", ["desktop", "tablet"]),
      visible("mobile-back", ["mobile"]),
    ],
    states: [
      {
        id: "completed",
        steps: [
          visible("desktop-action", ["desktop", "tablet"]),
          visible("mobile-action", ["mobile"]),
          visible("real-completed-state"),
        ],
      },
    ],
  };
  await runScenario(
    page,
    "http://fixture.test",
    scenario,
    {
      ...DEFAULT_DIMENSION,
      viewport,
    },
    undefined,
    30_000,
    actions
      ? async (action) => {
          observed.push(`action:${action}`);
          if (action === failAction)
            throw new Error(`Failed action boundary ${action}`);
        }
      : undefined,
  );
  return observed;
}

describe("framework-neutral viewport steps", () => {
  it("runs the original desktop/tablet anchor and the full state", async () => {
    for (const viewport of ["desktop", "tablet"] as const)
      expect(await execute(viewport)).toEqual([
        "http://fixture.test/real-state",
        "shared-ready",
        "desktop-name",
        "desktop-action",
        "real-completed-state",
      ]);
  });

  it("uses the actual mobile entry while retaining the full state", async () => {
    expect(await execute("mobile")).toEqual([
      "http://fixture.test/real-state",
      "shared-ready",
      "mobile-back",
      "mobile-action",
      "real-completed-state",
    ]);
  });

  it("does not skip missing selected anchors or the terminal state", async () => {
    await expect(execute("desktop", "desktop-name")).rejects.toThrow(
      "Missing desktop-name",
    );
    await expect(execute("mobile", "mobile-back")).rejects.toThrow(
      "Missing mobile-back",
    );
    await expect(execute("mobile", "real-completed-state")).rejects.toThrow(
      "Missing real-completed-state",
    );
  });

  it("keeps the desktop agent display-name assertion in both states", () => {
    const agent = PARITY_SCENARIOS.find(
      (scenario) => scenario.id === "agent-chat",
    )!;
    expect(scenarioStates(agent).map((state) => state.id)).toEqual([
      "model-picker",
      "completed-turn",
    ]);
    expect(agent.settle).toContainEqual({
      kind: "visible",
      target: { selector: 'header span:text-is("Review Assistant")' },
      viewports: ["desktop", "tablet"],
    });
    expect(agent.settle).toContainEqual({
      kind: "visible",
      target: { role: "button", name: /^(Toggle Sidebar|切换侧边栏)$/ },
      viewports: ["mobile"],
    });
  });

  it("keeps every tool detail state bilingual and bound to the exact tool/call", () => {
    const scenario = PARITY_SCENARIOS.find(
      (item) => item.id === "tool-call-details",
    )!;
    for (const state of scenarioStates(scenario)) {
      const first = state.steps[0]!;
      if (!("target" in first) || !("role" in first.target))
        throw new Error("Tool detail state lost its actual button entry");
      const name = first.target.name;
      expect(name).toBeInstanceOf(RegExp);
      for (const text of [
        "Tool details: mcp_lookup (call-4389)",
        "工具详情: mcp_lookup (call-4389)",
      ])
        expect(text).toMatch(name as RegExp);
      for (const text of [
        "Tool details: mcp_lookup (call-other)",
        "工具详情: another_tool (call-4389)",
        "prefix 工具详情: mcp_lookup (call-4389)",
      ])
        expect(text).not.toMatch(name as RegExp);
    }
  });
});

it("labels selected actions by their unfiltered original indexes before execution", async () => {
  expect(await execute("mobile", undefined, true)).toEqual([
    "action:entry",
    "http://fixture.test/real-state",
    "action:settle:0",
    "shared-ready",
    "action:settle:2",
    "mobile-back",
    "action:steps:1",
    "mobile-action",
    "action:steps:2",
    "real-completed-state",
  ]);
  expect(await execute("desktop", undefined, true)).toEqual([
    "action:entry",
    "http://fixture.test/real-state",
    "action:settle:0",
    "shared-ready",
    "action:settle:1",
    "desktop-name",
    "action:steps:0",
    "desktop-action",
    "action:steps:2",
    "real-completed-state",
  ]);
});

it("does not execute a product action when its observation boundary failed", async () => {
  await expect(
    execute("mobile", "mobile-action", true, "steps:1"),
  ).rejects.toThrow("Failed action boundary steps:1");
  await expect(execute("desktop", undefined, true, "entry")).rejects.toThrow(
    "Failed action boundary entry",
  );
});
