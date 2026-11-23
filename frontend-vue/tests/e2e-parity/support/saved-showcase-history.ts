import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";

/** Keep the sibling fixture dependency in this shared parity-only entry. */
export async function readSavedShowcaseSnapshot(threadId: string) {
  return JSON.parse(
    await readFile(
      new URL(
        `../../../../frontend/public/demo/threads/${threadId}/thread.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { history?: unknown[] };
}

/** Saved public transcripts use React's read-only mock history endpoint. */
export async function mockSavedShowcaseHistory(page: Page, threadId: string) {
  const saved = await readSavedShowcaseSnapshot(threadId);
  await page.route(`**/mock/api/threads/${threadId}/history`, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(Array.isArray(saved.history) ? saved : [saved]),
    });
  });
}
