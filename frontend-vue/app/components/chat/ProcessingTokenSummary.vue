<script setup lang="ts">
// A processing step owns its summary; message/global attribution is supplied by
// MessageList, and ProcessingMessageGroup chooses the first eligible step.
import { Coins } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import { formatTokenCount } from "@/core/messages/usage";
import type { TokenDebugStep } from "@/core/messages/usage-model";

defineProps<{ step?: TokenDebugStep }>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <div
    v-if="step"
    class="text-muted-foreground fade-in-0 slide-in-from-top-2 animate-in flex gap-2 text-sm"
    data-testid="processing-token-summary"
  >
    <div class="relative mt-0.5">
      <Coins class="size-4" />
      <div class="bg-border absolute top-7 bottom-0 left-1/2 -mx-px w-px" />
    </div>
    <div class="min-w-0 flex-1 space-y-2 overflow-hidden wrap-anywhere">
      <div
        class="max-w-full min-w-0 [overflow-wrap:anywhere] whitespace-normal"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0 flex-1 basis-48">{{ step.label }}</div>
          <div
            class="text-muted-foreground max-w-full shrink-0 font-mono text-[11px] wrap-anywhere"
          >
            {{
              step.usage
                ? `${formatTokenCount(step.usage.totalTokens)} ${$i18n.t.value.tokenUsage.label}`
                : $i18n.t.value.tokenUsage.unavailableShort
            }}
          </div>
        </div>
      </div>
      <div v-if="step.sharedAttribution" class="text-muted-foreground text-xs">
        {{ $i18n.t.value.tokenUsage.sharedAttribution }}
      </div>
      <div
        v-if="step.secondaryLabels.length"
        class="flex flex-wrap items-center gap-2 overflow-x-hidden"
      >
        <Badge
          v-for="(label, index) in step.secondaryLabels"
          :key="`${step.id}-${index}-${label}`"
          variant="secondary"
          class="max-w-full gap-1 px-2 py-0.5 text-xs font-normal max-[361px]:[overflow-wrap:anywhere] max-[361px]:whitespace-normal"
          >{{ label }}</Badge
        >
      </div>
    </div>
  </div>
</template>
