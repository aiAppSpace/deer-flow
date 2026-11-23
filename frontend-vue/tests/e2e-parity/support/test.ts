import { test as base } from "@playwright/test";

import { withParityBrowser } from "./browser";

export * from "@playwright/test";

/** Keep Playwright's per-test context/page fixtures and tracing unchanged. */
export const test = base.extend({
  browser: [
    async (
      {
        playwright,
        browserName,
        launchOptions,
        headless,
        channel,
        connectOptions,
      },
      use,
    ) => {
      if (browserName !== "chromium" || connectOptions)
        throw new Error(
          "Product parity requires its own local Chromium profile",
        );
      await withParityBrowser(
        playwright.chromium,
        { ...launchOptions, headless, channel, handleSIGINT: false },
        use,
      );
    },
    { scope: "worker", timeout: 0 },
  ],
});
