import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useComposerVoice } from "@/composables/useComposerVoice";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import type { BrowserSpeechRecognition } from "@/core/voice-input/speech-recognition";

const recognizers: Recognizer[] = [];
class Recognizer implements BrowserSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  onresult: BrowserSpeechRecognition["onresult"] = null;
  onerror: BrowserSpeechRecognition["onerror"] = null;
  onend: BrowserSpeechRecognition["onend"] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    recognizers.push(this);
  }
  result(text: string) {
    this.onresult?.({
      results: {
        0: { 0: { transcript: text }, isFinal: true, length: 1 },
        length: 1,
      },
    });
  }
}
const wrappers: ReturnType<typeof mount>[] = [];
function host() {
  const text = ref("Draft"),
    scope = ref("account-a:thread-a"),
    locked = ref(false);
  let voice!: ReturnType<typeof useComposerVoice>;
  const wrapper = mount(
    defineComponent({
      setup() {
        voice = useComposerVoice({ text, scope, locked });
        return () =>
          h(
            "button",
            { onClick: voice.toggle },
            voice.listening.value ? "Stop" : "Start",
          );
      },
    }),
    {
      global: {
        provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
      },
    },
  );
  wrappers.push(wrapper);
  return { wrapper, voice, text, scope, locked };
}
beforeEach(() => {
  recognizers.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal("SpeechRecognition", Recognizer);
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("keeps the user session active through restart delay so Stop cancels its pending recognizer", () => {
  const { voice } = host();
  voice.toggle();
  recognizers[0]!.onend?.();
  expect(voice.listening.value).toBe(true);
  voice.toggle();
  vi.advanceTimersByTime(150);
  expect(recognizers).toHaveLength(1);
  expect(voice.listening.value).toBe(false);
});
it("preserves captured text across an automatic recognizer restart", () => {
  const { voice, text } = host();
  voice.toggle();
  recognizers[0]!.result("first");
  recognizers[0]!.onend?.();
  vi.advanceTimersByTime(150);
  recognizers[1]!.result("second");
  expect(text.value).toBe("Draft first second");
  expect(voice.listening.value).toBe(true);
});
it("waits for normal stop completion and accepts its final transcript without spawning another recognizer", () => {
  const { voice, text } = host();
  voice.toggle();
  voice.toggle();
  expect(voice.listening.value).toBe(true);
  voice.toggle();
  expect(recognizers).toHaveLength(1);
  recognizers[0]!.result("final");
  recognizers[0]!.onend?.();
  expect(text.value).toBe("Draft final");
  expect(voice.listening.value).toBe(false);
  vi.advanceTimersByTime(150);
  expect(recognizers).toHaveLength(1);
});
it.each(["scope", "locked", "dispose"] as const)(
  "retires callbacks and pending restart on %s",
  (boundary) => {
    const { voice, text, scope, locked, wrapper } = host();
    voice.toggle();
    const staleResult = recognizers[0]!.onresult!;
    recognizers[0]!.onend?.();
    if (boundary === "scope") scope.value = "account-b:thread-b";
    else if (boundary === "locked") locked.value = true;
    else wrapper.unmount();
    staleResult({
      results: {
        0: { 0: { transcript: "stale" }, isFinal: true, length: 1 },
        length: 1,
      },
    });
    vi.advanceTimersByTime(150);
    expect(recognizers).toHaveLength(1);
    expect(text.value).toBe("Draft");
    expect(voice.listening.value).toBe(false);
  },
);
it("retires a browser instance even if its abort reports that it already ended", () => {
  const { voice, wrapper } = host();
  voice.toggle();
  recognizers[0]!.abort.mockImplementationOnce(() => {
    throw new Error("Already ended");
  });
  expect(() => wrapper.unmount()).not.toThrow();
  expect(recognizers[0]!.onresult).toBeNull();
  expect(recognizers[0]!.onerror).toBeNull();
  expect(recognizers[0]!.onend).toBeNull();
});
