import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProcessingToolStep from "@/components/chat/ProcessingToolStep.vue";
import CodeBlock from "@/components/ui/code-block/CodeBlock.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { deriveProcessingMessageView } from "@/core/messages/processing";

const shiki = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("shiki", () => ({
  codeToHtml: shiki.render,
  codeToTokens: vi.fn().mockResolvedValue({ tokens: [] }),
}));
beforeEach(() => {
  shiki.render.mockReset().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("bash processing code block", () => {
  it("uses the tool code display without Markdown language toolbar or line numbers", async () => {
    const command = "printf '%s\\n' 'StartupEntrepreneurshipExpertMarket'";
    const step = deriveProcessingMessageView([
      {
        type: "ai",
        content: "",
        tool_calls: [{ id: "bash-1", name: "bash", args: { command } }],
      },
    ]).lastToolCall!;
    const wrapper = mount(ProcessingToolStep, { props: { step } });
    try {
      expect(wrapper.find("[data-streamdown]").exists()).toBe(false);
      expect(wrapper.get("pre").classes()).toContain("whitespace-pre-wrap");
      expect(wrapper.get("pre code").text()).toBe(command);
      expect(wrapper.find("button").exists()).toBe(false);
      await flushPromises();
      expect(shiki.render).toHaveBeenCalledWith(
        command,
        expect.objectContaining({
          lang: "bash",
          themes: { light: "one-light", dark: "one-dark-pro" },
          defaultColor: "light",
          transformers: [],
        }),
      );
    } finally {
      wrapper.unmount();
    }
  });
  it("discards late highlighting after code or language changes, including A to B to A", async () => {
    const completions: ((html: string) => void)[] = [];
    shiki.render.mockImplementation(
      () => new Promise<string>((resolve) => completions.push(resolve)),
    );
    const wrapper = mount(CodeBlock, {
      props: { code: "owner-A", language: "bash" },
    });
    try {
      await flushPromises();
      await wrapper.setProps({ code: "owner-B" });
      await flushPromises();
      await wrapper.setProps({ code: "owner-A", language: "javascript" });
      await flushPromises();
      completions[0]!("<pre><code>stale bash A</code></pre>");
      completions[1]!("<pre><code>stale B</code></pre>");
      await flushPromises();
      expect(wrapper.get("pre code").text()).toBe("owner-A");
      completions[2]!("<pre class='shiki'><code>current text A</code></pre>");
      await flushPromises();
      expect(wrapper.get("pre code").text()).toBe("current text A");
      expect(wrapper.get(".size-full.overflow-auto").classes()).toContain(
        "[&>pre]:whitespace-pre-wrap",
      );
    } finally {
      wrapper.unmount();
    }
  });
  it("keeps failed code visible and ignores pending highlights after unmount", async () => {
    shiki.render.mockRejectedValueOnce(new Error("language unavailable"));
    const failed = mount(CodeBlock, {
      props: { code: "failed-code", language: "javascript" },
    });
    await flushPromises();
    expect(failed.get("pre code").text()).toBe("failed-code");
    failed.unmount();
    let finish!: (html: string) => void;
    shiki.render.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = mount(CodeBlock, {
      props: { code: "unmounted-code", language: "javascript" },
    });
    await flushPromises();
    pending.unmount();
    finish("<pre><code>late result</code></pre>");
    await flushPromises();
    expect(document.body.textContent).not.toContain("late result");
  });
});
