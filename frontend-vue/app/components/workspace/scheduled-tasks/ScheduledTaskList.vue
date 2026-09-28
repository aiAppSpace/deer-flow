<script setup lang="ts">
/*
  【文件职责】     Scheduled-task 列表与选择态。
  【架构位置】     L3 presentational component
  【主要导出】     默认 ScheduledTaskList
  【依赖关系】     scheduled-tasks/types · app i18n
  【边界与注意】   不持有列表副本，不发网络请求。

                   一行的可访问名是「标题 + 类型 · 状态」，**不含时区**：React 的
                   第二行是 `${scheduleType} · ${status}`，时区只出现在详情里。
                   加载态与空列表这里都不渲染任何东西，与 React 一致——空列表时
                   右侧详情面板会说「未选中任务」，那是唯一的提示。
*/
import type { ScheduledTask } from "@/core/scheduled-tasks/types";

defineProps<{
  tasks: ScheduledTask[];
  selectedId: string | null;
}>();
const emit = defineEmits<{ select: [taskId: string] }>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3" data-testid="scheduled-task-list">
    <button
      v-for="task in tasks"
      :key="task.id"
      type="button"
      :data-testid="`scheduled-task-item-${task.id}`"
      class="min-w-0 rounded-lg border p-4 text-left"
      :class="selectedId === task.id ? 'border-foreground' : 'border-border'"
      @click="emit('select', task.id)"
    >
      <div class="font-medium">{{ task.title }}</div>
      <div class="text-muted-foreground text-sm">
        {{ $i18n.t.value.scheduledTasks.scheduleType[task.schedule_type] }} ·
        {{ $i18n.t.value.scheduledTasks.status[task.status] }}
      </div>
    </button>
  </div>
</template>
