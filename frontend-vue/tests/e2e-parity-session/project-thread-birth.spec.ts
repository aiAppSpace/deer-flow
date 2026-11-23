/** Real frontend → real session/replay Gateway → SQLite project membership.
 * No route interception, external model, synthetic owner or local metadata grant.
 * /goal prepares membership before PUT/run; any run uses the local replay model.
 */
import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Request as BrowserRequest,
} from "@playwright/test";
import { reactAppPresent } from "../e2e-parity/support/react-preview";
import {
  administratorSession,
  createAccount,
  csrfHeaders,
  VUE_APP,
  REACT_APP,
} from "./session-api";

const isCreate = (request: BrowserRequest) =>
  request.method() === "POST" &&
  /^\/api\/(?:langgraph\/)?threads$/.test(new URL(request.url()).pathname);
const isFollowingOperation = (request: BrowserRequest) =>
  ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
  /\/threads\/[^/]+\/(?:goal|uploads|runs)(?:\/|$)/.test(
    new URL(request.url()).pathname,
  );
async function project(api: APIRequestContext, app: string) {
  const response = await api.post(`${app}/api/projects`, {
    headers: await csrfHeaders(api),
    data: { name: `birth-${randomUUID()}` },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string };
}
async function membership(
  api: APIRequestContext,
  app: string,
  projectId?: string,
) {
  const response = await api.post(`${app}/api/threads/search`, {
    headers: await csrfHeaders(api),
    data: {
      limit: 100,
      offset: 0,
      ...(projectId ? { project_id: projectId } : {}),
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as {
    thread_id: string;
    metadata: Record<string, unknown>;
  }[];
}

for (const [name, app] of [
  ["vue", VUE_APP],
  ["react", REACT_APP],
] as const) {
  test.describe(`${name} authoritative project conversation birth`, () => {
    test.skip(
      name === "react" && !reactAppPresent,
      "React checkout absent; native comparison UNRUN",
    );
    test.beforeEach(async ({ request, context }) => {
      await administratorSession(request, VUE_APP);
      await createAccount(context.request, app);
      await context.addCookies([{ name: "locale", value: "en-US", url: app }]);
    });

    test("goal preparation creates once in the active project; SQL membership survives reload", async ({
      page,
      context,
    }, info) => {
      const target = await project(context.request, app);
      const creates: BrowserRequest[] = [];
      const following: BrowserRequest[] = [];
      page.on("request", (request) => {
        if (isCreate(request)) creates.push(request);
        if (isFollowingOperation(request)) following.push(request);
      });
      await page.goto(`${app}/workspace/chats/new?project=${target.id}`);
      const input = page.getByPlaceholder(/how can i assist you/i);
      await expect(input).toBeVisible();
      await input.fill("/goal project birth check");
      const prepared = page.waitForResponse(
        (response) =>
          /\/threads\/[^/]+\/goal$/.test(new URL(response.url()).pathname) &&
          response.request().method() === "PUT",
      );
      await input.press("Enter");
      expect((await prepared).status()).toBe(200);
      expect(creates).toHaveLength(1);
      const body = creates[0]!.postDataJSON() as {
        thread_id: string;
        project_id: string;
      };
      expect(body.project_id).toBe(target.id);
      expect(following[0]!.url()).toContain(`/threads/${body.thread_id}/goal`);
      const persisted = (
        await membership(context.request, app, target.id)
      ).find((row) => row.thread_id === body.thread_id);
      expect(persisted?.metadata.deerflow_project_id).toBe(target.id);
      await page.goto(`${app}/workspace/chats/${body.thread_id}`);
      await page.reload();
      await expect(
        page.getByPlaceholder(/how can i assist you/i),
      ).toBeVisible();
      expect(
        (await membership(context.request, app, target.id)).find(
          (row) => row.thread_id === body.thread_id,
        )?.metadata.deerflow_project_id,
      ).toBe(target.id);
      const read = await context.request.get(
        `${app}/api/threads/${body.thread_id}`,
      );
      expect(read.status(), await read.text()).toBe(200);
      expect((await read.json()).metadata.deerflow_project_id).toBe(target.id);
      await info.attach(`${name}-persisted-membership`, {
        body: JSON.stringify(
          { create: body, persisted, afterReload: await read.json() },
          null,
          2,
        ),
        contentType: "application/json",
      });
    });

    for (const kind of ["archived", "foreign", "missing"] as const) {
      test(`${kind} project blocks subsequent goal work and preserves a retryable draft`, async ({
        page,
        context,
        playwright,
      }, info) => {
        let projectId: string = randomUUID();
        if (kind === "archived") {
          projectId = (await project(context.request, app)).id;
          const archived = await context.request.post(
            `${app}/api/projects/${projectId}/archive`,
            { headers: await csrfHeaders(context.request) },
          );
          expect(archived.status()).toBe(200);
        }
        if (kind === "foreign") {
          const other = await playwright.request.newContext();
          try {
            await createAccount(other, app);
            projectId = (await project(other, app)).id;
          } finally {
            await other.dispose();
          }
        }
        const creates: BrowserRequest[] = [];
        const following: BrowserRequest[] = [];
        page.on("request", (request) => {
          if (isCreate(request)) creates.push(request);
          if (isFollowingOperation(request)) following.push(request);
        });
        await page.goto(`${app}/workspace/chats/new?project=${projectId}`);
        const input = page.getByPlaceholder(/how can i assist you/i);
        await expect(input).toBeVisible();
        await input.fill("/goal project birth check");
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const rejected = page.waitForResponse((response) =>
            isCreate(response.request()),
          );
          await input.press("Enter");
          const response = await rejected;
          expect(response.status(), await response.text()).toBe(404);
          await expect(input).toHaveValue("/goal project birth check");
          await expect(input).toBeEnabled();
          await expect(
            page
              .getByText(
                "Couldn't link the chat to the project. Your message was not sent — try again.",
                { exact: true },
              )
              .first(),
          ).toBeVisible();
          expect(following).toHaveLength(0);
        }
        expect(creates).toHaveLength(2);
        const ids = creates.map(
          (request) => request.postDataJSON().thread_id as string,
        );
        expect(ids[1]).toBe(ids[0]);
        expect(
          (await membership(context.request, app)).some(
            (row) => row.thread_id === ids[0],
          ),
        ).toBe(false);
        if (kind === "archived") {
          const restored = await context.request.post(
            `${app}/api/projects/${projectId}/restore`,
            { headers: await csrfHeaders(context.request) },
          );
          expect(restored.status()).toBe(200);
          const prepared = page.waitForResponse(
            (response) =>
              /\/threads\/[^/]+\/goal$/.test(
                new URL(response.url()).pathname,
              ) && response.request().method() === "PUT",
          );
          await input.press("Enter");
          expect((await prepared).status()).toBe(200);
          expect(creates).toHaveLength(3);
          expect(creates[2]!.postDataJSON().thread_id).toBe(ids[0]);
          expect(
            (await membership(context.request, app, projectId)).some(
              (row) =>
                row.thread_id === ids[0] &&
                row.metadata.deerflow_project_id === projectId,
            ),
          ).toBe(true);
        }
        await info.attach(`${name}-${kind}-birth-requests`, {
          body: JSON.stringify(
            creates.map((request) => ({
              path: new URL(request.url()).pathname,
              body: request.postDataJSON(),
            })),
            null,
            2,
          ),
          contentType: "application/json",
        });
      });
    }
  });
}
