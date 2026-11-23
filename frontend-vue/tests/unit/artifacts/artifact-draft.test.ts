/*
  【文件职责】     固定draft baseline/remote/conflict/save/discard 的纯状态转换。
  【架构位置】     测试
  【主要导出】     artifact draft reducer 回归
  【依赖关系】     app/core/artifacts/draft.ts
  【边界与注意】   远端刷新不得覆盖 dirty draft；412 后必须保留用户文本。
*/

import { describe, expect, it } from "vitest";

import {
  completeArtifactSave,
  createArtifactDraftRecord,
  discardArtifactDraft,
  editArtifactDraft,
  failArtifactSave,
  reconcileArtifactRemote,
} from "@/core/artifacts/draft";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

describe("artifact draft reducer", () => {
  it("adopts clean remote refreshes and preserves dirty drafts on remote change", () => {
    const loaded = reconcileArtifactRemote(
      createArtifactDraftRecord("/mnt/user-data/outputs/report.md"),
      { content: "one", sha256: A },
    );
    const dirty = editArtifactDraft(loaded, "my draft");
    const refreshed = reconcileArtifactRemote(dirty, {
      content: "agent update",
      sha256: B,
    });

    expect(refreshed).toMatchObject({
      baselineContent: "one",
      baselineSha256: A,
      remoteContent: "agent update",
      remoteSha256: B,
      draftContent: "my draft",
      conflict: true,
    });
  });

  it("makes save success, ordinary failure, and 412 conflict deterministic", () => {
    const dirty = editArtifactDraft(
      reconcileArtifactRemote(
        createArtifactDraftRecord("/mnt/user-data/outputs/report.md"),
        { content: "one", sha256: A },
      ),
      "saved text",
    );

    expect(failArtifactSave(dirty, 500)).toEqual(dirty);
    expect(failArtifactSave(dirty, 412)).toMatchObject({
      draftContent: "saved text",
      baselineSha256: A,
      conflict: true,
    });
    expect(
      completeArtifactSave(dirty, { content: "saved text", sha256: C }),
    ).toMatchObject({
      baselineContent: "saved text",
      remoteContent: "saved text",
      draftContent: "saved text",
      baselineSha256: C,
      remoteSha256: C,
      conflict: false,
    });
  });

  it("acknowledges the submitted snapshot without marking a later draft as saved", () => {
    const current = editArtifactDraft(
      reconcileArtifactRemote(createArtifactDraftRecord("/report.txt"), {
        content: "server",
        sha256: A,
      }),
      "edited after submit",
    );
    expect(
      completeArtifactSave(current, { content: "submitted", sha256: B }),
    ).toMatchObject({
      baselineContent: "submitted",
      remoteContent: "submitted",
      draftContent: "edited after submit",
      baselineSha256: B,
      conflict: false,
    });
  });

  it("discards to the latest known remote revision after a conflict", () => {
    const conflicted = reconcileArtifactRemote(
      editArtifactDraft(
        reconcileArtifactRemote(
          createArtifactDraftRecord("/mnt/user-data/outputs/report.md"),
          { content: "one", sha256: A },
        ),
        "my draft",
      ),
      { content: "agent update", sha256: B },
    );

    expect(discardArtifactDraft(conflicted)).toMatchObject({
      baselineContent: "agent update",
      draftContent: "agent update",
      baselineSha256: B,
      conflict: false,
    });
  });
});
