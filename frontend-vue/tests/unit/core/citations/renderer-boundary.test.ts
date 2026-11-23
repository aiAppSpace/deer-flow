import { expect, test } from "vitest";
import { extractCitationSources } from "@/core/citations/sources";
import { citedKnowledgeSources } from "@/core/knowledge/sources";
import { markdownToHast } from "@/core/markdown/pipeline";
const knowledgeId = "1234567890abcdef1234567890abcdef-1";
const source = {
  id: knowledgeId,
  provider: "ragflow" as const,
  dataset_name: "Dataset",
  document_name: "Document",
  text: "Evidence",
  truncated: false,
  pages: [],
};
const citation = "[citation:Example](https://example.com/source)";
const knowledge = `[Source](#knowledge-${knowledgeId})`;
const wrappers = [
  ["indented code", (link: string) => `    ${link}\n`],
  ["nested unclosed fence", (link: string) => `> ~~~md\n> ${link}\n`],
  [
    "longer closing fence",
    (link: string) => `~~~md\n${link}\n~~~~\n\n${citation}`,
  ],
] as const;
function links(tree: ReturnType<typeof markdownToHast>): string[] {
  const found: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const item = node as {
      tagName?: string;
      properties?: { href?: unknown };
      children?: unknown[];
    };
    if (item.tagName === "a" && typeof item.properties?.href === "string")
      found.push(item.properties.href);
    item.children?.forEach(walk);
  }
  walk(tree);
  return found;
}
for (const [name, wrap] of wrappers) {
  test(`${name}: source inventory matches actually rendered links`, () => {
    const markdown = wrap(citation);
    expect(
      extractCitationSources(markdown).map((source) => source.url),
    ).toEqual([...new Set(links(markdownToHast(markdown)))]);
  });
  test(`${name}: code cannot claim a knowledge citation`, () => {
    const markdown = wrap(knowledge);
    expect(
      links(markdownToHast(markdown)).filter((href) =>
        href.includes("knowledge-"),
      ),
    ).toEqual([]);
    expect(
      citedKnowledgeSources(markdown, new Map([[knowledgeId, source]])),
    ).toEqual([]);
  });
}
