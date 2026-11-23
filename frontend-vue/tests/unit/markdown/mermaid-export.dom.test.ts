import { afterEach, expect, it, vi } from "vitest";

import {
  serializeMermaidSvg,
  svgToPngBlob,
} from "@/core/markdown/mermaid-export";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

it("rejects a retired conversion before creating its image", async () => {
  const image = vi.fn();
  vi.stubGlobal("Image", image);
  const controller = new AbortController();
  controller.abort();
  await expect(svgToPngBlob("<svg/>", controller.signal)).rejects.toMatchObject(
    { name: "AbortError" },
  );
  expect(image).not.toHaveBeenCalled();
});

it("retires a pending image and removes its abort and image callbacks", async () => {
  const image = { src: "", crossOrigin: "", onload: null, onerror: null };
  vi.stubGlobal("Image", function Image() {
    return image;
  });
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const conversion = svgToPngBlob("<svg/>", controller.signal);
  const rejected = expect(conversion).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(image.src).toMatch(/^data:image\/svg\+xml;base64,/);
  controller.abort();
  await rejected;
  expect(image.src).toBe("");
  expect(image.onload).toBeNull();
  expect(image.onerror).toBeNull();
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});

it("rejects a retired canvas encoding when the native callback arrives", async () => {
  vi.stubGlobal(
    "Image",
    class {
      width = 10;
      height = 5;
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  let complete!: BlobCallback;
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => {
      complete = callback;
    },
  );
  const controller = new AbortController();
  const conversion = svgToPngBlob("<svg/>", controller.signal);
  const rejected = expect(conversion).rejects.toMatchObject({
    name: "AbortError",
  });
  await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
  controller.abort();
  complete(new Blob(["png"], { type: "image/png" }));
  await rejected;
});
