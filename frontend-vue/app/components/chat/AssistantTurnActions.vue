<!--
  【文件职责】     统一助手消息尾部的复制、分支与重新生成操作规格。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 AssistantTurnActions 组件
  【依赖关系】     Button L2 · Tooltip L2 · lucide-vue-next
  【边界与注意】   只拥有动作呈现与事件转发；动作可用性与业务执行仍由 MessageList 决定。

                   **「画不画」和「能不能点」是两个 prop，不是一个。** 上游
                   `message-list.tsx:780/817` 用 `enableBranchForTurn` /
                   `enableRegenerateForTurn` 决定**渲染**，用 `disabled={!canBranch …}` /
                   `disabled={!canRegenerate …}` 决定**可用**——只读态（案例页 isMock、
                   上传中、分支请求在飞）下这两颗仍然画出来，只是禁用。本仓此前把两者
                   压成一个 show-*，只读态下整颗按钮消失，读屏器与键盘用户因此看不到
                   「这里本来有个操作、现在不可用」。

                   **这段话里原来还列着「静态站、加载中」，两处都订正了**
                   （2026-09-16 第二十八轮逐条量的）：
                   - **加载中不是这一档**——`thread.isLoading` 时**两个应用都是不画**
                     （上游 `message-list.tsx:707/717` 的 `latestAssistantGroupId` 与
                     `branchableAssistantGroupIds` 直接返回 null / 空集，本仓同形）；
                   - **静态整站模式在对齐范围之外**，本仓不实现 `STATIC_WEBSITE_ONLY`。
                   而「上传中」这一条**写下来的时候是假的**：调用点当时只传
                   `interactive = !isDemo`，上传中三颗照样点得动。第二十八轮才补上，
                   同一轮把这段话改成它真正兑现的样子。
                   分支与重新生成的 aria-label 与 tooltip 文案是同一份：tooltip 是给鼠标
                   用户补上可见名字，不是可访问名字的来源，所以 aria-label 不能因此去掉。
                   图标要认准上游那两颗：分支是 **GitBranchPlus**（带 + 号的那颗，
                   `message-list.tsx:808`）、重新生成是 **RefreshCcw**（逆时针，
                   `message-list.tsx:844`）。本仓此前用的是 GitBranch 与 RefreshCw——
                   名字只差一两个字母，画出来是另外两颗图标，而可访问性树看不见 svg
                   长什么样，所以对照台账永远不会报这一条。

                   容器上**不写** `text-muted-foreground`：上游那一行只有布局与
                   淡入类，颜色由 ghost 按钮自己继承。多写一句会把三颗图标整体调暗。

                   **复制那颗 wave 62 补上了可访问名，两边同改。** 此前这里写着
                   「照着 React 抄的例外：上游 CopyButton 只有图标和 tooltip」——
                   对上游的描述是准的，但**照抄的是一处缺陷**：tooltip 在 Radix / Reka
                   里都挂成 `aria-describedby`，不是可访问名，读屏器念出来就是一颗
                   光秃秃的「按钮」。wave 62 用 parity probe 普查跑完一轮之后的整屏，
                   React 的 2 个无名控件正是这两颗复制键（本文件与 HumanTurnActions）。
                   按 wave 28 的判据两边同改，React 侧改在
                   `frontend/src/components/workspace/copy-button.tsx`。
                   「两个应用必须念出同一句」这条不变——现在两边念的都是
                   `clipboard.copyToClipboard`。
-->

<script setup lang="ts">
import {
  Check,
  Copy,
  GitBranchPlusIcon,
  RefreshCcwIcon,
} from "lucide-vue-next";

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
    branchLabel: string;
    regenerateLabel: string;
    showBranch?: boolean;
    showRegenerate?: boolean;
    branchDisabled?: boolean;
    regenerateDisabled?: boolean;
  }>(),
  {
    showBranch: false,
    showRegenerate: false,
    branchDisabled: false,
    regenerateDisabled: false,
  },
);

const emit = defineEmits<{
  copy: [];
  branch: [];
  regenerate: [];
}>();
</script>

<template>
  <TooltipProvider>
    <div
      data-testid="assistant-turn-actions"
      class="mt-2 flex justify-start gap-1 opacity-0 transition-opacity delay-200 duration-300 group-hover:opacity-100"
    >
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="copyLabel"
            @click="emit('copy')"
          >
            <Check v-if="copied" class="text-green-500" />
            <Copy v-else />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ copyLabel }}</TooltipContent>
      </Tooltip>
      <Tooltip v-if="showBranch">
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="branchLabel"
            :disabled="branchDisabled"
            @click="emit('branch')"
          >
            <GitBranchPlusIcon class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ branchLabel }}</TooltipContent>
      </Tooltip>
      <Tooltip v-if="showRegenerate">
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="regenerateLabel"
            :disabled="regenerateDisabled"
            @click="emit('regenerate')"
          >
            <RefreshCcwIcon class="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ regenerateLabel }}</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
