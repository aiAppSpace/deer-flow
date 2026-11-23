/*
  【文件职责】     独占 Agent 保存、setup_agent 结果、有限可见性验证与 cleanup 状态机。
  【架构位置】     L3 Vue lifecycle owner
  【主要导出】     useAgentCreationSession
  【依赖关系】     core/agents/creation-session · Gateway errors · Vue scope
  【边界与注意】   可见性读取有限重试；完成后不重新提交 setup_agent；账号切换取消旧 owner。
*/

import {
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import { hasToolResult } from "@/core/threads/submit";
import type { Agent } from "@/core/agents/types";
import type { Message } from "@/core/types/message";

export type AgentCreationStatus =
  "idle" | "saving" | "verifying" | "completed" | "created";

export interface AgentCreationSessionOptions {
  agentName: MaybeRefOrGetter<string>;
  ownerId?: MaybeRefOrGetter<string | null>;
  submitSave: (signal: AbortSignal) => Promise<boolean>;
  loadAgent: (name: string, signal: AbortSignal) => Promise<Agent>;
  retryDelaysMs?: readonly number[];
  onCreated?: (agent: Agent) => void | Promise<void>;
  onSaveRequested?: () => void;
  onSaveError?: (message: string) => void;
  onVerificationUnavailable?: () => void;
  copy?: Partial<{
    saveNotAccepted: string;
    requestFailed: string;
    runFailed: string;
  }>;
}

const DEFAULT_RETRY_DELAYS_MS = [0, 200, 500, 1_000, 2_000] as const;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

export function useAgentCreationSession(options: AgentCreationSessionOptions) {
  const status = ref<AgentCreationStatus>("idle");
  const agent = ref<Agent | null>(null);
  const error = ref("");
  let generation = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function isCurrent(current: number, signal: AbortSignal) {
    return !disposed && generation === current && !signal.aborted;
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function invalidate() {
    generation += 1;
    clearTimer();
    controller?.abort();
    controller = null;
  }

  function begin() {
    invalidate();
    controller = new AbortController();
    return { current: generation, signal: controller.signal };
  }

  function failSave(detail: string) {
    error.value = detail;
    agent.value = null;
    status.value = "idle";
  }

  function wait(delayMs: number, signal: AbortSignal) {
    if (delayMs <= 0) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimer();
        reject(abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        timer = null;
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, delayMs);
    });
  }

  async function verify(existing?: {
    current: number;
    signal: AbortSignal;
  }): Promise<boolean> {
    const operation = existing ?? begin();
    const name = toValue(options.agentName).trim();
    status.value = "verifying";
    error.value = "";

    for (const delayMs of options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS) {
      try {
        await wait(delayMs, operation.signal);
        if (!isCurrent(operation.current, operation.signal)) return false;
        const loaded = await options.loadAgent(name, operation.signal);
        if (!isCurrent(operation.current, operation.signal)) return false;
        agent.value = loaded;
        status.value = "created";
        await options.onCreated?.(loaded);
        return true;
      } catch {
        if (!isCurrent(operation.current, operation.signal)) return false;
      }
    }

    if (isCurrent(operation.current, operation.signal)) {
      status.value = "completed";
      options.onVerificationUnavailable?.();
    }
    return false;
  }

  async function save(): Promise<boolean> {
    if (disposed || status.value !== "idle") {
      return false;
    }
    if (!toValue(options.agentName).trim()) return false;
    const operation = begin();
    status.value = "saving";
    error.value = "";
    agent.value = null;
    try {
      const submitted = await options.submitSave(operation.signal);
      if (!isCurrent(operation.current, operation.signal)) return false;
      if (!submitted) {
        failSave(
          options.copy?.saveNotAccepted ?? "The save request was not accepted.",
        );
        options.onSaveError?.(error.value);
        return false;
      }
      options.onSaveRequested?.();
      return true;
    } catch (cause) {
      if (!isCurrent(operation.current, operation.signal)) return false;
      failSave(
        errorMessage(
          cause,
          options.copy?.requestFailed ?? "Failed to request agent creation.",
        ),
      );
      options.onSaveError?.(error.value);
      return false;
    }
  }

  async function onRunFinished(messages: readonly Message[]) {
    if (status.value !== "saving" || !controller) return;
    if (!hasToolResult([...messages], "setup_agent")) {
      reset();
      return;
    }
    await verify({ current: generation, signal: controller.signal });
  }

  function onRunError(cause: unknown) {
    if (status.value !== "saving" && status.value !== "verifying") return;
    invalidate();
    failSave(
      errorMessage(
        cause,
        options.copy?.runFailed ?? "The agent creation run failed.",
      ),
    );
    options.onSaveError?.(error.value);
  }

  function reset() {
    invalidate();
    status.value = "idle";
    agent.value = null;
    error.value = "";
  }

  watch(
    [() => toValue(options.agentName), () => toValue(options.ownerId)],
    () => reset(),
    { flush: "sync" },
  );

  onScopeDispose(() => {
    disposed = true;
    invalidate();
  });

  return {
    status,
    agent,
    error,
    save,
    reset,
    onRunFinished,
    onRunError,
  };
}
