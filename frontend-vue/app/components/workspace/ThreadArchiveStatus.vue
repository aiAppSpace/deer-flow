<!--
  【文件职责】     会话页头部的「已归档」状态条与恢复键。
  【架构位置】     L3 product UI
  【主要导出】     默认 ThreadArchiveStatus 组件
  【依赖关系】     composables/useThreadArchiveAction · core/threads/utils
  【边界与注意】   **未归档时整块不渲染**——不是隐藏，是不存在：留一个空容器会在
                   头部留出间距，也会让读屏器多念一层无内容的分组。

                   文字在窄屏隐藏、图标保留，所以恢复键**必须有 aria-label**：
                   窄屏下它是一颗纯图标按钮。
-->
<script setup lang="ts">
import { ArchiveRestore } from "lucide-vue-next";
import { computed } from "vue";

import { Button } from "@/components/ui/button";
import { useThreadArchiveAction } from "@/composables/useThreadArchiveAction";
import { isThreadArchived } from "@/core/threads/utils";

const props = defineProps<{
  threadId: string;
  metadata?: Record<string, unknown> | null;
}>();

const { $i18n } = useNuxtApp();
const { setArchived, isPending } = useThreadArchiveAction();

const archived = computed(() =>
  isThreadArchived({ metadata: props.metadata ?? {} } as Parameters<
    typeof isThreadArchived
  >[0]),
);
</script>

<template>
  <div
    v-if="archived"
    class="flex shrink-0 items-center gap-1 text-xs"
    :title="$i18n.t.value.chats.archiveDescription"
  >
    <span class="text-muted-foreground hidden sm:inline">
      {{ $i18n.t.value.chats.archivedChats }}
    </span>
    <Button
      size="sm"
      variant="ghost"
      :disabled="isPending"
      :aria-label="$i18n.t.value.chats.restoreChat"
      @click="setArchived(props.threadId, false)"
    >
      <ArchiveRestore class="size-4" />
      <span class="hidden sm:inline">{{
        $i18n.t.value.chats.restoreChat
      }}</span>
    </Button>
  </div>
</template>
