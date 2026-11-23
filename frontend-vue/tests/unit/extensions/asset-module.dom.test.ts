import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { importAssetModule } from "@/core/extensions/asset-module";

let script: HTMLScriptElement;
beforeEach(() => {
  // Native module evaluation is a browser boundary; retain the created element
  // and drive its browser events explicitly instead of happy-dom loading JS.
  vi.spyOn(document.head, "append").mockImplementation((...nodes) => {
    script = nodes[0] as HTMLScriptElement;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("preloads the native credentialed module graph at its original URL and cancels its host wait", async () => {
  const controller = new AbortController();
  const path = `/api/plugins/community.example/assets/${"a".repeat(64)}/static/dist/index.mjs`;
  const pending = importAssetModule(path, controller.signal);
  const remove = vi.spyOn(script, "remove");
  expect(script.src).toBe(new URL(path, document.baseURI).href);
  expect(script.crossOrigin).toBe("use-credentials");
  expect(script.src.startsWith("blob:")).toBe(false);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(remove).toHaveBeenCalledTimes(1);
  expect(script.onload).toBeNull();
});

it("bounds a stalled module load and removes the preload element on failure", async () => {
  vi.useFakeTimers();
  const pending = importAssetModule("/api/plugins/example/assets/index.mjs");
  const remove = vi.spyOn(script, "remove");
  const settled = pending.catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(await settled).toMatchObject({ message: "Plugin module timed out" });
  expect(remove).toHaveBeenCalledTimes(1);
});

it("contains a failed native preload without leaving its handlers or element", async () => {
  const pending = importAssetModule("/api/plugins/example/assets/index.mjs");
  const remove = vi.spyOn(script, "remove");
  script.dispatchEvent(new Event("error"));
  await expect(pending).rejects.toThrow("unavailable");
  expect(remove).toHaveBeenCalledTimes(1);
  expect(script.onerror).toBeNull();
});
