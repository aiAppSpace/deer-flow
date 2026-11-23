// One workspace toast owner holds notice identity and its remaining 4000ms lifetime.
// The viewport forwards interaction/visibility pause state; updates reuse the notice id.

import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export type WorkspaceToastKind =
  "default" | "success" | "error" | "info" | "warning";

export type WorkspaceToast = {
  id: number;
  kind: WorkspaceToastKind;
  message: string;
  /** 主文案下面的一行补充说明，对应 sonner 的 `description`。 */
  description?: string;
  /** 提示条右侧的一颗动作键，对应 sonner 的 `action`（归档的「撤销」用它）。 */
  action?: WorkspaceToastAction;
};

export type WorkspaceToastAction = {
  label: string;
  onClick: () => void;
};

export interface ToastTimer {
  set(callback: () => void, delayMs: number): number;
  clear(id: number): void;
}

export interface WorkspaceToastStore {
  toasts: Ref<WorkspaceToast[]>;
  message(message: string, options?: WorkspaceToastOptions): number;
  success(message: string, options?: WorkspaceToastOptions): number;
  error(message: string, options?: WorkspaceToastOptions): number;
  info(message: string, options?: WorkspaceToastOptions): number;
  warning(message: string, options?: WorkspaceToastOptions): number;
  dismiss(id: number): void;
  setPaused(paused: boolean): void;
  clear(): void;
}

export type WorkspaceToastOptions = {
  /** 就地更新这一条；它已经不在了就新增一条。 */
  id?: number;
  description?: string;
  /*
    动作键。**点了之后这条提示要消失**——归档的「撤销」点完还留着，
    下一次归档会看到两条一模一样的提示，分不清哪条对应哪次操作。
    消失由 store 负责，调用方只管做事。
  */
  action?: WorkspaceToastAction;
};

const browserTimer: ToastTimer = {
  set: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clear: (id) => window.clearTimeout(id),
};

export function createWorkspaceToastStore(options?: {
  timer?: ToastTimer;
  durationMs?: number;
}): WorkspaceToastStore {
  const timer = options?.timer ?? browserTimer;
  const durationMs = options?.durationMs ?? 4_000;
  const toasts = ref<WorkspaceToast[]>([]);
  const timers = new Map<
    number,
    { timeout?: number; remaining: number; started: number }
  >();
  let paused = false;
  let nextId = 0;

  function dismiss(id: number) {
    const clock = timers.get(id);
    if (clock !== undefined) {
      if (clock.timeout !== undefined) timer.clear(clock.timeout);
      timers.delete(id);
    }
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function schedule(id: number) {
    const existing = timers.get(id);
    if (existing?.timeout !== undefined) timer.clear(existing.timeout);
    const clock = { remaining: durationMs, started: Date.now() } as {
      timeout?: number;
      remaining: number;
      started: number;
    };
    timers.set(id, clock);
    if (!paused) clock.timeout = timer.set(() => dismiss(id), clock.remaining);
  }

  function setPaused(value: boolean) {
    if (paused === value) return;
    paused = value;
    for (const [id, clock] of timers) {
      if (value) {
        clock.remaining = Math.max(
          0,
          clock.remaining - (Date.now() - clock.started),
        );
        if (clock.timeout !== undefined) timer.clear(clock.timeout);
        clock.timeout = undefined;
      } else {
        clock.started = Date.now();
        clock.timeout = timer.set(() => dismiss(id), clock.remaining);
      }
    }
  }

  function show(
    kind: WorkspaceToastKind,
    message: string,
    options?: WorkspaceToastOptions,
  ) {
    const target = options?.id;
    if (
      target !== undefined &&
      toasts.value.some((item) => item.id === target)
    ) {
      toasts.value = toasts.value.map((item) =>
        item.id === target
          ? {
              ...item,
              kind,
              message,
              description: options?.description,
              action: options?.action,
            }
          : item,
      );
      schedule(target);
      return target;
    }
    const id = ++nextId;
    toasts.value = [
      ...toasts.value,
      {
        id,
        kind,
        message,
        description: options?.description,
        action: options?.action,
      },
    ];
    schedule(id);
    return id;
  }

  function clear() {
    for (const clock of timers.values())
      if (clock.timeout !== undefined) timer.clear(clock.timeout);
    timers.clear();
    toasts.value = [];
  }

  return {
    toasts,
    message: (message, options) => show("default", message, options),
    success: (message, options) => show("success", message, options),
    error: (message, options) => show("error", message, options),
    info: (message, options) => show("info", message, options),
    warning: (message, options) => show("warning", message, options),
    dismiss,
    setPaused,
    clear,
  };
}

export const workspaceToastKey: InjectionKey<WorkspaceToastStore> =
  Symbol("workspace-toast");

export function provideWorkspaceToast(store = createWorkspaceToastStore()) {
  provide(workspaceToastKey, store);
  return store;
}

export function useWorkspaceToast() {
  const store = inject(workspaceToastKey);
  if (!store) throw new Error("Workspace toast owner is not available.");
  return store;
}
