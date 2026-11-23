import { afterEach, describe, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode, type ComponentProps, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Kind = "dialog" | "sheet";
function panel(
  kind: Kind,
  children: ReactNode,
  props: ComponentProps<typeof DialogContent> = {},
) {
  return kind === "dialog" ? (
    <Dialog defaultOpen>
      <DialogContent showCloseButton={false} {...props}>
        <DialogTitle>Entry</DialogTitle>
        <DialogDescription>Choose an action.</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet defaultOpen>
      <SheetContent {...props}>
        <SheetTitle>Entry</SheetTitle>
        <SheetDescription>Choose an action.</SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  );
}

const frame = <iframe title="Report" srcDoc="<p>Report</p>" />;
const guards = () =>
  document.querySelectorAll<HTMLElement>("[data-dialog-focus-guard]");

for (const kind of ["dialog", "sheet"] as const)
  describe(`${kind} public mount autofocus ownership`, () => {
    it("enters the first real action without ever focusing an internal guard", () => {
      const focused: EventTarget[] = [];
      const observe = (event: FocusEvent) => focused.push(event.target!);
      document.addEventListener("focus", observe, true);
      try {
        render(
          panel(
            kind,
            <>
              <button>First action</button>
              {frame}
              <button>Last action</button>
            </>,
          ),
        );
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "First action" }),
        );
        expect(guards()).toHaveLength(2);
        for (const guard of guards()) expect(focused).not.toContain(guard);
      } finally {
        document.removeEventListener("focus", observe, true);
      }
    });

    it("skips links and ineligible actions and selects the first input text", () => {
      render(
        panel(
          kind,
          <>
            <a href="#help">Help</a>
            <button disabled>Disabled</button>
            <button hidden>Hidden</button>
            <input aria-label="Name" defaultValue="Example" />
            {frame}
          </>,
        ),
      );
      const input = screen.getByRole<HTMLInputElement>("textbox");
      expect(document.activeElement).toBe(input);
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, 7]);
      // Links remain sequential candidates once the mount autofocus is over.
      act(() => guards()[1]!.focus());
      expect(document.activeElement).toBe(screen.getByRole("link"));
    });

    it("uses raw radio order on mount but the checked member for sequential entry", () => {
      render(
        panel(
          kind,
          <>
            <input type="radio" name="scope" aria-label="All" />
            <input
              type="radio"
              name="scope"
              aria-label="Selected"
              defaultChecked
            />
            <button>Apply</button>
          </>,
        ),
      );
      const all = screen.getByRole<HTMLInputElement>("radio", {
        name: "All",
      });
      const selected = screen.getByRole<HTMLInputElement>("radio", {
        name: "Selected",
      });
      expect(document.activeElement).toBe(all);
      expect(all.checked).toBe(false);
      expect(selected.checked).toBe(true);
      act(() => guards()[1]!.focus());
      expect(document.activeElement).toBe(selected);
      expect(selected.checked).toBe(true);
      const event = new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      });
      fireEvent(selected, event);
      expect(event.defaultPrevented).toBe(false);
    });

    it("retains caller cancellation without assigning mount focus", () => {
      const before = document.activeElement;
      render(
        panel(
          kind,
          <>
            <button>Action</button>
            {frame}
          </>,
          { onOpenAutoFocus: (event) => event.preventDefault() },
        ),
      );
      expect(document.activeElement).toBe(before);
      expect(guards()).toHaveLength(2);
    });

    it("retains the caller's cancelled autofocus redirect", () => {
      render(
        panel(
          kind,
          <>
            <button>First</button>
            <button id="chosen">Chosen</button>
            {frame}
          </>,
          {
            onOpenAutoFocus: (event) => {
              event.preventDefault();
              document.querySelector<HTMLElement>("#chosen")!.focus();
            },
          },
        ),
      );
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Chosen" }),
      );
    });

    it("preserves a real focus redirect during ordinary mount autofocus", () => {
      render(
        panel(
          kind,
          <>
            <button
              onFocus={() =>
                document.querySelector<HTMLElement>("#redirected")!.focus()
              }
            >
              First
            </button>
            <button id="redirected">Redirected</button>
            {frame}
            <button>Last</button>
          </>,
        ),
      );
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Redirected" }),
      );
    });

    it("does not steal initial focus from an already open nested scope", () => {
      render(
        panel(
          kind,
          <>
            <button>Outer</button>
            {frame}
            <Dialog defaultOpen>
              <DialogContent showCloseButton={false}>
                <DialogTitle>Inner</DialogTitle>
                <DialogDescription>Inner scope.</DialogDescription>
                <button>Inner action</button>
              </DialogContent>
            </Dialog>
          </>,
        ),
      );
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Inner action" }),
      );
    });
  });

it("focuses the host when a Dialog has no eligible real action", () => {
  render(
    panel(
      "dialog",
      <>
        <a href="#help">Help</a>
        <iframe title="Hidden report" srcDoc="<p>Hidden</p>" hidden />
      </>,
    ),
  );
  expect(document.activeElement).toBe(screen.getByRole("dialog"));
  expect(guards()).toHaveLength(2);
});

for (const kind of ["dialog", "sheet"] as const)
  it(`${kind} keeps one boundary through StrictMode replay, close and reopen`, async () => {
    const Root = kind === "dialog" ? Dialog : Sheet;
    const Content = kind === "dialog" ? DialogContent : SheetContent;
    function controlled(open: boolean) {
      return (
        <StrictMode>
          <Root open={open}>
            <Content>
              <DialogTitle>Strict owner</DialogTitle>
              <DialogDescription>Reopen ownership.</DialogDescription>
              <button>Strict first</button>
              {frame}
            </Content>
          </Root>
        </StrictMode>
      );
    }
    const mounted = render(controlled(true));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Strict first" }),
    );
    expect(guards()).toHaveLength(2);
    mounted.rerender(controlled(false));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(guards()).toHaveLength(0);
    mounted.rerender(controlled(true));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Strict first" }),
      ),
    );
    expect(guards()).toHaveLength(2);
    mounted.unmount();
    expect(guards()).toHaveLength(0);
  });
