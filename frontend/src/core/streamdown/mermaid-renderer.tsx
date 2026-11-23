"use client";

/*
 * Toolbar shapes and presentation adapted from Streamdown 2.5.
 * Copyright 2023 Vercel, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at https://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. Fullscreen and async owners are adapted here.
 */

import * as Dialog from "@radix-ui/react-dialog";
import { mermaid, type MermaidConfig } from "@streamdown/mermaid";
import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CodeBlockCopyButton,
  StreamdownContext,
  type CustomRendererProps,
} from "streamdown";

import { enterDialogContent } from "@/components/ui/dialog";
import { useI18n } from "@/core/i18n/hooks";
import { StreamdownControlIcon as Icon } from "@/core/streamdown/control-icon";
import { serializeMermaidSvg } from "@/core/streamdown/mermaid-export";
import { cn } from "@/lib/utils";

// Streamdown 2.5's toolbar shapes and classes are retained; only fullscreen's
// portal/focus/Escape lifecycle belongs to Radix rather than a document listener.

const actionClass =
  "cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
const zoomClass =
  "flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

function ZoomPan({
  children,
  fullscreen,
  controls,
}: {
  children: ReactNode;
  fullscreen: boolean;
  controls: boolean;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    origin: typeof offset;
    id: number;
  } | null>(null);
  const changeZoom = (step: number) =>
    setZoom((value) => Math.min(3, Math.max(0.5, value + step)));
  useEffect(() => {
    const element = wrapper.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      changeZoom(event.deltaY > 0 ? -0.1 : 0.1);
    };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => element?.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    if (!drag) return;
    const element = content.current;
    const body = element?.ownerDocument.body;
    const before = body?.style.userSelect ?? "";
    if (body) body.style.userSelect = "none";
    const move = (event: PointerEvent) => {
      if (event.pointerId !== drag.id) return;
      event.preventDefault();
      setOffset({
        x: drag.origin.x + event.clientX - drag.x,
        y: drag.origin.y + event.clientY - drag.y,
      });
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId !== drag.id) return;
      if (element?.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
      setDrag(null);
    };
    element?.addEventListener("pointermove", move, { passive: false });
    element?.addEventListener("pointerup", end);
    element?.addEventListener("pointercancel", end);
    return () => {
      element?.removeEventListener("pointermove", move);
      element?.removeEventListener("pointerup", end);
      element?.removeEventListener("pointercancel", end);
      if (element?.hasPointerCapture(drag.id))
        element.releasePointerCapture(drag.id);
      if (body) body.style.userSelect = before;
    };
  }, [drag]);
  return (
    <div
      ref={wrapper}
      className={cn(
        "relative flex flex-col",
        fullscreen ? "h-full w-full" : "min-h-28 w-full",
        "overflow-hidden",
        fullscreen && "size-full [&_svg]:h-auto [&_svg]:w-auto",
      )}
      style={{ cursor: drag ? "grabbing" : "grab" }}
    >
      {controls && (
        <div
          className={cn(
            "border-border bg-background/80 supports-[backdrop-filter]:bg-background/70 absolute z-10 flex flex-col gap-1 rounded-md border p-1 supports-[backdrop-filter]:backdrop-blur-sm",
            fullscreen ? "bottom-4 left-4" : "bottom-2 left-2",
          )}
        >
          <button
            className={cn(
              zoomClass,
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={zoom >= 3}
            onClick={() => changeZoom(0.1)}
            title="Zoom in"
            type="button"
          >
            <Icon name="plus" />
          </button>
          <button
            className={cn(
              zoomClass,
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={zoom <= 0.5}
            onClick={() => changeZoom(-0.1)}
            title="Zoom out"
            type="button"
          >
            <Icon name="minus" />
          </button>
          <button
            className={zoomClass}
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            title="Reset zoom and pan"
            type="button"
          >
            <Icon name="reset" />
          </button>
        </div>
      )}
      <div
        ref={content}
        role="application"
        className={cn(
          "flex-1 origin-center transition-transform duration-150 ease-out",
          fullscreen
            ? "flex h-full w-full items-center justify-center"
            : "flex w-full items-center justify-center",
        )}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          touchAction: "none",
          willChange: "transform",
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || event.isPrimary === false) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({
            x: event.clientX,
            y: event.clientY,
            origin: offset,
            id: event.pointerId,
          });
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Chart({
  code,
  config,
  fullscreen = false,
  controls,
}: {
  code: string;
  config?: MermaidConfig;
  fullscreen?: boolean;
  controls: boolean;
}) {
  const { mermaid: options } = useContext(StreamdownContext);
  const root = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^\w-]/g, "");
  const generation = useRef(0);
  const [visible, setVisible] = useState(fullscreen);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (visible) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    let disposed = false;
    const cancel = () => {
      clearTimeout(timer);
      if (idle !== undefined) {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
        else clearTimeout(idle);
      }
    };
    const ready = () => {
      if (disposed) return;
      setVisible(true);
      observer.disconnect();
    };
    const request = () => {
      if (disposed) return;
      if (typeof requestIdleCallback === "function")
        idle = requestIdleCallback(
          (deadline) => {
            if (deadline.timeRemaining() > 0 || deadline.didTimeout) ready();
            else idle = requestIdleCallback(ready, { timeout: 250 });
          },
          { timeout: 500 },
        );
      else timer = setTimeout(ready, 1);
    };
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (disposed) return;
        for (const entry of entries) {
          cancel();
          if (entry.isIntersecting)
            timer = setTimeout(() => {
              const records = observer.takeRecords();
              if (records.length === 0 || records.at(-1)?.isIntersecting)
                request();
            }, 300);
        }
      },
      { rootMargin: "300px", threshold: 0 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      disposed = true;
      observer.disconnect();
      cancel();
    };
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let current = true;
    setError(null);
    void Promise.resolve()
      .then(() =>
        mermaid
          .getMermaid(config)
          .render(`mermaid-${id}-${++generation.current}`, code),
      )
      .then((result) => {
        if (current) setSvg(result.svg);
      })
      .catch((reason: unknown) => {
        if (current)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      current = false;
    };
  }, [code, config, id, retry, visible]);
  if (!visible) return <div ref={root} className="my-4 min-h-[200px]" />;
  if (!svg && error) {
    const ErrorComponent = options?.errorComponent;
    return (
      <div ref={root}>
        {ErrorComponent ? (
          <ErrorComponent
            chart={code}
            error={error}
            retry={() => setRetry((value) => value + 1)}
          />
        ) : (
          <div className="rounded-md bg-red-50 p-4">
            <p className="font-mono text-sm text-red-700">
              Mermaid Error: {error}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-600">
                Show Code
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-2 text-xs text-red-800">
                {code}
              </pre>
            </details>
          </div>
        )}
      </div>
    );
  }
  if (!svg)
    return (
      <div ref={root} className="my-4 flex justify-center p-4">
        <div className="text-muted-foreground flex items-center space-x-2">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
          <span className="text-sm">Loading diagram...</span>
        </div>
      </div>
    );
  return (
    <div
      ref={root}
      className={cn("size-full", fullscreen && "[&_svg]:h-auto [&_svg]:w-auto")}
      data-streamdown="mermaid"
    >
      <ZoomPan fullscreen={fullscreen} controls={controls}>
        <div
          role="img"
          aria-label="Mermaid chart"
          className={cn(
            "flex justify-center",
            fullscreen && "size-full items-center",
          )}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </ZoomPan>
    </div>
  );
}

function saveFile(data: string | Blob, type: string, filename: string) {
  const url = URL.createObjectURL(
    typeof data === "string" ? new Blob([data], { type }) : data,
  );
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

function asPng(svg: string, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: Error, blob?: Blob) => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else if (blob) resolve(blob);
    };
    const abort = () => {
      image.src = "";
      finish(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (signal.aborted) {
        abort();
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.width * 5;
        canvas.height = image.height * 5;
        const context = canvas.getContext("2d");
        if (!context) {
          finish(new Error("Canvas context unavailable"));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (signal.aborted) abort();
          else
            finish(
              blob ? undefined : new Error("PNG conversion failed"),
              blob ?? undefined,
            );
        }, "image/png");
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    };
    image.onerror = () => finish(new Error("SVG image failed to load"));
    if (signal.aborted) {
      abort();
      return;
    }
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  });
}

function Download({
  code,
  config,
  disabled,
}: {
  code: string;
  config?: MermaidConfig;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const lifetime = useRef<AbortController | null>(null);
  const id = useId().replace(/[^\w-]/g, "");
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, [code, config]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (root.current && !event.composedPath().includes(root.current))
        setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  const download = async (format: "svg" | "png" | "mmd") => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    try {
      if (format === "mmd") {
        saveFile(code, "text/plain", "diagram.mmd");
        setOpen(false);
        return;
      }
      const { svg } = await mermaid
        .getMermaid(config)
        .render(`mermaid-download-${id}-${++generation.current}`, code);
      if (signal.aborted || !svg) return;
      const serialized = serializeMermaidSvg(svg);
      const data =
        format === "svg" ? serialized : await asPng(serialized, signal);
      if (!signal.aborted) {
        saveFile(
          data,
          `image/${format === "svg" ? "svg+xml" : "png"}`,
          `diagram.${format}`,
        );
        setOpen(false);
      }
    } catch {
      /* Same optional download failure behavior as Streamdown's toolbar. */
    }
  };
  return (
    <div ref={root} className="relative">
      <button
        className={actionClass}
        disabled={disabled}
        title={t.markdown.downloadDiagram}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="download" size={14} />
      </button>
      {open && (
        <div className="bg-background border-border absolute top-full right-0 z-10 mt-1 min-w-[120px] overflow-hidden rounded-md border shadow-lg">
          {(["svg", "png", "mmd"] as const).map((format) => (
            <button
              key={format}
              className="hover:bg-muted/40 w-full px-3 py-2 text-left text-sm transition-colors"
              title={
                t.markdown[
                  format === "svg"
                    ? "downloadDiagramAsSvg"
                    : format === "png"
                      ? "downloadDiagramAsPng"
                      : "downloadDiagramAsMmd"
                ]
              }
              type="button"
              onClick={() => void download(format)}
            >
              {
                t.markdown[
                  format === "svg"
                    ? "mermaidFormatSvg"
                    : format === "png"
                      ? "mermaidFormatPng"
                      : "mermaidFormatMmd"
                ]
              }
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MermaidRenderer({ code }: CustomRendererProps) {
  const { t } = useI18n();
  const {
    controls,
    isAnimating,
    mermaid: options,
  } = useContext(StreamdownContext);
  const [open, setOpen] = useState(false);
  const enabled = (
    control?: "download" | "copy" | "fullscreen" | "panZoom",
  ) => {
    if (typeof controls === "boolean") return controls;
    const settings = controls?.mermaid;
    if (settings === false) return false;
    return (
      typeof settings !== "object" || !control || settings[control] !== false
    );
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div
        className="group border-border bg-sidebar relative my-4 flex w-full flex-col gap-2 rounded-xl border p-2"
        data-streamdown="mermaid-block"
      >
        <div className="text-muted-foreground flex h-8 items-center text-xs">
          <span className="ml-1 font-mono lowercase">mermaid</span>
        </div>
        {enabled() &&
          (enabled("download") || enabled("copy") || enabled("fullscreen")) && (
            <div className="pointer-events-none sticky top-2 z-10 -mt-10 flex h-8 items-center justify-end">
              <div
                className="border-sidebar bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/70 pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border px-1.5 py-1 supports-[backdrop-filter]:backdrop-blur"
                data-streamdown="mermaid-block-actions"
              >
                {enabled("download") && (
                  <Download
                    code={code}
                    config={options?.config}
                    disabled={isAnimating}
                  />
                )}
                {enabled("copy") && (
                  <CodeBlockCopyButton code={code} disabled={isAnimating} />
                )}
                {enabled("fullscreen") && (
                  <Dialog.Trigger asChild>
                    <button
                      className={actionClass}
                      disabled={isAnimating}
                      title={t.markdown.viewFullscreen}
                      type="button"
                    >
                      <Icon name="fullscreen" size={14} />
                    </button>
                  </Dialog.Trigger>
                )}
              </div>
            </div>
          )}
        <div className="border-border bg-background rounded-md border">
          <Chart
            code={code}
            config={options?.config}
            controls={enabled("panZoom")}
          />
        </div>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" />
        <Dialog.Content
          className="bg-background/95 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          onKeyDown={enterDialogContent}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <Dialog.Title className="sr-only">
            {t.markdown.viewFullscreen}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Mermaid chart
          </Dialog.Description>
          <Dialog.Close asChild>
            <button
              className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 z-10 rounded-md p-2 transition-all"
              title={t.markdown.exitFullscreen}
              type="button"
            >
              <Icon name="close" size={20} />
            </button>
          </Dialog.Close>
          <div
            className="flex size-full items-center justify-center p-4"
            role="presentation"
            onClick={(event) => event.stopPropagation()}
          >
            <Chart
              code={code}
              config={options?.config}
              controls={enabled("panZoom")}
              fullscreen
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
