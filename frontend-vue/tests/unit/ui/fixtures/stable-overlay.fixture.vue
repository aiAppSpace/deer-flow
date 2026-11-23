<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
defineProps<{ kind: "dialog" | "sheet"; withFrame?: boolean; as?: string }>();
</script>

<template>
  <component :is="kind === 'sheet' ? Sheet : Dialog">
    <component :is="kind === 'sheet' ? SheetTrigger : DialogTrigger">
      <button data-open>Open</button>
    </component>
    <component
      :is="kind === 'sheet' ? SheetContent : DialogContent"
      close-label="Close"
      :as="as"
    >
      <component :is="kind === 'sheet' ? SheetTitle : DialogTitle"
        >Details</component
      >
      <component :is="kind === 'sheet' ? SheetDescription : DialogDescription"
        >Stable compiled slot</component
      >
      <button data-choice="a">A</button>
      <iframe v-if="withFrame" title="Preview" srcdoc="<p>Preview</p>" />
      <button data-choice="b">B</button>
    </component>
  </component>
</template>
