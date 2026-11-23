<script setup lang="ts">
/*
  【文件职责】     按 React 的可观察顺序渲染 processing 消息组，收敛推理、工具与结果 UI。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 ProcessingMessageGroup 组件
  【依赖关系】     core/messages/processing · StreamMarkdown · ProcessingToolStep
  【边界与注意】   模板只消费纯视图模型；不得逐条渲染原始 ToolMessage 或重复关联结果。
*/
import { computed, ref } from "vue";
import {
  ChevronUp,
  Circle,
  Lightbulb,
  MessageSquareText,
} from "lucide-vue-next";

import ProcessingToolStep from "@/components/chat/ProcessingToolStep.vue";
import ProcessingTokenSummary from "@/components/chat/ProcessingTokenSummary.vue";
import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import ReasoningDisclosure from "@/components/chat/ReasoningDisclosure.vue";
import { Button } from "@/components/ui/button";
import {
  deriveProcessingMessageView,
  type BrowserViewMeta,
  type ProcessingStep,
} from "@/core/messages/processing";
import type { ArtifactEntry } from "@/core/threads/types";
import type { Message } from "@/core/types/message";
import { formatTokenCount } from "@/core/messages/usage";
import type { TokenDebugStep } from "@/core/messages/usage-model";

const props = defineProps<{
  messages: Message[];
  toolArtifacts?: readonly ArtifactEntry[];
  streaming: boolean;
  durationSeconds?: number;
  showToolDetails?: boolean;
  tokenDebugSteps?: TokenDebugStep[];
  threadId?: string | null;
  isMock?: boolean;
  markdownComponents?: Record<string, unknown>;
}>();
const emit = defineEmits<{
  artifact: [path: string];
  browser: [frame: BrowserViewMeta];
}>();
const { $i18n } = useNuxtApp();
const showEarlierSteps = ref(false);
const showTrailingReasoning = ref(false);
const view = computed(() =>
  deriveProcessingMessageView(props.messages, props.toolArtifacts),
);
const debugStepByMessageId = computed(
  () =>
    new Map(
      (props.tokenDebugSteps ?? []).map((step) => [
        step.messageId || step.id,
        step,
      ]),
    ),
);
const toolCallCountByMessageId = computed(() => {
  const counts = new Map<string, number>();
  for (const step of view.value.steps) {
    if (step.type !== "toolCall" || !step.messageId) continue;
    counts.set(step.messageId, (counts.get(step.messageId) ?? 0) + 1);
  }
  return counts;
});
const summariesByStep = computed(() => {
  const summaries = new Map<ProcessingStep, TokenDebugStep>();
  const seen = new Set<string>();
  if (!props.showToolDetails) return summaries;
  for (const step of view.value.steps) {
    if (!step.messageId || seen.has(step.messageId)) continue;
    const debug = debugStepByMessageId.value.get(step.messageId);
    if (!debug) continue;
    const toolCount = toolCallCountByMessageId.value.get(step.messageId) ?? 0;
    if (
      !debug.sharedAttribution &&
      (toolCount > 0 ||
        (debug.label === $i18n.t.value.common.thinking &&
          debug.secondaryLabels.length === 0))
    )
      continue;
    seen.add(step.messageId);
    summaries.set(step, debug);
  }
  return summaries;
});
function toolDebugStep(step: ProcessingStep): TokenDebugStep | undefined {
  if (!props.showToolDetails || !step.messageId) return undefined;
  const debug = debugStepByMessageId.value.get(step.messageId);
  return debug?.sharedAttribution ? undefined : debug;
}
const trailingReasoningToken = computed(() => {
  const step = view.value.trailingReasoning;
  if (!props.showToolDetails || !step?.messageId) return null;
  const debug = debugStepByMessageId.value.get(step.messageId);
  if (
    !debug ||
    debug.sharedAttribution ||
    (toolCallCountByMessageId.value.get(step.messageId) ?? 0) > 0 ||
    debug.label !== $i18n.t.value.common.thinking
  )
    return null;
  return debug.usage
    ? `${formatTokenCount(debug.usage.totalTokens)} ${$i18n.t.value.tokenUsage.label}`
    : $i18n.t.value.tokenUsage.unavailableShort;
});

function visibleEarlierSteps(): readonly ProcessingStep[] {
  if (!view.value.lastToolCall)
    return view.value.visibleBeforeTrailingReasoning;
  return showEarlierSteps.value
    ? view.value.earlierSteps
    : view.value.alwaysVisibleEarlierText;
}
</script>

<template>
  <div
    data-testid="processing-message-group"
    class="not-prose w-full gap-2 rounded-lg border p-0.5"
  >
    <!--
      两颗折叠键上游都是
      `<Button variant="ghost" className="w-full items-start justify-start text-left">`
      （message-group.tsx:322 与 :389）。手写那版只留了 `hover:bg-accent`，
      于是少 `hover:text-accent-foreground`（悬停时上游文字也变色）、
      少 **`dark:hover:bg-accent/50`**（深色主题下上游的悬停底色浅一半，
      本仓用的是浅色那一档）、少 `cursor-pointer`、少 3px 焦点环、
      少 `text-sm font-medium`（整行字重比上游轻一档）与 `disabled:*`。
    -->
    <Button
      v-if="view.collapsibleSteps.length"
      data-testid="toggle-earlier-steps"
      type="button"
      variant="ghost"
      class="h-auto min-h-9 w-full items-start justify-start text-left"
      :aria-expanded="showEarlierSteps"
      @click="showEarlierSteps = !showEarlierSteps"
    >
      <div
        class="text-muted-foreground flex w-full min-w-0 gap-2 text-sm opacity-60"
      >
        <ChevronUp
          class="mt-0.5 size-4 shrink-0 transition-transform duration-200"
          :class="showEarlierSteps ? 'rotate-180' : ''"
        />
        <span class="min-w-0 wrap-anywhere whitespace-normal">
          {{
            showEarlierSteps
              ? $i18n.t.value.toolCalls.lessSteps
              : $i18n.t.value.toolCalls.moreSteps(view.collapsibleSteps.length)
          }}
        </span>
      </div>
    </Button>

    <div
      v-if="visibleEarlierSteps().length || view.lastToolCall"
      class="text-popover-foreground mt-2 space-y-3 px-4 pb-2"
    >
      <template v-for="step in visibleEarlierSteps()" :key="step.id">
        <ProcessingTokenSummary :step="summariesByStep.get(step)" />
        <div
          v-if="step.type === 'assistantText'"
          class="text-muted-foreground flex gap-2 text-sm"
        >
          <MessageSquareText class="mt-0.5 size-4 shrink-0" />
          <MessageMarkdown
            :content="step.content"
            :components="markdownComponents"
            :streaming="streaming"
            class="min-w-0 flex-1"
          />
        </div>
        <div
          v-else-if="step.type === 'reasoning'"
          class="text-muted-foreground flex gap-2 text-sm"
        >
          <Circle class="mt-0.5 size-4 shrink-0" />
          <MessageMarkdown
            :content="step.reasoning"
            :components="markdownComponents"
            :streaming="streaming"
            class="min-w-0 flex-1"
          />
        </div>
        <ProcessingToolStep
          v-else
          :step="step"
          :show-details="showToolDetails"
          :token-debug-step="toolDebugStep(step)"
          :thread-id="threadId"
          :is-mock="isMock"
          @artifact="emit('artifact', $event)"
          @browser="emit('browser', $event)"
        />
      </template>

      <ProcessingTokenSummary
        v-if="view.lastToolCall"
        :step="summariesByStep.get(view.lastToolCall)"
      />
      <ProcessingToolStep
        v-if="view.lastToolCall"
        :key="view.lastToolCall.id"
        :step="view.lastToolCall"
        :show-details="showToolDetails"
        :token-debug-step="toolDebugStep(view.lastToolCall)"
        :thread-id="threadId"
        :is-mock="isMock"
        @artifact="emit('artifact', $event)"
        @browser="emit('browser', $event)"
      />

      <template
        v-for="step in view.textAfterLastToolBeforeReasoning"
        :key="step.id"
      >
        <ProcessingTokenSummary :step="summariesByStep.get(step)" />
        <div class="text-muted-foreground flex gap-2 text-sm">
          <MessageSquareText class="mt-0.5 size-4 shrink-0" />
          <MessageMarkdown
            :content="step.content"
            :components="markdownComponents"
            :streaming="streaming"
            class="min-w-0 flex-1"
          />
        </div>
      </template>
    </div>

    <template v-if="view.trailingReasoning">
      <ProcessingTokenSummary
        :step="summariesByStep.get(view.trailingReasoning)"
      />
      <ReasoningDisclosure
        v-if="!streaming && durationSeconds !== undefined"
        :content="view.trailingReasoning.reasoning"
        :streaming="false"
        :duration-seconds="durationSeconds"
        :markdown-components="markdownComponents"
        :token-label="trailingReasoningToken"
      />
      <template v-else>
        <Button
          data-testid="toggle-trailing-reasoning"
          type="button"
          variant="ghost"
          class="w-full items-start justify-start text-left"
          :aria-expanded="showTrailingReasoning"
          @click="showTrailingReasoning = !showTrailingReasoning"
        >
          <div
            class="text-muted-foreground flex w-full items-center justify-between gap-2 text-sm"
          >
            <span class="flex min-w-0 flex-1 items-center gap-2">
              <Lightbulb class="size-4" />
              <span
                class="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3"
              >
                <span class="min-w-0 flex-1 basis-48">{{
                  $i18n.t.value.common.thinking
                }}</span>
                <span
                  v-if="trailingReasoningToken"
                  class="text-muted-foreground max-w-full shrink-0 font-mono text-[11px] wrap-anywhere"
                  >{{ trailingReasoningToken }}</span
                >
              </span>
            </span>
            <ChevronUp
              :class="showTrailingReasoning ? '' : 'rotate-180'"
              class="size-4"
            />
          </div>
        </Button>
        <div
          v-if="showTrailingReasoning"
          class="text-popover-foreground mt-2 space-y-3 px-4 pb-2"
        >
          <div class="text-muted-foreground flex gap-2 text-sm">
            <Circle class="mt-0.5 size-4 shrink-0" />
            <MessageMarkdown
              :content="view.trailingReasoning.reasoning"
              :components="markdownComponents"
              :streaming="streaming"
              class="min-w-0 flex-1"
            />
          </div>
        </div>
      </template>
    </template>

    <div
      v-if="view.answerAfterReasoning.length"
      class="text-popover-foreground mt-2 space-y-3 px-4 pb-2"
    >
      <template v-for="step in view.answerAfterReasoning" :key="step.id">
        <ProcessingTokenSummary :step="summariesByStep.get(step)" />
        <div class="text-muted-foreground flex gap-2 text-sm">
          <MessageSquareText class="mt-0.5 size-4 shrink-0" />
          <MessageMarkdown
            :content="step.content"
            :components="markdownComponents"
            :streaming="streaming"
            class="min-w-0 flex-1"
          />
        </div>
      </template>
    </div>
  </div>
</template>
