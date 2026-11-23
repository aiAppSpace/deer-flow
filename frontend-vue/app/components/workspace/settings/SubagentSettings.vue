<script setup lang="ts">
import { computed, ref } from "vue";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import SettingsSection from "./SettingsSection.vue";
import SubagentEditorDialog from "./subagents/SubagentEditorDialog.vue";
import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { useSubagentMutations, useSubagents } from "@/composables/useSubagents";
import type { Subagent } from "@/core/subagents";
import { isRequestAborted } from "@/core/api/cancellation";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const { $i18n } = useNuxtApp();
const labels = computed(() => $i18n.t.value.settings.subagents);
const toast = useWorkspaceToast();
const access = useSettingsPermissions();
const { subagents, isLoading, error } = useSubagents();
const { update, remove } = useSubagentMutations();

const editing = ref<Subagent | "new" | null>(null);

function overrideSummary(subagent: Subagent): string {
  return Object.entries(subagent.config_overrides)
    .map(([field, value]) => `${field}=${formatOverrideValue(value)}`)
    .join("; ");
}

function formatOverrideValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function sourceLabel(subagent: Subagent): string {
  if (subagent.source === "builtin") return labels.value.sourceBuiltin;
  if (subagent.source === "config") return labels.value.sourceConfig;
  return labels.value.sourceManaged;
}

async function setEnabled(subagent: Subagent, enabled: boolean) {
  if (
    !access.canManageMcp.value ||
    !subagent.editable ||
    subagent.conflict ||
    update.isPending.value
  )
    return;
  try {
    await update.mutateAsync({ name: subagent.name, request: { enabled } });
    toast.success(labels.value.saved);
  } catch (cause) {
    if (isRequestAborted(cause)) return;
    toast.error(cause instanceof Error ? cause.message : String(cause));
  }
}

async function deleteSubagent(subagent: Subagent) {
  if (
    !access.canManageMcp.value ||
    !subagent.editable ||
    remove.isPending.value
  )
    return;
  if (!window.confirm(labels.value.deleteConfirm)) return;
  try {
    await remove.mutateAsync(subagent.name);
    toast.success(labels.value.deleted);
  } catch (cause) {
    if (isRequestAborted(cause)) return;
    toast.error(cause instanceof Error ? cause.message : String(cause));
  }
}
</script>

<template>
  <SettingsSection
    data-testid="subagent-settings"
    :title="labels.title"
    :description="labels.description"
  >
    <div class="space-y-4">
      <p class="text-muted-foreground text-sm">{{ labels.executionNote }}</p>
      <div class="flex items-center justify-between gap-4">
        <p
          v-if="!access.canManageMcp.value"
          class="text-muted-foreground text-sm"
        >
          {{ labels.adminNote }}
        </p>
        <Button
          v-else
          size="sm"
          class="ml-auto"
          data-testid="subagent-create"
          @click="editing = 'new'"
        >
          <Plus class="size-4" />
          {{ labels.create }}
        </Button>
      </div>

      <p v-if="isLoading" class="text-muted-foreground text-sm">
        {{ $i18n.t.value.common.loading }}
      </p>
      <p v-else-if="error" class="text-destructive text-sm">
        {{ error.message }}
      </p>
      <p
        v-else-if="subagents.length === 0"
        class="text-muted-foreground text-sm"
      >
        {{ labels.empty }}
      </p>
      <div v-else class="space-y-3">
        <Item
          v-for="subagent in subagents"
          :key="`${subagent.source}-${subagent.name}`"
          variant="outline"
          :data-testid="`subagent-${subagent.name}`"
        >
          <ItemContent class="min-w-0">
            <ItemTitle class="flex flex-wrap items-center gap-2">
              <span>{{ subagent.display_name ?? subagent.name }}</span>
              <Badge variant="outline">{{ sourceLabel(subagent) }}</Badge>
              <Badge v-if="subagent.conflict" variant="destructive">
                {{ labels.conflict }}
              </Badge>
            </ItemTitle>
            <ItemDescription>{{ subagent.description }}</ItemDescription>
            <p
              v-if="Object.keys(subagent.config_overrides).length > 0"
              class="text-muted-foreground text-xs"
            >
              {{ labels.overridden }}: {{ overrideSummary(subagent) }}
            </p>
          </ItemContent>
          <ItemActions
            v-if="access.canManageMcp.value && subagent.editable"
            class="gap-1"
          >
            <Switch
              :model-value="subagent.enabled"
              :disabled="update.isPending.value || subagent.conflict"
              :aria-label="subagent.display_name ?? subagent.name"
              @update:model-value="setEnabled(subagent, $event)"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="$i18n.t.value.common.edit"
              @click="editing = subagent"
            >
              <Pencil class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="$i18n.t.value.common.delete"
              @click="deleteSubagent(subagent)"
            >
              <Trash2 class="size-4" />
            </Button>
          </ItemActions>
        </Item>
      </div>
    </div>

    <SubagentEditorDialog :value="editing" @close="editing = null" />
  </SettingsSection>
</template>
