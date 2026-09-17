<script setup lang="ts">
/*
  【文件职责】     展示子任务状态、模型、token、实时步骤与按需历史 backfill。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 SubtaskCard 组件
  【依赖关系】     ui/chain-of-thought · ui/effects · core/tasks/api · core/tasks/view-model
  【边界与注意】   构成照抄上游 `workspace/messages/subtask-card.tsx`：外层
                   ChainOfThought，折叠头是一颗 ghost Button 里塞一个
                   ChainOfThoughtStep，展开区是 ChainOfThoughtContent 里的一串 Step。
                   此前本仓是 `<article>` + 手搓 button + span 堆，差的不是一层壳：

                   - 任务描述在上游是 Step 的 label，落在 `flex-1 … overflow-hidden`
                     里、继承 Step 默认 status(`complete`) 的 `text-muted-foreground`，
                     右边还有一组 model/token/状态把它挤窄；本仓原来是独占一行的
                     `font-medium` 正文色 span。对照台账上那四条几何
                     （x Δ-6 · y Δ-30 · width 232.6→710 · color 灰→黑）是同一处。
                   - 折叠头的元数据只在**折叠态**出现，展开后整块消失；`failed` 时
                     整块转红并压到 67% 不透明度。
                   - 状态词由 FlipDisplay 包着，且 in_progress 且最后一条消息带工具
                     调用时显示的是**那次工具调用的解释**，只有没有工具调用才回落到
                     `t.subtasks[status]`。

                   展开区的 loading / 失败重试是**本仓自己加的**，上游没有：上游 fetch
                   失败只是把 backfilledRef 放回 false，让下一次展开重试，用户看不到
                   任何反馈。保留它是因为它确实更好，而且 subtask-card.dom.test.ts
                   钉着这条行为。它只在真的请求失败时才出现，正常路径上两边的树一致；
                   对照场景里 runId 为空、两边都不发这个请求，所以它也不在台账上。

                   prompt 的 markdown 用的是调用点传下来的 markdownComponents，
                   而上游那一处特意把 `a` 换成 CitationLink（其余地方是 MarkdownLink）。
                   CitationLink 连同 HoverCard 引文卡片属于 citations 域，本仓还没有
                   对应物，等那一轮再补——这里差的是链接的悬浮卡，不是 markdown 本身。
*/
import { computed, onUnmounted, ref } from "vue";
import {
  // 上游是 `CheckCircleIcon`，在 lucide 里解析到 **CircleCheckBig**；
  // 本仓原来写 `CheckCircle2`，解析到 **CircleCheck**——两颗画得不一样
  // （前者的勾冲出圆圈，后者的勾在圈内）。同 wave 68 的 WandSparkles 那条。
  CheckCircle,
  ChevronUp,
  CircleX,
  ClipboardList,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-vue-next";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import { Button } from "@/components/ui/button";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ui/chain-of-thought";
import FlipDisplay from "@/components/ui/effects/FlipDisplay.vue";
import Shimmer from "@/components/ui/effects/Shimmer.vue";
import ShineBorder from "@/components/ui/effects/ShineBorder.vue";
import { useModels } from "@/composables/useModels";
import { hasToolCalls } from "@/core/messages/utils";
import { fetchSubtaskSteps } from "@/core/tasks/api";
import type { SubtaskStep } from "@/core/tasks/steps";
import type { SubtaskResultUpdate } from "@/core/tasks/subtask-result";
import type { Subtask } from "@/core/tasks/types";
import { buildSubtaskCardViewModel } from "@/core/tasks/view-model";
import { explainLastToolCall } from "@/core/tools/utils";
import { cn } from "@/lib/utils";

const props = defineProps<{
  taskId: string;
  threadId?: string | null;
  runId?: string | null;
  description: string;
  prompt: string;
  liveTask?: Subtask;
  terminal?: SubtaskResultUpdate;
  pendingStatus: Subtask["status"];
  isLoading: boolean;
  markdownComponents?: Record<string, unknown>;
}>();
const { $i18n } = useNuxtApp();
const { models, tokenUsageEnabled } = useModels();

const collapsed = ref(true);
const historicalSteps = ref<SubtaskStep[]>([]);
const loadingSteps = ref(false);
const stepsError = ref<string | null>(null);
let loadGeneration = 0;
let disposed = false;

const viewModel = computed(() =>
  buildSubtaskCardViewModel({
    id: props.taskId,
    description: props.description,
    prompt: props.prompt,
    pendingStatus: props.pendingStatus,
    liveTask: props.liveTask,
    terminal: props.terminal,
    historicalSteps: historicalSteps.value,
    models: models.value,
  }),
);
const panelId = computed(() => `subtask-panel-${props.taskId}`);

/** `t.subtasks[status]`，与上游同一张表。 */
const statusText = computed(
  () => $i18n.t.value.subtasks[viewModel.value.status],
);

/*
  折叠态右侧的状态词。上游优先显示最后一次工具调用的解释，只有 in_progress 且
  那条消息真的带工具调用时才走这一支；其余情况回落到 t.subtasks[status]。
*/
const collapsedStatusText = computed(() => {
  const latest = props.liveTask?.latestMessage;
  if (
    viewModel.value.status === "in_progress" &&
    latest &&
    hasToolCalls(latest)
  ) {
    return explainLastToolCall(latest, $i18n.t.value);
  }
  return statusText.value;
});

/*
  上游的 token 标签不是裸数字：开了 token 用量才显示，有数字时带上单位，
  没数字时按状态显示「统计中」或短横线。本仓此前直接把 viewModel.tokenLabel
  （只有数字）贴上去，且完全没看 tokenUsageEnabled。
*/
const runtimeUsageLabel = computed(() => {
  if (!tokenUsageEnabled.value) return undefined;
  const tokenLabel = viewModel.value.tokenLabel;
  if (tokenLabel) return `${tokenLabel} ${$i18n.t.value.tokenUsage.label}`;
  return viewModel.value.status === "in_progress"
    ? $i18n.t.value.tokenUsage.collecting
    : $i18n.t.value.tokenUsage.unavailableShort;
});

/*
  折叠头右侧那组元数据的样式。**必须走 cn()**：failed 时上游是
  `cn("text-muted-foreground …", "text-red-500 opacity-67")`，tailwind-merge 会把
  被盖掉的 `text-muted-foreground` 整个删掉；用 `class` + `:class` 两个属性拼的话
  两个 text-* 会同时留在 class 里，最终谁赢取决于**样式表里的先后**而不是这里的
  先后——现在恰好是红色赢，但那是运气，不是判据。
*/
/*
  **`min-w-0` 是承重的，不是装饰**（2026-09-18 第三十八轮量出来，本仓此前漏了它）。

  这一格是 `flex min-w-0 items-center gap-1` 的孩子，而 flex 子项默认
  `min-width: auto`——缩不到自己的 min-content 以下。少了 `min-w-0`，
  360px 屏上它从 144 涨到 214，把父格（164）撑破 50px，于是**右边那颗状态图标
  被推到 364–380，整个跑到视口外面**（视口只有 360）。上游 `subtask-card.tsx:179`
  一直有这颗类；本仓漏抄。

  **台账看不见它**：`subtask-card` 这个场景只有 desktop/zh/dark 三维，
  窄屏从来没采过。同轮给它补上了 mobile 维。
*/
const metadataClasses = computed(() =>
  cn(
    "text-muted-foreground flex min-w-0 items-center gap-1 text-xs font-normal",
    viewModel.value.status === "failed" ? "text-red-500 opacity-67" : "",
  ),
);

/*
  上游在 message-list 里构造 Subtask 时，pending 状态为 failed 就先把 error 填成
  `t.subtasks.failed`，随后工具结果解析出的真 error 再覆盖它。没有这一步，
  「跑到一半被停掉」的卡片展开后那条红色步骤会是空的。
*/
const errorText = computed(
  () =>
    viewModel.value.error ??
    (props.pendingStatus === "failed"
      ? $i18n.t.value.subtasks.failed
      : undefined),
);

async function loadHistoricalSteps() {
  if (
    loadingSteps.value ||
    historicalSteps.value.length > 0 ||
    !props.threadId ||
    !props.runId
  ) {
    return;
  }
  const generation = ++loadGeneration;
  loadingSteps.value = true;
  stepsError.value = null;
  try {
    const steps = await fetchSubtaskSteps(
      props.threadId,
      props.runId,
      props.taskId,
    );
    if (!disposed && generation === loadGeneration) {
      historicalSteps.value = steps;
    }
  } catch (error) {
    if (!disposed && generation === loadGeneration) {
      stepsError.value =
        error instanceof Error ? error.message : $i18n.t.value.subtasks.failed;
    }
  } finally {
    if (!disposed && generation === loadGeneration) {
      loadingSteps.value = false;
    }
  }
}

function toggle(event: MouseEvent) {
  (event.currentTarget as HTMLButtonElement | null)?.focus();
  collapsed.value = !collapsed.value;
  if (!collapsed.value) void loadHistoricalSteps();
}

function retrySteps() {
  historicalSteps.value = [];
  stepsError.value = null;
  void loadHistoricalSteps();
}

onUnmounted(() => {
  disposed = true;
  loadGeneration += 1;
});
</script>

<template>
  <ChainOfThought
    class="relative w-full gap-2 rounded-lg border py-0"
    :open="!collapsed"
    :data-task-id="taskId"
    :aria-busy="viewModel.status === 'in_progress' || isLoading"
  >
    <!--
      `data-slot` 与上游同加（wave 165）：这一层永远在 DOM 里、只有 in_progress 时
      才拿到高度，所以除了类名没有别的抓手，而对照工厂恰恰不许拿类名当锚点。
    -->
    <div
      data-slot="ambilight"
      class="ambilight z-[-1]"
      :class="viewModel.status === 'in_progress' ? 'enabled' : ''"
    />
    <ShineBorder
      v-if="viewModel.status === 'in_progress'"
      :border-width="1.5"
      :shine-color="['#A07CFE', '#FE8FB5', '#FFBE7B']"
    />
    <div class="bg-background/95 flex w-full flex-col rounded-lg">
      <div class="flex w-full items-center justify-between p-0.5">
        <Button
          data-testid="subtask-toggle"
          class="w-full items-start justify-start text-left"
          variant="ghost"
          :aria-expanded="!collapsed"
          :aria-controls="panelId"
          @click="toggle"
        >
          <div class="flex w-full items-center justify-between">
            <!--
              标题**截断成一行**，不换行把卡片撑高。`min-w-24 flex-1` 让它占住
              剩余宽度、`block truncate` 才有可截断的盒子，右侧那组元数据配
              `min-w-0` 才让得动。对齐上游 #5136；本仓此前是自然宽度，
              对照台账上量到 React 706px / Vue 232.6px。
            -->
            <ChainOfThoughtStep class="min-w-24 flex-1 font-normal">
              <template #icon><ClipboardList /></template>
              <template #label>
                <span class="block truncate" :title="viewModel.description">
                  <Shimmer
                    v-if="viewModel.status === 'in_progress'"
                    :text="viewModel.description"
                    :duration="3"
                    :spread="3"
                  />
                  <template v-else>{{ viewModel.description }}</template>
                </span>
              </template>
            </ChainOfThoughtStep>
            <div class="flex min-w-0 items-center gap-1">
              <div v-if="collapsed" :class="metadataClasses">
                <span
                  v-if="viewModel.modelLabel"
                  class="max-w-32 truncate"
                  :title="viewModel.modelLabel"
                  >{{ viewModel.modelLabel }}</span
                >
                <span
                  v-if="runtimeUsageLabel"
                  class="max-w-28 truncate"
                  :title="runtimeUsageLabel"
                  >{{ runtimeUsageLabel }}</span
                >
                <CheckCircle
                  v-if="viewModel.status === 'completed'"
                  class="size-3"
                />
                <CircleX
                  v-else-if="viewModel.status === 'failed'"
                  class="size-3 text-red-500"
                />
                <Loader2
                  v-else-if="viewModel.status === 'in_progress'"
                  class="size-3 animate-spin"
                />
                <FlipDisplay
                  class="max-w-[420px] truncate pb-1"
                  :unique-key="liveTask?.latestMessage?.id ?? ''"
                >
                  {{ collapsedStatusText }}
                </FlipDisplay>
              </div>
              <ChevronUp
                class="text-muted-foreground size-4"
                :class="collapsed ? 'rotate-180' : ''"
              />
            </div>
          </div>
        </Button>
      </div>
      <ChainOfThoughtContent :id="panelId" class="px-4 pb-4">
        <ChainOfThoughtStep v-if="viewModel.prompt">
          <template #label>
            <MessageMarkdown
              :content="viewModel.prompt"
              :components="markdownComponents"
              :streaming="isLoading"
            />
          </template>
        </ChainOfThoughtStep>
        <p
          v-if="loadingSteps"
          role="status"
          class="text-muted-foreground text-xs"
        >
          {{ $i18n.t.value.subtasks.loadingSteps }}
        </p>
        <div
          v-else-if="stepsError"
          role="alert"
          class="text-destructive text-xs"
        >
          <span>{{ stepsError }}</span>
          <button
            data-testid="subtask-steps-retry"
            type="button"
            class="ml-2 underline"
            @click="retrySteps"
          >
            {{ $i18n.t.value.subtasks.retry }}
          </button>
        </div>
        <ChainOfThoughtStep
          v-for="(step, index) in viewModel.steps"
          :key="`${step.message_index}-${index}`"
        >
          <template #icon>
            <Loader2
              v-if="
                viewModel.status === 'in_progress' &&
                index === viewModel.steps.length - 1
              "
              class="size-4 animate-spin"
            />
            <Wrench v-else-if="step.kind === 'tool'" class="size-4" />
            <Sparkles v-else class="size-4" />
          </template>
          <template #label>
            <template v-if="step.kind === 'tool'">{{
              step.tool_name ?? statusText
            }}</template>
            <div v-else class="text-muted-foreground line-clamp-3 text-sm">
              <MessageMarkdown
                :content="step.text"
                :components="markdownComponents"
              />
            </div>
          </template>
        </ChainOfThoughtStep>
        <template v-if="viewModel.status === 'completed'">
          <ChainOfThoughtStep>
            <template #icon><CheckCircle class="size-4" /></template>
            <template #label>{{ $i18n.t.value.subtasks.completed }}</template>
          </ChainOfThoughtStep>
          <ChainOfThoughtStep>
            <template #label>
              <MessageMarkdown
                v-if="viewModel.result"
                :content="viewModel.result"
                :components="markdownComponents"
              />
            </template>
          </ChainOfThoughtStep>
        </template>
        <ChainOfThoughtStep v-if="viewModel.status === 'failed'">
          <template #icon><CircleX class="size-4 text-red-500" /></template>
          <template #label>
            <div class="text-red-500">{{ errorText }}</div>
          </template>
        </ChainOfThoughtStep>
      </ChainOfThoughtContent>
    </div>
  </ChainOfThought>
</template>
