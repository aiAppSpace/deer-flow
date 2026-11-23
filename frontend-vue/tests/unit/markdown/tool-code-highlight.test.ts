import { describe, expect, it } from "vitest";

import { highlightCode } from "@/core/markdown/highlight-code";

describe("tool code highlighter", () => {
  it("produces the real dual-theme tree while escaping source markup and adding no line numbers by default", async () => {
    const html = await highlightCode('<img src=x onerror="alert(1)">', "html");
    expect(html).toContain('class="shiki shiki-themes one-light one-dark-pro"');
    expect(html).toContain("--shiki-dark");
    expect(html).toMatch(/&(?:lt|#x3c|#60);/i);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("min-w-10");
  });
});
