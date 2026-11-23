<script setup lang="ts">
import { computed } from "vue";
import PluginPage from "@/components/workspace/extensions/PluginPage.vue";

definePageMeta({ layout: "workspace" });
const route = useRoute();
const namespace = computed(() =>
  typeof route.params.namespace === "string" ? route.params.namespace : "",
);
const surfaceId = computed(() =>
  typeof route.params.surface_id === "string" ? route.params.surface_id : "",
);
</script>

<template>
  <PluginPage :namespace="namespace" :surface-id="surfaceId" />
</template>
