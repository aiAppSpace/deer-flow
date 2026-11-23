import { describe, expect, it } from "vitest";

import { clientChunkFileName } from "../../../config/client-chunk-file-name";

function file(moduleId: string) {
  return clientChunkFileName({ name: "language", moduleIds: [moduleId] });
}

describe("client chunk module ownership", () => {
  it.each([
    "/repo/node_modules/reka-ui/dist/index.js",
    "/repo/node_modules/.pnpm/reka-ui@2.10.1/node_modules/reka-ui/dist/index.js",
  ])("classifies the actual Reka package boundary at %s", (moduleId) => {
    expect(file(moduleId)).toBe("_nuxt/vendor-ui-[hash].js");
  });

  it.each([
    "splitpanes/dist/splitpanes.es.js",
    "reka-ui-extra/index.js",
    "lucide-vue-next/dist/index.js",
    "class-variance-authority/dist/index.js",
    "clsx/dist/clsx.mjs",
    "tailwind-merge/dist/bundle-mjs.mjs",
  ])(
    "keeps retired or general-purpose %s outside the UI bucket",
    (moduleId) => {
      for (const prefix of [
        "/repo/node_modules/",
        "/repo/node_modules/.pnpm/package@1/node_modules/",
      ]) {
        expect(file(`${prefix}${moduleId}`)).toBe("_nuxt/language-[hash].js");
      }
    },
  );

  it.each(["vue-vine", "vue", "vue-html"])(
    "keeps Shiki's %s grammar outside the Vue runtime bucket",
    (language) => {
      expect(
        file(
          `/repo/node_modules/.pnpm/@shikijs+langs@3.23.0/node_modules/@shikijs/langs/dist/${language}.mjs`,
        ),
      ).toBe("_nuxt/language-[hash].js");
    },
  );

  it.each([
    "@vue/runtime-core/dist/runtime-core.esm-bundler.js",
    "vue/dist/vue.runtime.esm-bundler.js",
    "vue-router/dist/vue-router.mjs",
    "@tanstack/vue-query/build/modern/index.js",
  ])(
    "classifies the actual %s package in direct and pnpm layouts",
    (moduleId) => {
      for (const prefix of [
        "/repo/node_modules/",
        "/repo/node_modules/.pnpm/package@1/node_modules/",
      ]) {
        expect(file(`${prefix}${moduleId}`)).toBe("_nuxt/vendor-vue-[hash].js");
      }
    },
  );

  it.each([
    "vuex/dist/index.js",
    "vue-router-extra/index.js",
    "@vue-extra/runtime/index.js",
  ])(
    "does not classify the similarly named %s package as Vue runtime",
    (moduleId) => {
      expect(
        file(`/repo/node_modules/.pnpm/package@1/node_modules/${moduleId}`),
      ).toBe("_nuxt/language-[hash].js");
    },
  );
});
