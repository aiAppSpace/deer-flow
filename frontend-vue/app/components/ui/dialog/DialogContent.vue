<!--
  【文件职责】     Dialog 内容层：焦点陷阱、Escape、外点关闭与可选关闭按钮。
  【架构位置】     L2
  【主要导出】     DialogContent 组件
  【依赖关系】     Reka DialogContent/DialogClose · DialogOverlay · cn
  【边界与注意】   **关闭按钮默认渲染**，与 React 的 shadcn DialogContent 一致
                   （那边 showCloseButton 默认 true，名字是写死的 sr-only "Close"）。
                   closeLabel 是**必填 prop**：primitive 不持有产品文案（文案的唯一
                   owner 是词典，见 primitives.close 那段注释），但"忘了传就静默没有
                   关闭按钮"是个不该存在的陷阱——这里让 tsc 在编译期把它拦掉，
                   而不是指望每个调用点自觉。
                   要显式去掉按钮的（React 只有 sidecar 删除中那一处）传 :show-close="false"。
                   Reka 全库没有一处 aria-modal，Radix 则在 modal content 上写 true。
                   这不是样式差异：读屏器靠它知道背景已经不可达。所以 modal 语义由
                   本层显式补上，而不是指望底座。非模态浮层（Popover）绝不能加。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogPortal,
  type DialogContentEmits,
  type DialogContentProps,
  useForwardProps,
} from "reka-ui";
import { X } from "lucide-vue-next";

import { cn } from "@/lib/utils";

import DialogOverlay from "./DialogOverlay.vue";

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
      /** 关闭按钮的可访问名字。必填：省略它就等于悄悄发布一个关不掉的对话框。 */
      closeLabel: string;
      /** 对应 React 的 showCloseButton；默认渲染。 */
      showClose?: boolean;
      /** 与 Dialog 根的 modal 保持一致；只影响 aria-modal 的声明。 */
      modal?: boolean;
    }
  >(),
  {
    modal: true,
    showClose: true,
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
    closeLabel: _closeLabel,
    showClose: _showClose,
    modal: _modal,
    ...rest
  } = forwarded.value;
  void _class;
  void _overlayClass;
  void _closeLabel;
  void _showClose;
  void _modal;
  return rest;
});

/*
  Radix/Reka 的焦点循环保证焦点还在 dialog 里，却不保证低高度 + 文本放大后
  新焦点仍落在 dialog 的滚动视口内。等浏览器完成本次 Tab 的默认滚动后，再由
  真正的滚动所有者把焦点送到最近可见位置；正向与反向循环共用这一条合同。
*/
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
    <DialogOverlay :class="props.overlayClass" />
    <DialogContent
      data-slot="dialog-content"
      :aria-modal="props.modal ? 'true' : undefined"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-80 grid max-h-[calc(100dvh-32px)] w-full max-w-[calc(100%-32px)] min-w-0 -translate-x-1/2 -translate-y-1/2 grid-cols-[minmax(0,1fr)] gap-4 overflow-x-hidden overflow-y-auto rounded-lg border p-4 shadow-lg duration-200 outline-none sm:max-w-lg sm:p-6',
          props.class,
        )
      "
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
        v-if="props.showClose"
        data-slot="dialog-close"
        :aria-label="props.closeLabel"
        class="ring-offset-background focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 flex size-7 cursor-pointer items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none"
      >
        <X :size="16" aria-hidden="true" />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
