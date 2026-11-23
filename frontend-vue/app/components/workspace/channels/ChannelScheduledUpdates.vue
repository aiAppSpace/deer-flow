<script setup lang="ts">
import { Bell, BellOff } from "lucide-vue-next";
import type { ChannelProvider } from "@/core/channels/types";
withDefaults(
  defineProps<{
    provider: Pick<ChannelProvider, "proactive_notifications">;
    connected?: boolean;
  }>(),
  { connected: true },
);
const { $i18n } = useNuxtApp();
</script>
<template>
  <p
    v-if="typeof provider.proactive_notifications === 'boolean'"
    data-testid="channel-scheduled-updates"
    :data-supported="provider.proactive_notifications ? 'true' : 'false'"
    class="text-muted-foreground flex items-start gap-1.5 text-xs"
  >
    <component
      :is="provider.proactive_notifications ? Bell : BellOff"
      class="mt-px size-3.5 shrink-0"
      aria-hidden="true"
    /><span>{{
      !provider.proactive_notifications
        ? $i18n.t.value.channels.scheduledUpdates.unsupported
        : connected
          ? $i18n.t.value.channels.scheduledUpdates.supported
          : $i18n.t.value.channels.scheduledUpdates.supportedAfterConnect
    }}</span>
  </p>
</template>
