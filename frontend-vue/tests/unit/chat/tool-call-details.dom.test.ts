import { flushPromises, mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProcessingMessageGroup from "@/components/chat/ProcessingMessageGroup.vue";
import ToolCallDetails from "@/components/chat/ToolCallDetails.vue";
import { deriveProcessingMessageView } from "@/core/messages/processing";
import { TOOL_PREVIEW_LIMIT } from "@/core/messages/tool-detail-preview";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message, ToolMessage } from "@/core/types/message";

const api = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock("@/core/clipboard", () => ({ writeTextToClipboard: api.copy }));
beforeEach(() => {
  api.copy.mockReset().mockResolvedValue(true);
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function group(content: string, status: "success" | "error" = "success") {
  const result: ToolMessage = {
    type: "tool",
    tool_call_id: "call-1",
    content,
    status,
  };
  const messages: Message[] = [
    {
      type: "ai",
      content: "",
      tool_calls: [
        { name: "mcp_lookup", id: "call-1", args: { run_id: "run-1" } },
      ],
    },
    result,
  ];
  return { messages, result };
}

describe("generic tool debug details", () => {
  it("uses scheduler labels, icons and stop styling through the actual processing consumer", async () => {
    const messages: Message[] = [
      {
        type: "ai",
        content: "",
        tool_calls: [
          {
            name: "schedule_task",
            id: "schedule-1",
            args: { action: "create" },
          },
          { name: "stop_scheduled_task", id: "stop-1", args: {} },
        ],
      },
      {
        type: "tool",
        tool_call_id: "schedule-1",
        content: '{"action":"create"}',
      },
      { type: "tool", tool_call_id: "stop-1", content: '{"paused":true}' },
    ];
    const wrapper = mount(ProcessingMessageGroup, {
      props: { messages, streaming: false, showToolDetails: true },
    });
    await wrapper.get('[data-testid="toggle-earlier-steps"]').trigger("click");
    const schedule = wrapper.get('[data-tool-name="schedule_task"]');
    expect(schedule.text()).toContain(enUS.toolCalls.scheduleTaskCreate);
    expect(schedule.find(".lucide-calendar-clock").exists()).toBe(true);
    const stop = wrapper.get('[data-testid="scheduled-stop-step"]');
    expect(stop.text()).toContain(enUS.toolCalls.stopScheduledTask);
    expect(stop.classes()).toContain("text-sky-700");
    expect(stop.classes()).toContain("dark:text-sky-400");
    expect(stop.find(".lucide-calendar-x-2").exists()).toBe(true);
    await stop.get("button").trigger("click");
    expect(stop.get('section[aria-label="Result"] pre').text()).toBe(
      '{"paused":true}',
    );
    wrapper.unmount();
  });
  it("keeps the full raw ToolMessage beside parsed display data and gates the actual processing consumer", async () => {
    const { messages, result } = group("9223372036854775807");
    expect(
      deriveProcessingMessageView(messages).lastToolCall?.resultMessage,
    ).toBe(result);
    const wrapper = mount(ProcessingMessageGroup, {
      props: { messages, streaming: false },
    });
    expect(wrapper.findComponent(ToolCallDetails).exists()).toBe(false);
    await wrapper.setProps({ showToolDetails: true });
    expect(
      wrapper.getComponent(ToolCallDetails).props("resultMessage"),
    ).toEqual(result);
    await wrapper
      .get('button[aria-label="Tool details: mcp_lookup (call-1)"]')
      .trigger("click");
    expect(wrapper.get('section[aria-label="Result"] pre').text()).toBe(
      result.content,
    );
    wrapper.unmount();
  });
  it.each([
    "9223372036854775807",
    '{"run_id":9223372036854775807,"ratio":0.1234567890123456789}',
    '{"same":1,"same":2}',
  ])(
    "renders and copies original tool text without parsing precision or duplicate keys: %s",
    async (content) => {
      const { result } = group(content);
      const wrapper = mount(ToolCallDetails, {
        props: {
          name: "lookup",
          callId: "call-1",
          args: { run_id: "run-1" },
          resultMessage: result,
        },
      });
      const trigger = wrapper.get(
        'button[aria-label="Tool details: lookup (call-1)"]',
      );
      expect(trigger.attributes("aria-expanded")).toBe("false");
      expect(wrapper.find('section[aria-label="Result"]').exists()).toBe(false);
      await trigger.trigger("click");
      expect(trigger.attributes("aria-expanded")).toBe("true");
      expect(wrapper.get('section[aria-label="Input"]').text()).toContain(
        "run-1",
      );
      expect(wrapper.get('section[aria-label="Call ID"]').text()).toContain(
        "call-1",
      );
      const payload = wrapper.get('section[aria-label="Result"]');
      expect(payload.get("pre").text()).toBe(content);
      await payload.get("button").trigger("click");
      await flushPromises();
      expect(api.copy).toHaveBeenCalledWith(content);
      expect(payload.get('[role="status"]').text()).toBe(
        enUS.clipboard.copiedToClipboard,
      );
      await trigger.trigger("click");
      expect(wrapper.find('section[aria-label="Result"]').exists()).toBe(false);
      wrapper.unmount();
    },
  );
  it("bounds error previews and copies exactly the displayed prefix with truncation feedback", async () => {
    const { result } = group("denied: " + "x".repeat(20_000), "error");
    const wrapper = mount(ToolCallDetails, {
      props: { name: "lookup", args: {}, resultMessage: result },
    });
    await wrapper.get("button").trigger("click");
    const error = wrapper.get('section[aria-label="Error"]');
    const preview = error.get("pre").text();
    expect(preview).toHaveLength(TOOL_PREVIEW_LIMIT);
    expect(preview.startsWith("denied: ")).toBe(true);
    expect(error.text()).toContain(enUS.toolCalls.truncated);
    await error.get("button").trigger("click");
    await flushPromises();
    expect(api.copy).toHaveBeenCalledWith(preview);
    wrapper.unmount();
  });
  it("distinguishes missing and empty results and reports clipboard failure", async () => {
    vi.useFakeTimers();
    const wrapper = mount(ToolCallDetails, {
      props: { name: "lookup", args: {} },
    });
    await wrapper.get("button").trigger("click");
    expect(wrapper.text()).toContain(enUS.toolCalls.noResult);
    await wrapper.setProps({ resultMessage: group("").result });
    const payload = wrapper.get('section[aria-label="Result"]');
    expect(payload.get("pre").text()).toBe('""');
    expect(payload.text()).toContain(enUS.toolCalls.emptyResult);
    api.copy.mockResolvedValueOnce(false);
    await payload.get("button").trigger("click");
    await flushPromises();
    expect(payload.get('[role="status"]').text()).toBe(
      enUS.clipboard.failedToCopyToClipboard,
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect(payload.get('[role="status"]').text()).toBe("");
    wrapper.unmount();
  });
});
