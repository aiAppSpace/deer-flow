<!--
  【文件职责】     人类消息气泡下方的复制与「编辑并重跑」两颗操作按钮。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 HumanTurnActions 组件
  【依赖关系】     Button L2 · Tooltip L2 · lucide-vue-next
  【边界与注意】   与 AssistantTurnActions 是同一套规格，只是内容不同：本仓此前这一排
                   是两颗**裸 `<button>`**——复制那颗直接放 14px 的 svg，编辑那颗是一段
                   带下划线的文字「Edit and rerun」。上游
                   （message-list-item.tsx:232 的 MessageToolbar）两颗都是
                   `<Button variant="ghost" size="icon-sm">`，编辑那颗画的是
                   **PencilIcon**、名字走 aria-label，文字并不显示。于是两边这一排的
                   高度是 32 vs 16、图标是铅笔 vs 文字。它整排 `opacity-0`、只在悬停
                   时出现，既不是几何锚点、可访问名又恰好相同（图标 + aria-label 与
                   可见文字念出来是同一句），所以对照台账两项都看不见它。

                   外层那串类是上游 `MessageToolbar` 的
                   `mt-4 flex w-full items-center justify-between gap-4` 与调用点的
                   `absolute right-0 -bottom-9 left-0 justify-end` +
                   `z-20 opacity-0 transition-opacity delay-200 duration-300` 经
                   tailwind-merge 之后的结果——`justify-between` 被 `justify-end`
                   顶掉了，probe 实测 React 渲染出来的串里没有它，所以这里也不写。

                   `-bottom-9` 不是 `-bottom-7`：这一排从 16px 高变成 32px 高，
                   底边偏移要跟着从 28 变成 36，气泡与按钮之间才还是 4px。

                   **复制那颗 wave 62 补上了可访问名，两边同改。** 此前这里写着
                   「不给可访问名，因为上游 CopyButton 只有图标和 tooltip」——
                   那句话对上游的描述是准的，但**照抄的是一处缺陷**：tooltip 在
                   Radix / Reka 里都挂成 `aria-describedby`，不是可访问名，
                   读屏器念出来就是一颗光秃秃的「按钮」。wave 62 用 parity probe
                   普查了跑完一轮之后的整屏，React 2 个无名控件正是这两颗复制键。
                   按 wave 28 的判据（没有可访问名的交互控件算缺陷）已在
                   `frontend/src/components/workspace/copy-button.tsx` 一并改掉。
-->

<script setup lang="ts">
import { Check, Copy, PencilIcon } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

withDefaults(
  defineProps<{
    copied: boolean;
    copyLabel: string;
    copiedLabel?: string;
    editLabel: string;
    showEdit?: boolean;
  }>(),
  { showEdit: false, copiedLabel: undefined },
);

const emit = defineEmits<{ copy: []; edit: [] }>();
</script>

<template>
  <TooltipProvider>
    <div
      data-testid="human-turn-actions"
      class="absolute right-0 -bottom-9 left-0 z-20 mt-4 flex w-full items-center justify-end gap-4 opacity-0 transition-opacity delay-200 duration-300 group-hover/conversation-message:opacity-100"
    >
      <div class="pointer-events-auto flex gap-1">
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="copied ? (copiedLabel ?? copyLabel) : copyLabel"
              @click="emit('copy')"
            >
              <Check v-if="copied" class="size-4 text-green-500" />
              <Copy v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ copyLabel }}</TooltipContent>
        </Tooltip>
        <Tooltip v-if="showEdit">
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="editLabel"
              @click="emit('edit')"
            >
              <PencilIcon class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ editLabel }}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </TooltipProvider>
</template>
