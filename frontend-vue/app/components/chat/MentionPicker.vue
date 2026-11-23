<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from "vue";
import {
  Check,
  File,
  MessagesSquare,
  Puzzle,
  Sparkles,
  Upload,
  X,
} from "lucide-vue-next";
import { useInfiniteProjectDocuments } from "@/composables/useProjectDocuments";
import { useThreads } from "@/composables/useThreads";
import { useExtensionMentions } from "@/composables/useFrontendExtensions";
import type { ConversationReference } from "@/core/conversation-references";
import type { ExtensionMention } from "@/core/extensions/contracts";
import {
  extensionMentionId,
  MAX_EXTENSION_MENTIONS,
} from "@/core/extensions/mentions";
import { MAX_EXPLICIT_SKILLS } from "@/core/mentions/inline-references";
import { isCompositionConfirmEnter, isImeComposing } from "@/core/input/ime";
import type { ProjectDocument } from "@/core/projects";
import type { Skill } from "@/core/skills/type";
import { titleOfThread } from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";

export type MentionSelection =
  | { kind: "skill"; skill: Skill }
  | { kind: "file"; document: ProjectDocument }
  | { kind: "conversation"; reference: ConversationReference }
  | { kind: "extension"; reference: ExtensionMention }
  | { kind: "upload" };
type Option = {
  id: string;
  label: string;
  description?: string;
  selection: MentionSelection;
  disabled?: boolean;
  selected?: boolean;
};
const props = defineProps<{
  listId: string;
  query: string;
  searchInput?: boolean;
  skills: Skill[];
  skillsLoading?: boolean;
  skillsError?: unknown;
  selectedSkills: string[];
  selectedExtensions: string[];
  references: ConversationReference[];
  capability: {
    enabled: boolean;
    maxReferences: number;
    isLoading: boolean;
    error?: unknown;
  };
  threadId: string;
  projectId?: string | null;
  busy: boolean;
  error: string | null;
}>();
const emit = defineEmits<{
  select: [selection: MentionSelection];
  close: [];
  activeOptionChange: [id: string | undefined];
  retrySkills: [];
  retryCapability: [];
}>();
const { $i18n } = useNuxtApp();
const labels = computed(() => $i18n.t.value.inputBox);
const search = ref("");
const searchElement = ref<HTMLInputElement | null>(null);
const activeId = ref<string | null>(null);
const compositionEndedAt = ref(-Infinity);
const filter = computed(() =>
  (props.searchInput ? search.value : props.query).toLocaleLowerCase(),
);
const documents = useInfiniteProjectDocuments(() => props.projectId ?? "");
const conversations = useThreads({
  archived: "all",
  enabled: () => props.capability.enabled,
});
const extensions = useExtensionMentions(
  () => props.threadId,
  () => (props.searchInput ? search.value : props.query),
);
const options = computed(() => {
  const result: Option[] = props.skills
    .filter((skill) => skill.enabled)
    .map((skill) => ({
      id: `skill:${skill.name}`,
      label: skill.name,
      description: skill.description,
      selection: { kind: "skill", skill },
      selected: props.selectedSkills.includes(skill.name),
      disabled:
        !props.selectedSkills.includes(skill.name) &&
        new Set(props.selectedSkills).size >= MAX_EXPLICIT_SKILLS,
    }));
  for (const document of documents.data.value?.pages.flatMap(
    (page) => page.documents,
  ) ?? [])
    result.push({
      id: `file:${document.id}`,
      label: document.name,
      description: document.content_missing
        ? labels.value.mentionUnavailable
        : undefined,
      selection: { kind: "file", document },
      disabled: document.content_missing,
    });
  if (props.capability.enabled)
    for (const thread of conversations.threads) {
      if (thread.thread_id === props.threadId) continue;
      const selected = props.references.some(
        (item) => item.threadId === thread.thread_id,
      );
      result.push({
        id: `conversation:${thread.thread_id}`,
        label: titleOfThread(thread, $i18n.t.value.pages.untitled),
        selection: {
          kind: "conversation",
          reference: {
            threadId: thread.thread_id,
            title: titleOfThread(thread, $i18n.t.value.pages.untitled),
            agentName: agentNameOfThread(thread),
          },
        },
        selected,
        disabled:
          !selected &&
          props.references.length >= props.capability.maxReferences,
      });
    }
  const filtered = result.filter((option) =>
    `${option.label} ${option.description ?? ""}`
      .toLocaleLowerCase()
      .includes(filter.value),
  );
  for (const reference of extensions.items.value) {
    const id = extensionMentionId(reference);
    filtered.push({
      id: `extension:${id}`,
      label: reference.label,
      description: reference.description,
      selection: { kind: "extension", reference },
      selected: props.selectedExtensions.includes(id),
      disabled:
        !props.selectedExtensions.includes(id) &&
        new Set(props.selectedExtensions).size >= MAX_EXTENSION_MENTIONS,
    });
  }
  filtered.push({
    id: "upload",
    label: labels.value.mentionUpload,
    selection: { kind: "upload" },
  });
  return filtered;
});
const available = computed(() =>
  options.value.filter((item) => !item.disabled),
);
const active = computed(
  () =>
    available.value.find((item) => item.id === activeId.value) ??
    (filter.value
      ? available.value.find((item) => item.selection.kind !== "upload")
      : available.value[0]),
);
const optionId = (id: string) => `${props.listId}-${encodeURIComponent(id)}`;
function agentNameOfThread(thread: AgentThread) {
  const name = thread.context?.agent_name ?? thread.metadata?.agent_name;
  return typeof name === "string" && name ? name : undefined;
}
const activeOptionId = computed(() =>
  active.value ? optionId(active.value.id) : undefined,
);
watch(
  activeOptionId,
  async (id) => {
    emit("activeOptionChange", props.searchInput ? undefined : id);
    await nextTick();
    if (id) document.getElementById(id)?.scrollIntoView?.({ block: "nearest" });
  },
  { immediate: true },
);
onScopeDispose(() => emit("activeOptionChange", undefined));
onMounted(() => searchElement.value?.focus());
function choose(option: Option) {
  if (!props.busy && !option.disabled) emit("select", option.selection);
}
function onKeyDown(event: KeyboardEvent) {
  if (isCompositionConfirmEnter(event, compositionEndedAt.value)) {
    event.preventDefault();
    return;
  }
  if (isImeComposing(event)) return;
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const index = available.value.findIndex(
      (item) => item.id === active.value?.id,
    );
    activeId.value =
      available.value[
        (index +
          (event.key === "ArrowDown" ? 1 : -1) +
          available.value.length) %
          available.value.length
      ]?.id ?? null;
  } else if (event.key === "Enter" && !event.shiftKey && active.value) {
    event.preventDefault();
    choose(active.value);
  }
}
const loading = computed(
  () =>
    extensions.loading.value ||
    props.skillsLoading ||
    props.capability.isLoading ||
    (!!props.projectId && documents.isPending.value) ||
    (props.capability.enabled && conversations.loading),
);
const failed = computed(
  () =>
    extensions.failed.value ||
    !!props.capability.error ||
    !!props.skillsError ||
    (!!props.projectId && documents.isError.value) ||
    (props.capability.enabled && !!conversations.error),
);
const groups = computed(() => [
  { kind: "skill", title: labels.value.mentionSkills, icon: Sparkles },
  { kind: "file", title: labels.value.mentionFiles, icon: File },
  {
    kind: "conversation",
    title: labels.value.mentionConversations,
    icon: MessagesSquare,
  },
  { kind: "extension", title: labels.value.mentionExtensions, icon: Puzzle },
  { kind: "upload", title: "", icon: Upload },
]);
function retry() {
  if (extensions.failed.value) extensions.retry();
  if (props.capability.error) emit("retryCapability");
  if (props.skillsError) emit("retrySkills");
  if (props.projectId && documents.isError.value) void documents.refetch();
  if (props.capability.enabled && conversations.error)
    void conversations.loadInitial(true);
}
function loadMore() {
  if (documents.hasNextPage.value) void documents.fetchNextPage();
  if (props.capability.enabled && conversations.hasMore)
    void conversations.loadMore();
}
defineExpose({ onKeyDown });
</script>

<template>
  <div
    class="bg-popover text-popover-foreground border-border rounded-xl border p-2 shadow-lg"
    data-testid="mention-picker"
  >
    <div class="flex items-center gap-2 px-2 pb-2">
      <input
        v-if="searchInput"
        ref="searchElement"
        v-model="search"
        :aria-label="labels.mentionSearch"
        class="min-w-0 flex-1 bg-transparent text-sm outline-none"
        role="combobox"
        aria-expanded="true"
        :aria-controls="listId"
        :aria-activedescendant="activeOptionId"
        aria-autocomplete="list"
        :placeholder="labels.mentionSearch"
        @input="activeId = null"
        @keydown="onKeyDown"
        @compositionend="compositionEndedAt = Date.now()"
      />
      <span v-else class="flex-1 text-sm font-medium">{{
        labels.mentionPicker
      }}</span>
      <button
        type="button"
        :aria-label="labels.mentionClose"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>
    </div>
    <div
      :id="listId"
      role="listbox"
      aria-multiselectable="true"
      :aria-label="labels.mentionPicker"
      :aria-busy="busy || loading"
      class="max-h-72 overflow-y-auto"
    >
      <template v-for="group in groups" :key="group.kind">
        <div
          v-if="options.some((item) => item.selection.kind === group.kind)"
          role="group"
          :aria-label="group.title || labels.mentionUpload"
        >
          <div
            v-if="group.title"
            class="text-muted-foreground px-2 py-1 text-xs"
          >
            {{ group.title }}
          </div>
          <button
            v-for="option in options.filter(
              (item) => item.selection.kind === group.kind,
            )"
            :id="optionId(option.id)"
            :key="option.id"
            type="button"
            role="option"
            :aria-selected="option.selected === true"
            :aria-disabled="busy || option.disabled"
            :disabled="busy || option.disabled"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm disabled:opacity-40"
            :class="
              active?.id === option.id ? 'bg-accent text-accent-foreground' : ''
            "
            @mousedown.prevent
            @pointermove="
              ($event.pointerType === 'mouse' ||
                $event.pointerType === 'pen') &&
              ($event.movementX || $event.movementY) &&
              (activeId = option.id)
            "
            @click="choose(option)"
          >
            <component :is="group.icon" class="size-4 shrink-0" />
            <span class="min-w-0 flex-1"
              ><span class="block truncate">{{ option.label }}</span
              ><span
                v-if="option.description"
                class="text-muted-foreground block truncate text-xs"
                >{{ option.description }}</span
              ></span
            >
            <Check v-if="option.selected" class="size-4 shrink-0" />
          </button>
        </div>
      </template>
    </div>
    <p
      v-if="options.length === 1 && !loading && !failed"
      class="text-muted-foreground px-2 py-2 text-xs"
    >
      {{ labels.mentionEmpty }}
    </p>
    <p v-if="loading" role="status" class="px-2 py-2 text-xs">
      {{ labels.mentionLoading }}
    </p>
    <div v-if="failed" role="alert" class="px-2 text-xs">
      {{ labels.mentionFailed }}
      <button type="button" @click="retry">{{ labels.mentionRetry }}</button>
    </div>
    <button
      v-if="
        documents.hasNextPage.value ||
        (capability.enabled && conversations.hasMore)
      "
      type="button"
      class="px-2 py-2 text-xs underline disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="
        documents.isFetchingNextPage.value || conversations.loadingMore
      "
      @click="loadMore"
    >
      {{ labels.mentionLoadMore }}
    </button>
    <p v-if="!projectId" class="text-muted-foreground px-2 py-1 text-xs">
      {{ labels.mentionNoProject }}
    </p>
    <p class="text-muted-foreground px-2 py-1 text-xs">
      {{ labels.mentionMultipleSkills }}
    </p>
    <p
      v-if="capability.enabled"
      class="text-muted-foreground px-2 py-1 text-xs"
    >
      {{ labels.referenceConversationsLimit(capability.maxReferences) }}
    </p>
    <p v-if="busy" role="status" class="px-2 py-1 text-xs">
      {{ labels.mentionAttaching }}
    </p>
    <p v-if="error" role="alert" class="text-destructive px-2 py-1 text-xs">
      {{ error }}
    </p>
  </div>
</template>
