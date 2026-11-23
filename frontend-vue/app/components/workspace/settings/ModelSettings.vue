<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { Button } from "@/components/ui/button";
import SettingsSection from "./SettingsSection.vue";
import ManagedModelEditor from "./ManagedModelEditor.vue";
import { useCapabilityUser } from "@/composables/useCapabilities";
import { MODELS_QUERY_KEY } from "@/composables/useModels";
import {
  loadManagedModels,
  modelDraft,
  saveManagedModel,
  type ManagedModel,
} from "@/core/models/management";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.settings.models);
const client = useQueryClient(),
  toast = useWorkspaceToast(),
  user = useCapabilityUser();
const canManage = computed(() => user.value?.system_role === "admin");
const catalog = useQuery({
  queryKey: computed(() => ["managed-models", user.value?.id]),
  queryFn: ({ signal }) => loadManagedModels(signal),
  enabled: canManage,
});
const editing = ref<ManagedModel | "new" | null>(null),
  pending = ref(false);
let generation = 0;
onScopeDispose(() => {
  generation++;
});
watch(
  () => user.value?.id + ":" + user.value?.system_role,
  () => {
    generation++;
    editing.value = null;
    pending.value = false;
  },
  { flush: "sync" },
);
async function refresh() {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["managed-models"] }),
    client.invalidateQueries({ queryKey: MODELS_QUERY_KEY }),
  ]);
}
async function toggle(model: ManagedModel) {
  if (!canManage.value || pending.value || model.conflict) return;
  const current = generation;
  pending.value = true;
  try {
    await saveManagedModel({
      config: { ...modelDraft(model), enabled: !model.enabled },
      expected_revision: model.revision,
    });
    if (current === generation) await refresh();
  } catch (error) {
    if (current === generation)
      toast.error(error instanceof Error ? error.message : text.value.failed);
  } finally {
    if (current === generation) pending.value = false;
  }
}
</script>

<template>
  <SettingsSection :title="text.title" :description="text.description">
    <p v-if="!canManage">{{ text.adminOnly }}</p>
    <div v-else class="@container/model-controls space-y-4">
      <div class="flex max-w-full flex-wrap gap-2">
        <Button
          class="@max-md/model-controls:h-auto @max-md/model-controls:min-h-9 @max-md/model-controls:max-w-full @max-md/model-controls:whitespace-normal"
          :disabled="pending"
          @click="editing = 'new'"
          >{{ text.add }}</Button
        ><Button
          class="@max-md/model-controls:h-auto @max-md/model-controls:min-h-9 @max-md/model-controls:max-w-full @max-md/model-controls:whitespace-normal"
          variant="outline"
          :disabled="pending || catalog.isFetching.value"
          @click="catalog.refetch()"
          >{{ text.reload }}</Button
        >
      </div>
      <p v-if="catalog.isLoading.value" role="status">{{ text.loading }}</p>
      <div v-if="catalog.error.value" role="alert">
        <p>{{ text.failed }}</p>
      </div>
      <p v-if="catalog.data.value?.models.length === 0">{{ text.empty }}</p>
      <div
        v-for="model in catalog.data.value?.models ?? []"
        :key="`${model.source}:${model.name}`"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
      >
        <div class="max-w-full min-w-0 [overflow-wrap:anywhere]">
          <p class="font-medium">{{ model.display_name || model.name }}</p>
          <p class="text-muted-foreground text-sm">
            {{ model.model }} ·
            {{
              model.source === "config"
                ? text.yaml
                : model.enabled
                  ? text.enabled
                  : text.disabled
            }}
          </p>
          <p v-if="model.source === 'managed' && model.conflict" role="alert">
            {{ text.conflict }}
          </p>
        </div>
        <div
          v-if="model.source === 'managed'"
          class="flex max-w-full flex-wrap gap-2"
        >
          <Button
            class="@max-md/model-controls:h-auto @max-md/model-controls:min-h-9 @max-md/model-controls:max-w-full @max-md/model-controls:whitespace-normal"
            variant="outline"
            :disabled="pending || model.conflict"
            @click="editing = model"
            >{{ text.edit }}</Button
          ><Button
            class="@max-md/model-controls:h-auto @max-md/model-controls:min-h-9 @max-md/model-controls:max-w-full @max-md/model-controls:whitespace-normal"
            variant="outline"
            :disabled="pending || model.conflict"
            @click="toggle(model)"
            >{{ model.enabled ? text.disable : text.enable }}</Button
          >
        </div>
      </div>
      <ManagedModelEditor
        v-if="editing"
        :key="`${user?.id}:${editing === 'new' ? 'new' : editing.name}`"
        :model="editing === 'new' ? undefined : editing"
        :saved="refresh"
        @close="editing = null"
      />
    </div>
  </SettingsSection>
</template>
