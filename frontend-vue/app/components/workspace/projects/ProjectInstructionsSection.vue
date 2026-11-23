<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProjectMutations } from "@/composables/useProjects";
import { useProjectsConfig } from "@/composables/useProjectDocuments";
import { PROJECTS_CONFIG_DEFAULT, type Project } from "@/core/projects";
import { isRequestAborted } from "@/core/api/cancellation";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{ project: Project }>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const { patch } = useProjectMutations();
const config = useProjectsConfig();
const instructions = ref(props.project.instructions);
let synced = props.project.instructions;
watch(
  () => props.project.instructions,
  (value) => {
    if (instructions.value === synced) instructions.value = value;
    synced = value;
  },
);
const bytes = computed(
  () => new TextEncoder().encode(instructions.value).length,
);
const limit = computed(
  () =>
    config.data.value?.instructions_max_bytes ??
    PROJECTS_CONFIG_DEFAULT.instructions_max_bytes,
);
const overLimit = computed(() => bytes.value > limit.value);
const dirty = computed(() => instructions.value !== props.project.instructions);
const canSave = computed(
  () => dirty.value && !overLimit.value && !patch.isPending.value,
);
async function save() {
  if (!canSave.value) return;
  const id = props.project.id;
  const snapshot = instructions.value;
  try {
    await patch.mutateAsync({ id, input: { instructions: snapshot } });
  } catch (error) {
    if (isRequestAborted(error)) return;
    toast.error(
      error instanceof Error
        ? error.message
        : $i18n.t.value.projects.instructionsSaveFailed,
    );
  }
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <div
      class="contents [@media(max-height:360px)]:grid [@media(max-height:360px)]:h-[calc(100cqh-var(--spacing)*14)] [@media(max-height:360px)]:grid-rows-[auto_minmax(0,1fr)] [@media(max-height:360px)]:gap-2"
    >
      <label
        for="project-instructions-input"
        class="text-muted-foreground text-xs"
        >{{ $i18n.t.value.projects.instructions }}</label
      >
      <Textarea
        id="project-instructions-input"
        v-model="instructions"
        class="min-h-40 [@media(max-height:360px)]:h-full [@media(max-height:360px)]:max-h-full [@media(max-height:360px)]:min-h-0"
        :placeholder="$i18n.t.value.projects.instructionsPlaceholder"
        :aria-invalid="overLimit"
      />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p
        class="text-muted-foreground text-xs"
        :class="{ 'text-destructive': overLimit }"
      >
        {{ $i18n.t.value.projects.instructionsByteCount(bytes, limit) }}
      </p>
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span
          v-if="patch.isSuccess.value && !dirty"
          role="status"
          class="text-muted-foreground text-xs"
          >{{ $i18n.t.value.projects.instructionsSaved }}</span
        >
        <Button variant="outline" :disabled="!canSave" @click="save">{{
          $i18n.t.value.common.save
        }}</Button>
      </div>
    </div>
    <p v-if="overLimit" role="alert" class="text-destructive text-xs">
      {{ $i18n.t.value.projects.instructionsTooLong(limit) }}
    </p>
  </section>
</template>
