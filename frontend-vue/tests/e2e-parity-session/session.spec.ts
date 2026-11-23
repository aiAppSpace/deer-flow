/*
  Real, auth-enabled React/Vue sessions against one isolated SQL/RBAC Gateway.
  All auth/preferences/permission/run responses come from production routes.
  No page.route(), synthetic /me owner, auth-disabled mode or baseline accept.
*/
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  expect,
  test,
  type APIRequestContext,
  type Response,
} from "@playwright/test";

import { reactAppPresent } from "../e2e-parity/support/react-preview";
import {
  administratorSession,
  assignRole,
  closePair,
  createAccount,
  csrfHeaders,
  currentUser,
  login,
  preferences,
  PREFERENCES_PATH,
  refreshSession,
  screenshots,
  seedPreferences,
  sessionPair,
  VUE_APP,
  type AppSession,
  type SessionUser,
} from "./session-api";

test.skip(
  !reactAppPresent,
  "React absent: authenticated dual-app execution UNRUN",
);

let administrator: APIRequestContext;
test.beforeEach(async ({ playwright }) => {
  administrator = await playwright.request.newContext();
  await administratorSession(administrator, VUE_APP);
});
test.afterEach(async () => administrator?.dispose());

async function sameOwner(sessions: [AppSession, AppSession]) {
  const [vue, react] = sessions;
  const owner = await createAccount(vue.context.request, vue.app);
  const other = await login(react.context.request, react.app, owner.email);
  expect(other).toEqual(owner);
  return owner;
}

const notification = (session: AppSession) =>
  session.page.getByRole("switch", { name: "Notification", exact: true });

async function openNotification(
  session: AppSession,
  owner: SessionUser,
  persisted: boolean,
) {
  const loaded = session.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === PREFERENCES_PATH &&
      response.request().method() === "GET",
  );
  await session.page.goto(
    `${session.app}/workspace/chats/new?settings=notification`,
  );
  const response = await loaded;
  expect(response.status()).toBe(200);
  expect(response.request().headers()["x-expected-user-id"]).toBe(owner.id);
  await expect(
    session.page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  const permission = await session.page.evaluate(() => Notification.permission);
  expect(["default", "granted", "denied"]).toContain(permission);
  if (permission === "granted") {
    await expect(notification(session)).toBeEnabled();
  } else {
    await expect(notification(session)).toBeDisabled();
  }
  await expect(notification(session)).toHaveAttribute(
    "aria-checked",
    String(permission === "granted" && persisted),
  );
  if (permission === "denied") {
    await expect(
      session.page.getByText(
        "Notification permission was denied. You can enable it in your browser's site settings to receive completion alerts.",
        { exact: true },
      ),
    ).toBeVisible();
  }
  return permission;
}

async function closeSettings(session: AppSession) {
  const dialog = session.page.getByRole("dialog", {
    name: "Settings",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
}

const modeLabel = (mode: "flash" | "ultra") =>
  mode === "flash" ? "Flash" : "Ultra";

async function expectMode(session: AppSession, mode: "flash" | "ultra") {
  await expect(
    session.page.getByRole("button", { name: modeLabel(mode), exact: true }),
  ).toBeEnabled();
}

async function selectMode(
  session: AppSession,
  owner: SessionUser,
  current: "flash" | "ultra",
  next: "flash" | "ultra",
) {
  await expectMode(session, current);
  const persisted = session.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === PREFERENCES_PATH &&
      response.request().method() === "PATCH" &&
      response.request().postDataJSON().mode === next,
  );
  await session.page
    .getByRole("button", { name: modeLabel(current), exact: true })
    .click();
  await session.page
    .getByRole("menuitemradio", { name: new RegExp(`^${modeLabel(next)}\\b`) })
    .click();
  const response = await persisted;
  expect(response.status()).toBe(204);
  expect(response.request().headers()["x-expected-user-id"]).toBe(owner.id);
  expect(Boolean(response.request().headers()["x-csrf-token"])).toBe(true);
  await expectMode(session, next);
}

async function openThreadMenu(session: AppSession, threadId: string) {
  const row = session.page.locator(
    `a[data-sidebar="menu-button"][href="/workspace/chats/${threadId}"]`,
  );
  await expect(row).toBeVisible();
  await row.hover();
  await row
    .locator("xpath=..")
    .getByRole("button", { name: "More", exact: true })
    .click();
  return session.page.getByRole("menuitem", { name: "Delete", exact: true });
}

test("real session preferences synchronize between frameworks and switch SQL owners without leaking the old account", async ({
  browser,
  playwright,
}, info) => {
  const sessions = await sessionPair(browser);
  const otherAccount = await playwright.request.newContext();
  const oldAccount = await playwright.request.newContext();
  try {
    const owner = await sameOwner(sessions);
    const [vue, react] = sessions;
    await seedPreferences(vue.context.request, vue.app, owner.id, false);
    const permissions: Record<string, NotificationPermission> = {};
    for (const session of sessions) {
      permissions[session.name] = await openNotification(session, owner, false);
      await closeSettings(session);
      await expectMode(session, "ultra");
    }
    // Use a real, editable account field in both frameworks. Native Chromium
    // may deny Notification.permission even after the context grant; its
    // disabled notification switch must remain faithful to that permission.
    await selectMode(vue, owner, "ultra", "flash");
    expect(
      await preferences(react.context.request, react.app, owner.id),
    ).toMatchObject({
      mode: "flash",
      notification_enabled: false,
    });
    await refreshSession(react, owner);
    await expectMode(react, "flash");
    await react.page.reload();
    await expectMode(react, "flash");
    await selectMode(react, owner, "flash", "ultra");
    await refreshSession(vue, owner);
    await expectMode(vue, "ultra");
    await vue.page.reload();
    await expectMode(vue, "ultra");
    await selectMode(vue, owner, "ultra", "flash");
    await seedPreferences(
      vue.context.request,
      vue.app,
      owner.id,
      true,
      "flash",
    );
    await refreshSession(react, owner);
    await expectMode(react, "flash");
    for (const session of sessions) {
      expect(
        await preferences(session.context.request, session.app, owner.id),
      ).toMatchObject({
        mode: "flash",
        notification_enabled: true,
      });
      await openNotification(session, owner, true);
      await closeSettings(session);
    }
    await screenshots(sessions, info, "same-owner");

    const next = await createAccount(otherAccount, VUE_APP);
    await seedPreferences(otherAccount, VUE_APP, next.id, false);
    for (const session of sessions) {
      await login(session.context.request, session.app, next.email);
      const stale = await session.context.request.patch(
        `${session.app}${PREFERENCES_PATH}`,
        {
          headers: {
            ...(await csrfHeaders(session.context.request)),
            "X-Expected-User-Id": owner.id,
          },
          data: { notification_enabled: true, mode: "flash" },
        },
      );
      expect(stale.status()).toBe(409);
      await refreshSession(session, next);
      await expectMode(session, "ultra");
      await session.page.reload();
      await expectMode(session, "ultra");
      await openNotification(session, next, false);
      await closeSettings(session);
    }
    expect(await preferences(otherAccount, VUE_APP, next.id)).toMatchObject({
      mode: "ultra",
      notification_enabled: false,
    });
    await login(oldAccount, VUE_APP, owner.email);
    expect(await preferences(oldAccount, VUE_APP, owner.id)).toMatchObject({
      mode: "flash",
      notification_enabled: true,
    });
    await screenshots(sessions, info, "next-owner");
    await info.attach("owners", {
      body: JSON.stringify({
        previous: owner.id,
        current: next.id,
        authDisabled: false,
        nativeNotificationPermissions: permissions,
      }),
      contentType: "application/json",
    });
  } finally {
    await closePair(sessions);
    await otherAccount.dispose();
    await oldAccount.dispose();
  }
});

test("preferences require real session credentials, expected owner and CSRF; ordinary users cannot manage platform MCP", async ({
  browser,
  playwright,
}, info) => {
  const sessions = await sessionPair(browser);
  const anonymous = await playwright.request.newContext();
  let tokenClient: APIRequestContext | undefined;
  let patId: string | undefined;
  try {
    const owner = await sameOwner(sessions);
    const [vue] = sessions;
    const unauthenticated = await anonymous.get(
      `${VUE_APP}${PREFERENCES_PATH}`,
      { headers: { "X-Expected-User-Id": owner.id } },
    );
    expect(unauthenticated.status()).toBe(401);
    for (const session of sessions) {
      const noCsrf = await session.context.request.patch(
        `${session.app}${PREFERENCES_PATH}`,
        {
          headers: { "X-Expected-User-Id": owner.id },
          data: { notification_enabled: false },
        },
      );
      expect(noCsrf.status()).toBe(403);
      const wrongOwner = await session.context.request.get(
        `${session.app}${PREFERENCES_PATH}`,
        { headers: { "X-Expected-User-Id": randomUUID() } },
      );
      expect(wrongOwner.status()).toBe(409);
      const platformRead = await session.context.request.get(
        `${session.app}/api/mcp/config`,
      );
      expect(platformRead.status()).toBe(403);
      const platformWrite = await session.context.request.put(
        `${session.app}/api/mcp/config`,
        {
          headers: await csrfHeaders(session.context.request),
          data: { mcp_servers: {} },
        },
      );
      expect(platformWrite.status()).toBe(403);
      await session.page.goto(`${session.app}/workspace/capabilities`);
      await expect(
        session.page.getByRole("button", {
          name: "Add MCP plugin (My plugins)",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(
        session.page.getByRole("button", {
          name: "Add MCP plugin (Platform provided)",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        (await currentUser(session.context.request, session.app)).permissions,
      ).toEqual(
        expect.arrayContaining([
          "runs:create",
          "runs:cancel",
          "threads:delete",
        ]),
      );
    }

    // Mint through the real session API, then use a separate cookie-free API
    // context. Credentials stay in memory; attachments never include the PAT.
    const created = await vue.context.request.post(
      `${vue.app}/api/v1/auth/pats`,
      {
        headers: await csrfHeaders(vue.context.request),
        data: {
          name: "session-only-preferences-proof",
          scopes: ["threads:read"],
          expires_in_days: 1,
        },
      },
    );
    expect(created.status()).toBe(201);
    const pat = (await created.json()) as { id: string; token: string };
    patId = pat.id;
    tokenClient = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${pat.token}` },
    });
    for (const session of sessions) {
      const forbidden = await tokenClient.get(
        `${session.app}${PREFERENCES_PATH}`,
        { headers: { "X-Expected-User-Id": owner.id } },
      );
      expect(forbidden.status()).toBe(403);
    }
    await screenshots(sessions, info, "ordinary-permissions");
  } finally {
    if (patId) {
      const revoked = await sessions[0].context.request.delete(
        `${VUE_APP}/api/v1/auth/pats/${patId}`,
        { headers: await csrfHeaders(sessions[0].context.request) },
      );
      expect(revoked.status()).toBe(200);
    }
    await tokenClient?.dispose();
    await anonymous.dispose();
    await closePair(sessions);
  }
});

test("real RBAC role changes drive the same send denial, empty permissions and re-grant in both mounted frontends", async ({
  browser,
}, info) => {
  const sessions = await sessionPair(browser);
  try {
    const owner = await sameOwner(sessions);
    const [vue] = sessions;
    const threadIds = new Map<AppSession, string>();
    for (const session of sessions) {
      const threadId = randomUUID();
      threadIds.set(session, threadId);
      const created = await vue.context.request.post(`${vue.app}/api/threads`, {
        headers: await csrfHeaders(vue.context.request),
        data: {
          thread_id: threadId,
          metadata: { title: `Protected ${session.name} conversation` },
        },
      });
      expect(created.status()).toBe(200);
      await session.page.goto(`${session.app}/workspace/chats/new`);
      await session.page
        .getByPlaceholder(/how can i assist you/i)
        .fill("Permission-gated draft must stay here");
      await expect(
        session.page.getByRole("button", { name: "Submit", exact: true }),
      ).toBeEnabled();
      await expect(await openThreadMenu(session, threadId)).toBeEnabled();
      // Keep the menu mounted across the real role refresh: visibility must
      // respond immediately rather than only on the next menu opening.
    }
    await assignRole(administrator, owner.id, "restricted");
    for (const session of sessions) {
      const restricted = await currentUser(
        session.context.request,
        session.app,
      );
      for (const permission of ["runs:create", "runs:cancel", "threads:delete"])
        expect(restricted.permissions).not.toContain(permission);
      expect(restricted.permissions).toContain("threads:read");
      await refreshSession(session, restricted);
      await expect(
        session.page.getByRole("menuitem", { name: "Delete", exact: true }),
      ).toHaveCount(0);
      await session.page.keyboard.press("Escape");
      const denied = session.page.getByRole("button", {
        name: "Starting a new turn is not permitted for your role.",
        exact: true,
      });
      await expect(denied).toBeDisabled();
      const requests: string[] = [];
      const observe = (request: import("@playwright/test").Request) => {
        if (
          request.method() === "POST" &&
          /\/runs(?:\/stream)?$/.test(new URL(request.url()).pathname)
        )
          requests.push(request.url());
      };
      session.page.on("request", observe);
      await session.page
        .getByPlaceholder(/how can i assist you/i)
        .press("Enter");
      await expect(
        session.page.getByPlaceholder(/how can i assist you/i),
      ).toHaveValue("Permission-gated draft must stay here");
      expect(requests).toEqual([]);
      session.page.off("request", observe);
      const threadId = threadIds.get(session)!;
      const deniedRun = await session.context.request.post(
        `${session.app}/api/threads/${threadId}/runs/stream`,
        {
          headers: await csrfHeaders(session.context.request),
          data: {
            assistant_id: "lead_agent",
            input: { messages: [{ role: "user", content: "denied" }] },
            stream_mode: ["values"],
          },
        },
      );
      expect(deniedRun.status()).toBe(403);
      const deniedDelete = await session.context.request.delete(
        `${session.app}/api/threads/${threadId}`,
        { headers: await csrfHeaders(session.context.request) },
      );
      expect(deniedDelete.status()).toBe(403);
    }
    await screenshots(sessions, info, "restricted-role");
    await assignRole(administrator, owner.id, "no_access");
    for (const session of sessions) {
      const empty = await currentUser(session.context.request, session.app);
      expect(empty.permissions).toEqual([]);
      await refreshSession(session, empty);
      await expect(
        session.page.getByRole("button", {
          name: "Starting a new turn is not permitted for your role.",
          exact: true,
        }),
      ).toBeDisabled();
      // Cosmetic preferences remain session/owner-scoped rather than a route
      // capability, even for an explicitly empty permission list.
      await preferences(session.context.request, session.app, owner.id);
    }
    await assignRole(administrator, owner.id, "user");
    for (const session of sessions) {
      const restored = await currentUser(session.context.request, session.app);
      await refreshSession(session, restored);
      await expect(
        session.page.getByRole("button", { name: "Submit", exact: true }),
      ).toBeEnabled();
      await expect(
        session.page.getByPlaceholder(/how can i assist you/i),
      ).toHaveValue("Permission-gated draft must stay here");
      const threadId = threadIds.get(session)!;
      await (await openThreadMenu(session, threadId)).click();
      const dialog = session.page.getByRole("dialog", {
        name: "Delete chat",
        exact: true,
      });
      await expect(dialog).toBeVisible();
      const deleted = session.page.waitForResponse(
        (response) =>
          response.request().method() === "DELETE" &&
          new URL(response.url()).pathname.endsWith(`/threads/${threadId}`) &&
          response.status() < 300,
      );
      await dialog.getByRole("button", { name: "Delete", exact: true }).click();
      const response = await deleted;
      expect(Boolean(response.request().headers()["x-csrf-token"])).toBe(true);
      await expect(dialog).toBeHidden();
      await expect(
        session.page.locator(
          `a[data-sidebar="menu-button"][href="/workspace/chats/${threadId}"]`,
        ),
      ).toHaveCount(0);
    }
    await screenshots(sessions, info, "regranted-role");
  } finally {
    await closePair(sessions);
  }
});

test("a real active replay run cannot be cancelled after role revocation and becomes stoppable after re-grant in both apps", async ({
  browser,
}, info) => {
  const sessions = await sessionPair(browser);
  try {
    const owner = await sameOwner(sessions);
    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../../../backend/tests/fixtures/replay/write_read_file.ultra.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { prompt: string };
    const runs = new Map<AppSession, string>();
    for (const session of sessions) {
      await seedPreferences(
        session.context.request,
        session.app,
        owner.id,
        false,
      );
      await session.page.goto(`${session.app}/workspace/chats/new`);
      const response = session.page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /\/runs\/stream$/.test(new URL(response.url()).pathname),
      );
      await session.page
        .getByPlaceholder(/how can i assist you/i)
        .fill(fixture.prompt);
      await session.page
        .getByPlaceholder(/how can i assist you/i)
        .press("Enter");
      const started: Response = await response;
      expect(started.status()).toBe(200);
      const location = started.headers()["content-location"];
      expect(location).toMatch(/^\/api\/threads\/[^/]+\/runs\/[^/]+$/);
      runs.set(session, location!);
      await expect(
        session.page.getByRole("button", { name: "Stop", exact: true }),
      ).toBeEnabled();
    }
    await assignRole(administrator, owner.id, "no_cancel");
    for (const session of sessions) {
      const denied = await currentUser(session.context.request, session.app);
      expect(denied.permissions).not.toContain("runs:cancel");
      expect(denied.permissions).toContain("runs:create");
      await refreshSession(session, denied);
      await expect(
        session.page.getByRole("button", {
          name: "Stopping the running turn is not permitted for your role.",
          exact: true,
        }),
      ).toBeDisabled();
      const forbidden = await session.context.request.post(
        `${session.app}${runs.get(session)}/cancel?wait=true&action=interrupt`,
        { headers: await csrfHeaders(session.context.request) },
      );
      expect(forbidden.status()).toBe(403);
      const active = await session.context.request.get(
        `${session.app}${runs.get(session)}`,
      );
      expect(active.status()).toBe(200);
      expect((await active.json()).status).toBe("running");
    }
    await screenshots(sessions, info, "cancel-revoked");
    await assignRole(administrator, owner.id, "user");
    for (const session of sessions) {
      await refreshSession(
        session,
        await currentUser(session.context.request, session.app),
      );
      const stop = session.page.getByRole("button", {
        name: "Stop",
        exact: true,
      });
      await expect(stop).toBeEnabled();
      const cancelled = session.page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /\/cancel$/.test(new URL(response.url()).pathname),
      );
      await stop.click();
      const response = await cancelled;
      expect([202, 204]).toContain(response.status());
      expect(Boolean(response.request().headers()["x-csrf-token"])).toBe(true);
      await expect(
        session.page.getByRole("button", { name: "Submit", exact: true }),
      ).toBeVisible();
    }
    await screenshots(sessions, info, "cancel-regranted");
  } finally {
    await closePair(sessions);
  }
});
