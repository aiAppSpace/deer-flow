<!--
  【文件职责】     紧凑选择面板的定位、portal 和焦点生命周期。
  【架构位置】     L2
  【主要导出】     PopoverPickerContent
  【依赖关系】     Reka PopoverContent/Portal · cn
  【边界与注意】   对齐 React model-picker-content.tsx 的独立 PopoverPrimitive.Content，
                   该面板与默认 PopoverContent 的圆角、阴影、padding 不同。
                   getElement 只暴露真实内容节点，避免调用方拿到 Portal 的注释节点。
-->
<script setup lang="ts">
import { computed, ref, watch, type HTMLAttributes } from "vue";
import {
  PopoverContent,
  PopoverPortal,
  useForwardProps,
  injectPopoverRootContext,
  type PopoverContentProps,
  type PopoverContentEmits,
} from "reka-ui";
import { usePortalFocusReveal } from "@/components/ui/scroll-area/focus-reveal";
import { cn } from "@/lib/utils";
import { retainOpenAnchor } from "./retain-open-anchor";
defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<PopoverContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    side: "top",
    align: "end",
    sideOffset: 8,
    collisionPadding: 8,
    updatePositionStrategy: "always",
    class: undefined,
  },
);
const emits = defineEmits<PopoverContentEmits>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
const content = ref<InstanceType<typeof PopoverContent> | null>(null);
const root = injectPopoverRootContext();
const focusReveal = usePortalFocusReveal();
function revealFocus(event: FocusEvent) {
  focusReveal?.reveal(event, root.triggerElement.value);
}
watch(
  () => [content.value, root.open.value, root.triggerElement.value] as const,
  ([instance, open, reference], _previous, onCleanup) => {
    const element = instance?.$el;
    if (open && element instanceof HTMLElement && reference)
      onCleanup(retainOpenAnchor(element, reference));
  },
  { flush: "post" },
);
defineExpose({
  getElement: () => content.value?.$el as HTMLElement | undefined,
});
</script>
<template>
  <PopoverPortal
    ><PopoverContent
      ref="content"
      as-child
      v-bind="{ ...$attrs, ...delegated }"
      role="dialog"
      data-slot="popover-picker-content"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-80 flex max-h-[min(20rem,var(--reka-popover-content-available-height))] w-72 max-w-[calc(100vw-1rem)] origin-(--reka-popover-content-transform-origin) flex-col overflow-hidden rounded-md border shadow-md outline-none',
          props.class,
        )
      "
      @focusin="revealFocus"
      @focusout="focusReveal?.retire"
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
      @focus-outside="emits('focusOutside', $event)"
      @interact-outside="emits('interactOutside', $event)"
      @open-auto-focus="emits('openAutoFocus', $event)"
      @close-auto-focus="emits('closeAutoFocus', $event)"
      ><div v-bind="$attrs" aria-labelledby=""><slot /></div></PopoverContent
  ></PopoverPortal>
</template>
