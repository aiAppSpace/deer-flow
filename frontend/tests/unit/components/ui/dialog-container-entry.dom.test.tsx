import { afterEach, describe, expect, it, rs } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState, type ComponentProps } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
});

function mountDialog(props: ComponentProps<typeof DialogContent> = {}) {
  render(
    <Dialog defaultOpen>
      <DialogContent {...props}>
        <DialogTitle>Async settings</DialogTitle>
        <DialogDescription>Choose an action.</DialogDescription>
        <button>First action</button>
        <input type="hidden" />
        <button disabled>Disabled action</button>
        <div style={{ display: "none" }}>
          <button>Hidden action</button>
        </div>
        <button style={{ visibility: "hidden" }}>Invisible action</button>
        <button>Last action</button>
      </DialogContent>
    </Dialog>,
  );
  const dialog = screen.getByRole("dialog");
  act(() => dialog.focus());
  return dialog;
}

function press(element: HTMLElement, props: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
    ...props,
  });
  fireEvent(element, event);
  return event;
}

describe("Dialog container directional entry", () => {
  it.each([false, true])(
    "enters real content from the fallback container (reverse=%s)",
    (reverse) => {
      const dialog = mountDialog({ showCloseButton: false });
      const target = screen.getByRole("button", {
        name: reverse ? "Last action" : "First action",
      });
      const event = press(dialog, { shiftKey: reverse });
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(target);
    },
  );

  it("recovers reverse entry after the real FocusScope mutation fallback", async () => {
    function AsyncDialog() {
      const [loading, setLoading] = useState(false);
      return (
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Async settings</DialogTitle>
            <DialogDescription>Choose an action.</DialogDescription>
            {!loading && (
              <button onClick={() => setLoading(true)}>Install</button>
            )}
            {loading && <span role="status">Installed</span>}
            <button>Refresh</button>
          </DialogContent>
        </Dialog>
      );
    }
    render(<AsyncDialog />);
    const install = screen.getByRole("button", { name: "Install" });
    act(() => install.focus());
    fireEvent.click(install);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    press(dialog, { shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" }),
    );
  });

  it("leaves an empty dialog to the existing FocusScope contract", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Loading</DialogTitle>
          <DialogDescription>Please wait.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    act(() => dialog.focus());
    expect(press(dialog, { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });

  it("runs the caller first and honors its preventDefault", () => {
    const onKeyDown = rs.fn((event: React.KeyboardEvent<HTMLDivElement>) =>
      event.preventDefault(),
    );
    const dialog = mountDialog({ onKeyDown });
    press(dialog, { shiftKey: true });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(dialog);
  });

  it("preserves ordinary content-key behavior and the installed first/last loop", () => {
    mountDialog({ showCloseButton: false });
    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });
    act(() => first.focus());
    expect(press(first).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(first);
    expect(press(first, { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(press(last).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it.each([
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { key: "ArrowDown" },
  ])("does not intercept modified or non-Tab keys %j", (props) => {
    const dialog = mountDialog();
    expect(press(dialog, props).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(dialog);
  });

  it("keeps Escape dismissal and trigger focus restoration", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open settings</DialogTrigger>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Settings content.</DialogDescription>
          <button>Action</button>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Open settings" });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    act(() => dialog.focus());
    press(dialog, { shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
