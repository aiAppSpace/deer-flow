/*
  【文件职责】     守住侧栏里分支会话的标记：树枝、缩进、以及「分叉自谁」这句话。
  【架构位置】     测试
  【依赖关系】     ThreadSidebarItem.vue · core/threads/thread-branch-tree
  【边界与注意】   树枝符号是**纯装饰**：读屏器念「└─」毫无意义，
                   「这是从哪条会话分叉出来的」由链接的可访问名说。两者各有断言。

                   父会话不在当前这一页里时（只有 depth、没有 parentThread），
                   **不能**造一句「分叉自 undefined」——那时退回普通标题。
*/

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ThreadSidebarItem from "@/components/workspace/ThreadSidebarItem.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { ThreadBranchEntry } from "@/core/threads/thread-branch-tree";
import type { AgentThread } from "@/core/threads/types";

function thread(id: string, title: string): AgentThread {
  return {
    thread_id: id,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    metadata: {},
    values: { title },
  } as unknown as AgentThread;
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mountItem(branchEntry?: ThreadBranchEntry) {
  return mount(ThreadSidebarItem, {
    props: {
      thread: thread("t-child", "Child chat"),
      title: "Child chat",
      isActive: false,
      pinned: false,
      deleting: false,
      branchEntry,
    },
    global: {
      stubs: {
        NuxtLink: { template: "<a><slot /></a>", inheritAttrs: true },
        ThreadActionsMenu: true,
      },
    },
  });
}

const stem = (wrapper: ReturnType<typeof mountItem>) =>
  wrapper.find('[data-testid="thread-branch-stem"]');

describe("侧栏的分支标记", () => {
  it("不是分支时没有树枝，也没有分支属性", () => {
    const wrapper = mountItem({
      thread: thread("t-child", "Child chat"),
      depth: 0,
      isLastSibling: true,
    });
    expect(stem(wrapper).exists()).toBe(false);
    expect(wrapper.find("a").attributes("data-branch-depth")).toBeUndefined();
    wrapper.unmount();
  });

  it.each([
    [true, "└─"],
    [false, "├─"],
  ])("最后一个兄弟=%s 时画 %s", (isLastSibling, glyph) => {
    const wrapper = mountItem({
      thread: thread("t-child", "Child chat"),
      parentThread: thread("t-parent", "Parent chat"),
      depth: 1,
      isLastSibling,
    });
    expect(stem(wrapper).text()).toBe(glyph);
    // 树枝是装饰，读屏器不该念它。
    expect(stem(wrapper).attributes("aria-hidden")).toBe("true");
    wrapper.unmount();
  });

  it("可访问名说清楚分叉自哪条会话", () => {
    const wrapper = mountItem({
      thread: thread("t-child", "Child chat"),
      parentThread: thread("t-parent", "Parent chat"),
      depth: 1,
      isLastSibling: true,
    });
    const link = wrapper.find("a");
    expect(link.attributes("aria-label")).toBe(
      enUS.chats.branchLabel("Child chat", "Parent chat"),
    );
    expect(link.attributes("data-branch-depth")).toBe("1");
    expect(link.attributes("data-branch-parent-id")).toBe("t-parent");
    wrapper.unmount();
  });

  it("父会话不在这一页时不造「分叉自 undefined」", () => {
    const wrapper = mountItem({
      thread: thread("t-child", "Child chat"),
      depth: 1,
      isLastSibling: true,
    });
    // 树枝照画（层级是知道的），但说不出分叉自谁就不说。
    expect(stem(wrapper).exists()).toBe(true);
    expect(wrapper.find("a").attributes("aria-label")).toBeUndefined();
    wrapper.unmount();
  });

  it("缩进最多退一档：再深下去侧栏就没有宽度了", () => {
    for (const [depth, expected] of [
      [1, "0px"],
      [2, "8px"],
      [5, "8px"],
    ] as const) {
      const wrapper = mountItem({
        thread: thread("t-child", "Child chat"),
        parentThread: thread("t-parent", "Parent chat"),
        depth,
        isLastSibling: true,
      });
      expect(stem(wrapper).attributes("style"), `depth=${depth}`).toContain(
        `margin-left: ${expected}`,
      );
      wrapper.unmount();
    }
  });
});
