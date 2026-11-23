import { expect, it, vi } from "vitest";
const styleLoaded = vi.hoisted(() => vi.fn());
vi.mock("katex/dist/katex.min.css", () => {
  styleLoaded();
  return {};
});
import { loadKatexRehypePlugin } from "@/core/markdown/math";

it("makes the installed KaTeX stylesheet ready with the lazy renderer, once", async () => {
  expect(styleLoaded).not.toHaveBeenCalled();
  await loadKatexRehypePlugin();
  expect(styleLoaded).toHaveBeenCalledOnce();
  await loadKatexRehypePlugin();
  expect(styleLoaded).toHaveBeenCalledOnce();
});
