<!-- Legacy slash skills remain readable in persisted human messages. The composer uses inline references. -->
<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ name: string; class?: string }>();
const CHIP_BASE_CLASS =
  "border-primary/20 bg-primary/10 text-primary inline-flex h-6 shrink-0 items-center rounded-md border px-1.5 font-mono text-xs leading-none font-medium shadow-xs";
</script>

<template>
  <span :class="cn(CHIP_BASE_CLASS, 'max-w-full', props.class)">
    /{{ props.name }}
  </span>
</template>
