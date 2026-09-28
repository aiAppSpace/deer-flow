<script setup lang="ts">
/*
  【文件职责】     展示并切换当前 thread 的 artifact 文件列表。
  【架构位置】     L3
  【主要导出】     默认 ArtifactFileList 组件
  【依赖关系】     ArtifactPanel · ui/select
  【边界与注意】   ① **走 `ui/select`，不是手搓的 combobox + listbox。**
                   上游是 shadcn 的 `<Select>`（artifact-file-detail.tsx:406）。
                   原来这里是一颗 `role="combobox"` 的按钮加一层绝对定位的
                   `role="listbox"`，四样差异都看得见/摸得着：
                   **触发器上没有下拉箭头**（SelectTrigger 自带 `ChevronDown`），
                   用户看不出这是个可展开的控件；**选中项没有对勾**
                   （SelectItem 自带 `SelectItemIndicator`）；
                   列表**不 portal**，被头部的 overflow 裁掉；
                   以及整套键盘行为（上下键、首字母跳转、Escape、
                   打开时焦点落到当前项）一条都没有。

                   ② 触发器**没有** aria-label：可访问名来自里面的 SelectValue，
                   也就是当前选中的文件名（上游同理）。额外挂一个 "Select artifact"
                   会让读屏器先念控件名再念文件名，而上游那边只念文件名。

                   ③ 只发出选择意图；dirty 决策由上层 useArtifactDraft 唯一处理。
                   受控写法（`:model-value` 绑 prop、不 v-model）是这条的前提：
                   用户在确认框里点「取消」时，触发器要退回原来的文件名。

                   ④ 弹层 portal 到 body，所以 e2e 里定位 `role="option"` 不能
                   把 locator 限死在面板容器里——上游用的是同一套 Radix portal。
*/
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

defineProps<{ current: string; options: string[] }>();
const emit = defineEmits<{ select: [path: string] }>();
const { $i18n } = useNuxtApp();

function fileName(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}
</script>

<template>
  <!--
    这一层就是上游的 `ArtifactTitle`（ai-elements/artifact.tsx:67 =
    `text-foreground text-sm font-medium`），**按内容宽**。本仓原来多写了
    `min-w-0 flex-1`，加上触发器上的 `max-w-full`：头部平铺成一排时它会去抢
    剩余宽度，再被右边的动作键挤回来，于是文件名**被截断**——实测
    artifact-batched-stream 那一屏的文件名内容宽 127px、可视只剩 105px，
    而上游那颗是自然宽 126.7px。
    该 `grow` 的是头部中间那一栏（见 ArtifactPanel.vue 的头部注释），不是标题。

    **wave 82 补上了另一半**：宽度归标题栏（ArtifactPanel 的第一栏，`min-w-0`），
    这里只负责让触发器跟着缩——`SelectTrigger` 是 `w-fit`，不写 `max-w-full`
    它不理会外层的收缩，里面的 `SelectValue` 自带 `line-clamp-1`。
    实测不写这一条时，59 字符的文件名会把整排动作键推出面板的 `overflow-hidden`
    盒子（本仓 181px、上游 199px），下载与关闭都点不到。**两边同改。**
  -->
  <div class="text-foreground max-w-full min-w-0 text-sm font-medium">
    <Select
      :model-value="current"
      @update:model-value="
        (value) => {
          if (typeof value === 'string' && value !== current)
            emit('select', value);
        }
      "
    >
      <SelectTrigger
        class="w-full max-w-full border-none bg-transparent! shadow-none select-none focus:outline-0 active:outline-0"
      >
        <SelectValue :placeholder="$i18n.t.value.primitives.selectAFile" />
      </SelectTrigger>
      <SelectContent class="select-none">
        <SelectGroup>
          <SelectItem v-for="option in options" :key="option" :value="option">
            {{ fileName(option) }}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
</template>
