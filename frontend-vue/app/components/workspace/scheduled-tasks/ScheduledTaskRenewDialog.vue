<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { computed, onScopeDispose, ref, useId } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renewalFromForm } from "@/core/scheduled-tasks/renewal";
import {
  editedZonedLocalToUtcIso,
  utcToZonedLocalInput,
} from "@/core/scheduled-tasks/cron";
import { displayTimeZone, formatTaskTime } from "@/core/scheduled-tasks/format";
import { fill, isFrequentSchedule } from "@/core/scheduled-tasks/presentation";
import {
  describeScheduledTaskError,
  type ScheduledTaskErrorDescription,
} from "@/core/scheduled-tasks/errors";
import { useScheduledTaskMutations } from "@/composables/useScheduledTasks";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";
const queryClient = useQueryClient();
const props = defineProps<{ task: ScheduledTask; open: boolean }>();
const emit = defineEmits<{
  "update:open": [open: boolean];
  resumed: [task: ScheduledTask];
}>();
const { $i18n } = useNuxtApp();
const st = computed(() => $i18n.t.value.scheduledTasks);
let disposed = false;
onScopeDispose(() => {
  disposed = true;
});
const ids = useId();
const zone = displayTimeZone(props.task);
const used = props.task.automatic_runs_used ?? 0;
const maxRuns = ref(
  props.task.max_runs != null ? String(props.task.max_runs) : "",
);
const removeMaxRuns = ref(false);
const endAtLocal = ref(
  props.task.end_at ? utcToZonedLocalInput(props.task.end_at, zone) : "",
);
const removeEndAt = ref(false);
const error = ref<ScheduledTaskErrorDescription | null>(null);
const mutations = useScheduledTaskMutations();
const hasRuns = props.task.max_runs != null;
const hasEnd = props.task.end_at != null;
const needsCap =
  props.task.origin_thread_id != null &&
  isFrequentSchedule(props.task.schedule_type, props.task.schedule_spec);
const removeRunsBlocked = computed(
  () => needsCap && (!hasEnd || removeEndAt.value),
);
const removeEndBlocked = computed(
  () => needsCap && (!hasRuns || removeMaxRuns.value),
);
const endAtIso = computed(() =>
  endAtLocal.value
    ? editedZonedLocalToUtcIso(endAtLocal.value, zone, props.task.end_at)
    : null,
);
const renewal = computed(() =>
  renewalFromForm(props.task, {
    maxRuns: maxRuns.value,
    removeMaxRuns: removeMaxRuns.value,
    endAt: endAtIso.value,
    removeEndAt: removeEndAt.value,
  }),
);
const canSubmit = computed(
  () =>
    renewal.value !== "invalid" &&
    Object.keys(renewal.value).length > 0 &&
    !(endAtLocal.value && !endAtIso.value) &&
    !mutations.resume.isPending.value,
);
const body = computed(() =>
  hasRuns && used >= (props.task.max_runs ?? 0)
    ? fill(st.value.renew.bodyRuns, { used, max: props.task.max_runs ?? 0 })
    : hasEnd && Date.parse(props.task.end_at ?? "") <= Date.now()
      ? fill(st.value.renew.bodyEnd, {
          time: formatTaskTime(props.task.end_at ?? "", {
            timeZone: zone,
            locale: $i18n.locale.value,
            labels: st.value.time,
          }),
        })
      : hasEnd && !hasRuns
        ? st.value.notice.limitBodyEnd
        : st.value.notice.limitBodyRuns,
);
async function submit() {
  if (!canSubmit.value || renewal.value === "invalid") return;
  error.value = null;
  const owns = captureWorkspaceQueryOwner(queryClient);
  const taskId = props.task.id;
  const current = () =>
    owns() && !disposed && props.task.id === taskId && props.open;
  try {
    const saved = await mutations.resume.mutateAsync({
      task: props.task,
      renewal: renewal.value,
    });
    if (!current()) return;
    emit("update:open", false);
    emit("resumed", saved);
  } catch (cause) {
    if (!current()) return;
    error.value = describeScheduledTaskError(cause, $i18n.t.value, {
      locale: $i18n.locale.value,
      timeZone: zone,
    });
  }
}
</script>
<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><DialogContent
      class="sm:max-w-md"
      :close-label="$i18n.t.value.primitives.close"
      ><DialogHeader
        ><DialogTitle>{{ st.renew.title }}</DialogTitle
        ><DialogDescription>{{ body }}</DialogDescription></DialogHeader
      >
      <div class="flex flex-col gap-4">
        <div v-if="hasRuns || !hasEnd" class="flex flex-col gap-1.5">
          <label :for="`${ids}-max-runs`" class="text-sm font-medium">{{
            st.form.maxRuns
          }}</label
          ><Input
            :id="`${ids}-max-runs`"
            v-model="maxRuns"
            type="number"
            inputmode="numeric"
            :min="used + 1"
            :disabled="removeMaxRuns"
          />
          <p class="text-muted-foreground text-xs">
            {{ fill(st.form.maxRunsHint, { used }) }}
          </p>
          <div v-if="hasRuns" class="flex flex-col gap-0.5">
            <label
              :for="`${ids}-remove-max-runs`"
              class="flex w-fit items-center gap-2 text-sm aria-disabled:opacity-60"
              :aria-disabled="
                removeRunsBlocked && !removeMaxRuns ? true : undefined
              "
              ><input
                :id="`${ids}-remove-max-runs`"
                v-model="removeMaxRuns"
                type="checkbox"
                class="size-4"
                :disabled="removeRunsBlocked && !removeMaxRuns"
                :aria-describedby="
                  removeRunsBlocked && !removeMaxRuns
                    ? `${ids}-remove-max-runs-blocked`
                    : undefined
                "
              />{{ st.renew.removeCap }}</label
            >
            <p
              v-if="removeRunsBlocked && !removeMaxRuns"
              :id="`${ids}-remove-max-runs-blocked`"
              class="text-muted-foreground text-xs"
            >
              {{ st.renew.removeCapBlocked }}
            </p>
          </div>
        </div>
        <div v-if="hasEnd || !hasRuns" class="flex flex-col gap-1.5">
          <label :for="`${ids}-end-at`" class="text-sm font-medium">{{
            fill(st.form.labelWithZone, { label: st.form.endAt, tz: zone })
          }}</label
          ><Input
            :id="`${ids}-end-at`"
            v-model="endAtLocal"
            type="datetime-local"
            :disabled="removeEndAt"
            :aria-invalid="Boolean(endAtLocal && !endAtIso)"
          />
          <div v-if="hasEnd" class="flex flex-col gap-0.5">
            <label
              :for="`${ids}-remove-end-at`"
              class="flex w-fit items-center gap-2 text-sm aria-disabled:opacity-60"
              :aria-disabled="
                removeEndBlocked && !removeEndAt ? true : undefined
              "
              ><input
                :id="`${ids}-remove-end-at`"
                v-model="removeEndAt"
                type="checkbox"
                class="size-4"
                :disabled="removeEndBlocked && !removeEndAt"
                :aria-describedby="
                  removeEndBlocked && !removeEndAt
                    ? `${ids}-remove-end-at-blocked`
                    : undefined
                "
              />{{ st.renew.removeCap }}</label
            >
            <p
              v-if="removeEndBlocked && !removeEndAt"
              :id="`${ids}-remove-end-at-blocked`"
              class="text-muted-foreground text-xs"
            >
              {{ st.renew.removeCapBlocked }}
            </p>
          </div>
        </div>
        <p
          v-if="renewal === 'invalid'"
          role="alert"
          class="text-destructive text-sm"
        >
          {{ st.apiErrors.invalidMaxRuns }}
        </p>
        <div v-if="error" class="text-destructive flex flex-col gap-1">
          <p role="alert" class="text-sm">{{ error.message }}</p>
          <details v-if="error.details" class="text-xs">
            <summary>{{ st.history.details }}</summary>
            <p class="whitespace-pre-wrap">{{ error.details }}</p>
          </details>
        </div>
      </div>
      <DialogFooter
        ><Button
          variant="outline"
          :disabled="mutations.resume.isPending.value"
          @click="emit('update:open', false)"
          >{{ $i18n.t.value.common.cancel }}</Button
        ><Button :disabled="!canSubmit" @click="submit">{{
          st.renew.submit
        }}</Button></DialogFooter
      ></DialogContent
    ></Dialog
  >
</template>
