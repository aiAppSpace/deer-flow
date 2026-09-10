<!--
  【文件职责】     「全部 / 一个都不给 / 指定几个」三态的表单控件。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/select · ui/input · core/subagents
  【边界与注意】   模式是**显式的下拉**而不是从输入框内容推：API 用 `null`/`[]`/`[...]`
                   表达三态，而「全部」和「一个都不给」在表单里都长成一个空输入框。
                   只看输入框读不出用户的意思。

                   只有 selected 模式才显示输入框——另外两种模式下那个框里的字
                   不会被提交，留着它只会让人以为写了有用。
-->

<script setup lang="ts">
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OptionalNameListMode } from "@/core/subagents";

defineProps<{
  mode: OptionalNameListMode;
  text: string;
  /**
   * 读屏器要知道这个下拉是给哪个字段用的（工具还是技能）。
   *
   * 名字不叫 `ariaLabel`：那会与原生的 `aria-label` 属性撞车，模板里写
   * `:aria-label` 会被当成透传属性而不是 prop，tsc 报的是「缺少 ariaLabel」。
   */
  selectLabel: string;
}>();
const emit = defineEmits<{
  "update:mode": [mode: OptionalNameListMode];
  "update:text": [text: string];
}>();

const { $i18n } = useNuxtApp();
</script>

<template>
  <div class="space-y-2">
    <Select
      :model-value="mode"
      @update:model-value="emit('update:mode', $event as OptionalNameListMode)"
    >
      <SelectTrigger class="w-full" :aria-label="selectLabel">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          {{ $i18n.t.value.settings.subagents.listModeAll }}
        </SelectItem>
        <SelectItem value="none">
          {{ $i18n.t.value.settings.subagents.listModeNone }}
        </SelectItem>
        <SelectItem value="selected">
          {{ $i18n.t.value.settings.subagents.listModeSelected }}
        </SelectItem>
      </SelectContent>
    </Select>
    <Input
      v-if="mode === 'selected'"
      :model-value="text"
      :placeholder="$i18n.t.value.settings.subagents.listNamesPlaceholder"
      @update:model-value="emit('update:text', String($event))"
    />
  </div>
</template>
