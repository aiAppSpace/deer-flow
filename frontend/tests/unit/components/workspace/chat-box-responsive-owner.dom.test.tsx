import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useEffect, useState, type ReactNode, type Ref } from "react";

import { ChatBox } from "@/components/workspace/chats/chat-box";
import { useMaybeMessageDetails } from "@/components/workspace/message-details/context";

const mocks = rs.hoisted(() => ({
  mobile: false,
  retainSheet: false,
  mounted: rs.fn(),
  unmounted: rs.fn(),
  artifacts: {
    artifacts: [],
    open: false,
    setOpen: rs.fn(),
    setArtifacts: rs.fn(),
    select: rs.fn(),
    deselect: rs.fn(),
    selectedArtifact: undefined,
  },
  panel: {
    current: {
      collapse: rs.fn(),
      resize: rs.fn(),
      getSize: () => ({ asPercentage: 0 }),
    },
  },
}));

rs.mock("next/navigation", () => ({
  usePathname: () => "/workspace/chats/thread-1",
}));
rs.mock("next/dynamic", () => ({ default: () => () => null }));
rs.mock("react-resizable-panels", () => ({
  usePanelRef: () => mocks.panel,
}));
rs.mock("@/components/workspace/artifacts/context", () => ({
  useArtifacts: () => mocks.artifacts,
}));
rs.mock("@/components/workspace/browser-view/context", () => ({
  useMaybeBrowserView: () => undefined,
}));
rs.mock("@/components/workspace/sidecar/context", () => ({
  useMaybeSidecar: () => undefined,
}));
rs.mock("@/components/workspace/messages/context", () => ({
  useThread: () => ({ thread: { values: {} } }),
}));
rs.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({ t: { common: { more: "More" } } }),
}));
rs.mock("@/env", () => ({
  env: { NEXT_PUBLIC_STATIC_WEBSITE_ONLY: "false" },
}));
rs.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.mobile }));
rs.mock("@/components/ui/resizable", () => {
  type Props = {
    children?: ReactNode;
    id?: string;
    className?: string;
    elementRef?: Ref<HTMLDivElement>;
  };
  const Panel = ({ children, id, className, elementRef }: Props) => (
    <div data-panel="" id={id} ref={elementRef}>
      <div className={className}>{children}</div>
    </div>
  );
  const Group = ({ children, id, className }: Props) => (
    <div id={id} className={className}>
      {children}
    </div>
  );
  return {
    ResizablePanel: Panel,
    ResizablePanelGroup: Group,
    ResizableHandle: () => null,
  };
});
rs.mock("@/components/ui/sheet", () => {
  const Wrapper = ({
    children,
    ref,
  }: {
    children?: ReactNode;
    ref?: Ref<HTMLDivElement>;
  }) => <div ref={ref}>{children}</div>;
  return {
    Sheet: ({
      children,
      open,
      onOpenChange,
    }: {
      children?: ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) =>
      open || mocks.retainSheet ? (
        <div role="dialog">
          {children}
          <button onClick={() => onOpenChange(false)}>Dismiss panel</button>
        </div>
      ) : null,
    SheetContent: Wrapper,
    SheetDescription: Wrapper,
    SheetHeader: Wrapper,
    SheetTitle: Wrapper,
  };
});

function ChatChild() {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const details = useMaybeMessageDetails();
  useEffect(() => {
    mocks.mounted();
    return () => mocks.unmounted();
  }, []);
  return (
    <>
      <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        Tool details
      </button>
      {expanded && (
        <section role="region" aria-label="Error">
          Preserved failure
        </section>
      )}
      <input
        aria-label="Draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        onClick={() =>
          details?.select({
            id: "detail-1",
            title: "Selected tool detail",
            content: "Detail content",
          })
        }
      >
        Inspect detail
      </button>
    </>
  );
}

beforeEach(() => {
  mocks.mobile = false;
  mocks.retainSheet = false;
  mocks.artifacts.open = false;
  mocks.mounted.mockClear();
  mocks.unmounted.mockClear();
});
afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
  rs.useRealTimers();
});

describe("ChatBox responsive owner", () => {
  it("preserves the same chat child, expanded failure and draft across both breakpoint transitions", () => {
    const tree = (
      <ChatBox threadId="thread-1">
        <ChatChild />
      </ChatBox>
    );
    const view = render(tree);
    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Draft",
    });
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Tool details" }));

    for (const mobile of [true, false]) {
      mocks.mobile = mobile;
      view.rerender(
        <ChatBox threadId="thread-1">
          <ChatChild />
        </ChatBox>,
      );
      expect(screen.getByRole("textbox", { name: "Draft" })).toBe(input);
      expect(input.value).toBe("Keep this draft");
      expect(
        screen
          .getByRole("button", { name: "Tool details" })
          .getAttribute("aria-expanded"),
      ).toBe("true");
      expect(screen.getByRole("region", { name: "Error" }).textContent).toBe(
        "Preserved failure",
      );
      expect(mocks.mounted).toHaveBeenCalledTimes(1);
      expect(mocks.unmounted).not.toHaveBeenCalled();
    }
  });

  it("keeps the selected detail title and closes the actual details owner from the mobile Sheet", () => {
    mocks.mobile = true;
    render(
      <ChatBox threadId="thread-1">
        <ChatChild />
      </ChatBox>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Inspect detail" }));
    expect(screen.getByRole("dialog").textContent).toContain(
      "Selected tool detail",
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss panel" }));
    expect(screen.queryByRole("dialog")).toBe(null);
  });
});

describe("ChatBox actual panel transition lifetime", () => {
  let frames: FrameRequestCallback[];
  let animations: Map<Element, Animation[]>;
  let observationCount: number;
  beforeEach(() => {
    frames = [];
    animations = new Map();
    observationCount = 0;
    rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    rs.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    // Deliberately invoke retired frames too: their owner must reject them.
    rs.stubGlobal("cancelAnimationFrame", rs.fn());
    rs.spyOn(HTMLElement.prototype, "getAnimations").mockImplementation(
      function (this: HTMLElement) {
        observationCount++;
        return animations.get(this) ?? [];
      },
    );
  });
  async function frame() {
    await act(async () => {
      frames.splice(0).forEach((callback) => callback(0));
      await Promise.resolve();
    });
  }
  function transition(target: HTMLElement, property = "flex-grow") {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const finished = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    // The old implementation does not observe cancellation; retain a handler
    // so a red assertion is not replaced by an unrelated unhandled rejection.
    void finished.catch(() => undefined);
    // The browser owns timing. Only its public animation observations are
    // supplied here; the real ChatBox owns presentation and retirement.
    const animation = {
      finished,
      playState: "running",
      pending: true,
      transitionProperty: property,
      effect: { target },
    } as unknown as Animation;
    animations.set(target, [animation]);
    return {
      animation,
      finish() {
        animations.set(
          target,
          (animations.get(target) ?? []).filter((item) => item !== animation),
        );
        resolve();
      },
      cancel() {
        animations.set(
          target,
          (animations.get(target) ?? []).filter((item) => item !== animation),
        );
        reject(new Error("cancelled"));
      },
    };
  }
  function mountPanel() {
    const view = render(
      <ChatBox threadId="thread-1">
        <ChatChild />
      </ChatBox>,
    );
    const aside = view.container.querySelector<HTMLElement>("#artifacts")!;
    const pane = aside.closest<HTMLElement>("[data-panel]")!;
    const content = aside.firstElementChild as HTMLElement;
    return {
      ...view,
      aside,
      pane,
      content,
      // Happy DOM has no layout engine or cqw support. Assert the real rendered
      // transition ownership here; the native sidecar suite measures width.
      animating: () =>
        view.container
          .querySelector('[id$="-group"]')!
          .classList.contains("*:data-panel:transition-[flex-grow]"),
      toggle(open: boolean) {
        mocks.artifacts.open = open;
        view.rerender(
          <ChatBox threadId="thread-1">
            <ChatChild />
          </ChatBox>,
        );
      },
    };
  }
  it("keeps the transition active after 280ms while the actual delayed pane transition is running", async () => {
    const view = mountPanel();
    const motion = transition(view.pane);
    view.toggle(true);
    expect(view.animating()).toBe(true);
    await frame();
    await act(() => rs.advanceTimersByTimeAsync(400));
    expect(view.animating()).toBe(true);
    await act(async () => motion.finish());
    await frame();
    expect(view.animating()).toBe(false);
  });
  it.each(["size", "opacity"])(
    "does not discard closing content when %s finishes before the other owned transition",
    async (first) => {
      const view = mountPanel();
      view.toggle(true);
      await frame();
      const sizing = transition(view.pane);
      const opacity = transition(view.aside, "opacity");
      view.toggle(false);
      await frame();
      await act(() => rs.advanceTimersByTimeAsync(400));
      expect(view.content.textContent).toContain("No artifact selected");
      await act(async () => (first === "size" ? sizing : opacity).finish());
      await frame();
      expect(view.content.textContent).toContain("No artifact selected");
      await act(async () => (first === "size" ? opacity : sizing).finish());
      await frame();
      expect(view.content.textContent).toBe("");
    },
  );
  it("settles a committed no-transition layout without waiting for a CSS-duration timer", async () => {
    const view = mountPanel();
    view.toggle(true);
    await frame();
    expect(view.animating()).toBe(false);
  });
  it("retires an old close completion when the same panel reopens", async () => {
    const view = mountPanel();
    view.toggle(true);
    await frame();
    const old = transition(view.pane);
    view.toggle(false);
    await frame();
    const current = transition(view.pane);
    view.toggle(true);
    await frame();
    await act(async () => old.finish());
    await frame();
    expect(view.animating()).toBe(true);
    expect(view.content.textContent).toContain("No artifact selected");
    await act(async () => current.finish());
    await frame();
    expect(view.animating()).toBe(false);
    expect(view.content.textContent).toContain("No artifact selected");
  });
  it("rechecks a replacement transition when the browser cancels an earlier one", async () => {
    const view = mountPanel();
    const old = transition(view.pane);
    view.toggle(true);
    await frame();
    const replacement = transition(view.pane);
    await act(async () => old.cancel());
    await frame();
    expect(view.animating()).toBe(true);
    await act(async () => replacement.finish());
    await frame();
    expect(view.animating()).toBe(false);
  });
  it("retains mobile content for the Sheet's own exit and ignores that exit after a desktop reopen", async () => {
    mocks.mobile = true;
    mocks.retainSheet = true;
    const view = mountPanel();
    view.toggle(true);
    const mobileContent = screen.getByRole("heading", {
      name: "No artifact selected",
    });
    const sheet = mobileContent.closest('[role="dialog"]')!
      .firstElementChild as HTMLElement;
    const exit = transition(sheet, "opacity");
    Object.assign(exit.animation, {
      transitionProperty: undefined,
      animationName: "exit",
    });
    view.toggle(false);
    await frame();
    await act(() => rs.advanceTimersByTimeAsync(400));
    expect(mobileContent.isConnected).toBe(true);
    mocks.mobile = false;
    const opening = transition(view.pane);
    view.toggle(true);
    await frame();
    await act(async () => exit.finish());
    await frame();
    expect(view.animating()).toBe(true);
    expect(view.content.textContent).toContain("No artifact selected");
    await act(async () => opening.finish());
    await frame();
    expect(view.animating()).toBe(false);
  });
  it("clears mobile content after its own exit finishes", async () => {
    mocks.mobile = true;
    mocks.retainSheet = true;
    const view = mountPanel();
    view.toggle(true);
    const content = screen.getByRole("heading", {
      name: "No artifact selected",
    });
    const sheet = content.closest('[role="dialog"]')!
      .firstElementChild as HTMLElement;
    const exit = transition(sheet, "opacity");
    Object.assign(exit.animation, {
      transitionProperty: undefined,
      animationName: "exit",
    });
    view.toggle(false);
    await frame();
    expect(content.isConnected).toBe(true);
    await act(async () => exit.finish());
    await frame();
    expect(content.isConnected).toBe(false);
  });
  it("does not wait for unrelated host properties or descendant animations", async () => {
    const view = mountPanel();
    transition(view.pane, "color");
    const spinner = transition(view.content, "opacity");
    // Include a descendant even if a browser observation contains one.
    animations.get(view.pane)!.push(spinner.animation);
    view.toggle(true);
    await frame();
    expect(view.animating()).toBe(false);
  });
  it("retains presentation while an owned animation is paused", async () => {
    const view = mountPanel();
    const motion = transition(view.pane);
    Object.assign(motion.animation, { playState: "paused", pending: false });
    view.toggle(true);
    await frame();
    expect(view.animating()).toBe(true);
    await act(async () => motion.finish());
    await frame();
    expect(view.animating()).toBe(false);
  });
  it("retires pending animation completions and queued frames on unmount", async () => {
    const view = mountPanel();
    const motion = transition(view.pane);
    view.toggle(true);
    await frame();
    view.unmount();
    const observations = observationCount;
    await act(async () => motion.finish());
    await frame();
    expect(observationCount).toBe(observations);
    expect(frames).toHaveLength(0);
  });
});
