import {
  createServer,
  type IncomingHttpHeaders,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { recordNetwork, projectNetwork } from "./support/capture-network";
import { captureScenario } from "./support/capture";
import { createCapturePage } from "./support/capture-page";
import { installIdentityCapture } from "./support/capture-identities";
import { buildDiffEntry } from "./support/diff-entry";
import { DEFAULT_DIMENSION, type ParityScenario } from "./support/scenarios";

type Arrival = {
  headers: IncomingHttpHeaders;
  body: Buffer;
  response: ServerResponse;
};

/** Actual loopback HTTP and Chromium protocol events, without a product/server
 * mock or a second response reader in the observer. Owns only this random port. */
async function withHttp(
  page: Page,
  handler: (arrival: Arrival) => void,
  run: (base: string, arrivals: Arrival[]) => Promise<void>,
  script = "",
) {
  const arrivals: Arrival[] = [];
  const server = createServer((request, response) => {
    if (!request.url?.startsWith("/api/")) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        `<!doctype html><body><main>Network fixture</main><script>${script}</script></body>`,
      );
      return;
    }
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const arrival = {
        headers: request.headers,
        body: Buffer.concat(chunks),
        response,
      };
      arrivals.push(arrival);
      handler(arrival);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture listener has no port");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await page.goto(base);
    await run(base, arrivals);
  } finally {
    const closed = new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    server.closeAllConnections();
    await closed;
  }
}

test("native response reordering preserves request body/header/status ownership", async ({
  page,
}, info) => {
  const pending: Arrival[] = [];
  await withHttp(
    page,
    (arrival) => {
      pending.push(arrival);
      if (pending.length !== 2) return;
      for (const row of [...pending].reverse()) {
        const id = row.headers["idempotency-key"];
        row.response.writeHead(id === "A" ? 201 : 409, {
          "content-type": "application/json",
          "content-location": `/api/threads/fixed/runs/${id}`,
        });
        row.response.end(JSON.stringify({ id }));
      }
    },
    async (base) => {
      const observer = recordNetwork(page, base);
      try {
        await page.evaluate(async () => {
          await Promise.all(
            ["A", "B"].map(async (id) => {
              const response = await fetch("/api/echo", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Idempotency-Key": id,
                },
                body: JSON.stringify({ id }),
              });
              await response.text();
            }),
          );
        });
        const snapshot = observer.stop();
        expect(snapshot.errors).toEqual([]);
        expect(snapshot.requests).toHaveLength(2);
        for (const row of snapshot.requests) {
          const id = JSON.parse(
            Buffer.from(row.bodyBase64!, "base64").toString(),
          ).id;
          expect(row.headers["idempotency-key"]).toBe(id);
          expect(row.response?.status).toBe(id === "A" ? 201 : 409);
          expect(row.response?.headers["content-location"]).toBe(
            `/api/threads/fixed/runs/${id}`,
          );
        }
        await info.attach("native-request-ownership", {
          body: JSON.stringify({
            snapshot,
            canonical: projectNetwork(snapshot, base),
          }),
          contentType: "application/json",
        });
      } finally {
        observer.stop();
      }
    },
  );
});

test("native Content-Location spelling remains distinct in the comparison facts", async ({
  page,
}, info) => {
  let locations: (string | null)[] = [];
  let at = 0;
  await withHttp(
    page,
    ({ response }) => {
      const location = locations[at++];
      response.writeHead(200, {
        "content-type": "text/plain",
        ...(location === null ? {} : { "content-location": location! }),
      });
      response.end("same response");
    },
    async (base) => {
      locations = [
        null,
        "",
        "/api/threads/fixed/runs/run",
        `${base}/api/threads/fixed/runs/run`,
        `//${new URL(base).host}/api/threads/fixed/runs/run`,
        "/api/threads/fixed/runs/./run",
        "/api/threads/fixed/runs/run?",
        "/api/threads/fixed/runs/run#one",
        "/api/threads/fixed/runs/run#two",
        "/api/threads/fixed/runs/%72un",
        "https://external.test/api/threads/fixed/runs/run",
        "http://[invalid",
      ];
      const observer = recordNetwork(page, base);
      try {
        // All requests are identical; only the real server response header varies.
        const received = await page.evaluate(async (count) => {
          const headers = [];
          for (let index = 0; index < count; index += 1) {
            const response = await fetch("/api/echo", { method: "POST" });
            headers.push(response.headers.get("content-location"));
            await response.text();
          }
          return headers;
        }, locations.length);
        const snapshot = observer.stop();
        const projection = projectNetwork(snapshot, base);
        await info.attach("native-content-location-representation", {
          body: JSON.stringify({ locations, received, snapshot, projection }),
          contentType: "application/json",
        });
        expect(received).toEqual(locations);
        expect(snapshot.errors).toEqual([]);
        expect(
          snapshot.requests.map(
            (row) => row.response?.headers["content-location"],
          ),
        ).toEqual(locations);
        expect(
          projection.requestFacts.map(
            (fact) => JSON.parse(fact).response.headers["content-location"],
          ),
        ).toEqual(locations);
        expect(new Set(projection.requestFacts).size).toBe(locations.length);
      } finally {
        observer.stop();
      }
    },
  );
});

for (const intercepted of [false, true])
  test(`native multipart observation reports its actual byte coverage (existing request interception=${intercepted})`, async ({
    page,
  }, info) => {
    await withHttp(
      page,
      ({ response }) => {
        response.writeHead(200).end("ok");
      },
      async (base, arrivals) => {
        // Existing mocked product scenarios already install routing. The observer
        // itself must never add interception or change the browser cache policy.
        if (intercepted)
          await page.route("**/api/upload", (route) => route.continue());
        const observer = recordNetwork(page, base);
        try {
          await page.evaluate(async () => {
            for (const bytes of [
              [0, 255, 128],
              [0, 255, 128],
              [0, 254, 128],
            ]) {
              const form = new FormData();
              form.append(
                "file",
                new File([new Uint8Array(bytes)], "binary.bin", {
                  type: "application/octet-stream",
                }),
              );
              form.append("literal", "--<multipart-boundary>");
              const response = await fetch("/api/upload", {
                method: "POST",
                body: form,
              });
              await response.text();
            }
          });
          const snapshot = observer.stop();
          await info.attach(
            `native-multipart-coverage-${intercepted ? "intercepted" : "direct"}`,
            {
              body: JSON.stringify({
                intercepted,
                snapshot,
                canonical: projectNetwork(snapshot, base),
                serverBodies: arrivals.map((row) =>
                  row.body.toString("base64"),
                ),
              }),
              contentType: "application/json",
            },
          );
          if (!intercepted) {
            // Pinned Chromium/PW does not expose file bodies in this topology.
            // This is an invalid capture, not a passing empty-body comparison.
            expect(snapshot.requests).toHaveLength(3);
            expect(arrivals).toHaveLength(3);
            expect(
              snapshot.requests.every((row) => row.bodyBase64 === null),
            ).toBe(true);
            expect(snapshot.errors).toHaveLength(3);
            expect(
              snapshot.errors.every((error) =>
                error.includes("body was not exposed"),
              ),
            ).toBe(true);
            const invalid = {
              ...projectNetwork(snapshot, base),
              aria: "",
              ariaTree: [],
              geometry: {},
              focus: "body",
              tabbables: [],
              url: "/",
            };
            expect(() => buildDiffEntry(invalid, invalid)).toThrow(
              /invalid capture observation/,
            );
            return;
          }
          expect(snapshot.errors).toEqual([]);
          expect(snapshot.requests).toHaveLength(3);
          expect(arrivals).toHaveLength(3);
          for (const [index, row] of snapshot.requests.entries())
            expect(
              Buffer.from(row.bodyBase64!, "base64").equals(
                arrivals[index]!.body,
              ),
            ).toBe(true);
          const canonical = projectNetwork(snapshot, base);
          expect(canonical.requestBodies[0]!.body).toBe(
            canonical.requestBodies[1]!.body,
          );
          expect(canonical.requestBodies[0]!.body).not.toBe(
            canonical.requestBodies[2]!.body,
          );
          // Header and body must use the same validated boundary projection.
          const first = JSON.parse(canonical.requestFacts[0]!);
          const second = JSON.parse(canonical.requestFacts[1]!);
          expect(first.headers).toEqual(second.headers);
          await info.attach("native-multipart-server-agreement", {
            body: JSON.stringify({
              snapshot,
              canonical,
              serverBodies: arrivals.map((row) => row.body.toString("base64")),
            }),
            contentType: "application/json",
          });
        } finally {
          observer.stop();
        }
      },
    );
  });

test("an open native fetch SSE is observed at headers and can be frozen without ending the stream", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "content-location": "/api/threads/fixed/runs/open",
      });
      response.write("event: metadata\ndata: {}\n\n");
    },
    async (base) => {
      const observer = recordNetwork(page, base);
      try {
        const frame = await page.evaluate(async () => {
          const controller = new AbortController();
          Object.assign(window, {
            captureFixtureAbort: () => controller.abort(),
          });
          const response = await fetch("/api/stream", {
            signal: controller.signal,
          });
          const reader = response.body!.getReader(); // The application's sole reader.
          return new TextDecoder().decode((await reader.read()).value);
        });
        expect(frame).toContain("event: metadata");
        const snapshot = observer.stop();
        expect(snapshot.errors).toEqual([]);
        expect(snapshot.requests).toHaveLength(1);
        expect(
          snapshot.requests[0]!.response?.headers["content-location"],
        ).toBe("/api/threads/fixed/runs/open");
        expect(snapshot.requests[0]!.finished).toBe(false);
        expect(snapshot.requests[0]!.failure).toBeNull();
        await page.evaluate(() =>
          (
            window as unknown as { captureFixtureAbort: () => void }
          ).captureFixtureAbort(),
        );
        expect(snapshot.requests[0]!.failure).toBeNull();
        await info.attach("native-open-sse-cutoff", {
          body: JSON.stringify(snapshot),
          contentType: "application/json",
        });
      } finally {
        observer.stop();
      }
    },
  );
});

test("captureScenario preserves partial evidence and the original error after an actual browser action fails", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => {
      response.writeHead(200).end("seen");
    },
    async (base) => {
      const scenario: ParityScenario = {
        id: "capture-failure-fixture",
        title: "Capture failure",
        backend: "gateway",
        path: "/",
        settle: [{ kind: "visible", target: { text: "Ready" } }],
      };
      await expect(
        captureScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          { id: "", steps: [{ kind: "press", key: "CaptureUnknownKey" }] },
          0,
        ),
      ).rejects.toThrow(/Unknown key.*CaptureUnknownKey/);
      const attachment = info.attachments.find((item) =>
        item.name.startsWith("parity-network-capture-failure-fixture-"),
      );
      expect(attachment).toBeDefined();
      const raw = attachment!.body ?? (await readFile(attachment!.path!));
      const partial = JSON.parse(raw.toString());
      expect(partial.completed).toBe(false);
      expect(partial.snapshot.requests).toHaveLength(1);
      expect(partial.snapshot.requests[0].url).toBe(`${base}/api/seen`);
      const next = recordNetwork(page, base);
      try {
        await page.evaluate(async () => {
          await (await fetch("/api/next")).text();
        });
        const snapshot = next.stop();
        expect(snapshot.requests).toHaveLength(1);
        expect(snapshot.requests[0]!.url).toBe(`${base}/api/next`);
        expect(partial.snapshot.requests).toHaveLength(1);
      } finally {
        next.stop();
      }
    },
    'fetch("/api/seen").then(r => r.text()).then(() => document.body.append("Ready"));',
  );
});

test("native public start timing arrives with response headers and stays absent on a response-less failure", async ({
  page,
}, info) => {
  await withHttp(
    page,
    (arrival) => {
      if (arrival.body.toString() === "fail") {
        arrival.response.destroy();
        return;
      }
      arrival.response.writeHead(200, { "content-type": "application/json" });
      arrival.response.end("{}");
    },
    async (base) => {
      const initial: number[] = [];
      const receive = (request: import("@playwright/test").Request) => {
        if (request.url().includes("/api/timing-"))
          initial.push(request.timing().startTime);
      };
      page.on("request", receive);
      const observer = recordNetwork(page, base);
      try {
        await page.evaluate(async () => {
          const response = await fetch("/api/timing-success", {
            method: "POST",
            body: "success",
          });
          await response.text();
        });
        const failed = page.waitForEvent("requestfailed", (request) =>
          request.url().endsWith("/api/timing-failure"),
        );
        await page.evaluate(async () => {
          await fetch("/api/timing-failure", {
            method: "POST",
            body: "fail",
          }).catch(() => undefined);
        });
        await failed;
        const snapshot = observer.stop();
        expect(initial).toEqual([0, 0]);
        expect(snapshot.errors).toEqual([]);
        expect(snapshot.requests).toHaveLength(2);
        const success = snapshot.requests.find((row) =>
          row.url.endsWith("/api/timing-success"),
        )!;
        const failure = snapshot.requests.find((row) =>
          row.url.endsWith("/api/timing-failure"),
        )!;
        expect(success.startedAt).toBeGreaterThan(0);
        expect(success.timingObservedOn).toBe("response");
        expect(failure.startedAt).toBeNull();
        expect(failure.timingObservedOn).toBeNull();
        expect(failure.failure).not.toBeNull();
        await info.attach("native-public-timing-coverage", {
          body: JSON.stringify(snapshot),
          contentType: "application/json",
        });
      } finally {
        observer.stop();
        page.off("request", receive);
      }
    },
  );
});

// A minimal page producer for testing the transport itself. Product producers
// have separate mounted tests; this fixture never claims actual app adoption.
const identityFixtureScript = `
  window.fixtureEmitIdentity = (raw = "human-fixture") => {
    const capture = window.__deerflow_parity_capture_v1__;
    if (!capture) return;
    window.dispatchEvent(new CustomEvent("deerflow:parity-identity:v1", { detail: {
      version: 1, capture: capture.token, action: capture.action,
      at: performance.timeOrigin + performance.now(), instance: 1,
      producer: "human:send", event: "human.allocate", values: { raw, thread: "thread-fixture" }
    } }));
  };
  window.fixtureEmitIdentity();
`;

test("identity capture follows native navigation and removes current and future document hooks before page reuse", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const first = await installIdentityCapture(page, base);
      try {
        await first.beginAction("entry");
        await page.goto(base + "/first");
        await first.beginAction("steps:3");
        await page.evaluate(() =>
          (
            window as unknown as { fixtureEmitIdentity(raw: string): void }
          ).fixtureEmitIdentity("same-document"),
        );
        await first.beginAction("steps:7");
        await page.goto(base + "/second");
        const result = await first.seal();
        expect(result.errors).toEqual([]);
        expect(result.complete).toBe(true);
        const events = result.receipts.filter((row) => row.kind === "event");
        expect(events.map((row) => row.packet?.action)).toEqual([
          "entry",
          "steps:3",
          "steps:7",
        ]);
        expect(events[0]!.document).not.toBe(events[2]!.document);
        expect(events[0]!.document).toBe(events[1]!.document);
        expect(
          result.receipts
            .filter((row) => row.kind === "close")
            .map((row) => row.reason),
        ).toEqual(["pagehide", "seal"]);
        await info.attach("native-identity-document-ranges", {
          body: JSON.stringify(result),
          contentType: "application/json",
        });
        const before = JSON.stringify(result);
        await page.evaluate(() =>
          (
            window as unknown as { fixtureEmitIdentity(raw: string): void }
          ).fixtureEmitIdentity("after-seal"),
        );
        expect(JSON.stringify(await first.seal())).toBe(before);
        expect(await first.dispose()).toEqual([]);
        expect(
          await page.evaluate(() =>
            [
              "__deerflow_parity_capture_v1__",
              "__deerflow_parity_transport_v1__",
              "__deerflow_parity_receipt_v1__",
            ].map((key) => Object.hasOwn(window, key)),
          ),
        ).toEqual([false, false, false]);
        await page.reload();
        expect(
          await page.evaluate(() =>
            Object.hasOwn(window, "__deerflow_parity_capture_v1__"),
          ),
        ).toBe(false);
        const second = await installIdentityCapture(page, base);
        try {
          await second.beginAction("entry");
          await page.goto(base + "/third");
          const next = await second.seal();
          expect(next.errors).toEqual([]);
          expect(next.capture).not.toBe(first.capture);
          expect(
            next.receipts.filter((row) => row.kind === "event"),
          ).toHaveLength(1);
          expect(
            next.receipts.every((row) => row.capture === second.capture),
          ).toBe(true);
        } finally {
          expect(await second.dispose()).toEqual([]);
        }
      } finally {
        await first.dispose();
      }
    },
    identityFixtureScript,
  );
});

test("identity capture preserves producer origin separately from later dispatch action and rejects malformed packets", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const capture = await installIdentityCapture(page, base);
      try {
        await capture.beginAction("entry");
        await page.goto(base);
        await page.evaluate(() => {
          const w = window as unknown as { fixturePacket?: unknown };
          window.addEventListener(
            "deerflow:parity-identity:v1",
            (event) => {
              w.fixturePacket = (event as CustomEvent).detail;
            },
            { once: true },
          );
          (
            window as unknown as { fixtureEmitIdentity(): void }
          ).fixtureEmitIdentity();
        });
        await capture.beginAction("steps:4");
        await page.evaluate(() => {
          const detail = (window as unknown as { fixturePacket: object })
            .fixturePacket;
          window.dispatchEvent(
            new CustomEvent("deerflow:parity-identity:v1", { detail }),
          );
          window.dispatchEvent(
            new CustomEvent("deerflow:parity-identity:v1", {
              detail: { ...detail, version: 99 },
            }),
          );
        });
        const result = await capture.seal();
        const last = result.receipts
          .filter((row) => row.kind === "event")
          .at(-1)!;
        expect(last.action).toBe("steps:4");
        expect(last.packet?.action).toBe("entry");
        expect(last.dispatchedAt).toBeGreaterThanOrEqual(last.packet!.at);
        expect(result.complete).toBe(false);
        expect(result.errors).toContain("invalid identity packet");
        await info.attach("native-identity-invalid-and-origin", {
          body: JSON.stringify(result),
          contentType: "application/json",
        });
      } finally {
        await capture.dispose();
      }
    },
    identityFixtureScript,
  );
});

for (const failure of [
  "unavailable",
  "throw",
  "reject",
  "ack-mismatch",
] as const)
  test(`identity binding ${failure} is recovered or explicitly invalid without changing the producer`, async ({
    page,
  }, info) => {
    await withHttp(
      page,
      ({ response }) => response.end("ok"),
      async (base) => {
        const capture = await installIdentityCapture(page, base);
        try {
          await capture.beginAction("entry");
          await page.goto(base);
          await page.evaluate((failure) => {
            const w = window as unknown as Record<string, unknown>;
            const key = "__deerflow_parity_receipt_v1__";
            const original = w[key];
            w[key] =
              failure === "unavailable"
                ? undefined
                : failure === "throw"
                  ? () => {
                      throw new Error("fixture bridge rejection");
                    }
                  : failure === "reject"
                    ? () =>
                        Promise.reject(new Error("fixture bridge rejection"))
                    : () => Promise.resolve("wrong-ack");
            (w.fixtureEmitIdentity as (raw: string) => void)(
              "during-binding-failure",
            );
            w[key] = original;
          }, failure);
          const result = await capture.seal();
          expect(
            result.receipts
              .filter((row) => row.kind === "event")
              .map((row) => row.packet?.values.raw),
          ).toEqual(["human-fixture", "during-binding-failure"]);
          expect(result.complete).toBe(failure === "unavailable");
          if (failure === "unavailable") expect(result.errors).toEqual([]);
          else
            expect(
              result.errors.some((error) => error.includes("transport")),
            ).toBe(true);
          await info.attach(`native-identity-binding-${failure}`, {
            body: JSON.stringify(result),
            contentType: "application/json",
          });
        } finally {
          expect(await capture.dispose()).toEqual([]);
        }
      },
      identityFixtureScript,
    );
  });

test("identity capture rejects a foreign frame and safely tears down after the page closes", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const capture = await installIdentityCapture(page, base);
      try {
        await capture.beginAction("entry");
        await page.goto(base);
        await page.evaluate(async () => {
          const frame = document.createElement("iframe");
          frame.src = "/child";
          const loaded = new Promise<void>((resolve) => {
            frame.onload = () => resolve();
          });
          document.body.append(frame);
          await loaded;
        });
        const child = page
          .frames()
          .find((frame) => frame !== page.mainFrame())!;
        expect(
          await child.evaluate(() =>
            Object.hasOwn(window, "__deerflow_parity_capture_v1__"),
          ),
        ).toBe(false);
        await child.evaluate(async () => {
          const binding = (
            window as unknown as Record<
              string,
              (row: unknown) => Promise<unknown>
            >
          ).__deerflow_parity_receipt_v1__!;
          await binding({ bad: "foreign-frame" });
        });
        await page.close();
        const result = await capture.seal();
        expect(result.complete).toBe(false);
        expect(result.errors).toContain(
          "identity receipt came from a different page or frame",
        );
        expect(result.errors).toContain(
          "identity document could not be sealed",
        );
        await info.attach("native-identity-page-close-partial", {
          body: JSON.stringify(result),
          contentType: "application/json",
        });
      } finally {
        expect(await capture.dispose()).toEqual([]);
      }
    },
    identityFixtureScript,
  );
});

test("invalid identity base does not reserve a page or prevent a subsequent valid capture", async ({
  page,
}) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      await expect(installIdentityCapture(page, "not a URL")).rejects.toThrow();
      const capture = await installIdentityCapture(page, base);
      try {
        await capture.beginAction("entry");
        await page.goto(base);
        expect((await capture.seal()).complete).toBe(true);
      } finally {
        await capture.dispose();
      }
    },
    identityFixtureScript,
  );
});

test("a wholly lost first document cannot disappear behind a complete second document", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const expose = page.exposeBinding.bind(page);
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        page,
        "exposeBinding",
      );
      const dropped = new Set<string>();
      let droppedReceipts = 0;
      Object.defineProperty(page, "exposeBinding", {
        configurable: true,
        value: async (...args: Parameters<Page["exposeBinding"]>) => {
          const [name, callback, options] = args;
          return expose(
            name,
            (source, ...values) => {
              const row = values[0] as {
                document: string;
                sequence: number;
                kind: string;
                action: string;
              };
              if (row.kind === "open" && row.action === "lost-entry")
                dropped.add(row.document);
              if (dropped.has(row.document)) {
                droppedReceipts += 1;
                return `${row.document}:${row.sequence}`;
              }
              return callback(source, ...values);
            },
            options,
          );
        },
      });
      const capture = await installIdentityCapture(page, base);
      try {
        await capture.beginAction("lost-entry");
        await page.goto(base + "/lost");
        await capture.beginAction("next-entry");
        await page.goto(base + "/retained");
        const result = await capture.seal();
        expect(dropped.size).toBe(1);
        expect(droppedReceipts).toBeGreaterThanOrEqual(3);
        expect(
          result.receipts.filter((row) => row.kind === "open"),
        ).toHaveLength(1);
        await info.attach("native-whole-document-loss", {
          body: JSON.stringify({ droppedReceipts, result }),
          contentType: "application/json",
        });
        expect(result.complete).toBe(false);
        expect(result.errors).toContain(
          "identity document census differs from observed navigations",
        );
      } finally {
        await capture.dispose();
        if (originalDescriptor)
          Object.defineProperty(page, "exposeBinding", originalDescriptor);
        else Reflect.deleteProperty(page, "exposeBinding");
      }
    },
    identityFixtureScript,
  );
});

for (const outcome of ["reject", "wrong-ack"] as const)
  test(`a closed old document reports its late producer ${outcome} before navigation`, async ({
    page,
  }, info) => {
    await withHttp(
      page,
      ({ response }) => response.end("ok"),
      async (base) => {
        const capture = await installIdentityCapture(page, base);
        try {
          await capture.beginAction("entry");
          await page.goto(base + "/old");
          await page.evaluate(async (outcome) => {
            const w = window as unknown as Record<string, unknown>;
            const original = w.__deerflow_parity_receipt_v1__ as (
              row: unknown,
            ) => Promise<unknown>;
            let release: () => void = () => undefined;
            const barrier = new Promise<void>((resolve) => {
              release = resolve;
            });
            w.__deerflow_parity_receipt_v1__ = async (row: {
              kind: string;
            }) => {
              const ack = await original(row);
              if (row.kind !== "event") return ack;
              await barrier;
              if (outcome === "reject")
                throw new Error("fixture old-document rejection");
              return "wrong-old-document-ack";
            };
            const control = w.__deerflow_parity_transport_v1__ as {
              seal(reason: "pagehide"): unknown;
              drain(): Promise<unknown>;
            };
            // Close through the real collector's public control, then settle a
            // deliberately delayed ACK before the old realm is destroyed. This
            // tests post-close reporting, not a claim of naturally racing pagehide.
            (w.fixtureEmitIdentity as (raw: string) => void)(
              "pending-producer",
            );
            control.seal("pagehide");
            release();
            await control.drain();
            w.__deerflow_parity_receipt_v1__ = original;
          }, outcome);
          // No new semantic action inside an already sealed realm. This native
          // navigation belongs to the same action and initializes its fresh seed.
          await page.goto(base + "/new");
          const result = await capture.seal();
          await info.attach(`native-old-document-${outcome}`, {
            body: JSON.stringify(result),
            contentType: "application/json",
          });
          expect(result.complete).toBe(false);
          expect(
            result.errors.some((error) => error.includes("transport")),
          ).toBe(true);
        } finally {
          await capture.dispose();
        }
      },
      identityFixtureScript,
    );
  });

test("a legitimate delayed opening receipt keeps its original action after a later action begins", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const expose = page.exposeBinding.bind(page);
      const descriptor = Object.getOwnPropertyDescriptor(page, "exposeBinding");
      let release: () => void = () => undefined;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      Object.defineProperty(page, "exposeBinding", {
        configurable: true,
        value: async (...args: Parameters<Page["exposeBinding"]>) => {
          const [name, callback, options] = args;
          return expose(
            name,
            async (source, ...values) => {
              if ((values[0] as { kind: string }).kind === "open")
                await barrier;
              return callback(source, ...values);
            },
            options,
          );
        },
      });
      const capture = await installIdentityCapture(page, base);
      try {
        await capture.beginAction("entry");
        await page.goto(base);
        await capture.beginAction("steps:4");
        release();
        const result = await capture.seal();
        await info.attach("native-late-opening-origin", {
          body: JSON.stringify(result),
          contentType: "application/json",
        });
        expect(result.receipts.find((row) => row.kind === "open")?.action).toBe(
          "entry",
        );
        expect(
          result.receipts.find((row) => row.kind === "event")?.packet?.action,
        ).toBe("entry");
        expect(result.complete).toBe(true);
        expect(result.errors).toEqual([]);
      } finally {
        release();
        await capture.dispose();
        if (descriptor)
          Object.defineProperty(page, "exposeBinding", descriptor);
        else Reflect.deleteProperty(page, "exposeBinding");
      }
    },
    identityFixtureScript,
  );
});

test("an unacknowledged producer cannot become complete merely because its payload reached Node", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const capture = await installIdentityCapture(page, base);
      try {
        await capture.beginAction("entry");
        await page.goto(base);
        await page.evaluate(() => {
          const w = window as unknown as Record<string, unknown>;
          const original = w.__deerflow_parity_receipt_v1__ as (
            row: unknown,
          ) => Promise<unknown>;
          const blocked = new Promise<void>((resolve) => {
            w.fixtureReleaseAck = resolve;
          });
          w.__deerflow_parity_receipt_v1__ = async (row: { kind: string }) => {
            const ack = await original(row);
            if (row.kind === "event") await blocked;
            return ack;
          };
          (w.fixtureEmitIdentity as (raw: string) => void)("pending-at-cutoff");
        });
        const result = await capture.seal();
        expect(
          result.receipts.some(
            (row) => row.packet?.values.raw === "pending-at-cutoff",
          ),
        ).toBe(true);
        expect(result.complete).toBe(false);
        expect(result.errors).toContain("identity finite receipt drain failed");
        expect(result.errors).toContain(
          "identity document has unsettled producer receipts",
        );
        await info.attach("native-unacknowledged-cutoff", {
          body: JSON.stringify(result),
          contentType: "application/json",
        });
        const frozen = JSON.stringify(result);
        await page.evaluate(() =>
          (
            window as unknown as { fixtureReleaseAck(): void }
          ).fixtureReleaseAck(),
        );
        expect(JSON.stringify(await capture.seal())).toBe(frozen);
      } finally {
        await capture.dispose();
      }
    },
    identityFixtureScript,
  );
});

test("overlapping future init seeds are diagnosed in the actual new document", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const capture = await installIdentityCapture(page, base);
      const add = page.addInitScript.bind(page);
      const descriptor = Object.getOwnPropertyDescriptor(page, "addInitScript");
      try {
        await capture.beginAction("entry");
        await page.goto(base);
        Object.defineProperty(page, "addInitScript", {
          configurable: true,
          value: async (...args: Parameters<Page["addInitScript"]>) => {
            const [fn, arg] = args;
            const resource = await add(fn, arg);
            await page.goto(base + "/between-seeds");
            return resource;
          },
        });
        await capture.beginAction("steps:1");
        const result = await capture.seal();
        expect(result.complete).toBe(false);
        expect(result.errors).toContain(
          "identity document initialized by conflicting action seeds",
        );
        await info.attach("native-overlapping-init-seeds", {
          body: JSON.stringify(result),
          contentType: "application/json",
        });
      } finally {
        if (descriptor)
          Object.defineProperty(page, "addInitScript", descriptor);
        else Reflect.deleteProperty(page, "addInitScript");
        await capture.dispose();
      }
    },
    identityFixtureScript,
  );
});

test("navigation during the finite census drain is invalid and cannot evade the copied pending set", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const capture = await installIdentityCapture(page, base);
      const frame = page.mainFrame();
      const evaluate = frame.evaluate.bind(frame);
      const descriptor = Object.getOwnPropertyDescriptor(frame, "evaluate");
      let release: () => void = () => undefined;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      let held = false;
      let pending: ReturnType<typeof capture.seal> | undefined;
      try {
        await capture.beginAction("entry");
        Object.defineProperty(frame, "evaluate", {
          configurable: true,
          value: async (...args: Parameters<typeof frame.evaluate>) => {
            const [fn, arg] = args;
            const value = await evaluate(fn, arg);
            if (!held) {
              held = true;
              await barrier;
            }
            return value;
          },
        });
        await page.goto(base + "/first");
        pending = capture.seal();
        await page.goto(base + "/during-cutoff");
        release();
        const result = await pending;
        expect(held).toBe(true);
        expect(new URL(page.url()).pathname).toBe("/during-cutoff");
        expect(result.complete).toBe(false);
        expect(result.errors).toContain(
          "identity navigation crossed capture cutoff",
        );
        await info.attach("native-navigation-during-census-drain", {
          body: JSON.stringify(result),
          contentType: "application/json",
        });
      } finally {
        release();
        await pending;
        if (descriptor) Object.defineProperty(frame, "evaluate", descriptor);
        else Reflect.deleteProperty(frame, "evaluate");
        await capture.dispose();
      }
    },
    identityFixtureScript,
  );
});

test("identity observation leaves a native fixture's wire requests focus storage and navigation unchanged", async ({
  page,
  browser,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const results: unknown[] = [];
      for (const enabled of [false, true]) {
        const context = await browser.newContext();
        const current = await context.newPage();
        const network = recordNetwork(current, base);
        const capture = enabled
          ? await installIdentityCapture(current, base)
          : undefined;
        try {
          await capture?.beginAction("entry");
          await current.goto(base + "/transparent");
          await current.waitForFunction(
            () =>
              (window as unknown as { fixtureReady?: boolean }).fixtureReady ===
              true,
          );
          await capture?.beginAction("steps:2");
          await current.locator("#fixture-input").fill("edited value");
          await current.evaluate(() =>
            history.pushState({}, "", "/transparent/adopted"),
          );
          const identity = await capture?.seal();
          if (identity) expect(identity.errors).toEqual([]);
          const projection = projectNetwork(network.stop(), base);
          expect(projection.observationErrors).toEqual([]);
          const state = await current.evaluate(() => ({
            focus: document.activeElement?.id,
            input: (
              document.querySelector("#fixture-input") as HTMLInputElement
            ).value,
            storage: sessionStorage.getItem("identity-fixture"),
            path: location.pathname,
          }));
          results.push({ projection, state });
          if (identity)
            await info.attach("native-observation-on-fixture", {
              body: JSON.stringify(identity),
              contentType: "application/json",
            });
        } finally {
          network.stop();
          await capture?.dispose();
          await context.close();
        }
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[0]).toMatchObject({
        state: {
          focus: "fixture-input",
          input: "edited value",
          storage: "unchanged",
          path: "/transparent/adopted",
        },
      });
      await info.attach("native-observation-transparency", {
        body: JSON.stringify(results),
        contentType: "application/json",
      });
    },
    identityFixtureScript +
      `
    const input = document.createElement("input"); input.id = "fixture-input"; document.body.append(input); input.focus();
    sessionStorage.setItem("identity-fixture", "unchanged");
    fetch("/api/echo", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ literal:"thread-fixture" }) })
      .then(response => response.text()).then(() => { window.fixtureReady = true; });
  `,
  );
});

for (const mode of ["registered-other-open", "unregistered-seal-copy"] as const)
  test(`identity admission rejects ${mode} through every receipt delivery path`, async ({
    page,
  }, info) => {
    await withHttp(
      page,
      ({ response }) => response.end("ok"),
      async (base) => {
        const expose = page.exposeBinding.bind(page);
        const evaluate = page.evaluate.bind(page);
        const descriptors = ["exposeBinding", "evaluate"].map(
          (name) =>
            [name, Object.getOwnPropertyDescriptor(page, name)] as const,
        );
        const change = (row: {
          kind: string;
          generation: number;
          action: string | null;
        }) => {
          if (mode === "registered-other-open" && row.kind === "open")
            return { ...row, generation: 0, action: null };
          if (mode === "unregistered-seal-copy")
            return { ...row, generation: 999, action: "never-issued" };
          return row;
        };
        Object.defineProperty(page, "exposeBinding", {
          configurable: true,
          value: async (...args: Parameters<Page["exposeBinding"]>) => {
            const [name, callback, options] = args;
            return expose(
              name,
              (source, ...values) => {
                const row = values[0] as {
                  kind: string;
                  document: string;
                  sequence: number;
                  generation: number;
                  action: string | null;
                };
                if (mode === "unregistered-seal-copy")
                  return `${row.document}:${row.sequence}`;
                return callback(source, change(row));
              },
              options,
            );
          },
        });
        Object.defineProperty(page, "evaluate", {
          configurable: true,
          value: async (...args: Parameters<Page["evaluate"]>) => {
            const result = (await evaluate(...args)) as {
              rows?: Array<{
                kind: string;
                generation: number;
                action: string | null;
              }>;
            } | null;
            if (result && Array.isArray(result.rows))
              return { ...result, rows: result.rows.map(change) };
            return result;
          },
        });
        const capture = await installIdentityCapture(page, base);
        try {
          await capture.beginAction("entry");
          await page.goto(base);
          const snapshot = await capture.seal();
          await info.attach(`native-seed-${mode}`, {
            body: JSON.stringify(snapshot),
            contentType: "application/json",
          });
          expect(snapshot.complete).toBe(false);
          expect(snapshot.errors).toContain(
            mode === "registered-other-open"
              ? "identity document bootstrap differs from navigation census"
              : "identity receipt has an unregistered action seed",
          );
        } finally {
          for (const [name, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(page, name, descriptor);
            else Reflect.deleteProperty(page, name);
          }
          await capture.dispose();
        }
      },
      identityFixtureScript,
    );
  });

const captureFixture: ParityScenario = {
  id: "capture-lifecycle-fixture",
  title: "Actual capture entry",
  backend: "gateway",
  path: "/",
  settle: [{ kind: "visible", target: { text: "Ready" } }],
};
const captureFixtureScript =
  identityFixtureScript + 'document.body.append("Ready");';

test("captureScenario saves identity receipts and releases hooks on success and same-page reuse", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const tokens: string[] = [];
      for (const id of ["first", "second"]) {
        const result = await captureScenario(
          page,
          base,
          captureFixture,
          DEFAULT_DIMENSION,
          { id, steps: [{ kind: "press", key: "Tab" }] },
          0,
        );
        expect(result.observationErrors).toEqual([]);
        const attachment = info.attachments.find((item) =>
          item.name.startsWith(`parity-network-${captureFixture.id}-${id}-`),
        )!;
        const record = JSON.parse(
          (attachment.body ?? (await readFile(attachment.path!))).toString(),
        );
        expect(record.completed).toBe(true);
        expect(record.identity.complete).toBe(true);
        expect(
          record.identity.receipts
            .filter((row: { kind: string }) => row.kind === "action")
            .map((row: { action: string }) => row.action),
        ).toEqual(["settle:0", "steps:0"]);
        expect(
          record.identity.receipts.find(
            (row: { kind: string }) => row.kind === "event",
          ).packet.action,
        ).toBe("entry");
        tokens.push(record.identity.capture);
        expect(
          await page.evaluate(() =>
            [
              "__deerflow_parity_capture_v1__",
              "__deerflow_parity_transport_v1__",
              "__deerflow_parity_receipt_v1__",
            ].map((name) => Object.hasOwn(window, name)),
          ),
        ).toEqual([false, false, false]);
      }
      expect(new Set(tokens).size).toBe(2);
    },
    captureFixtureScript,
  );
});

for (const actionFails of [false, true])
  test(`captureScenario preserves attachment failure with action failure=${actionFails}`, async ({
    page,
  }, info) => {
    await withHttp(
      page,
      ({ response }) => response.end("ok"),
      async (base) => {
        const attach = info.attach.bind(info);
        const descriptor = Object.getOwnPropertyDescriptor(info, "attach");
        const attachmentFailure = new Error(
          "fixture durable attachment failure",
        );
        let attempted = "";
        Object.defineProperty(info, "attach", {
          configurable: true,
          value: async (...args: Parameters<typeof info.attach>) => {
            if (args[0].startsWith(`parity-network-${captureFixture.id}-`)) {
              if (args[1]?.body === undefined)
                throw new Error("Expected in-memory evidence attachment");
              attempted = String(args[1].body);
              throw attachmentFailure;
            }
            return attach(...args);
          },
        });
        let failure: unknown;
        try {
          await captureScenario(
            page,
            base,
            captureFixture,
            DEFAULT_DIMENSION,
            {
              id: "attachment-failure",
              steps: actionFails
                ? [{ kind: "press", key: "CaptureUnknownKey" }]
                : [],
            },
            0,
          );
        } catch (error) {
          failure = error;
        } finally {
          if (descriptor) Object.defineProperty(info, "attach", descriptor);
          else Reflect.deleteProperty(info, "attach");
        }
        if (actionFails) {
          expect(failure).toBeInstanceOf(AggregateError);
          expect((failure as AggregateError).cause).toBe(
            (failure as AggregateError).errors[0],
          );
          expect(String((failure as AggregateError).cause)).toContain(
            "CaptureUnknownKey",
          );
          expect((failure as AggregateError).errors).toContain(
            attachmentFailure,
          );
        } else expect(failure).toBe(attachmentFailure);
        const record = JSON.parse(attempted);
        expect(record.completed).toBe(!actionFails);
        expect(record.identity.complete).toBe(true);
        expect(record.cleanupErrors).toEqual([]);
        await info.attach(`native-capture-attachment-failure-${actionFails}`, {
          body: attempted,
          contentType: "application/json",
        });
        const next = await installIdentityCapture(page, base);
        expect(await next.dispose()).toEqual([]);
      },
      captureFixtureScript,
    );
  });

test("captureScenario records failed setup and still releases an installed binding", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const descriptor = Object.getOwnPropertyDescriptor(page, "addInitScript");
      const failure = new Error("fixture capture init failure");
      Object.defineProperty(page, "addInitScript", {
        configurable: true,
        value: async () => {
          throw failure;
        },
      });
      try {
        await expect(
          captureScenario(
            page,
            base,
            captureFixture,
            DEFAULT_DIMENSION,
            { id: "setup-failure", steps: [] },
            0,
          ),
        ).rejects.toBe(failure);
      } finally {
        if (descriptor)
          Object.defineProperty(page, "addInitScript", descriptor);
        else Reflect.deleteProperty(page, "addInitScript");
      }
      const attachment = info.attachments.find((item) =>
        item.name.startsWith(
          `parity-network-${captureFixture.id}-setup-failure-`,
        ),
      )!;
      const record = JSON.parse(
        (attachment.body ?? (await readFile(attachment.path!))).toString(),
      );
      expect(record.completed).toBe(false);
      expect(record.identity).toBeNull();
      expect(record.snapshot.requests).toEqual([]);
      const next = await installIdentityCapture(page, base);
      expect(await next.dispose()).toEqual([]);
    },
    captureFixtureScript,
  );
});

test("captureScenario cannot return success after a registered resource cleanup failure", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const expose = page.exposeBinding.bind(page);
      const descriptor = Object.getOwnPropertyDescriptor(page, "exposeBinding");
      let cleanups = 0;
      Object.defineProperty(page, "exposeBinding", {
        configurable: true,
        value: async (...args: Parameters<Page["exposeBinding"]>) => {
          const resource = await expose(...args);
          return {
            dispose: async () => {
              await resource.dispose();
              cleanups += 1;
              throw new Error("fixture cleanup error");
            },
          };
        },
      });
      try {
        await expect(
          captureScenario(
            page,
            base,
            captureFixture,
            DEFAULT_DIMENSION,
            { id: "cleanup-failure", steps: [] },
            0,
          ),
        ).rejects.toThrow("cleanup");
      } finally {
        if (descriptor)
          Object.defineProperty(page, "exposeBinding", descriptor);
        else Reflect.deleteProperty(page, "exposeBinding");
      }
      expect(cleanups).toBe(1);
      const attachment = info.attachments.find((item) =>
        item.name.startsWith(
          `parity-network-${captureFixture.id}-cleanup-failure-`,
        ),
      )!;
      const record = JSON.parse(
        (attachment.body ?? (await readFile(attachment.path!))).toString(),
      );
      expect(record.completed).toBe(false);
      expect(record.identity.complete).toBe(true);
      expect(record.cleanupErrors).toEqual([
        "identity registered-resource cleanup failed",
      ]);
      const next = await installIdentityCapture(page, base);
      expect(await next.dispose()).toEqual([]);
    },
    captureFixtureScript,
  );
});

for (const mode of [
  "seal-reject",
  "seal-timeout",
  "drain-reject",
  "invalid-packet",
] as const)
  test(`captureScenario rejects ${mode}, saves partial identity and releases its page`, async ({
    page,
  }, info) => {
    await withHttp(
      page,
      ({ response }) => response.end("ok"),
      async (base) => {
        const evaluate = page.evaluate.bind(page);
        const descriptor = Object.getOwnPropertyDescriptor(page, "evaluate");
        let sealed = false;
        Object.defineProperty(page, "evaluate", {
          configurable: true,
          value: async (...args: Parameters<Page["evaluate"]>) => {
            const input = args[1] as
              { operation?: string; name?: string } | undefined;
            if (input?.operation === "seal") {
              sealed = true;
              if (mode === "seal-reject")
                throw new Error("fixture seal rejection");
              if (mode === "seal-timeout") return new Promise(() => undefined);
            }
            if (
              sealed &&
              input?.name === "__deerflow_parity_transport_v1__" &&
              !input.operation &&
              mode === "drain-reject"
            )
              throw new Error("fixture drain rejection");
            return evaluate(...args);
          },
        });
        try {
          await expect(
            captureScenario(
              page,
              base,
              captureFixture,
              DEFAULT_DIMENSION,
              { id: mode, steps: [] },
              0,
            ),
          ).rejects.toThrow("Invalid capture observation");
        } finally {
          if (descriptor) Object.defineProperty(page, "evaluate", descriptor);
          else Reflect.deleteProperty(page, "evaluate");
        }
        const attachment = info.attachments.find((item) =>
          item.name.startsWith(`parity-network-${captureFixture.id}-${mode}-`),
        )!;
        const record = JSON.parse(
          (attachment.body ?? (await readFile(attachment.path!))).toString(),
        );
        expect(record.completed).toBe(false);
        expect(record.identity.complete).toBe(false);
        expect(record.identity.errors.length).toBeGreaterThan(0);
        expect(record.cleanupErrors).toEqual([]);
        const next = await installIdentityCapture(page, base);
        expect(await next.dispose()).toEqual([]);
      },
      captureFixtureScript +
        (mode === "invalid-packet"
          ? 'window.dispatchEvent(new CustomEvent("deerflow:parity-identity:v1", {detail: {unknown: true}}));'
          : ""),
    );
  });

test("captureScenario cuts off network before draining a known pending identity ACK", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("after-cutoff"),
    async (base, arrivals) => {
      const evaluate = page.evaluate.bind(page);
      const descriptor = Object.getOwnPropertyDescriptor(page, "evaluate");
      let sealed = false;
      let crossed = false;
      Object.defineProperty(page, "evaluate", {
        configurable: true,
        value: async (...args: Parameters<Page["evaluate"]>) => {
          const input = args[1] as
            { operation?: string; name?: string } | undefined;
          if (input?.operation === "seal") {
            const value = await evaluate(...args);
            sealed = true;
            return value;
          }
          if (
            sealed &&
            !crossed &&
            input?.name === "__deerflow_parity_transport_v1__" &&
            !input.operation
          ) {
            crossed = true;
            await evaluate(async () => {
              await (await fetch("/api/after-cutoff")).text();
              (
                window as unknown as { releaseIdentityAck(): void }
              ).releaseIdentityAck();
            });
          }
          return evaluate(...args);
        },
      });
      try {
        const result = await captureScenario(
          page,
          base,
          captureFixture,
          DEFAULT_DIMENSION,
          { id: "adjacent-cutoff", steps: [] },
          0,
        );
        expect(result.observationErrors).toEqual([]);
      } finally {
        if (descriptor) Object.defineProperty(page, "evaluate", descriptor);
        else Reflect.deleteProperty(page, "evaluate");
      }
      expect(crossed).toBe(true);
      expect(arrivals).toHaveLength(1);
      const attachment = info.attachments.find((item) =>
        item.name.startsWith(
          `parity-network-${captureFixture.id}-adjacent-cutoff-`,
        ),
      )!;
      const record = JSON.parse(
        (attachment.body ?? (await readFile(attachment.path!))).toString(),
      );
      expect(record.completed).toBe(true);
      expect(record.identity.complete).toBe(true);
      expect(
        record.identity.receipts.find(
          (row: { kind: string }) => row.kind === "close",
        ).pending.length,
      ).toBeGreaterThan(0);
      expect(record.identity.receipts.at(-1).kind).toBe("settled");
      expect(record.snapshot.requests).toEqual([]);
    },
    `
    if (window.__deerflow_parity_capture_v1__) {
      const binding = window.__deerflow_parity_receipt_v1__;
      const barrier = new Promise(resolve => { window.releaseIdentityAck = resolve; });
      window.__deerflow_parity_receipt_v1__ = async row => {
        const ack = await binding(row);
        if (row.kind === "event") await barrier;
        return ack;
      };
    }
  ` + captureFixtureScript,
  );
});

for (const navigation of ["same-document", "new-document"] as const)
  test(`overlapping ${navigation} reads preserve the actual document boundary`, async ({
    page,
  }, info) => {
    await withHttp(
      page,
      ({ response }) => response.end("ok"),
      async (base) => {
        const capture = await installIdentityCapture(page, base);
        const frame = page.mainFrame();
        const evaluate = frame.evaluate.bind(frame);
        const descriptor = Object.getOwnPropertyDescriptor(frame, "evaluate");
        let release: () => void = () => undefined;
        const barrier = new Promise<void>((resolve) => {
          release = resolve;
        });
        let held = false;
        await capture.beginAction("entry");
        Object.defineProperty(frame, "evaluate", {
          configurable: true,
          value: async (...args: Parameters<typeof frame.evaluate>) => {
            const value = await evaluate(...args);
            if (!held) {
              held = true;
              await barrier;
            }
            return value;
          },
        });
        try {
          await page.goto(base + "/initial");
          await expect.poll(() => held).toBe(true);
          if (navigation === "same-document")
            await page.evaluate(() => {
              history.pushState(null, "", "/spa-first");
              history.replaceState(null, "", "/spa-final");
            });
          else await page.goto(base + "/next-document");
          release();
          const result = await capture.seal();
          await info.attach(`native-overlapping-${navigation}`, {
            body: JSON.stringify(result),
            contentType: "application/json",
          });
          expect(
            result.receipts.filter((row) => row.kind === "open"),
          ).toHaveLength(navigation === "same-document" ? 1 : 2);
          expect(result.complete).toBe(navigation === "same-document");
          if (navigation === "same-document") expect(result.errors).toEqual([]);
          else
            expect(result.errors).toContain(
              "identity document census crossed another navigation",
            );
        } finally {
          release();
          if (descriptor) Object.defineProperty(frame, "evaluate", descriptor);
          else Reflect.deleteProperty(frame, "evaluate");
          await capture.dispose();
        }
      },
      identityFixtureScript,
    );
  });

for (const replacement of [false, true])
  test(`natural BFCache restoration cannot reuse a closed capture; replacement=${replacement}`, async ({
    playwright,
  }, info) => {
    // Playwright 1.59.1 normally disables BFCache. Enable the browser feature
    // only for this actual restoration contract; do not synthesize pageshow.
    const browser = await playwright.chromium.launch({
      channel: "chromium",
      headless: true,
      ignoreDefaultArgs: ["--disable-back-forward-cache"],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await withHttp(
        page,
        ({ response }) => response.end("ok"),
        async (base) => {
          const first = await installIdentityCapture(page, base);
          let current = first;
          try {
            await first.beginAction("entry");
            await page.goto(base + "/first");
            const firstDocument = await page.evaluate(
              () =>
                (
                  window as unknown as {
                    __deerflow_parity_transport_v1__: {
                      describe(): { document: string };
                    };
                  }
                ).__deerflow_parity_transport_v1__.describe().document,
            );
            await page.goto(base + "/second");
            if (replacement) {
              const previous = await first.seal();
              await info.attach("native-before-bfcache-replacement", {
                body: JSON.stringify(previous),
                contentType: "application/json",
              });
              // Frozen documents can retain their terminal binding call until
              // restore. This discarded capture may therefore be incomplete;
              // its raw status is preserved, never accepted or repaired here.
              expect(
                previous.receipts.filter((row) => row.kind === "open"),
              ).toHaveLength(2);
              expect(await first.dispose()).toEqual([]);
              current = await installIdentityCapture(page, base);
              await current.beginAction("replacement-entry");
            }
            await page.goBack({ waitUntil: "commit" });
            await page.waitForFunction(
              () =>
                (window as unknown as { fixturePageShows?: boolean[] })
                  .fixturePageShows?.length,
            );
            const restored = await page.evaluate(() => {
              const w = window as unknown as {
                fixturePageShows: boolean[];
                __deerflow_parity_transport_v1__?: {
                  describe(): { document: string };
                };
              };
              return {
                shows: w.fixturePageShows,
                document:
                  w.__deerflow_parity_transport_v1__?.describe().document ??
                  null,
                capability: Object.hasOwn(
                  window,
                  "__deerflow_parity_capture_v1__",
                ),
              };
            });
            await info.attach(`native-bfcache-precondition-${replacement}`, {
              body: JSON.stringify({ firstDocument, restored }),
              contentType: "application/json",
            });
            expect(restored.shows).toEqual([false, true]);
            expect(restored.capability).toBe(false);
            const result = await current.seal();
            await info.attach(`native-bfcache-capture-${replacement}`, {
              body: JSON.stringify(result),
              contentType: "application/json",
            });
            expect(result.complete).toBe(false);
            if (!replacement)
              expect(result.errors).toContain(
                "identity document restored from bfcache without a fresh capture",
              );
            else {
              // The retired collector must release its own restored control.
              // A new capture does not delete another capture's private state.
              expect(restored.document).toBeNull();
              expect(result.errors).toContain(
                "identity document control is missing",
              );
            }
            expect(await current.dispose()).toEqual([]);
            const fresh = await installIdentityCapture(page, base);
            try {
              await fresh.beginAction("fresh-entry");
              await page.goto(base + "/fresh");
              expect((await fresh.seal()).complete).toBe(true);
            } finally {
              await fresh.dispose();
            }
          } finally {
            await current.dispose();
            await first.dispose();
          }
        },
        'window.fixturePageShows = []; window.addEventListener("pageshow", event => window.fixturePageShows.push(event.persisted));' +
          identityFixtureScript,
      );
    } finally {
      try {
        await context.close();
      } finally {
        await browser.close();
      }
    }
  });

test("native network source separates main, child and document requests", async ({
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("seen"),
    async (base) => {
      const observer = recordNetwork(page, base);
      try {
        await page.evaluate(async () => {
          await (await fetch("/api/from-main")).text();
        });
        await page.evaluate(async () => {
          const iframe = document.createElement("iframe");
          iframe.src = "/child";
          const loaded = new Promise<void>((resolve) => {
            iframe.onload = () => resolve();
          });
          document.body.append(iframe);
          await loaded;
        });
        const child = page.frames().find((frame) => frame !== page.mainFrame());
        expect(child).toBeDefined();
        await child!.evaluate(async () => {
          await (await fetch("/api/from-child")).text();
        });
        await page.goto(base + "/api/document");
        const snapshot = observer.stop();
        await info.attach("native-request-source", {
          body: JSON.stringify(snapshot),
          contentType: "application/json",
        });
        expect(snapshot.errors).toEqual([]);
        expect(
          snapshot.requests.map((row) => [
            new URL(row.url).pathname,
            row.source,
            row.navigation,
          ]),
        ).toEqual([
          ["/api/from-main", "main-frame", false],
          ["/api/from-child", "child-frame", false],
          ["/api/document", "main-frame", true],
        ]);
        expect(
          snapshot.requests.every((row) => row.response?.status === 200),
        ).toBe(true);
      } finally {
        observer.stop();
      }
    },
  );
});

test("identity seal and disposal leave the application's active SSE reader unchanged on and off", async ({
  page,
  browser,
}, info) => {
  await withHttp(
    page,
    ({ response }) => {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "content-location": "/api/threads/fixed/runs/active",
      });
      response.write("event: metadata\ndata: {}\n\n");
    },
    async (base, arrivals) => {
      const comparisons: unknown[] = [];
      for (const enabled of [false, true]) {
        const context = await browser.newContext();
        const target = await context.newPage();
        const network = recordNetwork(target, base);
        let identity:
          Awaited<ReturnType<typeof installIdentityCapture>> | undefined;
        try {
          if (enabled) {
            identity = await installIdentityCapture(target, base);
            await identity.beginAction("entry");
          }
          await target.goto(base);
          const before = arrivals.length;
          const first = await target.evaluate(async () => {
            const input = document.createElement("input");
            input.id = "stream-input";
            input.value = "still editing";
            document.body.append(input);
            input.focus();
            localStorage.setItem("stream-fixture", "retained");
            const response = await fetch("/api/active-stream", {
              method: "POST",
              body: "original-body",
            });
            const reader = response.body!.getReader(); // The application's sole reader.
            const decoder = new TextDecoder();
            const chunks: string[] = [];
            let finished = false;
            const read = async () => {
              const next = await reader.read();
              finished = next.done;
              const text = next.done ? "" : decoder.decode(next.value);
              if (!next.done) chunks.push(text);
              return { text, done: next.done };
            };
            Object.assign(window, {
              fixtureReadStream: read,
              fixtureStreamState: () => ({ chunks: [...chunks], finished }),
            });
            return read();
          });
          expect(first).toEqual({
            text: "event: metadata\ndata: {}\n\n",
            done: false,
          });
          expect(arrivals).toHaveLength(before + 1);
          const response = arrivals[before]!.response;
          expect(response.destroyed).toBe(false);
          let snapshot: ReturnType<typeof network.stop> | undefined;
          const receipts = await identity?.seal(() => {
            snapshot = network.stop();
          });
          snapshot ??= network.stop();
          if (identity) {
            expect(receipts?.complete).toBe(true);
            expect(receipts?.errors).toEqual([]);
            expect(await identity.dispose()).toEqual([]);
          }
          expect(snapshot.errors).toEqual([]);
          expect(snapshot.requests).toHaveLength(1);
          expect(snapshot.requests[0]).toMatchObject({
            finished: false,
            failure: null,
            source: "main-frame",
            navigation: false,
          });
          expect(
            snapshot.requests[0]!.response?.headers["content-location"],
          ).toBe("/api/threads/fixed/runs/active");
          const frozen = JSON.stringify(snapshot);
          expect(response.destroyed).toBe(false);
          expect(response.writableEnded).toBe(false);
          response.write("event: delta\ndata: continuation-after-cutoff\n\n");
          const second = await target.evaluate(() =>
            (
              window as unknown as {
                fixtureReadStream(): Promise<{ text: string; done: boolean }>;
              }
            ).fixtureReadStream(),
          );
          expect(second).toEqual({
            text: "event: delta\ndata: continuation-after-cutoff\n\n",
            done: false,
          });
          response.end("event: end\ndata: {}\n\n");
          const end = await target.evaluate(async () => {
            const w = window as unknown as {
              fixtureReadStream(): Promise<{ text: string; done: boolean }>;
              fixtureStreamState(): { chunks: string[]; finished: boolean };
            };
            while (!(await w.fixtureReadStream()).done) {
              /* Original reader consumes the original end frame. */
            }
            const input =
              document.querySelector<HTMLInputElement>("#stream-input")!;
            return {
              stream: w.fixtureStreamState(),
              focus: document.activeElement?.id,
              value: input.value,
              storage: localStorage.getItem("stream-fixture"),
              path: location.pathname,
            };
          });
          expect(end.stream).toEqual({
            chunks: [
              "event: metadata\ndata: {}\n\n",
              "event: delta\ndata: continuation-after-cutoff\n\n",
              "event: end\ndata: {}\n\n",
            ],
            finished: true,
          });
          expect(JSON.stringify(snapshot)).toBe(frozen);
          const comparison = {
            facts: projectNetwork(snapshot, base).requestFacts,
            end,
          };
          comparisons.push(comparison);
          await info.attach(`native-active-sse-observation-${enabled}`, {
            body: JSON.stringify({
              snapshot,
              receipts: receipts ?? null,
              comparison,
            }),
            contentType: "application/json",
          });
        } finally {
          network.stop();
          try {
            await identity?.dispose();
          } finally {
            await context.close();
          }
        }
      }
      expect(comparisons[1]).toEqual(comparisons[0]);
    },
  );
});

test("factory fresh-page proof survives the real capture handoff and cannot be reused", async ({
  browser,
  page,
}, info) => {
  await withHttp(
    page,
    ({ response }) => response.end("ok"),
    async (base) => {
      const owned = await createCapturePage(browser);
      try {
        // Playwright already owns tracing for this test-created context.
        const result = await captureScenario(
          owned.page,
          base,
          captureFixture,
          DEFAULT_DIMENSION,
          { id: "fresh", steps: [] },
          0,
        );
        expect(result.observationErrors).toEqual([]);
        const attachment = info.attachments.findLast((item) =>
          item.name.startsWith(`parity-network-${captureFixture.id}-fresh-`),
        )!;
        const evidence = JSON.parse(
          (attachment.body ?? (await readFile(attachment.path!))).toString(),
        );
        expect(evidence.freshPage).toEqual({
          kind: "owned-fresh-page",
          ready: true,
          errors: [],
        });
        expect(evidence.identity.complete).toBe(true);
        expect(evidence.identity.expectedDocuments).toHaveLength(1);
        // A public event after disposal must not reach the retired factory
        // guard. Unit tests separately pin each exact on/off callback pair.
        await owned.context.newPage();
        await expect(
          captureScenario(
            owned.page,
            base,
            captureFixture,
            DEFAULT_DIMENSION,
            { id: "reused", steps: [] },
            0,
          ),
        ).rejects.toThrow(/fresh page proof was already consumed/);
        const reusedAttachment = info.attachments.findLast((item) =>
          item.name.startsWith(`parity-network-${captureFixture.id}-reused-`),
        )!;
        const reused = JSON.parse(
          (
            reusedAttachment.body ?? (await readFile(reusedAttachment.path!))
          ).toString(),
        );
        expect(reused.freshPage.errors).toEqual([
          "fresh page proof was already consumed",
          "fresh page proof was closed before capture",
        ]);
      } finally {
        await owned.close();
      }
    },
    captureFixtureScript,
  );
});

for (const activity of [
  "prior-navigation",
  "install-window",
  "additional-page",
] as const)
  test(`factory provenance rejects ${activity} and preserves the invalid capture`, async ({
    browser,
    page,
  }, info) => {
    await withHttp(
      page,
      ({ response }) => response.end("ok"),
      async (base) => {
        const owned = await createCapturePage(browser);
        const descriptor = Object.getOwnPropertyDescriptor(
          owned.page,
          "addInitScript",
        );
        try {
          if (activity === "prior-navigation") {
            await owned.page.goto(base + "/prior");
            await owned.page.goto("about:blank");
          }
          if (activity === "additional-page") await owned.context.newPage();
          if (activity === "install-window") {
            const original = owned.page.addInitScript.bind(owned.page);
            let injected = false;
            Object.defineProperty(owned.page, "addInitScript", {
              configurable: true,
              value: async (...args: Parameters<typeof original>) => {
                const resource = await original(...args);
                if (!injected) {
                  injected = true;
                  await owned.page.goto(base + "/installation");
                  await owned.page.goto("about:blank");
                }
                return resource;
              },
            });
          }
          let failure: unknown;
          try {
            await captureScenario(
              owned.page,
              base,
              captureFixture,
              DEFAULT_DIMENSION,
              { id: activity, steps: [] },
              0,
            );
          } catch (error) {
            failure = error;
          }
          expect(failure).toBeInstanceOf(Error);
          const attachment = info.attachments.findLast((item) =>
            item.name.startsWith(
              `parity-network-${captureFixture.id}-${activity}-`,
            ),
          )!;
          const evidence = JSON.parse(
            (attachment.body ?? (await readFile(attachment.path!))).toString(),
          );
          expect(evidence.completed).toBe(false);
          expect(evidence.freshPage.kind).toBe("owned-fresh-page");
          expect(evidence.freshPage.errors).toContain(
            activity === "additional-page"
              ? "fresh capture context acquired an additional page"
              : "navigation before capture observation was ready",
          );
          expect(evidence.cleanupErrors).toEqual([]);
          expect(
            await owned.page.evaluate(() =>
              [
                "__deerflow_parity_capture_v1__",
                "__deerflow_parity_transport_v1__",
                "__deerflow_parity_receipt_v1__",
              ].map((name) => Object.hasOwn(window, name)),
            ),
          ).toEqual([false, false, false]);
        } finally {
          if (descriptor)
            Object.defineProperty(owned.page, "addInitScript", descriptor);
          else Reflect.deleteProperty(owned.page, "addInitScript");
          await owned.close();
        }
      },
      captureFixtureScript,
    );
  });
