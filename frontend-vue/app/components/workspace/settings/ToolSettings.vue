<script setup lang="ts">
/*
  【文件职责】     按 session role 读取、增删改 admin-only MCP server config。
  【架构位置】     L3 product UI
  【主要导出】     默认 ToolSettings 组件
  【依赖关系】     useSettingsPermissions · useMCPConfig · core/mcp/parse · ui/switch · ui/dialog
  【边界与注意】   已知普通用户不发 GET/PATCH；真实 403 单独显示 admin-required，其他错误保留 detail。

                   **增和改都是「粘一段 JSON」而不是一堆字段输入框**：MCP server 在
                   自己的 README 里给的就是那段 JSON，让用户照抄比让他把它拆成
                   command/args/env 再填一遍可靠得多，而且这一屏不认识的字段
                   （task_toolsets、routing…）也能原样带过去。

                   改**不能改名字**：名字是这条配置的主键。所以编辑时先校验解析出来的
                   名字没变，并明确告诉用户改名要走「加一条新的、删掉这条」。

                   删除要先确认，且提示里带上名字——一屏里可能有十个 server。
*/

import { computed, ref } from "vue";

import { Pencil, Trash2 } from "lucide-vue-next";

import SettingsActionDialog from "./SettingsActionDialog.vue";
import SettingsSection from "./SettingsSection.vue";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useMCPConfig,
  useMCPServerMutations,
} from "@/composables/useMCPConfig";
import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { MCPConfigRequestError } from "@/core/mcp/api";
import {
  formatMCPServerDefinition,
  MCPServerDefinitionError,
  parseMCPServerDefinition,
  type MCPServerDefinitionErrorCode,
} from "@/core/mcp/parse";
import type { MCPServerConfig } from "@/core/mcp/types";

const { $i18n } = useNuxtApp();
const t = computed(() => $i18n.t.value);
const access = useSettingsPermissions();
const mcp = useMCPConfig({ enabled: access.canReadMcp });
const actionError = ref("");
const pendingName = ref<string | null>(null);
const actualAdminRequired = computed(
  () =>
    (mcp.error.value instanceof MCPConfigRequestError &&
      mcp.error.value.isAdminRequired) ||
    (mcp.mutationError.value instanceof MCPConfigRequestError &&
      mcp.mutationError.value.isAdminRequired),
);

function errorMessage(cause: unknown) {
  if (cause instanceof MCPConfigRequestError && cause.isAdminRequired) {
    return t.value.settings.tools.adminRequired;
  }
  return cause instanceof Error && cause.message
    ? cause.message
    : t.value.settings.tools.description;
}

const servers = useMCPServerMutations();

/** `null` 关闭；`{mode:"add"}` 新建；`{mode:"edit",name}` 改那一条。 */
const editor = ref<{ mode: "add" } | { mode: "edit"; name: string } | null>(
  null,
);
const definition = ref("");
const definitionError = ref("");
const pendingRemoval = ref<string | null>(null);

/** 空名字在配置里是合法的，但界面上要说人话。 */
function displayServerName(name: string | null): string {
  return name === null || name.length === 0
    ? t.value.settings.tools.unnamedServer
    : name;
}

function closeEditor() {
  editor.value = null;
  definition.value = "";
  definitionError.value = "";
}

function openAddEditor() {
  definition.value = "";
  definitionError.value = "";
  editor.value = { mode: "add" };
}

function openEditEditor(name: string, config: MCPServerConfig) {
  // 预填的就是这条配置本身，用户改哪一行都行。
  definition.value = formatMCPServerDefinition(name, config);
  definitionError.value = "";
  editor.value = { mode: "edit", name };
}

/**
 * 五种解析失败各说各的话。
 *
 * 写成 `Record<Code, …>` 而不是 switch：**少一种会被 tsc 挡住**，
 * 而 switch 漏一支只是悄悄落到 undefined。错误码是解析器给的封闭集合，
 * 这里正好用得上这层保障。
 */
function definitionErrorMessage(cause: MCPServerDefinitionError): string {
  const labels = t.value.settings.tools;
  const messages: Record<MCPServerDefinitionErrorCode, string> = {
    emptyDefinition: labels.definitionEmpty,
    invalidJson: labels.definitionInvalidJson,
    rootNotObject: labels.definitionRootNotObject,
    emptyServerMap: labels.definitionNoServers,
    serverConfigNotObject: labels.definitionServerNotObject.replace(
      "{name}",
      cause.serverName ?? "",
    ),
  };
  return messages[cause.code];
}

async function saveDefinition() {
  const target = editor.value;
  if (!target) return;

  let parsed: Record<string, MCPServerConfig>;
  try {
    parsed = parseMCPServerDefinition(definition.value);
  } catch (cause) {
    definitionError.value =
      cause instanceof MCPServerDefinitionError
        ? definitionErrorMessage(cause)
        : t.value.settings.tools.definitionInvalidJson;
    return;
  }

  const current = mcp.config.value?.mcp_servers ?? {};
  if (target.mode === "add") {
    // 重名要在这里拦住：后端会覆盖，而用户以为自己在「加一条」。
    const duplicate = Object.keys(parsed).find((name) =>
      Object.hasOwn(current, name),
    );
    if (duplicate !== undefined) {
      definitionError.value =
        t.value.settings.tools.serverAlreadyExists.replace("{name}", duplicate);
      return;
    }
    definitionError.value = "";
    await runServerMutation({ operation: "create", servers: parsed });
    return;
  }

  const entries = Object.entries(parsed);
  if (entries.length !== 1) {
    definitionError.value = t.value.settings.tools.editSingleServer;
    return;
  }
  const [editedName, editedConfig] = entries[0]!;
  if (editedName !== target.name) {
    definitionError.value =
      t.value.settings.tools.editServerNameMismatch.replace(
        "{name}",
        target.name,
      );
    return;
  }
  definitionError.value = "";
  await runServerMutation({
    operation: "update",
    serverName: target.name,
    server: editedConfig,
  });
}

async function runServerMutation(
  input: Parameters<typeof servers.mutateAsync>[0],
) {
  actionError.value = "";
  try {
    await servers.mutateAsync(input);
    closeEditor();
    pendingRemoval.value = null;
  } catch (cause) {
    // 失败时对话框不关：用户改了半天的 JSON 不能就这么没了。
    const message = errorMessage(cause);
    if (editor.value) definitionError.value = message;
    else actionError.value = message;
  }
}

async function toggle(name: string, enabled: boolean) {
  // 受控开关：视觉状态只跟随服务端真相，请求失败时不会停在一个假的 on。
  if (!access.canManageMcp.value || mcp.pending.value) return;
  actionError.value = "";
  pendingName.value = name;
  try {
    await mcp.toggle(name, enabled);
  } catch (cause) {
    actionError.value = errorMessage(cause);
  } finally {
    pendingName.value = null;
  }
}
</script>

<template>
  <SettingsSection
    data-testid="tool-settings"
    :title="t.settings.tools.title"
    :description="t.settings.tools.description"
  >
    <div class="space-y-4">
      <p
        v-if="access.permissions.value.state === 'loading'"
        class="text-muted-foreground text-sm"
      >
        {{ t.common.loading }}
      </p>
      <p
        v-else-if="access.permissions.value.state === 'unavailable'"
        role="alert"
        class="rounded-md bg-red-50 p-3 text-sm text-red-700"
        data-testid="settings-session-unavailable"
      >
        {{ t.settings.sessionUnavailable }}
      </p>
      <p
        v-else-if="
          access.permissions.value.adminRequired || actualAdminRequired
        "
        class="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
        data-testid="mcp-admin-required"
      >
        {{ t.settings.tools.adminRequired }}
      </p>
      <template v-else>
        <p v-if="mcp.loading.value" class="text-muted-foreground text-sm">
          {{ t.common.loading }}
        </p>
        <p
          v-else-if="mcp.error.value"
          role="alert"
          class="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {{ errorMessage(mcp.error.value) }}
        </p>
        <p
          v-if="actionError"
          role="alert"
          class="rounded-md bg-red-50 p-3 text-sm text-red-700"
          data-testid="mcp-action-error"
        >
          {{ actionError }}
        </p>
        <div class="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            data-testid="mcp-add-server"
            :disabled="!access.canManageMcp.value || servers.isPending.value"
            @click="openAddEditor"
          >
            {{ t.settings.tools.addServer }}
          </Button>
        </div>
        <!--
          空态是一段裸文本，不是一张带边框的卡片（上游 tool-settings-page.tsx:53
          是 `<div className="text-muted-foreground text-sm">`）。`<p>` 在可访问性
          树里会多出一个 paragraph 节点，而上游那一句直接挂在 main 的文本里。
        -->
        <div
          v-if="
            !mcp.loading.value &&
            !mcp.error.value &&
            Object.keys(mcp.config.value?.mcp_servers ?? {}).length === 0
          "
          class="text-muted-foreground text-sm"
        >
          {{ t.settings.tools.empty }}
        </div>
        <div
          v-for="(server, name) in mcp.config.value?.mcp_servers ?? {}"
          :key="name"
          class="border-border flex items-center justify-between border-b py-3"
          :data-testid="`mcp-${String(name)}`"
        >
          <div class="min-w-0">
            <div class="font-medium">{{ displayServerName(String(name)) }}</div>
            <div class="text-muted-foreground text-xs">
              {{ server.description }}
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <Switch
              :aria-label="String(name)"
              :model-value="server.enabled"
              :disabled="!access.canManageMcp.value || mcp.pending.value"
              :data-pending="pendingName === name || undefined"
              @update:model-value="toggle(String(name), $event)"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="`${t.common.edit} ${displayServerName(String(name))}`"
              :disabled="!access.canManageMcp.value || servers.isPending.value"
              @click="openEditEditor(String(name), server)"
            >
              <Pencil class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="`${t.common.delete} ${displayServerName(String(name))}`"
              :disabled="!access.canManageMcp.value || servers.isPending.value"
              @click="pendingRemoval = String(name)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </template>
    </div>

    <!--
      加和改用**同一个对话框**：两者都是「粘一段 JSON」，只是标题、说明和校验规则
      不同。拆成两个组件会让那套校验分叉。
    -->
    <SettingsActionDialog
      :open="editor !== null"
      :title="
        editor?.mode === 'edit'
          ? t.settings.tools.editServer
          : t.settings.tools.addServer
      "
      :description="
        editor?.mode === 'edit'
          ? t.settings.tools.editServerDescription.replace(
              '{name}',
              editor.name,
            )
          : t.settings.tools.addServerDescription
      "
      :confirm-label="t.common.save"
      :cancel-label="t.common.cancel"
      :pending="servers.isPending.value"
      data-testid="mcp-server-editor"
      @cancel="closeEditor"
      @confirm="saveDefinition"
    >
      <Textarea
        v-model="definition"
        class="min-h-52 font-mono text-xs"
        :aria-label="t.settings.tools.serverDefinitionLabel"
        spellcheck="false"
        :placeholder="t.settings.tools.addServerPlaceholder"
      />
      <p
        v-if="definitionError"
        role="alert"
        class="text-destructive text-sm"
        data-testid="mcp-definition-error"
      >
        {{ definitionError }}
      </p>
    </SettingsActionDialog>

    <SettingsActionDialog
      :open="pendingRemoval !== null"
      :title="t.settings.tools.removeServer"
      :description="
        t.settings.tools.removeServerDescription.replace(
          '{name}',
          displayServerName(pendingRemoval),
        )
      "
      :confirm-label="t.common.delete"
      :cancel-label="t.common.cancel"
      :pending="servers.isPending.value"
      destructive
      data-testid="mcp-remove-dialog"
      @cancel="pendingRemoval = null"
      @confirm="
        pendingRemoval !== null &&
        runServerMutation({ operation: 'delete', serverName: pendingRemoval })
      "
    />
  </SettingsSection>
</template>
