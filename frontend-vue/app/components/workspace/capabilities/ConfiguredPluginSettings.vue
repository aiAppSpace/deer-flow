<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capabilityCopy } from "@/core/capabilities/copy";
import type { PluginManifest } from "@/core/capabilities/types";
import { useInstallCapability } from "@/composables/useCapabilities";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
const props = defineProps<{ plugin: PluginManifest; canManage: boolean }>();
const emit = defineEmits<{ saved: [] }>();
const { $i18n } = useNuxtApp();
const copy = computed(() => capabilityCopy($i18n.locale.value));
const install = useInstallCapability();
const toast = useWorkspaceToast();
const captureOwner = useWorkspaceAsyncOwner();
const fields = ref<Record<string, string>>({ name: props.plugin.id });
const error = ref("");
function fieldLabel(key: string, title?: string) {
  return (copy.value as Record<string, string>)[key] ?? title ?? key;
}
async function save() {
  if (!props.canManage || install.isPending.value) return;
  const isCurrent = captureOwner();
  try {
    let configuration: Record<string, unknown>;
    if (props.plugin.adapter === "business")
      configuration = Object.fromEntries(
        Object.entries(fields.value).filter(([key]) => key !== "name"),
      );
    else {
      const url = new URL(fields.value.url ?? "");
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error(copy.value.invalidUrl);
      configuration = {
        enabled: true,
        type: "http",
        url: url.toString(),
        description:
          props.plugin.description[$i18n.locale.value] ??
          props.plugin.description["en-US"],
        ...(fields.value.authorization
          ? { headers: { Authorization: fields.value.authorization } }
          : {}),
      };
    }
    await install.mutateAsync({
      plugin_id: props.plugin.id,
      name: fields.value.name?.trim() ?? "",
      configuration,
    });
    if (!isCurrent()) return;
    toast.success(copy.value.saved);
    emit("saved");
  } catch (cause) {
    if (!isCurrent()) return;
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}
</script>
<template>
  <form class="space-y-4 wrap-anywhere" @submit.prevent="save">
    <p class="text-muted-foreground text-sm leading-6">
      {{ plugin.setup[$i18n.locale.value] ?? plugin.setup["en-US"] }}
    </p>
    <div
      v-for="(schema, key) in plugin.config_schema.properties ?? {}"
      :key="key"
      class="space-y-1.5"
    >
      <label :for="`plugin-field-${key}`" class="text-sm font-medium">{{
        fieldLabel(String(key), schema.title)
      }}</label
      ><Input
        :id="`plugin-field-${key}`"
        v-model="fields[key]"
        :type="schema.format === 'password' ? 'password' : 'text'"
        autocomplete="off"
        :required="plugin.config_schema.required?.includes(String(key))"
        :disabled="!canManage || install.isPending.value"
      />
    </div>
    <p class="text-muted-foreground text-xs leading-5">
      {{ copy.accountHint }}
    </p>
    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>
    <Button
      class="h-auto min-h-9 max-w-full wrap-anywhere whitespace-normal"
      type="submit"
      :disabled="!canManage || install.isPending.value"
      >{{ copy.save }}</Button
    >
  </form>
</template>
