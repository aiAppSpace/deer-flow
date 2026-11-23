import { expect, test, type Page } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import { mockSavedShowcaseHistory } from "./support/saved-showcase-history";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
  type ParityScenario,
} from "./support/scenarios";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

async function enlargeAndSurvey(page: Page) {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addStyleTag({ content: "html{font-size:32px!important}" });
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
  const survey = await page.evaluate(surveyReflow, 24);
  expect(survey.documentOverflowX).toBe(0);
  expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
  expect(survey.lostControls).toEqual([]);
  expect(survey.unreachableClips).toEqual([]);
}

for (const [app, base] of APPS) {
  test(`${app}: default and agent welcome composers keep native focus reachability after reflow`, async ({
    browser,
  }) => {
    for (const id of ["sidebar", "agent-chat"]) {
      const registered = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
      const scenario: ParityScenario = {
        ...registered,
        // Exercise the actual empty route without opening an unrelated picker.
        settle: [
          {
            kind: "visible",
            target: { role: "textbox", name: /how can i assist you/i },
          },
        ],
      };
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      try {
        await runScenario(page, base, scenario, DEFAULT_DIMENSION, {
          id: "welcome",
          steps: [],
        });
        await enlargeAndSurvey(page);
        const composer = page.getByRole("textbox", {
          name: /how can i assist you/i,
        });
        await composer.focus();
        await expect(composer).toBeFocused();
        await expect(composer).toBeInViewport({ ratio: 1 });
        await composer.fill("Keep this draft after text reflow");
        const submit = page.getByRole("button", {
          name: "Submit",
          exact: true,
        });
        await expect(submit).toBeEnabled();
        await submit.focus();
        await expect(submit).toBeFocused();
        await expect(submit).toBeInViewport({ ratio: 1 });
        await composer.focus();
        await expect(composer).toHaveValue("Keep this draft after text reflow");
      } finally {
        await context.close();
      }
    }
  });

  test(`${app}: enlarged virtual history keeps its original native scroller and keyboard focus`, async ({
    browser,
  }) => {
    const threadId = "scroll-owner-long-history";
    const messages = Array.from({ length: 90 }, (_, index) => [
      {
        type: "human" as const,
        id: `owner-human-${index}`,
        content: `Scroll owner question ${index}`,
      },
      {
        type: "ai" as const,
        id: `owner-ai-${index}`,
        content: `Scroll owner answer ${index}`,
      },
    ]).flat();
    const scenario: ParityScenario = {
      id: "scroll-owner-native-history",
      title: "Native message history scroll owner",
      backend: "mock",
      path: `/workspace/chats/${threadId}`,
      mock: {
        threads: [{ thread_id: threadId, title: "Long history", messages }],
      },
      settle: [{ kind: "visible", target: { text: "Scroll owner answer 89" } }],
    };
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    try {
      await runScenario(page, base, scenario);
      const log = page.getByTestId("main-message-list");
      const scroller = log.locator(":scope > div");
      const originalScroller = await scroller.elementHandle();
      expect(originalScroller).not.toBeNull();
      await enlargeAndSurvey(page);
      expect(
        await scroller.evaluate(
          (element, original) => element === original,
          originalScroller,
        ),
      ).toBe(true);
      const geometry = await scroller.evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(["auto", "scroll"]).toContain(geometry.overflowY);
      expect(geometry.clientHeight).toBeGreaterThan(0);
      expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
      const renderedRows = await log.locator("[data-index]").count();
      expect(renderedRows).toBeGreaterThan(0);
      expect(renderedRows).toBeLessThan(60);
      const composer = page.getByRole("textbox", {
        name: /how can i assist you/i,
      });
      await composer.focus();
      const before = await scroller.evaluate((element) => element.scrollTop);
      expect(before).toBeGreaterThan(0);
      await scroller.hover();
      await expect
        .poll(async () => {
          await page.mouse.wheel(0, -1_000);
          return scroller.evaluate((element) => element.scrollTop);
        })
        .toBeLessThan(before);
      await expect(composer).toBeFocused();
      await scroller.evaluate((element) => {
        element.scrollTop = 0;
        element.dispatchEvent(new Event("scroll"));
      });
      await expect(
        page.getByText("Scroll owner question 0", { exact: true }),
      ).toBeVisible();
      expect(
        await scroller.evaluate(
          (element, original) => element === original,
          originalScroller,
        ),
      ).toBe(true);
      const copy = log
        .getByRole("button", { name: "Copy to clipboard", exact: true })
        .first();
      await copy.focus();
      await expect(copy).toBeFocused();
      await expect(copy).toBeInViewport({ ratio: 1 });
    } finally {
      await context.close();
    }
  });

  test(`${app}: completed, tool, todo and clarification messages retain bounded native capacity at low height and enlarged split width`, async ({
    browser,
  }) => {
    const surfaces = [
      "agent-chat",
      "tool-call-details",
      "thread-todos",
      "branch-thread",
      "showcase-c02bb4d5-4202-490e-ae8f-ff4864fc0d2e",
      "showcase-fe3f7974-1bcb-4a01-a950-79673baafefd",
    ];
    for (const id of surfaces) {
      const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
      const states = scenarioStates(scenario);
      const state =
        id === "agent-chat"
          ? states.find((entry) => entry.id === "completed-turn")!
          : id === "tool-call-details"
            ? states.find((entry) => entry.id === "bounded-error")!
            : states[0]!;
      const sizes = id.startsWith("showcase-")
        ? [{ width: 360, height: 800 }]
        : [
            { width: 360, height: 800 },
            { width: 360, height: 360 },
            { width: 1280, height: 800 },
          ];
      for (const size of sizes) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        const unmatched: string[] = [];
        await page.route("**/api/**", (route) => {
          unmatched.push(route.request().url());
          return route.abort("blockedbyclient");
        });
        if (id.startsWith("showcase-")) {
          await mockSavedShowcaseHistory(page, id.slice("showcase-".length));
        }
        try {
          await runScenario(page, base, scenario, DEFAULT_DIMENSION, state);
          const originalError =
            id === "tool-call-details"
              ? await page
                  .getByRole("region", { name: "Error", exact: true })
                  .textContent()
              : undefined;
          if (originalError !== undefined) {
            expect(originalError).toContain("denied:");
          }
          const log = page.getByTestId("main-message-list");
          const scroller = log.locator(":scope > div");
          const originalScroller = await scroller.elementHandle();
          await page.setViewportSize(size);
          await page.addStyleTag({ content: "html{font-size:32px!important}" });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          expect(
            await scroller.evaluate(
              (element, original) => element === original,
              originalScroller,
            ),
          ).toBe(true);
          expect(
            await scroller.evaluate((element) => element.clientHeight),
          ).toBeGreaterThan(0);
          expect(
            await scroller.evaluate(
              (element) => getComputedStyle(element).overflowY,
            ),
          ).toBe("auto");
          if (id.startsWith("showcase-")) {
            expect(
              await log.locator("pre[tabindex]").count(),
              `${id}: real keyboard-accessible code blocks are present`,
            ).toBeGreaterThan(0);
            expect(
              await log.locator("a[href]").count(),
              `${id}: real message links are present`,
            ).toBeGreaterThan(0);
          }
          const controls = id.startsWith("showcase-")
            ? await log.locator("pre[tabindex], a[href]").all()
            : id === "tool-call-details"
              ? [
                  page.getByRole("button", {
                    name: "Tool details: mcp_lookup (call-4389)",
                    exact: true,
                  }),
                  page.getByRole("button", {
                    name: "Copy to clipboard: Call ID",
                    exact: true,
                  }),
                ]
              : [
                  log
                    .getByRole("button", {
                      name: "Copy to clipboard",
                      exact: true,
                    })
                    .last(),
                  log
                    .getByRole("button", { name: "Regenerate", exact: true })
                    .last(),
                  ...(id === "branch-thread" ? [log.getByRole("textbox")] : []),
                ];
          expect(
            controls.length,
            `${id}: real message controls are present`,
          ).toBeGreaterThan(0);
          for (const control of controls) {
            const box = await control.boundingBox();
            expect(box).not.toBeNull();
            expect(
              await scroller.evaluate((element) => element.clientHeight),
              `${id} ${size.width}x${size.height}: the existing native port contains a complete control`,
            ).toBeGreaterThanOrEqual(box!.height);
            await control.focus();
            await page.keyboard.press("Shift+Tab");
            await expect(control).not.toBeFocused();
            await page.keyboard.press("Tab");
            await expect(control).toBeFocused();
            await expect(control).toBeInViewport({ ratio: 1 });
          }
          if (id === "tool-call-details") {
            await expect(
              page.getByRole("button", {
                name: "Tool details: mcp_lookup (call-4389)",
                exact: true,
              }),
            ).toHaveAttribute("aria-expanded", "true");
            expect(
              await page
                .getByRole("region", { name: "Error", exact: true })
                .textContent(),
            ).toBe(originalError);
          }
          const survey = await page.evaluate(surveyReflow, 24);
          expect(survey.documentOverflowX, id).toBe(0);
          expect(survey.nonDeliberateHorizontalScrollers, id).toEqual([]);
          expect(survey.lostControls, id).toEqual([]);
          expect(survey.unreachableClips, id).toEqual([]);
          expect(
            unmatched,
            `${id}: every API request remains fixture-owned`,
          ).toEqual([]);
        } finally {
          await context.close();
        }
      }
    }
  });
}
