import { getBackendBaseURL } from "../config";
import { isStaticWebsiteOnly } from "../static-mode";
import type { AgentThreadState } from "../threads";

const EMPTY_ARTIFACT_PATHS: readonly string[] = [];

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function splitPathSuffix(src: string) {
  const [path = ""] = src.split(/[?#]/, 1);
  return {
    path,
    suffix: src.slice(path.length),
  };
}

function encodeArtifactPath(filepath: string) {
  return filepath
    .split("/")
    .map((segment) => encodeURIComponent(decodePathSegment(segment)))
    .join("/");
}

export function buildWriteFileArtifactURL({
  filepath,
  messageId,
  toolCallId,
}: {
  filepath: string;
  messageId?: string;
  toolCallId?: string;
}) {
  const url = new URL("write-file:/");
  url.pathname = filepath.replaceAll("%", "%25");
  if (messageId) {
    url.searchParams.set("message_id", messageId);
  }
  if (toolCallId) {
    url.searchParams.set("tool_call_id", toolCallId);
  }
  return url.toString();
}

function decodeRelativeArtifactPath(filepath: string) {
  return filepath.split("/").map(decodePathSegment).join("/");
}

function normalizeMessageImagePath(src: string) {
  const { path: relativePath, suffix } = splitPathSuffix(src);
  const normalizedPath = relativePath.replace(/^(?:\.\/)+/, "");
  if (
    !normalizedPath ||
    normalizedPath.startsWith("/") ||
    /^[a-z][a-z\d+.-]*:/i.test(normalizedPath) ||
    normalizedPath.startsWith("//") ||
    normalizedPath.split("/").includes("..")
  ) {
    return null;
  }
  return {
    normalizedPath,
    decodedNormalizedPath: decodeRelativeArtifactPath(normalizedPath),
    suffix,
  };
}

export function urlOfArtifact({
  filepath,
  threadId,
  download = false,
  isMock = false,
}: {
  filepath: string;
  threadId: string;
  download?: boolean;
  isMock?: boolean;
}) {
  if (isStaticWebsiteOnly()) {
    return staticDemoArtifactURL({ filepath, threadId, download });
  }
  const encodedThreadId = encodeURIComponent(threadId);
  const encodedFilepath = encodeArtifactPath(filepath);
  if (isMock) {
    return `${getBackendBaseURL()}/mock/api/threads/${encodedThreadId}/artifacts${encodedFilepath}${download ? "?download=true" : ""}`;
  }
  return `${getBackendBaseURL()}/api/threads/${encodedThreadId}/artifacts${encodedFilepath}${download ? "?download=true" : ""}`;
}

export function urlOfArtifactArchive({
  threadId,
  runId,
}: {
  threadId: string;
  runId: string;
}) {
  return `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/artifacts/archive`;
}

export function extractArtifactsFromThread(thread: {
  values: Pick<AgentThreadState, "artifacts">;
}) {
  return thread.values.artifacts ?? EMPTY_ARTIFACT_PATHS;
}

export function resolveArtifactURL(absolutePath: string, threadId: string) {
  if (isStaticWebsiteOnly()) {
    return staticDemoArtifactURL({ filepath: absolutePath, threadId });
  }
  return `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/artifacts${encodeArtifactPath(absolutePath)}`;
}

export function resolveMarkdownArtifactURL(src: string, threadId: string) {
  const { path, suffix } = splitPathSuffix(src);
  return `${resolveArtifactURL(path, threadId)}${suffix}`;
}

export function resolveMessageImageURL(
  src: string,
  threadId: string,
  artifactPaths: readonly string[],
  options: { fallbackToOutputs?: boolean } = {},
) {
  if (src.startsWith("/mnt/")) {
    return resolveMarkdownArtifactURL(src, threadId);
  }

  const imagePath = normalizeMessageImagePath(src);
  if (imagePath === null) {
    return src;
  }

  const matches = artifactPaths.filter((path) =>
    path.endsWith(`/${imagePath.decodedNormalizedPath}`),
  );
  if (matches.length === 1) {
    return `${resolveArtifactURL(matches[0]!, threadId)}${imagePath.suffix}`;
  }

  if (!options.fallbackToOutputs) {
    return src;
  }

  return `${resolveArtifactURL(
    `/mnt/user-data/outputs/${imagePath.decodedNormalizedPath}`,
    threadId,
  )}${imagePath.suffix}`;
}

function staticDemoArtifactURL({
  filepath,
  threadId,
  download = false,
}: {
  filepath: string;
  threadId: string;
  download?: boolean;
}) {
  const demoPath = encodeArtifactPath(filepath.replace(/^\/mnt\//, "/"));
  return `${getBackendBaseURL()}/demo/threads/${encodeURIComponent(threadId)}${demoPath}${download ? "?download=true" : ""}`;
}
