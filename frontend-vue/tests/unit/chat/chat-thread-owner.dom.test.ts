import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatThreadOwner } from "@/composables/useChatThreadOwner";
import { resetAPIClients } from "@/core/api/api-client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const wrappers: ReturnType<typeof mount>[] = [];
type ThreadRow = { thread_id: string; metadata: Record<string, unknown> };
let rows: Map<string, ThreadRow>;
let available: Set<string>;
let gate: ReturnType<typeof deferred<undefined>> | null;
let responseMetadata: Record<string, unknown> | null;
let requests: { path: string; body: Record<string, unknown> }[];
beforeEach(() => {
  resetAPIClients();
  rows = new Map();
  available = new Set(["project-a", "project-b"]);
  requests = [];
  gate = null;
  responseMetadata = null;
  // HTTP boundary only: real owner, API client, native helper and auth fetcher.
  // Gateway returns existing IDs before project admission; repeated create
  // neither assigns a project nor replaces metadata.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      requests.push({
        path: new URL(input, "http://localhost").pathname,
        body,
      });
      if (gate) await gate.promise;
      const id = String(body.thread_id);
      const existing = rows.get(id);
      if (existing) return Response.json(existing);
      if (body.project_id && !available.has(String(body.project_id)))
        return Response.json({ detail: "Project not found" }, { status: 404 });
      const metadata: Record<string, unknown> = Object.fromEntries(
        Object.entries((body.metadata as Record<string, unknown>) ?? {}).filter(
          ([key]) =>
            ![
              "owner_id",
              "user_id",
              "deerflow_project_id",
              "deerflow_origin",
            ].includes(key),
        ),
      );
      if (body.project_id) metadata.deerflow_project_id = body.project_id;
      const created = { thread_id: id, metadata: responseMetadata ?? metadata };
      rows.set(id, created);
      return Response.json(created);
    }),
  );
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});
function host() {
  const threadId = ref<string | null>(null);
  const projectId = ref<string | null>("project-a");
  const userId = ref<string | null>("alice");
  const agentName = ref<string | null>(null);
  const created = vi.fn();
  const unavailable = vi.fn();
  let owner!: ReturnType<typeof useChatThreadOwner>;
  wrappers.push(
    mount(
      defineComponent({
        setup() {
          owner = useChatThreadOwner({
            threadId,
            projectId,
            userId,
            agentName,
            onCreated: created,
            onProjectUnavailable: unavailable,
          });
          return () => h("div");
        },
      }),
    ),
  );
  return {
    owner,
    threadId,
    projectId,
    userId,
    agentName,
    created,
    unavailable,
  };
}
describe("authoritative thread birth and submission ownership", () => {
  it("deduplicates one project-bearing initial HTTP request and publishes its response", async () => {
    gate = deferred<undefined>();
    const state = host();
    state.agentName.value = "research";
    const first = state.owner.ensureThread();
    const second = state.owner.ensureThread();
    const id = state.owner.draftThreadId.value;
    expect(requests).toEqual([
      {
        path: "/api/threads",
        body: {
          thread_id: id,
          project_id: "project-a",
          metadata: { agent_name: "research" },
        },
      },
    ]);
    expect(state.created).not.toHaveBeenCalled();
    gate.resolve(undefined);
    await expect(Promise.all([first, second])).resolves.toEqual([id, id]);
    expect(rows.get(id)?.metadata).toEqual({
      agent_name: "research",
      deerflow_project_id: "project-a",
    });
    expect(state.created).toHaveBeenCalledExactlyOnceWith(rows.get(id));
    await state.owner.ensureThread();
    expect(requests).toHaveLength(1);
  });
  it.each(["archived", "foreign", "missing"])(
    "rejects %s projects without rows or subsequent work; the same draft retries",
    async (kind) => {
      const state = host();
      state.projectId.value = kind;
      const id = state.owner.draftThreadId.value;
      const next = vi.fn();
      await expect(state.owner.ensureThread().then(next)).rejects.toThrow(
        "Project not found",
      );
      expect(rows.size).toBe(0);
      expect(next).not.toHaveBeenCalled();
      expect(state.created).not.toHaveBeenCalled();
      expect(state.unavailable).toHaveBeenCalledTimes(1);
      expect(state.owner.preparedThreadId.value).toBeNull();
      available.add(kind);
      await state.owner.ensureThread().then(next);
      expect(requests.map(({ body }) => body.thread_id)).toEqual([id, id]);
      expect(rows.get(id)?.metadata.deerflow_project_id).toBe(kind);
      expect(next).toHaveBeenCalledExactlyOnceWith(id);
    },
  );
  it.each([{}, { deerflow_project_id: "project-b" }])(
    "rejects successful disagreeing membership %j instead of fabricating it",
    async (metadata) => {
      const state = host();
      responseMetadata = metadata;
      const next = vi.fn();
      await expect(state.owner.ensureThread().then(next)).rejects.toThrow();
      expect(state.created).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(state.unavailable).toHaveBeenCalledTimes(1);
      expect(state.owner.preparedThreadId.value).toBeNull();
    },
  );
  it("does not turn an existing unassigned ID into a hidden project move", async () => {
    const state = host();
    const id = state.owner.draftThreadId.value;
    rows.set(id, { thread_id: id, metadata: { agent_name: "original" } });
    await expect(state.owner.ensureThread()).rejects.toThrow();
    expect(rows.get(id)?.metadata).toEqual({ agent_name: "original" });
    expect(requests).toHaveLength(1);
    expect(state.created).not.toHaveBeenCalled();
  });
  it.each(["project", "account", "conversation", "agent"])(
    "fences an abandoned %s continuation",
    async (change) => {
      gate = deferred<undefined>();
      const state = host();
      const captured = state.owner.capture();
      const result = state.owner.ensureThread(captured);
      const rejected = expect(result).rejects.toMatchObject({
        name: "AbortError",
      });
      if (change === "project") state.projectId.value = "project-b";
      if (change === "account") state.userId.value = "bob";
      if (change === "conversation") state.threadId.value = "other-thread";
      if (change === "agent") state.agentName.value = "research";
      gate.resolve(undefined);
      await rejected;
      expect(state.created).not.toHaveBeenCalled();
      expect(state.unavailable).not.toHaveBeenCalled();
      expect(state.owner.owns(captured)).toBe(false);
    },
  );
  it("preserves owner and authoritative metadata on exact durable-route adoption", async () => {
    const state = host();
    const captured = state.owner.capture();
    await state.owner.ensureThread(captured);
    state.threadId.value = captured.threadId;
    state.projectId.value = null;
    expect(state.owner.owns(captured)).toBe(true);
    expect(await state.owner.ensureThread()).toBe(captured.threadId);
    expect(requests).toHaveLength(1);
    expect(state.created.mock.calls[0]![0].metadata).toEqual({
      deerflow_project_id: "project-a",
    });
  });
  it.each([null, "research"])(
    "keeps unscoped creation and agent metadata (%s) on the existing client path",
    async (agent) => {
      const state = host();
      state.projectId.value = null;
      state.agentName.value = agent;
      const id = await state.owner.ensureThread();
      expect(requests).toEqual([
        {
          path: "/api/langgraph/threads",
          body: {
            thread_id: id,
            metadata: agent ? { agent_name: agent } : {},
          },
        },
      ]);
      expect(state.created).toHaveBeenCalledExactlyOnceWith(rows.get(id));
      expect(state.unavailable).not.toHaveBeenCalled();
    },
  );
  it.each(["resolve", "reject"])(
    "retires unmounted creation and its late %s without notifications",
    async (completion) => {
      gate = deferred<undefined>();
      const state = host();
      const result = state.owner.ensureThread();
      const rejected = expect(result).rejects.toThrow();
      await flushPromises();
      wrappers.pop()!.unmount();
      if (completion === "resolve") gate.resolve(undefined);
      else gate.reject(new Error("gone"));
      await rejected;
      expect(state.created).not.toHaveBeenCalled();
      expect(state.unavailable).not.toHaveBeenCalled();
    },
  );
});
