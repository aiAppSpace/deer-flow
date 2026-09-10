<!--
  【文件职责】     后台任务列表里的一张卡片：名字、时间、状态、展开详情、取消。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/button · composables/useBackgroundTasks · BackgroundTaskStatusBadge · BackgroundTaskDetails
  【边界与注意】   **详情只在展开后才请求**，而且展开期间才轮询。这一份数据比列表重
                   （带结果、结果产物、各种错误），列表里可能有二十条——挂载就全取
                   会让一个抽屉打开时发二十个请求。

                   「查看详情」不是恒常显示的：刚提交、或还在正常运行时，详情里
                   一条有用的都没有（结果没有、错误没有、通知还没开始）。上游的
                   判据是——请求过取消、或者已经不在 submitted/working、或者虽然
                   working 但追踪已降级。照抄这条，因为它等价于「详情里有东西可看」。

                   取消键在两种情况下都显示「正在取消…」并禁用：一种是本地这次点击
                   还没回来，一种是服务端已记下 `cancel_requested` 但远端还没停。
                   后者跨刷新仍然成立——只看本地 pending 的话，刷新一下按钮又能点了。
-->

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  TriangleAlert,
} from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { useBackgroundTask } from "@/composables/useBackgroundTasks";
import {
  isActiveBackgroundTask,
  type BackgroundTask,
} from "@/core/background-tasks";
import { formatTimeAgo } from "@/core/utils/datetime";
import BackgroundTaskDetails from "./BackgroundTaskDetails.vue";
import BackgroundTaskStatusBadge from "./BackgroundTaskStatusBadge.vue";

const props = defineProps<{
  threadId: string;
  task: BackgroundTask;
  /** 本地这次取消请求还没回来。 */
  isCancelling: boolean;
}>();
const emit = defineEmits<{ cancel: [taskId: string] }>();

const { $i18n } = useNuxtApp();

const detailsOpen = ref(false);
const detailsQuery = useBackgroundTask(
  () => props.threadId,
  () => props.task.task_id,
  { enabled: detailsOpen },
);

const active = computed(() => isActiveBackgroundTask(props.task));
const cancelling = computed(
  () => active.value && (props.task.cancel_requested || props.isCancelling),
);
/** 详情里确实有东西可看时才给这颗键，判据同上游。 */
const canShowDetails = computed(
  () =>
    props.task.cancel_requested ||
    (props.task.status !== "submitted" &&
      (props.task.status !== "working" || props.task.tracking_degraded)),
);
const showFooter = computed(() => canShowDetails.value || active.value);

const created = computed(() =>
  formatTimeAgo(props.task.created_at, $i18n.locale.value),
);
const updated = computed(() =>
  formatTimeAgo(props.task.updated_at, $i18n.locale.value),
);
</script>

<template>
  <article
    class="border-border bg-card rounded-xl border p-3 shadow-xs"
    :data-testid="`background-task-${task.task_id}`"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium" :title="task.task_name">
          {{ task.task_name }}
        </p>
        <div
          class="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        >
          <span class="flex items-center gap-1">
            <Clock3 class="size-3" />
            {{ $i18n.t.value.backgroundTasks.created(created) }}
          </span>
          <span>{{ $i18n.t.value.backgroundTasks.updated(updated) }}</span>
        </div>
      </div>
      <BackgroundTaskStatusBadge
        :status="task.status"
        :cancelling="cancelling"
      />
    </div>

    <!--
      追踪降级不是失败：任务可能好好地在跑，只是 Gateway 暂时问不到远端状态。
      不说这一句的话，用户看到的是一个长时间不动的进度，会以为卡死了。
    -->
    <p
      v-if="task.tracking_degraded"
      class="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"
    >
      <TriangleAlert class="size-3.5 shrink-0" />
      {{ $i18n.t.value.backgroundTasks.trackingDegraded }}
    </p>
    <p
      v-if="task.error"
      class="bg-destructive/5 text-destructive mt-2 rounded-md px-2 py-1.5 text-xs break-words"
    >
      {{ task.error }}
    </p>

    <div v-if="showFooter" class="mt-3 flex items-center justify-between gap-2">
      <Button
        v-if="canShowDetails"
        size="sm"
        variant="ghost"
        :aria-expanded="detailsOpen"
        @click="detailsOpen = !detailsOpen"
      >
        {{
          detailsOpen
            ? $i18n.t.value.backgroundTasks.hideDetails
            : $i18n.t.value.backgroundTasks.viewDetails
        }}
        <ChevronUp v-if="detailsOpen" class="size-3.5" />
        <ChevronDown v-else class="size-3.5" />
      </Button>
      <span v-else />
      <Button
        v-if="active"
        size="sm"
        variant="outline"
        :disabled="cancelling"
        @click="emit('cancel', task.task_id)"
      >
        <LoaderCircle v-if="isCancelling" class="size-3.5 animate-spin" />
        {{
          cancelling
            ? $i18n.t.value.backgroundTasks.cancelling
            : $i18n.t.value.backgroundTasks.cancel
        }}
      </Button>
    </div>

    <BackgroundTaskDetails
      v-if="detailsOpen"
      :task="detailsQuery.data.value"
      :loading="detailsQuery.isLoading.value"
      :error="detailsQuery.error.value"
      @retry="detailsQuery.refetch()"
    />
  </article>
</template>
