import { fixture } from "./identity-fixtures";
import type { IdentityPacket } from "../../e2e-parity/support/identity-receipts";
import type { RequestObservation } from "../../e2e-parity/support/capture-network";

export function humanFixture(
  vue = false,
  keySource: "none" | "default" | "explicit" = vue ? "default" : "none",
  explicitKey = "caller-key",
) {
  const input = fixture(vue);
  input.expectations.threads[0]!.adoption = "same-raw";
  input.expectations.humans = [
    {
      slot: "first-human",
      threadSlot: "initial-entry",
      assistant: "lead_agent",
      source: {
        producer: vue ? "human:composer" : "human:send",
        actions: [vue ? "compose" : "send"],
      },
      submission: {
        slot: "first-send",
        actions: ["send"],
        ...(keySource === "explicit"
          ? { keySource, key: explicitKey }
          : { keySource }),
      },
    },
  ];
  const human = "source-human-id";
  const key =
    keySource === "none" ? null : keySource === "default" ? human : explicitKey;
  const emit = (
    event: string,
    values: IdentityPacket["values"],
    producer = "human:send",
    instance = 3,
    action = "send",
    at = 1900,
  ) => {
    input.event(event, values, at);
    const row = input.identity.receipts.at(-1)!;
    Object.assign(row.packet!, { producer, instance, action });
    row.action = action;
    row.dispatchedAt = at + input.identity.receipts.length;
    return row.packet!;
  };
  if (vue)
    emit(
      "human.allocate",
      { raw: human, thread: input.raw },
      "human:composer",
      2,
      "compose",
      1800,
    );
  emit(vue ? "human.reuse" : "human.allocate", {
    raw: human,
    thread: input.raw,
  });
  const submission = emit("human.submission", {
    raw: human,
    thread: input.raw,
    index: 0,
    messageCount: 1,
    keySource,
    key,
  });
  if (vue)
    emit(
      "thread.prepared",
      { raw: input.raw, prepared: input.raw },
      "thread:main",
      1,
      "send",
      1950,
    );
  emit(
    "thread.select",
    {
      ...input.scope,
      path: `/workspace/chats/${input.raw}`,
      raw: input.raw,
      draft: false,
      mock: false,
    },
    "thread:main",
    1,
    "send",
    2000,
  );
  emit("lease.retire", { lease: 1, epoch: 1 }, "thread:main", 1, "send", 2010);
  emit(
    "lease.select",
    {
      ...input.scope,
      path: `/workspace/chats/${input.raw}`,
      raw: input.raw,
      allocation: 0,
      lease: 2,
      epoch: 1,
    },
    "thread:main",
    1,
    "send",
    2020,
  );
  const body = {
    assistant_id: "lead_agent",
    context: {} as Record<string, unknown>,
    input: {
      messages: [
        {
          id: human,
          type: "human",
          content: human,
          additional_kwargs: { same: human },
        },
      ],
    },
  };
  const request: RequestObservation = {
    ...input.network.requests[0]!,
    sequence: 1,
    method: "POST",
    startedAt: 2200,
    url: `${input.appBase}/api/langgraph/threads/${input.raw}/runs/stream`,
    headers: {
      ...input.network.requests[0]!.headers,
      "content-type": "application/json",
      "idempotency-key": key || null,
    },
    bodyBase64: Buffer.from(JSON.stringify(body)).toString("base64"),
  };
  input.network.requests.push(request);
  const updateBody = () => {
    request.bodyBase64 = Buffer.from(JSON.stringify(body)).toString("base64");
  };
  return { ...input, human, emit, submission, body, request, updateBody };
}
