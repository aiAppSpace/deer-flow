import { expect, test } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

function configuredLarkStatus() {
  return {
    installed: true,
    version: "v1.0.65",
    manifest_version: "v1.0.65",
    latest_available_version: "v1.0.65",
    runtime_version_mismatch: false,
    app_configured: true,
    app_id: "cli_existing_mock",
    app_brand: "feishu",
    skills_expected: 27,
    skills_installed: 4,
    installed_skills: ["lark-doc", "lark-im", "lark-shared", "lark-sheets"],
    enabled_skills: ["lark-doc", "lark-im", "lark-shared", "lark-sheets"],
    install_path: "/mock/integrations/skills/lark-cli",
    cli: {
      available: true,
      path: "/usr/bin/lark-cli",
      version: "lark-cli version v1.0.65",
      error: null,
    },
    auth: {
      status: "authenticated",
      message: "Lark authorization is live-verified.",
      user: "existing-user",
      verified: true,
    },
    sandbox_runtime_mode: "none",
    sandbox_runtime_ready: false,
    sandbox_runtime_detail: null,
  };
}

test.describe("Integrations settings", () => {
  test("opens integrations settings from a query-string deep link", async ({
    page,
  }) => {
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new?settings=integrations");

    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Lark / Feishu CLI")).toBeVisible();
  });

  test("falls back when copying a Lark authorization link without the Clipboard API", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: (command: string) => {
          if (command !== "copy") return false;
          const copiedText =
            document.querySelector<HTMLTextAreaElement>(
              "textarea[readonly]",
            )?.value;
          (window as typeof window & { __copiedText?: string }).__copiedText =
            copiedText;
          return true;
        },
      });
    });
    mockLangGraphAPI(page);

    const configuredStatus = configuredLarkStatus();
    await page.route("**/api/integrations/lark/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...configuredStatus,
          auth: {
            status: "not_authorized",
            message: "Lark user authorization is not configured",
            user: "existing-user",
            verified: false,
          },
        }),
      });
    });
    await page.route("**/api/integrations/lark/auth/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verification_url: "about:blank#lark-auth-copy-fallback",
          device_code: "copy-fallback-device-code",
          generation: "copy-fallback-generation",
          expires_in: 600,
          user_code: null,
          hint: null,
        }),
      });
    });
    await page.route(
      "**/api/integrations/lark/auth/complete",
      async (route) => {
        await route.fulfill({
          status: 504,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Authorization still pending." }),
        });
      },
    );

    await page.goto("/workspace/chats/new?settings=integrations");
    const dialog = page.getByRole("dialog", { name: "Settings" });
    const popupPromise = page.waitForEvent("popup");
    await dialog.getByRole("button", { name: "Connect Lark" }).click();
    const popup = await popupPromise;
    await expect(
      dialog.getByText("about:blank#lark-auth-copy-fallback"),
    ).toBeVisible();
    await popup.close();

    // The app installs a compatibility shim during startup. Remove it here to
    // model environments where Clipboard API access disappears at copy time.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
    });

    await dialog.getByRole("button", { name: "Copy link" }).click();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __copiedText?: string }).__copiedText,
        ),
      )
      .toBe("about:blank#lark-auth-copy-fallback");
    await expect(page.getByText("Copied to clipboard")).toBeVisible();
  });

  test("keeps a single settings dialog across deep link and nav menu openings", async ({
    page,
  }) => {
    mockLangGraphAPI(page);

    // Deep link opens the shared dialog on Integrations.
    await page.goto("/workspace/chats/new?settings=integrations");
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Lark / Feishu CLI")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(1);

    // Close the modal before using the sidebar. While the modal is open, the
    // background is intentionally inert and Playwright should not be able to
    // click sidebar controls there.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);

    // Opening again from the nav menu must still use the same shared host, not
    // mount a second SettingsDialog instance.
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();

    // Exactly one Settings dialog is mounted/visible at any time.
    await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(1);
  });

  test("can install the Lark integration skill pack from settings", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    let authStartRequest: unknown;
    const authCompleteRequests: unknown[] = [];
    let authCompleteCount = 0;
    await page.route(
      "**/api/integrations/lark/auth/complete",
      async (route) => {
        authCompleteRequests.push(route.request().postDataJSON());
        authCompleteCount += 1;
        if (authCompleteCount > 1) {
          await route.fulfill({
            status: 504,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Authorization still pending." }),
          });
          return;
        }
        await route.fallback();
      },
    );
    await page.route("**/api/integrations/lark/config/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verification_url: "about:blank",
          device_code: "mock-config-device-code",
          generation: "config-generation",
          expires_in: 600,
          interval: 5,
          user_code: "config",
          brand: "feishu",
        }),
      });
    });
    await page.route("**/api/integrations/lark/auth/start", async (route) => {
      authStartRequest = route.request().postDataJSON();
      const request = authStartRequest as { generation?: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verification_url: "https://open.feishu.cn/auth/mock-device",
          device_code: "mock-device-code",
          generation: request.generation ?? "auth-generation",
          expires_in: 600,
          user_code: null,
          hint: null,
        }),
      });
    });

    await page.goto("/workspace/chats/new");

    const sidebar = page.locator("[data-sidebar='sidebar']");
    await sidebar.getByRole("button", { name: /Settings and more/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();

    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Integrations" }).click();

    await expect(dialog.getByText("Lark / Feishu CLI")).toBeVisible();
    await expect(
      dialog.getByText("Install the official skill pack first"),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Install" }).click();
    await expect(
      page.getByText("Installed 3 Lark/Feishu skills."),
    ).toBeVisible();

    // Sandbox-runtime readiness row surfaces once the init-container runtime is
    // reported ready, so a green UI can't hide a chat-time command-not-found.
    await expect(dialog.getByText("Sandbox runtime")).toBeVisible();
    await expect(
      dialog.getByText("Provisioned by init container"),
    ).toBeVisible();

    // Selection is only a variant swap, so aria-pressed is the sole cue a screen
    // reader gets. The cross-app parity ledger compares React against Vue and
    // stays silent when both sides drop it, so presence has to be pinned here.
    const calendarDomain = dialog.getByRole("button", { name: "Calendar" });
    await expect(calendarDomain).toHaveAttribute("aria-pressed", "false");
    await calendarDomain.click();
    await expect(calendarDomain).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "Drive" }),
    ).toHaveAttribute("aria-pressed", "false");
    await dialog
      .getByLabel("Exact OAuth scope")
      .fill("calendar:calendar.event:read");
    await dialog.getByRole("button", { name: "Connect Lark" }).click();
    await expect(dialog.getByText("about:blank")).toBeVisible();
    await expect(dialog.getByText(/app configuration/i)).toHaveCount(0);

    await dialog
      .getByRole("button", {
        name: "I completed browser confirmation, continue",
      })
      .click();
    await expect
      .poll(() => authStartRequest)
      .toMatchObject({
        recommend: false,
        domains: ["calendar"],
        scope: "calendar:calendar.event:read",
        generation: "config-generation",
      });

    await expect
      .poll(() => authCompleteRequests)
      .toContainEqual({
        device_code: "mock-device-code",
        generation: "config-generation",
        wait_timeout_seconds: 8,
      });
    await expect(
      dialog.getByText("Lark authorization is live-verified"),
    ).toBeVisible();
    await expect(
      page.getByText("Authorization page opened. Waiting for completion..."),
    ).toHaveCount(0);

    await calendarDomain.click();
    await expect(calendarDomain).toHaveAttribute("aria-pressed", "false");
    await dialog.getByLabel("Exact OAuth scope").fill("");
    await dialog.getByRole("button", { name: "Reconnect Lark" }).click();
    await expect(
      dialog.getByText("https://open.feishu.cn/auth/mock-device"),
    ).toBeVisible();
  });

  test("can switch the Lark app by entering new credentials", async ({
    page,
  }) => {
    mockLangGraphAPI(page);

    // A configured + CLI-available account is the precondition for surfacing
    // the "Change Lark app" control.
    const configuredStatus = configuredLarkStatus();
    await page.route("**/api/integrations/lark/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(configuredStatus),
      });
    });

    let credentialsRequest: unknown;
    let releaseCredentials!: () => void;
    const credentialsGate = new Promise<void>((resolve) => {
      releaseCredentials = resolve;
    });
    await page.route(
      "**/api/integrations/lark/config/credentials",
      async (route) => {
        credentialsRequest = route.request().postDataJSON();
        await credentialsGate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message:
              "Lark/Feishu app switched. Reconnect to authorize the new app.",
            generation: "switch-generation",
            status: {
              ...configuredStatus,
              app_id: "cli_new_mock",
              auth: {
                status: "not_authorized",
                message: "not authorized",
                user: null,
                verified: false,
              },
            },
          }),
        });
      },
    );
    let authStartRequest: unknown;
    await page.route("**/api/integrations/lark/auth/start", async (route) => {
      authStartRequest = route.request().postDataJSON();
      const request = authStartRequest as { generation?: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verification_url: "https://open.feishu.cn/auth/switched-app",
          device_code: "switched-device-code",
          generation: request.generation ?? "auth-generation",
          expires_in: 600,
          user_code: null,
          hint: null,
        }),
      });
    });

    await page.goto("/workspace/chats/new?settings=integrations");

    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Lark / Feishu CLI")).toBeVisible();

    // Reveal the switch form and submit new app credentials.
    await dialog.getByRole("button", { name: "Change Lark app" }).click();
    await expect(
      dialog.getByText("Switch to a different Lark app"),
    ).toBeVisible();
    // Brand is single-select and, like the domain chips, shows it only through a
    // variant swap; aria-pressed is what makes that audible.
    await expect(dialog.getByRole("button", { name: "Feishu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      dialog.getByRole("button", { name: "Lark", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await dialog.getByLabel("App ID").fill("cli_new_mock");
    await dialog.getByLabel("App Secret").fill("super-secret");
    const popupPromise = page.waitForEvent("popup");
    await dialog.getByRole("button", { name: "Switch app" }).click();
    const popup = await popupPromise;
    await expect(
      dialog.getByRole("button", { name: "Opening connection link..." }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Re-register in browser" }),
    ).toBeDisabled();
    releaseCredentials();

    await expect
      .poll(() => credentialsRequest)
      .toMatchObject({
        app_id: "cli_new_mock",
        app_secret: "super-secret",
        brand: "feishu",
      });

    // Switching a bot immediately drives the new app's browser authorization.
    await expect
      .poll(() => authStartRequest)
      .toEqual({
        recommend: false,
        domains: [],
        scope: null,
        generation: "switch-generation",
      });
    await expect
      .poll(() => popup.url())
      .toBe("https://open.feishu.cn/auth/switched-app");
    await popup.close();
  });

  test("keeps selected permissions when re-registering the Lark app", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const configuredStatus = configuredLarkStatus();
    await page.route("**/api/integrations/lark/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(configuredStatus),
      });
    });
    let authStartRequest: unknown;
    await page.route("**/api/integrations/lark/auth/start", async (route) => {
      authStartRequest = route.request().postDataJSON();
      await route.fallback();
    });

    await page.goto("/workspace/chats/new?settings=integrations");
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await dialog.getByRole("button", { name: "Calendar" }).click();
    await dialog
      .getByLabel("Exact OAuth scope")
      .fill("calendar:calendar.event:read");
    await dialog.getByRole("button", { name: "Change Lark app" }).click();
    const popupPromise = page.waitForEvent("popup");
    await dialog
      .getByRole("button", { name: "Re-register in browser" })
      .click();
    const popup = await popupPromise;
    await dialog
      .getByRole("button", {
        name: "I completed browser confirmation, continue",
      })
      .click();

    await expect
      .poll(() => authStartRequest)
      .toEqual({
        recommend: false,
        domains: ["calendar"],
        scope: "calendar:calendar.event:read",
        generation: "config-generation",
      });
    await popup.close();
  });

  /*
    Below sm this screen is broken in both apps, and the React/Vue parity
    ledger cannot see it: the ledger pins "do the two apps agree", and here
    they disagree only about *how* they break. Radix's ScrollArea wraps its
    children in `min-width:100%; display:table`, so shrink-to-fit pushes the
    whole panel 25.2px past its grid track; reka has no such wrapper, so the
    Vue side clips instead. Each failure mode is internally consistent, which
    is why the geometry lane could only report "these widths differ".

    The cause is padding that never steps down on narrow screens: on a 375px
    screen the dialog is 343 wide, and the panel's p-6 plus this page's Card
    px-6 plus the status boxes' p-3 left a 167px content column — narrower
    than the "Re-register in browser" button (min-content 191.1px) and the
    scope example carrying `calendar:calendar.event:read` (192.2px).

    Asserting overflow rather than an exact width: the numbers move with fonts
    and copy, "does it fit" does not. Both readings are kept because the two
    apps break at different layers — panelOverflow catches the Radix side,
    cardOverflow the clipped side.
  */
  test("the settings panel fits inside the dialog on a 375px screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    mockLangGraphAPI(page);
    await page.route("**/api/integrations/lark/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(configuredLarkStatus()),
      }),
    );

    await page.goto("/workspace/chats/new?settings=integrations");
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Change Lark app" }).click();
    await expect(dialog.getByLabel("App ID")).toBeVisible();

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const dialogEl = document.querySelector("[role=dialog]");
            const panel = dialogEl?.querySelector<HTMLElement>(
              '[data-slot="scroll-area"]',
            );
            const card = dialogEl?.querySelector<HTMLElement>(
              '[data-slot="card"]',
            );
            if (!panel?.parentElement || !card) return { missing: true };
            const over = (value: number) => Math.max(0, Math.round(value));
            return {
              panelOverflow: over(
                panel.getBoundingClientRect().width -
                  panel.parentElement.clientWidth,
              ),
              cardOverflow: over(card.scrollWidth - card.clientWidth),
            };
          }),
        {
          message:
            "panelOverflow>0 means the panel was pushed out of its grid track; " +
            "cardOverflow>0 means content inside the card is clipped",
        },
      )
      .toEqual({ panelOverflow: 0, cardOverflow: 0 });
  });
});
