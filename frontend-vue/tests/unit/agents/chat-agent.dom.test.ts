import { QueryClient } from "@tanstack/vue-query";
import { flushPromises } from "@vue/test-utils";
import { effectScope, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatAgent } from "@/composables/useChatAgent";
import { getAgent } from "@/core/agents/api";
import type { Agent } from "@/core/agents/types";
import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";

vi.mock("@/core/agents/api", () => ({ getAgent: vi.fn() }));

const readAgent = vi.mocked(getAgent);
const definition = (name = "reviewer"): Agent => ({
  name,
  description: "Reviews code",
  model: null,
  tool_groups: null,
  skills: null,
});
const cleanups: (() => void)[] = [];

function setup(bootstrap = false) {
  const agentName = ref<string | null>("reviewer");
  const userId = ref("alice");
  const demo = ref(false);
  const creating = ref(bootstrap);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const scope = effectScope();
  const state = scope.run(() =>
    useChatAgent({
      agentName,
      userId,
      demo,
      bootstrap: creating,
      queryClient,
    }),
  )!;
  cleanups.push(() => {
    scope.stop();
    queryClient.clear();
  });
  return { agentName, userId, demo, creating, queryClient, scope, state };
}

beforeEach(() => {
  readAgent.mockReset();
  readAgent.mockImplementation(async (name) => definition(name));
});
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe("chat Agent read ownership", () => {
  it("leaves persistence reads to the creation state machine during bootstrap", async () => {
    const host = setup(true);
    await flushPromises();
    expect(readAgent).not.toHaveBeenCalled();
    expect(host.state.agent.value).toBeNull();
    expect(host.state.resolved.value).toBe(true);
    host.creating.value = false;
    await flushPromises();
    expect(readAgent).toHaveBeenCalledTimes(1);
    expect(host.state.agent.value?.name).toBe("reviewer");
  });

  it("loads an existing Agent once and settles unavailable definitions", async () => {
    const host = setup();
    expect(host.state.resolved.value).toBe(false);
    await flushPromises();
    expect(host.state.agent.value).toEqual(definition());
    expect(host.state.resolved.value).toBe(true);
    readAgent.mockRejectedValueOnce(new Error("Agent not found"));
    host.agentName.value = "missing";
    await flushPromises();
    expect(host.state.agent.value).toBeNull();
    expect(host.state.resolved.value).toBe(true);
  });

  it.each(["account", "agent", "bootstrap", "demo", "unmount", "query-owner"])(
    "rejects a late definition after %s retires its owner",
    async (change) => {
      let finish!: (agent: Agent) => void;
      let signal!: AbortSignal;
      readAgent.mockImplementationOnce((_name, options) => {
        signal = options!.signal!;
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
      const host = setup();
      if (change === "account") host.userId.value = "bob";
      else if (change === "agent") host.agentName.value = "researcher";
      else if (change === "bootstrap") host.creating.value = true;
      else if (change === "demo") host.demo.value = true;
      else if (change === "unmount") host.scope.stop();
      else invalidateWorkspaceQueryOwner(host.queryClient);
      finish({ ...definition(), description: "Stale private definition" });
      await flushPromises();
      expect(host.state.agent.value?.description).not.toBe(
        "Stale private definition",
      );
      if (change !== "query-owner") expect(signal.aborted).toBe(true);
      if (change === "account")
        expect(host.state.agent.value).toEqual(definition());
      if (change === "agent")
        expect(host.state.agent.value).toEqual(definition("researcher"));
    },
  );
});
