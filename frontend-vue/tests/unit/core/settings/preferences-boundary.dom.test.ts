import { flushPromises, mount } from "@vue/test-utils";
import {
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  onMounted,
  ref,
  type Ref,
} from "vue";
import { renderToString } from "vue/server-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetch }));

let runtime: typeof import("@/core/settings/user-preferences");
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  mocks.fetch
    .mockReset()
    .mockImplementation(() => new Promise<Response>(() => undefined));
  runtime = await import("@/core/settings/user-preferences");
});
afterEach(() => {
  runtime.stopUserPreferences();
  vi.restoreAllMocks();
});

async function workspace(
  owner: Ref<string | undefined>,
  reset: () => Promise<void> = vi.fn(async () => undefined),
) {
  const { useUserPreferencesBoundary } =
    await import("@/composables/useUserPreferencesBoundary");
  const { useThreadSettings } = await import("@/composables/useThreadSettings");
  const Consumer = defineComponent({
    setup() {
      const { settings, resolve } = useThreadSettings("hydrating");
      // A real composer resolves an available default before the server GET.
      onMounted(() =>
        resolve({
          model_name: settings.value.context.model_name ?? "fallback",
        }),
      );
      return () => h("output", settings.value.context.model_name ?? "default");
    },
  });
  return {
    reset,
    Component: defineComponent({
      setup() {
        const { ready } = useUserPreferencesBoundary(owner, reset);
        return () => (ready.value ? h(Consumer) : null);
      },
    }),
  };
}

describe("Vue preferences mount and account boundary", () => {
  it("hydrates the default snapshot without warnings, then publishes only the identified account cache", async () => {
    const owner = ref<string | undefined>("alice");
    const { Component } = await workspace(owner);
    // Server rendering must not read a browser cache or start synchronization.
    const store = await import("@/core/settings/store");
    const container = document.createElement("div");
    container.innerHTML = await renderToString(createSSRApp(Component));
    expect(container.textContent).toBe("default");
    expect(mocks.fetch).not.toHaveBeenCalled();
    localStorage.setItem(
      "deerflow.preferences.alice",
      JSON.stringify({ model_name: "alice-cache" }),
    );
    localStorage.setItem(
      "deerflow.local-settings",
      JSON.stringify({ context: { model_name: "legacy-secret" } }),
    );
    document.body.append(container);
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const warnings = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const app = createSSRApp(Component);
    try {
      app.mount(container);
      await nextTick();
      expect(container.textContent).toBe("alice-cache");
      expect(store.getThreadModelSnapshot("hydrating")).toBeUndefined();
      expect(errors).not.toHaveBeenCalled();
      expect(warnings).not.toHaveBeenCalled();
      expect(
        sessionStorage.getItem("deerflow.preferences.alice.pending"),
      ).toBeNull();
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("hides the previous owner until shared capability reads have been canceled and reset", async () => {
    localStorage.setItem(
      "deerflow.preferences.alice",
      JSON.stringify({ model_name: "alice-cache" }),
    );
    localStorage.setItem(
      "deerflow.preferences.bob",
      JSON.stringify({ model_name: "bob-cache" }),
    );
    let finish!: () => void;
    const reset = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const owner = ref<string | undefined>("alice");
    const { Component } = await workspace(owner, reset);
    const wrapper = mount(Component);
    await nextTick();
    expect(wrapper.text()).toBe("alice-cache");
    owner.value = "bob";
    await nextTick();
    expect(wrapper.find("output").exists()).toBe(false);
    expect(reset).toHaveBeenCalledTimes(1);
    finish();
    await flushPromises();
    expect(wrapper.text()).toBe("bob-cache");
    wrapper.unmount();
    for (const [, init] of mocks.fetch.mock.calls)
      expect((init as RequestInit).signal?.aborted).toBe(true);
  });

  it("only admits authenticated browser users and never the auth-disabled synthetic owner", async () => {
    const { preferenceOwner } =
      await import("@/core/settings/preference-owner");
    const user = {
      id: "alice",
      email: "alice@test.local",
      system_role: "user" as const,
      needs_setup: false,
    };
    expect(preferenceOwner({ tag: "authenticated", user }, false)).toBe(
      "alice",
    );
    expect(preferenceOwner({ tag: "authenticated", user }, true)).toBe("alice");
    expect(
      preferenceOwner(
        { tag: "authenticated", user: { ...user, id: "default" } },
        false,
      ),
    ).toBeUndefined();
    expect(preferenceOwner({ tag: "unavailable" }, false)).toBeUndefined();
    expect(preferenceOwner({ tag: "unauthenticated" }, false)).toBeUndefined();
    const { Component } = await workspace(ref(undefined));
    const wrapper = mount(Component);
    expect(mocks.fetch).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("aborts pending preference synchronization before the logout POST changes the cookie", async () => {
    runtime.startUserPreferences("alice");
    const signal = mocks.fetch.mock.calls[0]![1].signal as AbortSignal;
    const { performLogout } = await import("@/core/auth/logout");
    const post = vi.fn(async () => {
      expect(signal.aborted).toBe(true);
      return { ok: true };
    });
    await performLogout({
      post,
      navigate: vi.fn(),
      hardNavigate: vi.fn(),
      queryClient: {
        clear: vi.fn(),
        cancelQueries: vi.fn(async () => undefined),
      },
    });
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
