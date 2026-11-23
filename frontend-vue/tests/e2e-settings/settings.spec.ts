/*
  【文件职责】     以真实 Auth/CSRF/FastAPI/DeerMem/Noop/skills/MCP/Nuxt/Chromium 验证。
  【架构位置】     real-backend acceptance
  【主要导出】     Playwright HTTP 与 browser scenarios
  【依赖关系】     run_replay_gateway.py · settings_e2e_fixture.py · Vue Settings UI
  【边界与注意】   仅初始 operator files/home marker 是 fixture；错误分类仍经过 production router/manager/storage。
*/

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3113";
const GATEWAY_PORT = process.env.E2E_SETTINGS_GATEWAY_PORT ?? "8016";
const UNSUPPORTED_GATEWAY = `http://127.0.0.1:${process.env.E2E_SETTINGS_UNSUPPORTED_GATEWAY_PORT ?? "8017"}`;
// 与 playwright.settings.config.ts 里传给降级 Gateway 的 marker 路径必须一致。
const SETTINGS_HOME_MARKER = resolve(
  `test-results/e2e-settings-${GATEWAY_PORT}-home.txt`,
);
const PASSWORD = "very-strong-password-123";
const ADMIN_EMAIL = "e2e-wp10-admin@example.com";

async function initializeAdmin(
  request: APIRequestContext,
  app = APP,
  email = ADMIN_EMAIL,
) {
  const response = await request.post(`${app}/api/v1/auth/initialize`, {
    data: { email, password: PASSWORD },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function registerUser(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/register`, {
    data: {
      email: `e2e-wp10-user-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function loginAdmin(
  request: APIRequestContext,
  app = APP,
  email = ADMIN_EMAIL,
) {
  const response = await request.post(`${app}/api/v1/auth/login/local`, {
    form: {
      username: email,
      password: PASSWORD,
      remember_me: "true",
    },
  });
  expect(response.status(), await response.text()).toBe(200);
}

async function csrfHeaders(request: APIRequestContext) {
  const storage = await request.storageState();
  const csrf = storage.cookies.find(({ name }) => name === "csrf_token")?.value;
  expect(csrf).toBeTruthy();
  return { "X-CSRF-Token": csrf ?? "" };
}

function importDocument() {
  const fact = (id: string, confidence: number) => ({
    id,
    content: "Same content, distinct identity",
    category: "contract",
    confidence,
    createdAt: "2026-08-22T00:00:00Z",
    source: "import",
    status: "active",
    revision: 1,
    model: "future-metadata",
  });
  return {
    version: "2.0",
    lastUpdated: "2026-08-22T00:00:00Z",
    user: {
      workContext: {
        summary: "Imported real Gateway memory",
        updatedAt: "2026-08-22",
      },
      personalContext: { summary: "", updatedAt: "" },
      topOfMind: { summary: "Recent work", updatedAt: "2026-08-22" },
    },
    history: {
      recentMonths: { summary: "Settings parity", updatedAt: "2026-08-22" },
      earlierContext: { summary: "", updatedAt: "" },
      longTermBackground: { summary: "", updatedAt: "" },
    },
    facts: [fact("imported_a", 0), fact("imported_b", 1)],
    futureRoot: { sent: true },
  };
}

test.describe.serial("real Gateway settings", () => {
  test("unauthenticated settings APIs and workspace use the shared login boundary", async ({
    page,
    request,
  }) => {
    for (const endpoint of ["/api/memory", "/api/skills", "/api/mcp/config"]) {
      const response = await request.get(`${APP}${endpoint}`);
      expect(response.status(), `${endpoint}: ${await response.text()}`).toBe(
        401,
      );
    }
    await page.goto("/workspace/chats/new?settings=memory");
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test("admin Memory UI exercises CSRF, CRUD, export, legacy-compatible preview, real import, delete, and clear", async ({
    context,
    page,
  }) => {
    await initializeAdmin(context.request);
    const noCsrf = await context.request.post(`${APP}/api/memory/facts`, {
      data: { content: "missing csrf", category: "contract", confidence: 0.8 },
    });
    expect(noCsrf.status()).toBe(403);

    await page.goto("/workspace/chats/new?settings=memory");
    await page.getByTestId("memory-add-fact").click();
    await page.getByTestId("memory-fact-content").fill("Real manager fact");
    await page.getByTestId("memory-fact-category").fill("contract");
    await page.getByTestId("memory-fact-confidence").fill("0.8");
    const createdPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/memory/facts",
    );
    await page
      .getByRole("dialog", { name: "Add memory fact" })
      .getByRole("button", { name: "Save fact" })
      .click();
    const created = await createdPromise;
    expect(created.status(), await created.text()).toBe(200);
    expect(created.request().headers()["x-csrf-token"]).toBeTruthy();
    expect(created.request().postDataJSON()).toEqual({
      content: "Real manager fact",
      category: "contract",
      confidence: 0.8,
    });
    // DeerMem stores an unfamiliar category as `other` plus the original
    // categoryExtension. Editing must use the authoritative returned category.
    expect((await created.json()).facts).toContainEqual(
      expect.objectContaining({
        content: "Real manager fact",
        category: "other",
        categoryExtension: "contract",
        confidence: 0.8,
      }),
    );
    await expect(
      page.getByText("Real manager fact", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Edit: Real manager fact" }).click();
    await page.getByTestId("memory-fact-confidence").fill("0");
    const patchedPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        /\/api\/memory\/facts\//.test(new URL(response.url()).pathname),
    );
    await page
      .getByRole("dialog", { name: "Edit memory fact" })
      .getByRole("button", { name: "Save fact" })
      .click();
    const patched = await patchedPromise;
    expect(patched.status(), await patched.text()).toBe(200);
    expect(patched.request().postDataJSON()).toEqual({
      content: "Real manager fact",
      category: "other",
      confidence: 0,
    });
    // 置信度只念**档位**不念数字（上游 memory-settings-page.tsx:666），0 落在 normal 档。
    await expect(page.getByText(/Confidence: Normal/)).toBeVisible();

    await page.getByTestId("memory-add-fact").click();
    await page.getByTestId("memory-fact-content").fill("Real manager fact");
    await page
      .getByRole("dialog", { name: "Add memory fact" })
      .getByRole("button", { name: "Save fact" })
      .click();
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "same content already exists",
    );
    await page
      .getByRole("dialog", { name: "Add memory fact" })
      .getByRole("button", { name: "Cancel" })
      .click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export memory" }).click();
    const download = await downloadPromise;
    const exportedPath = await download.path();
    expect(exportedPath).toBeTruthy();
    const exported = JSON.parse(await readFile(exportedPath!, "utf8")) as {
      facts: Array<{ content: string; confidence: number; revision?: number }>;
    };
    expect(exported.facts).toContainEqual(
      expect.objectContaining({
        content: "Real manager fact",
        confidence: 0,
        revision: expect.any(Number),
      }),
    );

    const incoming = importDocument();
    await page.getByTestId("memory-import-file").setInputFiles({
      name: "real-import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
    const preview = page.getByRole("dialog", { name: "Import memory?" });
    await expect(preview).toContainText("real-import.json");
    await expect(page.getByTestId("memory-import-extra-warning")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("memory-import-duplicate-warning"),
    ).toHaveCount(0);
    const importedPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/memory/import",
    );
    await preview.getByRole("button", { name: "Import", exact: true }).click();
    const importedResponse = await importedPromise;
    expect(importedResponse.status(), await importedResponse.text()).toBe(200);
    const storedResponse = await context.request.get(`${APP}/api/memory`);
    const stored = (await storedResponse.json()) as Record<string, unknown> & {
      facts: Array<{ id: string; content: string }>;
    };
    expect(stored.facts.map(({ id }) => id)).toEqual([
      "imported_a",
      "imported_b",
    ]);
    expect(stored.facts.map(({ content }) => content)).toEqual([
      "Same content, distinct identity",
      "Same content, distinct identity",
    ]);
    expect(stored).not.toHaveProperty("futureRoot");

    await page
      .getByRole("button", { name: /Delete: Same content, distinct identity/ })
      .first()
      .click();
    const deletion = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        /\/api\/memory\/facts\//.test(new URL(response.url()).pathname),
    );
    await page
      .getByRole("dialog", { name: "Delete this fact?" })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    expect((await deletion).status()).toBe(200);
    await page.getByTestId("memory-clear-open").click();
    const clearing = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname === "/api/memory",
    );
    await page
      .getByRole("dialog", { name: "Clear all memory?" })
      .getByRole("button", { name: "Clear all memory" })
      .click();
    expect((await clearing).status()).toBe(200);
    await expect(page.getByTestId("memory-empty")).toBeVisible();

    const marker = await context.request.post(`${APP}/api/memory/facts`, {
      headers: await csrfHeaders(context.request),
      data: {
        content: "Admin-only marker",
        category: "isolation",
        confidence: 0,
      },
    });
    expect(marker.status(), await marker.text()).toBe(200);
  });

  test("real memory backends preserve 400/404/409/422/500/501 taxonomy", async ({
    context,
  }) => {
    await loginAdmin(context.request);
    const headers = await csrfHeaders(context.request);
    const backend = await context.request.get(`${APP}/api/memory/config`);
    expect(backend.status(), await backend.text()).toBe(200);
    expect(await backend.json()).toMatchObject({ manager_class: "deermem" });

    const malformed = await context.request.post(`${APP}/api/memory/facts`, {
      headers,
      data: { content: "Malformed confidence", confidence: 1.01 },
    });
    expect(malformed.status(), await malformed.text()).toBe(422);
    expect(await malformed.json()).toMatchObject({
      detail: [expect.objectContaining({ loc: ["body", "confidence"] })],
    });

    const empty = await context.request.post(`${APP}/api/memory/facts`, {
      headers,
      data: { content: "   ", confidence: 0 },
    });
    expect(empty.status(), await empty.text()).toBe(400);
    expect(await empty.json()).toEqual({
      detail: "Memory fact content cannot be empty.",
    });

    const missing = await context.request.patch(
      `${APP}/api/memory/facts/missing_fact`,
      { headers, data: { confidence: 0 } },
    );
    expect(missing.status(), await missing.text()).toBe(404);
    expect(await missing.json()).toEqual({
      detail: "Memory fact 'missing_fact' not found.",
    });

    const duplicateBody = {
      content: "Real duplicate classification",
      category: "contract",
      confidence: 0,
    };
    const firstDuplicate = await context.request.post(
      `${APP}/api/memory/facts`,
      { headers, data: duplicateBody },
    );
    expect(firstDuplicate.status(), await firstDuplicate.text()).toBe(200);
    const duplicate = await context.request.post(`${APP}/api/memory/facts`, {
      headers,
      data: duplicateBody,
    });
    expect(duplicate.status(), await duplicate.text()).toBe(409);
    expect(await duplicate.json()).toEqual({
      detail: "A fact with the same content already exists.",
    });

    const raceDocuments = Array.from({ length: 12 }, (_, index) => ({
      ...importDocument(),
      facts: [
        {
          ...importDocument().facts[0],
          id: `race_${index}`,
          content: `Concurrent import ${index}`,
        },
      ],
    }));
    const raced = await Promise.all(
      raceDocuments.map((data) =>
        context.request.post(`${APP}/api/memory/import`, { headers, data }),
      ),
    );
    const statuses = raced.map((response) => response.status());
    // 12 路并发写同一份 memory.json，红起来是间歇的（wave 102 撞到一次，重跑两次
    // 都绿）。断言不带消息的话，日志里只有 `Expected true / Received false`——
    // 到底是 500 还是 429 还是别的，事后无从查起，只能重跑。同一个文件上面那条
    // `expect(duplicate.status(), await duplicate.text())` 已经是这个写法。
    const statusSummary = `12 路并发 import 的实际状态码：${JSON.stringify(statuses)}`;
    expect(statuses, statusSummary).toContain(200);
    expect(statuses, statusSummary).toContain(409);
    expect(
      statuses.every((status) => status === 200 || status === 409),
      statusSummary,
    ).toBe(true);
    const conflict = raced.find((response) => response.status() === 409);
    expect(await conflict!.json()).toEqual({
      detail: "Memory changed concurrently; reload and retry.",
    });

    const me = await context.request.get(`${APP}/api/v1/auth/me`);
    expect(me.status(), await me.text()).toBe(200);
    const { id: userId } = (await me.json()) as { id: string };
    const settingsHome = (await readFile(SETTINGS_HOME_MARKER, "utf8")).trim();
    const memoryPath = join(settingsHome, "users", userId, "memory.json");
    const savedMemory = await readFile(memoryPath, "utf8");
    let corrupted;
    try {
      await writeFile(memoryPath, "{not-valid-json", "utf8");
      corrupted = await context.request.post(`${APP}/api/memory/reload`, {
        headers,
      });
    } finally {
      await writeFile(memoryPath, savedMemory, "utf8");
    }
    expect(corrupted?.status(), await corrupted?.text()).toBe(500);
    expect(await corrupted!.json()).toEqual({
      detail: "Stored memory data is corrupted.",
    });
    const recovered = await context.request.post(`${APP}/api/memory/reload`, {
      headers,
    });
    expect(recovered.status(), await recovered.text()).toBe(200);

    const noopAdmin = "e2e-wp10-noop-admin@example.com";
    const noopRequest = await playwrightRequest.newContext();
    try {
      await initializeAdmin(noopRequest, UNSUPPORTED_GATEWAY, noopAdmin);
      const noopBackend = await noopRequest.get(
        `${UNSUPPORTED_GATEWAY}/api/memory/config`,
      );
      expect(noopBackend.status(), await noopBackend.text()).toBe(200);
      expect(await noopBackend.json()).toMatchObject({ manager_class: "noop" });
      const unsupported = await noopRequest.post(
        `${UNSUPPORTED_GATEWAY}/api/memory/facts`,
        {
          headers: await csrfHeaders(noopRequest),
          data: { content: "Unsupported real backend" },
        },
      );
      expect(unsupported.status(), await unsupported.text()).toBe(501);
      expect(await unsupported.json()).toEqual({
        detail:
          "Operation 'create fact' not supported by memory backend 'NoopMemoryManager'.",
      });
    } finally {
      await noopRequest.dispose();
    }
  });

  test("ordinary user reads skills, has isolated memory, and sends no admin-only settings I/O", async ({
    context,
    page,
  }) => {
    await registerUser(context.request);
    const memory = await context.request.get(`${APP}/api/memory`);
    expect(memory.status(), await memory.text()).toBe(200);
    expect(((await memory.json()) as { facts: unknown[] }).facts).toEqual([]);
    const skills = await context.request.get(`${APP}/api/skills`);
    expect(skills.status(), await skills.text()).toBe(200);
    expect(await skills.json()).toMatchObject({
      skills: [{ name: "review", enabled: true }],
    });
    const headers = await csrfHeaders(context.request);
    const forbiddenSkill = await context.request.put(
      `${APP}/api/skills/review`,
      {
        headers,
        data: { enabled: false },
      },
    );
    expect(forbiddenSkill.status()).toBe(403);
    const forbiddenMcp = await context.request.get(`${APP}/api/mcp/config`);
    expect(forbiddenMcp.status()).toBe(403);

    let mcpRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/mcp/config")
        mcpRequests += 1;
    });
    await page.goto("/workspace/capabilities?tab=skills");
    await expect(page.getByText("review", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Enable skill review", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Install .skill", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("tab", { name: "Tools & integrations", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Platform provided", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator('section[aria-labelledby="platform-plugins-heading"]')
        .getByRole("switch"),
    ).toHaveCount(0);
    expect(mcpRequests).toBe(0);
  });

  test("admin skill and MCP writes preserve each other and re-read real config", async ({
    context,
    page,
  }) => {
    await loginAdmin(context.request);
    await page.goto("/workspace/capabilities?tab=skills");
    const skillWrite = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === "/api/skills/review",
    );
    await page
      .getByRole("switch", { name: "Enable skill review", exact: true })
      .click();
    const skillResponse = await skillWrite;
    expect(skillResponse.status(), await skillResponse.text()).toBe(200);
    expect(skillResponse.request().postDataJSON()).toEqual({ enabled: false });
    expect(skillResponse.request().headers()["x-csrf-token"]).toBeTruthy();
    await expect(
      page.getByRole("switch", { name: "Enable skill review", exact: true }),
    ).not.toBeChecked();

    const mcpBefore = await context.request.get(`${APP}/api/mcp/config`);
    expect(mcpBefore.status(), await mcpBefore.text()).toBe(200);
    const mcpBeforeBody = (await mcpBefore.json()) as {
      mcp_servers: { docs: { enabled: boolean; env: Record<string, string> } };
    };
    expect(mcpBeforeBody.mcp_servers.docs.enabled).toBe(true);
    expect(JSON.stringify(mcpBeforeBody)).not.toContain("must-stay-masked");

    await page
      .getByRole("tab", { name: "Tools & integrations", exact: true })
      .click();
    const mcpWrite = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/mcp/config",
    );
    await page
      .getByRole("switch", {
        name: "Enabled docs (Platform provided)",
        exact: true,
      })
      .click();
    const mcpResponse = await mcpWrite;
    expect(mcpResponse.status(), await mcpResponse.text()).toBe(200);
    expect(mcpResponse.request().postDataJSON()).toEqual({
      server_name: "docs",
      enabled: false,
    });
    expect(mcpResponse.request().headers()["x-csrf-token"]).toBeTruthy();
    await expect(
      page.getByRole("switch", {
        name: "Enabled docs (Platform provided)",
        exact: true,
      }),
    ).not.toBeChecked();

    const skillsAfter = await context.request.get(`${APP}/api/skills`);
    expect(await skillsAfter.json()).toMatchObject({
      skills: [{ name: "review", enabled: false }],
    });
    const mcpAfter = await context.request.get(`${APP}/api/mcp/config`);
    expect(await mcpAfter.json()).toMatchObject({
      mcp_servers: { docs: { enabled: false } },
    });
  });
});
