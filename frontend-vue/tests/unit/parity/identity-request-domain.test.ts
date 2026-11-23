import { describe, expect, it } from "vitest";
import {
  inventorySubmissionRequests,
  assignSubmissionRequests,
  type SubmissionOwner,
} from "../../e2e-parity/support/identity-request-domain";
import { humanFixture } from "./identity-human-fixtures";

function fixture() {
  const f = humanFixture();
  f.network.requests = [f.request];
  const owner: SubmissionOwner = {
    kind: "human",
    slot: "first-send",
    thread: f.raw,
  };
  const inventory = () => inventorySubmissionRequests(f.network, f.appBase);
  const assign = (owners: SubmissionOwner[] = [owner]) =>
    assignSubmissionRequests(inventory(), owners);
  return { ...f, owner, inventory, assign };
}
describe("shared complete prepare/run candidate domain", () => {
  it.each(["human", "edit", "regenerate"] as const)(
    "assigns %s only by independent thread declaration",
    (kind) => {
      const f = fixture();
      f.owner.kind = kind;
      if (kind !== "human")
        f.network.requests.push({
          ...structuredClone(f.request),
          sequence: 2,
          url: `${f.appBase}/api/threads/${f.raw}/runs/${kind === "edit" ? "edit-regenerate" : "regenerate"}/prepare`,
        });
      const result = f.assign();
      expect(result.errors).toEqual([]);
      expect(
        result.groups.get(f.owner)?.map((candidate) => candidate.row),
      ).toEqual(f.network.requests);
    },
  );
  it.each(["GET", "PUT", "DELETE", "post"])(
    "retains and rejects wrong method %s before filtering",
    (method) => {
      const f = fixture();
      const bad = { ...structuredClone(f.request), method, sequence: 2 };
      f.network.requests.push(bad);
      const result = f.assign();
      expect(result.errors).toContain("submission candidate has wrong method");
      expect(result.groups.get(f.owner)).toHaveLength(2);
      expect(f.inventory().candidates[1]!.row).toBe(bad);
    },
  );
  it.each([
    "malformed-body",
    "wrong-key",
    "wrong-frame",
    "failed",
    "open",
    "unknown-time",
    "navigation",
  ])("keeps %s in the domain for its consumer to validate", (change) => {
    const f = fixture(),
      row = f.request;
    if (change === "malformed-body")
      row.bodyBase64 = Buffer.from("{").toString("base64");
    if (change === "wrong-key") row.headers["idempotency-key"] = "unknown";
    if (change === "wrong-frame") row.source = "service-worker";
    if (change === "failed") {
      row.failure = { errorText: "aborted" };
      row.response = null;
    }
    if (change === "open") {
      row.finished = false;
      row.response = null;
    }
    if (change === "unknown-time") row.startedAt = null;
    if (change === "navigation") row.navigation = true;
    expect(f.inventory().candidates[0]!.row).toBe(row);
    expect(f.assign().groups.get(f.owner)).toHaveLength(1);
    // Assignment is not validation or authorization of this request.
    expect(f.assign().errors).toEqual([]);
  });
  it.each(["%61ctual-random-thread", "%ZZ", "%252F"])(
    "preserves suspicious thread spelling %s",
    (segment) => {
      const f = fixture();
      f.request.url = f.request.url.replace(f.raw, segment);
      expect(f.inventory().candidates).toHaveLength(1);
      expect(f.assign().errors.length).toBeGreaterThan(0);
      expect(f.inventory().candidates[0]!.row.url).toContain(segment);
    },
  );
  it.each(["?", "?thread_id=other", "?a=1&a=2"])(
    "retains undeclared query %s and refuses assignment as proof",
    (query) => {
      const f = fixture();
      f.request.url += query;
      expect(f.inventory().candidates).toHaveLength(1);
      expect(f.assign().errors).toContain(
        "submission candidate has undeclared query",
      );
    },
  );
  it.each(["external", "unknown-path", "join"])(
    "leaves %s outside this finite domain without deleting original wire",
    (change) => {
      const f = fixture();
      if (change === "external")
        f.request.url = f.request.url.replace(
          f.appBase,
          "https://external.test",
        );
      if (change === "unknown-path") f.request.url += "/extra";
      if (change === "join") {
        f.request.url = f.request.url.replace(
          "/runs/stream",
          "/runs/old-run/stream",
        );
        f.request.method = "GET";
      }
      const before = structuredClone(f.network);
      expect(f.inventory().candidates).toEqual([]);
      expect(f.network).toEqual(before);
    },
  );
  it("rejects zero consumers, even when body and key appear plausible", () => {
    const f = fixture();
    expect(f.assign([]).errors).toContain(
      "submission candidate has zero or multiple independent consumers",
    );
  });
  it.each(["human", "edit", "regenerate"] as const)(
    "does not choose a %s owner from body/response/timing",
    (kind) => {
      const f = fixture();
      const other = { ...f.owner, kind, slot: "another-operation" };
      const result = f.assign([f.owner, other]);
      expect(result.errors).toContain(
        "ambiguous same-thread submission owners",
      );
      expect(result.errors).toContain(
        "submission candidate has zero or multiple independent consumers",
      );
      expect([...result.groups.values()].flat()).toEqual([]);
    },
  );
  it("assigns separate declared threads independently of completion order", () => {
    const f = fixture();
    const other: SubmissionOwner = {
      kind: "edit",
      slot: "edit-other",
      thread: "other-thread",
    };
    const request = {
      ...structuredClone(f.request),
      sequence: 2,
      url: f.request.url.replace(f.raw, other.thread),
      finished: false,
    };
    f.network.requests.unshift(request);
    const result = f.assign([other, f.owner]);
    expect(result.errors).toEqual([]);
    expect(result.groups.get(other)?.[0]?.row).toBe(request);
    expect(result.groups.get(f.owner)?.[0]?.row).toBe(f.request);
  });
  it.each(["human", "regenerate"] as const)(
    "does not hide edit prepare under a %s slot",
    (kind) => {
      const f = fixture();
      f.owner.kind = kind;
      f.request.url = `${f.appBase}/api/threads/${f.raw}/runs/edit-regenerate/prepare`;
      const result = f.assign();
      expect(result.groups.get(f.owner)).toHaveLength(1);
      expect(result.errors).toContain(
        "prepare candidate contradicts its independent operation kind",
      );
    },
  );
  it("detects duplicate request sequence across domain and unrelated wire", () => {
    const f = fixture();
    f.network.requests.push({ ...f.request, url: `${f.appBase}/api/config` });
    expect(f.inventory().errors).toContain(
      "invalid or duplicate submission inventory request sequence",
    );
  });
  it("preserves observation errors and rejects duplicate declared slots", () => {
    const f = fixture();
    f.network.errors.push("observation failed");
    const result = f.assign([f.owner, { ...f.owner, thread: "other" }]);
    expect(result.errors).toContain("observation failed");
    expect(result.errors).toContain(
      "invalid or duplicate independent submission owner",
    );
  });
});
