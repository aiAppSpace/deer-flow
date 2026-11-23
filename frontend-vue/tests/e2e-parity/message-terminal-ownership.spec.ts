import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
} from "./support/scenarios";

const variants = [
  ...(["human", "ai"] as const).map((previous) => ({
    name: `orphan after ${previous}`,
    messages: [
      { id: "start", type: "human", content: "Inspect the completed reply" },
      { id: "previous", type: previous, content: "Earlier message" },
      {
        id: "orphan",
        type: "tool",
        name: "bash",
        tool_call_id: "unloaded-call",
        content: "Late **tool body**",
      },
    ],
    text: "tool body",
    selector: '[data-streamdown="strong"]',
  })),
  {
    name: "mixed task and read call",
    messages: [
      { id: "start", type: "human", content: "Delegate this" },
      {
        id: "delegate",
        type: "ai",
        content: "",
        tool_calls: [
          {
            id: "task-1",
            type: "tool_call",
            name: "task",
            args: {
              description: "Investigate",
              prompt: "Read the files",
              subagent_type: "general-purpose",
            },
          },
          {
            id: "read-1",
            type: "tool_call",
            name: "read_file",
            args: { path: "private-diagnostic-marker.txt" },
          },
        ],
      },
    ],
    text: "Investigate",
    selector: undefined,
  },
];

for (const variant of variants) {
  test(`terminal message owner: ${variant.name} renders the same real page content`, async ({
    browser,
  }, testInfo) => {
    const original = PARITY_SCENARIOS.find(
      (item) => item.id === "workspace-changes",
    )!;
    const scenario = {
      ...original,
      settle: [],
      mock: {
        ...original.mock,
        threads: original.mock!.threads!.map((thread) => ({
          ...thread,
          messages: variant.messages,
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
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await runScenario(page, base, scenario, DEFAULT_DIMENSION, {
          id: "terminal-owner",
          steps: [],
        });
        const root = page.getByTestId("main-message-list");
        await expect(
          root.getByText(variant.text, { exact: true }),
        ).toBeVisible();
        await expect(root.locator("details")).toHaveCount(0);
        await expect(root).not.toContainText("private-diagnostic-marker.txt");
        await expect(root.getByText("Read File", { exact: true })).toHaveCount(
          0,
        );
        if (variant.selector)
          await expect(root.locator(variant.selector)).toHaveText("tool body");
        expect(errors).toEqual([]);
        rows.push({ app, text: await root.innerText() });
        await testInfo.attach(`${app}-terminal-owner`, {
          body: await root.screenshot(),
          contentType: "image/png",
        });
      } finally {
        await context.close();
      }
    }
    await testInfo.attach("terminal-owner-text", {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
    });
    expect(rows[1]!.text).toBe(rows[0]!.text);
  });
}
