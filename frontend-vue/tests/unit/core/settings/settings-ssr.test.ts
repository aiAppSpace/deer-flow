// @vitest-environment node
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { afterEach, expect, it, vi } from "vitest";

import { useThreadSettings } from "@/composables/useThreadSettings";
import * as store from "@/core/settings/store";

afterEach(() => vi.restoreAllMocks());

it("does not retain completed server-rendered thread consumers in the browser settings store", async () => {
  const reads = vi.spyOn(store, "getThreadModelSnapshot");
  for (const threadId of [
    "public-showcase-a",
    "public-showcase-b",
    "public-showcase-c",
  ]) {
    const app = createSSRApp(
      defineComponent({
        setup() {
          const { settings } = useThreadSettings(threadId);
          return () =>
            h("output", settings.value.context.model_name ?? "default");
        },
      }),
    );
    expect(await renderToString(app)).toBe("<output>default</output>");
  }
  const readsAfterRendering = reads.mock.calls.length;
  // A later update must not call closures retained from completed requests.
  // This exercises the real subscription consumer without exposing its registry.
  store.updateLocalSettings("tokenUsage", { headerTotal: false });
  expect(reads.mock.calls.length).toBe(readsAfterRendering);
});
