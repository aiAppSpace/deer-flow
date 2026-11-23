/** Parent contracts exercised through AgentChat's actual owners and child props/slots. */
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import {
  agentChatStream,
  agentChatTransport,
  mountAgentChatHarness,
} from "./helpers/agent-chat-harness";

describe("AgentChat settings identity", () => {
  it("restores the actual thread's shared model override across ordinary and Agent views", async () => {
    localStorage.setItem("deerflow.thread-model.thread-a", "existing-model");
    localStorage.setItem("deerflow.thread-model.thread-b", "second-model");
    const subject = mountAgentChatHarness();
    await flushPromises();
    expect(subject.composer().props("context")).toMatchObject({
      model_name: "existing-model",
    });
    await subject.wrapper.setProps({ agentName: "writer" });
    expect(subject.composer().props("context")).toMatchObject({
      model_name: "existing-model",
      agent_name: "writer",
    });
    subject
      .composer()
      .vm.$emit("context-change", { model_name: "updated-model" });
    await flushPromises();
    expect(localStorage.getItem("deerflow.thread-model.thread-a")).toBe(
      "updated-model",
    );
    subject.route.params.thread_id = "thread-b";
    await flushPromises();
    expect(subject.composer().props("context")).toMatchObject({
      model_name: "second-model",
    });
    subject.route.params.thread_id = "thread-a";
    await flushPromises();
    expect(subject.composer().props("context")).toMatchObject({
      model_name: "updated-model",
    });
  });

  it("uses the pre-created UUID for the model override and keeps it when that same route is adopted", async () => {
    const subject = mountAgentChatHarness(
      { agentName: "writer" },
      { threadId: "new" },
    );
    await flushPromises();
    const preparedId = subject.composer().props("targetThreadId");
    if (typeof preparedId !== "string")
      throw new Error("Composer did not receive the prepared conversation ID");
    expect(preparedId).toMatch(/^[\da-f-]{36}$/);
    subject
      .composer()
      .vm.$emit("context-change", { model_name: "draft-model" });
    await flushPromises();
    expect(localStorage.getItem(`deerflow.thread-model.${preparedId}`)).toBe(
      "draft-model",
    );
    expect(localStorage.getItem("deerflow.thread-model.new")).toBeNull();
    const ensureThread = subject.composer().props("ensureThread");
    if (typeof ensureThread !== "function")
      throw new Error("Composer did not receive the thread creation operation");
    expect(await ensureThread()).toBe(preparedId);
    expect(agentChatTransport.createThread).toHaveBeenCalledExactlyOnceWith({
      threadId: preparedId,
      metadata: { agent_name: "writer" },
    });
    subject.route.params.thread_id = preparedId;
    await flushPromises();
    expect(subject.composer().props("targetThreadId")).toBe(preparedId);
    expect(subject.composer().props("context")).toMatchObject({
      model_name: "draft-model",
    });
    expect(localStorage.getItem(`deerflow.thread-model.${preparedId}`)).toBe(
      "draft-model",
    );
  });
});

describe("AgentChat welcome region", () => {
  it.each([null, "writer"])(
    "yields the actual welcome slot to goal and todos for %s",
    async (agentName) => {
      const subject = mountAgentChatHarness({ agentName }, { threadId: "new" });
      await flushPromises();
      const welcome = () =>
        subject.wrapper.find('[data-testid="composer-extra-header"]');
      expect(welcome().exists()).toBe(true);
      expect(subject.composer().props("isWelcome")).toBe(true);
      subject.composer().vm.$emit("goal-change", {
        description: "Finish the task",
        status: "active",
      });
      await flushPromises();
      expect(welcome().exists()).toBe(false);
      expect(
        subject.wrapper.findComponent({ name: "GoalStatus" }).exists(),
      ).toBe(true);
      subject.composer().vm.$emit("goal-change", null);
      await flushPromises();
      expect(welcome().exists()).toBe(true);
      agentChatStream.state.value = {
        todos: [{ content: "Task", status: "pending" }],
      };
      await flushPromises();
      expect(welcome().exists()).toBe(false);
      expect(subject.wrapper.findComponent({ name: "TodoList" }).exists()).toBe(
        true,
      );
      agentChatStream.state.value = { todos: [] };
      await flushPromises();
      expect(welcome().exists()).toBe(true);
      subject.route.params.thread_id = "thread-existing";
      await flushPromises();
      expect(welcome().exists()).toBe(false);
    },
  );
});

describe("AgentChat mount-time focus request", () => {
  it.each(["new", "thread-existing"])(
    "retains the initial %s focus decision when route/welcome changes",
    async (threadId) => {
      const subject = mountAgentChatHarness({}, { threadId });
      await flushPromises();
      expect(subject.composer().props("autoFocus")).toBe(threadId === "new");
      subject.route.params.thread_id =
        threadId === "new" ? "thread-adopted" : "new";
      agentChatStream.messages.value = [];
      await flushPromises();
      expect(subject.composer().props("isWelcome")).toBe(threadId !== "new");
      expect(subject.composer().props("autoFocus")).toBe(threadId === "new");
    },
  );
});

describe("AgentChat branch admission", () => {
  it("allows ordinary conversation branching and removes it for an Agent conversation", async () => {
    const subject = mountAgentChatHarness();
    await flushPromises();
    const list = () => subject.wrapper.getComponent({ name: "MessageList" });
    expect(list().props("canBranch")).toBe(true);
    await subject.wrapper.setProps({ agentName: "writer" });
    expect(list().props("canBranch")).toBe(false);
    await subject.wrapper.setProps({ agentName: null });
    expect(list().props("canBranch")).toBe(true);
  });
});

it("passes current-run identities to the main message list and retires them reactively", async () => {
  const subject = mountAgentChatHarness();
  await flushPromises();
  const list = () => subject.wrapper.getComponent({ name: "MessageList" });
  agentChatStream.streamingMessageIds.value = new Set(["main-live"]);
  await flushPromises();
  expect([...list().props("streamingMessageIds")]).toEqual(["main-live"]);
  agentChatStream.streamingMessageIds.value = new Set();
  await flushPromises();
  expect(list().props("streamingMessageIds").size).toBe(0);
});
