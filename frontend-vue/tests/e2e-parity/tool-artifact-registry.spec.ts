import { createServer, type ServerResponse } from "node:http";

import { expect, test, type Locator } from "./support/test";
import { mockLangGraphAPI } from "../e2e/utils/mock-api";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { readSavedShowcaseSnapshot } from "./support/saved-showcase-history";

const APPS = [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const;
const THREAD_ID = "00000000-0000-0000-0000-000000004691";
const RUN_ID = "00000000-0000-0000-0000-000000004692";
const toolCall = { id: "registry-make", name: "make_report", args: {} };
const message = {
  type: "ai",
  id: "registry-ai",
  content: "",
  tool_calls: [toolCall],
};
const entry = (
  handle: string,
  display_name: string,
  artifact_type = "file",
) => ({
  handle,
  tool_name: toolCall.name,
  tool_call_id: toolCall.id,
  call_index: 0,
  artifact_type,
  display_name,
  real_ref: `/mnt/user-data/outputs/${handle}`,
  created_at: "2026-01-01T00:00:00Z",
  consumed_by: [] as string[],
});
function frame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A real open response: each update is sent only after the prior DOM assertion. */
async function registryStream() {
  const responses = new Set<ServerResponse>();
  let inputs: unknown[] = [];
  const server = createServer((request, response) => {
    response.writeHead(200, {
      "Access-Control-Allow-Origin": request.headers.origin ?? "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "Content-Location",
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      "Content-Location": `/api/threads/${THREAD_ID}/runs/${RUN_ID}`,
    });
    responses.add(response);
    response.on("close", () => responses.delete(response));
    response.write(frame("metadata", { run_id: RUN_ID, thread_id: THREAD_ID }));
    // No values events: use the production messages-tuple + updates contract.
    response.write(
      frame("messages", [
        {
          ...message,
          type: "AIMessageChunk",
          additional_kwargs: {},
          response_metadata: {},
          invalid_tool_calls: [],
          tool_call_chunks: [
            { ...toolCall, args: "{}", index: 0, type: "tool_call_chunk" },
          ],
        },
        {},
      ]),
    );
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
      expect(body.input?.messages?.length).toBeGreaterThan(0);
      inputs = body.input!.messages!;
    },
    messages: () => [...inputs, message],
    update(data: unknown) {
      expect(responses.size).toBe(1);
      for (const response of responses) response.write(frame("updates", data));
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

async function presentation(badges: Locator) {
  return badges.evaluateAll((elements) =>
    elements.map((element) => {
      // Compare the browser's actual painted RGBA, not bundler-specific
      // lab()/oklch() serialization. Keep exact equality and border geometry.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Missing color normalization context");
      const rgba = (value: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const style = getComputedStyle(element);
      const icon = element.querySelector("svg")!;
      const code = element.querySelector("code")!;
      return {
        text: element.textContent?.trim(),
        title: element.getAttribute("title"),
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontFamily: style.fontFamily,
        color: rgba(style.color),
        background: rgba(style.backgroundColor),
        border: {
          color: rgba(style.borderTopColor),
          width: style.borderTopWidth,
          style: style.borderTopStyle,
        },
        radius: style.borderRadius,
        padding: style.padding,
        gap: style.gap,
        display: style.display,
        icon: [...icon.querySelectorAll("path,rect,line,polyline")].map(
          (node) => node.outerHTML,
        ),
        iconSize: [getComputedStyle(icon).width, getComputedStyle(icon).height],
        code: {
          text: code.textContent,
          font: getComputedStyle(code).fontFamily,
        },
      };
    }),
  );
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: real tool registry updates and saved history retain the same badges`, async ({
    browser,
  }, testInfo) => {
    const samples = [];
    for (const [app, base] of APPS) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const stream = await registryStream();
      try {
        await context.addInitScript((value) => {
          localStorage.setItem("theme", value);
          localStorage.setItem("locale", "en-US");
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
        const controller = mockLangGraphAPI(page, {
          threads: [{ thread_id: THREAD_ID, title: "Registry", messages: [] }],
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
        const input = page.getByRole("textbox", {
          name: /how can i assist you/i,
        });
        await input.fill("Create the report");
        await input.press("Enter");
        const root = page.getByTestId("main-message-list");
        await expect(
          root.getByText('Use "make_report" tool', { exact: true }),
        ).toBeVisible();
        const badges = root.locator(".artifact-badges > span");
        const first = entry("art_one", "<report>.csv");
        const other = {
          ...entry("art_unrelated", "Unrelated"),
          tool_call_id: "other-call",
        };
        stream.update({ capture: { tool_artifacts: [first, other] } });
        await expect(badges).toHaveCount(1);
        await expect(badges.first()).toContainText("<report>.csv");
        await expect(badges.locator("report")).toHaveCount(0);
        await expect(badges.locator("code")).toHaveText(["art_one"]);
        const folder = entry("art_folder", "Output folder", "folder");
        const consumed = {
          ...first,
          display_name: "Updated report.csv",
          consumed_by: ["reader"],
        };
        stream.update({
          capture: { tool_artifacts: [folder] },
          consume: { tool_artifacts: [consumed] },
        });
        await expect(badges).toHaveCount(2);
        await expect(badges.locator("code")).toHaveText([
          "art_one",
          "art_folder",
        ]);
        await expect(badges.first()).toContainText(consumed.display_name);
        stream.update({
          untouched: { tool_artifacts: null },
          empty: { tool_artifacts: [] },
        });
        await expect(badges).toHaveCount(2);
        stream.update({
          compact: { tool_artifacts: [{ op: "trim_to", keep: 1 }] },
        });
        await expect(badges.locator("code")).toHaveText(["art_folder"]);
        stream.update({ capture: { tool_artifacts: [consumed] } });
        await expect(badges.locator("code")).toHaveText([
          "art_folder",
          "art_one",
        ]);
        const during = await presentation(badges);
        controller.upsertThread({
          thread_id: THREAD_ID,
          title: "Registry",
          messages: stream.messages(),
          tool_artifacts: [folder, consumed],
        });
        stream.finish();
        await expect(
          page.getByRole("button", { name: "Stop", exact: true }),
        ).toHaveCount(0);
        await page.reload();
        await expect(badges.locator("code")).toHaveText([
          "art_folder",
          "art_one",
        ]);
        const restored = await presentation(badges);
        expect(restored).toEqual(during);
        expect(errors).toEqual([]);
        expect(unmatched).toEqual([]);
        samples.push({ app, during, restored });
        await testInfo.attach(`${app}-${theme}-registry`, {
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
    expect(samples[1]?.during).toEqual(samples[0]?.during);
    await testInfo.attach("registry-presentation", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });
  });
}

const SHOWCASE_ID = "21cfea46-34bd-4aa6-9e1f-3009452fbeb9";
for (const theme of ["light", "dark"] as const) {
  test(`${theme}: public Showcase consumes its complete goal and tool registry snapshot`, async ({
    browser,
  }, testInfo) => {
    const samples = [];
    for (const [app, base] of APPS) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        await context.addInitScript((value) => {
          localStorage.setItem("theme", value);
          localStorage.setItem("locale", "en-US");
        }, theme);
        const page = await context.newPage();
        const errors: string[] = [],
          unmatched: string[] = [],
          writes: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          const path = new URL(request.url()).pathname;
          if (
            path.includes("/api/") &&
            ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
            !(
              request.method() === "POST" &&
              (path === "/mock/api/threads/search" ||
                path === `/mock/api/threads/${SHOWCASE_ID}/history`)
            )
          ) {
            writes.push(`${request.method()} ${path}`);
          }
        });
        await page.route("**/api/**", (route) => {
          unmatched.push(
            `${route.request().method()} ${new URL(route.request().url()).pathname}`,
          );
          return route.abort("failed");
        });
        mockLangGraphAPI(page, { threads: [] });
        const saved = await readSavedShowcaseSnapshot(SHOWCASE_ID);
        let values = {
          title: "Public registry snapshot",
          artifacts: [],
          messages: [
            {
              type: "human",
              id: "public-human",
              content: "Make a public report",
            },
            message,
            {
              type: "tool",
              id: "public-result",
              tool_call_id: toolCall.id,
              name: toolCall.name,
              content: "Report ready",
            },
            {
              type: "ai",
              id: "public-answer",
              content: "Public report complete",
            },
          ],
          tool_artifacts: [
            entry("public_report", "Public <report>.csv"),
            entry("public_folder", "Public folder", "folder"),
          ],
          goal: {
            objective: "Publish the verified public report",
            status: "active",
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
            continuation_count: 2,
            max_continuations: 5,
            no_progress_count: 0,
            max_no_progress_continuations: 3,
          } as object | null,
        };
        let fixtureReads = 0,
          historyReads = 0;
        await page.route(
          `**/demo/threads/${SHOWCASE_ID}/thread.json`,
          (route) => {
            expect(route.request().method()).toBe("GET");
            fixtureReads++;
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ ...saved, values }),
            });
          },
        );
        await page.route(
          `**/mock/api/threads/${SHOWCASE_ID}/history`,
          (route) => {
            expect(route.request().method()).toBe("POST");
            historyReads++;
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([{ ...saved, values }]),
            });
          },
        );
        await page.goto(`${base}/showcase/${SHOWCASE_ID}`);
        const root = page.getByTestId("main-message-list");
        await expect(
          root.getByText("Public report complete", { exact: true }),
        ).toBeVisible();
        const badges = root.locator(".artifact-badges > span");
        await expect(badges.locator("code")).toHaveText([
          "public_report",
          "public_folder",
        ]);
        await expect(badges.first()).toContainText("Public <report>.csv");
        await expect(badges.locator("report")).toHaveCount(0);
        const goal = page.getByText("Publish the verified public report", {
          exact: true,
        });
        await expect(goal).toBeVisible();
        expect(app === "react" ? historyReads : fixtureReads).toBeGreaterThan(
          0,
        );
        samples.push({ app, badges: await presentation(badges) });
        await testInfo.attach(`${app}-${theme}-public-snapshot`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
        values = { ...values, goal: null, tool_artifacts: [] };
        await page.reload();
        await expect(
          root.getByText("Public report complete", { exact: true }),
        ).toBeVisible();
        await expect(goal).toHaveCount(0);
        await expect(badges).toHaveCount(0);
        expect(errors).toEqual([]);
        expect(unmatched).toEqual([]);
        expect(writes).toEqual([]);
      } finally {
        await context.close();
      }
    }
    expect(samples[1]?.badges).toEqual(samples[0]?.badges);
    await testInfo.attach("public-snapshot-presentation", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });
  });
}
