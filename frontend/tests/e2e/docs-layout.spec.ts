import { expect, test } from "@playwright/test";

for (const locale of [
  {
    lang: "en",
    title: "DeerFlow Documentation",
    why: "Why DeerFlow",
    middleware: "Middleware Contributions",
  },
  {
    lang: "zh",
    title: "DeerFlow 文档",
    why: "为什么选择 DeerFlow",
    middleware: "中间件贡献",
  },
]) {
  test(`${locale.lang} docs retain content through server render, navigation and reload`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(`/${locale.lang}/docs`);
    expect(response?.status()).toBe(200);
    expect(await response!.text()).toContain(locale.title);
    await expect(
      page.getByRole("heading", { level: 1, name: locale.title, exact: true }),
    ).toBeVisible();

    await page
      .locator("article")
      .getByRole("link", { name: locale.why, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/${locale.lang}/docs/introduction/why-deerflow$`),
    );
    await expect(
      page.getByRole("heading", { level: 1, name: locale.why, exact: true }),
    ).toBeVisible();

    const reloaded = await page.reload();
    expect(reloaded?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: locale.why, exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`${locale.lang} nested docs render their MDX content without layout validation errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(
      `/${locale.lang}/docs/harness/extensions/middleware`,
    );
    expect(response?.status()).toBe(200);
    expect(await response!.text()).toContain(locale.middleware);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: locale.middleware,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .locator("article")
        .getByText("AgentMiddleware", { exact: true })
        .first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
