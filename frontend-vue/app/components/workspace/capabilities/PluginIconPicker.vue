<script setup lang="ts">
import { RotateCcw, Upload } from "lucide-vue-next";
import { computed, onUnmounted, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { preparePluginIcon, PluginIconError } from "@/core/mcp/icon";
import PluginIcon from "./PluginIcon.vue";
const props = defineProps<{
  name: string;
  modelValue: string | null | undefined;
  asset?: string | null;
  capabilityId?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: string | null];
  busy: [value: boolean];
}>();
const { $i18n } = useNuxtApp();
const copy = computed(() => $i18n.t.value.capabilities.icon);
const input = ref<HTMLInputElement | null>(null);
const error = ref("");
const busy = ref(false);
let generation = 0;
watch(
  () => props.name,
  () => {
    generation++;
    busy.value = false;
    emit("busy", false);
    error.value = "";
  },
);
onUnmounted(() => {
  generation++;
  busy.value = false;
  emit("busy", false);
});
async function change(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file || props.disabled || busy.value) return;
  const current = ++generation;
  busy.value = true;
  emit("busy", true);
  error.value = "";
  try {
    const icon = await preparePluginIcon(file);
    if (current === generation) emit("update:modelValue", icon);
  } catch (cause) {
    if (current === generation)
      error.value =
        cause instanceof PluginIconError
          ? copy.value.errors[cause.code]
          : copy.value.errors.invalid;
  } finally {
    if (current === generation) {
      busy.value = false;
      emit("busy", false);
    }
  }
}
function reset() {
  generation++;
  busy.value = false;
  emit("busy", false);
  emit("update:modelValue", null);
  error.value = "";
}
</script>
<template>
  <div class="space-y-2">
    <div
      class="bg-muted/30 flex flex-wrap items-center gap-4 rounded-xl border p-4"
    >
      <button
        type="button"
        :aria-label="copy.upload"
        :disabled="disabled || busy"
        class="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
        @click="input?.click()"
      >
        <PluginIcon
          :name="name"
          :icon="modelValue"
          :asset="asset"
          :capability-id="capabilityId"
          class="size-16"
        />
      </button>
      <div class="min-w-0 flex-1 basis-40 wrap-anywhere">
        <p class="text-sm font-medium">{{ copy.title }}</p>
        <p class="text-muted-foreground mt-1 text-xs leading-5">
          {{ copy.hint }}
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            class="h-auto min-h-8 max-w-full wrap-anywhere whitespace-normal"
            variant="outline"
            :disabled="disabled || busy"
            @click="input?.click()"
            ><Upload class="size-3.5" />{{
              busy ? $i18n.t.value.common.loading : copy.change
            }}</Button
          ><Button
            type="button"
            size="sm"
            class="h-auto min-h-8 max-w-full wrap-anywhere whitespace-normal"
            variant="ghost"
            :disabled="disabled || (!modelValue && !busy)"
            @click="reset"
            ><RotateCcw class="size-3.5" />{{ copy.reset }}</Button
          >
        </div>
      </div>
    </div>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="hidden"
      :aria-label="copy.upload"
      :disabled="disabled || busy"
      @change="change"
    />
    <p v-if="error" role="alert" class="text-destructive text-xs">
      {{ error }}
    </p>
  </div>
</template>
