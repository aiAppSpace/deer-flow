/*
  【文件职责】     Vue thread history contracts；验证与 React 产品行为对齐的 Vue 实现。
  【架构位置】     测试
  【主要导出】     Playwright Vue M7 scenarios
  【依赖关系】     frontend shared mock API；Vue product routes and DOM
  【边界与注意】   Vue 使用自身 DOM 与门禁，不依赖 React 组件结构。
*/

import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

import {
  mockLangGraphAPI,
  MOCK_THREAD_ID,
  MOCK_THREAD_ID_2,
} from "./utils/mock-api";

const THREADS = [
  {
    thread_id: MOCK_THREAD_ID,
    title: "First conversation",
    updated_at: "2025-06-01T12:00:00Z",
  },
  {
    thread_id: MOCK_THREAD_ID_2,
    title: "Second conversation",
    updated_at: "2025-06-02T12:00:00Z",
  },
];
const DEMO_THREAD_ID = "7cfa5f8f-a2f8-47ad-acbd-da7137baf990";
const SVG_PROMPT_THREAD_ID = "00000000-0000-0000-0000-000000000777";
const SVG_PROMPT_MARKER = "LEAK-STRICT-SVG-PROMPT-SHOULD-DISAPPEAR";
const OPTIMISTIC_PROMPT_MARKER = "LEAK-OPTIMISTIC-SVG-PROMPT-SHOULD-DISAPPEAR";

/*
  **滚到顶：先用真滚轮把列表带离尾部，再把 `scrollTop` 归零。**

  原来这里是 `dispatchEvent("wheel", { deltaY: -1000 })`——**合成事件不会真的滚动**，
  元素照旧停在尾部。而 `MessageList.onScroll` 的第一条分支是「在尾部就恢复跟随尾部」：

      if (atTail) { followingTail.value = true; windowStart.value = maxStart; return; }

  于是只要在那之后落下**任何一个** scroll 事件（例如上一次
  `scrollToTail("smooth")` 的平滑滚动还在发），`followingTail` 就被置回 true；
  随后这里把 `scrollTop` 设成 0 再发 scroll，走的是

      if (followingTail.value) { windowStart.value = maxStart; return; }

  ——虚拟窗口**钉死在尾部**，`Long history question 0` 永远不渲染。
  报出来是 15 秒后的 `element(s) not found`，而 `scrollTop` 明明是 0
  （wave 196 那次整套红就是这个形状）。

  wave 199 的探针把这条链跑通了（同一棵树、单 worker）：

      原样                          → scrollTop=0 首条命中 1
      wheel 后补一个「尾部」scroll   → scrollTop=0 首条命中 **0**   ← 复刻失败
      真滚轮 + 同样补那个 scroll     → scrollTop=0 首条命中 1        ← 修法成立

  真滚轮会**真的**把 `scrollTop` 降下来，元素不再在尾部，后面的 scroll 事件
  进不了 `atTail` 那条分支。与 `e2e-stream/real-stream.spec.ts` 里那段
  「别拿一次输入去赌一个动着的界面」同族。
*/
async function scrollLogToTop(page: Page, scroller: Locator) {
  const before = await scroller.evaluate((element) => element.scrollTop);
  await scroller.hover();
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(0, -1_000);
        return scroller.evaluate((element) => element.scrollTop);
      },
      { timeout: 15_000, message: "真滚轮没能把列表带离尾部" },
    )
    .toBeLessThan(before);
  /*
    **把那个曾经让它翻车的事件永久留在这里。** 真滚轮之后它落不进 `atTail`
    分支，所以不影响这条用例；而一旦有人把真滚轮换回合成 `wheel`，
    这条用例会**确定性地**红，而不是每几十次整套才红一次。
  */
  await scroller.evaluate((element) => {
    element.dispatchEvent(new Event("scroll"));
  });
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
}

test.describe("Thread history", () => {
  test("sidebar shows existing threads", async ({ page }) => {
    mockLangGraphAPI(page, { threads: THREADS });

    await page.goto("/workspace/chats/new");

    // Both thread titles should appear in the sidebar
    await expect(page.getByText("First conversation")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Second conversation")).toBeVisible();
  });

  test("clicking a thread in sidebar navigates to it", async ({ page }) => {
    mockLangGraphAPI(page, { threads: THREADS });

    await page.goto("/workspace/chats/new");

    // Wait for sidebar to populate
    const firstThread = page.getByText("First conversation");
    await expect(firstThread).toBeVisible({ timeout: 15_000 });

    // Click on the first thread
    await firstThread.click();

    // Should navigate to that thread's URL
    await page.waitForURL(`**/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(page).toHaveURL(new RegExp(MOCK_THREAD_ID));
  });

  test("clicking blank space in a sidebar thread row navigates to it", async ({
    page,
  }) => {
    mockLangGraphAPI(page, { threads: THREADS });

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const firstThreadItem = sidebar
      .locator("[data-sidebar='menu-item']")
      .filter({ hasText: "First conversation" })
      .first();
    await expect(firstThreadItem).toBeVisible({ timeout: 15_000 });

    const firstThreadLink = firstThreadItem.getByRole("link");
    await expect(firstThreadLink).toBeVisible();

    const box = await firstThreadLink.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    await firstThreadLink.click({ position: { x: 4, y: box.height / 2 } });

    await page.waitForURL(`**/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(page).toHaveURL(new RegExp(MOCK_THREAD_ID));
  });

  test("existing thread loads historical messages", async ({ page }) => {
    mockLangGraphAPI(page, { threads: THREADS });

    // Navigate directly to an existing thread
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

    // The historical AI response should be displayed
    await expect(
      page.getByText("Response in thread First conversation"),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("keeps a thousand-turn history DOM bounded while preserving navigation", async ({
    page,
  }) => {
    const messages = Array.from({ length: 1_000 }, (_, turn) => [
      {
        type: "human",
        id: `long-human-${turn}`,
        content: `Long history question ${turn}`,
      },
      {
        type: "ai",
        id: `long-ai-${turn}`,
        content: `Long history answer ${turn}`,
      },
    ]).flat();
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Virtualized long history",
          updated_at: "2025-06-03T12:00:00Z",
          messages,
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(page.getByText("Long history answer 999")).toBeVisible({
      timeout: 15_000,
    });

    const conversation = page.getByRole("log");
    const scroller = conversation.locator(":scope > div").first();
    await expect
      .poll(() => conversation.locator("[data-index]").count())
      .toBeLessThan(60);

    await scrollLogToTop(page, scroller);
    await expect(page.getByText("Long history question 0")).toBeVisible({
      timeout: 15_000,
    });
    expect(await conversation.locator("[data-index]").count()).toBeLessThan(60);
  });

  test("keeps rendered messages ordered when the latest history page advances", async ({
    page,
  }) => {
    const originalPrompt = "/ppt-master Build the quarterly presentation";
    const followUpPrompt = "Continue with the approved default layout";
    const olderRows = Array.from({ length: 50 }, (_, index) => {
      const seq = index + 1;
      if (index === 0) {
        return {
          run_id: "run-initial",
          seq,
          content: {
            type: "human",
            id: "history-prompt",
            content: [{ type: "text", text: originalPrompt }],
          },
          metadata: { caller: "lead_agent" },
          created_at: "2025-06-03T12:00:00Z",
        };
      }
      if (index === 1) {
        return {
          run_id: "run-initial",
          seq,
          content: {
            type: "ai",
            id: "history-answer",
            content: "Initial design is ready",
          },
          metadata: { caller: "lead_agent" },
          created_at: "2025-06-03T12:00:01Z",
        };
      }
      return {
        run_id: "run-initial",
        seq,
        content: {
          type: "ai",
          id: `history-step-${seq}`,
          content: `Historical presentation step ${seq}`,
          ...(index === 49
            ? { additional_kwargs: { turn_duration: 704 } }
            : {}),
        },
        metadata: { caller: "lead_agent" },
        created_at: "2025-06-03T12:00:02Z",
      };
    });
    const initialRows = Array.from({ length: 50 }, (_, index) => {
      const seq = index + 51;
      return {
        run_id: "run-initial",
        seq,
        content: {
          type: "ai",
          id: `history-step-${seq}`,
          content: `Historical presentation step ${seq}`,
        },
        metadata: { caller: "lead_agent" },
        created_at: "2025-06-03T12:00:03Z",
      };
    });
    const shiftedRows = Array.from({ length: 50 }, (_, index) => {
      const seq = index + 101;
      return {
        run_id: "run-shifted",
        seq,
        content: {
          type: "ai",
          id: `shifted-step-${seq}`,
          content: `New presentation step ${seq}`,
        },
        metadata: { caller: "lead_agent" },
        created_at: "2025-06-03T12:01:00Z",
      };
    });
    let latestPageRequestCount = 0;
    let cursorPageRequestCount = 0;

    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Long presentation task",
          updated_at: "2025-06-03T12:00:00Z",
          // This scenario exercises persisted run-event pagination. Keep the
          // checkpoint empty so its generic mock messages do not interfere
          // with optimistic -> server reconciliation after the follow-up.
          messages: [],
        },
      ],
    });
    await page.route(
      new RegExp(`/api/threads/${MOCK_THREAD_ID}/messages/page(?:\\?.*)?$`),
      async (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }

        const beforeSeq = new URL(route.request().url()).searchParams.get(
          "before_seq",
        );
        const isLatestPage = beforeSeq === null;
        const rows = isLatestPage
          ? latestPageRequestCount === 0
            ? initialRows
            : shiftedRows
          : beforeSeq === "101"
            ? initialRows
            : olderRows;
        const hasMore = isLatestPage || beforeSeq === "101";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: rows,
            has_more: hasMore,
            next_before_seq: hasMore ? (rows[0]?.seq ?? null) : null,
          }),
        });
        if (isLatestPage) {
          latestPageRequestCount += 1;
        } else {
          cursorPageRequestCount += 1;
        }
      },
    );

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    const loadEarlierButton = page.getByTestId("load-earlier-messages");
    await expect(loadEarlierButton).toBeVisible({ timeout: 15_000 });
    await loadEarlierButton.click();
    await expect
      .poll(() => cursorPageRequestCount, { timeout: 15_000 })
      .toBeGreaterThan(0);
    const conversation = page.getByRole("log");
    const scroller = conversation.locator(":scope > div").first();
    await scrollLogToTop(page, scroller);
    await expect(page.getByText(originalPrompt)).toBeVisible({
      timeout: 15_000,
    });
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(page.getByText("Completed in 11m 44s")).toBeVisible();

    const latestPageRequestsBeforeSubmit = latestPageRequestCount;
    const textarea = page.locator("textarea[name='message']");
    await textarea.fill(followUpPrompt);
    await textarea.press("Enter");

    await expect
      .poll(() => latestPageRequestCount, { timeout: 15_000 })
      .toBeGreaterThan(latestPageRequestsBeforeSubmit);
    await expect(page.getByText(followUpPrompt)).toBeVisible();

    let preservedDurationFound = false;
    for (let step = 0; step <= 12; step += 1) {
      await scroller.evaluate((element, ratio) => {
        element.scrollTop =
          (element.scrollHeight - element.clientHeight) * ratio;
        element.dispatchEvent(new Event("scroll"));
      }, step / 12);
      if (await page.getByText("Completed in 11m 44s").isVisible()) {
        preservedDurationFound = true;
        break;
      }
    }
    expect(preservedDurationFound).toBe(true);

    await scroller.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(page.getByText(originalPrompt)).toBeVisible();
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(page.getByText(followUpPrompt)).toBeVisible();
  });

  test("shows a completed run duration once after multi-step history", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Multi-step duration",
          updated_at: "2025-06-03T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-duration",
              content: [{ type: "text", text: "Complete several steps" }],
            },
            {
              type: "ai",
              id: "msg-ai-duration-1",
              content: "Intermediate result",
              additional_kwargs: { turn_duration: 114 },
            },
            {
              type: "ai",
              id: "msg-ai-duration-2",
              content: "Final result",
              additional_kwargs: {
                turn_duration: 114,
                reasoning_content: "Final synthesis reasoning",
              },
            },
          ],
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(page.getByText("Final result")).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByTestId("run-duration")).toHaveCount(1);
    await expect(page.getByText("Completed in 1m 54s")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reasoning", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Thought for 114 seconds")).toHaveCount(0);

    const assistantTurn = page.locator("[data-assistant-turn]").last();
    await assistantTurn.hover();
    const geometry = await page.evaluate(() => {
      const duration = document.querySelector<HTMLElement>(
        "[data-testid='run-duration']",
      );
      const completedTurn = duration?.closest<HTMLElement>(
        "[data-assistant-turn]",
      );
      const actions = completedTurn?.querySelector<HTMLElement>(
        "[data-testid='assistant-turn-actions']",
      );
      const buttons = actions
        ? [...actions.querySelectorAll<HTMLElement>(":scope > button")]
        : [];
      const composer = document.querySelector<HTMLElement>(
        "[data-testid='composer-surface']",
      );
      const messageContent = document.querySelector<HTMLElement>(
        "[data-testid='message-list-content']",
      );
      const scroller = messageContent?.parentElement;
      if (
        !actions ||
        buttons.length !== 3 ||
        !duration ||
        !composer ||
        !messageContent ||
        !scroller
      ) {
        throw new Error("Missing completed-turn geometry anchors");
      }
      const actionsRect = actions.getBoundingClientRect();
      const durationRect = duration.getBoundingClientRect();
      const composerRect = composer.getBoundingClientRect();
      const messageContentRect = messageContent.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      return {
        buttons: buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        }),
        actionGap: Number.parseFloat(getComputedStyle(actions).gap),
        actionsToDuration: durationRect.top - actionsRect.bottom,
        durationToComposer: composerRect.top - durationRect.bottom,
        durationToMessageContentEnd:
          messageContentRect.bottom - durationRect.bottom,
        messageContentRemainder:
          scrollerRect.bottom - messageContentRect.bottom,
        scrollerToComposer: composerRect.top - scrollerRect.bottom,
        composerBottomInset: window.innerHeight - composerRect.bottom,
      };
    });

    expect(geometry.buttons).toHaveLength(3);
    for (const button of geometry.buttons) {
      expect(button.width).toBe(32);
      expect(button.height).toBe(32);
      expect(button.y).toBe(geometry.buttons[0]?.y);
    }
    expect(geometry.buttons[1]!.x - geometry.buttons[0]!.x).toBe(36);
    expect(geometry.buttons[2]!.x - geometry.buttons[1]!.x).toBe(36);
    expect(geometry.actionGap).toBe(4);
    expect(geometry.actionsToDuration).toBe(8);
    expect(geometry.durationToMessageContentEnd).toBe(72);
    expect(geometry.messageContentRemainder).toBeGreaterThanOrEqual(0);
    expect(geometry.scrollerToComposer).toBe(0);
    expect(geometry.durationToComposer).toBeCloseTo(
      geometry.durationToMessageContentEnd + geometry.messageContentRemainder,
      5,
    );
    expect(geometry.composerBottomInset).toBe(16);
  });

  /*
    正文那层的外边距与消息内容层的 gap，都是**调用点/容器**给的，不是渲染器自带的。

    上游 `message-list-item.tsx` 写的是 `<MarkdownContent className="my-3">`
    （reasoning、工具步骤那几个调用点都不传），而 `MessageContent` 是
    `flex … flex-col gap-2`。本仓此前两样都没有，后果不是"少一点间距"：

    - 少 `my-3`，线程里第一条 AI 消息的正文整体上移 12px；
    - 少 `flex`，block 布局里相邻兄弟的 margin 会**折叠**，于是同一处 `my-3`
      在没有 reasoning 的消息上生效、在有 reasoning 的消息上被吃掉。

    所以这条分开量：容器是 flex、gap 是 8、正文那层上下各 12。四个值各自对应一处
    改动，都能单独负向验证；合成一个"reasoning 底到正文顶"的距离反而钉不住——
    12+8 和 20+0 得到同一个和，而后者正是 margin 折叠时的样子。

    这段距离的绝对值实测是 36 而不是 12+8=20，多出来的 16 是 Reasoning 根上的
    `mb-4`——上游 `ai-elements/reasoning.tsx:114` 同一处、同一个值。这里也把它
    钉上：三项加起来正好 36，任何一项被改动都会红。

    wave 14 的 probe 顺手翻掉了这段注释此前的一句推断。它说跨应用台账上
    streaming-reasoning-order 那条 `y Δ-5.3` 是"`ReasoningDisclosure` 自己的
    外边距"的残余——不是。逐个盒子量下来，两边根上的 `mb-4` 完全相同，Δ 全部
    来自**内容层**：本仓写的是 `mt-2` + `leading-relaxed`，上游是 `mt-4` +
    text-sm 自带的行高，(8−16)+(22.75−20)=−5.25。两处方向相反、部分抵消，
    这也是为什么只盯着 `mt-2` 会以为差的是 8px。
  */
  test("assistant content stacks with a flex gap and the body keeps its own margin", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Reasoning then body",
          updated_at: "2025-06-03T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-spacing",
              content: [{ type: "text", text: "Who are you?" }],
            },
            {
              type: "ai",
              id: "msg-ai-spacing",
              content: "I am DeerFlow.",
              additional_kwargs: {
                reasoning_content: "Listing the core capabilities.",
              },
            },
          ],
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    const body = page.getByText("I am DeerFlow.", { exact: true });
    await expect(body).toBeVisible({ timeout: 15_000 });

    const spacing = await body.evaluate((node: Element) => {
      // node 是正文 <p>；它的父级就是 markdown 根容器（带 my-3 的那层）。
      const markdownRoot = node.parentElement!;
      const content = markdownRoot.parentElement!;
      const rootStyle = getComputedStyle(markdownRoot);
      const contentStyle = getComputedStyle(content);
      const reasoning = content.firstElementChild!;
      return {
        marginTop: rootStyle.marginTop,
        marginBottom: rootStyle.marginBottom,
        display: contentStyle.display,
        gap: contentStyle.rowGap,
        // reasoning 确实排在正文上面——`gap` 与 `my-3` 之所以成立的前提。
        reasoningIsFirst: reasoning !== markdownRoot,
        reasoningMarginBottom: getComputedStyle(reasoning).marginBottom,
        // reasoning 盒底到正文盒顶的实际距离 = mb-4 + gap-2 + my-3。
        reasoningToBody: Math.round(
          markdownRoot.getBoundingClientRect().top -
            reasoning.getBoundingClientRect().bottom,
        ),
      };
    });

    expect(spacing.reasoningIsFirst).toBe(true);
    expect(spacing.display).toBe("flex");
    expect(spacing.gap).toBe("8px");
    expect(spacing.marginTop).toBe("12px");
    expect(spacing.marginBottom).toBe("12px");
    expect(spacing.reasoningMarginBottom).toBe("16px");
    expect(spacing.reasoningToBody).toBe(36);
  });

  test("input box recalls previous prompts with arrow keys", async ({
    page,
  }) => {
    const firstPrompt = "Summarize the latest quarterly report";
    const secondPrompt = "Turn the summary into an action plan";

    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Prompt history conversation",
          updated_at: "2025-06-03T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-prompt-history-1",
              content: [{ type: "text", text: firstPrompt }],
            },
            {
              type: "ai",
              id: "msg-ai-prompt-history-1",
              content: "First answer",
            },
            {
              type: "human",
              id: "msg-human-prompt-history-2",
              content: [{ type: "text", text: secondPrompt }],
            },
            {
              type: "ai",
              id: "msg-ai-prompt-history-2",
              content: "Second answer",
            },
          ],
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(page.getByText("Second answer")).toBeVisible({
      timeout: 15_000,
    });

    const textarea = page.locator("textarea[name='message']");
    await expect(textarea).toBeVisible();

    await textarea.focus();
    await textarea.press("ArrowUp");
    await expect(textarea).toHaveValue(secondPrompt);

    await textarea.press("ArrowUp");
    await expect(textarea).toHaveValue(firstPrompt);

    await textarea.press("ArrowDown");
    await expect(textarea).toHaveValue(secondPrompt);

    await textarea.press("ArrowDown");
    await expect(textarea).toHaveValue("");

    await textarea.fill("draft should not be overwritten");
    await textarea.press("ArrowUp");
    await expect(textarea).toHaveValue("draft should not be overwritten");
  });

  test("deleting an inactive chat keeps the current chat open", async ({
    page,
  }) => {
    mockLangGraphAPI(page, { threads: THREADS });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(
      page.getByText("Response in thread First conversation"),
    ).toBeVisible({ timeout: 15_000 });

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const inactiveThreadItem = sidebar
      .locator("[data-sidebar='menu-item']")
      .filter({
        has: page.getByRole("button", { name: /more/i }),
        hasText: "Second conversation",
      })
      .first();
    await expect(inactiveThreadItem).toBeVisible();
    await inactiveThreadItem.hover();
    await inactiveThreadItem.getByRole("button", { name: /more/i }).click();
    await page.getByRole("menuitem", { name: /delete/i }).click();

    await expect(page).toHaveURL(new RegExp(MOCK_THREAD_ID));
    await expect(
      page.getByText("Response in thread First conversation"),
    ).toBeVisible();
    await expect(sidebar.getByText("Second conversation")).toHaveCount(0);
  });

  test("new chat does not show previous thread messages after client-side navigation", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: SVG_PROMPT_THREAD_ID,
          title: "SVG artifact prompt",
          updated_at: "2025-06-03T12:00:00Z",
          messages: [
            {
              type: "human",
              id: "msg-human-svg-prompt",
              content: [
                {
                  type: "text",
                  text: `请严格执行：\n1. 使用 write_file 创建 /mnt/user-data/outputs/shared.svg，内容包含 ${SVG_PROMPT_MARKER}\n2. 最终回复只输出 Markdown 图片。`,
                },
              ],
            },
            {
              type: "ai",
              id: "msg-ai-svg-prompt",
              content: "![shared artifact](/mnt/user-data/outputs/shared.svg)",
            },
          ],
        },
      ],
    });

    await page.goto(`/workspace/chats/${SVG_PROMPT_THREAD_ID}`);
    await expect(page.getByText(SVG_PROMPT_MARKER)).toBeVisible({
      timeout: 15_000,
    });

    await page
      .locator("[data-sidebar='sidebar'] a[href='/workspace/chats/new']")
      .click();
    await page.waitForURL("**/workspace/chats/new");

    await expect(page.getByText(SVG_PROMPT_MARKER)).toBeHidden();
    await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
  });

  test("new chat does not show previous optimistic user message after client-side navigation", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID_2,
          title: "Destination conversation",
          updated_at: "2025-06-04T12:00:00Z",
        },
      ],
    });

    const metadataOnlyStream = async (route: Route) => {
      const body = [
        {
          event: "metadata",
          data: {
            run_id: "00000000-0000-0000-0000-000000000778",
            thread_id: MOCK_THREAD_ID,
          },
        },
        { event: "end", data: {} },
      ]
        .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
        .join("");

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Content-Location": `/api/threads/${MOCK_THREAD_ID}/runs/00000000-0000-0000-0000-000000000778`,
        },
        body,
      });
    };

    await page.route("**/api/langgraph/runs/stream", metadataOnlyStream);
    await page.route(
      "**/api/langgraph/threads/*/runs/stream",
      metadataOnlyStream,
    );

    await page.goto("/workspace/chats/new");
    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill(
      `请严格执行：使用 write_file 创建 shared.svg，内容包含 ${OPTIMISTIC_PROMPT_MARKER}。`,
    );
    await textarea.press("Enter");

    await expect(page.getByText(OPTIMISTIC_PROMPT_MARKER)).toBeVisible();

    await page.getByText("Destination conversation").click();
    await page.waitForURL(`**/workspace/chats/${MOCK_THREAD_ID_2}`);
    await expect(page.getByText(OPTIMISTIC_PROMPT_MARKER)).toHaveCount(0);

    await page
      .locator("[data-sidebar='sidebar'] a[href='/workspace/chats/new']")
      .click();
    await page.waitForURL("**/workspace/chats/new");

    await expect(page.getByText(OPTIMISTIC_PROMPT_MARKER)).toHaveCount(0);
    await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
  });

  test("new chat resets immediately after a history-only thread URL update", async ({
    page,
  }) => {
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new");
    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill("Message that must disappear in the next new chat");
    await textarea.press("Enter");
    await expect(page.getByText("Hello from DeerFlow!")).toBeVisible({
      timeout: 15_000,
    });

    // A newly created chat changes the URL with history.replaceState so the
    // active stream is not remounted. Reproduce that history-only transition:
    // the canonical pathname becomes the UUID while useParams can stay "new".
    await page.evaluate((threadId) => {
      history.replaceState(null, "", `/workspace/chats/${threadId}`);
    }, MOCK_THREAD_ID);

    const newChatLink = page.locator(
      "[data-sidebar='sidebar'] a[href='/workspace/chats/new']",
    );
    await expect(page).toHaveURL(
      new RegExp(`/workspace/chats/${MOCK_THREAD_ID}$`),
    );
    await expect(newChatLink).toHaveAttribute("data-active", "false");

    // One click must reset the chat without a second click or unrelated UI
    // interaction forcing another render.
    await newChatLink.click();
    await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
    await expect(page.getByText("Hello from DeerFlow!")).toHaveCount(0);
    await expect(textarea).toBeVisible();
  });

  test("deleting the active newly created chat returns to the new chat screen", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    // 删除一个 thread 只允许发**一次** DELETE。这里数请求而不是 stub 一个
    // 失败响应：Vue 的 thread client 走 `/api/langgraph/threads/{id}`，
    // 而此处原来那条 `/\/api\/threads\/[^/]+$/` 的 500 stub 压根匹配不上，
    // 于是这个用例长期看起来在测「本地清理失败仍能恢复」，实际什么都没测。
    // 计数同时挡住回归：多出来的第二次删除会被 Gateway 的
    // `require_existing=True` 判成 404，而级联删除对 404 是幂等吞掉的，
    // 只有请求数能把它暴露出来。
    const deleteRequests: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "DELETE" &&
        /\/api\/(?:langgraph\/)?threads\/[^/]+$/.test(
          new URL(request.url()).pathname,
        )
      ) {
        deleteRequests.push(request.url());
      }
    });

    await page.goto("/workspace/chats/new");
    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill("What should disappear after deletion?");
    await textarea.press("Enter");

    await expect(page.getByText("Hello from DeerFlow!")).toBeVisible({
      timeout: 15_000,
    });

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const recentThreadItem = sidebar
      .locator("[data-sidebar='menu-item']")
      .filter({
        has: page.getByRole("button", { name: /more/i }),
        hasText: "New Chat",
      })
      .first();
    await expect(recentThreadItem).toBeVisible();
    await recentThreadItem.hover();
    await recentThreadItem.getByRole("button", { name: /more/i }).click();
    await page.getByRole("menuitem", { name: /delete/i }).click();

    await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
    await expect(page.getByText("Previous question")).toHaveCount(0);
    await expect(page.getByText("Hello from DeerFlow!")).toHaveCount(0);
    await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
    expect(deleteRequests).toHaveLength(1);

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await page.waitForURL("**/workspace/chats/new");
    await expect(page.getByText("Hello from DeerFlow!")).toHaveCount(0);
    await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
  });

  test("mock thread does not load real backend run history", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: DEMO_THREAD_ID,
          title: "Forecasting 2026 Trends and Opportunities",
          updated_at: "2025-06-01T12:00:00Z",
          messages: [
            {
              type: "human",
              id: `run-human-${DEMO_THREAD_ID}`,
              content: [
                {
                  type: "text",
                  text: "This run-message endpoint should not be called.",
                },
              ],
            },
          ],
        },
      ],
    });
    const backendRunHistoryUrls: string[] = [];
    await page.route(
      /\/api\/langgraph\/threads\/[^/]+\/runs(?:\?|$)/,
      (route) => {
        if (
          route.request().method() === "GET" &&
          route
            .request()
            .url()
            .includes(`/api/langgraph/threads/${DEMO_THREAD_ID}/runs`)
        ) {
          backendRunHistoryUrls.push(route.request().url());
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              error: "mock=true must not load real runs",
            }),
          });
        }
        return route.fallback();
      },
    );
    await page.route(
      /\/api\/threads\/[^/]+\/runs\/[^/]+\/messages(?:\?|$)/,
      (route) => {
        if (
          route.request().method() === "GET" &&
          route.request().url().includes(`/api/threads/${DEMO_THREAD_ID}/runs/`)
        ) {
          backendRunHistoryUrls.push(route.request().url());
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              error: "mock=true must not load real run messages",
            }),
          });
        }
        return route.fallback();
      },
    );

    await page.goto(`/workspace/chats/${DEMO_THREAD_ID}?mock=true`);

    await expect(
      page.getByText("What might be the trends and opportunities in 2026?"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("I've created a modern, minimalist website"),
    ).toBeVisible();
    expect(backendRunHistoryUrls).toEqual([]);
  });

  test("public showcase renders a read-only demo without workspace chrome", async ({
    page,
  }) => {
    const response = await page.goto(`/showcase/${DEMO_THREAD_ID}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByText("What might be the trends and opportunities in 2026?"),
    ).toBeVisible();
    await expect(page.locator("[data-sidebar='sidebar']")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
    await expect(page.getByTestId("browser-trigger")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Scheduled tasks" }),
    ).toHaveCount(0);

    const artifact = await page.request.get(
      `/mock/api/threads/${DEMO_THREAD_ID}/artifacts/mnt/user-data/outputs/index.html`,
    );
    expect(artifact.status()).toBe(200);
    expect(await artifact.text()).toContain("<!doctype html>");
    const unlistedArtifact = await page.request.get(
      `/mock/api/threads/${DEMO_THREAD_ID}/artifacts/mnt/user-data/outputs/not-allowlisted.html`,
    );
    expect(unlistedArtifact.status()).toBe(404);

    const missing = await page.request.get("/showcase/not-a-public-demo");
    expect(missing.status()).toBe(404);
  });

  test("chats list page shows all threads", async ({ page }) => {
    mockLangGraphAPI(page, { threads: THREADS });

    await page.goto("/workspace/chats");

    // Both threads should be listed in the main content area
    const main = page.locator("main");
    await expect(main.getByText("First conversation")).toBeVisible({
      timeout: 15_000,
    });
    await expect(main.getByText("Second conversation")).toBeVisible();
  });

  test("IM channel threads show their source in thread lists", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Feishu conversation",
          updated_at: "2025-06-03T12:00:00Z",
          metadata: {
            channel_source: {
              type: "im_channel",
              provider: "feishu",
              chat_id: "oc_mock",
            },
          },
        },
      ],
    });

    await page.goto("/workspace/chats/new");

    const sidebarThread = page.locator(
      `a[href='/workspace/chats/${MOCK_THREAD_ID}']`,
    );
    await expect(sidebarThread).toBeVisible({ timeout: 15_000 });
    await expect(sidebarThread.getByLabel("Feishu channel")).toBeVisible();

    await page.goto("/workspace/chats");

    const mainThread = page
      .locator("main")
      .locator(`a[href='/workspace/chats/${MOCK_THREAD_ID}']`);
    await expect(mainThread.getByText("Feishu conversation")).toBeVisible({
      timeout: 15_000,
    });
    await expect(mainThread.getByText("Feishu", { exact: true })).toBeVisible();
  });
});
