<script setup lang="ts">
import { computed } from "vue";
import { Bot, CircleCheck, CircleX, TriangleAlert } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { briefReason, formatTaskTime } from "@/core/scheduled-tasks/format";
import { fill, taskChatPath } from "@/core/scheduled-tasks/presentation";
import {
  assertKnownTaskOutcome,
  type TaskOutcome,
} from "@/core/scheduled-tasks/goal-outcome";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";
const props = defineProps<{
  outcome: TaskOutcome;
  task: Pick<ScheduledTask, "assistant_id">;
  timeZone: string;
  resumeDisabled: boolean;
}>();
const emit = defineEmits<{ editGoal: []; resume: []; extend: [] }>();
const { $i18n } = useNuxtApp();
const st = computed(() => $i18n.t.value.scheduledTasks);
const view = computed(() => {
  const o = props.outcome;
  const s = st.value;
  const time = (iso: string, inline = false) =>
    formatTaskTime(iso, {
      timeZone: props.timeZone,
      locale: $i18n.locale.value,
      labels: inline ? s.timeInline : s.time,
    });
  switch (o.kind) {
    case "pausedByAgent":
      return {
        tone: "border-sky-500/40 bg-sky-500/5 [&_svg.notice-icon]:text-sky-600",
        icon: Bot,
        title: s.notice.pausedByAgentTitle,
        body: o.at
          ? fill(s.notice.pausedByAgentBody, { time: time(o.at, true) })
          : null,
      };
    case "autoPaused":
      return {
        tone: "border-amber-500/50 bg-amber-500/10 [&_svg.notice-icon]:text-amber-600",
        icon: TriangleAlert,
        title: s.notice.autoPausedTitle,
        body: fill(s.notice.autoPausedBody, {
          reason: o.latestReasonKey
            ? s.goal.reasons[o.latestReasonKey]
            : o.latestSummary
              ? briefReason(o.latestSummary)
              : s.runStatus.unmet,
        }),
      };
    case "limitReached":
      return {
        tone: "border-border bg-muted/40 [&_svg.notice-icon]:text-muted-foreground",
        icon: CircleCheck,
        title: fill(s.notice.limitTitle, { max: o.max }),
        body: s.notice.limitBodyRuns,
      };
    case "endReached":
      return {
        tone: "border-border bg-muted/40 [&_svg.notice-icon]:text-muted-foreground",
        icon: CircleCheck,
        title: fill(s.notice.endTitle, { time: time(o.endAt) }),
        body: s.notice.limitBodyEnd,
      };
    case "onceFinished":
      return {
        tone: "border-border bg-muted/40 [&_svg.notice-icon]:text-muted-foreground",
        icon: CircleCheck,
        title: s.notice.onceFinished,
      };
    case "onceFailed":
      return {
        tone: "border-destructive/40 bg-destructive/5 [&_svg.notice-icon]:text-destructive",
        icon: CircleX,
        title: s.notice.onceFailed,
      };
  }
  return assertKnownTaskOutcome(o);
});
</script>
<template>
  <section
    class="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm"
    :class="view.tone"
    :aria-label="view.title"
    data-testid="scheduled-task-outcome"
    :data-outcome="outcome.kind"
  >
    <component
      :is="view.icon"
      class="notice-icon mt-0.5 size-4"
      aria-hidden="true"
    />
    <p class="font-medium">{{ view.title }}</p>
    <p
      v-if="view.body"
      class="text-muted-foreground col-start-2 leading-relaxed"
    >
      {{ view.body }}
    </p>
    <div
      v-if="
        (outcome.kind === 'pausedByAgent' && outcome.runThreadId) ||
        outcome.kind === 'autoPaused' ||
        outcome.kind === 'limitReached' ||
        outcome.kind === 'endReached'
      "
      class="col-start-2 mt-1 flex flex-wrap gap-2"
    >
      <Button
        v-if="outcome.kind === 'pausedByAgent' && outcome.runThreadId"
        variant="outline"
        size="sm"
        as-child
        ><NuxtLink :to="taskChatPath(outcome.runThreadId, task)">{{
          st.notice.seeThatRun
        }}</NuxtLink></Button
      ><template v-if="outcome.kind === 'autoPaused'"
        ><Button variant="outline" size="sm" @click="emit('editGoal')">{{
          st.notice.editGoal
        }}</Button
        ><Button
          v-if="outcome.latestThreadId"
          variant="outline"
          size="sm"
          as-child
          ><NuxtLink :to="taskChatPath(outcome.latestThreadId, task)">{{
            st.notice.openLatestRun
          }}</NuxtLink></Button
        ><Button
          variant="outline"
          size="sm"
          :disabled="resumeDisabled"
          @click="emit('resume')"
          >{{ st.notice.resumeAnyway }}</Button
        ></template
      ><Button
        v-if="outcome.kind === 'limitReached' || outcome.kind === 'endReached'"
        variant="outline"
        size="sm"
        :disabled="resumeDisabled"
        @click="emit('extend')"
        >{{ st.notice.extendLimit }}</Button
      >
    </div>
  </section>
</template>
