import { expect, test, type Page } from "@playwright/test";

import { openSettingsDialog } from "../support/settings-dialog";

import { mockLangGraphAPI } from "../e2e/utils/mock-api";

test("account notification setting survives clearing browser storage", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  const owner = "00000000-0000-0000-0000-000000000025";
  let enabled: boolean | null = null;
  let preferenceReads = 0;
  const patches: unknown[] = [];
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: owner,
        email: "preferences@example.com",
        system_role: "admin",
        needs_setup: false,
      },
    }),
  );
  await page.route("**/api/v1/auth/preferences", async (route) => {
    expect(route.request().headers()["x-expected-user-id"]).toBe(owner);
    if (route.request().method() === "PATCH") {
      const patch = route.request().postDataJSON() as {
        notification_enabled: boolean;
      };
      patches.push(patch);
      enabled = patch.notification_enabled;
      await route.fulfill({ status: 204 });
    } else {
      preferenceReads++;
      await route.fulfill({
        json: {
          notification_enabled: enabled,
          model_name: null,
          mode: null,
          reasoning_effort: null,
          // The UI language is already saved, so only the toggle is sent.
          locale: "en-US",
        },
      });
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "granted",
    });
  });

  async function openSettings(page: Page) {
    const before = preferenceReads;
    const dialog = await openSettingsDialog(
      page,
      "/workspace/chats/new?settings=notification",
      "Settings",
    );
    await expect.poll(() => preferenceReads).toBeGreaterThan(before);
    await dialog
      .getByRole("button", { name: "Notification", exact: true })
      .click();
    return dialog.getByRole("switch", { name: "Notification", exact: true });
  }

  const toggle = await openSettings(page);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect.poll(() => enabled).toBe(false);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await expect(await openSettings(page)).not.toBeChecked();
  expect(patches).toEqual([{ notification_enabled: false }]);
});
