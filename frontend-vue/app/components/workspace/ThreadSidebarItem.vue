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

                   **行的样式走 `SidebarMenuButton as-child`，不再手抄类串**
                   （wave 203）。手抄那版只带了 `data-[active=true]` 的背景色与前景色，
                   漏了同一串里的 `data-[active=true]:font-medium`——于是**当前这条会话
                   在侧栏里不加粗**，而上游加粗。对照台账 `thread-title-sync` 上
                   `text:Renamed title fontWeight React=500 Vue=400` 报的就是它
                   （宽度那 2.1px 是同一处差异的第二个投影）。
                   顺带一起回来的还有键盘焦点环（`outline-hidden ring-sidebar-ring
                   focus-visible:ring-2`）、`hover:text-sidebar-accent-foreground`、
                   `active:*` 与 `transition-[width,height,padding]`——都是手抄时漏的。

                   `pr-8` 仍然写在调用点：上游那 8px 是
                   `group-has-data-[sidebar=menu-action]/menu-item:pr-8` 给
                   `SidebarMenuAction` 让出来的，而本仓的操作菜单是普通
                   `DropdownMenuTrigger`（理由见 ThreadActionsMenu.vue），
                   没有 `data-sidebar="menu-action"`，那条选择器不会命中。
-->
<script setup lang="ts">
import { computed } from "vue";

import { Pin } from "lucide-vue-next";

import ThreadActionsMenu from "@/components/workspace/ThreadActionsMenu.vue";
import ThreadChannelBadge from "@/components/workspace/ThreadChannelBadge.vue";
import ThreadChannelIcon from "@/components/workspace/ThreadChannelIcon.vue";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
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
    <SidebarMenuButton :is-active="props.isActive" as-child>
      <NuxtLink
        :to="pathOfThread(props.thread)"
        :aria-label="branchLabel"
        :title="branchLabel"
        :data-branch-depth="
          props.branchEntry && props.branchEntry.depth > 0
            ? props.branchEntry.depth
            : undefined
        "
        :data-branch-parent-id="props.branchEntry?.parentThread?.thread_id"
        class="text-muted-foreground min-w-0 pr-8 whitespace-nowrap"
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
    </SidebarMenuButton>
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
