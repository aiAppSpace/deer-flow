import { createHash, webcrypto } from "node:crypto";

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import {
  ARTIFACT_PREVIEW_MAX_BYTES,
  loadArtifactContent,
} from "@/core/artifacts/loader";

describe("loadArtifactContent", () => {
  for (const full of [false, true]) {
    it.each([
      [206, { "Content-Range": "bytes 0-3/20" }],
      [206, { "Content-Range": "bytes 16-19/20" }],
      [206, {}],
      [200, { "Content-Length": "20" }],
    ] as const)(
      `full=${full}: incomplete status %s headers %j never grants an editable revision`,
      async (status, headers) => {
        rs.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response("part", {
            status,
            headers: { ...headers, ETag: `"${"a".repeat(64)}"` },
          }),
        );
        const result = await loadArtifactContent({
          filepath: "/mnt/user-data/outputs/file.txt",
          threadId: "t",
          full,
        });
        expect(result.truncated).toBe(true);
        expect(result.sha256).toBeUndefined();
        expect(result.content).toBe("part");
      },
    );
  }
  it("cancels an oversized streaming 200 prefix even without a content length", async () => {
    const cancel = rs.fn();
    const stream = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          controller.enqueue(
            new Uint8Array(ARTIFACT_PREVIEW_MAX_BYTES + 1).fill(65),
          );
        },
        pull(controller) {
          controller.close();
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    rs.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, { headers: { ETag: `"${"a".repeat(64)}"` } }),
    );
    const loaded = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/file.txt",
      threadId: "t",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(loaded.previewBytes).toBe(ARTIFACT_PREVIEW_MAX_BYTES);
    expect(loaded.content.length).toBe(ARTIFACT_PREVIEW_MAX_BYTES);
    expect(loaded.truncated).toBe(true);
    expect(loaded.sha256).toBeUndefined();
  });

  afterEach(() => {
    rs.restoreAllMocks();
    rs.unstubAllGlobals();
  });

  it("uses the server content revision when available", async () => {
    rs.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("content", {
        status: 200,
        headers: { ETag: `"${"a".repeat(64)}"` },
      }),
    );

    const loaded = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/report.md",
      threadId: "thread-1",
    });

    expect(loaded.sha256).toBe("a".repeat(64));
  });

  it("computes a revision for a complete response without a SHA-256 ETag", async () => {
    rs.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("content", {
        status: 200,
        headers: { ETag: '"starlette-file-etag"' },
      }),
    );

    const loaded = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/page.html",
      threadId: "thread-1",
    });

    expect(loaded.sha256).toBe(
      "ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73",
    );
  });

  it("requests only the preview byte budget and reports truncation", async () => {
    const bytes = new TextEncoder().encode("preview");
    const fetchMock = rs.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Range")).toBe(
        `bytes=0-${ARTIFACT_PREVIEW_MAX_BYTES - 1}`,
      );
      expect(init?.credentials).toBe("include");
      return new Response(bytes, {
        status: 206,
        headers: {
          "Content-Range": `bytes 0-${bytes.length - 1}/2000000`,
        },
      });
    });
    rs.stubGlobal("fetch", fetchMock);

    const result = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/large.txt",
      threadId: "thread-1",
    });

    expect(result.content).toBe("preview");
    expect(result.truncated).toBe(true);
    expect(result.totalBytes).toBe(2_000_000);
    expect(result.sha256).toBeUndefined();
  });

  it("loads and revisions the full file only when explicitly requested", async () => {
    const fetchMock = rs.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).has("Range")).toBe(false);
      return new Response("complete", {
        status: 200,
        headers: { "Content-Length": "8" },
      });
    });
    rs.stubGlobal("fetch", fetchMock);

    const result = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/large.txt",
      threadId: "thread-1",
      full: true,
    });

    expect(result).toMatchObject({
      content: "complete",
      truncated: false,
      totalBytes: 8,
      sha256:
        "eebbf6457e46a7f63acdf9b97390f790ba443d60cfa44b607da7e5c40aa1cc1d",
    });
  });

  it("does not render a replacement character for a split UTF-8 code point", async () => {
    const emojiBytes = new TextEncoder().encode("abc😀");
    const partial = emojiBytes.slice(0, -2);
    rs.stubGlobal(
      "fetch",
      rs.fn(
        async () =>
          new Response(partial, {
            status: 206,
            headers: {
              "Content-Range": `bytes 0-${partial.length - 1}/${emojiBytes.length + 10}`,
            },
          }),
      ),
    );

    const result = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/unicode.txt",
      threadId: "thread-1",
    });

    expect(result.content).toBe("abc");
  });

  it("treats an unsatisfied range on an empty file as empty content", async () => {
    rs.stubGlobal(
      "fetch",
      rs.fn(
        async () =>
          new Response(null, {
            status: 416,
            headers: { "Content-Range": "bytes */0" },
          }),
      ),
    );

    const result = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/empty.txt",
      threadId: "thread-1",
    });

    expect(result).toMatchObject({
      content: "",
      truncated: false,
      totalBytes: 0,
      sha256:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
  });

  it("parses a weak (W/) SHA-256 ETag returned by a gzipped response", async () => {
    rs.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("content", {
        status: 200,
        headers: { ETag: `W/"${"b".repeat(64)}"` },
      }),
    );

    const loaded = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/report.md",
      threadId: "thread-1",
    });

    expect(loaded.sha256).toBe("b".repeat(64));
  });

  it("resolves without throwing when crypto.subtle is unavailable (non-secure context)", async () => {
    rs.stubGlobal("crypto", { subtle: undefined } as unknown as Crypto);

    const bytes = new TextEncoder().encode("complete");
    rs.stubGlobal(
      "fetch",
      rs.fn(async (_url: string, init?: RequestInit) => {
        expect(new Headers(init?.headers).has("Range")).toBe(false);
        return new Response(bytes, {
          status: 200,
          headers: { "Content-Length": String(bytes.length) },
        });
      }),
    );

    const loaded = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/non-secure.html",
      threadId: "thread-1",
      full: true,
    });

    // A complete response needs the real Gateway-compatible revision, including
    // when a LAN origin does not expose WebCrypto and the proxy omits ETag.
    expect(loaded.sha256).toBe(
      "eebbf6457e46a7f63acdf9b97390f790ba443d60cfa44b607da7e5c40aa1cc1d",
    );
  });
});

describe("Gateway byte revisions across browser crypto availability", () => {
  afterEach(() => {
    rs.restoreAllMocks();
    rs.unstubAllGlobals();
  });
  for (const mode of ["webcrypto", "no-subtle", "no-crypto"] as const) {
    it.each([
      "",
      "abc",
      "中文 😀\r\n",
      "\ufeff# BOM artifact\n",
      "a".repeat(129),
    ])(`${mode} hashes original response bytes for %j`, async (content) => {
      rs.stubGlobal(
        "crypto",
        mode === "webcrypto"
          ? webcrypto
          : mode === "no-subtle"
            ? {}
            : undefined,
      );
      const bytes = new TextEncoder().encode(content);
      rs.stubGlobal(
        "fetch",
        rs.fn(async () => new Response(bytes)),
      );
      const loaded = await loadArtifactContent({
        filepath: "/mnt/user-data/outputs/revision.txt",
        threadId: "t",
        full: true,
      });
      expect(loaded.sha256).toBe(
        createHash("sha256").update(bytes).digest("hex"),
      );
      expect(loaded.truncated).toBe(false);
    });
  }
  it("does not expose a full-file revision for a truncated range with an ETag", async () => {
    rs.stubGlobal(
      "fetch",
      rs.fn(
        async () =>
          new Response("partial", {
            status: 206,
            headers: {
              ETag: `"${"a".repeat(64)}"`,
              "Content-Range": "bytes 0-6/1000",
            },
          }),
      ),
    );
    const loaded = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/revision.txt",
      threadId: "t",
    });
    expect(loaded.truncated).toBe(true);
    expect(loaded.sha256).toBeUndefined();
  });
  it("normalizes a weak uppercase Gateway SHA-256 ETag", async () => {
    rs.stubGlobal("crypto", undefined);
    rs.stubGlobal(
      "fetch",
      rs.fn(
        async () =>
          new Response("content", {
            headers: { ETag: `W/"${"A".repeat(64)}"` },
          }),
      ),
    );
    const loaded = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/revision.txt",
      threadId: "t",
    });
    expect(loaded.sha256).toBe("a".repeat(64));
  });
  it("keeps empty ranged files editable without WebCrypto", async () => {
    rs.stubGlobal("crypto", undefined);
    rs.stubGlobal(
      "fetch",
      rs.fn(
        async () =>
          new Response(null, {
            status: 416,
            headers: { "Content-Range": "bytes */0" },
          }),
      ),
    );
    const loaded = await loadArtifactContent({
      filepath: "/mnt/user-data/outputs/empty.txt",
      threadId: "t",
    });
    expect(loaded.sha256).toBe(createHash("sha256").update("").digest("hex"));
  });
  it("uses the same visible HTTP failure message", async () => {
    rs.stubGlobal(
      "fetch",
      rs.fn(async () =>
        Response.json(
          { detail: "Private transport diagnostics" },
          { status: 403 },
        ),
      ),
    );
    await expect(
      loadArtifactContent({
        filepath: "/mnt/user-data/outputs/revision.txt",
        threadId: "t",
      }),
    ).rejects.toThrow("Failed to load artifact: 403");
  });
});
