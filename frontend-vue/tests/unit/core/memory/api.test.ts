import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "http://gateway" }));
import { fetch as fetcher } from "@/core/api/fetcher";
import { loadMemory, updateMemoryFact } from "@/core/memory/api";
const request = vi.mocked(fetcher);
beforeEach(() => request.mockReset());
const payload = () => ({
  version: "2.0",
  lastUpdated: "",
  user: {},
  history: {},
  facts: [],
});
it("normalizes legacy Gateway reads and drops only invalid facts while preserving metadata", async () => {
  request.mockResolvedValue(
    Response.json({
      ...payload(),
      revision: 8,
      facts: [null, { content: "kept", confidence: "0", extra: true }],
    }),
  );
  const controller = new AbortController();
  const memory = await loadMemory({ signal: controller.signal });
  expect(request).toHaveBeenCalledWith("http://gateway/api/memory", {
    signal: controller.signal,
  });
  expect(memory).toMatchObject({
    revision: 8,
    user: { cognitiveStyle: { summary: "", updatedAt: "" } },
    facts: [{ content: "kept", confidence: 0, extra: true }],
  });
  expect(memory.facts).toHaveLength(1);
});
it("rejects invalid success envelopes instead of caching an invented empty document", async () => {
  request.mockResolvedValue(Response.json({ facts: [] }));
  await expect(loadMemory()).rejects.toThrow("Invalid memory payload");
});
it("preserves structured Gateway permission and validation errors", async () => {
  const detail = [{ loc: ["body", "confidence"], msg: "must be within range" }];
  request.mockResolvedValue(Response.json({ detail }, { status: 422 }));
  await expect(
    updateMemoryFact("fact", { confidence: 2 }),
  ).rejects.toMatchObject({
    status: 422,
    body: { detail },
    message: "must be within range",
  });
});
it("passes the exact fact patch and cancellation signal to Gateway", async () => {
  request.mockResolvedValue(Response.json(payload()));
  const controller = new AbortController();
  await updateMemoryFact(
    "fact /a",
    { content: "new", category: "context", confidence: 0 },
    { signal: controller.signal },
  );
  expect(request).toHaveBeenCalledWith(
    "http://gateway/api/memory/facts/fact%20%2Fa",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        content: "new",
        category: "context",
        confidence: 0,
      }),
      signal: controller.signal,
    }),
  );
});
