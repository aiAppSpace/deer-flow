<script setup lang="ts">
import { computed } from "vue";
import { capabilityCopy } from "@/core/capabilities/copy";
import { useCapabilityInstallations } from "@/composables/useCapabilities";
const props = defineProps<{
  adapter: "mcp" | "skills";
  modelValue: string[] | null;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string[] | null] }>();
const { $i18n } = useNuxtApp();
const copy = computed(() => capabilityCopy($i18n.locale.value));
const query = useCapabilityInstallations(() => props.adapter);
const options = computed(() => {
  const rows = new Map(
    (query.data.value?.items ?? [])
      .filter((item) => item.installed && item.selectable !== false)
      .map((item) => [
        props.adapter === "skills" ? item.reference : item.id,
        item.name,
      ]),
  );
  for (const id of props.modelValue ?? [])
    if (!rows.has(id)) rows.set(id, `${id} (${copy.value.unavailable})`);
  return [...rows];
});
function toggle(id: string, event: Event) {
  const selected = props.modelValue ?? [];
  emit(
    "update:modelValue",
    (event.target as HTMLInputElement).checked
      ? [...selected, id]
      : selected.filter((item) => item !== id),
  );
}
</script>
<template>
  <fieldset class="space-y-2 rounded-lg border p-3">
    <legend class="px-1 text-sm font-medium">
      {{ adapter === "mcp" ? copy.plugins : copy.skills }}
    </legend>
    <label class="flex items-center gap-2 text-sm"
      ><input
        type="checkbox"
        :checked="modelValue === null"
        @change="
          emit(
            'update:modelValue',
            ($event.target as HTMLInputElement).checked ? null : [],
          )
        "
      />{{ copy.all }}</label
    >
    <p v-if="query.isLoading.value" class="text-muted-foreground text-xs">
      {{ $i18n.t.value.common.loading }}
    </p>
    <p v-if="query.isError.value" role="alert" class="text-destructive text-xs">
      {{ copy.adapterError }}
    </p>
    <div v-if="modelValue !== null" class="max-h-44 space-y-2 overflow-y-auto">
      <label
        v-for="[id, name] in options"
        :key="id"
        class="flex items-center gap-2 text-sm"
        ><input
          type="checkbox"
          :checked="modelValue.includes(id)"
          @change="toggle(id, $event)"
        />{{ name }}</label
      >
    </div>
  </fieldset>
</template>
