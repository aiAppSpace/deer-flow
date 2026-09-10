<!--
  【文件职责】     新建/编辑托管 subagent 的表单对话框。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/dialog · ui/input · ui/textarea · ui/select · composables/useSubagents
  【边界与注意】   - `name` 是**主键且进 URL 路径段**，所以编辑时禁用、新建时只收
                   `[A-Za-z0-9-]`。改名等于删了重建，不是同一件事。
                 - 保存键的禁用条件与后端的必填一致（名字合法、描述和系统提示非空、
                   两个数字是正整数）。少一条，用户点下去只会拿到一个 422。
                 - 模型的「继承调用方」是一个**真实的取值** `inherit`，不是空——
                   后端据此决定用调用方的模型，与「没选」不是一回事。
-->

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useModels } from "@/composables/useModels";
import { useSubagentMutations } from "@/composables/useSubagents";
import {
  isValidManagedSubagentName,
  optionalNameListFromDraft,
  optionalNameListToDraft,
  positiveInteger,
  type OptionalNameListMode,
  type Subagent,
} from "@/core/subagents";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import OptionalNameListField from "./OptionalNameListField.vue";

const props = defineProps<{
  /** `null` 关闭；`"new"` 新建；给一条就是编辑它。 */
  value: Subagent | "new" | null;
}>();
const emit = defineEmits<{ close: [] }>();

const { $i18n } = useNuxtApp();
const labels = computed(() => $i18n.t.value.settings.subagents);
const toast = useWorkspaceToast();
const { models } = useModels();
const { create, update } = useSubagentMutations();

interface Draft {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  model: string;
  toolsMode: OptionalNameListMode;
  tools: string;
  skillsMode: OptionalNameListMode;
  skills: string;
  maxTurns: string;
  timeoutSeconds: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  displayName: "",
  description: "",
  systemPrompt: "",
  model: "inherit",
  toolsMode: "all",
  tools: "",
  skillsMode: "all",
  skills: "",
  maxTurns: "50",
  timeoutSeconds: "900",
};

function draftFrom(subagent: Subagent): Draft {
  const tools = optionalNameListToDraft(subagent.tools);
  const skills = optionalNameListToDraft(subagent.skills);
  return {
    name: subagent.name,
    displayName: subagent.display_name ?? "",
    description: subagent.description,
    systemPrompt: subagent.system_prompt ?? "",
    model: subagent.model,
    toolsMode: tools.mode,
    tools: tools.text,
    skillsMode: skills.mode,
    skills: skills.text,
    maxTurns: String(subagent.max_turns),
    timeoutSeconds: String(subagent.timeout_seconds),
  };
}

const draft = ref<Draft>({ ...EMPTY_DRAFT });
// 每次打开都重置：留着上一条的内容会让人以为是草稿。
watch(
  () => props.value,
  (value) => {
    draft.value =
      value && value !== "new" ? draftFrom(value) : { ...EMPTY_DRAFT };
  },
  { immediate: true },
);

const isNew = computed(() => props.value === "new");
const pending = computed(
  () => create.isPending.value || update.isPending.value,
);
const canSave = computed(
  () =>
    !pending.value &&
    isValidManagedSubagentName(draft.value.name) &&
    draft.value.description.trim().length > 0 &&
    draft.value.systemPrompt.trim().length > 0 &&
    positiveInteger(draft.value.maxTurns) !== null &&
    positiveInteger(draft.value.timeoutSeconds) !== null,
);

async function save() {
  const maxTurns = positiveInteger(draft.value.maxTurns);
  const timeoutSeconds = positiveInteger(draft.value.timeoutSeconds);
  if (maxTurns === null || timeoutSeconds === null) return;

  const payload = {
    display_name: draft.value.displayName.trim() || null,
    description: draft.value.description.trim(),
    system_prompt: draft.value.systemPrompt.trim(),
    model: draft.value.model,
    tools: optionalNameListFromDraft(draft.value.toolsMode, draft.value.tools),
    skills: optionalNameListFromDraft(
      draft.value.skillsMode,
      draft.value.skills,
    ),
    max_turns: maxTurns,
    timeout_seconds: timeoutSeconds,
  };
  try {
    if (isNew.value) {
      await create.mutateAsync({ name: draft.value.name.trim(), ...payload });
      toast.success(labels.value.created);
    } else if (props.value && props.value !== "new") {
      await update.mutateAsync({ name: props.value.name, request: payload });
      toast.success(labels.value.saved);
    }
    emit("close");
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  }
}
</script>

<template>
  <Dialog :open="value !== null" @update:open="!$event && emit('close')">
    <DialogContent
      class="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      :close-label="$i18n.t.value.primitives.close"
      data-testid="subagent-editor"
    >
      <DialogHeader>
        <DialogTitle>
          {{ isNew ? labels.createTitle : labels.editTitle }}
        </DialogTitle>
        <DialogDescription>{{ labels.description }}</DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-1 sm:grid-cols-2">
        <label class="space-y-1.5">
          <span class="text-sm font-medium">{{ labels.name }}</span>
          <Input v-model="draft.name" :disabled="!isNew" />
          <p v-if="isNew" class="text-muted-foreground text-xs">
            {{ labels.nameHint }}
          </p>
        </label>
        <label class="space-y-1.5">
          <span class="text-sm font-medium">{{ labels.displayName }}</span>
          <Input v-model="draft.displayName" />
        </label>
        <label class="space-y-1.5 sm:col-span-2">
          <span class="text-sm font-medium">{{ labels.descriptionLabel }}</span>
          <Textarea v-model="draft.description" />
        </label>
        <label class="space-y-1.5 sm:col-span-2">
          <span class="text-sm font-medium">{{ labels.systemPrompt }}</span>
          <Textarea v-model="draft.systemPrompt" class="min-h-32" />
        </label>
        <label class="space-y-1.5">
          <span class="text-sm font-medium">{{ labels.model }}</span>
          <Select v-model="draft.model">
            <SelectTrigger class="w-full" :aria-label="labels.model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">{{ labels.inheritModel }}</SelectItem>
              <SelectItem
                v-for="model in models"
                :key="model.name"
                :value="model.name"
              >
                {{ model.display_name || model.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label class="space-y-1.5">
          <span class="text-sm font-medium">{{ labels.tools }}</span>
          <OptionalNameListField
            :mode="draft.toolsMode"
            :text="draft.tools"
            :select-label="labels.tools"
            @update:mode="draft.toolsMode = $event"
            @update:text="draft.tools = $event"
          />
        </label>
        <label class="space-y-1.5">
          <span class="text-sm font-medium">{{ labels.skills }}</span>
          <OptionalNameListField
            :mode="draft.skillsMode"
            :text="draft.skills"
            :select-label="labels.skills"
            @update:mode="draft.skillsMode = $event"
            @update:text="draft.skills = $event"
          />
        </label>
        <label class="space-y-1.5">
          <span class="text-sm font-medium">{{ labels.maxTurns }}</span>
          <Input v-model="draft.maxTurns" type="number" min="1" step="1" />
        </label>
        <label class="space-y-1.5">
          <span class="text-sm font-medium">{{ labels.timeout }}</span>
          <Input
            v-model="draft.timeoutSeconds"
            type="number"
            min="1"
            step="1"
          />
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" :disabled="pending" @click="emit('close')">
          {{ $i18n.t.value.common.cancel }}
        </Button>
        <Button :disabled="!canSave" @click="save">
          {{
            pending ? $i18n.t.value.common.loading : $i18n.t.value.common.save
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
