import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { build, type Plugin } from "vite";

export type MarkdownUpdateApp = "react" | "vue";

/** Compile the installed renderer and real app adapters; only input/locale are controlled. */
export async function buildMarkdownUpdateComponent(app: MarkdownUpdateApp) {
  const vueRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const root = app === "vue" ? vueRoot : resolve(vueRoot, "../frontend");
  const sourceRoot = resolve(root, app === "vue" ? "app" : "src");
  const entry = resolve(root, "markdown-update.fixture.js");
  const moduleId = "\0" + entry;
  const source =
    app === "react"
      ? `
    import { createElement, useEffect, useState } from "react";
    import { createRoot } from "react-dom/client";
    import { ClipboardSafeStreamdown } from ${JSON.stringify(resolve(sourceRoot, "components/ai-elements/streamdown.tsx"))};
    function Fixture() {
      const [content, setContent] = useState(window.__initialMarkdown);
      useEffect(() => {
        const update = (event) => setContent(event.detail);
        document.addEventListener("markdown:replace", update);
        document.documentElement.dataset.markdownReady = "true";
        return () => document.removeEventListener("markdown:replace", update);
      }, []);
      return createElement(ClipboardSafeStreamdown, { mode: "static" }, content);
    }
    createRoot(document.querySelector("#fixture")).render(createElement(Fixture));
  `
      : `
    import { createApp, defineComponent, h, onMounted, onUnmounted, ref } from "vue";
    import StreamMarkdown from ${JSON.stringify(resolve(sourceRoot, "components/markdown/StreamMarkdown.vue"))};
    import { richContentComponents } from ${JSON.stringify(resolve(sourceRoot, "components/markdown/components.ts"))};
    import { appRemarkPlugins } from ${JSON.stringify(resolve(sourceRoot, "core/markdown/plugins.ts"))};
    import { enUS } from ${JSON.stringify(resolve(sourceRoot, "core/i18n/locales/en-US.ts"))};
    globalThis.useNuxtApp = () => ({ $i18n: { t: ref(enUS), locale: ref("en-US") } });
    createApp(defineComponent({ setup() {
      const content = ref(window.__initialMarkdown);
      const update = (event) => { content.value = event.detail; };
      onMounted(() => {
        document.addEventListener("markdown:replace", update);
        document.documentElement.dataset.markdownReady = "true";
      });
      onUnmounted(() => document.removeEventListener("markdown:replace", update));
      return () => h(StreamMarkdown, { content: content.value, remarkPlugins: appRemarkPlugins, rehypePlugins: [], components: richContentComponents });
    }})).mount("#fixture");
  `;
  const fixture: Plugin = {
    name: "markdown-update-fixture",
    resolveId(id) {
      if (id === entry) return moduleId;
    },
    load(id) {
      if (id === moduleId) return source;
      if (id === "\0markdown-fixed-locale")
        return `import { enUS } from ${JSON.stringify(resolve(sourceRoot, "core/i18n/locales/en-US.ts"))}; export const useI18n = () => ({ t: enUS, locale: "en-US" });`;
    },
  };
  const built = await build({
    root,
    configFile: false,
    logLevel: "error",
    plugins: [fixture, ...(app === "vue" ? [vue()] : [])],
    resolve: {
      alias: [
        ...(app === "react"
          ? [
              {
                find: "@/core/i18n/hooks",
                replacement: "\0markdown-fixed-locale",
              },
            ]
          : []),
        { find: "@", replacement: sourceRoot },
      ],
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      __VUE_OPTIONS_API__: "true",
      __VUE_PROD_DEVTOOLS__: "false",
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
    },
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ["iife"], name: "MarkdownUpdate" },
    },
  });
  const outputs = Array.isArray(built) ? built : [built];
  const output = outputs[0];
  if (outputs.length !== 1 || !output || !("output" in output))
    throw new Error("Expected one in-memory Markdown bundle");
  const chunks = output.output.filter((item) => item.type === "chunk");
  if (chunks.length !== 1)
    throw new Error("Markdown fixture must have one complete script");
  return chunks[0]!.code;
}
