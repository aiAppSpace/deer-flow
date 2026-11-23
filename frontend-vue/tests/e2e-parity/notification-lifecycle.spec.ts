import { expect, test } from "./support/test";
import {
  buildNotificationComponent,
  type NotificationApp,
} from "./support/notification-lifecycle";

const scripts = new Map<NotificationApp, string>();
test.beforeAll(async () => {
  for (const app of ["react", "vue"] as const)
    scripts.set(app, await buildNotificationComponent(app));
});

for (const app of ["react", "vue"] as const) {
  for (const shortcut of [false, true]) {
    for (const removal of ["clear", "unmount"] as const) {
      for (const blur of [false, true]) {
        test(`${app} ${shortcut ? "Alt+T" : "ordinary Tab"} ${blur ? "abandoned" : "focused"} notification ${removal} preserves the actual focus owner`, async ({
          page,
        }) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.setContent(
            '<button id="entry">Entry</button><div id="fixture"></div>',
          );
          await page.addScriptTag({ content: scripts.get(app)! });
          await expect(page.locator("html")).toHaveAttribute(
            "data-notification-ready",
            "true",
          );
          await page.evaluate(() =>
            document.dispatchEvent(new Event("notification:show")),
          );
          const list = page.locator(
            '[data-sonner-toaster],[data-testid="workspace-toaster"]',
          );
          const item = list.locator(":scope > li").first();
          await expect(item).toBeVisible();
          await page.locator("#entry").focus();
          if (shortcut) {
            await page.keyboard.press("Alt+KeyT");
            await expect(list).toBeFocused();
          }
          await page.keyboard.press("Tab");
          await expect(item).toBeFocused();
          if (blur) {
            await item.evaluate((node) => (node as HTMLElement).blur());
            await expect(page.locator("body")).toBeFocused();
          }
          await page.evaluate(
            (event) => document.dispatchEvent(new Event(event)),
            `notification:${removal}`,
          );
          await expect(list).toHaveCount(0);
          await expect(page.locator(blur ? "body" : "#entry")).toBeFocused();
          expect(errors).toEqual([]);
        });
      }
    }
  }
}
