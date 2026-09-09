/*
  【文件职责】     workspace shell/thread actions/changes 的真实 Nuxt + Chromium 合同。
  【架构位置】     Vue-owned M7 Playwright
  【主要导出】     Playwright scenarios
  【依赖关系】     shared mock Gateway · Vue workspace DOM
  【边界与注意】   此处证明浏览器行为；生产 Gateway 协议另由 wp11-real-backend 证明。
*/
import { expect, test, type Page } from "@playwright/test";
import { openSettingsDialog } from "../support/settings-dialog";

import { mockLangGraphAPI } from "./utils/mock-api";

const THREAD_ID = "00000000-0000-0000-0000-000000001111";
const RUN_ID = "run-wp11-workspace-changes";

function mockThreads(page: Page) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: THREAD_ID,
        title: "WP 11 conversation",
        updated_at: new Date(Date.now() - 5 * 60_000).toISOString(),
        messages: [
          {
            type: "human",
            id: "wp11-human",
            content: "Exercise the workspace shell",
            run_id: RUN_ID,
          },
          {
            type: "ai",
            id: "wp11-ai",
            content: "Workspace shell ready",
            run_id: RUN_ID,
          },
        ],
      },
    ],
  });
}

test("command palette owns exact shortcuts, keyboard navigation and cleanup", async ({
  page,
}) => {
  mockThreads(page);
  await page.goto(`/workspace/chats/${THREAD_ID}`);
  const originalFocus = page.getByRole("link", { name: "Chats", exact: true });
  await originalFocus.focus();
  await page.keyboard.press("Meta+k");
  /*
    对话框的名字照抄上游 `<CommandDialog>` 写死的默认值（ui/command.tsx:32），
    走 `primitives.commandPalette`。此前本仓念的是 "Actions"（`shortcuts.actions`）——
    与上游不是同一句（wave 33）。
  */
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  // ui/command 的输入框是 combobox（与 cmdk 同构），不是裸 textbox。
  const search = palette.getByRole("combobox", { name: "Search actions" });
  await expect(search).toBeFocused();
  await search.fill("Settings");
  await search.press("ArrowDown");
  await search.press("Enter");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Appearance" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(originalFocus).toBeFocused();

  const composer = page.getByPlaceholder(/how can i assist you/i);
  await composer.focus();
  await page.keyboard.press("Control+Shift+n");
  await expect(page).toHaveURL(new RegExp(`${THREAD_ID}$`));
  await composer.evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "n",
        ctrlKey: true,
        shiftKey: true,
        isComposing: true,
        bubbles: true,
      }),
    ),
  );
  await expect(page).toHaveURL(new RegExp(`${THREAD_ID}$`));

  await page.locator("body").click({ position: { x: 900, y: 80 } });
  await page.keyboard.press("Control+Shift+n");
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);

  await page.goto("/");
  await page.keyboard.press("Control+Shift+n");
  await expect(page).toHaveURL(/\/$/);
});

test("settings deep link traps focus and back/forward replays only settings query", async ({
  page,
}) => {
  mockThreads(page);
  const dialog = await openSettingsDialog(
    page,
    "/workspace/chats/new?settings=appearance&keep=files#run-anchor",
  );
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(
    dialog.getByRole("button", { name: "Appearance" }),
  ).toBeFocused();

  // React 的 shadcn dialog 把关闭按钮的名字写死成 "Close"，Vue 照抄（primitives.close）。
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await close.focus();
  await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await close.click();
  await expect(page).toHaveURL(
    /\/workspace\/chats\/new\?keep=files#run-anchor$/,
  );
  await expect(dialog).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/settings=appearance/);
  await expect(dialog).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(
    /\/workspace\/chats\/new\?keep=files#run-anchor$/,
  );
  await expect(dialog).toHaveCount(0);
});

test("settings-and-more exposes exactly the React product actions", async ({
  page,
}) => {
  mockThreads(page);
  await page.goto(`/workspace/chats/${THREAD_ID}`);
  await expect(page.getByRole("link", { name: "DeerFlow" })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings and more" }).click();
  const menu = page.getByRole("menu");

  await expect(menu.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "DeerFlow's official website" }),
  ).toHaveAttribute("href", "https://deerflow.tech/");
  await expect(
    menu.getByRole("menuitem", { name: "DeerFlow on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/bytedance/deer-flow");
  await expect(
    menu.getByRole("menuitem", { name: "Report an issue" }),
  ).toHaveAttribute("href", "https://github.com/bytedance/deer-flow/issues");
  await expect(
    menu.getByRole("menuitem", { name: "Contact us" }),
  ).toHaveAttribute("href", "mailto:support@deerflow.tech");
  await expect(
    menu.getByRole("menuitem", { name: "About DeerFlow" }),
  ).toBeVisible();
  await expect(menu.getByText("Light", { exact: true })).toHaveCount(0);
  await expect(menu.getByText("Dark", { exact: true })).toHaveCount(0);
  await expect(menu.getByText("EN", { exact: true })).toHaveCount(0);
  await expect(menu.getByText("简", { exact: true })).toHaveCount(0);
});

test("sidebar share/export and chats updated time use the real browser boundaries", async ({
  page,
}) => {
  mockThreads(page);
  await page.goto("/workspace/chats");
  /*
    列表页的标题来自面包屑，不是 h1——React 的 ChatsPage 只把标题写进 document.title，
    页面里唯一说得出"你在哪儿"的是 WorkspaceContainer 的面包屑。相对时间的措辞由
    date-fns 给出（"5 minutes ago"），不再包一层"Updated ..."：React 那边渲染的就是
    formatTimeAgo 的原样输出，多包一层，两个应用的链接可访问名就不是同一句话。
  */
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(
    breadcrumb.getByRole("link", { name: "Workspace" }),
  ).toBeVisible();
  await expect(breadcrumb.getByRole("link", { name: "Chats" })).toBeVisible();
  await expect(page.getByText(/^[45] minutes ago$/)).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          Reflect.set(globalThis, "__wp11Copied", text);
        },
      },
    });
  });
  const row = page
    .locator('[data-sidebar="menu-item"]')
    .filter({ hasText: "WP 11 conversation" });
  await row.getByRole("button", { name: "More" }).click();
  await page.getByTestId("thread-share").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Link copied" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(globalThis, "__wp11Copied")),
  ).toBe(`https://deer-flow-v2.vercel.app/workspace/chats/${THREAD_ID}`);

  /*
    「导出」是一层子菜单（React 的 DropdownMenuSub），两个格式在里面——不先展开就
    点不到。这一步不是测试的仪式，它正是这个菜单和一排平级动作的区别。
  */
  await row.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByTestId("thread-export-markdown").click();
  expect((await download).suggestedFilename()).toBe("WP 11 conversation.md");
  await expect(
    page.getByRole("status").filter({ hasText: "Conversation exported" }),
  ).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("denied")) },
    });
  });
  await row.getByRole("button", { name: "More" }).click();
  await page.getByTestId("thread-share").click();
  await expect(
    page.getByRole("alert").filter({ hasText: /failed to copy/i }),
  ).toBeVisible();

  await page.route(`**/api/langgraph/threads/${THREAD_ID}/state`, (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "thread state unavailable" },
    }),
  );
  await row.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Export", exact: true }).click();
  await page.getByTestId("thread-export-json").click();
  /*
    导出失败恒念 `common.exportFailed`，不透传 Gateway 的 detail——React 的 catch
    是裸的 `toast.error(t.common.exportFailed)`。把后端原文端到用户面前更好查问题，
    但那样两个应用在同一个 503 上念的不是一句话。
  */
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Failed to export conversation" }),
  ).toBeVisible();
});

test("workspace changes exposes truncated/status/reasons and retries detail errors", async ({
  page,
}) => {
  mockThreads(page);
  let detailAttempts = 0;
  await page.route(
    `**/api/threads/${THREAD_ID}/runs/${RUN_ID}/workspace-changes?*`,
    async (route) => {
      const detail =
        new URL(route.request().url()).searchParams.get("include_diff") ===
        "true";
      if (detail && detailAttempts++ === 0) {
        return route.fulfill({
          status: 409,
          json: { detail: "workspace snapshot expired" },
        });
      }
      return route.fulfill({ json: workspaceChangesFixture(detail) });
    },
  );

  await page.goto(`/workspace/chats/${THREAD_ID}`);
  await expect(page.getByText("Some changes were truncated.")).toBeVisible();
  // 折叠态的卡片只有「路径 + 增删数」，状态词在展开后的面板里——上游
  // `workspace-change-badge.tsx` 的 summary 行就是这样。此前两处都写，
  // 于是同一行在两个应用里读出来不是同一句。
  await expect(page.getByText("Modified", { exact: true })).toHaveCount(0);
  await page.getByTestId("workspace-changes-open").click();
  for (const status of ["Created", "Modified", "Deleted", "Symlink created"]) {
    await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
  }
  await expect(
    page.getByRole("alert").filter({ hasText: "workspace snapshot expired" }),
  ).toBeVisible();
  await page.getByTestId("workspace-changes-retry").click();

  /*
    **理由躺在折叠内容里，要先逐行展开。** 上游那一行是
    `<Collapsible defaultOpen={hasDiff}>`——没有 diff 的文件默认折叠，
    而 Radix / reka 的 CollapsibleContent 折叠时不渲染子节点。
    本仓原来把理由画在摘要行上（一直可见），wave 87 把这一屏接进对照取样面
    之后按上游改掉了；这里跟着改成「点开每一行再断言」，断言内容一个字没动。
  */
  const triggers = page.locator('[data-slot="collapsible-trigger"]');
  const triggerCount = await triggers.count();
  expect(triggerCount).toBeGreaterThan(0);
  for (let index = 0; index < triggerCount; index += 1) {
    const trigger = triggers.nth(index);
    if ((await trigger.getAttribute("data-state")) === "closed")
      await trigger.click();
  }

  for (const reason of [
    "Binary file. Diff unavailable.",
    "Large file. Diff omitted.",
    "Sensitive path. Content hidden.",
    "Diff omitted because the change set is too large.",
    "Symlink change. Diff unavailable.",
  ]) {
    await expect(page.getByText(reason, { exact: true })).toBeVisible();
  }
  expect(detailAttempts).toBe(2);
});

function workspaceChangesFixture(includeDiff: boolean) {
  const base = {
    root: "workspace",
    binary: false,
    sensitive: false,
    size_before: 1,
    size_after: 2,
    sha256_before: "before",
    sha256_after: "after",
    diff: includeDiff ? "" : "",
    diff_truncated: false,
    additions: 1,
    deletions: 1,
    symlink: false,
    symlink_target_before: null,
    symlink_target_after: null,
  };
  return {
    available: true,
    version: 1,
    summary: {
      created: 1,
      modified: 3,
      deleted: 1,
      symlink_created: 1,
      additions: 4,
      deletions: 2,
      truncated: true,
    },
    files: [
      {
        ...base,
        path: "/mnt/user-data/workspace/binary.bin",
        status: "created",
        binary: true,
        diff_unavailable_reason: "binary",
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/large.log",
        status: "modified",
        diff_unavailable_reason: "large",
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/secret",
        status: "deleted",
        sensitive: true,
        diff_unavailable_reason: "sensitive",
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/truncated.txt",
        status: "modified",
        diff_truncated: true,
        diff_unavailable_reason: "truncated",
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/modified.txt",
        status: "modified",
        diff_unavailable_reason: null,
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/link",
        status: "symlink_created",
        symlink: true,
        symlink_target_after: "modified.txt",
        diff_unavailable_reason: "symlink",
      },
    ],
    limits: {},
  };
}
