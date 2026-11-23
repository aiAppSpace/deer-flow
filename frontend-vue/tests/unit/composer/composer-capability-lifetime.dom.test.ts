import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UserPreferencesBoundary from "@/core/settings/UserPreferencesBoundary.vue";
import { stopUserPreferences } from "@/core/settings/user-preferences";
import { referenceToken } from "@/core/mentions/inline-references";
import ChatComposer from "@/components/chat/ChatComposer.vue";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";
import { FEATURES_QUERY_KEYS } from "@/core/features/query-keys";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn<typeof globalThis.fetch>(),
  polish: vi.fn(),
  compact: vi.fn(),
}));
vi.mock("@/core/skills/api", () => ({ loadSkills: vi.fn(async () => []) }));
vi.mock("@/core/models/api", () => ({
  loadModels: vi.fn(async () => ({
    models: [{ name: "model", model: "provider", display_name: "Model" }],
  })),
}));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: vi.fn(async () => ({
    max_files: 10,
    max_file_size: 10000,
    max_total_size: 20000,
  })),
  uploadFiles: vi.fn(),
}));
vi.mock("@/core/input-polish/api", () => ({ polishInputDraft: mocks.polish }));
vi.mock("@/core/threads/api", async (original) => ({
  ...(await original<typeof import("@/core/threads/api")>()),
  compactThreadContext: mocks.compact,
}));
vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({
    session: ref({ tag: "anonymous" }),
    isFetching: ref(false),
  }),
}));
vi.mock("@/composables/useFrontendExtensions", () => ({
  useExtensionMentions: () => ({
    items: ref([]),
    loading: ref(false),
    failed: ref(false),
    retry: vi.fn(),
  }),
}));
vi.mock("@/composables/useThreads", () => ({
  useThreads: () => ({
    threads: [
      {
        thread_id: "source",
        values: { title: "Source conversation" },
        metadata: {},
      },
    ],
    loading: false,
    error: null,
    hasMore: false,
    loadingMore: false,
    loadInitial: vi.fn(),
    loadMore: vi.fn(),
  }),
}));

const accountSession = ref({
  tag: "authenticated",
  user: { id: "first-account" },
});
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: () => ({
    session: accountSession,
    authDisabled: false,
    refreshSession: vi.fn(),
  }),
}));

const wrappers: VueWrapper[] = [];
const clients: QueryClient[] = [];
const key = FEATURES_QUERY_KEYS.conversationReferences;
function features(enabled = true, max = 3) {
  return new Response(
    JSON.stringify({
      agents_api: { enabled: true },
      conversation_references: { enabled, max_references: max },
    }),
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function mountComposer(
  props: Record<string, unknown> = {},
  queryClient?: QueryClient,
) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
          refetchOnWindowFocus: false,
        },
      },
    });
  if (!clients.includes(client)) clients.push(client);
  const submit = vi.fn(async (_text, _files, options) => {
    options.onAccepted();
    return true;
  });
  const wrapper = mount(ChatComposer, {
    attachTo: document.body,
    props: {
      threadKey: "thread",
      targetThreadId: "thread",
      userId: "u1",
      streaming: false,
      uploading: false,
      promptHistory: [],
      modelSelectionReady: true,
      context: { mode: "flash", model_name: "model" },
      submitMessage: submit,
      ...props,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, client, submit };
}
function assertLocked(wrapper: VueWrapper) {
  const textarea = wrapper.find('textarea[name="message"]');
  if (textarea.exists()) expect(textarea.attributes("readonly")).toBeDefined();
  else {
    const editor = wrapper.get('[role="textbox"][contenteditable]');
    expect(editor.attributes("contenteditable")).toBe("false");
    expect(editor.attributes("aria-disabled")).toBe("true");
  }
  expect(
    wrapper.get('[data-testid="mention-button"]').attributes("disabled"),
  ).toBeDefined();
  expect(
    wrapper.get('button[type="submit"]').attributes("disabled"),
  ).toBeDefined();
}
async function addReference(wrapper: VueWrapper) {
  await wrapper.get('[data-testid="mention-button"]').trigger("click");
  await flushPromises();
  const source = wrapper
    .findAll('[role="option"]')
    .find((option) => option.text().includes("Source conversation"));
  expect(source).toBeDefined();
  await source!.trigger("click");
  await flushPromises();
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  accountSession.value = {
    tag: "authenticated",
    user: { id: "first-account" },
  };
  mocks.fetch.mockReset().mockImplementation(async (input) => {
    if (String(input) !== "/api/features")
      throw new Error(`Unexpected transport: ${String(input)}`);
    return features();
  });
  mocks.polish.mockReset();
  mocks.compact.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(async () => {
  stopUserPreferences();
  for (const wrapper of wrappers.splice(0))
    if (wrapper.exists()) wrapper.unmount();
  for (const client of clients.splice(0)) client.clear();
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("composer capability query follows its mounted owner, independently of editing", () => {
  it("loads the real capability endpoint for an initially read-only composer while blocking edits and sends", async () => {
    const { wrapper, client, submit } = mountComposer({ disabled: true });
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/features",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        credentials: "include",
      }),
    );
    expect(client.getQueryData(key)).toEqual({
      enabled: true,
      maxReferences: 3,
    });
    assertLocked(wrapper);
    await wrapper.get('[data-testid="mention-button"]').trigger("click");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not refetch merely because a mounted composer locks and unlocks", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await wrapper.setProps({ disabled: true });
    assertLocked(wrapper);
    await wrapper.setProps({ disabled: false });
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps discovery active and reconciles authoritative disable while editing is locked", async () => {
    const { wrapper, client, submit } = mountComposer();
    await flushPromises();
    await addReference(wrapper);
    await wrapper.setProps({ disabled: true });
    mocks.fetch.mockResolvedValueOnce(features(false, 0));
    await client.invalidateQueries({ queryKey: key });
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(key)).toEqual({
      enabled: false,
      maxReferences: 0,
    });
    expect(
      wrapper.find('[data-testid="conversation-reference-chip"]').exists(),
    ).toBe(false);
    assertLocked(wrapper);
    await wrapper.get("form").trigger("submit");
    expect(submit).not.toHaveBeenCalled();
  });

  it.each(["polishing", "compacting"])(
    "keeps reference discovery active during %s and retains the operation lock",
    async (operation) => {
      const gate = deferred<Record<string, unknown>>();
      const { wrapper, client } = mountComposer();
      await flushPromises();
      if (operation === "polishing") {
        mocks.polish.mockReturnValueOnce(gate.promise);
        await wrapper
          .get('textarea[name="message"]')
          .setValue("Improve this draft");
        await wrapper
          .get('[data-testid="polish-input-button"]')
          .trigger("click");
      } else {
        mocks.compact.mockReturnValueOnce(gate.promise);
        await wrapper.get('textarea[name="message"]').setValue("/compact");
        await wrapper.get("form").trigger("submit");
      }
      await flushPromises();
      try {
        assertLocked(wrapper);
        mocks.fetch.mockResolvedValueOnce(features(true, 2));
        await client.invalidateQueries({ queryKey: key });
        await flushPromises();
        expect(client.getQueryData(key)).toEqual({
          enabled: true,
          maxReferences: 2,
        });
        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        assertLocked(wrapper);
      } finally {
        gate.resolve(
          operation === "polishing"
            ? { rewritten_text: "Better draft", changed: true }
            : { compacted: true },
        );
        await flushPromises();
      }
      expect(
        wrapper.get('textarea[name="message"]').attributes("readonly"),
      ).toBeUndefined();
      expect(mocks.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("preserves references on refresh failure while locked, and only an explicit successful retry authorizes the normal payload", async () => {
    const { wrapper, client, submit } = mountComposer();
    await flushPromises();
    await addReference(wrapper);
    await wrapper.setProps({ disabled: true });
    mocks.fetch.mockRejectedValueOnce(
      new Error("capability refresh unavailable"),
    );
    await client.invalidateQueries({ queryKey: key });
    await flushPromises();
    expect(client.getQueryState(key)?.status).toBe("error");
    expect(
      wrapper.get('[data-testid="conversation-reference-chip"]').text(),
    ).toContain("Source conversation");
    assertLocked(wrapper);
    await wrapper.setProps({ disabled: false });
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    await wrapper.get("form").trigger("submit");
    expect(submit).not.toHaveBeenCalled();
    await wrapper
      .get('[data-testid="retry-conversation-capability"]')
      .trigger("click");
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![2].conversationReferences).toEqual(["source"]);
    expect(
      submit.mock.calls[0]![2].additionalKwargs.conversation_references,
    ).toHaveLength(1);
  });

  it("does not abort an in-flight query merely because editing becomes disabled", async () => {
    const gate = deferred<Response>();
    mocks.fetch.mockReturnValueOnce(gate.promise);
    const { wrapper, client } = mountComposer();
    const signal = mocks.fetch.mock.calls[0]![1]!.signal!;
    await wrapper.setProps({ disabled: true });
    expect(signal.aborted).toBe(false);
    gate.resolve(features(true, 2));
    await flushPromises();
    expect(client.getQueryData(key)).toEqual({
      enabled: true,
      maxReferences: 2,
    });
    assertLocked(wrapper);
    await wrapper.setProps({ disabled: false });
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts an initially disabled owner's query on unmount and discards a late response", async () => {
    const gate = deferred<Response>();
    mocks.fetch.mockReturnValueOnce(gate.promise);
    const { wrapper, client } = mountComposer({ disabled: true });
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const signal = mocks.fetch.mock.calls[0]![1]!.signal!;
    wrapper.unmount();
    await flushPromises();
    expect(signal.aborted).toBe(true);
    gate.resolve(features());
    await flushPromises();
    expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryState(key)?.fetchStatus).toBe("idle");
  });

  it("retires a disabled old account before new discovery so its late response cannot restore grants", async () => {
    const gate = deferred<Response>();
    mocks.fetch.mockReturnValueOnce(gate.promise);
    const first = mountComposer({ disabled: true, userId: "old-user" });
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const signal = mocks.fetch.mock.calls[0]![1]!.signal!;
    first.wrapper.unmount();
    await resetWorkspaceQueries(first.client);
    mocks.fetch.mockResolvedValueOnce(features(false, 0));
    const next = mountComposer(
      { disabled: true, userId: "new-user" },
      first.client,
    );
    await flushPromises();
    gate.resolve(features(true, 8));
    await flushPromises();
    expect(signal.aborted).toBe(true);
    expect(next.client.getQueryData(key)).toEqual({
      enabled: false,
      maxReferences: 0,
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    assertLocked(next.wrapper);
  });
});

describe("composer capability retirement and concurrent owners", () => {
  it.each(["resolve", "reject"])(
    "uses the real account boundary to isolate an ignored-abort late %s",
    async (settlement) => {
      const old = deferred<Response>(),
        next = deferred<Response>();
      const requests: { account: string; signal: AbortSignal }[] = [];
      mocks.fetch.mockImplementation((input, init) => {
        if (String(input) === "/api/v1/auth/preferences")
          return Promise.resolve(new Response("{}"));
        if (String(input) !== "/api/features")
          throw new Error(`Unexpected transport: ${String(input)}`);
        const account = accountSession.value.user.id;
        requests.push({ account, signal: init!.signal! });
        return account === "first-account" ? old.promise : next.promise;
      });
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      clients.push(client);
      const boundary = mount(UserPreferencesBoundary, {
        attachTo: document.body,
        slots: {
          default: () =>
            h(ChatComposer, {
              threadKey: "new",
              targetThreadId: "new-draft",
              userId: accountSession.value.user.id,
              disabled: true,
              streaming: false,
              uploading: false,
              promptHistory: [],
              modelSelectionReady: true,
              context: { mode: "flash", model_name: "model" },
            }),
        },
        global: {
          plugins: [[VueQueryPlugin, { queryClient: client }]],
          provide: {
            [workspaceToastKey as symbol]: createWorkspaceToastStore(),
          },
        },
      });
      wrappers.push(boundary);
      await flushPromises();
      expect(requests.map((r) => r.account)).toEqual(["first-account"]);
      accountSession.value = {
        tag: "authenticated",
        user: { id: "next-account" },
      };
      await flushPromises();
      expect(requests.map((r) => r.account)).toEqual([
        "first-account",
        "next-account",
      ]);
      expect(requests[0]!.signal.aborted).toBe(true);
      if (settlement === "resolve") old.resolve(features(true, 8));
      else old.reject(new Error("late previous account failure"));
      await flushPromises();
      expect(client.getQueryData(key)).toBeUndefined();
      expect(client.getQueryState(key)?.status).toBe("pending");
      next.resolve(features(false, 0));
      await flushPromises();
      expect(client.getQueryData(key)).toEqual({
        enabled: false,
        maxReferences: 0,
      });
      expect(client.getQueryState(key)?.error).toBeNull();
      assertLocked(boundary);
    },
  );

  it.each(["resolve", "reject"])(
    "keeps a shared query until its final owner leaves and ignores a late %s on remount",
    async (settlement) => {
      const old = deferred<Response>();
      mocks.fetch.mockReturnValueOnce(old.promise);
      const first = mountComposer({ disabled: true });
      const second = mountComposer({ disabled: true }, first.client);
      await flushPromises();
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      const signal = mocks.fetch.mock.calls[0]![1]!.signal!;
      first.wrapper.unmount();
      await flushPromises();
      expect(signal.aborted).toBe(false);
      second.wrapper.unmount();
      await flushPromises();
      expect(signal.aborted).toBe(true);
      mocks.fetch.mockResolvedValueOnce(features(false, 0));
      const third = mountComposer({ disabled: true }, first.client);
      await flushPromises();
      if (settlement === "resolve") old.resolve(features(true, 8));
      else old.reject(new Error("retired discovery"));
      await flushPromises();
      expect(mocks.fetch).toHaveBeenCalledTimes(2);
      expect(third.client.getQueryData(key)).toEqual({
        enabled: false,
        maxReferences: 0,
      });
      expect(third.client.getQueryState(key)?.error).toBeNull();
      assertLocked(third.wrapper);
    },
  );

  it("keeps the mounted capability active after the picker closes", async () => {
    const { wrapper, client } = mountComposer();
    await flushPromises();
    await wrapper.get('[data-testid="mention-button"]').trigger("click");
    await flushPromises();
    await wrapper.get('button[aria-label="Close references"]').trigger("click");
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(false);
    mocks.fetch.mockResolvedValueOnce(features(true, 1));
    await client.invalidateQueries({ queryKey: key });
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(key)).toEqual({
      enabled: true,
      maxReferences: 1,
    });
  });

  it("does not let a late polish revive a reference retired by capability reconciliation", async () => {
    const { wrapper, client, submit } = mountComposer();
    await flushPromises();
    await addReference(wrapper);
    (
      wrapper.vm as unknown as { replaceDraft(text: string): void }
    ).replaceDraft(
      `Summarize ${referenceToken("conversation", "source", "Source conversation")}`,
    );
    await flushPromises();
    const polish = deferred<Record<string, unknown>>();
    mocks.polish.mockReturnValueOnce(polish.promise);
    await wrapper.get('[data-testid="polish-input-button"]').trigger("click");
    await flushPromises();
    expect(mocks.polish).toHaveBeenCalledTimes(1);
    assertLocked(wrapper);
    mocks.fetch.mockResolvedValueOnce(features(false, 0));
    await client.invalidateQueries({ queryKey: key });
    await flushPromises();
    expect(
      wrapper.find('[data-testid="conversation-reference-chip"]').exists(),
    ).toBe(false);
    polish.resolve({ rewritten_text: "Stale rewrite", changed: true });
    await flushPromises();
    expect(wrapper.get('[role="textbox"][contenteditable]').text()).toContain(
      "Source conversation",
    );
    expect(
      wrapper.get('[role="textbox"][contenteditable]').text(),
    ).not.toContain("Stale rewrite");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![2].conversationReferences).toEqual([]);
  });
});
