<!--
  【文件职责】     历史加载中、还一条消息都没有时，占住整屏的骨架。
  【架构位置】     L3 product UI
  【主要导出】     默认 MessageListSkeleton 组件
  【依赖关系】     ui/skeleton · i18n
  【边界与注意】   结构、宽度、错峰间隔（60ms）与动画都照上游
                   `frontend/src/components/workspace/messages/skeleton.tsx`：
                   一条人类消息（右对齐，两根 6/8 宽度的条）+ 一条 assistant 消息
                   （八根，最后两根 7/6/4 收窄）。

                   **两件事是 wave 169 两边同改的**：

                   ① `role="status"` + `aria-busy` + 一行 `sr-only` 文案。骨架屏是纯视觉
                      占位——不补这一条，读屏器用户在整段历史加载期间**什么也听不到**。
                      文案放在活动区**内部**而不是 `aria-label`：活动区播报的是内容变化，
                      不是它的名字。上游此前只有骨架、没有播报；本仓此前只有一行文字、
                      没有骨架——各缺一半，这一轮两边都补齐。

                   ② 上游那两个分组 div 原本写的是 `role="human-message"` /
                      `role="assistant-message"`——**那不是 ARIA 角色**（词表是固定的，
                      浏览器直接丢掉），也没有任何地方查询它们。两边都改成 `data-slot`。

                   条子本身**不带 `opacity: 0`**：入场动画是 `both`，延时那一帧由 keyframes
                   的 `backwards` 负责。判据与守卫见 tests/guards/animation-visibility.test.ts。
-->
<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton";

const { $i18n } = useNuxtApp();

/** 与上游 `STAGGER_MS = 60` 同一个常数。 */
const delay = (index: number) => `${index * 60}ms`;

/** 第二组八根条子的宽度，逐字照上游那一串。 */
const assistantWidths = [
  "w-full",
  "w-full",
  "w-[70%]",
  "w-full",
  "w-full",
  "w-full",
  "w-[60%]",
  "w-[40%]",
];
</script>

<template>
  <div
    role="status"
    aria-busy="true"
    data-slot="message-list-skeleton"
    class="flex w-full max-w-(--container-width-md) flex-col gap-12 p-8 pt-16"
  >
    <span class="sr-only">{{
      $i18n.t.value.messages.loadingConversation
    }}</span>

    <div
      data-slot="skeleton-human-message"
      class="flex w-[50%] flex-col items-end gap-2 self-end"
    >
      <div
        v-for="(width, index) in ['w-full', 'w-[80%]']"
        :key="`human-${index}`"
        class="entrance origin-right overflow-hidden rounded-md"
        :class="['h-6', width]"
        :style="{ animationDelay: delay(index) }"
      >
        <Skeleton class="h-full w-full rounded-md" />
      </div>
    </div>

    <div data-slot="skeleton-assistant-message" class="flex flex-col gap-2">
      <div
        v-for="(width, index) in assistantWidths"
        :key="`assistant-${index}`"
        class="entrance origin-left overflow-hidden rounded-md"
        :class="['h-6', width]"
        :style="{ animationDelay: delay(index + 2) }"
      >
        <Skeleton class="h-full w-full rounded-md" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  与上游 `--animate-skeleton-entrance: skeleton-entrance 0.35s ease-out both` 同一条，
  keyframes 逐字照抄 `globals.css`。**`both` 而不是 `forwards`**，元素自己也不带
  `opacity: 0`——理由与 WelcomeSuggestionList 那处相同，见守卫的文件头。
*/
.entrance {
  max-width: 100%;
}

@media (prefers-reduced-motion: no-preference) {
  .entrance {
    animation: skeleton-entrance 0.35s ease-out both;
  }
}

@keyframes skeleton-entrance {
  0% {
    opacity: 0;
    transform: scaleX(0);
  }
  100% {
    opacity: 1;
    transform: scaleX(1);
  }
}
</style>
