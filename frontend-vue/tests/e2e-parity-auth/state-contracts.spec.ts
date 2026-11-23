import { expect, test } from "@playwright/test";

const applications = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3117"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3118"],
] as const;
const copies = [
  [
    "en-US",
    {
      email: "Email",
      password: "Password",
      confirm: "Confirm Password",
      create: "Create Admin Account",
      creating: "Creating account…",
      mismatch: "Passwords do not match",
      signing: "Signing you in...",
      success: "Redirecting...",
      unauthenticated: "Authentication failed. Redirecting to login...",
      unavailable:
        "Gateway is temporarily unavailable. Redirecting to recovery...",
      recovery: "The Gateway is temporarily unavailable. Please try again.",
    },
  ],
  [
    "zh-CN",
    {
      email: "邮箱",
      password: "密码",
      confirm: "确认密码",
      create: "创建管理员账号",
      creating: "正在创建账号…",
      mismatch: "两次输入的密码不一致",
      signing: "正在登录...",
      success: "正在跳转...",
      unauthenticated: "认证失败，正在跳转到登录页...",
      unavailable: "Gateway 暂时不可用，正在跳转到恢复页...",
      recovery: "Gateway 暂时不可用，请重试。",
    },
  ],
] as const;

for (const [framework, app] of applications) {
  for (const [locale, copy] of copies) {
    test.describe(`${framework} real auth UI ${locale}`, () => {
      test.beforeEach(async ({ context, page }) => {
        await context.addCookies([
          { name: "locale", value: locale, domain: "localhost", path: "/" },
        ]);
        await page.route("**/api/v1/auth/setup-status", (route) =>
          route.fulfill({
            json: { needs_setup: true, registration_enabled: false },
          }),
        );
        await page.route("**/api/v1/auth/providers", (route) =>
          route.fulfill({ json: { providers: [] } }),
        );
      });

      test("initialization labels, validation, autocomplete and pending wire stay localized", async ({
        page,
      }) => {
        await page.route("**/api/v1/auth/me", (route) =>
          route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
        );
        let posts = 0;
        let body: unknown;
        let release!: () => void;
        const held = new Promise<void>((done) => {
          release = done;
        });
        await page.route("**/api/v1/auth/initialize", async (route) => {
          posts += 1;
          body = route.request().postDataJSON();
          await held;
          await route.fulfill({
            status: 503,
            json: { detail: "Public initialization retry" },
          });
        });
        await page.goto(`${app}/setup`);
        const email = page.getByLabel(copy.email, { exact: true });
        const password = page.getByLabel(copy.password, { exact: true });
        const confirm = page.getByLabel(copy.confirm, { exact: true });
        await expect(email).toHaveAttribute("autocomplete", "email");
        await expect(password).toHaveAttribute("autocomplete", "new-password");
        await expect(confirm).toHaveAttribute("autocomplete", "new-password");
        await email.fill("public-admin@example.com");
        await password.fill("public-password-123");
        await confirm.fill("different-password-123");
        await page
          .getByRole("button", { name: copy.create, exact: true })
          .click();
        await expect(
          page.getByRole("alert").filter({ hasText: copy.mismatch }),
        ).toHaveText(copy.mismatch);
        expect(posts).toBe(0);
        await confirm.fill("public-password-123");
        try {
          await page
            .getByRole("button", { name: copy.create, exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: copy.creating, exact: true }),
          ).toBeDisabled();
          await expect.poll(() => posts).toBe(1);
          expect(body).toEqual({
            email: "public-admin@example.com",
            password: "public-password-123",
            remember_me: true,
          });
        } finally {
          release();
        }
        await expect(
          page
            .getByRole("alert")
            .filter({ hasText: "Public initialization retry" }),
        ).toHaveText("Public initialization retry");
        await expect(
          page.getByRole("button", { name: copy.create, exact: true }),
        ).toBeEnabled();
      });

      for (const response of [
        "success",
        "unauthenticated",
        "unavailable",
        "network",
      ] as const) {
        test(`callback ${response} distinguishes its status and preserves safe next`, async ({
          page,
        }) => {
          let release!: () => void;
          const held = new Promise<void>((done) => {
            release = done;
          });
          let probes = 0;
          const pageErrors: string[] = [];
          page.on("pageerror", (error) => pageErrors.push(error.message));
          await page.route("**/api/v1/auth/me", async (route) => {
            probes += 1;
            if (probes !== 1)
              return route.fulfill({
                status: 401,
                json: { detail: "Unauthorized" },
              });
            await held;
            if (response === "network") return route.abort("connectionrefused");
            return route.fulfill(
              response === "success"
                ? {
                    status: 200,
                    json: {
                      id: "public-auth-user",
                      email: "public@example.com",
                      system_role: "admin",
                      needs_setup: false,
                    },
                  }
                : {
                    status: response === "unauthenticated" ? 401 : 503,
                    json: { detail: "Public auth response" },
                  },
            );
          });
          const next = "/login?flow=return#answer";
          await page.goto(
            `${app}/auth/callback?next=${encodeURIComponent(next)}`,
          );
          try {
            await expect(
              page.getByText(copy.signing, { exact: true }),
            ).toBeVisible();
          } finally {
            release();
          }
          await expect(
            page.getByText(
              copy[response === "network" ? "unavailable" : response],
              { exact: true },
            ),
          ).toBeVisible();
          const expected =
            response === "success"
              ? next
              : response === "unauthenticated"
                ? "/login?error=sso_failed"
                : `/login?error=gateway_unavailable&next=${encodeURIComponent(next)}`;
          const target = new URL(expected, app);
          await expect
            .poll(() => {
              const url = new URL(page.url());
              return {
                pathname: url.pathname,
                query: [...url.searchParams.entries()],
                hash: url.hash,
              };
            })
            .toEqual({
              pathname: target.pathname,
              query: [...target.searchParams.entries()],
              hash: target.hash,
            });
          if (response === "unavailable" || response === "network")
            await expect(
              page.getByText(copy.recovery, { exact: true }),
            ).toBeVisible();
          expect(pageErrors).toEqual([]);
        });
      }
    });
  }
}
