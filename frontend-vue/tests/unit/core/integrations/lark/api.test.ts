/*
  【文件职责】     钉住 Lark 集成传输层的七个端点：URL、方法、请求体与错误分类。
  【架构位置】     unit test
  【主要导出】     无；Vitest cases
  【边界与注意】   这个域**只有一个**传输层（app/core/integrations/lark/api.ts）。
                   此前还并存一个 flow.ts，产品用后者、这份测试盯前者，于是「测试全绿」
                   与「产品能跑」是两件互不相干的事：api.ts 的契约停在没有 `generation`
                   的旧版，而 Gateway 早就靠它拒绝过期流程了。合并之后每个端点都带上
                   generation 断言，正是为了让那种漂移一次就红。
*/
import { beforeEach, describe, expect, vi, test } from "vitest";

vi.mock("@/core/api/fetcher", () => ({
  fetch: vi.fn(),
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "/backend",
}));

import { fetch as fetcher } from "@/core/api/fetcher";
import {
  completeLarkAuthorization,
  completeLarkConfiguration,
  installLarkIntegration,
  LarkIntegrationRequestError,
  loadLarkIntegrationStatus,
  setLarkAppCredentials,
  startLarkAuthorization,
  startLarkConfiguration,
} from "@/core/integrations/lark/api";

const mockedFetch = vi.mocked(fetcher);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status >= 400 ? "Bad Request" : "OK",
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockedFetch.mockReset();
});

describe("lark integration api", () => {
  test("loads status", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        installed: false,
        version: "v1.0.65",
        manifest_version: null,
        latest_available_version: "v1.0.65",
        runtime_version_mismatch: false,
        app_configured: false,
        app_id: null,
        app_brand: null,
        skills_expected: 27,
        skills_installed: 0,
        installed_skills: [],
        enabled_skills: [],
        install_path: "/tmp/lark-cli",
        cli: { available: false, path: null, version: null, error: "missing" },
        auth: { status: "unavailable", message: "missing", user: null },
        sandbox_runtime_mode: "init-container",
        sandbox_runtime_ready: false,
        sandbox_runtime_detail: "init image not configured",
      }),
    );

    await expect(loadLarkIntegrationStatus()).resolves.toMatchObject({
      installed: false,
      version: "v1.0.65",
      sandbox_runtime_mode: "init-container",
      sandbox_runtime_ready: false,
    });
    // signal 一路透传：调用方要能取消一次在飞的状态回读（见 useLarkIntegrationFlow 的 beginFlow）。
    expect(mockedFetch).toHaveBeenCalledWith(
      "/backend/api/integrations/lark/status",
      { signal: undefined },
    );
  });

  test("installs integration", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        installed_skills: ["lark-doc"],
        message: "Installed 1 Lark/Feishu skills.",
        status: {
          installed: true,
          version: "v1.0.65",
          manifest_version: "v1.0.65",
          latest_available_version: "v1.0.65",
          runtime_version_mismatch: false,
          app_configured: false,
          app_id: null,
          app_brand: null,
          skills_expected: 27,
          skills_installed: 1,
          installed_skills: ["lark-doc"],
          enabled_skills: ["lark-doc"],
          install_path: "/tmp/lark-cli",
          cli: {
            available: true,
            path: "/usr/bin/lark-cli",
            version: "v1.0.65",
            error: null,
          },
          auth: {
            status: "not_configured",
            message: "not configured",
            user: null,
          },
        },
      }),
    );

    await expect(installLarkIntegration()).resolves.toMatchObject({
      success: true,
      installed_skills: ["lark-doc"],
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      "/backend/api/integrations/lark/install",
      { method: "POST" },
    );
  });

  test("surfaces admin-required install errors", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(403, { detail: "Admin privileges required." }),
    );

    const promise = installLarkIntegration();
    await expect(promise).rejects.toMatchObject({
      name: "LarkIntegrationRequestError",
      status: 403,
      isAdminRequired: true,
      message: "Admin privileges required.",
    });
    await expect(promise).rejects.toBeInstanceOf(LarkIntegrationRequestError);
  });

  test("starts browser authorization", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        verification_url: "https://open.feishu.cn/auth/mock",
        device_code: "device-code",
        expires_in: 600,
        user_code: null,
        hint: null,
      }),
    );

    await expect(
      startLarkAuthorization({
        recommend: true,
        domains: ["calendar"],
        scope: "calendar:calendar.event:read",
      }),
    ).resolves.toEqual({
      verification_url: "https://open.feishu.cn/auth/mock",
      device_code: "device-code",
      expires_in: 600,
      user_code: null,
      hint: null,
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      "/backend/api/integrations/lark/auth/start",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommend: true,
          domains: ["calendar"],
          scope: "calendar:calendar.event:read",
        }),
      },
    );
  });

  test("starts connection setup", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        verification_url: "https://open.feishu.cn/page/cli?user_code=config",
        device_code: "config-device-code",
        generation: "config-generation",
        expires_in: 600,
        interval: 5,
        user_code: "config",
        brand: "feishu",
      }),
    );

    await expect(startLarkConfiguration({ brand: "feishu" })).resolves.toEqual({
      verification_url: "https://open.feishu.cn/page/cli?user_code=config",
      device_code: "config-device-code",
      generation: "config-generation",
      expires_in: 600,
      interval: 5,
      user_code: "config",
      brand: "feishu",
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      "/backend/api/integrations/lark/config/start",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: "feishu" }),
      },
    );
  });

  test("completes connection setup", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        message: "Lark/Feishu connection setup completed.",
        generation: "config-generation",
        status: {
          installed: true,
          version: "v1.0.65",
          manifest_version: "v1.0.65",
          latest_available_version: "v1.0.65",
          runtime_version_mismatch: false,
          app_configured: true,
          app_id: "cli_mock",
          app_brand: "feishu",
          skills_expected: 27,
          skills_installed: 1,
          installed_skills: ["lark-doc"],
          enabled_skills: ["lark-doc"],
          install_path: "/tmp/lark-cli",
          cli: {
            available: true,
            path: "/usr/bin/lark-cli",
            version: "v1.0.65",
            error: null,
          },
          auth: {
            status: "not_authorized",
            message: "not authorized",
            user: null,
          },
        },
      }),
    );

    await expect(
      completeLarkConfiguration({
        device_code: "config-device-code",
        generation: "config-generation",
        brand: "feishu",
        interval: 5,
        expires_in: 600,
      }),
    ).resolves.toMatchObject({
      success: true,
      generation: "config-generation",
      status: { app_configured: true, app_id: "cli_mock" },
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      "/backend/api/integrations/lark/config/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_code: "config-device-code",
          generation: "config-generation",
          brand: "feishu",
          interval: 5,
          expires_in: 600,
        }),
      },
    );
  });

  test("completes browser authorization", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        message: "Lark/Feishu authorization completed.",
        status: {
          installed: true,
          version: "v1.0.65",
          manifest_version: "v1.0.65",
          latest_available_version: "v1.0.65",
          runtime_version_mismatch: false,
          app_configured: true,
          app_id: "cli_mock",
          app_brand: "feishu",
          skills_expected: 27,
          skills_installed: 1,
          installed_skills: ["lark-doc"],
          enabled_skills: ["lark-doc"],
          install_path: "/tmp/lark-cli",
          cli: {
            available: true,
            path: "/usr/bin/lark-cli",
            version: "v1.0.65",
            error: null,
          },
          auth: {
            status: "authenticated",
            message: "ok",
            user: "Alice",
          },
        },
      }),
    );

    await expect(
      completeLarkAuthorization({
        device_code: "device-code",
        generation: "auth-generation",
      }),
    ).resolves.toMatchObject({
      success: true,
      status: { auth: { status: "authenticated", user: "Alice" } },
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      "/backend/api/integrations/lark/auth/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_code: "device-code",
          generation: "auth-generation",
        }),
      },
    );
  });

  test("switches the configured app credentials", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        message: "Lark/Feishu app switched.",
        generation: "switched-generation",
        status: {
          installed: true,
          version: "v1.0.65",
          manifest_version: "v1.0.65",
          latest_available_version: "v1.0.65",
          runtime_version_mismatch: false,
          app_configured: true,
          app_id: "cli_switched",
          app_brand: "lark",
          skills_expected: 27,
          skills_installed: 1,
          installed_skills: ["lark-doc"],
          enabled_skills: ["lark-doc"],
          install_path: "/tmp/lark-cli",
          cli: {
            available: true,
            path: "/usr/bin/lark-cli",
            version: "v1.0.65",
            error: null,
          },
          auth: {
            status: "not_authorized",
            message: "not authorized",
            user: null,
          },
        },
      }),
    );

    await expect(
      setLarkAppCredentials({
        app_id: "cli_switched",
        app_secret: "secret",
        brand: "lark",
      }),
    ).resolves.toMatchObject({
      // 换 App 会作废旧授权，所以调用方必须拿到新的 generation 再去发起授权。
      generation: "switched-generation",
      status: { app_id: "cli_switched", app_brand: "lark" },
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      "/backend/api/integrations/lark/config/credentials",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: "cli_switched",
          app_secret: "secret",
          brand: "lark",
        }),
      },
    );
  });
});

test("normalizes omitted probe state for status and every status-bearing mutation", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse(200, { installed: false }));
  expect((await loadLarkIntegrationStatus()).sandbox_runtime_probed).toBe(
    false,
  );
  const mutations = [
    () => installLarkIntegration(),
    () =>
      completeLarkConfiguration({
        device_code: "device",
        generation: "generation",
        brand: "feishu",
        interval: null,
        expires_in: null,
      }),
    () =>
      setLarkAppCredentials({
        app_id: "id",
        app_secret: "synthetic-test-secret",
        brand: "feishu",
      }),
    () =>
      completeLarkAuthorization({
        device_code: "device",
        generation: "generation",
      }),
  ];
  for (const mutate of mutations) {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { success: true, status: { installed: true } }),
    );
    expect((await mutate()).status.sandbox_runtime_probed).toBe(false);
  }
});
