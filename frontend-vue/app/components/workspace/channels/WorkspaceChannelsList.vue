<script setup lang="ts">
/*
  【文件职责】     侧栏的 IM 渠道分组：一个 provider 一行，一个 Connect/Connected 按钮。
  【架构位置】     L3 product UI
  【主要导出】     默认 WorkspaceChannelsList 组件
  【依赖关系】     useChannelConnections · channels provider-state · ui/button · ui/sidebar · workspace toast
  【边界与注意】   对照 frontend/src/components/workspace/channels/workspace-channels-list.tsx。

                   它和设置页的 ChannelConnections 是**两个**组件，不是一个组件的两种皮肤，
                   因为两边的产品形态本来就不同：侧栏一个 provider 一行一个按钮、只表达
                   「连没连上」；设置页要列出同一个 provider 下的每个账号、要能逐个断开、
                   管理员还要能删 provider 配置。此前本仓用一个 variant 参数把两者压在一起，
                   代价是侧栏被迫背上多账号的那套模型：按钮写着「Add account」、容器是
                   article、还要多拉一次 /connections——全是设置页才需要的东西。

                   **外壳走 ui/sidebar 的四个 primitive，不手抄它们的类串**（wave 203）。
                   手抄那版少了 `data-slot`、`SidebarGroupLabel` 的键盘焦点环与
                   `[&>svg]:size-4`，还留着一条死类 `group/menu-item`（没有任何
                   `group-hover/menu-item` 引用它）。上游同一处用的就是
                   SidebarGroup / SidebarGroupLabel / SidebarMenu / SidebarMenuItem。
                   门禁：tests/guards/primitive-marker-classes.test.ts。

                   **wave 203 只换了「已加载」那一支，loading 那一支原样留着**
                   ——2026-09-12 第十二轮全仓扫 `animate-pulse` 时才发现：
                   三块占位方块手抄的是 `ui/skeleton` 的 `bg-accent animate-pulse rounded-md`，
                   外面两层又各自手抄了一遍 SidebarGroup 与 SidebarGroupLabel
                   （同样漏掉那 10 个 token）。上游那一支是
                   `<SidebarGroup><SidebarGroupLabel>` + 三颗 `<Skeleton className="h-8 w-full" />`。
                   与第十轮修三颗芯片、第十一轮在同一份文件里找到第四颗**同形**：
                   修的是「有锚点的那一支」，没锚点的那一支跟着漏掉。

                   连接态读 provider.connection_status，不读 connections。理由见
                   core/channels/state.ts 的头注释：这两个字段同源，而 connection_status
                   多带了 auth 关闭部署下「配好即已连接、没有 binding row」这个事实。
*/

import { Check, LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";

import ChannelProviderIcon from "./ChannelProviderIcon.vue";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthSession } from "@/composables/useAuthSession";
import { useChannelConnections } from "@/composables/useChannelConnections";
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
  providerCanConnect,
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
} from "@/core/channels/provider-state";
import type { ChannelProvider } from "@/core/channels/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

import ChannelRuntimeConfigDialog from "./ChannelRuntimeConfigDialog.vue";

const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels);
const toast = useWorkspaceToast();

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

const setupProvider = ref<ChannelProvider | null>(null);

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
  const connectWindow =
    preparedWindow !== undefined
      ? preparedWindow
      : provider.auth_mode === "deep_link"
        ? prepareConnectWindow()
        : null;
  try {
    const result = await channels.connect(provider.provider);
    if (result.url) {
      openConnectUrl(result.url, connectWindow);
      return;
    }
    closeConnectWindow(connectWindow);
    toast.success(result.instruction);
  } catch (cause) {
    closeConnectWindow(connectWindow);
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
    setupProvider.value = provider;
    return;
  }
  if (!providerCanConnect(provider)) {
    toast.error(unavailableReason(provider) ?? text.value.unavailable);
    return;
  }
  void startConnect(provider);
}

async function onRuntimeConfigSubmit(
  provider: ChannelProvider,
  values: Record<string, string>,
) {
  const connectWindow =
    provider.auth_mode === "deep_link" ? prepareConnectWindow() : null;
  try {
    const updated = await channels.configure(provider.provider, values);
    setupProvider.value = null;
    if (providerCanConnect(updated)) {
      await startConnect(updated, connectWindow);
      return;
    }
    closeConnectWindow(connectWindow);
    toast.success(text.value.connected);
  } catch (cause) {
    closeConnectWindow(connectWindow);
    toast.error(
      cause instanceof Error && cause.message
        ? cause.message
        : text.value.unavailable,
    );
  }
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
            {{ provider.display_name }}
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
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>

  <ChannelRuntimeConfigDialog
    :provider="setupProvider"
    :open="setupProvider !== null"
    :submitting="
      setupProvider ? channels.isProviderPending(setupProvider.provider) : false
    "
    @update:open="!$event && (setupProvider = null)"
    @submit="onRuntimeConfigSubmit"
  />
</template>
