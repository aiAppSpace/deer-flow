import { expect, test, type APIRequestContext } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3111";
const PASSWORD = "very-strong-password-123";

async function initializeAdmin(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/initialize`, {
    data: {
      email: `e2e-wp08-admin-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function registerUser(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/register`, {
    data: {
      email: `e2e-wp08-user-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function csrfHeaders(request: APIRequestContext) {
  const storage = await request.storageState();
  const csrf = storage.cookies.find(({ name }) => name === "csrf_token")?.value;
  expect(csrf).toBeTruthy();
  return { "X-CSRF-Token": csrf ?? "" };
}

async function openChannelSettings(page: import("@playwright/test").Page) {
  await page.goto("/workspace/chats/new");
  const sidebar = page.locator("[data-sidebar='sidebar']");
  await expect(sidebar.getByText("Slack")).toBeVisible({ timeout: 15_000 });
  await sidebar.getByRole("button", { name: /Settings and more/ }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Channels" }).click();
  return page.getByRole("dialog", { name: "Settings" });
}

test("real Gateway rejects an unauthenticated channel read", async ({
  request,
}) => {
  const response = await request.get(`${APP}/api/channels/providers`);
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({
    detail: {
      code: "not_authenticated",
      message: "Authentication required",
    },
  });
});

test("admin completes real scoped multi-account lifecycle through the Vue UI", async ({
  context,
  page,
}) => {
  await initializeAdmin(context.request);
  const headers = await csrfHeaders(context.request);

  const seededAlice = await context.request.post(
    `${APP}/api/test-only/channels/seed-connection`,
    {
      headers,
      data: {
        provider: "slack",
        external_account_id: "U-ALICE",
        external_account_name: "Alice",
        workspace_id: "T-DEERFLOW",
        workspace_name: "DeerFlow E2E",
      },
    },
  );
  expect(seededAlice.status(), await seededAlice.text()).toBe(200);
  const alice = (await seededAlice.json()) as { id: string };

  const seededOtherUser = await context.request.post(
    `${APP}/api/test-only/channels/seed-connection`,
    {
      headers,
      data: {
        provider: "slack",
        external_account_id: "U-OTHER",
        external_account_name: "Other user",
        owner_user_id: "other-user-fixture",
      },
    },
  );
  expect(seededOtherUser.status(), await seededOtherUser.text()).toBe(200);

  const scopedList = await context.request.get(
    `${APP}/api/channels/connections`,
  );
  expect(scopedList.status(), await scopedList.text()).toBe(200);
  expect(
    (
      (await scopedList.json()) as {
        connections: Array<{ external_account_name: string }>;
      }
    ).connections.map(({ external_account_name }) => external_account_name),
  ).toEqual(["Alice"]);

  const settings = await openChannelSettings(page);
  const slackPanel = settings.getByTestId("channel-provider-slack");
  await expect(
    slackPanel.getByTestId(`channel-connection-${alice.id}`),
  ).toContainText("Alice · DeerFlow E2E");

  const runtimeConfigResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/channels/slack/runtime-config",
  );
  await slackPanel.getByRole("button", { name: "Modify" }).click();
  const setupDialog = page.getByRole("dialog", { name: "Modify Slack" });
  await setupDialog.getByLabel("Bot token").fill("xoxb-updated-e2e");
  await setupDialog.getByLabel("App token").fill("xapp-updated-e2e");
  await setupDialog.getByRole("button", { name: "Save changes" }).click();
  expect((await runtimeConfigResponse).status()).toBe(200);
  await expect(setupDialog).toBeHidden();

  const connectResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/channels/slack/connect",
  );
  await slackPanel.getByRole("button", { name: "Add account" }).click();
  const connectResponse = await connectResponsePromise;
  expect(connectResponse.status(), await connectResponse.text()).toBe(200);
  const connect = (await connectResponse.json()) as {
    code: string;
    expires_in: number;
    instruction: string;
    url: string | null;
  };
  expect(connect).toMatchObject({ expires_in: 600, url: null });
  expect(connect.instruction).toContain(`/connect ${connect.code}`);

  await expect(
    page
      .getByTestId("channel-provider-slack")
      .locator("button")
      .filter({ hasText: /^\s*Add account\s*$/ }),
  ).toBeEnabled();

  const completed = await context.request.post(
    `${APP}/api/test-only/channels/complete`,
    {
      headers,
      data: {
        provider: "slack",
        code: connect.code,
        external_account_id: "U-BOB",
        external_account_name: "Bob",
        workspace_id: "T-DEERFLOW",
        workspace_name: "DeerFlow E2E",
      },
    },
  );
  expect(completed.status(), await completed.text()).toBe(200);
  const bob = (await completed.json()) as { id: string };

  await expect(page.getByTestId("workspace-toaster")).toContainText(
    connect.instruction,
  );
  await expect(
    page.getByRole("dialog", { name: "Connect channel" }),
  ).toHaveCount(0);
  await expect(
    slackPanel.getByTestId(`channel-connection-${bob.id}`),
  ).toContainText("Bob · DeerFlow E2E");

  const disconnectResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname ===
        `/api/channels/connections/${alice.id}`,
  );
  await slackPanel
    .getByRole("button", { name: "Disconnect Alice · DeerFlow E2E" })
    .click();
  expect((await disconnectResponsePromise).status()).toBe(204);
  await expect(
    slackPanel.getByTestId(`channel-connection-${alice.id}`),
  ).toContainText("Disconnected");

  const missing = await context.request.delete(
    `${APP}/api/channels/connections/not-owned-or-missing`,
    { headers },
  );
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({
    detail: "Channel connection not found",
  });
  const unknown = await context.request.post(
    `${APP}/api/channels/not-a-provider/connect`,
    { headers },
  );
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toEqual({ detail: "Unknown channel provider" });

  const telegramCodes: Array<{ code: string; url: string }> = [];
  for (let index = 0; index < 5; index += 1) {
    const response = await context.request.post(
      `${APP}/api/channels/telegram/connect`,
      { headers },
    );
    expect(response.status(), await response.text()).toBe(200);
    telegramCodes.push(
      (await response.json()) as { code: string; url: string },
    );
  }
  expect(telegramCodes[0]?.url).toBe(
    `https://t.me/deerflow_e2e_bot?start=${telegramCodes[0]?.code}`,
  );
  const telegramPanel = settings.getByTestId("channel-provider-telegram");
  await telegramPanel.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByTestId("workspace-toaster")).toContainText(
    "Too many pending channel connection codes. Wait for existing codes to expire or use one of them.",
  );

  const providerDeleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === "/api/channels/slack/runtime-config",
  );
  await slackPanel
    .getByRole("button", { name: "Remove provider configuration: Slack" })
    .click();
  expect((await providerDeleteResponse).status()).toBe(200);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  const afterProviderRemoval = await context.request.get(
    `${APP}/api/channels/connections`,
  );
  const currentRows = (
    (await afterProviderRemoval.json()) as {
      connections: Array<{ provider: string; status: string }>;
    }
  ).connections.filter(({ provider }) => provider === "slack");
  expect(currentRows).toHaveLength(2);
  expect(currentRows.every(({ status }) => status === "revoked")).toBe(true);

  const slackUnavailable = await context.request.post(
    `${APP}/api/channels/slack/connect`,
    { headers },
  );
  expect(slackUnavailable.status()).toBe(400);
  expect(await slackUnavailable.json()).toEqual({
    detail: "Enter the required Slack credentials to connect this channel.",
  });
});

test("real Gateway isolates a second user and rejects provider removal with 403", async ({
  context,
}) => {
  await registerUser(context.request);
  const headers = await csrfHeaders(context.request);
  const seeded = await context.request.post(
    `${APP}/api/test-only/channels/seed-connection`,
    {
      headers,
      data: {
        provider: "telegram",
        external_account_id: "TG-CHARLIE",
        external_account_name: "Charlie",
      },
    },
  );
  expect(seeded.status(), await seeded.text()).toBe(200);

  const list = await context.request.get(`${APP}/api/channels/connections`);
  expect(list.status(), await list.text()).toBe(200);
  expect(
    (
      (await list.json()) as {
        connections: Array<{ external_account_name: string }>;
      }
    ).connections.map(({ external_account_name }) => external_account_name),
  ).toEqual(["Charlie"]);

  const forbidden = await context.request.delete(
    `${APP}/api/channels/telegram/runtime-config`,
    { headers },
  );
  expect(forbidden.status()).toBe(403);
  expect(await forbidden.json()).toEqual({
    detail: "Admin privileges required to manage channel runtime credentials.",
  });
});
