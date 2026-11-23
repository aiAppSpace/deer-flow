/*
  【文件职责】     把渲染好的 mermaid 图导出成文件：PNG 转码与浏览器下载。
  【架构位置】     L2 —— 通用渲染层
  【主要导出】     svgToPngBlob · saveBlob
  【依赖关系】     浏览器 DOM（Image / canvas / URL.createObjectURL）
  【边界与注意】   ① 放在这里而不是 SFC 里，是因为它是**纯逻辑**：没有模板、不读词典、
                   可以单独测。顺带绕开一件事——`tests/unit/i18n/source-guard.test.ts`
                   会把产品 SFC 里 `new Error("…")` 的英文当成未翻译文案，而这几条
                   错误消息是给开发者看的控制流，不是 UI 文案；把它们塞进词典是假的，
                   删成空 Error 又让排查变瞎。

                   ② PNG 放大 5 倍再导出（照抄上游）：SVG 里的文字在 1:1 下发虚，
                   而这张图多半要贴进文档。

                   ③ **转码依赖 SVG 自包含**：外链字体或图片会让 canvas 被污染，
                   `toBlob` 可能直接抛；保留这条失败路径，不把 mermaid 的
                   `securityLevel: "strict"` 当成浏览器可导出的保证。

                   ④ `unescape(encodeURIComponent(...))` 这一步不能省：`btoa` 只吃
                   Latin-1，图里出现任何非 ASCII 字符（中文标签是常态）都会让它抛
                   `InvalidCharacterError`。
*/

/** 见文件头 ②。 */
const PNG_SCALE = 5;

/** Mermaid emits HTML labels in foreignObject. Standalone SVG images require
 * XML serialization, including closed void tags and resolved HTML entities.
 * The detached template never mounts the chart or executes its contents.
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

export async function svgToPngBlob(
  svg: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const aborted = () => new DOMException("Aborted", "AbortError");
  if (signal?.aborted) throw aborted();
  // 见文件头 ④。
  const source = `data:image/svg+xml;base64,${btoa(
    unescape(encodeURIComponent(serializeMermaidSvg(svg))),
  )}`;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    const cleanup = () => {
      element.onload = null;
      element.onerror = null;
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      element.src = "";
      reject(aborted());
    };
    element.crossOrigin = "anonymous";
    element.onload = () => {
      cleanup();
      resolve(element);
    };
    element.onerror = () => {
      cleanup();
      reject(new Error("mermaid: svg image load failed"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    element.src = source;
  });

  if (signal?.aborted) throw aborted();
  const canvas = document.createElement("canvas");
  canvas.width = image.width * PNG_SCALE;
  canvas.height = image.height * PNG_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("mermaid: 2d canvas context unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (signal?.aborted) reject(aborted());
      else if (blob) resolve(blob);
      else reject(new Error("mermaid: png encode failed"));
    }, "image/png");
  });
}

/**
 * 触发一次浏览器下载。
 *
 * 锚点要真的进 DOM 再点：Safari 与 Firefox 对游离节点上的 `click()` 不触发下载。
 */
export function saveBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
