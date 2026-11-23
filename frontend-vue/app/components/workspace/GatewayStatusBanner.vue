<!--
  【文件职责】     在工作区显示 Gateway unavailable，后台自动恢复并提供退出入口。
  【架构位置】     L3 workspace authentication surface
  【主要导出】     默认组件
  【依赖关系】     useAuthSession · auth decision · workspace layout
  【边界与注意】   401 才跳登录；unavailable 只显示状态，不能清 session 或 cookie。
-->

<script setup lang="ts">
import { computed, watch } from "vue";

import { useQueryClient } from "@tanstack/vue-query";

import { useAuthSession } from "@/composables/useAuthSession";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { performLogout } from "@/core/auth/logout";
import { buildLoginLocation, isEnabledRuntimeFlag } from "@/core/auth/decision";

const { $i18n } = useNuxtApp();
const config = useRuntimeConfig();
const route = useRoute();
const enabled = computed(
  () => !isEnabledRuntimeFlag(config.public.authDisabled),
);
const { session } = useAuthSession({ enabled });
const queryClient = useQueryClient();
function signOut() {
  return performLogout({
    post: () => fetchWithAuth("/api/v1/auth/logout", { method: "POST" }),
    navigate: (to) => navigateTo(to),
    hardNavigate: (to) => {
      globalThis.location.href = to;
    },
    queryClient,
  });
}
const unavailable = computed(() => session.value?.tag === "unavailable");

watch(
  session,
  (current) => {
    if (current?.tag === "unauthenticated") {
      void navigateTo(buildLoginLocation(route.fullPath), { replace: true });
    } else if (current?.tag === "authenticated" && current.user.needs_setup) {
      void navigateTo("/setup", { replace: true });
    }
  },
  // The middleware may already have populated the shared query.
  { immediate: true },
);
</script>

<template>
  <div
    v-if="unavailable"
    data-gateway-status="unavailable"
    role="status"
    aria-live="polite"
    class="bg-muted text-muted-foreground flex items-center justify-between gap-3 border-b px-4 py-2 text-sm"
  >
    <span>
      {{ $i18n.t.value.workspace.gatewayUnavailable }}
      {{ $i18n.t.value.workspace.gatewayUnavailableRetrying }}
    </span>
    <button
      type="button"
      class="hover:bg-background rounded-md border px-3 py-1 text-xs"
      @click="signOut()"
    >
      {{ $i18n.t.value.workspace.logout }}
    </button>
  </div>
</template>
