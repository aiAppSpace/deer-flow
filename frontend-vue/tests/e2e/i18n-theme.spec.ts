/*
  【文件职责】     locale/theme 的真实 Nuxt + Chromium 行为矩阵。
  【架构位置】     Vue-owned M7 Playwright
  【主要导出】     Playwright scenarios
  【依赖关系】     shared mock Gateway · app i18n/theme owners
  【边界与注意】   动态 Gateway/user/file 内容保持原样；公网与真实 IdP 不在本 gate。
*/

import { expect, test, type Page } from "@playwright/test";
import { openSettingsDialog } from "../support/settings-dialog";

import { mockLangGraphAPI } from "./utils/mock-api";
import { enUS } from "../../app/core/i18n/locales/en-US";
import { zhCN } from "../../app/core/i18n/locales/zh-CN";

const THREAD_ID = "00000000-0000-0000-0000-000000001212";
const ARTIFACT_PATH = "/mnt/user-data/outputs/wp12-report.md";

function prepare(page: Page) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: THREAD_ID,
        title: "dynamic title",
        messages: [
          { type: "human", id: "wp12-human", content: "用户动态内容 X12" },
          {
            type: "ai",
            id: "wp12-ai",
            content: "Backend dynamic content X12",
            tool_calls: [
              {
                id: "wp12-write",
                name: "write_file",
                args: { path: ARTIFACT_PATH, content: "# Heading" },
              },
            ],
          },
        ],
      },
    ],
    features: { agentsApiEnabled: true, browserControlEnabled: true },
  });
}

test("locale switch updates an open dialog, product surfaces, future errors and reload", async ({
  page,
}) => {
  prepare(page);
  // **不按名字锁**：这条用例随后会切语言，对话框的可访问名会跟着变。
  const dialog = await openSettingsDialog(
    page,
    `/workspace/chats/${THREAD_ID}?settings=appearance`,
  );
  await expect(dialog).toContainText(enUS.settings.appearance.themeTitle);
  /*
    语言选择器已经从原生 `<select>` 换成 shadcn 的 Select（与上游同一个 primitive）：
    没有 `selectOption` 可用，选项 portal 到 body 上，要先开触发器再点那一项。
  */
  await dialog.locator('[data-slot="select-trigger"]').click();
  await page.getByRole("option", { name: zhCN.locale.localName }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(dialog).toContainText(zhCN.settings.appearance.themeTitle);
  await expect(dialog).toContainText(zhCN.settings.appearance.darkDescription);
  expect(
    (await page.context().cookies()).find((cookie) => cookie.name === "locale")
      ?.value,
  ).toBe("zh-CN");

  /*
    关闭按钮的名字**在中文界面下也是英文**：React 把它写死在 shadcn dialog 里，
    对齐的判据是两边听到同一句（见 primitives.close 的词典注释）。
  */
  await dialog
    .getByRole("button", { name: zhCN.primitives.close, exact: true })
    .click();
  await expect(page.getByPlaceholder(zhCN.inputBox.placeholder)).toBeVisible();
  /*
    浏览器触发器的名字取 `common.showBrowser`（BrowserTrigger 就是这么写的，
    与上游 browser-trigger.tsx 同源）。此前这里写的是 `browser.trigger`——
    那条 key 已经没有任何产品消费者，它当时能过**只是因为两条 key 在 zh-CN 里
    恰好是同一串字**（都是「打开浏览器面板」）。wave 33 删掉那条死词条之后
    这里立刻 TypeError，反倒把这条巧合暴露了出来。
  */
  await expect(page.getByLabel(zhCN.common.showBrowser)).toBeVisible();
  // 面板不会自己打开（React 只在流式写入途中才自动打开），点一下产物路径。
  await page.getByText(ARTIFACT_PATH).click();
  /*
    **必须限定在面板头部里。** wave 62 给消息轮次的复制键也补上了可访问名
    （两边同改，上游同一屏也是两颗同名按钮），于是裸
    `page.getByLabel(zhCN.clipboard.copyToClipboard)` 会命中两个元素——
    strict mode violation。它在 wave 62/64 两次全跑里都碰巧绿了，
    绿不绿取决于轮次操作条那一刻有没有渲染出来：**典型的裸定位器定时炸弹。**
  */
  await expect(
    page
      .getByTestId("artifact-panel-header")
      .getByLabel(zhCN.clipboard.copyToClipboard),
  ).toBeVisible();
  const sidebar = page.locator("#workspace-sidebar");
  await expect(
    sidebar.getByRole("link", { name: zhCN.sidebar.agents }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: zhCN.sidebar.scheduledTasks }),
  ).toBeVisible();
  await expect(page.getByText("用户动态内容 X12")).toBeVisible();
  await expect(page.getByText("Backend dynamic content X12")).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("denied")) },
    });
  });
  /*
    上面点开了产物，于是侧栏被收起——React 在 artifacts context 的 select() 里做的
    就是这件事。会话列表在收起态下不渲染（React 的 WorkspaceSidebar 直接
    `{isSidebarOpen && <RecentChatList />}`），所以要先把侧栏展开回来。
    收起态的触发器要悬停头部才出现。
  */
  const sidebarPanel = page.locator("#workspace-sidebar");
  await sidebarPanel.locator('[data-sidebar="header"]').hover();
  await sidebarPanel.locator('[data-sidebar="trigger"]').click();
  const row = page
    .locator('[data-sidebar="menu-item"]')
    .filter({ hasText: "dynamic title" });
  await row.getByRole("button", { name: zhCN.common.more }).click();
  await page.getByTestId("thread-share").click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: zhCN.clipboard.failedToCopyToClipboard }),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByPlaceholder(zhCN.inputBox.placeholder)).toBeVisible();
});

test("persisted locale hydrates SSR and CSR routes without mismatches", async ({
  page,
}) => {
  prepare(page);
  const runtimeErrors: string[] = [];
  const captureRuntimeErrors = (target: Page) => {
    target.on("console", (message) => {
      if (message.type() === "error" || /hydrat/i.test(message.text())) {
        runtimeErrors.push(`[${message.type()}] ${message.text()}`);
      }
    });
    target.on("pageerror", (error) => runtimeErrors.push(error.message));
  };
  captureRuntimeErrors(page);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: enUS.marketing.badge }),
  ).toBeVisible();
  const workspaceCta = page.getByRole("link", {
    name: enUS.marketing.enterWorkspace,
  });
  await expect(workspaceCta).toHaveAttribute("href", "/workspace");
  await workspaceCta.click();
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  await expect(page.getByPlaceholder(enUS.inputBox.placeholder)).toBeVisible();
  await page.goto("/");
  expect(runtimeErrors.filter((message) => /hydrat/i.test(message))).toEqual(
    [],
  );
  runtimeErrors.length = 0;

  // A persisted preference exists before the next document request starts.
  // Injecting a cookie into an already-running renderer and immediately
  // reloading races Chromium's cross-process cookie propagation under load;
  // the separate UI-switch scenario above owns same-page mutation + reload.
  const context = page.context();
  await page.close();
  await context.addCookies([
    { name: "locale", value: "zh-CN", url: "http://localhost:3101" },
  ]);
  const localizedPage = await context.newPage();
  prepare(localizedPage);
  captureRuntimeErrors(localizedPage);

  await localizedPage.goto("/");
  await expect(localizedPage.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(
    localizedPage.getByRole("heading", { name: zhCN.marketing.badge }),
  ).toBeVisible();
  expect(runtimeErrors.filter((message) => /hydrat/i.test(message))).toEqual(
    [],
  );
  runtimeErrors.length = 0;

  await localizedPage.goto("/workspace/chats/new");
  await expect(
    localizedPage.getByPlaceholder(zhCN.inputBox.placeholder),
  ).toBeVisible();
  expect(runtimeErrors.filter((message) => /hydrat/i.test(message))).toEqual(
    [],
  );
});

test("invalid locale cookie safely falls back to the supported browser locale", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: "locale", value: "xx-invalid", url: "http://localhost:3101" },
    ]);
  prepare(page);
  await page.goto("/workspace/chats/new");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByPlaceholder(enUS.inputBox.placeholder)).toBeVisible();
});

test("system theme follows light-dark-light media changes in the running app", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("theme", "system"));
  prepare(page);
  await page.goto("/workspace/chats/new");
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("explicit theme ignores media, returning to system resyncs, and reload initializes early", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  prepare(page);
  const dialog = await openSettingsDialog(
    page,
    "/workspace/chats/new?settings=appearance",
    enUS.settings.title,
  );
  await dialog.locator('[data-theme-preference="dark"]').click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.emulateMedia({ colorScheme: "dark" });
  await dialog.locator('[data-theme-preference="system"]').click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "system",
  );

  await page.evaluate(() => localStorage.setItem("theme", "sepia"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "system",
  );
});

test("the React-equivalent root route is forced dark without overwriting the saved preference", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  prepare(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "light",
  );

  await page.goto("/workspace/chats/new");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "light",
  );
});

/*
  基础层与工具类的**级联层次序**。

  Tailwind 4 把工具类放进 `@layer utilities`，而**不属于任何层的作者样式优先级高于
  所有层**。所以 `main.css` 里的 `* { border-color: var(--border) }` 一旦裸写在顶层，
  就会把全仓每一个 `border-<颜色>` 工具类盖掉，跟具体度无关——实测过一次：
  `<div class="border-destructive">` 算出来是 `--border` 而不是红色，
  而上游同一份 class 是红的（wave 32）。

  这条断言要在**真实浏览器 + 真实构建**里做：源码里那条 `@layer base` 只能证明
  写法对了，证不了打包之后层序仍然对。对照台账也看不到它——`sampleGeometry`
  取的是 color / background / fontSize，**不取 borderColor**，边框宽度又没变。
*/
test("utility border colors win over the base layer", async ({ page }) => {
  prepare(page);
  await page.goto("/workspace/chats/new");
  await expect(page.locator("textarea[name='message']")).toBeVisible();

  const measured = await page.evaluate(() => {
    const read = (className: string) => {
      const probe = document.createElement("div");
      probe.className = className;
      document.body.append(probe);
      const value = globalThis.getComputedStyle(probe).borderTopColor;
      probe.remove();
      return value;
    };
    const token = (name: string) => {
      const probe = document.createElement("div");
      probe.style.borderTopColor = `var(${name})`;
      document.body.append(probe);
      const value = globalThis.getComputedStyle(probe).borderTopColor;
      probe.remove();
      return value;
    };
    return {
      base: read(""),
      destructive: read("border-destructive"),
      input: read("border-input"),
      transparent: read("border-transparent"),
      borderToken: token("--border"),
      destructiveToken: token("--destructive"),
      inputToken: token("--input"),
    };
  });

  // 没有工具类时落到基础层的 --border……
  expect(measured.base).toBe(measured.borderToken);
  // ……有工具类时工具类赢，而且赢成它自己那个 token 的颜色。
  expect(measured.destructive).toBe(measured.destructiveToken);
  expect(measured.input).toBe(measured.inputToken);
  expect(measured.transparent).toBe("rgba(0, 0, 0, 0)");
  // 三个 token 互不相同，否则上面三条会同时成立却什么都没证明。
  expect(
    new Set([
      measured.borderToken,
      measured.destructiveToken,
      measured.inputToken,
    ]).size,
  ).toBe(3);

  /*
    另一半：把基础层挪进 @layer 之后，**没有写 focus 工具类的元素仍然有焦点轮廓**。
    这一条是本仓比上游多的一层保护（上游 `* { outline-ring/50 }` 只给颜色，
    样式靠浏览器默认），这次改动只让写了 `outline-none` 的元素赢回自己的写法，
    不该把这层保护一起冲掉。

    用 `<input>` 而不是 `<a>`/`<button>`：Chromium 只对「接受键盘输入」的元素在
    程序化 focus 时也匹配 `:focus-visible`，链接和按钮要真的按 Tab 才算。
  */
  const bareOutline = await page.evaluate(() => {
    const probe = document.createElement("input");
    document.body.append(probe);
    probe.focus();
    const style = globalThis.getComputedStyle(probe);
    const value = `${style.outlineStyle} ${style.outlineWidth}`;
    probe.remove();
    return value;
  });
  expect(bareOutline).toBe("solid 2px");

  /*
    上游 `* { @apply border-border outline-ring/50 }` 的**后半句**：给每个元素一个
    默认的 outline 颜色。没有它时 `outline-color` 落到 `currentColor`——写了
    `outline-none` 的元素看不出区别（样式是 none），但任何自己开 outline 却不指定
    颜色的地方会拿到文字色而不是 ring 色。
  */
  const outlineColor = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.color = "rgb(1, 2, 3)";
    document.body.append(probe);
    const style = globalThis.getComputedStyle(probe);
    const value = { outline: style.outlineColor, text: style.color };
    probe.remove();
    return value;
  });
  expect(outlineColor.outline).not.toBe(outlineColor.text);
});
