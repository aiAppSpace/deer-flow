<!--
  【文件职责】     一个 subagent 批次：标题、限额、进度、控制键、展开条目。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/badge · ui/button · ui/progress · core/subagent-batches · SubagentBatchItems
  【边界与注意】   暂停/恢复是**同一个位置上的两颗键**，按当前状态二选一：
                   排队中和运行中给「暂停」，已暂停给「恢复」，终态两颗都不给。
                   同时画出来会让人以为可以随便切。

                   控制键在 worker 没跑时**禁用而不是消失**：批次还在那儿，
                   只是现在推不动它。消失的话用户会以为这批出问题了。

                   导出结果不受 worker 影响：那是读已经落盘的结果，
                   worker 停着照样能下。
-->

<script setup lang="ts">
import { computed, ref } from "vue";
import { CirclePause, CirclePlay, CircleStop, Download } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  completedSubagentBatchItems,
  isActiveSubagentBatch,
  subagentBatchProgress,
  subagentBatchResultsUrl,
  type SubagentBatch,
  type SubagentBatchAction,
} from "@/core/subagent-batches";
import SubagentBatchItems from "./SubagentBatchItems.vue";

const props = defineProps<{
  threadId: string;
  batch: SubagentBatch;
  workerRunning: boolean;
  /** 这一批的控制请求还没回来。 */
  controlling: boolean;
}>();
const emit = defineEmits<{ control: [action: SubagentBatchAction] }>();

const { $i18n } = useNuxtApp();
const labels = computed(() => $i18n.t.value.subagentBatches);

const open = ref(false);
const completed = computed(() => completedSubagentBatchItems(props.batch));
const active = computed(() => isActiveSubagentBatch(props.batch));
const progress = computed(() => subagentBatchProgress(props.batch));
const pausable = computed(
  () => props.batch.status === "running" || props.batch.status === "queued",
);
const resumable = computed(() => props.batch.status === "paused");
const resultsUrl = computed(() =>
  subagentBatchResultsUrl(props.threadId, props.batch.id),
);
</script>

<template>
  <article
    class="border-border bg-card rounded-xl border p-3"
    :data-testid="`subagent-batch-${batch.id}`"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium" :title="batch.title">
          {{ batch.title }}
        </p>
        <p class="text-muted-foreground mt-1 text-xs">
          {{ batch.subagent_type }} ·
          {{ labels.limits(batch.max_live_items, batch.max_running_items) }}
        </p>
      </div>
      <Badge variant="outline">{{ labels.status[batch.status] }}</Badge>
    </div>
    <Progress class="mt-3 h-1.5" :model-value="progress" />
    <div
      class="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 text-[11px]"
    >
      <span>{{ labels.progress(completed, batch.total_items) }}</span>
      <span
        >{{ batch.counts.running }}
        {{ labels.status.running.toLowerCase() }}</span
      >
      <span v-if="batch.counts.failed > 0" class="text-destructive">
        {{ batch.counts.failed }} {{ labels.status.failed.toLowerCase() }}
      </span>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" @click="open = !open">
        {{ open ? labels.hideItems : labels.viewItems }}
      </Button>
      <Button
        v-if="pausable"
        size="sm"
        variant="outline"
        :disabled="!workerRunning || controlling"
        @click="emit('control', 'pause')"
      >
        <CirclePause /> {{ labels.pause }}
      </Button>
      <Button
        v-else-if="resumable"
        size="sm"
        variant="outline"
        :disabled="!workerRunning || controlling"
        @click="emit('control', 'resume')"
      >
        <CirclePlay /> {{ labels.resume }}
      </Button>
      <Button
        v-if="active"
        size="sm"
        variant="outline"
        :disabled="!workerRunning || controlling"
        @click="emit('control', 'cancel')"
      >
        <CircleStop /> {{ labels.cancel }}
      </Button>
      <!--
        导出走 `<a download>` 而不是按钮 + fetch：那份 JSONL 可能很大，
        交给浏览器直接下载比先读进内存再造 object URL 稳。
      -->
      <a
        :href="resultsUrl"
        download
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      >
        <Download /> {{ labels.exportResults }}
      </a>
    </div>
    <SubagentBatchItems
      v-if="open"
      :thread-id="threadId"
      :batch-id="batch.id"
      :worker-running="workerRunning"
    />
  </article>
</template>
