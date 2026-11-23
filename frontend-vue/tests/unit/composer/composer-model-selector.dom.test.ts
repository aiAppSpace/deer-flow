import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref, type Ref } from "vue";
import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { favoritesKey, serializeFavoriteNames } from "@/core/models/favorites";
import type { Model } from "@/core/models/types";

const auth = vi.hoisted(() => ({
  session: undefined as
    | Ref<{ tag: "authenticated"; user: { id: string } } | { tag: "anonymous" }>
    | undefined,
  fetching: undefined as Ref<boolean> | undefined,
}));
vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({ session: auth.session, isFetching: auth.fetching }),
}));
const models: Model[] = [
  {
    id: "reasoner",
    name: "reasoner",
    model: "Provider-R",
    display_name: "Reasoner",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
  {
    id: "fast",
    name: "fast",
    model: "Provider-F",
    display_name: "Fast Model",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
];
let sequence = 0;
let userId: string;
const wrappers: ReturnType<typeof mount>[] = [];
beforeEach(() => {
  userId = `model-picker-${++sequence}`;
  auth.session = ref({ tag: "authenticated", user: { id: userId } });
  auth.fetching = ref(false);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
function create(props: Record<string, unknown> = {}) {
  const wrapper = mount(ComposerModelSelector, {
    attachTo: document.body,
    props: { models, selectedModel: models[0], ...props },
  });
  wrappers.push(wrapper);
  return wrapper;
}
const rows = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-model-picker-option]"),
  );
const favorite = (name: string) =>
  document.querySelector<HTMLButtonElement>(`[data-model-favorite="${name}"]`)!;
async function open(wrapper: ReturnType<typeof create>) {
  await wrapper.get("button").trigger("click");
  await flushPromises();
}

describe("current React model picker contract", () => {
  it("keeps an unnamed trigger before model resolution and uses the responsive width", () => {
    const wrapper = create({ selectedModel: undefined });
    const trigger = wrapper.get("button");
    expect(trigger.text()).toBe("");
    expect(trigger.attributes("aria-label")).toBeUndefined();
    expect(trigger.classes()).toEqual(
      expect.arrayContaining(["min-w-0", "max-w-40", "px-2.5", "sm:max-w-56"]),
    );
    expect(trigger.classes()).not.toContain("truncate");
    expect(trigger.get("span").classes()).toContain("truncate");
  });
  it("opens the current popover directory with provider IDs and current selection", async () => {
    const wrapper = create();
    await open(wrapper);
    expect(
      document.querySelector('[role="dialog"]')?.getAttribute("aria-label"),
    ).toBe(enUS.modelPicker.title);
    expect(
      document
        .querySelector('[role="dialog"]')
        ?.getAttribute("aria-labelledby"),
    ).toBe("");
    expect(
      document.querySelector('[role="group"]')?.getAttribute("aria-label"),
    ).toBe(enUS.modelPicker.otherModels);
    expect(rows().map((row) => row.textContent)).toEqual([
      "ReasonerProvider-R",
      "Fast ModelProvider-F",
    ]);
    expect(rows()[0]?.getAttribute("aria-current")).toBe("true");
    expect(rows()[1]?.getAttribute("aria-current")).toBeNull();
    expect(document.activeElement).toBe(rows()[0]);
    expect(document.querySelector("input")).toBeNull();
    expect(
      document
        .querySelector('[data-slot="popover-picker-content"]')
        ?.classList.contains("z-80"),
    ).toBe(true);
  });
  it("moves model focus with wrapping arrows and emits the selected model", async () => {
    const wrapper = create();
    await open(wrapper);
    rows()[0]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    expect(document.activeElement).toBe(rows()[1]);
    rows()[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(rows()[0]);
    rows()[1]!.click();
    await flushPromises();
    expect(wrapper.emitted("select")).toEqual([[models[1]]]);
    expect(wrapper.get("button").attributes("aria-expanded")).toBe("false");
  });
  it("groups favorites and preserves focus on the star after both reorder directions", async () => {
    const wrapper = create();
    await open(wrapper);
    favorite("fast").focus();
    favorite("fast").click();
    await flushPromises();
    expect(rows().map((row) => row.dataset.modelName)).toEqual([
      "fast",
      "reasoner",
    ]);
    expect(document.activeElement).toBe(favorite("fast"));
    expect(favorite("fast").getAttribute("aria-pressed")).toBe("true");
    expect(wrapper.emitted("select")).toBeUndefined();
    expect(wrapper.get("button").attributes("aria-expanded")).toBe("true");
    expect(
      JSON.parse(localStorage.getItem(favoritesKey(userId))!).names,
    ).toEqual(["fast"]);
    favorite("fast").click();
    await flushPromises();
    expect(rows().map((row) => row.dataset.modelName)).toEqual([
      "reasoner",
      "fast",
    ]);
    expect(document.activeElement).toBe(favorite("fast"));
  });
  it("ignores invalid stored favorites while preserving backend model order", async () => {
    localStorage.setItem(
      favoritesKey(userId),
      serializeFavoriteNames(["gone", "fast"]),
    );
    const wrapper = create();
    await open(wrapper);
    expect(rows().map((row) => row.dataset.modelName)).toEqual([
      "fast",
      "reasoner",
    ]);
    expect(document.activeElement).toBe(rows()[1]);
    expect(document.body.textContent).not.toContain("gone");
  });
  it("switches favorite ownership when the authenticated identity changes", async () => {
    localStorage.setItem(
      favoritesKey(userId),
      serializeFavoriteNames(["fast"]),
    );
    const wrapper = create();
    await open(wrapper);
    auth.session!.value = {
      tag: "authenticated",
      user: { id: `${userId}-other` },
    };
    await flushPromises();
    expect(rows().map((row) => row.dataset.modelName)).toEqual([
      "reasoner",
      "fast",
    ]);
    expect(favorite("fast").getAttribute("aria-pressed")).toBe("false");
    auth.session!.value = { tag: "anonymous" };
    await flushPromises();
    expect(document.querySelector("[data-model-favorite]")).toBeNull();
  });
  it("blocks favorites while account hydration is pending and blocks selection when locked", async () => {
    const wrapper = create();
    await open(wrapper);
    auth.fetching!.value = true;
    await flushPromises();
    expect(favorite("fast").disabled).toBe(true);
    await wrapper.setProps({ disabled: true });
    rows()[1]!.click();
    expect(wrapper.emitted("select")).toBeUndefined();
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
  });
  it("reports session-only persistence after storage failure", async () => {
    const wrapper = create();
    await open(wrapper);
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    favorite("fast").click();
    await flushPromises();
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      enUS.modelPicker.sessionOnly,
    );
    expect(favorite("fast").getAttribute("aria-pressed")).toBe("true");
  });
  it("renders the current empty directory notice", async () => {
    const wrapper = create({ models: [], selectedModel: undefined });
    await open(wrapper);
    expect(rows()).toEqual([]);
    expect(document.body.textContent).toContain(enUS.modelPicker.noModels);
  });
});

it("retires pending favorite focus work when the picker closes in the same turn", async () => {
  const wrapper = create();
  const errors: unknown[] = [];
  wrapper.vm.$.appContext.config.errorHandler = (error) => {
    errors.push(error);
  };
  await open(wrapper);
  favorite("fast").focus();
  favorite("fast").click();
  (wrapper.get("button").element as HTMLButtonElement).click();
  await flushPromises();
  expect(wrapper.get("button").attributes("aria-expanded")).toBe("false");
  expect(errors).toEqual([]);
  expect(document.activeElement).toBe(wrapper.get("button").element);
});
