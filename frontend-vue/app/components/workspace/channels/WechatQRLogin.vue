<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import {
  Check,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Smartphone,
} from "lucide-vue-next";
import { computed, onScopeDispose, ref, watch } from "vue";
import qrcode from "qrcode-generator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelWechatQRLogin,
  pollWechatQRLogin,
  startWechatQRLogin,
} from "@/core/channels/api";
import { channelKeys } from "@/core/channels/query-keys";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import type {
  ChannelProvider,
  WechatQRLoginSession,
} from "@/core/channels/types";

const emit = defineEmits<{ configured: [provider: ChannelProvider] }>();
const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels.wechatQr);
const client = useQueryClient();
const attempt = ref(0);
const session = ref<WechatQRLoginSession | null>(null);
const error = ref<string | null>(null);
const verifyCode = ref("");
const verifying = ref(false);
let submitCode = (_code: string) => {};
const stop = watch(
  attempt,
  (_attempt, _previous, onCleanup) => {
    const ownsAccount = captureWorkspaceQueryOwner(client);
    let stopped = false;
    let polling = false;
    let sessionId: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const current = () => !stopped && ownsAccount();
    session.value = null;
    error.value = null;
    verifyCode.value = "";
    verifying.value = false;
    const cancel = (id: string) => {
      if (ownsAccount()) void cancelWechatQRLogin(id).catch(() => undefined);
    };
    async function poll(code?: string) {
      if (!current() || !sessionId || polling) return;
      polling = true;
      try {
        const result = await pollWechatQRLogin(
          sessionId,
          controller.signal,
          code,
        );
        if (!current() || controller.signal.aborted) return;
        session.value = result;
        verifying.value = false;
        if (result.status === "confirmed" && result.provider) {
          clearTimeout(expiry);
          void client.invalidateQueries({ queryKey: channelKeys.all });
          emit("configured", result.provider);
        } else if (
          result.status === "pending" ||
          result.status === "scanned" ||
          (result.status === "verification_required" &&
            result.error === "network")
        ) {
          timer = setTimeout(() => void poll(), 1500);
        }
      } catch (cause) {
        if (current() && !controller.signal.aborted) {
          verifying.value = false;
          error.value = cause instanceof Error ? cause.message : "";
        }
      } finally {
        polling = false;
      }
    }
    submitCode = (code) => {
      if (!current() || !code || polling || verifying.value) return;
      verifying.value = true;
      verifyCode.value = "";
      clearTimeout(timer);
      void poll(code);
    };
    // Let start return its ID so closing during creation can cancel the server session.
    const start = setTimeout(() => {
      if (!current()) return;
      void startWechatQRLogin()
        .then((result) => {
          if (!current()) {
            cancel(result.id);
            return;
          }
          sessionId = result.id;
          session.value = result;
          expiry = setTimeout(() => {
            if (!current() || polling) return;
            controller.abort();
            clearTimeout(timer);
            verifying.value = false;
            if (session.value && session.value.status !== "confirmed")
              session.value = {
                ...session.value,
                status: "expired",
                error: null,
              };
          }, result.expires_in * 1000);
          timer = setTimeout(() => void poll(), 1500);
        })
        .catch((cause: unknown) => {
          if (current())
            error.value = cause instanceof Error ? cause.message : "";
        });
    }, 0);
    onCleanup(() => {
      stopped = true;
      controller.abort();
      clearTimeout(start);
      clearTimeout(timer);
      clearTimeout(expiry);
      submitCode = () => {};
      if (sessionId) cancel(sessionId);
    });
  },
  { immediate: true },
);
onScopeDispose(stop);
const verificationRequired = computed(
  () => session.value?.status === "verification_required",
);
const ended = computed(
  () =>
    session.value?.status === "expired" ||
    session.value?.status === "failed" ||
    error.value !== null,
);
const scanned = computed(
  () =>
    session.value?.status === "scanned" ||
    session.value?.status === "confirmed",
);
const title = computed(() =>
  ended.value
    ? session.value?.status === "expired"
      ? text.value.expiredTitle
      : text.value.failedTitle
    : verificationRequired.value
      ? text.value.verifyTitle
      : scanned.value
        ? text.value.scannedTitle
        : session.value
          ? text.value.waiting
          : text.value.loading,
);
const description = computed(
  () =>
    (error.value === "" ? null : error.value) ??
    (session.value?.error ? text.value[session.value.error] : null) ??
    (verificationRequired.value ? text.value.verifyDescription : null) ??
    (session.value?.status === "expired"
      ? text.value.expired
      : session.value?.status === "failed" || error.value !== null
        ? text.value.failed
        : session.value?.status === "scanned"
          ? text.value.scanned
          : session.value?.status === "confirmed"
            ? text.value.confirmed
            : text.value.scan),
);
// Keep SVG rendering native to Vue; the library only encodes the QR matrix.
const qr = computed(() => {
  if (!session.value?.qrcode_content) return null;
  const matrix = qrcode(0, "M");
  matrix.addData(session.value.qrcode_content, "Byte");
  matrix.make();
  const count = matrix.getModuleCount();
  let path = "";
  for (let row = 0; row < count; row++)
    for (let col = 0; col < count; col++)
      if (matrix.isDark(row, col)) path += `M${col + 4},${row + 4}h1v1h-1z`;
  return { size: count + 8, path };
});
function updateCode(value: string | number) {
  verifyCode.value = String(value).replace(/[^0-9]/g, "");
}
</script>

<template>
  <div class="flex min-h-[328px] flex-col items-center gap-4">
    <div
      class="relative flex size-[232px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white p-3 shadow-xs"
    >
      <svg
        v-if="qr && session && !ended && !scanned && !verificationRequired"
        width="208"
        height="208"
        :viewBox="`0 0 ${qr.size} ${qr.size}`"
        role="img"
        :aria-label="text.imageTitle"
        shape-rendering="crispEdges"
      >
        <title>{{ text.imageTitle }}</title>
        <rect width="100%" height="100%" fill="#fff" />
        <path :d="qr.path" fill="#000" />
      </svg>
      <div
        v-else-if="ended"
        class="flex h-full w-full flex-col items-center justify-center gap-4 rounded-lg bg-neutral-50 text-neutral-600"
      >
        <CircleAlert class="size-8 stroke-[1.5]" aria-hidden="true" /><Button
          type="button"
          variant="outline"
          class="bg-white text-neutral-900"
          @click="attempt++"
          ><RefreshCw />{{ text.retry }}</Button
        >
      </div>
      <div
        v-else-if="verificationRequired"
        class="flex w-full flex-col gap-3 text-neutral-900"
      >
        <Smartphone class="mx-auto size-8 text-emerald-600" /><label
          for="wechat-pairing-code"
          class="text-center text-sm font-medium"
          >{{ text.verifyLabel }}</label
        ><Input
          id="wechat-pairing-code"
          inputmode="numeric"
          autocomplete="one-time-code"
          :maxlength="16"
          :model-value="verifyCode"
          :disabled="verifying"
          class="text-center font-mono tracking-widest"
          @update:model-value="updateCode"
          @keydown.enter.prevent="submitCode(verifyCode)"
        /><Button
          type="button"
          :disabled="!verifyCode || verifying"
          @click="submitCode(verifyCode)"
          >{{ verifying ? text.verifying : text.verifySubmit }}</Button
        >
      </div>
      <div
        v-else-if="scanned"
        class="flex flex-col items-center gap-3 text-emerald-600"
      >
        <div class="relative rounded-full bg-emerald-50 p-5">
          <Smartphone class="size-10 stroke-[1.5]" /><span
            class="absolute -right-1 bottom-0 rounded-full bg-emerald-600 p-1 text-white"
            ><Check class="size-4"
          /></span>
        </div>
      </div>
      <LoaderCircle
        v-else-if="!session"
        class="size-6 animate-spin text-neutral-400"
        :aria-label="text.loading"
      />
    </div>
    <div
      role="status"
      aria-live="polite"
      class="w-full space-y-1.5 text-center"
    >
      <p class="flex items-center justify-center gap-2 text-sm font-medium">
        <span
          v-if="session && !ended"
          class="size-1.5 rounded-full bg-emerald-500"
          aria-hidden="true"
        />{{ title }}
      </p>
      <p
        class="text-muted-foreground mx-auto max-w-[300px] text-xs leading-relaxed break-words"
      >
        {{ description }}
      </p>
      <p v-if="!ended" class="text-muted-foreground text-xs">
        {{ text.autoSave }}
      </p>
    </div>
  </div>
</template>
