// Proposed permanent location: tests/e2e-parity/auth-refresh-http.spec.ts.
// Controlled transport regression for the actual visibility/session consumers.
// Real SQL/cookie authorization remains in the separate unchanged session suite.
import { expect, test } from "./support/test";
import { mockLangGraphAPI } from "../e2e/utils/mock-api";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  test(`${app}: failed session refresh retains the identified account and edited form`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      await context.addCookies([{ name: "locale", value: "en-US", url: base }]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      mockLangGraphAPI(page);
      let status = 200;
      let failure: "http" | "transport" | "json" = "http";
      let user = {
        id: "public-refresh-owner-a",
        email: "refresh-a@example.com",
        system_role: "admin",
        needs_setup: false,
        oauth_provider: null,
      };
      const preferenceOwners: string[] = [];
      const threadOwners: string[] = [];
      await page.route(
        /\/api\/(?:langgraph\/)?threads\/search(?:\?|$)/,
        (route) => {
          threadOwners.push(user.id);
          return route.fulfill({
            json: [
              {
                thread_id: `owner-thread-${user.id}`,
                created_at: "2026-10-01T00:00:00Z",
                updated_at: "2026-10-01T00:00:00Z",
                status: "idle",
                metadata: {},
                values: {
                  title: `${user.id} private conversation`,
                  messages: [],
                },
                interrupts: {},
              },
            ],
          });
        },
      );
      await page.route("**/api/v1/auth/me", (route) => {
        if (failure === "transport") return route.abort("failed");
        if (failure === "json")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "{invalid",
          });
        return route.fulfill({
          status,
          json:
            status === 200
              ? user
              : { detail: "Controlled transient HTTP error" },
        });
      });
      await page.route("**/api/v1/auth/preferences", (route) => {
        preferenceOwners.push(
          route.request().headers()["x-expected-user-id"] ?? "missing",
        );
        return route.request().method() === "PATCH"
          ? route.fulfill({ status: 204 })
          : route.fulfill({
              json: {
                model_name: null,
                mode: null,
                reasoning_effort: null,
                notification_enabled: null,
                locale: "en-US",
              },
            });
      });
      await page.goto(`${base}/workspace/chats/new?settings=account`);
      await page.bringToFront();
      const dialog = page.getByRole("dialog", {
        name: "Settings",
        exact: true,
      });
      await expect(dialog).toBeVisible();
      let refreshClock = Date.now();
      async function refresh(expected: number | "transport") {
        refreshClock += 61_000;
        await page.clock.setFixedTime(new Date(refreshClock));
        const settled =
          expected === "transport"
            ? page.waitForEvent(
                "requestfailed",
                (request) =>
                  new URL(request.url()).pathname === "/api/v1/auth/me",
              )
            : page.waitForResponse(
                (value) =>
                  new URL(value.url()).pathname === "/api/v1/auth/me" &&
                  value.request().method() === "GET",
              );
        await page.evaluate(() =>
          document.dispatchEvent(new Event("visibilitychange")),
        );
        const result = await settled;
        if ("status" in result) {
          expect(result.status()).toBe(expected);
          await result.finished();
        } else expect(result.failure()).not.toBeNull();
      }
      // The product suite starts with the synthetic development owner. Exercise
      // the real refresh transition before testing an already identified user.
      await refresh(200);
      await expect(dialog.getByText(user.email, { exact: true })).toBeVisible();
      await expect.poll(() => preferenceOwners.includes(user.id)).toBe(true);
      await expect(
        page.getByText(`${user.id} private conversation`, { exact: true }),
      ).toBeVisible();
      const input = dialog.getByPlaceholder("Current password", {
        exact: true,
      });
      await input.fill("public-unsent-draft");
      const originalInput = await input.elementHandle();
      for (status of [403, 429, 503]) {
        await refresh(status);
        await expect(
          dialog.getByText(user.email, { exact: true }),
        ).toBeVisible();
        await expect(input).toHaveValue("public-unsent-draft");
        expect(
          await input.evaluate(
            (node, original) => node === original,
            originalInput,
          ),
        ).toBe(true);
      }
      for (const transient of ["transport", "json"] as const) {
        failure = transient;
        await refresh(transient === "transport" ? "transport" : 200);
        await expect(
          dialog.getByText(user.email, { exact: true }),
        ).toBeVisible();
        await expect(input).toHaveValue("public-unsent-draft");
        expect(
          await input.evaluate(
            (node, original) => node === original,
            originalInput,
          ),
        ).toBe(true);
        failure = "http";
        status = 200;
        await refresh(200);
        await expect(
          dialog.getByText(user.email, { exact: true }),
        ).toBeVisible();
        await expect(input).toHaveValue("public-unsent-draft");
        expect(
          await input.evaluate(
            (node, original) => node === original,
            originalInput,
          ),
        ).toBe(true);
      }
      status = 200;
      const oldOwner = user.id;
      user = {
        ...user,
        id: "public-refresh-owner-b",
        email: "refresh-b@example.com",
      };
      await refresh(200);
      await expect(dialog.getByText(user.email, { exact: true })).toBeVisible();
      await expect.poll(() => preferenceOwners.includes(user.id)).toBe(true);
      await expect.poll(() => threadOwners.includes(user.id)).toBe(true);
      await expect(
        page.getByText(`${user.id} private conversation`, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(`${oldOwner} private conversation`, { exact: true }),
      ).toHaveCount(0);
      await expect(input).toHaveValue("");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
