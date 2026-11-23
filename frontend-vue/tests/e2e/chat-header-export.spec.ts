import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

test("the tooltip-composed header export menu is clickable and downloads both visible transcript formats", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Native anchor export",
        messages: [
          { id: "export-human", type: "human", content: "Visible question" },
          { id: "export-ai", type: "ai", content: "Visible answer" },
          {
            id: "export-hidden",
            type: "human",
            content: "INTERNAL_EXPORT_SENTINEL",
            additional_kwargs: { hide_from_ui: true },
          },
        ],
      },
    ],
  });
  await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
  await expect(page.getByText("Visible answer", { exact: true })).toBeVisible();

  for (const [label, extension] of [
    ["Export as Markdown", "md"],
    ["Export as JSON", "json"],
  ] as const) {
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const item = page.getByRole("menuitem", { name: label, exact: true });
    await expect(item).toBeInViewport();
    const downloadPromise = page.waitForEvent("download");
    await item.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^Native anchor export.*\\.${extension}$`),
    );
    const path = await download.path();
    expect(path).not.toBeNull();
    const content = await readFile(path!, "utf8");
    expect(content).toContain("Visible question");
    expect(content).toContain("Visible answer");
    expect(content).not.toContain("INTERNAL_EXPORT_SENTINEL");
    await expect(item).toBeHidden();
  }
});
