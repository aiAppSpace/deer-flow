<script setup lang="ts">
/*
  【文件职责】     聊天消息 Markdown 的唯一产品适配器：安全预处理、插件链、流式状态与组件覆盖。
  【架构位置】     L3 chat UI adapter
  【主要导出】     默认 MessageMarkdown 组件
  【依赖关系】     StreamMarkdown · core/markdown/{safe-markdown,plugins}
  【边界与注意】   StreamMarkdown 保持框架级渲染器；所有消息、推理和工具步骤都必须经过本层，
                   避免调用点漏传 GFM/math/streaming 插件后产生静默的产品差异。
*/
import {
  computed,
  defineAsyncComponent,
  provide,
  shallowRef,
  watch,
} from "vue";

import { containsMath, loadKatexRehypePlugin } from "@/core/markdown/math";
import {
  appRemarkPlugins,
  rehypeStreamingListItems,
} from "@/core/markdown/plugins";
import { getSafeMarkdown } from "@/core/markdown/safe-markdown";
import { markdownStreamingKey } from "@/core/markdown/rendering-context";
import { richContentComponents } from "@/components/markdown/components";
import { useSmoothStreamingContent } from "@/composables/useSmoothStreamingContent";
import {
  MessageStreamingCode,
  MessageStreamingPre,
} from "./markdown-streaming-components";

import type { Pluggable, PluggableList } from "unified";

const StreamMarkdown = defineAsyncComponent(
  () => import("@/components/markdown/StreamMarkdown.vue"),
);

const props = withDefaults(
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

const effectiveRemarkPlugins = computed(
  () => props.remarkPlugins ?? appRemarkPlugins,
);
const { content: displayContent, isRevealing } = useSmoothStreamingContent(
  () => props.content,
  () => props.streaming,
);
const isStreamingRender = computed(() => props.streaming || isRevealing.value);
const effectiveComponents = computed(() => {
  const components = { ...richContentComponents, ...props.components };
  return isStreamingRender.value
    ? {
        ...components,
        code: props.components?.code ?? MessageStreamingCode,
        pre: props.components?.pre ?? MessageStreamingPre,
      }
    : components;
});
/*
  KaTeX 只在内容真的出现公式时才下载（264 KB raw）。加载后就一直留着：
  它对没有公式的内容是幂等的，而卸载会让同一个会话里的下一条公式再等一次网络。
  `immediate: true` 不能省——惰性 watch 会让首帧永远不触发检测。
*/
const katexPlugin = shallowRef<Pluggable | null>(null);
watch(
  () => props.content,
  (content, _previous, onCleanup) => {
    if (katexPlugin.value !== null || !containsMath(content)) return;
    let active = true;
    onCleanup(() => {
      active = false;
    });
    void loadKatexRehypePlugin()
      .then((plugin) => {
        if (active) katexPlugin.value = plugin;
      })
      .catch((error: unknown) => {
        if (active) console.error("Failed to load math renderer:", error);
      });
  },
  { immediate: true },
);

const effectiveRehypePlugins = computed<PluggableList>(() => [
  ...(katexPlugin.value === null ? [] : [katexPlugin.value]),
  ...(props.rehypePlugins ?? []),
  ...(isStreamingRender.value ? [rehypeStreamingListItems] : []),
]);
provide(markdownStreamingKey, isStreamingRender);
</script>

<template>
  <StreamMarkdown
    v-if="displayContent"
    :content="getSafeMarkdown(displayContent)"
    :components="effectiveComponents"
    :remark-plugins="effectiveRemarkPlugins"
    :rehype-plugins="effectiveRehypePlugins"
    :parse-incomplete-markdown="streaming"
    :animated="streaming"
    new-word-class="animate-in fade-in duration-200"
  />
</template>
