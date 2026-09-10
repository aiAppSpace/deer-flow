<!--
  【文件职责】     会话头部的「后台任务」入口与抽屉。
  【架构位置】     L4 产品组件
  【主要导出】     默认 ThreadBackgroundTasks 组件
  【依赖关系】     composables/useBackgroundTasks · composables/useWorkspaceFeatures · ui/sheet · ui/button
  【边界与注意】   **能力没开就整块不渲染**，不是渲染一个禁用的键。老 Gateway 不认识
                   mcp_tasks，画出入口只会让用户点开一个永远在报错的抽屉。

                   徽章上的数字只数**活跃**任务：这个数字是给「还有几件事没完」用的，
                   把已完成的也算进去，它就永远不会归零。超过 9 显示 9+，
                   免得这颗小圆点被撑变形。

                   列表分「进行中」和「最近」两段。都空时给一整块空态（图标 + 一句
                   说明 + 一句提示），而不是一片空白——用户分不清「没有任务」和
                   「没加载出来」。

                   toast 由**调用方**（会话页）拥有：这个组件挂在会话头部，
                   而 workspace layout 已经 provide 了 toast owner。
-->

<script setup lang="ts">
import { computed } from "vue";
import { ListChecks, LoaderCircle } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import BackgroundTaskCard from "@/components/workspace/background-tasks/BackgroundTaskCard.vue";
import {
  useBackgroundTasks,
  useCancelBackgroundTask,
} from "@/composables/useBackgroundTasks";
import { useMcpTasksEnabled } from "@/composables/useWorkspaceFeatures";
import { isActiveBackgroundTask } from "@/core/background-tasks";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{ threadId: string }>();

const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const { mcpTasksEnabled } = useMcpTasksEnabled();

const tasksQuery = useBackgroundTasks(() => props.threadId, {
  enabled: mcpTasksEnabled,
});
const cancelTask = useCancelBackgroundTask(() => props.threadId, {
  onError: (error) =>
    toast.error(
      `${$i18n.t.value.backgroundTasks.cancelFailed}: ${error.message}`,
    ),
});

const tasks = computed(() => tasksQuery.data.value ?? []);
const activeTasks = computed(() => tasks.value.filter(isActiveBackgroundTask));
const recentTasks = computed(() =>
  tasks.value.filter((task) => !isActiveBackgroundTask(task)),
);
const cancellingTaskId = computed(() =>
  cancelTask.isPending.value ? cancelTask.variables.value : undefined,
);
</script>

<template>
  <Sheet v-if="mcpTasksEnabled">
    <SheetTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        :aria-label="$i18n.t.value.backgroundTasks.label"
        data-testid="background-tasks-trigger"
        class="relative"
      >
        <ListChecks />
        <span class="hidden lg:inline">
          {{ $i18n.t.value.backgroundTasks.label }}
        </span>
        <span
          v-if="activeTasks.length > 0"
          class="bg-primary text-primary-foreground grid size-4 place-items-center rounded-full text-[10px] font-semibold"
        >
          {{ activeTasks.length > 9 ? "9+" : activeTasks.length }}
        </span>
      </Button>
    </SheetTrigger>
    <SheetContent
      class="w-[min(92vw,420px)] gap-0 p-0 sm:max-w-[420px]"
      :close-label="$i18n.t.value.primitives.close"
    >
      <SheetHeader class="border-border border-b px-5 py-4">
        <SheetTitle class="flex items-center gap-2">
          <ListChecks class="size-4" />
          {{ $i18n.t.value.backgroundTasks.title }}
        </SheetTitle>
        <SheetDescription>
          {{ $i18n.t.value.backgroundTasks.description }}
        </SheetDescription>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div
          v-if="tasksQuery.isLoading.value"
          role="status"
          class="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm"
        >
          <LoaderCircle class="size-4 animate-spin" />
          {{ $i18n.t.value.common.loading }}
        </div>
        <div
          v-else-if="tasksQuery.isError.value"
          class="border-destructive/30 bg-destructive/5 rounded-xl border p-4 text-sm"
        >
          <p class="text-destructive font-medium">
            {{ $i18n.t.value.backgroundTasks.loadFailed }}
          </p>
          <p class="text-muted-foreground mt-1 text-xs">
            {{ tasksQuery.error.value?.message }}
          </p>
          <Button
            size="sm"
            variant="outline"
            class="mt-3"
            @click="tasksQuery.refetch()"
          >
            {{ $i18n.t.value.backgroundTasks.retry }}
          </Button>
        </div>
        <div
          v-else-if="tasks.length === 0"
          class="text-muted-foreground flex flex-col items-center px-6 py-14 text-center"
        >
          <ListChecks class="mb-3 size-8 opacity-40" />
          <p class="text-foreground text-sm font-medium">
            {{ $i18n.t.value.backgroundTasks.empty }}
          </p>
          <p class="mt-1 text-xs">
            {{ $i18n.t.value.backgroundTasks.emptyHint }}
          </p>
        </div>
        <div v-else class="space-y-5">
          <section v-if="activeTasks.length > 0">
            <h3
              class="text-muted-foreground mb-2 px-1 text-xs font-medium tracking-wide uppercase"
            >
              {{ $i18n.t.value.backgroundTasks.active }}
            </h3>
            <div class="space-y-2">
              <BackgroundTaskCard
                v-for="task in activeTasks"
                :key="task.task_id"
                :thread-id="threadId"
                :task="task"
                :is-cancelling="cancellingTaskId === task.task_id"
                @cancel="cancelTask.mutate($event)"
              />
            </div>
          </section>
          <!--
            「最近」这一段里的任务按定义都已经结束（`recentTasks` 就是「非活跃」），
            所以卡片自己的 `active` 判据已经把取消键挡掉了——这里不需要再传一个
            「不给取消」的开关，那种开关在这条路径上永远为真，测试也抓不住它坏掉。
          -->
          <section v-if="recentTasks.length > 0">
            <h3
              class="text-muted-foreground mb-2 px-1 text-xs font-medium tracking-wide uppercase"
            >
              {{ $i18n.t.value.backgroundTasks.recent }}
            </h3>
            <div class="space-y-2">
              <BackgroundTaskCard
                v-for="task in recentTasks"
                :key="task.task_id"
                :thread-id="threadId"
                :task="task"
                :is-cancelling="false"
              />
            </div>
          </section>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
