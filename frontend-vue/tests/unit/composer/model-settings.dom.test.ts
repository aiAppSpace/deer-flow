import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import ModelSettings from "@/components/workspace/settings/ModelSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  test: vi.fn(),
}));
const user = ref<{ id: string; system_role: string } | null>({
  id: "admin",
  system_role: "admin",
});
vi.mock("@/composables/useCapabilities", () => ({
  useCapabilityUser: () => user,
}));
vi.mock("@/core/models/management", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/models/management")>()),
  loadManagedModels: mocks.load,
  saveManagedModel: mocks.save,
  testManagedModel: mocks.test,
}));
const model = {
  name: "managed",
  display_name: "Managed",
  provider: "openai-compatible",
  model: "provider-model",
  base_url: "https://models.example/v1",
  enabled: true,
  supports_vision: false,
  context_window: null,
  max_tokens: null,
  revision: "rev-1",
  source: "managed",
  has_api_key: true,
};
const toast = createWorkspaceToastStore();
const wrappers: ReturnType<typeof mount>[] = [];
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(ModelSettings, {
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      provide: { [workspaceToastKey as symbol]: toast },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, client };
}
beforeEach(() => {
  vi.clearAllMocks();
  toast.clear();
  user.value = { id: "admin", system_role: "admin" };
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  mocks.load.mockResolvedValue({
    models: [
      model,
      {
        name: "yaml",
        display_name: "Yaml",
        model: "yaml-provider",
        source: "config",
        enabled: true,
      },
    ],
  });
  mocks.save.mockResolvedValue(model);
  mocks.test.mockResolvedValue({ ok: true, message: "success" });
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
describe("managed models actual settings", () => {
  it("hides management and avoids its API for ordinary users", async () => {
    user.value = { id: "regular", system_role: "user" };
    const { wrapper } = setup();
    await flushPromises();
    expect(wrapper.text()).toContain(enUS.settings.models.adminOnly);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(wrapper.findAll("button")).toEqual([]);
  });
  it("renders YAML read-only and toggles managed config with its expected revision", async () => {
    const { wrapper, client } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await flushPromises();
    const toggle = wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.settings.models.disable)!;
    await toggle.trigger("click");
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({
      config: expect.objectContaining({ name: "managed", enabled: false }),
      expected_revision: "rev-1",
    });
    expect(mocks.save.mock.calls[0]![0].config).not.toHaveProperty("api_key");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["managed-models"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["models"] });
    expect(
      wrapper
        .findAll("button")
        .filter((button) => button.text() === enUS.settings.models.edit),
    ).toHaveLength(1);
  });
  it("preserves API keys by omission and sends empty only after explicit clear", async () => {
    const { wrapper } = setup();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.settings.models.edit)!
      .trigger("click");
    await flushPromises();
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")!;
    const checkbox = Array.from(
      dialog.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
    ).find((input) =>
      input.parentElement?.textContent?.includes(enUS.settings.models.clearKey),
    )!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    dialog
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({
      config: expect.objectContaining({ api_key: "" }),
      expected_revision: "rev-1",
    });
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
  it("aborts a model test and removes credentials when management identity changes", async () => {
    let finish!: (value: unknown) => void;
    mocks.test.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { wrapper } = setup();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.settings.models.edit)!
      .trigger("click");
    await flushPromises();
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[role=dialog] button"),
    ).find((item) => item.textContent === enUS.settings.models.test)!;
    button.click();
    await flushPromises();
    const signal = mocks.test.mock.calls[0]![1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    user.value = { id: "other", system_role: "user" };
    await flushPromises();
    expect(signal.aborted).toBe(true);
    finish({ ok: true, message: "success" });
    await flushPromises();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(wrapper.text()).toContain(enUS.settings.models.adminOnly);
  });
  it("keeps an editor open on a revision conflict without retrying or overwriting", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Model revision changed"));
    const { wrapper } = setup();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.settings.models.edit)!
      .trigger("click");
    await flushPromises();
    document
      .querySelector("[role=dialog] form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(
      document.querySelector("[role=dialog] [role=status]")?.textContent,
    ).toContain("Model revision changed");
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0]![0].expected_revision).toBe("rev-1");
  });
});

describe("model mutation lifetime", () => {
  for (const operation of ["toggle", "editor"] as const) {
    for (const departure of ["unmount", "account"] as const) {
      it(`${operation} does not refresh a later owner after ${departure}`, async () => {
        let finish!: (value: unknown) => void;
        mocks.save.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        );
        const { wrapper, client } = setup();
        const invalidate = vi.spyOn(client, "invalidateQueries");
        await flushPromises();
        await wrapper
          .findAll("button")
          .find(
            (button) =>
              button.text() ===
              (operation === "toggle"
                ? enUS.settings.models.disable
                : enUS.settings.models.edit),
          )!
          .trigger("click");
        if (operation === "editor") {
          await flushPromises();
          document
            .querySelector("[role=dialog] form")!
            .dispatchEvent(
              new Event("submit", { bubbles: true, cancelable: true }),
            );
        }
        await flushPromises();
        expect(mocks.save).toHaveBeenCalledTimes(1);
        if (departure === "unmount") wrapper.unmount();
        else user.value = { id: "next-admin", system_role: "admin" };
        await flushPromises();
        invalidate.mockClear();
        finish(model);
        await flushPromises();
        expect(invalidate).not.toHaveBeenCalled();
        expect(toast.toasts.value).toHaveLength(0);
        expect(document.querySelector("[role=dialog]")).toBeNull();
      });
    }
  }
  it("a rejected toggle after unmount does not publish a global error", async () => {
    let reject!: (error: Error) => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const { wrapper } = setup();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.settings.models.disable)!
      .trigger("click");
    wrapper.unmount();
    reject(new Error("Retired save"));
    await flushPromises();
    expect(toast.toasts.value).toHaveLength(0);
  });
});
