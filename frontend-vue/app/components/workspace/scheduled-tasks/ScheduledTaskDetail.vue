<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { computed, onScopeDispose, ref, watch, nextTick } from "vue";
import {
  Copy,
  CopyPlus,
  Info,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ScheduledTaskOutcomeNotice from "./ScheduledTaskOutcomeNotice.vue";
import ScheduledTaskRunRow from "./ScheduledTaskRunRow.vue";
import ScheduledTaskRenewDialog from "./ScheduledTaskRenewDialog.vue";
import TaskActionReason from "./TaskActionReason.vue";
import {
  useScheduledTaskMutations,
  useScheduledTaskRunHistory,
} from "@/composables/useScheduledTasks";
import { useModels } from "@/composables/useModels";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { availableActions } from "@/core/scheduled-tasks/actions";
import {
  describeScheduledTaskError,
  scheduledTaskErrorCode,
  shouldReportScheduledTaskError,
} from "@/core/scheduled-tasks/errors";
import { displayTimeZone, formatTaskTime } from "@/core/scheduled-tasks/format";
import { describeTaskOutcome } from "@/core/scheduled-tasks/goal-outcome";
import {
  nextRunLine,
  stopLines,
} from "@/core/scheduled-tasks/detail-presentation";
import { describeTaskSchedule } from "@/core/scheduled-tasks/cron";
import {
  blockReasonText,
  fill,
  isDefaultAgent,
  taskChatPath,
} from "@/core/scheduled-tasks/presentation";
import {
  presentTaskStatus,
  taskStatusLabel,
} from "@/core/scheduled-tasks/status";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";
const queryClient = useQueryClient();
const props = defineProps<{
  task: ScheduledTask;
  toolEnabled: boolean;
  createBlocked: boolean;
}>();
const emit = defineEmits<{
  edit: [task: ScheduledTask, focus?: "goal"];
  duplicate: [task: ScheduledTask];
  deleted: [task: ScheduledTask];
}>();
const { $i18n } = useNuxtApp();
const st = computed(() => $i18n.t.value.scheduledTasks);
const toast = useWorkspaceToast();
const history = useScheduledTaskRunHistory(() => props.task.id);
const models = useModels();
const mutations = useScheduledTaskMutations();
const timeZone = computed(() => displayTimeZone(props.task));
const status = computed(() => presentTaskStatus(props.task));
const actions = computed(() =>
  availableActions(props.task, { createBlocked: props.createBlocked }),
);
const outcome = computed(() =>
  describeTaskOutcome(props.task, history.latestRuns.value),
);
const schedule = computed(() =>
  describeTaskSchedule(props.task, $i18n.locale.value, { time: st.value.time }),
);
const nextLine = computed(() =>
  nextRunLine(props.task, $i18n.t.value, $i18n.locale.value),
);
const stops = computed(() =>
  stopLines(props.task, $i18n.t.value, $i18n.locale.value, {
    toolEnabled: props.toolEnabled,
    reachedAt:
      outcome.value?.kind === "pausedByAgent"
        ? (outcome.value.at ?? null)
        : null,
  }),
);
const deleteOpen = ref(false),
  renewOpen = ref(false),
  promptExpanded = ref(false),
  promptClamped = ref(false);
const prompt = ref<HTMLElement | null>(null);
let observer: ResizeObserver | undefined;
let disposed = false;
onScopeDispose(() => {
  disposed = true;
  observer?.disconnect();
});
watch(
  [() => props.task.prompt, prompt, promptExpanded],
  async () => {
    await nextTick();
    observer?.disconnect();
    const el = prompt.value;
    if (!el || promptExpanded.value) return;
    const measure = () => {
      promptClamped.value =
        el.clientHeight > 0
          ? el.scrollHeight > el.clientHeight + 1
          : props.task.prompt.length > 180 ||
            props.task.prompt.split("\n").length > 2;
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
  },
  { immediate: true },
);
const owned = (id: string) => !disposed && props.task.id === id;
const reason = (action: keyof ReturnType<typeof availableActions>) =>
  blockReasonText(actions.value[action].reason, $i18n.t.value);
function report(cause: unknown, action: keyof typeof st.value.errors) {
  if (!shouldReportScheduledTaskError(cause)) return;
  const error = describeScheduledTaskError(cause, $i18n.t.value, {
    locale: $i18n.locale.value,
    timeZone: timeZone.value,
  });
  toast.error(`${st.value.errors[action]}: ${error.message}`, {
    description: error.details ?? undefined,
  });
}
function resumed(task: ScheduledTask) {
  const next = task.next_run_at
    ? formatTaskTime(task.next_run_at, {
        timeZone: displayTimeZone(task),
        locale: $i18n.locale.value,
        labels: st.value.time,
      })
    : null;
  toast.success(
    next
      ? fill(st.value.feedback.resumed, { time: next })
      : st.value.feedback.resumedNoTime,
  );
}
async function pause() {
  const task = props.task;
  const owns = captureWorkspaceQueryOwner(queryClient);
  try {
    await mutations.pause.mutateAsync({ task });
    if (owned(task.id) && owns()) toast.success(st.value.feedback.paused);
  } catch (cause) {
    if (owned(task.id) && owns()) report(cause, "pause");
  }
}
async function resume() {
  const task = props.task;
  const owns = captureWorkspaceQueryOwner(queryClient);
  try {
    const result = await mutations.resume.mutateAsync({ task });
    if (owned(task.id) && owns()) resumed(result);
  } catch (cause) {
    if (!(owned(task.id) && owns())) return;
    if (scheduledTaskErrorCode(cause) === "limits_exhausted")
      renewOpen.value = true;
    else report(cause, "resume");
  }
}
let triggering = false;
async function trigger() {
  if (triggering) return;
  triggering = true;
  const task = props.task;
  const owns = captureWorkspaceQueryOwner(queryClient);
  try {
    const result = await mutations.trigger.mutateAsync({ task });
    if (!(owned(task.id) && owns())) return;
    if (result.outcome === "queued")
      toast.info(
        result.existing
          ? st.value.feedback.alreadyQueued
          : st.value.feedback.trialQueued,
      );
    else
      toast.success(
        st.value.feedback.trialStarted,
        result.thread_id
          ? {
              action: {
                label: st.value.actions.openChat,
                onClick: () =>
                  navigateTo(taskChatPath(result.thread_id!, task)),
              },
            }
          : undefined,
      );
  } catch (cause) {
    if (owned(task.id) && owns()) report(cause, "trigger");
  } finally {
    triggering = false;
  }
}
async function remove() {
  const task = props.task;
  const owns = captureWorkspaceQueryOwner(queryClient);
  try {
    await mutations.remove.mutateAsync({ task });
    if (!(owned(task.id) && owns())) return;
    toast.success(st.value.feedback.deleted);
    deleteOpen.value = false;
    emit("deleted", task);
  } catch (cause) {
    if (owned(task.id) && owns()) report(cause, "delete");
  }
}
async function copy() {
  try {
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    await clipboard.writeText(props.task.id);
    toast.success(st.value.detail.copied);
  } catch {
    return;
  }
}
</script>
<template>
  <article
    class="bg-card flex min-w-0 flex-col rounded-lg border p-4 sm:p-5"
    data-testid="scheduled-task-detail"
    :data-task-id="task.id"
    :aria-labelledby="`scheduled-task-title-${task.id}`"
  >
    <header class="flex flex-wrap items-start gap-x-3 gap-y-2 pb-3">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <h2
          :id="`scheduled-task-title-${task.id}`"
          class="min-w-0 text-lg font-semibold break-words"
        >
          {{ task.title }}
        </h2>
        <span
          role="status"
          aria-live="polite"
          data-testid="scheduled-task-status"
          :data-status="status.key"
          class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
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
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <TaskActionReason v-if="actions.pause.visible" :reason="reason('pause')"
          ><Button
            variant="outline"
            size="sm"
            :disabled="
              actions.pause.disabled || mutations.pause.isPending.value
            "
            @click="pause"
            ><Pause aria-hidden="true" />{{ st.actions.pause }}</Button
          ></TaskActionReason
        ><TaskActionReason
          v-if="actions.resume.visible"
          :reason="reason('resume')"
          ><Button
            variant="outline"
            size="sm"
            :disabled="
              actions.resume.disabled || mutations.resume.isPending.value
            "
            @click="resume"
            ><RotateCcw aria-hidden="true" />{{ st.actions.resume }}</Button
          ></TaskActionReason
        ><TaskActionReason :reason="reason('runNow')"
          ><Button
            variant="outline"
            size="sm"
            data-testid="scheduled-task-trigger"
            :disabled="
              actions.runNow.disabled || mutations.trigger.isPending.value
            "
            @click="trigger"
            ><Play aria-hidden="true" />{{ st.actions.runNow }}</Button
          ></TaskActionReason
        ><TaskActionReason :reason="reason('edit')"
          ><Button
            variant="outline"
            size="sm"
            :disabled="actions.edit.disabled"
            @click="emit('edit', task)"
            ><Pencil aria-hidden="true" />{{ st.actions.edit }}</Button
          ></TaskActionReason
        >
        <DropdownMenu
          ><DropdownMenuTrigger as-child
            ><Button
              variant="ghost"
              size="icon-sm"
              :aria-label="st.detail.moreActions"
              ><MoreHorizontal
                aria-hidden="true" /></Button></DropdownMenuTrigger
          ><DropdownMenuContent align="end"
            ><TaskActionReason :reason="reason('duplicate')"
              ><DropdownMenuItem
                :disabled="actions.duplicate.disabled"
                data-testid="scheduled-task-duplicate"
                @select="emit('duplicate', task)"
                ><CopyPlus aria-hidden="true" />{{
                  st.actions.duplicate
                }}</DropdownMenuItem
              ></TaskActionReason
            ><DropdownMenuItem @select="copy"
              ><Copy aria-hidden="true" />{{
                st.detail.copyTaskId
              }}</DropdownMenuItem
            ><DropdownMenuSeparator /><TaskActionReason
              :reason="reason('delete')"
              ><DropdownMenuItem
                variant="destructive"
                :disabled="actions.delete.disabled"
                data-testid="scheduled-task-delete"
                @select="deleteOpen = true"
                ><Trash2 aria-hidden="true" />{{
                  st.actions.delete
                }}</DropdownMenuItem
              ></TaskActionReason
            ></DropdownMenuContent
          ></DropdownMenu
        >
      </div>
    </header>
    <div v-if="outcome" class="pb-3">
      <ScheduledTaskOutcomeNotice
        :outcome="outcome"
        :task="task"
        :time-zone="timeZone"
        :resume-disabled="
          actions.resume.disabled || mutations.resume.isPending.value
        "
        @edit-goal="emit('edit', task, 'goal')"
        @resume="resume"
        @extend="renewOpen = true"
      />
    </div>
    <div
      class="grid grid-cols-1 gap-1 border-t py-3 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3"
    >
      <div class="text-muted-foreground">{{ st.detail.runs }}</div>
      <div class="min-w-0">
        <p :title="schedule.raw ?? undefined">{{ schedule.text }}</p>
        <p
          v-if="nextLine"
          class="text-muted-foreground"
          data-testid="scheduled-task-next"
        >
          {{ nextLine }}
        </p>
      </div>
    </div>
    <div
      class="grid grid-cols-1 gap-1 border-t py-3 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3"
    >
      <div class="text-muted-foreground">{{ st.detail.stopsWhen }}</div>
      <div class="min-w-0">
        <p data-testid="scheduled-task-stops-when">
          {{ stops.primary
          }}<span
            v-if="stops.reached"
            class="ml-1.5 font-medium text-sky-700 dark:text-sky-400"
            >✓ {{ stops.reached }}</span
          >
        </p>
        <p
          v-for="line in stops.secondary"
          :key="line"
          class="text-muted-foreground text-xs"
        >
          {{ line }}
        </p>
      </div>
    </div>
    <div
      v-if="task.goal_objective"
      class="grid grid-cols-1 gap-1 border-t py-3 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3"
    >
      <div class="text-muted-foreground flex flex-col gap-0.5">
        <span>{{ st.detail.goal }}</span
        ><Tooltip :delay-duration="200"
          ><TooltipTrigger as-child
            ><button
              type="button"
              class="w-fit"
              :aria-label="st.stop.goalTooltip"
            >
              <Info
                class="size-3.5"
                aria-hidden="true"
              /></button></TooltipTrigger
          ><TooltipContent class="max-w-xs">{{
            st.stop.goalTooltip
          }}</TooltipContent></Tooltip
        >
      </div>
      <p
        class="min-w-0 break-words whitespace-pre-wrap"
        data-testid="scheduled-task-goal"
      >
        {{ task.goal_objective }}
      </p>
    </div>
    <div
      class="grid grid-cols-1 gap-1 border-t py-3 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3"
    >
      <div class="text-muted-foreground">{{ st.detail.does }}</div>
      <div class="min-w-0">
        <p
          ref="prompt"
          class="break-words whitespace-pre-wrap"
          :class="!promptExpanded && 'line-clamp-2'"
          data-testid="scheduled-task-prompt"
        >
          {{ task.prompt }}
        </p>
        <button
          v-if="promptExpanded || promptClamped"
          type="button"
          class="text-muted-foreground mt-1 text-xs hover:underline"
          :aria-expanded="promptExpanded"
          @click="promptExpanded = !promptExpanded"
        >
          {{ promptExpanded ? st.detail.showLess : st.detail.showAll }}
        </button>
        <div class="text-muted-foreground mt-1 flex flex-wrap gap-x-3 text-xs">
          <span v-if="!isDefaultAgent(task.assistant_id)">{{
            fill(st.detail.agentLine, { name: task.assistant_id ?? "" })
          }}</span
          ><span
            v-if="task.context_mode === 'reuse_thread'"
            class="inline-flex gap-1"
            >{{ st.detail.contextReuse
            }}<template v-if="task.thread_id"
              ><span aria-hidden="true">·</span
              ><NuxtLink
                :to="taskChatPath(task.thread_id, task)"
                class="text-foreground hover:underline"
                >{{ st.detail.openChat }}</NuxtLink
              ></template
            ></span
          ><span v-else>{{ st.detail.contextFresh }}</span>
        </div>
      </div>
    </div>
    <div
      v-if="task.standing_notes?.length"
      class="grid grid-cols-1 gap-1 border-t py-3 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3"
    >
      <div class="text-muted-foreground">{{ st.detail.notes }}</div>
      <ul
        class="min-w-0 list-disc space-y-0.5 pl-4"
        data-testid="scheduled-task-notes"
      >
        <li
          v-for="(note, index) in task.standing_notes"
          :key="index"
          class="break-words"
        >
          {{ note }}
        </li>
      </ul>
    </div>
    <div
      class="grid grid-cols-1 gap-1 border-t py-3 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3"
    >
      <div class="text-muted-foreground flex flex-col gap-0.5">
        <span>{{ st.detail.history }}</span
        ><span
          v-if="
            !history.isPending.value &&
            !history.isError.value &&
            history.page.value === 0 &&
            !history.hasOlder.value
          "
          class="text-xs"
          data-testid="scheduled-task-runs"
          >{{
            fill(
              history.runs.value.length === 1
                ? st.detail.runsCountOne
                : st.detail.runsCount,
              { count: history.runs.value.length },
            )
          }}</span
        >
      </div>
      <div class="min-w-0">
        <p
          v-if="history.isPending.value"
          role="status"
          class="text-muted-foreground"
        >
          {{ st.history.loading }}
        </p>
        <div
          v-if="history.isError.value"
          role="alert"
          class="flex flex-col items-start gap-2"
        >
          <p>{{ st.history.loadFailed }}</p>
          <Button
            variant="outline"
            size="sm"
            :disabled="history.isFetching.value"
            @click="history.refetch()"
            >{{ st.history.retry }}</Button
          >
        </div>
        <p
          v-if="
            !history.isPending.value &&
            !history.isError.value &&
            !history.runs.value.length
          "
          class="text-muted-foreground"
        >
          {{ st.detail.noRuns }}
        </p>
        <ol
          v-if="history.runs.value.length"
          class="divide-y"
          :aria-label="st.history.listLabel"
          data-testid="scheduled-task-run-list"
        >
          <ScheduledTaskRunRow
            v-for="run in history.runs.value"
            :key="run.id"
            :run="run"
            :task="task"
            :time-zone="timeZone"
            :token-usage-enabled="models.tokenUsageEnabled.value"
          />
        </ol>
        <nav
          v-if="history.page.value > 0 || history.hasOlder.value"
          :aria-label="st.history.navigation"
          class="mt-2 flex flex-wrap items-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            :disabled="history.page.value === 0 || history.isFetching.value"
            @click="history.newer"
            >{{ st.history.newer }}</Button
          ><span class="text-muted-foreground text-xs">{{
            fill(st.history.page, { page: history.page.value + 1 })
          }}</span
          ><Button
            variant="outline"
            size="sm"
            :disabled="!history.hasOlder.value || history.isFetching.value"
            @click="history.older"
            >{{ st.history.older }}</Button
          ><Button
            v-if="history.page.value > 0"
            variant="outline"
            size="sm"
            @click="history.latest"
            >{{ st.history.latest }}</Button
          >
        </nav>
        <p
          v-if="history.page.value > 0"
          class="text-muted-foreground mt-1 text-xs"
        >
          {{ st.history.paused }}
        </p>
      </div>
    </div>
    <footer
      class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs"
    >
      <span v-if="task.origin_thread_id" class="inline-flex items-center gap-1"
        ><MessageSquare class="size-3.5" aria-hidden="true" />{{
          st.detail.createdInChat
        }}<span aria-hidden="true">·</span
        ><NuxtLink
          :to="taskChatPath(task.origin_thread_id, task)"
          class="text-foreground hover:underline"
          data-testid="scheduled-task-origin-link"
          >{{ st.detail.openChat }}</NuxtLink
        ></span
      ><button type="button" class="ml-auto hover:underline" @click="copy">
        {{ st.detail.copyTaskId }}
      </button>
    </footer>
    <ScheduledTaskRenewDialog
      v-if="renewOpen"
      v-model:open="renewOpen"
      :task="task"
      @resumed="resumed"
    />
    <Dialog v-model:open="deleteOpen"
      ><DialogContent :close-label="$i18n.t.value.primitives.close"
        ><DialogHeader
          ><DialogTitle>{{
            fill(st.actions.deleteTitle, { title: task.title })
          }}</DialogTitle
          ><DialogDescription>{{
            st.actions.deleteBody
          }}</DialogDescription></DialogHeader
        ><DialogFooter
          ><Button
            variant="outline"
            :disabled="mutations.remove.isPending.value"
            @click="deleteOpen = false"
            >{{ $i18n.t.value.common.cancel }}</Button
          ><Button
            variant="destructive"
            data-testid="scheduled-task-delete-confirm"
            :disabled="mutations.remove.isPending.value"
            @click="remove"
            >{{
              mutations.remove.isPending.value
                ? $i18n.t.value.common.loading
                : st.actions.delete
            }}</Button
          ></DialogFooter
        ></DialogContent
      ></Dialog
    >
  </article>
</template>
