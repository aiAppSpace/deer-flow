<!--
  【文件职责】     侧栏里的一条会话行：链接 + 渠道图标/徽标 + 固定标记 + 操作菜单。
  【架构位置】     L3 product UI
  【主要导出】     默认 ThreadSidebarItem 组件
  【依赖关系】     ui/sidebar(MenuItem/MenuButton) · ThreadChannelIcon/Badge · ThreadActionsMenu
  【边界与注意】   **从 `ThreadSidebar.vue` 的内联标记抽出来的**，一字不改地保留原有取舍：

                   标题包在 `min-w-0 truncate` 的 span 里、链接本身是 `h-8 ... p-2 pr-8` 的行。
                   这不是随手写的——此前标题是链接的裸文本、操作菜单是同一行的 flex 兄弟，
                   于是「会话标题」这个可视元素量出来是整行（撑满 203px、高 32px、前景色），
                   而 React 那份是文字宽度、20px 高、muted 色。对照台账上就差在这里。

                   抽出来的原因是**项目分组也要渲染会话行**：再复制一份标记，
                   上面那段取舍就会在两处各漂各的。
-->
<script setup lang="ts">
import { computed } from "vue";

import { Pin } from "lucide-vue-next";

import ThreadActionsMenu from "@/components/workspace/ThreadActionsMenu.vue";
import ThreadChannelBadge from "@/components/workspace/ThreadChannelBadge.vue";
import ThreadChannelIcon from "@/components/workspace/ThreadChannelIcon.vue";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import {
  channelSourceOfThread,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";
import type { ThreadBranchEntry } from "@/core/threads/thread-branch-tree";
import type { AgentThread } from "@/core/threads/types";

const props = defineProps<{
  thread: AgentThread;
  title: string;
  isActive: boolean;
  pinned: boolean;
  deleting: boolean;
  /**
   * 这一行在分支树里的位置。给了才画树枝符号和缩进。
   *
   * 树枝是**纯装饰**（`aria-hidden`）：读屏器念「└─」毫无意义，
   * 「这是从哪条会话分叉出来的」由链接的可访问名说（`chats.branchLabel`）。
   */
  branchEntry?: ThreadBranchEntry;
}>();

const { $i18n } = useNuxtApp();

/*
  只有真的知道父会话是谁才给这个名字——只有 depth 没有 parentThread 时
  （父会话不在当前这一页里）说不出「分叉自谁」，那就退回普通标题，
  而不是造一句「分叉自 undefined」。
*/
const branchLabel = computed(() => {
  const parent = props.branchEntry?.parentThread;
  if (!parent) return undefined;
  return $i18n.t.value.chats.branchLabel(
    props.title,
    titleOfThread(parent, $i18n.t.value.pages.untitled),
  );
});
/** 缩进最多退一档：再深下去侧栏就没有可用宽度了（上游同一条封顶）。 */
const branchIndentPx = computed(() =>
  props.branchEntry && props.branchEntry.depth > 0
    ? Math.min(props.branchEntry.depth - 1, 1) * 8
    : null,
);

defineEmits<{
  rename: [];
  togglePin: [];
  delete: [];
  newProjectForThread: [];
  moveToProject: [projectId: string | null];
}>();
</script>

<template>
  <SidebarMenuItem>
    <NuxtLink
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      :to="pathOfThread(props.thread)"
      :data-active="props.isActive"
      :aria-label="branchLabel"
      :title="branchLabel"
      :data-branch-depth="
        props.branchEntry && props.branchEntry.depth > 0
          ? props.branchEntry.depth
          : undefined
      "
      :data-branch-parent-id="props.branchEntry?.parentThread?.thread_id"
      class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground peer/menu-button flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 pr-8 text-left text-sm whitespace-nowrap"
    >
      <span
        v-if="branchIndentPx !== null"
        aria-hidden="true"
        data-testid="thread-branch-stem"
        class="text-muted-foreground/70 shrink-0 font-mono text-[10px] leading-none"
        :style="{ marginLeft: `${branchIndentPx}px` }"
        >{{ props.branchEntry?.isLastSibling ? "└─" : "├─" }}</span
      >
      <ThreadChannelIcon :source="channelSourceOfThread(props.thread)" />
      <Pin
        v-if="props.pinned"
        aria-hidden="true"
        class="text-muted-foreground size-3.5 shrink-0"
      />
      <span class="min-w-0 truncate">{{ props.title }}</span>
      <ThreadChannelBadge
        :source="channelSourceOfThread(props.thread)"
        class="ml-auto h-5 max-w-14 shrink-0 px-1.5 text-[10px]"
      />
    </NuxtLink>
    <ThreadActionsMenu
      :thread="props.thread"
      :pinned="props.pinned"
      :deleting="props.deleting"
      @rename="$emit('rename')"
      @toggle-pin="$emit('togglePin')"
      @delete="$emit('delete')"
      @new-project-for-thread="$emit('newProjectForThread')"
      @move-to-project="$emit('moveToProject', $event)"
    />
  </SidebarMenuItem>
</template>
