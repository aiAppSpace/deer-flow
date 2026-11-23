<script setup lang="ts">
/** Load the Markdown pipeline when content is rendered, including its plugin imports. */
import { defineAsyncComponent } from "vue";
import type { PluggableList } from "unified";

const MessageMarkdownContent = defineAsyncComponent(
  () => import("./MessageMarkdownContent.vue"),
);
withDefaults(
  defineProps<{
    content: string;
    streaming?: boolean;
    components?: Record<string, unknown>;
    remarkPlugins?: PluggableList;
    rehypePlugins?: PluggableList;
  }>(),
  {
    streaming: false,
    components: undefined,
    remarkPlugins: undefined,
    rehypePlugins: undefined,
  },
);
</script>

<template>
  <MessageMarkdownContent
    :content="content"
    :streaming="streaming"
    :components="components"
    :remark-plugins="remarkPlugins"
    :rehype-plugins="rehypePlugins"
  />
</template>
