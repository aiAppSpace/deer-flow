<!--
  【文件职责】     项目详情页里的「对话」区：虚拟化列表 + 加载更多。
  【架构位置】     L3 product UI
  【主要导出】     默认 ProjectThreadsSection 组件
  【依赖关系】     VirtualThreadList · core/utils/datetime · core/threads/utils
  【边界与注意】   **列表相对页面的 ScrollArea 视口做窗口化**，不是自己再套一层滚动：
                   一个长期使用的项目翻久了 DOM 会无限长大，与侧栏、/workspace/chats
                   用的是同一套窗口化。滚动父级用 `[data-slot="scroll-area-viewport"]` 定位。

                   空态与错误态是**两种不同的文案**：加载失败说「读不出来」，
                   真的没有对话说「还没有」——把失败显示成空会让人以为对话丢了。
                   `!query.isLoading` 那一半也承重：首屏加载中不能先闪一下空态。
-->
<script setup lang="ts">
import { computed } from "vue";

import { Button } from "@/components/ui/button";
import VirtualThreadList from "@/components/workspace/VirtualThreadList.vue";
import type { ProjectThread } from "@/core/projects";
import { pathOfThread } from "@/core/threads/utils";
import { formatTimeAgo } from "@/core/utils/datetime";
import { cn } from "@/lib/utils";

const props = defineProps<{
  threads: readonly ProjectThread[];
  isError: boolean;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}>();
const emit = defineEmits<{ loadMore: [] }>();

const { $i18n } = useNuxtApp();

const items = computed(() => [...props.threads]);
const showEmpty = computed(
  () => props.threads.length === 0 && !props.isLoading,
);

function titleOf(thread: ProjectThread) {
  return thread.display_name?.trim()
    ? thread.display_name
    : $i18n.t.value.projects.untitled;
}

function hrefOf(thread: ProjectThread) {
  return pathOfThread({
    thread_id: thread.thread_id,
    metadata: thread.metadata ?? {},
  } as Parameters<typeof pathOfThread>[0]);
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <h2 class="text-muted-foreground text-sm font-medium">
      {{ $i18n.t.value.projects.threads }}
    </h2>
    <div class="rounded-lg border">
      <div v-if="props.isError" class="text-muted-foreground p-4 text-sm">
        {{ $i18n.t.value.projects.threadsLoadFailed }}
      </div>
      <div v-else-if="showEmpty" class="text-muted-foreground p-4 text-sm">
        {{ $i18n.t.value.projects.empty }}
      </div>
      <VirtualThreadList
        v-else
        :estimate-size="56"
        :items="items"
        scroll-parent-selector='[data-slot="scroll-area-viewport"]'
      >
        <template #default="{ thread, index }">
          <NuxtLink :to="hrefOf(thread)">
            <div
              :class="
                cn(
                  'hover:bg-muted/50 flex min-w-0 items-center gap-2 p-4 transition-colors',
                  index !== items.length - 1 && 'border-b',
                )
              "
            >
              <div class="min-w-0 flex-1 truncate">{{ titleOf(thread) }}</div>
              <div
                v-if="thread.updated_at"
                class="text-muted-foreground shrink-0 text-sm"
              >
                {{ formatTimeAgo(thread.updated_at, $i18n.locale.value) }}
              </div>
            </div>
          </NuxtLink>
        </template>
      </VirtualThreadList>
    </div>
    <Button
      v-if="props.hasNextPage"
      variant="ghost"
      size="sm"
      class="justify-center text-xs"
      :disabled="props.isFetchingNextPage"
      data-testid="project-threads-load-more"
      @click="emit('loadMore')"
    >
      {{
        props.isFetchingNextPage
          ? $i18n.t.value.chats.loadingMore
          : $i18n.t.value.chats.loadOlderChats
      }}
    </Button>
  </section>
</template>
