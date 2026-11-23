import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { Agent } from "@/core/agents/types";
import {
  ALL_KNOWLEDGE_SCOPE,
  buildKnowledgeScopeSnapshot,
  cloneKnowledgeScopeSelection,
  knowledgeScopeToSelection,
  type KnowledgeScopeSelection,
} from "@/core/knowledge";

/** Per-conversation input choice; recovered turns keep their own message metadata. */
export function useConversationKnowledgeScope(options: {
  userId: MaybeRefOrGetter<string | null>;
  agentName: MaybeRefOrGetter<string | null | undefined>;
  conversationId: MaybeRefOrGetter<string>;
  isNewConversation: MaybeRefOrGetter<boolean>;
  visible: MaybeRefOrGetter<boolean>;
  agent: MaybeRefOrGetter<Agent | null>;
}) {
  const override = ref<KnowledgeScopeSelection | null>(null);
  const currentAgent = computed(() => {
    const agent = toValue(options.agent);
    return agent?.name === toValue(options.agentName) ? agent : null;
  });
  const agentKnowledgeEnabled = computed(
    () =>
      !toValue(options.agentName) ||
      (currentAgent.value !== null &&
        (currentAgent.value.tool_groups == null ||
          currentAgent.value.tool_groups.includes("knowledge"))),
  );
  watch(
    [
      () => toValue(options.userId),
      () => toValue(options.agentName),
      () => toValue(options.conversationId),
      () => toValue(options.isNewConversation),
    ],
    (
      [user, agent, id, isNew],
      [previousUser, previousAgent, previousId, wasNew],
    ) => {
      const adopted =
        user === previousUser && agent === previousAgent && wasNew && !isNew;
      if (
        !adopted &&
        (user !== previousUser ||
          agent !== previousAgent ||
          id !== previousId ||
          isNew !== wasNew)
      )
        override.value = null;
    },
    { flush: "sync" },
  );
  watch(
    () => toValue(options.visible),
    (visible) => {
      if (!visible && !toValue(options.agentName)) override.value = null;
    },
    { flush: "sync" },
  );
  const selection = computed<KnowledgeScopeSelection | null>({
    get: () =>
      !toValue(options.visible)
        ? null
        : (override.value ??
          (toValue(options.agentName)
            ? knowledgeScopeToSelection(currentAgent.value?.knowledge_scope)
            : ALL_KNOWLEDGE_SCOPE)),
    set: (value) => {
      override.value = value ? cloneKnowledgeScopeSelection(value) : null;
    },
  });
  const snapshot = computed(() =>
    toValue(options.visible) && agentKnowledgeEnabled.value && selection.value
      ? buildKnowledgeScopeSnapshot(selection.value)
      : null,
  );
  return { selection, snapshot, agentKnowledgeEnabled };
}
