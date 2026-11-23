<!--
  【文件职责】     把 CodeMirror 6 编辑器接成一个 v-model 组件，并管理它的加载与销毁。
  【架构位置】     L2
  【主要导出】     CodeEditor 组件
  【依赖关系】     core/code-editor/{editor,language} · cn
  【边界与注意】   CodeMirror 只在 mount 后动态 import，所以第一帧没有编辑器。
                   这一帧渲染与 React 相同的只读 Textarea 兜底，而不是空白——artifact 面板刚
                   把内容读出来就闪一下空编辑器，看起来和「内容丢了」一模一样。

                   primitive 不持有产品文案：可访问名字由调用方以 contentLabel 传入，
                   落在 CodeMirror 的 contenteditable 上——那个元素只有
                   role="textbox"，没有名字就是一个读屏器读不出用途的编辑区。
-->

<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type HTMLAttributes,
} from "vue";

import { Textarea } from "@/components/ui/textarea";

import type { CodeEditorHandle } from "@/core/code-editor/editor";
import { normalizeCodeEditorLanguage } from "@/core/code-editor/language";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    language?: string | null;
    theme?: "light" | "dark";
    readonly?: boolean;
    autofocus?: boolean;
    contentLabel?: string;
    class?: HTMLAttributes["class"];
  }>(),
  {
    language: undefined,
    theme: "light",
    readonly: false,
    autofocus: false,
    contentLabel: undefined,
    class: undefined,
  },
);
const emit = defineEmits<{
  "update:modelValue": [value: string];
  save: [];
}>();

const host = ref<HTMLElement | null>(null);
const ready = ref(false);
let handle: CodeEditorHandle | null = null;
/** 卸载与快速重挂都靠它作废在途的 import/create，避免向已销毁的宿主写入。 */
let generation = 0;

onMounted(async () => {
  const current = ++generation;
  const parent = host.value;
  if (!parent) return;
  const { createCodeEditor } = await import("@/core/code-editor/editor");
  if (current !== generation) return;
  const requestedLanguage = normalizeCodeEditorLanguage(props.language);
  const created = await createCodeEditor({
    parent,
    doc: props.modelValue,
    language: requestedLanguage,
    theme: props.theme,
    readOnly: props.readonly,
    contentLabel: props.contentLabel,
    onChange: (value) => emit("update:modelValue", value),
    onSave: () => emit("save"),
  });
  if (current !== generation) {
    created.destroy();
    return;
  }
  handle = created;
  ready.value = true;
  /*
    props 可能在两次 await 之间已经变过。惰性 watcher 在 handle 还是 null 时
    什么都没做，所以创建完成后必须按当前 props 再对齐一次。
  */
  created.setDocument(props.modelValue);
  created.setReadOnly(props.readonly);
  created.setTheme(props.theme);
  const currentLanguage = normalizeCodeEditorLanguage(props.language);
  if (currentLanguage !== requestedLanguage) {
    void created.setLanguage(currentLanguage);
  }
  // Wait for Vue to retire the fallback and remove the pending host's inert
  // boundary before giving focus to CodeMirror. Unmount can retire this await.
  await nextTick();
  if (current !== generation) return;
  if (props.autofocus) created.focus();
});

onBeforeUnmount(() => {
  generation += 1;
  handle?.destroy();
  handle = null;
  ready.value = false;
});

watch(
  () => props.modelValue,
  (value) => handle?.setDocument(value),
);
watch(
  () => props.language,
  (value) => void handle?.setLanguage(normalizeCodeEditorLanguage(value)),
);
watch(
  () => props.theme,
  (value) => handle?.setTheme(value),
);
watch(
  () => props.readonly,
  (value) => handle?.setReadOnly(value),
);
</script>

<template>
  <div :class="cn('relative size-full overflow-hidden', props.class)">
    <div
      ref="host"
      class="size-full overflow-auto px-2 py-0 font-mono"
      :aria-hidden="ready ? undefined : true"
      :inert="!ready"
    />
    <!--
      兜底层覆盖在宿主之上而不是替换它：宿主必须从第一帧起就存在且可见，
      否则 CodeMirror 会在一个 display:none 的容器里完成首次测量。
      初始化中的宿主仍参与布局，但 inert/aria-hidden 保证交接前只有兜底可读、可聚焦。
    -->
    <Textarea
      v-if="!ready"
      :model-value="modelValue"
      readonly
      :aria-label="contentLabel"
      class="absolute inset-0 h-full resize-none overflow-auto border-none p-4! font-mono [&_.cm-editor]:h-full [&_.cm-focused]:outline-none! [&_.cm-line]:px-2! [&_.cm-line]:py-0!"
    />
  </div>
</template>
