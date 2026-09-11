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
import { Copy, TriangleAlert } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    <!--
      **复用同一条会话的那条提醒，详情里也要有**（上游
      `app/workspace/scheduled-tasks/page.tsx:507` 的 `ReuseThreadNotice`，
      位置就在这两行之间）。本仓原来只在**新建表单**里画它——于是一条任务建完之后，
      再回来看它的人永远看不到「每次运行都往同一条会话里追加上下文，跑久了会越来越长、
      也越来越贵」这句话，而那正是想改掉它的人要知道的。
      对照台账 `scheduled-tasks#default` 上那条 `ariaOnlyReact: - alert: …`
      与三行 `y Δ-180` 报的就是它（缺这一块，下面的一切都上移了）。

      样式与表单里那一处同源：**提醒不是错误**，所以是 Alert 的默认变体加暖色，
      不是 destructive。
    -->
    <Alert
      v-if="task.context_mode === 'reuse_thread'"
      class="border-amber-500/50 bg-amber-500/10"
      data-testid="scheduled-task-detail-reuse-notice"
    >
      <TriangleAlert class="text-amber-600 dark:text-amber-400" />
      <AlertTitle>{{ labels.context.reuseNoticeTitle }}</AlertTitle>
      <AlertDescription>
        {{ labels.context.reuseNoticeDescription }}
      </AlertDescription>
    </Alert>
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
      <!--
        走 `ui/input` / `ui/textarea`，不要手写：上游同一处是
        `app/workspace/scheduled-tasks/page.tsx:533/538` 的 `<Input>` 与 `<Textarea>`。
        这里原来把 primitive 的整串基类抄成了两个本地常量（还漏了 `aria-invalid:`
        与 `disabled:` 两段），primitive 一改就悄悄分叉。
      -->
      <Input
        data-testid="scheduled-task-title"
        :model-value="editDraft.title"
        :placeholder="labels.edit.titlePlaceholder"
        @update:model-value="patchDraft({ title: $event })"
      />
      <Textarea
        data-testid="scheduled-task-prompt"
        rows="4"
        :model-value="editDraft.prompt"
        :placeholder="labels.edit.promptPlaceholder"
        @update:model-value="patchDraft({ prompt: $event })"
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
