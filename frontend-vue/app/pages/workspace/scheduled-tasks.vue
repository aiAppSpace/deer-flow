<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  CalendarClock,
  CalendarOff,
  CirclePause,
  Plus,
  X,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer.vue";
import ScheduledTaskDetail from "@/components/workspace/scheduled-tasks/ScheduledTaskDetail.vue";
import ScheduledTaskFormDialog from "@/components/workspace/scheduled-tasks/ScheduledTaskFormDialog.vue";
import ScheduledTaskList from "@/components/workspace/scheduled-tasks/ScheduledTaskList.vue";
import TaskActionReason from "@/components/workspace/scheduled-tasks/TaskActionReason.vue";
import {
  useScheduledTasks,
  useThreadScheduledTasks,
} from "@/composables/useScheduledTasks";
import { useScheduledTasksFeature } from "@/composables/useSchedulerFeatures";
import {
  fill,
  statusTabOf,
  type StatusTab,
} from "@/core/scheduled-tasks/presentation";
import { matchesScheduledTaskQuery } from "@/core/scheduled-tasks/search";
import { describeScheduledTaskError } from "@/core/scheduled-tasks/errors";
import type {
  TaskFormRequest,
  TaskFormMode,
} from "@/core/scheduled-tasks/form-state";
import type {
  ScheduledTask,
  ThreadScheduledTask,
} from "@/core/scheduled-tasks/types";
definePageMeta({ layout: "workspace" });
const route = useRoute(),
  router = useRouter();
const { $i18n } = useNuxtApp();
const st = computed(() => $i18n.t.value.scheduledTasks);
const queryString = (value: unknown) =>
  Array.isArray(value)
    ? typeof value[0] === "string"
      ? value[0]
      : null
    : typeof value === "string" && value
      ? value
      : null;
const threadId = computed(() => queryString(route.query.thread_id)),
  taskId = computed(() => queryString(route.query.task_id));
useHead(() => ({
  title: `${$i18n.t.value.sidebar.scheduledTasks} - ${$i18n.t.value.pages.appName}`,
}));
const feature = useScheduledTasksFeature();
const createBlocked = computed(() => !feature.running.value);
const toolEnabled = computed(
  () => feature.isLoading.value || feature.toolEnabled.value,
);
const all = useScheduledTasks(null, { enabled: feature.available });
const thread = useThreadScheduledTasks(threadId, {
  enabled: feature.available,
});
const query = computed(() => (threadId.value ? thread : all));
const tasks = computed(() =>
  threadId.value
    ? (thread.tasks.value as ThreadScheduledTask[]).filter(
        (task) => task.thread_relation !== "run",
      )
    : all.tasks.value,
);
const tab = ref<StatusTab>("all"),
  search = ref(""),
  shownId = ref<string | null>(null),
  request = ref<TaskFormRequest | null>(null),
  detail = ref<HTMLElement | null>(null);
const tabs: StatusTab[] = ["all", "active", "paused", "finished"];
const inTab = (task: ScheduledTask, value: StatusTab) =>
  value === "all" || statusTabOf(task) === value;
const visible = computed(() =>
  tasks.value.filter(
    (task) =>
      inTab(task, tab.value) && matchesScheduledTaskQuery(task, search.value),
  ),
);
const pinned = computed(
  () =>
    tasks.value.find((task) => task.id === (taskId.value ?? shownId.value)) ??
    null,
);
const missing = computed(
  () => !!taskId.value && query.value.isSuccess.value && !pinned.value,
);
const selected = computed(() =>
  missing.value ? null : (pinned.value ?? visible.value[0] ?? null),
);
watch(
  selected,
  (task) => {
    if (!taskId.value && task) shownId.value = task.id;
  },
  { immediate: true },
);
let applied: string | null = null;
watch([taskId, tasks], () => {
  const id = taskId.value;
  if (!id || applied === id) return;
  const task = tasks.value.find((item) => item.id === id);
  if (!task) return;
  applied = id;
  if (!inTab(task, tab.value)) tab.value = "all";
  if (!matchesScheduledTaskQuery(task, search.value)) search.value = "";
});
function replaceQuery(id: string | null, keepThread = true) {
  const query: Record<string, string> = {};
  if (keepThread && threadId.value) query.thread_id = threadId.value;
  if (id) query.task_id = id;
  return router.replace({ path: route.path, query });
}
function changeFilter(value: { tab?: StatusTab; search?: string }) {
  const nextTab = value.tab ?? tab.value,
    nextSearch = value.search ?? search.value;
  tab.value = nextTab;
  search.value = nextSearch;
  if (
    selected.value &&
    !(
      inTab(selected.value, nextTab) &&
      matchesScheduledTaskQuery(selected.value, nextSearch)
    )
  ) {
    shownId.value = null;
    if (taskId.value) void replaceQuery(null);
  }
}
async function select(id: string) {
  applied = id;
  await replaceQuery(id);
  if (!window.matchMedia?.("(min-width: 1024px)").matches) {
    await nextTick();
    detail.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
function saved(task: ScheduledTask, mode: TaskFormMode) {
  if (mode === "edit") return;
  applied = null;
  const owned =
    !!threadId.value &&
    (task.thread_id === threadId.value ||
      task.origin_thread_id === threadId.value);
  void replaceQuery(task.id, owned);
}
const empty = computed(
  () => all.isSuccess.value && all.tasks.value.length === 0,
);
const error = computed(() =>
  query.value.error.value
    ? describeScheduledTaskError(query.value.error.value, $i18n.t.value, {
        locale: $i18n.locale.value,
      })
    : null,
);
</script>
<template>
  <WorkspaceContainer
    ><div
      class="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 px-4 py-5 sm:px-6"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="text-2xl font-semibold">
            {{ $i18n.t.value.sidebar.scheduledTasks }}
          </h1>
          <p class="text-muted-foreground text-sm">
            {{ toolEnabled ? st.page.description : st.page.descriptionNoChat }}
          </p>
        </div>
        <TaskActionReason
          v-if="feature.available.value"
          :reason="createBlocked ? st.page.createBlocked : null"
          ><Button
            size="sm"
            :disabled="createBlocked"
            data-testid="scheduled-task-new"
            @click="request = { mode: 'create' }"
            ><Plus aria-hidden="true" />{{ st.page.newTask }}</Button
          ></TaskActionReason
        >
      </div>
      <div
        v-if="!feature.available.value"
        class="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center"
        data-testid="scheduled-tasks-unavailable"
      >
        <CalendarOff class="text-muted-foreground size-6" aria-hidden="true" />
        <h2 class="text-base font-semibold">{{ st.page.unavailableTitle }}</h2>
        <p class="text-muted-foreground text-sm">
          {{ st.page.unavailableBody }}
        </p>
      </div>
      <Alert
        v-else-if="!feature.running.value"
        class="border-amber-500/50 bg-amber-500/10"
        data-testid="scheduler-off-notice"
        ><CirclePause
          class="text-amber-600 dark:text-amber-400"
        /><AlertTitle>{{ st.page.schedulerOffTitle }}</AlertTitle
        ><AlertDescription>{{
          st.page.schedulerOffBody
        }}</AlertDescription></Alert
      >
      <template v-if="feature.available.value">
        <div
          v-if="threadId"
          class="bg-muted/60 flex w-fit items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm"
          data-testid="scheduled-task-thread-filter"
        >
          <span>{{ st.page.threadFilter }}</span
          ><Button
            variant="ghost"
            size="sm"
            class="h-7 rounded-full"
            @click="replaceQuery(taskId, false)"
            ><X aria-hidden="true" />{{ st.page.showAll }}</Button
          >
        </div>
        <div
          v-if="error"
          class="text-destructive flex flex-col gap-1 text-sm"
          data-testid="scheduled-task-load-error"
        >
          <p role="alert">
            {{
              fill(st.errors.withReason, {
                action: st.detail.loadFailed,
                reason: error.message,
              })
            }}
          </p>
          <details v-if="error.details" class="text-xs">
            <summary>{{ st.history.details }}</summary>
            <p class="whitespace-pre-wrap">{{ error.details }}</p>
          </details>
        </div>
        <div
          v-if="empty"
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center"
          data-testid="scheduled-task-empty"
        >
          <span
            class="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full"
            ><CalendarClock class="size-5" aria-hidden="true"
          /></span>
          <h2 class="text-base font-semibold">{{ st.page.emptyTitle }}</h2>
          <p class="text-muted-foreground max-w-md text-sm">
            {{ toolEnabled ? st.page.emptyBody : st.page.emptyBodyNoChat }}
          </p>
          <TaskActionReason
            :reason="createBlocked ? st.page.createBlocked : null"
            ><Button
              size="sm"
              :disabled="createBlocked"
              @click="request = { mode: 'create' }"
              ><Plus aria-hidden="true" />{{ st.page.newTask }}</Button
            ></TaskActionReason
          >
        </div>
        <div
          v-else
          class="grid min-w-0 gap-4 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start"
        >
          <div class="flex min-w-0 flex-col gap-3">
            <ToggleGroup
              type="single"
              :model-value="tab"
              :aria-label="st.page.tabsLabel"
              size="sm"
              :spacing="1"
              class="flex-wrap"
              @update:model-value="
                $event && changeFilter({ tab: $event as StatusTab })
              "
              ><ToggleGroupItem
                v-for="value in tabs"
                :key="value"
                :value="value"
                :single="true"
                :checked="tab === value"
                :aria-label="
                  fill(st.page.tabCount, {
                    tab: st.page.tabs[value],
                    count: tasks.filter((task) => inTab(task, value)).length,
                  })
                "
                class="data-[state=on]:bg-secondary gap-1 rounded-full px-2.5"
                >{{ st.page.tabs[value]
                }}<span
                  aria-hidden="true"
                  class="text-muted-foreground tabular-nums"
                  >{{ tasks.filter((task) => inTab(task, value)).length }}</span
                ></ToggleGroupItem
              ></ToggleGroup
            >
            <div class="flex gap-2">
              <Input
                type="search"
                :aria-label="st.page.search"
                :placeholder="st.page.search"
                :model-value="search"
                @update:model-value="changeFilter({ search: $event })"
              /><Button
                v-if="search"
                variant="outline"
                @click="changeFilter({ search: '' })"
                >{{ st.search.clear }}</Button
              >
            </div>
            <p
              v-if="query.isPending.value && !error"
              role="status"
              data-testid="scheduled-task-list-loading"
              class="text-muted-foreground text-sm"
            >
              {{ st.page.loading }}
            </p>
            <p
              v-if="query.isSuccess.value && !visible.length"
              role="status"
              data-testid="scheduled-task-search-empty"
              class="text-muted-foreground text-sm"
            >
              {{ st.search.noResults }}
            </p>
            <ScheduledTaskList
              :tasks="visible"
              :selected-id="selected?.id ?? null"
              @select="select"
            />
          </div>
          <div ref="detail" class="min-w-0 scroll-mt-4">
            <div
              v-if="missing"
              role="status"
              data-testid="scheduled-task-link-missing"
              class="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm"
            >
              <p>
                {{
                  threadId ? st.page.taskNotInChat : st.apiErrors.taskNotFound
                }}
              </p>
              <Button
                v-if="threadId"
                variant="outline"
                size="sm"
                @click="replaceQuery(taskId, false)"
                >{{ st.page.showAll }}</Button
              >
            </div>
            <ScheduledTaskDetail
              v-else-if="selected"
              :key="selected.id"
              :task="selected"
              :tool-enabled="toolEnabled"
              :create-blocked="createBlocked"
              @edit="(task, focus) => (request = { mode: 'edit', task, focus })"
              @duplicate="(task) => (request = { mode: 'duplicate', task })"
              @deleted="replaceQuery(null)"
            />
            <p
              v-else-if="query.isSuccess.value"
              class="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
            >
              {{ st.page.selectHint }}
            </p>
          </div>
        </div>
      </template>
    </div>
    <ScheduledTaskFormDialog
      :request="request"
      :tool-enabled="feature.toolEnabled.value"
      :min-interval-seconds="feature.minIntervalSeconds.value"
      @update:open="!$event && (request = null)"
      @saved="saved"
  /></WorkspaceContainer>
</template>
