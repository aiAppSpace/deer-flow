<!--
  Assistant action presentation; MessageList owns availability and execution.
  Rendering and disabled state stay separate for read-only or busy turns.
  Each icon button keeps its own accessible name alongside its tooltip.
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
    copiedLabel?: string;
    branchLabel: string;
    regenerateLabel: string;
    showCopy?: boolean;
    showBranch?: boolean;
    showRegenerate?: boolean;
    branchDisabled?: boolean;
    regenerateDisabled?: boolean;
  }>(),
  {
    showCopy: true,
    showBranch: false,
    showRegenerate: false,
    branchDisabled: false,
    regenerateDisabled: false,
    copiedLabel: undefined,
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
      class="mt-2 flex justify-start gap-1 opacity-100 transition-opacity delay-200 duration-300 focus-within:opacity-100 has-[[data-state=open]]:opacity-100 sm:opacity-0 sm:group-hover/assistant-turn:opacity-100"
    >
      <Tooltip v-if="showCopy">
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
      <slot name="details" />
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
            <RefreshCcwIcon class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ regenerateLabel }}</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
