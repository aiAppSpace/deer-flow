/*
  【文件职责】     钉住 artifacts 域在可访问性树里的形状：面板是什么地标、入口是什么尺寸、
                   哪些控件有名字、选中一个产物之后工作区长什么样。
  【架构位置】     产品合同套件（tests/e2e，自带 route mock）
  【主要导出】     无；Playwright 用例
  【边界与注意】   与 chat-a11y-shape.spec.ts 同一个理由：这些形状是照着
                   `frontend/src/components/workspace/artifacts/**` 与 `chats/chat-box.tsx`
                   对齐出来的，而验证它们的 e2e-parity 需要兄弟应用 ../frontend 在
                   checkout 里，本仓的常规门禁不依赖它。不在这里再钉一份的话，
                   一个只跑本仓门禁的改动可以把它们逐条改回去而全绿。

                   钉的是角色、可访问名、尺寸合同与结构，不是 class 名。
*/

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

const ARTIFACT_PATH = "/mnt/user-data/outputs/report.md";
const WRITE_FILE_PATH = "/mnt/user-data/outputs/draft.html";

function openThreadWithArtifacts(page: Page) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Artifact shape",
        artifacts: [ARTIFACT_PATH],
        messages: [
          {
            type: "human",
            id: "shape-human",
            content: [{ type: "text", text: "Create a markdown report" }],
          },
          {
            type: "ai",
            id: "shape-ai",
            content: "Created a markdown report.",
          },
        ],
      },
    ],
  });
  return page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
}

function openThreadWithWriteFile(page: Page) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Artifact draft shape",
        messages: [
          {
            type: "human",
            id: "draft-human",
            content: [{ type: "text", text: "Create a report artifact" }],
          },
          {
            type: "ai",
            id: "draft-ai",
            content: "",
            tool_calls: [
              {
                id: "draft-write",
                name: "write_file",
                args: {
                  description: "Writing report artifact",
                  path: WRITE_FILE_PATH,
                  content:
                    "<!doctype html><html><body><h1>Report draft</h1></body></html>",
                },
              },
            ],
          },
        ],
      },
    ],
  });
  return page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
}

test.describe("artifacts accessibility shape", () => {
  test("the header entry is a default-size button, not a compact one", async ({
    page,
  }) => {
    await openThreadWithArtifacts(page);

    const trigger = page.getByTestId("artifact-trigger");
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    // React 的 ArtifactTrigger 用的是不传 size 的 Button：h-9 / text-sm。
    // 它右对齐在头部，矮 4px 就会让同一行里它左边的每个控件都错位。
    await expect(trigger).toHaveAttribute("data-size", "default");
    await expect(trigger).toHaveCSS("height", "36px");
    await expect(trigger).toHaveCSS("font-size", "14px");
  });

  test("the open panel is a complementary landmark on desktop", async ({
    page,
  }) => {
    await openThreadWithArtifacts(page);
    await page.getByTestId("artifact-trigger").click();

    // React 的右侧面板是 `<aside id="artifacts">`，**没有** role——宽屏上它是并排的
    // 第二栏，聊天区依然可达。报成 dialog 等于告诉用户其余内容不可用。
    await expect(page.getByRole("complementary")).toHaveCount(1);
    await expect(page.getByRole("dialog", { name: "Artifacts" })).toHaveCount(
      0,
    );
  });

  test("the entry opens the file list instead of picking a file", async ({
    page,
  }) => {
    let contentRequests = 0;
    await page.route("**/api/threads/*/artifacts/**", (route) => {
      contentRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: "text/markdown",
        body: "# report",
      });
    });
    await openThreadWithArtifacts(page);
    await page.getByTestId("artifact-trigger").click();

    const overview = page.getByTestId("artifact-overview");
    // React 那一支的标题是 `<h2>`：地标之外，读屏器靠标题层级在面板里跳转。
    await expect(overview.locator("h2")).toHaveText("Artifacts");
    await expect(overview.getByText("report.md")).toBeVisible();
    await expect(overview.getByText("Markdown file")).toBeVisible();
    await expect(
      overview.getByRole("link", { name: "Download" }),
    ).toHaveAttribute(
      "href",
      /\/artifacts\/mnt\/user-data\/outputs\/report\.md\?download=true$/,
    );
    // 清单是 ul 里的卡片，卡片不是 li：React 的 ArtifactFileList 就是这个形状，
    // 读屏器听到的是一个没有条目的 list。
    await expect(overview.locator("ul > li")).toHaveCount(0);
    // 没选中文件就不该去拉内容——自动选中会替用户发一次他没要过的请求。
    expect(contentRequests).toBe(0);

    await overview.getByText("report.md").click();
    await expect(page.locator("#artifacts")).toBeVisible();
    /*
      **反空转：上面那条 `toBe(0)` 需要一条肯定断言配对。**

      第四十九轮的前提变异量出来的：把上面那条计数路由整个拿掉，这条用例
      **12 条仍然全绿**——因为 `contentRequests` 恒为 0，缺席断言恒真。
      也就是说，哪天产物内容换了端点、或者这条路由的 pattern 不再匹配，
      「没选中不拉内容」这条守卫会**静默失效**，而且是绿的。

      选中之后必须真的去拉一次，这条才证明观测器还接在被测行为上。
      ⚠ 用 `expect.poll`：点击到发出请求之间隔着一次 Vue 的更新与 fetch 排队。
    */
    await expect
      .poll(() => contentRequests, {
        message:
          "选中文件之后应当真的去拉一次内容——恒 0 说明上面那条计数路由已经没接在任何东西上",
      })
      .toBeGreaterThan(0);
  });

  test("panel actions carry React's generic names", async ({ page }) => {
    await openThreadWithWriteFile(page);

    const path = page.getByText(WRITE_FILE_PATH);
    await expect(path).toBeVisible({ timeout: 15_000 });
    await path.click();

    const panel = page.locator("#artifacts");
    await expect(
      panel.getByLabel("Copy to clipboard", { exact: true }),
    ).toBeVisible();
    await expect(panel.getByLabel("Close", { exact: true })).toBeVisible();
    await expect(panel.getByLabel("Copy artifact")).toHaveCount(0);
    await expect(panel.getByLabel("Close artifacts")).toHaveCount(0);

    // 代码 / 预览是一对单选，不是一颗会改名字的开关；两个都只有图标、没有名字。
    const group = panel.getByRole("group");
    await expect(group.getByRole("radio")).toHaveCount(2);
    await expect(group.getByRole("radio", { checked: true })).toHaveCount(1);
    await expect(panel.getByLabel("Show code")).toHaveCount(0);
    await expect(panel.getByLabel("Show preview")).toHaveCount(0);
  });

  test("selecting an artifact collapses the workspace sidebar", async ({
    page,
  }) => {
    // 用「线程带产物」这一支而不是 write_file 草稿：草稿会在进入线程时自动选中，
    // 那样就量不到「选中之前侧栏是展开的」。
    await openThreadWithArtifacts(page);

    const sidebar = page.locator("#workspace-sidebar");
    await expect(sidebar).toHaveCSS("width", "256px");

    await page.getByTestId("artifact-trigger").click();
    await expect(sidebar).toHaveCSS("width", "256px");
    await page.getByTestId("artifact-overview").getByText("report.md").click();

    // React 在 artifacts context 的 select() 里调 setSidebarOpen(false)：面板一展开，
    // 收起侧栏是把宽度还给正文。收起态下会话列表整块不渲染，Logo 只剩 "DF"。
    await expect(sidebar).toHaveCSS("width", "48px");
    await expect(sidebar.getByText("DF", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Recent chats")).toHaveCount(0);
    // 收起态的触发器是 display:none，直到悬停头部才出现。
    await expect(sidebar.locator('[data-sidebar="trigger"]')).toBeHidden();
    // **wave 62 反过来了，两边同改**：收起态这颗触发器只渲染一个 settings 图标，
    // 上游同样没给名字（workspace-nav-menu.tsx 的 SidebarMenuButton 既不传
    // tooltip 也没有 aria-label），读屏器只念得出一颗「按钮」。现在两边都念
    // workspace.settingsAndMore——**展开态显示的就是这一句，可访问名与可见名一致**。
    await expect(
      page.getByTestId("workspace-nav-menu-trigger"),
    ).toHaveAccessibleName("Settings and more");
  });

  test("a finished write_file in history does not open the panel by itself", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Finished draft",
          messages: [
            {
              type: "human",
              id: "done-human",
              content: [{ type: "text", text: "Create a report artifact" }],
            },
            {
              type: "ai",
              id: "done-ai",
              content: "",
              tool_calls: [
                {
                  id: "done-write",
                  name: "write_file",
                  args: {
                    description: "Writing report artifact",
                    path: WRITE_FILE_PATH,
                    content: "<!doctype html><html><body>ok</body></html>",
                  },
                },
              ],
            },
            {
              type: "tool",
              id: "done-tool",
              name: "write_file",
              tool_call_id: "done-write",
              content: "OK",
            },
          ],
        },
      ],
    });
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(page.getByText(WRITE_FILE_PATH)).toBeVisible({
      timeout: 15_000,
    });

    /*
      React 只在两种情况下自动打开：这一轮**还在流式**且 write_file 尚未返回，
      或者最后一步是成功的 finalize_artifact_write
      （messages/message-group.tsx 的 autoOpenArtifactUrl）。翻一条跑完的历史线程
      两条都不满足，面板不该自己弹出来——它一弹出来还会顺手把侧栏收起，用户什么
      都没点，工作区却换了个样子。
    */
    await expect(page.locator("#artifacts")).toBeHidden();
    await expect(page.locator("#workspace-sidebar")).toHaveCSS(
      "width",
      "256px",
    );
  });

  test("a successful finalize_artifact_write does open the panel by itself", async ({
    page,
  }) => {
    await page.route("**/api/threads/*/artifacts/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/markdown",
        body: "# finalized",
      }),
    );
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Finalized artifact",
          artifacts: [ARTIFACT_PATH],
          messages: [
            {
              type: "human",
              id: "final-human",
              content: [{ type: "text", text: "Create a markdown report" }],
            },
            {
              type: "ai",
              id: "final-ai",
              content: "",
              tool_calls: [
                {
                  id: "final-write",
                  name: "finalize_artifact_write",
                  args: {
                    description: "Finalizing report",
                    path: ARTIFACT_PATH,
                  },
                },
              ],
            },
            {
              type: "tool",
              id: "final-tool",
              name: "finalize_artifact_write",
              tool_call_id: "final-write",
              content: "OK",
            },
          ],
        },
      ],
    });
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

    // 这一支 React 不要求还在流式：产物已经落地，面板自己打开。
    const panel = page.locator("#artifacts");
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText("report.md")).toBeVisible();
  });

  test("narrow screens swap the panel for a real modal sheet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // 用草稿那一支：面板里只有详情，不会再多一个清单自己的 "Artifacts" 标题，
    // 断言才能落在 Sheet 的标题上。
    await openThreadWithWriteFile(page);
    const path = page.getByText(WRITE_FILE_PATH);
    await expect(path).toBeVisible({ timeout: 15_000 });
    await path.click();

    /*
      窄屏是 Sheet，不是铺满屏幕的同一个 aside——React 的 isMobile 分支换的是整套实现
      （chats/chat-box.tsx）。Sheet 是真模态：面板之外的内容被标成不可达。原来 Vue 只是
      把侧栏 fixed 铺满，读屏器还能从"抽屉"里走回背后的对话。
    */
    const dialog = page.getByRole("dialog", { name: "Artifacts" });
    await expect(dialog).toBeVisible();
    // 标题与说明都在，只是 sr-only：React 的 SheetHeader 就是这个形状。
    await expect(
      dialog.getByRole("heading", { name: "Artifacts", level: 2 }),
    ).toBeAttached();
    await expect(
      dialog.getByText("Browse the side panel for this conversation."),
    ).toBeAttached();
    // 宽屏那套的两个锚点在窄屏都不该存在。
    await expect(page.locator("aside#artifacts")).toHaveCount(0);
    await expect(page.getByRole("complementary")).toHaveCount(0);
    /*
      背后的对话不可达。断言走**角色**而不是属性选择器：aria-hidden 的元素还在 DOM 里，
      `getByPlaceholder` 照样找得到，只有按角色查询才反映读屏器真正能到达什么。
    */
    await expect(page.getByRole("log")).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: /how can i assist you/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Submit" })).toHaveCount(0);
  });

  test("the panel keeps sidecar above browser above artifacts", async ({
    page,
  }) => {
    await openThreadWithArtifacts(page);
    await page.getByTestId("artifact-trigger").click();
    await expect(page.getByTestId("artifact-overview")).toBeVisible();

    // React 的 activeRightPanel 顺序是 sidecar > browser > artifacts
    // （chats/chat-box.tsx）。浏览器面板一开就盖住 artifacts。
    await page.getByTestId("browser-trigger").click();
    await expect(page.getByTestId("artifact-overview")).toHaveCount(0);
  });

  test("the write_file step is one clickable region, not a pair of buttons", async ({
    page,
  }) => {
    await openThreadWithWriteFile(page);

    const step = page.locator('[data-tool-name="write_file"]');
    await expect(step).toBeVisible({ timeout: 15_000 });
    // React 的 ChainOfThoughtStep 是带 onClick 的 div，标签是 div、路径是 Badge。
    // 各做一个 button 会在树里多出两颗控件，而且两个 inline 元素会挤在同一行。
    await expect(step.getByRole("button")).toHaveCount(0);
    await expect(step.getByText(WRITE_FILE_PATH)).toHaveJSProperty(
      "tagName",
      "SPAN",
    );
  });

  test("the html preview inlines its resources and keeps scroll across rebuilds", async ({
    page,
  }) => {
    const HTML_PATH = "/mnt/user-data/outputs/page.html";
    const IMAGE_PATH = "/mnt/user-data/outputs/pic.png";
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    let imageRequests = 0;
    await page.route("**/api/threads/*/artifacts/**", (route) => {
      const url = decodeURIComponent(route.request().url());
      if (url.includes("pic.png")) {
        imageRequests += 1;
        return route.fulfill({
          status: 200,
          contentType: "image/png",
          body: pixel,
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        headers: { ETag: `"${"c".repeat(64)}"` },
        body: `<!doctype html><html><body><img src="pic.png" /><p>preview</p></body></html>`,
      });
    });
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Html preview",
          artifacts: [HTML_PATH, IMAGE_PATH],
          messages: [
            {
              type: "human",
              id: "html-human",
              content: [{ type: "text", text: "Build a page" }],
            },
            { type: "ai", id: "html-ai", content: "Built it." },
          ],
        },
      ],
    });
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await page.getByTestId("artifact-trigger").click();
    await page.getByTestId("artifact-overview").getByText("page.html").click();

    const frame = page.locator("iframe[title='Artifact preview']");
    await expect(frame).toBeVisible();

    /*
      预览走的是 blob URL，不是 srcdoc。这不是实现口味：sandbox 没有 allow-same-origin，
      srcdoc 的 iframe 是不透明源，里面对 /api/threads/…/artifacts/… 的请求带不上
      cookie，私有产物里的图片一律 401。React 因此先把同源产物取下来内联成 data URL
      （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx）。
    */
    await expect(frame).toHaveAttribute("src", /^blob:/);
    await expect(frame).not.toHaveAttribute("srcdoc", /.*/);
    // 图片是被**外层**取走内联的，所以它至少被请求过一次。
    await expect.poll(() => imageRequests).toBeGreaterThan(0);

    // 注入的滚动恢复脚本随内容一起进 blob，流式重建时位置才不会归零。
    const previewHtml = await frame.evaluate(async (element) => {
      const src = (element as HTMLIFrameElement).src;
      return await (await fetch(src)).text();
    });
    expect(previewHtml).toContain("deerflow-artifact-preview-scroll");
    expect(previewHtml).toContain("data:image/png;base64,");
  });

  test("the user bubble owns its own hover toolbar", async ({ page }) => {
    await openThreadWithArtifacts(page);

    const bubble = page.locator('[data-role="human"]').first();
    await expect(bubble).toBeVisible({ timeout: 15_000 });
    await expect(bubble).toHaveCSS("position", "relative");

    // 工具条挂在气泡上而不是挂在 section#chat 上：挂错了它会跑到聊天区右下角，
    // 还会把面板撑出 28px 的可滚动溢出。
    const bubbleBox = (await bubble.boundingBox())!;
    const toolbarBox = (await bubble.locator("> div").last().boundingBox())!;
    expect(toolbarBox.y).toBeGreaterThan(bubbleBox.y);
    expect(toolbarBox.y).toBeLessThan(bubbleBox.y + bubbleBox.height + 48);

    /*
      聊天区几乎不能有可滚动溢出。React 那边只有输入框上方那条 `-bottom-[17px]`
      的渐隐层多出 1px；工具条挂错祖先时这里是 28px，而那 28px 会让本该
      overflow:hidden 的面板变得可滚动，一次焦点变化就把整个聊天区推上去。
    */
    const chatOverflow = await page.evaluate(() => {
      const chat = document.querySelector("#chat");
      return chat ? chat.scrollHeight - chat.clientHeight : -1;
    });
    expect(chatOverflow).toBeLessThanOrEqual(1);
    expect(chatOverflow).toBeGreaterThanOrEqual(0);
  });
});
