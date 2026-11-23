<script setup lang="ts">
import { computed } from "vue";
import type { LocationQueryRaw } from "vue-router";
import { ArrowLeft, ChevronRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useFrontendExtensions } from "@/composables/useFrontendExtensions";
import { extensionDirectory } from "@/core/extensions/catalog";
import { extensionIcon } from "@/core/extensions/registry";
import PluginRow from "./PluginRow.vue";

const props = withDefaults(defineProps<{ query?: string }>(), { query: "" });
const { $i18n } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const source = useFrontendExtensions();
const entries = computed(() =>
  extensionDirectory(source.data.value ?? [], $i18n.t.value.extensions.catalog),
);
const selected = computed(() =>
  typeof route.query.extension === "string" ? route.query.extension : undefined,
);
const entry = computed(() =>
  entries.value.find((item) => item.id === selected.value),
);
const visible = computed(() =>
  entries.value.filter((item) =>
    `${item.title} ${item.description} ${item.package ?? ""} ${item.id} ${item.loaded?.title ?? ""} ${item.loaded?.description ?? ""}`
      .toLowerCase()
      .includes(props.query.trim().toLowerCase()),
  ),
);
function select(namespace?: string) {
  const query: LocationQueryRaw = { ...route.query, tab: "extensions" };
  if (namespace) query.extension = namespace;
  else delete query.extension;
  void router.replace({ path: route.path, query });
}
function reload() {
  window.location.reload();
}
</script>
<template>
  <div :class="selected ? 'space-y-6' : 'space-y-5'">
    <Button
      variant="outline"
      class="max-w-full whitespace-normal max-sm:h-auto max-sm:min-h-9"
      @click="reload"
      >{{ $i18n.t.value.extensions.reloadAll }}</Button
    >
    <p v-if="source.isPending.value" role="status">
      {{ $i18n.t.value.extensions.loading }}
    </p>
    <div v-else-if="source.isError.value" role="alert">
      <p>{{ $i18n.t.value.extensions.unavailable }}</p>
      <Button variant="outline" @click="source.refetch()">{{
        $i18n.t.value.extensions.retry
      }}</Button>
    </div>
    <template v-if="selected">
      <Button variant="ghost" @click="select()"
        ><ArrowLeft />{{ $i18n.t.value.extensions.all }}</Button
      >
      <p v-if="!entry">{{ $i18n.t.value.extensions.notInstalled }}</p>
      <div v-else class="max-w-3xl space-y-4">
        <h2 class="text-2xl font-semibold">{{ entry.title }}</h2>
        <p class="text-muted-foreground">{{ entry.description }}</p>
        <p>
          {{
            entry.loaded?.error
              ? $i18n.t.value.extensions.moduleUnavailable
              : entry.loaded
                ? entry.loaded.settings.enabled === true
                  ? $i18n.t.value.extensions.enabledManaged
                  : $i18n.t.value.extensions.disabledManaged
                : $i18n.t.value.extensions.catalogHint
          }}
        </p>
        <Button v-if="entry.guide" variant="outline" as-child
          ><a :href="entry.guide" target="_blank" rel="noopener noreferrer">{{
            $i18n.t.value.extensions.installationGuide
          }}</a></Button
        >
      </div>
    </template>
    <template v-else>
      <p class="text-muted-foreground text-sm">
        {{ $i18n.t.value.extensions.deploymentHint }}
      </p>
      <div class="grid gap-x-10 md:grid-cols-2">
        <PluginRow
          v-for="item in visible"
          :key="item.id"
          :name="item.title"
          :description="item.description"
          :label="
            item.loaded?.error
              ? $i18n.t.value.extensions.moduleUnavailable
              : item.loaded
                ? item.loaded.settings.enabled === true
                  ? $i18n.t.value.capabilities.enabled
                  : $i18n.t.value.capabilities.disabled
                : $i18n.t.value.extensions.catalogEntry
          "
          :details-label="$i18n.t.value.extensions.view(item.title)"
          @details="select(item.id)"
          ><template #icon
            ><div
              class="bg-muted flex size-12 shrink-0 items-center justify-center rounded-xl"
            >
              <component
                :is="extensionIcon(item.loaded?.extension?.icon ?? item.icon)"
                class="size-6"
              /></div></template
          ><Button
            variant="ghost"
            size="icon"
            :aria-label="$i18n.t.value.extensions.open(item.title)"
            @click="select(item.id)"
            ><ChevronRight /></Button
        ></PluginRow>
      </div>
      <p
        v-if="!visible.length"
        role="status"
        class="text-muted-foreground py-8"
      >
        {{ $i18n.t.value.extensions.noResults }}
      </p>
    </template>
  </div>
</template>
