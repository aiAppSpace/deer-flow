import { describe, expect, it } from "vitest";
import {
  identifyEndpoint,
  identityBodySlots,
  decodeIdentitySegment,
} from "../../e2e-parity/support/identity-slots";
import { projectUrl, projectBody } from "../../e2e-parity/support/wire-values";
const base = "https://app.test";
function endpoint(method: string, path: string) {
  return identifyEndpoint(method, projectUrl(base + path, base)!);
}
function body(text: string) {
  const result = projectBody(Buffer.from(text), "application/json").body;
  if (result[0] !== "json") throw new Error("fixture JSON not projected");
  return result[1];
}

describe("explicit identity endpoint and field slots", () => {
  it.each([
    ["GET", "/api/threads/T/uploads/limits", [[3, "thread"]]],
    ["GET", "/api/threads/T/uploads/list", [[3, "thread"]]],
    ["POST", "/api/threads/T/uploads", [[3, "thread"]]],
    ["GET", "/api/langgraph/threads/T/runs", [[4, "thread"]]],
    ["GET", "/api/threads/T/scheduled-tasks", [[3, "thread"]]],
    ["GET", "/api/threads/T/scheduled-task-events", [[3, "thread"]]],
    [
      "GET",
      "/api/threads/T/runs/R/workspace-changes",
      [
        [3, "thread"],
        [5, "run"],
      ],
    ],
    ["PATCH", "/api/langgraph/threads/T", [[4, "thread"]]],
    [
      "GET",
      "/api/langgraph/threads/T/runs/R/stream",
      [
        [4, "thread"],
        [6, "run"],
      ],
    ],
    [
      "POST",
      "/api/langgraph/threads/T/runs/R/cancel",
      [
        [4, "thread"],
        [6, "run"],
      ],
    ],
  ] as const)(
    "recognizes only the audited path positions: %s %s",
    (method, path, positions) => {
      expect(
        endpoint(method, path)?.pathSlots.map((slot) => [
          slot.index,
          slot.kind,
        ]),
      ).toEqual(positions);
    },
  );

  it.each([
    ["DELETE", "/api/threads/T/uploads/limits"],
    ["GET", "/api/threads/T/uploads/limits/"],
    ["GET", "/api/threads/T/uploads/limits/more"],
    ["GET", "/api/mock/threads/T/uploads/limits"],
    ["GET", "/api/threads//uploads/limits"],
    ["GET", "/api/langgraph/threads/T/checkpoints/R"],
    ["POST", "/api/threads/T/runs/R/cancel"],
  ])("never widens an endpoint family: %s %s", (method, path) =>
    expect(endpoint(method, path)).toBeNull(),
  );

  it("does not authorize an external origin with the same API path", () => {
    const url = projectUrl(
      "https://other.test/api/threads/T/uploads/limits",
      base,
    )!;
    expect(identifyEndpoint("GET", url)).toBeNull();
  });

  it("preserves query bytes and path spellings instead of normalizing while matching", () => {
    const url = projectUrl(
      base + "/api/langgraph/threads/T/runs/R/cancel?wait=1&x=%2f&x=%2F",
      base,
    )!;
    const original = JSON.stringify(url);
    expect(identifyEndpoint("POST", url)).not.toBeNull();
    expect(JSON.stringify(url)).toBe(original);
    expect(decodeIdentitySegment("a%2Fb")).toEqual({
      raw: "a/b",
      canonical: true,
    });
    expect(decodeIdentitySegment("a%2fb")).toEqual({
      raw: "a/b",
      canonical: false,
    });
    expect(decodeIdentitySegment("a%252Fb")).toEqual({
      raw: "a%2Fb",
      canonical: true,
    });
    expect(decodeIdentitySegment("broken%Q1")).toEqual({
      raw: null,
      canonical: false,
    });
  });

  it("only exposes explicit message ID positions, leaving content and unknown own keys untouched", () => {
    const wire = body(
      '{"input":{"messages":[{"id":"same","content":"same","extra":{"id":"same"}},{"id":"assistant","role":"assistant"}]},"unknown":{"id":"same"},"__proto__":{"id":"same"}}',
    );
    const before = JSON.stringify(wire);
    const plan = endpoint("POST", "/api/langgraph/threads/T/runs/stream")!;
    expect(
      identityBodySlots(plan, wire).map((slot) => [
        slot.path,
        slot.role,
        slot.value,
      ]),
    ).toEqual([
      [["input", "messages", 0, "id"], "input-message", ["string", "same"]],
      [
        ["input", "messages", 1, "id"],
        "input-message",
        ["string", "assistant"],
      ],
    ]);
    // A slot is a possible reference, not admission that an assistant is human.
    expect(JSON.stringify(wire)).toBe(before);
  });

  it("separates replay source, replacement, assistant and run roles", () => {
    const plan = endpoint("POST", "/api/langgraph/threads/T/runs/stream")!;
    const wire = body(
      '{"metadata":{"edit_message_id":"replacement","edit_from_message_id":"old-human","regenerate_from_run_id":"old-run","regenerate_from_message_id":"assistant","regenerate_checkpoint_id":"checkpoint","edit_version_group_id":"group"}}',
    );
    expect(
      identityBodySlots(plan, wire)
        .map((slot) => slot.role)
        .sort(),
    ).toEqual(
      [
        "replacement-human",
        "source-human",
        "source-run",
        "source-assistant",
        "checkpoint",
        "version-group",
      ].sort(),
    );
    expect(
      identityBodySlots(
        endpoint("POST", "/api/threads/T/runs/edit-regenerate/prepare")!,
        body('{"human_message_id":"old","replacement_text":"old"}'),
      ).map((slot) => slot.path),
    ).toEqual([["human_message_id"]]);
  });

  it("Memory uses the original array index without touching contents or missing IDs", () => {
    const wire = body(
      '{"facts":[{"content":"literal"},{"id":"generated","content":"generated"},{"id":"existing","content":"same"}],"other":{"id":"generated"}}',
    );
    expect(
      identityBodySlots(endpoint("POST", "/api/memory/import")!, wire).map(
        (slot) => [slot.path, slot.role],
      ),
    ).toEqual([
      [["facts", 1, "id"], "import-fact"],
      [["facts", 2, "id"], "import-fact"],
    ]);
  });

  it("array slots do not traverse objects masquerading as array indices", () => {
    const wire = body('{"facts":{"0":{"id":"fake"}},"id":"fake"}');
    expect(
      identityBodySlots(endpoint("POST", "/api/memory/import")!, wire),
    ).toEqual([]);
  });

  it("create request fields and protocol headers have different roles", () => {
    expect(
      identityBodySlots(
        endpoint("POST", "/api/threads")!,
        body(
          '{"thread_id":"T","project_id":"P","metadata":{"thread_id":"literal"}}',
        ),
      ).map((slot) => slot.path),
    ).toEqual([["thread_id"]]);
    const submit = endpoint("POST", "/api/langgraph/threads/T/runs/stream")!;
    expect(submit.headerSlots).toEqual([
      { name: "idempotency-key", role: "submission-key" },
    ]);
    expect(submit.responseSlot).toBe("run-location");
    expect(
      endpoint("GET", "/api/langgraph/threads/T/runs/R/stream")?.headerSlots,
    ).toEqual([{ name: "last-event-id", role: "cursor" }]);
  });
});

describe("complete audited endpoint table", () => {
  it.each([
    ["GET", "/api/threads/T/uploads/limits", "uploads-limits", [[3, "thread"]]],
    ["GET", "/api/threads/T/uploads/list", "uploads-list", [[3, "thread"]]],
    ["POST", "/api/threads/T/uploads", "upload", [[3, "thread"]]],
    ["POST", "/api/threads", "thread-create", []],
    ["POST", "/api/langgraph/threads", "thread-create", []],
    ["GET", "/api/langgraph/threads/T", "thread-read", [[4, "thread"]]],
    ["PATCH", "/api/langgraph/threads/T", "thread-update", [[4, "thread"]]],
    ["GET", "/api/langgraph/threads/T/state", "thread-state", [[4, "thread"]]],
    [
      "POST",
      "/api/langgraph/threads/T/history",
      "thread-history",
      [[4, "thread"]],
    ],
    ["GET", "/api/threads/T/messages/page", "thread-messages", [[3, "thread"]]],
    [
      "GET",
      "/api/threads/T/token-usage",
      "thread-token-usage",
      [[3, "thread"]],
    ],
    ["GET", "/api/langgraph/threads/T/runs", "thread-runs", [[4, "thread"]]],
    [
      "GET",
      "/api/threads/T/scheduled-tasks",
      "thread-scheduled-tasks",
      [[3, "thread"]],
    ],
    [
      "GET",
      "/api/threads/T/scheduled-task-events",
      "thread-scheduled-events",
      [[3, "thread"]],
    ],
    [
      "GET",
      "/api/threads/T/runs/R/workspace-changes",
      "run-workspace-changes",
      [
        [3, "thread"],
        [5, "run"],
      ],
    ],
    [
      "POST",
      "/api/langgraph/threads/T/runs/stream",
      "run-submit",
      [[4, "thread"]],
    ],
    [
      "POST",
      "/api/threads/T/runs/regenerate/prepare",
      "regenerate-prepare",
      [[3, "thread"]],
    ],
    [
      "POST",
      "/api/threads/T/runs/edit-regenerate/prepare",
      "edit-prepare",
      [[3, "thread"]],
    ],
    [
      "GET",
      "/api/langgraph/threads/T/runs/R/stream",
      "run-stream",
      [
        [4, "thread"],
        [6, "run"],
      ],
    ],
    [
      "GET",
      "/api/langgraph/threads/T/runs/R",
      "run-inspect",
      [
        [4, "thread"],
        [6, "run"],
      ],
    ],
    [
      "POST",
      "/api/langgraph/threads/T/runs/R/cancel",
      "run-cancel",
      [
        [4, "thread"],
        [6, "run"],
      ],
    ],
    ["POST", "/api/memory/import", "memory-import", []],
  ] as const)(
    "keeps the full contract of %s %s",
    (method, path, operation, pathSlots) => {
      expect(endpoint(method, path)).toEqual({
        operation,
        pathSlots: pathSlots.map(([index, kind]) => ({ index, kind })),
        headerSlots:
          operation === "run-submit"
            ? [{ name: "idempotency-key", role: "submission-key" }]
            : operation === "run-stream"
              ? [{ name: "last-event-id", role: "cursor" }]
              : [],
        responseSlot: operation === "run-submit" ? "run-location" : null,
      });
    },
  );
  it("does not decode constant path segments or accept different casing", () => {
    for (const path of [
      "/api/%74hreads/T/uploads/limits",
      "/API/threads/T/uploads/limits",
      "/api/threads/T/uploads/%6cimits",
    ]) {
      const url = projectUrl(base + path, base);
      expect(url ? identifyEndpoint("GET", url) : null).toBeNull();
    }
  });
  it("identifies old assistant and create-thread values without asserting their kind is admitted", () => {
    expect(
      identityBodySlots(
        endpoint("POST", "/api/threads/T/runs/regenerate/prepare")!,
        body('{"message_id":"assistant","other":{"message_id":"literal"}}'),
      ),
    ).toEqual([
      {
        path: ["message_id"],
        role: "source-assistant",
        value: ["string", "assistant"],
      },
    ]);
    expect(
      identityBodySlots(
        endpoint("POST", "/api/langgraph/threads")!,
        body('{"thread_id":7}'),
      ),
    ).toEqual([
      { path: ["thread_id"], role: "thread", value: ["number", "7"] },
    ]);
    expect(
      identityBodySlots(
        endpoint("POST", "/api/langgraph/threads")!,
        body('[{"thread_id":"wrong-container"}]'),
      ),
    ).toEqual([]);
    expect(
      identityBodySlots(
        endpoint("POST", "/api/memory/import")!,
        body('{"facts":[{"id":null},{"id":{"literal":"value"}}]}'),
      ).map((slot) => slot.value),
    ).toEqual([["null"], ["object", [["literal", ["string", "value"]]]]]);
  });
});
