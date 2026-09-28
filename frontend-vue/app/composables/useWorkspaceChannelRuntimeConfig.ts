import { computed, shallowRef } from "vue";

import type { ChannelProvider } from "@/core/channels/types";

const provider = shallowRef<ChannelProvider | null>(null);

export function useWorkspaceChannelRuntimeConfig() {
  return {
    provider: computed(() => provider.value),
    open(nextProvider: ChannelProvider) {
      provider.value = nextProvider;
    },
    close() {
      provider.value = null;
    },
  };
}
