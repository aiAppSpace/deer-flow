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
} from "./support/scenarios";

async function assertReferenceHeaderReachable(page: Page) {
  const picker = page.getByTestId("mention-picker");
  const close = picker.getByRole("button", {
    name: "Close references",
    exact: true,
  });
  // Inspect before any native scroll-into-view action can incidentally repair
  // a stale placement. Font-only layout must invalidate the geometry itself.
  await expect
    .poll(() =>
      picker.evaluate((element) => {
        const popup = element.parentElement!;
        const box = popup.getBoundingClientRect();
        const viewport = window.visualViewport;
        let top = viewport?.offsetTop ?? 0;
        let bottom = top + (viewport?.height ?? window.innerHeight);
        for (
          let ancestor = popup.parentElement?.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          if (
            !/^(auto|scroll|hidden|clip)$/.test(
              getComputedStyle(ancestor).overflowY,
            )
          )
            continue;
          const bounds = ancestor.getBoundingClientRect();
          top = Math.max(top, bounds.top + ancestor.clientTop);
          bottom = Math.min(
            bottom,
            bounds.top + ancestor.clientTop + ancestor.clientHeight,
          );
        }
        return box.height > 0 && box.top >= top - 1 && box.bottom <= bottom + 1;
      }),
    )
    .toBe(true);
  // A window-only bounding box can pass while the native main scrollport clips
  // the button under the header. Trial click requires its actual pointer path.
  await close.click({ trial: true, timeout: 10_000 });
  await expect(close).toBeInViewport({ ratio: 1 });
  expect(
    await close.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return hit === element || (hit !== null && element.contains(hit));
    }),
  ).toBe(true);
  await close.focus();
  const search = picker.getByRole("combobox");
  if (await search.count()) {
    await close.press("Shift+Tab");
    await expect(search).toBeFocused();
    await expect(search).toBeInViewport({ ratio: 1 });
  }
  await expect(picker).toBeVisible();
}

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;
const SHOWCASES = [
  "5aa47db1-d0cb-4eb9-aea5-3dac1b371c5a",
  "7cfa5f8f-a2f8-47ad-acbd-da7137baf990",
  "c02bb4d5-4202-490e-ae8f-ff4864fc0d2e",
  "fe3f7974-1bcb-4a01-a950-79673baafefd",
];
const CONTENT_STATES: readonly (readonly [string, string])[] = [
  ["thread-activity", "unread-list"],
  ["scheduled-run-thread", "scheduled-origin"],
  ["tool-call-details", "collapsed"],
  ["tool-call-details", "bounded-error"],
  ["tool-call-details", "precise-result"],
  ...SHOWCASES.map((id) => [`showcase-${id}`, ""] as const),
];
const SKILL_STATES: readonly (readonly [string, string])[] = [
  ["skill-usage", "restored-after-reload"],
  ["skill-usage", "snapshot"],
  ["skill-usage", "switch-partial"],
  ["skill-usage", "menu"],
];
const MENTION_STATES: readonly (readonly [string, string])[] = [
  ["extension-mentions", "coexisting-candidates"],
  ["extension-mentions", "search-failure-isolated"],
  ["mentions", "all-reference-kinds"],
];

for (const [app, base] of APPS)
  for (const [family, samples] of [
    ["chat content", CONTENT_STATES],
    ["skill details and menu", SKILL_STATES],
    ["reference candidates", MENTION_STATES],
  ] as const)
    test(`${app}: ${family} stays reachable after narrow enlarged-text reflow`, async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      for (const [id, stateId] of samples) {
        const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
        expect(scenario.backend).toBe("mock");
        const state = scenarioStates(scenario).find(
          (entry) => entry.id === stateId,
        )!;
        expect(state, `${id}#${stateId} remains registered`).toBeDefined();
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        const unmatched: string[] = [];
        await page.route("**/api/**", async (route) => {
          const request = route.request();
          unmatched.push(
            `${request.method()} ${new URL(request.url()).pathname}`,
          );
          await route.abort("blockedbyclient");
        });
        if (id.startsWith("showcase-")) {
          await mockSavedShowcaseHistory(page, id.slice("showcase-".length));
        }
        try {
          await runScenario(
            page,
            base,
            scenario,
            DEFAULT_DIMENSION,
            state,
            30_000,
          );
          const skill = id === "skill-usage";
          const mentions = id === "mentions" || id === "extension-mentions";
          const region = page.getByRole(
            skill && stateId === "menu" ? "menu" : "region",
            { name: skill && stateId === "menu" ? undefined : "SKILL.md" },
          );
          if (skill) await expect(region).toBeVisible();
          else if (mentions)
            await expect(page.getByTestId("mention-picker")).toBeVisible();
          else
            await expect(
              page
                .getByTestId("main-message-list")
                .or(page.getByRole("tabpanel")),
            ).toBeVisible();
          if (mentions) {
            // Font-only layout invalidation must work without resize/scroll.
            await page.addStyleTag({
              content: "html{font-size:32px!important}",
            });
            await waitForFiniteAnimations(page);
            await waitForDomQuiet(page);
            await assertReferenceHeaderReachable(page);
            await page.addStyleTag({
              content: "html{font-size:16px!important}",
            });
            await waitForDomQuiet(page);
          }
          await page.setViewportSize({ width: 360, height: 800 });
          await page.addStyleTag({ content: "html{font-size:32px!important}" });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          if (skill) await expect(region).toBeVisible();
          if (mentions) await assertReferenceHeaderReachable(page);
          if (id === "tool-call-details") {
            const processingLabel = page.getByText('Use "mcp_lookup" tool', {
              exact: true,
            });
            await expect(processingLabel).toHaveCount(1);
            const processingHeader = processingLabel.locator("..");
            await expect(
              processingHeader.getByText("No usage returned", { exact: true }),
            ).toBeVisible();
            const finalDebugCard = page
              .locator('[class~="bg-muted/30"][class~="border-border/50"]')
              .filter({ hasText: "Final answer" });
            await expect(finalDebugCard).toHaveCount(1);
            await expect(finalDebugCard).not.toContainText("mcp_lookup");
            expect(
              await processingHeader.evaluate((header) => {
                const box = header.getBoundingClientRect();
                const walker = document.createTreeWalker(
                  header,
                  NodeFilter.SHOW_TEXT,
                );
                const lines: DOMRect[] = [];
                while (walker.nextNode()) {
                  if (!walker.currentNode.textContent?.trim()) continue;
                  const range = document.createRange();
                  range.selectNodeContents(walker.currentNode);
                  const textLines = Array.from(range.getClientRects()).filter(
                    (line) => line.width > 0,
                  );
                  const column =
                    walker.currentNode.parentElement!.getBoundingClientRect();
                  if (
                    textLines.some(
                      (line) =>
                        line.left < column.left - 1 ||
                        line.right > column.right + 1 ||
                        line.top < column.top - 1 ||
                        line.bottom > column.bottom + 1,
                    )
                  )
                    return false;
                  lines.push(...textLines);
                }
                return (
                  lines.length > 0 &&
                  lines.every(
                    (line) =>
                      line.left >= box.left - 1 &&
                      line.right <= box.right + 1 &&
                      line.top >= box.top - 1 &&
                      line.bottom <= box.bottom + 1,
                  )
                );
              }),
              `${id}#${stateId}: processing attribution and unavailable usage fit in full`,
            ).toBe(true);
            const details = page.getByRole("button", {
              name: "Tool details: mcp_lookup (call-4389)",
              exact: true,
            });
            const availableScrollport = await page
              .getByTestId("main-message-list")
              .locator(":scope > div")
              .evaluate((element) => element.clientHeight);
            const detailsHeight = await details.evaluate(
              (element) => element.getBoundingClientRect().height,
            );
            expect(
              availableScrollport,
              `${id}#${stateId}: the native scrollport can contain the full tool control`,
            ).toBeGreaterThanOrEqual(detailsHeight);
            await details.focus();
            // Opened states already focused this trigger before reflow. Calling
            // focus again is a DOM no-op; exercise actual keyboard re-entry.
            await page.keyboard.press("Shift+Tab");
            await expect(details).not.toBeFocused();
            await page.keyboard.press("Tab");
            await expect(details).toBeFocused();
            await expect(details).toHaveAttribute(
              "aria-expanded",
              stateId === "collapsed" ? "false" : "true",
            );
            await expect(details).toBeInViewport({ ratio: 1 });
            expect(
              await details.evaluate((button) => {
                const range = document.createRange();
                range.selectNodeContents(button);
                const box = button.getBoundingClientRect();
                return Array.from(range.getClientRects()).every(
                  (line) =>
                    line.left >= box.left - 1 &&
                    line.right <= box.right + 1 &&
                    line.top >= box.top - 1 &&
                    line.bottom <= box.bottom + 1,
                );
              }),
              `${id}#${stateId}: the entire tool trigger label fits`,
            ).toBe(true);
            const labelsFit = await page.evaluate(() => {
              const cards = Array.from(
                document.querySelectorAll<HTMLElement>(
                  '[class~="bg-muted/30"][class~="border-border/50"]',
                ),
              ).filter((card) =>
                card.querySelector(":scope > [data-slot=badge]"),
              );
              return (
                cards.length > 0 &&
                cards.every((card) => {
                  const box = card.getBoundingClientRect();
                  const walker = document.createTreeWalker(
                    card,
                    NodeFilter.SHOW_TEXT,
                  );
                  const textNodes: Node[] = [];
                  while (walker.nextNode()) {
                    if (walker.currentNode.textContent?.trim())
                      textNodes.push(walker.currentNode);
                  }
                  return textNodes.every((node) => {
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    const lines = Array.from(range.getClientRects()).filter(
                      (line) => line.width > 0,
                    );
                    return (
                      lines.length > 0 &&
                      lines.every(
                        (line) =>
                          line.left >= box.left - 1 &&
                          line.right <= box.right + 1 &&
                          line.top >= box.top - 1 &&
                          line.bottom <= box.bottom + 1,
                      )
                    );
                  });
                })
              );
            });
            expect(
              labelsFit,
              `${id}#${stateId}: all token debug labels fit their card`,
            ).toBe(true);
          }
          const survey = await page.evaluate(surveyReflow, 24);
          expect(survey.documentOverflowX, `${id}#${stateId}`).toBe(0);
          expect(
            survey.nonDeliberateHorizontalScrollers,
            `${id}#${stateId}`,
          ).toEqual([]);
          expect(survey.lostControls, `${id}#${stateId}`).toEqual([]);
          expect(survey.unreachableClips, `${id}#${stateId}`).toEqual([]);
          if (id === "thread-activity") {
            const activeTab = page.getByRole("tab", { name: "Recent chats" });
            const archivedTab = page.getByRole("tab", { name: "Archived" });
            await activeTab.focus();
            await expect(activeTab).toBeInViewport({ ratio: 1 });
            await activeTab.press("ArrowRight");
            await expect(archivedTab).toBeFocused();
            await expect(archivedTab).toBeInViewport({ ratio: 1 });
            await archivedTab.press("ArrowLeft");
            await expect(activeTab).toBeFocused();
          }
          if (skill && stateId === "menu") {
            const first = page.getByRole("menuitem").first();
            const second = page.getByRole("menuitem").nth(1);
            await first.focus();
            await expect(first).toBeInViewport({ ratio: 1 });
            await first.press("ArrowDown");
            await expect(second).toBeFocused();
            await expect(second).toBeInViewport({ ratio: 1 });
            await second.press("Escape");
            await expect(region).toBeHidden();
          }
          expect(unmatched, `${id}#${stateId}: all APIs mocked`).toEqual([]);
        } finally {
          await context.close();
        }
      }
    });
