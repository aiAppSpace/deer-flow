/*
  【文件职责】     Vue channel settings contracts；验证与 React 产品行为对齐的 Vue 实现。
  【架构位置】     测试
  【主要导出】     Playwright Vue M7 scenarios
  【依赖关系】     frontend shared mock API；Vue product routes and DOM
  【边界与注意】   Vue 使用自身 DOM 与门禁，不依赖 React 组件结构。
*/

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
    /*
      侧栏是 WorkspaceChannelsList，一个 provider 一行一个按钮，措辞与 React 的
      workspace-channels-list.tsx 一致：连上就是 Connected。「Add account」是设置页
      多账号面板才有的措辞，不该出现在侧栏。
    */
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

    /*
      保存后 runtime-config 回的 provider 已经是 connected，于是 providerCanConnect 为假，
      侧栏不再发 /connect，只 toast 一句「已连接」——与 React 侧栏同一条分支。
      设置页的 Connect channel 对话框不属于侧栏，这里不该出现。
    */
    await expect(setupDialog).toBeHidden();
    /* 成功 toast 是 role=status；只有错误 toast 才是 role=alert。 */
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

  /*
    auth 关闭部署下 Gateway 对「配好且跑起来」的 provider 直接回 connection_status
    connected，而 /connections 一行都没有——那种部署里每条渠道消息都路由到默认用户，
    根本不存在 binding row。这里的夹具就是那个形状。

    此前本仓只认 connections，于是这种部署下侧栏永远写着 Connect，点下去还会去发起
    一次毫无意义的绑定。负向验证：把 core/channels/state.ts 的 provider.connection_status
    回落删掉，或把 WorkspaceChannelsList 的 isConnected 改成读 connections，这条立刻红。
  */
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
    /*
      这种形状下**一行 binding row 都没有**，所以账号列表整块不渲染——
      「已连接」的徽标底下再挂一句「尚无渠道账号」是自相矛盾的，
      理由写在 ChannelConnections.vue 那个 `v-if="view.connections.length > 0"`
      的注释里。原来这里断言的是那句空态文案可见，现在断言它整块不存在。
    */
    await expect(
      settings.getByRole("heading", { name: "Connected accounts" }),
    ).toHaveCount(0);
  });

  /*
    反过来：runtime 不可用时，哪怕 provider 还挂着 connected，也不能报「已连接」。
    负向验证：删掉 buildChannelProviderViews 与 WorkspaceChannelsList 里的
    unavailable_reason 守卫，这条立刻红。
  */
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

    /* connectable=false，所以点下去只报不可用，不发 /connect。 */
    await sidebar.getByRole("button", { name: "Connect" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /\S/ }),
    ).toContainText("Slack runtime is not running.");

    /*
      设置页那一行也不能写「已连接」：停用/未配置/不可用排在连接状态之前，
      与 React 设置页 getStatusLabel 同序。负向验证：删掉
      getChannelProviderStatusKey 里的 unavailable_reason 前置判据，这条立刻红
      （夹具里那个 provider 的 status 已经是 connected）。
    */
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
    const connectDialog = page.getByRole("dialog", { name: "Connect channel" });
    await expect(connectDialog).toContainText(
      "Send /connect multi123 to the DeerFlow Slack bot.",
    );
    // connect 对话框是叠在 settings 之上的模态层，Reka 会把背景（含 settings 内容）
    // 标成 aria-hidden，所以这条断言不能再走 role 查询。
    await expect(
      page.locator('[data-testid="settings-dialog"] button', {
        hasText: "Add account",
      }),
    ).toBeDisabled();
    await expect(connectDialog.getByTestId("channel-connect-state")).toHaveText(
      "Connected",
      { timeout: 10_000 },
    );
    /*
      对话框里现在有两颗 Close:footer 那颗(流程结束后的主按钮)与右上角 primitive
      的那颗(与 React 每个对话框都有的那颗同源)。这里点的一直是 footer 那颗,
      按 data-slot 锁定,避免 strict mode 命中两个。
    */
    await connectDialog
      .locator('[data-slot="button"]')
      .filter({ hasText: /^Close$/ })
      .click();
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
    // 移除 provider 配置是破坏性动作，语义上是 alertdialog。
    const removalDialog = page.getByRole("alertdialog", {
      name: "Remove Slack provider configuration?",
    });
    await expect(removalDialog).toContainText(
      "revokes every active connection",
    );
    await removalDialog
      .getByRole("button", { name: "Remove provider configuration" })
      .click();
    expect(removedProvider).toBe("slack");
  });

  test("deep-link connect opens the URL and keeps its instruction visible", async ({
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
    /*
      侧栏只把 URL 打开，不开对话框——React 的 workspace-channels-list.tsx 在
      result.url 分支上就是 openConnectUrl 然后 return，指引留给设置页。
    */
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
    ).toContainText("Finish the connection in Telegram.");
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
    /*
      到期与轮询是 useChannelConnections 的生命周期，两个界面共用；断言挂在设置页，
      因为 Connect channel 对话框只有设置页有——侧栏对照 React，只 toast 指引。
    */
    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    await page
      .getByRole("dialog", { name: "Settings" })
      .getByRole("button", { name: "Connect" })
      .click();
    const connectDialog = page.getByRole("dialog", { name: "Connect channel" });
    await expect(
      connectDialog.getByTestId("channel-connect-state"),
    ).toContainText("expired", { timeout: 10_000 });
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
    /*
      侧栏走 toast（React 的 workspace-channels-list.tsx 是 toast.error），
      toast 自带一个关闭按钮，所以是 contain 而不是等于；设置页那条是段落，才能等于。
    */
    await expect(
      page.getByRole("alert").filter({ hasText: /\S/ }),
    ).toContainText("Too many pending channel connection codes.");

    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Channels" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await settings.getByRole("button", { name: "Connect" }).click();
    await expect(settings.getByRole("alert")).toHaveText(
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
