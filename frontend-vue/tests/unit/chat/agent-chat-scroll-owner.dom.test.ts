import { flushPromises } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import {
  agentChatAccount,
  mountAgentChatHarness,
} from "./helpers/agent-chat-harness";

// The actual AgentChat and submission owner supply the public MessageList props.
// Motion is mounted separately; this probe does not claim to render scroll physics.
describe("AgentChat scroll identity", () => {
  it.each([undefined, "writer"])(
    "retains the exact prepared owner across URL adoption (%s)",
    async (agentName) => {
      const state = mountAgentChatHarness({ agentName }, { threadId: "new" });
      const list = () => state.wrapper.findComponent({ name: "MessageList" });
      const owner = list().props("scrollOwnerKey");
      expect(typeof owner).toBe("string");
      const id = await (
        state.composer().props("ensureThread") as () => Promise<string>
      )();
      expect(owner).toBe(id);
      state.route.params.thread_id = id;
      state.route.path = `/workspace/chats/${id}`;
      await flushPromises();
      expect(list().props("scrollOwnerKey")).toBe(owner);
      state.route.params.thread_id = "other-thread";
      await flushPromises();
      expect(list().props("scrollOwnerKey")).not.toBe(owner);
    },
  );
  it("retires same-thread scrolling across account and agent changes", async () => {
    const state = mountAgentChatHarness({}, { threadId: "thread-a" });
    const list = () => state.wrapper.findComponent({ name: "MessageList" });
    const first = list().props("scrollOwnerKey");
    agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
    await flushPromises();
    const account = list().props("scrollOwnerKey");
    expect(account).not.toBe(first);
    await state.wrapper.setProps({ agentName: "writer" });
    expect(list().props("scrollOwnerKey")).not.toBe(account);
  });
});
