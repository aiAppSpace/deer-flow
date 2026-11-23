<!--
  【文件职责】     单条引用的复制、成功状态和重置计时器。
  【架构位置】     L3 message UI adapter
  【主要导出】     CitationSourceCopyButton
  【依赖关系】     core/citations · core/clipboard · workspace toast
  【边界与注意】   同一来源再次成功复制会重置两秒期限；不同来源独立，卸载清理计时器。
-->
<script setup lang="ts">
import { Check, Copy } from "lucide-vue-next";
import { onUnmounted, ref } from "vue";
import {
  formatCitationMarkdownReference,
  type CitationSource,
} from "@/core/citations/sources";
import { writeTextToClipboard } from "@/core/clipboard";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{ source: CitationSource }>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const copied = ref(false);
let active = true;
let resetTimer: ReturnType<typeof setTimeout> | undefined;

async function copySource() {
  try {
    const didCopy = await writeTextToClipboard(
      formatCitationMarkdownReference(props.source),
    );
    if (!active) return;
    if (!didCopy) {
      toast.error($i18n.t.value.clipboard.failedToCopyToClipboard);
      return;
    }
    copied.value = true;
    toast.success($i18n.t.value.clipboard.copiedToClipboard);
    if (resetTimer !== undefined) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied.value = false;
      resetTimer = undefined;
    }, 2000);
  } catch {
    if (!active) return;
    toast.error($i18n.t.value.clipboard.failedToCopyToClipboard);
  }
}
onUnmounted(() => {
  active = false;
  if (resetTimer !== undefined) clearTimeout(resetTimer);
});
</script>

<template>
  <button
    type="button"
    class="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded p-1.5 transition-colors"
    :aria-label="
      copied
        ? $i18n.t.value.citations.copiedReference(source.title)
        : $i18n.t.value.citations.copyReference(source.title)
    "
    :title="
      copied
        ? $i18n.t.value.citations.copiedReference(source.title)
        : $i18n.t.value.citations.copyReference(source.title)
    "
    :data-copied-label="$i18n.t.value.citations.copiedReference(source.title)"
    @click="copySource"
  >
    <Check v-if="copied" class="size-3.5 text-green-500" />
    <Copy v-else class="size-3.5" />
  </button>
</template>
