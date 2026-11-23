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
import { createAsyncGeneration } from "@/core/async/generation";
import { canPolishInput } from "@/core/input-polish/can-polish";
import { polishInputDraft } from "@/core/input-polish/api";
import {
  readableReferences,
  restoreReferenceLabels,
} from "@/core/mentions/inline-references";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

/** A request owns its original text and identity; later edits are never replaced. */
export function useComposerPolish(options: {
  text: Ref<string>;
  scope: MaybeRefOrGetter<string>;
  threadId: MaybeRefOrGetter<string>;
  disabled: MaybeRefOrGetter<boolean>;
  streaming: MaybeRefOrGetter<boolean>;
  slashQuery: MaybeRefOrGetter<string | null>;
}) {
  const { $i18n } = useNuxtApp();
  const toast = useWorkspaceToast();
  const original = ref<string | null>(null),
    rewritten = ref<string | null>(null),
    polishing = ref(false);
  const controller = shallowRef<AbortController | null>(null);
  const generation = createAsyncGeneration();
  const undoAvailable = computed(
    () =>
      !polishing.value &&
      original.value !== null &&
      rewritten.value !== null &&
      options.text.value === rewritten.value,
  );
  const disabled = computed(
    () =>
      toValue(options.disabled) ||
      polishing.value ||
      (!undoAvailable.value &&
        (toValue(options.streaming) ||
          toValue(options.slashQuery) !== null ||
          !canPolishInput(options.text.value))),
  );
  function cancel() {
    controller.value?.abort();
    generation.invalidate();
    controller.value = null;
    polishing.value = false;
    original.value = null;
    rewritten.value = null;
  }
  async function polish() {
    if (undoAvailable.value && original.value !== null) {
      options.text.value = original.value;
      original.value = null;
      rewritten.value = null;
      return;
    }
    if (disabled.value || !options.text.value.trim()) return;
    const text = options.text.value,
      scope = toValue(options.scope),
      token = generation.begin(scope);
    const request = new AbortController();
    controller.value?.abort();
    controller.value = request;
    original.value = text;
    polishing.value = true;
    try {
      const result = await polishInputDraft(
        {
          text: readableReferences(text),
          locale: $i18n.locale.value,
          thread_id: toValue(options.threadId),
        },
        { signal: request.signal },
      );
      if (
        request.signal.aborted ||
        !generation.isCurrent(token, toValue(options.scope)) ||
        options.text.value !== text
      )
        return;
      const next = result.rewritten_text.trim();
      if (!next || !result.changed) {
        toast.info($i18n.t.value.inputBox.inputPolishNoChanges);
        original.value = null;
        rewritten.value = null;
      } else {
        options.text.value = restoreReferenceLabels(text, next);
        rewritten.value = options.text.value;
      }
    } catch (error) {
      if (
        !request.signal.aborted &&
        generation.isCurrent(token, toValue(options.scope))
      ) {
        toast.error(
          error instanceof Error
            ? error.message
            : $i18n.t.value.inputBox.inputPolishFailed,
        );
        original.value = null;
        rewritten.value = null;
      }
    } finally {
      if (controller.value === request) {
        polishing.value = false;
        controller.value = null;
      }
    }
  }
  watch(() => toValue(options.scope), cancel, { flush: "sync" });
  onScopeDispose(cancel);
  return { polishing, undoAvailable, disabled, polish, cancel };
}
