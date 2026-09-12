<!--
  【文件职责】     折叠展示 thread.values.todos 的真实任务状态。
  【架构位置】     L3 workspace UI adapter
  【主要导出】     默认 TodoList 组件
  【依赖关系】     core/todos
  【边界与注意】   数据所有权在 thread server state；组件只负责 pending/in_progress/completed 展示。
-->

<script setup lang="ts">
import { ref } from "vue";
import { ChevronUp, ListTodo } from "lucide-vue-next";

import { ScrollArea } from "@/components/ui/scroll-area";

import type { Todo } from "@/core/todos";

const { $i18n } = useNuxtApp();
defineProps<{ todos: Todo[] }>();
const collapsed = ref(true);
</script>

<template>
  <!--
    **根类串照抄上游 `todo-list.tsx:42`**（2026-09-12 第十八轮）。
    本仓此前是 `border-border bg-background overflow-hidden rounded-xl border`
    ——四角都圆、有下边框、不透明、没有过渡；上游是
    `rounded-t-xl border border-b-0`（**只圆上面两角、没有下边框**，因为它贴着
    composer 顶边坐）＋ `origin-bottom translate-y-4`（向下压 16px 与 composer 叠住）
    ＋ `backdrop-blur-sm` ＋ `transition-all duration-200 ease-out`
    ＋ `flex h-fit w-full flex-col`。
    上游那句 `bg-white` 被调用点的 `bg-background/5` 顶掉（twMerge 同组后者胜），
    所以本仓不抄 `bg-white`——抄了也是死的，而且深色下它是真白。

    `<section>` 换成 `<div>`：上游是 div，而一个没有可访问名的 section
    在可访问性树里本来就退化成 generic，两边等价——但**深度档按结构算**，
    标签名不同不影响，层数相同才影响。这里保持与上游同层。
  -->
  <div
    v-if="todos.length"
    class="flex h-fit w-full origin-bottom translate-y-4 flex-col overflow-hidden rounded-t-xl border border-b-0 backdrop-blur-sm transition-all duration-200 ease-out"
    data-testid="thread-todos"
  >
    <!--
      这一层是 `<button>` + `aria-expanded`。上游 todo-list.tsx:45 原来是一个
      **挂着 onClick 的 `<header>`**：它是这块面板唯一的折叠入口，
      键盘用户完全折不动（WCAG 2.1.1），可访问性树里也读不出展开态。
      **wave 73 两边同改**，`frontend/src/components/workspace/todo-list.tsx`
      已改成同一个形状。

      外观照抄上游那一层：`min-h-8`（上游 32px，本仓原来 `min-h-9` 高 4px）、
      `cursor-pointer`（上游显式写了；Tailwind 4 的 preflight 不给按钮小手，
      本仓这颗此前是箭头）、`transition-all duration-300 ease-out`，
      以及箭头自己的 `text-muted-foreground`——上游那颗箭头是中灰的，
      本仓原来继承前景色，比上游深一档（坑 204：颜色只能从渲染读，不能从 class 推）。
    -->
    <button
      type="button"
      class="bg-accent flex min-h-8 w-full shrink-0 cursor-pointer items-center justify-between px-4 text-sm transition-all duration-300 ease-out"
      :aria-expanded="!collapsed"
      @click="collapsed = !collapsed"
    >
      <!--
        **标题那串字要单独一层**（上游 `todo-list.tsx:62`）：外层
        `<div class="text-muted-foreground">`，里层
        `<div class="flex items-center justify-center gap-2">`，文字自己再一个 `<div>`。
        本仓此前把图标与文字挤在同一个 span 里——对照台账当场报
        `text:To-dos x Δ-24 / width Δ+24`，**正好是图标 16 + gap 8**：
        `getByText` 解析到的是包着这段文字的元素，图标被一起框了进去
        （2026-09-12 第十八轮）。
      -->
      <div class="text-muted-foreground">
        <div class="flex items-center justify-center gap-2">
          <ListTodo :size="16" />
          <div>{{ $i18n.t.value.primitives.todos }}</div>
        </div>
      </div>
      <ChevronUp
        :size="16"
        class="text-muted-foreground transition-transform duration-300 ease-out"
        :class="collapsed ? '' : 'rotate-180'"
      />
    </button>
    <!--
      **列表体常驻，靠高度过渡收放**（上游 `todo-list.tsx:77`）：
      `<main class="bg-accent flex grow px-2 transition-all duration-300 ease-out">`
      ＋ 收起 `h-0 pb-3` / 展开 `h-28 pb-4`。本仓此前是 `v-if` 整块摘掉，
      于是**没有过渡**、而且折叠头下面那条边在两种状态下高度不同。

      里面那层是上游 `QueueList`（`ai-elements/queue.tsx:184`）：
      `ScrollArea` ＋ `div.max-h-40.pr-4` ＋ `ul`，调用点再给
      `bg-background mt-0 w-full rounded-t-xl`。待办多于 160px 时上游是**滚动**，
      本仓此前是把面板撑高——这一条只有喂够条数才看得见，
      夹具给三条看不出来，但结构对齐之后它自然成立。
    -->
    <main
      class="bg-accent flex grow px-2 transition-all duration-300 ease-out"
      :class="collapsed ? 'h-0 pb-3' : 'h-28 pb-4'"
    >
      <ScrollArea class="bg-background mt-0 -mb-1 w-full rounded-t-xl">
        <div class="max-h-40 pr-4">
          <ul>
            <!--
              **`<li>` 的类串是上游 `QueueItem`**（`ai-elements/queue.tsx:35`）：
              `group hover:bg-muted flex flex-col gap-1 rounded-md px-3 py-1 text-sm`，
              指示器与文字再包一层 `flex items-center gap-2`（`todo-list.tsx:86`）。
              本仓此前是 `flex items-start gap-2 text-sm` 直接放两个子节点——
              对照台账报的 `x Δ-12 / width Δ+24` 正好是 `px-3` 的两侧，
              `y` 每行差 8 正好是 `py-1` 的上下。
              `data-status` 是本仓自己的钩子（单测按它取三态），上游没有，
              它不进任何采样档，留着。
            -->
            <li
              v-for="(todo, index) in todos"
              :key="`${index}:${todo.content}`"
              class="group hover:bg-muted flex flex-col gap-1 rounded-md px-3 py-1 text-sm"
              :data-status="todo.status"
            >
              <div class="flex items-center gap-2">
                <!--
          **指示器是一颗 CSS 圆点，不是图标**：上游 `ai-elements/queue.tsx` 的
          `QueueItemIndicator`（`mt-0.5 inline-block size-2.5 rounded-full border`
          ＋ 完成态 `border-muted-foreground/20 bg-muted-foreground/10`、
          未完成 `border-muted-foreground/50`），进行中由调用点补 `bg-primary/70`
          （`todo-list.tsx:88`）。本仓原来画的是两颗 lucide 图标，完成那颗还写死
          `text-emerald-600`——**上游全仓没用过这个 utility，它也没有 `dark:` 变体**
          （2026-09-12 第十三轮）。文字同理走 `QueueItemContent`：
          `line-clamp-1 grow break-words` ＋ 完成 `text-muted-foreground/50 line-through`、
          未完成 `text-muted-foreground`，进行中调用点补 `text-primary/70`。

          **容器那一层还没对齐**，是一张单独的账（见 vue-parity-open-accounts.md
          第十三轮那节）：上游的列表体是定高 `h-28` ＋ 高度过渡 ＋ ScrollArea ＋
          条目 `hover:bg-muted`，本仓是 `v-if` 整块摘掉、`space-y-1 p-3`。
          那一层改动会动到折叠动画，且这一屏**至今没有任何对照锚点**。
        -->
                <span
                  class="mt-0.5 inline-block size-2.5 shrink-0 rounded-full border"
                  :class="[
                    todo.status === 'completed'
                      ? 'border-muted-foreground/20 bg-muted-foreground/10'
                      : 'border-muted-foreground/50',
                    todo.status === 'in_progress' ? 'bg-primary/70' : '',
                  ]"
                />
                <span
                  class="line-clamp-1 grow break-words"
                  :class="[
                    todo.status === 'completed'
                      ? 'text-muted-foreground/50 line-through'
                      : 'text-muted-foreground',
                    todo.status === 'in_progress' ? 'text-primary/70' : '',
                  ]"
                >
                  {{ todo.content }}
                </span>
              </div>
            </li>
          </ul>
        </div>
      </ScrollArea>
    </main>
  </div>
</template>
