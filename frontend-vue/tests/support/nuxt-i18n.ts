/*
  【文件职责】     单测里那份 `$i18n` 桩：形状与 app/plugins/i18n.ts 注入的真身一致。
  【架构位置】     测试脚手架
  【主要导出】     nuxtI18nStub · nuxtI18nMocks
  【依赖关系】     core/i18n locales
  【边界与注意】   `t` 必须是**真的 computed**，不是 `{ value: enUS }` 字面量。
                   组件只读 `t.value`，两者运行时等价；但插件注入的类型是
                   `ComputedRef<Translations>`，写成字面量在 `globalProperties`
                   这个**有类型的**位置上就是不符——tests/ 接上类型检查之后
                   它会当场报出来。等价的东西写成不等价的类型，正是要清掉的那类噪声。

                   `vi.stubGlobal("useNuxtApp", …)` 那条路径收的是 any，写错了没人管；
                   所以两边都用这一份，别让「哪条路径有人守」变成随机的。
*/
import { computed, ref } from "vue";

import { DEFAULT_LOCALE, type Locale } from "@/core/i18n/locale";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";

const catalogs = { "en-US": enUS, "zh-CN": zhCN } as const;

/** 与插件同形：`locale` 可写，`t` 跟着它走，`setLocale` 只改本地 ref。 */
export function nuxtI18nStub(initial: Locale = DEFAULT_LOCALE) {
  const locale = ref<Locale>(initial);
  return {
    locale,
    t: computed(() => catalogs[locale.value]),
    setLocale: (next: Locale) => {
      locale.value = next;
    },
  };
}

/*
  给 `mount(..., { global: { mocks } })` 用。

  **不要走 `config.globalProperties`**：VTU 那个位置的类型是完整的
  `ComponentCustomProperties`（`$route` / `$router` / `$nuxt` … 246 个成员），
  只塞一个 `$i18n` 天生编译不过；`mocks` 才是「只补几个全局属性」的入口，
  底下同样是装进 globalProperties。
*/
export function nuxtI18nMocks(initial: Locale = DEFAULT_LOCALE) {
  return { $i18n: nuxtI18nStub(initial) };
}
