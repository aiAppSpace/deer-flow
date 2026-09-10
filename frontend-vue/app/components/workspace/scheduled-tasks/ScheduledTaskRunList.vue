<script setup lang="ts">
/*
  【文件职责】     Scheduled-task 运行条数与运行历史列表。
  【架构位置】     L3 presentational component
  【主要导出】     默认 ScheduledTaskRunList
  【依赖关系】     ui/button · scheduled-tasks types/format · app i18n
  【边界与注意】   一条运行显示四样东西：`trigger · status`、run id、计划时刻、以及
                   失败时的 error。**没有字段名**——React 那边这四行都是裸值，加上
                   「Scheduled for」「Run ID」这类 `<dt>` 会让读屏器多念一倍的词。

                   条数与列表是两个平级的块，不是一个 `<section>` 里的标题加正文：
                   包起来会多出一层 region，标题变成 heading，而 React 那两处都是
                   普通 div。

                   「加载更多」按钮跟条数、列表并列，是这一块的第三个平级节点。
*/
import { computed } from "vue";

import { Button } from "@/components/ui/button";
import {
  formatScheduledTaskTimestamp,
  SCHEDULED_TASK_NONE,
} from "@/core/scheduled-tasks/format";
import type { ScheduledTaskRun } from "@/core/scheduled-tasks/types";

const props = defineProps<{
  runs: ScheduledTaskRun[];
  hasMore: boolean;
  loadingMore: boolean;
}>();
const emit = defineEmits<{ loadMore: [] }>();
const { $i18n } = useNuxtApp();

const countLabel = computed(() => {
  const labels = $i18n.t.value.scheduledTasks.detail;
  const template =
    props.runs.length === 1 ? labels.runsCountOne : labels.runsCount;
  return template.replace("{count}", String(props.runs.length));
});

function runSummary(run: ScheduledTaskRun): string {
  const labels = $i18n.t.value.scheduledTasks;
  return `${labels.runTrigger[run.trigger]} · ${labels.runStatus[run.status]}`;
}

function timestamp(value: string | null): string {
  return formatScheduledTaskTimestamp(value, $i18n.locale.value);
}
</script>

<template>
  <div data-testid="scheduled-task-runs">{{ countLabel }}</div>
  <div class="flex flex-col gap-2" data-testid="scheduled-task-run-list">
    <template v-if="runs.length > 0">
      <div
        v-for="run in runs"
        :key="run.id"
        :data-testid="`scheduled-task-run-${run.id}`"
        class="rounded-md border p-3 text-sm"
      >
        <div class="font-medium">{{ runSummary(run) }}</div>
        <div class="text-muted-foreground text-xs">
          {{ run.run_id ?? SCHEDULED_TASK_NONE }}
        </div>
        <div class="text-muted-foreground text-xs">
          {{ timestamp(run.scheduled_for) }}
        </div>
        <div v-if="run.error" class="text-destructive text-xs">
          {{ run.error }}
        </div>
      </div>
    </template>
    <div v-else class="text-muted-foreground text-sm">
      {{ $i18n.t.value.scheduledTasks.detail.noRuns }}
    </div>
  </div>
  <Button
    v-if="hasMore"
    data-testid="scheduled-task-load-more-runs"
    variant="outline"
    size="sm"
    :disabled="loadingMore"
    @click="emit('loadMore')"
  >
    {{
      loadingMore
        ? $i18n.t.value.scheduledTasks.detail.loadingMore
        : $i18n.t.value.scheduledTasks.detail.loadMore
    }}
  </Button>
</template>
