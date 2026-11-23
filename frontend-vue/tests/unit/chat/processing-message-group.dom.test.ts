import { mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ProcessingMessageGroup from "@/components/chat/ProcessingMessageGroup.vue";
import ReasoningDisclosure from "@/components/chat/ReasoningDisclosure.vue";
import RunActivity from "@/components/chat/RunActivity.vue";
import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

// These tests own message-group and interaction state, not the Markdown renderer.
// Mock its module boundary so the async content pipeline cannot outlive the fixture.
vi.mock("@/components/chat/MessageMarkdown.vue", () => ({
  default: {
    name: "MessageMarkdown",
    props: ["content"],
    template: "<div data-testid='markdown'>{{ content }}</div>",
  },
}));

const toastStore = createWorkspaceToastStore();

const messages = [
  {
    id: "weather-plan",
    type: "ai",
    content: "",
    additional_kwargs: {
      reasoning_content: "I should find a current source before answering.",
    },
    tool_calls: [
      {
        id: "weather-search",
        name: "web_search",
        args: { query: "today's weather" },
      },
    ],
  },
  {
    id: "weather-search-result",
    type: "tool",
    name: "web_search",
    tool_call_id: "weather-search",
    content: JSON.stringify([
      { title: "Shanghai weather", url: "https://weather.example/shanghai" },
    ]),
  },
  {
    id: "weather-synthesis",
    type: "ai",
    content: "",
    additional_kwargs: {
      reasoning_content: "The result is current; now synthesize the answer.",
    },
  },
  {
    id: "weather-answer",
    type: "ai",
    content: "Shanghai is cloudy today, with a high near 29°C.",
  },
] as unknown as Message[];

describe("ProcessingMessageGroup", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("renders one grouped React-equivalent weather flow instead of raw wire rows", async () => {
    const wrapper = mount(ProcessingMessageGroup, {
      props: { messages, streaming: true, threadId: "thread-1" },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        stubs: {},
      },
    });

    expect(
      wrapper.find("[data-testid='processing-message-group']").exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain("1 more step");
    expect(wrapper.text()).toContain(
      'Search on the web for "today\'s weather"',
    );
    expect(wrapper.text()).toContain("Shanghai weather");
    expect(wrapper.text()).toContain("Thinking");
    expect(wrapper.text()).toContain(
      "Shanghai is cloudy today, with a high near 29°C.",
    );
    expect(wrapper.text()).not.toContain(
      "I should find a current source before answering.",
    );
    expect(wrapper.text()).not.toContain(
      "The result is current; now synthesize the answer.",
    );
    expect(wrapper.text()).not.toContain("web_search result");

    await wrapper
      .get("[data-testid='toggle-trailing-reasoning']")
      .trigger("click");
    expect(wrapper.text()).toContain(
      "The result is current; now synthesize the answer.",
    );

    await wrapper.get("[data-testid='toggle-earlier-steps']").trigger("click");
    expect(wrapper.text()).toContain(
      "I should find a current source before answering.",
    );
    expect(wrapper.text()).toContain("Less steps");
    wrapper.unmount();
  });

  it("routes the complete processing group through one projection at the MessageList boundary", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          { id: "weather-human", type: "human", content: "Today's weather" },
          ...messages,
        ] as unknown as Message[],
        rawMessages: messages,
        streaming: true,
        loading: false,
        threadId: "thread-1",
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
        stubs: {
          ReferenceAttachment: true,
          WorkspaceChangesBadge: true,
          MessageTokenUsage: true,
        },
      },
    });

    expect(
      wrapper.findAll("[data-testid='processing-message-group']"),
    ).toHaveLength(1);
    expect(wrapper.findAll("[data-tool-name='web_search']")).toHaveLength(1);
    expect(wrapper.text()).not.toContain("web_search result");
    wrapper.unmount();
  });

  it("keeps a streamed answer with reasoning in its bubble until a tool call actually arrives", async () => {
    const answer: Message = {
      id: "reasoned-answer",
      type: "ai",
      content: "The answer is ready.",
      additional_kwargs: { reasoning_content: "Checked the evidence." },
    };
    const human: Message = {
      id: "question",
      type: "human",
      content: "Explain.",
    };
    const wrapper = mount(MessageList, {
      props: {
        messages: [human, answer],
        streaming: true,
        loading: false,
        threadId: "reasoned-thread",
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
        stubs: {
          ReferenceAttachment: true,
          WorkspaceChangesBadge: true,
          MessageTokenUsage: true,
        },
      },
    });
    try {
      expect(wrapper.findAllComponents(ProcessingMessageGroup)).toHaveLength(0);
      expect(wrapper.findAllComponents(ReasoningDisclosure)).toHaveLength(1);
      expect(wrapper.text()).toContain("The answer is ready.");
      await wrapper.setProps({
        messages: [
          human,
          {
            ...answer,
            tool_calls: [
              { id: "verify", name: "web_search", args: { query: "evidence" } },
            ],
          },
        ],
      });
      expect(wrapper.findAllComponents(ProcessingMessageGroup)).toHaveLength(1);
      expect(wrapper.findAllComponents(ReasoningDisclosure)).toHaveLength(0);
    } finally {
      wrapper.unmount();
    }
  });

  it("auto-closes settled reasoning once and leaves later user toggles alone", async () => {
    vi.useFakeTimers();
    const wrapper = mount(ReasoningDisclosure, {
      props: {
        content: "Private chain of thought",
        streaming: true,
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        stubs: {},
      },
    });

    expect(wrapper.text()).toContain("Private chain of thought");
    await wrapper.setProps({ streaming: false });
    await vi.advanceTimersByTimeAsync(1_001);
    expect(wrapper.text()).not.toContain("Private chain of thought");

    await wrapper.get("button").trigger("click");
    expect(wrapper.text()).toContain("Private chain of thought");
    await vi.advanceTimersByTimeAsync(1_001);
    expect(wrapper.text()).toContain("Private chain of thought");
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("mounts completed historical reasoning collapsed with its compact duration header", () => {
    const wrapper = mount(ReasoningDisclosure, {
      props: {
        content: "Historical reasoning",
        streaming: false,
        durationSeconds: 31,
      },
    });
    expect(wrapper.get("button").attributes("aria-expanded")).toBe("false");
    expect(wrapper.get("button").text()).toBe("Took 31s Reasoning");
    expect(wrapper.text()).not.toContain("Historical reasoning");
    wrapper.unmount();
  });

  it("shows the same live run activity state before an assistant answer exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T00:00:00Z"));
    const wrapper = mount(RunActivity, { props: { startTime: Date.now() } });

    expect(wrapper.get("[data-testid='run-activity']").text()).toContain(
      "Working",
    );
    await vi.advanceTimersByTimeAsync(2_000);
    expect(wrapper.get("[data-testid='run-activity']").text()).toContain("2");
    wrapper.unmount();
    vi.useRealTimers();
  });

  /*
    上游 `messages/run-duration.tsx:36` 把 "Working" 交给 Shimmer primitive；
    本仓此前是 `<span class="animate-pulse">`。差的不只是动画：Shimmer 渲染的是
    `<p>`，可访问性树上多一行 `- paragraph:`，span 不会——这一条只在有活跃 run
    的页面上才看得见，对照台账里没有那样的场景。
  */
  it("hands the working label to the Shimmer primitive, not animate-pulse", () => {
    const wrapper = mount(RunActivity, { props: { startTime: null } });
    const row = wrapper.get("[data-testid='run-activity']");

    const shimmer = row.get("p.shimmer");
    expect(shimmer.text()).toContain("Working");
    expect(row.find(".animate-pulse").exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("tool registry through the actual MessageList", () => {
  beforeEach(() =>
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    })),
  );
  it("renders and updates only the current tool call's text-safe badges", async () => {
    const call: Message = {
      id: "tool-ai",
      type: "ai",
      content: "",
      tool_calls: [{ id: "make-1", name: "make_report", args: {} }],
    };
    const entries = [
      {
        handle: "art_one",
        tool_name: "make_report",
        tool_call_id: "make-1",
        call_index: 0,
        artifact_type: "file",
        display_name: "<report>.csv",
        real_ref: "/outputs/report.csv",
      },
      {
        handle: "art_other",
        tool_name: "make_report",
        tool_call_id: "unrelated",
        call_index: 0,
        artifact_type: "file",
        display_name: "Other",
        real_ref: "/outputs/other.csv",
      },
    ];
    const wrapper = mount(MessageList, {
      props: {
        messages: [call],
        streaming: true,
        loading: false,
        threadId: "registry",
        toolArtifacts: entries,
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
        stubs: {
          ReferenceAttachment: true,
          WorkspaceChangesBadge: true,
          MessageTokenUsage: true,
        },
      },
    });
    try {
      const badge = wrapper.get(".artifact-badges > span");
      expect(badge.text()).toContain("<report>.csv");
      expect(badge.get("code").text()).toBe("art_one");
      expect(badge.attributes("title")).toBe("/outputs/report.csv");
      expect(badge.classes()).toContain("text-xs");
      expect(badge.find("report").exists()).toBe(false);
      expect(wrapper.text()).not.toContain("art_other");
      await wrapper.setProps({
        toolArtifacts: [
          {
            ...entries[0]!,
            display_name: "Updated folder",
            artifact_type: "folder",
          },
        ],
      });
      expect(wrapper.get(".artifact-badges > span").text()).toContain(
        "Updated folder",
      );
      expect(wrapper.get(".artifact-badges svg").classes()).toContain(
        "lucide-files",
      );
    } finally {
      wrapper.unmount();
    }
  });
});
