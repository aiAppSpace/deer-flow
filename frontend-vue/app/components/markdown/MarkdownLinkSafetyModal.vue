<!--
  【文件职责】     外部链接的确认弹窗：念出目标 URL，给复制与打开两个出口。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ui/dialog · ./MarkdownIcon.vue · @/lib/utils · $i18n（globalProperties）
  【边界与注意】   内容与文案逐字对着 streamdown `dist/chunk-BO2N2NFS.js` 的 link-safety
                   modal（streamdown 2.5.0）。它不是装饰：markdown 正文是**模型产出**的，
                   直接给一个可点的外链等于把跳转决定权交给模型。上游默认开着这一层
                   （`linkSafety: { enabled: true }` 是它的内建默认值），本仓此前整个缺失
                   ——渲染的是直接跳转的 `<a>`（线索 112）。

                   **壳子走 `ui/dialog`，不再手搓遮罩**（wave 148）。原来这里是照抄
                   streamdown 的裸实现：一个 `role="button" tabindex="0"` 的
                   `fixed inset-0` 遮罩 + 一个 `role="presentation"` 的卡片 +
                   一个 document 上的 Escape 监听 + 一份手写的引用计数滚动锁。
                   那一套**没有 dialog 语义、没有焦点陷阱、不给兄弟节点打
                   `aria-hidden`、关闭后也不归还焦点**——一个「要不要跳转到这个 URL」
                   的确认框，读屏器听不出它是个对话框，Tab 一路走出去还能点到正文里
                   的其它链接。这是本轮系统扫描出的第三处同根因（另两处是移动端侧栏
                   抽屉与 mermaid 全屏）。

                   换成 primitive 之后，reka 的 `DialogContentModal` 一次给齐四件事
                   （`useHideOthers` / `FocusScope` / `DismissableLayer` / 滚动锁），
                   **本仓不再自己写一份**——手写的那份滚动锁连同 `data-markdown-modal-depth`
                   一起删掉了。

                   仍然照抄的一处：复制成功后 2 秒回落成「复制链接」，计时器在卸载时
                   清掉，否则弹窗关掉之后那个回调还会写一个已经没人看的 ref。

                   关闭按钮的名字取 `primitives.close`——上游那一句同样是 streamdown
                   写死的 "Close"，本仓这一串已经在 primitives 里了，不再重复一份。
-->

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import MarkdownIcon from "./MarkdownIcon.vue";

const props = defineProps<{ url: string; open: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

onBeforeUnmount(() => {
  if (copyTimer !== null) clearTimeout(copyTimer);
});

async function copy() {
  try {
    await navigator.clipboard.writeText(props.url);
    copied.value = true;
    if (copyTimer !== null) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    /* 剪贴板被拒时什么都不做，与上游一致 */
  }
}

function confirm() {
  emit("confirm");
  emit("close");
}
</script>

<template>
  <Dialog :open="props.open" @update:open="!$event && emit('close')">
    <DialogContent
      data-streamdown="link-safety-modal"
      :close-label="$i18n.t.value.primitives.close"
      class="sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <MarkdownIcon name="ExternalLinkIcon" :size="20" />
          <span>{{ $i18n.t.value.markdown.openExternalLink }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ $i18n.t.value.markdown.externalLinkWarning }}
        </DialogDescription>
      </DialogHeader>
      <div
        :class="
          cn(
            'bg-muted rounded-md p-3 font-mono text-sm break-all',
            props.url.length > 100 && 'max-h-32 overflow-y-auto',
          )
        "
      >
        {{ props.url }}
      </div>
      <div class="flex gap-2">
        <button
          class="bg-background hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all"
          type="button"
          @click="copy"
        >
          <MarkdownIcon :name="copied ? 'CheckIcon' : 'CopyIcon'" :size="14" />
          <span>{{
            copied
              ? $i18n.t.value.markdown.copied
              : $i18n.t.value.markdown.copyLink
          }}</span>
        </button>
        <button
          class="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all"
          type="button"
          @click="confirm"
        >
          <MarkdownIcon name="ExternalLinkIcon" :size="14" />
          <span>{{ $i18n.t.value.markdown.openLink }}</span>
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
