<script setup lang="ts">
/*
  【文件职责】     侧栏的 IM 渠道分组：一个 provider 一行，一个 Connect/Connected 按钮。
  【架构位置】     L3 product UI
  【主要导出】     默认 WorkspaceChannelsList 组件
  【依赖关系】     useChannelConnections · channels provider-state · ui/button · ui/sidebar · workspace toast
  【边界与注意】   侧栏按 provider 展示连接状态；设置页另行管理账号与管理员配置。
                   加载与已加载分支都复用 ui/sidebar 和 Skeleton，不手写通用 primitive 样式。
                   连接状态读取 provider.connection_status，以覆盖无 binding row 的已配置部署。
*/

import { Check, LoaderCircle } from "lucide-vue-next";
import ChannelScheduledUpdates from "./ChannelScheduledUpdates.vue";
import { computed } from "vue";

import ChannelProviderIcon from "./ChannelProviderIcon.vue";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";
import { useAuthSession } from "@/composables/useAuthSession";
import { useChannelConnections } from "@/composables/useChannelConnections";
import { useWorkspaceChannelRuntimeConfig } from "@/composables/useWorkspaceChannelRuntimeConfig";
import {
  AUTH_DISABLED_USER,
  isAuthDisabledMode,
} from "@/core/auth/auth-disabled-user";
import {
  closeConnectWindow,
  openConnectUrl,
  prepareConnectWindow,
  type ChannelConnectWindow,
} from "@/core/channels/open-connect-url";
import {
  channelProviderName,
  providerCanConnect,
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
} from "@/core/channels/provider-state";
import type { ChannelProvider } from "@/core/channels/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels);
const toast = useWorkspaceToast();
const captureOwner = useWorkspaceAsyncOwner();

const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({ enabled: computed(() => !authDisabled) });
const scopeKey = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.id;
  const session = auth.session.value;
  return session?.tag === "authenticated" ? session.user.id : "";
});
const channels = useChannelConnections({
  scopeKey,
  enabled: computed(() => Boolean(scopeKey.value)),
  withConnections: false,
});

const runtimeConfig = useWorkspaceChannelRuntimeConfig();

const visibleProviders = computed(() =>
  channels.providers.value.filter((provider) => provider.enabled),
);

/*
  React 的 isLoading 是 providers query 的首屏加载态；本仓的 owner 暴露的是 loaded，
  两者互为反面。骨架屏只在**还没拿到第一份 providers** 时出现，之后哪怕在后台重取
  也不再闪回骨架——这正是 React useQuery 的 isLoading 与 isFetching 的区别。
*/
const isLoading = computed(() => !channels.loaded.value);

function unavailableReason(provider: ChannelProvider): string | undefined {
  if (provider.unavailable_reason) return provider.unavailable_reason;
  if (!provider.enabled) return text.value.disabled;
  if (!provider.configured) return text.value.unconfigured;
  return undefined;
}

function isConnected(provider: ChannelProvider): boolean {
  return (
    !provider.unavailable_reason && provider.connection_status === "connected"
  );
}

async function startConnect(
  provider: ChannelProvider,
  preparedWindow?: ChannelConnectWindow,
) {
  if (provider.provider === "wechat") {
    closeConnectWindow(preparedWindow ?? null);
    runtimeConfig.open(provider, provider.configured ? "binding" : "setup");
    return;
  }
  const isCurrent = captureOwner();
  const connectWindow =
    preparedWindow !== undefined
      ? preparedWindow
      : provider.auth_mode === "deep_link"
        ? prepareConnectWindow()
        : null;
  try {
    const result = await channels.connect(provider.provider);
    if (!isCurrent()) {
      closeConnectWindow(connectWindow);
      return;
    }
    if (result.url) {
      openConnectUrl(result.url, connectWindow);
      return;
    }
    closeConnectWindow(connectWindow);
    toast.success(result.instruction);
  } catch (cause) {
    closeConnectWindow(connectWindow);
    if (!isCurrent()) return;
    toast.error(
      cause instanceof Error && cause.message
        ? cause.message
        : text.value.unavailable,
    );
  }
}

function onProviderAction(provider: ChannelProvider) {
  if (
    providerNeedsRuntimeConfig(provider) ||
    (isConnected(provider) && providerCanEditRuntimeConfig(provider))
  ) {
    runtimeConfig.open(provider);
    return;
  }
  if (!providerCanConnect(provider)) {
    toast.error(unavailableReason(provider) ?? text.value.unavailable);
    return;
  }
  void startConnect(provider);
}
</script>

<template>
  <SidebarGroup v-if="isLoading" class="pt-0">
    <SidebarGroupLabel>{{ $i18n.t.value.sidebar.channels }}</SidebarGroupLabel>
    <div class="space-y-2 px-2 py-1">
      <Skeleton v-for="row in 3" :key="row" class="h-8 w-full" />
    </div>
  </SidebarGroup>

  <SidebarGroup
    v-else-if="
      !channels.error.value && channels.enabled.value && visibleProviders.length
    "
    class="pt-0"
  >
    <SidebarGroupLabel>{{ $i18n.t.value.sidebar.channels }}</SidebarGroupLabel>
    <SidebarMenu>
      <SidebarMenuItem
        v-for="provider in visibleProviders"
        :key="provider.provider"
      >
        <div
          class="hover:bg-sidebar-accent flex h-10 items-center gap-2 rounded-md px-2 transition-colors"
        >
          <ChannelProviderIcon
            :provider="provider.provider"
            size="size-5"
            class="shrink-0"
          />
          <span class="min-w-0 flex-1 truncate text-sm font-medium">
            {{ channelProviderName(provider, $i18n.t.value) }}
          </span>
          <Button
            type="button"
            size="sm"
            :variant="isConnected(provider) ? 'outline' : 'secondary'"
            :class="
              isConnected(provider)
                ? 'h-8 w-24 gap-1 px-2 text-xs'
                : 'h-8 w-24 px-2 text-xs'
            "
            :disabled="channels.isProviderPending(provider.provider)"
            :title="unavailableReason(provider)"
            :data-testid="`channel-provider-${provider.provider}`"
            @click="onProviderAction(provider)"
          >
            <LoaderCircle
              v-if="channels.isProviderPending(provider.provider)"
              class="size-3.5 animate-spin"
            />
            <Check v-else-if="isConnected(provider)" class="size-3.5" />
            <span>
              {{ isConnected(provider) ? text.connected : text.connect }}
            </span>
          </Button>
        </div>
        <ChannelScheduledUpdates
          v-if="isConnected(provider)"
          :provider="provider"
          class="pb-0.5 pl-7 text-[11px] leading-snug [&_svg]:hidden"
        />
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>
