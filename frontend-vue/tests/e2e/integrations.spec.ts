import { expect, test } from "@playwright/test";
import { openLarkPlugin } from "../support/capabilities-page";

import { mockLangGraphAPI, offMachineRequestsSeenBy } from "./utils/mock-api";

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

test.describe("Capability center Lark plugin", () => {
  test("opens Lark configuration from the capability deep link", async ({
    page,
  }) => {
    mockLangGraphAPI(page);

    const dialog = await openLarkPlugin(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Lark / Feishu CLI")).toBeVisible();
  });

  test("shows the installed version and the next-step explanation", async ({
    page,
  }) => {
    // 这一页的状态标题只说「现在在哪一步」，说明才回答「我要做什么」。
    // 两者曾经只渲染了标题：说明连同版本行在词典里翻译好了，页面上却没有出口。
    mockLangGraphAPI(page);
    await page.route("**/api/integrations/lark/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...configuredLarkStatus(),
          latest_available_version: "v1.0.66",
          runtime_version_mismatch: true,
        }),
      }),
    );

    const dialog = await openLarkPlugin(page);
    await expect(dialog.getByText("Installed: v1.0.65")).toBeVisible();
    await expect(
      dialog.getByText("Update available: v1.0.66", { exact: false }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Skill pack version differs", { exact: false }),
    ).toBeVisible();
    // connected 分支的说明。标题是 connectedTitle，说明必须跟着出现。
    await expect(
      dialog.getByText("The current user's authorization was verified", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Advanced: if an error reports a missing scope", {
        exact: false,
      }),
    ).toBeVisible();
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
    await page.route("**/api/integrations/lark/status", (route) =>
      route.fulfill({
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
      }),
    );
    await page.route("**/api/integrations/lark/auth/start", (route) =>
      route.fulfill({
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
      }),
    );
    await page.route("**/api/integrations/lark/auth/complete", (route) =>
      route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Authorization still pending." }),
      }),
    );

    const dialog = await openLarkPlugin(page);
    const popupPromise = page.waitForEvent("popup");
    await dialog.getByRole("button", { name: "Connect Lark" }).click();
    const popup = await popupPromise;
    await expect(
      dialog.getByText("about:blank#lark-auth-copy-fallback"),
    ).toBeVisible();
    await popup.close();
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

  test("keeps one plugin dialog across deep-link and gallery openings", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const dialog = await openLarkPlugin(page);
    await expect(dialog).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("button", { name: "View details Lark / Feishu", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(
      page.getByRole("dialog").getByText("Lark / Feishu CLI", { exact: true }),
    ).toBeVisible();
  });

  test("can install and authorize the Lark integration skill pack", async ({
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

    const dialog = await openLarkPlugin(page);
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

    await dialog.getByRole("button", { name: "Calendar" }).click();
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
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Lark/Feishu authorization completed.",
    );
    await expect(
      page.getByText("Authorization page opened. Waiting for completion..."),
    ).toHaveCount(0);

    await dialog.getByRole("button", { name: "Calendar" }).click();
    await dialog.getByLabel("Exact OAuth scope").fill("");
    await dialog.getByRole("button", { name: "Reconnect Lark" }).click();
    await expect(
      dialog.getByText("https://open.feishu.cn/auth/mock-device"),
    ).toBeVisible();

    await expect
      .poll(() => offMachineRequestsSeenBy(page))
      .toEqual(
        expect.arrayContaining([expect.stringContaining("open.feishu.cn")]),
      );
  });

  test("can switch the Lark app by entering new credentials", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    const configuredStatus = configuredLarkStatus();
    await page.route("**/api/integrations/lark/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(configuredStatus),
      }),
    );

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
            message: "Lark app switched.",
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

    const dialog = await openLarkPlugin(page);
    await dialog.getByRole("button", { name: "Change Lark app" }).click();
    await expect(
      dialog.getByText("Switch to a different Lark app"),
    ).toBeVisible();
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
    await page.route("**/api/integrations/lark/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(configuredStatus),
      }),
    );
    let authStartRequest: unknown;
    await page.route("**/api/integrations/lark/auth/start", async (route) => {
      authStartRequest = route.request().postDataJSON();
      await route.fallback();
    });

    const dialog = await openLarkPlugin(page);
    await dialog.getByRole("button", { name: "calendar" }).click();
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

  for (const width of [375, 360]) {
    test(`the configured plugin panel fits inside the dialog on a ${width}px screen`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      mockLangGraphAPI(page);
      await page.route("**/api/integrations/lark/status", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(configuredLarkStatus()),
        }),
      );

      const dialog = await openLarkPlugin(page);
      await dialog.getByRole("button", { name: "Change Lark app" }).click();
      await expect(dialog.getByLabel("App ID")).toBeVisible();

      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const dialogEl = document.querySelector("[role=dialog]");
              const panel =
                dialogEl?.querySelector<HTMLElement>('[data-slot="card"]');
              const card =
                dialogEl?.querySelector<HTMLElement>('[data-slot="card"]');
              if (!panel?.parentElement || !card) return { missing: true };
              const over = (value: number) => Math.max(0, Math.round(value));
              // 固有最小宽度：读完立刻把内联样式还原，页面不留痕。
              const cell = panel.parentElement.clientWidth;
              const before = panel.style.cssText;
              panel.style.width = "min-content";
              panel.style.maxWidth = "none";
              const minContent = panel.getBoundingClientRect().width;
              panel.style.cssText = before;
              return {
                panelOverflow: over(panel.getBoundingClientRect().width - cell),
                cardOverflow: over(card.scrollWidth - card.clientWidth),
                panelFits: cell - minContent >= 12,
              };
            }),
          {
            message:
              "panelOverflow>0 = 面板被撑出了栅格格子；cardOverflow>0 = 卡片里的东西被裁掉了；" +
              "panelFits=false = 还没溢出，但余量已经不到 12px（见上方注释里的读数）",
          },
        )
        .toEqual({ panelOverflow: 0, cardOverflow: 0, panelFits: true });
    });
  }
});
