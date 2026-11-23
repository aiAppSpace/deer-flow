<!--
  Human text uses a pure slash-reference check. Only matching historical
  messages mount HumanSlashSkillText and subscribe to the skill directory;
  ordinary messages remain plain text. Composer references have their own owner.
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
