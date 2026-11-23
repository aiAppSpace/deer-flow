<script setup lang="ts">
import { computed, useId } from "vue";
import {
  ChevronRight,
  CircleCheck,
  CircleX,
  PauseCircle,
} from "lucide-vue-next";
import {
  describeTaskEvent,
  sentenceGap,
  type ScheduledTaskEvent,
} from "@/core/scheduled-tasks/events";
import { browserTimeZone, formatTaskTime } from "@/core/scheduled-tasks/format";
const props = defineProps<{ event: ScheduledTaskEvent }>();
const { $i18n } = useNuxtApp();
const textId = useId();
const description = computed(() =>
  describeTaskEvent(props.event, $i18n.t.value),
);
const icon = computed(() =>
  description.value?.kind === "onceFailed"
    ? CircleX
    : description.value?.kind === "stopped" ||
        description.value?.kind === "autoPaused"
      ? PauseCircle
      : CircleCheck,
);
const time = computed(() =>
  formatTaskTime(props.event.created_at, {
    timeZone: browserTimeZone(),
    locale: $i18n.locale.value,
    labels: $i18n.t.value.scheduledTasks.time,
  }),
);
const suffixGap = computed(() =>
  description.value?.suffix
    ? sentenceGap(
        description.value.segments.map((segment) => segment.text).join(""),
        description.value.suffix,
      )
    : "",
);
</script>
<template>
  <div
    v-if="description"
    role="note"
    :aria-label="$i18n.t.value.scheduledTasks.events.label"
    data-testid="scheduled-task-event-line"
    :data-task-id="event.task_id"
    :data-event-id="event.id"
    :data-event-kind="description.kind"
    class="bg-muted/40 text-muted-foreground flex w-full items-start gap-2.5 rounded-lg border border-dashed px-3 py-2 text-sm"
  >
    <component
      :is="icon"
      class="mt-0.5 size-4 shrink-0"
      :class="description.kind === 'onceFailed' && 'text-destructive'"
      aria-hidden="true"
    />
    <p
      :id="textId"
      class="text-foreground/80 min-w-0 flex-1 break-words"
      data-testid="scheduled-task-event-text"
    >
      <template v-for="(segment, index) in description.segments" :key="index"
        ><strong
          v-if="segment.kind === 'title'"
          class="text-foreground font-medium"
          >{{ segment.text }}</strong
        ><span
          v-else-if="segment.kind === 'condition'"
          :title="segment.text"
          data-testid="scheduled-task-event-condition"
          class="inline-block max-w-full truncate align-bottom"
          >{{ segment.text }}</span
        ><template v-else>{{ segment.text }}</template></template
      ><template v-if="description.suffix"
        >{{ suffixGap }}{{ description.suffix }}</template
      ><template v-if="time"
        >{{ " "
        }}<time
          :datetime="event.created_at"
          class="text-muted-foreground ml-1 text-xs whitespace-nowrap"
          >{{ time }}</time
        ></template
      >
    </p>
    <NuxtLink
      :to="description.action.href"
      data-testid="scheduled-task-event-action"
      :data-action="description.action.kind"
      :aria-describedby="textId"
      class="text-foreground/80 hover:text-foreground inline-flex shrink-0 items-center gap-0.5 self-center text-xs font-medium whitespace-nowrap hover:underline"
      >{{ description.action.label
      }}<ChevronRight class="size-3.5" aria-hidden="true"
    /></NuxtLink>
  </div>
</template>
