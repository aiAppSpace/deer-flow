import { literalFixture } from "./identity-fixtures";
import type { RequestObservation } from "../../e2e-parity/support/capture-network";
import type { ReplaySourceExpectation } from "../../e2e-parity/support/identity-replay-source";
import type { RegistryEvent } from "../../e2e-parity/support/identity-registry";
import type { IdentityPacket } from "../../e2e-parity/support/identity-receipts";

export function replaySourceFixture(
  kind: "edit" | "regenerate" = "edit",
  vue = true,
) {
  const expected: ReplaySourceExpectation = {
    kind,
    thread: "persisted-thread",
    agent: null,
    assistant: "lead_agent",
    actions: ["submit-replay"],
    sourceHuman: "source-human",
    wireHuman: "source-human",
    sourceAssistant: "source-assistant",
    oldRun: "old-run",
    checkpoint: "checkpoint-before-source",
    versionGroup: kind === "edit" ? "existing-version-group" : null,
    sources:
      kind === "edit"
        ? { type: "array", ids: ["source-human", "source-assistant"] }
        : { type: "absent" },
    key: vue ? "generated" : "none",
  };
  const events: RegistryEvent[] = [];
  const add = (event: string, values: IdentityPacket["values"]) => {
    const row: RegistryEvent = {
      owner: '["document","replay",3]',
      sequence: events.length + 10,
      dispatchedAt: 1100 + events.length,
      packet: {
        version: 1,
        capture: "capture",
        instance: 3,
        producer: "replay",
        action: "submit-replay",
        at: 1000,
        event,
        values,
      },
    };
    events.push(row);
    return row;
  };
  add("replay.begin", {
    kind,
    thread: expected.thread,
    source: kind === "edit" ? expected.sourceHuman : expected.sourceAssistant,
    agent: null,
  });
  function phase(name: string) {
    const refs = {
      target_run_id: "old-run",
      replacement_human_message_id:
        kind === "edit" ? "new-replacement-human" : null,
      "checkpoint.checkpoint_id": "checkpoint-before-source",
      "metadata.edit_message_id":
        kind === "edit" ? "new-replacement-human" : null,
      "metadata.edit_from_message_id": kind === "edit" ? "source-human" : null,
      "metadata.edit_version_group_id":
        kind === "edit" ? "existing-version-group" : null,
      "metadata.regenerate_from_run_id": "old-run",
      "metadata.regenerate_from_message_id": "source-assistant",
      "metadata.regenerate_checkpoint_id": "checkpoint-before-source",
    };
    for (const [slot, raw] of Object.entries(refs))
      add("replay.reference", {
        phase: name,
        slot,
        raw,
        valueType: raw === null ? "absent" : "string",
      });
    add("replay.message", {
      phase: name,
      index: 0,
      type: "human",
      role: null,
      idPresent: true,
      raw: kind === "edit" ? "new-replacement-human" : "source-human",
    });
    if (kind === "edit")
      ["source-human", "source-assistant"].forEach((raw, index) =>
        add("replay.source", { phase: name, index, raw }),
      );
    add("replay.snapshot", {
      phase: name,
      complete: true,
      messageCount: 1,
      sourceCount: kind === "edit" ? 2 : 0,
      sourcesType: kind === "edit" ? "array" : "absent",
    });
  }
  phase("response");
  add("replay.adopt", {});
  if (vue)
    add("idempotency.allocate", {
      raw: "independent-submission-key",
      thread: expected.thread,
    });
  phase("attempt");
  add("replay.submission", { assistant: "lead_agent" });
  add("replay.finish", { current: true });
  const find = (name: string, phaseName?: string) =>
    events.find(
      ({ packet }) =>
        packet.event === name &&
        (!phaseName || packet.values.phase === phaseName),
    )!;
  return { events, expected, find, add };
}

export function replayRegistryFixture(
  kind: "edit" | "regenerate" = "edit",
  vue = true,
) {
  const input = literalFixture();
  const source = replaySourceFixture(kind, vue);
  input.expectations.replay = {
    slot: "replay-selected-turn",
    threadSlot: "initial-entry",
    account: input.scope.account,
    stableAccount: true,
    source: source.expected,
    replacementText: kind === "edit" ? "Revised question" : null,
  };
  for (const [index, row] of source.events.entries()) {
    const packet = structuredClone(row.packet);
    packet.at += 1000;
    if (
      packet.event === "replay.begin" ||
      packet.event === "idempotency.allocate"
    )
      packet.values.thread = input.raw;
    input.identity.receipts.push({
      version: 1,
      capture: "capture",
      document: "document",
      origin: input.appBase,
      generation: 1,
      sequence: input.identity.receipts.length,
      dispatchedAt: 2100 + index,
      action: "submit-replay",
      kind: "event",
      packet,
    });
  }
  const prepareBody =
    kind === "edit"
      ? {
          human_message_id: "source-human",
          replacement_text: "Revised question",
        }
      : { message_id: "source-assistant" };
  const body = {
    assistant_id: "lead_agent",
    context: {} as Record<string, unknown>,
    input: {
      messages: [
        {
          id: kind === "edit" ? "new-replacement-human" : "source-human",
          type: "human",
          content: "Literal source-human text",
          additional_kwargs: { example: "new-replacement-human" },
        },
      ],
    },
    checkpoint: {
      checkpoint_id: "checkpoint-before-source",
      checkpoint_ns: "",
      checkpoint_map: null,
    },
    metadata: {
      regenerate_from_message_id: "source-assistant",
      regenerate_from_run_id: "old-run",
      regenerate_checkpoint_id: "checkpoint-before-source",
      ...(kind === "edit"
        ? {
            replay_kind: "edit",
            edit_from_message_id: "source-human",
            edit_message_id: "new-replacement-human",
            edit_version_group_id: "existing-version-group",
          }
        : {}),
    } as Record<string, unknown>,
  };
  const prepare: RequestObservation = {
    ...structuredClone(input.network.requests[0]!),
    sequence: 1,
    method: "POST",
    startedAt: 2100.5,
    url: `${input.appBase}/api/threads/${input.raw}/runs/${kind === "edit" ? "edit-regenerate" : "regenerate"}/prepare`,
    headers: {
      ...input.network.requests[0]!.headers,
      "content-type": "application/json",
    },
    bodyBase64: Buffer.from(JSON.stringify(prepareBody)).toString("base64"),
  };
  const run: RequestObservation = {
    ...structuredClone(prepare),
    sequence: 2,
    startedAt: 2200,
    url: `${input.appBase}/api/langgraph/threads/${input.raw}/runs/stream`,
    headers: {
      ...prepare.headers,
      "idempotency-key": vue ? "independent-submission-key" : null,
    },
    bodyBase64: Buffer.from(JSON.stringify(body)).toString("base64"),
    response: {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "content-location": `/api/threads/${input.raw}/runs/new-run`,
      },
    },
  };
  input.network.requests.push(prepare, run);
  const update = () => {
    prepare.bodyBase64 = Buffer.from(JSON.stringify(prepareBody)).toString(
      "base64",
    );
    run.bodyBase64 = Buffer.from(JSON.stringify(body)).toString("base64");
  };
  return { ...input, prepareBody, body, prepare, run, update };
}
