<script setup lang="ts">
import { computed, ref } from "vue";
import { Pencil, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useScopedMCPConfig,
  type MCPServerMutationVariables,
} from "@/composables/useScopedMCPConfig";
import { capabilityCopy } from "@/core/capabilities/copy";
import { MCPConfigRequestError, type MCPScope } from "@/core/mcp/api";
import type { MCPServerConfig } from "@/core/mcp/types";
import { readPluginIcon, withPluginIcon } from "@/core/mcp/icon";
import {
  formatMCPServerDefinition,
  MCPServerDefinitionError,
  parseMCPServerDefinition,
} from "@/core/mcp/parse";
import {
  catalogForServer,
  type CatalogPlugin,
  type PluginCategory,
} from "./plugin-catalog";
import PluginDirectory, { type DirectoryEntry } from "./PluginDirectory.vue";
import PluginRow from "./PluginRow.vue";
import PluginIcon from "./PluginIcon.vue";
import PluginIconPicker from "./PluginIconPicker.vue";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";
const props = withDefaults(
  defineProps<{
    scope?: MCPScope;
    query?: string;
    category?: PluginCategory | "all";
    installedOnly?: boolean;
    catalog?: DirectoryEntry[];
    definitions?: CatalogPlugin[];
    readOnly?: boolean;
  }>(),
  {
    scope: "user",
    query: "",
    category: "all",
    installedOnly: false,
    catalog: () => [],
    definitions: () => [],
    readOnly: false,
  },
);
const captureOwner = useWorkspaceAsyncOwner();
const { $i18n } = useNuxtApp();
const t = computed(() => $i18n.t.value);
const labels = computed(() => capabilityCopy($i18n.locale.value));
const scopeLabel = computed(() =>
  props.scope === "deployment"
    ? labels.value.platformTitle
    : labels.value.personalTitle,
);
const { query: mcp, mutation } = useScopedMCPConfig(() => props.scope);
const editor = ref<{ mode: "add" } | { mode: "edit"; name: string } | null>(
  null,
);
const definition = ref("");
const draftIcon = ref<string | null | undefined>();
const iconBusy = ref(false);
const definitionError = ref("");
const actionError = ref("");
const pendingRemoval = ref<string | null>(null);
const current = computed(() =>
  mcp.isError.value ? {} : (mcp.data.value?.mcp_servers ?? {}),
);
const entries = computed(() => Object.entries(current.value));
const previewEntries = computed(() => {
  try {
    return Object.entries(parseMCPServerDefinition(definition.value));
  } catch {
    return [];
  }
});
const previewName = computed(() =>
  editor.value?.mode === "edit"
    ? editor.value.name
    : (previewEntries.value[0]?.[0] ?? ""),
);
const previewMetadata = computed(() =>
  catalogForServer(previewEntries.value[0]?.[1], props.definitions),
);
const previewIcon = computed(() =>
  draftIcon.value === undefined && previewEntries.value[0]
    ? readPluginIcon(previewEntries.value[0][1])
    : draftIcon.value,
);
const directoryEntries = computed(() => [
  ...props.catalog.filter(
    (item) =>
      !entries.value.some(
        ([, server]) =>
          catalogForServer(server, props.definitions)?.id === item.id,
      ),
  ),
  ...entries.value.map(([name, server]) => {
    const metadata = catalogForServer(server, props.definitions);
    return {
      id: `mcp:${name}`,
      category: metadata?.category ?? "custom",
      installed: true,
      search: `${name} ${server.description ?? ""} ${metadata?.aliases.join(" ") ?? ""} ${Object.values(metadata?.name ?? {}).join(" ")} ${Object.values(metadata?.description ?? {}).join(" ")}`,
    };
  }),
]);
function nameOf(name: string | null) {
  return name ? name : t.value.settings.tools.unnamedServer;
}
function closeEditor() {
  if (mutation.isPending.value) return;
  draftIcon.value = undefined;
  iconBusy.value = false;
  editor.value = null;
  definition.value = "";
  definitionError.value = "";
}
function openAdd() {
  draftIcon.value = undefined;
  iconBusy.value = false;
  definition.value = "";
  definitionError.value = "";
  editor.value = { mode: "add" };
}
function openEdit(name: string, server: MCPServerConfig) {
  draftIcon.value = readPluginIcon(server) ?? null;
  iconBusy.value = false;
  definition.value = formatMCPServerDefinition(
    name,
    withPluginIcon(server, null),
  );
  definitionError.value = "";
  editor.value = { mode: "edit", name };
}
async function mutate(input: MCPServerMutationVariables, done?: () => void) {
  const isCurrent = captureOwner();
  try {
    await mutation.mutateAsync(input);
    if (!isCurrent()) return;
    done?.();
  } catch (cause) {
    if (!isCurrent()) return;
    const error = cause instanceof Error ? cause.message : String(cause);
    if (editor.value) definitionError.value = error;
    else actionError.value = error;
  }
}
function save() {
  const target = editor.value;
  if (!target || iconBusy.value) return;
  let parsed: Record<string, MCPServerConfig>;
  try {
    parsed = parseMCPServerDefinition(definition.value);
  } catch (cause) {
    const tools = t.value.settings.tools;
    const messages = {
      emptyDefinition: tools.definitionEmpty,
      invalidJson: tools.definitionInvalidJson,
      rootNotObject: tools.definitionRootNotObject,
      emptyServerMap: tools.definitionNoServers,
      serverConfigNotObject: tools.definitionServerNotObject.replace(
        "{name}",
        cause instanceof MCPServerDefinitionError
          ? (cause.serverName ?? "")
          : "",
      ),
    };
    definitionError.value =
      cause instanceof MCPServerDefinitionError
        ? messages[cause.code]
        : tools.definitionInvalidJson;
    return;
  }
  if (draftIcon.value !== undefined) {
    const list = Object.entries(parsed);
    if (list.length !== 1) {
      definitionError.value =
        target.mode === "edit"
          ? t.value.settings.tools.editSingleServer
          : t.value.capabilities.icon.singleServer;
      return;
    }
    const [name, server] = list[0]!;
    parsed = { [name]: withPluginIcon(server, draftIcon.value) };
  }
  if (target.mode === "add") {
    const duplicate = Object.keys(parsed).find((name) =>
      Object.hasOwn(current.value, name),
    );
    if (duplicate !== undefined) {
      definitionError.value =
        t.value.settings.tools.serverAlreadyExists.replace("{name}", duplicate);
      return;
    }
    void mutate({ operation: "create", servers: parsed }, () => {
      editor.value = null;
    });
  } else {
    const list = Object.entries(parsed);
    if (list.length !== 1) {
      definitionError.value = t.value.settings.tools.editSingleServer;
      return;
    }
    const [name, server] = list[0]!;
    if (name !== target.name) {
      definitionError.value =
        t.value.settings.tools.editServerNameMismatch.replace(
          "{name}",
          target.name,
        );
      return;
    }
    void mutate({ operation: "update", serverName: name, server }, () => {
      editor.value = null;
    });
  }
}
function serverEntry(id: string) {
  return id.startsWith("mcp:") ? current.value[id.slice(4)] : undefined;
}
</script>
<template>
  <div class="flex w-full flex-col gap-4">
    <div class="flex min-h-9 flex-wrap items-center justify-between gap-3">
      <slot name="toolbar"><span /></slot>
      <p
        v-if="mcp.isLoading.value"
        role="status"
        class="text-muted-foreground text-sm"
      >
        {{ t.common.loading }}
      </p>
      <Button
        v-if="!mcp.isLoading.value && !mcp.error.value"
        size="sm"
        variant="outline"
        :disabled="readOnly || mutation.isPending.value"
        :aria-label="`${t.capabilities.addPlugin} (${scopeLabel})`"
        @click="openAdd"
        >{{ t.capabilities.addPlugin }}</Button
      >
    </div>
    <p
      v-if="mcp.error.value"
      role="alert"
      class="text-muted-foreground text-sm"
    >
      {{
        mcp.error.value instanceof MCPConfigRequestError &&
        mcp.error.value.isAdminRequired
          ? t.settings.tools.adminRequired
          : `${t.common.error} ${mcp.error.value.message}`
      }}
    </p>
    <p v-if="actionError" role="alert" class="text-destructive text-sm">
      {{ actionError }}
    </p>
    <PluginDirectory
      :entries="directoryEntries"
      :query="query"
      :category="category"
      :installed-only="installedOnly"
      ><template #default="{ entry }"
        ><PluginRow
          v-if="serverEntry(entry.id)"
          :name="nameOf(entry.id.slice(4))"
          :description="
            serverEntry(entry.id)!.description || t.capabilities.mcpDescription
          "
          :label="
            serverEntry(entry.id)!.enabled
              ? t.capabilities.enabled
              : t.capabilities.disabled
          "
          :details-label="`${t.capabilities.details} ${nameOf(entry.id.slice(4))} (${scopeLabel})`"
          @details="
            !readOnly &&
            !mutation.isPending.value &&
            openEdit(entry.id.slice(4), serverEntry(entry.id)!)
          "
          ><template #icon
            ><PluginIcon
              :name="entry.id.slice(4)"
              :icon="readPluginIcon(serverEntry(entry.id)!)"
              :asset="
                catalogForServer(serverEntry(entry.id), definitions)?.icon
              "
              :capability-id="
                catalogForServer(serverEntry(entry.id), definitions)?.id
              " /></template
          ><Switch
            :model-value="serverEntry(entry.id)!.enabled"
            :aria-label="`${t.capabilities.enabled} ${nameOf(entry.id.slice(4))} (${scopeLabel})`"
            :disabled="readOnly || mutation.isPending.value"
            @update:model-value="
              mutate({
                operation: 'toggle',
                serverName: entry.id.slice(4),
                enabled: $event,
              })
            " /><Button
            size="icon"
            variant="ghost"
            :aria-label="`${t.common.edit} ${nameOf(entry.id.slice(4))} (${scopeLabel})`"
            :disabled="readOnly || mutation.isPending.value"
            @click="openEdit(entry.id.slice(4), serverEntry(entry.id)!)"
            ><Pencil class="size-4" /></Button
          ><Button
            size="icon"
            variant="ghost"
            :aria-label="`${t.common.delete} ${nameOf(entry.id.slice(4))} (${scopeLabel})`"
            :disabled="readOnly || mutation.isPending.value"
            @click="pendingRemoval = entry.id.slice(4)"
            ><Trash2 class="size-4" /></Button></PluginRow
        ><slot v-else :entry="entry" /></template
    ></PluginDirectory>
    <Dialog :open="editor !== null" @update:open="!$event && closeEditor()"
      ><DialogContent
        :close-label="t.primitives.close"
        class="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl"
        ><DialogHeader class="shrink-0 pr-6 break-words"
          ><DialogTitle>{{
            editor?.mode === "edit"
              ? t.settings.tools.editServer
              : t.settings.tools.addServer
          }}</DialogTitle></DialogHeader
        >
        <div
          class="-m-1 flex min-h-0 flex-none flex-col gap-4 overflow-visible p-1"
        >
          <DialogDescription
            class="shrink-0 text-center break-words sm:text-left"
            >{{
              editor?.mode === "edit"
                ? t.settings.tools.editServerDescription.replace(
                    "{name}",
                    editor.name,
                  )
                : t.settings.tools.addServerDescription
            }}</DialogDescription
          ><PluginIconPicker
            v-if="editor"
            :key="`${editor.mode}:${previewName}`"
            :name="previewName"
            :asset="previewMetadata?.icon"
            :capability-id="previewMetadata?.id"
            :model-value="previewIcon"
            :disabled="mutation.isPending.value || previewEntries.length > 1"
            @update:model-value="draftIcon = $event"
            @busy="iconBusy = $event"
          />
          <p
            v-if="previewEntries.length > 1"
            class="text-muted-foreground text-xs"
          >
            {{ t.capabilities.icon.singleServer }}
          </p>
          <Textarea
            v-model="definition"
            class="field-sizing-fixed h-96 max-h-[calc(100dvh-4rem-2px)] min-h-0 resize-none overflow-auto font-mono text-xs sm:max-h-[calc(100dvh-5rem-2px)]"
            :aria-label="t.settings.tools.serverDefinitionLabel"
            :spellcheck="false"
            :placeholder="t.settings.tools.addServerPlaceholder"
          />
          <div
            v-if="definitionError"
            class="text-destructive shrink-0 text-sm break-words"
            role="alert"
          >
            {{ definitionError }}
          </div>
        </div>
        <DialogFooter class="shrink-0"
          ><Button
            variant="outline"
            :disabled="mutation.isPending.value"
            @click="closeEditor"
            >{{ t.common.cancel }}</Button
          ><Button
            :disabled="mutation.isPending.value || iconBusy"
            @click="save"
            >{{
              mutation.isPending.value ? t.common.loading : t.common.save
            }}</Button
          ></DialogFooter
        ></DialogContent
      ></Dialog
    >
    <Dialog
      :open="pendingRemoval !== null"
      @update:open="!$event && (pendingRemoval = null)"
      ><DialogContent :close-label="t.primitives.close"
        ><DialogHeader
          ><DialogTitle>{{ t.settings.tools.removeServer }}</DialogTitle
          ><DialogDescription>{{
            t.settings.tools.removeServerDescription.replace(
              "{name}",
              nameOf(pendingRemoval),
            )
          }}</DialogDescription></DialogHeader
        ><DialogFooter
          ><Button
            variant="outline"
            :disabled="mutation.isPending.value"
            @click="pendingRemoval = null"
            >{{ t.common.cancel }}</Button
          ><Button
            variant="destructive"
            :disabled="mutation.isPending.value"
            @click="
              pendingRemoval !== null &&
              mutate(
                { operation: 'delete', serverName: pendingRemoval },
                () => (pendingRemoval = null),
              )
            "
            >{{
              mutation.isPending.value ? t.common.loading : t.common.delete
            }}</Button
          ></DialogFooter
        ></DialogContent
      ></Dialog
    >
  </div>
</template>
