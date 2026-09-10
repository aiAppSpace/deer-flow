<script setup lang="ts">
/*
  【文件职责】     编排 scheduled-task route 默认值、表单、筛选、selection 与 Vue Query owners。
  【架构位置】     L3 application page
  【主要导出】     默认 scheduled tasks page
  【依赖关系】     useScheduledTasks · WorkspaceContainer · scheduled-task components ·
                   form/view-model 纯逻辑 · workspace toast
  【边界与注意】   route thread_id 只提供默认/列表 scope；表单可切 fresh/reuse；页面不保留
                   server-state 副本。

                   套 WorkspaceContainer：React 的这一页在 WorkspaceContainer /
                   WorkspaceHeader / WorkspaceBody 三件套里，于是有面包屑、GitHub 链接和
                   第二层 `main`。Vue 原来直接是一个 `section`，读屏器在这一页听不到
                   「工作区 › 定时任务」。

                   mutation 失败走 **toast**，不是页面上的一条内联提示：React 的六个
                   mutation hook 都是 `toast.error(...)`。成功没有任何提示——原来那条绿色
                   的 `role="status"` 是 Vue 独有的。留在页面里的只有两条内联文字：
                   列表取数失败（普通 div，没有 alert 角色），以及必填项没填满时的
                   `fillRequired`。

                   删除确认是 Dialog 不是 AlertDialog，并且**归页面持有**：React 的
                   `<Dialog>` 就在页面根上，由详情里的 Delete 打开。
*/
import { computed, nextTick, ref, watch } from "vue";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer.vue";
import ScheduledTaskDetail from "@/components/workspace/scheduled-tasks/ScheduledTaskDetail.vue";
import ScheduledTaskFilters from "@/components/workspace/scheduled-tasks/ScheduledTaskFilters.vue";
import ScheduledTaskForm from "@/components/workspace/scheduled-tasks/ScheduledTaskForm.vue";
import ScheduledTaskList from "@/components/workspace/scheduled-tasks/ScheduledTaskList.vue";
import {
  buildScheduledTaskCreatePayload,
  buildScheduledTaskUpdatePayload,
  createScheduledTaskDraft,
  draftForScheduledTask,
  duplicateScheduledTaskDraft,
  isScheduledTaskDraftComplete,
  type ScheduledTaskDraft,
} from "@/core/scheduled-tasks/form";
import {
  filterScheduledTasks,
  resolveScheduledTaskSelection,
  type ScheduledTaskScheduleFilter,
  type ScheduledTaskStatusFilter,
} from "@/core/scheduled-tasks/view-model";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import {
  useScheduledTaskMutations,
  useScheduledTaskRuns,
  useScheduledTasks,
} from "@/composables/useScheduledTasks";

definePageMeta({ layout: "workspace" });

const route = useRoute();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const routeThreadId = computed(() => {
  const value = route.query.thread_id;
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() ? first.trim() : null;
});

useHead(() => ({
  title: `${$i18n.t.value.sidebar.scheduledTasks} - ${$i18n.t.value.pages.appName}`,
}));

const tasksQuery = useScheduledTasks(routeThreadId);
const statusFilter = ref<ScheduledTaskStatusFilter>("all");
const scheduleTypeFilter = ref<ScheduledTaskScheduleFilter>("all");
const selectedId = ref<string | null>(null);
const filteredTasks = computed(() =>
  filterScheduledTasks(tasksQuery.tasks.value, {
    status: statusFilter.value,
    scheduleType: scheduleTypeFilter.value,
  }),
);

const editing = ref(false);
const editDraft = ref<ScheduledTaskDraft | null>(null);

/*
  筛选把当前选中项筛没了：改选第一条并退出编辑。React 的同名 effect 只在这一种情况下
  关掉编辑——单纯换选一条任务时编辑态是保留的，字段换成新任务的值。
*/
watch(
  filteredTasks,
  (tasks) => {
    const next = resolveScheduledTaskSelection(tasks, selectedId.value);
    if (next === selectedId.value) return;
    if (selectedId.value) editing.value = false;
    selectedId.value = next;
  },
  { immediate: true },
);

const selectedTask = computed(
  () =>
    filteredTasks.value.find((task) => task.id === selectedId.value) ??
    filteredTasks.value[0] ??
    null,
);
const runsQuery = useScheduledTaskRuns(() => selectedTask.value?.id ?? null);
const mutations = useScheduledTaskMutations();

// 只依赖 id：后台重取同一个任务（新对象引用）不该抹掉正在编辑的内容。
watch(
  () => selectedTask.value?.id,
  () => {
    const task = selectedTask.value;
    if (!task) {
      editing.value = false;
      editDraft.value = null;
      return;
    }
    editDraft.value = draftForScheduledTask(task);
  },
  { immediate: true },
);

const createDraft = ref<ScheduledTaskDraft>(createScheduledTaskDraft());
const createForm = ref<HTMLElement | null>(null);
const createFormKey = ref(0);
const formError = ref<string | null>(null);

/*
  复制一条任务：把它的内容填进**上面那张新建表单**，标题加个后缀。

  填完要滚回表单：这一页上下两块，详情在下面，用户点了「复制」之后如果不滚，
  屏幕上什么都没变，看起来像没生效。
*/
async function duplicateTask() {
  const task = selectedTask.value;
  if (!task) return;
  createDraft.value = duplicateScheduledTaskDraft(
    task,
    $i18n.t.value.scheduledTasks.actions.duplicateTitleSuffix,
  );
  // 上一次提交留下的报错跟这份新草稿没关系了（上游同处的 setFormError(null)）。
  formError.value = null;
  /*
    重挂表单，与切换 thread 过滤时同一条：表单里的排程输入自己带本地状态
    （cron 文本、run_at 时间），只换 draft 的话它们会停在上一次的值上。
    上游用 `createNonce` 表达的是同一件事。
  */
  createFormKey.value += 1;
  await nextTick();
  createForm.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}
watch(
  routeThreadId,
  (threadId) => {
    createDraft.value = createScheduledTaskDraft({ routeThreadId: threadId });
    createFormKey.value += 1;
  },
  { immediate: true },
);

const deleteOpen = ref(false);

function failed(operation: keyof typeof $i18n.t.value.scheduledTasks.errors) {
  return (cause: unknown) => {
    const detail = cause instanceof Error ? cause.message : String(cause);
    toast.error(`${$i18n.t.value.scheduledTasks.errors[operation]}: ${detail}`);
  };
}

async function createTask() {
  if (!isScheduledTaskDraftComplete(createDraft.value)) {
    formError.value = $i18n.t.value.scheduledTasks.create.fillRequired;
    return;
  }
  formError.value = null;
  try {
    await mutations.create.mutateAsync(
      buildScheduledTaskCreatePayload(createDraft.value),
    );
    // 清空表单，下一个任务从头开始。
    createDraft.value = createScheduledTaskDraft({
      routeThreadId: routeThreadId.value,
    });
    createFormKey.value += 1;
  } catch (cause) {
    failed("create")(cause);
  }
}

async function saveEdit() {
  const task = selectedTask.value;
  const draft = editDraft.value;
  if (!task || !draft) return;
  try {
    await mutations.update.mutateAsync({
      task,
      payload: buildScheduledTaskUpdatePayload(draft),
    });
  } catch (cause) {
    failed("update")(cause);
  }
}

async function runAction(operation: "pause" | "resume" | "trigger") {
  const task = selectedTask.value;
  if (!task) return;
  try {
    await mutations[operation].mutateAsync({ task });
  } catch (cause) {
    failed(operation)(cause);
  }
}

async function confirmDelete() {
  const task = selectedTask.value;
  if (!task) return;
  try {
    await mutations.remove.mutateAsync({ task });
    deleteOpen.value = false;
  } catch (cause) {
    failed("delete")(cause);
  }
}

const loadError = computed(() => {
  const cause = tasksQuery.error.value;
  if (!cause) return null;
  const detail = cause instanceof Error ? cause.message : String(cause);
  return `${$i18n.t.value.scheduledTasks.detail.loadFailed}: ${detail}`;
});
</script>

<template>
  <WorkspaceContainer>
    <div
      class="mx-auto flex w-full max-w-[var(--container-width-md)] flex-col gap-4 p-6"
    >
      <h1 class="text-2xl font-semibold">
        {{ $i18n.t.value.sidebar.scheduledTasks }}
      </h1>

      <div ref="createForm">
        <ScheduledTaskForm
          :key="createFormKey"
          v-model:draft="createDraft"
          :pending="mutations.create.isPending.value"
          :error="formError"
          @submit="createTask"
        />
      </div>

      <div v-if="routeThreadId" class="text-muted-foreground text-sm">
        {{
          $i18n.t.value.scheduledTasks.detail.filteredByThread.replace(
            "{id}",
            routeThreadId,
          )
        }}
      </div>
      <div
        v-if="loadError"
        class="text-destructive text-sm"
        data-testid="scheduled-task-load-error"
      >
        {{ loadError }}
      </div>

      <ScheduledTaskFilters
        v-model:status="statusFilter"
        v-model:schedule-type="scheduleTypeFilter"
      />

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ScheduledTaskList
          :tasks="filteredTasks"
          :selected-id="selectedTask?.id ?? null"
          @select="selectedId = $event"
        />
        <div class="rounded-lg border p-4" data-testid="scheduled-task-detail">
          <ScheduledTaskDetail
            v-if="selectedTask && editDraft"
            v-model:edit-draft="editDraft"
            :task="selectedTask"
            :runs="runsQuery.runs.value"
            :runs-has-more="Boolean(runsQuery.hasNextPage.value)"
            :runs-loading-more="runsQuery.isFetchingNextPage.value"
            :editing="editing"
            :update-pending="mutations.update.isPending.value"
            @toggle-edit="editing = !editing"
            @save="saveEdit"
            @pause="runAction('pause')"
            @resume="runAction('resume')"
            @trigger="runAction('trigger')"
            @duplicate="duplicateTask"
            @delete="deleteOpen = true"
            @load-more-runs="runsQuery.loadMore()"
          />
          <div v-else class="text-muted-foreground text-sm">
            {{ $i18n.t.value.scheduledTasks.detail.noSelection }}
          </div>
        </div>
      </div>
    </div>

    <!-- 删除二次确认——与 agent 卡片的确认框同一种形状。 -->
    <Dialog v-model:open="deleteOpen">
      <DialogContent
        data-testid="scheduled-task-delete-dialog"
        :close-label="$i18n.t.value.primitives.close"
      >
        <DialogHeader>
          <DialogTitle>
            {{ $i18n.t.value.scheduledTasks.actions.delete }}
          </DialogTitle>
          <DialogDescription>
            {{ $i18n.t.value.scheduledTasks.deleteConfirm }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="mutations.remove.isPending.value"
            @click="deleteOpen = false"
          >
            {{ $i18n.t.value.common.cancel }}
          </Button>
          <Button
            data-testid="scheduled-task-delete-confirm"
            variant="destructive"
            :disabled="mutations.remove.isPending.value"
            @click="confirmDelete"
          >
            {{
              mutations.remove.isPending.value
                ? $i18n.t.value.common.loading
                : $i18n.t.value.scheduledTasks.actions.delete
            }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </WorkspaceContainer>
</template>
