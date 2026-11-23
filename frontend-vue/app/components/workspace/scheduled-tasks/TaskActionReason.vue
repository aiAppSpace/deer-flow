<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
defineProps<{ reason?: string | null }>();
</script>
<template>
  <Tooltip v-if="reason" :delay-duration="200"
    ><TooltipTrigger as-child
      ><span
        tabindex="0"
        class="inline-flex rounded-md"
        :data-disabled-reason="reason"
        ><slot /></span></TooltipTrigger
    ><TooltipContent>{{ reason }}</TooltipContent></Tooltip
  ><slot v-else />
</template>
