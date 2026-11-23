import type { Page, Route } from "@playwright/test";
import { expect, test } from "@rstest/core";

import {
  handleRunStream,
  MOCK_RUN_ID,
  MOCK_THREAD_ID,
} from "../../e2e/utils/mock-api";

test("shared run-stream mock returns the Gateway Content-Location shape", async () => {
  let fulfilled: Parameters<Route["fulfill"]>[0] | undefined;
  const page = {} as Page;
  const route = {
    request: () => ({
      url: () =>
        `http://localhost:3000/api/langgraph/threads/${MOCK_THREAD_ID}/runs/stream`,
      postDataJSON: () => ({ input: { messages: [] } }),
      frame: () => ({ page: () => page }),
    }),
    fulfill: async (options: Parameters<Route["fulfill"]>[0]) => {
      fulfilled = options;
    },
  } as unknown as Route;

  await handleRunStream(route);

  expect(fulfilled?.headers).toMatchObject({
    "Content-Location": `/api/threads/${MOCK_THREAD_ID}/runs/${MOCK_RUN_ID}`,
  });
  expect(fulfilled?.headers).not.toHaveProperty("Location");
  const event = String(fulfilled?.body)
    .split("\n\n")
    .find((block) => block.startsWith("event: values\n"))!;
  const values = JSON.parse(event.slice("event: values\ndata: ".length)) as {
    messages: { id: string; type: string }[];
  };
  expect(values.messages).toHaveLength(1);
  expect(values.messages[0]).toMatchObject({
    type: "ai",
    id: expect.any(String),
  });
});
