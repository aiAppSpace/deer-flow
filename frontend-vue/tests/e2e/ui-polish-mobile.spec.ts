import { expect, test } from "@playwright/test";

import { MOCK_THREAD_ID, mockLangGraphAPI } from "./utils/mock-api";

test.describe("UI polish mobile regressions", () => {
  test("workspace exposes mobile sidebar navigation from the chat header", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new");

    await page.getByRole("button", { name: /toggle sidebar/i }).click();

    await expect(page.getByRole("link", { name: /new chat/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /agents/i })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(375);
  });

  /*
    **窄屏下会话页顶栏必须显示标题——哪怕侧栏那份列表缓存从来没被取过。**

    `AgentChat` 有四处（标题 / artifacts / goal / todos）把
    `threads.threads.find(...)` 当作「当前线程的服务端快照」在读，而窄屏的侧栏是
    抽屉，关着时 `RecentChatList` 整棵不挂载、列表查询**根本不跑**。那份缓存唯一的
    填充点是 `useThreads.upsert()` 里「列表还没数据就把这条放进去」那一支。

    第四十八轮查 `requestsOnlyVue: POST /api/threads/search` 时一度把那一支整个删掉，
    当场掉出两条：对照台账 `subtask-card/mobile/light/en-US` 报
    `ariaOnlyReact: - text: Stopped subtask`（标题没了），
    本文件下一条用例的 artifacts 抽屉也打不开（`artifact-trigger` 等不到）。
    真正该去掉的是那一支里**多余的 `invalidateQueries`**，不是放进缓存这件事本身。

    这条用例把「窄屏下那份缓存必须有人填」钉住。
    ⚠ **必须跑在 375**：桌面下侧栏展开、列表查询会跑，缓存自然有数据，
    **这条用例在 1280 上永远绿**。

    ⚠ 更彻底的方向（没做，判据写在 `useThreads.upsert()`）：上游那四处根本不读列表
    缓存。哪天把 `AgentChat` 换到同样的源，这条用例要连同那次重构一起重判。
  */
  test("mobile chat header shows the thread title with the sidebar list unloaded", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Title without sidebar",
          updated_at: "2026-09-19T00:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-title",
              content: [{ type: "text", text: "hi" }],
            },
          ],
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    /*
      反空转：抽屉必须是关着的。哪天窄屏又开始白挂侧栏，这条用例会从
      「列表没取过也有标题」悄悄退化成「列表取过了当然有标题」，而且是绿的。
    */
    await expect(
      page.getByRole("link", { name: /new chat/i }),
      "侧栏抽屉应当关着——它一开，这条用例就不再证明「列表缓存没被取过」",
    ).toBeHidden();
    await expect(header.getByText("Title without sidebar")).toBeVisible();
  });

  test("mobile artifacts open in a drawer without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Thread with artifact",
          artifacts: ["reports/mobile-summary.md"],
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await page.getByTestId("artifact-trigger").click();

    await expect(
      page.getByRole("dialog", { name: /artifacts/i }),
    ).toBeVisible();
    await expect(page.getByText("mobile-summary.md")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(375);
  });

  test("global focus ring tokens are visible in light and dark themes", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    await page.goto("/workspace/chats/new");

    const readRing = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--ring")
          .trim(),
      );

    const selectPersistedTheme = async (theme: "light" | "dark") => {
      await page.evaluate(
        (nextTheme) => localStorage.setItem("theme", nextTheme),
        theme,
      );
      await page.reload();
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.classList.contains("dark"),
          ),
        )
        .toBe(theme === "dark");
    };

    // Theme class ownership belongs to next-themes / Vue's theme controller.
    // Persist and reload through that public contract instead of mutating the
    // class behind the owner's back while hydration is still settling.
    await selectPersistedTheme("light");
    const lightRing = await readRing();
    expect(lightRing).not.toBe("transparent");
    expect(lightRing).not.toBe("");

    await selectPersistedTheme("dark");
    const darkRing = await readRing();
    expect(darkRing).not.toBe("transparent");
    expect(darkRing).not.toBe("");

    // The two themes must resolve to different ring tokens, otherwise the test
    // would pass trivially if <html> were stuck in one mode.
    expect(darkRing).not.toBe(lightRing);
  });
});
