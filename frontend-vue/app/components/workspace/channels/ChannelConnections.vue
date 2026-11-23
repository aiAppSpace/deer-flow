<script setup lang="ts">
import ChannelScheduledUpdates from "./ChannelScheduledUpdates.vue";
import { computed, ref, watch } from "vue";
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Plug,
  Unplug,
} from "lucide-vue-next";

import ChannelProviderIcon from "./ChannelProviderIcon.vue";
import ChannelRuntimeConfigDialog from "./ChannelRuntimeConfigDialog.vue";
import SettingsSection from "@/components/workspace/settings/SettingsSection.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useWorkspaceAsyncOwner } from "@/composables/useWorkspaceAsyncOwner";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
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
  channelProviderName,
  providerCanConnect,
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
  providerSupportsConnect,
} from "@/core/channels/provider-state";
import {
  getChannelConnectionLabel,
  getChannelProviderStatusKey,
  type ChannelProviderView,
} from "@/core/channels/state";
import type {
  ChannelConnection,
  ChannelProvider,
  ChannelRuntimeConfigValues,
} from "@/core/channels/types";

const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels);
const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({ enabled: computed(() => !authDisabled) });
const scopeKey = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.id;
  const session = auth.session.value;
  return session?.tag === "authenticated" ? session.user.id : "";
});
const isAdmin = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.system_role === "admin";
  const session = auth.session.value;
  return (
    session?.tag === "authenticated" && session.user.system_role === "admin"
  );
});
const channels = useChannelConnections({
  scopeKey,
  enabled: computed(() => Boolean(scopeKey.value)),
});

const editing = ref<ChannelProvider | null>(null);
const setupStep = ref<"setup" | "binding">("setup");
const toast = useWorkspaceToast();
const captureOwner = useWorkspaceAsyncOwner();
let dialogGeneration = 0;
watch(
  [editing, setupStep],
  () => {
    dialogGeneration++;
  },
  { flush: "sync" },
);
function captureDialogOwner() {
  const ownsWorkspace = captureOwner();
  const generation = dialogGeneration;
  return () => ownsWorkspace() && generation === dialogGeneration;
}
watch(
  scopeKey,
  () => {
    editing.value = null;
  },
  { flush: "sync" },
);

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function statusLabel(status: string) {
  const labels = text.value;
  if (status === "connected") return labels.connected;
  if (status === "pending") return labels.pending;
  if (status === "revoked") return labels.revoked;
  if (status === "not_connected") return labels.notConnected;
  if (status === "disabled") return labels.disabled;
  if (status === "unconfigured") return labels.unconfigured;
  if (status === "unavailable") return labels.unavailableShort;
  return status.replaceAll("_", " ");
}

function providerStatusLabel(view: ChannelProviderView) {
  return statusLabel(getChannelProviderStatusKey(view));
}

function providerConnected(view: ChannelProviderView) {
  return (
    view.provider.configured &&
    !view.provider.unavailable_reason &&
    (view.connections.some((connection) => connection.status === "connected") ||
      view.provider.connection_status === "connected")
  );
}

function providerDescription(view: ChannelProviderView) {
  const { provider } = view;
  const base =
    text.value.descriptions[provider.provider] ?? provider.display_name;
  if (providerConnected(view)) {
    const connection =
      view.connections.find((candidate) => candidate.status === "connected") ??
      view.connections[0];
    return connection
      ? `${base} ${text.value.connectedAs(getChannelConnectionLabel(connection))}`
      : base;
  }
  return provider.unavailable_reason
    ? `${base} ${provider.unavailable_reason}`
    : base;
}

function beginSetup(
  provider: ChannelProvider,
  step: "setup" | "binding" = "setup",
) {
  setupStep.value = step;
  editing.value = provider;
}
function prepareWindow(provider: ChannelProvider): ChannelConnectWindow {
  return provider.auth_mode === "deep_link" ? prepareConnectWindow() : null;
}
async function connectProvider(
  provider: ChannelProvider,
  connectWindow: ChannelConnectWindow = prepareWindow(provider),
) {
  if (providerNeedsRuntimeConfig(provider)) {
    closeConnectWindow(connectWindow);
    beginSetup(provider);
    return;
  }
  if (!providerSupportsConnect(provider)) {
    closeConnectWindow(connectWindow);
    toast.error(provider.unavailable_reason || text.value.unavailable);
    return;
  }
  if (provider.provider === "wechat") {
    closeConnectWindow(connectWindow);
    beginSetup(provider, provider.configured ? "binding" : "setup");
    return;
  }
  const current = captureDialogOwner();
  try {
    const response = await channels.connect(provider.provider);
    if (!current()) {
      closeConnectWindow(connectWindow);
      return;
    }
    if (response.url) openConnectUrl(response.url, connectWindow);
    else {
      closeConnectWindow(connectWindow);
      toast.success(response.instruction);
    }
  } catch (cause) {
    closeConnectWindow(connectWindow);
    if (current()) toast.error(errorMessage(cause, text.value.unavailable));
  }
}
async function saveRuntimeConfig(
  provider: ChannelProvider,
  values: ChannelRuntimeConfigValues,
) {
  if (channels.isProviderPending(provider.provider)) return;
  const current = captureDialogOwner();
  const connectWindow = prepareWindow(provider);
  try {
    const next = await channels.configure(provider.provider, values);
    if (!current()) {
      closeConnectWindow(connectWindow);
      return;
    }
    if (next.provider === "wechat") {
      closeConnectWindow(connectWindow);
      return next;
    }
    editing.value = null;
    if (providerCanConnect(next)) await connectProvider(next, connectWindow);
    else {
      closeConnectWindow(connectWindow);
      toast.success(text.value.connected);
    }
  } catch (cause) {
    closeConnectWindow(connectWindow);
    if (current()) toast.error(errorMessage(cause, text.value.unavailable));
  }
}
async function disconnectConnection(connection: ChannelConnection) {
  const current = captureOwner();
  try {
    await channels.disconnectConnection(connection.id);
    if (current()) toast.success(text.value.revoked);
  } catch (cause) {
    if (current()) toast.error(errorMessage(cause, text.value.unavailable));
  }
}
async function removeProvider(provider: ChannelProvider) {
  const current = captureOwner();
  try {
    await channels.disconnectProvider(provider.provider);
    if (current()) toast.success(text.value.revoked);
  } catch (cause) {
    if (current()) toast.error(errorMessage(cause, text.value.unavailable));
  }
}
function connectionStatusLabel(
  provider: ChannelProvider,
  connection: ChannelConnection,
) {
  return statusLabel(
    !provider.enabled
      ? "disabled"
      : !provider.configured
        ? "unconfigured"
        : provider.unavailable_reason
          ? "unavailable"
          : connection.status,
  );
}

function connectLabel(view: ChannelProviderView) {
  if (
    view.connections.some(
      (connection) =>
        connection.status === "connected" || connection.status === "pending",
    )
  ) {
    return text.value.addAccount;
  }
  return view.connections.some((connection) => connection.status === "revoked")
    ? text.value.reconnect
    : text.value.connect;
}

function showConnectAction(view: ChannelProviderView) {
  return view.connections.length > 0 || !providerConnected(view);
}
</script>

<template>
  <SettingsSection
    :title="$i18n.t.value.settings.channels.title"
    :description="$i18n.t.value.settings.channels.description"
  >
    <div v-if="!channels.loaded.value" class="text-muted-foreground text-sm">
      {{ $i18n.t.value.common.loading }}
    </div>
    <div v-else-if="channels.error.value" class="text-destructive text-sm">
      {{ text.unavailable }}
    </div>
    <div
      v-else-if="
        !channels.enabled.value || !channels.providerViews.value.length
      "
      class="text-muted-foreground text-sm"
    >
      {{ $i18n.t.value.settings.channels.disabled }}
    </div>
    <div v-else class="flex w-full flex-col gap-4">
      <Item
        v-for="view in channels.providerViews.value"
        :key="view.provider.provider"
        variant="outline"
        class="w-full items-start"
        :data-testid="`channel-provider-${view.provider.provider}`"
      >
        <ItemMedia variant="icon" class="bg-background">
          <ChannelProviderIcon
            :provider="view.provider.provider"
            class="size-5"
          />
        </ItemMedia>
        <ItemContent class="min-w-0">
          <ItemTitle class="w-full">
            <span class="truncate">{{
              channelProviderName(view.provider, $i18n.t.value)
            }}</span>
            <Badge
              :variant="providerConnected(view) ? 'default' : 'outline'"
              :class="providerConnected(view) ? '' : 'text-muted-foreground'"
              :data-testid="`channel-status-${view.provider.provider}`"
            >
              <CircleCheck v-if="providerConnected(view)" />
              <CircleAlert v-else />
              {{ providerStatusLabel(view) }}
            </Badge>
          </ItemTitle>
          <ItemDescription class="line-clamp-none">
            {{ providerDescription(view) }}
          </ItemDescription>

          <div v-if="view.connections.length > 0" class="mt-3 w-full space-y-2">
            <h4 class="text-xs font-medium">{{ text.accounts }}</h4>
            <div
              v-for="connection in view.connections"
              :key="connection.id"
              class="bg-muted/40 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2"
              :data-testid="`channel-connection-${connection.id}`"
            >
              <div class="min-w-0">
                <div class="truncate text-xs font-medium">
                  {{ getChannelConnectionLabel(connection) }}
                </div>
                <div class="text-muted-foreground text-xs">
                  {{ connectionStatusLabel(view.provider, connection) }}
                </div>
              </div>
              <Button
                v-if="connection.status !== 'revoked'"
                class="h-auto max-w-full min-w-0 whitespace-normal max-[361px]:w-full"
                type="button"
                variant="outline"
                size="sm"
                :disabled="channels.isConnectionPending(connection.id)"
                :aria-label="
                  text.disconnectAccount(getChannelConnectionLabel(connection))
                "
                @click="disconnectConnection(connection)"
              >
                <LoaderCircle
                  v-if="channels.isConnectionPending(connection.id)"
                  class="animate-spin"
                />
                <Unplug v-else />
                {{ text.disconnect }}
              </Button>
            </div>
          </div>
          <ChannelScheduledUpdates
            :provider="view.provider"
            :connected="providerConnected(view)"
            class="mt-1"
          />
        </ItemContent>

        <ItemActions class="ml-auto flex-wrap justify-end">
          <Button
            v-if="
              view.provider.configured &&
              providerCanEditRuntimeConfig(view.provider)
            "
            type="button"
            variant="outline"
            size="sm"
            :disabled="channels.isProviderPending(view.provider.provider)"
            @click="beginSetup(view.provider)"
          >
            <LoaderCircle
              v-if="channels.isProviderPending(view.provider.provider)"
              class="animate-spin"
            />
            <Plug v-else />
            {{ text.modify }}
          </Button>
          <Button
            v-if="showConnectAction(view)"
            type="button"
            size="sm"
            :disabled="channels.isProviderPending(view.provider.provider)"
            :title="view.provider.unavailable_reason || undefined"
            @click="connectProvider(view.provider)"
          >
            <LoaderCircle
              v-if="channels.isProviderPending(view.provider.provider)"
              class="animate-spin"
            />
            <Plug v-else />
            {{ connectLabel(view) }}
          </Button>

          <Button
            v-if="isAdmin && view.provider.configured"
            type="button"
            variant="outline"
            size="sm"
            class="text-destructive hover:text-destructive h-auto min-h-8 max-w-full min-w-0 py-1 whitespace-normal"
            :disabled="channels.isProviderPending(view.provider.provider)"
            :aria-label="`${text.removeProviderConfig}: ${view.provider.display_name}`"
            @click="removeProvider(view.provider)"
          >
            <LoaderCircle
              v-if="channels.isProviderPending(view.provider.provider)"
              class="animate-spin"
            />
            {{ text.removeProviderConfig }}
          </Button>
        </ItemActions>
      </Item>
    </div>
  </SettingsSection>

  <ChannelRuntimeConfigDialog
    :provider="editing"
    :open="editing !== null"
    :submitting="editing ? channels.isProviderPending(editing.provider) : false"
    :initial-step="setupStep"
    :submit="saveRuntimeConfig"
    :on-configured="
      () => {
        editing = null;
      }
    "
    @update:open="!$event && (editing = null)"
  />
</template>
