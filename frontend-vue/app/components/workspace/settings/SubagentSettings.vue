<script setup lang="ts">
/*
  【文件职责】     subagent 目录：查看、管理员启停/编辑/删除、新建。
  【架构位置】     L3 product UI
  【主要导出】     默认 SubagentSettings 组件
  【依赖关系】     composables/useSubagents · useSettingsPermissions · SubagentEditorDialog
  【边界与注意】   - **非管理员也能看目录**，只是没有任何写入控件，并显式说一句为什么。
                   把整屏藏起来会让用户不知道系统里有哪些 subagent 可用。
                 - 只有 `editable` 的条目才给写入控件。`editable` 是后端算好的结论
                   （builtin/config 来自代码和配置文件），前端不自己从 `source` 推。
                 - **名字冲突时禁用启停**：同名的托管条目与配置条目撞了，这一条
                   压根没进运行时，切它的开关不会有任何效果，只会让人以为生效了。
                 - 删除走 `SettingsActionDialog` 而不是 `window.confirm`
                   （本仓 Settings 的既定约定，见该组件文件头）。上游用的是
                   `window.confirm`——那是一个不可样式化、读屏器行为随浏览器变的原生弹窗。
*/

import { computed, ref } from "vue";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import SettingsActionDialog from "./SettingsActionDialog.vue";
import SettingsSection from "./SettingsSection.vue";
import SubagentEditorDialog from "./subagents/SubagentEditorDialog.vue";
import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { useSubagentMutations, useSubagents } from "@/composables/useSubagents";
import type { Subagent } from "@/core/subagents";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const { $i18n } = useNuxtApp();
const labels = computed(() => $i18n.t.value.settings.subagents);
const toast = useWorkspaceToast();
const access = useSettingsPermissions();
const { subagents, isLoading, error } = useSubagents();
const { update, remove } = useSubagentMutations();

const editing = ref<Subagent | "new" | null>(null);
const pendingDelete = ref<Subagent | null>(null);

/** config.yaml 覆盖了哪些字段，摊成一行让人看得见。 */
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
  try {
    await update.mutateAsync({ name: subagent.name, request: { enabled } });
    toast.success(labels.value.saved);
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  }
}

async function confirmDelete() {
  const subagent = pendingDelete.value;
  if (!subagent) return;
  try {
    await remove.mutateAsync(subagent.name);
    toast.success(labels.value.deleted);
    pendingDelete.value = null;
  } catch (cause) {
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
      <!--
        这一段说的是 subagent 的**运行方式**：每次调用都是一段全新的临时上下文，
        没有持久对话和记忆，也问不了用户追问。不说清楚的话，用户会把它当成
        一个能记住上下文的助手来配。
      -->
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
        <div
          v-for="subagent in subagents"
          :key="`${subagent.source}-${subagent.name}`"
          class="border-border flex items-start gap-3 rounded-lg border p-4"
          :data-testid="`subagent-${subagent.name}`"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2 text-sm font-medium">
              <span>{{ subagent.display_name ?? subagent.name }}</span>
              <Badge variant="outline">{{ sourceLabel(subagent) }}</Badge>
              <Badge v-if="subagent.conflict" variant="destructive">
                {{ labels.conflict }}
              </Badge>
            </div>
            <p class="text-muted-foreground text-sm">
              {{ subagent.description }}
            </p>
            <p
              v-if="Object.keys(subagent.config_overrides).length > 0"
              class="text-muted-foreground text-xs"
            >
              {{ labels.overridden }}: {{ overrideSummary(subagent) }}
            </p>
          </div>
          <div
            v-if="access.canManageMcp.value && subagent.editable"
            class="flex shrink-0 items-center gap-1"
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
              @click="pendingDelete = subagent"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <SubagentEditorDialog :value="editing" @close="editing = null" />
    <SettingsActionDialog
      :open="pendingDelete !== null"
      :title="labels.deleteConfirm"
      :confirm-label="$i18n.t.value.common.delete"
      :cancel-label="$i18n.t.value.common.cancel"
      :pending="remove.isPending.value"
      destructive
      data-testid="subagent-delete-dialog"
      @cancel="pendingDelete = null"
      @confirm="confirmDelete"
    />
  </SettingsSection>
</template>
