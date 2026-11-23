import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Browser, BrowserType, LaunchOptions } from "@playwright/test";

/** Own only a disposable browser profile. Test pages continue to use isolated
 * browser.newContext() instances; the persistent context owns the process only.
 * Chromium removed the Translate feature flag, so Playwright's default flag no
 * longer prevents the native translation bubble from capturing keyboard focus.
 */
export async function withParityBrowser(
  browserType: BrowserType,
  options: LaunchOptions,
  use: (browser: Browser) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "deerflow-parity-browser-"));
  try {
    await mkdir(join(directory, "Default"));
    await writeFile(
      join(directory, "Default", "Preferences"),
      JSON.stringify({ translate: { enabled: false } }),
      "utf8",
    );
    const owner = await browserType.launchPersistentContext(directory, options);
    try {
      const browser = owner.browser();
      if (!browser) throw new Error("The parity profile has no browser owner");
      await use(browser);
    } finally {
      await owner.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
