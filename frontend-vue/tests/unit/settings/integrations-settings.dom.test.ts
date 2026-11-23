/*
  【文件职责】     验证实际 Lark 面板的权限、状态刷新与异步完成归属。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     LarkPluginSettings · useLarkIntegrationFlow · Vue Query
  【边界与注意】   使用实际面板与 QueryClient/QueryObserver；只在 API、账户、
                   toast、clipboard 等外部边界受控。安装后的缓存刷新、复制结果在
                   卸载、切账户或流程结束后不能继续通知、回读或写入新 owner。
                   DOM 回归与完整双端浏览器验收各自保留，不互相替代。
*/

import { flushPromises, mount } from "@vue/test-utils";
import {
  QueryClient,
  QueryObserver,
  VueQueryPlugin,
} from "@tanstack/vue-query";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";

import LarkPluginSettings from "@/components/workspace/capabilities/LarkPluginSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";
import type { LarkIntegrationStatus } from "@/core/integrations/lark/types";
import {
  completeLarkAuthorization,
  installLarkIntegration,
  startLarkAuthorization,
} from "@/core/integrations/lark/api";

const loadStatus = vi.hoisted(() => vi.fn());
const sessionRef = vi.hoisted(() => ({ value: null as unknown }));
const notices = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/core/integrations/lark/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/core/integrations/lark/api")
  >("@/core/integrations/lark/api");
  return {
    ...actual,
    loadLarkIntegrationStatus: loadStatus,
    installLarkIntegration: vi.fn(),
    startLarkAuthorization: vi.fn(),
    startLarkConfiguration: vi.fn(),
    completeLarkConfiguration: vi.fn(),
    completeLarkAuthorization: vi.fn(),
    setLarkAppCredentials: vi.fn(),
  };
});

vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({
    session: sessionRef,
    isFetching: ref(false),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/core/auth/auth-disabled-user", async () => {
  const actual = await vi.importActual<
    typeof import("@/core/auth/auth-disabled-user")
  >("@/core/auth/auth-disabled-user");
  return { ...actual, isAuthDisabledMode: () => false };
});

vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => ({
    toasts: ref([]),
    ...notices,
    dismiss: vi.fn(),
    clear: vi.fn(),
  }),
}));

function status(
  overrides: Partial<LarkIntegrationStatus> = {},
): LarkIntegrationStatus {
  return {
    installed: true,
    version: "v1.0.65",
    manifest_version: "v1.0.65",
    latest_available_version: "v1.0.65",
    runtime_version_mismatch: false,
    app_configured: true,
    app_id: "cli_mock",
    app_brand: "feishu",
    skills_expected: 27,
    skills_installed: 4,
    installed_skills: [],
    enabled_skills: [],
    install_path: "/tmp/lark-cli",
    cli: {
      available: true,
      path: "/usr/bin/lark-cli",
      version: "lark-cli v1.0.65",
      error: null,
    },
    auth: {
      status: "authenticated",
      message: "ok",
      user: "Alice",
      verified: true,
    },
    sandbox_runtime_mode: "init-container",
    sandbox_runtime_probed: true,
    sandbox_runtime_ready: true,
    sandbox_runtime_detail: null,
    ...overrides,
  };
}

function mountPanel(
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return mount(LarkPluginSettings, {
    attachTo: document.body,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient,
          },
        ],
      ],
    },
  });
}

const admin = {
  tag: "authenticated",
  user: { id: "u1", email: "a@b.c", system_role: "admin" },
};
const member = {
  tag: "authenticated",
  user: { id: "u2", email: "d@e.f", system_role: "user" },
};

beforeEach(() => {
  vi.clearAllMocks();
  loadStatus.mockReset().mockResolvedValue(status());
  sessionRef.value = admin;
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("LarkPluginSettings", () => {
  it.each([enUS, zhCN])(
    "renders the translated integration section and its functional card",
    async (copy) => {
      vi.stubGlobal("useNuxtApp", () => ({
        $i18n: { t: { value: copy } },
      }));
      const wrapper = mountPanel();
      await flushPromises();
      expect(wrapper.get("header").text()).toContain(
        copy.settings.integrations.title,
      );
      expect(wrapper.get("header").text()).toContain(
        copy.settings.integrations.description,
      );
      expect(wrapper.get("main").get('[data-slot="card"]').text()).toContain(
        copy.settings.integrations.lark.title,
      );
      expect(loadStatus).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    },
  );

  it("aborts authorization on unmount and ignores a late transport result", async () => {
    let signal: AbortSignal | undefined;
    let release!: (
      value: Awaited<ReturnType<typeof startLarkAuthorization>>,
    ) => void;
    vi.mocked(startLarkAuthorization).mockImplementationOnce(
      (_request, requestSignal) => {
        signal = requestSignal;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    );
    vi.stubGlobal("open", () => null);
    const wrapper = mountPanel();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find(
        (button) =>
          button.text() === enUS.settings.integrations.lark.connectedAction,
      )!
      .trigger("click");
    await flushPromises();
    expect(signal?.aborted).toBe(false);
    wrapper.unmount();
    expect(signal?.aborted).toBe(true);
    release({
      verification_url: "https://example.com/authorization",
      device_code: "device",
      generation: "g1",
      expires_in: 30,
      user_code: null,
      hint: null,
    });
    await flushPromises();
    expect(completeLarkAuthorization).not.toHaveBeenCalled();
    expect(notices.info).not.toHaveBeenCalled();
    expect(notices.error).not.toHaveBeenCalled();
  });

  it("retains the fallback link when popup is blocked and stops automatic polling at expiry", async () => {
    vi.useFakeTimers();
    const now = vi.spyOn(Date, "now").mockReturnValue(0);
    vi.stubGlobal("open", () => null);
    vi.mocked(startLarkAuthorization).mockResolvedValueOnce({
      verification_url: "https://example.com/authorization",
      device_code: "device",
      generation: "g1",
      expires_in: 30,
      user_code: null,
      hint: null,
    });
    vi.mocked(completeLarkAuthorization).mockResolvedValue({
      success: false,
      message: "Still pending",
      status: status(),
    });
    const wrapper = mountPanel();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find(
        (button) =>
          button.text() === enUS.settings.integrations.lark.connectedAction,
      )!
      .trigger("click");
    await flushPromises();
    expect(
      wrapper.find('a[href="https://example.com/authorization"]').exists(),
    ).toBe(true);
    expect(completeLarkAuthorization).toHaveBeenCalledTimes(1);
    now.mockReturnValue(31_000);
    await vi.advanceTimersByTimeAsync(1500);
    await flushPromises();
    expect(completeLarkAuthorization).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(completeLarkAuthorization).toHaveBeenCalledTimes(2);
    expect(notices.info).toHaveBeenCalledWith(
      enUS.settings.integrations.lark.authorizationStillPending,
    );
    wrapper.unmount();
    vi.clearAllTimers();
  });
  it("names a live-verified connection by its user, not by the configured-for wording", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    /*
      verified 与「只是配了凭据」是两种状态。verified 时读到的应该就是那个账号名；
      退回 authConfiguredFor 等于告诉用户「配好了」，而实际上已经连通了。
    */
    expect(wrapper.text()).toContain("Alice");
    expect(wrapper.text()).not.toContain(
      enUS.settings.integrations.lark.authConfiguredFor("Alice"),
    );
    wrapper.unmount();
  });

  it("gives the sandbox-runtime card the same ready/pending badge as the other three", async () => {
    loadStatus.mockResolvedValue(
      status({
        sandbox_runtime_ready: false,
        sandbox_runtime_detail: "no init image",
      }),
    );
    const wrapper = mountPanel();
    await flushPromises();

    // 四格同一个组件：少一个徽标，这一格就成了唯一读不出就绪状态的那格。
    const badges = wrapper.findAll('[data-slot="badge"]');
    expect(badges).toHaveLength(4);
    expect(badges.map((badge) => badge.text())).toEqual([
      enUS.settings.integrations.ready,
      enUS.settings.integrations.ready,
      enUS.settings.integrations.ready,
      enUS.settings.integrations.pending,
    ]);
    wrapper.unmount();
  });

  it("disables install for a non-admin and says why", async () => {
    sessionRef.value = member;
    const wrapper = mountPanel();
    await flushPromises();

    const install = wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.settings.integrations.reinstall);
    expect(install?.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain(enUS.settings.integrations.adminRequired);
    wrapper.unmount();
  });

  it("says out loud which authorization domains are selected", async () => {
    /*
      对照台账钉的是「两个应用一不一致」，不是「这个属性在不在」——两边一起漏掉
      aria-pressed 时它照样是 0 行（wave 88 就是这么量出来的）。所以存在性只能在
      各自的用例里钉：这一条守 Vue 那一侧，React 那一侧守在
      frontend/tests/e2e/integrations.spec.ts 的同一处交互上。
    */
    const wrapper = mountPanel();
    await flushPromises();

    const domain = (label: string) =>
      wrapper.findAll("button").find((button) => button.text() === label)!;

    const calendar = domain(
      enUS.settings.integrations.lark.authDomains.calendar.label,
    );
    expect(calendar.attributes("aria-pressed")).toBe("false");
    await calendar.trigger("click");
    expect(
      domain(
        enUS.settings.integrations.lark.authDomains.calendar.label,
      ).attributes("aria-pressed"),
    ).toBe("true");
    // 相邻的那颗必须还是 false：整排一起翻过去和一颗都不翻一样是错的。
    expect(
      domain(
        enUS.settings.integrations.lark.authDomains.drive.label,
      ).attributes("aria-pressed"),
    ).toBe("false");
    wrapper.unmount();
  });

  it("says out loud which Lark app brand is selected", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const byText = (label: string) =>
      wrapper.findAll("button").find((button) => button.text() === label)!;
    await byText(enUS.settings.integrations.lark.changeAppButton).trigger(
      "click",
    );

    const lark = enUS.settings.integrations.lark;
    // 单选：点掉默认的 feishu 之后，两颗的状态必须一起翻过来。
    expect(byText(lark.brandFeishu).attributes("aria-pressed")).toBe("true");
    expect(byText(lark.brandLark).attributes("aria-pressed")).toBe("false");
    await byText(lark.brandLark).trigger("click");
    expect(byText(lark.brandFeishu).attributes("aria-pressed")).toBe("false");
    expect(byText(lark.brandLark).attributes("aria-pressed")).toBe("true");
    wrapper.unmount();
  });

  it("drops an in-flight status read that a newer flow has superseded", async () => {
    /*
      真正会撞上的顺序：先点 Refresh（一次状态回读在飞），再点 Connect。Connect 的
      第一步就是重新读一次状态，两次读的响应回来的先后没有保证。React 在这里
      queryClient.cancelQueries + 把 AbortSignal 交给 queryFn，迟到的旧响应连
      resolve 的机会都没有；少了它，旧响应会把新流程刚拿到的状态盖回去，
      而用户看到的仍然是「刚刷新过」的界面。
    */
    let refreshSignal: AbortSignal | undefined;
    let releaseRefresh!: (value: LarkIntegrationStatus) => void;
    loadStatus
      .mockResolvedValueOnce(status())
      .mockImplementationOnce(
        (signal?: AbortSignal) =>
          new Promise<LarkIntegrationStatus>((resolve, reject) => {
            refreshSignal = signal;
            releaseRefresh = resolve;
            signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      )
      .mockResolvedValueOnce(status({ app_configured: false }));
    vi.stubGlobal("open", () => null);

    const wrapper = mountPanel();
    await flushPromises();
    const click = async (label: string) => {
      await wrapper
        .findAll("button")
        .find((button) => button.text() === label)!
        .trigger("click");
      await flushPromises();
    };

    await click(enUS.settings.integrations.refresh);
    expect(refreshSignal?.aborted).toBe(false);

    await click(enUS.settings.integrations.lark.connectedAction);
    expect(refreshSignal?.aborted).toBe(true);

    releaseRefresh(status({ cli: { ...status().cli, version: "STALE" } }));
    await flushPromises();
    expect(wrapper.text()).not.toContain("STALE");
    expect(wrapper.text()).not.toContain(enUS.settings.integrations.loadFailed);
    wrapper.unmount();
  });
});

describe("Lark mutation status ownership", () => {
  const key = ["integrations", "lark", "status", "u1"];
  async function reinstall(wrapper: ReturnType<typeof mountPanel>) {
    await wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.settings.integrations.reinstall)!
      .trigger("click");
    await flushPromises();
  }
  it.each([false, true])(
    "runtime probe flag %s controls whether mutation fields are authoritative",
    async (probed) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      loadStatus
        .mockResolvedValueOnce(status())
        .mockImplementation(() => new Promise(() => {}));
      const mutation = status({
        auth: { ...status().auth, user: "New auth", verified: false },
        sandbox_runtime_mode: "broker",
        sandbox_runtime_probed: probed,
        sandbox_runtime_ready: false,
        sandbox_runtime_detail: null,
      });
      vi.mocked(installLarkIntegration).mockResolvedValueOnce({
        success: true,
        message: "Installed",
        installed_skills: [],
        status: mutation,
      });
      const wrapper = mountPanel(queryClient);
      await flushPromises();
      await reinstall(wrapper);
      expect(queryClient.getQueryData(key)).toMatchObject({
        auth: { user: "New auth", verified: false },
        sandbox_runtime_mode: probed ? "broker" : "init-container",
        sandbox_runtime_probed: true,
        sandbox_runtime_ready: !probed,
        sandbox_runtime_detail: null,
      });
      expect(wrapper.findAll('[data-slot="badge"]').at(-1)!.text()).toBe(
        probed
          ? enUS.settings.integrations.pending
          : enUS.settings.integrations.ready,
      );
      expect(loadStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
      wrapper.unmount();
      queryClient.clear();
    },
  );
  it.each([false, true])(
    "awaits cancellation and fences a retired owner (retire=%s)",
    async (retire) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = mountPanel(queryClient);
      await flushPromises();
      const cancel = queryClient.cancelQueries.bind(queryClient);
      let release!: () => void;
      vi.spyOn(queryClient, "cancelQueries").mockImplementationOnce(
        async (filters) => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          await cancel(filters);
        },
      );
      const mutation = status({
        auth: { ...status().auth, user: "Mutation winner" },
      });
      vi.mocked(installLarkIntegration).mockResolvedValueOnce({
        success: true,
        message: "Installed",
        installed_skills: [],
        status: mutation,
      });
      await reinstall(wrapper);
      expect(
        queryClient.getQueryData<LarkIntegrationStatus>(key)?.auth.user,
      ).toBe("Alice");
      expect(release).toBeTypeOf("function");
      if (retire) wrapper.unmount();
      loadStatus.mockImplementation(() => new Promise(() => {}));
      release();
      await flushPromises();
      expect(
        queryClient.getQueryData<LarkIntegrationStatus>(key)?.auth.user,
      ).toBe(retire ? "Alice" : "Mutation winner");
      if (retire) expect(notices.success).not.toHaveBeenCalled();
      else wrapper.unmount();
      queryClient.clear();
    },
  );
});

describe("real Lark install follow-up owner", () => {
  it.each(["keep", "unmount", "account"] as const)(
    "catalog refresh completion respects %s",
    async (retirement) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      let release!: () => void;
      let refreshStarted = false;
      client.setQueryData(["skills"], []);
      const observer = new QueryObserver(client, {
        queryKey: ["skills"],
        staleTime: Infinity,
        queryFn: () => {
          refreshStarted = true;
          return new Promise<never[]>((resolve) => {
            release = () => resolve([]);
          });
        },
      });
      const unsubscribe = observer.subscribe(() => {});
      const wrapper = mountPanel(client);
      let mounted = true;
      try {
        await flushPromises();
        expect(loadStatus).toHaveBeenCalledTimes(1);
        vi.mocked(installLarkIntegration).mockResolvedValueOnce({
          success: true,
          message: "Installed",
          installed_skills: [],
          status: status(),
        });
        await wrapper
          .findAll("button")
          .find(
            (button) => button.text() === enUS.settings.integrations.reinstall,
          )!
          .trigger("click");
        await flushPromises();
        expect(refreshStarted).toBe(true);
        expect(notices.success).not.toHaveBeenCalled();
        if (retirement === "unmount") {
          wrapper.unmount();
          mounted = false;
        }
        if (retirement === "account") invalidateWorkspaceQueryOwner(client);
        release();
        await flushPromises();
        expect(notices.success).toHaveBeenCalledTimes(
          retirement === "keep" ? 1 : 0,
        );
        expect(loadStatus).toHaveBeenCalledTimes(retirement === "keep" ? 2 : 1);
      } finally {
        release?.();
        if (mounted) wrapper.unmount();
        unsubscribe();
        client.clear();
      }
    },
  );
});

describe("Lark authorization link copy ownership", () => {
  for (const copied of [true, false]) {
    it.each(["keep", "unmount", "account", "completed"] as const)(
      `clipboard result ${copied} respects %s`,
      async (retirement) => {
        const client = new QueryClient({
          defaultOptions: { queries: { retry: false } },
        });
        vi.stubGlobal("open", () => null);
        vi.mocked(startLarkAuthorization).mockResolvedValueOnce({
          verification_url: "https://example.com/authorization",
          device_code: "device",
          generation: "copy-owner",
          expires_in: 30,
          user_code: null,
          hint: null,
        });
        let finishAuth!: () => void;
        vi.mocked(completeLarkAuthorization).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishAuth = () =>
                resolve({
                  success: true,
                  message: "Authorized",
                  status: status(),
                });
            }),
        );
        let finishCopy!: () => void;
        const write = vi
          .spyOn(navigator.clipboard, "writeText")
          .mockImplementationOnce(
            () =>
              new Promise<void>((resolve, reject) => {
                finishCopy = () =>
                  copied ? resolve() : reject(new Error("Clipboard denied"));
              }),
          );
        const wrapper = mountPanel(client);
        let mounted = true;
        try {
          await flushPromises();
          await wrapper
            .findAll("button")
            .find(
              (button) =>
                button.text() ===
                enUS.settings.integrations.lark.connectedAction,
            )!
            .trigger("click");
          await flushPromises();
          await wrapper
            .findAll("button")
            .find(
              (button) =>
                button.text() === enUS.settings.integrations.lark.copyAuthLink,
            )!
            .trigger("click");
          await flushPromises();
          expect(write).toHaveBeenCalledWith(
            "https://example.com/authorization",
          );
          if (retirement === "unmount") {
            wrapper.unmount();
            mounted = false;
          }
          if (retirement === "account") invalidateWorkspaceQueryOwner(client);
          if (retirement === "completed") {
            finishAuth();
            await flushPromises();
            expect(
              wrapper
                .find('a[href="https://example.com/authorization"]')
                .exists(),
            ).toBe(false);
          }
          notices.success.mockClear();
          notices.error.mockClear();
          finishCopy();
          await flushPromises();
          expect(notices.success).toHaveBeenCalledTimes(
            retirement === "keep" && copied ? 1 : 0,
          );
          expect(notices.error).toHaveBeenCalledTimes(
            retirement === "keep" && !copied ? 1 : 0,
          );
          if (retirement === "keep")
            expect(
              copied ? notices.success : notices.error,
            ).toHaveBeenCalledWith(
              copied
                ? enUS.clipboard.copiedToClipboard
                : enUS.clipboard.failedToCopyToClipboard,
            );
        } finally {
          if (mounted) wrapper.unmount();
          finishCopy?.();
          finishAuth?.();
          await flushPromises();
          client.clear();
        }
      },
    );
  }
});
