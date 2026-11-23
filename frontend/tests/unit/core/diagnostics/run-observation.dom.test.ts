import { afterEach, beforeEach, expect, it, rs as vi } from "@rstest/core";

import {
  createParityObserver,
  PARITY_OBSERVATION_CAPABILITY as CAPABILITY,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";
import {
  bindRunInput,
  captureRunInvocation,
  ownRunInput,
  runInvocationForInput,
} from "@/core/diagnostics/run-observation";

let packets: ObservationPacket[];
const receive = (event: Event) =>
  packets.push((event as CustomEvent<ObservationPacket>).detail);
function capability(token = "run-test", action = "submit") {
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: { version: 1, token, action },
  });
}
beforeEach(() => {
  packets = [];
  capability();
  window.addEventListener(EVENT, receive);
});
afterEach(() => {
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAPABILITY);
});
function bound(input: object = Object.freeze({})) {
  const observer = createParityObserver("human:send")!;
  const token = bindRunInput(
    input,
    observer,
    observer.point(),
    "thread",
    "agent",
  )!;
  return { input, token };
}
const events = (name: string) =>
  packets.filter((packet) => packet.event === name);
it("off capture never reads an extra input getter", () => {
  Reflect.deleteProperty(window, CAPABILITY);
  const read = vi.fn(() => {
    throw new Error("must not read");
  });
  expect(captureRunInvocation(read, "sdk")).toBeNull();
  expect(read).not.toHaveBeenCalled();
  expect(packets).toEqual([]);
});
it("records actual phase action separately from the source action", () => {
  const { input } = bound();
  capability("run-test", "later-phase");
  const invocation = captureRunInvocation(() => input, "sdk")!;
  const handle = Object.freeze({});
  invocation.received(handle, "thread", "run");
  invocation.delivered(handle, "thread", "run");
  expect(packets.map((p) => p.event)).toEqual([
    "run.bind",
    "run.called",
    "run.received",
    "run.delivered",
  ]);
  expect(packets[0]!.values.sourceAction).toBe("submit");
  expect(packets.slice(1).map((p) => p.action)).toEqual([
    "later-phase",
    "later-phase",
    "later-phase",
  ]);
  expect(new Set(packets.map((p) => p.instance)).size).toBe(1);
  expect(runInvocationForInput(input)).toBe(invocation);
});
it("a future binding cannot own an earlier invocation", () => {
  const input = {};
  const earlier = captureRunInvocation(() => input, "sdk");
  bound(input);
  expect(earlier).toBeNull();
  expect(events("run.unowned")).toHaveLength(1);
  expect(events("run.called")).toHaveLength(0);
});
it("equal cloned input has no object provenance", () => {
  const { input } = bound({ message: "private" });
  expect(captureRunInvocation(() => ({ ...input }), "sdk")).toBeNull();
  expect(events("run.unowned")).toHaveLength(1);
});
it("duplicate bindings and invocations are ambiguous, never overwritten", () => {
  const { input } = bound();
  const first = captureRunInvocation(() => input, "adapter");
  expect(captureRunInvocation(() => input, "adapter")).toBeNull();
  expect(first).not.toBeNull();
  expect(runInvocationForInput(input)).toBeNull();
  bound(input);
  expect(events("invalid")).toHaveLength(3);
});
it("two valid minted handles cannot be cross-delivered even with equal raw IDs", () => {
  const a = bound(),
    b = bound();
  const ia = captureRunInvocation(() => a.input, "adapter")!;
  const ib = captureRunInvocation(() => b.input, "adapter")!;
  const ha = {},
    hb = {};
  ia.received(ha, "thread", "run");
  ib.received(hb, "thread", "run");
  ia.delivered(hb, "thread", "run");
  ib.delivered(ha, "thread", "run");
  expect(events("invalid")).toHaveLength(2);
  expect(events("run.delivered")).toHaveLength(0);
});
it("retired invocation stays associated with its old owner", () => {
  const a = bound();
  const invocation = captureRunInvocation(() => a.input, "sdk")!;
  a.token.retire();
  a.token.retire();
  const handle = {};
  invocation.received(handle, "thread", "run");
  invocation.delivered(handle, "thread", "run");
  expect(events("run.retire")).toHaveLength(1);
  expect(events("run.delivered")[0]!.values.state).toBe("retired");
});
it("capture replacement cannot publish old ownership into the new capture", () => {
  const { input } = bound();
  const invocation = captureRunInvocation(() => input, "sdk")!;
  capability("new-capture");
  packets = [];
  invocation.received({}, "thread", "run");
  expect(captureRunInvocation(() => input, "sdk")).toBeNull();
  expect(events("run.received")).toHaveLength(0);
  expect(events("run.unowned")).toHaveLength(1);
});
it("input accessors are not invoked and diagnostics remain contained", () => {
  const get = vi.fn(() => {
    throw new Error("getter");
  });
  const payload = Object.defineProperty({}, "input", { get });
  expect(captureRunInvocation(() => ownRunInput(payload), "sdk")).toBeNull();
  expect(get).not.toHaveBeenCalled();
  expect(events("invalid")).toHaveLength(1);
});
it("received-only, unknown handle and repeated delivery do not fabricate adoption", () => {
  const { input } = bound();
  const invocation = captureRunInvocation(() => input, "sdk")!;
  const handle = {};
  invocation.received(handle, "thread", "run");
  expect(events("run.delivered")).toHaveLength(0);
  invocation.delivered({}, "thread", "run");
  expect(events("run.delivered")).toHaveLength(0);
  invocation.delivered(handle, "thread", "run");
  expect(events("run.delivered")[0]!.values.state).toBe("ambiguous");
  invocation.delivered(handle, "thread", "run");
  expect(events("run.delivered")).toHaveLength(1);
});
