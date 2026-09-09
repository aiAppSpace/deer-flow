<script setup lang="ts">
/*
  【文件职责】     按显式 ArtifactPolicy 渲染 media/document/text/download-only 内容。
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactPreview 组件
  【依赖关系】     ArtifactPolicy · StreamMarkdown · HTML URL rewrite
  【边界与注意】   HTML iframe 只消费父层已通过 full + D3 的内容；本组件不自行提升能力。
*/
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
import MarkdownLink from "@/components/chat/MarkdownLink.vue";
import { richContentComponents } from "@/components/markdown/components";
import {
  artifactFileIcon,
  artifactTypeDisplayName,
} from "@/core/artifacts/display";
import { extractCitationSources } from "@/core/citations/sources";
import type { ArtifactPolicy } from "@/core/artifacts/policy";
import {
  appendHtmlPreviewScrollRestoration,
  collectHtmlPreviewResourceUrls,
  createHtmlPreviewScrollKey,
  HTML_PREVIEW_SCROLL_MESSAGE_SOURCE,
  resolveHtmlPreviewResourceReference,
  rewriteHtmlPreviewResourceUrls,
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
  /** 下载入口用的地址；不能预览的类型靠它给用户一条出路。 */
  downloadUrl?: string;
  viewMode: "code" | "preview";
  htmlPreviewAllowed: boolean;
}>();

/* KaTeX 与消息路径同一条规则：内容出现公式才下载。见 core/markdown/math.ts。 */
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
/*
  HTML 预览：把同源的产物资源**内联**成 data URL，再用 blob URL 喂给 iframe，
  同时注入滚动恢复脚本。这一整套是照 React 的 ArtifactFilePreview 移植的
  （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx）。

  Vue 原来只是 `:srcdoc="rewriteHtmlPreviewResourceUrls(...)"`，两处后果都不在
  可访问性树里、对照台账一条都报不出来：

  - sandbox 没有 allow-same-origin，iframe 是**不透明源**，里面对 `/api/threads/…/artifacts/…`
    的请求带不上 cookie，于是私有产物里的图片和样式一律 401。React 正是为此把它们
    先取下来内联成 data URL。
  - 流式写入期间内容每变一次 iframe 就重建一次，滚动位置每次归零。React 用注入脚本
    加 postMessage 的 save/restore 协议把位置保住。

  `core/artifacts/preview.ts` 里那几个函数本来就已经移植好了，只是一直没有产品消费者
  （只有单测在用）。
*/
// 与 React 一致：只有 markdown 预览才抽引用来源。
/*
  markdown 预览里的链接**不走 markdown 层默认的安全确认按钮**，走普通 `<a>`——
  上游 artifact-file-preview.tsx:311 就是这么覆盖的（`components={{ a: ArtifactLink }}`）。
  理由：artifact 是用户自己让 agent 写下来的文件，预览它等同于打开自己的文档；
  而聊天正文里的链接才是"模型现编的外链"，那一层才需要先确认。

  复用消息路径那个 MarkdownLink：它的三支（危险协议 → 不可点的 span、citation:
  → hover 卡片、其余 → 带下划线的外链）与上游 ArtifactLink 逐条对应，而且这里既没有
  threadId 也没有注入 context，`/mnt/` 那条 artifact 解析分支走不到。

  **必须是稳定引用**（markRaw + 模块级常量）：MarkdownBlock 的文件头明写调用方每次
  传新对象会让整棵树重挂载。
*/
const previewMarkdownComponents = markRaw({
  ...richContentComponents,
  a: MarkdownLink,
});

const citationSources = computed(() =>
  props.policy.language === "markdown"
    ? extractCitationSources(props.content ?? "")
    : [],
);

const scrollKey = computed(() => props.filename);
const scrollMessageKey = computed(() =>
  createHtmlPreviewScrollKey(scrollKey.value),
);
const scrollPosition = { x: 0, y: 0 };
const previewFrame = ref<HTMLIFrameElement | null>(null);
const htmlPreviewUrl = ref<string>();
let objectUrls: string[] = [];

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

/** 只内联**同源的产物**请求；外站资源照旧由 iframe 自己去取。 */
function shouldInlineHtmlPreviewResource(resourceUrl: string) {
  try {
    const parsed = new URL(resourceUrl, globalThis.location?.href);
    if (parsed.origin !== globalThis.location?.origin) return false;
    return (
      /^\/api\/threads\/[^/]+\/artifacts\//.test(parsed.pathname) ||
      /^\/mock\/api\/threads\/[^/]+\/artifacts\//.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      // 内部标识，不是给用户看的文案：这条 reject 只会被下面的 catch 吞掉并
      // console.warn，不进任何界面。
      reject(new Error("html-preview-resource-read-failed"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function releaseObjectUrls() {
  for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
  objectUrls = [];
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

let previewGeneration = 0;
let previewController: AbortController | null = null;

watch(
  () => [props.content, props.policy.language, props.url] as const,
  async ([content, language, url]) => {
    previewController?.abort();
    if (language !== "html") {
      releaseObjectUrls();
      htmlPreviewUrl.value = undefined;
      return;
    }
    const generation = ++previewGeneration;
    const controller = new AbortController();
    previewController = controller;

    const source = content ?? "";
    const resourceUrlMap = new Map<string, string>();
    const resourceUrls = [
      ...new Set(
        collectHtmlPreviewResourceUrls(source)
          .map((resourceUrl) =>
            resolveHtmlPreviewResourceReference(resourceUrl, url),
          )
          .filter(shouldInlineHtmlPreviewResource),
      ),
    ];
    await Promise.all(
      resourceUrls.map(async (resourceUrl) => {
        try {
          const response = await fetch(resourceUrl, {
            signal: controller.signal,
          });
          if (!response.ok) return;
          resourceUrlMap.set(
            resourceUrl,
            await blobToDataUrl(await response.blob()),
          );
        } catch (error) {
          if (!controller.signal.aborted) {
            console.warn("Failed to inline HTML preview resource", error);
          }
        }
      }),
    );
    if (generation !== previewGeneration) return;

    const previewContent = appendHtmlPreviewScrollRestoration(
      rewriteHtmlPreviewResourceUrls(source, url, undefined, resourceUrlMap),
      scrollKey.value,
    );
    releaseObjectUrls();
    const objectUrl = URL.createObjectURL(
      new Blob([previewContent], { type: "text/html;charset=utf-8" }),
    );
    objectUrls.push(objectUrl);
    htmlPreviewUrl.value = objectUrl;
  },
  { immediate: true },
);

onMounted(() => globalThis.addEventListener("message", onScrollMessage));
onBeforeUnmount(() => {
  globalThis.removeEventListener("message", onScrollMessage);
  previewController?.abort();
  releaseObjectUrls();
});
</script>

<template>
  <template v-if="policy.kind === 'browser-media'">
    <img
      v-if="policy.previewKind === 'image'"
      :src="url"
      :alt="filename"
      class="size-full object-contain"
    />
    <audio
      v-else-if="policy.previewKind === 'audio'"
      :src="url"
      :aria-label="filename"
      controls
      class="m-auto w-4/5"
    />
    <video
      v-else
      :src="url"
      :aria-label="filename"
      controls
      playsinline
      class="size-full bg-black object-contain"
    />
  </template>
  <iframe
    v-else-if="policy.kind === 'safe-document'"
    :src="url"
    class="size-full"
    sandbox=""
  />
  <!--
    不能在浏览器里预览的文件，给的是**一整块**回退：图标、文件名、类型、一句说明，
    外加一个下载入口。React 对所有「既不是代码文件、又不能浏览器预览」的类型都渲染
    这一块（artifact-file-detail.tsx 的 ArtifactDownloadFallback），docx / zip / skill
    走的是同一条路。Vue 原来是两句各不相同的干巴巴的话，而且没有任何出路——用户看到
    "Download-only file." 之后并不知道从哪儿下载。
  -->
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
    <!-- React 在 markdown 预览下面同样挂一份引用来源（ArtifactFilePreview）。 -->
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
  <pre
    v-else
    class="min-h-full overflow-auto p-4 font-mono text-xs leading-5 whitespace-pre-wrap"
    >{{ content }}</pre>
</template>
