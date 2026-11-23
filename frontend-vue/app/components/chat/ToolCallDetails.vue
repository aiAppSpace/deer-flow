<script setup lang="ts">
import { ref, useId } from "vue";
import { Button } from "@/components/ui/button";
import type { ToolMessage } from "@/core/types/message";
import ToolDetailPayload from "./ToolDetailPayload.vue";

defineProps<{
  name: string;
  callId?: string;
  args: Record<string, unknown>;
  resultMessage?: ToolMessage;
}>();
const { $i18n } = useNuxtApp();
const open = ref(false);
const panelId = useId();
</script>

<template>
  <div class="@container/tool-details min-w-0">
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="h-auto min-h-8 max-w-full min-w-0 wrap-anywhere whitespace-normal"
      :aria-label="`${$i18n.t.value.toolCalls.details}: ${name}${callId ? ` (${callId})` : ''}`"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      {{ $i18n.t.value.toolCalls.details }}
    </Button>
    <div
      v-if="open"
      :id="panelId"
      class="space-y-3 rounded-md border p-3 @max-md/tool-details:p-2"
    >
      <ToolDetailPayload
        :label="$i18n.t.value.toolCalls.toolName"
        :value="name"
      />
      <ToolDetailPayload
        :label="$i18n.t.value.toolCalls.callId"
        :value="callId ?? '—'"
      />
      <ToolDetailPayload :label="$i18n.t.value.toolCalls.input" :value="args" />
      <ToolDetailPayload
        v-if="resultMessage"
        :label="
          resultMessage.status === 'error'
            ? $i18n.t.value.toolCalls.error
            : $i18n.t.value.toolCalls.result
        "
        :value="resultMessage.content"
      />
      <p v-else>{{ $i18n.t.value.toolCalls.noResult }}</p>
    </div>
  </div>
</template>
