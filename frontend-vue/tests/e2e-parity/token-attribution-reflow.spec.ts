import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
import { runScenario, type ParityScenario } from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

for (const [app, base] of APPS)
  for (const returnedUsage of [true, false])
    test(`${app}: shared text/tool attribution ${returnedUsage ? "with usage" : "without usage"} fits its processing consumer after reflow`, async ({
      browser,
    }) => {
      const threadId = `token-shared-${returnedUsage}`;
      const action = `Look up ${"longbackenddescription".repeat(4)}`;
      const scenario: ParityScenario = {
        id: threadId,
        title: "Shared token attribution",
        backend: "mock",
        path: `/workspace/chats/${threadId}`,
        stubs: {
          localStorage: {
            "deerflow.local-settings": JSON.stringify({
              tokenUsage: { headerTotal: true, inlineMode: "step_debug" },
            }),
          },
        },
        routes: [
          {
            pattern: "**/api/models",
            json: { models: [], token_usage: { enabled: true } },
          },
        ],
        mock: {
          threads: [
            {
              thread_id: threadId,
              title: "Token ownership",
              messages: [
                { type: "human", id: "human", content: "Review the evidence" },
                {
                  type: "ai",
                  id: "shared-ai",
                  content: "Prepared the evidence lookup.",
                  ...(returnedUsage
                    ? {
                        usage_metadata: {
                          input_tokens: 145,
                          output_tokens: 5,
                          total_tokens: 150,
                        },
                      }
                    : {}),
                  additional_kwargs: {
                    token_usage_attribution: {
                      version: 1,
                      kind: "tool_batch",
                      shared_attribution: true,
                      actions: [
                        {
                          kind: "todo_start",
                          content: "Review the collected evidence",
                        },
                        {
                          kind: "tool",
                          tool_name: "mcp_lookup",
                          description: action,
                        },
                      ],
                    },
                  },
                  tool_calls: [
                    { id: "shared-call", name: "mcp_lookup", args: {} },
                  ],
                },
                {
                  type: "tool",
                  id: "shared-result",
                  tool_call_id: "shared-call",
                  content: "Evidence found",
                },
                {
                  type: "ai",
                  id: "final-ai",
                  content: "The evidence is complete.",
                  usage_metadata: {
                    input_tokens: 30,
                    output_tokens: 5,
                    total_tokens: 35,
                  },
                },
              ],
            },
          ],
        },
        settle: [
          { kind: "visible", target: { text: "The evidence is complete." } },
        ],
      };
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      const unmatched: string[] = [];
      await page.route("**/api/**", async (route) => {
        unmatched.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        );
        await route.abort("blockedbyclient");
      });
      try {
        await runScenario(page, base, scenario);
        const summary = page
          .locator("div:has(> div > svg.lucide-coins)")
          .filter({ hasText: "Step total" });
        await expect(summary).toHaveCount(1);
        await expect(summary).toContainText(action);
        await expect(summary).toContainText(
          returnedUsage ? "150 Tokens" : "No usage returned",
        );
        const finalCard = page
          .locator('[class~="bg-muted/30"][class~="border-border/50"]')
          .filter({ hasText: "Final answer" });
        await expect(finalCard).toHaveCount(1);
        await expect(finalCard).toContainText("35 Tokens");
        await expect(finalCard).not.toContainText("mcp_lookup");
        await expect(finalCard).not.toContainText("150 Tokens");
        await page.setViewportSize({ width: 360, height: 800 });
        await page.addStyleTag({ content: "html{font-size:32px!important}" });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        await summary.scrollIntoViewIfNeeded();
        expect(
          await summary.evaluate((consumer) => {
            const box = consumer.getBoundingClientRect();
            const walker = document.createTreeWalker(
              consumer,
              NodeFilter.SHOW_TEXT,
            );
            while (walker.nextNode()) {
              const node = walker.currentNode;
              if (!node.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              const lines = Array.from(range.getClientRects()).filter(
                (line) => line.width > 0,
              );
              const textBox = node.parentElement?.getBoundingClientRect();
              if (
                !textBox ||
                lines.some(
                  (line) =>
                    line.left < textBox.left - 1 ||
                    line.right > textBox.right + 1 ||
                    line.top < textBox.top - 1 ||
                    line.bottom > textBox.bottom + 1,
                )
              )
                return false;
              if (
                !lines.length ||
                lines.some(
                  (line) =>
                    line.left < box.left - 1 ||
                    line.right > box.right + 1 ||
                    line.top < box.top - 1 ||
                    line.bottom > box.bottom + 1,
                )
              )
                return false;
              for (
                let parent = node.parentElement;
                parent && consumer.contains(parent);
                parent = parent.parentElement
              ) {
                const style = getComputedStyle(parent);
                const clip = parent.getBoundingClientRect();
                if (
                  /(hidden|clip)/.test(style.overflowX) &&
                  lines.some(
                    (line) =>
                      line.left < clip.left - 1 || line.right > clip.right + 1,
                  )
                )
                  return false;
                if (
                  /(hidden|clip)/.test(style.overflowY) &&
                  lines.some(
                    (line) =>
                      line.top < clip.top - 1 || line.bottom > clip.bottom + 1,
                  )
                )
                  return false;
              }
            }
            return true;
          }),
          "all summary text ranges remain inside their consumer and clipping ancestors",
        ).toBe(true);
        const survey = await page.evaluate(surveyReflow, 24);
        expect(survey.documentOverflowX).toBe(0);
        expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
        expect(survey.lostControls).toEqual([]);
        expect(survey.unreachableClips).toEqual([]);
        expect(unmatched).toEqual([]);
      } finally {
        await context.close();
      }
    });
