<script setup lang="ts">
import { computed } from "vue";
import { CalendarClock, LoaderCircle } from "lucide-vue-next";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";
import {
  taskListStatusLine,
  TONE_CLASS,
} from "@/core/scheduled-tasks/list-presentation";
import { describeTaskSchedule } from "@/core/scheduled-tasks/cron";
const props = defineProps<{
  tasks: ScheduledTask[];
  selectedId: string | null;
}>();
const emit = defineEmits<{ select: [id: string] }>();
const { $i18n } = useNuxtApp();
const rows = computed(() =>
  props.tasks.map((task) => ({
    task,
    line: taskListStatusLine(task, $i18n.t.value, $i18n.locale.value),
    schedule: describeTaskSchedule(task, $i18n.locale.value, {
      time: $i18n.t.value.scheduledTasks.time,
    }),
  })),
);
</script>
<template>
  <ul
    class="flex flex-col gap-2"
    data-testid="scheduled-task-list"
    :aria-label="$i18n.t.value.sidebar.scheduledTasks"
  >
    <li v-for="{ task, line, schedule } in rows" :key="task.id">
      <button
        type="button"
        :aria-current="task.id === selectedId ? 'true' : undefined"
        :data-testid="`scheduled-task-item-${task.id}`"
        :data-task-id="task.id"
        class="bg-card hover:bg-accent/40 flex w-full gap-3 rounded-lg border p-3 text-left transition-colors"
        :class="
          task.id === selectedId
            ? 'border-foreground ring-foreground ring-1'
            : 'border-border'
        "
        @click="emit('select', task.id)"
      >
        <span
          class="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
          ><CalendarClock class="size-4" aria-hidden="true"
        /></span>
        <span class="flex min-w-0 flex-col gap-0.5"
          ><span class="truncate text-sm font-semibold">{{ task.title }}</span
          ><span class="text-muted-foreground truncate text-xs">{{
            schedule.text
          }}</span
          ><span
            class="flex items-center gap-1 text-xs"
            :class="TONE_CLASS[line.tone]"
            ><component
              :is="line.icon"
              class="size-3.5 shrink-0"
              :class="line.icon === LoaderCircle && 'animate-spin'"
              aria-hidden="true"
            /><span class="truncate">{{ line.text }}</span></span
          ></span
        >
      </button>
    </li>
  </ul>
</template>
