import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageTokenUsage from "@/components/chat/MessageTokenUsage.vue";
import TokenUsageIndicator from "@/components/chat/TokenUsageIndicator.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { retainThreadTokenUsagePlaceholder } from "@/core/threads/token-usage";
import type { Message } from "@/core/types/message";
import type { ThreadTokenUsageResponse } from "@/core/threads/types";

const persisted = {
  id: "ai-persisted",
  type: "ai",
  content: "Old answer",
  usage_metadata: {
    input_tokens: 60,
    output_tokens: 40,
    total_tokens: 100,
  },
} as unknown as Message;
const pending = {
  id: "ai-pending",
  type: "ai",
  run_id: "run-live",
  content: "Live answer",
  usage_metadata: {
    input_tokens: 15,
    output_tokens: 10,
    total_tokens: 25,
  },
} as unknown as Message;

/**
 * `GET /threads/{id}/token-usage` 的完整响应。用例只关心其中一两个字段，
 * 但夹具照整份契约给——少给的那些字段一样会被组件读到。
 */
function threadTokenUsage(
  overrides: Partial<ThreadTokenUsageResponse> = {},
): ThreadTokenUsageResponse {
  return {
    thread_id: "thread-1",
    total_tokens: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_runs: 0,
    by_model: {},
    by_caller: { lead_agent: 0, subagent: 0, middleware: 0 },
    context_usage: null,
    ...overrides,
  };
}

describe("token usage surfaces", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("merges the active SSE delta into the persisted total, then replaces it with the final snapshot", async () => {
    const wrapper = mount(TokenUsageIndicator, {
      props: {
        threadId: "thread-1",
        messages: [persisted, pending],
        pendingMessages: [pending],
        backendUsage: {
          inputTokens: 60,
          outputTokens: 40,
          totalTokens: 100,
        },
        enabled: true,
        preferences: { headerTotal: true, inlineMode: "per_turn" },
      },
    });
    expect(wrapper.get("button").text()).toContain("125");
    expect(wrapper.find("select").exists()).toBe(false);

    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(
      document.body.querySelectorAll('[role="menuitemradio"]'),
    ).toHaveLength(4);
    expect(document.body.textContent).toContain(
      enUS.tokenUsage.presetDescriptions.perTurn,
    );

    await wrapper.setProps({
      pendingMessages: [],
      backendUsage: {
        inputTokens: 75,
        outputTokens: 50,
        totalTokens: 125,
      },
    });
    expect(wrapper.get("button").text()).toContain("125");
  });

  it("hides every token surface when the backend feature or inline preference is off", () => {
    const header = mount(TokenUsageIndicator, {
      props: {
        messages: [persisted],
        enabled: false,
        preferences: { headerTotal: true, inlineMode: "per_turn" },
      },
    });
    expect(header.find("[data-testid='token-usage-indicator']").exists()).toBe(
      false,
    );

    const inline = mount(MessageTokenUsage, {
      props: { messages: [persisted], mode: "off" },
    });
    expect(inline.find("[data-testid='message-token-usage']").exists()).toBe(
      false,
    );
    expect(inline.find("[data-testid='message-token-debug']").exists()).toBe(
      false,
    );
  });

  it("renders per-turn and completed debug attribution without double counting", async () => {
    const wrapper = mount(MessageTokenUsage, {
      props: { messages: [persisted, persisted], mode: "per_turn" },
    });
    expect(wrapper.get("[data-testid='message-token-usage']").text()).toContain(
      "100",
    );

    await wrapper.setProps({
      messages: [persisted],
      mode: "step_debug",
      loading: false,
    });
    expect(
      wrapper.findAll("[data-testid='message-token-debug'] > div"),
    ).toHaveLength(1);
  });

  it("rejects a retained snapshot whose response belongs to another thread", () => {
    expect(
      retainThreadTokenUsagePlaceholder(
        threadTokenUsage({
          thread_id: "thread-1",
          total_tokens: 42,
          context_usage: {
            token_count: 42,
            max_context_tokens: 100,
            percentage: 42,
          },
        }),
        "thread-2",
      ),
    ).toBeUndefined();
  });
});
