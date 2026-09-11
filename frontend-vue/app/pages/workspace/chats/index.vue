<script setup lang="ts">
/*
  【文件职责】     会话列表页：搜索、无限滚动分页与会话入口。
  【架构位置】     L3 application page
  【主要导出】     默认 chats index page
  【依赖关系】     useThreads · WorkspaceContainer · ScrollArea · thread channel source
  【边界与注意】   DeerFlow 路由接线，不属于 L2。

                   一行**就是一个链接**，标题与相对时间都是链接里的普通 div：React 的
                   renderItem 就是这个形状（frontend/src/app/workspace/chats/page.tsx），
                   于是链接的可访问名是「Conversation 001 about 1 year ago」一整句。
                   把时间换成 <time> 看起来更语义，实测却会在可访问性树里多出一个
                   `time` 节点，并把标题挤成一个独立的 `text` 节点——同一行，React 报
                   1 个节点、Vue 报 3 个。

                   搜索框是 `type="search"`（role=searchbox），不是普通 textbox：
                   读屏器据此念出「搜索框」，两边必须一致。

                   分页有两条互斥的路：没有搜索时是哨兵自动加载，搜索时换成一颗显式
                   按钮。理由写在 React 那边（issue #3482）：过滤到空列表时哨兵会一直
                   停在视口里，把后端整份列表一页一页抽干。
*/
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { ArchiveRestore } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThreadChannelBadge from "@/components/workspace/ThreadChannelBadge.vue";
import ThreadChannelIcon from "@/components/workspace/ThreadChannelIcon.vue";
import VirtualThreadList from "@/components/workspace/VirtualThreadList.vue";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer.vue";
import { useThreadArchiveAction } from "@/composables/useThreadArchiveAction";
import { useThreads } from "@/composables/useThreads";
import {
  channelSourceOfThread,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";
import { formatThreadUpdatedTime } from "@/core/threads/updated-time";

definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
/*
  页面标题：React 的 ChatsPage 用 useEffect 写 `document.title`。列表页没有 h1，
  所以浏览器标签、书签和读屏器打开页面时的播报全靠它——只留 nuxt.config 的根标题
  "DeerFlow"，用户开着十个标签页时分不出哪个是会话列表。
*/
useHead(() => ({
  title: `${$i18n.t.value.pages.chats} - ${$i18n.t.value.pages.appName}`,
}));
/*
  活跃 / 已归档是**两份不同的服务端结果**，不是同一份列表的两种过滤：归档的会话
  根本不在活跃那份响应里。所以切页签换的是 query key（见 useThreads 的 archived）。
*/
const view = ref<"active" | "archived">("active");
const archived = computed(() => view.value === "archived");
const threads = useThreads({ archived });
const archiveAction = useThreadArchiveAction();
const search = ref("");
const isSearching = computed(() => search.value.trim().length > 0);
/*
  `<Input>` 是组件，模板 ref 拿到的是组件实例；它的根节点就是那个 `<input>`，
  所以聚焦走 `$el`。
*/
const searchInput = ref<{ $el: HTMLInputElement } | null>(null);
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
/** 哨兵在不在视口里。见下面观察者那段注释。 */
const sentinelVisible = ref(false);
const displayThreadTitle = (thread: Parameters<typeof titleOfThread>[0]) =>
  titleOfThread(thread, $i18n.t.value.pages.untitled);
const filtered = computed(() => {
  const query = search.value.toLowerCase();
  return threads.threads.filter((thread) =>
    displayThreadTitle(thread).toLowerCase().includes(query),
  );
});

function updatedTime(value: string | null | undefined) {
  return formatThreadUpdatedTime(value, $i18n.locale.value);
}

onMounted(() => {
  /*
    `autofocus` 属性只在**首次解析文档**时生效；从别的路由走过来时浏览器不会理它。
    React 用的是 `autoFocus` prop，两种进入方式都会聚焦——挂载后显式 focus 一次，
    才是同一个行为。
  */
  searchInput.value?.$el.focus();
  /*
    观察者只记状态，翻页交给 watch——理由与 ThreadSidebar 那处同一条：
    列表还空时哨兵就在视口内，一次性事件被守卫挡掉之后不会再来，
    首屏数据到了也永远不翻页。
  */
  observer = new IntersectionObserver(
    (entries) => {
      sentinelVisible.value = entries.some((entry) => entry.isIntersecting);
    },
    { rootMargin: "200px 0px 200px 0px" },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
watch([sentinelVisible, () => threads.canLoadMore], ([visible, canLoad]) => {
  if (visible && canLoad && !isSearching.value) void threads.loadMore();
});
watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous);
  if (element) observer?.observe(element);
});
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <WorkspaceContainer>
    <Tabs v-model="view" class="flex size-full flex-col">
      <header
        class="mx-auto flex w-full max-w-[var(--container-width-md)] shrink-0 flex-col gap-3 pt-8"
      >
        <TabsList :aria-label="$i18n.t.value.pages.chats">
          <TabsTrigger value="active">
            {{ $i18n.t.value.chats.activeChats }}
          </TabsTrigger>
          <TabsTrigger value="archived">
            {{ $i18n.t.value.chats.archivedChats }}
          </TabsTrigger>
        </TabsList>
        <!--
          走 `ui/input`（上游同一处也是 `<Input type="search" className="h-12 …">`，
          `app/workspace/chats/page.tsx:107`）。这里原来是**把 primitive 的整串基类
          抄进 `class`**、连 `data-slot="input"` 都手写了——今天看着一样，
          `Input.vue` 一改就悄悄分叉，而且抄的那份已经漏了 `aria-invalid:`
          与 `disabled:` 两段。
        -->
        <Input
          ref="searchInput"
          v-model="search"
          type="search"
          autofocus
          :placeholder="$i18n.t.value.chats.searchChats"
          class="h-12 max-w-[var(--container-width-md)] text-xl"
        />
      </header>
      <TabsContent :value="view" class="min-h-0 flex-1">
        <main class="h-full">
          <ScrollArea class="size-full py-4">
            <div
              class="mx-auto flex size-full max-w-[var(--container-width-md)] flex-col"
            >
              <!--
                加载失败要给一条出路。此前这一屏对失败**完全没有表示**：列表就是
                空的，用户分不清「我没有会话」和「没加载上」。
              -->
              <div v-if="threads.error" role="alert" class="p-4 text-center">
                <p>{{ $i18n.t.value.chats.loadChatsFailed }}</p>
                <Button variant="outline" @click="threads.loadInitial(true)">
                  {{ $i18n.t.value.chats.retryLoadChats }}
                </Button>
              </div>
              <!--
                三句空态是三件不同的事：搜不到 / 没有归档的 / 一条会话都没有。
                用同一句话说，用户不知道要不要清掉搜索框。
              -->
              <p
                v-if="
                  !threads.loading && !threads.error && filtered.length === 0
                "
                role="status"
                class="text-muted-foreground p-8 text-center"
              >
                {{
                  isSearching
                    ? $i18n.t.value.chats.noMatchingChats
                    : archived
                      ? $i18n.t.value.chats.noArchivedChats
                      : $i18n.t.value.chats.noActiveChats
                }}
              </p>
              <VirtualThreadList
                :estimate-size="76"
                :items="filtered"
                scroll-parent-selector='[data-slot="scroll-area-viewport"]'
              >
                <template #default="{ thread }">
                  <!--
                    归档页签下每行多一颗「恢复」。边框挪到这一层：链接只占左半边，
                    分隔线要横跨整行（上游同形）。
                  -->
                  <div class="flex items-center gap-2 border-b">
                    <NuxtLink class="min-w-0 flex-1" :to="pathOfThread(thread)">
                      <div class="flex flex-col gap-2 p-4">
                        <div class="flex min-w-0 items-center gap-2">
                          <ThreadChannelIcon
                            :source="channelSourceOfThread(thread)"
                          />
                          <div class="min-w-0 flex-1 truncate">
                            {{ displayThreadTitle(thread) }}
                          </div>
                          <ThreadChannelBadge
                            :source="channelSourceOfThread(thread)"
                            class="hidden sm:inline-flex"
                          />
                        </div>
                        <div
                          v-if="thread.updated_at"
                          class="text-muted-foreground text-sm"
                        >
                          {{ updatedTime(thread.updated_at) }}
                        </div>
                      </div>
                    </NuxtLink>
                    <Button
                      v-if="archived"
                      class="mr-4 shrink-0"
                      variant="outline"
                      size="sm"
                      :disabled="archiveAction.isPending.value"
                      @click="
                        archiveAction.setArchived(thread.thread_id, false)
                      "
                    >
                      <ArchiveRestore class="size-4" />
                      {{ $i18n.t.value.chats.restoreChat }}
                    </Button>
                  </div>
                </template>
              </VirtualThreadList>
              <div
                v-if="threads.hasMore && !isSearching"
                ref="sentinel"
                aria-hidden="true"
                data-testid="chats-page-sentinel"
                class="h-px w-full"
              />
              <div
                v-if="threads.hasMore && isSearching"
                class="flex justify-center p-4"
              >
                <!--
                上游 `app/workspace/chats/page.tsx:135` 是
                `<Button variant="outline">`。手写那版把 outline 变体抄了一半：
                少 `cursor-pointer`（Tailwind 4 的 preflight 不给按钮小手，
                上游每个变体都显式写了）、少 `focus-visible` 的 3px 软环，
                还把 `bg-background` 写成 `bg-transparent`、`border` 写成
                `border-input`，于是深色主题下上游那三条
                （`dark:bg-input/30 dark:border-input dark:hover:bg-input/50`）
                一条都没有——深色下这颗键是透明的，上游是浅一档的填色。
              -->
                <Button
                  variant="outline"
                  data-testid="chats-page-load-more"
                  :disabled="threads.loadingMore"
                  @click="threads.loadMore()"
                >
                  {{
                    threads.loadingMore
                      ? $i18n.t.value.chats.loadingMore
                      : $i18n.t.value.chats.loadMoreToSearch
                  }}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </main>
      </TabsContent>
    </Tabs>
  </WorkspaceContainer>
</template>
