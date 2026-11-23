import type { JsonWire, WireUrl } from "./wire-values";

export type IdentityRole =
  | "thread"
  | "input-message"
  | "source-human"
  | "replacement-human"
  | "source-assistant"
  | "source-run"
  | "checkpoint"
  | "version-group"
  | "import-fact";

type BodyRule = {
  path: readonly string[];
  role: IdentityRole;
};

const createBody: readonly BodyRule[] = [
  { path: ["thread_id"], role: "thread" },
];
const submitBody: readonly BodyRule[] = [
  { path: ["input", "messages", "*", "id"], role: "input-message" },
  { path: ["metadata", "edit_message_id"], role: "replacement-human" },
  { path: ["metadata", "edit_from_message_id"], role: "source-human" },
  { path: ["metadata", "regenerate_from_run_id"], role: "source-run" },
  {
    path: ["metadata", "regenerate_from_message_id"],
    role: "source-assistant",
  },
  { path: ["metadata", "regenerate_checkpoint_id"], role: "checkpoint" },
  { path: ["metadata", "edit_version_group_id"], role: "version-group" },
];

// Each row names one audited method/path. This is deliberately not a family
// matcher: an unlisted method, trailing segment or proxy prefix stays literal.
const endpoints = [
  ["GET", "/api/threads/:thread/uploads/limits", "uploads-limits"],
  ["GET", "/api/threads/:thread/uploads/list", "uploads-list"],
  ["POST", "/api/threads/:thread/uploads", "upload"],
  ["POST", "/api/threads", "thread-create"],
  ["POST", "/api/langgraph/threads", "thread-create"],
  ["GET", "/api/langgraph/threads/:thread", "thread-read"],
  ["PATCH", "/api/langgraph/threads/:thread", "thread-update"],
  ["GET", "/api/langgraph/threads/:thread/state", "thread-state"],
  ["POST", "/api/langgraph/threads/:thread/history", "thread-history"],
  ["GET", "/api/threads/:thread/messages/page", "thread-messages"],
  ["GET", "/api/threads/:thread/token-usage", "thread-token-usage"],
  ["GET", "/api/langgraph/threads/:thread/runs", "thread-runs"],
  ["GET", "/api/threads/:thread/scheduled-tasks", "thread-scheduled-tasks"],
  [
    "GET",
    "/api/threads/:thread/scheduled-task-events",
    "thread-scheduled-events",
  ],
  [
    "GET",
    "/api/threads/:thread/runs/:run/workspace-changes",
    "run-workspace-changes",
  ],
  ["POST", "/api/langgraph/threads/:thread/runs/stream", "run-submit"],
  [
    "POST",
    "/api/threads/:thread/runs/regenerate/prepare",
    "regenerate-prepare",
  ],
  ["POST", "/api/threads/:thread/runs/edit-regenerate/prepare", "edit-prepare"],
  ["GET", "/api/langgraph/threads/:thread/runs/:run/stream", "run-stream"],
  ["GET", "/api/langgraph/threads/:thread/runs/:run", "run-inspect"],
  ["POST", "/api/langgraph/threads/:thread/runs/:run/cancel", "run-cancel"],
  ["POST", "/api/memory/import", "memory-import"],
] as const;

export type EndpointSlots = {
  operation: (typeof endpoints)[number][2];
  pathSlots: { index: number; kind: "thread" | "run" }[];
  headerSlots: {
    name: "idempotency-key" | "last-event-id";
    role: "submission-key" | "cursor";
  }[];
  responseSlot: "run-location" | null;
};

/** Recognition is not admission. Only a separate source/owner proof may turn
 * a value at one of these positions into an identity reference. */
export function identifyEndpoint(
  method: string,
  url: WireUrl,
): EndpointSlots | null {
  if (url.origin[0] !== "app") return null;
  for (const [verb, pattern, operation] of endpoints) {
    if (method !== verb) continue;
    const parts = pattern.split("/");
    if (parts.length !== url.path.length) continue;
    const pathSlots: EndpointSlots["pathSlots"] = [];
    const matches = parts.every((part, index) => {
      if (part === ":thread" || part === ":run") {
        if (!url.path[index]) return false;
        pathSlots.push({ index, kind: part === ":thread" ? "thread" : "run" });
        return true;
      }
      return part === url.path[index];
    });
    if (!matches) continue;
    return {
      operation,
      pathSlots,
      headerSlots:
        operation === "run-submit"
          ? [{ name: "idempotency-key", role: "submission-key" }]
          : operation === "run-stream"
            ? [{ name: "last-event-id", role: "cursor" }]
            : [],
      responseSlot: operation === "run-submit" ? "run-location" : null,
    };
  }
  return null;
}

/** Decode exactly once; a noncanonical spelling cannot be silently washed by
 * identity replacement. The caller must retain the original path bytes. */
export function decodeIdentitySegment(segment: string): {
  raw: string | null;
  canonical: boolean;
} {
  try {
    const raw = decodeURIComponent(segment);
    return { raw, canonical: encodeURIComponent(raw) === segment };
  } catch {
    return { raw: null, canonical: false };
  }
}

export type IdentityBodySlot = {
  path: (string | number)[];
  role: IdentityRole;
  value: JsonWire;
};

export function identityBodySlots(
  plan: EndpointSlots,
  body: JsonWire,
): IdentityBodySlot[] {
  let rules: readonly BodyRule[] = [];
  switch (plan.operation) {
    case "thread-create":
      rules = createBody;
      break;
    case "run-submit":
      rules = submitBody;
      break;
    case "regenerate-prepare":
      rules = [{ path: ["message_id"], role: "source-assistant" }];
      break;
    case "edit-prepare":
      rules = [{ path: ["human_message_id"], role: "source-human" }];
      break;
    case "memory-import":
      rules = [{ path: ["facts", "*", "id"], role: "import-fact" }];
      break;
  }
  const slots: IdentityBodySlot[] = [];
  for (const rule of rules) {
    const visit = (
      node: JsonWire,
      depth: number,
      path: (string | number)[],
    ) => {
      if (depth === rule.path.length) {
        slots.push({ path, role: rule.role, value: node });
        return;
      }
      const key = rule.path[depth]!;
      if (key === "*") {
        if (node[0] === "array")
          node[1].forEach((item, index) =>
            visit(item, depth + 1, [...path, index]),
          );
      } else if (node[0] === "object") {
        const entry = node[1].find(([name]) => name === key);
        if (entry) visit(entry[1], depth + 1, [...path, key]);
      }
    };
    visit(body, 0, []);
  }
  return slots;
}
