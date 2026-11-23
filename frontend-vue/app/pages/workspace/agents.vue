<script setup lang="ts">
/*
  The route subtree owns Agent capability admission. Pending/disabled branches
  do not mount NuxtPage, so direct directory, creation and chat navigation cannot
  run business setup, focus effects or requests before admission. The existing
  feature query retains its cold-start cache and failed-discovery policy.
*/
import AgentsFeatureDisabled from "@/components/workspace/agents/AgentsFeatureDisabled.vue";
import { useAgentsApiEnabled } from "@/composables/useWorkspaceFeatures";

definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
const { isLoading, enabled } = useAgentsApiEnabled();
</script>

<template>
  <div
    v-if="isLoading"
    class="text-muted-foreground flex size-full items-center justify-center text-sm"
  >
    {{ $i18n.t.value.common.loading }}
  </div>
  <AgentsFeatureDisabled v-else-if="!enabled" />
  <NuxtPage v-else />
</template>
