import { expect, test } from "./support/test";
import { captureScenario } from "./support/capture";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  scenarioStates,
} from "./support/scenarios";

const cases = [
  {
    id: "project-document-attach",
    state: "",
    announcement: "Loading... - DeerFlow",
  },
  {
    id: "thread-activity",
    state: "opened-read",
    announcement: "Loading... - DeerFlow",
  },
  {
    id: "thread-delete-confirm",
    state: "deleted",
    announcement: "New chat - DeerFlow",
  },
  { id: "thread-activity", state: "unread-list", announcement: "" },
  { id: "chat-thread-init-ordering", state: "", announcement: "" },
] as const;

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  for (const selection of cases) {
    test(`${app}: navigation head ${selection.id}#${selection.state || "default"}`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        const unexpected: string[] = [];
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/api/**", (route) => {
          unexpected.push(
            `${route.request().method()} ${route.request().url()}`,
          );
          return route.abort();
        });
        const scenario = PARITY_SCENARIOS.find(
          (item) => item.id === selection.id,
        )!;
        const state = scenarioStates(scenario).find(
          (item) => item.id === selection.state,
        )!;
        const capture = await captureScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          state,
        );
        // Preserve the complete accessibility and transport capture, including alert.
        await info.attach(
          `${app}-${selection.id}-${selection.state || "default"}`,
          {
            body: JSON.stringify(
              { selection, title: await page.title(), capture },
              null,
              2,
            ),
            contentType: "application/json",
          },
        );
        // Playwright pierces the real open shadow root; no replacement live region.
        const host = page.locator(
          app === "vue" ? "#__route-announcer__" : "next-route-announcer",
        );
        const alert = host.locator('[role="alert"]');
        await expect(alert).toHaveCount(1);
        await expect(alert).toHaveText(selection.announcement);
        expect(
          await host.evaluate(
            (element) =>
              element.shadowRoot?.querySelector('[role="alert"]')?.textContent,
          ),
        ).toBe(selection.announcement);
        expect(await host.getAttribute("aria-live")).toBeNull();
        if (selection.id === "chat-thread-init-ordering") {
          const persistedUrl = page.url();
          if (app === "vue")
            expect(
              await page.evaluate(
                () => typeof history.state?.deerflowRouteAnnouncementToken,
              ),
            ).toBe("string");
          await page.getByRole("link", { name: "Chats", exact: true }).click();
          await expect(page).toHaveURL(/\/workspace\/chats$/);
          await expect(alert).toHaveText("Chats - DeerFlow");
          await page.goBack();
          await expect(page).toHaveURL(persistedUrl);
          await expect(page.getByText("Hello", { exact: true })).toBeVisible();
          await expect(
            page.getByText("Hello from DeerFlow!", { exact: true }),
          ).toBeVisible();
          await expect(page).toHaveTitle("New Chat - DeerFlow");
          await info.attach(`${app}-reopened-persisted-owner`, {
            body: JSON.stringify({
              title: await page.title(),
              announcement: await alert.textContent(),
              sameUrl: page.url() === persistedUrl,
            }),
            contentType: "application/json",
          });
          // A consumed continuation token in history cannot silence a later visit.
          await expect(alert).toHaveText("New Chat - DeerFlow");
        }
        if (selection.id === "thread-delete-confirm") {
          await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
          await expect(
            page.getByRole("dialog", { name: "Delete chat", exact: true }),
          ).toHaveCount(0);
          expect(
            capture.requests.some((request) => request.startsWith("DELETE ")),
          ).toBe(true);
        } else if (selection.state === "unread-list") {
          await expect(page).toHaveURL(/\/workspace\/chats$/);
        } else {
          await expect(page).toHaveURL(/\/workspace\/chats\/[^/]+$/);
          expect(new URL(page.url()).pathname).not.toBe("/workspace/chats/new");
        }
        if (selection.id === "project-document-attach") {
          await expect(
            page.getByTestId("project-attachment-chip"),
          ).toContainText("report.docx");
        }
        expect(capture.requests.length).toBeGreaterThan(0);
        expect(unexpected).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
