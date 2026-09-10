<!--
  【文件职责】     空状态描述。
  【架构位置】     L2 primitive
  【主要导出】     EmptyDescription
  【依赖关系】     lib/utils(cn)
  【边界与注意】   上游函数名叫 Description 但渲染的是 `<div>`（不是 `<p>`）——照抄。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";
const props = defineProps<{ class?: string }>();
</script>
<template>
  <div
    data-slot="empty-description"
    :class="
      cn(
        'text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
