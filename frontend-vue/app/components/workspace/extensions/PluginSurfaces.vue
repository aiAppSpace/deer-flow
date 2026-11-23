<script setup lang="ts">
import { computed } from "vue";
import type { SurfaceSlot } from "@/core/extensions/contracts";
import { activeFrontendExtensions } from "@/core/extensions/registry";
import { useFrontendExtensions } from "@/composables/useFrontendExtensions";
import { useCapabilityUser } from "@/composables/useCapabilities";
import PluginSurface from "./PluginSurface.vue";

const props = defineProps<{
  surfaceSlot: SurfaceSlot;
  namespace?: string;
  surfaceId?: string;
  threadId?: string;
}>();
const query = useFrontendExtensions();
const user = useCapabilityUser();
const surfaces = computed(() =>
  activeFrontendExtensions(query.isError.value ? [] : (query.data.value ?? []))
    .filter(
      ({ contribution }) =>
        contribution.viewer_id === user.value?.id &&
        (!props.namespace || contribution.namespace === props.namespace),
    )
    .flatMap(({ contribution: entry, extension }) =>
      (extension.surfaces ?? [])
        .filter(
          (surface) =>
            surface.slot === props.surfaceSlot &&
            (!props.surfaceId || surface.id === props.surfaceId),
        )
        .map((surface) => ({
          entry,
          surface,
          key: `${user.value?.id}:${props.threadId}:${entry.namespace}:${surface.id}`,
        })),
    ),
);
</script>

<template>
  <PluginSurface
    v-for="item in surfaces"
    :key="item.key"
    :entry="item.entry"
    :surface="item.surface"
    :thread-id="threadId"
  />
</template>
