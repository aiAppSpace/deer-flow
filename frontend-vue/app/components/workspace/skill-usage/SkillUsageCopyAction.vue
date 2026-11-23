<script setup lang="ts">
import { onScopeDispose } from "vue";
import { Copy } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { writeTextToClipboard } from "@/core/clipboard";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
const props = defineProps<{ content: string }>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
let disposed = false;
onScopeDispose(() => {
  disposed = true;
});
async function copy() {
  const copied = await writeTextToClipboard(props.content);
  if (disposed) return;
  if (copied) toast.success($i18n.t.value.clipboard.copiedToClipboard);
  else toast.error($i18n.t.value.clipboard.failedToCopyToClipboard);
}
</script>
<template>
  <Button
    size="icon-sm"
    variant="ghost"
    :aria-label="$i18n.t.value.skillUsage.copy"
    :title="$i18n.t.value.skillUsage.copy"
    @click="copy"
    ><Copy class="size-4"
  /></Button>
</template>
