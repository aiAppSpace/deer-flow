<!--
  【文件职责】     提供主会话与 sidecar 共用的输入框视觉边界和统一焦点环。
  【架构位置】     L3
  【主要导出】     默认 ComposerSurface 组件
  【依赖关系】     Tailwind :has() · data-slot=input-group-control
  【边界与注意】   子输入控件不拥有外框；仅标记的 focus-visible 控件驱动 surface ring。
                   role="group" 来自 React 的 InputGroup（frontend/src/components/ui/
                   input-group.tsx）：整个输入框在可访问性树里是一个分组，读屏器因此能
                   把「附件 / 语音 / 模式 / 模型 / 提交」当成同一组控件报出来，而不是一串
                   散落在页面上的按钮。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    testId?: string;
    class?: string;
    /**
     * 上游的两个 composer **body 那一层不同构**，所以这里必须分档：
     *
     * - `main`：上游 `input-box.tsx:2346` 是一个真盒子
     *   `min-h-16 w-full min-w-0 px-3 py-3`，下面那段 CSS 逐字对着它；
     * - `sidecar`：上游 `sidecar-panel.tsx:626` 用的是 `PromptInputBody`，
     *   而它是 **`display: contents`**（`ai-elements/prompt-input.tsx:879`）
     *   ——**根本不产生盒子**，内边距与 `min-h-16` 都在 textarea 自己身上
     *   （`InputGroupTextarea` 的 `py-3` + `Textarea` 基类的 `px-3`）。
     *
     * 2026-09-19 第四十六轮 tablet 轴一开就撞出来：本仓两个 composer 共用
     * `main` 那一套，于是 sidecar 的正文行比上游**高 14px**。
     * 桌面下看不出来，是因为本仓那颗 `min-h-6!` 的 textarea 算出 36px、
     * 与这层多出来的 30px **恰好抵消**；768 上抵消不掉。
     * 逐层读数写在 `vue-parity-open-accounts` 第四十六轮。
     */
    variant?: "main" | "sidecar";
  }>(),
  {
    testId: "composer-surface",
    class: "",
    variant: "main",
  },
);

const classes = computed(() =>
  cn(
    "composer-surface group/input-group border-input/50 dark:bg-background/80 has-[[data-slot=input-group-control]:focus-visible]:border-input has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 relative z-10 flex w-full min-w-0 flex-col rounded-2xl border bg-white/80 shadow-xs backdrop-blur-sm transition-[color,box-shadow] outline-none has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",
    props.class,
  ),
);
</script>

<template>
  <div
    role="group"
    data-slot="input-group"
    :data-testid="testId"
    :data-variant="variant"
    :class="classes"
  >
    <!--
      `extraHeader` 浮在输入框**上方**，不占布局，与上游
      `frontend/src/components/workspace/input-box.tsx:2220` 逐层同构：
      外层 `absolute top-0` 是一个**零高度**的锚，贴住 surface 的上边线；
      内层 `bottom-0` 于是把内容的**底边**顶到那条线上。

      **两层都不能省，而且必须挂在 surface 内部。** wave 67 实测过合并/外挂的后果：
      本仓原来把这两层塞在 AgentChat 里、作为输入框的**兄弟节点**，于是那个零高度锚
      贴的是外层布局容器（`relative w-full max-w-[…] -translate-y-[…]`）而不是输入框。
      同一屏、同一视口、两边都登录，实测：
        React  锚 top 288（= surface 上边线），欢迎区 137→289，段落底→输入框顶 28px
        Vue    锚 top 304（= 外层容器上边线），欢迎区 172→304，段落底→输入框顶 13px
      也就是整块**低 15px 并压进输入框**。宽度也跟着差 2px（576 vs 574——surface 带
      `border`，`right-0 left-0` 贴的是 padding box），段落因此少折一行，
      整块高 132 vs 152。**两个现象是同一个根因。**

      交接文档此前把这条记成「只是 DOM 父节点不同、零可观察收益」——**实测推翻了它**。
      台账没抓到是因为 `sampleGeometry` 只量场景 settle 里的锚点，欢迎区不是锚点
      （线索 137）。
    -->
    <div v-if="$slots.extraHeader" class="absolute top-0 right-0 left-0 z-10">
      <div
        class="absolute right-0 bottom-0 left-0 flex items-center justify-center"
      >
        <slot name="extraHeader" />
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.composer-surface :deep([data-slot="input-group-control"]:focus-visible) {
  outline: none;
  box-shadow: none;
}

.composer-surface :deep([data-slot="input-group-header"]) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.75rem 0;
}

.composer-surface :deep([data-slot="input-group-body"]) {
  min-height: 4rem;
  width: 100%;
  min-width: 0;
  padding: 0.75rem;
}

/*
  见 `variant` 那段注释：上游 sidecar 的 body 是 `display: contents`，
  内边距与高度下限都归 textarea 自己。**不能只把这里的 padding 去掉**——
  那样 textarea 仍然是这层的孩子、宽度还是被 `min-width: 0` 那一支约束着，
  与上游「textarea 直接是 InputGroup 的 flex 孩子」不同构。
*/
.composer-surface[data-variant="sidecar"]
  :deep([data-slot="input-group-body"]) {
  display: contents;
}

.composer-surface :deep([data-slot="input-group-footer"]) {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem 0.75rem;
  /*
    页脚里的控件默认是 muted，**颜色归容器**——上游同一层
    （`InputGroupAddon` 的 cva，input-group.tsx:40）就带着
    `text-muted-foreground`，里面那几颗 ghost Button 都不自己写颜色。

    实测（wave 71 两个应用同屏取计算样式）：不写这一条时，纸夹 / 语音 /
    优化 / 提交四颗算出来的 color 是 `foreground`（近黑）而上游是
    `muted-foreground`（中灰）。此前是靠每颗按钮各写一遍 `text-muted-foreground`
    盖住的——那样每加一颗控件就要记得再写一遍，漏一颗就黑一颗。
  */
  color: var(--muted-foreground);
}
</style>
