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
</script>

<template>
  <div
    data-slot="suggestions-list"
    data-testid="welcome-suggestions"
    class="flex min-h-16 w-full max-w-full flex-wrap items-center justify-center gap-2 self-center px-4 sm:w-fit sm:px-0"
  >
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

    <Button
      v-for="suggestion in $i18n.t.value.inputBox.suggestions"
      :key="suggestion.suggestion"
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
            'type' in suggestion ? `separator-${index}` : suggestion.suggestion
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
  </div>
</template>
