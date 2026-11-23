/** Pipe to Node inside only the prepared frontend-vue container. No Docker API. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import { Readable } from "node:stream";

const publicOrigin = process.env.INGRESS_PUBLIC_ORIGIN;
assert.match(publicOrigin ?? "", /^http:\/\/vue\.localhost:\d+$/);
const privateOrigin = "http://127.0.0.1:3000";
const cookieJar = new Map();
async function call(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Host", new URL(publicOrigin).host);
  headers.set("Origin", publicOrigin);
  if (cookieJar.size)
    headers.set(
      "Cookie",
      [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; "),
    );
  const outbound = new Request(`${privateOrigin}${path}`, {
    ...options,
    headers,
  });
  // Node fetch drops a custom Host. Send the actual public Host through the
  // native HTTP API so the Gateway can validate the real forwarded origin.
  const body = outbound.body
    ? Buffer.from(await outbound.arrayBuffer())
    : undefined;
  const response = await new Promise((resolve, reject) => {
    const outgoing = request(outbound.url, {
      method: outbound.method,
      headers: Object.fromEntries(outbound.headers),
    });
    outgoing.on("error", reject);
    outgoing.on("response", (incoming) => {
      const responseHeaders = new Headers();
      for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
        responseHeaders.append(
          incoming.rawHeaders[index],
          incoming.rawHeaders[index + 1],
        );
      }
      resolve(
        new Response(
          incoming.statusCode === 204 ? null : Readable.toWeb(incoming),
          { status: incoming.statusCode, headers: responseHeaders },
        ),
      );
    });
    outgoing.end(body);
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0];
    const equal = pair.indexOf("=");
    cookieJar.set(pair.slice(0, equal), pair.slice(equal + 1));
  }
  return response;
}
const json = (data, headers = {}) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(data),
});
assert.equal((await call("/api/v1/auth/setup-status")).status, 200);
assert.equal((await call("/api/v1/auth/me")).status, 401);
const email = `nuxt-private-${randomUUID()}@example.com`;
const password = "very-strong-password-123";
const registered = await call(
  "/api/v1/auth/register",
  json({ email, password }),
);
assert.equal(registered.status, 201);
const owner = await (await call("/api/v1/auth/me")).json();
assert.equal(owner.email, email);
assert.notEqual(owner.id, "default");
cookieJar.clear();
const login = await call("/api/v1/auth/login/local", {
  method: "POST",
  body: new URLSearchParams({ username: email, password, remember_me: "true" }),
});
assert.equal(login.status, 200);
assert(
  login.headers
    .getSetCookie()
    .some(
      (cookie) => /^access_token=/.test(cookie) && /HttpOnly/i.test(cookie),
    ),
);
assert.equal((await (await call("/api/v1/auth/me")).json()).id, owner.id);
const csrf = cookieJar.get("csrf_token");
assert(csrf);
const accountHeaders = { "X-Expected-User-Id": owner.id, "X-CSRF-Token": csrf };
assert.equal(
  (
    await call("/api/v1/auth/preferences", {
      ...json({ mode: "ultra" }, { "X-Expected-User-Id": owner.id }),
      method: "PATCH",
    })
  ).status,
  403,
);
assert.equal(
  (
    await call("/api/v1/auth/preferences", {
      ...json(
        { mode: "ultra" },
        { ...accountHeaders, "X-Expected-User-Id": randomUUID() },
      ),
      method: "PATCH",
    })
  ).status,
  409,
);
assert.equal(
  (
    await call("/api/v1/auth/preferences", {
      ...json({ mode: "ultra" }, accountHeaders),
      method: "PATCH",
    })
  ).status,
  204,
);
assert.equal(
  (
    await (
      await call("/api/v1/auth/preferences", { headers: accountHeaders })
    ).json()
  ).mode,
  "ultra",
);
const models = await call("/api/models");
assert.equal(models.status, 200);
assert.match(await models.text(), /scenario-model/);
const threadId = randomUUID();
assert.equal(
  (
    await call(
      "/api/langgraph/threads",
      json({ thread_id: threadId, metadata: {} }, accountHeaders),
    )
  ).status,
  200,
);
const payload = `nuxt-private:${"x".repeat(2 * 1024 * 1024)}`;
const form = new FormData();
form.set(
  "files",
  new Blob([payload], { type: "text/plain" }),
  "private-ingress.txt",
);
const uploaded = await call(`/api/threads/${threadId}/uploads`, {
  method: "POST",
  headers: accountHeaders,
  body: form,
});
assert.equal(uploaded.status, 200);
const file = (await uploaded.json()).files[0];
const artifact = new URL(file.artifact_url, publicOrigin);
artifact.searchParams.set("download", "true");
const download = await call(artifact.pathname + artifact.search);
assert.equal(download.status, 200);
assert.match(download.headers.get("content-disposition"), /attachment/);
assert.equal(await download.text(), payload);
const ranged = await call(artifact.pathname, {
  headers: { Range: "bytes=0-11" },
});
assert.equal(ranged.status, 206);
assert.equal(await ranged.text(), "nuxt-private");
const fixture = JSON.parse(
  await readFile("/acceptance/write_read_file.ultra.json", "utf8"),
);
const runThread = randomUUID();
assert.equal(
  (
    await call(
      "/api/langgraph/threads",
      json({ thread_id: runThread, metadata: {} }, accountHeaders),
    )
  ).status,
  200,
);
const started = performance.now();
const sse = await call(
  `/api/langgraph/threads/${runThread}/runs/stream`,
  json(
    {
      assistant_id: "lead_agent",
      input: { messages: [{ role: "user", content: fixture.prompt }] },
      config: { recursion_limit: 100 },
      context: fixture.context,
      stream_mode: ["values"],
    },
    accountHeaders,
  ),
);
assert.equal(sse.status, 200);
assert.match(sse.headers.get("content-type"), /text\/event-stream/);
const reader = sse.body.getReader();
const decoder = new TextDecoder();
let body = "";
let firstMs;
let chunks = 0;
for (;;) {
  const next = await reader.read();
  if (next.done) break;
  firstMs ??= performance.now() - started;
  chunks += 1;
  body += decoder.decode(next.value, { stream: true });
}
const totalMs = performance.now() - started;
assert(chunks > 1);
assert(totalMs - firstMs > 1000);
assert.match(body, /event: metadata/);
assert.match(body, /event: end/);
assert.doesNotMatch(body, /event: error|replay miss/i);
const note = await call(
  `/api/threads/${runThread}/artifacts/mnt/user-data/outputs/note.txt`,
);
assert.equal(note.status, 200);
assert.equal(await note.text(), "hi from replay.");
console.log(
  JSON.stringify(
    {
      status: "PASS",
      path: "private Nuxt -> real Gateway",
      checks: [
        "real register/login/HttpOnly/owner",
        "CSRF and expected-owner",
        "models",
        "LangGraph thread rewrite",
        "2 MiB multipart upload",
        "exact download and range",
        "incremental replay SSE and exact produced artifact",
      ],
      sse: { chunks, firstMs, totalMs },
      ws: "public nginx -> Gateway is validated separately; no Nuxt WS claim",
    },
    null,
    2,
  ),
);
