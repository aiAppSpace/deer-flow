import { createServer, type ServerResponse } from "node:http";

import { expect, test, type Page } from "./support/test";
import { mockLangGraphAPI } from "../e2e/utils/mock-api";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";

const APPS = [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const;
const THREAD_ID = "00000000-0000-0000-0000-000000004701";
type ClipboardWindow = typeof window & { copiedMessageTexts: string[] };
const answer = (id: string, content: string) => ({
  type: "ai",
  id,
  content,
  additional_kwargs: { reasoning_content: "Checked the answer." },
});
const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Hold each production SSE response open across assertions and successive runs. */
async function heldStream() {
  const responses = new Set<ServerResponse>();
  let inputs: unknown[] = [];
  let run = 0;
  const server = createServer((request, response) => {
    const runId = `00000000-0000-0000-0000-${String(4702 + run++).padStart(12, "0")}`;
    response.writeHead(200, {
      "Access-Control-Allow-Origin": request.headers.origin ?? "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "Content-Location",
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      "Content-Location": `/api/threads/${THREAD_ID}/runs/${runId}`,
    });
    responses.add(response);
    response.on("close", () => responses.delete(response));
    response.write(frame("metadata", { run_id: runId, thread_id: THREAD_ID }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing stream address");
  return {
    url: `http://127.0.0.1:${address.port}/runs/stream`,
    setInputs(body: {
      input?: { messages?: unknown[] };
      stream_mode?: string[];
    }) {
      expect(body.stream_mode).toEqual(["messages-tuple", "updates", "custom"]);
      expect(body.input?.messages).toHaveLength(1);
      inputs = body.input!.messages!;
    },
    inputs: () => inputs,
    connected: () => responses.size,
    chunk(id: string, content: string, first: boolean) {
      expect(responses.size).toBe(1);
      for (const response of responses)
        response.write(
          frame("messages", [
            {
              type: "AIMessageChunk",
              id,
              content,
              additional_kwargs: first
                ? { reasoning_content: "Checked the answer." }
                : {},
              response_metadata: {},
              tool_calls: [],
              invalid_tool_calls: [],
              tool_call_chunks: [],
            },
            {},
          ]),
        );
    },
    finish() {
      expect(responses.size).toBe(1);
      for (const response of responses) response.end(frame("end", {}));
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

const copiedTexts = (page: Page) =>
  page.evaluate(() => (window as ClipboardWindow).copiedMessageTexts);

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: completed answers remain copyable across held message streams and reload`, async ({
    browser,
  }, testInfo) => {
    const samples = [];
    for (const [app, base] of APPS) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const stream = await heldStream();
      try {
        await context.addInitScript((value) => {
          localStorage.setItem("theme", value);
          localStorage.setItem("locale", "en-US");
          (window as ClipboardWindow).copiedMessageTexts = [];
          // Observe only the browser clipboard boundary; execute real copy controls and derivation.
          Object.defineProperty(navigator.clipboard, "writeText", {
            configurable: true,
            value: async (text: string) => {
              (window as ClipboardWindow).copiedMessageTexts.push(text);
            },
          });
        }, theme);
        const page = await context.newPage();
        const errors: string[] = [],
          unmatched: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/api/**", (route) => {
          unmatched.push(
            `${route.request().method()} ${new URL(route.request().url()).pathname}`,
          );
          return route.abort("failed");
        });
        let history: unknown[] = [
          { type: "human", id: "copy-old-human", content: "First question" },
          answer("copy-old-answer", "Completed historical answer."),
        ];
        const controller = mockLangGraphAPI(page, {
          threads: [
            {
              thread_id: THREAD_ID,
              title: "Copy ownership",
              messages: history,
            },
          ],
        });
        await page.route(
          `**/api/langgraph/threads/${THREAD_ID}/runs/stream`,
          (route) => {
            expect(route.request().method()).toBe("POST");
            stream.setInputs(route.request().postDataJSON());
            return route.continue({ url: stream.url });
          },
        );
        await page.goto(`${base}/workspace/chats/${THREAD_ID}`);
        const root = page.getByTestId("main-message-list");
        const turns = root.locator("[data-assistant-turn]");
        const copyButton = (index: number) =>
          turns
            .nth(index)
            .getByRole("button", { name: /^(Copy|Copied) to clipboard$/ });
        const expectedCopies: string[] = [];
        async function copy(index: number, text: string) {
          await turns.nth(index).hover();
          await copyButton(index).click();
          expectedCopies.push(text);
          await expect.poll(() => copiedTexts(page)).toEqual(expectedCopies);
        }
        await expect(turns).toHaveCount(1);
        await copy(0, "Completed historical answer.");
        for (let run = 1; run <= 2; run++) {
          const input = page.getByRole("textbox", {
            name: /how can i assist you/i,
          });
          await input.fill(`Follow-up question ${run}`);
          await input.press("Enter");
          await expect.poll(stream.connected).toBe(1);
          await expect(
            page.getByRole("button", { name: "Stop", exact: true }),
          ).toBeVisible();
          await expect(turns).toHaveCount(run);
          await copy(
            run - 1,
            run === 1
              ? "Completed historical answer."
              : "Live answer 1, complete.",
          );
          const id = `copy-live-answer-${run}`;
          stream.chunk(id, `Live answer ${run}`, true);
          await expect(turns).toHaveCount(run + 1);
          await expect(turns.nth(run)).toContainText(`Live answer ${run}`);
          await expect(copyButton(run)).toHaveCount(0);
          await copy(0, "Completed historical answer.");
          stream.chunk(id, ", complete.", false);
          await expect(turns.nth(run)).toContainText(
            `Live answer ${run}, complete.`,
          );
          await expect(copyButton(run)).toHaveCount(0);
          history = [
            ...history,
            ...stream.inputs(),
            answer(id, `Live answer ${run}, complete.`),
          ];
          controller.upsertThread({
            thread_id: THREAD_ID,
            title: "Copy ownership",
            messages: history,
          });
          stream.finish();
          await expect(
            page.getByRole("button", { name: "Stop", exact: true }),
          ).toHaveCount(0);
          await expect.poll(stream.connected).toBe(0);
          await copy(run, `Live answer ${run}, complete.`);
        }
        const beforeReload = await copiedTexts(page);
        await page.reload();
        expectedCopies.length = 0;
        await expect(turns).toHaveCount(3);
        await copy(0, "Completed historical answer.");
        await copy(1, "Live answer 1, complete.");
        await copy(2, "Live answer 2, complete.");
        expect(errors).toEqual([]);
        expect(unmatched).toEqual([]);
        samples.push({ app, beforeReload, restored: await copiedTexts(page) });
        await testInfo.attach(`${app}-${theme}-copy-ownership`, {
          body: await root.screenshot(),
          contentType: "image/png",
        });
      } finally {
        try {
          await context.close();
        } finally {
          await stream.close();
        }
      }
    }
    expect(samples[1]?.beforeReload).toEqual(samples[0]?.beforeReload);
    expect(samples[1]?.restored).toEqual(samples[0]?.restored);
    await testInfo.attach("message-copy-ownership", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });
  });
}
