<!--
  【文件职责】     Command 的搜索输入：输入时方向键仍然驱动列表高亮。
  【架构位置】     L2
  【主要导出】     CommandInput 组件
  【依赖关系】     Reka ListboxFilter · cn
  【边界与注意】   Reka ListboxFilter 与 cmdk Input 的盒模型不同，样式以实际渲染几何为准。
                   焦点留在 input，由 aria-activedescendant 宣告选中项；已打开的面板声明 combobox expanded。
                   可访问名使用 label 对应的隐藏标签，保持命名与阅读顺序。
-->

<script setup lang="ts">
import { computed, useId, type HTMLAttributes } from "vue";
import {
  ListboxFilter,
  type ListboxFilterProps,
  useForwardProps,
} from "reka-ui";
import { Search } from "lucide-vue-next";

import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    ListboxFilterProps & {
      class?: HTMLAttributes["class"];
      wrapperClass?: HTMLAttributes["class"];
      /** 可访问名。见文件头：它是一个视觉隐藏的真 <label>，不是 aria-label。 */
      label?: string;
    }
  >(),
  {
    autoFocus: true,
    class: undefined,
    wrapperClass: undefined,
    label: undefined,
  },
);
const emits = defineEmits<{ "update:modelValue": [value: string] }>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const {
    class: _class,
    wrapperClass: _wrapperClass,
    label: _label,
    ...rest
  } = forwarded.value;
  void _class;
  void _wrapperClass;
  void _label;
  return rest;
});
const inputId = useId();
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    :class="
      cn(
        'border-border flex items-center gap-2 border-b px-3',
        props.wrapperClass,
      )
    "
  >
    <Search class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
    <label
      v-if="label"
      :for="inputId"
      data-slot="command-label"
      class="sr-only"
    >
      {{ label }}
    </label>
    <ListboxFilter
      :id="inputId"
      data-slot="command-input"
      v-bind="{ ...delegated, ...$attrs }"
      role="combobox"
      aria-expanded="true"
      aria-autocomplete="list"
      :class="
        cn(
          'h-12 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
      @update:model-value="emits('update:modelValue', $event)"
    />
  </div>
</template>
