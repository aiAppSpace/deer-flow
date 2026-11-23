import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h, onScopeDispose, ref } from "vue";

import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import UserPreferencesBoundary from "@/core/settings/UserPreferencesBoundary.vue";
import { AUTH_SESSION_QUERY_KEY } from "@/core/auth/session-query";
import { enUS } from "@/core/i18n/locales/en-US";
import { favoritesKey } from "@/core/models/favorites";

const preferences = vi.hoisted(() => ({
  start: vi.fn(() => Object.assign(vi.fn(), { activate: vi.fn() })),
}));
vi.mock("@/core/auth/auth-disabled-user", async (original) => ({
  ...(await original<typeof import("@/core/auth/auth-disabled-user")>()),
  isAuthDisabledMode: () => true,
}));
vi.mock("@/core/settings/user-preferences", () => ({
  startUserPreferences: preferences.start,
}));

const user = {
  id: "real-cookie-owner",
  email: "owner@example.com",
  system_role: "user",
  needs_setup: false,
};
const model = {
  id: "fast",
  name: "fast",
  model: "Provider-F",
  display_name: "Fast Model",
  supports_thinking: false,
  supports_reasoning_effort: false,
};
let queryClient: QueryClient;
let wrapper: ReturnType<typeof mount> | undefined;
let disposed: ReturnType<typeof vi.fn<() => void>>;
let fetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  preferences.start.mockClear();
  disposed = vi.fn<() => void>();
  fetch = vi.fn(async () => Response.json(user));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  queryClient.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function workspace() {
  const PendingArtifact = defineComponent({
    setup() {
      onScopeDispose(disposed);
      return () => h("output", "pending artifact body");
    },
  });
  wrapper = mount(UserPreferencesBoundary, {
    attachTo: document.body,
    slots: {
      default: () => [
        h(ComposerModelSelector, { models: [model], selectedModel: model }),
        h(PendingArtifact),
      ],
    },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return wrapper;
}

it("keeps the auth-disabled initial owner stable while a restored artifact reads its body", async () => {
  const view = workspace();
  await flushPromises();
  expect(fetch).not.toHaveBeenCalled();
  expect(disposed).not.toHaveBeenCalled();
  expect(preferences.start).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toBeUndefined();
  await view.get("button").trigger("click");
  await flushPromises();
  const star = document.querySelector<HTMLButtonElement>(
    '[data-model-favorite="fast"]',
  );
  expect(star?.disabled).toBe(false);
  star!.click();
  await flushPromises();
  expect(
    JSON.parse(localStorage.getItem(favoritesKey("default"))!).names,
  ).toEqual(["fast"]);
});

it("still retires private consumers when a visibility refresh resolves a real account", async () => {
  workspace();
  await flushPromises();
  expect(fetch).not.toHaveBeenCalled();
  queryClient.setQueryData(["memory"], "default-owner-data");
  document.dispatchEvent(new Event("visibilitychange"));
  await flushPromises();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(disposed).toHaveBeenCalledTimes(1);
  expect(preferences.start).toHaveBeenCalledWith(user.id, expect.any(Object));
  expect(queryClient.getQueryData(["memory"])).toBeUndefined();
  expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toMatchObject({
    tag: "authenticated",
    user,
  });
});
