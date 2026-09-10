<!--
  【文件职责】     一个后台任务的详情：取消/通知的重试提示、结果、以及最近一次错误。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/button · core/background-tasks
  【边界与注意】   **每个字段都可能是任意 JSON**，所以一律走 `formatDetailValue`：
                   字符串原样、数字/布尔转字符串、其余 `JSON.stringify` 缩进两格，
                   序列化不了（循环引用）就整块不画。直接插值会得到 "[object Object]"。

                   通知重试和取消重试是**两条不同的提示**：任务本身可能早就结束了，
                   而把结果送回会话的那条通知还在退避重试。只报任务状态的话，用户
                   会停在「已完成但什么都没收到」，且看不出系统还在努力。

                   `input_required` 的那句说明是**能力边界**，不是错误：远端任务在等
                   回复，而这条集成还没有把回复送回去的通道。不说清楚，用户会一直
                   在这里找输入框。
-->

<script setup lang="ts">
import { LoaderCircle, TriangleAlert } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import type { BackgroundTaskDetail } from "@/core/background-tasks";

defineProps<{
  task: BackgroundTaskDetail | undefined;
  loading: boolean;
  error: Error | null;
}>();
const emit = defineEmits<{ retry: [] }>();

const { $i18n } = useNuxtApp();

function formatDetailValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2) ?? null;
  } catch {
    // 循环引用：宁可不画这一块，也不要让整个详情崩掉。
    return null;
  }
}
</script>

<template>
  <div
    v-if="loading"
    role="status"
    class="text-muted-foreground mt-3 flex items-center gap-2 border-t pt-3 text-xs"
  >
    <LoaderCircle class="size-3.5 animate-spin" />
    {{ $i18n.t.value.common.loading }}
  </div>
  <div
    v-else-if="error"
    class="border-destructive/30 mt-3 border-t pt-3 text-xs"
  >
    <p class="text-destructive">
      {{ $i18n.t.value.backgroundTasks.detailsFailed }}
    </p>
    <p class="text-muted-foreground mt-1 break-words">{{ error.message }}</p>
    <Button size="sm" variant="outline" class="mt-2" @click="emit('retry')">
      {{ $i18n.t.value.backgroundTasks.retry }}
    </Button>
  </div>
  <div v-else-if="task" class="border-border mt-3 space-y-3 border-t pt-3">
    <div
      v-if="task.last_cancel_error"
      class="flex gap-2 rounded-md bg-amber-500/10 px-2 py-2 text-xs text-amber-700 dark:text-amber-300"
    >
      <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
      <div class="min-w-0">
        <p class="font-medium">
          {{
            $i18n.t.value.backgroundTasks.cancellationRetrying(
              task.cancel_attempt_count,
            )
          }}
        </p>
        <p class="mt-1 break-words">{{ task.last_cancel_error }}</p>
      </div>
    </div>
    <div
      v-if="task.notification_error"
      class="flex gap-2 rounded-md bg-amber-500/10 px-2 py-2 text-xs text-amber-700 dark:text-amber-300"
    >
      <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
      <div class="min-w-0">
        <p class="font-medium">
          {{
            task.notification_status === "dead_letter"
              ? $i18n.t.value.backgroundTasks.notificationStopped
              : $i18n.t.value.backgroundTasks.notificationRetrying(
                  task.notification_attempt_count,
                )
          }}
        </p>
        <p class="mt-1 break-words">{{ task.notification_error }}</p>
      </div>
    </div>
    <div
      v-for="field in [
        {
          label: $i18n.t.value.backgroundTasks.result,
          value: formatDetailValue(task.result_preview ?? task.result),
        },
        {
          label: $i18n.t.value.backgroundTasks.resultArtifact,
          value: formatDetailValue(task.result_artifact),
        },
        {
          label: $i18n.t.value.backgroundTasks.lastPollError,
          value: formatDetailValue(task.last_poll_error),
        },
      ].filter((entry) => entry.value !== null)"
      :key="field.label"
    >
      <p
        class="text-muted-foreground text-[11px] font-medium tracking-wide uppercase"
      >
        {{ field.label }}
      </p>
      <pre
        class="bg-muted/60 mt-1 max-h-48 overflow-auto rounded-md px-2 py-1.5 font-sans text-xs break-words whitespace-pre-wrap"
        >{{ field.value }}</pre>
    </div>
    <div v-if="task.input_required != null">
      <p
        class="text-muted-foreground text-[11px] font-medium tracking-wide uppercase"
      >
        {{ $i18n.t.value.backgroundTasks.inputRequired }}
      </p>
      <pre
        class="bg-muted/60 mt-1 max-h-48 overflow-auto rounded-md px-2 py-1.5 font-sans text-xs break-words whitespace-pre-wrap"
        >{{ formatDetailValue(task.input_required) }}</pre>
      <p class="text-muted-foreground mt-1 text-[11px]">
        {{ $i18n.t.value.backgroundTasks.inputUnavailable }}
      </p>
    </div>
  </div>
</template>
