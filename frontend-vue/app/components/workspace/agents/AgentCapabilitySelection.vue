<script setup lang="ts">
import { computed } from "vue";
import CapabilitySelectionField from "./CapabilitySelectionField.vue";
import { capabilityCopy } from "@/core/capabilities/copy";
defineProps<{ plugins: string[] | null; skills: string[] | null }>();
defineEmits<{
  "update:plugins": [value: string[] | null];
  "update:skills": [value: string[] | null];
}>();
const { $i18n } = useNuxtApp();
const copy = computed(() => capabilityCopy($i18n.locale.value));
</script>
<template>
  <details class="space-y-3 rounded-lg border p-3">
    <summary class="cursor-pointer text-sm font-medium">
      {{ copy.selectionTitle }}
    </summary>
    <p class="text-muted-foreground text-xs leading-5">{{ copy.hint }}</p>
    <CapabilitySelectionField
      adapter="mcp"
      :model-value="plugins"
      @update:model-value="$emit('update:plugins', $event)"
    /><CapabilitySelectionField
      adapter="skills"
      :model-value="skills"
      @update:model-value="$emit('update:skills', $event)"
    />
  </details>
</template>
