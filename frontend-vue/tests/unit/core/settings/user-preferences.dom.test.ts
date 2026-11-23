import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetch }));

type Store = typeof import("@/core/settings/store");
type Runtime = typeof import("@/core/settings/user-preferences");
let store: Store;
let runtime: Runtime;
const key = "deerflow.preferences.alice";
const outbox = `${key}.pending`;

function patches() {
  return mocks.fetch.mock.calls
    .filter(([, init]) => (init as RequestInit).method === "PATCH")
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  mocks.fetch.mockReset();
  store = await import("@/core/settings/store");
  runtime = await import("@/core/settings/user-preferences");
});

afterEach(() => {
  runtime.stopUserPreferences();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("authenticated account preference lifecycle", () => {
  it("uses only the account cache and tab outbox, then PATCHes edited fields with expected identity and 204", async () => {
    localStorage.setItem(
      "deerflow.local-settings",
      JSON.stringify({
        notification: { enabled: false },
        context: { model_name: "legacy-secret" },
      }),
    );
    localStorage.setItem(key, JSON.stringify({ model_name: "cached" }));
    let server = {
      notification_enabled: false,
      model_name: "remote",
      mode: "pro",
    };
    mocks.fetch.mockImplementation(async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/v1/auth/preferences");
      expect(new Headers(init.headers).get("X-Expected-User-Id")).toBe("alice");
      expect(init.cache).toBe("no-store");
      if (init.method === "PATCH") {
        server = { ...server, ...JSON.parse(init.body as string) };
        return new Response(null, { status: 204 });
      }
      return Response.json(server);
    });
    runtime.startUserPreferences("alice");
    expect(store.getBaseSettingsSnapshot().context.model_name).toBe("cached");
    await flushPromises();
    expect(store.getBaseSettingsSnapshot()).toMatchObject({
      notification: { enabled: false },
      context: { model_name: "remote", mode: "pro" },
    });
    expect(patches()).toEqual([]);
    store.updateLocalSettings("notification", { enabled: true });
    await flushPromises();
    expect(patches()).toEqual([{ notification_enabled: true }]);
    expect(sessionStorage.getItem(outbox)).toBe("{}");
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(server);
    expect(localStorage.getItem("deerflow.local-settings")).toContain(
      "legacy-secret",
    );
  });

  it("does not upload automatic context resolution or create an override masking the delayed account model", async () => {
    const read = deferred<Response>();
    mocks.fetch.mockReturnValue(read.promise);
    runtime.startUserPreferences("alice");
    store.resolveThreadContext("slow", { model_name: "fallback", mode: "pro" });
    expect(sessionStorage.getItem(outbox)).toBeNull();
    expect(store.getThreadModelSnapshot("slow")).toBeUndefined();
    read.resolve(Response.json({ model_name: "server", mode: "ultra" }));
    await flushPromises();
    expect(store.getBaseSettingsSnapshot().context).toMatchObject({
      model_name: "server",
      mode: "ultra",
    });
    expect(patches()).toEqual([]);
  });

  it("aborts old-owner requests and fences late responses on an account switch", async () => {
    const alice = deferred<Response>();
    let oldSignal!: AbortSignal;
    mocks.fetch.mockImplementation((_url: string, init: RequestInit) => {
      if (new Headers(init.headers).get("X-Expected-User-Id") === "alice") {
        oldSignal = init.signal as AbortSignal;
        return alice.promise;
      }
      return Promise.resolve(Response.json({ model_name: "bob-model" }));
    });
    localStorage.setItem(key, JSON.stringify({ model_name: "alice-cache" }));
    runtime.startUserPreferences("alice");
    runtime.startUserPreferences("bob");
    expect(oldSignal.aborted).toBe(true);
    await flushPromises();
    expect(store.getBaseSettingsSnapshot().context.model_name).toBe(
      "bob-model",
    );
    alice.resolve(Response.json({ model_name: "late-alice-secret" }));
    await flushPromises();
    expect(store.getBaseSettingsSnapshot().context.model_name).toBe(
      "bob-model",
    );
    expect(localStorage.getItem(key)).not.toContain("late-alice-secret");
  });

  it.each([403, 409])(
    "stops the owner on %s without discarding pending edits or retrying under changed cookies",
    async (status) => {
      sessionStorage.setItem(outbox, JSON.stringify({ mode: "ultra" }));
      mocks.fetch.mockResolvedValue(new Response(null, { status }));
      runtime.startUserPreferences("alice");
      await flushPromises();
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      await flushPromises();
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      expect(JSON.parse(sessionStorage.getItem(outbox)!)).toEqual({
        mode: "ultra",
      });
      expect(store.getBaseSettingsSnapshot().context.mode).toBeUndefined();
    },
  );

  it("keeps edits through 503, retries on reconnect, and replays a tab outbox after remount", async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 503 }));
    const stop = runtime.startUserPreferences("alice");
    await flushPromises();
    store.updateLocalSettings("context", {
      mode: "ultra",
      model_name: undefined,
    });
    await flushPromises();
    expect(JSON.parse(sessionStorage.getItem(outbox)!)).toEqual({
      mode: "ultra",
    });
    stop();
    mocks.fetch.mockImplementation(async (_url: string, init: RequestInit) =>
      init.method === "PATCH"
        ? new Response(null, { status: 204 })
        : Response.json({ model_name: "remote" }),
    );
    runtime.startUserPreferences("alice");
    window.dispatchEvent(new Event("online"));
    await flushPromises();
    expect(patches()).toEqual([{ mode: "ultra" }]);
    expect(sessionStorage.getItem(outbox)).toBe("{}");
    expect(store.getBaseSettingsSnapshot().context).toMatchObject({
      mode: "ultra",
      model_name: "remote",
    });
  });

  it("retries a failed write with bounded backoff and preserves explicit null clears", async () => {
    vi.useFakeTimers();
    let writeAttempts = 0;
    mocks.fetch.mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.method === "PATCH")
        return new Response(null, {
          status: ++writeAttempts === 1 ? 503 : 204,
        });
      return Response.json({ model_name: "remote" });
    });
    runtime.startUserPreferences("alice");
    await vi.advanceTimersByTimeAsync(0);
    store.updateLocalSettings("context", { model_name: undefined });
    await vi.advanceTimersByTimeAsync(0);
    expect(patches()).toEqual([{ model_name: null }]);
    expect(JSON.parse(sessionStorage.getItem(outbox)!)).toEqual({
      model_name: null,
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(writeAttempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(patches()).toEqual([{ model_name: null }, { model_name: null }]);
    expect(sessionStorage.getItem(outbox)).toBe("{}");
  });

  it.each(["write", "remove", "clear"] as const)(
    "merges local-only fields after cross-tab %s without replacing account settings",
    async (operation) => {
      mocks.fetch.mockImplementation(async () =>
        Response.json({
          notification_enabled: false,
          model_name: "account",
          mode: "pro",
        }),
      );
      const unsubscribe = store.subscribe(() => undefined);
      runtime.startUserPreferences("alice");
      await flushPromises();
      store.updateLocalSettings("projects", { displayMode: "grouped" });
      store.updateLocalSettings("tokenUsage", {
        headerTotal: false,
        inlineMode: "off",
      });
      if (operation === "write")
        localStorage.setItem(
          "deerflow.local-settings",
          JSON.stringify({
            notification: { enabled: true },
            context: { model_name: "other" },
          }),
        );
      else if (operation === "remove")
        localStorage.removeItem("deerflow.local-settings");
      else localStorage.clear();
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: operation === "clear" ? null : "deerflow.local-settings",
          storageArea: localStorage,
        }),
      );
      expect(store.getBaseSettingsSnapshot()).toMatchObject({
        notification: { enabled: false },
        context: { model_name: "account", mode: "pro" },
        projects: { displayMode: "flat" },
        tokenUsage: { headerTotal: true, inlineMode: "per_turn" },
      });
      store.updateLocalSettings("tokenUsage", { headerTotal: false });
      expect(
        JSON.parse(localStorage.getItem("deerflow.local-settings")!)
          .projectsDisplayMode,
      ).toBe("flat");
      await flushPromises();
      expect(patches()).toEqual([]);
      unsubscribe();
    },
  );

  it("does not echo unchanged confirmed cache in response to a sibling tab storage event", async () => {
    mocks.fetch.mockImplementation(async () => Response.json({ mode: "pro" }));
    runtime.startUserPreferences("alice");
    await flushPromises();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    window.dispatchEvent(new StorageEvent("storage", { key }));
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(writes).not.toHaveBeenCalled();
  });

  it("tolerates malformed and unavailable browser storage without preventing synchronization", async () => {
    localStorage.setItem(key, "bad-json");
    sessionStorage.setItem(outbox, "null");
    mocks.fetch.mockImplementation(async (_url: string, init: RequestInit) =>
      init.method === "PATCH"
        ? new Response(null, { status: 204 })
        : Response.json({ mode: "thinking", unknown: "secret" }),
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    runtime.startUserPreferences("alice");
    await flushPromises();
    expect(store.getBaseSettingsSnapshot().context.mode).toBe("thinking");
    store.updateLocalSettings("notification", { enabled: false });
    await flushPromises();
    expect(patches()).toEqual([{ notification_enabled: false }]);
  });
});

describe("notification locale reconciliation", () => {
  it("saves locale once after initial GET and only again for explicit UI switches", async () => {
    let server = { locale: "en-US" };
    mocks.fetch.mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.method === "PATCH") {
        server = { ...server, ...JSON.parse(init.body as string) };
        return new Response(null, { status: 204 });
      }
      return Response.json(server);
    });
    runtime.reportUiLocale("zh-CN");
    runtime.startUserPreferences("alice");
    await flushPromises();
    expect(patches()).toEqual([{ locale: "zh-CN" }]);
    server = { locale: "en-US" };
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(patches()).toEqual([{ locale: "zh-CN" }]);
    runtime.reportUiLocale("en-US");
    await flushPromises();
    runtime.reportUiLocale("zh-CN");
    await flushPromises();
    expect(patches()).toEqual([{ locale: "zh-CN" }, { locale: "zh-CN" }]);
  });

  it("does not send unsupported locale to a legacy Gateway or let stale locale outbox block valid fields", async () => {
    runtime.reportUiLocale("zh-CN");
    sessionStorage.setItem(
      outbox,
      JSON.stringify({ locale: "zh-CN", notification_enabled: false }),
    );
    mocks.fetch.mockImplementation(async (_url: string, init: RequestInit) =>
      init.method === "PATCH"
        ? new Response(null, { status: 204 })
        : Response.json({ mode: "pro" }),
    );
    runtime.startUserPreferences("alice");
    await flushPromises();
    runtime.reportUiLocale("en-US");
    await flushPromises();
    expect(patches()).toEqual([{ notification_enabled: false }]);
    expect(sessionStorage.getItem(outbox)).toBe("{}");
  });
});
