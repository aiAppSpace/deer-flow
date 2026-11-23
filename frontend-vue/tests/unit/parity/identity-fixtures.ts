import type { IdentityExpectations } from "../../e2e-parity/support/identity-registry";
import type {
  IdentityPacket,
  IdentityReceipt,
  IdentitySnapshot,
} from "../../e2e-parity/support/identity-receipts";
import type { NetworkSnapshot } from "../../e2e-parity/support/capture-network";
import type { FreshPageSnapshot } from "../../e2e-parity/support/capture-page";

export function fixture(candidate = false) {
  const appBase = "https://app.test";
  const raw = "actual-random-thread";
  const scope = {
    account: "fixture-account",
    projectIntent: null,
    agent: null,
    path: "/workspace/chats/new",
  };
  const expectations: IdentityExpectations = {
    scenario: "chat",
    state: "",
    dimension: ["desktop", "light", "en-US"],
    threads: [
      {
        slot: "initial-entry",
        producer: "thread:main",
        ...scope,
        source: {
          kind: "allocation",
          reason: "initial",
          actions: ["entry", "settle:0"],
        },
        requireUploadsLimits: true,
      },
    ],
  };
  const receipts: IdentityReceipt[] = [];
  function event(name: string, values: IdentityPacket["values"], at = 1100) {
    const action = candidate ? "settle:0" : "entry";
    receipts.push({
      version: 1,
      capture: "capture",
      document: "document",
      origin: appBase,
      generation: 1,
      sequence: receipts.length,
      dispatchedAt: 1200 + receipts.length,
      action,
      kind: "event",
      packet: {
        version: 1,
        capture: "capture",
        action,
        at,
        instance: 1,
        producer: "thread:main",
        event: name,
        values,
      },
    });
  }
  receipts.push({
    version: 1,
    capture: "capture",
    document: "document",
    origin: appBase,
    generation: 1,
    sequence: 0,
    dispatchedAt: 900,
    action: "entry",
    kind: "open",
  });
  if (candidate)
    event("uploads.limits", { lease: 1, epoch: 0, raw, state: "candidate" });
  event(
    "thread.allocate",
    { allocation: 0, raw, reason: "initial", ...scope },
    1000,
  );
  event("thread.select", { raw, draft: true, mock: false, ...scope });
  event("lease.select", { lease: 1, epoch: 1, allocation: 0, raw, ...scope });
  // React can publish its passive binding after its layout selection.
  event("thread.bind", { allocation: 0, raw, project: null });
  if (!candidate)
    event("uploads.limits", { lease: 1, epoch: 1, raw, state: "selected" });
  const network: NetworkSnapshot = {
    errors: [],
    requests: [
      {
        sequence: 0,
        observedAt: 9999,
        source: "main-frame",
        navigation: false,
        startedAt: 1250,
        timingObservedOn: "response",
        method: "GET",
        url: `${appBase}/api/threads/${raw}/uploads/limits`,
        headers: {
          "content-type": null,
          accept: "application/json",
          "idempotency-key": null,
          "last-event-id": null,
        },
        bodyBase64: null,
        response: {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-location": null,
          },
        },
        finished: true,
        failure: null,
      },
    ],
  };
  const identity: IdentitySnapshot = {
    capture: "capture",
    complete: true,
    errors: [],
    receipts,
    expectedDocuments: [
      { document: "document", generation: 1, action: "entry" },
    ],
  };
  const freshPage: FreshPageSnapshot = {
    kind: "owned-fresh-page",
    ready: true,
    errors: [],
  };
  return {
    appBase,
    network,
    identity,
    freshPage,
    expectations,
    event,
    raw,
    scope,
  };
}
export function packet(input: ReturnType<typeof fixture>, name: string) {
  return input.identity.receipts.find((r) => r.packet?.event === name)!.packet!;
}

export function literalFixture() {
  const input = fixture();
  input.expectations.threads[0]!.source = {
    kind: "literal",
    raw: input.raw,
    draft: false,
    mock: false,
  };
  const retained = input.identity.receipts.filter(
    (row) =>
      !["thread.allocate", "thread.bind"].includes(row.packet?.event ?? ""),
  );
  input.identity.receipts.splice(
    0,
    input.identity.receipts.length,
    ...retained,
  );
  input.identity.receipts.forEach((row, sequence) => {
    row.sequence = sequence;
  });
  packet(input, "thread.select").values.draft = false;
  packet(input, "lease.select").values.allocation = null;
  return input;
}
