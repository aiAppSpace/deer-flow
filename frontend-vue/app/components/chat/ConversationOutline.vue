<!--
  【文件职责】     长会话右侧的章节跳转目录。
  【架构位置】     L4 产品组件
  【主要导出】     默认组件
  【依赖关系】     ui/button · ui/dropdown-menu · core/messages/conversation-outline
  【边界与注意】   收起时那一列**刻度**是纯装饰（`aria-hidden`）：它表达的是「你在
                   整条会话的哪个位置」，读屏器逐条念二十四个小横杠毫无意义，
                   真正的信息在按钮的可访问名和展开后的菜单里。

                   刻度**最多 24 根**，多于 24 章时按比例合并——不封顶的话，
                   一条两百轮的会话会画出两百根 0.5px 的横杠，糊成一片。

                   `modal={false}`：这是个悬浮在消息流上的目录，打开它不该把
                   背后的滚动锁住——用户常常是一边看目录一边滚。

                   展开时把当前那一章滚进视野：一条长会话的目录本身也要滚，
                   不这么做的话打开菜单看到的是第一章，而用户在第八十章。
-->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { List } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ConversationChapter } from "@/core/messages/conversation-outline";
import { cn } from "@/lib/utils";

const MAX_OUTLINE_TICKS = 24;

const props = defineProps<{
  chapters: readonly ConversationChapter[];
  activeChapterId: string | null;
}>();
const emit = defineEmits<{ select: [chapterId: string] }>();

const { $i18n } = useNuxtApp();

const open = ref(false);
const activeItem = ref<HTMLElement | null>(null);

const activeChapterIndex = computed(() =>
  props.chapters.findIndex((chapter) => chapter.id === props.activeChapterId),
);

/** 章多于刻度时按比例合并：一根刻度代表连续的几章。 */
const outlineTicks = computed(() => {
  const total = props.chapters.length;
  const tickCount = Math.min(total, MAX_OUTLINE_TICKS);
  return Array.from({ length: tickCount }, (_, tickIndex) => {
    const startIndex = Math.floor((tickIndex * total) / tickCount);
    const endIndex = Math.floor(((tickIndex + 1) * total) / tickCount);
    return {
      id: props.chapters[startIndex]?.id ?? `tick:${tickIndex}`,
      active:
        activeChapterIndex.value >= startIndex &&
        activeChapterIndex.value < endIndex,
    };
  });
});

watch([open, () => props.activeChapterId], async ([isOpen]) => {
  if (!isOpen) return;
  await nextTick();
  activeItem.value?.scrollIntoView({ block: "nearest" });
});
</script>

<template>
  <div
    class="pointer-events-none absolute top-1/2 right-2 z-20 -translate-y-1/2 sm:right-3"
  >
    <DropdownMenu v-model:open="open" :modal="false">
      <DropdownMenuTrigger as-child>
        <Button
          type="button"
          variant="outline"
          size="icon"
          :aria-label="$i18n.t.value.conversation.outlineLabel"
          data-testid="conversation-outline-trigger"
          class="bg-background/80 text-muted-foreground hover:text-foreground pointer-events-auto size-9 rounded-full border shadow-sm backdrop-blur-sm lg:h-auto lg:min-h-10 lg:w-7 lg:flex-col lg:gap-1 lg:px-1 lg:py-2"
        >
          <List class="size-4 lg:hidden" />
          <span
            aria-hidden="true"
            data-testid="conversation-outline-ticks"
            class="hidden max-h-52 w-full flex-col items-center gap-1 overflow-hidden lg:flex"
          >
            <span
              v-for="tick in outlineTicks"
              :key="tick.id"
              :class="
                cn(
                  'bg-muted-foreground/45 h-0.5 w-3 rounded-full transition-[width,background-color] motion-reduce:transition-none',
                  tick.active && 'bg-foreground h-[3px] w-4',
                )
              "
            />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <!--
        不重复传 `overflow-y-auto`：primitive 基类已经有了，重复传会顶掉同组的
        `overflow-x-hidden`（门禁 primitive-class-overrides 抓的就是这一类）。
        上游那一处传了，是因为它的基类里没有这两条。
      -->
      <DropdownMenuContent
        align="center"
        side="left"
        :side-offset="8"
        class="border-border/80 bg-popover/95 max-h-[min(72vh,36rem)] w-72 rounded-2xl p-2 shadow-xl backdrop-blur-sm sm:max-h-[min(80vh,40rem)]"
        data-testid="conversation-outline-menu"
      >
        <DropdownMenuItem
          v-for="chapter in chapters"
          :key="chapter.id"
          :ref="
            (element) => {
              if (chapter.id === activeChapterId) {
                activeItem =
                  (element as { $el?: HTMLElement } | null)?.$el ?? null;
              }
            }
          "
          :aria-current="
            chapter.id === activeChapterId ? 'location' : undefined
          "
          :class="
            cn(
              'items-start rounded-lg px-3 py-2 text-[15px] leading-5 whitespace-normal',
              chapter.id === activeChapterId &&
                'bg-accent text-accent-foreground',
            )
          "
          :title="chapter.title"
          @select="
            (event: Event) => {
              // 选中一章不该关掉目录：常见用法是连着跳几章。
              event.preventDefault();
              emit('select', chapter.id);
            }
          "
        >
          <span class="line-clamp-2 min-w-0 leading-5">{{
            chapter.title
          }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
