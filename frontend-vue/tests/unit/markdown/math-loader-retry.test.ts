import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("rehype-katex");
  vi.doUnmock("katex/dist/katex.min.css");
  vi.resetModules();
});
it("does not retain a rejected lazy import as the shared renderer", async () => {
  const failure = new Error("Renderer chunk unavailable");
  vi.doMock("rehype-katex", () => {
    throw failure;
  });
  vi.doMock("katex/dist/katex.min.css", () => ({}));
  const { loadKatexRehypePlugin } = await import("@/core/markdown/math");
  await expect(loadKatexRehypePlugin()).rejects.toThrow();
  const plugin = () => () => undefined;
  vi.doMock("rehype-katex", () => ({ default: plugin }));
  const loaded = await loadKatexRehypePlugin();
  expect(loaded).toEqual([plugin, expect.any(Object)]);
  expect(await loadKatexRehypePlugin()).toBe(loaded);
});
