import {
  createParityObserver,
  parityObservationEnabled,
  type ObservationPoint,
  type ObservationValues,
} from "./parity-observation";

type Observer = NonNullable<ReturnType<typeof createParityObserver>>;
export type RunObservation = Readonly<{ retire(): void }>;
export type RunInvocation = Readonly<{
  verifyInput(actual: unknown): void;
  retire(): void;
  received(handle: object, thread: unknown, run: unknown): void;
  delivered(handle: object, thread: unknown, run: unknown): void;
}>;
type Binding = {
  observer: Observer;
  retired: boolean;
  ambiguous: boolean;
  invocation: RunInvocation | null;
};
// These keys are the actual submit argument and parsed handle objects. They are
// never request fields, raw-ID lookups, cross-app keys or product state.
const inputs = new WeakMap<object, Binding>();
const invokedInputs = new WeakSet<object>();
const handles = new WeakMap<object, RunInvocation>();
const object = (value: unknown): value is object =>
  value !== null && (typeof value === "object" || typeof value === "function");
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 4096;
const state = (binding: Binding) =>
  binding.ambiguous ? "ambiguous" : binding.retired ? "retired" : "active";
function emit(binding: Binding, event: string, values: ObservationValues) {
  // Current point/action belongs to this phase. The initiating action is a
  // separate field on run.bind, not a rewritten timestamp or current action.
  binding.observer.emit(event, values);
}
function retire(binding: Binding) {
  if (binding.retired) return;
  binding.retired = true;
  emit(binding, "run.retire", {});
}
function invalid(binding: Binding, reason: string) {
  binding.ambiguous = true;
  emit(binding, "invalid", { reason });
}

/** Bind only the final actual argument, using the already existing source
 * observer. Off/closed captures do not inspect any extra input properties. */
export function bindRunInput(
  input: object,
  observer: Observer | null | undefined,
  source: ObservationPoint | null | undefined,
  thread: string,
  assistant: string,
): RunObservation | null {
  const point = observer?.point();
  if (!observer || !point || source?.capture !== point.capture) return null;
  const binding: Binding = {
    observer,
    retired: false,
    ambiguous: false,
    invocation: null,
  };
  if (!object(input) || !text(thread) || !text(assistant)) {
    invalid(binding, "run input binding is malformed");
    return null;
  }
  const previous = inputs.get(input);
  if (previous) {
    invalid(previous, "run input object was bound more than once");
    invalid(binding, "run input object was bound more than once");
    return null;
  }
  if (invokedInputs.has(input)) {
    invalid(binding, "run input binding followed an earlier invocation");
    return null;
  }
  inputs.set(input, binding);
  emit(binding, "run.bind", { thread, assistant, sourceAction: source.action });
  return Object.freeze({
    retire() {
      retire(binding);
    },
  });
}

/** Capture once at the actual invocation boundary, before any lazy iteration.
 * A future binding never turns an already unowned invocation into an owner. */
export function captureRunInvocation(
  read: () => unknown,
  transport: "sdk" | "adapter",
): RunInvocation | null {
  if (!parityObservationEnabled()) return null;
  let input: unknown;
  try {
    input = read();
  } catch {
    createParityObserver("run")?.emit("invalid", {
      reason: "run input observation is unreadable",
    });
    return null;
  }
  if (object(input)) invokedInputs.add(input);
  const binding = object(input) ? inputs.get(input) : undefined;
  if (!binding?.observer.point()) {
    createParityObserver("run")?.emit("run.unowned", { transport });
    return null;
  }
  if (binding.invocation) {
    invalid(binding, "run input object was invoked more than once");
    return null;
  }
  let received: { handle: object; thread: string; run: string } | null = null;
  let delivered = false;
  const invocation: RunInvocation = Object.freeze({
    verifyInput(actual: unknown) {
      if (actual !== input)
        invalid(binding, "run invocation input changed before transport");
    },
    retire() {
      retire(binding);
    },
    received(handle: object, thread: unknown, run: unknown) {
      if (!binding.observer.point()) return;
      if (!object(handle) || !text(thread) || !text(run)) {
        invalid(binding, "run received handle is malformed");
        return;
      }
      if (received || handles.has(handle)) {
        invalid(binding, "run received handle has multiple sources");
        return;
      }
      received = { handle, thread, run };
      handles.set(handle, invocation);
      emit(binding, "run.received", { thread, run, state: state(binding) });
    },
    delivered(handle: object, thread: unknown, run: unknown) {
      if (!binding.observer.point()) return;
      if (
        !text(thread) ||
        !text(run) ||
        delivered ||
        received?.handle !== handle ||
        received.thread !== thread ||
        received.run !== run ||
        handles.get(handle) !== invocation
      ) {
        invalid(binding, "run delivered handle does not belong to invocation");
        return;
      }
      delivered = true;
      emit(binding, "run.delivered", { thread, run, state: state(binding) });
    },
  });
  binding.invocation = invocation;
  emit(binding, "run.called", { transport, state: state(binding) });
  return invocation;
}

/** Vue protocol reads the invocation already captured by its synchronous
 * runner. It does not mint a second invocation or infer one from equal IDs. */
export function runInvocationForInput(input: object): RunInvocation | null {
  if (!parityObservationEnabled()) return null;
  const binding = inputs.get(input);
  return binding?.observer.point() && !binding.ambiguous
    ? binding.invocation
    : null;
}

/** The SDK forwards input as an own data property. Do not call an accessor
 * merely for diagnostics; the actual product reads retain their original time. */
export function ownRunInput(payload: unknown): unknown {
  if (!object(payload)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(payload, "input");
  if (descriptor && !("value" in descriptor))
    throw new Error("run input observation encountered an accessor");
  return descriptor?.value;
}
