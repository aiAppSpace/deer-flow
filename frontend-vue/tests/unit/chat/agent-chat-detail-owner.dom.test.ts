import { flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { ref as vueRef } from "vue";
import GoalStatus from "@/components/workspace/GoalStatus.vue";
import TodoList from "@/components/workspace/TodoList.vue";
import type { AgentThread, GoalState } from "@/core/threads/types";
import {
  agentChatMetadata,
  agentChatStream,
  agentChatThreads,
  mountAgentChatHarness,
} from "./helpers/agent-chat-harness";

vi.mock("@/composables/useSidecarSession", () => ({
  useSidecarSession: () => ({
    ready: vueRef(true),
    restore: vi.fn(async () => null),
  }),
}));

function detail(label = "Saved") {
  const goal: GoalState = {
    objective: label,
    status: "active",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    continuation_count: 0,
    max_continuations: 5,
    no_progress_count: 0,
    max_no_progress_continuations: 3,
  };
  return {
    thread_id: "thread-a",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    metadata: { deerflow_archived: true },
    status: "idle",
    interrupts: {},
    values: {
      title: label,
      messages: [],
      goal,
      todos: [{ content: label, status: "pending" }],
      artifacts: ["/mnt/user-data/outputs/saved.md"],
    },
  } as AgentThread;
}

it("renders the current chat's saved goal and todos without admitting it to the active sidebar", async () => {
  const saved = detail();
  agentChatMetadata.value = saved;
  const subject = mountAgentChatHarness();
  await flushPromises();
  expect(agentChatThreads.threads).toEqual([]);
  expect(subject.wrapper.getComponent(GoalStatus).props("goal")).toEqual(
    saved.values.goal,
  );
  expect(subject.wrapper.getComponent(TodoList).props("todos")).toEqual(
    saved.values.todos,
  );
  agentChatMetadata.value = detail("Refreshed");
  await flushPromises();
  expect(subject.wrapper.getComponent(GoalStatus).props("goal").objective).toBe(
    "Refreshed",
  );
  expect(
    subject.wrapper.getComponent(TodoList).props("todos")[0]?.content,
  ).toBe("Refreshed");
});

it("feeds saved artifacts into the actual panel coordinator when the sidebar has no rows", async () => {
  agentChatMetadata.value = detail();
  const subject = mountAgentChatHarness({}, { realPanels: true });
  await flushPromises();
  expect(agentChatThreads.threads).toEqual([]);
  expect(subject.panels!.artifactPanel.artifacts.value).toEqual(
    detail().values.artifacts,
  );
});

it("keeps explicit live empty values authoritative over the saved detail snapshot", async () => {
  agentChatMetadata.value = detail();
  agentChatStream.state.value = { goal: null, todos: [], artifacts: [] };
  const subject = mountAgentChatHarness({}, { realPanels: true });
  await flushPromises();
  expect(subject.wrapper.findComponent(GoalStatus).exists()).toBe(false);
  expect(subject.wrapper.findComponent(TodoList).exists()).toBe(false);
  expect(subject.panels!.artifactPanel.artifacts.value).toEqual([]);
});
