<script setup lang="ts">
import { MessagesSquare } from "lucide-vue-next";

defineProps<{ title: string; href: string }>();
</script>

<template>
  <NuxtLink
    :to="href"
    :title="title"
    class="border-border bg-muted text-foreground hover:bg-accent inline-flex h-6 max-w-60 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs leading-none font-medium shadow-xs transition-colors"
    data-testid="conversation-reference-chip"
  >
    <MessagesSquare class="text-muted-foreground size-3 shrink-0" />
    <span class="min-w-0 truncate">{{ title }}</span>
  </NuxtLink>
</template>
