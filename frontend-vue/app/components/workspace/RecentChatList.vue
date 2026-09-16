<!--
  【文件职责】     侧栏「最近的对话」那一组：取列表、按分支树展开、无限滚动。
  【架构位置】     L3
  【主要导出】     默认 RecentChatList 组件
  【依赖关系】     composables/useThreads · VirtualThreadList · ThreadSidebarItem · ui/sidebar
  【边界与注意】   **拆出来的理由是「谁持有 `POST /api/threads/search`」，不是文件长度。**
                   上游这一组是独立组件 `recent-chat-list.tsx`，`useInfiniteThreads`
                   写在它自己的函数体里，而它挂在 `<Sidebar>` 的 `isSidebarOpen` 分支下
                   ——窄屏抽屉关着、或者桌面收成图标条时整棵子树都不挂载，查询自然不跑。

                   本仓原来把这个查询写在 `ThreadSidebar` 的 setup 里，而 `ThreadSidebar`
                   是**抽屉外面**那一层，于是窄屏、抽屉关着也照发一次 `threads/search`。
                   对照台账 `scheduled-tasks#default` / `#load-failed` 两屏上
                   `requestsOnlyVue: POST /api/threads/search` 就是它（wave 214）。

                   **「谁发请求」和「谁改数据」是两件事**：改（重命名/置顶/删除）仍然
                   留在 `ThreadSidebar`，因为 `ProjectsSection` 的行也要用同一套处理器，
                   而那一套的失败要落在同一个对话框和同一条 alert 上。这里只往上抛事件，
                   与 `ProjectsSection.vue` 的 props/emits 形状刻意保持一致。

                   一条会话都没有时整组不渲染（`v-if="sidebarRows.length"`），
                   对上游 `RecentChatList` 的 `return null`。
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import ThreadSidebarItem from "@/components/workspace/ThreadSidebarItem.vue";
import VirtualThreadList from "@/components/workspace/VirtualThreadList.vue";
import { useThreads } from "@/composables/useThreads";
import { flattenThreadBranches } from "@/core/threads/thread-branch-tree";
import { pathOfThread } from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";

const props = defineProps<{
  activeThreadId: string | null;
  titleOf: (thread: AgentThread) => string;
  isActivePath: (path: string) => boolean;
  deletingThreadId: string | null;
}>();

const emit = defineEmits<{
  renameThread: [threadId: string];
  togglePinThread: [thread: AgentThread];
  deleteThread: [thread: AgentThread];
  newProjectForThread: [threadId: string];
  moveToProject: [threadId: string, projectId: string | null];
}>();

const { $i18n } = useNuxtApp();
/** **这个调用点是列表的取数方**（默认 `enabled`），见文件头。 */
const threads = useThreads();
const sentinel = ref<HTMLElement | null>(null);
/** 哨兵在不在视口里。见下面观察者那段注释：它必须是状态，不能只当事件用。 */
const sentinelVisible = ref(false);
let observer: IntersectionObserver | null = null;

/*
  侧栏显示的行 = 前 200 条（threads.displayedThreads）**加上当前打开的那条**，
  哪怕它已经掉出上限之外。React 的 RecentChatList 就是这么补的：翻得足够深再点开
  一条老会话，不补的话侧栏里没有任何一行是高亮的，用户看不出自己在哪儿。
*/
const sidebarThreads = computed(() => {
  const activeId = props.activeThreadId;
  if (!activeId) return threads.displayedThreads;
  if (
    threads.displayedThreads.some((thread) => thread.thread_id === activeId)
  ) {
    return threads.displayedThreads;
  }
  const active = threads.threads.find(
    (thread) => thread.thread_id === activeId,
  );
  return active
    ? [...threads.displayedThreads, active]
    : threads.displayedThreads;
});

/*
  侧栏列表按**分支树**展开：分叉出来的会话缩进挂在父会话下面，而不是按时间
  散在列表各处。摊成带 `thread_id` 的行，是因为虚拟列表的泛型只要求这一个字段
  （见 VirtualThreadList 的 `generic="Row extends { thread_id: string }"`），
  这样分支信息能一路带到行组件里而不用改那份契约。
*/
const sidebarRows = computed(() =>
  flattenThreadBranches(sidebarThreads.value).map((entry) => ({
    ...entry,
    thread_id: entry.thread.thread_id,
  })),
);

/*
  **观察者只记「哨兵在不在视口里」这个状态，翻页交给 watch。**

  写成「在回调里直接判 canLoadMore」是错的，而且错得很隐蔽：列表还空的时候
  哨兵本来就在视口内，回调触发一次、被 `canLoadMore === false` 挡掉；此后哨兵
  一直可见，**不会再有 intersection 事件**，于是首屏数据到了也永远不翻页。
  `scrollIntoViewIfNeeded` 对已在视口内的元素不滚动，也就不产生新事件——
  e2e `thread-list-infinite-scroll.spec.ts` 那条等满 15 秒超时就是这个形状。

  **一次性事件 + 依赖异步状态的守卫**本来就是脆的，改成状态 + watch 才是对的形状。
  `loadMore()` 自己有在途守卫，重复触发安全。
*/
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      sentinelVisible.value = entries.some((entry) => entry.isIntersecting);
    },
    { rootMargin: "120px 0px 120px 0px" },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
onUnmounted(() => observer?.disconnect());

watch([sentinelVisible, () => threads.canLoadMore], ([visible, canLoad]) => {
  if (visible && canLoad) void threads.loadMore();
});

watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous);
  if (element) observer?.observe(element);
});
</script>

<template>
  <!--
    一条会话都没有的时候，标题和列表**都不渲染**——React 的 RecentChatList 在
    threads.length === 0 时直接 return null。留一个空标题加一个空 ul，读屏器会
    念出「最近的对话，列表，0 项」，而屏幕上其实什么都没有。
  -->
  <SidebarGroup v-if="sidebarRows.length">
    <SidebarGroupLabel>
      {{ $i18n.t.value.sidebar.recentChats }}
    </SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <!--
          按钮和哨兵是 ul 的**非 li 子节点**，与 React 一样：它们不是列表项，
          包进 li 会让读屏器把「加载更早的对话」念成第 51 个会话。哨兵还要
          aria-hidden——一个 1px 高的空 li 在可访问性树里是一个真实的 listitem。
        -->
        <div class="flex w-full flex-col gap-1" style="overflow-anchor: none">
          <VirtualThreadList
            :estimate-size="36"
            :gap="4"
            :items="sidebarRows"
            scroll-parent-selector='[data-sidebar="content"]'
          >
            <template #default="{ thread: row }">
              <ThreadSidebarItem
                :thread="row.thread"
                :title="props.titleOf(row.thread)"
                :is-active="props.isActivePath(pathOfThread(row.thread))"
                :pinned="threads.isPinned(row.thread)"
                :deleting="props.deletingThreadId === row.thread.thread_id"
                :branch-entry="row"
                @rename="emit('renameThread', row.thread.thread_id)"
                @toggle-pin="emit('togglePinThread', row.thread)"
                @delete="emit('deleteThread', row.thread)"
                @new-project-for-thread="
                  emit('newProjectForThread', row.thread.thread_id)
                "
                @move-to-project="
                  emit('moveToProject', row.thread.thread_id, $event)
                "
              />
            </template>
          </VirtualThreadList>
          <template v-if="threads.hasMore && threads.canLoadMore">
            <!--
              上游 `recent-chat-list.tsx:434` 是
              `<Button variant="ghost" size="sm"
              className="mx-2 my-1 w-[calc(100%-1rem)] justify-center text-xs">`。
              手写那版把悬停色写成了 **sidebar-accent**，而上游这一颗走的是
              Button 的 ghost 变体、用的是普通 **accent**——两套变量在深色主题下
              不是同一个值。另外少 `cursor-pointer`、3px 焦点环、
              `dark:hover:bg-accent/50`、`gap-1.5` 与 `font-medium`。
            -->
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="recent-chat-list-load-more"
              :disabled="threads.loadingMore"
              class="mx-2 my-1 w-[calc(100%-1rem)] justify-center text-xs"
              @click="threads.loadMore()"
            >
              {{
                threads.loadingMore
                  ? $i18n.t.value.chats.loadingMore
                  : $i18n.t.value.chats.loadOlderChats
              }}
            </Button>
            <div
              ref="sentinel"
              aria-hidden="true"
              data-testid="recent-chat-list-sentinel"
              class="h-px w-full"
            />
          </template>
        </div>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
