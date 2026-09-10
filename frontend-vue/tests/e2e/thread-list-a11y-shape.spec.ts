/*
  【文件职责】     钉住会话列表域在可访问性树里的形状：列表页的面包屑外壳、一行是不是
                   一个链接、相对时间的措辞、搜索框的角色，以及侧栏会话行的盒模型与配色。
  【架构位置】     产品合同套件（tests/e2e，自带 route mock）
  【主要导出】     无；Playwright 用例
  【边界与注意】   与 chat-a11y-shape / artifacts-a11y-shape 同一个理由：这些形状是照着
                   `frontend/src/app/workspace/chats/page.tsx`、
                   `frontend/src/components/workspace/recent-chat-list.tsx` 与
                   `workspace-container.tsx` 对齐出来的，而验证它们的 e2e-parity 需要
                   兄弟应用 ../frontend 在 checkout 里，本仓的常规门禁不依赖它。
                   不在这里再钉一份的话，一个只跑本仓门禁的改动可以把它们逐条改回去
                   而全绿。

                   钉的是角色、可访问名、结构与尺寸合同，不是 class 名。侧栏那几个
                   数字（16 / 20 / muted）是**相对量**：标题 span 从行的左内边距起算、
                   只有一行文字高、用次要前景色——它们区分的是「标题是行里的一个
                   元素」和「标题就是整行」，后者是这一轮修掉的那个形状。
*/

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

const SECOND_THREAD_ID = "00000000-0000-0000-0000-0000000000b2";

/** 一年前，正好落进 date-fns 的 aboutXYears 分桶。 */
const ONE_YEAR_AGO = new Date(
  Date.now() - 370 * 24 * 60 * 60 * 1000,
).toISOString();

function mockTwoThreads(page: Page) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Newest chat",
        updated_at: ONE_YEAR_AGO,
      },
      {
        thread_id: SECOND_THREAD_ID,
        title: "Older chat",
        updated_at: new Date(
          Date.now() - 371 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    ],
  });
}

test.describe("thread list accessibility shape", () => {
  test("the list page sits in the workspace breadcrumb shell", async ({
    page,
  }) => {
    mockTwoThreads(page);
    await page.goto("/workspace/chats");

    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await expect(breadcrumb).toBeVisible({ timeout: 15_000 });
    // 两段都是链接：React 在 segments.length >= 2 时不把当前页降级成 BreadcrumbPage。
    const crumbs = breadcrumb.getByRole("listitem");
    await expect(crumbs).toHaveCount(2);
    await expect(crumbs.nth(0).getByRole("link")).toHaveAttribute(
      "href",
      "/workspace",
    );
    await expect(crumbs.nth(1).getByRole("link")).toHaveAttribute(
      "href",
      "/workspace/chats",
    );

    // GitHub 入口是一个**匿名**链接：内容只有一个 aria-hidden 的图标。
    const github = page.locator(
      'header a[href="https://github.com/bytedance/deer-flow"]',
    );
    await expect(github).toBeVisible();
    await expect(github).toHaveAccessibleName("");

    // 列表页自己再套一层 main（React 的 WorkspaceBody + page 的 <main>）。
    expect(await page.locator("main").count()).toBeGreaterThanOrEqual(2);

    // 列表页没有 h1：能说出"你在哪儿"的只有面包屑。
    await expect(page.getByRole("heading", { name: "Chats" })).toHaveCount(0);
  });

  test("search is a searchbox, not a plain textbox", async ({ page }) => {
    mockTwoThreads(page);
    await page.goto("/workspace/chats");

    await expect(
      page.getByRole("searchbox", { name: "Search chats" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("textbox", { name: "Search chats" }),
    ).toHaveCount(0);
  });

  test("a row is one link whose name carries the date-fns relative time", async ({
    page,
  }) => {
    mockTwoThreads(page);
    await page.goto("/workspace/chats");

    const row = page
      .locator("main")
      .locator(`a[href='/workspace/chats/${MOCK_THREAD_ID}']`);
    await expect(row).toBeVisible({ timeout: 15_000 });

    /*
      名字是标题 + 相对时间**一整句**。措辞用 date-fns 的 "about 1 year ago"：
      Intl.RelativeTimeFormat 会给出 "last year"，两个应用就不是同一句话了。
    */
    await expect(row).toHaveAccessibleName("Newest chat about 1 year ago");

    // 时间不是 <time>：那会在树里多出一个 time 节点，并把标题挤成独立的 text 节点。
    await expect(row.locator("time")).toHaveCount(0);
    await expect(page.locator("main time")).toHaveCount(0);
  });

  /*
    行操作菜单的形状：顺序、分隔线条数、以及「导出」是**一层子菜单**而不是两个平级
    动作。现有对照场景没有一条会点开这个菜单，所以台账报不出来——这里是它唯一的守卫。
  */
  test("the row action menu keeps React's order, single separator and export submenu", async ({
    page,
  }) => {
    mockTwoThreads(page);
    await page.goto("/workspace/chats/new");

    const row = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: "Newest chat" })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.hover();
    await row.getByRole("button", { name: "More" }).click();

    const menu = page.getByRole("menu").first();
    /*
      顺序照上游 `recent-chat-list.tsx:339` 起那一段：
      置顶 · 重命名 · 分享 · 导出▸ · 归档 · 移到项目▸ · ─ · 删除。
      归档（#5236）与移到项目（#5265）是后补的两项，此前这条期望停在五项上。

      用正则而不是字面量：菜单项是「图标 + 文字」，`textContent` 带着图标后面
      那个空格（`" Pin chat"`），而「移到项目」那一项的模板不带——
      钉死字面量等于把这处无关紧要的空白也钉进判据里。
    */
    await expect(menu.getByRole("menuitem")).toHaveText([
      /^\s*Pin chat\s*$/,
      /^\s*Rename\s*$/,
      /^\s*Share\s*$/,
      /^\s*Export\s*$/,
      /^\s*Archive chat\s*$/,
      /^\s*Move to project\s*$/,
      /^\s*Delete\s*$/,
    ]);
    await expect(menu.getByRole("separator")).toHaveCount(1);

    // 导出是子菜单：展开前两个格式都不在树里。
    await expect(
      page.getByRole("menuitem", { name: "Export as Markdown" }),
    ).toHaveCount(0);
    const exportTrigger = menu.getByRole("menuitem", {
      name: "Export",
      exact: true,
    });
    await expect(exportTrigger).toHaveAttribute("aria-haspopup", "menu");
    await exportTrigger.click();
    await expect(
      page.getByRole("menuitem", { name: "Export as Markdown" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Export as JSON" }),
    ).toBeVisible();
  });

  /*
    删掉「我正看着的那条」有三种成立方式，第三种最容易漏：停在 /chats/new 时，
    页面展示的就是最新那条的延续。React 在这三种情况下都会重置会话并 **replace**
    到新会话页——push 的话，按一下后退就回到一个已经不存在的线程。
  */
  test("deleting the newest thread from /chats/new resets and replaces the URL", async ({
    page,
  }) => {
    mockTwoThreads(page);
    await page.goto("/workspace/chats/new");
    await expect(page.getByRole("link", { name: "Newest chat" })).toBeVisible({
      timeout: 15_000,
    });

    const before = page.url();
    const row = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: "Newest chat" })
      .first();
    await row.hover();
    await row.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(page.getByRole("link", { name: "Newest chat" })).toHaveCount(
      0,
    );
    await expect(page).toHaveURL(/\/workspace\/chats\/new$/);

    // replace 而不是 push：历史里没有多出一条，后退不会回到删除前的那一屏。
    await page.goBack();
    await expect(page).not.toHaveURL(before);
  });

  /*
    置顶失败必须说出来。原来模板里是一个没人 await、也没人 catch 的 Promise：
    后端拒绝时界面毫无反应，只在控制台留一条 unhandled rejection——用户看到那一行
    没置顶，不知道是没生效还是自己没点中。
  */
  test("a rejected pin surfaces a message instead of failing silently", async ({
    page,
  }) => {
    mockTwoThreads(page);
    await page.route(`**/api/langgraph/threads/${MOCK_THREAD_ID}`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 503, json: { detail: "pin rejected" } })
        : route.fallback(),
    );
    await page.goto("/workspace/chats/new");

    const row = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: "Newest chat" })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.hover();
    await row.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Pin chat" }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  /*
    删除是破坏性操作，失败必须说话：不说的话，那一行还在，看起来就像"点了没反应"。
    React 的 useDeleteThread 原本没有 onError（完全静默），这条守卫与
    frontend/tests/e2e/thread-list-pin.spec.ts 里的同名用例是同一份合同。
  */
  test("a rejected delete says so and offers a retry, instead of doing nothing", async ({
    page,
  }) => {
    mockTwoThreads(page);
    let attempts = 0;
    await page.route(`**/api/langgraph/threads/${MOCK_THREAD_ID}`, (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      attempts += 1;
      // 403 而不是 503：React 那边的 SDK AsyncCaller 会退避重试 5xx，两个应用的夹具
      // 要用同一个不可重试的状态码才是同一份合同。
      return route.fulfill({
        status: 403,
        json: { detail: "delete rejected" },
      });
    });
    await page.goto("/workspace/chats/new");

    const row = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: "Newest chat" })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.hover();
    await row.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const alert = page.getByTestId("delete-chat-error");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveRole("alert");
    // 行还在——失败没有假装成功。
    await expect(row).toBeVisible();

    await alert.getByRole("button", { name: "Try again" }).click();
    await expect.poll(() => attempts).toBe(2);
  });

  /*
    空会话导出不是"失败"，是一条正常分支：React 用 `messages.length === 0` 判，
    念的是 `conversation.noMessages`。Vue 原来靠正则匹配错误消息的英文原文来分支。
  */
  test("exporting an empty conversation reports it as empty, not as a failure", async ({
    page,
  }) => {
    mockTwoThreads(page);
    await page.route(
      `**/api/langgraph/threads/${MOCK_THREAD_ID}/state`,
      (route) => route.fulfill({ json: { values: { messages: [] } } }),
    );
    await page.goto("/workspace/chats/new");

    const row = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: "Newest chat" })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.hover();
    await row.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Export", exact: true }).click();
    await page.getByTestId("thread-export-markdown").click();

    await expect(
      page.getByRole("alert").filter({ hasText: "No messages yet" }),
    ).toBeVisible();
  });

  test("the rename dialog is named the way React names it", async ({
    page,
  }) => {
    mockTwoThreads(page);
    await page.goto("/workspace/chats/new");

    const row = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: "Newest chat" })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.hover();
    await row.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();

    const dialog = page.getByRole("dialog", { name: "Rename" });
    await expect(dialog).toBeVisible();
    // React 的输入框只有 placeholder：没有 aria-label，也没有 sr-only 描述。
    const input = dialog.getByPlaceholder("Rename");
    await expect(input).toHaveValue("Newest chat");

    /*
      比的不是"有没有 aria-describedby"——radix 和 reka 都**无条件**在 DialogContent
      上写这个属性（radix 还会为此在控制台警告），所以两边都有。比的是它指向的元素
      在不在：React 的重命名对话框没有描述，Vue 原来补了一句 sr-only，读屏器会多念
      一句 React 不会念的话。
    */
    const describedBy = await dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveCount(0);
  });

  test("the sidebar row is a muted single-line label inside the link, not the whole row", async ({
    page,
  }) => {
    mockTwoThreads(page);
    await page.goto("/workspace/chats/new");

    const link = page
      .locator('[data-sidebar="menu-item"]')
      .locator(`a[href='/workspace/chats/${MOCK_THREAD_ID}']`);
    await expect(link).toBeVisible({ timeout: 15_000 });
    const label = link.getByText("Newest chat");

    const shape = await label.evaluate((element) => {
      const link = element.closest("a")!;
      const labelRect = element.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      return {
        insetFromLink: Math.round(labelRect.x - linkRect.x),
        labelHeight: Math.round(labelRect.height),
        linkHeight: Math.round(linkRect.height),
        shrinksToText: labelRect.width < linkRect.width - 24,
        color: globalThis.getComputedStyle(element).color,
        ...probeColors(element),
      };

      /*
        `--muted-foreground` / `--foreground` 的**记法**在两个应用里不同
        （lab() 与 oklch()），直接比字符串比的是记法不是颜色。让浏览器自己把 var()
        解析成计算颜色再比，比的就是最终呈现的那个颜色。
      */
      function probeColors(anchor: Element) {
        const probe = document.createElement("span");
        anchor.append(probe);
        probe.style.color = "var(--muted-foreground)";
        const mutedColor = globalThis.getComputedStyle(probe).color;
        probe.style.color = "var(--foreground)";
        const foregroundColor = globalThis.getComputedStyle(probe).color;
        probe.remove();
        return { mutedColor, foregroundColor };
      }
    });

    // 行是 h-8、内边距 8px；标题只占一行文字，宽度收缩到文字本身。
    expect(shape.linkHeight).toBe(32);
    expect(shape.insetFromLink).toBe(8);
    expect(shape.labelHeight).toBe(20);
    expect(shape.shrinksToText).toBe(true);

    // 颜色来自次要前景色，不是正文前景色。
    expect(shape.color).toBe(shape.mutedColor);
    expect(shape.color).not.toBe(shape.foregroundColor);
  });
});

function manyThreads(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const padded = String(index + 1).padStart(3, "0");
    return {
      thread_id: `00000000-0000-0000-0000-0000000${padded.padStart(5, "0")}`,
      title: `Conversation ${padded}`,
      updated_at: new Date(
        Date.UTC(2025, 5, 30, 12, 0, 0) - index * 60_000,
      ).toISOString(),
    };
  });
}

test.describe("thread list accessibility shape (long lists)", () => {
  test("the sidebar list has no empty listitem and offers an explicit load-more", async ({
    page,
  }) => {
    mockLangGraphAPI(page, { threads: manyThreads(120) });
    await page.goto("/workspace/chats/new");

    const menu = page.locator(
      '[data-sidebar="group-content"] [data-sidebar="menu"]',
    );
    await expect(menu.getByRole("listitem")).toHaveCount(50, {
      timeout: 15_000,
    });

    /*
      哨兵是 aria-hidden 的 div，不是空 li——一个 1px 高的空 li 在可访问性树里
      仍然是一个真实的 listitem，读屏器会念出「第 51 项，共 51 项」。
    */
    const sentinel = page.getByTestId("recent-chat-list-sentinel");
    await expect(sentinel).toHaveAttribute("aria-hidden", "true");
    expect(await sentinel.evaluate((element) => element.tagName)).toBe("DIV");

    // 「加载更早的对话」是列表的直接子节点，不是列表项。
    const loadMore = page.getByRole("button", { name: "Load older chats" });
    await expect(loadMore).toBeVisible();
    expect(
      await loadMore.evaluate((element) => element.closest("li") === null),
    ).toBe(true);
  });
  /*
    60 条是 React 的切换点（VIRTUALIZATION_THRESHOLD）。50 条那一页仍然全量渲染，
    所以上面那条用例数得出 50 个 listitem；翻到第二页之后两个列表都进入虚拟化，
    DOM 里只剩视口附近那十几行。不虚拟化的话，两个应用的可访问性树在同一份数据上
    一个报十几项、一个报一百项——读屏器念出的「共 N 项」和 Tab 序列长度都不一样。
  */
  test("both lists virtualize once the second page crosses the threshold", async ({
    page,
  }) => {
    mockLangGraphAPI(page, { threads: manyThreads(120) });
    await page.goto("/workspace/chats");

    const rows = page.locator("main a[href^='/workspace/chats/']");
    await expect(rows).toHaveCount(50, { timeout: 15_000 });

    await page.getByTestId("chats-page-sentinel").scrollIntoViewIfNeeded();
    await expect(
      page.locator("main").getByText("Conversation 051"),
    ).toBeVisible({ timeout: 15_000 });

    // 100 条数据，DOM 里远少于 100 行。
    await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeLessThan(60);
    expect(await rows.count()).toBeGreaterThan(0);

    // 撑开的高度按全部 100 行算，滚动条长度才是对的。
    const listHeight = await page
      .locator("main [data-index]")
      .first()
      .evaluate((element) =>
        Math.round(element.parentElement!.getBoundingClientRect().height),
      );
    expect(listHeight).toBeGreaterThan(100 * 60);

    // 侧栏同一份数据，同样只渲染视口附近那几行。
    const sidebarRows = page.locator(
      '[data-sidebar="group-content"] [data-sidebar="menu-item"]',
    );
    await expect
      .poll(() => sidebarRows.count(), { timeout: 15_000 })
      .toBeLessThan(60);
    expect(await sidebarRows.count()).toBeGreaterThan(0);
  });
});
