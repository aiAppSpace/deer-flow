<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { capabilityCopy } from "@/core/capabilities/copy";
import { catalogText } from "./plugin-catalog";
import type { PluginGalleryEntry } from "./plugin-entries";
import PluginRow from "./PluginRow.vue";
import PluginIcon from "./PluginIcon.vue";
const props = defineProps<{ entry: PluginGalleryEntry; canManage: boolean }>();
const emit = defineEmits<{ details: [id: string] }>();
const { $i18n } = useNuxtApp();
const labels = computed(() => capabilityCopy($i18n.locale.value));
const projected = computed(
  () =>
    props.entry.installation?.adapter === "mcp" &&
    props.entry.installation.scope !== "user",
);
const name = computed(() =>
  projected.value
    ? props.entry.installation!.name
    : catalogText(props.entry.plugin!.name, $i18n.locale.value),
);
const description = computed(() =>
  projected.value
    ? props.entry.installation!.description
    : catalogText(props.entry.plugin!.description, $i18n.locale.value),
);
const status = computed(() => {
  const item = props.entry.installation;
  if (projected.value)
    return item!.selectable === false
      ? labels.value.unavailable
      : item!.enabled
        ? $i18n.t.value.capabilities.enabled
        : $i18n.t.value.capabilities.disabled;
  if (props.entry.unavailable) return labels.value.adapterError;
  if (item)
    return item.auth_status === "connected"
      ? labels.value.connected
      : item.auth_status === "required"
        ? labels.value.required
        : item.auth_status === "configured"
          ? labels.value.configured
          : labels.value.installed;
  return props.entry.plugin!.adapter === "guide"
    ? $i18n.t.value.capabilities.directory.candidate
    : props.entry.plugin!.adapter === "lark"
      ? $i18n.t.value.capabilities.notInstalled
      : labels.value.notConfigured;
});
const action = computed(() =>
  props.entry.installed
    ? $i18n.t.value.capabilities.manage
    : props.entry.plugin!.adapter === "guide" || !props.canManage
      ? $i18n.t.value.capabilities.directory.view
      : props.entry.plugin!.adapter === "lark"
        ? $i18n.t.value.common.install
        : $i18n.t.value.capabilities.configure,
);
</script>
<template>
  <PluginRow
    :name="name"
    :description="description"
    :label="status"
    :details-label="
      projected ? undefined : `${$i18n.t.value.capabilities.details} ${name}`
    "
    @details="entry.plugin && emit('details', entry.plugin.id)"
  >
    <template #icon
      ><PluginIcon
        :name="projected ? entry.installation!.name : entry.plugin!.id"
        :icon="projected ? entry.installation!.icon : undefined"
        :asset="entry.plugin?.icon"
        :capability-id="entry.plugin?.id"
    /></template>
    <span v-if="projected" class="text-muted-foreground text-xs">{{
      entry.installation!.auth_status === "required"
        ? labels.required
        : entry.installation!.auth_status === "configured"
          ? labels.configured
          : labels.unknown
    }}</span>
    <Button
      v-else
      size="sm"
      variant="outline"
      class="h-8 text-xs"
      :aria-label="`${entry.plugin!.adapter === 'guide' ? $i18n.t.value.capabilities.directory.guide : $i18n.t.value.capabilities.configure} ${name}`"
      @click="emit('details', entry.plugin!.id)"
      >{{ action }}</Button
    >
  </PluginRow>
</template>
