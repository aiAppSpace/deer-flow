import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

function measureTimeline(node: Element) {
  let viewport = node.parentElement;
  while (viewport && getComputedStyle(viewport).overflowY !== "auto")
    viewport = viewport.parentElement;
  if (!viewport) throw new Error("Missing message scroll owner");
  const content = viewport.firstElementChild!;
  const groups = content.querySelectorAll("[data-message-group-index]");
  if (!groups.length) throw new Error("Missing real message groups");
  return {
    tailSpace:
      content.getBoundingClientRect().bottom -
      groups[groups.length - 1]!.getBoundingClientRect().bottom,
    scrollHeight: viewport.scrollHeight,
    clientHeight: viewport.clientHeight,
    scrollTop: viewport.scrollTop,
  };
}

const REPLY = "I updated the workspace report.";
for (const width of [1440, 768, 375, 360]) {
  for (const withDuration of [false, true]) {
    test(`assistant response and change card retain React spacing at ${width}, duration=${withDuration}`, async ({
      browser,
    }, testInfo) => {
      const original = PARITY_SCENARIOS.find(
        (item) => item.id === "workspace-changes",
      )!;
      const scenario = {
        ...original,
        mock: {
          ...original.mock,
          threads: original.mock!.threads!.map((thread) => ({
            ...thread,
            messages: thread.messages!.map((message) =>
              typeof message === "object" &&
              message !== null &&
              "type" in message &&
              message.type === "ai"
                ? {
                    ...message,
                    additional_kwargs: withDuration
                      ? { turn_duration: 31 }
                      : {},
                  }
                : message,
            ),
          })),
        },
      };
      const rows = [];
      for (const [app, base] of [
        ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
        ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
      ] as const) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          const pageErrors: string[] = [];
          page.on("pageerror", (error) => pageErrors.push(error.message));
          await runScenario(page, base, scenario, DEFAULT_DIMENSION, {
            id: "reply",
            steps: [],
          });
          await page.setViewportSize({ width, height: 900 });
          const rootPx = width === 360 ? 32 : 16;
          await page.evaluate((px) => {
            document.documentElement.style.fontSize = `${px}px`;
          }, rootPx);
          const reply = page.getByText(REPLY, { exact: true });
          const open = page.getByRole("button", {
            name: "View changes",
            exact: true,
          });
          await expect(reply).toBeVisible();
          await expect(open).toBeVisible();
          await expect(page.getByTestId("run-duration")).toHaveCount(
            withDuration ? 1 : 0,
          );
          await page.evaluate(() => document.fonts.ready);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const paragraph = await reply.boundingBox();
          expect(paragraph).not.toBeNull();
          const card = await open.evaluate((node) => {
            const card = node.closest(".rounded-xl");
            if (!card) throw new Error("Missing real workspace change card");
            const rect = card.getBoundingClientRect();
            const style = getComputedStyle(card);
            return {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              marginTop: style.marginTop,
            };
          });
          const durationBottom = withDuration
            ? await page
                .getByTestId("run-duration")
                .evaluate(
                  (node) => node.parentElement!.getBoundingClientRect().bottom,
                )
            : null;
          const ancestors = await reply.evaluate((node) => {
            const parents = [];
            for (
              let element = node.parentElement;
              element && parents.length < 6;
              element = element.parentElement
            ) {
              const style = getComputedStyle(element);
              parents.push({
                class: element.className,
                display: style.display,
                gap: style.gap,
                marginTop: style.marginTop,
                marginBottom: style.marginBottom,
              });
            }
            return parents;
          });
          const timeline = await reply.evaluate(measureTimeline);
          rows.push({
            app,
            timeline,
            rootPx,
            paragraph,
            card,
            durationBottom,
            ancestors,
            paragraphAfterDuration:
              durationBottom === null ? null : paragraph!.y - durationBottom,
            cardAfterParagraph: card.top - paragraph!.y - paragraph!.height,
          });
          await testInfo.attach(`${app}-response-layout`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          expect(pageErrors).toEqual([]);
        } finally {
          await context.close();
        }
      }
      await testInfo.attach("native-layout-measurements", {
        body: JSON.stringify(rows, null, 2),
        contentType: "application/json",
      });
      const [react, vue] = rows;
      expect
        .soft(vue!.timeline.tailSpace)
        .toBeCloseTo(react!.timeline.tailSpace, 1);
      expect
        .soft(vue!.timeline.scrollHeight)
        .toBe(react!.timeline.scrollHeight);
      expect
        .soft(vue!.cardAfterParagraph)
        .toBeCloseTo(react!.cardAfterParagraph, 1);
      expect.soft(vue!.card.width).toBeCloseTo(react!.card.width, 1);
      if (withDuration)
        expect
          .soft(vue!.paragraphAfterDuration)
          .toBeCloseTo(react!.paragraphAfterDuration!, 1);
    });
  }
}

for (const rootPx of [16, 32]) {
  test(`side chat tail keeps its own spacing at root font ${rootPx}`, async ({
    browser,
  }, testInfo) => {
    const scenario = PARITY_SCENARIOS.find(
      (item) => item.id === "sidecar-chat",
    )!;
    const rows = [];
    for (const [app, base] of [
      ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
      ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
    ] as const) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        await runScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          scenarioStates(scenario)[0]!,
        );
        const input = page.getByPlaceholder(/deeper follow-up/i);
        await input.fill("Check the layout of this reply");
        await input.press("Enter");
        const answer = page
          .getByTestId("sidecar-message-list")
          .locator("[data-assistant-turn]")
          .last();
        await expect(answer).toBeVisible();
        await expect(input).toHaveValue("");
        await page.evaluate((px) => {
          document.documentElement.style.fontSize = `${px}px`;
        }, rootPx);
        await page.evaluate(() => document.fonts.ready);
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        rows.push({
          app,
          rootPx,
          timeline: await answer.evaluate(measureTimeline),
        });
        await testInfo.attach(`${app}-sidecar-tail`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
      } finally {
        await context.close();
      }
    }
    await testInfo.attach("sidecar-tail-measurements", {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
    });
    expect(rows[1]!.timeline.tailSpace).toBeCloseTo(
      rows[0]!.timeline.tailSpace,
      1,
    );
    expect(rows[1]!.timeline.tailSpace).toBe(3 * rootPx + 12);
  });
}
