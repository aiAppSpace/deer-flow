<script setup lang="ts">
import { onScopeDispose, ref, type ComponentPublicInstance } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export interface MessageDetailsMenuEntry {
  id: string;
  title: string;
  subtitle?: string;
  onSelect:
    ((origin?: HTMLElement) => boolean) | ((origin?: HTMLElement) => void);
}
defineProps<{
  label: string;
  title: string;
  entries: MessageDetailsMenuEntry[];
}>();
const open = ref(false);
const trigger = ref<ComponentPublicInstance | null>(null);
let selected = false;
let interaction: "hover" | "press" = "press";
let openTimer: ReturnType<typeof setTimeout> | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
function clear() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  openTimer = undefined;
  closeTimer = undefined;
}
onScopeDispose(clear);
function enter(event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  clear();
  if (!open.value)
    openTimer = setTimeout(() => {
      interaction = "hover";
      open.value = true;
      openTimer = undefined;
    }, 120);
}
function enterContent(event: PointerEvent) {
  // Exit animations retain the content while layout moves it under the pointer.
  // Only the trigger may open a closed menu; live content can cancel its close.
  if (open.value) enter(event);
}
function leave(event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  clear();
  if (interaction === "hover")
    closeTimer = setTimeout(() => {
      open.value = false;
      closeTimer = undefined;
    }, 180);
}
function press() {
  clear();
  interaction = "press";
}
function change(value: boolean) {
  clear();
  if (value) selected = false;
  open.value = value;
}
function select(entry: MessageDetailsMenuEntry, event: Event) {
  const element = trigger.value?.$el;
  selected =
    entry.onSelect(element instanceof HTMLElement ? element : undefined) !==
    false;
  if (!selected) event.preventDefault();
}
function opening(event: Event) {
  if (interaction === "hover") event.preventDefault();
}
function closing(event: Event) {
  if (interaction === "hover" || selected) event.preventDefault();
}
</script>
<template>
  <DropdownMenu
    v-if="entries.length"
    :modal="false"
    :open="open"
    @update:open="change"
    ><DropdownMenuTrigger
      ><Button
        ref="trigger"
        size="icon-sm"
        variant="ghost"
        :aria-label="label"
        @pointerenter="enter"
        @pointerleave="leave"
        @pointerdown="press"
        @keydown="press"
        ><slot name="icon" /></Button></DropdownMenuTrigger
    ><DropdownMenuContent
      align="start"
      side="top"
      class="w-64 max-w-[calc(100vw-2rem)] rounded-xl p-2"
      @pointerenter="enterContent"
      @pointerleave="leave"
      @open-auto-focus="opening"
      @close-auto-focus="closing"
      ><DropdownMenuLabel class="text-muted-foreground text-xs">{{
        title
      }}</DropdownMenuLabel
      ><DropdownMenuSeparator /><DropdownMenuItem
        v-for="entry in entries"
        :key="entry.id"
        class="group cursor-pointer justify-between gap-3 rounded-lg py-2 focus:bg-transparent"
        @select="select(entry, $event)"
        ><span
          class="min-w-0 truncate text-sm underline-offset-4 group-hover:underline group-focus:underline"
          >{{ entry.title }}</span
        ><span
          v-if="entry.subtitle"
          class="text-muted-foreground shrink-0 text-xs"
          >{{ entry.subtitle }}</span
        ></DropdownMenuItem
      ></DropdownMenuContent
    ></DropdownMenu
  >
</template>
