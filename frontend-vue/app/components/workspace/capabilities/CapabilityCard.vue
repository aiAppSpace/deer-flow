<script setup lang="ts">
import { ArrowUpRight } from "lucide-vue-next";
defineProps<{
  name: string;
  description: string;
  label: string;
  detailsLabel?: string;
}>();
defineEmits<{ details: [] }>();
</script>
<template>
  <article
    class="bg-background group hover:border-foreground/20 flex min-w-0 flex-col rounded-2xl border p-5 transition-[border-color,box-shadow] hover:shadow-sm"
  >
    <div class="mb-5 flex items-start justify-between gap-3">
      <slot name="icon" /><span
        class="text-muted-foreground bg-muted/60 rounded-md px-2 py-1 text-[11px] font-medium"
        >{{ label }}</span
      >
    </div>
    <h3 class="min-w-0 text-base font-semibold tracking-tight">
      <button
        class="hover:text-muted-foreground flex max-w-full items-center gap-1.5 text-left"
        :aria-label="detailsLabel"
        @click="$emit('details')"
      >
        <span class="truncate">{{ name }}</span
        ><ArrowUpRight
          class="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
        />
      </button>
    </h3>
    <p
      class="text-muted-foreground mt-2 line-clamp-2 min-h-10 text-[13px] leading-5"
    >
      {{ description }}
    </p>
    <div
      class="mt-6 flex min-h-8 items-center justify-between gap-2 border-t pt-4"
    >
      <div
        class="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs"
      >
        <slot name="status" />
      </div>
      <div class="flex shrink-0 items-center gap-1"><slot /></div>
    </div>
  </article>
</template>
