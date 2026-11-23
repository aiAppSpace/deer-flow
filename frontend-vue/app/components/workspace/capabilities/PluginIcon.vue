<script setup lang="ts">
import { computed, ref, type HTMLAttributes } from "vue";
import { Database, FileSearch, Folder, Globe, Search } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import CapabilityIcon from "./CapabilityIcon.vue";
import { safePluginIcon } from "@/core/mcp/icon";
defineOptions({ inheritAttrs: false });
const props = defineProps<{
  class?: HTMLAttributes["class"];
  name: string;
  icon?: string | null;
  asset?: string | null;
  capabilityId?: string;
}>();
const failed = ref<string[]>([]);
const src = computed(() => {
  const custom = safePluginIcon(props.icon);
  const builtin =
    props.asset?.startsWith("/images/plugins/") && !props.asset.includes("..")
      ? props.asset
      : undefined;
  return custom && !failed.value.includes(custom)
    ? custom
    : builtin && !failed.value.includes(builtin)
      ? builtin
      : undefined;
});
const nativeIcons = {
  "web-search": Search,
  "web-fetch": FileSearch,
  database: Database,
  browser: Globe,
  filesystem: Folder,
};
const native = computed(
  () => nativeIcons[props.capabilityId as keyof typeof nativeIcons],
);
</script>
<template>
  <span
    v-if="src"
    :class="
      cn(
        'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-2',
        props.class,
      )
    "
    ><img
      :key="src"
      :src="src"
      alt=""
      :data-plugin-icon="name"
      width="32"
      height="32"
      class="size-full object-contain"
      @error="failed.push(src!)" /></span
  ><span v-else :class="props.class"
    ><CapabilityIcon :name="name" :icon="native"
  /></span>
</template>
