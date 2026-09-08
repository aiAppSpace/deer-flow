/*
  【文件职责】     M4a 的**真流** gate：分块、task/retry、心跳、续传、gap→A7。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     tests/support/stream-gateway.mjs（经 Nuxt 代理）
  【边界与注意】   与 `tests/m4a/chat-dataflow.spec.ts` 的分工：那份用
                   `route.fulfill` 一次性给完整 body，验的是**归并与顺序**；
                   本份让浏览器真的从 socket 上一片一片读，验的是**只有分块到达
                   才会暴露的东西**。两份都要，因为前者跑得快、后者才有真实性。

                   请求**不被拦截**（除了改写 query 选脚本），流是浏览器自己从
                   Nitro 代理读的——这一点是本文件的全部意义，不要为了方便改成
                   `route.fulfill`。
*/

import { expect, test, type Page } from "@playwright/test";

/** 让这一条用例的 create 走假 Gateway 的哪个脚本。用改写 URL 而不是 fulfill：
 *  `route.continue()` 由浏览器真正发出请求，响应体仍然是流式的。 */
async function useScript(
  page: Page,
  script: "plain" | "gap" | "scroll" | "task",
) {
  await page.route("**/api/langgraph/threads/*/runs/stream*", (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("script", script);
    return route.continue({ url: url.toString() });
  });
}

async function openNewChat(page: Page) {
  await page.goto("/workspace/chats/new");
  const textarea = page.getByPlaceholder(/how can i assist you/i);
  await expect(textarea).toBeVisible({ timeout: 20_000 });
  return textarea;
}

test.describe("真流 gate", () => {
  test("回答在同一个 AI 气泡内逐片增高时，视口持续贴住底部", async ({
    page,
  }) => {
    await useScript(page, "scroll");
    const textarea = await openNewChat(page);
    await textarea.fill("Write a long answer");
    await textarea.press("Enter");

    const answer = page.locator(
      '[data-testid="message-list"] > [data-role="ai"]',
    );
    await expect(answer).toContainText("Streaming paragraph 18", {
      timeout: 20_000,
    });

    const scroller = page
      .getByTestId("main-message-list")
      .locator(":scope > div");
    const metrics = await scroller.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    await expect
      .poll(() =>
        scroller.evaluate(
          (element) =>
            element.scrollHeight - element.clientHeight - element.scrollTop,
        ),
      )
      .toBeLessThanOrEqual(2);
  });

  test("用户在回答期间主动上滚后，不再被后续 delta 抢回底部", async ({
    page,
  }) => {
    await useScript(page, "scroll");
    const textarea = await openNewChat(page);
    await textarea.fill("Write a long answer");
    await textarea.press("Enter");

    const answer = page.locator(
      '[data-testid="message-list"] > [data-role="ai"]',
    );
    await expect(answer).toContainText("Streaming paragraph 10", {
      timeout: 20_000,
    });
    const scroller = page
      .getByTestId("main-message-list")
      .locator(":scope > div");
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const scrollTopBeforeWheel = await scroller.evaluate(
      (element) => element.scrollTop,
    );

    /*
      **一次滚轮不一定能赢。** 这一步跑在流式中间：每个 delta 到达时应用都会
      把列表拉回底部，而 `page.mouse.wheel` 只发一个事件——它落在两次程序化
      滚动之间时才留得下来。实测发生率不低：同一棵树上跑六遍，
      **两遍在这一行超时**（而干净树六遍全绿），而这条 spec 里根本没有
      workspace changes、被改的组件一次都没渲染——扰动来自包体与时序，不是行为。

      所以改成**滚到它真的动为止**：每次 poll 再发一个滚轮，直到 scrollTop
      真的掉下去。这不放宽被测的契约——**契约在下面那一半**（后续 delta 到了
      仍然不把它抢回底部），这里只是把「用户上滚了」这个前置条件做实。
      真的坏了的话，poll 会一直等不到、照样红。
      与 wave 86 那两处 drag 助手同族：**别拿一次输入去赌一个动着的界面。**
    */
    await scroller.hover();
    await expect
      .poll(
        async () => {
          await page.mouse.wheel(0, -1000);
          return scroller.evaluate((element) => element.scrollTop);
        },
        { timeout: 15_000 },
      )
      .toBeLessThan(scrollTopBeforeWheel - 200);
    await expect(answer).toContainText("Streaming paragraph 18", {
      timeout: 20_000,
    });

    const bottomGap = await scroller.evaluate(
      (element) =>
        element.scrollHeight - element.clientHeight - element.scrollTop,
    );
    expect(bottomGap).toBeGreaterThan(200);
  });

  test("逐片 delta 在浏览器里拼成完整答案，顺序仍然是 human 在前", async ({
    page,
  }) => {
    await useScript(page, "plain");
    const textarea = await openNewChat(page);
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    const items = page.locator('[data-testid="message-list"] > [data-role]');
    await expect(items).toHaveCount(2, { timeout: 20_000 });
    /*
      正面特征：**五片拼起来的全文**。任何一片被覆盖而不是追加，这里都会拿到一个
      截断的字符串，而截断的字符串同样「非空」。

      **锚定开头，不再要求整块只有这一句**：这一块是 assistant 的**整个回合**，
      跑完之后里面还会多一行「本次任务耗时」（上游 message-list.tsx 的
      `withRunDuration` 把正文和时长包在同一个 div 里，wave 179 本仓补齐了同一条）。
      旧写法的 `toHaveText("…")` 顺带断言了「这一块里没有别的东西」——那从来不是
      这条用例要守的东西，而且上游也不成立。`^` 照样挡得住截断与重复。
    */
    await expect(items.nth(1)).toHaveText(/^Hello from DeerFlow!/, {
      timeout: 20_000,
    });
    // 时长是这一块里的**另一个**元素，不是正文的一部分——顺手钉住，免得下次又被读成正文。
    await expect(items.nth(1).getByTestId("run-duration")).toBeVisible();
    await expect(items.nth(0)).toHaveAttribute("data-role", "human");
    await expect(items.nth(1)).toHaveAttribute("data-role", "ai");
  });

  test("心跳注释帧不进消息列表", async ({ page }) => {
    await useScript(page, "plain");
    const textarea = await openNewChat(page);
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    const items = page.locator('[data-testid="message-list"] > [data-role]');
    await expect(items).toHaveCount(2, { timeout: 20_000 });
    // 假 Gateway 在**每一片之前**都发一条 `: keep-alive`。它必须在传输层
    // 就被吃掉（05 L9）；漏进 reducer 会多出若干条空消息。
    await expect(items).toHaveCount(2);
    await expect(page.locator("text=keep-alive")).toHaveCount(0);
  });

  test("真实分块 custom 事件展示 retry，并收敛为带步骤、模型和 token 的终态 Subtask", async ({
    page,
  }) => {
    await useScript(page, "task");
    const textarea = await openNewChat(page);
    await textarea.fill("Research the market");
    await textarea.press("Enter");

    const retry = page.getByTestId("llm-retry-status");
    await expect(retry).toHaveText("The model is busy. Retrying…", {
      timeout: 20_000,
    });
    await expect(retry).toBeHidden({ timeout: 20_000 });

    const card = page.locator('[data-task-id="task-1"]');
    await expect(card).toContainText("Research the market", {
      timeout: 20_000,
    });
    // 状态词来自词典的 `subtasks.completed`，上游同一条（frontend/src/components/
    // workspace/messages/subtask-card.tsx:250 也读 t.subtasks.completed），两边都是
    // "Subtask completed"。写死的 "Completed" 是 wave 11 之前 view-model.ts 里那个
    // 已被删掉的 statusLabel 留下的。
    await expect(card).toContainText("Subtask completed");
    await expect(card).toContainText("scenario-model");
    await expect(card).toContainText("30");

    const toggle = card.getByTestId("subtask-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();
    await expect(card).toContainText("Planning the research");
    await expect(card).toContainText("web_search");
    await expect(card).toContainText("Market evidence ready.");
  });

  test("gap：带 Last-Event-ID 续传，并触发 A7 的清空与本地化警告", async ({
    page,
  }) => {
    await useScript(page, "gap");
    const textarea = await openNewChat(page);
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    // A7 的第一条正面特征：**用户看得见的本地化文案**，不是一个 key。
    // 它现在落在 workspace toaster 里（上游 `core/threads/hooks.ts:1805` 同样是
    // 一条 toast）；此前是 `data-testid="stream-warning"` 那条内联横幅，而那条
    // **只增不减**，一次性的警告会永远挂在屏幕上。
    // 仍然按 testid 取容器：这一屏还有别的 role="status"（工具条的上下文用量徽标
    // 一直在，流式期间 MessageList 再挂一条 RunActivity），裸 getByRole("status")
    // 会先命中徽标、断言到一个与 A7 无关的元素上。
    const warning = page
      .getByTestId("workspace-toaster")
      .getByRole("status")
      .first();
    await expect(warning).toBeVisible({ timeout: 20_000 });
    await expect(warning).toContainText(
      "Some live updates expired. The conversation was restored from saved state.",
      { timeout: 20_000 },
    );

    // 第二条：续传**真的带了游标**。假 Gateway 把收到的 Last-Event-ID
    // 回显成一条消息；拿到 `resumed@none` 就说明是从头重放而不是续传。
    const items = page.locator('[data-testid="message-list"] > [data-role]');
    await expect(items.filter({ hasText: "resumed@e8" })).toHaveCount(1, {
      timeout: 20_000,
    });
  });
});
