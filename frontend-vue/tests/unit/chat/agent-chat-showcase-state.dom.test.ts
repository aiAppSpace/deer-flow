/** Public state must reach the actual AgentChat consumers without private fallback. */
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MessageList from "@/components/chat/MessageList.vue";
import ExportTrigger from "@/components/workspace/ExportTrigger.vue";
import GoalStatus from "@/components/workspace/GoalStatus.vue";
import type {
  AgentThread,
  AgentThreadState,
  ArtifactEntry,
  GoalState,
} from "@/core/threads/types";
import {
  agentChatMetadata,
  agentChatStream,
  agentChatThreads,
  mountAgentChatHarness,
} from "./helpers/agent-chat-harness";

function goal(objective: string): GoalState {
  return {
    objective,
    status: "active",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    continuation_count: 0,
    max_continuations: 5,
    no_progress_count: 0,
    max_no_progress_continuations: 3,
  };
}
function fixture(title: string): AgentThreadState {
  const entry: ArtifactEntry = {
    handle: title,
    tool_name: "report",
    tool_call_id: "tool-1",
    call_index: 0,
    artifact_type: "file",
    display_name: title,
    real_ref: `/outputs/${title}.md`,
  };
  return {
    title,
    messages: [{ type: "ai", id: title, content: title }],
    artifacts: [`${title}.md`],
    todos: [{ content: title, status: "completed" }],
    goal: goal(title),
    tool_artifacts: [entry],
    extension_state: { owned: title },
  };
}
function harness() {
  const privateState = fixture("Private workspace");
  agentChatStream.state.value = privateState;
  agentChatStream.messages.value = privateState.messages;
  const privateThread: AgentThread = {
    thread_id: "case-a",
    values: privateState,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    metadata: {},
    status: "idle",
    interrupts: {},
  };
  agentChatThreads.threads = [privateThread];
  agentChatMetadata.value = privateThread;
  const pending: {
    signal: AbortSignal;
    resolve: (response: Response) => void;
    reject: (reason: Error) => void;
  }[] = [];
  const fetch = vi.fn(
    (_url: string, options: RequestInit) =>
      new Promise<Response>((resolve, reject) =>
        pending.push({ signal: options.signal!, resolve, reject }),
      ),
  );
  const unrelatedFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (url: string, options: RequestInit) =>
    url.startsWith("/demo/threads/")
      ? fetch(url, options)
      : unrelatedFetch(url, options),
  );
  const subject = mountAgentChatHarness({ demo: true }, { threadId: "case-a" });
  const list = () => subject.wrapper.getComponent(MessageList);
  const values = () =>
    subject.wrapper.getComponent(ExportTrigger).props("thread").values;
  const finish = async (index: number, state: unknown) => {
    pending[index]!.resolve(new Response(JSON.stringify({ values: state })));
    await flushPromises();
  };
  return { ...subject, fetch, pending, list, values, finish, privateState };
}

describe("AgentChat public snapshot consumers", () => {
  it("passes the public tool registry and goal to their real component boundaries", async () => {
    const subject = harness();
    const state = fixture("Public report");
    await subject.finish(0, state);
    expect(subject.list().props("toolArtifacts")).toEqual(state.tool_artifacts);
    expect(subject.list().props("hasGoal")).toBe(true);
    expect(subject.wrapper.getComponent(GoalStatus).props("goal")).toEqual(
      state.goal,
    );
  });

  it("exports every public state channel from the same snapshot", async () => {
    const subject = harness();
    const state = fixture("Public report");
    await subject.finish(0, state);
    expect(subject.values()).toEqual(state);
  });

  it.each([
    "pending",
    "http-error",
    "network-error",
    "missing-values",
  ] as const)(
    "never exposes workspace title, messages, goal or registry for %s",
    async (failure) => {
      const subject = harness();
      if (failure === "http-error")
        subject.pending[0]!.resolve(new Response("missing", { status: 404 }));
      if (failure === "network-error")
        subject.pending[0]!.reject(new Error("offline"));
      if (failure === "missing-values")
        subject.pending[0]!.resolve(new Response("{}"));
      await flushPromises();
      expect(subject.wrapper.get("header").text()).not.toContain(
        "Private workspace",
      );
      expect(subject.list().props("messages")).toEqual([]);
      expect(subject.list().props("rawMessages")).toEqual([]);
      expect(subject.list().props("toolArtifacts") ?? []).toEqual([]);
      expect(subject.list().props("hasGoal")).toBe(false);
      expect(subject.wrapper.findComponent(GoalStatus).exists()).toBe(false);
      expect(subject.values()).toEqual({ messages: [] });
    },
  );

  it("retires all public channels together on A to B to C, rejects late B and returns to workspace only on exit", async () => {
    const subject = harness();
    await subject.finish(0, fixture("Report A"));
    subject.route.params.thread_id = "case-b";
    await flushPromises();
    expect(subject.values()).toEqual({ messages: [] });
    expect(subject.list().props("toolArtifacts") ?? []).toEqual([]);
    expect(subject.wrapper.findComponent(GoalStatus).exists()).toBe(false);
    expect(subject.wrapper.get("header").text()).not.toMatch(
      /Report A|Private workspace/,
    );
    subject.route.params.thread_id = "case-c";
    expect(subject.pending[1]!.signal.aborted).toBe(true);
    await subject.finish(2, fixture("Report C"));
    await subject.finish(1, fixture("Late Report B"));
    expect(subject.values()).toEqual(fixture("Report C"));
    expect(subject.list().props("toolArtifacts")).toEqual(
      fixture("Report C").tool_artifacts,
    );
    await subject.wrapper.setProps({ demo: false });
    expect(subject.pending[2]!.signal.aborted).toBe(true);
    expect(subject.fetch).toHaveBeenCalledTimes(3);
    expect(subject.values()).toEqual(subject.privateState);
    expect(subject.list().props("toolArtifacts")).toEqual(
      subject.privateState.tool_artifacts,
    );
    expect(subject.wrapper.getComponent(GoalStatus).props("goal")).toEqual(
      subject.privateState.goal,
    );
  });

  it("public admission ignores a local workspace goal even when the route ID is reused", async () => {
    const subject = harness();
    await subject.finish(0, { messages: [], goal: null });
    await subject.wrapper.setProps({ demo: false });
    subject.composer().vm.$emit("goal-change", goal("Unsaved private goal"));
    await flushPromises();
    expect(
      subject.wrapper.getComponent(GoalStatus).props("goal").objective,
    ).toBe("Unsaved private goal");
    await subject.wrapper.setProps({ demo: true });
    expect(subject.wrapper.findComponent(GoalStatus).exists()).toBe(false);
    expect(subject.list().props("hasGoal")).toBe(false);
  });

  it("aborts its mounted request and cannot publish after unmount", async () => {
    const subject = harness();
    subject.wrapper.unmount();
    expect(subject.pending[0]!.signal.aborted).toBe(true);
    await subject.finish(0, fixture("Late result"));
    expect(subject.fetch).toHaveBeenCalledTimes(1);
  });
});
