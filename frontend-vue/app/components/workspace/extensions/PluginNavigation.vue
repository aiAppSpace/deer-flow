<script setup lang="ts">
import { computed } from "vue";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useFrontendExtensions } from "@/composables/useFrontendExtensions";
import { useCapabilityUser } from "@/composables/useCapabilities";
import { useWorkspaceSidebar } from "@/composables/useWorkspaceSidebar";
import { pluginPages, pluginPageTitle } from "@/core/extensions/pages";
import { extensionIcon } from "@/core/extensions/registry";

const query = useFrontendExtensions();
const user = useCapabilityUser();
const route = useRoute();
const { $i18n } = useNuxtApp();
const { collapsed, isNarrow, closeMobileSidebar } = useWorkspaceSidebar();
const pages = computed(() =>
  pluginPages(query.isError.value ? [] : (query.data.value ?? [])).filter(
    ({ contribution, surface }) =>
      contribution.viewer_id === user.value?.id && surface.navigation,
  ),
);
</script>

<template>
  <SidebarGroup v-if="pages.length">
    <SidebarGroupLabel>{{
      $i18n.t.value.extensions.navigation
    }}</SidebarGroupLabel>
    <SidebarMenu>
      <SidebarMenuItem v-for="page in pages" :key="page.href">
        <SidebarMenuButton
          as-child
          :is-active="route.path === page.href"
          :tooltip="pluginPageTitle(page.surface, $i18n.locale.value)"
          :tooltip-hidden="!collapsed || isNarrow"
        >
          <NuxtLink :to="page.href" @click="closeMobileSidebar">
            <component :is="extensionIcon(page.icon)" />
            <span>{{ pluginPageTitle(page.surface, $i18n.locale.value) }}</span>
          </NuxtLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>
