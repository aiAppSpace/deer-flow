import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { toast } from "sonner";

import { LarkPluginSettings } from "@/components/workspace/capabilities/lark-plugin-settings";
import { I18nContext } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  completeLarkAuthorization,
  installLarkIntegration,
  loadLarkIntegrationStatus,
  startLarkAuthorization,
} from "@/core/integrations/lark/api";
import type { LarkIntegrationStatus } from "@/core/integrations/lark/types";

const account = rs.hoisted(() => ({
  user: { id: "u1", system_role: "admin" },
}));
rs.mock("@/core/auth/AuthProvider", () => ({ useAuth: () => account }));
rs.mock("@/env", () => ({ env: { NEXT_PUBLIC_STATIC_WEBSITE_ONLY: "false" } }));
rs.mock("@/core/integrations/lark/api", () => ({
  completeLarkAuthorization: rs.fn(),
  completeLarkConfiguration: rs.fn(),
  installLarkIntegration: rs.fn(),
  loadLarkIntegrationStatus: rs.fn(),
  setLarkAppCredentials: rs.fn(),
  startLarkAuthorization: rs.fn(),
  startLarkConfiguration: rs.fn(),
}));

const status: LarkIntegrationStatus = {
  installed: true,
  version: "v1.0.65",
  manifest_version: "v1.0.65",
  latest_available_version: null,
  runtime_version_mismatch: false,
  app_configured: true,
  app_id: "cli_mock",
  app_brand: "feishu",
  skills_expected: 27,
  skills_installed: 27,
  installed_skills: ["lark-doc"],
  enabled_skills: ["lark-doc"],
  install_path: "/tmp/lark",
  cli: {
    available: true,
    path: "/usr/bin/lark-cli",
    version: "v1.0.65",
    error: null,
  },
  auth: {
    status: "authenticated",
    message: null,
    user: "Alice",
    verified: true,
  },
  sandbox_runtime_mode: "init-container",
  sandbox_runtime_probed: true,
  sandbox_runtime_ready: true,
  sandbox_runtime_detail: null,
};

beforeEach(() => {
  account.user = { id: "u1", system_role: "admin" };
  rs.mocked(loadLarkIntegrationStatus).mockResolvedValue(status);
  rs.spyOn(window, "open").mockReturnValue(null);
  rs.spyOn(toast, "info").mockReturnValue("lark-auth");
  rs.spyOn(toast, "success").mockReturnValue("lark-success");
  rs.spyOn(toast, "error").mockReturnValue("lark-error");
});
afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  rs.resetAllMocks();
});

describe("Lark real component clipboard ownership", () => {
  for (const copied of [true, false]) {
    it.each(["keep", "unmount", "account", "completed"] as const)(
      `clipboard result ${copied} respects %s`,
      async (retirement) => {
        const client = new QueryClient({
          defaultOptions: { queries: { retry: false } },
        });
        rs.mocked(startLarkAuthorization).mockResolvedValueOnce({
          verification_url: "https://example.com/authorization",
          device_code: "device",
          generation: "copy-owner",
          expires_in: 30,
          user_code: null,
          hint: null,
        });
        let finishAuth!: () => void;
        rs.mocked(completeLarkAuthorization).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishAuth = () =>
                resolve({ success: true, message: "Authorized", status });
            }),
        );
        let finishCopy!: () => void;
        const write = rs
          .spyOn(navigator.clipboard, "writeText")
          .mockImplementationOnce(
            () =>
              new Promise<void>((resolve, reject) => {
                finishCopy = () =>
                  copied ? resolve() : reject(new Error("Clipboard denied"));
              }),
          );
        const view = () => (
          <QueryClientProvider client={client}>
            <I18nContext.Provider
              value={{ locale: "en-US", setLocale: rs.fn(), t: enUS }}
            >
              <LarkPluginSettings />
            </I18nContext.Provider>
          </QueryClientProvider>
        );
        const subject = render(view());
        let mounted = true;
        try {
          fireEvent.click(
            await screen.findByRole("button", {
              name: enUS.settings.integrations.lark.connectedAction,
            }),
          );
          fireEvent.click(
            await screen.findByRole("button", {
              name: enUS.settings.integrations.lark.copyAuthLink,
            }),
          );
          await waitFor(() =>
            expect(write).toHaveBeenCalledWith(
              "https://example.com/authorization",
            ),
          );
          if (retirement === "unmount") {
            subject.unmount();
            mounted = false;
          }
          if (retirement === "account") {
            account.user = { id: "u2", system_role: "admin" };
            subject.rerender(view());
          }
          if (retirement === "completed") {
            await act(async () => {
              finishAuth();
            });
            await waitFor(() =>
              expect(
                screen.queryByRole("button", {
                  name: enUS.settings.integrations.lark.copyAuthLink,
                }),
              ).toBeNull(),
            );
          }
          rs.mocked(toast.success).mockClear();
          rs.mocked(toast.error).mockClear();
          await act(async () => {
            finishCopy();
          });
          expect(toast.success).toHaveBeenCalledTimes(
            retirement === "keep" && copied ? 1 : 0,
          );
          expect(toast.error).toHaveBeenCalledTimes(
            retirement === "keep" && !copied ? 1 : 0,
          );
          if (retirement === "keep")
            expect(copied ? toast.success : toast.error).toHaveBeenCalledWith(
              copied
                ? enUS.clipboard.copiedToClipboard
                : enUS.clipboard.failedToCopyToClipboard,
            );
        } finally {
          if (mounted) subject.unmount();
          await act(async () => {
            finishCopy?.();
            finishAuth?.();
          });
          client.clear();
        }
      },
    );
  }
});

describe("Lark actual install completion", () => {
  it.each(["keep", "unmount"] as const)(
    "post-refresh notification respects %s",
    async (retirement) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      client.setQueryData(["skills"], []);
      let finishRefresh!: () => void;
      const queryFn = rs.fn(
        () =>
          new Promise<unknown[]>((resolve) => {
            finishRefresh = () => resolve([]);
          }),
      );
      const observer = new QueryObserver(client, {
        queryKey: ["skills"],
        queryFn,
        staleTime: Infinity,
      });
      const unsubscribe = observer.subscribe(() => undefined);
      rs.mocked(installLarkIntegration).mockResolvedValueOnce({
        success: true,
        installed_skills: ["lark-doc"],
        message: "Installed Lark skills",
        status,
      });
      const subject = render(
        <QueryClientProvider client={client}>
          <I18nContext.Provider
            value={{ locale: "en-US", setLocale: rs.fn(), t: enUS }}
          >
            <LarkPluginSettings />
          </I18nContext.Provider>
        </QueryClientProvider>,
      );
      let mounted = true;
      try {
        fireEvent.click(
          await screen.findByRole("button", {
            name: enUS.settings.integrations.reinstall,
          }),
        );
        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
        expect(toast.success).not.toHaveBeenCalled();
        if (retirement === "unmount") {
          subject.unmount();
          mounted = false;
        }
        const reads = rs.mocked(loadLarkIntegrationStatus).mock.calls.length;
        await act(async () => {
          finishRefresh();
        });
        await waitFor(() => expect(client.isMutating()).toBe(0));
        expect(toast.success).toHaveBeenCalledTimes(
          retirement === "keep" ? 1 : 0,
        );
        if (retirement === "keep")
          expect(toast.success).toHaveBeenCalledWith("Installed Lark skills");
        expect(loadLarkIntegrationStatus).toHaveBeenCalledTimes(reads);
      } finally {
        if (mounted) subject.unmount();
        await act(async () => {
          finishRefresh?.();
        });
        unsubscribe();
        client.clear();
      }
    },
  );
});
