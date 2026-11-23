<script setup lang="ts">
import { computed } from "vue";
import { Clock3, Puzzle } from "lucide-vue-next";
import ChannelProviderIcon from "@/components/workspace/channels/ChannelProviderIcon.vue";
import { labelOfThreadOrigin, type ThreadOrigin } from "@/core/threads/origin";

const props = defineProps<{ origin: ThreadOrigin | null }>();
const { $i18n } = useNuxtApp();
const label = computed(() => labelOfThreadOrigin(props.origin, $i18n.t.value));
</script>

<template>
  <span
    v-if="origin && label"
    role="img"
    :aria-label="label"
    :title="label"
    :data-origin-kind="origin.kind"
    data-testid="thread-origin-icon"
    class="inline-flex shrink-0 items-center"
  >
    <Clock3
      v-if="origin.kind === 'schedule'"
      aria-hidden="true"
      class="size-4"
    />
    <Puzzle
      v-else-if="origin.kind === 'extension'"
      aria-hidden="true"
      class="size-4"
    />
    <ChannelProviderIcon
      v-else-if="origin.kind === 'im_channel' || origin.kind === 'github'"
      :provider="origin.provider"
      size="size-4"
    />
  </span>
</template>
