import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import {
  appendSpeechTranscript,
  getSpeechRecognitionConstructor,
  getSpeechRecognitionLanguage,
  mapSpeechRecognitionError,
  readSpeechRecognitionTranscript,
  shouldRestartSpeechRecognition,
  type BrowserSpeechRecognition,
  type SpeechRecognitionErrorKind,
} from "@/core/voice-input/speech-recognition";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

/** Speech callbacks belong to one draft identity and one recognition instance. */
export function useComposerVoice(options: {
  text: Ref<string>;
  scope: MaybeRefOrGetter<string>;
  locked: MaybeRefOrGetter<boolean>;
}) {
  const { $i18n } = useNuxtApp();
  const toast = useWorkspaceToast();
  const listening = ref(false),
    recognition = shallowRef<BrowserSpeechRecognition | null>(null);
  let base = "",
    lastError: SpeechRecognitionErrorKind | null = null,
    stopRequested = false;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  const supported = computed(
    () => import.meta.client && !!getSpeechRecognitionConstructor(globalThis),
  );
  function message(kind: SpeechRecognitionErrorKind) {
    const t = $i18n.t.value.inputBox;
    return kind === "permission_denied"
      ? t.voiceInputPermissionDenied
      : kind === "microphone_unavailable"
        ? t.voiceInputMicrophoneUnavailable
        : kind === "unsupported_language"
          ? t.voiceInputUnsupportedLanguage
          : kind === "network"
            ? t.voiceInputNetworkError
            : kind === "no_speech"
              ? t.voiceInputNoSpeech
              : t.voiceInputFailed;
  }
  function detach(current: BrowserSpeechRecognition) {
    current.onresult = null;
    current.onerror = null;
    current.onend = null;
  }
  function clearRestartTimer() {
    clearTimeout(restartTimer);
    restartTimer = undefined;
  }
  function stop(abort = true) {
    stopRequested = true;
    clearRestartTimer();
    const current = recognition.value;
    if (!current) {
      listening.value = false;
      return;
    }
    if (abort) {
      recognition.value = null;
      listening.value = false;
      detach(current);
      try {
        current.abort();
      } catch {
        /* The browser may have already ended it. */
      }
    } else {
      try {
        current.stop();
      } catch {
        recognition.value = null;
        listening.value = false;
        detach(current);
      }
    }
  }
  function start() {
    clearRestartTimer();
    if (toValue(options.locked)) return;
    const Constructor = getSpeechRecognitionConstructor(globalThis);
    if (!Constructor) {
      toast.error($i18n.t.value.inputBox.voiceInputUnsupported);
      return;
    }
    const current = new Constructor(),
      scope = toValue(options.scope);
    recognition.value = current;
    base = options.text.value;
    lastError = null;
    stopRequested = false;
    current.continuous = true;
    current.interimResults = true;
    current.maxAlternatives = 1;
    current.lang = getSpeechRecognitionLanguage($i18n.locale.value);
    const owned = () =>
      recognition.value === current &&
      scope === toValue(options.scope) &&
      !toValue(options.locked);
    current.onresult = (event) => {
      if (owned())
        options.text.value = appendSpeechTranscript(
          base,
          readSpeechRecognitionTranscript(event.results).text,
        );
    };
    current.onerror = (event) => {
      if (!owned()) return;
      lastError = mapSpeechRecognitionError(event.error);
      if (lastError !== "cancelled" && lastError !== "no_speech")
        toast.error(message(lastError));
    };
    current.onend = () => {
      if (recognition.value !== current) return;
      recognition.value = null;
      detach(current);
      if (
        !stopRequested &&
        scope === toValue(options.scope) &&
        !toValue(options.locked) &&
        shouldRestartSpeechRecognition(lastError)
      ) {
        // The recording session remains active while the browser recognizer restarts.
        restartTimer = setTimeout(start, 150);
      } else listening.value = false;
    };
    listening.value = true;
    try {
      current.start();
    } catch {
      recognition.value = null;
      listening.value = false;
      detach(current);
      toast.error($i18n.t.value.inputBox.voiceInputFailed);
    }
  }
  function toggle() {
    if (listening.value) stop(false);
    else start();
  }
  watch(
    () => toValue(options.scope),
    () => stop(),
    { flush: "sync" },
  );
  watch(
    () => toValue(options.locked),
    (locked) => {
      if (locked) stop();
    },
    { flush: "sync" },
  );
  onScopeDispose(() => stop());
  return { listening, supported, toggle, stop };
}
