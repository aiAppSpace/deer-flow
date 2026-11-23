<!--
  【文件职责】     按用户偏好渲染 assistant turn 总量或 step-debug token usage。
  【架构位置】     L3 消息 UI adapter
  【主要导出】     默认 MessageTokenUsage 组件
  【依赖关系】     core/messages/usage · usage-model · ui/badge · i18n
  【边界与注意】   off 时不留 inline DOM；流式中不展示未完成的 debug attribution。

                   调试步骤由消息列表全局计算后按所属组传入；独立消费者可按 messages
                   计算。标题与 secondary labels 完整换行，保留共享归属和 input/output。
-->

<script setup lang="ts">
import { computed } from "vue";
import { Coins } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import type { Message } from "@/core/types/message";
import { accumulateUsage, formatTokenCount } from "@/core/messages/usage";
import {
  buildTokenDebugSteps,
  type TokenDebugStep,
} from "@/core/messages/usage-model";

const props = defineProps<{
  messages: Message[];
  mode: "off" | "per_turn" | "step_debug";
  loading?: boolean;
  tokenDebugSteps?: TokenDebugStep[];
}>();
const { $i18n } = useNuxtApp();
const usage = computed(() =>
  accumulateUsage(props.messages.filter((message) => message.type === "ai")),
);
const debugSteps = computed(() =>
  props.mode === "step_debug"
    ? (props.tokenDebugSteps ??
      buildTokenDebugSteps(props.messages, $i18n.t.value))
    : [],
);
</script>

<template>
  <div
    v-if="mode === 'per_turn' && usage"
    class="text-muted-foreground border-border/60 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px]"
    data-testid="message-token-usage"
  >
    <span class="inline-flex items-center gap-1 font-medium">
      <Coins class="size-3" />
      {{ $i18n.t.value.tokenUsage.label }}
    </span>
    <span
      >{{ $i18n.t.value.tokenUsage.input }}:
      {{ formatTokenCount(usage.inputTokens) }}</span
    >
    <span
      >{{ $i18n.t.value.tokenUsage.output }}:
      {{ formatTokenCount(usage.outputTokens) }}</span
    >
    <span class="font-medium"
      >{{ $i18n.t.value.tokenUsage.total }}:
      {{ formatTokenCount(usage.totalTokens) }}</span
    >
  </div>
  <div
    v-else-if="mode === 'step_debug' && !loading && debugSteps.length"
    class="border-border/60 mt-1 border-t pt-2"
    data-testid="message-token-debug"
  >
    <div class="space-y-2">
      <div
        v-for="step in debugSteps"
        :key="step.id"
        class="bg-muted/30 border-border/50 flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-2"
      >
        <div class="min-w-0 flex-1 basis-48 space-y-1 wrap-anywhere">
          <div
            class="text-foreground flex items-center gap-2 text-xs font-medium"
          >
            <Coins class="text-muted-foreground size-3 shrink-0" />
            <span class="min-w-0 wrap-anywhere">{{ step.label }}</span>
          </div>
          <div
            v-if="step.secondaryLabels.length > 0"
            class="flex flex-wrap gap-1.5"
          >
            <Badge
              v-for="(label, index) in step.secondaryLabels"
              :key="`${step.id}-${index}-${label}`"
              variant="secondary"
              class="max-w-full px-1.5 py-0 text-[10px] font-normal wrap-anywhere whitespace-normal"
            >
              {{ label }}
            </Badge>
          </div>
          <div
            v-if="step.sharedAttribution"
            class="text-muted-foreground text-[11px]"
          >
            {{ $i18n.t.value.tokenUsage.sharedAttribution }}
          </div>
          <div class="text-muted-foreground text-[11px]">
            <template v-if="step.usage"
              >{{ $i18n.t.value.tokenUsage.input }}:
              {{ formatTokenCount(step.usage.inputTokens) }} ·
              {{ $i18n.t.value.tokenUsage.output }}:
              {{ formatTokenCount(step.usage.outputTokens) }}</template
            >
            <template v-else>{{
              $i18n.t.value.tokenUsage.unavailableShort
            }}</template>
          </div>
        </div>
        <Badge
          variant="outline"
          class="max-w-full shrink-0 font-mono wrap-anywhere whitespace-normal"
        >
          {{
            step.usage
              ? `${formatTokenCount(step.usage.totalTokens)} ${$i18n.t.value.tokenUsage.label}`
              : $i18n.t.value.tokenUsage.unavailableShort
          }}
        </Badge>
      </div>
    </div>
  </div>
</template>
