<script setup lang="ts">
/*
  【文件职责】     按 feature gate 切换 browser-view 面板。
  【架构位置】     L3
  【主要导出】     默认 BrowserTrigger 组件
  【依赖关系】     Button L2 · Tooltip L2 · lucide-vue-next
  【边界与注意】   **用 Button primitive，不要手搓一个 `<button class="size-8">`。**
                   原来那版是手写的：尺寸 32×32、字号继承成 16px，而上游用
                   `<Button size="icon">`（`size-9` = 36×36，`text-sm` = 14px）。
                   对照台账上因此有四条几何差（width / height / fontSize，以及被尺寸
                   推出来的 x）。**几何差是结构算出来的，不要去调数字**——把
                   `size-8` 改成 `size-9` 能对上两个数，剩下两个还是差的。

                   图标不传 `:size`：`buttonVariants` 里有
                   `[&_svg:not([class*='size-'])]:size-4`，交给它才和上游同源。

                   关闭态的名字取 `common.close`（上游 `browser-trigger.tsx` 就是
                   `t.common.close`），不是 `browser.close`——后者是 "Close browser"，
                   与上游的 "Close" 不是同一句。这条台账测不到：取样时面板是关着的，
                   只走得到 `common.showBrowser` 那一支。

                   tooltip 与上游同形（`delayDuration={500}` + `asChild` 触发器，
                   两边的 `TooltipTrigger` 默认都是 as-child，所以不会多出 DOM 节点）。
*/
import { computed } from "vue";

import { Monitor } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const props = defineProps<{ open: boolean }>();
defineEmits<{ toggle: [] }>();
const { $i18n } = useNuxtApp();
const label = computed(() =>
  props.open ? $i18n.t.value.common.close : $i18n.t.value.common.showBrowser,
);
</script>

<template>
  <Tooltip :delay-duration="500">
    <TooltipTrigger>
      <Button
        :aria-label="label"
        class="text-muted-foreground hover:text-foreground"
        data-testid="browser-trigger"
        size="icon"
        type="button"
        :variant="open ? 'secondary' : 'ghost'"
        @click="$emit('toggle')"
      >
        <Monitor />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ label }}</TooltipContent>
  </Tooltip>
</template>
