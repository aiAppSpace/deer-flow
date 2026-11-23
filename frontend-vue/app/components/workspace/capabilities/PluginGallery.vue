<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";
import { useQueries, useQueryClient } from "@tanstack/vue-query";
import { ArrowUpRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCapabilityCatalog,
  useCapabilityUser,
  installationQuery,
} from "@/composables/useCapabilities";
import { capabilityCopy } from "@/core/capabilities/copy";
import { cn } from "@/lib/utils";
import {
  catalogText,
  pluginCategories,
  type PluginCategory,
} from "./plugin-catalog";
import {
  pluginDirectoryEntries,
  type PluginGalleryEntry,
} from "./plugin-entries";
import CatalogPluginRow from "./CatalogPluginRow.vue";
import MCPPluginManager from "./MCPPluginManager.vue";
import PluginDirectory from "./PluginDirectory.vue";
import PluginIcon from "./PluginIcon.vue";
import ConfiguredPluginSettings from "./ConfiguredPluginSettings.vue";
const LarkPluginSettings = defineAsyncComponent(
  () => import("./LarkPluginSettings.vue"),
);

defineProps<{ query: string }>();
const { $i18n } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const copy = computed(() => $i18n.t.value.capabilities.directory);
const labels = computed(() => capabilityCopy($i18n.locale.value));
const user = useCapabilityUser();
const canManage = computed(() => !!user.value);
const canManagePlatform = computed(
  () => canManage.value && user.value?.system_role === "admin",
);
const directory = useCapabilityCatalog();
const definitions = computed(() => directory.data.value ?? []);
const adapters = computed(() => [
  ...new Set(
    definitions.value
      .map((item) => item.adapter)
      .filter((adapter) => adapter !== "guide"),
  ),
]);
const states = useQueries({
  queries: computed(() =>
    adapters.value.map((adapter) => installationQuery(adapter, user.value?.id)),
  ),
});
const client = useQueryClient();
const filter = ref("all");
const category = ref<PluginCategory | "all">("all");
const selectedId = ref<string | null>(null);
const selected = computed(() =>
  definitions.value.find(
    (item) => item.id === (selectedId.value ?? route.query.plugin),
  ),
);
const catalogs = computed(() =>
  pluginDirectoryEntries(
    definitions.value,
    new Map(
      adapters.value.map((adapter, index) => [
        adapter,
        {
          items: states.value[index]?.data?.items ?? [],
          unavailable: states.value[index]?.isError ?? false,
        },
      ]),
    ),
    canManage.value,
    canManagePlatform.value,
  ),
);
const categories = [
  "all",
  ...pluginCategories.filter((key) => key !== "custom"),
] as const;
function catalogEntry(id: string) {
  return [...catalogs.value.platform, ...catalogs.value.personal].find(
    (entry) => entry.id === id,
  ) as PluginGalleryEntry;
}
function open(id: string) {
  selectedId.value = id;
}
function close() {
  selectedId.value = null;
  if (route.query.plugin !== undefined) {
    const query = { ...route.query };
    delete query.plugin;
    void router.replace({ path: route.path, query });
  }
  void client.invalidateQueries({ queryKey: ["capabilities"] });
}
</script>
<template>
  <div class="space-y-6">
    <div
      class="flex flex-wrap gap-1"
      role="group"
      :aria-label="copy.allCategories"
    >
      <Button
        v-for="key in categories"
        :key="key"
        variant="ghost"
        size="sm"
        :aria-pressed="category === key"
        :class="
          cn(
            'h-auto min-h-8 max-w-full rounded-lg px-3 text-xs font-normal wrap-anywhere whitespace-normal',
            category === key
              ? 'bg-muted text-foreground font-medium'
              : 'text-muted-foreground',
          )
        "
        @click="category = key"
        >{{ key === "all" ? copy.allCategories : copy.categories[key] }}</Button
      >
    </div>
    <p v-if="directory.isError.value" role="alert">{{ labels.catalogError }}</p>
    <p v-if="directory.isLoading.value" role="status">
      {{ $i18n.t.value.common.loading }}
    </p>
    <Tabs v-model="filter" class="@container/capability-tabs"
      ><TabsList
        class="@max-sm/capability-tabs:max-w-full @max-sm/capability-tabs:flex-wrap @max-sm/capability-tabs:group-data-[orientation=horizontal]/tabs:h-auto @max-sm/capability-tabs:[&>button]:h-auto @max-sm/capability-tabs:[&>button]:max-w-full @max-sm/capability-tabs:[&>button]:min-w-0 @max-sm/capability-tabs:[&>button]:flex-auto @max-sm/capability-tabs:[&>button]:wrap-anywhere @max-sm/capability-tabs:[&>button]:whitespace-normal"
        ><TabsTrigger value="all">{{
          $i18n.t.value.capabilities.allPlugins
        }}</TabsTrigger
        ><TabsTrigger value="installed">{{
          $i18n.t.value.capabilities.installed
        }}</TabsTrigger></TabsList
      ></Tabs
    >
    <section aria-labelledby="platform-plugins-heading" class="space-y-5">
      <div class="space-y-1">
        <h2 id="platform-plugins-heading" class="text-xl font-semibold">
          {{ labels.platformTitle }}
        </h2>
        <p class="text-muted-foreground text-sm">{{ labels.platformHint }}</p>
      </div>
      <MCPPluginManager
        v-if="canManagePlatform"
        :key="`deployment:${user?.id}`"
        scope="deployment"
        :query="query"
        :category="category"
        :installed-only="filter === 'installed'"
        :catalog="catalogs.platform"
        :definitions="definitions"
        ><template #default="{ entry }"
          ><CatalogPluginRow
            :entry="catalogEntry(entry.id)"
            :can-manage="canManage"
            @details="open" /></template
      ></MCPPluginManager>
      <PluginDirectory
        v-else
        :query="query"
        :category="category"
        :installed-only="filter === 'installed'"
        :entries="catalogs.platform"
        ><template #default="{ entry }"
          ><CatalogPluginRow
            :entry="catalogEntry(entry.id)"
            :can-manage="canManage"
            @details="open" /></template
      ></PluginDirectory>
    </section>
    <section
      aria-labelledby="personal-plugins-heading"
      class="space-y-5 border-t pt-8"
    >
      <MCPPluginManager
        v-if="canManage"
        :key="user?.id"
        :query="query"
        :category="category"
        :installed-only="filter === 'installed'"
        :catalog="catalogs.personal"
        :definitions="definitions"
        ><template #toolbar
          ><div class="space-y-1">
            <h2 id="personal-plugins-heading" class="text-xl font-semibold">
              {{ labels.personalTitle }}
            </h2>
            <p class="text-muted-foreground text-sm">
              {{ labels.personalHint }}
            </p>
          </div></template
        ><template #default="{ entry }"
          ><CatalogPluginRow
            :entry="catalogEntry(entry.id)"
            :can-manage="canManage"
            @details="open" /></template
      ></MCPPluginManager>
      <template v-else
        ><div class="space-y-1">
          <h2 id="personal-plugins-heading" class="text-xl font-semibold">
            {{ labels.personalTitle }}
          </h2>
          <p class="text-muted-foreground text-sm">{{ labels.personalHint }}</p>
        </div>
        <PluginDirectory
          :query="query"
          :category="category"
          :installed-only="filter === 'installed'"
          :entries="catalogs.personal"
          ><template #default="{ entry }"
            ><CatalogPluginRow
              :entry="catalogEntry(entry.id)"
              :can-manage="canManage"
              @details="open" /></template></PluginDirectory
      ></template>
    </section>
    <Dialog :open="!!selected" @update:open="!$event && close()"
      ><DialogContent
        :close-label="$i18n.t.value.primitives.close"
        class="max-h-[85vh] sm:max-w-2xl"
        ><template v-if="selected"
          ><DialogHeader
            ><PluginIcon
              :name="selected.id"
              :asset="selected.icon"
              :capability-id="selected.id"
            /><DialogTitle>{{
              catalogText(selected.name, $i18n.locale.value)
            }}</DialogTitle
            ><DialogDescription>{{
              catalogText(selected.description, $i18n.locale.value)
            }}</DialogDescription></DialogHeader
          >
          <LarkPluginSettings
            v-if="selected.adapter === 'lark'"
            :key="`${user?.id}:${selected.id}`"
          />
          <ConfiguredPluginSettings
            v-else-if="
              selected.adapter === 'mcp' || selected.adapter === 'business'
            "
            :key="`${user?.id}:${selected.id}`"
            :plugin="selected"
            :can-manage="canManage"
            @saved="close"
          />
          <p v-else class="text-muted-foreground text-sm leading-6">
            {{ catalogText(selected.setup, $i18n.locale.value) }}
          </p>
          <div
            class="text-muted-foreground flex items-center justify-between text-xs"
          >
            <span>{{ labels.version }}: {{ selected.version }}</span
            ><a
              :href="selected.source"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center gap-1 underline"
              >{{ copy.source }}<ArrowUpRight class="size-3"
            /></a>
          </div> </template></DialogContent
    ></Dialog>
  </div>
</template>
