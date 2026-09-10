<!--
  【文件职责】     提供 M0 的 Button 视觉与交互基线。
  【架构位置】     L2
  【主要导出】     Button 组件
  【依赖关系】     消费 buttonVariants 与 cn · reka-ui(Primitive)
  【边界与注意】   保持 data-slot/data-variant 选择器合同。

                   **`asChild` 必须真的支持**，用 reka 的 `Primitive as-child`
                   ——与 SidebarMenuButton 同一套做法，上游用的是 radix `Slot`。
                   两边都是「把属性与样式合并到唯一子元素上」。

                   这里原来**没有**这个 prop。后果不是报错，是静默走样：
                   `<Button as-child><a>…</a></Button>` 渲染成 `<button><a>…</a></button>`
                   ——按钮里套链接（HTML 不允许 button 里放交互内容）、两个可聚焦
                   控件、样式全落在外层那个 button 上，里面的 `<a>` 一身不挂。
                   `vue-tsc` 和 `eslint` 都不报：`as-child` 只是掉进 fallthrough attrs
                   的一个普通属性。对照台账在 `artifact-viewer-window` 与
                   `project-detail` 两个场景上量到它：多出 `button "Download":`
                   一类节点、链接深度多一层、`role:link` 的高/宽/背景全不对。
                   守卫在 tests/guards/as-child-is-supported.test.ts。

                   `asChild` 时**不转发 `type`**：那是 `<button>` 的属性，
                   套到 `<a>` 上没有意义。
-->

<script setup lang="ts">
import { computed } from "vue";
import { Primitive } from "reka-ui";

import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariants } from "./variants";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    class?: string;
    type?: "button" | "submit" | "reset";
    asChild?: boolean;
  }>(),
  {
    variant: "default",
    size: "default",
    class: "",
    type: "button",
    asChild: false,
  },
);

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class),
);
</script>

<template>
  <Primitive
    :as="props.asChild ? undefined : 'button'"
    :as-child="props.asChild"
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :type="props.asChild ? undefined : props.type"
    :class="classes"
  >
    <slot />
  </Primitive>
</template>
