import { FilesIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Layout,
  type PanelSize,
  usePanelRef,
} from "react-resizable-panels";

import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { env } from "@/env";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { useArtifacts } from "../artifacts/context";
import { useMaybeBrowserView } from "../browser-view/context";
import { useThread } from "../messages/context";
import { useMaybeSidecar } from "../sidecar/context";

function RightPanelLoading() {
  return (
    <div className="grid size-full place-items-center">
      <p role="status" className="text-muted-foreground text-sm">
        Loading panel…
      </p>
    </div>
  );
}

const ArtifactFileDetail = dynamic(
  () =>
    import("../artifacts/artifact-file-detail").then(
      (module) => module.ArtifactFileDetail,
    ),
  { loading: RightPanelLoading },
);
const ArtifactFileList = dynamic(
  () =>
    import("../artifacts/artifact-file-list").then(
      (module) => module.ArtifactFileList,
    ),
  { loading: RightPanelLoading },
);
const BrowserViewPanel = dynamic(
  () =>
    import("../browser-view/browser-view-panel").then(
      (module) => module.BrowserViewPanel,
    ),
  { loading: RightPanelLoading },
);
const SidecarPanel = dynamic(
  () =>
    import("../sidecar/sidecar-panel").then((module) => module.SidecarPanel),
  { loading: RightPanelLoading },
);

const RIGHT_PANEL_ANIMATION_MS = 280;
const RIGHT_PANEL_DEFAULT_SIZE = "40%";

type RightPanelKind = "sidecar" | "artifacts" | "browser";

const ChatBox: React.FC<{
  children: React.ReactNode;
  threadId: string;
  browserEnabled?: boolean;
}> = ({ children, threadId, browserEnabled = true }) => {
  const { thread } = useThread();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const threadIdRef = useRef(threadId);
  const chatRegionRef = useRef<HTMLDivElement | null>(null);
  const rightPanelContainerRef = useRef<HTMLElement | null>(null);

  const {
    artifacts,
    open: artifactsOpen,
    setOpen: setArtifactsOpen,
    setArtifacts,
    select: selectArtifact,
    deselect,
    selectedArtifact,
  } = useArtifacts();
  const sidecar = useMaybeSidecar();
  const sidecarOpen = sidecar?.open ?? false;
  const browserView = useMaybeBrowserView();
  const browserViewOpen = browserEnabled && (browserView?.open ?? false);

  const [autoSelectFirstArtifact, setAutoSelectFirstArtifact] = useState(true);
  useEffect(() => {
    const threadArtifacts = Array.isArray(thread.values.artifacts)
      ? thread.values.artifacts
      : undefined;

    if (threadIdRef.current !== threadId) {
      threadIdRef.current = threadId;
      deselect();
    }

    // Update artifacts from the current thread
    // An empty initial state must not erase artifacts restored by the provider
    // before the persisted thread state has arrived.
    if (threadArtifacts && threadArtifacts.length > 0) {
      setArtifacts(threadArtifacts);
    }

    // DO NOT automatically deselect the artifact when switching threads, because the artifacts auto discovering is not work now.
    // if (
    //   selectedArtifact &&
    //   !thread.values.artifacts?.includes(selectedArtifact)
    // ) {
    //   deselect();
    // }

    if (
      env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true" &&
      autoSelectFirstArtifact
    ) {
      if (threadArtifacts && threadArtifacts.length > 0) {
        setAutoSelectFirstArtifact(false);
        selectArtifact(threadArtifacts[0]!);
      }
    }
  }, [
    threadId,
    autoSelectFirstArtifact,
    deselect,
    selectArtifact,
    selectedArtifact,
    setArtifacts,
    thread.values.artifacts,
  ]);

  const artifactPanelOpen = useMemo(() => {
    if (sidecarOpen) {
      return false;
    }
    if (env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true") {
      return artifactsOpen && artifacts?.length > 0;
    }
    return artifactsOpen;
  }, [artifactsOpen, artifacts, sidecarOpen]);

  const activeRightPanel: RightPanelKind | null = sidecarOpen
    ? "sidecar"
    : browserViewOpen
      ? "browser"
      : artifactPanelOpen
        ? "artifacts"
        : null;
  const rightPanelOpen = activeRightPanel !== null;
  const [renderedRightPanel, setRenderedRightPanel] =
    useState<RightPanelKind | null>(activeRightPanel);
  const [rightPanelHiddenFromA11y, setRightPanelHiddenFromA11y] = useState(
    () => !rightPanelOpen,
  );

  const resizableIdBase = useMemo(() => {
    return pathname.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  }, [pathname]);

  const sidePanelRef = usePanelRef();
  // Width the panel reopens at: the last size the user dragged it to.
  const openSizeRef = useRef(RIGHT_PANEL_DEFAULT_SIZE);
  // While the panel width animates, the content is held at its final width and
  // clipped instead of reflowing every frame — a reflowing message list keeps
  // re-running its scroll-to-bottom (pinned by the sidecar scroll regression
  // test), and re-wrapping text mid-animation looks unsettled. Expressed in
  // `cqw` against the group so it tracks the final width even if the group
  // itself resizes during the animation.
  const [pinnedContentWidth, setPinnedContentWidth] = useState<string | null>(
    null,
  );
  // Size transitions belong to open/close only: leaving them on during a drag
  // would interpolate every pointer frame and make the handle feel laggy.
  const [animatingRightPanel, setAnimatingRightPanel] = useState(false);
  const rightPanelOpenRef = useRef(rightPanelOpen);
  const isMobileRef = useRef(isMobile);
  // Read once: `defaultSize` only applies on mount, the effect below owns every
  // later open/close.
  const [initialRightPanelSize] = useState(() =>
    rightPanelOpen ? RIGHT_PANEL_DEFAULT_SIZE : "0%",
  );

  const handleSidePanelResize = useCallback((size: PanelSize) => {
    if (!rightPanelOpenRef.current || size.asPercentage <= 0) {
      return;
    }
    openSizeRef.current = `${size.asPercentage}%`;
  }, []);

  const handlePanelGroupLayoutChanged = useCallback(
    (layout: Layout) => {
      if (
        isMobile ||
        !rightPanelOpenRef.current ||
        layout[`${resizableIdBase}-side`] !== 0
      ) {
        return;
      }

      // Finalize a drag-collapse only after the pointer is released. Closing
      // from onResize at the first 0% frame would break a continuous gesture
      // that reaches the edge and then reverses before release.
      if (activeRightPanel === "sidecar") {
        sidecar?.close();
      } else if (activeRightPanel === "browser") {
        browserView?.close();
      } else if (activeRightPanel === "artifacts") {
        setArtifactsOpen(false);
      }
    },
    [
      activeRightPanel,
      browserView,
      isMobile,
      resizableIdBase,
      setArtifactsOpen,
      sidecar,
    ],
  );

  useEffect(() => {
    const openStateChanged = rightPanelOpenRef.current !== rightPanelOpen;
    const viewportModeChanged = isMobileRef.current !== isMobile;
    if (!openStateChanged && !viewportModeChanged) {
      return;
    }
    rightPanelOpenRef.current = rightPanelOpen;
    isMobileRef.current = isMobile;

    // Mobile renders the same panel contents in a Sheet. Keep the desktop
    // resizable panel mounted so open portals and composer state survive the
    // breakpoint, but give it no layout share; `display: none` on the panel's
    // inner wrapper cannot override the library's sized outer `[data-panel]`.
    if (isMobile) {
      setAnimatingRightPanel(false);
      setPinnedContentWidth(null);
      sidePanelRef.current?.collapse();
      return;
    }

    setAnimatingRightPanel(true);
    if (!rightPanelOpen) {
      // Remember the width now: the closing animation reports shrinking sizes,
      // so sampling those would reopen the panel a few pixels wide.
      const size = sidePanelRef.current?.getSize().asPercentage ?? 0;
      if (size > 0) {
        openSizeRef.current = `${size}%`;
      }
    }

    const openPercentage = Number.parseFloat(openSizeRef.current);
    setPinnedContentWidth(
      Number.isFinite(openPercentage) ? `${openPercentage}cqw` : null,
    );

    // resize() rather than expand(): the library expands to `minSize` until it
    // has recorded a size of its own, which would reopen narrower than before.
    if (rightPanelOpen) {
      sidePanelRef.current?.resize(openSizeRef.current);
    } else {
      sidePanelRef.current?.collapse();
    }

    const timeout = window.setTimeout(() => {
      setAnimatingRightPanel(false);
      setPinnedContentWidth(null);
    }, RIGHT_PANEL_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isMobile, rightPanelOpen, sidePanelRef]);

  useEffect(() => {
    if (activeRightPanel) {
      setRenderedRightPanel(activeRightPanel);
      return;
    }

    const timeout = window.setTimeout(() => {
      setRenderedRightPanel(null);
    }, RIGHT_PANEL_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeRightPanel]);

  useLayoutEffect(() => {
    if (rightPanelOpen) {
      setRightPanelHiddenFromA11y(false);
      return;
    }

    const activeElement = document.activeElement;
    const rightPanelContainer = rightPanelContainerRef.current;
    if (
      activeElement instanceof HTMLElement &&
      rightPanelContainer?.contains(activeElement)
    ) {
      chatRegionRef.current?.focus({ preventScroll: true });
      if (document.activeElement === activeElement) {
        activeElement.blur();
      }
    }

    setRightPanelHiddenFromA11y(true);
  }, [rightPanelOpen]);

  useEffect(() => {
    if (sidecarOpen && artifactsOpen) {
      setArtifactsOpen(false);
    }
  }, [artifactsOpen, setArtifactsOpen, sidecarOpen]);

  useEffect(() => {
    if (!browserEnabled && browserView?.open) {
      browserView.close();
    }
  }, [browserEnabled, browserView]);

  const rightPanelContent = useMemo(() => {
    if (renderedRightPanel === "browser") {
      return <BrowserViewPanel threadId={threadId} className="size-full" />;
    }
    if (renderedRightPanel === "sidecar") {
      return <SidecarPanel />;
    }
    if (renderedRightPanel === "artifacts" && selectedArtifact) {
      return (
        <ArtifactFileDetail
          className="size-full"
          filepath={selectedArtifact}
          threadId={threadId}
        />
      );
    }
    if (renderedRightPanel === "artifacts") {
      return (
        <div className="relative flex size-full justify-center">
          <div className="absolute top-1 right-1 z-30">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setArtifactsOpen(false);
              }}
            >
              <XIcon />
            </Button>
          </div>
          {artifacts.length === 0 ? (
            <ConversationEmptyState
              icon={<FilesIcon />}
              title="No artifact selected"
              description="Select an artifact to view its details"
            />
          ) : (
            <div className="flex size-full max-w-(--container-width-sm) flex-col justify-center p-4 pt-8">
              <header className="shrink-0">
                <h2 className="text-lg font-medium">Artifacts</h2>
              </header>
              <main className="min-h-0 grow">
                <ArtifactFileList
                  className="max-w-(--container-width-sm) p-4 pt-12"
                  files={artifacts}
                  threadId={threadId}
                />
              </main>
            </div>
          )}
        </div>
      );
    }
    return null;
  }, [
    renderedRightPanel,
    selectedArtifact,
    threadId,
    artifacts,
    setArtifactsOpen,
  ]);

  return (
    <>
      {/* Keep the chat subtree under one stable owner across the md breakpoint.
          Replacing this whole tree used to unmount every open composer/sheet
          portal during a resize, losing Model Selector, Background Tasks and
          Workspace Changes even though none of those controls had closed. */}
      <ResizablePanelGroup
        id={`${resizableIdBase}-group`}
        orientation="horizontal"
        onLayoutChanged={handlePanelGroupLayoutChanged}
        className={cn(
          "@container size-full min-h-0",
          // The sized flex item is the library's own `[data-panel]` element, not
          // the child `className` lands on, so the open/close transition has to be
          // addressed from here.
          animatingRightPanel &&
            "*:data-panel:transition-[flex-grow] *:data-panel:duration-280 *:data-panel:ease-out motion-reduce:*:data-panel:transition-none",
        )}
      >
        <ResizablePanel
          id={`${resizableIdBase}-chat`}
          minSize="30%"
          className="relative min-h-0 min-w-0"
        >
          <div
            ref={chatRegionRef}
            className="relative size-full min-h-0 min-w-0"
            id="chat"
            tabIndex={-1}
          >
            {children}
          </div>
        </ResizablePanel>
        <ResizableHandle
          id={`${resizableIdBase}-separator`}
          withHandle
          disabled={!rightPanelOpen}
          className={cn(
            "hidden opacity-33 transition-opacity duration-200 ease-out hover:opacity-100 motion-reduce:transition-none md:flex",
            !rightPanelOpen && "pointer-events-none opacity-0",
          )}
        />
        <ResizablePanel
          id={`${resizableIdBase}-side`}
          panelRef={sidePanelRef}
          collapsible
          collapsedSize="0%"
          defaultSize={initialRightPanelSize}
          minSize="20%"
          onResize={handleSidePanelResize}
          className="hidden min-h-0 min-w-0 md:block"
        >
          <aside
            ref={rightPanelContainerRef}
            aria-hidden={rightPanelHiddenFromA11y}
            className={cn(
              "size-full min-h-0 min-w-0 overflow-hidden transition-opacity duration-280 ease-out motion-reduce:transition-none",
              rightPanelOpen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            id="artifacts"
          >
            <div
              className={cn(
                "ml-auto h-full",
                renderedRightPanel === "artifacts" ? "p-4" : "p-0",
              )}
              style={
                pinnedContentWidth === null
                  ? undefined
                  : { width: pinnedContentWidth }
              }
            >
              {isMobile ? null : rightPanelContent}
            </div>
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
      <Sheet
        open={isMobile && rightPanelOpen}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          if (sidecarOpen) {
            sidecar?.close();
          }
          if (browserViewOpen) {
            browserView?.close();
          }
          if (artifactsOpen) {
            setArtifactsOpen(false);
          }
        }}
      >
        <SheetContent
          className="w-[calc(100vw-1rem)] max-w-none gap-0 p-0 sm:max-w-md [&>button]:hidden"
          side="right"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              {renderedRightPanel === "sidecar"
                ? "Sidecar"
                : renderedRightPanel === "browser"
                  ? "Browser"
                  : "Artifacts"}
            </SheetTitle>
            <SheetDescription>
              Browse the side panel for this conversation.
            </SheetDescription>
          </SheetHeader>
          {/* This wrapper owns mobile scrolling for every right-panel kind.
              At narrow width + low height + 200% text, sidecar and browser
              content exceed the Sheet; without this route their lower controls
              are rendered but unreachable. */}
          <div
            className="min-h-0 flex-1 overflow-y-auto p-3 pt-10"
            onFocusCapture={(event) =>
              event.target.scrollIntoView({ block: "nearest" })
            }
          >
            {isMobile ? rightPanelContent : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export { ChatBox };
