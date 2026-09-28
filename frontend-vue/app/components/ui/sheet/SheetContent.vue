<!--
  【文件职责】     Sheet 内容层：贴边定位、遮罩、焦点陷阱与可选关闭按钮。
  【架构位置】     L2
  【主要导出】     SheetContent 组件
  【依赖关系】     Reka DialogContent/Overlay/Portal/Close · sheetVariants · cn
  【边界与注意】   关闭按钮恒定渲染，closeLabel 必填——理由同 DialogContent。
                   React 的 SheetContent 连 showCloseButton 这个开关都没有，永远有关闭按钮。
                   Reka 全库没有一处 aria-modal，Radix 则在 modal content 上写 true。
                   这不是样式差异：读屏器靠它知道背景已经不可达。所以 modal 语义由
                   本层显式补上，而不是指望底座。非模态浮层（Popover）绝不能加。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  type DialogContentEmits,
  type DialogContentProps,
  useForwardProps,
} from "reka-ui";
import { X } from "lucide-vue-next";

import { cn } from "@/lib/utils";

import { sheetVariants, type SheetVariants } from "./variants";

/*
  内容 portal 到 body，组件根是 Portal 而不是内容元素。不关掉 attribute 继承，
  调用方传的 data-testid / aria-label / id 会落到 Portal 上——那是一个不渲染
  任何 DOM 的包装组件，属性直接消失，而且没有任何报错。
*/
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    DialogContentProps & {
      class?: HTMLAttributes["class"];
      overlayClass?: HTMLAttributes["class"];
      side?: SheetVariants["side"];
      /** 关闭按钮的可访问名字。必填，理由见文件头。 */
      closeLabel: string;
      /** 与 Sheet 根的 modal 保持一致；只影响 aria-modal 的声明。 */
      modal?: boolean;
    }
  >(),
  {
    side: "right",
    modal: true,
    class: undefined,
    overlayClass: undefined,
  },
);
const emits = defineEmits<DialogContentEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const {
    class: _class,
    overlayClass: _overlayClass,
    side: _side,
    closeLabel: _closeLabel,
    modal: _modal,
    ...rest
  } = forwarded.value;
  void _class;
  void _overlayClass;
  void _side;
  void _closeLabel;
  void _modal;
  return rest;
});

function keepFocusedControlVisible(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  requestAnimationFrame(() => {
    if (target.isConnected) target.scrollIntoView({ block: "nearest" });
  });
}
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      data-slot="sheet-overlay"
      :class="
        cn(
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-80 bg-black/35',
          props.overlayClass,
        )
      "
    />
    <DialogContent
      data-slot="sheet-content"
      :data-side="props.side"
      :aria-modal="props.modal ? 'true' : undefined"
      v-bind="{ ...$attrs, ...delegated }"
      :class="cn(sheetVariants({ side: props.side }), props.class)"
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
      @focus-outside="emits('focusOutside', $event)"
      @interact-outside="emits('interactOutside', $event)"
      @open-auto-focus="emits('openAutoFocus', $event)"
      @close-auto-focus="emits('closeAutoFocus', $event)"
      @focusin="keepFocusedControlVisible"
    >
      <slot />
      <DialogClose
        data-slot="sheet-close"
        :aria-label="props.closeLabel"
        class="ring-offset-background focus-visible:ring-ring absolute top-4 right-4 flex size-7 cursor-pointer items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
      >
        <X :size="18" aria-hidden="true" />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
