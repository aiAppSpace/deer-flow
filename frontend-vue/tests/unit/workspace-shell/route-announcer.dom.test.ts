import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, reactive, watch } from "vue";
import {
  createMemoryHistory,
  createWebHistory,
  createRouter,
  onBeforeRouteLeave,
  RouterView,
  type RouteLocationNormalized,
  type Router,
} from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RouteAnnouncer from "@/components/RouteAnnouncer.vue";
import { createRouteAnnouncements } from "@/core/workspace-shell/route-announcement";

// External framework lifecycle signals are controlled; the mounted owner and
// its real shadow alert are never substituted. Router guards are real Vue Router.
function lifecycle() {
  const callbacks = new Map<string, Set<() => void>>();
  return {
    hook(name: string, callback: () => void) {
      const entries = callbacks.get(name) ?? new Set();
      callbacks.set(name, entries);
      entries.add(callback);
      return () => entries.delete(callback);
    },
    emit(name: string) {
      for (const callback of callbacks.get(name) ?? []) callback();
    },
    size() {
      return [...callbacks.values()].reduce(
        (sum, entries) => sum + entries.size,
        0,
      );
    },
  };
}
let router: Router;
let earlyGuard: ((to: RouteLocationNormalized) => unknown) | undefined;
let leaveGuard: (() => boolean) | undefined;
let nuxt: ReturnType<typeof lifecycle>;
let heads: ReturnType<typeof lifecycle>;
let head: { hooks: ReturnType<typeof lifecycle> };
let routeAnnouncements: ReturnType<typeof createRouteAnnouncements>;
const route = reactive({ fullPath: "/initial" });
const wrappers: VueWrapper[] = [];
function mountAnnouncer() {
  const wrapper = mount(RouteAnnouncer, { attachTo: document.body });
  wrappers.push(wrapper);
  return wrapper;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function alert() {
  return document
    .getElementById("__route-announcer__")!
    .shadowRoot!.querySelector("p")!;
}
async function navigate(path: string) {
  await router.push(path);
  route.fullPath = router.currentRoute.value.fullPath;
  heads.emit("entries:updated");
  await flushPromises();
}
async function commit(title: string) {
  document.title = title;
  heads.emit("dom:rendered");
  await flushPromises();
}

beforeEach(async () => {
  document.title = "Initial";
  route.fullPath = "/initial";
  earlyGuard = undefined;
  leaveGuard = undefined;
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/redirect", redirect: "/target" },
      {
        path: "/:pathMatch(.*)*",
        component: defineComponent({
          setup() {
            onBeforeRouteLeave(() => leaveGuard?.());
            return () => h("div");
          },
        }),
      },
    ],
  });
  await router.push("/initial");
  nuxt = lifecycle();
  heads = lifecycle();
  head = { hooks: heads };
  routeAnnouncements = createRouteAnnouncements();
  // Nuxt installs these BEFORE a root component can mount. Its loading:end
  // also fires on failed/cancelled/throwing navigation, without a route argument.
  router.beforeEach(async (to) => {
    await nuxt.emit("page:loading:start");
    return (await earlyGuard?.(to)) as false | Error | undefined;
  });
  router.afterEach((_to, _from, failure) => {
    if (failure) nuxt.emit("page:loading:end");
  });
  router.onError(() => nuxt.emit("page:loading:end"));
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => router);
  vi.stubGlobal("useNuxtApp", () => ({
    hook: nuxt.hook,
    $routeAnnouncements: routeAnnouncements,
  }));
  vi.stubGlobal("injectHead", () => head);
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("RouteAnnouncer navigation-owned head", () => {
  it("preserves the existing announcement for one exact same-page replacement", async () => {
    mountAnnouncer();
    await navigate("/new");
    await commit("New Chat");
    const intent = routeAnnouncements.preservePage({
      from: router.currentRoute.value,
      target: "/created",
      owns: () => true,
    });
    await router.replace({ path: "/created", state: intent.state });
    route.fullPath = "/created";
    heads.emit("entries:updated");
    await commit("Loading...");
    intent.cancel();
    expect(document.title).toBe("Loading...");
    expect(alert().textContent).toBe("New Chat");
    await commit("Authoritative created title");
    expect(alert().textContent).toBe("New Chat");
    await navigate("/another-thread");
    await commit("Other thread");
    expect(alert().textContent).toBe("Other thread");
  });
  it("does not consume a delayed continuation for a newer ordinary navigation to the same path", async () => {
    mountAnnouncer();
    const blocked = deferred<undefined>();
    let calls = 0;
    earlyGuard = async () => {
      if (++calls === 1) await blocked.promise;
    };
    const intent = routeAnnouncements.preservePage({
      from: router.currentRoute.value,
      target: "/created",
      owns: () => true,
    });
    const delayed = router
      .replace({ path: "/created", state: intent.state })
      .finally(intent.cancel);
    await flushPromises();
    await navigate("/created");
    await commit("Ordinary navigation");
    expect(alert().textContent).toBe("Ordinary navigation");
    blocked.resolve(undefined);
    await delayed;
    await commit("Later data");
    expect(alert().textContent).toBe("Ordinary navigation");
  });
  it.each(["abort", "throw", "redirect", "duplicate"] as const)(
    "does not carry a %s continuation into the next navigation",
    async (kind) => {
      mountAnnouncer();
      const target = kind === "duplicate" ? "/initial" : "/created";
      const intent = routeAnnouncements.preservePage({
        from: router.currentRoute.value,
        target,
        owns: () => true,
      });
      earlyGuard = () => {
        if (kind === "abort") return false;
        if (kind === "throw") throw new Error("refused continuation");
        if (kind === "redirect") return "/redirected";
      };
      // Redirect only once, as a real middleware guard would.
      const guard = earlyGuard;
      earlyGuard = (to) => (to.fullPath === target ? guard?.(to) : undefined);
      const replacement = router
        .replace({ path: target, state: intent.state })
        .finally(intent.cancel);
      if (kind === "throw")
        await expect(replacement).rejects.toThrow("refused continuation");
      else await replacement;
      route.fullPath = router.currentRoute.value.fullPath;
      heads.emit("entries:updated");
      await commit("Intervening title");
      if (kind === "redirect")
        expect(alert().textContent).toBe("Intervening title");
      else expect(alert().textContent).toBe("");
      earlyGuard = undefined;
      await navigate("/next");
      await commit("Next page");
      expect(alert().textContent).toBe("Next page");
    },
  );
  it("checks live owner validity and leaves an ordinary title commit intact", async () => {
    mountAnnouncer();
    const blocked = deferred<undefined>();
    earlyGuard = () => blocked.promise;
    let owns = true;
    const intent = routeAnnouncements.preservePage({
      from: router.currentRoute.value,
      target: "/created",
      owns: () => owns,
    });
    const replacement = router
      .replace({ path: "/created", state: intent.state })
      .finally(intent.cancel);
    await flushPromises();
    owns = false;
    blocked.resolve(undefined);
    await replacement;
    route.fullPath = "/created";
    heads.emit("entries:updated");
    await commit("Actual new owner title");
    expect(alert().textContent).toBe("Actual new owner title");
  });
  it("does not let an old finalizer cancel a newer continuation", async () => {
    mountAnnouncer();
    const options = {
      from: router.currentRoute.value,
      target: "/created",
      owns: () => true,
    };
    const old = routeAnnouncements.preservePage(options);
    const current = routeAnnouncements.preservePage(options);
    old.cancel();
    await router.replace({ path: "/created", state: current.state });
    route.fullPath = "/created";
    heads.emit("entries:updated");
    await commit("Loading...");
    current.cancel();
    expect(alert().textContent).toBe("");
    // The state can remain in history; without the active intent it grants nothing.
    await navigate("/other");
    await commit("Other");
    await router.replace({ path: "/created", state: current.state });
    route.fullPath = "/created";
    heads.emit("entries:updated");
    await commit("Reopened created thread");
    expect(alert().textContent).toBe("Reopened created thread");
  });
  it("rejects a redirect chain returning to the intended path", async () => {
    mountAnnouncer();
    let redirected = false;
    earlyGuard = (to) => {
      if (to.fullPath === "/created" && !redirected) {
        redirected = true;
        return "/bounce";
      }
      if (to.fullPath === "/bounce") return "/created";
    };
    const intent = routeAnnouncements.preservePage({
      from: router.currentRoute.value,
      target: "/created",
      owns: () => true,
    });
    await router
      .replace({ path: "/created", state: intent.state })
      .finally(intent.cancel);
    route.fullPath = "/created";
    heads.emit("entries:updated");
    await commit("Redirected page");
    expect(alert().textContent).toBe("Redirected page");
  });
  it("requires the actual departing route object, not an equal path copy", async () => {
    mountAnnouncer();
    const intent = routeAnnouncements.preservePage({
      from: { ...router.currentRoute.value },
      target: "/created",
      owns: () => true,
    });
    await router
      .replace({ path: "/created", state: intent.state })
      .finally(intent.cancel);
    route.fullPath = "/created";
    heads.emit("entries:updated");
    await commit("Distinct departure");
    expect(alert().textContent).toBe("Distinct departure");
  });
  it("correlates real web history state without altering router-owned fields", async () => {
    const originalUrl = window.location.href;
    const originalState = window.history.state;
    const webHistory = createWebHistory();
    try {
      router = createRouter({
        history: webHistory,
        routes: [
          { path: "/:pathMatch(.*)*", component: { render: () => h("div") } },
        ],
      });
      await router.replace("/initial");
      router.beforeEach(() => {
        nuxt.emit("page:loading:start");
      });
      mountAnnouncer();
      const intent = routeAnnouncements.preservePage({
        from: router.currentRoute.value,
        target: "/created",
        owns: () => true,
      });
      const position = window.history.state.position;
      await router.replace({ path: "/created", state: intent.state });
      expect(window.history.state).toMatchObject({
        ...intent.state,
        current: "/created",
        position,
      });
      route.fullPath = "/created";
      heads.emit("entries:updated");
      await commit("Loading...");
      expect(alert().textContent).toBe("");
      intent.cancel();
      await navigate("/other");
      await commit("Ordinary other page");
      expect(alert().textContent).toBe("Ordinary other page");
      expect(window.history.state.position).toBe(position + 1);
    } finally {
      webHistory.destroy();
      window.history.replaceState(originalState, "", originalUrl);
    }
  });
  it("keeps the live region inside a shadow root so a modal can hide it", () => {
    mountAnnouncer();
    const host = document.getElementById("__route-announcer__")!;
    expect(host.getAttribute("aria-live")).toBeNull();
    expect(document.body.querySelectorAll("[aria-live]")).toHaveLength(0);
    expect(alert().getAttribute("role")).toBe("alert");
    expect(alert().getAttribute("aria-live")).toBe("assertive");
  });
  it("waits for head committed beyond nextTick, then keeps the first name", async () => {
    mountAnnouncer();
    await navigate("/target");
    await flushPromises();
    expect(alert().textContent).toBe("");
    await commit("Arriving");
    expect(alert().textContent).toBe("Arriving");
    await commit("Later data title");
    nuxt.emit("page:finish");
    nuxt.emit("page:loading:end");
    expect(alert().textContent).toBe("Arriving");
  });
  it("does not announce hydration or same-route data, and uses the actual leaving name", async () => {
    mountAnnouncer();
    await commit("Hydrated name");
    nuxt.emit("page:finish");
    await commit("Async initial name");
    expect(alert().textContent).toBe("");
    await navigate("/same-name");
    await commit("Async initial name");
    expect(alert().textContent).toBe("");
    await commit("Later data name");
    await navigate("/another");
    await commit("Later data name");
    expect(alert().textContent).toBe("");
    await navigate("/different");
    await commit("Different");
    expect(alert().textContent).toBe("Different");
  });
  it("accepts already committed head before page finish without duplicate writes", async () => {
    mountAnnouncer();
    await navigate("/target");
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    );
    observer.observe(alert(), { childList: true });
    await commit("Target");
    nuxt.emit("page:finish");
    nuxt.emit("page:loading:end");
    await commit("Target");
    expect(alert().textContent).toBe("Target");
    expect([...mutations, ...observer.takeRecords()]).toHaveLength(1);
    observer.disconnect();
  });
  it.each(["page:finish", "page:loading:end"])(
    "announces a no-head page after its DOM update even when %s also fires",
    async (event) => {
      mountAnnouncer();
      await router.push("/target");
      route.fullPath = "/target";
      document.title = "";
      document.body.insertAdjacentHTML(
        "beforeend",
        "<h1>  Heading name  </h1>",
      );
      nuxt.emit(event);
      await flushPromises();
      expect(alert().textContent).toBe("Heading name");
    },
  );
  it("falls back to pathname when title and heading are empty", async () => {
    mountAnnouncer();
    await navigate("/target");
    await commit("");
    expect(alert().textContent).toBe(location.pathname);
  });
  it("keeps a dirty head pending across page lifecycle completion", async () => {
    mountAnnouncer();
    await navigate("/target");
    nuxt.emit("page:finish");
    nuxt.emit("page:loading:end");
    await commit("Delayed");
    expect(alert().textContent).toBe("Delayed");
  });
  it("rejects aborted navigation and thrown guards", async () => {
    mountAnnouncer();
    router.beforeEach((to) => {
      if (to.path === "/blocked") return false;
      if (to.path === "/error") throw new Error("rejected");
    });
    router.onError(() => {});
    await router.push("/blocked");
    await commit("Unrelated data");
    expect(alert().textContent).toBe("");
    await expect(router.push("/error")).rejects.toThrow("rejected");
    await commit("More data");
    expect(alert().textContent).toBe("");
    await navigate("/target");
    await commit("Accepted");
    expect(alert().textContent).toBe("Accepted");
  });
  it("announces only the final redirect destination", async () => {
    mountAnnouncer();
    await navigate("/redirect");
    expect(router.currentRoute.value.path).toBe("/target");
    await commit("Redirect target");
    expect(alert().textContent).toBe("Redirect target");
  });
  it("retires an old head while the newer destination is not yet committed", async () => {
    mountAnnouncer();
    await navigate("/first");
    await router.push("/second");
    // Nuxt keeps useRoute on the previous page until the new page resolves.
    await commit("Retired page");
    expect(alert().textContent).toBe("");
    route.fullPath = "/second";
    await commit("Current page");
    expect(alert().textContent).toBe("Current page");
  });
  it("ignores a superseded guard failure after the latest navigation succeeds", async () => {
    mountAnnouncer();
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    router.beforeEach((to) => (to.path === "/slow" ? waiting : undefined));
    const slow = router.push("/slow");
    await flushPromises();
    await navigate("/latest");
    release();
    await slow;
    await commit("Latest page");
    expect(alert().textContent).toBe("Latest page");
  });
  it("retires a previous pending head when the newer navigation is rejected", async () => {
    mountAnnouncer();
    await navigate("/first");
    router.beforeEach((to) => (to.path === "/blocked" ? false : undefined));
    await router.push("/blocked");
    await commit("Retired first page");
    nuxt.emit("page:finish");
    expect(alert().textContent).toBe("");
  });
  it("ignores a superseded thrown guard while the current head is pending", async () => {
    mountAnnouncer();
    let reject!: (reason: Error) => void;
    const waiting = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    router.beforeEach((to) =>
      to.path === "/slow-error" ? waiting : undefined,
    );
    router.onError(() => {});
    const slow = router.push("/slow-error");
    const failed = expect(slow).rejects.toThrow("obsolete guard");
    await flushPromises();
    await navigate("/latest");
    reject(new Error("obsolete guard"));
    await failed;
    await commit("Latest after obsolete error");
    expect(alert().textContent).toBe("Latest after obsolete error");
  });
  it("preserves the committed announcement across a same-name navigation", async () => {
    mountAnnouncer();
    await navigate("/first");
    await commit("Same");
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    );
    observer.observe(alert(), { childList: true });
    await navigate("/second");
    await commit("Same");
    await commit("Later data");
    expect(alert().textContent).toBe("Same");
    expect([...mutations, ...observer.takeRecords()]).toHaveLength(0);
    observer.disconnect();
  });
  it("disposes lifecycle listeners and retires pending work on unmount", async () => {
    const wrapper = mountAnnouncer();
    await navigate("/target");
    const detachedAlert = alert();
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    await commit("Too late");
    nuxt.emit("page:finish");
    expect(detachedAlert.textContent).toBe("");
    expect(heads.size()).toBe(0);
    expect(nuxt.size()).toBe(0);
  });
});

describe("RouteAnnouncer early Nuxt middleware and committed DOM", () => {
  it.each(["abort", "throw", "return-error"])(
    "retires pending head before early %s middleware",
    async (mode) => {
      mountAnnouncer();
      await navigate("/first");
      earlyGuard = (to) => {
        if (to.path !== "/blocked") return;
        if (mode === "throw") throw new Error("early rejection");
        return mode === "abort" ? false : new Error("early rejection");
      };
      if (mode === "abort") await router.push("/blocked");
      else
        await expect(router.push("/blocked")).rejects.toThrow(
          "early rejection",
        );
      await commit("Retired first");
      nuxt.emit("page:finish");
      await flushPromises();
      expect(alert().textContent).toBe("");
    },
  );

  it("retires pending head while an early middleware is still awaiting", async () => {
    mountAnnouncer();
    await navigate("/first");
    const gate = deferred<false>();
    earlyGuard = (to) => (to.path === "/waiting" ? gate.promise : undefined);
    const waiting = router.push("/waiting");
    await flushPromises();
    try {
      await commit("Retired while waiting");
      expect(alert().textContent).toBe("");
    } finally {
      gate.resolve(false);
      await waiting;
    }
  });

  it.each(["continue", "abort", "error"])(
    "keeps the latest head when older early middleware ends with %s",
    async (mode) => {
      mountAnnouncer();
      const gate = deferred<false | Error | undefined>();
      earlyGuard = (to) => (to.path === "/old" ? gate.promise : undefined);
      const old = router.push("/old");
      const error =
        mode === "error"
          ? expect(old).rejects.toThrow("old failure")
          : undefined;
      await flushPromises();
      await navigate("/latest");
      gate.resolve(
        mode === "continue"
          ? undefined
          : mode === "abort"
            ? false
            : new Error("old failure"),
      );
      if (error) await error;
      else await old;
      await commit("Latest owned head");
      expect(alert().textContent).toBe("Latest owned head");
    },
  );

  it("does not let an unidentified failure end consume an unrendered displayed route", async () => {
    mountAnnouncer();
    await router.push("/latest");
    route.fullPath = "/latest";
    // Displayed-route publication queues Vue's page update. Failure loading:end
    // can be delivered without waiting for that update or its head registration.
    nuxt.emit("page:loading:end");
    expect(alert().textContent).toBe("");
    heads.emit("entries:updated");
    await flushPromises();
    await commit("First committed latest head");
    expect(alert().textContent).toBe("First committed latest head");
  });

  it("reads heading fallback after the Vue DOM patch when head renders in a pre watcher", async () => {
    document.title = "";
    const Page = defineComponent({
      setup() {
        watch(
          () => route.fullPath,
          () => {
            heads.emit("entries:updated");
            document.title = "";
            heads.emit("dom:rendered");
          },
        );
        return () =>
          h(
            "h1",
            route.fullPath === "/latest"
              ? "Arriving heading"
              : "Leaving heading",
          );
      },
    });
    const page = mount(Page, { attachTo: document.body });
    wrappers.push(page);
    mountAnnouncer();
    await router.push("/latest");
    route.fullPath = "/latest";
    await flushPromises();
    expect(document.querySelector("h1")?.textContent).toBe("Arriving heading");
    expect(alert().textContent).toBe("Arriving heading");
  });

  it("retires pending head after the real synchronous beforeRouteLeave refuses exit", async () => {
    // Distinct records make this an actual leave guard, not a beforeEach substitute.
    router.addRoute({
      path: "/leave-target",
      component: { render: () => null },
    });
    const view = mount(RouterView, {
      global: { plugins: [router] },
      attachTo: document.body,
    });
    wrappers.push(view);
    mountAnnouncer();
    await navigate("/first");
    leaveGuard = () => false;
    await router.push("/leave-target");
    expect(router.currentRoute.value.path).toBe("/first");
    await commit("Retired after leave refusal");
    expect(alert().textContent).toBe("");
  });

  it("keeps initial hydration silent if navigation started before the announcer mounted", async () => {
    const gate = deferred<undefined>();
    earlyGuard = () => gate.promise;
    const initial = router.push("/hydrating");
    await flushPromises();
    mountAnnouncer();
    gate.resolve(undefined);
    await initial;
    route.fullPath = "/hydrating";
    heads.emit("entries:updated");
    await commit("Hydrated initial");
    expect(alert().textContent).toBe("");
  });

  it("retires pending work on a duplicate navigation without a second start", async () => {
    mountAnnouncer();
    await navigate("/first");
    await router.push("/first");
    await commit("Retired after duplicate");
    expect(alert().textContent).toBe("");
  });
});

describe("RouteAnnouncer real commit boundaries", () => {
  it("reads a reused page heading after its reactive DOM update without any head or page completion hook", async () => {
    document.title = "";
    const Page = defineComponent({
      setup() {
        return () =>
          h(
            "h1",
            route.fullPath === "/reused"
              ? "Reused arriving heading"
              : "Initial heading",
          );
      },
    });
    wrappers.push(mount(Page, { attachTo: document.body }));
    mountAnnouncer();
    await router.push("/reused");
    route.fullPath = "/reused";
    expect(alert().textContent).toBe("");
    await flushPromises();
    expect(document.querySelector("h1")?.textContent).toBe(
      "Reused arriving heading",
    );
    expect(alert().textContent).toBe("Reused arriving heading");
    await commit("Later data title");
    expect(alert().textContent).toBe("Reused arriving heading");
  });

  it("waits for the actual Nuxt-owned Unhead renderer, then ignores later data patches", async () => {
    // Resolve through Nuxt's owning package, rather than adding a second head
    // dependency or importing an arbitrary global/copy of its implementation.
    const require = createRequire(import.meta.url);
    const entrypoint = require.resolve("@unhead/vue/client", {
      paths: [require.resolve("nuxt/package.json")],
    });
    const { createHead } = await import(pathToFileURL(entrypoint).href);
    const actualHead: ReturnType<typeof injectHead> = createHead({ document });
    vi.stubGlobal("injectHead", () => actualHead);
    const events: string[] = [];
    let paused = false;
    const dispose = [
      actualHead.hooks!.hook("entries:updated", () => {
        events.push("entries");
      }),
      actualHead.hooks!.hook("dom:rendered", () => {
        events.push("rendered");
      }),
      actualHead.hooks!.hook("dom:beforeRender", (context) => {
        context.shouldRender = !paused;
      }),
    ];
    const entry = actualHead.push({ title: "Actual initial" });
    try {
      await vi.waitFor(() => expect(document.title).toBe("Actual initial"));
      events.length = 0;
      mountAnnouncer();
      await router.push("/actual-head");
      route.fullPath = "/actual-head";
      // This is Nuxt's own public pause/resume boundary, with the installed
      // renderer doing the actual work. No private dirty state or fake timers.
      paused = true;
      entry.patch({ title: "Actual arriving" });
      await flushPromises();
      await flushPromises();
      expect(document.title).toBe("Actual initial");
      expect(alert().textContent).toBe("");
      expect(events).toContain("entries");
      expect(events).not.toContain("rendered");
      paused = false;
      actualHead.render();
      await vi.waitFor(() =>
        expect(alert().textContent).toBe("Actual arriving"),
      );
      expect(document.title).toBe("Actual arriving");
      expect(events.indexOf("entries")).toBeLessThan(
        events.indexOf("rendered"),
      );
      entry.patch({ title: "Actual later data" });
      await vi.waitFor(() => expect(document.title).toBe("Actual later data"));
      await flushPromises();
      expect(alert().textContent).toBe("Actual arriving");
    } finally {
      for (const stop of dispose) stop();
      entry.dispose();
    }
  });
});
