<script setup lang="ts">
/*
  【文件职责】     Scheduled-task 详情、行内编辑块、动作入口与运行历史。
  【架构位置】     L3 presentational component
  【主要导出】     默认 ScheduledTaskDetail
  【依赖关系】     ui/button · ScheduledTaskScheduleInput · ScheduledTaskRunList ·
                   scheduled-tasks format/form/types · app i18n
  【边界与注意】   字段是**一行一句** `标签: 值` 的普通文本，不是 `<dl>`。定义列表在
                   可访问性树里是 term/definition 成对的节点，读屏器逐项播报；React
                   那一整块是一段连读的文字。两种都合法，但同一个产品不能有两种。

                   只显示 React 显示的那几行：Context mode、Thread **或** Last thread
                   （按 context_mode 二选一，fresh 模式下的 thread_id 对用户没有意义）、
                   Schedule、Next run、Last run、Last run id、Last error。Timezone 与
                   Run count 不在其中；`Last error` 即使为空也照样显示 `—`。
                   `Schedule` 的值是**类型**（Recurring / One-time），不是 cron 描述——
                   那句描述只出现在新建表单的预览里。

                   编辑块在详情内部，不是替换整个详情：React 编辑时上面的字段和下面的
                   动作按钮都还在。编辑草稿由页面持有并按 task id 重置，所以「取消编辑
                   再点开」保留刚才输入的内容，与 React 相同。

                   running 的任务这里**不禁用**任何按钮。Gateway 会用 409 拒绝冲突操作，
                   React 就是让它拒绝然后把 detail 弹出来；先行禁用是 Vue 独有的一层。
*/
import { computed } from "vue";

import ScheduledTaskRunList from "./ScheduledTaskRunList.vue";
import ScheduledTaskScheduleInput from "./ScheduledTaskScheduleInput.vue";
import { Copy } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  formatScheduledTaskTimestamp,
  SCHEDULED_TASK_NONE,
} from "@/core/scheduled-tasks/format";
import type { ScheduledTaskDraft } from "@/core/scheduled-tasks/form";
import type { ScheduleValue } from "@/core/scheduled-tasks/schedule";
import type {
  ScheduledTask,
  ScheduledTaskRun,
} from "@/core/scheduled-tasks/types";

const props = defineProps<{
  task: ScheduledTask;
  runs: ScheduledTaskRun[];
  runsHasMore: boolean;
  runsLoadingMore: boolean;
  editing: boolean;
  editDraft: ScheduledTaskDraft;
  updatePending: boolean;
}>();
const emit = defineEmits<{
  "update:editDraft": [draft: ScheduledTaskDraft];
  toggleEdit: [];
  save: [];
  pause: [];
  resume: [];
  trigger: [];
  /** 以这条任务为模板，在上面的新建表单里预填一份。 */
  duplicate: [];
  delete: [];
  loadMoreRuns: [];
}>();
const { $i18n } = useNuxtApp();

const labels = computed(() => $i18n.t.value.scheduledTasks);

function patchDraft(patch: Partial<ScheduledTaskDraft>) {
  emit("update:editDraft", { ...props.editDraft, ...patch });
}

function timestamp(value: string | null): string {
  return formatScheduledTaskTimestamp(value, $i18n.locale.value);
}

const threadLine = computed(() =>
  props.task.context_mode === "reuse_thread"
    ? `${labels.value.detail.thread}: ${props.task.thread_id ?? SCHEDULED_TASK_NONE}`
    : `${labels.value.detail.lastThread}: ${props.task.last_thread_id ?? SCHEDULED_TASK_NONE}`,
);
const editInputClass =
  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm";
const editTextareaClass =
  "border-input placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] md:text-sm";
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-start justify-between gap-3">
      <div class="text-lg font-semibold">{{ task.title }}</div>
      <Button variant="outline" size="sm" @click="emit('toggleEdit')">
        {{ editing ? labels.actions.cancelEdit : labels.actions.edit }}
      </Button>
    </div>
    <div class="text-muted-foreground text-sm">
      {{ labels.detail.contextMode }}:
      {{
        task.context_mode === "reuse_thread"
          ? labels.context.reuse
          : labels.context.fresh
      }}
    </div>
    <div class="text-muted-foreground text-sm">{{ threadLine }}</div>
    <div class="text-muted-foreground text-sm">
      {{ labels.detail.schedule }}:
      {{ labels.scheduleType[task.schedule_type] }}
    </div>
    <div class="text-muted-foreground text-sm">
      {{ labels.detail.nextRun }}: {{ timestamp(task.next_run_at) }}
    </div>
    <div class="text-muted-foreground text-sm">
      {{ labels.detail.lastRun }}: {{ timestamp(task.last_run_at) }}
    </div>
    <div class="text-muted-foreground text-sm">
      {{ labels.detail.lastRunId }}:
      {{ task.last_run_id ?? SCHEDULED_TASK_NONE }}
    </div>
    <div class="text-muted-foreground text-sm">
      {{ labels.detail.lastError }}:
      {{ task.last_error ?? SCHEDULED_TASK_NONE }}
    </div>

    <div
      v-if="editing"
      class="flex flex-col gap-2 rounded-lg border p-3"
      data-testid="scheduled-task-edit-form"
    >
      <input
        data-testid="scheduled-task-title"
        :class="editInputClass"
        :value="editDraft.title"
        :placeholder="labels.edit.titlePlaceholder"
        @input="
          patchDraft({ title: ($event.target as HTMLInputElement).value })
        "
      />
      <textarea
        data-testid="scheduled-task-prompt"
        rows="4"
        :class="editTextareaClass"
        :value="editDraft.prompt"
        :placeholder="labels.edit.promptPlaceholder"
        @input="
          patchDraft({ prompt: ($event.target as HTMLTextAreaElement).value })
        "
      />
      <ScheduledTaskScheduleInput
        :key="task.id"
        :initial="editDraft.schedule"
        schedule-type-locked
        @change="patchDraft({ schedule: $event as ScheduleValue })"
      />
      <Button
        data-testid="scheduled-task-submit"
        size="sm"
        :disabled="updatePending"
        @click="emit('save')"
      >
        {{ labels.edit.submit }}
      </Button>
    </div>
    <div v-else class="text-sm">{{ task.prompt }}</div>

    <div class="flex flex-wrap gap-2">
      <Button
        v-if="task.status === 'paused'"
        variant="outline"
        size="sm"
        @click="emit('resume')"
      >
        {{ labels.actions.resume }}
      </Button>
      <Button v-else variant="outline" size="sm" @click="emit('pause')">
        {{ labels.actions.pause }}
      </Button>
      <Button
        data-testid="scheduled-task-trigger"
        variant="outline"
        size="sm"
        @click="emit('trigger')"
      >
        {{ labels.actions.trigger }}
      </Button>
      <!--
        复制排在触发和删除之间，与上游 page.tsx 的顺序一致
        （暂停/恢复 → 立即运行 → 复制 → 删除）。
      -->
      <Button
        data-testid="scheduled-task-duplicate"
        variant="outline"
        size="sm"
        @click="emit('duplicate')"
      >
        <Copy class="size-4" />
        {{ labels.actions.duplicate }}
      </Button>
      <Button
        data-testid="scheduled-task-delete"
        variant="destructive"
        size="sm"
        @click="emit('delete')"
      >
        {{ labels.actions.delete }}
      </Button>
    </div>

    <ScheduledTaskRunList
      :runs="runs"
      :has-more="runsHasMore"
      :loading-more="runsLoadingMore"
      @load-more="emit('loadMoreRuns')"
    />
  </div>
</template>
