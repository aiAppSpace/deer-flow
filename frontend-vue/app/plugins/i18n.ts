/*
  【文件职责】     应用级 locale：统一 SSR/CSR 首屏状态与运行期切换（05 N4）。
  【架构位置】     L3
  【主要导出】     Nuxt plugin，provide `$i18n`
  【依赖关系】     core/i18n locale/cookie/translations · Nuxt provide
  【边界与注意】   **provide 的是 ref，不是快照（05 M1）。** 上游 React 版
                   `provide(ctx, { locale, setLocale, t })` 这个写法照搬过来
                   编译能过、运行不报错、切语言时**整个应用一个字都不变**——
                   `inject` 在 setup 期间一次性解析，拿到的是当时那个普通对象。
                   这里 `locale` 与 `t` 都是 ref/computed。

                   首屏状态只能由 Nuxt `useState` 序列化并在 hydration 两端复用。
                   SSR 请求直接从 cookie 派生；locale 个性化页面不得静态预渲染，
                   否则同一份 HTML 无法与不同用户 cookie 同时一致。只有确实带 SSR
                   内容的页面复用 payload locale 完成 hydration；纯 CSR 页面直接选择
                   浏览器 cookie/语言，不下载随后立即弃用的默认字典。
*/

import { computed, shallowRef, watch, type ComputedRef, type Ref } from "vue";

import { loadTranslations } from "@/core/i18n/translations";
import { parseLocaleCookie, setLocaleInCookie } from "@/core/i18n/cookies";
import { DEFAULT_LOCALE, detectLocale, type Locale } from "@/core/i18n/locale";
import { reportUiLocale } from "@/core/settings/ui-locale";
import type { Translations } from "@/core/i18n/locales/types";

// Nuxt augments NuxtApp from each plugin's return type. Reading its payload
// here therefore needs an explicit public contract to avoid recursive inference.
type I18nPluginResult = {
  provide: {
    i18n: {
      locale: Ref<Locale>;
      t: ComputedRef<Translations>;
      setLocale: (next: Locale) => Promise<void>;
    };
  };
};

export default defineNuxtPlugin(async (nuxtApp): Promise<I18nPluginResult> => {
  const requestLocale = import.meta.server
    ? parseLocaleCookie(useRequestHeaders(["cookie"]).cookie ?? "")
    : null;
  const clientLocale: Locale | null =
    !import.meta.server && nuxtApp.payload?.serverRendered === false
      ? (parseLocaleCookie(document.cookie) ?? detectLocale())
      : null;
  const locale = useState<Locale>(
    "deerflow-locale",
    () => requestLocale ?? clientLocale ?? DEFAULT_LOCALE,
  );
  useHead(() => ({ htmlAttrs: { lang: locale.value } }));
  // Formatter functions stay in the runtime, not Nuxt's serialized payload.
  // Load only the serialized locale before hydration; switches publish the
  // new dictionary and locale together after its chunk has arrived.
  const dictionary = shallowRef(await loadTranslations(locale.value));
  const t = computed(() => dictionary.value);
  let selection = 0;

  const setLocale = async (next: Locale) => {
    const request = ++selection;
    const loaded = await loadTranslations(next);
    if (request !== selection) return;
    dictionary.value = loaded;
    locale.value = next;
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    setLocaleInCookie(next);
  };

  nuxtApp.hook("app:mounted", async () => {
    const cookieLocale = parseLocaleCookie(document.cookie);
    const next = cookieLocale ?? detectLocale();
    if (next !== locale.value || cookieLocale === null) await setLocale(next);
    else document.documentElement.lang = next;
    const stop = watch(locale, reportUiLocale, { immediate: true });
    nuxtApp.vueApp.onUnmount(stop);
  });

  return {
    provide: {
      i18n: { locale, t, setLocale },
    },
  };
});
