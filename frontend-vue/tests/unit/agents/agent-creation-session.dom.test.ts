/*
  【文件职责】     固定Agent 创建状态机、有限验证、去重与 effect-scope cleanup。
  【架构位置】     Vue composable DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     useAgentCreationSession · GatewayResponseError · Vue effectScope
  【边界与注意】   run 与 getAgent 的晚到结果不得跨 agent/scope 回写；验证耗尽重试不得新建第二个 run。
*/

import { effectScope, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAgentCreationSession } from "@/composables/useAgentCreationSession";
import { GatewayResponseError } from "@/core/api/errors";
import type { Agent } from "@/core/agents/types";
import type { Message } from "@/core/types/message";

const createdAgent: Agent = {
  name: "reviewer",
  description: "Reviews code",
  model: "reasoning-model",
  tool_groups: ["browser"],
  skills: ["review"],
};

const successMessages = [
  {
    type: "ai",
    content: "",
    tool_calls: [{ id: "setup-call", name: "setup_agent", args: {} }],
  },
  {
    type: "tool",
    content: "Agent created",
    tool_call_id: "setup-call",
    status: "success",
  },
] as Message[];

function notFound(detail = "Agent not visible yet") {
  return new GatewayResponseError(
    detail,
    404,
    { detail },
    JSON.stringify({ detail }),
  );
}

function createHarness(
  overrides: {
    submitSave?: (signal: AbortSignal) => Promise<boolean>;
    loadAgent?: (name: string, signal: AbortSignal) => Promise<Agent>;
  } = {},
) {
  const agentName = ref("reviewer");
  const submitSave = vi.fn(overrides.submitSave ?? (async () => true));
  const loadAgent = vi.fn(overrides.loadAgent ?? (async () => createdAgent));
  const onCreated = vi.fn();
  const scope = effectScope();
  const session = scope.run(() =>
    useAgentCreationSession({
      agentName,
      submitSave,
      loadAgent,
      retryDelaysMs: [0, 10, 20],
      onCreated,
    }),
  )!;
  return { agentName, loadAgent, onCreated, scope, session, submitSave };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useAgentCreationSession", () => {
  it("moves saving -> verifying -> created when the Agent is immediately visible", async () => {
    const { session, submitSave, loadAgent, onCreated } = createHarness();

    expect(await session.save()).toBe(true);
    expect(session.status.value).toBe("saving");
    await session.onRunFinished(successMessages);

    expect(submitSave).toHaveBeenCalledTimes(1);
    expect(loadAgent).toHaveBeenCalledTimes(1);
    expect(session.status.value).toBe("created");
    expect(session.agent.value).toEqual(createdAgent);
    expect(onCreated).toHaveBeenCalledWith(createdAgent);
    expect(await session.save()).toBe(false);
  });

  it("uses bounded delayed visibility retries", async () => {
    vi.useFakeTimers();
    const loadAgent = vi
      .fn<(name: string, signal: AbortSignal) => Promise<Agent>>()
      .mockRejectedValueOnce(notFound())
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(createdAgent);
    const { session } = createHarness({ loadAgent });

    await session.save();
    const finished = session.onRunFinished(successMessages);
    expect(session.status.value).toBe("verifying");
    await vi.runAllTimersAsync();
    await finished;

    expect(loadAgent).toHaveBeenCalledTimes(3);
    expect(session.status.value).toBe("created");
  });

  it("ends in retryable error after finite 404 exhaustion without submitting a second run", async () => {
    vi.useFakeTimers();
    const { session, loadAgent, submitSave } = createHarness({
      loadAgent: async () => {
        throw notFound("Persistence is still unavailable");
      },
    });

    await session.save();
    const finished = session.onRunFinished(successMessages);
    await vi.runAllTimersAsync();
    await finished;

    expect(loadAgent).toHaveBeenCalledTimes(3);
    expect(session.status.value).toBe("error");
    expect(session.error.value).toContain("Persistence is still unavailable");

    const retry = session.retry();
    await vi.runAllTimersAsync();
    await retry;
    expect(submitSave).toHaveBeenCalledTimes(1);
    expect(loadAgent).toHaveBeenCalledTimes(6);
  });

  it("surfaces setup_agent and run errors, then permits one explicit save retry", async () => {
    const { session, submitSave } = createHarness();
    await session.save();
    await session.onRunFinished([
      successMessages[0]!,
      {
        type: "tool",
        content: "Storage permission denied",
        tool_call_id: "setup-call",
        status: "error",
      },
    ] as Message[]);
    expect(session.status.value).toBe("error");
    expect(session.error.value).toBe("Storage permission denied");

    await session.retry();
    expect(submitSave).toHaveBeenCalledTimes(2);
    session.onRunError(new Error("Gateway run failed"));
    expect(session.status.value).toBe("error");
    expect(session.error.value).toBe("Gateway run failed");
  });

  it("deduplicates double save and aborts run/verification on scope dispose", async () => {
    /*
      收进数组，不是 `let ... = null`：赋值发生在回调里，TS 的控制流看不进闭包，
      于是外面那句 `runSignal?.aborted` 会被当成对 `null` 取属性。
    */
    const runSignals: AbortSignal[] = [];
    let resolveSubmit!: (value: boolean) => void;
    const submit = new Promise<boolean>((resolve) => {
      resolveSubmit = resolve;
    });
    const { scope, session, submitSave } = createHarness({
      submitSave: async (signal) => {
        runSignals.push(signal);
        return submit;
      },
    });

    const first = session.save();
    expect(await session.save()).toBe(false);
    expect(submitSave).toHaveBeenCalledTimes(1);
    scope.stop();
    expect(runSignals.at(-1)?.aborted).toBe(true);
    resolveSubmit(true);
    expect(await first).toBe(false);
    expect(session.status.value).not.toBe("created");
  });

  it("rejects a stale getAgent result after the agent scope changes", async () => {
    let resolveAgent!: (agent: Agent) => void;
    const pending = new Promise<Agent>((resolve) => {
      resolveAgent = resolve;
    });
    const { agentName, session } = createHarness({
      loadAgent: async () => pending,
    });

    await session.save();
    const finished = session.onRunFinished(successMessages);
    agentName.value = "another-agent";
    resolveAgent(createdAgent);
    await finished;

    expect(session.status.value).toBe("idle");
    expect(session.agent.value).toBeNull();
  });
});
