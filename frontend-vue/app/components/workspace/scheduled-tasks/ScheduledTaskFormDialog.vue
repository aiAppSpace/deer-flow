<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { computed, nextTick, onScopeDispose, ref, useId, watch } from "vue";
import { ChevronDown, TriangleAlert } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ScheduledTaskScheduleInput from "./ScheduledTaskScheduleInput.vue";
import { useScheduledTaskMutations } from "@/composables/useScheduledTasks";
import { useAgentsApiEnabled } from "@/composables/useWorkspaceFeatures";
import { useAgents } from "@/composables/useAgents";
import { browserTimeZone } from "@/core/scheduled-tasks/format";
import { hasScheduleSpec } from "@/core/scheduled-tasks/cron";
import {
  initialFormState,
  createPayload,
  updatePayload,
  validateForm,
  type TaskFormRequest,
  type TaskFormState,
  type TaskFormMode,
} from "@/core/scheduled-tasks/form-state";
import {
  DEFAULT_ASSISTANT_ID,
  fill,
  isFrequentSchedule,
} from "@/core/scheduled-tasks/presentation";
import { RECIPES, type Recipe } from "@/core/scheduled-tasks/recipes";
import {
  describeScheduledTaskError,
  shouldReportScheduledTaskError,
} from "@/core/scheduled-tasks/errors";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
const queryClient = useQueryClient();
const props = defineProps<{
  request: TaskFormRequest | null;
  toolEnabled: boolean;
  minIntervalSeconds?: number;
}>();
const emit = defineEmits<{
  "update:open": [open: boolean];
  saved: [task: ScheduledTask, mode: TaskFormMode];
}>();
const { $i18n } = useNuxtApp();
const st = computed(() => $i18n.t.value.scheduledTasks);
const toast = useWorkspaceToast();
let disposed = false;
onScopeDispose(() => {
  disposed = true;
});
const ids = useId();
const id = (key: string) => `${ids}-${key}`;
const state = ref<TaskFormState>(
  initialFormState({ mode: "create" }, "").state,
);
const initial = ref(initialFormState({ mode: "create" }, ""));
const scheduleInitial = ref(state.value.schedule);
const scheduleNonce = ref(0);
const error = ref<string | null>(null);
const advancedOpen = ref(false);
const editing = computed(
  () => props.request?.mode === "edit" && !!props.request.task,
);
const reuse = computed(() => state.value.contextMode === "reuse_thread");
const timeZone = computed(
  () => state.value.schedule.timezone || browserTimeZone(),
);
const mutations = useScheduledTaskMutations();
const pending = computed(
  () => mutations.create.isPending.value || mutations.update.isPending.value,
);
const agentsFeature = useAgentsApiEnabled({
  enabled: () => props.request !== null,
});
const agentsQuery = useAgents({
  retry: false,
  enabled: () =>
    props.request !== null &&
    agentsFeature.loaded.value &&
    agentsFeature.agentsApiEnabled.value,
});
const agentOptions = computed(() => {
  const result = [
    { value: DEFAULT_ASSISTANT_ID, label: st.value.create.leadAgent },
    ...(agentsQuery.agents.value ?? [])
      .filter((a) => a.name !== DEFAULT_ASSISTANT_ID)
      .map((a) => ({ value: a.name, label: a.name })),
  ];
  if (!result.some((a) => a.value === state.value.assistantId))
    result.push({
      value: state.value.assistantId,
      label: state.value.assistantId,
    });
  return result;
});
watch(
  () => props.request,
  (request) => {
    if (!request) return;
    initial.value = initialFormState(request, st.value.form.copySuffix);
    state.value = initial.value.state;
    scheduleInitial.value = state.value.schedule;
    scheduleNonce.value += 1;
    error.value = null;
    advancedOpen.value =
      state.value.contextMode === "reuse_thread" ||
      state.value.assistantId !== DEFAULT_ASSISTANT_ID;
  },
  { immediate: true },
);
const used = computed(() =>
  editing.value ? (props.request?.task?.automatic_runs_used ?? 0) : 0,
);
const showFrequentWarning = computed(
  () =>
    editing.value &&
    props.request?.task?.origin_thread_id != null &&
    isFrequentSchedule(
      state.value.schedule.schedule_type,
      state.value.schedule.schedule_spec,
    ) &&
    !state.value.maxRuns.trim() &&
    !state.value.endAtLocal,
);
function close() {
  emit("update:open", false);
}
function applyRecipe(recipe: Recipe) {
  const labels = st.value.recipes[recipe.titleKey];
  state.value = {
    ...state.value,
    title: labels.title,
    prompt: labels.prompt,
    schedule: recipe.schedule,
    contextMode: "fresh_thread_per_run",
  };
  scheduleInitial.value = recipe.schedule;
  scheduleNonce.value += 1;
}
async function submit() {
  const request = props.request;
  if (!request) return;
  const owns = captureWorkspaceQueryOwner(queryClient);
  const valid = validateForm(state.value, request.task?.end_at);
  if (!valid.ok) {
    error.value =
      valid.error === "required"
        ? st.value.form.required
        : valid.error === "invalidMaxRuns"
          ? st.value.apiErrors.invalidMaxRuns
          : valid.error === "goalNeedsFresh"
            ? st.value.form.goalNeedsFresh
            : st.value.form.invalidEndAt;
    return;
  }
  error.value = null;
  try {
    let saved: ScheduledTask;
    if (editing.value && request.task) {
      const payload = updatePayload(request.task, state.value, valid, {
        includeStopCondition: props.toolEnabled,
      });
      if (!Object.keys(payload).length) {
        close();
        return;
      }
      saved = await mutations.update.mutateAsync({
        task: request.task,
        payload,
      });
      if (!owns() || disposed || props.request !== request) return;
      toast.success(st.value.feedback.saved);
    } else {
      saved = await mutations.create.mutateAsync(
        createPayload(state.value, valid),
      );
      if (!owns() || disposed || props.request !== request) return;
      toast.success(st.value.feedback.created);
    }
    close();
    emit("saved", saved, request.mode);
  } catch (cause) {
    if (
      !owns() ||
      disposed ||
      props.request !== request ||
      !shouldReportScheduledTaskError(cause)
    )
      return;
    const described = describeScheduledTaskError(cause, $i18n.t.value, {
      locale: $i18n.locale.value,
    });
    toast.error(
      `${editing.value ? st.value.errors.update : st.value.errors.create}: ${described.message}`,
      { description: described.details ?? undefined },
    );
  }
}
async function autoFocus(event: Event) {
  event.preventDefault();
  await nextTick();
  document
    .getElementById(id(props.request?.focus === "goal" ? "goal" : "title"))
    ?.focus();
}
</script>
<template>
  <Dialog :open="request !== null" @update:open="emit('update:open', $event)">
    <DialogContent
      v-if="request"
      class="max-h-[90vh] sm:max-w-xl"
      data-testid="scheduled-task-form"
      :close-label="$i18n.t.value.primitives.close"
      @open-auto-focus="autoFocus"
    >
      <DialogHeader
        ><DialogTitle>{{
          editing ? st.form.editTitle : st.form.createTitle
        }}</DialogTitle
        ><DialogDescription class="sr-only">{{
          st.form.instructionsHint
        }}</DialogDescription></DialogHeader
      >
      <div class="flex min-w-0 flex-col gap-4">
        <div
          v-if="request.mode === 'create'"
          class="flex flex-wrap items-center gap-1"
          data-testid="schedule-recipes"
        >
          <span class="text-muted-foreground text-sm">{{
            st.recipes.label
          }}</span
          ><Button
            v-for="recipe in RECIPES"
            :key="recipe.id"
            type="button"
            variant="outline"
            size="sm"
            class="h-auto min-h-8 max-w-full whitespace-normal"
            @click="applyRecipe(recipe)"
            ><span aria-hidden="true">{{ recipe.icon }}</span
            >{{ st.recipes[recipe.titleKey].title }}</Button
          >
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <label :for="id('title')" class="text-sm font-medium">{{
            st.form.title
          }}</label
          ><Input
            :id="id('title')"
            v-model="state.title"
            :autofocus="request.focus !== 'goal'"
          />
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <label :for="id('prompt')" class="text-sm font-medium">{{
            st.form.instructions
          }}</label
          ><Textarea
            :id="id('prompt')"
            v-model="state.prompt"
            rows="4"
            :aria-describedby="`${id('prompt')}-hint`"
          />
          <p :id="`${id('prompt')}-hint`" class="text-muted-foreground text-xs">
            {{ st.form.instructionsHint }}
          </p>
        </div>
        <fieldset class="flex min-w-0 flex-col gap-1.5">
          <legend class="mb-1.5 text-sm font-medium">
            {{ st.form.schedule }}
          </legend>
          <ScheduledTaskScheduleInput
            :key="scheduleNonce"
            :initial="scheduleInitial"
            :schedule-type-locked="editing"
            :min-interval-seconds="minIntervalSeconds"
            @change="state.schedule = $event"
          />
        </fieldset>
        <div v-if="toolEnabled" class="flex min-w-0 flex-col gap-1.5">
          <label :for="id('stop')" class="text-sm font-medium">{{
            st.form.stopCondition
          }}</label
          ><Textarea
            :id="id('stop')"
            v-model="state.stopCondition"
            rows="2"
            :aria-describedby="`${id('stop')}-hint`"
          />
          <p :id="`${id('stop')}-hint`" class="text-muted-foreground text-xs">
            {{ st.form.stopConditionHint }}
          </p>
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <label :for="id('goal')" class="text-sm font-medium">{{
            st.form.goal
          }}</label
          ><Textarea
            :id="id('goal')"
            v-model="state.goal"
            rows="2"
            :readonly="reuse && !state.goal"
            :aria-disabled="reuse && !state.goal"
            :aria-describedby="`${id('goal')}-hint`"
          />
          <p :id="`${id('goal')}-hint`" class="text-muted-foreground text-xs">
            {{ reuse ? st.form.goalNeedsFresh : st.form.goalHint }}
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-1.5">
            <label :for="id('max-runs')" class="text-sm font-medium">{{
              st.form.maxRuns
            }}</label>
            <div class="flex gap-2">
              <Input
                :id="id('max-runs')"
                v-model="state.maxRuns"
                type="number"
                inputmode="numeric"
                min="1"
                :aria-describedby="`${id('max-runs')}-hint`"
              /><Button
                v-if="state.maxRuns"
                type="button"
                variant="ghost"
                size="sm"
                :aria-label="`${st.form.clear} ${st.form.maxRuns}`"
                @click="state.maxRuns = ''"
                >{{ st.form.clear }}</Button
              >
            </div>
            <p
              :id="`${id('max-runs')}-hint`"
              class="text-muted-foreground text-xs"
            >
              {{ fill(st.form.maxRunsHint, { used }) }}
            </p>
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <label :for="id('end-at')" class="text-sm font-medium">{{
              fill(st.form.labelWithZone, {
                label: st.form.endAt,
                tz: timeZone,
              })
            }}</label>
            <div class="flex gap-2">
              <Input
                :id="id('end-at')"
                v-model="state.endAtLocal"
                type="datetime-local"
                :aria-describedby="
                  initial.endAtDropped ? `${id('end-at')}-hint` : undefined
                "
              /><Button
                v-if="state.endAtLocal"
                type="button"
                variant="ghost"
                size="sm"
                :aria-label="`${st.form.clear} ${st.form.endAt}`"
                @click="state.endAtLocal = ''"
                >{{ st.form.clear }}</Button
              >
            </div>
            <p
              v-if="initial.endAtDropped"
              :id="`${id('end-at')}-hint`"
              class="text-muted-foreground text-xs"
            >
              {{ st.form.endAtPassed }}
            </p>
          </div>
        </div>
        <p
          v-if="showFrequentWarning"
          role="note"
          class="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400"
        >
          <TriangleAlert class="size-4 shrink-0" aria-hidden="true" />{{
            st.form.frequentNeedsCap
          }}
        </p>
        <Collapsible v-model:open="advancedOpen"
          ><CollapsibleTrigger as-child
            ><Button type="button" variant="ghost" size="sm" class="-ml-2 w-fit"
              ><ChevronDown
                class="size-4 transition-transform"
                :class="!advancedOpen && '-rotate-90'"
                aria-hidden="true"
              />{{ st.form.advanced }}</Button
            ></CollapsibleTrigger
          ><CollapsibleContent class="mt-2 flex flex-col gap-4">
            <div class="flex min-w-0 flex-col gap-1.5">
              <label :for="id('agent')" class="text-sm font-medium">{{
                st.form.agent
              }}</label
              ><Select v-model="state.assistantId"
                ><SelectTrigger
                  :id="id('agent')"
                  class="w-full"
                  data-testid="scheduled-task-form-agent"
                  :aria-label="st.form.agent"
                  ><SelectValue /></SelectTrigger
                ><SelectContent
                  ><SelectItem
                    v-for="option in agentOptions"
                    :key="option.value"
                    :value="option.value"
                    >{{ option.label }}</SelectItem
                  ></SelectContent
                ></Select
              >
            </div>
            <div
              class="flex flex-wrap gap-2"
              role="group"
              :aria-label="st.form.contextLabel"
            >
              <Button
                type="button"
                size="sm"
                class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
                :variant="reuse ? 'outline' : 'default'"
                :aria-pressed="!reuse"
                @click="state.contextMode = 'fresh_thread_per_run'"
                >{{ st.form.contextFresh }}</Button
              ><Button
                type="button"
                size="sm"
                class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
                :variant="reuse ? 'default' : 'outline'"
                :aria-pressed="reuse"
                @click="state.contextMode = 'reuse_thread'"
                >{{ st.form.contextReuse }}</Button
              >
            </div>
            <template v-if="reuse"
              ><div class="flex min-w-0 flex-col gap-1.5">
                <label :for="id('chat')" class="text-sm font-medium">{{
                  st.form.chatId
                }}</label
                ><Input :id="id('chat')" v-model="state.chatId" />
              </div>
              <Alert class="border-amber-500/50 bg-amber-500/10"
                ><TriangleAlert
                  class="text-amber-600 dark:text-amber-400"
                /><AlertTitle>{{ st.form.reuseNoticeTitle }}</AlertTitle
                ><AlertDescription>{{
                  st.form.reuseNoticeDescription
                }}</AlertDescription></Alert
              ></template
            >
          </CollapsibleContent></Collapsible
        >
        <p v-if="error" role="alert" class="text-destructive text-sm">
          {{ error }}
        </p>
        <DialogFooter
          ><Button
            type="button"
            variant="outline"
            :disabled="pending"
            @click="close"
            >{{ $i18n.t.value.common.cancel }}</Button
          ><Button
            type="button"
            :disabled="
              pending || !hasScheduleSpec(state.schedule.schedule_spec)
            "
            @click="submit"
            >{{ editing ? st.form.save : st.form.create }}</Button
          ></DialogFooter
        >
      </div>
    </DialogContent></Dialog
  >
</template>
