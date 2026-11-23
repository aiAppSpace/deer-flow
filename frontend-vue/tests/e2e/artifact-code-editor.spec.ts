/*
  【文件职责】     证明 artifact 编辑器在真实浏览器里是一个带语法高亮、跟随主题、
                   可键盘保存的代码编辑器，而不只是一个能改字的框。
  【架构位置】     浏览器合同测试（mock Gateway）
  【主要导出】     无；Playwright cases
  【依赖关系】     ArtifactPanel · ArtifactEditor · ui/code-editor
  【边界与注意】   单测已经用真实 EditorView 钉住了接线；这里补的是单测证明不了的三件事：
                   语法 chunk 真的经 HTTP 加载并渲染出 token、prefers-color-scheme
                   变化真的会重着色、以及 Mod-S 走的是**同一条** revision 保存路径。
*/

import { expect, test } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";
import { artifactEditorInput } from "../support/artifact-editor";

const THREAD_ID = "00000000-0000-0000-0000-000000004370";
const PYTHON_PATH = "/mnt/user-data/outputs/analysis.py";
const TEXT_PATH = "/mnt/user-data/outputs/notes.txt";
const SHA = "a".repeat(64);
const NEXT_SHA = "b".repeat(64);
const PYTHON_SOURCE = "def total(rows):\n    return sum(rows)\n";

function presentedMessages(paths: string[]) {
  return [
    {
      type: "human",
      id: "msg-human-editor",
      content: [{ type: "text", text: "Write the analysis" }],
    },
    {
      type: "ai",
      id: "msg-ai-editor",
      content: "Done.",
      tool_calls: [
        {
          id: "present-editor-artifact",
          name: "present_files",
          args: { filepaths: paths },
        },
      ],
    },
  ];
}

type Put = { url: string; body: unknown };

async function openEditor(
  page: import("@playwright/test").Page,
  options: { path?: string; body?: string; contentType?: string } = {},
) {
  const puts: Put[] = [];
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: THREAD_ID,
        title: "Artifact code editor",
        messages: presentedMessages([options.path ?? PYTHON_PATH]),
        artifacts: [options.path ?? PYTHON_PATH],
      },
    ],
  });
  await page.route(`**/api/threads/${THREAD_ID}/artifacts/**`, (route) => {
    if (route.request().method() === "PUT") {
      puts.push({
        url: decodeURIComponent(route.request().url()),
        body: route.request().postDataJSON(),
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          path: options.path ?? PYTHON_PATH,
          sha256: NEXT_SHA,
          size: 1,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: options.contentType ?? "text/x-python",
      headers: { ETag: `"${SHA}"` },
      body: options.body ?? PYTHON_SOURCE,
    });
  });

  await page.goto(`/workspace/chats/${THREAD_ID}`);
  const basename = (options.path ?? PYTHON_PATH).split("/").pop() as string;
  await expect(page.getByText(basename)).toBeVisible({ timeout: 15_000 });
  await page.getByText(basename).first().click();
  const panel = page.locator("#artifacts");
  await panel.getByLabel("Edit", { exact: true }).click();
  const editor = artifactEditorInput(panel);
  await expect(editor).toBeVisible();
  return { panel, editor, puts };
}

test.describe("artifact code editor", () => {
  test("opens an unnamed, focused editor with rendered syntax tokens", async ({
    page,
  }) => {
    const { editor } = await openEditor(page);

    /*
      编辑区**没有可访问名**：React 的 CodeEditor 不传 aria-label，CodeMirror 那个
      textbox 在树里就是一个没有名字的输入框
      （frontend/src/components/workspace/code-editor.tsx）。
    */
    await expect(editor).not.toHaveAttribute("aria-label", /.*/);
    await expect(editor).toHaveAttribute("contenteditable", "true");
    // autofocus 属于编辑器：点了 Edit 之后还要再点一次正文才能打字，等于没进编辑态。
    await expect(editor).toBeFocused();

    /*
      纯文本文档里 CodeMirror 直接渲染文本节点；只有语法高亮把行拆成
      token 时才会出现 span。所以「有带 class 的 span」正好等价于
      「语法 chunk 加载成功并且真的着色了」。
    */
    const tokens = editor.locator("span[class]");
    await expect(tokens.first()).toBeVisible();
    expect(await tokens.count()).toBeGreaterThan(1);
    await expect(editor).toContainText("def total(rows):");
  });

  test("leaves an unsupported language editable as plain text", async ({
    page,
  }) => {
    const { editor } = await openEditor(page, {
      path: TEXT_PATH,
      body: "plain notes\n",
      contentType: "text/plain",
    });

    await expect(editor).toContainText("plain notes");
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor.locator("span[class]")).toHaveCount(0);
  });

  test("recolours tokens when the system theme flips", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    const { editor } = await openEditor(page);

    const keyword = editor.locator("span[class]").first();
    const light = await keyword.evaluate(
      (node) => globalThis.getComputedStyle(node).color,
    );

    await page.emulateMedia({ colorScheme: "dark" });
    await expect
      .poll(() =>
        keyword.evaluate((node) => globalThis.getComputedStyle(node).color),
      )
      .not.toBe(light);
    // 换色不是重建：文档内容必须原样留在编辑器里。
    await expect(editor).toContainText("def total(rows):");
  });

  test("saves the edited draft through the same revision PUT from the keyboard", async ({
    page,
  }) => {
    const { panel, editor, puts } = await openEditor(page);

    /*
      本套件用 `devices["Desktop Chrome"]`，它带的是一个 **Windows** UA，
      所以页面里 `navigator.platform` 是 Win32，CodeMirror 把 `Mod` 解析成
      Ctrl。而 Playwright 的 `ControlOrMeta` 按**宿主**系统解析，在 macOS 上
      是 Meta——两边对不上，按键就静静地什么都不做。
      按页面自己报告的平台取修饰键，跟 CodeMirror 用的是同一条规则。
    */
    const mod = (await page.evaluate(() => /Mac/.test(navigator.platform)))
      ? "Meta"
      : "Control";

    await editor.press(`${mod}+a`);
    await editor.pressSequentially("value = 1\n");
    await expect(panel.getByLabel("Save", { exact: true })).toBeEnabled();

    await editor.press(`${mod}+s`);
    await expect(panel.getByLabel("Save", { exact: true })).toBeDisabled();
    await expect(editor).toHaveText("value = 1");

    expect(puts).toHaveLength(1);
    expect(puts[0]?.url).toContain(
      "/artifacts/mnt/user-data/outputs/analysis.py",
    );
    expect(puts[0]?.body).toEqual({
      content: "value = 1\n",
      expected_sha256: SHA,
    });
  });
});
