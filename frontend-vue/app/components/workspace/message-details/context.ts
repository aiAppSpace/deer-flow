import {
  inject,
  nextTick,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  toValue,
  watch,
  type Component,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
} from "vue";
export interface MessageDetail {
  id: string;
  title: string;
  content: Component;
  props?: Record<string, unknown>;
  actions?: Component;
  actionProps?: Record<string, unknown>;
}
export interface MessageDetailsOwner {
  open: Ref<boolean>;
  selectedDetail: ShallowRef<MessageDetail | null>;
  select: (detail: MessageDetail, origin?: HTMLElement) => boolean;
  close: (options?: { restoreFocus?: boolean }) => void;
}
const key: InjectionKey<MessageDetailsOwner> = Symbol("message-details");
/** One owner per displayed conversation, shared by chat and public showcase. */
export function provideMessageDetails(
  scope: MaybeRefOrGetter<string>,
  onSelect?: (() => boolean) | (() => void),
): MessageDetailsOwner {
  const open = ref(false);
  const selectedDetail = shallowRef<MessageDetail | null>(null);
  let origin: HTMLElement | undefined;
  let generation = 0;
  const select = (detail: MessageDetail, nextOrigin?: HTMLElement) => {
    if (onSelect?.() === false) return false;
    generation++;
    origin = nextOrigin;
    selectedDetail.value = detail;
    open.value = true;
    return true;
  };
  const close = (options?: { restoreFocus?: boolean }) => {
    const token = ++generation;
    open.value = false;
    if (options?.restoreFocus === false) return;
    void nextTick(() => {
      if (token === generation && origin?.isConnected)
        origin.focus({ preventScroll: true });
    });
  };
  watch(
    () => toValue(scope),
    () => {
      generation++;
      open.value = false;
      selectedDetail.value = null;
      origin = undefined;
    },
    // Intermediate identities must retire the selection even in an A→B→A flush.
    { flush: "sync" },
  );
  onScopeDispose(() => {
    generation++;
    open.value = false;
    selectedDetail.value = null;
    origin = undefined;
  });
  const owner = { open, selectedDetail, select, close };
  provide(key, owner);
  return owner;
}
export function useMaybeMessageDetails() {
  return inject(key, null);
}
