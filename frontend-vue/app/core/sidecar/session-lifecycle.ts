/*
  【文件职责】     协调单个主 thread 的 sidecar restore-before-create 生命周期。
  【架构位置】     L3 纯状态机
  【主要导出】     createSidecarSessionLifecycle · SidecarSessionPhase
  【依赖关系】     sidecar/context；通过注入调用 Gateway API
  【边界与注意】   不持有模块级 session；dispose 后所有异步结果都失效。
*/
import type { SidecarContext } from "./context";

export type SidecarSessionPhase =
  "idle" | "restoring" | "creating" | "ready" | "error";

export interface SidecarSessionState {
  phase: SidecarSessionPhase;
  error: unknown;
}

type SidecarThreadIdentity = { thread_id: string };

export function createSidecarSessionLifecycle(options: {
  parentThreadId: string;
  getThreadId: () => string | null;
  setThreadId: (threadId: string | null) => void;
  findLatest: (input: {
    parentThreadId: string;
    signal?: AbortSignal;
  }) => Promise<SidecarThreadIdentity | null>;
  createThread: (input: {
    parentThreadId: string;
    context: SidecarContext | SidecarContext[];
    signal?: AbortSignal;
  }) => Promise<SidecarThreadIdentity>;
  onStateChange?: (state: SidecarSessionState) => void;
}) {
  let active = true;
  const controller = new AbortController();
  let state: SidecarSessionState = { phase: "idle", error: null };
  let restoreRequest: Promise<string | null> | null = null;
  let ensureRequest: Promise<string | null> | null = null;

  function transition(phase: SidecarSessionPhase, error: unknown = null) {
    state = { phase, error };
    options.onStateChange?.(state);
  }

  async function restore({ force = false } = {}): Promise<string | null> {
    if (!active) return null;
    const current = options.getThreadId();
    if (!force && current) {
      transition("ready");
      return current;
    }
    if (restoreRequest) return restoreRequest;

    const request = (async () => {
      transition("restoring");
      try {
        const restored = await options.findLatest({
          parentThreadId: options.parentThreadId,
          signal: controller.signal,
        });
        if (!active) return null;
        const restoredThreadId = restored?.thread_id ?? null;
        if (restoredThreadId || force) {
          options.setThreadId(restoredThreadId);
        }
        transition(restoredThreadId ? "ready" : "idle");
        return restoredThreadId;
      } catch (error) {
        if (active) transition("error", error);
        throw error;
      }
    })();
    restoreRequest = request;
    try {
      return await request;
    } finally {
      if (restoreRequest === request) restoreRequest = null;
    }
  }

  async function ensure(
    context: SidecarContext | SidecarContext[],
  ): Promise<string | null> {
    if (!active) return null;
    const current = options.getThreadId();
    if (current) {
      transition("ready");
      return current;
    }
    if (ensureRequest) return ensureRequest;

    const request = (async () => {
      const restored = await restore();
      if (!active || restored) return restored;
      transition("creating");
      try {
        const created = await options.createThread({
          parentThreadId: options.parentThreadId,
          signal: controller.signal,
          context,
        });
        if (!active) return null;
        options.setThreadId(created.thread_id);
        transition("ready");
        return created.thread_id;
      } catch (error) {
        if (active) transition("error", error);
        throw error;
      }
    })();
    ensureRequest = request;
    try {
      return await request;
    } finally {
      if (ensureRequest === request) ensureRequest = null;
    }
  }

  function dispose() {
    active = false;
    controller.abort();
    restoreRequest = null;
    ensureRequest = null;
    state = { phase: "idle", error: null };
  }

  return {
    get state() {
      return state;
    },
    restore,
    ensure,
    dispose,
  };
}
