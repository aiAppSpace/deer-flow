<script setup lang="ts">
import { computed, onUnmounted } from "vue";

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
import { providerCanConnect } from "@/core/channels/provider-state";
import type { ChannelProvider } from "@/core/channels/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

import ChannelRuntimeConfigDialog from "./ChannelRuntimeConfigDialog.vue";

const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const dialog = useWorkspaceChannelRuntimeConfig();
const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({ enabled: computed(() => !authDisabled) });
const scopeKey = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.id;
  const session = auth.session.value;
  return session?.tag === "authenticated" ? session.user.id : "";
});
const channels = useChannelConnections({
  scopeKey,
  // The sidebar/settings owner already fetched the complete provider object
  // stored by `dialog.open()`. This long-lived host owns only the mutation so
  // it can survive the desktop sidebar unmounting at the mobile breakpoint;
  // enabling its query would duplicate GET /api/channels/providers whenever
  // the dialog opens.
  enabled: false,
  withConnections: false,
});

onUnmounted(dialog.close);

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
        : $i18n.t.value.channels.unavailable,
    );
  }
}

async function submit(
  provider: ChannelProvider,
  values: Record<string, string>,
) {
  const connectWindow =
    provider.auth_mode === "deep_link" ? prepareConnectWindow() : null;
  try {
    const updated = await channels.configure(provider.provider, values);
    dialog.close();
    if (providerCanConnect(updated)) {
      await startConnect(updated, connectWindow);
      return;
    }
    closeConnectWindow(connectWindow);
    toast.success($i18n.t.value.channels.connected);
  } catch (cause) {
    closeConnectWindow(connectWindow);
    toast.error(
      cause instanceof Error && cause.message
        ? cause.message
        : $i18n.t.value.channels.unavailable,
    );
  }
}
</script>

<template>
  <ChannelRuntimeConfigDialog
    :provider="dialog.provider.value"
    :open="dialog.provider.value !== null"
    :submitting="
      dialog.provider.value
        ? channels.isProviderPending(dialog.provider.value.provider)
        : false
    "
    @update:open="!$event && dialog.close()"
    @submit="submit"
  />
</template>
