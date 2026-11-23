/** Bootstrap hint, shared-origin memory and spacing through the real chat consumer. */
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  agentChatCallbacks,
  agentChatStream,
  completedChatMessages,
  mountAgentChatHarness,
} from "../chat/helpers/agent-chat-harness";

const sharedHintKey = "deerflow.agent-create.save-hint-seen";

describe("agent bootstrap save hint", () => {
  it("shows once for bootstrap, records the shared key, and leaves ordinary chat's memory untouched", async () => {
    const ordinary = mountAgentChatHarness();
    await flushPromises();
    expect(ordinary.wrapper.text()).not.toContain(enUS.agents.saveHint);
    expect(localStorage.getItem(sharedHintKey)).toBeNull();
    ordinary.wrapper.unmount();
    const first = mountAgentChatHarness({ bootstrap: true });
    await flushPromises();
    expect(first.wrapper.text()).toContain(enUS.agents.saveHint);
    expect(localStorage.getItem(sharedHintKey)).toBe("1");
    first.wrapper.unmount();
    const second = mountAgentChatHarness({ bootstrap: true });
    await flushPromises();
    expect(second.wrapper.text()).not.toContain(enUS.agents.saveHint);
    expect(localStorage.getItem(sharedHintKey)).toBe("1");
  });

  it("honors a hint already seen in the other frontend", async () => {
    localStorage.setItem(sharedHintKey, "1");
    const subject = mountAgentChatHarness({ bootstrap: true });
    await flushPromises();
    expect(subject.wrapper.text()).not.toContain(enUS.agents.saveHint);
  });

  it("keeps Save in More and dismisses the hint when that menu item delegates to creation.save", async () => {
    agentChatStream.sendMessage.mockImplementation(async () => {
      agentChatCallbacks.onFinish?.({}, completedChatMessages);
      return true;
    });
    const subject = mountAgentChatHarness({
      bootstrap: true,
      agentName: "writer",
    });
    await flushPromises();
    expect(subject.wrapper.text()).toContain(enUS.agents.saveHint);
    expect(agentChatStream.sendMessage).toHaveBeenCalledOnce();
    const more = subject.wrapper.get('[data-testid="agent-more"]');
    const save = subject.wrapper.getComponent(DropdownMenuItem);
    const saveElement = subject.wrapper.get('[data-testid="agent-save"]');
    expect(more.attributes("aria-label")).toBe(enUS.agents.more);
    expect(
      saveElement.element.closest("dropdown-menu-content-stub"),
    ).not.toBeNull();
    expect(saveElement.element.closest("dropdown-menu-stub")).toBe(
      more.element.closest("dropdown-menu-stub"),
    );
    expect(save.props("disabled")).toBe(false);
    save.vm.$emit("select", new Event("select"));
    await flushPromises();
    expect(subject.wrapper.text()).not.toContain(enUS.agents.saveHint);
    expect(agentChatStream.sendMessage).toHaveBeenCalledTimes(2);
    expect(agentChatStream.sendMessage.mock.calls[1]?.[1]).toMatchObject({
      text: enUS.agents.saveCommandMessage,
    });
  });

  it.each([
    { threadId: "new", bootstrap: true, classes: [] },
    { threadId: "new", bootstrap: false, classes: [] },
    {
      threadId: "thread-a",
      bootstrap: true,
      classes: [
        "pt-4",
        "@max-3xl/chat-pane:min-h-auto",
        "@max-3xl/chat-pane:max-h-dvh",
      ],
    },
    {
      threadId: "thread-a",
      bootstrap: false,
      classes: [
        "pt-10",
        "@max-3xl/chat-pane:pt-0",
        "@max-3xl/chat-pane:min-h-auto",
        "@max-3xl/chat-pane:max-h-dvh",
      ],
    },
  ])(
    "keeps message spacing for $threadId bootstrap=$bootstrap",
    async ({ threadId, bootstrap, classes }) => {
      const subject = mountAgentChatHarness({ bootstrap }, { threadId });
      await flushPromises();
      expect(
        new Set(
          subject.wrapper.getComponent({ name: "MessageList" }).classes(),
        ),
      ).toEqual(new Set(classes));
    },
  );
});
