<script setup lang="ts">
/*
  【文件职责】     单个 recent thread 的 rename/pin/share/export/delete menu owner。
  【架构位置】     L3 workspace navigation
  【主要导出】     默认 ThreadActionsMenu 组件
  【依赖关系】     ui/dropdown-menu · thread API/export · clipboard · toast
  【边界与注意】   不复制 thread list；export 临时状态仅属于这一菜单实例。
*/
import { ref } from "vue";
import {
  Archive,
  Download,
  FileJson,
  FileText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Share2,
  Trash2,
} from "lucide-vue-next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MoveToProjectMenu from "@/components/workspace/projects/MoveToProjectMenu.vue";
import { useThreadArchiveAction } from "@/composables/useThreadArchiveAction";
import { getAPIClient } from "@/core/api/api-client";
import { writeTextToClipboard } from "@/core/clipboard";
import { exportThread, type ThreadExportFormat } from "@/core/threads/export";
import {
  buildThreadShareUrl,
  loadThreadExportMessages,
} from "@/core/threads/thread-actions";
import type { AgentThread } from "@/core/threads/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{
  thread: AgentThread;
  pinned: boolean;
  deleting?: boolean;
}>();
const emit = defineEmits<{
  rename: [];
  togglePin: [];
  delete: [];
  /** 新建项目并把本会话移进去——对话框由常驻的上层持有，这里只报事件。 */
  newProjectForThread: [];
  moveToProject: [projectId: string | null];
}>();

const archiveAction = useThreadArchiveAction();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const exporting = ref<ThreadExportFormat | null>(null);
const sharing = ref(false);

async function shareThread() {
  if (sharing.value) return;
  sharing.value = true;
  try {
    const url = buildThreadShareUrl(props.thread, globalThis.location.origin);
    const copied = await writeTextToClipboard(url);
    if (!copied) {
      toast.error($i18n.t.value.clipboard.failedToCopyToClipboard);
      return;
    }
    toast.success($i18n.t.value.clipboard.linkCopied);
  } catch {
    // 剪贴板失败恒念同一句，不把底层错误原文抛给用户——React 的两条失败路径
    // （didCopy 为假、以及 API 直接 reject）用的都是这一条。
    toast.error($i18n.t.value.clipboard.failedToCopyToClipboard);
  } finally {
    sharing.value = false;
  }
}

async function exportConversation(format: ThreadExportFormat) {
  if (exporting.value) return;
  exporting.value = format;
  try {
    const messages = await loadThreadExportMessages(
      getAPIClient(),
      props.thread.thread_id,
    );
    // 空会话是一条**正常**分支，不是失败：判据是长度，不是错误消息长什么样。
    if (messages.length === 0) {
      toast.error($i18n.t.value.conversation.noMessages);
      return;
    }
    exportThread(props.thread, messages, format);
    toast.success($i18n.t.value.common.exportSuccess);
  } catch {
    // 失败恒念同一句：React 的 catch 是裸的 `t.common.exportFailed`，不透传
    // Gateway 的 detail。把后端原文端到用户面前，两个应用念的就不是一句话了。
    toast.error($i18n.t.value.common.exportFailed);
  } finally {
    exporting.value = null;
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger>
      <!--
        绝对定位，压在会话行的右侧内边距上——这是 React 的 SidebarMenuAction
        （frontend/src/components/ui/sidebar.tsx），行本身用 `pr-8` 给它让位。
        原来它是同一行里的 flex 兄弟，于是链接被挤成 `flex-1`：会话标题量出来是
        「整行减去按钮」而不是文字本身，宽度、高度、颜色三项全落在 React 之外。

        **类串照上游「渲染之后」的结果写**，不是照 `SidebarMenuAction` 的基类：
        上游调用点（`recent-chat-list.tsx:356`）用 `cn()` 覆盖掉两条
        （`bg-background/50 hover:bg-background` 顶掉基类的 `hover:bg-sidebar-accent`，
        `after:left-0!` 顶掉 `-inset-2` 的左边）。本仓这里是普通 class 属性、
        没有 tailwind-merge，两条冲突的类**谁赢由样式表顺序决定而不是书写顺序**，
        所以只写赢的那一条。

        **wave 147 修掉的两处，都只在触摸设备上才现形**：

        - `opacity-0` 写成了无条件的，上游是 `md:opacity-0`（768px 以下**始终可见**）。
          触摸设备没有 hover，`group-hover/menu-item:opacity-100` 永远不触发——
          实测 375px 打开抽屉后 React `opacity=1`、本仓 `opacity=0`：
          置顶/重命名/分享/导出/删除这一整组动作在手机上**根本够不着**。
        - 少了上游那句注释写得明明白白的
          `after:absolute after:-inset-2 md:after:hidden`（"Increases the hit area
          of the button on mobile."）。实测同一处：React 有效点击区 **28×36**、
          本仓 **20×20**——20 低于 WCAG 2.5.8 的 24×24 下限。

        另外补上键盘焦点环（`ring-sidebar-ring focus-visible:ring-2 outline-hidden`），
        本仓此前一条都没有。**没有跟的**：`peer-data-[size=*]/menu-button:top-*`
        （本仓的菜单按钮没有 `data-size`）与 `group-data-[collapsible=icon]:hidden`
        （本仓侧栏没有 icon 收起档）——两条的标记都不存在，跟了就是死类。
      -->
      <button
        type="button"
        :aria-label="$i18n.t.value.common.more"
        class="text-sidebar-foreground ring-sidebar-ring bg-background/50 hover:bg-background hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 after:absolute after:-inset-2 after:left-0! focus-visible:ring-2 data-[state=open]:opacity-100 md:opacity-0 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0"
      >
        <MoreHorizontal :size="16" />
      </button>
    </DropdownMenuTrigger>
    <!--
      顺序、分隔线位置和「导出」那一层子菜单都照 React 的 RecentChatList
      （frontend/src/components/workspace/recent-chat-list.tsx）：
      置顶 → 重命名 → 分享 → 导出(子菜单) → 分隔线 → 删除，**只有一条分隔线**。
      原来是「重命名 → 置顶 → 分隔线 → 分享 → 导出 md → 导出 json → 分隔线 → 删除」：
      顺序不同、多一条分隔线，而且把子菜单摊平成两个平级项——读屏器在 React 上听到
      的是「导出，子菜单」，在 Vue 上听到的是两个并列动作，菜单的形状根本不是一个。
      现有对照场景没有一条会点开这个菜单，所以台账一条都报不出来。
    -->
    <!--
      定位与盒子照上游 recent-chat-list.tsx:362：`side="right" align="start"`，
      内容盒 `w-48 rounded-lg`。原来写的是 `align="end"` 且**不传 side**（默认 bottom）
      加 `min-w-48`——菜单整个落在侧栏**里面**而不是侧栏右侧。
      wave 86 把这个菜单接进取样面之后一次量到：三个菜单项 **x 全差 -196、y 全差 24**
      （坑 215 的同一条：一条 x 差比 popper 的任何参数都大，先去量朝向）。
    -->
    <DropdownMenuContent side="right" align="start" class="w-48 rounded-lg">
      <!--
        上游 recent-chat-list.tsx:370 **按置顶态换图标**：已置顶画 `PinOff`
        （取消置顶），未置顶画 `Pin`。本仓原来两种状态都画 `Pin`——
        文字换了、图标没换。
      -->
      <DropdownMenuItem @select="emit('togglePin')">
        <component :is="pinned ? PinOff : Pin" :size="14" />
        {{
          pinned ? $i18n.t.value.chats.unpinChat : $i18n.t.value.chats.pinChat
        }}
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('rename')">
        <Pencil :size="14" /> {{ $i18n.t.value.common.rename }}
      </DropdownMenuItem>
      <DropdownMenuItem
        :disabled="archiveAction.isPending.value"
        @select="archiveAction.setArchived(props.thread.thread_id, true)"
      >
        <Archive :size="14" /> {{ $i18n.t.value.chats.archiveChat }}
      </DropdownMenuItem>
      <MoveToProjectMenu
        :thread="props.thread"
        @new-project="emit('newProjectForThread')"
        @move-project="emit('moveToProject', $event)"
      />
      <DropdownMenuItem
        data-testid="thread-share"
        :disabled="sharing"
        @select="shareThread"
      >
        <Share2 :size="14" /> {{ $i18n.t.value.common.share }}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger data-testid="thread-export-submenu">
          <Download :size="14" /> {{ $i18n.t.value.common.export }}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            data-testid="thread-export-markdown"
            :disabled="Boolean(exporting)"
            @select="exportConversation('markdown')"
          >
            <FileText :size="14" />
            {{ $i18n.t.value.common.exportAsMarkdown }}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="thread-export-json"
            :disabled="Boolean(exporting)"
            @select="exportConversation('json')"
          >
            <FileJson :size="14" /> {{ $i18n.t.value.common.exportAsJSON }}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <!--
        **不传 `variant="destructive"`**：上游这颗删除项是普通项
        （recent-chat-list.tsx:419，图标走 `[&_svg:not([class*='text-'])]:text-muted-foreground`），
        而且**全仓没有一处**给 `DropdownMenuItem` 传过 destructive——那个 variant
        只用在 Button 与 Alert 上。本仓原来把它画成红的，量出来是
        `color React=rgba(10,10,10,255) Vue=rgba(231,0,11,255)`。
        红色在这里不是可访问性要求（项本身有 "Delete" 文字和垃圾桶图标），
        所以按双向规则删掉本仓多出来的这一处。
      -->
      <DropdownMenuItem :disabled="deleting" @select="emit('delete')">
        <Trash2 :size="14" /> {{ $i18n.t.value.common.delete }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
