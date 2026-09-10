<!--
  【文件职责】     空状态的图标位。
  【架构位置】     L2 primitive
  【主要导出】     EmptyMedia
  【依赖关系】     class-variance-authority · lib/utils(cn)
  【边界与注意】   `data-slot` 是 **empty-icon** 而不是 empty-media——照抄上游，别「顺手改对称」。
-->
<script setup lang="ts">
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const props = withDefaults(
  defineProps<{ variant?: "default" | "icon"; class?: string }>(),
  { variant: "default" },
);
</script>
<template>
  <div
    data-slot="empty-icon"
    :data-variant="props.variant"
    :class="cn(emptyMediaVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </div>
</template>
