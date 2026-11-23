<script setup lang="ts">
import { computed, useId } from "vue";
import { pluginCategories, type PluginCategory } from "./plugin-catalog";
export interface DirectoryEntry {
  id: string;
  category: PluginCategory;
  search: string;
  installed: boolean;
}
const props = withDefaults(
  defineProps<{
    entries: DirectoryEntry[];
    query?: string;
    category?: PluginCategory | "all";
    installedOnly?: boolean;
  }>(),
  { query: "", category: "all", installedOnly: false },
);
const { $i18n } = useNuxtApp();
const groupId = useId();
const visible = computed(() =>
  props.entries.filter(
    (entry) =>
      (!props.installedOnly || entry.installed) &&
      (props.category === "all" || entry.category === props.category) &&
      entry.search.toLowerCase().includes(props.query.trim().toLowerCase()),
  ),
);
const groups = computed(() =>
  pluginCategories
    .map((key) => ({
      key,
      items: visible.value.filter((entry) => entry.category === key),
    }))
    .filter((group) => group.items.length),
);
</script>
<template>
  <p
    v-if="!visible.length"
    class="text-muted-foreground py-12 text-center text-sm"
    role="status"
  >
    {{ $i18n.t.value.capabilities.noResults }}
  </p>
  <div v-else class="space-y-7">
    <section
      v-for="group in groups"
      :key="group.key"
      :aria-labelledby="`${groupId}-${group.key}`"
    >
      <div class="flex items-baseline gap-3 border-b pb-3">
        <h2 :id="`${groupId}-${group.key}`" class="text-base font-semibold">
          {{ $i18n.t.value.capabilities.directory.categories[group.key] }}
        </h2>
        <span class="text-muted-foreground/70 text-xs">{{
          group.items.length
        }}</span
        ><span class="text-muted-foreground ml-auto hidden text-xs lg:block">{{
          $i18n.t.value.capabilities.directory.hints[group.key]
        }}</span>
      </div>
      <div class="grid grid-cols-1 gap-x-9 lg:grid-cols-2">
        <div v-for="entry in group.items" :key="entry.id" class="min-w-0">
          <slot :entry="entry" />
        </div>
      </div>
    </section>
  </div>
</template>
