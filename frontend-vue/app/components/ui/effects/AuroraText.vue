<script setup lang="ts">
/*
  【文件职责】     渲染可配置的 Aurora 文本特效。
  【架构位置】     L3 product UI
  【主要导出】     默认 AuroraText 组件
  【依赖关系】     Vue · CSS 动画
  【边界与注意】   M7 视觉效果，不属于 M8 冻结的 L2 公共集合。
*/
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    colors?: string[];
    speed?: number;
    class?: string;
  }>(),
  {
    colors: () => ["#ff0080", "#7928ca", "#0070f3", "#38bdf8"],
    speed: 1,
    class: "",
  },
);

const gradient = computed(() => {
  const colors = props.colors.length ? props.colors : ["currentColor"];
  return `linear-gradient(135deg, ${[...colors, colors[0]].join(", ")})`;
});
const duration = computed(() => `${10 / Math.max(props.speed, 0.1)}s`);
</script>

<template>
  <span
    class="relative inline-block"
    :class="props.class"
    data-effect="aurora-text"
  >
    <span class="sr-only"><slot /></span>
    <span
      aria-hidden="true"
      class="aurora-text relative bg-clip-text text-transparent"
      :style="{ backgroundImage: gradient, animationDuration: duration }"
    >
      <slot />
    </span>
  </span>
</template>

<style scoped>
.aurora-text {
  background-size: 200% auto;
  animation-name: aurora;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

/*
  **逐字照抄上游 `globals.css` 的 `@keyframes aurora`。**

  这里原来是自己写的一条 `aurora-shift`：`background-position` 从 `0% 50%` 线性走到
  `200% 50%`，`linear` + `normal`。上游那条是**五个停点、而且带 transform**
  （`rotate(±5deg) scale(0.9~1.1)`），配 `ease-in-out` + `alternate`。
  两边时长都是 10s（组件按 `10 / speed` 内联给 `animation-duration`），
  但动的东西根本不是一回事——一个是匀速单向平移，一个是缓入缓出的来回摆动加缩放。

  wave 167 实测出这处差异：对照取样面把 `reducedMotion` 钉死成 `reduce`，
  两边在那里都是 `animation: none`，**所以台账结构性地看不见它**。
  在 `no-preference` 下取一次动画**声明**（不是帧）才露出来。

  根因是「重新实现」而不是「照抄」——本仓对 `ambilight`、`shine` 走的都是逐字照抄。
  改动只在这一支：keyframes 与三个参数按上游写，减动分支不变。
*/
@keyframes aurora {
  0% {
    background-position: 0% 50%;
    transform: rotate(-5deg) scale(0.9);
  }
  25% {
    background-position: 50% 100%;
    transform: rotate(5deg) scale(1.1);
  }
  50% {
    background-position: 100% 50%;
    transform: rotate(-3deg) scale(0.95);
  }
  75% {
    background-position: 50% 0%;
    transform: rotate(3deg) scale(1.05);
  }
  100% {
    background-position: 0% 50%;
    transform: rotate(-5deg) scale(0.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .aurora-text {
    animation: none;
    background-position: 50% 50%;
  }
}
</style>
