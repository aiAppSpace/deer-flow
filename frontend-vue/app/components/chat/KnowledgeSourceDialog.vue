<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { KnowledgeSource } from "@/core/knowledge/sources";
defineProps<{ source: KnowledgeSource }>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <Dialog
    ><DialogTrigger as-child
      ><button
        type="button"
        class="text-left"
        :aria-label="
          $i18n.t.value.citations.viewKnowledgeSource(source.document_name)
        "
        @click.stop
      >
        <slot /></button
    ></DialogTrigger>
    <DialogContent
      class="max-h-[85dvh] sm:max-w-2xl"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader
        ><DialogTitle class="break-words">{{
          source.document_name
        }}</DialogTitle
        ><DialogDescription
          >{{ source.dataset_name
          }}{{
            source.pages.length
              ? ` · ${$i18n.t.value.citations.sourcePages(source.pages.join(", "))}`
              : ""
          }}</DialogDescription
        ></DialogHeader
      >
      <p class="text-muted-foreground text-xs">
        {{ $i18n.t.value.citations.retrievedExcerpt }}
      </p>
      <blockquote
        class="border-primary/30 border-l-2 pl-4 text-sm leading-relaxed break-words whitespace-pre-wrap"
      >
        {{ source.text }}
      </blockquote>
      <p v-if="source.truncated" class="text-muted-foreground text-xs">
        {{ $i18n.t.value.citations.excerptTruncated }}
      </p>
    </DialogContent>
  </Dialog>
</template>
