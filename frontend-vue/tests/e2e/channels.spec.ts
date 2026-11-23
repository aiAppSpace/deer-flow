import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

const channelProviders = [
  ["buzz", "Buzz", "binding_code"],
  ["telegram", "Telegram", "deep_link"],
  ["slack", "Slack", "binding_code"],
  ["discord", "Discord", "binding_code"],
  ["feishu", "Feishu", "binding_code"],
  ["dingtalk", "DingTalk", "binding_code"],
  ["wechat", "WeChat", "binding_code"],
  ["wecom", "WeCom", "binding_code"],
] as const;

type MockChannelProvider = {
  provider: string;
  display_name: string;
  enabled: boolean;
  configured: boolean;
  connectable: boolean;
  auth_mode: string;
  connection_status: string;
  unavailable_reason?: string | null;
  credential_fields?: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
  }>;
  credential_values?: Record<string, string>;
};

function defaultProviders(): MockChannelProvider[] {
  return channelProviders.map(([provider, displayName, authMode]) => ({
    provider,
    display_name: displayName,
    enabled: true,
    configured: true,
    connectable: true,
    auth_mode: authMode,
    connection_status: "connected",
    credential_fields: [
      {
        name: "token",
        label: "Token",
        type: "password",
        required: true,
      },
    ],
  }));
}

function mockChannelsAPI(
  page: Page,
  providers: MockChannelProvider[] = defaultProviders(),
  onSlackConnect?: () => void,
  initialConnections = providers
    .filter((provider) => provider.connection_status === "connected")
    .map((provider) => ({
      id: `${provider.provider}-account`,
      provider: provider.provider,
      status: "connected",
      external_account_name: `${provider.display_name} user`,
      workspace_name: "DeerFlow",
      scopes: [],
      metadata: {},
    })),
) {
  void page.route("**/api/channels/providers", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        providers,
      }),
    });
  });

  void page.route("**/api/channels/connections", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connections: initialConnections }),
    });
  });

  void page.route("**/api/channels/slack/connect", (route) => {
    onSlackConnect?.();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        provider: "slack",
        mode: "binding_code",
        url: null,
        code: "abc123",
        instruction: "Send /connect abc123 to the DeerFlow Slack bot.",
        expires_in: 600,
      }),
    });
  });
}

test.describe("IM channels", () => {
  test("sidebar and settings expose channel connections", async ({ page }) => {
    mockLangGraphAPI(page);
    mockChannelsAPI(page);

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("Channels")).toBeVisible({
      timeout: 15_000,
    });
    await expect(sidebar.getByText("Buzz")).toBeVisible();
    await expect(sidebar.getByText("Telegram")).toBeVisible();
    await expect(sidebar.getByText("Slack")).toBeVisible();
    await expect(sidebar.getByText("Discord")).toBeVisible();
    await expect(sidebar.getByText("Feishu")).toBeVisible();
    await expect(sidebar.getByText("DingTalk")).toBeVisible();
    await expect(sidebar.getByText("WeChat")).toBeVisible();
    await expect(sidebar.getByText("WeCom")).toBeVisible();

    await expect(
      sidebar.getByRole("button", { name: "Connected" }),
    ).toHaveCount(8);
    await expect(
      sidebar.getByRole("button", { name: "Add account" }),
    ).toHaveCount(0);

    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();

    await expect(
      page.getByText("Buzz channels and direct messages"),
    ).toBeVisible();
    await expect(page.getByText("Telegram direct messages")).toBeVisible();
    await expect(page.getByText("Slack workspace messages")).toBeVisible();
    await expect(page.getByText("Discord server messages")).toBeVisible();
    await expect(page.getByText("Feishu and Lark messages")).toBeVisible();
    await expect(page.getByText("DingTalk Stream Push messages")).toBeVisible();
    await expect(page.getByText("WeChat iLink messages")).toBeVisible();
    await expect(page.getByText("WeCom messages")).toBeVisible();

    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog.getByRole("button", { name: "Modify" })).toHaveCount(8);
  });

  test("only enabled providers are shown and runtime setup stays editable", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    let slackConfigured = false;
    let slackConnected = false;
    let submittedValues: Record<string, string> | undefined;

    void page.route("**/api/channels/providers", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enabled: true,
          providers: [
            {
              provider: "slack",
              display_name: "Slack",
              enabled: true,
              configured: slackConfigured,
              connectable: slackConfigured,
              auth_mode: "binding_code",
              connection_status: slackConfigured
                ? "connected"
                : "not_connected",
              credential_fields: [
                {
                  name: "bot_token",
                  label: "Bot token",
                  type: "password",
                  required: true,
                },
                {
                  name: "app_token",
                  label: "App token",
                  type: "password",
                  required: true,
                },
              ],
              credential_values: slackConfigured
                ? {
                    bot_token: "********",
                    app_token: "********",
                  }
                : {},
            },
            {
              provider: "discord",
              display_name: "Discord",
              enabled: false,
              configured: false,
              connectable: false,
              auth_mode: "binding_code",
              connection_status: "not_connected",
              credential_fields: [],
            },
          ],
        }),
      });
    });

    void page.route("**/api/channels/connections", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connections: slackConnected
            ? [
                {
                  id: "slack-account",
                  provider: "slack",
                  status: "connected",
                  external_account_name: "Slack user",
                  workspace_name: "DeerFlow",
                  scopes: [],
                  metadata: {},
                },
              ]
            : [],
        }),
      });
    });

    void page.route("**/api/channels/slack/runtime-config", async (route) => {
      const body = route.request().postDataJSON() as {
        values: Record<string, string>;
      };
      submittedValues = body.values;
      slackConfigured = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "slack",
          display_name: "Slack",
          enabled: true,
          configured: true,
          connectable: true,
          auth_mode: "binding_code",
          connection_status: "connected",
          credential_fields: [],
          credential_values: {},
        }),
      });
    });

    void page.route("**/api/channels/slack/connect", (route) => {
      slackConnected = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "slack",
          mode: "binding_code",
          url: null,
          code: "abc123",
          instruction: "Send /connect abc123 to the DeerFlow Slack bot.",
          expires_in: 600,
        }),
      });
    });

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("Slack")).toBeVisible({ timeout: 15_000 });
    await expect(sidebar.getByText("Discord")).toBeHidden();
    const connectButton = sidebar.getByRole("button", { name: "Connect" });
    await expect(connectButton).toBeEnabled();

    await connectButton.click();

    const setupDialog = page.getByRole("dialog", { name: "Connect Slack" });
    await expect(setupDialog).toBeVisible();
    const botTokenInput = setupDialog.getByLabel("Bot token");
    await expect(botTokenInput).toHaveAttribute("type", "text");
    await expect(botTokenInput).toHaveAttribute("autocomplete", "off");
    await expect(botTokenInput).toHaveAttribute("data-lpignore", "true");
    await expect(botTokenInput).toHaveAttribute("data-1p-ignore", "true");
    await expect(botTokenInput).toHaveCSS("-webkit-text-security", "disc");
    await setupDialog.getByLabel("Bot token").fill("xoxb-ui");
    await setupDialog.getByLabel("App token").fill("xapp-ui");
    await setupDialog.getByRole("button", { name: "Save and connect" }).click();

    await expect(setupDialog).toBeHidden();

    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Connected",
    );
    await expect(
      page.getByRole("dialog", { name: "Connect channel" }),
    ).toHaveCount(0);
    await expect(
      sidebar.getByRole("button", { name: "Connected" }),
    ).toBeVisible();
    expect(slackConnected).toBe(false);

    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await settings.getByRole("button", { name: "Modify" }).click();
    await expect(
      page.getByRole("dialog", { name: "Modify Slack" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bot token")).toHaveValue("********");
    await expect(page.getByLabel("App token")).toHaveValue("********");
    expect(submittedValues).toEqual({
      bot_token: "xoxb-ui",
      app_token: "xapp-ui",
    });
  });

  test("configured provider connects directly with a binding-code instruction", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    let slackConnectCalls = 0;
    mockChannelsAPI(
      page,
      [
        {
          provider: "slack",
          display_name: "Slack",
          enabled: true,
          configured: true,
          connectable: true,
          auth_mode: "binding_code",
          connection_status: "not_connected",
          credential_fields: [
            {
              name: "bot_token",
              label: "Bot token",
              type: "password",
              required: true,
            },
          ],
          credential_values: { bot_token: "********" },
        },
      ],
      () => {
        slackConnectCalls += 1;
      },
    );

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("Slack")).toBeVisible({ timeout: 15_000 });
    await sidebar.getByRole("button", { name: "Connect" }).click();

    await expect(
      page.getByText("Send /connect abc123 to the DeerFlow Slack bot."),
    ).toBeVisible();
    expect(slackConnectCalls).toBe(1);
  });

  test("runtime setup continues into the connect flow when a binding is still required", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    let slackConfigured = false;
    let slackConnectCalls = 0;

    void page.route("**/api/channels/providers", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enabled: true,
          providers: [
            {
              provider: "slack",
              display_name: "Slack",
              enabled: true,
              configured: slackConfigured,
              connectable: slackConfigured,
              auth_mode: "binding_code",
              connection_status: "not_connected",
              credential_fields: [
                {
                  name: "bot_token",
                  label: "Bot token",
                  type: "password",
                  required: true,
                },
              ],
              credential_values: {},
            },
          ],
        }),
      });
    });

    void page.route("**/api/channels/connections", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections: [] }),
      });
    });

    void page.route("**/api/channels/slack/runtime-config", (route) => {
      slackConfigured = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "slack",
          display_name: "Slack",
          enabled: true,
          configured: true,
          connectable: true,
          auth_mode: "binding_code",
          connection_status: "not_connected",
          credential_fields: [],
          credential_values: {},
        }),
      });
    });

    void page.route("**/api/channels/slack/connect", (route) => {
      slackConnectCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "slack",
          mode: "binding_code",
          url: null,
          code: "abc123",
          instruction: "Send /connect abc123 to the DeerFlow Slack bot.",
          expires_in: 600,
        }),
      });
    });

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("Slack")).toBeVisible({ timeout: 15_000 });
    await sidebar.getByRole("button", { name: "Connect" }).click();

    const setupDialog = page.getByRole("dialog", { name: "Connect Slack" });
    await expect(setupDialog).toBeVisible();
    await setupDialog.getByLabel("Bot token").fill("xoxb-ui");
    await setupDialog.getByRole("button", { name: "Save and connect" }).click();

    await expect(setupDialog).toBeHidden();
    await expect(
      page.getByText("Send /connect abc123 to the DeerFlow Slack bot."),
    ).toBeVisible();
    expect(slackConnectCalls).toBe(1);
  });

  test("runtime setup dialog prefills editable credential values", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    mockChannelsAPI(page, [
      {
        provider: "feishu",
        display_name: "Feishu",
        enabled: true,
        configured: true,
        connectable: true,
        auth_mode: "binding_code",
        connection_status: "connected",
        credential_fields: [
          {
            name: "app_id",
            label: "App ID",
            type: "text",
            required: true,
          },
          {
            name: "app_secret",
            label: "App secret",
            type: "password",
            required: true,
          },
        ],
        credential_values: {
          app_id: "cli_feishu_app",
          app_secret: "********",
        },
      },
    ]);

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("Feishu")).toBeVisible({ timeout: 15_000 });
    await expect(
      sidebar.getByRole("button", { name: "Connected" }),
    ).toBeVisible();
    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    await page
      .getByRole("dialog", { name: "Settings" })
      .getByRole("button", { name: "Modify" })
      .click();

    const setupDialog = page.getByRole("dialog", { name: "Modify Feishu" });
    await expect(setupDialog).toBeVisible();
    await expect(setupDialog.getByLabel("App ID")).toHaveValue(
      "cli_feishu_app",
    );
    await expect(setupDialog.getByLabel("App secret")).toHaveValue("********");
  });

  test("a configured provider with no binding row still reads as connected", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    mockChannelsAPI(
      page,
      [
        {
          provider: "slack",
          display_name: "Slack",
          enabled: true,
          configured: true,
          connectable: true,
          auth_mode: "binding_code",
          connection_status: "connected",
          credential_fields: [],
        },
      ],
      undefined,
      [],
    );

    await page.goto("/workspace/chats/new");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(
      sidebar.getByRole("button", { name: "Connected" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      sidebar.getByRole("button", { name: "Connect", exact: true }),
    ).toHaveCount(0);

    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings.getByTestId("channel-status-slack")).toHaveText(
      "Connected",
    );

    await expect(
      settings.getByRole("heading", { name: "Connected accounts" }),
    ).toHaveCount(0);
  });

  test("an unavailable runtime never reads as connected", async ({ page }) => {
    mockLangGraphAPI(page);
    mockChannelsAPI(
      page,
      [
        {
          provider: "slack",
          display_name: "Slack",
          enabled: true,
          configured: true,
          connectable: false,
          auth_mode: "binding_code",
          connection_status: "connected",
          unavailable_reason: "Slack runtime is not running.",
          credential_fields: [],
        },
      ],
      undefined,
      [],
    );

    await page.goto("/workspace/chats/new");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByRole("button", { name: "Connect" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      sidebar.getByRole("button", { name: "Connected" }),
    ).toHaveCount(0);
    await expect(
      sidebar.getByRole("button", { name: "Connect" }),
    ).toHaveAttribute("title", "Slack runtime is not running.");

    await sidebar.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Slack runtime is not running.",
    );

    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Settings" })
        .getByTestId("channel-status-slack"),
    ).toHaveText("Unavailable");
  });

  test("multi-account polling and the two deletion targets stay distinct", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const slack = {
      provider: "slack",
      display_name: "Slack",
      enabled: true,
      configured: true,
      connectable: true,
      auth_mode: "binding_code",
      connection_status: "not_connected",
      credential_fields: [],
    };
    let connections = [
      {
        id: "connection-a",
        provider: "slack",
        status: "connected",
        external_account_name: "Alice",
        workspace_name: "DeerFlow",
        scopes: [],
        metadata: {},
      },
    ];
    let pollReads = 0;
    let binding = false;
    const disconnectedIds: string[] = [];
    let removedProvider: string | null = null;

    void page.route("**/api/channels/providers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: true, providers: [slack] }),
      }),
    );
    void page.route("**/api/channels/connections", (route) => {
      if (binding) {
        pollReads += 1;
        if (pollReads >= 3) {
          connections = connections.map((connection) =>
            connection.id === "connection-b"
              ? { ...connection, status: "connected" }
              : connection,
          );
        }
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections }),
      });
    });
    void page.route("**/api/channels/slack/connect", (route) => {
      binding = true;
      connections = [
        ...connections,
        {
          id: "connection-b",
          provider: "slack",
          status: "pending",
          external_account_name: "Bob",
          workspace_name: "DeerFlow",
          scopes: [],
          metadata: {},
        },
      ];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "slack",
          mode: "binding_code",
          url: null,
          code: "multi123",
          instruction: "Send /connect multi123 to the DeerFlow Slack bot.",
          expires_in: 30,
        }),
      });
    });
    void page.route("**/api/channels/connections/connection-a", (route) => {
      disconnectedIds.push("connection-a");
      connections = connections.map((connection) =>
        connection.id === "connection-a"
          ? { ...connection, status: "revoked" }
          : connection,
      );
      return route.fulfill({ status: 204, body: "" });
    });
    void page.route("**/api/channels/slack/runtime-config", (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      removedProvider = "slack";
      connections = connections.map((connection) => ({
        ...connection,
        status: "revoked",
      }));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...slack,
          configured: false,
          connectable: false,
        }),
      });
    });

    await page.goto("/workspace/chats/new");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("Slack")).toBeVisible({ timeout: 15_000 });
    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });

    await settings.getByRole("button", { name: "Add account" }).click();
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Send /connect multi123 to the DeerFlow Slack bot.",
    );
    await expect(
      page.getByRole("dialog", { name: "Connect channel" }),
    ).toHaveCount(0);
    await expect(
      settings.getByTestId("channel-connection-connection-a"),
    ).toContainText("Alice · DeerFlow");
    await expect(
      settings.getByTestId("channel-connection-connection-b"),
    ).toContainText("Bob · DeerFlow");

    await settings
      .getByRole("button", { name: "Disconnect Alice · DeerFlow" })
      .click();
    await expect(
      settings.getByTestId("channel-connection-connection-a"),
    ).toContainText("Disconnected");
    expect(disconnectedIds).toEqual(["connection-a"]);

    await settings
      .getByRole("button", {
        name: "Remove provider configuration: Slack",
      })
      .click();
    // Current React submits provider removal directly from this action.
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect.poll(() => removedProvider).toBe("slack");
  });

  test("deep-link connect opens the URL without an extra instruction dialog", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    mockChannelsAPI(
      page,
      [
        {
          provider: "telegram",
          display_name: "Telegram",
          enabled: true,
          configured: true,
          connectable: true,
          auth_mode: "deep_link",
          connection_status: "not_connected",
          credential_fields: [],
        },
      ],
      undefined,
      [],
    );
    void page.route("**/api/channels/telegram/connect", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "telegram",
          mode: "deep_link",
          url: "/login",
          code: "deep123",
          instruction: "Finish the connection in Telegram.",
          expires_in: 30,
        }),
      }),
    );

    await page.goto("/workspace/chats/new");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    const sidebarPopupPromise = page.waitForEvent("popup");
    await sidebar.getByRole("button", { name: "Connect" }).click();
    const sidebarPopup = await sidebarPopupPromise;
    await sidebarPopup.waitForURL("**/login**");

    await expect(
      page.getByRole("dialog", { name: "Connect channel" }),
    ).toHaveCount(0);
    await sidebarPopup.close();

    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    const settingsPopupPromise = page.waitForEvent("popup");
    await settings
      .getByTestId("channel-provider-telegram")
      .getByRole("button", { name: "Connect" })
      .click();
    const settingsPopup = await settingsPopupPromise;
    await settingsPopup.waitForURL("**/login**");
    await expect(
      page.getByRole("dialog", { name: "Connect channel" }),
    ).toHaveCount(0);
    await settingsPopup.close();
  });

  test("finite expiry stops polling and navigation disposes the channel owner", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    let connectionReads = 0;
    void page.route("**/api/channels/providers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enabled: true,
          providers: [
            {
              provider: "slack",
              display_name: "Slack",
              enabled: true,
              configured: true,
              connectable: true,
              auth_mode: "binding_code",
              connection_status: "not_connected",
              credential_fields: [],
            },
          ],
        }),
      }),
    );
    void page.route("**/api/channels/connections", (route) => {
      connectionReads += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections: [] }),
      });
    });
    void page.route("**/api/channels/slack/connect", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "slack",
          mode: "binding_code",
          url: null,
          code: "expire123",
          instruction: "Use the short-lived code.",
          expires_in: 0.01,
        }),
      }),
    );

    await page.goto("/workspace/chats/new");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("Slack")).toBeVisible({ timeout: 15_000 });

    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    await page
      .getByRole("dialog", { name: "Settings" })
      .getByRole("button", { name: "Connect" })
      .click();
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Use the short-lived code.",
    );
    await expect(
      page.getByRole("dialog", { name: "Connect channel" }),
    ).toHaveCount(0);
    await page.waitForTimeout(2500);
    const readsAtExpiry = connectionReads;
    await page.waitForTimeout(2500);
    expect(connectionReads).toBe(readsAtExpiry);
    await page.goto("/");
    await page.waitForTimeout(2500);
    expect(connectionReads).toBe(readsAtExpiry);
  });

  test("Gateway 429 detail remains visible instead of a local success", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    mockChannelsAPI(
      page,
      [
        {
          provider: "slack",
          display_name: "Slack",
          enabled: true,
          configured: true,
          connectable: true,
          auth_mode: "binding_code",
          connection_status: "not_connected",
          credential_fields: [],
        },
      ],
      undefined,
      [],
    );
    void page.route("**/api/channels/slack/connect", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Too many pending channel connection codes.",
        }),
      }),
    );

    await page.goto("/workspace/chats/new");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await sidebar.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Too many pending channel connection codes.",
    );

    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await settings.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Too many pending channel connection codes.",
    );
  });

  test("channel query 401 follows the shared login redirect", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    void page.route("**/api/channels/providers", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            code: "not_authenticated",
            message: "Authentication required",
          },
        }),
      }),
    );
    void page.route("**/api/channels/connections", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections: [] }),
      }),
    );

    await page.goto("/workspace/chats/new");
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(
      "/workspace/chats/new",
    );
  });
});
