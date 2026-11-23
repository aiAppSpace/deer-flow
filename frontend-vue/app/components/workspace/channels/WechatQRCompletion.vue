<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { Check, Copy, LoaderCircle, QrCode } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  connectChannelProvider,
  listChannelConnections,
  listChannelProviders,
} from "@/core/channels/api";
import {
  startConnectionPoll,
  type ConnectPollHandle,
} from "@/core/channels/connect-poll";
import { channelKeys } from "@/core/channels/query-keys";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import type { ChannelProvider } from "@/core/channels/types";

export type PendingWechatBinding = { code: string; expiresAt: number };
const props = defineProps<{
  provider: ChannelProvider;
  bindingToResume?: PendingWechatBinding | null;
}>();
const emit = defineEmits<{
  done: [];
  restart: [binding: PendingWechatBinding | null];
}>();
const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels.wechatQr);
const client = useQueryClient();
const attempt = ref(0);
const stage = ref<"loading" | "binding" | "connected" | "error" | "expired">(
  "loading",
);
const binding = ref<PendingWechatBinding | null>(null);
const copied = ref(false);
const copyFailed = ref(false);
const command = computed(() =>
  binding.value ? `/connect ${binding.value.code}` : "",
);
let isActive = () => false;
watch(
  () => [props.provider, props.bindingToResume, attempt.value] as const,
  (_value, _old, onCleanup) => {
    const owns = captureWorkspaceQueryOwner(client);
    let stopped = false;
    const current = () => !stopped && owns();
    isActive = current;
    const controller = new AbortController();
    let poller: ConnectPollHandle | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const start: { timer?: ReturnType<typeof setTimeout> } = {};
    onCleanup(() => {
      stopped = true;
      controller.abort();
      clearTimeout(start.timer);
      clearTimeout(expiry);
      poller?.cancel();
    });
    copied.value = false;
    copyFailed.value = false;
    binding.value = null;
    if (props.provider.connection_status === "connected") {
      stage.value = "connected";
      return;
    }
    stage.value = "loading";
    const connected = () => {
      if (!current()) return;
      clearTimeout(expiry);
      stage.value = "connected";
      void client.invalidateQueries({ queryKey: channelKeys.all });
    };
    start.timer = setTimeout(() => {
      void (async () => {
        const providers = await listChannelProviders({
          signal: controller.signal,
        });
        if (!current()) return;
        if (
          providers.providers.some(
            (item) =>
              item.provider === "wechat" &&
              item.connection_status === "connected",
          )
        ) {
          connected();
          return;
        }
        let next = props.bindingToResume;
        if (!next || next.expiresAt <= Date.now()) {
          const result = await connectChannelProvider("wechat", {
            signal: controller.signal,
          });
          const lifetime =
            Number.isFinite(result.expires_in) && result.expires_in > 0
              ? result.expires_in
              : 600;
          next = { code: result.code, expiresAt: Date.now() + lifetime * 1000 };
        }
        if (!current()) return;
        binding.value = next;
        const expiresIn = (next.expiresAt - Date.now()) / 1000;
        if (expiresIn <= 0) {
          stage.value = "expired";
          return;
        }
        stage.value = "binding";
        expiry = setTimeout(() => {
          poller?.cancel();
          if (current()) stage.value = "expired";
        }, expiresIn * 1000);
        poller = startConnectionPoll({
          provider: "wechat",
          expiresInSeconds: expiresIn,
          fetchConnections: (signal) =>
            current()
              ? listChannelConnections({ signal })
              : Promise.reject(new DOMException("Stale account", "AbortError")),
          onConnected: connected,
        });
      })().catch(() => {
        if (current() && !controller.signal.aborted) stage.value = "error";
      });
    }, 0);
  },
  { immediate: true },
);
async function copy() {
  const current = isActive;
  try {
    await navigator.clipboard.writeText(command.value);
    if (current()) {
      copied.value = true;
      copyFailed.value = false;
    }
  } catch {
    if (current()) copyFailed.value = true;
  }
}
</script>

<template>
  <div class="flex min-h-[328px] flex-col gap-5">
    <div class="flex items-start gap-3 rounded-xl bg-emerald-500/5 p-4">
      <span class="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600"
        ><Check class="size-4"
      /></span>
      <div class="space-y-1">
        <p class="text-sm font-medium">{{ text.saved }}</p>
        <p class="text-muted-foreground text-xs leading-relaxed">
          {{ text.savedDescription }}
        </p>
      </div>
    </div>
    <div
      role="status"
      aria-live="polite"
      class="flex flex-1 flex-col justify-center gap-3 text-center"
    >
      <template v-if="stage === 'connected'"
        ><div
          class="mx-auto rounded-full bg-emerald-500/10 p-4 text-emerald-600"
        >
          <Check class="size-8" />
        </div>
        <p class="font-medium">{{ text.connectedTitle }}</p>
        <p class="text-muted-foreground text-sm">
          {{ text.connectedDescription }}
        </p></template
      >
      <template v-else-if="stage === 'binding'"
        ><p class="text-sm font-medium">{{ text.bindTitle }}</p>
        <p class="text-muted-foreground text-xs leading-relaxed">
          {{ text.bindDescription }}
        </p>
        <code
          class="bg-muted rounded-lg border p-3 text-sm break-all select-all"
          >{{ command }}</code
        ><Button type="button" variant="outline" @click="copy"
          ><Check v-if="copied" /><Copy v-else />{{
            copied ? text.copied : text.copyCommand
          }}</Button
        >
        <p v-if="copyFailed" class="text-destructive text-xs">
          {{ text.copyFailed }}
        </p>
        <p
          class="text-muted-foreground flex items-center justify-center gap-2 text-xs"
        >
          <LoaderCircle class="size-3 animate-spin" />{{ text.bindWaiting }}
        </p></template
      >
      <template v-else-if="stage === 'loading'"
        ><LoaderCircle class="mx-auto size-5 animate-spin" />
        <p class="text-muted-foreground text-sm">
          {{ text.bindLoading }}
        </p></template
      >
      <template v-else
        ><p class="text-muted-foreground text-sm">
          {{ stage === "expired" ? text.bindExpired : text.bindFailed }}
        </p>
        <Button type="button" variant="outline" @click="attempt++">{{
          text.bindRetry
        }}</Button></template
      >
    </div>
    <div
      v-if="stage !== 'connected'"
      class="space-y-2 border-t pt-3 text-center"
    >
      <p class="text-muted-foreground text-xs leading-relaxed">
        {{ text.restartHint }}
      </p>
      <Button
        type="button"
        variant="secondary"
        class="w-full"
        @click="emit('restart', binding ?? bindingToResume ?? null)"
        ><QrCode />{{ text.restart }}</Button
      >
      <p
        v-if="stage === 'binding'"
        class="text-muted-foreground text-xs leading-relaxed"
      >
        {{ text.restartKeepCommand }}
      </p>
    </div>
    <Button
      type="button"
      :variant="stage === 'connected' ? 'default' : 'outline'"
      :aria-label="
        stage === 'connected' ? text.done : $i18n.t.value.common.close
      "
      @click="emit('done')"
      >{{
        stage === "connected" ? text.done : $i18n.t.value.common.close
      }}</Button
    >
  </div>
</template>
