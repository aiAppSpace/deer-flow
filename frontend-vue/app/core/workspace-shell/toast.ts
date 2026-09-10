/*
  【文件职责】     Workspace 全局 toast 的唯一 client-state owner 与注入契约。
  【架构位置】     L3 workspace shell
  【主要导出】     create/provide/useWorkspaceToast
  【依赖关系】     Vue ref/provide/inject
  【边界与注意】   每个 workspace layout 只创建一次；卸载时 clear，避免残留 timer。

                   kind 与 React 用的 sonner 一一对应（success/error/info/warning）；
                   WorkspaceToaster 只把 error 播成 assertive，其余都是 polite。

                   **wave 73 把 warning 从「映到 info」改回一个独立的 kind。**
                   原来那条理由是「warning 与 info 在可访问性上同一档，区别只有图标，
                   而这个 toaster 一个图标都不画」——**前半句对，后半句是本仓自己的缺陷**：
                   上游 `ui/sonner.tsx:19` 给 `<Toaster>` 传了
                   `icons={{success, info, warning, error, loading}}`（五颗 lucide 图标），
                   sonner 的 `[data-icon]` 是 16×16 的常驻槽位，**每一条 toast 都画**。
                   本仓补上图标之后，warning 与 info 就有了可观察差别，
                   继续折叠等于把上游的三处 `toast.warning` 降级成 info。

                   **`durationMs` 是 4000，不是 5000**：sonner 的 `TOAST_LIFETIME`
                   就是 4000（`sonner/dist/index.mjs`）。此前 5000 是本仓自己定的，
                   同一条提示在两个应用里停留的时间不一样。

                   show 接受一个已存在的 id 就地更新那一条，而不是再插一条：多步流程
                   （Lark 授权轮询）会对同一句提示反复改写「还在等待 / 已完成」，各插一条
                   会在屏幕上堆出一摞历史，读屏器也会把过期状态重播一遍。id 已经过期
                   （超时消失或被 dismiss）时退化成新增，这样调用方不需要自己记生死。
*/
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export type WorkspaceToastKind = "success" | "error" | "info" | "warning";

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
  success(message: string, options?: WorkspaceToastOptions): number;
  error(message: string, options?: WorkspaceToastOptions): number;
  info(message: string, options?: WorkspaceToastOptions): number;
  warning(message: string, options?: WorkspaceToastOptions): number;
  dismiss(id: number): void;
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
  const timers = new Map<number, number>();
  let nextId = 0;

  function dismiss(id: number) {
    const timeoutId = timers.get(id);
    if (timeoutId !== undefined) {
      timer.clear(timeoutId);
      timers.delete(id);
    }
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function schedule(id: number) {
    const existing = timers.get(id);
    if (existing !== undefined) timer.clear(existing);
    timers.set(
      id,
      timer.set(() => dismiss(id), durationMs),
    );
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
    for (const timeoutId of timers.values()) timer.clear(timeoutId);
    timers.clear();
    toasts.value = [];
  }

  return {
    toasts,
    success: (message, options) => show("success", message, options),
    error: (message, options) => show("error", message, options),
    info: (message, options) => show("info", message, options),
    warning: (message, options) => show("warning", message, options),
    dismiss,
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
