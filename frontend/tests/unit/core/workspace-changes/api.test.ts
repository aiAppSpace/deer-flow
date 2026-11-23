import { afterEach, expect, test, rs } from "@rstest/core";

afterEach(() => {
  rs.unstubAllGlobals();
});

test("fetchWorkspaceChanges can request file metadata without diffs", async () => {
  let requestedUrl = "";
  const fetchMock = rs.fn(async (input: RequestInfo | URL) => {
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
  rs.stubGlobal("fetch", fetchMock);

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
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ credentials: "include" }),
  );
});

for (const [body, message] of [
  [{ detail: "  exact detail  " }, "  exact detail  "],
  [{ detail: "" }, ""],
  [{ detail: { code: "run_missing", message: "Run missing" } }, "Run missing"],
  [{ detail: [{ msg: "Invalid field" }] }, "Failed to load workspace changes."],
  [null, "Failed to load workspace changes."],
] as const) {
  test(`workspace change error presentation for ${JSON.stringify(body)}`, async () => {
    rs.stubGlobal(
      "fetch",
      rs.fn().mockResolvedValue(Response.json(body, { status: 422 })),
    );
    const { fetchWorkspaceChanges } =
      await import("@/core/workspace-changes/api");
    await expect(
      fetchWorkspaceChanges({ threadId: "t", runId: "r" }),
    ).rejects.toMatchObject({ message, status: 422 });
  });
}
