<!--
  【文件职责】     Command 项右侧的快捷键提示。
  【架构位置】     L2
  【主要导出】     CommandShortcut 组件
  【依赖关系】     cn
  【边界与注意】   纯装饰：真正的快捷键绑定在调用方的 window listener 上。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <kbd
    data-slot="command-shortcut"
    :class="
      cn('text-muted-foreground ml-auto text-xs tracking-widest', props.class)
    "
  >
    <slot />
  </kbd>
</template>
