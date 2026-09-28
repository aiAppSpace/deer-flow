<script setup lang="ts">
/*
  【文件职责】     Scheduled-task 状态与 once/cron 类型筛选控件。
  【架构位置】     L3 presentational component
  【主要导出】     默认 ScheduledTaskFilters
  【依赖关系】     ui/button · scheduled-tasks/view-model · app i18n
  【边界与注意】   八颗按钮，不是两个 `<select>`：选中的那颗是 default 变体，其余
                   outline，与 React 的筛选条一一对应。换成下拉框会让读屏器听到两个
                   combobox 和十几个 option，而 React 那边是八个 button——控件类型
                   都不是一个东西。

                   状态只有 all/enabled/paused/completed/failed 五颗。Gateway 还有
                   running 与 cancelled，但 React 没给它们按钮，多两颗就是多两个 Vue
                   独有的入口；筛选纯函数仍然认识全部六种，谁需要它自己传。
*/
import { Button } from "@/components/ui/button";
import type {
  ScheduledTaskScheduleFilter,
  ScheduledTaskStatusFilter,
} from "@/core/scheduled-tasks/view-model";

defineProps<{
  status: ScheduledTaskStatusFilter;
  scheduleType: ScheduledTaskScheduleFilter;
}>();
const emit = defineEmits<{
  "update:status": [value: ScheduledTaskStatusFilter];
  "update:scheduleType": [value: ScheduledTaskScheduleFilter];
}>();
const { $i18n } = useNuxtApp();

const STATUSES = [
  ["all", "allStatuses"],
  ["enabled", "enabled"],
  ["paused", "paused"],
  ["completed", "completed"],
  ["failed", "failed"],
] as const satisfies readonly (readonly [ScheduledTaskStatusFilter, string])[];

const TYPES = [
  ["all", "allTypes"],
  ["cron", "cron"],
  ["once", "once"],
] as const satisfies readonly (readonly [
  ScheduledTaskScheduleFilter,
  string,
])[];
</script>

<template>
  <div class="flex flex-wrap gap-2" data-testid="scheduled-task-filters">
    <!--
      选中只是换了个 variant，不加 aria-pressed 的话读屏器听不出当前筛的是哪一档
      ——颜色是唯一的线索。与 ScheduledTaskScheduleInput 的星期几按钮同一个形状，
      那边一直写着 aria-pressed。守卫在 tests/guards/toggle-variant-pressed.test.ts。
    -->
    <Button
      v-for="[value, labelKey] in STATUSES"
      :key="`status-${value}`"
      class="h-auto min-h-8 max-w-full py-1 whitespace-normal"
      :data-testid="`scheduled-task-status-filter-${value}`"
      :variant="status === value ? 'default' : 'outline'"
      :aria-pressed="status === value"
      size="sm"
      @click="emit('update:status', value)"
    >
      {{ $i18n.t.value.scheduledTasks.filters[labelKey] }}
    </Button>
    <Button
      v-for="[value, labelKey] in TYPES"
      :key="`type-${value}`"
      class="h-auto min-h-8 max-w-full py-1 whitespace-normal"
      :data-testid="`scheduled-task-type-filter-${value}`"
      :variant="scheduleType === value ? 'default' : 'outline'"
      :aria-pressed="scheduleType === value"
      size="sm"
      @click="emit('update:scheduleType', value)"
    >
      {{ $i18n.t.value.scheduledTasks.filters[labelKey] }}
    </Button>
  </div>
</template>
