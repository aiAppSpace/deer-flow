import { isDeepStrictEqual } from "node:util";
import type { Page } from "@playwright/test";
import { mockLangGraphAPI } from "../e2e/utils/mock-api";

/** One framework-neutral server fixture. No sibling React source dependency. */
export function createPreparedReplayFixture(
  surface: "main" | "agent",
  kind: "edit" | "regenerate",
) {
  const thread = "00000000-0000-4000-8000-000000000041";
  const oldRun = "00000000-0000-4000-8000-000000000042";
  const newRun = "00000000-0000-4000-8000-000000000043";
  const human = {
    type: "human",
    id: "source-human",
    content: "Original replay question",
  };
  const assistant = {
    type: "ai",
    id: "source-assistant",
    content: "Original replay answer",
  };
  const replacement = {
    type: "human",
    id: "server-replacement-human",
    content: "Revised replay question",
  };
  const reply = {
    type: "ai",
    id: "new-assistant",
    content: "Prepared replay completed",
  };
  const inputHuman = kind === "edit" ? replacement : human;
  const checkpoint = {
    checkpoint_id: "checkpoint-before-source",
    checkpoint_ns: "",
    checkpoint_map: null,
  };
  const metadata = {
    regenerate_from_message_id: assistant.id,
    regenerate_from_run_id: oldRun,
    regenerate_checkpoint_id: checkpoint.checkpoint_id,
    ...(kind === "edit"
      ? {
          replay_kind: "edit",
          edit_from_message_id: human.id,
          edit_message_id: replacement.id,
          edit_version_group_id: "existing-version-group",
        }
      : {}),
  };
  return {
    surface,
    kind,
    thread,
    oldRun,
    newRun,
    human,
    assistant,
    replacement,
    reply,
    agent: surface === "agent" ? "test-agent" : null,
    path:
      surface === "agent"
        ? `/workspace/agents/test-agent/chats/${thread}`
        : `/workspace/chats/${thread}`,
    preparePath: `/api/threads/${thread}/runs/${kind === "edit" ? "edit-regenerate" : "regenerate"}/prepare`,
    prepareBody:
      kind === "edit"
        ? { human_message_id: human.id, replacement_text: replacement.content }
        : { message_id: assistant.id },
    prepared: {
      target_run_id: oldRun,
      input: { messages: [inputHuman] },
      checkpoint,
      metadata,
      ...(kind === "edit"
        ? {
            replacement_human_message_id: replacement.id,
            source_message_ids: [human.id, assistant.id],
          }
        : {}),
    },
    finalMessages: [inputHuman, reply],
  };
}
export type PreparedReplayFixture = ReturnType<
  typeof createPreparedReplayFixture
>;

export async function installPreparedReplayFixture(
  page: Page,
  f: PreparedReplayFixture,
) {
  const initial = {
    thread_id: f.thread,
    title: "Replay source fixture",
    agent_name: f.agent ?? undefined,
    messages: [f.human, f.assistant],
  };
  const server = mockLangGraphAPI(page, {
    threads: [initial],
    agents: [
      {
        name: "test-agent",
        description: "Replay fixture agent",
        model: null,
        skills: null,
        tool_groups: null,
      },
    ],
  });
  let submitted = false;
  const violations: string[] = [];
  await page.route(
    new RegExp(`/api/langgraph/threads/${f.thread}/runs(?:\\?|$)`),
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const row = (run_id: string, metadata: Record<string, unknown>) => ({
        run_id,
        thread_id: f.thread,
        assistant_id: f.agent ?? "lead_agent",
        status: "success",
        metadata,
        kwargs: {},
        created_at: "2026-11-02T00:00:00Z",
        updated_at: "2026-11-02T00:00:00Z",
      });
      const old = row(f.oldRun, {
        edit_version_group_id: "existing-version-group",
      });
      await route.fulfill({
        status: 200,
        json: submitted ? [row(f.newRun, f.prepared.metadata), old] : [old],
      });
    },
  );
  await page.route(`**${f.preparePath}`, async (route) => {
    const request = route.request();
    if (
      request.method() !== "POST" ||
      !isDeepStrictEqual(request.postDataJSON(), f.prepareBody)
    ) {
      violations.push("prepare request contradicts independent source intent");
      await route.fulfill({ status: 400, json: { detail: violations.at(-1) } });
      return;
    }
    await route.fulfill({ status: 200, json: f.prepared });
  });
  await page.route(
    `**/api/threads/${f.thread}/messages/page*`,
    async (route) => {
      const messages = submitted ? f.finalMessages : initial.messages;
      await route.fulfill({
        status: 200,
        json: {
          data: messages.map((content, index) => ({
            run_id: submitted ? f.newRun : f.oldRun,
            seq: index + 1,
            content,
            metadata: { caller: f.agent ?? "lead_agent" },
            created_at: "2026-11-02T00:00:00Z",
          })),
          has_more: false,
          next_before_seq: null,
        },
      });
    },
  );
  await page.route(
    `**/api/langgraph/threads/${f.thread}/runs/stream`,
    async (route) => {
      const body = route.request().postDataJSON() as {
        checkpoint?: { checkpoint_id?: string };
        input?: { messages?: { id?: string }[] };
      };
      if (
        route.request().method() !== "POST" ||
        submitted ||
        body.checkpoint?.checkpoint_id !==
          f.prepared.checkpoint.checkpoint_id ||
        body.input?.messages?.[0]?.id !== f.finalMessages[0]!.id
      ) {
        violations.push(
          "run request contradicts checkpoint or replacement source",
        );
        await route.fulfill({
          status: 409,
          json: { detail: violations.at(-1) },
        });
        return;
      }
      submitted = true;
      server.upsertThread({ ...initial, messages: f.finalMessages });
      const events = [
        { event: "metadata", data: { run_id: f.newRun, thread_id: f.thread } },
        { event: "values", data: { messages: f.finalMessages } },
        { event: "end", data: {} },
      ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Content-Location": `/api/threads/${f.thread}/runs/${f.newRun}`,
        },
        body: events
          .map(
            ({ event, data }) =>
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          )
          .join(""),
      });
    },
  );
  return { snapshot: () => ({ submitted, violations: [...violations] }) };
}
