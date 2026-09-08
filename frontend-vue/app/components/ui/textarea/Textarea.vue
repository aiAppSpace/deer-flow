<!--
  【文件职责】     多行文本输入的视觉与焦点基线。
  【架构位置】     L2
  【主要导出】     Textarea 组件
  【依赖关系】     cn
  【边界与注意】   与 `ui/input` 是一对：同一套边框/焦点环/`aria-invalid` 合同，
                   只是尺寸规则不同（`field-sizing-content min-h-16` 而不是 `h-9`）。
                   照抄上游 `frontend/src/components/ui/textarea.tsx`。

                   **`modelValue` 必须显式声明并显式 emit。** Vue 的
                   `renderComponentRoot` 在合并 `$attrs` 之前跑 `filterModelListeners`：
                   凡是 `onUpdate:<key>` 且本组件声明了同名 prop，就从 fallthrough 里
                   剔掉——不报警告、不报错，只是永远收不到事件（坑 72）。这里声明了
                   `modelValue`，所以 `update:modelValue` 由本文件自己发。

                   可访问名字由调用方给（`aria-label` 或关联 label），
                   primitive 不持有任何产品文案。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  modelValue?: string | number;
}>();
const emits = defineEmits<{ "update:modelValue": [payload: string] }>();
</script>

<template>
  <textarea
    data-slot="textarea"
    :value="props.modelValue"
    :class="
      cn(
        'border-input placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 md:text-sm',
        props.class,
      )
    "
    @input="
      emits('update:modelValue', ($event.target as HTMLTextAreaElement).value)
    "
  />
</template>
