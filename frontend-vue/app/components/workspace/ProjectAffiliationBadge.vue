<script setup lang="ts">
import { Folder } from "lucide-vue-next";

import { useProject } from "@/composables/useProjects";

const props = defineProps<{ projectId: string }>();
const project = useProject(() => props.projectId);
</script>

<template>
  <NuxtLink
    v-if="project.data.value"
    :to="`/workspace/projects/${encodeURIComponent(project.data.value.id)}`"
    class="text-muted-foreground hover:text-foreground inline-flex max-w-40 shrink-0 items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs font-normal transition-colors"
  >
    <Folder class="size-3 shrink-0" />
    <span class="truncate">{{ project.data.value.name }}</span>
  </NuxtLink>
</template>
