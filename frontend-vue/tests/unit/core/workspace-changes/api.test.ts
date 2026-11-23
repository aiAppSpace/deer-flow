import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("fetchWorkspaceChanges can request file metadata without diffs", async () => {
  let requestedUrl = "";
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (typeof input === "string") {
      requestedUrl = input;
    } else if (input instanceof URL) {
      requestedUrl = input.toString();
    } else {
      requestedUrl = input.url;
    }
    return new Response(
      JSON.stringify({
        available: true,
        version: 1,
        summary: {
          created: 1,
          modified: 0,
          deleted: 0,
          additions: 1,
          deletions: 0,
          truncated: false,
        },
        files: [],
        limits: {},
      }),
      { status: 200 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);

  const { fetchWorkspaceChanges } =
    await import("@/core/workspace-changes/api");

  await fetchWorkspaceChanges({
    threadId: "thread-1",
    runId: "run-1",
    includeFiles: true,
    includeDiff: false,
  });

  const url = new URL(requestedUrl, "http://localhost");
  expect(url.searchParams.get("include_files")).toBe("true");
  expect(url.searchParams.get("include_diff")).toBe("false");
});

test("workspace changes use the authenticated owner and preserve cancellation", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(Response.json({ available: false }));
  vi.stubGlobal("fetch", fetchMock);
  const { fetchWorkspaceChanges } =
    await import("@/core/workspace-changes/api");
  const controller = new AbortController();
  await fetchWorkspaceChanges({
    threadId: "t",
    runId: "r",
    signal: controller.signal,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      credentials: "include",
      signal: controller.signal,
    }),
  );
});

test("workspace changes retire through the common login path on 401", async () => {
  const location = { href: "", pathname: "/workspace/chats/t" };
  vi.stubGlobal("window", { location });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(Response.json({ detail: "expired" }, { status: 401 })),
  );
  const { fetchWorkspaceChanges } =
    await import("@/core/workspace-changes/api");
  await expect(
    fetchWorkspaceChanges({ threadId: "t", runId: "r" }),
  ).rejects.toMatchObject({ name: "UnauthorizedError" });
  expect(location.href).toBe("/login?next=%2Fworkspace%2Fchats%2Ft");
});

for (const [body, message] of [
  [{ detail: "  exact detail  " }, "  exact detail  "],
  [{ detail: "" }, ""],
  [{ detail: { code: "run_missing", message: "Run missing" } }, "Run missing"],
  [{ detail: [{ msg: "Invalid field" }] }, "Failed to load workspace changes."],
  [null, "Failed to load workspace changes."],
] as const) {
  test(`workspace change error presentation for ${JSON.stringify(body)}`, async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(body, { status: 422 })),
    );
    const { fetchWorkspaceChanges } =
      await import("@/core/workspace-changes/api");
    await expect(
      fetchWorkspaceChanges({ threadId: "t", runId: "r" }),
    ).rejects.toMatchObject({ message, status: 422 });
  });
}
