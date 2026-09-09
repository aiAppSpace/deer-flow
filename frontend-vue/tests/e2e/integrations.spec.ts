/*
  【文件职责】     Vue integration settings contracts；验证与 React 产品行为对齐的 Vue 实现。
  【架构位置】     测试
  【主要导出】     Playwright Vue M7 scenarios
  【依赖关系】     frontend shared mock API；Vue product routes and DOM
  【边界与注意】   Vue 使用自身 DOM 与门禁，不依赖 React 组件结构。
*/

import { expect, test } from "@playwright/test";
import { openSettingsDialog } from "../support/settings-dialog";

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

test.describe("Integrations settings", () => {
  test("opens integrations settings from a query-string deep link", async ({
    page,
  }) => {
    mockLangGraphAPI(page);

    const dialog = await openSettingsDialog(
      page,
      "/workspace/chats/new?settings=integrations",
    );
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

    const dialog = await openSettingsDialog(
      page,
      "/workspace/chats/new?settings=integrations",
    );
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

    const dialog = await openSettingsDialog(
      page,
      "/workspace/chats/new?settings=integrations",
    );
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

  test("keeps a single settings dialog across deep link and nav menu openings", async ({
    page,
  }) => {
    mockLangGraphAPI(page);

    // Deep link opens the shared dialog on Integrations.
    const dialog = await openSettingsDialog(
      page,
      "/workspace/chats/new?settings=integrations",
    );
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
    /*
      成功提示落在 workspace toaster 里，不在面板内——与 React 的 sonner 同一个位置。
      念的是 Gateway 回的那句话，不是本地词典：授权到底成了什么样由服务端说了算。
      同一条 toast 被就地改写（先是「已打开授权页」，再变成完成），所以那句等待文案
      不该还留在页面上。
    */
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

    /*
      **这一跳真的想出网。** 授权流程会 `globalThis.open("about:blank")` 之后把弹窗
      导航到 `open.feishu.cn`（`IntegrationsSettings.vue:345/362`），而套件里没有任何
      mock 盖住那个域——2026-09-08 实测：同一批用例，能连上时 1.7~3.8 秒，连不上时
      58.8 秒~1 分钟，四条一起把「拆 context」拖过 30 秒预算。

      现在 `mockLangGraphAPI` 在 **context 级**（弹窗是另一个 page，page 级盖不到）
      把所有离开本机的 http(s) 请求就地 fulfill 掉。这条断言核的是**那条拦截真的响过**
      ——否则它会变成一个永远不响的摆设，而且没人分得清「拦住了」和「压根没请求」。
    */
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

    const dialog = await openSettingsDialog(
      page,
      "/workspace/chats/new?settings=integrations",
    );
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

    const dialog = await openSettingsDialog(
      page,
      "/workspace/chats/new?settings=integrations",
    );
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
});
