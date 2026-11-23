import type { Page, Route } from "@playwright/test";
import { describe, expect, it, rs } from "@rstest/core";

import {
  mockLangGraphAPI,
  handleRunStream,
  MOCK_RUN_ID,
  type MockAPIOptions,
} from "../../e2e/utils/mock-api";

function registerMock(options: MockAPIOptions = {}) {
  const handlers = new Map<string, (route: Route) => unknown>();
  const regexHandlers: {
    pattern: RegExp;
    handler: (route: Route) => unknown;
  }[] = [];
  const page = {
    context: () => ({ route: rs.fn().mockResolvedValue(undefined) }),
    route: (pattern: string | RegExp, handler: (route: Route) => unknown) => {
      if (typeof pattern === "string") handlers.set(pattern, handler);
      else regexHandlers.push({ pattern, handler });
      return Promise.resolve();
    },
  } as unknown as Page;
  mockLangGraphAPI(page, options);
  const post = async (alias: string, body: Record<string, unknown>) => {
    const fulfill = rs.fn().mockResolvedValue(undefined);
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
  return Object.assign(post, {
    async state(threadId: string) {
      const fulfill = rs.fn().mockResolvedValue(undefined);
      await handlers.get("**/api/langgraph/threads/*/state")!({
        request: () => ({
          method: () => "GET",
          url: () => `http://gateway/api/langgraph/threads/${threadId}/state`,
        }),
        fulfill,
      } as unknown as Route);
      return JSON.parse(fulfill.mock.calls[0]![0].body as string) as {
        values: { messages: unknown[] };
      };
    },
    async history(threadId: string) {
      const fulfill = rs.fn().mockResolvedValue(undefined);
      await handlers.get("**/api/langgraph/threads/*/history")!({
        request: () => ({
          method: () => "GET",
          url: () => `http://gateway/api/langgraph/threads/${threadId}/history`,
        }),
        fulfill,
      } as unknown as Route);
      return JSON.parse(fulfill.mock.calls[0]![0].body as string) as {
        values: { messages: unknown[] };
      }[];
    },
    async messages(threadId: string) {
      const url = `http://gateway/api/threads/${threadId}/messages/page`;
      const handler = regexHandlers.find(({ pattern }) =>
        pattern.test(url),
      )!.handler;
      const fulfill = rs.fn().mockResolvedValue(undefined);
      await handler({
        request: () => ({ method: () => "GET", url: () => url }),
        fulfill,
      } as unknown as Route);
      return JSON.parse(fulfill.mock.calls[0]![0].body as string) as {
        data: { run_id: string; content: unknown }[];
      };
    },
    async stream(
      threadId: string,
      messages: unknown[] = [
        { type: "human", id: "actual-human", content: "Actual question" },
      ],
      responseMessage: Record<string, unknown> | undefined = {
        type: "ai",
        id: "actual-ai",
        content: "Actual answer",
      },
      viaDefault = false,
      replay?: {
        checkpointBase: { checkpointId: string; messages: unknown[] };
        requestCheckpointId: string;
      },
    ) {
      const fulfill = rs.fn().mockResolvedValue(undefined);
      const route = {
        request: () => ({
          url: () =>
            `http://gateway/api/langgraph/threads/${threadId}/runs/stream`,
          method: () => "POST",
          postDataJSON: () => ({
            input: { messages },
            ...(replay
              ? { checkpoint: { checkpoint_id: replay.requestCheckpointId } }
              : {}),
          }),
          frame: () => ({ page: () => page }),
        }),
        fulfill,
      } as unknown as Route;
      if (viaDefault)
        await handlers.get("**/api/langgraph/threads/*/runs/stream")!(route);
      else
        await handleRunStream(route, {}, undefined, {
          responseMessage,
          ...(replay ? { checkpointBase: replay.checkpointBase } : {}),
        });
      const body = fulfill.mock.calls[0]![0].body as string;
      const values = body
        .split("\n\n")
        .find((event) => event.startsWith("event: values\n"))!;
      const metadata = body
        .split("\n\n")
        .find((event) => event.startsWith("event: metadata\n"))!;
      return {
        ...JSON.parse(values.slice("event: values\ndata: ".length)),
        runId: JSON.parse(metadata.slice("event: metadata\ndata: ".length))
          .run_id,
      } as { messages: unknown[]; runId: string };
    },
  });
}
const aliases = ["threads", "langgraph/threads"];
describe("Gateway thread creation fixture contract", () => {
  it.each(["edit", "regenerate"] as const)(
    "replays %s from the explicit checkpoint base with one SSE/state/history/message identity",
    async (kind) => {
      const prefix = [
        { type: "human", id: "earlier-human", content: "Earlier question" },
        { type: "ai", id: "earlier-ai", content: "Earlier answer" },
      ];
      const originalHuman = {
        type: "human",
        id: "original-human",
        content: "Original question",
      };
      const originalAi = {
        type: "ai",
        id: "original-ai",
        content: "Original answer",
      };
      const replacement =
        kind === "edit"
          ? { type: "human", id: "edited-human", content: "Edited question" }
          : originalHuman;
      const answer = { type: "ai", id: "replay-ai", content: "Replay answer" };
      const post = registerMock({
        threads: [
          {
            thread_id: "history",
            messages: [...prefix, originalHuman, originalAi],
          },
        ],
      });
      const emitted = await post.stream(
        "history",
        [replacement],
        answer,
        false,
        {
          checkpointBase: {
            checkpointId: "before-target-human",
            messages: prefix,
          },
          requestCheckpointId: "before-target-human",
        },
      );
      const expected = [...prefix, replacement, answer];
      expect(emitted.messages).toEqual(expected);
      expect((await post.state("history")).values.messages).toEqual(expected);
      expect((await post.history("history"))[0]!.values.messages).toEqual(
        expected,
      );
      const rows = (await post.messages("history")).data;
      expect(rows.map((row) => row.content)).toEqual(expected);
      expect(rows.slice(-2).map((row) => row.run_id)).toEqual([
        emitted.runId,
        emitted.runId,
      ]);
      expect(emitted.runId).toBe(MOCK_RUN_ID);
      expect(rows.slice(0, 2).map((row) => row.run_id)).toEqual([
        "run-history",
        "run-history",
      ]);
      expect(emitted.messages).not.toContainEqual(originalAi);
      if (kind === "edit")
        expect(emitted.messages).not.toContainEqual(originalHuman);
      const nextHuman = {
        type: "human",
        id: "next-human",
        content: "Continue",
      };
      const nextAi = { type: "ai", id: "next-ai", content: "Continuation" };
      const continued = await post.stream("history", [nextHuman], nextAi);
      expect(continued.messages).toEqual([...expected, nextHuman, nextAi]);
    },
  );
  it("rejects a mismatched checkpoint base before changing persisted history", async () => {
    const seed = [
      { type: "human", id: "old-human", content: "Retained question" },
    ];
    const post = registerMock({
      threads: [{ thread_id: "history", messages: seed }],
    });
    await expect(
      post.stream(
        "history",
        [{ type: "human", id: "replacement", content: "Replacement" }],
        { type: "ai", id: "new-answer", content: "New" },
        false,
        {
          checkpointBase: { checkpointId: "known-checkpoint", messages: [] },
          requestCheckpointId: "different-checkpoint",
        },
      ),
    ).rejects.toThrow(/checkpoint/);
    expect((await post.state("history")).values.messages).toEqual(seed);
    expect((await post.history("history"))[0]!.values.messages).toEqual(seed);
    expect(
      (await post.messages("history")).data.map((row) => row.content),
    ).toEqual(seed);
  });
  it.each(["custom", "default"] as const)(
    "retains seeded and two-turn history through %s streams and emits the persisted values",
    async (mode) => {
      const seed = [
        { type: "human", id: "seed-human", content: "Seed question" },
        { type: "ai", id: "msg-ai-1", content: "Seed answer" },
      ];
      const post = registerMock({
        threads: [{ thread_id: "history", messages: seed }],
      });
      for (const turn of [1, 2]) {
        const human = {
          type: "human",
          id: `human-${turn}`,
          content: `Question ${turn}`,
        };
        const answer = {
          type: "ai",
          id: `custom-ai-${turn}`,
          content: `Custom answer ${turn}`,
        };
        const emitted = await post.stream(
          "history",
          [human],
          mode === "custom" ? answer : undefined,
          mode === "default",
        );
        const state = (await post.state("history")).values.messages as {
          id: string;
          type: string;
          content: string;
        }[];
        expect(state.slice(0, 2)).toEqual(seed);
        expect(state).toHaveLength(2 + turn * 2);
        expect(state[turn * 2]).toEqual(human);
        if (mode === "custom") expect(state.at(-1)).toEqual(answer);
        else
          expect(state.at(-1)).toMatchObject({
            type: "ai",
            content: "Hello from DeerFlow!",
          });
        expect(emitted.messages).toEqual(state);
        expect(new Set(state.map((message) => message.id)).size).toBe(
          state.length,
        );
      }
    },
  );
  it("updates explicit repeated message IDs in place without replacing other turns", async () => {
    const seed = [{ type: "ai", id: "seed", content: "Retained seed" }];
    const post = registerMock({
      threads: [{ thread_id: "history", messages: seed }],
    });
    await post.stream(
      "history",
      [{ type: "human", id: "human-1", content: "First question" }],
      { type: "ai", id: "answer-1", content: "First answer" },
    );
    await post.stream(
      "history",
      [{ type: "human", id: "human-2", content: "Second question" }],
      { type: "ai", id: "answer-2", content: "Second answer" },
    );
    const emitted = await post.stream(
      "history",
      [{ type: "human", id: "human-1", content: "Edited first question" }],
      { type: "ai", id: "answer-1", content: "Revised first answer" },
    );
    expect((await post.state("history")).values.messages).toEqual([
      ...seed,
      { type: "human", id: "human-1", content: "Edited first question" },
      { type: "ai", id: "answer-1", content: "Revised first answer" },
      { type: "human", id: "human-2", content: "Second question" },
      { type: "ai", id: "answer-2", content: "Second answer" },
    ]);
    expect(emitted.messages).toEqual(
      (await post.state("history")).values.messages,
    );
  });
  it.each(aliases)(
    "%s allocates a fresh omitted ID even when the deterministic fixture UUID exists",
    async (alias) => {
      const existingId = "00000000-0000-0000-0000-0000000000aa";
      const post = registerMock({
        threads: [
          {
            thread_id: existingId,
            metadata: { parent_thread_id: "previous-parent" },
          },
        ],
      });
      const result = await post(alias, {
        metadata: { parent_thread_id: "new-parent" },
      });
      expect(result.body.thread_id).not.toBe(existingId);
      expect(result.body.metadata).toEqual({ parent_thread_id: "new-parent" });
    },
  );
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
      expect((await post.state("client-id")).values.messages).toEqual([]);
      await post.stream("client-id");
      expect((await post.state("client-id")).values.messages).toEqual([
        { type: "human", id: "actual-human", content: "Actual question" },
        { type: "ai", id: "actual-ai", content: "Actual answer" },
      ]);
      await post(aliases.find((item) => item !== alias)!, {
        thread_id: "client-id",
        metadata: { agent_name: "replacement" },
      });
      expect((await post.state("client-id")).values.messages).toHaveLength(2);
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
