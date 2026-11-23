<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useFrontendExtensions } from "@/composables/useFrontendExtensions";
import { useCapabilityUser } from "@/composables/useCapabilities";
import { useWorkspaceSidebar } from "@/composables/useWorkspaceSidebar";
import { pluginPages, pluginPageTitle } from "@/core/extensions/pages";
import PluginSurfaces from "./PluginSurfaces.vue";

const props = defineProps<{ namespace: string; surfaceId: string }>();
const query = useFrontendExtensions();
const user = useCapabilityUser();
const { $i18n } = useNuxtApp();
const { mobileOpen, toggleSidebar } = useWorkspaceSidebar();
const page = computed(() =>
  pluginPages(query.isError.value ? [] : (query.data.value ?? [])).find(
    ({ contribution, surface }) =>
      contribution.viewer_id === user.value?.id &&
      contribution.namespace === props.namespace &&
      surface.id === props.surfaceId,
  ),
);
const title = computed(() =>
  page.value
    ? pluginPageTitle(page.value.surface, $i18n.locale.value)
    : $i18n.t.value.extensions.pageUnavailable,
);
function reload() {
  window.location.reload();
}
</script>

<template>
  <div class="bg-background flex h-full min-h-0 flex-col">
    <div
      class="text-muted-foreground flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b px-4 text-xs md:px-8"
    >
      <SidebarTrigger
        class="md:hidden"
        :open="mobileOpen"
        :aria-label="$i18n.t.value.primitives.toggleSidebar"
        @click="toggleSidebar"
      />
      <span>{{ $i18n.t.value.breadcrumb.workspace }}</span>
      <span>/</span>
      <span>{{ title }}</span>
    </div>
    <main class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-6xl space-y-6 px-5 py-8 md:px-10">
        <p v-if="query.isPending.value" role="status">
          {{ $i18n.t.value.extensions.pageLoading }}
        </p>
        <template v-else>
          <h1 class="text-2xl font-semibold">{{ title }}</h1>
          <PluginSurfaces
            v-if="page"
            surface-slot="page"
            :namespace="namespace"
            :surface-id="surfaceId"
          />
          <div v-else class="space-y-4">
            <p>{{ $i18n.t.value.extensions.pageUnavailableHint }}</p>
            <Button variant="outline" @click="reload">{{
              $i18n.t.value.extensions.reload
            }}</Button>
            <Button variant="ghost" as-child
              ><NuxtLink to="/workspace/capabilities?tab=extensions">{{
                $i18n.t.value.extensions.viewAll
              }}</NuxtLink></Button
            >
          </div>
        </template>
      </div>
    </main>
  </div>
</template>
