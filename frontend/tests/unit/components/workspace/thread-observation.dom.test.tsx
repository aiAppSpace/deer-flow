import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { StrictMode, Suspense, use, useEffect } from "react";

import { useThreadChat } from "@/components/workspace/chats/use-thread-chat";

const CAPABILITY = "__deerflow_parity_capture_v1__";
const EVENT = "deerflow:parity-identity:v1";
type Packet = {
  event: string;
  instance: number;
  action: string | null;
  values: Record<string, unknown>;
};
const { route, mint } = rs.hoisted(() => ({
  route: {
    pathname: "/workspace/chats/new",
    paramsId: "new",
    search: "project=alpha",
  },
  mint: rs.fn(),
}));
rs.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useParams: () => ({ thread_id: route.paramsId }),
  useSearchParams: () => new URLSearchParams(route.search),
}));
rs.mock("@/core/utils/uuid", () => ({ uuid: mint }));
const context = { surface: "main", account: "alice", agent: null };
let packets: Packet[];
const receive = (event: Event) =>
  packets.push((event as CustomEvent<Packet>).detail);
const events = (name: string) =>
  packets.filter((packet) => packet.event === name);
function navigate(path: string, search = "") {
  route.pathname = path;
  route.paramsId = path.split("/").at(-1) ?? "new";
  route.search = search;
  window.history.replaceState(null, "", path + (search ? `?${search}` : ""));
}
beforeEach(() => {
  packets = [];
  mint.mockReset();
  let serial = 0;
  mint.mockImplementation(() => `draft-${++serial}`);
  navigate("/workspace/chats/new", "project=alpha");
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: { version: 1, token: "capture-a", action: "enter" },
  });
  window.addEventListener(EVENT, receive);
});
afterEach(() => {
  cleanup();
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAPABILITY);
  rs.restoreAllMocks();
});

it("does not admit an unused title reader and publishes the interactive owner before passive consumers", () => {
  renderHook(() => useThreadChat());
  expect(packets).toEqual([]);
  const consumerSnapshots: Packet[][] = [];
  const view = renderHook(() => {
    const result = useThreadChat(undefined, context);
    useEffect(() => {
      consumerSnapshots.push([...packets]);
    }, [result.threadId]);
    return result;
  });
  expect(view.result.current.threadId).toBe("draft-2");
  expect(events("thread.allocate").map((packet) => packet.values.raw)).toEqual([
    "draft-2",
  ]);
  expect(
    consumerSnapshots[0]?.some(
      (packet) =>
        packet.event === "thread.select" && packet.values.raw === "draft-2",
    ),
  ).toBe(true);
  expect(events("thread.bind").map((packet) => packet.values.project)).toEqual([
    "alpha",
  ]);
  view.rerender();
  expect(events("thread.select")).toHaveLength(1);
});

it("keeps alpha provenance during the beta intent commit and binds only the newly selected draft to beta", () => {
  const view = renderHook(() => useThreadChat(undefined, context));
  navigate("/workspace/chats/new", "project=beta");
  view.rerender();
  expect(
    events("thread.select").map((packet) => [
      packet.values.raw,
      packet.values.projectIntent,
    ]),
  ).toEqual([
    ["draft-1", "alpha"],
    ["draft-1", "beta"],
    ["draft-2", "beta"],
  ]);
  expect(
    events("thread.bind").map((packet) => [
      packet.values.raw,
      packet.values.project,
    ]),
  ).toEqual([
    ["draft-1", "alpha"],
    ["draft-2", "beta"],
  ]);
  expect(events("thread.retire").map((packet) => packet.values.raw)).toEqual([
    "draft-1",
  ]);
});

it("native adoption reuses the selected allocation and does not retire the live identity", () => {
  const view = renderHook(() => useThreadChat(undefined, context));
  act(() => {
    window.history.replaceState(null, "", "/workspace/chats/draft-1");
    view.result.current.setThreadId("draft-1");
    view.result.current.setIsNewThread(false);
  });
  expect(events("thread.allocate")).toHaveLength(1);
  expect(events("thread.select").at(-1)?.values).toMatchObject({
    raw: "draft-1",
    draft: false,
  });
  expect(events("thread.retire")).toEqual([]);
  expect(mint).toHaveBeenCalledTimes(1);
});

it("records account and agent departure instead of relabeling the allocation", () => {
  let current = { ...context };
  const view = renderHook(() => useThreadChat(undefined, current));
  current = { ...context, account: "bob" };
  view.rerender();
  expect(
    events("thread.allocate").map((packet) => packet.values.account),
  ).toEqual(["alice"]);
  expect(events("thread.retire")).toHaveLength(1);
  expect(events("thread.select").at(-1)?.values.account).toBe("bob");
});

it("retires on an unknown departing route and does not admit its retained local state as that route's owner", () => {
  const view = renderHook(() => useThreadChat(undefined, context));
  const selections = events("thread.select").length;
  navigate("/workspace/agents/new");
  view.rerender();
  expect(events("thread.select")).toHaveLength(selections);
  expect(events("thread.retire").map((packet) => packet.values.raw)).toEqual([
    "draft-1",
  ]);
});

it("keeps discarded Suspense allocations unpublished", async () => {
  const pending = new Promise<never>(() => undefined);
  function Discarded() {
    useThreadChat(undefined, context);
    use(pending);
    return null;
  }
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <Suspense fallback={<span>pending</span>}>
        <Discarded />
      </Suspense>,
    );
  });
  expect(view.container.textContent).toBe("pending");
  expect(mint.mock.calls.length).toBeGreaterThan(0);
  expect(packets).toEqual([]);
  view.unmount();
  const committed = renderHook(() => useThreadChat(undefined, context));
  expect(events("thread.allocate").map((packet) => packet.values.raw)).toEqual([
    committed.result.current.threadId,
  ]);
});

it("StrictMode effect replay never invents a second allocation", () => {
  const view = renderHook(() => useThreadChat(undefined, context), {
    wrapper: StrictMode,
  });
  const id = view.result.current.threadId;
  expect(events("thread.allocate").map((packet) => packet.values.raw)).toEqual([
    id,
  ]);
  expect(
    events("thread.select").every((packet) => packet.values.raw === id),
  ).toBe(true);
  view.rerender();
  expect(mint).toHaveBeenCalledTimes(1);
});

it.each([undefined, { version: 2, token: "capture-a" }])(
  "stays silent with absent or unsupported capability: %j",
  (capability) => {
    Object.defineProperty(window, CAPABILITY, {
      configurable: true,
      value: capability,
    });
    const view = renderHook(() => useThreadChat(undefined, context));
    expect(view.result.current.threadId).toBe("draft-1");
    expect(packets).toEqual([]);
    expect(mint).toHaveBeenCalledTimes(1);
  },
);

it("a revoked capture and a failed publisher do not change selected state or mint count", () => {
  const dispatch = rs.spyOn(window, "dispatchEvent").mockImplementation(() => {
    throw new Error("observer failed");
  });
  const view = renderHook(() => useThreadChat(undefined, context));
  expect(view.result.current.threadId).toBe("draft-1");
  dispatch.mockRestore();
  Reflect.deleteProperty(window, CAPABILITY);
  navigate("/workspace/chats/new", "project=beta");
  view.rerender();
  expect(view.result.current.threadId).toBe("draft-2");
  expect(mint).toHaveBeenCalledTimes(2);
  expect(packets).toEqual([]);
});
