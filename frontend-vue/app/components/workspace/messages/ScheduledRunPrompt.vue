<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowUpRight, CalendarClock, ChevronRight } from "lucide-vue-next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { fill } from "@/core/scheduled-tasks/presentation";
import { taskPagePath } from "@/core/scheduled-tasks/events";
import {
  browserTimeZone,
  displayTimeZone,
  formatWithViewerTime,
} from "@/core/scheduled-tasks/format";
import type { ScheduledOrigin } from "@/core/scheduled-tasks/types";
const props = defineProps<{ origin: ScheduledOrigin }>();
const { $i18n } = useNuxtApp();
const st = computed(() => $i18n.t.value.scheduledTasks);
const rt = computed(() => st.value.runThread);
const open = ref(false);
const when = computed(() =>
  props.origin.scheduled_for
    ? formatWithViewerTime(
        props.origin.scheduled_for,
        props.origin.schedule_type
          ? displayTimeZone({
              schedule_type: props.origin.schedule_type,
              timezone: props.origin.timezone,
            })
          : !props.origin.timezone || props.origin.timezone === "UTC"
            ? browserTimeZone()
            : props.origin.timezone,
        { locale: $i18n.locale.value, labels: st.value.time },
      )
    : "",
);
const notes = computed(() =>
  props.origin.standing_notes.filter((note) => note.trim()),
);
</script>
<template>
  <div
    class="flex w-full flex-col gap-2"
    data-testid="scheduled-run-prompt"
    :data-task-id="origin.task_id"
  >
    <div
      class="bg-card flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-sm"
    >
      <CalendarClock class="size-4 shrink-0" aria-hidden="true" /><span
        class="font-medium"
        >{{ origin.trigger === "manual" ? rt.trialRun : rt.scheduledRun }}</span
      ><span class="min-w-0 break-words"
        >{{ origin.task_title
        }}<template v-if="origin.run_number != null"
          ><span aria-hidden="true"> · </span
          >{{ fill(rt.runNumber, { n: origin.run_number }) }}</template
        ></span
      ><span v-if="when" class="text-muted-foreground">{{ when }}</span
      ><NuxtLink
        :to="taskPagePath(origin.task_id)"
        class="ml-auto inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >{{ rt.openTask }}<ArrowUpRight class="size-3.5" aria-hidden="true"
      /></NuxtLink>
    </div>
    <Collapsible v-model:open="open"
      ><CollapsibleTrigger
        class="text-muted-foreground hover:text-foreground flex items-center gap-1 border-l-2 pl-3 text-left text-sm"
        ><ChevronRight
          class="size-4 shrink-0 transition-transform"
          :class="open && 'rotate-90'"
          aria-hidden="true"
        />{{ rt.instructions }}</CollapsibleTrigger
      ><CollapsibleContent
        class="text-muted-foreground mt-2 space-y-2 border-l-2 pl-8 text-sm"
        ><p
          class="break-words whitespace-pre-wrap"
          data-testid="scheduled-run-instructions"
        >
          {{ origin.instructions }}
        </p>
        <p v-if="origin.stop_condition?.trim()" class="break-words">
          {{ fill(rt.stopsWhen, { condition: origin.stop_condition }) }}
        </p>
        <div v-if="notes.length">
          <p>{{ rt.notes }}</p>
          <ul class="list-disc pl-4">
            <li v-for="(note, index) in notes" :key="index" class="break-words">
              {{ note }}
            </li>
          </ul>
        </div></CollapsibleContent
      ></Collapsible
    >
  </div>
</template>
