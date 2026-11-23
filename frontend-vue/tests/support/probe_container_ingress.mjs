/** Real browser/public nginx acceptance. Invoke only on the prepared project. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium, expect, request } from "@playwright/test";

const [metadataPath, phase] = process.argv.slice(2);
assert(
  metadataPath && ["replay", "browser"].includes(phase),
  "metadata.json path and replay|browser phase are required",
);
const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.match(metadata.project, /^deerflow-vue-ingress-[\da-f]{10}$/);
assert.equal(metadata.authDisabled, false);
const origin = metadata.vueOrigin;
const loopbackOrigin = new URL(metadata.reactOrigin);
loopbackOrigin.hostname = "127.0.0.1";
const password = "very-strong-password-123";
const email = `container-ingress-${randomUUID()}@example.com`;
const report = {
  project: metadata.project,
  phase,
  origin,
  status: "FAIL",
  checks: [],
};
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: "en-US",
  viewport: { width: 1440, height: 900 },
});
// Chromium resolves *.localhost itself; Node's APIRequestContext does not on
// every host OS. Setup uses loopback with the real ingress Host header, then
// authenticated API calls use native browser fetch on the actual Vue origin.
const bootstrap = await request.newContext({
  baseURL: loopbackOrigin.toString(),
  extraHTTPHeaders: { Host: new URL(origin).host },
});
const page = await context.newPage();

async function browserRequest(method, url, options = {}) {
  const multipart = options.multipart?.files;
  const response = await page.evaluate(
    async ({ method, url, headers, data, multipart, timeout }) => {
      if (new URL(url, location.origin).origin !== location.origin)
        throw new Error("Authenticated requests must use the Vue origin");
      let body;
      if (multipart) {
        const bytes = Uint8Array.from(atob(multipart.base64), (c) =>
          c.charCodeAt(0),
        );
        body = new FormData();
        body.append(
          "files",
          new Blob([bytes], { type: multipart.mimeType }),
          multipart.name,
        );
      } else if (data !== undefined) {
        body = JSON.stringify(data);
        headers["Content-Type"] = "application/json";
      }
      const result = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeout),
      });
      const bytes = new Uint8Array(await result.arrayBuffer());
      const chunks = [];
      for (let offset = 0; offset < bytes.length; offset += 16384)
        chunks.push(
          String.fromCharCode(...bytes.subarray(offset, offset + 16384)),
        );
      return {
        status: result.status,
        headers: Object.fromEntries(result.headers),
        base64: btoa(chunks.join("")),
      };
    },
    {
      method,
      url,
      headers: options.headers ?? {},
      data: options.data,
      multipart: multipart && {
        name: multipart.name,
        mimeType: multipart.mimeType,
        base64: multipart.buffer.toString("base64"),
      },
      timeout: options.timeout ?? 30_000,
    },
  );
  const body = Buffer.from(response.base64, "base64");
  return {
    status: () => response.status,
    headers: () => response.headers,
    body: async () => body,
    text: async () => body.toString("utf8"),
    json: async () => JSON.parse(body.toString("utf8")),
  };
}

const api = {
  get: (url, options) => browserRequest("GET", url, options),
  post: (url, options) => browserRequest("POST", url, options),
  patch: (url, options) => browserRequest("PATCH", url, options),
};
const observed = new Set();
page.on("request", (outgoing) => {
  if (new URL(outgoing.url()).pathname.startsWith("/api/")) {
    assert.equal(
      new URL(outgoing.url()).origin,
      origin,
      "browser API must remain on the Vue nginx origin",
    );
    observed.add(`${outgoing.method()} ${new URL(outgoing.url()).pathname}`);
  }
});
try {
  const setup = await bootstrap.get("/api/v1/auth/setup-status");
  assert.equal(setup.status(), 200);
  if ((await setup.json()).needs_setup) {
    assert.equal(
      (
        await bootstrap.post("/api/v1/auth/initialize", {
          data: {
            email: `ingress-admin-${randomUUID()}@example.com`,
            password,
          },
        })
      ).status(),
      201,
    );
  }
  assert.equal(
    (
      await bootstrap.post("/api/v1/auth/register", {
        data: { email, password },
      })
    ).status(),
    201,
  );
  assert.equal((await bootstrap.get("/api/v1/auth/me")).status(), 200);
  await page.goto(`${origin}/workspace/chats/new`);
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  assert.equal((await api.get(`${origin}/api/v1/auth/me`)).status(), 401);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  await expect(page.locator("#__nuxt")).toBeVisible();
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
  const me = await api.get(`${origin}/api/v1/auth/me`);
  assert.equal(me.status(), 200);
  const owner = await me.json();
  assert.equal(owner.email, email);
  assert.notEqual(owner.id, "default");
  const cookies = await context.cookies();
  assert(
    cookies.some((cookie) => cookie.name === "access_token" && cookie.httpOnly),
  );
  const csrf = cookies.find((cookie) => cookie.name === "csrf_token")?.value;
  assert(csrf);
  const headers = { "X-CSRF-Token": csrf, Origin: origin };
  const preferencesPath = `${origin}/api/v1/auth/preferences`;
  assert.equal(
    (
      await api.patch(preferencesPath, {
        headers: { "X-Expected-User-Id": owner.id, Origin: origin },
        data: { mode: "ultra" },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await api.patch(preferencesPath, {
        headers: { ...headers, "X-Expected-User-Id": randomUUID() },
        data: { mode: "ultra" },
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await api.patch(preferencesPath, {
        headers: { ...headers, "X-Expected-User-Id": owner.id },
        data: { mode: "ultra", notification_enabled: false },
      })
    ).status(),
    204,
  );
  const preferences = await api.get(preferencesPath, {
    headers: { "X-Expected-User-Id": owner.id },
  });
  assert.equal(preferences.status(), 200);
  assert.equal((await preferences.json()).mode, "ultra");
  report.checks.push(
    "Vue hostname HTML and real UI login/HttpOnly/CSRF/expected-owner",
  );

  const react = await bootstrap.get(
    new URL("/login", loopbackOrigin).toString(),
    {
      headers: { Host: new URL(metadata.reactOrigin).host },
    },
  );
  assert.equal(react.status(), 200);
  assert.match(await react.text(), /\/_next\//);
  const unknownHost = await bootstrap.get(
    new URL("/login", loopbackOrigin).toString(),
    {
      headers: { Host: `unknown.localhost:${metadata.hostPort}` },
    },
  );
  assert.equal(unknownHost.status(), 200);
  assert.match(await unknownHost.text(), /\/_next\//);
  report.checks.push("default and unknown hostname retain React");
  const models = await api.get(`${origin}/api/models`);
  assert.equal(models.status(), 200);
  assert.match(await models.text(), /scenario-model/);

  async function createThread() {
    const threadId = randomUUID();
    const created = await api.post(`${origin}/api/langgraph/threads`, {
      headers,
      data: { thread_id: threadId, metadata: {} },
    });
    assert.equal(created.status(), 200);
    return threadId;
  }

  if (phase === "replay") {
    const uploadThread = await createThread();
    const payload = Buffer.from(`ingress:${"x".repeat(2 * 1024 * 1024)}`);
    const uploaded = await api.post(
      `${origin}/api/threads/${uploadThread}/uploads`,
      {
        headers,
        multipart: {
          files: {
            name: "ingress.txt",
            mimeType: "text/plain",
            buffer: payload,
          },
        },
      },
    );
    assert.equal(uploaded.status(), 200);
    const upload = await uploaded.json();
    assert.equal(upload.success, true);
    assert.equal(upload.files[0].size, payload.byteLength);
    const artifactUrl = new URL(upload.files[0].artifact_url, origin);
    assert.equal(artifactUrl.origin, origin);
    artifactUrl.searchParams.set("download", "true");
    const downloaded = await api.get(artifactUrl.toString());
    assert.equal(downloaded.status(), 200);
    assert.match(downloaded.headers()["content-disposition"], /attachment/);
    assert.deepEqual(await downloaded.body(), payload);
    const ranged = await api.get(artifactUrl.toString(), {
      headers: { Range: "bytes=0-7" },
    });
    assert.equal(ranged.status(), 206);
    assert.equal(await ranged.text(), "ingress:");
    report.checks.push(
      "2 MiB multipart upload and exact download/range through nginx -> Gateway",
    );

    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../../../backend/tests/fixtures/replay/write_read_file.ultra.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const threadId = await createThread();
    const streamed = await page.evaluate(
      async ({ threadId, csrf, fixture }) => {
        const started = performance.now();
        const response = await fetch(
          `/api/langgraph/threads/${threadId}/runs/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrf,
            },
            body: JSON.stringify({
              assistant_id: "lead_agent",
              input: { messages: [{ role: "user", content: fixture.prompt }] },
              config: { recursion_limit: 100 },
              context: fixture.context,
              stream_mode: ["values"],
            }),
          },
        );
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let body = "";
        let chunks = 0;
        let firstMs;
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          chunks += 1;
          firstMs ??= performance.now() - started;
          body += decoder.decode(next.value, { stream: true });
        }
        return {
          status: response.status,
          contentType: response.headers.get("content-type"),
          encoding: response.headers.get("content-encoding"),
          chunks,
          firstMs,
          totalMs: performance.now() - started,
          body,
        };
      },
      { threadId, csrf, fixture },
    );
    assert.equal(streamed.status, 200);
    assert.match(streamed.contentType, /text\/event-stream/);
    assert.equal(streamed.encoding, null, "nginx must not compress SSE");
    assert(
      streamed.chunks > 1,
      "controlled model pause must produce multiple browser-visible chunks",
    );
    assert(
      streamed.totalMs - streamed.firstMs > 1000,
      "metadata must arrive before the 2s model idle window ends",
    );
    assert.match(streamed.body, /event: metadata/);
    assert.match(streamed.body, /event: end/);
    assert.doesNotMatch(streamed.body, /event: error|replay miss/i);
    const note = await api.get(
      `${origin}/api/threads/${threadId}/artifacts/mnt/user-data/outputs/note.txt`,
    );
    assert.equal(note.status(), 200);
    assert.equal(await note.text(), "hi from replay.");
    report.sse = {
      chunks: streamed.chunks,
      firstMs: streamed.firstMs,
      totalMs: streamed.totalMs,
    };
    report.checks.push(
      "incremental uncompressed SSE rewrite and replay-produced exact artifact",
    );
  } else {
    const threadId = await createThread();
    const navigation = await api.post(
      `${origin}/api/threads/${threadId}/browser/navigate`,
      {
        headers,
        data: { url: "http://nginx:2026/login" },
        timeout: 60_000,
      },
    );
    assert.equal(
      navigation.status(),
      200,
      "real browser session must bootstrap before WS",
    );
    assert((await navigation.json()).screenshot);
    const live = await page.evaluate(
      (threadId) =>
        new Promise((resolve) => {
          const socket = new WebSocket(
            `${location.origin.replace(/^http/, "ws")}/api/threads/${threadId}/browser/stream?frame_format=binary`,
          );
          socket.binaryType = "arraybuffer";
          let opened = false;
          let bytes = 0;
          const timeout = setTimeout(() => {
            socket.close();
            resolve({ opened, bytes: 0, closeCode: 0 });
          }, 30_000);
          socket.onopen = () => {
            opened = true;
          };
          socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer && bytes === 0) {
              bytes = event.data.byteLength;
              socket.close(1000);
            }
          };
          socket.onclose = (event) => {
            clearTimeout(timeout);
            resolve({ opened, bytes, closeCode: event.code });
          };
        }),
      threadId,
    );
    assert.equal(live.opened, true, `WS closed with ${live.closeCode}`);
    assert(live.bytes > 0, "a 4404/no-session close is never WS acceptance");
    assert.equal(live.closeCode, 1000, "record the actual WS close event");
    report.ws = live;
    report.checks.push(
      "same-origin Cookie/Origin WS upgrade and real Chromium binary frame through nginx -> Gateway",
    );
  }
  await page.screenshot({
    path: join(metadata.directory, `ingress-${phase}.png`),
    fullPage: true,
  });
  report.status = "PASS";
} finally {
  report.observedBrowserApiPaths = [...observed].sort();
  await writeFile(
    join(metadata.directory, `evidence-${phase}.json`),
    JSON.stringify(report, null, 2) + "\n",
  );
  await bootstrap.dispose();
  await context.close();
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
