import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  normalizeRequest,
  normalizeRequestBody,
  type ParityCapture,
} from "../../e2e-parity/support/capture";
import { buildDiffEntry } from "../../e2e-parity/support/diff-entry";
import { addedRows, type DiffEntry } from "../../e2e-parity/support/ledger";

const A = "45400545-eacd-44da-a15f-7f5348bb37f8";
const B = "7475b747-4fe3-4c00-a7a6-759cba2e7cca";
const request = (url: string) => normalizeRequest("GET", url);

describe("wire observations must not erase differences", () => {
  it("does not infer identity from an unknown UUID path segment", () => {
    expect(request(`https://app.test/api/threads/${A}/state`)).not.toBe(
      request(`https://app.test/api/threads/${B}/state`),
    );
  });
  it("keeps UUID-shaped content literal", () => {
    expect(canonicalJson({ content: A })).not.toEqual(
      canonicalJson({ content: B }),
    );
  });
  it("does not equate literal marker text with UUID-shaped content", () => {
    expect(canonicalJson({ content: A })).not.toEqual(
      canonicalJson({ content: "«generated»" }),
    );
  });
  it("retains own __proto__ data", () => {
    expect(normalizeRequestBody('{"__proto__":{"role":"owner"}}')).not.toBe(
      normalizeRequestBody("{}"),
    );
  });
  it("does not conflate one encoded query value and two parameters", () => {
    expect(request("https://app.test/api/x?a=x%26b%3Dy")).not.toBe(
      request("https://app.test/api/x?a=x&b=y"),
    );
  });
  it("preserves raw query encoding", () => {
    expect(request("https://app.test/api/x?a=%41")).not.toBe(
      request("https://app.test/api/x?a=A"),
    );
  });
  it("preserves repeated query values and their order", () => {
    expect(request("https://app.test/api/x?a=1&a=2")).not.toBe(
      request("https://app.test/api/x?a=2&a=1"),
    );
  });
  it("does not erase unrelated origins", () => {
    expect(request("https://app.test/api/x")).not.toBe(
      request("https://outside.test/api/x"),
    );
  });
  it.each([
    ['{"x":1,"x":2}', '{"x":2}'],
    ['{"x":9007199254740992}', '{"x":9007199254740993}'],
    ['{"x":0.10000000000000001}', '{"x":0.1}'],
    ['{"x":-0}', '{"x":0}'],
    ['{"x":1e400}', '{"x":null}'],
    ['{"x":1e-400}', '{"x":0}'],
  ])("retains JSON bytes when normal parsing would erase %s", (a, b) => {
    expect(normalizeRequestBody(a)).not.toBe(normalizeRequestBody(b));
  });
  it("does not confuse binary bytes with a user JSON marker object", () => {
    const bytes = Buffer.from([0, 255, 128]);
    expect(normalizeRequestBody(bytes)).not.toBe(
      normalizeRequestBody(
        JSON.stringify({ binaryBodyBase64: bytes.toString("base64") }),
      ),
    );
  });
  it("does not confuse a delimiter-shaped payload line with a real multipart boundary", () => {
    const header = (name: string) =>
      `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
    const a = `--A\r\n${header("first")}one\r\n--<multipart-boundary>\r\n${header("second")}two\r\n--A--\r\n`;
    const b = `--B\r\n${header("first")}one\r\n--B\r\n${header("second")}two\r\n--B--\r\n`;
    expect(
      normalizeRequestBody(a, new Set(), "multipart/form-data; boundary=A"),
    ).not.toBe(
      normalizeRequestBody(b, new Set(), "multipart/form-data; boundary=B"),
    );
  });
});

const capture = (bodies: string[], headers: string[] = bodies) =>
  ({
    aria: "",
    ariaTree: [],
    requests: bodies.map(() => "POST /api/x"),
    requestBodies: bodies.map((body) => ({ key: "POST /api/x", body })),
    requestFacts: bodies.map((body, index) =>
      JSON.stringify({
        method: "POST",
        url: "/api/x",
        body,
        headers: headers[index],
      }),
    ),
    observationErrors: [],
    geometry: {},
    focus: "body",
    tabbables: [],
    url: "/",
  }) satisfies ParityCapture & {
    requestFacts: string[];
    observationErrors: string[];
  };

describe("complete request relations participate in the verdict", () => {
  it("distinguishes A,A,B from A,B,B at one URL", () => {
    const diff = buildDiffEntry(
      capture(["A", "A", "B"]),
      capture(["A", "B", "B"]),
    );
    expect(Object.values(diff).some((lines) => lines.length > 0)).toBe(true);
  });
  it("distinguishes swapped headers without changing body or header sets", () => {
    const diff = buildDiffEntry(
      capture(["A", "B"], ["H1", "H2"]),
      capture(["A", "B"], ["H2", "H1"]),
    );
    expect(Object.values(diff).some((lines) => lines.length > 0)).toBe(true);
  });
  it("does not let equal observation failures cancel each other out", () => {
    const failed = {
      ...capture([]),
      observationErrors: ["request headers unavailable"],
    };
    expect(() => buildDiffEntry(failed, failed)).toThrow(
      /observation|capture/i,
    );
  });
  it("rejects multiplicity growth in the acceptance comparison", () => {
    const empty = buildDiffEntry(capture([]), capture([]));
    const before: DiffEntry = { ...empty, requestsOnlyReact: ["GET /api/x"] };
    const after: DiffEntry = {
      ...empty,
      requestsOnlyReact: ["GET /api/x", "GET /api/x"],
    };
    expect(addedRows({ sample: before }, { sample: after })).toEqual([
      "sample · requestsOnlyReact: GET /api/x",
    ]);
  });
});
