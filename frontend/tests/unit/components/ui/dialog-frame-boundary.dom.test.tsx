import * as DialogPrimitive from "@radix-ui/react-dialog";
import { afterEach, describe, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDialogContentRef } from "@/components/ui/dialog-focus-boundary";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
});

const guards = () =>
  document.querySelectorAll<HTMLElement>("[data-dialog-focus-guard]");

function contents(frame: boolean) {
  return (
    <>
      <button>First action</button>
      <button disabled>Disabled action</button>
      <button style={{ display: "none" }}>Hidden action</button>
      {frame && <iframe title="Report" srcDoc="<p>Report</p>" />}
      <button>Last action</button>
    </>
  );
}

function mountPanel(kind: "dialog" | "sheet", frame = true) {
  return render(
    kind === "dialog" ? (
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>Artifact content.</DialogDescription>
          {contents(frame)}
        </DialogContent>
      </Dialog>
    ) : (
      <Sheet defaultOpen>
        <SheetContent className="frame-sheet">
          <SheetTitle>Report</SheetTitle>
          <SheetDescription>Artifact content.</SheetDescription>
          {contents(frame)}
        </SheetContent>
      </Sheet>
    ),
  );
}

describe("Dialog and Sheet embedded browsing context boundaries", () => {
  it.each(["dialog", "sheet"] as const)(
    "keeps %s boundaries inside the actual content and retires them on unmount",
    async (kind) => {
      const mounted = mountPanel(kind);
      await waitFor(() => expect(guards()).toHaveLength(2));
      const host = screen.getByRole("dialog");
      expect(host.firstChild).toBe(guards()[0]);
      expect(host.lastChild).toBe(guards()[1]);
      expect(document.body.firstChild).not.toBe(guards()[0]);
      mounted.unmount();
      expect(guards()).toHaveLength(0);
    },
  );

  it.each(["dialog", "sheet"] as const)(
    "keeps %s without an iframe on the installed focus path",
    (kind) => {
      mountPanel(kind, false);
      expect(guards()).toHaveLength(0);
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "First action" }),
      );
    },
  );

  it("follows dynamic iframe presence without leaving stale focus targets", async () => {
    function Dynamic() {
      const [frame, setFrame] = useState(false);
      return (
        <Dialog defaultOpen>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Dynamic report</DialogTitle>
            <DialogDescription>Artifact content.</DialogDescription>
            <button onClick={() => setFrame((value) => !value)}>
              Toggle preview
            </button>
            {contents(frame)}
          </DialogContent>
        </Dialog>
      );
    }
    render(<Dynamic />);
    expect(guards()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Toggle preview" }));
    await waitFor(() => expect(guards()).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Toggle preview" }));
    await waitFor(() => expect(guards()).toHaveLength(0));
  });

  it.each([false, true])(
    "wraps to actual content instead of retaining a sentinel, end=%s",
    async (end) => {
      mountPanel("dialog");
      await waitFor(() => expect(guards()).toHaveLength(2));
      act(() => guards()[end ? 1 : 0]!.focus());
      expect(document.activeElement).toBe(
        screen.getByRole("button", {
          name: end ? "First action" : "Last action",
        }),
      );
    },
  );

  it("keeps the caller's prevented autofocus and Tab", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          onKeyDown={(event) => event.preventDefault()}
        >
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>Artifact content.</DialogDescription>
          {contents(true)}
        </DialogContent>
      </Dialog>,
    );
    const host = screen.getByRole("dialog");
    await waitFor(() => expect(guards()).toHaveLength(2));
    act(() => host.focus());
    for (const shiftKey of [false, true]) {
      fireEvent.keyDown(host, { key: "Tab", shiftKey });
      expect(document.activeElement).toBe(host);
    }
  });

  it("forwards object refs to the actual host and clears them at retirement", () => {
    const ref = createRef<HTMLDivElement>();
    const mounted = render(
      <Dialog defaultOpen>
        <DialogContent ref={ref}>
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>Artifact content.</DialogDescription>
          {contents(true)}
        </DialogContent>
      </Dialog>,
    );
    expect(ref.current).toBe(screen.getByRole("dialog"));
    mounted.unmount();
    expect(ref.current).toBeNull();
  });

  it("runs each attached caller ref's cleanup exactly once", () => {
    const disposals: ReturnType<typeof rs.fn>[] = [];
    const ref = rs.fn((_host: HTMLDivElement | null) => {
      const dispose = rs.fn();
      disposals.push(dispose);
      return dispose;
    });
    const mounted = render(
      <Sheet defaultOpen>
        <SheetContent ref={ref}>
          <SheetTitle>Report</SheetTitle>
          <SheetDescription>Artifact content.</SheetDescription>
          {contents(true)}
        </SheetContent>
      </Sheet>,
    );
    expect(ref).toHaveBeenCalledWith(screen.getByRole("dialog"));
    expect(
      ref.mock.calls.every(([host]) => host === screen.getByRole("dialog")),
    ).toBe(true);
    mounted.unmount();
    expect(disposals).toHaveLength(ref.mock.calls.length);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps the public primitive's asChild element as the actual host", async () => {
    function SlottedContent() {
      const ref = useDialogContentRef(undefined);
      return (
        <DialogPrimitive.Content asChild ref={ref}>
          <section data-testid="provided-host">
            <DialogTitle>Report</DialogTitle>
            <DialogDescription>Artifact content.</DialogDescription>
            {contents(true)}
          </section>
        </DialogPrimitive.Content>
      );
    }
    render(
      <Dialog defaultOpen>
        <SlottedContent />
      </Dialog>,
    );
    await waitFor(() => expect(guards()).toHaveLength(2));
    expect(screen.getByRole("dialog")).toBe(
      screen.getByTestId("provided-host"),
    );
    expect(guards()[0]!.parentElement).toBe(
      screen.getByTestId("provided-host"),
    );
  });

  it("returns to the content host when its only iframe cannot take Tab focus", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>Loading report.</DialogDescription>
          <iframe title="Pending report" tabIndex={-1} />
        </DialogContent>
      </Dialog>,
    );
    await waitFor(() => expect(guards()).toHaveLength(2));
    for (const guard of guards()) {
      act(() => guard.focus());
      expect(document.activeElement).toBe(screen.getByRole("dialog"));
    }
  });

  it("keeps a caller's focus redirect inside the actual content", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent
          showCloseButton={false}
          onFocusCapture={(event) => {
            const target = event.target as HTMLElement;
            if (target.textContent === "First action")
              event.currentTarget
                .querySelector<HTMLButtonElement>("[data-redirect]")
                ?.focus();
          }}
        >
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>Artifact content.</DialogDescription>
          <button>First action</button>
          <button data-redirect>Redirected action</button>
          <iframe title="Report" srcDoc="<p>Report</p>" />
        </DialogContent>
      </Dialog>,
    );
    await waitFor(() => expect(guards()).toHaveLength(2));
    act(() => guards()[1]!.focus());
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Redirected action" }),
    );
  });
});
