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

import type { Todo } from "@/core/todos";

defineProps<{ todos: Todo[] }>();
const collapsed = ref(true);
</script>

<template>
  <section
    v-if="todos.length"
    class="border-border bg-background overflow-hidden rounded-xl border"
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
      <span class="text-muted-foreground flex items-center gap-2">
        <ListTodo :size="16" /> To-dos
      </span>
      <ChevronUp
        :size="16"
        class="text-muted-foreground transition-transform duration-300 ease-out"
        :class="collapsed ? '' : 'rotate-180'"
      />
    </button>
    <ul v-if="!collapsed" class="space-y-1 p-3">
      <li
        v-for="(todo, index) in todos"
        :key="`${index}:${todo.content}`"
        class="flex items-start gap-2 text-sm"
        :data-status="todo.status"
      >
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
      </li>
    </ul>
  </section>
</template>
