/** Owns chat-panel coordination, browser presentation and automatic artifact selection.
 * Existing artifact drafts and sidecar sessions retain their single owners.
 */
import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import { useArtifactsPanel } from "@/composables/useArtifactsPanel";
import { useSidecar } from "@/composables/useSidecar";
import type { ThreadConsumptionObservation } from "@/core/diagnostics/parity-observation";
import { useSidecarSession } from "@/composables/useSidecarSession";
import { provideMessageDetails } from "@/components/workspace/message-details/context";
import {
  latestBrowserViewFrame,
  reconcileBrowserMessageFrame,
  type BrowserViewFrame,
} from "@/core/browser/frame";
import { buildWriteFileArtifactURL } from "@/core/artifacts/utils";
import { getMessageGroups, textOfMessage } from "@/core/messages/utils";
import type { ThreadRunContextInput } from "@/core/threads/submit";
import type { Message, ToolCall } from "@/core/types/message";

export interface ChatPanelsOptions {
  consumptionObservation?: MaybeRefOrGetter<
    ThreadConsumptionObservation | null | undefined
  >;
  threadId: MaybeRefOrGetter<string | null>;
  ownerKey?: MaybeRefOrGetter<string | undefined>;
  draftThreadId: MaybeRefOrGetter<string>;
  readonly: MaybeRefOrGetter<boolean>;
  context: MaybeRefOrGetter<ThreadRunContextInput>;
  messages: MaybeRefOrGetter<Message[]>;
  authoritativeArtifacts: MaybeRefOrGetter<readonly string[] | undefined>;
  browserEnabled: MaybeRefOrGetter<boolean>;
  stream: {
    messages: Readonly<Ref<Message[]>>;
    isStreaming: Readonly<Ref<boolean>>;
    isHistoryLoading: Readonly<Ref<boolean>>;
  };
}

export function useChatPanels(options: ChatPanelsOptions) {
  const routeThreadId = computed(() => toValue(options.threadId));
  const ownerKey = computed(() => toValue(options.ownerKey));
  const draftThreadId = computed(() => toValue(options.draftThreadId));
  const isDemo = computed(() => toValue(options.readonly));
  const context = computed(() => toValue(options.context));
  const authoritativeArtifacts = computed(() =>
    toValue(options.authoritativeArtifacts),
  );
  const browserEnabled = computed(() => toValue(options.browserEnabled));
  const stream = options.stream;
  const artifactPanel = useArtifactsPanel({
    threadId: routeThreadId,
    authoritativeArtifacts,
    historyLoading: stream.isHistoryLoading,
  });

  const sidecarParentThreadId = computed(() =>
    isDemo.value ? null : (routeThreadId.value ?? draftThreadId.value),
  );
  const sidecar = useSidecar({
    parentThreadId: sidecarParentThreadId,
    ownerKey,
    context,
  });
  const sidecarSession = useSidecarSession({
    consumptionObservation: options.consumptionObservation,
    parentThreadId: sidecarParentThreadId,
    ownerKey,
    readonly: isDemo,
    parentMessages: () => toValue(options.messages),
    sidecarThreadId: sidecar.sidecarThreadId,
    references: sidecar.activeReferences,
    context: sidecar.context,
    onReferencesAccepted: sidecar.clearActiveReferences,
  });
  const browserOpen = ref(false);
  const browserFrame = ref<BrowserViewFrame | null>(null);
  const observedBrowserMessageFrame = ref<BrowserViewFrame | null>(null);
  const lastAutoOpenedBrowserScreenshot = ref<string | null>(null);
  const latestBrowserFrame = computed(() =>
    latestBrowserViewFrame(toValue(options.messages)),
  );
  watch(
    [routeThreadId, ownerKey],
    () => {
      browserOpen.value = false;
      browserFrame.value = null;
      observedBrowserMessageFrame.value = null;
      lastAutoOpenedBrowserScreenshot.value = null;
    },
    { flush: "sync" },
  );
  watch(
    [latestBrowserFrame, browserEnabled],
    ([nextFrame, enabled]) => {
      if (!nextFrame) return;
      const reconciliation = reconcileBrowserMessageFrame(
        browserFrame.value,
        observedBrowserMessageFrame.value,
        nextFrame,
      );
      observedBrowserMessageFrame.value = reconciliation.observed;
      if (reconciliation.changed) {
        browserFrame.value = reconciliation.display;
      }
      if (
        enabled &&
        nextFrame.screenshot !== lastAutoOpenedBrowserScreenshot.value
      ) {
        lastAutoOpenedBrowserScreenshot.value = nextFrame.screenshot;
        browserOpen.value = true;
      }
    },
    { immediate: true },
  );
  watch(browserEnabled, (enabled) => {
    if (!enabled) browserOpen.value = false;
  });

  const messageDetails = provideMessageDetails(
    () =>
      JSON.stringify([
        ownerKey.value,
        routeThreadId.value ?? draftThreadId.value,
      ]),
    () => {
      if (!artifactPanel.close()) return false;
      sidecar.close();
      browserOpen.value = false;
      return true;
    },
  );
  watch(
    [sidecar.open, browserOpen, artifactPanel.open],
    ([sidecarActive, browserActive, artifactsActive]) => {
      if (sidecarActive || browserActive || artifactsActive)
        messageDetails.close({ restoreFocus: false });
    },
  );
  const activePanel = computed<
    "artifacts" | "sidecar" | "browser" | "details" | null
  >(() => {
    // React chat-box.tsx activeRightPanel also gives sidecar precedence over
    // browser and artifacts when several panels retain an open state.
    if (sidecar.open.value) return "sidecar";
    if (browserOpen.value && browserEnabled.value) return "browser";
    if (artifactPanel.open.value) return "artifacts";
    if (messageDetails.open.value) return "details";
    return null;
  });
  const panelOpen = computed(() => activePanel.value !== null);

  function openArtifact(path: string, automatic = false) {
    if (!artifactPanel.select(path, automatic)) return;
    browserOpen.value = false;
    sidecar.close();
  }

  const sidecarReconciling = ref(false);
  let reconciliationGeneration = 0;
  watch(
    [sidecarParentThreadId, ownerKey],
    () => {
      reconciliationGeneration++;
      sidecarReconciling.value = false;
    },
    { flush: "sync" },
  );
  async function toggleSidecar() {
    if (sidecar.open.value) {
      sidecar.close();
      return;
    }
    if (sidecarReconciling.value) return;
    const generation = ++reconciliationGeneration;
    sidecarReconciling.value = true;
    try {
      const restored = await sidecarSession.restore({ force: true });
      if (
        generation === reconciliationGeneration &&
        restored &&
        artifactPanel.close()
      ) {
        browserOpen.value = false;
        sidecar.open.value = true;
      }
    } finally {
      if (generation === reconciliationGeneration)
        sidecarReconciling.value = false;
    }
  }
  function openBrowser() {
    if (!artifactPanel.close()) return;
    sidecar.close();
    browserOpen.value = true;
  }
  function toggleBrowser() {
    if (browserOpen.value) {
      browserOpen.value = false;
      return;
    }
    openBrowser();
  }
  function acceptBrowserFrame(frame: BrowserViewFrame) {
    browserFrame.value = frame;
  }
  function openBrowserFrame(frame: BrowserViewFrame) {
    acceptBrowserFrame(frame);
    openBrowser();
  }
  function askInSidecar(payload: {
    message: Message;
    selectedText: string;
    displayIndex: number;
  }) {
    const next = sidecar.fromSelection(
      payload.message,
      payload.selectedText,
      payload.displayIndex,
    );
    if (!next) return;
    if (!artifactPanel.close()) return;
    sidecar.openContext(next);
  }

  function showArtifacts() {
    // React artifact-trigger.tsx retains browser state: an open browser keeps
    // priority until it closes, then the already-open artifact panel is shown.
    if (!artifactPanel.setOpen(true)) return;
    sidecar.close();
  }
  function addToConversation(payload: {
    message: Message;
    selectedText: string;
    displayIndex: number;
  }) {
    const next = sidecar.fromSelection(
      payload.message,
      payload.selectedText,
      payload.displayIndex,
    );
    if (next) sidecar.addContextToConversation(next);
  }

  const autoOpenArtifact = computed(() => {
    if (!artifactPanel.autoOpen.value || !artifactPanel.autoSelect.value)
      return null;
    const groups = getMessageGroups(stream.messages.value, {
      isCurrentTurnLoading: stream.isStreaming.value,
    });
    let target: string | null = null;
    for (const [groupIndex, group] of groups.entries()) {
      let lastCall: ToolCall | undefined;
      let lastCallMessageId: string | undefined;
      for (const message of group.messages) {
        if (message.type !== "ai") continue;
        for (const call of message.tool_calls ?? []) {
          if (call.name === "task") continue;
          lastCall = call;
          lastCallMessageId = message.id;
        }
      }
      const path = lastCall?.args?.path;
      if (!lastCall || typeof path !== "string") continue;
      const result = group.messages.find(
        (message) =>
          message.type === "tool" && message.tool_call_id === lastCall.id,
      );
      if (lastCall.name === "finalize_artifact_write") {
        if (result && textOfMessage(result).trimStart().startsWith("OK"))
          target = path;
      } else if (
        stream.isStreaming.value &&
        groupIndex === groups.length - 1 &&
        (lastCall.name === "write_file" || lastCall.name === "str_replace") &&
        !result
      ) {
        target = buildWriteFileArtifactURL({
          filepath: path,
          messageId: lastCallMessageId,
          toolCallId: lastCall.id,
        });
      }
    }
    return target;
  });
  watch(
    [autoOpenArtifact, routeThreadId, artifactPanel.selectedArtifact, ownerKey],
    ([target, , selected, owner], previous, onCleanup) => {
      if (previous.length && previous[3] !== owner) return;
      if (!target || selected === target) return;
      const timer = setTimeout(() => openArtifact(target, true), 100);
      onCleanup(() => clearTimeout(timer));
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    reconciliationGeneration++;
    sidecarReconciling.value = false;
    browserOpen.value = false;
    browserFrame.value = null;
    observedBrowserMessageFrame.value = null;
    lastAutoOpenedBrowserScreenshot.value = null;
  });
  return {
    artifactPanel,
    sidecar,
    sidecarSession,
    browserOpen,
    browserFrame,
    sidecarReconciling,
    messageDetails,
    activePanel,
    panelOpen,
    openArtifact,
    toggleSidecar,
    openBrowser,
    toggleBrowser,
    acceptBrowserFrame,
    openBrowserFrame,
    askInSidecar,
    showArtifacts,
    addToConversation,
  };
}
