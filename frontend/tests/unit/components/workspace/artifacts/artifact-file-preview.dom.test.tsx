import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { ArtifactFilePreview } from "@/components/workspace/artifacts/artifact-file-preview";

/*
  The preview iframe is sandboxed without `allow-same-origin`, so the document
  it renders has an opaque origin and its own subresource requests carry no
  cookies. A private artifact's images and stylesheets therefore cannot be left
  to `<base href>`: the URL would resolve and the request would still come back
  401. They are fetched here, in the credentialed parent, and inlined.

  This is pinned at the component level on purpose. The pure rewrite helpers in
  `core/artifacts/preview.ts` have their own tests, but they stayed green while
  an upstream merge replaced the component that called them -- leaving the
  helpers as unreferenced dead code and the preview quietly back on `<base
  href>`. Only a test that renders the component notices that.
*/

const ARTIFACT_URL = "/api/threads/t-1/artifacts/report.html";
const IMAGE_URL = "/api/threads/t-1/artifacts/chart.png";

let capturedHtml = "";
let fetchCalls: string[] = [];

function mount(content: string) {
  return render(
    <ArtifactFilePreview
      content={content}
      language="html"
      scrollKey="artifact-1"
      url={ARTIFACT_URL}
    />,
  );
}

afterEach(cleanup);

beforeEach(() => {
  capturedHtml = "";
  fetchCalls = [];

  // Capture what the component puts in the blob instead of chasing the
  // object URL, which jsdom cannot read back.
  rs.spyOn(URL, "createObjectURL").mockImplementation(
    (blob: Blob | MediaSource) => {
      if (blob instanceof Blob) {
        void blob.text().then((text) => {
          capturedHtml = text;
        });
      }
      return "blob:preview";
    },
  );
  rs.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

  rs.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const requested =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    fetchCalls.push(requested);
    return Promise.resolve(
      new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), {
        status: 200,
      }),
    );
  });
});

describe("ArtifactFilePreview html resources", () => {
  it("inlines same-origin artifact resources so the sandboxed iframe can load them", async () => {
    mount(`<html><head></head><body><img src="chart.png"></body></html>`);

    await waitFor(() => expect(capturedHtml).not.toBe(""));

    expect(fetchCalls.some((url) => url.includes(IMAGE_URL))).toBe(true);
    expect(capturedHtml).toContain("data:image/png;base64,");
    // The original relative reference must be gone: leaving it behind is the
    // bug, because the iframe would re-request it uncredentialed.
    expect(capturedHtml).not.toContain('src="chart.png"');
  });

  it("leaves cross-origin resources alone and still emits a base href for them", async () => {
    mount(
      `<html><head></head><body><img src="https://example.com/logo.png"></body></html>`,
    );

    await waitFor(() => expect(capturedHtml).not.toBe(""));

    expect(fetchCalls.some((url) => url.includes("example.com"))).toBe(false);
    expect(capturedHtml).toContain("https://example.com/logo.png");
    expect(capturedHtml).toContain("<base href=");
  });

  it("renders the iframe without allow-same-origin", () => {
    mount(`<html><head></head><body>hi</body></html>`);

    const iframe = screen.getByTitle("Artifact preview");
    const sandbox = iframe.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    // If this ever gains allow-same-origin the inlining above becomes
    // unnecessary -- and this whole file should be revisited, not deleted
    // silently.
    expect(sandbox).not.toContain("allow-same-origin");
  });
});
