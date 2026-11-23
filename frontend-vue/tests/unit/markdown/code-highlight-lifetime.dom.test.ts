import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shiki = vi.hoisted(() => ({ codeToTokens: vi.fn() }));
vi.mock("shiki", () => shiki);

import CodeBlock from "@/components/markdown/CodeBlock.vue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function highlighted(code: string) {
  return {
    tokens: [
      [
        {
          content: code,
          htmlStyle: { "--shiki-light": "#123456", "--shiki-dark": "#abcdef" },
        },
      ],
    ],
  };
}
let wrapper: VueWrapper | undefined;
const style = () =>
  wrapper!
    .get('[data-streamdown="code-block-body"] code span span')
    .attributes("style");
beforeEach(() => {
  shiki.codeToTokens.mockReset();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("code highlighting belongs to the current render", () => {
  for (const change of ["code", "language"] as const) {
    it(`a stale ${change} failure does not erase a newer successful highlight`, async () => {
      const old = deferred<ReturnType<typeof highlighted>>();
      const fresh = deferred<ReturnType<typeof highlighted>>();
      shiki.codeToTokens
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(fresh.promise);
      wrapper = mount(CodeBlock, { props: { code: "first", language: "ts" } });
      await vi.waitFor(() =>
        expect(shiki.codeToTokens).toHaveBeenCalledTimes(1),
      );
      await wrapper.setProps(
        change === "code" ? { code: "latest" } : { language: "js" },
      );
      await vi.waitFor(() =>
        expect(shiki.codeToTokens).toHaveBeenCalledTimes(2),
      );
      const code = change === "code" ? "latest" : "first";
      fresh.resolve(highlighted(code));
      await flushPromises();
      expect(style()).toContain("#123456");
      old.reject(new Error("old grammar failed"));
      await flushPromises();
      expect(style()).toContain("#123456");
      expect(wrapper.get('[data-streamdown="code-block-body"]').text()).toBe(
        code,
      );
    });
  }
  it("a stale successful render cannot replace current code", async () => {
    const old = deferred<ReturnType<typeof highlighted>>();
    shiki.codeToTokens
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(highlighted("latest"));
    wrapper = mount(CodeBlock, { props: { code: "first", language: "ts" } });
    await vi.waitFor(() => expect(shiki.codeToTokens).toHaveBeenCalledTimes(1));
    await wrapper.setProps({ code: "latest" });
    await vi.waitFor(() => expect(style()).toContain("#123456"));
    old.resolve(highlighted("first"));
    await flushPromises();
    expect(wrapper.get('[data-streamdown="code-block-body"]').text()).toBe(
      "latest",
    );
  });
  it("the current render still falls back to readable plain text on failure", async () => {
    shiki.codeToTokens.mockRejectedValue(new Error("unknown grammar"));
    wrapper = mount(CodeBlock, {
      props: { code: "read me", language: "unknown" },
    });
    await vi.waitFor(() => expect(shiki.codeToTokens).toHaveBeenCalledTimes(1));
    await flushPromises();
    expect(style()).toContain("inherit");
    expect(wrapper.get('[data-streamdown="code-block-body"]').text()).toBe(
      "read me",
    );
  });
});
