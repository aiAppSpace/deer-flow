<!--
  【文件职责】     验证 OIDC callback session、显示明确状态并执行安全 replace 跳转。
  【架构位置】     L3
  【主要导出】     /auth/callback 页面
  【依赖关系】     auth session Vue Query · callback pure decision · auth layout
  【边界与注意】   双入口 provider 逻辑仍归 Gateway；本页只验证 cookie session 与 safe next。
-->

<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";

import { clearAuthenticatedClientState } from "@/core/auth/client-state";
import { resolveAuthCallback } from "@/core/auth/callback";
import { authSessionQueryOptions } from "@/core/auth/session-query";

definePageMeta({ layout: "auth" });

const route = useRoute();
const { $i18n } = useNuxtApp();
const queryClient = useQueryClient();
const status = ref<"loading" | "success" | "unauthenticated" | "unavailable">(
  "loading",
);
let redirectTimer: number | undefined;
let disposed = false;

onMounted(async () => {
  const session = await queryClient.fetchQuery(authSessionQueryOptions());
  if (disposed) return;
  const resolution = resolveAuthCallback(
    session,
    typeof route.query.next === "string" ? route.query.next : null,
  );
  status.value = resolution.status;
  if (resolution.status === "success") {
    clearAuthenticatedClientState(queryClient);
  }
  redirectTimer = window.setTimeout(
    () => void navigateTo(resolution.location, { replace: true }),
    resolution.status === "success" ? 300 : 1_500,
  );
});

onScopeDispose(() => {
  disposed = true;
  if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
});
</script>

<template>
  <div
    class="bg-background relative flex min-h-screen items-center justify-center"
  >
    <div class="text-center">
      <template v-if="status === 'loading'">
        <div
          class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
        <p data-auth-callback-status="loading" class="text-muted-foreground">
          {{ $i18n.t.value.login.callbackSigningIn }}
        </p>
      </template>
      <p
        v-else-if="status === 'success'"
        data-auth-callback-status="success"
        class="text-muted-foreground"
      >
        {{ $i18n.t.value.login.callbackRedirecting }}
      </p>
      <p
        v-else-if="status === 'unauthenticated'"
        data-auth-callback-status="unauthenticated"
        class="text-muted-foreground"
      >
        {{ $i18n.t.value.login.callbackFailedRedirect }}
      </p>
      <p
        v-else
        data-auth-callback-status="unavailable"
        class="text-muted-foreground"
      >
        {{ $i18n.t.value.login.callbackUnavailableRedirect }}
      </p>
    </div>
  </div>
</template>
