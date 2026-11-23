/** Mermaid returns an HTML fragment, including HTML labels in foreignObject.
 * Serialize the inert DOM as XML before downloading SVG or decoding it as an
 * image. HTML void tags and named entities are not valid standalone SVG XML.
 */
export function serializeMermaidSvg(source: string): string {
  const template = document.createElement("template");
  template.innerHTML = source;
  const svg = template.content.firstElementChild;
  if (
    svg?.localName !== "svg" ||
    svg.namespaceURI !== "http://www.w3.org/2000/svg"
  )
    throw new Error("Mermaid output has no SVG root");
  return new XMLSerializer().serializeToString(svg);
}
