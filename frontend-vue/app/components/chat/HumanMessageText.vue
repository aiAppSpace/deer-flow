<!--
  【文件职责】     人类消息的正文：纯文本，或（长得像斜杠激活时）交给 HumanSlashSkillText。
  【架构位置】     L3
  【主要导出】     默认 HumanMessageText 组件
  【依赖关系】     core/skills/slash 的 parseSlashSkillReference · HumanSlashSkillText
  【边界与注意】   逐件对着上游 message-list-item.tsx:338 的 HumanMessageText。

                   **这一层只做纯正则判断，不碰任何 query**：绝大多数提问都不是
                   斜杠激活，它们一条都不该因为技能目录变了而重渲染。真正订阅目录的
                   是 HumanSlashSkillText，而它只在这里判定「长得像」之后才挂载。

                   用 `div` 而不是 `p`：见 MessageList.vue 里那段判词（读屏器的
                   「按段落浏览」会把每一条提问都当正文段落，上游不会）。

                   **2026-09-18 第四十四轮新增**：此前本仓这一段是 MessageList 里
                   写死的一个 `<div>{{ text }}</div>`，`resolveSlashSkillDisplay`
                   在 core 里实现了、单测也有，**却没有任何组件调用它**——于是一条
                   `/data-analysis 做点事` 在本仓是整行裸文本，在上游是胶囊 + 剩下的话。
                   读数与怎么发现的写在 SlashSkillChip.vue 的文件头。
-->

<script setup lang="ts">
import { computed } from "vue";

import HumanSlashSkillText from "@/components/chat/HumanSlashSkillText.vue";
import { parseSlashSkillReference } from "@/core/skills/slash";

const props = defineProps<{ content: string }>();

const looksLikeSlashSkill = computed(
  () => parseSlashSkillReference(props.content) !== null,
);
</script>

<template>
  <HumanSlashSkillText v-if="looksLikeSlashSkill" :content="props.content" />
  <div v-else class="wrap-break-word whitespace-pre-wrap">
    {{ props.content }}
  </div>
</template>
