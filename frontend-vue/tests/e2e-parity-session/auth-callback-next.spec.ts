import { expect, test } from "@playwright/test";

import { administratorSession, REACT_APP, VUE_APP } from "./session-api";

for (const [framework, app] of [
  ["vue", VUE_APP],
  ["react", REACT_APP],
] as const) {
  for (const [locale, signing] of [
    ["en-US", "Signing you in..."],
    ["zh-CN", "正在登录..."],
  ] as const) {
    test(`${framework} ${locale}: an actual HttpOnly callback session preserves safe next and rejects an external target`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      try {
        await administratorSession(context.request, app);
        await context.addCookies([
          { name: "locale", value: locale, domain: "localhost", path: "/" },
        ]);
        const page = await context.newPage();
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        let release!: () => void;
        let held = new Promise<void>((done) => {
          release = done;
        });
        await page.route("**/api/v1/auth/me", async (route) => {
          if (new URL(page.url()).pathname === "/auth/callback") await held;
          await route.continue();
        });
        const next = "/workspace/chats?callback=verified#answer";
        await page.goto(
          `${app}/auth/callback?next=${encodeURIComponent(next)}`,
        );
        try {
          await expect(page.getByText(signing, { exact: true })).toBeVisible();
        } finally {
          release();
        }
        await expect
          .poll(() => {
            const url = new URL(page.url());
            return `${url.pathname}${url.search}${url.hash}`;
          })
          .toBe(next);

        held = new Promise<void>((done) => {
          release = done;
        });
        await page.goto(
          `${app}/auth/callback?next=${encodeURIComponent("https://evil.example/phish")}`,
        );
        try {
          await expect(page.getByText(signing, { exact: true })).toBeVisible();
        } finally {
          release();
        }
        await expect(page).toHaveURL(`${app}/workspace/chats/new`);
        expect(pageErrors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
