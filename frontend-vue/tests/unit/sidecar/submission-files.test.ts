import { describe, expect, it, vi } from "vitest";

import {
  createSubmissionFileCache,
  prepareSubmissionFiles,
} from "@/core/uploads/submission-files";

function uploaded(filename: string, size: number) {
  return {
    filename,
    size,
    path: `/tmp/${filename}`,
    virtual_path: `/mnt/user-data/uploads/${filename}`,
    artifact_url: `/api/artifacts/${filename}`,
  };
}

describe("reusable attachment submission", () => {
  it("never caches a late upload response after its owner has aborted", async () => {
    const file = new File(["one"], "one.txt");
    const cache = createSubmissionFileCache();
    const controller = new AbortController();
    let complete!: (
      value: Awaited<
        ReturnType<
          NonNullable<Parameters<typeof prepareSubmissionFiles>[0]["upload"]>
        >
      >,
    ) => void;
    const upload = vi.fn(
      () =>
        new Promise<Parameters<typeof complete>[0]>((resolve) => {
          complete = resolve;
        }),
    );
    const pending = prepareSubmissionFiles({
      threadId: "thread-1",
      files: [file],
      cache,
      upload,
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    complete({
      success: true,
      files: [uploaded("one.txt", file.size)],
      message: "ok",
      skipped_files: [],
    });
    await rejected;
    expect(cache.get("thread-1")?.has(file)).toBe(false);
    expect(upload).toHaveBeenCalledWith("thread-1", [file], {
      signal: controller.signal,
    });
  });
  it("uploads to the final sidecar thread and returns message descriptors", async () => {
    const file = new File(["hello"], "notes.txt");
    const upload = vi.fn(async () => ({
      success: true,
      files: [uploaded("notes.txt", file.size)],
      message: "ok",
      skipped_files: [],
    }));

    await expect(
      prepareSubmissionFiles({
        threadId: "sidecar-final",
        files: [file],
        cache: createSubmissionFileCache(),
        upload,
      }),
    ).resolves.toEqual([
      {
        filename: "notes.txt",
        size: file.size,
        path: "/mnt/user-data/uploads/notes.txt",
        status: "uploaded",
      },
    ]);
    expect(upload).toHaveBeenCalledWith("sidecar-final", [file]);
  });

  it("reuses a successful upload when run creation fails and the user retries", async () => {
    const file = new File(["hello"], "notes.txt");
    const cache = createSubmissionFileCache();
    const upload = vi.fn(async () => ({
      success: true,
      files: [uploaded("notes.txt", file.size)],
      message: "ok",
      skipped_files: [],
    }));

    const first = await prepareSubmissionFiles({
      threadId: "sidecar-1",
      files: [file],
      cache,
      upload,
    });
    const second = await prepareSubmissionFiles({
      threadId: "sidecar-1",
      files: [file],
      cache,
      upload,
    });

    expect(second).toEqual(first);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("does not cache a partial upload response", async () => {
    const first = new File(["one"], "one.txt");
    const second = new File(["two"], "two.txt");
    const cache = createSubmissionFileCache();
    const upload = vi
      .fn()
      .mockResolvedValueOnce({
        success: false,
        files: [uploaded("one.txt", first.size)],
        message: "two.txt was rejected",
        skipped_files: ["two.txt"],
      })
      .mockResolvedValueOnce({
        success: true,
        files: [
          uploaded("one.txt", first.size),
          uploaded("two.txt", second.size),
        ],
        message: "ok",
        skipped_files: [],
      });

    await expect(
      prepareSubmissionFiles({
        threadId: "sidecar-1",
        files: [first, second],
        cache,
        upload,
      }),
    ).rejects.toThrow("two.txt was rejected");

    await prepareSubmissionFiles({
      threadId: "sidecar-1",
      files: [first, second],
      cache,
      upload,
    });
    expect(upload).toHaveBeenNthCalledWith(2, "sidecar-1", [first, second]);
  });
});
