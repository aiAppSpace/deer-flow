/*
  MessageTokenUsage 的视图合同。

  step-debug 那一支此前只画了「标题 + 总量」，而 `buildTokenDebugSteps` 早就把
  `secondaryLabels` 与 `sharedAttribution` 算好了——数据算出来了，视图把它扔了。
  这里 mock 掉模型层，钉的是**视图有没有把算好的东西画出来**。

  这两支都要开 token 调试偏好才看得见，对照台账没有场景开它。
*/

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";

const mocks = vi.hoisted(() => ({ buildTokenDebugSteps: vi.fn() }));
vi.mock("@/core/messages/usage-model", () => ({
  buildTokenDebugSteps: mocks.buildTokenDebugSteps,
}));

import MessageTokenUsage from "@/components/chat/MessageTokenUsage.vue";

const aiMessage: Message = {
  id: "ai-1",
  type: "ai",
  content: "hi",
  usage_metadata: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
};

beforeEach(() => {
  mocks.buildTokenDebugSteps.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
});

describe("MessageTokenUsage per_turn", () => {
  it("keeps the upstream separator and gap rhythm", () => {
    const row = mount(MessageTokenUsage, {
      props: { messages: [aiMessage], mode: "per_turn" },
    }).get("[data-testid='message-token-usage']");

    expect(row.classes()).toContain("mt-1");
    expect(row.classes()).toContain("border-border/60");
    expect(row.classes()).toContain("items-center");
    expect(row.classes()).toContain("gap-x-3");
    expect(row.classes()).toContain("gap-y-1");
    expect(row.classes()).not.toContain("mt-2");
    expect(row.classes()).not.toContain("gap-3");
  });
});

describe("MessageTokenUsage step_debug", () => {
  const step = {
    id: "step-1",
    messageId: "ai-1",
    label: "Model call",
    secondaryLabels: ["web_search", "read_file"],
    sharedAttribution: true,
    usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
  };

  function mountDebug(steps: unknown[]) {
    mocks.buildTokenDebugSteps.mockReturnValue(steps);
    return mount(MessageTokenUsage, {
      props: { messages: [aiMessage], mode: "step_debug", loading: false },
    });
  }

  it("renders the secondary labels the model already computed", () => {
    const badges = mountDebug([step]).findAll("[data-slot='badge']");

    // 两颗 secondary + 右侧那颗 outline 总量。
    expect(badges).toHaveLength(3);
    expect(badges.slice(0, 2).map((badge) => badge.text())).toEqual([
      "web_search",
      "read_file",
    ]);
  });

  it("renders the shared-attribution note and the input/output split", () => {
    const text = mountDebug([step]).text();

    expect(text).toContain(enUS.tokenUsage.sharedAttribution);
    expect(text).toContain("Input: 120");
    expect(text).toContain("Output: 30");
    expect(text).toContain(`150 ${enUS.tokenUsage.label}`);
  });

  it("drops the badge row and the note when the step has neither", () => {
    const wrapper = mountDebug([
      { ...step, secondaryLabels: [], sharedAttribution: false },
    ]);

    expect(wrapper.findAll("[data-slot='badge']")).toHaveLength(1);
    expect(wrapper.text()).not.toContain(enUS.tokenUsage.sharedAttribution);
  });

  it("falls back to the short unavailable copy when usage is missing", () => {
    const text = mountDebug([{ ...step, usage: null }]).text();

    expect(text).toContain(enUS.tokenUsage.unavailableShort);
    expect(text).not.toContain("Input: 120");
  });

  it("keeps the upstream separator on the debug list too", () => {
    const list = mountDebug([step]).get("[data-testid='message-token-debug']");

    expect(list.classes()).toContain("mt-1");
    expect(list.classes()).toContain("border-border/60");
  });
});
