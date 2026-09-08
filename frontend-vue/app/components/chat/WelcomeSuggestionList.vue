<script setup lang="ts">
/*
  【文件职责】     渲染欢迎态完整快捷建议，并提供创建类型下拉菜单。
  【架构位置】     L3
  【主要导出】     默认 WelcomeSuggestionList 组件
  【依赖关系】     i18n suggestions · ui/dropdown-menu · Button · ConfettiButton
  【边界与注意】   只回传 prompt；填草稿、占位符选择与发送策略由 ChatComposer 持有。
*/
import { Plus, Sparkles } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfettiButton from "@/components/ui/effects/ConfettiButton.vue";

defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ select: [prompt: string] }>();
const { $i18n } = useNuxtApp();

const suggestionClass =
  "text-muted-foreground dark:bg-background h-auto max-w-full cursor-pointer rounded-full px-4 py-2 text-center text-xs font-normal whitespace-normal";

/*
  逐个淡入的错峰延时，常数照上游 `ai-elements/suggestion.tsx`
  （`STAGGER_DELAY_MS_OFFSET = 250`、`STAGGER_DELAY_MS = 60`）。

  上游把这一层套在 `Suggestions` 里，本仓**不跟那个包装**（它是一个永远不会真滚动的
  ScrollArea，判据记在一页纸清单第 6 条），但入场动画是另一回事——它是用户看得见的
  产品行为，wave 167 之前本仓一处都没有。
*/
const entranceDelay = (index: number) => `${250 + index * 60}ms`;
</script>

<template>
  <div
    data-slot="suggestions-list"
    data-testid="welcome-suggestions"
    class="flex min-h-16 w-full max-w-full flex-wrap items-center justify-center gap-2 self-center px-4 sm:w-fit sm:px-0"
  >
    <span class="entrance" :style="{ animationDelay: entranceDelay(0) }">
      <ConfettiButton
        variant="outline"
        size="sm"
        class="text-muted-foreground cursor-pointer rounded-full px-4 text-xs font-normal"
        :disabled="disabled"
        @click="emit('select', $i18n.t.value.inputBox.surpriseMePrompt)"
      >
        <Sparkles class="size-4" />
        {{ $i18n.t.value.inputBox.surpriseMe }}
      </ConfettiButton>
    </span>

    <span
      v-for="(suggestion, index) in $i18n.t.value.inputBox.suggestions"
      :key="suggestion.suggestion"
      class="entrance"
      :style="{ animationDelay: entranceDelay(index + 1) }"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        :class="suggestionClass"
        :disabled="disabled"
        @click="emit('select', suggestion.prompt)"
      >
        <component :is="suggestion.icon" class="size-4" />
        {{ suggestion.suggestion }}
      </Button>
    </span>

    <span
      class="entrance"
      :style="{
        animationDelay: entranceDelay(
          $i18n.t.value.inputBox.suggestions.length + 1,
        ),
      }"
    >
      <DropdownMenu>
        <DropdownMenuTrigger :disabled="disabled">
          <Button
            data-testid="welcome-create-trigger"
            type="button"
            variant="outline"
            size="sm"
            :class="suggestionClass"
            :disabled="disabled"
          >
            <Plus class="size-4" />
            {{ $i18n.t.value.common.create }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="min-w-40">
          <template
            v-for="(suggestion, index) in $i18n.t.value.inputBox
              .suggestionsCreate"
            :key="
              'type' in suggestion
                ? `separator-${index}`
                : suggestion.suggestion
            "
          >
            <DropdownMenuSeparator v-if="'type' in suggestion" />
            <DropdownMenuItem
              v-else
              :data-testid="index === 0 ? 'welcome-create-webpage' : undefined"
              @select="emit('select', suggestion.prompt)"
            >
              <component :is="suggestion.icon" class="size-4" />
              {{ suggestion.suggestion }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  </div>
</template>

<style scoped>
/*
  与上游 `--animate-fade-in-up: fade-in-up 0.15s ease-in-out both` 同一条：
  keyframes 逐字照抄 `globals.css`。

  **`both` 而不是 `forwards`，而且元素自己不带 `opacity: 0`。** 上游原来是
  `animate-fade-in-up + opacity-0 + forwards`——错峰延时期间靠那个类保持透明，
  于是**可见性依赖动画真的跑起来**：动画一旦被跳过（减动分支、打印、跳过动画的浏览器），
  那几颗建议芯片就永远看不见。wave 167 两边同改成 `both`：延时期间由 keyframes 的
  `backwards` 负责，元素自身的静止态是可见的。有了这一条才敢给它套 `no-preference`。
*/
.entrance {
  max-width: 100%;
}

@media (prefers-reduced-motion: no-preference) {
  .entrance {
    animation: fade-in-up 0.15s ease-in-out both;
  }
}

@keyframes fade-in-up {
  0% {
    opacity: 0;
    transform: translateY(1rem) scale(1.2);
  }
  100% {
    opacity: 1;
  }
}
</style>
