/** Real nginx dual-host OIDC, using the existing controlled code/PKCE IdP. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { chromium, expect } from "@playwright/test";

const [metadataPath] = process.argv.slice(2);
assert(metadataPath, "The isolated ingress metadata path is required");
const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.match(metadata.project, /^deerflow-vue-ingress-[\da-f]{10}$/);
assert.equal(metadata.authDisabled, false);
const oidc = metadata.oidc;
assert(oidc, "Prepare the dedicated controlled IdP overlay first");
assert.equal(new URL(oidc.issuer).hostname, "idp.localhost");
const entries = [
  { app: "react", origin: oidc.reactOrigin },
  { app: "vue", origin: oidc.vueOrigin },
];
assert.notEqual(
  new URL(entries[0].origin).hostname,
  new URL(entries[1].origin).hostname,
);
const next = "/workspace/chats/new";
const report = {
  project: metadata.project,
  phase: "oidc",
  status: "FAIL",
  issuer: oidc.issuer,
  entries: [],
  checks: [],
};
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: "en-US",
  viewport: { width: 1440, height: 900 },
});
const held = new Map();
let release;
const permit = new Promise((resolve) => {
  release = resolve;
});
const errors = [];

async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const response = await fetch(path, options);
      return { status: response.status, body: await response.json() };
    },
    { path, options },
  );
}

try {
  // Chromium's native Fetch domain observes every redirect hop, whereas
  // Playwright route intentionally continues redirected requests without
  // exposing a Route. Pause the real IdP request; never replace a response.
  for (const entry of entries) {
    entry.page = await context.newPage();
    const session = await context.newCDPSession(entry.page);
    await session.send("Fetch.enable", {
      patterns: [
        { urlPattern: `${oidc.issuer}/authorize*`, requestStage: "Request" },
      ],
    });
    session.on("Fetch.requestPaused", (event) => {
      held.set(entry.page, new URL(event.request.url));
      void permit
        .then(() =>
          session.send("Fetch.continueRequest", { requestId: event.requestId }),
        )
        .catch((error) => errors.push(`${entry.app}: ${error.message}`));
    });
    entry.page.on("pageerror", (error) =>
      errors.push(`${entry.app}: ${error.message}`),
    );
    entry.callbacks = [];
    entry.page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin !== entry.origin) return;
      if (
        url.pathname === `/api/v1/auth/callback/${oidc.provider}` ||
        (url.pathname === "/auth/callback" &&
          response.request().isNavigationRequest())
      )
        entry.callbacks.push({
          path: url.pathname,
          next: url.searchParams.get("next"),
          status: response.status(),
          location: response.headers().location,
        });
    });
    const login = await entry.page.goto(
      `${entry.origin}/login?next=${encodeURIComponent(next)}`,
    );
    assert.equal(login.status(), 200);
    assert.match(
      await login.text(),
      entry.app === "vue" ? /__nuxt/ : /\/_next\//,
    );
    const providers = await api(entry.page, "/api/v1/auth/providers");
    assert.equal(providers.status, 200);
    assert(
      providers.body.providers.some(
        (provider) => provider.id === oidc.provider,
      ),
    );
    assert.equal((await api(entry.page, "/api/v1/auth/me")).status, 401);
    await expect(
      entry.page.getByRole("button", {
        name: "Continue with M0 Fixture IdP",
        exact: true,
      }),
    ).toBeVisible();
  }
  const flows = Promise.all(
    entries.map(({ page }) =>
      page
        .getByRole("button", {
          name: "Continue with M0 Fixture IdP",
          exact: true,
        })
        .click(),
    ),
  );
  // Register rejection handling while navigation is deliberately pending;
  // awaiting the same promise below still propagates its real failure.
  void flows.catch(() => {});
  await expect.poll(() => held.size, { timeout: 30_000 }).toBe(2);
  const states = [];
  for (const entry of entries) {
    const authorization = held.get(entry.page);
    assert.equal(authorization.origin, oidc.issuer);
    assert.equal(
      authorization.searchParams.get("redirect_uri"),
      `${entry.origin}/api/v1/auth/callback/${oidc.provider}`,
    );
    assert.equal(
      authorization.searchParams.get("code_challenge_method"),
      "S256",
    );
    assert(authorization.searchParams.get("code_challenge"));
    assert(authorization.searchParams.get("nonce"));
    const cookies = await context.cookies(
      `${entry.origin}/api/v1/auth/callback/${oidc.provider}`,
    );
    const state = cookies.filter((cookie) =>
      cookie.name.startsWith("df_oidc_state_"),
    );
    assert.equal(state.length, 1);
    assert.equal(state[0].domain, new URL(entry.origin).hostname);
    assert.equal(state[0].httpOnly, true);
    assert.equal(
      cookies.some((cookie) => cookie.name === "access_token"),
      false,
    );
    states.push(state[0]);
  }
  assert.equal(states[0].name, states[1].name);
  assert(
    states[0].value !== states[1].value,
    "Signed state cookies must differ by hostname",
  );
  assert(
    held.get(entries[0].page).searchParams.get("state") !==
      held.get(entries[1].page).searchParams.get("state"),
    "Pending authorization states must differ by hostname",
  );

  // A state from the other real hostname is rejected before any code exchange,
  // and must not consume the correct host's pending cookie.
  const negative = await context.newPage();
  await negative.goto(`${oidc.vueOrigin}/login`);
  const wrongState = held.get(entries[0].page).searchParams.get("state");
  const mismatch = await api(
    negative,
    `/api/v1/auth/callback/${oidc.provider}?code=fixture-invalid&state=${encodeURIComponent(wrongState)}`,
  );
  assert.equal(mismatch.status, 403);
  assert.equal(mismatch.body.detail, "OIDC state mismatch");
  for (let index = 0; index < entries.length; index += 1) {
    const current = await context.cookies(
      `${entries[index].origin}/api/v1/auth/callback/${oidc.provider}`,
    );
    assert(
      current.find((cookie) => cookie.name === states[index].name)?.value ===
        states[index].value,
      "Rejected cross-host state must preserve the correct pending cookie",
    );
    assert.equal(
      current.some((cookie) => cookie.name === "access_token"),
      false,
    );
  }
  await negative.close();
  report.checks.push(
    "simultaneous same-provider host-only signed state cookies and wrong-host state 403 without consumption",
  );
  release();
  await flows;

  const owners = [];
  for (const entry of entries) {
    await expect(entry.page).toHaveURL(`${entry.origin}${next}`, {
      timeout: 30_000,
    });
    await expect(
      entry.page.getByPlaceholder(/how can i assist you/i),
    ).toBeVisible();
    const gatewayCallback = entry.callbacks.find((callback) =>
      callback.path.startsWith("/api/"),
    );
    assert(gatewayCallback);
    assert.equal(gatewayCallback.status, 302);
    const returned = new URL(gatewayCallback.location, entry.origin);
    assert.equal(returned.origin, entry.origin);
    assert.equal(returned.pathname, "/auth/callback");
    assert.equal(returned.searchParams.get("next"), next);
    assert(
      entry.callbacks.some(
        (callback) =>
          callback.path === "/auth/callback" &&
          callback.status === 200 &&
          callback.next === next,
      ),
    );
    const me = await api(entry.page, "/api/v1/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.email, oidc.expectedEmail);
    assert.equal(me.body.oauth_provider, oidc.provider);
    assert.notEqual(me.body.id, "default");
    owners.push(me.body.id);
    const cookies = await context.cookies(
      `${entry.origin}/api/v1/auth/callback/${oidc.provider}`,
    );
    assert.equal(
      cookies.filter((cookie) => cookie.name.startsWith("df_oidc_state_"))
        .length,
      0,
    );
    const session = cookies.find((cookie) => cookie.name === "access_token");
    const csrf = cookies.find((cookie) => cookie.name === "csrf_token");
    assert(session && session.httpOnly);
    assert.equal(session.domain, new URL(entry.origin).hostname);
    assert(csrf && !csrf.httpOnly);
    const preferences = await api(entry.page, "/api/v1/auth/preferences", {
      headers: { "X-Expected-User-Id": me.body.id },
    });
    assert.equal(preferences.status, 200);
    await entry.page.reload();
    await expect(entry.page).toHaveURL(`${entry.origin}${next}`);
    const afterReload = await api(entry.page, "/api/v1/auth/me");
    assert.equal(afterReload.status, 200);
    assert.equal(afterReload.body.id, me.body.id);
    report.entries.push({
      app: entry.app,
      origin: entry.origin,
      callback: `${entry.origin}/api/v1/auth/callback/${oidc.provider}`,
      owner: me.body.id,
      email: me.body.email,
      sessionHost: session.domain,
      httpOnly: true,
      csrf: true,
      stateConsumed: true,
      reloadOwnerStable: true,
    });
  }
  // Both entries use the same real SQL/provisioned provider identity rather
  // than a fabricated /me response or separate per-frontend owner.
  assert.equal(owners[0], owners[1]);
  const inspection = await context.newPage();
  await inspection.goto(`${oidc.issuer}/health`);
  const log = await api(inspection, "/probe/authorize-log");
  assert.equal(log.status, 200);
  assert.deepEqual(
    log.body.entries
      .slice(-2)
      .map((entry) => entry.redirect_uri)
      .sort(),
    entries
      .map((entry) => `${entry.origin}/api/v1/auth/callback/${oidc.provider}`)
      .sort(),
  );
  await inspection.close();
  assert.deepEqual(errors, []);
  report.checks.push(
    "canonical nginx selects React/Vue HTML; real IdP discovery/code/PKCE/nonce; both own callbacks and next; same SQL owner, consumed state, HttpOnly/CSRF and reload",
  );
  report.status = "PASS";
} finally {
  release();
  await context.close();
  await browser.close();
  // Cookie, state, code, JWT and client-secret values never enter evidence.
  await writeFile(
    join(dirname(metadataPath), "evidence-oidc.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
console.log(JSON.stringify(report, null, 2));
