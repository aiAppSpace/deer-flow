<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { Box } from "lucide-vue-next";
import type { SkillUsage } from "@/core/skills/usage";
import { useMaybeMessageDetails } from "@/components/workspace/message-details/context";
import MessageDetailsMenu from "@/components/workspace/message-details/MessageDetailsMenu.vue";
import SkillUsageCopyAction from "./SkillUsageCopyAction.vue";
import { skillSourceLabel } from "./source-label";
const SkillUsagePanel = defineAsyncComponent(
  () => import("./SkillUsagePanel.vue"),
);
const props = defineProps<{ skills: SkillUsage[] }>();
const { $i18n } = useNuxtApp();
const details = useMaybeMessageDetails();
const entries = computed(() =>
  props.skills.map((skill) => ({
    id: `${skill.path}:${skill.content_hash}`,
    title: skill.name,
    subtitle: skillSourceLabel(skill.category, $i18n.t.value),
    onSelect: (origin?: HTMLElement) =>
      details?.select(
        {
          id: `skill:${skill.path}:${skill.content_hash}`,
          title: "SKILL.md",
          content: SkillUsagePanel,
          props: { skill },
          actions: SkillUsageCopyAction,
          actionProps: { content: skill.content },
        },
        origin,
      ),
  })),
);
</script>
<template>
  <MessageDetailsMenu
    v-if="details && skills.length"
    :label="$i18n.t.value.skillUsage.used"
    :title="$i18n.t.value.skillUsage.title"
    :entries="entries"
    ><template #icon><Box class="size-4" :stroke-width="2.5" /></template
  ></MessageDetailsMenu>
</template>
