<!--
  【文件职责】     一颗建议 chip：圆角、淡色、可换行的小按钮。
  【架构位置】     L2
  【主要导出】     Suggestion 组件
  【依赖关系】     ui/button · lib/utils(cn)
  【边界与注意】   **类串只此一处**。此前欢迎态（`WelcomeSuggestionList.vue`）与追问行
                   （`AgentChat.vue`）各抄了一份同样的串，两处都要跟着上游
                   `ai-elements/suggestion.tsx` 的 `Suggestion` 走而没有任何机器对账
                   ——上游改一个 token，本仓要改两处、且漏掉一处不会红。

                   `variant`/`size` 的默认值照上游（`outline` / `sm`）。
                   **`cursor-pointer` 留着**：上游那颗有，本仓的 Button 基类没有。
-->

<script setup lang="ts">
import { computed } from "vue";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SUGGESTION_CHIP_CLASS } from "./chip-class";

const props = withDefaults(
  defineProps<{
    class?: string;
    variant?: "outline" | "ghost" | "secondary";
    size?: "sm" | "default";
    disabled?: boolean;
  }>(),
  { class: "", variant: "outline", size: "sm", disabled: false },
);

const classes = computed(() => cn(SUGGESTION_CHIP_CLASS, props.class));
</script>

<template>
  <Button
    data-slot="suggestion"
    type="button"
    :variant="props.variant"
    :size="props.size"
    :disabled="props.disabled"
    :class="classes"
  >
    <slot />
  </Button>
</template>
