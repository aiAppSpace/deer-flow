import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { build, type Plugin } from "vite";

export type NotificationApp = "react" | "vue";

// Native removal dispatches focus events differently from happy-dom. Compile
// the real components with declared workspace tools; only theme/i18n are fixed.
// This fixture owns component mounting and retirement, not application routing.
export async function buildNotificationComponent(app: NotificationApp) {
  const vueRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const root = app === "vue" ? vueRoot : resolve(vueRoot, "../frontend");
  const sourceRoot = resolve(root, app === "vue" ? "app" : "src");
  const entry = resolve(root, "notification-lifecycle.fixture.js");
  const moduleId = "\0" + entry;
  const source =
    app === "react"
      ? `
        import { createElement, useEffect } from "react";
        import { createRoot } from "react-dom/client";
        import { toast } from "sonner";
        import { Toaster } from ${JSON.stringify(resolve(sourceRoot, "components/ui/sonner.tsx"))};
        const root = createRoot(document.querySelector("#fixture"));
        function Fixture() {
          useEffect(() => {
            const show = () => toast.success("Lifecycle notice", { duration: Infinity });
            const clear = () => toast.dismiss();
            const unmount = () => root.unmount();
            document.addEventListener("notification:show", show);
            document.addEventListener("notification:clear", clear);
            document.addEventListener("notification:unmount", unmount);
            document.documentElement.dataset.notificationReady = "true";
            return () => {
              document.removeEventListener("notification:show", show);
              document.removeEventListener("notification:clear", clear);
              document.removeEventListener("notification:unmount", unmount);
            };
          }, []);
          return createElement(Toaster, { position: "top-center" });
        }
        root.render(createElement(Fixture));
      `
      : `
        import { createApp, defineComponent, h, provide, ref } from "vue";
        import WorkspaceToaster from ${JSON.stringify(resolve(sourceRoot, "components/workspace/WorkspaceToaster.vue"))};
        import { createWorkspaceToastStore, workspaceToastKey } from ${JSON.stringify(resolve(sourceRoot, "core/workspace-shell/toast.ts"))};
        const toast = createWorkspaceToastStore({ durationMs: 60000 });
        const i18n = { t: ref({ primitives: { notifications: "Notifications" } }) };
        globalThis.useNuxtApp = () => ({ $i18n: i18n });
        const root = createApp(defineComponent({
          setup() {
            provide(workspaceToastKey, toast);
            return () => h(WorkspaceToaster);
          },
        }));
        root.config.globalProperties.$i18n = i18n;
        root.mount("#fixture");
        document.addEventListener("notification:show", () => toast.success("Lifecycle notice"));
        document.addEventListener("notification:clear", () => toast.clear());
        document.addEventListener("notification:unmount", () => {
          root.unmount();
          toast.clear();
        });
        document.documentElement.dataset.notificationReady = "true";
      `;
  const fixture: Plugin = {
    name: "notification-lifecycle-fixture",
    resolveId(id) {
      if (id === entry) return moduleId;
      if (app === "react" && id === "next-themes")
        return "\0notification-fixed-theme";
    },
    load(id) {
      if (id === moduleId) return source;
      if (id === "\0notification-fixed-theme")
        return 'export const useTheme = () => ({ theme: "light" });';
    },
  };
  const built = await build({
    root,
    configFile: false,
    logLevel: "error",
    plugins: [fixture, ...(app === "vue" ? [vue()] : [])],
    resolve: { alias: { "@": sourceRoot } },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      __VUE_OPTIONS_API__: "true",
      __VUE_PROD_DEVTOOLS__: "false",
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
    },
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ["iife"], name: "NotificationLifecycle" },
    },
  });
  const outputs = Array.isArray(built) ? built : [built];
  const output = outputs[0];
  if (outputs.length !== 1 || !output || !("output" in output))
    throw new Error("Expected one in-memory notification bundle");
  const chunks = output.output.filter((item) => item.type === "chunk");
  if (chunks.length !== 1)
    throw new Error("Notification fixture must have one complete script");
  return chunks[0]!.code;
}
