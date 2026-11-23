// @vitest-environment node
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { useModelFavorites } from "@/composables/useModelFavorites";
import * as store from "@/core/models/favorites-store";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function render(userId: string) {
  return renderToString(
    createSSRApp(
      defineComponent({
        setup() {
          const favorites = useModelFavorites(userId);
          return () =>
            h(
              "output",
              `${favorites.persistence.value}:${favorites.names.value.length}`,
            );
        },
      }),
    ),
  );
}
it("uses an empty browser-free server snapshot without retaining server mutations", async () => {
  for (const user of ["ssr-favorite-a", "ssr-favorite-b"]) {
    expect(await render(user)).toBe("<output>memory:0</output>");
    store.setModelFavorite(user, "fast", true);
    expect(store.getFavoritesSnapshot(user)).toBe(store.EMPTY_FAVORITES);
  }
});
it("does not retain completed server consumers when a later browser store writes", async () => {
  const reads = vi.spyOn(store, "getFavoritesSnapshot");
  await render("ssr-browser-transition");
  const afterRender = reads.mock.calls.length;
  const values = new Map<string, string>();
  const browser = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  vi.stubGlobal("window", browser);
  store.setModelFavorite("ssr-browser-transition", "fast", true);
  expect(reads.mock.calls.length).toBe(afterRender);
  const listener = vi.fn();
  const remove = vi.spyOn(browser, "removeEventListener");
  const unsubscribe = store.subscribeFavorites(
    "ssr-browser-transition",
    listener,
  );
  store.setModelFavorite("ssr-browser-transition", "fast", false);
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
});
