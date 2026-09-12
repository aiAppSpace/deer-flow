<script setup lang="ts">
/*
  【文件职责】     渲染 processing 视图模型中的单个 DeerFlow 工具步骤。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 ProcessingToolStep 组件
  【依赖关系】     core/messages/processing · artifacts · markdown CodeBlock
  【边界与注意】   只消费已关联好的 result/browserView；不得回扫原始消息寻找工具结果。
*/
import { computed } from "vue";
import {
  BookOpenText,
  FolderOpen,
  Globe,
  ListTodo,
  MessageCircleQuestionMark,
  Monitor,
  NotebookPen,
  Search,
  SquareTerminal,
  Wrench,
} from "lucide-vue-next";

import CodeBlock from "@/components/markdown/CodeBlock.vue";
import { Badge } from "@/components/ui/badge";
import {
  buildWriteFileArtifactURL,
  resolveArtifactURL,
} from "@/core/artifacts/utils";
import type {
  BrowserViewMeta,
  ProcessingToolCallStep,
} from "@/core/messages/processing";
import { extractTitleFromMarkdown } from "@/core/utils/markdown";

const props = defineProps<{
  step: ProcessingToolCallStep;
  threadId?: string | null;
  isMock?: boolean;
}>();
const emit = defineEmits<{
  artifact: [path: string];
  browser: [frame: BrowserViewMeta];
}>();
const { $i18n } = useNuxtApp();

const name = computed(() => props.step.name);
const args = computed(() => props.step.args);
const result = computed(() => props.step.result);

function textArg(key: string): string | undefined {
  const value = args.value[key];
  return typeof value === "string" ? value : undefined;
}

const icon = computed(() => {
  if (name.value.startsWith("browser_")) return Monitor;
  if (name.value === "web_search" || name.value === "image_search")
    return Search;
  /*
    上游 message-group.tsx:797 是 `GlobeIcon`（= lucide 的 `Globe`）。
    本仓原来写的是 `Globe2`——它是 `Earth` 的别名，**是另一颗图标**：
    `Globe` 是经纬线地球，`Earth` 是画着大陆轮廓的那颗。
    可访问性树里两者都不出现，`icon-parity` 的字形档是唯一看得见它的地方。
  */
  if (name.value === "web_fetch") return Globe;
  if (name.value === "ls") return FolderOpen;
  if (name.value === "read_file") return BookOpenText;
  if (
    name.value === "write_file" ||
    name.value === "str_replace" ||
    name.value === "begin_artifact_write" ||
    name.value === "append_artifact_chunk" ||
    name.value === "finalize_artifact_write"
  )
    return NotebookPen;
  if (name.value === "bash") return SquareTerminal;
  if (name.value === "ask_clarification") return MessageCircleQuestionMark;
  if (name.value === "write_todos") return ListTodo;
  return Wrench;
});

function browserLabel() {
  switch (name.value) {
    case "browser_navigate":
      return textArg("url")
        ? $i18n.t.value.toolCalls.browserNavigate(textArg("url")!)
        : $i18n.t.value.toolCalls.browserNavigateGeneric;
    case "browser_click":
      return $i18n.t.value.toolCalls.browserClick;
    case "browser_type":
      return $i18n.t.value.toolCalls.browserType;
    case "browser_snapshot":
      return $i18n.t.value.toolCalls.browserSnapshot;
    case "browser_get_text":
      return $i18n.t.value.toolCalls.browserGetText;
    case "browser_back":
      return $i18n.t.value.toolCalls.browserBack;
    case "browser_screenshot":
      return $i18n.t.value.toolCalls.browserScreenshot;
    case "browser_close":
      return $i18n.t.value.toolCalls.browserClose;
    default:
      return $i18n.t.value.toolCalls.useTool(name.value);
  }
}

const label = computed(() => {
  const description = textArg("description");
  if (name.value.startsWith("browser_")) return browserLabel();
  if (name.value === "web_search") {
    const query = textArg("query");
    return query
      ? $i18n.t.value.toolCalls.searchOnWebFor(query)
      : $i18n.t.value.toolCalls.searchForRelatedInfo;
  }
  if (name.value === "image_search") {
    const query = textArg("query");
    return query
      ? $i18n.t.value.toolCalls.searchForRelatedImagesFor(query)
      : $i18n.t.value.toolCalls.searchForRelatedImages;
  }
  if (name.value === "web_fetch") return $i18n.t.value.toolCalls.viewWebPage;
  if (name.value === "ls")
    return description ?? $i18n.t.value.toolCalls.listFolder;
  if (name.value === "read_file")
    return description ?? $i18n.t.value.toolCalls.readFile;
  if (
    name.value === "write_file" ||
    name.value === "str_replace" ||
    name.value === "begin_artifact_write" ||
    name.value === "append_artifact_chunk" ||
    name.value === "finalize_artifact_write"
  )
    return description ?? $i18n.t.value.toolCalls.writeFile;
  if (name.value === "bash")
    return description ?? $i18n.t.value.toolCalls.executeCommand;
  if (name.value === "ask_clarification")
    return $i18n.t.value.toolCalls.needYourHelp;
  if (name.value === "write_todos") return $i18n.t.value.toolCalls.writeTodos;
  return description ?? $i18n.t.value.toolCalls.useTool(name.value);
});

function safeExternalURL(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

const webSearchResults = computed(() =>
  Array.isArray(result.value)
    ? result.value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const url = safeExternalURL(Reflect.get(item, "url"));
        const title = Reflect.get(item, "title");
        return url && typeof title === "string" ? [{ url, title }] : [];
      })
    : [],
);

const imageSearchResults = computed(() => {
  if (!result.value || typeof result.value !== "object") return [];
  const items = Reflect.get(result.value, "results");
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const sourceURL = safeExternalURL(Reflect.get(item, "source_url"));
    const thumbnailURL = safeExternalURL(Reflect.get(item, "thumbnail_url"));
    const title = Reflect.get(item, "title");
    return sourceURL && thumbnailURL && typeof title === "string"
      ? [{ sourceURL, thumbnailURL, title }]
      : [];
  });
});

const webFetchTarget = computed(() => {
  const url = safeExternalURL(textArg("url"));
  if (!url) return undefined;
  const title =
    typeof result.value === "string"
      ? extractTitleFromMarkdown(result.value)
      : undefined;
  return {
    url,
    title: title && title.toLowerCase() !== "untitled" ? title : url,
  };
});

const filePath = computed(() =>
  typeof args.value.path === "string" ? args.value.path : undefined,
);
const successfulResult = computed(
  () =>
    typeof result.value === "string" &&
    result.value.trimStart().startsWith("OK"),
);
const artifactTarget = computed(() => {
  if (!filePath.value) return undefined;
  if (name.value === "write_file" || name.value === "str_replace") {
    return buildWriteFileArtifactURL({
      filepath: filePath.value,
      messageId: props.step.messageId,
      toolCallId: props.step.id,
    });
  }
  if (name.value === "finalize_artifact_write" && successfulResult.value) {
    return filePath.value;
  }
  return undefined;
});
const browserPreviewURL = computed(() => {
  const screenshot = props.step.browserView?.screenshot;
  return screenshot && props.threadId
    ? resolveArtifactURL(screenshot, props.threadId, { isMock: props.isMock })
    : undefined;
});
</script>

<template>
  <!--
    整步可点，但**步骤本身不是控件**。

    React 的 ChainOfThoughtStep 是一个带 onClick 的 div，标签是 div、路径是
    Badge（span），两者都不是 button
    （frontend/src/components/ai-elements/chain-of-thought.tsx 与
    workspace/messages/message-group.tsx 的 write_file 分支）。Vue 这边原来把
    标签和路径各做成一个 button：可访问性树里因此多出两颗按钮，而且两个
    inline-flex 按钮会排在同一行——路径不再另起一行，量出来是它比 React 靠右 347px。
  -->
  <div
    class="text-muted-foreground fade-in-0 slide-in-from-top-2 flex gap-2 text-sm"
    :class="artifactTarget ? 'cursor-pointer' : undefined"
    :data-tool-name="name"
    @click="artifactTarget && emit('artifact', artifactTarget)"
  >
    <div class="relative mt-0.5 shrink-0">
      <component :is="icon" :size="16" />
      <div class="bg-border absolute top-7 bottom-0 left-1/2 -mx-px w-px" />
    </div>
    <div class="min-w-0 flex-1 space-y-2 overflow-hidden">
      <div>{{ label }}</div>

      <div
        v-if="name === 'web_search' && webSearchResults.length"
        class="flex flex-wrap items-center gap-2 overflow-x-hidden"
      >
        <a
          v-for="item in webSearchResults"
          :key="item.url"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-xs font-normal"
        >
          {{ item.title }}
        </a>
      </div>

      <div
        v-else-if="name === 'image_search' && imageSearchResults.length"
        class="flex flex-wrap items-center gap-2 overflow-x-hidden"
      >
        <a
          v-for="item in imageSearchResults"
          :key="item.sourceURL"
          :href="item.sourceURL"
          :title="item.title"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-accent size-24 overflow-hidden rounded-lg"
        >
          <img
            :src="item.thumbnailURL"
            :alt="item.title"
            class="size-full object-cover"
            width="100"
            height="100"
          />
        </a>
      </div>

      <!--
        **这三处都走 `ui/badge`，不是手写的 span。**

        上游这一族全部是 `ChainOfThoughtSearchResult`
        （`ai-elements/chain-of-thought.tsx:183`），而它就是
        `<Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-normal">`。
        本仓原来手抄了它的**外观**（`bg-secondary text-secondary-foreground inline-flex
        rounded-md px-2 py-0.5 text-xs font-normal`），抄丢的东西在 2026-09-12 第十轮
        被新加的 `borderRadius` 档当场量出来：**上游是 `rounded-full`
        （Tailwind v4 的 `calc(infinity*1px)`，computed 3.35544e+07px），
        本仓是 `rounded-md`（8px）**——一个纯形状差异，位置、尺寸、颜色、字号、
        字重、命中各档**一条都不响**，所以它在此之前没有任何机器看得见。

        手抄那一版同时丢掉的还有：`border`、`w-fit`、`whitespace-nowrap`、`shrink-0`、
        `gap-1`、`items-center justify-center`、`overflow-hidden`、
        `focus-visible:*` 与 `aria-invalid:*` 那两组状态、`transition-[color,box-shadow]`。

        `web_fetch` 这一支上游是**Badge 里套一个 `<a>`**（chain-of-thought 那颗
        badge 本身不是控件，链接才是），不是把链接本身当 badge 用——照抄这一层。
      -->
      <Badge
        v-else-if="name === 'web_fetch' && webFetchTarget"
        variant="secondary"
        class="gap-1 px-2 py-0.5 text-xs font-normal"
      >
        <a
          :href="webFetchTarget.url"
          target="_blank"
          rel="noopener noreferrer"
          class="cursor-pointer"
        >
          {{ webFetchTarget.title }}
        </a>
      </Badge>

      <Badge
        v-else-if="(name === 'ls' || name === 'read_file') && filePath"
        variant="secondary"
        class="cursor-pointer gap-1 px-2 py-0.5 text-xs font-normal"
      >
        {{ filePath }}
      </Badge>

      <Badge
        v-else-if="filePath && icon === NotebookPen"
        variant="secondary"
        class="cursor-pointer gap-1 px-2 py-0.5 text-xs font-normal"
      >
        {{ filePath }}
      </Badge>

      <CodeBlock
        v-else-if="name === 'bash' && textArg('command')"
        :code="textArg('command')!"
        language="bash"
        class="mx-0 border-none px-0"
      />

      <button
        v-if="browserPreviewURL && step.browserView"
        type="button"
        class="border-border mt-1 block w-full max-w-md cursor-pointer overflow-hidden rounded-lg border"
        @click="emit('browser', step.browserView)"
      >
        <img
          :src="browserPreviewURL"
          :alt="
            step.browserView.title ?? $i18n.t.value.toolCalls.browserSnapshot
          "
          class="w-full object-contain"
          loading="lazy"
          decoding="async"
        />
        <div
          v-if="step.browserView.url"
          class="text-muted-foreground bg-muted/40 truncate px-2 py-1 text-left text-[11px]"
        >
          {{ step.browserView.url }}
        </div>
      </button>
    </div>
  </div>
</template>
