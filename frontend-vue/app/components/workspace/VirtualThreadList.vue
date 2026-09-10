<script setup lang="ts" generic="Row extends { thread_id: string }">
/*
  【文件职责】     会话列表的虚拟滚动：长列表只渲染视口附近那几行。
  【架构位置】     L3 product UI
  【主要导出】     默认 VirtualThreadList 组件
  【依赖关系】     @tanstack/vue-virtual · core/threads/virtual-list
  【边界与注意】   **行类型是泛型的**，只约束「有 thread_id 可做 key」：
                   行内容全由插槽决定，写死成 `AgentThread` 会把项目详情页那种投影形状
                   （`/api/projects/{id}/threads` 只返回 thread_id/display_name/metadata/时间）
                   挡在外面，逼调用方做一次没有意义的类型断言。

                   对照的是 React 的 VirtualThreadList
                   （frontend/src/components/workspace/thread-list-virtualizer.tsx）：
                   同一个 @tanstack 虚拟化器、同一个 60 条阈值、同一个 overscan 8、
                   同一套 scrollMargin 补偿。

                   为什么必须虚拟化而不是「Vue 直接全量渲染就好」：一旦翻到第二页，
                   React 的可访问性树里只有视口附近那十几行，Vue 会有一百多行。
                   读屏器念出的「共 N 项」两边不一样，Tab 序列长度也不一样——这是
                   一处对照台账现在测不到（样本只加载了 50 条）、用户却听得见的差异。

                   滚动容器不是自己，而是**祖先**（列表页是 ScrollArea 的 viewport，
                   侧栏是 data-sidebar=content）。所以要把「列表相对滚动容器内容原点
                   的偏移」喂给虚拟化器，否则第一行会从滚动容器顶部开始排，整块列表
                   往上跑一截。
*/
import { useVirtualizer } from "@tanstack/vue-virtual";
import { computed, nextTick, onMounted, ref, watch } from "vue";

import {
  calculateScrollMargin,
  VIRTUALIZATION_THRESHOLD,
} from "@/core/threads/virtual-list";

const props = withDefaults(
  defineProps<{
    estimateSize: number;
    gap?: number;
    items: readonly Row[];
    scrollParentSelector: string;
  }>(),
  { gap: 0 },
);

defineSlots<{
  default(props: { thread: Row; index: number }): unknown;
}>();

const root = ref<HTMLElement | null>(null);
const scrollMargin = ref(0);
const virtualized = computed(
  () => props.items.length >= VIRTUALIZATION_THRESHOLD,
);

function scrollElement() {
  return root.value?.closest<HTMLElement>(props.scrollParentSelector) ?? null;
}

function syncScrollMargin() {
  const element = root.value;
  const parent = scrollElement();
  if (!element || !parent) return;
  scrollMargin.value = calculateScrollMargin(
    element.getBoundingClientRect().top,
    parent.getBoundingClientRect().top,
    parent.scrollTop,
  );
}

onMounted(syncScrollMargin);
watch(
  () => [props.items.length, virtualized.value],
  async () => {
    await nextTick();
    syncScrollMargin();
  },
);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.items.length,
    estimateSize: () => props.estimateSize,
    getItemKey: (index: number) => props.items[index]?.thread_id ?? index,
    getScrollElement: scrollElement,
    overscan: 8,
    scrollMargin: scrollMargin.value,
  })),
);

const rows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());
</script>

<template>
  <div
    v-if="!virtualized"
    ref="root"
    class="flex w-full flex-col"
    :style="{ gap: `${gap}px` }"
  >
    <template v-for="(thread, index) in items" :key="thread.thread_id">
      <slot :thread="thread" :index="index" />
    </template>
  </div>
  <div
    v-else
    ref="root"
    class="relative w-full"
    :style="{ height: `${totalSize}px` }"
  >
    <div
      v-for="row in rows"
      :key="String(row.key)"
      :ref="(element) => virtualizer.measureElement(element as Element | null)"
      :data-index="row.index"
      class="absolute top-0 left-0 w-full"
      :style="{
        paddingBottom: `${gap}px`,
        transform: `translateY(${row.start - scrollMargin}px)`,
      }"
    >
      <slot
        v-if="items[row.index]"
        :thread="items[row.index]!"
        :index="row.index"
      />
    </div>
  </div>
</template>
