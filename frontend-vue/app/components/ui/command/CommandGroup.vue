<!--
  【文件职责】     命令分组及标题的框架适配。
  【架构位置】     L2
  【主要导出】     CommandGroup
  【依赖关系】     Reka ListboxGroup · cn
  【边界与注意】   保留上游 command group 样式属性，heading 由调用方提供。
-->
<script setup lang="ts">
import { ListboxGroup, ListboxGroupLabel } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
const props = defineProps<{
  heading?: string;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <ListboxGroup
    data-slot="command-group"
    cmdk-group=""
    :class="
      cn(
        'text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
        props.class,
      )
    "
  >
    <ListboxGroupLabel
      v-if="heading"
      data-slot="command-group-heading"
      cmdk-group-heading=""
      >{{ heading }}</ListboxGroupLabel
    >
    <slot />
  </ListboxGroup>
</template>
