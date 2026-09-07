<!--
  【文件职责】     Tabs 的 tablist 容器。
  【架构位置】     L2
  【主要导出】     TabsList 组件
  【依赖关系】     Reka TabsList · tabs/variants · cn
  【边界与注意】   只放 TabsTrigger，别混入普通按钮。

                   **基类与 `variant` 两档逐字照上游**（`ui/tabs.tsx:43`）：
                   `data-variant` 这个属性是 `TabsTrigger` 里那一串
                   `group-data-[variant=*]/tabs-list:` 的开关，**不传就等于没有 line 这一档**。
                   wave 145 之前本仓这里写死成 `inline-flex w-fit items-center gap-2`，
                   连 `variant` 这个 prop 都没有（wave 144 量出的那 14 行差异的根因）。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { TabsList, type TabsListProps, useForwardProps } from "reka-ui";

import { cn } from "@/lib/utils";

import { tabsListVariants, type TabsListVariants } from "./variants";

const props = withDefaults(
  defineProps<
    TabsListProps & {
      class?: HTMLAttributes["class"];
      variant?: TabsListVariants["variant"];
    }
  >(),
  { variant: "default" },
);
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, variant: _variant, ...rest } = forwarded.value;
  void _class;
  void _variant;
  return rest;
});
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    :data-variant="props.variant"
    v-bind="delegated"
    :class="cn(tabsListVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </TabsList>
</template>
