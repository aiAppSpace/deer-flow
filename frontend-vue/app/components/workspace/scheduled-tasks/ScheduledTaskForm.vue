<script setup lang="ts">
/*
  【文件职责】     Scheduled-task 新建表单与 recipe 快捷填充。
  【架构位置】     L3 scheduled-task form component
  【主要导出】     默认 ScheduledTaskForm
  【依赖关系】     ui/button · ScheduledTaskScheduleInput · scheduled-tasks form/recipes
  【边界与注意】   容器是 `<div>` 不是 `<form>`：React 那一块也是 div，所以在标题框里按
                   回车什么都不会发生。换成 `<form>` 会凭空多出一条「回车即提交」的路径，
                   而它在另一个应用上不存在。

                   recipe 是一行内联按钮，可访问名只有标题：emoji 挂 `aria-hidden`，
                   描述不进按钮。卡片版把 emoji 和整句描述都念进名字里，读屏器听到的是
                   「📰 Daily tech news digest Collect and summarize the day's top tech
                   news」这样一长串。

                   输入框只有 placeholder，没有可见 label：加 `<label>` 会在树里多出
                   一个 text 节点，React 那边只有一个 textbox。

                   context mode 是两颗按钮，不是 `<select>`。
*/
import { computed, ref } from "vue";

import ScheduledTaskScheduleInput from "./ScheduledTaskScheduleInput.vue";
import { TriangleAlert } from "lucide-vue-next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  applyScheduledTaskRecipe,
  isScheduledTaskDraftComplete,
  type ScheduledTaskDraft,
} from "@/core/scheduled-tasks/form";
import { RECIPES, type Recipe } from "@/core/scheduled-tasks/recipes";
import type { ScheduleValue } from "@/core/scheduled-tasks/schedule";

const props = defineProps<{
  draft: ScheduledTaskDraft;
  pending: boolean;
  error?: string | null;
}>();
const emit = defineEmits<{
  "update:draft": [draft: ScheduledTaskDraft];
  submit: [];
}>();
const { $i18n } = useNuxtApp();

const labels = computed(() => $i18n.t.value.scheduledTasks);
/** 应用 recipe 要让 ScheduleInput 重新挂载，与 React 的 createNonce 同一件事。 */
const scheduleNonce = ref(0);

function patch(next: Partial<ScheduledTaskDraft>) {
  emit("update:draft", { ...props.draft, ...next });
}

function applyRecipe(recipe: Recipe) {
  emit(
    "update:draft",
    applyScheduledTaskRecipe(
      props.draft,
      recipe,
      labels.value.recipes[recipe.titleKey].title,
    ),
  );
  scheduleNonce.value += 1;
}

const submitDisabled = computed(
  () => props.pending || !isScheduledTaskDraftComplete(props.draft),
);
const inputClass =
  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm";
const textareaClass =
  "border-input placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] md:text-sm";
</script>

<template>
  <div
    class="grid gap-2 rounded-lg border p-4"
    data-testid="scheduled-task-create-form"
  >
    <div class="font-medium">{{ labels.create.title }}</div>
    <div
      class="flex flex-wrap items-center gap-1"
      data-testid="schedule-recipes"
    >
      <span class="text-muted-foreground text-sm">
        {{ labels.recipes.label }}:
      </span>
      <Button
        v-for="recipe in RECIPES"
        :key="recipe.id"
        :data-testid="`scheduled-task-recipe-${recipe.id}`"
        variant="outline"
        size="sm"
        @click="applyRecipe(recipe)"
      >
        <span aria-hidden="true">{{ recipe.icon }}</span>
        {{ labels.recipes[recipe.titleKey].title }}
      </Button>
    </div>

    <div class="flex gap-2">
      <Button
        data-testid="scheduled-task-context-fresh"
        :variant="
          draft.contextMode === 'fresh_thread_per_run' ? 'default' : 'outline'
        "
        :aria-pressed="draft.contextMode === 'fresh_thread_per_run'"
        size="sm"
        @click="patch({ contextMode: 'fresh_thread_per_run' })"
      >
        {{ labels.context.fresh }}
      </Button>
      <Button
        data-testid="scheduled-task-context-reuse"
        :variant="draft.contextMode === 'reuse_thread' ? 'default' : 'outline'"
        :aria-pressed="draft.contextMode === 'reuse_thread'"
        size="sm"
        @click="patch({ contextMode: 'reuse_thread' })"
      >
        {{ labels.context.reuse }}
      </Button>
    </div>

    <template v-if="draft.contextMode === 'reuse_thread'">
      <input
        data-testid="scheduled-task-thread-id"
        :class="inputClass"
        :value="draft.threadId"
        :placeholder="labels.context.threadIdPlaceholder"
        @input="patch({ threadId: ($event.target as HTMLInputElement).value })"
      />
      <!--
        复用同一条会话意味着每次运行都往那条会话里追加上下文，跑久了会越来越长、
        也越来越贵。这是一句**提醒**而不是错误，所以用 Alert 的默认样式加暖色，
        不是 destructive——把它画成红的会让人以为选错了。
      -->
      <Alert
        class="border-amber-500/50 bg-amber-500/10"
        data-testid="scheduled-task-reuse-notice"
      >
        <TriangleAlert class="text-amber-600 dark:text-amber-400" />
        <AlertTitle>{{ labels.context.reuseNoticeTitle }}</AlertTitle>
        <AlertDescription>
          {{ labels.context.reuseNoticeDescription }}
        </AlertDescription>
      </Alert>
    </template>
    <input
      data-testid="scheduled-task-title"
      :class="inputClass"
      :value="draft.title"
      :placeholder="labels.create.taskTitle"
      @input="patch({ title: ($event.target as HTMLInputElement).value })"
    />
    <textarea
      data-testid="scheduled-task-prompt"
      rows="4"
      :class="textareaClass"
      :value="draft.prompt"
      :placeholder="labels.create.prompt"
      @input="patch({ prompt: ($event.target as HTMLTextAreaElement).value })"
    />
    <ScheduledTaskScheduleInput
      :key="scheduleNonce"
      :initial="draft.schedule"
      @change="patch({ schedule: $event as ScheduleValue })"
    />
    <div v-if="error" class="text-destructive text-sm">{{ error }}</div>
    <Button
      data-testid="scheduled-task-submit"
      :disabled="submitDisabled"
      @click="emit('submit')"
    >
      {{ labels.create.submit }}
    </Button>
  </div>
</template>
