/*
  【文件职责】     装配 Nuxt M0 工程、主题、路由和生产安全配置。
  【架构位置】     L3
  【主要导出】     Nuxt 配置
  【依赖关系】     消费 config/routes.ts
  【边界与注意】   不承载聊天或协议业务；代理规则只从 routes.ts 读取。
*/

import { readFileSync } from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import { createThemeBootstrapScript } from "./app/core/theme/bootstrap";
import { csrRoutes } from "./config/routes";
import { clientChunkFileName } from "./config/client-chunk-file-name";

const appPackageVersion = (
  JSON.parse(
    readFileSync(new URL("package.json", import.meta.url), "utf8"),
  ) as {
    version: string;
  }
).version;

export default defineNuxtConfig({
  compatibilityDate: "2026-08-03",
  modules: ["shadcn-nuxt", "@nuxt/eslint"],
  app: {
    head: {
      /*
        与 React 的根 layout metadata 逐字一致（frontend/src/app/layout.tsx）。
        Vue 此前一条都没设，`document.title` 是空字符串——浏览器标签、书签、
        窗口标题和读屏打开页面时的播报全都拿不到名字。只有 blog 与 docs 路由
        在 React 侧覆盖了标题，而那几条路由 Vue 还没有。
      */
      title: "DeerFlow",
      meta: [
        {
          name: "description",
          content: "A LangChain-based framework for building super agents.",
        },
      ],
      script: [
        {
          key: "deerflow-theme-bootstrap",
          innerHTML: createThemeBootstrapScript(),
        },
      ],
    },
  },
  css: ["~/assets/css/main.css"],
  $production: {
    postcss: {
      plugins: {
        // Preserve exact CSS arithmetic for the browser, as React does. cssnano's
        // default calc reduction rounds Tailwind ratios before layout (2 / 1.5).
        cssnano: { preset: ["default", { calc: false }] },
      },
    },
  },
  // Warm the next route on user intent rather than loading every visible
  // workspace link (and its layout) when opening an unrelated public page.
  experimental: {
    defaults: {
      nuxtLink: { prefetchOn: { interaction: true, visibility: false } },
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // Vite's root is Nuxt's app directory. Scan Vue/TS source entries before
    // serving the first page so lazy panels do not discover shared dependencies
    // mid-navigation and invalidate the browser's in-flight optimized imports.
    optimizeDeps: { entries: ["**/*.{vue,ts}"] },
  },
  hooks: {
    "build:manifest"(manifest) {
      // Keep required modulepreload/import edges. The generated all-route JS
      // prefetch hints otherwise fetch closed panels and both locale chunks.
      for (const chunk of Object.values(manifest)) {
        if (chunk.file?.endsWith(".js")) chunk.prefetch = false;
      }
    },
    "vite:extendConfig"(config, { isClient }) {
      if (!isClient) return;
      if (!config.build) return;
      config.build.rolldownOptions ??= {};
      const output = config.build.rolldownOptions.output;
      if (Array.isArray(output)) {
        for (const item of output) item.chunkFileNames = clientChunkFileName;
      } else {
        config.build.rolldownOptions.output = {
          ...output,
          chunkFileNames: clientChunkFileName,
        };
      }
    },
  },
  components: { dirs: [] },
  shadcn: { prefix: "", componentDir: "./app/components/ui" },
  devServer: { port: 3100 },
  routeRules: {
    ...Object.fromEntries(csrRoutes.map((route) => [route, { ssr: false }])),
  },
  runtimeConfig: {
    gatewayInternalBaseUrl:
      process.env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL ??
      "http://127.0.0.1:8001",
    public: {
      langgraphBaseUrl: "",
      backendBaseUrl: "",
      authDisabled: "",
      m0TestPages: "",
      /*
        关于页显示的产品版本。与 React 的 `src/version.ts` 同一条判据：优先用
        构建期注入的 NUXT_PUBLIC_APP_VERSION（nightly CI 会写成
        `<base>-nightly.<日期>-<短 sha>`），否则回落到 package.json。
        用 `||` 而不是 `??` 是**有意**的：容器构建会把它设成空串，空串必须一起回落。
      */
      appVersion: process.env.NUXT_PUBLIC_APP_VERSION || appPackageVersion,
    },
  },
  nitro: { compressPublicAssets: true },
  typescript: { typeCheck: false },
});
