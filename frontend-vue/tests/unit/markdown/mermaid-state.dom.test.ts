import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MermaidDiagram from "@/components/markdown/MermaidDiagram.vue";
const renderer = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));
const downloads = vi.hoisted(() => ({
  saveBlob: vi.fn(),
  svgToPngBlob: vi.fn(),
}));
vi.mock("mermaid", () => ({ default: renderer }));
vi.mock("@/core/markdown/mermaid-export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/markdown/mermaid-export")>()),
  ...downloads,
}));
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined);
  renderer.initialize.mockReset();
  renderer.parse.mockReset().mockResolvedValue(true);
  renderer.render
    .mockReset()
    .mockResolvedValue({ svg: '<svg data-ready="yes"></svg>' });
  downloads.saveBlob.mockReset();
  downloads.svgToPngBlob.mockReset().mockResolvedValue(new Blob(["png"]));
});
const create = () => {
  const wrapper = mount(MermaidDiagram, {
    attachTo: document.body,
    props: { code: "graph TD; A-->B;" },
  });
  wrappers.push(wrapper);
  return wrapper;
};
describe("upstream Mermaid asynchronous states", () => {
  it("keeps the block toolbar and loading spinner until the initial render settles", async () => {
    renderer.parse.mockReturnValue(new Promise(() => {}));
    const wrapper = create();
    await flushPromises();
    expect(
      wrapper.find('[data-streamdown="mermaid-block-actions"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain("Loading diagram...");
    expect(wrapper.find(".animate-spin").exists()).toBe(true);
  });
  it("shows the upstream error and expandable original source on initial failure", async () => {
    renderer.parse.mockRejectedValue(new Error("incomplete diagram"));
    const wrapper = create();
    await flushPromises();
    expect(wrapper.text()).toContain("Mermaid Error: incomplete diagram");
    expect(wrapper.get("details summary").text()).toBe("Show Code");
    expect(wrapper.get("details pre").text()).toBe("graph TD; A-->B;");
    expect(wrapper.find('[data-streamdown="code-block"]').exists()).toBe(false);
  });
  it("waits for viewport entry and upstream debounce before rendering", async () => {
    vi.useFakeTimers();
    let callback: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(fn: IntersectionObserverCallback) {
          callback = fn;
        }
        observe() {}
        disconnect = disconnect;
        takeRecords() {
          return [];
        }
      },
    );
    const wrapper = create();
    await flushPromises();
    expect(wrapper.find(".min-h-\\[200px\\]").exists()).toBe(true);
    expect(renderer.parse).not.toHaveBeenCalled();
    callback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await vi.advanceTimersByTimeAsync(299);
    expect(renderer.parse).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    await flushPromises();
    expect(renderer.render).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
  it("retains the last successful SVG when a later streaming fragment is invalid", async () => {
    const wrapper = create();
    await flushPromises();
    renderer.parse.mockRejectedValue(new Error("partial"));
    await wrapper.setProps({ code: "graph TD; A--" });
    await flushPromises();
    expect(wrapper.find("[data-ready=yes]").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Mermaid Error:");
  });
  it("ignores an earlier render that completes after a newer source", async () => {
    let resolveEarlier: ((result: { svg: string }) => void) | undefined;
    renderer.render.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveEarlier = resolve;
        }),
    );
    const wrapper = create();
    await flushPromises();
    renderer.render.mockResolvedValue({ svg: '<svg data-new="yes"></svg>' });
    await wrapper.setProps({ code: "graph TD; B-->C;" });
    await flushPromises();
    resolveEarlier?.({ svg: '<svg data-old="yes"></svg>' });
    await flushPromises();
    expect(wrapper.find("[data-new=yes]").exists()).toBe(true);
    expect(wrapper.find("[data-old=yes]").exists()).toBe(false);
  });
  it("cancels viewport debounce on leave and disconnects on disposal", async () => {
    vi.useFakeTimers();
    let callback: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(fn: IntersectionObserverCallback) {
          callback = fn;
        }
        observe() {}
        disconnect = disconnect;
        takeRecords() {
          return [];
        }
      },
    );
    const wrapper = create();
    await flushPromises();
    callback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await vi.advanceTimersByTimeAsync(100);
    callback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await vi.advanceTimersByTimeAsync(400);
    expect(renderer.parse).not.toHaveBeenCalled();
    callback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();
    expect(disconnect).toHaveBeenCalled();
    expect(renderer.parse).not.toHaveBeenCalled();
  });
  it("renders fullscreen immediately while the inline chart is still outside the viewport", async () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    renderer.parse.mockRejectedValue(new Error("invalid fullscreen"));
    const wrapper = create();
    await flushPromises();
    expect(renderer.parse).not.toHaveBeenCalled();
    await wrapper.get('button[title="View fullscreen"]').trigger("click");
    await flushPromises();
    expect(renderer.parse).toHaveBeenCalledWith("graph TD; A-->B;");
    expect(document.body.textContent).toContain(
      "Mermaid Error: invalid fullscreen",
    );
    expect(
      document.body.querySelector('[role="dialog"] details pre')?.textContent,
    ).toBe("graph TD; A-->B;");
  });
  it("exports a freshly rendered current source before viewport rendering and does not download failures", async () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    const wrapper = create();
    await flushPromises();
    await wrapper.setProps({ code: "graph TD; B-->C;" });
    await wrapper.get('button[title="Download diagram"]').trigger("click");
    await wrapper
      .get('button[title="Download diagram as SVG"]')
      .trigger("click");
    await flushPromises();
    expect(renderer.parse).toHaveBeenCalledWith("graph TD; B-->C;");
    const [name, blob] = downloads.saveBlob.mock.calls[0]!;
    expect(name).toBe("diagram.svg");
    expect(await (blob as Blob).text()).toContain("data-ready");
    renderer.parse.mockRejectedValue(new Error("incomplete current code"));
    await wrapper.get('button[title="Download diagram"]').trigger("click");
    await wrapper
      .get('button[title="Download diagram as PNG"]')
      .trigger("click");
    await flushPromises();
    expect(downloads.saveBlob).toHaveBeenCalledTimes(1);
    expect(downloads.svgToPngBlob).not.toHaveBeenCalled();
  });

  for (const retirement of ["source-change", "unmount"] as const)
    it(`retires an in-flight SVG download on ${retirement}`, async () => {
      const wrapper = create();
      await flushPromises();
      let complete!: (value: { svg: string }) => void;
      renderer.render.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      await wrapper.get('button[title="Download diagram"]').trigger("click");
      await wrapper
        .get('button[title="Download diagram as SVG"]')
        .trigger("click");
      await flushPromises();
      expect(complete).toBeTypeOf("function");
      if (retirement === "unmount") wrapper.unmount();
      else await wrapper.setProps({ code: "graph TD; New-->Source;" });
      complete({ svg: '<svg data-stale="yes"></svg>' });
      await flushPromises();
      expect(downloads.saveBlob).not.toHaveBeenCalled();
    });

  it("retires an in-flight PNG conversion before it can download after unmount", async () => {
    const wrapper = create();
    await flushPromises();
    let complete!: (value: Blob) => void;
    downloads.svgToPngBlob.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    await wrapper.get('button[title="Download diagram"]').trigger("click");
    await wrapper
      .get('button[title="Download diagram as PNG"]')
      .trigger("click");
    await flushPromises();
    expect(complete).toBeTypeOf("function");
    wrapper.unmount();
    complete(new Blob(["retired png"]));
    await flushPromises();
    expect(downloads.saveBlob).not.toHaveBeenCalled();
  });
});
