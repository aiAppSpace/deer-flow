<!--
  【文件职责】     思维链容器的根：持有展开状态，套一层 not-prose。
  【架构位置】     L2
  【主要导出】     ChainOfThought 组件
  【依赖关系】     ./context · @/lib/utils
  【边界与注意】   上游 `ai-elements/chain-of-thought.tsx` 用 useControllableState，
                   既可受控（传 open）也可非受控（defaultOpen）。本仓唯一的调用点
                   SubtaskCard 是受控的，但两种都保留——少掉非受控分支的话，下一个
                   调用点会以为传 defaultOpen 有效而实际不生效。
-->
<script setup lang="ts">
import { computed, provide, ref } from "vue";

import { cn } from "@/lib/utils";

import { chainOfThoughtKey } from "./context";

const props = withDefaults(
  defineProps<{ open?: boolean; defaultOpen?: boolean; class?: string }>(),
  { open: undefined, defaultOpen: false, class: undefined },
);

const uncontrolled = ref(props.defaultOpen);
const isOpen = computed(() => props.open ?? uncontrolled.value);
provide(chainOfThoughtKey, { isOpen });

const classes = computed(() => cn("not-prose", props.class));
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
