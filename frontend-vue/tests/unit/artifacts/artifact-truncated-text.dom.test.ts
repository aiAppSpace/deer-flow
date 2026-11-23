import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

// The real application documents use standards mode; provide that same DOM
// contract before eager artifact Markdown imports inspect it.
vi.hoisted(() => {
  if (document.doctype === null) {
    document.insertBefore(
      document.implementation.createDocumentType("html", "", ""),
      document.documentElement,
    );
  }
});

import ArtifactPreview from "@/components/workspace/artifacts/ArtifactPreview.vue";
import { classifyArtifact } from "@/core/artifacts/policy";

describe("truncated artifact native code presentation", () => {
  it.each(["preview.js", "preview.csv"])(
    "renders the actual %s source fallback with the same readable text scale and wrapping",
    (filename) => {
      const content =
        "first line\n<script>literal source</script>\n" +
        "wide source ".repeat(40);
      const wrapper = mount(ArtifactPreview, {
        props: {
          policy: classifyArtifact(`/mnt/user-data/outputs/${filename}`),
          filename,
          content,
          viewMode: "code",
          htmlPreviewAllowed: false,
          truncated: true,
          identity: `thread-1:${filename}`,
        },
        global: {
          stubs: { ArtifactTablePreview: true, ArtifactEditor: true },
        },
      });
      try {
        const pre = wrapper.get("pre");
        expect(pre.element.textContent).toBe(content);
        expect(pre.find("script").exists()).toBe(false);
        expect(pre.classes()).toEqual(
          expect.arrayContaining([
            "size-full",
            "overflow-auto",
            "p-4",
            "font-mono",
            "text-sm",
            "whitespace-pre-wrap",
          ]),
        );
        expect(pre.classes()).not.toContain("text-xs");
        expect(pre.classes()).not.toContain("leading-5");
        expect(wrapper.findComponent({ name: "ArtifactEditor" }).exists()).toBe(
          false,
        );
      } finally {
        wrapper.unmount();
      }
    },
  );
});
