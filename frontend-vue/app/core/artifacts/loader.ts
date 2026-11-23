/*
  【文件职责】     有界加载正式 UTF-8 artifact，并保留 Gateway 错误与 revision。
  【架构位置】     L3
  【主要导出】     ARTIFACT_PREVIEW_MAX_BYTES / loadArtifactContent / loadArtifactContentFromToolCall
  【依赖关系】     见下方 import。
  【边界与注意】   ADAPTED：只有显式 text policy 可调用；.skill/未知/二进制没有兼容分支。
*/

import type { BaseStream } from "@/core/types/message";
import { fetch } from "@/core/api/fetcher";

import type { AgentThreadState } from "../threads";

import { buildWriteFileDraftContent } from "./preview";
import { readArtifactPreviewBody } from "./response-body";
import { urlOfArtifact } from "./utils";

async function sha256OfBytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  // Gateway revisions describe the original bytes, including a UTF-8 BOM.
  // Non-secure origins use the same SHA-256 algorithm, loaded only on demand.
  const digest = subtle
    ? new Uint8Array(await subtle.digest("SHA-256", bytes))
    : (await import("@noble/hashes/sha2.js")).sha256(bytes);
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export const ARTIFACT_PREVIEW_MAX_BYTES = 1024 * 1024;

export function parseContentRange(value: string | null) {
  const match = value?.match(/^bytes (?:(\d+)-(\d+)|\*)\/(\d+)$/);
  if (!match) return undefined;
  return {
    end: match[2] === undefined ? undefined : Number(match[2]),
    total: Number(match[3]),
  };
}

export async function loadArtifactContent({
  filepath,
  threadId,
  isMock,
  full = false,
  signal,
}: {
  filepath: string;
  threadId: string;
  isMock?: boolean;
  full?: boolean;
  signal?: AbortSignal;
}) {
  /*
    `.skill` 是一个目录：真正能读的是它里面的 SKILL.md。React 的 loader 同样在这里
    补这一段（frontend/src/core/artifacts/loader.ts）。不补的话请求打在目录上，
    技能包的预览永远是空的。
  */
  const url = urlOfArtifact({
    filepath: filepath.endsWith(".skill") ? `${filepath}/SKILL.md` : filepath,
    threadId,
    isMock,
  });
  const response = await fetch(url, {
    cache: "no-store",
    headers: full
      ? undefined
      : { Range: `bytes=0-${ARTIFACT_PREVIEW_MAX_BYTES - 1}` },
    signal,
  });
  const contentRange = parseContentRange(response.headers.get("Content-Range"));
  if (response.status === 416 && contentRange?.total === 0) {
    return {
      content: "",
      url,
      truncated: false,
      previewBytes: 0,
      totalBytes: 0,
      sha256:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    };
  }
  if (!response.ok) {
    throw new Error(`Failed to load artifact: ${response.status}`);
  }

  const body = full
    ? { bytes: new Uint8Array(await response.arrayBuffer()), truncated: false }
    : await readArtifactPreviewBody(response, ARTIFACT_PREVIEW_MAX_BYTES);
  const bytes = body.bytes;
  const contentLengthHeader = response.headers.get("Content-Length");
  const contentLength =
    contentLengthHeader === null ? undefined : Number(contentLengthHeader);
  const totalBytes =
    contentRange?.total ??
    (contentLength !== undefined && Number.isFinite(contentLength)
      ? contentLength
      : undefined);
  // Asking for full content cannot turn a partial server response into a
  // complete editable revision. The received bytes are the authority.
  const truncated =
    body.truncated ||
    (response.status === 206 &&
      (contentRange?.end === undefined ||
        contentRange.total > contentRange.end + 1)) ||
    (totalBytes !== undefined && totalBytes > bytes.byteLength);
  // Streaming decode intentionally holds an incomplete trailing UTF-8 code
  // point instead of fabricating U+FFFD at the range boundary.
  const content = new TextDecoder().decode(bytes, { stream: truncated });
  const etag = response.headers.get("etag");
  const sha256 = truncated
    ? undefined
    : (etag?.match(/^(?:W\/)?"([0-9a-fA-F]{64})"$/)?.[1]?.toLowerCase() ??
      (await sha256OfBytes(bytes)));
  return {
    content,
    url,
    sha256,
    truncated,
    previewBytes: bytes.byteLength,
    totalBytes,
  };
}

export function loadArtifactContentFromToolCall({
  url: urlString,
  thread,
}: {
  url: string;
  thread: BaseStream<AgentThreadState>;
}) {
  const draftContent = buildWriteFileDraftContent({
    filepath: urlString,
    messages: thread.messages,
  });
  if (draftContent !== undefined) {
    return draftContent;
  }

  const url = new URL(urlString);
  const toolCallId = url.searchParams.get("tool_call_id");
  const messageId = url.searchParams.get("message_id");
  if (messageId && toolCallId) {
    const message = thread.messages.find((message) => message.id === messageId);
    if (message?.type === "ai" && message.tool_calls) {
      const toolCall = message.tool_calls.find(
        (toolCall) => toolCall.id === toolCallId,
      );
      if (toolCall) {
        return toolCall.args.content;
      }
    }
  }
}
