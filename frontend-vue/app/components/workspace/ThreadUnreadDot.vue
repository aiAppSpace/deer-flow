<script setup lang="ts">
const { $i18n } = useNuxtApp();
</script>

<template>
  <span
    data-testid="thread-unread-dot"
    :title="$i18n.t.value.threads.unread"
    class="inline-flex shrink-0 items-center"
  >
    <span aria-hidden="true" class="bg-primary size-1.5 rounded-full" />
    <span class="sr-only">{{ $i18n.t.value.threads.unread }}</span>
  </span>
</template>
