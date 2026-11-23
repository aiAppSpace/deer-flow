<script setup lang="ts">
import { computed } from "vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer.vue";
import TrashView from "@/components/workspace/trash/TrashView.vue";
definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
useHead({
  title: computed(
    () => `${$i18n.t.value.trash.title} - ${$i18n.t.value.pages.appName}`,
  ),
});
</script>
<template>
  <WorkspaceContainer
    ><ScrollArea class="size-full"><TrashView /></ScrollArea
  ></WorkspaceContainer>
</template>
