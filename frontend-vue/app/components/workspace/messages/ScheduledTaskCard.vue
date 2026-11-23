<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { computed, onScopeDispose, ref } from "vue";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarX2,
  Flag,
  MessageSquare,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Target,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import TaskActionReason from "@/components/workspace/scheduled-tasks/TaskActionReason.vue";
import { useElementLive } from "@/composables/useElementLive";
import {
  useScheduledTask,
  useScheduledTaskMutations,
} from "@/composables/useScheduledTasks";
import { useScheduledTasksFeature } from "@/composables/useSchedulerFeatures";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { GatewayResponseError } from "@/core/api/errors";
import { availableActions } from "@/core/scheduled-tasks/actions";
import {
  nextRunLine,
  stopLines,
} from "@/core/scheduled-tasks/detail-presentation";
import { describeTaskSchedule } from "@/core/scheduled-tasks/cron";
import { displayTimeZone, formatTaskTime } from "@/core/scheduled-tasks/format";
import { describeTaskOutcome } from "@/core/scheduled-tasks/goal-outcome";
import {
  blockReasonText,
  fill,
  taskChatPath,
} from "@/core/scheduled-tasks/presentation";
import { taskPagePath } from "@/core/scheduled-tasks/events";
import {
  presentTaskStatus,
  taskStatusLabel,
} from "@/core/scheduled-tasks/status";
import {
  snapshotToTask,
  type ScheduleToolResult,
} from "@/core/scheduled-tasks/tool-result";
import {
  describeScheduledTaskError,
  scheduledTaskErrorCode,
  shouldReportScheduledTaskError,
} from "@/core/scheduled-tasks/errors";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
const props = defineProps<{ result: ScheduleToolResult }>();
const { $i18n } = useNuxtApp();
const st = computed(() => $i18n.t.value.scheduledTasks);
const client = useQueryClient();
const root = ref<HTMLElement | null>(null),
  live = useElementLive(root);
const feature = useScheduledTasksFeature();
const snapshot = computed(() => snapshotToTask(props.result.task));
const query = useScheduledTask(() => props.result.task.id, {
  enabled: () => props.result.action !== "delete",
  initialData: props.result.action === "delete" ? undefined : snapshot.value,
  live,
});
const deleted = computed(
  () =>
    props.result.action === "delete" ||
    (query.error.value instanceof GatewayResponseError &&
      query.error.value.status === 404),
);
const task = computed(() => query.data.value ?? snapshot.value);
const title = computed(() => task.value.title || props.result.task.title || "");
const status = computed(() => presentTaskStatus(task.value));
const actions = computed(() =>
  availableActions(task.value, { createBlocked: false }),
);
const schedule = computed(() =>
  describeTaskSchedule(task.value, $i18n.locale.value, { time: st.value.time }),
);
const nextLine = computed(() =>
  nextRunLine(task.value, $i18n.t.value, $i18n.locale.value),
);
const outcome = computed(() => describeTaskOutcome(task.value, []));
const stops = computed(() =>
  stopLines(task.value, $i18n.t.value, $i18n.locale.value, {
    toolEnabled: feature.isLoading.value || feature.toolEnabled.value,
    reachedAt:
      outcome.value?.kind === "pausedByAgent"
        ? (outcome.value.at ?? null)
        : null,
  }),
);
const capLines = computed(() =>
  stops.value.secondary.filter(
    (line) => line !== st.value.stop.trialsDontCount,
  ),
);
const mutations = useScheduledTaskMutations();
const toast = useWorkspaceToast();
const limitMessage = ref<string | null>(null),
  trialThreadId = ref<string | null>(null);
let disposed = false,
  triggering = false;
onScopeDispose(() => {
  disposed = true;
});
const reason = (action: keyof ReturnType<typeof availableActions>) =>
  blockReasonText(actions.value[action].reason, $i18n.t.value);
async function action(kind: "pause" | "resume" | "trigger") {
  if (kind === "trigger" && triggering) return;
  if (kind === "trigger") triggering = true;
  const submitted = task.value;
  const owns = captureWorkspaceQueryOwner(client);
  const current = () =>
    owns() && !disposed && props.result.task.id === submitted.id;
  if (kind !== "trigger") limitMessage.value = null;
  try {
    if (kind === "pause") {
      await mutations.pause.mutateAsync({ task: submitted });
      if (current()) toast.success(st.value.feedback.paused);
    } else if (kind === "resume") {
      const resumed = await mutations.resume.mutateAsync({ task: submitted });
      if (!current()) return;
      const next = resumed.next_run_at
        ? formatTaskTime(resumed.next_run_at, {
            timeZone: displayTimeZone(resumed),
            locale: $i18n.locale.value,
            labels: st.value.time,
          })
        : null;
      toast.success(
        next
          ? fill(st.value.feedback.resumed, { time: next })
          : st.value.feedback.resumedNoTime,
      );
    } else {
      const result = await mutations.trigger.mutateAsync({ task: submitted });
      if (!current()) return;
      if (result.outcome === "queued")
        toast.info(
          result.existing
            ? st.value.feedback.alreadyQueued
            : st.value.feedback.trialQueued,
        );
      else trialThreadId.value = result.thread_id ?? "";
    }
  } catch (cause) {
    if (!current() || !shouldReportScheduledTaskError(cause)) return;
    const error = describeScheduledTaskError(cause, $i18n.t.value, {
      locale: $i18n.locale.value,
      timeZone: displayTimeZone(submitted),
    });
    if (
      kind === "resume" &&
      scheduledTaskErrorCode(cause) === "limits_exhausted"
    )
      limitMessage.value = error.message;
    else
      toast.error(`${st.value.errors[kind]}: ${error.message}`, {
        description: error.details ?? undefined,
      });
  } finally {
    if (kind === "trigger") triggering = false;
  }
}
const rows = computed(() => [
  { icon: Repeat, label: st.value.card.runs, key: "runs" },
  { icon: Flag, label: st.value.card.stopsWhen, key: "stops" },
  ...(task.value.goal_objective
    ? [{ icon: Target, label: st.value.detail.goal, key: "goal" }]
    : []),
  { icon: MessageSquare, label: st.value.card.results, key: "results" },
]);
</script>
<template>
  <section
    v-if="deleted"
    ref="root"
    :aria-label="fill(st.card.label, { title })"
    data-testid="scheduled-task-card"
    :data-task-id="result.task.id"
    data-state="deleted"
    class="bg-card text-muted-foreground flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm"
  >
    <CalendarX2 class="size-4 shrink-0" aria-hidden="true" /><span
      class="text-foreground font-medium"
      >{{ title }}</span
    ><span>{{ st.card.deleted }}</span>
  </section>
  <div v-else class="flex w-full flex-col gap-2">
    <section
      ref="root"
      :aria-label="fill(st.card.label, { title })"
      data-testid="scheduled-task-card"
      :data-task-id="task.id"
      :data-state="status.key"
      class="bg-card overflow-hidden rounded-lg border [overflow-wrap:anywhere]"
    >
      <header class="flex flex-wrap items-start gap-3 px-4 py-3">
        <span
          class="bg-muted grid size-9 shrink-0 place-items-center rounded-md"
          aria-hidden="true"
          ><CalendarClock class="size-4"
        /></span>
        <p class="min-w-0 flex-1 self-center font-medium break-words">
          {{ title }}
        </p>
        <span
          role="status"
          aria-live="polite"
          data-testid="scheduled-task-card-status"
          :data-status="status.key"
          class="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-normal"
          :class="
            status.tone === 'ok'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : status.tone === 'warn'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                : status.tone === 'danger'
                  ? 'bg-destructive/10 text-destructive'
                  : status.tone === 'info'
                    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
                    : 'bg-muted text-muted-foreground'
          "
          ><component
            :is="status.icon"
            class="size-3.5"
            :class="status.key === 'running' && 'animate-spin'"
            aria-hidden="true"
          />{{ taskStatusLabel(status.key, st.status) }}</span
        >
      </header>
      <div
        v-for="row in rows"
        :key="row.key"
        class="grid grid-cols-1 gap-1 border-t px-4 py-3 text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3"
      >
        <div class="text-muted-foreground flex items-start gap-2">
          <span class="mt-0.5 shrink-0" aria-hidden="true"
            ><component :is="row.icon" class="size-3.5" /></span
          ><span>{{ row.label }}</span>
        </div>
        <div class="min-w-0">
          <template v-if="row.key === 'runs'"
            ><p
              :title="schedule.raw ?? undefined"
              data-testid="scheduled-task-card-schedule"
            >
              {{ schedule.text }}
            </p>
            <p
              v-if="nextLine"
              class="text-muted-foreground text-xs"
              data-testid="scheduled-task-card-next"
            >
              {{ nextLine }}
            </p></template
          ><template v-else-if="row.key === 'stops'"
            ><p data-testid="scheduled-task-card-stops">
              {{ stops.primary
              }}<span
                v-if="stops.reached"
                class="ml-1.5 font-medium text-sky-700 dark:text-sky-400"
                >✓ {{ stops.reached }}</span
              >
            </p>
            <p v-if="capLines.length" class="text-muted-foreground text-xs">
              {{ capLines.join(" · ") }}
            </p></template
          >
          <p
            v-else-if="row.key === 'goal'"
            class="line-clamp-3 break-words whitespace-pre-wrap"
          >
            {{ task.goal_objective }}
          </p>
          <p v-else>
            {{
              task.context_mode === "reuse_thread"
                ? st.card.resultsReuse
                : st.card.resultsFresh
            }}
          </p>
        </div>
      </div>
      <p
        v-if="!feature.isLoading.value && !feature.running.value"
        class="border-t bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300"
        data-testid="scheduled-task-card-scheduler-off"
      >
        {{ st.card.schedulerOff }}
      </p>
      <p
        v-if="query.isError.value"
        class="text-muted-foreground border-t px-4 py-2 text-xs"
      >
        {{ st.card.refreshFailed }}
      </p>
      <p
        v-if="limitMessage"
        role="alert"
        class="border-t bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300"
      >
        {{ limitMessage }} {{ " "
        }}<NuxtLink :to="taskPagePath(task.id)" class="font-medium underline">{{
          st.actions.openTask
        }}</NuxtLink>
      </p>
      <p
        v-if="trialThreadId !== null"
        role="status"
        class="border-t px-4 py-2 text-xs"
        data-testid="scheduled-task-card-trial"
      >
        {{ st.card.trialStarted
        }}<template v-if="trialThreadId"
          ><span aria-hidden="true"> · </span
          ><NuxtLink
            :to="taskChatPath(trialThreadId, task)"
            class="font-medium hover:underline"
            >{{ st.actions.openChat }}</NuxtLink
          ></template
        >
      </p>
      <footer
        class="flex flex-wrap items-center gap-2 border-t px-4 py-3 [&>*]:max-w-full"
      >
        <TaskActionReason :reason="reason('runNow')"
          ><Button
            size="sm"
            class="h-auto min-h-8 max-w-full whitespace-normal"
            :disabled="
              actions.runNow.disabled || mutations.trigger.isPending.value
            "
            @click="action('trigger')"
            ><Play aria-hidden="true" />{{ st.actions.runNow }}</Button
          ></TaskActionReason
        ><TaskActionReason
          v-if="actions.pause.visible"
          :reason="reason('pause')"
          ><Button
            variant="outline"
            size="sm"
            class="h-auto min-h-8 max-w-full whitespace-normal"
            :disabled="
              actions.pause.disabled || mutations.pause.isPending.value
            "
            @click="action('pause')"
            ><Pause aria-hidden="true" />{{ st.actions.pause }}</Button
          ></TaskActionReason
        ><TaskActionReason
          v-if="actions.resume.visible"
          :reason="reason('resume')"
          ><Button
            variant="outline"
            size="sm"
            class="h-auto min-h-8 max-w-full whitespace-normal"
            :disabled="
              actions.resume.disabled || mutations.resume.isPending.value
            "
            @click="action('resume')"
            ><RotateCcw aria-hidden="true" />{{ st.actions.resume }}</Button
          ></TaskActionReason
        ><Button
          variant="ghost"
          size="sm"
          class="ml-auto h-auto min-h-8 max-w-full whitespace-normal"
          as-child
          ><NuxtLink :to="taskPagePath(task.id)"
            >{{ st.actions.openTask
            }}<ArrowUpRight aria-hidden="true" /></NuxtLink
        ></Button>
      </footer>
    </section>
    <p class="text-muted-foreground text-xs">{{ st.card.footer }}</p>
  </div>
</template>
