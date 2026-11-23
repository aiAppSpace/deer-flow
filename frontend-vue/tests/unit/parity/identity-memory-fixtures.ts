import { fixture } from "./identity-fixtures";
import type { IdentityPacket } from "../../e2e-parity/support/identity-receipts";
import type { RequestObservation } from "../../e2e-parity/support/capture-network";

export function memoryFixture(
  mode: "import" | "preview" | "cancel" | "rejected" | "retry" = "import",
  kinds: readonly ("generated" | "literal")[] = ["generated", "literal"],
) {
  const input = fixture();
  const raws = kinds.map((kind, index) =>
    kind === "generated" ? `generated-${index}` : `literal-${index}`,
  );
  input.expectations.memory = {
    account: "fixture-account",
    stableAccount: true,
    file:
      mode === "rejected"
        ? null
        : {
            slot: "selected-file",
            choiceActions: ["file"],
            facts: kinds.map((kind, index) => ({
              index,
              source:
                kind === "generated" ? { kind } : { kind, raw: raws[index]! },
            })),
          },
    dispatchActions:
      mode === "import"
        ? ["confirm"]
        : mode === "retry"
          ? ["confirm-1", "confirm-2"]
          : [],
    terminal:
      mode === "preview"
        ? "active"
        : mode === "rejected"
          ? "absent"
          : "retired",
  };
  const emit = (
    event: string,
    values: IdentityPacket["values"],
    action = "file",
    at = 1800,
    instance = 5,
    producer = "memory:import",
  ) => {
    input.event(event, values, at);
    const row = input.identity.receipts.at(-1)!;
    Object.assign(row.packet!, { producer, instance, action });
    row.action = action;
    row.dispatchedAt = at + input.identity.receipts.length;
    return row;
  };
  const body = {
    facts: raws.map((raw) => ({
      id: raw,
      content: raw,
      category: "context",
      unknown: { id: raw },
    })),
  };
  const requests: RequestObservation[] = [];
  const addRequest = (startedAt: number, status = 200) => {
    const row: RequestObservation = {
      ...structuredClone(input.network.requests[0]!),
      sequence: input.network.requests.length,
      method: "POST",
      url: `${input.appBase}/api/memory/import`,
      startedAt,
      bodyBase64: Buffer.from(JSON.stringify(body)).toString("base64"),
      headers: {
        ...input.network.requests[0]!.headers,
        "content-type": "application/json",
      },
      response: {
        status,
        headers: {
          "content-type": "application/json",
          "content-location": null,
        },
      },
    };
    input.network.requests.push(row);
    requests.push(row);
    return row;
  };
  if (mode !== "rejected") {
    emit("memory.choice", { factCount: kinds.length });
    kinds.forEach((kind, index) =>
      emit("memory.fact", {
        index,
        raw: raws[index]!,
        generated: kind === "generated",
      }),
    );
    emit("memory.select", { factCount: kinds.length }, "preview", 1900);
    if (mode === "import" || mode === "retry") {
      emit(
        "memory.dispatch",
        { state: "selected", preAborted: false },
        mode === "retry" ? "confirm-1" : "confirm",
        2000,
      );
      addRequest(2100, mode === "retry" ? 503 : 200);
      if (mode === "retry") {
        emit(
          "memory.dispatch",
          { state: "selected", preAborted: false },
          "confirm-2",
          2200,
        );
        addRequest(2300);
      }
    }
    if (mode !== "preview") emit("memory.retire", {}, "close", 2400);
  }
  const updateBodies = () => {
    for (const row of requests)
      row.bodyBase64 = Buffer.from(JSON.stringify(body)).toString("base64");
  };
  return { ...input, emit, raws, body, requests, addRequest, updateBodies };
}
