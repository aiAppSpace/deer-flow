/** Follow-up admission and rendering through the mounted production chat consumer. */
import { flushPromises, type shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  mountAgentChatHarness as harness,
  agentChatStream as stream,
  agentChatAccount as account,
  agentChatTransport as transport,
  agentChatCallbacks as streamOptions,
  completedChatMessages as completed,
  deferredChatResponse as deferred,
  finishAgentChat as finish,
} from "./helpers/agent-chat-harness";
const suggestions = (wrapper: ReturnType<typeof shallowMount>) =>
  wrapper.findAll('[data-slot="suggestion"]');
const loading = (wrapper: ReturnType<typeof shallowMount>) =>
  wrapper.text().includes(enUS.inputBox.followupLoading);
function suggestionCalls() {
  return transport.fetch.mock.calls.filter(([url]) =>
    String(url).endsWith("/suggestions"),
  );
}

describe("AgentChat follow-up consumer", () => {
  it("queries configuration and renders loading, then suggestions; click offers and close clears", async () => {
    const pending = deferred<Response>();
    transport.fetch.mockImplementation(async (url: string) =>
      url.endsWith("/config")
        ? new Response(JSON.stringify({ enabled: true, max_suggestions: 3 }))
        : pending.promise,
    );
    const subject = harness();
    await flushPromises();
    expect(transport.fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/suggestions/config",
    );
    expect(loading(subject.wrapper)).toBe(false);
    expect(
      subject.wrapper.find('[data-slot="suggestions-list"]').exists(),
    ).toBe(false);
    finish();
    await flushPromises();
    expect(transport.usage).toHaveBeenCalledOnce();
    expect(suggestionCalls()).toHaveLength(1);
    expect(loading(subject.wrapper)).toBe(true);
    expect(suggestions(subject.wrapper)).toHaveLength(0);
    pending.resolve(
      new Response(JSON.stringify({ suggestions: ["Next question"] })),
    );
    await flushPromises();
    expect(loading(subject.wrapper)).toBe(false);
    expect(suggestions(subject.wrapper).map((chip) => chip.text())).toEqual([
      "Next question",
    ]);
    await suggestions(subject.wrapper)[0]!.trigger("click");
    expect(subject.offerFollowup).toHaveBeenCalledExactlyOnceWith(
      "Next question",
    );
    await subject.wrapper
      .get(`[aria-label="${enUS.common.close}"]`)
      .trigger("click");
    expect(
      subject.wrapper.find('[data-slot="suggestions-list"]').exists(),
    ).toBe(false);
  });

  it.each(
    (["bootstrap", "demo", "suppressed", "streaming"] as const).flatMap(
      (blocker) =>
        (["loading", "results"] as const).map((phase) => ({ blocker, phase })),
    ),
  )(
    "hides $phase for $blocker and restores it when that blocker clears",
    async ({ blocker, phase }) => {
      const subject = harness();
      await flushPromises();
      const pending = deferred<Response>();
      if (phase === "loading") {
        transport.fetch.mockImplementationOnce(() => pending.promise);
      }
      finish();
      await flushPromises();
      expect(loading(subject.wrapper)).toBe(phase === "loading");
      expect(suggestions(subject.wrapper)).toHaveLength(
        phase === "results" ? 1 : 0,
      );
      async function block(value: boolean) {
        if (blocker === "bootstrap" || blocker === "demo") {
          await subject.wrapper.setProps({ [blocker]: value });
        } else if (blocker === "suppressed") {
          subject.composer().vm.$emit("followups-suppressed-change", value);
        } else {
          stream.isStreaming.value = value;
        }
        await flushPromises();
      }
      await block(true);
      expect(suggestions(subject.wrapper)).toHaveLength(0);
      expect(loading(subject.wrapper)).toBe(false);
      await block(false);
      expect(loading(subject.wrapper)).toBe(phase === "loading");
      if (phase === "loading") {
        pending.resolve(
          new Response(JSON.stringify({ suggestions: ["Next question"] })),
        );
        await flushPromises();
      }
      expect(suggestions(subject.wrapper)).toHaveLength(1);
    },
  );

  it("keeps welcome empty even while the first completed run is generating suggestions", async () => {
    const pending = deferred<Response>();
    transport.fetch.mockImplementation(async (url: string) =>
      url.endsWith("/config")
        ? new Response(JSON.stringify({ enabled: true, max_suggestions: 3 }))
        : pending.promise,
    );
    const subject = harness({}, { threadId: "new" });
    await flushPromises();
    streamOptions.onStart?.("created-thread", "run-a");
    finish();
    await flushPromises();
    expect(suggestionCalls()).toHaveLength(1);
    expect(loading(subject.wrapper)).toBe(false);
    expect(suggestions(subject.wrapper)).toHaveLength(0);
    stream.messages.value = [...completed];
    await flushPromises();
    expect(loading(subject.wrapper)).toBe(true);
    pending.resolve(new Response(JSON.stringify({ suggestions: [] })));
    await flushPromises();
    expect(loading(subject.wrapper)).toBe(false);
    expect(
      subject.wrapper.find('[data-slot="suggestions-list"]').exists(),
    ).toBe(false);
  });

  it.each(["bootstrap", "demo"] as const)(
    "does not request configuration in initial %s",
    async (mode) => {
      const subject = harness({ [mode]: true });
      await flushPromises();
      expect(transport.fetch).not.toHaveBeenCalled();
      if (mode === "bootstrap") {
        finish();
        await flushPromises();
        expect(transport.usage).not.toHaveBeenCalled();
        expect(transport.fetch).not.toHaveBeenCalled();
      }
      expect(suggestions(subject.wrapper)).toHaveLength(0);
      expect(loading(subject.wrapper)).toBe(false);
    },
  );

  it("does not schedule old completion work after the account changes before its microtask", async () => {
    harness();
    await flushPromises();
    transport.fetch.mockClear();
    finish();
    account.value = { tag: "authenticated", user: { id: "bob" } };
    await flushPromises();
    expect(transport.usage).not.toHaveBeenCalled();
    expect(transport.fetch).not.toHaveBeenCalled();
  });

  it("retires the old request without letting its late result clear a new owner's loading UI", async () => {
    const old = deferred<Response>();
    const current = deferred<Response>();
    const subject = harness();
    await flushPromises();
    transport.fetch.mockImplementationOnce(() => old.promise);
    finish();
    await flushPromises();
    const oldSignal = suggestionCalls()[0]?.[1]?.signal as AbortSignal;
    expect(loading(subject.wrapper)).toBe(true);
    subject.route.params.thread_id = "thread-b";
    await flushPromises();
    expect(oldSignal.aborted).toBe(true);
    expect(loading(subject.wrapper)).toBe(false);
    transport.fetch.mockImplementationOnce(() => current.promise);
    finish();
    await flushPromises();
    expect(loading(subject.wrapper)).toBe(true);
    old.resolve(
      new Response(JSON.stringify({ suggestions: ["Old account answer"] })),
    );
    await flushPromises();
    expect(loading(subject.wrapper)).toBe(true);
    expect(suggestions(subject.wrapper)).toHaveLength(0);
    current.resolve(
      new Response(JSON.stringify({ suggestions: ["Current answer"] })),
    );
    await flushPromises();
    expect(suggestions(subject.wrapper).map((chip) => chip.text())).toEqual([
      "Current answer",
    ]);
    expect(loading(subject.wrapper)).toBe(false);
  });
});
