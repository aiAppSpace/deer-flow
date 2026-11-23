import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatThreadOwner } from "@/composables/useChatThreadOwner";
import { useUploadLimits } from "@/composables/useUploads";
import {
  PARITY_OBSERVATION_CAPABILITY as CAP,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";
let packets: ObservationPacket[];
let calls: { url: string; selectedAtFetch: number; consumersAtFetch: number }[];
let client: QueryClient;
let owner: ReturnType<typeof useChatThreadOwner>;
let wrapper: ReturnType<typeof mount> | undefined;
let project = ref("alpha");
let fail = false;
const receive = (event: Event) =>
  packets.push((event as CustomEvent<ObservationPacket>).detail);
function host() {
  const Child = defineComponent({
    setup() {
      useUploadLimits(() => owner.capture().threadId, {
        observation: () => owner.consumptionObservation.value,
      });
      return () => h("span");
    },
  });
  wrapper = mount(
    defineComponent({
      setup() {
        owner = useChatThreadOwner({
          threadId: null,
          projectId: project,
          userId: "alice",
          agentName: null,
          observation: {
            surface: "main",
            path: "/workspace/chats/new",
            mock: false,
          },
          onCreated: () => {},
          onProjectUnavailable: () => {},
        });
        return () => h("div", [h(Child), h(Child)]);
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  return wrapper;
}
beforeEach(() => {
  packets = [];
  calls = [];
  fail = false;
  project = ref("alpha");
  client = new QueryClient();
  Object.defineProperty(window, CAP, {
    configurable: true,
    value: { version: 1, token: "mounted", action: "entry" },
  });
  window.addEventListener(EVENT, receive);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      calls.push({
        url: String(input),
        selectedAtFetch: packets.filter((p) => p.event === "lease.select")
          .length,
        consumersAtFetch: packets.filter((p) => p.event === "uploads.limits")
          .length,
      });
      return Response.json(
        fail ? { detail: "original failure" } : { max_file_size_bytes: 1024 },
        { status: fail ? 503 : 200 },
      );
    }),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  client.clear();
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAP);
  vi.unstubAllGlobals();
});

it("real Vue Query's setup request precedes parent selection and later uses that exact lease", async () => {
  const view = host();
  await flushPromises();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ selectedAtFetch: 0, consumersAtFetch: 1 });
  const consumers = packets.filter((p) => p.event === "uploads.limits");
  expect(consumers).toHaveLength(1);
  const consumer = consumers[0]!;
  expect(consumer.values.state).toBe("candidate");
  const selected = packets.find(
    (p) =>
      p.event === "lease.select" && p.values.lease === consumer.values.lease,
  )!;
  expect(selected.values.raw).toBe(owner.capture().threadId);
  expect(selected.values.allocation).toBe(0);
  expect(consumer.at).toBeLessThanOrEqual(selected.at);
  expect(calls[0]!.url).toContain(
    `/api/threads/${consumer.values.raw}/uploads/limits`,
  );
  const handle = owner.consumptionObservation.value!;
  view.unmount();
  wrapper = undefined;
  handle.uploadsLimits("late-old");
  expect(packets.at(-1)?.values).toMatchObject({
    raw: "late-old",
    state: "retired",
  });
});

it("synchronous project reset records allocation before a reactive consumer can run", async () => {
  host();
  await flushPromises();
  const prior = owner.capture().threadId;
  project.value = "beta";
  await flushPromises();
  expect(calls).toHaveLength(2);
  expect(owner.capture().threadId).not.toBe(prior);
  const consumer = packets.filter((p) => p.event === "uploads.limits").at(-1)!;
  const lease = packets.find(
    (p) =>
      p.event === "lease.select" && p.values.lease === consumer.values.lease,
  )!;
  expect(consumer.values.raw).toBe(owner.capture().threadId);
  expect(lease.values.allocation).toBe(1);
  expect(lease.values.projectIntent).toBe("beta");
  expect(
    client
      .getQueryCache()
      .getAll()
      .every((q) => q.options.retry === false),
  ).toBe(true);
});

it("the unchanged failed query remains an error with one actual consumer receipt", async () => {
  fail = true;
  host();
  await flushPromises();
  expect(calls).toHaveLength(1);
  expect(packets.filter((p) => p.event === "uploads.limits")).toHaveLength(1);
  expect(
    client.getQueryState(["uploads", "limits", owner.capture().threadId])
      ?.status,
  ).toBe("error");
  expect(
    String(
      client.getQueryState(["uploads", "limits", owner.capture().threadId])
        ?.error,
    ),
  ).toContain("original failure");
});

it.each([false, true])(
  "an unowned or throwing observation getter preserves the actual Vue query: throws=%s",
  async (throws) => {
    wrapper = mount(
      defineComponent({
        setup() {
          useUploadLimits("literal-saved", {
            observation: () => {
              if (throws) throw new Error("observer getter failed");
              return null;
            },
          });
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
    );
    await flushPromises();
    expect(
      client.getQueryState(["uploads", "limits", "literal-saved"])?.status,
    ).toBe("success");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(
      "/api/threads/literal-saved/uploads/limits",
    );
    expect(packets).toHaveLength(1);
    expect(packets[0]?.event).toBe(throws ? "invalid" : "uploads.unowned");
    expect(packets[0]?.values).toEqual(
      throws
        ? { reason: "upload consumer observation failed" }
        : { raw: "literal-saved" },
    );
  },
);

it.each(["missing", "wrong-version", "closed"])(
  "inactive observation leaves the getter and handle untouched: %s",
  async (mode) => {
    if (mode === "wrong-version")
      Object.defineProperty(window, CAP, {
        configurable: true,
        value: { version: 2, token: "wrong", action: "entry" },
      });
    else Reflect.deleteProperty(window, CAP);
    fail = mode === "closed";
    const read = vi.fn();
    const consume = vi.fn();
    wrapper = mount(
      defineComponent({
        setup() {
          useUploadLimits("literal-saved", {
            observation: () => {
              read();
              return { uploadsLimits: consume };
            },
          });
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
    );
    await flushPromises();
    expect(
      client.getQueryState(["uploads", "limits", "literal-saved"])?.status,
    ).toBe(fail ? "error" : "success");
    expect(calls).toHaveLength(1);
    expect(read).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    expect(packets).toEqual([]);
  },
);
