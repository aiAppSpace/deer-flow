import type { Page, Request, Response } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  projectBody,
  projectUrl,
  type WireBody,
  type WireContentType,
  type WireUrl,
} from "./wire-values";

const REQUEST_HEADERS = [
  "content-type",
  "accept",
  "idempotency-key",
  "last-event-id",
] as const;
const RESPONSE_HEADERS = ["content-type", "content-location"] as const;
type PublicHeaders = Record<(typeof REQUEST_HEADERS)[number], string | null>;
type ResponseHeaders = Record<(typeof RESPONSE_HEADERS)[number], string | null>;

export type RequestObservation = {
  /** Diagnostic/local correlation only; never a cross-application identity. */
  sequence: number;
  observedAt: number;
  /** Public initiating surface only. A frame is not a document/owner proof. */
  source: "main-frame" | "child-frame" | "service-worker" | "unknown";
  navigation: boolean | null;
  /** Public browser timing, copied once exposed; never Node receipt time. */
  startedAt: number | null;
  timingObservedOn:
    "request" | "response" | "finished" | "failed" | "cutoff" | null;
  method: string;
  url: string;
  headers: PublicHeaders;
  bodyBase64: string | null;
  response: { status: number; headers: ResponseHeaders } | null;
  finished: boolean;
  failure: { errorText: string | null } | null;
};
export type NetworkSnapshot = {
  requests: RequestObservation[];
  errors: string[];
};

function selectHeaders<K extends string>(
  headers: Record<string, string>,
  keys: readonly K[],
): Record<K, string | null> {
  const entries = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return Object.fromEntries(
    keys.map((key) => [key, entries.get(key) ?? null]),
  ) as Record<K, string | null>;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Observe the public Playwright projection, not a second fetch/SSE reader.
 * Synchronous headers may join duplicate header lines. postDataBuffer is also
 * protocol-exposed data, not a promise of complete file-upload wire coverage.
 * Missing/failed observations stay visible; they never silently become absence. */
export function recordNetwork(page: Page, appBase: string) {
  const records = new Map<Request, RequestObservation>();
  const errors = new Set<string>();
  let stopped: NetworkSnapshot | undefined;
  function observeTiming(
    request: Request,
    row: RequestObservation,
    event: NonNullable<RequestObservation["timingObservedOn"]>,
  ) {
    try {
      const start = request.timing().startTime;
      // Playwright initializes this to zero and fills it when headers arrive.
      // A failed/pending request may never expose a start time.
      if (start === 0) return;
      if (!Number.isFinite(start) || start < 0) {
        errors.add(`${row.sequence}: invalid public request start time`);
        return;
      }
      if (row.startedAt !== null && row.startedAt !== start) {
        errors.add(`${row.sequence}: request start time changed`);
        return;
      }
      if (row.startedAt === null) {
        row.startedAt = start;
        row.timingObservedOn = event;
      }
    } catch {
      errors.add(`${row.sequence}: request timing observation failed`);
    }
  }
  const onRequest = (request: Request) => {
    if (stopped) return;
    try {
      if (!projectUrl(request.url(), appBase)) return;
    } catch {
      errors.add("API URL observation failed");
      return;
    }
    if (records.size >= 5000) {
      errors.add("API request observation capacity exceeded");
      return;
    }
    const row: RequestObservation = {
      sequence: records.size,
      observedAt: Date.now(),
      source: "unknown",
      navigation: null,
      startedAt: null,
      timingObservedOn: null,
      method: request.method(),
      url: request.url(),
      headers: selectHeaders({}, REQUEST_HEADERS),
      bodyBase64: null,
      response: null,
      finished: false,
      failure: null,
    };
    records.set(request, row);
    try {
      // Worker-owned requests do not have a Frame; never catch that absence
      // and silently classify it as the page's current main document.
      row.source = request.serviceWorker()
        ? "service-worker"
        : request.frame() === page.mainFrame()
          ? "main-frame"
          : "child-frame";
    } catch {
      errors.add(`${row.sequence}: request source observation failed`);
    }
    try {
      row.navigation = request.isNavigationRequest();
    } catch {
      errors.add(`${row.sequence}: request navigation observation failed`);
    }
    observeTiming(request, row, "request");
    try {
      const headers = request.headers();
      row.headers = selectHeaders(headers, REQUEST_HEADERS);
      const body = request.postDataBuffer();
      const length = headers["content-length"];
      if (
        length !== undefined &&
        /^\d+$/.test(length) &&
        Number(length) !== (body?.length ?? 0)
      )
        errors.add(
          `${row.sequence}: request body length differs from the exposed Content-Length`,
        );
      if (
        body === null &&
        row.headers["content-type"] !== null &&
        !["GET", "HEAD", "OPTIONS"].includes(row.method)
      )
        errors.add(`${row.sequence}: declared request body was not exposed`);
      // This detects oversized data after Playwright exposes it; it is not a
      // hard memory bound on the underlying protocol's own body buffer.
      if (body && body.length > 8 * 1024 * 1024)
        errors.add(`${row.sequence}: request body exceeds capture capacity`);
      else row.bodyBase64 = body?.toString("base64") ?? null;
    } catch {
      errors.add(`${row.sequence}: request headers/body observation failed`);
    }
  };
  const onResponse = (response: Response) => {
    if (stopped) return;
    const row = records.get(response.request());
    if (!row) return;
    observeTiming(response.request(), row, "response");
    try {
      row.response = {
        status: response.status(),
        headers: selectHeaders(response.headers(), RESPONSE_HEADERS),
      };
    } catch {
      errors.add(`${row.sequence}: response header observation failed`);
    }
  };
  const onFinished = (request: Request) => {
    if (stopped) return;
    const row = records.get(request);
    if (row) {
      observeTiming(request, row, "finished");
      row.finished = true;
    }
  };
  const onFailed = (request: Request) => {
    if (stopped) return;
    const row = records.get(request);
    if (!row) return;
    observeTiming(request, row, "failed");
    try {
      // Keep headers received before a later SSE failure, rather than replacing
      // the response with a mutually exclusive failure state.
      row.failure = { errorText: request.failure()?.errorText ?? null };
    } catch {
      errors.add(`${row.sequence}: request failure observation failed`);
    }
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfinished", onFinished);
  page.on("requestfailed", onFailed);
  return {
    stop(): NetworkSnapshot {
      if (stopped) return stopped;
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfinished", onFinished);
      page.off("requestfailed", onFailed);
      for (const [request, row] of records)
        observeTiming(request, row, "cutoff");
      stopped = freeze(
        structuredClone({
          requests: [...records.values()],
          errors: [...errors],
        }),
      );
      return stopped;
    },
  };
}

export type RequestFact<
  Segment = string,
  Body extends readonly [string, ...unknown[]] = WireBody,
  Key = string | null,
  Location = string | null,
> = {
  method: string;
  url: Omit<WireUrl, "path"> & { path: Segment[] };
  body: Body;
  headers: Omit<PublicHeaders, "content-type" | "idempotency-key"> & {
    "content-type": WireContentType;
    "idempotency-key": Key;
  };
  response: {
    status: number;
    headers: Omit<ResponseHeaders, "content-location"> & {
      "content-location": Location;
    };
  } | null;
  finished: boolean;
  failure: RequestObservation["failure"];
};

/** The recorder already freezes its output. This binding also detects mutation
 * of replay/fixture inputs between registry validation and pure projection. */
export function networkFingerprint(snapshot: NetworkSnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function projectRequest(
  row: RequestObservation,
  appBase: string,
): RequestFact {
  const url = projectUrl(row.url, appBase);
  if (!url) throw new Error("Capture contains a non-API request");
  const wire = projectBody(
    row.bodyBase64 === null ? null : Buffer.from(row.bodyBase64, "base64"),
    row.headers["content-type"] ?? undefined,
  );
  return {
    method: row.method.toUpperCase(),
    url,
    body: wire.body,
    headers: { ...row.headers, "content-type": wire.contentType },
    // Content-Location is an original header reference, not a resolved URL.
    response: row.response,
    finished: row.finished,
    failure: row.failure,
  };
}

/** All verdict/display views retain the same request multiplicity and pairing. */
export function summarizeRequestFacts<
  Segment,
  Body extends readonly [string, ...unknown[]],
  Key,
  Location,
>(
  facts: readonly RequestFact<Segment, Body, Key, Location>[],
  observationErrors: readonly string[],
) {
  const requests: string[] = [];
  const requestBodies: { key: string; body: string }[] = [];
  const requestFacts: string[] = [];
  for (const fact of facts) {
    const key = JSON.stringify([fact.method, fact.url]);
    requests.push(key);
    if (fact.body[0] !== "not-exposed")
      requestBodies.push({ key, body: JSON.stringify(fact.body) });
    requestFacts.push(JSON.stringify(fact));
  }
  return {
    requests,
    requestBodies,
    requestFacts,
    observationErrors: [...observationErrors],
  };
}

export function projectNetwork(snapshot: NetworkSnapshot, appBase: string) {
  return summarizeRequestFacts(
    snapshot.requests.map((row) => projectRequest(row, appBase)),
    snapshot.errors,
  );
}
