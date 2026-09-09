export function getTabularDelimiter(
  language: string | null,
): "," | "\t" | null {
  return language === "csv" ? "," : language === "tsv" ? "\t" : null;
}

export type ArtifactViewMode = "code" | "preview";

type ArtifactPreviewMessage = {
  type?: string;
  id?: string;
  name?: string | null;
  tool_call_id?: string;
  content?: unknown;
  tool_calls?: Array<{
    id?: string;
    name?: string;
    args?: Record<string, unknown>;
  }>;
};

export function isWriteFileArtifact(filepath: string) {
  return filepath.startsWith("write-file:");
}

function hasSuccessfulWriteResult(toolResult: string | undefined) {
  return toolResult?.trim() === "OK";
}

function hasFailedWriteResult(toolResult: string | undefined) {
  return (
    typeof toolResult === "string" && !hasSuccessfulWriteResult(toolResult)
  );
}

function htmlTagCount(content: string, tag: string, closing = false) {
  const slash = closing ? String.raw`/\s*` : "";
  return Array.from(
    content.matchAll(new RegExp(String.raw`<\s*${slash}${tag}\b[^>]*>`, "gi")),
  ).length;
}

export function hasMalformedCompletedHtmlDocument(content: string) {
  const lowered = content.toLowerCase();
  const completeDocument =
    lowered.includes("</body") || lowered.includes("</html");
  const closesStructuralRegion = ["head", "style", "script"].some((tag) =>
    lowered.includes(`</${tag}`),
  );
  if (!completeDocument && !closesStructuralRegion) {
    return false;
  }

  for (const tag of ["style", "script"]) {
    if (htmlTagCount(content, tag) !== htmlTagCount(content, tag, true)) {
      return true;
    }
  }

  if (lowered.includes("</head") && htmlTagCount(content, "head") === 0) {
    return true;
  }

  if (!completeDocument) {
    return false;
  }

  for (const tag of ["html", "body"]) {
    if (
      htmlTagCount(content, tag) === 0 ||
      htmlTagCount(content, tag, true) === 0
    ) {
      return true;
    }
  }

  const positions = {
    htmlOpen: lowered.indexOf("<html"),
    headOpen: lowered.indexOf("<head"),
    headClose: lowered.indexOf("</head"),
    bodyOpen: lowered.indexOf("<body"),
    bodyClose: lowered.indexOf("</body"),
    htmlClose: lowered.indexOf("</html"),
  };
  if (positions.headOpen >= 0 || positions.headClose >= 0) {
    return !(
      positions.htmlOpen <= positions.headOpen &&
      positions.headOpen <= positions.headClose &&
      positions.headClose <= positions.bodyOpen &&
      positions.bodyOpen <= positions.bodyClose &&
      positions.bodyClose <= positions.htmlClose
    );
  }
  return !(
    positions.htmlOpen <= positions.bodyOpen &&
    positions.bodyOpen <= positions.bodyClose &&
    positions.bodyClose <= positions.htmlClose
  );
}

function getTextContent(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }
  return undefined;
}

function findToolResult(
  toolCallId: string,
  messages: ArtifactPreviewMessage[],
) {
  for (const message of messages) {
    if (message.type === "tool" && message.tool_call_id === toolCallId) {
      return getTextContent(message.content);
    }
  }
  return undefined;
}

function parseWriteFileArtifact(filepath: string) {
  if (!isWriteFileArtifact(filepath)) {
    return undefined;
  }
  try {
    const url = new URL(filepath);
    return {
      path: decodeURIComponent(url.pathname),
      messageId: url.searchParams.get("message_id") ?? undefined,
      toolCallId: url.searchParams.get("tool_call_id") ?? undefined,
    };
  } catch {
    return undefined;
  }
}

export function buildWriteFileDraftContent({
  filepath,
  messages,
}: {
  filepath: string;
  messages: ArtifactPreviewMessage[];
}) {
  const target = parseWriteFileArtifact(filepath);
  if (!target) {
    return undefined;
  }

  let draft = "";
  let hasDraft = false;

  for (const message of messages) {
    if (message.type !== "ai") {
      continue;
    }

    for (const toolCall of message.tool_calls ?? []) {
      const args = toolCall.args ?? {};
      if (
        toolCall.name !== "write_file" ||
        args.path !== target.path ||
        typeof args.content !== "string"
      ) {
        continue;
      }

      const toolCallId = toolCall.id;
      const toolResult = toolCallId
        ? findToolResult(toolCallId, messages)
        : undefined;
      const isSelected =
        toolCallId === target.toolCallId &&
        (!target.messageId || message.id === target.messageId);
      if (isSelected && hasFailedWriteResult(toolResult)) {
        return undefined;
      }

      const shouldInclude =
        hasSuccessfulWriteResult(toolResult) ||
        (isSelected && toolResult === undefined);

      if (!shouldInclude) {
        continue;
      }

      if (args.append === true && hasDraft) {
        draft += args.content;
      } else {
        draft = args.content;
      }
      hasDraft = true;

      if (isSelected) {
        return draft;
      }
    }
  }

  return hasDraft ? draft : undefined;
}

export function getArtifactViewState({
  filepath,
  isSupportPreview,
  toolResult,
  content,
}: {
  filepath: string;
  isSupportPreview: boolean;
  toolResult?: string;
  content?: string;
}): {
  canPreview: boolean;
  initialViewMode: ArtifactViewMode;
} {
  const isWriteArtifact = isWriteFileArtifact(filepath);
  const isMalformedHtmlWriteArtifact =
    isWriteArtifact &&
    filepath.toLowerCase().startsWith("write-file:") &&
    filepath.toLowerCase().includes(".htm") &&
    typeof content === "string" &&
    hasMalformedCompletedHtmlDocument(content);
  const canPreview =
    isSupportPreview &&
    !isMalformedHtmlWriteArtifact &&
    (!isWriteArtifact || !hasFailedWriteResult(toolResult));
  return {
    canPreview,
    initialViewMode: canPreview ? "preview" : "code",
  };
}

export function rewriteHtmlPreviewResourceUrls(
  content: string,
  url?: string,
  currentHref = globalThis.location?.href ?? "http://localhost/",
  resourceUrlMap = new Map<string, string>(),
) {
  if (!url) {
    return content;
  }

  const baseHref = htmlBaseHref(url, currentHref);
  const withStyleBlocks = content.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_, openTag: string, css: string, closeTag: string) =>
      `${openTag}${rewriteCssResourceUrls(css, baseHref, resourceUrlMap)}${closeTag}`,
  );

  return withStyleBlocks.replace(
    /<\s*[a-z][\w:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/gi,
    (tag) => rewriteHtmlResourceTag(tag, baseHref, resourceUrlMap),
  );
}

function htmlBaseHref(url: string, currentHref: string) {
  const baseUrl = new URL(url, currentHref);
  baseUrl.pathname = baseUrl.pathname.replace(/\/[^/]*$/, "/");
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl.toString();
}

export function resolveHtmlPreviewResourceReference(
  value: string,
  url?: string,
  currentHref = globalThis.location?.href ?? "http://localhost/",
) {
  if (!url) {
    return value;
  }
  return resolveHtmlPreviewResourceUrl(
    value,
    htmlBaseHref(url, currentHref),
    new Map(),
  );
}

const RESOURCE_LINK_RELS = new Set([
  "apple-touch-icon",
  "icon",
  "manifest",
  "modulepreload",
  "preload",
  "stylesheet",
]);

export function collectHtmlPreviewResourceUrls(content: string) {
  const urls = new Set<string>();
  content.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, _openTag: string, css: string) => {
      for (const url of collectCssResourceUrls(css)) {
        urls.add(url);
      }
      return "";
    },
  );
  content.replace(
    /<\s*[a-z][\w:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/gi,
    (tag) => {
      for (const url of collectHtmlResourceTagUrls(tag)) {
        urls.add(url);
      }
      return "";
    },
  );
  return [...urls];
}

function rewriteHtmlResourceTag(
  tag: string,
  baseHref: string,
  resourceUrlMap: Map<string, string>,
) {
  const tagName = /^<\s*([a-z][\w:-]*)/i.exec(tag)?.[1]?.toLowerCase();
  if (!tagName) {
    return tag;
  }

  const rewritesHref =
    tagName === "link" &&
    getHtmlAttribute(tag, "rel")
      ?.toLowerCase()
      .split(/\s+/)
      .some((rel) => RESOURCE_LINK_RELS.has(rel));

  return tag.replace(
    /(\s)(src|poster|srcset|href|style)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi,
    (match, prefix: string, name: string, separator: string, raw: string) => {
      const lowerName = name.toLowerCase();
      if (lowerName === "href" && !rewritesHref) {
        return match;
      }

      const { quote, value } = parseHtmlAttributeValue(raw);
      const next =
        lowerName === "srcset"
          ? rewriteSrcsetResourceUrls(value, baseHref, resourceUrlMap)
          : lowerName === "style"
            ? rewriteCssResourceUrls(value, baseHref, resourceUrlMap)
            : resolveHtmlPreviewResourceUrl(value, baseHref, resourceUrlMap);
      if (next === value) {
        return match;
      }
      return `${prefix}${name}${separator}${formatHtmlAttributeValue(
        next,
        quote,
      )}`;
    },
  );
}

function collectHtmlResourceTagUrls(tag: string) {
  const tagName = /^<\s*([a-z][\w:-]*)/i.exec(tag)?.[1]?.toLowerCase();
  if (!tagName) {
    return [];
  }

  const rewritesHref =
    tagName === "link" &&
    getHtmlAttribute(tag, "rel")
      ?.toLowerCase()
      .split(/\s+/)
      .some((rel) => RESOURCE_LINK_RELS.has(rel));
  const urls: string[] = [];
  tag.replace(
    /(\s)(src|poster|srcset|href|style)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi,
    (
      _match,
      _prefix: string,
      name: string,
      _separator: string,
      raw: string,
    ) => {
      const lowerName = name.toLowerCase();
      if (lowerName === "href" && !rewritesHref) {
        return "";
      }

      const { value } = parseHtmlAttributeValue(raw);
      if (lowerName === "srcset") {
        urls.push(...collectSrcsetResourceUrls(value));
      } else if (lowerName === "style") {
        urls.push(...collectCssResourceUrls(value));
      } else {
        urls.push(value);
      }
      return "";
    },
  );
  return urls;
}

function getHtmlAttribute(tag: string, name: string) {
  const match = new RegExp(
    String.raw`\s${name}\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>` +
      "`" +
      String.raw`]+)`,
    "i",
  ).exec(tag);
  if (!match?.[1]) {
    return undefined;
  }
  return parseHtmlAttributeValue(match[1]).value;
}

function parseHtmlAttributeValue(raw: string) {
  const quote = raw.startsWith('"') ? '"' : raw.startsWith("'") ? "'" : "";
  return {
    quote,
    value: quote ? raw.slice(1, -1) : raw,
  };
}

function formatHtmlAttributeValue(value: string, quote: string) {
  if (quote === "'") {
    return `'${value.replaceAll("'", "&#39;")}'`;
  }
  return `"${value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`;
}

function resolveHtmlPreviewResourceUrl(
  value: string,
  baseHref: string,
  resourceUrlMap: Map<string, string>,
) {
  const trimmed = value.trim();
  if (!trimmed || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(trimmed)) {
    return resourceUrlMap.get(trimmed) ?? value;
  }

  const artifactApiPrefix = /^(.*\/artifacts)(?:\/mnt\/user-data\/.*)?$/.exec(
    baseHref,
  )?.[1];
  if (artifactApiPrefix && trimmed.startsWith("/mnt/user-data/")) {
    const resolved = `${artifactApiPrefix}${trimmed}`;
    return resourceUrlMap.get(resolved) ?? resolved;
  }

  try {
    const resolved = new URL(trimmed, baseHref).toString();
    return resourceUrlMap.get(resolved) ?? resolved;
  } catch {
    return value;
  }
}

function rewriteSrcsetResourceUrls(
  value: string,
  baseHref: string,
  resourceUrlMap: Map<string, string>,
) {
  if (/\bdata:/i.test(value)) {
    return value;
  }
  return value
    .split(",")
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      if (!parts[0]) {
        return candidate;
      }
      return [
        resolveHtmlPreviewResourceUrl(parts[0], baseHref, resourceUrlMap),
        ...parts.slice(1),
      ].join(" ");
    })
    .join(", ");
}

function collectSrcsetResourceUrls(value: string) {
  if (/\bdata:/i.test(value)) {
    return [];
  }
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter((url): url is string => Boolean(url));
}

function rewriteCssResourceUrls(
  value: string,
  baseHref: string,
  resourceUrlMap: Map<string, string>,
) {
  return value.replace(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/gi,
    (match, doubleQuoted: string, singleQuoted: string, bare: string) => {
      const raw = doubleQuoted ?? singleQuoted ?? bare ?? "";
      const next = resolveHtmlPreviewResourceUrl(raw, baseHref, resourceUrlMap);
      if (next === raw) {
        return match;
      }
      return `url(${next.replaceAll(")", "%29")})`;
    },
  );
}

function collectCssResourceUrls(value: string) {
  const urls: string[] = [];
  value.replace(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/gi,
    (_match, doubleQuoted: string, singleQuoted: string, bare: string) => {
      urls.push(doubleQuoted ?? singleQuoted ?? bare ?? "");
      return "";
    },
  );
  return urls;
}

function escapeHtmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

export function appendHtmlPreviewBaseHref(
  content: string,
  url?: string,
  currentHref = globalThis.location?.href ?? "http://localhost/",
) {
  if (!url || /<base\s/i.exec(content)) {
    return content;
  }

  const baseHref = htmlBaseHref(url, currentHref);
  const baseElement = `<base href="${escapeHtmlAttribute(baseHref)}">`;
  // "(?:\s[^>]*)?" keeps the tag-name boundary so `<header>` (a common
  // leading tag in agent-generated fragments) is not mistaken for `<head>`;
  // mirrors appendHtmlPreviewScrollRestoration below.
  if (/<head(?:\s[^>]*)?>/i.test(content)) {
    return content.replace(
      /<head(?:\s[^>]*)?>/i,
      (headTag) => `${headTag}${baseElement}`,
    );
  }
  return `${baseElement}${content}`;
}

export const HTML_PREVIEW_SCROLL_MESSAGE_SOURCE =
  "deerflow-artifact-preview-scroll";

export function createHtmlPreviewScrollKey(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `artifact-scroll:${(hash >>> 0).toString(36)}`;
}

function escapeJavaScriptString(value: string) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function htmlScrollRestorationScript(messageKey: string) {
  return `<script data-deerflow-artifact-scroll-restoration>
(() => {
  const source = ${escapeJavaScriptString(HTML_PREVIEW_SCROLL_MESSAGE_SOURCE)};
  const key = ${escapeJavaScriptString(messageKey)};
  const post = (type, payload = {}) => {
    window.parent.postMessage({ source, key, type, ...payload }, "*");
  };
  const save = () => {
    post("save", {
      x: Math.round(window.scrollX || 0),
      y: Math.round(window.scrollY || 0),
    });
  };
  const restore = (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      window.scrollTo(x, y);
    }
  };
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (
      !data ||
      data.source !== source ||
      data.key !== key ||
      data.type !== "restore"
    ) {
      return;
    }
    restore(data.x, data.y);
  });
  window.addEventListener("scroll", save, { passive: true });
  window.addEventListener("pagehide", save);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => post("restore-request"), { once: true });
  } else {
    post("restore-request");
  }
  window.addEventListener("load", () => post("restore-request"), { once: true });
})();
</script>`;
}

export function appendHtmlPreviewScrollRestoration(
  content: string,
  scrollKey = "default",
) {
  if (content.includes("data-deerflow-artifact-scroll-restoration")) {
    return content;
  }
  const script = htmlScrollRestorationScript(
    createHtmlPreviewScrollKey(scrollKey),
  );
  if (/<head(?:\s[^>]*)?>/i.test(content)) {
    return content.replace(
      /<head(?:\s[^>]*)?>/i,
      (headTag) => `${headTag}${script}`,
    );
  }
  if (/<\/body\s*>/i.test(content)) {
    return content.replace(/<\/body\s*>/i, `${script}</body>`);
  }
  return `${content}${script}`;
}
