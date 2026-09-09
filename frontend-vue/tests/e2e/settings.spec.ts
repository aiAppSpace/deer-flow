/*
  【文件职责】     Vue-owned Memory/Skills/MCP settings 的 Mock Gateway 浏览器合同。
  【架构位置】     Playwright contract
  【主要导出】     Playwright scenarios
  【依赖关系】     shared mock Gateway · Vue settings components
  【边界与注意】   Mock 只证明 deterministic UI/HTTP；Auth/CSRF/真实 manager/config write 由 wp10-real-backend 证明。
*/

import { expect, test, type Page } from "@playwright/test";
import { openSettingsDialog } from "../support/settings-dialog";

import { mockLangGraphAPI } from "./utils/mock-api";

function memoryDocument() {
  return {
    version: "2.0",
    revision: 4,
    lastUpdated: "2026-08-22T00:00:00Z",
    user: {
      workContext: { summary: "Vue parity", updatedAt: "2026-08-22" },
      personalContext: { summary: "", updatedAt: "" },
      topOfMind: { summary: "Recent work", updatedAt: "2026-08-22" },
    },
    history: {
      recentMonths: { summary: "Settings", updatedAt: "2026-08-22" },
      earlierContext: { summary: "", updatedAt: "" },
      longTermBackground: { summary: "", updatedAt: "" },
    },
    facts: [
      {
        id: "fact-a",
        content: "Explicit zero confidence is valid",
        category: "contract",
        confidence: 0.8,
        createdAt: "2026-08-22T00:00:00Z",
        source: "manual",
        revision: 2,
        updatedAt: "2026-08-22T00:00:00Z",
      },
    ],
  };
}

function mockMemory(page: Page) {
  let memory = memoryDocument();
  let importFailure = false;
  const requests: Array<{ method: string; path: string; body?: unknown }> = [];
  let reads = 0;

  void page.route(/\/api\/memory$/, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      reads += 1;
      return route.fulfill({ json: memory });
    }
    if (request.method() === "DELETE") {
      requests.push({ method: "DELETE", path });
      memory = {
        ...memory,
        revision: memory.revision + 1,
        user: {
          workContext: { summary: "", updatedAt: "" },
          personalContext: { summary: "", updatedAt: "" },
          topOfMind: { summary: "", updatedAt: "" },
        },
        history: {
          recentMonths: { summary: "", updatedAt: "" },
          earlierContext: { summary: "", updatedAt: "" },
          longTermBackground: { summary: "", updatedAt: "" },
        },
        facts: [],
      };
      return route.fulfill({ json: memory });
    }
    return route.fallback();
  });
  void page.route(/\/api\/memory\/import$/, (route) => {
    const body = route.request().postDataJSON();
    requests.push({ method: "POST", path: "/api/memory/import", body });
    if (importFailure) {
      return route.fulfill({
        status: 409,
        json: { detail: "Memory changed concurrently; reload and retry." },
      });
    }
    memory = { ...(body as ReturnType<typeof memoryDocument>), revision: 9 };
    return route.fulfill({ json: memory });
  });
  void page.route(/\/api\/memory\/facts$/, (route) => {
    const body = route.request().postDataJSON() as {
      content: string;
      category: string;
      confidence: number;
    };
    requests.push({ method: "POST", path: "/api/memory/facts", body });
    memory = {
      ...memory,
      revision: memory.revision + 1,
      facts: [
        ...memory.facts,
        {
          id: "fact-created",
          ...body,
          createdAt: "2026-08-22T01:00:00Z",
          updatedAt: "2026-08-22T01:00:00Z",
          source: "manual",
          revision: 1,
        },
      ],
    };
    return route.fulfill({ json: memory });
  });
  void page.route(/\/api\/memory\/facts\/[^/]+$/, (route) => {
    const request = route.request();
    const factId = decodeURIComponent(
      new URL(request.url()).pathname.split("/").at(-1) ?? "",
    );
    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.push({
        method: "PATCH",
        path: `/api/memory/facts/${factId}`,
        body,
      });
      memory = {
        ...memory,
        revision: memory.revision + 1,
        facts: memory.facts.map((fact) =>
          fact.id === factId
            ? { ...fact, ...body, revision: fact.revision + 1 }
            : fact,
        ),
      };
      return route.fulfill({ json: memory });
    }
    if (request.method() === "DELETE") {
      requests.push({ method: "DELETE", path: `/api/memory/facts/${factId}` });
      memory = {
        ...memory,
        revision: memory.revision + 1,
        facts: memory.facts.filter((fact) => fact.id !== factId),
      };
      return route.fulfill({ json: memory });
    }
    return route.fallback();
  });
  return {
    requests,
    get reads() {
      return reads;
    },
    failImport(value: boolean) {
      importFailure = value;
    },
  };
}

async function openSettings(
  page: Page,
  section: "memory" | "skills" | "tools",
) {
  await openSettingsDialog(page, `/workspace/chats/new?settings=${section}`);
}

test.describe("Vue settings", () => {
  test("memory renders real metadata and distinguishes search no-match", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    mockMemory(page);
    await openSettings(page, "memory");

    /*
      元数据四项都按上游的呈现规则念：category 首字母大写、confidence 念**档位**
      不念数字、createdAt 走 formatTimeAgo、source 是 `manual` 时念
      manualFactSource。时间是相对量，会随今天是哪天变，所以只断言前缀。
    */
    const factA = page.getByTestId("memory-fact-fact-a");
    await expect(factA).toContainText("Category: Contract");
    await expect(factA).toContainText("Confidence: High");
    await expect(factA).toContainText("CreatedAt:");
    await expect(factA).not.toContainText("2026-08-22T00:00:00Z");
    await expect(factA).toContainText("Manual");
    await page.getByTestId("memory-search").fill("not present");
    await expect(page.getByTestId("memory-no-matches")).toBeVisible();
    await expect(page.getByTestId("memory-empty")).toHaveCount(0);
  });

  test("invalid import is zero-request; valid import previews warnings and confirms once", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const gateway = mockMemory(page);
    await openSettings(page, "memory");
    const input = page.getByTestId("memory-import-file");

    await input.setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{oops"),
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "malformed-json" }),
    ).toBeVisible();
    expect(gateway.requests).toHaveLength(0);

    const imported = {
      ...memoryDocument(),
      futureRoot: { kept: true },
      facts: [
        memoryDocument().facts[0],
        { ...memoryDocument().facts[0], id: "fact-b" },
      ],
    };
    await input.setInputFiles({
      name: "memory.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imported)),
    });
    const preview = page.getByRole("dialog", { name: "Import memory?" });
    await expect(preview).toContainText("memory.json");
    await expect(preview).toContainText("2.0");
    await expect(preview).toContainText("2");
    await expect(page.getByTestId("memory-import-extra-warning")).toBeVisible();
    await expect(
      page.getByTestId("memory-import-duplicate-warning"),
    ).toBeVisible();
    expect(gateway.requests).toHaveLength(0);
    await preview.getByRole("button", { name: "Import", exact: true }).click();
    await expect(preview).toHaveCount(0);
    expect(
      gateway.requests.filter(
        (request) => request.path === "/api/memory/import",
      ),
    ).toHaveLength(1);
  });

  test("failed import retains preview and backend detail without duplicate request", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const gateway = mockMemory(page);
    gateway.failImport(true);
    await openSettings(page, "memory");
    await page.getByTestId("memory-import-file").setInputFiles({
      name: "memory.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(memoryDocument())),
    });
    const preview = page.getByRole("dialog", { name: "Import memory?" });
    await preview
      .getByRole("button", { name: "Import", exact: true })
      .dblclick();
    await expect(preview.getByRole("alert")).toContainText(
      "Memory changed concurrently",
    );
    expect(
      gateway.requests.filter(
        (request) => request.path === "/api/memory/import",
      ),
    ).toHaveLength(1);
  });

  test("fact create and PATCH preserve explicit zero and omitted fields", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const gateway = mockMemory(page);
    await openSettings(page, "memory");
    await page.getByTestId("memory-add-fact").click();
    await page.getByTestId("memory-fact-content").fill("Created with zero");
    await page.getByTestId("memory-fact-confidence").fill("0");
    await page
      .getByRole("dialog", { name: "Add memory fact" })
      .getByRole("button", { name: "Save fact" })
      .click();
    await expect(page.getByTestId("memory-fact-fact-created")).toContainText(
      "Created with zero",
    );
    expect(
      gateway.requests.find(
        (request) =>
          request.method === "POST" && request.path === "/api/memory/facts",
      )?.body,
    ).toEqual({
      content: "Created with zero",
      category: "context",
      confidence: 0,
    });

    await page
      .getByRole("button", { name: /Edit: Explicit zero confidence/ })
      .click();
    await page.getByTestId("memory-fact-confidence").fill("0");
    await page
      .getByRole("dialog", { name: "Edit memory fact" })
      .getByRole("button", { name: "Save fact" })
      .click();
    expect(
      gateway.requests.find((request) => request.method === "PATCH")?.body,
    ).toEqual({ confidence: 0 });
    // 0 落在 normal 档：上游只念档位，不念这个数字。
    await expect(page.getByTestId("memory-fact-fact-a")).toContainText(
      "Confidence: Normal",
    );
  });

  test("delete and clear require dialogs and mutate only after confirmation", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const gateway = mockMemory(page);
    await openSettings(page, "memory");
    await page
      .getByRole("button", { name: /Delete: Explicit zero confidence/ })
      .click();
    const removal = page.getByRole("alertdialog", {
      name: "Delete this fact?",
    });
    await expect(removal).toContainText("Explicit zero confidence is valid");
    expect(gateway.requests).toHaveLength(0);
    await removal.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByTestId("memory-fact-fact-a")).toHaveCount(0);
    await page.getByTestId("memory-clear-open").click();
    expect(
      gateway.requests.filter((request) => request.method === "DELETE"),
    ).toHaveLength(1);
    await page
      .getByRole("alertdialog", { name: "Clear all memory?" })
      .getByRole("button", { name: "Clear all memory" })
      .click();
    await expect(page.getByTestId("memory-empty")).toBeVisible();
    expect(
      gateway.requests.filter((request) => request.method === "DELETE"),
    ).toHaveLength(2);
  });

  test("auth-disabled synthetic admin manages skills and MCP through exact writes and re-reads", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    let skills = [
      {
        name: "review",
        description: "Review",
        category: "public",
        license: null,
        enabled: true,
        editable: false,
      },
    ];
    let skillReads = 0;
    let skillBody: unknown;
    await page.route(/\/api\/skills$/, (route) => {
      skillReads += 1;
      return route.fulfill({ json: { skills } });
    });
    await page.route(/\/api\/skills\/review$/, (route) => {
      skillBody = route.request().postDataJSON();
      skills = [{ ...skills[0]!, enabled: false }];
      return route.fulfill({ json: skills[0] });
    });
    let mcpReads = 0;
    let mcpBody: unknown;
    let config = {
      mcp_servers: { docs: { enabled: true, description: "Docs" } },
    };
    await page.route(/\/api\/mcp\/config$/, (route) => {
      if (route.request().method() === "GET") {
        mcpReads += 1;
        return route.fulfill({ json: config });
      }
      mcpBody = route.request().postDataJSON();
      config = {
        mcp_servers: { docs: { enabled: false, description: "Docs" } },
      };
      return route.fulfill({ json: config });
    });

    await openSettings(page, "skills");
    await page.getByRole("switch", { name: "review" }).click();
    await expect(
      page.getByRole("switch", { name: "review" }),
    ).not.toBeChecked();
    expect(skillBody).toEqual({ enabled: false });
    expect(skillReads).toBeGreaterThanOrEqual(2);
    await page.getByRole("button", { name: "Tools", exact: true }).click();
    await page.getByRole("switch", { name: "docs" }).click();
    await expect(page.getByRole("switch", { name: "docs" })).not.toBeChecked();
    expect(mcpBody).toEqual({ server_name: "docs", enabled: false });
    expect(mcpReads).toBeGreaterThanOrEqual(2);
  });
});
