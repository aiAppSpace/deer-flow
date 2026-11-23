<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { FileText, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useMaybeMessageDetails } from "./context";
const { $i18n } = useNuxtApp();
const details = useMaybeMessageDetails();
const heading = ref<HTMLHeadingElement | null>(null);
watch(
  [() => details?.open.value, () => details?.selectedDetail.value],
  async () => {
    await nextTick();
    if (details?.open.value && details.selectedDetail.value)
      heading.value?.focus({ preventScroll: true });
  },
  { immediate: true },
);
function keydown(event: KeyboardEvent) {
  if (event.key === "Escape" && !event.defaultPrevented) {
    event.preventDefault();
    event.stopPropagation();
    details?.close();
  }
}
</script>
<template>
  <section
    v-if="details?.open.value && details.selectedDetail.value"
    class="bg-background flex h-full min-h-0 flex-col"
    :aria-label="details.selectedDetail.value.title"
    @keydown="keydown"
  >
    <header
      class="flex shrink-0 flex-wrap items-center gap-2 border-b px-5 py-3"
    >
      <div class="flex max-w-full min-w-0 flex-auto items-center gap-2">
        <FileText class="text-muted-foreground size-4" />
        <h2
          ref="heading"
          tabindex="-1"
          class="min-w-0 flex-1 truncate text-sm font-medium outline-none"
        >
          {{ details.selectedDetail.value.title }}
        </h2>
      </div>
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <component
          :is="details.selectedDetail.value.actions"
          v-if="details.selectedDetail.value.actions"
          v-bind="details.selectedDetail.value.actionProps"
        /><Button
          size="icon-sm"
          variant="ghost"
          :aria-label="$i18n.t.value.common.close"
          :title="$i18n.t.value.common.close"
          @click="details.close()"
          ><X class="size-4"
        /></Button>
      </div>
    </header>
    <div
      :key="details.selectedDetail.value.id"
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <component
        :is="details.selectedDetail.value.content"
        v-bind="details.selectedDetail.value.props"
      />
    </div>
  </section>
</template>
