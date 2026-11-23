import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessageList from "@/components/chat/MessageList.vue";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const richMapLoaded = vi.hoisted(() => vi.fn());
vi.mock("@/components/markdown/components", () => {
  richMapLoaded();
  return { richContentComponents: {} };
});
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

describe("message list Markdown loading boundary", () => {
  it("renders an empty and a human-only conversation without loading the rich element map", async () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [],
        streaming: false,
        loading: false,
        threadId: "thread-1",
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
        provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
      },
    });
    wrappers.push(wrapper);
    expect(wrapper.find('[data-role="human"]').exists()).toBe(false);
    expect(richMapLoaded).not.toHaveBeenCalled();
    await wrapper.setProps({
      messages: [
        { id: "human-1", type: "human", content: "Verbatim question" },
      ],
    });
    expect(wrapper.text()).toContain("Verbatim question");
    expect(richMapLoaded).not.toHaveBeenCalled();
  });
});
