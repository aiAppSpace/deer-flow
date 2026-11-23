import {
  createParityObserver,
  type ObservationValues,
} from "./parity-observation";
import { bindRunInput } from "./run-observation";

type ReplayIntent = Readonly<{
  kind: "edit" | "regenerate";
  thread: string;
  source: string | null;
  agent: string | null;
}>;
const METADATA_REFERENCES = [
  "edit_message_id",
  "edit_from_message_id",
  "edit_version_group_id",
  "regenerate_from_run_id",
  "regenerate_from_message_id",
  "regenerate_checkpoint_id",
] as const;

function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!("value" in descriptor)) throw new Error("accessor identity field");
  return descriptor.value;
}

/** Read only finite identity slots from the JSON already consumed by replay.
 * Responses, adoption and final submit remain distinct facts. No message text,
 * unknown fields, file data or error payloads enter the observation channel. */
export function createReplayObservation(intent: ReplayIntent) {
  // Capability detection precedes any intent reads. Invalid diagnostics must
  // never throw before the caller's product try/finally owns its submission.
  const observer = createParityObserver("replay");
  const origin = observer?.point();
  if (!observer || !origin) return null;
  const emit = (event: string, values: ObservationValues) =>
    observer.emit(event, values, origin);
  const invalid = (reason: string) => emit("invalid", { reason });
  const textSize = (values: ObservationValues) =>
    Object.values(values).reduce<number>(
      (total, value) => total + (typeof value === "string" ? value.length : 0),
      0,
    );
  let identity: ReplayIntent;
  try {
    const kind = own(intent, "kind");
    const thread = own(intent, "thread");
    const source = own(intent, "source");
    const agent = own(intent, "agent");
    if (
      (kind !== "edit" && kind !== "regenerate") ||
      typeof thread !== "string" ||
      !thread ||
      typeof source !== "string" ||
      !source ||
      (agent !== null && typeof agent !== "string")
    ) {
      invalid("replay source intent is malformed");
      return null;
    }
    identity = { kind, thread, source, agent };
    if (textSize(identity) > 1_048_576) {
      invalid("replay intent evidence capacity exceeded");
      return null;
    }
    emit("replay.begin", identity);
  } catch {
    invalid("replay source intent is unreadable");
    return null;
  }

  function snapshot(phase: "response" | "attempt", prepared: unknown) {
    let complete = true;
    let messageCount: number | null = null;
    let sourceCount: number | null = null;
    let sourcesType: "absent" | "array" | "null" | "invalid" | "unreadable" =
      "unreadable";
    const fail = (reason: string) => {
      complete = false;
      invalid(reason);
    };
    try {
      // Presence is distinct from an empty list: Vue's real consumer uses
      // nullish fallback. Read the own descriptor once without invoking getters;
      // explicit undefined is not an absent JSON property.
      const descriptor =
        prepared && typeof prepared === "object"
          ? Object.getOwnPropertyDescriptor(prepared, "source_message_ids")
          : undefined;
      if (descriptor && !("value" in descriptor))
        throw new Error("accessor source references");
      const sources: unknown = descriptor?.value;
      sourcesType = !descriptor
        ? "absent"
        : Array.isArray(sources)
          ? "array"
          : sources === null
            ? "null"
            : "invalid";
      const input = own(prepared, "input");
      const messages = own(input, "messages");
      const metadata = own(prepared, "metadata");
      const checkpoint = own(prepared, "checkpoint");
      const checkpointId = own(checkpoint, "checkpoint_id");
      const targetRun = own(prepared, "target_run_id");
      const replacement = own(prepared, "replacement_human_message_id");
      if (!Array.isArray(messages)) {
        fail("replay input messages are not an array");
        return;
      }
      messageCount = messages.length;
      sourceCount =
        sourcesType === "absent"
          ? 0
          : Array.isArray(sources)
            ? sources.length
            : null;
      if (sourceCount === null) {
        fail("replay source references are not an array");
        return;
      }
      if (messageCount + sourceCount + METADATA_REFERENCES.length + 3 > 4096) {
        fail("replay identity evidence capacity exceeded");
        return;
      }
      const rows: { event: string; values: ObservationValues }[] = [];
      function reference(slot: string, raw: unknown) {
        const valueType =
          raw === undefined
            ? "absent"
            : raw === null
              ? "null"
              : typeof raw === "string"
                ? "string"
                : "invalid";
        if (valueType === "invalid") fail("replay reference is not a string");
        rows.push({
          event: "replay.reference",
          values: {
            phase,
            slot,
            valueType,
            raw: typeof raw === "string" ? raw : null,
          },
        });
      }
      reference("target_run_id", targetRun);
      reference("replacement_human_message_id", replacement);
      reference("checkpoint.checkpoint_id", checkpointId);
      for (const key of METADATA_REFERENCES)
        reference(`metadata.${key}`, own(metadata, key));
      if (typeof targetRun !== "string" || !targetRun)
        fail("replay target run identity is missing");
      if (typeof checkpointId !== "string" || !checkpointId)
        fail("replay checkpoint identity is missing");
      if (
        own(metadata, "regenerate_from_run_id") !== targetRun ||
        own(metadata, "regenerate_checkpoint_id") !== checkpointId
      )
        fail("replay run or checkpoint identity disagrees with metadata");
      if (identity.kind === "edit" && !Array.isArray(sources))
        fail("edit source references are missing");
      let matchingReplacement = 0;
      let humanCount = 0;
      for (let index = 0; index < messages.length; index += 1) {
        const message = own(messages, String(index));
        if (!message || typeof message !== "object" || Array.isArray(message))
          fail("replay message is not an object");
        const type = own(message, "type");
        const role = own(message, "role");
        const raw = own(message, "id");
        if (type === "human") {
          humanCount += 1;
          if (typeof raw !== "string" || !raw)
            fail("replay human identity is missing");
        }
        if (
          (raw !== undefined && typeof raw !== "string") ||
          (type !== undefined && typeof type !== "string") ||
          (role !== undefined && typeof role !== "string")
        )
          fail("replay message identity fields are malformed");
        if (type === "human" && raw === replacement && typeof raw === "string")
          matchingReplacement += 1;
        rows.push({
          event: "replay.message",
          values: {
            phase,
            index,
            type: typeof type === "string" ? type : null,
            role: typeof role === "string" ? role : null,
            idPresent: raw !== undefined,
            raw: typeof raw === "string" ? raw : null,
          },
        });
      }
      if (Array.isArray(sources))
        for (let index = 0; index < sources.length; index += 1) {
          const raw = own(sources, String(index));
          if (typeof raw !== "string" || !raw)
            fail("replay source identity is malformed");
          rows.push({
            event: "replay.source",
            values: { phase, index, raw: typeof raw === "string" ? raw : null },
          });
        }
      if (humanCount !== 1)
        fail("replay must identify its one source or replacement human");
      const sourceAssistant = own(metadata, "regenerate_from_message_id");
      if (typeof sourceAssistant !== "string" || !sourceAssistant)
        fail("replay source assistant identity is missing");
      if (identity.kind === "regenerate" && sourceAssistant !== identity.source)
        fail("regenerate source assistant belongs to another request");
      if (identity.kind === "edit") {
        if (own(metadata, "edit_from_message_id") !== identity.source)
          fail("edit source human belongs to another request");
        const group = own(metadata, "edit_version_group_id");
        if (typeof group !== "string" || !group)
          fail("edit version group identity is missing");
        for (const source of [identity.source, sourceAssistant])
          if (
            !rows.some(
              (row) =>
                row.event === "replay.source" && row.values.raw === source,
            )
          )
            fail("edit source references omit the selected turn");
      }
      if (
        identity.kind === "edit" &&
        (typeof replacement !== "string" ||
          !replacement ||
          matchingReplacement !== 1 ||
          own(metadata, "edit_message_id") !== replacement)
      )
        fail("edit replacement identity disagrees with input or metadata");
      if (
        rows.reduce((sum, row) => sum + textSize(row.values), 0) > 1_048_576
      ) {
        fail("replay identity text evidence capacity exceeded");
        return;
      }
      for (const row of rows) emit(row.event, row.values);
    } catch {
      fail("replay identity snapshot is unreadable");
    } finally {
      emit("replay.snapshot", {
        phase,
        complete,
        messageCount,
        sourceCount,
        sourcesType,
      });
    }
  }

  return {
    bindRunInput: (input: object, assistant: string) =>
      bindRunInput(input, observer, origin, identity.thread, assistant),
    response: (prepared: unknown) => snapshot("response", prepared),
    adopt: () => emit("replay.adopt", {}),
    attempt: (prepared: unknown, assistant: string) => {
      snapshot("attempt", prepared);
      if (typeof assistant === "string" && assistant.length <= 1_048_576)
        emit("replay.submission", { assistant });
      else invalid("replay submission assistant is malformed");
    },
    idempotency: (raw: string) => {
      if (
        typeof raw === "string" &&
        raw.length + identity.thread.length <= 1_048_576
      )
        emit("idempotency.allocate", { raw, thread: identity.thread });
      else invalid("replay idempotency evidence capacity exceeded");
    },
    retire: () => emit("replay.retire", {}),
    failure: (status: "exception" | "failed" | "cancelled" = "exception") =>
      emit("replay.failure", { status }),
    finish: (current: boolean) => emit("replay.finish", { current }),
  };
}
