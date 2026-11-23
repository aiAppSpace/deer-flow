import { expect, test, type Page } from "@playwright/test";
import { openSettingsDialog } from "../support/settings-dialog";
import { mockLangGraphAPI } from "./utils/mock-api";
function provider(configured = false, connected = false) {
  return {
    provider: "wechat",
    display_name: "WeChat",
    enabled: true,
    configured,
    connectable: configured,
    auth_mode: "binding_code",
    connection_status: connected ? "connected" : "not_connected",
    credential_fields: [
      {
        name: "bot_token",
        label: "Bot token",
        type: "password",
        required: true,
      },
    ],
    credential_values: configured ? { bot_token: "********" } : {},
  };
}
async function fixture(page: Page) {
  mockLangGraphAPI(page);
  const state = {
    configured: false,
    connected: false,
    verifies: [] as string[],
    cancelled: [] as string[],
    failStart: false,
    poll: 0,
  };
  await page.route("**/api/channels/providers", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        providers: [provider(state.configured, state.connected)],
      },
    }),
  );
  await page.route("**/api/channels/connections", (route) =>
    route.fulfill({
      json: {
        connections: state.connected
          ? [
              {
                id: "wechat-binding",
                provider: "wechat",
                status: "connected",
                scopes: [],
                metadata: {},
              },
            ]
          : [],
      },
    }),
  );
  await page.route("**/api/channels/wechat/qr-login", (route) =>
    state.failStart
      ? route.fulfill({
          status: 503,
          json: { detail: "WeChat QR login requires a single Gateway worker." },
        })
      : route.fulfill({
          json: {
            id: "session",
            status: "pending",
            qrcode_content: "https://wechat.example.test/scan",
            expires_in: 60,
            provider: null,
          },
        }),
  );
  await page.route("**/api/channels/wechat/qr-login/session", (route) => {
    state.cancelled.push("session");
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/channels/wechat/qr-login/session/poll", (route) => {
    state.poll++;
    const body = route.request().postDataJSON() as {
      verify_code?: string;
    } | null;
    if (body?.verify_code) {
      state.verifies.push(body.verify_code);
      state.configured = true;
    }
    return route.fulfill({
      json: {
        id: "session",
        status: state.configured ? "confirmed" : "verification_required",
        qrcode_content: "https://wechat.example.test/scan",
        expires_in: 60,
        provider: state.configured ? provider(true) : null,
      },
    });
  });
  await page.route("**/api/channels/wechat/connect", (route) =>
    route.fulfill({
      json: {
        provider: "wechat",
        mode: "binding_code",
        code: "bind-code",
        instruction: "Send /connect bind-code",
        expires_in: 60,
      },
    }),
  );
  await page.route("**/api/channels/wechat/runtime-config", (route) => {
    state.configured = true;
    return route.fulfill({ json: provider(true) });
  });
  return state;
}
async function open(page: Page) {
  await page.goto("/workspace/chats/new");
  await page
    .locator("[data-sidebar='sidebar']")
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Connect WeChat", exact: true });
}
test("WeChat QR verifies credentials, binds the user and finishes at a narrow viewport", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  // Open via settings on mobile: the desktop sidebar is intentionally unmounted.
  await openSettingsDialog(page, "/workspace/chats/new?settings=channels");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings
    .getByTestId("channel-provider-wechat")
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Connect WeChat",
    exact: true,
  });
  await expect(
    dialog.getByRole("img", { name: "WeChat login QR code" }),
  ).toBeVisible();
  const input = dialog.getByLabel("Pairing code");
  await expect(input).toBeVisible();
  await input.fill("123456");
  await dialog
    .getByRole("button", { name: "Continue connecting", exact: true })
    .click();
  await expect.poll(() => state.verifies).toEqual(["123456"]);
  await expect(dialog.locator("code")).toHaveText("/connect bind-code");
  state.connected = true;
  await expect(
    dialog.getByText("WeChat is connected", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toBeHidden();
});
test("WeChat QR 503 remains actionable and token mode remains available", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failStart = true;
  const dialog = await open(page);
  await expect(dialog).toContainText(
    "WeChat QR login requires a single Gateway worker.",
  );
  state.failStart = false;
  await dialog.getByRole("button", { name: "Refresh QR code" }).click();
  await expect(
    dialog.getByRole("img", { name: "WeChat login QR code" }),
  ).toBeVisible();
  await dialog.getByRole("tab", { name: "Use token" }).click();
  await dialog.getByLabel("Bot token").fill("manual-token");
  await dialog.getByRole("button", { name: "Save and connect" }).click();
  await expect(dialog.locator("code")).toHaveText("/connect bind-code");
});
test("closing WeChat QR cancels its server session and leaves the workspace usable", async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = await open(page);
  await expect(
    dialog.getByRole("img", { name: "WeChat login QR code" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state.cancelled).toEqual(["session"]);
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
});
