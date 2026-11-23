import { runInNewContext } from "node:vm";

import { expect, test } from "@rstest/core";

import { appendHtmlPreviewScrollRestoration } from "@/core/artifacts/preview";

for (const readiness of ["loading", "complete"]) {
  for (const authored of [null, "0", "-1"]) {
    test(`preview document admits keyboard entry at ${readiness}, authored tabindex=${authored}`, () => {
      const attribute = authored === null ? "" : ` tabindex="${authored}"`;
      const html = `<!doctype html><html><head></head><body${attribute}><p>Read-only report</p></body></html>`;
      const preview = appendHtmlPreviewScrollRestoration(
        html,
        "public-report.html",
      );
      const parsed = new DOMParser().parseFromString(preview, "text/html");
      Object.defineProperty(parsed, "readyState", { value: readiness });
      const script = parsed.querySelector(
        "script[data-deerflow-artifact-scroll-restoration]",
      )!;
      const messages: unknown[] = [];
      const lifecycle = new EventTarget();
      const runtime = {
        parent: { postMessage: (message: unknown) => messages.push(message) },
        addEventListener: lifecycle.addEventListener.bind(lifecycle),
        scrollX: 0,
        scrollY: 0,
        scrollTo: () => undefined,
      };
      runInNewContext(script.textContent, {
        window: runtime,
        document: parsed,
      });
      if (readiness === "loading") {
        expect(parsed.body.getAttribute("tabindex")).toBe(authored);
        expect(messages).toHaveLength(0);
        parsed.dispatchEvent(new Event("DOMContentLoaded"));
      }
      expect(parsed.body.getAttribute("tabindex")).toBe(authored ?? "0");
      expect(parsed.body.innerHTML).toBe("<p>Read-only report</p>");
      expect(messages).toEqual([
        expect.objectContaining({ type: "restore-request" }),
      ]);
      parsed.dispatchEvent(new Event("DOMContentLoaded"));
      expect(messages).toHaveLength(1);
      lifecycle.dispatchEvent(new Event("load"));
      expect(messages).toHaveLength(2);
      expect(
        appendHtmlPreviewScrollRestoration(preview, "public-report.html"),
      ).toBe(preview);
    });
  }
}
