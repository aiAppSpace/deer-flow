<script setup lang="ts">
import { computed } from "vue";

import { CodeEditor } from "@/components/ui/code-editor";

withDefaults(
  defineProps<{
    modelValue: string;
    language?: string | null;
    disabled?: boolean;
    readonly?: boolean;
  }>(),
  {
    language: undefined,
    disabled: false,
    readonly: false,
  },
);
const emit = defineEmits<{
  "update:modelValue": [content: string];
  save: [];
}>();

const { $theme } = useNuxtApp();

const theme = computed(() => $theme.resolved.value);
</script>

<template>
  <CodeEditor
    :model-value="modelValue"
    :language="language"
    :theme="theme"
    :readonly="readonly || disabled"
    :autofocus="!readonly"
    :data-testid="readonly ? 'artifact-source' : 'artifact-editor'"
    @update:model-value="emit('update:modelValue', $event)"
    @save="emit('save')"
  />
</template>
