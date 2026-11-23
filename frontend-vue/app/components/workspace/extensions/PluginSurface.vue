<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import type { PluginSurface } from "@/core/extensions/contracts";
import type { LoadedContribution } from "@/core/extensions/registry";
import {
  bindFrontendServices,
  openConversation,
} from "@/core/extensions/services";
import { mountSurface } from "@/core/extensions/surfaces";
import {
  useExtensionOwner,
  useFrontendServices,
} from "@/composables/useFrontendExtensions";
import { useCapabilityUser } from "@/composables/useCapabilities";

const props = defineProps<{
  entry: LoadedContribution;
  surface: PluginSurface;
  threadId?: string;
}>();
const { $i18n } = useNuxtApp();
const router = useRouter();
const user = useCapabilityUser();
const services = useFrontendServices();
const container = ref<HTMLElement>();
const failed = ref(false);
const scope = computed(() => [
  props.entry,
  props.surface,
  props.threadId,
  $i18n.locale.value,
  user.value?.id,
]);
const owner = useExtensionOwner(scope);
let cleanup: (() => void) | undefined;
watch(
  [scope, container],
  () => {
    cleanup?.();
    cleanup = undefined;
    failed.value = false;
    if (!container.value || props.entry.viewer_id !== user.value?.id) return;
    const current = owner.capture();
    const abort = new AbortController();
    const cancel = () => abort.abort();
    current.signal.addEventListener("abort", cancel, { once: true });
    const dispose = mountSurface(
      container.value,
      props.surface,
      {
        namespace: props.entry.namespace,
        locale: $i18n.locale.value,
        settings: props.entry.settings,
        threadId: props.threadId,
        callBackend: bindFrontendServices(
          services,
          props.entry,
          abort.signal,
          current.isCurrent,
        ).callBackend,
        openConversation: async (id, signal) => {
          current.assertCurrent();
          await openConversation(
            id,
            (path) => {
              current.assertCurrent();
              void router.push(path);
            },
            signal,
          );
        },
      },
      () => {
        if (current.isCurrent()) failed.value = true;
      },
    );
    cleanup = () => {
      abort.abort();
      current.signal.removeEventListener("abort", cancel);
      dispose();
    };
  },
  { immediate: true, flush: "post" },
);
onScopeDispose(() => cleanup?.());
</script>

<template>
  <section :aria-label="surface.title">
    <p v-if="failed" role="alert">{{ $i18n.t.value.extensions.viewFailed }}</p>
    <div ref="container" />
  </section>
</template>
