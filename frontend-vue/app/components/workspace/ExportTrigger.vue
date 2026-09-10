<script setup lang="ts">
/*
  【文件职责】     导出当前可见会话为 Markdown 或 JSON。
  【架构位置】     L3 workspace chat header
  【主要导出】     默认 ExportTrigger 组件
  【依赖关系】     Button L2 · Tooltip L2 · ui/dropdown-menu · core/threads/export · workspace toast
  【边界与注意】   只消费父层已拥有的 thread/messages，不另建请求或消息缓存。

                   **用 Button primitive，不要手搓一个 `<button class="h-8 px-2">`。**
                   原来那版是手写的：`h-8`（32px）、`px-2`（8px）、字重继承成 400，
                   而上游 `export-trigger.tsx` 是不传 size 的 `<Button variant="ghost">`，
                   也就是 `h-9 px-4 py-2 has-[>svg]:px-3` + `text-sm font-medium`
                   ——实测 36×91.3 对 32×82.2。

                   那 9.1px 的宽度差**全部**落在头部台账上：这颗按钮右对齐在头部末尾，
                   它窄多少，它左边的 browser-trigger 就往右挪多少
                   （实测 x React=1127.7 / Vue=1136.8）。拆开是 padding 12×2 对 8×2 的
                   8px，加上 "Export" 在 font-medium 与 font-normal 下的 1.1px。
                   **不要去调 x**——差是结构算出来的。

                   tooltip 与上游同形（`delayDuration={500}` + as-child 触发器）。上游把
                   Tooltip 套在 DropdownMenuTrigger 外面，两层都是 as-child，最终塌到
                   同一颗 Button 上，不会多出 DOM 节点。

                   图标不传 `:size`：`buttonVariants` 里有
                   `[&_svg:not([class*='size-'])]:size-4`，交给它才和上游同源。
*/
import { Download, FileJson, FileText } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { exportThread, type ThreadExportFormat } from "@/core/threads/export";
import type { AgentThread } from "@/core/threads/types";
import type { Message } from "@/core/types/message";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{
  threadId: string;
  thread: AgentThread;
  messages: Message[];
}>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();

function exportConversation(format: ThreadExportFormat) {
  if (!props.messages.length) return;
  try {
    exportThread(props.thread, props.messages, format);
    toast.success($i18n.t.value.common.exportSuccess);
  } catch {
    toast.error($i18n.t.value.common.exportFailed);
  }
}
</script>

<template>
  <DropdownMenu v-if="messages.length">
    <Tooltip :delay-duration="500">
      <TooltipTrigger>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            class="text-muted-foreground hover:text-foreground"
            :aria-label="$i18n.t.value.common.export"
          >
            <Download />
            <span class="hidden sm:inline">{{
              $i18n.t.value.common.export
            }}</span>
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>{{ $i18n.t.value.common.export }}</TooltipContent>
    </Tooltip>
    <!--
      宽度不另加下限：上游就是 `<DropdownMenuContent align="end">`，
      primitive 自带的 `min-w-32` 已经是同一条下限。原来这里多写的 `min-w-48`
      只在两条菜单项都比 12rem 窄时才看得出来，而它永远不会——但它是一处
      台账照不到的分叉，照上游写就没有这个问题。
    -->
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        data-testid="header-export-markdown"
        @select="exportConversation('markdown')"
      >
        <FileText class="text-muted-foreground" />
        {{ $i18n.t.value.common.exportAsMarkdown }}
      </DropdownMenuItem>
      <DropdownMenuItem
        data-testid="header-export-json"
        @select="exportConversation('json')"
      >
        <FileJson class="text-muted-foreground" />
        {{ $i18n.t.value.common.exportAsJSON }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
