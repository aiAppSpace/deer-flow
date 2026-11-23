import { expect, type Page } from "@playwright/test";
import { settledBox } from "./settled-box";

export async function openLarkPlugin(page: Page) {
  await page.goto("/workspace/capabilities?plugin=lark");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByText("Lark / Feishu CLI", { exact: true }),
  ).toBeVisible();
  await settledBox(dialog, "Lark plugin dialog");
  return dialog;
}
