<!--
  【文件职责】     侧栏顶部那一组导航入口（对话 / 智能体 / 定时任务）。
  【架构位置】     L3
  【主要导出】     默认 WorkspaceNavChatList 组件
  【依赖关系】     composables/useWorkspaceFeatures · composables/useWorkspaceSidebar · ui/sidebar
  【边界与注意】   **拆出来的理由是「谁持有 `GET /api/features`」，不是文件长度。**
                   上游这一组是独立组件 `workspace-nav-chat-list.tsx`，`useAgentsApiEnabled`
                   写在它自己的函数体里，而它是 `<Sidebar>` 的**子节点**——窄屏抽屉关着
                   的时候整棵子树不挂载，这个查询自然不跑。

                   本仓原来把它写在 `ThreadSidebar` 的 setup 里，而 `ThreadSidebar`
                   是**抽屉外面**那一层，于是窄屏、抽屉关着也照发一次 `features`。
                   对照台账 `scheduled-tasks#default` / `#load-failed` 两屏上
                   `requestsOnlyVue: GET /api/features` 就是它（wave 214）。
                   **所以这个查询必须住在抽屉里面的组件里**——别再把它提上去。
-->
<script setup lang="ts">
import { ref, watch } from "vue";
import { Blocks, Bot, CalendarClock, MessagesSquare } from "lucide-vue-next";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAgentsApiEnabled } from "@/composables/useWorkspaceFeatures";
import { useWorkspaceSidebar } from "@/composables/useWorkspaceSidebar";

const { $i18n } = useNuxtApp();
const route = useRoute();
const { collapsed } = useWorkspaceSidebar();
const features = useAgentsApiEnabled();
const disabledTooltipOpen = ref(false);

// React's focus handler bubbles from the button to its hoverable wrapper.
// Native focusin/out provide the same focus-within boundary without a tab stop.
function onDisabledTooltipFocusOut(event: FocusEvent) {
  const host = event.currentTarget as HTMLElement;
  if (event.relatedTarget instanceof Node && host.contains(event.relatedTarget))
    return;
  disabledTooltipOpen.value = false;
}

watch(
  features.agentsApiEnabled,
  () => {
    disabledTooltipOpen.value = false;
  },
  { flush: "sync" },
);

function isActive(path: string) {
  return route.path === path;
}
</script>

<template>
  <SidebarGroup class="pt-1">
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          as-child
          :is-active="isActive('/workspace/chats')"
          :tooltip="$i18n.t.value.sidebar.chats"
          :tooltip-hidden="!collapsed"
        >
          <NuxtLink class="text-muted-foreground" to="/workspace/chats">
            <MessagesSquare :size="16" class="shrink-0" />
            <span>{{ $i18n.t.value.sidebar.chats }}</span>
          </NuxtLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          v-if="features.agentsApiEnabled.value"
          as-child
          :is-active="route.path.startsWith('/workspace/agents')"
          :tooltip="$i18n.t.value.sidebar.agents"
          :tooltip-hidden="!collapsed"
        >
          <NuxtLink class="text-muted-foreground" to="/workspace/agents">
            <Bot :size="16" class="shrink-0" />
            <span>{{ $i18n.t.value.sidebar.agents }}</span>
          </NuxtLink>
        </SidebarMenuButton>
        <!--
          禁用那一支的**外观**照上游 workspace-nav-chat-list.tsx:56 抄三条：
          ① 包裹层 `cursor-not-allowed`——上游明写在这一层（还留了注释说明
             为什么在 span 上而不在按钮上：按钮已经 pointer-events:none）；
          ② 按钮 `aria-disabled:pointer-events-none aria-disabled:opacity-50`
             ——上游 SidebarMenuButton 的 cva 自带这两条，本仓原来一条都没有，
             于是这个禁用的入口**还会跟着鼠标高亮**，看起来和能点的一样；
          ③ 颜色是 `text-muted-foreground/50`（半透明），不是全实的 muted。
        -->
        <Tooltip v-else v-model:open="disabledTooltipOpen">
          <TooltipTrigger as-child>
            <span
              class="block w-full cursor-not-allowed"
              @focusin="disabledTooltipOpen = true"
              @focusout="onDisabledTooltipFocusOut"
            >
              <SidebarMenuButton
                type="button"
                class="text-muted-foreground/50"
                :aria-label="$i18n.t.value.sidebar.agents"
                aria-disabled="true"
                aria-describedby="agents-disabled-description"
              >
                <Bot :size="16" class="shrink-0" />
                <span>{{ $i18n.t.value.sidebar.agents }}</span>
              </SidebarMenuButton>
              <span id="agents-disabled-description" class="sr-only">{{
                $i18n.t.value.sidebar.agentsDisabledTooltip
              }}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">{{
            $i18n.t.value.sidebar.agentsDisabledTooltip
          }}</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          as-child
          :is-active="route.path.startsWith('/workspace/scheduled-tasks')"
          :tooltip="$i18n.t.value.sidebar.scheduledTasks"
          :tooltip-hidden="!collapsed"
        >
          <NuxtLink
            to="/workspace/scheduled-tasks"
            class="text-muted-foreground"
          >
            <CalendarClock :size="16" class="shrink-0" />
            <span>{{ $i18n.t.value.sidebar.scheduledTasks }}</span>
          </NuxtLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          as-child
          :is-active="route.path.startsWith('/workspace/capabilities')"
        >
          <NuxtLink class="text-muted-foreground" to="/workspace/capabilities">
            <Blocks :size="16" class="shrink-0" />
            <span>{{ $i18n.t.value.capabilities.title }}</span>
          </NuxtLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>
