import { afterEach, describe, expect, it, vi } from "vitest";
import katex from "katex";
import mermaid from "mermaid";
import { katexOptions } from "@/core/markdown/plugins";

const config = {
  startOnLoad: false,
  securityLevel: "strict" as const,
  theme: "default" as const,
  fontFamily: "monospace",
  suppressErrorRendering: true,
};
const svgDescriptors = ["getBBox", "getComputedTextLength"].map(
  (name) =>
    [
      name,
      Object.getOwnPropertyDescriptor(SVGElement.prototype, name),
    ] as const,
);
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  mermaid.initialize(config);
  for (const [name, descriptor] of svgDescriptors) {
    if (descriptor)
      Object.defineProperty(SVGElement.prototype, name, descriptor);
    else Reflect.deleteProperty(SVGElement.prototype, name);
  }
});

describe("installed renderer security regressions", () => {
  it("ignores inherited trust on the renderer options prototype", () => {
    const inherited = Object.assign(
      Object.create({ trust: true }),
      katexOptions,
    );
    const html = katex.renderToString(
      "\\href{javascript:alert(1)}{link}",
      inherited,
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(host.querySelector("a")).toBeNull();
    expect(host.textContent).toContain("\\href");
  });
  it("does not pollute Object.prototype through Mermaid configuration", () => {
    mermaid.initialize(JSON.parse('{"__proto__":{"rendererPolluted":true}}'));
    expect(Object.prototype).not.toHaveProperty("rendererPolluted");
    expect(mermaid.mermaidAPI.getConfig()).not.toHaveProperty(
      "rendererPolluted",
    );
  });
  it("keeps state classDef text inside the generated SVG", async () => {
    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 120, height: 24 }),
    });
    Object.defineProperty(SVGElement.prototype, "getComputedTextLength", {
      configurable: true,
      value: () => 120,
    });
    // Exercise the CSS fix independently of the final strict DOMPurify pass.
    // Production still uses strict; its exact initialization is covered by mermaid.dom.test.
    mermaid.initialize({ ...config, securityLevel: "loose" });
    const code =
      'stateDiagram-v2\nclassDef marker fill:red</style></svg><div id="renderer-injected">injected</div><svg><style>a:b\n[*] --> A:::marker';
    const { svg } = await mermaid.render("security-state", code);
    const host = document.createElement("div");
    host.innerHTML = svg;
    expect(host.querySelector("#renderer-injected")).toBeNull();
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });
});
