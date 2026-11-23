import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { QueryClient } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { compile, defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentWelcome from "@/components/chat/AgentWelcome.vue";
import { useChatAgent } from "@/composables/useChatAgent";
import { getAgent } from "@/core/agents/api";
import * as presentation from "@/core/agents/presentation";
import type { Agent } from "@/core/agents/types";

vi.mock("@/core/agents/api", () => ({ getAgent: vi.fn() }));

const readAgent = vi.mocked(getAgent);
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
const definition = (name = "reviewer"): Agent => ({
  name,
  description: "Reviews code",
  model: null,
  tool_groups: null,
  skills: null,
});

// Compile the production header badge, rather than duplicating its expression.
// The surrounding stream/panels are not involved in Agent name presentation.
const source = readFileSync(
  resolve(process.cwd(), "app/components/chat/AgentChat.vue"),
  "utf8",
).replace(/<!--[\s\S]*?-->/g, "");
const badges = [...source.matchAll(/<div\s+v-if="agentName"[\s\S]*?<\/div>/g)];
expect(badges).toHaveLength(1);
const HeaderBadge = defineComponent({
  props: ["agent", "agentName"],
  components: { Bot: { render: () => h("svg") } },
  setup: () => presentation,
  render: compile(badges[0]![0]),
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(queryClient);
  const agentName = ref("reviewer");
  const userId = ref("alice");
  const host = defineComponent({
    setup() {
      const { agent } = useChatAgent({
        agentName,
        userId,
        demo: false,
        bootstrap: false,
        queryClient,
      });
      return () =>
        h("section", [
          h("header", [
            h(HeaderBadge, { agent: agent.value, agentName: agentName.value }),
          ]),
          h(AgentWelcome, { agent: agent.value, agentName: agentName.value }),
        ]);
    },
  });
  const wrapper = mount(host);
  wrappers.push(wrapper);
  return { wrapper, agentName, userId };
}

function expectNames(
  wrapper: ReturnType<typeof setup>["wrapper"],
  name: string,
) {
  expect.soft(wrapper.get("header span").text()).toBe(name);
  expect
    .soft(wrapper.get("[data-testid='agent-welcome'] .font-bold").text())
    .toBe(name);
}

beforeEach(() => {
  readAgent.mockReset().mockImplementation(async (name) => definition(name));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
});

describe("Agent chat name presentation", () => {
  it.each([
    ["审查助手 🚀", "审查助手 🚀"],
    ["", "reviewer"],
    [null, "reviewer"],
    [undefined, "reviewer"],
  ])(
    "shows display_name=%s in both header and welcome",
    async (displayName, expected) => {
      readAgent.mockResolvedValue({
        ...definition(),
        display_name: displayName,
      });
      const { wrapper } = setup();
      expectNames(wrapper, "reviewer");
      await flushPromises();
      expectNames(wrapper, expected!);
      expect(readAgent).toHaveBeenCalledWith(
        "reviewer",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    },
  );

  it("retires an old Agent display name immediately and rejects its late response", async () => {
    const pending: { signal: AbortSignal; resolve: (agent: Agent) => void }[] =
      [];
    readAgent.mockImplementation(
      (_name, options) =>
        new Promise((resolve) => {
          pending.push({ signal: options!.signal!, resolve });
        }),
    );
    const { wrapper, agentName, userId } = setup();
    pending[0]!.resolve({ ...definition(), display_name: "Alice reviewer" });
    await flushPromises();
    expectNames(wrapper, "Alice reviewer");

    agentName.value = "researcher";
    await flushPromises();
    expectNames(wrapper, "researcher");
    userId.value = "bob";
    await flushPromises();
    expect(pending[1]!.signal.aborted).toBe(true);
    pending[2]!.resolve({
      ...definition("researcher"),
      display_name: "Bob researcher",
    });
    await flushPromises();
    expectNames(wrapper, "Bob researcher");
    pending[1]!.resolve({
      ...definition("researcher"),
      display_name: "Private Alice researcher",
    });
    await flushPromises();
    expectNames(wrapper, "Bob researcher");
  });
});
