import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  Streamdown,
  StreamdownContext,
  type StreamdownContextType,
  type StreamdownProps,
} from "streamdown";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { I18nProvider } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";
import MermaidRenderer from "@/core/streamdown/mermaid-renderer";
import { streamdownRenderingPlugins } from "@/core/streamdown/plugins";

const engine = rs.hoisted(() => ({
  render: rs.fn(async () => ({
    svg: "<svg><text>Rendered diagram</text></svg>",
  })),
  getMermaid: rs.fn(),
}));
rs.mock("@streamdown/mermaid", () => ({
  mermaid: {
    name: "mermaid",
    type: "diagram",
    language: "mermaid",
    getMermaid: (...args: unknown[]) => {
      engine.getMermaid(...args);
      return { render: engine.render };
    },
  },
}));

beforeEach(() => {
  engine.render
    .mockReset()
    .mockResolvedValue({ svg: "<svg><text>Rendered diagram</text></svg>" });
  engine.getMermaid.mockReset();
  document.cookie = "locale=en-US; path=/";
  rs.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
    () => undefined,
  );
  rs.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      takeRecords() {
        return [];
      }
    },
  );
});

const context: StreamdownContextType = {
  controls: true,
  isAnimating: false,
  lineNumbers: true,
  mode: "static",
  shikiTheme: ["github-light", "github-dark"],
};
function direct(
  code = "flowchart TD\nA-->B",
  overrides: Partial<StreamdownContextType> = {},
  isIncomplete = false,
) {
  return (
    <I18nProvider initialLocale="en-US">
      <StreamdownContext.Provider value={{ ...context, ...overrides }}>
        <MermaidRenderer
          code={code}
          language="mermaid"
          isIncomplete={isIncomplete}
        />
      </StreamdownContext.Provider>
    </I18nProvider>
  );
}
function markdown(
  props: Partial<StreamdownProps> = {},
  locale: "en-US" | "zh-CN" = "en-US",
) {
  const t = locale === "zh-CN" ? zhCN : enUS;
  return (
    <I18nProvider initialLocale={locale}>
      <Streamdown
        mode="static"
        plugins={streamdownRenderingPlugins}
        translations={t.markdown}
        {...props}
      >
        {"```mermaid\nflowchart TD\nA-->B\n```"}
      </Streamdown>
    </I18nProvider>
  );
}
afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
});

it("retains localized controls and the exact source copy under the real Streamdown context", async () => {
  document.cookie = "locale=zh-CN; path=/";
  const writeText = rs.fn(async () => undefined);
  rs.stubGlobal("navigator", { clipboard: { writeText }, language: "zh-CN" });
  render(markdown({}, "zh-CN"));
  await screen.findByRole("img", { name: "Mermaid chart" });
  expect(screen.getByTitle(zhCN.markdown.viewFullscreen)).toBeTruthy();
  expect(screen.getByTitle(zhCN.markdown.downloadDiagram)).toBeTruthy();
  fireEvent.click(screen.getByTitle(zhCN.markdown.copyCode));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith("flowchart TD\nA-->B\n"),
  );
});

it("honors whole and per-action controls while streaming only disables the original toolbar", async () => {
  const view = render(direct());
  await screen.findByRole("img", { name: "Mermaid chart" });
  view.rerender(
    direct(undefined, {
      controls: {
        mermaid: {
          copy: false,
          download: false,
          fullscreen: false,
          panZoom: false,
        },
      },
    }),
  );
  expect(screen.queryByTitle("Copy Code")).toBeNull();
  expect(screen.queryByTitle("Download diagram")).toBeNull();
  expect(screen.queryByTitle("View fullscreen")).toBeNull();
  expect(screen.queryByTitle("Zoom in")).toBeNull();
  expect(screen.getByRole("img", { name: "Mermaid chart" })).toBeTruthy();
  view.rerender(direct(undefined, { isAnimating: true }, true));
  for (const title of ["Copy Code", "Download diagram", "View fullscreen"])
    expect(screen.getByTitle<HTMLButtonElement>(title).disabled).toBe(true);
  expect(screen.getByTitle<HTMLButtonElement>("Zoom in").disabled).toBe(false);
  view.rerender(direct(undefined, { controls: false }));
  expect(screen.queryByTitle("View fullscreen")).toBeNull();
  expect(screen.queryByTitle("Zoom in")).toBeNull();
});

it("fences stale config/source rendering and preserves the previous SVG through incomplete parse errors", async () => {
  let finishA!: (value: { svg: string }) => void;
  let finishB!: (value: { svg: string }) => void;
  engine.render
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishA = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishB = resolve;
        }),
    );
  const dark = { theme: "dark" as const };
  const neutral = { theme: "neutral" as const };
  const view = render(direct("A", { mermaid: { config: dark } }));
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(1));
  view.rerender(direct("B", { mermaid: { config: neutral } }));
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(2));
  await act(async () => finishB({ svg: "<svg><text>Latest B</text></svg>" }));
  await act(async () => finishA({ svg: "<svg><text>Stale A</text></svg>" }));
  expect(screen.getByRole("img", { name: "Mermaid chart" }).textContent).toBe(
    "Latest B",
  );
  expect(engine.getMermaid).toHaveBeenNthCalledWith(1, dark);
  expect(engine.getMermaid).toHaveBeenNthCalledWith(2, neutral);
  engine.render.mockRejectedValueOnce(new Error("Partial source"));
  view.rerender(direct("B-->", { mermaid: { config: neutral } }, true));
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(3));
  expect(screen.getByRole("img", { name: "Mermaid chart" }).textContent).toBe(
    "Latest B",
  );
  expect(screen.queryByText(/Mermaid Error/)).toBeNull();
});

it("retains custom parse error/retry and ignores results after the renderer retires", async () => {
  engine.render.mockRejectedValueOnce(new Error("Parse failed"));
  const errorComponent = ({
    error,
    retry,
  }: {
    error: string;
    retry: () => void;
  }) => <button onClick={retry}>{error}: retry</button>;
  const view = render(direct("bad", { mermaid: { errorComponent } }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Parse failed: retry" }),
  );
  await screen.findByRole("img", { name: "Mermaid chart" });
  expect(engine.render).toHaveBeenCalledTimes(2);
  let finish!: (value: { svg: string }) => void;
  engine.render.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  view.rerender(direct("late"));
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(3));
  view.unmount();
  await act(async () => finish({ svg: "<svg><text>Retired</text></svg>" }));
  expect(screen.queryByText("Retired")).toBeNull();
});

it("keeps fullscreen focus and close controls available while its immediate drawing is pending", async () => {
  const view = render(direct());
  await screen.findByRole("img", { name: "Mermaid chart" });
  let finish!: (value: { svg: string }) => void;
  engine.render.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByTitle("View fullscreen"));
  const close = await screen.findByTitle("Exit fullscreen");
  await waitFor(() => expect(document.activeElement).toBe(close));
  fireEvent.keyDown(close, { key: "Tab" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByTitle("Exit fullscreen")).toBeNull(),
  );
  await act(async () =>
    finish({ svg: "<svg><text>Late fullscreen</text></svg>" }),
  );
  expect(screen.queryByText("Late fullscreen")).toBeNull();
  view.unmount();
  expect(document.body.style.pointerEvents).toBe("");
});

it("reuses directional Tab admission when a focused Retry retires and FocusScope returns to the container", async () => {
  const errorComponent = ({ retry }: { retry: () => void }) => (
    <button onClick={retry}>Retry fullscreen drawing</button>
  );
  render(direct("source", { mermaid: { errorComponent } }));
  await screen.findByRole("img", { name: "Mermaid chart" });
  engine.render.mockRejectedValueOnce(new Error("Fullscreen parse failed"));
  fireEvent.click(screen.getByTitle("View fullscreen"));
  const retry = await screen.findByRole("button", {
    name: "Retry fullscreen drawing",
  });
  const dialog = screen.getByRole<HTMLDivElement>("dialog", {
    name: "View fullscreen",
  });
  let finish!: (value: { svg: string }) => void;
  engine.render.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => retry.focus());
  fireEvent.click(retry);
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Retry fullscreen drawing" }),
    ).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(dialog));
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(screen.getByTitle("Exit fullscreen"));
  await act(async () =>
    finish({ svg: "<svg><text>Retried diagram</text></svg>" }),
  );
  await screen.findByText("Retried diagram");
  act(() => dialog.focus());
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(document.activeElement?.getAttribute("title")).toBe(
    "Reset zoom and pan",
  );
  act(() => dialog.focus());
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(document.activeElement).toBe(screen.getByTitle("Exit fullscreen"));
});

it("retains wheel/buttons/pointer zoom and restores all local listeners and body selection on unmount", async () => {
  const view = render(direct());
  const image = await screen.findByRole("img", { name: "Mermaid chart" });
  const application = image.parentElement!;
  const wrapper = application.parentElement!;
  fireEvent.click(screen.getByTitle("Zoom in"));
  expect(application.style.transform).toContain("scale(1.1)");
  const wheel = new WheelEvent("wheel", { deltaY: -10, cancelable: true });
  act(() => {
    wrapper.dispatchEvent(wheel);
  });
  expect(wheel.defaultPrevented).toBe(true);
  expect(application.style.transform).toContain("scale(1.2000000000000002)");
  for (const [deltaY, scale] of [
    [0, "1.3000000000000003"],
    [10, "1.2000000000000002"],
  ] as const) {
    const event = new WheelEvent("wheel", { deltaY, cancelable: true });
    act(() => {
      wrapper.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(application.style.transform).toContain(`scale(${scale})`);
  }
  application.setPointerCapture = rs.fn();
  application.hasPointerCapture = rs.fn(() => true);
  const release = rs.fn();
  application.releasePointerCapture = release;
  document.body.style.userSelect = "text";
  fireEvent.pointerDown(application, {
    button: 0,
    pointerId: 7,
    clientX: 10,
    clientY: 20,
    isPrimary: true,
  });
  fireEvent.pointerMove(application, {
    pointerId: 7,
    clientX: 30,
    clientY: 50,
  });
  expect(application.style.transform).toContain("translate(20px, 30px)");
  expect(document.body.style.userSelect).toBe("none");
  fireEvent.click(screen.getByTitle("Reset zoom and pan"));
  expect(application.style.transform).toBe("translate(0px, 0px) scale(1)");
  view.unmount();
  expect(document.body.style.userSelect).toBe("text");
  expect(release).toHaveBeenCalledWith(7);
  const retiredWheel = new WheelEvent("wheel", {
    deltaY: 10,
    cancelable: true,
  });
  wrapper.dispatchEvent(retiredWheel);
  expect(retiredWheel.defaultPrevented).toBe(false);
  document.body.style.userSelect = "";
});

it("downloads MMD/SVG/PNG with exact raw text, types, filenames and revoked object URLs", async () => {
  const createUrl = rs
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:diagram");
  const revoke = rs
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);
  const files: { name: string; blob: Blob }[] = [];
  rs.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    files.push({
      name: this.download,
      blob: createUrl.mock.calls.at(-1)![0] as Blob,
    });
  });
  rs.stubGlobal(
    "Image",
    class {
      width = 10;
      height = 5;
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        if (value) queueMicrotask(() => this.onload?.());
      }
    },
  );
  const draw = rs.fn();
  rs.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D);
  rs.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    expect(this.width).toBe(50);
    expect(this.height).toBe(25);
    expect(type).toBe("image/png");
    callback(new Blob(["png"], { type: "image/png" }));
  });
  render(direct("raw\nsource\n"));
  await screen.findByRole("img", { name: "Mermaid chart" });
  for (const format of ["MMD", "SVG", "PNG"]) {
    fireEvent.click(screen.getByTitle("Download diagram"));
    fireEvent.click(screen.getByTitle(`Download diagram as ${format}`));
    await waitFor(() =>
      expect(files).toHaveLength(["MMD", "SVG", "PNG"].indexOf(format) + 1),
    );
  }
  expect(files.map((file) => file.name)).toEqual([
    "diagram.mmd",
    "diagram.svg",
    "diagram.png",
  ]);
  expect(files.map((file) => file.blob.type)).toEqual([
    "text/plain",
    "image/svg+xml",
    "image/png",
  ]);
  expect(await files[0]!.blob.text()).toBe("raw\nsource\n");
  expect(await files[1]!.blob.text()).toBe(
    '<svg xmlns="http://www.w3.org/2000/svg"><text>Rendered diagram</text></svg>',
  );
  expect(draw).toHaveBeenCalledTimes(1);
  expect(engine.render).toHaveBeenCalledTimes(3); // Inline + fresh SVG + fresh PNG; MMD needs no render.
  expect(revoke).toHaveBeenCalledTimes(3);
});

it("cancels retired drawing downloads before creating any object URL", async () => {
  const createUrl = rs.spyOn(URL, "createObjectURL");
  const view = render(direct());
  await screen.findByRole("img", { name: "Mermaid chart" });
  let finish!: (value: { svg: string }) => void;
  engine.render.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByTitle("Download diagram"));
  fireEvent.click(screen.getByTitle("Download diagram as SVG"));
  view.unmount();
  await act(async () => finish({ svg: "<svg />" }));
  expect(createUrl).not.toHaveBeenCalled();
});

it("cancels viewport debounce on leave and disposal before rendering an offscreen chart", async () => {
  let notify!: IntersectionObserverCallback;
  let target!: Element;
  const disconnect = rs.fn();
  const observer = { disconnect, takeRecords: () => [] };
  rs.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe(element: Element) {
        target = element;
      }
      disconnect = disconnect;
      takeRecords() {
        return [];
      }
    },
  );
  const enter = (isIntersecting: boolean) =>
    act(() => {
      notify(
        [{ target, isIntersecting } as IntersectionObserverEntry],
        observer as unknown as IntersectionObserver,
      );
    });
  const view = render(direct());
  enter(true);
  enter(false);
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(engine.render).not.toHaveBeenCalled();
  enter(true);
  await screen.findByRole("img", { name: "Mermaid chart" });
  expect(engine.render).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalled();
  view.unmount();
  engine.render.mockClear();
  const retired = render(direct("retired"));
  enter(true);
  retired.unmount();
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(engine.render).not.toHaveBeenCalled();
});

it("shows the original fallback parse error and preserves a failed async download menu for retry", async () => {
  engine.getMermaid.mockImplementationOnce(() => {
    throw new Error("Initialize failed");
  });
  const view = render(direct("unparsed source"));
  await screen.findByText("Mermaid Error: Initialize failed");
  expect(screen.getByText("Show Code")).toBeTruthy();
  expect(screen.getByText("unparsed source")).toBeTruthy();
  view.rerender(direct("valid source"));
  await screen.findByRole("img", { name: "Mermaid chart" });
  engine.render.mockRejectedValueOnce(new Error("Download parse failed"));
  fireEvent.click(screen.getByTitle("Download diagram"));
  fireEvent.click(screen.getByTitle("Download diagram as SVG"));
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(2));
  expect(screen.getByTitle("Download diagram as SVG")).toBeTruthy();
  fireEvent.mouseDown(document.body);
  expect(screen.queryByTitle("Download diagram as SVG")).toBeNull();
});

it("gives fullscreen its own Escape layer and restores the original file trigger", async () => {
  render(
    <I18nProvider initialLocale="en-US">
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Artifacts</SheetTitle>
          <SheetDescription>Selected file.</SheetDescription>
          <Streamdown
            mode="static"
            plugins={streamdownRenderingPlugins}
            translations={enUS.markdown}
          >
            {"```mermaid\nflowchart TD\nA-->B\n```"}
          </Streamdown>
          <button>Copy file</button>
        </SheetContent>
      </Sheet>
    </I18nProvider>,
  );
  const trigger = await screen.findByTitle("View fullscreen");
  act(() => trigger.focus());
  fireEvent.click(trigger);
  await screen.findByTitle("Exit fullscreen");
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByTitle("Exit fullscreen")).toBeNull(),
  );
  expect(screen.getByRole("dialog", { name: "Artifacts" })).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  fireEvent.keyDown(trigger, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Artifacts" })).toBeNull(),
  );
});
