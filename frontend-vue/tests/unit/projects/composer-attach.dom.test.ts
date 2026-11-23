import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  readProjectAttachments,
  retireProjectAttachments,
  stageProjectAttachment,
  writeProjectAttachments,
} from "@/core/projects/composer-attach";
import type { AttachProjectDocumentResult } from "@/core/projects/types";

const attachment = (name: string, doc = name): AttachProjectDocumentResult => ({
  filename: name,
  size_bytes: 10,
  virtual_path: `/mnt/user-data/uploads/${name}`,
  artifact_url: `/api/threads/t/artifacts/mnt/user-data/uploads/${name}`,
  source_project_id: "project",
  source_document_id: doc,
});
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("retains staged files if browser storage becomes unreadable after a successful write", () => {
  stageProjectAttachment("storage-unavailable", attachment("kept.txt"));
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
    },
  });
  expect(readProjectAttachments("storage-unavailable")[0]?.filename).toBe(
    "kept.txt",
  );
});

it("reads without consuming, deduplicates by source, and persists explicit chip removal", () => {
  stageProjectAttachment("t", attachment("one.txt", "doc-1"));
  stageProjectAttachment("t", attachment("one-renamed.txt", "doc-1"));
  stageProjectAttachment("t", attachment("two.txt"));
  expect(readProjectAttachments("t").map((file) => file.filename)).toEqual([
    "one-renamed.txt",
    "two.txt",
  ]);
  expect(readProjectAttachments("t")).toEqual(readProjectAttachments("t"));
  writeProjectAttachments("t", readProjectAttachments("t").slice(1));
  expect(readProjectAttachments("t").map((file) => file.filename)).toEqual([
    "two.txt",
  ]);
  expect(readProjectAttachments("other-thread")).toEqual([]);
});

it("retires only the submitted staging revisions, preserving anything staged while sending", () => {
  stageProjectAttachment("t", attachment("one.txt"));
  const submitted = readProjectAttachments("t");
  stageProjectAttachment("t", attachment("one.txt"));
  stageProjectAttachment("t", attachment("two.txt"));
  retireProjectAttachments("t", submitted);
  expect(readProjectAttachments("t").map((file) => file.filename)).toEqual([
    "one.txt",
    "two.txt",
  ]);
  retireProjectAttachments("t", readProjectAttachments("t"));
  expect(readProjectAttachments("t")).toEqual([]);
});

it("retains the legacy single attachment shape and drops corrupt entries", () => {
  sessionStorage.setItem(
    "deerflow.project-attachment.t",
    JSON.stringify(attachment("legacy.txt")),
  );
  expect(readProjectAttachments("t")[0]?.filename).toBe("legacy.txt");
  retireProjectAttachments("t", readProjectAttachments("t"));
  expect(readProjectAttachments("t")).toEqual([]);
  sessionStorage.setItem("deerflow.project-attachment.t", "[null,{},42]");
  expect(readProjectAttachments("t")).toEqual([]);
});
