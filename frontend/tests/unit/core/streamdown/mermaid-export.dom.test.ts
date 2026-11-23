import { expect, it } from "@rstest/core";

import { serializeMermaidSvg } from "@/core/streamdown/mermaid-export";

// SVG/foreignObject integration-point parsing requires a real browser.
// The complete XML/entity/Unicode case lives in mermaid-image-export.spec.ts.
it("keeps SVG geometry and does not attach the parsed chart to the live document", () => {
  const before = document.body.innerHTML;
  const result = serializeMermaidSvg(
    '<svg viewBox="0 0 20 10"><path d="M0 0L20 10"/><text>中文</text></svg>',
  );
  expect(result).toContain('d="M0 0L20 10"');
  expect(result).toContain("中文");
  expect(document.body.innerHTML).toBe(before);
});

it("rejects output with no SVG root", () => {
  expect(() => serializeMermaidSvg("<div>not a chart</div>")).toThrow(
    "Mermaid output has no SVG root",
  );
});
