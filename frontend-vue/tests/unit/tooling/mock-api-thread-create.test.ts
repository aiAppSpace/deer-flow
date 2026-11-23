import { describe, expect, it, vi } from "vitest";
import type { Page, Route } from "@playwright/test";
import {
  mockLangGraphAPI,
  type MockAPIOptions,
} from "../../e2e/utils/mock-api";

import { createProjectGatewayMock } from "../../support/project-gateway-mock";

function registerMock(options: MockAPIOptions = {}) {
  const handlers = new Map<string, (route: Route) => unknown>();
  const page = {
    context: () => ({ route: vi.fn().mockResolvedValue(undefined) }),
    route: (pattern: string | RegExp, handler: (route: Route) => unknown) => {
      if (typeof pattern === "string") handlers.set(pattern, handler);
      return Promise.resolve();
    },
  } as unknown as Page;
  mockLangGraphAPI(page, options);
  return async (alias: string, body: Record<string, unknown>) => {
    const fulfill = vi.fn().mockResolvedValue(undefined);
    await handlers.get(`**/api/${alias}`)!({
      request: () => ({ method: () => "POST", postDataJSON: () => body }),
      fulfill,
    } as unknown as Route);
    const result = fulfill.mock.calls[0]![0] as {
      status: number;
      body: string;
    };
    return { status: result.status, body: JSON.parse(result.body) };
  };
}
const aliases = ["threads", "langgraph/threads"];
describe("Gateway thread creation fixture contract", () => {
  it("project creation admission tracks the same mutable project owner", async () => {
    const gateway = createProjectGatewayMock({
      projects: [{ id: "active", name: "Active" }],
    });
    const request = (path: string, method = "POST") =>
      new Request(`http://gateway/api/projects/${path}`, { method });
    expect(gateway.canAssignProject("active")).toBe(true);
    expect((await gateway.handle(request("active/archive")))?.status).toBe(200);
    expect(gateway.canAssignProject("active")).toBe(false);
    expect((await gateway.handle(request("active/restore")))?.status).toBe(200);
    expect(gateway.canAssignProject("active")).toBe(true);
    expect((await gateway.handle(request("active", "DELETE")))?.status).toBe(
      204,
    );
    expect(gateway.canAssignProject("active")).toBe(false);
  });
  it.each(aliases)(
    "%s never accepts reserved metadata as unscoped project membership",
    async (alias) => {
      const post = registerMock();
      const result = await post(alias, {
        thread_id: "unscoped",
        metadata: {
          agent_name: "research",
          owner_id: "forged",
          user_id: "forged",
          deerflow_project_id: "forged",
          deerflow_origin: { kind: "forged" },
        },
      });
      expect(result.status).toBe(200);
      expect(result.body.metadata).toEqual({ agent_name: "research" });
    },
  );
  it.each(aliases)(
    "%s creates empty assigned threads, retaining agent metadata and stripping reserved keys",
    async (alias) => {
      const post = registerMock({
        projects: [{ id: "active", name: "Active" }],
      });
      const result = await post(alias, {
        thread_id: "client-id",
        project_id: "active",
        metadata: {
          agent_name: "research",
          owner_id: "forged",
          user_id: "forged",
          deerflow_project_id: "forged",
          deerflow_origin: { kind: "forged" },
        },
      });
      expect(result.status).toBe(200);
      expect(result.body.thread_id).toBe("client-id");
      expect(result.body.metadata).toEqual({
        agent_name: "research",
        deerflow_project_id: "active",
      });
      expect(result.body.values).toEqual({});
    },
  );
  it.each(aliases)(
    "%s returns an existing record before new project admission and never overwrites it",
    async (alias) => {
      const post = registerMock({
        projects: [{ id: "active", name: "Active" }],
      });
      const first = await post(alias, {
        thread_id: "same",
        project_id: "active",
        metadata: { agent_name: "research" },
      });
      const otherAlias = aliases.find((item) => item !== alias)!;
      const retry = await post(otherAlias, {
        thread_id: "same",
        project_id: "missing",
        metadata: { agent_name: "replacement" },
      });
      expect(retry).toEqual(first);
      const unassigned = await post(alias, {
        thread_id: "unassigned",
        metadata: { custom: "kept" },
      });
      expect(
        await post(otherAlias, {
          thread_id: "unassigned",
          project_id: "active",
        }),
      ).toEqual(unassigned);
    },
  );
  for (const kind of ["archived", "foreign", "missing"]) {
    it.each(aliases)(
      `%s rejects ${kind} project without creating the requested ID`,
      async (alias) => {
        // Only the caller's visible projects are seeded; foreign IDs are absent.
        const post = registerMock({
          projects: [{ id: "archived", name: "Archived", status: "archived" }],
        });
        expect(
          await post(alias, { thread_id: "retry", project_id: kind }),
        ).toEqual({ status: 404, body: { detail: "Project not found" } });
        const retry = await post(alias, {
          thread_id: "retry",
          metadata: { agent_name: "research" },
        });
        expect(retry.status).toBe(200);
        expect(retry.body.metadata).toEqual({ agent_name: "research" });
      },
    );
  }
  it.each(aliases)(
    "%s allocates a fresh ID when omitted, including sidecar creation",
    async (alias) => {
      const post = registerMock();
      const first = await post(alias, { metadata: { deerflow_sidecar: true } });
      const second = await post(alias, {
        metadata: { deerflow_sidecar: true },
      });
      expect(first.body.thread_id).not.toBe(second.body.thread_id);
      expect(first.body.metadata).toEqual({ deerflow_sidecar: true });
    },
  );
});
