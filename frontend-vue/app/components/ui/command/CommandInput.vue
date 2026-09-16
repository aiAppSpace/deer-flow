<!--
  【文件职责】     Command 的搜索输入：输入时方向键仍然驱动列表高亮。
  【架构位置】     L2
  【主要导出】     CommandInput 组件
  【依赖关系】     Reka ListboxFilter · cn
  【边界与注意】   **基类与上游不同字，而那是量出来的取舍，不是漏抄。**
                   上游 `ui/command.tsx` 的 `CommandInput` 是外层
                   `flex h-9 items-center gap-2 border-b px-3` + input
                   `placeholder:text-muted-foreground flex h-10 w-full rounded-md
                   bg-transparent py-3 text-sm outline-hidden …`；本仓是外层
                   `border-border flex items-center gap-2 border-b px-3` + input
                   `h-12 min-w-0 flex-1 … outline-none`。

                   2026-09-16 第三十一轮**试过逐字照抄**，对照台账当场报出六行几何：
                   `role:dialog[Model Selector] height React=135.6 Vue=122.5 Δ-13.1`、
                   `y Δ6.5`、`role:option y Δ-6.5`（两个语言维各三行），
                   而**改之前这一屏几何是全对的**。原因是底层不同构：
                   本仓是 Reka `ListboxFilter`、上游是 cmdk `Input`，
                   外层与 input 的盒模型不一样，同一串类渲染出不同高度。

                   **判据取渲染一致而不是类串一致**——最终目标是「界面完全一致」，
                   类串只是它的代理。这一条因此留在
                   `tests/guards/primitive-base-classes.test.ts` 的 `DECLARED` 里，
                   **翻案判据**：两边底层同构了（或上游换掉 cmdk）就重新逐字对一遍。

                   焦点留在 input 上，选中项通过 aria-activedescendant 宣告——
                   所以调用方不要再把焦点搬到列表项上。

                   **role="combobox" 三件套是写死的**，与上游 cmdk 一致
                   （cmdk 的 Command.Input 恒定渲染 role="combobox"、
                   aria-expanded={true}、aria-autocomplete="list"）。Reka 的
                   ListboxFilter 只给 aria-activedescendant，于是可访问性树里
                   本仓念作 textbox、上游念作 combobox [expanded]——这一行
                   在对照台账里是实测出来的，不是推断。

                   aria-expanded 恒 true 而不是跟着某个开合状态：这个 input 只在
                   命令面板已经展开时才存在，没有"收起"的那一半。

                   可访问名走 `label` prop 渲染出来的**视觉隐藏 <label>**，与
                   cmdk 同构：它恒定渲染一个 <label cmdk-label> 并让 input 的
                   aria-labelledby 指过去。上游两个调用点原来都没给 Command 传
                   label，于是那个 label 是空的、accname 算出空串、placeholder
                   兜底被压掉——搜索框根本没有可访问名。那是上游缺陷，已按
                   "两边同改"补在 frontend/src/components/ai-elements/
                   model-selector.tsx 的 label prop 上。

                   为什么不是简单地给 input 加 aria-label：那样名字是有了，但
                   可访问性树里少一个 `text` 节点——上游那个 <label> 是**可见于
                   a11y 树**的静态文本，对照台账实测报出过这一行。名字与树形要
                   一起对齐，只对齐其中一半就是把差异从一处挪到另一处。

                   不传 label 时整个元素不渲染，对应上游"没传 label"的那一半。
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
    <Search
      :size="16"
      class="text-muted-foreground shrink-0"
      aria-hidden="true"
    />
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
