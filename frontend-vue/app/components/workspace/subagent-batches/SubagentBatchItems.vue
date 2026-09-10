<!--
  【文件职责】     一个批次展开后的条目列表，带分页加载。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/button · composables/useSubagentBatches · SubagentBatchItemRow
  【边界与注意】   分页是**显式**的：一批可能上千条，自动无限滚动会让这个抽屉
                   在用户还没看第一屏时就把整批拉下来。轮询与分页的关系写在
                   composable 的文件头里（第一页才轮询）。
-->

<script setup lang="ts">
import { computed } from "vue";
import { LoaderCircle } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  useRetrySubagentBatchItem,
  useSubagentBatchItems,
} from "@/composables/useSubagentBatches";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import SubagentBatchItemRow from "./SubagentBatchItemRow.vue";

const props = defineProps<{
  threadId: string;
  batchId: string;
  workerRunning: boolean;
}>();

const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();

const query = useSubagentBatchItems(
  () => props.threadId,
  () => props.batchId,
  { polling: () => props.workerRunning },
);
const retry = useRetrySubagentBatchItem(
  () => props.threadId,
  () => props.batchId,
  { onError: (error) => toast.error(error.message) },
);

const items = computed(() => query.data.value?.pages.flat() ?? []);
</script>

<template>
  <div
    v-if="query.isLoading.value"
    class="text-muted-foreground mt-3 border-t pt-3 text-xs"
  >
    {{ $i18n.t.value.common.loading }}
  </div>
  <div
    v-else-if="query.isError.value"
    class="text-destructive mt-3 border-t pt-3 text-xs"
  >
    {{ $i18n.t.value.subagentBatches.itemsFailed }}:
    {{ query.error.value?.message }}
  </div>
  <div
    v-else
    class="border-border mt-3 max-h-72 space-y-2 overflow-y-auto border-t pt-3"
  >
    <SubagentBatchItemRow
      v-for="item in items"
      :key="item.id"
      :item="item"
      :worker-running="workerRunning"
      :retrying="retry.isPending.value && retry.variables.value === item.id"
      @retry="retry.mutate(item.id)"
    />
    <Button
      v-if="query.hasNextPage.value"
      size="sm"
      variant="outline"
      class="w-full"
      :disabled="query.isFetchingNextPage.value"
      @click="query.fetchNextPage()"
    >
      <LoaderCircle
        v-if="query.isFetchingNextPage.value"
        class="animate-spin"
      />
      {{ $i18n.t.value.common.loadMore }}
    </Button>
  </div>
</template>
