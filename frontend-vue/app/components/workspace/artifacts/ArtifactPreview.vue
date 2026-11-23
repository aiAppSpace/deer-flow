<script setup lang="ts">
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import type { Pluggable, PluggableList } from "unified";

import { Download } from "lucide-vue-next";

import { buttonVariants } from "@/components/ui/button";
import CitationSourcesPanel from "@/components/chat/CitationSourcesPanel.vue";
import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import ArtifactTablePreview from "./ArtifactTablePreview.vue";
import ArtifactEditor from "./ArtifactEditor.vue";
import { useHtmlArtifactPreview } from "@/composables/useHtmlArtifactPreview";
import MarkdownLink from "@/components/chat/MarkdownLink.vue";
import { richContentComponents } from "@/components/markdown/components";
import {
  artifactFileIcon,
  artifactTypeDisplayName,
} from "@/core/artifacts/display";
import { extractCitationSources } from "@/core/citations/sources";
import {
  getTabularDelimiter,
  type ArtifactPolicy,
} from "@/core/artifacts/policy";
import {
  createHtmlPreviewScrollKey,
  HTML_PREVIEW_SCROLL_MESSAGE_SOURCE,
} from "@/core/artifacts/preview";
import { containsMath, loadKatexRehypePlugin } from "@/core/markdown/math";
import {
  rawHtmlRehypePlugins,
  rehypeHeadingSlugs,
  appRemarkPlugins,
} from "@/core/markdown/plugins";

const props = defineProps<{
  policy: ArtifactPolicy;
  filename: string;
  content: string;
  url?: string;
  contentUrl?: string;

  downloadUrl?: string;
  viewMode: "code" | "preview";
  htmlPreviewAllowed: boolean;

  truncated?: boolean;

  identity: string;
}>();

const katexPlugin = shallowRef<Pluggable | null>(null);
watch(
  () => props.content,
  (content) => {
    if (katexPlugin.value !== null || !containsMath(content)) return;
    void loadKatexRehypePlugin().then((plugin) => {
      katexPlugin.value = plugin;
    });
  },
  { immediate: true },
);
const artifactRehypePlugins = computed<PluggableList>(() => [
  ...rawHtmlRehypePlugins,
  rehypeHeadingSlugs,
  ...(katexPlugin.value === null ? [] : [katexPlugin.value]),
]);

// 与 React 一致：只有 markdown 预览才抽引用来源。

const previewMarkdownComponents = markRaw({
  ...richContentComponents,
  a: MarkdownLink,
});

const citationSources = computed(() =>
  props.policy.language === "markdown"
    ? extractCitationSources(props.content ?? "")
    : [],
);

const scrollKey = computed(() => props.identity);

const tabularDelimiter = computed(() =>
  props.policy.kind === "text"
    ? getTabularDelimiter(props.policy.language)
    : null,
);
const scrollMessageKey = computed(() =>
  createHtmlPreviewScrollKey(scrollKey.value),
);
const scrollPosition = { x: 0, y: 0 };
const previewFrame = ref<HTMLIFrameElement | null>(null);
const htmlPreviewUrl = useHtmlArtifactPreview(() => ({
  content: props.content,
  language: props.policy.language,
  url: props.url,
  identity: props.identity,
  enabled: props.htmlPreviewAllowed,
}));

function isArtifactScrollMessage(
  data: unknown,
  key: string,
): data is { type: "save" | "restore-request"; x?: unknown; y?: unknown } {
  return (
    typeof data === "object" &&
    data !== null &&
    "source" in data &&
    data.source === HTML_PREVIEW_SCROLL_MESSAGE_SOURCE &&
    "key" in data &&
    data.key === key &&
    "type" in data &&
    (data.type === "save" || data.type === "restore-request")
  );
}

function scrollCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function onScrollMessage(event: MessageEvent) {
  if (event.source !== previewFrame.value?.contentWindow) return;
  if (!isArtifactScrollMessage(event.data, scrollMessageKey.value)) return;
  if (event.data.type === "save") {
    const x = scrollCoordinate(event.data.x);
    const y = scrollCoordinate(event.data.y);
    if (x !== undefined && y !== undefined) {
      scrollPosition.x = x;
      scrollPosition.y = y;
    }
    return;
  }
  previewFrame.value?.contentWindow?.postMessage(
    {
      source: HTML_PREVIEW_SCROLL_MESSAGE_SOURCE,
      key: scrollMessageKey.value,
      type: "restore",
      ...scrollPosition,
    },
    "*",
  );
}

watch(scrollMessageKey, () => {
  scrollPosition.x = 0;
  scrollPosition.y = 0;
});

onMounted(() => globalThis.addEventListener("message", onScrollMessage));
onBeforeUnmount(() => {
  globalThis.removeEventListener("message", onScrollMessage);
});
</script>

<template>
  <template v-if="policy.kind === 'browser-media'">
    <div
      v-if="policy.previewKind === 'image'"
      class="bg-background flex size-full items-center justify-center"
    >
      <img
        :src="url"
        :alt="filename"
        class="max-h-full max-w-full object-contain"
      />
    </div>
    <div
      v-else-if="policy.previewKind === 'audio'"
      class="bg-background flex size-full items-center justify-center p-6"
    >
      <audio
        :src="url"
        :aria-label="filename"
        controls
        preload="metadata"
        class="w-full max-w-xl"
      />
    </div>
    <video
      v-else
      :src="url"
      :aria-label="filename"
      controls
      playsinline
      preload="metadata"
      class="size-full bg-black object-contain"
    />
  </template>
  <iframe
    v-else-if="policy.kind === 'safe-document'"
    :src="url"
    class="size-full"
    :title="filename"
  />

  <div
    v-else-if="
      policy.kind === 'download-only' || policy.kind === 'skill-archive'
    "
    class="flex size-full items-center justify-center p-6"
    data-testid="artifact-download-fallback"
  >
    <div class="flex max-w-sm flex-col items-center gap-4 text-center">
      <div class="text-muted-foreground">
        <component :is="artifactFileIcon(policy.filepath)" class="size-12" />
      </div>
      <div class="space-y-1">
        <div class="font-medium break-all">{{ filename }}</div>
        <div class="text-muted-foreground text-sm">
          {{
            $i18n.t.value.artifacts.fileTypeLabel(
              artifactTypeDisplayName(policy.filepath),
            )
          }}
        </div>
      </div>
      <p class="text-muted-foreground text-sm">
        {{ $i18n.t.value.artifacts.cannotPreview }}
      </p>
      <a
        :href="downloadUrl"
        target="_blank"
        rel="noopener noreferrer"
        :class="buttonVariants()"
      >
        <Download class="size-4" />
        {{ $i18n.t.value.common.download }}
      </a>
    </div>
  </div>

  <template v-else-if="tabularDelimiter">
    <ArtifactTablePreview
      :content="content"
      :delimiter="tabularDelimiter"
      :truncated="truncated === true"
      :identity="identity"
      :active="viewMode === 'preview'"
    />
    <ArtifactEditor
      v-if="viewMode === 'code' && !truncated"
      :model-value="content"
      :language="policy.language"
      readonly
    />
    <pre
      v-else-if="viewMode === 'code'"
      class="size-full overflow-auto p-4 font-mono text-sm whitespace-pre-wrap"
      >{{ content }}</pre>
  </template>
  <div
    v-else-if="viewMode === 'preview' && policy.language === 'markdown'"
    class="size-full overflow-auto px-4 py-3"
  >
    <StreamMarkdown
      :content="content"
      :components="previewMarkdownComponents"
      :remark-plugins="appRemarkPlugins"
      :rehype-plugins="artifactRehypePlugins"
    />

    <CitationSourcesPanel :sources="citationSources" class="mb-4" />
  </div>
  <iframe
    v-else-if="
      viewMode === 'preview' &&
      policy.language === 'html' &&
      htmlPreviewAllowed &&
      htmlPreviewUrl
    "
    ref="previewFrame"
    :title="$i18n.t.value.artifacts.previewTitle"
    class="size-full"
    sandbox="allow-scripts allow-forms"
    :src="htmlPreviewUrl"
  />
  <ArtifactEditor
    v-else-if="policy.kind === 'text' && !truncated"
    :model-value="content"
    :language="policy.language"
    readonly
  />
  <pre
    v-else
    class="size-full overflow-auto p-4 font-mono text-sm whitespace-pre-wrap"
    >{{ content }}</pre>
</template>
