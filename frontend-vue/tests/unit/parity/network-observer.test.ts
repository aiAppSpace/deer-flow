import { EventEmitter } from "node:events";
import type { Page, Request, Response } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import {
  projectNetwork,
  recordNetwork,
} from "../../e2e-parity/support/capture-network";
import { projectBody, projectUrl } from "../../e2e-parity/support/wire-values";

const BASE = "https://app.test";
const mainFrame = {};
function request(
  body: string | Buffer | null = null,
  headers: Record<string, string> = {},
  url = `${BASE}/api/x`,
  method = "POST",
) {
  return {
    url: () => url,
    method: () => method,
    headers: () => headers,
    postDataBuffer: () => (body === null ? null : Buffer.from(body)),
    failure: () => ({ errorText: "net::ERR_CONNECTION_RESET" }),
    timing: () => ({ startTime: 0 }),
    serviceWorker: () => null,
    frame: () => mainFrame,
    isNavigationRequest: () => false,
  } as Request;
}
function response(
  owner: Request,
  status = 200,
  headers: Record<string, string> = {},
) {
  return {
    request: () => owner,
    status: () => status,
    headers: () => headers,
    body: vi.fn(() => {
      throw new Error("SSE reader must never be used");
    }),
    text: vi.fn(() => {
      throw new Error("SSE reader must never be used");
    }),
  } as unknown as Response;
}
function recorder() {
  const events = Object.assign(new EventEmitter(), {
    mainFrame: () => mainFrame,
  });
  return { events, observer: recordNetwork(events as unknown as Page, BASE) };
}

describe("request-owned network observations", () => {
  it("binds out-of-order responses to each original request, including identical URLs", () => {
    const { events, observer } = recorder();
    const a = request('"A"', { "idempotency-key": "one" });
    const b = request('"B"', { "idempotency-key": "two" });
    events.emit("request", a);
    events.emit("request", b);
    events.emit("response", response(b, 409));
    events.emit("response", response(a, 201));
    const rows = observer.stop().requests;
    expect(
      rows.map((row) => [
        Buffer.from(row.bodyBase64!, "base64").toString(),
        row.headers["idempotency-key"],
        row.response?.status,
      ]),
    ).toEqual([
      ['"A"', "one", 201],
      ['"B"', "two", 409],
    ]);
  });
  it("retains headers received before a streaming failure without reading the stream", () => {
    const { events, observer } = recorder();
    const req = request();
    const res = response(req, 200, {
      "content-type": "text/event-stream",
      "content-location": "/api/threads/thread/runs/run",
    });
    events.emit("request", req);
    events.emit("response", res);
    events.emit("requestfailed", req);
    const row = observer.stop().requests[0]!;
    expect(row.response?.status).toBe(200);
    expect(row.response?.headers["content-location"]).toBe(
      "/api/threads/thread/runs/run",
    );
    expect(row.failure?.errorText).toBe("net::ERR_CONNECTION_RESET");
    expect(row.finished).toBe(false);
    expect(res.body).not.toHaveBeenCalled();
    expect(res.text).not.toHaveBeenCalled();
  });
  it("preserves pending, headers-received, finished and failed as distinct facts", () => {
    const { events, observer } = recorder();
    const items = Array.from({ length: 4 }, () => request());
    for (const req of items) events.emit("request", req);
    events.emit("response", response(items[1]!));
    events.emit("response", response(items[2]!));
    events.emit("requestfinished", items[2]);
    events.emit("requestfailed", items[3]);
    expect(
      new Set(projectNetwork(observer.stop(), BASE).requestFacts).size,
    ).toBe(4);
  });
  it("keeps absent, empty and present public headers distinct and excludes credentials", () => {
    const { events, observer } = recorder();
    const headerCases: Record<string, string>[] = [
      {},
      { "idempotency-key": "" },
      { "idempotency-key": "known" },
    ];
    for (const headers of headerCases)
      events.emit(
        "request",
        request(null, {
          ...headers,
          Authorization: "secret-auth",
          cookie: "secret-cookie",
          "x-csrf-token": "secret-csrf",
        }),
      );
    const snapshot = observer.stop();
    expect(
      snapshot.requests.map((row) => row.headers["idempotency-key"]),
    ).toEqual([null, "", "known"]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /secret-|Authorization|csrf|cookie/,
    );
    expect(new Set(projectNetwork(snapshot, BASE).requestFacts).size).toBe(3);
  });
  it("distinguishes an exposed empty body from no exposed body", () => {
    const { events, observer } = recorder();
    events.emit("request", request(null));
    events.emit("request", request(Buffer.alloc(0)));
    const snapshot = observer.stop();
    expect(snapshot.requests.map((row) => row.bodyBase64)).toEqual([null, ""]);
    expect(new Set(projectNetwork(snapshot, BASE).requestFacts).size).toBe(2);
  });
  it("rejects missing or incomplete bodies declared by the public headers", () => {
    const { events, observer } = recorder();
    events.emit(
      "request",
      request(null, { "content-type": "application/json" }),
    );
    events.emit("request", request("x", { "content-length": "10" }));
    expect(observer.stop().errors).toEqual([
      "0: declared request body was not exposed",
      "1: request body length differs from the exposed Content-Length",
    ]);
  });
  it("reports a failed header read rather than interpreting it as absent", () => {
    const { events, observer } = recorder();
    const req = request();
    req.headers = () => {
      throw new Error("protocol unavailable");
    };
    events.emit("request", req);
    expect(observer.stop().errors).toEqual([
      "0: request headers/body observation failed",
    ]);
  });
  it("retains original observations after stopping and detaches every listener", () => {
    const { events, observer } = recorder();
    const req = request();
    events.emit("request", req);
    const snapshot = observer.stop();
    expect(events.eventNames()).toEqual([]);
    events.emit("response", response(req));
    events.emit("requestfinished", req);
    expect(snapshot.requests[0]!.response).toBeNull();
    expect(() => {
      snapshot.requests[0]!.url = "changed";
    }).toThrow();
    expect(observer.stop()).toBe(snapshot);
  });
  it("does not leak mappings between captures on the same page", () => {
    const { events, observer } = recorder();
    events.emit("request", request('"first"'));
    const first = observer.stop();
    const second = recordNetwork(events as unknown as Page, BASE);
    events.emit("request", request('"second"'));
    expect(first.requests).toHaveLength(1);
    expect(second.stop().requests).toHaveLength(1);
    expect(second.stop().requests[0]!.bodyBase64).not.toBe(
      first.requests[0]!.bodyBase64,
    );
  });
  it("reports bounded recorder overflow rather than returning an apparently complete capture", () => {
    const { events, observer } = recorder();
    for (let i = 0; i < 5001; i += 1) events.emit("request", request());
    expect(observer.stop().requests).toHaveLength(5000);
    expect(observer.stop().errors).toContain(
      "API request observation capacity exceeded",
    );
  });
  it("keeps local sequence/time only in evidence, not in the cross-app key", () => {
    const { events, observer } = recorder();
    events.emit("request", request('"value"'));
    const original = observer.stop();
    const later = {
      ...original,
      requests: original.requests.map((row) => ({
        ...row,
        sequence: 900,
        observedAt: row.observedAt + 999,
      })),
    };
    expect(projectNetwork(original, BASE)).toEqual(projectNetwork(later, BASE));
  });
});

describe("lossless projections", () => {
  it("retains the original Content-Location reference instead of resolving its spelling", () => {
    const { events, observer } = recorder();
    const locations = [
      null,
      "",
      "/api/threads/thread/runs/run",
      `${BASE}/api/threads/thread/runs/run`,
      "//app.test/api/threads/thread/runs/run",
      "/api/threads/thread/runs/./run",
      "/api/threads/thread/runs/run?",
      "/api/threads/thread/runs/run#one",
      "/api/threads/thread/runs/run#two",
      "/api/threads/thread/runs/%72un",
      "https://external.test/api/threads/thread/runs/run",
      "http://[invalid",
    ];
    for (const location of locations) {
      const req = request();
      events.emit("request", req);
      events.emit(
        "response",
        response(
          req,
          200,
          location === null ? {} : { "content-location": location },
        ),
      );
    }
    const snapshot = observer.stop();
    const facts = projectNetwork(snapshot, BASE).requestFacts;
    expect(
      snapshot.requests.map((row) => row.response?.headers["content-location"]),
    ).toEqual(locations);
    expect(
      facts.map(
        (fact) => JSON.parse(fact).response.headers["content-location"],
      ),
    ).toEqual(locations);
    expect(new Set(facts).size).toBe(locations.length);
  });

  it("aliases only the explicitly declared application origin", () => {
    expect(
      projectUrl("https://react.test/api/x", "https://react.test"),
    ).toEqual(projectUrl("https://vue.test/api/x", "https://vue.test"));
    expect(
      projectUrl("https://external.test/api/x", "https://react.test"),
    ).not.toEqual(projectUrl("https://react.test/api/x", "https://react.test"));
    expect(projectUrl("https://app.test/api/x?", BASE)).not.toEqual(
      projectUrl("https://app.test/api/x", BASE),
    );
  });
  it("does not merge literal tagged-looking JSON with bytes or another JSON structure", () => {
    expect(
      projectBody(Buffer.from('["string","data"]'), "application/json").body,
    ).not.toEqual(projectBody(Buffer.from('"data"'), "application/json").body);
    expect(
      projectBody(Buffer.from('{"__proto__":1}'), "application/json").body,
    ).not.toEqual(projectBody(Buffer.from("{}"), "application/json").body);
  });
  it("projects a validated multipart boundary in the body and header together", () => {
    const envelope = (b: string) =>
      Buffer.from(
        `--${b}\r\nContent-Disposition: form-data; name="x"\r\n\r\ndata\r\n--${b}--\r\n`,
      );
    expect(
      projectBody(envelope("A"), 'multipart/form-data; boundary="A"'),
    ).toEqual(projectBody(envelope("B"), "multipart/form-data; boundary=B"));
    expect(
      projectBody(envelope("A"), "multipart/form-data; boundary=Wrong"),
    ).not.toEqual(
      projectBody(envelope("A"), "multipart/form-data; boundary=A"),
    );
  });
  it.each(["1e400", "1e-400", "-0", "9007199254740993", "0.10000000000000001"])(
    "preserves the exact JSON number token %s",
    (token) => {
      expect(projectBody(Buffer.from(token), "application/json").body).toEqual([
        "json",
        ["number", token],
      ]);
    },
  );
});

describe("public request timing evidence", () => {
  it("keeps an unavailable start unresolved until the same request exposes response timing", () => {
    const { events, observer } = recorder();
    const req = request();
    let startedAt = 0;
    req.timing = () =>
      ({ startTime: startedAt }) as ReturnType<Request["timing"]>;
    events.emit("request", req);
    startedAt = 1700000000123;
    events.emit("response", response(req));
    const snapshot = observer.stop();
    expect(snapshot.requests[0]?.startedAt).toBe(startedAt);
    expect(snapshot.requests[0]?.timingObservedOn).toBe("response");
    startedAt += 100;
    expect(snapshot.requests[0]?.startedAt).toBe(1700000000123);
  });
  it("failed and pending requests without response do not borrow Node observedAt", () => {
    const { events, observer } = recorder();
    const failed = request();
    events.emit("request", failed);
    events.emit("requestfailed", failed);
    events.emit("request", request());
    const snapshot = observer.stop();
    expect(snapshot.requests.map((row) => row.startedAt)).toEqual([null, null]);
    expect(snapshot.requests.map((row) => row.timingObservedOn)).toEqual([
      null,
      null,
    ]);
    expect(snapshot.requests.every((row) => row.observedAt > 0)).toBe(true);
  });
  it("timing exceptions remain invalid evidence rather than an invented timestamp", () => {
    const { events, observer } = recorder();
    const req = request();
    req.timing = () => {
      throw new Error("timing unavailable");
    };
    events.emit("request", req);
    const snapshot = observer.stop();
    expect(snapshot.requests[0]?.startedAt).toBeNull();
    expect(snapshot.errors).toContain("0: request timing observation failed");
  });
  it("an inconsistent public start timestamp cannot overwrite earlier evidence", () => {
    const { events, observer } = recorder();
    const req = request();
    let startedAt = 1700000000000;
    req.timing = () =>
      ({ startTime: startedAt }) as ReturnType<Request["timing"]>;
    events.emit("request", req);
    startedAt += 10;
    events.emit("response", response(req));
    const snapshot = observer.stop();
    expect(snapshot.requests[0]?.startedAt).toBe(1700000000000);
    expect(snapshot.errors).toContain("0: request start time changed");
  });
});

describe("public request source classification", () => {
  for (const kind of [
    "main-frame",
    "child-frame",
    "service-worker",
    "unknown",
  ] as const)
    it(`keeps ${kind} separate without using its frame as a document identity`, () => {
      const { events, observer } = recorder();
      const req = request('"unchanged"');
      const frame = vi.fn(() => {
        if (kind === "unknown" || kind === "service-worker")
          throw new Error("no frame");
        return kind === "main-frame" ? mainFrame : {};
      });
      Object.assign(req, {
        frame,
        serviceWorker: () => (kind === "service-worker" ? {} : null),
      });
      events.emit("request", req);
      const result = observer.stop();
      expect(result.requests[0]).toMatchObject({
        source: kind,
        navigation: false,
      });
      expect(
        Buffer.from(result.requests[0]!.bodyBase64!, "base64").toString(),
      ).toBe('"unchanged"');
      if (kind === "service-worker") expect(frame).not.toHaveBeenCalled();
      if (kind === "unknown")
        expect(result.errors).toContain("0: request source observation failed");
      else expect(result.errors).toEqual([]);
    });

  it("does not interpret a worker lookup failure as a main-frame request", () => {
    const { events, observer } = recorder();
    const req = request();
    Object.assign(req, {
      serviceWorker() {
        throw new Error("missing public source");
      },
    });
    events.emit("request", req);
    const result = observer.stop();
    expect(result.requests[0]).toMatchObject({
      source: "unknown",
      navigation: false,
    });
    expect(result.errors).toContain("0: request source observation failed");
  });

  it("retains navigation and missing navigation evidence as different values", () => {
    const { events, observer } = recorder();
    const yes = request();
    const missing = request();
    Object.assign(yes, { isNavigationRequest: () => true });
    Object.assign(missing, {
      isNavigationRequest() {
        throw new Error("not exposed");
      },
    });
    events.emit("request", yes);
    events.emit("request", missing);
    const result = observer.stop();
    expect(result.requests.map((row) => row.navigation)).toEqual([true, null]);
    expect(result.errors).toContain("1: request navigation observation failed");
    expect(result.requests.every((row) => row.source === "main-frame")).toBe(
      true,
    );
  });
});
