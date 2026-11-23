<script setup lang="ts">
defineProps<{
  name: string;
  description: string;
  label?: string;
  detailsLabel?: string;
}>();
defineEmits<{ details: [] }>();
</script>
<template>
  <article
    class="hover:bg-muted/40 group flex min-w-0 flex-wrap items-center gap-4 rounded-xl px-3 py-5 transition-colors"
  >
    <slot name="icon" />
    <div class="min-w-0 flex-1 basis-48 wrap-anywhere">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 class="text-sm font-semibold">
          <button
            v-if="detailsLabel"
            class="text-left underline-offset-4 hover:underline"
            :aria-label="detailsLabel"
            @click="$emit('details')"
          >
            {{ name }}</button
          ><template v-else>{{ name }}</template>
        </h3>
        <span
          v-if="label"
          class="text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 text-[10px] leading-4"
          >{{ label }}</span
        >
      </div>
      <p class="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-5">
        {{ description }}
      </p>
    </div>
    <div
      class="flex max-w-full min-w-0 shrink-0 flex-wrap items-center gap-1 wrap-anywhere"
    >
      <slot />
    </div>
  </article>
</template>
