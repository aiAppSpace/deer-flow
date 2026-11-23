import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatThreadOwner } from "@/composables/useChatThreadOwner";

const CAPABILITY = "__deerflow_parity_capture_v1__";
const EVENT = "deerflow:parity-identity:v1";
type Packet = { event: string; values: Record<string, unknown> };
let packets: Packet[];
const wrappers: ReturnType<typeof mount>[] = [];
const receive = (event: Event) =>
  packets.push((event as CustomEvent<Packet>).detail);
const events = (name: string) =>
  packets.filter((packet) => packet.event === name);
beforeEach(() => {
  packets = [];
  let serial = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
    () => `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
  );
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: { version: 1, token: "capture-a", action: "enter" },
  });
  window.addEventListener(EVENT, receive);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAPABILITY);
  vi.restoreAllMocks();
});
function host(initialThread: string | null = null, observe = true) {
  const threadId = ref(initialThread);
  const projectId = ref<string | null>("alpha");
  const userId = ref<string | null>("alice");
  const agentName = ref<string | null>(null);
  const path = ref("/workspace/chats/new");
  const mock = ref(false);
  let owner!: ReturnType<typeof useChatThreadOwner>;
  const wrapper = mount(
    defineComponent({
      setup() {
        owner = useChatThreadOwner({
          threadId,
          projectId,
          userId,
          agentName,
          onCreated: () => {},
          onProjectUnavailable: () => {},
          ...(observe
            ? {
                observation: {
                  surface: "main",
                  path,
                  mock,
                },
              }
            : {}),
        });
        return () => h("div");
      },
    }),
  );
  wrappers.push(wrapper);
  return { owner, threadId, projectId, userId, agentName, wrapper, path, mock };
}

it("publishes the mounted empty owner, not an unselected setup draft on a persisted route", () => {
  const persisted = host("saved-thread");
  expect(events("thread.allocate")).toEqual([]);
  expect(events("thread.select").map((packet) => packet.values.raw)).toEqual([
    "saved-thread",
  ]);
  persisted.wrapper.unmount();
  packets = [];
  const draft = host();
  expect(events("thread.allocate").map((packet) => packet.values.raw)).toEqual([
    draft.owner.capture().threadId,
  ]);
  expect(events("thread.bind").map((packet) => packet.values.project)).toEqual([
    "alpha",
  ]);
});

it("keeps both synchronous alpha to beta to alpha transitions and their retirements", () => {
  const state = host();
  const first = state.owner.capture().threadId;
  state.projectId.value = "beta";
  const second = state.owner.capture().threadId;
  state.projectId.value = "alpha";
  const third = state.owner.capture().threadId;
  expect(new Set([first, second, third]).size).toBe(3);
  expect(events("thread.select").map((packet) => packet.values.raw)).toEqual([
    first,
    second,
    third,
  ]);
  expect(events("thread.retire").map((packet) => packet.values.raw)).toEqual([
    first,
    second,
  ]);
  expect(events("thread.bind").map((packet) => packet.values.project)).toEqual([
    "alpha",
    "beta",
    "alpha",
  ]);
});

it("same-ID adoption and removal of the route project retain the original allocation", () => {
  const state = host();
  const id = state.owner.capture().threadId;
  const revision = state.owner.capture().revision;
  state.threadId.value = id;
  state.projectId.value = null;
  expect(state.owner.capture().revision).toBe(revision);
  expect(events("thread.allocate")).toHaveLength(1);
  expect(events("thread.retire")).toEqual([]);
  expect(events("thread.select").at(-1)?.values).toMatchObject({
    raw: id,
    draft: false,
    projectIntent: null,
  });
  expect(events("thread.bind").map((packet) => packet.values.project)).toEqual([
    "alpha",
  ]);
});

it("account departure retires the old selected owner and binds the actual new draft", () => {
  const state = host();
  const first = state.owner.capture().threadId;
  state.userId.value = "bob";
  expect(events("thread.retire").map((packet) => packet.values.raw)).toEqual([
    first,
  ]);
  expect(
    events("thread.allocate").map((packet) => packet.values.account),
  ).toEqual(["alice", "bob"]);
});

it("disposal retires selection without publishing the teardown mint", () => {
  const state = host();
  const id = state.owner.capture().threadId;
  state.wrapper.unmount();
  expect(events("thread.allocate").map((packet) => packet.values.raw)).toEqual([
    id,
  ]);
  expect(events("thread.retire").map((packet) => packet.values.raw)).toEqual([
    id,
  ]);
  expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(2);
});

it("default consumers never publish even if the harness capability exists", () => {
  const state = host(null, false);
  state.projectId.value = "beta";
  expect(packets).toEqual([]);
  expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(2);
});

it("observer failure leaves the same synchronous owner and retirement behavior", () => {
  vi.spyOn(window, "dispatchEvent").mockImplementation(() => {
    throw new Error("observer failed");
  });
  const state = host();
  const before = state.owner.capture();
  state.projectId.value = "beta";
  expect(state.owner.owns(before)).toBe(false);
  expect(state.owner.capture().threadId).not.toBe(before.threadId);
  expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(2);
});

it("observes mock-only changes without resetting the actual selected owner", () => {
  const state = host();
  const before = state.owner.capture();
  state.mock.value = true;
  state.mock.value = false;
  expect(events("thread.select").map((packet) => packet.values.mock)).toEqual([
    false,
    true,
    false,
  ]);
  expect(state.owner.capture()).toEqual(before);
  expect(events("thread.retire")).toEqual([]);
  expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
});
it("observes a changed public path presentation without inventing another allocation", () => {
  const state = host();
  const before = state.owner.capture();
  state.path.value = "/workspace/chats/%6Eew";
  expect(events("thread.select").map((packet) => packet.values.path)).toEqual([
    "/workspace/chats/new",
    "/workspace/chats/%6Eew",
  ]);
  expect(state.owner.capture()).toEqual(before);
  expect(events("thread.allocate")).toHaveLength(1);
  expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
});
