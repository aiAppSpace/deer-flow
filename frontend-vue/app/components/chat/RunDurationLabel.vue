<script setup lang="ts">
import { computed } from "vue";
import { formatRunDuration } from "@/core/messages/run-duration";
const props = defineProps<{ durationSeconds: number }>();
const { $i18n } = useNuxtApp();
const formatted = computed(() =>
  formatRunDuration(props.durationSeconds, $i18n.t.value.runDuration),
);
</script>
<template>
  <span
    v-if="formatted"
    data-testid="run-duration"
    :title="$i18n.t.value.runDuration.description"
    >{{ $i18n.t.value.runDuration.completedIn(formatted) }}</span
  >
</template>
