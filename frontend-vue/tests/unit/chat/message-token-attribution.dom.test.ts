import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessageList from "@/components/chat/MessageList.vue";
import ProcessingMessageGroup from "@/components/chat/ProcessingMessageGroup.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { buildTokenDebugSteps } from "@/core/messages/usage-model";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

vi.mock("@/components/chat/MessageMarkdown.vue", () => ({
  default: { props: ["content"], template: "<div>{{ content }}</div>" },
}));

const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
  await flushPromises();
});

const human: Message = { id: "human", type: "human", content: "Look it up" };
const usage = (total: number) => ({
  input_tokens: total - 5,
  output_tokens: 5,
  total_tokens: total,
});
const tool: Message = {
  id: "lookup",
  type: "ai",
  content: "",
  usage_metadata: usage(150),
  tool_calls: [{ id: "lookup-call", name: "mcp_lookup", args: {} }],
};
const result: Message = {
  id: "result",
  type: "tool",
  name: "mcp_lookup",
  tool_call_id: "lookup-call",
  content: "Found it",
};
const final: Message = {
  id: "final",
  type: "ai",
  content: "The answer",
  usage_metadata: usage(35),
};

function render(
  messages: Message[],
  mode: "step_debug" | "per_turn" = "step_debug",
  streaming = false,
) {
  const queryClient = new QueryClient();
  clients.push(queryClient);
  const wrapper = mount(MessageList, {
    props: {
      messages,
      streaming,
      loading: false,
      threadId: "token-thread",
      tokenUsageInlineMode: mode,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
      stubs: {
        ReferenceAttachment: true,
        WorkspaceChangesBadge: true,
        ToolCallDetails: true,
        SubtaskCard: true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

describe("message token attribution consumers", () => {
  it("keeps tool usage on its processing step and only final usage in the answer card", () => {
    const wrapper = render([human, tool, result, final]);
    const answer = wrapper.get(
      "[data-assistant-turn] [data-testid=message-token-debug]",
    );
    expect(answer.text()).toContain("35 Tokens");
    expect(answer.text()).not.toContain("150 Tokens");
    expect(answer.text()).not.toContain("mcp_lookup");
    const processing = wrapper.get("[data-testid=processing-message-group]");
    expect(processing.get("[data-tool-name=mcp_lookup]").text()).toContain(
      "150 Tokens",
    );
    expect(processing.text()).not.toContain(enUS.tokenUsage.finalAnswer);
  });

  it("shows missing usage at the tool without inventing or moving the final total", () => {
    const { usage_metadata: _usage, ...withoutUsage } = tool;
    const wrapper = render([human, withoutUsage, result, final]);
    expect(wrapper.get("[data-tool-name=mcp_lookup]").text()).toContain(
      enUS.tokenUsage.unavailableShort,
    );
    expect(
      wrapper
        .get("[data-assistant-turn] [data-testid=message-token-debug]")
        .text(),
    ).not.toContain(enUS.tokenUsage.unavailableShort);
  });

  it("preserves one full-turn aggregate instead of replacing it with group totals", () => {
    const wrapper = render([human, tool, result, final], "per_turn");
    expect(wrapper.findAll("[data-testid=message-token-usage]")).toHaveLength(
      1,
    );
    expect(wrapper.get("[data-testid=message-token-usage]").text()).toContain(
      "Total: 185",
    );
    expect(wrapper.find("[data-testid=message-token-debug]").exists()).toBe(
      false,
    );
    expect(wrapper.get("[data-tool-name=mcp_lookup]").text()).not.toContain(
      "150 Tokens",
    );
  });

  it("skips id-less debug attribution but still includes its usage in per-turn totals", () => {
    const { id: _id, ...idless } = final;
    const debug = render([human, idless]);
    expect(debug.find("[data-testid=message-token-debug]").exists()).toBe(
      false,
    );
    const aggregate = render([human, idless], "per_turn");
    expect(aggregate.get("[data-testid=message-token-usage]").text()).toContain(
      "Total: 35",
    );
  });

  it("keeps processing labels during a new live run while ordinary debug cards follow the React loading contract", () => {
    const wrapper = render(
      [
        human,
        tool,
        result,
        final,
        { ...human, id: "new-human" },
        {
          ...tool,
          id: "live-tool",
          tool_calls: [{ id: "live-call", name: "mcp_live", args: {} }],
        },
      ],
      "step_debug",
      true,
    );
    expect(wrapper.find("[data-testid=message-token-debug]").exists()).toBe(
      false,
    );
    expect(wrapper.get("[data-tool-name=mcp_lookup]").text()).toContain(
      "150 Tokens",
    );
    expect(wrapper.get("[data-tool-name=mcp_live]").text()).toContain(
      "150 Tokens",
    );
  });

  it("shows a shared batch summary once at the first eligible step and keeps collapsed steps collapsed", async () => {
    const batch: Message = {
      ...tool,
      tool_calls: [
        { id: "first", name: "mcp_first", args: {} },
        { id: "second", name: "mcp_second", args: {} },
      ],
    };
    const wrapper = render([human, batch]);
    const processing = wrapper.getComponent(ProcessingMessageGroup);
    expect(processing.text()).not.toContain("150 Tokens");
    await processing.get("[data-testid=toggle-earlier-steps]").trigger("click");
    expect(processing.text().match(/150 Tokens/g)).toHaveLength(1);
    expect(processing.text()).toContain(enUS.tokenUsage.sharedAttribution);
    expect(processing.get("[data-tool-name=mcp_first]").text()).not.toContain(
      "150 Tokens",
    );
    expect(processing.get("[data-tool-name=mcp_second]").text()).not.toContain(
      "150 Tokens",
    );
  });

  it("consumes the supplied global step identity without locally rebuilding attribution", () => {
    const steps = buildTokenDebugSteps([human, tool], enUS);
    const supplied = {
      ...steps[0]!,
      label: "Backend owned label",
      usage: { inputTokens: 6, outputTokens: 1, totalTokens: 7 },
    };
    const wrapper = mount(ProcessingMessageGroup, {
      props: {
        messages: [tool],
        streaming: false,
        showToolDetails: true,
        tokenDebugSteps: [supplied],
      },
    });
    wrappers.push(wrapper);
    expect(wrapper.get("[data-tool-name=mcp_lookup]").text()).toContain(
      "Backend owned label",
    );
    expect(wrapper.get("[data-tool-name=mcp_lookup]").text()).toContain(
      "7 Tokens",
    );
    expect(wrapper.text()).not.toContain("150 Tokens");
  });

  it("puts thinking usage on the disclosure label without a second summary", async () => {
    const thinking: Message = {
      id: "thinking",
      type: "ai",
      content: "",
      additional_kwargs: { reasoning_content: "Consider the evidence" },
      usage_metadata: usage(25),
    };
    const wrapper = mount(ProcessingMessageGroup, {
      props: {
        messages: [thinking],
        streaming: true,
        showToolDetails: true,
        tokenDebugSteps: buildTokenDebugSteps([human, thinking], enUS),
      },
    });
    wrappers.push(wrapper);
    expect(
      wrapper.get("[data-testid=toggle-trailing-reasoning]").text(),
    ).toContain("25 Tokens");
    expect(
      wrapper.find("[data-testid=processing-token-summary]").exists(),
    ).toBe(false);
    await wrapper.setProps({ streaming: false, durationSeconds: 2 });
    expect(wrapper.get("button").text()).toContain("25 Tokens");
    expect(wrapper.text()).not.toContain("Consider the evidence");
  });

  it("uses backend shared attribution once, including when reasoning and tools share one AI message", async () => {
    const shared: Message = {
      ...tool,
      additional_kwargs: {
        reasoning_content: "First think",
        token_usage_attribution: {
          version: 1,
          kind: "tool_batch",
          shared_attribution: true,
          actions: [
            { kind: "todo_start", content: "Read the file" },
            {
              kind: "tool",
              tool_name: "mcp_lookup",
              description: "Look up evidence",
            },
          ],
        },
      },
    };
    const wrapper = render([human, shared]);
    const processing = wrapper.getComponent(ProcessingMessageGroup);
    expect(
      processing.find("[data-testid=processing-token-summary]").exists(),
    ).toBe(false);
    await processing.get("[data-testid=toggle-earlier-steps]").trigger("click");
    expect(
      processing.findAll("[data-testid=processing-token-summary]"),
    ).toHaveLength(1);
    expect(processing.text().match(/150 Tokens/g)).toHaveLength(1);
    expect(processing.text()).toContain("Read the file");
    expect(processing.text()).toContain("Look up evidence");
  });

  it("keeps subagent reasoning attribution inside its processing group without a duplicate final card", () => {
    const dispatch: Message = {
      id: "dispatch",
      type: "ai",
      content: "",
      additional_kwargs: { reasoning_content: "Delegate the lookup" },
      usage_metadata: usage(55),
      tool_calls: [
        {
          id: "task-1",
          name: "task",
          args: {
            description: "Research evidence",
            prompt: "Look up evidence",
            subagent_type: "research",
          },
        },
      ],
    };
    const wrapper = render([
      human,
      dispatch,
      { ...final, id: "after-dispatch" },
    ]);
    const processing = wrapper.get("[data-testid=processing-message-group]");
    expect(processing.text()).toContain("55 Tokens");
    expect(
      processing.findAll("[data-testid=processing-token-summary]"),
    ).toHaveLength(1);
    expect(
      wrapper.get("[data-testid=message-token-debug]").text(),
    ).not.toContain("55 Tokens");
    expect(wrapper.get("[data-testid=message-token-debug]").text()).toContain(
      "35 Tokens",
    );
  });
});
