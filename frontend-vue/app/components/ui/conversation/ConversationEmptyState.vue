<!--
  【文件职责】     面板正文为空时的占位块（上游 `ai-elements/conversation.tsx:36`
                   的 ConversationEmptyState）。
  【架构位置】     L2 —— 通用 UI primitive
  【主要导出】     ConversationEmptyState 组件
  【依赖关系】     @/lib/utils
  【边界与注意】   ① **只移植了四件套里的这一件。** 上游 `conversation.tsx` 导出
                   `Conversation` / `ConversationContent` / `ConversationEmptyState` /
                   `ConversationScrollButton` 四个，逐个核过调用点之后只有这一个
                   在本仓有需求：

                   - `Conversation` / `ConversationContent` 上游只有一个调用点
                     （`message-list.tsx:972`），底层是 `use-stick-to-bottom` 的
                     `StickToBottom`。那个包是 **React 专属依赖**（只在
                     `frontend/package.json`，Vue 侧没有也不该有），而本仓
                     `MessageList.vue` 已经有一套自己的滚动锚定实现。移植它等于
                     为一个调用点引一套新的滚动引擎，收益是零。
                   - `ConversationScrollButton` **在上游是死代码**——
                     `grep -rn ConversationScrollButton frontend/src/` 除了定义处
                     零命中，React 自己从来不渲染它。交接把它写成「React 在没滚到底
                     时会多出一颗按钮，本仓永远没有」，实测不成立：两个应用都没有。
                     移植它会凭空造出一处上游没有的 UI，正好与对照目标相反。

                   ② **同理，`role="log"` 不属于这一层。** 交接说「React 的 sidecar
                   面板与 browser 面板也有 role=log」，实测同样不成立：那两处只
                   `import { ConversationEmptyState }`，而本组件是个普通 div，没有
                   role。上游 `role="log"` 只出现在 `Conversation` 上，也就是只在
                   `message-list.tsx` 这一条路径；React 的 sidecar 是**透过它内部渲染的
                   `<MessageList>`** 才拿到 role=log 的，而本仓 `SidecarPanel.vue`
                   同样渲染 `MessageList.vue`（它在 :845 带着 role="log"）。
                   两边在这一点上本来就一致，不需要动。

                   ③ **不持有任何产品文案。** 上游给 title/description 写了默认值
                   （"No messages yet" / "Start a conversation to see messages here"），
                   但三个调用点**全都显式传了这两项**，默认值一次也没被读到。
                   `ui/` 在 i18n source guard 的扫描面内（坑 52），照抄默认值等于往
                   L2 里塞两条永远不会上屏的英文，所以这里把 `title` 收成必填、
                   `description` 保持可选，默认值不移植。判据与
                   `ui/reasoning/Reasoning.vue` 的第 ④ 条相同：缺的不是能力，是需求。

                   ④ 上游还有 `children ?? (...)` 这一支——传了 children 就整个替换
                   icon/title/description 三件。三个调用点一个都没传，按同一条判据
                   不移植。

                   ⑤ **没有 `data-slot`。** 上游这一件就是个裸 div，不要凭空发明一个。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  title: string;
  description?: string;
}>();
</script>

<template>
  <div
    :class="
      cn(
        'flex size-full flex-col items-center justify-center-safe gap-3 overflow-y-auto p-8 text-center',
        props.class,
      )
    "
  >
    <div v-if="$slots.icon" class="text-muted-foreground shrink-0">
      <slot name="icon" />
    </div>
    <div class="shrink-0 space-y-1">
      <h3 class="text-sm font-medium">{{ props.title }}</h3>
      <p v-if="props.description" class="text-muted-foreground text-sm">
        {{ props.description }}
      </p>
    </div>
  </div>
</template>
