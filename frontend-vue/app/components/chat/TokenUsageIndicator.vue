<!--
  【文件职责】     展示线程总 token、当前 context 占比并编辑 usage 视图偏好。
  【架构位置】     L3 workspace UI adapter
  【主要导出】     默认 TokenUsageIndicator 组件
  【依赖关系】     core/messages/usage · usage-model · core/threads/token-usage
  【边界与注意】   persisted snapshot 为基线，仅追加当前 active run 的 SSE usage。
-->

<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, Coins } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type DropdownMenuValue,
} from "@/components/ui/dropdown-menu";

import type { Message } from "@/core/types/message";
import {
  formatTokenCount,
  selectHeaderTokenUsage,
  type TokenUsage,
} from "@/core/messages/usage";
import {
  getTokenUsageViewPreset,
  tokenUsagePreferencesFromPreset,
  type TokenUsagePreferences,
  type TokenUsageViewPreset,
} from "@/core/messages/usage-model";
import type { ContextUsage } from "@/core/threads/token-usage";

const props = withDefaults(
  defineProps<{
    threadId?: string | null;
    messages: Message[];
    pendingMessages?: Message[];
    backendUsage?: TokenUsage | null;
    contextUsage?: ContextUsage | null;
    enabled?: boolean;
    preferences: TokenUsagePreferences;
  }>(),
  {
    pendingMessages: () => [],
    backendUsage: null,
    contextUsage: null,
    enabled: false,
  },
);
const emit = defineEmits<{
  preferencesChange: [value: TokenUsagePreferences];
}>();
const { $i18n } = useNuxtApp();

const usage = computed(() =>
  selectHeaderTokenUsage({
    backendUsage: props.threadId ? props.backendUsage : null,
    messages: props.messages,
    pendingMessages: props.pendingMessages,
  }),
);
const preset = computed(() => getTokenUsageViewPreset(props.preferences));
const percentage = computed(() => {
  const value = props.contextUsage?.percentage;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value)).toFixed(1)
    : null;
});
const presets: TokenUsageViewPreset[] = ["off", "summary", "per_turn", "debug"];

function updatePreset(value: DropdownMenuValue) {
  if (
    typeof value !== "string" ||
    !presets.includes(value as TokenUsageViewPreset)
  ) {
    return;
  }
  emit(
    "preferencesChange",
    tokenUsagePreferencesFromPreset(value as TokenUsageViewPreset),
  );
}
function presetLabel(value: TokenUsageViewPreset) {
  const key = value === "per_turn" ? "perTurn" : value;
  return $i18n.t.value.tokenUsage.presets[key];
}
function presetDescription(value: TokenUsageViewPreset) {
  const key = value === "per_turn" ? "perTurn" : value;
  return $i18n.t.value.tokenUsage.presetDescriptions[key];
}
</script>

<template>
  <DropdownMenu v-if="enabled" data-testid="token-usage-indicator">
    <DropdownMenuTrigger>
      <!--
        上游 `token-usage-indicator.tsx:80` 是 `<Button variant="ghost">` 加同一串
        className。手写那版把 className 抄全了，缺的是 ghost 变体与 base 里没被
        className 盖掉的那几条：`cursor-pointer`、3px 焦点环、`disabled:*`、
        `whitespace-nowrap`、`transition-all`，以及 **`hover:text-accent-foreground`**
        ——上游悬停时整颗徽标的文字也会变色，本仓只有底色在动。
      -->
      <Button
        type="button"
        variant="ghost"
        class="border-border bg-background/70 text-muted-foreground hover:bg-background/90 flex h-auto items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-normal"
      >
        <Coins :size="14" />
        <span>{{ $i18n.t.value.tokenUsage.label }}</span>
        <span class="font-mono">
          {{
            preferences.headerTotal
              ? usage
                ? formatTokenCount(usage.totalTokens)
                : "-"
              : presetLabel(preset)
          }}
        </span>
        <span
          v-if="percentage"
          class="text-muted-foreground/80 border-l pl-1.5 font-mono"
          :aria-label="$i18n.t.value.contextUsage.badgeAriaLabel(percentage)"
        >
          {{ percentage }}%
        </span>
        <ChevronDown :size="12" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" side="bottom" class="w-80">
      <DropdownMenuLabel>
        {{ $i18n.t.value.tokenUsage.title }}
      </DropdownMenuLabel>
      <dl v-if="usage" class="space-y-1 px-2 py-1 text-xs">
        <div class="flex justify-between gap-4">
          <dt>{{ $i18n.t.value.tokenUsage.input }}</dt>
          <dd class="font-mono">{{ formatTokenCount(usage.inputTokens) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt>{{ $i18n.t.value.tokenUsage.output }}</dt>
          <dd class="font-mono">
            {{ formatTokenCount(usage.outputTokens) }}
          </dd>
        </div>
        <div class="border-t pt-1">
          <div class="flex justify-between gap-4">
            <dt>{{ $i18n.t.value.tokenUsage.total }}</dt>
            <dd class="font-mono font-medium">
              {{ formatTokenCount(usage.totalTokens) }}
            </dd>
          </div>
        </div>
      </dl>
      <p v-else class="text-muted-foreground px-2 py-1 text-xs">
        {{ $i18n.t.value.tokenUsage.unavailable }}
      </p>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>
        {{ $i18n.t.value.tokenUsage.view }}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        :model-value="preset"
        @update:model-value="updatePreset"
      >
        <DropdownMenuRadioItem
          v-for="value in presets"
          :key="value"
          :value="value"
        >
          <div class="grid gap-0.5">
            <span>{{ presetLabel(value) }}</span>
            <span class="text-muted-foreground text-xs">
              {{ presetDescription(value) }}
            </span>
          </div>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <p class="text-muted-foreground px-2 py-2 text-xs leading-relaxed">
        {{ $i18n.t.value.tokenUsage.note }}
      </p>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
