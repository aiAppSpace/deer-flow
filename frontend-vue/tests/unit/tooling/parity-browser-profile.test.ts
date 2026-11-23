import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withParityBrowser } from "../../e2e-parity/support/browser";

afterEach(() => vi.restoreAllMocks());

describe("owned parity browser profile", () => {
  it.each(["success", "test failure", "launch failure", "missing owner"])(
    "retains process/context options and cleans its own profile after %s",
    async (outcome) => {
      let directory = "";
      const browser = {} as Browser;
      const close = vi.fn(async () => {
        await expect(access(directory)).resolves.toBeUndefined();
      });
      const options = {
        channel: "chromium",
        headless: false,
        args: ["--test-argument"],
      };
      const launch = vi
        .spyOn(chromium, "launchPersistentContext")
        .mockImplementation(async (path, received) => {
          directory = path;
          expect(received).toEqual(options);
          expect(
            JSON.parse(
              await readFile(join(path, "Default", "Preferences"), "utf8"),
            ),
          ).toEqual({ translate: { enabled: false } });
          if (outcome === "launch failure") throw new Error(outcome);
          return {
            browser: () => (outcome === "missing owner" ? null : browser),
            close,
          } as unknown as BrowserContext;
        });
      const use = vi.fn(async (received: Browser) => {
        expect(received).toBe(browser);
        if (outcome === "test failure") throw new Error(outcome);
      });
      const run = withParityBrowser(chromium, options, use);
      if (outcome === "success") await expect(run).resolves.toBeUndefined();
      else
        await expect(run).rejects.toThrow(
          outcome === "missing owner" ? "no browser owner" : outcome,
        );
      expect(launch).toHaveBeenCalledTimes(1);
      expect(use).toHaveBeenCalledTimes(
        ["success", "test failure"].includes(outcome) ? 1 : 0,
      );
      expect(close).toHaveBeenCalledTimes(outcome === "launch failure" ? 0 : 1);
      await expect(access(directory)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );
});
