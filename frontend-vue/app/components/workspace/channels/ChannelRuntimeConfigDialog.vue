<script setup lang="ts">
import { KeyRound, LoaderCircle, QrCode, ShieldCheck } from "lucide-vue-next";
import { computed, onScopeDispose, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { channelProviderName } from "@/core/channels/provider-state";
import type {
  ChannelProvider,
  ChannelRuntimeConfigValues,
} from "@/core/channels/types";
import ChannelProviderIcon from "./ChannelProviderIcon.vue";
import WechatQRLogin from "./WechatQRLogin.vue";
import WechatQRCompletion, {
  type PendingWechatBinding,
} from "./WechatQRCompletion.vue";

const props = withDefaults(
  defineProps<{
    provider: ChannelProvider | null;
    open: boolean;
    submitting: boolean;
    initialStep?: "setup" | "binding";
    submit?:
      | ((
          provider: ChannelProvider,
          values: ChannelRuntimeConfigValues,
        ) => void)
      | ((
          provider: ChannelProvider,
          values: ChannelRuntimeConfigValues,
        ) => Promise<ChannelProvider | undefined>);
    onConfigured?: (provider: ChannelProvider) => void;
  }>(),
  { initialStep: "setup", submit: undefined, onConfigured: undefined },
);
const emit = defineEmits<{
  "update:open": [open: boolean];
  submit: [provider: ChannelProvider, values: ChannelRuntimeConfigValues];
}>();
const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels);
const values = ref<ChannelRuntimeConfigValues>({});
const fields = computed(() => props.provider?.credential_fields ?? []);
const isEditing = computed(() => props.provider?.configured ?? false);
const step = ref<"setup" | null>(null);
const method = ref<"qr" | "token" | null>(null);
const configuredProvider = ref<ChannelProvider | null>(null);
const pendingBinding = ref<PendingWechatBinding | null>(null);
let generation = 0;
watch(
  () => [props.open, props.provider?.provider, props.initialStep],
  () => {
    generation++;
    step.value = null;
    method.value = null;
    configuredProvider.value = null;
    pendingBinding.value = null;
  },
  { immediate: true, flush: "sync" },
);
watch(
  () => [props.open, props.provider] as const,
  ([open, provider]) => {
    values.value =
      open && provider
        ? Object.fromEntries(
            (provider.credential_fields ?? []).map((field) => [
              field.name,
              provider.credential_values?.[field.name] ?? "",
            ]),
          )
        : {};
  },
  { immediate: true },
);
onScopeDispose(() => {
  generation++;
  values.value = {};
});
const hasWechatQR = computed(
  () => props.provider?.provider === "wechat" && !!props.onConfigured,
);
const selectedMethod = computed(
  () => method.value ?? (isEditing.value ? "token" : "qr"),
);
const completionProvider = computed(
  () =>
    configuredProvider.value ??
    (step.value === null &&
    props.initialStep === "binding" &&
    props.provider?.configured
      ? props.provider
      : null),
);
const showQR = computed(
  () =>
    hasWechatQR.value &&
    !completionProvider.value &&
    selectedMethod.value === "qr",
);
function changeOpen(open: boolean) {
  if (!open) generation++;
  emit("update:open", open);
}
async function onSubmit() {
  if (
    !props.provider ||
    props.submitting ||
    !props.open ||
    showQR.value ||
    completionProvider.value
  )
    return;
  const captured = generation;
  if (props.submit) {
    const updated = await props.submit(props.provider, { ...values.value });
    if (updated && hasWechatQR.value && captured === generation)
      configuredProvider.value = updated;
  } else emit("submit", props.provider, { ...values.value });
}
function restart(binding: PendingWechatBinding | null) {
  pendingBinding.value = binding;
  step.value = "setup";
  method.value = "qr";
  configuredProvider.value = null;
}
function fieldId(name: string) {
  return `channel-${props.provider?.provider}-${name}`;
}
</script>

<template>
  <Dialog :open="open" @update:open="changeOpen">
    <DialogContent
      v-if="provider"
      :close-label="$i18n.t.value.primitives.close"
      :class="
        hasWechatQR
          ? 'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl sm:max-w-[440px]'
          : undefined
      "
    >
      <form
        :class="['space-y-4', hasWechatQR && 'space-y-5']"
        @submit.prevent="onSubmit"
      >
        <div :class="hasWechatQR ? 'flex items-center gap-3 pr-4' : undefined">
          <div
            v-if="hasWechatQR"
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10"
          >
            <ChannelProviderIcon provider="wechat" size="size-7" />
          </div>
          <DialogHeader :class="hasWechatQR ? 'gap-1 text-left' : undefined"
            ><DialogTitle>{{
              isEditing && !completionProvider
                ? text.setupEditTitle(
                    channelProviderName(provider, $i18n.t.value),
                  )
                : text.setupTitle(channelProviderName(provider, $i18n.t.value))
            }}</DialogTitle
            ><DialogDescription
              :class="hasWechatQR ? 'text-xs leading-relaxed' : undefined"
              >{{
                hasWechatQR ? text.wechatQr.description : text.setupDescription
              }}</DialogDescription
            ></DialogHeader
          >
        </div>
        <WechatQRCompletion
          v-if="hasWechatQR && completionProvider && open"
          :provider="completionProvider"
          :binding-to-resume="pendingBinding"
          @done="onConfigured?.(completionProvider)"
          @restart="restart"
        />
        <Tabs
          v-else-if="hasWechatQR"
          :model-value="selectedMethod"
          class="gap-0"
          @update:model-value="
            (value) => {
              if (value === 'qr' || value === 'token') method = value;
            }
          "
          ><TabsList
            :aria-label="text.wechatQr.methodLabel"
            class="grid w-full grid-cols-2"
            ><TabsTrigger value="qr" :disabled="submitting"
              ><QrCode />{{ text.wechatQr.login }}</TabsTrigger
            ><TabsTrigger value="token" :disabled="submitting"
              ><KeyRound />{{ text.wechatQr.manual }}</TabsTrigger
            ></TabsList
          ><TabsContent value="qr" class="pt-5"
            ><WechatQRLogin
              v-if="showQR && open"
              @configured="configuredProvider = $event" /></TabsContent
          ><TabsContent value="token" class="pt-5"
            ><div class="flex min-h-[328px] flex-col justify-center gap-6 pb-5">
              <div class="space-y-2">
                <h3 class="text-sm font-medium">
                  {{ text.wechatQr.tokenTitle }}
                </h3>
                <p class="text-muted-foreground text-sm leading-relaxed">
                  {{ text.wechatQr.tokenDescription }}
                </p>
              </div>
              <div class="space-y-4">
                <div
                  v-for="field in fields"
                  :key="field.name"
                  class="space-y-2"
                >
                  <label
                    :for="fieldId(field.name)"
                    class="text-sm leading-none font-medium"
                    >{{ field.label }}</label
                  ><Input
                    :id="fieldId(field.name)"
                    v-model="values[field.name]"
                    type="text"
                    :required="field.required"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="none"
                    :spellcheck="false"
                    class="h-11 rounded-lg"
                    :placeholder="text.wechatQr.tokenPlaceholder"
                    :data-1p-ignore="
                      field.type === 'password' ? 'true' : undefined
                    "
                    :data-bwignore="
                      field.type === 'password' ? 'true' : undefined
                    "
                    :data-form-type="
                      field.type === 'password' ? 'other' : undefined
                    "
                    :data-lpignore="
                      field.type === 'password' ? 'true' : undefined
                    "
                    :style="
                      field.type === 'password'
                        ? { WebkitTextSecurity: 'disc' }
                        : undefined
                    "
                  />
                </div>
              </div>
              <p class="text-muted-foreground text-xs leading-relaxed">
                {{ text.wechatQr.tokenHint }}
              </p>
            </div></TabsContent
          ></Tabs
        >
        <div v-else class="space-y-4">
          <div v-for="field in fields" :key="field.name" class="space-y-2">
            <label
              :for="fieldId(field.name)"
              class="text-sm leading-none font-medium"
              >{{ field.label }}</label
            ><Input
              :id="fieldId(field.name)"
              v-model="values[field.name]"
              type="text"
              :required="field.required"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="none"
              :spellcheck="false"
              :data-1p-ignore="field.type === 'password' ? 'true' : undefined"
              :data-bwignore="field.type === 'password' ? 'true' : undefined"
              :data-form-type="field.type === 'password' ? 'other' : undefined"
              :data-lpignore="field.type === 'password' ? 'true' : undefined"
              :style="
                field.type === 'password'
                  ? { WebkitTextSecurity: 'disc' }
                  : undefined
              "
            />
          </div>
        </div>
        <p
          v-if="hasWechatQR"
          class="text-muted-foreground flex items-center justify-center gap-1.5 text-xs"
        >
          <ShieldCheck class="size-3.5" />{{ text.wechatQr.privacy }}
        </p>
        <DialogFooter
          v-if="!completionProvider"
          :class="hasWechatQR ? 'border-t pt-4' : undefined"
          ><Button
            type="button"
            variant="outline"
            :disabled="submitting"
            @click="changeOpen(false)"
            >{{ $i18n.t.value.common.cancel }}</Button
          ><Button v-if="!showQR" type="submit" :disabled="submitting"
            ><LoaderCircle v-if="submitting" class="animate-spin" />{{
              isEditing ? text.saveChanges : text.saveAndConnect
            }}</Button
          ></DialogFooter
        >
      </form>
    </DialogContent>
  </Dialog>
</template>
