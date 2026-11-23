import { type Locator, type Page, expect, test } from "@playwright/test";

import { settledBox } from "../support/settled-box";
import { mockLangGraphAPI } from "./utils/mock-api";

const ARTIFACT_PATH = "/artifact-fixtures/report.html";
const THREAD_ID = "00000000-0000-0000-0000-000000003125";

function writeFileMessages() {
  return [
    {
      type: "human",
      id: "msg-human-artifact",
      content: [{ type: "text", text: "Create a report artifact" }],
    },
    {
      type: "ai",
      id: "msg-ai-write-artifact",
      content: "",
      tool_calls: [
        {
          id: "write-file-artifact",
          name: "write_file",
          args: {
            description: "Writing report artifact",
            path: ARTIFACT_PATH,
            content:
              "<!doctype html><html><body><h1>Report draft</h1></body></html>",
          },
        },
      ],
    },
    {
      type: "tool",
      id: "msg-tool-write-artifact",
      name: "write_file",
      tool_call_id: "write-file-artifact",
      content: "OK",
    },
  ];
}

async function panelWidth(panel: Locator): Promise<number> {
  return (await panel.boundingBox())?.width ?? 0;
}

async function expectNoPaneGeometryTransition(page: Page) {
  const metrics = await page.evaluate(() => {
    const pane = document.querySelector("#artifacts")?.closest("[data-panel]");
    if (!(pane instanceof HTMLElement))
      throw new Error("The physical resizable pane was not found.");
    const style = getComputedStyle(pane);
    const properties = style.transitionProperty
      .split(",")
      .map((value) => value.trim());
    const durations = style.transitionDuration.split(",").map((value) => {
      const duration = Number.parseFloat(value);
      return value.trim().endsWith("ms") ? duration : duration * 1000;
    });
    return {
      property: style.transitionProperty,
      duration: style.transitionDuration,
      activeGeometryTransitions: properties.filter(
        (property, index) =>
          /^(all|width|height|flex-grow|flex-basis)$/.test(property) &&
          (durations[index % durations.length] ?? 0) > 0,
      ),
    };
  });
  await test.info().attach("resize-pane-transition", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  expect(metrics.activeGeometryTransitions, JSON.stringify(metrics)).toEqual(
    [],
  );
}

async function dragPanel(handle: Locator, ...deltas: number[]): Promise<void> {
  const page = handle.page();
  // 停稳了才量得准——为什么、以及量到过多大的代价，见 settled-box.ts 的文件头。
  const box = await settledBox(handle, "分隔条");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const mouse = page.mouse;
  await mouse.move(x, y);
  await mouse.down();
  try {
    let currentX = x;
    for (const [index, delta] of deltas.entries()) {
      currentX += delta;
      await mouse.move(currentX, y, { steps: 10 });
      /*
      **第一次移动之后就确认真的抓住了。** 没抓住时后面每一步都照跑不误，
      最后由「面板没关」这类断言在 10 秒后报出来——那条消息指着面板，
      而真正的问题在按下那一行。

      判据取真实 captured handle 的公开 `data-state="drag"`。
      原生 pointerdown 开始本实例手势，后续 pointermove 必须仍由该 handle 消费。
    */
      if (index === 0) {
        await expect(
          handle,
          `按在 (${Math.round(x)}, ${Math.round(y)}) 没抓住分隔条——它的命中区只有 16px 宽`,
        ).toHaveAttribute("data-state", "drag", { timeout: 2_000 });
      }
      await expectNoPaneGeometryTransition(page);
    }
  } finally {
    await mouse.up();
  }
}

async function ensureArtifactOpen(page: Page): Promise<Locator> {
  const path = page.getByText(ARTIFACT_PATH);
  await expect(path).toBeVisible({ timeout: 15_000 });
  const panel = page.locator("#artifacts");
  if (!(await panel.isVisible())) await path.click();
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("Vue artifacts panel resize", () => {
  test.beforeEach(async ({ page }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: THREAD_ID,
          title: "Artifact panel resize",
          messages: writeFileMessages(),
        },
      ],
    });
    await page.goto(`/workspace/chats/${THREAD_ID}`);
  });

  test("the native separator resizes the artifacts panel", async ({ page }) => {
    const panel = await ensureArtifactOpen(page);
    const separator = page.getByRole("separator");
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute("aria-orientation", "vertical");

    const widthBefore = await panelWidth(panel);
    await dragPanel(separator, -200);
    await expect
      .poll(() => panelWidth(panel))
      .toBeGreaterThan(widthBefore + 100);
  });

  test("drag-collapse closes the panel and selecting the artifact reopens it", async ({
    page,
  }) => {
    const panel = await ensureArtifactOpen(page);
    const separator = page.getByRole("separator");
    await dragPanel(separator, 500);

    await expect(panel).toBeHidden();
    // 关掉之后分隔线**留在树里**并标 disabled（与 React 的 ResizableHandle 一致），
    // 只是画不出来也拖不动；把它整个摘掉，读屏器就再也说不出这里本来有一条分隔线。
    await expect(separator).toHaveAttribute("aria-disabled", "true");
    await expect(separator).toHaveCSS("opacity", "0");
    /*
      关着的时候还要**退出 Tab 序**：它此时 `opacity: 0` 且 `pointer-events: none`，
      鼠标用户完全感知不到，而 closed handle 的 `tabindex="0"` 会让纯键盘用户
      Tab 进一个看不见、也没有焦点环的地方（WCAG 2.4.7）。
      wave 96 给对照加上「能不能 tab 到」那一档才量出来：本仓**每一屏**都多一个
      这样的停靠点，而上游只在面板真的展开时才渲染 resizable-handle。
    */
    await expect(separator).toHaveAttribute("tabindex", "-1");
    await page.getByText(ARTIFACT_PATH).click();
    await expect(panel).toBeVisible();

    const groupWidth = await panelWidth(page.locator(".workspace-panels"));
    await expect
      .poll(() => panelWidth(panel))
      .toBeGreaterThan(groupWidth * 0.19);
  });

  test("reversing a collapse drag before release keeps the panel open", async ({
    page,
  }) => {
    const panel = await ensureArtifactOpen(page);
    const separator = page.getByRole("separator");
    await dragPanel(separator, 500, -500);

    await expect(panel).toBeVisible();
    await expect(panel.getByText("report.html")).toBeVisible();
    await expect(separator).toBeVisible();
    await expect(separator).not.toHaveAttribute("aria-disabled", "true");
    // 开着的时候它可见、可拖、方向键也能调宽度，本来就该在 Tab 序里。
    await expect(separator).toHaveAttribute("tabindex", "0");
  });

  test("a released width is kept when the panel is reopened", async ({
    page,
  }) => {
    const panel = await ensureArtifactOpen(page);
    const separator = page.getByRole("separator");
    const widthBefore = await panelWidth(panel);
    await dragPanel(separator, -200);
    await expect
      .poll(() => panelWidth(panel))
      .toBeGreaterThan(widthBefore + 100);
    const widthAfterDrag = await panelWidth(panel);

    await panel.getByRole("button", { name: /close/i }).first().click();
    await expect(panel).toBeHidden();
    await page.getByText(ARTIFACT_PATH).click();
    await expect(panel).toBeVisible();
    await expect
      .poll(() => panelWidth(panel))
      .toBeGreaterThan(widthAfterDrag - 20);
  });

  test("history does not auto-open, and native keyboard resizing works", async ({
    page,
  }) => {
    /*
      历史线程**不会**自动打开面板：React 只在这一轮还在流式、且 write_file 尚未返回
      时才自动打开，或者最后一步是成功的 finalize_artifact_write
      （frontend/src/components/workspace/messages/message-group.tsx 的 autoOpenArtifactUrl）。
      这条 fixture 是「write_file + OK 结果」的历史记录，两个条件都不满足。
    */
    await expect(page.getByText(ARTIFACT_PATH)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#artifacts")).toBeHidden();

    const panel = await ensureArtifactOpen(page);
    await expect(panel.getByText("report.html")).toBeVisible();

    const separator = page.getByRole("separator");
    const widthBefore = await panelWidth(panel);
    const sizeBefore = Number(await separator.getAttribute("aria-valuenow"));
    expect(Number.isFinite(sizeBefore)).toBe(true);
    expect(sizeBefore).toBeGreaterThan(
      Number(await separator.getAttribute("aria-valuemin")),
    );
    await separator.focus();
    await page.keyboard.press("ArrowLeft");
    await expectNoPaneGeometryTransition(page);
    await expect
      .poll(async () => Number(await separator.getAttribute("aria-valuenow")))
      .toBe(sizeBefore - 5);
    await expect.poll(() => panelWidth(panel)).toBeGreaterThan(widthBefore);
    await expect(separator).toBeFocused();
  });
});
