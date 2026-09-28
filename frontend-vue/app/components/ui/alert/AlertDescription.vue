<!--
  【文件职责】     Alert 的说明区。
  【架构位置】     L2
  【主要导出】     AlertDescription 组件
  【依赖关系】     cn
  【边界与注意】   data-slot 是 destructive 变体给它上色的选择器，不能改名。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="alert-description"
    :class="
      cn(
        'text-muted-foreground col-start-2 grid min-w-0 justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
