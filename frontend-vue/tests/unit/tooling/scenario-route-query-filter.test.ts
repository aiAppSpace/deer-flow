import type { Page, Route } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import {
  applyScenarioBackend,
  PARITY_SCENARIOS,
  type ParityScenario,
} from "../../e2e-parity/support/scenarios";

async function search(query: string) {
  const handlers = new Map<string, (route: Route) => Promise<unknown>>();
  const page = {
    route: async (
      pattern: string,
      handler: (route: Route) => Promise<unknown>,
    ) => handlers.set(pattern, handler),
  } as unknown as Page;
  const scenario = PARITY_SCENARIOS.find(
    (item) => item.id === "extension-mentions",
  )!;
  // Use the registered route data and installer; no product request may escape.
  await applyScenarioBackend(page, {
    ...scenario,
    backend: "gateway",
  } satisfies ParityScenario);
  const fulfill = vi.fn(async (_response: { body?: string }) => undefined);
  await handlers.get("**/api/plugins/community.team/actions/search")!({
    request: () => ({ postDataJSON: () => ({ query, threadId: "thread-a" }) }),
    fulfill,
  } as unknown as Route);
  expect(fulfill).toHaveBeenCalledTimes(1);
  return JSON.parse(fulfill.mock.calls[0]![0]!.body as string) as unknown[];
}

describe("registered extension mention search", () => {
  it.each(["", "Alice", "ALICE", "team"])(
    "returns the matching authoritative candidate for %j",
    async (query) => {
      expect(await search(query)).toEqual([
        { id: "alice", label: "Alice", description: "Team members" },
      ]);
    },
  );

  it("does not leak a constant Alice response for an unrelated query", async () => {
    expect(await search("zz-no-matches")).toEqual([]);
  });
});
