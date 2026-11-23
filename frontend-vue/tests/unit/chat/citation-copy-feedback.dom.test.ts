/*
  【文件职责】     守住引用来源「复制」这颗按钮在复制之后**说得出话**。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     CitationSourcesPanel.vue
  【边界与注意】   本仓此前只换图标（Check ↔ Copy），而图标是 `aria-hidden` 的装饰——
                   读屏器**什么都听不到**，失败时更是一点反馈都没有。上游
                   `citation-sources-panel.tsx:126` 把按钮的可访问名在两句之间切
                   （`copied ? copiedLabel : copyLabel`），并在 :100/:105 各 toast 一句。

                   **可访问名那一半 `make i18n-unused` 看不见**：`citations.copiedReference`
                   现在有消费者了，但「它被用在哪、什么时候用」只有这条用例知道。
                   toast 那一半有 i18n 基线兜着（键一旦没人用就回到 unused 集，
                   `i18n-unused` 立刻红），这里一并断言，两样都不靠对方。

                   对照台账看不见它：引用面板要有 citations 的消息才出现（第①类），
                   而「复制之后」是一个交互态（第⑦类）。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import CitationSourcesPanel from "@/components/chat/CitationSourcesPanel.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { CitationSource } from "@/core/citations/sources";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const clipboard = vi.hoisted(() => ({ writeTextToClipboard: vi.fn() }));
vi.mock("@/core/clipboard", () => clipboard);

const toastStore = createWorkspaceToastStore();

/*
  面板会画 domain 与 citeCount，所以夹具把它们给全；原来那份只有四个键，
  其中 `index` 还不是 `CitationSource` 的字段（它在 occurrences 里）。
*/
const source: CitationSource = {
  id: "source-1",
  title: "Agent trends 2026",
  url: "https://example.com/trends",
  domain: "example.com",
  count: 1,
  occurrences: [{ index: 1, title: "Agent trends 2026" }],
};

function mountPanel(sources = [source]) {
  return mount(CitationSourcesPanel, {
    props: { sources },
    attachTo: document.body,
    global: { provide: { [workspaceToastKey as symbol]: toastStore } },
  });
}

beforeEach(() => {
  toastStore.clear();
  clipboard.writeTextToClipboard.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("citation copy feedback", () => {
  for (const outcome of ["success", "denied", "rejected"] as const) {
    it(`retires a ${outcome} clipboard continuation when the source leaves`, async () => {
      let resolve!: (copied: boolean) => void;
      let reject!: (reason: Error) => void;
      clipboard.writeTextToClipboard.mockImplementationOnce(
        () =>
          new Promise<boolean>((done, fail) => {
            resolve = done;
            reject = fail;
          }),
      );
      const previous = mountPanel();
      await previous.get("button").trigger("click");
      previous.unmount();
      const current = mountPanel([
        { ...source, id: "source-new", title: "New reference" },
      ]);
      // Start observing after mount: Vue's first devtools discovery has its own
      // one-time timer. Only the late clipboard continuation is under this clock.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      if (outcome === "rejected") reject(new Error("Late denial"));
      else resolve(outcome === "success");
      await flushPromises();
      expect(toastStore.toasts.value).toEqual([]);
      expect(current.get("button").attributes("aria-label")).toBe(
        enUS.citations.copyReference("New reference"),
      );
      expect(vi.getTimerCount()).toBe(0);
      current.unmount();
    });
  }

  it("keeps independent feedback for two copied sources", async () => {
    clipboard.writeTextToClipboard.mockResolvedValue(true);
    const other = { ...source, id: "source-2", title: "Another source" };
    const wrapper = mountPanel([source, other]);
    for (const button of wrapper.findAll("button")) {
      await button.trigger("click");
      await flushPromises();
    }
    expect(
      wrapper
        .findAll("button")
        .map((button) => button.attributes("aria-label")),
    ).toEqual([
      enUS.citations.copiedReference(source.title),
      enUS.citations.copiedReference(other.title),
    ]);
    wrapper.unmount();
  });

  it("restarts the feedback deadline when the same source is copied again", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    clipboard.writeTextToClipboard.mockResolvedValue(true);
    const wrapper = mountPanel();
    const button = wrapper.get("button");
    await button.trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1500);
    await button.trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(500);
    expect(button.attributes("aria-label")).toBe(
      enUS.citations.copiedReference(source.title),
    );
    await vi.advanceTimersByTimeAsync(1500);
    expect(button.attributes("aria-label")).toBe(
      enUS.citations.copyReference(source.title),
    );
    wrapper.unmount();
  });

  it("retires its own pending feedback timer when unmounted", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    clipboard.writeTextToClipboard.mockResolvedValue(true);
    const wrapper = mountPanel();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    toastStore.clear();
    expect(vi.getTimerCount()).toBe(1);
    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("renames the button and announces success once the reference is copied", async () => {
    clipboard.writeTextToClipboard.mockResolvedValue(true);
    const wrapper = mountPanel();
    const button = wrapper.get(
      `button[aria-label="${enUS.citations.copyReference(source.title)}"]`,
    );

    await button.trigger("click");
    await flushPromises();

    expect(button.attributes("aria-label")).toBe(
      enUS.citations.copiedReference(source.title),
    );
    expect(toastStore.toasts.value).toEqual([
      {
        id: expect.any(Number),
        kind: "success",
        message: enUS.clipboard.copiedToClipboard,
      },
    ]);
  });

  /*
    失败那一支同样要说话，而且**名字不能变**——名字说「已复制」而剪贴板里什么都没有
    是比没有反馈更糟的一种反馈。
  */
  it("announces a failed copy and leaves the button name alone", async () => {
    clipboard.writeTextToClipboard.mockResolvedValue(false);
    const wrapper = mountPanel();
    const button = wrapper.get(
      `button[aria-label="${enUS.citations.copyReference(source.title)}"]`,
    );

    await button.trigger("click");
    await flushPromises();

    expect(button.attributes("aria-label")).toBe(
      enUS.citations.copyReference(source.title),
    );
    expect(toastStore.toasts.value).toEqual([
      {
        id: expect.any(Number),
        kind: "error",
        message: enUS.clipboard.failedToCopyToClipboard,
      },
    ]);
  });
});
