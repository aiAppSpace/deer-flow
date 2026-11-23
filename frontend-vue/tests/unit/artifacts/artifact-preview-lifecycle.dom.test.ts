import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import ArtifactPreview from "@/components/workspace/artifacts/ArtifactPreview.vue";
import { classifyArtifact } from "@/core/artifacts/policy";

const path = "/mnt/user-data/outputs/page.html";

function mountPreview() {
  return mount(ArtifactPreview, {
    props: {
      policy: classifyArtifact(path),
      filename: "page.html",
      content: '<html><body><img src="photo.png"></body></html>',
      url: `/api/threads/thread-1/artifacts${path}`,
      viewMode: "preview",
      htmlPreviewAllowed: true,
      identity: `thread-1:${path}`,
    },
    global: { stubs: { StreamMarkdown: true, CitationSourcesPanel: true } },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("ArtifactPreview resource lifecycle", () => {
  it.each([
    ["photo.ico", "img"],
    ["audio.mp3", "audio"],
    ["movie.webm", "video"],
    ["report.pdf", "iframe"],
  ])(
    "renders %s with the current browser preview contract",
    async (filename, tag) => {
      const wrapper = mount(ArtifactPreview, {
        props: {
          policy: classifyArtifact(`/mnt/user-data/outputs/${filename}`),
          filename,
          content: "",
          url: "/original",
          viewMode: "preview",
          htmlPreviewAllowed: false,
          identity: filename,
        },
      });
      const element = wrapper.get(tag);
      expect(element.attributes("src")).toBe("/original");
      if (tag === "audio" || tag === "video")
        expect(element.attributes("preload")).toBe("metadata");
      if (tag === "iframe") {
        expect(element.attributes("title")).toBe(filename);
        expect(element.attributes("sandbox")).toBeUndefined();
      }
      wrapper.unmount();
    },
  );

  it("keeps an original download separate from a converted project-document preview", () => {
    const wrapper = mount(ArtifactPreview, {
      props: {
        policy: classifyArtifact("/document.docx"),
        filename: "document.docx",
        content: "",
        url: "/converted-preview",
        downloadUrl: "/original-download",
        viewMode: "preview",
        htmlPreviewAllowed: false,
        identity: "document-1",
      },
    });
    expect(wrapper.get("a").attributes("href")).toBe("/original-download");
    wrapper.unmount();
  });

  it.each(["non-html", "unmount"])(
    "invalidates in-flight work before %s even when fetch ignores cancellation",
    async (transition) => {
      let settle!: (response: Response) => void;
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
        () =>
          new Promise((resolve) => {
            settle = resolve;
          }),
      );
      const create = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:late");
      const wrapper = mountPreview();
      await flushPromises();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const signal = fetchMock.mock.calls[0]?.[1]?.signal;
      if (transition === "unmount") wrapper.unmount();
      else
        await wrapper.setProps({
          policy: classifyArtifact("/notes.md"),
          content: "# notes",
        });
      expect(signal?.aborted).toBe(true);
      settle(new Response(null, { status: 404 }));
      await flushPromises();
      expect(create).not.toHaveBeenCalled();
      if (transition !== "unmount") wrapper.unmount();
    },
  );

  it("releases each created URL when the file identity changes and on disposal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const wrapper = mountPreview();
    await flushPromises();
    expect(create).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ identity: "thread-2:same-path" });
    await flushPromises();
    expect(create).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith("blob:first");
    wrapper.unmount();
    expect(revoke.mock.calls).toEqual([["blob:first"], ["blob:second"]]);
  });
});
