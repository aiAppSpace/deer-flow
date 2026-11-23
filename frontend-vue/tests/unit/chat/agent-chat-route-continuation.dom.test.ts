import { flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";
import {
  agentChatAccount,
  agentChatCallbacks,
  mountAgentChatHarness,
} from "./helpers/agent-chat-harness";

async function host(
  options: {
    bootstrap?: boolean;
    agentName?: string;
    holdDisplayedRoute?: boolean;
  } = {},
) {
  const base = options.agentName
    ? `/workspace/agents/${options.agentName}/chats`
    : "/workspace/chats";
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: `${base}/:thread_id`,
        component: defineComponent({ render: () => h("div") }),
      },
    ],
  });
  await router.push(`${base}/new`);
  const app = useNuxtApp();
  const state = mountAgentChatHarness(options, {
    threadId: "new",
    router,
    displayedRoute: options.holdDisplayedRoute
      ? router.currentRoute.value
      : undefined,
  });
  const dispositions: boolean[] = [];
  router.afterEach((to, from, failure) => {
    if (!failure)
      dispositions.push(
        app.$routeAnnouncements.consume(to, from, router.options.history.state),
      );
  });
  const ensureThread = () =>
    (state.composer().props("ensureThread") as () => Promise<string>)();
  return { ...state, router, ensureThread, dispositions, base };
}

describe("AgentChat accepted-run route continuation", () => {
  it.each([undefined, "writer"])(
    "marks only its actual prepared first run as a page continuation (%s)",
    async (agentName) => {
      const state = await host({ agentName });
      const id = await state.ensureThread();
      agentChatCallbacks.onStart?.(id, "run-1");
      await flushPromises();
      expect(state.router.currentRoute.value.fullPath).toBe(
        `${state.base}/${id}`,
      );
      expect(state.dispositions).toEqual([true]);
      await state.router.push(`${state.base}/other-thread`);
      expect(state.dispositions).toEqual([true, false]);
    },
  );
  it.each([undefined, "writer"])(
    "cannot let a leaving page's accepted run take back the route (%s)",
    async (agentName) => {
      // Nuxt's displayed route can remain on the old page during Suspense,
      // while the public router has already committed the destination.
      const state = await host({ agentName, holdDisplayedRoute: true });
      const id = await state.ensureThread();
      await state.router.push(`${state.base}/other-thread`);
      agentChatCallbacks.onStart?.(id, "late-run");
      await flushPromises();
      expect(state.router.currentRoute.value.fullPath).toBe(
        `${state.base}/other-thread`,
      );
      expect(state.dispositions).toEqual([false]);
    },
  );
  it("does not replace a newer query navigation while the old page is displayed", async () => {
    const state = await host({ holdDisplayedRoute: true });
    const id = await state.ensureThread();
    await state.router.push(`${state.base}/new?project=other-project`);
    agentChatCallbacks.onStart?.(id, "late-run");
    await flushPromises();
    expect(state.router.currentRoute.value.fullPath).toBe(
      `${state.base}/new?project=other-project`,
    );
    expect(state.dispositions).toEqual([false]);
  });
  it("keeps attachment-driven prepared-thread navigation ordinary", async () => {
    const state = await host();
    const id = await state.ensureThread();
    state.composer().vm.$emit("reference-file-attached");
    await flushPromises();
    expect(state.router.currentRoute.value.fullPath).toBe(
      `${state.base}/${id}`,
    );
    expect(state.dispositions).toEqual([false]);
  });
  it("does not mark an unprepared or different thread as the same page", async () => {
    const state = await host();
    await state.ensureThread();
    agentChatCallbacks.onStart?.("different-thread", "run-1");
    await flushPromises();
    expect(state.dispositions).toEqual([false]);
  });
  it("does not transfer continuation ownership across an account change", async () => {
    const state = await host();
    const id = await state.ensureThread();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.router.beforeEach(() => blocked);
    agentChatCallbacks.onStart?.(id, "run-1");
    await flushPromises();
    agentChatAccount.value = { tag: "authenticated", user: { id: "bob" } };
    release();
    await flushPromises();
    expect(state.dispositions).toEqual([false]);
  });
  it("does not navigate the bootstrap conversation on run acceptance", async () => {
    const state = await host({ bootstrap: true });
    agentChatCallbacks.onStart?.("bootstrap-thread", "run-1");
    await flushPromises();
    expect(state.router.currentRoute.value.fullPath).toBe(`${state.base}/new`);
    expect(state.dispositions).toEqual([]);
  });
});
