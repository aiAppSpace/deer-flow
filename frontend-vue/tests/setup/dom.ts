/*
  【文件职责】     为纯 happy-dom 组件测试提供 Nuxt 在真实应用里注入的默认 i18n 上下文。
  【架构位置】     测试基础设施
  【主要导出】     无；由 vitest.config.ts 的 dom project 在每个测试前执行
  【依赖关系】     @vue/test-utils 全局 mocks · Vitest globals · en-US 词典
  【边界与注意】   dom project 故意不启动 Nuxt；组件仍应使用生产 useNuxtApp/$i18n，
                   这里只复刻框架注入边界。每条用例都创建新 ref，避免 locale 状态串案；
                   需要特定 locale/theme 的用例可以继续用 vi.stubGlobal 覆盖。
*/

import { config } from "@vue/test-utils";
import { beforeEach, vi } from "vitest";
import { readonly, ref } from "vue";

import { enUS } from "@/core/i18n/locales/en-US";
import { createRouteAnnouncements } from "@/core/workspace-shell/route-announcement";

beforeEach(() => {
  const $i18n = {
    locale: ref<"en-US" | "zh-CN">("en-US"),
    setLocale: vi.fn(),
    t: ref(enUS),
  };
  // 与 app/plugins/theme.ts 的 SSR 快照同形：只读 refs + 无副作用 setter。
  // 消费 $theme 的组件在 dom project 里同样应该走生产 useNuxtApp。
  const $theme = {
    preference: readonly(ref<"system" | "light" | "dark">("system")),
    resolved: readonly(ref<"light" | "dark">("light")),
    forced: readonly(ref<"light" | "dark" | null>(null)),
    setPreference: vi.fn(),
    setForcedTheme: vi.fn(),
    dispose: vi.fn(),
  };
  const $routeAnnouncements = createRouteAnnouncements();
  vi.stubGlobal("useNuxtApp", () => ({ $i18n, $theme, $routeAnnouncements }));
  /*
    只有 $i18n 进 globalProperties。模板里以 `$` 开头的标识符走 ctx 而不是
    setup 绑定，所以往这里塞 $theme 会盖掉那些自带 theme owner 的用例
    （wp12 的 AppearanceSettings 就是）。消费 theme 的组件从
    useNuxtApp() 取，不靠模板 ctx。
  */
  config.global.mocks = { ...config.global.mocks, $i18n };
});
