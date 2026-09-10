<!--
  【文件职责】     会话头部的「批次」入口与抽屉。
  【架构位置】     L4 产品组件
  【主要导出】     默认 ThreadSubagentBatches 组件
  【依赖关系】     composables/useSubagentBatches · composables/useWorkspaceFeatures · ui/sheet · ui/button
  【边界与注意】   出不出现由**两个独立能力**共同决定，不是一个布尔：

                   - 没有存储（repositoryAvailable=false）→ 整块不渲染，
                     连历史批次都没地方读。
                   - 有存储但 worker 停了 → **照样渲染**，顶部挂一条说明，
                     控制键禁用。用户昨天跑的那批结果不该因为 worker 停了就消失。
                   - worker 停了**而且**一条历史批次都没有 → 不渲染：
                     一个空抽屉加一句「worker 没跑」对用户没有用。
                     所以还要看 loading/error/长度——加载中和出错时都先画出来，
                     否则用户会以为这个功能不存在。

                   worker 没跑时也**不轮询**：批次不会自己前进，问也是白问。
-->

<script setup lang="ts">
import { computed } from "vue";
import { Archive, Layers3, LoaderCircle } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import SubagentBatchCard from "@/components/workspace/subagent-batches/SubagentBatchCard.vue";
import {
  useControlSubagentBatch,
  useSubagentBatches,
} from "@/composables/useSubagentBatches";
import { useSubagentBatchesCapability } from "@/composables/useWorkspaceFeatures";
import { isActiveSubagentBatch } from "@/core/subagent-batches";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{ threadId: string }>();

const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const { capability } = useSubagentBatchesCapability();

const repositoryAvailable = computed(
  () => capability.value.repositoryAvailable,
);
const workerRunning = computed(() => capability.value.workerRunning);

const batchesQuery = useSubagentBatches(() => props.threadId, {
  enabled: repositoryAvailable,
  polling: workerRunning,
});
const control = useControlSubagentBatch(() => props.threadId, {
  onError: (error) => toast.error(error.message),
});

const batches = computed(() => batchesQuery.data.value ?? []);
const activeCount = computed(
  () => batches.value.filter(isActiveSubagentBatch).length,
);
const hasVisibleSurface = computed(
  () =>
    repositoryAvailable.value &&
    (workerRunning.value ||
      batchesQuery.isLoading.value ||
      batchesQuery.isError.value ||
      batches.value.length > 0),
);
</script>

<template>
  <Sheet v-if="hasVisibleSurface">
    <SheetTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="relative"
        :aria-label="$i18n.t.value.subagentBatches.label"
        data-testid="subagent-batches-trigger"
      >
        <Layers3 />
        <span class="hidden xl:inline">
          {{ $i18n.t.value.subagentBatches.label }}
        </span>
        <span
          v-if="activeCount > 0"
          class="bg-primary text-primary-foreground grid size-4 place-items-center rounded-full text-[10px] font-semibold"
        >
          {{ activeCount > 9 ? "9+" : activeCount }}
        </span>
      </Button>
    </SheetTrigger>
    <SheetContent
      class="w-[min(94vw,520px)] gap-0 p-0 sm:max-w-[520px]"
      :close-label="$i18n.t.value.primitives.close"
    >
      <SheetHeader class="border-border border-b px-5 py-4">
        <SheetTitle class="flex items-center gap-2">
          <Layers3 class="size-4" />
          {{ $i18n.t.value.subagentBatches.title }}
        </SheetTitle>
        <SheetDescription>
          {{ $i18n.t.value.subagentBatches.description }}
        </SheetDescription>
      </SheetHeader>
      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div
          v-if="!workerRunning"
          role="status"
          class="border-border bg-muted/50 text-muted-foreground mb-4 rounded-xl border p-3 text-xs"
        >
          {{ $i18n.t.value.subagentBatches.workerUnavailable }}
        </div>
        <div
          v-if="batchesQuery.isLoading.value"
          class="text-muted-foreground flex justify-center gap-2 py-12 text-sm"
        >
          <LoaderCircle class="size-4 animate-spin" />
          {{ $i18n.t.value.common.loading }}
        </div>
        <div
          v-else-if="batchesQuery.isError.value"
          class="border-destructive/30 bg-destructive/5 rounded-xl border p-4 text-sm"
        >
          <p class="text-destructive font-medium">
            {{ $i18n.t.value.subagentBatches.loadFailed }}
          </p>
          <p class="text-muted-foreground mt-1 text-xs">
            {{ batchesQuery.error.value?.message }}
          </p>
        </div>
        <div
          v-else-if="batches.length === 0"
          class="text-muted-foreground flex flex-col items-center px-6 py-14 text-center"
        >
          <Archive class="mb-3 size-8 opacity-40" />
          <p class="text-foreground text-sm font-medium">
            {{ $i18n.t.value.subagentBatches.empty }}
          </p>
          <p class="mt-1 text-xs">
            {{ $i18n.t.value.subagentBatches.emptyHint }}
          </p>
        </div>
        <div v-else class="space-y-3">
          <SubagentBatchCard
            v-for="batch in batches"
            :key="batch.id"
            :thread-id="threadId"
            :batch="batch"
            :worker-running="workerRunning"
            :controlling="
              control.isPending.value &&
              control.variables.value?.batchId === batch.id
            "
            @control="control.mutate({ batchId: batch.id, action: $event })"
          />
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
