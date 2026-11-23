/*
  【文件职责】     固定locale 即时更新、cookie/lang 与已打开 Appearance UI 合同。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     app/plugins/i18n.ts · AppearanceSettings.vue
  【边界与注意】   plugin 提供 ref/computed；dialog 不缓存第二份词典或 locale。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppearanceSettings from "@/components/workspace/settings/AppearanceSettings.vue";
import { Select } from "@/components/ui/select";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";
import type { Locale } from "@/core/i18n/locale";

let mountedHook: (() => void) | undefined;
const wrappers: ReturnType<typeof mount>[] = [];
const disposers: (() => void)[] = [];

beforeEach(() => {
  mountedHook = undefined;
  document.cookie = "locale=; max-age=0; path=/";
  document.documentElement.lang = "";
  vi.stubGlobal("defineNuxtPlugin", (plugin: unknown) => plugin);
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useRequestHeaders", () => ({}));
  vi.stubGlobal("useState", (_key: string, initial: () => Locale) =>
    ref(initial()),
  );
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  disposers.splice(0).forEach((dispose) => dispose());
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("i18n plugin", () => {
  it("loads only the browser locale for a CSR page with no server-rendered content", async () => {
    document.cookie = "locale=zh-CN; path=/";
    const translations = await import("@/core/i18n/translations");
    const loaded = vi.spyOn(translations, "loadTranslations");
    const { default: plugin } = await import("@/plugins/i18n");
    const provided = await (
      plugin as unknown as (app: unknown) => Promise<{
        provide: {
          i18n: { locale: { value: Locale }; t: { value: typeof enUS } };
        };
      }>
    )({
      payload: { serverRendered: false },
      hook(name: string, callback: () => void) {
        if (name === "app:mounted") mountedHook = callback;
      },
      vueApp: { onUnmount: (dispose: () => void) => disposers.push(dispose) },
    });
    expect(provided.provide.i18n.locale.value).toBe("zh-CN");
    expect(provided.provide.i18n.t.value.settings.appearance.themeTitle).toBe(
      zhCN.settings.appearance.themeTitle,
    );
    expect(loaded.mock.calls.map(([locale]) => locale)).toEqual(["zh-CN"]);
    mountedHook?.();
    await flushPromises();
    expect(loaded.mock.calls.map(([locale]) => locale)).toEqual(["zh-CN"]);
    loaded.mockRestore();
  });

  it("hydrates from one serialized locale before consuming the browser cookie", async () => {
    document.cookie = "locale=zh-CN; path=/";
    const { default: plugin } = await import("@/plugins/i18n");
    const provided = await (
      plugin as unknown as (nuxtApp: {
        hook: (name: string, callback: () => void) => void;
        vueApp: { onUnmount: (callback: () => void) => void };
      }) => Promise<{
        provide: {
          i18n: {
            locale: { value: Locale };
            t: { value: typeof enUS };
            setLocale: (locale: Locale) => Promise<void>;
          };
        };
      }>
    )({
      hook(name, callback) {
        if (name === "app:mounted") mountedHook = callback;
      },
      vueApp: { onUnmount: (dispose: () => void) => disposers.push(dispose) },
    });
    const i18n = provided.provide.i18n;
    expect(i18n.t.value.settings.appearance.themeTitle).toBe(
      enUS.settings.appearance.themeTitle,
    );
    expect(i18n.locale.value).toBe("en-US");
    expect(document.documentElement.lang).toBe("");

    mountedHook?.();
    await flushPromises();
    expect(i18n.locale.value).toBe("zh-CN");
    expect(i18n.t.value.settings.appearance.themeTitle).toBe(
      zhCN.settings.appearance.themeTitle,
    );
    expect(document.documentElement.lang).toBe("zh-CN");
    const { getUiLocale } = await import("@/core/settings/ui-locale");
    expect(getUiLocale()).toBe("zh-CN");

    await Promise.all([i18n.setLocale("zh-CN"), i18n.setLocale("en-US")]);
    await flushPromises();
    expect(i18n.locale.value).toBe("en-US");
    expect(i18n.t.value.settings.appearance.themeTitle).toBe(
      enUS.settings.appearance.themeTitle,
    );
    expect(document.documentElement.lang).toBe("en-US");
    expect(document.cookie).toContain("locale=en-US");
    expect(getUiLocale()).toBe("en-US");
    const headFactory = vi.mocked(useHead).mock.calls[0]?.[0] as () => {
      htmlAttrs: { lang: Locale };
    };
    expect(headFactory().htmlAttrs.lang).toBe("en-US");
  });
});

describe("AppearanceSettings", () => {
  it("updates an already-open panel immediately and delegates theme changes to the app owner", async () => {
    const { default: plugin } = await import("@/plugins/i18n");
    const provided = await (
      plugin as unknown as (app: unknown) => Promise<{
        provide: {
          i18n: {
            locale: { value: Locale };
            t: { value: typeof enUS };
            setLocale: (locale: Locale) => Promise<void>;
          };
        };
      }>
    )({
      payload: { serverRendered: false },
      hook(name: string, callback: () => void) {
        if (name === "app:mounted") mountedHook = callback;
      },
      vueApp: { onUnmount: (dispose: () => void) => disposers.push(dispose) },
    });
    const i18n = provided.provide.i18n;
    const preference = ref<"system" | "light" | "dark">("system");
    const resolved = ref<"light" | "dark">("light");
    const setPreference = vi.fn((next: typeof preference.value) => {
      preference.value = next;
    });
    const theme = { preference, resolved, setPreference };
    vi.stubGlobal("useNuxtApp", () => ({ $i18n: i18n, $theme: theme }));

    const wrapper = mount(AppearanceSettings, {
      attachTo: document.body,
      /*
        走 `mocks` 而不是 `config.globalProperties`：后者的类型是完整的
        `ComponentCustomProperties`，只塞两个全局属性天生编译不过。
      */
      global: { mocks: { $i18n: i18n, $theme: theme } },
    });
    wrappers.push(wrapper);
    expect(wrapper.text()).toContain(enUS.settings.appearance.themeTitle);
    /*
      语言选择器已经从原生 `<select>` 换成 shadcn 的 Select（与上游同一个
      primitive），没有 `setValue` 可用；Reka 的下拉要真的指针事件才展开，
      在这个环境里点不开。这条用例的主题是「面板已经打开时，locale 一变就跟着变」，
      所以直接从 Select 发它自己的 `update:modelValue`——那正是面板接的那个事件。
      「选择器确实是 Select 而不是原生 select」由
      tests/unit/settings/settings-panels.dom.test.ts 单独钉。
    */
    wrapper.getComponent(Select).vm.$emit("update:modelValue", "zh-CN");
    await flushPromises();
    expect(wrapper.text()).toContain(zhCN.settings.appearance.themeTitle);
    expect(wrapper.text()).toContain(zhCN.settings.appearance.darkDescription);
    expect(i18n.locale.value).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.cookie).toContain("locale=zh-CN");

    await wrapper.get('[data-theme-preference="dark"]').trigger("click");
    expect(setPreference).toHaveBeenCalledWith("dark");
    expect(wrapper.find("script").exists()).toBe(false);
  });
});
