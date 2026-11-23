/** Header state and presentation through the actual mounted AgentChat consumer. */
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import FlipDisplay from "@/components/ui/effects/FlipDisplay.vue";
import type { AgentThread } from "@/core/threads/types";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  mountAgentChatHarness,
  agentChatTransport,
  agentChatStream,
  agentChatThreads,
  agentChatMetadata,
} from "./helpers/agent-chat-harness";

function thread(id: string, title?: string) {
  return {
    thread_id: id,
    created_at: "2026-10-11T00:00:00Z",
    updated_at: "2026-10-11T00:00:00Z",
    metadata: {},
    status: "idle",
    values: { ...(title ? { title } : {}), messages: [] },
    interrupts: {},
  } as AgentThread;
}
function headTitle() {
  const head = vi.mocked(useHead).mock.calls.at(-1)?.[0];
  expect(head).toBeTypeOf("function");
  return (head as () => { title: string })().title;
}

describe("mounted chat header", () => {
  it("keeps the header stacking/layout tokens and replaces welcome background/blur without conflicts", async () => {
    const { wrapper, route } = mountAgentChatHarness({}, { threadId: "new" });
    await flushPromises();
    const header = wrapper.get("header");
    for (const token of [
      "z-30",
      "flex",
      "h-12",
      "shrink-0",
      "items-center",
      "gap-2",
    ])
      expect(header.classes()).toContain(token);
    expect(header.classes()).not.toContain("z-40");
    expect(header.classes()).toContain("bg-background/0");
    expect(header.classes()).toContain("backdrop-blur-none");
    expect(header.classes()).not.toContain("bg-background/80");
    expect(header.classes()).not.toContain("backdrop-blur");
    route.params.thread_id = "thread-a";
    await flushPromises();
    expect(header.classes()).toContain("bg-background/80");
    expect(header.classes()).toContain("backdrop-blur");
    expect(header.classes()).not.toContain("bg-background/0");
    expect(header.classes()).not.toContain("backdrop-blur-none");
  });

  it.each([undefined, "analyst"])(
    "keeps the actual right-control spacing for Agent %s",
    async (agentName) => {
      const { wrapper } = mountAgentChatHarness({ agentName });
      await flushPromises();
      const controls = wrapper.get("context-usage-badge-stub").element
        .parentElement!;
      for (const token of ["flex", "shrink-0", "items-center"])
        expect(controls.classList.contains(token)).toBe(true);
      expect(controls.classList.contains("gap-2")).toBe(!agentName);
      expect(controls.classList.contains("sm:mr-4")).toBe(Boolean(agentName));
    },
  );

  it("shows only a real title inside the shrinkable title container and updates its public key on thread change", async () => {
    const { wrapper, route } = mountAgentChatHarness();
    await flushPromises();
    expect(wrapper.findComponent(FlipDisplay).exists()).toBe(false);
    agentChatMetadata.value = thread("thread-a", "Quarterly research");
    await flushPromises();
    const title = wrapper.getComponent(FlipDisplay);
    expect(title.text()).toBe("Quarterly research");
    expect(title.props("uniqueKey")).toBe("thread-a");
    for (const token of [
      "flex",
      "min-w-0",
      "flex-1",
      "items-center",
      "text-sm",
      "font-medium",
    ])
      expect(title.element.parentElement!.classList.contains(token)).toBe(true);
    agentChatMetadata.value = thread("thread-b", "Project review");
    route.params.thread_id = "thread-b";
    await flushPromises();
    expect(wrapper.getComponent(FlipDisplay).text()).toBe("Project review");
    expect(wrapper.getComponent(FlipDisplay).props("uniqueKey")).toBe(
      "thread-b",
    );
    route.params.thread_id = "new";
    agentChatStream.messages.value = [];
    await flushPromises();
    expect(wrapper.findComponent(FlipDisplay).exists()).toBe(false);
  });

  it("registers the real reactive document title for named/new/loading/untitled conversations", async () => {
    const { route } = mountAgentChatHarness();
    await flushPromises();
    expect(headTitle()).toBe(`${enUS.pages.untitled} - ${enUS.pages.appName}`);
    agentChatStream.isHistoryLoading.value = true;
    expect(headTitle()).toBe(`Loading... - ${enUS.pages.appName}`);
    agentChatMetadata.value = thread("thread-a", "Named thread");
    expect(headTitle()).toBe(`Named thread - ${enUS.pages.appName}`);
    route.params.thread_id = "new";
    expect(headTitle()).toBe(`${enUS.pages.newChat} - ${enUS.pages.appName}`);
  });
});

describe("mounted read-only showcase header", () => {
  it.each([false, true])(
    "preserves export and usage for demo=%s while retiring write/navigation entries",
    async (demo) => {
      const { wrapper, queryClient } = mountAgentChatHarness({ demo });
      await flushPromises();
      expect(agentChatTransport.models).toHaveBeenCalledOnce();
      expect(wrapper.find("export-trigger-stub").exists()).toBe(true);
      expect(
        wrapper.getComponent({ name: "ExportTrigger" }).props("thread")
          .thread_id,
      ).toBe("thread-a");
      expect(wrapper.find("context-usage-badge-stub").exists()).toBe(true);
      expect(wrapper.find("token-usage-indicator-stub").exists()).toBe(false);
      for (const consumer of [
        "sidebar-trigger-stub",
        "thread-scheduled-tasks-button-stub",
        "thread-background-tasks-stub",
        "thread-subagent-batches-stub",
      ])
        expect(wrapper.find(consumer).exists(), consumer).toBe(!demo);
      queryClient.setQueryData(["models"], {
        models: [],
        token_usage: { enabled: true },
      });
      await flushPromises();
      expect(wrapper.find("token-usage-indicator-stub").exists()).toBe(true);
      expect(wrapper.find("context-usage-badge-stub").exists()).toBe(false);
    },
  );

  it("keeps schedule shortcuts confined to ordinary chats and retires export before materialization", async () => {
    const { wrapper, route } = mountAgentChatHarness({ agentName: "analyst" });
    await flushPromises();
    expect(wrapper.find("thread-scheduled-tasks-button-stub").exists()).toBe(
      false,
    );
    expect(wrapper.find("export-trigger-stub").exists()).toBe(true);
    route.params.thread_id = "new";
    agentChatStream.messages.value = [];
    await flushPromises();
    expect(wrapper.find("thread-scheduled-tasks-button-stub").exists()).toBe(
      false,
    );
    expect(wrapper.find("export-trigger-stub").exists()).toBe(false);
    expect(wrapper.find("sidebar-trigger-stub").exists()).toBe(true);
  });
});

describe("active-thread header data and action ownership", () => {
  it.each([undefined, "analyst"])(
    "uses canonical metadata outside the active sidebar and keeps actions in their correct group for %s",
    async (agentName) => {
      agentChatMetadata.value = {
        ...thread("thread-a", "Canonical title"),
        metadata: { deerflow_archived: true },
      };
      agentChatStream.state.value = { title: "Stream title" };
      const { wrapper } = mountAgentChatHarness({ agentName });
      await flushPromises();
      expect(agentChatThreads.threads).toEqual([]);
      const title = wrapper.getComponent(FlipDisplay);
      expect(title.text()).toBe("Canonical title");
      const archive = wrapper.getComponent({ name: "ThreadArchiveStatus" });
      expect(archive.props("metadata")).toEqual({ deerflow_archived: true });
      expect(archive.element.parentElement).toBe(title.element.parentElement);
      expect(title.element.parentElement!.classList.contains("gap-2")).toBe(
        !agentName,
      );
      const controls = wrapper.get("context-usage-badge-stub").element
        .parentElement!;
      const extension = wrapper.get(
        "conversation-extension-actions-stub",
      ).element;
      const exportButton = wrapper.get("export-trigger-stub").element;
      expect(controls.contains(extension)).toBe(true);
      expect(
        exportButton.compareDocumentPosition(extension) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      if (agentName) {
        const action = wrapper.get(
          `button[aria-label="${enUS.agents.newChat}"]`,
        ).element;
        expect(controls.contains(action)).toBe(true);
        expect(
          wrapper
            .get("thread-subagent-batches-stub")
            .element.compareDocumentPosition(action) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(wrapper.find("thread-scheduled-tasks-button-stub").exists()).toBe(
        !agentName,
      );
    },
  );

  it("prefers the canonical nonempty title, falls back to the live stream, and ignores stale sidebar rows", async () => {
    agentChatThreads.threads.push(thread("thread-a", "Stale list title"));
    agentChatStream.state.value = { title: "Live title" };
    const { wrapper } = mountAgentChatHarness();
    await flushPromises();
    expect(wrapper.getComponent(FlipDisplay).text()).toBe("Live title");
    agentChatMetadata.value = thread("thread-a", "Renamed canonical title");
    await flushPromises();
    expect(wrapper.getComponent(FlipDisplay).text()).toBe(
      "Renamed canonical title",
    );
    agentChatMetadata.value = thread("thread-a", "");
    await flushPromises();
    expect(wrapper.getComponent(FlipDisplay).text()).toBe("Live title");
  });

  it("exports the active stream without inventing a creation timestamp or borrowing a sidebar title", async () => {
    agentChatThreads.threads.push(thread("thread-a", "Stale list title"));
    agentChatStream.state.value = { title: "Live export title" };
    agentChatMetadata.value = thread("thread-a", "Canonical displayed title");
    const { wrapper } = mountAgentChatHarness();
    await flushPromises();
    const exported = wrapper
      .getComponent({ name: "ExportTrigger" })
      .props("thread") as AgentThread;
    expect(exported.values.title).toBe("Live export title");
    expect(exported.values.messages).toEqual(agentChatStream.messages.value);
    expect(exported.created_at).toBeUndefined();
    expect(wrapper.getComponent(FlipDisplay).text()).toBe(
      "Canonical displayed title",
    );
  });
});
