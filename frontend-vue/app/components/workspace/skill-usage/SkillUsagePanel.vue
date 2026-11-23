<script setup lang="ts">
import { computed } from "vue";
import { Box } from "lucide-vue-next";
import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import type { SkillUsage } from "@/core/skills/usage";
import SnapshotMarkdownLink from "./SnapshotMarkdownLink.vue";
import SnapshotMarkdownImage from "./SnapshotMarkdownImage.vue";
import { skillSourceLabel } from "./source-label";
const props = defineProps<{ skill: SkillUsage }>();
const { $i18n } = useNuxtApp();
const body = computed(() =>
  props.skill.content.replace(
    /^\uFEFF?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/,
    "",
  ),
);
const components = { a: SnapshotMarkdownLink, img: SnapshotMarkdownImage };
</script>
<template>
  <div class="@container/skill-details wrap-anywhere">
    <div class="border-b px-6 py-5">
      <p
        class="text-muted-foreground mb-5 font-mono text-xs leading-relaxed break-all"
        :title="skill.path"
      >
        {{ skill.path }}
      </p>
      <div class="mb-4 flex items-center gap-3 @max-xs/skill-details:flex-wrap">
        <span class="bg-muted rounded-lg p-2"
          ><Box class="size-5" :stroke-width="2.25"
        /></span>
        <h3
          class="min-w-0 flex-1 text-lg font-semibold break-words @max-xs/skill-details:basis-full"
        >
          {{ skill.name }}
        </h3>
        <span
          class="bg-muted text-muted-foreground shrink-0 rounded-md px-2 py-1 text-xs"
          >{{ skillSourceLabel(skill.category, $i18n.t.value) }}</span
        >
      </div>
      <dl
        class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm @max-xs/skill-details:grid-cols-[minmax(0,1fr)]"
      >
        <dt class="text-muted-foreground">
          {{ $i18n.t.value.skillUsage.name }}
        </dt>
        <dd class="min-w-0 break-words @max-xs/skill-details:wrap-anywhere">
          {{ skill.name }}
        </dd>
        <dt class="text-muted-foreground">
          {{ $i18n.t.value.skillUsage.description }}
        </dt>
        <dd
          class="min-w-0 leading-relaxed break-words @max-xs/skill-details:wrap-anywhere"
        >
          {{ skill.description || "—" }}
        </dd>
      </dl>
    </div>
    <p
      v-if="skill.partial"
      role="status"
      class="bg-muted text-muted-foreground mx-6 mt-5 rounded-lg px-3 py-2 text-xs leading-relaxed"
    >
      {{ $i18n.t.value.skillUsage.partial }}
    </p>
    <div class="px-6 py-6">
      <MessageMarkdown
        :content="body"
        :streaming="false"
        class="text-sm"
        :components="components"
      />
    </div>
  </div>
</template>
