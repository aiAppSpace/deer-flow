<!--
  【文件职责】     让一段文字的高光横向扫过，用于「还在跑」的标题。
  【架构位置】     L3 product UI
  【主要导出】     默认 Shimmer 组件
  【依赖关系】     CSS 动画 · @/lib/utils
  【边界与注意】   上游 `ai-elements/shimmer.tsx` 用 `motion/react` 把
                   background-position 从 `100% center` 线性无限扫到 `0% center`，
                   本仓**不引入动画库**，用一条 CSS keyframes 做同一件事。三处必须一致：

                   1. 默认标签是 `p`（上游 `as: Component = "p"`）。它渲染在 Button
                      里面——`<p>` 不是 phrasing content，按 HTML 规范不该出现在
                      button 里，但浏览器不会重排它，两边一样。跟着上游而不是"修正"成
                      span，是因为可访问性树会把 p 报成 `- paragraph:` 一行。
                   2. `--spread` 是 `children.length * spread` 像素，随文案长度变，
                      所以要在运行时算，不能写死。
                   3. 前景是 `text-transparent` + `bg-clip-text`：文字颜色由背景渐变
                      决定。这一条会改变取样到的 color，不是纯装饰。

                   duration 走内联 CSS 变量而不是 style 里的 animation 简写，
                   scoped 样式才能同时命中。
-->
<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    text: string;
    duration?: number;
    spread?: number;
    class?: string;
  }>(),
  { duration: 2, spread: 2 },
);
const classes = computed(() =>
  cn(
    "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
    "[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))]",
    "shimmer",
    props.class,
  ),
);
const style = computed(() => ({
  "--spread": `${props.text.length * props.spread}px`,
  "--shimmer-duration": `${props.duration}s`,
  backgroundImage:
    "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
}));
</script>

<template>
  <p :class="classes" :style="style">{{ props.text }}</p>
</template>

<style scoped>
.shimmer {
  background-position: 100% center;
}

/*
  高光带只在无偏好时扫。停住的位置就是基础规则里那个 `100% center`——**也正是这条
  动画自己的起始帧**，每个周期本来都会在屏幕上出现一次：那一帧里高光带在元素左边界
  之外，文字整段由底下那层实心 `--color-muted-foreground` 画出来，读得清。
  所以「停住」不会让「还在跑」这几个字消失，只是不再有光扫过。
  上游 `ai-elements/shimmer.tsx` 用 motion/react，wave 162 两边同改成同一个停车位。
*/
@media (prefers-reduced-motion: no-preference) {
  .shimmer {
    animation: shimmer var(--shimmer-duration) infinite linear;
  }
}

@keyframes shimmer {
  from {
    background-position: 100% center;
  }
  to {
    background-position: 0% center;
  }
}
</style>
