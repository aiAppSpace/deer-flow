<!--
  【文件职责】     把一条 `/skill 剩下的话` 的人类消息画成「胶囊 + 剩下的话」。
  【架构位置】     L3
  【主要导出】     默认 HumanSlashSkillText 组件
  【依赖关系】     core/skills/slash 的 resolveSlashSkillDisplay · useSkillsCatalog · SlashSkillChip
  【边界与注意】   **它是独立一层，不是 HumanMessageText 里的一个 v-if**，这一点是刻意的，
                   与上游 message-list-item.tsx:338 的注释同一个理由：只有**长得像**
                   斜杠激活的那几条消息才该订阅技能目录，普通提问一条都不订阅。
                   在 Vue 里 composable 在 setup 阶段无条件执行，所以「不订阅」
                   只能靠**不挂载这一层**来表达——写成同一个组件里的 v-if 就失效了。

                   目录还没回来时 `skills` 是空数组，`resolveSlashSkillDisplay`
                   因此返回 null，这一条先按纯文本画；目录到了再切成胶囊。
                   **上游是同一个行为**（`useSkills()` 的 `data ?? []`），
                   不要为了"别闪一下"改成等目录——那会让两边的首帧不一样。
-->

<script setup lang="ts">
import { computed } from "vue";

import SlashSkillChip from "@/components/chat/SlashSkillChip.vue";
import { useSkillsCatalog } from "@/composables/useSkillsCatalog";
import { resolveSlashSkillDisplay } from "@/core/skills/slash";

const props = defineProps<{ content: string }>();

const { skills } = useSkillsCatalog();

const slashSkill = computed(() =>
  resolveSlashSkillDisplay(props.content, skills.value),
);
</script>

<template>
  <div v-if="!slashSkill" class="wrap-break-word whitespace-pre-wrap">
    {{ props.content }}
  </div>
  <div
    v-else
    class="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
  >
    <SlashSkillChip :name="slashSkill.name" />
    <span
      v-if="slashSkill.remainingText"
      class="min-w-0 flex-1 wrap-break-word whitespace-pre-wrap"
      >{{ slashSkill.remainingText }}</span
    >
  </div>
</template>
