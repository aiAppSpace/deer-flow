<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { formatTaskTime } from "@/core/scheduled-tasks/format";
import {
  describeGoalOutcome,
  requestedScheduleStop,
} from "@/core/scheduled-tasks/goal-outcome";
import { describeRunError } from "@/core/scheduled-tasks/run-error";
import {
  runLabel,
  goalText,
  goalReason,
  runIcon,
} from "@/core/scheduled-tasks/run-presentation";
import { isActiveRun } from "@/core/scheduled-tasks/types";
import { fill, taskChatPath } from "@/core/scheduled-tasks/presentation";
import type {
  ScheduledTask,
  ScheduledTaskRun,
} from "@/core/scheduled-tasks/types";
import { formatTokenCount } from "@/core/messages/usage";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
const props = defineProps<{
  run: ScheduledTaskRun;
  task: Pick<ScheduledTask, "assistant_id">;
  timeZone: string;
  tokenUsageEnabled: boolean;
}>();
const { $i18n } = useNuxtApp();
const st = computed(() => $i18n.t.value.scheduledTasks);
const goal = computed(() => describeGoalOutcome(props.run));
const runError = computed(() =>
  goal.value ? null : describeRunError(props.run),
);
const icon = computed(() => runIcon(props.run, goal.value));
const line = computed(
  () =>
    props.run.summary?.trim() ||
    goalReason(goal.value, $i18n.t.value) ||
    (runError.value ? st.value.runErrors[runError.value.key] : null) ||
    (isActiveRun(props.run)
      ? props.run.status === "queued"
        ? st.value.history.waitingForSlot
        : st.value.runStatus[props.run.status]
      : null),
);
const rawError = computed(
  () =>
    runError.value?.raw ??
    (goal.value && goal.value.kind !== "met" && !goal.value.reasonKey
      ? goal.value.code
      : null),
);
const evaluatorReason = computed(
  () => props.run.goal_verdict?.reason?.trim() || null,
);
const continuations = computed(
  () => props.run.goal_verdict?.continuations ?? 0,
);
const time = computed(() =>
  formatTaskTime(props.run.scheduled_for, {
    timeZone: props.timeZone,
    locale: $i18n.locale.value,
    labels: st.value.time,
  }),
);
</script>
<template>
  <li
    class="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 gap-y-0.5 py-2 text-sm"
    data-testid="scheduled-run-row"
    :data-run-id="run.run_id ?? undefined"
    :data-task-run-id="run.id"
  >
    <component
      :is="icon.icon"
      class="mt-0.5 size-4"
      :class="icon.className"
      aria-hidden="true"
    />
    <div class="flex min-w-0 flex-col gap-0.5">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="font-medium">{{ runLabel(run, $i18n.t.value) }}</span
        ><span class="text-muted-foreground text-xs">{{ time }}</span>
        <span
          v-if="goal"
          class="rounded-full border px-1.5 py-px text-[11px]"
          :class="
            goal.kind === 'met'
              ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
              : goal.kind === 'unmet'
                ? 'border-amber-500/40 text-amber-700 dark:text-amber-400'
                : 'text-muted-foreground'
          "
          data-testid="scheduled-run-goal"
          >{{ goalText(goal, $i18n.t.value) }}</span
        >
        <Tooltip v-if="goal?.kind === 'met' && goal.reliedOnAssumption"
          ><TooltipTrigger as-child
            ><span
              tabindex="0"
              class="text-muted-foreground rounded-full border px-1.5 py-px text-[11px]"
              data-testid="scheduled-run-assumption"
              >{{ st.goal.assumptionBadge }}</span
            ></TooltipTrigger
          ><TooltipContent>{{
            st.goal.assumptionTooltip
          }}</TooltipContent></Tooltip
        >
        <span class="ml-auto flex items-center gap-3"
          ><span
            v-if="tokenUsageEnabled && typeof run.total_tokens === 'number'"
            class="text-muted-foreground text-xs"
            >{{
              fill(st.history.tokens, {
                count: formatTokenCount(run.total_tokens),
              })
            }}</span
          ><NuxtLink
            v-if="run.run_id && run.thread_id"
            :to="taskChatPath(run.thread_id, task)"
            class="inline-flex items-center text-xs font-medium hover:underline"
            >{{ st.actions.openChat
            }}<ChevronRight class="size-3.5" aria-hidden="true" /></NuxtLink
        ></span>
      </div>
      <p v-if="line" class="text-muted-foreground line-clamp-2 break-words">
        {{ line }}
      </p>
      <p
        v-if="requestedScheduleStop(run)"
        class="text-xs text-sky-700 dark:text-sky-400"
        data-testid="scheduled-run-stop-requested"
      >
        {{ st.goal.stopRequested }}
      </p>
      <p v-if="continuations > 0" class="text-muted-foreground text-xs">
        {{ fill(st.history.continuations, { n: continuations }) }}
      </p>
      <details
        v-if="rawError != null || evaluatorReason != null"
        class="text-xs"
      >
        <summary class="text-muted-foreground w-fit cursor-pointer select-none">
          {{ st.history.details }}
        </summary>
        <div
          class="bg-muted/50 mt-1 flex flex-col gap-1 rounded-md p-2 break-words whitespace-pre-wrap"
        >
          <p v-if="rawError" data-testid="scheduled-run-raw-error">
            {{ rawError }}
          </p>
          <p v-if="evaluatorReason">{{ evaluatorReason }}</p>
        </div>
      </details>
    </div>
  </li>
</template>
