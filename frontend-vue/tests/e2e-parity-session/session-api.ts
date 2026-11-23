import { randomUUID } from "node:crypto";

import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { PARITY_CONTEXT_OPTIONS } from "../e2e-parity/support/context-options";

export const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3119";
export const REACT_APP =
  process.env.E2E_REACT_APP_URL ?? "http://localhost:3120";
export const PASSWORD = "very-strong-password-123";
const ADMINISTRATOR_EMAIL = "session-parity-admin@example.com";
export const PREFERENCES_PATH = "/api/v1/auth/preferences";

export interface SessionUser {
  id: string;
  email: string;
  system_role: string;
  needs_setup: boolean;
  permissions: string[];
}

export async function csrfHeaders(api: APIRequestContext) {
  const { cookies } = await api.storageState();
  const csrf = cookies.find(({ name }) => name === "csrf_token")?.value;
  expect(Boolean(csrf), "real session must issue a CSRF cookie").toBe(true);
  return { "X-CSRF-Token": csrf ?? "" };
}

export async function currentUser(api: APIRequestContext, app: string) {
  const response = await api.get(`${app}/api/v1/auth/me`);
  expect(response.status()).toBe(200);
  const user = (await response.json()) as SessionUser;
  expect(user.id).toMatch(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i);
  expect(user.id).not.toBe("default");
  expect(Array.isArray(user.permissions)).toBe(true);
  const { cookies } = await api.storageState();
  expect(
    cookies.some(({ name, httpOnly }) => name === "access_token" && httpOnly),
    "authenticated browser owner must come from a real HttpOnly session",
  ).toBe(true);
  return user;
}

export async function createAccount(api: APIRequestContext, app: string) {
  const email = `parity-session-${randomUUID()}@example.com`;
  const response = await api.post(`${app}/api/v1/auth/register`, {
    data: { email, password: PASSWORD },
  });
  expect(response.status()).toBe(201);
  const user = await currentUser(api, app);
  expect(user.system_role).toBe("user");
  return user;
}

export async function administratorSession(
  api: APIRequestContext,
  app: string,
) {
  // A failed test may restart the worker, but the suite's Gateway/SQL store
  // remains alive. Initialize it once; every later case opens a real login.
  const setup = await api.get(`${app}/api/v1/auth/setup-status`);
  expect(setup.status()).toBe(200);
  const { needs_setup: needsSetup } = (await setup.json()) as {
    needs_setup: boolean;
  };
  expect(typeof needsSetup).toBe("boolean");
  let user: SessionUser;
  if (needsSetup) {
    const initialized = await api.post(`${app}/api/v1/auth/initialize`, {
      data: { email: ADMINISTRATOR_EMAIL, password: PASSWORD },
    });
    expect(initialized.status()).toBe(201);
    user = await currentUser(api, app);
  } else {
    user = await login(api, app, ADMINISTRATOR_EMAIL);
  }
  expect(user.email).toBe(ADMINISTRATOR_EMAIL);
  expect(user.system_role).toBe("admin");
  return user;
}

export async function login(
  api: APIRequestContext,
  app: string,
  email: string,
) {
  const response = await api.post(`${app}/api/v1/auth/login/local`, {
    form: { username: email, password: PASSWORD, remember_me: "true" },
  });
  expect(response.status()).toBe(200);
  return currentUser(api, app);
}

export async function preferences(
  api: APIRequestContext,
  app: string,
  owner: string,
) {
  const response = await api.get(`${app}${PREFERENCES_PATH}`, {
    headers: { "X-Expected-User-Id": owner },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as {
    notification_enabled: boolean | null;
    model_name: string | null;
    locale: string | null;
    mode: "flash" | "thinking" | "pro" | "ultra" | null;
  };
}

export async function seedPreferences(
  api: APIRequestContext,
  app: string,
  owner: string,
  enabled: boolean,
  mode: "flash" | "ultra" = "ultra",
) {
  const response = await api.patch(`${app}${PREFERENCES_PATH}`, {
    headers: {
      ...(await csrfHeaders(api)),
      "X-Expected-User-Id": owner,
    },
    data: { notification_enabled: enabled, locale: "en-US", mode },
  });
  expect(response.status()).toBe(204);
}

export async function assignRole(
  administrator: APIRequestContext,
  userId: string,
  role: string,
) {
  const response = await administrator.patch(
    `${VUE_APP}/api/v1/admin/users/${userId}`,
    {
      headers: await csrfHeaders(administrator),
      data: { system_role: role },
    },
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).system_role).toBe(role);
}

export interface AppSession {
  name: "vue" | "react";
  app: string;
  context: BrowserContext;
  page: Page;
}

export async function sessionPair(browser: Browser) {
  const sessions: AppSession[] = [];
  try {
    for (const [name, app] of [
      ["vue", VUE_APP],
      ["react", REACT_APP],
    ] as const) {
      const context = await browser.newContext({
        ...PARITY_CONTEXT_OPTIONS,
        viewport: { width: 1440, height: 900 },
        permissions: ["notifications"],
      });
      await context.addCookies([{ name: "locale", value: "en-US", url: app }]);
      await context.addInitScript(() => {
        localStorage.setItem("theme", "light");
        if (!localStorage.getItem("deerflow.local-settings")) {
          localStorage.setItem(
            "deerflow.local-settings",
            JSON.stringify({
              notification: { enabled: true },
              context: { mode: "ultra" },
            }),
          );
        }
      });
      sessions.push({ name, app, context, page: await context.newPage() });
    }
    return sessions as [AppSession, AppSession];
  } catch (error) {
    await closePair(sessions);
    throw error;
  }
}

export async function closePair(sessions: AppSession[]) {
  await Promise.all(sessions.map(({ context }) => context.close()));
}

let refreshClock = 0;
export async function refreshSession(
  session: AppSession,
  expected: SessionUser,
) {
  // Exercise the production visibility refresh, including its real throttle.
  // Move wall time only; do not advance run timers or bypass the auth owner.
  refreshClock += 61_000;
  await session.page.clock.setFixedTime(new Date(Date.now() + refreshClock));
  // Authentication refreshes on document visibility; account preferences
  // independently refresh on window focus. Headless bringToFront does not
  // guarantee a native window focus event for an already visible page.
  const loaded = session.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === PREFERENCES_PATH &&
      response.request().method() === "GET" &&
      response.request().headers()["x-expected-user-id"] === expected.id &&
      response.status() === 200,
  );
  const refreshed = session.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/auth/me" &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await session.page.bringToFront();
  await session.page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const user = (await (await refreshed).json()) as SessionUser;
  expect(user.id).toBe(expected.id);
  expect(user.system_role).toBe(expected.system_role);
  await session.page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await loaded;
}

export async function screenshots(
  sessions: AppSession[],
  info: TestInfo,
  state: string,
) {
  for (const session of sessions) {
    const path = info.outputPath(`${state}-${session.name}.png`);
    await session.page.screenshot({
      path,
      fullPage: true,
      animations: "disabled",
    });
    await info.attach(`${state}-${session.name}`, {
      path,
      contentType: "image/png",
    });
  }
}
