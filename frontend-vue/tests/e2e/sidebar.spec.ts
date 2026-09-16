import { expect, test } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

test.describe("Sidebar navigation", () => {
  test("sidebar contains Chats and Agents nav links", async ({ page }) => {
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new");

    // Sidebar uses data-sidebar="menu-button" with asChild rendering on <Link>
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.locator("a[href='/workspace/chats']")).toBeVisible({
      timeout: 15_000,
    });
    await expect(sidebar.locator("a[href='/workspace/agents']")).toBeVisible();
  });

  test("Agents link navigates to agents page", async ({ page }) => {
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const agentsLink = sidebar.locator("a[href='/workspace/agents']");
    await expect(agentsLink).toBeVisible({ timeout: 15_000 });
    await agentsLink.click();

    await page.waitForURL("**/workspace/agents");
    await expect(page).toHaveURL(/\/workspace\/agents/);
  });

  test("Agents button is disabled with a hover tooltip when agents_api is off", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    await page.route("**/api/features", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ agents_api: { enabled: false } }),
      }),
    );

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    // Chats remains a real link; Agents is no longer a navigable link.
    await expect(sidebar.locator("a[href='/workspace/chats']")).toBeVisible({
      timeout: 15_000,
    });
    await expect(sidebar.locator("a[href='/workspace/agents']")).toHaveCount(0);

    // The disabled Agents button is rendered and announces its disabled state.
    const agentsButton = sidebar.getByRole("button", { name: "Agents" });
    await expect(agentsButton).toHaveAttribute("aria-disabled", "true");

    // The button itself has pointer-events suppressed; force the hover so the
    // event reaches the wrapping tooltip-trigger span that surfaces the tooltip.
    await agentsButton.hover({ force: true });
    await expect(page.getByText("Feature not enabled").first()).toBeVisible();

    // Keyboard/screen-reader users get the reason too: the disabled entry
    // stays in the tab order (focusable) and is wired to a visually-hidden
    // description rather than relying on the hover-only tooltip.
    const describedById = await agentsButton.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    await expect(page.locator(`#${describedById}`)).toHaveText(
      "Feature not enabled",
    );
    await agentsButton.focus();
    await expect(agentsButton).toBeFocused();
  });

  test("mobile welcome layout stays within viewport and opens sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new");

    const viewportWidth = page.viewportSize()?.width ?? 390;
    const expectInsideViewport = async (
      locator: ReturnType<typeof page.locator>,
    ) => {
      await expect(locator).toBeVisible({ timeout: 15_000 });
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
    };

    await expectInsideViewport(page.getByText(/Welcome to|欢迎使用/).first());
    await expectInsideViewport(page.getByRole("textbox").first());
    await expectInsideViewport(page.locator("[data-slot='suggestions-list']"));

    const mobileSidebarTrigger = page
      .locator("[data-sidebar='trigger']:visible")
      .first();
    await expect(mobileSidebarTrigger).toBeVisible();
    await mobileSidebarTrigger.click();

    const mobileSidebar = page.locator(
      "[data-mobile='true'][data-sidebar='sidebar']",
    );
    await expect(mobileSidebar).toBeVisible();
    await expect(
      mobileSidebar.locator("a[href='/workspace/chats']"),
    ).toBeVisible();
    await expect(
      mobileSidebar.locator("a[href='/workspace/agents']"),
    ).toBeVisible();
  });

  /*
    **窄屏、抽屉没打开时，侧栏那三个查询一次都不该发。**

    上游窄屏的侧栏是 Sheet，关着时整棵子树不在 DOM 里，于是
    `WorkspaceNavChatList` / `WorkspaceChannelsList` / `RecentChatList`
    这三颗组件各自持有的查询自然不跑。对照台账上
    `scheduled-tasks#default` 与 `#load-failed` 两屏的
    `requestsOnlyVue: GET /api/channels/providers · GET /api/features ·
    POST /api/threads/search` 就是本仓多发的那三条（wave 214）。

    两处根因，缺一条这门就漏：
    ① `isNarrow` 以前在 `onMounted` 里才纠正，而父组件的 `onMounted` 跑在子组件
       **全部挂载之后**——首帧先挂桌面那一支，整棵侧栏连同查询起来一次再扔掉；
    ② `useThreads()` 与 `useAgentsApiEnabled()` 以前写在抽屉**外面**的
       `ThreadSidebar` setup 里，跟抽屉开不开没关系。

    **所以这条用例按「请求」判，不按「DOM 里有没有侧栏」判**：修掉①之后 DOM
    终态一直是对的（抽屉关着，什么都没有），只有请求能看见那一帧。
  */
  test("does not run the sidebar queries while the mobile drawer is closed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const seen: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/api/")) seen.push(`${request.method()} ${path}`);
    });
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new");
    // 等到这一屏真的画出来，否则「没有请求」可能只是还没开始。
    await expect(page.getByRole("textbox").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator("[data-sidebar='trigger']:visible").first(),
    ).toBeVisible();

    expect(
      seen.filter((entry) => entry.endsWith("/api/channels/providers")),
    ).toEqual([]);
    expect(
      seen.filter((entry) => entry.endsWith("/api/threads/search")),
    ).toEqual([]);

    // 反向：抽屉一打开，这三条就该出现——否则上面的 0 只是把侧栏整个弄没了。
    await page.locator("[data-sidebar='trigger']:visible").first().click();
    await expect(
      page.locator("[data-mobile='true'][data-sidebar='sidebar']"),
    ).toBeVisible();
    await expect
      .poll(
        () =>
          seen.filter((entry) => entry.endsWith("/api/channels/providers"))
            .length,
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        () =>
          seen.filter((entry) => entry.endsWith("/api/threads/search")).length,
      )
      .toBeGreaterThan(0);
  });
});
