import { computed, shallowRef } from "vue";

import type { ChannelProvider } from "@/core/channels/types";

const initialStep = shallowRef<"setup" | "binding">("setup");
const provider = shallowRef<ChannelProvider | null>(null);

export function useWorkspaceChannelRuntimeConfig() {
  return {
    provider: computed(() => provider.value),
    initialStep: computed(() => initialStep.value),
    open(nextProvider: ChannelProvider, step: "setup" | "binding" = "setup") {
      initialStep.value = step;
      provider.value = nextProvider;
    },
    close() {
      provider.value = null;
    },
  };
}
