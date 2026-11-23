<script setup lang="ts">
import { computed, type Component } from "vue";
import { Puzzle, Sparkles } from "lucide-vue-next";
const props = defineProps<{
  name: string;
  skill?: boolean;
  icon?: Component;
}>();
const tones = [
  "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
];
const tone = computed(
  () =>
    tones[
      [...props.name].reduce((value, char) => value + char.charCodeAt(0), 0) %
        tones.length
    ],
);
</script>
<template>
  <div
    :class="[
      'flex size-12 shrink-0 items-center justify-center rounded-2xl',
      tone,
    ]"
  >
    <component
      :is="icon ?? (skill ? Sparkles : Puzzle)"
      class="size-6"
      :stroke-width="1.6"
    />
  </div>
</template>
