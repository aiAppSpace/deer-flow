<!--
  【文件职责】     Tabs 根：当前面板值与方向。
  【架构位置】     L2
  【主要导出】     Tabs 组件
  【依赖关系】     Reka TabsRoot · cn
  【边界与注意】   tablist 里方向键移动、Tab 键整体进出，这是它区别于一排按钮的地方。

                   **`group/tabs` 不是可选的**：`TabsList` 的
                   `group-data-[orientation=horizontal]/tabs:h-9` 和 `TabsTrigger` 里
                   那一串 `group-data-[orientation=*]/tabs:` 全部挂在这个标记上，
                   而 `data-orientation` 由 reka 的 TabsRoot 自己写（默认 horizontal），
                   与上游显式写一遍等价。wave 145 之前这里**一个类都没有**，
                   于是横向 tablist 的 36px 定高、竖排的换行、下划线的定位全部失效。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  TabsRoot,
  useForwardPropsEmits,
  type TabsRootEmits,
  type TabsRootProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  TabsRootProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<TabsRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <TabsRoot
    data-slot="tabs"
    v-bind="delegated"
    :class="
      cn(
        'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
        props.class,
      )
    "
  >
    <slot />
  </TabsRoot>
</template>
