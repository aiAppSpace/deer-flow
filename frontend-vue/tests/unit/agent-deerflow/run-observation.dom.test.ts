import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createThreadRunner } from "@/core/agent-deerflow/thread-runner";
import { createDeerFlowRunProtocol } from "@/core/agent-deerflow/run-protocol";
import {
  bindRunInput,
  captureRunInvocation,
} from "@/core/diagnostics/run-observation";
import {
  createParityObserver,
  PARITY_OBSERVATION_CAPABILITY as CAPABILITY,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";
let packets: ObservationPacket[];
const receive = (event: Event) =>
  packets.push((event as CustomEvent<ObservationPacket>).detail);
beforeEach(() => {
  packets = [];
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: { version: 1, token: "adapter-run", action: "send" },
  });
  window.addEventListener(EVENT, receive);
});
afterEach(() => {
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAPABILITY);
});
function bound() {
  const input = {
    threadId: "thread",
    payload: {
      assistant_id: "lead_agent",
      input: { messages: [] },
      stream_mode: ["values"],
    },
  };
  const observer = createParityObserver("human:send")!;
  bindRunInput(input, observer, observer.point(), "thread", "lead_agent");
  return input;
}
function response() {
  return new Response("event: end\ndata: {}\n\n", {
    headers: {
      "Content-Type": "text/event-stream",
      "Content-Location": "/api/threads/thread/runs/run",
    },
  });
}
it("real protocol/session/runner delivers its exact returned handle after onStart", async () => {
  const input = bound();
  const fetchImpl = vi.fn(async () => response());
  const onStart = vi.fn(() => {
    expect(packets.filter((p) => p.event === "run.received")).toHaveLength(1);
    expect(packets.filter((p) => p.event === "run.delivered")).toHaveLength(0);
  });
  const runner = createThreadRunner({
    protocol: createDeerFlowRunProtocol({
      baseUrl: "https://example.test/api/langgraph",
      fetchImpl,
    }),
    loadDurableState: async () => undefined,
    onStart,
  });
  await runner.submit(input);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(runner.getSessionState().status).toBe("completed");
  expect(
    packets.filter((p) => p.event === "run.delivered").map((p) => p.values),
  ).toEqual([{ thread: "thread", run: "run", state: "active" }]);
  runner.dispose();
});
it("reset during creation retires the old invocation and rejects its late adoption", async () => {
  const input = bound();
  let resolve!: (value: Response) => void;
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  const fetchImpl = vi.fn(() => pending);
  const onStart = vi.fn();
  const runner = createThreadRunner({
    protocol: createDeerFlowRunProtocol({
      baseUrl: "https://example.test/api/langgraph",
      fetchImpl,
    }),
    loadDurableState: async () => undefined,
    onStart,
  });
  const running = runner.submit(input);
  await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
  runner.reset();
  resolve(response());
  await running;
  expect(onStart).not.toHaveBeenCalled();
  expect(packets.filter((p) => p.event === "run.retire")).toHaveLength(1);
  expect(packets.filter((p) => p.event === "run.delivered")).toHaveLength(0);
  expect(
    packets.filter((p) => p.event === "run.received")[0]!.values.state,
  ).toBe("retired");
  runner.dispose();
});

it("creating callback cannot retroactively bind a previously unowned invocation", async () => {
  const input = {
    threadId: "thread",
    payload: { assistant_id: "lead_agent", stream_mode: ["values"] },
  };
  const observer = createParityObserver("human:send")!;
  const runner = createThreadRunner({
    protocol: createDeerFlowRunProtocol({
      baseUrl: "https://example.test/api/langgraph",
      fetchImpl: async () => response(),
    }),
    loadDurableState: async () => undefined,
    onSessionState(state) {
      if (state.status !== "creating") return;
      bindRunInput(input, observer, observer.point(), "thread", "lead_agent");
      captureRunInvocation(() => input, "adapter");
    },
  });
  await runner.submit(input);
  expect(runner.getSessionState().status).toBe("completed");
  expect(packets.filter((p) => p.event === "run.received")).toHaveLength(0);
  expect(packets.filter((p) => p.event === "run.delivered")).toHaveLength(0);
  expect(packets.some((p) => p.event === "invalid")).toBe(true);
  runner.dispose();
});
