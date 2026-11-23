<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue";
import { Button } from "@/components/ui/button";
import { writeTextToClipboard } from "@/core/clipboard";
import { formatToolDetail } from "@/core/messages/tool-detail-preview";

const props = defineProps<{ label: string; value: unknown }>();
const { $i18n } = useNuxtApp();
const preview = computed(() => formatToolDetail(props.value));
const visibleText = computed(() =>
  preview.value.text === "" ? '""' : preview.value.text,
);
const copyStatus = ref<{ text: string; message: string }>();
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
onScopeDispose(() => {
  generation++;
  clearTimeout(timer);
});
async function copy() {
  const current = ++generation;
  const text = visibleText.value;
  let message: string;
  try {
    message = (await writeTextToClipboard(text))
      ? $i18n.t.value.clipboard.copiedToClipboard
      : $i18n.t.value.clipboard.failedToCopyToClipboard;
  } catch {
    message = $i18n.t.value.clipboard.failedToCopyToClipboard;
  }
  if (current !== generation) return;
  copyStatus.value = { text, message };
  clearTimeout(timer);
  timer = setTimeout(() => {
    copyStatus.value = undefined;
  }, 2000);
}
</script>

<template>
  <section :aria-label="label" class="min-w-0 space-y-1">
    <div
      class="@container/tool-payload flex flex-wrap items-center justify-between gap-2"
    >
      <span class="font-medium">{{ label }}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        class="@max-md/tool-payload:h-auto @max-md/tool-payload:min-h-8 @max-md/tool-payload:max-w-full @max-md/tool-payload:min-w-0 @max-md/tool-payload:px-0 @max-md/tool-payload:wrap-anywhere @max-md/tool-payload:whitespace-normal"
        :aria-label="`${$i18n.t.value.clipboard.copyToClipboard}: ${label}`"
        @click="copy"
      >
        {{ $i18n.t.value.clipboard.copyToClipboard }}
      </Button>
    </div>
    <pre
      class="bg-muted max-h-64 overflow-auto rounded p-2 text-xs break-all whitespace-pre-wrap"
      >{{ visibleText }}</pre>
    <p v-if="preview.text === ''" class="text-xs">
      {{ $i18n.t.value.toolCalls.emptyResult }}
    </p>
    <p v-if="preview.truncated" class="text-xs">
      {{ $i18n.t.value.toolCalls.truncated }}
    </p>
    <span role="status" class="text-xs">{{
      copyStatus?.text === visibleText ? copyStatus.message : ""
    }}</span>
  </section>
</template>
