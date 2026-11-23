import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../../support/stream-gateway.mjs", import.meta.url),
);
let gatewayProcess: ChildProcess;
let base: string;

beforeAll(async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("No TCP port");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  base = `http://127.0.0.1:${port}`;
  gatewayProcess = spawn(process.execPath, [script], {
    env: { ...process.env, M4A_STREAM_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    let output = "";
    gatewayProcess.once("error", reject);
    gatewayProcess.once("exit", (code) =>
      reject(new Error(`Gateway exited ${code}`)),
    );
    gatewayProcess.stdout!.on("data", (chunk) => {
      output += String(chunk);
      if (output.includes(`m4a stream gateway on ${port}`)) resolve();
    });
  });
  expect((await fetch(`${base}/health`)).status).toBe(200);
});

afterAll(async () => {
  if (
    gatewayProcess &&
    gatewayProcess.exitCode === null &&
    gatewayProcess.signalCode === null
  ) {
    const exited = once(gatewayProcess, "exit");
    gatewayProcess.kill("SIGTERM");
    await exited;
  }
});

async function create(threadId: string) {
  const response = await fetch(`${base}/api/threads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      thread_id: threadId,
      metadata: { owner: threadId },
    }),
  });
  expect(response.status).toBe(200);
  expect((await response.json()).thread_id).toBe(threadId);
}

function frames(body: string) {
  return body
    .split("\n\n")
    .map((frame) => ({
      event: /^event: (.+)$/m.exec(frame)?.[1],
      data: /^data: (.+)$/m.exec(frame)?.[1],
    }))
    .filter((frame) => frame.data)
    .map((frame) => ({ event: frame.event, data: JSON.parse(frame.data!) }));
}

async function run(
  threadId: string,
  name: string,
  human?: {
    id: string;
    type: "human";
    content: { type: "text"; text: string }[];
  },
) {
  const response = await fetch(
    `${base}/api/threads/${threadId}/runs/stream?script=${name}`,
    {
      method: "POST",
      body: JSON.stringify(human ? { input: { messages: [human] } } : {}),
    },
  );
  expect(response.status).toBe(200);
  return { response, events: frames(await response.text()) };
}

describe("real socket stream fixture matches Gateway thread identity", () => {
  for (const name of ["plain", "scroll", "task"] as const) {
    it(`${name} keeps the requested UUID in metadata and Content-Location`, async () => {
      const threadId = `36f43ff9-8af8-4ceb-b205-${String(["plain", "scroll", "task"].indexOf(name)).padStart(12, "0")}`;
      const human = {
        id: `submitted-${name}`,
        type: "human" as const,
        content: [{ type: "text" as const, text: `Input for ${name}` }],
      };
      await create(threadId);
      const { response, events } = await run(threadId, name, human);
      const metadata = events.find((event) => event.event === "metadata")!.data;
      expect(metadata.thread_id).toBe(threadId);
      expect(response.headers.get("content-location")).toBe(
        `/api/threads/${threadId}/runs/${metadata.run_id}`,
      );
      expect(
        events.find((event) => event.event === "values")!.data.messages,
      ).toContainEqual(human);
      const checkpoint = await fetch(`${base}/api/threads/${threadId}`).then(
        (response) => response.json(),
      );
      expect(checkpoint.values.messages[0]).toEqual(human);
      const assistant = checkpoint.values.messages.find(
        (message: { type: string }) => message.type === "ai",
      );
      expect(assistant.run_id).toBe(metadata.run_id);
      expect(assistant.additional_kwargs.turn_duration).toBeGreaterThanOrEqual(
        0,
      );
      expect(Number.isInteger(assistant.additional_kwargs.turn_duration)).toBe(
        true,
      );
    });
  }

  it("search and durable reads preserve completed content without crossing threads", async () => {
    const first = "stream-fixture-durable-first";
    const second = "stream-fixture-durable-second";
    await create(first);
    await create(second);
    await run(first, "plain");
    const search = await fetch(`${base}/api/threads/search`, {
      method: "POST",
      body: "{}",
    }).then((response) => response.json());
    expect(Array.isArray(search)).toBe(true);
    expect(search).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          thread_id: first,
          metadata: { owner: first },
        }),
        expect.objectContaining({
          thread_id: second,
          metadata: { owner: second },
        }),
      ]),
    );
    const loaded = await fetch(`${base}/api/threads/${first}`).then((r) =>
      r.json(),
    );
    expect(loaded.values.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "human", content: "Build a deck" }),
        expect.objectContaining({
          type: "ai",
          content: "Hello from DeerFlow!",
        }),
      ]),
    );
    const history = await fetch(`${base}/api/threads/${first}/history`, {
      method: "POST",
      body: JSON.stringify({ limit: 1 }),
    }).then((response) => response.json());
    expect(history[0].values).toEqual(loaded.values);
    const untouched = await fetch(`${base}/api/threads/${second}`).then((r) =>
      r.json(),
    );
    expect(untouched.values.messages).toEqual([]);
    await create(first);
    expect(
      (await fetch(`${base}/api/threads/${first}`).then((r) => r.json()))
        .values,
    ).toEqual(loaded.values);
    expect(
      (
        await fetch(`${base}/api/threads/unknown/runs/stream`, {
          method: "POST",
          body: "{}",
        })
      ).status,
    ).toBe(404);
  });

  it("gap recovery and resume preserve the same thread and real cursor", async () => {
    const threadId = "stream-fixture-gap-owner";
    await create(threadId);
    const initial = await run(threadId, "gap");
    const runId = initial.events.find((event) => event.event === "metadata")!
      .data.run_id;
    const response = await fetch(
      `${base}/api/threads/${threadId}/runs/${runId}/stream`,
      { headers: { "Last-Event-ID": "e8" } },
    );
    const resumed = frames(await response.text());
    expect(response.headers.get("content-location")).toBe(
      `/api/threads/${threadId}/runs/${runId}`,
    );
    expect(
      resumed.find((event) => event.event === "messages")!.data[0].content,
    ).toBe("resumed@e8");
    const state = await fetch(`${base}/api/threads/${threadId}/state`).then(
      (r) => r.json(),
    );
    expect(state.values.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "resumed@e8" }),
      ]),
    );
  });
});
