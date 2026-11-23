import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MessageMarkdownContent from "@/components/chat/MessageMarkdownContent.vue";
import "@/components/markdown/StreamMarkdown.vue";
const load = vi.hoisted(() => vi.fn());
vi.mock("@/core/markdown/math", async (original) => ({
  ...(await original<typeof import("@/core/markdown/math")>()),
  loadKatexRehypePlugin: load,
}));
const wrappers: ReturnType<typeof mount>[] = [];
beforeEach(() => load.mockReset());
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.restoreAllMocks();
});
it("handles a current load failure and retries when the message changes", async () => {
  const failure = new Error("Renderer chunk unavailable");
  load
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce(() => () => undefined);
  const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const wrapper = mount(MessageMarkdownContent, { props: { content: "$a$" } });
  wrappers.push(wrapper);
  await flushPromises();
  expect(report).toHaveBeenCalledWith("Failed to load math renderer:", failure);
  await wrapper.setProps({ content: "$b$" });
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(2);
});
it("retires a failed load after its message component unmounts", async () => {
  let reject!: (reason: Error) => void;
  load.mockImplementationOnce(
    () =>
      new Promise((_, no) => {
        reject = no;
      }),
  );
  const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const wrapper = mount(MessageMarkdownContent, { props: { content: "$a$" } });
  await flushPromises();
  wrapper.unmount();
  reject(new Error("Late failure"));
  await flushPromises();
  expect(report).not.toHaveBeenCalled();
});
