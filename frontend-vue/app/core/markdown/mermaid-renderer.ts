/** One renderer configuration for inline charts, fullscreen charts and exports. */
let sequence = 0;
export async function renderMermaidSvg(code: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    fontFamily: "monospace",
    suppressErrorRendering: true,
  });
  await mermaid.parse(code);
  const { svg } = await mermaid.render(
    `mermaid-${Date.now()}-${++sequence}`,
    code,
  );
  return svg;
}
