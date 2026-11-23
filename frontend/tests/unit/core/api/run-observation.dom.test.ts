import { beforeEach, afterEach, expect, it, rs } from "@rstest/core";

import { getAPIClient } from "@/core/api/api-client";
import {
  createParityObserver,
  PARITY_OBSERVATION_CAPABILITY as CAPABILITY,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";
import { bindRunInput } from "@/core/diagnostics/run-observation";
let packets: ObservationPacket[];
const receive = (event: Event) =>
  packets.push((event as CustomEvent<ObservationPacket>).detail);
beforeEach(() => {
  packets = [];
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: { version: 1, token: "sdk-run", action: "send" },
  });
  window.addEventListener(EVENT, receive);
});
afterEach(() => {
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAPABILITY);
  rs.unstubAllGlobals();
});
function bind(input: object) {
  const observer = createParityObserver("human:send")!;
  return bindRunInput(
    input,
    observer,
    observer.point(),
    "thread",
    "lead_agent",
  );
}
function response(run = "run") {
  return new Response("event: end\ndata: {}\n\n", {
    headers: {
      "Content-Type": "text/event-stream",
      "Content-Location": `/api/threads/thread/runs/${run}`,
    },
  });
}
async function drain(iterable: AsyncIterable<unknown>) {
  for await (const event of iterable) void event;
}
it("real RunsClient stays lazy and records handle delivery only after original callback", async () => {
  const input = Object.freeze({ messages: [] });
  bind(input);
  const fetch = rs.fn(async () => response());
  rs.stubGlobal("fetch", fetch);
  const callback = rs.fn(() => {
    expect(packets.filter((p) => p.event === "run.received")).toHaveLength(1);
    expect(packets.filter((p) => p.event === "run.delivered")).toHaveLength(0);
  });
  const stream = getAPIClient(true).runs.stream("thread", "lead_agent", {
    input,
    onRunCreated: callback,
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(packets.filter((p) => p.event === "run.called")).toHaveLength(1);
  await drain(stream);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(
    packets.filter((p) => p.event === "run.delivered").map((p) => p.values),
  ).toEqual([{ thread: "thread", run: "run", state: "active" }]);
});
it("a late binding after stream() cannot own its later iteration", async () => {
  const input = { messages: [] };
  rs.stubGlobal(
    "fetch",
    rs.fn(async () => response()),
  );
  const stream = getAPIClient(true).runs.stream("thread", "lead_agent", {
    input,
    onRunCreated: () => undefined,
  });
  bind(input);
  await drain(stream);
  expect(packets.filter((p) => p.event === "run.unowned")).toHaveLength(1);
  expect(packets.filter((p) => p.event === "run.delivered")).toHaveLength(0);
});
it("original callback error remains the product error and is not delivery", async () => {
  const input = { messages: [] };
  bind(input);
  rs.stubGlobal(
    "fetch",
    rs.fn(async () => response()),
  );
  const failure = new Error("original callback failure");
  const stream = getAPIClient(true).runs.stream("thread", "lead_agent", {
    input,
    onRunCreated: () => {
      throw failure;
    },
  });
  await expect(drain(stream)).rejects.toBe(failure);
  expect(packets.filter((p) => p.event === "run.received")).toHaveLength(1);
  expect(packets.filter((p) => p.event === "run.delivered")).toHaveLength(0);
});

it("a lazy payload input swap cannot deliver B's handle as A's invocation", async () => {
  const first = { messages: [] },
    second = { messages: [] };
  bind(first);
  bind(second);
  let sent: unknown;
  rs.stubGlobal(
    "fetch",
    rs.fn(async (_url: unknown, init?: RequestInit) => {
      if (typeof init?.body !== "string")
        throw new Error("expected JSON string body");
      sent = JSON.parse(init.body);
      return response();
    }),
  );
  const payload = { input: first, onRunCreated: () => undefined };
  const stream = getAPIClient(true).runs.stream(
    "thread",
    "lead_agent",
    payload,
  );
  payload.input = second;
  await drain(stream);
  expect(sent).toMatchObject({ input: second });
  expect(packets.filter((p) => p.event === "invalid")).toHaveLength(1);
  expect(
    packets.filter(
      (p) => p.event === "run.delivered" && p.values.state === "active",
    ),
  ).toHaveLength(0);
});
