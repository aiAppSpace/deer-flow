import remarkParse from "remark-parse";
import { unified } from "unified";

export type CitationOccurrence = {
  index: number;
  title: string;
};

export type CitationSource = {
  id: string;
  title: string;
  url: string;
  domain: string;
  count: number;
  occurrences: CitationOccurrence[];
};

// Uses a non-consuming lookbehind (?<!!) to skip image links (![citation:…])
// without eating the boundary char, so back-to-back citations both match. The
// URL sub-pattern consumes either non-paren chars or a balanced (…) group, so
// disambiguation URLs like .../Foo_(a)_(b) survive rather than truncating at
// the first inner paren.
const CITATION_LINK_RE =
  /(?<!!)\[citation:\s*([^\]]+?)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/gi;

const GENERIC_CITATION_TITLES = new Set(["source", "来源"]);

export function extractCitationSources(markdown: string): CitationSource[] {
  if (!markdown) {
    return [];
  }

  const searchable = maskCitationCode(markdown);
  const sourcesByUrl = new Map<string, CitationSource>();

  for (const match of searchable.matchAll(CITATION_LINK_RE)) {
    const rawTitle = (match[1] ?? "").trim();
    const rawUrl = match[2] ?? "";
    const url = normalizeUrl(rawUrl);
    if (!url) {
      continue;
    }

    const domain = extractDomain(url);
    const title = normalizeTitle(rawTitle, domain);
    const index = match.index ?? 0;
    const existing = sourcesByUrl.get(url);

    if (existing) {
      existing.count += 1;
      existing.occurrences.push({ index, title });
      continue;
    }

    sourcesByUrl.set(url, {
      id: url,
      title,
      url,
      domain,
      count: 1,
      occurrences: [{ index, title }],
    });
  }

  return Array.from(sourcesByUrl.values());
}

export function formatCitationMarkdownReference(
  source: CitationSource,
): string {
  return `[${source.title}](${source.url})`;
}

function normalizeTitle(title: string, domain: string): string {
  const compact = title.replace(/\s+/g, " ").trim();
  if (!compact || GENERIC_CITATION_TITLES.has(compact.toLowerCase())) {
    return domain;
  }
  return compact;
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

// Use the renderer's CommonMark parser for fenced, indented and inline code,
// including list/blockquote containers. Keep UTF-16 offsets and line breaks so
// citation occurrence positions still address the unchanged message source.
const codeProcessor = unified().use(remarkParse);
type CodeNode = {
  type: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: CodeNode[];
};
export function maskCitationCode(markdown: string): string {
  // Without delimiters or line-leading whitespace, Markdown cannot contain code.
  if (!/[`~]|(?:^|\n)[ \t]/.test(markdown)) return markdown;
  const pending: CodeNode[] = [codeProcessor.parse(markdown) as CodeNode];
  const parts: string[] = [];
  let offset = 0;
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === "code" || node.type === "inlineCode") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) {
        parts.push(
          markdown.slice(offset, start),
          markdown.slice(start, end).replace(/[^\r\n]/g, " "),
        );
        offset = end;
      }
    } else if (node.children) {
      for (let index = node.children.length - 1; index >= 0; index--)
        pending.push(node.children[index]!);
    }
  }
  parts.push(markdown.slice(offset));
  return parts.join("");
}
