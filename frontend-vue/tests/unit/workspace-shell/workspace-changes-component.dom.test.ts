/* user-visible status/reason/error/retry contract. */
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceChangesBadge from "@/components/workspace/changes/WorkspaceChangesBadge.vue";
import { nuxtI18nMocks, nuxtI18nStub } from "../../support/nuxt-i18n";

const fetchChanges = vi.hoisted(() => vi.fn());
vi.mock("@/core/workspace-changes/api", () => ({
  fetchWorkspaceChanges: fetchChanges,
}));

const summary = {
  available: true,
  version: 1,
  summary: {
    created: 1,
    modified: 1,
    deleted: 1,
    symlink_created: 1,
    additions: 4,
    deletions: 2,
    truncated: true,
  },
  files: [
    {
      path: "/mnt/user-data/workspace/a.txt",
      root: "workspace",
      status: "created",
      binary: false,
      sensitive: false,
      size_before: null,
      size_after: 1,
      sha256_before: null,
      sha256_after: "a",
      diff: "",
      diff_truncated: false,
      diff_unavailable_reason: null,
      additions: 1,
      deletions: 0,
      symlink: false,
      symlink_target_before: null,
      symlink_target_after: null,
    },
    {
      path: "/mnt/user-data/workspace/b.bin",
      root: "workspace",
      status: "modified",
      binary: true,
      sensitive: false,
      size_before: 1,
      size_after: 2,
      sha256_before: "a",
      sha256_after: "b",
      diff: "",
      diff_truncated: false,
      diff_unavailable_reason: "binary",
      additions: 0,
      deletions: 0,
      symlink: false,
      symlink_target_before: null,
      symlink_target_after: null,
    },
    {
      path: "/mnt/user-data/workspace/secret",
      root: "workspace",
      status: "deleted",
      binary: false,
      sensitive: true,
      size_before: 1,
      size_after: null,
      sha256_before: "a",
      sha256_after: null,
      diff: "",
      diff_truncated: false,
      diff_unavailable_reason: "sensitive",
      additions: 0,
      deletions: 1,
      symlink: false,
      symlink_target_before: null,
      symlink_target_after: null,
    },
    {
      path: "/mnt/user-data/workspace/link",
      root: "workspace",
      status: "symlink_created",
      binary: false,
      sensitive: false,
      size_before: null,
      size_after: null,
      sha256_before: null,
      sha256_after: null,
      diff: "",
      diff_truncated: false,
      diff_unavailable_reason: "symlink",
      additions: 0,
      deletions: 0,
      symlink: true,
      symlink_target_before: null,
      symlink_target_after: "a.txt",
    },
  ],
  limits: {},
} as const;

function mountBadge() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return mount(WorkspaceChangesBadge, {
    props: { threadId: "t-1", runId: "r-1" },
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      mocks: nuxtI18nMocks(),
    },
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  fetchChanges.mockReset().mockResolvedValue(summary);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: nuxtI18nStub() }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("WorkspaceChangesBadge", () => {
  /*
    S7 的「完整显示 status」落在**展开后的面板**上，不是折叠态那张卡片。

    上游 `workspace-change-badge.tsx` 的 summary 行只有「路径 + 增删数」，
    `Created` / `Modified` 这些字只在面板里出现；本仓原来两处都写，于是同一行
    在两个应用里读出来不是同一句（对照台账上的
    `+8-2 outputs/report.md Modified +1-1`）。这条用例因此拆成两半断言：
    折叠态该有什么、展开后该有什么。**强度没降**——四个状态词一个都没少，
    而且多钉住了「折叠态不该有它们」这半边。

    `truncated` 提示留在折叠态：上游没有这一条，是本仓按 S7 有意多做的。
  */
  it("keeps status words in the panel and the truncation notice on the card", async () => {
    const wrapper = mountBadge();
    await flushPromises();
    expect(wrapper.text()).toContain("Some changes were truncated");
    // 折叠态是「路径 + 增删数」，没有状态词。
    expect(wrapper.text()).not.toContain("Modified");
    expect(wrapper.text()).not.toContain("Symlink created");

    await wrapper
      .get("button[data-testid='workspace-changes-open']")
      .trigger("click");
    await flushPromises();
    expect(document.body.textContent).toContain("Created");
    expect(document.body.textContent).toContain("Modified");
    expect(document.body.textContent).toContain("Deleted");
    expect(document.body.textContent).toContain("Symlink created");
    wrapper.unmount();
  });

  it("shows exact unavailable reasons and retries a failed detail request", async () => {
    fetchChanges
      .mockResolvedValueOnce(summary)
      .mockRejectedValueOnce(new Error("snapshot expired"))
      .mockResolvedValueOnce(summary);
    const wrapper = mountBadge();
    await flushPromises();
    await wrapper
      .get("button[data-testid='workspace-changes-open']")
      .trigger("click");
    await flushPromises();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "snapshot expired",
    );
    const retry = document.querySelector<HTMLButtonElement>(
      '[data-testid="workspace-changes-retry"]',
    )!;
    retry.click();
    await flushPromises();

    /*
      **理由躺在折叠内容里，要先展开。** 上游那一行是
      `<Collapsible defaultOpen={hasDiff}>`——没有 diff 的文件默认是**折叠**的，
      而 Radix / reka 的 CollapsibleContent 折叠时不渲染子节点，所以「为什么没有
      diff」这句话在展开之前根本不在 DOM 里。本仓原来把它画在摘要行上（一直可见），
      wave 87 把这一屏接进对照取样面之后按上游改掉了；这条用例跟着改成
      「点开每一行再断言」，断言的内容一个字没动。
    */
    const triggers = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[data-slot="collapsible-trigger"]',
      ),
    ];
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) trigger.click();
    await flushPromises();

    expect(document.body.textContent).toContain(
      "Binary file. Diff unavailable.",
    );
    expect(document.body.textContent).toContain(
      "Sensitive path. Content hidden.",
    );
    expect(document.body.textContent).toContain(
      "Symlink change. Diff unavailable.",
    );
    expect(fetchChanges).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });
});
