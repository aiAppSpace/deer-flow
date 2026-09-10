<!--
  【文件职责】     批次里的一个条目：键名、状态、结果预览或错误、失败可重试。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/badge · ui/button
  【边界与注意】   重试键**只对 failed 出现**：其余状态要么还没跑完、要么已经成功，
                   重试没有意义。worker 没跑时它禁用而不是消失——控件时有时无，
                   读屏用户每次都要重新数一遍这一行有什么。
-->

<script setup lang="ts">
import { LoaderCircle, RotateCcw } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SubagentBatchItem } from "@/core/subagent-batches";

defineProps<{
  item: SubagentBatchItem;
  workerRunning: boolean;
  retrying: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();

const { $i18n } = useNuxtApp();
</script>

<template>
  <div class="bg-muted/40 rounded-lg p-2 text-xs">
    <div class="flex items-center justify-between gap-2">
      <span class="min-w-0 truncate font-medium" :title="item.item_key">
        {{ item.item_key }}
      </span>
      <Badge variant="outline">{{ item.status }}</Badge>
    </div>
    <p v-if="item.result_preview" class="mt-1 line-clamp-3 whitespace-pre-wrap">
      {{ item.result_preview }}
    </p>
    <p v-if="item.error" class="text-destructive mt-1 break-words">
      {{ item.error }}
    </p>
    <Button
      v-if="item.status === 'failed'"
      size="sm"
      variant="ghost"
      class="mt-1"
      :disabled="!workerRunning || retrying"
      @click="emit('retry')"
    >
      <LoaderCircle v-if="retrying" class="animate-spin" />
      <RotateCcw v-else />
      {{ $i18n.t.value.subagentBatches.retryItem }}
    </Button>
  </div>
</template>
