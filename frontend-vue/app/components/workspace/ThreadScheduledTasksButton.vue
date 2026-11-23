<script setup lang="ts">
import { computed } from "vue";
import { CalendarClock } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useScheduledTasksFeature } from "@/composables/useSchedulerFeatures";
import { useThreadScheduledTasks } from "@/composables/useScheduledTasks";
import { fill } from "@/core/scheduled-tasks/presentation";
const props = defineProps<{ threadId: string }>();
const { $i18n } = useNuxtApp();
const feature = useScheduledTasksFeature();
const query = useThreadScheduledTasks(() => props.threadId, {
  enabled: feature.available,
});
const target = computed(() => {
  if (
    !feature.available.value ||
    query.isError.value ||
    !query.data.value?.length
  )
    return null;
  const tasks = query.data
    .value as import("@/core/scheduled-tasks/types").ThreadScheduledTask[];
  const owned = tasks.filter((task) => task.thread_relation !== "run");
  if (!owned.length)
    return {
      href: `/workspace/scheduled-tasks?task_id=${encodeURIComponent(tasks[0]!.id)}`,
      label: $i18n.t.value.scheduledTasks.header.runTask,
      count: 0,
    };
  return {
    href:
      owned.length === 1
        ? `/workspace/scheduled-tasks?task_id=${encodeURIComponent(owned[0]!.id)}`
        : `/workspace/scheduled-tasks?thread_id=${encodeURIComponent(props.threadId)}`,
    label:
      owned.length === 1
        ? $i18n.t.value.scheduledTasks.header.countLabelOne
        : fill($i18n.t.value.scheduledTasks.header.countLabel, {
            count: owned.length,
          }),
    count: owned.length,
  };
});
</script>
<template>
  <Button v-if="target" variant="outline" size="sm" as-child
    ><NuxtLink
      :to="target.href"
      :aria-label="target.label"
      :title="target.count ? target.label : undefined"
      data-testid="thread-scheduled-tasks-button"
      ><CalendarClock aria-hidden="true" /><span class="hidden sm:inline">{{
        target.count ? $i18n.t.value.sidebar.scheduledTasks : target.label
      }}</span
      ><span
        v-if="target.count"
        class="bg-primary text-primary-foreground grid size-4 place-items-center rounded-full text-[10px] font-semibold"
        aria-hidden="true"
        >{{ target.count > 9 ? "9+" : target.count }}</span
      ></NuxtLink
    ></Button
  >
</template>
