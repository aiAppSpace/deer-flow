<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ReasoningContent } from "@/components/ui/reasoning";
import Shimmer from "@/components/ui/effects/Shimmer.vue";
import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import RunDurationLabel from "@/components/chat/RunDurationLabel.vue";

const props = defineProps<{
  content: string;
  streaming: boolean;
  durationSeconds?: number;
  tokenLabel?: string | null;
  markdownComponents?: Record<string, unknown>;
}>();
const { $i18n } = useNuxtApp();
const open = ref(props.streaming);
let hasStreamed = props.streaming;
let timer: ReturnType<typeof setTimeout> | undefined;
function clearTimer() {
  clearTimeout(timer);
  timer = undefined;
}
watch(
  () => props.streaming,
  (streaming) => {
    clearTimer();
    if (streaming) {
      hasStreamed = true;
      open.value = true;
    } else if (hasStreamed) {
      timer = setTimeout(() => {
        open.value = false;
      }, 1000);
    }
  },
);
onBeforeUnmount(clearTimer);
</script>
<template>
  <Collapsible
    v-model:open="open"
    class="not-prose border-border/60 mb-3 border-b pb-3"
  >
    <CollapsibleTrigger
      class="group/reasoning text-muted-foreground hover:text-foreground flex w-fit cursor-pointer items-center gap-1.5 rounded-sm text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <template v-if="!streaming && durationSeconds !== undefined">
        <RunDurationLabel :duration-seconds="durationSeconds" />
        <span class="sr-only">{{
          " " + $i18n.t.value.runDuration.reasoning
        }}</span>
      </template>
      <Shimmer
        v-else-if="streaming"
        :text="$i18n.t.value.runDuration.reasoning"
        :duration="1"
      />
      <span v-else>{{ $i18n.t.value.runDuration.reasoning }}</span>
      <span v-if="tokenLabel" class="font-mono text-[11px]">{{
        tokenLabel
      }}</span>
      <ChevronRight
        class="size-4 transition-transform group-data-[state=open]/reasoning:rotate-90"
      />
    </CollapsibleTrigger>
    <ReasoningContent>
      <MessageMarkdown
        :content="content"
        :components="markdownComponents"
        :streaming="streaming"
      />
    </ReasoningContent>
  </Collapsible>
</template>
