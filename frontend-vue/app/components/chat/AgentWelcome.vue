<script setup lang="ts">
/*
  【文件职责】     自定义 agent 会话页的欢迎区：agent 名字与描述。
  【架构位置】     L3 chat component
  【主要导出】     默认 AgentWelcome
  【依赖关系】     agents types · lucide-vue-next
  【边界与注意】   逐段对着上游 `components/workspace/agent-welcome.tsx` 抄的。
                   上游把 agent 会话页与普通聊天页的欢迎区分成**两个组件**：
                   `/workspace/chats/*` 用 `Welcome`（👋 + 通用介绍），
                   `/workspace/agents/{name}/chats/*` 用 `AgentWelcome`
                   （圆形底 + `BotIcon` + agent 名 + 描述）。本仓一个 `AgentChat`
                   同时服务两条路由，此前只渲染通用那一支——于是打开一个自定义
                   agent 的新会话，上游告诉你「这是 test-agent，它做什么」，
                   本仓只说「👋 Hello, again!」。

                   名字优先取非空 display_name，再取稳定 name；还没取回来时用路由段，
                   而不是先显示一个空标题再跳变。描述取不到就整段不渲染
                   （上游的 `{description && …}`），不要退回通用介绍——那会让
                   「这个 agent 没写描述」和「还没加载完」看起来一样。

                   `data-testid` 是上游没有的：agent 名字在页头面包屑上也出现一次，
                   没有锚点就只能靠 class 定位欢迎区，而 class 不是本仓 e2e 该钉的东西。
                   testid 不进可访问性树也不进几何取样，对跨应用对照零影响。
*/
import { computed } from "vue";
import { Bot } from "lucide-vue-next";

import type { Agent } from "@/core/agents/types";
import { displayNameOfAgent } from "@/core/agents/presentation";

const props = defineProps<{
  agent: Agent | null | undefined;
  agentName: string;
}>();

const displayName = computed(() =>
  displayNameOfAgent(props.agent, props.agentName),
);
const description = computed(() => props.agent?.description);
</script>

<template>
  <div
    data-testid="agent-welcome"
    class="mx-auto flex w-full flex-col items-center justify-center gap-2 px-8 py-4 text-center"
  >
    <div
      class="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full"
    >
      <Bot class="text-primary h-6 w-6" />
    </div>
    <div class="text-2xl font-bold">{{ displayName }}</div>
    <p v-if="description" class="text-muted-foreground max-w-sm text-sm">
      {{ description }}
    </p>
  </div>
</template>
