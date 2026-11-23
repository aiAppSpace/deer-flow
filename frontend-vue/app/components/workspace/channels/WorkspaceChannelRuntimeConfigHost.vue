<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";

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
import { providerCanConnect } from "@/core/channels/provider-state";
import type { ChannelProvider } from "@/core/channels/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

import ChannelRuntimeConfigDialog from "./ChannelRuntimeConfigDialog.vue";

const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const captureOwner = useWorkspaceAsyncOwner();
const dialog = useWorkspaceChannelRuntimeConfig();
let dialogGeneration = 0;
watch(
  [() => dialog.provider.value, () => dialog.initialStep.value],
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
watch(scopeKey, dialog.close, { flush: "sync" });

async function startConnect(
  provider: ChannelProvider,
  preparedWindow?: ChannelConnectWindow,
) {
  const isCurrent = captureDialogOwner();
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
        : $i18n.t.value.channels.unavailable,
    );
  }
}

async function submit(
  provider: ChannelProvider,
  values: Record<string, string>,
) {
  const isCurrent = captureDialogOwner();
  const connectWindow =
    provider.auth_mode === "deep_link" ? prepareConnectWindow() : null;
  try {
    const updated = await channels.configure(provider.provider, values);
    if (!isCurrent()) {
      closeConnectWindow(connectWindow);
      return;
    }
    if (updated.provider === "wechat") {
      closeConnectWindow(connectWindow);
      return updated;
    }
    dialog.close();
    if (providerCanConnect(updated)) {
      await startConnect(updated, connectWindow);
      return;
    }
    closeConnectWindow(connectWindow);
    toast.success($i18n.t.value.channels.connected);
  } catch (cause) {
    closeConnectWindow(connectWindow);
    if (!isCurrent()) return;
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
    :initial-step="dialog.initialStep.value"
    :submit="submit"
    :on-configured="() => dialog.close()"
    @update:open="!$event && dialog.close()"
  />
</template>
