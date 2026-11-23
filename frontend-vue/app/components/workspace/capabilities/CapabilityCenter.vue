<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from "vue";
import { Blocks, Search, Sparkles } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceSidebar } from "@/composables/useWorkspaceSidebar";

const PluginGallery = defineAsyncComponent(() => import("./PluginGallery.vue"));
const SkillGallery = defineAsyncComponent(() => import("./SkillGallery.vue"));
const ExtensionGallery = defineAsyncComponent(
  () => import("./ExtensionGallery.vue"),
);
const route = useRoute();
const router = useRouter();
const { $i18n } = useNuxtApp();
const { mobileOpen, toggleSidebar } = useWorkspaceSidebar();
const hydrated = ref(false);
onMounted(() => {
  hydrated.value = true;
});
const query = ref("");
const tab = computed(() =>
  route.query.tab === "skills"
    ? "skills"
    : route.query.tab === "extensions"
      ? "extensions"
      : "plugins",
);
const searchLabel = computed(() =>
  tab.value === "extensions"
    ? $i18n.t.value.extensions.search
    : tab.value === "skills"
      ? $i18n.t.value.capabilities.searchSkills
      : $i18n.t.value.capabilities.searchPlugins,
);
function changeTab(value: string | number) {
  query.value = "";
  void router.replace({ path: route.path, query: { tab: String(value) } });
}
</script>
<template>
  <div class="bg-background flex h-full min-h-0 flex-col">
    <div
      class="text-muted-foreground flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b px-4 text-xs md:px-8"
    >
      <SidebarTrigger
        :open="mobileOpen"
        class="md:hidden"
        :aria-label="$i18n.t.value.primitives.toggleSidebar"
        @click="toggleSidebar"
      />
      <span>{{ $i18n.t.value.breadcrumb.workspace }}</span
      ><span class="opacity-40">/</span
      ><span class="text-foreground">{{
        $i18n.t.value.capabilities.title
      }}</span>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-10">
        <header class="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 class="text-[28px] font-semibold tracking-tight">
              {{ $i18n.t.value.capabilities.title }}
            </h1>
            <p class="text-muted-foreground mt-2 text-sm leading-6">
              {{ $i18n.t.value.capabilities.description }}
            </p>
          </div>
          <div class="relative w-full md:w-72">
            <Search
              class="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4"
            /><Input
              v-model="query"
              :disabled="!hydrated"
              class="bg-muted/30 h-10 rounded-xl pl-9 shadow-none"
              :aria-label="searchLabel"
              :placeholder="searchLabel"
            />
          </div>
        </header>
        <Tabs
          :model-value="tab"
          class="@container/capability-tabs mb-7 border-b"
          @update:model-value="changeTab"
          ><TabsList
            variant="line"
            class="h-12 gap-7 @max-sm/capability-tabs:max-w-full @max-sm/capability-tabs:flex-wrap @max-sm/capability-tabs:group-data-[orientation=horizontal]/tabs:h-auto @max-sm/capability-tabs:[&>button]:h-auto @max-sm/capability-tabs:[&>button]:max-w-full @max-sm/capability-tabs:[&>button]:min-w-0 @max-sm/capability-tabs:[&>button]:flex-auto @max-sm/capability-tabs:[&>button]:wrap-anywhere @max-sm/capability-tabs:[&>button]:whitespace-normal"
            ><TabsTrigger value="plugins" class="gap-2 px-1 pb-4 text-sm"
              ><Blocks class="size-4" />{{
                $i18n.t.value.capabilities.toolsAndIntegrations
              }}</TabsTrigger
            ><TabsTrigger value="skills" class="gap-2 px-1 pb-4 text-sm"
              ><Sparkles class="size-4" />{{
                $i18n.t.value.capabilities.skills
              }}</TabsTrigger
            ><TabsTrigger value="extensions" class="gap-2 px-1 pb-4 text-sm">{{
              $i18n.t.value.extensions.title
            }}</TabsTrigger></TabsList
          ></Tabs
        >
        <ExtensionGallery
          v-if="tab === 'extensions'"
          :query="query"
        /><SkillGallery
          v-else-if="tab === 'skills'"
          :query="query"
        /><PluginGallery v-else :query="query" />
      </div>
    </div>
  </div>
</template>
