<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  ArrowUp,
  GraduationCap,
  Loader2,
  Lightbulb,
  MessageSquareText,
  Paperclip,
  Rocket,
  Trash2,
  X,
  Zap,
} from "lucide-vue-next";

import MessageList from "@/components/chat/MessageList.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConversationEmptyState } from "@/components/ui/conversation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ComposerAttachmentChip from "@/components/chat/ComposerAttachmentChip.vue";
import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import ModeHoverGuide from "@/components/chat/ModeHoverGuide.vue";
import ComposerSurface from "@/components/chat/ComposerSurface.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import type { SidecarSession } from "@/composables/useSidecarSession";
import type { SidecarReference } from "@/composables/useSidecar";
import { useModels } from "@/composables/useModels";
import { isImeComposing } from "@/core/input/ime";
import type { Model } from "@/core/models/types";
import {
  getResolvedMode,
  supportsThinking,
  isThinkingRequired,
  resolveReasoningEffort,
  reasoningEffortForMode,
  type InputMode,
} from "@/core/models/reasoning";
import {
  buildMessageSidecarContext,
  type SidecarContext,
} from "@/core/sidecar";
import type { ThreadRunContextInput } from "@/core/threads/submit";
import type { Message } from "@/core/types/message";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{
  session: SidecarSession;
  references: SidecarReference[];
  context: ThreadRunContextInput;
  active: boolean;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  "update:context": [value: ThreadRunContextInput];
  clearReferences: [];
  addReference: [value: SidecarContext];
  close: [];
  discard: [];
  deleted: [];
}>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();

const compositionActive = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const modelCatalog = useModels();
const models = computed<Model[]>(() => modelCatalog.models.value);
const deleteDialog = ref(false);
watch(
  () => props.session.fileError.value,
  (message) => {
    if (message) toast.error(message);
  },
);
watch(
  () => props.session.errorMessage.value,
  (message) => {
    if (message) toast.error(message);
  },
);
const localContext = reactive<ThreadRunContextInput>({ ...props.context });
const sessionInput = computed({
  get: () => props.session.input.value,
  set: (value: string) => props.session.setInput(value),
});
const composerBusy = computed(
  () =>
    props.session.submissionPending.value ||
    props.session.stream.isStreaming.value,
);

const composerDisabled = computed(
  () =>
    props.readonly ||
    (!props.session.threadId.value && props.references.length === 0) ||
    composerBusy.value ||
    (Boolean(props.session.threadId.value) &&
      props.session.stream.isHistoryLoading.value),
);

const headerSubtitle = computed(() => {
  const count = props.references.length;
  if (count === 0) {
    return props.session.threadId.value
      ? $i18n.t.value.sidecar.continuing
      : $i18n.t.value.sidecar.noContext;
  }
  return (
    count === 1
      ? $i18n.t.value.sidecar.selectedTextFragment
      : $i18n.t.value.sidecar.selectedTextFragments
  ).replace("{count}", String(count));
});

watch(
  () => props.context,
  (value) => {
    for (const key of Object.keys(localContext))
      Reflect.deleteProperty(localContext, key);
    Object.assign(localContext, value);
  },
  { deep: true },
);

const selectedModel = computed(
  () =>
    models.value.find((model) => model.name === localContext.model_name) ??
    models.value[0],
);

const modeOptions = computed(() => [
  {
    id: "flash",
    label: $i18n.t.value.inputBox.flashMode,
    description: $i18n.t.value.inputBox.flashModeDescription,
    icon: Zap,
    golden: false,
  },
  {
    id: "thinking",
    label: $i18n.t.value.inputBox.reasoningMode,
    description: $i18n.t.value.inputBox.reasoningModeDescription,
    icon: Lightbulb,
    golden: false,
  },
  {
    id: "pro",
    label: $i18n.t.value.inputBox.proMode,
    description: $i18n.t.value.inputBox.proModeDescription,
    icon: GraduationCap,
    golden: false,
  },
  {
    id: "ultra",
    label: $i18n.t.value.inputBox.ultraMode,
    description: $i18n.t.value.inputBox.ultraModeDescription,
    icon: Rocket,
    golden: true,
  },
]);

const availableModeOptions = computed(() =>
  supportsThinking(selectedModel.value)
    ? modeOptions.value.filter(
        (option) =>
          !isThinkingRequired(selectedModel.value) || option.id !== "flash",
      )
    : modeOptions.value.filter((option) => option.id === "flash"),
);

const resolvedActiveMode = computed(() =>
  getResolvedMode(
    localContext.mode as InputMode | undefined,
    selectedModel.value,
  ),
);
const activeMode = computed(
  () =>
    modeOptions.value.find(
      (option) => option.id === resolvedActiveMode.value,
    ) ?? modeOptions.value.find((option) => option.id === "pro")!,
);

function updateContext(next: ThreadRunContextInput) {
  for (const key of Object.keys(localContext)) {
    Reflect.deleteProperty(localContext, key);
  }
  Object.assign(localContext, next);
  emit("update:context", { ...localContext });
}
function selectMode(mode: string) {
  if (props.readonly) return;
  const next = getResolvedMode(mode as InputMode, selectedModel.value);
  updateContext({
    ...localContext,
    mode: next,
    reasoning_effort: reasoningEffortForMode(next, selectedModel.value),
  });
}
function selectModel(model: Model) {
  if (props.readonly) return;
  const mode = getResolvedMode(
    localContext.mode as InputMode | undefined,
    model,
  );
  updateContext({
    ...localContext,
    model_name: model.name,
    mode,
    reasoning_effort:
      localContext.mode !== mode
        ? reasoningEffortForMode(mode, model)
        : resolveReasoningEffort(model, localContext.reasoning_effort),
  });
}

watch(
  () => models.value,
  (list) => {
    if (list.length === 0) return;
    const model = selectedModel.value;
    if (model) selectModel(model);
  },
  { immediate: true },
);

function onKeydown(event: KeyboardEvent) {
  if (composerDisabled.value) return;
  if (isImeComposing(event, compositionActive.value)) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void props.session.submit();
  }
}
function addSelectedReference(payload: {
  message: Message;
  selectedText: string;
  displayIndex: number;
}) {
  const context = buildMessageSidecarContext(
    payload.message,
    payload.displayIndex,
    { selectedText: payload.selectedText },
  );
  if (context) emit("addReference", context);
}
function chooseFiles(event: Event) {
  if (props.readonly) return;
  const input = event.target as HTMLInputElement;
  props.session.addFiles(Array.from(input.files ?? []));
  input.value = "";
}

async function confirmDelete() {
  if (props.readonly) return;
  if (await props.session.deleteThread()) {
    toast.success($i18n.t.value.sidecar.deleteSuccess);
    emit("deleted");
    deleteDialog.value = false;
  }
}
</script>

<template>
  <div data-testid="sidecar-panel" class="flex size-full min-h-0 flex-col">
    <header
      class="border-border/70 flex h-12 shrink-0 items-center gap-2 border-b px-3"
    >
      <MessageSquareText class="text-muted-foreground size-4" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium">
          {{ $i18n.t.value.sidecar.title }}
        </div>
        <div class="text-muted-foreground truncate text-xs">
          {{ headerSubtitle }}
        </div>
      </div>
      <TooltipProvider>
        <Tooltip v-if="session.threadId.value && !readonly">
          <TooltipTrigger>
            <Button
              type="button"
              data-testid="sidecar-delete-button"
              :aria-label="$i18n.t.value.sidecar.delete"
              class="text-muted-foreground hover:text-destructive"
              size="icon-sm"
              variant="ghost"
              @click="deleteDialog = true"
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ $i18n.t.value.sidecar.delete }}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>
            <Button
              type="button"
              data-testid="sidecar-close-button"
              :aria-label="$i18n.t.value.common.close"
              class="text-muted-foreground hover:text-foreground"
              size="icon-sm"
              variant="ghost"
              @click="session.threadId.value ? emit('close') : emit('discard')"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ $i18n.t.value.common.close }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </header>

    <div v-if="!session.threadId.value" class="min-h-0 flex-1">
      <ConversationEmptyState
        :title="$i18n.t.value.sidecar.emptyTitle"
        :description="$i18n.t.value.sidecar.emptyDescription"
      >
        <template #icon><MessageSquareText class="size-5" /></template>
      </ConversationEmptyState>
    </div>
    <MessageList
      v-else
      data-testid="sidecar-message-list"
      test-id="sidecar-message-list"
      selection-mode="sidecar"
      :padding-bottom="12"
      :messages="session.stream.messages.value"
      :raw-messages="session.stream.messages.value"
      :tool-artifacts="session.stream.state.value.tool_artifacts"
      :streaming="session.stream.isStreaming.value"
      :streaming-message-ids="session.stream.streamingMessageIds.value"
      :loading="session.stream.isHistoryLoading.value"
      :thread-id="session.threadId.value"
      :thread-error="session.stream.error.value"
      :submit-human-input="session.submitHumanInput"
      :interactive="!readonly"
      :active="active"
      initial-scroll="instant"
      resize-scroll="instant"
      @selection-add="addSelectedReference"
    />

    <div
      class="bg-background/95 relative flex shrink-0 flex-col gap-2 px-3 pt-3 pb-4 sm:px-4"
    >
      <form
        class="mx-auto w-full"
        :aria-busy="composerBusy"
        @submit.prevent="!composerDisabled && session.submit()"
      >
        <ComposerSurface test-id="sidecar-composer-surface" variant="sidecar">
          <div
            v-if="session.selectedFiles.value.length || references.length"
            role="group"
            data-slot="input-group-header"
          >
            <ComposerAttachmentChip
              v-for="file in session.selectedFiles.value"
              :key="`${file.name}:${file.size}:${file.lastModified}`"
              :file="file"
              @remove="session.removeFile(file)"
            />
            <ReferenceAttachment
              :references="references"
              test-id="sidecar-reference-attachment"
              clearable
              @clear="emit('clearReferences')"
            />
          </div>
          <div data-slot="input-group-body">
            <textarea
              v-model="sessionInput"
              name="message"
              data-slot="input-group-control"
              :placeholder="$i18n.t.value.sidecar.placeholder"
              :readonly="composerDisabled"
              :aria-disabled="composerDisabled || undefined"
              rows="1"
              class="field-sizing-content max-h-36 min-h-16 w-full min-w-0 resize-none bg-transparent px-3 py-3 text-sm outline-none focus-visible:ring-0 focus-visible:outline-none"
              @keydown="onKeydown"
              @compositionstart="compositionActive = true"
              @compositionend="compositionActive = false"
            />
          </div>

          <div
            role="group"
            data-slot="input-group-footer"
            class="flex-wrap gap-2!"
          >
            <div class="flex min-w-0 grow flex-wrap items-center gap-1">
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="px-2!"
                    data-testid="sidecar-add-attachments-button"
                    :aria-label="$i18n.t.value.inputBox.addAttachments"
                    :disabled="readonly"
                    @click="!readonly && fileInput?.click()"
                  >
                    <Paperclip class="size-3" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" class="w-56">
                  {{ $i18n.t.value.inputBox.addAttachments }}
                </TooltipContent>
              </Tooltip>
              <input
                ref="fileInput"
                type="file"
                multiple
                :aria-label="$i18n.t.value.inputBox.uploadFiles"
                class="hidden"
                @change="chooseFiles"
              />
              <DropdownMenu :disabled="readonly">
                <DropdownMenuTrigger>
                  <ModeHoverGuide
                    :label="activeMode.label"
                    :description="activeMode.description"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid="sidecar-mode-trigger"
                      :disabled="readonly"
                      class="max-w-20 min-w-0 gap-1! px-2!"
                    >
                      <div>
                        <component
                          :is="activeMode.icon"
                          class="size-3"
                          :class="activeMode.golden ? 'text-[#dabb5e]' : ''"
                        />
                      </div>
                      <div
                        class="truncate text-xs font-normal"
                        :class="activeMode.golden ? 'golden-text' : ''"
                      >
                        {{ activeMode.label }}
                      </div>
                    </Button>
                  </ModeHoverGuide>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" side="top" class="w-80">
                  <DropdownMenuRadioGroup
                    :model-value="resolvedActiveMode"
                    @update:model-value="selectMode(String($event))"
                  >
                    <DropdownMenuLabel class="text-muted-foreground text-xs">
                      {{ $i18n.t.value.inputBox.mode }}
                    </DropdownMenuLabel>
                    <DropdownMenuRadioItem
                      v-for="mode in availableModeOptions"
                      :key="mode.id"
                      :value="mode.id"
                      class="py-2"
                      :class="
                        resolvedActiveMode === mode.id
                          ? 'text-accent-foreground'
                          : 'text-muted-foreground/65'
                      "
                    >
                      <span class="flex flex-col gap-2">
                        <span class="flex items-center gap-1 font-bold">
                          <component
                            :is="mode.icon"
                            class="mr-2 size-4"
                            :class="
                              resolvedActiveMode === mode.id
                                ? mode.golden
                                  ? 'text-[#dabb5e]'
                                  : 'text-accent-foreground'
                                : ''
                            "
                          />
                          <span
                            :class="
                              resolvedActiveMode === mode.id && mode.golden
                                ? 'golden-text'
                                : ''
                            "
                            >{{ mode.label }}</span
                          >
                        </span>
                        <span class="pl-7 text-xs">{{ mode.description }}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div class="flex min-w-0 grow items-center justify-end gap-1">
              <ComposerModelSelector
                v-if="selectedModel"
                class="sidecar-model-control"
                test-id="sidecar-model-selector"
                :models="models"
                :selected-model="selectedModel"
                :disabled="readonly"
                @select="selectModel"
              />

              <Tooltip>
                <TooltipTrigger>
                  <Button
                    type="submit"
                    variant="outline"
                    size="icon-sm"
                    class="rounded-full shadow-none"
                    :aria-label="$i18n.t.value.primitives.submit"
                    :disabled="composerDisabled"
                  >
                    <Loader2 v-if="composerBusy" class="size-4 animate-spin" />
                    <ArrowUp v-else class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {{ $i18n.t.value.sidecar.send }}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </ComposerSurface>
      </form>
    </div>
  </div>

  <Dialog
    :open="deleteDialog"
    @update:open="!$event && !session.deleting.value && (deleteDialog = false)"
  >
    <DialogContent
      :close-label="$i18n.t.value.common.close"
      :show-close="!session.deleting.value"
      class="w-[min(92vw,28rem)]"
      @escape-key-down="session.deleting.value && $event.preventDefault()"
      @interact-outside="session.deleting.value && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle class="text-base">
          {{ $i18n.t.value.sidecar.delete }}
        </DialogTitle>
        <DialogDescription>
          {{ $i18n.t.value.sidecar.deleteConfirm }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          :disabled="session.deleting.value"
          @click="deleteDialog = false"
        >
          {{ $i18n.t.value.common.cancel }}
        </Button>
        <Button
          data-testid="sidecar-delete-confirm-button"
          variant="destructive"
          size="sm"
          :disabled="session.deleting.value"
          @click="confirmDelete"
        >
          {{
            session.deleting.value
              ? $i18n.t.value.common.loading
              : $i18n.t.value.common.delete
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
@media (max-width: 999px) {
  :deep(.sidecar-model-control) {
    display: none;
  }
}
</style>
