import { describe, expect, it } from "vitest";
import {
  buildComposerReferences,
  buildComposerUploadMessages,
} from "@/core/threads/composer-submit";
import { referenceToken } from "@/core/mentions/inline-references";
import { extensionMentionId } from "@/core/extensions/mentions";

const capability = {
  enabled: true,
  maxReferences: 3,
  isLoading: false,
  isSuccess: true,
};
describe("transient upload messages", () => {
  it("preserves the submitted human identity and merges staged with local attachments without persisting its task", () => {
    const metadata = {
      files: [{ filename: "project.txt", path: "/mnt/project.txt" }],
      conversation_references: [{ thread_id: "source", title: "Source" }],
    };
    const messages = buildComposerUploadMessages(
      {
        text: "Review @Source",
        humanMessageId: "human-one",
        files: [{ filename: "local.txt", size: 0, status: "uploading" }],
        additionalKwargs: metadata,
      },
      "Uploading files, please wait...",
    );
    expect(messages).toEqual([
      {
        type: "human",
        id: "human-one",
        content: [{ type: "text", text: "Review @Source" }],
        additional_kwargs: {
          ...metadata,
          files: [
            ...metadata.files,
            { filename: "local.txt", size: 0, status: "uploading" },
          ],
        },
      },
      {
        type: "ai",
        id: "upload:human-one",
        content: "Uploading files, please wait...",
        additional_kwargs: { element: "task" },
      },
    ]);
    (messages[0]!.additional_kwargs!.files as unknown[]).pop();
    expect(metadata.files).toHaveLength(1);
  });
  it("does not expose a hidden control submission in the transcript", () => {
    expect(
      buildComposerUploadMessages(
        {
          text: "control",
          humanMessageId: "hidden",
          files: [],
          additionalKwargs: { hide_from_ui: true },
        },
        "Uploading",
      ),
    ).toEqual([]);
  });
});
describe("composer submit reference channels", () => {
  it("keeps display labels separate from per-send grants and skill activation", () => {
    const text = `${referenceToken("conversation", "source", "Source")} ${referenceToken("skill", "analysis", "analysis")}`;
    const result = buildComposerReferences({
      text,
      threadId: "current",
      references: [{ threadId: "source", title: "Source" }],
      capability,
      attachments: [],
    });
    expect(result.conversationReferences).toEqual(["source"]);
    expect(result.text).toBe("@Source @analysis");
    expect(result.additionalKwargs).toEqual({
      conversation_references: [{ thread_id: "source", title: "Source" }],
      skill_references: ["analysis"],
    });
  });
  it("rejects unresolved discovery without silently removing grants", () => {
    expect(() =>
      buildComposerReferences({
        text: referenceToken("conversation", "source", "Source"),
        threadId: "current",
        references: [],
        capability: { ...capability, isSuccess: false },
        attachments: [],
      }),
    ).toThrow(/capability/i);
  });
  it("deduplicates references, enforces skill limits, and sends only selected staged files", () => {
    const attachment = {
      filename: "server-name.txt",
      virtual_path: "/mnt/server-name.txt",
      size_bytes: 12,
      artifact_url: "/a",
      staging_id: "s",
      source_document_id: "doc",
    };
    const options = {
      threadId: "current",
      references: [],
      capability,
      attachments: [attachment],
    };
    const text = Array.from({ length: 16 }, (_, i) =>
      referenceToken("skill", `s${i}`, `s${i}`),
    ).join(" ");
    expect(
      buildComposerReferences({ ...options, text }).additionalKwargs.files,
    ).toBeUndefined();
    expect(() =>
      buildComposerReferences({
        ...options,
        text: `${text} ${referenceToken("skill", "s16", "s16")}`,
      }),
    ).toThrow(/16/);
    expect(
      buildComposerReferences({
        ...options,
        text: referenceToken("file", "doc", "shelf-name"),
      }).additionalKwargs.files,
    ).toEqual([
      {
        filename: "server-name.txt",
        path: "/mnt/server-name.txt",
        size: 12,
        status: "uploaded",
      },
    ]);
  });
  it("normalizes duplicate, self and fourth conversation references without granting them", () => {
    const text = ["a", "a", "current", "b", "c", "d"]
      .map((id) => referenceToken("conversation", id, id))
      .join(" ");
    const result = buildComposerReferences({
      text,
      threadId: "current",
      references: [],
      capability,
      attachments: [],
    });
    expect(result.conversationReferences).toEqual(["a", "b", "c"]);
    expect(result.text).toContain("@d");
    expect(result.text).not.toContain("ref:conversation:current");
  });
  it("accepts 16 valid extension mentions, deduplicates them and rejects 17 atomically", () => {
    const tokens = Array.from({ length: 17 }, (_, index) =>
      referenceToken(
        "extension",
        extensionMentionId({
          namespace: "example.plugin",
          provider: "records",
          id: String(index),
          label: `Row ${index}`,
        }),
        `Row ${index}`,
      ),
    );
    const options = {
      threadId: "current",
      references: [],
      capability,
      attachments: [],
    };
    const accepted = buildComposerReferences({
      ...options,
      text: [
        ...tokens.slice(0, 16),
        tokens[0],
        referenceToken("extension", "invalid json", "Invalid"),
      ].join(" "),
    });
    expect(accepted.additionalKwargs.extension_mentions).toHaveLength(16);
    expect(() =>
      buildComposerReferences({ ...options, text: tokens.join(" ") }),
    ).toThrow(/16/);
  });
});
